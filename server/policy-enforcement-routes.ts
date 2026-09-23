import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiPolicyEnforcementService, ViolationCategory } from "./services/ai-policy-enforcement";

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
    component: "PolicyEnforcementAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    details: sanitizeDetails(details),
  })}`);
}

const auditLogEntrySchema = z.object({
  id: z.string().min(1),
  timestamp: z.string(),
  userId: z.string().min(1),
  userRole: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  patientId: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  outcome: z.enum(["success", "failure", "pending"]),
  metadata: z.record(z.unknown()).optional(),
});

const batchAnalyzeSchema = z.object({
  entries: z.array(auditLogEntrySchema).min(1).max(100),
});

const assessmentFiltersSchema = z.object({
  status: z.enum(["pending_review", "confirmed", "false_positive", "remediated"]).optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  category: z.enum([
    "access_violation", "data_export", "consent_breach", "after_hours",
    "role_mismatch", "rate_limit", "unauthorized_resource", "data_modification"
  ]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const reviewAssessmentSchema = z.object({
  status: z.enum(["confirmed", "false_positive", "remediated"]),
  notes: z.string().min(1).max(2000),
});

const updateConfigSchema = z.object({
  enforcementLevel: z.enum(["strict", "moderate", "permissive"]).optional(),
  isEnabled: z.boolean().optional(),
  autoBlockEnabled: z.boolean().optional(),
  autoFlagEnabled: z.boolean().optional(),
  alertOnViolation: z.boolean().optional(),
  exemptUsers: z.array(z.string()).optional(),
  exemptRoles: z.array(z.string()).optional(),
});

const checkBlockedSchema = z.object({
  userId: z.string().min(1),
  resource: z.string().min(1),
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const entry = auditLogEntrySchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("ANALYZE_SINGLE_ENTRY", "audit_log", req, {
      auditLogId: entry.id,
      action: entry.action,
    });

    const assessment = await aiPolicyEnforcementService.analyzeAuditLog(entry, userId);
    
    if (assessment) {
      res.status(201).json(assessment);
    } else {
      res.json({ message: "No policy violations detected", auditLogId: entry.id });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] Analyze error:", error);
    res.status(500).json({ error: "Failed to analyze audit log" });
  }
});

router.post("/analyze-batch", async (req: Request, res: Response) => {
  try {
    const { entries } = batchAnalyzeSchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("ANALYZE_BATCH_ENTRIES", "audit_logs", req, { count: entries.length });

    const assessments = await aiPolicyEnforcementService.analyzeBatchAuditLogs(entries, userId);

    res.status(201).json({
      totalAnalyzed: entries.length,
      violationsDetected: assessments.length,
      assessments,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] Batch analyze error:", error);
    res.status(500).json({ error: "Failed to analyze audit logs" });
  }
});

router.post("/check-blocked", async (req: Request, res: Response) => {
  try {
    const { userId, resource } = checkBlockedSchema.parse(req.body);

    logHipaaAudit("CHECK_BLOCKED_STATUS", "enforcement", req, { targetUserId: userId, resource });

    const isBlocked = aiPolicyEnforcementService.isActionBlocked(userId, resource);

    res.json({ userId, resource, isBlocked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] Check blocked error:", error);
    res.status(500).json({ error: "Failed to check blocked status" });
  }
});

router.get("/assessments", async (req: Request, res: Response) => {
  try {
    const filters = assessmentFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_ASSESSMENTS", "assessments", req, { filters });

    const assessments = aiPolicyEnforcementService.listAssessments(filters as any);
    res.json(assessments);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] List assessments error:", error);
    res.status(500).json({ error: "Failed to list assessments" });
  }
});

router.get("/assessments/:id", async (req: Request, res: Response) => {
  try {
    const assessment = aiPolicyEnforcementService.getAssessment(req.params.id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    logHipaaAudit("VIEW_ASSESSMENT", "assessment", req, { assessmentId: req.params.id });
    res.json(assessment);
  } catch (error) {
    console.error("[PolicyEnforcementAPI] Get assessment error:", error);
    res.status(500).json({ error: "Failed to retrieve assessment" });
  }
});

router.post("/assessments/:id/review", async (req: Request, res: Response) => {
  try {
    const { status, notes } = reviewAssessmentSchema.parse(req.body);
    const reviewerId = getUserId(req);

    logHipaaAudit("REVIEW_ASSESSMENT", "assessment", req, {
      assessmentId: req.params.id,
      status,
      notes: notes.substring(0, 100),
    });

    const assessment = await aiPolicyEnforcementService.reviewAssessment(
      req.params.id,
      status,
      reviewerId,
      notes
    );

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    res.json(assessment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] Review assessment error:", error);
    res.status(500).json({ error: "Failed to review assessment" });
  }
});

router.get("/configs", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_ENFORCEMENT_CONFIGS", "configs", req, {});
    const configs = aiPolicyEnforcementService.listEnforcementConfigs();
    res.json(configs);
  } catch (error) {
    console.error("[PolicyEnforcementAPI] List configs error:", error);
    res.status(500).json({ error: "Failed to list enforcement configs" });
  }
});

router.get("/configs/:id", async (req: Request, res: Response) => {
  try {
    const config = aiPolicyEnforcementService.getEnforcementConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Enforcement config not found" });
    }

    logHipaaAudit("VIEW_ENFORCEMENT_CONFIG", "config", req, { configId: req.params.id });
    res.json(config);
  } catch (error) {
    console.error("[PolicyEnforcementAPI] Get config error:", error);
    res.status(500).json({ error: "Failed to retrieve enforcement config" });
  }
});

router.patch("/configs/:id", async (req: Request, res: Response) => {
  try {
    const updates = updateConfigSchema.parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("UPDATE_ENFORCEMENT_CONFIG", "config", req, {
      configId: req.params.id,
      updates: Object.keys(updates),
    });

    const config = await aiPolicyEnforcementService.updateEnforcementConfig(
      req.params.id,
      updates,
      userId
    );

    if (!config) {
      return res.status(404).json({ error: "Enforcement config not found" });
    }

    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("[PolicyEnforcementAPI] Update config error:", error);
    res.status(500).json({ error: "Failed to update enforcement config" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_ENFORCEMENT_METRICS", "metrics", req, {});
    const metrics = aiPolicyEnforcementService.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[PolicyEnforcementAPI] Get metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
});

export default router;
