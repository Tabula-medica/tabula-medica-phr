/**
 * Provider / Lab / Hospital Onboarding Hub — REST Routes (Task #296)
 *
 * All endpoints are protected by requireAuth.
 *
 *  POST /api/onboarding/provider/start                  — create session
 *  GET  /api/onboarding/provider/status/:sessionId      — get / resume
 *  POST /api/onboarding/provider/step                   — advance / skip a step
 *  POST /api/onboarding/provider/test-fhir              — live FHIR metadata ping
 *  POST /api/onboarding/provider/provision-webhook      — generate HMAC secret
 *  GET  /api/onboarding/provider/metrics                — aggregate metrics
 */

import crypto from "crypto";
import type { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/require-auth";
import {
  startOnboardingSession,
  getSession,
  getLatestSessionForUser,
  advanceStep,
  testFhirEndpoint,
  provisionWebhookSecret,
  getSessionMetrics,
  type ProviderPersona,
  type OnboardingStepId,
} from "../provider-onboarding-service";

const VALID_PERSONAS: ProviderPersona[] = [
  "provider", "lab", "radiology", "hospital", "dpc",
];

function getUserId(req: Request): string {
  return (req as unknown as Record<string, string>)._authenticatedUserId || "";
}

export function registerProviderOnboardingRoutes(app: Express): void {

  // ── Start session ─────────────────────────────────────────────────────────

  app.post("/api/onboarding/provider/start", requireAuth, async (req: Request, res: Response) => {
    const { persona, orgName, contactEmail, npiNumber, taxonomyCode } = req.body;
    const userId = getUserId(req);

    if (!persona || !VALID_PERSONAS.includes(persona as ProviderPersona)) {
      return res.status(400).json({ error: "persona required", valid: VALID_PERSONAS });
    }
    if (!orgName || typeof orgName !== "string" || orgName.trim().length < 2) {
      return res.status(400).json({ error: "orgName required (≥2 chars)" });
    }
    if (!contactEmail || typeof contactEmail !== "string" || !contactEmail.includes("@")) {
      return res.status(400).json({ error: "valid contactEmail required" });
    }

    try {
      const session = await startOnboardingSession({
        userId,
        persona: persona as ProviderPersona,
        orgName,
        contactEmail,
        npiNumber: npiNumber ? String(npiNumber).trim() : undefined,
        taxonomyCode: taxonomyCode ? String(taxonomyCode).trim() : undefined,
      });
      return res.status(201).json({ session });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── User-scoped resume (cross-device) ─────────────────────────────────────
  // Returns the authenticated user's most recent in-progress session so the
  // web/mobile client can resume without needing a locally stored sessionId.

  app.get("/api/onboarding/provider/status", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req);
    try {
      const session = await getLatestSessionForUser(userId);
      return res.json({ session });          // null if no prior session
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── Status by sessionId ────────────────────────────────────────────────────

  app.get("/api/onboarding/provider/status/:sessionId", requireAuth, async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;
    const userId = getUserId(req);
    try {
      const session = await getSession(sessionId, userId);
      if (!session) return res.status(404).json({ error: "Session not found" });
      return res.json({ session });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── Advance / skip step ───────────────────────────────────────────────────

  app.post("/api/onboarding/provider/step", requireAuth, async (req: Request, res: Response) => {
    const { sessionId, stepId, data, skip } = req.body;
    const userId = getUserId(req);

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId required" });
    }
    if (!stepId || typeof stepId !== "string") {
      return res.status(400).json({ error: "stepId required" });
    }

    try {
      const session = await advanceStep(
        sessionId,
        userId,
        stepId as OnboardingStepId,
        data as Record<string, unknown> | undefined,
        Boolean(skip),
      );
      return res.json({ session });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bad request";
      const code = msg.includes("not found") ? 404 : msg.includes("completed") ? 409 : 400;
      return res.status(code).json({ error: msg });
    }
  });

  // ── FHIR metadata test ────────────────────────────────────────────────────

  app.post("/api/onboarding/provider/test-fhir", requireAuth, async (req: Request, res: Response) => {
    const { sessionId, fhirBaseUrl } = req.body;
    const userId = getUserId(req);

    if (!sessionId || !fhirBaseUrl || typeof fhirBaseUrl !== "string") {
      return res.status(400).json({ error: "sessionId and fhirBaseUrl required" });
    }

    try {
      const result = await testFhirEndpoint(sessionId, userId, fhirBaseUrl.trim());
      return res.json({ result });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── Webhook secret provisioning ───────────────────────────────────────────

  app.post("/api/onboarding/provider/provision-webhook", requireAuth, async (req: Request, res: Response) => {
    const { sessionId } = req.body;
    const userId = getUserId(req);

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId required" });
    }

    try {
      const provision = await provisionWebhookSecret(sessionId, userId);
      return res.json({ provision });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── Send synthetic test result (lab onboarding) ───────────────────────────

  app.post("/api/onboarding/provider/send-test-result", requireAuth, async (req: Request, res: Response) => {
    const { sessionId } = req.body;
    const userId = getUserId(req);

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId required" });
    }

    try {
      const session = await getSession(sessionId, userId);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (session.persona !== "lab") {
        return res.status(400).json({ error: "send-test-result only valid for lab persona" });
      }
      if (!session.webhookEndpointUrl) {
        return res.status(400).json({ error: "Webhook must be provisioned before sending test result" });
      }

      // Build a synthetic (non-PHI) FHIR R4 DiagnosticReport payload
      const syntheticReport = {
        resourceType: "DiagnosticReport",
        id: `test-${crypto.randomUUID()}`,
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB" }] }],
        code: { coding: [{ system: "http://loinc.org", code: "58410-2", display: "CBC panel" }] },
        subject: { display: "Synthetic Test Patient — not PHI" },
        issued: new Date().toISOString(),
        conclusion: "Synthetic test result — delivery confirmed",
      };

      // Deliver to the provisioned webhook endpoint (best-effort)
      let deliveryOk = false;
      try {
        const { safeFetch: sf } = await import("../utils/safe-fetch");
        const deliveryResp = await sf(session.webhookEndpointUrl, {
          method: "POST",
          headers: { "Content-Type": "application/fhir+json", "X-Tabula-Test": "true" },
          body: JSON.stringify(syntheticReport),
        });
        deliveryOk = deliveryResp.ok;
      } catch {
        // Webhook target may not exist yet — log only; step still advances
        deliveryOk = false;
      }

      return res.json({
        sent: true,
        deliveryOk,
        resourceType: "DiagnosticReport",
        note: "Synthetic (non-PHI) test result dispatched",
      });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });

  // ── Metrics ───────────────────────────────────────────────────────────────

  app.get("/api/onboarding/provider/metrics", requireAuth, async (_req: Request, res: Response) => {
    try {
      const metrics = await getSessionMetrics();
      return res.json({ metrics });
    } catch (err: unknown) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  });
}
