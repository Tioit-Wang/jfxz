import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminProfileProvider } from "../src/components/admin-profile-context";
import { AppSidebar } from "../src/components/app-sidebar";
import { SiteHeader } from "../src/components/site-header";
import { SidebarProvider } from "../src/components/ui/sidebar";
import { TooltipProvider } from "../src/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  pathname: "/admin/users",
  replace: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/api", () => ({
  ApiClient: vi.fn(() => ({ logout: mocks.logout })),
}));

afterEach(() => {
  cleanup();
  mocks.pathname = "/admin/users";
  mocks.replace.mockClear();
  mocks.logout.mockClear();
});

describe("admin block shell components", () => {
  it("renders the official sidebar navigation and current header title", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SiteHeader />
        </SidebarProvider>
      </TooltipProvider>
    );

    expect(screen.getByText("金番写作")).toBeVisible();
    expect(screen.getByRole("link", { name: /用户/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /套餐与加油包/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "用户管理" })).toBeVisible();
  });

  it("renders the current admin email from context", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AdminProfileProvider
            profile={{
              user: {
                id: "admin-id",
                email: "real-admin@example.com",
                nickname: "Admin",
                role: "admin",
                status: "active",
              },
              points: { monthlyPoints: 0, topupPoints: 0, totalPoints: 0 },
              subscription: null,
            }}
          >
            <SiteHeader />
          </AdminProfileProvider>
        </SidebarProvider>
      </TooltipProvider>
    );

    expect(screen.getByText("real-admin@example.com")).toBeVisible();
  });

  it("logs out from the sidebar footer", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </TooltipProvider>
    );

    await user.click(screen.getByRole("button", { name: /退出登录/ }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
    expect(mocks.replace).toHaveBeenCalledWith("/admin/login");
  });
});
