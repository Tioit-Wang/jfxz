import { expect, test, type Page } from "@playwright/test";

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
  await page.getByLabel("作品名称").fill(title);
  await page.getByLabel("作品题材").fill("悬疑 测试");
  await page.getByLabel("作品梗概").fill("主角在雨夜发现一条线索，并逐步展开调查。");
  await page.getByRole("button", { name: "更多配置" }).click();
  await page.getByLabel("短简介").fill("一部用于端到端测试的长篇。");
  await page.getByLabel("背景与世界规则").fill("现代都市，线索必须前后一致。");
  await page.getByRole("button", { name: "创建作品" }).click();
  await expect(page).toHaveURL(/\/books\/[^/]+$/);
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByLabel("AI 对话输入")).toBeVisible();
  return title;
}

function chatEditor(page: Page) {
  return page.locator("[aria-label='AI 对话输入'] [contenteditable='true']");
}

function chapterEditor(page: Page) {
  return page.locator("[aria-label='章节正文'] [contenteditable='true']");
}

async function grantPoints(page: Page) {
  await page.evaluate(async () => {
    const products = await fetch("http://localhost:8100/billing/products", {
      credentials: "include"
    }).then((response) => response.json());
    const order = await fetch("http://localhost:8100/billing/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_type: "topup_pack", product_id: products.topup_packs[0].id })
    }).then((response) => response.json());
    await fetch(`http://localhost:8100/billing/orders/${order.id}/simulate-paid`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });
  });
}

test("landing page presents the product and primary actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "金番写作" })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: /开始写作/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /管理端/ })).toBeVisible();
});

test("user can log in and create a fully described work", async ({ page }) => {
  await login(page);
  await createWork(page);
  await expect(page.getByLabel("章节标题")).toBeVisible();
});

test("workspace chat restores a session and streams an AI reply", async ({ page }) => {
  await login(page);
  await createWork(page);
  await grantPoints(page);
  await chatEditor(page).fill("@");
  await expect(page.getByRole("button", { name: /第一章 第 1 章 chapter/ })).toBeVisible();
  await chatEditor(page).fill("帮我构思后续情节");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText(/我已读取/)).toBeVisible();
  await page.getByRole("button", { name: "历史会话" }).click();
  await expect(page.getByRole("button", { name: /帮我构思后续情节 我已读取/ })).toBeVisible();
});

test("workspace editor saves TipTap text and opens AI suggestions from highlights", async ({ page }) => {
  await login(page);
  await createWork(page);
  await grantPoints(page);

  await chapterEditor(page).fill("这里有错别字。\n第二段保持不变。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(chapterEditor(page)).toContainText("这里有错别字。");

  await page.getByRole("button", { name: /AI 分析本章/ }).click();
  await expect(page.getByText(/发现 1 处可检查内容/)).toBeVisible({ timeout: 10000 });
  const highlight = page.locator("[data-ai-suggestion-index='0']");
  await expect(highlight).toBeVisible();
  await highlight.hover();
  await expect(page.getByText(/测试环境检测到可能存在/)).toBeVisible();
  await highlight.click();
  await expect(page.getByText("AI 写作建议")).toBeVisible();
  await page.getByRole("button", { name: "采纳替换" }).click();
  await expect(chapterEditor(page)).toContainText("建议修改：这里有错别字。");
  await expect(page.getByText("AI 写作建议")).toBeHidden();
});

test("workspace manages characters and exposes them to mentions", async ({ page }) => {
  await login(page);
  await createWork(page);

  await page.getByRole("button", { name: "角色" }).click();
  await expect(page.getByRole("heading", { name: "角色管理" })).toBeVisible();
  await page.getByRole("button", { name: /新建角色/ }).click();
  await page.getByLabel("角色名称").fill("苏白");
  await page.getByLabel("角色简介").fill("负责侦查的线人");
  await page.getByLabel("角色详情").fill("总能在雨夜带回关键线索。");
  await page.getByRole("button", { name: /保存角色/ }).click();
  await expect(page.getByRole("heading", { name: "苏白" })).toBeVisible();

  await page.getByLabel("搜索角色").fill("侦查");
  await expect(page.getByRole("button", { name: /苏白 负责侦查的线人/ })).toBeVisible();
  await page.getByRole("button", { name: "编辑角色" }).click();
  await page.getByLabel("角色名称").fill("苏白改");
  await page.getByRole("button", { name: /保存角色/ }).click();
  await expect(page.getByRole("heading", { name: "苏白改" })).toBeVisible();

  await page.getByRole("button", { name: "章节", exact: true }).click();
  await chatEditor(page).fill("@苏");
  await expect(page.getByRole("button", { name: /苏白改 负责侦查的线人 character/ })).toBeVisible();
});

test("workspace manages settings with search, filter, copy, and delete", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-write"]);
  await login(page);
  await createWork(page);

  await page.getByRole("button", { name: "设定" }).click();
  await page.locator("aside").getByLabel("新建设定", { exact: true }).click();
  await page.getByRole("combobox", { name: "设定类型", exact: true }).click();
  await page.getByRole("option", { name: "规则" }).click();
  await page.getByLabel("设定名称").fill("雨夜规则");
  await page.getByLabel("设定简介").fill("雨夜时所有线索都更难辨认");
  await page.getByLabel("设定详情").fill("任何角色在雨夜观察都需要额外证据。");
  await page.getByRole("button", { name: /保存设定/ }).click();
  await expect(page.getByRole("heading", { name: "雨夜规则" })).toBeVisible();

  await page.getByLabel("搜索设定").fill("额外证据");
  await expect(page.getByRole("button", { name: /雨夜规则/ })).toBeVisible();
  await page.getByLabel("筛选设定类型").click();
  await page.getByRole("option", { name: "规则" }).click();
  await expect(page.getByRole("button", { name: /雨夜规则/ })).toBeVisible();
  await page.getByRole("button", { name: "详情" }).click();
  await expect(page.getByText("已复制详情")).toBeVisible();
  await page.getByRole("button", { name: "删除设定" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("还没有设定")).toBeVisible();
});

test("account center and billing purchase flow use real products", async ({ page }) => {
  await login(page);
  await createWork(page);

  await page.getByRole("button", { name: "账户中心" }).click();
  await expect(page.getByRole("dialog", { name: "账户中心" })).toBeVisible();
  await page.getByLabel("昵称").fill("端到端作者");
  await page.getByRole("button", { name: /保存昵称/ }).click();
  await page.getByRole("button", { name: "套餐与积分" }).click();
  await expect(page.getByRole("dialog", { name: "套餐与积分" })).toBeVisible();
  await page.getByRole("button", { name: /创建订单/ }).first().click();
  await expect(page.getByText(/订单号/)).toBeVisible();
  await page.getByRole("button", { name: "模拟支付成功" }).click();
  await expect(page.getByText("paid")).toBeVisible();
});

test("admin shell requires login and exposes dashboard navigation", async ({ page }) => {
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("admin123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "用户管理" }).nth(1)).toBeVisible();
  await expect(page.getByText("Admin Console")).toBeVisible();
  await expect(page.getByRole("link", { name: /套餐与加油包/ })).toBeVisible();

  await page.getByRole("link", { name: /配置/ }).click();
  await expect(page.getByRole("heading", { name: "系统配置" }).nth(1)).toBeVisible();
  await expect(page.getByText("payment.alipay_f2f.app_private_key")).toBeVisible();
  await expect(page.getByRole("button", { name: "显示或隐藏密文" }).first()).toBeVisible();
});
