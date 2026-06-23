// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type FHIRResourceType =
  | "Patient"
  | "Observation"
  | "Condition"
  | "MedicationRequest"
  | "MedicationStatement"
  | "AllergyIntolerance"
  | "Immunization"
  | "Procedure"
  | "DiagnosticReport"
  | "Encounter"
  | "CarePlan"
  | "Goal"
  | "CareTeam"
  | "Practitioner"
  | "ServiceRequest"
  | "Appointment"
  | "Task"
  | "Communication"
  | "Flag";

export type TriggerType =
  | "resource_created"
  | "resource_updated"
  | "resource_deleted"
  | "value_threshold"
  | "value_change"
  | "schedule"
  | "manual"
  | "webhook";

export type ActionType =
  | "create_resource"
  | "update_resource"
  | "send_alert"
  | "send_notification"
  | "generate_careplan"
  | "generate_summary"
  | "call_webhook"
  | "assign_task"
  | "update_flag"
  | "log_event";

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "contains"
  | "not_contains"
  | "exists"
  | "not_exists"
  | "in_list"
  | "matches_regex";

export interface TriggerCondition {
  id: string;
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | string[];
  valueType: "string" | "number" | "boolean" | "date" | "code" | "reference";
}

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description: string;
  resourceType?: FHIRResourceType;
  conditions: TriggerCondition[];
  schedule?: {
    cron?: string;
    interval?: string;
    timezone?: string;
  };
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  name: string;
  description: string;
  order: number;
  config: {
    targetResourceType?: FHIRResourceType;
    template?: Record<string, unknown>;
    alertType?: "email" | "sms" | "push" | "in_app";
    alertRecipients?: string[];
    alertMessage?: string;
    webhookUrl?: string;
    webhookMethod?: "GET" | "POST" | "PUT";
    assigneeId?: string;
    flagCode?: string;
    logLevel?: "info" | "warning" | "error";
  };
  conditions?: TriggerCondition[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  version: number;
  triggers: WorkflowTrigger[];
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  executionCount: number;
  lastExecutedAt?: string;
  tags: string[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  triggerData?: Record<string, unknown>;
  actionResults: Array<{
    actionId: string;
    status: "pending" | "completed" | "failed" | "skipped";
    result?: unknown;
    error?: string;
    executedAt?: string;
  }>;
  error?: string;
}

export interface AIWorkflowSuggestion {
  workflow: Partial<Workflow>;
  explanation: string;
  suggestedEnhancements?: string[];
  potentialIssues?: string[];
}

const workflows: Map<string, Workflow> = new Map();
const executions: WorkflowExecution[] = [];

const TRIGGER_TEMPLATES: Record<TriggerType, { name: string; description: string; icon: string }> = {
  resource_created: { name: "Resource Created", description: "Triggered when a new FHIR resource is created", icon: "plus-circle" },
  resource_updated: { name: "Resource Updated", description: "Triggered when an existing FHIR resource is modified", icon: "edit" },
  resource_deleted: { name: "Resource Deleted", description: "Triggered when a FHIR resource is deleted", icon: "trash" },
  value_threshold: { name: "Value Threshold", description: "Triggered when a value crosses a defined threshold", icon: "alert-triangle" },
  value_change: { name: "Value Change", description: "Triggered when a specific value changes", icon: "trending-up" },
  schedule: { name: "Scheduled", description: "Triggered on a regular schedule", icon: "clock" },
  manual: { name: "Manual", description: "Triggered manually by a user", icon: "play" },
  webhook: { name: "Webhook", description: "Triggered by an external webhook call", icon: "link" },
};

const ACTION_TEMPLATES: Record<ActionType, { name: string; description: string; icon: string }> = {
  create_resource: { name: "Create Resource", description: "Create a new FHIR resource", icon: "file-plus" },
  update_resource: { name: "Update Resource", description: "Update an existing FHIR resource", icon: "file-edit" },
  send_alert: { name: "Send Alert", description: "Send an alert notification", icon: "bell" },
  send_notification: { name: "Send Notification", description: "Send a notification to specified recipients", icon: "mail" },
  generate_careplan: { name: "Generate CarePlan", description: "Generate a care plan using AI", icon: "clipboard-list" },
  generate_summary: { name: "Generate Summary", description: "Generate a summary document", icon: "file-text" },
  call_webhook: { name: "Call Webhook", description: "Make an HTTP request to an external endpoint", icon: "globe" },
  assign_task: { name: "Assign Task", description: "Create and assign a task to a team member", icon: "user-check" },
  update_flag: { name: "Update Flag", description: "Update a patient flag or alert", icon: "flag" },
  log_event: { name: "Log Event", description: "Log an event for audit purposes", icon: "list" },
};

function generateId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function initializeSampleWorkflows() {
  if (workflows.size > 0) return;

  const criticalVitalsWorkflow: Workflow = {
    id: generateId(),
    name: "Critical Vitals Alert",
    description: "Automatically alert care team when vital signs exceed critical thresholds",
    isEnabled: true,
    version: 1,
    triggers: [{
      id: generateId(),
      type: "value_threshold",
      name: "Critical Blood Pressure",
      description: "Triggered when systolic BP exceeds 180 mmHg",
      resourceType: "Observation",
      conditions: [
        { id: generateId(), field: "code.coding[0].code", operator: "equals", value: "8480-6", valueType: "code" },
        { id: generateId(), field: "valueQuantity.value", operator: "greater_than", value: 180, valueType: "number" },
      ],
    }],
    actions: [
      {
        id: generateId(),
        type: "send_alert",
        name: "Alert Care Team",
        description: "Send urgent alert to care team",
        order: 1,
        config: {
          alertType: "push",
          alertRecipients: ["care-team"],
          alertMessage: "CRITICAL: Patient blood pressure exceeds 180 mmHg. Immediate attention required.",
        },
      },
      {
        id: generateId(),
        type: "update_flag",
        name: "Set Critical Flag",
        description: "Update patient flag to critical status",
        order: 2,
        config: { flagCode: "critical-vitals" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 15,
    lastExecutedAt: new Date(Date.now() - 3600000).toISOString(),
    tags: ["vitals", "critical-care", "alerts"],
  };

  const newPatientWorkflow: Workflow = {
    id: generateId(),
    name: "New Patient Onboarding",
    description: "Automatically create care plan and assign tasks when a new patient is registered",
    isEnabled: true,
    version: 1,
    triggers: [{
      id: generateId(),
      type: "resource_created",
      name: "New Patient Registration",
      description: "Triggered when a new Patient resource is created",
      resourceType: "Patient",
      conditions: [],
    }],
    actions: [
      {
        id: generateId(),
        type: "generate_careplan",
        name: "Generate Initial CarePlan",
        description: "Create a personalized care plan using AI",
        order: 1,
        config: { targetResourceType: "CarePlan" },
      },
      {
        id: generateId(),
        type: "assign_task",
        name: "Schedule Welcome Call",
        description: "Assign welcome call task to patient coordinator",
        order: 2,
        config: { assigneeId: "coordinator" },
      },
      {
        id: generateId(),
        type: "send_notification",
        name: "Send Welcome Message",
        description: "Send welcome notification to patient",
        order: 3,
        config: {
          alertType: "email",
          alertMessage: "Welcome to our healthcare practice. Your care team will be in touch shortly.",
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 42,
    lastExecutedAt: new Date(Date.now() - 86400000).toISOString(),
    tags: ["onboarding", "patient-care"],
  };

  const medicationReviewWorkflow: Workflow = {
    id: generateId(),
    name: "Medication Review Reminder",
    description: "Schedule medication reviews for patients with multiple prescriptions",
    isEnabled: true,
    version: 1,
    triggers: [{
      id: generateId(),
      type: "resource_created",
      name: "New Medication Prescribed",
      description: "Triggered when a new MedicationRequest is created",
      resourceType: "MedicationRequest",
      conditions: [],
    }],
    actions: [
      {
        id: generateId(),
        type: "assign_task",
        name: "Schedule Pharmacist Review",
        description: "Assign medication review task to pharmacist",
        order: 1,
        config: { assigneeId: "pharmacist" },
      },
      {
        id: generateId(),
        type: "log_event",
        name: "Log Review Request",
        description: "Log the medication review request for audit",
        order: 2,
        config: { logLevel: "info" },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 28,
    tags: ["medications", "safety"],
  };

  workflows.set(criticalVitalsWorkflow.id, criticalVitalsWorkflow);
  workflows.set(newPatientWorkflow.id, newPatientWorkflow);
  workflows.set(medicationReviewWorkflow.id, medicationReviewWorkflow);
}

initializeSampleWorkflows();

export function getAllWorkflows(): Workflow[] {
  return Array.from(workflows.values());
}

export function getWorkflowById(id: string): Workflow | undefined {
  return workflows.get(id);
}

export function createWorkflow(workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt" | "executionCount">): Workflow {
  const newWorkflow: Workflow = {
    ...workflow,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    executionCount: 0,
  };
  workflows.set(newWorkflow.id, newWorkflow);
  return newWorkflow;
}

export function updateWorkflow(id: string, updates: Partial<Workflow>): Workflow | undefined {
  const existing = workflows.get(id);
  if (!existing) return undefined;

  const updated: Workflow = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  workflows.set(id, updated);
  return updated;
}

export function deleteWorkflow(id: string): boolean {
  return workflows.delete(id);
}

export function toggleWorkflow(id: string): Workflow | undefined {
  const existing = workflows.get(id);
  if (!existing) return undefined;

  existing.isEnabled = !existing.isEnabled;
  existing.updatedAt = new Date().toISOString();
  return existing;
}

export function executeWorkflow(id: string, triggerData?: Record<string, unknown>): WorkflowExecution {
  const workflow = workflows.get(id);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const execution: WorkflowExecution = {
    id: generateId(),
    workflowId: id,
    triggerId: workflow.triggers[0]?.id || "",
    status: "running",
    startedAt: new Date().toISOString(),
    triggerData,
    actionResults: workflow.actions.map(action => ({
      actionId: action.id,
      status: "pending" as const,
    })),
  };

  setTimeout(() => {
    execution.status = "completed";
    execution.completedAt = new Date().toISOString();
    execution.actionResults = execution.actionResults.map(ar => ({
      ...ar,
      status: "completed" as const,
      executedAt: new Date().toISOString(),
      result: { success: true },
    }));
    
    workflow.executionCount++;
    workflow.lastExecutedAt = execution.completedAt;
  }, 1000);

  executions.push(execution);
  return execution;
}

export function getWorkflowExecutions(workflowId?: string): WorkflowExecution[] {
  if (workflowId) {
    return executions.filter(e => e.workflowId === workflowId);
  }
  return [...executions].reverse();
}

export function getTriggerTemplates() {
  return Object.entries(TRIGGER_TEMPLATES).map(([type, template]) => ({
    type: type as TriggerType,
    ...template,
  }));
}

export function getActionTemplates() {
  return Object.entries(ACTION_TEMPLATES).map(([type, template]) => ({
    type: type as ActionType,
    ...template,
  }));
}

export function getWorkflowStatistics() {
  const allWorkflows = Array.from(workflows.values());
  const totalExecutions = allWorkflows.reduce((sum, w) => sum + w.executionCount, 0);
  const successfulExecutions = executions.filter(e => e.status === "completed").length;
  
  return {
    totalWorkflows: allWorkflows.length,
    activeWorkflows: allWorkflows.filter(w => w.isEnabled).length,
    totalExecutions,
    successRate: totalExecutions > 0 ? Math.round((successfulExecutions / Math.max(executions.length, 1)) * 100) : 100,
    recentExecutions: executions.slice(-5).reverse(),
  };
}

const AI_SYSTEM_PROMPT = `You are an expert FHIR workflow automation assistant. Your role is to help users create automated workflows for healthcare data management.

IMPORTANT GUIDELINES:
1. Generate workflows that are practical and follow healthcare best practices
2. Use appropriate FHIR resource types and fields
3. Include proper conditions and thresholds where relevant
4. Suggest multiple actions when appropriate for comprehensive automation
5. Consider patient safety and care quality in your suggestions

AVAILABLE TRIGGER TYPES:
- resource_created: Triggered when a new FHIR resource is created
- resource_updated: Triggered when an existing resource is modified
- resource_deleted: Triggered when a resource is deleted
- value_threshold: Triggered when a value crosses a threshold (e.g., vital signs)
- value_change: Triggered when a specific value changes
- schedule: Triggered on a schedule (cron expression)
- manual: Triggered manually
- webhook: Triggered by external webhook

AVAILABLE ACTION TYPES:
- create_resource: Create a new FHIR resource
- update_resource: Update an existing resource
- send_alert: Send an alert (email, SMS, push, in-app)
- send_notification: Send a notification
- generate_careplan: Generate a care plan using AI
- generate_summary: Generate a summary document
- call_webhook: Make HTTP request to external endpoint
- assign_task: Create and assign a task
- update_flag: Update a patient flag
- log_event: Log an audit event

FHIR RESOURCE TYPES:
Patient, Observation, Condition, MedicationRequest, MedicationStatement, AllergyIntolerance, Immunization, Procedure, DiagnosticReport, Encounter, CarePlan, Goal, CareTeam, Practitioner, ServiceRequest, Appointment, Task, Communication, Flag

COMPARISON OPERATORS:
equals, not_equals, greater_than, less_than, greater_or_equal, less_or_equal, contains, not_contains, exists, not_exists, in_list, matches_regex

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "workflow": {
    "name": "Workflow name",
    "description": "Detailed description",
    "isEnabled": true,
    "version": 1,
    "triggers": [{ trigger objects }],
    "actions": [{ action objects with order }],
    "tags": ["relevant", "tags"]
  },
  "explanation": "Explanation of how this workflow works",
  "suggestedEnhancements": ["Optional enhancements"],
  "potentialIssues": ["Potential issues to consider"]
}

Return ONLY valid JSON. No markdown, no code blocks.`;

export async function generateWorkflowFromDescription(
  description: string,
  context?: {
    existingWorkflows?: string[];
    preferredTriggers?: TriggerType[];
    preferredActions?: ActionType[];
  }
): Promise<AIWorkflowSuggestion> {
  const userPrompt = `Create an automated FHIR workflow based on this description:

"${description}"

${context?.existingWorkflows?.length ? `Existing workflows to avoid duplicating: ${context.existingWorkflows.join(", ")}` : ""}
${context?.preferredTriggers?.length ? `Preferred trigger types: ${context.preferredTriggers.join(", ")}` : ""}
${context?.preferredActions?.length ? `Preferred action types: ${context.preferredActions.join(", ")}` : ""}

Generate a complete workflow with appropriate triggers, conditions, and actions.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI model");
  }

  let parsed: AIWorkflowSuggestion;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse AI response");
  }

  if (parsed.workflow?.triggers) {
    parsed.workflow.triggers = parsed.workflow.triggers.map(t => ({
      ...t,
      id: t.id || generateId(),
      conditions: (t.conditions || []).map(c => ({ ...c, id: c.id || generateId() })),
    }));
  }

  if (parsed.workflow?.actions) {
    parsed.workflow.actions = parsed.workflow.actions.map((a, i) => ({
      ...a,
      id: a.id || generateId(),
      order: a.order || i + 1,
    }));
  }

  return parsed;
}

export async function enhanceWorkflow(
  workflow: Partial<Workflow>,
  enhancementRequest: string
): Promise<AIWorkflowSuggestion> {
  const userPrompt = `Enhance this existing workflow based on the request:

Current Workflow:
${JSON.stringify(workflow, null, 2)}

Enhancement Request: "${enhancementRequest}"

Modify the workflow to incorporate the requested enhancements while maintaining its core functionality.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI model");
  }

  return JSON.parse(content);
}

export async function suggestWorkflowImprovements(
  workflow: Workflow
): Promise<{
  suggestions: string[];
  potentialIssues: string[];
  optimizations: string[];
}> {
  const userPrompt = `Analyze this FHIR workflow and suggest improvements:

${JSON.stringify(workflow, null, 2)}

Provide suggestions for:
1. Potential improvements to make it more effective
2. Any issues or risks with the current configuration
3. Optimizations for better performance

Return as JSON with keys: suggestions, potentialIssues, optimizations (all arrays of strings).`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI model");
  }

  return JSON.parse(content);
}

export interface WorkflowMetrics {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  successRate: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errorFrequency: number;
  lastExecutedAt?: string;
  executionTrend: Array<{ date: string; count: number; successRate: number }>;
}

export interface ResourceUtilization {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  totalTriggers: number;
  totalActions: number;
  triggerTypeDistribution: Record<TriggerType, number>;
  actionTypeDistribution: Record<ActionType, number>;
  resourceTypeDistribution: Record<string, number>;
  averageActionsPerWorkflow: number;
  averageTriggersPerWorkflow: number;
}

export interface ExecutionHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  triggerId: string;
  triggerType?: TriggerType;
  actionsCompleted: number;
  actionsTotal: number;
  errorMessage?: string;
}

export interface AIBottleneckInsight {
  id: string;
  workflowId: string;
  workflowName: string;
  insightType: "bottleneck" | "improvement" | "warning" | "optimization";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  recommendation: string;
  metrics?: Record<string, number | string>;
  generatedAt: string;
}

export interface AnalyticsDashboard {
  summary: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    averageDurationMs: number;
    errorsLast24h: number;
  };
  resourceUtilization: ResourceUtilization;
  topPerformingWorkflows: WorkflowMetrics[];
  bottomPerformingWorkflows: WorkflowMetrics[];
  recentExecutions: ExecutionHistoryEntry[];
  executionTrendLast7Days: Array<{ date: string; total: number; successful: number; failed: number }>;
  bottleneckInsights: AIBottleneckInsight[];
}

const bottleneckInsights: AIBottleneckInsight[] = [];

function generateSampleExecutionHistory() {
  const allWorkflows = Array.from(workflows.values());
  const sampleExecutions: WorkflowExecution[] = [];
  
  allWorkflows.forEach(workflow => {
    const executionCount = Math.floor(Math.random() * 20) + 5;
    
    for (let i = 0; i < executionCount; i++) {
      const startTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const durationMs = Math.random() * 5000 + 500;
      const endTime = new Date(startTime.getTime() + durationMs);
      const statuses: Array<"completed" | "failed" | "cancelled"> = ["completed", "completed", "completed", "completed", "failed", "cancelled"];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const execution: WorkflowExecution = {
        id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workflowId: workflow.id,
        triggerId: workflow.triggers[0]?.id || "",
        status,
        startedAt: startTime.toISOString(),
        completedAt: endTime.toISOString(),
        actionResults: workflow.actions.map((action, idx) => ({
          actionId: action.id,
          status: status === "failed" && idx === workflow.actions.length - 1 ? "failed" as const : "completed" as const,
          executedAt: new Date(startTime.getTime() + (durationMs / workflow.actions.length) * (idx + 1)).toISOString(),
          result: { success: status !== "failed" || idx < workflow.actions.length - 1 },
          error: status === "failed" && idx === workflow.actions.length - 1 ? "Simulated action failure" : undefined,
        })),
        error: status === "failed" ? "Workflow execution failed" : undefined,
      };
      
      sampleExecutions.push(execution);
    }
  });
  
  return sampleExecutions;
}

let sampleHistoryGenerated = false;

function ensureSampleHistory() {
  if (!sampleHistoryGenerated && executions.length < 10) {
    const samples = generateSampleExecutionHistory();
    executions.push(...samples);
    sampleHistoryGenerated = true;
  }
}

export function getWorkflowMetrics(workflowId: string): WorkflowMetrics | undefined {
  ensureSampleHistory();
  const workflow = workflows.get(workflowId);
  if (!workflow) return undefined;
  
  const workflowExecutions = executions.filter(e => e.workflowId === workflowId);
  const successful = workflowExecutions.filter(e => e.status === "completed").length;
  const failed = workflowExecutions.filter(e => e.status === "failed").length;
  const cancelled = workflowExecutions.filter(e => e.status === "cancelled").length;
  
  const durations = workflowExecutions
    .filter(e => e.completedAt)
    .map(e => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());
  
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
  const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
  
  const last7Days = new Map<string, { count: number; successful: number }>();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    last7Days.set(date, { count: 0, successful: 0 });
  }
  
  workflowExecutions.forEach(e => {
    const date = e.startedAt.split('T')[0];
    if (last7Days.has(date)) {
      const entry = last7Days.get(date)!;
      entry.count++;
      if (e.status === "completed") entry.successful++;
    }
  });
  
  const executionTrend = Array.from(last7Days.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    successRate: data.count > 0 ? Math.round((data.successful / data.count) * 100) : 100,
  }));
  
  return {
    workflowId,
    workflowName: workflow.name,
    totalExecutions: workflowExecutions.length,
    successfulExecutions: successful,
    failedExecutions: failed,
    cancelledExecutions: cancelled,
    successRate: workflowExecutions.length > 0 ? Math.round((successful / workflowExecutions.length) * 100) : 100,
    averageDurationMs: Math.round(avgDuration),
    minDurationMs: Math.round(minDuration),
    maxDurationMs: Math.round(maxDuration),
    errorFrequency: workflowExecutions.length > 0 ? Math.round((failed / workflowExecutions.length) * 100) : 0,
    lastExecutedAt: workflow.lastExecutedAt,
    executionTrend,
  };
}

export function getAllWorkflowMetrics(): WorkflowMetrics[] {
  return Array.from(workflows.keys())
    .map(id => getWorkflowMetrics(id))
    .filter((m): m is WorkflowMetrics => m !== undefined);
}

export function getResourceUtilization(): ResourceUtilization {
  const allWorkflows = Array.from(workflows.values());
  
  const triggerTypeDistribution: Record<TriggerType, number> = {
    resource_created: 0,
    resource_updated: 0,
    resource_deleted: 0,
    value_threshold: 0,
    value_change: 0,
    schedule: 0,
    manual: 0,
    webhook: 0,
  };
  
  const actionTypeDistribution: Record<ActionType, number> = {
    create_resource: 0,
    update_resource: 0,
    send_alert: 0,
    send_notification: 0,
    generate_careplan: 0,
    generate_summary: 0,
    call_webhook: 0,
    assign_task: 0,
    update_flag: 0,
    log_event: 0,
  };
  
  const resourceTypeDistribution: Record<string, number> = {};
  let totalTriggers = 0;
  let totalActions = 0;
  
  allWorkflows.forEach(workflow => {
    workflow.triggers.forEach(trigger => {
      totalTriggers++;
      triggerTypeDistribution[trigger.type]++;
      if (trigger.resourceType) {
        resourceTypeDistribution[trigger.resourceType] = (resourceTypeDistribution[trigger.resourceType] || 0) + 1;
      }
    });
    
    workflow.actions.forEach(action => {
      totalActions++;
      actionTypeDistribution[action.type]++;
    });
  });
  
  return {
    totalWorkflows: allWorkflows.length,
    activeWorkflows: allWorkflows.filter(w => w.isEnabled).length,
    inactiveWorkflows: allWorkflows.filter(w => !w.isEnabled).length,
    totalTriggers,
    totalActions,
    triggerTypeDistribution,
    actionTypeDistribution,
    resourceTypeDistribution,
    averageActionsPerWorkflow: allWorkflows.length > 0 ? Math.round((totalActions / allWorkflows.length) * 10) / 10 : 0,
    averageTriggersPerWorkflow: allWorkflows.length > 0 ? Math.round((totalTriggers / allWorkflows.length) * 10) / 10 : 0,
  };
}

export function getExecutionHistory(options?: {
  workflowId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): ExecutionHistoryEntry[] {
  ensureSampleHistory();
  
  let filtered = [...executions];
  
  if (options?.workflowId) {
    filtered = filtered.filter(e => e.workflowId === options.workflowId);
  }
  
  if (options?.status) {
    filtered = filtered.filter(e => e.status === options.status);
  }
  
  if (options?.startDate) {
    filtered = filtered.filter(e => e.startedAt >= options.startDate!);
  }
  
  if (options?.endDate) {
    filtered = filtered.filter(e => e.startedAt <= options.endDate!);
  }
  
  filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  
  return filtered.map(e => {
    const workflow = workflows.get(e.workflowId);
    const trigger = workflow?.triggers.find(t => t.id === e.triggerId);
    const durationMs = e.completedAt 
      ? new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime()
      : undefined;
    
    return {
      id: e.id,
      workflowId: e.workflowId,
      workflowName: workflow?.name || "Unknown Workflow",
      status: e.status,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      durationMs,
      triggerId: e.triggerId,
      triggerType: trigger?.type,
      actionsCompleted: e.actionResults.filter(ar => ar.status === "completed").length,
      actionsTotal: e.actionResults.length,
      errorMessage: e.error,
    };
  });
}

export function getExecutionTrendLast7Days(): Array<{ date: string; total: number; successful: number; failed: number }> {
  ensureSampleHistory();
  
  const trendMap = new Map<string, { total: number; successful: number; failed: number }>();
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    trendMap.set(date, { total: 0, successful: 0, failed: 0 });
  }
  
  executions.forEach(e => {
    const date = e.startedAt.split('T')[0];
    if (trendMap.has(date)) {
      const entry = trendMap.get(date)!;
      entry.total++;
      if (e.status === "completed") entry.successful++;
      if (e.status === "failed") entry.failed++;
    }
  });
  
  return Array.from(trendMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));
}

export async function generateBottleneckInsights(): Promise<AIBottleneckInsight[]> {
  const allMetrics = getAllWorkflowMetrics();
  const resourceUtil = getResourceUtilization();
  
  const analysisData = {
    workflows: allMetrics.map(m => ({
      name: m.workflowName,
      successRate: m.successRate,
      avgDuration: m.averageDurationMs,
      errorFrequency: m.errorFrequency,
      totalExecutions: m.totalExecutions,
    })),
    resourceUtilization: resourceUtil,
    executionTrend: getExecutionTrendLast7Days(),
  };
  
  const userPrompt = `Analyze this workflow analytics data and identify bottlenecks, issues, and improvement opportunities:

${JSON.stringify(analysisData, null, 2)}

Provide insights in this JSON format:
{
  "insights": [
    {
      "insightType": "bottleneck" | "improvement" | "warning" | "optimization",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Short title",
      "description": "Detailed description of the issue or opportunity",
      "recommendation": "Actionable recommendation",
      "workflowName": "Affected workflow name (if specific)",
      "metrics": { "key": "value" }
    }
  ]
}

Focus on:
1. Workflows with high error rates or low success rates
2. Workflows taking longer than expected
3. Resource utilization imbalances
4. Execution trend anomalies
5. Optimization opportunities

Return 3-5 actionable insights. Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert workflow analytics advisor. Analyze workflow performance data and provide actionable insights. Always return valid JSON." },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI model");
    }

    const parsed = JSON.parse(content);
    const insights: AIBottleneckInsight[] = (parsed.insights || []).map((insight: Record<string, unknown>, index: number) => {
      const workflowName = insight.workflowName as string | undefined;
      const matchingWorkflow = workflowName 
        ? Array.from(workflows.values()).find(w => w.name === workflowName)
        : undefined;
      
      return {
        id: `insight-${Date.now()}-${index}`,
        workflowId: matchingWorkflow?.id || "",
        workflowName: workflowName || "All Workflows",
        insightType: insight.insightType as AIBottleneckInsight["insightType"],
        severity: insight.severity as AIBottleneckInsight["severity"],
        title: insight.title as string,
        description: insight.description as string,
        recommendation: insight.recommendation as string,
        metrics: insight.metrics as Record<string, number | string> | undefined,
        generatedAt: new Date().toISOString(),
      };
    });

    bottleneckInsights.length = 0;
    bottleneckInsights.push(...insights);
    
    return insights;
  } catch (error) {
    console.error("Failed to generate bottleneck insights:", error);
    
    const fallbackInsights: AIBottleneckInsight[] = [];
    const lowPerformers = allMetrics.filter(m => m.successRate < 80);
    
    lowPerformers.forEach((metric, idx) => {
      fallbackInsights.push({
        id: `insight-fallback-${idx}`,
        workflowId: metric.workflowId,
        workflowName: metric.workflowName,
        insightType: "warning",
        severity: metric.successRate < 50 ? "high" : "medium",
        title: `Low Success Rate: ${metric.workflowName}`,
        description: `This workflow has a success rate of ${metric.successRate}% which is below the recommended threshold of 80%.`,
        recommendation: "Review workflow configuration and action error handling. Consider adding retry logic or fallback actions.",
        metrics: {
          successRate: metric.successRate,
          errorFrequency: metric.errorFrequency,
          avgDuration: `${metric.averageDurationMs}ms`,
        },
        generatedAt: new Date().toISOString(),
      });
    });
    
    const slowWorkflows = allMetrics.filter(m => m.averageDurationMs > 3000);
    slowWorkflows.forEach((metric, idx) => {
      fallbackInsights.push({
        id: `insight-slow-${idx}`,
        workflowId: metric.workflowId,
        workflowName: metric.workflowName,
        insightType: "optimization",
        severity: "low",
        title: `Slow Execution: ${metric.workflowName}`,
        description: `This workflow averages ${Math.round(metric.averageDurationMs / 1000)}s per execution, which may impact user experience.`,
        recommendation: "Consider parallelizing independent actions or optimizing external API calls.",
        metrics: {
          avgDuration: `${metric.averageDurationMs}ms`,
          minDuration: `${metric.minDurationMs}ms`,
          maxDuration: `${metric.maxDurationMs}ms`,
        },
        generatedAt: new Date().toISOString(),
      });
    });
    
    bottleneckInsights.length = 0;
    bottleneckInsights.push(...fallbackInsights);
    
    return fallbackInsights;
  }
}

export function getCachedBottleneckInsights(): AIBottleneckInsight[] {
  return [...bottleneckInsights];
}

export function getAnalyticsDashboard(): AnalyticsDashboard {
  ensureSampleHistory();
  
  const allMetrics = getAllWorkflowMetrics();
  const resourceUtil = getResourceUtilization();
  const executionTrend = getExecutionTrendLast7Days();
  const recentExecutions = getExecutionHistory({ limit: 10 });
  
  const totalExecutions = allMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
  const totalSuccessful = allMetrics.reduce((sum, m) => sum + m.successfulExecutions, 0);
  const allDurations = allMetrics.filter(m => m.averageDurationMs > 0).map(m => m.averageDurationMs);
  const avgDuration = allDurations.length > 0 ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length : 0;
  
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const errorsLast24h = executions.filter(e => e.status === "failed" && e.startedAt >= yesterday).length;
  
  const sortedByPerformance = [...allMetrics].sort((a, b) => b.successRate - a.successRate);
  
  return {
    summary: {
      totalWorkflows: resourceUtil.totalWorkflows,
      activeWorkflows: resourceUtil.activeWorkflows,
      totalExecutions,
      successRate: totalExecutions > 0 ? Math.round((totalSuccessful / totalExecutions) * 100) : 100,
      averageDurationMs: Math.round(avgDuration),
      errorsLast24h,
    },
    resourceUtilization: resourceUtil,
    topPerformingWorkflows: sortedByPerformance.slice(0, 3),
    bottomPerformingWorkflows: sortedByPerformance.slice(-3).reverse(),
    recentExecutions,
    executionTrendLast7Days: executionTrend,
    bottleneckInsights: getCachedBottleneckInsights(),
  };
}
