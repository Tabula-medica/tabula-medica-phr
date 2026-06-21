import { Router, Request, Response } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  aiProviderWorkflowService,
  FormType
} from "./services/ai-provider-workflow-service";

const router = Router();

const NO_CDS_DISCLAIMER = aiProviderWorkflowService.NO_CDS_DISCLAIMER;

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "AI Provider Workflow Automation",
    version: "1.0.0",
    description: "AI-powered workflow automation using FHIR data for provider efficiency",
    features: [
      "AI-generated workflow insights based on patient FHIR data",
      "Pre-populated forms with FHIR data extraction",
      "Critical FHIR change alerts with notification integration",
      "Task suggestions and care coordination",
      "Real-time dashboard statistics"
    ],
    supportedFormTypes: [
      "encounter_note",
      "referral",
      "lab_order",
      "medication_reconciliation",
      "care_plan",
      "discharge_summary",
      "follow_up",
      "patient_summary"
    ],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "WorkflowDashboard",
      details: "Access AI workflow dashboard statistics"
    });

    const stats = aiProviderWorkflowService.getWorkflowDashboardStats(userId);

    res.json({
      stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.get("/patients", (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientList",
      details: "List patients for AI workflow"
    });

    const patients = aiProviderWorkflowService.listPatients();

    res.json({
      patients,
      total: patients.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] List patients error:", error);
    res.status(500).json({ error: "Failed to list patients" });
  }
});

router.get("/patient/:patientId/context", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientContext",
      resourceId: patientId,
      patientId,
      details: "Get FHIR patient context for workflow"
    });

    const context = aiProviderWorkflowService.getPatientContext(patientId);
    if (!context) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      context,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Get patient context error:", error);
    res.status(500).json({ error: "Failed to get patient context" });
  }
});

const GetInsightsQuerySchema = z.object({
  generate: z.enum(["true", "false"]).optional()
});

router.get("/patient/:patientId/insights", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const queryValidation = GetInsightsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: queryValidation.error.errors });
    }

    const generateNew = queryValidation.data.generate === "true";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "AIWorkflowInsight",
      resourceId: patientId,
      patientId,
      details: `Get patient insights - generateNew: ${generateNew}`
    });

    let insights;
    if (generateNew) {
      insights = await aiProviderWorkflowService.generateAIInsightsForPatient(patientId, userId);
    } else {
      insights = aiProviderWorkflowService.getPatientInsights(patientId, userId);
    }

    res.json({
      patientId,
      insights,
      total: insights.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Get insights error:", error);
    res.status(500).json({ error: "Failed to get patient insights" });
  }
});

const AcknowledgeInsightSchema = z.object({
  insightId: z.string()
});

router.post("/patient/:patientId/insights/acknowledge", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const validation = AcknowledgeInsightSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { insightId } = validation.data;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "AIWorkflowInsight",
      resourceId: insightId,
      patientId,
      details: "Acknowledge workflow insight"
    });

    const success = aiProviderWorkflowService.acknowledgeInsight(insightId, patientId, userId);

    res.json({
      success,
      message: success ? "Insight acknowledged" : "Failed to acknowledge insight",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Acknowledge insight error:", error);
    res.status(500).json({ error: "Failed to acknowledge insight" });
  }
});

router.get("/patient/:patientId/alerts", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "CriticalFHIRAlert",
      resourceId: patientId,
      patientId,
      details: "Get critical FHIR alerts for patient"
    });

    const alerts = aiProviderWorkflowService.getCriticalAlerts(patientId, userId);

    res.json({
      patientId,
      alerts,
      total: alerts.length,
      activeCount: alerts.filter(a => a.status === "active").length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Get alerts error:", error);
    res.status(500).json({ error: "Failed to get patient alerts" });
  }
});

const AcknowledgeAlertSchema = z.object({
  alertId: z.string()
});

router.post("/patient/:patientId/alerts/acknowledge", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const validation = AcknowledgeAlertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { alertId } = validation.data;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "CriticalFHIRAlert",
      resourceId: alertId,
      patientId,
      details: "Acknowledge critical FHIR alert"
    });

    const success = aiProviderWorkflowService.acknowledgeAlert(alertId, patientId, userId);

    res.json({
      success,
      message: success ? "Alert acknowledged" : "Failed to acknowledge alert",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Acknowledge alert error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.post("/patient/:patientId/alerts/resolve", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const validation = AcknowledgeAlertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { alertId } = validation.data;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "CriticalFHIRAlert",
      resourceId: alertId,
      patientId,
      details: "Resolve critical FHIR alert"
    });

    const success = aiProviderWorkflowService.resolveAlert(alertId, patientId, userId);

    res.json({
      success,
      message: success ? "Alert resolved" : "Failed to resolve alert",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Resolve alert error:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

const TriggerAlertSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  alertType: z.string(),
  title: z.string(),
  description: z.string(),
  fhirResourceType: z.string(),
  fhirResourceId: z.string(),
  currentValue: z.union([z.string(), z.number()]),
  previousValue: z.union([z.string(), z.number()]).optional(),
  requiredAction: z.string(),
  aiAnalysis: z.string().optional()
});

router.post("/patient/:patientId/alerts/trigger", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const validation = TriggerAlertSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "CriticalFHIRAlert",
      resourceId: patientId,
      patientId,
      details: `Trigger critical alert: ${validation.data.alertType}`
    });

    const alert = await aiProviderWorkflowService.triggerCriticalAlert(
      patientId,
      validation.data,
      userId
    );

    res.json({
      success: true,
      alert,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Trigger alert error:", error);
    res.status(500).json({ error: "Failed to trigger alert" });
  }
});

router.get("/form-types", (_req: Request, res: Response) => {
  const formTypes = aiProviderWorkflowService.getAvailableFormTypes();
  res.json({
    formTypes,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

const PrePopulateFormSchema = z.object({
  formType: z.enum([
    "encounter_note",
    "referral",
    "lab_order",
    "medication_reconciliation",
    "care_plan",
    "discharge_summary",
    "follow_up",
    "patient_summary"
  ])
});

router.post("/patient/:patientId/form/prepopulate", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const validation = PrePopulateFormSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { formType } = validation.data;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PrePopulatedForm",
      resourceId: patientId,
      patientId,
      details: `Pre-populate ${formType} form with FHIR data`
    });

    const formData = aiProviderWorkflowService.prePopulateForm(formType as FormType, patientId, userId);

    if (!formData) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      formData,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderWorkflow] Pre-populate form error:", error);
    res.status(500).json({ error: "Failed to pre-populate form" });
  }
});

export default router;
