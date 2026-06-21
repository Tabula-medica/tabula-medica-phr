import { Router, Request, Response } from "express";
import { fhirSyncRulesService } from "./services/fhir-sync-rules-service";

const router = Router();

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const rules = await fhirSyncRulesService.getAllRules();
    res.json({ rules });
  } catch (error) {
    console.error("Error fetching sync rules:", error);
    res.status(500).json({ error: "Failed to fetch sync rules" });
  }
});

router.get("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await fhirSyncRulesService.getRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ rule });
  } catch (error) {
    console.error("Error fetching sync rule:", error);
    res.status(500).json({ error: "Failed to fetch sync rule" });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const rule = await fhirSyncRulesService.createRule(req.body);
    res.status(201).json({ rule });
  } catch (error) {
    console.error("Error creating sync rule:", error);
    res.status(500).json({ error: "Failed to create sync rule" });
  }
});

router.patch("/rules/:id", async (req: Request, res: Response) => {
  try {
    const rule = await fhirSyncRulesService.updateRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ rule });
  } catch (error) {
    console.error("Error updating sync rule:", error);
    res.status(500).json({ error: "Failed to update sync rule" });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await fhirSyncRulesService.deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting sync rule:", error);
    res.status(500).json({ error: "Failed to delete sync rule" });
  }
});

router.post("/rules/:id/toggle", async (req: Request, res: Response) => {
  try {
    const rule = await fhirSyncRulesService.toggleRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }
    res.json({ rule });
  } catch (error) {
    console.error("Error toggling sync rule:", error);
    res.status(500).json({ error: "Failed to toggle sync rule" });
  }
});

router.post("/rules/:id/execute", async (req: Request, res: Response) => {
  try {
    const { triggerEvent = "manual", triggerData } = req.body;
    const execution = await fhirSyncRulesService.executeRule(
      req.params.id,
      triggerEvent,
      triggerData
    );
    res.json({ execution });
  } catch (error) {
    console.error("Error executing sync rule:", error);
    res.status(500).json({ error: "Failed to execute sync rule" });
  }
});

router.get("/executions", async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.query;
    const executions = await fhirSyncRulesService.getExecutions(ruleId as string | undefined);
    res.json({ executions });
  } catch (error) {
    console.error("Error fetching executions:", error);
    res.status(500).json({ error: "Failed to fetch executions" });
  }
});

router.get("/workflows", async (req: Request, res: Response) => {
  try {
    const workflows = await fhirSyncRulesService.getAllConflictWorkflows();
    res.json({ workflows });
  } catch (error) {
    console.error("Error fetching conflict workflows:", error);
    res.status(500).json({ error: "Failed to fetch conflict workflows" });
  }
});

router.get("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await fhirSyncRulesService.getConflictWorkflow(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json({ workflow });
  } catch (error) {
    console.error("Error fetching conflict workflow:", error);
    res.status(500).json({ error: "Failed to fetch conflict workflow" });
  }
});

router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const workflow = await fhirSyncRulesService.createConflictWorkflow(req.body);
    res.status(201).json({ workflow });
  } catch (error) {
    console.error("Error creating conflict workflow:", error);
    res.status(500).json({ error: "Failed to create conflict workflow" });
  }
});

router.patch("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const workflow = await fhirSyncRulesService.updateConflictWorkflow(req.params.id, req.body);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json({ workflow });
  } catch (error) {
    console.error("Error updating conflict workflow:", error);
    res.status(500).json({ error: "Failed to update conflict workflow" });
  }
});

router.delete("/workflows/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await fhirSyncRulesService.deleteConflictWorkflow(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting conflict workflow:", error);
    res.status(500).json({ error: "Failed to delete conflict workflow" });
  }
});

router.get("/conflicts", async (req: Request, res: Response) => {
  try {
    const { executionId, status } = req.query;
    const conflicts = await fhirSyncRulesService.getConflictRecords(
      executionId as string | undefined,
      status as string | undefined
    );
    res.json({ conflicts });
  } catch (error) {
    console.error("Error fetching conflicts:", error);
    res.status(500).json({ error: "Failed to fetch conflicts" });
  }
});

router.post("/conflicts/:id/resolve", async (req: Request, res: Response) => {
  try {
    const { chosenVersion, mergedData, notes, resolvedBy = "admin" } = req.body;
    const conflict = await fhirSyncRulesService.resolveConflict(
      req.params.id,
      { chosenVersion, mergedData, notes },
      resolvedBy
    );
    if (!conflict) {
      return res.status(404).json({ error: "Conflict not found" });
    }
    res.json({ conflict });
  } catch (error) {
    console.error("Error resolving conflict:", error);
    res.status(500).json({ error: "Failed to resolve conflict" });
  }
});

router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const statistics = await fhirSyncRulesService.getSyncRuleStatistics();
    res.json({ statistics });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

router.get("/endpoints", async (req: Request, res: Response) => {
  try {
    const endpoints = fhirSyncRulesService.getAvailableEndpoints();
    res.json({ endpoints });
  } catch (error) {
    console.error("Error fetching endpoints:", error);
    res.status(500).json({ error: "Failed to fetch endpoints" });
  }
});

router.post("/test-conditions", async (req: Request, res: Response) => {
  try {
    const { conditions, resource } = req.body;
    const result = fhirSyncRulesService.evaluateTriggerConditions(conditions, resource);
    res.json({ matched: result });
  } catch (error) {
    console.error("Error testing conditions:", error);
    res.status(500).json({ error: "Failed to test conditions" });
  }
});

router.post("/test-transformations", async (req: Request, res: Response) => {
  try {
    const { transformations, data } = req.body;
    const result = await fhirSyncRulesService.applyTransformations(transformations, data);
    res.json({ transformedData: result });
  } catch (error) {
    console.error("Error testing transformations:", error);
    res.status(500).json({ error: "Failed to test transformations" });
  }
});

export default router;
