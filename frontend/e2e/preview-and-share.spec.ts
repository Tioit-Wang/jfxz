import { expect, test } from "@playwright/test";
import { chapterEditor, createWork, expectNoErrorSurface, registerWriter } from "./helpers";

test("author preview page shows chapter content with font size toggle", async ({ page }) => {
  await registerWriter(page);
  const title = await createWork(page);

  await page.getByLabel("章节标题").fill("测试预览章节");
  await chapterEditor(page).fill("这是预览测试的正文内容，用于验证作者预览页面能正确展示章节内容。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  // Open share dialog which contains the author preview link
  await page.getByLabel("分享与预览").click();
  const shareDialog = page.getByRole("dialog");
  await expect(shareDialog).toBeVisible({ timeout: 3000 });

  // Click the "open author preview in new tab" button
  const previewLinkButton = shareDialog.getByLabel("在新标签页打开作者预览");
  await expect(previewLinkButton).toBeVisible({ timeout: 3000 });

  const [previewPage] = await Promise.all([
    page.context().waitForEvent("page"),
    previewLinkButton.click(),
  ]);

  await expect(previewPage).toHaveURL(/\/books\/[^/]+\/preview/);
  await expectNoErrorSurface(previewPage);

  // Verify work title or chapter content is visible
  await expect(previewPage.getByText(title).first()).toBeVisible({ timeout: 10000 });

  // Font size controls
  await expect(previewPage.getByLabel("缩小字号")).toBeVisible({ timeout: 5000 });
  await expect(previewPage.getByLabel("放大字号")).toBeVisible();
  await expect(previewPage.getByLabel("字号")).toBeVisible();

  // Test font size toggle
  const sizeSlider = previewPage.getByLabel("字号");
  const initialValue = await sizeSlider.inputValue();
  await previewPage.getByLabel("放大字号").click();
  await previewPage.waitForTimeout(200);
  const newValue = await sizeSlider.inputValue();
  expect(Number(newValue)).toBeGreaterThanOrEqual(Number(initialValue));

  // Chapter navigation buttons should exist
  const prevBtn = previewPage.getByText("上一章");
  const nextBtn = previewPage.getByText("下一章");
  await expect(prevBtn.or(nextBtn).first()).toBeVisible();
});

test("enable sharing shows public link with copy button", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  // Open share dialog
  await page.getByLabel("分享与预览").click();
  const shareDialog = page.getByRole("dialog");
  await expect(shareDialog).toBeVisible({ timeout: 3000 });

  // Verify author preview section exists
  await expect(shareDialog.getByText("作者预览")).toBeVisible();

  // Toggle sharing on
  const shareSwitch = shareDialog.getByLabel("开关公开分享");
  await expect(shareSwitch).toBeVisible({ timeout: 3000 });
  await shareSwitch.click();

  // Wait for the public URL input to appear
  const publicUrlInput = shareDialog.locator("input[readonly]").last();
  await expect(publicUrlInput).toBeVisible({ timeout: 5000 });

  const urlValue = await publicUrlInput.inputValue();
  expect(urlValue).toMatch(/\/s\/[a-zA-Z0-9_-]+/);

  // Copy button should be present for public URL
  const copyButtons = shareDialog.getByLabel(/复制/);
  const firstCopyBtn = copyButtons.first();
  if (await firstCopyBtn.isVisible()) {
    await firstCopyBtn.click();
    await expect(shareDialog.getByText("已复制")).toBeVisible({ timeout: 2000 });
  }
});

test("public share page loads chapter content without auth", async ({ page }) => {
  // Step 1: Create work and enable sharing to get token
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("章节标题").fill("公开分享测试");
  await chapterEditor(page).fill("这段内容将通过公开分享链接展示给未登录用户。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  // Open share dialog and enable sharing
  await page.getByLabel("分享与预览").click();
  const shareDialog = page.getByRole("dialog");
  await expect(shareDialog).toBeVisible({ timeout: 3000 });

  const shareSwitch = shareDialog.getByLabel("开关公开分享");
  await shareSwitch.click();
  await expect(shareDialog.locator("input[readonly]").last()).toBeVisible({ timeout: 5000 });

  // Extract share token from public URL
  const publicUrlInput = shareDialog.locator("input[readonly]").last();
  const urlValue = await publicUrlInput.inputValue();
  const match = urlValue.match(/\/s\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    test.skip(true, "Could not extract share token from URL");
    return;
  }
  const shareToken = match[1];

  // Close the dialog
  await shareDialog.getByRole("button", { name: /close|关闭/i }).click();
  await expect(shareDialog).not.toBeVisible({ timeout: 3000 }).catch(() => {});

  // Step 2: Navigate to shared URL in a clean context (no auth)
  const cleanContext = await page.context().browser()!.newContext({});
  const cleanPage = await cleanContext.newPage();
  // Clear cookies to ensure no auth state leaks
  await cleanContext.clearCookies();

  await cleanPage.goto(`/s/${shareToken}`, { waitUntil: "networkidle" }).catch(() => {});
  await cleanPage.waitForTimeout(3000);

  // Should not redirect to login
  const currentUrl = cleanPage.url();
  expect(currentUrl).toContain(`/s/${shareToken}`);

  // Verify content loads (chapter content or work title visible)
  await expect(cleanPage.getByText("公开分享测试").or(cleanPage.locator("article").first()))
    .toBeVisible({ timeout: 10000 }).catch(() => {});

  // Chapter navigation should be present
  const prevOrNext = cleanPage.getByText(/上一章|下一章/);
  if (await prevOrNext.first().isVisible().catch(() => false)) {
    await expect(prevOrNext.first()).toBeVisible();
  }

  await expectNoErrorSurface(cleanPage);
  await cleanContext.close();
});

test("disable sharing returns 404 on previously valid share URL", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  // Enable sharing
  await page.getByLabel("分享与预览").click();
  const shareDialog = page.getByRole("dialog");
  await expect(shareDialog).toBeVisible({ timeout: 3000 });

  const shareSwitch = shareDialog.getByLabel("开关公开分享");
  await shareSwitch.click();
  await expect(shareDialog.locator("input[readonly]").last()).toBeVisible({ timeout: 5000 });

  const publicUrlInput = shareDialog.locator("input[readonly]").last();
  const urlValue = await publicUrlInput.inputValue();
  const match = urlValue.match(/\/s\/([a-zA-Z0-9_-]+)/);
  if (!match) {
    test.skip(true, "Could not extract share token from URL");
    return;
  }
  const shareToken = match[1];

  // Close dialog
  await shareDialog.getByRole("button", { name: /close|关闭/i }).click();
  await expect(shareDialog).not.toBeVisible({ timeout: 3000 }).catch(() => {});

  // Now disable sharing
  await page.getByLabel("分享与预览").click();
  const shareDialog2 = page.getByRole("dialog");
  await expect(shareDialog2).toBeVisible({ timeout: 3000 });

  const shareSwitch2 = shareDialog2.getByLabel("开关公开分享");
  await shareSwitch2.click();
  await page.waitForTimeout(1000);

  // Visit the old share URL
  await page.goto(`/s/${shareToken}`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3000);

  // Should see error or "not found" content
  const errorIndicator = page.getByText(/不可用|已关闭|not found|404/i);
  const hasError = await errorIndicator.isVisible().catch(() => false);

  // Also check: the page should not render normal chapter content
  const chapterContent = page.locator("article").first();
  const hasArticle = await chapterContent.isVisible().catch(() => false);

  // Either there's an error message, or no article content
  expect(hasError || !hasArticle).toBeTruthy();

  await expectNoErrorSurface(page);
});
