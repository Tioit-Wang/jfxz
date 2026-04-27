import { describe, expect, it } from "vitest";
import { generatedMultiplier } from "../src/model-billing";

describe("admin model billing helpers", () => {
  it("generates multipliers with markup and rounds upward to two decimals", () => {
    expect(generatedMultiplier("1", "10")).toBe("0.11");
    expect(generatedMultiplier("24", "10")).toBe("2.64");
    expect(generatedMultiplier("0.01", "10")).toBe("0.01");
  });

  it("rejects invalid cost generator inputs", () => {
    expect(generatedMultiplier("", "10")).toBeNull();
    expect(generatedMultiplier("1", "-1")).toBeNull();
    expect(generatedMultiplier("bad", "10")).toBeNull();
  });

  it("returns 0.00 when cost is zero (free model)", () => {
    expect(generatedMultiplier("0", "10")).toBe("0.00");
  });

  it("returns base multiplier when markup rate is zero", () => {
    expect(generatedMultiplier("10", "0")).toBe("1.00");
  });

  it("trims whitespace from inputs", () => {
    expect(generatedMultiplier(" 1 ", " 10 ")).toBe("0.11");
  });

  it("handles extremely large values", () => {
    const result = generatedMultiplier("99999", "10");
    expect(result).not.toBeNull();
    // 99999 * 1.1 / 10 = 10999.89, ceil(10999.89 * 100) / 100 = 10999.90
    expect(result).toBe("10999.90");
  });

  it("rejects negative cost", () => {
    expect(generatedMultiplier("-1", "10")).toBeNull();
  });

  it("returns null when both inputs are empty", () => {
    expect(generatedMultiplier("", "")).toBeNull();
  });
});
