import { SITE_URL } from "./ssr-shared";
import { getProviderSlugs } from "./providers";
import { getTermSlugs } from "./glossary";
import { getStateSlugs } from "./free-care";
import { getConditionSlugs } from "./conditions";
import { getDrugSlugs } from "./drug-savings";

/**
 * Every public path that search engines and answer engines should index,
 * outside the programmatic slug sets below.
 *
 * This is the single source of truth for the sitemap. It replaces the
 * hand-maintained `client/public/sitemap.xml`, which listed the marketing
 * pages but none of the hundreds of programmatic ones, and which drifted
 * from the routes the app actually serves.
 *
 * A path belongs here only if an anonymous visitor can reach real content at
 * it. Anything behind authentication is excluded here and disallowed in
 * `getRobotsTxt()` — those pages hold PHI.
 */
const MARKETING_PATHS: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },

  // Section hubs, each backed by a server-rendered index page.
  { path: "/providers", changefreq: "weekly", priority: "0.8" },
  { path: "/learn", changefreq: "weekly", priority: "0.8" },
  { path: "/free-care", changefreq: "weekly", priority: "0.8" },
  { path: "/conditions", changefreq: "weekly", priority: "0.8" },
  { path: "/drug-savings", changefreq: "weekly", priority: "0.8" },

  // Free patient-facing tools that need no account.
  { path: "/symptom-checker", changefreq: "monthly", priority: "0.9" },
  { path: "/drug-interactions", changefreq: "monthly", priority: "0.8" },
  { path: "/prior-auth-letter", changefreq: "monthly", priority: "0.7" },
  { path: "/care/find-a-doctor", changefreq: "weekly", priority: "0.7" },

  // Explanatory and trust pages — the surfaces answer engines quote from.
  { path: "/faq", changefreq: "monthly", priority: "0.9" },
  { path: "/security", changefreq: "monthly", priority: "0.8" },
  { path: "/about/security", changefreq: "monthly", priority: "0.7" },
  { path: "/trust-center", changefreq: "monthly", priority: "0.7" },
  { path: "/insurance-learning", changefreq: "monthly", priority: "0.7" },
  { path: "/uninsured-resources", changefreq: "monthly", priority: "0.7" },

  // Legal and policy.
  { path: "/legal/accessibility", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.5" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.5" },
  { path: "/legal/hipaa-notice", changefreq: "yearly", priority: "0.4" },
  { path: "/beta-consent", changefreq: "monthly", priority: "0.4" },
];

/**
 * Kept as a defense-in-depth cross-check (see the sitemap test below), not as
 * the mechanism that keeps crawlers off PHI — that's `getRobotsTxt()`, which
 * is an ALLOWLIST (see its comment). `client/src/App.tsx` registers hundreds
 * of authenticated routes as flat top-level paths (`/patients`, `/timeline`,
 * `/settings`, `/medications`, `/my-health-record`, ...), not under a
 * consistent directory prefix, so a prefix-based disallow list can only ever
 * be an incomplete, actively-maintained blocklist — every new authenticated
 * route is crawlable by default until someone remembers to add it here. This
 * list exists only to assert the sitemap itself never advertises one of these
 * by mistake.
 */
const DISALLOWED_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin/",
  "/dashboard",
  "/patient",
  "/provider-onboarding",
  "/clinician",
  "/settings",
  "/onboarding",
  "/consent",
  "/share",
  "/timeline",
  "/health-records",
  "/my-health-record",
  "/medications",
  "/my-profile",
  "/my-health-goals",
  "/billing",
  "/notifications",
  "/achievements",
  "/compliance-dashboard",
];

/**
 * Crawlers we explicitly welcome. The default `User-agent: *` block already
 * allows them, but several CDN "block AI scrapers" presets disallow these by
 * name; naming them here states the intent that Tabula Medica *wants* to be
 * quotable by answer engines (AEO) and generative search (GEO).
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "Googlebot",
  "ClaudeBot",
  "Claude-Web",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "Bingbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Amazonbot",
  "DuckAssistBot",
  "MistralAI-User",
  "YouBot",
];

function xmlEntry(loc: string, changefreq: string, priority: string): string {
  return `<url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

/** Absolute URLs for every indexable page, marketing and programmatic. */
export function getSitemapUrls(): string[] {
  const urls = MARKETING_PATHS.map((entry) =>
    entry.path === "/" ? SITE_URL : `${SITE_URL}${entry.path}`,
  );
  for (const slug of getProviderSlugs()) urls.push(`${SITE_URL}/providers/${slug}`);
  for (const slug of getTermSlugs()) urls.push(`${SITE_URL}/learn/${slug}`);
  for (const slug of getStateSlugs()) urls.push(`${SITE_URL}/free-care/${slug}`);
  for (const slug of getConditionSlugs()) urls.push(`${SITE_URL}/conditions/${slug}`);
  for (const slug of getDrugSlugs()) urls.push(`${SITE_URL}/drug-savings/${slug}`);
  return urls;
}

export function getSitemapXml(): string {
  const urls: string[] = MARKETING_PATHS.map((entry) =>
    xmlEntry(
      entry.path === "/" ? SITE_URL : `${SITE_URL}${entry.path}`,
      entry.changefreq,
      entry.priority,
    ),
  );

  for (const slug of getProviderSlugs()) {
    urls.push(xmlEntry(`${SITE_URL}/providers/${slug}`, "monthly", "0.7"));
  }
  for (const slug of getTermSlugs()) {
    urls.push(xmlEntry(`${SITE_URL}/learn/${slug}`, "monthly", "0.6"));
  }
  for (const slug of getStateSlugs()) {
    urls.push(xmlEntry(`${SITE_URL}/free-care/${slug}`, "monthly", "0.7"));
  }
  for (const slug of getConditionSlugs()) {
    urls.push(xmlEntry(`${SITE_URL}/conditions/${slug}`, "monthly", "0.7"));
  }
  for (const slug of getDrugSlugs()) {
    urls.push(xmlEntry(`${SITE_URL}/drug-savings/${slug}`, "monthly", "0.7"));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

/** Section hubs with programmatically-generated child pages under them. */
const ALLOWED_HUB_PREFIXES = ["/providers/", "/learn/", "/free-care/", "/conditions/", "/drug-savings/"];

/**
 * The full allow list for one `User-agent` block: every public path, then a
 * blanket `Disallow: /`. This is deliberately an ALLOWLIST, not the more
 * common "allow everything, disallow the paths we thought of" — the app has
 * hundreds of authenticated routes with no shared prefix (see the comment on
 * `DISALLOWED_PREFIXES`), so a disallow list is always one new route behind.
 * An allowlist fails closed instead: a route only becomes crawlable once it
 * is deliberately added to `MARKETING_PATHS` or `ALLOWED_HUB_PREFIXES` for
 * the sitemap, so the two can never drift apart.
 *
 * Each named crawler group gets its own copy of this block. Per the robots.txt
 * spec a `User-agent: <name>` group that matches does NOT fall back to
 * `User-agent: *` — it is a fresh rule set. A named AI crawler that only got
 * `Allow: /` (the previous version of this file) was therefore permitted onto
 * every authenticated route the default group disallowed.
 */
function robotsBlock(agent: string): string {
  const allows = [
    "Allow: /$",
    ...MARKETING_PATHS.filter((entry) => entry.path !== "/").map((entry) => `Allow: ${entry.path}`),
    ...ALLOWED_HUB_PREFIXES.map((prefix) => `Allow: ${prefix}`),
  ];
  return `User-agent: ${agent}\n${allows.join("\n")}\nDisallow: /`;
}

export function getRobotsTxt(): string {
  const aiBlocks = AI_CRAWLERS.map((agent) => robotsBlock(agent)).join("\n\n");

  return `# Tabula Medica — robots.txt
# Generated by server/seo/sitemap.ts. This is an allowlist: every path below
# is explicitly opened, and everything else — including every authenticated
# route, which can render protected health information — is disallowed by
# the trailing "Disallow: /" in each block. Public marketing, educational and
# free-tool pages are open to every crawler, including the AI crawlers named
# below, so the product can be described accurately in AI answers.

${robotsBlock("*")}

# --- Explicitly welcomed AI and answer-engine crawlers (AEO / GEO) — each
# gets its own copy of the same allowlist above, not just "Allow: /", because
# a named User-agent group does not inherit the default group's rules. ---

${aiBlocks}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export const __testing = { MARKETING_PATHS, DISALLOWED_PREFIXES, AI_CRAWLERS };
