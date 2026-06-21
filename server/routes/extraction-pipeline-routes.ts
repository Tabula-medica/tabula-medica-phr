import { Router } from "express";

const router = Router();

const PHYSIOLOGICAL_RANGES: Record<string, { min: number; max: number; unit: string; critical_low?: number; critical_high?: number }> = {
  "Sodium": { min: 136, max: 145, unit: "mEq/L", critical_low: 120, critical_high: 160 },
  "Potassium": { min: 3.5, max: 5.0, unit: "mEq/L", critical_low: 2.5, critical_high: 6.5 },
  "Chloride": { min: 98, max: 106, unit: "mEq/L" },
  "CO2": { min: 23, max: 29, unit: "mEq/L" },
  "BUN": { min: 7, max: 20, unit: "mg/dL" },
  "Creatinine": { min: 0.6, max: 1.2, unit: "mg/dL", critical_high: 10.0 },
  "Glucose": { min: 70, max: 100, unit: "mg/dL", critical_low: 40, critical_high: 500 },
  "Calcium": { min: 8.5, max: 10.5, unit: "mg/dL", critical_low: 6.0, critical_high: 13.0 },
  "Total Protein": { min: 6.0, max: 8.3, unit: "g/dL" },
  "Albumin": { min: 3.5, max: 5.5, unit: "g/dL" },
  "Bilirubin Total": { min: 0.1, max: 1.2, unit: "mg/dL" },
  "ALT": { min: 7, max: 56, unit: "U/L" },
  "AST": { min: 10, max: 40, unit: "U/L" },
  "ALP": { min: 44, max: 147, unit: "U/L" },
  "WBC": { min: 4.5, max: 11.0, unit: "K/uL", critical_low: 2.0, critical_high: 30.0 },
  "RBC": { min: 4.0, max: 5.5, unit: "M/uL" },
  "Hemoglobin": { min: 12.0, max: 17.5, unit: "g/dL", critical_low: 7.0, critical_high: 20.0 },
  "Hematocrit": { min: 36, max: 52, unit: "%" },
  "Platelets": { min: 150, max: 400, unit: "K/uL", critical_low: 50, critical_high: 1000 },
  "TSH": { min: 0.27, max: 4.20, unit: "uIU/mL" },
  "Free T4": { min: 0.9, max: 1.7, unit: "ng/dL" },
  "Hemoglobin A1c": { min: 4.0, max: 5.6, unit: "%" },
  "LDL Cholesterol": { min: 0, max: 100, unit: "mg/dL" },
  "HDL Cholesterol": { min: 40, max: 100, unit: "mg/dL" },
  "Triglycerides": { min: 0, max: 150, unit: "mg/dL" },
  "Total Cholesterol": { min: 0, max: 200, unit: "mg/dL" },
  "PSA": { min: 0, max: 4.0, unit: "ng/mL" },
  "Vitamin D": { min: 30, max: 100, unit: "ng/mL" },
  "Iron": { min: 60, max: 170, unit: "mcg/dL" },
  "Ferritin": { min: 12, max: 300, unit: "ng/mL" },
  "Systolic BP": { min: 70, max: 180, unit: "mmHg", critical_low: 60, critical_high: 220 },
  "Diastolic BP": { min: 40, max: 120, unit: "mmHg", critical_low: 30, critical_high: 150 },
  "Heart Rate": { min: 40, max: 120, unit: "bpm", critical_low: 30, critical_high: 200 },
  "Respiratory Rate": { min: 12, max: 20, unit: "breaths/min", critical_low: 8, critical_high: 40 },
  "Temperature": { min: 96.0, max: 100.4, unit: "°F", critical_low: 93.0, critical_high: 106.0 },
  "SpO2": { min: 92, max: 100, unit: "%", critical_low: 85, critical_high: 100 },
  "BMI": { min: 16, max: 45, unit: "kg/m²" },
};

const UNIT_CONVERSIONS: Record<string, { from: string; to: string; factor: number }[]> = {
  "Weight": [{ from: "lbs", to: "kg", factor: 0.453592 }, { from: "kg", to: "lbs", factor: 2.20462 }],
  "Height": [{ from: "in", to: "cm", factor: 2.54 }, { from: "cm", to: "in", factor: 0.393701 }],
  "Temperature": [{ from: "°C", to: "°F", factor: 1.8 }, { from: "°F", to: "°C", factor: 0.5556 }],
  "Glucose": [{ from: "mmol/L", to: "mg/dL", factor: 18.0182 }, { from: "mg/dL", to: "mmol/L", factor: 0.0555 }],
  "Cholesterol": [{ from: "mmol/L", to: "mg/dL", factor: 38.67 }, { from: "mg/dL", to: "mmol/L", factor: 0.02586 }],
  "Creatinine": [{ from: "µmol/L", to: "mg/dL", factor: 0.0113 }, { from: "mg/dL", to: "µmol/L", factor: 88.42 }],
  "Hemoglobin": [{ from: "mmol/L", to: "g/dL", factor: 1.6114 }, { from: "g/dL", to: "mmol/L", factor: 0.6206 }],
};

interface DocumentQueueItem {
  id: string;
  filename: string;
  uploadTimestamp: string;
  documentType: string;
  pageCount: number;
  dpiDetected: number;
  fileSize: string;
  preProcessing: {
    deskewApplied: boolean;
    denoiseApplied: boolean;
    contrastEnhanced: boolean;
    artifactsRemoved: number;
    qualityScore: number;
    qualityGate: "passed" | "flagged" | "rejected";
    dpiCheck: "passed" | "below-threshold";
  };
  extraction: {
    modelA: { name: string; confidence: number; extractedFields: number; timeMs: number };
    modelB: { name: string; confidence: number; extractedFields: number; timeMs: number };
    consensus: { agreedFields: number; conflictedFields: number; consensusRate: number };
    overallConfidence: number;
  };
  clinicalChecks: {
    rangeValidations: number;
    outOfBounds: number;
    unitNormalizations: number;
    temporalChecks: number;
    temporalViolations: number;
    passedAll: boolean;
  };
  hitlStatus: "auto-approved" | "pending-review" | "reviewed" | "rejected";
  reviewerNotes: string;
  patientId: string;
}

function generateQueueItems(): DocumentQueueItem[] {
  return [
    {
      id: "doc-001", filename: "LabCorp_CBC_Panel_20260401.pdf", uploadTimestamp: "2026-04-05T08:12:00Z",
      documentType: "Lab Report", pageCount: 2, dpiDetected: 350, fileSize: "1.2 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 98, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 99.2, extractedFields: 18, timeMs: 2340 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 99.1, extractedFields: 18, timeMs: 1870 },
        consensus: { agreedFields: 18, conflictedFields: 0, consensusRate: 100 },
        overallConfidence: 99.15,
      },
      clinicalChecks: { rangeValidations: 12, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 2, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p1",
    },
    {
      id: "doc-002", filename: "Quest_CMP_Fax_20260328.pdf", uploadTimestamp: "2026-04-05T09:34:00Z",
      documentType: "Lab Report", pageCount: 3, dpiDetected: 200, fileSize: "2.8 MB",
      preProcessing: { deskewApplied: true, denoiseApplied: true, contrastEnhanced: true, artifactsRemoved: 3, qualityScore: 72, qualityGate: "flagged", dpiCheck: "below-threshold" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 91.3, extractedFields: 22, timeMs: 3420 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 89.7, extractedFields: 21, timeMs: 2890 },
        consensus: { agreedFields: 19, conflictedFields: 3, consensusRate: 86.4 },
        overallConfidence: 88.5,
      },
      clinicalChecks: { rangeValidations: 14, outOfBounds: 1, unitNormalizations: 2, temporalChecks: 2, temporalViolations: 0, passedAll: false },
      hitlStatus: "pending-review", reviewerNotes: "", patientId: "anon-p2",
    },
    {
      id: "doc-003", filename: "Discharge_Summary_Memorial_20260315.pdf", uploadTimestamp: "2026-04-04T14:22:00Z",
      documentType: "Discharge Summary", pageCount: 5, dpiDetected: 300, fileSize: "3.4 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: true, contrastEnhanced: false, artifactsRemoved: 1, qualityScore: 89, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 97.8, extractedFields: 42, timeMs: 5120 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 97.2, extractedFields: 41, timeMs: 4380 },
        consensus: { agreedFields: 40, conflictedFields: 2, consensusRate: 95.2 },
        overallConfidence: 96.5,
      },
      clinicalChecks: { rangeValidations: 8, outOfBounds: 0, unitNormalizations: 1, temporalChecks: 6, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p3",
    },
    {
      id: "doc-004", filename: "Radiology_MRI_Brain_20260322.pdf", uploadTimestamp: "2026-04-04T16:45:00Z",
      documentType: "Radiology Report", pageCount: 2, dpiDetected: 320, fileSize: "1.8 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 95, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 98.5, extractedFields: 15, timeMs: 2100 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 98.1, extractedFields: 15, timeMs: 1750 },
        consensus: { agreedFields: 15, conflictedFields: 0, consensusRate: 100 },
        overallConfidence: 98.3,
      },
      clinicalChecks: { rangeValidations: 0, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 3, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p4",
    },
    {
      id: "doc-005", filename: "Handwritten_Rx_DrPatel_20260401.jpg", uploadTimestamp: "2026-04-04T11:30:00Z",
      documentType: "Prescription", pageCount: 1, dpiDetected: 150, fileSize: "0.8 MB",
      preProcessing: { deskewApplied: true, denoiseApplied: true, contrastEnhanced: true, artifactsRemoved: 2, qualityScore: 58, qualityGate: "rejected", dpiCheck: "below-threshold" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 72.1, extractedFields: 6, timeMs: 1890 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 68.4, extractedFields: 5, timeMs: 1620 },
        consensus: { agreedFields: 4, conflictedFields: 2, consensusRate: 66.7 },
        overallConfidence: 65.3,
      },
      clinicalChecks: { rangeValidations: 0, outOfBounds: 0, unitNormalizations: 1, temporalChecks: 1, temporalViolations: 0, passedAll: false },
      hitlStatus: "pending-review", reviewerNotes: "Low quality handwritten scan — manual re-scan recommended", patientId: "anon-p5",
    },
    {
      id: "doc-006", filename: "Pathology_Biopsy_20260310.pdf", uploadTimestamp: "2026-04-03T09:15:00Z",
      documentType: "Pathology Report", pageCount: 4, dpiDetected: 400, fileSize: "4.2 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 99, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 96.8, extractedFields: 28, timeMs: 4560 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 96.2, extractedFields: 27, timeMs: 3890 },
        consensus: { agreedFields: 26, conflictedFields: 2, consensusRate: 92.9 },
        overallConfidence: 95.5,
      },
      clinicalChecks: { rangeValidations: 3, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 4, temporalViolations: 0, passedAll: true },
      hitlStatus: "reviewed", reviewerNotes: "Pathology staging confirmed by reviewer — T2N0M0 accurate", patientId: "anon-p6",
    },
    {
      id: "doc-007", filename: "EKG_Report_HeartCare_20260325.pdf", uploadTimestamp: "2026-04-03T13:48:00Z",
      documentType: "Cardiology Report", pageCount: 2, dpiDetected: 310, fileSize: "1.5 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 94, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 97.9, extractedFields: 12, timeMs: 1980 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 97.5, extractedFields: 12, timeMs: 1650 },
        consensus: { agreedFields: 12, conflictedFields: 0, consensusRate: 100 },
        overallConfidence: 97.7,
      },
      clinicalChecks: { rangeValidations: 4, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 2, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p7",
    },
    {
      id: "doc-008", filename: "Immunization_Record_Mobile_20260402.jpg", uploadTimestamp: "2026-04-02T10:22:00Z",
      documentType: "Immunization Record", pageCount: 1, dpiDetected: 280, fileSize: "0.6 MB",
      preProcessing: { deskewApplied: true, denoiseApplied: false, contrastEnhanced: true, artifactsRemoved: 1, qualityScore: 82, qualityGate: "passed", dpiCheck: "below-threshold" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 93.4, extractedFields: 8, timeMs: 1540 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 92.8, extractedFields: 8, timeMs: 1320 },
        consensus: { agreedFields: 7, conflictedFields: 1, consensusRate: 87.5 },
        overallConfidence: 91.1,
      },
      clinicalChecks: { rangeValidations: 0, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 4, temporalViolations: 1, passedAll: false },
      hitlStatus: "pending-review", reviewerNotes: "Temporal issue: vaccine date appears after expiry date — likely data entry error on original record", patientId: "anon-p8",
    },
    {
      id: "doc-009", filename: "Operative_Note_Ortho_20260220.pdf", uploadTimestamp: "2026-04-02T15:10:00Z",
      documentType: "Operative Note", pageCount: 3, dpiDetected: 350, fileSize: "2.1 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 97, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 98.1, extractedFields: 24, timeMs: 3780 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 97.6, extractedFields: 24, timeMs: 3210 },
        consensus: { agreedFields: 23, conflictedFields: 1, consensusRate: 95.8 },
        overallConfidence: 97.0,
      },
      clinicalChecks: { rangeValidations: 2, outOfBounds: 0, unitNormalizations: 1, temporalChecks: 5, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p9",
    },
    {
      id: "doc-010", filename: "Allergy_Panel_BioRef_20260318.pdf", uploadTimestamp: "2026-04-01T08:30:00Z",
      documentType: "Lab Report", pageCount: 2, dpiDetected: 330, fileSize: "1.4 MB",
      preProcessing: { deskewApplied: false, denoiseApplied: false, contrastEnhanced: false, artifactsRemoved: 0, qualityScore: 96, qualityGate: "passed", dpiCheck: "passed" },
      extraction: {
        modelA: { name: "GPT-4o", confidence: 98.7, extractedFields: 16, timeMs: 2210 },
        modelB: { name: "Claude 3.5 Sonnet", confidence: 98.3, extractedFields: 16, timeMs: 1880 },
        consensus: { agreedFields: 16, conflictedFields: 0, consensusRate: 100 },
        overallConfidence: 98.5,
      },
      clinicalChecks: { rangeValidations: 10, outOfBounds: 0, unitNormalizations: 0, temporalChecks: 2, temporalViolations: 0, passedAll: true },
      hitlStatus: "auto-approved", reviewerNotes: "", patientId: "anon-p10",
    },
  ];
}

interface ConflictDetail {
  id: string;
  documentId: string;
  fieldName: string;
  modelAValue: string;
  modelAConfidence: number;
  modelBValue: string;
  modelBConfidence: number;
  resolvedValue: string | null;
  resolvedBy: "auto" | "human" | null;
  severity: "critical" | "high" | "medium" | "low";
  context: string;
}

function generateConflicts(): ConflictDetail[] {
  return [
    { id: "conf-001", documentId: "doc-002", fieldName: "Potassium", modelAValue: "4.2 mEq/L", modelAConfidence: 91.3, modelBValue: "4.7 mEq/L", modelBConfidence: 89.7, resolvedValue: null, resolvedBy: null, severity: "high", context: "CMP Panel — value difference of 0.5 mEq/L exceeds tolerance of 0.1" },
    { id: "conf-002", documentId: "doc-002", fieldName: "Chloride", modelAValue: "102 mEq/L", modelAConfidence: 88.5, modelBValue: "107 mEq/L", modelBConfidence: 86.2, resolvedValue: null, resolvedBy: null, severity: "medium", context: "CMP Panel — both values within normal range but differ by 5 units" },
    { id: "conf-003", documentId: "doc-002", fieldName: "BUN", modelAValue: "18 mg/dL", modelAConfidence: 92.1, modelBValue: "13 mg/dL", modelBConfidence: 87.4, resolvedValue: null, resolvedBy: null, severity: "medium", context: "CMP Panel — digit ambiguity in faxed document" },
    { id: "conf-004", documentId: "doc-003", fieldName: "Discharge Medication Count", modelAValue: "7 medications", modelAConfidence: 97.8, modelBValue: "6 medications", modelBConfidence: 96.1, resolvedValue: "7 medications", resolvedBy: "human", severity: "high", context: "Discharge Summary — Model B missed PRN medication at bottom of page" },
    { id: "conf-005", documentId: "doc-003", fieldName: "Follow-up Date", modelAValue: "2026-04-01", modelAConfidence: 96.2, modelBValue: "2026-04-07", modelBConfidence: 95.8, resolvedValue: "2026-04-01", resolvedBy: "human", severity: "medium", context: "Discharge Summary — handwritten date was ambiguous (1 vs 7)" },
    { id: "conf-006", documentId: "doc-005", fieldName: "Medication Name", modelAValue: "Lisinopril 10mg", modelAConfidence: 72.1, modelBValue: "Losartan 10mg", modelBConfidence: 68.4, resolvedValue: null, resolvedBy: null, severity: "critical", context: "Handwritten prescription — drug name illegible, requires pharmacist verification" },
    { id: "conf-007", documentId: "doc-005", fieldName: "Dosage Frequency", modelAValue: "BID", modelAConfidence: 65.3, modelBValue: "QD", modelBConfidence: 61.8, resolvedValue: null, resolvedBy: null, severity: "critical", context: "Handwritten prescription — frequency abbreviation unclear" },
    { id: "conf-008", documentId: "doc-006", fieldName: "Margin Status", modelAValue: "Negative (2mm)", modelAConfidence: 96.8, modelBValue: "Negative (1.5mm)", modelBConfidence: 95.1, resolvedValue: "Negative (2mm)", resolvedBy: "human", severity: "high", context: "Pathology report — margin measurement critical for treatment planning" },
    { id: "conf-009", documentId: "doc-008", fieldName: "Vaccine Date (Tdap)", modelAValue: "2026-03-15", modelAConfidence: 93.4, modelBValue: "2026-03-25", modelBConfidence: 91.2, resolvedValue: null, resolvedBy: null, severity: "medium", context: "Immunization record — mobile photo with date partially obscured" },
  ];
}

interface GoldenAuditResult {
  id: string;
  auditDate: string;
  sampleSize: number;
  verifiedBy: string;
  characterErrorRate: number;
  wordErrorRate: number;
  fieldAccuracy: number;
  criticalFieldAccuracy: number;
  documentTypes: { type: string; count: number; accuracy: number }[];
  falsePositives: number;
  falseNegatives: number;
  overallGrade: "A+" | "A" | "B+" | "B" | "C" | "F";
  notes: string;
}

function generateGoldenAudits(): GoldenAuditResult[] {
  return [
    {
      id: "audit-001", auditDate: "2026-04-01", sampleSize: 100, verifiedBy: "Dr. Rachel Kim, MD (Medical Records Director)",
      characterErrorRate: 0.018, wordErrorRate: 0.032, fieldAccuracy: 99.82, criticalFieldAccuracy: 99.95,
      documentTypes: [
        { type: "Lab Report", count: 35, accuracy: 99.91 },
        { type: "Discharge Summary", count: 20, accuracy: 99.75 },
        { type: "Radiology Report", count: 15, accuracy: 99.87 },
        { type: "Operative Note", count: 10, accuracy: 99.80 },
        { type: "Pathology Report", count: 10, accuracy: 99.70 },
        { type: "Prescription", count: 5, accuracy: 98.60 },
        { type: "Immunization Record", count: 5, accuracy: 99.40 },
      ],
      falsePositives: 2, falseNegatives: 1, overallGrade: "A+",
      notes: "Excellent extraction quality across all document types. Only prescription scans showed meaningful degradation — recommending OCR-quality minimum enforcement.",
    },
    {
      id: "audit-002", auditDate: "2026-03-01", sampleSize: 100, verifiedBy: "Dr. James Park, MD (Chief Medical Informatics Officer)",
      characterErrorRate: 0.021, wordErrorRate: 0.038, fieldAccuracy: 99.76, criticalFieldAccuracy: 99.92,
      documentTypes: [
        { type: "Lab Report", count: 38, accuracy: 99.87 },
        { type: "Discharge Summary", count: 22, accuracy: 99.68 },
        { type: "Radiology Report", count: 12, accuracy: 99.83 },
        { type: "Operative Note", count: 8, accuracy: 99.75 },
        { type: "Pathology Report", count: 12, accuracy: 99.67 },
        { type: "Prescription", count: 4, accuracy: 98.25 },
        { type: "Immunization Record", count: 4, accuracy: 99.50 },
      ],
      falsePositives: 3, falseNegatives: 2, overallGrade: "A",
      notes: "Consistent improvement from February. Multi-model consensus reduced false positives by 40% versus single-model baseline.",
    },
    {
      id: "audit-003", auditDate: "2026-02-01", sampleSize: 100, verifiedBy: "Sarah Chen, RN, BSN (Quality Assurance Lead)",
      characterErrorRate: 0.025, wordErrorRate: 0.044, fieldAccuracy: 99.68, criticalFieldAccuracy: 99.88,
      documentTypes: [
        { type: "Lab Report", count: 40, accuracy: 99.82 },
        { type: "Discharge Summary", count: 18, accuracy: 99.55 },
        { type: "Radiology Report", count: 14, accuracy: 99.79 },
        { type: "Operative Note", count: 12, accuracy: 99.67 },
        { type: "Pathology Report", count: 8, accuracy: 99.63 },
        { type: "Prescription", count: 4, accuracy: 97.75 },
        { type: "Immunization Record", count: 4, accuracy: 99.25 },
      ],
      falsePositives: 4, falseNegatives: 3, overallGrade: "A",
      notes: "First month of multi-model voting deployment. Significant improvement over single-model baseline (CER dropped from 0.045 to 0.025).",
    },
  ];
}

router.get("/dashboard", (_req, res) => {
  try {
    const queue = generateQueueItems();
    const conflicts = generateConflicts();
    const audits = generateGoldenAudits();

    const totalDocs = queue.length;
    const autoApproved = queue.filter(d => d.hitlStatus === "auto-approved").length;
    const pendingReview = queue.filter(d => d.hitlStatus === "pending-review").length;
    const reviewed = queue.filter(d => d.hitlStatus === "reviewed").length;
    const avgConfidence = queue.reduce((sum, d) => sum + d.extraction.overallConfidence, 0) / totalDocs;
    const avgConsensus = queue.reduce((sum, d) => sum + d.extraction.consensus.consensusRate, 0) / totalDocs;
    const qualityPassed = queue.filter(d => d.preProcessing.qualityGate === "passed").length;
    const qualityFlagged = queue.filter(d => d.preProcessing.qualityGate === "flagged").length;
    const qualityRejected = queue.filter(d => d.preProcessing.qualityGate === "rejected").length;
    const totalConflicts = conflicts.length;
    const unresolvedConflicts = conflicts.filter(c => c.resolvedBy === null).length;
    const clinicalChecksPassed = queue.filter(d => d.clinicalChecks.passedAll).length;

    res.json({
      summary: {
        totalDocuments: totalDocs,
        autoApproved,
        pendingReview,
        reviewed,
        rejected: queue.filter(d => d.hitlStatus === "rejected").length,
        averageConfidence: Math.round(avgConfidence * 10) / 10,
        averageConsensusRate: Math.round(avgConsensus * 10) / 10,
        totalConflicts,
        unresolvedConflicts,
        clinicalCheckPassRate: Math.round((clinicalChecksPassed / totalDocs) * 100),
        qualityGate: { passed: qualityPassed, flagged: qualityFlagged, rejected: qualityRejected },
        latestAudit: audits[0],
      },
      pipelineStages: [
        { name: "Pre-Processing", icon: "image", total: totalDocs, passed: qualityPassed, flagged: qualityFlagged, rejected: qualityRejected },
        { name: "Multi-Model Extraction", icon: "brain", total: totalDocs, avgConfidence: Math.round(avgConfidence * 10) / 10, avgTime: Math.round(queue.reduce((s, d) => s + d.extraction.modelA.timeMs + d.extraction.modelB.timeMs, 0) / totalDocs) },
        { name: "Consensus Voting", icon: "vote", total: queue.reduce((s, d) => s + d.extraction.consensus.agreedFields + d.extraction.consensus.conflictedFields, 0), agreed: queue.reduce((s, d) => s + d.extraction.consensus.agreedFields, 0), conflicted: queue.reduce((s, d) => s + d.extraction.consensus.conflictedFields, 0) },
        { name: "Clinical Checks", icon: "stethoscope", total: queue.reduce((s, d) => s + d.clinicalChecks.rangeValidations, 0), outOfBounds: queue.reduce((s, d) => s + d.clinicalChecks.outOfBounds, 0), temporalViolations: queue.reduce((s, d) => s + d.clinicalChecks.temporalViolations, 0) },
        { name: "HITL Review", icon: "user-check", autoApproved, pendingReview, reviewed, rejected: 0 },
      ],
      confidenceThreshold: 95,
    });
  } catch (error) {
    console.error("[ExtractionPipeline] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load pipeline dashboard" });
  }
});

router.get("/queue", (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    let items = generateQueueItems();
    if (status && status !== "all") {
      items = items.filter(d => d.hitlStatus === status);
    }
    res.json({ items, total: items.length });
  } catch (error) {
    console.error("[ExtractionPipeline] Queue error:", error);
    res.status(500).json({ error: "Failed to load queue" });
  }
});

router.get("/conflicts", (_req, res) => {
  try {
    const conflicts = generateConflicts();
    res.json({
      conflicts,
      total: conflicts.length,
      unresolved: conflicts.filter(c => c.resolvedBy === null).length,
      resolvedByHuman: conflicts.filter(c => c.resolvedBy === "human").length,
      bySeverity: {
        critical: conflicts.filter(c => c.severity === "critical").length,
        high: conflicts.filter(c => c.severity === "high").length,
        medium: conflicts.filter(c => c.severity === "medium").length,
        low: conflicts.filter(c => c.severity === "low").length,
      },
    });
  } catch (error) {
    console.error("[ExtractionPipeline] Conflicts error:", error);
    res.status(500).json({ error: "Failed to load conflicts" });
  }
});

router.get("/clinical-ranges", (_req, res) => {
  try {
    res.json({
      ranges: PHYSIOLOGICAL_RANGES,
      totalRanges: Object.keys(PHYSIOLOGICAL_RANGES).length,
      unitConversions: UNIT_CONVERSIONS,
      totalConversions: Object.keys(UNIT_CONVERSIONS).length,
    });
  } catch (error) {
    console.error("[ExtractionPipeline] Clinical ranges error:", error);
    res.status(500).json({ error: "Failed to load clinical ranges" });
  }
});

router.get("/golden-audits", (_req, res) => {
  try {
    const audits = generateGoldenAudits();
    res.json({
      audits,
      totalAudits: audits.length,
      latestCER: audits[0].characterErrorRate,
      latestWER: audits[0].wordErrorRate,
      latestFieldAccuracy: audits[0].fieldAccuracy,
      trend: {
        cer: audits.map(a => ({ date: a.auditDate, value: a.characterErrorRate })).reverse(),
        wer: audits.map(a => ({ date: a.auditDate, value: a.wordErrorRate })).reverse(),
        fieldAccuracy: audits.map(a => ({ date: a.auditDate, value: a.fieldAccuracy })).reverse(),
      },
    });
  } catch (error) {
    console.error("[ExtractionPipeline] Golden audits error:", error);
    res.status(500).json({ error: "Failed to load golden audits" });
  }
});

router.get("/document/:docId", (req, res) => {
  try {
    const { docId } = req.params;
    const items = generateQueueItems();
    const doc = items.find(d => d.id === docId);
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const conflicts = generateConflicts().filter(c => c.documentId === docId);

    const extractedData = {
      patientName: "[REDACTED]",
      dateOfService: "2026-03-28",
      orderingProvider: "Dr. Sarah Chen, MD",
      facility: "Quest Diagnostics Lab",
      fields: [
        { name: "Sodium", value: "141", unit: "mEq/L", range: "136-145", status: "normal", confidence: 99.1 },
        { name: "Potassium", value: doc.id === "doc-002" ? "4.2 / 4.7 (CONFLICT)" : "4.2", unit: "mEq/L", range: "3.5-5.0", status: doc.id === "doc-002" ? "conflict" : "normal", confidence: doc.id === "doc-002" ? 88.5 : 99.2 },
        { name: "Glucose", value: "105", unit: "mg/dL", range: "70-100", status: "high", confidence: 98.8 },
        { name: "BUN", value: "15", unit: "mg/dL", range: "7-20", status: "normal", confidence: 97.5 },
        { name: "Creatinine", value: "0.9", unit: "mg/dL", range: "0.6-1.2", status: "normal", confidence: 99.0 },
        { name: "Hemoglobin", value: "14.2", unit: "g/dL", range: "12.0-17.5", status: "normal", confidence: 99.3 },
        { name: "WBC", value: "7.8", unit: "K/uL", range: "4.5-11.0", status: "normal", confidence: 99.1 },
        { name: "Platelets", value: "245", unit: "K/uL", range: "150-400", status: "normal", confidence: 98.9 },
      ],
    };

    res.json({ document: doc, extractedData, conflicts });
  } catch (error) {
    console.error("[ExtractionPipeline] Document detail error:", error);
    res.status(500).json({ error: "Failed to load document" });
  }
});

export default router;
