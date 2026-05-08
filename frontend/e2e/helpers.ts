import { expect, type Page, type Response } from "@playwright/test";

export const API_BASE = "http://localhost:8100";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function responsePath(response: Response, path: string) {
  try {
    return new URL(response.url()).pathname === path;
  } catch {
    return false;
  }
}

export async function expectNoErrorSurface(page: Page) {
  await expect(
    page.getByText(/Unhandled Runtime Error|Application error|Hydration failed|This page could not be found/)
  ).toHaveCount(0);
}

export async function expectBooksShelf(page: Page) {
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { name: "创作书架" })).toBeVisible();
  await expect(page.locator("[data-slot='skeleton']")).toHaveCount(0);
  await expectNoErrorSurface(page);
}

export async function registerWriter(page: Page, email = uniqueEmail("writer")) {
  await page.context().clearCookies();
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill("user12345");

  const worksLoaded = page
    .waitForResponse((response) => responsePath(response, "/works") && response.status() === 200)
    .catch(() => null);
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page).toHaveURL(/\/books$/);
  await worksLoaded;
  await expectBooksShelf(page);
  return email;
}

export async function expectWorkspaceReady(page: Page, title?: string) {
  await expect(page).toHaveURL(/\/books\/[^/]+$/);
  if (title) {
    await expect(page.getByText(title).first()).toBeVisible();
  }
  await expect(page.getByLabel("章节标题")).toBeVisible();
  await expect(page.getByLabel("章节正文")).toBeVisible();
  await expect(page.getByLabel("AI 对话输入")).toBeVisible();
  await expect(page.getByLabel("选择对话模型")).toBeVisible();
  await expectNoErrorSurface(page);
}

export function chapterEditor(page: Page) {
  return page.locator("[aria-label='章节正文'] [contenteditable='true']");
}

export async function createWork(page: Page, title = `E2E 长篇 ${Date.now()}`) {
  await page.getByRole("button", { name: /开本新书|新建作品/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "新建作品" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("作品名称").fill(title);
  await dialog.getByLabel("作品题材").fill("悬疑 测试");
  await dialog.getByLabel("作品梗概").fill("主角在雨夜发现一条线索，并逐步展开调查。");
  await dialog.getByRole("button", { name: "更多配置" }).click();
  await dialog.getByLabel("短简介").fill("一部用于端到端测试的长篇。");
  await dialog.getByLabel("背景与世界规则").fill("现代都市，线索必须前后一致。");
  await dialog.getByRole("button", { name: "创建作品" }).click();
  await expectWorkspaceReady(page, title);
  return title;
}

export async function loginAdmin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expectAdminPage(page, "用户管理");
}

export async function expectAdminPage(page: Page, title: string) {
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.locator("[data-slot='skeleton']")).toHaveCount(0);
  await expectNoErrorSurface(page);
}
