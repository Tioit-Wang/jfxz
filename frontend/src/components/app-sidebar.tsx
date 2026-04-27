"use client";

import type { ComponentProps } from "react";
import {
  BookOpenText,
  BrainCircuit,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Package,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiClient } from "@/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const menu = [
  {
    label: "工作台",
    items: [{ title: "概览", url: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "业务管理",
    items: [
      { title: "用户", url: "/admin/users", icon: Users },
      { title: "模型", url: "/admin/models", icon: BrainCircuit },
      { title: "套餐与加油包", url: "/admin/products", icon: Package },
      { title: "订单", url: "/admin/orders", icon: CreditCard },
      { title: "订阅", url: "/admin/subscriptions", icon: FileClock },
      { title: "会话", url: "/admin/sessions", icon: MessageSquareText },
    ],
  },
  {
    label: "系统",
    items: [{ title: "配置", url: "/admin/configs", icon: Settings2 }],
  },
];

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await new ApiClient().logout();
    router.replace("/admin/login");
  }

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/admin">
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <BookOpenText />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">金番写作</span>
                  <span className="truncate text-xs text-muted-foreground">管理后台</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {menu.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => void logout()} tooltip="退出登录">
              <LogOut />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
