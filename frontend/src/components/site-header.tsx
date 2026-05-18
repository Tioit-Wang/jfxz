"use client";

import { useAdminProfile } from "@/components/admin-profile-context";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  const profile = useAdminProfile();
  const email = profile?.user?.email ?? "";

  return (
    <header className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-border bg-background px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <SidebarTrigger aria-label="切换侧边栏" className="text-foreground/60 hover:text-foreground" />
      <Separator orientation="vertical" className="h-4" />
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        {email ? (
          <span className="hidden text-xs tracking-[-0.01em] text-muted-foreground sm:inline-flex">
            {email}
          </span>
        ) : null}
      </div>
    </header>
  );
}
