import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts } from "@shared/schema";
import { users } from "@shared/models/auth";

interface AuthRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
}

export const BETA_CONSENT_VERSION = "1.0.0";

export async function resolveAccountId(req: AuthRequest): Promise<string | null> {
  const sub = req.user?.claims?.sub;
  if (!sub) return null;

  let email = req.user?.claims?.email?.toLowerCase() ?? null;
  if (!email) {
    try {
      const [u] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, sub))
        .limit(1);
      email = u?.email?.toLowerCase() ?? null;
    } catch {
      return null;
    }
  }
  if (!email) return null;

  const [acc] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  return acc?.id ?? null;
}

export async function requirePhiAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.claims?.sub) {
    return res.status(401).json({
      error: "AUTH_REQUIRED",
      message: "Sign in required to connect health records.",
    });
  }

  try {
    const accountId = await resolveAccountId(req);
    if (!accountId) {
      return res.status(403).json({
        error: "ACCOUNT_NOT_PROVISIONED",
        message: "No account record found for this user.",
      });
    }

    const [acc] = await db
      .select({
        unlocked: accounts.phiAccessUnlocked,
        version: accounts.betaConsentVersion,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!acc?.unlocked || acc.version !== BETA_CONSENT_VERSION) {
      return res.status(403).json({
        error: "BETA_CONSENT_REQUIRED",
        message:
          "Real-PHI access is gated by the Beta Participant Agreement. Sign the agreement to connect a real EHR. Synthetic-data sandbox remains available.",
        redirectTo: "/beta-consent",
        currentVersion: BETA_CONSENT_VERSION,
        signedVersion: acc?.version ?? null,
      });
    }

    next();
  } catch (err) {
    console.error("[requirePhiAccess] lookup failed:", err);
    return res.status(500).json({
      error: "PHI_GATE_LOOKUP_FAILED",
      message: "Could not verify beta consent status.",
    });
  }
}
