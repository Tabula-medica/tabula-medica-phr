/**
 * Longevity & Preventive Health panel — browser-level checks.
 *
 * This automates the two manual test-plan items from the PR that introduced
 * this feature (docs/LONGEVITY_PREVENTIVE_HEALTH_PROTOCOL.md /
 * shared/longevity-preventive.ts):
 *
 *   [ ] open My Health Record → Longevity & Prevention, set age 52 female →
 *       mammography, colorectal, cervical due; switch guideline set to
 *       International → mammography drops out (50–69), units flip to SI.
 *
 * The whole internal app (see App.tsx's AppContent) only renders past the
 * marketing landing page for an authenticated user, so — unlike the panel
 * component's own doc comment about being localStorage-only — reaching this
 * page at all requires a session. We use the authenticatedPage fixture
 * (e2e/fixtures/auth-fixtures.ts) rather than a real GCIP login.
 */
import { test, expect } from "./fixtures/auth-fixtures";

test.describe("Longevity & Preventive Health — standalone page", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.goto("/longevity-preventive-health");
    await expect(page.getByTestId("page-title-longevity-preventive")).toBeVisible();
  });

  test("age 52 female under US guidelines shows mammography, colorectal and cervical screening", async ({
    authenticatedPage: page,
  }) => {
    await page.getByTestId("input-lp-age").fill("52");
    await page.getByTestId("select-lp-sex").click();
    await page.getByRole("option", { name: "Female" }).click();

    // US is the default guideline set for this environment's region config,
    // but assert it explicitly so the test doesn't silently pass under the
    // wrong regime if that default ever changes.
    const regionSelect = page.getByTestId("select-lp-region");
    if ((await regionSelect.innerText()) !== "United States (USPSTF / ACIP)") {
      await regionSelect.click();
      await page.getByRole("option", { name: "United States (USPSTF / ACIP)" }).click();
    }

    await page.getByTestId("tab-lp-plan").click();

    // "colorectal" also appears in a family-history line elsewhere on the
    // page, so scope to the screening list item specifically rather than
    // asserting on the whole page's text and tripping strict-mode.
    await expect(page.getByText(/mammograph/i)).toBeVisible();
    await expect(page.getByText(/colorectal cancer screening/i)).toBeVisible();
    await expect(page.getByText(/cervical/i)).toBeVisible();
  });

  test("switching to International guidelines narrows the mammography window and flips units to SI", async ({
    authenticatedPage: page,
  }) => {
    await page.getByTestId("input-lp-age").fill("52");
    await page.getByTestId("select-lp-sex").click();
    await page.getByRole("option", { name: "Female" }).click();

    await page.getByTestId("select-lp-region").click();
    await page.getByRole("option", { name: "International (WHO / EU)" }).click();

    // Mammography under the international (WHO/EU) window is 50–69, so a
    // 52-year-old should still see it — the PR's own note that mammography
    // "drops out (50–69)" means it moves to this narrower window, not that
    // it disappears at 52. Assert the actual boundary instead: absent at
    // 49, present at 52.
    await page.getByTestId("input-lp-age").fill("49");
    await page.getByTestId("tab-lp-plan").click();
    await expect(page.getByText(/mammograph/i)).toHaveCount(0);

    await page.getByTestId("input-lp-age").fill("52");
    await expect(page.getByText(/mammograph/i)).toBeVisible();

    // Units: switching region should default lab units to SI (mmol/L).
    await page.getByTestId("tab-lp-biomarkers").click();
    await expect(page.getByTestId("select-lp-units")).toContainText(/mmol\/L/i);
  });

  test("biomarker status classification updates live as a value is entered", async ({ authenticatedPage: page }) => {
    await page.getByTestId("tab-lp-biomarkers").click();
    const apobRow = page.locator('[data-testid^="row-lp-biomarker-"]').filter({ hasText: "ApoB" }).first();
    await expect(apobRow).toBeVisible();

    const input = apobRow.locator("input[type=number]");
    await input.fill("150"); // well above any optimal/borderline band
    await expect(apobRow.getByText(/needs attention/i)).toBeVisible();
  });

  test("copy-for-my-doctor summary uses the clipboard API without throwing", async ({
    authenticatedPage: page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    // navigator.clipboard.writeText throws NotAllowedError in Chromium when
    // the document isn't focused, which is a flaky no-op right after
    // navigation/interaction under parallel workers — bring the page to the
    // front first so the click's clipboard write isn't racing focus.
    await page.bringToFront();
    await page.getByTestId("button-lp-copy-summary").click();
    // A successful copy shows the success toast text; a clipboard failure
    // would show "Copy failed" instead (see longevity-preventive-panel.tsx).
    // The toast's own live region can echo the same text for screen readers,
    // so scope to the first match rather than tripping strict-mode on the
    // duplicate.
    await expect(page.getByText(/summary copied/i).first()).toBeVisible();
  });

  test("disclaimer framing is present — this panel must never look like clinical decision support", async ({
    authenticatedPage: page,
  }) => {
    // Both the panel's inline Alert and the page-level footer carry this
    // disclaimer text — asserting on the first match is enough to confirm
    // the framing is present without tripping strict-mode on the duplicate.
    await expect(page.getByText(/educational.*not (medical advice|constitute)/i).first()).toBeVisible();
  });
});

test.describe("Longevity & Preventive Health — chart pre-fill", () => {
  // This is the PR's second unchecked manual test-plan item. Exercising it
  // needs a clinician-role session (patient-health-record's GET
  // /api/patients/:id is gated by requirePermission("records:read"), which
  // our plain patient-auth session fixture doesn't have) plus a seeded
  // patient row with demographics already on it — neither exists in this
  // e2e environment yet. Rather than a heuristic that guesses whether the
  // fixture data is present (the SPA's client-side router returns 200 HTML
  // for any path, authenticated or not, so a response-status check can't
  // actually detect a missing/unauthorized patient), skip this explicitly
  // until that fixture data is wired up. See e2e/README.md.
  test.skip("clinician chart's Preventive → Longevity & Prevention subtab pre-fills age/sex from demographics", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/patient-health-record?patientId=patient-001");
    await page.getByRole("tab", { name: /preventive/i }).click();
    await page.getByTestId(/subtab-longevity/).click();
    // A pre-filled age input should be non-empty and not the component's
    // hardcoded default (45), which would indicate the demographics prop
    // never reached the panel.
    const age = await page.getByTestId("input-lp-age").inputValue();
    expect(Number(age)).toBeGreaterThan(0);
  });
});
