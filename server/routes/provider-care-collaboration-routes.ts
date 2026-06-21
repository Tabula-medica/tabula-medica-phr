import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getProviders,
  getProviderById,
  getConversations,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  getSharedSummaries,
  sharePatientSummary,
  accessPatientSummary,
  revokePatientSummary,
  getCarePlans,
  getCarePlanById,
  createCarePlan,
  addCarePlanTask,
  updateTaskStatus,
  addCarePlanNote,
  getCollaborationDashboard,
  getCollaborationAuditLog,
} from "../services/provider-care-collaboration-service";

const router = Router();

const sendMessageSchema = z.object({
  senderId: z.string(),
  recipientIds: z.array(z.string()).min(1),
  content: z.string().min(1),
  subject: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  priority: z.enum(["normal", "urgent", "critical"]).optional(),
  conversationId: z.string().optional(),
});

const shareSummarySchema = z.object({
  sharedById: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  summaryType: z.enum(["full", "medications", "conditions", "recent_visits", "lab_results", "care_plan"]),
  sharedWithProviderIds: z.array(z.string()).min(1),
  accessLevel: z.enum(["view", "comment", "edit"]),
  content: z.object({
    conditions: z.array(z.object({
      name: z.string(),
      status: z.string(),
      icdCode: z.string().optional(),
    })).optional(),
    medications: z.array(z.object({
      name: z.string(),
      dosage: z.string(),
      frequency: z.string(),
      prescriber: z.string().optional(),
    })).optional(),
    recentVisits: z.array(z.object({
      date: z.string(),
      type: z.string(),
      provider: z.string(),
      summary: z.string(),
    })).optional(),
    labResults: z.array(z.object({
      date: z.string(),
      test: z.string(),
      value: z.string(),
      unit: z.string(),
      status: z.string(),
    })).optional(),
    carePlan: z.array(z.object({
      goal: z.string(),
      interventions: z.array(z.string()),
      status: z.string(),
    })).optional(),
    notes: z.string().optional(),
  }),
  expiresInDays: z.number().optional(),
});

const createCarePlanSchema = z.object({
  creatorId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  title: z.string().min(1),
  description: z.string(),
  assignedProviderIds: z.array(z.string()),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  targetEndDate: z.string().optional(),
});

const addTaskSchema = z.object({
  creatorId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  assignedToId: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().optional(),
  goalId: z.string().optional(),
});

const accessSummarySchema = z.object({
  providerId: z.string().min(1, "Provider ID is required"),
  action: z.enum(["view", "comment", "export"]).optional().default("view"),
});

const revokeSummarySchema = z.object({
  revokerId: z.string().min(1, "Revoker ID is required"),
  reason: z.string().min(1, "Revocation reason is required"),
});

const markAsReadParamsSchema = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  providerId: z.string().min(1, "Provider ID is required"),
});

const auditLogQuerySchema = z.object({
  providerId: z.string().optional(),
  patientId: z.string().optional(),
  entityType: z.enum(["message", "patient_summary", "care_plan", "task"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional().transform(val => val ? parseInt(val) : undefined),
});

const updateTaskStatusSchema = z.object({
  providerId: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "blocked", "cancelled"]),
  notes: z.string().optional(),
});

const addNoteSchema = z.object({
  authorId: z.string(),
  content: z.string().min(1),
  noteType: z.enum(["general", "progress", "concern", "recommendation", "outcome"]),
  isPrivate: z.boolean().optional(),
});

router.get("/dashboard/:providerId", async (req: Request, res: Response) => {
  try {
    const dashboard = getCollaborationDashboard(req.params.providerId);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[ProviderCollaboration] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

router.get("/providers", async (req: Request, res: Response) => {
  try {
    const providers = getProviders();
    res.json({ success: true, data: providers });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get providers" });
  }
});

router.get("/providers/:id", async (req: Request, res: Response) => {
  try {
    const provider = getProviderById(req.params.id);
    if (!provider) {
      return res.status(404).json({ success: false, error: "Provider not found" });
    }
    res.json({ success: true, data: provider });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get provider" });
  }
});

router.get("/conversations/:providerId", async (req: Request, res: Response) => {
  try {
    const conversations = getConversations(req.params.providerId);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get conversations" });
  }
});

router.get("/conversations/:conversationId/messages/:providerId", async (req: Request, res: Response) => {
  try {
    const messages = getConversationMessages(req.params.conversationId, req.params.providerId);
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get messages" });
  }
});

router.post("/messages", async (req: Request, res: Response) => {
  console.log("[ProviderCollaboration] POST /messages received");
  try {
    const validation = sendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { senderId, recipientIds, content, subject, patientId, patientName, priority, conversationId } = validation.data;
    
    const result = sendMessage(senderId, recipientIds, content, {
      subject,
      patientId,
      patientName,
      priority,
      conversationId,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[ProviderCollaboration] Send message error:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

router.post("/conversations/:conversationId/read/:providerId", async (req: Request, res: Response) => {
  try {
    const paramsValidation = markAsReadParamsSchema.safeParse(req.params);
    if (!paramsValidation.success) {
      return res.status(400).json({ success: false, error: "Invalid parameters", details: paramsValidation.error.errors });
    }
    const { conversationId, providerId } = paramsValidation.data;
    markMessagesAsRead(conversationId, providerId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark as read" });
  }
});

router.get("/shared-summaries/:providerId", async (req: Request, res: Response) => {
  try {
    const summaries = getSharedSummaries(req.params.providerId);
    res.json({ success: true, data: summaries });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get summaries" });
  }
});

router.post("/shared-summaries", async (req: Request, res: Response) => {
  console.log("[ProviderCollaboration] POST /shared-summaries received");
  try {
    const validation = shareSummarySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { sharedById, patientId, patientName, summaryType, sharedWithProviderIds, accessLevel, content, expiresInDays } = validation.data;
    
    const summary = sharePatientSummary(
      sharedById,
      patientId,
      patientName,
      summaryType,
      sharedWithProviderIds,
      accessLevel,
      content,
      expiresInDays
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[ProviderCollaboration] Share summary error:", error);
    res.status(500).json({ success: false, error: "Failed to share summary" });
  }
});

router.post("/shared-summaries/:summaryId/access", async (req: Request, res: Response) => {
  try {
    const validation = accessSummarySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    const { providerId, action } = validation.data;
    const summary = accessPatientSummary(req.params.summaryId, providerId, action);
    if (!summary) {
      return res.status(404).json({ success: false, error: "Summary not found or access denied" });
    }
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to access summary" });
  }
});

router.post("/shared-summaries/:summaryId/revoke", async (req: Request, res: Response) => {
  try {
    const validation = revokeSummarySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }
    const { revokerId, reason } = validation.data;
    const success = revokePatientSummary(req.params.summaryId, revokerId, reason);
    if (!success) {
      return res.status(403).json({ success: false, error: "Cannot revoke summary" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to revoke summary" });
  }
});

router.get("/care-plans/:providerId", async (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string | undefined;
    const carePlans = getCarePlans(req.params.providerId, patientId);
    res.json({ success: true, data: carePlans });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get care plans" });
  }
});

router.get("/care-plans/:carePlanId/detail/:providerId", async (req: Request, res: Response) => {
  try {
    const carePlan = getCarePlanById(req.params.carePlanId, req.params.providerId);
    if (!carePlan) {
      return res.status(404).json({ success: false, error: "Care plan not found or access denied" });
    }
    res.json({ success: true, data: carePlan });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get care plan" });
  }
});

router.post("/care-plans", async (req: Request, res: Response) => {
  console.log("[ProviderCollaboration] POST /care-plans received");
  try {
    const validation = createCarePlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { creatorId, patientId, patientName, title, description, assignedProviderIds, priority, targetEndDate } = validation.data;
    
    const carePlan = createCarePlan(creatorId, patientId, patientName, title, description, assignedProviderIds, {
      priority,
      targetEndDate,
    });

    res.json({ success: true, data: carePlan });
  } catch (error) {
    console.error("[ProviderCollaboration] Create care plan error:", error);
    res.status(500).json({ success: false, error: "Failed to create care plan" });
  }
});

router.post("/care-plans/:carePlanId/tasks", async (req: Request, res: Response) => {
  console.log("[ProviderCollaboration] POST /care-plans/:id/tasks received");
  try {
    const validation = addTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { creatorId, title, description, assignedToId, priority, dueDate, goalId } = validation.data;
    
    const task = addCarePlanTask(req.params.carePlanId, creatorId, {
      title,
      description,
      assignedToId,
      priority,
      dueDate,
      goalId,
    });

    if (!task) {
      return res.status(403).json({ success: false, error: "Cannot add task or access denied" });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[ProviderCollaboration] Add task error:", error);
    res.status(500).json({ success: false, error: "Failed to add task" });
  }
});

router.patch("/care-plans/:carePlanId/tasks/:taskId/status", async (req: Request, res: Response) => {
  try {
    const validation = updateTaskStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { providerId, status, notes } = validation.data;
    
    const task = updateTaskStatus(req.params.carePlanId, req.params.taskId, providerId, status, notes);
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found or access denied" });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
});

router.post("/care-plans/:carePlanId/notes", async (req: Request, res: Response) => {
  console.log("[ProviderCollaboration] POST /care-plans/:id/notes received");
  try {
    const validation = addNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: validation.error.errors });
    }

    const { authorId, content, noteType, isPrivate } = validation.data;
    
    const note = addCarePlanNote(req.params.carePlanId, authorId, content, noteType, isPrivate);
    if (!note) {
      return res.status(403).json({ success: false, error: "Cannot add note or access denied" });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[ProviderCollaboration] Add note error:", error);
    res.status(500).json({ success: false, error: "Failed to add note" });
  }
});

router.get("/audit-log", async (req: Request, res: Response) => {
  try {
    const validation = auditLogQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters", details: validation.error.errors });
    }
    
    const { providerId, patientId, entityType, startDate, endDate, limit } = validation.data;
    
    const auditLog = getCollaborationAuditLog({
      providerId,
      patientId,
      entityType,
      startDate,
      endDate,
      limit,
    });

    res.json({ success: true, data: auditLog });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to get audit log" });
  }
});

export function registerProviderCareCollaborationRoutes(app: any) {
  app.use("/api/provider-care-collaboration", router);
  console.log("[Routes] Provider Care Collaboration routes registered at /api/provider-care-collaboration/*");
  console.log("[Routes] - Features: Messaging, Shared Summaries, Care Plans, Tasks, Audit Trail");
}

export default router;
