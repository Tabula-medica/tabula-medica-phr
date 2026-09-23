/**
 * Playwright fixtures that add an `authenticatedPage` (and the `testUser`
 * claims behind it) to every test that imports `test`/`expect` from here
 * instead of from "@playwright/test" directly.
 *
 * Each test gets its own throwaway user id and session row, cleaned up
 * after the test — tests never share a session or see each other's state.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { createTestSession, SESSION_COOKIE_NAME, type TestUserClaims } from "./session";

export interface AuthFixtures {
  testUser: TestUserClaims;
  authenticatedPage: Page;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use, testInfo) => {
    const unique = `${testInfo.workerIndex}-${Date.now()}`;
    await use({
      sub: `e2e-user-${unique}`,
      email: `e2e-${unique}@tabulamedica.test`,
      first_name: "E2E",
      last_name: "Tester",
    });
  },

  authenticatedPage: async ({ browser, baseURL, testUser }, use) => {
    const session = await createTestSession(testUser);
    const url = new URL(baseURL ?? "http://localhost:8080");

    const context = await browser.newContext();
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: session.cookieValue,
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax",
      },
    ]);

    // Every fresh browser context has no localStorage history, so the
    // first-run welcome tour (welcome-modal.tsx) and the "Choose Your
    // Language" onboarding dialog (onboarding.tsx) would otherwise pop up
    // and their backdrops would intercept clicks in every test. Mark both
    // seen up front — neither tour is what these tests are checking.
    await context.addInitScript(() => {
      window.localStorage.setItem("tabula:welcome-seen-v1", new Date().toISOString());
      window.localStorage.setItem(
        "tabula_medica_onboarding",
        JSON.stringify({ completed: true, currentStep: 0, stepsCompleted: [], skipped: false }),
      );
    });

    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
      await session.cleanup();
    }
  },
});

export { expect };
