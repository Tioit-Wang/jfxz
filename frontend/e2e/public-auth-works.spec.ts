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

