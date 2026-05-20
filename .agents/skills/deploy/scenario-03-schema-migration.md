# 部署场景 3：有 SQL 为表字段迁移

> 当 git pull 输出包含 `backend/migrations/versions/` 下的新 `.sql` 文件，且 SQL 内容**包含 DDL 语句（ALTER TABLE、CREATE TABLE 等）**时使用此场景。

## 适用条件

- git pull 输出包含 `backend/migrations/versions/` 路径下的新 `.sql` 文件
- SQL 文件**存在** CREATE TABLE、ALTER TABLE、ADD COLUMN、MODIFY COLUMN、CREATE INDEX 等 DDL 语句
- 同时可能包含 DML（INSERT/UPDATE）和数据代码变更

## 风险等级

**高** — 表结构变更可能影响正在运行的应用：
- 新增字段：新旧代码兼容性需确认
- 修改字段类型/约束：可能导致已有数据写入失败
- 删除字段/表：**绝对禁止**
- 索引变更：可能影响查询性能

## ⚠️ 数据安全第一原则

**绝对禁止一切数据清空操作。** 执行任何迁移 SQL 前必须逐行审阅并确认：
- **禁止** DROP TABLE / DROP DATABASE / DROP COLUMN
- **禁止** TRUNCATE TABLE
- **禁止** DELETE FROM（不带精确 WHERE）
- **禁止** MODIFY COLUMN 将字段改为 NOT NULL 而数据中存在 NULL
- **禁止** 改变字段类型可能导致数据截断或丢失

## 前置检查（必读）

在部署前先读取 `docs/db-migration-spec.md` 了解项目数据库迁移规范。

## 部署流程

### 第 1 步：检查本地代码状态

```bash
cd /c/Projects/jfxz && git log --oneline -5 && echo '===' && git status -sb
```

确认新提交已推送到 `origin/main`。

### 第 2 步：服务器拉取代码

```bash
ssh -i "C:\Users\v_wyxgwang\.proma\agent-workspaces\default\workspace-files\gsgsg.pem" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && git pull origin main 2>&1"
```

### 第 3 步：审阅并执行 SQL 迁移（关键步骤）

**3.1 读取 SQL 文件，逐行审阅**

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cat /opt/jfxz/backend/migrations/versions/<新文件名>.sql"
```

**3.2 安全检查清单（逐项确认）:**

- [ ] SQL 中**无** DROP TABLE / DROP DATABASE / DROP COLUMN
- [ ] SQL 中**无** TRUNCATE / DELETE / 无 WHERE UPDATE
- [ ] **无** MODIFY COLUMN 可能覆盖数据（如 `VARCHAR(100)` → `VARCHAR(50)` 会截断）
- [ ] **无** ALTER COLUMN ... DROP DEFAULT（会导致已有行的默认值丢失）
- [ ] **无** RENAME COLUMN（会导致旧代码写入错误字段）
- [ ] 新增字段使用 **NULL 或 DEFAULT 值**，确保旧代码写入时不报错
- [ ] 新增表/字段使用 **`IF NOT EXISTS`** 确保幂等性
- [ ] 删除索引使用 **`IF EXISTS`** 确保幂等性
- [ ] 确认 SQL 文件是**可重放的**（多次执行不会报错或产生副作用）
- [ ] 确认当前运行的程序版本**兼容**迁移后的表结构（新增字段必须有默认值，旧代码不会写入新字段）

**3.3 执行 SQL 迁移**

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua < /opt/jfxz/backend/migrations/versions/<文件名>.sql 2>&1"
```

观察输出，应无错误信息。

**3.4 验证表结构变更已生效**

```bash
# 验证新增表存在（如是CREATE TABLE）
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua -e 'DESCRIBE <表名>;' 2>&1"

# 验证新增字段存在（如是ALTER TABLE ADD COLUMN）
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua -e 'SHOW COLUMNS FROM <表名> LIKE \"<字段名>\";' 2>&1"

# 验证索引创建（如是CREATE INDEX）
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua -e 'SHOW INDEX FROM <表名>;' 2>&1"
```

### 第 4 步：构建镜像

表结构变更通常伴随后端代码改动（新字段读写），需重建 backend。

**典型命令：**
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend 2>&1 | tail -10"
```

如果同时有前端变更，加 `frontend`。设置 timeout 600000ms。

### 第 5 步：重启容器

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production up -d --build backend worker 2>&1 | tail -12"
```

如果有前端变更，加 `frontend nginx`；全量则全部重建。

> ⚠️ 必须先执行完 SQL 迁移再重启 backend。如果先重启再执行 SQL，backend 启动时会因为表结构不匹配报错。

### 第 6 步：验证部署

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep goodgua && echo '---' && curl -s http://127.0.0.1:18081/api/health && echo '' && curl -s -o /dev/null -w 'HTTP %{http_code}, time: %{time_total}s\n' https://goodgua.net/api/health"
```

**额外验证（此场景关键）：确认后端能与新表结构正常交互**

```bash
# 验证新表可读写（替换为实际的 API 端点或 SQL 查询）
# 通过 Docker 内 curl 调用后端 API
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec goodgua-backend curl -s http://127.0.0.1:8000/api/health"
```

### 第 7 步：向用户汇报

```
部署完成。本次发布 N 个提交：
- hash1 简要描述（含表结构迁移 <文件名>）
- hash2 简要描述（前端/后端）

迁移文件：backend/migrations/versions/<文件名>.sql（表结构变更）
变更内容：<简要说明变更了哪些表/字段>
所有容器 healthy，内外网 API 正常。
```

## 安全红线

- **执行 SQL 前必须完整读取并逐行审阅**，不可跳过
- **绝对禁止**任何 DROP / TRUNCATE / RENAME / DELETE 无 WHERE 语句
- **幂等性要求**：新增必须 `IF NOT EXISTS`，删除必须 `IF EXISTS`
- **执行顺序不能错**：先 SQL 迁移 → 再构建 → 再启动容器
- **旧代码兼容性**：新加的字段必须有 DEFAULT 或允许 NULL，确保旧版本代码不会因写入报错
- **迁移文件不可修改**：如果发现迁移文件有误，**不要在服务器上直接编辑 SQL 文件**。回本地修改、提交新 commit 和新的迁移文件，重新部署
- 修改 `models.py` 后，检查是否需更新对应的迁移文件 — **禁止**依赖 ORM 自动建表（`GOODGUA_AUTO_CREATE_TABLES=false`）

## 异常处理

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| SQL 报 `Duplicate column name` | 字段已存在，SQL 未加 `IF NOT EXISTS` | 检查幂等性，或确认该迁移是否已执行过 |
| SQL 报 `Table already exists` | 表已存在 | 同上 |
| backend 启动报 `Unknown column` | SQL 未执行或执行失败 | 先确认 SQL 已成功执行再重启 |
| backend 启动报 SQLAlchemy 错误 | 模型定义与数据库不匹配 | 对比 `models.py` 和数据库实际结构 |
| 数据写入时报 500 | 新字段 NOT NULL 但无默认值 | 迁移 SQL 需先允许 NULL 或设 DEFAULT |
| API 读取新字段返回 null | 旧数据没有该字段值 | 这是预期的，前端应做空值处理 |
