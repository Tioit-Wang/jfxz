import { describe, expect, it } from "vitest";
import {
  adminUsers,
  applySuggestion,
  configs,
  getWork,
  maskConfig,
  searchUsers,
  wordCount
} from "../src/domain";

describe("domain helpers", () => {
  it("counts non-space characters", () => {
    expect(wordCount("雾 港\nabc")).toBe(5);
  });

  it("searches users and returns all users for blank keyword", () => {
    expect(searchUsers(adminUsers, "writer")).toHaveLength(1);
    expect(searchUsers(adminUsers, "长篇")).toHaveLength(1);
    expect(searchUsers(adminUsers, " ")).toHaveLength(2);
  });

  it("masks secret configs unless revealed", () => {
    expect(maskConfig(configs[0], false)).toBe("false");
    expect(maskConfig(configs[1], false)).toBe("******");
    expect(maskConfig(configs[1], true)).toBe("dev-secret-key");
    expect(maskConfig({ key: "x", type: "secret", value: "" }, false)).toBe("");
  });

  it("applies suggestions when quote exists and keeps content otherwise", () => {
    expect(applySuggestion("雾像未寄出的信", { quote: "雾像", replacement: "雨像" })).toBe("雨像未寄出的信");
    expect(applySuggestion("没有命中", { quote: "雾像", replacement: "雨像" })).toBe("没有命中");
  });

  it("finds works and falls back to the first work", () => {
    expect(getWork("book-2").title).toBe("星桥来信");
    expect(getWork("missing").title).toBe("雾港纪事");
  });
});
