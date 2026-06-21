import { Express } from "express";
import { getProviderHtml, getProviderIndexHtml, getProviderSlugs } from "./providers";
import { getTermHtml, getGlossaryIndexHtml, getTermSlugs } from "./glossary";
import { getFreeCareHtml, getFreeCareIndexHtml, getStateSlugs } from "./free-care";
import { getConditionHtml, getConditionsIndexHtml, getConditionSlugs } from "./conditions";
import { getDrugHtml, getDrugSavingsIndexHtml, getDrugSlugs } from "./drug-savings";
import { getSitemapXml, getRobotsTxt } from "./sitemap";

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", (_req, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getSitemapXml());
  });

  app.get("/robots.txt", (_req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(getRobotsTxt());
  });

  app.get("/providers", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getProviderIndexHtml());
  });

  app.get("/providers/:slug", (req, res, next) => {
    const html = getProviderHtml(req.params.slug);
    if (!html) return next();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/learn", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getGlossaryIndexHtml());
  });

  app.get("/learn/:slug", (req, res, next) => {
    const html = getTermHtml(req.params.slug);
    if (!html) return next();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/free-care", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getFreeCareIndexHtml());
  });

  app.get("/free-care/:slug", (req, res, next) => {
    const html = getFreeCareHtml(req.params.slug);
    if (!html) return next();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/conditions", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getConditionsIndexHtml());
  });

  app.get("/conditions/:slug", (req, res, next) => {
    const html = getConditionHtml(req.params.slug);
    if (!html) return next();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  app.get("/drug-savings", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(getDrugSavingsIndexHtml());
  });

  app.get("/drug-savings/:slug", (req, res, next) => {
    const html = getDrugHtml(req.params.slug);
    if (!html) return next();
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(html);
  });

  const totalPages =
    1 + getProviderSlugs().length +
    1 + getTermSlugs().length +
    1 + getStateSlugs().length +
    1 + getConditionSlugs().length +
    1 + getDrugSlugs().length;

  console.log(`[SEO] Registered ${totalPages} programmatic SEO pages (providers: ${getProviderSlugs().length}, glossary: ${getTermSlugs().length}, free-care: ${getStateSlugs().length}, conditions: ${getConditionSlugs().length}, drugs: ${getDrugSlugs().length})`);
}
