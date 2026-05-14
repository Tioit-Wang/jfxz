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
  Receipt,
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
  SidebarGroupLabel,
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
      { title: "积分流水", url: "/admin/credit-transactions", icon: Receipt },
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
      <SidebarHeader className="px-3 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="hover:bg-sidebar-accent/60">
              <Link href="/admin">
                <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                  <BookOpenText className="size-4" />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-tight">妙蛙写作</span>
                  <span className="truncate text-xs text-sidebar-foreground/50">管理后台</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-3">
        {menu.map((group) => (
          <SidebarGroup key={group.label} className="py-0">
            <SidebarGroupLabel className="px-3 text-xs font-normal tracking-widest text-sidebar-foreground/55 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        className="group relative font-medium tracking-[-0.01em]"
                      >
                        <Link href={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => void logout()}
              tooltip="退出登录"
              className="font-medium tracking-[-0.01em] text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <LogOut className="size-4" />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
