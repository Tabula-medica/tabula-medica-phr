/**
 * Ingest public medical reference content (Phase 1: FDA + CDC) via Firecrawl.
 *
 *   # dry run — fetch + NO-CDS-sanitize one URL, print, write NOTHING (no DB needed)
 *   tsx scripts/ingest-reference-content.ts --dry-run --source cdc --url https://www.cdc.gov/high-blood-pressure/about/
 *
 *   # batch — ingest the built-in seed list as DRAFT rows (needs CONTENT_INGEST_ENABLED=true + DATABASE_URL)
 *   tsx scripts/ingest-reference-content.ts --source cdc --limit 5
 *
 * Public sources only, never PHI. Everything lands status="draft" and must be
 * human-reviewed to "published" before it surfaces. WHO/ICD-11 are Phase 3
 * (blocked on licensing counsel) and intentionally not seeded here.
 *
 * Env: FIRECRAWL_API_KEY (required), CONTENT_INGEST_ENABLED (batch writes only).
 */
import "dotenv/config";
import { prepareFromUrl, ingestUrl, type Source, type Surface } from "../server/services/reference-content-ingest";

// Public-domain seed URLs. patient-education by default (NO-CDS-sanitized).
const SEEDS: Record<string, { url: string; contentType: string; surface?: Surface; tags?: string[] }[]> = {
  cdc: [
    { url: "https://www.cdc.gov/high-blood-pressure/about/", contentType: "patient-education", tags: ["hypertension"] },
    { url: "https://www.cdc.gov/diabetes/about/", contentType: "patient-education", tags: ["diabetes"] },
    { url: "https://www.cdc.gov/cholesterol/about/", contentType: "patient-education", tags: ["cholesterol"] },
    { url: "https://www.cdc.gov/heart-disease/about/", contentType: "patient-education", tags: ["heart-disease"] },
  ],
  fda: [
    { url: "https://www.fda.gov/drugs/drug-safety-and-availability/medication-guides", contentType: "drug-label", tags: ["medication-guide"] },
  ],
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (flag: string) => process.argv.includes(flag);

async function main() {
  const source = (arg("--source") as Source) || "cdc";
  const surface = (arg("--surface") as Surface) || "patient-education";
  const dryRun = has("--dry-run");

  const url = arg("--url");
  if (url) {
    const contentType = arg("--contentType") || (surface === "clinician-reference" ? "clinical-guideline" : "patient-education");
    console.log(`[ingest] ${dryRun ? "DRY RUN " : ""}fetching ${url} (source=${source}, surface=${surface})…`);
    if (dryRun) {
      const prepared = await prepareFromUrl(url, { source, surface, contentType });
      const { body, ...rest } = prepared;
      console.log(JSON.stringify({ ...rest, bodyPreview: (body || "").slice(0, 400) + (body && body.length > 400 ? " …[truncated]" : "") }, null, 2));
      console.log("[ingest] ✓ dry run OK — nothing written");
      return;
    }
    const saved = await ingestUrl(url, { source, surface, contentType });
    console.log(`[ingest] ✓ upserted ${saved.id} (status=${saved.status})`);
    return;
  }

  // batch from seed list
  const seeds = SEEDS[source] ?? [];
  const limit = Number(arg("--limit") || seeds.length);
  const batch = seeds.slice(0, limit);
  if (!batch.length) throw new Error(`no seeds for source="${source}" (have: ${Object.keys(SEEDS).join(", ")})`);
  console.log(`[ingest] ${dryRun ? "DRY RUN " : ""}ingesting ${batch.length} ${source} page(s) as DRAFT…`);
  let ok = 0;
  for (const s of batch) {
    try {
      if (dryRun) { await prepareFromUrl(s.url, { source, surface: s.surface ?? surface, contentType: s.contentType, tags: s.tags }); console.log(`  ✓ (dry) ${s.url}`); }
      else { const r = await ingestUrl(s.url, { source, surface: s.surface ?? surface, contentType: s.contentType, tags: s.tags }); console.log(`  ✓ ${r.id} ${s.url}`); }
      ok++;
    } catch (e) {
      console.error(`  ✗ ${s.url} — ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[ingest] ${ok}/${batch.length} ok${dryRun ? " (dry run — nothing written)" : " (draft — review before publish)"}`);
}

main().catch((e) => { console.error(`[ingest] ✗ ${e instanceof Error ? e.message : e}`); process.exit(1); });
