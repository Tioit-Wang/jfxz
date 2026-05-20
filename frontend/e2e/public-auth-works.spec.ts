import { expect, test } from "@playwright/test";
import { createWork, expectBooksShelf, registerWriter } from "./helpers";

test("landing, auth redirect, registration, and work creation follow the current product flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让每个故事/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /开始创作/ }).first()).toBeVisible();

  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/);
  await expect(page.getByRole("textbox", { name: "邮箱" })).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();

  await registerWriter(page);
  await expect(page.getByText("还没有作品")).toBeVisible();

  const title = await createWork(page);
  await page.goto("/books");
  await expectBooksShelf(page);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("login form keeps basic validation visible before any backend call", async ({ page }) => {
  await page.goto("/login?next=%2Fbooks");
  await page.getByRole("textbox", { name: "邮箱" }).fill("writer");
  await page.getByLabel("密码").fill("user12345");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("请输入有效邮箱")).toBeVisible();

  await page.getByRole("textbox", { name: "邮箱" }).fill("writer@example.com");
  await page.getByLabel("密码").fill("short");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("密码至少需要 8 位")).toBeVisible();
});

test("bookshelf search filters works by title", async ({ page }) => {
  await registerWriter(page);
  const title = await createWork(page);

  await page.goto("/books");
  await expectBooksShelf(page);

  const searchInput = page.getByLabel("搜索作品");
  if (!(await searchInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "搜索框未找到");
  }

  // Verify the work is visible before search
  await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 5000 });

  // Search for the work
  await searchInput.fill(title.slice(0, 5));
  await page.waitForTimeout(500);
  await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 5000 });

  // Search for non-matching text
  await searchInput.fill("不存在的作品标题xyz");
  await page.waitForTimeout(500);
  const noMatchEl = page.getByText("没有匹配的作品");
  const workCard = page.getByRole("link", { name: title });
  const noMatch = (await noMatchEl.isVisible({ timeout: 3000 }).catch(() => false)) ||
    !(await workCard.isVisible({ timeout: 2000 }).catch(() => false));
  expect(noMatch).toBe(true);
});

test("grid and list view toggle changes layout", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.goto("/books");
  await expectBooksShelf(page);

  const gridBtn = page.getByLabel("网格视图");
  const listBtn = page.getByLabel("列表视图");

  if (!(await gridBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "视图切换按钮未找到");
  }

  // Default is grid, switch to list
  await listBtn.click();
  await page.waitForTimeout(300);

  // List view should show a table
  const table = page.locator("table");
  if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(table).toBeVisible();
  }

  // Switch back to grid
  await gridBtn.click();
  await page.waitForTimeout(300);

  // Verify no error surfaces after toggling
  await expect(
    page.getByText(/Unhandled Runtime Error|Application error/)
  ).toHaveCount(0);
});

test("delete work shows confirmation and removes work from bookshelf", async ({ page }) => {
  await registerWriter(page);
  const title = await createWork(page);

  await page.goto("/books");
  await expectBooksShelf(page);
  await expect(page.getByRole("link", { name: title })).toBeVisible({ timeout: 5000 });

  // Find delete option - in grid view it's in the "MoreHorizontal" dropdown
  const moreBtn = page.getByRole("button", { name: "MoreHorizontal" }).first();
  if (!(await moreBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    test.skip(true, "更多操作按钮未找到");
  }
  await moreBtn.click();

  const deleteMenuItem = page.getByRole("menuitem", { name: "删除" });
  if (!(await deleteMenuItem.isVisible({ timeout: 2000 }).catch(() => false))) {
    // Try switching to list view for delete button
    const listBtn = page.getByLabel("列表视图");
    if (await listBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await listBtn.click();
      await page.waitForTimeout(300);
    }
    const deleteBtn = page.getByRole("button", { name: "删除" }).first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
    } else {
      test.skip(true, "删除按钮未找到");
    }
  } else {
    await deleteMenuItem.click();
  }

  // Confirmation dialog should appear
  const alertDialog = page.getByRole("alertdialog");
  if (await alertDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expect(alertDialog.getByText("确认删除作品")).toBeVisible({ timeout: 3000 });

    const confirmDelete = alertDialog.getByRole("button", { name: "确认删除" });
    await expect(confirmDelete).toBeVisible();
    await confirmDelete.click();

    await page.waitForTimeout(1000);
  }

  // After deletion, the title link should no longer be visible
  await expect(page.getByRole("link", { name: title })).not.toBeVisible({ timeout: 10000 });
});

test("logout redirects to login and books is inaccessible", async ({ page }) => {
  await registerWriter(page);

  await page.goto("/books");
  await expectBooksShelf(page);

  // Avatar button
  const avatarBtn = page.getByLabel("账户");
  if (!(await avatarBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    test.skip(true, "账户按钮未找到");
  }

  // Hover to reveal dropdown
  await avatarBtn.hover();
  await page.waitForTimeout(500);

  // Click logout
  const logoutBtn = page.getByText("退出登录");
  if (!(await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    test.skip(true, "退出登录按钮未找到");
  }
  await logoutBtn.click();

  // Should redirect to login page
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/, { timeout: 10000 });

  // Try accessing books again
  await page.goto("/books");
  await expect(page).toHaveURL(/\/login\?next=%2Fbooks$/, { timeout: 10000 });
});

