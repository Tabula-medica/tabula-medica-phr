import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiRemediationEngine } from "./services/ai-remediation-engine";

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
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${createHash("sha256").update(match).digest("hex").substring(0, 8)}]`
    );
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ["description", "title", "metadata", "notes", "reason"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveFields.includes(key) && typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function logHipaaAudit(
  action: string,
  resource: string,
  req: Request,
  details: Record<string, unknown>
): void {
  const userId = getUserId(req);
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "RemediationAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    userAgent: req.get("user-agent")?.substring(0, 100),
    details: sanitizeDetails(details),
  };
  console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
}

const triggerSchema = z.object({
  sourceType: z.enum(["data_quality", "compliance_monitoring", "predictive_alert", "manual"]),
  sourceId: z.string().min(1),
  issueType: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1).max(500),
  description: z.string().max(5000),
  affectedResource: z.object({
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
    patientId: z.string().optional(),
  }),
  detectedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const workflowFiltersSchema = z.object({
  status: z.enum(["pending", "in_progress", "awaiting_approval", "approved", "executing", "completed", "failed", "cancelled", "rolled_back"]).optional(),
  riskLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
  sourceType: z.enum(["data_quality", "compliance_monitoring", "predictive_alert", "manual"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

const approvalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
  reason: z.string().max(2000).optional(),
});

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  issueTypes: z.array(z.string()).min(1),
  sourceTypes: z.array(z.enum(["data_quality", "compliance_monitoring", "predictive_alert", "manual"])),
  applicableRiskLevels: z.array(z.enum(["critical", "high", "medium", "low"])),
  executionMode: z.enum(["auto", "guided", "manual"]),
  autoExecuteThreshold: z.number().min(0).max(1),
  stepTemplates: z.array(z.object({
    order: z.number(),
    name: z.string(),
    description: z.string(),
    actionType: z.enum(["validate", "transform", "update", "notify", "audit", "rollback"]),
    actionConfig: z.record(z.unknown()),
    preconditions: z.array(z.string()),
    expectedOutcome: z.string(),
    rollbackAction: z.record(z.unknown()).optional(),
    maxRetries: z.number().min(0).max(5),
  })),
  validationRules: z.array(z.string()),
  enabled: z.boolean(),
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_REMEDIATION_DASHBOARD", "dashboard", req, {});
    const dashboard = await aiRemediationEngine.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[RemediationAPI] Dashboard error:", error);
    res.status(500).json({ error: "Failed to retrieve dashboard" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("VIEW_REMEDIATION_METRICS", "metrics", req, {});
    const metrics = await aiRemediationEngine.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("[RemediationAPI] Metrics error:", error);
    res.status(500).json({ error: "Failed to retrieve metrics" });
  }
});

router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const filters = workflowFiltersSchema.parse(req.query);
    logHipaaAudit("LIST_WORKFLOWS", "workflows", req, { filters });
    const workflows = await aiRemediationEngine.listWorkflows(filters);
    res.json(workflows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid filters", details: error.errors });
    }
    console.error("[RemediationAPI] List workflows error:", error);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await aiRemediationEngine.getWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    logHipaaAudit("VIEW_WORKFLOW", "workflow", req, { workflowId: req.params.id });
    res.json(workflow);
  } catch (error) {
    console.error("[RemediationAPI] Get workflow error:", error);
    res.status(500).json({ error: "Failed to retrieve workflow" });
  }
});

router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const trigger = triggerSchema.parse(req.body);
    const fullTrigger = {
      ...trigger,
      detectedAt: trigger.detectedAt || new Date().toISOString(),
      metadata: trigger.metadata || {},
    };

    logHipaaAudit("CREATE_WORKFLOW", "workflow", req, {
      issueType: trigger.issueType,
      severity: trigger.severity,
      sourceType: trigger.sourceType,
    });

    const workflow = await aiRemediationEngine.createWorkflowFromTrigger(fullTrigger);
    if (!workflow) {
      return res.status(400).json({ error: "No matching template for this issue type" });
    }

    res.status(201).json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid trigger data", details: error.errors });
    }
    console.error("[RemediationAPI] Create workflow error:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.post("/workflows/:id/execute", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("EXECUTE_WORKFLOW", "workflow", req, { workflowId: req.params.id });

    const workflow = await aiRemediationEngine.executeWorkflow(req.params.id, userId);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found or cannot be executed" });
    }

    res.json(workflow);
  } catch (error) {
    console.error("[RemediationAPI] Execute workflow error:", error);
    res.status(500).json({ error: "Failed to execute workflow" });
  }
});

router.post("/workflows/:id/rollback", async (req: Request, res: Response) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1).max(1000) }).parse(req.body);
    const userId = getUserId(req);

    logHipaaAudit("ROLLBACK_WORKFLOW", "workflow", req, {
      workflowId: req.params.id,
      reason,
    });

    const workflow = await aiRemediationEngine.rollbackWorkflow(req.params.id, userId, reason);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found or cannot be rolled back" });
    }

    res.json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid rollback request", details: error.errors });
    }
    console.error("[RemediationAPI] Rollback workflow error:", error);
    res.status(500).json({ error: "Failed to rollback workflow" });
  }
});

router.get("/approvals", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_PENDING_APPROVALS", "approvals", req, {});
    const approvals = await aiRemediationEngine.getPendingApprovals();
    res.json(approvals);
  } catch (error) {
    console.error("[RemediationAPI] List approvals error:", error);
    res.status(500).json({ error: "Failed to list approvals" });
  }
});

router.get("/approvals/:id", async (req: Request, res: Response) => {
  try {
    const approval = await aiRemediationEngine.getApprovalRequest(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }
    logHipaaAudit("VIEW_APPROVAL", "approval", req, { approvalId: req.params.id });
    res.json(approval);
  } catch (error) {
    console.error("[RemediationAPI] Get approval error:", error);
    res.status(500).json({ error: "Failed to retrieve approval" });
  }
});

router.post("/approvals/:id/decide", async (req: Request, res: Response) => {
  try {
    const { decision, notes, reason } = approvalDecisionSchema.parse(req.body);
    const userId = getUserId(req);

    const approval = await aiRemediationEngine.getApprovalRequest(req.params.id);
    if (!approval) {
      return res.status(404).json({ error: "Approval request not found" });
    }

    logHipaaAudit("APPROVAL_DECISION", "approval", req, {
      approvalId: req.params.id,
      workflowId: approval.workflowId,
      decision,
    });

    let workflow;
    if (decision === "approve") {
      workflow = await aiRemediationEngine.approveWorkflow(approval.workflowId, userId, notes);
    } else {
      workflow = await aiRemediationEngine.rejectWorkflow(approval.workflowId, userId, reason || "Rejected by administrator");
    }

    if (!workflow) {
      return res.status(400).json({ error: "Failed to process approval decision" });
    }

    res.json({ approval: await aiRemediationEngine.getApprovalRequest(req.params.id), workflow });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid decision data", details: error.errors });
    }
    console.error("[RemediationAPI] Approval decision error:", error);
    res.status(500).json({ error: "Failed to process approval" });
  }
});

router.get("/templates", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("LIST_TEMPLATES", "templates", req, {});
    const templates = await aiRemediationEngine.listTemplates();
    res.json(templates);
  } catch (error) {
    console.error("[RemediationAPI] List templates error:", error);
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.get("/templates/:id", async (req: Request, res: Response) => {
  try {
    const template = await aiRemediationEngine.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    logHipaaAudit("VIEW_TEMPLATE", "template", req, { templateId: req.params.id });
    res.json(template);
  } catch (error) {
    console.error("[RemediationAPI] Get template error:", error);
    res.status(500).json({ error: "Failed to retrieve template" });
  }
});

router.post("/templates", async (req: Request, res: Response) => {
  try {
    const templateData = templateSchema.parse(req.body);
    logHipaaAudit("CREATE_TEMPLATE", "template", req, { name: templateData.name });

    const template = await aiRemediationEngine.createTemplate(templateData);
    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid template data", details: error.errors });
    }
    console.error("[RemediationAPI] Create template error:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.patch("/templates/:id", async (req: Request, res: Response) => {
  try {
    const updates = templateSchema.partial().parse(req.body);
    logHipaaAudit("UPDATE_TEMPLATE", "template", req, {
      templateId: req.params.id,
      updates: Object.keys(updates),
    });

    const template = await aiRemediationEngine.updateTemplate(req.params.id, updates);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    console.error("[RemediationAPI] Update template error:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.post("/trigger/data-quality", async (req: Request, res: Response) => {
  try {
    const issueSchema = z.object({
      id: z.string(),
      issueType: z.string(),
      severity: z.string(),
      title: z.string(),
      description: z.string(),
      resourceType: z.string(),
      resourceId: z.string(),
      patientId: z.string().optional(),
    });

    const issue = issueSchema.parse(req.body);
    logHipaaAudit("TRIGGER_DATA_QUALITY_REMEDIATION", "workflow", req, {
      issueId: issue.id,
      issueType: issue.issueType,
    });

    const workflow = await aiRemediationEngine.triggerFromDataQualityIssue(issue);
    if (!workflow) {
      return res.status(400).json({ error: "No matching template for this data quality issue" });
    }

    res.status(201).json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid issue data", details: error.errors });
    }
    console.error("[RemediationAPI] Data quality trigger error:", error);
    res.status(500).json({ error: "Failed to trigger remediation" });
  }
});

router.post("/trigger/compliance", async (req: Request, res: Response) => {
  try {
    const violationSchema = z.object({
      id: z.string(),
      ruleId: z.string(),
      severity: z.string(),
      title: z.string(),
      description: z.string(),
      affectedEntityType: z.string(),
      affectedEntityId: z.string(),
    });

    const violation = violationSchema.parse(req.body);
    logHipaaAudit("TRIGGER_COMPLIANCE_REMEDIATION", "workflow", req, {
      violationId: violation.id,
      ruleId: violation.ruleId,
    });

    const workflow = await aiRemediationEngine.triggerFromComplianceViolation(violation);
    if (!workflow) {
      return res.status(400).json({ error: "No matching template for this compliance violation" });
    }

    res.status(201).json(workflow);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid violation data", details: error.errors });
    }
    console.error("[RemediationAPI] Compliance trigger error:", error);
    res.status(500).json({ error: "Failed to trigger remediation" });
  }
});

export default router;
