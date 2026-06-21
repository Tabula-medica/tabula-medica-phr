import { Router, Request, Response } from "express";
import { z } from "zod";
import { createHash } from "crypto";
import {
  aiDataStewardshipService,
  StewardRole,
  TaskType,
  TaskPriority,
  TaskStatus,
} from "./services/ai-data-stewardship";

const router = Router();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    component: "DataStewardshipAPI",
    details,
  })}`);
}

const stewardRoles: StewardRole[] = ["data_steward", "domain_steward", "technical_steward", "privacy_steward", "compliance_steward"];
const taskTypes: TaskType[] = ["asset_review", "policy_violation", "access_anomaly", "quality_issue", "risk_assessment", "documentation", "certification"];
const taskPriorities: TaskPriority[] = ["critical", "high", "medium", "low"];
const taskStatuses: TaskStatus[] = ["pending", "in_progress", "completed", "deferred", "escalated"];

router.get("/dashboard", (req: Request, res: Response) => {
  try {
    const { stewardId } = req.query;
    logHipaaAudit("VIEW_STEWARDSHIP_DASHBOARD", { stewardId: stewardId ? hashIdentifier(stewardId as string) : null });
    
    const dashboard = aiDataStewardshipService.getDashboard(stewardId as string | undefined);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    console.error("[DataStewardship] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to get dashboard" });
  }
});

const stewardQuerySchema = z.object({
  role: z.enum(stewardRoles as [StewardRole, ...StewardRole[]]).optional(),
  domain: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

router.get("/stewards", (req: Request, res: Response) => {
  try {
    const parseResult = stewardQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }
    
    const { role, domain, isActive } = parseResult.data;
    logHipaaAudit("LIST_STEWARDS", { filters: { role, domain, isActive } });
    
    const stewards = aiDataStewardshipService.getStewards({
      role,
      domain,
      isActive: isActive ? isActive === "true" : undefined,
    });
    
    res.json({ success: true, data: stewards });
  } catch (error) {
    console.error("[DataStewardship] List stewards error:", error);
    res.status(500).json({ success: false, error: "Failed to list stewards" });
  }
});

router.get("/stewards/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("VIEW_STEWARD", { stewardId: hashIdentifier(id) });
    
    const steward = aiDataStewardshipService.getSteward(id);
    if (!steward) {
      return res.status(404).json({ success: false, error: "Steward not found" });
    }
    
    res.json({ success: true, data: steward });
  } catch (error) {
    console.error("[DataStewardship] Get steward error:", error);
    res.status(500).json({ success: false, error: "Failed to get steward" });
  }
});

const createStewardSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(stewardRoles as [StewardRole, ...StewardRole[]]),
  domains: z.array(z.string()).min(1),
  sensitivityLevels: z.array(z.string()).min(1),
  maxWorkload: z.number().min(1).max(100),
  expertise: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

router.post("/stewards", (req: Request, res: Response) => {
  try {
    const parseResult = createStewardSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const steward = aiDataStewardshipService.createSteward(parseResult.data);
    res.status(201).json({ success: true, data: steward });
  } catch (error) {
    console.error("[DataStewardship] Create steward error:", error);
    res.status(500).json({ success: false, error: "Failed to create steward" });
  }
});

router.patch("/stewards/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = aiDataStewardshipService.updateSteward(id, req.body);
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Steward not found" });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[DataStewardship] Update steward error:", error);
    res.status(500).json({ success: false, error: "Failed to update steward" });
  }
});

const autoAssignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  sensitiveTypes: z.array(z.string()),
  riskLevel: z.string(),
  currentOwner: z.string().optional(),
});

router.post("/auto-assign", (req: Request, res: Response) => {
  try {
    const parseResult = autoAssignSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const assignment = aiDataStewardshipService.autoAssignSteward(parseResult.data);
    
    if (!assignment) {
      return res.status(404).json({ success: false, error: "No suitable steward available" });
    }
    
    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error("[DataStewardship] Auto-assign error:", error);
    res.status(500).json({ success: false, error: "Failed to auto-assign steward" });
  }
});

router.get("/assignments/:assetId", (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    logHipaaAudit("VIEW_ASSET_ASSIGNMENTS", { assetId: hashIdentifier(assetId) });
    
    const assignments = aiDataStewardshipService.getAssetAssignments(assetId);
    res.json({ success: true, data: assignments });
  } catch (error) {
    console.error("[DataStewardship] Get assignments error:", error);
    res.status(500).json({ success: false, error: "Failed to get assignments" });
  }
});

const taskQuerySchema = z.object({
  assignedTo: z.string().optional(),
  status: z.enum(taskStatuses as [TaskStatus, ...TaskStatus[]]).optional(),
  priority: z.enum(taskPriorities as [TaskPriority, ...TaskPriority[]]).optional(),
  type: z.enum(taskTypes as [TaskType, ...TaskType[]]).optional(),
});

router.get("/tasks", (req: Request, res: Response) => {
  try {
    const parseResult = taskQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query parameters" });
    }
    
    logHipaaAudit("LIST_STEWARDSHIP_TASKS", { filters: parseResult.data });
    
    const tasks = aiDataStewardshipService.getTasks(parseResult.data);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[DataStewardship] List tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to list tasks" });
  }
});

router.get("/tasks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    logHipaaAudit("VIEW_STEWARDSHIP_TASK", { taskId: hashIdentifier(id) });
    
    const task = aiDataStewardshipService.getTask(id);
    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[DataStewardship] Get task error:", error);
    res.status(500).json({ success: false, error: "Failed to get task" });
  }
});

const createTaskSchema = z.object({
  type: z.enum(taskTypes as [TaskType, ...TaskType[]]),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(taskPriorities as [TaskPriority, ...TaskPriority[]]),
  status: z.enum(taskStatuses as [TaskStatus, ...TaskStatus[]]).default("pending"),
  assignedTo: z.string().min(1),
  assignedToName: z.string().min(1),
  assetId: z.string().optional(),
  assetName: z.string().optional(),
  policyId: z.string().optional(),
  policyName: z.string().optional(),
  dueDate: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});

router.post("/tasks", (req: Request, res: Response) => {
  try {
    const parseResult = createTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const task = aiDataStewardshipService.createTask(parseResult.data);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error("[DataStewardship] Create task error:", error);
    res.status(500).json({ success: false, error: "Failed to create task" });
  }
});

const updateTaskSchema = z.object({
  status: z.enum(taskStatuses as [TaskStatus, ...TaskStatus[]]).optional(),
  priority: z.enum(taskPriorities as [TaskPriority, ...TaskPriority[]]).optional(),
  findings: z.string().optional(),
  resolution: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional(),
});

router.patch("/tasks/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = updateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const updated = aiDataStewardshipService.updateTask(id, parseResult.data);
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }
    
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[DataStewardship] Update task error:", error);
    res.status(500).json({ success: false, error: "Failed to update task" });
  }
});

const generateRiskTasksSchema = z.object({
  assets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    riskLevel: z.string(),
    riskFactors: z.array(z.string()),
  })),
});

router.post("/tasks/generate/risks", (req: Request, res: Response) => {
  try {
    const parseResult = generateRiskTasksSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const tasks = aiDataStewardshipService.generateTasksFromRiskAssessment(parseResult.data.assets);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[DataStewardship] Generate risk tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to generate tasks" });
  }
});

const generateViolationTasksSchema = z.object({
  violations: z.array(z.object({
    id: z.string(),
    policyId: z.string(),
    policyName: z.string(),
    severity: z.string(),
    description: z.string(),
    affectedAssetId: z.string().optional(),
    affectedAssetName: z.string().optional(),
  })),
});

router.post("/tasks/generate/violations", (req: Request, res: Response) => {
  try {
    const parseResult = generateViolationTasksSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const tasks = aiDataStewardshipService.generateTasksFromPolicyViolations(parseResult.data.violations);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[DataStewardship] Generate violation tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to generate tasks" });
  }
});

const generateAnomalyTasksSchema = z.object({
  anomalies: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    description: z.string(),
    riskScore: z.number(),
    affectedAssets: z.array(z.string()),
  })),
});

router.post("/tasks/generate/anomalies", (req: Request, res: Response) => {
  try {
    const parseResult = generateAnomalyTasksSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid data", details: parseResult.error.errors });
    }
    
    const tasks = aiDataStewardshipService.generateTasksFromAccessAnomalies(parseResult.data.anomalies);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[DataStewardship] Generate anomaly tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to generate tasks" });
  }
});

const assistantQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  context: z.object({
    assetId: z.string().optional(),
    taskId: z.string().optional(),
    policyId: z.string().optional(),
  }).optional(),
});

router.post("/assistant/ask", async (req: Request, res: Response) => {
  try {
    const parseResult = assistantQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid query", details: parseResult.error.errors });
    }
    
    const response = await aiDataStewardshipService.askAssistant(parseResult.data);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error("[DataStewardship] Assistant error:", error);
    res.status(500).json({ success: false, error: "Failed to process query" });
  }
});

export default router;
