import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getComprehensivePatient360,
  listAllPatients,
  getPatient360DashboardStats,
  updateViewPreferences,
  getQuickLinksForPatient,
  ViewPreference
} from "./services/patient-360-comprehensive-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const NO_CDS_DISCLAIMER = `DISCLAIMER: This consolidated patient view is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.`;

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    name: "Patient 360 Comprehensive View",
    version: "2.0.0",
    description: "Consolidated patient dashboard integrating demographics, conditions, medications, FHIR data, AI insights, telehealth, and appointments",
    features: [
      "Unified patient demographics view",
      "Conditions and medications summary",
      "FHIR resource integration",
      "AI-powered risk assessments",
      "Medication safety analysis",
      "Telehealth session history",
      "Upcoming and past appointments",
      "Care plan summary",
      "Quick module navigation",
      "Customizable view sections",
      "Data quality metrics"
    ],
    supportedSections: [
      "demographics",
      "conditions",
      "medications",
      "allergies",
      "vitals",
      "labs",
      "telehealth",
      "appointments",
      "riskAssessments",
      "carePlan",
      "quickLinks"
    ],
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  });
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360Dashboard",
      details: "Access patient 360 dashboard"
    });

    const stats = getPatient360DashboardStats();
    
    res.json({
      ...stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard statistics" });
  }
});

router.get("/patients", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientList",
      details: "List patients for Patient 360"
    });

    const patients = listAllPatients();
    
    res.json({
      patients,
      total: patients.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] List patients error:", error);
    res.status(500).json({ error: "Failed to list patients" });
  }
});

const GetPatient360Schema = z.object({
  includeSections: z.array(z.string()).optional(),
  generateAISummary: z.boolean().optional()
});

const GetPatient360QuerySchema = z.object({
  sections: z.string().optional(),
  generateAISummary: z.enum(["true", "false"]).optional()
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    const queryValidation = GetPatient360QuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ error: "Invalid query parameters", details: queryValidation.error.errors });
    }

    const generateAISummary = queryValidation.data.generateAISummary === "true";
    const includeSections = queryValidation.data.sections 
      ? queryValidation.data.sections.split(",")
      : undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360View",
      resourceId: patientId,
      patientId,
      details: `View patient 360 - generateAISummary: ${generateAISummary}`
    });

    const view = await getComprehensivePatient360(patientId, userId, {
      includeSections,
      generateAISummary
    });

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      view,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get patient error:", error);
    res.status(500).json({ error: "Failed to get patient 360 view" });
  }
});

router.post("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360View",
      resourceId: patientId,
      patientId,
      details: "POST request for patient 360 view"
    });
    
    const validation = GetPatient360Schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { includeSections, generateAISummary } = validation.data;

    const view = await getComprehensivePatient360(patientId, userId, {
      includeSections,
      generateAISummary
    });

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      view,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get patient error:", error);
    res.status(500).json({ error: "Failed to get patient 360 view" });
  }
});

router.get("/patient/:patientId/summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360Summary",
      resourceId: patientId,
      patientId,
      details: "Generate AI summary for patient"
    });

    const view = await getComprehensivePatient360(patientId, userId, {
      generateAISummary: true
    });

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      patientId,
      summary: view.aiSummary,
      demographics: view.demographics,
      conditionsCount: view.conditions.filter(c => c.status === "active").length,
      medicationsCount: view.medications.filter(m => m.status === "active").length,
      upcomingAppointments: view.upcomingAppointments.length,
      dataQuality: view.dataQualitySummary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get summary error:", error);
    res.status(500).json({ error: "Failed to get patient summary" });
  }
});

router.get("/patient/:patientId/quick-links", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360QuickLinks",
      resourceId: patientId,
      details: "Get quick links for patient"
    });

    const quickLinks = getQuickLinksForPatient(patientId);

    res.json({
      patientId,
      quickLinks,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get quick links error:", error);
    res.status(500).json({ error: "Failed to get quick links" });
  }
});

const ViewPreferenceSchema = z.object({
  preferences: z.array(z.object({
    sectionId: z.string(),
    visible: z.boolean(),
    order: z.number(),
    collapsed: z.boolean()
  }))
});

router.put("/patient/:patientId/preferences", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "update",
      resourceType: "Patient360Preferences",
      resourceId: patientId,
      patientId,
      details: "Update view preferences for patient"
    });

    const validation = ViewPreferenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid preferences", details: validation.error.errors });
    }

    const success = updateViewPreferences(patientId, userId, validation.data.preferences as ViewPreference[]);

    res.json({
      success,
      message: success ? "Preferences updated successfully" : "Failed to update preferences"
    });
  } catch (error) {
    console.error("[Patient360] Update preferences error:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

router.get("/patient/:patientId/appointments", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";
    const type = req.query.type as string | undefined;

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360Appointments",
      resourceId: patientId,
      details: `Get appointments - type: ${type || "all"}`
    });

    const view = await getComprehensivePatient360(patientId, userId);

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    let appointments;
    if (type === "upcoming") {
      appointments = view.upcomingAppointments;
    } else if (type === "past") {
      appointments = view.pastAppointments;
    } else {
      appointments = [...view.upcomingAppointments, ...view.pastAppointments];
    }

    res.json({
      patientId,
      appointments,
      total: appointments.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get appointments error:", error);
    res.status(500).json({ error: "Failed to get appointments" });
  }
});

router.get("/patient/:patientId/telehealth", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360Telehealth",
      resourceId: patientId,
      details: "Get telehealth sessions"
    });

    const view = await getComprehensivePatient360(patientId, userId);

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      patientId,
      sessions: view.telehealthHistory,
      total: view.telehealthHistory.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get telehealth error:", error);
    res.status(500).json({ error: "Failed to get telehealth sessions" });
  }
});

router.get("/patient/:patientId/risks", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req as any).userId || "anonymous";

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Patient360RiskAssessments",
      resourceId: patientId,
      details: "Get risk assessments"
    });

    const view = await getComprehensivePatient360(patientId, userId);

    if (!view) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({
      patientId,
      riskAssessments: view.riskAssessments,
      medicationSafety: view.medicationSafety,
      total: view.riskAssessments.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[Patient360] Get risks error:", error);
    res.status(500).json({ error: "Failed to get risk assessments" });
  }
});

export default router;
