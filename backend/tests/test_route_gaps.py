import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
import pytest_asyncio
from agno.run.agent import RunEvent
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.api.routes as routes_module
from app.api.routes import (
    AdminBalanceAdjustRequest,
    AnalyzeIn,
    ChatIn,
    ChatSessionIn,
    CostPreviewIn,
    WorkIn,
    admin_cost_preview,
    admin_credit_transactions,
    admin_users,
    analyze_chapter,
    append_text_block,
    complete_tool_block,
    confirm_verified_payment,
    create_chat_session,
    create_user_account,
    create_work,
    current_admin,
    ensure_point_account,
    send_chat_message,
)
from app.core.config import get_settings
from app.core.security import _b64encode, issue_token
from app.models import (
    AgentRunStore,
    AiModel,
    Base,
    BillingOrder,
    PaymentRecord,
    PointTransaction,
    UserSubscription,
)


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as db:
        await routes_module.seed_defaults(db)
        await create_user_account(db, "admin@example.com", "admin12345", role="admin")
        await db.commit()
        yield db
    await engine.dispose()


async def _admin(session: AsyncSession):
    return (
        await session.execute(select(routes_module.User).where(routes_module.User.email == "admin@example.com"))
    ).scalar_one()


async def _make_paid_order_with_payment(
    session: AsyncSession,
    *,
    user_id: str,
    product_type: str,
    amount: Decimal,
    daily_vip_points_snapshot: int | None = None,
    bundled_credit_pack_points_snapshot: int | None = None,
    credit_pack_points_snapshot: int | None = None,
    duration_days_snapshot: int | None = None,
) -> tuple[BillingOrder, PaymentRecord]:
    order = BillingOrder(
        user_id=user_id,
        product_type=product_type,
        product_id="product-1",
        product_name_snapshot="测试商品",
        daily_vip_points_snapshot=daily_vip_points_snapshot,
        bundled_credit_pack_points_snapshot=bundled_credit_pack_points_snapshot,
        credit_pack_points_snapshot=credit_pack_points_snapshot,
        duration_days_snapshot=duration_days_snapshot,
        order_no=f"ORDER-{routes_module.uuid4().hex[:12]}",
        amount=amount,
        currency="CNY",
        status="qr_created",
    )
    session.add(order)
    await session.flush()
    payment = PaymentRecord(
        order_id=order.id,
        user_id=user_id,
        channel="alipay_f2f",
        out_trade_no=order.order_no,
        channel_status="WAIT_BUYER_PAY",
        qr_code="qr://code",
    )
    session.add(payment)
    await session.flush()
    return order, payment


def test_agent_run_lock_reuses_key_without_running_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        routes_module.asyncio,
        "get_running_loop",
        lambda: (_ for _ in ()).throw(RuntimeError("no loop")),
    )
    first = routes_module._agent_run_lock("session-1")
    second = routes_module._agent_run_lock("session-1")
    assert first is second


async def test_current_admin_reads_user_cookie_and_password_change_invalidates_token(
    session: AsyncSession,
) -> None:
    admin = await _admin(session)
    user_cookie = issue_token(admin.id, admin.role, get_settings().jwt_secret, token_type="user")
    assert (await current_admin(goodgua_session=user_cookie, session=session)).id == admin.id

    admin.password_changed_at = datetime.now(UTC) + timedelta(seconds=1)
    await session.commit()
    with pytest.raises(HTTPException) as error:
        await routes_module.user_from_token(session, user_cookie, "user")
    assert error.value.status_code == 401

    bad_iat_payload = {
        "sub": admin.id,
        "role": admin.role,
        "typ": "user",
        "iat": "not-a-number",
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
    }
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    payload = _b64encode(json.dumps(bad_iat_payload).encode("utf-8"))
    signature = _b64encode(
        routes_module.hmac.new(
            get_settings().jwt_secret.encode("utf-8"),
            f"{header}.{payload}".encode("ascii"),
            routes_module.hashlib.sha256,
        ).digest()
    )
    token_with_bad_iat = f"{header}.{payload}.{signature}"
    assert (await routes_module.user_from_token(session, token_with_bad_iat, "user")).id == admin.id

    fresh_token = issue_token(admin.id, admin.role, get_settings().jwt_secret, token_type="user")
    admin.password_changed_at = datetime.now(UTC) - timedelta(seconds=5)
    await session.commit()
    assert (await routes_module.user_from_token(session, fresh_token, "user")).id == admin.id


async def test_consume_point_prefers_vip_then_credit_pack(session: AsyncSession) -> None:
    user = await create_user_account(session, "consume@example.com", "user12345")
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("1")
    account.credit_pack_points_balance = Decimal("2")
    await session.commit()

    assert await routes_module.consume_point(session, user.id) == "vip_daily"
    await session.commit()
    await session.refresh(account)
    assert account.vip_daily_points_balance == Decimal("0")

    assert await routes_module.consume_point(session, user.id) == "credit_pack"
    await session.commit()
    await session.refresh(account)
    assert account.credit_pack_points_balance == Decimal("1")


async def test_request_analysis_requires_api_key_outside_test(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(routes_module, "get_settings", lambda: SimpleNamespace(env="development"))
    with pytest.raises(HTTPException) as error:
        await routes_module.request_analysis("正文", "https://test", "", "model")
    assert error.value.status_code == 503


async def test_analyze_chapter_requires_editor_model(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "analysis-missing-model@example.com", "user12345")
    work = await create_work(
        WorkIn(title="缺模型", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100")
    await session.commit()

    async def _no_model(*_args, **_kwargs):
        return None

    monkeypatch.setattr(routes_module, "_resolve_editor_model", _no_model)
    with pytest.raises(HTTPException) as error:
        await analyze_chapter(work["id"], AnalyzeIn(content="需要分析"), user, session)
    assert error.value.status_code == 503


def test_append_and_complete_tool_blocks_and_normalized_run_flags() -> None:
    blocks: list[dict[str, object]] = []
    append_text_block(blocks, "")
    append_text_block(blocks, "第一段")
    append_text_block(blocks, "续写")
    assert blocks == [{"type": "text", "text": "第一段续写"}]

    tool_blocks = [{"type": "tool_call", "tool": "get_character", "display": "查询角色", "status": "started"}]
    complete_tool_block(tool_blocks, "get_character", "查询角色", "详细结果")
    assert tool_blocks[0]["status"] == "completed"
    assert tool_blocks[0]["result"] == "详细结果"

    complete_tool_block(tool_blocks, "missing_tool", "缺失工具", "补写结果")
    assert tool_blocks[-1]["tool"] == "missing_tool"
    assert tool_blocks[-1]["status"] == "completed"

    # Error result: tool returns JSON with "error" key
    error_blocks: list[dict[str, object]] = [{"type": "tool_call", "tool": "get_chapter", "display": "查询章节", "status": "started"}]
    complete_tool_block(error_blocks, "get_chapter", "查询章节", '{"error": "chapter not found"}')
    assert error_blocks[0]["status"] == "error"
    assert error_blocks[0]["result"] == '{"error": "chapter not found"}'

    # Error result: appended block for missing started entry also gets error status
    extra_blocks: list[dict[str, object]] = []
    complete_tool_block(extra_blocks, "bad_tool", "坏工具", '{"error": "something wrong"}')
    assert extra_blocks[-1]["status"] == "error"

    normalized = routes_module.normalized_run(
        {
            "role": "assistant",
            "content": "回复",
            "billing_failed": True,
            "error": "扣费异常",
            "blocks": [{"type": "text", "text": "回复"}],
            "tool_results": [{"tool": "get_character", "result": "详情"}],
        },
        1,
    )
    assert normalized["billing_failed"] is True
    assert normalized["error"] == "扣费异常"
    assert normalized["blocks"][0]["text"] == "回复"


def test_tool_result_status_detects_errors() -> None:
    from app.api.routes import _tool_result_status

    assert _tool_result_status("") == "completed"
    assert _tool_result_status("not json") == "completed"
    assert _tool_result_status('{"ok": true}') == "completed"
    assert _tool_result_status('{"error": "chapter not found"}') == "error"
    assert _tool_result_status('{"data": [], "error": null}') == "error"
    assert _tool_result_status('[{"name": "test"}]') == "completed"


def test_finalize_tool_blocks_marks_unfinished_as_error() -> None:
    from app.api.routes import finalize_tool_blocks

    blocks = [
        {"type": "text", "text": "hello"},
        {"type": "tool_call", "tool": "broken", "display": "坏工具", "status": "started"},
        {"type": "tool_call", "tool": "good", "display": "好工具", "status": "completed", "result": "ok"},
    ]
    result = finalize_tool_blocks(blocks)
    assert len(result) == 3
    assert result[0] == {"type": "text", "text": "hello"}
    assert result[1]["status"] == "error"
    assert result[1]["tool"] == "broken"
    assert result[2]["status"] == "completed"
    assert result[2]["tool"] == "good"


def test_build_reference_section_includes_ids() -> None:
    from app.services.agent_service import _build_reference_section

    refs = [
        {"type": "chapter", "id": "ch-001", "name": "第一章", "summary": "开篇", "detail": "正文..."},
        {"type": "character", "id": "char-abc", "name": "苏白", "summary": "主角", "detail": "少年剑客"},
        {"type": "setting", "id": "set-xyz", "name": "青云宗", "summary": "修炼门派"},
    ]
    section = _build_reference_section(refs)
    assert "ID：ch-001" in section
    assert "ID：char-abc" in section
    assert "ID：set-xyz" in section

    # Without ID column — should not crash
    no_id = [{"type": "chapter", "name": "无ID章节", "summary": "测试"}]
    section_no_id = _build_reference_section(no_id)
    assert "ID：" not in section_no_id
    assert "无ID章节" in section_no_id


async def test_send_chat_message_truncates_detail_tool_results_and_persists_done(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-detail@example.com", "user12345")
    work = await create_work(
        WorkIn(title="流式详情", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Tool:
        def __init__(self, name: str, result: str | None = None) -> None:
            self.tool_name = name
            self.result = result

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: Tool | None = None, metrics: object | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool
            self.metrics = metrics

    async def _events():
        yield Event(RunEvent.tool_call_started, tool=Tool("get_character"))
        yield Event(
            RunEvent.run_completed,
            content="",
            metrics=SimpleNamespace(input_tokens=10, output_tokens=5, cache_read_tokens=0),
        )
        yield Event(RunEvent.tool_call_completed, tool=Tool("get_character", "甲" * 1500))

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="展开角色", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: tool_result" in body
    assert "event: done" in body

    chat_model = await session.get(routes_module.ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    assistant_message = agent.runs[-1]
    assert len(assistant_message["tool_results"][0]["result"]) == 1000
    assert assistant_message["actions"][0]["type"] == "get_character"


async def test_send_chat_message_keeps_empty_tool_results(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-empty-tool@example.com", "user12345")
    work = await create_work(
        WorkIn(title="空工具结果", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Tool:
        def __init__(self, name: str, result: str | None = None) -> None:
            self.tool_name = name
            self.result = result

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: Tool | None = None, metrics: object | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool
            self.metrics = metrics

    async def _events():
        yield Event(RunEvent.tool_call_started, tool=Tool("get_setting"))
        yield Event(RunEvent.tool_call_completed, tool=Tool("get_setting", ""))
        yield Event(
            RunEvent.run_completed,
            content="完成",
            metrics=SimpleNamespace(input_tokens=1, output_tokens=1, cache_read_tokens=0),
        )

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="空结果", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body

    chat_model = await session.get(routes_module.ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    assert agent.runs[-1]["tool_results"][0]["result"] == ""


async def test_send_chat_message_emits_error_status_when_tool_returns_error(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-tool-error@example.com", "user12345")
    work = await create_work(
        WorkIn(title="工具错误", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Tool:
        def __init__(self, name: str, result: str | None = None) -> None:
            self.tool_name = name
            self.result = result

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: Tool | None = None, metrics: object | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool
            self.metrics = metrics

    async def _events():
        yield Event(RunEvent.tool_call_started, tool=Tool("get_chapter"))
        yield Event(RunEvent.tool_call_completed, tool=Tool("get_chapter", '{"error": "chapter not found"}'))
        yield Event(
            RunEvent.run_completed,
            content="章节不存在",
            metrics=SimpleNamespace(input_tokens=10, output_tokens=5, cache_read_tokens=0),
        )

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="查看这个章节", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()

    # SSE event should have status: "error" (JSON encoder inserts space after colon)
    assert "get_chapter" in body
    assert '"status": "error"' in body
    assert "event: tool_result" in body
    assert "event: done" in body

    # Persisted block should also have status: "error"
    chat_model = await session.get(routes_module.ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    assistant_message = agent.runs[-1]
    tool_block = next(b for b in assistant_message["blocks"] if b.get("type") == "tool_call")
    assert tool_block["status"] == "error"
    assert "chapter not found" in tool_block["result"]


async def test_send_chat_message_continues_after_run_completed_event(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-post-complete@example.com", "user12345")
    work = await create_work(
        WorkIn(title="完成后继续", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, metrics: object | None = None) -> None:
            self.event = event
            self.content = content
            self.metrics = metrics
            self.tool = None

    async def _events():
        yield Event(
            RunEvent.run_completed,
            content="",
            metrics=SimpleNamespace(input_tokens=1, output_tokens=1, cache_read_tokens=0),
        )
        yield Event(RunEvent.run_content, content="收尾")

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="继续生成", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "收尾" in body
    assert "event: done" in body


async def test_send_chat_message_persists_error_messages_without_content(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-error@example.com", "user12345")
    work = await create_work(
        WorkIn(title="流式报错", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Tool:
        def __init__(self, name: str) -> None:
            self.tool_name = name

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: Tool | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool

    async def _events():
        yield Event(RunEvent.run_error, content="run failed")
        yield Event(RunEvent.tool_call_error, content="tool boom", tool=Tool("get_setting"))

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="报错分支", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "run failed" in body
    assert "Tool 'get_setting' failed: tool boom" in body
    assert "event: done" in body

    chat_model = await session.get(routes_module.ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    assert "run failed" in agent.runs[-1]["error"]


async def test_send_chat_message_skips_empty_assistant_persistence(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await create_user_account(session, "stream-empty@example.com", "user12345")
    work = await create_work(
        WorkIn(title="空流", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    async def _events():
        if False:
            yield None

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="没有返回", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body

    chat_model = await session.get(routes_module.ChatSession, chat["id"])
    agent = await session.get(AgentRunStore, chat_model.agno_session_id)
    assert len(agent.runs) == 1


async def test_send_chat_message_fallback_done_has_proper_fields_when_empty_stream(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When stream produces no events, fallback done event has id/role/content/actions fields."""
    user = await create_user_account(session, "fallback-empty@example.com", "user12345")
    work = await create_work(
        WorkIn(title="Fallback空流", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    async def _events():
        if False:
            yield None

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="测试fallback", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body

    # Extract the done event data and verify it has proper fields
    for line in body.split("\n"):
        if line.startswith("data: ") and "event: done" in body[:body.index(line)]:
            data = json.loads(line[6:])
            assert data.get("id")
            assert data["role"] == "assistant"
            assert "content" in data
            assert "actions" in data
            assert "blocks" in data
            assert "tool_results" in data
            assert "created_at" in data
            break


async def test_send_chat_message_sends_done_with_error_when_persist_fails(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When persist_assistant_message fails in error path, SSE still sends done with fallback."""
    user = await create_user_account(session, "persist-fail@example.com", "user12345")
    work = await create_work(
        WorkIn(title="持久化失败", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: object | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool

    class Tool:
        def __init__(self, name: str, result: str | None = None) -> None:
            self.tool_name = name
            self.result = result

    async def _events():
        yield Event(RunEvent.run_content, content="部分内容")
        raise RuntimeError("agent crashed")

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    # Make session.commit fail after the first call (user message persist)
    original_commit = session.commit
    commit_count = 0

    async def _failing_commit():
        nonlocal commit_count
        commit_count += 1
        if commit_count > 1:
            raise RuntimeError("simulated DB failure")
        await original_commit()

    monkeypatch.setattr(session, "commit", _failing_commit)

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="测试持久化失败", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()

    # Verify done event is sent despite persist failure
    assert "event: done" in body

    # Extract and verify the done event has error info
    done_data = None
    lines = body.split("\n")
    for i, line in enumerate(lines):
        if line.strip() == "event: done" and i + 1 < len(lines) and lines[i + 1].startswith("data: "):
            done_data = json.loads(lines[i + 1][6:])
            break

    assert done_data is not None
    assert done_data.get("id")
    assert done_data["role"] == "assistant"
    assert done_data["content"] == "部分内容"
    assert done_data["error"] == "agent crashed"
    assert "actions" in done_data


async def test_send_chat_message_fallback_includes_actions_from_tool_results(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """When persist fails and fallback is used, actions are computed from tool_results."""
    user = await create_user_account(session, "fallback-actions@example.com", "user12345")
    work = await create_work(
        WorkIn(title="Fallback Actions", short_intro="", synopsis="", genre_tags=[], background_rules=""),
        user,
        session,
    )
    chat = await create_chat_session(work["id"], ChatSessionIn(), user, session)
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("100000")
    await session.commit()

    class Tool:
        def __init__(self, name: str, result: str | None = None) -> None:
            self.tool_name = name
            self.result = result

    class Event:
        def __init__(self, event: RunEvent, content: str | None = None, tool: Tool | None = None) -> None:
            self.event = event
            self.content = content
            self.tool = tool

    async def _events():
        yield Event(RunEvent.tool_call_started, tool=Tool("create_or_update_character"))
        yield Event(
            RunEvent.tool_call_completed,
            tool=Tool("create_or_update_character", '{"id":"c1","name":"角色"}'),
        )
        raise RuntimeError("crash after tool")

    monkeypatch.setattr(
        "app.services.agent_service.create_agent",
        lambda *args, **kwargs: SimpleNamespace(arun=lambda *a, **k: _events()),
    )

    # Make session.commit fail after the first call
    original_commit = session.commit
    commit_count = 0

    async def _failing_commit():
        nonlocal commit_count
        commit_count += 1
        if commit_count > 1:
            raise RuntimeError("simulated DB failure")
        await original_commit()

    monkeypatch.setattr(session, "commit", _failing_commit)

    active_model = (
        await session.execute(select(AiModel).where(AiModel.status == "active"))
    ).scalars().first()
    stream = await send_chat_message(
        chat["id"],
        ChatIn(message="测试actions", references=[], model_id=active_model.id),
        user,
        session,
    )
    body = b"".join([chunk async for chunk in stream.body_iterator]).decode()
    assert "event: done" in body

    # Extract done data
    done_data = None
    lines = body.split("\n")
    for i, line in enumerate(lines):
        if line.strip() == "event: done" and i + 1 < len(lines) and lines[i + 1].startswith("data: "):
            done_data = json.loads(lines[i + 1][6:])
            break

    assert done_data is not None
    # Verify actions are properly computed from tool_results
    assert len(done_data["actions"]) == 1
    assert done_data["actions"][0]["type"] == "save_character"
    assert done_data["actions"][0]["label"] == "创建/更新角色"
    assert done_data["error"] == "crash after tool"


async def test_confirm_verified_payment_renews_plan_and_handles_zero_credit_pack(
    session: AsyncSession,
) -> None:
    user = await create_user_account(session, "renew@example.com", "user12345")
    account = await ensure_point_account(session, user.id)
    existing_sub = UserSubscription(
        user_id=user.id,
        plan_id="old-plan",
        order_id="old-order",
        start_at=datetime.now(UTC) - timedelta(days=5),
        end_at=datetime.now(UTC) + timedelta(days=10),
        next_renew_at=datetime.now(UTC) + timedelta(days=10),
        daily_vip_points_snapshot=5,
        duration_days_snapshot=30,
        status="active",
    )
    session.add(existing_sub)
    await session.flush()
    old_end = existing_sub.end_at

    plan_order, plan_payment = await _make_paid_order_with_payment(
        session,
        user_id=user.id,
        product_type="plan",
        amount=Decimal("29.00"),
        daily_vip_points_snapshot=100,
        bundled_credit_pack_points_snapshot=50,
        duration_days_snapshot=31,
    )
    await confirm_verified_payment(
        session,
        plan_payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": plan_order.order_no, "total_amount": "29.00"},
        "TRADE-PLAN",
        expected_amount=Decimal("29.00"),
    )
    await session.commit()
    await session.refresh(account)
    await session.refresh(existing_sub)

    assert account.vip_daily_points_balance == Decimal("100")
    assert account.credit_pack_points_balance == Decimal("50")
    comparable_old_end = old_end if old_end.tzinfo is None else old_end.replace(tzinfo=None)
    assert existing_sub.end_at > comparable_old_end
    assert existing_sub.next_renew_at == existing_sub.end_at
    assert existing_sub.daily_vip_points_snapshot == 100

    no_bonus_order, no_bonus_payment = await _make_paid_order_with_payment(
        session,
        user_id=user.id,
        product_type="plan",
        amount=Decimal("9.00"),
        daily_vip_points_snapshot=0,
        bundled_credit_pack_points_snapshot=0,
        duration_days_snapshot=15,
    )
    await confirm_verified_payment(
        session,
        no_bonus_payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": no_bonus_order.order_no, "total_amount": "9.00"},
        "TRADE-NO-BONUS",
        expected_amount=Decimal("9.00"),
    )
    await session.commit()

    zero_pack_order, zero_pack_payment = await _make_paid_order_with_payment(
        session,
        user_id=user.id,
        product_type="credit_pack",
        amount=Decimal("1.00"),
        credit_pack_points_snapshot=0,
    )
    await confirm_verified_payment(
        session,
        zero_pack_payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": zero_pack_order.order_no, "total_amount": "1.00"},
        "TRADE-ZERO",
        expected_amount=Decimal("1.00"),
    )
    await session.commit()
    zero_pack_transactions = (
        await session.execute(select(func.count(PointTransaction.id)).where(PointTransaction.source_id == zero_pack_order.id))
    ).scalar_one()
    assert zero_pack_transactions == 0

    unknown_order, unknown_payment = await _make_paid_order_with_payment(
        session,
        user_id=user.id,
        product_type="custom",
        amount=Decimal("3.00"),
    )
    await confirm_verified_payment(
        session,
        unknown_payment,
        {"trade_status": "TRADE_SUCCESS", "out_trade_no": unknown_order.order_no, "total_amount": "3.00"},
        "TRADE-CUSTOM",
        expected_amount=Decimal("3.00"),
    )
    await session.commit()
    assert (await session.get(BillingOrder, unknown_order.id)).status == "paid"


async def test_admin_users_balance_preview_and_credit_transaction_time_filters(
    session: AsyncSession,
) -> None:
    admin = await _admin(session)
    user = await create_user_account(session, "admin-user@example.com", "user12345")
    account = await ensure_point_account(session, user.id)
    account.vip_daily_points_balance = Decimal("3")
    account.credit_pack_points_balance = Decimal("4")
    sub = UserSubscription(
        user_id=user.id,
        plan_id="plan-1",
        order_id="order-1",
        start_at=datetime.now(UTC) - timedelta(days=1),
        end_at=datetime.now(UTC) + timedelta(days=30),
        next_renew_at=datetime.now(UTC) + timedelta(days=30),
        daily_vip_points_snapshot=100,
        duration_days_snapshot=31,
        status="active",
    )
    session.add(sub)

    model = AiModel(
        display_name="成本模型",
        provider_model_id="cost-model",
        logic_score=3,
        prose_score=3,
        knowledge_score=3,
        max_context_tokens=32000,
        max_output_tokens=2048,
        temperature=Decimal("0.70"),
        input_cost_per_million=Decimal("1.00"),
        cache_hit_input_cost_per_million=Decimal("0.50"),
        output_cost_per_million=Decimal("2.00"),
        profit_multiplier=Decimal("1.10"),
        status="active",
    )
    session.add(model)
    await session.flush()
    user_without_account = routes_module.User(
        email="no-account@example.com",
        nickname="NoAccount",
        password_hash=routes_module.hash_password("user12345"),
    )
    session.add(user_without_account)
    await session.flush()

    tx1 = PointTransaction(
        user_id=user.id,
        bucket_type="vip_daily",
        change_type="grant",
        source_type="plan_vip_daily",
        points_delta=Decimal("10"),
        balance_after=Decimal("10"),
        created_at=datetime(2026, 5, 1, 9, 0, tzinfo=UTC),
    )
    tx2 = PointTransaction(
        user_id=user.id,
        bucket_type="credit_pack",
        change_type="grant",
        source_type="credit_pack",
        points_delta=Decimal("5"),
        balance_after=Decimal("15"),
        created_at=datetime(2026, 5, 1, 18, 0, tzinfo=UTC),
    )
    session.add_all([tx1, tx2])
    await session.commit()

    users_page = await admin_users(_admin=admin, session=session)
    item = next(entry for entry in users_page["items"] if entry["email"] == "admin-user@example.com")
    assert item["subscription"]["daily_vip_points_snapshot"] == 100
    assert item["points"]["credit_pack_points_balance"] == 4.0
    no_account_item = next(entry for entry in users_page["items"] if entry["email"] == "no-account@example.com")
    assert no_account_item["points"]["vip_daily_points_balance"] == 0

    session.add(
        UserSubscription(
            user_id=user.id,
            plan_id="plan-older",
            order_id="order-older",
            start_at=datetime.now(UTC) - timedelta(days=10),
            end_at=datetime.now(UTC) + timedelta(days=10),
            next_renew_at=datetime.now(UTC) + timedelta(days=10),
            daily_vip_points_snapshot=50,
            duration_days_snapshot=15,
            status="active",
        )
    )
    await session.commit()
    deduped_users_page = await admin_users(_admin=admin, session=session)
    deduped_item = next(entry for entry in deduped_users_page["items"] if entry["email"] == "admin-user@example.com")
    assert deduped_item["subscription"]["daily_vip_points_snapshot"] == 50
    assert (await admin_users(q="missing-user", _admin=admin, session=session))["items"] == []

    balance_result = await routes_module.admin_adjust_balance(
        user.id,
        AdminBalanceAdjustRequest(
            bucket_type="credit_pack",
            change_type="grant",
            amount=Decimal("6"),
            reason="补充",
        ),
        _admin=admin,
        session=session,
    )
    assert balance_result["points"]["credit_pack_points_balance"] == 10.0

    preview_loss = await admin_cost_preview(
        CostPreviewIn(
            model_id=model.id,
            daily_vip_points=100,
            bundled_credit_pack_points=5000,
            duration_days=31,
            price_amount=Decimal("1.00"),
        ),
        _admin=admin,
        session=session,
    )
    assert preview_loss["conclusion"]["credit_pack_exceeds_price"] is True
    assert "建议降至" in preview_loss["conclusion"]["warning"]

    preview_breakeven = await admin_cost_preview(
        CostPreviewIn(
            model_id=model.id,
            daily_vip_points=10,
            bundled_credit_pack_points=0,
            duration_days=31,
            price_amount=Decimal("50.00"),
        ),
        _admin=admin,
        session=session,
    )
    assert preview_breakeven["conclusion"]["breakeven_utilization"] is not None

    preview_without_price = await admin_cost_preview(
        CostPreviewIn(
            model_id=model.id,
            daily_vip_points=10,
            bundled_credit_pack_points=0,
            duration_days=31,
            price_amount=None,
        ),
        _admin=admin,
        session=session,
    )
    assert preview_without_price["scenarios"][0]["profit"] is None

    exact_break_even = await admin_cost_preview(
        CostPreviewIn(
            model_id=model.id,
            daily_vip_points=0,
            bundled_credit_pack_points=3125,
            duration_days=31,
            price_amount=Decimal("55.00"),
        ),
        _admin=admin,
        session=session,
    )
    assert exact_break_even["conclusion"]["warning"] == ""

    filtered = await admin_credit_transactions(
        time_from="2026-05-01T00:00:00",
        time_to="2026-05-01",
        _admin=admin,
        session=session,
    )
    assert filtered["total"] >= 2
    invalid = await admin_credit_transactions(
        time_from="not-a-date",
        time_to="still-not-a-date",
        _admin=admin,
        session=session,
    )
    assert invalid["total"] >= filtered["total"]

    aware = await admin_credit_transactions(
        time_from="2026-05-01T00:00:00+00:00",
        time_to="2026-05-01T23:59:00+00:00",
        _admin=admin,
        session=session,
    )
    assert aware["total"] >= filtered["total"]
