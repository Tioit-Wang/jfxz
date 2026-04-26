import { describe, expect, it } from "vitest";
import { securityHeaders } from "../next.config";

function valuesFor(isProduction: boolean, apiBase = "https://api.example.com") {
  return Object.fromEntries(securityHeaders(isProduction, apiBase).map((header) => [header.key, header.value]));
}

describe("next security headers", () => {
  it("sets baseline security headers", async () => {
    const values = valuesFor(false);

    expect(values["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(values["Content-Security-Policy"]).toContain("object-src 'none'");
    expect(values["Content-Security-Policy"]).toContain("connect-src 'self' https://api.example.com");
    expect(values["Content-Security-Policy"]).toContain("'unsafe-eval'");
    expect(values["X-Frame-Options"]).toBe("DENY");
    expect(values["X-Content-Type-Options"]).toBe("nosniff");
    expect(values["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(values["Permissions-Policy"]).toContain("camera=()");
  });

  it("adds hsts and removes unsafe eval in production", async () => {
    const values = valuesFor(true);

    expect(values["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(values["Strict-Transport-Security"]).toContain("max-age=63072000");
  });
});
