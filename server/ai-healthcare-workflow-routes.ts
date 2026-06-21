import { Router, Request, Response } from "express";
import { aiHealthcareWorkflowAutomationService, FHIRResourceType, EventType, AlertSeverity } from "./services/ai-healthcare-workflow-automation";
import { z } from "zod";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][WORKFLOW-AUTOMATION] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Workflow automation audit log. Operations are for data governance and care coordination only, NOT clinical decision-making."
  })}`);
}

router.get("/dashboard", (req: Request, res: Response) => {
  logHIPAAAudit("GET_WORKFLOW_DASHBOARD", {}, req);

  try {
    const dashboard = aiHealthcareWorkflowAutomationService.getDashboard();
    res.json({
      dashboard,
      noCdsCompliance: "Workflow automation dashboard for operational efficiency. NOT clinical decision support."
    });
  } catch (error) {
    console.error("Error getting workflow dashboard:", error);
    res.status(500).json({ error: "Failed to get workflow dashboard" });
  }
});

router.get("/events", (req: Request, res: Response) => {
  logHIPAAAudit("GET_FHIR_EVENTS", {}, req);

  try {
    const events = aiHealthcareWorkflowAutomationService.getEvents();
    res.json({
      events,
      count: events.length,
      noCdsCompliance: "FHIR event log for operational tracking. NOT clinical data."
    });
  } catch (error) {
    console.error("Error getting events:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
});

const ProcessEventSchema = z.object({
  eventType: z.enum(["resource_created", "resource_updated", "resource_deleted", "batch_import", "sync_completed"]),
  resourceType: z.enum(["Patient", "Observation", "MedicationRequest", "Condition", "AllergyIntolerance", "Procedure", "Encounter", "DiagnosticReport", "Immunization", "CarePlan"]),
  resourceId: z.string(),
  patientId: z.string(),
  sourceSystem: z.string(),
  changeDescription: z.string(),
  metadata: z.record(z.unknown()).optional()
});

router.post("/events/process", async (req: Request, res: Response) => {
  logHIPAAAudit("PROCESS_FHIR_EVENT", { body: req.body }, req);

  try {
    const validation = ProcessEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const event = {
      ...validation.data,
      timestamp: new Date(),
      metadata: validation.data.metadata || {}
    };

    const result = await aiHealthcareWorkflowAutomationService.processFHIREvent(event);
    
    res.json({
      ...result,
      noCdsCompliance: "FHIR event processed for workflow automation. NOT clinical decision support."
    });
  } catch (error) {
    console.error("Error processing event:", error);
    res.status(500).json({ error: "Failed to process FHIR event" });
  }
});

router.get("/risk-assessments", (req: Request, res: Response) => {
  logHIPAAAudit("GET_RISK_ASSESSMENTS", {}, req);

  try {
    const assessments = aiHealthcareWorkflowAutomationService.getRiskAssessments();
    res.json({
      assessments,
      count: assessments.length,
      noCdsCompliance: "Risk assessments for care coordination. NOT clinical decision support."
    });
  } catch (error) {
    console.error("Error getting risk assessments:", error);
    res.status(500).json({ error: "Failed to get risk assessments" });
  }
});

router.get("/drug-alerts", (req: Request, res: Response) => {
  logHIPAAAudit("GET_DRUG_ALERTS", {}, req);

  try {
    const alerts = aiHealthcareWorkflowAutomationService.getDrugAlerts();
    res.json({
      alerts,
      count: alerts.length,
      noCdsCompliance: "Drug data alerts for data quality. NOT clinical advice."
    });
  } catch (error) {
    console.error("Error getting drug alerts:", error);
    res.status(500).json({ error: "Failed to get drug alerts" });
  }
});

router.get("/coordination-suggestions", (req: Request, res: Response) => {
  logHIPAAAudit("GET_COORDINATION_SUGGESTIONS", {}, req);

  try {
    const suggestions = aiHealthcareWorkflowAutomationService.getCoordinationSuggestions();
    res.json({
      suggestions,
      count: suggestions.length,
      noCdsCompliance: "Care coordination suggestions. NOT clinical treatment recommendations."
    });
  } catch (error) {
    console.error("Error getting coordination suggestions:", error);
    res.status(500).json({ error: "Failed to get coordination suggestions" });
  }
});

router.get("/remediation-tasks", (req: Request, res: Response) => {
  logHIPAAAudit("GET_REMEDIATION_TASKS", {}, req);

  try {
    const tasks = aiHealthcareWorkflowAutomationService.getRemediationTasks();
    res.json({
      tasks,
      count: tasks.length,
      noCdsCompliance: "Data quality remediation tasks. NOT clinical decision support."
    });
  } catch (error) {
    console.error("Error getting remediation tasks:", error);
    res.status(500).json({ error: "Failed to get remediation tasks" });
  }
});

const GenerateRemediationSchema = z.object({
  alertIds: z.array(z.string()).min(1)
});

router.post("/remediation-tasks/generate", async (req: Request, res: Response) => {
  logHIPAAAudit("GENERATE_REMEDIATION_TASK", { alertIds: req.body.alertIds }, req);

  try {
    const validation = GenerateRemediationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const task = await aiHealthcareWorkflowAutomationService.generateRemediationTaskFromAlerts(validation.data.alertIds);
    
    res.json({
      task,
      noCdsCompliance: task.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating remediation task:", error);
    res.status(500).json({ error: "Failed to generate remediation task" });
  }
});

const UpdateTaskSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "escalated"])
});

router.patch("/remediation-tasks/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  logHIPAAAudit("UPDATE_REMEDIATION_TASK", { taskId, status: req.body.status }, req);

  try {
    const validation = UpdateTaskSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const success = await aiHealthcareWorkflowAutomationService.updateTaskStatus(taskId, validation.data.status);
    
    if (!success) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      success: true,
      noCdsCompliance: "Task status update for workflow management."
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.get("/security-recommendations", (req: Request, res: Response) => {
  logHIPAAAudit("GET_SECURITY_RECOMMENDATIONS", {}, req);

  try {
    const recommendations = aiHealthcareWorkflowAutomationService.getSecurityRecommendations();
    res.json({
      recommendations,
      count: recommendations.length,
      noCdsCompliance: "Security configuration recommendations. NOT clinical data."
    });
  } catch (error) {
    console.error("Error getting security recommendations:", error);
    res.status(500).json({ error: "Failed to get security recommendations" });
  }
});

const GenerateSecRecSchema = z.object({
  findingId: z.string(),
  findingTitle: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["access_control", "encryption", "audit_logging", "consent_management", "network_security", "data_masking", "authentication"])
});

router.post("/security-recommendations/generate", async (req: Request, res: Response) => {
  logHIPAAAudit("GENERATE_SECURITY_RECOMMENDATION", req.body, req);

  try {
    const validation = GenerateSecRecSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const rec = await aiHealthcareWorkflowAutomationService.generateSecurityRecommendation(
      validation.data.findingId,
      validation.data.findingTitle,
      validation.data.severity,
      validation.data.category
    );
    
    res.json({
      recommendation: rec,
      noCdsCompliance: rec.noCdsCompliance
    });
  } catch (error) {
    console.error("Error generating security recommendation:", error);
    res.status(500).json({ error: "Failed to generate security recommendation" });
  }
});

const UpdateSecRecSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "implemented", "rolled_back"])
});

router.patch("/security-recommendations/:recId", async (req: Request, res: Response) => {
  const { recId } = req.params;
  logHIPAAAudit("UPDATE_SECURITY_RECOMMENDATION", { recId, status: req.body.status }, req);

  try {
    const validation = UpdateSecRecSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request data", details: validation.error.errors });
    }

    const success = await aiHealthcareWorkflowAutomationService.updateSecurityRecommendationStatus(recId, validation.data.status);
    
    if (!success) {
      return res.status(404).json({ error: "Recommendation not found" });
    }

    res.json({
      success: true,
      noCdsCompliance: "Security recommendation status update."
    });
  } catch (error) {
    console.error("Error updating security recommendation:", error);
    res.status(500).json({ error: "Failed to update security recommendation" });
  }
});

export default router;
