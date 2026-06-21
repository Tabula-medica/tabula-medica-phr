import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { patientEngagementService } from "./services/patient-engagement-service";
import { patientEngagementHubService } from "./services/patient-engagement-hub-service";
import {
  insertEngagementMessageThreadSchema,
  insertEngagementMessageSchema,
  insertEngagementAppointmentSchema,
  messageThreadCategories,
  appointmentScheduleTypes,
  appointmentScheduleStatuses,
  profiles,
  engagementMessageThreadsTable,
} from "@shared/schema";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][PatientEngagementHub] ${timestamp} - ${action} -`, JSON.stringify(details));
}

function enforceSessionUserId(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  const sessionUserId = user?.claims?.sub || user?.id;
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS_ATTEMPT", { ip: req.ip, path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  (req as any).userId = sessionUserId;
  (req as any).isProvider = user?.claims?.metadata?.isProvider === true || user?.isProvider === true;
  next();
}

function requireProviderAuth(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  const sessionUserId = user?.claims?.sub || user?.id;
  const isProvider = user?.claims?.metadata?.isProvider === true || user?.isProvider === true;
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_PROVIDER_ACCESS", { ip: req.ip, path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  if (!isProvider) {
    logHipaaAudit("NON_PROVIDER_ACCESS_DENIED", { userId: hashIdentifier(sessionUserId), path: req.path });
    return res.status(403).json({ success: false, error: "Provider access required" });
  }
  
  (req as any).userId = sessionUserId;
  (req as any).isProvider = true;
  next();
}

async function verifyProfileAccess(accountId: string, requestedProfileId: string | undefined): Promise<{ allowed: boolean; profileId: string }> {
  if (!requestedProfileId) {
    const [profile] = await db.select().from(profiles)
      .where(eq(profiles.accountId, accountId))
      .limit(1);
    
    if (profile) {
      return { allowed: true, profileId: profile.id };
    }
    return { allowed: false, profileId: "" };
  }
  
  const [profile] = await db.select().from(profiles)
    .where(and(
      eq(profiles.id, requestedProfileId),
      eq(profiles.accountId, accountId)
    ))
    .limit(1);
  
  if (!profile) {
    logHipaaAudit("PROFILE_ACCESS_DENIED", { 
      userId: hashIdentifier(accountId), 
      requestedProfile: hashIdentifier(requestedProfileId),
      reason: "not_owner"
    });
    return { allowed: false, profileId: requestedProfileId };
  }
  
  return { allowed: true, profileId: profile.id };
}

async function verifyThreadAccess(threadId: string, userId: string, role: "patient" | "provider"): Promise<boolean> {
  const [thread] = await db.select().from(engagementMessageThreadsTable)
    .where(eq(engagementMessageThreadsTable.id, threadId))
    .limit(1);
  
  if (!thread) {
    return false;
  }
  
  if (role === "provider") {
    return thread.providerUserId === userId;
  }
  
  const [profile] = await db.select().from(profiles)
    .where(and(
      eq(profiles.id, thread.patientProfileId),
      eq(profiles.accountId, userId)
    ))
    .limit(1);
  
  return !!profile;
}

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    version: "1.0.0",
    name: "Patient Engagement Hub",
    description: "Secure messaging, appointment scheduling, and gamification for patient engagement",
    features: {
      messaging: {
        categories: messageThreadCategories,
        maxMessageLength: 10000,
        supportsAttachments: true,
      },
      appointments: {
        types: appointmentScheduleTypes,
        statuses: appointmentScheduleStatuses,
        reminderChannels: ["in_app", "email", "sms", "push"],
        defaultReminderTimes: ["24_hours", "2_hours"],
      },
      gamification: {
        pointsSystem: true,
        badges: true,
        streaks: true,
        levels: 10,
        leaderboards: false,
      },
    },
    disclaimer: "This module is for engagement purposes only and does not constitute clinical decision support.",
  });
});

router.get("/summary", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId } = req.query;
    
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const summary = await patientEngagementService.getEngagementSummary(access.profileId);

    res.json({
      success: true,
      data: summary,
      disclaimer: "Engagement metrics are for motivational purposes only.",
    });
  } catch (error) {
    console.error("[PatientEngagementHub] Summary error:", error);
    res.status(500).json({ success: false, error: "Failed to load engagement summary" });
  }
});

router.post("/messages/threads", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    const access = await verifyProfileAccess(userId, req.body.patientProfileId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "You can only create threads for your own profile" });
    }

    const validation = insertEngagementMessageThreadSchema.safeParse({
      ...req.body,
      patientProfileId: access.profileId,
    });

    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors[0].message });
    }

    const thread = await patientEngagementService.createMessageThread(validation.data);

    res.status(201).json({ success: true, data: thread });
  } catch (error) {
    console.error("[PatientEngagementHub] Create thread error:", error);
    res.status(500).json({ success: false, error: "Failed to create message thread" });
  }
});

router.get("/messages/threads", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId } = req.query;
    
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const threads = await patientEngagementService.getMessageThreads(access.profileId, "patient");

    res.json({ success: true, data: threads });
  } catch (error) {
    console.error("[PatientEngagementHub] Get threads error:", error);
    res.status(500).json({ success: false, error: "Failed to load message threads" });
  }
});

router.get("/messages/threads/:threadId", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { threadId } = req.params;

    const hasAccess = await verifyThreadAccess(threadId, userId, "patient");
    if (!hasAccess) {
      logHipaaAudit("THREAD_ACCESS_DENIED", {
        user: hashIdentifier(userId),
        threadId: hashIdentifier(threadId),
        reason: "not_authorized"
      });
      return res.status(403).json({ success: false, error: "You do not have access to this conversation" });
    }

    logHipaaAudit("THREAD_MESSAGES_ACCESS", {
      user: hashIdentifier(userId),
      threadId: hashIdentifier(threadId),
    });

    const messages = await patientEngagementService.getMessages(threadId, userId, "patient");
    await patientEngagementService.markMessagesRead(threadId, "patient");

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("[PatientEngagementHub] Get messages error:", error);
    res.status(500).json({ success: false, error: "Failed to load messages" });
  }
});

router.post("/messages", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { threadId } = req.body;

    if (!threadId) {
      return res.status(400).json({ success: false, error: "Thread ID is required" });
    }

    const hasAccess = await verifyThreadAccess(threadId, userId, "patient");
    if (!hasAccess) {
      logHipaaAudit("MESSAGE_SEND_DENIED", {
        user: hashIdentifier(userId),
        threadId: hashIdentifier(threadId),
        reason: "not_authorized"
      });
      return res.status(403).json({ success: false, error: "You do not have access to this conversation" });
    }
    
    const validation = insertEngagementMessageSchema.safeParse({
      ...req.body,
      senderId: userId,
      senderType: "patient",
    });

    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors[0].message });
    }

    const message = await patientEngagementService.sendMessage(validation.data);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("[PatientEngagementHub] Send message error:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

router.post("/appointments", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    const access = await verifyProfileAccess(userId, req.body.patientProfileId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "You can only schedule appointments for your own profile" });
    }

    const validation = insertEngagementAppointmentSchema.safeParse({
      ...req.body,
      patientProfileId: access.profileId,
    });

    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors[0].message });
    }

    const appointment = await patientEngagementService.scheduleAppointment(validation.data);

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    console.error("[PatientEngagementHub] Schedule appointment error:", error);
    res.status(500).json({ success: false, error: "Failed to schedule appointment" });
  }
});

router.get("/appointments", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId, status, upcoming, limit } = req.query;
    
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const appointments = await patientEngagementService.getPatientAppointments(access.profileId, {
      status: status as any,
      upcoming: upcoming === "true",
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, data: appointments });
  } catch (error) {
    console.error("[PatientEngagementHub] Get appointments error:", error);
    res.status(500).json({ success: false, error: "Failed to load appointments" });
  }
});

router.patch("/appointments/:appointmentId/status", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { appointmentId } = req.params;
    const { status, notes } = req.body;

    const statusSchema = z.object({
      status: z.enum(appointmentScheduleStatuses),
      notes: z.string().optional(),
    });

    const validation = statusSchema.safeParse({ status, notes });
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors[0].message });
    }

    const appointment = await patientEngagementService.updateAppointmentStatus(
      appointmentId,
      validation.data.status,
      userId,
      validation.data.notes
    );

    res.json({ success: true, data: appointment });
  } catch (error) {
    console.error("[PatientEngagementHub] Update appointment error:", error);
    res.status(500).json({ success: false, error: "Failed to update appointment" });
  }
});

router.get("/reminders", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId } = req.query;
    
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const reminders = await patientEngagementService.getUpcomingReminders(access.profileId);

    res.json({ success: true, data: reminders });
  } catch (error) {
    console.error("[PatientEngagementHub] Get reminders error:", error);
    res.status(500).json({ success: false, error: "Failed to load reminders" });
  }
});

router.get("/rewards", enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { profileId } = req.query;
    
    const access = await verifyProfileAccess(userId, profileId as string);
    if (!access.allowed) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const rewards = await patientEngagementService.getPatientRewards(access.profileId);

    res.json({
      success: true,
      data: rewards,
      disclaimer: "Rewards and points are for motivational purposes only and have no monetary value.",
    });
  } catch (error) {
    console.error("[PatientEngagementHub] Get rewards error:", error);
    res.status(500).json({ success: false, error: "Failed to load rewards" });
  }
});

router.get("/provider/threads", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const threads = await patientEngagementService.getProviderThreads(userId);

    res.json({ success: true, data: threads });
  } catch (error) {
    console.error("[PatientEngagementHub] Provider threads error:", error);
    res.status(500).json({ success: false, error: "Failed to load threads" });
  }
});

router.get("/provider/threads/:threadId", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { threadId } = req.params;

    const hasAccess = await verifyThreadAccess(threadId, userId, "provider");
    if (!hasAccess) {
      logHipaaAudit("PROVIDER_THREAD_ACCESS_DENIED", {
        provider: hashIdentifier(userId),
        threadId: hashIdentifier(threadId),
        reason: "not_authorized"
      });
      return res.status(403).json({ success: false, error: "You do not have access to this conversation" });
    }

    logHipaaAudit("PROVIDER_THREAD_MESSAGES_ACCESS", {
      provider: hashIdentifier(userId),
      threadId: hashIdentifier(threadId),
    });

    const messages = await patientEngagementService.getMessages(threadId, userId, "provider");
    await patientEngagementService.markMessagesRead(threadId, "provider");

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error("[PatientEngagementHub] Provider get messages error:", error);
    res.status(500).json({ success: false, error: "Failed to load messages" });
  }
});

router.post("/provider/messages", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { threadId } = req.body;

    if (!threadId) {
      return res.status(400).json({ success: false, error: "Thread ID is required" });
    }

    const hasAccess = await verifyThreadAccess(threadId, userId, "provider");
    if (!hasAccess) {
      logHipaaAudit("PROVIDER_MESSAGE_SEND_DENIED", {
        provider: hashIdentifier(userId),
        threadId: hashIdentifier(threadId),
        reason: "not_authorized"
      });
      return res.status(403).json({ success: false, error: "You do not have access to this conversation" });
    }
    
    const validation = insertEngagementMessageSchema.safeParse({
      ...req.body,
      senderId: userId,
      senderType: "provider",
    });

    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.errors[0].message });
    }

    const message = await patientEngagementService.sendMessage(validation.data);

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("[PatientEngagementHub] Provider send message error:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

router.get("/enhanced/dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const dashboard = await patientEngagementHubService.getDashboard(patientId);
    res.json(dashboard);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Enhanced dashboard error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/enhanced/conversations/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const conversations = await patientEngagementHubService.getConversations(patientId);
    res.json(conversations);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Conversations error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/enhanced/conversation/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const conversation = await patientEngagementHubService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Conversation error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/enhanced/messages", async (req: Request, res: Response) => {
  try {
    const message = await patientEngagementHubService.sendMessage(req.body);
    res.json(message);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/chatbot/start", async (req: Request, res: Response) => {
  try {
    const { patientId, patientName } = req.body;
    const session = await patientEngagementHubService.startChatbotSession(patientId, patientName);
    res.json(session);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Start chatbot error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/chatbot/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await patientEngagementHubService.getChatbotSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Get chatbot session error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/chatbot/:sessionId/message", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;
    const response = await patientEngagementHubService.sendChatbotMessage(sessionId, content);
    res.json(response);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Chatbot message error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/chatbot/:sessionId/escalate", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const conversation = await patientEngagementHubService.escalateToProvider(sessionId);
    res.json(conversation);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Escalate error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/health-goals/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const goals = await patientEngagementHubService.getHealthGoals(patientId);
    res.json(goals);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Get goals error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/health-goal/:goalId", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const goal = await patientEngagementHubService.getHealthGoal(goalId);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json(goal);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Get goal error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-goals", async (req: Request, res: Response) => {
  try {
    const goal = await patientEngagementHubService.createHealthGoal(req.body);
    res.json(goal);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Create goal error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-goals/:goalId/progress", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const { value, note } = req.body;
    const goal = await patientEngagementHubService.updateHealthGoalProgress(goalId, value, note);
    res.json(goal);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Update progress error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/health-goals/:goalId/milestones", async (req: Request, res: Response) => {
  try {
    const { goalId } = req.params;
    const milestone = await patientEngagementHubService.addMilestone(goalId, req.body);
    res.json(milestone);
  } catch (error: any) {
    console.error("[PatientEngagementHub] Add milestone error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
