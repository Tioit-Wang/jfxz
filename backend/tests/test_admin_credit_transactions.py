"""Tests for GET /admin/credit-transactions and GET /admin/credit-transactions/{tx_id}."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.routes import (
    admin_credit_transactions,
    admin_credit_transaction_detail,
    create_user_account,
    public,
    seed_defaults,
)
from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import issue_token
from app.main import create_app
from app.models import (
    Base,
    BillingOrder,
    PointTransaction,
    User,
    Work,
    uid,
)

SETTINGS = get_settings()


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as db:
        await seed_defaults(db)
        await create_user_account(db, "admin-ct@example.com", "admin12345", role="admin")
        await db.commit()
        yield db
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncClient:
    async def override_session():
        yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


async def _admin(session: AsyncSession) -> User:
    user = (await session.execute(select(User).where(User.email == "admin-ct@example.com"))).scalar_one()
    return user


async def _user_headers(client: AsyncClient, email: str = "testuser@example.com") -> dict[str, str]:
    resp = await client.post(
        "/auth/register", json={"email": email, "nickname": "TestUser", "password": "password123"}
    )
    assert resp.status_code == 200, resp.text
    u = resp.json()["user"]
    # Issue token with admin type but user role to test current_admin's role check
    token = issue_token(u["id"], u["role"], SETTINGS.jwt_secret, token_type="admin")
    return {"Authorization": f"Bearer {token}"}


async def _create_transaction(
    session: AsyncSession,
    user_id: str,
    *,
    bucket_type: str = "vip_daily",
    change_type: str = "grant",
    source_type: str = "plan_vip_daily",
    source_id: str | None = None,
    points_delta: Decimal = Decimal("100"),
    work_id: str | None = None,
    model_id: str | None = None,
    model_name_snapshot: str | None = None,
    created_at: datetime | None = None,
) -> PointTransaction:
    tx = PointTransaction(
        user_id=user_id,
        bucket_type=bucket_type,
        change_type=change_type,
        source_type=source_type,
        source_id=source_id,
        points_delta=points_delta,
        work_id=work_id,
        model_id=model_id,
        model_name_snapshot=model_name_snapshot,
        created_at=created_at or datetime.now(UTC),
    )
    session.add(tx)
    await session.flush()
    return tx


async def _create_order(session: AsyncSession, user_id: str) -> BillingOrder:
    order = BillingOrder(
        id=uid(),
        order_no=f"ORD-{uuid4().hex[:12].upper()}",
        user_id=user_id,
        product_type="plan",
        product_id=uid(),
        product_name_snapshot="测试套餐",
        amount=Decimal("99.00"),
        currency="CNY",
        status="paid",
    )
    session.add(order)
    await session.flush()
    return order


# ─── List endpoint tests ──────────────────────────────────────────────


class TestListEndpoint:
    async def test_empty_result(self, session: AsyncSession) -> None:
        """No transactions returns empty items list."""
        admin = await _admin(session)
        result = await admin_credit_transactions(_admin=admin, session=session)
        assert result["items"] == []
        assert result["total"] == 0
        assert result["page"] == 1
        assert result["page_size"] == 20

    async def test_basic_listing(self, session: AsyncSession) -> None:
        """Returns all transactions ordered by created_at desc."""
        admin = await _admin(session)
        u1 = await create_user_account(session, "u1@example.com", "p1")
        u2 = await create_user_account(session, "u2@example.com", "p2")

        now = datetime.now(UTC)
        tx1 = await _create_transaction(session, u1.id, points_delta=Decimal("100"), created_at=now - timedelta(seconds=2))
        tx2 = await _create_transaction(session, u2.id, points_delta=Decimal("50"), created_at=now - timedelta(seconds=1))
        tx3 = await _create_transaction(session, u1.id, points_delta=Decimal("-10"), created_at=now)
        await session.commit()

        result = await admin_credit_transactions(_admin=admin, session=session)
        assert result["total"] == 3
        assert result["page_size"] == 20
        assert result["items"][0]["id"] == tx3.id  # newest first
        assert result["items"][1]["id"] == tx2.id
        assert result["items"][2]["id"] == tx1.id

    async def test_pagination(self, session: AsyncSession) -> None:
        """Respects page and page_size parameters."""
        admin = await _admin(session)
        u = await create_user_account(session, "paginate@example.com", "p1")
        now = datetime.now(UTC)
        for i in range(5):
            await _create_transaction(session, u.id, points_delta=Decimal(i * 10), created_at=now + timedelta(seconds=i))
        await session.commit()

        # page_size=2, page=1 → first 2 items
        p1 = await admin_credit_transactions(page=1, page_size=2, _admin=admin, session=session)
        assert len(p1["items"]) == 2
        assert p1["total"] == 5
        assert p1["page"] == 1

        # page_size=2, page=3 → last 1 item
        p3 = await admin_credit_transactions(page=3, page_size=2, _admin=admin, session=session)
        assert len(p3["items"]) == 1

    # ── Filters ──

    async def test_filter_by_q(self, session: AsyncSession) -> None:
        """q searches email and nickname via ilike."""
        admin = await _admin(session)
        u = await create_user_account(session, "alice@domain.com", "p1", nickname="Alice")
        await _create_transaction(session, u.id, points_delta=Decimal("50"))
        await session.commit()

        # Match by email prefix
        r1 = await admin_credit_transactions(q="alice", _admin=admin, session=session)
        assert r1["total"] == 1

        # Match by nickname
        r2 = await admin_credit_transactions(q="Ali", _admin=admin, session=session)
        assert r2["total"] == 1

        # No match
        r3 = await admin_credit_transactions(q="nobody", _admin=admin, session=session)
        assert r3["total"] == 0

    async def test_filter_q_escapes_like_wildcards(self, session: AsyncSession) -> None:
        """LIKE wildcards % and _ in q are escaped, not treated as patterns."""
        admin = await _admin(session)
        u = await create_user_account(session, "target@domain.com", "p1", nickname="Target")
        await _create_transaction(session, u.id, points_delta=Decimal("50"))
        # Create another user whose email would match a naive pattern
        u2 = await create_user_account(session, "target_sub@domain.com", "p1", nickname="TargetSub")
        await _create_transaction(session, u2.id, points_delta=Decimal("30"))
        await session.commit()

        # literal % should not match anything (no actual % in emails)
        r = await admin_credit_transactions(q="%", _admin=admin, session=session)
        assert r["total"] == 0

        # literal _ would match any char if unescaped; with escape it matches only literal _
        r2 = await admin_credit_transactions(q="_sub", _admin=admin, session=session)
        assert r2["total"] == 1  # matches target_sub@domain.com (literal _)

    async def test_filter_balance_type(self, session: AsyncSession) -> None:
        """balance_type filters by bucket_type: vip_daily→monthly, credit_pack→topup."""
        admin = await _admin(session)
        u = await create_user_account(session, "bt@example.com", "p1")

        await _create_transaction(session, u.id, bucket_type="vip_daily", points_delta=Decimal("100"))
        await _create_transaction(session, u.id, bucket_type="credit_pack", points_delta=Decimal("200"))
        await _create_transaction(session, u.id, bucket_type="vip_daily", points_delta=Decimal("30"))
        await session.commit()

        r_vip = await admin_credit_transactions(balance_type="vip_daily", _admin=admin, session=session)
        assert r_vip["total"] == 2  # both monthly
        for item in r_vip["items"]:
            assert item["balance_type"] == "vip_daily"

        r_pack = await admin_credit_transactions(balance_type="credit_pack", _admin=admin, session=session)
        assert r_pack["total"] == 1  # only topup
        assert r_pack["items"][0]["balance_type"] == "credit_pack"

    async def test_filter_change_type(self, session: AsyncSession) -> None:
        """change_type filters by change_type column."""
        admin = await _admin(session)
        u = await create_user_account(session, "ct@example.com", "p1")
        await _create_transaction(session, u.id, change_type="grant", points_delta=Decimal("100"))
        await _create_transaction(session, u.id, change_type="consume", points_delta=Decimal("-10"))
        await _create_transaction(session, u.id, change_type="refund", points_delta=Decimal("5"))
        await session.commit()

        r = await admin_credit_transactions(change_type="consume", _admin=admin, session=session)
        assert r["total"] == 1
        assert r["items"][0]["change_type"] == "consume"

        r2 = await admin_credit_transactions(change_type="expire", _admin=admin, session=session)
        assert r2["total"] == 0

    async def test_filter_source_type(self, session: AsyncSession) -> None:
        """source_type filters by source_type column."""
        admin = await _admin(session)
        u = await create_user_account(session, "st@example.com", "p1")
        await _create_transaction(session, u.id, source_type="ai_chat", points_delta=Decimal("-10"))
        await _create_transaction(session, u.id, source_type="credit_pack", points_delta=Decimal("200"))
        await session.commit()

        r = await admin_credit_transactions(source_type="ai_chat", _admin=admin, session=session)
        assert r["total"] == 1
        assert r["items"][0]["source_type"] == "ai_chat"

    async def test_filter_work_id(self, session: AsyncSession) -> None:
        """work_id filters by work_id column."""
        admin = await _admin(session)
        u = await create_user_account(session, "wi@example.com", "p1")
        w1 = Work(user_id=u.id, title="作品A")
        w2 = Work(user_id=u.id, title="作品B")
        session.add_all([w1, w2])
        await session.flush()

        await _create_transaction(session, u.id, work_id=w1.id, points_delta=Decimal("50"))
        await _create_transaction(session, u.id, work_id=w2.id, points_delta=Decimal("30"))
        await session.commit()

        r = await admin_credit_transactions(work_id=w1.id, _admin=admin, session=session)
        assert r["total"] == 1
        # work_title should be resolved in response
        assert r["items"][0]["work_title"] == "作品A"

    async def test_filter_model_id(self, session: AsyncSession) -> None:
        """model_id filters by model_id column."""
        admin = await _admin(session)
        u = await create_user_account(session, "mi@example.com", "p1")
        await _create_transaction(session, u.id, model_id="model-a", points_delta=Decimal("-10"))
        await _create_transaction(session, u.id, model_id="model-b", points_delta=Decimal("-20"))
        await session.commit()

        r = await admin_credit_transactions(model_id="model-a", _admin=admin, session=session)
        assert r["total"] == 1
        assert r["items"][0]["model_id"] == "model-a"

    async def test_filter_points_range(self, session: AsyncSession) -> None:
        """points_min / points_max filter by points_delta."""
        admin = await _admin(session)
        u = await create_user_account(session, "pr@example.com", "p1")
        await _create_transaction(session, u.id, points_delta=Decimal("100"))
        await _create_transaction(session, u.id, points_delta=Decimal("50"))
        await _create_transaction(session, u.id, points_delta=Decimal("-10"))
        await session.commit()

        r = await admin_credit_transactions(points_min=50.0, _admin=admin, session=session)
        assert r["total"] == 2

        r2 = await admin_credit_transactions(points_min=0.0, points_max=60.0, _admin=admin, session=session)
        assert r2["total"] == 1

    async def test_filter_time_range(self, session: AsyncSession) -> None:
        """time_from / time_to filter by created_at."""
        admin = await _admin(session)
        u = await create_user_account(session, "tr@example.com", "p1")
        base = datetime(2026, 4, 1, tzinfo=UTC)
        await _create_transaction(session, u.id, points_delta=Decimal("100"), created_at=base)
        await _create_transaction(session, u.id, points_delta=Decimal("50"), created_at=base + timedelta(days=1))
        await _create_transaction(session, u.id, points_delta=Decimal("30"), created_at=base + timedelta(days=2))
        await session.commit()

        # time_from only — 2026-04-02 00:00:00 UTC includes both day 1 and day 2
        r1 = await admin_credit_transactions(time_from="2026-04-02", _admin=admin, session=session)
        assert r1["total"] == 2  # day 1 (04-02) and day 2 (04-03)

        # time_from + time_to (time_to expands to end-of-day)
        r2 = await admin_credit_transactions(
            time_from="2026-04-01", time_to="2026-04-01", _admin=admin, session=session
        )
        assert r2["total"] == 1  # only day 0 (04-01) inclusive up to 23:59:59

        # range spanning all
        r3 = await admin_credit_transactions(
            time_from="2026-03-31", time_to="2026-04-03", _admin=admin, session=session
        )
        assert r3["total"] == 3

    async def test_filter_combined(self, session: AsyncSession) -> None:
        """Multiple filters compose with AND."""
        admin = await _admin(session)
        u = await create_user_account(session, "comb@example.com", "p1", nickname="Combine")
        await _create_transaction(
            session, u.id, bucket_type="vip_daily", change_type="grant", source_type="plan_vip_daily",
            points_delta=Decimal("100"),
        )
        await _create_transaction(
            session, u.id, bucket_type="credit_pack", change_type="grant", source_type="credit_pack",
            points_delta=Decimal("200"),
        )
        await session.commit()

        r = await admin_credit_transactions(
            q="comb", balance_type="vip_daily", change_type="grant",
            _admin=admin, session=session,
        )
        assert r["total"] == 1
        assert r["items"][0]["balance_type"] == "vip_daily"

    async def test_field_mapping(self, session: AsyncSession) -> None:
        """Response fields are mapped correctly from internal model."""
        admin = await _admin(session)
        u = await create_user_account(session, "fm@example.com", "p1")
        order = await _create_order(session, u.id)
        await _create_transaction(
            session, u.id,
            bucket_type="credit_pack",
            change_type="grant",
            source_type="credit_pack",
            source_id=order.id,
            points_delta=Decimal("200"),
        )
        await session.commit()

        result = await admin_credit_transactions(_admin=admin, session=session)
        item = result["items"][0]
        assert item["points_change"] == 200.0
        assert item["balance_type"] == "credit_pack"
        assert item["user_email"] == "fm@example.com"
        assert item["order_id"] == order.id
        assert item["product_name_snapshot"] == "测试套餐"
        assert item["product_type"] == "plan"
        assert "bucket_type" not in item
        assert "points_delta" not in item

    async def test_points_after_accumulation(self, session: AsyncSession) -> None:
        """points_after is a running sum per user in chronological order."""
        admin = await _admin(session)
        u = await create_user_account(session, "pa@example.com", "p1")
        now = datetime.now(UTC)
        await _create_transaction(session, u.id, points_delta=Decimal("100"), created_at=now - timedelta(hours=2))
        await _create_transaction(session, u.id, points_delta=Decimal("50"), created_at=now - timedelta(hours=1))
        await _create_transaction(session, u.id, points_delta=Decimal("-30"), created_at=now)
        await session.commit()

        result = await admin_credit_transactions(_admin=admin, session=session)
        items = sorted(result["items"], key=lambda x: x["created_at"])
        assert items[0]["points_after"] == 100.0
        assert items[1]["points_after"] == 150.0
        assert items[2]["points_after"] == 120.0

    async def test_non_admin_access_denied(self, client: AsyncClient, session: AsyncSession) -> None:
        """Regular users get 403 when accessing admin endpoint."""
        u = await create_user_account(session, "no@example.com", "p1")
        await _create_transaction(session, u.id, points_delta=Decimal("50"))
        await session.commit()

        headers = await _user_headers(client)
        resp = await client.get("/admin/credit-transactions", headers=headers)
        assert resp.status_code == 403


# ─── Detail endpoint tests ──────────────────────────────────────────


class TestDetailEndpoint:
    async def test_detail_ok(self, session: AsyncSession) -> None:
        """Returns full transaction detail with resolved relations."""
        admin = await _admin(session)
        u = await create_user_account(session, "detail@example.com", "p1")
        order = await _create_order(session, u.id)
        now = datetime.now(UTC)
        tx = await _create_transaction(
            session, u.id,
            bucket_type="vip_daily", change_type="grant", source_type="plan_vip_daily",
            source_id=order.id, points_delta=Decimal("100"),
            created_at=now,
        )
        await session.commit()

        result = await admin_credit_transaction_detail(tx.id, _admin=admin, session=session)
        assert result["id"] == tx.id
        assert result["user_email"] == "detail@example.com"
        assert result["balance_type"] == "vip_daily"
        assert result["points_change"] == 100.0
        assert result["order_id"] == order.id
        assert result["product_name_snapshot"] == "测试套餐"

    async def test_detail_404(self, session: AsyncSession) -> None:
        """Non-existent transaction returns 404."""
        from fastapi import HTTPException

        admin = await _admin(session)
        with pytest.raises(HTTPException) as exc:
            await admin_credit_transaction_detail("no-such-id", _admin=admin, session=session)
        assert exc.value.status_code == 404

    async def test_detail_balance_type_mapping(self, session: AsyncSession) -> None:
        """balance_type is mapped correctly for all bucket types."""
        admin = await _admin(session)
        u = await create_user_account(session, "btmap@example.com", "p1")
        now = datetime.now(UTC)

        tx_monthly = await _create_transaction(
            session, u.id, bucket_type="vip_daily", points_delta=Decimal("100"), created_at=now
        )
        tx_topup = await _create_transaction(
            session, u.id, bucket_type="credit_pack", points_delta=Decimal("200"), created_at=now + timedelta(seconds=1)
        )
        await session.commit()

        r1 = await admin_credit_transaction_detail(tx_monthly.id, _admin=admin, session=session)
        assert r1["balance_type"] == "vip_daily"

        r2 = await admin_credit_transaction_detail(tx_topup.id, _admin=admin, session=session)
        assert r2["balance_type"] == "credit_pack"

    async def test_detail_points_after(self, session: AsyncSession) -> None:
        """points_after equals sum of all earlier transactions + current."""
        admin = await _admin(session)
        u = await create_user_account(session, "dpa@example.com", "p1")
        now = datetime.now(UTC)
        await _create_transaction(session, u.id, points_delta=Decimal("100"), created_at=now - timedelta(hours=2))
        await _create_transaction(session, u.id, points_delta=Decimal("50"), created_at=now - timedelta(hours=1))
        tx = await _create_transaction(session, u.id, points_delta=Decimal("-30"), created_at=now)
        await session.commit()

        result = await admin_credit_transaction_detail(tx.id, _admin=admin, session=session)
        # 100 + 50 - 30 = 120
        assert result["points_after"] == 120.0

    async def test_detail_ai_consume_fields(self, session: AsyncSession) -> None:
        """Consume transactions include token and model snapshot fields."""
        admin = await _admin(session)
        u = await create_user_account(session, "ai@example.com", "p1")
        tx = PointTransaction(
            user_id=u.id,
            bucket_type="vip_daily",
            change_type="consume",
            source_type="ai_chat",
            source_id=uid(),
            points_delta=Decimal("-10"),
            model_id="model-abc",
            model_name_snapshot="Test-Model",
            provider_model_id_snapshot="prov-model-123",
            prompt_cache_hit_tokens=100,
            prompt_cache_miss_tokens=200,
            completion_tokens=50,
            cache_hit_input_multiplier_snapshot=Decimal("0.5"),
            cache_miss_input_multiplier_snapshot=Decimal("1.0"),
            output_multiplier_snapshot=Decimal("1.5"),
        )
        session.add(tx)
        await session.flush()
        await session.commit()

        result = await admin_credit_transaction_detail(tx.id, _admin=admin, session=session)
        assert result["points_change"] == -10.0
        assert result["cache_hit_input_tokens"] == 100
        assert result["cache_miss_input_tokens"] == 200
        assert result["output_tokens"] == 50
        assert result["platform_call_id"] == "prov-model-123"
        assert result["model_id"] == "model-abc"
        assert result["model_name_snapshot"] == "Test-Model"

    async def test_detail_no_order(self, session: AsyncSession) -> None:
        """Non-grant transactions have null order/product fields."""
        admin = await _admin(session)
        u = await create_user_account(session, "noorder@example.com", "p1")
        tx = await _create_transaction(
            session, u.id, change_type="consume", source_type="ai_chat",
            points_delta=Decimal("-5"),
        )
        await session.commit()

        result = await admin_credit_transaction_detail(tx.id, _admin=admin, session=session)
        assert result["order_id"] is None
        assert result["product_name_snapshot"] is None
        assert result["product_type"] is None

    async def test_detail_non_admin_access_denied(
        self, client: AsyncClient, session: AsyncSession
    ) -> None:
        """Regular users get 403 on detail endpoint."""
        u = await create_user_account(session, "denied@example.com", "p1")
        tx = await _create_transaction(session, u.id, points_delta=Decimal("50"))
        await session.commit()

        headers = await _user_headers(client)
        resp = await client.get(f"/admin/credit-transactions/{tx.id}", headers=headers)
        assert resp.status_code == 403

    async def test_detail_points_after_isolated_per_user(self, session: AsyncSession) -> None:
        """Multiple users' points_after are independent."""
        admin = await _admin(session)
        u1 = await create_user_account(session, "iso1@example.com", "p1")
        u2 = await create_user_account(session, "iso2@example.com", "p1")
        now = datetime.now(UTC)
        await _create_transaction(session, u1.id, points_delta=Decimal("100"), created_at=now - timedelta(minutes=2))
        await _create_transaction(session, u2.id, points_delta=Decimal("999"), created_at=now - timedelta(minutes=1))
        tx = await _create_transaction(session, u1.id, points_delta=Decimal("50"), created_at=now)
        await session.commit()

        result = await admin_credit_transaction_detail(tx.id, _admin=admin, session=session)
        # u1 total: 100 + 50 = 150, not influenced by u2's 999
        assert result["points_after"] == 150.0
