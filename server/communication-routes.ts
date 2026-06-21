import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  generateFollowUpMessage,
  generateAppointmentReminder,
  generateScreeningReminder,
  generateRpmReviewMessage,
  generateQueryResponse,
  createCommunication,
  getCommunication,
  getCommunicationsByPatient,
  getAllCommunications,
  updateCommunicationStatus,
  getTemplates,
  getTemplate,
  createTemplate,
  getQueryResponses,
  updateQueryFeedback,
  triggerAutomatedCommunications,
} from "./services/patientCommunication";
import {
  insertPatientCommunicationSchema,
  insertCommunicationTemplateSchema,
  communicationStatuses,
  communicationTypes,
  communicationChannels,
} from "@shared/schema";

const router = Router();

const generateFollowUpSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  encounterDetails: z.object({
    date: z.string(),
    providerName: z.string(),
    reason: z.string().optional(),
    diagnoses: z.array(z.string()).optional(),
    instructions: z.array(z.string()).optional(),
  }),
});

const generateAppointmentReminderSchema = z.object({
  patientId: z.string().min(1),
  appointment: z.object({
    date: z.string(),
    time: z.string(),
    providerName: z.string(),
    reason: z.string().optional(),
    location: z.string().optional(),
  }),
});

const generateScreeningReminderSchema = z.object({
  patientId: z.string().min(1),
  screening: z.object({
    name: z.string(),
    lastDate: z.string().optional(),
    dueDate: z.string().optional(),
    importance: z.string(),
  }),
});

const generateRpmReviewSchema = z.object({
  patientId: z.string().min(1),
  rpmData: z.object({
    deviceType: z.string(),
    readings: z.array(z.object({
      type: z.string(),
      value: z.string(),
      date: z.string(),
      status: z.enum(["normal", "elevated", "low", "critical"]),
    })),
    trend: z.string().optional(),
  }),
});

const queryResponseSchema = z.object({
  patientId: z.string().min(1),
  query: z.string().min(1),
});

const triggerEventSchema = z.object({
  eventType: z.string().min(1),
  eventData: z.record(z.unknown()),
});

router.post("/generate/follow-up", async (req: Request, res: Response) => {
  try {
    const parseResult = generateFollowUpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { patientId, encounterId, encounterDetails } = parseResult.data;
    const result = await generateFollowUpMessage(patientId, encounterId, encounterDetails);

    res.json(result);
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error generating follow-up:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/appointment-reminder", async (req: Request, res: Response) => {
  try {
    const parseResult = generateAppointmentReminderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { patientId, appointment } = parseResult.data;
    const result = await generateAppointmentReminder(patientId, appointment);

    res.json(result);
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error generating appointment reminder:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/screening-reminder", async (req: Request, res: Response) => {
  try {
    const parseResult = generateScreeningReminderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { patientId, screening } = parseResult.data;
    const result = await generateScreeningReminder(patientId, screening);

    res.json(result);
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error generating screening reminder:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate/rpm-review", async (req: Request, res: Response) => {
  try {
    const parseResult = generateRpmReviewSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { patientId, rpmData } = parseResult.data;
    const result = await generateRpmReviewMessage(patientId, rpmData);

    res.json(result);
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error generating RPM review message:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/query", async (req: Request, res: Response) => {
  try {
    const parseResult = queryResponseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { patientId, query } = parseResult.data;
    const result = await generateQueryResponse(patientId, query);

    res.json(result);
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error generating query response:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/query/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const responses = getQueryResponses(patientId);
    res.json(responses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/query/:queryId/feedback", async (req: Request, res: Response) => {
  try {
    const { queryId } = req.params;
    const { wasHelpful, feedback } = req.body;

    const updated = updateQueryFeedback(queryId, wasHelpful, feedback);
    if (!updated) {
      return res.status(404).json({ error: "Query response not found" });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const parseResult = triggerEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const { eventType, eventData } = parseResult.data;
    const triggered = await triggerAutomatedCommunications(eventType, eventData);

    res.json({ success: true, triggered: triggered.length, communications: triggered });
  } catch (error: any) {
    console.error("[CommunicationRoutes] Error triggering automated communications:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = insertPatientCommunicationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const communication = await createCommunication(parseResult.data);
    res.status(201).json(communication);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, type, channel } = req.query;
    const communications = getAllCommunications({
      status: status as string,
      type: type as string,
      channel: channel as string,
    });
    res.json(communications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const communications = getCommunicationsByPatient(patientId);
    res.json(communications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const communication = getCommunication(id);

    if (!communication) {
      return res.status(404).json({ error: "Communication not found" });
    }

    res.json(communication);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, sentAt, deliveredAt, failedAt, failureReason } = req.body;

    if (!communicationStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = updateCommunicationStatus(id, status, { sentAt, deliveredAt, failedAt, failureReason });
    if (!updated) {
      return res.status(404).json({ error: "Communication not found" });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates", async (_req: Request, res: Response) => {
  try {
    const templates = getTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = getTemplate(id);

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const parseResult = insertCommunicationTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Validation failed", details: parseResult.error.errors });
    }

    const template = createTemplate(parseResult.data);
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats/summary", async (_req: Request, res: Response) => {
  try {
    const all = getAllCommunications();
    const stats = {
      total: all.length,
      byStatus: {
        draft: all.filter((c) => c.status === "draft").length,
        scheduled: all.filter((c) => c.status === "scheduled").length,
        pending: all.filter((c) => c.status === "pending").length,
        sent: all.filter((c) => c.status === "sent").length,
        delivered: all.filter((c) => c.status === "delivered").length,
        failed: all.filter((c) => c.status === "failed").length,
      },
      byType: communicationTypes.reduce((acc, type) => {
        acc[type] = all.filter((c) => c.communicationType === type).length;
        return acc;
      }, {} as Record<string, number>),
      byChannel: communicationChannels.reduce((acc, channel) => {
        acc[channel] = all.filter((c) => c.channel === channel).length;
        return acc;
      }, {} as Record<string, number>),
      aiGenerated: all.filter((c) => c.aiGeneratedContent).length,
      averageConfidence: all.filter((c) => c.aiConfidence).reduce((sum, c) => sum + (c.aiConfidence || 0), 0) / (all.filter((c) => c.aiConfidence).length || 1),
    };

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export function registerCommunicationRoutes(app: any) {
  app.use("/api/communications", router);
  console.log("[Routes] Patient communication routes registered at /api/communications");
}
