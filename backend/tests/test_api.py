import os
from collections.abc import AsyncIterator

os.environ["JFXZ_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JFXZ_ENV"] = "test"
os.environ["JFXZ_ENABLE_PAYMENT_SIMULATOR"] = "true"
os.environ["JFXZ_DEEPSEEK_API_KEY"] = ""
os.environ["JFXZ_AI_PROVIDER_API_KEY"] = ""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import create_user_account, seed_defaults
from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import hash_password, issue_token, read_token, verify_password
from app.main import create_app
from app.models import Base
from conftest import _create_mock_agent


async def _noop_coro_none(*args, **kwargs):
    return None


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with maker() as session:
        await seed_defaults(session)
        await create_user_account(session, "admin@example.com", "admin12345", role="admin")
        await session.commit()

    async def override_session():
        async with maker() as session:
            yield session

    import app.services.agent_service as _agent_service
    import app.api.routes as _routes

    original_create_agent = _agent_service.create_agent
    original_resolve_editor = _routes._resolve_editor_model
    _agent_service.create_agent = _create_mock_agent
    _routes._resolve_editor_model = _noop_coro_none

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    _agent_service.create_agent = original_create_agent
    _routes._resolve_editor_model = original_resolve_editor
    await engine.dispose()


async def auth_headers(client: AsyncClient, email: str = "writer@example.com") -> dict[str, str]:
    response = await client.post(
        "/auth/register", json={"email": email, "nickname": "Writer", "password": "user12345"}
    )
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


async def create_work(client: AsyncClient, headers: dict[str, str]) -> str:
    response = await client.post(
        "/works",
        headers=headers,
        json={
            "title": "雾港纪事",
            "short_intro": "港城故事",
            "synopsis": "灯塔异常",
            "genre_tags": ["奇幻"],
            "background_rules": "潮汐会记账",
        },
    )
    assert response.status_code == 200
    return response.json()["id"]
    response = await client.post("/works", headers=headers, json={})
    assert response.status_code == 200
    assert response.json()["title"] == "未命名作品"


async def test_auth_me_and_work_crud(client: AsyncClient) -> None:
    assert (await client.get("/health")).json()["status"] == "ok"
    headers = await auth_headers(client)
    assert (await client.get("/me", headers=headers)).json()["user"]["email"] == "writer@example.com"
    assert (await client.patch("/me", headers=headers, json={"nickname": "New"})).json()["nickname"] == "New"
    work_id = await create_work(client, headers)
    assert len((await client.get("/works", headers=headers)).json()) == 1
    assert (await client.get(f"/works/{work_id}", headers=headers)).json()["title"] == "雾港纪事"
    patched = await client.patch(
        f"/works/{work_id}",
        headers=headers,
        json={
            "title": "新雾港",
            "short_intro": "短",
            "synopsis": "梗概",
            "genre_tags": ["悬疑"],
            "background_rules": "规则",
        },
    )
    assert patched.json()["title"] == "新雾港"
    assert (await client.delete(f"/works/{work_id}", headers=headers)).json() == {"ok": True}


async def test_character_setting_chapter_and_analysis(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    work_id = await create_work(client, headers)
    character = (
        await client.post(
            f"/works/{work_id}/characters",
            headers=headers,
            json={"name": "林昼", "summary": "灯塔看守", "detail": "怕潮声"},
        )
    ).json()
    assert (await client.get(f"/works/{work_id}/characters?q=林", headers=headers)).json()[0]["name"] == "林昼"
    updated_character = (
        await client.patch(
            f"/works/{work_id}/characters/{character['id']}",
            headers=headers,
            json={"name": "林夜", "summary": "改名", "detail": "仍怕潮声"},
        )
    ).json()
    assert updated_character["name"] == "林夜"

    setting = (
        await client.post(
            f"/works/{work_id}/settings",
            headers=headers,
            json={"name": "雾灯", "summary": "港口设备", "detail": "三闪为警", "type": "equipment"},
        )
    ).json()
    assert (await client.get(f"/works/{work_id}/settings?type=equipment", headers=headers)).json()[0]["name"] == "雾灯"
    assert (
        await client.patch(
            f"/works/{work_id}/settings/{setting['id']}",
            headers=headers,
            json={"name": "灯塔", "summary": "地点", "detail": "旧塔", "type": "location"},
        )
    ).json()["type"] == "location"

    chapters = (await client.get(f"/works/{work_id}/chapters", headers=headers)).json()
    assert chapters[0]["order_index"] == 1
    chapter = (
        await client.post(
            f"/works/{work_id}/chapters",
            headers=headers,
            json={"title": "第二章", "content": "潮汐退去", "summary": "退潮"},
        )
    ).json()
    assert chapter["order_index"] == 2
    assert (
        await client.patch(
            f"/works/{work_id}/chapters/{chapter['id']}",
            headers=headers,
            json={"title": "第二章 潮", "content": "潮汐回来", "summary": "涨潮", "order_index": 2},
        )
    ).json()["title"] == "第二章 潮"
    assert (await client.post(f"/works/{work_id}/analyze", headers=headers, json={"content": ""})).json() == {
        "suggestions": []
    }
    products = (await client.get("/billing/products")).json()
    order = (
        await client.post(
            "/billing/orders",
            headers=headers,
            json={"product_type": "credit_pack", "product_id": products["credit_packs"][0]["id"]},
        )
    ).json()
    await client.post(f"/billing/orders/{order['id']}/simulate-paid", headers=headers)
    response = await client.post(f"/works/{work_id}/analyze", headers=headers, json={"content": "她看见灯塔。"})
    assert response.json()["suggestions"]
    assert (await client.delete(f"/works/{work_id}/chapters/{chapter['id']}", headers=headers)).json()["ok"]
    assert (await client.delete(f"/works/{work_id}/settings/{setting['id']}", headers=headers)).json()["ok"]
    assert (await client.delete(f"/works/{work_id}/characters/{character['id']}", headers=headers)).json()["ok"]


async def test_billing_chat_and_admin(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    admin = await admin_headers(client)
    work_id = await create_work(client, headers)
    products = (await client.get("/billing/products")).json()
    order = (
        await client.post(
            "/billing/orders",
            headers=headers,
            json={"product_type": "plan", "product_id": products["plans"][0]["id"]},
        )
    ).json()
    assert order["status"] == "qr_created"
    paid = (await client.post(f"/billing/orders/{order['id']}/simulate-paid", headers=headers)).json()
    assert paid["status"] == "paid"
    assert (await client.post(f"/billing/orders/{order['id']}/simulate-paid", headers=headers)).json()["status"] == "paid"
    assert (await client.get(f"/billing/orders/{order['id']}", headers=headers)).json()["id"] == order["id"]

    chat = (
        await client.post(
            f"/works/{work_id}/chat-sessions",
            headers=headers,
            json={"title": "讨论第一章", "source_type": "editor"},
        )
    ).json()
    assert (await client.get(f"/works/{work_id}/chat-sessions", headers=headers)).json()[0]["title"] == "讨论第一章"
    stream = await client.post(
        f"/chat-sessions/{chat['id']}/messages",
        headers=headers,
        json={
            "message": "让 @苏白 和 @苏白 第二次更犹豫",
            "mentions": [
                {"type": "character", "id": "p1", "label": "苏白", "start": 2, "end": 5},
                {"type": "character", "id": "p1", "label": "苏白", "start": 8, "end": 11},
            ],
            "references": [{"type": "character", "id": "p1", "name": "苏白"}],
        },
    )
    assert "data:" in stream.text
    assert "event: done" in stream.text
    messages = (await client.get(f"/chat-sessions/{chat['id']}/messages", headers=headers)).json()
    assert [message["role"] for message in messages["messages"]] == ["user", "assistant"]
    assert len(messages["messages"][0]["mentions"]) == 2
    assert messages["messages"][0]["references"] == [{"type": "character", "id": "p1", "name": "苏白"}]
    assert messages["messages"][1]["actions"]

    assert (await client.get("/admin/users?q=writer", headers=admin)).json()["items"]
    assert (await client.patch("/admin/users/" + paid["user_id"], headers=admin, json={"status": "active"})).json()[
        "status"
    ] == "active"
    assert (await client.get("/admin/users/" + paid["user_id"], headers=admin)).json()["points"][
        "vip_daily_points_balance"
    ] > 0
    public_models = (await client.get("/ai/models", headers=headers)).json()
    assert [item["display_name"] for item in public_models] == ["DeepSeek-v4-flash", "DeepSeek-v4-pro"]
    assert "provider_model_id" not in public_models[0]
    models_page = (await client.get("/admin/models?q=DeepSeek&status=active", headers=admin)).json()
    assert models_page["total"] == 2
    new_model_payload = {
        "display_name": "测试模型",
        "provider_model_id": "test-model",
        "description": "用于后台测试",
        "logic_score": 4,
        "prose_score": 3,
        "knowledge_score": 5,
        "max_context_tokens": 32000,
        "max_output_tokens": 2048,
        "temperature": "0.80",
        "cache_hit_input_multiplier": "0.10",
        "cache_miss_input_multiplier": "0.20",
        "output_multiplier": "0.30",
        "status": "inactive",
        "sort_order": 9,
    }
    created_model = (await client.post("/admin/models", headers=admin, json=new_model_payload)).json()
    assert created_model["provider_model_id"] == "test-model"
    new_model_payload["status"] = "active"
    updated_model = (
        await client.patch(f"/admin/models/{created_model['id']}", headers=admin, json=new_model_payload)
    ).json()
    assert updated_model["status"] == "active"
    filtered_models = (
        await client.get(
            "/admin/models?logic_min=4&logic_max=4"
            "&context_min=30000&context_max=33000&output_min=2000&output_max=2100&page=1&page_size=10",
            headers=admin,
        )
    ).json()
    assert filtered_models["items"][0]["id"] == created_model["id"]
    assert (await client.get("/admin/products", headers=admin)).json()["plans"]
    new_plan = (
        await client.post(
            "/admin/products/plans",
            headers=admin,
            json={
                "name": "测试套餐",
                "price_amount": "9.00",
                "monthly_points": 10,
                "bundled_topup_points": 1,
                "status": "inactive",
            },
        )
    ).json()
    assert (
        await client.patch(
            f"/admin/products/plans/{new_plan['id']}",
            headers=admin,
            json={
                "name": "测试套餐2",
                "price_amount": "10.00",
                "monthly_points": 11,
                "bundled_topup_points": 2,
                "status": "active",
            },
        )
    ).json()["status"] == "active"
    assert (await client.get("/admin/orders", headers=admin)).json()["items"]
    assert (await client.get(f"/admin/orders/{order['id']}", headers=admin)).json()["payments"]
    assert (await client.get("/admin/subscriptions", headers=admin)).json()["items"]
    assert (await client.get("/admin/sessions?q=讨论", headers=admin)).json()["items"]
    assert (await client.get(f"/admin/sessions/{chat['id']}", headers=admin)).json()["agent"]["runs"]
    configs = (await client.get("/admin/configs?group=payment.alipay_f2f", headers=admin)).json()["items"]
    secret = next(item for item in configs if item["value_type"] == "secret")
    assert (
        await client.patch(
            f"/admin/configs/{secret['id']}", headers=admin, json={"string_value": "real-secret"}
        )
    ).json()["string_value"] == "******"
    masked = (await client.get("/admin/configs?group=payment.alipay_f2f", headers=admin)).json()["items"]
    assert next(item for item in masked if item["id"] == secret["id"])["string_value"] == "******"


async def test_error_paths(client: AsyncClient) -> None:
    headers = await auth_headers(client)
    other = await auth_headers(client, "other@example.com")
    admin = await admin_headers(client)
    client.cookies.clear()
    assert (await client.get("/me")).status_code == 401
    assert (await client.get("/me", headers={"Authorization": "Bearer bad"})).status_code == 401
    assert (await client.get("/admin/users", headers=headers)).status_code == 401
    assert (
        await client.post("/admin/login", json={"email": "admin@example.com", "password": "wrong12345"})
    ).status_code == 401
    work_id = await create_work(client, headers)
    assert (await client.get(f"/works/{work_id}", headers=other)).status_code == 404
    assert (
        await client.post("/billing/orders", headers=headers, json={"product_type": "bad", "product_id": "x"})
    ).status_code == 400
    products = (await client.get("/billing/products")).json()
    order = (
        await client.post(
            "/billing/orders",
            headers=headers,
            json={"product_type": "credit_pack", "product_id": products["credit_packs"][0]["id"]},
        )
    ).json()
    assert (await client.get(f"/billing/orders/{order['id']}", headers=other)).status_code == 404
    no_points = await auth_headers(client, "no-points@example.com")
    no_points_work = await create_work(client, no_points)
    chat = (await client.post(f"/works/{no_points_work}/chat-sessions", headers=no_points, json={})).json()
    assert (
        await client.post(
            f"/chat-sessions/{chat['id']}/messages", headers=no_points, json={"message": "hi", "references": []}
        )
    ).status_code == 402
    assert (
        await client.post("/admin/products/unknown", headers=admin, json={"name": "x", "price_amount": "1.00"})
    ).status_code == 400


def test_security_helpers() -> None:
    password_hash = hash_password("secret")
    assert verify_password("secret", password_hash)
    assert not verify_password("bad", password_hash)
    token = issue_token("user-id", "admin", "key")
    assert read_token(token, "key")[:2] == ("user-id", "admin")
    assert read_token("broken", "key") is None
    assert read_token(token, "other-key") is None
