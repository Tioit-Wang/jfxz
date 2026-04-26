import { expect, test, type Page, type Response } from "@playwright/test";

const USER_PASSWORD = "user12345";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function isWorksResponse(response: Response) {
  try {
    return new URL(response.url()).pathname === "/works";
  } catch {
    return false;
  }
}

function watchUnexpectedWorks401(page: Page) {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (isWorksResponse(response) && response.status() === 401) {
      failures.push(`${response.request().method()} ${response.url()}`);
    }
  });
  return failures;
}

async function expectWorksLoaded(page: Page) {
  await expect(page).toHaveURL(/\/books$/);
  await expect(page.getByRole("heading", { name: "我的作品" })).toBeVisible();
}

async function registerUser(page: Page, email = uniqueEmail("writer")) {
  const works401 = watchUnexpectedWorks401(page);
  await page.goto("/login?next=%2Fbooks");
  await page.getByRole("tab", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill(USER_PASSWORD);
  const worksLoaded = page.waitForResponse((response) => isWorksResponse(response) && response.status() === 200);
  await page.getByRole("button", { name: "注册" }).click();
  const worksResponse = await worksLoaded;
  expect(new URL(worksResponse.url()).hostname).toBe("localhost");
  await expectWorksLoaded(page);
  expect(works401).toEqual([]);
  return email;
}

async function loginUser(page: Page, email: string) {
  const works401 = watchUnexpectedWorks401(page);
  await page.goto("/login?next=%2Fbooks");
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码").fill(USER_PASSWORD);
  const worksLoaded = page.waitForResponse((response) => isWorksResponse(response) && response.status() === 200);
  await page.getByRole("button", { name: "登录" }).click();
  const worksResponse = await worksLoaded;
  expect(new URL(worksResponse.url()).hostname).toBe("localhost");
  await expectWorksLoaded(page);
  expect(works401).toEqual([]);
}

async function logoutFromBooks(page: Page) {
  await page.getByRole("button", { name: "账户" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
}

async function openCreateWorkDialog(page: Page) {
  await page.locator("header").getByRole("button", { name: "新建作品" }).click();
  await expect(page.getByRole("dialog", { name: "新建作品" })).toBeVisible();
}

async function createWorkFromDialog(page: Page, title: string) {
  await page.getByLabel("作品名称").fill(title);
  await page.getByLabel("作品题材").fill("悬疑 测试");
  await page.getByLabel("作品梗概").fill("主角在雨夜发现线索，并逐步展开调查。");
  await page.getByRole("button", { name: "更多配置" }).click();
  await page.getByLabel("短简介").fill("一部用于登录与作品列表端到端测试的长篇。");
  await page.getByLabel("背景与世界规则").fill("现代都市，线索必须前后一致。");
  await page.getByLabel("重点要求").fill("保持节奏紧凑。");
  await page.getByLabel("禁忌要求").fill("不要跳过关键推理。");
  await page.getByRole("button", { name: "创建作品" }).click();
  await expect(page).toHaveURL(/\/books\/[^/]+$/);
}

test("login page redirects unauthenticated users and validates credentials", async ({ page }) => {
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await expect(page.getByRole("textbox", { name: "邮箱" })).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByRole("tab", { name: "登录" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "注册" })).toBeVisible();

  await page.getByRole("textbox", { name: "邮箱" }).fill("writer");
  await page.getByLabel("密码").fill(USER_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("请输入有效邮箱")).toBeVisible();

  await page.getByRole("textbox", { name: "邮箱" }).fill("writer@example.com");
  await page.getByLabel("密码").fill("short");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("密码至少需要 8 位")).toBeVisible();

  await page.getByLabel("密码").fill("wrong12345");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("登录失败，请确认邮箱、密码和账户状态")).toBeVisible();
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
});

test("registration creates a durable session and the same user can log in after logout", async ({ page }) => {
  const email = await registerUser(page);
  await expect(page.getByText("还没有作品")).toBeVisible();

  await logoutFromBooks(page);
  await loginUser(page, email);
  await expect(page.getByText("还没有作品")).toBeVisible();
});

test("works page covers empty state, create validation, create, refresh, delete, and logout guard", async ({ page }) => {
  await registerUser(page);
  await expect(page.getByText("还没有作品")).toBeVisible();

  await openCreateWorkDialog(page);
  await page.getByRole("button", { name: "创建作品" }).click();
  await expect(page).toHaveURL(/\/books\/[^/]+$/);
  await page.goto("/books");
  await expectWorksLoaded(page);
  const unnamedWorkCard = page.locator("[data-slot='card']").filter({ hasText: "未命名作品" });
  await expect(unnamedWorkCard).toBeVisible();
  await unnamedWorkCard.getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(unnamedWorkCard).toHaveCount(0);

  const title = `E2E 作品 ${Date.now()}`;
  await openCreateWorkDialog(page);
  await createWorkFromDialog(page, title);

  const worksLoaded = page.waitForResponse((response) => isWorksResponse(response) && response.status() === 200);
  await page.goto("/books");
  const worksResponse = await worksLoaded;
  expect(new URL(worksResponse.url()).hostname).toBe("localhost");
  await expectWorksLoaded(page);
  const workCard = page.locator("[data-slot='card']").filter({ hasText: title });
  await expect(workCard).toBeVisible();
  await expect(workCard.getByText("一部用于登录与作品列表端到端测试的长篇。")).toBeVisible();
  await expect(workCard.getByText("悬疑", { exact: true })).toBeVisible();
  await expect(workCard.getByText("测试", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "刷新" }).click();
  await expect(workCard).toBeVisible();

  await workCard.getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(workCard).toHaveCount(0);
  await expect(page.getByText("还没有作品")).toBeVisible();

  await logoutFromBooks(page);
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
});
