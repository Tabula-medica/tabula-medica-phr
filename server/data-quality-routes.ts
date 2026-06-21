import type { Express, Request, Response } from "express";
import { dataQualityService } from "./services/data-quality-service";
import { storage } from "./storage";
import { z } from "zod";
import type { SecurityEventType } from "@shared/schema";

function getClientInfo(req: Request): { ipAddress: string; userAgent: string } {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "Unknown";
  const userAgent = req.headers["user-agent"] || "Unknown";
  return { ipAddress, userAgent };
}

async function logDataQualityAudit(
  userId: string,
  eventType: SecurityEventType,
  description: string,
  metadata: Record<string, string>,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const sanitizedMetadata: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (key === "resolvedValue" || key === "previousValues" || key === "newValues") {
        sanitizedMetadata[key] = "[REDACTED]";
      } else {
        sanitizedMetadata[key] = String(value);
      }
    }
    
    await storage.createSecurityAuditLog({
      userId,
      eventType,
      description,
      metadata: sanitizedMetadata,
      ipAddress,
      userAgent,
      platform: "web",
      appVersion: "1.0.0",
    });
  } catch (error) {
    console.error("[DataQuality] Failed to create audit log:", error);
  }
}

export function registerDataQualityRoutes(app: Express): void {
  app.get("/api/care-team/data-quality/dashboard", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const { ipAddress, userAgent } = getClientInfo(req);

      const dashboardData = await dataQualityService.getDashboardData();

      await logDataQualityAudit(
        userId,
        "dq_dashboard_opened",
        `Data quality dashboard viewed with ${dashboardData.metrics.totalIssues} total issues`,
        { totalIssues: String(dashboardData.metrics.totalIssues) },
        ipAddress,
        userAgent
      );

      res.json(dashboardData);
    } catch (error) {
      console.error("[DataQuality] Dashboard error:", error);
      res.status(500).json({ error: "Failed to load data quality dashboard" });
    }
  });

  app.get("/api/care-team/data-quality/metrics", async (req: Request, res: Response) => {
    try {
      const metrics = await dataQualityService.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("[DataQuality] Metrics error:", error);
      res.status(500).json({ error: "Failed to load data quality metrics" });
    }
  });

  app.get("/api/care-team/data-quality/issues", async (req: Request, res: Response) => {
    try {
      const { status, severity, issueType, recordType, patientId } = req.query;

      const issues = await dataQualityService.getIssues({
        status: status as any,
        severity: severity as any,
        issueType: issueType as any,
        recordType: recordType as any,
        patientId: patientId as string,
      });

      res.json({ issues, total: issues.length });
    } catch (error) {
      console.error("[DataQuality] Issues list error:", error);
      res.status(500).json({ error: "Failed to load data quality issues" });
    }
  });

  app.get("/api/care-team/data-quality/issues/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const { ipAddress, userAgent } = getClientInfo(req);

      const issue = await dataQualityService.getIssueById(id);
      if (!issue) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }

      const actions = await dataQualityService.getActionsForIssue(id);

      await logDataQualityAudit(
        userId,
        "dq_issue_viewed",
        `Data quality issue viewed: ${issue.description}`,
        { issueId: id, issueType: issue.issueType, severity: issue.severity },
        ipAddress,
        userAgent
      );

      res.json({ issue, actions });
    } catch (error) {
      console.error("[DataQuality] Issue detail error:", error);
      res.status(500).json({ error: "Failed to load issue details" });
    }
  });

  const mergeRecordsSchema = z.object({
    sourceRecordIds: z.array(z.string()).min(1),
    targetRecordId: z.string(),
    mergedValues: z.record(z.unknown()),
    notes: z.string().optional(),
  });

  app.post("/api/care-team/data-quality/issues/:id/merge", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;

      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { ipAddress, userAgent } = getClientInfo(req);
      const validation = mergeRecordsSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { sourceRecordIds, targetRecordId, mergedValues, notes } = validation.data;

      const result = await dataQualityService.mergeRecords(
        id,
        userId,
        sourceRecordIds,
        targetRecordId,
        mergedValues,
        notes || "Records merged via Data Quality Dashboard",
        ipAddress,
        userAgent
      );

      if (!result) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }

      await logDataQualityAudit(
        userId,
        "dq_records_merged",
        `Merged ${sourceRecordIds.length} records into ${targetRecordId}`,
        {
          issueId: id,
          actionId: result.action.id,
          targetRecordId,
          recordCount: String(sourceRecordIds.length),
        },
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: "Records merged successfully",
        issue: result.issue,
        action: result.action,
      });
    } catch (error) {
      console.error("[DataQuality] Merge error:", error);
      res.status(500).json({ error: "Failed to merge records" });
    }
  });

  const confirmDuplicateSchema = z.object({
    notes: z.string().optional(),
  });

  app.post("/api/care-team/data-quality/issues/:id/confirm", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;

      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { ipAddress, userAgent } = getClientInfo(req);
      const validation = confirmDuplicateSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { notes } = validation.data;

      const result = await dataQualityService.confirmDuplicate(
        id,
        userId,
        notes || "Duplicate confirmed via Data Quality Dashboard",
        ipAddress,
        userAgent
      );

      if (!result) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }

      await logDataQualityAudit(
        userId,
        "dq_duplicate_confirmed",
        `Confirmed duplicate for ${result.issue.affectedRecordIds.length} records`,
        {
          issueId: id,
          actionId: result.action.id,
          affectedRecords: String(result.issue.affectedRecordIds.length),
        },
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: "Duplicate confirmed",
        issue: result.issue,
        action: result.action,
      });
    } catch (error) {
      console.error("[DataQuality] Confirm error:", error);
      res.status(500).json({ error: "Failed to confirm duplicate" });
    }
  });

  app.post("/api/care-team/data-quality/issues/:id/dismiss", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;

      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const { ipAddress, userAgent } = getClientInfo(req);
      const validation = confirmDuplicateSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({ error: "Invalid request", details: validation.error.errors });
        return;
      }

      const { notes } = validation.data;

      const result = await dataQualityService.dismissDuplicate(
        id,
        userId,
        notes || "Issue dismissed - not a true duplicate",
        ipAddress,
        userAgent
      );

      if (!result) {
        res.status(404).json({ error: "Issue not found" });
        return;
      }

      await logDataQualityAudit(
        userId,
        "dq_issue_dismissed",
        `Issue dismissed: ${notes || "No reason provided"}`,
        {
          issueId: id,
          actionId: result.action.id,
          reason: notes || "No reason provided",
        },
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        message: "Issue dismissed",
        issue: result.issue,
        action: result.action,
      });
    } catch (error) {
      console.error("[DataQuality] Dismiss error:", error);
      res.status(500).json({ error: "Failed to dismiss issue" });
    }
  });

  app.get("/api/care-team/data-quality/actions", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const actions = await dataQualityService.getRecentActions(limit);
      res.json({ actions });
    } catch (error) {
      console.error("[DataQuality] Actions list error:", error);
      res.status(500).json({ error: "Failed to load actions" });
    }
  });

  app.get("/api/care-team/data-quality/audit-trail", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const { ipAddress, userAgent } = getClientInfo(req);

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const auditLogs = await storage.getSecurityAuditLogs(userId, limit);

      const dataQualityLogs = auditLogs.filter(
        (log) => log.eventType.startsWith("dq_")
      );

      await logDataQualityAudit(
        userId,
        "dq_audit_trail_viewed",
        `Audit trail viewed: ${dataQualityLogs.length} logs retrieved`,
        { logsRetrieved: String(dataQualityLogs.length) },
        ipAddress,
        userAgent
      );

      res.json({
        logs: dataQualityLogs,
        total: dataQualityLogs.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error("[DataQuality] Audit trail error:", error);
      res.status(500).json({ error: "Failed to load audit trail" });
    }
  });

  console.log("[Routes] Care Team Data Quality Dashboard routes registered at /api/care-team/data-quality");
}
