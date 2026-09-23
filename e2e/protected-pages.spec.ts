/**
 * Protected-page network checks.
 *
 * The client does not gate rendering on auth state (see use-auth.ts,
 * my-health-record.tsx) — the backend is the trust boundary. So the
 * meaningful check here isn't "does the page redirect" (it may not), it's
 * "does any network response reaching the unauthenticated browser actually
 * contain PHI". We intercept every response while the page loads and assert
 * none of the PHI-shaped endpoints returned a 2xx with a body.
 */
import { test, expect } from "@playwright/test";

const PHI_PAGES = ["/my-health-record", "/patient-health-record"];

// Response URL fragments that would carry PHI if they ever leaked to a
// logged-out browser. Extend this list as new PHI endpoints are added.
const PHI_ENDPOINT_FRAGMENTS = [
  "/api/health-record",
  "/api/medications",
  "/api/lab-results",
  "/api/longevity-preventive/entries",
];

test.describe("Unauthenticated page loads never surface PHI over the network", () => {
  for (const path of PHI_PAGES) {
    test(`${path} — no PHI endpoint returns 2xx to a logged-out browser`, async ({ page }) => {
      const leaks: string[] = [];
      page.on("response", (response) => {
        const url = response.url();
        if (PHI_ENDPOINT_FRAGMENTS.some((f) => url.includes(f)) && response.ok()) {
          leaks.push(`${response.status()} ${url}`);
        }
      });

      await page.goto(path, { waitUntil: "networkidle" }).catch(() => {
        // Some of these pages may redirect or fail to fully settle
        // unauthenticated (e.g. an auth-check timeout); that's fine — we
        // only care whether any PHI response slipped through above.
      });

      expect(leaks, `PHI-shaped endpoint(s) returned success to an unauthenticated browser: ${leaks.join(", ")}`).toEqual(
        [],
      );
    });
  }

  test("the login entry point is reachable", async ({ page }) => {
    const response = await page.goto("/auth/login");
    expect(response?.status(), "expected /auth/login to load, not error").toBeLessThan(400);
  });
});
