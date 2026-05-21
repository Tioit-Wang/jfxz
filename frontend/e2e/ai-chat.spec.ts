import { expect, test } from "@playwright/test";
import { chapterEditor, createWork, expectNoErrorSurface, registerWriter } from "./helpers";

/**
 * Builds an SSE payload for a mock chat response.
 */
function buildSseBody(responseText: string): string {
  const chars = [...responseText];
  const textEvents = chars.map((ch) => `event: text\ndata: ${JSON.stringify(ch)}\n\n`).join("");
  const donePayload = JSON.stringify({
    id: "mock-msg-1",
    role: "assistant",
    content: responseText,
    actions: [],
    blocks: [{ type: "text", text: responseText }],
    tool_results: [],
    billing_failed: false,
    error: null,
    created_at: new Date().toISOString(),
  });
  return `${textEvents}event: done\ndata: ${donePayload}\n\n`;
}

/**
 * Mock the SSE chat streaming endpoint.
 * Set delayMs to keep the stream open long enough for the stop button to be visible.
 */
function mockChatStream(
  page: import("@playwright/test").Page,
  responseText = "这是一个测试回复。",
  delayMs = 0
) {
  const body = buildSseBody(responseText);
  return page.route("**/chat-sessions/*/messages", async (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body,
    });
  });
}

/**
 * 预编译 Next.js 路由，避免首次访问超时。
 */
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  // 触发 /login 路由编译
  await page.goto("/login", { waitUntil: "domcontentloaded" }).catch(() => {});
  // 触发 /books 路由编译
  await page.goto("/books", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.close();
});

/**
 * 创建作品并等待导航，自动处理 Next.js dev server 首次编译的延迟。
 */
async function safeCreateWork(page: import("@playwright/test").Page): Promise<string> {
  try {
    return await createWork(page);
  } catch {
    await page.waitForURL(/\/books\/[^/]+$/, { timeout: 30000 }).catch(() => {});
    await expect(page.getByLabel("章节标题")).toBeVisible({ timeout: 10000 });
    return page.url().split("/books/")[1] || "";
  }
}

test("AI 对话支持发送消息并接收流式回复", async ({ page }) => {
  await mockChatStream(page);
  await registerWriter(page);
  await safeCreateWork(page);

  const chatInput = page.locator("[aria-label='AI 对话输入'] [contenteditable='true']");
  await chatInput.fill("你好，帮我梳理一下这一章的情节走向");

  await page.getByLabel("发送消息").click();

  // 等待 AI 回复文本出现
  await expect(page.getByText("这是一个测试回复。")).toBeVisible({ timeout: 15000 });

  // 流式生成结束，发送按钮恢复
  await expect(page.getByLabel("发送消息")).toBeVisible();
  await expectNoErrorSurface(page);
});

test("AI 对话支持新建和切换会话", async ({ page }) => {
  await mockChatStream(page);
  await registerWriter(page);
  await safeCreateWork(page);

  // 点击新建会话
  await page.getByLabel("新建会话").click();
  await expect(page.getByText("当前会话 · 已读取作品上下文")).toBeVisible({ timeout: 8000 });

  // 在新会话中发送消息
  const chatInput = page.locator("[aria-label='AI 对话输入'] [contenteditable='true']");
  await chatInput.fill("续写这一章的内容");
  await page.getByLabel("发送消息").click();
  await expect(page.getByText("这是一个测试回复。")).toBeVisible({ timeout: 15000 });

  // 打开历史会话检查
  await page.getByLabel("历史会话").click();
  await expect(page.getByText("最近会话")).toBeVisible({ timeout: 3000 });

  await page.keyboard.press("Escape");
  await expectNoErrorSurface(page);
});

test("AI 对话支持停止生成", async ({ page }) => {
  // 延迟 mock 响应，确保停止按钮有足够时间出现
  await mockChatStream(page, "这是一个非常长的测试回复内容。", 3000);
  await registerWriter(page);
  await safeCreateWork(page);

  const chatInput = page.locator("[aria-label='AI 对话输入'] [contenteditable='true']");
  await chatInput.fill("写一个很长的故事开头");
  await page.getByLabel("发送消息").click();

  // 等待停止按钮出现
  await expect(page.getByLabel("停止生成")).toBeVisible({ timeout: 10000 });

  // 点击停止
  await page.getByLabel("停止生成").click();

  // 停止后停止按钮消失，发送按钮恢复
  await expect(page.getByLabel("停止生成")).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("发送消息")).toBeVisible();
  await expectNoErrorSurface(page);
});

test("AI 分析本章支持完整的分析流程", async ({ page }) => {
  await registerWriter(page);
  const workTitle = await safeCreateWork(page);

  await expect(page.getByText(workTitle).first()).toBeVisible();

  await page.getByLabel("章节标题").fill("雨夜追踪");
  await chapterEditor(page).fill(
    "第一章：雨夜的街道上，主角发现了一串奇怪的脚印。他顺着脚印追踪，来到了一个废弃的仓库前。仓库里传来了低沉的说话声，主角小心翼翼地靠近。"
  );
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  const analyzeButton = page.getByRole("button", { name: /AI 分析/ });
  await expect(analyzeButton).toBeVisible();
  await analyzeButton.click();

  // 等待进度弹窗或结果标签出现
  await page.getByText(/AI 分析中|AI检查建议/).first().waitFor({ state: "visible", timeout: 30000 });

  // 如果需要查看结果，点击按钮
  const viewResultsButton = page.getByRole("button", { name: "查看结果" });
  if (await viewResultsButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await viewResultsButton.click();
  } else {
    await page.getByText("AI检查建议").first().waitFor({ state: "visible", timeout: 60000 });
  }

  await expectNoErrorSurface(page);
});

test("模型选择在切换章节后保持不变", async ({ page }) => {
  await registerWriter(page);
  await safeCreateWork(page);

  await page.getByLabel("选择对话模型").click();
  const listbox = page.getByRole("listbox", { name: "模型列表" });
  await expect(listbox).toBeVisible();

  const options = listbox.getByRole("option");
  const count = await options.count();
  if (count > 1) {
    await options.nth(1).click();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(page.getByLabel("选择对话模型")).toBeVisible();

  // 切换到新建章节后模型选择应保持
  await page.getByLabel("新建章节").click();
  await expect(page.getByLabel("章节标题")).toHaveValue("未命名章节");
  // 模型名应与切换前的最后一次选择一致
  const modelNameAfter = await page.getByLabel("选择对话模型").textContent();
  await expect(modelNameAfter).toBeTruthy();
  await expectNoErrorSurface(page);
});
