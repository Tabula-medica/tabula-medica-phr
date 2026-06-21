import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiAuditLogAnalyzerService } from "./services/ai-audit-log-analyzer";
import type { SecurityAuditLog } from "@shared/schema";
import { createHash } from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT][AuditLogAnalyzer] ${action}`, JSON.stringify({
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

const anomalyFiltersSchema = z.object({
  status: z.enum(["new", "investigating", "confirmed", "false_positive", "resolved"]).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  type: z.enum(["time_based", "volume_based", "location_based", "resource_based", "behavioral", "sequence_based"]).optional(),
});

const threatFiltersSchema = z.object({
  status: z.enum(["active", "contained", "remediated", "false_positive"]).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  type: z.enum([
    "data_exfiltration", "unauthorized_access", "privilege_escalation", "insider_threat",
    "brute_force", "session_hijacking", "reconnaissance", "lateral_movement", "credential_abuse", "anomalous_behavior"
  ]).optional(),
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const parseResult = anomalyFiltersSchema.safeParse(req.query);
    const filters = parseResult.success ? parseResult.data : {};

    logHipaaAudit("LIST_ANOMALIES", { filters });

    const anomalies = aiAuditLogAnalyzerService.getAnomalies(filters);

    res.json({
      success: true,
      anomalies,
      count: anomalies.length,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error listing anomalies:", error);
    res.status(500).json({ success: false, error: "Failed to list anomalies" });
  }
});

router.get("/threats", async (req: Request, res: Response) => {
  try {
    const parseResult = threatFiltersSchema.safeParse(req.query);
    const filters = parseResult.success ? parseResult.data : {};

    logHipaaAudit("LIST_THREATS", { filters });

    const threats = aiAuditLogAnalyzerService.getThreats(filters);

    res.json({
      success: true,
      threats,
      count: threats.length,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error listing threats:", error);
    res.status(500).json({ success: false, error: "Failed to list threats" });
  }
});

router.get("/analysis-results", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ANALYSIS_RESULTS", {});

    const results = aiAuditLogAnalyzerService.getAnalysisResults();

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error listing analysis results:", error);
    res.status(500).json({ success: false, error: "Failed to list analysis results" });
  }
});

router.get("/user-profile/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const hashedUserId = hashIdentifier(userId);

    logHipaaAudit("GET_USER_PROFILE", { hashedUserId });

    const profile = aiAuditLogAnalyzerService.getUserProfile(hashedUserId);

    if (!profile) {
      return res.status(404).json({ success: false, error: "User profile not found" });
    }

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error getting user profile:", error);
    res.status(500).json({ success: false, error: "Failed to get user profile" });
  }
});

const ingestLogSchema = z.object({
  id: z.string(),
  userId: z.string().min(1),
  profileId: z.string().nullable(),
  eventType: z.string().min(1),
  description: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  platform: z.enum(["web", "ios", "android"]),
  appVersion: z.string(),
  source: z.string().nullable(),
  connectionId: z.string().nullable(),
  syncId: z.string().nullable(),
  metadata: z.record(z.string()).nullable(),
  createdAt: z.string(),
});

router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const parseResult = ingestLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid audit log format", details: parseResult.error });
    }

    const log = parseResult.data as SecurityAuditLog;

    logHipaaAudit("INGEST_AUDIT_LOG", { eventType: log.eventType, hashedUserId: hashIdentifier(log.userId) });

    await aiAuditLogAnalyzerService.ingestAuditLog(log);

    res.json({
      success: true,
      message: "Audit log ingested and analyzed",
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error ingesting audit log:", error);
    res.status(500).json({ success: false, error: "Failed to ingest audit log" });
  }
});

const batchAnalyzeSchema = z.object({
  logs: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    profileId: z.string().nullable(),
    eventType: z.string(),
    description: z.string(),
    ipAddress: z.string(),
    userAgent: z.string(),
    platform: z.enum(["web", "ios", "android"]),
    appVersion: z.string(),
    source: z.string().nullable(),
    connectionId: z.string().nullable(),
    syncId: z.string().nullable(),
    metadata: z.record(z.string()).nullable(),
    createdAt: z.string(),
  })),
});

router.post("/analyze-batch", async (req: Request, res: Response) => {
  try {
    const parseResult = batchAnalyzeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { logs } = parseResult.data;

    logHipaaAudit("BATCH_ANALYZE", { logCount: logs.length });

    const result = await aiAuditLogAnalyzerService.analyzeLogBatch(logs as SecurityAuditLog[]);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error in batch analysis:", error);
    res.status(500).json({ success: false, error: "Failed to analyze batch" });
  }
});

const historicalAnalysisSchema = z.object({
  startDate: z.string().transform(s => new Date(s)),
  endDate: z.string().transform(s => new Date(s)),
});

router.post("/historical-analysis", async (req: Request, res: Response) => {
  try {
    const parseResult = historicalAnalysisSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid date range", details: parseResult.error });
    }

    const { startDate, endDate } = parseResult.data;

    logHipaaAudit("HISTORICAL_ANALYSIS", { startDate: startDate.toISOString(), endDate: endDate.toISOString() });

    const result = await aiAuditLogAnalyzerService.runHistoricalAnalysis(startDate, endDate);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error in historical analysis:", error);
    res.status(500).json({ success: false, error: "Failed to run historical analysis" });
  }
});

const updateAnomalySchema = z.object({
  status: z.enum(["new", "investigating", "confirmed", "false_positive", "resolved"]),
  notes: z.string().optional(),
});

router.patch("/anomalies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateAnomalySchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { status, notes } = parseResult.data;

    logHipaaAudit("UPDATE_ANOMALY_STATUS", { anomalyId: id, status });

    const anomaly = await aiAuditLogAnalyzerService.updateAnomalyStatus(id, status, notes);

    if (!anomaly) {
      return res.status(404).json({ success: false, error: "Anomaly not found" });
    }

    res.json({
      success: true,
      anomaly,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error updating anomaly:", error);
    res.status(500).json({ success: false, error: "Failed to update anomaly" });
  }
});

const updateThreatSchema = z.object({
  status: z.enum(["active", "contained", "remediated", "false_positive"]),
});

router.patch("/threats/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateThreatSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request body", details: parseResult.error });
    }

    const { status } = parseResult.data;

    logHipaaAudit("UPDATE_THREAT_STATUS", { threatId: id, status });

    const threat = await aiAuditLogAnalyzerService.updateThreatStatus(id, status);

    if (!threat) {
      return res.status(404).json({ success: false, error: "Threat not found" });
    }

    res.json({
      success: true,
      threat,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error updating threat:", error);
    res.status(500).json({ success: false, error: "Failed to update threat" });
  }
});

router.post("/threat/:id/violation-assessment", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logHipaaAudit("GENERATE_VIOLATION_ASSESSMENT", { threatId: id });

    const threats = aiAuditLogAnalyzerService.getThreats({ status: undefined });
    const threat = threats.find(t => t.id === id);

    if (!threat) {
      return res.status(404).json({ success: false, error: "Threat not found" });
    }

    const risk = await aiAuditLogAnalyzerService.generatePolicyViolationAssessment(threat);

    res.json({
      success: true,
      risk,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error generating violation assessment:", error);
    res.status(500).json({ success: false, error: "Failed to generate violation assessment" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("GET_DASHBOARD", {});

    const metrics = aiAuditLogAnalyzerService.getDashboardMetrics();

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("[AuditLogAnalyzer] Error getting dashboard:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

export default router;
