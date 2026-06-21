import { Router, Response } from "express";
import { 
  aiModelManagementService, 
  ModelType, 
  ModelStatus, 
  DeploymentEnvironment,
  ABExperiment 
} from "./services/ai-model-management-service";
import { requireRole, extractUserContext, AuthorizedRequest } from "./middleware/rbac-authorization";

const router = Router();

router.use(extractUserContext);

router.get("/metadata", async (req: AuthorizedRequest, res: Response) => {
  try {
    const metadata = await aiModelManagementService.getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching metadata:", error);
    res.status(500).json({ error: "Failed to fetch service metadata" });
  }
});

router.get("/dashboard", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const dashboard = await aiModelManagementService.getModelDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.get("/models", requireRole("administrator", "clinician", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { type, status, environment, tags } = req.query;

    const filters: {
      type?: ModelType;
      status?: ModelStatus;
      environment?: DeploymentEnvironment;
      tags?: string[];
    } = {};

    if (type) filters.type = type as ModelType;
    if (status) filters.status = status as ModelStatus;
    if (environment) filters.environment = environment as DeploymentEnvironment;
    if (tags) filters.tags = (tags as string).split(",");

    const result = await aiModelManagementService.listModels(userId, filters);
    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error listing models:", error);
    res.status(500).json({ error: "Failed to list models" });
  }
});

router.get("/models/:modelId", requireRole("administrator", "clinician", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;

    const result = await aiModelManagementService.getModel(userId, modelId);
    if (!result) {
      return res.status(404).json({ error: "Model not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching model:", error);
    res.status(500).json({ error: "Failed to fetch model" });
  }
});

router.get("/models/:modelId/metrics", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const { startDate, endDate } = req.query;

    const timeRange = startDate && endDate 
      ? { start: startDate as string, end: endDate as string }
      : undefined;

    const result = await aiModelManagementService.getModelMetrics(userId, modelId, timeRange);
    if (!result) {
      return res.status(404).json({ error: "Model not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching metrics:", error);
    res.status(500).json({ error: "Failed to fetch model metrics" });
  }
});

router.post("/models", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { name, description, type, configuration, tags } = req.body;

    if (!name || !description || !type || !configuration) {
      return res.status(400).json({ 
        error: "name, description, type, and configuration are required" 
      });
    }

    const result = await aiModelManagementService.registerModel(userId, {
      name,
      description,
      type,
      configuration,
      tags
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error registering model:", error);
    res.status(500).json({ error: "Failed to register model" });
  }
});

router.patch("/models/:modelId/configuration", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const updates = req.body;

    const result = await aiModelManagementService.updateModelConfiguration(userId, modelId, updates);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error updating configuration:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update model configuration" });
  }
});

router.post("/models/:modelId/retire", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const result = await aiModelManagementService.retireModel(userId, modelId, reason);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error retiring model:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to retire model" });
  }
});

router.post("/models/:modelId/deploy", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const { version, environment, replicas, resourceAllocation } = req.body;

    if (!version || !environment || !replicas || !resourceAllocation) {
      return res.status(400).json({ 
        error: "version, environment, replicas, and resourceAllocation are required" 
      });
    }

    const result = await aiModelManagementService.deployModel(
      userId,
      modelId,
      version,
      environment,
      { replicas, resourceAllocation }
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error deploying model:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to deploy model" });
  }
});

router.post("/deployments/:deploymentId/stop", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { deploymentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const result = await aiModelManagementService.stopDeployment(userId, deploymentId, reason);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error stopping deployment:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to stop deployment" });
  }
});

router.post("/models/:modelId/retrain", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const { trainingDatasetId, validationDatasetId, hyperparameters, targetVersion } = req.body;

    if (!trainingDatasetId || !validationDatasetId) {
      return res.status(400).json({ 
        error: "trainingDatasetId and validationDatasetId are required" 
      });
    }

    const result = await aiModelManagementService.startRetraining(userId, modelId, {
      trainingDatasetId,
      validationDatasetId,
      hyperparameters,
      targetVersion
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error starting retraining:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to start retraining" });
  }
});

router.get("/training-jobs", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.query;

    const jobs = await aiModelManagementService.listTrainingJobs(
      userId,
      modelId as string | undefined
    );

    res.json({ jobs, total: jobs.length });
  } catch (error) {
    console.error("[AIModelManagement] Error listing training jobs:", error);
    res.status(500).json({ error: "Failed to list training jobs" });
  }
});

router.get("/training-jobs/:jobId", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { jobId } = req.params;

    const job = await aiModelManagementService.getTrainingJob(userId, jobId);
    if (!job) {
      return res.status(404).json({ error: "Training job not found" });
    }

    res.json({ job });
  } catch (error) {
    console.error("[AIModelManagement] Error fetching training job:", error);
    res.status(500).json({ error: "Failed to fetch training job" });
  }
});

router.post("/training-jobs/:jobId/cancel", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { jobId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const result = await aiModelManagementService.cancelTrainingJob(userId, jobId, reason);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error cancelling training job:", error);
    if (error.message?.includes("not found") || error.message?.includes("Cannot cancel")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to cancel training job" });
  }
});

router.get("/drift-alerts", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId, includeAcknowledged } = req.query;

    const alerts = await aiModelManagementService.getDriftAlerts(
      userId,
      modelId as string | undefined,
      includeAcknowledged === "true"
    );

    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[AIModelManagement] Error fetching drift alerts:", error);
    res.status(500).json({ error: "Failed to fetch drift alerts" });
  }
});

router.post("/drift-alerts/:alertId/acknowledge", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { alertId } = req.params;

    const alert = await aiModelManagementService.acknowledgeDriftAlert(userId, alertId);
    res.json({ alert, message: "Alert acknowledged successfully" });
  } catch (error: any) {
    console.error("[AIModelManagement] Error acknowledging alert:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.get("/enhanced-dashboard", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const dashboard = await aiModelManagementService.getEnhancedDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching enhanced dashboard:", error);
    res.status(500).json({ error: "Failed to fetch enhanced dashboard" });
  }
});

router.get("/drift-monitoring", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.query;

    const result = await aiModelManagementService.getDriftMonitoringConfigs(userId, modelId as string | undefined);
    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching drift monitoring configs:", error);
    res.status(500).json({ error: "Failed to fetch drift monitoring configs" });
  }
});

router.patch("/drift-monitoring/:configId", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { configId } = req.params;
    const updates = req.body;

    const result = await aiModelManagementService.updateDriftMonitoringConfig(userId, configId, updates);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error updating drift monitoring config:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update drift monitoring config" });
  }
});

router.post("/drift-monitoring/:configId/execute", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { configId } = req.params;

    const result = await aiModelManagementService.executeDriftCheck(userId, configId);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error executing drift check:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to execute drift check" });
  }
});

router.get("/drift-history/:modelId", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId } = req.params;
    const { limit } = req.query;

    const result = await aiModelManagementService.getDriftCheckHistory(
      userId,
      modelId,
      limit ? parseInt(limit as string, 10) : 20
    );
    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching drift history:", error);
    res.status(500).json({ error: "Failed to fetch drift history" });
  }
});

router.get("/ab-experiments", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId, status } = req.query;

    const result = await aiModelManagementService.listABExperiments(
      userId,
      modelId as string | undefined,
      status as ABExperiment["status"] | undefined
    );
    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error listing A/B experiments:", error);
    res.status(500).json({ error: "Failed to list A/B experiments" });
  }
});

router.get("/ab-experiments/:experimentId", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { experimentId } = req.params;

    const result = await aiModelManagementService.getABExperiment(userId, experimentId);
    if (!result) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching A/B experiment:", error);
    res.status(500).json({ error: "Failed to fetch A/B experiment" });
  }
});

router.post("/ab-experiments", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { name, description, modelId, variants, trafficAllocation, primaryMetric, secondaryMetrics, statisticalConfig } = req.body;

    if (!name || !modelId || !variants || !primaryMetric) {
      return res.status(400).json({
        error: "name, modelId, variants, and primaryMetric are required"
      });
    }

    const result = await aiModelManagementService.createABExperiment(userId, {
      name,
      description: description || "",
      modelId,
      variants,
      trafficAllocation: trafficAllocation || {},
      primaryMetric,
      secondaryMetrics: secondaryMetrics || [],
      statisticalConfig: statisticalConfig || {
        confidenceLevel: 0.95,
        minimumSampleSize: 1000,
        minimumDuration: "7d"
      }
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error creating A/B experiment:", error);
    res.status(500).json({ error: "Failed to create A/B experiment" });
  }
});

router.post("/ab-experiments/:experimentId/start", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { experimentId } = req.params;

    const result = await aiModelManagementService.startABExperiment(userId, experimentId);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error starting A/B experiment:", error);
    if (error.message?.includes("not found") || error.message?.includes("Cannot start")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to start A/B experiment" });
  }
});

router.post("/ab-experiments/:experimentId/stop", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { experimentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: "reason is required" });
    }

    const result = await aiModelManagementService.stopABExperiment(userId, experimentId, reason);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error stopping A/B experiment:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to stop A/B experiment" });
  }
});

router.post("/ab-experiments/:experimentId/analyze", requireRole("administrator", "data_analyst"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { experimentId } = req.params;

    const result = await aiModelManagementService.analyzeABExperiment(userId, experimentId);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error analyzing A/B experiment:", error);
    if (error.message?.includes("not found") || error.message?.includes("must have")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to analyze A/B experiment" });
  }
});

router.post("/ab-experiments/:experimentId/complete", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { experimentId } = req.params;
    const { winnerVariantId } = req.body;

    if (!winnerVariantId) {
      return res.status(400).json({ error: "winnerVariantId is required" });
    }

    const result = await aiModelManagementService.completeABExperiment(userId, experimentId, winnerVariantId);
    res.json(result);
  } catch (error: any) {
    console.error("[AIModelManagement] Error completing A/B experiment:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to complete A/B experiment" });
  }
});

router.get("/rule-actions", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = req.userId || "system";
    const { modelId, triggerType } = req.query;

    const result = await aiModelManagementService.getRuleEngineActions(
      userId,
      modelId as string | undefined,
      triggerType as any
    );
    res.json(result);
  } catch (error) {
    console.error("[AIModelManagement] Error fetching rule actions:", error);
    res.status(500).json({ error: "Failed to fetch rule engine actions" });
  }
});

export function setupAIModelManagementRoutes(app: any): void {
  app.use("/api/ai-model-management", router);
  console.log("[AIModelManagement] Routes registered at /api/ai-model-management/*");
  console.log("[AIModelManagement] Endpoints: /metadata, /dashboard, /enhanced-dashboard, /models, /training-jobs, /drift-alerts, /drift-monitoring, /ab-experiments, /rule-actions");
}

export default router;
