"use client";

import { usePathname } from "next/navigation";
import { useAdminProfile } from "@/components/admin-profile-context";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/admin": "后台概览",
  "/admin/users": "用户管理",
  "/admin/models": "模型管理",
  "/admin/products": "套餐与加油包",
  "/admin/orders": "订单管理",
  "/admin/subscriptions": "订阅管理",
  "/admin/sessions": "会话管理",
  "/admin/configs": "系统配置",
};

export function SiteHeader() {
  const pathname = usePathname();
  const profile = useAdminProfile();
  const email = profile?.user?.email ?? "";
  const title =
    titles[pathname] ??
    Object.entries(titles)
      .sort(([left], [right]) => right.length - left.length)
      .find(([path]) => pathname.startsWith(path + "/"))?.[1] ??
    "管理后台";

  return (
    <header className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger aria-label="切换侧边栏" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        {email ? <span className="hidden text-sm text-muted-foreground sm:inline-flex">{email}</span> : null}
      </div>
    </header>
  );
}
