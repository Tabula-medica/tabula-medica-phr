import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import {
  emitEvent,
  getExecutionHistory,
  getExecution,
  reviewExecution,
} from "../services/workflow-trigger-service";

const router = Router();

interface EncounterDraft {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate: string;
  primaryDiagnosis: string;
  aiDraftNote: string;
  aiDraftStatus: "GENERATING" | "READY_FOR_REVIEW" | "EDITING" | "APPROVED" | "REJECTED";
  clinicalContext: {
    conditions: Array<{ name: string; status: string }>;
    medications: Array<{ name: string; dosage: string; frequency: string }>;
    recentLabs: Array<{ name: string; value: string; unit: string; date: string; status: string }>;
    vitals: Array<{ type: string; value: string; date: string }>;
    procedures: string[];
    allergies: string[];
  };
  codeSuggestions?: Array<{
    type: string;
    code: string;
    description: string;
    confidence: string;
  }>;
  workflowExecutionId?: string;
  signedBy?: string;
  signedAt?: string;
  signatureHash?: string;
  createdAt: string;
  updatedAt: string;
}

const drafts: Map<string, EncounterDraft> = new Map();

function generateSampleContext(patientId: string) {
  return {
    conditions: [
      { name: "Type 2 Diabetes Mellitus", status: "active" },
      { name: "Essential Hypertension", status: "active" },
      { name: "Community-Acquired Pneumonia", status: "resolved" },
    ],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "BID" },
      { name: "Lisinopril", dosage: "20mg", frequency: "Daily" },
      { name: "Amoxicillin-Clavulanate", dosage: "875mg", frequency: "BID x 7 days" },
      { name: "Atorvastatin", dosage: "40mg", frequency: "QHS" },
    ],
    recentLabs: [
      { name: "HbA1c", value: "7.2", unit: "%", date: "2026-02-20", status: "borderline" },
      { name: "Fasting Glucose", value: "142", unit: "mg/dL", date: "2026-02-21", status: "abnormal" },
      { name: "WBC", value: "8.2", unit: "K/uL", date: "2026-02-21", status: "normal" },
      { name: "Creatinine", value: "1.1", unit: "mg/dL", date: "2026-02-21", status: "normal" },
      { name: "BNP", value: "85", unit: "pg/mL", date: "2026-02-20", status: "normal" },
      { name: "Potassium", value: "4.1", unit: "mEq/L", date: "2026-02-21", status: "normal" },
      { name: "Blood Pressure", value: "128/82", unit: "mmHg", date: "2026-02-22", status: "borderline" },
    ],
    vitals: [
      { type: "Blood Pressure", value: "128/82 mmHg", date: "2026-02-22" },
      { type: "Heart Rate", value: "76 bpm", date: "2026-02-22" },
      { type: "Temperature", value: "98.4°F", date: "2026-02-22" },
      { type: "SpO2", value: "97%", date: "2026-02-22" },
      { type: "Respiratory Rate", value: "16/min", date: "2026-02-22" },
      { type: "Weight", value: "187 lbs", date: "2026-02-22" },
    ],
    procedures: ["Chest X-Ray (2/19)", "Blood Cultures x2 (2/19)", "IV Antibiotic Therapy (2/19-2/21)"],
    allergies: ["Penicillin (rash)", "Sulfa drugs (hives)"],
  };
}

function generateSampleDraft(encounterId: string, patientId: string): EncounterDraft {
  const context = generateSampleContext(patientId);
  return {
    id: `draft-${encounterId}`,
    encounterId,
    patientId,
    patientName: "Sample Patient",
    admissionDate: "2026-02-19",
    dischargeDate: "2026-02-22",
    primaryDiagnosis: "Community-Acquired Pneumonia (J18.9)",
    aiDraftNote: `DISCHARGE SUMMARY

Patient: [Name Redacted for PHI Compliance]
Admission Date: February 19, 2026
Discharge Date: February 22, 2026
Attending Physician: Dr. Sarah Mitchell, Internal Medicine

PRIMARY DIAGNOSIS
Community-Acquired Pneumonia (ICD-10: J18.9)

SECONDARY DIAGNOSES
- Type 2 Diabetes Mellitus (E11.65) — with hyperglycemia noted on admission
- Essential Hypertension (I10)

REASON FOR ADMISSION
Patient presented to the ED with a 3-day history of productive cough with yellow-green sputum, fever (101.8°F), and progressive dyspnea on exertion. Chest X-ray revealed right lower lobe consolidation consistent with pneumonia.

HOSPITAL COURSE
Day 1 (2/19): Admitted from ED. Blood cultures drawn. Started on IV ceftriaxone 1g q24h and azithromycin 500mg IV. IV fluid resuscitation initiated. Glucose on admission elevated at 226 mg/dL; sliding scale insulin initiated alongside home metformin.

Day 2 (2/20): Temperature trending down to 99.8°F. O2 requirements weaning — room air SpO2 94%. Blood cultures no growth at 24 hours. HbA1c resulted at 7.2%. Continued IV antibiotics. Adjusted sliding scale.

Day 3 (2/21): Afebrile x24 hours. WBC normalized at 8.2 K/uL. Transitioned to oral amoxicillin-clavulanate 875mg BID. Tolerating regular diet. Ambulating independently.

Day 4 (2/22): Clinically stable for discharge. SpO2 97% on room air. BP 128/82, well-controlled on home lisinopril.

CONDITION AT DISCHARGE
Stable. Ambulatory. Afebrile. O2 saturation 97% on room air.

MEDICATIONS AT DISCHARGE
1. Metformin 1000mg PO BID (continued)
2. Lisinopril 20mg PO daily (continued)
3. Atorvastatin 40mg PO QHS (continued)
4. Amoxicillin-Clavulanate 875mg PO BID x 7 days (new — complete antibiotic course)

MEDICATION CHANGES EXPLAINED
- Added Amoxicillin-Clavulanate: To complete antibiotic treatment for pneumonia after transition from IV therapy. Note: Patient has documented penicillin allergy (rash only); risk-benefit discussed — amoxicillin-clavulanate selected given mild penicillin allergy history with physician supervision.

FOLLOW-UP APPOINTMENTS
- PCP Dr. Sarah Mitchell — 1 week (by 3/1/2026)
- Endocrinology consult — 2 weeks for diabetes optimization (HbA1c 7.2%)
- Repeat chest X-ray — 6 weeks to confirm resolution

WARNING SIGNS — RETURN TO ED IF:
- Fever returning above 101°F
- Worsening shortness of breath or chest pain
- Coughing up blood
- Inability to keep food or medications down

PATIENT EDUCATION PROVIDED
- Pneumonia recovery expectations (fatigue may persist 2-4 weeks)
- Importance of completing full antibiotic course
- Diabetes dietary counseling reinforced
- Daily blood pressure monitoring at home

---
IMPORTANT: This is an AI-generated draft summary for clinician review. All clinical data points, medication dosages, and follow-up dates must be verified by the signing physician before finalization. This document does NOT constitute medical advice or clinical decision support (NO-CDS compliant).`,
    aiDraftStatus: "READY_FOR_REVIEW",
    clinicalContext: context,
    codeSuggestions: [
      { type: "ICD-10", code: "J18.9", description: "Pneumonia, unspecified organism", confidence: "high" },
      { type: "ICD-10", code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia", confidence: "high" },
      { type: "ICD-10", code: "I10", description: "Essential (primary) hypertension", confidence: "high" },
      { type: "CPT", code: "99239", description: "Hospital discharge, >30 min", confidence: "medium" },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const sampleDraft = generateSampleDraft("enc-sample-001", "patient-001");
drafts.set(sampleDraft.encounterId, sampleDraft);

router.get("/encounters/:encounterId/ai-draft", (req: Request, res: Response) => {
  const { encounterId } = req.params;
  let draft = drafts.get(encounterId);

  if (!draft) {
    draft = generateSampleDraft(encounterId, req.query.patientId as string || "patient-001");
    drafts.set(encounterId, draft);
  }

  console.log(`[HIPAA-AUDIT][DischargeReview] Draft accessed for encounter: ${encounterId}`);

  res.json(draft);
});

router.get("/encounters/:encounterId/clinical-context", (req: Request, res: Response) => {
  const { encounterId } = req.params;
  const draft = drafts.get(encounterId);

  if (!draft) {
    return res.status(404).json({ error: "No draft found for this encounter" });
  }

  console.log(`[HIPAA-AUDIT][DischargeReview] Clinical context accessed for encounter: ${encounterId}`);

  res.json({ clinicalContext: draft.clinicalContext });
});

const approveSchema = z.object({
  finalizedNote: z.string().min(1),
  signedBy: z.string().min(1),
});

router.post("/encounters/:encounterId/approve-note", async (req: Request, res: Response) => {
  const { encounterId } = req.params;
  const parsed = approveSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid approval data", details: parsed.error.issues });
  }

  const draft = drafts.get(encounterId);
  if (!draft) {
    return res.status(404).json({ error: "No draft found for this encounter" });
  }

  if (draft.aiDraftStatus === "APPROVED") {
    return res.status(400).json({ error: "Draft already approved" });
  }

  const crypto = await import("crypto");
  const signatureHash = crypto
    .createHash("sha256")
    .update(`${parsed.data.signedBy}:${parsed.data.finalizedNote}:${new Date().toISOString()}`)
    .digest("hex");

  draft.aiDraftNote = parsed.data.finalizedNote;
  draft.aiDraftStatus = "APPROVED";
  draft.signedBy = parsed.data.signedBy;
  draft.signedAt = new Date().toISOString();
  draft.signatureHash = signatureHash;
  draft.updatedAt = new Date().toISOString();

  console.log(`[HIPAA-AUDIT][DischargeReview] Note APPROVED and SIGNED for encounter: ${encounterId} by: ${parsed.data.signedBy}, hash: ${signatureHash}`);

  try {
    await emitEvent("discharge.initiated", {
      patientId: draft.patientId,
      encounterId,
      providerId: parsed.data.signedBy,
      contextData: {
        patientName: draft.patientName,
        admissionDate: draft.admissionDate,
        dischargeDate: draft.dischargeDate,
        primaryDiagnosis: draft.primaryDiagnosis,
      },
    });
  } catch (err) {
    console.error("[DischargeReview] Workflow trigger error (non-blocking):", err);
  }

  res.json({
    success: true,
    draft,
    signatureHash,
    message: "Discharge summary approved and signed. Patient-friendly version will be generated automatically.",
  });
});

const saveDraftSchema = z.object({
  draftNote: z.string().min(1),
});

router.put("/encounters/:encounterId/save-draft", (req: Request, res: Response) => {
  const { encounterId } = req.params;
  const parsed = saveDraftSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid draft data" });
  }

  const draft = drafts.get(encounterId);
  if (!draft) {
    return res.status(404).json({ error: "No draft found for this encounter" });
  }

  if (draft.aiDraftStatus === "APPROVED") {
    return res.status(400).json({ error: "Cannot edit an approved note" });
  }

  draft.aiDraftNote = parsed.data.draftNote;
  draft.aiDraftStatus = "EDITING";
  draft.updatedAt = new Date().toISOString();

  console.log(`[HIPAA-AUDIT][DischargeReview] Draft saved (editing) for encounter: ${encounterId}`);

  res.json({ success: true, draft });
});

router.post("/encounters/:encounterId/reject-note", (req: Request, res: Response) => {
  const { encounterId } = req.params;
  const draft = drafts.get(encounterId);

  if (!draft) {
    return res.status(404).json({ error: "No draft found for this encounter" });
  }

  draft.aiDraftStatus = "REJECTED";
  draft.updatedAt = new Date().toISOString();

  console.log(`[HIPAA-AUDIT][DischargeReview] Draft REJECTED for encounter: ${encounterId}`);

  res.json({ success: true, draft });
});

router.get("/drafts", (_req: Request, res: Response) => {
  const allDrafts = Array.from(drafts.values()).map(d => ({
    id: d.id,
    encounterId: d.encounterId,
    patientId: d.patientId,
    patientName: d.patientName,
    primaryDiagnosis: d.primaryDiagnosis,
    aiDraftStatus: d.aiDraftStatus,
    admissionDate: d.admissionDate,
    dischargeDate: d.dischargeDate,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
  res.json({ drafts: allDrafts });
});

export default router;
