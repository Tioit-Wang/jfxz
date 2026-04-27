import { describe, expect, it } from "vitest";
import { formatDate, money } from "../app/admin/admin-utils";

describe("admin-utils", () => {
  describe("money", () => {
    it("formats CNY with ¥ symbol", () => {
      expect(money("29.00")).toBe("¥29.00");
    });

    it("formats zero as ¥0.00", () => {
      expect(money(0)).toBe("¥0.00");
    });

    it("formats null/undefined as ¥0.00", () => {
      expect(money(null)).toBe("¥0.00");
      expect(money(undefined)).toBe("¥0.00");
    });

    it("formats other currencies with code", () => {
      expect(money("19.99", "USD")).toBe("19.99 USD");
    });

    it("handles numeric values", () => {
      expect(money(99.9)).toBe("¥99.90");
    });
  });

  describe("formatDate", () => {
    it("returns dash for null/undefined", () => {
      expect(formatDate(null)).toBe("-");
      expect(formatDate(undefined)).toBe("-");
    });

    it("returns dash for empty string", () => {
      expect(formatDate("")).toBe("-");
    });

    it("formats valid ISO date string to zh-CN short format", () => {
      const result = formatDate("2026-04-27T10:30:00Z");
      expect(result).toMatch(/\d{2}\/\d{2} \d{2}:\d{2}/);
    });

    it("returns original value for invalid date string", () => {
      expect(formatDate("not-a-date")).toBe("not-a-date");
    });
  });
});
