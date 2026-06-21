import { Router, Request, Response } from "express";
import {
  getAllWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflow,
  executeWorkflow,
  getWorkflowExecutions,
  getTriggerTemplates,
  getActionTemplates,
  getWorkflowStatistics,
  generateWorkflowFromDescription,
  enhanceWorkflow,
  suggestWorkflowImprovements,
  Workflow,
  getWorkflowMetrics,
  getAllWorkflowMetrics,
  getResourceUtilization,
  getExecutionHistory,
  getExecutionTrendLast7Days,
  generateBottleneckInsights,
  getCachedBottleneckInsights,
  getAnalyticsDashboard,
} from "./services/ai-fhir-workflow-builder-service";

const router = Router();

router.get("/workflows", (_req: Request, res: Response) => {
  try {
    const workflows = getAllWorkflows();
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflows" });
  }
});

router.get("/workflows/:id", (req: Request, res: Response) => {
  try {
    const workflow = getWorkflowById(req.params.id);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

router.post("/workflows", (req: Request, res: Response) => {
  try {
    const { name, description, isEnabled, triggers, actions, tags } = req.body;
    
    if (!name) {
      res.status(400).json({ error: "Workflow name is required" });
      return;
    }

    const workflow = createWorkflow({
      name,
      description: description || "",
      isEnabled: isEnabled ?? true,
      version: 1,
      triggers: triggers || [],
      actions: actions || [],
      tags: tags || [],
    });

    res.status(201).json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.patch("/workflows/:id", (req: Request, res: Response) => {
  try {
    const workflow = updateWorkflow(req.params.id, req.body);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/workflows/:id", (req: Request, res: Response) => {
  try {
    const deleted = deleteWorkflow(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

router.post("/workflows/:id/toggle", (req: Request, res: Response) => {
  try {
    const workflow = toggleWorkflow(req.params.id);
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle workflow" });
  }
});

router.post("/workflows/:id/execute", (req: Request, res: Response) => {
  try {
    const { triggerData } = req.body;
    const execution = executeWorkflow(req.params.id, triggerData);
    res.json(execution);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to execute workflow" 
    });
  }
});

router.get("/executions", (req: Request, res: Response) => {
  try {
    const { workflowId } = req.query;
    const executions = getWorkflowExecutions(workflowId as string | undefined);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: "Failed to get executions" });
  }
});

router.get("/templates/triggers", (_req: Request, res: Response) => {
  try {
    const templates = getTriggerTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to get trigger templates" });
  }
});

router.get("/templates/actions", (_req: Request, res: Response) => {
  try {
    const templates = getActionTemplates();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Failed to get action templates" });
  }
});

router.get("/statistics", (_req: Request, res: Response) => {
  try {
    const stats = getWorkflowStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

router.post("/ai/generate", async (req: Request, res: Response) => {
  try {
    const { description, context } = req.body;
    
    if (!description) {
      res.status(400).json({ error: "Description is required" });
      return;
    }

    const suggestion = await generateWorkflowFromDescription(description, context);
    res.json(suggestion);
  } catch (error) {
    console.error("AI generation error:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to generate workflow" 
    });
  }
});

router.post("/ai/enhance", async (req: Request, res: Response) => {
  try {
    const { workflow, enhancementRequest } = req.body;
    
    if (!workflow || !enhancementRequest) {
      res.status(400).json({ error: "Workflow and enhancement request are required" });
      return;
    }

    const suggestion = await enhanceWorkflow(workflow, enhancementRequest);
    res.json(suggestion);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to enhance workflow" 
    });
  }
});

router.post("/ai/suggestions", async (req: Request, res: Response) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      res.status(400).json({ error: "Workflow is required" });
      return;
    }

    const suggestions = await suggestWorkflowImprovements(workflow as Workflow);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to get suggestions" 
    });
  }
});

router.get("/analytics/dashboard", (_req: Request, res: Response) => {
  try {
    const dashboard = getAnalyticsDashboard();
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to get analytics dashboard" });
  }
});

router.get("/analytics/metrics", (_req: Request, res: Response) => {
  try {
    const metrics = getAllWorkflowMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflow metrics" });
  }
});

router.get("/analytics/metrics/:workflowId", (req: Request, res: Response) => {
  try {
    const metrics = getWorkflowMetrics(req.params.workflowId);
    if (!metrics) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: "Failed to get workflow metrics" });
  }
});

router.get("/analytics/resource-utilization", (_req: Request, res: Response) => {
  try {
    const utilization = getResourceUtilization();
    res.json(utilization);
  } catch (error) {
    res.status(500).json({ error: "Failed to get resource utilization" });
  }
});

router.get("/analytics/execution-history", (req: Request, res: Response) => {
  try {
    const { workflowId, status, startDate, endDate, limit } = req.query;
    const history = getExecutionHistory({
      workflowId: workflowId as string | undefined,
      status: status as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to get execution history" });
  }
});

router.get("/analytics/execution-trend", (_req: Request, res: Response) => {
  try {
    const trend = getExecutionTrendLast7Days();
    res.json(trend);
  } catch (error) {
    res.status(500).json({ error: "Failed to get execution trend" });
  }
});

router.get("/analytics/insights", (_req: Request, res: Response) => {
  try {
    const insights = getCachedBottleneckInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to get bottleneck insights" });
  }
});

router.post("/analytics/insights/generate", async (_req: Request, res: Response) => {
  try {
    const insights = await generateBottleneckInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to generate insights" 
    });
  }
});

export function registerFHIRWorkflowBuilderRoutes(app: Router) {
  app.use("/api/fhir-workflow-builder", router);
}

export default router;
