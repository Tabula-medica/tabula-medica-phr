import type { Express, Request, Response } from "express";
import {
  computeMetrics,
  generateDemoReport,
  getNationalAvgCosts,
  trackEvent,
  type ROIEventType,
} from "./roi-tracker-service";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

const ALLOWED_EVENT_TYPES: ROIEventType[] = [
  "duplicate_flagged",
  "duplicate_blocked",
  "ehr_sync_completed",
  "ehr_sync_failed",
  "ai_extraction",
  "ai_override",
  "record_lookup",
  "manual_entry",
  "clinical_decision_pivot",
  "data_quality_scan",
  "export_generated",
];

const ALLOWED_METADATA_KEYS = new Set([
  "testType",
  "matchConfidence",
  "latencyMs",
  "source",
  "error",
  "extractionType",
  "confidence",
  "reason",
  "durationSeconds",
  "score",
  "issuesFound",
  "issuesResolved",
  "viewedExisting",
  "avoidedReorder",
]);

function sanitizeMetadata(raw: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return clean;
  for (const [key, val] of Object.entries(raw)) {
    if (ALLOWED_METADATA_KEYS.has(key)) {
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        clean[key] = val;
      }
    }
  }
  return clean;
}

export function registerROITrackerRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
) {
  app.get("/api/roi/metrics", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const days = parseInt(req.query.days as string) || 30;
    const metrics = computeMetrics(Math.min(days, 365));
    res.json({ metrics });
  });

  app.get("/api/roi/demo-report", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const days = parseInt(req.query.days as string) || 30;
    const report = generateDemoReport(Math.min(days, 365));
    res.json({ report });
  });

  app.get("/api/roi/costs", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    res.json({ costs: getNationalAvgCosts() });
  });

  app.post("/api/roi/track", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { eventType, orgId, metadata } = req.body;
    if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({ error: "Invalid eventType" });
    }
    const cleanMeta = sanitizeMetadata(metadata || {});
    const event = trackEvent(eventType, userId, orgId || "default", cleanMeta);
    res.json({ tracked: true, id: event.id });
  });
}
