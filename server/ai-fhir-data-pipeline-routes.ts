import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { z } from "zod";
import {
  getDataSources,
  getDataSource,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  getHarmonizationRules,
  getHarmonizationRule,
  createHarmonizationRule,
  updateHarmonizationRule,
  deleteHarmonizationRule,
  getValidationProfiles,
  getValidationProfile,
  createValidationProfile,
  getPipelines,
  getPipeline,
  getPipelineRun,
  getPipelineRunHistory,
  createPipeline,
  updatePipeline,
  executePipeline,
  addCohortAnalysisTask,
  removeCohortAnalysisTask,
  getPipelineHealth,
  getDefaultIntelligentExecutionConfig,
  getDefaultAdaptiveScheduleConfig,
  getDefaultSelfHealingConfig,
} from "./services/ai-fhir-data-pipeline";

const IntelligentExecutionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  skipHarmonizationThreshold: z.number().min(0).max(1).optional(),
  skipValidationThreshold: z.number().min(0).max(1).optional(),
  dataQualityMinimum: z.number().min(1).max(10000).optional(),
  useAIDecisions: z.boolean().optional(),
  preserveAuditTrail: z.boolean().optional(),
});

const AdaptiveScheduleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  baseIntervalMinutes: z.number().min(15).max(360).optional(),
  minIntervalMinutes: z.number().min(15).max(360).optional(),
  maxIntervalMinutes: z.number().min(15).max(360).optional(),
  volumeThresholds: z.object({
    low: z.number().min(0).optional(),
    medium: z.number().min(0).optional(),
    high: z.number().min(0).optional(),
  }).optional(),
  sourceHealthWeight: z.number().min(0).max(1).optional(),
  volumeTrendWeight: z.number().min(0).max(1).optional(),
});

const SelfHealingConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxRetryAttempts: z.number().min(1).max(10).optional(),
  retryDelayMs: z.number().min(100).max(60000).optional(),
  exponentialBackoff: z.boolean().optional(),
  healableErrorTypes: z.array(z.string()).optional(),
  autoRecoveryActions: z.array(z.object({
    errorPattern: z.string(),
    actionType: z.enum(["retry", "skip", "fallback", "notify", "pause_source", "reset_connection"]),
    parameters: z.record(z.unknown()).optional(),
  })).optional(),
});

const router = Router();

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA_AUDIT] ${timestamp} | ${action} | ${JSON.stringify(details)}`);
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

router.get("/data-sources", async (_req: Request, res: Response) => {
  try {
    const sources = getDataSources();
    res.json(sources);
  } catch (error) {
    console.error("[PipelineRoutes] Get data sources error:", error);
    res.status(500).json({ error: "Failed to get data sources" });
  }
});

router.get("/data-sources/:id", async (req: Request, res: Response) => {
  try {
    const source = getDataSource(req.params.id);
    if (!source) {
      return res.status(404).json({ error: "Data source not found" });
    }
    res.json(source);
  } catch (error) {
    console.error("[PipelineRoutes] Get data source error:", error);
    res.status(500).json({ error: "Failed to get data source" });
  }
});

router.post("/data-sources", async (req: Request, res: Response) => {
  try {
    const source = createDataSource(req.body);
    logHipaaAudit("DATA_SOURCE_CREATED_VIA_API", { sourceId: hashIdentifier(source.id), type: source.type });
    res.status(201).json(source);
  } catch (error) {
    console.error("[PipelineRoutes] Create data source error:", error);
    res.status(500).json({ error: "Failed to create data source" });
  }
});

router.patch("/data-sources/:id", async (req: Request, res: Response) => {
  try {
    const source = updateDataSource(req.params.id, req.body);
    if (!source) {
      return res.status(404).json({ error: "Data source not found" });
    }
    logHipaaAudit("DATA_SOURCE_UPDATED_VIA_API", { sourceId: hashIdentifier(source.id) });
    res.json(source);
  } catch (error) {
    console.error("[PipelineRoutes] Update data source error:", error);
    res.status(500).json({ error: "Failed to update data source" });
  }
});

router.delete("/data-sources/:id", async (req: Request, res: Response) => {
  try {
    const deleted = deleteDataSource(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Data source not found" });
    }
    logHipaaAudit("DATA_SOURCE_DELETED_VIA_API", { sourceId: hashIdentifier(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    console.error("[PipelineRoutes] Delete data source error:", error);
    res.status(500).json({ error: "Failed to delete data source" });
  }
});

router.get("/harmonization-rules", async (_req: Request, res: Response) => {
  try {
    const rules = getHarmonizationRules();
    res.json(rules);
  } catch (error) {
    console.error("[PipelineRoutes] Get harmonization rules error:", error);
    res.status(500).json({ error: "Failed to get harmonization rules" });
  }
});

router.get("/harmonization-rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = getHarmonizationRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Harmonization rule not found" });
    }
    res.json(rule);
  } catch (error) {
    console.error("[PipelineRoutes] Get harmonization rule error:", error);
    res.status(500).json({ error: "Failed to get harmonization rule" });
  }
});

router.post("/harmonization-rules", async (req: Request, res: Response) => {
  try {
    const rule = createHarmonizationRule(req.body);
    logHipaaAudit("HARMONIZATION_RULE_CREATED_VIA_API", { ruleId: hashIdentifier(rule.id), type: rule.ruleType });
    res.status(201).json(rule);
  } catch (error) {
    console.error("[PipelineRoutes] Create harmonization rule error:", error);
    res.status(500).json({ error: "Failed to create harmonization rule" });
  }
});

router.patch("/harmonization-rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = updateHarmonizationRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: "Harmonization rule not found" });
    }
    logHipaaAudit("HARMONIZATION_RULE_UPDATED_VIA_API", { ruleId: hashIdentifier(rule.id) });
    res.json(rule);
  } catch (error) {
    console.error("[PipelineRoutes] Update harmonization rule error:", error);
    res.status(500).json({ error: "Failed to update harmonization rule" });
  }
});

router.delete("/harmonization-rules/:id", async (req: Request, res: Response) => {
  try {
    const deleted = deleteHarmonizationRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Harmonization rule not found" });
    }
    logHipaaAudit("HARMONIZATION_RULE_DELETED_VIA_API", { ruleId: hashIdentifier(req.params.id) });
    res.json({ success: true });
  } catch (error) {
    console.error("[PipelineRoutes] Delete harmonization rule error:", error);
    res.status(500).json({ error: "Failed to delete harmonization rule" });
  }
});

router.get("/validation-profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = getValidationProfiles();
    res.json(profiles);
  } catch (error) {
    console.error("[PipelineRoutes] Get validation profiles error:", error);
    res.status(500).json({ error: "Failed to get validation profiles" });
  }
});

router.get("/validation-profiles/:id", async (req: Request, res: Response) => {
  try {
    const profile = getValidationProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Validation profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("[PipelineRoutes] Get validation profile error:", error);
    res.status(500).json({ error: "Failed to get validation profile" });
  }
});

router.post("/validation-profiles", async (req: Request, res: Response) => {
  try {
    const profile = createValidationProfile(req.body);
    logHipaaAudit("VALIDATION_PROFILE_CREATED_VIA_API", { profileId: hashIdentifier(profile.id) });
    res.status(201).json(profile);
  } catch (error) {
    console.error("[PipelineRoutes] Create validation profile error:", error);
    res.status(500).json({ error: "Failed to create validation profile" });
  }
});

router.get("/pipelines", async (_req: Request, res: Response) => {
  try {
    const pipelineList = getPipelines();
    res.json(pipelineList);
  } catch (error) {
    console.error("[PipelineRoutes] Get pipelines error:", error);
    res.status(500).json({ error: "Failed to get pipelines" });
  }
});

router.get("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    res.json(pipeline);
  } catch (error) {
    console.error("[PipelineRoutes] Get pipeline error:", error);
    res.status(500).json({ error: "Failed to get pipeline" });
  }
});

router.post("/pipelines", async (req: Request, res: Response) => {
  try {
    const pipeline = createPipeline(req.body);
    logHipaaAudit("PIPELINE_CREATED_VIA_API", { pipelineId: hashIdentifier(pipeline.id), name: pipeline.name });
    res.status(201).json(pipeline);
  } catch (error) {
    console.error("[PipelineRoutes] Create pipeline error:", error);
    res.status(500).json({ error: "Failed to create pipeline" });
  }
});

router.patch("/pipelines/:id", async (req: Request, res: Response) => {
  try {
    const pipeline = updatePipeline(req.params.id, req.body);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    logHipaaAudit("PIPELINE_UPDATED_VIA_API", { pipelineId: hashIdentifier(pipeline.id) });
    res.json(pipeline);
  } catch (error) {
    console.error("[PipelineRoutes] Update pipeline error:", error);
    res.status(500).json({ error: "Failed to update pipeline" });
  }
});

router.post("/pipelines/:id/execute", async (req: Request, res: Response) => {
  try {
    logHipaaAudit("PIPELINE_EXECUTION_REQUESTED", { pipelineId: hashIdentifier(req.params.id) });
    const run = await executePipeline(req.params.id);
    logHipaaAudit("PIPELINE_EXECUTION_COMPLETED", {
      pipelineId: hashIdentifier(req.params.id),
      runId: hashIdentifier(run.id),
      status: run.status,
    });
    res.json(run);
  } catch (error: any) {
    console.error("[PipelineRoutes] Execute pipeline error:", error);
    logHipaaAudit("PIPELINE_EXECUTION_FAILED", {
      pipelineId: hashIdentifier(req.params.id),
      error: error.message,
    });
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to execute pipeline" });
  }
});

router.get("/pipelines/:id/runs", async (req: Request, res: Response) => {
  try {
    const runs = getPipelineRunHistory(req.params.id);
    res.json(runs);
  } catch (error) {
    console.error("[PipelineRoutes] Get pipeline runs error:", error);
    res.status(500).json({ error: "Failed to get pipeline runs" });
  }
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  try {
    const run = getPipelineRun(req.params.id);
    if (!run) {
      return res.status(404).json({ error: "Pipeline run not found" });
    }
    logHipaaAudit("PIPELINE_RUN_ACCESSED", { runId: hashIdentifier(req.params.id) });
    res.json(run);
  } catch (error) {
    console.error("[PipelineRoutes] Get pipeline run error:", error);
    res.status(500).json({ error: "Failed to get pipeline run" });
  }
});

router.post("/pipelines/:id/analysis-tasks", async (req: Request, res: Response) => {
  try {
    const task = addCohortAnalysisTask(req.params.id, req.body);
    logHipaaAudit("COHORT_ANALYSIS_TASK_ADDED_VIA_API", {
      pipelineId: hashIdentifier(req.params.id),
      taskId: hashIdentifier(task.id),
      taskType: task.taskType,
    });
    res.status(201).json(task);
  } catch (error: any) {
    console.error("[PipelineRoutes] Add analysis task error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to add analysis task" });
  }
});

router.delete("/pipelines/:pipelineId/analysis-tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const removed = removeCohortAnalysisTask(req.params.pipelineId, req.params.taskId);
    if (!removed) {
      return res.status(404).json({ error: "Task not found" });
    }
    logHipaaAudit("COHORT_ANALYSIS_TASK_REMOVED_VIA_API", {
      pipelineId: hashIdentifier(req.params.pipelineId),
      taskId: hashIdentifier(req.params.taskId),
    });
    res.json({ success: true });
  } catch (error) {
    console.error("[PipelineRoutes] Remove analysis task error:", error);
    res.status(500).json({ error: "Failed to remove analysis task" });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = getPipelineHealth();
    res.json(health);
  } catch (error) {
    console.error("[PipelineRoutes] Get health error:", error);
    res.status(500).json({ error: "Failed to get pipeline health" });
  }
});

router.patch("/pipelines/:id/intelligent-execution", async (req: Request, res: Response) => {
  try {
    const parseResult = IntelligentExecutionConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("INTELLIGENT_EXECUTION_VALIDATION_FAILED", { pipelineId: hashIdentifier(req.params.id), errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid configuration", details: parseResult.error.issues });
    }
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const defaultConfig = getDefaultIntelligentExecutionConfig();
    pipeline.intelligentExecution = { ...defaultConfig, ...pipeline.intelligentExecution, ...parseResult.data };
    updatePipeline(req.params.id, { intelligentExecution: pipeline.intelligentExecution });
    logHipaaAudit("INTELLIGENT_EXECUTION_CONFIGURED", { pipelineId: hashIdentifier(req.params.id), enabled: pipeline.intelligentExecution.enabled, thresholds: { harmonization: pipeline.intelligentExecution.skipHarmonizationThreshold, validation: pipeline.intelligentExecution.skipValidationThreshold } });
    res.json({ success: true, intelligentExecution: pipeline.intelligentExecution });
  } catch (error) {
    console.error("[PipelineRoutes] Configure intelligent execution error:", error);
    res.status(500).json({ error: "Failed to configure intelligent execution" });
  }
});

router.get("/pipelines/:id/intelligent-execution", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    res.json(pipeline.intelligentExecution || getDefaultIntelligentExecutionConfig());
  } catch (error) {
    console.error("[PipelineRoutes] Get intelligent execution config error:", error);
    res.status(500).json({ error: "Failed to get intelligent execution config" });
  }
});

router.patch("/pipelines/:id/adaptive-schedule", async (req: Request, res: Response) => {
  try {
    const parseResult = AdaptiveScheduleConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("ADAPTIVE_SCHEDULE_VALIDATION_FAILED", { pipelineId: hashIdentifier(req.params.id), errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid configuration", details: parseResult.error.issues });
    }
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const defaultConfig = getDefaultAdaptiveScheduleConfig();
    const validatedConfig = parseResult.data;
    if (validatedConfig.minIntervalMinutes && validatedConfig.maxIntervalMinutes && validatedConfig.minIntervalMinutes > validatedConfig.maxIntervalMinutes) {
      return res.status(400).json({ error: "minIntervalMinutes cannot exceed maxIntervalMinutes" });
    }
    if (validatedConfig.sourceHealthWeight !== undefined && validatedConfig.volumeTrendWeight !== undefined) {
      const totalWeight = validatedConfig.sourceHealthWeight + validatedConfig.volumeTrendWeight;
      if (totalWeight > 1) {
        return res.status(400).json({ error: "Combined sourceHealthWeight and volumeTrendWeight cannot exceed 1.0" });
      }
    }
    pipeline.adaptiveConfig = { ...defaultConfig, ...pipeline.adaptiveConfig, ...validatedConfig };
    updatePipeline(req.params.id, { adaptiveConfig: pipeline.adaptiveConfig });
    logHipaaAudit("ADAPTIVE_SCHEDULE_CONFIGURED", { pipelineId: hashIdentifier(req.params.id), enabled: pipeline.adaptiveConfig.enabled, intervals: { base: pipeline.adaptiveConfig.baseIntervalMinutes, min: pipeline.adaptiveConfig.minIntervalMinutes, max: pipeline.adaptiveConfig.maxIntervalMinutes } });
    res.json({ success: true, adaptiveConfig: pipeline.adaptiveConfig });
  } catch (error) {
    console.error("[PipelineRoutes] Configure adaptive schedule error:", error);
    res.status(500).json({ error: "Failed to configure adaptive schedule" });
  }
});

router.get("/pipelines/:id/adaptive-schedule", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    res.json(pipeline.adaptiveConfig || getDefaultAdaptiveScheduleConfig());
  } catch (error) {
    console.error("[PipelineRoutes] Get adaptive schedule config error:", error);
    res.status(500).json({ error: "Failed to get adaptive schedule config" });
  }
});

router.get("/pipelines/:id/schedule-history", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const history = pipeline.adaptiveConfig?.adjustmentHistory || [];
    res.json({ adjustments: history, currentInterval: pipeline.adaptiveConfig?.currentIntervalMinutes });
  } catch (error) {
    console.error("[PipelineRoutes] Get schedule history error:", error);
    res.status(500).json({ error: "Failed to get schedule history" });
  }
});

router.patch("/pipelines/:id/self-healing", async (req: Request, res: Response) => {
  try {
    const parseResult = SelfHealingConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      logHipaaAudit("SELF_HEALING_VALIDATION_FAILED", { pipelineId: hashIdentifier(req.params.id), errors: parseResult.error.issues.map(e => e.message) });
      return res.status(400).json({ error: "Invalid configuration", details: parseResult.error.issues });
    }
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const defaultConfig = getDefaultSelfHealingConfig();
    const validatedConfig = parseResult.data;
    pipeline.selfHealingConfig = { ...defaultConfig, ...pipeline.selfHealingConfig, ...validatedConfig, healingHistory: pipeline.selfHealingConfig?.healingHistory || [] };
    if (validatedConfig.autoRecoveryActions) {
      pipeline.selfHealingConfig.autoRecoveryActions = validatedConfig.autoRecoveryActions.map(action => ({
        ...action,
        parameters: action.parameters || {},
        successRate: 0,
        timesApplied: 0,
      }));
    }
    updatePipeline(req.params.id, { selfHealingConfig: pipeline.selfHealingConfig });
    logHipaaAudit("SELF_HEALING_CONFIGURED", { pipelineId: hashIdentifier(req.params.id), enabled: pipeline.selfHealingConfig.enabled, maxRetries: pipeline.selfHealingConfig.maxRetryAttempts, actionTypes: pipeline.selfHealingConfig.autoRecoveryActions.map(a => a.actionType) });
    res.json({ success: true, selfHealingConfig: pipeline.selfHealingConfig });
  } catch (error) {
    console.error("[PipelineRoutes] Configure self-healing error:", error);
    res.status(500).json({ error: "Failed to configure self-healing" });
  }
});

router.get("/pipelines/:id/self-healing", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    res.json(pipeline.selfHealingConfig || getDefaultSelfHealingConfig());
  } catch (error) {
    console.error("[PipelineRoutes] Get self-healing config error:", error);
    res.status(500).json({ error: "Failed to get self-healing config" });
  }
});

router.get("/pipelines/:id/healing-history", async (req: Request, res: Response) => {
  try {
    const pipeline = getPipeline(req.params.id);
    if (!pipeline) {
      return res.status(404).json({ error: "Pipeline not found" });
    }
    const history = pipeline.selfHealingConfig?.healingHistory || [];
    const actions = pipeline.selfHealingConfig?.autoRecoveryActions || [];
    res.json({ healingEvents: history, recoveryActions: actions.map(a => ({ errorPattern: a.errorPattern, actionType: a.actionType, successRate: a.successRate, timesApplied: a.timesApplied })) });
  } catch (error) {
    console.error("[PipelineRoutes] Get healing history error:", error);
    res.status(500).json({ error: "Failed to get healing history" });
  }
});

router.get("/defaults/intelligent-execution", async (_req: Request, res: Response) => {
  res.json(getDefaultIntelligentExecutionConfig());
});

router.get("/defaults/adaptive-schedule", async (_req: Request, res: Response) => {
  res.json(getDefaultAdaptiveScheduleConfig());
});

router.get("/defaults/self-healing", async (_req: Request, res: Response) => {
  res.json(getDefaultSelfHealingConfig());
});

export default router;
