import type { Request, Response } from "express";
import { createHash } from "crypto";
import { storage } from "../storage";
import { verifyAndResolveGcip, isGcipConfigured } from "../auth/gcip";
import { db } from "../db";
import { externalIdentities } from "@shared/schema";
import { eq } from "drizzle-orm";
import { accessControlService } from "../access-control-service";

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

// Opaque session tokens are 64-char hex (randomBytes(32).toString("hex")).
// GCIP ID tokens are JWTs (three base64url segments). We use the JWT shape as
// a cheap gate before paying for JWKS-backed verification.
function looksLikeJwt(token: string): boolean {
  if (token.length < 64) return false;
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

// Inspect the linked external_identities for an opaque-session user. After
// Task #71's Auth0 retirement and Task #104's column/row cleanup, the only
// federated provider that issues app sessions is GCIP — no "auth0" rows
// remain. Best-effort — never throws, never blocks the hot path.
async function inferSessionProvider(userId: string): Promise<"gcip" | "session"> {
  try {
    const links = await db
      .select()
      .from(externalIdentities)
      .where(eq(externalIdentities.userId, userId));
    if (links.some((l) => l.provider === "gcip")) return "gcip";
    return "session";
  } catch {
    return "session";
  }
}

/**
 * Canonical Bearer-token auth middleware.
 *
 * Single source of truth — imported by routes.ts, compliance-routes.ts, and
 * clinical-code-lookup-routes.ts.
 *
 * Task #71 (Auth0 user-login retirement): the previous Auth0 raw-ID-token
 * validation path was removed. In priority order this middleware accepts
 *   1. a raw GCIP / Firebase ID token (BAA-covered, preferred),
 *   2. our opaque session access token (covers GCIP-exchange sessions, Apple
 *      Sign-In, and email/password).
 * Both paths resolve to the same internal `users.id`. `req._authProvider` is
 * set to `"gcip" | "session"` for downstream log tagging; the
 * `x-auth-provider` response-shadow header is also set so the access-log
 * middleware can pick it up without reading private req fields.
 */
export async function requireAuth(req: Request, res: Response, next: () => void) {
  const authHeader = getHeader(req, "authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken.length < 16) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Path 1: raw GCIP / Firebase ID token.
    if (looksLikeJwt(rawToken) && isGcipConfigured()) {
      try {
        const user = await verifyAndResolveGcip(rawToken);
        if (user) {
          (req as any)._authenticatedUserId = user.id;
          (req as any)._authProvider = "gcip";
          req.headers["x-user-id"] = user.id;
          res.setHeader("x-auth-provider", "gcip");
          return next();
        }
      } catch (error) {
        console.error("[GCIP] Token validation error:", error);
      }
    }

    // Path 2: opaque session access token.
    try {
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const session = await storage.getUserSessionByAccessToken(hashedToken);
      if (session && session.isActive) {
        if (new Date(session.accessTokenExpiresAt) < new Date()) {
          return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
        }
        const provider = await inferSessionProvider(session.userId);
        (req as any)._authenticatedUserId = session.userId;
        (req as any)._authProvider = provider;
        req.headers["x-user-id"] = session.userId;
        res.setHeader("x-auth-provider", provider);
        storage.updateUserSessionActivity(session.id).catch(console.error);
        return next();
      }
    } catch (error) {
      console.error("Token validation error:", error);
    }
  }

  return res.status(401).json({ error: "Unauthorized" });
}

/**
 * Admin-only middleware. Must be used after requireAuth.
 *
 * Grants access only to users whose account has an active role assignment
 * with name === "admin" AND isSystem === true. The isSystem guard ensures
 * portal-created roles with a colliding name cannot bypass this check
 * (consistent with the internal admin check in access-control-service.ts).
 */
export async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req as any)._authenticatedUserId as string | undefined;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const roles = await accessControlService.getUserRoles(userId);
    const isAdmin = roles.some((r) => r.name === "admin" && r.isSystem === true);
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden: admin access required" });
    }
    return next();
  } catch (error) {
    console.error("[requireAdmin] Role check error:", error);
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }
}
