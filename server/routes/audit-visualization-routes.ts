import { Router, Request, Response } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/access-patterns", async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as string) || "7d";
    const rangeMs = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    }[range] || 7 * 24 * 60 * 60 * 1000;

    const startDate = new Date(Date.now() - rangeMs).toISOString();
    const allLogs = await storage.getAllSecurityAuditLogs({ startDate, limit: 10000 });

    const hourlyDistribution: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyDistribution[h] = 0;

    const dailyDistribution: Record<string, number> = {};
    const actionDistribution: Record<string, number> = {};
    const userActivity: Record<string, { count: number; lastActive: string; userName: string; phiAccess: number }> = {};
    const resourceAccess: Record<string, number> = {};

    for (const log of allLogs) {
      const d = new Date(log.createdAt);
      const hour = d.getHours();
      hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;

      const dayKey = d.toISOString().split("T")[0];
      dailyDistribution[dayKey] = (dailyDistribution[dayKey] || 0) + 1;

      actionDistribution[log.eventType] = (actionDistribution[log.eventType] || 0) + 1;

      const resourceType = (log.metadata?.resourceType as string) || "system";
      resourceAccess[resourceType] = (resourceAccess[resourceType] || 0) + 1;

      if (!userActivity[log.userId]) {
        userActivity[log.userId] = {
          count: 0,
          lastActive: log.createdAt,
          userName: (log.metadata?.userName as string) || log.userId.substring(0, 8),
          phiAccess: 0,
        };
      }
      userActivity[log.userId].count++;
      if (new Date(log.createdAt) > new Date(userActivity[log.userId].lastActive)) {
        userActivity[log.userId].lastActive = log.createdAt;
      }
      const isPhi = log.metadata?.phiAccessed === "true" || log.eventType === "phi_access" || log.eventType === "data_export";
      if (isPhi) userActivity[log.userId].phiAccess++;
    }

    const topUsers = Object.entries(userActivity)
      .map(([id, data]) => ({ userId: id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const phiEvents = allLogs.filter(l =>
      l.metadata?.phiAccessed === "true" || l.eventType === "phi_access" || l.eventType === "data_export"
    );

    const failedEvents = allLogs.filter(l =>
      l.metadata?.success === "false" || l.metadata?.outcome === "failure" || l.metadata?.outcome === "denied"
    );

    res.json({
      totalEvents: allLogs.length,
      phiAccessCount: phiEvents.length,
      failedAttempts: failedEvents.length,
      uniqueUsers: Object.keys(userActivity).length,
      hourlyDistribution,
      dailyDistribution,
      actionDistribution,
      resourceAccess,
      topUsers,
      timeRange: { start: startDate, end: new Date().toISOString(), rangeLabel: range },
    });
  } catch (error: any) {
    console.error("[AuditViz] Access patterns error:", error?.message);
    res.status(500).json({ error: "Failed to fetch access patterns" });
  }
});

router.get("/anomalies", async (req: Request, res: Response) => {
  try {
    const allLogs = await storage.getAllSecurityAuditLogs({ limit: 10000 });
    const anomalies: Array<{
      id: string;
      type: string;
      severity: "critical" | "high" | "medium" | "low";
      title: string;
      description: string;
      userId: string;
      userName: string;
      detectedAt: string;
      eventCount: number;
      metadata: Record<string, unknown>;
    }> = [];

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last1h = now - 60 * 60 * 1000;
    const recentLogs = allLogs.filter(l => new Date(l.createdAt).getTime() >= last24h);

    const userHourlyAccess: Record<string, Record<number, number>> = {};
    const userPhiAccess: Record<string, number> = {};
    const userFailedAttempts: Record<string, number> = {};
    const afterHoursAccess: Array<typeof allLogs[0]> = [];
    const ipLoginMap: Record<string, Set<string>> = {};

    for (const log of recentLogs) {
      const uid = log.userId;
      const d = new Date(log.createdAt);
      const hour = d.getHours();

      if (!userHourlyAccess[uid]) userHourlyAccess[uid] = {};
      userHourlyAccess[uid][hour] = (userHourlyAccess[uid][hour] || 0) + 1;

      const isPhi = log.metadata?.phiAccessed === "true" || log.eventType === "phi_access" || log.eventType === "data_export";
      if (isPhi) userPhiAccess[uid] = (userPhiAccess[uid] || 0) + 1;

      const isFailed = log.metadata?.success === "false" || log.metadata?.outcome === "failure" || log.metadata?.outcome === "denied";
      if (isFailed) userFailedAttempts[uid] = (userFailedAttempts[uid] || 0) + 1;

      if (hour < 6 || hour >= 22) {
        if (isPhi) afterHoursAccess.push(log);
      }

      const ip = log.ipAddress || "unknown";
      if (!ipLoginMap[ip]) ipLoginMap[ip] = new Set();
      ipLoginMap[ip].add(uid);
    }

    for (const [userId, hourMap] of Object.entries(userHourlyAccess)) {
      const totalInLastHour = Object.entries(hourMap)
        .filter(([h]) => {
          const hourNum = parseInt(h);
          const currentHour = new Date().getHours();
          return Math.abs(hourNum - currentHour) <= 1;
        })
        .reduce((sum, [, count]) => sum + count, 0);

      if (totalInLastHour > 50) {
        anomalies.push({
          id: `burst-${userId}`,
          type: "access_burst",
          severity: "high",
          title: "Unusual Access Volume",
          description: `User made ${totalInLastHour} requests in the last hour, significantly above normal patterns`,
          userId,
          userName: recentLogs.find(l => l.userId === userId)?.metadata?.userName as string || userId.substring(0, 8),
          detectedAt: new Date().toISOString(),
          eventCount: totalInLastHour,
          metadata: { hourlyBreakdown: hourMap },
        });
      }
    }

    for (const [userId, count] of Object.entries(userPhiAccess)) {
      if (count > 20) {
        anomalies.push({
          id: `phi-volume-${userId}`,
          type: "excessive_phi_access",
          severity: "critical",
          title: "Excessive PHI Access",
          description: `User accessed ${count} PHI records in 24 hours — review for minimum necessary compliance`,
          userId,
          userName: recentLogs.find(l => l.userId === userId)?.metadata?.userName as string || userId.substring(0, 8),
          detectedAt: new Date().toISOString(),
          eventCount: count,
          metadata: { threshold: 20, actual: count },
        });
      }
    }

    for (const [userId, count] of Object.entries(userFailedAttempts)) {
      if (count >= 5) {
        anomalies.push({
          id: `failed-${userId}`,
          type: "repeated_failures",
          severity: count >= 10 ? "critical" : "high",
          title: "Repeated Access Failures",
          description: `User had ${count} failed access attempts in 24 hours — possible credential stuffing or privilege escalation attempt`,
          userId,
          userName: recentLogs.find(l => l.userId === userId)?.metadata?.userName as string || userId.substring(0, 8),
          detectedAt: new Date().toISOString(),
          eventCount: count,
          metadata: { threshold: 5, actual: count },
        });
      }
    }

    for (const log of afterHoursAccess) {
      anomalies.push({
        id: `afterhours-${log.id}`,
        type: "after_hours_phi",
        severity: "medium",
        title: "After-Hours PHI Access",
        description: `PHI accessed at ${new Date(log.createdAt).toLocaleTimeString()} — outside normal business hours (6 AM–10 PM)`,
        userId: log.userId,
        userName: (log.metadata?.userName as string) || log.userId.substring(0, 8),
        detectedAt: log.createdAt,
        eventCount: 1,
        metadata: { eventType: log.eventType, hour: new Date(log.createdAt).getHours() },
      });
    }

    for (const [ip, users] of Object.entries(ipLoginMap)) {
      if (users.size > 3) {
        anomalies.push({
          id: `shared-ip-${ip.replace(/\./g, "-")}`,
          type: "shared_ip",
          severity: "medium",
          title: "Multiple Users from Same IP",
          description: `${users.size} different user accounts accessed the system from IP ${ip.substring(0, 8)}*** — potential credential sharing`,
          userId: Array.from(users)[0],
          userName: "Multiple",
          detectedAt: new Date().toISOString(),
          eventCount: users.size,
          metadata: { userCount: users.size, ipPrefix: ip.substring(0, 8) },
        });
      }
    }

    anomalies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    res.json({
      anomalies,
      totalDetected: anomalies.length,
      bySeverity: {
        critical: anomalies.filter(a => a.severity === "critical").length,
        high: anomalies.filter(a => a.severity === "high").length,
        medium: anomalies.filter(a => a.severity === "medium").length,
        low: anomalies.filter(a => a.severity === "low").length,
      },
      scanTimestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AuditViz] Anomaly detection error:", error?.message);
    res.status(500).json({ error: "Failed to run anomaly detection" });
  }
});

router.get("/patient-history/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const allLogs = await storage.getAllSecurityAuditLogs({ limit: 50000 });

    const patientLogs = allLogs.filter(l => {
      const resourceId = l.metadata?.resourceId as string;
      const profileId = l.profileId;
      return resourceId === patientId || profileId === patientId ||
        (l.metadata?.patientId as string) === patientId;
    });

    const timeline = patientLogs.map(log => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.eventType,
      userId: log.userId,
      userName: (log.metadata?.userName as string) || log.userId.substring(0, 8),
      userRole: (log.metadata?.userRole as string) || "unknown",
      resourceType: (log.metadata?.resourceType as string) || "patient",
      description: log.description,
      ipAddress: log.ipAddress,
      outcome: (log.metadata?.outcome as string) || (log.metadata?.success === "false" ? "failure" : "success"),
      phiAccessed: log.metadata?.phiAccessed === "true" || log.eventType === "phi_access",
      metadata: log.metadata || {},
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const uniqueAccessors = new Set(patientLogs.map(l => l.userId));
    const phiAccessCount = timeline.filter(t => t.phiAccessed).length;

    const accessByUser: Record<string, { count: number; userName: string; lastAccess: string }> = {};
    for (const entry of timeline) {
      if (!accessByUser[entry.userId]) {
        accessByUser[entry.userId] = { count: 0, userName: entry.userName, lastAccess: entry.timestamp };
      }
      accessByUser[entry.userId].count++;
    }

    res.json({
      patientId,
      totalInteractions: timeline.length,
      uniqueAccessors: uniqueAccessors.size,
      phiAccessCount,
      timeline: timeline.slice(0, 200),
      accessByUser: Object.entries(accessByUser)
        .map(([id, data]) => ({ userId: id, ...data }))
        .sort((a, b) => b.count - a.count),
    });
  } catch (error: any) {
    console.error("[AuditViz] Patient history error:", error?.message);
    res.status(500).json({ error: "Failed to fetch patient history" });
  }
});

router.get("/live-feed", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const allLogs = await storage.getAllSecurityAuditLogs({ limit });

    const feed = allLogs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        action: log.eventType,
        userId: log.userId,
        userName: (log.metadata?.userName as string) || log.userId.substring(0, 8),
        resourceType: (log.metadata?.resourceType as string) || "system",
        resourceId: (log.metadata?.resourceId as string) || undefined,
        outcome: (log.metadata?.outcome as string) || (log.metadata?.success === "false" ? "failure" : "success"),
        phiAccessed: log.metadata?.phiAccessed === "true" || log.eventType === "phi_access" || log.eventType === "data_export",
        ipAddress: log.ipAddress,
        description: log.description,
      }));

    res.json(feed);
  } catch (error: any) {
    console.error("[AuditViz] Live feed error:", error?.message);
    res.status(500).json({ error: "Failed to fetch live feed" });
  }
});

export default router;
