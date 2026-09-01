import { describe, it, expect } from "vitest";
import { getSitemapXml, getRobotsTxt, getSitemapUrls, __testing } from "../server/seo/sitemap";
import { SITE_URL } from "../server/seo/ssr-shared";

const { MARKETING_PATHS, DISALLOWED_PREFIXES, AI_CRAWLERS } = __testing;

describe("sitemap", () => {
  const xml = getSitemapXml();
  const urls = getSitemapUrls();

  it("is well-formed and non-empty", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    expect(urls.length).toBeGreaterThan(MARKETING_PATHS.length);
  });

  it("lists every marketing page", () => {
    for (const { path } of MARKETING_PATHS) {
      const expected = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
      expect(urls, `missing ${path}`).toContain(expected);
    }
  });

  it("lists the programmatic pages, not just their hubs", () => {
    // The hand-maintained sitemap this replaced listed only the hubs, leaving
    // every generated page out of the index.
    for (const hub of ["/providers/", "/learn/", "/free-care/", "/conditions/", "/drug-savings/"]) {
      const children = urls.filter((u) => u.startsWith(`${SITE_URL}${hub}`));
      expect(children.length, `no pages under ${hub}`).toBeGreaterThan(0);
    }
  });

  it("uses one absolute canonical origin for every entry", () => {
    for (const url of urls) {
      expect(url.startsWith(SITE_URL), `not canonical: ${url}`).toBe(true);
    }
    expect(SITE_URL).toBe("https://tabulamedica.health");
  });

  it("has no duplicate entries", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("never advertises a path that can render PHI", () => {
    for (const url of urls) {
      const path = url.slice(SITE_URL.length) || "/";
      for (const prefix of DISALLOWED_PREFIXES) {
        expect(path.startsWith(prefix), `${path} is crawl-disallowed but listed`).toBe(false);
      }
    }
  });
});

describe("robots.txt", () => {
  const robots = getRobotsTxt();

  it("points at the sitemap on the canonical origin", () => {
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it("disallows every PHI-bearing prefix", () => {
    for (const prefix of DISALLOWED_PREFIXES) {
      expect(robots, `missing Disallow for ${prefix}`).toContain(`Disallow: ${prefix}`);
    }
  });

  it("welcomes the AI and answer-engine crawlers by name", () => {
    for (const agent of AI_CRAWLERS) {
      expect(robots, `missing allow block for ${agent}`).toContain(`User-agent: ${agent}\nAllow: /`);
    }
  });

  it("allows the default crawler", () => {
    expect(robots).toMatch(/User-agent: \*\nAllow: \//);
  });
});
