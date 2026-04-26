"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiClient } from "@/api";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }
    const client = new ApiClient();
    client
      .getMe()
      .then((profile) => {
        if (profile.user.role === "admin") {
          setReady(true);
          return;
        }
        router.replace("/admin/login");
      })
      .catch(() => router.replace("/admin/login"));
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (!ready) {
    return <main className="grid min-h-screen place-items-center text-sm text-muted-foreground">加载管理后台...</main>;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3.5rem",
        } as CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex min-h-[calc(100vh-var(--header-height))] flex-1 flex-col bg-muted/30">
          <main className="@container/main flex w-full flex-1 flex-col px-4 py-5 md:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">{children}</div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
