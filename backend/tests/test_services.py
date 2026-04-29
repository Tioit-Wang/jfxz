import json
from decimal import Decimal

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.routes import create_user_account, seed_defaults
from app.api.routes import _resolve_editor_model as _real_resolve_editor_model
from app.models import (
    AiModel,
    Base,
    Character,
    Chapter,
    PointAccount,
    PointTransaction,
    SettingItem,
    Work,
)
from app.services.agent_service import JfxzTools, _serialize, build_system_prompt
from app.services.billing_service import (
    _calculate_cost,
    _cost_to_deduct,
    _ensure_point_account,
    deduct_by_usage,
    get_points_per_cny,
    pre_check_balance,
    MIN_COST,
)


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as db:
        await seed_defaults(db)
        await db.commit()
        yield db
    await engine.dispose()


async def _make_work(session: AsyncSession, user_id: str, **overrides) -> Work:
    work = Work(user_id=user_id, title="测试作品", short_intro="简介", **overrides)
    session.add(work)
    await session.flush()
    return work


async def _make_model(session: AsyncSession, **overrides) -> AiModel:
    defaults = dict(
        display_name="TestModel",
        provider_model_id="test-v1",
        logic_score=3,
        prose_score=3,
        knowledge_score=3,
        max_context_tokens=32000,
        max_output_tokens=2048,
        temperature=Decimal("0.70"),
        input_cost_per_million=Decimal("1.00"),
        cache_hit_input_cost_per_million=Decimal("0.10"),
        output_cost_per_million=Decimal("2.00"),
        profit_multiplier=Decimal("1.10"),
    )
    defaults.update(overrides)
    model = AiModel(**defaults)
    session.add(model)
    await session.flush()
    return model


async def _ensure_account(session: AsyncSession, user_id: str, monthly: Decimal = Decimal("0"), topup: Decimal = Decimal("0")) -> PointAccount:
    result = await session.execute(select(PointAccount).where(PointAccount.user_id == user_id))
    account = result.scalar_one_or_none()
    if account is None:
        account = PointAccount(user_id=user_id, vip_daily_points_balance=monthly, credit_pack_points_balance=topup)
        session.add(account)
    else:
        account.vip_daily_points_balance = monthly
        account.credit_pack_points_balance = topup
    await session.flush()
    return account


# ---- agent_service tests ----


class TestAgentServiceHelpers:
    def test_create_agent_db_routes_sqlite(self) -> None:
        """Verify _create_agent_db returns AsyncSqliteDb for sqlite URLs."""
        from app.services.agent_service import _create_agent_db
        from agno.db.sqlite.async_sqlite import AsyncSqliteDb
        db = _create_agent_db("sqlite+aiosqlite:///./test.db")
        assert isinstance(db, AsyncSqliteDb)

    def test_create_agent_db_routes_postgres(self) -> None:
        """Verify _create_agent_db passes correct URL to PostgresDb."""
        from unittest.mock import patch, MagicMock
        from agno.db.postgres import postgres as pg_module
        original = pg_module.PostgresDb
        mock_cls = MagicMock()
        pg_module.PostgresDb = mock_cls
        try:
            from app.services.agent_service import _create_agent_db
            _create_agent_db("postgresql+asyncpg://user:pass@host/db")
            mock_cls.assert_called_once_with(db_url="postgresql://user:pass@host/db", session_table="agent_sessions")
        finally:
            pg_module.PostgresDb = original

    def test_build_system_prompt_includes_work_info(self) -> None:
        work = Work(title="雾港纪事", short_intro="港城故事", synopsis="灯塔", genre_tags=["奇幻"], background_rules="规则")
        prompt = build_system_prompt(work, [])
        assert "雾港纪事" in prompt
        assert "港城故事" in prompt
        assert "奇幻" in prompt
        assert "get_character" in prompt

    def test_build_system_prompt_includes_refs(self) -> None:
        work = Work(title="作品")
        refs = [{"type": "character", "name": "苏白", "summary": "主角", "detail": "细节"}]
        prompt = build_system_prompt(work, refs)
        assert "苏白" in prompt
        assert "主角" in prompt

    async def test_serialize_handles_datetime_and_decimal(self, session: AsyncSession) -> None:
        work = Work(user_id="u-serialize", title="测试", short_intro="s", genre_tags=[])
        session.add(work)
        await session.flush()
        data = _serialize(work)
        assert isinstance(data["created_at"], str)
        assert "id" in data

    async def test_serialize_converts_decimal_to_float(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        data = _serialize(model)
        assert isinstance(data["temperature"], float)
        assert isinstance(data["cache_hit_input_cost_per_million"], float)

    def test_build_system_prompt_refs_without_summary_or_detail(self) -> None:
        work = Work(title="作品")
        refs = [{"type": "character", "name": "苏白"}]
        prompt = build_system_prompt(work, refs)
        assert "苏白" in prompt

    def test_get_agent_db_caches_instance(self) -> None:
        import app.services.agent_service as _mod
        from app.services.agent_service import get_agent_db
        _mod._db = None
        first = get_agent_db("sqlite+aiosqlite:///:memory:")
        second = get_agent_db("sqlite+aiosqlite:///:memory:")
        assert first is second
        _mod._db = None

    def test_create_agent_builds_agent(self) -> None:
        from unittest.mock import MagicMock, patch
        import app.services.agent_service as _mod
        from app.services.agent_service import create_agent
        _mod._db = None
        model = MagicMock()
        model.provider_model_id = "test-model"
        model.temperature = Decimal("0.70")
        model.max_output_tokens = 2048
        work = Work(title="测试", short_intro="s", genre_tags=[])
        mock_db = MagicMock()
        with patch("app.services.agent_service.get_settings") as mock_gs, \
             patch("app.services.agent_service.Agent") as mock_agent_cls:
            mock_gs.return_value = MagicMock(
                ai_provider_base_url="https://test.api",
                ai_provider_api_key="test-key",
                database_url="sqlite+aiosqlite:///:memory:",
            )
            result = create_agent(model, work, [], mock_db, "w1", "s1")
            mock_agent_cls.assert_called_once()
            assert result is mock_agent_cls.return_value
        _mod._db = None


class TestJfxzTools:
    @pytest_asyncio.fixture
    async def tools(self, session: AsyncSession) -> JfxzTools:
        user_id = "u-tools"
        work = await _make_work(session, user_id)
        await session.commit()
        return JfxzTools(db=session, work_id=work.id)

    async def test_character_crud(self, tools: JfxzTools, session: AsyncSession) -> None:
        result = json.loads(await tools.list_characters())
        assert result == []

        created = json.loads(await tools.create_or_update_character("苏白", "主角", "详情"))
        assert created["name"] == "苏白"
        assert created["detail"] == "详情"
        char_id = created["id"]

        listed = json.loads(await tools.list_characters())
        assert len(listed) == 1

        fetched = json.loads(await tools.get_character(char_id))
        assert fetched["name"] == "苏白"

        updated = json.loads(await tools.create_or_update_character("苏白改", "主角改", "新详情", character_id=char_id))
        assert updated["name"] == "苏白改"
        assert updated["detail"] == "新详情"

        not_found = json.loads(await tools.get_character("nonexistent"))
        assert "error" in not_found

    async def test_setting_crud(self, tools: JfxzTools, session: AsyncSession) -> None:
        created = json.loads(await tools.create_or_update_setting("魔法体系", "设定摘要", "设定详情", "world"))
        assert created["name"] == "魔法体系"
        assert created["type"] == "world"
        assert created["detail"] == "设定详情"
        setting_id = created["id"]

        listed = json.loads(await tools.list_settings())
        assert len(listed) == 1

        filtered = json.loads(await tools.list_settings(setting_type="world"))
        assert len(filtered) == 1
        empty = json.loads(await tools.list_settings(setting_type="combat"))
        assert empty == []

        fetched = json.loads(await tools.get_setting(setting_id))
        assert fetched["name"] == "魔法体系"

    async def test_chapter_operations(self, tools: JfxzTools, session: AsyncSession) -> None:
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="第一章", content="正文内容", summary="原始摘要")
        session.add(chapter)
        await session.flush()

        listed = json.loads(await tools.list_chapters())
        assert len(listed) == 1

        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["title"] == "第一章"

        updated = json.loads(await tools.update_chapter_summary(chapter.id, "新摘要"))
        assert updated["summary"] == "新摘要"

        long_content = "新正文" * 100
        content_result = json.loads(await tools.update_chapter_content(chapter.id, long_content))
        assert content_result["new_content_preview"] == long_content[:200]
        assert "new_content" not in content_result
        assert content_result["new_content_length"] == len(long_content)
        assert content_result["preview_truncated"] is True

        not_found = json.loads(await tools.get_chapter("nonexistent"))
        assert "error" in not_found

    async def test_work_info(self, tools: JfxzTools, session: AsyncSession) -> None:
        info = json.loads(await tools.get_work_info())
        assert info["title"] == "测试作品"

        updated = json.loads(await tools.update_work_info("short_intro", "新简介"))
        assert updated["field"] == "short_intro"
        assert updated["value"] == "新简介"

        partial = json.loads(await tools.update_work_info("synopsis", "新梗概"))
        assert partial["field"] == "synopsis"
        refreshed = json.loads(await tools.get_work_info())
        assert refreshed["short_intro"] == "新简介"
        assert refreshed["synopsis"] == "新梗概"

    async def test_update_character_not_found(self, tools: JfxzTools) -> None:
        result = json.loads(await tools.create_or_update_character("x", "y", character_id="nonexistent"))
        assert "error" in result

    async def test_update_setting_not_found(self, tools: JfxzTools) -> None:
        result = json.loads(await tools.create_or_update_setting("x", "y", setting_id="nonexistent"))
        assert "error" in result

    async def test_update_chapter_not_found(self, tools: JfxzTools) -> None:
        result = json.loads(await tools.update_chapter_summary("nonexistent", "摘要"))
        assert "error" in result

    async def test_work_scoping(self, session: AsyncSession) -> None:
        other_work = await _make_work(session, "u-other")
        chapter = Chapter(work_id=other_work.id, order_index=1, title="其他作品章节", content="内容")
        session.add(chapter)
        await session.flush()
        await session.commit()

        tools = JfxzTools(db=session, work_id="nonexistent-work")
        result = json.loads(await tools.list_chapters())
        assert result == []

    async def test_get_setting_not_found(self, tools: JfxzTools) -> None:
        result = json.loads(await tools.get_setting("nonexistent"))
        assert "error" in result

    async def test_update_existing_setting(self, tools: JfxzTools) -> None:
        created = json.loads(await tools.create_or_update_setting("原始", "摘要", "详情", "world"))
        setting_id = created["id"]
        updated = json.loads(await tools.create_or_update_setting("更新", "新摘要", "新详情", "combat", setting_id=setting_id))
        assert updated["name"] == "更新"
        assert updated["type"] == "combat"

    async def test_get_work_info_not_found(self, session: AsyncSession) -> None:
        tools = JfxzTools(db=session, work_id="nonexistent-work")
        result = json.loads(await tools.get_work_info())
        assert "error" in result

    async def test_update_work_info_not_found(self, session: AsyncSession) -> None:
        tools = JfxzTools(db=session, work_id="nonexistent-work")
        result = json.loads(await tools.update_work_info("short_intro", "x"))
        assert "error" in result

    async def test_update_work_info_all_fields(self, tools: JfxzTools) -> None:
        focus = json.loads(await tools.update_work_info("focus_requirements", "全重点"))
        forbidden = json.loads(await tools.update_work_info("forbidden_requirements", "全禁忌"))
        assert focus["field"] == "focus_requirements"
        assert forbidden["field"] == "forbidden_requirements"
        refreshed = json.loads(await tools.get_work_info())
        assert refreshed["focus_requirements"] == "全重点"
        assert refreshed["forbidden_requirements"] == "全禁忌"


# ---- billing_service tests ----


class TestCalculateCost:
    def test_basic_cost(self) -> None:
        cost = _calculate_cost(
            cache_hit_tokens=0,
            cache_miss_tokens=1000,
            completion_tokens=500,
            input_cost_per_million=Decimal("1.00"),
            cache_hit_input_cost_per_million=Decimal("0.10"),
            output_cost_per_million=Decimal("2.00"),
            profit_multiplier=Decimal("1.10"),
            points_per_cny=Decimal("10000"),
        )
        # miss = (1000/1M) * 1.0 * 1.1 * 10000 = 11
        # out  = (500/1M) * 2.0 * 1.1 * 10000 = 11
        # total = 22.00
        assert cost == Decimal("22.00")

    def test_zero_tokens(self) -> None:
        cost = _calculate_cost(
            0, 0, 0,
            input_cost_per_million=Decimal("1"),
            cache_hit_input_cost_per_million=Decimal("1"),
            output_cost_per_million=Decimal("1"),
            profit_multiplier=Decimal("1"),
            points_per_cny=Decimal("10000"),
        )
        assert cost == Decimal("0")

    def test_large_tokens(self) -> None:
        cost = _calculate_cost(
            cache_hit_tokens=500000,
            cache_miss_tokens=500000,
            completion_tokens=100000,
            input_cost_per_million=Decimal("12"),
            cache_hit_input_cost_per_million=Decimal("0.1"),
            output_cost_per_million=Decimal("24"),
            profit_multiplier=Decimal("1.1"),
            points_per_cny=Decimal("10000"),
        )
        assert cost > Decimal("0")

    def test_ceils_to_001(self) -> None:
        cost = _calculate_cost(
            0, 1, 0,
            input_cost_per_million=Decimal("0.01"),
            cache_hit_input_cost_per_million=Decimal("0.01"),
            output_cost_per_million=Decimal("0.01"),
            profit_multiplier=Decimal("1.0"),
            points_per_cny=Decimal("10000"),
        )
        # (1/1M) * 0.01 * 1.0 * 10000 = 0.0001 → ceil → 0.01
        assert cost == Decimal("0.01")

    def test_minimum_deduction_is_001(self) -> None:
        assert _cost_to_deduct(Decimal("0")) == MIN_COST
        assert _cost_to_deduct(Decimal("0.001")) == MIN_COST
        assert _cost_to_deduct(Decimal("0.01")) == Decimal("0.01")
        assert _cost_to_deduct(Decimal("5.50")) == Decimal("5.50")


class TestPreCheckBalance:
    async def test_passes_with_sufficient_balance(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        await _ensure_account(session, "u1", monthly=Decimal("10000"), topup=Decimal("0"))
        await session.commit()
        await pre_check_balance(session, "u1", model, estimated_input_tokens=2000)

    async def test_rejects_insufficient_balance(self, session: AsyncSession) -> None:
        model = await _make_model(session, max_output_tokens=100000)
        await _ensure_account(session, "u2", monthly=Decimal("0"), topup=Decimal("0"))
        await session.commit()
        with pytest.raises(HTTPException) as exc_info:
            await pre_check_balance(session, "u2", model, estimated_input_tokens=2000)
        assert exc_info.value.status_code == 402

    async def test_creates_account_if_missing(self, session: AsyncSession) -> None:
        model = await _make_model(session, max_output_tokens=1)
        await _ensure_account(session, "u-new", monthly=Decimal("100"), topup=Decimal("0"))
        await session.commit()
        await pre_check_balance(session, "u-new", model, estimated_input_tokens=0)
        account = (await session.execute(select(PointAccount).where(PointAccount.user_id == "u-new"))).scalar_one()
        assert account.vip_daily_points_balance == Decimal("100")


class TestDeductByUsage:
    async def test_deducts_from_monthly(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        await _ensure_account(session, "u1", monthly=Decimal("10000"), topup=Decimal("0"))
        await session.commit()

        await deduct_by_usage(
            session, "u1", model,
            {"prompt_tokens": 100, "completion_tokens": 50, "cached_tokens": 0},
            work_id="w1", source_id="s1", source_type="ai_chat",
        )
        await session.commit()

        account = (await session.execute(select(PointAccount).where(PointAccount.user_id == "u1"))).scalar_one()
        assert account.vip_daily_points_balance < Decimal("10000")

        txns = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u1"))).scalars().all()
        assert len(txns) == 1
        txn = txns[0]
        assert txn.points_delta < 0
        assert txn.bucket_type == "vip_daily"
        assert txn.model_id == model.id
        assert txn.model_name_snapshot == "TestModel"
        assert txn.prompt_cache_miss_tokens == 100
        assert txn.completion_tokens == 50
        assert txn.cache_hit_input_cost_per_million_snapshot == Decimal("0.10")

    async def test_deducts_from_topup(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        await _ensure_account(session, "u2", monthly=Decimal("0"), topup=Decimal("10000"))
        await session.commit()

        await deduct_by_usage(
            session, "u2", model,
            {"prompt_tokens": 100, "completion_tokens": 50, "cached_tokens": 0},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        txns = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u2"))).scalars().all()
        assert txns[0].bucket_type == "credit_pack"

    async def test_mixed_deduction(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        # monthly=0.01, topup=10000 — monthly too small to cover full cost, triggers split
        await _ensure_account(session, "u3", monthly=Decimal("0.01"), topup=Decimal("10000"))
        await session.commit()

        await deduct_by_usage(
            session, "u3", model,
            {"prompt_tokens": 100000, "completion_tokens": 50000, "cached_tokens": 0},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        txns = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u3"))).scalars().all()
        assert len(txns) == 2
        assert txns[0].bucket_type == "vip_daily"
        assert txns[1].bucket_type == "credit_pack"

        account = (await session.execute(select(PointAccount).where(PointAccount.user_id == "u3"))).scalar_one()
        assert account.vip_daily_points_balance == Decimal("0.00")

    async def test_rejects_insufficient_balance(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        await _ensure_account(session, "u4", monthly=Decimal("0"), topup=Decimal("0"))
        await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await deduct_by_usage(
                session, "u4", model,
                {"prompt_tokens": 100000, "completion_tokens": 50000, "cached_tokens": 0},
                work_id="w1", source_id="s1",
            )
        assert exc_info.value.status_code == 402

    async def test_handles_cached_tokens(self, session: AsyncSession) -> None:
        model = await _make_model(session)
        await _ensure_account(session, "u5", monthly=Decimal("10000"), topup=Decimal("0"))
        await session.commit()

        await deduct_by_usage(
            session, "u5", model,
            {"prompt_tokens": 100, "completion_tokens": 50, "cached_tokens": 80},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        txn = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u5"))).scalar_one()
        assert txn.prompt_cache_hit_tokens == 80
        assert txn.prompt_cache_miss_tokens == 20
        assert txn.completion_tokens == 50

    async def test_minimum_charge_0_01(self, session: AsyncSession) -> None:
        """Tiny token usage should still deduct minimum 0.01."""
        # Use very low costs so 1 token falls below minimum
        model = await _make_model(
            session,
            input_cost_per_million=Decimal("0.0001"),
            cache_hit_input_cost_per_million=Decimal("0.0001"),
            output_cost_per_million=Decimal("0.0001"),
            profit_multiplier=Decimal("1.0"),
        )
        await _ensure_account(session, "u6", monthly=Decimal("100"), topup=Decimal("0"))
        await session.commit()

        await deduct_by_usage(
            session, "u6", model,
            {"prompt_tokens": 1, "completion_tokens": 1, "cached_tokens": 0},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        txn = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u6"))).scalar_one()
        assert txn.points_delta == Decimal("-0.01")

    async def test_exact_balance_deduction(self, session: AsyncSession) -> None:
        """Deducting exactly the full balance should succeed."""
        model = await _make_model(
            session,
            input_cost_per_million=Decimal("0.0001"),
            cache_hit_input_cost_per_million=Decimal("0.0001"),
            output_cost_per_million=Decimal("0.0001"),
            profit_multiplier=Decimal("1.0"),
        )
        await _ensure_account(session, "u7", monthly=Decimal("0.01"), topup=Decimal("0"))
        await session.commit()

        await deduct_by_usage(
            session, "u7", model,
            {"prompt_tokens": 1, "completion_tokens": 1, "cached_tokens": 0},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        account = (await session.execute(select(PointAccount).where(PointAccount.user_id == "u7"))).scalar_one()
        assert account.vip_daily_points_balance == Decimal("0.00")

    async def test_insufficient_for_minimum_charge(self, session: AsyncSession) -> None:
        """Balance below 0.01 should be rejected."""
        model = await _make_model(
            session,
            input_cost_per_million=Decimal("0.0001"),
            cache_hit_input_cost_per_million=Decimal("0.0001"),
            output_cost_per_million=Decimal("0.0001"),
            profit_multiplier=Decimal("1.0"),
        )
        await _ensure_account(session, "u8", monthly=Decimal("0"), topup=Decimal("0"))
        await session.commit()

        with pytest.raises(HTTPException) as exc_info:
            await deduct_by_usage(
                session, "u8", model,
                {"prompt_tokens": 1, "completion_tokens": 1, "cached_tokens": 0},
                work_id="w1", source_id="s1",
            )
        assert exc_info.value.status_code == 402

    async def test_points_delta_is_negative_decimal(self, session: AsyncSession) -> None:
        """Verify points_delta is a proper negative Decimal, not a float."""
        model = await _make_model(session)
        await _ensure_account(session, "u9", monthly=Decimal("10000"), topup=Decimal("0"))
        await session.commit()

        await deduct_by_usage(
            session, "u9", model,
            {"prompt_tokens": 100, "completion_tokens": 50, "cached_tokens": 0},
            work_id="w1", source_id="s1",
        )
        await session.commit()

        txn = (await session.execute(select(PointTransaction).where(PointTransaction.user_id == "u9"))).scalar_one()
        assert isinstance(txn.points_delta, Decimal)
        assert txn.points_delta < 0

    async def test_ensure_point_account_creates_when_missing(self, session: AsyncSession) -> None:
        account = await _ensure_point_account(session, "brand-new-user")
        await session.flush()
        assert account.user_id == "brand-new-user"
        assert account.vip_daily_points_balance == Decimal("0")



class TestGetPointsPerCny:
    async def test_default_value(self, session: AsyncSession) -> None:
        result = await get_points_per_cny(session)
        assert result == Decimal("10000")

    async def test_reads_config_value(self, session: AsyncSession) -> None:
        from app.models import GlobalConfig
        # seed_defaults already creates this config entry; update its value
        config = (await session.execute(
            select(GlobalConfig).where(
                GlobalConfig.config_group == "billing",
                GlobalConfig.config_key == "points_per_cny",
            )
        )).scalar_one()
        config.integer_value = 5000
        await session.flush()
        result = await get_points_per_cny(session)
        assert result == Decimal("5000")


class TestResolveEditorModel:
    async def test_returns_none_when_no_config(self, session: AsyncSession) -> None:
        result = await _real_resolve_editor_model(session)
        assert result is None

    async def test_returns_model_when_configured(self, session: AsyncSession) -> None:
        from app.models import GlobalConfig
        model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
        config = (
            await session.execute(
                select(GlobalConfig).where(
                    GlobalConfig.config_group == "ai.editor_check",
                    GlobalConfig.config_key == "model_id",
                )
            )
        ).scalar_one()
        config.string_value = model.id
        await session.commit()

        result = await _real_resolve_editor_model(session)
        assert result is not None
        assert result.id == model.id

    async def test_returns_none_for_inactive_model(self, session: AsyncSession) -> None:
        from app.models import GlobalConfig
        model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
        model.status = "disabled"
        config = (
            await session.execute(
                select(GlobalConfig).where(
                    GlobalConfig.config_group == "ai.editor_check",
                    GlobalConfig.config_key == "model_id",
                )
            )
        ).scalar_one()
        config.string_value = model.id
        await session.commit()

        result = await _real_resolve_editor_model(session)
        assert result is None


class TestEnsurePointAccount:
    async def test_creates_account_for_new_user(self, session: AsyncSession) -> None:
        from app.services.billing_service import _ensure_point_account
        user = await create_user_account(session, "new-billing@example.com", "user12345")
        await session.commit()

        account = await _ensure_point_account(session, user.id)
        assert account is not None
        assert account.vip_daily_points_balance == 0
        assert account.user_id == user.id
