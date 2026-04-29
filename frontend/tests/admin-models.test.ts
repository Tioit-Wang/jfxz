import { describe, expect, it } from "vitest";
import { calculateSellingPrice } from "../src/model-billing";

describe("admin model billing helpers", () => {
  it("calculates selling price from cost and profit multiplier", () => {
    expect(calculateSellingPrice("1", "1.1")).toBe(1 * 1.1 * 10000);
    expect(calculateSellingPrice("24", "1.1")).toBe(24 * 1.1 * 10000);
    expect(calculateSellingPrice("0.01", "1.1")).toBe(0.01 * 1.1 * 10000);
  });

  it("rejects invalid inputs", () => {
    expect(calculateSellingPrice("", "1.1")).toBeNull();
    expect(calculateSellingPrice("bad", "1.1")).toBeNull();
  });

  it("rejects negative cost", () => {
    expect(calculateSellingPrice("-1", "1.1")).toBeNull();
  });

  it("returns 0 when cost is zero (free model)", () => {
    expect(calculateSellingPrice("0", "1.1")).toBe(0);
  });

  it("returns base points when profit multiplier is 1.0 (no profit)", () => {
    expect(calculateSellingPrice("10", "1.0")).toBe(10 * 1.0 * 10000);
  });

  it("handles extremely large values", () => {
    const result = calculateSellingPrice("99999", "1.1");
    expect(result).not.toBeNull();
    // 99999 * 1.1 * 10000 = 1099989000
    expect(result).toBe(1099989000);
  });

  it("supports custom points per CNY", () => {
    expect(calculateSellingPrice("1", "1.1", "5000")).toBe(1 * 1.1 * 5000);
  });

  it("returns null when both inputs are empty", () => {
    expect(calculateSellingPrice("", "")).toBeNull();
  });
});
