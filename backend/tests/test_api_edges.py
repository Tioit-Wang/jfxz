import base64
import hashlib
import hmac
import json
import runpy
import sys
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from fastapi import HTTPException, Response
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.api.routes as routes_module
_TOOL_ACTION_MAP = {
    "create_or_update_character": "save_character",
    "create_or_update_setting": "save_setting",
    "delete_character": "delete_character",
    "delete_setting": "delete_setting",
    "get_character": "get_character",
    "list_characters": "list_characters",
    "get_setting": "get_setting",
    "list_settings": "list_settings",
    "get_chapter": "get_chapter",
    "list_chapters": "list_chapters",
    "update_chapter_summary": "update_chapter_summary",
    "get_work_info": "get_work_info",
    "update_work_info": "update_work_info",
}


def _tool_action(name: str) -> dict | None:
    action_type = _TOOL_ACTION_MAP.get(name)
    if action_type is None:
        return None
    display = routes_module._TOOL_DISPLAY_NAMES.get(name, name)
    return {"type": action_type, "label": display}


from app.api.routes import (
    AdminLogin,
    AiModelIn,
    AnalyzeIn,
    ChapterIn,
    ChatIn,
    ChatSessionIn,
    ConfigValueIn,
    EmailLogin,
    NamedContentIn,
    OrderIn,
    ProductIn,
    RegisterIn,
    UserPatch,
    WorkIn,
    active_ai_models,
    admin_configs,
    admin_create_model,
    admin_create_product,
    admin_delete_product,
    admin_login,
    admin_models,
    admin_order_detail,
    admin_orders,
    admin_patch_config,
    admin_patch_user,
    admin_products,
    admin_session_detail,
    admin_sessions,
    admin_subscription_detail,
    admin_subscriptions,
    admin_update_model,
    admin_update_product,
    admin_user_detail,
    admin_users,
    analyze_chapter,
    billing_products,
    client_ip,
    confirm_verified_payment,
    create_chapter,
    create_character,
    create_chat_session,
    create_order,
    create_setting,
    create_user_account,
    create_work,
    current_admin,
    current_user,
    delete_chapter,
    delete_character,
    delete_setting,
    delete_work,
    encode_sse,
    ensure_point_account,
    get_me,
    get_order,
    get_work,
    grant_order,
    list_by_work,
    list_chapters,
    list_characters,
    list_chat_messages,
    list_chat_sessions,
    list_settings,
    list_works,
    login_email,
    message_page,
    must_get,
    normalized_run,
    owned_work,
    patch_me,
    reference_context,
    register_email,
    seed_defaults,
    send_chat_message,
    simulate_paid,
    update_chapter,
    update_character,
    update_setting,
    update_work,
    workspace_bootstrap,
)
from conftest import _create_mock_agent
from app.models import AiModel

# Save real function reference before autouse fixture replaces it
_real_resolve_editor_model = routes_module._resolve_editor_model


def _make_fake_editor_model() -> AiModel:
    return AiModel(
        id="test-editor-model",
        display_name="Test Editor Model",
        provider_model_id="test-editor-model",
        status="active",
        cache_hit_input_cost_per_million=Decimal("0"),
        input_cost_per_million=Decimal("0"),
        output_cost_per_million=Decimal("0"),
        profit_multiplier=Decimal("1.10"),
        max_context_tokens=1000000,
        max_output_tokens=384000,
    )


async def _mock_resolve_editor_model(*args, **kwargs) -> AiModel:
    return _make_fake_editor_model()

from agno.run.agent import RunEvent
from app.core.config import Settings, get_settings
from app.core.database import _drop_agent_sessions_if_invalid, get_session, init_database
from app.core.security import (
    hash_legacy_sha256,
    hash_password,
    issue_token,
    password_needs_rehash,
    read_token,
    verify_password,
)
from app.main import create_app
from app.models import (
    AgentRunStore,
    AiModel,
    Base,
    BillingOrder,
    Chapter,
    Character,
    ChatSession,
    GlobalConfig,
    PaymentRecord,
    Plan,
    PointTransaction,
    SettingItem,
    CreditPack,
    User,
    UserSubscription,
    Work,
)
from app.scripts.create_admin import (
    AdminEmailExistsError,
    async_main,
    create_admin_account,
    generate_admin_password,
)
from app.scripts.create_admin import (
    main as create_admin_main,
)


@pytest_asyncio.fixture(autouse=True)
def _mock_agno_agent(monkeypatch: pytest.MonkeyPatch):
    import app.services.agent_service as _agent_service
    import app.api.routes as _routes

    monkeypatch.setattr(_agent_service, "create_agent", _create_mock_agent)
    monkeypatch.setattr(_routes, "_resolve_editor_model", _mock_resolve_editor_model)


@pytest_asyncio.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as db:
        await seed_defaults(db)
        await create_user_account(db, "admin@example.com", "admin12345", role="admin")
        await db.commit()
        yield db
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_session():
        yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def auth_headers(client: AsyncClient, email: str = "edge@example.com") -> dict[str, str]:
    response = await client.post("/auth/register", json={"email": email, "nickname": "Edge", "password": "user12345"})
    assert response.status_code == 200
    user = response.json()["user"]
    token = issue_token(user["id"], user["role"], get_settings().jwt_secret, token_type="user")
    return {"Authorization": f"Bearer {token}"}


async def admin_headers(client: AsyncClient) -> dict[str, str]:
    response = await client.post("/admin/login", json={"email": "admin@example.com", "password": "admin12345"})
    assert response.status_code == 200
    user = response.json()["user"]
    token = issue_token(user["id"], user["role"], get_settings().jwt_secret, token_type="admin")
    return {"Authorization": f"Bearer {token}"}


def request_stub() -> object:
    return type("RequestStub", (), {"headers": {}, "client": type("ClientStub", (), {"host": "testclient"})()})()


async def test_direct_auth_helpers_and_seed_existing_user(session: AsyncSession) -> None:
    await seed_defaults(session)
    assert await must_get(session, User, (await session.execute(select(User.id))).scalars().first())
    seeded_models = (await session.execute(select(AiModel).order_by(AiModel.sort_order))).scalars().all()
    assert [model.provider_model_id for model in seeded_models] == ["deepseek-v4-flash", "deepseek-v4-pro"]
    editor_config = (
        await session.execute(
            select(GlobalConfig).where(
                GlobalConfig.config_group == "ai.editor_check",
                GlobalConfig.config_key == "model_id",
            )
        )
    ).scalar_one()
    assert editor_config.value_type == "string"

    await seed_defaults(session)
    assert (await session.execute(select(func.count(AiModel.id)))).scalar_one() == 2
    with pytest.raises(HTTPException) as not_found:
        await must_get(session, User, "missing")
    assert not_found.value.status_code == 404

    with pytest.raises(HTTPException) as missing:
        await current_user(session=session)
    assert missing.value.status_code == 401

    with pytest.raises(HTTPException) as invalid_prefix:
        await current_user(authorization="Token bad", session=session)
    assert invalid_prefix.value.status_code == 401

    with pytest.raises(HTTPException) as invalid_token:
        await current_user(authorization="Bearer bad", session=session)
    assert invalid_token.value.status_code == 401

    disabled = User(
        email="disabled@example.com",
        nickname="Disabled",
        password_hash=hash_password("x"),
        status="disabled",
    )
    session.add(disabled)
    await session.commit()
    disabled_token = issue_token(disabled.id, disabled.role, get_settings().jwt_secret)
    with pytest.raises(HTTPException) as inactive:
        await current_user(authorization=f"Bearer {disabled_token}", session=session)
    assert inactive.value.status_code == 403

    user = User(email="normal@example.com", nickname="Normal", password_hash=hash_password("x"))
    session.add(user)
    await session.commit()
    token = issue_token(user.id, user.role, get_settings().jwt_secret)
    assert (await current_user(authorization=f"Bearer {token}", session=session)).email == "normal@example.com"
    with pytest.raises(HTTPException) as admin_required:
        await current_admin(session=session)
    assert admin_required.value.status_code == 401


async def test_seed_defaults_bootstraps_admin_from_settings(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(
        env="test",
        database_url="sqlite+aiosqlite:///:memory:",
        bootstrap_admin_email="BOOTSTRAP@example.com",
        bootstrap_admin_password="admin12345",
    )
    monkeypatch.setattr(routes_module, "get_settings", lambda: settings)

    await seed_defaults(session)

    user = (
        await session.execute(select(User).where(User.email == "bootstrap@example.com"))
    ).scalar_one()
    assert user.role == "admin"
    assert user.status == "active"
    assert verify_password("admin12345", user.password_hash)

    changed = Settings(
        env="test",
        database_url="sqlite+aiosqlite:///:memory:",
        bootstrap_admin_email="bootstrap@example.com",
        bootstrap_admin_password="changed12345",
    )
    monkeypatch.setattr(routes_module, "get_settings", lambda: changed)

    await seed_defaults(session)
    await session.refresh(user)

    assert user.role == "admin"
    assert user.status == "active"
    assert verify_password("changed12345", user.password_hash)


async def test_direct_account_and_profile_paths(session: AsyncSession) -> None:
    user = await create_user_account(session, "profile@example.com", "user12345")
    await session.commit()
    existing = await ensure_point_account(session, user.id)
    again = await ensure_point_account(session, user.id)
    assert existing.id == again.id
    assert (await get_me(user, session))["points"]["id"] == existing.id
    assert (await patch_me(UserPatch(), user, session))["nickname"] == "profile"
    assert (await patch_me(UserPatch(nickname="Updated"), user, session))["nickname"] == "Updated"


async def test_direct_list_by_work_with_and_without_search(session: AsyncSession) -> None:
    user = User(email="owner@example.com", nickname="Owner", password_hash=hash_password("x"))
    session.add(user)
    await session.flush()
    work = Work(user_id=user.id, title="作品")
    session.add(work)
    await session.flush()
    session.add_all(
        [
            Character(work_id=work.id, name="林昼", summary="主角"),
            Character(work_id=work.id, name="潮声", summary="意象"),
        ]
    )
    await session.commit()

    assert len(await list_by_work(session, Character, work.id)) == 2
    assert [item["name"] for item in await list_by_work(session, Character, work.id, "林")] == ["林昼"]


async def test_workspace_bootstrap_returns_initial_workspace_bundle(session: AsyncSession) -> None:
    user = await create_user_account(session, "bootstrap@example.com", "user12345", "Bootstrap")
    await session.commit()
    work = await create_work(
        WorkIn(title="聚合作品", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    character = await create_character(work["id"], NamedContentIn(name="角色", summary="摘要", detail=None), user, session)
    setting = await create_setting(work["id"], NamedContentIn(name="设定", summary="摘要", detail=None), user, session)

    bundle = await workspace_bootstrap(work["id"], user, session)

    assert bundle["work"]["id"] == work["id"]
    assert bundle["chapters"]
    assert bundle["characters"][0]["id"] == character["id"]
    assert bundle["settings"][0]["id"] == setting["id"]
    assert bundle["sessions"][0]["id"] == bundle["active_session"]["id"]
    assert bundle["messages"] == {"messages": [], "has_more": False, "next_before": None}
    assert bundle["profile"]["user"]["id"] == user.id


async def test_reference_context_batches_refs_without_session_get(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    user = await create_user_account(session, "batch-refs@example.com", "user12345", "Batch")
    await session.commit()
    work = await create_work(
        WorkIn(title="批量引用", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    work_id = work["id"]
    chapter = (await list_chapters(work_id, user, session))[0]
    character = await create_character(work_id, NamedContentIn(name="角色", summary="摘要", detail=None), user, session)
    setting = await create_setting(work_id, NamedContentIn(name="设定", summary="摘要", detail=None), user, session)

    async def forbidden_get(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("reference_context should batch with execute instead of per-reference session.get")

    monkeypatch.setattr(type(session), "get", forbidden_get)
    refs = await reference_context(
        session,
        work_id,
        [
            {"type": "chapter", "id": chapter["id"]},
            {"type": "chapter", "id": chapter["id"]},
            {"type": "character", "id": character["id"]},
            {"type": "setting", "id": setting["id"]},
            {"type": "suggestion", "issue": "问题", "quote": "原文"},
        ],
    )

    assert [item["type"] for item in refs] == ["chapter", "character", "setting", "suggestion"]


async def test_chat_helpers_and_error_branches(session: AsyncSession) -> None:
    user = await create_user_account(session, "chat-helper@example.com", "user12345", "Helper")
    other = await create_user_account(session, "chat-other@example.com", "user12345", "Other")
    await session.commit()
    work = await create_work(
        WorkIn(title="助手作品", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    work_id = work["id"]
    chapter = (await list_chapters(work_id, user, session))[0]
    character = await create_character(work_id, NamedContentIn(name="角色", summary="摘要", detail=None), user, session)
    setting = await create_setting(work_id, NamedContentIn(name="设定", summary="摘要", detail=None), user, session)
    refs = await reference_context(
        session,
        work_id,
        [
            {"type": "chapter", "id": chapter["id"]},
            {"type": "character", "id": character["id"]},
            {"type": "setting", "id": setting["id"]},
            {"type": "suggestion", "issue": "问题"},
        ],
    )
    assert [item["type"] for item in refs] == ["chapter", "character", "setting", "suggestion"]
    assert normalized_run({"role": "ai", "content": "旧消息"}, 2)["role"] == "assistant"
    page = message_page(
        [
            {"id": "m1", "role": "user", "content": "一"},
            {"id": "m2", "role": "assistant", "content": "二"},
            {"id": "m3", "role": "user", "content": "三"},
        ],
        1,
        "m3",
    )
    assert page["messages"][0]["id"] == "m2"
    assert page["has_more"] is True
    assert _tool_action("update_work_info") == {"type": "update_work_info", "label": "更新作品信息"}
    assert _tool_action("create_or_update_character") == {"type": "save_character", "label": "创建/更新角色"}
    assert _tool_action("nonexistent") is None
    assert "event: done" in encode_sse("done", {"ok": True}).decode()
    assert "data: 文本" in encode_sse(None, "文本").decode()
    from app.services.agent_service import build_system_prompt
    work_obj = await session.get(Work, work_id)
    prompt = build_system_prompt(work_obj, [])
    assert work_obj.title in prompt

    chat = await create_chat_session(work_id, ChatSessionIn(), user, session)
    with pytest.raises(HTTPException) as list_error:
        await list_chat_messages(chat["id"], other, session)
    assert list_error.value.status_code == 404
    with pytest.raises(HTTPException) as send_error:
        await send_chat_message(chat["id"], ChatIn(message="hi", references=[]), other, session)
    assert send_error.value.status_code == 404
    with pytest.raises(HTTPException) as points_error:
        await send_chat_message(chat["id"], ChatIn(message="hi", references=[]), user, session)
    assert points_error.value.status_code == 402

    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 0
    account.credit_pack_points_balance = 1
    inactive_model = (await session.execute(select(AiModel).order_by(AiModel.sort_order.desc()))).scalars().first()
    inactive_model.status = "inactive"
    await session.commit()
    before_transactions = await session.scalar(
        select(func.count(PointTransaction.id)).where(PointTransaction.source_id == chat["id"])
    )
    with pytest.raises(HTTPException) as inactive_model_error:
        await send_chat_message(
            chat["id"],
            ChatIn(message="hi", references=[], model_id=inactive_model.id),
            user,
            session,
        )
    assert inactive_model_error.value.status_code == 400
    with pytest.raises(HTTPException) as missing_model_error:
        await send_chat_message(chat["id"], ChatIn(message="hi", references=[], model_id="missing-model"), user, session)
    assert missing_model_error.value.status_code == 400
    assert (
        await session.scalar(select(func.count(PointTransaction.id)).where(PointTransaction.source_id == chat["id"]))
    ) == before_transactions
    await session.refresh(account)
    assert account.credit_pack_points_balance == 1

    account.vip_daily_points_balance = 0
    account.credit_pack_points_balance = 10000000
    chat_model = await session.get(ChatSession, chat["id"])
    await session.delete(await session.get(AgentRunStore, chat_model.agno_session_id))
    await session.commit()
    active_model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
    stream = await send_chat_message(
        chat["id"], ChatIn(message="首条消息", references=[], model_id=active_model.id), user, session
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body
    assert (await session.get(ChatSession, chat["id"])).title == "首条消息"


async def test_send_chat_without_active_models_does_not_consume_points(session: AsyncSession) -> None:
    user = await create_user_account(session, "no-model@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="无模型作品", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 1
    account.credit_pack_points_balance = 0
    for model in (await session.execute(select(AiModel))).scalars():
        model.status = "inactive"
    await session.commit()

    with pytest.raises(HTTPException) as no_model_error:
        await send_chat_message(chat["id"], ChatIn(message="hi", references=[]), user, session)

    assert no_model_error.value.status_code == 503
    assert (
        await session.scalar(select(func.count(PointTransaction.id)).where(PointTransaction.source_id == chat["id"]))
    ) == 0
    await session.refresh(account)
    assert account.vip_daily_points_balance == 1


async def test_user_endpoint_edges(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work = (
        await client.post(
            "/works",
            headers=headers,
            json={"title": "边界作品", "short_intro": "", "synopsis": "", "genre_tags": [], "background_rules": ""},
        )
    ).json()

    setting = (
        await client.post(
            f"/works/{work['id']}/settings",
            headers=headers,
            json={"name": "默认类型设定", "summary": "摘要", "detail": None},
        )
    ).json()
    assert setting["type"] == "other"

    chapter = (
        await client.post(
            f"/works/{work['id']}/chapters",
            headers=headers,
            json={"title": "第十章", "content": "正文", "summary": None, "order_index": 10},
        )
    ).json()
    assert chapter["order_index"] == 10
    patched = (
        await client.patch(
            f"/works/{work['id']}/chapters/{chapter['id']}",
            headers=headers,
            json={"title": "第十章 改", "content": "正文", "order_index": 10},
        )
    ).json()
    assert patched["summary"] is None

    other = await auth_headers(client, "intruder@example.com")
    assert (await client.delete(f"/works/{work['id']}", headers=other)).status_code == 404


async def test_auth_contract_rejects_takeover_and_migrates_legacy_hash(client: AsyncClient, session: AsyncSession) -> None:
    assert (await client.post("/auth/email", json={"email": "legacy@example.com", "password": "anything"})).status_code == 410
    response = await client.post(
        "/auth/register",
        json={"email": "takeover@example.com", "nickname": "Takeover", "password": "correct123"},
    )
    assert response.status_code == 200
    user_id = response.json()["user"]["id"]
    client.cookies.clear()
    assert (
        await client.post("/auth/login", json={"email": "takeover@example.com", "password": "wrong1234"})
    ).status_code == 401
    assert (await client.get("/me")).status_code == 401

    legacy = User(
        email="legacy@example.com",
        nickname="Legacy",
        password_hash=hash_legacy_sha256("legacy123"),
    )
    session.add(legacy)
    await session.commit()
    assert (await client.post("/auth/login", json={"email": "legacy@example.com", "password": "legacy123"})).status_code == 200
    refreshed = await session.get(User, legacy.id)
    assert refreshed.password_hash != hash_legacy_sha256("legacy123")
    assert (await session.get(User, user_id)).email == "takeover@example.com"


async def test_csrf_origin_and_token_contract(client: AsyncClient) -> None:
    origin = "http://localhost:3000"
    payload = {"email": "csrf@example.com", "nickname": "Csrf", "password": "user12345"}

    assert (await client.post("/csrf", headers={"Origin": origin})).status_code == 405
    assert (await client.post("/auth/register", headers={"Origin": origin}, json=payload)).status_code == 403
    assert routes_module.valid_csrf_token("broken") is False
    assert routes_module.valid_csrf_token(".signature") is False

    token = (await client.get("/csrf", headers={"Origin": origin})).json()["csrf_token"]
    response = await client.post(
        "/auth/register",
        headers={"Origin": origin, "X-CSRF-Token": token},
        json=payload,
    )
    assert response.status_code == 200
    token = client.cookies.get("jfxz_csrf")
    assert token

    assert (await client.patch("/me", headers={"Origin": origin}, json={"nickname": "Blocked"})).status_code == 403
    assert (
        await client.patch(
            "/me",
            headers={"Origin": "https://evil.test", "X-CSRF-Token": token},
            json={"nickname": "Blocked"},
        )
    ).status_code == 403
    assert (
        await client.patch(
            "/me",
            headers={"Origin": origin, "X-CSRF-Token": token},
            json={"nickname": "Allowed"},
        )
    ).json()["nickname"] == "Allowed"
    client.cookies.set("jfxz_csrf", "bad.token")
    assert (
        await client.patch(
            "/me",
            headers={"Origin": origin, "X-CSRF-Token": "bad.token"},
            json={"nickname": "Blocked"},
        )
    ).status_code == 403


async def test_login_lockout_logout_cookie_and_duplicate_register(client: AsyncClient) -> None:
    payload = {"email": "lockout@example.com", "nickname": "Lock", "password": "correct123"}
    assert (await client.post("/auth/register", json=payload)).status_code == 200
    client.cookies.clear()
    assert (await client.post("/auth/register", json=payload)).status_code == 409
    for _ in range(5):
        assert (
            await client.post("/auth/login", json={"email": "lockout@example.com", "password": "wrong12345"})
        ).status_code == 401
    assert (
        await client.post("/auth/login", json={"email": "lockout@example.com", "password": "correct123"})
    ).status_code == 429
    csrf = (await client.get("/csrf")).json()["csrf_token"]
    assert (await client.post("/auth/logout", headers={"X-CSRF-Token": csrf})).json() == {"ok": True}


async def test_admin_login_replaces_existing_user_cookie(client: AsyncClient) -> None:
    assert (
        await client.post(
            "/auth/register",
            json={"email": "cookie-swap@example.com", "nickname": "Swap", "password": "user12345"},
        )
    ).status_code == 200
    assert client.cookies.get("jfxz_session")

    response = await client.post(
        "/admin/login", json={"email": "admin@example.com", "password": "admin12345"}
    )

    assert response.status_code == 200
    assert client.cookies.get("jfxz_session") is None
    assert client.cookies.get("jfxz_admin_session")
    assert (await client.get("/me")).json()["user"]["role"] == "admin"


async def test_cookie_auth_paths_and_admin_role_check(session: AsyncSession) -> None:
    user = await create_user_account(session, "cookie-user@example.com", "user12345")
    admin = await create_user_account(session, "cookie-admin@example.com", "admin12345", role="admin")
    await session.commit()
    user_token = issue_token(user.id, user.role, get_settings().jwt_secret, token_type="user")
    admin_token = issue_token(admin.id, admin.role, get_settings().jwt_secret, token_type="admin")
    user_admin_type_token = issue_token(user.id, user.role, get_settings().jwt_secret, token_type="admin")

    assert (await current_user(jfxz_session=user_token, session=session)).id == user.id
    assert (await current_user(jfxz_admin_session=admin_token, session=session)).id == admin.id
    assert (await current_admin(jfxz_admin_session=admin_token, session=session)).id == admin.id
    with pytest.raises(HTTPException) as role_error:
        await current_admin(jfxz_admin_session=user_admin_type_token, session=session)
    assert role_error.value.status_code == 403


async def test_create_admin_script_generates_password_and_rejects_duplicates(session: AsyncSession) -> None:
    generated = generate_admin_password()
    assert len(generated) >= 24
    assert " " not in generated

    admin, password = await create_admin_account(session, "SCRIPT-ADMIN@example.com")
    await session.commit()

    assert admin.email == "script-admin@example.com"
    assert admin.role == "admin"
    assert verify_password(password, admin.password_hash)
    with pytest.raises(AdminEmailExistsError):
        await create_admin_account(session, "script-admin@example.com")


async def test_create_admin_async_main_uses_database_session() -> None:
    admin, password = await async_main("script-main@example.com")
    assert admin.email == "script-main@example.com"
    assert admin.role == "admin"
    assert verify_password(password, admin.password_hash)


def test_create_admin_cli_prints_password_and_exits_on_duplicate(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    async def fake_async_main(email: str) -> tuple[object, str]:
        return type("UserStub", (), {"email": email.lower()})(), "generated-password"

    async def fake_duplicate(_email: str) -> tuple[object, str]:
        raise AdminEmailExistsError("email already exists: cli@example.com")

    monkeypatch.setattr("sys.argv", ["jfxz-create-admin", "CLI@example.com"])
    monkeypatch.setattr("app.scripts.create_admin.async_main", fake_async_main)
    create_admin_main()
    output = capsys.readouterr().out
    assert "Email: cli@example.com" in output
    assert "Password: generated-password" in output

    monkeypatch.setattr("sys.argv", ["jfxz-create-admin", "--email", "FLAG@example.com"])
    create_admin_main()
    output = capsys.readouterr().out
    assert "Email: flag@example.com" in output

    monkeypatch.setattr("sys.argv", ["jfxz-create-admin", "cli@example.com"])
    monkeypatch.setattr("app.scripts.create_admin.async_main", fake_duplicate)
    with pytest.raises(SystemExit) as exited:
        create_admin_main()
    assert str(exited.value) == "email already exists: cli@example.com"

    monkeypatch.setattr("sys.argv", ["jfxz-create-admin", "both@example.com", "--email", "both@example.com"])
    with pytest.raises(SystemExit) as both_args:
        create_admin_main()
    assert both_args.value.code == 2

    monkeypatch.setattr("sys.argv", ["jfxz-create-admin"])
    with pytest.raises(SystemExit) as no_email:
        create_admin_main()
    assert no_email.value.code == 2


def test_settings_and_token_validation_edges(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(env="DEVELOPMENT", cors_origins="http://a.test, http://b.test")
    assert settings.env == "development"
    assert settings.cors_origin_list == ["http://a.test", "http://b.test"]
    with pytest.raises(ValueError):
        Settings(env="invalid")
    with pytest.raises(ValueError):
        Settings(env="production", jwt_secret="short")
    with pytest.raises(ValueError):
        Settings(env="production", jwt_secret="x" * 32, cors_origins="*")

    token = issue_token("u1", "user", "secret", token_type="user", ttl_seconds=60)
    assert read_token(token, "other") is None
    assert read_token(token, "secret", "admin") is None
    assert read_token(issue_token("u1", "user", "secret", ttl_seconds=-1), "secret") is None
    assert read_token("not.a.jwt", "secret") is None
    assert read_token(signed_test_token(b"{not-json", "secret"), "secret") is None
    missing_subject = {"role": "user", "typ": "user", "exp": int((datetime.now(UTC) + timedelta(seconds=60)).timestamp())}
    assert read_token(signed_test_token(json.dumps(missing_subject).encode(), "secret"), "secret") is None
    assert password_needs_rehash("not-a-real-hash") is True
    assert verify_password("pw", "not-a-real-hash") is False
    request = type(
        "RequestStub",
        (),
        {"headers": {"x-forwarded-for": "203.0.113.1, 10.0.0.1"}, "client": type("ClientStub", (), {"host": "10.0.0.10"})()},
    )()
    assert client_ip(request) == "10.0.0.10"
    monkeypatch.setattr(routes_module, "get_settings", lambda: Settings(env="test", trusted_proxy_ips="10.0.0.10"))
    assert client_ip(request) == "203.0.113.1"


def signed_test_token(payload: bytes, secret: str) -> str:
    header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    encoded_payload = base64.urlsafe_b64encode(payload).rstrip(b"=").decode()
    signing_input = f"{header}.{encoded_payload}"
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), signing_input.encode("ascii"), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{signing_input}.{signature}"


async def test_database_session_and_lifespan_helpers() -> None:
    await init_database()
    async for db in get_session():
        assert isinstance(db, AsyncSession)
        break
    app = create_app()
    async with app.router.lifespan_context(app):
        assert app.title == "JinFan Writing MVP"


async def test_cross_work_child_updates_are_rejected(session: AsyncSession) -> None:
    owner = await create_user_account(session, "owner-child@example.com", "user12345")
    attacker = await create_user_account(session, "attacker-child@example.com", "user12345")
    await session.commit()
    owner_work = await create_work(WorkIn(title="Owner", short_intro="", synopsis="", genre_tags=[], background_rules=""), owner, session)
    attacker_work = await create_work(
        WorkIn(title="Attacker", short_intro="", synopsis="", genre_tags=[], background_rules=""), attacker, session
    )
    owner_chapter = (await list_chapters(owner_work["id"], owner, session))[0]
    owner_character = await create_character(
        owner_work["id"], NamedContentIn(name="Owner Character", summary="摘要"), owner, session
    )
    owner_setting = await create_setting(
        owner_work["id"], NamedContentIn(name="Owner Setting", summary="摘要"), owner, session
    )

    with pytest.raises(HTTPException) as chapter_error:
        await update_chapter(
            attacker_work["id"],
            owner_chapter["id"],
            ChapterIn(title="Hacked", content="", summary=""),
            attacker,
            session,
        )
    assert chapter_error.value.status_code == 404
    with pytest.raises(HTTPException) as character_error:
        await delete_character(attacker_work["id"], owner_character["id"], attacker, session)
    assert character_error.value.status_code == 404
    with pytest.raises(HTTPException) as setting_error:
        await update_setting(
            attacker_work["id"],
            owner_setting["id"],
            NamedContentIn(name="Hacked", summary="Nope"),
            attacker,
            session,
        )
    assert setting_error.value.status_code == 404
    assert (await session.get(Chapter, owner_chapter["id"])).title == "第一章"
    assert await session.get(Character, owner_character["id"])
    assert (await session.get(SettingItem, owner_setting["id"])).name == "Owner Setting"


async def test_payment_confirmation_guards_and_prod_simulation_gate(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "pay-guard@example.com", "user12345")
    await session.commit()
    products = await billing_products(session)
    order = await create_order(OrderIn(product_type="credit_pack", product_id=products["credit_packs"][0]["id"]), user, session)
    payment = await one_payment(session, order["id"])

    with pytest.raises(HTTPException) as amount_error:
        await confirm_verified_payment(
            session, payment, {"trade_status": "TRADE_SUCCESS"}, "ALI-1", expected_amount="0.01"
        )
    assert amount_error.value.status_code == 400
    payment.out_trade_no = "wrong-order"
    with pytest.raises(HTTPException) as order_error:
        await confirm_verified_payment(session, payment, {"trade_status": "TRADE_SUCCESS"}, "ALI-1")
    assert order_error.value.status_code == 400
    payment.out_trade_no = order["order_no"]
    with pytest.raises(HTTPException) as status_error:
        await confirm_verified_payment(session, payment, {"trade_status": "WAIT_BUYER_PAY"}, "ALI-1")
    assert status_error.value.status_code == 400

    monkeypatch.setattr(routes_module, "get_settings", lambda: Settings(env="test", enable_payment_simulator=False))
    with pytest.raises(HTTPException) as disabled_error:
        await simulate_paid(order["id"], user, session)
    assert disabled_error.value.status_code == 404

    monkeypatch.setattr(
        routes_module,
        "get_settings",
        lambda: Settings(env="production", jwt_secret="x" * 32, enable_payment_simulator=True),
    )
    with pytest.raises(HTTPException) as prod_error:
        await simulate_paid(order["id"], user, session)
    assert prod_error.value.status_code == 404


async def test_verified_payment_success_is_idempotent(session: AsyncSession) -> None:
    user = await create_user_account(session, "pay-success@example.com", "user12345")
    await session.commit()
    products = await billing_products(session)
    order_data = await create_order(OrderIn(product_type="credit_pack", product_id=products["credit_packs"][0]["id"]), user, session)
    payment = await one_payment(session, order_data["id"])
    order = await confirm_verified_payment(
        session,
        payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": order_data["order_no"]},
        "ALI-SUCCESS",
        order_data["amount"],
    )
    await session.commit()
    assert order.status == "paid"
    first_grants = (
        await session.execute(select(PointTransaction).where(PointTransaction.source_id == order.id))
    ).scalars().all()
    await confirm_verified_payment(
        session,
        payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": order_data["order_no"]},
        "ALI-SUCCESS-2",
        order_data["amount"],
    )
    await session.commit()
    second_grants = (
        await session.execute(select(PointTransaction).where(PointTransaction.source_id == order.id))
    ).scalars().all()
    assert len(second_grants) == len(first_grants) == 1


async def one_payment(session: AsyncSession, order_id: str) -> PaymentRecord:
    payment = (await session.execute(select(PaymentRecord).where(PaymentRecord.order_id == order_id))).scalar_one()
    return payment


async def test_billing_topup_and_admin_edges(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    admin = await admin_headers(client)
    products = (await client.get("/billing/products")).json()
    topup_order = (
        await client.post(
            "/billing/orders",
            headers=headers,
            json={"product_type": "credit_pack", "product_id": products["credit_packs"][0]["id"]},
        )
    ).json()
    assert (await client.post(f"/billing/orders/{topup_order['id']}/simulate-paid", headers=headers)).json()[
        "status"
    ] == "paid"

    users = await client.get("/admin/users", headers=admin)
    assert users.status_code == 200
    assert users.json()["page"] == 1
    assert users.json()["page_size"] == 20
    assert users.json()["total"] >= 1
    user_id = next(item["id"] for item in users.json()["items"] if item["email"] == "edge@example.com")
    user_detail = (await client.get(f"/admin/users/{user_id}", headers=admin)).json()
    assert user_detail["subscription"] is None
    assert (
        await client.patch(f"/admin/users/{user_id}", headers=admin, json={"nickname": "Edge Renamed"})
    ).json()["nickname"] == "Edge Renamed"

    topup = (
        await client.post(
            "/admin/products/credit-packs",
            headers=admin,
            json={
                "name": "测试积分包",
                "price_amount": "8.00",
                "points": 88,
                "status": "inactive",
            },
        )
    ).json()
    assert topup["points"] == 88
    product_page = (await client.get("/admin/products?kind=credit-packs&page=1&page_size=1", headers=admin)).json()
    assert product_page["page"] == 1
    assert product_page["page_size"] == 1
    assert product_page["total"] >= 1
    assert len(product_page["items"]) == 1
    assert (
        await client.patch(
            f"/admin/products/credit-packs/{topup['id']}",
            headers=admin,
            json={
                "name": "测试积分包2",
                "price_amount": "9.00",
                "points": 99,
                "status": "active",
            },
        )
    ).json()["points"] == 99

    assert (await client.get("/admin/sessions", headers=admin)).json()["items"] == []
    configs = (await client.get("/admin/configs", headers=admin)).json()["items"]
    assert {item["config_key"] for item in configs} >= {"enabled", "app_id"}
    enabled = next(item for item in configs if item["config_key"] == "enabled")
    updated = (
        await client.patch(
            f"/admin/configs/{enabled['id']}",
            headers=admin,
            json={"boolean_value": True, "integer_value": 1, "decimal_value": "2.50", "json_value": {"ok": True}},
        )
    ).json()
    assert updated["boolean_value"] is True


async def test_admin_model_errors_and_active_list(client: AsyncClient) -> None:
    admin = await admin_headers(client)
    active_models = (await client.get("/ai/models")).json()
    assert {item["status"] for item in active_models} == {"active"}
    assert "provider_model_id" not in active_models[0]

    payload = {
        "display_name": "边界模型",
        "provider_model_id": "edge-model",
        "description": None,
        "logic_score": 1,
        "prose_score": 2,
        "knowledge_score": 3,
        "max_context_tokens": 1000,
        "max_output_tokens": 500,
        "temperature": "0.00",
        "cache_hit_input_cost_per_million": "0.10",
        "input_cost_per_million": "1.00",
        "output_cost_per_million": "2.00",
        "profit_multiplier": "1.10",
        "status": "active",
        "sort_order": None,
    }
    created = (await client.post("/admin/models", headers=admin, json=payload)).json()
    assert created["display_name"] == "边界模型"
    assert (await client.post("/admin/models", headers=admin, json=payload)).status_code == 409
    assert (await client.get("/admin/models?status=archived", headers=admin)).status_code == 400
    assert (await client.post("/admin/models", headers=admin, json={**payload, "logic_score": 0})).status_code == 422
    assert (await client.post("/admin/models", headers=admin, json={**payload, "temperature": "2.01"})).status_code == 422
    assert (await client.patch("/admin/models/missing", headers=admin, json=payload)).status_code == 404

    other_payload = {**payload, "display_name": "另一个模型", "provider_model_id": "other-edge-model"}
    other = (await client.post("/admin/models", headers=admin, json=other_payload)).json()
    duplicate_update_payload = {**payload, "provider_model_id": other["provider_model_id"]}
    assert (
        await client.patch(f"/admin/models/{created['id']}", headers=admin, json=duplicate_update_payload)
    ).status_code == 409


async def test_direct_admin_model_routes(session: AsyncSession) -> None:
    admin = await create_user_account(session, "model-admin@example.com", "admin12345", role="admin")
    await session.commit()
    active = await active_ai_models(session)
    assert active[0]["display_name"] == "DeepSeek-v4-flash"
    assert "provider_model_id" not in active[0]

    payload = AiModelIn(
        display_name="直接模型",
        provider_model_id="direct-model",
        description="直接调用",
        logic_score=4,
        prose_score=4,
        knowledge_score=4,
        max_context_tokens=16000,
        max_output_tokens=1000,
        temperature="0.60",
        cache_hit_input_cost_per_million="0.10",
        input_cost_per_million="1.00",
        output_cost_per_million="2.00",
        profit_multiplier="1.10",
        status="inactive",
        sort_order=3,
    )
    created = await admin_create_model(payload, admin, session)
    assert created["provider_model_id"] == "direct-model"
    page = await admin_models(
        q="直接",
        status="inactive",
        logic_min=4,
        logic_max=4,
        context_min=10000,
        context_max=20000,
        output_min=900,
        output_max=1100,
        _admin=admin,
        session=session,
    )
    assert page["items"][0]["id"] == created["id"]
    with pytest.raises(HTTPException) as duplicate_create:
        await admin_create_model(payload, admin, session)
    assert duplicate_create.value.status_code == 409

    payload.status = "active"
    payload.display_name = "直接模型改"
    updated = await admin_update_model(created["id"], payload, admin, session)
    assert updated["display_name"] == "直接模型改"
    other_payload = payload.model_copy(update={"provider_model_id": "direct-model-other"})
    other = await admin_create_model(other_payload, admin, session)
    payload.provider_model_id = other["provider_model_id"]
    with pytest.raises(HTTPException) as duplicate_update:
        await admin_update_model(created["id"], payload, admin, session)
    assert duplicate_update.value.status_code == 409


async def test_config_value_model_accepts_all_supported_types(session: AsyncSession) -> None:
    config = (await session.execute(select(GlobalConfig))).scalars().first()
    payload = ConfigValueIn(
        string_value="x",
        integer_value=1,
        decimal_value="1.25",
        boolean_value=False,
        json_value={"a": 1},
    )
    assert payload.json_value == {"a": 1}
    assert config is not None


async def test_direct_user_routes_cover_core_documented_workflows(session: AsyncSession) -> None:
    user = await create_user_account(session, "direct@example.com", "user12345", "Direct")
    await session.commit()
    assert await list_works(user, session) == []

    work = await create_work(
        WorkIn(
            title="直接调用作品",
            short_intro="简介",
            synopsis="梗概",
            genre_tags=["奇幻"],
            background_rules="规则",
        ),
        user,
        session,
    )
    work_id = work["id"]
    assert (await get_work(work_id, user, session))["title"] == "直接调用作品"
    assert len(await list_works(user, session)) == 1
    assert (
        await update_work(
            work_id,
            WorkIn(title="改名作品", short_intro="", synopsis="", genre_tags=[], background_rules=""),
            user,
            session,
        )
    )["title"] == "改名作品"

    character = await create_character(
        work_id,
        NamedContentIn(name="角色甲", summary="摘要", detail="详情"),
        user,
        session,
    )
    assert (await list_characters(work_id, None, user, session))[0]["name"] == "角色甲"
    assert (await list_characters(work_id, "甲", user, session))[0]["name"] == "角色甲"
    assert (
        await update_character(
            work_id,
            character["id"],
            NamedContentIn(name="角色乙", summary="摘要2", detail=None),
            user,
            session,
        )
    )["name"] == "角色乙"

    setting = await create_setting(
        work_id,
        NamedContentIn(name="地点甲", summary="摘要", detail="详情", type="location"),
        user,
        session,
    )
    assert (await list_settings(work_id, "地点", "location", user, session))[0]["name"] == "地点甲"
    assert (
        await update_setting(
            work_id,
            setting["id"],
            NamedContentIn(name="地点乙", summary="摘要2", detail=None, type=None),
            user,
            session,
        )
    )["type"] == "location"

    chapter = await create_chapter(
        work_id,
        ChapterIn(title="第二章", content="正文", summary="摘要"),
        user,
        session,
    )
    assert len(await list_chapters(work_id, user, session)) == 2
    assert (
        await update_chapter(
            work_id,
            chapter["id"],
            ChapterIn(title="第二章 改", content="正文2", summary="摘要2", order_index=2),
            user,
            session,
        )
    )["title"] == "第二章 改"
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 100
    await session.commit()
    assert "suggestions" in (await analyze_chapter(work_id, AnalyzeIn(content="第一段\n第二段"), user, session))
    account.vip_daily_points_balance = 0
    account.credit_pack_points_balance = 100
    await session.commit()
    assert "suggestions" in (await analyze_chapter(work_id, AnalyzeIn(content="第三段"), user, session))

    chat = await create_chat_session(work_id, ChatSessionIn(title="直接会话"), user, session)
    assert (await list_chat_sessions(work_id, user, session))[0]["title"] == "直接会话"
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(
            message="继续写章节和角色设定",
            references=[
                {"type": "chapter", "id": chapter["id"]},
                {"type": "character", "id": character["id"]},
                {"type": "setting", "id": setting["id"]},
                {"type": "suggestion", "name": "AI 建议", "summary": "节奏建议", "quote": "正文"},
            ],
        ),
        user,
        session,
    )
    chunks = [chunk async for chunk in stream.body_iterator]
    body = b"".join(chunks).decode()
    assert "event: done" in body
    assert "创建/更新角色" in body
    page = await list_chat_messages(chat["id"], user, session)
    assert [item["role"] for item in page["messages"]] == ["user", "assistant"]
    assert page["messages"][1]["tool_results"]
    older_page = await list_chat_messages(chat["id"], user, session, 1, page["messages"][1]["id"])
    assert older_page["has_more"] is False
    assert older_page["messages"][0]["role"] == "user"

    assert (await delete_chapter(work_id, chapter["id"], user, session)) == {"ok": True}
    assert (await delete_setting(work_id, setting["id"], user, session)) == {"ok": True}
    assert (await delete_character(work_id, character["id"], user, session)) == {"ok": True}
    assert (await delete_work(work_id, user, session)) == {"ok": True}


async def test_direct_billing_and_admin_routes(session: AsyncSession) -> None:
    user = User(email="billing-direct@example.com", nickname="Billing", password_hash=hash_password("x"))
    admin = User(
        email="admin-direct@example.com",
        nickname="Admin",
        password_hash=hash_password("x"),
        role="admin",
    )
    session.add_all([user, admin])
    await session.commit()

    products = await billing_products(session)
    plan_id = products["plans"][0]["id"]
    topup_id = products["credit_packs"][0]["id"]
    plan_order = await create_order(OrderIn(product_type="plan", product_id=plan_id), user, session)
    assert (await get_order(plan_order["id"], admin, session))["id"] == plan_order["id"]
    assert (await simulate_paid(plan_order["id"], user, session))["status"] == "paid"

    topup_order = await create_order(OrderIn(product_type="credit_pack", product_id=topup_id), user, session)
    topup_model = await session.get(BillingOrder, topup_order["id"])
    await grant_order(session, topup_model)
    await session.commit()
    assert topup_model.status == "paid"

    assert (await admin_users(None, admin, session))["items"]
    assert (await admin_user_detail(user.id, admin, session))["user"]["email"] == user.email
    assert (await admin_patch_user(user.id, UserPatch(status="active", nickname="B2"), admin, session))[
        "nickname"
    ] == "B2"
    assert (await admin_products(admin, session))["plans"]
    created_plan = await admin_create_product(
        "plans",
        ProductIn(
            name="直测套餐",
            price_amount="12.00",
            daily_vip_points=12,
            bundled_credit_pack_points=3,
            status="inactive",
        ),
        admin,
        session,
    )
    assert (await admin_update_product("plans", created_plan["id"], ProductIn(name="直测套餐2", price_amount="13.00"), admin, session))[
        "name"
    ] == "直测套餐2"
    assert await admin_delete_product("plans", created_plan["id"], admin, session) == {"ok": True}
    with pytest.raises(HTTPException) as bad_delete:
        await admin_delete_product("bad-kind", created_plan["id"], admin, session)
    assert bad_delete.value.status_code == 400
    created_topup = await admin_create_product(
        "credit-packs",
        ProductIn(name="直测积分包", price_amount="5.00", points=50),
        admin,
        session,
    )
    assert await session.get(CreditPack, created_topup["id"])
    assert await session.get(Plan, created_plan["id"])

    assert await admin_delete_product("credit-packs", created_topup["id"], admin, session) == {"ok": True}
    assert (await session.get(CreditPack, created_topup["id"])).status == "inactive"
    assert (await admin_orders(None, None, None, admin, session))["items"]
    assert (await admin_orders("JF", "paid", "plan", admin, session))["items"]
    assert (await admin_order_detail(plan_order["id"], admin, session))["payments"]
    subscriptions = await admin_subscriptions(None, None, admin, session)
    assert subscriptions["items"]
    assert subscriptions["items"][0]["user_email"] == user.email
    assert (await admin_subscriptions("billing-direct", "active", admin, session))["items"]
    assert (await admin_subscription_detail(subscriptions["items"][0]["id"], admin, session))["user"]["email"] == user.email
    assert (await admin_sessions(None, admin, session))["items"] == []

    work = Work(user_id=user.id, title="会话作品")
    session.add(work)
    await session.flush()
    chat = await create_chat_session(work.id, ChatSessionIn(), user, session)
    assert (await admin_session_detail(chat["id"], admin, session))["agent"]["runs"] == []
    assert (await admin_sessions("会话作品", admin, session))["items"][0]["work_title"] == "会话作品"

    orphan_chat = ChatSession(
        user_id=user.id,
        work_id="missing-work-id",
        agno_session_id="missing-work-session",
        title="缺失作品会话",
    )
    session.add(orphan_chat)
    await session.commit()
    orphan_items = (await admin_sessions(None, admin, session))["items"]
    orphan_item = next(item for item in orphan_items if item["id"] == orphan_chat.id)
    assert orphan_item["user_email"] == user.email
    assert orphan_item["work_title"] is None

    configs = await admin_configs(None, admin, session)
    config_id = configs["items"][0]["id"]
    assert (
        await admin_patch_config(
            config_id,
            ConfigValueIn(string_value="direct", boolean_value=True),
            admin,
            session,
        )
    )["string_value"] in {"direct", "******"}


async def test_register_integrity_race_uses_real_unique_constraint(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    existing = await create_user_account(session, "race@example.com", "user12345")
    await session.commit()

    original_one = routes_module.one

    async def stale_email_precheck(db: AsyncSession, statement: object) -> object:
        text = str(statement)
        if "users.email" in text and "race@example.com" in str(statement.compile(compile_kwargs={"literal_binds": True})):
            return None
        return await original_one(db, statement)

    monkeypatch.setattr(routes_module, "one", stale_email_precheck)

    with pytest.raises(HTTPException) as duplicate:
        await register_email(RegisterIn(email=existing.email, password="user12345"), Response(), request_stub(), session)

    assert duplicate.value.status_code == 409


async def test_direct_auth_routes_write_audits_and_return_responses(session: AsyncSession) -> None:
    response = Response()
    registered = await register_email(
        RegisterIn(email="direct-auth@example.com", nickname=None, password="user12345"),
        response,
        request_stub(),
        session,
    )
    assert registered["user"]["nickname"] == "direct-auth"

    duplicate_response = Response()
    with pytest.raises(HTTPException) as duplicate:
        await register_email(
            RegisterIn(email="direct-auth@example.com", password="user12345"),
            duplicate_response,
            request_stub(),
            session,
        )
    assert duplicate.value.status_code == 409

    login_response = Response()
    logged_in = await login_email(
        EmailLogin(email="direct-auth@example.com", password="user12345"),
        login_response,
        request_stub(),
        session,
    )
    assert logged_in["user"]["email"] == "direct-auth@example.com"

    with pytest.raises(HTTPException) as bad_login:
        await login_email(
            EmailLogin(email="direct-auth@example.com", password="wrong12345"),
            Response(),
            request_stub(),
            session,
        )
    assert bad_login.value.status_code == 401

    admin_response = Response()
    admin = await admin_login(
        AdminLogin(email="admin@example.com", password="admin12345"),
        admin_response,
        request_stub(),
        session,
    )
    assert admin["user"]["role"] == "admin"

    legacy = User(
        email="direct-legacy@example.com",
        nickname="Legacy",
        password_hash=hash_legacy_sha256("legacy123"),
    )
    session.add(legacy)
    await session.commit()
    await login_email(EmailLogin(email=legacy.email, password="legacy123"), Response(), request_stub(), session)
    await session.refresh(legacy)
    assert verify_password("legacy123", legacy.password_hash)
    assert legacy.password_hash != hash_legacy_sha256("legacy123")


async def test_owned_work_missing_and_existing_session_bootstrap(session: AsyncSession) -> None:
    user = await create_user_account(session, "bootstrap-existing@example.com", "user12345")
    other = await create_user_account(session, "bootstrap-other@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="已有会话", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    first = await workspace_bootstrap(work["id"], user, session)
    second = await workspace_bootstrap(work["id"], user, session)

    assert second["active_session"]["id"] == first["active_session"]["id"]
    with pytest.raises(HTTPException) as missing:
        await owned_work(session, user.id, "missing")
    assert missing.value.status_code == 404
    with pytest.raises(HTTPException) as forbidden:
        await owned_work(session, other.id, work["id"])
    assert forbidden.value.status_code == 404


async def test_content_route_branch_combinations(session: AsyncSession) -> None:
    user = await create_user_account(session, "content-branches@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="内容分支", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    setting = await create_setting(
        work["id"],
        NamedContentIn(name="东门", summary="地点", detail="城东", type="location"),
        user,
        session,
    )
    assert (await list_settings(work["id"], None, None, user, session))[0]["id"] == setting["id"]
    assert (await list_settings(work["id"], "东", None, user, session))[0]["id"] == setting["id"]
    assert (await list_settings(work["id"], None, "location", user, session))[0]["id"] == setting["id"]

    explicit = await create_chapter(
        work["id"],
        ChapterIn(title="显式排序", content="", summary="", order_index=10),
        user,
        session,
    )
    auto = await create_chapter(work["id"], ChapterIn(title="自动排序", content="", summary=""), user, session)
    assert explicit["order_index"] == 10
    assert auto["order_index"] == 3

    assert await analyze_chapter(work["id"], AnalyzeIn(content="  \n  "), user, session) == {"suggestions": []}
    with pytest.raises(HTTPException) as no_points:
        await analyze_chapter(work["id"], AnalyzeIn(content="需要积分"), user, session)
    assert no_points.value.status_code == 402


async def test_analyze_chapter_charges_after_success(session: AsyncSession) -> None:
    user = await create_user_account(session, "analysis-success@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="检测扣费", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 2
    await session.commit()

    result = await analyze_chapter(work["id"], AnalyzeIn(content="这里有错别字。"), user, session)

    await session.refresh(account)
    assert "suggestions" in result
    assert account.vip_daily_points_balance == Decimal("1.99")
    transactions = (
        await session.execute(select(PointTransaction).where(PointTransaction.source_type == "ai_editor_check"))
    ).scalars().all()
    assert len(transactions) == 1


async def test_analyze_chapter_empty_success_still_charges(session: AsyncSession) -> None:
    user = await create_user_account(session, "analysis-empty@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="无问题检测", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    account = await ensure_point_account(session, user.id)
    account.credit_pack_points_balance = 1
    await session.commit()

    assert await analyze_chapter(work["id"], AnalyzeIn(content="无明显问题"), user, session) == {"suggestions": []}

    await session.refresh(account)
    assert account.credit_pack_points_balance == Decimal("0.99")


async def test_analyze_chapter_failures_do_not_charge(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "analysis-failure@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="失败不扣费", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 1
    await session.commit()

    async def fail_analysis(_text: str, _base_url: str, _api_key: str, _model_id: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
        raise HTTPException(status_code=502, detail="analysis response parse failed")

    monkeypatch.setattr(routes_module, "request_analysis", fail_analysis)
    with pytest.raises(HTTPException) as error:
        await analyze_chapter(work["id"], AnalyzeIn(content="解析失败"), user, session)

    await session.refresh(account)
    assert error.value.status_code == 500
    assert account.vip_daily_points_balance == 1


def test_parse_analysis_output_requires_valid_json_and_quotes() -> None:
    parsed = routes_module.parse_analysis_output(
        '```json\n{"suggestions":[{"quote":"原文","issue":"错别字","options":["改文"]},{"quote":"缺失","issue":"跳过","options":["改"]}]}\n```',
        "这里有原文。",
    )
    assert parsed == [{"quote": "原文", "issue": "错别字", "options": ["改文"]}]
    with pytest.raises(HTTPException) as error:
        routes_module.parse_analysis_output("not json", "正文")
    assert error.value.status_code == 502
    assert routes_module.strip_json_fence('```json\n{"suggestions":[]}') == '{"suggestions":[]}'


def test_normalize_mentions_skips_invalid_items() -> None:
    assert routes_module.normalize_mentions(
        [
            {"type": "bad", "id": "x", "label": "坏", "start": 0, "end": 1},
            {"type": "chapter", "id": "c1", "label": "章", "start": "0", "end": 1},
            {"type": "chapter", "id": "c2", "label": "章二", "start": 1, "end": 1},
            {"type": "setting", "id": "s1", "label": "设定", "start": 0, "end": 3},
        ]
    ) == [{"type": "setting", "id": "s1", "label": "设定", "start": 0, "end": 3}]


async def test_request_analysis_configuration_and_http_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    # No API key returns empty result in test env (no error)
    suggestions, usage = await routes_module.request_analysis("正文", "https://test", "", "model")
    assert suggestions == []
    assert usage["prompt_tokens"] == 0

    class GoodResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": '{"suggestions":[{"quote":"正文","issue":"问题","options":["改文"]}]}'
                        }
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            }

    class GoodClient:
        def __init__(self, timeout: int) -> None:
            self.timeout = timeout

        async def __aenter__(self) -> "GoodClient":
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, *_args: object, **_kwargs: object) -> GoodResponse:
            return GoodResponse()

    monkeypatch.setattr(routes_module.httpx, "AsyncClient", GoodClient)
    suggestions, usage = await routes_module.request_analysis("正文", "https://deepseek.test", "key", "deepseek-v4-flash")
    assert suggestions == [{"quote": "正文", "issue": "问题", "options": ["改文"]}]
    assert usage["prompt_tokens"] == 100
    assert usage["completion_tokens"] == 50

    class BadClient(GoodClient):
        async def post(self, *_args: object, **_kwargs: object) -> GoodResponse:
            raise routes_module.httpx.ConnectError("down")

    monkeypatch.setattr(routes_module.httpx, "AsyncClient", BadClient)
    with pytest.raises(HTTPException) as request_error:
        await routes_module.request_analysis("正文", "https://test", "key", "model")
    assert request_error.value.status_code == 502


async def test_reference_context_ignores_missing_ids_and_preserves_suggestions(session: AsyncSession) -> None:
    user = await create_user_account(session, "refs-missing@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="引用缺口", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chapter = (await list_chapters(work["id"], user, session))[0]

    refs = await reference_context(
        session,
        work["id"],
        [
            {"type": "chapter", "id": ""},
            {"type": "unknown", "id": "ignored"},
            {"type": "suggestion", "detail": "直接建议"},
            {"type": "suggestion", "detail": "后续建议"},
            {"type": "chapter", "id": chapter["id"]},
            {"type": "chapter", "id": "missing-chapter"},
            {"type": "character", "id": "missing-character"},
            {"type": "setting", "id": "missing-setting"},
        ],
    )

    assert [item["type"] for item in refs] == ["suggestion", "suggestion", "chapter"]
    assert refs[0]["id"] == "suggestion-1"


async def test_send_chat_done_event_survives_deleted_agent(session: AsyncSession) -> None:
    user = await create_user_account(session, "deleted-agent@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="删除 Agent", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()
    stream = await send_chat_message(chat["id"], ChatIn(message="删除后仍完成", references=[]), user, session)
    chat_model = await session.get(ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    await session.delete(agent)
    await session.commit()

    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()

    assert "event: done" in body
    assert await session.get(AgentRunStore, chat_model.agno_session_id) is None


async def test_billing_and_admin_remaining_error_branches(session: AsyncSession) -> None:
    user = await create_user_account(session, "remaining-billing@example.com", "user12345")
    other = await create_user_account(session, "remaining-other@example.com", "user12345")
    admin = await create_user_account(session, "remaining-admin@example.com", "admin12345", role="admin")
    await session.commit()
    products = await billing_products(session)
    plan_id = products["plans"][0]["id"]
    topup_id = products["credit_packs"][0]["id"]

    order_data = await create_order(OrderIn(product_type="credit_pack", product_id=topup_id), user, session)
    with pytest.raises(HTTPException) as hidden_order:
        await get_order(order_data["id"], other, session)
    assert hidden_order.value.status_code == 404
    with pytest.raises(HTTPException) as wrong_owner:
        await simulate_paid(order_data["id"], other, session)
    assert wrong_owner.value.status_code == 404
    payment = await one_payment(session, order_data["id"])
    await session.delete(payment)
    await session.commit()
    with pytest.raises(HTTPException) as missing_payment:
        await simulate_paid(order_data["id"], user, session)
    assert missing_payment.value.status_code == 404

    plan = await session.get(Plan, plan_id)
    plan.bundled_credit_pack_points = 0
    plan_order = await create_order(OrderIn(product_type="plan", product_id=plan_id), user, session)
    plan_model = await session.get(BillingOrder, plan_order["id"])
    await grant_order(session, plan_model)
    await session.commit()
    assert (await session.execute(select(UserSubscription).where(UserSubscription.order_id == plan_model.id))).scalar_one()

    assert (await admin_patch_user(user.id, UserPatch(status="disabled"), admin, session))["status"] == "disabled"
    assert (await admin_patch_user(user.id, UserPatch(nickname="Only Name"), admin, session))["nickname"] == "Only Name"
    assert (await admin_patch_user(user.id, UserPatch(), admin, session))["email"] == user.email

    # 非法 status 值应返回 400
    with pytest.raises(HTTPException) as exc_invalid:
        await admin_patch_user(user.id, UserPatch(status="invalid_status"), admin, session)
    assert exc_invalid.value.status_code == 400
    assert "status must be active or disabled" in exc_invalid.value.detail

    with pytest.raises(HTTPException) as exc_deleted:
        await admin_patch_user(user.id, UserPatch(status="deleted"), admin, session)
    assert exc_deleted.value.status_code == 400

    # 合法 status 值应正常工作
    assert (await admin_patch_user(user.id, UserPatch(status="disabled"), admin, session))["status"] == "disabled"
    assert (await admin_patch_user(user.id, UserPatch(status="active"), admin, session))["status"] == "active"

    with pytest.raises(HTTPException) as bad_kind:
        await admin_products(admin, session, kind="bad-kind")
    assert bad_kind.value.status_code == 400
    filtered = await admin_products(admin, session, kind="plans", q=plan.name[:2], status=plan.status, page=1, page_size=1)
    assert filtered["items"]
    with pytest.raises(HTTPException) as bad_update:
        await admin_update_product("bad-kind", plan_id, ProductIn(name="x", price_amount="1.00"), admin, session)
    assert bad_update.value.status_code == 400

    secret = (
        await session.execute(
            select(GlobalConfig).where(GlobalConfig.value_type == "secret", GlobalConfig.string_value.is_(None))
        )
    ).scalars().first()
    secret.string_value = "real-secret"
    await session.commit()
    masked = await admin_patch_config(secret.id, ConfigValueIn(string_value="******"), admin, session)
    await session.refresh(secret)
    assert masked["string_value"] == "******"
    assert secret.string_value == "real-secret"


async def test_admin_subscription_detail_missing_plan_returns_404(session: AsyncSession) -> None:
    """订阅关联的 Plan 被删除后，admin_subscription_detail 应返回 404"""
    user = await create_user_account(session, "sub-missing-plan@example.com", "user12345")
    plan = Plan(name="瞬逝套餐", price_amount=10.00, daily_vip_points=100)
    session.add(plan)
    await session.flush()
    sub = UserSubscription(
        user_id=user.id, plan_id=plan.id, start_at=datetime.now(UTC), end_at=datetime.now(UTC) + timedelta(days=30),
        daily_vip_points_snapshot=100, duration_days_snapshot=30,
    )
    session.add(sub)
    await session.commit()

    detail = await admin_subscription_detail(sub.id, _admin=user, session=session)
    assert detail["plan"]["name"] == "瞬逝套餐"

    await session.delete(plan)
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await admin_subscription_detail(sub.id, _admin=user, session=session)
    assert exc.value.status_code == 404


async def test_init_database_auto_create_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.core.database.get_settings",
        lambda: Settings(env="test", database_url="sqlite+aiosqlite:///:memory:", auto_create_tables=False),
    )

    await init_database()


def test_create_admin_module_entrypoint_runs_real_cli(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(sys, "argv", ["create_admin.py", "runpy-admin@example.com"])

    runpy.run_path(create_admin_main.__code__.co_filename, run_name="__main__")

    output = capsys.readouterr().out
    assert "Admin account created" in output
    assert "Email: runpy-admin@example.com" in output


async def test_consume_point_raises_402_when_both_balances_zero(session: AsyncSession) -> None:
    user = await create_user_account(session, "no-bal@example.com", "user12345")
    await session.commit()
    with pytest.raises(HTTPException) as exc:
        await routes_module.consume_point(session, user.id)
    assert exc.value.status_code == 402


async def test_analyze_chapter_uses_editor_model_when_configured(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "editor-model@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="编辑器模型检测", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()

    # Configure editor model
    active_model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
    config = (
        await session.execute(
            select(GlobalConfig).where(
                GlobalConfig.config_group == "ai.editor_check",
                GlobalConfig.config_key == "model_id",
            )
        )
    ).scalar_one()
    config.string_value = active_model.id
    await session.commit()

    # Override mock to use real _resolve_editor_model so it fetches from DB
    import app.api.routes as _routes
    monkeypatch.setattr(_routes, "_resolve_editor_model", _real_resolve_editor_model)

    result = await analyze_chapter(work["id"], AnalyzeIn(content="有错别字。"), user, session)
    assert "suggestions" in result

    await session.refresh(account)
    assert account.vip_daily_points_balance < 10000000
    transaction = (
        await session.execute(
            select(PointTransaction).where(
                PointTransaction.source_type == "ai_editor_check",
                PointTransaction.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    assert transaction is not None
    assert transaction.provider_model_id_snapshot == active_model.provider_model_id


async def test_send_chat_streams_tool_call_started_and_empty_content(
    session: AsyncSession,
) -> None:
    """Cover tool_call_started event and empty content branch in stream_reply."""
    user = await create_user_account(session, "stream-edges@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="流式边界", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()

    # Override the mock to produce events with tool_call_started and empty content
    class _EmptyContentEvent:
        event = RunEvent.run_content
        content = ""
        tool = None

    class _ToolStartedEvent:
        event = RunEvent.tool_call_started
        tool = MagicMock(tool_name="unknown_tool")

    class _ToolCompletedNoAction:
        event = RunEvent.tool_call_completed
        tool = MagicMock(tool_name="nonexistent_tool")

    class _CompletedEvent:
        event = RunEvent.run_completed
        content = "回复"
        metrics = MagicMock(input_tokens=10, output_tokens=5, cache_read_tokens=0)

    async def _custom_events():
        for ev in [_EmptyContentEvent(), _ToolStartedEvent(), _ToolCompletedNoAction(), _CompletedEvent()]:
            yield ev

    def _custom_arun(message, *, stream=True, stream_events=True):
        return _custom_events()

    import app.services.agent_service as _agent_service

    original = _agent_service.create_agent

    def _custom_agent(*args, **kwargs):
        agent = MagicMock()
        agent.arun = _custom_arun
        return agent

    _agent_service.create_agent = _custom_agent

    try:
        active_model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
        stream = await send_chat_message(
            chat["id"], ChatIn(message="测试流式事件", references=[], model_id=active_model.id), user, session
        )
        body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
        assert "event: done" in body
    finally:
        _agent_service.create_agent = original


async def test_send_chat_rejects_missing_api_key_in_non_test_env(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cover the 503 guard when AI provider API key is missing in non-test env."""
    user = await create_user_account(session, "no-apikey@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="无Key作品", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()

    test_settings = Settings(env="development", jwt_secret="x" * 32, ai_provider_api_key="")
    monkeypatch.setattr(routes_module, "get_settings", lambda: test_settings)

    with pytest.raises(HTTPException) as exc:
        await send_chat_message(chat["id"], ChatIn(message="hi", references=[]), user, session)
    assert exc.value.status_code == 503


async def test_send_chat_billing_failure_when_no_metrics(
    session: AsyncSession,
) -> None:
    """Cover agent run finishes without metrics (no billing, error shown via error field)."""
    user = await create_user_account(session, "no-metrics@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="无Metrics", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()

    class _CompletedNoMetrics:
        event = RunEvent.run_completed
        content = "回复"
        metrics = None

    async def _no_metrics_events():
        yield _CompletedNoMetrics()

    def _no_metrics_arun(message, *, stream=True, stream_events=True):
        return _no_metrics_events()

    import app.services.agent_service as _agent_service
    original = _agent_service.create_agent

    def _custom_agent(*args, **kwargs):
        agent = MagicMock()
        agent.arun = _no_metrics_arun
        return agent

    _agent_service.create_agent = _custom_agent
    try:
        active_model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
        stream = await send_chat_message(
            chat["id"], ChatIn(message="测试", references=[], model_id=active_model.id), user, session
        )
        body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
        assert "event: done" in body
    finally:
        _agent_service.create_agent = original


async def test_send_chat_billing_exception_during_deduction(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cover billing_failed=True when deduct_by_usage raises."""
    user = await create_user_account(session, "billing-exc@example.com", "user12345")
    await session.commit()
    work = await create_work(WorkIn(title="扣费异常", short_intro="", synopsis="", genre_tags=[], background_rules=""), user, session)
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = 10000000
    await session.commit()

    active_model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()

    async def _failing_deduct(*args, **kwargs):
        raise RuntimeError("billing db error")

    monkeypatch.setattr("app.services.billing_service.deduct_by_usage", _failing_deduct)

    stream = await send_chat_message(
        chat["id"], ChatIn(message="触发扣费异常", references=[], model_id=active_model.id), user, session
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body


# ── _cors_headers ──


def test_cors_headers_returns_headers_for_allowed_origin() -> None:
    """Returns CORS headers when origin is in cors_origin_list."""
    req = request_stub()
    req.headers = {"origin": "http://127.0.0.1:3000"}
    headers = routes_module._cors_headers(req)
    assert headers["Access-Control-Allow-Origin"] == "http://127.0.0.1:3000"
    assert headers["Access-Control-Allow-Credentials"] == "true"


def test_cors_headers_returns_empty_for_disallowed_origin() -> None:
    """Returns empty dict when origin is not in cors_origin_list."""
    req = request_stub()
    req.headers = {"origin": "https://evil.com"}
    assert routes_module._cors_headers(req) == {}


def test_cors_headers_returns_empty_when_no_origin_header() -> None:
    """Returns empty dict when request has no origin header."""
    req = request_stub()
    assert routes_module._cors_headers(req) == {}


# ── _drop_agent_sessions_if_invalid ──


async def test_drop_agent_sessions_table_not_exists_is_noop() -> None:
    """No-op when agent_sessions table does not exist."""
    from sqlalchemy.ext.asyncio import create_async_engine

    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr("app.core.database.engine", test_engine)
        await _drop_agent_sessions_if_invalid()
    finally:
        await test_engine.dispose()


async def test_drop_agent_sessions_drops_old_schema() -> None:
    """Drops agent_sessions table when it has old schema (no session_type column)."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import Column, MetaData, String, Table, inspect, text
    from sqlalchemy import JSON

    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        # Create old-schema table with only 3 columns
        async with test_engine.begin() as conn:
            await conn.execute(
                text("CREATE TABLE agent_sessions (session_id VARCHAR(100) PRIMARY KEY, user_id VARCHAR(36), runs JSON)")
            )

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr("app.core.database.engine", test_engine)
        await _drop_agent_sessions_if_invalid()

        # Verify table was dropped
        async with test_engine.connect() as conn:
            exists = await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).has_table("agent_sessions")
            )
        assert not exists
    finally:
        await test_engine.dispose()


async def test_drop_agent_sessions_keeps_new_schema() -> None:
    """Keeps agent_sessions table when it has new schema (session_type column present)."""
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import inspect, text

    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        # Create new-schema table with session_type column
        async with test_engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE TABLE agent_sessions ("
                    "session_id VARCHAR(100) PRIMARY KEY, "
                    "user_id VARCHAR(36), "
                    "session_type VARCHAR(50), "
                    "runs JSON"
                    ")"
                )
            )

        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr("app.core.database.engine", test_engine)
        await _drop_agent_sessions_if_invalid()

        # Verify table still exists
        async with test_engine.connect() as conn:
            exists = await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).has_table("agent_sessions")
            )
        assert exists
    finally:
        await test_engine.dispose()
