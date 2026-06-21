import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";

const router = Router();

const SYSTEM_USER_ID = "user-123";

interface GrowthRecord {
  id: string;
  profileId: string;
  date: string;
  heightCm: number;
  weightKg: number;
  headCircumferenceCm?: number;
  bmi?: number;
  percentileHeight?: number;
  percentileWeight?: number;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

interface VaccineRecord {
  id: string;
  profileId: string;
  vaccineName: string;
  vaccineCode?: string;
  doseNumber: number;
  administeredDate: string;
  administeredBy?: string;
  lotNumber?: string;
  site?: string;
  nextDoseDate?: string;
  notes?: string;
  createdAt: string;
}

interface SchoolForm {
  id: string;
  profileId: string;
  formType: "physical" | "emergency_contact" | "medication_authorization" | "immunization_record" | "sports_clearance";
  schoolYear: string;
  completedDate?: string;
  expirationDate?: string;
  documentUrl?: string;
  status: "pending" | "completed" | "expired";
  notes?: string;
  createdAt: string;
}

interface SickVisitSummary {
  id: string;
  profileId: string;
  visitDate: string;
  visitType: "er" | "urgent_care" | "pediatrics" | "specialist";
  chiefComplaint: string;
  diagnosis?: string;
  treatmentPlan?: string;
  medications?: string[];
  followUp?: string;
  providerName: string;
  facilityName?: string;
  notes?: string;
  createdAt: string;
}

interface MedicationDosingNote {
  id: string;
  profileId: string;
  medicationName: string;
  dose: string;
  frequency: string;
  instructions: string;
  prescribedDate: string;
  prescribedBy: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

interface PediatricPacket {
  id: string;
  profileId: string;
  packetType: "school_camp" | "new_pediatrician" | "specialist_referral";
  generatedAt: string;
  expiresAt?: string;
  contents: {
    allergies: Array<{ name: string; severity: string }>;
    medications: Array<{ name: string; dose: string; frequency: string }>;
    problemList: string[];
    vaccineStatus: Array<{ name: string; date: string; upToDate: boolean }>;
    lastVisitSummary?: string;
    emergencyContacts: Array<{ name: string; phone: string; relationship: string }>;
  };
  downloadUrl?: string;
}

interface DocumentCapture {
  id: string;
  profileId: string;
  captureType: "discharge_papers" | "medication_label" | "immunization_card" | "school_form";
  autoCategory?: "er" | "urgent_care" | "pediatrics" | "imaging" | "labs";
  capturedAt: string;
  imageUrl?: string;
  extractedText?: string;
  processedData?: Record<string, unknown>;
  status: "pending" | "processed" | "failed";
  createdAt: string;
}

const growthRecords: Map<string, GrowthRecord> = new Map();
const vaccineRecords: Map<string, VaccineRecord> = new Map();
const schoolForms: Map<string, SchoolForm> = new Map();
const sickVisitSummaries: Map<string, SickVisitSummary> = new Map();
const medicationDosingNotes: Map<string, MedicationDosingNote> = new Map();
const pediatricPackets: Map<string, PediatricPacket> = new Map();
const documentCaptures: Map<string, DocumentCapture> = new Map();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

function initializeSampleData() {
  if (growthRecords.size > 0) return;

  const now = new Date().toISOString();
  const childProfileId = "profile-child-001";

  const sampleGrowth: GrowthRecord = {
    id: generateId("growth"),
    profileId: childProfileId,
    date: "2026-01-10",
    heightCm: 110,
    weightKg: 18.5,
    bmi: 15.3,
    percentileHeight: 50,
    percentileWeight: 45,
    recordedBy: "Dr. Martinez",
    createdAt: now,
  };
  growthRecords.set(sampleGrowth.id, sampleGrowth);

  const vaccines = [
    { name: "DTaP", code: "20", doseNumber: 5, date: "2025-09-15" },
    { name: "MMR", code: "03", doseNumber: 2, date: "2025-09-15" },
    { name: "Flu Shot", code: "141", doseNumber: 1, date: "2025-10-05" },
  ];
  vaccines.forEach((v) => {
    const record: VaccineRecord = {
      id: generateId("vaccine"),
      profileId: childProfileId,
      vaccineName: v.name,
      vaccineCode: v.code,
      doseNumber: v.doseNumber,
      administeredDate: v.date,
      administeredBy: "Dr. Chen",
      createdAt: now,
    };
    vaccineRecords.set(record.id, record);
  });

  const sampleMedDosing: MedicationDosingNote = {
    id: generateId("meddose"),
    profileId: childProfileId,
    medicationName: "Children's Ibuprofen",
    dose: "100mg (5mL)",
    frequency: "Every 6-8 hours as needed",
    instructions: "For fever over 101°F or pain. Do not exceed 4 doses in 24 hours.",
    prescribedDate: "2026-01-10",
    prescribedBy: "Dr. Martinez",
    isActive: true,
    createdAt: now,
  };
  medicationDosingNotes.set(sampleMedDosing.id, sampleMedDosing);

  console.log("[Pediatric] Sample data initialized");
}

initializeSampleData();

router.get("/:profileId/growth", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const records = Array.from(growthRecords.values())
      .filter(r => r.profileId === profileId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(records);
  } catch (error) {
    console.error("[Pediatric] Error fetching growth records:", error);
    res.status(500).json({ error: "Failed to fetch growth records" });
  }
});

const insertGrowthSchema = z.object({
  date: z.string(),
  heightCm: z.number().positive(),
  weightKg: z.number().positive(),
  headCircumferenceCm: z.number().positive().optional(),
  notes: z.string().optional(),
});

router.post("/:profileId/growth", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const validated = insertGrowthSchema.parse(req.body);
    
    const bmi = validated.weightKg / Math.pow(validated.heightCm / 100, 2);
    
    const record: GrowthRecord = {
      id: generateId("growth"),
      profileId,
      ...validated,
      bmi: Math.round(bmi * 10) / 10,
      recordedBy: "Parent",
      createdAt: new Date().toISOString(),
    };
    
    growthRecords.set(record.id, record);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid growth data", details: error.errors });
    }
    console.error("[Pediatric] Error adding growth record:", error);
    res.status(500).json({ error: "Failed to add growth record" });
  }
});

router.get("/:profileId/vaccines", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const records = Array.from(vaccineRecords.values())
      .filter(r => r.profileId === profileId)
      .sort((a, b) => new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime());
    res.json(records);
  } catch (error) {
    console.error("[Pediatric] Error fetching vaccine records:", error);
    res.status(500).json({ error: "Failed to fetch vaccine records" });
  }
});

router.get("/:profileId/school-forms", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const forms = Array.from(schoolForms.values())
      .filter(f => f.profileId === profileId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(forms);
  } catch (error) {
    console.error("[Pediatric] Error fetching school forms:", error);
    res.status(500).json({ error: "Failed to fetch school forms" });
  }
});

router.get("/:profileId/sick-visits", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const visits = Array.from(sickVisitSummaries.values())
      .filter(v => v.profileId === profileId)
      .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    res.json(visits);
  } catch (error) {
    console.error("[Pediatric] Error fetching sick visit summaries:", error);
    res.status(500).json({ error: "Failed to fetch sick visit summaries" });
  }
});

router.get("/:profileId/medication-dosing", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const notes = Array.from(medicationDosingNotes.values())
      .filter(n => n.profileId === profileId && n.isActive)
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
    res.json(notes);
  } catch (error) {
    console.error("[Pediatric] Error fetching medication dosing notes:", error);
    res.status(500).json({ error: "Failed to fetch medication dosing notes" });
  }
});

const insertMedDosingSchema = z.object({
  medicationName: z.string().min(1),
  dose: z.string().min(1),
  frequency: z.string().min(1),
  instructions: z.string().min(1),
  prescribedBy: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/:profileId/medication-dosing", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const validated = insertMedDosingSchema.parse(req.body);
    
    const note: MedicationDosingNote = {
      id: generateId("meddose"),
      profileId,
      ...validated,
      prescribedDate: new Date().toISOString().split("T")[0],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    
    medicationDosingNotes.set(note.id, note);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid medication dosing data", details: error.errors });
    }
    console.error("[Pediatric] Error adding medication dosing note:", error);
    res.status(500).json({ error: "Failed to add medication dosing note" });
  }
});

const generatePacketSchema = z.object({
  packetType: z.enum(["school_camp", "new_pediatrician", "specialist_referral"]),
});

router.post("/:profileId/packets/generate", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const validated = generatePacketSchema.parse(req.body);
    
    const allergies = [
      { name: "Peanuts", severity: "severe" },
      { name: "Bee stings", severity: "moderate" },
    ];
    
    const medications = Array.from(medicationDosingNotes.values())
      .filter(n => n.profileId === profileId && n.isActive)
      .map(n => ({ name: n.medicationName, dose: n.dose, frequency: n.frequency }));
    
    const vaccines = Array.from(vaccineRecords.values())
      .filter(v => v.profileId === profileId)
      .map(v => ({
        name: v.vaccineName,
        date: v.administeredDate,
        upToDate: true,
      }));
    
    const packet: PediatricPacket = {
      id: generateId("packet"),
      profileId,
      packetType: validated.packetType,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      contents: {
        allergies,
        medications,
        problemList: ["Asthma (well-controlled)", "Seasonal allergies"],
        vaccineStatus: vaccines,
        lastVisitSummary: "Well-child checkup on January 10, 2026. Growth and development on track.",
        emergencyContacts: [
          { name: "Sarah Johnson", phone: "(555) 123-4567", relationship: "Mother" },
          { name: "Michael Johnson", phone: "(555) 234-5678", relationship: "Father" },
        ],
      },
    };
    
    pediatricPackets.set(packet.id, packet);
    
    console.log(`[Pediatric] Generated ${validated.packetType} packet for profile ${profileId}`);
    res.status(201).json(packet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid packet type", details: error.errors });
    }
    console.error("[Pediatric] Error generating packet:", error);
    res.status(500).json({ error: "Failed to generate packet" });
  }
});

router.get("/:profileId/packets", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const packets = Array.from(pediatricPackets.values())
      .filter(p => p.profileId === profileId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    res.json(packets);
  } catch (error) {
    console.error("[Pediatric] Error fetching packets:", error);
    res.status(500).json({ error: "Failed to fetch packets" });
  }
});

const documentCaptureSchema = z.object({
  captureType: z.enum(["discharge_papers", "medication_label", "immunization_card", "school_form"]),
  imageData: z.string().optional(),
});

router.post("/:profileId/document-capture", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const validated = documentCaptureSchema.parse(req.body);
    
    const autoCategories: Record<string, "er" | "urgent_care" | "pediatrics" | "imaging" | "labs"> = {
      discharge_papers: "pediatrics",
      medication_label: "pediatrics",
      immunization_card: "pediatrics",
      school_form: "pediatrics",
    };
    
    const capture: DocumentCapture = {
      id: generateId("capture"),
      profileId,
      captureType: validated.captureType,
      autoCategory: autoCategories[validated.captureType],
      capturedAt: new Date().toISOString(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    
    documentCaptures.set(capture.id, capture);
    
    setTimeout(() => {
      const updated = documentCaptures.get(capture.id);
      if (updated) {
        updated.status = "processed";
        updated.extractedText = "Sample extracted text from document";
        documentCaptures.set(capture.id, updated);
      }
    }, 2000);
    
    console.log(`[Pediatric] Document capture initiated: ${validated.captureType} for profile ${profileId}`);
    res.status(201).json(capture);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid document capture data", details: error.errors });
    }
    console.error("[Pediatric] Error processing document capture:", error);
    res.status(500).json({ error: "Failed to process document capture" });
  }
});

router.get("/:profileId/document-captures", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const captures = Array.from(documentCaptures.values())
      .filter(c => c.profileId === profileId)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
    res.json(captures);
  } catch (error) {
    console.error("[Pediatric] Error fetching document captures:", error);
    res.status(500).json({ error: "Failed to fetch document captures" });
  }
});

router.get("/:profileId/summary", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    
    const growth = Array.from(growthRecords.values())
      .filter(r => r.profileId === profileId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    
    const vaccines = Array.from(vaccineRecords.values())
      .filter(v => v.profileId === profileId);
    
    const activeVaccines = ["DTaP", "MMR", "Polio", "Hib", "HepB", "Varicella", "Flu"];
    const completedVaccines = new Set(vaccines.map(v => v.vaccineName));
    const dueVaccines = activeVaccines.filter(v => !completedVaccines.has(v));
    
    const activeMeds = Array.from(medicationDosingNotes.values())
      .filter(n => n.profileId === profileId && n.isActive);
    
    res.json({
      latestGrowth: growth || null,
      vaccineCount: vaccines.length,
      vaccinesDue: dueVaccines,
      activeMedicationsCount: activeMeds.length,
      recentPackets: Array.from(pediatricPackets.values())
        .filter(p => p.profileId === profileId)
        .slice(0, 3),
    });
  } catch (error) {
    console.error("[Pediatric] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

export default router;

export function registerPediatricRoutes(app: any) {
  app.use("/api/pediatric", router);
  console.log("[Routes] Pediatric routes registered at /api/pediatric/*");
}
