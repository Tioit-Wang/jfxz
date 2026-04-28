import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const API_BASE = "http://localhost:8100";

function uniqueMarker(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rowByText(page: Page, value: string) {
  return page.getByRole("row", { name: new RegExp(escapeRegExp(value)) });
}

async function expectPagination(page: Page) {
  await expect(page.getByRole("navigation", { name: "pagination" }).last()).toBeVisible();
  await expect(page.getByText(/第 \d+ \/ \d+ 页，共 \d+ 条/).last()).toBeVisible();
}

async function expectNoErrorSurfaces(page: Page) {
  await expect(
    page.getByText(/Unhandled Runtime Error|Application error|Hydration failed|This page could not be found/)
  ).toHaveCount(0);
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
        if (style.visibility === "hidden" || style.display === "none") return null;
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth)
          return null;
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

async function expectHealthyAdminPage(page: Page) {
  await expect(page.locator("[data-slot='skeleton']")).toHaveCount(0);
  await expectNoErrorSurfaces(page);
  await expectNoCollapsedControls(page);
}

async function loginAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expectHealthyAdminPage(page);
  await page.goto("/admin/credit-transactions");
  await expectHealthyAdminPage(page);
}

async function seedCreditData(page: Page) {
  const marker = uniqueMarker("credit-e2e");
  const email = `${marker}@example.com`;
  const workTitle = `积分测试作品 ${marker}`;

  // Register a writer via the frontend
  await page.context().clearCookies();
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill("user12345");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible();

  // Seed data via API calls
  const data = await page.evaluate(
    async ({ apiBase, workTitle }) => {
      let csrfToken = "";

      async function csrf() {
        if (csrfToken) return csrfToken;
        const response = await fetch(`${apiBase}/csrf`, { credentials: "include" });
        csrfToken = ((await response.json()) as { csrf_token: string }).csrf_token;
        return csrfToken;
      }

      async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const method = (init.method || "GET").toString().toUpperCase();
        const headers = new Headers(init.headers);
        headers.set("Content-Type", "application/json");
        if (method !== "GET") headers.set("X-CSRF-Token", await csrf());
        const response = await fetch(`${apiBase}${path}`, {
          ...init,
          credentials: "include",
          headers,
        });
        if (!response.ok) throw new Error(`${path} failed: ${await response.text()}`);
        return (await response.json()) as T;
      }

      // Create a work
      const work = await request<{ id: string; title: string }>("/works", {
        method: "POST",
        body: JSON.stringify({
          title: workTitle,
          short_intro: "E2E 积分测试作品",
          synopsis: "用于生成积分流水数据。",
          genre_tags: ["E2E 测试"],
          background_rules: "测试数据带唯一标记。",
        }),
      });

      // Get products and create order
      const products = await request<{
        plans: Array<{ id: string; name: string }>;
        credit_packs: Array<{ id: string; name: string }>;
      }>("/billing/products");

      // Purchase a plan to generate grant transactions
      const order = await request<{ id: string; order_no: string; product_name_snapshot: string }>(
        "/billing/orders",
        {
          method: "POST",
          body: JSON.stringify({ product_type: "plan", product_id: products.plans[0].id }),
        }
      );
      await request(`/billing/orders/${order.id}/simulate-paid`, { method: "POST" });

      // Also purchase a credit pack to generate another grant transaction
      const topupOrder = await request<{ id: string; order_no: string; product_name_snapshot: string }>(
        "/billing/orders",
        {
          method: "POST",
          body: JSON.stringify({ product_type: "credit_pack", product_id: products.credit_packs[0].id }),
        }
      );
      await request(`/billing/orders/${topupOrder.id}/simulate-paid`, { method: "POST" });

      // Call analyze to create a consume transaction (1 point deducted)
      await request(`/works/${work.id}/analyze`, {
        method: "POST",
        body: JSON.stringify({ content: "这是一段用于测试的文本内容，包含一些常见的错别字和语病。" }),
      });

      return { email, marker, workTitle, workId: work.id, orderNo: order.order_no };
    },
    { apiBase: API_BASE, workTitle }
  );

  // Clear cookies so admin can log in fresh
  await page.context().clearCookies();
  return data;
}

test.describe("积分流水管理", () => {
  test("页面导航与空状态", async ({ page }, testInfo) => {
    await loginAdmin(page);

    // Verify page loads with correct heading
    await expect(page.getByRole("heading", { name: "积分流水" })).toBeVisible();
    await expect(page.getByText("只读查看用户积分发放、消耗、清零、退款和调整记录。")).toBeVisible();

    // Search for non-existent keyword
    await page.getByPlaceholder("搜索用户邮箱或昵称…").fill("no-such-credit-e2e-user");
    await expect(page.getByText("没有匹配的流水")).toBeVisible();
    await testInfo.attach("empty-state", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("数据展示与筛选交互", async ({ page }, testInfo) => {
    const seeded = await seedCreditData(page);
    await loginAdmin(page);

    // Page should show data
    await expect(page.getByRole("heading", { name: "积分流水" })).toBeVisible();
    await expectHealthyAdminPage(page);
    await expectPagination(page);

    // Should see the work title from analyze (consume transaction)
    await expect(rowByText(page, seeded.workTitle)).toBeVisible();
    await testInfo.attach("data-loaded", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Search by user email
    await page.getByPlaceholder("搜索用户邮箱或昵称…").fill(seeded.email);
    await expect(rowByText(page, seeded.email)).toBeVisible();
    await expectPagination(page);
    await testInfo.attach("search-by-email", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Filter by change type "consume"
    await page.getByLabel("筛选变更类型").click();
    await page.getByRole("option", { name: "消耗" }).click();
    await expect(page.getByText("没有匹配的流水").or(rowByText(page, "analyze"))).toBeVisible();

    // Clear search and filter to see all data again
    await page.getByPlaceholder("搜索用户邮箱或昵称…").fill("");
    // Change type is already set to "消耗", so we should see only consume rows
    // Reset filters
    await page.getByRole("button", { name: "重置筛选" }).click();
    await expectPagination(page);
  });

  test("流水详情展示", async ({ page }, testInfo) => {
    const seeded = await seedCreditData(page);
    await loginAdmin(page);
    await expectHealthyAdminPage(page);

    // Search by email to locate seeded data
    await page.getByPlaceholder("搜索用户邮箱或昵称…").fill(seeded.email);

    // Click "详情" on the first grant row (plan purchase)
    await rowByText(page, seeded.orderNo).getByRole("button", { name: "详情" }).click();
    const detailSheet = page.getByRole("dialog", { name: "流水详情" });
    await expect(detailSheet).toBeVisible();

    // Verify common fields are displayed
    await expect(detailSheet.getByText("流水时间")).toBeVisible();
    await expect(detailSheet.getByText("用户")).toBeVisible();
    await expect(detailSheet.getByText("余额类型")).toBeVisible();
    await expect(detailSheet.getByText("变更类型")).toBeVisible();
    await expect(detailSheet.getByText("来源类型")).toBeVisible();
    await expect(detailSheet.getByText("来源 ID")).toBeVisible();
    await expect(detailSheet.getByText("积分变动")).toBeVisible();
    await expect(detailSheet.getByText("变动后余额")).toBeVisible();

    // For grant transaction, verify 权益发放详情 section
    await expect(detailSheet.getByText("权益发放详情")).toBeVisible();
    await expect(detailSheet.getByText("订单 ID")).toBeVisible();
    await expect(detailSheet.getByText("商品名称")).toBeVisible();

    // Verify the product name appears
    await expect(detailSheet.getByText(seeded.orderNo)).toBeVisible();
    await testInfo.attach("detail-grant", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Close sheet
    await page.keyboard.press("Escape");
    await expect(detailSheet).toBeHidden();

    // Click "详情" on the consume row (analyze)
    await rowByText(page, seeded.workTitle).getByRole("button", { name: "详情" }).click();
    await expect(detailSheet).toBeVisible();

    // Consume transaction should show common fields but not "权益发放详情"
    await expect(detailSheet.getByText("流水时间")).toBeVisible();
    await expect(detailSheet.getByText("积分变动")).toBeVisible();
    await expect(detailSheet.getByText("变动后余额")).toBeVisible();
    // No 权益发放 details for consume transactions
    await expect(detailSheet.getByText("权益发放详情")).toHaveCount(0);
    await testInfo.attach("detail-consume", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });

  test("范围筛选与重置", async ({ page }, testInfo) => {
    await seedCreditData(page);
    await loginAdmin(page);
    await expectHealthyAdminPage(page);
    await expectPagination(page);

    // Set points range filter
    const pointsMinInput = page.getByPlaceholder("min").first();
    const pointsMaxInput = page.getByPlaceholder("max").first();

    await pointsMinInput.fill("5");
    await pointsMaxInput.fill("100");

    // Should only show grant transactions (positive points)
    // The consume transaction has -1 which is outside this range
    await expect(rowByText(page, "analyze")).toHaveCount(0);
    await testInfo.attach("points-range-filter", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    // Click reset
    await page.getByRole("button", { name: "重置筛选" }).click();
    await expect(pointsMinInput).toHaveValue("");
    await expect(pointsMaxInput).toHaveValue("");
    await expectPagination(page);
  });
});
