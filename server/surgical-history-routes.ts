import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { insertSurgicalHistorySchema, SurgicalHistory, SurgeryComplication, Implant } from "@shared/schema";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    component: "SurgicalHistory",
    details,
  })}`);
}

const commonProcedures = [
  { id: "appendectomy", name: "Appendix Removal (Appendectomy)", category: "abdominal" },
  { id: "cholecystectomy", name: "Gallbladder Removal (Cholecystectomy)", category: "abdominal" },
  { id: "csection", name: "Cesarean Section (C-Section)", category: "obstetric" },
  { id: "hysterectomy", name: "Hysterectomy", category: "gynecologic" },
  { id: "tubal_ligation", name: "Tubal Ligation", category: "gynecologic" },
  { id: "vasectomy", name: "Vasectomy", category: "urologic" },
  { id: "hernia_repair", name: "Hernia Repair", category: "abdominal" },
  { id: "tonsillectomy", name: "Tonsillectomy/Adenoidectomy", category: "ent" },
  { id: "bariatric", name: "Bariatric Surgery (Weight Loss)", category: "bariatric" },
  { id: "hip_replacement", name: "Hip Replacement", category: "orthopedic" },
  { id: "knee_replacement", name: "Knee Replacement", category: "orthopedic" },
  { id: "shoulder_replacement", name: "Shoulder Replacement", category: "orthopedic" },
  { id: "spine_surgery", name: "Spine Surgery", category: "orthopedic" },
  { id: "cardiac_stent", name: "Cardiac Stent Placement", category: "cardiac" },
  { id: "cabg", name: "Coronary Artery Bypass (CABG)", category: "cardiac" },
  { id: "pacemaker", name: "Pacemaker Implantation", category: "cardiac" },
  { id: "icd", name: "Implantable Cardioverter Defibrillator (ICD)", category: "cardiac" },
  { id: "colonoscopy", name: "Colonoscopy", category: "diagnostic" },
  { id: "endoscopy", name: "Endoscopy (EGD)", category: "diagnostic" },
  { id: "cataract", name: "Cataract Surgery", category: "ophthalmic" },
  { id: "lasik", name: "LASIK Eye Surgery", category: "ophthalmic" },
  { id: "rotator_cuff", name: "Rotator Cuff Repair", category: "orthopedic" },
  { id: "acl_repair", name: "ACL Repair", category: "orthopedic" },
  { id: "mastectomy", name: "Mastectomy", category: "oncologic" },
  { id: "lumpectomy", name: "Lumpectomy", category: "oncologic" },
  { id: "thyroidectomy", name: "Thyroidectomy", category: "endocrine" },
  { id: "carpal_tunnel", name: "Carpal Tunnel Release", category: "orthopedic" },
  { id: "other", name: "Other Procedure", category: "other" },
];

const procedureCategories = [
  { id: "abdominal", name: "Abdominal/GI" },
  { id: "cardiac", name: "Cardiac/Heart" },
  { id: "orthopedic", name: "Orthopedic/Bone & Joint" },
  { id: "gynecologic", name: "Gynecologic" },
  { id: "obstetric", name: "Obstetric" },
  { id: "urologic", name: "Urologic" },
  { id: "ent", name: "ENT (Ear, Nose, Throat)" },
  { id: "ophthalmic", name: "Eye Surgery" },
  { id: "bariatric", name: "Weight Loss Surgery" },
  { id: "oncologic", name: "Cancer Surgery" },
  { id: "endocrine", name: "Endocrine" },
  { id: "diagnostic", name: "Diagnostic Procedures" },
  { id: "other", name: "Other" },
];

const surgicalHistoryStore = new Map<string, SurgicalHistory>();

function initializeSampleData(): void {
  const sampleRecords: SurgicalHistory[] = [
    {
      id: "sh-001",
      patientId: "patient-default",
      procedureName: "Appendectomy",
      procedureCode: "44970",
      procedureCodeSystem: "cpt",
      surgeryType: "emergency",
      bodyPart: "Appendix",
      laterality: "not_applicable",
      indication: "Acute appendicitis",
      surgeon: "Dr. Sarah Chen",
      facility: "General Hospital",
      surgeryDate: "2020-06-15",
      duration: 45,
      outcome: "successful",
      complications: [],
      followUpRequired: false,
      implantsUsed: [],
      source: "patient_reported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "sh-002",
      patientId: "patient-default",
      procedureName: "Colonoscopy",
      procedureCode: "45378",
      procedureCodeSystem: "cpt",
      surgeryType: "outpatient",
      bodyPart: "Colon",
      laterality: "not_applicable",
      indication: "Routine screening",
      surgeon: "Dr. Michael Brown",
      facility: "Endoscopy Center",
      surgeryDate: "2023-03-22",
      duration: 30,
      outcome: "successful",
      complications: [],
      findings: "No polyps found. Normal colonoscopy.",
      followUpRequired: true,
      followUpDate: "2033-03-22",
      implantsUsed: [],
      source: "patient_reported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  
  sampleRecords.forEach(record => {
    surgicalHistoryStore.set(record.id, record);
  });
}

initializeSampleData();

router.get("/common-procedures", (_req: Request, res: Response) => {
  res.json({ 
    success: true, 
    data: { 
      procedures: commonProcedures,
      categories: procedureCategories,
    }
  });
});

router.get("/patient/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("VIEW_SURGICAL_HISTORY", { patientId: hashIdentifier(patientId) });
    
    const records = Array.from(surgicalHistoryStore.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.surgeryDate).getTime() - new Date(a.surgeryDate).getTime());
    
    res.json({ success: true, data: records });
  } catch (error) {
    console.error("[SurgicalHistory] Get records error:", error);
    res.status(500).json({ success: false, error: "Failed to get surgical history" });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = surgicalHistoryStore.get(id);
    
    if (!record) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    
    logHipaaAudit("VIEW_SURGICAL_RECORD", { recordId: hashIdentifier(id) });
    res.json({ success: true, data: record });
  } catch (error) {
    console.error("[SurgicalHistory] Get record error:", error);
    res.status(500).json({ success: false, error: "Failed to get record" });
  }
});

const quickAddSchema = z.object({
  patientId: z.string().min(1),
  procedureId: z.string().min(1),
  customName: z.string().optional(),
  year: z.number().min(1900).max(new Date().getFullYear()),
  month: z.number().min(1).max(12).optional(),
  facility: z.string().optional(),
  outcome: z.enum(["successful", "partially_successful", "unsuccessful", "complicated", "unknown"]).default("successful"),
  notes: z.string().optional(),
});

router.post("/quick-add", (req: Request, res: Response) => {
  try {
    const parseResult = quickAddSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const { patientId, procedureId, customName, year, month, facility, outcome, notes } = parseResult.data;
    
    const procedure = commonProcedures.find(p => p.id === procedureId);
    const procedureName = customName || procedure?.name || procedureId;
    
    const surgeryDate = month 
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-01-01`;
    
    const id = `sh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const record: SurgicalHistory = {
      id,
      patientId,
      procedureName,
      surgeryType: procedureId === "colonoscopy" || procedureId === "endoscopy" ? "outpatient" : "elective",
      indication: "Patient reported",
      surgeon: "Not specified",
      facility: facility || "Not specified",
      surgeryDate,
      outcome,
      complications: [],
      followUpRequired: false,
      implantsUsed: [],
      patientNotes: notes,
      source: "patient_reported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    surgicalHistoryStore.set(id, record);
    
    logHipaaAudit("CREATE_SURGICAL_RECORD", { 
      recordId: hashIdentifier(id), 
      patientId: hashIdentifier(patientId),
      procedureType: procedureId,
    });
    
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("[SurgicalHistory] Quick add error:", error);
    res.status(500).json({ success: false, error: "Failed to add record" });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const parseResult = insertSurgicalHistorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const id = `sh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const record: SurgicalHistory = {
      id,
      ...parseResult.data,
      complications: [],
      implantsUsed: [],
      createdAt: now,
      updatedAt: now,
    };
    
    surgicalHistoryStore.set(id, record);
    
    logHipaaAudit("CREATE_SURGICAL_RECORD", { 
      recordId: hashIdentifier(id), 
      patientId: hashIdentifier(record.patientId),
    });
    
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error("[SurgicalHistory] Create error:", error);
    res.status(500).json({ success: false, error: "Failed to create record" });
  }
});

router.patch("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = surgicalHistoryStore.get(id);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    
    const updated: SurgicalHistory = {
      ...existing,
      ...req.body,
      id: existing.id,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    
    surgicalHistoryStore.set(id, updated);
    
    logHipaaAudit("UPDATE_SURGICAL_RECORD", { recordId: hashIdentifier(id) });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[SurgicalHistory] Update error:", error);
    res.status(500).json({ success: false, error: "Failed to update record" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = surgicalHistoryStore.get(id);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    
    surgicalHistoryStore.delete(id);
    
    logHipaaAudit("DELETE_SURGICAL_RECORD", { 
      recordId: hashIdentifier(id),
      patientId: hashIdentifier(existing.patientId),
    });
    
    res.json({ success: true, message: "Record deleted" });
  } catch (error) {
    console.error("[SurgicalHistory] Delete error:", error);
    res.status(500).json({ success: false, error: "Failed to delete record" });
  }
});

router.post("/:id/complications", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = surgicalHistoryStore.get(id);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    
    const complicationSchema = z.object({
      type: z.enum(["intraoperative", "immediate_postop", "delayed", "chronic"]),
      description: z.string().min(1),
      severity: z.enum(["minor", "moderate", "major", "life_threatening"]),
      treatment: z.string().optional(),
      resolved: z.boolean().default(false),
      resolvedDate: z.string().optional(),
      sequelae: z.string().optional(),
    });
    
    const parseResult = complicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const complication: SurgeryComplication = {
      id: `comp-${Date.now()}`,
      ...parseResult.data,
    };
    
    existing.complications.push(complication);
    existing.updatedAt = new Date().toISOString();
    surgicalHistoryStore.set(id, existing);
    
    logHipaaAudit("ADD_SURGICAL_COMPLICATION", { recordId: hashIdentifier(id) });
    res.status(201).json({ success: true, data: complication });
  } catch (error) {
    console.error("[SurgicalHistory] Add complication error:", error);
    res.status(500).json({ success: false, error: "Failed to add complication" });
  }
});

router.post("/:id/implants", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = surgicalHistoryStore.get(id);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    
    const implantSchema = z.object({
      name: z.string().min(1),
      manufacturer: z.string().optional(),
      modelNumber: z.string().optional(),
      serialNumber: z.string().optional(),
      lotNumber: z.string().optional(),
      expirationDate: z.string().optional(),
      implantDate: z.string().min(1),
      location: z.string().min(1),
      status: z.enum(["active", "removed", "replaced", "failed"]).default("active"),
      mriCompatible: z.boolean().optional(),
      notes: z.string().optional(),
    });
    
    const parseResult = implantSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const implant: Implant = {
      id: `implant-${Date.now()}`,
      ...parseResult.data,
    };
    
    existing.implantsUsed.push(implant);
    existing.updatedAt = new Date().toISOString();
    surgicalHistoryStore.set(id, existing);
    
    logHipaaAudit("ADD_SURGICAL_IMPLANT", { recordId: hashIdentifier(id) });
    res.status(201).json({ success: true, data: implant });
  } catch (error) {
    console.error("[SurgicalHistory] Add implant error:", error);
    res.status(500).json({ success: false, error: "Failed to add implant" });
  }
});

router.get("/summary/:patientId", (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("VIEW_SURGICAL_SUMMARY", { patientId: hashIdentifier(patientId) });
    
    const records = Array.from(surgicalHistoryStore.values())
      .filter(r => r.patientId === patientId);
    
    const summary = {
      totalProcedures: records.length,
      majorSurgeries: records.filter(r => r.surgeryType === "major" || r.surgeryType === "emergency").length,
      minorProcedures: records.filter(r => r.surgeryType === "minor" || r.surgeryType === "outpatient").length,
      hasImplants: records.some(r => r.implantsUsed.length > 0),
      activeImplants: records.flatMap(r => r.implantsUsed).filter(i => i.status === "active"),
      complications: records.flatMap(r => r.complications),
      recentProcedures: records
        .sort((a, b) => new Date(b.surgeryDate).getTime() - new Date(a.surgeryDate).getTime())
        .slice(0, 5)
        .map(r => ({ id: r.id, name: r.procedureName, date: r.surgeryDate, outcome: r.outcome })),
      byCategory: procedureCategories.map(cat => ({
        category: cat.name,
        count: records.filter(r => {
          const proc = commonProcedures.find(p => p.name === r.procedureName);
          return proc?.category === cat.id;
        }).length,
      })).filter(c => c.count > 0),
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[SurgicalHistory] Get summary error:", error);
    res.status(500).json({ success: false, error: "Failed to get summary" });
  }
});

export default router;
