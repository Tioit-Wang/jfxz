"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const titles: Record<string, string> = {
  "/admin": "后台概览",
  "/admin/users": "用户管理",
  "/admin/products": "套餐与加油包",
  "/admin/orders": "订单管理",
  "/admin/subscriptions": "订阅管理",
  "/admin/sessions": "会话管理",
  "/admin/configs": "系统配置",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "管理后台";

  return (
    <header className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <SidebarTrigger aria-label="切换侧边栏" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Admin Console</span>
          <h1 className="truncate text-sm font-medium">{title}</h1>
        </div>
        <Badge variant="outline" className="hidden sm:inline-flex">admin@example.com</Badge>
      </div>
    </header>
  );
}
