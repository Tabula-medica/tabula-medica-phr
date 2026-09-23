import { db } from "../db";
import { externalIdentities } from "@shared/models/auth";
import { and, eq } from "drizzle-orm";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Fasten Health "bring your own identity" (BYOI) sign-in.
//
// The PHR lets a patient sign up by connecting a real health provider through
// the Fasten Stitch widget: they authenticate against their provider portal,
// which PROVES who they are. The widget hands the browser an `org_connection_id`
// on `widget.complete`. We NEVER trust that id from the client as proof of
// login — the browser could forge it. Instead the (authenticated) link step
// re-verifies it SERVER-SIDE against Fasten's API using our PRIVATE key
// (GET /bridge/org_connection/{id}). Only a genuine, authorized connection
// under our org validates, so a forged id can't link records or hijack another
// user's connection.
//
// Identity flow: Fasten proves the patient is real + connects their records;
// the durable login credential is their phone (GCIP phone auth, see
// client/src/lib/gcip.ts). So signup = connect provider (verify) + phone;
// every login after is one-tap phone/SMS mapped to the SAME GCIP user, with
// the Fasten connection linked to it via external_identities.
//
// OPS PREREQ (Fasten Connect dashboard → API keys): set FASTEN_HEALTH_CLIENT_ID
// (public id, already used by /api/fasten-connect/config) AND
// FASTEN_HEALTH_PRIVATE_KEY (secret — server only). Without the private key
// this module is inert and the sign-in route returns 503 (never a session).
// ---------------------------------------------------------------------------

const FASTEN_PUBLIC_ID = process.env.FASTEN_HEALTH_CLIENT_ID || "";
const FASTEN_PRIVATE_KEY = process.env.FASTEN_HEALTH_PRIVATE_KEY || "";
const FASTEN_API_BASE =
  process.env.FASTEN_API_BASE || "https://api.connect.fastenhealth.com/v1";

// Fasten ids are UUIDs; validate before interpolating into the request URL so a
// hostile value can't be used for path traversal / SSRF against the API host.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFastenConfigured(): boolean {
  return Boolean(FASTEN_PUBLIC_ID && FASTEN_PRIVATE_KEY);
}

export function isValidOrgConnectionId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

export interface FastenConnection {
  orgConnectionId: string;
  orgId?: string;
  platformType?: string;
  status: string;
  scope?: string;
  catalogBrandId?: string;
}

function basicAuthHeader(): string {
  const token = Buffer.from(`${FASTEN_PUBLIC_ID}:${FASTEN_PRIVATE_KEY}`).toString(
    "base64",
  );
  return `Basic ${token}`;
}

/**
 * Verify an org_connection_id server-side with Fasten's API using our private
 * key. Returns the connection ONLY when Fasten reports it authorized under our
 * org; returns null for any not-authorized / unknown / error case. This is the
 * anti-forgery gate for Fasten sign-in.
 */
export async function verifyFastenConnection(
  orgConnectionId: string,
): Promise<FastenConnection | null> {
  if (!isFastenConfigured() || !isValidOrgConnectionId(orgConnectionId)) {
    return null;
  }
  try {
    const res = await fetch(
      `${FASTEN_API_BASE}/bridge/org_connection/${orgConnectionId}`,
      {
        method: "GET",
        headers: {
          Authorization: basicAuthHeader(),
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      logger.warn(
        `[Fasten] org_connection verify non-OK: ${res.status} for ${orgConnectionId}`,
      );
      return null;
    }
    const body: any = await res.json().catch(() => null);
    if (!body) return null;
    const status = String(body.status ?? "").toLowerCase();
    if (status !== "authorized") {
      logger.warn(
        `[Fasten] org_connection ${orgConnectionId} status='${status}' (not authorized)`,
      );
      return null;
    }
    return {
      orgConnectionId: body.org_connection_id ?? orgConnectionId,
      orgId: body.org_id,
      platformType: body.platform_type,
      status,
      scope: body.scope,
      catalogBrandId: body.catalog_brand_id,
    };
  } catch (err: any) {
    logger.error(`[Fasten] org_connection verify error: ${err?.message}`);
    return null;
  }
}

/**
 * Link a verified Fasten connection to the given internal user via
 * external_identities (provider='fasten', externalSub=org_connection_id).
 * Idempotent for the same user. If the connection is already linked to a
 * DIFFERENT user, refuses (returns "conflict") so one patient's connection
 * can't be attached to another account.
 */
export async function linkFastenConnection(
  userId: string,
  conn: FastenConnection,
): Promise<"linked" | "conflict"> {
  const [existing] = await db
    .select()
    .from(externalIdentities)
    .where(
      and(
        eq(externalIdentities.provider, "fasten"),
        eq(externalIdentities.externalSub, conn.orgConnectionId),
      ),
    )
    .limit(1);

  const metadata = {
    org_id: conn.orgId ?? null,
    platform_type: conn.platformType ?? null,
    scope: conn.scope ?? null,
    catalog_brand_id: conn.catalogBrandId ?? null,
  };

  if (existing) {
    if (existing.userId !== userId) {
      logger.warn(
        `[Fasten] connection ${conn.orgConnectionId} already owned by ${existing.userId}; refused link to ${userId}`,
      );
      return "conflict";
    }
    await db
      .update(externalIdentities)
      .set({ lastSeenAt: new Date(), metadata })
      .where(eq(externalIdentities.id, existing.id));
    return "linked";
  }

  await db.insert(externalIdentities).values({
    userId,
    provider: "fasten",
    externalSub: conn.orgConnectionId,
    metadata,
    linkedAt: new Date(),
    lastSeenAt: new Date(),
  });
  logger.info(
    `[Fasten] linked connection ${conn.orgConnectionId} to user ${userId} (platform=${conn.platformType ?? "unknown"})`,
  );
  return "linked";
}

/**
 * Kick off an async FHIR EHI export for a connection so the patient's records
 * (and demographics) backfill after sign-in. Best-effort: returns the Fasten
 * task_id or null. The actual data lands later via the patient.ehi_export_success
 * webhook (server/routes.ts /api/fasten-connect/webhook).
 */
export async function triggerFastenExport(
  orgConnectionId: string,
): Promise<string | null> {
  if (!isFastenConfigured() || !isValidOrgConnectionId(orgConnectionId)) {
    return null;
  }
  try {
    const res = await fetch(`${FASTEN_API_BASE}/bridge/fhir/ehi-export`, {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ org_connection_id: orgConnectionId }),
    });
    if (!res.ok) {
      logger.warn(`[Fasten] ehi-export non-OK: ${res.status} for ${orgConnectionId}`);
      return null;
    }
    const body: any = await res.json().catch(() => null);
    return body?.task_id ?? null;
  } catch (err: any) {
    logger.error(`[Fasten] ehi-export error: ${err?.message}`);
    return null;
  }
}

export { FASTEN_API_BASE };
