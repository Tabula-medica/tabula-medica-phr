import { Router, type Request, type Response } from "express";
import { createHash } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { accounts, betaConsentAgreements } from "@shared/schema";
import {
  BETA_CONSENT_VERSION,
  resolveAccountId,
} from "../middleware/require-phi-access";

const router = Router();

const AGREEMENT_TEXT = `TABULA MEDICA — BETA PARTICIPANT AGREEMENT
Version ${BETA_CONSENT_VERSION}

Tabula Medica ("we", "us") is a Covered Entity under HIPAA. By signing
this agreement you ("Beta Participant") authorize us to receive, store,
and process your Protected Health Information (PHI) imported from third-
party Electronic Health Record systems via SMART-on-FHIR.

1. WHAT YOU ARE AGREEING TO
   - You are participating in a closed beta of a personal health-record
     platform that has not yet completed a SOC 2 Type II audit.
   - You may connect REAL EHR accounts and import REAL PHI starting
     immediately after signing.
   - Until you sign this agreement you can only use a synthetic-data
     sandbox; no real PHI flows into your account.

2. SECURITY POSTURE WE WARRANT TODAY
   - HIPAA Administrative, Physical, and Technical Safeguards in place.
   - At-rest field-level encryption for PHI columns (AES-256-GCM).
   - TLS 1.2+ in transit. Google Cloud Identity Platform for authentication.
   - Audit log of every PHI read/write retained for 6 years (HIPAA §164.312(b)).
   - SOC 2 Type II audit IN PROGRESS — target completion Q2 2026.
     This is not a substitute for a completed audit.

3. WHAT YOU ARE WAIVING
   - You acknowledge beta software may have undiscovered defects.
   - You agree to report any suspected security issue within 72 hours
     to security@tabulamedica.health.

4. YOUR RIGHTS
   - You may revoke this agreement at any time at /privacy/manage.
     Revocation triggers deletion of imported PHI within 30 days unless
     a longer retention is required by law (HIPAA 6-year audit log
     retention applies to log records, not clinical data).
   - You may export all imported PHI in FHIR R4 JSON at any time.
   - You retain all rights under HIPAA, CCPA/CPRA, and (if EU/UK)
     GDPR/UK-GDPR including access, correction, portability, and deletion.

5. WHAT THIS AGREEMENT IS NOT
   - This is NOT a Business Associate Agreement (BAA). You are the data
     subject, not a covered entity contracting with us as a BA.
   - This is NOT insurance, medical advice, or a substitute for clinician
     judgment. Tabula Medica is a record-keeping tool.

By clicking "I agree and sign" you assert that you have read this
agreement, are at least 18 years of age, and consent on your own behalf.
A SHA-256 hash of this exact text plus your signing timestamp, IP, and
user-agent are recorded as evidence of consent.
`.trim();

const AGREEMENT_SHA256 = createHash("sha256").update(AGREEMENT_TEXT).digest("hex");

function getClientIp(req: Request): string | null {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

router.get("/agreement", (_req, res) => {
  res.json({
    version: BETA_CONSENT_VERSION,
    sha256: AGREEMENT_SHA256,
    text: AGREEMENT_TEXT,
  });
});

router.get("/status", async (req: Request, res: Response) => {
  try {
    const accountId = await resolveAccountId(req as any);
    if (!accountId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }

    const [acc] = await db
      .select({
        unlocked: accounts.phiAccessUnlocked,
        version: accounts.betaConsentVersion,
        signedAt: accounts.betaConsentSignedAt,
      })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    res.json({
      unlocked: !!acc?.unlocked && acc.version === BETA_CONSENT_VERSION,
      currentVersion: BETA_CONSENT_VERSION,
      signedVersion: acc?.version ?? null,
      signedAt: acc?.signedAt ?? null,
    });
  } catch (err) {
    console.error("[beta-consent/status]", err);
    res.status(500).json({ error: "STATUS_LOOKUP_FAILED" });
  }
});

router.post("/sign", async (req: Request, res: Response) => {
  try {
    const accountId = await resolveAccountId(req as any);
    if (!accountId) {
      return res.status(401).json({ error: "AUTH_REQUIRED" });
    }
    if (req.body?.acknowledged !== true) {
      return res
        .status(400)
        .json({ error: "ACKNOWLEDGEMENT_REQUIRED", message: "acknowledged: true is required" });
    }

    const ip = getClientIp(req);
    const ua = (req.headers["user-agent"] as string | undefined) ?? null;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(betaConsentAgreements).values({
        accountId,
        version: BETA_CONSENT_VERSION,
        agreementSha256: AGREEMENT_SHA256,
        ipAddress: ip,
        userAgent: ua,
        signedAt: now,
      });
      await tx
        .update(accounts)
        .set({
          phiAccessUnlocked: true,
          betaConsentVersion: BETA_CONSENT_VERSION,
          betaConsentSignedAt: now,
          betaConsentSha256: AGREEMENT_SHA256,
          betaConsentIp: ip,
          betaConsentUserAgent: ua,
          updatedAt: now,
        })
        .where(eq(accounts.id, accountId));
    });

    res.json({
      ok: true,
      unlocked: true,
      version: BETA_CONSENT_VERSION,
      signedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("[beta-consent/sign]", err);
    res.status(500).json({ error: "SIGN_FAILED" });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  try {
    const accountId = await resolveAccountId(req as any);
    if (!accountId) return res.status(401).json({ error: "AUTH_REQUIRED" });
    const rows = await db
      .select()
      .from(betaConsentAgreements)
      .where(eq(betaConsentAgreements.accountId, accountId))
      .orderBy(desc(betaConsentAgreements.signedAt))
      .limit(20);
    res.json({ history: rows });
  } catch (err) {
    console.error("[beta-consent/history]", err);
    res.status(500).json({ error: "HISTORY_LOOKUP_FAILED" });
  }
});

export default router;
