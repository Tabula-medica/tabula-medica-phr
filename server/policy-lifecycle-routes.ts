import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiPolicyLifecycleService } from "./services/ai-policy-lifecycle";
import { getAuditLogger } from "./services/integrations/factory";

const router = Router();

async function logAudit(action: string, resourceId: string, userId: string, details: Record<string, unknown>): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      action: `POLICY_LIFECYCLE_${action}`,
      resourceType: "PolicyLifecycle",
      resourceId,
      userId,
      outcome: "success",
      details,
    });
  } catch (error) {
    console.error("[PolicyLifecycleRoutes] Audit logging error:", error);
  }
}

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    await logAudit("VIEW_DASHBOARD", "dashboard", userId, {});

    const dashboard = await aiPolicyLifecycleService.getDashboard();
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[PolicyLifecycle] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

router.get("/policies", async (req: Request, res: Response) => {
  try {
    const { status, type } = req.query;
    const policies = aiPolicyLifecycleService.listPolicies({
      status: status as any,
      type: type as string,
    });
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error("[PolicyLifecycle] List policies error:", error);
    res.status(500).json({ success: false, error: "Failed to list policies" });
  }
});

router.get("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = aiPolicyLifecycleService.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[PolicyLifecycle] Get policy error:", error);
    res.status(500).json({ success: false, error: "Failed to get policy" });
  }
});

router.get("/policies/:id/versions", async (req: Request, res: Response) => {
  try {
    const versions = aiPolicyLifecycleService.listVersions(req.params.id);
    res.json({ success: true, data: versions });
  } catch (error) {
    console.error("[PolicyLifecycle] List versions error:", error);
    res.status(500).json({ success: false, error: "Failed to list versions" });
  }
});

const createVersionSchema = z.object({
  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.unknown().default(null),
    newValue: z.unknown().default(null),
    changeType: z.enum(["add", "modify", "remove"]),
  })).transform(arr => arr.map(c => ({
    field: c.field,
    oldValue: c.oldValue,
    newValue: c.newValue,
    changeType: c.changeType,
  }))),
  changeReason: z.string().min(1),
  regulatoryDriver: z.string().optional(),
});

router.post("/policies/:id/versions", async (req: Request, res: Response) => {
  try {
    const { changes, changeReason, regulatoryDriver } = createVersionSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    const version = await aiPolicyLifecycleService.createPolicyVersion(
      req.params.id,
      changes,
      userId,
      changeReason,
      regulatoryDriver
    );

    if (!version) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }

    res.json({ success: true, data: version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyLifecycle] Create version error:", error);
    res.status(500).json({ success: false, error: "Failed to create version" });
  }
});

router.post("/detect-conflicts", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const conflicts = await aiPolicyLifecycleService.detectConflicts(userId);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    console.error("[PolicyLifecycle] Detect conflicts error:", error);
    res.status(500).json({ success: false, error: "Failed to detect conflicts" });
  }
});

router.get("/conflicts", async (req: Request, res: Response) => {
  try {
    const includeResolved = req.query.includeResolved === "true";
    const conflicts = aiPolicyLifecycleService.listConflicts(includeResolved);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    console.error("[PolicyLifecycle] List conflicts error:", error);
    res.status(500).json({ success: false, error: "Failed to list conflicts" });
  }
});

router.post("/conflicts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { resolutionNotes } = z.object({ resolutionNotes: z.string().min(1) }).parse(req.body);
    const userId = (req as any).user?.id || "system";

    const conflict = await aiPolicyLifecycleService.resolveConflict(req.params.id, userId, resolutionNotes);
    if (!conflict) {
      return res.status(404).json({ success: false, error: "Conflict not found" });
    }

    res.json({ success: true, data: conflict });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyLifecycle] Resolve conflict error:", error);
    res.status(500).json({ success: false, error: "Failed to resolve conflict" });
  }
});

router.post("/detect-redundancies", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const redundancies = await aiPolicyLifecycleService.detectRedundancies(userId);
    res.json({ success: true, data: redundancies });
  } catch (error) {
    console.error("[PolicyLifecycle] Detect redundancies error:", error);
    res.status(500).json({ success: false, error: "Failed to detect redundancies" });
  }
});

router.get("/redundancies", async (req: Request, res: Response) => {
  try {
    const includeResolved = req.query.includeResolved === "true";
    const redundancies = aiPolicyLifecycleService.listRedundancies(includeResolved);
    res.json({ success: true, data: redundancies });
  } catch (error) {
    console.error("[PolicyLifecycle] List redundancies error:", error);
    res.status(500).json({ success: false, error: "Failed to list redundancies" });
  }
});

router.post("/redundancies/:id/resolve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const redundancy = await aiPolicyLifecycleService.resolveRedundancy(req.params.id, userId);
    if (!redundancy) {
      return res.status(404).json({ success: false, error: "Redundancy not found" });
    }
    res.json({ success: true, data: redundancy });
  } catch (error) {
    console.error("[PolicyLifecycle] Resolve redundancy error:", error);
    res.status(500).json({ success: false, error: "Failed to resolve redundancy" });
  }
});

router.post("/analyze-outdated", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const analyses = await aiPolicyLifecycleService.analyzeOutdatedPolicies(userId);
    res.json({ success: true, data: analyses });
  } catch (error) {
    console.error("[PolicyLifecycle] Analyze outdated error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze outdated policies" });
  }
});

router.post("/policies/:id/suggest-retirement", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const recommendation = await aiPolicyLifecycleService.suggestRetirement(req.params.id, userId);
    if (!recommendation) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }
    res.json({ success: true, data: recommendation });
  } catch (error) {
    console.error("[PolicyLifecycle] Suggest retirement error:", error);
    res.status(500).json({ success: false, error: "Failed to suggest retirement" });
  }
});

router.get("/retirement-recommendations", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const recommendations = aiPolicyLifecycleService.listRetirementRecommendations({
      status: status as any,
    });
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error("[PolicyLifecycle] List retirements error:", error);
    res.status(500).json({ success: false, error: "Failed to list retirement recommendations" });
  }
});

router.post("/retirement-recommendations/:id/approve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const recommendation = await aiPolicyLifecycleService.approveRetirement(req.params.id, userId);
    if (!recommendation) {
      return res.status(404).json({ success: false, error: "Recommendation not found" });
    }
    res.json({ success: true, data: recommendation });
  } catch (error) {
    console.error("[PolicyLifecycle] Approve retirement error:", error);
    res.status(500).json({ success: false, error: "Failed to approve retirement" });
  }
});

router.get("/approval-workflows", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const workflows = aiPolicyLifecycleService.listApprovalWorkflows({
      status: status as any,
    });
    res.json({ success: true, data: workflows });
  } catch (error) {
    console.error("[PolicyLifecycle] List workflows error:", error);
    res.status(500).json({ success: false, error: "Failed to list approval workflows" });
  }
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comments: z.string().optional(),
});

router.post("/approval-workflows/:id/decision", async (req: Request, res: Response) => {
  try {
    const { decision, comments } = approvalDecisionSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";

    const workflow = await aiPolicyLifecycleService.submitApprovalDecision(
      req.params.id,
      userId,
      decision,
      comments
    );

    if (!workflow) {
      return res.status(404).json({ success: false, error: "Workflow not found or user not authorized" });
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyLifecycle] Submit decision error:", error);
    res.status(500).json({ success: false, error: "Failed to submit decision" });
  }
});

router.get("/regulatory-changes", async (_req: Request, res: Response) => {
  try {
    const changes = aiPolicyLifecycleService.getRegulatoryChanges();
    res.json({ success: true, data: changes });
  } catch (error) {
    console.error("[PolicyLifecycle] Get regulatory changes error:", error);
    res.status(500).json({ success: false, error: "Failed to get regulatory changes" });
  }
});

const draftPolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.string().min(1),
  regulatoryFrameworks: z.array(z.string()).min(1),
  dataTypes: z.array(z.string()).min(1),
  roles: z.array(z.string()).min(1),
  enforcementLevel: z.string().min(1),
  additionalContext: z.string().optional(),
});

router.post("/drafts", async (req: Request, res: Response) => {
  try {
    const request = draftPolicySchema.parse(req.body);
    const userId = (req as any).user?.id || "system";
    const draft = await aiPolicyLifecycleService.draftPolicy(request, userId);
    res.json({ success: true, data: draft });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyLifecycle] Draft policy error:", error);
    res.status(500).json({ success: false, error: "Failed to draft policy" });
  }
});

router.get("/drafts", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const drafts = aiPolicyLifecycleService.listDrafts(status as any);
    res.json({ success: true, data: drafts });
  } catch (error) {
    console.error("[PolicyLifecycle] List drafts error:", error);
    res.status(500).json({ success: false, error: "Failed to list drafts" });
  }
});

router.get("/drafts/:id", async (req: Request, res: Response) => {
  try {
    const draft = aiPolicyLifecycleService.getDraft(req.params.id);
    if (!draft) {
      return res.status(404).json({ success: false, error: "Draft not found" });
    }
    res.json({ success: true, data: draft });
  } catch (error) {
    console.error("[PolicyLifecycle] Get draft error:", error);
    res.status(500).json({ success: false, error: "Failed to get draft" });
  }
});

router.post("/drafts/:id/accept", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const modifications = req.body.modifications;
    const policy = await aiPolicyLifecycleService.acceptDraft(req.params.id, userId, modifications);
    if (!policy) {
      return res.status(404).json({ success: false, error: "Draft not found" });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error("[PolicyLifecycle] Accept draft error:", error);
    res.status(500).json({ success: false, error: "Failed to accept draft" });
  }
});

router.post("/policies/:id/suggest-amendments", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const { trigger } = req.body;
    const amendments = await aiPolicyLifecycleService.suggestAmendments(req.params.id, userId, trigger);
    res.json({ success: true, data: amendments });
  } catch (error) {
    console.error("[PolicyLifecycle] Suggest amendments error:", error);
    res.status(500).json({ success: false, error: "Failed to suggest amendments" });
  }
});

router.get("/amendments", async (req: Request, res: Response) => {
  try {
    const { policyId, status } = req.query;
    const amendments = aiPolicyLifecycleService.listAmendments(policyId as string, status as any);
    res.json({ success: true, data: amendments });
  } catch (error) {
    console.error("[PolicyLifecycle] List amendments error:", error);
    res.status(500).json({ success: false, error: "Failed to list amendments" });
  }
});

router.post("/amendments/:id/accept", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const version = await aiPolicyLifecycleService.acceptAmendment(req.params.id, userId);
    if (!version) {
      return res.status(404).json({ success: false, error: "Amendment not found" });
    }
    res.json({ success: true, data: version });
  } catch (error) {
    console.error("[PolicyLifecycle] Accept amendment error:", error);
    res.status(500).json({ success: false, error: "Failed to accept amendment" });
  }
});

router.post("/bulk-amendment-scan", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const result = await aiPolicyLifecycleService.runBulkAmendmentScan(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[PolicyLifecycle] Bulk amendment scan error:", error);
    res.status(500).json({ success: false, error: "Failed to run bulk amendment scan" });
  }
});

const autoReviewScheduleSchema = z.object({
  frequency: z.enum(["monthly", "quarterly", "semi_annual", "annual"]),
  autoArchiveIfInactive: z.boolean().optional(),
  inactiveDaysThreshold: z.number().optional(),
  autoRiskScan: z.boolean().optional(),
  autoRegulatoryCheck: z.boolean().optional(),
});

router.post("/policies/:id/auto-review-schedule", async (req: Request, res: Response) => {
  try {
    const options = autoReviewScheduleSchema.parse(req.body);
    const userId = (req as any).user?.id || "system";
    const schedule = await aiPolicyLifecycleService.createAutoReviewSchedule(req.params.id, userId, options);
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Policy not found" });
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", details: error.errors });
    }
    console.error("[PolicyLifecycle] Create auto-review schedule error:", error);
    res.status(500).json({ success: false, error: "Failed to create auto-review schedule" });
  }
});

router.get("/auto-review-schedules", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const schedules = aiPolicyLifecycleService.listAutoReviewSchedules(status as any);
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("[PolicyLifecycle] List auto-review schedules error:", error);
    res.status(500).json({ success: false, error: "Failed to list auto-review schedules" });
  }
});

router.post("/auto-review-schedules/:id/run", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const result = await aiPolicyLifecycleService.runAutoReview(req.params.id, userId);
    if (!result) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("[PolicyLifecycle] Run auto-review error:", error);
    res.status(500).json({ success: false, error: "Failed to run auto-review" });
  }
});

router.get("/auto-review-results", async (req: Request, res: Response) => {
  try {
    const { policyId } = req.query;
    const results = aiPolicyLifecycleService.listAutoReviewResults(policyId as string);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("[PolicyLifecycle] List auto-review results error:", error);
    res.status(500).json({ success: false, error: "Failed to list auto-review results" });
  }
});

router.post("/run-due-reviews", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "system";
    const results = await aiPolicyLifecycleService.runDueReviews(userId);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("[PolicyLifecycle] Run due reviews error:", error);
    res.status(500).json({ success: false, error: "Failed to run due reviews" });
  }
});

export default router;
