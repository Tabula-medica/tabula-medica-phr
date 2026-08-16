import { Router, Response } from "express";
import { z } from "zod";
import { 
  clinicalWorkflowOrchestrator,
  WorkflowStatus,
  WorkflowInstanceStatus,
  WorkflowTriggerType,
  StepStatus,
  TaskPriority,
  NotificationChannel
} from "./services/clinical-workflow-orchestrator";
import { requireRole, extractUserContext, AuthorizedRequest } from "./middleware/rbac-authorization";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

router.use(extractUserContext);

router.get("/metadata", async (req: AuthorizedRequest, res: Response) => {
  try {
    const metadata = clinicalWorkflowOrchestrator.getServiceMetadata();
    res.json(metadata);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error fetching metadata:", error);
    res.status(500).json({ error: "Failed to fetch service metadata" });
  }
});

router.get("/dashboard", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const dashboard = await clinicalWorkflowOrchestrator.getDashboard(userId);
    res.json(dashboard);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

const workflowStatusSchema = z.enum(["draft", "active", "paused", "archived"]);

router.get("/workflows", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { status, category } = req.query;

    const filters: { status?: WorkflowStatus; category?: string } = {};
    if (status) filters.status = status as WorkflowStatus;
    if (category) filters.category = category as string;

    const result = await clinicalWorkflowOrchestrator.listWorkflows(userId, filters);
    res.json(result);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error listing workflows:", error);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

router.get("/workflows/:workflowId", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const workflow = await clinicalWorkflowOrchestrator.getWorkflow(userId, req.params.workflowId);
    
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error fetching workflow:", error);
    res.status(500).json({ error: "Failed to fetch workflow" });
  }
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  category: z.string().min(1).max(100),
  status: workflowStatusSchema.default("draft"),
  triggers: z.array(z.object({
    type: z.enum(["clinical_rule", "ai_insight", "schedule", "manual", "fhir_event", "alert_threshold"]),
    config: z.record(z.any())
  })),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    type: z.enum(["task", "notification", "approval", "condition", "parallel", "delay", "integration"]),
    order: z.number(),
    config: z.record(z.any()),
    dependencies: z.array(z.string()).optional()
  })),
  tags: z.array(z.string()).default([]),
  estimatedDurationMinutes: z.number().optional(),
  autoRetry: z.boolean().default(false),
  maxRetries: z.number().default(0),
  notifyOnComplete: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true),
  createdBy: z.string()
});

router.post("/workflows", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = createWorkflowSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid workflow data", details: validation.error.errors });
    }

    const workflow = await clinicalWorkflowOrchestrator.createWorkflow(userId, validation.data as any);
    res.status(201).json(workflow);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error creating workflow:", error);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.patch("/workflows/:workflowId", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const workflow = await clinicalWorkflowOrchestrator.updateWorkflow(userId, req.params.workflowId, req.body);
    
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error updating workflow:", error);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.post("/workflows/:workflowId/publish", requireRole("administrator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const workflow = await clinicalWorkflowOrchestrator.publishWorkflow(userId, req.params.workflowId);
    
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }
    
    res.json(workflow);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error publishing workflow:", error);
    res.status(500).json({ error: "Failed to publish workflow" });
  }
});

const triggerWorkflowSchema = z.object({
  triggerType: z.enum(["clinical_rule", "ai_insight", "schedule", "manual", "fhir_event", "alert_threshold"]),
  context: z.record(z.any())
});

router.post("/workflows/:workflowId/trigger", requireRole("administrator", "clinician"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = triggerWorkflowSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid trigger data", details: validation.error.errors });
    }

    const instance = await clinicalWorkflowOrchestrator.triggerWorkflow(
      userId,
      req.params.workflowId,
      validation.data.triggerType as WorkflowTriggerType,
      validation.data.context
    );
    
    res.status(201).json(instance);
  } catch (error: any) {
    console.error("[WorkflowOrchestrator] Error triggering workflow:", error);
    res.status(500).json({ error: error.message || "Failed to trigger workflow" });
  }
});

const instanceStatusSchema = z.enum(["pending", "running", "completed", "cancelled", "failed", "on_hold"]);

router.get("/instances", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { workflowId, status, patientId } = req.query;

    const filters: { 
      workflowId?: string; 
      status?: WorkflowInstanceStatus;
      patientId?: string;
    } = {};
    
    if (workflowId) filters.workflowId = workflowId as string;
    if (status) filters.status = status as WorkflowInstanceStatus;
    if (patientId) filters.patientId = patientId as string;

    const result = await clinicalWorkflowOrchestrator.listInstances(userId, filters);
    res.json(result);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error listing instances:", error);
    res.status(500).json({ error: "Failed to list instances" });
  }
});

router.get("/instances/:instanceId", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const instance = await clinicalWorkflowOrchestrator.getInstance(userId, req.params.instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: "Instance not found" });
    }
    
    res.json(instance);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error fetching instance:", error);
    res.status(500).json({ error: "Failed to fetch instance" });
  }
});

const completeStepSchema = z.object({
  result: z.record(z.any())
});

router.post("/instances/:instanceId/steps/:stepId/complete", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = completeStepSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid step result", details: validation.error.errors });
    }

    const instance = await clinicalWorkflowOrchestrator.completeStep(
      userId,
      req.params.instanceId,
      req.params.stepId,
      validation.data.result
    );
    
    if (!instance) {
      return res.status(404).json({ error: "Instance or step not found" });
    }
    
    res.json(instance);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error completing step:", error);
    res.status(500).json({ error: "Failed to complete step" });
  }
});

const stepStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped", "failed"]);
const taskPrioritySchema = z.enum(["critical", "high", "medium", "low"]);

router.get("/tasks", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { assignedTo, status, priority } = req.query;

    const filters: { 
      assignedTo?: string; 
      status?: StepStatus;
      priority?: TaskPriority;
    } = {};
    
    if (assignedTo) filters.assignedTo = assignedTo as string;
    if (status) filters.status = status as StepStatus;
    if (priority) filters.priority = priority as TaskPriority;

    const result = await clinicalWorkflowOrchestrator.listTasks(userId, filters);
    res.json(result);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error listing tasks:", error);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

const updateTaskSchema = z.object({
  status: stepStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
  formData: z.record(z.any()).optional()
});

router.patch("/tasks/:taskId", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = updateTaskSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid task update", details: validation.error.errors });
    }

    const task = await clinicalWorkflowOrchestrator.updateTask(userId, req.params.taskId, validation.data);
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

const reassignTaskSchema = z.object({
  newAssigneeId: z.string().min(1),
  newAssigneeName: z.string().min(1)
});

router.post("/tasks/:taskId/reassign", requireRole("administrator", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = reassignTaskSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid reassignment", details: validation.error.errors });
    }

    const task = await clinicalWorkflowOrchestrator.reassignTask(
      userId, 
      req.params.taskId, 
      validation.data.newAssigneeId,
      validation.data.newAssigneeName
    );
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json(task);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error reassigning task:", error);
    res.status(500).json({ error: "Failed to reassign task" });
  }
});

const sendNotificationSchema = z.object({
  instanceId: z.string().min(1),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  channel: z.enum(["email", "sms", "in_app", "push"]),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000)
});

router.post("/notifications", requireRole("administrator", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const validation = sendNotificationSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid notification", details: validation.error.errors });
    }

    const notification = await clinicalWorkflowOrchestrator.sendNotification(
      userId,
      validation.data.instanceId,
      validation.data.recipientId,
      validation.data.recipientName,
      validation.data.channel as NotificationChannel,
      validation.data.subject,
      validation.data.message
    );
    
    res.status(201).json(notification);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error sending notification:", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

router.get("/notifications", requireRole("administrator", "clinician", "care_coordinator"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const { instanceId, recipientId, status } = req.query;

    const filters: { 
      instanceId?: string; 
      recipientId?: string;
      status?: string;
    } = {};
    
    if (instanceId) filters.instanceId = instanceId as string;
    if (recipientId) filters.recipientId = recipientId as string;
    if (status) filters.status = status as string;

    const result = await clinicalWorkflowOrchestrator.getNotifications(userId, filters);
    res.json(result);
  } catch (error) {
    console.error("[WorkflowOrchestrator] Error listing notifications:", error);
    res.status(500).json({ error: "Failed to list notifications" });
  }
});

export function registerClinicalWorkflowOrchestratorRoutes(app: any) {
  app.use("/api/workflow-orchestrator", router);
  console.log("[WorkflowOrchestrator] Routes registered at /api/workflow-orchestrator/*");
  console.log("[WorkflowOrchestrator] Endpoints: /metadata, /dashboard, /workflows, /instances, /tasks, /notifications");
}

export default router;
