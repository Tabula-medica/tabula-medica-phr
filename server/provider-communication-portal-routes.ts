import { Router, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";
import { 
  providerCommunicationPortalService,
  type MessageCategory,
  type AppointmentRequest,
  type SharedHealthData,
} from "./services/provider-communication-portal-service";

const router = Router();

router.use(isAuthenticated);
router.use(requireRole("provider", "admin"));

function logAudit(action: string, userId: string, resourceType: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][ProviderPortalRoutes] ${action} - ${resourceType}/${resourceId} by ${userId}: ${details}`);
}

function getAuthenticatedUserId(req: Request): string {
  return (req as any).user?.claims?.sub || (req as any).user?.id || "unknown";
}

router.post("/triage", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    
    const { messageId, conversationId, patientId, patientName, content } = req.body;
    
    if (!messageId || !conversationId || !patientId || !content) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const triaged = await providerCommunicationPortalService.triageMessage(
      messageId,
      conversationId,
      patientId,
      patientName || "Patient",
      content,
      userId
    );

    logAudit("TRIAGE_REQUEST", userId, "Message", messageId, `Triaged with priority: ${triaged.priority}`);
    res.json(triaged);
  } catch (error) {
    console.error("[ProviderPortal] Triage error:", error);
    res.status(500).json({ error: "Failed to triage message" });
  }
});

router.get("/triage/queue", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    
    const messages = providerCommunicationPortalService.getTriagedMessages(providerId);
    
    logAudit("VIEW_TRIAGE_QUEUE", providerId, "TriageQueue", "all", `Viewing ${messages.length} triaged messages`);
    res.json(messages);
  } catch (error) {
    console.error("[ProviderPortal] Get triage queue error:", error);
    res.status(500).json({ error: "Failed to get triage queue" });
  }
});

router.get("/triage/statistics", async (req: Request, res: Response) => {
  try {
    const stats = providerCommunicationPortalService.getTriageStatistics();
    res.json(stats);
  } catch (error) {
    console.error("[ProviderPortal] Get statistics error:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

router.post("/draft-response", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    const providerName = (req as any).user?.claims?.name || "Dr. Provider";
    
    const { messageId, conversationId, originalMessage, patientName, context } = req.body;
    
    if (!messageId || !conversationId || !originalMessage) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const draft = await providerCommunicationPortalService.generateDraftResponse(
      messageId,
      conversationId,
      originalMessage,
      patientName || "Patient",
      providerName,
      providerId,
      context
    );

    logAudit("GENERATE_DRAFT", providerId, "DraftResponse", draft.id, `Draft generated for message ${messageId}`);
    res.json(draft);
  } catch (error) {
    console.error("[ProviderPortal] Generate draft error:", error);
    res.status(500).json({ error: "Failed to generate draft response" });
  }
});

router.get("/drafts", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    
    const drafts = providerCommunicationPortalService.getDraftResponses(providerId);
    
    logAudit("VIEW_DRAFTS", providerId, "DraftQueue", "all", `Viewing ${drafts.length} pending drafts`);
    res.json(drafts);
  } catch (error) {
    console.error("[ProviderPortal] Get drafts error:", error);
    res.status(500).json({ error: "Failed to get drafts" });
  }
});

router.post("/drafts/:draftId/approve", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    const { draftId } = req.params;
    const { editedContent } = req.body;

    const draft = await providerCommunicationPortalService.approveDraft(draftId, providerId, editedContent);
    
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    logAudit("APPROVE_DRAFT", providerId, "DraftResponse", draftId, `Draft approved${editedContent ? " with edits" : ""}`);
    res.json(draft);
  } catch (error) {
    console.error("[ProviderPortal] Approve draft error:", error);
    res.status(500).json({ error: "Failed to approve draft" });
  }
});

router.post("/drafts/:draftId/reject", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    const { draftId } = req.params;
    const { reason } = req.body;

    const draft = await providerCommunicationPortalService.rejectDraft(draftId, providerId, reason || "No reason provided");
    
    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    logAudit("REJECT_DRAFT", providerId, "DraftResponse", draftId, `Draft rejected`);
    res.json(draft);
  } catch (error) {
    console.error("[ProviderPortal] Reject draft error:", error);
    res.status(500).json({ error: "Failed to reject draft" });
  }
});

router.post("/appointment-requests", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    
    const { 
      conversationId, 
      patientId,
      patientName,
      requestType, 
      reason, 
      urgency, 
      preferredDates, 
      preferredTimeOfDay 
    } = req.body;
    
    if (!conversationId || !requestType || !reason) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const request = await providerCommunicationPortalService.createAppointmentRequest(
      conversationId,
      patientId || providerId,
      patientName || "Patient",
      providerId,
      requestType,
      reason,
      urgency || "routine",
      preferredDates,
      preferredTimeOfDay,
      providerId
    );

    logAudit("CREATE_APPOINTMENT_REQUEST", providerId, "AppointmentRequest", request.id, 
      `${requestType} request: ${reason}`);
    res.status(201).json(request);
  } catch (error) {
    console.error("[ProviderPortal] Create appointment request error:", error);
    res.status(500).json({ error: "Failed to create appointment request" });
  }
});

router.get("/appointment-requests", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    const isAdmin = (req as any).userRole === "admin";
    const { status } = req.query;
    
    const requests = providerCommunicationPortalService.getAppointmentRequests(
      isAdmin ? null : providerId,
      status as AppointmentRequest["status"] | undefined
    );
    
    logAudit("VIEW_APPOINTMENT_REQUESTS", providerId, "AppointmentRequests", "all", 
      `Viewing ${requests.length} requests`);
    res.json(requests);
  } catch (error) {
    console.error("[ProviderPortal] Get appointment requests error:", error);
    res.status(500).json({ error: "Failed to get appointment requests" });
  }
});

router.patch("/appointment-requests/:requestId", async (req: Request, res: Response) => {
  try {
    const providerId = getAuthenticatedUserId(req);
    const isAdmin = (req as any).userRole === "admin";
    const { requestId } = req.params;
    const { status, notes } = req.body;

    const request = await providerCommunicationPortalService.updateAppointmentRequest(
      requestId,
      isAdmin ? null : providerId,
      { status, notes }
    );
    
    if (!request) {
      res.status(404).json({ error: "Appointment request not found or access denied" });
      return;
    }

    logAudit("UPDATE_APPOINTMENT_REQUEST", providerId, "AppointmentRequest", requestId, 
      `Updated to status: ${status}`);
    res.json(request);
  } catch (error) {
    console.error("[ProviderPortal] Update appointment request error:", error);
    res.status(500).json({ error: "Failed to update appointment request" });
  }
});

router.post("/share-health-data", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    
    const { conversationId, sharedWith, dataType, dataId, accessLevel, expiresInHours } = req.body;
    
    if (!conversationId || !sharedWith || !dataType || !dataId) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const share = await providerCommunicationPortalService.shareHealthData(
      conversationId,
      userId,
      Array.isArray(sharedWith) ? sharedWith : [sharedWith],
      dataType,
      dataId,
      accessLevel || "view",
      expiresInHours
    );

    logAudit("SHARE_HEALTH_DATA", userId, dataType, dataId, 
      `Shared with ${share.sharedWith.length} recipients`);
    res.status(201).json(share);
  } catch (error) {
    console.error("[ProviderPortal] Share health data error:", error);
    res.status(500).json({ error: "Failed to share health data" });
  }
});

router.get("/shared-health-data", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    
    const shares = providerCommunicationPortalService.getSharedHealthData(userId);
    
    logAudit("VIEW_SHARED_DATA", userId, "SharedHealthData", "all", 
      `Viewing ${shares.length} shared items`);
    res.json(shares);
  } catch (error) {
    console.error("[ProviderPortal] Get shared data error:", error);
    res.status(500).json({ error: "Failed to get shared health data" });
  }
});

router.post("/shared-health-data/:shareId/access", async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req);
    const { shareId } = req.params;

    providerCommunicationPortalService.recordHealthDataAccess(shareId, userId);
    
    res.json({ success: true, accessRecorded: true });
  } catch (error) {
    console.error("[ProviderPortal] Record access error:", error);
    res.status(500).json({ error: "Failed to record access" });
  }
});

export function registerProviderCommunicationPortalRoutes(app: any) {
  app.use("/api/provider-portal", router);
  console.log("[Routes] Provider Communication Portal routes registered at /api/provider-portal/*");
}

export default router;
