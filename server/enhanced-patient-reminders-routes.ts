import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getPatientReminders,
  createReminder,
  sendReminder,
  acknowledgeReminder,
  getPatientPreferences,
  updatePatientPreferences,
  getReminderAnalytics,
  getTemplates,
  NO_CDS_DISCLAIMER
} from "./services/enhanced-patient-reminders-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

function createErrorResponse(error: string, details?: any) {
  return {
    error,
    details,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    res.json({
      name: "Enhanced Patient Reminders",
      version: "2.0.0",
      description: "AI-powered smart patient reminders with personalization and multi-channel delivery",
      features: [
        "AI-personalized messages",
        "Smart timing optimization",
        "Multi-channel delivery (email, SMS, push, in-app)",
        "Reminder preferences management",
        "Response tracking and analytics",
        "Multiple reminder types (appointments, medications, preventive care, etc.)"
      ],
      reminderTypes: [
        "appointment",
        "medication",
        "preventive_care",
        "follow_up",
        "wellness",
        "lab_result",
        "prescription_refill",
        "health_goal"
      ],
      channels: ["email", "sms", "push", "in_app"],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Metadata error:", error);
    res.status(500).json(createErrorResponse("Failed to get metadata"));
  }
});

router.get("/templates", (_req: Request, res: Response) => {
  try {
    const templates = getTemplates();
    res.json({
      templates,
      count: templates.length,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Templates error:", error);
    res.status(500).json(createErrorResponse("Failed to get templates"));
  }
});

router.get("/reminders", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const patientId = req.query.patientId as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    
    const reminders = await getPatientReminders(userId, patientId, {
      type: type as any,
      status: status as any,
      priority: priority as any
    });
    
    res.json({
      reminders,
      count: reminders.length,
      filters: { patientId, type, status, priority },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Get reminders error:", error);
    res.status(500).json(createErrorResponse("Failed to get reminders"));
  }
});

const createReminderSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  type: z.enum(["appointment", "medication", "preventive_care", "follow_up", "wellness", "lab_result", "prescription_refill", "health_goal"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  title: z.string(),
  message: z.string(),
  scheduledFor: z.string(),
  dueDate: z.string().optional(),
  channels: z.array(z.enum(["email", "sms", "push", "in_app"])),
  metadata: z.object({
    appointmentId: z.string().optional(),
    medicationId: z.string().optional(),
    conditionId: z.string().optional(),
    labOrderId: z.string().optional(),
    healthGoalId: z.string().optional(),
    providerName: z.string().optional(),
    facilityName: z.string().optional()
  }).optional()
});

router.post("/reminders", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const validatedData = createReminderSchema.parse(req.body);
    
    const reminder = await createReminder(userId, validatedData);
    
    res.status(201).json({
      reminder,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error: any) {
    console.error("[EnhancedReminders] Create reminder error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json(createErrorResponse("Validation error", error.errors));
    }
    res.status(500).json(createErrorResponse("Failed to create reminder"));
  }
});

router.post("/reminders/:id/send", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { id } = req.params;
    
    const reminder = await sendReminder(userId, id);
    
    res.json({
      reminder,
      message: "Reminder sent successfully",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error: any) {
    console.error("[EnhancedReminders] Send reminder error:", error);
    res.status(500).json(createErrorResponse(error.message || "Failed to send reminder"));
  }
});

const acknowledgeSchema = z.object({
  responseType: z.enum(["acknowledged", "snoozed", "dismissed", "action_taken", "question"]),
  snoozeUntil: z.string().optional(),
  notes: z.string().optional()
});

router.post("/reminders/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { id } = req.params;
    const validatedData = acknowledgeSchema.parse(req.body);
    
    const reminder = await acknowledgeReminder(userId, id, validatedData);
    
    res.json({
      reminder,
      message: "Reminder acknowledged",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error: any) {
    console.error("[EnhancedReminders] Acknowledge error:", error);
    if (error.name === "ZodError") {
      return res.status(400).json(createErrorResponse("Validation error", error.errors));
    }
    res.status(500).json(createErrorResponse(error.message || "Failed to acknowledge reminder"));
  }
});

router.get("/preferences/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    const preferences = await getPatientPreferences(userId, patientId);
    
    res.json({
      preferences,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Get preferences error:", error);
    res.status(500).json(createErrorResponse("Failed to get preferences"));
  }
});

router.put("/preferences/:patientId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    const { patientId } = req.params;
    
    const preferences = await updatePatientPreferences(userId, patientId, req.body);
    
    res.json({
      preferences,
      message: "Preferences updated",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Update preferences error:", error);
    res.status(500).json(createErrorResponse("Failed to update preferences"));
  }
});

router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || "anonymous";
    
    const analytics = await getReminderAnalytics(userId);
    
    res.json({
      analytics,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[EnhancedReminders] Analytics error:", error);
    res.status(500).json(createErrorResponse("Failed to get analytics"));
  }
});

export default router;
