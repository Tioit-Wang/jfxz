# 妙蛙写作 (GoodGua) — Project Knowledge Base

**Generated:** 2026-05-11
**Commit:** c9b7ce2
**Branch:** master
**Stack:** Next.js 15 + FastAPI + SQLAlchemy 2.0 Async + Agno + MySQL 8

## OVERVIEW

妙蛙写作 is an AI-assisted long-form creative writing tool. Author-led, AI-assisted: the author makes creative decisions; the AI provides context-aware suggestions, analysis, and reference. Two personas: user-facing writing workspace (`/books/:bookId`) and admin panel (`/admin/*`).

## STRUCTURE

```
jfxz/
├── frontend/            # Next.js 15 (React 19, shadcn/ui, TipTap, Streamdown)
│   ├── app/             # App router: landing, /books, /admin, /login
│   └── src/             # Shared components, hooks, lib (api client, utils, domain)
├── backend/             # FastAPI + Uvicorn, Python 3.13
│   ├── app/
│   │   ├── api/         # All routes in routes.py (~3000 lines)
│   │   ├── core/        # config.py (Pydantic), database.py (SQLAlchemy async), security.py (JWT/argon2)
│   │   ├── services/    # agent_service.py (Agno), billing_service.py, scheduler_service.py, workspace_structure.py
│   │   ├── cli/         # Typer CLI: user & DB management
│   │   └── scripts/     # create_admin bootstrap
│   ├── migrations/      # Manual SQL migrations (MySQL dialect, immutable)
│   └── tests/           # pytest + pytest-asyncio (100% branch coverage required)
├── docs/                # Chinese-language requirements & design
├── docker-compose.yml   # 4 services: nginx, frontend, backend, worker
└── scripts/             # release_preflight.py
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `backend/app/api/routes.py` | Single-file routes; split when >500 lines |
| Add/modify database model | `backend/app/models.py` | All SQLAlchemy models in one file |
| Database schema change | `backend/migrations/versions/` | MUST read `docs/db-migration-spec.md` first |
| Change backend config | `backend/app/core/config.py` | `GOODGUA_` env prefix, Pydantic Settings |
| Add frontend page | `frontend/app/` | Next.js App Router; user routes under `/books`, admin under `/admin` |
| Shared UI component | `frontend/src/components/ui/` | shadcn/ui primitives |
| Admin CRUD page | `frontend/app/admin/<module>/` | Each module: page.tsx + actions |
| AI agent / tools | `backend/app/services/agent_service.py` | Agno Agent + GoodguaTools class + prompt template |
| Billing / points | `backend/app/services/billing_service.py` | Pre-check balance, deduct, grant, expire |
| Scheduled tasks | `backend/app/services/scheduler_service.py` | APScheduler: VIP daily points grant at 5:00 CST |
| Deployment | `docs/部署文档.md` | Docker Compose + 1Panel + OpenResty |

## LANGUAGE

- **文档与回复**：自然语言（需求文档、设计文档、AGENTS.md、AI 回复）统一使用简体中文。
- **代码注释**：函数注释、类注释、模块级注释使用中文。简洁说明意图，不写冗余。
- **代码标识符**：变量名、函数名、类名、文件名、数据库字段名、配置键名使用英文。
- **迁移文件**：迁移 SQL 注释使用英文（遵循 `docs/db-migration-spec.md` 模板），但文件名描述部分使用英文。
- **Git 提交信息**：使用中文，格式为 `类型: 简短描述`。

## CONVENTIONS

- **Timezone**: 
  - 前端：所有日期时间展示必须使用 `Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai" })`。涉及文件：`admin-utils.ts` 的 `formatDate()`、`BooksClient.tsx` 和 `WorkspaceClient.tsx` 的 `formatUpdatedAt()`。新增日期格式化函数时必须遵循同一规范。
  - 后端：数据库存储和 JWT token 使用 `datetime.now(UTC)`（`models.py` 的 `now()`、`security.py` 的 `issue_token()`）。业务日期逻辑（今日字数统计）使用 `ZoneInfo("Asia/Shanghai")`（`routes.py` 的 `beijing_today()`、`agent_service.py` 的 `SHANGHAI_TZ`）。调度器使用 `timezone="Asia/Shanghai"`（`scheduler_service.py`）。Docker 环境变量统一设 `TZ=Asia/Shanghai`。
- **Database migrations**: Any schema change → new SQL file in `backend/migrations/versions/`. Format: `YYYYMMDDHHMMSS__description.sql`. Historical files immutable. Production: manual execution only. Full spec: `docs/db-migration-spec.md`.
- **Environment**: `GOODGUA_ENV` = `development` | `test` | `production`. Dev/test → SQLite. Production → MySQL (`mysql+asyncmy://`).
- **Auth**: Single `users` table, `role` column (`user` | `admin`). Argon2 password hashing (legacy SHA-256 migration path). Custom HS256 JWT in `security.py` — no PyJWT dependency.
- **API**: Single `routes.py` file. CSRF via `X-CSRF-Token` header on mutating requests. `X-Real-IP` / `X-Forwarded-For` trusted proxy handling.
- **Frontend auth**: User-facing login/register via modal overlay (`AuthModal`), not separate page. Admin login: dedicated `/admin/login`.

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** modify or delete historical migration files
- **NEVER** use `IF EXISTS` / `IF NOT EXISTS` defensively in migration SQL
- **NEVER** depend on app startup to auto-create production tables (`GOODGUA_AUTO_CREATE_TABLES=false` in prod)
- **NEVER** use `*` in `GOODGUA_CORS_ORIGINS` in production
- **DO NOT** skip reading `docs/db-migration-spec.md` before touching models or schema
- **DO NOT** create standalone login/register pages for user-facing routes — use `AuthModal`
- **DO NOT** add features, abstractions, or refactors not requested
- **DO NOT** edit adjacent code or formatting when making surgical changes

## COMMANDS

```bash
# Backend (from backend/)
uv run uvicorn app.main:app --reload          # dev server (:8000)
uv run pytest -v                              # tests (100% branch coverage required)
uv run ruff check .                           # lint

# Frontend (from frontend/)
npm run dev                                   # dev server (:3000)
npm run build                                 # production build
npm run test                                  # vitest
npm run e2e                                   # playwright
npm run lint                                  # eslint
npm run typecheck                             # tsc --noEmit

# Docker
docker compose up -d --build                  # full stack
docker compose logs -f backend                # tail backend logs

# Release
python scripts/release_preflight.py --env-file .env.production
```

## NOTES

- Project codename: `goodgua` (internal), `妙蛙写作` (public)
- Worker container runs `python -m app.worker` — DB init, seeding, APScheduler VIP daily grant
- `agent_sessions` table managed by manual migrations, not Agno auto-create
- Coverage threshold: 100% branch coverage on backend
- `claude.md` contains behavioral coding guidelines (think before coding, simplicity first, surgical changes)
- `agents1.md` contains the `/init-deep` workflow template