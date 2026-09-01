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

/** Paths that must never be crawled: everything here can render PHI. */
const DISALLOWED_PREFIXES = [
  "/api/",
  "/auth/",
  "/admin/",
  "/dashboard/",
  "/patient/",
  "/provider/",
  "/clinician/",
  "/settings/",
  "/onboarding/",
  "/consent/",
  "/share/",
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

export function getRobotsTxt(): string {
  const aiBlocks = AI_CRAWLERS.map((agent) => `User-agent: ${agent}\nAllow: /`).join("\n\n");

  return `# Tabula Medica — robots.txt
# Generated by server/seo/sitemap.ts. Public marketing, educational and
# free-tool pages are open to every crawler, including the AI crawlers named
# below, so the product can be described accurately in AI answers.
# Authenticated routes are enforced by auth at the application layer; they are
# disallowed here as well because they can render protected health information.

User-agent: *
Allow: /
${DISALLOWED_PREFIXES.map((p) => `Disallow: ${p}`).join("\n")}

# --- Explicitly welcomed AI and answer-engine crawlers (AEO / GEO) ---

${aiBlocks}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

export const __testing = { MARKETING_PATHS, DISALLOWED_PREFIXES, AI_CRAWLERS };
