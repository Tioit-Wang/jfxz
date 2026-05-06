import logging
import logging.handlers
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import csrf_protect, router, seed_defaults
from app.core.config import get_settings
from app.core.database import SessionLocal, init_database

LOG_DIR = Path(__file__).resolve().parents[2] / "logs"
LOG_DIR.mkdir(exist_ok=True)


def setup_logging() -> None:
    """Configure logging: console + rotating file."""
    log_file = LOG_DIR / "backend.log"
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console handler (INFO+)
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(fmt)

    # File handler (DEBUG+)
    fh = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)

    root.handlers.clear()
    root.addHandler(console)
    root.addHandler(fh)

    # Quieter uvicorn/watchfiles noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.WARNING)


setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await init_database()
    async with SessionLocal() as session:
        await seed_defaults(session)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="JinFan Writing MVP", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
    )
    app.middleware("http")(csrf_protect)
    app.include_router(router)
    return app


app = create_app()
