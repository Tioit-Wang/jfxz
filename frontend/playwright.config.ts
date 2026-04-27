import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command:
        "python -c \"from pathlib import Path; [Path(name).unlink(missing_ok=True) for name in ('e2e.db', 'e2e.db-shm', 'e2e.db-wal')]\" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8100",
      cwd: "../backend",
      env: {
        JFXZ_DATABASE_URL: "sqlite+aiosqlite:///./e2e.db",
        JFXZ_ENV: "test",
        JFXZ_ENABLE_PAYMENT_SIMULATOR: "true",
        JFXZ_BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        JFXZ_BOOTSTRAP_ADMIN_PASSWORD: "admin123"
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:8100/health"
    },
    {
      command: "npm run dev -- --hostname localhost --port 3100",
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:8100",
        NEXT_PUBLIC_ENABLE_TEST_PAYMENT: "true"
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://localhost:3100"
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
