/**
 * CMS Blue Button 2.0 routes.
 *
 * GET  /api/bluebutton/connect      — initiate OAuth (requireUser)
 * GET  /api/bluebutton/callback     — OAuth callback (public — CMS redirects here)
 * GET  /api/bluebutton/status       — connection status (requireUser)
 * POST /api/bluebutton/sync         — pull latest claims (requireUser)
 * GET  /api/bluebutton/claims       — list decrypted claims (requireUser)
 * DELETE /api/bluebutton/disconnect — revoke & delete tokens (requireUser)
 */

import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "./db";
import { bluebuttonConnections, bluebuttonClaims } from "@shared/schema";
import { eq, and, isNull, desc, count } from "drizzle-orm";
import { requireUser, getUserId } from "./middleware/require-user";
import { decryptPhi } from "./security/phi-encryption";
import {
  isBB2Configured,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  upsertConnection,
  getConnection,
  syncBB2Data,
} from "./bluebutton-service";
import { getLogger } from "./lib/logger";

const log = getLogger("bluebutton-routes");
const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function callbackUrl(req: Request): string {
  return (
    process.env.BB2_CALLBACK_URL ||
    `${req.protocol}://${req.get("host")}/api/bluebutton/callback`
  );
}

// In-process state store for CSRF tokens (replace with Redis/DB for multi-instance)
const pendingStates = new Map<string, { profileId: string; expiresAt: number }>();

function createOAuthState(profileId: string): string {
  const state = randomBytes(24).toString("hex");
  pendingStates.set(state, { profileId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return state;
}

function consumeOAuthState(state: string): string | null {
  const entry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.profileId;
}

// ---------------------------------------------------------------------------
// GET /api/bluebutton/connect
// Redirects the authenticated patient to CMS Blue Button OAuth.
// ---------------------------------------------------------------------------
router.get("/api/bluebutton/connect", requireUser, (req: Request, res: Response) => {
  if (!isBB2Configured()) {
    return res.status(503).json({
      error: "Blue Button is not configured on this server",
    });
  }

  const profileId = getUserId(req);
  const state = createOAuthState(profileId);
  const redirectUri = callbackUrl(req);
  const authUrl = buildAuthorizeUrl(redirectUri, state);

  res.redirect(302, authUrl);
});

// ---------------------------------------------------------------------------
// GET /api/bluebutton/callback
// CMS redirects here after the beneficiary grants access.
// ---------------------------------------------------------------------------
router.get("/api/bluebutton/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    log.warn({ error }, "BB2 OAuth denied by beneficiary");
    return res.redirect("/?bb2=denied");
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state" });
  }

  const profileId = consumeOAuthState(state);
  if (!profileId) {
    return res.status(400).json({ error: "Invalid or expired state — please try again" });
  }

  try {
    const tokens = await exchangeCodeForToken(code, callbackUrl(req));
    await upsertConnection(profileId, tokens);

    // Kick off initial sync in background — don't block the redirect
    syncBB2Data(profileId).catch((err) =>
      log.error({ err, profileId }, "BB2 initial sync failed"),
    );

    res.redirect("/?bb2=connected");
  } catch (err: any) {
    log.error({ err: err?.message, profileId }, "BB2 token exchange failed");
    res.redirect("/?bb2=error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/bluebutton/status
// ---------------------------------------------------------------------------
router.get("/api/bluebutton/status", requireUser, async (req: Request, res: Response) => {
  const profileId = getUserId(req);
  const conn = await getConnection(profileId);

  if (!conn) {
    return res.json({ connected: false });
  }

  const claimCount = await db
    .select({ count: count() })
    .from(bluebuttonClaims)
    .where(eq(bluebuttonClaims.profileId, profileId))
    .then((r) => Number(r[0]?.count ?? 0));

  res.json({
    connected: true,
    connectedAt: conn.connectedAt,
    lastSyncedAt: conn.lastSyncedAt,
    tokenExpiresAt: conn.tokenExpiresAt,
    claimCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/bluebutton/sync
// Manually trigger a claims sync.
// ---------------------------------------------------------------------------
router.post("/api/bluebutton/sync", requireUser, async (req: Request, res: Response) => {
  const profileId = getUserId(req);

  try {
    const result = await syncBB2Data(profileId);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    log.error({ err: err?.message, profileId }, "BB2 sync failed");
    res.status(502).json({ error: err?.message ?? "Sync failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/bluebutton/claims
// Returns decrypted claims for the authenticated patient.
// Query params: type (EOB|Coverage), limit (default 50), offset (default 0)
// ---------------------------------------------------------------------------
const claimsQuerySchema = z.object({
  type: z.enum(["ExplanationOfBenefit", "Coverage"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/api/bluebutton/claims", requireUser, async (req: Request, res: Response) => {
  const profileId = getUserId(req);
  const query = claimsQuerySchema.parse(req.query);

  const conditions = [
    eq(bluebuttonClaims.profileId, profileId),
    ...(query.type ? [eq(bluebuttonClaims.resourceType, query.type)] : []),
  ];

  const rows = await db
    .select()
    .from(bluebuttonClaims)
    .where(and(...conditions))
    .orderBy(desc(bluebuttonClaims.serviceDateStart))
    .limit(query.limit)
    .offset(query.offset);

  const claims = rows.map((r) => ({
    id: r.id,
    resourceType: r.resourceType,
    resourceId: r.resourceId,
    claimType: r.claimType,
    serviceDateStart: r.serviceDateStart,
    serviceDateEnd: r.serviceDateEnd,
    // Decrypt FHIR JSON only when returning to authenticated caller
    fhir: JSON.parse(decryptPhi(r.fhirJson)),
  }));

  res.json({ claims, total: claims.length, offset: query.offset });
});

// ---------------------------------------------------------------------------
// DELETE /api/bluebutton/disconnect
// Soft-deletes the connection (sets disconnectedAt). Data retained per HIPAA.
// ---------------------------------------------------------------------------
router.delete("/api/bluebutton/disconnect", requireUser, async (req: Request, res: Response) => {
  const profileId = getUserId(req);

  await db
    .update(bluebuttonConnections)
    .set({ disconnectedAt: new Date() })
    .where(
      and(
        eq(bluebuttonConnections.profileId, profileId),
        isNull(bluebuttonConnections.disconnectedAt),
      ),
    );

  log.info({ profileId }, "BB2 connection disconnected");
  res.json({ ok: true });
});

export function registerBluebuttonRoutes(app: import("express").Express): void {
  app.use(router);
}
