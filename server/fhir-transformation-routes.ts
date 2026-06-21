import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import { aiFhirTransformationService, TransformationType, DataType } from "./services/ai-fhir-transformation";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(
  action: string,
  resource: string,
  req: Request,
  details: Record<string, unknown>
): void {
  const userId = (req as any).user?.id || "anonymous";
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "FHIRTransformationAPI",
    ipAddress: req.ip?.replace(/::ffff:/, ""),
    userAgent: req.get("user-agent")?.substring(0, 100),
    details,
  };
  console.log(`[HIPAA_AUDIT] ${JSON.stringify(auditEntry)}`);
}

const transformationTypes: TransformationType[] = [
  "field_mapping", "type_conversion", "value_normalization", "structure_flattening",
  "structure_nesting", "code_system_mapping", "date_format", "unit_conversion",
  "conditional", "aggregate", "split", "merge"
];

const dataTypes: DataType[] = [
  "string", "integer", "decimal", "boolean", "date", "dateTime", "time", "instant",
  "uri", "code", "id", "markdown", "base64Binary", "reference", "coding",
  "codeableConcept", "quantity", "period", "address", "humanName", "contactPoint", "identifier"
];

const ruleFiltersSchema = z.object({
  resourceType: z.string().optional(),
  transformationType: z.enum(transformationTypes as [string, ...string[]]).optional(),
  isActive: z.coerce.boolean().optional(),
  tag: z.string().optional(),
});

const mappingFiltersSchema = z.object({
  sourceSchema: z.string().optional(),
  targetSchema: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  tag: z.string().optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  sourceResourceType: z.string().min(1),
  targetResourceType: z.string().min(1),
  transformationType: z.enum(transformationTypes as [string, ...string[]]),
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  sourceDataType: z.enum(dataTypes as [string, ...string[]]),
  targetDataType: z.enum(dataTypes as [string, ...string[]]),
  transformationLogic: z.string().min(1),
  condition: z.string().optional(),
  defaultValue: z.unknown().optional(),
  priority: z.number().int().min(0).default(1),
  isActive: z.boolean().default(true),
  createdBy: z.string().min(1),
  tags: z.array(z.string()).default([]),
  validationRules: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateRuleSchema = createRuleSchema.partial();

const createMappingSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  sourceSchema: z.string().min(1),
  targetSchema: z.string().min(1),
  rules: z.array(z.string()),
  version: z.string().default("1.0.0"),
  isActive: z.boolean().default(true),
  createdBy: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

const updateMappingSchema = createMappingSchema.partial();

const executeTransformationSchema = z.object({
  mappingId: z.string().min(1),
  inputResource: z.record(z.unknown()),
});

const generateSuggestionsSchema = z.object({
  sourceResource: z.record(z.unknown()),
  targetModelId: z.string().min(1),
});

const createTargetModelSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  schema: z.record(z.unknown()),
  requiredFields: z.array(z.string()),
  optionalFields: z.array(z.string()),
  dataTypes: z.record(z.enum(dataTypes as [string, ...string[]])),
  constraints: z.record(z.string()),
  examples: z.array(z.record(z.unknown())).default([]),
});

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const filters = ruleFiltersSchema.parse(req.query);
    const rules = await aiFhirTransformationService.getAllRules(filters as any);

    logHipaaAudit("VIEW_TRANSFORMATION_RULES", "TransformationRule", req, {
      count: rules.length,
      filters,
    });

    res.json({
      rules,
      noCdsCompliance: "Data transformation rules for technical data mapping only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request parameters", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to fetch transformation rules" });
    }
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await aiFhirTransformationService.getRuleById(req.params.id);

    if (!rule) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    logHipaaAudit("VIEW_TRANSFORMATION_RULE", "TransformationRule", req, {
      ruleId: hashIdentifier(req.params.id),
    });

    res.json({
      rule,
      noCdsCompliance: "Data transformation rule for technical data mapping only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transformation rule" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const data = createRuleSchema.parse(req.body);
    const rule = await aiFhirTransformationService.createRule(data as any);

    logHipaaAudit("CREATE_TRANSFORMATION_RULE", "TransformationRule", req, {
      ruleId: hashIdentifier(rule.id),
      name: rule.name,
      transformationType: rule.transformationType,
    });

    res.status(201).json({
      rule,
      noCdsCompliance: "Data transformation rule created for technical data mapping only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid rule data", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to create transformation rule" });
    }
  }
});

router.patch("/rules/:id", async (req: Request, res: Response) => {
  try {
    const data = updateRuleSchema.parse(req.body);
    const rule = await aiFhirTransformationService.updateRule(req.params.id, data as any);

    if (!rule) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    logHipaaAudit("UPDATE_TRANSFORMATION_RULE", "TransformationRule", req, {
      ruleId: hashIdentifier(req.params.id),
    });

    res.json({
      rule,
      noCdsCompliance: "Data transformation rule updated for technical data mapping only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid rule data", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to update transformation rule" });
    }
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await aiFhirTransformationService.deleteRule(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    logHipaaAudit("DELETE_TRANSFORMATION_RULE", "TransformationRule", req, {
      ruleId: hashIdentifier(req.params.id),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete transformation rule" });
  }
});

router.get("/mappings", async (req: Request, res: Response) => {
  try {
    const filters = mappingFiltersSchema.parse(req.query);
    const mappings = await aiFhirTransformationService.getAllMappings(filters as any);

    logHipaaAudit("VIEW_TRANSFORMATION_MAPPINGS", "TransformationMapping", req, {
      count: mappings.length,
      filters,
    });

    res.json({
      mappings,
      noCdsCompliance: "Data transformation mappings for technical data integration only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request parameters", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to fetch transformation mappings" });
    }
  }
});

router.get("/mappings/:id", async (req: Request, res: Response) => {
  try {
    const mapping = await aiFhirTransformationService.getMappingById(req.params.id);

    if (!mapping) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }

    logHipaaAudit("VIEW_TRANSFORMATION_MAPPING", "TransformationMapping", req, {
      mappingId: hashIdentifier(req.params.id),
    });

    res.json({
      mapping,
      noCdsCompliance: "Data transformation mapping for technical data integration only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transformation mapping" });
  }
});

router.post("/mappings", async (req: Request, res: Response) => {
  try {
    const data = createMappingSchema.parse(req.body);
    const mapping = await aiFhirTransformationService.createMapping(data as any);

    logHipaaAudit("CREATE_TRANSFORMATION_MAPPING", "TransformationMapping", req, {
      mappingId: hashIdentifier(mapping.id),
      name: mapping.name,
    });

    res.status(201).json({
      mapping,
      noCdsCompliance: "Data transformation mapping created for technical data integration only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid mapping data", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to create transformation mapping" });
    }
  }
});

router.patch("/mappings/:id", async (req: Request, res: Response) => {
  try {
    const data = updateMappingSchema.parse(req.body);
    const mapping = await aiFhirTransformationService.updateMapping(req.params.id, data as any);

    if (!mapping) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }

    logHipaaAudit("UPDATE_TRANSFORMATION_MAPPING", "TransformationMapping", req, {
      mappingId: hashIdentifier(req.params.id),
    });

    res.json({
      mapping,
      noCdsCompliance: "Data transformation mapping updated for technical data integration only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid mapping data", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to update transformation mapping" });
    }
  }
});

router.delete("/mappings/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await aiFhirTransformationService.deleteMapping(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: "Mapping not found" });
      return;
    }

    logHipaaAudit("DELETE_TRANSFORMATION_MAPPING", "TransformationMapping", req, {
      mappingId: hashIdentifier(req.params.id),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete transformation mapping" });
  }
});

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const { mappingId, inputResource } = executeTransformationSchema.parse(req.body);
    const execution = await aiFhirTransformationService.executeTransformation(mappingId, inputResource);

    logHipaaAudit("EXECUTE_TRANSFORMATION", "TransformationExecution", req, {
      mappingId: hashIdentifier(mappingId),
      executionId: hashIdentifier(execution.id),
      success: execution.success,
      rulesApplied: execution.rulesApplied.length,
    });

    res.json({
      execution,
      noCdsCompliance: "Data transformation executed for technical data mapping only. Not for clinical decision-making.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: err.errors });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to execute transformation" });
    }
  }
});

router.post("/suggest", async (req: Request, res: Response) => {
  try {
    const { sourceResource, targetModelId } = generateSuggestionsSchema.parse(req.body);
    const suggestions = await aiFhirTransformationService.generateTransformationSuggestions(
      sourceResource,
      targetModelId
    );

    logHipaaAudit("GENERATE_TRANSFORMATION_SUGGESTIONS", "TransformationSuggestion", req, {
      targetModelId: hashIdentifier(targetModelId),
      suggestionsGenerated: suggestions.length,
    });

    res.json({
      suggestions,
      noCdsCompliance: "AI-generated transformation suggestions for technical data mapping only. Not for clinical decision-making.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request data", details: err.errors });
    } else {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to generate suggestions" });
    }
  }
});

router.get("/target-models", async (req: Request, res: Response) => {
  try {
    const models = await aiFhirTransformationService.getAllTargetModels();

    logHipaaAudit("VIEW_TARGET_MODELS", "TargetDataModel", req, {
      count: models.length,
    });

    res.json({
      models,
      noCdsCompliance: "Target data models for technical data integration only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch target models" });
  }
});

router.get("/target-models/:id", async (req: Request, res: Response) => {
  try {
    const model = await aiFhirTransformationService.getTargetModelById(req.params.id);

    if (!model) {
      res.status(404).json({ error: "Target model not found" });
      return;
    }

    logHipaaAudit("VIEW_TARGET_MODEL", "TargetDataModel", req, {
      modelId: hashIdentifier(req.params.id),
    });

    res.json({
      model,
      noCdsCompliance: "Target data model for technical data integration only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch target model" });
  }
});

router.post("/target-models", async (req: Request, res: Response) => {
  try {
    const data = createTargetModelSchema.parse(req.body);
    const model = await aiFhirTransformationService.createTargetModel(data as any);

    logHipaaAudit("CREATE_TARGET_MODEL", "TargetDataModel", req, {
      modelId: hashIdentifier(model.id),
      name: model.name,
    });

    res.status(201).json({
      model,
      noCdsCompliance: "Target data model created for technical data integration only.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid model data", details: err.errors });
    } else {
      res.status(500).json({ error: "Failed to create target model" });
    }
  }
});

router.get("/executions", async (req: Request, res: Response) => {
  try {
    const mappingId = req.query.mappingId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    const executions = await aiFhirTransformationService.getExecutionHistory(mappingId, limit);

    logHipaaAudit("VIEW_EXECUTION_HISTORY", "TransformationExecution", req, {
      count: executions.length,
      mappingId: mappingId ? hashIdentifier(mappingId) : undefined,
    });

    res.json({
      executions,
      noCdsCompliance: "Execution history for technical monitoring only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch execution history" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = await aiFhirTransformationService.getTransformationStats();

    logHipaaAudit("VIEW_TRANSFORMATION_STATS", "TransformationStats", req, {});

    res.json({
      ...stats,
      noCdsCompliance: "Transformation statistics for technical monitoring only.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch transformation stats" });
  }
});

export default router;
