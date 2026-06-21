import { Router, Request, Response } from "express";
import {
  getMonitoringDashboard,
  getExecutionDetails,
  getExecutionStepVisualization,
  getResourceFlowChart,
  createAlert,
  acknowledgeAlert,
  getActiveAlerts,
  getAlertsByWorkflow,
  analyzeExecutionWithAI,
  simulateStepProgress,
  getServiceMetadata,
} from "./services/workflow-monitoring-service";

const router = Router();

router.get("/dashboard", (_req: Request, res: Response) => {
  try {
    const dashboard = getMonitoringDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch monitoring dashboard" });
  }
});

router.get("/executions/:id", (req: Request, res: Response) => {
  try {
    const execution = getExecutionDetails(req.params.id);
    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }
    res.json(execution);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Execution details error:", error);
    res.status(500).json({ error: "Failed to fetch execution details" });
  }
});

router.get("/executions/:id/visualization", (req: Request, res: Response) => {
  try {
    const visualization = getExecutionStepVisualization(req.params.id);
    if (!visualization) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }
    res.json(visualization);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Visualization error:", error);
    res.status(500).json({ error: "Failed to fetch step visualization" });
  }
});

router.get("/executions/:id/resource-flow", (req: Request, res: Response) => {
  try {
    const flowChart = getResourceFlowChart(req.params.id);
    if (!flowChart) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }
    res.json(flowChart);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Resource flow error:", error);
    res.status(500).json({ error: "Failed to fetch resource flow chart" });
  }
});

router.post("/executions/:id/analyze", async (req: Request, res: Response) => {
  try {
    const analysis = await analyzeExecutionWithAI(req.params.id);
    if (!analysis) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }
    res.json(analysis);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze execution" });
  }
});

router.post("/executions/:id/simulate-progress", (req: Request, res: Response) => {
  try {
    const { stepId, progress } = req.body;
    if (!stepId || progress === undefined) {
      res.status(400).json({ error: "stepId and progress are required" });
      return;
    }
    const success = simulateStepProgress(req.params.id, stepId, progress);
    if (!success) {
      res.status(404).json({ error: "Execution or step not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Simulate progress error:", error);
    res.status(500).json({ error: "Failed to simulate progress" });
  }
});

router.get("/alerts", (_req: Request, res: Response) => {
  try {
    const alerts = getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Active alerts error:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.get("/alerts/workflow/:workflowId", (req: Request, res: Response) => {
  try {
    const alerts = getAlertsByWorkflow(req.params.workflowId);
    res.json(alerts);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Workflow alerts error:", error);
    res.status(500).json({ error: "Failed to fetch workflow alerts" });
  }
});

router.post("/alerts", (req: Request, res: Response) => {
  try {
    const { executionId, workflowId, workflowName, type, severity, stepId, stepName, message, details } = req.body;
    
    if (!executionId || !workflowId || !workflowName || !type || !severity || !message) {
      res.status(400).json({ error: "Missing required alert fields" });
      return;
    }

    const alert = createAlert({
      executionId,
      workflowId,
      workflowName,
      type,
      severity,
      stepId,
      stepName,
      message,
      details
    });
    res.status(201).json(alert);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Create alert error:", error);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.post("/alerts/:id/acknowledge", (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }
    const alert = acknowledgeAlert(req.params.id, userId);
    if (!alert) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json(alert);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Acknowledge alert error:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.get("/metadata", (_req: Request, res: Response) => {
  try {
    const metadata = getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[WorkflowMonitoringRoutes] Metadata error:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

export default router;
