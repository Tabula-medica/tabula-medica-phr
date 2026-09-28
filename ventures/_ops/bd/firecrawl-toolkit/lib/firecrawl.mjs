/**
 * Shared Firecrawl v2 helpers for the BD toolkit (non-PHI, public web only).
 *
 * Key is read from FIRECRAWL_API_KEY env ONLY — never hard-code or commit it.
 * Pull it from your shell or GCP Secret Manager (`tabula-secrets`).
 */
export const API_KEY = process.env.FIRECRAWL_API_KEY;
const SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const SEARCH_URL = "https://api.firecrawl.dev/v2/search";

export function requireKey() {
  if (!API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is not set — export it or pull it from GCP Secret Manager. Never hard-code it.");
  }
}

/** Scrape a URL and return the structured JSON extraction (per prompt+schema). */
export async function scrapeJson(url, { prompt, schema, timeout = 60000 } = {}) {
  const res = await fetch(SCRAPE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ url, onlyMainContent: false, formats: [{ type: "json", prompt, schema }] }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`scrape HTTP ${res.status} ${t.slice(0, 140)}`);
  }
  const data = await res.json();
  return data?.data?.json ?? {};
}

/** Web search — returns an array of { url, title, description }. */
export async function search(query, { limit = 5 } = {}) {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ query, limit }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`search HTTP ${res.status} ${t.slice(0, 140)}`);
  }
  const data = await res.json();
  // v2 returns { data: { web: [...] } } or { data: [...] } depending on plan — handle both.
  const d = data?.data;
  return Array.isArray(d) ? d : (d?.web ?? []);
}

/** Concurrency-limited worker pool. Failures land as { error } in the result slot. */
export async function pool(items, worker, concurrency = 6) {
  let i = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await worker(items[idx], idx); }
      catch (e) { out[idx] = { error: e instanceof Error ? e.message : String(e) }; }
    }
  }));
  return out;
}

export const csvCell = (v) => /[",\n]/.test(v ?? "") ? `"${String(v).replace(/"/g, '""')}"` : (v ?? "");
export const toCsv = (rows, headers) =>
  [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";
