/**
 * Competitive intel — scrape competitor EHR / PHR feature & pricing pages and
 * extract a structured comparison. Public pages only, non-PHI.
 *
 *   # single-page smoke test → prints JSON, writes nothing
 *   node competitive.mjs --url https://canvasmedical.com/pricing
 *
 *   # pre-flight: HEAD-check all URLs before spending Firecrawl credits
 *   node competitive.mjs --validate [--segment ehr|phr]
 *
 *   # batch → scrape every page in competitors.json → out/competitive-<ts>.{csv,json}
 *   node competitive.mjs [--segment ehr|phr]
 *
 *   # validate then scrape (skips dead URLs automatically)
 *   node competitive.mjs --validate --scrape [--segment ehr|phr]
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

const GOOD_STATUSES = new Set([200, 301, 302, 307, 308]);

/** HEAD-check a single URL. Returns { url, status, ok, redirectsTo, error }. */
async function headCheck(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TabuLaMedica-BD/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    const ok = GOOD_STATUSES.has(res.status);
    const redirectsTo = (res.status >= 300 && res.status < 400) ? (res.headers.get("location") ?? "") : "";
    return { url, status: res.status, ok, redirectsTo, error: "" };
  } catch (e) {
    return { url, status: 0, ok: false, redirectsTo: "", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Validate all targets; returns { live, dead, report }. */
async function validateTargets(targets) {
  console.log(`[compete] validating ${targets.length} URLs (HEAD checks, concurrency=${CONCURRENCY})…`);
  const checks = await pool(targets, (t) => headCheck(t.url), CONCURRENCY);
  const report = targets.map((t, i) => ({ name: t.name, segment: t.segment, ...checks[i] }));

  const live = [], dead = [];
  for (const r of report) {
    if (r.ok) live.push(r); else dead.push(r);
  }

  console.log(`\n[compete] URL Validation Report`);
  console.log(`  LIVE  (${live.length}): ${live.map((r) => r.name).join(", ") || "none"}`);
  if (dead.length) {
    console.log(`  DEAD  (${dead.length}):`);
    for (const r of dead) {
      const detail = r.error ? `ERROR: ${r.error}` : `HTTP ${r.status}${r.redirectsTo ? ` → ${r.redirectsTo}` : ""}`;
      console.log(`    ✗ ${r.name} (${r.url}) — ${detail}`);
    }
  } else {
    console.log(`  DEAD  (0): all URLs reachable`);
  }
  console.log();

  return { live, dead, report };
}

function arg(flag) { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; }
function flag(f) { return process.argv.includes(f); }

async function main() {
  const url = arg("--url");
  const doValidate = flag("--validate");
  const doScrape = flag("--scrape") || (!doValidate && !url);
  const segment = arg("--segment");

  if (url) {
    requireKey();
    console.log(`[compete] smoke-test scraping ${url} …`);
    const j = await scrapeJson(url, { prompt: PROMPT, schema: SCHEMA });
    console.log(JSON.stringify(j, null, 2));
    console.log("[compete] ✓ smoke test OK (nothing written)");
    return;
  }

  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, "competitors.json"), "utf8"));
  let targets = cfg.competitors;
  if (segment) targets = targets.filter((c) => c.segment === segment);

  if (doValidate) {
    const { live, dead, report } = await validateTargets(targets);

    // Write validate report regardless
    const outDir = path.join(HERE, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const valPath = path.join(outDir, `validate-${segment ?? "all"}-${ts}.json`);
    fs.writeFileSync(valPath, JSON.stringify({ generatedAt: new Date().toISOString(), live: live.length, dead: dead.length, report }, null, 2));
    console.log(`[compete] validation report → ${valPath}`);

    if (!doScrape) return;

    // When --validate --scrape: only scrape live URLs; warn about skipped
    if (dead.length) {
      console.log(`[compete] skipping ${dead.length} dead URL(s) — proceeding with ${live.length} live targets`);
    }
    targets = targets.filter((t) => live.some((l) => l.url === t.url));
    if (!targets.length) {
      console.log("[compete] no live URLs to scrape — exiting");
      return;
    }
  }

  if (!doScrape) return;

  requireKey();
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
