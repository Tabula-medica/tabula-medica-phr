/**
 * CMS Blue Button 2.0 service.
 *
 * Handles OAuth2 token exchange, token refresh, and FHIR resource fetching
 * for Medicare beneficiary claims data (ExplanationOfBenefit, Coverage, Patient).
 *
 * Env vars:
 *   BB2_CLIENT_ID      — Blue Button OAuth client id (from developer.bluebutton.cms.gov)
 *   BB2_CLIENT_SECRET  — Blue Button OAuth client secret
 *   BB2_CALLBACK_URL   — Full callback URL (default: derive from request)
 *   BB2_SANDBOX        — "false" uses production; anything else uses sandbox
 *   BB2_API_VERSION    — "v2" (default) or "v3"
 *
 * PHI contract:
 *   - OAuth tokens stored encrypted via encryptPhi (they grant access to PHI).
 *   - EOB/Coverage FHIR JSON stored encrypted; only decrypted server-side for
 *     display or AI gateway calls.
 *   - Patient identifiers (BB2 patient_id) are not PHI but treated carefully.
 *   - No PHI is ever logged; token values are redacted in all log lines.
 */

import { db } from "./db";
import { encryptPhi, decryptPhi } from "./security/phi-encryption";
import {
  bluebuttonConnections,
  bluebuttonClaims,
  type BluebuttonConnection,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { getLogger } from "./lib/logger";

const log = getLogger("bluebutton");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Sandbox vs production is controlled ONLY by BB2_SANDBOX (NODE_ENV is
// "production" on Cloud Run even when we use sandbox credentials).
const SANDBOX = process.env.BB2_SANDBOX !== "false";
const BB2_VERSION = process.env.BB2_API_VERSION === "v3" ? "v3" : "v2";

const BB2_BASE = SANDBOX
  ? "https://sandbox.bluebutton.cms.gov"
  : "https://api.bluebutton.cms.gov";

const BB2_AUTH_URL = `${BB2_BASE}/${BB2_VERSION}/o/authorize/`;
const BB2_TOKEN_URL = `${BB2_BASE}/${BB2_VERSION}/o/token/`;
const BB2_REVOKE_URL = `${BB2_BASE}/${BB2_VERSION}/o/revoke_token/`;
const BB2_FHIR_BASE = `${BB2_BASE}/${BB2_VERSION}/fhir`;

const BB2_CLIENT_ID = process.env.BB2_CLIENT_ID ?? "";
const BB2_CLIENT_SECRET = process.env.BB2_CLIENT_SECRET ?? "";

export function isBB2Configured(): boolean {
  return Boolean(BB2_CLIENT_ID && BB2_CLIENT_SECRET);
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/** PKCE (RFC 7636) S256 helpers. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: BB2_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: [
      "patient/Patient.read",
      "patient/Coverage.read",
      "patient/ExplanationOfBenefit.read",
    ].join(" "),
  });
  return `${BB2_AUTH_URL}?${params}`;
}

export interface BB2TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  /** Blue Button patient FHIR id (e.g. "-19990000000001" in sandbox) */
  patient: string;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<BB2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: BB2_CLIENT_ID,
    client_secret: BB2_CLIENT_SECRET,
  });

  const res = await fetch(BB2_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`BB2 token exchange failed ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<BB2TokenResponse>;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<BB2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: BB2_CLIENT_ID,
    client_secret: BB2_CLIENT_SECRET,
  });

  const res = await fetch(BB2_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`BB2 token refresh failed ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<BB2TokenResponse>;
}

/** Best-effort revoke of a token at CMS. Never throws. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(BB2_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${BB2_CLIENT_ID}:${BB2_CLIENT_SECRET}`).toString("base64"),
      },
      body: new URLSearchParams({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Token store (encrypted in DB)
// ---------------------------------------------------------------------------

export async function upsertConnection(
  profileId: string,
  tokens: BB2TokenResponse,
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await db
    .insert(bluebuttonConnections)
    .values({
      profileId,
      accessToken: encryptPhi(tokens.access_token),
      refreshToken: encryptPhi(tokens.refresh_token),
      tokenExpiresAt: expiresAt,
      scope: tokens.scope,
      bb2PatientId: tokens.patient,
      connectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: bluebuttonConnections.profileId,
      set: {
        accessToken: encryptPhi(tokens.access_token),
        refreshToken: encryptPhi(tokens.refresh_token),
        tokenExpiresAt: expiresAt,
        scope: tokens.scope,
        bb2PatientId: tokens.patient,
        disconnectedAt: null,
      },
      where: eq(bluebuttonConnections.profileId, profileId),
    });
}

export async function getConnection(
  profileId: string,
): Promise<BluebuttonConnection | null> {
  const rows = await db
    .select()
    .from(bluebuttonConnections)
    .where(
      and(
        eq(bluebuttonConnections.profileId, profileId),
        isNull(bluebuttonConnections.disconnectedAt),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** Returns a valid (possibly refreshed) access token, or null if disconnected. */
export async function getValidAccessToken(
  profileId: string,
): Promise<string | null> {
  const conn = await getConnection(profileId);
  if (!conn) return null;

  const accessToken = decryptPhi(conn.accessToken);

  // Refresh if token expires within 5 minutes
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshToken = decryptPhi(conn.refreshToken);
      const fresh = await refreshAccessToken(refreshToken);
      await upsertConnection(profileId, fresh);
      return fresh.access_token;
    } catch (err) {
      log.warn({ profileId }, "BB2 token refresh failed — marking disconnected");
      await db
        .update(bluebuttonConnections)
        .set({ disconnectedAt: new Date() })
        .where(eq(bluebuttonConnections.profileId, profileId));
      return null;
    }
  }

  return accessToken;
}

// ---------------------------------------------------------------------------
// FHIR fetching
// ---------------------------------------------------------------------------

async function bb2Fetch(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!res.ok) {
    throw new Error(`BB2 FHIR ${res.status} at ${url}`);
  }

  return res.json();
}

/** Fetch all pages of a FHIR Bundle, following next links. Max 100 pages. */
async function fetchAllPages(
  firstUrl: string,
  accessToken: string,
): Promise<unknown[]> {
  const entries: unknown[] = [];
  let url: string | null = firstUrl;
  let page = 0;

  while (url && page < 100) {
    const bundle = (await bb2Fetch(url, accessToken)) as {
      entry?: { resource: unknown }[];
      link?: { relation: string; url: string }[];
    };

    for (const e of bundle.entry ?? []) {
      entries.push(e.resource);
    }

    const nextLink = bundle.link?.find((l) => l.relation === "next");
    url = nextLink?.url ?? null;
    page++;
  }

  return entries;
}

export interface BB2SyncResult {
  claimCount: number;
  coverageCount: number;
  patientFetched: boolean;
}

/** Pull latest data from Blue Button and cache it in bluebuttonClaims. */
export async function syncBB2Data(profileId: string): Promise<BB2SyncResult> {
  const conn = await getConnection(profileId);
  if (!conn) throw new Error("No active Blue Button connection");

  const accessToken = await getValidAccessToken(profileId);
  if (!accessToken) throw new Error("Blue Button token expired or revoked");

  const patientId = conn.bb2PatientId;

  // Fetch in parallel
  const [eobResources, coverageResources, patientResource] = await Promise.all([
    fetchAllPages(
      `${BB2_FHIR_BASE}/ExplanationOfBenefit?patient=${encodeURIComponent(patientId)}&_count=50`,
      accessToken,
    ),
    fetchAllPages(
      `${BB2_FHIR_BASE}/Coverage?beneficiary=${encodeURIComponent(patientId)}`,
      accessToken,
    ),
    bb2Fetch(`${BB2_FHIR_BASE}/Patient/${encodeURIComponent(patientId)}`, accessToken),
  ]);

  // Upsert claims — delete old, insert fresh (encrypted)
  await db.delete(bluebuttonClaims).where(eq(bluebuttonClaims.profileId, profileId));

  const claimRows = eobResources.map((eob: any) => ({
    profileId,
    resourceType: "ExplanationOfBenefit" as const,
    resourceId: eob.id ?? crypto.randomUUID(),
    fhirJson: encryptPhi(JSON.stringify(eob)),
    serviceDateStart: eob.billablePeriod?.start ? new Date(eob.billablePeriod.start) : null,
    serviceDateEnd: eob.billablePeriod?.end ? new Date(eob.billablePeriod.end) : null,
    claimType: (eob.type?.coding?.[0]?.code as string) ?? null,
  }));

  const coverageRows = coverageResources.map((cov: any) => ({
    profileId,
    resourceType: "Coverage" as const,
    resourceId: cov.id ?? crypto.randomUUID(),
    fhirJson: encryptPhi(JSON.stringify(cov)),
    serviceDateStart: null,
    serviceDateEnd: null,
    claimType: null,
  }));

  const allRows = [...claimRows, ...coverageRows];
  if (allRows.length > 0) {
    await db.insert(bluebuttonClaims).values(allRows);
  }

  // Update last synced
  await db
    .update(bluebuttonConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(bluebuttonConnections.profileId, profileId));

  log.info({ profileId, claimCount: claimRows.length }, "BB2 sync complete");

  return {
    claimCount: claimRows.length,
    coverageCount: coverageRows.length,
    patientFetched: !!patientResource,
  };
}
