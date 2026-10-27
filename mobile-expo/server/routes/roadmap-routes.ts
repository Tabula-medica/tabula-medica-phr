/**
 * Roadmap 2026 — "Do now" API routes
 *
 * Bundles:
 *   1.1  WebAuthn / Passkey registration + authentication
 *   1.2  Encryption attestation endpoint (public)
 *   1.5  AI disclosure config (practice-level)
 *   1.6  Model cards (public)
 *   2.5  Pre-visit chart prep
 */

import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/require-auth";
import {
  createRegistrationOptions,
  createAuthenticationOptions,
  verifyRegistration,
  verifyAuthentication,
} from "../webauthn-service";
import {
  getPracticeAiConfig,
  setPracticeAiConfig,
  getStateLaws,
  getSupportedJurisdictions,
  appendDisclaimer,
  buildAiMessageMeta,
} from "../ai-disclosure-service";
import {
  getAllModelCards,
  getModelCardById,
  getModelCardsIndex,
  getModelCardsByCategory,
} from "../model-cards-service";
import {
  generatePreVisitBrief,
} from "../pre-visit-chart-prep-service";
import { runGuardrails, scrubPHI } from "../ai-guardrail-pipeline";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

export function registerRoadmapRoutes(app: Express): void {

  // ─── 1.1 WebAuthn / Passkeys ────────────────────────────────────────────────

  app.post("/api/webauthn/register/options", requireAuth, (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "email required" });
      const options = createRegistrationOptions(userId, email);
      res.json(options);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/webauthn/register/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { clientDataJSON, attestationObject, transports, deviceName } = req.body;
      if (!clientDataJSON || !attestationObject) {
        return res.status(400).json({ error: "clientDataJSON and attestationObject required" });
      }

      const verified = verifyRegistration(userId, clientDataJSON, attestationObject, transports || []);

      const { storage } = await import("../storage");
      await storage.saveWebauthnCredential({
        userId,
        credentialId: verified.credentialId,
        publicKeyJwk: verified.publicKeyJwk,
        counter: verified.counter,
        aaguid: verified.aaguid,
        transports: verified.transports,
        deviceName: deviceName || "Passkey",
        lastUsedAt: new Date(),
      });

      res.json({ verified: true, credentialId: verified.credentialId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/webauthn/authenticate/options", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { storage } = await import("../storage");
      const creds = await storage.getWebauthnCredentials(userId);
      const options = createAuthenticationOptions(
        creds.map((c: any) => ({ credentialId: c.credentialId, transports: c.transports || [] }))
      );
      res.json(options);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/webauthn/authenticate/verify", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { challenge, credentialId, clientDataJSON, authenticatorData, signature } = req.body;
      if (!challenge || !credentialId || !clientDataJSON || !authenticatorData || !signature) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { storage } = await import("../storage");
      const cred = await storage.getWebauthnCredentialById(userId, credentialId);
      if (!cred) return res.status(404).json({ error: "Credential not found" });

      const result = verifyAuthentication(challenge, cred, clientDataJSON, authenticatorData, signature);

      await storage.updateWebauthnCredentialCounter(cred.credentialId, result.newCounter);

      res.json({ verified: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/webauthn/credentials", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { storage } = await import("../storage");
      const creds = await storage.getWebauthnCredentials(userId);
      res.json(
        creds.map((c: any) => ({
          credentialId: c.credentialId,
          deviceName: c.deviceName,
          aaguid: c.aaguid,
          transports: c.transports,
          lastUsedAt: c.lastUsedAt,
          createdAt: c.createdAt,
        }))
      );
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/webauthn/credentials/:credentialId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const credentialId = req.params.credentialId as string;
      const { storage } = await import("../storage");
      await storage.deleteWebauthnCredential(userId, credentialId);
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 1.2 Encryption attestation (public) ────────────────────────────────────

  app.get("/api/security/attestation", (_req: Request, res: Response) => {
    res.json({
      document: "Tabula Medica Encryption & Compliance Attestation",
      version: "2.0",
      generatedAt: new Date().toISOString(),
      organization: "Tabula Medica Inc.",
      encryptionAtRest: {
        status: "implemented",
        algorithm: "AES-256-GCM",
        keyManagement: "Google Cloud KMS (CMEK)",
        scope: "All ePHI stored in GCP Cloud Healthcare API and GCS HIPAA buckets",
        standard: "FIPS 140-2 Level 3 via GCP KMS",
      },
      encryptionInTransit: {
        status: "implemented",
        protocol: "TLS 1.2+ (TLS 1.3 preferred)",
        scope: "All client-server and server-to-service communication",
        enforcement: "HSTS with includeSubDomains; Cloudflare edge TLS",
      },
      authentication: {
        primaryIdP: "Google Cloud Identity Platform (GCIP) — under GCP BAA",
        mfa: {
          supported: ["TOTP (RFC 6238)", "Platform passkeys (WebAuthn FIDO2)", "Biometric (iOS/Android)"],
          enforcement: "Required for privileged operations",
        },
        sessionManagement: "Opaque tokens; 15-minute inactivity timeout; device-bound sessions",
      },
      phiHandling: {
        storage: "GCP Cloud Healthcare API FHIR store + GCS HIPAA buckets",
        noPhiOnReplitInfrastructure: true,
        deidentificationBeforeLLM: true,
        auditLog: "Every PHI access logged with user ID, action, timestamp, and resource type",
      },
      baaStatus: {
        googleCloudPlatform: "Active",
        anthropic: "Active",
        claimMD: "Active",
        photon: "Active",
      },
      hipaaSecurityRule: {
        accessControl: "RBAC with least-privilege; admin routes gated on explicit privilege check",
        auditControls: "Durable per-request audit log; SOC 2 evidence pipeline",
        integrityControls: "AES-256-GCM authentication tag; TLS message integrity",
        transmissionSecurity: "TLS 1.3; Cloudflare HSTS preloading",
        workforceTraining: "Annual HIPAA training tracked in compliance module",
      },
      soc2: {
        type: "SOC 2 Type II alignment (in progress)",
        trustServiceCriteria: ["CC1–CC9 (Common Criteria)", "Availability", "Confidentiality"],
        evidencePipeline: "Automated via audit log + compliance dashboard",
      },
      lastReviewed: "2026-06-09",
      nextScheduledReview: "2026-12-09",
      contactEmail: "security@tabulamedica.health",
    });
  });

  // ─── 1.5 AI Disclosure config ────────────────────────────────────────────────

  app.get("/api/ai-disclosure/jurisdictions", (_req: Request, res: Response) => {
    res.json({
      supported: getSupportedJurisdictions(),
      laws: getStateLaws(),
    });
  });

  app.get("/api/ai-disclosure/config/:practiceId", requireAuth, (req: Request, res: Response) => {
    const config = getPracticeAiConfig(req.params.practiceId as string, String(req.query.state || ""));
    res.json(config);
  });

  app.put("/api/ai-disclosure/config/:practiceId", requireAuth, (req: Request, res: Response) => {
    const { state, aiDisclosureRequired, clinicianReviewSuppressesDisclaimer } = req.body;
    setPracticeAiConfig({
      practiceId: req.params.practiceId as string,
      state: String(state || ""),
      aiDisclosureRequired: !!aiDisclosureRequired,
      clinicianReviewSuppressesDisclaimer: clinicianReviewSuppressesDisclaimer !== false,
    });
    res.json({ updated: true });
  });

  app.post("/api/ai-disclosure/check", requireAuth, (req: Request, res: Response) => {
    const { practiceId, state, messageBody, modelUsed, clinicianReviewed } = req.body;
    if (!messageBody) return res.status(400).json({ error: "messageBody required" });

    const config = getPracticeAiConfig(String(practiceId || "default"), String(state || ""));
    const meta = buildAiMessageMeta(modelUsed || "gemini-2.5-pro", !!clinicianReviewed);
    const result = appendDisclaimer(messageBody, config, meta);

    res.json({
      body: result.body,
      disclosureAppended: result.disclosureAppended,
      legalBasis: result.legalBasis,
    });
  });

  // ─── 1.6 Model Cards (public) ────────────────────────────────────────────────

  app.get("/api/model-cards", (_req: Request, res: Response) => {
    res.json({ cards: getAllModelCards() });
  });

  app.get("/api/model-cards/index", (_req: Request, res: Response) => {
    res.json({ index: getModelCardsIndex() });
  });

  app.get("/api/model-cards/category/:category", (req: Request, res: Response) => {
    const cards = getModelCardsByCategory(String(req.params.category) as any);
    res.json({ cards });
  });

  app.get("/api/model-cards/:id", (req: Request, res: Response) => {
    const card = getModelCardById(req.params.id as string);
    if (!card) return res.status(404).json({ error: "Model card not found" });
    res.json(card);
  });

  // ─── 2.5 Pre-Visit Chart Prep ────────────────────────────────────────────────

  app.post("/api/clinical/pre-visit-prep", requireAuth, async (req: Request, res: Response) => {
    try {
      const { appointmentContext, chartSummary } = req.body;
      if (!appointmentContext || !chartSummary) {
        return res.status(400).json({ error: "appointmentContext and chartSummary required" });
      }

      const userId = getUserId(req);
      if (appointmentContext.patientId && appointmentContext.patientId !== userId) {
        const { storage } = await import("../storage");
        const hasAccess = await storage.providerHasPatientAccess?.(userId, appointmentContext.patientId);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied to patient record" });
        }
      }

      // Scrub PHI from free-text string fields inside ChartSummaryInput before the LLM sees them.
      // Preserves the object structure that generatePreVisitBrief requires.
      const scrubStr = (s: string) => scrubPHI(s).scrubbed;
      const scrubStrArr = (arr?: string[]) => arr?.map(scrubStr);
      const scrubbedChartSummary = typeof chartSummary === "string"
        ? chartSummary  // pass-through (unusual); generatePreVisitBrief handles string fallback
        : {
            ...chartSummary,
            activeProblems: scrubStrArr(chartSummary.activeProblems) ?? [],
            currentMedications: (chartSummary.currentMedications ?? []).map(
              (m: { name: string; dose: string; startDate?: string }) => ({
                ...m,
                name: scrubStr(m.name),
                dose: scrubStr(m.dose),
              })
            ),
            recentLabResults: (chartSummary.recentLabResults ?? []).map(
              (l: { test: string; value: string; date: string; flag?: string }) => ({
                ...l,
                value: scrubStr(l.value),
              })
            ),
            lastVisitNotes: chartSummary.lastVisitNotes
              ? scrubStr(chartSummary.lastVisitNotes)
              : undefined,
            allergies: scrubStrArr(chartSummary.allergies),
            dueScreenings: scrubStrArr(chartSummary.dueScreenings),
            dueImmunizations: scrubStrArr(chartSummary.dueImmunizations),
          };

      const brief = await generatePreVisitBrief(appointmentContext, scrubbedChartSummary);

      // Pipe the briefSummary text through the guardrail pipeline
      const guardrailResult = await runGuardrails(brief.briefSummary, {
        route: "/api/clinical/pre-visit-prep",
        userId,
      });

      res.json({
        ...brief,
        briefSummary: guardrailResult.output,
        guardrails: {
          reviewRequired: guardrailResult.reviewRequired,
          phiTokensReplaced: guardrailResult.phiTokensReplaced,
        },
      });
    } catch (err: any) {
      console.error("Pre-visit prep error:", err.message);
      res.status(500).json({ error: "Failed to generate pre-visit brief" });
    }
  });
}
