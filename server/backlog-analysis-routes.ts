import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { 
  aiBacklogAnalysisService, 
  IssueType, 
  RemediationPriority,
  RegulatoryFramework 
} from "./services/ai-backlog-analysis";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]");
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logHipaaAudit(action: string, resource: string, req: Request, details: Record<string, unknown>): void {
  const userId = getUserId(req);
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "BacklogAnalysisAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitizeDetails(details),
  })}`);
}

const filterSchema = z.object({
  type: z.enum(["policy_violation", "compliance_risk"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  priority: z.enum(["immediate", "urgent", "high", "medium", "low"]).optional(),
  regulation: z.enum(["HIPAA", "GDPR", "SOC2", "HITECH", "CCPA"]).optional(),
});

router.post("/sync", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("SYNC_BACKLOG", "backlog", req, { action: "sync_request" });

    const result = await aiBacklogAnalysisService.syncBacklog(userId);

    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] Sync error:", error);
    res.status(500).json({ error: "Failed to sync backlog" });
  }
});

router.get("/items", (req: Request, res: Response) => {
  try {
    const parsed = filterSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid filter parameters", details: parsed.error.errors });
    }

    logHipaaAudit("LIST_BACKLOG", "backlog", req, { filters: parsed.data });

    const items = aiBacklogAnalysisService.getBacklogItems({
      type: parsed.data.type as IssueType | undefined,
      severity: parsed.data.severity,
      priority: parsed.data.priority as RemediationPriority | undefined,
      regulation: parsed.data.regulation as RegulatoryFramework | undefined,
    });

    res.json({
      items,
      total: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] List items error:", error);
    res.status(500).json({ error: "Failed to list backlog items" });
  }
});

router.get("/items/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("GET_BACKLOG_ITEM", "backlog_item", req, { itemId: id });

    const item = aiBacklogAnalysisService.getBacklogItem(id);
    if (!item) {
      return res.status(404).json({ error: "Backlog item not found" });
    }

    res.json(item);
  } catch (error) {
    console.error("[BacklogAnalysis] Get item error:", error);
    res.status(500).json({ error: "Failed to get backlog item" });
  }
});

router.get("/metrics", (req: Request, res: Response) => {
  try {
    logHipaaAudit("GET_METRICS", "backlog_metrics", req, { action: "metrics_request" });

    const metrics = aiBacklogAnalysisService.getMetrics();

    res.json({
      ...metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] Metrics error:", error);
    res.status(500).json({ error: "Failed to get backlog metrics" });
  }
});

router.post("/remediation-plan", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("GENERATE_REMEDIATION_PLAN", "remediation_plan", req, { action: "plan_generation_request" });

    const plan = await aiBacklogAnalysisService.generateRemediationPlan(userId);

    res.json({
      success: true,
      plan,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] Plan generation error:", error);
    res.status(500).json({ error: "Failed to generate remediation plan" });
  }
});

router.get("/remediation-plans", (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_REMEDIATION_PLANS", "remediation_plan", req, { action: "list_plans" });

    const plans = aiBacklogAnalysisService.getRemediationPlans();

    res.json({
      plans,
      total: plans.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] List plans error:", error);
    res.status(500).json({ error: "Failed to list remediation plans" });
  }
});

router.get("/remediation-plans/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("GET_REMEDIATION_PLAN", "remediation_plan", req, { planId: id });

    const plan = aiBacklogAnalysisService.getRemediationPlan(id);
    if (!plan) {
      return res.status(404).json({ error: "Remediation plan not found" });
    }

    res.json(plan);
  } catch (error) {
    console.error("[BacklogAnalysis] Get plan error:", error);
    res.status(500).json({ error: "Failed to get remediation plan" });
  }
});

router.get("/priority-queue", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    logHipaaAudit("GET_PRIORITY_QUEUE", "priority_queue", req, { limit });

    const items = aiBacklogAnalysisService.getBacklogItems();
    const prioritizedItems = items.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      id: item.id,
      title: item.title,
      type: item.type,
      severity: item.severity,
      priority: item.remediationPriority,
      priorityScore: item.priorityScore,
      estimatedHours: item.estimatedRemediationHours,
      hasDeadline: item.regulatory.reportingRequired,
      frameworks: item.regulatory.frameworks,
    }));

    res.json({
      queue: prioritizedItems,
      total: items.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BacklogAnalysis] Priority queue error:", error);
    res.status(500).json({ error: "Failed to get priority queue" });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("GET_SUMMARY", "backlog_summary", req, { action: "summary_request" });

    await aiBacklogAnalysisService.syncBacklog(userId);
    
    const metrics = aiBacklogAnalysisService.getMetrics();
    const items = aiBacklogAnalysisService.getBacklogItems();
    
    const immediateCount = items.filter(i => i.remediationPriority === "immediate").length;
    const urgentCount = items.filter(i => i.remediationPriority === "urgent").length;
    const withDeadlines = items.filter(i => i.regulatory.reportingRequired);

    const summary = {
      overview: {
        totalItems: metrics.totalItems,
        immediateAction: immediateCount,
        urgent: urgentCount,
        estimatedTotalHours: metrics.estimatedTotalRemediationHours,
        oldestItemDays: metrics.oldestItemAge,
        averagePriorityScore: metrics.averagePriorityScore,
      },
      breakdown: {
        bySeverity: metrics.bySeverity,
        byType: metrics.byType,
        byPriority: metrics.byPriority,
        byRegulation: metrics.byRegulation,
      },
      deadlines: {
        itemsWithDeadlines: withDeadlines.length,
        upcomingDeadlines: withDeadlines.slice(0, 5).map(i => ({
          id: i.id,
          title: i.title,
          frameworks: i.regulatory.frameworks,
          deadlineHours: i.regulatory.reportingDeadlineHours,
        })),
      },
      topPriority: items.slice(0, 10).map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        priority: i.remediationPriority,
        score: i.priorityScore,
        type: i.type,
      })),
      timestamp: new Date().toISOString(),
    };

    res.json(summary);
  } catch (error) {
    console.error("[BacklogAnalysis] Summary error:", error);
    res.status(500).json({ error: "Failed to get backlog summary" });
  }
});

export default router;
