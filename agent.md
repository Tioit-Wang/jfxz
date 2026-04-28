# Agent.md

## Timezone Policy

### 规则
前端所有面向用户的日期时间展示，必须通过 `Intl.DateTimeFormat` 并显式设置 `timeZone: "Asia/Shanghai"`，确保无论客户端浏览器处于哪个时区，用户看到的都是北京时间（UTC+8）。

### Why
- 产品用户在中国，但服务器部署在新加坡（同 UTC+8，时差无问题）。
- 管理员或测试人员可能在海外或非中国时区的环境中访问系统，若依赖浏览器默认时区，显示的时间会与用户看到的不一致。
- 后端统一用 UTC 存储（`datetime.now(UTC)`），时区转换是前端的职责。

### How to apply
- 任何使用 `Intl.DateTimeFormat("zh-CN", {...})` 格式化日期时间的地方，都要在 options 里加 `timeZone: "Asia/Shanghai"`。
- 使用 `toLocaleString` / `toLocaleDateString` / `toLocaleTimeString` 格式化日期时间时同理，需要传 `timeZone` 参数。
- 纯数字的 `toLocaleString`（如 token 数量格式化）不涉及时区，无需加。
- 新建日期格式化工具函数时，统一放在 `frontend/app/admin/admin-utils.ts` 或 `frontend/src/lib/format.ts` 中，避免各处分散定义。

### 已修正的文件
- `frontend/app/admin/admin-utils.ts` — `formatDate()`
- `frontend/app/books/BooksClient.tsx` — `formatUpdatedAt()`
- `frontend/app/books/[bookId]/WorkspaceClient.tsx` — `formatUpdatedAt()`
