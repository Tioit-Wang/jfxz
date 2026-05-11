# Backend — GoodGua FastAPI

**Stack:** FastAPI + SQLAlchemy 2.0 Async + Agno + APScheduler + MySQL 8 (prod) / SQLite (dev)

## OVERVIEW

Single FastAPI app serving all API routes. Runs alongside a separate Worker container for scheduled tasks (VIP daily points grant, DB seeding). All models in one file, all routes in one file.

## STRUCTURE

```
backend/
├── app/
│   ├── api/routes.py         # All endpoints (~3000 lines): auth, works, characters, settings, chapters, chat, billing, admin
│   ├── core/
│   │   ├── config.py         # Pydantic Settings, GOODGUA_ prefix, env validation
│   │   ├── database.py       # SQLAlchemy async engine, session factory, init_database
│   │   └── security.py       # Custom HS256 JWT (no PyJWT), argon2 password hashing
│   ├── services/
│   │   ├── agent_service.py  # Agno Agent creation, GoodguaTools, system prompt template
│   │   ├── billing_service.py # Balance pre-check, point deduction/grant/expire, admin adjust
│   │   ├── scheduler_service.py # APScheduler: VIP daily grant at 5:00 CST
│   │   └── workspace_structure.py # Volume/chapter ordering helpers
│   ├── models.py             # All SQLAlchemy models (~500 lines): User, Work, Character, Chapter, billing, etc.
│   ├── cli/                  # Typer CLI: goodgua user, goodgua db
│   ├── scripts/create_admin.py # Bootstrap admin user script
│   ├── main.py               # FastAPI app factory, CORS, CSRF middleware, lifespan
│   └── worker.py             # Worker entry point: DB init -> seed -> scheduler -> wait
├── migrations/versions/      # Manual SQL migration files (MySQL dialect, immutable)
├── tests/                    # pytest + pytest-asyncio (100% branch coverage)
└── pyproject.toml            # hatchling build, dependencies, ruff/pytest/coverage config
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add API endpoint | `app/api/routes.py` | Annotate with `# --- section label ---` comments |
| Add DB model | `app/models.py` | `uid()`, `now()`, `TimestampMixin`, `Base` available |
| DB migration | `migrations/versions/` | Read `docs/db-migration-spec.md` first; immutable files |
| Change config | `app/core/config.py` | `@field_validator`, `@model_validator`, `@property` helpers |
| Auth logic | `app/core/security.py` | `issue_token()`, `read_token()`, `verify_password()`, `hash_password()` |
| AI agent tools | `app/services/agent_service.py` | `GoodguaTools` class — add methods for new tool capabilities |
| Billing/points | `app/services/billing_service.py` | `pre_check_balance()`, `deduct_points()`, `grant_vip_daily_points()` |
| Scheduled task | `app/services/scheduler_service.py` | `daily_vip_grant_task()`; add new jobs via `scheduler.add_job()` |
| CLI command | `app/cli/` | Typer sub-apps: `user.py`, `db.py` |

## CONVENTIONS

- **All models in `models.py`**: Do not split into `models/` package. All SQLAlchemy `Base` subclasses in one file.
- **All routes in `routes.py`**: Organize by `# --- section ---` comments. Depends on `get_session` for DB, `get_current_user`/`get_current_admin` for auth.
- **Language**:
  - 代码注释使用中文：函数级、类级、模块级注释用简体中文，简洁说明意图。
  - 变量名、函数名、类名、文件名使用英文。
  - 日志消息：面向开发者的技术日志可用英文，面向运维的状态日志可用中文。
  - API 返回的错误消息（`detail` 字段）使用中文，面向最终用户。
- **Manual JWT**: Custom HS256 in `security.py`. Tokens include `sub`, `role`, `typ`, `iat`, `exp`, `jti`. No third-party JWT library.
- **Session types**: `user` token (24h default), `admin` token (2h default). CSRF token via `X-CSRF-Token` header required for mutating requests.
- **Database URLs**: Dev -> `sqlite+aiosqlite:///./goodgua-dev.db`. Test -> `sqlite+aiosqlite:///:memory:`. Prod -> `mysql+asyncmy://user:pass@host:3306/db`.
- **Migrations**: `YYYYMMDDHHMMSS__description.sql`. Header template with Version, Risk, Pre/Post-Checks. MySQL dialect. Expand-contract for risky changes.
- **Billing**: Points = `(tokens / 1M) * cost_per_million * profit_multiplier * points_per_cny`. Deduct from `vip_daily` first, then `credit_pack`. Rounded up to 0.01.

## ANTI-PATTERNS

- **NEVER** let Agno auto-create `agent_sessions` in production — table managed by manual migration
- **NEVER** use `sqlite+aiosqlite` in migration files — write MySQL dialect
- **DO NOT** add new model files outside `models.py` without explicit decision
- **DO NOT** split `routes.py` into modules without team agreement — single file is intentional

## COMMANDS

```bash
uv run uvicorn app.main:app --reload     # dev
uv run pytest -v --cov=app               # tests (100% branch required)
uv run ruff check .                      # lint
python -m app.cli user create-admin      # create admin user
python -m app.worker                     # run worker locally
```