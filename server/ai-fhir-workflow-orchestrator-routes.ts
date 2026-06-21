import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import {
  aiFHIRWorkflowOrchestrator,
  FHIRWorkflowStatus,
  FHIRWorkflowExecutionStatus
} from "./services/ai-fhir-workflow-orchestrator";
import { comprehensiveAuditTrailService, AuditActionType, AuditActionCategory, AuditContext } from "./services/comprehensive-audit-trail-service";

const router = Router();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

const workflowUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  triggerType: z.enum(["manual", "scheduled", "fhir_event", "data_quality_threshold", "new_data_source", "api_webhook"]).optional(),
  steps: z.array(z.object({
    type: z.enum(["data_ingestion", "validation", "harmonization", "transformation", "enrichment", "quality_check", "report_generation", "notification", "condition", "parallel", "delay", "manual_review"]),
    name: z.string(),
    description: z.string().optional(),
    config: z.record(z.any()).optional(),
    dependencies: z.array(z.string()).optional(),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    estimatedDurationSeconds: z.number().optional()
  })).optional()
});

const executionTriggerSchema = z.object({
  triggerContext: z.record(z.any()).optional(),
  triggeredBy: z.string().optional()
});

async function logHIPAAAudit(
  operation: string, 
  action: AuditActionType,
  resourceType: string,
  resourceId: string | undefined,
  details: Record<string, unknown>, 
  req: Request,
  success: boolean = true
) {
  const context: AuditContext = {
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
  };

  try {
    await comprehensiveAuditTrailService.logAuditEntry("system", {
      who: {
        userId: "system",
        userRole: "system",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.requestId
      },
      what: {
        category: "configuration" as AuditActionCategory,
        action,
        resourceType,
        resourceId,
        description: `${operation}: ${JSON.stringify(details)}`
      },
      why: {
        reason: "AI FHIR Workflow Orchestrator operation",
        triggeredBy: "api_request",
        automatedAction: false
      },
      result: {
        success,
        statusCode: success ? 200 : 500
      },
      context,
      severity: success ? "info" : "error",
      tags: ["ai-fhir-workflow-orchestrator", "fhir", "data-governance"],
      phiAccessed: false,
      complianceFlags: ["NO-CDS", "HIPAA-COMPLIANT"]
    });
  } catch (error) {
    console.error("[AUDIT-ERROR]", error);
  }
}

router.get("/metadata", (req: Request, res: Response) => {
  logHIPAAAudit("GET_METADATA", "read", "Metadata", undefined, {}, req);
  const metadata = aiFHIRWorkflowOrchestrator.getServiceMetadata();
  res.json(metadata);
});

router.get("/dashboard", (req: Request, res: Response) => {
  logHIPAAAudit("GET_DASHBOARD", "read", "Dashboard", undefined, {}, req);
  const dashboard = aiFHIRWorkflowOrchestrator.getDashboard();
  res.json(dashboard);
});

router.get("/workflows", (req: Request, res: Response) => {
  logHIPAAAudit("LIST_WORKFLOWS", "read", "FHIRWorkflow", undefined, {}, req);
  
  const status = req.query.status as FHIRWorkflowStatus | undefined;
  const category = req.query.category as string | undefined;
  
  const workflows = aiFHIRWorkflowOrchestrator.listWorkflows({ status, category });
  res.json({
    workflows,
    count: workflows.length,
    noCdsCompliance: "AI FHIR Workflow list for operational purposes only. Not for clinical decision-making."
  });
});

router.get("/workflows/:workflowId", (req: Request, res: Response) => {
  logHIPAAAudit("GET_WORKFLOW", "read", "FHIRWorkflow", req.params.workflowId, {}, req);
  
  const workflow = aiFHIRWorkflowOrchestrator.getWorkflow(req.params.workflowId);
  if (!workflow) {
    return res.status(404).json({ error: "Workflow not found" });
  }
  res.json(workflow);
});

const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum([
    "data_ingestion", "validation", "harmonization", "transformation",
    "enrichment", "quality_check", "report_generation", "notification",
    "condition", "parallel", "delay", "manual_review"
  ]),
  order: z.number(),
  position: z.object({ x: z.number(), y: z.number() }),
  config: z.record(z.unknown()),
  dependencies: z.array(z.string()).optional(),
  estimatedDurationSeconds: z.number().optional()
});

const workflowTriggerSchema = z.object({
  type: z.enum(["manual", "scheduled", "fhir_event", "data_quality_threshold", "new_data_source", "api_webhook"]),
  config: z.record(z.unknown())
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string(),
  category: z.string().min(1),
  status: z.enum(["draft", "active", "paused", "archived"]).default("draft"),
  triggers: z.array(workflowTriggerSchema),
  steps: z.array(workflowStepSchema),
  connections: z.array(z.object({
    sourceStepId: z.string(),
    targetStepId: z.string(),
    label: z.string().optional()
  })),
  tags: z.array(z.string()).default([]),
  createdBy: z.string(),
  estimatedDurationMinutes: z.number().optional(),
  autoRetry: z.boolean().default(true),
  maxRetries: z.number().default(3),
  notifyOnComplete: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true)
});

router.post("/workflows", async (req: Request, res: Response) => {
  try {
    const validation = createWorkflowSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid workflow data", details: validation.error.errors });
    }

    const workflow = aiFHIRWorkflowOrchestrator.createWorkflow(validation.data as any);
    logHIPAAAudit("CREATE_WORKFLOW", "create", "FHIRWorkflow", workflow.id, {}, req);
    
    res.status(201).json({
      workflow,
      noCdsCompliance: "Workflow created for data governance purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[AIFHIRWorkflowOrchestrator] Error creating workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.patch("/workflows/:workflowId", async (req: Request, res: Response) => {
  try {
    const validation = workflowUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid update data", details: validation.error.errors });
    }

    const workflow = aiFHIRWorkflowOrchestrator.updateWorkflow(req.params.workflowId, validation.data);
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    logHIPAAAudit("UPDATE_WORKFLOW", "update", "FHIRWorkflow", workflow.id, validation.data, req);
    res.json(workflow);
  } catch (error) {
    console.error("[AIFHIRWorkflowOrchestrator] Error updating workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/workflows/:workflowId", (req: Request, res: Response) => {
  const deleted = aiFHIRWorkflowOrchestrator.deleteWorkflow(req.params.workflowId);
  if (!deleted) {
    return res.status(404).json({ error: "Workflow not found" });
  }
  
  logHIPAAAudit("DELETE_WORKFLOW", "delete", "FHIRWorkflow", req.params.workflowId, {}, req);
  res.json({ success: true, message: "Workflow deleted" });
});

router.get("/templates", (req: Request, res: Response) => {
  logHIPAAAudit("LIST_TEMPLATES", "read", "WorkflowTemplate", undefined, {}, req);
  const templates = aiFHIRWorkflowOrchestrator.getTemplates();
  res.json({
    templates,
    count: templates.length,
    noCdsCompliance: "Workflow templates for operational purposes only. Not for clinical decision-making."
  });
});

router.get("/templates/:templateId", (req: Request, res: Response) => {
  logHIPAAAudit("GET_TEMPLATE", "read", "WorkflowTemplate", req.params.templateId, {}, req);
  
  const template = aiFHIRWorkflowOrchestrator.getTemplate(req.params.templateId);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json(template);
});

router.post("/templates/:templateId/create-workflow", async (req: Request, res: Response) => {
  try {
    const { name, createdBy } = req.body;
    if (!name || !createdBy) {
      return res.status(400).json({ error: "name and createdBy are required" });
    }

    const workflow = aiFHIRWorkflowOrchestrator.createWorkflowFromTemplate(
      req.params.templateId,
      name,
      createdBy
    );

    if (!workflow) {
      return res.status(404).json({ error: "Template not found" });
    }

    logHIPAAAudit("CREATE_WORKFLOW_FROM_TEMPLATE", "create", "FHIRWorkflow", workflow.id, { templateId: req.params.templateId }, req);
    res.status(201).json({
      workflow,
      noCdsCompliance: "Workflow created from template for operational purposes only. Not for clinical decision-making."
    });
  } catch (error) {
    console.error("[AIFHIRWorkflowOrchestrator] Error creating workflow from template:", error);
    res.status(500).json({ error: "Failed to create workflow from template" });
  }
});

router.post("/workflows/:workflowId/trigger", async (req: Request, res: Response) => {
  try {
    const { triggeredBy, context } = req.body;
    if (!triggeredBy) {
      return res.status(400).json({ error: "triggeredBy is required" });
    }

    const execution = await aiFHIRWorkflowOrchestrator.triggerWorkflow(
      req.params.workflowId,
      triggeredBy,
      context || {}
    );

    if (!execution) {
      return res.status(404).json({ error: "Workflow not found or not active" });
    }

    logHIPAAAudit("TRIGGER_WORKFLOW", "execute", "FHIRWorkflowExecution", execution.id, { workflowId: req.params.workflowId }, req);
    res.status(201).json({
      execution,
      noCdsCompliance: execution.noCdsCompliance
    });
  } catch (error) {
    console.error("[AIFHIRWorkflowOrchestrator] Error triggering workflow:", error);
    res.status(500).json({ error: "Failed to trigger workflow" });
  }
});

router.get("/executions", (req: Request, res: Response) => {
  logHIPAAAudit("LIST_EXECUTIONS", "read", "FHIRWorkflowExecution", undefined, {}, req);
  
  const workflowId = req.query.workflowId as string | undefined;
  const status = req.query.status as FHIRWorkflowExecutionStatus | undefined;
  
  const executions = aiFHIRWorkflowOrchestrator.listExecutions({ workflowId, status });
  res.json({
    executions,
    count: executions.length,
    noCdsCompliance: "Workflow executions for operational monitoring only. Not for clinical decision-making."
  });
});

router.get("/executions/:executionId", (req: Request, res: Response) => {
  logHIPAAAudit("GET_EXECUTION", "read", "FHIRWorkflowExecution", req.params.executionId, {}, req);
  
  const execution = aiFHIRWorkflowOrchestrator.getExecution(req.params.executionId);
  if (!execution) {
    return res.status(404).json({ error: "Execution not found" });
  }
  res.json(execution);
});

router.post("/executions/:executionId/cancel", (req: Request, res: Response) => {
  const execution = aiFHIRWorkflowOrchestrator.cancelExecution(req.params.executionId);
  if (!execution) {
    return res.status(404).json({ error: "Execution not found or not running" });
  }
  
  logHIPAAAudit("CANCEL_EXECUTION", "update", "FHIRWorkflowExecution", req.params.executionId, { status: "cancelled" }, req);
  res.json({
    execution,
    message: "Execution cancelled",
    noCdsCompliance: execution.noCdsCompliance
  });
});

export default router;
