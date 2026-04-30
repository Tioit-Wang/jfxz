"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiClient, type UserProfile } from "@/api";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminProfileProvider } from "@/components/admin-profile-context";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }
    const client = new ApiClient(undefined, undefined, {
      onUnauthorized: () => router.replace("/admin/login")
    });
    client
      .getMe()
      .then((p) => {
        if (p.user.role === "admin") {
          setReady(true);
          setProfile(p);
          return;
        }
        setForbidden(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [pathname, router]);

  if (forbidden) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-destructive">无权限访问</h1>
          <p className="text-muted-foreground">你的账号没有管理后台的访问权限。</p>
        </div>
      </main>
    );
  }

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
      <AdminProfileProvider profile={profile}>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex min-h-[calc(100vh-var(--header-height))] flex-1 flex-col">
            <main className="@container/main flex w-full flex-1 flex-col px-4 py-5 md:px-6 lg:px-8">
              <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">{children}</div>
            </main>
          </div>
        </SidebarInset>
      </AdminProfileProvider>
    </SidebarProvider>
  );
}
