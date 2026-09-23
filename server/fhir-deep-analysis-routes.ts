import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiFHIRDeepAnalysisEngine } from "./services/ai-fhir-deep-analysis";

import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  const userId = getUserId(req);
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "FHIRDeepAnalysisAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitizeDetails(details),
  })}`);
}

const analyzeResourceSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  resourceData: z.record(z.unknown()),
});

const inconsistencyFiltersSchema = z.object({
  resourceType: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  type: z.enum([
    "missing_required_field", "invalid_reference", "orphaned_resource",
    "duplicate_identifier", "conflicting_data", "temporal_inconsistency",
    "coding_mismatch", "cardinality_violation", "narrative_data_mismatch", "invalid_value_set"
  ]).optional(),
  resolved: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const safetyRiskFiltersSchema = z.object({
  patientId: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  riskType: z.enum([
    "missing_allergy_info", "incomplete_medication_list", "outdated_immunization",
    "missing_emergency_contact", "incomplete_problem_list", "missing_vital_signs",
    "stale_care_plan", "conflicting_medications", "missing_patient_identifier"
  ]).optional(),
  acknowledged: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const trendReportSchema = z.object({
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date format"),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid date format"),
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId, resourceData } = analyzeResourceSchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("ANALYZE_FHIR_RESOURCE", "fhir_resource", req, { resourceType, resourceId });

    const result = await aiFHIRDeepAnalysisEngine.analyzeResource(
      resourceType,
      resourceId,
      resourceData,
      userId
    );

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[FHIRDeepAnalysisAPI] Analyze error:", error);
    res.status(500).json({ error: "Failed to analyze resource" });
  }
});

router.get("/analysis/:analysisId", async (req: Request, res: Response) => {
  try {
    const result = aiFHIRDeepAnalysisEngine.getAnalysisResult(req.params.analysisId);
    if (!result) {
      return res.status(404).json({ error: "Analysis result not found" });
    }

    logHipaaAudit("VIEW_ANALYSIS_RESULT", "analysis", req, { analysisId: req.params.analysisId });
    res.json(result);
  } catch (error) {
    console.error("[FHIRDeepAnalysisAPI] Get analysis error:", error);
    res.status(500).json({ error: "Failed to retrieve analysis result" });
  }
});

router.get("/inconsistencies", async (req: Request, res: Response) => {
  try {
    const filters = inconsistencyFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_INCONSISTENCIES", "inconsistencies", req, { filters });

    const inconsistencies = await aiFHIRDeepAnalysisEngine.listInconsistencies(filters);
    res.json(inconsistencies);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[FHIRDeepAnalysisAPI] List inconsistencies error:", error);
    res.status(500).json({ error: "Failed to list inconsistencies" });
  }
});

router.post("/inconsistencies/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { notes } = z.object({ notes: z.string().min(1).max(2000) }).parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("RESOLVE_INCONSISTENCY", "inconsistency", req, {
      inconsistencyId: req.params.id,
      notes: notes.substring(0, 100),
    });

    const result = await aiFHIRDeepAnalysisEngine.resolveInconsistency(req.params.id, userId, notes);
    if (!result) {
      return res.status(404).json({ error: "Inconsistency not found" });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[FHIRDeepAnalysisAPI] Resolve inconsistency error:", error);
    res.status(500).json({ error: "Failed to resolve inconsistency" });
  }
});

router.get("/safety-risks", async (req: Request, res: Response) => {
  try {
    const filters = safetyRiskFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_SAFETY_RISKS", "safety_risks", req, { filters });

    const risks = await aiFHIRDeepAnalysisEngine.listSafetyRisks(filters);
    res.json(risks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[FHIRDeepAnalysisAPI] List safety risks error:", error);
    res.status(500).json({ error: "Failed to list safety risks" });
  }
});

router.post("/safety-risks/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("ACKNOWLEDGE_SAFETY_RISK", "safety_risk", req, { riskId: req.params.id });

    const result = await aiFHIRDeepAnalysisEngine.acknowledgeRisk(req.params.id, userId);
    if (!result) {
      return res.status(404).json({ error: "Safety risk not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[FHIRDeepAnalysisAPI] Acknowledge risk error:", error);
    res.status(500).json({ error: "Failed to acknowledge safety risk" });
  }
});

router.post("/strategies/:id/apply", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("APPLY_CORRECTION_STRATEGY", "strategy", req, { strategyId: req.params.id });

    const result = await aiFHIRDeepAnalysisEngine.applyStrategy(req.params.id, userId);
    if (!result) {
      return res.status(404).json({ error: "Correction strategy not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[FHIRDeepAnalysisAPI] Apply strategy error:", error);
    res.status(500).json({ error: "Failed to apply correction strategy" });
  }
});

router.post("/trend-report", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = trendReportSchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("GENERATE_TREND_REPORT", "trend_report", req, { startDate, endDate });

    const report = await aiFHIRDeepAnalysisEngine.generateTrendReport(startDate, endDate, userId);
    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[FHIRDeepAnalysisAPI] Generate trend report error:", error);
    res.status(500).json({ error: "Failed to generate trend report" });
  }
});

router.get("/trend-reports", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_TREND_REPORTS", "trend_reports", req, {});
    const reports = aiFHIRDeepAnalysisEngine.listTrendReports();
    res.json(reports);
  } catch (error) {
    console.error("[FHIRDeepAnalysisAPI] List trend reports error:", error);
    res.status(500).json({ error: "Failed to list trend reports" });
  }
});

router.get("/trend-reports/:id", async (req: Request, res: Response) => {
  try {
    const report = aiFHIRDeepAnalysisEngine.getTrendReport(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Trend report not found" });
    }

    logHipaaAudit("VIEW_TREND_REPORT", "trend_report", req, { reportId: req.params.id });
    res.json(report);
  } catch (error) {
    console.error("[FHIRDeepAnalysisAPI] Get trend report error:", error);
    res.status(500).json({ error: "Failed to retrieve trend report" });
  }
});

export default router;
