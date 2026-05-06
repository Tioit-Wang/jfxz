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

## 6. 项目文档索引

- 部署架构 → `docs/部署文档.md`