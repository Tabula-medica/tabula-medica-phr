import { Router, Request, Response } from "express";
import { fhirAPIGatewaySecurityService } from "./services/fhir-api-gateway-security-service";

const router = Router();

router.get("/dashboard", async (_req: Request, res: Response) => {
  try {
    const dashboard = fhirAPIGatewaySecurityService.getSecurityDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch security dashboard" });
  }
});

router.get("/apps", async (_req: Request, res: Response) => {
  try {
    const apps = fhirAPIGatewaySecurityService.getSMARTApps();
    res.json(apps);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get apps error:", error);
    res.status(500).json({ error: "Failed to fetch SMART apps" });
  }
});

router.get("/apps/:id", async (req: Request, res: Response) => {
  try {
    const app = fhirAPIGatewaySecurityService.getSMARTApp(req.params.id);
    if (!app) {
      return res.status(404).json({ error: "SMART app not found" });
    }
    res.json(app);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get app error:", error);
    res.status(500).json({ error: "Failed to fetch SMART app" });
  }
});

router.patch("/apps/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!["active", "suspended", "revoked"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const app = fhirAPIGatewaySecurityService.updateSMARTAppStatus(req.params.id, status);
    if (!app) {
      return res.status(404).json({ error: "SMART app not found" });
    }
    res.json(app);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Update app status error:", error);
    res.status(500).json({ error: "Failed to update app status" });
  }
});

router.get("/app-access-controls", async (_req: Request, res: Response) => {
  try {
    const controls = fhirAPIGatewaySecurityService.getAppAccessControls();
    res.json(controls);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get app controls error:", error);
    res.status(500).json({ error: "Failed to fetch app access controls" });
  }
});

router.get("/app-access-controls/:id", async (req: Request, res: Response) => {
  try {
    const control = fhirAPIGatewaySecurityService.getAppAccessControl(req.params.id);
    if (!control) {
      return res.status(404).json({ error: "Access control not found" });
    }
    res.json(control);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get app control error:", error);
    res.status(500).json({ error: "Failed to fetch app access control" });
  }
});

router.patch("/app-access-controls/:id", async (req: Request, res: Response) => {
  try {
    const control = fhirAPIGatewaySecurityService.updateAppAccessControl(req.params.id, req.body);
    if (!control) {
      return res.status(404).json({ error: "Access control not found" });
    }
    res.json(control);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Update app control error:", error);
    res.status(500).json({ error: "Failed to update app access control" });
  }
});

router.get("/user-access-controls", async (_req: Request, res: Response) => {
  try {
    const controls = fhirAPIGatewaySecurityService.getUserAccessControls();
    res.json(controls);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get user controls error:", error);
    res.status(500).json({ error: "Failed to fetch user access controls" });
  }
});

router.patch("/user-access-controls/:id", async (req: Request, res: Response) => {
  try {
    const control = fhirAPIGatewaySecurityService.updateUserAccessControl(req.params.id, req.body);
    if (!control) {
      return res.status(404).json({ error: "User access control not found" });
    }
    res.json(control);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Update user control error:", error);
    res.status(500).json({ error: "Failed to update user access control" });
  }
});

router.post("/check-app-rate-limit", async (req: Request, res: Response) => {
  try {
    const { appClientId } = req.body;
    if (!appClientId) {
      return res.status(400).json({ error: "appClientId is required" });
    }
    const result = fhirAPIGatewaySecurityService.checkAppRateLimit(appClientId);
    res.json(result);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Check app rate limit error:", error);
    res.status(500).json({ error: "Failed to check rate limit" });
  }
});

router.post("/check-user-rate-limit", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    const result = fhirAPIGatewaySecurityService.checkUserRateLimit(userId);
    res.json(result);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Check user rate limit error:", error);
    res.status(500).json({ error: "Failed to check rate limit" });
  }
});

router.get("/rate-limit-status", async (_req: Request, res: Response) => {
  try {
    const status = fhirAPIGatewaySecurityService.getRateLimitStatus();
    res.json(status);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Rate limit status error:", error);
    res.status(500).json({ error: "Failed to fetch rate limit status" });
  }
});

router.get("/threat-patterns", async (_req: Request, res: Response) => {
  try {
    const patterns = fhirAPIGatewaySecurityService.getThreatPatterns();
    res.json(patterns);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get threat patterns error:", error);
    res.status(500).json({ error: "Failed to fetch threat patterns" });
  }
});

router.get("/threat-events", async (req: Request, res: Response) => {
  try {
    const filters = {
      severity: req.query.severity as string | undefined,
      type: req.query.type as string | undefined,
      resolved: req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    const events = fhirAPIGatewaySecurityService.getThreatEvents(filters);
    res.json(events);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get threat events error:", error);
    res.status(500).json({ error: "Failed to fetch threat events" });
  }
});

router.post("/threat-events/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { resolvedBy, falsePositive } = req.body;
    const event = fhirAPIGatewaySecurityService.resolveThreatEvent(
      req.params.id,
      resolvedBy || "admin",
      falsePositive ?? false
    );
    if (!event) {
      return res.status(404).json({ error: "Threat event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Resolve threat error:", error);
    res.status(500).json({ error: "Failed to resolve threat event" });
  }
});

router.post("/detect-threats", async (req: Request, res: Response) => {
  try {
    const auditLogs = fhirAPIGatewaySecurityService.getAuditLogs({ limit: 1000 });
    const threats = await fhirAPIGatewaySecurityService.detectThreats(auditLogs);
    res.json({ threatsDetected: threats.length, threats });
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Detect threats error:", error);
    res.status(500).json({ error: "Failed to detect threats" });
  }
});

router.post("/ai-threat-report", async (_req: Request, res: Response) => {
  try {
    const report = await fhirAPIGatewaySecurityService.generateAIThreatReport();
    res.json(report);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] AI threat report error:", error);
    res.status(500).json({ error: "Failed to generate AI threat report" });
  }
});

router.get("/ai-analyses", async (_req: Request, res: Response) => {
  try {
    const analyses = fhirAPIGatewaySecurityService.getAIAnalyses();
    res.json(analyses);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get AI analyses error:", error);
    res.status(500).json({ error: "Failed to fetch AI analyses" });
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const filters = {
      appId: req.query.appId as string | undefined,
      userId: req.query.userId as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      threatLevel: req.query.threatLevel as string | undefined,
      blocked: req.query.blocked === "true" ? true : req.query.blocked === "false" ? false : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };
    const logs = fhirAPIGatewaySecurityService.getAuditLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Get audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.post("/log-request", async (req: Request, res: Response) => {
  try {
    const { 
      smartAppToken, 
      endpoint, 
      method, 
      resourceType, 
      responseStatus, 
      responseTimeMs,
      clientIp
    } = req.body;
    
    if (!endpoint || !method) {
      return res.status(400).json({ error: "endpoint and method are required" });
    }
    if (!responseStatus || typeof responseStatus !== "number") {
      return res.status(400).json({ error: "responseStatus must be a number" });
    }
    if (responseTimeMs !== undefined && typeof responseTimeMs !== "number") {
      return res.status(400).json({ error: "responseTimeMs must be a number" });
    }
    
    const log = fhirAPIGatewaySecurityService.logRequest({
      smartAppToken,
      endpoint,
      method,
      resourceType,
      responseStatus,
      responseTimeMs: responseTimeMs || 0,
      clientIp: clientIp || req.ip
    });
    res.json(log);
  } catch (error) {
    console.error("[FHIRGatewaySecurity] Log request error:", error);
    res.status(500).json({ error: "Failed to log request" });
  }
});

export function registerFHIRGatewaySecurityRoutes(app: Router) {
  app.use("/api/fhir-gateway-security", router);
  console.log("[Routes] FHIR API Gateway Security routes registered at /api/fhir-gateway-security/*");
}
