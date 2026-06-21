import { Router, Request, Response } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import { NO_CDS_DISCLAIMER_SHORT } from "./security/no-cds-guardrails";
import {
  generateDiagnosisSuggestions,
  checkDrugInteractions,
  generateDiagnosticTestRecommendations,
  generateRiskStratification,
  generatePreventiveAlerts,
  generateCDSOverview,
  type CDSDiagnosisRequest,
  type CDSDrugInteractionRequest,
  type CDSDiagnosticTestRequest,
  type CDSRiskStratificationRequest,
  type CDSPreventiveAlertsRequest,
} from "./clinical-decision-support-service";

const router = Router();

const DISCLAIMER_HEADER = "X-CDS-Informational-Only";

const symptomSchema = z.object({
  name: z.string().min(1),
  severity: z.number().min(0).max(10),
  duration: z.string().optional(),
  onset: z.string().optional(),
});

const vitalSchema = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.number().optional(),
  temperature: z.number().optional(),
  respiratoryRate: z.number().optional(),
  oxygenSaturation: z.number().optional(),
});

const labSchema = z.object({
  testName: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().min(1),
  referenceRange: z.string().optional(),
  status: z.enum(["normal", "abnormal", "critical"]).optional(),
});

const medicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  dosage: z.string().min(1),
});

const diagnosisRequestSchema = z.object({
  patientId: z.string().min(1),
  symptoms: z.array(symptomSchema).min(1),
  vitals: vitalSchema.optional(),
  labs: z.array(labSchema).optional(),
  conditions: z.array(z.object({ name: z.string(), status: z.string() })).optional(),
  medications: z.array(medicationSchema).optional(),
  demographics: z.object({ age: z.number().optional(), sex: z.string().optional() }).optional(),
});

const drugInteractionRequestSchema = z.object({
  patientId: z.string().min(1),
  medications: z.array(medicationSchema).min(2, "At least 2 medications required for interaction check"),
  allergies: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
});

const diagnosticTestRequestSchema = z.object({
  patientId: z.string().min(1),
  symptoms: z.array(symptomSchema).min(1),
  suspectedConditions: z.array(z.string()).optional(),
  existingLabs: z.array(labSchema).optional(),
  vitals: vitalSchema.optional(),
  demographics: z.object({ age: z.number().optional(), sex: z.string().optional() }).optional(),
});

const overviewRequestSchema = z.object({
  patientId: z.string().min(1),
  demographics: z.object({ age: z.number().optional(), sex: z.string().optional() }).optional(),
  conditions: z.array(z.string()).optional(),
  familyHistory: z.array(z.string()).optional(),
});

router.post("/overview", async (req: Request, res: Response) => {
  try {
    const parsed = overviewRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/overview",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] CDS Overview dashboard for patient ${parsed.data.patientId} | Info-only: true`,
    });

    const result = await generateCDSOverview(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Overview error:", error);
    res.status(500).json({
      error: "CDS overview temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

router.post("/diagnosis", async (req: Request, res: Response) => {
  try {
    const parsed = diagnosisRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/diagnosis",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] Diagnosis suggestion analysis for patient ${parsed.data.patientId} | Symptoms: ${parsed.data.symptoms.length} | Info-only: true`,
    });

    const result = await generateDiagnosisSuggestions(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Diagnosis suggestion error:", error);
    res.status(500).json({
      error: "Analysis temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

router.post("/drug-interactions", async (req: Request, res: Response) => {
  try {
    const parsed = drugInteractionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/drug-interactions",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] Drug interaction check for patient ${parsed.data.patientId} | Medications: ${parsed.data.medications.length} | Info-only: true`,
    });

    const result = await checkDrugInteractions(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Drug interaction check error:", error);
    res.status(500).json({
      error: "Interaction analysis temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

router.post("/diagnostic-tests", async (req: Request, res: Response) => {
  try {
    const parsed = diagnosticTestRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/diagnostic-tests",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] Diagnostic test analysis for patient ${parsed.data.patientId} | Symptoms: ${parsed.data.symptoms.length} | Info-only: true`,
    });

    const result = await generateDiagnosticTestRecommendations(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Diagnostic test analysis error:", error);
    res.status(500).json({
      error: "Test analysis temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

const riskStratificationRequestSchema = z.object({
  patientId: z.string().min(1),
  demographics: z.object({ age: z.number().optional(), sex: z.string().optional() }).optional(),
  vitals: vitalSchema.optional(),
  labs: z.array(labSchema).optional(),
  conditions: z.array(z.string()).optional(),
  medications: z.array(medicationSchema).optional(),
  familyHistory: z.array(z.string()).optional(),
  socialFactors: z.array(z.string()).optional(),
});

const preventiveAlertsRequestSchema = z.object({
  patientId: z.string().min(1),
  demographics: z.object({ age: z.number().optional(), sex: z.string().optional() }).optional(),
  immunizationHistory: z.array(z.object({
    vaccineName: z.string().min(1),
    dateGiven: z.string().min(1),
    doseNumber: z.number().optional(),
  })).optional(),
  screeningHistory: z.array(z.object({
    screeningName: z.string().min(1),
    datePerformed: z.string().min(1),
    result: z.string().optional(),
  })).optional(),
  conditions: z.array(z.string()).optional(),
});

router.post("/risk-stratification", async (req: Request, res: Response) => {
  try {
    const parsed = riskStratificationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/risk-stratification",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] Risk stratification analysis for patient ${parsed.data.patientId} | Info-only: true`,
    });

    const result = await generateRiskStratification(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Risk stratification error:", error);
    res.status(500).json({
      error: "Risk analysis temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

router.post("/preventive-alerts", async (req: Request, res: Response) => {
  try {
    const parsed = preventiveAlertsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request data",
        details: parsed.error.flatten(),
        disclaimer: NO_CDS_DISCLAIMER_SHORT,
      });
    }

    const userId = (req as any).user?.id || "anonymous";

    await logPhiAccess({
      userId,
      patientId: parsed.data.patientId,
      resourceType: "ClinicalDecisionSupport",
      action: "read",
      userRole: (req as any).user?.role || "provider",
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      requestPath: "/api/cds/preventive-alerts",
      requestMethod: "POST",
      details: `[CDS][PHI-Access] Preventive care alerts for patient ${parsed.data.patientId} | Info-only: true`,
    });

    const result = await generatePreventiveAlerts(parsed.data);

    res.setHeader(DISCLAIMER_HEADER, "true");
    res.json(result);
  } catch (error) {
    console.error("[CDS] Preventive alerts error:", error);
    res.status(500).json({
      error: "Preventive alerts temporarily unavailable",
      disclaimer: NO_CDS_DISCLAIMER_SHORT,
    });
  }
});

export default router;
