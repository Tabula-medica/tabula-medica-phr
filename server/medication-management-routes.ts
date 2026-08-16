import { Router, Request, Response, NextFunction } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";
import { z } from "zod";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { 
  medicationsTable, 
  medicationRemindersTable,
  medicationAdherenceLogsTable,
  medicationInteractionFlagsTable,
  providerMedicationActionsTable
} from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { logger } from "./lib/logger";

const createMedicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateMedicationSchema = z.object({
  name: z.string().min(1).optional(),
  dose: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "discontinued"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const createReminderSchema = z.object({
  medicationId: z.string().optional().nullable(),
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().optional().nullable(),
  frequency: z.string().optional().default("once_daily"),
  scheduledTimes: z.array(z.string()).min(1, "At least one scheduled time is required"),
  daysOfWeek: z.array(z.string()).optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  notifyPush: z.boolean().optional().default(true),
  notifyEmail: z.boolean().optional().default(false),
  notifySms: z.boolean().optional().default(false),
  advanceMinutes: z.number().optional().default(15),
});

const logAdherenceSchema = z.object({
  medicationId: z.string().optional().nullable(),
  reminderId: z.string().optional().nullable(),
  medicationName: z.string().min(1, "Medication name is required"),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  actualTime: z.string().optional().nullable(),
  status: z.enum(["taken", "missed", "skipped"]),
  notes: z.string().optional().nullable(),
  sideEffects: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
});

const checkInteractionsSchema = z.object({
  medicationIds: z.array(z.string()).optional(),
});

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  logger.info({ component: "MedMgmt", audit: "HIPAA", action, details }, "HIPAA audit event");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path, method: req.method });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  const queryProfileId = req.query.profileId as string | undefined;
  const bodyProfileId = req.body?.profileId;
  const paramsProfileId = req.params?.profileId;

  if ((queryProfileId && queryProfileId !== sessionUserId) ||
      (bodyProfileId && bodyProfileId !== sessionUserId) ||
      (paramsProfileId && paramsProfileId !== sessionUserId)) {
    logHipaaAudit("ACCESS_DENIED", { 
      userId: hashIdentifier(sessionUserId), 
      attemptedAccess: hashIdentifier(queryProfileId || bodyProfileId || paramsProfileId || "unknown"),
      path: req.path 
    });
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  (req as any).userId = sessionUserId;
  next();
}

const NO_CDS_DISCLAIMER = "This information is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider before making any changes to your medication regimen.";

router.get("/medications", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const includeInactive = req.query.includeInactive === "true";
    
    logHipaaAudit("MEDICATIONS_LIST", { profileId: hashIdentifier(profileId) });

    const medications = decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable)
      .where(eq(medicationsTable.profileId, profileId))
      .orderBy(desc(medicationsTable.createdAt)));
    
    const filteredMeds = includeInactive 
      ? medications 
      : medications.filter(m => m.status === "active");

    res.json({
      success: true,
      medications: filteredMeds.map(med => ({
        ...med,
        source: "manual_entry"
      })),
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching medications");
    res.status(500).json({ success: false, error: "Failed to fetch medications" });
  }
});

router.post("/medications", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    
    const validation = createMedicationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || "Invalid request data" 
      });
    }

    const { name, dose, frequency, startDate, endDate } = validation.data;

    logHipaaAudit("MEDICATION_ADD", { profileId: hashIdentifier(profileId), medicationName: name });

    const [encMedication] = await phiDb.insert(medicationsTable).values(encryptPhiRow("medicationsTable", {
      profileId,
      name,
      dose: dose || null,
      frequency: frequency || null,
      status: "active",
      startDate: startDate || null,
      endDate: endDate || null,
    })).returning();
    const medication = encMedication ? decryptPhiRow("medicationsTable", encMedication) : encMedication;

    res.json({ success: true, medication });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error adding medication");
    res.status(500).json({ success: false, error: "Failed to add medication" });
  }
});

router.patch("/medications/:medicationId", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const { medicationId } = req.params;
    const updates = req.body;

    const [encExistingMed] = await phiDb.select().from(medicationsTable)
      .where(and(eq(medicationsTable.id, medicationId), eq(medicationsTable.profileId, profileId)));

    if (!encExistingMed) {
      return res.status(404).json({ success: false, error: "Medication not found" });
    }
    const existingMed = decryptPhiRow("medicationsTable", encExistingMed);

    logHipaaAudit("MEDICATION_UPDATE", { profileId: hashIdentifier(profileId), medicationId: hashIdentifier(medicationId) });

    const [encMedication] = await phiDb.update(medicationsTable)
      .set(encryptPhiRow("medicationsTable", {
        name: updates.name || existingMed.name,
        dose: updates.dose !== undefined ? updates.dose : existingMed.dose,
        frequency: updates.frequency !== undefined ? updates.frequency : existingMed.frequency,
        status: updates.status || existingMed.status,
        startDate: updates.startDate || existingMed.startDate,
        endDate: updates.endDate !== undefined ? updates.endDate : existingMed.endDate,
      }))
      .where(eq(medicationsTable.id, medicationId))
      .returning();
    const medication = encMedication ? decryptPhiRow("medicationsTable", encMedication) : encMedication;

    res.json({ success: true, medication });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error updating medication");
    res.status(500).json({ success: false, error: "Failed to update medication" });
  }
});

router.get("/reminders", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const activeOnly = req.query.activeOnly !== "false";

    logHipaaAudit("REMINDERS_LIST", { profileId: hashIdentifier(profileId) });

    let reminders = decryptPhiRows("medicationRemindersTable", await phiDb.select().from(medicationRemindersTable)
      .where(eq(medicationRemindersTable.profileId, profileId))
      .orderBy(desc(medicationRemindersTable.createdAt)));

    if (activeOnly) {
      reminders = reminders.filter(r => r.isActive);
    }

    res.json({ success: true, reminders });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching reminders");
    res.status(500).json({ success: false, error: "Failed to fetch reminders" });
  }
});

router.post("/reminders", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    
    const validation = createReminderSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || "Invalid request data" 
      });
    }

    const { 
      medicationId, 
      medicationName, 
      dosage, 
      frequency, 
      scheduledTimes, 
      daysOfWeek,
      startDate,
      endDate,
      notifyPush,
      notifyEmail,
      notifySms,
      advanceMinutes 
    } = validation.data;

    logHipaaAudit("REMINDER_CREATE", { profileId: hashIdentifier(profileId), medicationName });

    const [encReminder] = await phiDb.insert(medicationRemindersTable).values(encryptPhiRow("medicationRemindersTable", {
      profileId,
      medicationId: medicationId || null,
      medicationName,
      dosage: dosage || null,
      frequency: frequency || "once_daily",
      scheduledTimes,
      daysOfWeek: daysOfWeek || null,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || null,
      isActive: true,
      notifyPush: notifyPush !== false,
      notifyEmail: notifyEmail === true,
      notifySms: notifySms === true,
      advanceMinutes: advanceMinutes || 15,
    })).returning();
    const reminder = encReminder ? decryptPhiRow("medicationRemindersTable", encReminder) : encReminder;

    res.json({ success: true, reminder });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error creating reminder");
    res.status(500).json({ success: false, error: "Failed to create reminder" });
  }
});

router.patch("/reminders/:reminderId", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const { reminderId } = req.params;
    const updates = req.body;

    const [encExisting] = await phiDb.select().from(medicationRemindersTable)
      .where(and(eq(medicationRemindersTable.id, reminderId), eq(medicationRemindersTable.profileId, profileId)));

    if (!encExisting) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }
    const existing = decryptPhiRow("medicationRemindersTable", encExisting);

    logHipaaAudit("REMINDER_UPDATE", { profileId: hashIdentifier(profileId), reminderId: hashIdentifier(reminderId) });

    const [encReminder] = await phiDb.update(medicationRemindersTable)
      .set(encryptPhiRow("medicationRemindersTable", {
        medicationName: updates.medicationName || existing.medicationName,
        dosage: updates.dosage !== undefined ? updates.dosage : existing.dosage,
        frequency: updates.frequency || existing.frequency,
        scheduledTimes: updates.scheduledTimes || existing.scheduledTimes,
        daysOfWeek: updates.daysOfWeek !== undefined ? updates.daysOfWeek : existing.daysOfWeek,
        isActive: updates.isActive !== undefined ? updates.isActive : existing.isActive,
        notifyPush: updates.notifyPush !== undefined ? updates.notifyPush : existing.notifyPush,
        notifyEmail: updates.notifyEmail !== undefined ? updates.notifyEmail : existing.notifyEmail,
        notifySms: updates.notifySms !== undefined ? updates.notifySms : existing.notifySms,
        advanceMinutes: updates.advanceMinutes || existing.advanceMinutes,
        updatedAt: new Date(),
      }))
      .where(eq(medicationRemindersTable.id, reminderId))
      .returning();
    const reminder = encReminder ? decryptPhiRow("medicationRemindersTable", encReminder) : encReminder;

    res.json({ success: true, reminder });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error updating reminder");
    res.status(500).json({ success: false, error: "Failed to update reminder" });
  }
});

router.delete("/reminders/:reminderId", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const { reminderId } = req.params;

    const [existing] = await phiDb.select().from(medicationRemindersTable)
      .where(and(eq(medicationRemindersTable.id, reminderId), eq(medicationRemindersTable.profileId, profileId)));

    if (!existing) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }

    logHipaaAudit("REMINDER_DELETE", { profileId: hashIdentifier(profileId), reminderId: hashIdentifier(reminderId) });

    await phiDb.delete(medicationRemindersTable).where(eq(medicationRemindersTable.id, reminderId));

    res.json({ success: true, message: "Reminder deleted" });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error deleting reminder");
    res.status(500).json({ success: false, error: "Failed to delete reminder" });
  }
});

router.post("/adherence", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    
    const validation = logAdherenceSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error.errors[0]?.message || "Invalid request data" 
      });
    }

    const { medicationId, reminderId, medicationName, scheduledTime, actualTime, status, notes, sideEffects, mood } = validation.data;

    logHipaaAudit("ADHERENCE_LOG", { profileId: hashIdentifier(profileId), medicationName, status });

    const [encLog] = await phiDb.insert(medicationAdherenceLogsTable).values(encryptPhiRow("medicationAdherenceLogsTable", {
      profileId,
      medicationId: medicationId || null,
      reminderId: reminderId || null,
      medicationName,
      scheduledTime: new Date(scheduledTime),
      actualTime: actualTime ? new Date(actualTime) : null,
      status,
      notes: notes || null,
      sideEffects: sideEffects || null,
      mood: mood || null,
    })).returning();
    const log = encLog ? decryptPhiRow("medicationAdherenceLogsTable", encLog) : encLog;

    res.json({ success: true, log });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error logging adherence");
    res.status(500).json({ success: false, error: "Failed to log adherence" });
  }
});

router.get("/adherence", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const { startDate, endDate, medicationId } = req.query;

    logHipaaAudit("ADHERENCE_VIEW", { profileId: hashIdentifier(profileId) });

    const logs = decryptPhiRows("medicationAdherenceLogsTable", await phiDb.select().from(medicationAdherenceLogsTable)
      .where(eq(medicationAdherenceLogsTable.profileId, profileId))
      .orderBy(desc(medicationAdherenceLogsTable.scheduledTime)));

    let filteredLogs = logs;
    if (startDate) {
      filteredLogs = filteredLogs.filter((l: any) => new Date(l.scheduledTime) >= new Date(startDate as string));
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter((l: any) => new Date(l.scheduledTime) <= new Date(endDate as string));
    }
    if (medicationId) {
      filteredLogs = filteredLogs.filter((l: any) => l.medicationId === medicationId);
    }

    const stats = calculateAdherenceStats(filteredLogs);

    res.json({ success: true, logs: filteredLogs, stats });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching adherence");
    res.status(500).json({ success: false, error: "Failed to fetch adherence data" });
  }
});

function calculateAdherenceStats(logs: any[]) {
  const total = logs.length;
  const taken = logs.filter(l => l.status === "taken").length;
  const late = logs.filter(l => l.status === "late").length;
  const skipped = logs.filter(l => l.status === "skipped").length;
  const missed = logs.filter(l => l.status === "missed").length;

  return {
    total,
    taken,
    late,
    skipped,
    missed,
    adherenceRate: total > 0 ? Math.round(((taken + late) / total) * 100) : 0,
    onTimeRate: total > 0 ? Math.round((taken / total) * 100) : 0,
  };
}

router.get("/interactions", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;
    const showResolved = req.query.showResolved === "true";

    logHipaaAudit("INTERACTIONS_VIEW", { profileId: hashIdentifier(profileId) });

    const flags = decryptPhiRows("medicationInteractionFlagsTable", await phiDb.select().from(medicationInteractionFlagsTable)
      .where(eq(medicationInteractionFlagsTable.profileId, profileId))
      .orderBy(desc(medicationInteractionFlagsTable.createdAt)));

    const filteredFlags = showResolved ? flags : flags.filter(f => f.status !== "resolved" && f.status !== "dismissed");

    res.json({ 
      success: true, 
      interactions: filteredFlags,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching interactions");
    res.status(500).json({ success: false, error: "Failed to fetch interactions" });
  }
});

router.post("/interactions/check", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;

    logHipaaAudit("INTERACTION_CHECK", { profileId: hashIdentifier(profileId) });

    const medications = decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable)
      .where(and(eq(medicationsTable.profileId, profileId), eq(medicationsTable.status, "active"))));

    if (medications.length < 2) {
      return res.json({ 
        success: true, 
        interactions: [], 
        message: "Need at least 2 active medications to check interactions",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }

    const interactions = await checkDrugInteractionsWithAI(profileId, medications);

    for (const interaction of interactions) {
      // Existence check on plaintext medication names — Action Item I
      // note: this is an in-memory filter against decrypted rows, NOT
      // a SQL `eq(.*name)` predicate, so it does not trigger the
      // encryption-search incompatibility class.
      const existingFlags = decryptPhiRows("medicationInteractionFlagsTable", await phiDb.select().from(medicationInteractionFlagsTable)
        .where(and(
          eq(medicationInteractionFlagsTable.profileId, profileId),
          eq(medicationInteractionFlagsTable.status, "pending"),
        )));
      const existing = existingFlags.filter(f =>
        f.medication1Name === interaction.medication1Name &&
        f.medication2Name === interaction.medication2Name,
      );

      if (existing.length === 0) {
        await phiDb.insert(medicationInteractionFlagsTable).values(encryptPhiRow("medicationInteractionFlagsTable", {
          profileId,
          medication1Id: interaction.medication1Id,
          medication1Name: interaction.medication1Name,
          medication2Id: interaction.medication2Id,
          medication2Name: interaction.medication2Name,
          severity: interaction.severity,
          interactionType: interaction.interactionType,
          description: interaction.description,
          recommendation: interaction.recommendation,
          aiGenerated: true,
          status: "pending",
        }));
      }
    }

    const allFlags = decryptPhiRows("medicationInteractionFlagsTable", await phiDb.select().from(medicationInteractionFlagsTable)
      .where(and(eq(medicationInteractionFlagsTable.profileId, profileId), eq(medicationInteractionFlagsTable.status, "pending")))
      .orderBy(desc(medicationInteractionFlagsTable.createdAt)));

    res.json({ 
      success: true, 
      interactions: allFlags,
      newInteractionsFound: interactions.length,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error checking interactions");
    res.status(500).json({ success: false, error: "Failed to check interactions" });
  }
});

async function checkDrugInteractionsWithAI(profileId: string, medications: any[]): Promise<any[]> {
  try {
    const medNames = medications.map(m => m.name).join(", ");
    
    const content = await generatePhiSafeText({
      system: `You are a medication information assistant. Analyze potential drug interactions between the provided medications.

IMPORTANT SAFETY GUIDELINES:
- Only use approved language: "shows", "states", "refers to", "means"
- Frame findings as "information to discuss with healthcare provider"
- Never provide medical advice or recommendations for changing medications
- Include source attribution where possible

Return a JSON array of potential interactions. Each interaction should have:
- medication1Name: string
- medication2Name: string
- severity: "low" | "moderate" | "high" | "critical"
- interactionType: string (e.g., "metabolism", "absorption", "effect enhancement")
- description: string (educational description of the interaction)
- recommendation: string (frame as "discuss with your healthcare provider")

If no significant interactions are found, return an empty array.`,
      user: `Analyze potential interactions between these medications: ${medNames}`,
      responseMimeType: "application/json",
      temperature: 0.3,
    });

    if (!content) return [];

    const parsed = JSON.parse(content);
    const interactions = parsed.interactions || parsed || [];

    return Array.isArray(interactions) ? interactions.map((i: any) => ({
      ...i,
      medication1Id: medications.find(m => m.name === i.medication1Name)?.id || null,
      medication2Id: medications.find(m => m.name === i.medication2Name)?.id || null,
    })) : [];
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "AI interaction check error");
    return getFallbackInteractions(medications);
  }
}

function getFallbackInteractions(medications: any[]): any[] {
  const knownInteractions: Record<string, { med2: string; severity: string; type: string; desc: string }[]> = {
    "warfarin": [
      { med2: "aspirin", severity: "high", type: "bleeding risk", desc: "Medical literature states that combining these medications may increase bleeding risk. Discuss with your healthcare provider." },
      { med2: "ibuprofen", severity: "high", type: "bleeding risk", desc: "Medical references show that NSAIDs may affect blood clotting when taken with blood thinners. Consult your provider." },
    ],
    "metformin": [
      { med2: "alcohol", severity: "moderate", type: "lactic acidosis", desc: "Healthcare resources indicate that alcohol consumption may affect metformin metabolism. Discuss limits with your provider." },
    ],
    "lisinopril": [
      { med2: "potassium", severity: "moderate", type: "hyperkalemia", desc: "Medical literature shows ACE inhibitors may affect potassium levels. Your provider may want to monitor this." },
    ],
  };

  const found: any[] = [];
  const medNamesLower = medications.map(m => ({ id: m.id, name: m.name, lower: m.name.toLowerCase() }));

  for (const med of medNamesLower) {
    const interactions = knownInteractions[med.lower];
    if (interactions) {
      for (const interaction of interactions) {
        const otherMed = medNamesLower.find(m => m.lower.includes(interaction.med2) || interaction.med2.includes(m.lower));
        if (otherMed) {
          found.push({
            medication1Id: med.id,
            medication1Name: med.name,
            medication2Id: otherMed.id,
            medication2Name: otherMed.name,
            severity: interaction.severity,
            interactionType: interaction.type,
            description: interaction.desc,
            recommendation: "Discuss this potential interaction with your healthcare provider at your next visit.",
          });
        }
      }
    }
  }

  return found;
}

router.get("/provider/medications/:profileId", requireAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).authenticatedUserId;
    const { profileId } = req.params;

    logHipaaAudit("PROVIDER_MEDICATIONS_VIEW", { providerId: hashIdentifier(providerId), profileId: hashIdentifier(profileId) });

    const medications = decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable)
      .where(eq(medicationsTable.profileId, profileId))
      .orderBy(desc(medicationsTable.createdAt)));

    const reminders = decryptPhiRows("medicationRemindersTable", await phiDb.select().from(medicationRemindersTable)
      .where(eq(medicationRemindersTable.profileId, profileId))
      .orderBy(desc(medicationRemindersTable.createdAt)));

    const adherenceLogs = decryptPhiRows("medicationAdherenceLogsTable", await phiDb.select().from(medicationAdherenceLogsTable)
      .where(eq(medicationAdherenceLogsTable.profileId, profileId))
      .orderBy(desc(medicationAdherenceLogsTable.scheduledTime))
      .limit(100));

    const interactionFlags = decryptPhiRows("medicationInteractionFlagsTable", await phiDb.select().from(medicationInteractionFlagsTable)
      .where(eq(medicationInteractionFlagsTable.profileId, profileId))
      .orderBy(desc(medicationInteractionFlagsTable.createdAt)));

    const stats = calculateAdherenceStats(adherenceLogs);

    res.json({
      success: true,
      medications,
      reminders,
      adherenceStats: stats,
      recentAdherenceLogs: adherenceLogs.slice(0, 20),
      interactionFlags,
    });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching provider view");
    res.status(500).json({ success: false, error: "Failed to fetch patient medication data" });
  }
});

router.post("/provider/medications/:profileId/action", requireAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).authenticatedUserId;
    const { profileId } = req.params;
    const { medicationId, medicationName, actionType, previousValue, newValue, reason, providerName } = req.body;

    if (!medicationName || !actionType || !providerName) {
      return res.status(400).json({ success: false, error: "Medication name, action type, and provider name are required" });
    }

    logHipaaAudit("PROVIDER_MEDICATION_ACTION", { 
      providerId: hashIdentifier(providerId), 
      profileId: hashIdentifier(profileId),
      actionType,
      medicationName 
    });

    const [encAction] = await phiDb.insert(providerMedicationActionsTable).values(encryptPhiRow("providerMedicationActionsTable", {
      profileId,
      medicationId: medicationId || null,
      medicationName,
      actionType,
      previousValue: previousValue || null,
      newValue: newValue || null,
      reason: reason || null,
      providerId,
      providerName,
    })).returning();
    const action = encAction ? decryptPhiRow("providerMedicationActionsTable", encAction) : encAction;

    if (medicationId && (actionType === "dose_change" || actionType === "frequency_change" || actionType === "discontinue")) {
      const updateData: any = {};
      if (actionType === "dose_change" && newValue) updateData.dose = newValue;
      if (actionType === "frequency_change" && newValue) updateData.frequency = newValue;
      if (actionType === "discontinue") {
        updateData.status = "discontinued";
        updateData.endDate = new Date().toISOString().split("T")[0];
      }

      if (Object.keys(updateData).length > 0) {
        await phiDb.update(medicationsTable)
          .set(encryptPhiRow("medicationsTable", updateData))
          .where(eq(medicationsTable.id, medicationId));
      }
    }

    res.json({ success: true, action });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error logging provider action");
    res.status(500).json({ success: false, error: "Failed to log provider action" });
  }
});

router.patch("/provider/interactions/:flagId/review", requireAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).authenticatedUserId;
    const { flagId } = req.params;
    const { status, reviewNotes, providerName } = req.body;

    if (!status || !["reviewed", "dismissed", "resolved"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid status required (reviewed, dismissed, resolved)" });
    }

    logHipaaAudit("PROVIDER_INTERACTION_REVIEW", { 
      providerId: hashIdentifier(providerId), 
      flagId: hashIdentifier(flagId),
      status 
    });

    const [encUpdated] = await phiDb.update(medicationInteractionFlagsTable)
      .set(encryptPhiRow("medicationInteractionFlagsTable", {
        status,
        reviewedBy: providerName || providerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      }))
      .where(eq(medicationInteractionFlagsTable.id, flagId))
      .returning();

    if (!encUpdated) {
      return res.status(404).json({ success: false, error: "Interaction flag not found" });
    }
    const updated = decryptPhiRow("medicationInteractionFlagsTable", encUpdated);

    res.json({ success: true, interactionFlag: updated });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error reviewing interaction");
    res.status(500).json({ success: false, error: "Failed to review interaction" });
  }
});

router.get("/provider/actions/:profileId", requireAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).authenticatedUserId;
    const { profileId } = req.params;

    logHipaaAudit("PROVIDER_ACTIONS_VIEW", { providerId: hashIdentifier(providerId), profileId: hashIdentifier(profileId) });

    const actions = decryptPhiRows("providerMedicationActionsTable", await phiDb.select().from(providerMedicationActionsTable)
      .where(eq(providerMedicationActionsTable.profileId, profileId))
      .orderBy(desc(providerMedicationActionsTable.createdAt)));

    res.json({ success: true, actions });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching provider actions");
    res.status(500).json({ success: false, error: "Failed to fetch provider actions" });
  }
});

router.get("/summary", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId;

    logHipaaAudit("MEDICATION_SUMMARY", { profileId: hashIdentifier(profileId) });

    const medications = decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable)
      .where(and(eq(medicationsTable.profileId, profileId), eq(medicationsTable.status, "active"))));

    const reminders = decryptPhiRows("medicationRemindersTable", await phiDb.select().from(medicationRemindersTable)
      .where(and(eq(medicationRemindersTable.profileId, profileId), eq(medicationRemindersTable.isActive, true))));

    const recentLogs = decryptPhiRows("medicationAdherenceLogsTable", await phiDb.select().from(medicationAdherenceLogsTable)
      .where(eq(medicationAdherenceLogsTable.profileId, profileId))
      .orderBy(desc(medicationAdherenceLogsTable.scheduledTime))
      .limit(50));

    const pendingInteractions = decryptPhiRows("medicationInteractionFlagsTable", await phiDb.select().from(medicationInteractionFlagsTable)
      .where(and(eq(medicationInteractionFlagsTable.profileId, profileId), eq(medicationInteractionFlagsTable.status, "pending"))));

    const stats = calculateAdherenceStats(recentLogs);

    res.json({
      success: true,
      summary: {
        activeMedications: medications.length,
        activeReminders: reminders.length,
        adherenceRate: stats.adherenceRate,
        pendingInteractions: pendingInteractions.length,
        criticalInteractions: pendingInteractions.filter(i => i.severity === "critical" || i.severity === "high").length,
      },
      medications,
      reminders,
      recentAdherence: recentLogs.slice(0, 10),
      interactions: pendingInteractions,
      disclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    logger.error({ component: "MedMgmt", err: error }, "Error fetching summary");
    res.status(500).json({ success: false, error: "Failed to fetch medication summary" });
  }
});

export function registerMedicationManagementRoutes(app: any): void {
  app.use("/api/medication-management", router);
  logger.info({ component: "Routes" }, "Medication Management routes registered at /api/medication-management/*");
}

export default router;
