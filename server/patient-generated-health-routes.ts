import { Router, Request, Response } from "express";
import { z } from "zod";
import { 
  patientGeneratedHealthDataService,
  type VitalType,
  type SymptomSeverity,
  type AdherenceStatus
} from "./services/patient-generated-health-data-service";

const router = Router();

const vitalTypeSchema = z.enum(["blood_pressure", "glucose", "weight", "temperature", "pulse_ox", "heart_rate", "respiratory_rate"]);
const symptomSeveritySchema = z.enum(["mild", "moderate", "severe"]);
const adherenceStatusSchema = z.enum(["completed", "missed", "partial", "skipped"]);
const moodSchema = z.enum(["great", "good", "okay", "poor", "bad"]);

const recordVitalSchema = z.object({
  type: vitalTypeSchema,
  value: z.number(),
  secondaryValue: z.number().optional(),
  unit: z.string(),
  source: z.enum(["manual", "wearable", "device"]).default("manual"),
  deviceId: z.string().optional(),
  notes: z.string().optional(),
  context: z.object({
    mealStatus: z.enum(["fasting", "before_meal", "after_meal", "bedtime"]).optional(),
    activityLevel: z.enum(["resting", "light", "moderate", "intense"]).optional(),
    position: z.enum(["sitting", "standing", "lying"]).optional(),
    armUsed: z.enum(["left", "right"]).optional(),
  }).optional(),
});

const recordSymptomSchema = z.object({
  symptom: z.string().min(1),
  severity: symptomSeveritySchema,
  duration: z.string().optional(),
  location: z.string().optional(),
  triggers: z.array(z.string()).optional(),
  relievedBy: z.array(z.string()).optional(),
  notes: z.string().optional(),
  relatedConditions: z.array(z.string()).optional(),
  interferedWithActivities: z.boolean().optional(),
});

const recordAdherenceSchema = z.object({
  taskId: z.string().min(1),
  status: adherenceStatusSchema,
  scheduledTime: z.string(),
  completedTime: z.string().optional(),
  notes: z.string().optional(),
  barriers: z.array(z.string()).optional(),
  moodRating: z.number().min(1).max(5).optional(),
});

const recordDailyLogSchema = z.object({
  date: z.string(),
  overallFeeling: z.number().min(1).max(5),
  energyLevel: z.number().min(1).max(5),
  sleepQuality: z.number().min(1).max(5),
  stressLevel: z.number().min(1).max(5),
  painLevel: z.number().min(0).max(10),
  mood: moodSchema,
  notes: z.string().optional(),
  activities: z.array(z.string()).optional(),
  dietNotes: z.string().optional(),
});

const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

router.get("/reference-ranges", (req: Request, res: Response) => {
  try {
    const ranges = patientGeneratedHealthDataService.getVitalReferenceRanges();
    res.json({
      success: true,
      data: ranges,
      noCdsDisclaimer: "These reference ranges are for general educational purposes only. Individual target ranges may vary. Consult your healthcare provider for personalized guidance.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting reference ranges:", error);
    res.status(500).json({ success: false, error: "Failed to get reference ranges" });
  }
});

router.post("/vitals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const parsed = recordVitalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: parsed.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }

    const vital = await patientGeneratedHealthDataService.recordVital(patientId, parsed.data);

    res.json({
      success: true,
      data: vital,
      message: vital.flags?.isAbnormal
        ? "Reading recorded. This value is outside the typical range - consider consulting your healthcare provider."
        : "Vital reading recorded successfully.",
      noCdsDisclaimer: "EDUCATIONAL ONLY. This is not medical advice. Consult your healthcare provider for concerns.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error recording vital:", error);
    res.status(500).json({ success: false, error: "Failed to record vital" });
  }
});

router.get("/vitals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const type = req.query.type as VitalType | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const vitals = patientGeneratedHealthDataService.getVitals(patientId, type, startDate, endDate);

    res.json({
      success: true,
      data: vitals,
      count: vitals.length,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Vital readings are for tracking purposes and do not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting vitals:", error);
    res.status(500).json({ success: false, error: "Failed to get vitals" });
  }
});

router.post("/symptoms", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const parsed = recordSymptomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: parsed.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }

    const symptom = await patientGeneratedHealthDataService.recordSymptom(patientId, parsed.data);

    res.json({
      success: true,
      data: symptom,
      message: parsed.data.severity === "severe"
        ? "Symptom recorded. For severe symptoms, consider contacting your healthcare provider."
        : "Symptom recorded successfully.",
      noCdsDisclaimer: "EDUCATIONAL ONLY. Symptom tracking is for informational purposes. Seek medical attention for concerning symptoms.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error recording symptom:", error);
    res.status(500).json({ success: false, error: "Failed to record symptom" });
  }
});

router.get("/symptoms", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const symptoms = patientGeneratedHealthDataService.getSymptoms(patientId, startDate, endDate);

    res.json({
      success: true,
      data: symptoms,
      count: symptoms.length,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Symptom history is for informational purposes and does not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting symptoms:", error);
    res.status(500).json({ success: false, error: "Failed to get symptoms" });
  }
});

router.get("/care-plan/tasks", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";
    const carePlanId = req.query.carePlanId as string | undefined;

    const tasks = patientGeneratedHealthDataService.getCarePlanTasks(patientId, carePlanId);

    res.json({
      success: true,
      data: tasks,
      count: tasks.length,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Care plan tasks are for tracking purposes and do not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting care plan tasks:", error);
    res.status(500).json({ success: false, error: "Failed to get care plan tasks" });
  }
});

router.post("/adherence", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const parsed = recordAdherenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: parsed.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }

    const record = await patientGeneratedHealthDataService.recordAdherence(patientId, parsed.data);

    let message = "Adherence recorded.";
    if (parsed.data.status === "completed") {
      message = "Great job completing this task!";
    } else if (parsed.data.status === "missed" || parsed.data.status === "skipped") {
      message = "Recorded. Try to get back on track when you can.";
    }

    res.json({
      success: true,
      data: record,
      message,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Adherence tracking helps you stay on course but is not medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error recording adherence:", error);
    res.status(500).json({ success: false, error: "Failed to record adherence" });
  }
});

router.get("/adherence", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const taskId = req.query.taskId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const records = patientGeneratedHealthDataService.getAdherenceRecords(patientId, taskId, startDate, endDate);

    res.json({
      success: true,
      data: records,
      count: records.length,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Adherence records are for tracking purposes and do not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting adherence records:", error);
    res.status(500).json({ success: false, error: "Failed to get adherence records" });
  }
});

router.get("/adherence/score", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const days = parseInt(req.query.days as string) || 7;
    const score = patientGeneratedHealthDataService.calculateAdherenceScore(patientId, days);

    let feedback = "";
    if (score.score >= 90) {
      feedback = "Outstanding adherence! You're doing an excellent job following your care plan.";
    } else if (score.score >= 75) {
      feedback = "Good adherence! Keep up the consistent effort.";
    } else if (score.score >= 50) {
      feedback = "Moderate adherence. Consider setting reminders to help stay on track.";
    } else {
      feedback = "There's room for improvement. Small steps can make a big difference.";
    }

    res.json({
      success: true,
      data: {
        ...score,
        feedback,
        periodDays: days,
      },
      noCdsDisclaimer: "EDUCATIONAL ONLY. Adherence tracking helps you stay on course but is not medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error calculating adherence score:", error);
    res.status(500).json({ success: false, error: "Failed to calculate adherence score" });
  }
});

router.post("/daily-log", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const parsed = recordDailyLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: parsed.error.errors.map(e => ({ path: e.path.join("."), message: e.message })),
      });
    }

    const log = await patientGeneratedHealthDataService.recordDailyLog(patientId, parsed.data);

    res.json({
      success: true,
      data: log,
      message: "Daily health log recorded. Tracking daily wellness helps identify patterns over time.",
      noCdsDisclaimer: "EDUCATIONAL ONLY. Daily wellness logs are for tracking purposes and do not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error recording daily log:", error);
    res.status(500).json({ success: false, error: "Failed to record daily log" });
  }
});

router.get("/daily-log", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const logs = patientGeneratedHealthDataService.getDailyLogs(patientId, startDate, endDate);

    res.json({
      success: true,
      data: logs,
      count: logs.length,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Daily logs are for personal tracking and do not constitute medical advice.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting daily logs:", error);
    res.status(500).json({ success: false, error: "Failed to get daily logs" });
  }
});

router.get("/analysis", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const analysis = await patientGeneratedHealthDataService.analyzePatientData(patientId);

    res.json({
      success: true,
      data: analysis,
      noCdsDisclaimer: "EDUCATIONAL ONLY. AI-powered health pattern analysis is for informational purposes only and does not constitute medical advice. Always consult healthcare providers for medical guidance.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error analyzing patient data:", error);
    res.status(500).json({ success: false, error: "Failed to analyze patient data" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const patientId = user?.claims?.sub || "patient-001";

    const summary = await patientGeneratedHealthDataService.getHealthDataSummary(patientId);

    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: "EDUCATIONAL ONLY. Health data summaries are for personal tracking and do not constitute medical advice. Consult your healthcare provider for medical guidance.",
    });
  } catch (error) {
    console.error("[PGHD Routes] Error getting health data summary:", error);
    res.status(500).json({ success: false, error: "Failed to get health data summary" });
  }
});

export default router;
