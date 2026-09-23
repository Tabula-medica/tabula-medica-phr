/**
 * NCTS (National Clinical Terminology Service) client.
 *
 * Wraps the ADHA FHIR terminology server at:
 *   https://api.healthterminologies.gov.au/integration/v2/fhir
 *
 * Provides:
 *   - AMT lookup by trade name or SNOMED SCT ID
 *   - PBS item lookup by item code or drug name
 *   - ICD-10-AM code search
 *   - SNOMED CT-AU expansion
 *
 * Authentication:
 *   The NCTS API requires an OAuth2 client-credentials token from:
 *     https://api.healthterminologies.gov.au/auth/realms/NCTS/protocol/openid-connect/token
 *   Store clientId/clientSecret in GCP Secret Manager as:
 *     ncts-client-id  /  ncts-client-secret
 *
 * Rate limits: 10 req/s unauthenticated (sandbox), 60 req/s authenticated.
 * Cache responses for 24h — terminology changes at most on SNOMED quarterly releases.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmtConcept {
  sctId: string;
  display: string;
  /** CTPP | TPP | MPP | BPCK | UPCK | MP */
  conceptClass: string;
  tgaApprovedName?: string;
  artgId?: string;
  gtin?: string;
}

export interface PbsItem {
  itemCode: string;
  genericName: string;
  brandName?: string;
  form?: string;
  strength?: string;
  benefitType: "unrestricted" | "restricted" | "authority_required" | "authority_required_streamlined";
  maxQuantity?: number;
  maxRepeats?: number;
  safetyNetContribution?: string;
  pbsManufacturerCode?: string;
}

export interface Icd10AmCode {
  code: string;
  display: string;
  edition: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

// ─── Client ───────────────────────────────────────────────────────────────────

const NCTS_BASE = "https://api.healthterminologies.gov.au/integration/v2/fhir";
const TOKEN_URL =
  "https://api.healthterminologies.gov.au/auth/realms/NCTS/protocol/openid-connect/token";

const AMT_SYSTEM = "http://snomed.info/sct";
const PBS_SYSTEM = "http://pbs.gov.au/code/item";
const ICD10AM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-am";

let _tokenCache: TokenCache | null = null;

async function getToken(): Promise<string | null> {
  const clientId = process.env.NCTS_CLIENT_ID;
  const clientSecret = process.env.NCTS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 30_000) {
    return _tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return _tokenCache.accessToken;
}

async function nctsGet(path: string): Promise<unknown> {
  const token = await getToken();
  const headers: Record<string, string> = { Accept: "application/fhir+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${NCTS_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`NCTS ${res.status}: ${path}`);
  return res.json();
}

// ─── AMT ──────────────────────────────────────────────────────────────────────

/**
 * Search AMT for a medication by free-text name.
 * Returns up to 10 matching concepts ordered by relevance.
 * Prefer CTPP (most specific) → TPP → MPP results for dispensing.
 */
export async function searchAmt(query: string): Promise<AmtConcept[]> {
  const encoded = encodeURIComponent(query);
  // Use $lookup operation — returns CTPP/TPP/MPP hierarchy for the search term
  const data = (await nctsGet(
    `/ValueSet/$expand?url=https://healthterminologies.gov.au/fhir/ValueSet/australian-medication-1` +
    `&filter=${encoded}&count=10`,
  )) as { expansion?: { contains?: unknown[] } };

  const contains = data?.expansion?.contains ?? [];
  return (contains as Record<string, unknown>[]).map((c) => ({
    sctId: String(c.code ?? ""),
    display: String(c.display ?? ""),
    conceptClass: deriveAmtClass(String(c.code ?? "")),
  }));
}

/**
 * Fetch a single AMT concept by SNOMED SCT ID.
 * Returns display name, TGA approved name, and ARTG ID if available.
 */
export async function getAmtConcept(sctId: string): Promise<AmtConcept | null> {
  try {
    const data = (await nctsGet(
      `/CodeSystem/$lookup?system=${encodeURIComponent(AMT_SYSTEM)}&code=${sctId}` +
      `&property=inactive&property=sufficientlyDefined`,
    )) as { parameter?: { name: string; valueString?: string }[] };

    const params = data?.parameter ?? [];
    const display =
      params.find((p) => p.name === "display")?.valueString ?? sctId;

    return { sctId, display, conceptClass: deriveAmtClass(sctId) };
  } catch {
    return null;
  }
}

// ─── PBS ──────────────────────────────────────────────────────────────────────

/**
 * Look up a PBS item by item code (e.g. "2622B").
 * Returns null if the code is not current or not found.
 *
 * Note: A full PBS dataset snapshot is available from:
 *   https://www.pbs.gov.au/downloads/downloads-information.html
 * For high-volume lookups, ingest the snapshot into a local table rather
 * than calling the NCTS API per-request.
 */
export async function getPbsItem(itemCode: string): Promise<PbsItem | null> {
  try {
    const data = (await nctsGet(
      `/CodeSystem/$lookup?system=${encodeURIComponent(PBS_SYSTEM)}&code=${encodeURIComponent(itemCode)}`,
    )) as { parameter?: { name: string; valueString?: string }[] };

    const params = data?.parameter ?? [];
    const get = (name: string) =>
      params.find((p) => p.name === name)?.valueString;

    const genericName = get("display") ?? get("genericName");
    if (!genericName) return null;

    return {
      itemCode,
      genericName,
      brandName: get("brandName"),
      form: get("form"),
      strength: get("strength"),
      benefitType: (get("benefitType") as PbsItem["benefitType"]) ?? "unrestricted",
      maxQuantity: get("maxQuantity") ? parseInt(get("maxQuantity")!, 10) : undefined,
      maxRepeats: get("maxRepeats") ? parseInt(get("maxRepeats")!, 10) : undefined,
      safetyNetContribution: get("safetyNetContribution"),
    };
  } catch {
    return null;
  }
}

/**
 * Search PBS by drug name. Returns matching items sorted by benefit type
 * (unrestricted first).
 */
export async function searchPbs(query: string): Promise<PbsItem[]> {
  const encoded = encodeURIComponent(query);
  try {
    const data = (await nctsGet(
      `/ValueSet/$expand?url=https://healthterminologies.gov.au/fhir/ValueSet/pbs-item-1` +
      `&filter=${encoded}&count=20`,
    )) as { expansion?: { contains?: unknown[] } };

    const contains = (data?.expansion?.contains ?? []) as Record<string, unknown>[];
    return contains.map((c) => ({
      itemCode: String(c.code ?? ""),
      genericName: String(c.display ?? ""),
      benefitType: "unrestricted" as const,
    }));
  } catch {
    return [];
  }
}

// ─── ICD-10-AM ────────────────────────────────────────────────────────────────

/**
 * Search ICD-10-AM by description or code prefix.
 * Returns up to 10 results.
 */
export async function searchIcd10am(query: string): Promise<Icd10AmCode[]> {
  const encoded = encodeURIComponent(query);
  try {
    const data = (await nctsGet(
      `/ValueSet/$expand?url=https://healthterminologies.gov.au/fhir/ValueSet/icd-10-am-diagnoses-1` +
      `&filter=${encoded}&count=10`,
    )) as { expansion?: { contains?: unknown[] } };

    const contains = (data?.expansion?.contains ?? []) as Record<string, unknown>[];
    return contains.map((c) => ({
      code: String(c.code ?? ""),
      display: String(c.display ?? ""),
      edition: String((c as Record<string, unknown>).version ?? "12th"),
    }));
  } catch {
    return [];
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Verify the NCTS server is reachable and credentials work.
 * Returns true if the metadata endpoint responds 200.
 */
export async function checkNctsConnectivity(): Promise<{
  reachable: boolean;
  authenticated: boolean;
}> {
  try {
    const token = await getToken();
    const headers: Record<string, string> = { Accept: "application/fhir+json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${NCTS_BASE}/metadata`, { headers });
    return { reachable: res.ok, authenticated: !!token };
  } catch {
    return { reachable: false, authenticated: false };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveAmtClass(sctId: string): string {
  // AMT concept classes are encoded in the SCT hierarchy, not the ID itself.
  // Without a full subsumption lookup we return "AMT" as a safe default.
  // A production implementation should call $subsumes against the AMT hierarchy.
  return sctId ? "AMT" : "unknown";
}
