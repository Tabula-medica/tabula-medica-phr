/**
 * BD lead-gen — find clinics/providers to SELL WorldEHR or PHR to. Non-PHI:
 * public NPPES registry + public practice websites only. Sends nothing.
 *
 *   # smoke test → scrape one practice site for sales-qualification signals
 *   node leadgen.mjs --url https://ltfm.health --product worldehr
 *
 *   # discover → NPPES orgs by taxonomy+state, resolve site, scrape, write leads
 *   node leadgen.mjs --product worldehr --taxonomy "Family Medicine" --state VA --limit 25
 *
 *   # from a seed CSV (columns: name, city, state, website?)
 *   node leadgen.mjs --product phr --input seed.csv
 *
 * Output → out/<product>-<ts>.leads.csv  (real contact data — gitignored, never commit)
 * Env: FIRECRAWL_API_KEY (required), CONCURRENCY (default 5).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireKey, scrapeJson, search, pool, toCsv, csvCell } from "./lib/firecrawl.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 5);
const NPPES = "https://npiregistry.cms.hhs.gov/api/?version=2.1";
const DIRECTORIES = /healthgrades|zocdoc|vitals|npidb|npino|webmd|yelp|facebook|linkedin|doximity|ratemds|sharecare|wellness\.com|find-?a-?doctor/i;

const QUAL_SCHEMA = {
  type: "object",
  properties: {
    practiceName: { type: "string" },
    emails: { type: "array", items: { type: "string" } },
    phones: { type: "array", items: { type: "string" } },
    specialties: { type: "array", items: { type: "string" } },
    currentEhrOrPortal: { type: "string", description: "Any EHR/patient-portal/booking vendor mentioned (e.g. Epic MyChart, athenahealth, healow, NextGen)" },
    hasPatientPortal: { type: "boolean" },
    hasOnlineScheduling: { type: "boolean" },
    offersTelehealth: { type: "boolean" },
    approxProviderCount: { type: "string" },
    bookingUrl: { type: "string" },
  },
};
const QUAL_PROMPT = "Extract this medical practice's public contact info and technology signals (current EHR/patient-portal vendor, online scheduling, telehealth, patient portal, approximate number of providers) from the website.";

function arg(flag) { const i = process.argv.indexOf(flag); return i === -1 ? undefined : process.argv[i + 1]; }

function parseCsv(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i+1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c === "\r") {} else f += c; }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift(); return rows.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((x, i) => [x.trim(), r[i]])));
}

async function nppesOrgs({ taxonomy, state, limit }) {
  const url = `${NPPES}&enumeration_type=NPI-2&taxonomy_description=${encodeURIComponent(taxonomy)}&state=${encodeURIComponent(state)}&limit=${Math.min(limit || 25, 200)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NPPES HTTP ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r) => {
    const loc = (r.addresses ?? []).find((a) => a.address_purpose === "LOCATION") ?? (r.addresses ?? [])[0] ?? {};
    return { name: r.basic?.organization_name ?? "", city: loc.city ?? "", state: loc.state ?? "", npi: String(r.number ?? "") };
  }).filter((o) => o.name);
}

async function resolveSite(name, city, state) {
  const hits = await search(`${name} ${city} ${state} official website`, { limit: 5 });
  const pick = hits.find((h) => h.url && !DIRECTORIES.test(h.url));
  return pick?.url;
}

async function main() {
  requireKey();
  const product = arg("--product") || "worldehr";

  const url = arg("--url");
  if (url) {
    console.log(`[leadgen] smoke-test scraping ${url} …`);
    const j = await scrapeJson(url, { prompt: QUAL_PROMPT, schema: QUAL_SCHEMA });
    console.log(JSON.stringify(j, null, 2));
    console.log("[leadgen] ✓ smoke test OK (nothing written)");
    return;
  }

  // Build the target org list (from NPPES or a seed CSV)
  let orgs;
  const input = arg("--input");
  if (input) {
    orgs = parseCsv(fs.readFileSync(input, "utf8")).map((r) => ({ name: r.name, city: r.city, state: r.state, website: r.website }));
  } else {
    const taxonomy = arg("--taxonomy"), state = arg("--state"), limit = Number(arg("--limit") || 25);
    if (!taxonomy || !state) throw new Error("provide --taxonomy and --state (or --input seed.csv, or --url for smoke test)");
    console.log(`[leadgen] NPPES: ${taxonomy} orgs in ${state} (limit ${limit})…`);
    orgs = await nppesOrgs({ taxonomy, state, limit });
  }
  console.log(`[leadgen] ${orgs.length} target orgs; resolving sites + scraping (concurrency=${CONCURRENCY})…`);

  let done = 0;
  const rows = await pool(orgs, async (o) => {
    const site = o.website || await resolveSite(o.name, o.city, o.state);
    if (++done % 5 === 0) console.log(`[leadgen] ${done}/${orgs.length}…`);
    if (!site) return { ...o, product, website: "", status: "no-site" };
    const j = await scrapeJson(site, { prompt: QUAL_PROMPT, schema: QUAL_SCHEMA });
    return {
      product, name: o.name, city: o.city, state: o.state, npi: o.npi ?? "", website: site,
      practiceName: j.practiceName ?? "", emails: (j.emails ?? []).join("; "), phones: (j.phones ?? []).join("; "),
      currentEhrOrPortal: j.currentEhrOrPortal ?? "", hasPatientPortal: j.hasPatientPortal ? "yes" : "",
      hasOnlineScheduling: j.hasOnlineScheduling ? "yes" : "", offersTelehealth: j.offersTelehealth ? "yes" : "",
      approxProviderCount: j.approxProviderCount ?? "", bookingUrl: j.bookingUrl ?? "", status: "ok",
    };
  }, CONCURRENCY);

  const outDir = path.join(HERE, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outfile = path.join(outDir, `${product}-${ts}.leads.csv`);
  const headers = ["product","name","city","state","npi","website","practiceName","emails","phones","currentEhrOrPortal","hasPatientPortal","hasOnlineScheduling","offersTelehealth","approxProviderCount","bookingUrl","status"];
  fs.writeFileSync(outfile, toCsv(rows.map((r) => r ?? {}), headers));
  const ok = rows.filter((r) => r && r.status === "ok").length;
  console.log(`[leadgen] ✓ ${ok}/${orgs.length} qualified → ${outfile} (real contact data — do not commit)`);
}

main().catch((e) => { console.error(`[leadgen] ✗ ${e.message}`); process.exit(1); });
