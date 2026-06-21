import { Router, Request, Response } from "express";
import { z } from "zod";
import { format, subDays, addDays, parseISO } from "date-fns";
import { logPhiAccess } from "./security/hipaa-audit";
import { storage } from "./storage";

const router = Router();

const SAMPLE_PATIENT_ID = "patient-001";

function getPatientId(req: Request): string {
  const user = (req as any).user;
  return user?.claims?.sub || user?.id || SAMPLE_PATIENT_ID;
}

interface TimelineEvent {
  id: string;
  type: "condition" | "medication" | "procedure" | "lab_result" | "immunization" | "encounter" | "alert" | "vital_sign";
  title: string;
  description: string;
  date: string;
  provider?: string;
  facility?: string;
  status?: string;
  severity?: string;
  details?: Record<string, any>;
}

interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  endDate?: string;
  status: "active" | "discontinued" | "on_hold";
  refillsRemaining: number;
  daysUntilRefill: number;
  isHighRisk: boolean;
  highRiskCategory?: string;
  instructions?: string;
}

interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  clinicalEffect: string;
  recommendation: string;
}

interface PatientOutcome {
  id: string;
  patientId: string;
  date: string;
  symptomName: string;
  severity: number;
  notes?: string;
  triggers?: string[];
}

interface OutcomeTrend {
  symptom: string;
  data: { date: string; severity: number }[];
  averageSeverity: number;
  trend: "improving" | "stable" | "worsening";
  frequencyPerWeek: number;
}

const outcomesStorage: PatientOutcome[] = [
  {
    id: "outcome-001",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 1).toISOString(),
    symptomName: "Headache",
    severity: 6,
    notes: "Started in the afternoon, lasted about 3 hours",
    triggers: ["Stress", "Sleep"],
  },
  {
    id: "outcome-002",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 3).toISOString(),
    symptomName: "Fatigue",
    severity: 7,
    notes: "Felt tired all day despite sleeping 8 hours",
    triggers: ["Medication"],
  },
  {
    id: "outcome-003",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 5).toISOString(),
    symptomName: "Headache",
    severity: 4,
    triggers: ["Stress"],
  },
  {
    id: "outcome-004",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 7).toISOString(),
    symptomName: "Joint pain",
    severity: 5,
    notes: "Left knee aching, worse after walking",
    triggers: ["Exercise"],
  },
  {
    id: "outcome-005",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 10).toISOString(),
    symptomName: "Headache",
    severity: 7,
    triggers: ["Weather", "Stress"],
  },
  {
    id: "outcome-006",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 14).toISOString(),
    symptomName: "Fatigue",
    severity: 5,
    notes: "Morning fatigue improved by afternoon",
  },
  {
    id: "outcome-007",
    patientId: SAMPLE_PATIENT_ID,
    date: subDays(new Date(), 18).toISOString(),
    symptomName: "Nausea",
    severity: 4,
    triggers: ["Food", "Medication"],
  },
];

function generateTimelineEvents(patientId: string, daysBack: number): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "tl-001",
      type: "condition",
      title: "Type 2 Diabetes Mellitus",
      description: "Diagnosis confirmed based on HbA1c levels and fasting glucose tests",
      date: subDays(new Date(), 180).toISOString(),
      provider: "Dr. Sarah Johnson",
      facility: "City Medical Center",
      status: "active",
    },
    {
      id: "tl-002",
      type: "condition",
      title: "Essential Hypertension",
      description: "Blood pressure consistently elevated above 140/90 mmHg",
      date: subDays(new Date(), 365).toISOString(),
      provider: "Dr. Michael Chen",
      facility: "Downtown Cardiology",
      status: "active",
    },
    {
      id: "tl-003",
      type: "medication",
      title: "Metformin 500mg Started",
      description: "Initiated for blood glucose management",
      date: subDays(new Date(), 175).toISOString(),
      provider: "Dr. Sarah Johnson",
      facility: "City Medical Center",
    },
    {
      id: "tl-004",
      type: "medication",
      title: "Lisinopril 10mg Started",
      description: "ACE inhibitor for blood pressure control",
      date: subDays(new Date(), 360).toISOString(),
      provider: "Dr. Michael Chen",
      facility: "Downtown Cardiology",
    },
    {
      id: "tl-005",
      type: "lab_result",
      title: "HbA1c: 7.2%",
      description: "Slightly above target range of 7.0%. Continue current treatment.",
      date: subDays(new Date(), 30).toISOString(),
      provider: "City Lab Services",
      facility: "City Medical Center",
      status: "borderline",
    },
    {
      id: "tl-006",
      type: "lab_result",
      title: "Comprehensive Metabolic Panel",
      description: "All values within normal range. Kidney function stable.",
      date: subDays(new Date(), 30).toISOString(),
      provider: "City Lab Services",
      facility: "City Medical Center",
      status: "normal",
    },
    {
      id: "tl-007",
      type: "lab_result",
      title: "Lipid Panel",
      description: "Total cholesterol 195, LDL 120, HDL 52, Triglycerides 140",
      date: subDays(new Date(), 60).toISOString(),
      provider: "City Lab Services",
      facility: "City Medical Center",
      status: "normal",
    },
    {
      id: "tl-008",
      type: "encounter",
      title: "Annual Physical Exam",
      description: "Routine annual wellness visit with comprehensive review",
      date: subDays(new Date(), 45).toISOString(),
      provider: "Dr. Sarah Johnson",
      facility: "City Medical Center",
    },
    {
      id: "tl-009",
      type: "procedure",
      title: "Electrocardiogram (ECG)",
      description: "12-lead ECG performed during annual physical. Normal sinus rhythm.",
      date: subDays(new Date(), 45).toISOString(),
      provider: "Dr. Sarah Johnson",
      facility: "City Medical Center",
      status: "normal",
    },
    {
      id: "tl-010",
      type: "immunization",
      title: "Influenza Vaccine",
      description: "Annual flu shot administered",
      date: subDays(new Date(), 90).toISOString(),
      provider: "Nurse Practitioner",
      facility: "City Medical Center",
    },
    {
      id: "tl-011",
      type: "immunization",
      title: "COVID-19 Booster",
      description: "Bivalent COVID-19 booster vaccination",
      date: subDays(new Date(), 120).toISOString(),
      provider: "Pharmacy Staff",
      facility: "CVS Pharmacy",
    },
    {
      id: "tl-012",
      type: "vital_sign",
      title: "Blood Pressure: 138/88 mmHg",
      description: "Slightly elevated, within acceptable range for hypertension management",
      date: subDays(new Date(), 7).toISOString(),
      facility: "Home Monitoring",
      status: "borderline",
    },
    {
      id: "tl-013",
      type: "vital_sign",
      title: "Blood Glucose: 145 mg/dL",
      description: "Fasting glucose measurement",
      date: subDays(new Date(), 3).toISOString(),
      facility: "Home Monitoring",
      status: "borderline",
    },
    {
      id: "tl-014",
      type: "alert",
      title: "Medication Refill Reminder",
      description: "Metformin prescription will need refill within 7 days",
      date: subDays(new Date(), 2).toISOString(),
      severity: "medium",
    },
    {
      id: "tl-015",
      type: "encounter",
      title: "Cardiology Follow-up",
      description: "Routine follow-up for hypertension management",
      date: subDays(new Date(), 90).toISOString(),
      provider: "Dr. Michael Chen",
      facility: "Downtown Cardiology",
    },
  ];

  const cutoffDate = subDays(new Date(), daysBack);
  return events
    .filter(e => parseISO(e.date) >= cutoffDate)
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
}

function generateMedications(patientId: string): Medication[] {
  return [
    {
      id: "med-001",
      name: "Metformin",
      genericName: "Metformin Hydrochloride",
      dosage: "500mg",
      frequency: "Twice daily with meals",
      prescriber: "Dr. Sarah Johnson",
      startDate: subDays(new Date(), 175).toISOString(),
      status: "active",
      refillsRemaining: 2,
      daysUntilRefill: 5,
      isHighRisk: false,
      instructions: "Take with food to reduce stomach upset",
    },
    {
      id: "med-002",
      name: "Lisinopril",
      genericName: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily in the morning",
      prescriber: "Dr. Michael Chen",
      startDate: subDays(new Date(), 360).toISOString(),
      status: "active",
      refillsRemaining: 5,
      daysUntilRefill: 22,
      isHighRisk: false,
      instructions: "Take at the same time each day. Monitor for dry cough.",
    },
    {
      id: "med-003",
      name: "Atorvastatin",
      genericName: "Atorvastatin Calcium",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      prescriber: "Dr. Sarah Johnson",
      startDate: subDays(new Date(), 150).toISOString(),
      status: "active",
      refillsRemaining: 3,
      daysUntilRefill: 18,
      isHighRisk: false,
      instructions: "Best taken in the evening. Report any muscle pain.",
    },
    {
      id: "med-004",
      name: "Aspirin",
      genericName: "Acetylsalicylic Acid",
      dosage: "81mg",
      frequency: "Once daily",
      prescriber: "Dr. Michael Chen",
      startDate: subDays(new Date(), 300).toISOString(),
      status: "active",
      refillsRemaining: 6,
      daysUntilRefill: 45,
      isHighRisk: false,
      instructions: "Low-dose aspirin for cardiovascular protection",
    },
    {
      id: "med-005",
      name: "Warfarin",
      genericName: "Warfarin Sodium",
      dosage: "5mg",
      frequency: "Once daily at the same time",
      prescriber: "Dr. Michael Chen",
      startDate: subDays(new Date(), 200).toISOString(),
      status: "active",
      refillsRemaining: 1,
      daysUntilRefill: 3,
      isHighRisk: true,
      highRiskCategory: "Blood Thinner",
      instructions: "Maintain consistent vitamin K intake. Regular INR monitoring required.",
    },
  ];
}

function generateDrugInteractions(medications: Medication[]): DrugInteraction[] {
  const interactions: DrugInteraction[] = [];
  
  const hasWarfarin = medications.some(m => m.name.toLowerCase().includes("warfarin"));
  const hasAspirin = medications.some(m => m.name.toLowerCase().includes("aspirin"));
  const hasMetformin = medications.some(m => m.name.toLowerCase().includes("metformin"));
  const hasLisinopril = medications.some(m => m.name.toLowerCase().includes("lisinopril"));

  if (hasWarfarin && hasAspirin) {
    interactions.push({
      id: "int-001",
      drug1: "Warfarin",
      drug2: "Aspirin",
      severity: "major",
      description: "Increased risk of bleeding when used together",
      clinicalEffect: "Both medications affect blood clotting through different mechanisms",
      recommendation: "Your healthcare provider is monitoring this combination. Report any unusual bleeding.",
    });
  }

  if (hasMetformin && hasLisinopril) {
    interactions.push({
      id: "int-002",
      drug1: "Metformin",
      drug2: "Lisinopril",
      severity: "minor",
      description: "ACE inhibitors may slightly enhance the glucose-lowering effect of metformin",
      clinicalEffect: "This interaction is generally beneficial for blood sugar control",
      recommendation: "Continue monitoring blood glucose as directed. No action typically required.",
    });
  }

  return interactions;
}

function calculateOutcomeTrends(outcomes: PatientOutcome[]): OutcomeTrend[] {
  const symptomGroups = new Map<string, PatientOutcome[]>();
  
  outcomes.forEach(o => {
    const existing = symptomGroups.get(o.symptomName) || [];
    symptomGroups.set(o.symptomName, [...existing, o]);
  });

  const trends: OutcomeTrend[] = [];
  
  symptomGroups.forEach((logs, symptom) => {
    const sortedLogs = logs.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    const data = sortedLogs.map(l => ({ date: l.date, severity: l.severity }));
    const avgSeverity = logs.reduce((sum, l) => sum + l.severity, 0) / logs.length;
    
    let trend: "improving" | "stable" | "worsening" = "stable";
    if (sortedLogs.length >= 2) {
      const firstHalf = sortedLogs.slice(0, Math.ceil(sortedLogs.length / 2));
      const secondHalf = sortedLogs.slice(Math.ceil(sortedLogs.length / 2));
      const firstAvg = firstHalf.reduce((s, l) => s + l.severity, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, l) => s + l.severity, 0) / secondHalf.length;
      
      if (secondAvg < firstAvg - 1) trend = "improving";
      else if (secondAvg > firstAvg + 1) trend = "worsening";
    }

    const daysSpan = Math.max(1, (new Date().getTime() - parseISO(sortedLogs[0].date).getTime()) / (1000 * 60 * 60 * 24));
    const frequencyPerWeek = (logs.length / daysSpan) * 7;

    trends.push({
      symptom,
      data,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      trend,
      frequencyPerWeek: Math.round(frequencyPerWeek * 10) / 10,
    });
  });

  return trends.sort((a, b) => b.data.length - a.data.length);
}

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const daysBack = parseInt(req.query.dateRange as string) || 90;
    const userId = (req as any).user?.id || "anonymous";

    const events = generateTimelineEvents(patientId, daysBack === 0 ? 3650 : daysBack);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "MedicalTimeline",
      resourceId: patientId,
      details: `Viewed medical timeline (${events.length} events, ${daysBack} days)`,
    });

    res.json(events);
  } catch (error) {
    console.error("[AdvancedRecords] Timeline error:", error);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

router.get("/medications", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const userId = (req as any).user?.id || "anonymous";

    const medications = generateMedications(patientId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Medications",
      resourceId: patientId,
      details: `Viewed medication list (${medications.length} medications)`,
    });

    res.json(medications);
  } catch (error) {
    console.error("[AdvancedRecords] Medications error:", error);
    res.status(500).json({ error: "Failed to fetch medications" });
  }
});

router.get("/drug-interactions", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const userId = (req as any).user?.id || "anonymous";

    const medications = generateMedications(patientId);
    const interactions = generateDrugInteractions(medications);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DrugInteractions",
      resourceId: patientId,
      details: `Viewed drug interactions (${interactions.length} interactions)`,
    });

    res.json(interactions);
  } catch (error) {
    console.error("[AdvancedRecords] Drug interactions error:", error);
    res.status(500).json({ error: "Failed to fetch drug interactions" });
  }
});

router.get("/outcomes", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const daysBack = parseInt(req.query.dateRange as string) || 90;
    const userId = (req as any).user?.id || "anonymous";

    const cutoffDate = subDays(new Date(), daysBack === 0 ? 3650 : daysBack);
    const patientOutcomes = outcomesStorage
      .filter(o => o.patientId === patientId && parseISO(o.date) >= cutoffDate)
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientOutcomes",
      resourceId: patientId,
      details: `Viewed patient-reported outcomes (${patientOutcomes.length} entries)`,
    });

    res.json(patientOutcomes);
  } catch (error) {
    console.error("[AdvancedRecords] Outcomes error:", error);
    res.status(500).json({ error: "Failed to fetch outcomes" });
  }
});

router.get("/outcome-trends", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const userId = (req as any).user?.id || "anonymous";

    const patientOutcomes = outcomesStorage.filter(o => o.patientId === patientId);
    const trends = calculateOutcomeTrends(patientOutcomes);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "OutcomeTrends",
      resourceId: patientId,
      details: `Viewed outcome trends (${trends.length} symptom trends)`,
    });

    res.json(trends);
  } catch (error) {
    console.error("[AdvancedRecords] Outcome trends error:", error);
    res.status(500).json({ error: "Failed to fetch outcome trends" });
  }
});

const logOutcomeSchema = z.object({
  symptomName: z.string().min(1, "Symptom name is required"),
  severity: z.number().min(1).max(10),
  notes: z.string().optional(),
  triggers: z.array(z.string()).optional(),
});

router.post("/outcomes", async (req: Request, res: Response) => {
  try {
    const patientId = getPatientId(req);
    const userId = (req as any).user?.id || "anonymous";

    const parsed = logOutcomeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const newOutcome: PatientOutcome = {
      id: `outcome-${Date.now()}`,
      patientId,
      date: new Date().toISOString(),
      symptomName: parsed.data.symptomName,
      severity: parsed.data.severity,
      notes: parsed.data.notes,
      triggers: parsed.data.triggers,
    };

    outcomesStorage.push(newOutcome);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PatientOutcome",
      resourceId: newOutcome.id,
      details: `Patient logged symptom: ${newOutcome.symptomName} (severity: ${newOutcome.severity}/10)`,
    });

    res.status(201).json(newOutcome);
  } catch (error) {
    console.error("[AdvancedRecords] Log outcome error:", error);
    res.status(500).json({ error: "Failed to log outcome" });
  }
});

export default router;
