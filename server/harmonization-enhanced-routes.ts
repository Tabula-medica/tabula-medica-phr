import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  getInconsistencies,
  getInconsistency,
  getHarmonizationRules,
  getHarmonizationRule,
  createHarmonizationRule,
  updateHarmonizationRule,
  deleteHarmonizationRule,
  resolveInconsistency,
  generateHarmonizationSuggestion,
  detectInconsistencies,
  getSourceReliabilityScores,
  getHarmonizationStats,
  autoResolveInconsistencies
} from "./services/ai-fhir-harmonization-enhanced";

const router = Router();

function logAudit(action: string, req: Request, details: Record<string, any>): void {
  const userId = (req as any).user?.id || "anonymous";
  const hashedUserId = crypto.createHash("sha256").update(userId).digest("hex").substring(0, 16);
  console.log(`[HIPAA Audit] [Harmonization] Action: ${action}, User: ${hashedUserId}, IP: ${req.ip}, Details: ${JSON.stringify(details)}`);
}

const CreateRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  resourceType: z.string().min(1),
  fieldPath: z.string().min(1),
  ruleType: z.enum(["source_priority", "most_recent", "highest_confidence", "majority_vote", "custom_logic", "ai_suggested"]),
  priority: z.number().int().min(1),
  isActive: z.boolean().default(true),
  configuration: z.object({
    sourcePriority: z.array(z.string()).optional(),
    confidenceThreshold: z.number().min(0).max(1).optional(),
    customLogic: z.string().optional(),
    votingThreshold: z.number().min(0).max(1).optional()
  }).default({}),
  createdBy: z.string().default("user")
});

const UpdateRuleSchema = CreateRuleSchema.partial();

const ResolveInconsistencySchema = z.object({
  ruleId: z.string().optional(),
  resolvedValue: z.any().refine(val => val !== undefined, { message: "resolvedValue is required" }),
  resolutionMethod: z.enum(["automatic", "manual", "ai_assisted"]),
  reasoning: z.string(),
  appliedBy: z.string().default("user")
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    logAudit("get_stats", req, {});
    const stats = getHarmonizationStats();
    res.json({
      ...stats,
      noCdsCompliance: "Statistics for data quality monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error getting stats:", error);
    res.status(500).json({ error: "Failed to get harmonization statistics" });
  }
});

router.get("/inconsistencies", async (req: Request, res: Response) => {
  try {
    const { status, severity, resourceType } = req.query;
    logAudit("list_inconsistencies", req, { status, severity, resourceType });

    const inconsistencies = getInconsistencies({
      status: status as string,
      severity: severity as string,
      resourceType: resourceType as string
    });

    res.json({
      inconsistencies,
      noCdsCompliance: "Inconsistency data for quality monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error listing inconsistencies:", error);
    res.status(500).json({ error: "Failed to list inconsistencies" });
  }
});

router.get("/inconsistencies/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logAudit("get_inconsistency", req, { id });

    const inconsistency = getInconsistency(id);
    if (!inconsistency) {
      return res.status(404).json({ error: "Inconsistency not found" });
    }

    res.json({
      inconsistency,
      noCdsCompliance: "Inconsistency data for quality monitoring only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error getting inconsistency:", error);
    res.status(500).json({ error: "Failed to get inconsistency" });
  }
});

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const { resourceType, isActive } = req.query;
    logAudit("list_rules", req, { resourceType, isActive });

    const rules = getHarmonizationRules({
      resourceType: resourceType as string,
      isActive: isActive === "true" ? true : isActive === "false" ? false : undefined
    });

    res.json({
      rules,
      noCdsCompliance: "Harmonization rules for data quality only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error listing rules:", error);
    res.status(500).json({ error: "Failed to list rules" });
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logAudit("get_rule", req, { id });

    const rule = getHarmonizationRule(id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ rule });
  } catch (error) {
    console.error("[Harmonization] Error getting rule:", error);
    res.status(500).json({ error: "Failed to get rule" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const validation = CreateRuleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    logAudit("create_rule", req, { name: validation.data.name });

    const rule = createHarmonizationRule(validation.data);

    res.status(201).json({
      rule,
      noCdsCompliance: "Rule created for data harmonization only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error creating rule:", error);
    res.status(500).json({ error: "Failed to create rule" });
  }
});

router.patch("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validation = UpdateRuleSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    logAudit("update_rule", req, { id });

    const rule = updateHarmonizationRule(id, validation.data);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ rule });
  } catch (error) {
    console.error("[Harmonization] Error updating rule:", error);
    res.status(500).json({ error: "Failed to update rule" });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logAudit("delete_rule", req, { id });

    const deleted = deleteHarmonizationRule(id);
    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Harmonization] Error deleting rule:", error);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

router.post("/resolve/:inconsistencyId", async (req: Request, res: Response) => {
  try {
    const { inconsistencyId } = req.params;
    const validation = ResolveInconsistencySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    logAudit("resolve_inconsistency", req, { inconsistencyId, method: validation.data.resolutionMethod });

    const resolution = await resolveInconsistency(inconsistencyId, validation.data);
    if (!resolution) {
      return res.status(404).json({ error: "Inconsistency not found" });
    }

    res.json({
      resolution,
      noCdsCompliance: "Resolution applied for data quality purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error resolving inconsistency:", error);
    res.status(500).json({ error: "Failed to resolve inconsistency" });
  }
});

router.post("/suggest/:inconsistencyId", async (req: Request, res: Response) => {
  try {
    const { inconsistencyId } = req.params;
    logAudit("generate_suggestion", req, { inconsistencyId });

    const suggestion = await generateHarmonizationSuggestion(inconsistencyId);
    if (!suggestion) {
      return res.status(404).json({ error: "Inconsistency not found" });
    }

    res.json({ suggestion });
  } catch (error) {
    console.error("[Harmonization] Error generating suggestion:", error);
    res.status(500).json({ error: "Failed to generate suggestion" });
  }
});

router.post("/detect", async (req: Request, res: Response) => {
  try {
    const { resources } = req.body;
    if (!Array.isArray(resources)) {
      return res.status(400).json({ error: "Resources must be an array" });
    }

    logAudit("detect_inconsistencies", req, { resourceCount: resources.length });

    const detected = await detectInconsistencies(resources);

    res.json({
      detected,
      count: detected.length,
      noCdsCompliance: "Inconsistency detection for data quality only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error detecting inconsistencies:", error);
    res.status(500).json({ error: "Failed to detect inconsistencies" });
  }
});

router.get("/source-reliability", async (req: Request, res: Response) => {
  try {
    logAudit("get_source_reliability", req, {});
    const reliability = getSourceReliabilityScores();
    res.json({
      sources: reliability,
      noCdsCompliance: "Source reliability for data quality only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error getting source reliability:", error);
    res.status(500).json({ error: "Failed to get source reliability" });
  }
});

router.post("/auto-resolve", async (req: Request, res: Response) => {
  try {
    logAudit("auto_resolve", req, {});

    const result = await autoResolveInconsistencies();

    res.json({
      ...result,
      noCdsCompliance: "Auto-resolution for data quality only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[Harmonization] Error auto-resolving:", error);
    res.status(500).json({ error: "Failed to auto-resolve inconsistencies" });
  }
});

export default router;
