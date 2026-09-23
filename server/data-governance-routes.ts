import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiDataGovernanceService } from "./services/ai-data-governance";
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
    component: "DataGovernanceAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitizeDetails(details),
  })}`);
}

const policyFiltersSchema = z.object({
  type: z.enum([
    "access_control", "retention", "encryption", "consent", "audit",
    "data_classification", "cross_border_transfer", "anonymization", "breach_notification"
  ]).optional(),
  isActive: z.coerce.boolean().optional(),
});

const violationFiltersSchema = z.object({
  policyId: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.enum(["pending", "in_progress", "resolved", "waived"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const accessReviewFiltersSchema = z.object({
  status: z.enum(["pending", "approved", "revoked", "modified"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const conductAccessReviewSchema = z.object({
  userId: z.string().min(1),
  reviewPeriodDays: z.number().min(1).max(365).default(30),
});

const enforcePolicySchema = z.object({
  policyId: z.string().min(1),
  targetUserId: z.string().optional(),
  targetResource: z.string().optional(),
});

const approveAccessReviewSchema = z.object({
  decision: z.enum(["approved", "revoked", "modified"]),
  notes: z.string().min(1).max(2000),
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_GOVERNANCE_DASHBOARD", "dashboard", req, {});
    const dashboard = await aiDataGovernanceService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[DataGovernanceAPI] Dashboard error:", error);
    res.status(500).json({ error: "Failed to retrieve dashboard" });
  }
});

router.post("/analyze-practices", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("ANALYZE_DATA_PRACTICES", "governance", req, {});

    const result = await aiDataGovernanceService.analyzeDataPractices(userId);
    res.json(result);
  } catch (error) {
    console.error("[DataGovernanceAPI] Analyze practices error:", error);
    res.status(500).json({ error: "Failed to analyze data practices" });
  }
});

router.get("/policies", async (req: Request, res: Response) => {
  try {
    const filters = policyFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_POLICIES", "policies", req, { filters });

    const policies = aiDataGovernanceService.listPolicies(filters);
    res.json(policies);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List policies error:", error);
    res.status(500).json({ error: "Failed to list policies" });
  }
});

router.get("/policies/:id", async (req: Request, res: Response) => {
  try {
    const policy = aiDataGovernanceService.getPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    logHipaaAudit("VIEW_POLICY", "policy", req, { policyId: req.params.id });
    res.json(policy);
  } catch (error) {
    console.error("[DataGovernanceAPI] Get policy error:", error);
    res.status(500).json({ error: "Failed to retrieve policy" });
  }
});

router.post("/policies/:id/suggest-updates", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("SUGGEST_POLICY_UPDATES", "policy", req, { policyId: req.params.id });

    const updates = await aiDataGovernanceService.suggestPolicyUpdates(req.params.id, userId);
    res.json(updates);
  } catch (error) {
    console.error("[DataGovernanceAPI] Suggest updates error:", error);
    res.status(500).json({ error: "Failed to suggest policy updates" });
  }
});

router.post("/policy-updates/:id/approve", async (req: Request, res: Response) => {
  try {
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("APPROVE_POLICY_UPDATE", "policy_update", req, {
      updateId: req.params.id,
      approved,
    });

    const result = await aiDataGovernanceService.approvePolicyUpdate(req.params.id, approved, userId);
    if (!result) {
      return res.status(404).json({ error: "Policy update not found" });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Approve update error:", error);
    res.status(500).json({ error: "Failed to process policy update approval" });
  }
});

router.get("/violations", async (req: Request, res: Response) => {
  try {
    const filters = violationFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_VIOLATIONS", "violations", req, { filters });

    const violations = aiDataGovernanceService.listViolations(filters);
    res.json(violations);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List violations error:", error);
    res.status(500).json({ error: "Failed to list violations" });
  }
});

router.post("/violations/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("ACKNOWLEDGE_VIOLATION", "violation", req, { violationId: req.params.id });

    const result = await aiDataGovernanceService.acknowledgeViolation(req.params.id, userId);
    if (!result) {
      return res.status(404).json({ error: "Violation not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[DataGovernanceAPI] Acknowledge violation error:", error);
    res.status(500).json({ error: "Failed to acknowledge violation" });
  }
});

router.post("/violations/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { notes } = z.object({ notes: z.string().min(1).max(2000) }).parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("RESOLVE_VIOLATION", "violation", req, {
      violationId: req.params.id,
      notes: notes.substring(0, 100),
    });

    const result = await aiDataGovernanceService.resolveViolation(req.params.id, userId, notes);
    if (!result) {
      return res.status(404).json({ error: "Violation not found" });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Resolve violation error:", error);
    res.status(500).json({ error: "Failed to resolve violation" });
  }
});

router.post("/access-reviews", async (req: Request, res: Response) => {
  try {
    const { userId, reviewPeriodDays } = conductAccessReviewSchema.parse(req.body);
    const reviewerId = getUserId(req);

    logHipaaAudit("CONDUCT_ACCESS_REVIEW", "access_review", req, {
      targetUserId: userId,
      reviewPeriodDays,
    });

    const review = await aiDataGovernanceService.conductAccessReview(userId, reviewPeriodDays, reviewerId);
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Conduct access review error:", error);
    res.status(500).json({ error: "Failed to conduct access review" });
  }
});

router.get("/access-reviews", async (req: Request, res: Response) => {
  try {
    const filters = accessReviewFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_ACCESS_REVIEWS", "access_reviews", req, { filters });

    const reviews = aiDataGovernanceService.listAccessReviews(filters);
    res.json(reviews);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List access reviews error:", error);
    res.status(500).json({ error: "Failed to list access reviews" });
  }
});

router.get("/access-reviews/:id", async (req: Request, res: Response) => {
  try {
    const review = aiDataGovernanceService.getAccessReview(req.params.id);
    if (!review) {
      return res.status(404).json({ error: "Access review not found" });
    }

    logHipaaAudit("VIEW_ACCESS_REVIEW", "access_review", req, { reviewId: req.params.id });
    res.json(review);
  } catch (error) {
    console.error("[DataGovernanceAPI] Get access review error:", error);
    res.status(500).json({ error: "Failed to retrieve access review" });
  }
});

router.post("/access-reviews/:id/approve", async (req: Request, res: Response) => {
  try {
    const { decision, notes } = approveAccessReviewSchema.parse(req.body);
    const reviewerId = getUserId(req);

    logHipaaAudit("APPROVE_ACCESS_REVIEW", "access_review", req, {
      reviewId: req.params.id,
      decision,
      notes: notes.substring(0, 100),
    });

    const result = await aiDataGovernanceService.approveAccessReview(
      req.params.id,
      decision,
      notes,
      reviewerId
    );
    if (!result) {
      return res.status(404).json({ error: "Access review not found" });
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Approve access review error:", error);
    res.status(500).json({ error: "Failed to process access review approval" });
  }
});

router.post("/enforce", async (req: Request, res: Response) => {
  try {
    const { policyId, targetUserId, targetResource } = enforcePolicySchema.parse(req.body);
    const enforcerId = getUserId(req);

    logHipaaAudit("ENFORCE_POLICY", "enforcement", req, {
      policyId,
      targetUserId,
      targetResource,
    });

    const action = await aiDataGovernanceService.enforcePolicy(
      policyId,
      targetUserId,
      targetResource,
      enforcerId
    );
    res.status(201).json(action);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    if (error instanceof Error && error.message === "Policy not found") {
      return res.status(404).json({ error: "Policy not found" });
    }
    console.error("[DataGovernanceAPI] Enforce policy error:", error);
    res.status(500).json({ error: "Failed to enforce policy" });
  }
});

const suggestionFiltersSchema = z.object({
  policyId: z.string().optional(),
  status: z.enum(["pending", "accepted", "rejected", "implemented"]).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const reviewSuggestionSchema = z.object({
  action: z.enum(["accept", "reject"]),
  notes: z.string().max(2000).optional(),
});

router.get("/policy-gaps", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("ANALYZE_POLICY_GAPS", "governance", req, {});

    const gaps = await aiDataGovernanceService.analyzePolicyGaps(userId);
    res.json({
      success: true,
      gaps,
      total: gaps.length,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    console.error("[DataGovernanceAPI] Analyze gaps error:", error);
    res.status(500).json({ error: "Failed to analyze policy gaps" });
  }
});

router.post("/policies/:id/suggest-amendments", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const includeRemediation = req.query.includeRemediation !== "false";

    logHipaaAudit("SUGGEST_POLICY_AMENDMENTS", "policy", req, { 
      policyId: req.params.id,
      includeRemediation,
    });

    const suggestion = await aiDataGovernanceService.suggestPolicyAmendments(
      req.params.id,
      userId,
      includeRemediation
    );

    res.json({
      success: true,
      suggestion,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Policy not found") {
      return res.status(404).json({ error: "Policy not found" });
    }
    console.error("[DataGovernanceAPI] Suggest amendments error:", error);
    res.status(500).json({ error: "Failed to suggest policy amendments" });
  }
});

router.post("/suggest-all-amendments", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("SUGGEST_ALL_POLICY_AMENDMENTS", "governance", req, {});

    const suggestions = await aiDataGovernanceService.suggestAllPolicyAmendments(userId);

    res.json({
      success: true,
      suggestions,
      total: suggestions.length,
      summary: {
        critical: suggestions.filter(s => s.priority === "critical").length,
        high: suggestions.filter(s => s.priority === "high").length,
        medium: suggestions.filter(s => s.priority === "medium").length,
        low: suggestions.filter(s => s.priority === "low").length,
      },
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    console.error("[DataGovernanceAPI] Suggest all amendments error:", error);
    res.status(500).json({ error: "Failed to suggest policy amendments" });
  }
});

router.get("/policy-suggestions", async (req: Request, res: Response) => {
  try {
    const filters = suggestionFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_POLICY_SUGGESTIONS", "suggestions", req, { filters });

    const suggestions = aiDataGovernanceService.listPolicySuggestions(filters);
    res.json({
      success: true,
      suggestions,
      total: suggestions.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List suggestions error:", error);
    res.status(500).json({ error: "Failed to list policy suggestions" });
  }
});

router.get("/policy-suggestions/:id", async (req: Request, res: Response) => {
  try {
    const suggestion = aiDataGovernanceService.getPolicySuggestion(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    logHipaaAudit("VIEW_POLICY_SUGGESTION", "suggestion", req, { suggestionId: req.params.id });
    res.json({ success: true, suggestion });
  } catch (error) {
    console.error("[DataGovernanceAPI] Get suggestion error:", error);
    res.status(500).json({ error: "Failed to retrieve policy suggestion" });
  }
});

router.post("/policy-suggestions/:id/review", async (req: Request, res: Response) => {
  try {
    const { action, notes } = reviewSuggestionSchema.parse(req.body);
    const reviewerId = getUserId(req);

    logHipaaAudit("REVIEW_POLICY_SUGGESTION", "suggestion", req, {
      suggestionId: req.params.id,
      action,
    });

    const result = await aiDataGovernanceService.reviewPolicySuggestion(
      req.params.id,
      action,
      reviewerId,
      notes
    );

    if (!result) {
      return res.status(404).json({ error: "Suggestion not found" });
    }

    res.json({ success: true, suggestion: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Review suggestion error:", error);
    res.status(500).json({ error: "Failed to review policy suggestion" });
  }
});

router.post("/policy-suggestions/:id/implement", async (req: Request, res: Response) => {
  try {
    const implementerId = getUserId(req);

    logHipaaAudit("IMPLEMENT_POLICY_SUGGESTION", "suggestion", req, {
      suggestionId: req.params.id,
    });

    const result = await aiDataGovernanceService.implementPolicySuggestion(
      req.params.id,
      implementerId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: "Policy suggestion implemented successfully",
      updatedPolicy: result.policy,
    });
  } catch (error) {
    console.error("[DataGovernanceAPI] Implement suggestion error:", error);
    res.status(500).json({ error: "Failed to implement policy suggestion" });
  }
});

const createScheduleSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  intervalHours: z.number().min(1).max(720).default(24),
  autoApproveThreshold: z.number().min(0).max(100).default(20),
  flagForReviewThreshold: z.number().min(0).max(100).default(50),
  alertThreshold: z.number().min(0).max(100).default(70),
  targetRoles: z.array(z.string()).default([]),
  excludedUsers: z.array(z.string()).default([]),
});

const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  intervalHours: z.number().min(1).max(720).optional(),
  autoApproveThreshold: z.number().min(0).max(100).optional(),
  flagForReviewThreshold: z.number().min(0).max(100).optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  targetRoles: z.array(z.string()).optional(),
  excludedUsers: z.array(z.string()).optional(),
});

const automatedResultFiltersSchema = z.object({
  decision: z.enum(["auto_approved", "auto_needs_action", "flagged_for_review", "pending"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  requiresHumanReview: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const humanReviewSchema = z.object({
  decision: z.enum(["approved", "revoked", "modified"]),
  notes: z.string().max(2000).optional(),
});

router.get("/access-review-schedules", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ACCESS_REVIEW_SCHEDULES", "schedules", req, {});
    const schedules = aiDataGovernanceService.listAccessReviewSchedules();
    res.json({ success: true, schedules, total: schedules.length });
  } catch (error) {
    console.error("[DataGovernanceAPI] List schedules error:", error);
    res.status(500).json({ error: "Failed to list access review schedules" });
  }
});

router.post("/access-review-schedules", async (req: Request, res: Response) => {
  try {
    const config = createScheduleSchema.parse(req.body);
    logHipaaAudit("CREATE_ACCESS_REVIEW_SCHEDULE", "schedules", req, { name: config.name });

    const schedule = aiDataGovernanceService.createAccessReviewSchedule(config);
    res.status(201).json({ success: true, schedule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Create schedule error:", error);
    res.status(500).json({ error: "Failed to create access review schedule" });
  }
});

router.get("/access-review-schedules/:id", async (req: Request, res: Response) => {
  try {
    const schedule = aiDataGovernanceService.getAccessReviewSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    logHipaaAudit("VIEW_ACCESS_REVIEW_SCHEDULE", "schedules", req, { scheduleId: req.params.id });
    res.json({ success: true, schedule });
  } catch (error) {
    console.error("[DataGovernanceAPI] Get schedule error:", error);
    res.status(500).json({ error: "Failed to retrieve schedule" });
  }
});

router.patch("/access-review-schedules/:id", async (req: Request, res: Response) => {
  try {
    const updates = updateScheduleSchema.parse(req.body);
    logHipaaAudit("UPDATE_ACCESS_REVIEW_SCHEDULE", "schedules", req, { scheduleId: req.params.id });

    const schedule = aiDataGovernanceService.updateAccessReviewSchedule(req.params.id, updates);
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.json({ success: true, schedule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Update schedule error:", error);
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

router.post("/access-review-schedules/:id/run", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("RUN_ACCESS_REVIEW_SCHEDULE", "schedules", req, { scheduleId: req.params.id });

    const result = await aiDataGovernanceService.runScheduledAccessReviews(req.params.id);
    res.json({
      success: true,
      batchResult: result,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[DataGovernanceAPI] Run schedule error:", error);
    res.status(500).json({ error: "Failed to run scheduled access reviews" });
  }
});

router.post("/access-reviews/:id/automate", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const schedules = aiDataGovernanceService.listAccessReviewSchedules();
    const defaultSchedule = schedules[0];

    if (!defaultSchedule) {
      return res.status(400).json({ error: "No review schedule configured" });
    }

    logHipaaAudit("AUTOMATE_ACCESS_REVIEW", "access_review", req, { reviewId: req.params.id });

    const result = await aiDataGovernanceService.automateAccessReview(
      req.params.id,
      defaultSchedule,
      userId
    );

    res.json({
      success: true,
      result,
      compliance: { noClinicalDecisionSupport: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Review not found") {
      return res.status(404).json({ error: "Access review not found" });
    }
    console.error("[DataGovernanceAPI] Automate review error:", error);
    res.status(500).json({ error: "Failed to automate access review" });
  }
});

router.get("/automated-review-results", async (req: Request, res: Response) => {
  try {
    const filters = automatedResultFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_AUTOMATED_REVIEW_RESULTS", "automated_reviews", req, { filters });

    const results = aiDataGovernanceService.listAutomatedReviewResults(filters);
    res.json({
      success: true,
      results,
      total: results.length,
      summary: {
        autoApproved: results.filter(r => r.decision === "auto_approved").length,
        autoNeedsAction: results.filter(r => r.decision === "auto_needs_action").length,
        flaggedForReview: results.filter(r => r.decision === "flagged_for_review").length,
        requiresHumanReview: results.filter(r => r.requiresHumanReview).length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List automated results error:", error);
    res.status(500).json({ error: "Failed to list automated review results" });
  }
});

router.get("/automated-review-results/:id", async (req: Request, res: Response) => {
  try {
    const result = aiDataGovernanceService.getAutomatedReviewResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Automated review result not found" });
    }

    logHipaaAudit("VIEW_AUTOMATED_REVIEW_RESULT", "automated_reviews", req, { resultId: req.params.id });
    res.json({ success: true, result });
  } catch (error) {
    console.error("[DataGovernanceAPI] Get automated result error:", error);
    res.status(500).json({ error: "Failed to retrieve automated review result" });
  }
});

router.post("/automated-review-results/:id/human-review", async (req: Request, res: Response) => {
  try {
    const { decision, notes } = humanReviewSchema.parse(req.body);
    const reviewerId = getUserId(req);

    logHipaaAudit("HUMAN_REVIEW_AUTOMATED_RESULT", "automated_reviews", req, {
      resultId: req.params.id,
      decision,
    });

    const result = await aiDataGovernanceService.humanReviewAutomatedResult(
      req.params.id,
      reviewerId,
      decision,
      notes
    );

    if (!result) {
      return res.status(404).json({ error: "Automated review result not found" });
    }

    res.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[DataGovernanceAPI] Human review error:", error);
    res.status(500).json({ error: "Failed to process human review" });
  }
});

router.get("/batch-results", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    logHipaaAudit("LIST_BATCH_RESULTS", "batch_results", req, { limit });

    const results = aiDataGovernanceService.listBatchResults(limit);
    res.json({ success: true, results, total: results.length });
  } catch (error) {
    console.error("[DataGovernanceAPI] List batch results error:", error);
    res.status(500).json({ error: "Failed to list batch results" });
  }
});

router.get("/batch-results/:id", async (req: Request, res: Response) => {
  try {
    const result = aiDataGovernanceService.getBatchResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Batch result not found" });
    }

    logHipaaAudit("VIEW_BATCH_RESULT", "batch_results", req, { batchId: req.params.id });
    res.json({ success: true, result });
  } catch (error) {
    console.error("[DataGovernanceAPI] Get batch result error:", error);
    res.status(500).json({ error: "Failed to retrieve batch result" });
  }
});

router.post("/scheduler/start", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("START_ACCESS_REVIEW_SCHEDULER", "scheduler", req, {});
    aiDataGovernanceService.startScheduler();
    res.json({ success: true, message: "Access review scheduler started" });
  } catch (error) {
    console.error("[DataGovernanceAPI] Start scheduler error:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

router.post("/scheduler/stop", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("STOP_ACCESS_REVIEW_SCHEDULER", "scheduler", req, {});
    aiDataGovernanceService.stopScheduler();
    res.json({ success: true, message: "Access review scheduler stopped" });
  } catch (error) {
    console.error("[DataGovernanceAPI] Stop scheduler error:", error);
    res.status(500).json({ error: "Failed to stop scheduler" });
  }
});

const fullReviewFiltersSchema = z.object({
  decision: z.enum(["approved", "needs_action", "flagged_for_admin"]).optional(),
  minRiskScore: z.coerce.number().min(0).max(100).optional(),
  hasAlerts: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

router.post("/access-reviews/:id/full-automation", async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id;
    const systemUserId = getUserId(req);

    logHipaaAudit("TRIGGER_FULL_AUTOMATED_REVIEW", "access_review", req, { reviewId });

    const analysis = await aiDataGovernanceService.performFullAutomatedReview(reviewId, systemUserId);

    res.json({
      success: true,
      analysis,
      summary: {
        decision: analysis.decision,
        riskScore: analysis.computedRiskScore,
        violationsDetected: analysis.violationsDetected.length,
        alertsTriggered: analysis.alertsTriggered.length,
        auditLogsAnalyzed: analysis.auditLogsAnalyzed,
      },
    });
  } catch (error) {
    if ((error as Error).message === "Review not found") {
      return res.status(404).json({ error: "Access review not found" });
    }
    console.error("[DataGovernanceAPI] Full automated review error:", error);
    res.status(500).json({ error: "Failed to perform full automated review" });
  }
});

router.post("/access-reviews/batch-full-automation", async (req: Request, res: Response) => {
  try {
    const systemUserId = getUserId(req);

    logHipaaAudit("TRIGGER_BATCH_FULL_AUTOMATION", "access_reviews", req, {});

    const result = await aiDataGovernanceService.runFullAutomatedBatch(systemUserId);

    res.json({
      success: true,
      summary: {
        processed: result.processed,
        approved: result.approved,
        needsAction: result.needsAction,
        flaggedForAdmin: result.flaggedForAdmin,
        alertsTriggered: result.alerts,
      },
      message: `Processed ${result.processed} reviews: ${result.approved} approved, ${result.needsAction} need action, ${result.flaggedForAdmin} flagged for admin review`,
    });
  } catch (error) {
    console.error("[DataGovernanceAPI] Batch full automation error:", error);
    res.status(500).json({ error: "Failed to run batch full automation" });
  }
});

router.get("/full-review-analyses", async (req: Request, res: Response) => {
  try {
    const filters = fullReviewFiltersSchema.parse(req.query);

    logHipaaAudit("LIST_FULL_REVIEW_ANALYSES", "full_analyses", req, { filters });

    const analyses = aiDataGovernanceService.listFullReviewAnalyses(filters);

    res.json({
      success: true,
      analyses,
      total: analyses.length,
      summary: {
        approved: analyses.filter(a => a.decision === "approved").length,
        needsAction: analyses.filter(a => a.decision === "needs_action").length,
        flaggedForAdmin: analyses.filter(a => a.decision === "flagged_for_admin").length,
        withAlerts: analyses.filter(a => a.alertsTriggered.length > 0).length,
        avgRiskScore: analyses.length > 0 
          ? Math.round(analyses.reduce((sum, a) => sum + a.computedRiskScore, 0) / analyses.length)
          : 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[DataGovernanceAPI] List full analyses error:", error);
    res.status(500).json({ error: "Failed to list full review analyses" });
  }
});

router.get("/full-review-analyses/:reviewId", async (req: Request, res: Response) => {
  try {
    const analysis = aiDataGovernanceService.getFullReviewAnalysis(req.params.reviewId);

    if (!analysis) {
      return res.status(404).json({ error: "Full review analysis not found" });
    }

    logHipaaAudit("VIEW_FULL_REVIEW_ANALYSIS", "full_analysis", req, { reviewId: req.params.reviewId });

    res.json({ success: true, analysis });
  } catch (error) {
    console.error("[DataGovernanceAPI] Get full analysis error:", error);
    res.status(500).json({ error: "Failed to retrieve full review analysis" });
  }
});

export default router;
