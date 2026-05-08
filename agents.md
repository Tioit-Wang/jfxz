# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. Timezone Conventions

**所有前端时间展示必须显式指定 `timeZone: "Asia/Shanghai"`。**

- 用户群体在中国，服务器部署在新加坡（同为 UTC+8），但浏览器环境可能不一致。
- `Intl.DateTimeFormat` 和 `toLocaleString` 用于日期时间展示时，必须加 `timeZone: "Asia/Shanghai"`，确保在任何浏览器/系统时区下都显示北京时间。
- 后端存储统一用 UTC（`datetime.now(UTC)`），前端负责在展示层转换为北京时间。
- 已修改的文件：
  - `frontend/app/admin/admin-utils.ts` — `formatDate()`
  - `frontend/app/books/BooksClient.tsx` — `formatUpdatedAt()`
  - `frontend/app/books/[bookId]/WorkspaceClient.tsx` — `formatUpdatedAt()`
- 新增日期格式化函数时，务必遵循同一规范。

## 6. Database Migration Conventions

**所有数据库结构变更必须先阅读 `docs/db-migration-spec.md`。**

- 只要任务涉及 SQLAlchemy 模型、表结构、列、索引、唯一约束、外键、默认值或需要手写 SQL，必须先阅读 `docs/db-migration-spec.md`，再开始改动。
- 任何数据库结构变更都必须新增一个迁移 SQL 文件，路径为 `backend/migrations/versions/`。
- 迁移文件名必须使用 `YYYYMMDDHHMMSS__short_description.sql` 格式，按时间顺序追加，不允许覆盖旧文件。
- 历史迁移文件一旦提交，禁止修改、禁止重命名、禁止删除；如需进一步调整数据库，必须新增后续迁移文件。
- 编写新迁移前，至少要阅读最新的相关迁移文件；如当前变更与更早的结构演进有关，还必须继续追溯相关历史迁移文件，并结合当前目标数据库结构一并判断。
- 模型改动如果会影响数据库结构，模型变更与迁移文件必须在同一个任务或同一个 PR 中一起提交；缺少迁移文件视为任务未完成。
- 正式环境数据库迁移只能由人工执行，禁止依赖应用启动流程自动修改正式数据库结构。
