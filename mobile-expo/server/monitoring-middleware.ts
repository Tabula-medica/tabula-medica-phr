import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { logger } from "./utils/logger";
import { getAuditWriteStats } from "./audit/request-audit";

interface LatencyBucket {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  errorCount: number;
  statusCodes: Record<number, number>;
}

const latencyBuckets: Record<string, LatencyBucket> = {};
const SLOW_THRESHOLD_MS = 2000;
const ALERT_P95_THRESHOLD_MS = 500;
const ERROR_RATE_ALERT_THRESHOLD = 0.01;
let monitoringStartedAt = Date.now();

function getBucketKey(path: string): string {
  if (path.startsWith("/api/health-records")) return "/api/health-records/*";
  if (path.startsWith("/api/deduplication")) return "/api/deduplication/*";
  if (path.startsWith("/api/ai-history")) return "/api/ai-history/*";
  if (path.startsWith("/api/ai-health")) return "/api/ai-health/*";
  if (path.startsWith("/api/lab-results")) return "/api/lab-results/*";
  if (path.startsWith("/api/clinical-documentation")) return "/api/clinical-documentation/*";
  if (path.startsWith("/api/")) return "/api/other";
  return "static";
}

export function latencyMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const bucketKey = getBucketKey(req.path);

      if (!latencyBuckets[bucketKey]) {
        latencyBuckets[bucketKey] = {
          count: 0,
          totalMs: 0,
          maxMs: 0,
          slowCount: 0,
          errorCount: 0,
          statusCodes: {},
        };
      }

      const bucket = latencyBuckets[bucketKey];
      bucket.count++;
      bucket.totalMs += duration;
      if (duration > bucket.maxMs) bucket.maxMs = duration;
      if (duration > SLOW_THRESHOLD_MS) bucket.slowCount++;
      if (res.statusCode >= 500) bucket.errorCount++;

      bucket.statusCodes[res.statusCode] = (bucket.statusCodes[res.statusCode] || 0) + 1;

      if (duration > SLOW_THRESHOLD_MS) {
        logger.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms (status: ${res.statusCode})`);
      }

      if (res.statusCode >= 500) {
        logger.error(`[ERROR] ${req.method} ${req.path} returned ${res.statusCode} (${duration}ms)`);
      }
    });

    next();
  };
}

export function getMonitoringStats(): {
  auditWrites: ReturnType<typeof getAuditWriteStats>;
  uptimeMs: number;
  buckets: Record<string, {
    count: number;
    avgMs: number;
    maxMs: number;
    slowCount: number;
    errorCount: number;
    errorRate: number;
    statusCodes: Record<number, number>;
  }>;
  alerts: string[];
} {
  const alerts: string[] = [];
  const buckets: Record<string, any> = {};

  for (const [key, bucket] of Object.entries(latencyBuckets)) {
    const avgMs = bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0;
    const errorRate = bucket.count > 0 ? bucket.errorCount / bucket.count : 0;

    buckets[key] = {
      count: bucket.count,
      avgMs,
      maxMs: bucket.maxMs,
      slowCount: bucket.slowCount,
      errorCount: bucket.errorCount,
      errorRate: Math.round(errorRate * 10000) / 100,
      statusCodes: bucket.statusCodes,
    };

    if (avgMs > ALERT_P95_THRESHOLD_MS && bucket.count > 5) {
      alerts.push(`High avg latency on ${key}: ${avgMs}ms (threshold: ${ALERT_P95_THRESHOLD_MS}ms)`);
    }

    if (errorRate > ERROR_RATE_ALERT_THRESHOLD && bucket.count > 10) {
      alerts.push(`High error rate on ${key}: ${(errorRate * 100).toFixed(1)}% (threshold: ${ERROR_RATE_ALERT_THRESHOLD * 100}%)`);
    }
  }

  const auditWrites = getAuditWriteStats();
  if (auditWrites.failed > 0 || auditWrites.lifecycleViolations > 0) {
    alerts.push("Audit trail write failure detected; inspect critical audit events");
  }
  return {
    auditWrites,
    uptimeMs: Date.now() - monitoringStartedAt,
    buckets,
    alerts,
  };
}

export function resetMonitoringStats(): void {
  for (const key of Object.keys(latencyBuckets)) {
    delete latencyBuckets[key];
  }
  monitoringStartedAt = Date.now();
}

let canaryInterval: ReturnType<typeof setInterval> | null = null;

export function startCanaryChecks(intervalMs: number = 6 * 60 * 60 * 1000): void {
  if (canaryInterval) return;

  logger.info(`[CANARY] Starting integrity checks every ${intervalMs / 1000 / 60} minutes`);

  const runChecks = async () => {
    try {
      const results: Record<string, number> = {};

      try {
        const att = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM record_attachments ra
          LEFT JOIN health_records hr ON ra.record_id = hr.id
          WHERE hr.id IS NULL
        `);
        results.orphanedAttachments = parseInt(att.rows[0]?.cnt as string) || 0;
      } catch { results.orphanedAttachments = -1; }

      try {
        const mr = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM medication_reminders mr
          WHERE mr.health_record_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM health_records hr WHERE hr.id = mr.health_record_id)
        `);
        results.orphanedMedReminders = parseInt(mr.rows[0]?.cnt as string) || 0;
      } catch { results.orphanedMedReminders = -1; }

      try {
        const ai = await db.execute(sql`
          SELECT COUNT(*) AS cnt FROM audit_logs
          WHERE action IN ('ai_history_chat', 'ai_health_chat')
            AND created_at > NOW() - INTERVAL '24 hours'
            AND metadata->>'error' IS NOT NULL
        `);
        results.aiFailures24h = parseInt(ai.rows[0]?.cnt as string) || 0;
      } catch { results.aiFailures24h = -1; }

      const hasIssues = Object.values(results).some((v) => v > 0);

      if (hasIssues) {
        logger.warn("[CANARY] Issues detected:", results);
      } else {
        logger.info("[CANARY] All integrity checks passed", results);
      }
    } catch (error: any) {
      logger.error("[CANARY] Check failed:", error.message);
    }
  };

  runChecks();
  canaryInterval = setInterval(runChecks, intervalMs);
}

export function stopCanaryChecks(): void {
  if (canaryInterval) {
    clearInterval(canaryInterval);
    canaryInterval = null;
    logger.info("[CANARY] Integrity checks stopped");
  }
}
