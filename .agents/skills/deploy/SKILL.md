---
name: deploy
description: 将最新代码部署到 GoodGua 生产服务器。自动检测变更范围（前端/后端/全量），执行 git pull、Docker 构建重建、健康检查验证。触发词：发布、部署、deploy、上线、更新服务器、推到线上、发布到生产、继续发布。当用户说"发布"或"继续发布"时必须使用此 Skill。
---

# GoodGua 生产环境部署

## 服务器信息

- **SSH**: `ssh -i <PEM_KEY> root@43.134.97.85`
- **PEM Key**: `C:\Projects\jfxz\server.pem`
- **项目目录（本地）**: `C:\Projects\jfxz`（Bash 路径：`/c/Projects/jfxz`）
- **项目目录（服务器）**: `/opt/jfxz`
- **环境变量**: `--env-file .env.production`（每次 docker compose 命令都必须带）

## 架构概览

```
外网 → Cloudflare (CDN/SSL) → 1Panel → OpenResty (反代) → Docker nginx → Docker backend (FastAPI)
                                                              → Docker frontend (Next.js)
                                                              → Docker worker (后台任务)
                                                    MySQL 8 (1Panel 管理)
```

**关键超时配置**（排查过的问题）：

| 层级 | 配置项 | 值 | 原因 |
|------|--------|-----|------|
| Cloudflare | 默认超时 | ~100s（Free/Pro） | SSE 流式有数据不会断 |
| OpenResty | `proxy_read_timeout` | 600s | `/www/sites/goodgua.net/proxy/root.conf` |
| Docker nginx | `proxy_read_timeout` | 600s | `/opt/jfxz/nginx.conf` |
| Docker nginx | `proxy_buffering` | off | SSE 流式必须关闭缓冲 |

## 容器拓扑

| 容器名 | 端口 | 网络 | 说明 |
|--------|------|------|------|
| goodgua-nginx | 127.0.0.1:18081→80 | app-network | 反代到 frontend/backend |
| goodgua-frontend | 3000（内部） | app-network | Next.js standalone |
| goodgua-backend | 8000（内部） | app-network + 1panel-network | FastAPI |
| goodgua-worker | 8000（内部） | app-network + 1panel-network | APScheduler 后台任务 |
| 1Panel-openresty-uUMU | 80/443 | host | 1Panel 管理的反代 |
| 1Panel-mysql-Nbze | 3306 | 1panel-network | MySQL 8 |

## 服务器项目目录结构

```
/opt/jfxz/
├── docker-compose.yml          # 容器编排
├── nginx.conf                  # Docker 内 nginx 配置（bind mount 到容器）
├── .env.production             # 生产环境变量（敏感，gitignore）
├── .env.production.example     # 环境变量模板（版本控制）
├── backend/                    # FastAPI 后端
│   ├── Dockerfile
│   ├── migrations/versions/    # SQL 迁移文件
│   └── app/
├── frontend/                   # Next.js 前端
│   ├── Dockerfile
│   └── app/
└── docs/                       # 项目文档
```

## SSH 命令模板

所有远程操作通过 SSH 执行，基础格式：
```bash
ssh -i "C:\Projects\jfxz\server.pem" -o StrictHostKeyChecking=no root@43.134.97.85 "<command>"
```

## .env.production 配置参考

`.env.production` 位于 `/opt/jfxz/.env.production`，已在 `.gitignore` 中排除。

```bash
# ---- 前端 ----
NEXT_PUBLIC_API_BASE_URL=https://goodgua.net/api
NEXT_PUBLIC_ENABLE_TEST_PAYMENT=false

# ---- 后端基础 ----
GOODGUA_ENV=production
GOODGUA_DATABASE_URL=mysql+asyncmy://goodgua:<password>@mysql:3306/goodgua
GOODGUA_JWT_SECRET=<secret>
GOODGUA_AUTO_CREATE_TABLES=false
GOODGUA_CORS_ORIGINS=https://goodgua.net
GOODGUA_USER_SESSION_SECONDS=86400
GOODGUA_ADMIN_SESSION_SECONDS=7200
GOODGUA_TRUSTED_PROXY_IPS=127.0.0.1,172.16.0.0/12,192.168.0.0/16

# ---- AI Provider ----
GOODGUA_AI_PROVIDER_BASE_URL=https://platform.aimom.net/v1
GOODGUA_AI_PROVIDER_API_KEY=<key>

# ---- 初始管理员（可选，仅在首次部署时使用）----
GOODGUA_BOOTSTRAP_ADMIN_EMAIL=
GOODGUA_BOOTSTRAP_ADMIN_PASSWORD=
```

注意事项：
- `GOODGUA_CORS_ORIGINS` 必须设为 `https://goodgua.net`（HTTPS），与 Cloudflare SSL 匹配，不可含 `*`
- CSRF cookie 在生产环境自动启用 `Secure` + `SameSite=Lax`
- `GOODGUA_AUTO_CREATE_TABLES=false` — 生产环境通过 SQL 迁移建表
- `GOODGUA_AI_PROVIDER_API_KEY` 为空时 AI 对话返回 503

---

## 场景选择与部署流程

发布流程的第一步是**判断本次变更属于哪个部署场景**，然后按对应场景的文档执行。

### 公共步骤（所有场景通用）

**第 1 步：检查本地代码状态**

```bash
cd /c/Projects/jfxz && git log --oneline -5 && echo '===' && git status -sb
```

确认有新提交已推送到 `origin/main`（`git status -sb` 不显示 ahead 即表示已推送）。如果显示 ahead，先 `git push origin main`。

**第 2 步：服务器拉取代码**

```bash
ssh ... "cd /opt/jfxz && git pull origin main 2>&1"
```

注意：如果 `.env.production` 有本地修改且需要保留，先 stash：
```bash
git stash && git pull origin main && git stash pop
```

**第 3 步：判断场景**

观察 `git pull` 输出中的文件变更列表：

| pull 输出特征 | 场景 | 风险 | 文档 |
|---------------|------|------|------|
| `backend/migrations/versions/` **无**新 `.sql` 文件 | **场景 1：无 SQL 纯改动代码** | 低 | `scenario-01-code-only.md` |
| `backend/migrations/versions/` 有新 `.sql`，且仅含 INSERT 语句 | **场景 2：有 SQL 但为数据插入** | 中低 | `scenario-02-data-insert.md` |
| `backend/migrations/versions/` 有新 `.sql`，且含 DDL（ALTER/CREATE TABLE 等） | **场景 3：有 SQL 为表字段迁移** | 高 | `scenario-03-schema-migration.md` |

判断方法：
```bash
# 列出本次 pull 新增的迁移文件
ssh ... "ls -lt /opt/jfxz/backend/migrations/versions/ | head -5"

# 查看最新迁移文件的内容，判断是 INSERT 型还是 DDL 型
ssh ... "cat /opt/jfxz/backend/migrations/versions/<最新文件名>.sql"
```

- 文件内容以 `INSERT INTO` 为主 → **场景 2**
- 文件内容包含 `ALTER TABLE`、`CREATE TABLE`、`ADD COLUMN` → **场景 3**
- 无新文件 → **场景 1**

### 按场景执行

根据判断结果打开对应的场景文档执行后续步骤：

| 场景 | 后续步骤 |
|------|---------|
| [场景 1：无 SQL 纯改动代码](scenario-01-code-only.md) | 构建 → 重启 → 验证 |
| [场景 2：有 SQL 但为数据插入](scenario-02-data-insert.md) | 执行 INSERT → （构建）→ 重启 → 验证 |
| [场景 3：有 SQL 为表字段迁移](scenario-03-schema-migration.md) | 审阅 SQL → 执行迁移 → 构建 → 重启 → 验证 |

### 验证与汇报（所有场景通用）

部署完成后按对应场景文档的"验证部署"和"向用户汇报"步骤执行。验证标准：
- 所有容器显示 `healthy`（nginx 可能短暂显示 `health: starting`，正常）
- 内网健康检查返回 `{"status":"ok","service":"goodgua"}`
- 外网健康检查返回 `HTTP 200`

---

## 配置修改后需要做什么

> 以下所有 `docker compose` 命令均需加 `--env-file .env.production`。所有涉及 `--build` 的操作都必须加 `--no-cache`。

| 修改的文件 | 需要执行 |
|-----------|---------|
| `.env.production` | `docker compose --env-file .env.production up -d`（不 build，然后验证环境变量） |
| `nginx.conf` | `docker compose --env-file .env.production up -d --build nginx` |
| `backend/app/**` | `docker compose --env-file .env.production build --no-cache backend && docker compose --env-file .env.production up -d backend worker` |
| `frontend/**` | `docker compose --env-file .env.production build --no-cache frontend && docker compose --env-file .env.production up -d frontend nginx` |
| `docker-compose.yml` | `docker compose --env-file .env.production build --no-cache && docker compose --env-file .env.production up -d` |
| SQL 迁移文件 | 手动执行 SQL，然后 `docker compose --env-file .env.production restart backend` |

注意：修改 `nginx.conf` 后，`restart` 可能因 Docker bind mount 缓存而不生效，建议用 `up -d --build nginx`（会 recreate 容器）。

---

## 常见问题排查

### 部署后 backend 持续重启（环境变量为空）

**症状**：backend/worker 容器持续 `Restarting`，日志报 `ValueError: GOODGUA_DATABASE_URL is required in production`

**根因**：`docker compose` 执行时未加 `--env-file .env.production`，导致变量解析为空。

**验证**：
```bash
docker inspect goodgua-backend --format '{{range .Config.Env}}{{println .}}{{end}}' | grep GOODGUA_DATABASE_URL
# 输出为 GOODGUA_DATABASE_URL= 即表示未正确注入
```

**修复**：`docker compose --env-file .env.production up -d`

### 代码修改后构建未生效（Docker COPY 缓存）

**症状**：改了代码，build + up 后旧行为仍在。

**修复**：加 `--no-cache` 重新构建。验证：`docker exec goodgua-backend grep -n '关键词' /app/app/api/routes.py`

### API 返回 422 校验错误

FastAPI/Pydantic 请求体验证失败。常见：`message` 字段超长、必填字段缺失、类型不匹配。

```bash
curl -s -X POST https://goodgua.net/api/chat-sessions/{id}/messages \
  -H 'Content-Type: application/json' -d '{"message":"test"}' | head -200
```

### API 超时 / SSE 流中断

**症状**：聊天接口超时，后端日志出现 `CancelledError` 和 `Not connected`。

**根因**：Docker nginx 未加载最新 nginx.conf，`proxy_read_timeout` 使用默认 60s。

**修复**：`docker compose restart nginx` 或 `docker compose up -d --build nginx`

**验证**：`docker exec goodgua-nginx cat /etc/nginx/conf.d/default.conf | grep 'proxy_read_timeout'` → 必须输出 600s

### 数据库连接错误

`sqlalchemy.exc.InterfaceError: (0, 'Not connected')` — 通常是上游超时断开后的级联错误，先检查超时配置。排除后检查 MySQL 容器状态和网络连通性。

### 前端构建失败

Next.js 生产构建默认不因 lint 警告而失败。内存不足时调整 Dockerfile 中的 `NODE_OPTIONS=--max-old-space-size=4096`。

### AI 对话返回 503

检查 `.env.production` 中 `GOODGUA_AI_PROVIDER_API_KEY` 是否设置且非空。

### nginx 健康检查失败

`docker logs goodgua-nginx --tail 20`，常见原因：nginx.conf 语法错误（`docker exec goodgua-nginx nginx -t`）或 upstream 容器未就绪。

### 健康检查失败速查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| backend 持续 restarting | 环境变量为空 / 安装依赖失败 | 检查 `--env-file` 参数，`docker logs` 查看报错 |
| nginx 持续 health: starting | backend/frontend 未就绪 | 先检查 upstream 容器状态 |
| API 返回 502 | nginx 指向错误的 upstream IP | 重建 nginx：`docker compose up -d --build nginx` |
| curl 内网成功但外网失败 | Cloudflare / OpenResty 配置问题 | 检查 1Panel 面板的反代设置 |

---

## 回滚

### 回滚到上一个提交

```bash
cd /opt/jfxz
git log --oneline -10
git revert <bad-commit-hash>
git push origin main
docker compose --env-file .env.production build --no-cache
docker compose --env-file .env.production up -d
```

### 仅回滚容器镜像

代码没变、只是配置问题：
```bash
git checkout HEAD -- docker-compose.yml nginx.conf
docker compose --env-file .env.production up -d --build
```

如果之前通过 `sed` 直接修改过文件，`git checkout` 会丢失修改，先 `git diff --stat` 确认。

---

## 安全注意事项

1. **`.env.production` 不入库** — `.gitignore` 已排除 `.env` 和 `.env.*`
2. **密钥轮换** — 修改 JWT_SECRET 会使所有已登录用户会话失效，需要在低峰期操作
3. **数据库操作** — 迁移 SQL 必须在非生产库先验证语法
4. **1Panel 反代配置** — 修改 OpenResty 配置通过 1Panel 面板操作，不要直接改容器内文件
5. **SSH 密钥管理** — `.pem` 文件不要提交到版本控制，权限应为 600
6. **CSRF 防护** — 生产环境自动启用 `Secure` + `SameSite=Lax` cookie，`GOODGUA_CORS_ORIGINS` 不可含 `*`

---

## 用户管理（CLI）

通过 Docker 内 CLI 管理用户账号：

```bash
# 创建普通用户（指定密码）
ssh ... "docker exec goodgua-backend python -m app.cli user create <email> -p '<password>'"

# 创建管理员
ssh ... "docker exec goodgua-backend python -m app.cli user create-admin <email>"

# 列出用户
ssh ... "docker exec goodgua-backend python -m app.cli user list"

# 查看用户详情
ssh ... "docker exec goodgua-backend python -m app.cli user get <id|email>"

# 重置密码
ssh ... "docker exec goodgua-backend python -m app.cli user reset-password <id|email> -p '<new_password>'"

# 修改状态（active/suspended）
ssh ... "docker exec goodgua-backend python -m app.cli user set-status <id|email> <active|suspended>"
```
