import { expect, test } from "@playwright/test";
import { chapterEditor, createWork, registerWriter } from "./helpers";

test("workspace supports creating, editing, saving, and switching chapters", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("章节标题").fill("雨夜线索");
  await expect(page.getByLabel("章节标题")).toHaveValue("雨夜线索");
  await chapterEditor(page).fill("第一章正文：雨夜里，线索从旧巷口出现。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 5000 });

  await page.getByLabel("新建章节").click();
  await expect(page.getByLabel("章节标题")).toHaveValue(/第 2 章 未命名章节/);
  await page.getByLabel("章节标题").fill("第二章 追踪");
  await chapterEditor(page).fill("第二章正文：主角沿着线索继续追踪。");
  await expect(page.getByText("已保存到云端")).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: /雨夜线索/ }).click();
  await expect(page.getByLabel("章节标题")).toHaveValue("雨夜线索");
  await expect(chapterEditor(page)).toContainText("第一章正文");

  await page.getByRole("button", { name: /第二章 追踪/ }).click();
  await expect(page.getByLabel("章节标题")).toHaveValue("第二章 追踪");
  await expect(chapterEditor(page)).toContainText("第二章正文");
});

test("workspace supports character and setting lifecycle as writing context", async ({ page }) => {
  await registerWriter(page);
  await createWork(page);

  await page.getByLabel("选择对话模型").click();
  await expect(page.getByRole("listbox", { name: "模型列表" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "角色" }).click();
  await expect(page.getByText("角色管理")).toBeVisible();
  await page.getByLabel("新建角色").click();
  await page.getByLabel("角色名称").fill("苏白");
  await page.getByLabel("角色简介").fill("负责侦查的线人");
  await page.getByLabel("角色详情").fill("总能在雨夜带回关键线索。");
  await page.getByRole("button", { name: /保存角色/ }).click();
  await expect(page.getByText("苏白").first()).toBeVisible();
  await page.getByText("苏白").first().hover();
  await page.getByLabel("编辑角色").click();
  await page.getByLabel("角色名称").fill("苏白改");
  await page.getByRole("button", { name: /保存角色/ }).click();
  await expect(page.getByText("苏白改").first()).toBeVisible();
  await page.getByLabel("搜索角色").fill("侦查");
  await expect(page.getByText("苏白改").first()).toBeVisible();

  await page.getByRole("button", { name: "设定" }).click();
  await expect(page.getByText("设定资料")).toBeVisible();
  await page.getByLabel("新建设定").click();
  await page.getByLabel("设定名称").fill("雨夜规则");
  await page.getByLabel("设定简介").fill("雨夜时所有线索都更难辨认");
  await page.getByLabel("设定详情").fill("任何角色在雨夜观察都需要额外证据。");
  await page.getByRole("button", { name: /保存设定/ }).click();
  await expect(page.getByText("雨夜规则").first()).toBeVisible();
  await page.getByText("雨夜规则").first().hover();
  await page.getByLabel("编辑设定").click();
  await page.getByLabel("设定名称").fill("雨夜规则改");
  await page.getByRole("button", { name: /保存设定/ }).click();
  await expect(page.getByText("雨夜规则改").first()).toBeVisible();
  await page.getByLabel("搜索设定").fill("额外证据");
  await expect(page.getByText("雨夜规则改").first()).toBeVisible();
});
