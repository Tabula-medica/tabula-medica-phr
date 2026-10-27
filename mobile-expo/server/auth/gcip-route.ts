/**
 * Extracted POST /api/auth/gcip handler.
 *
 * Lives in its own module so the regression test in
 * `server/__tests__/auth-gcip.test.ts` can import and exercise the real
 * production handler instead of mounting an inline copy that would silently
 * drift from the wired-up route in `server/routes/clinical-1.ts`.
 *
 * The factory takes its session-minting and audit-logging dependencies as
 * arguments so tests can stub them without dragging in the full
 * `_helpers.ts` surface (DB, storage, fetch, etc).
 */
import type { Request, Response } from "express";
import {
  verifyGcipToken,
  resolveGcipUser,
  createUserFromGcipClaims,
} from "./gcip";

export interface GcipRouteDeps {
  createAuthSession: (
    userId: string,
    req: Request,
  ) => Promise<{ accessToken: string; refreshToken: string }>;
  auditLog: (
    req: Request,
    action: string,
    resourceType?: string,
    resourceId?: string,
    metadata?: object,
  ) => void;
}

export function createGcipAuthHandler(deps: GcipRouteDeps) {
  return async function gcipAuthHandler(req: Request, res: Response) {
    try {
      const { idToken } = req.body ?? {};
      if (!idToken || typeof idToken !== "string") {
        return res.status(400).json({ error: "GCIP ID token is required" });
      }

      const claims = await verifyGcipToken(idToken);
      if (!claims) {
        return res.status(401).json({ error: "Invalid GCIP token" });
      }

      let user = await resolveGcipUser(claims);
      if (!user) {
        user = await createUserFromGcipClaims(claims);
      }
      if (!user) {
        return res
          .status(500)
          .json({ error: "Failed to resolve or create user from GCIP token" });
      }

      deps.auditLog(req, "login", "user", user.id, {
        method: "gcip",
        flow: "id_token",
        signInProvider: claims.firebase?.sign_in_provider,
      });

      const tokens = await deps.createAuthSession(user.id, req);
      const { passwordHash: _passwordHash, ...safeUser } = user as any;
      res.json({
        user: safeUser,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: any) {
      console.error("GCIP auth error:", error);
      const status = error?.statusCode || 500;
      res
        .status(status)
        .json({ error: error?.message || "GCIP authentication failed" });
    }
  };
}
