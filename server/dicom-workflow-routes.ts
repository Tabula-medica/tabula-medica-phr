import { Router, Request, Response } from "express";
import { dicomWorkflowAutomation } from "./services/dicom-workflow-automation-service";
import { z } from "zod";

const router = Router();

router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const stats = dicomWorkflowAutomation.getDashboardStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

router.get("/analysis-requests", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const status = req.query.status as string | undefined;
    const patientId = req.query.patientId as string | undefined;
    
    const requests = dicomWorkflowAutomation.getAIAnalysisRequests(userId, { status, patientId });
    res.json({ requests, total: requests.length });
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching analysis requests:", error);
    res.status(500).json({ error: "Failed to fetch analysis requests" });
  }
});

router.get("/analysis-requests/:requestId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { requestId } = req.params;
    
    const request = dicomWorkflowAutomation.getAIAnalysisRequest(requestId, userId);
    if (!request) {
      return res.status(404).json({ error: "Analysis request not found" });
    }
    res.json(request);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching analysis request:", error);
    res.status(500).json({ error: "Failed to fetch analysis request" });
  }
});

router.post("/trigger-analysis", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    
    const schema = z.object({
      studyId: z.string(),
      seriesId: z.string().optional(),
      patientId: z.string(),
      modality: z.string().optional(),
      description: z.string().optional(),
      facility: z.string().optional(),
    });
    
    const data = schema.parse(req.body);
    
    const request = dicomWorkflowAutomation.triggerAIAnalysisOnIngestion(
      data.studyId,
      data.seriesId,
      data.patientId,
      { modality: data.modality, description: data.description, facility: data.facility },
      userId
    );
    
    if (!request) {
      return res.status(400).json({ 
        error: "No matching workflows found for the provided study parameters",
        message: "Create a workflow configuration that matches the study modality/description to enable auto-analysis"
      });
    }
    
    res.status(201).json(request);
  } catch (error: any) {
    console.error("[DICOMWorkflowRoutes] Error triggering analysis:", error);
    res.status(400).json({ error: error.message || "Failed to trigger analysis" });
  }
});

router.get("/alerts", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const status = req.query.status as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    
    const alerts = dicomWorkflowAutomation.getClinicianAlerts(userId, { status, riskLevel });
    res.json({ alerts, total: alerts.length });
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.patch("/alerts/:alertId/acknowledge", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { alertId } = req.params;
    
    const alert = dicomWorkflowAutomation.acknowledgeAlert(alertId, userId);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error acknowledging alert:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.patch("/alerts/:alertId/resolve", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { alertId } = req.params;
    const { resolution } = req.body;
    
    const alert = dicomWorkflowAutomation.resolveAlert(alertId, userId, resolution);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error resolving alert:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

router.post("/alerts/:alertId/escalate", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { alertId } = req.params;
    
    const schema = z.object({
      escalateTo: z.array(z.string()).min(1),
    });
    
    const { escalateTo } = schema.parse(req.body);
    
    const alert = dicomWorkflowAutomation.escalateAlert(alertId, userId, escalateTo);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error: any) {
    console.error("[DICOMWorkflowRoutes] Error escalating alert:", error);
    res.status(400).json({ error: error.message || "Failed to escalate alert" });
  }
});

router.get("/pacs-sync-configs", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const configs = dicomWorkflowAutomation.getPACSAutoSyncConfigs(userId);
    res.json({ configs, total: configs.length });
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching PACS sync configs:", error);
    res.status(500).json({ error: "Failed to fetch PACS sync configurations" });
  }
});

router.get("/pacs-sync-configs/:configId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { configId } = req.params;
    
    const config = dicomWorkflowAutomation.getPACSAutoSyncConfig(configId, userId);
    if (!config) {
      return res.status(404).json({ error: "PACS sync configuration not found" });
    }
    res.json(config);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching PACS sync config:", error);
    res.status(500).json({ error: "Failed to fetch PACS sync configuration" });
  }
});

router.post("/pacs-sync-configs", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    
    const schema = z.object({
      pacsConnectionId: z.string(),
      pacsName: z.string(),
      enabled: z.boolean().default(true),
      syncFrequency: z.enum(["realtime", "hourly", "daily", "weekly"]),
      modalityFilters: z.array(z.string()).default([]),
      facilityFilters: z.array(z.string()).default([]),
      bodyPartFilters: z.array(z.string()).default([]),
      priorityModalities: z.array(z.string()).default([]),
      autoAIAnalysis: z.boolean().default(true),
      analysisTypes: z.array(z.enum(["deterioration_risk", "drug_interaction", "anomaly_detection", "measurement", "comparison"])).default(["deterioration_risk"]),
      notifyOnHighRisk: z.boolean().default(true),
      clinicianNotificationList: z.array(z.string()).default([]),
    });
    
    const data = schema.parse(req.body);
    const config = dicomWorkflowAutomation.createPACSAutoSyncConfig(data, userId);
    res.status(201).json(config);
  } catch (error: any) {
    console.error("[DICOMWorkflowRoutes] Error creating PACS sync config:", error);
    res.status(400).json({ error: error.message || "Failed to create PACS sync configuration" });
  }
});

router.patch("/pacs-sync-configs/:configId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { configId } = req.params;
    
    const config = dicomWorkflowAutomation.updatePACSAutoSyncConfig(configId, req.body, userId);
    if (!config) {
      return res.status(404).json({ error: "PACS sync configuration not found" });
    }
    res.json(config);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error updating PACS sync config:", error);
    res.status(500).json({ error: "Failed to update PACS sync configuration" });
  }
});

router.delete("/pacs-sync-configs/:configId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { configId } = req.params;
    
    const deleted = dicomWorkflowAutomation.deletePACSAutoSyncConfig(configId, userId);
    if (!deleted) {
      return res.status(404).json({ error: "PACS sync configuration not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error deleting PACS sync config:", error);
    res.status(500).json({ error: "Failed to delete PACS sync configuration" });
  }
});

router.post("/pacs-sync-configs/:configId/sync", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { configId } = req.params;
    
    const result = dicomWorkflowAutomation.triggerManualSync(configId, userId);
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    res.json(result);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error triggering manual sync:", error);
    res.status(500).json({ error: "Failed to trigger manual sync" });
  }
});

router.get("/workflows", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const workflows = dicomWorkflowAutomation.getWorkflowConfigurations(userId);
    res.json({ workflows, total: workflows.length });
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error fetching workflows:", error);
    res.status(500).json({ error: "Failed to fetch workflow configurations" });
  }
});

router.post("/workflows", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    
    const schema = z.object({
      name: z.string(),
      description: z.string(),
      enabled: z.boolean().default(true),
      triggerType: z.enum(["ingestion", "annotation", "manual", "scheduled"]),
      triggerConditions: z.array(z.object({
        field: z.string(),
        operator: z.enum(["equals", "contains", "greater_than", "less_than", "in", "not_in"]),
        value: z.union([z.string(), z.array(z.string()), z.number()]),
      })),
      actions: z.array(z.object({
        type: z.enum(["ai_analysis", "notification", "auto_sync", "escalation", "report_generation"]),
        config: z.record(z.any()),
        order: z.number(),
      })),
      priority: z.enum(["low", "normal", "high"]).default("normal"),
    });
    
    const data = schema.parse(req.body);
    const workflow = dicomWorkflowAutomation.createWorkflowConfiguration({ ...data, createdBy: userId }, userId);
    res.status(201).json(workflow);
  } catch (error: any) {
    console.error("[DICOMWorkflowRoutes] Error creating workflow:", error);
    res.status(400).json({ error: error.message || "Failed to create workflow configuration" });
  }
});

router.patch("/workflows/:workflowId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { workflowId } = req.params;
    
    const workflow = dicomWorkflowAutomation.updateWorkflowConfiguration(workflowId, req.body, userId);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow configuration not found" });
    }
    res.json(workflow);
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error updating workflow:", error);
    res.status(500).json({ error: "Failed to update workflow configuration" });
  }
});

router.delete("/workflows/:workflowId", (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "anonymous";
    const { workflowId } = req.params;
    
    const deleted = dicomWorkflowAutomation.deleteWorkflowConfiguration(workflowId, userId);
    if (!deleted) {
      return res.status(404).json({ error: "Workflow configuration not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("[DICOMWorkflowRoutes] Error deleting workflow:", error);
    res.status(500).json({ error: "Failed to delete workflow configuration" });
  }
});

export function registerDICOMWorkflowRoutes(app: any): void {
  app.use("/api/dicom-workflow", router);
  console.log("[DICOMWorkflowRoutes] Routes registered at /api/dicom-workflow/*");
  console.log("[DICOMWorkflowRoutes] Endpoints: /dashboard, /analysis-requests, /alerts, /pacs-sync-configs, /workflows");
}
