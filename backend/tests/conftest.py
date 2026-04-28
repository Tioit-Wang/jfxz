import os

os.environ.setdefault("JFXZ_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JFXZ_ENV", "test")
os.environ.setdefault("JFXZ_ENABLE_PAYMENT_SIMULATOR", "true")
# Prevent .env API keys from leaking into tests (pydantic reads .env file directly)
os.environ["JFXZ_AI_PROVIDER_API_KEY"] = ""
os.environ["JFXZ_DEEPSEEK_API_KEY"] = ""

from unittest.mock import MagicMock

import pytest_asyncio
from agno.run.agent import RunEvent
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.routes import create_user_account, seed_defaults
from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import hash_password, issue_token, read_token, verify_password
from app.main import create_app
from app.models import Base


class _FakeRunContentEvent:
    event = RunEvent.run_content
    content = "这是一个测试回复。"
    tool = None


class _FakeToolCallCompletedEvent:
    event = RunEvent.tool_call_completed
    content = None
    tool = MagicMock(tool_name="create_or_update_character")


class _FakeRunCompletedEvent:
    event = RunEvent.run_completed
    content = "这是一个测试回复。"
    metrics = MagicMock(
        input_tokens=100,
        output_tokens=50,
        cache_read_tokens=0,
    )


async def _fake_events():
    events = [_FakeRunContentEvent(), _FakeToolCallCompletedEvent(), _FakeRunCompletedEvent()]
    for event in events:
        yield event


def _fake_arun(message, *, stream=True, stream_events=True):
    return _fake_events()


def _create_mock_agent(*args, **kwargs):
    agent = MagicMock()
    agent.arun = _fake_arun
    return agent


@pytest_asyncio.fixture
async def client() -> AsyncClient:
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

    original_create_agent = _agent_service.create_agent

    _agent_service.create_agent = _create_mock_agent

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    _agent_service.create_agent = original_create_agent
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
