import { Router, Request, Response } from "express";
import { providerCommunicationService } from "./services/provider-communication-service";

const router = Router();

router.get("/threads", async (req: Request, res: Response) => {
  try {
    const providerId = (req.query.providerId as string) || "prov-current";
    const patientId = req.query.patientId as string | undefined;

    const threads = await providerCommunicationService.getThreads(providerId, patientId);

    res.json({
      success: true,
      data: threads
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error fetching threads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch communication threads"
    });
  }
});

router.get("/threads/:threadId", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const providerId = (req.query.providerId as string) || "prov-current";

    const thread = await providerCommunicationService.getThread(threadId, providerId);

    if (!thread) {
      return res.status(404).json({
        success: false,
        error: "Thread not found or access denied"
      });
    }

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error fetching thread:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch thread"
    });
  }
});

router.post("/threads", async (req: Request, res: Response) => {
  try {
    const {
      providerId = "prov-current",
      patientId,
      patientName,
      subject,
      category,
      message,
      priority = "routine",
      recipientIds,
      attachments = []
    } = req.body;

    if (!patientId || !subject || !message || !recipientIds?.length) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: patientId, subject, message, recipientIds"
      });
    }

    const thread = await providerCommunicationService.createThread(
      providerId,
      patientId,
      patientName || "Unknown Patient",
      subject,
      category || "consultation",
      message,
      priority,
      recipientIds,
      attachments
    );

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error creating thread:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create communication thread"
    });
  }
});

router.post("/threads/:threadId/messages", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const {
      providerId = "prov-current",
      content,
      priority = "routine",
      attachments = []
    } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: "Message content is required"
      });
    }

    const message = await providerCommunicationService.sendMessage(
      threadId,
      providerId,
      content,
      priority,
      attachments
    );

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message"
    });
  }
});

router.post("/threads/:threadId/resolve", async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { providerId = "prov-current" } = req.body;

    const thread = await providerCommunicationService.resolveThread(threadId, providerId);

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error resolving thread:", error);
    res.status(500).json({
      success: false,
      error: "Failed to resolve thread"
    });
  }
});

router.get("/audit-trail", async (req: Request, res: Response) => {
  try {
    const threadId = req.query.threadId as string | undefined;
    const patientId = req.query.patientId as string | undefined;

    const entries = await providerCommunicationService.getAuditTrail(threadId, patientId);

    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error fetching audit trail:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch audit trail"
    });
  }
});

router.get("/patient-summary/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const providerId = (req.query.providerId as string) || "prov-current";

    const summary = await providerCommunicationService.generatePatientSummary(patientId, providerId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error generating patient summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate patient summary"
    });
  }
});

router.get("/providers", async (_req: Request, res: Response) => {
  try {
    const providers = await providerCommunicationService.getProviders();

    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error("[ProviderCommunication] Error fetching providers:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch providers"
    });
  }
});

export default router;
