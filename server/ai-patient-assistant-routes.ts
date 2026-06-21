import type { Express, Request, Response } from "express";
import { 
  streamPatientAssistantResponse, 
  getPatientAssistantResponse,
  explainMedicalTerm,
  getAppFeatureGuidance,
  processAppointmentRequest,
  confirmAppointment,
  getAvailableSlots,
  getHealthTips,
  generatePersonalizedHealthTips,
  dismissHealthTip,
  getHealthReminders,
  createHealthReminder,
  updateReminderStatus,
  getSecureMessages,
  sendSecureMessage,
  generateMessageReply,
  getCareTeamProviders,
  type PatientAssistantMessage 
} from "./services/ai-patient-assistant-service";
function logPhiAccess(details: { userId: string; action: string; resourceType: string; resourceId: string; details?: any }) {
  console.log(`[PHI_ACCESS] User: ${details.userId}, Action: ${details.action}, Resource: ${details.resourceType}/${details.resourceId}`, details.details || "");
}

export function registerPatientAssistantRoutes(app: Express): void {
  app.post("/api/patient-assistant/chat", async (req: Request, res: Response) => {
    try {
      const { patientId, messages, userMessage, contextControl } = req.body;
      
      if (!patientId || !userMessage) {
        return res.status(400).json({ error: "patientId and userMessage are required" });
      }

      logPhiAccess({
        userId: patientId,
        action: "patient_assistant_chat",
        resourceType: "ConversationMessage",
        resourceId: patientId,
        details: { messageLength: userMessage.length, contextCategories: contextControl?.categories, timeRange: contextControl?.timeRange },
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const generator = streamPatientAssistantResponse(
        patientId,
        messages || [],
        userMessage,
        contextControl
      );

      let metadata: any = null;

      try {
        while (true) {
          const { value, done } = await generator.next();
          if (done) {
            metadata = value;
            break;
          }
          res.write(`data: ${JSON.stringify({ type: "content", content: value })}\n\n`);
        }

        if (metadata) {
          res.write(`data: ${JSON.stringify({ 
            type: "metadata", 
            suggestedFollowUps: metadata.suggestedFollowUps,
            relatedAppFeatures: metadata.relatedAppFeatures,
            medicalTermsExplained: metadata.medicalTermsExplained,
            includesDisclaimer: metadata.includesDisclaimer,
          })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        res.write(`data: ${JSON.stringify({ type: "error", error: "An error occurred while generating the response" })}\n\n`);
        res.end();
      }
    } catch (error) {
      console.error("Patient assistant chat error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  app.post("/api/patient-assistant/chat-sync", async (req: Request, res: Response) => {
    try {
      const { patientId, messages, userMessage, contextControl } = req.body;
      
      if (!patientId || !userMessage) {
        return res.status(400).json({ error: "patientId and userMessage are required" });
      }

      logPhiAccess({
        userId: patientId,
        action: "patient_assistant_chat_sync",
        resourceType: "ConversationMessage",
        resourceId: patientId,
        details: { messageLength: userMessage.length, contextCategories: contextControl?.categories, timeRange: contextControl?.timeRange },
      });

      const response = await getPatientAssistantResponse(
        patientId,
        messages || [],
        userMessage,
        contextControl
      );

      res.json(response);
    } catch (error) {
      console.error("Patient assistant sync chat error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  app.post("/api/patient-assistant/explain-term", async (req: Request, res: Response) => {
    try {
      const { term } = req.body;
      
      if (!term) {
        return res.status(400).json({ error: "term is required" });
      }

      const explanation = await explainMedicalTerm(term);
      res.json({ term, explanation });
    } catch (error) {
      console.error("Explain term error:", error);
      res.status(500).json({ error: "Failed to explain term" });
    }
  });

  app.get("/api/patient-assistant/feature-guide/:feature", async (req: Request, res: Response) => {
    try {
      const { feature } = req.params;
      const guidance = await getAppFeatureGuidance(feature);
      res.json({ feature, guidance });
    } catch (error) {
      console.error("Feature guide error:", error);
      res.status(500).json({ error: "Failed to get feature guidance" });
    }
  });

  app.get("/api/patient-assistant/quick-prompts", async (req: Request, res: Response) => {
    const quickPrompts = [
      { id: "medications", icon: "pill", text: "Explain my medications", category: "health" },
      { id: "conditions", icon: "heart", text: "What conditions do I have?", category: "health" },
      { id: "labs", icon: "flask", text: "Help me understand my lab results", category: "health" },
      { id: "appointments", icon: "calendar", text: "When is my next appointment?", category: "schedule" },
      { id: "navigate", icon: "compass", text: "How do I use this app?", category: "help" },
      { id: "term", icon: "book", text: "Explain a medical term", category: "education" },
    ];
    res.json(quickPrompts);
  });

  app.post("/api/patient-assistant/appointments/process", async (req: Request, res: Response) => {
    try {
      const { patientId, request } = req.body;
      if (!patientId || !request) {
        return res.status(400).json({ error: "patientId and request are required" });
      }
      const result = await processAppointmentRequest(patientId, request);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Appointment process error:", error);
      res.status(500).json({ error: "Failed to process appointment request" });
    }
  });

  app.post("/api/patient-assistant/appointments/confirm", async (req: Request, res: Response) => {
    try {
      const { patientId, slotId, reason } = req.body;
      if (!patientId || !slotId) {
        return res.status(400).json({ error: "patientId and slotId are required" });
      }
      const result = await confirmAppointment(patientId, slotId, reason);
      res.json(result);
    } catch (error) {
      console.error("Appointment confirm error:", error);
      res.status(500).json({ error: "Failed to confirm appointment" });
    }
  });

  app.get("/api/patient-assistant/appointments/slots", async (req: Request, res: Response) => {
    try {
      const slots = getAvailableSlots();
      res.json({ success: true, slots });
    } catch (error) {
      console.error("Get slots error:", error);
      res.status(500).json({ error: "Failed to get available slots" });
    }
  });

  app.get("/api/patient-assistant/health-tips/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const tips = getHealthTips(patientId);
      res.json({ success: true, tips });
    } catch (error) {
      console.error("Get health tips error:", error);
      res.status(500).json({ error: "Failed to get health tips" });
    }
  });

  app.post("/api/patient-assistant/health-tips/generate", async (req: Request, res: Response) => {
    try {
      const { patientId, conditions, medications } = req.body;
      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }
      const tips = await generatePersonalizedHealthTips(patientId, conditions || [], medications || []);
      res.json({ success: true, tips });
    } catch (error) {
      console.error("Generate health tips error:", error);
      res.status(500).json({ error: "Failed to generate health tips" });
    }
  });

  app.post("/api/patient-assistant/health-tips/:tipId/dismiss", async (req: Request, res: Response) => {
    try {
      const { tipId } = req.params;
      const { patientId } = req.body;
      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }
      const dismissed = dismissHealthTip(patientId, tipId);
      res.json({ success: dismissed });
    } catch (error) {
      console.error("Dismiss tip error:", error);
      res.status(500).json({ error: "Failed to dismiss tip" });
    }
  });

  app.get("/api/patient-assistant/reminders/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const reminders = getHealthReminders(patientId);
      res.json({ success: true, reminders });
    } catch (error) {
      console.error("Get reminders error:", error);
      res.status(500).json({ error: "Failed to get reminders" });
    }
  });

  app.post("/api/patient-assistant/reminders", async (req: Request, res: Response) => {
    try {
      const { patientId, title, description, type, scheduledFor, recurring, recurrencePattern } = req.body;
      if (!patientId || !title || !type || !scheduledFor) {
        return res.status(400).json({ error: "patientId, title, type, and scheduledFor are required" });
      }
      const reminder = createHealthReminder(patientId, { patientId, title, description, type, scheduledFor, recurring, recurrencePattern });
      res.json({ success: true, reminder });
    } catch (error) {
      console.error("Create reminder error:", error);
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  app.patch("/api/patient-assistant/reminders/:reminderId", async (req: Request, res: Response) => {
    try {
      const { reminderId } = req.params;
      const { patientId, status } = req.body;
      if (!patientId || !status) {
        return res.status(400).json({ error: "patientId and status are required" });
      }
      const reminder = updateReminderStatus(patientId, reminderId, status);
      res.json({ success: !!reminder, reminder });
    } catch (error) {
      console.error("Update reminder error:", error);
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  app.get("/api/patient-assistant/messages/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const messages = getSecureMessages(patientId);
      res.json({ success: true, messages });
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  app.post("/api/patient-assistant/messages", async (req: Request, res: Response) => {
    try {
      const { patientId, recipientId, recipientType, recipientName, content, subject } = req.body;
      if (!patientId || !recipientId || !content) {
        return res.status(400).json({ error: "patientId, recipientId, and content are required" });
      }
      const result = await sendSecureMessage(patientId, recipientId, recipientType || "provider", recipientName || "Care Team", content, subject);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.post("/api/patient-assistant/messages/suggest-reply", async (req: Request, res: Response) => {
    try {
      const { patientId, incomingMessage } = req.body;
      if (!patientId || !incomingMessage) {
        return res.status(400).json({ error: "patientId and incomingMessage are required" });
      }
      const suggestedReply = await generateMessageReply(patientId, incomingMessage);
      res.json({ success: true, suggestedReply });
    } catch (error) {
      console.error("Suggest reply error:", error);
      res.status(500).json({ error: "Failed to generate reply" });
    }
  });

  app.get("/api/patient-assistant/care-team", async (req: Request, res: Response) => {
    try {
      const providers = getCareTeamProviders();
      res.json({ success: true, providers });
    } catch (error) {
      console.error("Get care team error:", error);
      res.status(500).json({ error: "Failed to get care team" });
    }
  });

  console.log("[Routes] AI Patient Assistant routes registered at /api/patient-assistant/*");
}
