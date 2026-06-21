import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  aiPatientIntelligenceService,
  PatientDataInput,
  ConditionCategory,
} from "./services/ai-patient-intelligence-service";

const router = Router();

const ALLOWED_ROLES = ["administrator", "clinician", "care_coordinator", "nurse"];

function checkRole(req: Request, res: Response, next: Function) {
  const userRole = (req as any).session?.user?.role;
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return res.status(403).json({
      error: "Access denied",
      message: "Insufficient permissions to access AI Patient Intelligence features",
      requiredRoles: ALLOWED_ROLES,
    });
  }
  next();
}

const PatientDataSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  demographics: z.object({
    age: z.number(),
    gender: z.string(),
    ethnicity: z.string().optional(),
  }),
  conditions: z.array(z.object({
    name: z.string(),
    code: z.string().optional(),
    onsetDate: z.string().optional(),
    status: z.string(),
    severity: z.string().optional(),
  })),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    startDate: z.string().optional(),
    rxNormCode: z.string().optional(),
    status: z.string(),
  })),
  allergies: z.array(z.object({
    substance: z.string(),
    reaction: z.string().optional(),
    severity: z.string().optional(),
  })),
  vitals: z.array(z.object({
    type: z.string(),
    value: z.number(),
    unit: z.string(),
    date: z.string(),
  })),
  labResults: z.array(z.object({
    name: z.string(),
    code: z.string().optional(),
    value: z.number(),
    unit: z.string(),
    referenceRange: z.string().optional(),
    date: z.string(),
    abnormal: z.boolean().optional(),
  })),
  familyHistory: z.array(z.object({
    condition: z.string(),
    relationship: z.string(),
  })).optional(),
  socialHistory: z.object({
    smokingStatus: z.string().optional(),
    alcoholUse: z.string().optional(),
    exerciseFrequency: z.string().optional(),
    diet: z.string().optional(),
  }).optional(),
  encounters: z.array(z.object({
    type: z.string(),
    date: z.string(),
    reason: z.string().optional(),
    provider: z.string().optional(),
  })).optional(),
});

const RiskCategoriesSchema = z.array(z.enum([
  "diabetes_complications",
  "cancer_recurrence",
  "cardiovascular",
  "renal",
  "respiratory",
  "mental_health",
  "falls",
  "readmission",
]));

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    version: "1.0.0",
    name: "AI Patient Intelligence Service",
    description: "AI-powered patient risk prediction, drug interaction detection, and personalized care recommendations",
    features: [
      "Patient risk prediction for 8 condition categories",
      "Proactive drug interaction detection",
      "Therapeutic duplication identification",
      "Allergy conflict checking",
      "Renal and hepatic dosing considerations",
      "Personalized care recommendations",
      "Health screening schedules",
      "Wellness goal generation",
      "Patient-friendly summaries",
    ],
    supportedRiskCategories: [
      "diabetes_complications",
      "cancer_recurrence",
      "cardiovascular",
      "renal",
      "respiratory",
      "mental_health",
      "falls",
      "readmission",
    ],
    noCdsDisclaimer: "IMPORTANT: This service provides informational analysis only. It does NOT constitute medical advice or clinical decision support.",
  });
});

router.get("/dashboard", checkRole, (req: Request, res: Response) => {
  try {
    const dashboard = aiPatientIntelligenceService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[AIPatientIntelligence] Dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard data" });
  }
});

router.post("/risk-profile", checkRole, async (req: Request, res: Response) => {
  try {
    const { patientData, categories } = req.body;

    const validatedPatientData = PatientDataSchema.parse(patientData);
    const validatedCategories = RiskCategoriesSchema.parse(categories || [
      "diabetes_complications",
      "cardiovascular",
      "renal",
      "falls",
      "readmission",
    ]);

    const userId = (req as any).session?.user?.id || "system";

    const riskProfile = await aiPatientIntelligenceService.generateRiskProfile(
      validatedPatientData as PatientDataInput,
      validatedCategories as ConditionCategory[],
      userId
    );

    res.json(riskProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("[AIPatientIntelligence] Risk profile error:", error);
    res.status(500).json({ error: "Failed to generate risk profile" });
  }
});

router.post("/medication-safety", checkRole, async (req: Request, res: Response) => {
  try {
    const { patientData } = req.body;

    const validatedPatientData = PatientDataSchema.parse(patientData);
    const userId = (req as any).session?.user?.id || "system";

    const safetyAnalysis = await aiPatientIntelligenceService.analyzeMedicationSafety(
      validatedPatientData as PatientDataInput,
      userId
    );

    res.json(safetyAnalysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("[AIPatientIntelligence] Medication safety error:", error);
    res.status(500).json({ error: "Failed to analyze medication safety" });
  }
});

router.post("/care-plan", checkRole, async (req: Request, res: Response) => {
  try {
    const { patientData } = req.body;

    const validatedPatientData = PatientDataSchema.parse(patientData);
    const userId = (req as any).session?.user?.id || "system";

    const carePlan = await aiPatientIntelligenceService.generatePersonalizedCarePlan(
      validatedPatientData as PatientDataInput,
      userId
    );

    res.json(carePlan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("[AIPatientIntelligence] Care plan error:", error);
    res.status(500).json({ error: "Failed to generate care plan" });
  }
});

router.post("/comprehensive", checkRole, async (req: Request, res: Response) => {
  try {
    const { patientData } = req.body;

    const validatedPatientData = PatientDataSchema.parse(patientData);
    const userId = (req as any).session?.user?.id || "system";

    const comprehensive = await aiPatientIntelligenceService.getComprehensivePatientIntelligence(
      validatedPatientData as PatientDataInput,
      userId
    );

    res.json(comprehensive);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("[AIPatientIntelligence] Comprehensive analysis error:", error);
    res.status(500).json({ error: "Failed to generate comprehensive analysis" });
  }
});

export function registerAIPatientIntelligenceRoutes(app: any) {
  app.use("/api/ai-patient-intelligence", router);
  console.log("[AIPatientIntelligence] Routes registered at /api/ai-patient-intelligence/*");
}
