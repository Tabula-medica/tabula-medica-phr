/**
 * Resolve the authenticated account's own profile id, the same way
 * server/advance-directives-routes.ts does. Routes must use this (plus
 * `isAuthenticated` from server/replit_integrations/auth) rather than a
 * bespoke `req.session.userId` check — the app's real auth is GCIP/Passport
 * (see replitAuth.ts's isAuthenticated), which does not populate
 * `req.session.userId`, and every PHI-adjacent table here is keyed by
 * `profiles.id`, not the account id.
 */
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { profiles } from "@shared/schema";

export function getSessionUserId(req: Request): string | null {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    null
  );
}

export async function resolveOwnProfileId(req: Request): Promise<string | null> {
  const accountId = getSessionUserId(req);
  if (!accountId) return null;

  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);

  return rows.length > 0 ? rows[0].id : null;
}

export async function requireProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profileId = await resolveOwnProfileId(req);
    if (!profileId) {
      return res.status(403).json({ success: false, error: "No profile found for this account" });
    }
    (req as any).resolvedProfileId = profileId;
    next();
  } catch (error) {
    console.error("[ResolveProfile] Profile resolution failed:", error);
    res.status(500).json({ success: false, error: "Failed to resolve profile" });
  }
}
