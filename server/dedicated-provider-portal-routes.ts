import { Router, Request, Response } from "express";
import { requireRole, auditDataAccess } from "./rbac";
import {
  getProviderProfile,
  verifyProviderAccess,
  getDashboardStats,
  getProviderAlerts,
  acknowledgeAlert,
  getAggregatedPatientData,
  getPatientList,
  generateAIPatientInsights,
  getConversations,
  getMessages,
  sendMessage,
  createConversation,
} from "./services/dedicated-provider-portal-service";

const router = Router();

router.get(
  "/profile",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("ProviderProfile", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await getProviderProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Provider profile not found" });
      }

      res.json({ profile });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching profile:", error);
      res.status(500).json({ error: error.message || "Failed to fetch profile" });
    }
  }
);

router.get(
  "/dashboard/stats",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("ProviderDashboard", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const stats = await getDashboardStats(userId);
      res.json({ stats });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching dashboard stats:", error);
      res.status(500).json({ error: error.message || "Failed to fetch dashboard stats" });
    }
  }
);

router.get(
  "/alerts",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("ProviderAlerts", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const alerts = await getProviderAlerts(userId);
      res.json({ alerts });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching alerts:", error);
      res.status(500).json({ error: error.message || "Failed to fetch alerts" });
    }
  }
);

router.post(
  "/alerts/:alertId/acknowledge",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("ProviderAlert", "acknowledge"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { alertId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const alert = await acknowledgeAlert(userId, alertId);
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ alert });
    } catch (error: any) {
      console.error("[ProviderPortal] Error acknowledging alert:", error);
      res.status(500).json({ error: error.message || "Failed to acknowledge alert" });
    }
  }
);

router.get(
  "/patients",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("PatientList", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await verifyProviderAccess(userId, "view_records");
      if (!hasAccess) {
        return res.status(403).json({ error: "Insufficient privileges to view patient records" });
      }

      const { riskLevel, limit, offset } = req.query;
      const result = await getPatientList(userId, {
        riskLevel: riskLevel as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching patient list:", error);
      res.status(500).json({ error: error.message || "Failed to fetch patient list" });
    }
  }
);

router.get(
  "/patients/:patientId",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("AggregatedPatientData", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { patientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await verifyProviderAccess(userId, "view_records");
      if (!hasAccess) {
        return res.status(403).json({ error: "Insufficient privileges to view patient records" });
      }

      const patientData = await getAggregatedPatientData(userId, patientId);
      res.json({ patient: patientData });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching patient data:", error);
      res.status(500).json({ error: error.message || "Failed to fetch patient data" });
    }
  }
);

router.get(
  "/patients/:patientId/ai-insights",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("AIPatientInsights", "generate"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { patientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await verifyProviderAccess(userId, "view_records");
      if (!hasAccess) {
        return res.status(403).json({ error: "Insufficient privileges to view patient insights" });
      }

      const insights = await generateAIPatientInsights(userId, patientId);
      res.json({ insights });
    } catch (error: any) {
      console.error("[ProviderPortal] Error generating AI insights:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI insights" });
    }
  }
);

router.get(
  "/conversations",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("Conversations", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { patientId, status } = req.query;
      const conversations = await getConversations(userId, {
        patientId: patientId as string,
        status: status as string,
      });

      res.json({ conversations });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching conversations:", error);
      res.status(500).json({ error: error.message || "Failed to fetch conversations" });
    }
  }
);

router.post(
  "/conversations",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("Conversation", "create"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { type, patientId, patientName, participants, subject, priority, status } = req.body;

      if (!subject || !participants || !type) {
        return res.status(400).json({ error: "Missing required fields: type, subject, participants" });
      }

      const conversation = await createConversation(userId, {
        type,
        patientId,
        patientName,
        participants,
        subject,
        lastMessage: "",
        priority: priority || "normal",
        status: status || "active",
      });

      res.status(201).json({ conversation });
    } catch (error: any) {
      console.error("[ProviderPortal] Error creating conversation:", error);
      res.status(500).json({ error: error.message || "Failed to create conversation" });
    }
  }
);

router.get(
  "/conversations/:conversationId/messages",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("SecureMessages", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { conversationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const messages = await getMessages(userId, conversationId);
      res.json({ messages });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching messages:", error);
      res.status(500).json({ error: error.message || "Failed to fetch messages" });
    }
  }
);

router.post(
  "/conversations/:conversationId/messages",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("SecureMessage", "send"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { conversationId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { recipientId, recipientName, recipientType, patientId, subject, content, priority, category, attachments, responseRequired, responseDeadline } = req.body;

      if (!recipientId || !content) {
        return res.status(400).json({ error: "Missing required fields: recipientId, content" });
      }

      const message = await sendMessage(userId, {
        conversationId,
        senderId: userId,
        senderName: "Provider",
        senderRole: "provider",
        recipientId,
        recipientName: recipientName || "Patient",
        recipientType: recipientType || "patient",
        patientId,
        subject: subject || "",
        content,
        priority: priority || "normal",
        category: category || "clinical",
        attachments: attachments || [],
        responseRequired: responseRequired || false,
        responseDeadline,
      });

      res.status(201).json({ message });
    } catch (error: any) {
      console.error("[ProviderPortal] Error sending message:", error);
      res.status(500).json({ error: error.message || "Failed to send message" });
    }
  }
);

router.get(
  "/data-sources/:patientId",
  requireRole("provider", "clinician", "admin"),
  auditDataAccess("ConnectedDataSources", "view"),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.claims?.sub;
      const { patientId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasAccess = await verifyProviderAccess(userId, "view_records");
      if (!hasAccess) {
        return res.status(403).json({ error: "Insufficient privileges" });
      }

      const patientData = await getAggregatedPatientData(userId, patientId);
      res.json({ dataSources: patientData.dataSources });
    } catch (error: any) {
      console.error("[ProviderPortal] Error fetching data sources:", error);
      res.status(500).json({ error: error.message || "Failed to fetch data sources" });
    }
  }
);

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "Dedicated Provider Portal",
    features: [
      "Aggregated patient data from Interoperability Hub",
      "AI-generated summaries and trends (NO-CDS compliant)",
      "Secure patient messaging",
      "Role-based access control (provider/clinician)",
      "HIPAA-compliant audit logging",
    ],
    timestamp: new Date().toISOString(),
  });
});

console.log("[DedicatedProviderPortal] Routes module loaded");
console.log("[DedicatedProviderPortal] RBAC: provider, clinician, admin roles required");

export default router;
