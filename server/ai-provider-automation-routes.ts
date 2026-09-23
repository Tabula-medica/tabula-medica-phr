import { Router, Request, Response } from "express";
import { aiProviderAutomationService, ClinicalDocumentationSnippet, ReferralNote, PreventiveCareOrder } from "./services/ai-provider-automation-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { createAuditLogEntry } from "./ai-audit-log-routes";
import { requireUser, getUserId } from "./middleware/require-user";
import type { InsertAiAuditLogEntry, UserRole } from "@shared/schema";

const router = Router();

router.use(requireUser);

function getUserRole(req: Request): UserRole {
  return (req as any).user?.role || (req as any).session?.userRole || "patient";
}

function isProvider(req: Request): boolean {
  const role = getUserRole(req);
  return role === "provider" || role === "admin" || role === "clinician";
}

router.post("/clinical-documentation/:patientId", async (req: Request, res: Response) => {
  try {
    if (!isProvider(req)) {
      return res.status(403).json({
        success: false,
        error: "Provider role required for clinical documentation generation",
      });
    }

    const { patientId } = req.params;
    const { patientData, documentType, encounterContext } = req.body;

    if (!patientData?.demographics) {
      return res.status(400).json({
        success: false,
        error: "Patient data with demographics required",
      });
    }

    const validTypes: ClinicalDocumentationSnippet["type"][] = ["progress_note", "soap_note", "assessment", "plan", "hpi"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid document type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient",
      resourceId: patientId,
      details: `AI clinical documentation generation: ${documentType} - NO-CDS compliant`,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    const result = await aiProviderAutomationService.generateClinicalDocumentation(
      patientData,
      documentType,
      encounterContext
    );

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: "clinical_documentation_generated",
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        documentType,
        hasEncounterContext: !!encounterContext,
        modelUsed: "gpt-4o",
      },
      summary: {
        title: result.data.title,
        contentPreview: result.data.content.substring(0, 200),
        confidenceScore: result.confidence,
        warningsGenerated: [],
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        requestDurationMs: result.processingTimeMs,
        cacheHit: false,
        fallbackUsed: result.confidence < 0.7,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader("X-AI-Disclaimer", "Informational Only - Not Medical Advice");
    res.json({
      success: true,
      data: result.data,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
      auditLogId: createdAuditLog.id,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[AIProviderAutomation] Clinical documentation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate clinical documentation",
      disclaimer: "INFORMATIONAL ONLY",
    });
  }
});

router.post("/referral-note/:patientId", async (req: Request, res: Response) => {
  try {
    if (!isProvider(req)) {
      return res.status(403).json({
        success: false,
        error: "Provider role required for referral note generation",
      });
    }

    const { patientId } = req.params;
    const { patientData, referralType, targetCondition, urgency } = req.body;

    if (!patientData?.demographics) {
      return res.status(400).json({
        success: false,
        error: "Patient data with demographics required",
      });
    }

    if (!targetCondition) {
      return res.status(400).json({
        success: false,
        error: "Target condition for referral is required",
      });
    }

    const validTypes: ReferralNote["referralType"][] = ["specialist", "imaging", "procedure", "therapy", "consultation"];
    if (!validTypes.includes(referralType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid referral type. Must be one of: ${validTypes.join(", ")}`,
      });
    }

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient",
      resourceId: patientId,
      details: `AI referral note generation: ${referralType} for ${targetCondition} - NO-CDS compliant`,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    const result = await aiProviderAutomationService.generateReferralNote(
      patientData,
      referralType,
      targetCondition,
      urgency || "routine"
    );

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: "referral_note_generated",
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        referralType,
        targetCondition,
        urgency: urgency || "routine",
        modelUsed: "gpt-4o",
      },
      summary: {
        title: `${referralType} Referral - ${targetCondition}`,
        contentPreview: result.data.reasonForReferral.substring(0, 200),
        confidenceScore: result.confidence,
        warningsGenerated: [],
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        requestDurationMs: result.processingTimeMs,
        cacheHit: false,
        fallbackUsed: result.confidence < 0.7,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader("X-AI-Disclaimer", "Informational Only - Not Medical Advice");
    res.json({
      success: true,
      data: result.data,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
      auditLogId: createdAuditLog.id,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[AIProviderAutomation] Referral note error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate referral note",
      disclaimer: "INFORMATIONAL ONLY",
    });
  }
});

router.post("/preventive-care-orders/:patientId", async (req: Request, res: Response) => {
  try {
    if (!isProvider(req)) {
      return res.status(403).json({
        success: false,
        error: "Provider role required for preventive care order suggestions",
      });
    }

    const { patientId } = req.params;
    const { patientData } = req.body;

    if (!patientData?.demographics) {
      return res.status(400).json({
        success: false,
        error: "Patient data with demographics required",
      });
    }

    const userId = getUserId(req);
    const userRole = getUserRole(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient",
      resourceId: patientId,
      details: "AI preventive care order suggestions - NO-CDS compliant",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });

    const result = await aiProviderAutomationService.generatePreventiveCareOrders(patientData);

    const auditEntry: InsertAiAuditLogEntry = {
      eventType: "preventive_care_orders_generated",
      userId,
      userRole,
      patientId,
      sessionId: (req as any).session?.id,
      parameters: {
        patientAge: patientData.demographics.age,
        patientGender: patientData.demographics.gender,
        modelUsed: "gpt-4o",
      },
      summary: {
        title: "Preventive Care Order Suggestions",
        contentPreview: `${result.data.length} preventive care recommendations generated`,
        confidenceScore: result.confidence,
        warningsGenerated: [],
        disclaimersIncluded: true,
      },
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        requestDurationMs: result.processingTimeMs,
        cacheHit: false,
        fallbackUsed: result.confidence < 0.7,
      },
    };
    const createdAuditLog = createAuditLogEntry(auditEntry, req);

    res.setHeader("X-AI-Disclaimer", "Informational Only - Not Medical Advice");
    res.json({
      success: true,
      data: result.data,
      confidence: result.confidence,
      processingTimeMs: result.processingTimeMs,
      auditLogId: createdAuditLog.id,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    console.error("[AIProviderAutomation] Preventive care orders error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate preventive care order suggestions",
      disclaimer: "INFORMATIONAL ONLY",
    });
  }
});

export default router;
