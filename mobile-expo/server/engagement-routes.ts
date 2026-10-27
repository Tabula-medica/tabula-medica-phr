// @ts-nocheck
import express, { Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, count, ne } from "drizzle-orm";
import {
  medicationSchedules,
  adherenceLogs,
  healthJournalEntries,
  patientBadges,
  patientStreaks,
  healthRecords,
  users,
  patientProfiles,
} from "@shared/schema";
import { chatComplete } from "./ai-client";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || (req as any).user?.id || "";
}

export function registerEngagementRoutes(app: express.Express, requireAuth: any) {
  // ============================================
  // MEDICATION ADHERENCE
  // ============================================

  app.get("/api/medications", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const meds = await db
        .select()
        .from(medicationSchedules)
        .where(eq(medicationSchedules.userId, userId))
        .orderBy(desc(medicationSchedules.createdAt));
      res.json(meds);
    } catch (error) {
      console.error("Get medications error:", error);
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });

  app.post("/api/medications", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { medicationName, dosage, frequency, timesPerDay, scheduledTimes, instructions, prescribedBy, rxNormCode, startDate, endDate, remindersEnabled, reminderMinutesBefore, refillDate, pillCount } = req.body;

      if (!medicationName || !frequency) {
        return res.status(400).json({ error: "Medication name and frequency are required" });
      }

      const [med] = await db
        .insert(medicationSchedules)
        .values({
          userId,
          medicationName,
          dosage: dosage || null,
          frequency,
          timesPerDay: timesPerDay || 1,
          scheduledTimes: scheduledTimes || ["08:00"],
          instructions: instructions || null,
          prescribedBy: prescribedBy || null,
          rxNormCode: rxNormCode || null,
          startDate: new Date(startDate || Date.now()),
          endDate: endDate ? new Date(endDate) : null,
          remindersEnabled: remindersEnabled !== false,
          reminderMinutesBefore: reminderMinutesBefore || 15,
          refillDate: refillDate ? new Date(refillDate) : null,
          pillCount: pillCount || null,
        })
        .returning();

      await checkAndAwardBadge(userId, "first_medication", "First Medication Added", "Added your first medication to track", "plus-circle");

      res.status(201).json(med);
    } catch (error) {
      console.error("Create medication error:", error);
      res.status(500).json({ error: "Failed to create medication" });
    }
  });

  app.put("/api/medications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };

      if (req.body.medicationName !== undefined) updates.medicationName = req.body.medicationName;
      if (req.body.dosage !== undefined) updates.dosage = req.body.dosage;
      if (req.body.frequency !== undefined) updates.frequency = req.body.frequency;
      if (req.body.timesPerDay !== undefined) updates.timesPerDay = req.body.timesPerDay;
      if (req.body.scheduledTimes !== undefined) updates.scheduledTimes = req.body.scheduledTimes;
      if (req.body.instructions !== undefined) updates.instructions = req.body.instructions;
      if (req.body.prescribedBy !== undefined) updates.prescribedBy = req.body.prescribedBy;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.remindersEnabled !== undefined) updates.remindersEnabled = req.body.remindersEnabled;
      if (req.body.reminderMinutesBefore !== undefined) updates.reminderMinutesBefore = req.body.reminderMinutesBefore;
      if (req.body.pillCount !== undefined) updates.pillCount = req.body.pillCount;
      if (req.body.endDate !== undefined) updates.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
      if (req.body.refillDate !== undefined) updates.refillDate = req.body.refillDate ? new Date(req.body.refillDate) : null;

      const [updated] = await db
        .update(medicationSchedules)
        .set(updates)
        .where(and(eq(medicationSchedules.id, id), eq(medicationSchedules.userId, userId)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Medication not found" });
      res.json(updated);
    } catch (error) {
      console.error("Update medication error:", error);
      res.status(500).json({ error: "Failed to update medication" });
    }
  });

  app.delete("/api/medications/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const [deleted] = await db
        .delete(medicationSchedules)
        .where(and(eq(medicationSchedules.id, id), eq(medicationSchedules.userId, userId)))
        .returning();

      if (!deleted) return res.status(404).json({ error: "Medication not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete medication error:", error);
      res.status(500).json({ error: "Failed to delete medication" });
    }
  });

  app.post("/api/medications/:id/log", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { status, scheduledTime, notes, skippedReason } = req.body;

      if (!status || !["taken", "skipped", "missed"].includes(status)) {
        return res.status(400).json({ error: "Valid status required: taken, skipped, or missed" });
      }

      const [log] = await db
        .insert(adherenceLogs)
        .values({
          userId,
          scheduleId: id,
          scheduledTime: new Date(scheduledTime || Date.now()),
          status,
          takenAt: status === "taken" ? new Date() : null,
          skippedReason: skippedReason || null,
          notes: notes || null,
        })
        .returning();

      await updateMedicationStreak(userId);
      await checkAdherenceBadges(userId);

      res.status(201).json(log);
    } catch (error) {
      console.error("Log adherence error:", error);
      res.status(500).json({ error: "Failed to log adherence" });
    }
  });

  app.get("/api/medications/:id/logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const logs = await db
        .select()
        .from(adherenceLogs)
        .where(and(
          eq(adherenceLogs.userId, userId),
          eq(adherenceLogs.scheduleId, id),
          gte(adherenceLogs.createdAt, since)
        ))
        .orderBy(desc(adherenceLogs.createdAt));

      res.json(logs);
    } catch (error) {
      console.error("Get adherence logs error:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/medications/adherence-stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const logs = await db
        .select()
        .from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, userId), gte(adherenceLogs.createdAt, since)));

      const total = logs.length;
      const taken = logs.filter(l => l.status === "taken").length;
      const skipped = logs.filter(l => l.status === "skipped").length;
      const missed = logs.filter(l => l.status === "missed").length;
      const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

      const streakData = await db
        .select()
        .from(patientStreaks)
        .where(and(eq(patientStreaks.userId, userId), eq(patientStreaks.streakType, "medication")));

      const streak = streakData[0] || { currentStreak: 0, longestStreak: 0 };

      res.json({
        total,
        taken,
        skipped,
        missed,
        adherenceRate,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        period: `${days} days`,
      });
    } catch (error) {
      console.error("Get adherence stats error:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // ============================================
  // HEALTH JOURNAL
  // ============================================

  app.get("/api/journal", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const entries = await db
        .select()
        .from(healthJournalEntries)
        .where(eq(healthJournalEntries.userId, userId))
        .orderBy(desc(healthJournalEntries.entryDate))
        .limit(limit)
        .offset(offset);

      res.json(entries);
    } catch (error) {
      console.error("Get journal entries error:", error);
      res.status(500).json({ error: "Failed to fetch journal entries" });
    }
  });

  app.post("/api/journal", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { entryType, title, content, mood, painLevel, energyLevel, symptoms, tags, entryDate } = req.body;

      if (!entryType) {
        return res.status(400).json({ error: "Entry type is required" });
      }

      const [entry] = await db
        .insert(healthJournalEntries)
        .values({
          userId,
          entryType,
          title: title || null,
          content: content || null,
          mood: mood !== undefined ? mood : null,
          painLevel: painLevel !== undefined ? painLevel : null,
          energyLevel: energyLevel !== undefined ? energyLevel : null,
          symptoms: symptoms || null,
          tags: tags || null,
          entryDate: new Date(entryDate || Date.now()),
        })
        .returning();

      await updateJournalStreak(userId);
      await checkJournalBadges(userId);

      res.status(201).json(entry);
    } catch (error) {
      console.error("Create journal entry error:", error);
      res.status(500).json({ error: "Failed to create journal entry" });
    }
  });

  app.put("/api/journal/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };

      if (req.body.entryType !== undefined) updates.entryType = req.body.entryType;
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.content !== undefined) updates.content = req.body.content;
      if (req.body.mood !== undefined) updates.mood = req.body.mood;
      if (req.body.painLevel !== undefined) updates.painLevel = req.body.painLevel;
      if (req.body.energyLevel !== undefined) updates.energyLevel = req.body.energyLevel;
      if (req.body.symptoms !== undefined) updates.symptoms = req.body.symptoms;
      if (req.body.tags !== undefined) updates.tags = req.body.tags;

      const [updated] = await db
        .update(healthJournalEntries)
        .set(updates)
        .where(and(eq(healthJournalEntries.id, id), eq(healthJournalEntries.userId, userId)))
        .returning();

      if (!updated) return res.status(404).json({ error: "Entry not found" });
      res.json(updated);
    } catch (error) {
      console.error("Update journal entry error:", error);
      res.status(500).json({ error: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const [deleted] = await db
        .delete(healthJournalEntries)
        .where(and(eq(healthJournalEntries.id, id), eq(healthJournalEntries.userId, userId)))
        .returning();

      if (!deleted) return res.status(404).json({ error: "Entry not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Delete journal entry error:", error);
      res.status(500).json({ error: "Failed to delete journal entry" });
    }
  });

  // ============================================
  // GAMIFICATION
  // ============================================

  app.get("/api/gamification/summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const badges = await db
        .select()
        .from(patientBadges)
        .where(eq(patientBadges.userId, userId))
        .orderBy(desc(patientBadges.earnedAt));

      const streaks = await db
        .select()
        .from(patientStreaks)
        .where(eq(patientStreaks.userId, userId));

      const journalCount = await db
        .select({ count: count() })
        .from(healthJournalEntries)
        .where(eq(healthJournalEntries.userId, userId));

      const adherenceLogsCount = await db
        .select({ count: count() })
        .from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, userId), eq(adherenceLogs.status, "taken")));

      const allBadgeDefinitions = getAllBadgeDefinitions();

      res.json({
        badges,
        streaks,
        totalJournalEntries: journalCount[0]?.count || 0,
        totalMedsTaken: adherenceLogsCount[0]?.count || 0,
        availableBadges: allBadgeDefinitions,
      });
    } catch (error) {
      console.error("Get gamification summary error:", error);
      res.status(500).json({ error: "Failed to fetch gamification data" });
    }
  });

  // ============================================
  // EDUCATIONAL CONTENT
  // ============================================

  app.get("/api/education/library", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const category = req.query.category as string;

      const records = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.userId, userId));

      const conditions = records.filter(r => r.type === "condition").map(r => r.title);
      const medications = records.filter(r => r.type === "medication").map(r => r.title);

      let library = getEducationLibrary();

      if (category) {
        library = library.filter(item => item.category === category);
      }

      const personalized = library.map(item => ({
        ...item,
        relevanceScore: calculateRelevance(item, conditions, medications),
      }));

      personalized.sort((a, b) => b.relevanceScore - a.relevanceScore);

      res.json({
        articles: personalized,
        categories: ["conditions", "medications", "wellness", "nutrition", "mental_health", "preventive_care"],
        patientConditions: conditions,
        patientMedications: medications,
      });
    } catch (error) {
      console.error("Get education library error:", error);
      res.status(500).json({ error: "Failed to fetch education library" });
    }
  });

  app.get("/api/education/article/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const library = getEducationLibrary();
      const article = library.find(a => a.id === id);

      if (!article) return res.status(404).json({ error: "Article not found" });

      await checkAndAwardBadge(getUserId(req), "first_article", "Knowledge Seeker", "Read your first educational article", "book-open");

      res.json(article);
    } catch (error) {
      console.error("Get article error:", error);
      res.status(500).json({ error: "Failed to fetch article" });
    }
  });

  // ============================================
  // AI ONBOARDING - REVIEW OF SYSTEMS
  // ============================================

  app.post("/api/onboarding/ros-review", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { organSystem, language, existingRecords, previousAnswers } = req.body;

      if (!organSystem) {
        return res.status(400).json({ error: "Organ system is required" });
      }

      const langName = getLanguageName(language || "en");

      const records = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.userId, userId));

      const conditions = records.filter(r => r.type === "condition").map(r => r.title);
      const medications = records.filter(r => r.type === "medication").map(r => r.title);
      const allergies = records.filter(r => r.type === "allergy").map(r => r.title);

      const systemPrompt = `You are a patient health history intake assistant. You help patients complete their Review of Systems (ROS) during onboarding. You ask clear, simple questions about the ${organSystem} system.

CRITICAL RULES:
- NEVER give medical advice, diagnoses, or treatment recommendations
- NEVER interpret symptoms or suggest what they might mean
- Only ask questions to gather health history information
- Ask one question at a time
- Use simple, patient-friendly language
- Respond in ${langName}
- If the patient mentions a symptom, acknowledge it and ask a follow-up about severity, duration, or frequency
- Be warm, professional, and supportive

Known patient data to reference (do not repeat what's already recorded):
- Conditions: ${conditions.join(", ") || "None recorded"}
- Medications: ${medications.join(", ") || "None recorded"}
- Allergies: ${allergies.join(", ") || "None recorded"}

Previous answers for this system: ${JSON.stringify(previousAnswers || {})}`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Ask me questions about my ${organSystem} health history. ${previousAnswers ? "Continue from where we left off." : "Start with the first question."}` },
      ];

      const completion = await chatComplete({
        model: "fast",
        messages,
        maxOutputTokens: 300,
        temperature: 0.7,
        dataCategories: ["demographics", "conditions", "medications"],
        purpose: "documentation",
        callerService: "engagement-routes",
        callerMethod: "rosReview",
      });

      const question = completion.content || "";

      res.json({
        question,
        organSystem,
        language: language || "en",
        prepopulated: {
          conditions: conditions.filter(c => isRelatedToSystem(c, organSystem)),
          medications: medications.filter(m => isRelatedToSystem(m, organSystem)),
        },
      });
    } catch (error) {
      console.error("ROS review error:", error);
      res.status(500).json({ error: "Failed to generate ROS questions" });
    }
  });

  app.get("/api/onboarding/organ-systems", requireAuth, async (_req: Request, res: Response) => {
    res.json({
      systems: [
        { id: "general", name: "General / Constitutional", icon: "activity" },
        { id: "heent", name: "Head, Eyes, Ears, Nose, Throat", icon: "eye" },
        { id: "cardiovascular", name: "Cardiovascular", icon: "heart" },
        { id: "respiratory", name: "Respiratory", icon: "wind" },
        { id: "gastrointestinal", name: "Gastrointestinal", icon: "circle" },
        { id: "genitourinary", name: "Genitourinary", icon: "droplet" },
        { id: "musculoskeletal", name: "Musculoskeletal", icon: "move" },
        { id: "neurological", name: "Neurological", icon: "cpu" },
        { id: "psychiatric", name: "Psychiatric / Mental Health", icon: "smile" },
        { id: "skin", name: "Skin / Integumentary", icon: "sun" },
        { id: "endocrine", name: "Endocrine / Metabolic", icon: "thermometer" },
        { id: "hematologic", name: "Hematologic / Lymphatic", icon: "droplet" },
      ],
    });
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkAndAwardBadge(userId: string, badgeType: string, badgeName: string, description: string, iconName: string) {
  try {
    const existing = await db
      .select()
      .from(patientBadges)
      .where(and(eq(patientBadges.userId, userId), eq(patientBadges.badgeType, badgeType)));

    if (existing.length === 0) {
      await db.insert(patientBadges).values({
        userId,
        badgeType,
        badgeName,
        description,
        iconName,
      });
    }
  } catch (error) {
    console.error("Award badge error:", error);
  }
}

async function updateMedicationStreak(userId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(patientStreaks)
      .where(and(eq(patientStreaks.userId, userId), eq(patientStreaks.streakType, "medication")));

    if (existing.length === 0) {
      await db.insert(patientStreaks).values({
        userId,
        streakType: "medication",
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
      });
      return;
    }

    const streak = existing[0];
    const lastDate = streak.lastActivityDate ? new Date(streak.lastActivityDate) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    if (lastDate && lastDate.getTime() === today.getTime()) return;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newCurrent = 1;
    if (lastDate && lastDate.getTime() === yesterday.getTime()) {
      newCurrent = streak.currentStreak + 1;
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);

    await db
      .update(patientStreaks)
      .set({ currentStreak: newCurrent, longestStreak: newLongest, lastActivityDate: today, updatedAt: new Date() })
      .where(eq(patientStreaks.id, streak.id));
  } catch (error) {
    console.error("Update medication streak error:", error);
  }
}

async function updateJournalStreak(userId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await db
      .select()
      .from(patientStreaks)
      .where(and(eq(patientStreaks.userId, userId), eq(patientStreaks.streakType, "journal")));

    if (existing.length === 0) {
      await db.insert(patientStreaks).values({
        userId,
        streakType: "journal",
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
      });
      return;
    }

    const streak = existing[0];
    const lastDate = streak.lastActivityDate ? new Date(streak.lastActivityDate) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);

    if (lastDate && lastDate.getTime() === today.getTime()) return;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newCurrent = 1;
    if (lastDate && lastDate.getTime() === yesterday.getTime()) {
      newCurrent = streak.currentStreak + 1;
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);

    await db
      .update(patientStreaks)
      .set({ currentStreak: newCurrent, longestStreak: newLongest, lastActivityDate: today, updatedAt: new Date() })
      .where(eq(patientStreaks.id, streak.id));
  } catch (error) {
    console.error("Update journal streak error:", error);
  }
}

async function checkAdherenceBadges(userId: string) {
  try {
    const takenCount = await db
      .select({ count: count() })
      .from(adherenceLogs)
      .where(and(eq(adherenceLogs.userId, userId), eq(adherenceLogs.status, "taken")));

    const total = takenCount[0]?.count || 0;

    if (total >= 1) await checkAndAwardBadge(userId, "first_dose", "First Dose", "Logged your first medication dose", "check-circle");
    if (total >= 7) await checkAndAwardBadge(userId, "week_warrior", "Week Warrior", "7 doses logged - a full week of consistency", "award");
    if (total >= 30) await checkAndAwardBadge(userId, "monthly_champion", "Monthly Champion", "30 doses logged - outstanding commitment", "star");
    if (total >= 100) await checkAndAwardBadge(userId, "century_club", "Century Club", "100 doses logged - incredible dedication", "trending-up");

    const streaks = await db
      .select()
      .from(patientStreaks)
      .where(and(eq(patientStreaks.userId, userId), eq(patientStreaks.streakType, "medication")));

    if (streaks.length > 0 && streaks[0].currentStreak >= 7) {
      await checkAndAwardBadge(userId, "streak_7", "7-Day Streak", "Maintained a 7-day medication streak", "zap");
    }
    if (streaks.length > 0 && streaks[0].currentStreak >= 30) {
      await checkAndAwardBadge(userId, "streak_30", "30-Day Streak", "Maintained a 30-day medication streak", "shield");
    }
  } catch (error) {
    console.error("Check adherence badges error:", error);
  }
}

async function checkJournalBadges(userId: string) {
  try {
    const entryCount = await db
      .select({ count: count() })
      .from(healthJournalEntries)
      .where(eq(healthJournalEntries.userId, userId));

    const total = entryCount[0]?.count || 0;

    if (total >= 1) await checkAndAwardBadge(userId, "first_journal", "Journal Starter", "Created your first health journal entry", "edit-3");
    if (total >= 7) await checkAndAwardBadge(userId, "journal_7", "Thoughtful Tracker", "7 journal entries - building healthy habits", "feather");
    if (total >= 30) await checkAndAwardBadge(userId, "journal_30", "Health Chronicler", "30 journal entries - truly dedicated", "book");
  } catch (error) {
    console.error("Check journal badges error:", error);
  }
}

function getAllBadgeDefinitions() {
  return [
    { type: "first_medication", name: "First Medication Added", description: "Add your first medication to track", icon: "plus-circle", category: "medication" },
    { type: "first_dose", name: "First Dose", description: "Log your first medication dose", icon: "check-circle", category: "medication" },
    { type: "week_warrior", name: "Week Warrior", description: "Log 7 medication doses", icon: "award", category: "medication" },
    { type: "monthly_champion", name: "Monthly Champion", description: "Log 30 medication doses", icon: "star", category: "medication" },
    { type: "century_club", name: "Century Club", description: "Log 100 medication doses", icon: "trending-up", category: "medication" },
    { type: "streak_7", name: "7-Day Streak", description: "Maintain a 7-day medication streak", icon: "zap", category: "streak" },
    { type: "streak_30", name: "30-Day Streak", description: "Maintain a 30-day medication streak", icon: "shield", category: "streak" },
    { type: "first_journal", name: "Journal Starter", description: "Create your first health journal entry", icon: "edit-3", category: "journal" },
    { type: "journal_7", name: "Thoughtful Tracker", description: "Create 7 journal entries", icon: "feather", category: "journal" },
    { type: "journal_30", name: "Health Chronicler", description: "Create 30 journal entries", icon: "book", category: "journal" },
    { type: "first_article", name: "Knowledge Seeker", description: "Read your first educational article", icon: "book-open", category: "education" },
    { type: "onboarding_complete", name: "Getting Started", description: "Complete the health onboarding process", icon: "flag", category: "onboarding" },
  ];
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    zh: "Chinese (Simplified)",
    ar: "Arabic",
    pt: "Portuguese (Brazilian)",
    vi: "Vietnamese",
    ko: "Korean",
  };
  return names[code] || "English";
}

function isRelatedToSystem(term: string, system: string): boolean {
  const systemKeywords: Record<string, string[]> = {
    general: ["fatigue", "fever", "weight", "appetite", "sleep"],
    heent: ["headache", "vision", "hearing", "sinus", "throat", "ear", "eye", "nose"],
    cardiovascular: ["heart", "chest pain", "palpitation", "hypertension", "blood pressure", "cholesterol"],
    respiratory: ["breathing", "cough", "asthma", "copd", "lung", "shortness of breath", "pneumonia"],
    gastrointestinal: ["stomach", "nausea", "diarrhea", "constipation", "gerd", "reflux", "liver", "gallbladder"],
    genitourinary: ["kidney", "bladder", "urinary", "uti"],
    musculoskeletal: ["joint", "muscle", "back pain", "arthritis", "osteoporosis", "bone"],
    neurological: ["seizure", "migraine", "neuropathy", "numbness", "tingling", "stroke", "parkinson"],
    psychiatric: ["anxiety", "depression", "insomnia", "ptsd", "bipolar", "adhd"],
    skin: ["rash", "eczema", "psoriasis", "acne", "dermatitis", "skin"],
    endocrine: ["diabetes", "thyroid", "insulin", "glucose", "hormonal", "metabolic"],
    hematologic: ["anemia", "blood", "lymph", "clotting", "platelet"],
  };

  const lower = term.toLowerCase();
  const keywords = systemKeywords[system] || [];
  return keywords.some(k => lower.includes(k));
}

function calculateRelevance(article: any, conditions: string[], medications: string[]): number {
  let score = 0;
  const lower = (article.title + " " + article.description + " " + (article.relatedConditions || []).join(" ")).toLowerCase();

  for (const condition of conditions) {
    if (lower.includes(condition.toLowerCase())) score += 10;
  }
  for (const med of medications) {
    if (lower.includes(med.toLowerCase())) score += 5;
  }

  return score;
}

function getEducationLibrary() {
  return [
    {
      id: "diabetes-management",
      title: "Understanding Diabetes Management",
      description: "Learn about blood sugar monitoring, lifestyle changes, and daily management strategies.",
      category: "conditions",
      readTime: 8,
      relatedConditions: ["diabetes", "type 2 diabetes", "type 1 diabetes", "prediabetes"],
      content: "Diabetes is a condition where your body has difficulty managing blood sugar levels. Regular monitoring, balanced meals, physical activity, and following your care plan are essential parts of daily management. Work with your healthcare team to set personalized goals for blood sugar, diet, and exercise.",
    },
    {
      id: "hypertension-basics",
      title: "Blood Pressure: What You Need to Know",
      description: "Understanding blood pressure readings, risk factors, and healthy habits.",
      category: "conditions",
      readTime: 6,
      relatedConditions: ["hypertension", "high blood pressure", "cardiovascular"],
      content: "Blood pressure measures how hard your blood pushes against artery walls. Normal is below 120/80. High blood pressure often has no symptoms but increases risk for heart disease and stroke. Reducing sodium, staying active, managing stress, and taking prescribed medications can help maintain healthy levels.",
    },
    {
      id: "cholesterol-guide",
      title: "Cholesterol and Heart Health",
      description: "Understanding cholesterol levels and their impact on cardiovascular health.",
      category: "conditions",
      readTime: 7,
      relatedConditions: ["high cholesterol", "hyperlipidemia", "cardiovascular disease"],
      content: "Cholesterol is a waxy substance in your blood. LDL ('bad') cholesterol can build up in arteries, while HDL ('good') cholesterol helps remove it. A heart-healthy diet, regular exercise, and sometimes medication can help manage cholesterol levels.",
    },
    {
      id: "asthma-management",
      title: "Living Well with Asthma",
      description: "Recognizing triggers, using inhalers properly, and managing asthma day-to-day.",
      category: "conditions",
      readTime: 7,
      relatedConditions: ["asthma", "reactive airway", "bronchospasm"],
      content: "Asthma causes airway inflammation and narrowing. Knowing your triggers (allergens, exercise, cold air), using controller and rescue inhalers correctly, and having an action plan are key to managing symptoms and preventing flare-ups.",
    },
    {
      id: "anxiety-depression",
      title: "Understanding Anxiety and Depression",
      description: "Common mental health conditions, coping strategies, and when to seek help.",
      category: "mental_health",
      readTime: 9,
      relatedConditions: ["anxiety", "depression", "generalized anxiety disorder", "major depressive disorder"],
      content: "Anxiety and depression are common and treatable conditions. Symptoms can include persistent worry, sadness, fatigue, and difficulty concentrating. Regular exercise, adequate sleep, social connections, mindfulness practices, and professional support can all help manage these conditions.",
    },
    {
      id: "medication-safety",
      title: "Medication Safety Tips",
      description: "How to take medications safely, manage side effects, and avoid interactions.",
      category: "medications",
      readTime: 6,
      relatedConditions: [],
      content: "Always take medications as prescribed. Keep an updated medication list, inform all providers about what you take, ask about potential side effects and drug interactions, store medications properly, and never share prescription medications with others.",
    },
    {
      id: "pain-management",
      title: "Approaches to Pain Management",
      description: "Understanding different types of pain and non-pharmacological management strategies.",
      category: "conditions",
      readTime: 8,
      relatedConditions: ["chronic pain", "back pain", "arthritis", "fibromyalgia", "neuropathy"],
      content: "Pain management often involves a combination of approaches including physical therapy, gentle exercise, relaxation techniques, heat/cold therapy, and prescribed treatments. Working with your healthcare team to find the right combination for you is important.",
    },
    {
      id: "healthy-eating",
      title: "Foundations of Healthy Eating",
      description: "Building a balanced diet for better health outcomes.",
      category: "nutrition",
      readTime: 7,
      relatedConditions: [],
      content: "A balanced diet includes plenty of fruits, vegetables, whole grains, lean proteins, and healthy fats. Limiting processed foods, added sugars, and excessive sodium supports overall health. Planning meals, reading nutrition labels, and staying hydrated are practical steps toward better eating habits.",
    },
    {
      id: "exercise-basics",
      title: "Getting Started with Exercise",
      description: "Safe ways to increase physical activity at any fitness level.",
      category: "wellness",
      readTime: 6,
      relatedConditions: [],
      content: "Regular physical activity improves heart health, mood, energy, and sleep. Start with small goals like 10-minute walks, gradually increase duration and intensity. Aim for at least 150 minutes of moderate activity per week. Always consult your provider before starting a new exercise program.",
    },
    {
      id: "preventive-screenings",
      title: "Preventive Health Screenings",
      description: "Age-appropriate screenings and why they matter for early detection.",
      category: "preventive_care",
      readTime: 8,
      relatedConditions: [],
      content: "Regular screenings can detect conditions early when they are most treatable. Common screenings include blood pressure checks, cholesterol panels, cancer screenings, diabetes testing, and immunizations. Talk to your provider about which screenings are recommended for your age and risk factors.",
    },
    {
      id: "sleep-health",
      title: "The Importance of Sleep Health",
      description: "How quality sleep affects your physical and mental well-being.",
      category: "wellness",
      readTime: 5,
      relatedConditions: ["insomnia", "sleep apnea"],
      content: "Quality sleep is essential for immune function, mental health, and physical recovery. Adults need 7-9 hours per night. Good sleep habits include consistent bedtimes, limiting screens before bed, keeping the bedroom cool and dark, and avoiding caffeine late in the day.",
    },
    {
      id: "stress-management",
      title: "Managing Stress for Better Health",
      description: "Practical techniques to reduce stress and its impact on health.",
      category: "mental_health",
      readTime: 6,
      relatedConditions: ["anxiety", "hypertension", "insomnia"],
      content: "Chronic stress affects heart health, immunity, sleep, and mental well-being. Effective strategies include deep breathing exercises, progressive muscle relaxation, regular physical activity, social support, time management, and setting realistic expectations for yourself.",
    },
  ];

  // ============================================
  // AI MEDICATION MANAGEMENT SYSTEM
  // ============================================

  const KNOWN_INTERACTIONS: Record<string, { interactsWith: string[]; severity: string; description: string }[]> = {
    "warfarin": [
      { interactsWith: ["aspirin", "ibuprofen", "naproxen"], severity: "high", description: "Increased bleeding risk. NSAIDs and anticoagulants together significantly raise the chance of gastrointestinal bleeding and bruising." },
      { interactsWith: ["amiodarone"], severity: "high", description: "Amiodarone inhibits warfarin metabolism, potentially causing dangerously elevated INR levels." },
      { interactsWith: ["metronidazole", "fluconazole"], severity: "moderate", description: "These antifungals/antibiotics can increase warfarin levels, requiring closer INR monitoring." },
    ],
    "metformin": [
      { interactsWith: ["alcohol"], severity: "high", description: "Combining metformin with alcohol increases the risk of lactic acidosis, a rare but serious condition." },
      { interactsWith: ["contrast dye"], severity: "moderate", description: "Metformin should be temporarily stopped before imaging procedures using contrast dye to prevent kidney complications." },
    ],
    "lisinopril": [
      { interactsWith: ["potassium supplements", "spironolactone"], severity: "high", description: "ACE inhibitors combined with potassium-sparing agents can cause dangerous hyperkalemia (high potassium levels)." },
      { interactsWith: ["ibuprofen", "naproxen"], severity: "moderate", description: "NSAIDs can reduce the blood pressure-lowering effect of ACE inhibitors and increase kidney risk." },
    ],
    "atorvastatin": [
      { interactsWith: ["clarithromycin", "erythromycin"], severity: "high", description: "These antibiotics inhibit statin metabolism, increasing risk of muscle damage (rhabdomyolysis)." },
      { interactsWith: ["grapefruit"], severity: "moderate", description: "Grapefruit juice can increase statin levels in the blood, raising the risk of side effects." },
      { interactsWith: ["gemfibrozil"], severity: "high", description: "Combining fibrates with statins significantly increases risk of rhabdomyolysis." },
    ],
    "amlodipine": [
      { interactsWith: ["simvastatin"], severity: "moderate", description: "Amlodipine can increase simvastatin levels. Simvastatin doses should not exceed 20mg when taken with amlodipine." },
    ],
    "metoprolol": [
      { interactsWith: ["verapamil", "diltiazem"], severity: "high", description: "Combining beta-blockers with calcium channel blockers can cause severe bradycardia and heart block." },
      { interactsWith: ["clonidine"], severity: "moderate", description: "Abrupt withdrawal of either drug while taking both can cause rebound hypertension." },
    ],
    "sertraline": [
      { interactsWith: ["tramadol", "fentanyl"], severity: "high", description: "Combining SSRIs with opioids can cause serotonin syndrome: agitation, confusion, rapid heart rate, high blood pressure." },
      { interactsWith: ["ibuprofen", "aspirin", "naproxen"], severity: "moderate", description: "SSRIs combined with NSAIDs increase bleeding risk, especially gastrointestinal bleeding." },
      { interactsWith: ["monoamine oxidase inhibitors", "phenelzine", "tranylcypromine"], severity: "high", description: "MAOI + SSRI combination can cause life-threatening serotonin syndrome. Must be separated by at least 2 weeks." },
    ],
    "omeprazole": [
      { interactsWith: ["clopidogrel"], severity: "high", description: "Omeprazole reduces the effectiveness of clopidogrel, potentially increasing cardiovascular risk in patients with stents." },
      { interactsWith: ["methotrexate"], severity: "moderate", description: "PPIs can increase methotrexate levels, especially at high doses." },
    ],
    "levothyroxine": [
      { interactsWith: ["calcium supplements", "iron supplements"], severity: "moderate", description: "Calcium and iron can reduce levothyroxine absorption. Take levothyroxine at least 4 hours apart from these supplements." },
      { interactsWith: ["antacids"], severity: "moderate", description: "Antacids reduce levothyroxine absorption. Separate doses by at least 4 hours." },
    ],
    "clopidogrel": [
      { interactsWith: ["omeprazole", "esomeprazole"], severity: "high", description: "These PPIs reduce the antiplatelet effect of clopidogrel. Consider pantoprazole as an alternative if a PPI is needed." },
    ],
  };

  const KNOWN_SIDE_EFFECTS: Record<string, { common: string[]; serious: string[]; watchFor: string[] }> = {
    "metformin": {
      common: ["Nausea", "Diarrhea", "Stomach upset", "Metallic taste"],
      serious: ["Lactic acidosis (rare but life-threatening)", "Vitamin B12 deficiency with long-term use"],
      watchFor: ["Unusual muscle pain", "Difficulty breathing", "Extreme fatigue", "Numbness/tingling in hands or feet"],
    },
    "lisinopril": {
      common: ["Dry cough", "Dizziness", "Headache", "Fatigue"],
      serious: ["Angioedema (swelling of face, lips, tongue)", "Hyperkalemia", "Kidney function changes"],
      watchFor: ["Swelling of face or throat", "Difficulty breathing", "Reduced urination", "Muscle weakness"],
    },
    "atorvastatin": {
      common: ["Muscle aches", "Joint pain", "Headache", "Nausea"],
      serious: ["Rhabdomyolysis (severe muscle breakdown)", "Liver damage", "Type 2 diabetes risk increase"],
      watchFor: ["Unexplained muscle pain or weakness", "Dark-colored urine", "Yellowing of skin/eyes", "Upper right abdominal pain"],
    },
    "amlodipine": {
      common: ["Ankle swelling", "Flushing", "Headache", "Dizziness"],
      serious: ["Severe hypotension", "Worsening heart failure in some patients"],
      watchFor: ["Severe swelling", "Rapid weight gain", "Chest pain", "Irregular heartbeat"],
    },
    "metoprolol": {
      common: ["Fatigue", "Dizziness", "Cold hands/feet", "Slow heartbeat"],
      serious: ["Severe bradycardia", "Heart failure exacerbation", "Bronchospasm"],
      watchFor: ["Very slow pulse (<50 bpm)", "Shortness of breath", "Sudden weight gain", "Wheezing"],
    },
    "sertraline": {
      common: ["Nausea", "Insomnia", "Drowsiness", "Dry mouth", "Decreased appetite"],
      serious: ["Serotonin syndrome", "Suicidal thoughts (especially in young adults)", "QT prolongation"],
      watchFor: ["Agitation/confusion", "Rapid heartbeat", "Fever", "Worsening depression", "Unusual bleeding"],
    },
    "omeprazole": {
      common: ["Headache", "Nausea", "Abdominal pain", "Flatulence"],
      serious: ["C. difficile infection", "Bone fractures with long-term use", "Magnesium deficiency"],
      watchFor: ["Severe diarrhea", "Bone pain", "Muscle spasms", "Irregular heartbeat"],
    },
    "warfarin": {
      common: ["Easy bruising", "Minor bleeding", "Nausea"],
      serious: ["Major bleeding", "Hemorrhagic stroke", "Skin necrosis"],
      watchFor: ["Unusual bleeding or bruising", "Blood in urine/stool", "Severe headache", "Coughing blood"],
    },
    "levothyroxine": {
      common: ["Hair loss (temporary)", "Headache", "Insomnia"],
      serious: ["Heart palpitations", "Chest pain", "Bone density loss with excess dose"],
      watchFor: ["Rapid or irregular heartbeat", "Chest pain", "Excessive sweating", "Unexplained weight loss"],
    },
    "hydrochlorothiazide": {
      common: ["Increased urination", "Dizziness", "Muscle cramps"],
      serious: ["Severe electrolyte imbalance", "Photosensitivity", "Pancreatitis"],
      watchFor: ["Extreme thirst", "Muscle weakness", "Confusion", "Irregular heartbeat"],
    },
  };

  app.get("/api/medications/ai-insights", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const meds = await db.select().from(medicationSchedules)
        .where(and(eq(medicationSchedules.userId, userId), eq(medicationSchedules.isActive, true)));

      if (meds.length === 0) {
        return res.json({ interactions: [], sideEffects: [], refillAlerts: [], aiSummary: null });
      }

      const medNames = meds.map(m => m.medicationName.toLowerCase().trim());

      const interactions: any[] = [];
      for (let i = 0; i < medNames.length; i++) {
        const medKey = medNames[i];
        const knownInteractions = KNOWN_INTERACTIONS[medKey];
        if (knownInteractions) {
          for (const interaction of knownInteractions) {
            for (let j = 0; j < medNames.length; j++) {
              if (i === j) continue;
              if (interaction.interactsWith.some(drug => medNames[j].includes(drug) || drug.includes(medNames[j]))) {
                interactions.push({
                  drug1: meds[i].medicationName,
                  drug2: meds[j].medicationName,
                  severity: interaction.severity,
                  description: interaction.description,
                });
              }
            }
          }
        }
      }

      const sideEffects: any[] = [];
      for (const med of meds) {
        const key = med.medicationName.toLowerCase().trim();
        const effects = KNOWN_SIDE_EFFECTS[key];
        if (effects) {
          sideEffects.push({
            medication: med.medicationName,
            common: effects.common,
            serious: effects.serious,
            watchFor: effects.watchFor,
          });
        }
      }

      const now = new Date();
      const refillAlerts: any[] = [];
      for (const med of meds) {
        if (med.refillDate) {
          const refillDate = new Date(med.refillDate);
          const daysUntilRefill = Math.ceil((refillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilRefill <= 7) {
            refillAlerts.push({
              medication: med.medicationName,
              refillDate: med.refillDate,
              daysRemaining: Math.max(0, daysUntilRefill),
              urgency: daysUntilRefill <= 0 ? "overdue" : daysUntilRefill <= 3 ? "urgent" : "upcoming",
            });
          }
        }
        if (med.pillCount !== null && med.pillCount !== undefined && med.pillCount <= 7) {
          const existingAlert = refillAlerts.find(a => a.medication === med.medicationName);
          if (!existingAlert) {
            refillAlerts.push({
              medication: med.medicationName,
              pillsRemaining: med.pillCount,
              urgency: med.pillCount <= 0 ? "overdue" : med.pillCount <= 3 ? "urgent" : "upcoming",
            });
          } else {
            existingAlert.pillsRemaining = med.pillCount;
          }
        }
      }

      let aiSummary: any = null;
      try {
        const since30 = new Date();
        since30.setDate(since30.getDate() - 30);
        const logs = await db.select().from(adherenceLogs)
          .where(and(eq(adherenceLogs.userId, userId), gte(adherenceLogs.createdAt, since30)));

        const taken = logs.filter(l => l.status === "taken").length;
        const total = logs.length;
        const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

        const journalEntries = await db.select().from(healthJournalEntries)
          .where(and(eq(healthJournalEntries.userId, userId), gte(healthJournalEntries.createdAt, since30)))
          .orderBy(desc(healthJournalEntries.createdAt))
          .limit(10);

        const symptoms = journalEntries
          .filter(e => e.symptoms)
          .flatMap(e => (e.symptoms as string[]) || []);

        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 800,
          messages: [
            {
              role: "system",
              content: "You are a clinical pharmacist AI assistant. Provide personalized medication management insights in JSON format. Be helpful but always recommend consulting their healthcare provider for changes. Never diagnose. Focus on practical, actionable advice."
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "Generate personalized medication management insights",
                medications: meds.map(m => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency, instructions: m.instructions })),
                adherenceRate,
                totalLogs: total,
                recentSymptoms: [...new Set(symptoms)].slice(0, 10),
                knownInteractions: interactions.length,
                format: {
                  personalizedTips: "array of 3-4 practical tips for this patient's specific medication regimen",
                  adherenceInsight: "brief assessment of their adherence pattern and encouragement",
                  timingRecommendation: "optimal timing advice for their specific medications",
                  symptomCorrelation: "any potential links between reported symptoms and medications (suggest discussing with provider)",
                }
              }),
            },
          ],
          jsonMode: true,
          dataCategories: ["medications", "behavioral"],
          purpose: "patient_education",
          callerService: "engagement-routes",
          callerMethod: "medicationInsights",
        });

        aiSummary = JSON.parse(response.content || "{}");
      } catch (aiError: any) {
        aiSummary = {
          personalizedTips: [
            "Take medications at the same time each day for better consistency",
            "Keep a water bottle nearby to make taking pills easier",
            "Set phone alarms as backup reminders for each medication",
          ],
          adherenceInsight: "Tracking your medication consistently helps your care team optimize your treatment plan.",
          timingRecommendation: "Check with your pharmacist about the best time of day to take each medication relative to meals.",
          symptomCorrelation: "If you notice new symptoms after starting or changing a medication, discuss them with your provider.",
        };
      }

      res.json({
        interactions,
        sideEffects,
        refillAlerts,
        aiSummary,
        medicationCount: meds.length,
      });
    } catch (error) {
      console.error("AI medication insights error:", error);
      res.status(500).json({ error: "Failed to generate medication insights" });
    }
  });

  app.post("/api/medications/check-interaction", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { newMedication } = req.body;

      if (!newMedication) {
        return res.status(400).json({ error: "newMedication name required" });
      }

      const currentMeds = await db.select().from(medicationSchedules)
        .where(and(eq(medicationSchedules.userId, userId), eq(medicationSchedules.isActive, true)));

      const newMedLower = newMedication.toLowerCase().trim();
      const interactions: any[] = [];

      const newMedInteractions = KNOWN_INTERACTIONS[newMedLower];
      if (newMedInteractions) {
        for (const existing of currentMeds) {
          const existingLower = existing.medicationName.toLowerCase().trim();
          for (const interaction of newMedInteractions) {
            if (interaction.interactsWith.some(d => existingLower.includes(d) || d.includes(existingLower))) {
              interactions.push({
                existingMedication: existing.medicationName,
                newMedication,
                severity: interaction.severity,
                description: interaction.description,
              });
            }
          }
        }
      }

      for (const existing of currentMeds) {
        const existingLower = existing.medicationName.toLowerCase().trim();
        const existingInteractions = KNOWN_INTERACTIONS[existingLower];
        if (existingInteractions) {
          for (const interaction of existingInteractions) {
            if (interaction.interactsWith.some(d => newMedLower.includes(d) || d.includes(newMedLower))) {
              const alreadyFound = interactions.some(
                i => i.existingMedication === existing.medicationName && i.description === interaction.description
              );
              if (!alreadyFound) {
                interactions.push({
                  existingMedication: existing.medicationName,
                  newMedication,
                  severity: interaction.severity,
                  description: interaction.description,
                });
              }
            }
          }
        }
      }

      const sideEffects = KNOWN_SIDE_EFFECTS[newMedLower] || null;

      res.json({
        newMedication,
        hasInteractions: interactions.length > 0,
        interactions,
        sideEffects,
        currentMedicationCount: currentMeds.length,
      });
    } catch (error) {
      console.error("Check interaction error:", error);
      res.status(500).json({ error: "Failed to check drug interactions" });
    }
  });

  // ============================================
  // PROVIDER: MEDICATION MANAGEMENT INSIGHTS
  // ============================================

  app.get("/api/medications/provider/patient-summary/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const meds = await db.select().from(medicationSchedules)
        .where(eq(medicationSchedules.userId, patientId));

      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const logs = await db.select().from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, patientId), gte(adherenceLogs.createdAt, since90)));

      const activeMeds = meds.filter(m => m.isActive);
      const inactiveMeds = meds.filter(m => !m.isActive);

      const medAdherence: any[] = [];
      for (const med of activeMeds) {
        const medLogs = logs.filter(l => l.scheduleId === med.id);
        const taken = medLogs.filter(l => l.status === "taken").length;
        const total = medLogs.length;
        const rate = total > 0 ? Math.round((taken / total) * 100) : 0;
        const missed = medLogs.filter(l => l.status === "missed").length;
        const skipped = medLogs.filter(l => l.status === "skipped").length;

        const last7 = new Date();
        last7.setDate(last7.getDate() - 7);
        const recentLogs = medLogs.filter(l => new Date(l.createdAt) >= last7);
        const recentTaken = recentLogs.filter(l => l.status === "taken").length;
        const recentTotal = recentLogs.length;
        const recentRate = recentTotal > 0 ? Math.round((recentTaken / recentTotal) * 100) : 0;

        let trend = "stable";
        if (recentRate > rate + 10) trend = "improving";
        else if (recentRate < rate - 10) trend = "declining";

        medAdherence.push({
          medicationId: med.id,
          medicationName: med.medicationName,
          dosage: med.dosage,
          frequency: med.frequency,
          startDate: med.startDate,
          adherenceRate90Day: rate,
          adherenceRate7Day: recentRate,
          trend,
          totalLogs: total,
          taken,
          missed,
          skipped,
          prescribedBy: med.prescribedBy,
          instructions: med.instructions,
          refillDate: med.refillDate,
          pillCount: med.pillCount,
        });
      }

      const overallTaken = logs.filter(l => l.status === "taken").length;
      const overallTotal = logs.length;
      const overallRate = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : 0;

      const medNames = activeMeds.map(m => m.medicationName.toLowerCase().trim());
      const interactions: any[] = [];
      for (let i = 0; i < medNames.length; i++) {
        const knownI = KNOWN_INTERACTIONS[medNames[i]];
        if (knownI) {
          for (const interaction of knownI) {
            for (let j = 0; j < medNames.length; j++) {
              if (i === j) continue;
              if (interaction.interactsWith.some(d => medNames[j].includes(d) || d.includes(medNames[j]))) {
                interactions.push({
                  drug1: activeMeds[i].medicationName,
                  drug2: activeMeds[j].medicationName,
                  severity: interaction.severity,
                  description: interaction.description,
                });
              }
            }
          }
        }
      }

      res.json({
        patientId,
        activeMedications: medAdherence,
        discontinuedMedications: inactiveMeds.map(m => ({
          medicationName: m.medicationName,
          dosage: m.dosage,
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        overallAdherence: {
          rate: overallRate,
          totalLogs: overallTotal,
          period: "90 days",
        },
        drugInteractions: interactions,
        medicationCount: activeMeds.length,
        polypharmacyRisk: activeMeds.length >= 5 ? "high" : activeMeds.length >= 3 ? "moderate" : "low",
      });
    } catch (error) {
      console.error("Provider medication summary error:", error);
      res.status(500).json({ error: "Failed to generate patient medication summary" });
    }
  });

  app.post("/api/medications/provider/ai-recommendations/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const meds = await db.select().from(medicationSchedules)
        .where(and(eq(medicationSchedules.userId, patientId), eq(medicationSchedules.isActive, true)));

      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const logs = await db.select().from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, patientId), gte(adherenceLogs.createdAt, since90)));

      const healthRecs = await db.select().from(healthRecords)
        .where(eq(healthRecords.userId, patientId))
        .orderBy(desc(healthRecords.date))
        .limit(20);

      const journalEntries = await db.select().from(healthJournalEntries)
        .where(and(eq(healthJournalEntries.userId, patientId), gte(healthJournalEntries.createdAt, since90)))
        .orderBy(desc(healthJournalEntries.createdAt))
        .limit(15);

      const medDetails = meds.map(m => {
        const medLogs = logs.filter(l => l.scheduleId === m.id);
        const taken = medLogs.filter(l => l.status === "taken").length;
        const total = medLogs.length;
        return {
          name: m.medicationName,
          dosage: m.dosage,
          frequency: m.frequency,
          adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0,
          missedDoses: medLogs.filter(l => l.status === "missed").length,
          skippedDoses: medLogs.filter(l => l.status === "skipped").length,
          startDate: m.startDate,
          instructions: m.instructions,
        };
      });

      const conditions = healthRecs.filter(r => r.recordType === "condition").map(r => r.title);
      const labResults = healthRecs.filter(r => r.recordType === "lab_result").map(r => ({
        title: r.title,
        date: r.date,
        summary: r.summary,
      }));

      const symptoms = journalEntries
        .filter(e => e.symptoms)
        .flatMap(e => (e.symptoms as string[]) || []);
      const avgPain = journalEntries.filter(e => e.painLevel !== null).length > 0
        ? Math.round(journalEntries.filter(e => e.painLevel !== null).reduce((s, e) => s + (e.painLevel || 0), 0) / journalEntries.filter(e => e.painLevel !== null).length)
        : null;

      let recommendations: any;

      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 1200,
          messages: [
            {
              role: "system",
              content: "You are a clinical decision support system for healthcare providers. Analyze medication data and generate evidence-based recommendations in JSON format. Include adherence improvement strategies, potential regimen adjustments, and monitoring suggestions. Flag any concerns. Be specific and clinically relevant. This is decision support only - final clinical judgment rests with the provider."
            },
            {
              role: "user",
              content: JSON.stringify({
                task: "Generate medication management recommendations for this patient",
                medications: medDetails,
                conditions: [...new Set(conditions)],
                recentLabs: labResults.slice(0, 5),
                recentSymptoms: [...new Set(symptoms)].slice(0, 10),
                averagePainLevel: avgPain,
                format: {
                  effectivenessAssessment: "array of objects with {medication, assessment, confidence: high|moderate|low, reasoning}",
                  adherenceStrategies: "array of specific strategies for medications with low adherence",
                  regimenSuggestions: "array of objects with {suggestion, rationale, priority: high|medium|low}",
                  monitoringRecommendations: "array of labs/vitals to monitor and suggested frequency",
                  concerns: "array of flagged clinical concerns for provider review",
                  overallAssessment: "brief overall assessment of the patient's medication regimen",
                }
              }),
            },
          ],
          jsonMode: true,
          dataCategories: ["conditions", "medications", "lab_results", "behavioral"],
          purpose: "clinical_decision_support",
          callerService: "engagement-routes",
          callerMethod: "medicationRecommendations",
        });

        recommendations = JSON.parse(response.content || "{}");
      } catch (aiError: any) {
        const lowAdherenceMeds = medDetails.filter(m => m.adherenceRate < 80);
        recommendations = {
          effectivenessAssessment: medDetails.map(m => ({
            medication: m.name,
            assessment: m.adherenceRate >= 80 ? "Adequate adherence supports effectiveness evaluation" : "Low adherence may impair therapeutic benefit",
            confidence: "low",
            reasoning: "AI analysis unavailable. Assessment based on adherence data only.",
          })),
          adherenceStrategies: lowAdherenceMeds.length > 0
            ? [
                `Focus on improving adherence for: ${lowAdherenceMeds.map(m => m.name).join(", ")}`,
                "Consider simplifying regimen - reduce dosing frequency where clinically appropriate",
                "Explore barriers to adherence through motivational interviewing",
                "Consider pill organizers or medication synchronization programs",
              ]
            : ["Current adherence rates are adequate. Continue current strategies."],
          regimenSuggestions: meds.length >= 5
            ? [{ suggestion: "Review for deprescribing opportunities", rationale: "Patient is on 5+ medications (polypharmacy)", priority: "medium" }]
            : [],
          monitoringRecommendations: [
            "Review medication list at each visit for continued appropriateness",
            "Monitor for drug-drug interactions with current regimen",
          ],
          concerns: lowAdherenceMeds.length > 0
            ? [`${lowAdherenceMeds.length} medication(s) have adherence below 80%`]
            : [],
          overallAssessment: `Patient is on ${meds.length} active medications with an average adherence pattern. AI-powered detailed analysis is currently unavailable.`,
        };
      }

      res.json({
        patientId,
        generatedAt: new Date().toISOString(),
        recommendations,
        dataUsed: {
          medicationCount: meds.length,
          adherenceLogCount: logs.length,
          healthRecordCount: healthRecs.length,
          journalEntryCount: journalEntries.length,
          periodDays: 90,
        },
      });
    } catch (error) {
      console.error("Provider AI recommendations error:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });
}
