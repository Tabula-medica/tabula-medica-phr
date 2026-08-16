import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  generateFollowUpSuggestions,
  generateClinicalDraft,
  generateSmartAlerts,
  PatientContext,
} from "./services/ai-clinical-workflow-enhancements-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

function auditLog(req: Request, action: string, patientId: string, details: string) {
  logPhiAccess({
    userId: getUserId(req),
    action: "read",
    resourceType: "Patient",
    patientId,
    details: `AI Clinical Workflow Enhancement: ${action} - ${details} - NO-CDS compliant`,
  });
}

async function buildPatientContext(patientId: string): Promise<PatientContext | null> {
  const patient = await storage.getPatient(patientId);
  if (!patient) return null;

  const [medications, allergies, labResults, vitals] = await Promise.all([
    storage.getMedicationsByPatient(patientId),
    storage.getAllergiesByPatient(patientId),
    storage.getLabResultsByPatient(patientId),
    storage.getVitalsByPatient(patientId),
  ]);

  const conditions = (patient as any).conditions || [];
  const dob = (patient as any).dateOfBirth || (patient as any).dob;
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000)) : undefined;

  return {
    patientId,
    name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Patient",
    age,
    gender: patient.gender,
    conditions: Array.isArray(conditions)
      ? conditions.map((c: any) => ({
          name: c.name || c.condition || c.display || "",
          status: c.status || "active",
          onsetDate: c.onsetDate || c.onset,
        }))
      : [],
    medications: medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      status: m.status,
    })),
    allergies: allergies.map((a) => ({
      name: a.name,
      severity: a.severity,
      reaction: a.reaction,
    })),
    labResults: labResults
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 15)
      .map((l) => ({
        testName: l.testName,
        value: String(l.value),
        unit: l.unit,
        referenceRange: l.referenceRange,
        date: l.date,
        isCritical: l.status === "critical",
      })),
    vitals: vitals
      .sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime())
      .slice(0, 15)
      .map((v) => ({
        type: v.type,
        value: Number(v.value),
        unit: v.unit || "",
        date: v.recordedAt,
      })),
  };
}

router.post("/suggestions/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    auditLog(req, "follow-up-suggestions", patientId, "Generating AI follow-up task suggestions");

    const ctx = await buildPatientContext(patientId);
    if (!ctx) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const result = await generateFollowUpSuggestions(ctx);
    res.json(result);
  } catch (error: any) {
    console.error("[ClinicalWorkflowEnhancements] Suggestions error:", error.message);
    res.status(500).json({ error: "Failed to generate follow-up suggestions" });
  }
});

router.post("/drafts/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { type, additionalInstructions } = req.body;

    if (!type || !["clinical_note", "referral_letter"].includes(type)) {
      return res.status(400).json({ error: "Invalid draft type. Use 'clinical_note' or 'referral_letter'" });
    }

    auditLog(req, "draft-generation", patientId, `Generating ${type} draft`);

    const ctx = await buildPatientContext(patientId);
    if (!ctx) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const result = await generateClinicalDraft(ctx, type, additionalInstructions);
    res.json(result);
  } catch (error: any) {
    console.error("[ClinicalWorkflowEnhancements] Draft error:", error.message);
    res.status(500).json({ error: "Failed to generate clinical draft" });
  }
});

router.post("/alerts/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    auditLog(req, "smart-alerts", patientId, "Generating smart clinical alerts");

    const ctx = await buildPatientContext(patientId);
    if (!ctx) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const result = await generateSmartAlerts(ctx);
    res.json(result);
  } catch (error: any) {
    console.error("[ClinicalWorkflowEnhancements] Alerts error:", error.message);
    res.status(500).json({ error: "Failed to generate smart alerts" });
  }
});

router.get("/patients", async (req: Request, res: Response) => {
  try {
    const patients = await storage.getPatients(20);
    const list = patients.map(p => ({
      id: p.id,
      name: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown",
    }));
    auditLog(req, "list_patients", "all", `Listed ${list.length} patients for workflow enhancements`);
    res.json({ patients: list });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to list patients" });
  }
});

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "AI Clinical Workflow Enhancements",
    version: "1.0.0",
    features: [
      "AI Follow-up Task Suggestions",
      "Draft Clinical Notes (SOAP format)",
      "Draft Referral Letters",
      "Smart Alerts for Critical Changes",
    ],
    compliance: "NO-CDS (informational only)",
    model: "GPT-4o-mini with rule-based fallback",
  });
});

export default router;
