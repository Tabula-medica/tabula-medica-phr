import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { mfaSecretsTable } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  generateRecoveryCodesPlaintext,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "./services/mfa-recovery-codes";
import { comprehensiveAuditTrailService } from "./services/comprehensive-audit-trail-service";
import {
  sendMfaSecurityEmail,
  type MfaEmailEvent,
} from "./services/mfa-notification-service";
import { isEmailConfigured } from "./services/email-service";

const GCIP_SECRET_SENTINEL = "gcip-managed";

function getUserId(req: Request): string | null {
  const sub = (req.user as any)?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

function getUserEmail(req: Request): string | null {
  const email = (req.user as any)?.claims?.email;
  return typeof email === "string" && email.length > 0 ? email : null;
}

/**
 * Fire the out-of-band security email for an MFA change. Best-effort by
 * design: a mail failure is logged and surfaced as a boolean, never
 * thrown, so it can't undo an MFA change that already committed.
 */
async function notifyMfaChange(
  userId: string,
  req: Request,
  event: MfaEmailEvent,
  extra: { recoveryCodesRemaining?: number } = {}
): Promise<boolean> {
  try {
    const ctx = getAuditContext(req);
    const outcome = await sendMfaSecurityEmail(userId, getUserEmail(req), event, {
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      occurredAt: new Date(),
      recoveryCodesRemaining: extra.recoveryCodesRemaining,
    });
    return outcome.sent;
  } catch (err: any) {
    console.error(`[MFA] security email for "${event}" threw:`, err?.message);
    return false;
  }
}

function getAuditContext(req: Request) {
  return {
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      undefined,
    userAgent: req.headers["user-agent"] as string | undefined,
    sessionId: (req as any).sessionID,
  };
}

async function logMfaAudit(
  userId: string,
  req: Request,
  action: "enroll" | "verify" | "regenerate" | "disable" | "recovery_used",
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await comprehensiveAuditTrailService.logAuditEntry(userId, {
      who: { userId, userRole: "patient", ...getAuditContext(req) },
      what: {
        category: "access_control",
        action: "configure",
        resourceType: "MfaFactor",
        resourceId: userId,
        description: `MFA ${action}: ${success ? "success" : "failure"}`,
      },
      why: { reason: `mfa_${action}`, automatedAction: false },
      result: { success, errorMessage },
      context: getAuditContext(req),
    });
  } catch (err: any) {
    console.error("[MFA] audit log failed:", err?.message);
  }
}

export function registerMfaRoutes(app: Express): void {
  app.get(
    "/api/auth/mfa/status",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthenticated" });
      try {
        const [row] = await db
          .select()
          .from(mfaSecretsTable)
          .where(eq(mfaSecretsTable.userId, userId))
          .limit(1);
        const enabled = Boolean(row?.isEnabled);
        const remaining = row?.backupCodesHash?.length ?? 0;
        res.json({
          enrolled: enabled,
          recoveryCodesRemaining: remaining,
          securityEmailConfigured: isEmailConfigured(),
        });
      } catch (err: any) {
        console.error("[MFA] status error:", err?.message);
        res.status(500).json({ message: "Failed to read MFA status" });
      }
    }
  );

  app.post(
    "/api/auth/mfa/enrolled",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthenticated" });
      try {
        const codes = generateRecoveryCodesPlaintext();
        const hashes = codes.map(hashRecoveryCode);
        const now = new Date();

        const [existing] = await db
          .select()
          .from(mfaSecretsTable)
          .where(eq(mfaSecretsTable.userId, userId))
          .limit(1);

        if (existing) {
          await db
            .update(mfaSecretsTable)
            .set({
              isEnabled: true,
              encryptedSecret: GCIP_SECRET_SENTINEL,
              backupCodesHash: hashes,
              setupCompletedAt: now,
              failedAttempts: 0,
              lockedUntil: null,
              updatedAt: now,
            })
            .where(eq(mfaSecretsTable.userId, userId));
        } else {
          await db.insert(mfaSecretsTable).values({
            userId,
            encryptedSecret: GCIP_SECRET_SENTINEL,
            backupCodesHash: hashes,
            isEnabled: true,
            setupCompletedAt: now,
          });
        }

        await logMfaAudit(userId, req, "enroll", true);
        const emailSent = await notifyMfaChange(userId, req, "enrolled", {
          recoveryCodesRemaining: codes.length,
        });
        res.json({ recoveryCodes: codes, securityEmailSent: emailSent });
      } catch (err: any) {
        console.error("[MFA] enrolled error:", err?.message);
        await logMfaAudit(userId, req, "enroll", false, err?.message);
        res.status(500).json({ message: "Failed to finalize enrollment" });
      }
    }
  );

  app.post(
    "/api/auth/mfa/recovery-codes/regenerate",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthenticated" });
      try {
        const [row] = await db
          .select()
          .from(mfaSecretsTable)
          .where(eq(mfaSecretsTable.userId, userId))
          .limit(1);
        if (!row || !row.isEnabled) {
          return res.status(409).json({ message: "MFA is not enrolled" });
        }
        const codes = generateRecoveryCodesPlaintext();
        const hashes = codes.map(hashRecoveryCode);
        await db
          .update(mfaSecretsTable)
          .set({ backupCodesHash: hashes, updatedAt: new Date() })
          .where(eq(mfaSecretsTable.userId, userId));
        await logMfaAudit(userId, req, "regenerate", true);
        const emailSent = await notifyMfaChange(
          userId,
          req,
          "recovery_codes_regenerated",
          { recoveryCodesRemaining: codes.length }
        );
        res.json({ recoveryCodes: codes, securityEmailSent: emailSent });
      } catch (err: any) {
        console.error("[MFA] regenerate error:", err?.message);
        await logMfaAudit(userId, req, "regenerate", false, err?.message);
        res.status(500).json({ message: "Failed to regenerate recovery codes" });
      }
    }
  );

  app.post(
    "/api/auth/mfa/recovery-codes/consume",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthenticated" });
      const code = typeof req.body?.code === "string" ? req.body.code : "";
      if (!code) return res.status(400).json({ message: "Recovery code required" });
      try {
        const [row] = await db
          .select()
          .from(mfaSecretsTable)
          .where(eq(mfaSecretsTable.userId, userId))
          .limit(1);
        if (!row || !row.isEnabled || !row.backupCodesHash?.length) {
          await logMfaAudit(userId, req, "recovery_used", false, "not_enrolled");
          return res.status(409).json({ message: "MFA is not enrolled" });
        }
        if (row.lockedUntil && row.lockedUntil > new Date()) {
          return res.status(429).json({ message: "Temporarily locked. Try later." });
        }
        const remaining: string[] = [];
        let matched = false;
        for (const hash of row.backupCodesHash) {
          if (!matched && verifyRecoveryCode(code, hash)) {
            matched = true;
            continue;
          }
          remaining.push(hash);
        }
        if (!matched) {
          const failed = (row.failedAttempts ?? 0) + 1;
          const lockedUntil = failed >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
          await db
            .update(mfaSecretsTable)
            .set({
              failedAttempts: failed,
              lockedUntil,
              updatedAt: new Date(),
            })
            .where(eq(mfaSecretsTable.userId, userId));
          await logMfaAudit(userId, req, "recovery_used", false, "bad_code");
          return res.status(401).json({ message: "Invalid recovery code" });
        }
        await db
          .update(mfaSecretsTable)
          .set({
            backupCodesHash: remaining,
            failedAttempts: 0,
            lockedUntil: null,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(mfaSecretsTable.userId, userId));
        await logMfaAudit(userId, req, "recovery_used", true);
        const emailSent = await notifyMfaChange(userId, req, "recovery_code_used", {
          recoveryCodesRemaining: remaining.length,
        });
        res.json({
          ok: true,
          recoveryCodesRemaining: remaining.length,
          securityEmailSent: emailSent,
        });
      } catch (err: any) {
        console.error("[MFA] consume error:", err?.message);
        await logMfaAudit(userId, req, "recovery_used", false, err?.message);
        res.status(500).json({ message: "Failed to verify recovery code" });
      }
    }
  );

  app.post(
    "/api/auth/mfa/disabled",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthenticated" });
      try {
        await db
          .update(mfaSecretsTable)
          .set({
            isEnabled: false,
            backupCodesHash: [],
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(mfaSecretsTable.userId, userId));
        await logMfaAudit(userId, req, "disable", true);
        const emailSent = await notifyMfaChange(userId, req, "disabled");
        res.json({ ok: true, securityEmailSent: emailSent });
      } catch (err: any) {
        console.error("[MFA] disable error:", err?.message);
        await logMfaAudit(userId, req, "disable", false, err?.message);
        res.status(500).json({ message: "Failed to disable MFA" });
      }
    }
  );

  console.log("[Routes] MFA routes registered at /api/auth/mfa/*");
}
