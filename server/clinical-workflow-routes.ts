import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  aiClinicalWorkflowAutomation,
  PatternType,
  RiskLevel,
  InterventionType,
  InterventionStatus,
} from "./services/ai-clinical-workflow-automation";

const router = Router();

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT][ClinicalWorkflow] ${action}:`, JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    ...details,
  }));
}

const patternTypeSchema = z.enum([
  "care_gap", "workflow_bottleneck", "coordination_issue", 
  "documentation_gap", "follow_up_needed", "transition_risk"
]);

const riskLevelSchema = z.enum(["critical", "high", "medium", "low"]);

const interventionTypeSchema = z.enum([
  "scheduling", "outreach", "education", "coordination", 
  "notification", "documentation", "transition"
]);

const interventionStatusSchema = z.enum([
  "pending", "in_progress", "completed", "declined", "expired"
]);

const patternStatusSchema = z.enum(["active", "addressed", "monitoring", "dismissed"]);

const idParamSchema = z.object({
  id: z.string().min(1).max(100),
});

const patternQuerySchema = z.object({
  patientId: z.string().min(1).max(100).optional(),
  type: patternTypeSchema.optional(),
  status: patternStatusSchema.optional(),
}).optional();

const riskQuerySchema = z.object({
  patientId: z.string().min(1).max(100).optional(),
  riskLevel: riskLevelSchema.optional(),
}).optional();

const interventionQuerySchema = z.object({
  patientId: z.string().min(1).max(100).optional(),
  type: interventionTypeSchema.optional(),
  status: interventionStatusSchema.optional(),
  priority: riskLevelSchema.optional(),
}).optional();

const alertsQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional(),
}).optional();

const analyzeJourneySchema = z.object({
  patientId: z.string().min(1).max(100),
  encounters: z.array(z.object({
    date: z.string(),
    type: z.string(),
    status: z.string(),
    facility: z.string().optional(),
  })).optional(),
  appointments: z.array(z.object({
    date: z.string(),
    status: z.string(),
    type: z.string(),
  })).optional(),
  carePlans: z.array(z.object({
    status: z.string(),
    period: z.object({
      start: z.string(),
      end: z.string().optional(),
    }).optional(),
  })).optional(),
  documentReferences: z.array(z.object({
    date: z.string(),
    type: z.string(),
    status: z.string(),
  })).optional(),
});

const assessRiskSchema = z.object({
  patientId: z.string().min(1).max(100),
  recentDischarge: z.boolean().optional(),
  missedFollowUps: z.number().min(0).max(100).optional(),
  careTransitions: z.number().min(0).max(50).optional(),
  documentationCompleteness: z.number().min(0).max(100).optional(),
  socialDeterminants: z.array(z.string().max(100)).optional(),
});

const generateInterventionsSchema = z.object({
  patientId: z.string().min(1).max(100),
  patternIds: z.array(z.string().min(1).max(100)).optional(),
  riskAssessmentId: z.string().min(1).max(100).optional(),
});

const updateInterventionSchema = z.object({
  status: interventionStatusSchema,
  actionUpdates: z.array(z.object({
    index: z.number().min(0),
    status: interventionStatusSchema,
  })).optional(),
});

const updatePatternStatusSchema = z.object({
  status: patternStatusSchema,
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_WORKFLOW_DASHBOARD", {});
    const dashboard = aiClinicalWorkflowAutomation.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[ClinicalWorkflow] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

router.get("/patterns", async (req: Request, res: Response) => {
  try {
    const queryResult = patternQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }

    const filters = queryResult.data || {};
    logHipaaAudit("LIST_PATTERNS", { filters });
    
    const patterns = aiClinicalWorkflowAutomation.getPatterns(filters as {
      patientId?: string;
      type?: PatternType;
      status?: string;
    });
    res.json({ success: true, data: patterns, count: patterns.length });
  } catch (error) {
    console.error("[ClinicalWorkflow] List patterns error:", error);
    res.status(500).json({ success: false, error: "Failed to list patterns" });
  }
});

router.get("/patterns/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pattern ID" });
    }

    logHipaaAudit("VIEW_PATTERN", { patternId: paramResult.data.id });
    const pattern = aiClinicalWorkflowAutomation.getPatternById(paramResult.data.id);
    
    if (!pattern) {
      return res.status(404).json({ success: false, error: "Pattern not found" });
    }

    res.json({ success: true, data: pattern });
  } catch (error) {
    console.error("[ClinicalWorkflow] Get pattern error:", error);
    res.status(500).json({ success: false, error: "Failed to get pattern" });
  }
});

router.patch("/patterns/:id/status", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid pattern ID" });
    }

    const bodyResult = updatePatternStatusSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    logHipaaAudit("UPDATE_PATTERN_STATUS", { 
      patternId: paramResult.data.id, 
      newStatus: bodyResult.data.status 
    });

    const updated = aiClinicalWorkflowAutomation.updatePatternStatus(
      paramResult.data.id, 
      bodyResult.data.status
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Pattern not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[ClinicalWorkflow] Update pattern status error:", error);
    res.status(500).json({ success: false, error: "Failed to update pattern status" });
  }
});

router.get("/risk-assessments", async (req: Request, res: Response) => {
  try {
    const queryResult = riskQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }

    const filters = queryResult.data || {};
    logHipaaAudit("LIST_RISK_ASSESSMENTS", { filters });
    
    const assessments = aiClinicalWorkflowAutomation.getRiskAssessments(filters as {
      patientId?: string;
      riskLevel?: RiskLevel;
    });
    res.json({ success: true, data: assessments, count: assessments.length });
  } catch (error) {
    console.error("[ClinicalWorkflow] List risk assessments error:", error);
    res.status(500).json({ success: false, error: "Failed to list risk assessments" });
  }
});

router.get("/risk-assessments/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid assessment ID" });
    }

    logHipaaAudit("VIEW_RISK_ASSESSMENT", { assessmentId: paramResult.data.id });
    const assessment = aiClinicalWorkflowAutomation.getRiskAssessmentById(paramResult.data.id);
    
    if (!assessment) {
      return res.status(404).json({ success: false, error: "Risk assessment not found" });
    }

    res.json({ success: true, data: assessment });
  } catch (error) {
    console.error("[ClinicalWorkflow] Get risk assessment error:", error);
    res.status(500).json({ success: false, error: "Failed to get risk assessment" });
  }
});

router.get("/interventions", async (req: Request, res: Response) => {
  try {
    const queryResult = interventionQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }

    const filters = queryResult.data || {};
    logHipaaAudit("LIST_INTERVENTIONS", { filters });
    
    const interventions = aiClinicalWorkflowAutomation.getInterventions(filters as {
      patientId?: string;
      type?: InterventionType;
      status?: InterventionStatus;
      priority?: RiskLevel;
    });
    res.json({ success: true, data: interventions, count: interventions.length });
  } catch (error) {
    console.error("[ClinicalWorkflow] List interventions error:", error);
    res.status(500).json({ success: false, error: "Failed to list interventions" });
  }
});

router.get("/interventions/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid intervention ID" });
    }

    logHipaaAudit("VIEW_INTERVENTION", { interventionId: paramResult.data.id });
    const intervention = aiClinicalWorkflowAutomation.getInterventionById(paramResult.data.id);
    
    if (!intervention) {
      return res.status(404).json({ success: false, error: "Intervention not found" });
    }

    res.json({ success: true, data: intervention });
  } catch (error) {
    console.error("[ClinicalWorkflow] Get intervention error:", error);
    res.status(500).json({ success: false, error: "Failed to get intervention" });
  }
});

router.patch("/interventions/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid intervention ID" });
    }

    const bodyResult = updateInterventionSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ success: false, error: "Invalid update data" });
    }

    logHipaaAudit("UPDATE_INTERVENTION", { 
      interventionId: paramResult.data.id,
      updates: bodyResult.data,
    });

    const updated = aiClinicalWorkflowAutomation.updateInterventionStatus(
      paramResult.data.id,
      bodyResult.data.status,
      bodyResult.data.actionUpdates
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: "Intervention not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[ClinicalWorkflow] Update intervention error:", error);
    res.status(500).json({ success: false, error: "Failed to update intervention" });
  }
});

router.post("/analyze-journey", async (req: Request, res: Response) => {
  try {
    const bodyResult = analyzeJourneySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request data",
        details: bodyResult.error.errors,
      });
    }

    const { patientId, ...fhirData } = bodyResult.data;
    logHipaaAudit("ANALYZE_PATIENT_JOURNEY", { patientId });

    const analysis = await aiClinicalWorkflowAutomation.analyzePatientJourney(patientId, fhirData);
    
    res.json({ 
      success: true, 
      data: analysis,
      noCdsCompliant: true,
      disclaimer: "Analysis focuses on operational workflow optimization only. No clinical recommendations provided.",
    });
  } catch (error) {
    console.error("[ClinicalWorkflow] Analyze journey error:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze journey";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/assess-risk", async (req: Request, res: Response) => {
  try {
    const bodyResult = assessRiskSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request data",
        details: bodyResult.error.errors,
      });
    }

    const { patientId, ...contextData } = bodyResult.data;
    logHipaaAudit("ASSESS_READMISSION_RISK", { patientId });

    const assessment = await aiClinicalWorkflowAutomation.assessReadmissionRisk(patientId, contextData);
    
    res.json({ 
      success: true, 
      data: assessment,
      noCdsCompliant: true,
      disclaimer: "Risk assessment focuses on administrative and operational factors only. No clinical recommendations provided.",
    });
  } catch (error) {
    console.error("[ClinicalWorkflow] Assess risk error:", error);
    const message = error instanceof Error ? error.message : "Failed to assess risk";
    res.status(500).json({ success: false, error: message });
  }
});

router.post("/generate-interventions", async (req: Request, res: Response) => {
  try {
    const bodyResult = generateInterventionsSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid request data",
        details: bodyResult.error.errors,
      });
    }

    const { patientId, patternIds, riskAssessmentId } = bodyResult.data;
    logHipaaAudit("GENERATE_INTERVENTIONS", { patientId, patternIds, riskAssessmentId });

    let patterns = aiClinicalWorkflowAutomation.getPatterns({ patientId });
    if (patternIds && patternIds.length > 0) {
      patterns = patterns.filter(p => patternIds.includes(p.id));
    }

    let riskAssessment;
    if (riskAssessmentId) {
      riskAssessment = aiClinicalWorkflowAutomation.getRiskAssessmentById(riskAssessmentId);
    }

    const interventions = await aiClinicalWorkflowAutomation.generateProactiveInterventions(
      patientId,
      patterns,
      riskAssessment
    );
    
    res.json({ 
      success: true, 
      data: interventions,
      count: interventions.length,
      noCdsCompliant: true,
      disclaimer: "All interventions are administrative and operational only. No clinical recommendations provided.",
    });
  } catch (error) {
    console.error("[ClinicalWorkflow] Generate interventions error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate interventions";
    res.status(500).json({ success: false, error: message });
  }
});

router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const queryResult = alertsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }
    const limit = queryResult.data?.limit || 20;

    logHipaaAudit("LIST_ALERTS", { limit });
    const alerts = aiClinicalWorkflowAutomation.getAlerts(limit);
    res.json({ success: true, data: alerts });
  } catch (error) {
    console.error("[ClinicalWorkflow] List alerts error:", error);
    res.status(500).json({ success: false, error: "Failed to list alerts" });
  }
});

router.delete("/alerts/:id", async (req: Request, res: Response) => {
  try {
    const paramResult = idParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return res.status(400).json({ success: false, error: "Invalid alert ID" });
    }

    logHipaaAudit("DISMISS_ALERT", { alertId: paramResult.data.id });
    const dismissed = aiClinicalWorkflowAutomation.dismissAlert(paramResult.data.id);

    if (!dismissed) {
      return res.status(404).json({ success: false, error: "Alert not found" });
    }

    res.json({ success: true, message: "Alert dismissed" });
  } catch (error) {
    console.error("[ClinicalWorkflow] Dismiss alert error:", error);
    res.status(500).json({ success: false, error: "Failed to dismiss alert" });
  }
});

export default router;
