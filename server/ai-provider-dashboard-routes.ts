import { Router, Request, Response } from "express";
import { z } from "zod";
import { logPhiAccess } from "./security/hipaa-audit";
import { aiProviderDashboardService, TaskCategory, TaskPriority, DocumentType } from "./services/ai-provider-dashboard-service";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

const router = Router();

router.use(isAuthenticated);
router.use(requireRole("provider", "admin"));

const NO_CDS_DISCLAIMER = aiProviderDashboardService.NO_CDS_DISCLAIMER;

function getUserId(req: Request): string {
  return (req as any).user?.claims?.sub || (req as any).user?.id || "unknown";
}

function getProviderId(req: Request): string {
  return (req as any).user?.claims?.sub || (req as any).user?.id || "unknown";
}

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "AI Provider Dashboard Enhancement",
    version: "1.0.0",
    description: "Enhanced AI-powered provider dashboard with personalized tasks, real-time vitals monitoring, and clinical documentation summaries",
    features: [
      "AI-driven personalized task list based on patient data and alerts",
      "Real-time patient vitals monitoring with AI trend analysis",
      "AI-assisted clinical documentation summary generation",
      "Priority-based task management",
      "Vitals alert acknowledgment and tracking",
      "Document compression and quality metrics"
    ],
    taskCategories: [
      "patient_review",
      "documentation",
      "follow_up",
      "lab_review",
      "medication_review",
      "care_coordination",
      "preventive_care",
      "urgent_attention",
      "administrative"
    ],
    vitalTypes: [
      "heart_rate",
      "blood_pressure_systolic",
      "blood_pressure_diastolic",
      "respiratory_rate",
      "oxygen_saturation",
      "temperature",
      "weight",
      "blood_glucose"
    ],
    documentTypes: [
      "encounter_note",
      "discharge_summary",
      "progress_note",
      "consultation",
      "procedure_note",
      "operative_report",
      "history_physical",
      "referral_letter"
    ],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

router.get("/stats", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ProviderDashboardStats",
      details: `Provider ${providerId} accessing dashboard statistics`
    });

    const stats = aiProviderDashboardService.getDashboardStats(providerId);

    res.json({
      success: true,
      data: stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Stats error:", error);
    res.status(500).json({
      success: false,
      error: { code: "STATS_ERROR", message: "Failed to retrieve dashboard statistics" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const taskQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  patientId: z.string().optional(),
  limit: z.string().optional()
});

router.get("/tasks", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);

    const parseResult = taskQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const { status, priority, category, patientId, limit } = parseResult.data;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ProviderTasks",
      details: `Provider ${providerId} accessing task list`
    });

    const tasks = aiProviderDashboardService.getProviderTasks(providerId, {
      status: status ? status.split(",") as any[] : undefined,
      priority: priority ? priority.split(",") as TaskPriority[] : undefined,
      category: category ? category.split(",") as TaskCategory[] : undefined,
      patientId,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json({
      success: true,
      data: {
        tasks,
        total: tasks.length,
        providerId
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Tasks error:", error);
    res.status(500).json({
      success: false,
      error: { code: "TASKS_ERROR", message: "Failed to retrieve tasks" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const generateTasksSchema = z.object({
  patientData: z.array(z.object({
    patientId: z.string(),
    name: z.string(),
    conditions: z.array(z.string()),
    recentAlerts: z.array(z.string()),
    pendingItems: z.array(z.string())
  }))
});

router.post("/tasks/generate", async (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);

    const parseResult = generateTasksSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid request body" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ProviderTasks",
      details: `Provider ${providerId} generating AI task list`
    });

    const tasks = await aiProviderDashboardService.generateAITaskList(
      providerId,
      parseResult.data.patientData,
      userId
    );

    res.json({
      success: true,
      data: {
        generatedTasks: tasks,
        count: tasks.length
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Task generation error:", error);
    res.status(500).json({
      success: false,
      error: { code: "GENERATION_ERROR", message: "Failed to generate AI tasks" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const updateTaskSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "deferred"])
});

router.patch("/tasks/:taskId", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { taskId } = req.params;

    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid status" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const task = aiProviderDashboardService.updateTaskStatus(
      providerId,
      taskId,
      parseResult.data.status,
      userId
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Task not found" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    res.json({
      success: true,
      data: task,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Task update error:", error);
    res.status(500).json({
      success: false,
      error: { code: "UPDATE_ERROR", message: "Failed to update task" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/vitals/patients", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const isAdmin = (req as any).userRole === "admin";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "VitalsMonitoredPatients",
      details: `Provider ${providerId} listing assigned patients with vitals monitoring`
    });

    const patients = aiProviderDashboardService.listMonitoredPatients(isAdmin ? null : userId);

    res.json({
      success: true,
      data: {
        patients,
        total: patients.length
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] List monitored patients error:", error);
    res.status(500).json({
      success: false,
      error: { code: "LIST_ERROR", message: "Failed to list monitored patients" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/vitals/patient/:patientId", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;
    const isAdmin = (req as any).userRole === "admin";

    if (!isAdmin && !aiProviderDashboardService.isPatientAssignedToProvider(userId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const result = aiProviderDashboardService.getPatientVitalsMonitoring(patientId, userId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "No vitals data found for patient" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    res.json({
      success: true,
      data: result,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Vitals monitoring error:", error);
    res.status(500).json({
      success: false,
      error: { code: "VITALS_ERROR", message: "Failed to retrieve vitals monitoring data" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const acknowledgeAlertSchema = z.object({
  alertId: z.string()
});

router.post("/vitals/patient/:patientId/acknowledge", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;
    const isAdmin = (req as any).userRole === "admin";

    if (!isAdmin && !aiProviderDashboardService.isPatientAssignedToProvider(userId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const parseResult = acknowledgeAlertSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Alert ID required" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const alert = aiProviderDashboardService.acknowledgeVitalsAlert(
      patientId,
      parseResult.data.alertId,
      userId
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Alert not found" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    res.json({
      success: true,
      data: alert,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Acknowledge alert error:", error);
    res.status(500).json({
      success: false,
      error: { code: "ACKNOWLEDGE_ERROR", message: "Failed to acknowledge alert" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

router.get("/documentation/patient/:patientId", (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;
    const isAdmin = (req as any).userRole === "admin";

    if (!isAdmin && !aiProviderDashboardService.isPatientAssignedToProvider(userId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const summaries = aiProviderDashboardService.getDocumentSummaries(patientId, userId);

    res.json({
      success: true,
      data: {
        summaries,
        total: summaries.length
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Get summaries error:", error);
    res.status(500).json({
      success: false,
      error: { code: "SUMMARIES_ERROR", message: "Failed to retrieve document summaries" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const generateSummarySchema = z.object({
  documentContent: z.string().min(50, "Document must be at least 50 characters"),
  documentType: z.enum([
    "encounter_note",
    "discharge_summary",
    "progress_note",
    "consultation",
    "procedure_note",
    "operative_report",
    "history_physical",
    "referral_letter"
  ]),
  author: z.string().optional(),
  facility: z.string().optional(),
  documentDate: z.string()
});

router.post("/documentation/patient/:patientId/generate", async (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;

    if (!aiProviderDashboardService.isProviderAssignedToPatient(providerId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const parseResult = generateSummarySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { 
          code: "VALIDATION_ERROR", 
          message: parseResult.error.errors.map(e => e.message).join(", ")
        },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const { documentContent, documentType, author, facility, documentDate } = parseResult.data;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ClinicalDocSummary",
      patientId,
      details: `Generating AI summary for ${documentType}`
    });

    const summary = await aiProviderDashboardService.generateDocumentSummary(
      patientId,
      documentContent,
      documentType as DocumentType,
      { author, facility, documentDate },
      userId
    );

    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Generate summary error:", error);
    res.status(500).json({
      success: false,
      error: { code: "GENERATION_ERROR", message: "Failed to generate document summary" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const patientSummarySchema = z.object({
  conditions: z.array(z.object({
    name: z.string(),
    status: z.string(),
    onsetDate: z.string().optional()
  })).default([]),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string()
  })).default([]),
  allergies: z.array(z.object({
    substance: z.string(),
    reaction: z.string(),
    severity: z.string()
  })).default([]),
  labs: z.array(z.object({
    name: z.string(),
    value: z.string(),
    unit: z.string(),
    date: z.string(),
    status: z.string()
  })).default([]),
  vitals: z.array(z.object({
    type: z.string(),
    value: z.string(),
    unit: z.string(),
    date: z.string(),
    status: z.string()
  })).default([]),
  demographics: z.object({
    age: z.string().optional(),
    gender: z.string().optional()
  }).optional()
});

router.post("/patient-summary/:patientId", async (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;

    if (!aiProviderDashboardService.isProviderAssignedToPatient(providerId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const parseResult = patientSummarySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parseResult.error.errors.map(e => e.message).join(", ") },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientRecordSummary",
      patientId,
      details: `Generating patient record summary`
    });

    const summary = await aiProviderDashboardService.generatePatientRecordSummary(
      patientId,
      parseResult.data,
      userId
    );

    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Patient summary error:", error);
    res.status(500).json({
      success: false,
      error: { code: "SUMMARY_ERROR", message: "Failed to generate patient record summary" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const referralLetterSchema = z.object({
  targetSpecialty: z.string().min(1, "Target specialty is required"),
  referringDiagnosis: z.string().min(1, "Referring diagnosis is required"),
  urgency: z.enum(["routine", "urgent", "emergent"]),
  referringProviderName: z.string().min(1, "Referring provider name is required"),
  additionalNotes: z.string().optional(),
  patientConditions: z.array(z.string()).default([]),
  patientMedications: z.array(z.string()).default([]),
  patientAllergies: z.array(z.string()).default([]),
  relevantLabs: z.array(z.string()).optional()
});

router.post("/referral-letter/:patientId", async (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;

    if (!aiProviderDashboardService.isProviderAssignedToPatient(providerId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const parseResult = referralLetterSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parseResult.error.errors.map(e => e.message).join(", ") },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReferralLetter",
      patientId,
      details: `Generating referral letter to ${parseResult.data.targetSpecialty}`
    });

    const letter = await aiProviderDashboardService.generateReferralLetter(
      patientId,
      parseResult.data,
      userId
    );

    res.json({
      success: true,
      data: letter,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Referral letter error:", error);
    res.status(500).json({
      success: false,
      error: { code: "REFERRAL_ERROR", message: "Failed to generate referral letter" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

const differentialDxSchema = z.object({
  symptoms: z.array(z.string()).min(1, "At least one symptom is required"),
  duration: z.string().optional(),
  severity: z.string().optional(),
  patientAge: z.string().optional(),
  patientGender: z.string().optional(),
  existingConditions: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional()
});

router.post("/differential-dx/:patientId", async (req: Request, res: Response) => {
  try {
    const providerId = getProviderId(req);
    const userId = getUserId(req);
    const { patientId } = req.params;

    if (!aiProviderDashboardService.isProviderAssignedToPatient(providerId, patientId)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied: patient not in your care panel" },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    const parseResult = differentialDxSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: parseResult.error.errors.map(e => e.message).join(", ") },
        noCdsDisclaimer: NO_CDS_DISCLAIMER
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DifferentialDxSuggestion",
      patientId,
      details: `Generating differential Dx for symptoms: ${parseResult.data.symptoms.join(", ")}`
    });

    const result = await aiProviderDashboardService.generateDifferentialDx(
      patientId,
      parseResult.data,
      userId
    );

    res.json({
      success: true,
      data: result,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIProviderDashboard] Differential Dx error:", error);
    res.status(500).json({
      success: false,
      error: { code: "DIFFERENTIAL_DX_ERROR", message: "Failed to generate differential diagnosis suggestions" },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  }
});

export default router;
