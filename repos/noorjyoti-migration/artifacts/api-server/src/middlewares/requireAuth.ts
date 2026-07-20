import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      /**
       * Secondary quota key set only for anonymous requests.
       * Keyed on the real client IP (`req.ip` with trust-proxy enabled)
       * so quota is enforced even when the nj_anon cookie is not persisted.
       */
      anonIpKey?: string;
      /**
       * True only when the nj_anon cookie was freshly minted for this request
       * (i.e. no valid existing cookie was present).
       */
      anonCookieIsNew?: boolean;
      /** GCIP (Firebase Auth) verified user id (uid) — set by resolveGcipUser. */
      gcipUid?: string;
      /** GCIP verified email — set by resolveGcipUser. */
      gcipEmail?: string;
    }
  }
}

/**
 * Require a signed-in GCIP user. The GCIP ID token is verified upstream by
 * `resolveGcipUser` (see gcipAuth.ts), which sets `req.gcipUid`. This guard just
 * enforces its presence. No third-party login UI; email/password via GCIP.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.gcipUid;
  if (!userId) {
    // Dev-only bypass: only active when NODE_ENV !== "production" AND the
    // explicit ALLOW_DEV_AUTH_BYPASS flag is set (double-gated).
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_DEV_AUTH_BYPASS === "1"
    ) {
      req.userId = "anon-dev-user";
      next();
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
