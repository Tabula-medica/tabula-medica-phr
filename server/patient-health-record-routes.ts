import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import {
  medicationsTable,
  allergiesTable,
  surgeriesTable,
  medicalHistoryTable,
  socialHistoryTable,
  vaccinesTable,
  sdohTable,
  profiles,
  accounts,
} from "@shared/schema";
import OpenAI from "openai";
import { logger } from "./lib/logger";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { noStorePhi } from "./lib/middleware/no-store-phi";

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  // Spread `details` so PHI fields (patientId, profileId, userId, etc.) become
  // top-level keys eligible for pino redact() — they cannot be redacted when
  // they are buried inside JSON.stringify() in a string interpolation.
  logger.info({ component: "PHR", audit: "HIPAA", action, ...details }, "PHI access");
}

async function getProfileId(req: Request): Promise<string | null> {
  const sessionUserId = (req.session as any)?.userId || (req.user as any)?.id || (req.user as any)?.claims?.sub;
  if (!sessionUserId) return null;

  const profileRows = await phiDb
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, sessionUserId))
    .limit(1);

  return profileRows.length > 0 ? profileRows[0].id : null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId || (req.user as any)?.id || (req.user as any)?.claims?.sub;
  const hasCookie = !!(req.headers.cookie);
  const isSameOrigin = !!(req.headers.referer || req.headers.origin);

  if (sessionUserId || hasCookie || isSameOrigin) {
    next();
  } else {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path, method: req.method });
    return res.status(401).json({ error: "Authentication required" });
  }
}

// Order matters: noStorePhi sets headers on every response (including 401 from
// requireAuth) so even error replies that may echo path/method context cannot
// be cached by browsers, proxies, or the service worker.
router.use(noStorePhi);
router.use(requireAuth);

const addMedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  status: z.string().default("active"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const addAllergySchema = z.object({
  allergen: z.string().min(1, "Allergen is required"),
  reaction: z.string().optional().nullable(),
  severity: z.string().optional().nullable(),
  status: z.string().default("active"),
  onsetDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const addSurgerySchema = z.object({
  procedureName: z.string().min(1, "Procedure name is required"),
  surgeryDate: z.string().optional().nullable(),
  surgeon: z.string().optional().nullable(),
  facility: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const addMedicalHistorySchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  diagnosedDate: z.string().optional().nullable(),
  status: z.string().default("active"),
  treatedBy: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const addSocialHistorySchema = z.object({
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  status: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const addVaccineSchema = z.object({
  vaccineName: z.string().min(1, "Vaccine name is required"),
  dateAdministered: z.string().optional().nullable(),
  provider: z.string().optional().nullable(),
  lotNumber: z.string().optional().nullable(),
  site: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const addSdohSchema = z.object({
  domain: z.string().min(1, "Domain is required"),
  question: z.string().optional().nullable(),
  response: z.string().min(1, "Response is required"),
  screeningDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get("/medications", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_MEDICATIONS", { profileId });
    const rawRows = await phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId)).orderBy(desc(medicationsTable.createdAt));
    const rows = decryptPhiRows("medicationsTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "medications",
      name: r.name,
      details: [r.dose, r.frequency].filter(Boolean).join(" - ") || "",
      date: r.startDate || r.createdAt.toISOString().split("T")[0],
      status: r.status || "active",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_medications" }, "error fetching medications");
    res.status(500).json({ error: "Failed to fetch medications" });
  }
});

router.post("/medications", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addMedicationSchema.parse(req.body);
    logHipaaAudit("ADD_MEDICATION", { profileId, name: parsed.name });
    const [rawRow] = await phiDb.insert(medicationsTable).values(encryptPhiRow("medicationsTable", {
      profileId,
      name: parsed.name,
      dose: parsed.dose || null,
      frequency: parsed.frequency || null,
      status: parsed.status,
      startDate: parsed.startDate || null,
      endDate: parsed.endDate || null,
    })).returning();
    const row = decryptPhiRow("medicationsTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_medication" }, "error adding medication");
    res.status(500).json({ error: "Failed to add medication" });
  }
});

router.get("/allergies", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_ALLERGIES", { profileId });
    const rawRows = await phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)).orderBy(desc(allergiesTable.createdAt));
    const rows = decryptPhiRows("allergiesTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "allergies",
      name: r.allergen,
      details: [r.reaction, r.severity ? `Severity: ${r.severity}` : null, r.notes].filter(Boolean).join(" - ") || "",
      date: r.onsetDate || r.createdAt.toISOString().split("T")[0],
      status: r.status || "active",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_allergies" }, "error fetching allergies");
    res.status(500).json({ error: "Failed to fetch allergies" });
  }
});

router.post("/allergies", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addAllergySchema.parse(req.body);
    logHipaaAudit("ADD_ALLERGY", { profileId, allergen: parsed.allergen });
    const [rawRow] = await phiDb.insert(allergiesTable).values(encryptPhiRow("allergiesTable", {
      profileId,
      allergen: parsed.allergen,
      reaction: parsed.reaction || null,
      severity: parsed.severity || null,
      status: parsed.status,
      onsetDate: parsed.onsetDate || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("allergiesTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_allergy" }, "error adding allergy");
    res.status(500).json({ error: "Failed to add allergy" });
  }
});

router.get("/surgeries", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_SURGERIES", { profileId });
    const rawRows = await phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)).orderBy(desc(surgeriesTable.createdAt));
    const rows = decryptPhiRows("surgeriesTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "surgeries",
      name: r.procedureName,
      details: [r.surgeon ? `Surgeon: ${r.surgeon}` : null, r.facility, r.outcome, r.notes].filter(Boolean).join(" - ") || "",
      date: r.surgeryDate || r.createdAt.toISOString().split("T")[0],
      status: "completed",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_surgeries" }, "error fetching surgeries");
    res.status(500).json({ error: "Failed to fetch surgeries" });
  }
});

router.post("/surgeries", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addSurgerySchema.parse(req.body);
    logHipaaAudit("ADD_SURGERY", { profileId, procedure: parsed.procedureName });
    const [rawRow] = await phiDb.insert(surgeriesTable).values(encryptPhiRow("surgeriesTable", {
      profileId,
      procedureName: parsed.procedureName,
      surgeryDate: parsed.surgeryDate || null,
      surgeon: parsed.surgeon || null,
      facility: parsed.facility || null,
      outcome: parsed.outcome || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("surgeriesTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_surgery" }, "error adding surgery");
    res.status(500).json({ error: "Failed to add surgery" });
  }
});

router.get("/medical-history", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_MEDICAL_HISTORY", { profileId });
    const rawRows = await phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)).orderBy(desc(medicalHistoryTable.createdAt));
    const rows = decryptPhiRows("medicalHistoryTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "medical_history",
      name: r.condition,
      details: [r.treatedBy ? `Treated by: ${r.treatedBy}` : null, r.notes].filter(Boolean).join(" - ") || "",
      date: r.diagnosedDate || r.createdAt.toISOString().split("T")[0],
      status: r.status || "active",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_medical_history" }, "error fetching medical history");
    res.status(500).json({ error: "Failed to fetch medical history" });
  }
});

router.post("/medical-history", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addMedicalHistorySchema.parse(req.body);
    logHipaaAudit("ADD_MEDICAL_HISTORY", { profileId, condition: parsed.condition });
    const [rawRow] = await phiDb.insert(medicalHistoryTable).values(encryptPhiRow("medicalHistoryTable", {
      profileId,
      condition: parsed.condition,
      diagnosedDate: parsed.diagnosedDate || null,
      status: parsed.status,
      treatedBy: parsed.treatedBy || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("medicalHistoryTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_medical_history" }, "error adding medical history");
    res.status(500).json({ error: "Failed to add medical history" });
  }
});

router.get("/social-history", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_SOCIAL_HISTORY", { profileId });
    const rawRows = await phiDb.select().from(socialHistoryTable).where(eq(socialHistoryTable.profileId, profileId)).orderBy(desc(socialHistoryTable.createdAt));
    const rows = decryptPhiRows("socialHistoryTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "social_history",
      name: r.category,
      details: [r.description, r.notes].filter(Boolean).join(" - ") || "",
      date: r.startDate || r.createdAt.toISOString().split("T")[0],
      status: r.status || "current",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_social_history" }, "error fetching social history");
    res.status(500).json({ error: "Failed to fetch social history" });
  }
});

router.post("/social-history", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addSocialHistorySchema.parse(req.body);
    logHipaaAudit("ADD_SOCIAL_HISTORY", { profileId, category: parsed.category });
    const [rawRow] = await phiDb.insert(socialHistoryTable).values(encryptPhiRow("socialHistoryTable", {
      profileId,
      category: parsed.category,
      description: parsed.description,
      status: parsed.status || null,
      startDate: parsed.startDate || null,
      endDate: parsed.endDate || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("socialHistoryTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_social_history" }, "error adding social history");
    res.status(500).json({ error: "Failed to add social history" });
  }
});

router.get("/vaccines", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_VACCINES", { profileId });
    const rawRows = await phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)).orderBy(desc(vaccinesTable.createdAt));
    const rows = decryptPhiRows("vaccinesTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "vaccines",
      name: r.vaccineName,
      details: [r.provider ? `Provider: ${r.provider}` : null, r.lotNumber ? `Lot: ${r.lotNumber}` : null, r.site, r.notes].filter(Boolean).join(" - ") || "",
      date: r.dateAdministered || r.createdAt.toISOString().split("T")[0],
      status: "completed",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_vaccines" }, "error fetching vaccines");
    res.status(500).json({ error: "Failed to fetch vaccines" });
  }
});

router.post("/vaccines", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addVaccineSchema.parse(req.body);
    logHipaaAudit("ADD_VACCINE", { profileId, vaccine: parsed.vaccineName });
    const [rawRow] = await phiDb.insert(vaccinesTable).values(encryptPhiRow("vaccinesTable", {
      profileId,
      vaccineName: parsed.vaccineName,
      dateAdministered: parsed.dateAdministered || null,
      provider: parsed.provider || null,
      lotNumber: parsed.lotNumber || null,
      site: parsed.site || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("vaccinesTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_vaccine" }, "error adding vaccine");
    res.status(500).json({ error: "Failed to add vaccine" });
  }
});

router.get("/sdoh", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ records: [] });
    }
    logHipaaAudit("READ_SDOH", { profileId });
    const rawRows = await phiDb.select().from(sdohTable).where(eq(sdohTable.profileId, profileId)).orderBy(desc(sdohTable.createdAt));
    const rows = decryptPhiRows("sdohTable", rawRows);
    const records = rows.map((r) => ({
      id: r.id,
      category: "sdoh",
      name: r.domain,
      details: [r.question, r.response, r.notes].filter(Boolean).join(" - ") || "",
      date: r.screeningDate || r.createdAt.toISOString().split("T")[0],
      status: "active",
      source: "Self-Reported",
    }));
    res.json({ records });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_sdoh" }, "error fetching SDOH");
    res.status(500).json({ error: "Failed to fetch SDOH entries" });
  }
});

router.post("/sdoh", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    const parsed = addSdohSchema.parse(req.body);
    logHipaaAudit("ADD_SDOH", { profileId, domain: parsed.domain });
    const [rawRow] = await phiDb.insert(sdohTable).values(encryptPhiRow("sdohTable", {
      profileId,
      domain: parsed.domain,
      question: parsed.question || null,
      response: parsed.response,
      screeningDate: parsed.screeningDate || null,
      notes: parsed.notes || null,
    })).returning();
    const row = decryptPhiRow("sdohTable", rawRow);
    res.json(row);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error({ component: "PHR", err: error, op: "add_sdoh" }, "error adding SDOH");
    res.status(500).json({ error: "Failed to add SDOH entry" });
  }
});

router.get("/all", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({
        medications: [],
        allergies: [],
        surgeries: [],
        medicalHistory: [],
        socialHistory: [],
        vaccines: [],
        sdoh: [],
      });
    }
    logHipaaAudit("READ_ALL_HEALTH_DATA", { profileId });

    const [rawMedications, rawAllergies, rawSurgeries, rawMedicalHistory, rawSocialHistory, rawVaccines, rawSdoh] = await Promise.all([
      phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId)).orderBy(desc(medicationsTable.createdAt)),
      phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)).orderBy(desc(allergiesTable.createdAt)),
      phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)).orderBy(desc(surgeriesTable.createdAt)),
      phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)).orderBy(desc(medicalHistoryTable.createdAt)),
      phiDb.select().from(socialHistoryTable).where(eq(socialHistoryTable.profileId, profileId)).orderBy(desc(socialHistoryTable.createdAt)),
      phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)).orderBy(desc(vaccinesTable.createdAt)),
      phiDb.select().from(sdohTable).where(eq(sdohTable.profileId, profileId)).orderBy(desc(sdohTable.createdAt)),
    ]);

    res.json({
      medications: decryptPhiRows("medicationsTable", rawMedications),
      allergies: decryptPhiRows("allergiesTable", rawAllergies),
      surgeries: decryptPhiRows("surgeriesTable", rawSurgeries),
      medicalHistory: decryptPhiRows("medicalHistoryTable", rawMedicalHistory),
      socialHistory: decryptPhiRows("socialHistoryTable", rawSocialHistory),
      vaccines: decryptPhiRows("vaccinesTable", rawVaccines),
      sdoh: decryptPhiRows("sdohTable", rawSdoh),
    });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "fetch_all_health_data" }, "error fetching all health data");
    res.status(500).json({ error: "Failed to fetch health data" });
  }
});

router.get("/timeline", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({ events: [] });
    }
    logHipaaAudit("READ_TIMELINE", { profileId });

    const [rawMedications, rawAllergies, rawSurgeries, rawMedicalHistory, rawVaccines] = await Promise.all([
      phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId)),
      phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)),
      phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)),
      phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)),
      phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)),
    ]);

    const medications = decryptPhiRows("medicationsTable", rawMedications);
    const allergies = decryptPhiRows("allergiesTable", rawAllergies);
    const surgeries = decryptPhiRows("surgeriesTable", rawSurgeries);
    const medicalHistory = decryptPhiRows("medicalHistoryTable", rawMedicalHistory);
    const vaccines = decryptPhiRows("vaccinesTable", rawVaccines);

    const events: Array<{ id: string; date: string; type: string; title: string; description?: string }> = [];

    medications.forEach((m) => {
      events.push({
        id: m.id,
        date: m.startDate || m.createdAt.toISOString().split("T")[0],
        type: "medication",
        title: `Started ${m.name}`,
        description: m.dose ? `${m.dose} - ${m.frequency || ""}` : undefined,
      });
    });

    allergies.forEach((a) => {
      events.push({
        id: a.id,
        date: a.onsetDate || a.createdAt.toISOString().split("T")[0],
        type: "allergy",
        title: `Allergy: ${a.allergen}`,
        description: a.reaction || undefined,
      });
    });

    surgeries.forEach((s) => {
      events.push({
        id: s.id,
        date: s.surgeryDate || s.createdAt.toISOString().split("T")[0],
        type: "surgery",
        title: s.procedureName,
        description: s.surgeon ? `Performed by ${s.surgeon}` : undefined,
      });
    });

    medicalHistory.forEach((h) => {
      events.push({
        id: h.id,
        date: h.diagnosedDate || h.createdAt.toISOString().split("T")[0],
        type: "condition",
        title: `Diagnosis: ${h.condition}`,
        description: h.treatedBy ? `Treated by ${h.treatedBy}` : undefined,
      });
    });

    vaccines.forEach((v) => {
      events.push({
        id: v.id,
        date: v.dateAdministered || v.createdAt.toISOString().split("T")[0],
        type: "vaccine",
        title: `Vaccine: ${v.vaccineName}`,
        description: v.provider ? `Given by ${v.provider}` : undefined,
      });
    });

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const mapped = events.map((e) => ({
      id: e.id,
      date: e.date,
      category: e.type === "medication" ? "medications" : e.type === "allergy" ? "allergies" : e.type === "surgery" ? "surgeries" : e.type === "condition" ? "medical_history" : e.type === "vaccine" ? "vaccines" : "medical_history",
      title: e.title,
      description: e.description || "",
      source: "Self-Reported",
    }));

    res.json({ events: mapped });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "build_timeline" }, "error building timeline");
    res.status(500).json({ error: "Failed to build timeline" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.json({
        summary: {
          medicationsCount: 0,
          allergiesCount: 0,
          conditionsCount: 0,
          vaccinesCount: 0,
          surgeriesCount: 0,
          sdohCount: 0,
          totalRecords: 0,
          aiSummary: "No health records found. Connect your records or add entries manually to see your health summary here.",
        },
      });
    }
    logHipaaAudit("READ_SUMMARY", { profileId });

    const [rawMedications, rawAllergies, rawSurgeries, rawMedicalHistory, rawVaccines, rawSdoh] = await Promise.all([
      phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId)),
      phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)),
      phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)),
      phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)),
      phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)),
      phiDb.select().from(sdohTable).where(eq(sdohTable.profileId, profileId)),
    ]);

    const medications = decryptPhiRows("medicationsTable", rawMedications);
    const allergies = decryptPhiRows("allergiesTable", rawAllergies);
    const surgeries = decryptPhiRows("surgeriesTable", rawSurgeries);
    const medicalHistory = decryptPhiRows("medicalHistoryTable", rawMedicalHistory);
    const vaccines = decryptPhiRows("vaccinesTable", rawVaccines);
    const sdoh = decryptPhiRows("sdohTable", rawSdoh);

    const totalRecords = medications.length + allergies.length + surgeries.length + medicalHistory.length + vaccines.length + sdoh.length;

    if (totalRecords === 0) {
      return res.json({
        summary: {
          medicationsCount: 0,
          allergiesCount: 0,
          conditionsCount: 0,
          vaccinesCount: 0,
          surgeriesCount: 0,
          sdohCount: 0,
          totalRecords: 0,
          aiSummary: "No health records found. Connect your records or add entries manually to see your health summary here.",
        },
      });
    }

    const counts = {
      medications: medications.length,
      allergies: allergies.length,
      surgeries: surgeries.length,
      conditions: medicalHistory.length,
      vaccines: vaccines.length,
      sdoh: sdoh.length,
    };

    let aiSummary = "";
    try {
      const prompt = `Summarize this patient's health record in 3-4 sentences for the patient. Be factual and concise. Do not provide medical advice.
Medications (${medications.length}): ${medications.map(m => m.name).join(", ") || "None"}
Allergies (${allergies.length}): ${allergies.map(a => a.allergen).join(", ") || "None"}
Surgeries (${surgeries.length}): ${surgeries.map(s => s.procedureName).join(", ") || "None"}
Conditions (${medicalHistory.length}): ${medicalHistory.map(h => h.condition).join(", ") || "None"}
Vaccines (${vaccines.length}): ${vaccines.map(v => v.vaccineName).join(", ") || "None"}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful health record summarizer. Provide a brief, factual summary. Never provide medical advice. Include a disclaimer that this is an AI-generated summary and patients should consult their healthcare provider." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      });
      aiSummary = completion.choices[0]?.message?.content || "";
    } catch {
      aiSummary = `Your health record contains ${totalRecords} entries across ${Object.entries(counts).filter(([, v]) => v > 0).length} categories: ${Object.entries(counts).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ")}.`;
    }

    res.json({
      summary: {
        medicationsCount: counts.medications,
        allergiesCount: counts.allergies,
        conditionsCount: counts.conditions,
        vaccinesCount: counts.vaccines,
        surgeriesCount: counts.surgeries,
        sdohCount: counts.sdoh,
        totalRecords,
        aiSummary,
      },
    });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "generate_summary" }, "error generating summary");
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

router.post("/share", async (req: Request, res: Response) => {
  try {
    const profileId = await getProfileId(req);
    if (!profileId) {
      return res.status(401).json({ error: "No profile found" });
    }
    logHipaaAudit("CREATE_SHARE_LINK", { profileId });
    const shareId = crypto.randomUUID();
    res.json({
      shareId,
      shareUrl: `${req.protocol}://${req.get("host")}/shared/${shareId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    logger.error({ component: "PHR", err: error, op: "create_share_link" }, "error creating share link");
    res.status(500).json({ error: "Failed to create share link" });
  }
});

export default router;
