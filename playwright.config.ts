import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the `frontend-qa` skill's e2e / a11y / responsive specs.
 *
 * Specs live in ./e2e and use the `*.spec.ts` suffix. Vitest is configured to
 * ignore ./e2e (see vitest.config.ts) so the two runners never collide.
 *
 * `webServer` boots the Next.js dev server on :3000 and reuses an already-running
 * one if present, so `npm run test:e2e` works with or without a manual `npm run dev`.
 */
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: {
    // Tolerance for visual-regression screenshots.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
