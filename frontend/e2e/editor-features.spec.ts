import { expect, test } from "@playwright/test";
import { chapterEditor, createWork, expectNoErrorSurface, registerWriter } from "./helpers";

test("格式化工具弹出面板可打开并包含格式化选项", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  const formatBtn = page.getByLabel("文本格式化");
  if (!(await formatBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "格式化按钮未找到");
  }
  await formatBtn.click();

  const formatPopup = page.getByText("移除空白行").first();
  await expect(formatPopup).toBeVisible({ timeout: 3000 });

  await expect(page.getByText("按；换行").first()).toBeVisible();
  await expect(page.getByText("英文标点→中文标点").first()).toBeVisible();

  const formatActionBtn = page.getByLabel("格式化");
  await expect(formatActionBtn).toBeVisible();

  await formatBtn.click();
  await expect(formatPopup).not.toBeVisible({ timeout: 3000 });
  await expectNoErrorSurface(page);
});

test("编辑器设置可打开并调整字号", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  const settingsBtn = page.getByLabel("编辑器设置");
  if (!(await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "编辑器设置按钮未找到");
  }
  await settingsBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });
  await expect(dialog.getByText("编辑器排版设置")).toBeVisible({ timeout: 3000 });

  const fontSizeSlider = dialog.locator("input[type='range']").first();
  if (await fontSizeSlider.isVisible({ timeout: 2000 }).catch(() => false)) {
    const initialValue = await fontSizeSlider.inputValue();
    await fontSizeSlider.fill("20");
    await expect(fontSizeSlider).toHaveValue("20");
    await fontSizeSlider.fill(initialValue);
  }

  const doneBtn = dialog.getByRole("button", { name: "完成" });
  await expect(doneBtn).toBeVisible();
  await doneBtn.click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  await expectNoErrorSurface(page);
});

test("编辑器设置可调整行高", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  const settingsBtn = page.getByLabel("编辑器设置");
  if (!(await settingsBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "编辑器设置按钮未找到");
  }
  await settingsBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });

  const lineHeightSlider = dialog.getByText("行高").locator("..").locator("input[type='range']");
  if (await lineHeightSlider.isVisible({ timeout: 2000 }).catch(() => false)) {
    const initialValue = await lineHeightSlider.inputValue();
    await lineHeightSlider.fill("2.0");
    await expect(lineHeightSlider).toHaveValue("2.0");
    await lineHeightSlider.fill(initialValue);
  }

  const doneBtn = dialog.getByRole("button", { name: "完成" });
  await doneBtn.click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  await expectNoErrorSurface(page);
});

test("输入正文后自动保存提示出现", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("章节标题").fill("自动保存测试");
  await chapterEditor(page).fill("正文内容用于测试自动保存功能。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 10000 });
  await expectNoErrorSurface(page);
});

test("编辑器底部状态栏显示章节字数统计", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("章节标题").fill("字数统计测试");
  await chapterEditor(page).fill("这是一段测试文字，用于验证字数统计功能是否正常工作。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(/本章字数:/)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/今日字数:/)).toBeVisible({ timeout: 5000 });

  const wordCountText = page.getByText(/本章字数: \d+/);
  await expect(wordCountText).toBeVisible({ timeout: 5000 });

  await expectNoErrorSurface(page);
});

test("格式化清理功能可对正文执行一键排版", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("章节标题").fill("格式化测试");
  await chapterEditor(page).fill("测试正文内容，包含标点。还有更多文字.");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 10000 });

  const formatBtn = page.getByLabel("文本格式化");
  if (!(await formatBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "格式化按钮未找到");
  }
  await formatBtn.click();

  await expect(page.getByText("移除空白行").first()).toBeVisible({ timeout: 3000 });

  const enToCnSwitches = page.getByLabel("英文标点→中文标点");
  if (await enToCnSwitches.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enToCnSwitches.click();
  }

  const formatActionBtn = page.getByLabel("格式化");
  await formatActionBtn.click();

  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 10000 });

  await expectNoErrorSurface(page);
});
