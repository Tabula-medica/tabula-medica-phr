import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import type { 
  AiAuditLogEntry, 
  InsertAiAuditLogEntry, 
  AiAuditLogQuery, 
  AiAuditLogStats,
  AiAuditEventType,
  UserRole
} from "@shared/schema";
import { userRoles } from "@shared/schema";
import { logPhiAccess } from "./security/hipaa-audit";
import { isAuthenticated } from "./replit_integrations/auth";

const auditLogStore: Map<string, AiAuditLogEntry> = new Map();

export function createAuditLogEntry(
  entry: InsertAiAuditLogEntry,
  req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
): AiAuditLogEntry {
  const newEntry: AiAuditLogEntry = {
    id: randomUUID(),
    eventType: entry.eventType,
    userId: entry.userId,
    userRole: entry.userRole,
    patientId: entry.patientId,
    sessionId: entry.sessionId,
    timestamp: new Date().toISOString(),
    parameters: entry.parameters,
    summary: entry.summary,
    metadata: entry.metadata || {},
  };

  auditLogStore.set(newEntry.id, newEntry);

  logPhiAccess({
    userId: entry.userId,
    action: "write",
    resourceType: "AiAuditLog",
    resourceId: newEntry.id,
    details: `AI ${entry.eventType} generated for patient ${entry.patientId} by ${entry.userRole}. Model: ${entry.parameters.modelUsed || "unknown"}. Audit ID: ${newEntry.id}`,
    ipAddress: req?.ip || entry.metadata?.ipAddress || "unknown",
    userAgent: (req?.headers?.["user-agent"] as string) || entry.metadata?.userAgent || "unknown",
  });

  return newEntry;
}

export function updateAuditLogFeedback(
  auditLogId: string, 
  feedback: AiAuditLogEntry["feedback"]
): AiAuditLogEntry | null {
  const entry = auditLogStore.get(auditLogId);
  if (!entry) return null;
  
  entry.feedback = feedback;
  auditLogStore.set(auditLogId, entry);
  return entry;
}

export function getAuditLogEntry(id: string): AiAuditLogEntry | null {
  return auditLogStore.get(id) || null;
}

export function queryAuditLogs(query: AiAuditLogQuery): AiAuditLogEntry[] {
  let entries = Array.from(auditLogStore.values());

  if (query.userId) {
    entries = entries.filter(e => e.userId === query.userId);
  }
  if (query.patientId) {
    entries = entries.filter(e => e.patientId === query.patientId);
  }
  if (query.eventType) {
    entries = entries.filter(e => e.eventType === query.eventType);
  }
  if (query.userRole) {
    entries = entries.filter(e => e.userRole === query.userRole);
  }
  if (query.startDate) {
    const start = new Date(query.startDate);
    entries = entries.filter(e => new Date(e.timestamp) >= start);
  }
  if (query.endDate) {
    const end = new Date(query.endDate);
    entries = entries.filter(e => new Date(e.timestamp) <= end);
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const offset = query.offset || 0;
  const limit = query.limit || 50;
  
  return entries.slice(offset, offset + limit);
}

export function getAuditLogStats(startDate?: string, endDate?: string): AiAuditLogStats {
  let entries = Array.from(auditLogStore.values());
  
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate ? new Date(endDate) : new Date();

  entries = entries.filter(e => {
    const ts = new Date(e.timestamp);
    return ts >= start && ts <= end;
  });

  const entriesByType: Record<AiAuditEventType, number> = {
    patient_summary_generated: 0,
    risk_stratification_generated: 0,
    imaging_analysis_generated: 0,
    document_summary_generated: 0,
    lab_explanation_generated: 0,
    medication_summary_generated: 0,
    trend_analysis_generated: 0,
    insight_generated: 0,
  };

  const entriesByRole: Record<string, number> = {};
  for (const role of userRoles) {
    entriesByRole[role] = 0;
  }

  let totalConfidence = 0;
  let confidenceCount = 0;
  let totalDuration = 0;
  let durationCount = 0;
  let cacheHits = 0;
  let inaccuracyReports = 0;

  for (const entry of entries) {
    entriesByType[entry.eventType]++;
    entriesByRole[entry.userRole]++;

    if (entry.summary.confidenceScore !== undefined) {
      totalConfidence += entry.summary.confidenceScore;
      confidenceCount++;
    }

    if (entry.metadata.requestDurationMs !== undefined) {
      totalDuration += entry.metadata.requestDurationMs;
      durationCount++;
    }

    if (entry.metadata.cacheHit) {
      cacheHits++;
    }

    if (entry.feedback?.isInaccurate) {
      inaccuracyReports++;
    }
  }

  return {
    totalEntries: entries.length,
    entriesByType,
    entriesByRole,
    avgConfidenceScore: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    inaccuracyReportsCount: inaccuracyReports,
    avgRequestDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
    cacheHitRate: entries.length > 0 ? cacheHits / entries.length : 0,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

export function registerAiAuditLogRoutes(app: Express) {
  app.post("/api/ai-audit-log", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const body: InsertAiAuditLogEntry = req.body;

      const authenticatedUserId = (req as any).user?.claims?.sub || (req as any).user?.id;
      const authenticatedUserRole: UserRole = (req as any).user?.role || "patient";

      if (!body.eventType || !body.patientId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: eventType, patientId",
        });
      }

      if (!body.summary || !body.summary.title || body.summary.disclaimersIncluded === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required summary fields: title, disclaimersIncluded",
        });
      }

      if (authenticatedUserRole !== "provider" && authenticatedUserRole !== "admin" && body.patientId !== authenticatedUserId) {
        return res.status(403).json({
          success: false,
          error: "Patient-role users may only create audit log entries for themselves",
        });
      }

      const entry: InsertAiAuditLogEntry = {
        ...body,
        userId: authenticatedUserId,
        userRole: authenticatedUserRole,
      };


      const newEntry = createAuditLogEntry(entry, { ip: req.ip, headers: req.headers as Record<string, string | string[] | undefined> });

      res.json({
        success: true,
        data: newEntry,
      });
    } catch (error) {
      console.error("[AiAuditLog] Error creating audit log entry:", error);
      res.status(500).json({ success: false, error: "Failed to create audit log entry" });
    }
  });

  app.get("/api/ai-audit-log", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query: AiAuditLogQuery = {
        userId: req.query.userId as string,
        patientId: req.query.patientId as string,
        eventType: req.query.eventType as AiAuditEventType,
        userRole: req.query.userRole as UserRole,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const requestingUserId = (req as any).user?.id || "anonymous";
      const requestingUserRole = (req as any).user?.role || "patient";

      if (requestingUserRole !== "provider" && requestingUserRole !== "admin") {
        query.userId = requestingUserId;
      }

      await logPhiAccess({
        userId: requestingUserId,
        action: "read",
        resourceType: "AiAuditLog",
        resourceId: query.patientId || "all",
        details: `Queried AI audit logs. Filters: ${JSON.stringify(query)}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const entries = queryAuditLogs(query);

      res.json({
        success: true,
        data: entries,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: entries.length,
        },
      });
    } catch (error) {
      console.error("[AiAuditLog] Error querying audit logs:", error);
      res.status(500).json({ success: false, error: "Failed to query audit logs" });
    }
  });

  app.get("/api/ai-audit-log/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const requestingUserId = (req as any).user?.id || "anonymous";
      const requestingUserRole = (req as any).user?.role || "patient";

      if (requestingUserRole !== "provider" && requestingUserRole !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Only providers and admins can view audit log statistics",
        });
      }

      await logPhiAccess({
        userId: requestingUserId,
        action: "read",
        resourceType: "AiAuditLogStats",
        resourceId: "aggregate",
        details: `Viewed AI audit log statistics for period ${startDate || "30 days ago"} to ${endDate || "now"}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const stats = getAuditLogStats(startDate, endDate);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("[AiAuditLog] Error getting audit log stats:", error);
      res.status(500).json({ success: false, error: "Failed to get audit log statistics" });
    }
  });

  app.get("/api/ai-audit-log/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const entry = getAuditLogEntry(id);

      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Audit log entry not found",
        });
      }

      const requestingUserId = (req as any).user?.id || "anonymous";
      const requestingUserRole = (req as any).user?.role || "patient";

      if (requestingUserRole !== "provider" && requestingUserRole !== "admin" && entry.userId !== requestingUserId) {
        return res.status(403).json({
          success: false,
          error: "Access denied to this audit log entry",
        });
      }

      await logPhiAccess({
        userId: requestingUserId,
        action: "read",
        resourceType: "AiAuditLog",
        resourceId: id,
        details: `Viewed AI audit log entry for event ${entry.eventType}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      res.json({
        success: true,
        data: entry,
      });
    } catch (error) {
      console.error("[AiAuditLog] Error getting audit log entry:", error);
      res.status(500).json({ success: false, error: "Failed to get audit log entry" });
    }
  });

  app.patch("/api/ai-audit-log/:id/feedback", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const feedback = req.body;

      if (!feedback.feedbackId || feedback.feedbackTimestamp === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required feedback fields: feedbackId, feedbackTimestamp",
        });
      }

      const entry = getAuditLogEntry(id);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: "Audit log entry not found",
        });
      }

      const requestingUserId = (req as any).user?.claims?.sub || (req as any).user?.id;
      const requestingUserRole: UserRole = (req as any).user?.role || "patient";

      if (requestingUserRole !== "provider" && requestingUserRole !== "admin" && entry.userId !== requestingUserId) {
        return res.status(403).json({
          success: false,
          error: "Access denied: you may only update feedback on your own audit log entries",
        });
      }

      await logPhiAccess({
        userId: requestingUserId,
        action: "write",
        resourceType: "AiAuditLog",
        resourceId: id,
        details: `Updated feedback for AI audit log entry. Accuracy: ${feedback.accuracyRating}, Usefulness: ${feedback.usefulnessRating}, Inaccurate: ${feedback.isInaccurate}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const updatedEntry = updateAuditLogFeedback(id, feedback);

      res.json({
        success: true,
        data: updatedEntry,
      });
    } catch (error) {
      console.error("[AiAuditLog] Error updating feedback:", error);
      res.status(500).json({ success: false, error: "Failed to update feedback" });
    }
  });

  app.get("/api/ai-audit-log/export/csv", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const requestingUserId = (req as any).user?.id || "anonymous";
      const requestingUserRole = (req as any).user?.role || "patient";

      if (requestingUserRole !== "provider" && requestingUserRole !== "admin") {
        return res.status(403).json({
          success: false,
          error: "Only providers and admins can export audit logs",
        });
      }

      const query: AiAuditLogQuery = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        eventType: req.query.eventType as AiAuditEventType,
        limit: 10000,
      };

      await logPhiAccess({
        userId: requestingUserId,
        action: "export",
        resourceType: "AiAuditLog",
        resourceId: "bulk",
        details: `Exported AI audit logs to CSV. Filters: ${JSON.stringify(query)}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const entries = queryAuditLogs(query);

      const headers = [
        "ID",
        "Timestamp",
        "Event Type",
        "User ID",
        "User Role",
        "Patient ID",
        "Summary Title",
        "Model Used",
        "Sensitivity",
        "Timeframe Days",
        "Confidence Score",
        "Disclaimers Included",
        "Request Duration (ms)",
        "Cache Hit",
        "Fallback Used",
        "Feedback Accuracy",
        "Feedback Usefulness",
        "Inaccuracy Reported",
      ];

      const rows = entries.map(e => [
        e.id,
        e.timestamp,
        e.eventType,
        e.userId,
        e.userRole,
        e.patientId,
        `"${e.summary.title.replace(/"/g, '""')}"`,
        e.parameters.modelUsed || "",
        e.parameters.sensitivity || "",
        e.parameters.timeframeDays || "",
        e.summary.confidenceScore || "",
        e.summary.disclaimersIncluded ? "Yes" : "No",
        e.metadata.requestDurationMs || "",
        e.metadata.cacheHit ? "Yes" : "No",
        e.metadata.fallbackUsed ? "Yes" : "No",
        e.feedback?.accuracyRating || "",
        e.feedback?.usefulnessRating || "",
        e.feedback?.isInaccurate ? "Yes" : "No",
      ]);

      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="ai-audit-log-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("[AiAuditLog] Error exporting audit logs:", error);
      res.status(500).json({ success: false, error: "Failed to export audit logs" });
    }
  });
}
