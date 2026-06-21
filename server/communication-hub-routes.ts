import type { Express } from "express";
import { 
  unifiedCommunicationHub, 
  ConversationType, 
  TelehealthStatus 
} from "./services/unified-communication-hub-service";
import { z } from "zod";

export function registerCommunicationHubRoutes(app: Express) {
  app.get("/api/communication-hub/stats", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const stats = unifiedCommunicationHub.getHubStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/conversations", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const type = req.query.type as ConversationType | undefined;
      const includeArchived = req.query.includeArchived === "true";

      const conversations = unifiedCommunicationHub.getConversations(userId, { type, includeArchived });
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/conversations/:conversationId", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { conversationId } = req.params;

      const conversation = unifiedCommunicationHub.getConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/conversations", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const userName = (req as any).user?.name || "Sample User";

      const schema = z.object({
        type: z.enum(["patient_provider", "care_team", "internal", "broadcast"]),
        subject: z.string().optional(),
        participants: z.array(z.object({
          id: z.string(),
          name: z.string(),
          role: z.enum(["patient", "provider", "caregiver", "admin", "care_team"]),
          avatar: z.string().optional(),
        })),
      });

      const data = schema.parse(req.body);
      const conversation = unifiedCommunicationHub.createConversation({
        ...data,
        createdBy: userId,
      });

      res.status(201).json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/conversations/:conversationId/messages", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;

      const messages = unifiedCommunicationHub.getMessages(conversationId, userId, { limit, before });
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/conversations/:conversationId/messages", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const userName = (req as any).user?.name || "Sample User";
      const userRole = (req as any).user?.role || "patient";
      const { conversationId } = req.params;

      const schema = z.object({
        content: z.string().min(1),
        contentType: z.enum(["text", "attachment", "document", "link", "appointment_invite", "telehealth_invite"]).default("text"),
        attachments: z.array(z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          size: z.number(),
          url: z.string().optional(),
        })).optional(),
        replyTo: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const message = unifiedCommunicationHub.sendMessage({
        conversationId,
        senderId: userId,
        senderName: userName,
        senderRole: userRole,
        ...data,
      });

      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/communication-hub/messages/:messageId/read", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { messageId } = req.params;
      const { conversationId } = req.body;

      const success = unifiedCommunicationHub.markMessageAsRead(conversationId, messageId, userId);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/documents", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const sent = req.query.sent === "true";
      const received = req.query.received === "true";

      const documents = unifiedCommunicationHub.getSharedDocuments(userId, { sent, received });
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/documents/share", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "provider-001";
      const userName = (req as any).user?.name || "Dr. Sample Provider";

      const schema = z.object({
        recipientId: z.string(),
        recipientName: z.string(),
        documentId: z.string(),
        documentName: z.string(),
        documentType: z.string(),
        documentSize: z.number(),
        message: z.string().optional(),
        expiresInDays: z.number().optional(),
      });

      const data = schema.parse(req.body);
      const sharedDoc = unifiedCommunicationHub.shareDocument({
        senderId: userId,
        senderName: userName,
        ...data,
      });

      res.status(201).json(sharedDoc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/documents/:shareId/access", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { shareId } = req.params;
      const { accessType } = req.body;

      const doc = unifiedCommunicationHub.accessSharedDocument(shareId, userId, accessType || "view");
      if (!doc) {
        return res.status(404).json({ error: "Document not found or access denied" });
      }
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/documents/:shareId/receipts", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "provider-001";
      const { shareId } = req.params;

      const receipts = unifiedCommunicationHub.getDocumentReadReceipt(shareId, userId);
      if (!receipts) {
        return res.status(404).json({ error: "Document not found or not the sender" });
      }
      res.json(receipts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/telehealth", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const status = req.query.status as TelehealthStatus | undefined;
      const upcoming = req.query.upcoming === "true";

      const sessions = unifiedCommunicationHub.getTelehealthSessions(userId, { status, upcoming });
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/telehealth", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "provider-001";
      const userName = (req as any).user?.name || "Dr. Sample Provider";

      const schema = z.object({
        appointmentId: z.string().optional(),
        patientId: z.string(),
        patientName: z.string(),
        scheduledAt: z.string(),
        waitingRoomEnabled: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
      });

      const data = schema.parse(req.body);
      const session = unifiedCommunicationHub.createTelehealthSession({
        ...data,
        providerId: userId,
        providerName: userName,
      });

      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/telehealth/:sessionId/start", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { sessionId } = req.params;

      const session = unifiedCommunicationHub.startTelehealthSession(sessionId, userId);
      if (!session) {
        return res.status(404).json({ error: "Session not found or access denied" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/communication-hub/telehealth/:sessionId/end", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "provider-001";
      const { sessionId } = req.params;
      const { notes } = req.body;

      const session = unifiedCommunicationHub.endTelehealthSession(sessionId, userId, notes);
      if (!session) {
        return res.status(404).json({ error: "Session not found or not provider" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/communication-hub/notifications", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const unreadOnly = req.query.unreadOnly === "true";
      const type = req.query.type as any;

      const notifications = unifiedCommunicationHub.getNotifications(userId, { unreadOnly, type });
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/communication-hub/notifications/:notificationId/read", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "patient-001";
      const { notificationId } = req.params;

      const success = unifiedCommunicationHub.markNotificationAsRead(notificationId, userId);
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log("[CommunicationHubRoutes] Routes registered at /api/communication-hub/*");
}
