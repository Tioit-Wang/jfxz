import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { AdminHeading, AdminPage } from "./_components";

const modules = [
  { title: "用户与权限", description: "查看用户资料、账户状态、订阅和积分", href: "/admin/users" },
  { title: "套餐与加油包", description: "管理订阅套餐和积分加油包", href: "/admin/products" },
  { title: "订单管理", description: "查看订单、支付状态和权益发放", href: "/admin/orders" },
  { title: "订阅管理", description: "查看用户订阅状态和周期", href: "/admin/subscriptions" },
  { title: "会话审计", description: "查看 AI 对话记录和上下文", href: "/admin/sessions" },
  { title: "系统配置", description: "管理系统参数和配置项", href: "/admin/configs" },
];

export default function AdminHome() {
  return (
    <AdminPage>
      <AdminHeading
        title="后台概览"
        description="管理后台入口与操作指引。"
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <nav className="rounded-lg bg-card p-5 shadow-card">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">模块</h2>
          <div className="divide-y">
            {modules.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group -mx-2 flex items-center justify-between rounded-md px-2 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{m.title}</span>
                  <span className="text-xs text-muted-foreground">{m.description}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </nav>
        <aside className="rounded-lg bg-card p-5 shadow-card">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">界面约定</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>列表页以筛选、表格和详情面板为核心。</p>
            <p>配置页按分组标签切换，敏感值默认掩码展示。</p>
            <p>破坏性动作进入确认流程，普通查看动作放在行尾。</p>
          </div>
        </aside>
      </div>
    </AdminPage>
  );
}
