# 部署场景 1：无 SQL 纯改动代码

> 当 git pull 的文件变更不涉及 `backend/migrations/versions/` 下的任何新文件时使用此场景。

## 适用条件

- git pull 输出中 **无** `backend/migrations/versions/` 路径下的新 `.sql` 文件
- 变更仅涉及 `frontend/**`、`backend/**`（不含 migrations）、`nginx.conf`、`docker-compose.yml` 等
- **数据库无需任何变更**

## 风险等级

**低** — 无数据库操作，仅替换容器镜像。主要风险来自 Docker COPY 缓存导致旧代码生效。

## 部署流程

### 第 1 步：检查本地代码状态

```bash
cd /c/Projects/jfxz && git log --oneline -5 && echo '===' && git status -sb
```

确认新提交已推送到 `origin/main`（`git status -sb` 不显示 ahead 即已推送）。如果显示 ahead，先 `git push origin main`。

### 第 2 步：服务器拉取代码

```bash
ssh -i "C:\Users\v_wyxgwang\.proma\agent-workspaces\default\workspace-files\gsgsg.pem" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && git pull origin main 2>&1"
```

**观察 pull 输出，判断变更范围：**

| 变更范围 | 构建目标 |
|---------|---------|
| 只有 `frontend/**` | 仅 frontend + nginx |
| 只有 `backend/**` | 仅 backend + worker |
| 两者都有 或 `nginx.conf` / `docker-compose.yml` | 全量 |

与部署文档流程不同，**此场景无 SQL 迁移步骤，直接从构建开始。**

### 第 3 步：构建镜像

> ⚠️ **必须加 `--no-cache`**，Docker COPY 层缓存不可靠。

**仅前端：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache frontend 2>&1 | tail -10"
```

**仅后端：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend 2>&1 | tail -10"
```

**全量：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend frontend 2>&1 | tail -10"
```

设置 timeout 600000ms（构建约 1-3 分钟）。

### 第 4 步：重启容器

**仅前端：** 必须同时重建 nginx（`NEXT_PUBLIC_*` 变量在构建时注入 JS bundle，nginx `proxy_pass` 可能因容器 IP 变动指向旧 upstream）
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production up -d --build frontend nginx 2>&1 | tail -12"
```

**仅后端：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production up -d --build backend worker 2>&1 | tail -12"
```

**全量：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production up -d --build backend worker frontend nginx 2>&1 | tail -12"
```

### 第 5 步：验证部署

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep goodgua && echo '---' && curl -s http://127.0.0.1:18081/api/health && echo '' && curl -s -o /dev/null -w 'HTTP %{http_code}, time: %{time_total}s\n' https://goodgua.net/api/health"
```

验证标准：
- 所有容器显示 `healthy`（nginx 可能短暂显示 `health: starting`，正常）
- 内网健康检查返回 `{"status":"ok","service":"goodgua"}`
- 外网健康检查返回 `HTTP 200`

**额外验证（仅此场景）：确认代码变更已在容器内生效**
```bash
# 替换 <keyword> 为本次修改的关键内容
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec goodgua-backend grep -n '<keyword>' /app/app/api/routes.py"
```

### 第 6 步：向用户汇报

```
部署完成。本次发布 N 个提交（纯代码变更，无数据库迁移）：
- hash1 简要描述（前端/后端）
- hash2 简要描述（前端/后端）

所有容器 healthy，内外网 API 正常。
```

## 安全红线

- **构建必须使用 `--no-cache`**，防止 Docker COPY 层缓存导致旧代码运行
- **前端代码变更加 nginx 重启** — `NEXT_PUBLIC_*` 环境变量在构建时注入，nginx 需重建以刷新 upstream
- 不要跳过健康检查，即使看起来没问题

## 异常处理

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| backend 持续 restarting | 环境变量为空 | 检查 `--env-file .env.production` 参数 |
| nginx 持续 health: starting | upstream 未就绪 | 先检查 backend/frontend 容器状态 |
| API 返回 502 | nginx upstream IP 变动 | 重建 nginx：`up -d --build nginx` |
| 旧代码行为仍在 | Docker COPY 缓存 | 重新 `build --no-cache` 并部署 |
