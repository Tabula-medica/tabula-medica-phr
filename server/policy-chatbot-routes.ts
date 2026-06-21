import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiPolicyChatbotService } from "./services/ai-policy-chatbot";
import { getAuditLogger } from "./services/integrations/factory";

const router = Router();

async function logAudit(action: string, req: Request, details: Record<string, unknown>): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    const userId = (req as any).user?.id || "anonymous";
    await auditLogger.log({
      action: "access",
      resourceType: `PolicyChatbot:${action}`,
      resourceId: "api",
      userId,
      userRole: (req as any).user?.role || "user",
      ipAddress: req.ip?.replace(/::ffff:/, "") || "unknown",
      userAgent: req.get("user-agent") || "unknown",
      requestPath: req.path,
      requestMethod: req.method,
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details,
    });
  } catch (error) {
    console.error("[PolicyChatbotRoutes] Audit logging error:", error);
  }
}

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const session = await aiPolicyChatbotService.createSession(userId);
    await logAudit("SESSION_CREATED", req, { sessionId: session.id });
    res.json({ success: true, data: session });
  } catch (error) {
    console.error("[PolicyChatbot] Create session error:", error);
    res.status(500).json({ success: false, error: "Failed to create session" });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const sessions = aiPolicyChatbotService.listSessions(userId);
    await logAudit("SESSIONS_LISTED", req, { count: sessions.length });
    res.json({ success: true, data: sessions });
  } catch (error) {
    console.error("[PolicyChatbot] List sessions error:", error);
    res.status(500).json({ success: false, error: "Failed to list sessions" });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = aiPolicyChatbotService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    await logAudit("SESSION_ACCESSED", req, { sessionId: req.params.id });
    res.json({ success: true, data: session });
  } catch (error) {
    console.error("[PolicyChatbot] Get session error:", error);
    res.status(500).json({ success: false, error: "Failed to get session" });
  }
});

router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const deleted = await aiPolicyChatbotService.deleteSession(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Session not found or unauthorized" });
    }
    await logAudit("SESSION_DELETED", req, { sessionId: req.params.id });
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("[PolicyChatbot] Delete session error:", error);
    res.status(500).json({ success: false, error: "Failed to delete session" });
  }
});

const sendMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

router.post("/sessions/:id/messages", async (req: Request, res: Response) => {
  try {
    const { message } = sendMessageSchema.parse(req.body);
    const userId = (req as any).user?.id || "anonymous";

    const response = await aiPolicyChatbotService.sendMessage(req.params.id, userId, message);
    const session = aiPolicyChatbotService.getSession(req.params.id);
    await logAudit("MESSAGE_SENT", req, { sessionId: req.params.id, messageLength: message.length });
    res.json({ success: true, data: { ...response, session } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid message", details: error.errors });
    }
    console.error("[PolicyChatbot] Send message error:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = z.object({
      message: z.string().min(1).max(2000),
      sessionId: z.string().optional(),
    }).parse(req.body);

    const userId = (req as any).user?.id || "anonymous";

    let session;
    let isNewSession = false;
    if (sessionId) {
      session = aiPolicyChatbotService.getSession(sessionId);
    }
    
    if (!session) {
      session = await aiPolicyChatbotService.createSession(userId);
      isNewSession = true;
    }

    const response = await aiPolicyChatbotService.sendMessage(session.id, userId, message);
    const updatedSession = aiPolicyChatbotService.getSession(session.id);
    
    await logAudit("CHAT_MESSAGE", req, { 
      sessionId: session.id, 
      isNewSession,
      messageLength: message.length 
    });
    
    res.json({
      success: true,
      data: {
        sessionId: session.id,
        response: response,
        session: updatedSession,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyChatbot] Chat error:", error);
    res.status(500).json({ success: false, error: "Failed to process chat" });
  }
});

router.get("/policies", async (req: Request, res: Response) => {
  try {
    const policies = aiPolicyChatbotService.getPolicies();
    await logAudit("POLICIES_LISTED", req, { count: policies.length });
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error("[PolicyChatbot] Get policies error:", error);
    res.status(500).json({ success: false, error: "Failed to get policies" });
  }
});

router.get("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = aiPolicyChatbotService.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }
    await logAudit("POLICY_ACCESSED", req, { policyId: req.params.id });
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[PolicyChatbot] Get policy error:", error);
    res.status(500).json({ success: false, error: "Failed to get policy" });
  }
});

router.get("/scenarios", async (req: Request, res: Response) => {
  try {
    const scenarios = aiPolicyChatbotService.getCommonScenarios();
    await logAudit("SCENARIOS_ACCESSED", req, { count: scenarios.length });
    res.json({ success: true, data: scenarios });
  } catch (error) {
    console.error("[PolicyChatbot] Get scenarios error:", error);
    res.status(500).json({ success: false, error: "Failed to get scenarios" });
  }
});

export default router;
