# 部署场景 2：有 SQL 但为数据插入

> 当 git pull 输出包含 `backend/migrations/versions/` 下的新 `.sql` 文件，且 SQL 内容**仅含 INSERT 语句**时使用此场景。

## 适用条件

- git pull 输出包含 `backend/migrations/versions/` 路径下的新 `.sql` 文件
- **必须确认 SQL 文件仅包含 INSERT INTO ... VALUES 语句**，不含任何 DDL（CREATE TABLE、ALTER TABLE、DROP TABLE 等）
- 同时可能有代码变更（前端/后端）

## 风险等级

**中低** — 数据插入是追加操作，不影响现有表结构，不会破坏数据完整性。但需确认：
- 插入的字段和目标表字段匹配
- 插入的值不违反唯一约束
- 没有重复插入风险

## ⚠️ 数据安全第一原则

**绝对禁止一切数据清空操作。** 执行任何 SQL 前必须逐行审阅：
- 确认**没有** DROP TABLE、TRUNCATE、DELETE、UPDATE（不带 WHERE）等破坏性语句
- 确认**没有** ALTER TABLE、CREATE TABLE 语句（属于场景 3）
- 如果发现上述语句，**立即停止**并报告给用户

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

同时观察 files changed，判断变更范围。

### 第 3 步：审阅并执行 SQL 插入

**3.1 读取 SQL 文件确认内容**

先查看新增的迁移文件，确认仅含 INSERT 语句：

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cat /opt/jfxz/backend/migrations/versions/<新文件名>.sql"
```

**3.2 安全检查清单（逐项确认）:**

- [ ] SQL 中**无** DROP TABLE / DROP DATABASE
- [ ] SQL 中**无** TRUNCATE / DELETE
- [ ] SQL 中**无** ALTER TABLE / CREATE TABLE（这些属于场景 3）
- [ ] SQL 中**无** UPDATE 语句（或只有带精确 WHERE 的安全 UPDATE）
- [ ] 所有 INSERT 的目标表**存在**（可通过 `DESCRIBE <table>` 提前验证）
- [ ] 插入的值**不违反唯一约束**（如主键冲突或唯一索引冲突）
- [ ] 如果是批量插入，检查是否有 `ON DUPLICATE KEY UPDATE` 或 `INSERT IGNORE` 等幂等处理

**3.3 执行 SQL**

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua < /opt/jfxz/backend/migrations/versions/<文件名>.sql 2>&1"
```

注意：数据库密码来自 `.env.production` 中的 `GOODGUA_DATABASE_URL`。执行后检查输出，无报错即成功。

**3.4 验证数据已写入**

```bash
# 替换 <table> 为目标表名
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker exec -i 1Panel-mysql-Nbze mysql -ugoodgua -p'CtatZPiTYajyxk7h' goodgua -e 'SELECT COUNT(*) FROM <table>;' 2>&1"
```

确认 count 已增加，或直接 `SELECT * FROM <table> WHERE ...` 验证具体行已插入。

### 第 4 步：构建镜像（如有代码变更）

如果本次部署同时包含代码变更，按变更范围构建：

```bash
# 仅前端
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache frontend 2>&1 | tail -10"
# 仅后端
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend 2>&1 | tail -10"
# 全量
ssh ... "cd /opt/jfxz && docker compose --env-file .env.production build --no-cache backend frontend 2>&1 | tail -10"
```

如果**仅有 SQL 插入、无代码变更**，则跳过此步骤。

### 第 5 步：重启容器

**仅有 SQL 插入、无代码变更：** 只需重启 backend（无需 `--build`）：
```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "cd /opt/jfxz && docker compose --env-file .env.production restart backend worker 2>&1"
```

**有代码变更时**，按变更范围使用 `up -d --build`（见场景 1 第 4 步）。

### 第 6 步：验证部署

```bash
ssh -i "<pem>" -o StrictHostKeyChecking=no root@43.134.97.85 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep goodgua && echo '---' && curl -s http://127.0.0.1:18081/api/health && echo '' && curl -s -o /dev/null -w 'HTTP %{http_code}, time: %{time_total}s\n' https://goodgua.net/api/health"
```

**额外验证：** 通过 API 确认新插入的数据对业务可用。例如如果插入了配置数据，调用相关接口验证其生效。

### 第 7 步：向用户汇报

```
部署完成。本次发布 N 个提交：
- hash1 简要描述（含数据插入迁移 <文件名>）
- hash2 简要描述（前端/后端）

迁移文件：backend/migrations/versions/<文件名>.sql（INSERT 型）
所有容器 healthy，内外网 API 正常。
```

## 安全红线

- **执行 SQL 前必须读取并审阅完整内容**，确认无破坏性语句
- **绝对禁止执行含 DROP / TRUNCATE / DELETE / 无 WHERE UPDATE 的 SQL**
- 如果 SQL 文件不符预期（如含 ALTER TABLE），**立即停止并切换至场景 3**
- 数据库密码不要硬编码在脚本中，从 `.env.production` 读取
- SQL 执行后必须验证数据写入成功

## 异常处理

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| SQL 执行报 `Table doesn't exist` | 目标表未创建 | 检查迁移文件路径和表名，先确认数据库状态 |
| SQL 执行报 `Duplicate entry` | 唯一键冲突、重复插入 | 确认是否已执行过，是否需要 `ON DUPLICATE KEY UPDATE` |
| 数据插入后 API 行为未变 | 后端缓存了旧数据 | `docker compose restart backend` 刷新连接池 |
| SQL 文件含意外 DDL 语句 | 场景判断错误 | **立即停止执行**，切换至场景 3 |
