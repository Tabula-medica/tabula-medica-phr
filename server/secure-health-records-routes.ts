import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import type {
  ClinicianNote,
  Prescription,
  LabResultRecord,
  AppointmentHistoryEntry,
} from "@shared/schema";

const router = Router();

interface HealthRecordAuditEntry {
  id: string;
  patientId: string;
  action: string;
  resourceType: string;
  details: string;
  ipAddress: string | null;
  timestamp: string;
}

const auditLog: HealthRecordAuditEntry[] = [];

function logAudit(patientId: string, action: string, resourceType: string, details: string, ipAddress: string | null): HealthRecordAuditEntry {
  const entry: HealthRecordAuditEntry = {
    id: `hr-audit-${Date.now()}-${randomUUID().slice(0, 8)}`,
    patientId,
    action,
    resourceType,
    details,
    ipAddress,
    timestamp: new Date().toISOString(),
  };
  auditLog.push(entry);
  console.log(`[PHI-AUDIT-HR] ${entry.timestamp} | ${action} | resource=${resourceType} | patient=${patientId} | ip=${ipAddress || "unknown"}`);
  return entry;
}

function validatePatientId(patientId: string): boolean {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(patientId);
}

const SAMPLE_PATIENT = "patient-secure-001";

const consultationNotes: ClinicianNote[] = [
  {
    id: "cn-001",
    patientId: SAMPLE_PATIENT,
    noteType: "progress",
    title: "Annual Physical Examination",
    content: "Patient presents for annual wellness visit. Overall health status is good. Blood pressure slightly elevated at 138/88. Recommended dietary changes and increased physical activity. Follow-up in 3 months to reassess blood pressure. Screening labs ordered including CBC, CMP, lipid panel, and HbA1c.",
    author: "Dr. Sarah Chen",
    authorRole: "Internal Medicine",
    createdAt: "2026-01-15T10:30:00Z",
    encounterDate: "2026-01-15",
    encounterType: "office_visit",
    diagnosisCodes: ["Z00.00", "R03.0"],
    procedureCodes: ["99395"],
    isAddendum: false,
    signedAt: "2026-01-15T11:45:00Z",
    signedBy: "Dr. Sarah Chen",
  },
  {
    id: "cn-002",
    patientId: SAMPLE_PATIENT,
    noteType: "consultation",
    title: "Cardiology Consultation - Elevated Blood Pressure",
    content: "Referred for evaluation of persistent borderline hypertension. ECG shows normal sinus rhythm. Echocardiogram reveals normal left ventricular function with EF 60%. Recommend ambulatory blood pressure monitoring over 24 hours. Consider initiating low-dose ACE inhibitor if readings remain elevated. Patient counseled on DASH diet and sodium restriction.",
    author: "Dr. James Morrison",
    authorRole: "Cardiology",
    createdAt: "2026-01-28T14:00:00Z",
    encounterDate: "2026-01-28",
    encounterType: "specialist_consultation",
    diagnosisCodes: ["I10", "R03.0"],
    procedureCodes: ["99243", "93000", "93306"],
    isAddendum: false,
    signedAt: "2026-01-28T15:30:00Z",
    signedBy: "Dr. James Morrison",
  },
  {
    id: "cn-003",
    patientId: SAMPLE_PATIENT,
    noteType: "telephone",
    title: "Lab Results Discussion",
    content: "Called patient to discuss recent lab results. CBC within normal limits. CMP shows mildly elevated fasting glucose at 112 mg/dL (pre-diabetic range). Lipid panel shows total cholesterol 218, LDL 142, HDL 48, triglycerides 165. HbA1c 5.9%. Discussed lifestyle modifications including dietary changes and exercise regimen. Will recheck in 3 months.",
    author: "Dr. Sarah Chen",
    authorRole: "Internal Medicine",
    createdAt: "2026-01-22T09:15:00Z",
    encounterDate: "2026-01-22",
    diagnosisCodes: ["R73.09", "E78.5"],
    isAddendum: false,
    signedAt: "2026-01-22T09:30:00Z",
    signedBy: "Dr. Sarah Chen",
  },
  {
    id: "cn-004",
    patientId: SAMPLE_PATIENT,
    noteType: "procedure",
    title: "24-Hour Ambulatory Blood Pressure Monitoring",
    content: "ABPM performed over 24-hour period. Average daytime BP: 134/86 mmHg. Average nighttime BP: 122/78 mmHg. Overall average: 130/83 mmHg. Dipping pattern present (normal nocturnal decrease). Results consistent with Stage 1 hypertension. Recommend initiating pharmacotherapy with lisinopril 10mg daily in addition to lifestyle modifications.",
    author: "Dr. James Morrison",
    authorRole: "Cardiology",
    createdAt: "2026-02-05T11:00:00Z",
    encounterDate: "2026-02-04",
    encounterType: "procedure",
    diagnosisCodes: ["I10"],
    procedureCodes: ["93784"],
    isAddendum: false,
    signedAt: "2026-02-05T12:00:00Z",
    signedBy: "Dr. James Morrison",
  },
  {
    id: "cn-005",
    patientId: SAMPLE_PATIENT,
    noteType: "progress",
    title: "Follow-up: Blood Pressure Management",
    content: "Patient returns for 4-week follow-up after starting lisinopril 10mg daily. Reports no side effects. Current BP 128/82. Improved from baseline. Continue current regimen. Patient reports adopting DASH diet and walking 30 minutes daily. Recheck BP in 4 weeks. Lab work for renal function and potassium in 2 weeks.",
    author: "Dr. Sarah Chen",
    authorRole: "Internal Medicine",
    createdAt: "2026-02-12T10:00:00Z",
    encounterDate: "2026-02-12",
    encounterType: "office_visit",
    diagnosisCodes: ["I10"],
    procedureCodes: ["99214"],
    isAddendum: false,
    signedAt: "2026-02-12T10:45:00Z",
    signedBy: "Dr. Sarah Chen",
  },
];

const prescriptions: Prescription[] = [
  {
    id: "rx-001",
    patientId: SAMPLE_PATIENT,
    providerId: "prov-001",
    providerName: "Dr. Sarah Chen",
    pharmacyName: "CVS Pharmacy #4521",
    medicationName: "Lisinopril",
    genericName: "lisinopril",
    strength: "10mg",
    dosageForm: "tablet",
    quantity: 30,
    daysSupply: 30,
    directions: "Take 1 tablet by mouth once daily in the morning",
    refillsAuthorized: 5,
    refillsRemaining: 5,
    dispenseAsWritten: false,
    status: "active",
    prescribedDate: "2026-02-05",
    expirationDate: "2027-02-05",
    lastFilledDate: "2026-02-06",
    diagnosis: "Essential Hypertension",
    icdCode: "I10",
    isControlledSubstance: false,
    createdAt: "2026-02-05T12:00:00Z",
    updatedAt: "2026-02-06T14:00:00Z",
  },
  {
    id: "rx-002",
    patientId: SAMPLE_PATIENT,
    providerId: "prov-001",
    providerName: "Dr. Sarah Chen",
    pharmacyName: "CVS Pharmacy #4521",
    medicationName: "Atorvastatin",
    genericName: "atorvastatin calcium",
    strength: "20mg",
    dosageForm: "tablet",
    quantity: 30,
    daysSupply: 30,
    directions: "Take 1 tablet by mouth once daily at bedtime",
    refillsAuthorized: 5,
    refillsRemaining: 4,
    dispenseAsWritten: false,
    status: "active",
    prescribedDate: "2026-01-22",
    expirationDate: "2027-01-22",
    lastFilledDate: "2026-02-10",
    diagnosis: "Hyperlipidemia",
    icdCode: "E78.5",
    isControlledSubstance: false,
    createdAt: "2026-01-22T10:00:00Z",
    updatedAt: "2026-02-10T09:00:00Z",
  },
  {
    id: "rx-003",
    patientId: SAMPLE_PATIENT,
    providerId: "prov-001",
    providerName: "Dr. Sarah Chen",
    pharmacyName: "CVS Pharmacy #4521",
    medicationName: "Metformin HCl",
    genericName: "metformin hydrochloride",
    strength: "500mg",
    dosageForm: "tablet",
    quantity: 60,
    daysSupply: 30,
    directions: "Take 1 tablet by mouth twice daily with meals",
    refillsAuthorized: 5,
    refillsRemaining: 5,
    dispenseAsWritten: false,
    status: "active",
    prescribedDate: "2026-01-22",
    expirationDate: "2027-01-22",
    lastFilledDate: "2026-01-23",
    diagnosis: "Pre-diabetes",
    icdCode: "R73.09",
    isControlledSubstance: false,
    createdAt: "2026-01-22T10:15:00Z",
    updatedAt: "2026-01-23T08:00:00Z",
  },
  {
    id: "rx-004",
    patientId: SAMPLE_PATIENT,
    providerId: "prov-002",
    providerName: "Dr. Emily Park",
    pharmacyName: "Walgreens #7823",
    medicationName: "Cetirizine",
    genericName: "cetirizine hydrochloride",
    strength: "10mg",
    dosageForm: "tablet",
    quantity: 30,
    daysSupply: 30,
    directions: "Take 1 tablet by mouth once daily as needed for allergies",
    refillsAuthorized: 3,
    refillsRemaining: 0,
    dispenseAsWritten: false,
    status: "expired",
    prescribedDate: "2025-04-10",
    expirationDate: "2025-10-10",
    diagnosis: "Allergic Rhinitis",
    icdCode: "J30.1",
    isControlledSubstance: false,
    createdAt: "2025-04-10T09:00:00Z",
    updatedAt: "2025-04-10T09:00:00Z",
  },
  {
    id: "rx-005",
    patientId: SAMPLE_PATIENT,
    providerId: "prov-003",
    providerName: "Dr. Robert Kim",
    pharmacyName: "CVS Pharmacy #4521",
    medicationName: "Amoxicillin",
    genericName: "amoxicillin",
    strength: "500mg",
    dosageForm: "capsule",
    quantity: 21,
    daysSupply: 7,
    directions: "Take 1 capsule by mouth three times daily for 7 days",
    refillsAuthorized: 0,
    refillsRemaining: 0,
    dispenseAsWritten: false,
    status: "filled",
    prescribedDate: "2025-11-15",
    expirationDate: "2025-12-15",
    lastFilledDate: "2025-11-15",
    diagnosis: "Acute Sinusitis",
    icdCode: "J01.90",
    isControlledSubstance: false,
    createdAt: "2025-11-15T14:00:00Z",
    updatedAt: "2025-11-22T00:00:00Z",
  },
];

const labResults: LabResultRecord[] = [
  {
    id: "lab-001",
    patientId: SAMPLE_PATIENT,
    testName: "Complete Blood Count (CBC)",
    testCode: "CBC",
    category: "Hematology",
    value: "WBC 6.8, RBC 4.9, Hgb 14.2, Hct 42.1, Plt 245",
    unit: "See components",
    referenceRange: "WBC 4.5-11.0, RBC 4.5-5.5, Hgb 13.5-17.5, Hct 38-50, Plt 150-400",
    flag: "normal",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-17",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "All values within normal limits.",
  },
  {
    id: "lab-002",
    patientId: SAMPLE_PATIENT,
    testName: "Comprehensive Metabolic Panel (CMP)",
    testCode: "CMP",
    category: "Chemistry",
    value: "Glucose 112, BUN 18, Creatinine 0.9, Na 140, K 4.2, CO2 24, Ca 9.5, Total Protein 7.1, Albumin 4.3, Bilirubin 0.8, ALP 72, AST 25, ALT 30",
    unit: "See components",
    referenceRange: "Glucose 70-100, BUN 7-20, Creatinine 0.7-1.3, Na 136-145, K 3.5-5.1",
    flag: "high",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-17",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "Fasting glucose mildly elevated at 112 mg/dL (pre-diabetic range 100-125). All other values within normal limits.",
    interpretation: "Fasting glucose in pre-diabetic range. Recommend lifestyle modifications and recheck in 3 months.",
  },
  {
    id: "lab-003",
    patientId: SAMPLE_PATIENT,
    testName: "Lipid Panel",
    testCode: "LIPID",
    category: "Chemistry",
    value: "Total Cholesterol 218, LDL 142, HDL 48, Triglycerides 165, VLDL 33",
    unit: "mg/dL",
    referenceRange: "TC <200, LDL <100, HDL >40, TG <150",
    flag: "high",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-17",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "Total cholesterol, LDL, and triglycerides elevated. HDL borderline low.",
    interpretation: "Dyslipidemia. LDL significantly above target. Consider statin therapy and dietary counseling.",
  },
  {
    id: "lab-004",
    patientId: SAMPLE_PATIENT,
    testName: "Hemoglobin A1c",
    testCode: "HBA1C",
    category: "Endocrinology",
    value: "5.9",
    unit: "%",
    referenceRange: "4.0-5.6% (Normal), 5.7-6.4% (Pre-diabetes)",
    flag: "abnormal",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-18",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "HbA1c 5.9% indicates pre-diabetes. Consistent with elevated fasting glucose.",
    interpretation: "Pre-diabetes. Recommend intensive lifestyle intervention. Recheck in 3 months.",
  },
  {
    id: "lab-005",
    patientId: SAMPLE_PATIENT,
    testName: "Basic Metabolic Panel (BMP)",
    testCode: "BMP",
    category: "Chemistry",
    value: "Glucose 98, BUN 16, Creatinine 0.8, Na 141, K 4.5, CO2 25, Cl 102, Ca 9.6",
    unit: "See components",
    referenceRange: "Glucose 70-100, BUN 7-20, Creatinine 0.7-1.3, K 3.5-5.1",
    flag: "normal",
    status: "final",
    collectionDate: "2026-02-14",
    resultDate: "2026-02-15",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "Renal function and electrolytes within normal limits. Potassium 4.5 (safe range for ACE inhibitor use). Fasting glucose improved to 98 from 112.",
    interpretation: "Normal renal function. Safe to continue lisinopril. Glucose improvement likely from dietary changes.",
  },
  {
    id: "lab-006",
    patientId: SAMPLE_PATIENT,
    testName: "Thyroid Stimulating Hormone (TSH)",
    testCode: "TSH",
    category: "Endocrinology",
    value: "2.4",
    unit: "mIU/L",
    referenceRange: "0.4-4.0 mIU/L",
    flag: "normal",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-18",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "Thyroid function normal.",
  },
  {
    id: "lab-007",
    patientId: SAMPLE_PATIENT,
    testName: "Urinalysis",
    testCode: "UA",
    category: "Urinalysis",
    value: "Color Yellow, Clarity Clear, pH 6.0, SG 1.020, Protein Neg, Glucose Neg, Blood Neg, WBC Neg",
    unit: "See components",
    referenceRange: "pH 5.0-8.0, SG 1.005-1.030",
    flag: "normal",
    status: "final",
    collectionDate: "2026-01-16",
    resultDate: "2026-01-17",
    orderingProvider: "Dr. Sarah Chen",
    performingLab: "Quest Diagnostics",
    notes: "Normal urinalysis. No evidence of proteinuria or glucosuria.",
  },
];

const visitHistory: AppointmentHistoryEntry[] = [
  {
    id: "visit-001",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-02-12",
    appointmentTime: "10:00",
    appointmentType: "Follow-up",
    provider: "Dr. Sarah Chen",
    providerSpecialty: "Internal Medicine",
    location: "Primary Care Clinic - Suite 200",
    status: "completed",
    reasonForVisit: "Blood pressure management follow-up",
    duration: 30,
    notes: "BP improved on lisinopril. Continue current regimen.",
    followUpRequired: true,
    followUpDate: "2026-03-12",
  },
  {
    id: "visit-002",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-02-04",
    appointmentTime: "08:00",
    appointmentType: "Procedure",
    provider: "Dr. James Morrison",
    providerSpecialty: "Cardiology",
    location: "Cardiology Associates - 3rd Floor",
    status: "completed",
    reasonForVisit: "24-hour ambulatory blood pressure monitoring",
    duration: 15,
    notes: "ABPM device placed. Patient instructed on proper use. Return tomorrow for removal.",
    followUpRequired: true,
    followUpDate: "2026-02-05",
  },
  {
    id: "visit-003",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-01-28",
    appointmentTime: "14:00",
    appointmentType: "Specialist Consultation",
    provider: "Dr. James Morrison",
    providerSpecialty: "Cardiology",
    location: "Cardiology Associates - 3rd Floor",
    status: "completed",
    reasonForVisit: "Cardiology consultation for elevated blood pressure",
    duration: 45,
    notes: "ECG and echocardiogram performed. Normal findings. ABPM recommended.",
    followUpRequired: true,
    followUpDate: "2026-02-04",
  },
  {
    id: "visit-004",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-01-16",
    appointmentTime: "09:00",
    appointmentType: "Lab Work",
    provider: "Quest Diagnostics",
    location: "Quest Diagnostics - Patient Service Center",
    status: "completed",
    reasonForVisit: "Annual screening labs - CBC, CMP, lipid panel, HbA1c, TSH, UA",
    duration: 15,
    followUpRequired: false,
  },
  {
    id: "visit-005",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-01-15",
    appointmentTime: "10:30",
    appointmentType: "Annual Physical",
    provider: "Dr. Sarah Chen",
    providerSpecialty: "Internal Medicine",
    location: "Primary Care Clinic - Suite 200",
    status: "completed",
    reasonForVisit: "Annual wellness examination",
    duration: 45,
    notes: "Complete physical exam performed. BP slightly elevated. Labs ordered. Referral to cardiology for BP evaluation.",
    followUpRequired: true,
    followUpDate: "2026-01-28",
  },
  {
    id: "visit-006",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2025-11-15",
    appointmentTime: "14:30",
    appointmentType: "Sick Visit",
    provider: "Dr. Robert Kim",
    providerSpecialty: "Family Medicine",
    location: "Urgent Care Clinic",
    status: "completed",
    reasonForVisit: "Sinus congestion, facial pressure, and headache for 10 days",
    duration: 20,
    notes: "Acute sinusitis diagnosed. Amoxicillin prescribed for 7 days.",
    followUpRequired: false,
  },
  {
    id: "visit-007",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-03-12",
    appointmentTime: "10:00",
    appointmentType: "Follow-up",
    provider: "Dr. Sarah Chen",
    providerSpecialty: "Internal Medicine",
    location: "Primary Care Clinic - Suite 200",
    status: "scheduled",
    reasonForVisit: "Blood pressure and metabolic follow-up",
    duration: 30,
    followUpRequired: false,
  },
  {
    id: "visit-008",
    patientId: SAMPLE_PATIENT,
    appointmentDate: "2026-04-16",
    appointmentTime: "09:00",
    appointmentType: "Lab Work",
    provider: "Quest Diagnostics",
    location: "Quest Diagnostics - Patient Service Center",
    status: "scheduled",
    reasonForVisit: "Follow-up labs - CMP, lipid panel, HbA1c",
    duration: 15,
    followUpRequired: false,
  },
];

router.use((req: Request, res: Response, next) => {
  const patientId = req.params.patientId || req.path.split("/")[2];
  if (patientId && !validatePatientId(patientId)) {
    return res.status(400).json({ error: "Invalid patient identifier format" });
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  next();
});

router.get("/summary/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;

  const patientNotes = consultationNotes.filter((n) => n.patientId === patientId);
  const patientRx = prescriptions.filter((r) => r.patientId === patientId);
  const patientLabs = labResults.filter((l) => l.patientId === patientId);
  const patientVisits = visitHistory.filter((v) => v.patientId === patientId);

  const activeRx = patientRx.filter((r) => r.status === "active");
  const abnormalLabs = patientLabs.filter((l) => l.flag !== "normal");
  const completedVisits = patientVisits.filter((v) => v.status === "completed");
  const scheduledVisits = patientVisits.filter((v) => v.status === "scheduled");

  logAudit(patientId, "VIEW_HEALTH_SUMMARY", "summary", "Patient accessed health records summary dashboard", req.ip || null);

  res.json({
    totalConsultations: patientNotes.length,
    totalPrescriptions: patientRx.length,
    activePrescriptions: activeRx.length,
    totalLabResults: patientLabs.length,
    abnormalLabResults: abnormalLabs.length,
    totalVisits: patientVisits.length,
    completedVisits: completedVisits.length,
    scheduledVisits: scheduledVisits.length,
    recentConsultation: patientNotes.length > 0 ? patientNotes[0].encounterDate : null,
    recentLabDate: patientLabs.length > 0 ? patientLabs[0].resultDate : null,
    nextAppointment: scheduledVisits.length > 0 ? scheduledVisits[scheduledVisits.length - 1] : null,
  });
});

router.get("/consultations/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { search, noteType, dateFrom, dateTo } = req.query;

  let results = consultationNotes.filter((n) => n.patientId === patientId);

  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    results = results.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.author.toLowerCase().includes(q) ||
        n.authorRole.toLowerCase().includes(q)
    );
  }

  if (noteType && typeof noteType === "string" && noteType !== "all") {
    results = results.filter((n) => n.noteType === noteType);
  }

  if (dateFrom && typeof dateFrom === "string") {
    results = results.filter((n) => n.encounterDate >= dateFrom);
  }
  if (dateTo && typeof dateTo === "string") {
    results = results.filter((n) => n.encounterDate <= dateTo);
  }

  results.sort((a, b) => b.encounterDate.localeCompare(a.encounterDate));

  logAudit(patientId, "VIEW_CONSULTATIONS", "clinician_notes", `Viewed ${results.length} consultation notes${search ? ` (search: "${search}")` : ""}`, req.ip || null);

  res.json({ records: results, total: results.length });
});

router.get("/prescriptions/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { search, status } = req.query;

  let results = prescriptions.filter((r) => r.patientId === patientId);

  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    results = results.filter(
      (r) =>
        r.medicationName.toLowerCase().includes(q) ||
        (r.genericName && r.genericName.toLowerCase().includes(q)) ||
        r.providerName.toLowerCase().includes(q) ||
        r.directions.toLowerCase().includes(q) ||
        (r.diagnosis && r.diagnosis.toLowerCase().includes(q))
    );
  }

  if (status && typeof status === "string" && status !== "all") {
    results = results.filter((r) => r.status === status);
  }

  results.sort((a, b) => b.prescribedDate.localeCompare(a.prescribedDate));

  logAudit(patientId, "VIEW_PRESCRIPTIONS", "prescriptions", `Viewed ${results.length} prescriptions${search ? ` (search: "${search}")` : ""}`, req.ip || null);

  res.json({ records: results, total: results.length });
});

router.get("/lab-results/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { search, category, flag, dateFrom, dateTo } = req.query;

  let results = labResults.filter((l) => l.patientId === patientId);

  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    results = results.filter(
      (l) =>
        l.testName.toLowerCase().includes(q) ||
        l.testCode.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.orderingProvider.toLowerCase().includes(q) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }

  if (category && typeof category === "string" && category !== "all") {
    results = results.filter((l) => l.category === category);
  }

  if (flag && typeof flag === "string" && flag !== "all") {
    results = results.filter((l) => l.flag === flag);
  }

  if (dateFrom && typeof dateFrom === "string") {
    results = results.filter((l) => l.resultDate >= dateFrom);
  }
  if (dateTo && typeof dateTo === "string") {
    results = results.filter((l) => l.resultDate <= dateTo);
  }

  results.sort((a, b) => b.resultDate.localeCompare(a.resultDate));

  const categories = Array.from(new Set(labResults.filter((l) => l.patientId === patientId).map((l) => l.category)));

  logAudit(patientId, "VIEW_LAB_RESULTS", "lab_results", `Viewed ${results.length} lab results${search ? ` (search: "${search}")` : ""}${flag && flag !== "all" ? ` (flag: ${flag})` : ""}`, req.ip || null);

  res.json({ records: results, total: results.length, categories });
});

router.get("/visits/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const { search, status, appointmentType, dateFrom, dateTo } = req.query;

  let results = visitHistory.filter((v) => v.patientId === patientId);

  if (search && typeof search === "string") {
    const q = search.toLowerCase();
    results = results.filter(
      (v) =>
        v.provider.toLowerCase().includes(q) ||
        v.reasonForVisit.toLowerCase().includes(q) ||
        v.location.toLowerCase().includes(q) ||
        v.appointmentType.toLowerCase().includes(q) ||
        (v.notes && v.notes.toLowerCase().includes(q))
    );
  }

  if (status && typeof status === "string" && status !== "all") {
    results = results.filter((v) => v.status === status);
  }

  if (appointmentType && typeof appointmentType === "string" && appointmentType !== "all") {
    results = results.filter((v) => v.appointmentType === appointmentType);
  }

  if (dateFrom && typeof dateFrom === "string") {
    results = results.filter((v) => v.appointmentDate >= dateFrom);
  }
  if (dateTo && typeof dateTo === "string") {
    results = results.filter((v) => v.appointmentDate <= dateTo);
  }

  results.sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate));

  logAudit(patientId, "VIEW_VISITS", "visit_history", `Viewed ${results.length} visit records${search ? ` (search: "${search}")` : ""}`, req.ip || null);

  res.json({ records: results, total: results.length });
});

router.get("/consultation/:patientId/:noteId", (req: Request, res: Response) => {
  const { patientId, noteId } = req.params;
  const note = consultationNotes.find((n) => n.id === noteId && n.patientId === patientId);
  if (!note) {
    return res.status(404).json({ error: "Consultation note not found" });
  }

  logAudit(patientId, "VIEW_CONSULTATION_DETAIL", "clinician_note", `Viewed consultation note: ${note.title} (${noteId})`, req.ip || null);

  res.json(note);
});

router.get("/prescription/:patientId/:rxId", (req: Request, res: Response) => {
  const { patientId, rxId } = req.params;
  const rx = prescriptions.find((r) => r.id === rxId && r.patientId === patientId);
  if (!rx) {
    return res.status(404).json({ error: "Prescription not found" });
  }

  logAudit(patientId, "VIEW_PRESCRIPTION_DETAIL", "prescription", `Viewed prescription: ${rx.medicationName} (${rxId})`, req.ip || null);

  res.json(rx);
});

router.get("/audit-log/:patientId", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const patientAudit = auditLog.filter((e) => e.patientId === patientId);

  logAudit(patientId, "VIEW_HEALTH_RECORDS_AUDIT", "audit_log", "Health records audit log accessed", req.ip || null);

  res.json({ entries: patientAudit, total: patientAudit.length });
});

export default router;
