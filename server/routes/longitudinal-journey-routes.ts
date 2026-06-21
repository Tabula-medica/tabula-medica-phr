import { Router, Request, Response } from "express";

const router = Router();

interface TimelineEvent {
  id: string;
  domain: "medications" | "procedures" | "vitals" | "conditions" | "immunizations";
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  type: "point" | "range";
  landmark?: "surgery" | "chronic_diagnosis" | "vaccination" | "hospitalization";
  severity?: "normal" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}

interface LabResult {
  id: string;
  name: string;
  code: string;
  value: number;
  unit: string;
  date: string;
  normalRange?: { min: number; max: number };
  historicalData: { date: string; value: number }[];
}

interface LongitudinalData {
  patientId: string;
  patientName: string;
  timelineEvents: TimelineEvent[];
  labResults: LabResult[];
  summary: {
    totalMedications: number;
    activeMedications: number;
    totalProcedures: number;
    totalVaccinations: number;
    chronicConditions: number;
    lastVisitDate: string;
  };
  landmarks: {
    surgeries: number;
    chronicDiagnoses: number;
    vaccinations: number;
    hospitalizations: number;
  };
  generatedAt: string;
}

const generateSampleData = (patientId: string): LongitudinalData => ({
  patientId,
  patientName: "John Smith",
  timelineEvents: [
    {
      id: "med-1",
      domain: "medications",
      name: "Lisinopril 10mg",
      description: "Daily for blood pressure management",
      startDate: "2023-03-15",
      endDate: "2024-12-31",
      type: "range",
    },
    {
      id: "med-2",
      domain: "medications",
      name: "Metformin 500mg",
      description: "Twice daily for diabetes management",
      startDate: "2023-06-01",
      type: "range",
    },
    {
      id: "med-3",
      domain: "medications",
      name: "Atorvastatin 20mg",
      description: "Daily for cholesterol",
      startDate: "2024-01-15",
      type: "range",
    },
    {
      id: "proc-1",
      domain: "procedures",
      name: "Knee Replacement Surgery",
      description: "Left knee total arthroplasty",
      startDate: "2023-08-20",
      type: "point",
      landmark: "surgery",
    },
    {
      id: "proc-2",
      domain: "procedures",
      name: "Annual Physical",
      description: "Routine wellness exam",
      startDate: "2024-02-15",
      type: "point",
    },
    {
      id: "proc-3",
      domain: "procedures",
      name: "Colonoscopy",
      description: "Screening procedure",
      startDate: "2024-06-10",
      type: "point",
    },
    {
      id: "vital-1",
      domain: "vitals",
      name: "Blood Pressure Check",
      description: "Elevated 145/92",
      startDate: "2023-03-01",
      type: "point",
      severity: "warning",
    },
    {
      id: "vital-2",
      domain: "vitals",
      name: "Blood Pressure Normal",
      description: "Controlled 128/82",
      startDate: "2024-06-15",
      type: "point",
    },
    {
      id: "cond-1",
      domain: "conditions",
      name: "Type 2 Diabetes",
      description: "Newly diagnosed",
      startDate: "2023-05-20",
      type: "point",
      landmark: "chronic_diagnosis",
    },
    {
      id: "cond-2",
      domain: "conditions",
      name: "Hypertension",
      description: "Essential hypertension",
      startDate: "2023-03-01",
      type: "range",
      landmark: "chronic_diagnosis",
    },
    {
      id: "imm-1",
      domain: "immunizations",
      name: "Flu Vaccine 2023",
      description: "Annual influenza vaccination",
      startDate: "2023-10-15",
      type: "point",
      landmark: "vaccination",
    },
    {
      id: "imm-2",
      domain: "immunizations",
      name: "COVID-19 Booster",
      description: "Updated 2024 vaccine",
      startDate: "2024-09-20",
      type: "point",
      landmark: "vaccination",
    },
    {
      id: "imm-3",
      domain: "immunizations",
      name: "Tdap Booster",
      description: "Tetanus-diphtheria-pertussis",
      startDate: "2024-02-28",
      type: "point",
      landmark: "vaccination",
    },
  ],
  labResults: [
    {
      id: "lab-1",
      name: "HbA1c",
      code: "4548-4",
      value: 6.8,
      unit: "%",
      date: "2024-10-15",
      normalRange: { min: 4.0, max: 5.6 },
      historicalData: [
        { date: "2023-06-01", value: 7.8 },
        { date: "2023-09-15", value: 7.4 },
        { date: "2023-12-20", value: 7.1 },
        { date: "2024-04-10", value: 6.9 },
        { date: "2024-07-22", value: 6.7 },
        { date: "2024-10-15", value: 6.8 },
      ],
    },
    {
      id: "lab-2",
      name: "Fasting Glucose",
      code: "1558-6",
      value: 118,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 70, max: 100 },
      historicalData: [
        { date: "2023-06-01", value: 142 },
        { date: "2023-09-15", value: 135 },
        { date: "2023-12-20", value: 128 },
        { date: "2024-04-10", value: 122 },
        { date: "2024-07-22", value: 115 },
        { date: "2024-10-15", value: 118 },
      ],
    },
    {
      id: "lab-3",
      name: "Total Cholesterol",
      code: "2093-3",
      value: 185,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 0, max: 200 },
      historicalData: [
        { date: "2024-01-15", value: 228 },
        { date: "2024-04-10", value: 210 },
        { date: "2024-07-22", value: 195 },
        { date: "2024-10-15", value: 185 },
      ],
    },
    {
      id: "lab-4",
      name: "LDL Cholesterol",
      code: "2089-1",
      value: 98,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 0, max: 100 },
      historicalData: [
        { date: "2024-01-15", value: 145 },
        { date: "2024-04-10", value: 125 },
        { date: "2024-07-22", value: 108 },
        { date: "2024-10-15", value: 98 },
      ],
    },
    {
      id: "lab-5",
      name: "Blood Pressure (Systolic)",
      code: "8480-6",
      value: 128,
      unit: "mmHg",
      date: "2024-10-15",
      normalRange: { min: 90, max: 120 },
      historicalData: [
        { date: "2023-03-01", value: 152 },
        { date: "2023-06-15", value: 145 },
        { date: "2023-09-20", value: 138 },
        { date: "2024-01-10", value: 132 },
        { date: "2024-04-25", value: 130 },
        { date: "2024-07-18", value: 125 },
        { date: "2024-10-15", value: 128 },
      ],
    },
    {
      id: "lab-6",
      name: "eGFR",
      code: "33914-3",
      value: 85,
      unit: "mL/min",
      date: "2024-10-15",
      normalRange: { min: 90, max: 120 },
      historicalData: [
        { date: "2023-06-01", value: 88 },
        { date: "2023-12-20", value: 86 },
        { date: "2024-07-22", value: 84 },
        { date: "2024-10-15", value: 85 },
      ],
    },
  ],
  summary: {
    totalMedications: 5,
    activeMedications: 3,
    totalProcedures: 8,
    totalVaccinations: 6,
    chronicConditions: 2,
    lastVisitDate: "2024-10-15",
  },
  landmarks: {
    surgeries: 1,
    chronicDiagnoses: 2,
    vaccinations: 3,
    hospitalizations: 1,
  },
  generatedAt: new Date().toISOString(),
});

router.get("/patient/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  
  console.log(`[LongitudinalJourney] Fetching data for patient: ${patientId}`);
  
  const data = generateSampleData(patientId);
  res.json(data);
});

router.get("/timeline/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { domain, startDate, endDate } = req.query;
  
  console.log(`[LongitudinalJourney] Fetching timeline for patient: ${patientId}`);
  
  let events = generateSampleData(patientId).timelineEvents;
  
  if (domain && typeof domain === "string") {
    events = events.filter(e => e.domain === domain);
  }
  
  if (startDate && typeof startDate === "string") {
    events = events.filter(e => new Date(e.startDate) >= new Date(startDate));
  }
  
  if (endDate && typeof endDate === "string") {
    events = events.filter(e => new Date(e.startDate) <= new Date(endDate));
  }
  
  res.json({ events, total: events.length });
});

router.get("/labs/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  
  console.log(`[LongitudinalJourney] Fetching lab results for patient: ${patientId}`);
  
  const data = generateSampleData(patientId);
  res.json({ labs: data.labResults, total: data.labResults.length });
});

router.get("/landmarks/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  
  console.log(`[LongitudinalJourney] Fetching landmarks for patient: ${patientId}`);
  
  const data = generateSampleData(patientId);
  const landmarkEvents = data.timelineEvents.filter(e => e.landmark);
  
  res.json({
    summary: data.landmarks,
    events: landmarkEvents,
  });
});

export function registerLongitudinalJourneyRoutes(app: any) {
  app.use("/api/longitudinal-health-journey", router);
  console.log("[Routes] Longitudinal Health Journey routes registered at /api/longitudinal-health-journey/*");
}
