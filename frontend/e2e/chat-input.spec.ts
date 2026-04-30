import { expect, test, type Page } from "@playwright/test";

const API_BASE = "http://localhost:8100";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

async function login(page: Page, email = uniqueEmail("writer")) {
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill("user12345");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible();
  return email;
}

async function createWork(page: Page, title = `E2E 长篇 ${Date.now()}`) {
  await page.locator("header").getByRole("button", { name: /^新建作品$/ }).click();
  const dialog = page.getByRole("dialog", { name: "新建作品" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("作品名称").fill(title);
  await dialog.getByLabel("作品题材").fill("悬疑 测试");
  await dialog.getByLabel("作品梗概").fill("主角在雨夜发现一条线索，并逐步展开调查。");
  await dialog.getByRole("button", { name: "更多配置" }).click();
  await dialog.getByLabel("短简介").fill("一部用于端到端测试的长篇。");
  await dialog.getByLabel("背景与世界规则").fill("现代都市，线索必须前后一致。");
  await dialog.getByRole("button", { name: "创建作品" }).click();
  const createdWorkLink = page.getByRole("link", { name: title });
  await expect(createdWorkLink).toBeVisible();
  if (!/\/books\/[^/]+$/.test(new URL(page.url()).pathname)) {
    const href = await createdWorkLink.getAttribute("href");
    if (!href) throw new Error("Created work link is missing href");
    await page.goto(href);
  }
  await expect(page).toHaveURL(/\/books\/[^/]+$/);
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByLabel("AI 对话输入")).toBeVisible();
  return title;
}

function chatEditor(page: Page) {
  return page.locator("[aria-label='AI 对话输入'] [contenteditable='true']");
}

async function grantPoints(page: Page) {
  await page.evaluate(async (apiBase) => {
    const csrf = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("goodgua_csrf="))
      ?.slice("goodgua_csrf=".length);
    if (!csrf) {
      throw new Error("missing csrf cookie");
    }
    const csrfToken = decodeURIComponent(csrf);
    const products = await fetch(`${apiBase}/billing/products`, {
      credentials: "include"
    }).then((response) => response.json());
    const order = await fetch(`${apiBase}/billing/orders`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ product_type: "credit_pack", product_id: products.credit_packs[0].id })
    }).then((response) => response.json());
    await fetch(`${apiBase}/billing/orders/${order.id}/simulate-paid`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }
    });
  }, API_BASE);
}

test.describe("chat input area", () => {
  test("@mention keyboard navigation selects chapter with ArrowDown + Enter", async ({ page }) => {
    await login(page);
    await createWork(page);
    await grantPoints(page);

    const editor = chatEditor(page);
    await editor.click();
    await editor.pressSequentially("@");

    // Suggestion popup should appear with at least one chapter
    const firstSuggestion = page.locator("[aria-label='AI 对话输入'] button").filter({ hasText: /chapter/ }).first();
    await expect(firstSuggestion).toBeVisible();

    // Navigate with ArrowDown and select with Enter
    await editor.press("ArrowDown");
    await editor.press("Enter");

    // A mention node should be inserted
    await expect(editor.locator("[data-reference-type='chapter']")).toBeVisible();
  });

  test("Ctrl+Enter submits the message", async ({ page }) => {
    await login(page);
    await createWork(page);
    await grantPoints(page);

    const editor = chatEditor(page);
    await editor.fill("用快捷键发送消息测试");

    // Submit with Ctrl+Enter
    await editor.press("Control+Enter");

    // AI reply should appear
    await expect(page.getByText(/我已读取/)).toBeVisible({ timeout: 15000 });
  });

  test("reference tag appears and can be removed after @mention", async ({ page }) => {
    await login(page);
    await createWork(page);
    await grantPoints(page);

    const editor = chatEditor(page);
    await editor.click();
    await editor.pressSequentially("@");

    // Wait for suggestion and click it
    const chapterSuggestion = page.locator("[aria-label='AI 对话输入'] button").filter({ hasText: /chapter/ }).first();
    await expect(chapterSuggestion).toBeVisible();
    await chapterSuggestion.click();

    // Reference tag should appear in the input area
    const referenceTag = page.locator("[aria-label='AI 对话输入']").locator("span").filter({ hasText: /第/ }).first();
    await expect(referenceTag).toBeVisible();

    // Remove the reference tag
    const removeButton = referenceTag.locator("button");
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Tag should be gone
    await expect(referenceTag).toBeHidden();
  });
});
