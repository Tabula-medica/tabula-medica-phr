/**
 * Competitive intel — scrape competitor EHR / PHR feature & pricing pages and
 * extract a structured comparison. Public pages only, non-PHI.
 *
 *   # single-page smoke test → prints JSON, writes nothing
 *   node competitive.mjs --url https://canvasmedical.com/pricing
 *
 *   # batch → scrape every page in competitors.json → out/competitive-<ts>.{csv,json}
 *   node competitive.mjs [--segment ehr|phr]
 *
 * For RECURRING tracking, don't cron this — use a Firecrawl monitor (see README):
 * it diffs each page and only alerts on real changes against a plain-language goal.
 *
 * Env: FIRECRAWL_API_KEY (required), CONCURRENCY (default 4).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireKey, scrapeJson, pool, toCsv } from "./lib/firecrawl.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);

const SCHEMA = {
  type: "object",
  properties: {
    vendor: { type: "string", description: "Company / product name" },
    productType: { type: "string", description: "e.g. EHR, PHR, RCM, patient portal" },
    pricingModel: { type: "string", description: "e.g. per-provider/mo, % of collections, free, quote-only" },
    pricePoints: { type: "array", items: { type: "string" }, description: "Named plans with prices if shown" },
    keyFeatures: { type: "array", items: { type: "string" }, description: "Top marketed features" },
    targetSegment: { type: "string", description: "Who it's sold to (solo, group, enterprise, patients)" },
    integrations: { type: "array", items: { type: "string" } },
  },
};
const PROMPT = "Extract this health-IT vendor's pricing model, plan prices, key marketed features, target customer segment, and integrations from the page.";

function arg(flag) { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; }

async function main() {
  requireKey();

  const url = arg("--url");
  if (url) {
    console.log(`[compete] smoke-test scraping ${url} …`);
    const j = await scrapeJson(url, { prompt: PROMPT, schema: SCHEMA });
    console.log(JSON.stringify(j, null, 2));
    console.log("[compete] ✓ smoke test OK (nothing written)");
    return;
  }

  const segment = arg("--segment");
  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "competitors.json"), "utf8"));
  let targets = cfg.competitors;
  if (segment) targets = targets.filter((c) => c.segment === segment);
  console.log(`[compete] scraping ${targets.length} competitor pages (concurrency=${CONCURRENCY})…`);

  const results = await pool(targets, async (t) => {
    const j = await scrapeJson(t.url, { prompt: PROMPT, schema: SCHEMA });
    return { name: t.name, segment: t.segment, url: t.url, ...j };
  }, CONCURRENCY);

  const rows = targets.map((t, i) => {
    const r = results[i] ?? {};
    return {
      name: t.name, segment: t.segment, url: t.url,
      pricingModel: r.pricingModel ?? "", pricePoints: (r.pricePoints ?? []).join("; "),
      targetSegment: r.targetSegment ?? "", keyFeatures: (r.keyFeatures ?? []).join("; "),
      integrations: (r.integrations ?? []).join("; "), error: r.error ?? "",
    };
  });

  const outDir = path.join(HERE, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const base = path.join(outDir, `competitive-${segment ?? "all"}-${ts}`);
  const headers = ["name","segment","url","pricingModel","pricePoints","targetSegment","keyFeatures","integrations","error"];
  fs.writeFileSync(`${base}.csv`, toCsv(rows, headers));
  fs.writeFileSync(`${base}.json`, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  const ok = rows.filter((r) => !r.error).length;
  console.log(`[compete] ✓ ${ok}/${rows.length} pages → ${base}.{csv,json}`);
}

main().catch((e) => { console.error(`[compete] ✗ ${e.message}`); process.exit(1); });
