import type { RequestHandler } from "express";
import { verifyAndResolveGcip } from "../auth/gcip";

type GcipResolver = (token: string) => Promise<
  { id: string; email?: string | null; firstName?: string | null; lastName?: string | null } | null | undefined
>;

/**
 * Global, non-blocking identity middleware for GCIP bearer clients.
 *
 * - If req.user is already set (session cookie via passport), it does nothing.
 * - If an `Authorization: Bearer <GCIP ID token>` header is present and
 *   verifies, it fills req.user with the same shape isAuthenticated uses.
 * - It NEVER rejects: invalid/missing tokens fall through as anonymous, so
 *   per-route guards (requireUser, isAuthenticated, requireFeature, ownership
 *   checks) still decide access exactly as before.
 */
export function createGcipBearerIdentity(resolve: GcipResolver = verifyAndResolveGcip as GcipResolver): RequestHandler {
  return async (req, _res, next) => {
    if ((req.user as any)?.claims?.sub) return next();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return next();
    const token = authHeader.slice(7).trim();
    if (!token) return next();
    try {
      const gcipUser = await resolve(token);
      if (gcipUser?.id) {
        (req as any).user = {
          claims: {
            sub: gcipUser.id,
            email: gcipUser.email,
            first_name: gcipUser.firstName,
            last_name: gcipUser.lastName,
            provider: "gcip",
          },
          access_token: token,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
      }
    } catch {
      // Unverifiable token: stay anonymous; route guards return 401.
    }
    next();
  };
}

export const gcipBearerIdentity = createGcipBearerIdentity();