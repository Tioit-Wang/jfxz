import logging
from collections.abc import AsyncIterator

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.models import Base

logger = logging.getLogger(__name__)

engine = create_async_engine(get_settings().database_url, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def _drop_agent_sessions_if_invalid() -> None:
    """Drop the old agent_sessions table if it has an incompatible schema.

    Agn o's AsyncSqliteDb expects the full SESSION_TABLE_SCHEMA (15 columns),
    but a previous version of this project created the table with only 3 columns
    (session_id, user_id, runs) via the AgentSession model.  This mismatch causes
    agn o to raise ValueError on startup.

    We detect the old schema by checking for the presence of 'session_type' — a
    column that agn o requires but the old model never had.  If absent, we drop
    the table so that agn o can recreate it with the correct schema on first use.
    """
    async with engine.connect() as conn:
        exists = await conn.run_sync(
            lambda sync_conn: inspect(sync_conn).has_table("agent_sessions")
        )
        if not exists:
            return

        def has_session_type(sync_conn) -> bool:
            columns = {c["name"] for c in inspect(sync_conn).get_columns("agent_sessions")}
            return "session_type" in columns

        if not await conn.run_sync(has_session_type):
            logger.warning("Dropping agent_sessions table with incompatible schema")
            await conn.execute(text("DROP TABLE agent_sessions"))
            await conn.commit()


async def init_database() -> None:
    if get_settings().auto_create_tables:
        await _drop_agent_sessions_if_invalid()
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
