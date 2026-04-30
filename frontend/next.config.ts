import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const repoRoot = path.resolve(__dirname, "..");

loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production", console, true);

export function apiOrigin(baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!baseUrl) {
    return "http://localhost:8000";
  }
  try {
    return new URL(baseUrl).origin;
  } catch {
    return "http://localhost:8000";
  }
}

function productionSecurityHeaders(): boolean {
  return process.env.NODE_ENV === "production" || process.env.JFXZ_FRONTEND_PRODUCTION_HEADERS === "true";
}

export function securityHeaders(isProduction = productionSecurityHeaders(), apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL) {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])];
  const headers = [
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        `script-src ${scriptSrc.join(" ")}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `connect-src 'self' ${apiOrigin(apiBaseUrl)} ws: wss:`,
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join("; ")
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
  ];
  if (isProduction) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders()
      }
    ];
  }
};

export default nextConfig;
