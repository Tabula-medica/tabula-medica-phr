import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for tabula-medica-phr.
 *
 * These tests exercise auth boundaries and PHI-access-control behavior
 * end-to-end, against a real running instance of the app (not mocks). They
 * assume:
 *   - DATABASE_URL points at a disposable Postgres database with the schema
 *     pushed (`npm run db:push`).
 *   - The app is either already running at PLAYWRIGHT_BASE_URL, or Playwright
 *     starts it itself via `webServer` below (CI default).
 *
 * Run locally:
 *   DATABASE_URL=postgresql://... npx playwright test
 *
 * Run against an already-running dev server (faster iteration):
 *   PLAYWRIGHT_BASE_URL=http://localhost:8080 npx playwright test --project=chromium
 */
const PORT = process.env.PORT || 8080;
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;
const reuseExistingServer = Boolean(process.env.PLAYWRIGHT_BASE_URL) || !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Sandboxes that pre-provision Chromium (e.g. Claude Code's web
        // environment) set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD and stage the
        // binary at a fixed path outside Playwright's own version-pinned
        // cache. Point at it there instead of trying to download a browser
        // the sandbox's network policy won't serve; everywhere else
        // (local dev, CI) this is unset and Playwright uses its normal
        // managed browser as usual.
        ...(process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD ? { launchOptions: { executablePath: "/opt/pw-browsers/chromium" } } : {}),
      },
    },
  ],
  // Only auto-start the server when the caller hasn't pointed us at one
  // already running (PLAYWRIGHT_BASE_URL) and required env vars are present.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npx tsx server/index.ts",
        url: baseURL,
        reuseExistingServer,
        timeout: 60_000,
        env: {
          NODE_ENV: "development",
          PORT: String(PORT),
        },
      },
});
