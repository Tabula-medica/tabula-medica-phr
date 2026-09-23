/**
 * Reference-content ingestion (Phase 1) — Firecrawl → NO-CDS → draft row.
 *
 * Pulls PUBLIC medical reference content (FDA/CDC now; WHO/ICD-11 later) from
 * public URLs and stores it as `draft`. NEVER touches PHI — it accepts source
 * URLs only, never a patient record. Firecrawl runs on public pages only (no BAA).
 *
 * Every patient-facing string is run through sanitizeNoCDS and carries the
 * NO-CDS disclaimer. Nothing is surfaced until a human sets status="published".
 *
 * DB writes are gated behind CONTENT_INGEST_ENABLED (default OFF). Preparing a
 * row (fetch + sanitize) is side-effect-free and always allowed (used by the
 * dry-run smoke test).
 */
import {
  sanitizeNoCDS,
  sanitizeNoCDSObject,
  appendDisclaimer,
} from "../security/no-cds-guardrails";
import type { InsertReferenceContent } from "@shared/schema";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

export type Source = "fda" | "cdc" | "who" | "icd11";
export type Surface = "patient-education" | "clinician-reference";

const SOURCE_META: Record<Source, { license: string; attribution: string; legalGate?: boolean }> = {
  fda:   { license: "public-domain", attribution: "U.S. Food & Drug Administration (FDA)" },
  cdc:   { license: "public-domain", attribution: "U.S. Centers for Disease Control and Prevention (CDC)" },
  // WHO content is typically CC BY-NC-SA — commercial use needs counsel sign-off (Phase 3).
  who:   { license: "CC-BY-NC-SA", attribution: "World Health Organization (WHO)", legalGate: true },
  icd11: { license: "WHO ICD API license", attribution: "WHO ICD-11", legalGate: true },
};

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string", description: "Plain-language summary of the page" },
    keyPoints: { type: "array", items: { type: "string" } },
    lastUpdated: { type: "string", description: "Publication or last-updated date if shown" },
  },
};

export interface PreparedContent extends InsertReferenceContent {
  _tags: string[];
}

function isEnabled(): boolean {
  return (process.env.CONTENT_INGEST_ENABLED ?? "false").toLowerCase() === "true";
}

async function scrape(url: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set — export it or pull from Secret Manager. Never hard-code it.");
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      formats: ["markdown", { type: "json", prompt: "Extract this public medical reference page's title, a plain-language summary, key points, and last-updated date.", schema: EXTRACT_SCHEMA }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Firecrawl HTTP ${res.status} ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  return { markdown: data?.data?.markdown ?? "", json: data?.data?.json ?? {}, metadata: data?.data?.metadata ?? {} };
}

/**
 * Fetch + normalize a single public URL into a draft reference-content row.
 * Side-effect-free — does NOT write to the DB.
 */
export async function prepareFromUrl(
  url: string,
  opts: { source: Source; surface?: Surface; contentType: string; tags?: string[] },
): Promise<PreparedContent> {
  const meta = SOURCE_META[opts.source];
  const surface: Surface = opts.surface ?? "patient-education";
  const { markdown, json, metadata } = await scrape(url);

  let title = (json.title || metadata.title || url).toString().slice(0, 500);
  let body = markdown;
  let structuredData: Record<string, unknown> = json ?? {};

  // Patient-facing content must be NO-CDS-safe + disclaimed.
  if (surface === "patient-education") {
    title = sanitizeNoCDS(title);
    body = appendDisclaimer(sanitizeNoCDS(body), true);
    structuredData = sanitizeNoCDSObject(structuredData);
  }

  return {
    source: opts.source,
    sourceUrl: url,
    externalVersion: (json.lastUpdated || metadata.modifiedTime || new Date().toISOString().slice(0, 10)).toString(),
    contentType: opts.contentType,
    surface,
    title,
    body,
    structuredData,
    license: meta.license,
    attribution: meta.attribution,
    status: "draft",
    _tags: [opts.source, opts.contentType, ...(opts.tags ?? [])],
  };
}

/**
 * Fetch + upsert a URL as a draft row. Requires CONTENT_INGEST_ENABLED=true and
 * a live DB. Dedups on sourceUrl. Returns the row id.
 */
export async function ingestUrl(
  url: string,
  opts: { source: Source; surface?: Surface; contentType: string; tags?: string[] },
): Promise<{ id: string; status: string }> {
  if (!isEnabled()) {
    throw new Error("CONTENT_INGEST_ENABLED is not 'true' — refusing to write. (Use prepareFromUrl for a dry run.)");
  }
  const prepared = await prepareFromUrl(url, opts);
  const { _tags, ...row } = prepared;

  // Lazy import so dry-run / prepare never require DATABASE_URL.
  const { db } = await import("../db");
  const { referenceContent, referenceContentTags } = await import("@shared/schema");
  const { sql } = await import("drizzle-orm");

  const [saved] = await db
    .insert(referenceContent)
    .values(row)
    .onConflictDoUpdate({
      target: referenceContent.sourceUrl,
      set: { ...row, updatedAt: sql`now()`, status: sql`'draft'` }, // re-ingest reverts to draft for re-review
    })
    .returning({ id: referenceContent.id, status: referenceContent.status });

  if (_tags.length) {
    await db
      .insert(referenceContentTags)
      .values(_tags.map((tag) => ({ contentId: saved.id, tag })))
      .onConflictDoNothing();
  }
  return saved;
}
