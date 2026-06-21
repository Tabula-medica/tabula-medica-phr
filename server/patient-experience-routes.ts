import { Router, Request, Response } from "express";
import { db } from "./db";
import {
  messages,
  healthRecommendations,
  patientAlerts,
  appointments,
  insertMessageSchema,
  insertHealthRecommendationSchema,
  insertPatientAlertSchema,
  insertAppointmentSchema,
} from "@shared/models/patient-experience";
import { eq, and, or, desc, asc, gte, lte, sql, ilike } from "drizzle-orm";
import { logPhiAccess } from "./security/hipaa-audit";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "./replit_integrations/auth";

const router = Router();

router.use(isAuthenticated);

function getAuthenticatedPatientId(req: Request): string | null {
  const user = (req as any).user;
  return user?.claims?.sub || user?.id || null;
}

function getAuthenticatedDisplayName(req: Request): string {
  const user = (req as any).user;
  return user?.claims?.name || user?.name || user?.claims?.email || getAuthenticatedPatientId(req) || "Patient";
}

router.get("/dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const now = new Date();
    const upcomingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          gte(appointments.scheduledAt, now),
          or(
            eq(appointments.status, "scheduled"),
            eq(appointments.status, "confirmed")
          )
        )
      )
      .orderBy(asc(appointments.scheduledAt))
      .limit(5);

    const recentAlerts = await db
      .select()
      .from(patientAlerts)
      .where(
        and(
          eq(patientAlerts.patientId, patientId),
          eq(patientAlerts.isDismissed, false)
        )
      )
      .orderBy(desc(patientAlerts.createdAt))
      .limit(10);

    const activeRecommendations = await db
      .select()
      .from(healthRecommendations)
      .where(
        and(
          eq(healthRecommendations.patientId, patientId),
          eq(healthRecommendations.isActive, true),
          eq(healthRecommendations.isCompleted, false)
        )
      )
      .orderBy(
        sql`CASE ${healthRecommendations.priority} 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 END`
      )
      .limit(5);

    const unreadMessages = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.patientId, patientId),
          eq(messages.recipientId, patientId),
          eq(messages.isRead, false)
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(5);

    const [messageStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.patientId, patientId),
          eq(messages.recipientId, patientId),
          eq(messages.isRead, false)
        )
      );

    const [alertStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(patientAlerts)
      .where(
        and(
          eq(patientAlerts.patientId, patientId),
          eq(patientAlerts.isDismissed, false),
          eq(patientAlerts.isRead, false)
        )
      );

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "PatientDashboard",
      resourceId: patientId,
      details: `Viewed patient dashboard: appointments=${upcomingAppointments.length}, alerts=${recentAlerts.length}`,
    });

    res.json({
      patientId,
      upcomingAppointments,
      recentAlerts,
      activeRecommendations,
      unreadMessages,
      stats: {
        unreadMessageCount: Number(messageStats?.count || 0),
        unreadAlertCount: Number(alertStats?.count || 0),
        appointmentCount: upcomingAppointments.length,
        recommendationCount: activeRecommendations.length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PatientExperience] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/messages/threads", async (req: Request, res: Response) => {
  try {
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const patientMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.patientId, patientId))
      .orderBy(desc(messages.createdAt));

    const threadMap = new Map<string, {
      id: string;
      subject: string;
      participants: Set<string>;
      messages: typeof patientMessages;
      createdAt: Date;
      updatedAt: Date;
    }>();

    for (const msg of patientMessages) {
      const threadId = msg.threadId || msg.id;
      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          id: threadId,
          subject: msg.subject || "Conversation",
          participants: new Set(),
          messages: [],
          createdAt: msg.createdAt || new Date(),
          updatedAt: msg.createdAt || new Date(),
        });
      }
      const thread = threadMap.get(threadId)!;
      thread.messages.push(msg);
      thread.participants.add(msg.senderName || msg.senderId);
      if (msg.recipientName) {
        thread.participants.add(msg.recipientName);
      }
      if (msg.createdAt && msg.createdAt > thread.updatedAt) {
        thread.updatedAt = msg.createdAt;
      }
    }

    const threads = Array.from(threadMap.values()).map(thread => ({
      id: thread.id,
      patientId,
      subject: thread.subject,
      participants: Array.from(thread.participants).filter(p => p !== patientId),
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messages: thread.messages.map(m => ({
        id: m.id,
        threadId: thread.id,
        senderId: m.senderId,
        senderName: m.senderName || "Unknown",
        senderRole: m.senderType || "clinician",
        content: m.content,
        isRead: m.isRead || false,
        createdAt: m.createdAt?.toISOString() || new Date().toISOString(),
      })),
    }));

    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "MessageThreads",
      resourceId: patientId,
      details: `Listed message threads: count=${threads.length}`,
    });

    res.json(threads);
  } catch (error) {
    console.error("[PatientExperience] Threads list error:", error);
    res.status(500).json({ error: "Failed to load message threads" });
  }
});

router.get("/messages/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    const conditions = [eq(messages.patientId, patientId)];
    if (unreadOnly) {
      conditions.push(eq(messages.isRead, false));
    }

    const messageList = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(and(...conditions));

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "PatientMessages",
      resourceId: patientId,
      details: `Listed messages: count=${messageList.length}, unreadOnly=${unreadOnly}`,
    });

    res.json({
      messages: messageList,
      total: Number(count),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[PatientExperience] Messages list error:", error);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

router.get("/messages/:patientId/:messageId", async (req: Request, res: Response) => {
  try {
    const { patientId, messageId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const [message] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.patientId, patientId)
        )
      );

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!message.isRead) {
      await db
        .update(messages)
        .set({ isRead: true, readAt: new Date() })
        .where(eq(messages.id, messageId));
    }

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "PatientMessage",
      resourceId: messageId,
      details: `Read message: subject="${message.subject}"`,
    });

    res.json(message);
  } catch (error) {
    console.error("[PatientExperience] Message get error:", error);
    res.status(500).json({ error: "Failed to load message" });
  }
});

router.post("/messages", async (req: Request, res: Response) => {
  try {
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const parseResult = insertMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const threadId = crypto.randomUUID();

    const senderName = getAuthenticatedDisplayName(req);

    const [newMessage] = await db
      .insert(messages)
      .values({
        ...parseResult.data,
        patientId: authedId,
        senderId: authedId,
        senderType: "patient",
        senderName,
        recipientId: "care-team",
        recipientType: "care_team",
        recipientName: "Care Team",
        threadId,
      })
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "PatientMessage",
      resourceId: newMessage.id,
      details: `Sent message: to=${newMessage.recipientName}, subject="${newMessage.subject}"`,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("[PatientExperience] Message create error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/messages/:messageId/read", async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const [existing] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));

    if (!existing) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (existing.patientId !== authedId && existing.recipientId !== authedId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [updatedMessage] = await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "PatientMessage",
      resourceId: messageId,
      details: "Marked message as read",
    });

    res.json(updatedMessage);
  } catch (error) {
    console.error("[PatientExperience] Message read error:", error);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.get("/recommendations/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const activeOnly = req.query.activeOnly !== "false";
    const category = req.query.category as string;

    const conditions = [eq(healthRecommendations.patientId, patientId)];
    if (activeOnly) {
      conditions.push(eq(healthRecommendations.isActive, true));
      conditions.push(eq(healthRecommendations.isCompleted, false));
    }
    if (category) {
      conditions.push(eq(healthRecommendations.category, category));
    }

    const recommendationList = await db
      .select()
      .from(healthRecommendations)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${healthRecommendations.priority} 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 END`,
        desc(healthRecommendations.createdAt)
      );

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "HealthRecommendations",
      resourceId: patientId,
      details: `Listed recommendations: count=${recommendationList.length}, activeOnly=${activeOnly}`,
    });

    res.json({ recommendations: recommendationList });
  } catch (error) {
    console.error("[PatientExperience] Recommendations list error:", error);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});

router.post("/recommendations", async (req: Request, res: Response) => {
  try {
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const parseResult = insertHealthRecommendationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const [newRecommendation] = await db
      .insert(healthRecommendations)
      .values({
        ...parseResult.data,
        patientId: authedId,
        clinicianId: "patient-reported",
        clinicianName: "Patient-reported",
      })
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "HealthRecommendation",
      resourceId: newRecommendation.id,
      details: `Created recommendation: "${newRecommendation.title}" for patient ${newRecommendation.patientId}`,
    });

    res.status(201).json(newRecommendation);
  } catch (error) {
    console.error("[PatientExperience] Recommendation create error:", error);
    res.status(500).json({ error: "Failed to create recommendation" });
  }
});

router.patch("/recommendations/:id/complete", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { patientNotes } = req.body;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const [existing] = await db
      .select()
      .from(healthRecommendations)
      .where(eq(healthRecommendations.id, id));

    if (!existing) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    if (existing.patientId !== authedId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [updated] = await db
      .update(healthRecommendations)
      .set({
        isCompleted: true,
        completedAt: new Date(),
        patientNotes: patientNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(healthRecommendations.id, id))
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "HealthRecommendation",
      resourceId: id,
      details: `Completed recommendation: "${updated.title}"`,
    });

    res.json(updated);
  } catch (error) {
    console.error("[PatientExperience] Recommendation complete error:", error);
    res.status(500).json({ error: "Failed to complete recommendation" });
  }
});

router.get("/alerts/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const includeDismissed = req.query.includeDismissed === "true";
    const severity = req.query.severity as string;

    const conditions = [eq(patientAlerts.patientId, patientId)];
    if (!includeDismissed) {
      conditions.push(eq(patientAlerts.isDismissed, false));
    }
    if (severity) {
      conditions.push(eq(patientAlerts.severity, severity));
    }

    const alertList = await db
      .select()
      .from(patientAlerts)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${patientAlerts.severity} 
          WHEN 'critical' THEN 1 
          WHEN 'warning' THEN 2 
          ELSE 3 END`,
        desc(patientAlerts.createdAt)
      );

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "PatientAlerts",
      resourceId: patientId,
      details: `Listed alerts: count=${alertList.length}`,
    });

    res.json({ alerts: alertList });
  } catch (error) {
    console.error("[PatientExperience] Alerts list error:", error);
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

router.patch("/alerts/:alertId/dismiss", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const [existing] = await db
      .select()
      .from(patientAlerts)
      .where(eq(patientAlerts.id, alertId));

    if (!existing) {
      return res.status(404).json({ error: "Alert not found" });
    }

    if (existing.patientId !== authedId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const [updated] = await db
      .update(patientAlerts)
      .set({ isDismissed: true, isRead: true, readAt: new Date() })
      .where(eq(patientAlerts.id, alertId))
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "PatientAlert",
      resourceId: alertId,
      details: `Dismissed alert: "${updated.title}"`,
    });

    res.json(updated);
  } catch (error) {
    console.error("[PatientExperience] Alert dismiss error:", error);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

router.get("/appointments/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });
    if (authedId !== patientId) return res.status(403).json({ error: "Access denied" });

    const upcoming = req.query.upcoming !== "false";
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const now = new Date();
    const conditions = [eq(appointments.patientId, patientId)];

    if (upcoming) {
      conditions.push(gte(appointments.scheduledAt, now));
    }

    const appointmentList = await db
      .select()
      .from(appointments)
      .where(and(...conditions))
      .orderBy(upcoming ? asc(appointments.scheduledAt) : desc(appointments.scheduledAt))
      .limit(limit);

    logPhiAccess({
      userId: authedId,
      action: "read",
      resourceType: "PatientAppointments",
      resourceId: patientId,
      details: `Listed appointments: count=${appointmentList.length}, upcoming=${upcoming}`,
    });

    res.json({ appointments: appointmentList });
  } catch (error) {
    console.error("[PatientExperience] Appointments list error:", error);
    res.status(500).json({ error: "Failed to load appointments" });
  }
});

router.post("/appointments", async (req: Request, res: Response) => {
  try {
    const authedId = getAuthenticatedPatientId(req);
    if (!authedId) return res.status(401).json({ error: "Authentication required" });

    const parseResult = insertAppointmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: fromError(parseResult.error).message,
      });
    }

    const [newAppointment] = await db
      .insert(appointments)
      .values({
        ...parseResult.data,
        patientId: authedId,
        clinicianId: "unassigned",
        clinicianName: "Pending assignment",
        status: "scheduled",
        meetingUrl: null,
      })
      .returning();

    logPhiAccess({
      userId: authedId,
      action: "write",
      resourceType: "PatientAppointment",
      resourceId: newAppointment.id,
      details: `Created appointment: ${newAppointment.appointmentType} with ${newAppointment.clinicianName}`,
    });

    res.status(201).json(newAppointment);
  } catch (error) {
    console.error("[PatientExperience] Appointment create error:", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const now = new Date();
    const upcomingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          gte(appointments.scheduledAt, now),
          or(
            eq(appointments.status, "scheduled"),
            eq(appointments.status, "confirmed")
          )
        )
      )
      .orderBy(asc(appointments.scheduledAt))
      .limit(5);

    const activeAlerts = await db
      .select()
      .from(patientAlerts)
      .where(
        and(
          eq(patientAlerts.patientId, patientId),
          eq(patientAlerts.isDismissed, false)
        )
      )
      .orderBy(desc(patientAlerts.createdAt))
      .limit(10);

    const recommendations = await db
      .select()
      .from(healthRecommendations)
      .where(
        and(
          eq(healthRecommendations.patientId, patientId),
          eq(healthRecommendations.isActive, true),
          eq(healthRecommendations.isCompleted, false)
        )
      )
      .orderBy(
        sql`CASE ${healthRecommendations.priority} 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 END`
      )
      .limit(5);

    const [messageStats] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.patientId, patientId),
          eq(messages.recipientId, patientId),
          eq(messages.isRead, false)
        )
      );

    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "PatientDashboard",
      resourceId: patientId,
      details: `Viewed dashboard: appointments=${upcomingAppointments.length}, alerts=${activeAlerts.length}`,
    });

    const transformedAlerts = activeAlerts.map(alert => ({
      id: alert.id,
      patientId: alert.patientId,
      type: alert.category,
      title: alert.title,
      message: alert.description,
      severity: alert.severity === "critical" ? "critical" :
                alert.severity === "warning" ? "high" :
                alert.severity === "info" ? "medium" : "low",
      isRead: alert.isRead,
      createdAt: alert.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const transformedRecommendations = recommendations.map(rec => ({
      id: rec.id,
      patientId: rec.patientId,
      type: rec.category || "lifestyle",
      title: rec.title,
      description: rec.description,
      priority: rec.priority === "critical" ? "high" : rec.priority || "medium",
      status: rec.isCompleted ? "completed" : rec.isActive ? "active" : "inactive",
      createdBy: rec.clinicianName || "Care Team",
      createdAt: rec.createdAt?.toISOString() || new Date().toISOString(),
    }));

    const transformedAppointments = upcomingAppointments.map(apt => ({
      id: apt.id,
      patientId: apt.patientId,
      providerId: apt.clinicianId,
      providerName: apt.clinicianName,
      type: apt.appointmentType,
      scheduledAt: apt.scheduledAt?.toISOString() || new Date().toISOString(),
      status: apt.status,
      notes: apt.notes,
    }));

    res.json({
      patientId,
      upcomingAppointments: transformedAppointments,
      activeAlerts: transformedAlerts,
      recommendations: transformedRecommendations,
      unreadMessages: Number(messageStats?.count || 0),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PatientExperience] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.post("/messages/threads/:threadId/messages", async (req: Request, res: Response) => {
  try {
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const { threadId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const [existingThread] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.threadId, threadId),
          eq(messages.patientId, patientId)
        )
      )
      .limit(1);

    if (!existingThread) {
      return res.status(404).json({ error: "Thread not found or access denied" });
    }

    const recipientId = existingThread.senderId !== patientId
      ? existingThread.senderId
      : existingThread.recipientId || "care-team";
    const recipientName = existingThread.senderName !== patientId
      ? existingThread.senderName
      : existingThread.recipientName || "Care Team";

    const [newMessage] = await db
      .insert(messages)
      .values({
        patientId,
        senderId: patientId,
        senderName: "Patient",
        senderType: "patient",
        recipientId,
        recipientName: recipientName || "Care Team",
        subject: existingThread.subject || "Reply",
        content: content.trim(),
        threadId,
        isRead: false,
      })
      .returning();

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "PatientMessage",
      resourceId: newMessage.id,
      details: `Patient sent message in thread ${threadId}`,
    });

    res.status(201).json({
      id: newMessage.id,
      threadId,
      senderId: newMessage.senderId,
      senderName: newMessage.senderName,
      senderRole: "patient",
      content: newMessage.content,
      isRead: false,
      createdAt: newMessage.createdAt?.toISOString() || new Date().toISOString(),
    });
  } catch (error) {
    console.error("[PatientExperience] Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/recommendations", async (req: Request, res: Response) => {
  try {
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const recommendationList = await db
      .select()
      .from(healthRecommendations)
      .where(
        and(
          eq(healthRecommendations.patientId, patientId),
          eq(healthRecommendations.isActive, true)
        )
      )
      .orderBy(
        sql`CASE ${healthRecommendations.priority} 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 END`,
        desc(healthRecommendations.createdAt)
      );

    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "HealthRecommendations",
      resourceId: patientId,
      details: `Listed recommendations: count=${recommendationList.length}`,
    });

    const transformed = recommendationList.map(rec => ({
      id: rec.id,
      patientId: rec.patientId,
      type: rec.category || "lifestyle",
      title: rec.title,
      description: rec.description,
      priority: rec.priority === "critical" ? "high" : rec.priority || "medium",
      status: rec.isCompleted ? "completed" : rec.isActive ? "active" : "inactive",
      createdBy: rec.clinicianName || "Care Team",
      createdAt: rec.createdAt?.toISOString() || new Date().toISOString(),
    }));

    res.json(transformed);
  } catch (error) {
    console.error("[PatientExperience] Recommendations error:", error);
    res.status(500).json({ error: "Failed to load recommendations" });
  }
});

router.post("/recommendations/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const [updated] = await db
      .update(healthRecommendations)
      .set({
        patientNotes: "Acknowledged by patient",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(healthRecommendations.id, id),
          eq(healthRecommendations.patientId, patientId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "HealthRecommendation",
      resourceId: id,
      details: `Patient acknowledged recommendation: "${updated.title}"`,
    });

    res.json({ success: true, id });
  } catch (error) {
    console.error("[PatientExperience] Acknowledge recommendation error:", error);
    res.status(500).json({ error: "Failed to acknowledge recommendation" });
  }
});

router.post("/alerts/:alertId/read", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const patientId = getAuthenticatedPatientId(req);
    if (!patientId) return res.status(401).json({ error: "Authentication required" });

    const [updated] = await db
      .update(patientAlerts)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(patientAlerts.id, alertId),
          eq(patientAlerts.patientId, patientId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Alert not found" });
    }

    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "PatientAlert",
      resourceId: alertId,
      details: `Patient marked alert as read: "${updated.title}"`,
    });

    res.json({ success: true, id: alertId });
  } catch (error) {
    console.error("[PatientExperience] Mark alert read error:", error);
    res.status(500).json({ error: "Failed to mark alert as read" });
  }
});

export default router;
