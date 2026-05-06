"""Worker entry point: database init, seed data, and background scheduler.

Runs as a separate container alongside the API. Handles all one-time
initialization and periodic tasks so the API process stays single-worker.
"""

import asyncio
import logging
import sys

from app.core.database import SessionLocal, init_database
from app.api.routes import seed_defaults
from app.services.scheduler_service import start_scheduler

logger = logging.getLogger("worker")


def setup_logging() -> None:
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(fmt)
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.handlers.clear()
    root.addHandler(console)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)


async def main() -> None:
    setup_logging()
    logger.info("Worker starting: initializing database")
    await init_database()
    async with SessionLocal() as session:
        await seed_defaults(session)
    logger.info("Worker starting scheduler")
    start_scheduler(SessionLocal)
    logger.info("Worker ready, waiting for tasks")
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
