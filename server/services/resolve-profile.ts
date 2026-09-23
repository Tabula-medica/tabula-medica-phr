/**
 * Resolve the authenticated caller's own identity for PHI ownership.
 *
 * On `profiles`/`accounts` vs. the live GCIP identity: `profiles.accountId`
 * has a foreign key to `accounts.id` (shared/schema.ts), a separate legacy
 * table. Nothing in this codebase creates `accounts` rows, sets
 * `req.session.userId`, or writes to `profiles` at all — GCIP auth (the
 * only live auth path, server/replit_integrations/auth) resolves a caller
 * to an internal `users.id` (a different table, shared/models/auth.ts)
 * that has no relationship to `accounts.id`. An earlier version of this
 * function queried `profiles` by `accountId = users.id`, mirroring
 * server/advance-directives-routes.ts — but those two ids can never match,
 * so it 403'd every real request.
 *
 * Every other live PHI router in this codebase (health-tracking-routes.ts,
 * medication-management-routes.ts, personalized-education-routes.ts,
 * ehr-integration-routes.ts) sidesteps this the same way: it treats the
 * authenticated user's own id AS the profile id directly, with no
 * `profiles` table lookup, even though the tables it writes to (vital_signs,
 * health_goals, ...) carry a `profileId` column FK'd to `profiles.id`. This
 * is a genuine, pre-existing gap in the app's identity model (a
 * `profiles`/`accounts` multi-profile design that appears to have never
 * been finished or wired up) — not something introduced by, or fixable
 * from, this PR. This function follows that same established, working
 * convention rather than inventing a new, unverifiable accounts/profiles
 * bridge.
 *
 * Routes must use this (plus `isAuthenticated` from
 * server/replit_integrations/auth) rather than a bespoke
 * `req.session.userId` check, since GCIP/Passport auth does not populate
 * `req.session.userId`.
 */
import type { Request, Response, NextFunction } from "express";

export function getSessionUserId(req: Request): string | null {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    null
  );
}

export async function resolveOwnProfileId(req: Request): Promise<string | null> {
  return getSessionUserId(req);
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
