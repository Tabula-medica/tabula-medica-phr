/**
 * Regression tests for the dynamic SEO endpoints in server/routes/seo-routes.ts.
 *
 * These guard against two failure modes:
 *   1. Geo landing pages being dropped from the sitemap (breaks AEO/GEO indexing).
 *   2. PUBLIC_ROUTES and the sitemap XML falling out of sync with each other.
 *
 * Wired into `npm run test:server` via scripts/run-server-tests.mjs.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { PUBLIC_ROUTES, buildSitemapXml } from "../routes/seo-routes";

const GEO_STATES = [
  "/care/california",
  "/care/texas",
  "/care/florida",
  "/care/new-york",
  "/care/illinois",
  "/care/georgia",
  "/care/pennsylvania",
  "/care/ohio",
  "/care/arizona",
  "/care/north-carolina",
  "/care/oklahoma",
  "/care/mississippi",
  "/care/missouri",
];

test("PUBLIC_ROUTES includes all 13 geo landing pages", () => {
  const paths = PUBLIC_ROUTES.map((r) => r.path);
  for (const geo of GEO_STATES) {
    assert.ok(paths.includes(geo), `PUBLIC_ROUTES missing geo path: ${geo}`);
  }
});

test("PUBLIC_ROUTES includes core public tool pages", () => {
  const paths = PUBLIC_ROUTES.map((r) => r.path);
  const required = [
    "/",
    "/symptom-checker",
    "/find-free-care",
    "/drug-savings",
    "/insurance-learning",
    "/faq",
  ];
  for (const path of required) {
    assert.ok(paths.includes(path), `PUBLIC_ROUTES missing required path: ${path}`);
  }
});

test("PUBLIC_ROUTES does not include authenticated / PHI surfaces", () => {
  const paths = PUBLIC_ROUTES.map((r) => r.path);
  const forbidden = [
    "/api",
    "/dashboard",
    "/patient",
    "/provider",
    "/timeline",
    "/health-records",
    "/settings",
  ];
  for (const path of forbidden) {
    assert.ok(
      !paths.some((p) => p.startsWith(path)),
      `PUBLIC_ROUTES should not contain PHI/auth path: ${path}`,
    );
  }
});

test("buildSitemapXml returns valid XML envelope", () => {
  const xml = buildSitemapXml();
  assert.ok(xml.startsWith("<?xml"), "sitemap must start with XML declaration");
  assert.ok(xml.includes("<urlset"), "sitemap must contain <urlset>");
  assert.ok(
    xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
    "sitemap must declare the sitemaps namespace",
  );
  assert.ok(xml.includes("</urlset>"), "sitemap must close </urlset>");
});

test("buildSitemapXml includes all 13 geo landing page URLs", () => {
  const xml = buildSitemapXml();
  for (const geo of GEO_STATES) {
    assert.ok(
      xml.split(`<loc>https://tabulamedica.health${geo}</loc>`).length === 2,
      `sitemap XML must contain geo URL exactly once: ${geo}`,
    );
  }
});

test("buildSitemapXml includes hreflang links for the homepage", () => {
  const xml = buildSitemapXml();
  assert.ok(
    xml.includes('hreflang="en"'),
    "sitemap must include hreflang=en for the homepage",
  );
  assert.ok(
    xml.includes('hreflang="x-default"'),
    "sitemap must include hreflang=x-default for the homepage",
  );
});

test("every PUBLIC_ROUTES entry has a valid priority between 0.0 and 1.0", () => {
  for (const entry of PUBLIC_ROUTES) {
    const priority = parseFloat(entry.priority);
    assert.ok(
      !Number.isNaN(priority) && priority >= 0 && priority <= 1,
      `${entry.path} has invalid priority: ${entry.priority}`,
    );
  }
});

test("every PUBLIC_ROUTES entry has a non-empty changefreq", () => {
  const validFreqs = new Set([
    "always",
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "yearly",
    "never",
  ]);
  for (const entry of PUBLIC_ROUTES) {
    assert.ok(
      validFreqs.has(entry.changefreq),
      `${entry.path} has invalid changefreq: ${entry.changefreq}`,
    );
  }
});
