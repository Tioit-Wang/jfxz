import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.routes import _resolve_editor_model as _real_resolve_editor_model
from app.api.routes import create_user_account, seed_defaults
from app.models import (
    AiModel,
    Base,
    Chapter,
    Character,
    DailyWordProgress,
    PointAccount,
    PointTransaction,
    SettingItem,
    Volume,
    Work,
    WritingPrompt,
    WritingPromptCategory,
)
from app.services.agent_service import GoodguaTools, _count_words, _read_sessions, _serialize, build_system_prompt
from app.services.billing_service import (
    MIN_COST,
    _calculate_cost,
    _cost_to_deduct,
    _ensure_point_account,
    deduct_by_usage,
    get_points_per_cny,
    pre_check_balance,
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
        from agno.db.sqlite.async_sqlite import AsyncSqliteDb

        from app.services.agent_service import _create_agent_db
        db = _create_agent_db("sqlite+aiosqlite:///./test.db")
        assert isinstance(db, AsyncSqliteDb)

    def test_create_agent_db_routes_mysql(self) -> None:
        """Verify _create_agent_db returns AsyncMySQLDb for mysql URLs."""
        import agno.db.mysql.async_mysql as mysql_module

        from app.services.agent_service import _create_agent_db

        original = mysql_module.AsyncMySQLDb
        mock_cls = MagicMock()
        mysql_module.AsyncMySQLDb = mock_cls
        try:
            _create_agent_db("mysql+asyncmy://user:pass@host/db")
            mock_cls.assert_called_once_with(
                db_url="mysql+asyncmy://user:pass@host/db",
                db_schema="db",
                session_table="agent_sessions",
                create_schema=False,
            )
        finally:
            mysql_module.AsyncMySQLDb = original

    @pytest.mark.asyncio
    async def test_mysql_agent_db_manual_migration_guards(self) -> None:
        from app.services.agent_service import (
            _disable_mysql_agent_db_auto_create,
            _mysql_database_name,
        )

        assert _mysql_database_name("mysql+asyncmy://user:pass@host/goodgua") == "goodgua"
        with pytest.raises(ValueError, match="database name"):
            _mysql_database_name("mysql+asyncmy://user:pass@host")

        db = MagicMock()
        _disable_mysql_agent_db_auto_create(db)
        with pytest.raises(RuntimeError, match="manual SQL migrations"):
            await db._create_table(table_name="agent_sessions", table_type="sessions")

    def test_create_agent_db_routes_postgres(self) -> None:
        """Verify _create_agent_db passes correct URL to PostgresDb."""
        from unittest.mock import MagicMock

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
        prompt = build_system_prompt(work)
        assert "雾港纪事" in prompt
        assert "港城故事" in prompt
        assert "奇幻" in prompt
        assert "get_character" in prompt
        assert "list_volumes" in prompt

    def test_build_system_prompt_includes_work_info(self) -> None:
        work = Work(title="作品", short_intro="简介", genre_tags=["奇幻"])
        prompt = build_system_prompt(work)
        assert "作品" in prompt
        assert "简介" in prompt
        assert "奇幻" in prompt
        assert "引用标记" in prompt  # 新格式说明已添加

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

    async def test_serialize_lite_and_limit_normalization(self, session: AsyncSession) -> None:
        from app.services.agent_service import _normalize_list_limit, _serialize_lite

        model = await _make_model(session)
        lite = _serialize_lite(model, ["temperature", "display_name"])
        assert lite["temperature"] == float(model.temperature)
        assert lite["display_name"] == "TestModel"
        assert _normalize_list_limit("bad") == 20

    def test_build_system_prompt_includes_ref_mark_section(self) -> None:
        work = Work(title="作品")
        prompt = build_system_prompt(work)
        assert "引用标记" in prompt
        assert "ref:chapter" in prompt
        assert "get_chapter" in prompt

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
            result = create_agent(model, work, mock_db, "w1", "s1")
            mock_agent_cls.assert_called_once()
            assert result is mock_agent_cls.return_value
        _mod._db = None

    def test_create_agent_enables_reasoning_for_higher_thinking_intensity(self) -> None:
        from unittest.mock import patch

        import app.services.agent_service as _mod
        from app.services.agent_service import create_agent

        _mod._db = None
        model = MagicMock()
        model.provider_model_id = "deepseek-v4-pro"
        model.temperature = Decimal("0.70")
        model.max_output_tokens = 2048
        work = Work(title="测试", short_intro="s", genre_tags=[])
        mock_db = MagicMock()

        with patch("app.services.agent_service.get_settings") as mock_gs, patch(
            "app.services.agent_service.Agent"
        ), patch("app.services.agent_service.DeepSeek") as mock_deepseek:
            mock_gs.return_value = MagicMock(
                ai_provider_base_url="https://test.api",
                ai_provider_api_key="test-key",
                database_url="sqlite+aiosqlite:///:memory:",
            )
            create_agent(
                model,
                work,
                mock_db,
                "w1",
                "s1",
                thinking_intensity=0.9,
            )
            kwargs = mock_deepseek.call_args.kwargs
            assert kwargs["reasoning_effort"] == "max"
            assert kwargs["extra_body"] == {"thinking": {"type": "enabled"}}

        _mod._db = None


class TestGoodguaTools:
    @pytest_asyncio.fixture
    async def tools(self, session: AsyncSession) -> GoodguaTools:
        user_id = "u-tools"
        work = await _make_work(session, user_id)
        await session.commit()
        return GoodguaTools(db=session, work_id=work.id, session_id="test-session")

    async def test_character_crud(self, tools: GoodguaTools, session: AsyncSession) -> None:
        result = json.loads(await tools.list_characters())
        assert result["items"] == []
        assert result["total"] == 0
        assert result["has_more"] is False

        created = json.loads(await tools.create_or_update_character("苏白", "主角", "详情"))
        assert created["name"] == "苏白"
        assert created["detail"] == "详情"
        char_id = created["id"]

        listed = json.loads(await tools.list_characters())
        assert len(listed["items"]) == 1
        assert listed["total"] == 1
        assert listed["has_more"] is False

        fetched = json.loads(await tools.get_character(char_id))
        assert fetched["name"] == "苏白"

        updated = json.loads(await tools.create_or_update_character("苏白改", "主角改", "新详情", character_id=char_id))
        assert updated["name"] == "苏白改"
        assert updated["detail"] == "新详情"

        not_found = json.loads(await tools.get_character("nonexistent"))
        assert "error" in not_found

    async def test_list_tools_apply_default_limits(self, tools: GoodguaTools, session: AsyncSession) -> None:
        for index in range(25):
            session.add(Character(work_id=tools.work_id, name=f"角色{index}", summary="摘要", detail=""))
            session.add(SettingItem(work_id=tools.work_id, type="other", name=f"设定{index}", summary="摘要", detail=""))
            session.add(Chapter(work_id=tools.work_id, order_index=index + 1, title=f"章节{index}", content="", summary="摘要"))
        await session.commit()

        assert len(json.loads(await tools.list_characters())["items"]) == 20
        assert len(json.loads(await tools.list_settings())["items"]) == 20
        assert len(json.loads(await tools.list_chapters())["items"]) == 20
        assert len(json.loads(await tools.list_characters(limit=5))["items"]) == 5
        assert len(json.loads(await tools.list_settings(limit=5))["items"]) == 5
        assert len(json.loads(await tools.list_chapters(limit=5))["items"]) == 5

    async def test_setting_crud(self, tools: GoodguaTools, session: AsyncSession) -> None:
        created = json.loads(await tools.create_or_update_setting("魔法体系", "设定摘要", "设定详情", "world"))
        assert created["name"] == "魔法体系"
        assert created["type"] == "world"
        assert created["detail"] == "设定详情"
        setting_id = created["id"]

        listed = json.loads(await tools.list_settings())
        assert len(listed["items"]) == 1

        filtered = json.loads(await tools.list_settings(setting_type="world"))
        assert len(filtered["items"]) == 1
        empty = json.loads(await tools.list_settings(setting_type="combat"))
        assert empty["items"] == []

        fetched = json.loads(await tools.get_setting(setting_id))
        assert fetched["name"] == "魔法体系"

        deleted = json.loads(await tools.delete_setting(setting_id))
        assert deleted["success"] is True
        assert json.loads(await tools.delete_setting(setting_id))["error"].startswith("未找到设定")

    async def test_chapter_operations(self, tools: GoodguaTools, session: AsyncSession) -> None:
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="第一章", content="正文内容", summary="原始摘要")
        session.add(chapter)
        await session.flush()

        listed = json.loads(await tools.list_chapters())
        assert len(listed["items"]) == 1
        assert listed["items"][0]["volume_id"]
        assert listed["items"][0]["word_count"] == _count_words("正文内容")

        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["title"] == "第一章"
        assert fetched["word_count"] == _count_words("正文内容")
        assert fetched["content"] == "1 正文内容"
        assert fetched["total_lines"] == 1

        updated = json.loads(await tools.update_chapter(chapter.id, summary="新摘要"))
        assert updated["summary"] == "新摘要"

        long_content = "新正文" * 100
        content_result = json.loads(await tools.update_chapter(chapter.id, content=long_content))
        assert content_result["new_content_preview"] == long_content[:200]
        assert "new_content" not in content_result
        assert content_result["new_content_length"] == len(long_content)
        assert content_result["preview_truncated"] is True
        progress = (
            await session.execute(select(DailyWordProgress).where(DailyWordProgress.work_id == tools.work_id))
        ).scalar_one()
        assert progress.words_added == len(long_content) - len("正文内容")
        extended_content = f"{long_content}追加"
        await tools.update_chapter(chapter.id, content=extended_content)
        assert progress.words_added == len(extended_content) - len("正文内容")
        await tools.update_chapter(chapter.id, content="短")
        assert progress.words_added == len(extended_content) - len("正文内容")

        # --- 部分更新测试 ---
        # 先写入多行内容
        multi_line = "第一行\n\n第三行\n第四行\n第五行"
        await tools.update_chapter(chapter.id, content=multi_line)
        _read_sessions["test-session"]["chapters"].pop(chapter.id, None)
        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["total_lines"] == 5
        assert fetched["content"] == "1 第一行\n2 \n3 第三行\n4 第四行\n5 第五行"

        # 局部替换单行
        partial = json.loads(await tools.update_chapter(chapter.id, content="新的第三行", start_line=3))
        assert partial["content_changed"] is True
        assert partial["changed_range"] == {"start": 3, "end": 3}
        _read_sessions["test-session"]["chapters"].pop(chapter.id, None)
        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["content"] == "1 第一行\n2 \n3 新的第三行\n4 第四行\n5 第五行"

        # 局部替换多行
        partial = json.loads(await tools.update_chapter(chapter.id, content="合并行", start_line=3, end_line=4))
        assert partial["changed_range"] == {"start": 3, "end": 4}
        _read_sessions["test-session"]["chapters"].pop(chapter.id, None)
        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["total_lines"] == 4
        assert fetched["content"] == "1 第一行\n2 \n3 合并行\n4 第五行"

        # 局部插入
        partial = json.loads(await tools.update_chapter(chapter.id, content="插入行A\n插入行B", start_line=2, end_line=1))
        assert partial["content_changed"] is True
        _read_sessions["test-session"]["chapters"].pop(chapter.id, None)
        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["total_lines"] == 6
        assert fetched["content"] == "1 第一行\n2 插入行A\n3 插入行B\n4 \n5 合并行\n6 第五行"

        # 局部删除
        partial = json.loads(await tools.update_chapter(chapter.id, content="", start_line=4, end_line=5))
        _read_sessions["test-session"]["chapters"].pop(chapter.id, None)
        fetched = json.loads(await tools.get_chapter(chapter.id))
        assert fetched["total_lines"] == 4
        assert fetched["content"] == "1 第一行\n2 插入行A\n3 插入行B\n4 第五行"

        # 行号超出范围
        err = json.loads(await tools.update_chapter(chapter.id, content="x", start_line=99))
        assert "error" in err

        not_found = json.loads(await tools.get_chapter("nonexistent"))
        assert "error" in not_found

        created = json.loads(await tools.create_chapter("第二章", "摘要"))
        assert created["order_index"] == 2
        assert created["summary"] == "摘要"
        assert created["volume_id"] == listed["items"][0]["volume_id"]
        assert created["word_count"] == 0

    async def test_create_chapter_after_target_and_reorder(self, tools: GoodguaTools, session: AsyncSession) -> None:
        # Setup: create 4 chapters
        for i, title in enumerate(["开篇", "发展", "高潮", "结局"], start=1):
            session.add(Chapter(
                work_id=tools.work_id, order_index=i - 1, title=title, content=f"正文{i}", summary=""
            ))
        await session.commit()

        # Insert after "发展" (order_index=1) — should become order_index=2
        target_id = (
            await session.execute(
                select(Chapter.id).where(Chapter.work_id == tools.work_id, Chapter.title == "发展")
            )
        ).scalar_one()
        created = json.loads(await tools.create_chapter("转折", "承上启下", target_chapter_id=target_id))
        assert created["order_index"] == 2
        assert created["title"] == "转折"
        assert created["word_count"] == 0

        # Verify reorder: 开篇(0) 发展(1) 转折(2) 高潮(3) 结局(4)
        listed = json.loads(await tools.list_chapters())
        titles = [c["title"] for c in listed["items"]]
        assert titles == ["开篇", "发展", "转折", "高潮", "结局"]
        assert [c["order_index"] for c in listed["items"]] == [0, 1, 2, 3, 4]

    async def test_create_chapter_target_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.create_chapter("某章", target_chapter_id="nonexistent"))
        assert "error" in result
        assert "target chapter not found" in result["error"]

    async def test_volume_tools_and_chapter_volume_assignment(
        self, tools: GoodguaTools, session: AsyncSession
    ) -> None:
        default_volumes = json.loads(await tools.list_volumes())
        assert default_volumes["items"][0]["title"] == "默认卷"

        created_volume = json.loads(await tools.create_volume("第二卷"))
        assert created_volume["order_index"] == 2

        updated_volume = json.loads(await tools.update_volume(created_volume["id"], "远航卷"))
        assert updated_volume["title"] == "远航卷"

        chapter = json.loads(await tools.create_chapter("远航第一章", "出发", created_volume["id"]))
        assert chapter["volume_id"] == created_volume["id"]
        assert chapter["order_index"] == 1

        missing = json.loads(await tools.create_chapter("失落章", volume_id="missing"))
        assert "error" in missing
        assert "error" in json.loads(await tools.update_volume("missing", "无"))

    async def test_volume_tools_reorder_existing_slot_and_list_chapters_by_volume_order(
        self, tools: GoodguaTools, session: AsyncSession
    ) -> None:
        work = await session.get(Work, tools.work_id)
        assert work is not None
        session.add_all(
            [
                Volume(id="z-volume", work_id=work.id, order_index=1, title="第一卷"),
                Volume(id="a-volume", work_id=work.id, order_index=2, title="第二卷"),
            ]
        )
        session.add_all(
            [
                Chapter(
                    work_id=work.id,
                    volume_id="a-volume",
                    order_index=1,
                    title="第二卷第一章",
                    content="",
                    summary="",
                ),
                Chapter(
                    work_id=work.id,
                    volume_id="z-volume",
                    order_index=1,
                    title="第一卷第一章",
                    content="",
                    summary="",
                ),
            ]
        )
        await session.commit()

        listed = json.loads(await tools.list_chapters())
        moved = json.loads(await tools.update_volume("a-volume", "第二卷", order_index=1))
        volumes = json.loads(await tools.list_volumes())

        assert [item["title"] for item in listed["items"]] == ["第一卷第一章", "第二卷第一章"]
        assert moved["order_index"] == 1
        assert [(item["title"], item["order_index"]) for item in volumes["items"]] == [
            ("第二卷", 1),
            ("第一卷", 2),
        ]

    async def test_volume_tools_roll_back_on_commit_error(
        self, tools: GoodguaTools, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        created_volume = json.loads(await tools.create_volume("第二卷"))
        real_rollback = tools.db.rollback
        rollback = AsyncMock(side_effect=real_rollback)
        monkeypatch.setattr(tools.db, "commit", AsyncMock(side_effect=RuntimeError("boom")))
        monkeypatch.setattr(tools.db, "rollback", rollback)

        with pytest.raises(RuntimeError, match="boom"):
            await tools.create_volume("失败卷")
        with pytest.raises(RuntimeError, match="boom"):
            await tools.update_volume(created_volume["id"], "失败改名", order_index=3)

        assert rollback.await_count == 2

    async def test_work_info(self, tools: GoodguaTools, session: AsyncSession) -> None:
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

    async def test_update_character_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.create_or_update_character("x", "y", character_id="nonexistent"))
        assert "error" in result

    async def test_update_setting_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.create_or_update_setting("x", "y", setting_id="nonexistent"))
        assert "error" in result

    async def test_update_chapter_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.update_chapter("nonexistent", summary="摘要"))
        assert "error" in result
        content_result = json.loads(await tools.update_chapter("nonexistent", content="正文"))
        assert "error" in content_result

    async def test_update_chapter_content_requires_read(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """修改章节正文前必须先 get_chapter，否则返回 error。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.flush()

        # 未读取，直接修改正文 → 拒绝
        result = json.loads(await tools.update_chapter(chapter.id, content="新内容"))
        assert "error" in result
        assert "get_chapter" in result["error"]

        # 读取后 → 允许修改
        await tools.get_chapter(chapter.id)
        ok = json.loads(await tools.update_chapter(chapter.id, content="新内容"))
        assert "error" not in ok

    async def test_create_chapter_auto_marked_read(self, tools: GoodguaTools) -> None:
        """create_chapter 创建的章节自动标记为已读，可立即修改正文。"""
        created = json.loads(await tools.create_chapter("新章"))
        chapter_id = created["id"]

        # 创建后直接修改正文 → 不拦截
        result = json.loads(await tools.update_chapter(chapter_id, content="第一章内容"))
        assert "error" not in result

    async def test_work_scoping(self, session: AsyncSession) -> None:
        other_work = await _make_work(session, "u-other")
        chapter = Chapter(work_id=other_work.id, order_index=1, title="其他作品章节", content="内容")
        session.add(chapter)
        await session.flush()
        await session.commit()

        tools = GoodguaTools(db=session, work_id="nonexistent-work", session_id="test-other")
        result = json.loads(await tools.list_chapters())
        assert result["items"] == []

    async def test_get_setting_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.get_setting("nonexistent"))
        assert "error" in result

    async def test_update_existing_setting(self, tools: GoodguaTools) -> None:
        created = json.loads(await tools.create_or_update_setting("原始", "摘要", "详情", "world"))
        setting_id = created["id"]
        updated = json.loads(await tools.create_or_update_setting("更新", "新摘要", "新详情", "combat", setting_id=setting_id))
        assert updated["name"] == "更新"
        assert updated["type"] == "combat"

    async def test_delete_character_returns_success_and_not_found(self, tools: GoodguaTools) -> None:
        created = json.loads(await tools.create_or_update_character("苏白", "主角", "详情"))
        deleted = json.loads(await tools.delete_character(created["id"]))
        assert deleted["success"] is True
        assert deleted["name"] == "苏白"
        assert json.loads(await tools.delete_character(created["id"]))["error"].startswith("未找到角色")

    async def test_get_work_info_not_found(self, session: AsyncSession) -> None:
        tools = GoodguaTools(db=session, work_id="nonexistent-work", session_id="test-other")
        result = json.loads(await tools.get_work_info())
        assert "error" in result

    async def test_update_work_info_not_found(self, session: AsyncSession) -> None:
        tools = GoodguaTools(db=session, work_id="nonexistent-work", session_id="test-other")
        result = json.loads(await tools.update_work_info("short_intro", "x"))
        assert "error" in result

    async def test_update_work_info_rejects_invalid_field(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.update_work_info("unknown_field", "x"))
        assert "error" in result

    async def test_update_work_info_all_fields(self, tools: GoodguaTools) -> None:
        focus = json.loads(await tools.update_work_info("focus_requirements", "全重点"))
        forbidden = json.loads(await tools.update_work_info("forbidden_requirements", "全禁忌"))
        assert focus["field"] == "focus_requirements"
        assert forbidden["field"] == "forbidden_requirements"
        refreshed = json.loads(await tools.get_work_info())
        assert refreshed["focus_requirements"] == "全重点"
        assert refreshed["forbidden_requirements"] == "全禁忌"

    async def test_tool_rollbacks_on_commit_failures(
        self, tools: GoodguaTools, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="第一章", content="正文")
        setting = SettingItem(work_id=tools.work_id, type="other", name="设定", summary="摘要", detail="详情")
        character = Character(work_id=tools.work_id, name="角色", summary="摘要", detail="详情")
        tools.db.add_all([chapter, setting, character])
        await tools.db.flush()

        rollback = AsyncMock()
        monkeypatch.setattr(tools.db, "rollback", rollback)
        monkeypatch.setattr(tools.db, "commit", AsyncMock(side_effect=RuntimeError("boom")))

        with pytest.raises(RuntimeError):
            await tools.create_or_update_character("角色", "摘要", "详情")
        with pytest.raises(RuntimeError):
            await tools.create_or_update_setting("设定", "摘要", "详情", "other")
        with pytest.raises(RuntimeError):
            await tools.create_chapter("新章节")
        with pytest.raises(RuntimeError):
            await tools.delete_setting(setting.id)
        with pytest.raises(RuntimeError):
            await tools.delete_character(character.id)
        with pytest.raises(RuntimeError):
            await tools.update_chapter(chapter.id, summary="新摘要")
        with pytest.raises(RuntimeError):
            await tools.update_work_info("short_intro", "新简介")

        assert rollback.await_count == 7

    async def test_get_chapter_unchanged_returns_shortcut(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """R3: 重复读取未变化的章节返回 unchanged 提示，不返回全量内容。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="正文内容")
        session.add(chapter)
        await session.flush()

        # 第一次读取 → 返回全量
        first = json.loads(await tools.get_chapter(chapter.id))
        assert "content" in first
        assert first["word_count"] > 0

        # 第二次读取 → 返回 unchanged
        second = json.loads(await tools.get_chapter(chapter.id))
        assert second.get("status") == "unchanged"
        assert "content" not in second
        assert "message" in second

    async def test_get_chapter_returns_full_after_external_change(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """R3: 外部修改后重新读取返回全量新内容。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.flush()

        # 第一次读取
        await tools.get_chapter(chapter.id)

        # 模拟外部修改（直接改 DB）
        chapter.content = "被外部修改的内容"
        await session.flush()

        # 再次读取 → 应返回全量新内容（不是 unchanged）
        result = json.loads(await tools.get_chapter(chapter.id))
        assert "content" in result
        assert "被外部修改的内容" in result["content"]

    async def test_read_state_persists_across_toolkit_instances(self, session: AsyncSession) -> None:
        """R2: 同一 session_id 下，重建 GoodguaTools 实例后读取状态保持。"""
        user_id = "u-persist"
        work = await _make_work(session, user_id)
        chapter = Chapter(work_id=work.id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.commit()

        # 第一个实例读取
        tools1 = GoodguaTools(db=session, work_id=work.id, session_id="same-session")
        await tools1.get_chapter(chapter.id)

        # 模拟新消息轮次：创建新实例（同一 session_id）
        tools2 = GoodguaTools(db=session, work_id=work.id, session_id="same-session")

        # 新实例可以直接修改正文（读取状态跨实例保持）
        result = json.loads(await tools2.update_chapter(chapter.id, content="新内容"))
        assert "error" not in result
        assert result["status"] == "updated"

    async def test_read_state_isolated_between_sessions(self, session: AsyncSession) -> None:
        """不同 session_id 的读取状态互相隔离。"""
        user_id = "u-isolate"
        work = await _make_work(session, user_id)
        chapter = Chapter(work_id=work.id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.commit()

        # session A 读取
        tools_a = GoodguaTools(db=session, work_id=work.id, session_id="session-a")
        await tools_a.get_chapter(chapter.id)

        # session B 未读取 → 应拒绝
        tools_b = GoodguaTools(db=session, work_id=work.id, session_id="session-b")
        result = json.loads(await tools_b.update_chapter(chapter.id, content="新内容"))
        assert "error" in result
        assert "get_chapter" in result["error"]

    async def test_update_rejected_after_external_change(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """R4: 读取后内容被外部修改，update_chapter 应拒绝。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.flush()

        await tools.get_chapter(chapter.id)

        # 模拟外部修改
        chapter.content = "被外部修改了"
        await session.flush()

        result = json.loads(await tools.update_chapter(chapter.id, content="尝试修改"))
        assert "error" in result
        assert "修改过" in result["error"]

    async def test_consecutive_edits_after_read(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """R5: 读取后可连续多次 update_chapter，自编辑自动刷新指纹。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="第一行\n第二行\n第三行")
        session.add(chapter)
        await session.flush()

        await tools.get_chapter(chapter.id)

        # 第一次编辑
        r1 = json.loads(await tools.update_chapter(chapter.id, content="新第二行", start_line=2))
        assert r1["status"] == "updated"

        # 第二次编辑（无需重新读取）
        r2 = json.loads(await tools.update_chapter(chapter.id, content="新第三行", start_line=3))
        assert r2["status"] == "updated"

        # 第三次编辑
        r3 = json.loads(await tools.update_chapter(chapter.id, content="全新第三行", start_line=3))
        assert r3["status"] == "updated"

    async def test_cache_expiration(self, session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
        """R7: 缓存过期后读取状态清除。"""
        from app.services import agent_service

        user_id = "u-expire"
        work = await _make_work(session, user_id)
        chapter = Chapter(work_id=work.id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.commit()

        sid = "expiring-session"

        # 清空缓存
        agent_service._read_sessions.clear()

        tools = GoodguaTools(db=session, work_id=work.id, session_id=sid)
        await tools.get_chapter(chapter.id)

        # 此时可以编辑
        ok = json.loads(await tools.update_chapter(chapter.id, content="新内容"))
        assert "error" not in ok

        # 模拟时间流逝超过 TTL
        monkeypatch.setattr(agent_service, "_READ_SESSION_TTL", 0)
        # 触发惰性清理（通过新实例访问）
        tools2 = GoodguaTools(db=session, work_id=work.id, session_id=sid)
        result = json.loads(await tools2.update_chapter(chapter.id, content="再改"))
        assert "error" in result

        # 恢复
        monkeypatch.setattr(agent_service, "_READ_SESSION_TTL", 7200)

    async def test_re_read_after_edit_shows_unchanged(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """R5 + R3: 自编辑后再 get_chapter 应返回 unchanged（指纹已刷新）。"""
        chapter = Chapter(work_id=tools.work_id, order_index=1, title="测试章", content="原文")
        session.add(chapter)
        await session.flush()

        await tools.get_chapter(chapter.id)
        await tools.update_chapter(chapter.id, content="编辑后的内容")

        # 再读取 → 指纹已刷新为编辑后的内容 → unchanged
        result = json.loads(await tools.get_chapter(chapter.id))
        assert result.get("status") == "unchanged"

    async def test_delete_chapter_gap_does_not_break_listing_order(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """删除中间章节产生 order_index gap 后，列表排序仍然正确。"""
        for i in range(4):
            session.add(Chapter(work_id=tools.work_id, order_index=i, title=f"章节{i}", content="", summary=""))
        await session.commit()

        # 删除 order_index=1 的章节，产生 gap [0, 2, 3]
        ch1 = (await session.execute(
            select(Chapter).where(Chapter.work_id == tools.work_id, Chapter.order_index == 1)
        )).scalar_one()
        await session.delete(ch1)
        await session.commit()

        listed = json.loads(await tools.list_chapters())
        titles = [c["title"] for c in listed["items"]]
        assert titles == ["章节0", "章节2", "章节3"]
        assert [c["order_index"] for c in listed["items"]] == [0, 2, 3]

    async def test_delete_then_create_chapter_uses_max_order_index(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """删除产生 gap 后，create_chapter 使用 max(order_index)+1 而非 count+1，避免 UniqueConstraint 冲突。"""
        for i in range(3):
            session.add(Chapter(work_id=tools.work_id, order_index=i, title=f"章节{i}", content="", summary=""))
        await session.commit()

        # 删除 order_index=1，剩余 [0, 2]
        ch1 = (await session.execute(
            select(Chapter).where(Chapter.work_id == tools.work_id, Chapter.order_index == 1)
        )).scalar_one()
        await session.delete(ch1)
        await session.commit()

        # 通过 agent tools 创建新章节，应使用 max+1 = 3
        created = json.loads(await tools.create_chapter("新章节"))
        assert created["order_index"] == 3

        # 再创建一个，order_index = 4
        created2 = json.loads(await tools.create_chapter("又一章节"))
        assert created2["order_index"] == 4

    async def test_multiple_deletes_with_gap_then_create(self, tools: GoodguaTools, session: AsyncSession) -> None:
        """多次删除产生 gap 后，创建新章节不会触发 UniqueConstraint 冲突。"""
        for i in range(3):
            session.add(Chapter(work_id=tools.work_id, order_index=i, title=f"章节{i}", content="", summary=""))
        await session.commit()

        # 删除 order_index=1，剩余 [0, 2]
        ch1 = (await session.execute(
            select(Chapter).where(Chapter.work_id == tools.work_id, Chapter.order_index == 1)
        )).scalar_one()
        await session.delete(ch1)
        await session.commit()

        # 删除 order_index=0，剩余 [2]
        ch0 = (await session.execute(
            select(Chapter).where(Chapter.work_id == tools.work_id, Chapter.order_index == 0)
        )).scalar_one()
        await session.delete(ch0)
        await session.commit()

        # count=1, max=2 → new order_index should be 3 (max+1), not 2 (count+1)
        created = json.loads(await tools.create_chapter("安全创建"))
        assert created["order_index"] == 3

        # 验证列表顺序正确
        listed = json.loads(await tools.list_chapters())
        assert len(listed["items"]) == 2
        assert [c["title"] for c in listed["items"]] == ["章节2", "安全创建"]

    async def test_update_chapter_with_title(self, tools: GoodguaTools, session: AsyncSession) -> None:
        volume = Volume(work_id=tools.work_id, order_index=1, title="V")
        session.add(volume)
        await session.flush()
        ch = Chapter(work_id=tools.work_id, volume_id=volume.id, order_index=1, title="旧标题", content="正文")
        session.add(ch)
        await session.flush()
        _read_sessions[tools._session_id]["chapters"][ch.id] = "abc"

        result = json.loads(await tools.update_chapter(ch.id, title="新标题"))
        assert result["title"] == "新标题"
        assert result["status"] == "updated"

    async def test_update_chapter_end_line_out_of_range(self, tools: GoodguaTools, session: AsyncSession) -> None:
        import hashlib
        volume = Volume(work_id=tools.work_id, order_index=1, title="V")
        session.add(volume)
        await session.flush()
        content = "第一行\n第二行\n"
        ch = Chapter(work_id=tools.work_id, volume_id=volume.id, order_index=1, title="T", content=content)
        session.add(ch)
        await session.flush()
        from app.services.agent_service import _get_read_chapters
        _get_read_chapters(tools._session_id)[ch.id] = hashlib.md5(content.encode("utf-8")).hexdigest()

        result = json.loads(await tools.update_chapter(ch.id, content="新", start_line=1, end_line=999))
        assert "error" in result
        assert "end_line" in result["error"]

    async def test_update_chapter_creates_version_snapshot(self, tools: GoodguaTools, session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
        volume = Volume(work_id=tools.work_id, order_index=1, title="V")
        session.add(volume)
        await session.flush()
        ch = Chapter(work_id=tools.work_id, volume_id=volume.id, order_index=1, title="T", content="旧内容")
        session.add(ch)
        await session.flush()
        import hashlib
        _read_sessions[tools._session_id]["chapters"][ch.id] = hashlib.md5("旧内容".encode("utf-8")).hexdigest()

        snap_called = False
        async def mock_snapshot(*args, **kwargs):
            nonlocal snap_called
            snap_called = True
        import app.services.version_service as _vs
        monkeypatch.setattr(_vs, "create_version_snapshot", mock_snapshot)

        await tools.update_chapter(ch.id, content="新内容")
        assert snap_called

    async def test_list_prompt_categories_empty(self, tools: GoodguaTools, session: AsyncSession) -> None:
        result = json.loads(await tools.list_prompt_categories())
        assert isinstance(result, list)
        assert result == []

    async def test_list_prompt_categories_with_data(self, tools: GoodguaTools, session: AsyncSession) -> None:
        cat = WritingPromptCategory(name="角色塑造", is_active=True, sort_order=1)
        session.add(cat)
        await session.flush()

        result = json.loads(await tools.list_prompt_categories())
        assert len(result) == 1
        assert result[0]["name"] == "角色塑造"
        assert result[0]["prompt_count"] == 0

    async def test_list_prompts_by_category_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.list_prompts_by_category("nonexistent"))
        assert "error" in result

    async def test_list_prompts_by_category_with_data(self, tools: GoodguaTools, session: AsyncSession) -> None:
        cat = WritingPromptCategory(name="风格", is_active=True, sort_order=1)
        session.add(cat)
        await session.flush()
        prompt = WritingPrompt(category_id=cat.id, title="对话规范", description="对话标点规则", detail_prompt="详细规则", is_active=True)
        session.add(prompt)
        await session.flush()

        result = json.loads(await tools.list_prompts_by_category(cat.id))
        assert len(result) == 1
        assert result[0]["title"] == "对话规范"

    async def test_get_prompt_detail_found(self, tools: GoodguaTools, session: AsyncSession) -> None:
        cat = WritingPromptCategory(name="剧情", is_active=True, sort_order=1)
        session.add(cat)
        await session.flush()
        prompt = WritingPrompt(category_id=cat.id, title="伏笔", description="伏笔技巧", detail_prompt="详细伏笔技巧", is_active=True)
        session.add(prompt)
        await session.flush()

        result = json.loads(await tools.get_prompt_detail(prompt.id))
        assert result["title"] == "伏笔"
        assert result["detail_prompt"] == "详细伏笔技巧"

    async def test_get_prompt_detail_not_found(self, tools: GoodguaTools) -> None:
        result = json.loads(await tools.get_prompt_detail("nonexistent"))
        assert "error" in result


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

    async def test_lock_point_account_creates_missing_account(self, session: AsyncSession) -> None:
        from app.services.billing_service import _lock_point_account

        account = await _lock_point_account(session, "u-locked")
        assert account.user_id == "u-locked"


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


class TestPointGrantExpireAndAdminAdjust:
    async def test_expire_vip_daily_points_handles_zero_and_partial_remaining(self, session: AsyncSession) -> None:
        from app.services.billing_service import expire_vip_daily_points

        user = await create_user_account(session, "expire@example.com", "user12345")
        account = await _ensure_account(session, user.id, monthly=Decimal("5"))

        await expire_vip_daily_points(session, user.id, Decimal("0"))
        assert account.vip_daily_points_balance == Decimal("5")

        await expire_vip_daily_points(session, user.id, Decimal("3"), source_id="sub-1")
        await session.flush()
        assert account.vip_daily_points_balance == Decimal("2")

        account.vip_daily_points_balance = Decimal("0")
        await expire_vip_daily_points(session, user.id, Decimal("2"), source_id="sub-2")
        await session.flush()
        assert account.vip_daily_points_balance == Decimal("0")

        tx = (
            await session.execute(
                select(PointTransaction)
                .where(PointTransaction.user_id == user.id)
                .order_by(PointTransaction.created_at.desc())
            )
        ).scalars().first()
        assert tx.change_type == "expire"
        assert tx.points_delta == Decimal("-3")
        assert tx.source_id == "sub-1"

    async def test_admin_adjust_points_direct_branches(self, session: AsyncSession) -> None:
        from app.services.billing_service import admin_adjust_points

        user = await create_user_account(session, "adjust@example.com", "user12345")
        await _ensure_account(session, user.id, monthly=Decimal("4"), topup=Decimal("2"))

        granted = await admin_adjust_points(
            session,
            user.id,
            "credit_pack",
            "grant",
            Decimal("5"),
            "补点",
        )
        await session.flush()
        assert granted.points_delta == Decimal("5")
        assert granted.description == "补点"

        vip_grant = await admin_adjust_points(
            session,
            user.id,
            "vip_daily",
            "grant",
            Decimal("2"),
            "加日额",
        )
        await session.flush()
        assert vip_grant.points_delta == Decimal("2")

        deducted = await admin_adjust_points(
            session,
            user.id,
            "vip_daily",
            "deduct",
            Decimal("1"),
            "扣点",
        )
        await session.flush()
        assert deducted.points_delta == Decimal("-1")

        with pytest.raises(HTTPException) as error:
            await admin_adjust_points(
                session,
                user.id,
                "vip_daily",
                "deduct",
                Decimal("999"),
                "超扣",
            )
        assert error.value.status_code == 422


class TestResolveEditorModel:
    async def test_returns_none_when_no_config(self, session: AsyncSession) -> None:
        result = await _real_resolve_editor_model(session, "character")
        assert result is None

    async def test_returns_model_when_configured(self, session: AsyncSession) -> None:
        from app.models import GlobalConfig
        model = (await session.execute(select(AiModel).where(AiModel.status == "active"))).scalars().first()
        config = (
            await session.execute(
                select(GlobalConfig).where(
                    GlobalConfig.config_group == "ai.editor_check",
                    GlobalConfig.config_key == "character_model_id",
                )
            )
        ).scalar_one()
        config.string_value = model.id
        await session.commit()

        result = await _real_resolve_editor_model(session, "character")
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
                    GlobalConfig.config_key == "character_model_id",
                )
            )
        ).scalar_one()
        config.string_value = model.id
        await session.commit()

        result = await _real_resolve_editor_model(session, "character")
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


class TestAgentServiceEdgeCoverage:
    """Cover uncovered branches in agent_service.py: lines 160, 182."""

    async def test_add_line_numbers_empty(self) -> None:
        from app.services.agent_service import _add_line_numbers
        assert _add_line_numbers("") == ("", 0)

    async def test_lines_to_content_empty(self) -> None:
        from app.services.agent_service import _lines_to_content
        assert _lines_to_content([]) == ""
