/**
 * Firecrawl client — NON-PHI web research only.
 *
 * Firecrawl is a third-party scraping/search service with NO BAA. This module is
 * the only file allowed to import the SDK (enforced by scripts/phi-ai-guard.sh),
 * and it only accepts public URLs and non-identifying search text. Never pass
 * patient data, record content, or anything derived from a patient record.
 */
import Firecrawl from "@mendable/firecrawl-js";

const MAX_QUERY_LENGTH = 200;
const MAX_MARKDOWN_CHARS = 200_000;

// Our own hosts: scraping them could pull authenticated app content.
const BLOCKED_HOSTS = ["tabulamedica.com", "tabula-medica.com", "localhost", "local", "internal", "replit.dev"];

// Patterns that suggest a patient identifier slipped into a search query.
const IDENTIFIER_PATTERNS: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
  /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/, // US phone
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/, // date (DOB)
  /\d{6,}/, // MRN / member ID / long numeric id
];

export class NonPhiInputError extends Error {}

export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NonPhiInputError("Invalid URL");
  }
  if (url.protocol !== "https:") throw new NonPhiInputError("Only https URLs are allowed");
  if (url.username || url.password) throw new NonPhiInputError("URLs with credentials are not allowed");
  if (url.search) throw new NonPhiInputError("URLs with query strings are not allowed");
  const host = url.hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) {
    throw new NonPhiInputError("IP-literal hosts are not allowed");
  }
  if (BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`))) {
    throw new NonPhiInputError("Host is not allowed");
  }
  url.hash = "";
  return url;
}

export function assertNonIdentifyingQuery(query: string): string {
  const q = query.trim();
  if (!q) throw new NonPhiInputError("Query is required");
  if (q.length > MAX_QUERY_LENGTH) throw new NonPhiInputError("Query is too long");
  if (IDENTIFIER_PATTERNS.some((p) => p.test(q))) {
    throw new NonPhiInputError("Query looks like it contains an identifier; remove it and retry");
  }
  return q;
}

let client: Firecrawl | null = null;

function getClient(): Firecrawl {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");
  client ??= new Firecrawl({ apiKey, timeoutMs: 60_000, maxRetries: 1 });
  return client;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export async function scrapePublicPage(rawUrl: string) {
  const url = assertPublicUrl(rawUrl);
  const doc = await getClient().scrape(url.toString(), {
    formats: ["markdown"],
    onlyMainContent: true,
    storeInCache: false,
  });
  return {
    url: url.toString(),
    title: doc.metadata?.title ?? null,
    markdown: (doc.markdown ?? "").slice(0, MAX_MARKDOWN_CHARS),
  };
}

export async function searchPublicWeb(rawQuery: string, limit: number) {
  const query = assertNonIdentifyingQuery(rawQuery);
  const data = await getClient().search(query, { limit });
  return (data.web ?? []).map((r) => {
    const hit = r as { url?: string; title?: string; description?: string; metadata?: { title?: string; sourceURL?: string } };
    return {
      url: hit.url ?? hit.metadata?.sourceURL ?? null,
      title: hit.title ?? hit.metadata?.title ?? null,
      description: hit.description ?? null,
    };
  });
}
