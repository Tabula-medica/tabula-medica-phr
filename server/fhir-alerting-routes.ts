/**
 * FHIR Alerting API Routes
 * 
 * Provides endpoints for managing alert rules and notifications
 * with US Core profile integration for clinical context.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { fhirAlertingService, AlertRuleType, AlertSeverity, AlertChannel } from "./services/fhir-alerting-service";

const router = Router();

// Validation schemas
const alertConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq", "between", "change_by"]),
  value: z.union([z.number(), z.string(), z.boolean()]),
  secondValue: z.number().optional(),
  timeWindow: z.string().optional()
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  type: z.enum([
    "vital_sign_threshold", "vital_sign_change", "condition_new",
    "condition_severity", "lab_critical", "lab_trend",
    "medication_interaction", "medication_adherence", "custom"
  ]),
  resourceType: z.string().min(1),
  enabled: z.boolean().default(true),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  conditions: z.array(alertConditionSchema).min(1),
  conditionLogic: z.enum(["AND", "OR"]).default("AND"),
  useCoreProfile: z.string().optional(),
  loincCode: z.string().optional(),
  snomedCode: z.string().optional(),
  channels: z.array(z.enum(["in_app", "email", "sms", "push"])).min(1),
  recipients: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    role: z.string().optional()
  })).optional(),
  cooldownMinutes: z.number().min(0).max(1440).default(60),
  escalationRules: z.array(z.object({
    afterMinutes: z.number(),
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    additionalRecipients: z.array(z.string())
  })).optional(),
  metadata: z.record(z.any()).optional(),
  createdBy: z.string().default("user")
});

const updateRuleSchema = createRuleSchema.partial();

const evaluateResourceSchema = z.object({
  resource: z.record(z.any()),
  resourceType: z.string(),
  patientId: z.string(),
  patientName: z.string().optional()
});

// Statistics endpoint
router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const stats = await fhirAlertingService.getStatistics();
    res.json(stats);
  } catch (error: any) {
    console.error("[FHIRAlerting] Error getting statistics:", error);
    res.status(500).json({ error: "Failed to get statistics", details: error.message });
  }
});

// US Core profiles reference
router.get("/us-core-profiles", async (req: Request, res: Response) => {
  try {
    const profiles = fhirAlertingService.getUSCoreProfiles();
    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get US Core profiles" });
  }
});

router.get("/us-core/vital-sign-thresholds/:vitalSign", async (req: Request, res: Response) => {
  try {
    const thresholds = fhirAlertingService.getVitalSignThresholds(req.params.vitalSign);
    if (!thresholds) {
      return res.status(404).json({ error: "Vital sign not found" });
    }
    res.json(thresholds);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get thresholds" });
  }
});

router.get("/us-core/critical-lab-values", async (req: Request, res: Response) => {
  try {
    const values = fhirAlertingService.getCriticalLabValues();
    res.json(values);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get critical lab values" });
  }
});

router.get("/us-core/high-risk-conditions", async (req: Request, res: Response) => {
  try {
    const conditions = fhirAlertingService.getHighRiskConditionCodes();
    res.json(conditions);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get high-risk conditions" });
  }
});

// Rule management
router.get("/rules", async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as AlertRuleType | undefined,
      severity: req.query.severity as AlertSeverity | undefined,
      enabled: req.query.enabled === "true" ? true : req.query.enabled === "false" ? false : undefined,
      resourceType: req.query.resourceType as string | undefined
    };

    const rules = await fhirAlertingService.listRules(filters);
    res.json(rules);
  } catch (error: any) {
    console.error("[FHIRAlerting] Error listing rules:", error);
    res.status(500).json({ error: "Failed to list rules", details: error.message });
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await fhirAlertingService.getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get rule", details: error.message });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const validated = createRuleSchema.parse(req.body);
    const rule = await fhirAlertingService.createRule(validated as any);
    res.status(201).json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("[FHIRAlerting] Error creating rule:", error);
    res.status(500).json({ error: "Failed to create rule", details: error.message });
  }
});

router.put("/rules/:id", async (req: Request, res: Response) => {
  try {
    const validated = updateRuleSchema.parse(req.body);
    const rule = await fhirAlertingService.updateRule(req.params.id, validated as any);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json(rule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update rule", details: error.message });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await fhirAlertingService.deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete rule", details: error.message });
  }
});

router.patch("/rules/:id/toggle", async (req: Request, res: Response) => {
  try {
    const rule = await fhirAlertingService.getRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    const updated = await fhirAlertingService.updateRule(req.params.id, { enabled: !rule.enabled });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to toggle rule", details: error.message });
  }
});

// Alert evaluation
router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const validated = evaluateResourceSchema.parse(req.body);
    const alerts = await fhirAlertingService.evaluateResource(
      validated.resource,
      validated.resourceType,
      validated.patientId,
      validated.patientName
    );
    res.json({ alerts, count: alerts.length });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("[FHIRAlerting] Error evaluating resource:", error);
    res.status(500).json({ error: "Failed to evaluate resource", details: error.message });
  }
});

// Notification management
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const filters = {
      patientId: req.query.patientId as string | undefined,
      severity: req.query.severity as AlertSeverity | undefined,
      acknowledged: req.query.acknowledged === "true" ? true : req.query.acknowledged === "false" ? false : undefined,
      ruleId: req.query.ruleId as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
    };

    const notifications = await fhirAlertingService.listNotifications(filters);
    res.json(notifications);
  } catch (error: any) {
    console.error("[FHIRAlerting] Error listing notifications:", error);
    res.status(500).json({ error: "Failed to list notifications", details: error.message });
  }
});

router.get("/notifications/:id", async (req: Request, res: Response) => {
  try {
    const notification = await fhirAlertingService.getNotification(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get notification", details: error.message });
  }
});

router.post("/notifications/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || "user";
    const notification = await fhirAlertingService.acknowledgeNotification(req.params.id, userId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to acknowledge notification", details: error.message });
  }
});

router.post("/notifications/acknowledge-all", async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || "user";
    const filters = {
      patientId: req.body.patientId,
      severity: req.body.severity
    };
    const count = await fhirAlertingService.acknowledgeAll(userId, filters);
    res.json({ acknowledged: count });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to acknowledge notifications", details: error.message });
  }
});

export function registerFHIRAlertingRoutes(app: any) {
  app.use("/api/fhir-alerting", router);
  console.log("[Routes] FHIR Alerting routes registered at /api/fhir-alerting/*");
}
