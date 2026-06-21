import { Express, Request, Response } from "express";
import { 
  aiAuditLogEnrichmentService, 
  EnrichmentFilter,
  RiskLevel,
  AnomalyType 
} from "./services/ai-audit-log-enrichment-service";
import { comprehensiveAuditTrailService, AuditEntry } from "./services/comprehensive-audit-trail-service";

function logAudit(
  userId: string,
  action: string,
  resourceType: string,
  description: string,
  success: boolean,
  resourceId?: string
) {
  comprehensiveAuditTrailService.logAuditEntry(userId, {
    who: {
      userId,
      userRole: "system",
      userName: "AI Audit Enrichment"
    },
    what: {
      category: "system_event",
      action: "read",
      resourceType,
      resourceId,
      description
    },
    why: {
      reason: "AI audit log enrichment operation",
      businessJustification: action
    },
    result: {
      success,
      statusCode: success ? 200 : 500
    },
    context: {
      environment: process.env.NODE_ENV || "development"
    },
    severity: success ? "info" : "error",
    tags: ["ai-audit-enrichment", action.toLowerCase().replace(/\s+/g, "-")]
  });
}

export function registerAIAuditLogEnrichmentRoutes(app: Express): void {
  app.get("/api/audit-enrichment/metadata", async (_req: Request, res: Response) => {
    try {
      const metadata = aiAuditLogEnrichmentService.getMetadata();
      logAudit("system", "Get Metadata", "AuditEnrichment", "Retrieved service metadata", true);
      res.json(metadata);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting metadata:", error);
      logAudit("system", "Get Metadata", "AuditEnrichment", "Failed to retrieve metadata", false);
      res.status(500).json({ error: "Failed to retrieve metadata" });
    }
  });

  app.get("/api/audit-enrichment/logs", async (req: Request, res: Response) => {
    try {
      const filter: EnrichmentFilter = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        riskLevel: req.query.riskLevel ? (req.query.riskLevel as string).split(",") as RiskLevel[] : undefined,
        anomalyTypes: req.query.anomalyTypes ? (req.query.anomalyTypes as string).split(",") as AnomalyType[] : undefined,
        minRiskScore: req.query.minRiskScore ? parseFloat(req.query.minRiskScore as string) : undefined,
        maxRiskScore: req.query.maxRiskScore ? parseFloat(req.query.maxRiskScore as string) : undefined,
        userId: req.query.userId as string,
        category: req.query.category as any,
        onlyFlagged: req.query.onlyFlagged === "true",
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0
      };

      const logs = await aiAuditLogEnrichmentService.getEnrichedLogs(filter);
      logAudit("system", "List Logs", "EnrichedAuditLog", `Retrieved ${logs.length} enriched logs`, true);
      res.json(logs);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting logs:", error);
      logAudit("system", "List Logs", "EnrichedAuditLog", "Failed to retrieve logs", false);
      res.status(500).json({ error: "Failed to retrieve enriched logs" });
    }
  });

  app.get("/api/audit-enrichment/logs/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const log = await aiAuditLogEnrichmentService.getEnrichedLog(id);

      if (!log) {
        res.status(404).json({ error: "Enriched log not found" });
        return;
      }

      logAudit("system", "Get Log", "EnrichedAuditLog", `Retrieved enriched log ${id}`, true, id);
      res.json(log);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting log:", error);
      logAudit("system", "Get Log", "EnrichedAuditLog", "Failed to retrieve log", false, req.params.id);
      res.status(500).json({ error: "Failed to retrieve enriched log" });
    }
  });

  app.post("/api/audit-enrichment/enrich", async (req: Request, res: Response) => {
    try {
      const auditEntry: AuditEntry = req.body;

      if (!auditEntry.id || !auditEntry.who || !auditEntry.what) {
        res.status(400).json({ error: "Invalid audit entry: missing required fields" });
        return;
      }

      const enriched = await aiAuditLogEnrichmentService.enrichAndStore(auditEntry);
      logAudit("system", "Enrich Log", "EnrichedAuditLog", `Enriched audit log ${auditEntry.id}`, true, auditEntry.id);
      res.json(enriched);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error enriching log:", error);
      logAudit("system", "Enrich Log", "EnrichedAuditLog", "Failed to enrich log", false);
      res.status(500).json({ error: "Failed to enrich audit log" });
    }
  });

  app.get("/api/audit-enrichment/statistics", async (req: Request, res: Response) => {
    try {
      const filter: EnrichmentFilter = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      };

      const statistics = await aiAuditLogEnrichmentService.getStatistics(filter);
      logAudit("system", "Get Statistics", "AuditEnrichment", "Retrieved enrichment statistics", true);
      res.json(statistics);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting statistics:", error);
      logAudit("system", "Get Statistics", "AuditEnrichment", "Failed to retrieve statistics", false);
      res.status(500).json({ error: "Failed to retrieve statistics" });
    }
  });

  app.get("/api/audit-enrichment/alerts", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const alerts = await aiAuditLogEnrichmentService.getHighRiskAlerts(limit);
      logAudit("system", "Get Alerts", "AuditEnrichment", `Retrieved ${alerts.length} high-risk alerts`, true);
      res.json(alerts);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting alerts:", error);
      logAudit("system", "Get Alerts", "AuditEnrichment", "Failed to retrieve alerts", false);
      res.status(500).json({ error: "Failed to retrieve high-risk alerts" });
    }
  });

  app.get("/api/audit-enrichment/user-behavior/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const analysis = await aiAuditLogEnrichmentService.analyzeUserBehavior(userId);
      logAudit("system", "Analyze User", "UserBehavior", `Analyzed behavior for user ${userId}`, true, userId);
      res.json(analysis);
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error analyzing user behavior:", error);
      logAudit("system", "Analyze User", "UserBehavior", "Failed to analyze user behavior", false, req.params.userId);
      res.status(500).json({ error: "Failed to analyze user behavior" });
    }
  });

  app.get("/api/audit-enrichment/dashboard", async (req: Request, res: Response) => {
    try {
      const [statistics, highRiskAlerts, recentLogs] = await Promise.all([
        aiAuditLogEnrichmentService.getStatistics(),
        aiAuditLogEnrichmentService.getHighRiskAlerts(5),
        aiAuditLogEnrichmentService.getEnrichedLogs({ limit: 10 })
      ]);

      const metadata = aiAuditLogEnrichmentService.getMetadata();

      logAudit("system", "Get Dashboard", "AuditEnrichment", "Retrieved dashboard data with statistics and alerts", true);
      res.json({
        metadata,
        statistics,
        highRiskAlerts,
        recentLogs,
        noCdsCompliance: metadata.noCdsCompliance
      });
    } catch (error) {
      console.error("[AIAuditEnrichmentRoutes] Error getting dashboard:", error);
      logAudit("system", "Get Dashboard", "AuditEnrichment", "Failed to retrieve dashboard", false);
      res.status(500).json({ error: "Failed to retrieve dashboard data" });
    }
  });

  console.log("[Routes] AI Audit Log Enrichment routes registered at /api/audit-enrichment/*");
}
