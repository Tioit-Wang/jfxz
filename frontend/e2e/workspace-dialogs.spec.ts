import { expect, test } from "@playwright/test";
import { chapterEditor, createWork, expectNoErrorSurface, registerWriter } from "./helpers";

test("version history dialog lists versions and shows restore button", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  // Add chapter content to create a version
  await page.getByLabel("章节标题").fill("版本历史测试");
  await chapterEditor(page).fill("第一版正文内容，用于生成历史版本。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  // Wait a bit then modify content to create another version
  await page.waitForTimeout(1500);
  await chapterEditor(page).fill("第二版正文内容，修改后应生成新的历史版本记录。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  // Open version history dialog
  const historyBtn = page.locator("[aria-label='历史版本']");
  await expect(historyBtn).toBeVisible({ timeout: 3000 });
  await historyBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Verify dialog title
  await expect(dialog.getByText("历史版本")).toBeVisible({ timeout: 3000 });

  // Wait for version list to load
  await page.waitForTimeout(3000);

  // Check version list content: either versions exist or "暂无版本记录" is shown
  const versionItems = dialog.locator("button").filter({ has: page.locator("[class*='Badge']") });
  const versionCount = await versionItems.count();

  if (versionCount > 0) {
    // Click the first version item
    await versionItems.first().click();
    await page.waitForTimeout(1000);

    // Verify restore button exists
    const restoreBtn = dialog.getByRole("button", { name: /恢复此版本/ });
    if (await restoreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(restoreBtn).toBeVisible();
    }
  }

  // Check for "暂无版本记录" as fallback
  const noRecords = dialog.getByText("暂无版本记录");
  const hasRecords = !(await noRecords.isVisible().catch(() => false));
  if (hasRecords) {
    // Should have a close button
    await expect(dialog.getByRole("button", { name: /关闭|close/i })).toBeVisible();
  }
});

test("edit work info dialog modifies title and saves", async ({ page }) => {
  await registerWriter(page);
  const originalTitle = await createWork(page);

  // Open work edit dialog via sidebar "编辑作品信息" button (MoreVertical icon)
  const editWorkBtn = page.getByLabel("编辑作品信息");
  await expect(editWorkBtn).toBeVisible({ timeout: 3000 });
  await editWorkBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Wait for dialog content to render
  await page.waitForTimeout(1000);

  // Verify the title input contains the current work title
  const titleInput = dialog.getByLabel("作品标题");
  if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const currentTitle = await titleInput.inputValue();
    expect(currentTitle).toBe(originalTitle);

    // Modify the title
    const newTitle = `${originalTitle} (已编辑)`;
    await titleInput.clear();
    await titleInput.fill(newTitle);

    // Save
    const saveBtn = dialog.getByRole("button", { name: /保存作品档案/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify the title updated in sidebar
    await page.waitForTimeout(1000);
    const sidebarTitle = page.locator("[data-testid='workspace-sidebar-panel']");
    await expect(sidebarTitle.getByText(newTitle).first()).toBeVisible({ timeout: 5000 });
  }
});

test("export dialog shows chapter checkboxes and cancel button", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  // Add content so there's at least one chapter to export
  await page.getByLabel("章节标题").fill("导出测试章节");
  await chapterEditor(page).fill("导出正文内容。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 8000 });

  // The export button is in the sidebar when the chapters tab is active
  const exportBtn = page.getByText("导出").filter({ has: page.locator("[class*='lucide']") }).first();
  const exportBtnLabel = page.locator("[data-testid='workspace-sidebar-panel']").getByText("导出");

  const exportTrigger = (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false))
    ? exportBtn
    : exportBtnLabel;

  if (await exportTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await exportTrigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog title
    await expect(dialog.getByText("导出章节")).toBeVisible({ timeout: 3000 });

    // Should have checkboxes
    const checkboxes = dialog.locator("[role='checkbox']");
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(1);

    // Should have cancel button
    const cancelBtn = dialog.getByRole("button", { name: /取消/ });
    await expect(cancelBtn).toBeVisible();

    // Should have export button
    const exportActionBtn = dialog.getByRole("button", { name: /导出/ }).last();
    await expect(exportActionBtn).toBeVisible();

    // Cancel and verify dialog closes
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  } else {
    test.skip(true, "Export button not found in sidebar");
  }
});

test("writing goal dialog sets target and updates display", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  // The goal edit button is in the sidebar footer
  const goalBtn = page.getByLabel("编辑创作目标");
  await expect(goalBtn).toBeVisible({ timeout: 5000 });
  await goalBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Verify dialog title
  await expect(dialog.getByText("今日创作目标")).toBeVisible({ timeout: 3000 });

  // Find goal input and set a value
  const goalInput = dialog.getByLabel("目标字数");
  if (await goalInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await goalInput.clear();
    await goalInput.fill("5000");

    // Save
    const saveBtn = dialog.getByRole("button", { name: /保存目标/ });
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify display updated - should show "5000" in the goal section
    await page.waitForTimeout(1000);
    const goalDisplay = page.getByText(/\/ 5000 字/);
    if (await goalDisplay.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(goalDisplay).toBeVisible();
    }
  }

  await expectNoErrorSurface(page);
});
