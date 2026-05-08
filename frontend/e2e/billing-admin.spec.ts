import { expect, test } from "@playwright/test";
import { createWork, expectAdminPage, loginAdmin, registerWriter } from "./helpers";

test("billing grants points and exposes the grant in admin credit transactions", async ({ page }) => {
  const email = await registerWriter(page);
  await createWork(page);

  await page.getByRole("button", { name: "账户中心" }).click();
  await expect(page.getByRole("dialog", { name: "账户中心" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "选择适合本书节奏的创作额度" })).toBeVisible();
  await page.getByRole("button", { name: /灵感补给包/ }).click();
  await expect(page.getByText(/订单号/)).toBeVisible();
  await page.getByRole("button", { name: "模拟支付成功" }).click();
  await expect(page.getByText("支付成功")).toBeVisible();

  await loginAdmin(page);
  await page.getByRole("link", { name: "积分流水", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/credit-transactions$/);
  await expectAdminPage(page, "积分流水");
  await page.getByPlaceholder("搜索用户邮箱或昵称…").fill(email);
  await expect(page.getByRole("row", { name: new RegExp(email) })).toBeVisible();
  await expect(page.getByText("credit_pack").first()).toBeVisible();
});

test("admin shell exposes the current management sections after login", async ({ page }) => {
  await loginAdmin(page);

  const routes = [
    { link: "概览", url: /\/admin$/, title: "后台概览" },
    { link: "用户", url: /\/admin\/users$/, title: "用户管理" },
    { link: "模型", url: /\/admin\/models$/, title: "模型管理" },
    { link: "套餐与加油包", url: /\/admin\/products$/, title: "套餐与加油包" },
    { link: "订单", url: /\/admin\/orders$/, title: "订单管理" },
    { link: "订阅", url: /\/admin\/subscriptions$/, title: "订阅管理" },
    { link: "会话", url: /\/admin\/sessions$/, title: "会话管理" },
    { link: "积分流水", url: /\/admin\/credit-transactions$/, title: "积分流水" },
    { link: "配置", url: /\/admin\/configs$/, title: "系统配置" },
  ];

  for (const route of routes) {
    await page.getByRole("link", { name: route.link, exact: true }).click();
    await expect(page).toHaveURL(route.url);
    await expectAdminPage(page, route.title);
  }
});

test("regular writer session cannot enter the admin shell", async ({ page }) => {
  await registerWriter(page);
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { name: "无权限访问" })).toBeVisible();
});
