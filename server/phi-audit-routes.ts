import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import crypto from "crypto";
import { requireUser, getUserId } from "./middleware/require-user";

const auditQuerySchema = z.object({
  action: z.string().optional(),
  resource: z.string().optional(),
  range: z.string().optional(),
  q: z.string().optional(),
  userId: z.string().optional(),
  outcome: z.string().optional(),
  phiOnly: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

function getDateRangeStart(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1h": return new Date(now.getTime() - 60 * 60 * 1000);
    case "24h": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y": return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function computeIntegrityHash(log: Record<string, unknown>): string {
  const payload = JSON.stringify({
    userId: log.userId,
    action: log.action || log.eventType,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    timestamp: log.createdAt || log.timestamp,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 16);
}

export function registerPhiAuditRoutes(app: Express): void {
  app.get("/api/audit/logs", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const parsed = auditQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query parameters" });
      }

      const { action, resource, range, q, userId: filterUserId, outcome, phiOnly, limit: limitStr, offset: offsetStr } = parsed.data;
      const limitNum = parseInt(limitStr || "100");
      const offsetNum = parseInt(offsetStr || "0");

      const startDate = range ? getDateRangeStart(range).toISOString() : undefined;

      const allLogs = await storage.getAllSecurityAuditLogs({
        userId: filterUserId || undefined,
        eventType: action !== "all" ? action : undefined,
        resourceType: resource !== "all" ? resource : undefined,
        startDate,
        searchQuery: q,
        limit: 1000,
      });

      let filteredLogs = allLogs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        action: log.eventType,
        resourceType: log.metadata?.resourceType as string || "system",
        resourceId: log.metadata?.resourceId as string || undefined,
        userId: log.userId,
        userName: log.metadata?.userName as string || log.userId.substring(0, 8),
        userRole: log.metadata?.userRole as string || "unknown",
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        outcome: (log.metadata?.outcome as string || (log.metadata?.success === "false" ? "failure" : "success")) as "success" | "failure" | "denied",
        phiAccessed: log.metadata?.phiAccessed === "true" || log.eventType === "phi_access" || log.eventType === "data_export",
        sensitivityLevel: log.metadata?.sensitivityLevel as string || "medium",
        details: log.metadata || {},
        integrityHash: computeIntegrityHash(log as unknown as Record<string, unknown>),
        description: log.description,
      }));

      if (outcome && outcome !== "all") {
        filteredLogs = filteredLogs.filter(l => l.outcome === outcome);
      }

      if (phiOnly === "true") {
        filteredLogs = filteredLogs.filter(l => l.phiAccessed);
      }

      const total = filteredLogs.length;
      const paginated = filteredLogs.slice(offsetNum, offsetNum + limitNum);

      await storage.createSecurityAuditLog({
        userId,
        eventType: "phi_access",
        description: "Viewed PHI audit logs",
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
        metadata: {
          action: "view_audit_logs",
          filtersApplied: JSON.stringify({ action, resource, range, q, userId: filterUserId }),
          resultCount: String(total),
        },
      });

      res.json(paginated);
    } catch (error) {
      console.error("[PhiAudit] Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit/logs/stats", requireUser, async (req: Request, res: Response) => {
    try {
      const allLogs = await storage.getAllSecurityAuditLogs({ limit: 10000 });

      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recent24h = allLogs.filter(l => new Date(l.createdAt) >= last24h);
      const recent7d = allLogs.filter(l => new Date(l.createdAt) >= last7d);

      const phiAccessCount = allLogs.filter(l =>
        l.metadata?.phiAccessed === "true" ||
        l.eventType === "phi_access" ||
        l.eventType === "data_export"
      ).length;

      const failedCount = allLogs.filter(l =>
        l.metadata?.success === "false" ||
        l.metadata?.outcome === "failure" ||
        l.metadata?.outcome === "denied"
      ).length;

      const actionBreakdown: Record<string, number> = {};
      allLogs.forEach(l => {
        const key = l.eventType;
        actionBreakdown[key] = (actionBreakdown[key] || 0) + 1;
      });

      res.json({
        totalLogs: allLogs.length,
        last24Hours: recent24h.length,
        last7Days: recent7d.length,
        phiAccessEvents: phiAccessCount,
        failedAttempts: failedCount,
        actionBreakdown,
      });
    } catch (error) {
      console.error("[PhiAudit] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch audit stats" });
    }
  });

  app.post("/api/audit/logs/export", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const { format, filters } = req.body;
      const allLogs = await storage.getAllSecurityAuditLogs({
        eventType: filters?.action,
        resourceType: filters?.resourceType,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        searchQuery: filters?.searchQuery,
        limit: 50000,
      });

      await storage.createSecurityAuditLog({
        userId,
        eventType: "data_export",
        description: `Exported ${allLogs.length} audit log entries as ${format || "json"}`,
        ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || "Unknown",
        userAgent: req.headers["user-agent"] || "Unknown",
        metadata: {
          action: "export_audit_logs",
          format: format || "json",
          recordCount: String(allLogs.length),
          phiAccessed: "true",
        },
      });

      const exportData = allLogs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        eventType: log.eventType,
        userId: log.userId,
        description: log.description,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        platform: log.platform,
        integrityHash: computeIntegrityHash(log as unknown as Record<string, unknown>),
      }));

      if (format === "csv") {
        const headers = "ID,Timestamp,Event Type,User ID,Description,IP Address,User Agent,Integrity Hash\n";
        const rows = exportData.map(l =>
          `"${l.id}","${l.timestamp}","${l.eventType}","${l.userId}","${l.description}","${l.ipAddress}","${l.userAgent}","${l.integrityHash}"`
        ).join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=phi-audit-export-${new Date().toISOString().split("T")[0]}.csv`);
        return res.send(headers + rows);
      }

      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: exportData.length,
        records: exportData,
      });
    } catch (error) {
      console.error("[PhiAudit] Error exporting:", error);
      res.status(500).json({ error: "Failed to export audit logs" });
    }
  });

  app.get("/api/session/config", async (_req: Request, res: Response) => {
    res.json({
      idleTimeoutSeconds: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || "") / 1000 || 900,
      warningBeforeTimeoutSeconds: 120,
      absoluteTimeoutSeconds: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_MS || "") / 1000 || 28800,
    });
  });
}
