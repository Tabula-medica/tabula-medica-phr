import type { Request, Response, NextFunction, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";

/**
 * requireUser — the ONE way to gate a route on an authenticated user.
 * Wraps isAuthenticated (session cookie OR GCIP bearer) and additionally
 * guarantees a resolved internal user id at req.user.claims.sub.
 * Any route that reads or writes patient, account, or profile data MUST
 * mount this — either per-route or router.use(requireUser) at the top.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  return (isAuthenticated as any)(req, res, (err?: any) => {
    if (err) return next(err);
    if (!(req.user as any)?.claims?.sub) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
    }
    next();
  });
};

/**
 * getUserId — the ONLY acceptable way to read the acting user's id.
 * Throws 401 if absent. REPLACES every `|| "system"` / `|| "patient-001"` /
 * `|| "current-user"` fallback in the codebase (see P0-5).
 */
export function getUserId(req: Request): string {
  const userId = (req.user as any)?.claims?.sub as string | undefined;
  if (!userId) {
    const err: any = new Error("Missing authenticated user context");
    err.status = 401;
    throw err;
  }
  return userId;
}

/**
 * assertOwnsProfile(param) — IDOR guard for routes carrying :patientId /
 * :profileId params. Loads the caller's profiles and 404s (NOT 403 — avoids
 * id enumeration) when the param isn't one of theirs.
 */
export function assertOwnsProfile(param: "patientId" | "profileId" = "profileId"): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req);
      const id = req.params[param];
      if (!id) return res.status(400).json({ error: "BAD_REQUEST", message: `Missing ${param}` });
      const profiles = await storage.getProfiles(userId);
      const owns = profiles.some((p: any) => p.id === id || (p as any).patientId === id);
      if (!owns) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Resource not found." });
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Per-user limiter for AI-cost endpoints (voice, OCR, summarization). */
export const aiUserRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user as any)?.claims?.sub ?? req.ip ?? "anon",
  message: { error: "AI_RATE_LIMITED", message: "Too many AI requests. Please slow down." },
  validate: { xForwardedForHeader: false },
});
