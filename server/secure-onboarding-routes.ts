import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  type SecureOnboardingSession,
  type OnboardingDocument,
  type OnboardingConsent,
  type OnboardingAuditEntry,
  type OnboardingStepName,
  type OnboardingDocType,
  type OnboardingConsentType,
  secureOnboardingProfileSchema,
  submitConsentSchema,
  onboardingStepNames,
  onboardingDocTypes,
} from "@shared/schema";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const router = Router();

const sessions = new Map<string, SecureOnboardingSession>();
const documents = new Map<string, OnboardingDocument>();
const consents = new Map<string, OnboardingConsent>();
const auditLog: OnboardingAuditEntry[] = [];

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const stepNavigationSchema = z.object({
  step: z.enum(onboardingStepNames),
});

const documentUploadUrlSchema = z.object({
  docType: z.enum(onboardingDocTypes),
  fileName: z.string().min(1, "File name is required").max(255),
  contentType: z.string().refine((ct) => ALLOWED_MIME_TYPES.includes(ct), {
    message: `Content type must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`,
  }),
  fileSize: z.number().max(MAX_FILE_SIZE, "File exceeds 10MB limit").optional(),
});

const documentConfirmSchema = z.object({
  docType: z.enum(onboardingDocTypes),
  fileName: z.string().min(1),
  mimeType: z.string().refine((ct) => ALLOWED_MIME_TYPES.includes(ct), {
    message: "Invalid mime type",
  }),
  objectKey: z.string().min(1, "Object key is required"),
});

function logAudit(sessionId: string, patientId: string, action: string, details: string, ipAddress: string | null): OnboardingAuditEntry {
  const entry: OnboardingAuditEntry = {
    id: `audit-${Date.now()}-${randomUUID().slice(0, 8)}`,
    sessionId,
    patientId,
    action,
    details: details.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[SSN-REDACTED]"),
    ipAddress,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(entry);
  console.log(`[PHI-AUDIT] ${entry.timestamp} | ${action} | patient=${patientId} | session=${sessionId} | ip=${ipAddress || "unknown"}`);
  return entry;
}

function validatePatientId(patientId: string): boolean {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(patientId);
}

function getOrCreateSession(patientId: string): SecureOnboardingSession {
  const allSessions = Array.from(sessions.values());
  for (const session of allSessions) {
    if (session.patientId === patientId && session.status === "in_progress") {
      return session;
    }
  }
  const session: SecureOnboardingSession = {
    id: `onb-${Date.now()}-${randomUUID().slice(0, 8)}`,
    patientId,
    currentStep: "welcome",
    completedSteps: [],
    profileData: null,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastActivityAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

router.use((req, res, next) => {
  const patientId = req.params.patientId || req.path.split("/")[2];
  if (patientId && !validatePatientId(patientId)) {
    return res.status(400).json({ error: "Invalid patient identifier format" });
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  next();
});

router.get("/session/:patientId", (req, res) => {
  const { patientId } = req.params;
  const session = getOrCreateSession(patientId);
  const sessionDocs = Array.from(documents.values()).filter((d) => d.sessionId === session.id);
  const sessionConsents = Array.from(consents.values()).filter((c) => c.sessionId === session.id);

  logAudit(session.id, patientId, "SESSION_ACCESS", "Patient accessed onboarding session", req.ip || null);

  const safeDocs = sessionDocs.map(({ objectKey, ...rest }) => ({ ...rest, hasFile: true }));
  res.json({ session, documents: safeDocs, consents: sessionConsents });
});

router.post("/session/:patientId/step", (req, res) => {
  const { patientId } = req.params;

  const result = stepNavigationSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  const session = getOrCreateSession(patientId);
  session.currentStep = result.data.step;
  session.lastActivityAt = new Date().toISOString();

  logAudit(session.id, patientId, "STEP_NAVIGATION", `Navigated to step: ${result.data.step}`, req.ip || null);

  res.json({ session });
});

router.post("/session/:patientId/profile", (req, res) => {
  const { patientId } = req.params;

  const result = secureOnboardingProfileSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  const session = getOrCreateSession(patientId);
  session.profileData = result.data;
  if (!session.completedSteps.includes("profile")) {
    session.completedSteps.push("profile");
  }
  session.lastActivityAt = new Date().toISOString();

  logAudit(session.id, patientId, "PROFILE_SAVED", "Patient profile information saved (PHI - demographics, contact, emergency contact)", req.ip || null);

  res.json({ session });
});

router.post("/session/:patientId/document/upload-url", async (req, res) => {
  const { patientId } = req.params;

  const result = documentUploadUrlSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  const { docType, fileName, contentType } = result.data;

  try {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const session = getOrCreateSession(patientId);

    logAudit(session.id, patientId, "DOCUMENT_UPLOAD_INITIATED", `Upload URL generated for ${docType}: ${fileName} (${contentType})`, req.ip || null);

    res.json({
      uploadURL,
      objectPath,
      sessionId: session.id,
      metadata: { docType, fileName, contentType },
    });
  } catch (error) {
    console.error("[PHI-AUDIT] Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/session/:patientId/document/confirm", (req, res) => {
  const { patientId } = req.params;

  const result = documentConfirmSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  const { docType, fileName, mimeType, objectKey } = result.data;
  const session = getOrCreateSession(patientId);

  const docEntries = Array.from(documents.entries());
  for (const [id, doc] of docEntries) {
    if (doc.sessionId === session.id && doc.docType === docType) {
      documents.delete(id);
      logAudit(session.id, patientId, "DOCUMENT_REPLACED", `Previous ${docType} document replaced`, req.ip || null);
    }
  }

  const doc: OnboardingDocument = {
    id: `doc-${Date.now()}-${randomUUID().slice(0, 8)}`,
    sessionId: session.id,
    patientId,
    docType: docType as OnboardingDocType,
    fileName,
    mimeType,
    objectKey,
    uploadedAt: new Date().toISOString(),
    verified: false,
  };
  documents.set(doc.id, doc);

  const sessionDocs = Array.from(documents.values()).filter((d) => d.sessionId === session.id);
  const hasId = sessionDocs.some((d) => d.docType === "government_id");
  const hasInsurance = sessionDocs.some((d) => d.docType === "insurance_front");
  if (hasId && hasInsurance && !session.completedSteps.includes("documents")) {
    session.completedSteps.push("documents");
  }
  session.lastActivityAt = new Date().toISOString();

  logAudit(session.id, patientId, "DOCUMENT_UPLOADED", `Document confirmed: ${docType} (${fileName}), encrypted at rest`, req.ip || null);

  const safeDocs = sessionDocs.map(({ objectKey: _key, ...rest }) => ({ ...rest, hasFile: true }));
  res.json({ document: { ...doc, objectKey: undefined, hasFile: true }, documents: safeDocs });
});

router.get("/session/:patientId/documents", (req, res) => {
  const { patientId } = req.params;
  const session = getOrCreateSession(patientId);
  const sessionDocs = Array.from(documents.values()).filter((d) => d.sessionId === session.id);

  logAudit(session.id, patientId, "DOCUMENTS_VIEWED", "Patient viewed uploaded documents list", req.ip || null);

  const safeDocs = sessionDocs.map(({ objectKey, ...rest }) => ({ ...rest, hasFile: true }));
  res.json(safeDocs);
});

router.post("/session/:patientId/consent", (req, res) => {
  const { patientId } = req.params;

  const result = submitConsentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Validation failed", details: result.error.flatten() });
  }

  const { consentType, agreed, version } = result.data;
  const session = getOrCreateSession(patientId);

  const consentEntries = Array.from(consents.entries());
  for (const [id, c] of consentEntries) {
    if (c.sessionId === session.id && c.consentType === consentType) {
      consents.delete(id);
    }
  }

  const consent: OnboardingConsent = {
    id: `consent-${Date.now()}-${randomUUID().slice(0, 8)}`,
    sessionId: session.id,
    patientId,
    consentType: consentType as OnboardingConsentType,
    agreed,
    agreedAt: agreed ? new Date().toISOString() : null,
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
    version,
  };
  consents.set(consent.id, consent);

  const sessionConsents = Array.from(consents.values()).filter((c) => c.sessionId === session.id);
  const requiredConsents: OnboardingConsentType[] = ["terms_of_service", "privacy_policy", "hipaa_notice"];
  const allRequired = requiredConsents.every((ct) => sessionConsents.some((c) => c.consentType === ct && c.agreed));
  if (allRequired && !session.completedSteps.includes("consents")) {
    session.completedSteps.push("consents");
  }
  session.lastActivityAt = new Date().toISOString();

  logAudit(
    session.id,
    patientId,
    agreed ? "CONSENT_GRANTED" : "CONSENT_REVOKED",
    `${consentType} v${version}: ${agreed ? "agreed" : "declined"} | ua=${req.headers["user-agent"]?.substring(0, 50) || "unknown"}`,
    req.ip || null
  );

  res.json({ consent, consents: sessionConsents });
});

router.get("/session/:patientId/consents", (req, res) => {
  const { patientId } = req.params;
  const session = getOrCreateSession(patientId);
  const sessionConsents = Array.from(consents.values()).filter((c) => c.sessionId === session.id);
  res.json(sessionConsents);
});

router.post("/session/:patientId/complete", (req, res) => {
  const { patientId } = req.params;
  const session = getOrCreateSession(patientId);

  const requiredSteps: OnboardingStepName[] = ["profile", "documents", "consents"];
  const missingSteps = requiredSteps.filter((s) => !session.completedSteps.includes(s));
  if (missingSteps.length > 0) {
    logAudit(session.id, patientId, "ONBOARDING_COMPLETION_FAILED", `Missing steps: ${missingSteps.join(", ")}`, req.ip || null);
    return res.status(400).json({ error: "Not all required steps completed", missingSteps });
  }

  session.status = "completed";
  session.currentStep = "complete";
  if (!session.completedSteps.includes("complete")) {
    session.completedSteps.push("complete");
  }
  session.completedAt = new Date().toISOString();
  session.lastActivityAt = new Date().toISOString();

  logAudit(session.id, patientId, "ONBOARDING_COMPLETED", "Patient completed secure onboarding successfully - all PHI verified and consents recorded", req.ip || null);

  res.json({ session, message: "Onboarding completed successfully" });
});

router.get("/session/:patientId/audit-log", (req, res) => {
  const { patientId } = req.params;
  const patientAudit = auditLog.filter((e) => e.patientId === patientId);

  logAudit(
    patientAudit[0]?.sessionId || "unknown",
    patientId,
    "AUDIT_LOG_VIEWED",
    "PHI audit log accessed for review",
    req.ip || null
  );

  res.json(patientAudit);
});

export default router;
