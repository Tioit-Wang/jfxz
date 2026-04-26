import { describe, expect, it } from "vitest";
import { isLikelyEmail, sanitizeUserNextPath, userLoginPath } from "../src/auth";

describe("auth helpers", () => {
  it("validates email-shaped input", () => {
    expect(isLikelyEmail(" writer@example.com ")).toBe(true);
    expect(isLikelyEmail("writer")).toBe(false);
  });

  it("builds safe user login redirects", () => {
    expect(sanitizeUserNextPath("/books/w1")).toBe("/books/w1");
    expect(sanitizeUserNextPath("https://example.com")).toBe("/books");
    expect(sanitizeUserNextPath("//example.com")).toBe("/books");
    expect(sanitizeUserNextPath("/admin/users")).toBe("/books");
    expect(sanitizeUserNextPath("/login?next=%2Fbooks")).toBe("/books");
    expect(userLoginPath("/books/w1")).toBe("/login?next=%2Fbooks%2Fw1");
  });
});
