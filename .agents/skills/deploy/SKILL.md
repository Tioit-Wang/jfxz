---
name: deploy
description: 将最新代码部署到 GoodGua 生产服务器。自动检测变更范围（前端/后端/全量），执行 git pull、Docker 构建重建、健康检查验证。触发词：发布、部署、deploy、上线、更新服务器、推到线上、发布到生产。当用户说"发布"或"继续发布"时必须使用此 Skill。
---

# GoodGua 生产环境部署

## 服务器信息

- **SSH**: `ssh -i <PEM_KEY> root@43.134.97.85`
- **PEM Key**: `C:\Users\v_wyxgwang\.proma\agent-workspaces\default\workspace-files\gsgsg.pem`
- **项目目录**: `/opt/jfxz`
- **环境变量**: `--env-file .env.production`（每次 docker compose 命令都必须带）
- **部署文档**: `C:\Users\v_wyxgwang\.proma\agent-workspaces\default\workspace-files\.context\server-deployment-guide.md`

## SSH 命令模板

所有远程操作通过 SSH 执行，基础格式：
```bash
ssh -i "C:\Users\v_wyxgwang\.proma\agent-workspaces\default\workspace-files\gsgsg.pem" -o StrictHostKeyChecking=no root@43.134.97.85 "<command>"
```

本地 Git 操作在 `C:\Projects\jfxz` 目录下执行（Bash 路径：`/c/Projects/jfxz`）。

## 部署流程

### 第 1 步：检查本地代码状态

```bash
cd /c/Projects/jfxz && git log --oneline -5 && echo '===' && git status -sb
```

确认有新提交已推送到 `origin/main`（`git status -sb` 不显示 ahead 即表示已推送）。

### 第 2 步：服务器拉取代码

```bash
ssh ... "cd /opt/jfxz && git pull origin main 2>&1"
```

观察 pull 输出中的文件变更列表，判断变更范围：
- 只有 `frontend/**` → 仅构建 frontend
- 只有 `backend/**` → 仅构建 backend + worker
- 两者都有 → 构建全部

### 第 3 步：检查 SQL 迁移

如果 pull 输出包含 `backend/migrations/versions/` 下的新文件，需要先执行迁移：
```bash
ssh ... "docker exec -i 1Panel-mysql-Nbze mysql -u<user> -p<password> <database> < /opt/jfxz/backend/migrations/versions/XXX.sql"
```

无新迁移文件则跳过此步。

### 第 4 步：构建镜像

**必须加 `--no-cache`**，Docker COPY 层缓存不可靠。

**仅前端：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache frontend 2>&1 | tail -10"
```

**仅后端：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend 2>&1 | tail -10"
```

**全量：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend frontend 2>&1 | tail -10"
```

构建可能需要 1-3 分钟（前端较慢），设置 timeout 600000ms。

### 第 5 步：重启容器

根据变更范围重启对应容器：

**仅前端：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production up -d --build frontend nginx 2>&1 | tail -12"
```

**仅后端：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production up -d --build backend worker 2>&1 | tail -12"
```

**全量：**
```bash
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production up -d --build backend worker frontend nginx 2>&1 | tail -12"
```

### 第 6 步：验证部署

```bash
ssh ... "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep goodgua && echo '---' && curl -s http://127.0.0.1:18081/api/health && echo '' && curl -s -o /dev/null -w 'HTTP %{http_code}, time: %{time_total}s\n' https://goodgua.net/api/health"
```

验证标准：
- 所有容器显示 `healthy`（nginx 可能短暂显示 `health: starting`，这是正常的）
- 内网健康检查返回 `{"status":"ok","service":"goodgua"}`
- 外网健康检查返回 `HTTP 200`

### 第 7 步：向用户汇报

简要汇报本次发布的提交内容和验证结果，格式示例：
```
部署完成。本次发布 N 个提交：
- hash1 简要描述（前端/后端）
- hash2 简要描述（前端/后端）

所有容器 healthy，内外网 API 正常。
```

## 异常处理

如果健康检查失败：
1. 查看容器日志：`docker logs goodgua-backend --tail 50`
2. 检查环境变量：`docker inspect goodgua-backend --format '{{range .Config.Env}}{{println .}}{{end}}' | grep GOODGUA_DATABASE_URL`
3. 参考 `server-deployment-guide.md` 的常见问题排查章节
4. 向用户报告具体错误信息，不要自行执行回滚等破坏性操作
