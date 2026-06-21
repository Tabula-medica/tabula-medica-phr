import { Router, Request, Response } from "express";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import {
  comprehensiveCarePlansTable,
  carePlanGoalLinksTable,
  carePlanMedicationLinksTable,
  carePlanEducationLinksTable,
  carePlanMonitoringParamsTable,
  carePlanProgressNotesTable,
  carePlanStatusHistoryTable,
  healthGoalsTable,
  medicationRemindersTable,
  goalProgressTable,
  vitalSignsTable,
  medicationAdherenceLogsTable,
  insertComprehensiveCarePlanSchema,
  insertCarePlanGoalLinkSchema,
  insertCarePlanMedicationLinkSchema,
  insertCarePlanEducationLinkSchema,
  insertCarePlanMonitoringParamSchema,
  insertCarePlanProgressNoteSchema,
  comprehensiveCarePlanStatuses,
  comprehensiveCarePlanCategories,
  comprehensiveCarePlanPriorityLevels,
  profiles,
} from "@shared/schema";

const router = Router();

const NO_CDS_DISCLAIMER = "This information is for educational purposes only. It is not intended to replace professional clinical judgment. All care decisions should be made by qualified healthcare providers in consultation with their patients.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][CarePlanModule] ${action} - ${JSON.stringify({ ...details, timestamp })}`);
}

function requireProviderAuth(req: Request, res: Response, next: Function) {
  const sessionUserId = (req.session as any)?.userId;
  const isProvider = (req.session as any)?.isProvider || (req.session as any)?.role === "provider";
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  (req as any).providerId = sessionUserId;
  (req as any).isProvider = isProvider;
  next();
}

function requirePatientAuth(req: Request, res: Response, next: Function) {
  const sessionUserId = (req.session as any)?.userId;
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  // Following health-tracking-routes pattern: sessionUserId IS the profileId
  (req as any).patientId = sessionUserId;
  (req as any).profileId = sessionUserId;
  next();
}

function getSessionUserId(req: Request): string | null {
  const sessionUserId = (req.session as any)?.userId;
  return sessionUserId || null;
}

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    success: true,
    module: "Comprehensive Care Plan Module",
    version: "1.0.0",
    features: [
      "Create personalized care plans for patients",
      "Link health goals to care plans",
      "Link medications with adherence targets",
      "Assign educational content",
      "Set remote monitoring parameters with thresholds",
      "Track patient progress and milestones",
      "Patient acknowledgment workflow",
      "Care plan status history and audit trail",
    ],
    statuses: comprehensiveCarePlanStatuses,
    categories: comprehensiveCarePlanCategories,
    priorityLevels: comprehensiveCarePlanPriorityLevels,
    disclaimer: NO_CDS_DISCLAIMER,
  });
});

const createCarePlanSchema = insertComprehensiveCarePlanSchema;
const updateCarePlanSchema = insertComprehensiveCarePlanSchema.partial().extend({
  status: z.enum(comprehensiveCarePlanStatuses).optional(),
});

router.post("/care-plans", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const validationResult = createCarePlanSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_CREATE", { 
      providerId: hashIdentifier(providerId), 
      profileId: hashIdentifier(data.profileId) 
    });
    
    const [encCarePlan] = await phiDb.insert(comprehensiveCarePlansTable).values(encryptPhiRow("comprehensiveCarePlansTable", {
      profileId: data.profileId,
      providerId: providerId,
      title: data.title,
      description: data.description || null,
      category: data.category,
      status: data.status || "draft",
      startDate: data.startDate,
      targetEndDate: data.targetEndDate || null,
      reviewDate: data.reviewDate || null,
      priorityLevel: data.priorityLevel,
      notes: data.notes || null,
    })).returning();
    
    const carePlan = encCarePlan ? decryptPhiRow("comprehensiveCarePlansTable", encCarePlan) : encCarePlan;
    
    await phiDb.insert(carePlanStatusHistoryTable).values(encryptPhiRow("carePlanStatusHistoryTable", {
      carePlanId: carePlan.id,
      previousStatus: "none",
      newStatus: carePlan.status,
      changedBy: providerId,
      reason: "Care plan created",
    }));
    
    res.json({ 
      success: true, 
      carePlan,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error creating care plan:", error);
    res.status(500).json({ success: false, error: "Failed to create care plan" });
  }
});

router.get("/care-plans", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { status, profileId, category } = req.query;
    
    logHipaaAudit("CARE_PLANS_LIST", { providerId: hashIdentifier(providerId) });
    
    // NOTE: status/category filters operate on encrypted columns. Per Action Item I pattern,
    // filter only on non-PHI columns at SQL level (profileId is FK, not encrypted), then
    // apply PHI-column predicates in-memory after decryption.
    let query = phiDb.select().from(comprehensiveCarePlansTable);
    
    const sqlConditions = [];
    if (profileId && typeof profileId === "string") {
      sqlConditions.push(eq(comprehensiveCarePlansTable.profileId, profileId));
    }
    
    const encCarePlans = sqlConditions.length > 0
      ? await query.where(and(...sqlConditions)).orderBy(desc(comprehensiveCarePlansTable.updatedAt))
      : await query.orderBy(desc(comprehensiveCarePlansTable.updatedAt));
    
    let carePlans = decryptPhiRows("comprehensiveCarePlansTable", encCarePlans);
    if (status && typeof status === "string") {
      carePlans = carePlans.filter((cp: any) => cp.status === status);
    }
    if (category && typeof category === "string") {
      carePlans = carePlans.filter((cp: any) => cp.category === category);
    }
    
    res.json({ 
      success: true, 
      carePlans,
      count: carePlans.length,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error listing care plans:", error);
    res.status(500).json({ success: false, error: "Failed to list care plans" });
  }
});

router.get("/care-plans/:id", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    logHipaaAudit("CARE_PLAN_VIEW", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id) 
    });
    
    const [encCarePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!encCarePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    const carePlan = decryptPhiRow("comprehensiveCarePlansTable", encCarePlan);
    
    const [encGoals, encMedications, encEducation, encMonitoring, encProgressNotes, encStatusHistory] = await Promise.all([
      phiDb.select({
        link: carePlanGoalLinksTable,
        goal: healthGoalsTable,
      })
        .from(carePlanGoalLinksTable)
        .leftJoin(healthGoalsTable, eq(carePlanGoalLinksTable.healthGoalId, healthGoalsTable.id))
        .where(eq(carePlanGoalLinksTable.carePlanId, id)),
      phiDb.select({
        link: carePlanMedicationLinksTable,
        medication: medicationRemindersTable,
      })
        .from(carePlanMedicationLinksTable)
        .leftJoin(medicationRemindersTable, eq(carePlanMedicationLinksTable.medicationReminderId, medicationRemindersTable.id))
        .where(eq(carePlanMedicationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanEducationLinksTable)
        .where(eq(carePlanEducationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanMonitoringParamsTable)
        .where(eq(carePlanMonitoringParamsTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanProgressNotesTable)
        .where(eq(carePlanProgressNotesTable.carePlanId, id))
        .orderBy(desc(carePlanProgressNotesTable.createdAt)),
      phiDb.select()
        .from(carePlanStatusHistoryTable)
        .where(eq(carePlanStatusHistoryTable.carePlanId, id))
        .orderBy(desc(carePlanStatusHistoryTable.createdAt)),
    ]);
    
    // Decrypt joined sub-records per-table.
    const goals = encGoals.map((row: any) => ({
      link: decryptPhiRow("carePlanGoalLinksTable", row.link),
      goal: row.goal ? decryptPhiRow("healthGoalsTable", row.goal) : null,
    }));
    const medications = encMedications.map((row: any) => ({
      link: decryptPhiRow("carePlanMedicationLinksTable", row.link),
      medication: row.medication ? decryptPhiRow("medicationRemindersTable", row.medication) : null,
    }));
    const education = decryptPhiRows("carePlanEducationLinksTable", encEducation);
    const monitoring = decryptPhiRows("carePlanMonitoringParamsTable", encMonitoring);
    const progressNotes = decryptPhiRows("carePlanProgressNotesTable", encProgressNotes);
    const statusHistory = decryptPhiRows("carePlanStatusHistoryTable", encStatusHistory);
    
    res.json({ 
      success: true, 
      carePlan,
      goals,
      medications,
      education,
      monitoring,
      progressNotes,
      statusHistory,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error fetching care plan:", error);
    res.status(500).json({ success: false, error: "Failed to fetch care plan" });
  }
});

router.patch("/care-plans/:id", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = updateCarePlanSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    const [encExisting] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!encExisting) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    const existing = decryptPhiRow("comprehensiveCarePlansTable", encExisting);
    
    logHipaaAudit("CARE_PLAN_UPDATE", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id) 
    });
    
    if (data.status && data.status !== existing.status) {
      await phiDb.insert(carePlanStatusHistoryTable).values(encryptPhiRow("carePlanStatusHistoryTable", {
        carePlanId: id,
        previousStatus: existing.status,
        newStatus: data.status,
        changedBy: providerId,
        reason: req.body.statusChangeReason || "Status updated",
      }));
    }
    
    const updateData: any = { updatedAt: new Date() };
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category) updateData.category = data.category;
    if (data.status) updateData.status = data.status;
    if (data.startDate) updateData.startDate = data.startDate;
    if (data.targetEndDate !== undefined) updateData.targetEndDate = data.targetEndDate;
    if (data.reviewDate !== undefined) updateData.reviewDate = data.reviewDate;
    if (data.priorityLevel) updateData.priorityLevel = data.priorityLevel;
    if (data.notes !== undefined) updateData.notes = data.notes;
    
    const [encUpdated] = await phiDb.update(comprehensiveCarePlansTable)
      .set(encryptPhiRow("comprehensiveCarePlansTable", updateData) as any)
      .where(eq(comprehensiveCarePlansTable.id, id))
      .returning();
    
    const updated = encUpdated ? decryptPhiRow("comprehensiveCarePlansTable", encUpdated) : encUpdated;
    
    res.json({ 
      success: true, 
      carePlan: updated,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error updating care plan:", error);
    res.status(500).json({ success: false, error: "Failed to update care plan" });
  }
});

router.post("/care-plans/:id/goals", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = insertCarePlanGoalLinkSchema.omit({ carePlanId: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_GOAL_LINK", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id),
      healthGoalId: hashIdentifier(data.healthGoalId)
    });
    
    const [encLink] = await phiDb.insert(carePlanGoalLinksTable).values(encryptPhiRow("carePlanGoalLinksTable", {
      carePlanId: id,
      healthGoalId: data.healthGoalId,
      priority: data.priority || 1,
      providerNotes: data.providerNotes || null,
    })).returning();
    
    const link = encLink ? decryptPhiRow("carePlanGoalLinksTable", encLink) : encLink;
    res.json({ success: true, goalLink: link, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[CarePlanModule] Error linking goal:", error);
    res.status(500).json({ success: false, error: "Failed to link goal to care plan" });
  }
});

router.post("/care-plans/:id/medications", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = insertCarePlanMedicationLinkSchema.omit({ carePlanId: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_MEDICATION_LINK", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id),
      medicationId: hashIdentifier(data.medicationReminderId)
    });
    
    const [encLink] = await phiDb.insert(carePlanMedicationLinksTable).values(encryptPhiRow("carePlanMedicationLinksTable", {
      carePlanId: id,
      medicationReminderId: data.medicationReminderId,
      dosageInstructions: data.dosageInstructions || null,
      providerNotes: data.providerNotes || null,
      adherenceTarget: data.adherenceTarget || 90,
    })).returning();
    
    const link = encLink ? decryptPhiRow("carePlanMedicationLinksTable", encLink) : encLink;
    res.json({ success: true, medicationLink: link, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[CarePlanModule] Error linking medication:", error);
    res.status(500).json({ success: false, error: "Failed to link medication to care plan" });
  }
});

router.post("/care-plans/:id/education", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = insertCarePlanEducationLinkSchema.omit({ carePlanId: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_EDUCATION_LINK", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id)
    });
    
    const [encLink] = await phiDb.insert(carePlanEducationLinksTable).values(encryptPhiRow("carePlanEducationLinksTable", {
      carePlanId: id,
      contentType: data.contentType,
      title: data.title,
      description: data.description || null,
      contentUrl: data.contentUrl || null,
      aiGenerated: data.aiGenerated || false,
      priority: data.priority || 1,
      providerNotes: data.providerNotes || null,
    })).returning();
    
    const link = encLink ? decryptPhiRow("carePlanEducationLinksTable", encLink) : encLink;
    res.json({ success: true, educationLink: link, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[CarePlanModule] Error linking education content:", error);
    res.status(500).json({ success: false, error: "Failed to link education content" });
  }
});

router.post("/care-plans/:id/monitoring", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = insertCarePlanMonitoringParamSchema.omit({ carePlanId: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_MONITORING_ADD", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id),
      vitalType: data.vitalType
    });
    
    const [encParam] = await phiDb.insert(carePlanMonitoringParamsTable).values(encryptPhiRow("carePlanMonitoringParamsTable", {
      carePlanId: id,
      vitalType: data.vitalType,
      frequency: data.frequency || "daily",
      minThreshold: data.minThreshold || null,
      maxThreshold: data.maxThreshold || null,
      unit: data.unit,
      alertOnBreach: data.alertOnBreach !== false,
      providerNotes: data.providerNotes || null,
    })).returning();
    
    const param = encParam ? decryptPhiRow("carePlanMonitoringParamsTable", encParam) : encParam;
    res.json({ success: true, monitoringParam: param, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[CarePlanModule] Error adding monitoring parameter:", error);
    res.status(500).json({ success: false, error: "Failed to add monitoring parameter" });
  }
});

router.post("/care-plans/:id/progress-notes", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id } = req.params;
    
    const validationResult = insertCarePlanProgressNoteSchema.omit({ carePlanId: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Validation failed", 
        details: validationResult.error.issues 
      });
    }
    
    const data = validationResult.data;
    
    logHipaaAudit("CARE_PLAN_PROGRESS_NOTE", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id),
      noteType: data.noteType
    });
    
    const [encNote] = await phiDb.insert(carePlanProgressNotesTable).values(encryptPhiRow("carePlanProgressNotesTable", {
      carePlanId: id,
      authorId: data.authorId || providerId,
      authorRole: data.authorRole || "provider",
      noteType: data.noteType || "general",
      content: data.content,
      attachmentUrl: data.attachmentUrl || null,
    })).returning();
    
    const note = encNote ? decryptPhiRow("carePlanProgressNotesTable", encNote) : encNote;
    res.json({ success: true, progressNote: note, disclaimer: NO_CDS_DISCLAIMER });
  } catch (error) {
    console.error("[CarePlanModule] Error adding progress note:", error);
    res.status(500).json({ success: false, error: "Failed to add progress note" });
  }
});

router.get("/patient/care-plans", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const profileId = req.query.profileId as string || patientId;
    
    if (profileId !== patientId) {
      logHipaaAudit("ACCESS_DENIED", { 
        userId: hashIdentifier(patientId), 
        attemptedProfileId: hashIdentifier(profileId)
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    logHipaaAudit("PATIENT_CARE_PLANS_VIEW", { 
      userId: hashIdentifier(patientId),
      profileId: hashIdentifier(profileId)
    });
    
    // status is encrypted; filter at SQL by profileId only, then in-memory by status.
    const encCarePlansAll = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.profileId, profileId))
      .orderBy(desc(comprehensiveCarePlansTable.updatedAt));
    
    const carePlans = decryptPhiRows("comprehensiveCarePlansTable", encCarePlansAll)
      .filter((cp: any) => cp.status === "active");
    
    res.json({ 
      success: true, 
      carePlans,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error fetching patient care plans:", error);
    res.status(500).json({ success: false, error: "Failed to fetch care plans" });
  }
});

router.get("/patient/care-plans/:id", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const { id } = req.params;
    
    logHipaaAudit("PATIENT_CARE_PLAN_VIEW", { 
      userId: hashIdentifier(patientId),
      carePlanId: hashIdentifier(id)
    });
    
    const [encCarePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!encCarePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    const carePlan = decryptPhiRow("comprehensiveCarePlansTable", encCarePlan);
    
    // Ownership check: verify patient can only access their own care plans.
    // profileId is a non-PHI FK and is safe to compare directly on the decrypted row.
    const patientProfileId = (req as any).profileId;
    if (carePlan.profileId !== patientProfileId) {
      logHipaaAudit("UNAUTHORIZED_CARE_PLAN_ACCESS", { 
        userId: hashIdentifier(patientId),
        carePlanId: hashIdentifier(id),
        ownerProfileId: hashIdentifier(carePlan.profileId),
        requestedProfileId: hashIdentifier(patientProfileId || "unknown")
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    const [encGoals, encMedications, encEducation, encMonitoring, encProgressNotes] = await Promise.all([
      phiDb.select({
        link: carePlanGoalLinksTable,
        goal: healthGoalsTable,
      })
        .from(carePlanGoalLinksTable)
        .leftJoin(healthGoalsTable, eq(carePlanGoalLinksTable.healthGoalId, healthGoalsTable.id))
        .where(eq(carePlanGoalLinksTable.carePlanId, id)),
      phiDb.select({
        link: carePlanMedicationLinksTable,
        medication: medicationRemindersTable,
      })
        .from(carePlanMedicationLinksTable)
        .leftJoin(medicationRemindersTable, eq(carePlanMedicationLinksTable.medicationReminderId, medicationRemindersTable.id))
        .where(eq(carePlanMedicationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanEducationLinksTable)
        .where(eq(carePlanEducationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanMonitoringParamsTable)
        .where(eq(carePlanMonitoringParamsTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanProgressNotesTable)
        .where(eq(carePlanProgressNotesTable.carePlanId, id))
        .orderBy(desc(carePlanProgressNotesTable.createdAt))
        .limit(10),
    ]);
    
    const goals = encGoals.map((row: any) => ({
      link: decryptPhiRow("carePlanGoalLinksTable", row.link),
      goal: row.goal ? decryptPhiRow("healthGoalsTable", row.goal) : null,
    }));
    const medications = encMedications.map((row: any) => ({
      link: decryptPhiRow("carePlanMedicationLinksTable", row.link),
      medication: row.medication ? decryptPhiRow("medicationRemindersTable", row.medication) : null,
    }));
    const education = decryptPhiRows("carePlanEducationLinksTable", encEducation);
    const monitoring = decryptPhiRows("carePlanMonitoringParamsTable", encMonitoring);
    const progressNotes = decryptPhiRows("carePlanProgressNotesTable", encProgressNotes);
    
    const overallProgress = await calculateCarePlanProgress(id, carePlan.profileId, goals, medications);
    
    res.json({ 
      success: true, 
      carePlan: { ...carePlan, overallProgress },
      goals,
      medications,
      education,
      monitoring,
      progressNotes,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error fetching patient care plan:", error);
    res.status(500).json({ success: false, error: "Failed to fetch care plan" });
  }
});

router.post("/patient/care-plans/:id/acknowledge", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const patientProfileId = (req as any).profileId;
    const { id } = req.params;
    
    // Ownership check: verify care plan belongs to patient.
    // profileId is a non-PHI FK (UUID) — safe to compare on encrypted row without decrypt.
    const [existingCarePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!existingCarePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    
    if (existingCarePlan.profileId !== patientProfileId) {
      logHipaaAudit("UNAUTHORIZED_CARE_PLAN_ACKNOWLEDGE", { 
        userId: hashIdentifier(patientId),
        carePlanId: hashIdentifier(id)
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    logHipaaAudit("PATIENT_CARE_PLAN_ACKNOWLEDGE", { 
      userId: hashIdentifier(patientId),
      carePlanId: hashIdentifier(id)
    });
    
    // patientAcknowledged/patientAcknowledgedAt/updatedAt are non-PHI booleans/timestamps;
    // encryptPhiRow is a no-op for them but used here for consistency.
    const [encUpdated] = await phiDb.update(comprehensiveCarePlansTable)
      .set(encryptPhiRow("comprehensiveCarePlansTable", { 
        patientAcknowledged: true, 
        patientAcknowledgedAt: new Date(),
        updatedAt: new Date()
      }) as any)
      .where(eq(comprehensiveCarePlansTable.id, id))
      .returning();
    
    const updated = encUpdated ? decryptPhiRow("comprehensiveCarePlansTable", encUpdated) : encUpdated;
    
    res.json({ 
      success: true, 
      message: "Care plan acknowledged",
      carePlan: updated,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error acknowledging care plan:", error);
    res.status(500).json({ success: false, error: "Failed to acknowledge care plan" });
  }
});

router.patch("/patient/education/:id/complete", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const patientProfileId = (req as any).profileId;
    const { id } = req.params;
    
    // Ownership check: get education link and verify care plan belongs to patient.
    // carePlanId/profileId are non-PHI FKs — safe to read encrypted row and compare.
    const [educationLink] = await phiDb.select()
      .from(carePlanEducationLinksTable)
      .where(eq(carePlanEducationLinksTable.id, id));
    
    if (!educationLink) {
      return res.status(404).json({ success: false, error: "Education content not found" });
    }
    
    const [carePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, educationLink.carePlanId));
    
    if (!carePlan || carePlan.profileId !== patientProfileId) {
      logHipaaAudit("UNAUTHORIZED_EDUCATION_COMPLETE", { 
        userId: hashIdentifier(patientId),
        educationId: hashIdentifier(id)
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    logHipaaAudit("PATIENT_EDUCATION_COMPLETE", { 
      userId: hashIdentifier(patientId),
      educationId: hashIdentifier(id)
    });
    
    const [encUpdated] = await phiDb.update(carePlanEducationLinksTable)
      .set(encryptPhiRow("carePlanEducationLinksTable", { completed: true, completedAt: new Date() }) as any)
      .where(eq(carePlanEducationLinksTable.id, id))
      .returning();
    
    const updated = encUpdated ? decryptPhiRow("carePlanEducationLinksTable", encUpdated) : encUpdated;
    
    res.json({ 
      success: true, 
      message: "Education content marked complete",
      education: updated,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error completing education:", error);
    res.status(500).json({ success: false, error: "Failed to mark education complete" });
  }
});

router.post("/patient/care-plans/:id/progress-notes", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const patientProfileId = (req as any).profileId;
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || typeof content !== "string") {
      return res.status(400).json({ success: false, error: "Content is required" });
    }
    
    // Ownership check: profileId is non-PHI FK — read encrypted, compare directly.
    const [carePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!carePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    
    if (carePlan.profileId !== patientProfileId) {
      logHipaaAudit("UNAUTHORIZED_PROGRESS_NOTE_ADD", { 
        userId: hashIdentifier(patientId),
        carePlanId: hashIdentifier(id)
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    logHipaaAudit("PATIENT_PROGRESS_NOTE_ADD", { 
      userId: hashIdentifier(patientId),
      carePlanId: hashIdentifier(id)
    });
    
    const [encNote] = await phiDb.insert(carePlanProgressNotesTable).values(encryptPhiRow("carePlanProgressNotesTable", {
      carePlanId: id,
      authorId: patientId,
      authorRole: "patient",
      noteType: "patient_update",
      content: content,
    })).returning();
    
    const note = encNote ? decryptPhiRow("carePlanProgressNotesTable", encNote) : encNote;
    
    res.json({ 
      success: true, 
      progressNote: note,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error adding patient progress note:", error);
    res.status(500).json({ success: false, error: "Failed to add progress note" });
  }
});

router.get("/patient/care-plans/:id/progress", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const patientId = (req as any).patientId;
    const patientProfileId = (req as any).profileId;
    const { id } = req.params;
    
    const [carePlan] = await phiDb.select()
      .from(comprehensiveCarePlansTable)
      .where(eq(comprehensiveCarePlansTable.id, id));
    
    if (!carePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found" });
    }
    
    // Ownership check: profileId is non-PHI FK — safe to compare on encrypted row.
    if (carePlan.profileId !== patientProfileId) {
      logHipaaAudit("UNAUTHORIZED_CARE_PLAN_PROGRESS_VIEW", { 
        userId: hashIdentifier(patientId),
        carePlanId: hashIdentifier(id)
      });
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    
    logHipaaAudit("PATIENT_CARE_PLAN_PROGRESS_VIEW", { 
      userId: hashIdentifier(patientId),
      carePlanId: hashIdentifier(id)
    });
    
    const [encGoals, encMedications, encEducation, encMonitoring] = await Promise.all([
      phiDb.select({
        link: carePlanGoalLinksTable,
        goal: healthGoalsTable,
      })
        .from(carePlanGoalLinksTable)
        .leftJoin(healthGoalsTable, eq(carePlanGoalLinksTable.healthGoalId, healthGoalsTable.id))
        .where(eq(carePlanGoalLinksTable.carePlanId, id)),
      phiDb.select({
        link: carePlanMedicationLinksTable,
        medication: medicationRemindersTable,
      })
        .from(carePlanMedicationLinksTable)
        .leftJoin(medicationRemindersTable, eq(carePlanMedicationLinksTable.medicationReminderId, medicationRemindersTable.id))
        .where(eq(carePlanMedicationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanEducationLinksTable)
        .where(eq(carePlanEducationLinksTable.carePlanId, id)),
      phiDb.select()
        .from(carePlanMonitoringParamsTable)
        .where(eq(carePlanMonitoringParamsTable.carePlanId, id)),
    ]);
    
    const goals = encGoals.map((row: any) => ({
      link: decryptPhiRow("carePlanGoalLinksTable", row.link),
      goal: row.goal ? decryptPhiRow("healthGoalsTable", row.goal) : null,
    }));
    const medications = encMedications.map((row: any) => ({
      link: decryptPhiRow("carePlanMedicationLinksTable", row.link),
      medication: row.medication ? decryptPhiRow("medicationRemindersTable", row.medication) : null,
    }));
    const education = decryptPhiRows("carePlanEducationLinksTable", encEducation);
    const monitoring = decryptPhiRows("carePlanMonitoringParamsTable", encMonitoring);
    
    const goalsProgress = goals.length > 0 
      ? goals.filter(g => g.goal?.status === "achieved").length / goals.length * 100
      : 0;
    
    const educationProgress = education.length > 0
      ? education.filter(e => e.completed).length / education.length * 100
      : 0;
    
    const overallProgress = Math.round((goalsProgress + educationProgress) / 2);
    
    res.json({ 
      success: true,
      progress: {
        overall: overallProgress,
        goals: {
          total: goals.length,
          achieved: goals.filter(g => g.goal?.status === "achieved").length,
          inProgress: goals.filter(g => g.goal?.status === "active").length,
          percentage: Math.round(goalsProgress),
        },
        education: {
          total: education.length,
          completed: education.filter(e => e.completed).length,
          percentage: Math.round(educationProgress),
        },
        medications: {
          total: medications.length,
        },
        monitoring: {
          total: monitoring.length,
          parameters: monitoring.map(m => m.vitalType),
        },
      },
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[CarePlanModule] Error fetching progress:", error);
    res.status(500).json({ success: false, error: "Failed to fetch progress" });
  }
});

async function calculateCarePlanProgress(
  carePlanId: string, 
  profileId: string, 
  goals: any[], 
  medications: any[]
): Promise<number> {
  try {
    const goalsAchieved = goals.filter(g => g.goal?.status === "achieved").length;
    const goalsProgress = goals.length > 0 ? (goalsAchieved / goals.length) * 100 : 0;
    return Math.round(goalsProgress);
  } catch (error) {
    console.error("[CarePlanModule] Error calculating progress:", error);
    return 0;
  }
}

router.delete("/care-plans/:id/goals/:goalLinkId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id, goalLinkId } = req.params;
    
    logHipaaAudit("CARE_PLAN_GOAL_UNLINK", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id),
      goalLinkId: hashIdentifier(goalLinkId)
    });
    
    await phiDb.delete(carePlanGoalLinksTable)
      .where(and(
        eq(carePlanGoalLinksTable.id, goalLinkId),
        eq(carePlanGoalLinksTable.carePlanId, id)
      ));
    
    res.json({ success: true, message: "Goal unlinked from care plan" });
  } catch (error) {
    console.error("[CarePlanModule] Error unlinking goal:", error);
    res.status(500).json({ success: false, error: "Failed to unlink goal" });
  }
});

router.delete("/care-plans/:id/medications/:medLinkId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id, medLinkId } = req.params;
    
    logHipaaAudit("CARE_PLAN_MEDICATION_UNLINK", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id)
    });
    
    await phiDb.delete(carePlanMedicationLinksTable)
      .where(and(
        eq(carePlanMedicationLinksTable.id, medLinkId),
        eq(carePlanMedicationLinksTable.carePlanId, id)
      ));
    
    res.json({ success: true, message: "Medication unlinked from care plan" });
  } catch (error) {
    console.error("[CarePlanModule] Error unlinking medication:", error);
    res.status(500).json({ success: false, error: "Failed to unlink medication" });
  }
});

router.delete("/care-plans/:id/education/:eduLinkId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id, eduLinkId } = req.params;
    
    logHipaaAudit("CARE_PLAN_EDUCATION_REMOVE", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id)
    });
    
    await phiDb.delete(carePlanEducationLinksTable)
      .where(and(
        eq(carePlanEducationLinksTable.id, eduLinkId),
        eq(carePlanEducationLinksTable.carePlanId, id)
      ));
    
    res.json({ success: true, message: "Education content removed from care plan" });
  } catch (error) {
    console.error("[CarePlanModule] Error removing education:", error);
    res.status(500).json({ success: false, error: "Failed to remove education content" });
  }
});

router.delete("/care-plans/:id/monitoring/:monitoringId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { id, monitoringId } = req.params;
    
    logHipaaAudit("CARE_PLAN_MONITORING_REMOVE", { 
      providerId: hashIdentifier(providerId), 
      carePlanId: hashIdentifier(id)
    });
    
    await phiDb.delete(carePlanMonitoringParamsTable)
      .where(and(
        eq(carePlanMonitoringParamsTable.id, monitoringId),
        eq(carePlanMonitoringParamsTable.carePlanId, id)
      ));
    
    res.json({ success: true, message: "Monitoring parameter removed from care plan" });
  } catch (error) {
    console.error("[CarePlanModule] Error removing monitoring:", error);
    res.status(500).json({ success: false, error: "Failed to remove monitoring parameter" });
  }
});

console.log("[CarePlanModule] Service initialized with comprehensive care plan management features");
console.log("[CarePlanModule] Features: CRUD, goal linking, medication linking, education content, remote monitoring");

export default router;
