import { expect, test, type Page, type TestInfo } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const API_BASE = "http://localhost:8100";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin123";

const diagnostics = new WeakMap<Page, string[]>();

function uniqueMarker(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rowByText(page: Page, value: string) {
  return page.getByRole("row", { name: new RegExp(escapeRegExp(value)) });
}

async function screenshotStep(page: Page, testInfo: TestInfo, name: string) {
  const fileName = `${testInfo.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${name}.png`;
  const path = testInfo.outputPath(fileName);
  await page.screenshot({ fullPage: true, path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function waitForAdminPage(page: Page, heading: string) {
  await expect(page.getByRole("heading", { name: heading }).last()).toBeVisible();
  await expect(page.locator("[data-slot='skeleton']")).toHaveCount(0);
}

async function expectNoErrorSurfaces(page: Page) {
  await expect(page.getByText(/Unhandled Runtime Error|Application error|Hydration failed|This page could not be found/)).toHaveCount(0);
}

async function expectNoCollapsedControls(page: Page) {
  const collapsedControls = await page.evaluate(() => {
    const selectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "[role='tab']",
      "[role='combobox']",
    ];
    const controls = Array.from(document.querySelectorAll<HTMLElement>(selectors.join(",")));

    return controls
      .map((control) => {
        const style = window.getComputedStyle(control);
        const rect = control.getBoundingClientRect();
        if (style.visibility === "hidden" || style.display === "none") {
          return null;
        }
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
          return null;
        }
        if (rect.width >= 4 && rect.height >= 4) return null;

        return {
          control:
            control.getAttribute("aria-label") ||
            control.getAttribute("placeholder") ||
            control.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
            control.tagName,
          rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        };
      })
      .filter(Boolean)
      .slice(0, 5);
  });

  expect(collapsedControls).toEqual([]);
}

async function expectHealthyAdminPage(page: Page, heading: string) {
  await waitForAdminPage(page, heading);
  await expectNoErrorSurfaces(page);
  await expectNoCollapsedControls(page);
}

async function expectPagination(page: Page) {
  await expect(page.getByRole("navigation", { name: "pagination" }).last()).toBeVisible();
  await expect(page.getByText(/第 \d+ \/ \d+ 页，共 \d+ 条/).last()).toBeVisible();
}

async function logout(page: Page) {
  await page.evaluate(async (apiBase) => {
    await fetch(`${apiBase}/auth/logout`, {
      credentials: "include",
      method: "POST",
    });
  }, API_BASE);
}

async function loginAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("邮箱").fill(ADMIN_EMAIL);
  await page.getByLabel("密码").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expectHealthyAdminPage(page, "用户管理");
}

async function registerWriter(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill("user12345");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible();
}

async function seedBusinessData(page: Page) {
  const marker = uniqueMarker("admin-e2e");
  const email = `${marker}@example.com`;
  const workTitle = `后台测试作品 ${marker}`;
  const sessionTitle = `后台测试会话 ${marker}`;

  await registerWriter(page, email);

  const data = await page.evaluate(
    async ({ apiBase, workTitle, sessionTitle }) => {
      async function request<T>(path: string, init: RequestInit = {}) {
        const response = await fetch(`${apiBase}${path}`, {
          ...init,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(init.headers || {}),
          },
        });
        if (!response.ok) {
          throw new Error(`${path} failed with ${response.status}: ${await response.text()}`);
        }
        return (await response.json()) as T;
      }

      const work = await request<{ id: string; title: string }>("/works", {
        method: "POST",
        body: JSON.stringify({
          title: workTitle,
          short_intro: "后台 E2E 可见作品",
          synopsis: "用于制造管理端订单、订阅和会话数据。",
          genre_tags: ["后台测试"],
          background_rules: "所有数据都带唯一测试标记。",
        }),
      });

      await request(`/works/${work.id}/chat-sessions`, {
        method: "POST",
        body: JSON.stringify({ title: sessionTitle, source_type: "manual" }),
      });

      const products = await request<{
        plans: Array<{ id: string; name: string }>;
        topup_packs: Array<{ id: string; name: string }>;
      }>("/billing/products");
      const order = await request<{ id: string; order_no: string; product_name_snapshot: string }>("/billing/orders", {
        method: "POST",
        body: JSON.stringify({ product_type: "plan", product_id: products.plans[0].id }),
      });
      await request(`/billing/orders/${order.id}/simulate-paid`, { method: "POST" });

      return {
        orderNo: order.order_no,
        productName: order.product_name_snapshot,
        workId: work.id,
      };
    },
    { apiBase: API_BASE, workTitle, sessionTitle }
  );

  await logout(page);
  return { email, marker, workTitle, sessionTitle, ...data };
}

async function fillProductDialog(page: Page, name: string, price: string, firstNumber: string, secondNumber: string) {
  const dialog = page.getByRole("dialog", { name: /新建商品|编辑商品/ });
  await expect(dialog).toBeVisible();
  await dialog.locator("input").nth(0).fill(name);
  await dialog.locator("input").nth(1).fill(price);
  await dialog.locator("input").nth(2).fill(firstNumber);
  await dialog.locator("input").nth(3).fill(secondNumber);
  await dialog.getByRole("button", { name: "保存" }).click();
}

test.beforeEach(({ page }) => {
  const issues: string[] = [];
  diagnostics.set(page, issues);

  page.on("console", (message) => {
    if (message.type() === "error") {
      if (/Failed to load resource: the server responded with a status of 40[134]/.test(message.text())) {
        return;
      }
      issues.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    issues.push(`page error: ${error.message}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      issues.push(`server error ${response.status()}: ${response.url()}`);
    }
  });
});

test.afterEach(({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([]);
});

test("admin login, logout, and shell navigation are stable", async ({ page }, testInfo) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByText("管理员登录")).toBeVisible();
  await screenshotStep(page, testInfo, "login-page");

  await page.getByLabel("邮箱").fill(ADMIN_EMAIL);
  await page.getByLabel("密码").fill("wrong123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("登录失败，请确认管理员账号、密码和账户状态。")).toBeVisible();
  await screenshotStep(page, testInfo, "login-error");

  await page.getByLabel("密码").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expectHealthyAdminPage(page, "用户管理");
  await expect(page.getByText("Admin Console")).toBeVisible();
  await screenshotStep(page, testInfo, "users-after-login");

  const routes = [
    { link: "概览", url: /\/admin$/, heading: "后台概览" },
    { link: "用户", url: /\/admin\/users$/, heading: "用户管理" },
    { link: "套餐与加油包", url: /\/admin\/products$/, heading: "套餐与加油包管理" },
    { link: "订单", url: /\/admin\/orders$/, heading: "订单管理" },
    { link: "订阅", url: /\/admin\/subscriptions$/, heading: "订阅管理" },
    { link: "会话", url: /\/admin\/sessions$/, heading: "会话管理" },
    { link: "配置", url: /\/admin\/configs$/, heading: "系统配置" },
  ];

  for (const route of routes) {
    await page.getByRole("link", { name: new RegExp(route.link) }).click();
    await expect(page).toHaveURL(route.url);
    await expectHealthyAdminPage(page, route.heading);
    await screenshotStep(page, testInfo, `nav-${route.link}`);
  }

  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin users page covers search, detail, and status confirmation", async ({ page }, testInfo) => {
  const seeded = await seedBusinessData(page);
  await loginAdmin(page);

  await page.getByPlaceholder("搜索邮箱或昵称").fill(seeded.email);
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(rowByText(page, seeded.email)).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "user-search");

  await rowByText(page, seeded.email).getByRole("button", { name: "详情" }).click();
  const detailDialog = page.getByRole("dialog", { name: "用户详情" });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText(seeded.email)).toBeVisible();
  await screenshotStep(page, testInfo, "user-detail");
  await page.keyboard.press("Escape");
  await expect(detailDialog).toBeHidden();

  await rowByText(page, seeded.email).getByRole("button", { name: "禁用" }).click();
  await expect(page.getByRole("alertdialog", { name: "确认更新账户状态？" })).toBeVisible();
  await screenshotStep(page, testInfo, "user-status-confirm");
  await page.getByRole("button", { name: "取消" }).click();
  await expect(rowByText(page, seeded.email).getByText("active")).toBeVisible();

  await rowByText(page, seeded.email).getByRole("button", { name: "禁用" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await expect(rowByText(page, seeded.email).getByText("disabled")).toBeVisible();

  await rowByText(page, seeded.email).getByRole("button", { name: "启用" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await expect(rowByText(page, seeded.email).getByText("active")).toBeVisible();
});

test("admin products page covers tabs, create, edit, and delete confirmations", async ({ page }, testInfo) => {
  await loginAdmin(page);
  await page.getByRole("link", { name: /套餐与加油包/ }).click();
  await expectHealthyAdminPage(page, "套餐与加油包管理");
  await expect(page.getByText("创作月卡")).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "plans-list");

  await page.getByRole("tab", { name: /加油包/ }).click();
  await expect(page.getByText("灵感加油包")).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "topups-list");
  await page.getByPlaceholder("搜索商品名称、价格或状态").fill("灵感");
  await expect(rowByText(page, "灵感加油包")).toBeVisible();
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.getByPlaceholder("搜索商品名称、价格或状态")).toHaveValue("");
  await page.getByRole("tab", { name: /套餐/ }).click();

  const planName = `E2E 套餐 ${uniqueMarker("plan")}`;
  const editedPlanName = `${planName} 改`;
  await page.getByRole("button", { name: "新建套餐" }).click();
  await fillProductDialog(page, planName, "11.00", "111", "22");
  await expect(rowByText(page, planName)).toBeVisible();

  await rowByText(page, planName).getByRole("button", { name: "编辑" }).click();
  await fillProductDialog(page, editedPlanName, "12.00", "222", "33");
  await expect(rowByText(page, editedPlanName)).toBeVisible();
  await screenshotStep(page, testInfo, "edited-plan");

  await page.getByLabel("筛选商品状态").click();
  await page.getByRole("option", { name: "active", exact: true }).click();
  await expect(rowByText(page, editedPlanName)).toBeVisible();
  await page.getByRole("button", { name: "重置筛选" }).click();

  await rowByText(page, editedPlanName).getByRole("button", { name: "删除" }).click();
  await expect(page.getByRole("alertdialog", { name: "确认删除商品？" })).toBeVisible();
  await screenshotStep(page, testInfo, "delete-plan-confirm");
  await page.getByRole("button", { name: "确认" }).click();
  await expect(rowByText(page, editedPlanName).getByText("inactive")).toBeVisible();

  const topupName = `E2E 加油包 ${uniqueMarker("topup")}`;
  await page.getByRole("tab", { name: /加油包/ }).click();
  await page.getByRole("button", { name: "新建加油包" }).click();
  await fillProductDialog(page, topupName, "9.00", "90", "30");
  await page.getByRole("tab", { name: /加油包/ }).click();
  await expect(rowByText(page, topupName)).toBeVisible();
  await screenshotStep(page, testInfo, "created-topup");

  await rowByText(page, topupName).getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认" }).click();
  await page.getByRole("tab", { name: /加油包/ }).click();
  await expect(rowByText(page, topupName).getByText("inactive")).toBeVisible();
});

test("admin orders and subscriptions pages expose paid purchase details", async ({ page }, testInfo) => {
  const seeded = await seedBusinessData(page);
  await loginAdmin(page);

  await page.getByRole("link", { name: /订单/ }).click();
  await expectHealthyAdminPage(page, "订单管理");
  await page.getByPlaceholder("订单号、用户或商品").fill(seeded.orderNo);
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(rowByText(page, seeded.orderNo)).toBeVisible();
  await expect(rowByText(page, seeded.orderNo).getByText("paid")).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "order-search");

  await rowByText(page, seeded.orderNo).getByRole("button", { name: "详情" }).click();
  const orderDialog = page.getByRole("dialog", { name: "订单详情" });
  await expect(orderDialog).toBeVisible();
  await expect(orderDialog.getByRole("heading", { name: "支付记录" })).toBeVisible();
  await expect(orderDialog.getByRole("heading", { name: "积分发放记录" })).toBeVisible();
  await screenshotStep(page, testInfo, "order-detail");
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("订单号、用户或商品").fill("no-such-order-admin-e2e");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("没有订单")).toBeVisible();
  await screenshotStep(page, testInfo, "orders-empty-state");

  await page.getByRole("link", { name: /订阅/ }).click();
  await expectHealthyAdminPage(page, "订阅管理");
  await page.getByPlaceholder("用户或套餐").fill(seeded.email);
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(rowByText(page, seeded.email)).toBeVisible();
  await expect(rowByText(page, seeded.email).getByText("active")).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "subscription-search");

  await rowByText(page, seeded.email).getByRole("button", { name: "详情" }).click();
  const subscriptionDialog = page.getByRole("dialog", { name: "订阅详情" });
  await expect(subscriptionDialog).toBeVisible();
  await expect(subscriptionDialog.getByText(seeded.email)).toBeVisible();
  await expect(subscriptionDialog.getByText(seeded.orderNo)).toBeVisible();
  await screenshotStep(page, testInfo, "subscription-detail");
});

test("admin sessions page covers search, detail, and empty state", async ({ page }, testInfo) => {
  const seeded = await seedBusinessData(page);
  await loginAdmin(page);

  await page.getByRole("link", { name: /会话/ }).click();
  await expectHealthyAdminPage(page, "会话管理");
  await page.getByPlaceholder("用户、作品或会话标题").fill(seeded.workTitle);
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(rowByText(page, seeded.workTitle)).toBeVisible();
  await expect(rowByText(page, seeded.workTitle).getByText(seeded.sessionTitle)).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "session-search");

  await rowByText(page, seeded.workTitle).getByRole("button", { name: "详情" }).click();
  const sessionDialog = page.getByRole("dialog", { name: "会话详情" });
  await expect(sessionDialog).toBeVisible();
  await expect(sessionDialog.getByText("Agent Session", { exact: true })).toBeVisible();
  await expect(sessionDialog.getByRole("heading", { name: "历史消息" })).toBeVisible();
  await screenshotStep(page, testInfo, "session-detail");
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("用户、作品或会话标题").fill("no-such-session-admin-e2e");
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page.getByText("没有会话")).toBeVisible();
  await screenshotStep(page, testInfo, "sessions-empty-state");
});

test("admin configs page covers tabs, inline edit, save prompt, and pagination", async ({ page }, testInfo) => {
  await loginAdmin(page);
  await page.getByRole("link", { name: /配置/ }).click();
  await expectHealthyAdminPage(page, "系统配置");
  await expect(page.getByRole("tab", { name: "全部" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "支付宝当面付" })).toBeVisible();
  await expectPagination(page);
  await screenshotStep(page, testInfo, "configs-all");

  await page.getByRole("tab", { name: "支付宝当面付" }).click();
  await expect(page.getByText("应用私钥")).toBeVisible();
  await page.getByLabel("显示或隐藏密文").first().click();
  await screenshotStep(page, testInfo, "configs-secret-reveal");

  await page.getByLabel("启用支付开关").click();
  await expect(page.getByRole("button", { name: "保存配置" })).toBeEnabled();
  await page.getByRole("tab", { name: "全部" }).click();
  const prompt = page.getByRole("alertdialog", { name: "当前配置尚未保存" });
  await expect(prompt).toBeVisible();
  await screenshotStep(page, testInfo, "configs-unsaved-prompt");
  await prompt.getByRole("button", { name: "继续编辑" }).click();
  await expect(prompt).toBeHidden();

  await page.getByRole("tab", { name: "全部" }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "保存并切换" }).click();
  await expect(prompt).toBeHidden();
  await expect(page.getByRole("tab", { name: "全部" })).toHaveAttribute("data-state", "active");
});
