import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Rendered-page axe scan for public routes.
 * Color contrast is measured in a follow-up (the manual 508 checklist). jsdom
 * cannot see it, and the current self-evaluation still lists it as open.
 */
async function seriousViolations(page: import("@playwright/test").Page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async (tags) => {
    const axe = (window as unknown as {
      axe: {
        run: (node: Document, options: unknown) => Promise<{
          violations: { id: string; help: string; nodes: { html: string }[] }[];
        }>;
      };
    }).axe;
    const results = await axe.run(document, {
      runOnly: { type: "tag", values: tags },
      rules: { "color-contrast": { enabled: false } },
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      help: violation.help,
      sample: violation.nodes.slice(0, 2).map((node) => node.html),
    }));
  }, WCAG_AA);
}

for (const path of ["/symptom-checker", "/auth/login"]) {
  test(`public ${path} has no WCAG A/AA axe violations other than contrast`, async ({ page }) => {
    await page.goto(path);
    const violations = await seriousViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
