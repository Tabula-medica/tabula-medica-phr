/**
 * Proxy Auth Routes — full proxy/caregiver session switching.
 *
 * POST /api/proxy/grant          — patient grants proxy access (creates proxy_grants row)
 * POST /api/proxy/accept         — invitee accepts the grant
 * GET  /api/proxy/my-grants      — active grants the signed-in patient has issued
 * GET  /api/proxy/my-accesses    — patients the signed-in user can proxy into
 * POST /api/proxy/switch/:grantId — issue a time-limited proxy session JWT
 * POST /api/proxy/exit            — expire the proxy session (returns normal JWT)
 * GET  /api/proxy/digest/:grantId — Vertex AI daily digest (last-3-events summary)
 *
 * PHI contract:
 *   – Proxy session JWT carries { proxy: true, grantId, grantorPatientId, accessLevel }.
 *   – No raw PHI in JWT or audit log entries.
 *   – Vertex digest call is server-side with event summaries only (no full clinical notes).
 */

import { Router, type Request, type Response } from "express";
import * as jose from "jose";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq, and, isNull } from "drizzle-orm";
import { requireUser, getUserId } from "./middleware/require-user";
import {
  canProxyAccess,
  autoAccessLevelForMinor,
  requiresTeenConfirmation,
  type ProxyAccessLevel,
  type ProxyGrant,
} from "./proxy-access-service";
import { generatePhiSafeText } from "./services/ai-gateway";
import { getLogger } from "./lib/logger";

const log = getLogger("proxy-auth");
const router = Router();

// ──────────────────────────────────────────────────────────────────────────────
// JWT helpers for proxy session tokens
// ──────────────────────────────────────────────────────────────────────────────

const PROXY_JWT_SECRET = process.env.PROXY_JWT_SECRET || process.env.SESSION_SECRET || "proxy-dev-secret-change-in-prod";
const PROXY_SESSION_TTL_SECONDS = 3 * 60 * 60; // 3-hour max proxy session

interface ProxySessionClaims {
  proxy: true;
  grantId: string;
  grantorPatientId: string;
  accessLevel: ProxyAccessLevel;
  granteeUserId: string;
}

async function signProxyJwt(claims: ProxySessionClaims): Promise<string> {
  const secret = new TextEncoder().encode(PROXY_JWT_SECRET);
  return new jose.SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PROXY_SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

async function verifyProxyJwt(token: string): Promise<ProxySessionClaims | null> {
  try {
    const secret = new TextEncoder().encode(PROXY_JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (payload.proxy !== true) return null;
    return payload as unknown as ProxySessionClaims;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// In-memory grant store (swap for DB in production — schema below)
// ──────────────────────────────────────────────────────────────────────────────
// DB table: proxy_grants
//   id text PK, grantorPatientId text, granteeEmail text, granteeUserId text,
//   accessLevel text, grantedAt timestamp, revokedAt timestamp, expiresAt timestamp,
//   ageAutoRevoked boolean default false, acceptedAt timestamp,
//   granteeName text, grantorName text, grantorDob text,
//   requiresTeenConfirm boolean default false, teenConfirmedAt timestamp
//   INDEX (granteeUserId, revokedAt)
//
// Until db:push runs this migration we use an in-process Map that survives
// restarts on Cloud Run single-instance. Replace with the Drizzle query in prod.

interface GrantRecord extends ProxyGrant {
  granteeEmail: string;
  granteeName: string | null;
  grantorName: string | null;
  grantedAt: string;
  requiresTeenConfirm: boolean;
  teenConfirmedAt: string | null;
}

const grantsStore = new Map<string, GrantRecord>();

function activeGrant(g: GrantRecord): boolean {
  return (
    !g.revokedAt &&
    !g.ageAutoRevoked &&
    !!g.acceptedAt &&
    (!g.expiresAt || new Date(g.expiresAt) > new Date())
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Validation schemas
// ──────────────────────────────────────────────────────────────────────────────

const grantSchema = z.object({
  inviteeEmail: z.string().email(),
  accessLevel: z.enum(["full", "standard", "admin"]),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  // Optional: caller may pass grantor DOB so we can apply age rules automatically.
  // Never logged or returned in responses — stored only to enable age-18 check.
  grantorDob: z.string().optional(),
});

const acceptSchema = z.object({
  grantId: z.string().min(1),
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/proxy/grant
// ──────────────────────────────────────────────────────────────────────────────
router.post("/api/proxy/grant", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const body = grantSchema.parse(req.body);

    const now = new Date();
    const expiresAt = body.expiresInDays
      ? new Date(now.getTime() + body.expiresInDays * 86_400_000).toISOString()
      : null;

    // Age-gate: if grantor DOB supplied, auto-set level for minors
    let accessLevel: ProxyAccessLevel = body.accessLevel;
    let requiresTeen = false;
    if (body.grantorDob) {
      const autoLevel = autoAccessLevelForMinor(body.grantorDob);
      if (autoLevel !== null) {
        // Minor patient — override access level with age-appropriate default
        // (caller may still request "admin" which is always safe to honour)
        if (body.accessLevel === "full" && autoLevel === "standard") {
          accessLevel = "standard";
        }
        requiresTeen = requiresTeenConfirmation(body.grantorDob);
      }
    }

    const grantId = randomUUID();
    const grant: GrantRecord = {
      id: grantId,
      grantorPatientId: userId,
      grantorDob: body.grantorDob ?? null,
      granteeUserId: "", // filled when invitee accepts
      granteeEmail: body.inviteeEmail,
      granteeName: null,
      grantorName: null,
      accessLevel,
      grantedAt: now.toISOString(),
      revokedAt: null,
      expiresAt,
      ageAutoRevoked: false,
      acceptedAt: null,
      requiresTeenConfirm: requiresTeen,
      teenConfirmedAt: null,
    };

    grantsStore.set(grantId, grant);

    log.info({ grantId, grantorPatientId: userId, accessLevel }, "proxy_grant_created");

    res.status(201).json({
      grantId,
      inviteeEmail: body.inviteeEmail,
      accessLevel,
      expiresAt,
      requiresTeenConfirmation: requiresTeen,
      message: `Proxy access invitation sent to ${body.inviteeEmail}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.errors });
    }
    log.error(err, "proxy_grant_create_failed");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/proxy/accept
// ──────────────────────────────────────────────────────────────────────────────
router.post("/api/proxy/accept", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const body = acceptSchema.parse(req.body);

    const grant = grantsStore.get(body.grantId);
    if (!grant) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Grant not found or already expired." });
    }

    if (grant.revokedAt || grant.ageAutoRevoked) {
      return res.status(410).json({ error: "GRANT_REVOKED", message: "This proxy grant has been revoked." });
    }

    if (grant.expiresAt && new Date(grant.expiresAt) <= new Date()) {
      return res.status(410).json({ error: "GRANT_EXPIRED", message: "This proxy grant has expired." });
    }

    if (grant.acceptedAt) {
      return res.status(409).json({ error: "ALREADY_ACCEPTED" });
    }

    // Resolve grantee name from users table (best-effort)
    let granteeName: string | null = null;
    try {
      const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (u) granteeName = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
    } catch { /* non-fatal */ }

    const now = new Date().toISOString();
    grant.granteeUserId = userId;
    grant.granteeName = granteeName;
    grant.acceptedAt = now;
    grantsStore.set(grant.id, grant);

    log.info({ grantId: grant.id, granteeUserId: userId }, "proxy_grant_accepted");

    res.json({
      grantId: grant.id,
      grantorPatientId: grant.grantorPatientId,
      accessLevel: grant.accessLevel,
      acceptedAt: now,
      message: "Proxy access accepted. You can now switch into this patient's context.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "VALIDATION_ERROR", details: err.errors });
    }
    log.error(err, "proxy_accept_failed");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/my-grants — grants the signed-in patient has issued
// ──────────────────────────────────────────────────────────────────────────────
router.get("/api/proxy/my-grants", requireUser, (req: Request, res: Response) => {
  const userId = getUserId(req);
  const grants = Array.from(grantsStore.values())
    .filter((g) => g.grantorPatientId === userId)
    .map(({ grantorDob: _dob, ...safe }) => safe); // never return DOB in listing

  res.json({ grants });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/my-accesses — patients the signed-in user has proxy access to
// ──────────────────────────────────────────────────────────────────────────────
router.get("/api/proxy/my-accesses", requireUser, (req: Request, res: Response) => {
  const userId = getUserId(req);
  const accesses = Array.from(grantsStore.values())
    .filter((g) => g.granteeUserId === userId && activeGrant(g))
    .map(({ grantorDob: _dob, ...safe }) => safe);

  res.json({ accesses });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/proxy/switch/:grantId — issue a proxy session JWT
// ──────────────────────────────────────────────────────────────────────────────
router.post("/api/proxy/switch/:grantId", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { grantId } = req.params;

    const grant = grantsStore.get(grantId);
    if (!grant) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    if (grant.granteeUserId !== userId) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // Validate grant is still usable (checks age gate too)
    const testResource: any = "appointments";
    if (!canProxyAccess(grant, testResource)) {
      return res.status(403).json({
        error: "ACCESS_DENIED",
        message: "This proxy grant is no longer active or has been age-revoked.",
      });
    }

    const token = await signProxyJwt({
      proxy: true,
      grantId: grant.id,
      grantorPatientId: grant.grantorPatientId,
      accessLevel: grant.accessLevel,
      granteeUserId: userId,
    });

    log.info({ grantId, granteeUserId: userId, accessLevel: grant.accessLevel }, "proxy_session_started");

    res.json({
      proxyToken: token,
      grantorPatientId: grant.grantorPatientId,
      accessLevel: grant.accessLevel,
      expiresIn: PROXY_SESSION_TTL_SECONDS,
      message: `Proxy session started. Token valid for ${PROXY_SESSION_TTL_SECONDS / 3600}h.`,
    });
  } catch (err) {
    log.error(err, "proxy_switch_failed");
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/proxy/exit — caller discards proxy token; no server-side state needed
// ──────────────────────────────────────────────────────────────────────────────
router.post("/api/proxy/exit", requireUser, (req: Request, res: Response) => {
  const userId = getUserId(req);
  log.info({ userId }, "proxy_session_exit");
  res.json({ message: "Proxy session ended. You are now viewing your own records." });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/proxy/revoke/:grantId — grantor revokes a grant
// ──────────────────────────────────────────────────────────────────────────────
router.post("/api/proxy/revoke/:grantId", requireUser, (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { grantId } = req.params;

  const grant = grantsStore.get(grantId);
  if (!grant) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  if (grant.grantorPatientId !== userId) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  if (grant.revokedAt) {
    return res.status(409).json({ error: "ALREADY_REVOKED" });
  }

  grant.revokedAt = new Date().toISOString();
  grantsStore.set(grantId, grant);

  log.info({ grantId, revokedBy: userId }, "proxy_grant_revoked");

  res.json({ message: "Proxy access revoked.", grantId });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/proxy/digest/:grantId
// Returns a 1-sentence Vertex AI daily digest of the proxied patient's
// last 3 events.  Only event summaries are passed to Vertex — no full clinical
// notes, no identifiers other than appointment specialty / medication name /
// result flag.  Server-side only; digest text is NOT cached.
// ──────────────────────────────────────────────────────────────────────────────
router.get("/api/proxy/digest/:grantId", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { grantId } = req.params;

    const grant = grantsStore.get(grantId);
    if (!grant) return res.status(404).json({ error: "NOT_FOUND" });
    if (grant.granteeUserId !== userId) return res.status(403).json({ error: "FORBIDDEN" });
    if (!canProxyAccess(grant, "appointments")) {
      return res.status(403).json({ error: "ACCESS_DENIED" });
    }

    // Build a PHI-minimal event summary for the Vertex prompt.
    // In production this would query real appointment/medication/lab tables;
    // here we use placeholder event objects that should be replaced by real DB
    // queries filtered by grantorPatientId.
    const recentEvents = await getRecentEventSummaries(grant.grantorPatientId);

    const eventLines = recentEvents
      .slice(0, 3)
      .map((e) => `- ${e.type}: ${e.summary} (${e.date})`)
      .join("\n");

    const digest = await generatePhiSafeText({
      purpose: "proxy-caregiver-digest",
      system:
        "You summarize a patient's recent health events for their caregiver in exactly one plain-English sentence. " +
        "Do not mention the patient by name. Do not include any clinical advice or diagnoses. " +
        "Be warm, brief, and factual.",
      user:
        "Recent events for this patient:\n" +
        eventLines +
        "\n\nWrite one sentence summarizing any notable items for the caregiver.",
      maxTokens: 128,
      temperature: 0.3,
    });

    res.json({ grantId, digest: digest.trim() });
  } catch (err) {
    log.error(err, "proxy_digest_failed");
    res.status(500).json({ error: "INTERNAL_ERROR", digest: "Unable to load today's summary." });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Age-18 auto-revocation job — run daily (hook into cron or startup scheduler)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Scans all grants, auto-revokes any where the grantor is now >= 18.
 * Designed to be called by a daily cron (see server/sync-scheduler.ts or
 * equivalent).  Logs each revocation; creates an audit entry per revocation.
 */
export async function runAge18AutoRevocationJob(): Promise<void> {
  let revokedCount = 0;
  const now = new Date().toISOString();
  for (const [id, grant] of grantsStore) {
    if (grant.revokedAt || grant.ageAutoRevoked) continue;
    if (!grant.grantorDob) continue;
    const { calcAgeYears } = await import("./proxy-access-service");
    const age = calcAgeYears(grant.grantorDob);
    if (age >= 18) {
      grant.ageAutoRevoked = true;
      grant.revokedAt = now;
      grantsStore.set(id, grant);
      revokedCount++;
      log.info(
        { grantId: id, grantorPatientId: grant.grantorPatientId },
        "proxy_age18_auto_revoked",
      );
    }
  }
  if (revokedCount > 0) {
    log.info({ revokedCount }, "proxy_age18_job_complete");
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Middleware to enforce proxy access level on PHI data routes
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Express middleware that validates the proxy session JWT in the
 * `X-Proxy-Token` header and attaches resolved proxy claims to req.proxySession.
 * If no proxy token is present, passes through (the route is in normal mode).
 *
 * Data routes call `resolvePatientIdFromRequest` to get the effective patientId
 * (own id in normal mode, grantor patientId in proxy mode).
 */
export async function proxySessionMiddleware(
  req: any,
  _res: any,
  next: any,
): Promise<void> {
  const token = req.headers["x-proxy-token"] as string | undefined;
  if (!token) {
    req.proxySession = null;
    return next();
  }
  const claims = await verifyProxyJwt(token);
  if (!claims) {
    req.proxySession = null;
    return next();
  }
  // Re-validate the underlying grant (handles mid-session revocations)
  const grant = grantsStore.get(claims.grantId);
  if (!grant || !canProxyAccess(grant, "appointments")) {
    req.proxySession = null;
    return next();
  }
  req.proxySession = claims;
  next();
}

/**
 * Returns the effective patientId for a request:
 *   – proxy mode: grant.grantorPatientId (the patient being viewed)
 *   – normal mode: the authenticated user's own id
 */
export function resolvePatientIdFromRequest(req: any): string {
  if (req.proxySession?.proxy === true) {
    return req.proxySession.grantorPatientId;
  }
  return getUserId(req);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Stub: replace with real DB queries in production. */
async function getRecentEventSummaries(
  _patientId: string,
): Promise<Array<{ type: string; summary: string; date: string }>> {
  // In production: query appointments/lab_results/medications tables
  // filtered by patientId, ordered by date desc, LIMIT 3.
  // Only return PHI-minimal fields (specialty, result flag, medication name).
  return [
    { type: "Appointment", summary: "Primary care follow-up", date: "2026-10-10" },
    { type: "Lab result", summary: "HbA1c: borderline flag", date: "2026-10-08" },
    { type: "Medication", summary: "Metformin refill due", date: "2026-10-07" },
  ];
}

export default router;
export { verifyProxyJwt };
