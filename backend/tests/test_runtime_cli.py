import asyncio
import hashlib
import hmac
import logging
import runpy
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal

import pytest
import pytest_asyncio
import typer
from fastapi import FastAPI
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.core.config as config_module
import app.core.database as db_module
import app.core.security as security_module
import app.main as main_module
import app.services.scheduler_service as scheduler_module
import app.worker as worker_module
from app.cli import cli as root_cli
from app.cli import db as db_cli
from app.cli import user as user_cli
from app.models import Base, PointAccount, User, UserSubscription


@pytest_asyncio.fixture
async def cli_maker():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield maker
    await engine.dispose()


def test_settings_validation_and_caches(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ValueError, match="GOODGUA_ENV must be development, test, or production"):
        config_module.Settings(env="staging", _env_file=None)

    with pytest.raises(ValueError, match="GOODGUA_JWT_SECRET must be at least 32 bytes in production"):
        config_module.Settings(
            env="production",
            database_url="mysql+asyncmy://user:pass@127.0.0.1:3306/goodgua",
            jwt_secret="short-secret",
            cors_origins="https://goodgua.net",
            _env_file=None,
        )

    with pytest.raises(ValueError, match="GOODGUA_CORS_ORIGINS cannot contain \\* in production"):
        config_module.Settings(
            env="production",
            database_url="mysql+asyncmy://user:pass@127.0.0.1:3306/goodgua",
            jwt_secret="x" * 32,
            cors_origins="*",
            _env_file=None,
        )

    settings = config_module.Settings(
        env="test",
        database_url="sqlite+aiosqlite:///:memory:",
        trusted_proxy_ips="1.1.1.1, 2.2.2.2",
        cors_origins="http://a.test, http://b.test",
        _env_file=None,
    )
    assert settings.cors_origin_list == ["http://a.test", "http://b.test"]
    assert settings.trusted_proxy_ip_set == {"1.1.1.1", "2.2.2.2"}

    production = config_module.Settings(
        env="production",
        database_url="mysql+asyncmy://user:pass@127.0.0.1:3306/goodgua",
        jwt_secret="x" * 32,
        cors_origins="https://goodgua.net",
        enable_payment_simulator=True,
        _env_file=None,
    )
    assert production.enable_payment_simulator is False

    monkeypatch.setenv("GOODGUA_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("GOODGUA_ENV", "test")
    config_module.get_settings.cache_clear()
    first = config_module.get_settings()
    second = config_module.get_settings()
    assert first is second
    config_module.get_settings.cache_clear()


def test_security_helpers_cover_hashes_and_token_failures() -> None:
    encoded = security_module._b64encode(b"hello")
    assert security_module._b64decode(encoded) == b"hello"

    legacy = security_module.hash_legacy_sha256("secret")
    assert security_module.is_legacy_password_hash(legacy) is True
    assert security_module.verify_password("secret", legacy) is True
    assert security_module.verify_password("wrong", legacy) is False

    hashed = security_module.hash_password("secret")
    assert security_module.verify_password("secret", hashed) is True
    assert security_module.verify_password("wrong", hashed) is False
    assert security_module.verify_password("secret", "not-a-valid-hash") is False

    assert security_module.password_needs_rehash(legacy) is True
    assert security_module.password_needs_rehash("not-a-valid-hash") is True

    token = security_module.issue_token("user-1", "admin", "secret", token_type="user", ttl_seconds=60)
    assert security_module.read_token(token, "secret", "user")[0] == "user-1"
    assert security_module.read_token(token, "wrong-secret") is None
    assert security_module.read_token(token, "secret", "admin") is None

    expired = security_module.issue_token("user-1", "admin", "secret", ttl_seconds=-1)
    assert security_module.read_token(expired, "secret") is None
    assert security_module.read_token("bad.token", "secret") is None

    header = security_module._b64encode(b'{"alg":"HS256","typ":"JWT"}')
    payload = security_module._b64encode(b"not-json")
    signature = security_module._b64encode(
        hmac.new(b"secret", f"{header}.{payload}".encode("ascii"), hashlib.sha256).digest()
    )
    assert security_module.read_token(f"{header}.{payload}.{signature}", "secret") is None

    missing_subject_payload = security_module._b64encode(
        b'{"role":"admin","typ":"user","exp":9999999999}'
    )
    missing_subject_sig = security_module._b64encode(
        hmac.new(
            b"secret",
            f"{header}.{missing_subject_payload}".encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    assert (
        security_module.read_token(
            f"{header}.{missing_subject_payload}.{missing_subject_sig}",
            "secret",
        )
        is None
    )


@pytest.mark.asyncio
async def test_init_database_and_get_session(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "SessionLocal", maker)
    monkeypatch.setattr(
        db_module,
        "get_settings",
        lambda: SimpleNamespace(auto_create_tables=True),
    )
    drop_mock = AsyncMock()
    monkeypatch.setattr(db_module, "_drop_agent_sessions_if_invalid", drop_mock)

    await db_module.init_database()
    async with engine.connect() as conn:
        exists = await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("users"))
    assert exists is True
    drop_mock.assert_awaited_once()

    seen_session = None
    async for session in db_module.get_session():
        seen_session = session
        break
    assert isinstance(seen_session, AsyncSession)

    false_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    false_maker = async_sessionmaker(false_engine, expire_on_commit=False)
    monkeypatch.setattr(db_module, "engine", false_engine)
    monkeypatch.setattr(db_module, "SessionLocal", false_maker)
    monkeypatch.setattr(
        db_module,
        "get_settings",
        lambda: SimpleNamespace(auto_create_tables=False),
    )
    drop_mock = AsyncMock()
    monkeypatch.setattr(db_module, "_drop_agent_sessions_if_invalid", drop_mock)
    await db_module.init_database()
    async with false_engine.connect() as conn:
        exists = await conn.run_sync(lambda sync_conn: inspect(sync_conn).has_table("users"))
    assert exists is False
    drop_mock.assert_not_awaited()

    await engine.dispose()
    await false_engine.dispose()


@pytest.mark.asyncio
async def test_main_lifespan_and_app_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    init_mock = AsyncMock()
    seed_mock = AsyncMock()

    @asynccontextmanager
    async def fake_session_local():
        yield object()

    monkeypatch.setattr(main_module, "init_database", init_mock)
    monkeypatch.setattr(main_module, "seed_defaults", seed_mock)
    monkeypatch.setattr(main_module, "SessionLocal", fake_session_local)

    async with main_module.lifespan(FastAPI()):
        pass

    init_mock.assert_awaited_once()
    seed_mock.assert_awaited_once()

    main_module.setup_logging()
    root = logging.getLogger()
    assert len(root.handlers) == 2

    monkeypatch.setattr(
        main_module,
        "get_settings",
        lambda: SimpleNamespace(cors_origin_list=["http://allowed.test"]),
    )
    app = main_module.create_app()
    assert any(middleware.cls is main_module.CORSMiddleware for middleware in app.user_middleware)
    assert any(route.path == "/health" for route in app.routes)


@pytest.mark.asyncio
async def test_scheduler_process_subscription_and_daily_task(cli_maker, monkeypatch: pytest.MonkeyPatch) -> None:
    async with cli_maker() as session:
        user = User(email="sub@example.com", nickname="sub", password_hash="hash")
        session.add(user)
        await session.flush()
        account = PointAccount(
            user_id=user.id,
            vip_daily_points_balance=Decimal("3"),
            credit_pack_points_balance=Decimal("0"),
        )
        session.add(account)
        active_sub = UserSubscription(
            user_id=user.id,
            plan_id="plan-1",
            order_id="order-1",
            start_at=datetime.now(UTC) - timedelta(days=1),
            end_at=datetime.now(UTC) + timedelta(days=1),
            next_renew_at=datetime.now(UTC) + timedelta(days=1),
            daily_vip_points_snapshot=9,
            duration_days_snapshot=31,
            status="active",
        )
        expired_sub = UserSubscription(
            user_id=user.id,
            plan_id="plan-2",
            order_id="order-2",
            start_at=datetime.now(UTC) - timedelta(days=10),
            end_at=datetime.now(UTC) - timedelta(seconds=1),
            next_renew_at=datetime.now(UTC) - timedelta(seconds=1),
            daily_vip_points_snapshot=5,
            duration_days_snapshot=31,
            status="active",
        )
        session.add_all([active_sub, expired_sub])
        await session.commit()

        await scheduler_module._process_subscription(session, active_sub.id)
        await session.flush()
        assert account.vip_daily_points_balance == Decimal("9")

        account.vip_daily_points_balance = Decimal("4")
        await scheduler_module._process_subscription(session, expired_sub.id)
        await session.flush()
        assert expired_sub.status == "expired"
        assert account.vip_daily_points_balance == Decimal("0")

        await scheduler_module._process_subscription(session, "missing-subscription")

        user_without_account = User(email="no-account@example.com", nickname="none", password_hash="hash")
        session.add(user_without_account)
        await session.flush()
        no_account_sub = UserSubscription(
            user_id=user_without_account.id,
            plan_id="plan-3",
            order_id="order-3",
            start_at=datetime.now(UTC),
            end_at=datetime.now(UTC) + timedelta(days=1),
            next_renew_at=datetime.now(UTC) + timedelta(days=1),
            daily_vip_points_snapshot=5,
            duration_days_snapshot=31,
            status="active",
        )
        session.add(no_account_sub)
        await session.commit()
        await scheduler_module._process_subscription(session, no_account_sub.id)

        zero_remaining_sub = UserSubscription(
            user_id=user.id,
            plan_id="plan-4",
            order_id="order-4",
            start_at=datetime.now(UTC) - timedelta(days=2),
            end_at=datetime.now(UTC) - timedelta(seconds=1),
            next_renew_at=datetime.now(UTC) - timedelta(seconds=1),
            daily_vip_points_snapshot=0,
            duration_days_snapshot=31,
            status="active",
        )
        account.vip_daily_points_balance = Decimal("0")
        session.add(zero_remaining_sub)
        await session.commit()
        await scheduler_module._process_subscription(session, zero_remaining_sub.id)
        assert zero_remaining_sub.status == "expired"

        zero_daily_sub = UserSubscription(
            user_id=user.id,
            plan_id="plan-5",
            order_id="order-5",
            start_at=datetime.now(UTC),
            end_at=datetime.now(UTC) + timedelta(days=1),
            next_renew_at=datetime.now(UTC) + timedelta(days=1),
            daily_vip_points_snapshot=0,
            duration_days_snapshot=31,
            status="active",
        )
        session.add(zero_daily_sub)
        await session.commit()
        await scheduler_module._process_subscription(session, zero_daily_sub.id)
        assert account.vip_daily_points_balance == Decimal("0")

    class EmptyReadResult:
        def all(self) -> list[tuple[str]]:
            return []

    class EmptyReadSession:
        async def execute(self, _statement):
            return EmptyReadResult()

    @asynccontextmanager
    async def empty_factory():
        yield EmptyReadSession()

    await scheduler_module.daily_vip_grant_task(empty_factory)

    processed: list[str] = []

    class FakeReadResult:
        def all(self) -> list[tuple[str]]:
            return [("ok-sub",), ("bad-sub",)]

    class FakeReadSession:
        async def execute(self, _statement):
            return FakeReadResult()

    class FakeWriteSession:
        def __init__(self) -> None:
            self.committed = False
            self.rolled_back = False

        async def commit(self) -> None:
            self.committed = True

        async def rollback(self) -> None:
            self.rolled_back = True

    class SessionFactory:
        def __init__(self) -> None:
            self.write_sessions: list[FakeWriteSession] = []
            self.calls = 0

        @asynccontextmanager
        async def __call__(self):
            self.calls += 1
            if self.calls == 1:
                yield FakeReadSession()
            else:
                session = FakeWriteSession()
                self.write_sessions.append(session)
                yield session

    async def fake_process(_session, sub_id: str) -> None:
        processed.append(sub_id)
        if sub_id == "bad-sub":
            raise RuntimeError("boom")

    session_factory = SessionFactory()
    monkeypatch.setattr(scheduler_module, "_process_subscription", fake_process)
    await scheduler_module.daily_vip_grant_task(session_factory)
    assert processed == ["ok-sub", "bad-sub"]
    assert session_factory.write_sessions[0].committed is True
    assert session_factory.write_sessions[1].rolled_back is True

    processed.clear()

    class SuccessReadResult:
        def all(self) -> list[tuple[str]]:
            return [("only-sub",)]

    class SuccessReadSession:
        async def execute(self, _statement):
            return SuccessReadResult()

    class SuccessWriteSession(FakeWriteSession):
        pass

    class SuccessFactory:
        def __init__(self) -> None:
            self.calls = 0
            self.write_session = SuccessWriteSession()

        @asynccontextmanager
        async def __call__(self):
            self.calls += 1
            if self.calls == 1:
                yield SuccessReadSession()
            else:
                yield self.write_session

    async def success_process(_session, sub_id: str) -> None:
        processed.append(sub_id)

    success_factory = SuccessFactory()
    monkeypatch.setattr(scheduler_module, "_process_subscription", success_process)
    await scheduler_module.daily_vip_grant_task(success_factory)
    assert processed == ["only-sub"]
    assert success_factory.write_session.committed is True


def test_scheduler_start_and_stop(monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[object] = []

    class FakeScheduler:
        def __init__(self, timezone: str) -> None:
            self.timezone = timezone
            self.jobs: list[dict[str, object]] = []
            self.started = False
            self.shutdown_called = False
            created.append(self)

        def add_job(self, func, trigger, id: str, replace_existing: bool) -> None:
            self.jobs.append({"func": func, "trigger": trigger, "id": id, "replace_existing": replace_existing})

        def start(self) -> None:
            self.started = True

        def shutdown(self, wait: bool = False) -> None:
            self.shutdown_called = True

    monkeypatch.setattr(scheduler_module, "AsyncIOScheduler", FakeScheduler)
    monkeypatch.setattr(scheduler_module, "CronTrigger", lambda **kwargs: kwargs)
    daily_mock = AsyncMock()
    monkeypatch.setattr(scheduler_module, "daily_vip_grant_task", daily_mock)
    scheduler_module._scheduler = None

    first = scheduler_module.start_scheduler(lambda: None)
    second = scheduler_module.start_scheduler(lambda: None)
    assert first is second
    assert len(created) == 1
    assert created[0].started is True
    assert created[0].jobs[0]["id"] == "daily_vip_grant"
    asyncio.run(created[0].jobs[0]["func"]())
    daily_mock.assert_awaited_once()

    scheduler_module.stop_scheduler()
    assert created[0].shutdown_called is True
    assert scheduler_module._scheduler is None
    scheduler_module.stop_scheduler()


@pytest.mark.asyncio
async def test_worker_main_and_entrypoint(monkeypatch: pytest.MonkeyPatch) -> None:
    setup_mock = MagicMock()
    init_mock = AsyncMock()
    seed_mock = AsyncMock()
    start_mock = MagicMock()

    @asynccontextmanager
    async def fake_session_local():
        yield object()

    class FakeEvent:
        async def wait(self) -> None:
            raise asyncio.CancelledError()

    monkeypatch.setattr(worker_module, "setup_logging", setup_mock)
    monkeypatch.setattr(worker_module, "init_database", init_mock)
    monkeypatch.setattr(worker_module, "seed_defaults", seed_mock)
    monkeypatch.setattr(worker_module, "SessionLocal", fake_session_local)
    monkeypatch.setattr(worker_module, "start_scheduler", start_mock)
    monkeypatch.setattr(worker_module.asyncio, "Event", lambda: FakeEvent())

    with pytest.raises(asyncio.CancelledError):
        await worker_module.main()

    setup_mock.assert_called_once()
    init_mock.assert_awaited_once()
    seed_mock.assert_awaited_once()
    start_mock.assert_called_once()

    worker_module.setup_logging()
    assert logging.getLogger().handlers

    captured: list[object] = []

    def fake_run(coro) -> None:
        captured.append(coro)
        coro.close()

    monkeypatch.setattr(asyncio, "run", fake_run)
    runpy.run_module("app.worker", run_name="__main__")
    assert captured


def test_worker_setup_logging_configures_console_handler() -> None:
    worker_module.setup_logging()
    root = logging.getLogger()
    assert root.level == logging.DEBUG
    assert len(root.handlers) == 1


@pytest.mark.asyncio
async def test_user_async_helpers(cli_maker, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_init_database() -> None:
        return None

    monkeypatch.setattr(user_cli, "init_database", fake_init_database)
    monkeypatch.setattr(user_cli, "SessionLocal", cli_maker)

    user, password = await user_cli._create_user("USER@example.com", None, "user", None)
    assert user.email == "user@example.com"
    assert user.nickname == "user"
    assert password

    with pytest.raises(typer.BadParameter):
        await user_cli._create_user("user@example.com", None, "user", None)

    users = await user_cli._list_users("user", "active")
    assert len(users) == 1
    assert await user_cli._list_users("user", None)
    assert await user_cli._list_users(None, "active")

    fetched_by_id = await user_cli._get_user(user.id)
    fetched_by_email = await user_cli._get_user(user.email)
    assert fetched_by_id.id == user.id
    assert fetched_by_email.id == user.id

    updated, old_status = await user_cli._set_user_status(user.id, "suspended")
    assert old_status == "active"
    assert updated.status == "suspended"
    with pytest.raises(typer.BadParameter):
        await user_cli._set_user_status("missing", "active")

    reset_user, new_password = await user_cli._reset_password(user.id, None)
    assert security_module.verify_password(new_password, reset_user.password_hash) is True
    with pytest.raises(typer.BadParameter):
        await user_cli._reset_password("missing", None)


def test_cli_entrypoints_and_db_commands(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    assert root_cli.info.no_args_is_help is True

    called = {"cli": False}

    def fake_cli() -> None:
        called["cli"] = True

    monkeypatch.setattr("app.cli.cli", fake_cli)
    runpy.run_module("app.cli.__main__", run_name="__main__")
    assert called["cli"] is True

    async def fake_init_database() -> None:
        return None

    class DummyResult:
        def scalar_one(self) -> int:
            return 1

        def scalar(self) -> str:
            return "goodgua-test"

    class DummySession:
        async def execute(self, _statement):
            return DummyResult()

    @asynccontextmanager
    async def dummy_session_local():
        yield DummySession()

    monkeypatch.setattr(db_cli, "init_database", fake_init_database)
    monkeypatch.setattr(db_cli, "SessionLocal", dummy_session_local)
    db_cli.db_init()
    db_cli.db_check()
    output = capsys.readouterr().out
    assert "Database tables created" in output
    assert "Connected to database: goodgua-test" in output

    async def failing_init_database() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(db_cli, "init_database", failing_init_database)
    with pytest.raises(typer.Exit):
        db_cli.db_init()
    with pytest.raises(typer.Exit):
        db_cli.db_check()


def test_user_cli_commands_and_error_paths(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    class StubUser(SimpleNamespace):
        pass

    async def fake_create_user(email: str, nickname: str | None, role: str, password: str | None):
        return StubUser(
            id="u1",
            email=email.lower(),
            nickname=nickname or "writer",
            role=role,
            status="active",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            last_login_at=None,
        ), password or "generated-pass"

    async def fake_list_users(*_args):
        return []

    async def fake_list_users_non_empty(*_args):
        return [
            StubUser(
                id="u1",
                email="writer@example.com",
                nickname="Writer",
                role="user",
                status="active",
                created_at=datetime.now(UTC),
            )
        ]

    async def fake_get_user(identifier: str):
        if identifier == "missing":
            return None
        return StubUser(
            id="u1",
            email="writer@example.com",
            nickname="Writer",
            role="user",
            status="active",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            last_login_at=None,
        )

    async def fake_set_status(identifier: str, status: str):
        if identifier == "error":
            raise RuntimeError("boom")
        return StubUser(email="writer@example.com"), "active"

    async def fake_reset_password(identifier: str, password: str | None):
        return StubUser(email="writer@example.com"), password or "new-generated"

    monkeypatch.setattr(user_cli, "_create_user", fake_create_user)
    monkeypatch.setattr(user_cli, "_list_users", fake_list_users)
    monkeypatch.setattr(user_cli, "_get_user", fake_get_user)
    monkeypatch.setattr(user_cli, "_set_user_status", fake_set_status)
    monkeypatch.setattr(user_cli, "_reset_password", fake_reset_password)
    monkeypatch.setattr(user_cli._console, "print", MagicMock())

    with pytest.raises(typer.BadParameter):
        user_cli.create_admin("not-an-email")
    with pytest.raises(typer.BadParameter):
        user_cli.create_user("not-an-email")

    user_cli.create_admin("admin@example.com", password=None)
    user_cli.create_admin("admin@example.com", password="custom-pass")
    user_cli.create_user("writer@example.com", nickname="Writer", password="custom-pass")
    user_cli.create_user("writer@example.com", nickname="Writer", password=None)
    output = capsys.readouterr().out
    assert "Admin account created" in output
    assert "User account created" in output
    assert "[custom]" in output

    with pytest.raises(typer.Exit):
        user_cli.list_users(None, None)

    monkeypatch.setattr(user_cli, "_list_users", fake_list_users_non_empty)
    user_cli.list_users(None, None)
    user_cli._console.print.assert_called_once()

    with pytest.raises(typer.Exit):
        user_cli.get_user("missing")
    user_cli.get_user("writer@example.com")

    async def bad_parameter(*_args, **_kwargs):
        raise typer.BadParameter("bad input")

    monkeypatch.setattr(user_cli, "_create_user", bad_parameter)
    with pytest.raises(typer.BadParameter):
        user_cli.create_admin("badparam@example.com")
    with pytest.raises(typer.BadParameter):
        user_cli.create_user("badparam@example.com")

    monkeypatch.setattr(user_cli, "_set_user_status", bad_parameter)
    with pytest.raises(typer.BadParameter):
        user_cli.set_user_status("u1", "active")

    monkeypatch.setattr(user_cli, "_reset_password", bad_parameter)
    with pytest.raises(typer.BadParameter):
        user_cli.reset_password("u1", None)

    with pytest.raises(typer.BadParameter):
        user_cli.set_user_status("u1", "wrong")
    monkeypatch.setattr(user_cli, "_set_user_status", fake_set_status)
    user_cli.set_user_status("u1", "active")
    with pytest.raises(typer.Exit):
        user_cli.set_user_status("error", "active")

    monkeypatch.setattr(user_cli, "_reset_password", fake_reset_password)
    user_cli.reset_password("u1", None)
    user_cli.reset_password("u1", "manual")
    output = capsys.readouterr().out
    assert "Password reset for writer@example.com" in output

    async def failing_create_user(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(user_cli, "_create_user", failing_create_user)
    with pytest.raises(typer.Exit):
        user_cli.create_admin("broken@example.com")
    with pytest.raises(typer.Exit):
        user_cli.create_user("broken@example.com")

    async def failing_reset(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(user_cli, "_reset_password", failing_reset)
    with pytest.raises(typer.Exit):
        user_cli.reset_password("broken", None)
