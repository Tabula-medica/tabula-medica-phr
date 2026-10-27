import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { INDEXABLE_ROUTES, resolveRobotsContent } from "@/lib/robots-policy";
import {
  buildSiteNavigationSchema,
  INDEXABLE_ROBOTS,
  NOINDEX_ROBOTS,
} from "@/hooks/use-seo";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
// client/src/lib/__tests__ -> client/public/sitemap.xml
const SITEMAP_PATH = path.resolve(
  thisDir,
  "..",
  "..",
  "..",
  "public",
  "sitemap.xml",
);
// client/src/lib/__tests__ -> client/public/robots.txt
const ROBOTS_PATH = path.resolve(
  thisDir,
  "..",
  "..",
  "..",
  "public",
  "robots.txt",
);

// client/src/lib/__tests__ -> client/index.html
const INDEX_HTML_PATH = path.resolve(
  thisDir,
  "..",
  "..",
  "..",
  "index.html",
);

const SITE_ORIGIN = "https://tabulamedica.health";

function indexHtmlRobotsContent(): string {
  const html = readFileSync(INDEX_HTML_PATH, "utf-8");
  const match = html.match(
    /<meta\s+name="robots"\s+content="([^"]*)"\s*\/?>/is,
  );
  if (!match) {
    throw new Error(
      'Could not find <meta name="robots"> in web/client/index.html',
    );
  }
  return match[1].trim();
}

function sitemapRoutes(): Set<string> {
  const xml = readFileSync(SITEMAP_PATH, "utf-8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].trim(),
  );
  return new Set(
    locs.map((loc) => {
      const withoutOrigin = loc.startsWith(SITE_ORIGIN)
        ? loc.slice(SITE_ORIGIN.length)
        : loc;
      // Normalize the bare-origin "https://.../" to the "/" route and strip any
      // trailing slash from deeper paths so the comparison is path-for-path.
      if (withoutOrigin === "" || withoutOrigin === "/") return "/";
      return withoutOrigin.replace(/\/$/, "");
    }),
  );
}

describe("robots indexable-route policy", () => {
  it("site navigation advertises only public, indexable, crawlable routes", () => {
    const { hasPart } = buildSiteNavigationSchema();
    const rules = parseStarGroupRules();

    expect(hasPart.length).toBeGreaterThan(0);
    const invalidUrls = hasPart
      .filter(({ url }) => {
        const parsed = new URL(url);
        return (
          parsed.origin !== SITE_ORIGIN ||
          !INDEXABLE_ROUTES.has(parsed.pathname) ||
          isDisallowed(parsed.pathname + parsed.search, rules)
        );
      })
      .map(({ url }) => url);

    expect(
      invalidUrls,
      `Navigation URLs must belong to INDEXABLE_ROUTES and not be Disallowed by robots.txt: ${invalidUrls.join(", ")}`,
    ).toEqual([]);
  });

  it("INDEXABLE_ROUTES exactly matches the route set in sitemap.xml", () => {
    const fromSitemap = sitemapRoutes();
    const fromAllowlist = INDEXABLE_ROUTES;

    const missingFromAllowlist = [...fromSitemap].filter(
      (r) => !fromAllowlist.has(r),
    );
    const missingFromSitemap = [...fromAllowlist].filter(
      (r) => !fromSitemap.has(r),
    );

    expect(
      missingFromAllowlist,
      `Routes in sitemap.xml but NOT in INDEXABLE_ROUTES (would 404 the crawler or drift): ${missingFromAllowlist.join(", ")}`,
    ).toEqual([]);
    expect(
      missingFromSitemap,
      `Routes in INDEXABLE_ROUTES but NOT in sitemap.xml (search engines won't discover them, or a private page was re-exposed): ${missingFromSitemap.join(", ")}`,
    ).toEqual([]);

    // Belt-and-suspenders: identical size + identical members.
    expect([...fromAllowlist].sort()).toEqual([...fromSitemap].sort());
  });

  it("index.html <meta name=robots> exactly matches INDEXABLE_ROBOTS", () => {
    expect(
      indexHtmlRobotsContent(),
      "The site-wide robots default in web/client/index.html drifted from " +
        "INDEXABLE_ROBOTS in use-seo.ts. A page that opts back into indexing " +
        "(noindex: false) would then advertise a different crawl/snippet " +
        "policy than the rest of the site. Keep the two strings identical.",
    ).toBe(INDEXABLE_ROBOTS);
  });

  it("yields noindex,nofollow for private authenticated routes", () => {
    const privateRoutes = [
      "/medications",
      "/vitals",
      "/timeline",
      "/lab-results",
      "/conditions",
      "/documents",
      "/messages",
      "/settings",
      "/patients",
      "/billing",
    ];
    for (const route of privateRoutes) {
      expect(
        resolveRobotsContent(route, false),
        `${route} must be noindex`,
      ).toBe(NOINDEX_ROBOTS);
      expect(
        resolveRobotsContent(route, true),
        `${route} must be noindex when authenticated`,
      ).toBe(NOINDEX_ROBOTS);
    }
  });

  it("yields index,follow for public allowlisted routes when signed out", () => {
    for (const route of INDEXABLE_ROUTES) {
      expect(
        resolveRobotsContent(route, false),
        `${route} must be indexable for signed-out visitors`,
      ).toBe(INDEXABLE_ROBOTS);
    }
  });

  it("treats the signed-in dashboard at / as a private PHI surface", () => {
    // Signed-out landing at "/" is the public marketing page (indexable).
    expect(resolveRobotsContent("/", false)).toBe(INDEXABLE_ROBOTS);
    // Signed-in, "/" is the authenticated dashboard and must be noindex.
    expect(resolveRobotsContent("/", true)).toBe(NOINDEX_ROBOTS);
  });

  it("yields noindex for unknown/typo routes (fail closed)", () => {
    expect(resolveRobotsContent("/not-a-real-route", false)).toBe(
      NOINDEX_ROBOTS,
    );
    expect(resolveRobotsContent("/drug-savings/extra", false)).toBe(
      NOINDEX_ROBOTS,
    );
  });
});

// --- robots.txt vs. indexable-allowlist cross-check ---------------------------
// robots.txt is a FOURTH source of truth (after INDEXABLE_ROUTES, sitemap.xml,
// and the route-driven noindex manager). Its `Disallow:` rules block crawlers
// from authenticated/PHI surfaces. Two ways this can drift dangerously:
//   1. A public page is added to the allowlist/sitemap but happens to sit under
//      a Disallowed prefix — it's advertised as indexable yet blocked from being
//      crawled, so it never gets indexed (silent SEO loss).
//   2. A Disallow rule is loosened/removed and re-exposes a private app shell to
//      crawlers.
// These tests reimplement the relevant subset of the robots.txt matching spec
// (longest-match-wins, Allow beats Disallow on a tie, `*` wildcard, `$` anchor)
// and assert both directions hold.

type RobotsRule = { type: "allow" | "disallow"; pattern: string };

// Parse the `User-agent: *` group's Allow/Disallow rules out of robots.txt.
// robots.txt has exactly one consolidated `*` group (see the file header), but
// we still scope to it so a future per-bot group can't leak rules in here.
function parseStarGroupRules(): RobotsRule[] {
  const txt = readFileSync(ROBOTS_PATH, "utf-8");
  const rules: RobotsRule[] = [];
  let inStarGroup = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "user-agent") {
      inStarGroup = value === "*";
      continue;
    }
    if (!inStarGroup || !value) continue;
    if (field === "allow") rules.push({ type: "allow", pattern: value });
    else if (field === "disallow")
      rules.push({ type: "disallow", pattern: value });
  }
  return rules;
}

// Returns the match-specificity length if `pattern` matches `urlPath`, else null.
// Specificity = length of the pattern path (excluding a trailing `$`), which is
// how Google's robots parser ranks competing Allow/Disallow rules.
function matchSpecificity(pattern: string, urlPath: string): number | null {
  const anchored = pattern.endsWith("$");
  const core = anchored ? pattern.slice(0, -1) : pattern;
  let rx = "^";
  for (const ch of core) {
    if (ch === "*") rx += ".*";
    else rx += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  if (anchored) rx += "$";
  if (!new RegExp(rx).test(urlPath)) return null;
  return core.length;
}

// Crawler decision for `urlPath`: true if the most-specific matching rule is a
// Disallow. Allow wins ties (Google spec). No matching rule => allowed.
function isDisallowed(urlPath: string, rules: RobotsRule[]): boolean {
  let best: { type: "allow" | "disallow"; len: number } | null = null;
  for (const rule of rules) {
    const len = matchSpecificity(rule.pattern, urlPath);
    if (len === null) continue;
    if (
      !best ||
      len > best.len ||
      (len === best.len && rule.type === "allow")
    ) {
      best = { type: rule.type, len };
    }
  }
  return best?.type === "disallow";
}

describe("robots.txt vs. indexable allowlist", () => {
  const rules = parseStarGroupRules();

  it("parses at least one Allow and several Disallow rules (sanity)", () => {
    expect(rules.some((r) => r.type === "allow")).toBe(true);
    expect(rules.filter((r) => r.type === "disallow").length).toBeGreaterThan(
      5,
    );
  });

  it("no INDEXABLE_ROUTES path is blocked by a robots.txt Disallow rule", () => {
    const blocked = [...INDEXABLE_ROUTES].filter((route) =>
      isDisallowed(route, rules),
    );
    expect(
      blocked,
      `These public routes are advertised as indexable but blocked by a robots.txt Disallow rule (they'd never be crawled/indexed): ${blocked.join(", ")}`,
    ).toEqual([]);
  });

  it("private sample routes are actually covered by a robots.txt Disallow rule", () => {
    // Representative private/PHI/account routes that MUST stay out of the index.
    // Includes exact app-shell rules and directory-prefix rules (trailing "/")
    // exercised via a sub-path, so this catches a Disallow rule being loosened
    // or removed. Kept aligned with the private routes in the policy test above;
    // for the trailing-slash directory rules (/settings/, /admin/, /dashboard/,
    // /patient/, /provider/, /auth/, /api/) a sub-path is used because the bare
    // path (e.g. "/settings") is NOT covered by "/settings/" under correct
    // prefix matching.
    const privateBlockedRoutes = [
      "/medications",
      "/lab-results",
      "/vitals",
      "/timeline",
      "/conditions",
      "/documents",
      "/messages",
      "/billing",
      "/connections",
      "/audit-logs",
      "/health-records",
      "/my-profile",
      "/settings/profile",
      "/admin/users",
      "/dashboard/overview",
      "/patient/12345",
      "/provider/home",
      "/auth/login",
      "/api/health-records",
    ];
    const notBlocked = privateBlockedRoutes.filter(
      (route) => !isDisallowed(route, rules),
    );
    expect(
      notBlocked,
      `These private routes are NOT covered by any robots.txt Disallow rule (a rule may have been loosened/removed, re-exposing them to crawlers): ${notBlocked.join(", ")}`,
    ).toEqual([]);
  });

  it("honors the `$` anchor: /privacy is blocked but /privacy-policy stays crawlable", () => {
    // The Disallow: /privacy$ + Allow: /privacy-policy pairing is the trickiest
    // rule in the file — verify the anchor/longest-match logic resolves it.
    expect(isDisallowed("/privacy", rules)).toBe(true);
    expect(isDisallowed("/privacy-policy", rules)).toBe(false);
  });
});
