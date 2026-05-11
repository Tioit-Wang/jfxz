# Frontend — GoodGua Next.js App

**Stack:** Next.js 15 (App Router) + React 19 + shadcn/ui + Tailwind CSS + TipTap + Streamdown

## OVERVIEW

Single Next.js app hosting both user-facing writing workspace and admin panel. User-facing auth uses modal overlay; admin has dedicated login. Core workspace at `/books/:bookId` with three-panel layout (chapters | editor | AI chat).

## STRUCTURE

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (globals.css)
│   ├── page.tsx                  # Landing page
│   ├── LandingClient.tsx         # Landing page client component
│   ├── globals.css               # Tailwind + CSS variables
│   ├── login/                    # Admin login page (user auth via modal, not this route)
│   ├── books/
│   │   ├── page.tsx              # Book list page
│   │   ├── BooksClient.tsx       # Book list client component
│   │   └── [bookId]/
│   │       ├── page.tsx          # Workspace server page
│   │       ├── WorkspaceClient.tsx    # Main workspace layout orchestrator
│   │       ├── WorkspaceEntryClient.tsx # Workspace entry/auth gate
│   │       └── workspace/        # Panel components (chapters, editor, chat)
│   └── admin/
│       ├── layout.tsx            # Admin shell (sidebar + header)
│       ├── AdminShell.tsx        # Admin layout client component
│       ├── _components.tsx       # Shared admin UI helpers
│       └── <module>/             # Per-module: users, models, products, orders, etc.
├── src/
│   ├── api.ts                    # API client (fetch wrapper, CSRF token)
│   ├── auth.ts                   # Auth context, token management, user state
│   ├── domain.ts                 # Domain types/interfaces
│   ├── model-billing.ts          # Model billing calculation utilities
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (button, dialog, table, etc.)
│   │   ├── AuthModal.tsx         # User-facing login/register modal
│   │   ├── ChapterPlainTextEditor.tsx # TipTap editor wrapper
│   │   ├── ChatMentionInput.tsx  # TipTap mention extension for @ references
│   │   ├── ModelPicker.tsx       # AI model selector
│   │   └── billing/              # BillingDialog, PaymentDialog
│   ├── hooks/use-mobile.ts       # Mobile detection hook
│   └── lib/
│       ├── utils.ts              # cn() utility (clsx + tailwind-merge)
│       └── format.ts             # Date/number formatting utilities
├── e2e/                          # Playwright end-to-end tests
├── tests/                        # Vitest unit tests
└── next.config.ts                # Standalone output, security headers, CSP
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add user-facing page | `app/books/` | App Router; modal-based auth |
| Add admin page | `app/admin/<module>/` | Each module: `page.tsx` + private components |
| Add shared component | `src/components/` | shadcn/ui primitives in `ui/` |
| API calls | `src/api.ts` | `apiFetch()` wrapper with CSRF token injection |
| Auth state | `src/auth.ts` | `AuthProvider`, `useAuth()` hook, token refresh |
| Date formatting | `src/lib/format.ts` | MUST include `timeZone: "Asia/Shanghai"` |
| Editor customization | `src/components/ChapterPlainTextEditor.tsx` | TipTap instance configuration |
| AI chat input | `src/components/ChatMentionInput.tsx` | TipTap Mention extension |
| Model billing UI | `src/model-billing.ts` + `src/components/ModelPicker.tsx` | Cost estimation display |
| Workspace layout | `app/books/[bookId]/workspace/` | Three-panel resizable layout |

## CONVENTIONS

- **Timezone**: All `Intl.DateTimeFormat` / `toLocaleString` calls MUST pass `timeZone: "Asia/Shanghai"`. 具体实现参考 `admin-utils.ts` 的 `formatDate()` 和 `BooksClient.tsx`/`WorkspaceClient.tsx` 的 `formatUpdatedAt()`。新增日期格式化函数时必须遵循同一规范。使用 `timeZone: "Asia/Shanghai"` 而非本地时区，确保在任意浏览器/系统时区下均显示北京时间。
- **Language**:
  - 代码注释使用中文：函数、组件、Hook 的注释用简体中文，简洁说明意图。
  - 变量名、函数名、组件名、文件名使用英文。
  - UI 文案（按钮、标签、提示、错误消息）使用中文，面向最终用户。
- **Auth modal**: User-facing auth uses `AuthModal` component — no separate `/login` page for users. Admin login at `/admin/login` is separate.
- **Server/Client split**: `page.tsx` is server component (data fetching). `*Client.tsx` is client component (interactivity). `layout.tsx` wraps both.
- **shadcn/ui**: Components in `src/components/ui/` are shadcn primitives. Use `npx shadcn@latest add <component>` to add new ones.
- **Styling**: Tailwind CSS with `cn()` utility from `src/lib/utils.ts`. CSS variables in `globals.css` for theming (next-themes).
- **API client**: All fetch calls go through `apiFetch()` in `src/api.ts`. It handles CSRF token, JSON parsing, and error normalization.
- **Admin modules**: Each admin subdirectory follows the `novel-admin-crud` skill pattern: `page.tsx` (server) + private client components.

## ANTI-PATTERNS

- **DO NOT** create standalone user login/register pages — use `AuthModal`
- **DO NOT** omit `timeZone: "Asia/Shanghai"` in date formatting functions
- **DO NOT** import shadcn components directly from `node_modules` — use `src/components/ui/`
- **DO NOT** use `any` in TypeScript without explicit reason

## COMMANDS

```bash
npm run dev              # dev server (:3000)
npm run build            # production build (standalone output)
npm run test             # vitest unit tests
npm run e2e              # playwright e2e tests
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
```