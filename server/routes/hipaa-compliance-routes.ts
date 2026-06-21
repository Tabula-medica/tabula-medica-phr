import { Router, Request, Response } from "express";
import { hipaaComplianceService } from "../services/hipaa-compliance-service";

const router = Router();

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const dashboard = await hipaaComplianceService.getComplianceDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[HIPAACompliance] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch compliance dashboard" });
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const filters = {
      userId: req.query.userId as string,
      actionCategory: req.query.actionCategory as string,
      resourceType: req.query.resourceType as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      phiOnly: req.query.phiOnly === "true",
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };
    
    const result = await hipaaComplianceService.getAuditLogs(filters);
    res.json(result);
  } catch (error) {
    console.error("[HIPAACompliance] Audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.post("/audit-logs/export", async (req: Request, res: Response) => {
  try {
    const { format, startDate, endDate, userId } = req.body;
    const result = await hipaaComplianceService.exportAuditLogs(format || "json", {
      startDate,
      endDate,
      userId,
    });
    
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    console.error("[HIPAACompliance] Export error:", error);
    res.status(500).json({ error: "Failed to export audit logs" });
  }
});

// /mfa/setup, /mfa/verify, /mfa/status — REMOVED as part of the GCIP-only
// cutover. Patient MFA is enforced upstream by Google Cloud Identity
// Platform; this module no longer exposes a parallel unauthenticated
// TOTP surface. The underlying hipaaComplianceService.setupMFA /
// verifyMFA / getMFAStatus helpers are now dead code and may be deleted
// in a follow-up cleanup.

router.post("/session/create", async (req: Request, res: Response) => {
  try {
    const { userId, ipAddress, userAgent } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    const session = await hipaaComplianceService.createSession(
      userId,
      ipAddress || req.ip || "unknown",
      userAgent || req.headers["user-agent"] || "unknown"
    );
    res.json(session);
  } catch (error) {
    console.error("[HIPAACompliance] Session create error:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/session/validate", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    
    const result = await hipaaComplianceService.validateSession(sessionId);
    res.json(result);
  } catch (error) {
    console.error("[HIPAACompliance] Session validate error:", error);
    res.status(500).json({ error: "Failed to validate session" });
  }
});

router.delete("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.body;
    
    await hipaaComplianceService.terminateSession(sessionId, userId || "unknown");
    res.json({ success: true });
  } catch (error) {
    console.error("[HIPAACompliance] Session terminate error:", error);
    res.status(500).json({ error: "Failed to terminate session" });
  }
});

router.get("/sessions/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessions = await hipaaComplianceService.getActiveSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error("[HIPAACompliance] Get sessions error:", error);
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

router.get("/documentation", async (req: Request, res: Response) => {
  try {
    const docs = hipaaComplianceService.getComplianceDocumentation();
    res.json(docs);
  } catch (error) {
    console.error("[HIPAACompliance] Documentation error:", error);
    res.status(500).json({ error: "Failed to get compliance documentation" });
  }
});

export function registerHIPAAComplianceRoutes(app: any) {
  app.use("/api/hipaa-compliance", router);
  console.log("[Routes] HIPAA Compliance routes registered at /api/hipaa-compliance/*");
}
