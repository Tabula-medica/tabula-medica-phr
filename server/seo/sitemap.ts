import { SITE_URL } from "./ssr-shared";
import { getProviderSlugs } from "./providers";
import { getTermSlugs } from "./glossary";
import { getStateSlugs } from "./free-care";
import { getConditionSlugs } from "./conditions";
import { getDrugSlugs } from "./drug-savings";

function xmlEntry(loc: string, changefreq: string, priority: string): string {
  return `<url><loc>${loc}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export function getSitemapXml(): string {
  const urls: string[] = [];

  urls.push(xmlEntry(SITE_URL, "daily", "1.0"));
  urls.push(xmlEntry(`${SITE_URL}/providers`, "weekly", "0.8"));
  urls.push(xmlEntry(`${SITE_URL}/learn`, "weekly", "0.8"));
  urls.push(xmlEntry(`${SITE_URL}/free-care`, "weekly", "0.8"));
  urls.push(xmlEntry(`${SITE_URL}/conditions`, "weekly", "0.8"));
  urls.push(xmlEntry(`${SITE_URL}/drug-savings`, "weekly", "0.8"));

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
  return `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
