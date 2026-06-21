import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { accessControlService, AccessLevel, PolicyStatus } from "./services/ai-access-control";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

const router = Router();

router.use(isAuthenticated);
router.use(requireRole("admin"));

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Access control audit log. Operations are for data governance only, not clinical decision-making."
  };
  console.log("[HIPAA-AUDIT][ACCESS-CONTROL]", JSON.stringify(auditEntry));
}

const PolicyConditionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["time_based", "location_based", "context_based", "risk_based", "consent_based"]),
  operator: z.enum(["equals", "not_equals", "contains", "greater_than", "less_than", "in_range"]),
  field: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  description: z.string()
});

const DataElementAccessSchema = z.object({
  element: z.string(),
  accessLevel: z.enum(["none", "read", "write", "admin"]),
  sensitivityLevel: z.enum(["public", "internal", "confidential", "restricted"]),
  maskingRule: z.string().optional(),
  auditRequired: z.boolean()
});

const CreatePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  roleId: z.string(),
  resourceType: z.string(),
  accessLevel: z.enum(["none", "read", "write", "admin"]),
  conditions: z.array(PolicyConditionSchema).optional(),
  dataElements: z.array(DataElementAccessSchema).optional(),
  status: z.enum(["active", "inactive", "pending_review"]).optional(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional()
});

const UpdatePolicySchema = CreatePolicySchema.partial();

const RiskEvaluationSchema = z.object({
  userId: z.string(),
  patientId: z.string(),
  resourceType: z.string(),
  action: z.string()
});

const DynamicAdjustmentSchema = z.object({
  patientId: z.string(),
  userId: z.string(),
  roleId: z.string(),
  originalAccessLevel: z.enum(["none", "read", "write", "admin"]),
  adjustedAccessLevel: z.enum(["none", "read", "write", "admin"]),
  reason: z.string(),
  validHours: z.number().min(1).max(168).optional()
});

const PolicySuggestionRequestSchema = z.object({
  roleId: z.string(),
  resourceType: z.string()
});

const AuditFilterSchema = z.object({
  userId: z.string().optional(),
  patientId: z.string().optional(),
  outcome: z.enum(["allowed", "denied", "partial"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

router.get("/stats", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ACCESS_CONTROL_STATS", {}, req);

  try {
    const stats = accessControlService.getStats();
    res.json({
      stats,
      noCdsCompliance: "Access control statistics for governance monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting access control stats:", error);
    res.status(500).json({ error: "Failed to get access control statistics" });
  }
});

router.get("/roles", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ROLES", {}, req);

  try {
    const roles = accessControlService.getRoles();
    res.json({
      roles,
      count: roles.length,
      noCdsCompliance: "Role definitions for access governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting roles:", error);
    res.status(500).json({ error: "Failed to get roles" });
  }
});

router.get("/roles/:roleId", (req: Request, res: Response) => {
  const { roleId } = req.params;
  logHIPAAAudit("GET_ROLE", { roleId }, req);

  try {
    const role = accessControlService.getRole(roleId);
    if (!role) {
      return res.status(404).json({ error: "Role not found" });
    }
    res.json({
      role,
      noCdsCompliance: "Role definition for access governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting role:", error);
    res.status(500).json({ error: "Failed to get role" });
  }
});

router.get("/policies", (req: Request, res: Response) => {
  logHIPAAAudit("GET_POLICIES", {}, req);

  try {
    const policies = accessControlService.getPolicies();
    res.json({
      policies,
      count: policies.length,
      noCdsCompliance: "Access policies for data governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting policies:", error);
    res.status(500).json({ error: "Failed to get policies" });
  }
});

router.get("/policies/:policyId", (req: Request, res: Response) => {
  const { policyId } = req.params;
  logHIPAAAudit("GET_POLICY", { policyId }, req);

  try {
    const policy = accessControlService.getPolicy(policyId);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json({
      policy,
      noCdsCompliance: policy.noCdsCompliance
    });
  } catch (error) {
    console.error("Error getting policy:", error);
    res.status(500).json({ error: "Failed to get policy" });
  }
});

router.post("/policies", async (req: Request, res: Response) => {
  try {
    const validation = CreatePolicySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("CREATE_POLICY", { name: validation.data.name, roleId: validation.data.roleId }, req);

    const conditions = (validation.data.conditions || []).map(c => ({
      ...c,
      id: c.id || `cond-${crypto.randomUUID().slice(0, 8)}`
    }));

    const policy = await accessControlService.createPolicy({
      ...validation.data,
      conditions,
      dataElements: validation.data.dataElements || [],
      status: (validation.data.status || "pending_review") as PolicyStatus,
      aiSuggested: false,
      effectiveFrom: validation.data.effectiveFrom ? new Date(validation.data.effectiveFrom) : new Date(),
      effectiveUntil: validation.data.effectiveUntil ? new Date(validation.data.effectiveUntil) : undefined,
      createdBy: "user"
    });

    res.status(201).json({
      policy,
      noCdsCompliance: policy.noCdsCompliance
    });
  } catch (error) {
    console.error("Error creating policy:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:policyId", async (req: Request, res: Response) => {
  const { policyId } = req.params;

  try {
    const validation = UpdatePolicySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("UPDATE_POLICY", { policyId, updates: Object.keys(validation.data) }, req);

    const updates = { ...validation.data };
    if (updates.conditions) {
      updates.conditions = updates.conditions.map(c => ({
        ...c,
        id: c.id || `cond-${crypto.randomUUID().slice(0, 8)}`
      }));
    }
    const policy = await accessControlService.updatePolicy(policyId, updates as any);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }

    res.json({
      policy,
      noCdsCompliance: policy.noCdsCompliance
    });
  } catch (error) {
    console.error("Error updating policy:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/policies/:policyId", async (req: Request, res: Response) => {
  const { policyId } = req.params;

  logHIPAAAudit("DELETE_POLICY", { policyId }, req);

  try {
    const deleted = await accessControlService.deletePolicy(policyId);
    if (!deleted) {
      return res.status(404).json({ error: "Policy not found" });
    }

    res.json({
      success: true,
      noCdsCompliance: "Policy deletion for access governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error deleting policy:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

router.post("/risk-evaluation", async (req: Request, res: Response) => {
  try {
    const validation = RiskEvaluationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("EVALUATE_ACCESS_RISK", validation.data, req);

    const result = await accessControlService.evaluateAccessRisk(
      validation.data.userId,
      validation.data.patientId,
      validation.data.resourceType,
      validation.data.action
    );

    res.json(result);
  } catch (error) {
    console.error("Error evaluating access risk:", error);
    res.status(500).json({ error: "Failed to evaluate access risk" });
  }
});

router.get("/adjustments", (req: Request, res: Response) => {
  logHIPAAAudit("GET_ADJUSTMENTS", {}, req);

  try {
    const adjustments = accessControlService.getAdjustments();
    res.json({
      adjustments,
      count: adjustments.length,
      noCdsCompliance: "Dynamic access adjustments for operational security. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting adjustments:", error);
    res.status(500).json({ error: "Failed to get adjustments" });
  }
});

router.post("/adjustments", async (req: Request, res: Response) => {
  try {
    const validation = DynamicAdjustmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("CREATE_DYNAMIC_ADJUSTMENT", {
      patientId: validation.data.patientId,
      userId: validation.data.userId,
      adjustedLevel: validation.data.adjustedAccessLevel
    }, req);

    const adjustment = await accessControlService.createDynamicAdjustment(
      validation.data.patientId,
      validation.data.userId,
      validation.data.roleId,
      validation.data.originalAccessLevel as any,
      validation.data.adjustedAccessLevel as any,
      validation.data.reason,
      [],
      [],
      validation.data.validHours
    );

    res.status(201).json({
      adjustment,
      noCdsCompliance: adjustment.noCdsCompliance
    });
  } catch (error) {
    console.error("Error creating adjustment:", error);
    res.status(500).json({ error: "Failed to create adjustment" });
  }
});

router.get("/audit", (req: Request, res: Response) => {
  try {
    const validation = AuditFilterSchema.safeParse(req.query);
    const filters = validation.success ? {
      ...validation.data,
      startDate: validation.data.startDate ? new Date(validation.data.startDate) : undefined,
      endDate: validation.data.endDate ? new Date(validation.data.endDate) : undefined
    } : undefined;

    logHIPAAAudit("GET_AUDIT_LOG", { filters: validation.data }, req);

    const entries = accessControlService.getAuditLog(filters);
    res.json({
      entries,
      count: entries.length,
      noCdsCompliance: "Access audit log for compliance monitoring. Not clinical data."
    });
  } catch (error) {
    console.error("Error getting audit log:", error);
    res.status(500).json({ error: "Failed to get audit log" });
  }
});

router.get("/pattern-analysis", (req: Request, res: Response) => {
  logHIPAAAudit("GET_PATTERN_ANALYSES", {}, req);

  try {
    const analyses = accessControlService.getPatternAnalyses();
    res.json({
      analyses,
      count: analyses.length,
      noCdsCompliance: "Access pattern analyses for security compliance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting pattern analyses:", error);
    res.status(500).json({ error: "Failed to get pattern analyses" });
  }
});

router.post("/pattern-analysis", async (req: Request, res: Response) => {
  try {
    const analysisType = req.body.analysisType || "anomaly";

    logHIPAAAudit("GENERATE_PATTERN_ANALYSIS", { analysisType }, req);

    const analysis = await accessControlService.analyzeAccessPatterns(analysisType);

    res.json({
      analysis,
      noCdsCompliance: analysis.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating pattern analysis:", error);
    res.status(500).json({ error: "Failed to generate pattern analysis" });
  }
});

router.get("/suggestions", (req: Request, res: Response) => {
  logHIPAAAudit("GET_POLICY_SUGGESTIONS", {}, req);

  try {
    const suggestions = accessControlService.getSuggestions();
    res.json({
      suggestions,
      count: suggestions.length,
      pendingCount: suggestions.filter(s => s.status === "pending").length,
      noCdsCompliance: "AI policy suggestions for access governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error getting suggestions:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

router.post("/suggestions", async (req: Request, res: Response) => {
  try {
    const validation = PolicySuggestionRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    logHIPAAAudit("GENERATE_POLICY_SUGGESTION", validation.data, req);

    const suggestion = await accessControlService.generatePolicySuggestion(
      validation.data.roleId,
      validation.data.resourceType
    );

    res.json({
      suggestion,
      noCdsCompliance: suggestion.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating suggestion:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

router.post("/suggestions/:suggestionId/accept", async (req: Request, res: Response) => {
  const { suggestionId } = req.params;

  logHIPAAAudit("ACCEPT_POLICY_SUGGESTION", { suggestionId }, req);

  try {
    const policy = await accessControlService.acceptSuggestion(suggestionId);
    if (!policy) {
      return res.status(404).json({ error: "Suggestion not found or already processed" });
    }

    res.json({
      policy,
      noCdsCompliance: policy.noCdsCompliance
    });
  } catch (error) {
    console.error("Error accepting suggestion:", error);
    res.status(500).json({ error: "Failed to accept suggestion" });
  }
});

router.post("/suggestions/:suggestionId/reject", async (req: Request, res: Response) => {
  const { suggestionId } = req.params;

  logHIPAAAudit("REJECT_POLICY_SUGGESTION", { suggestionId }, req);

  try {
    const rejected = await accessControlService.rejectSuggestion(suggestionId);
    if (!rejected) {
      return res.status(404).json({ error: "Suggestion not found or already processed" });
    }

    res.json({
      success: true,
      noCdsCompliance: "Suggestion rejection for access governance. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("Error rejecting suggestion:", error);
    res.status(500).json({ error: "Failed to reject suggestion" });
  }
});

export default router;
