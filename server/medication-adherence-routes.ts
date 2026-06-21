import { Router, Request, Response } from "express";
import { z } from "zod";
import { medicationAdherenceService } from "./services/medication-adherence-service";

const router = Router();

const createReminderSchema = z.object({
  medicationId: z.string().min(1),
  medicationName: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.enum(["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed", "custom"]),
  scheduledTimes: z.array(z.string()),
  daysOfWeek: z.array(z.number()).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  notificationPreferences: z.object({
    push: z.boolean().default(true),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
    advanceMinutes: z.number().default(15),
  }).default({
    push: true,
    email: false,
    sms: false,
    advanceMinutes: 15,
  }),
});

const logAdherenceSchema = z.object({
  medicationId: z.string().min(1),
  reminderId: z.string().min(1),
  scheduledTime: z.string(),
  actualTime: z.string().optional(),
  status: z.enum(["taken", "skipped", "late", "pending", "missed"]),
  notes: z.string().optional(),
  sideEffects: z.array(z.string()).optional(),
  mood: z.enum(["good", "neutral", "poor"]).optional(),
});

router.get("/api/medication-adherence/reminders/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const reminders = await medicationAdherenceService.getReminders(patientId);
    res.json({ success: true, data: reminders });
  } catch (error) {
    console.error("Error getting reminders:", error);
    res.status(500).json({ success: false, error: "Failed to get reminders" });
  }
});

router.post("/api/medication-adherence/reminders/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const data = createReminderSchema.parse(req.body);
    const reminder = await medicationAdherenceService.createReminder(patientId, data);
    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid data", details: error.errors });
    }
    console.error("Error creating reminder:", error);
    res.status(500).json({ success: false, error: "Failed to create reminder" });
  }
});

router.patch("/api/medication-adherence/reminders/:reminderId", async (req: Request, res: Response) => {
  try {
    const { reminderId } = req.params;
    const updates = req.body;
    const reminder = await medicationAdherenceService.updateReminder(reminderId, updates);
    
    if (!reminder) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }
    
    res.json({ success: true, data: reminder });
  } catch (error) {
    console.error("Error updating reminder:", error);
    res.status(500).json({ success: false, error: "Failed to update reminder" });
  }
});

router.delete("/api/medication-adherence/reminders/:reminderId", async (req: Request, res: Response) => {
  try {
    const { reminderId } = req.params;
    const deleted = await medicationAdherenceService.deleteReminder(reminderId);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Reminder not found" });
    }
    
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).json({ success: false, error: "Failed to delete reminder" });
  }
});

router.get("/api/medication-adherence/logs/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { medicationId, startDate, endDate, limit } = req.query;
    
    const logs = await medicationAdherenceService.getAdherenceLogs(patientId, {
      medicationId: medicationId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Error getting adherence logs:", error);
    res.status(500).json({ success: false, error: "Failed to get adherence logs" });
  }
});

router.post("/api/medication-adherence/logs/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const data = logAdherenceSchema.parse(req.body);
    const log = await medicationAdherenceService.logAdherence(patientId, data);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid data", details: error.errors });
    }
    console.error("Error logging adherence:", error);
    res.status(500).json({ success: false, error: "Failed to log adherence" });
  }
});

router.get("/api/medication-adherence/stats/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { medicationId, days } = req.query;
    
    const stats = await medicationAdherenceService.getAdherenceStats(
      patientId,
      medicationId as string,
      days ? parseInt(days as string) : 30
    );
    
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error getting adherence stats:", error);
    res.status(500).json({ success: false, error: "Failed to get adherence stats" });
  }
});

router.get("/api/medication-adherence/daily/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { days } = req.query;
    
    const dailyData = await medicationAdherenceService.getDailyAdherenceData(
      patientId,
      days ? parseInt(days as string) : 30
    );
    
    res.json({ success: true, data: dailyData });
  } catch (error) {
    console.error("Error getting daily adherence:", error);
    res.status(500).json({ success: false, error: "Failed to get daily adherence data" });
  }
});

router.get("/api/medication-adherence/overall/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { days } = req.query;
    
    const rate = await medicationAdherenceService.getOverallAdherenceRate(
      patientId,
      days ? parseInt(days as string) : 30
    );
    
    res.json({ success: true, data: { adherenceRate: rate } });
  } catch (error) {
    console.error("Error getting overall adherence:", error);
    res.status(500).json({ success: false, error: "Failed to get overall adherence rate" });
  }
});

router.get("/api/medication-adherence/today/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const todaysMeds = await medicationAdherenceService.getTodaysMedications(patientId);
    res.json({ success: true, data: todaysMeds });
  } catch (error) {
    console.error("Error getting today's medications:", error);
    res.status(500).json({ success: false, error: "Failed to get today's medications" });
  }
});

router.get("/api/medication-adherence/flags/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { status } = req.query;
    
    const flags = await medicationAdherenceService.getFlags(patientId, status as string);
    res.json({ success: true, data: flags });
  } catch (error) {
    console.error("Error getting non-adherence flags:", error);
    res.status(500).json({ success: false, error: "Failed to get flags" });
  }
});

router.patch("/api/medication-adherence/flags/:flagId", async (req: Request, res: Response) => {
  try {
    const { flagId } = req.params;
    const { status, reviewedBy } = req.body;
    
    const flag = await medicationAdherenceService.updateFlagStatus(flagId, status, reviewedBy);
    
    if (!flag) {
      return res.status(404).json({ success: false, error: "Flag not found" });
    }
    
    res.json({ success: true, data: flag });
  } catch (error) {
    console.error("Error updating flag:", error);
    res.status(500).json({ success: false, error: "Failed to update flag" });
  }
});

router.post("/api/medication-adherence/initialize/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    medicationAdherenceService.initializeSampleData(patientId);
    res.json({ success: true, message: "Sample data initialized" });
  } catch (error) {
    console.error("Error initializing sample data:", error);
    res.status(500).json({ success: false, error: "Failed to initialize sample data" });
  }
});

export default router;
