// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import { randomUUID } from "crypto";
import OpenAI from "openai";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

let openai: OpenAI | null = null;
if (openaiApiKey && openaiBaseURL) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiBaseURL,
  });
}

export interface StepExecution {
  stepId: string;
  stepName: string;
  stepType: "trigger" | "condition" | "action" | "transformation";
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  resourcesProcessed?: number;
  error?: string;
  warnings?: string[];
}

export interface ResourceFlow {
  id: string;
  fromStep: string;
  toStep: string;
  resourceType: string;
  resourceCount: number;
  transformations: string[];
  dataSize?: number;
}

export interface WorkflowExecutionDetail {
  executionId: string;
  workflowId: string;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startTime: string;
  endTime?: string;
  totalDurationMs?: number;
  steps: StepExecution[];
  resourceFlows: ResourceFlow[];
  currentStepIndex: number;
  progress: number;
  metrics: {
    resourcesInput: number;
    resourcesOutput: number;
    transformationsApplied: number;
    errorsEncountered: number;
    warningsRaised: number;
  };
}

export interface WorkflowAlert {
  id: string;
  executionId: string;
  workflowId: string;
  workflowName: string;
  type: "step_failure" | "step_delay" | "resource_error" | "threshold_exceeded" | "validation_error";
  severity: "info" | "warning" | "error" | "critical";
  stepId?: string;
  stepName?: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface MonitoringDashboard {
  activeExecutions: WorkflowExecutionDetail[];
  recentExecutions: WorkflowExecutionDetail[];
  alerts: WorkflowAlert[];
  statistics: {
    totalExecutions24h: number;
    successRate: number;
    averageDurationMs: number;
    activeAlerts: number;
    resourcesProcessed24h: number;
  };
}

const activeExecutions: Map<string, WorkflowExecutionDetail> = new Map();
const executionHistory: WorkflowExecutionDetail[] = [];
const alerts: WorkflowAlert[] = [];
const alertThresholds = {
  stepDelayMs: 5000,
  maxRetries: 3,
  resourceErrorThreshold: 0.1
};

function initializeSampleData() {
  const sampleExecution1: WorkflowExecutionDetail = {
    executionId: randomUUID(),
    workflowId: "wf-patient-sync",
    workflowName: "Patient Data Synchronization",
    status: "running",
    startTime: new Date(Date.now() - 45000).toISOString(),
    steps: [
      {
        stepId: "step-1",
        stepName: "Fetch Patient Records",
        stepType: "trigger",
        status: "completed",
        startTime: new Date(Date.now() - 45000).toISOString(),
        endTime: new Date(Date.now() - 40000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 150,
        outputData: { patientCount: 150 }
      },
      {
        stepId: "step-2",
        stepName: "Validate FHIR Resources",
        stepType: "condition",
        status: "completed",
        startTime: new Date(Date.now() - 40000).toISOString(),
        endTime: new Date(Date.now() - 35000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 150,
        warnings: ["2 resources have missing identifiers"]
      },
      {
        stepId: "step-3",
        stepName: "Transform to R4 Format",
        stepType: "transformation",
        status: "running",
        startTime: new Date(Date.now() - 35000).toISOString(),
        resourcesProcessed: 85
      },
      {
        stepId: "step-4",
        stepName: "Update EHR System",
        stepType: "action",
        status: "pending"
      },
      {
        stepId: "step-5",
        stepName: "Send Notifications",
        stepType: "action",
        status: "pending"
      }
    ],
    resourceFlows: [
      {
        id: randomUUID(),
        fromStep: "step-1",
        toStep: "step-2",
        resourceType: "Patient",
        resourceCount: 150,
        transformations: ["source extraction"],
        dataSize: 245000
      },
      {
        id: randomUUID(),
        fromStep: "step-2",
        toStep: "step-3",
        resourceType: "Patient",
        resourceCount: 148,
        transformations: ["validation", "filtering"],
        dataSize: 240000
      }
    ],
    currentStepIndex: 2,
    progress: 45,
    metrics: {
      resourcesInput: 150,
      resourcesOutput: 85,
      transformationsApplied: 2,
      errorsEncountered: 0,
      warningsRaised: 1
    }
  };

  const sampleExecution2: WorkflowExecutionDetail = {
    executionId: randomUUID(),
    workflowId: "wf-lab-results",
    workflowName: "Lab Results Processing",
    status: "completed",
    startTime: new Date(Date.now() - 600000).toISOString(),
    endTime: new Date(Date.now() - 580000).toISOString(),
    totalDurationMs: 20000,
    steps: [
      {
        stepId: "step-1",
        stepName: "Receive Lab Results",
        stepType: "trigger",
        status: "completed",
        startTime: new Date(Date.now() - 600000).toISOString(),
        endTime: new Date(Date.now() - 595000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 45
      },
      {
        stepId: "step-2",
        stepName: "Parse HL7 Messages",
        stepType: "transformation",
        status: "completed",
        startTime: new Date(Date.now() - 595000).toISOString(),
        endTime: new Date(Date.now() - 590000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 45
      },
      {
        stepId: "step-3",
        stepName: "Create Observation Resources",
        stepType: "action",
        status: "completed",
        startTime: new Date(Date.now() - 590000).toISOString(),
        endTime: new Date(Date.now() - 585000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 45
      },
      {
        stepId: "step-4",
        stepName: "Alert for Critical Values",
        stepType: "action",
        status: "completed",
        startTime: new Date(Date.now() - 585000).toISOString(),
        endTime: new Date(Date.now() - 580000).toISOString(),
        durationMs: 5000,
        resourcesProcessed: 3
      }
    ],
    resourceFlows: [
      {
        id: randomUUID(),
        fromStep: "step-1",
        toStep: "step-2",
        resourceType: "DiagnosticReport",
        resourceCount: 45,
        transformations: ["HL7 parsing"],
        dataSize: 120000
      },
      {
        id: randomUUID(),
        fromStep: "step-2",
        toStep: "step-3",
        resourceType: "Observation",
        resourceCount: 135,
        transformations: ["FHIR conversion", "normalization"],
        dataSize: 180000
      }
    ],
    currentStepIndex: 4,
    progress: 100,
    metrics: {
      resourcesInput: 45,
      resourcesOutput: 135,
      transformationsApplied: 4,
      errorsEncountered: 0,
      warningsRaised: 0
    }
  };

  const failedExecution: WorkflowExecutionDetail = {
    executionId: randomUUID(),
    workflowId: "wf-medication-reconciliation",
    workflowName: "Medication Reconciliation",
    status: "failed",
    startTime: new Date(Date.now() - 1800000).toISOString(),
    endTime: new Date(Date.now() - 1795000).toISOString(),
    totalDurationMs: 5000,
    steps: [
      {
        stepId: "step-1",
        stepName: "Fetch Medication Lists",
        stepType: "trigger",
        status: "completed",
        startTime: new Date(Date.now() - 1800000).toISOString(),
        endTime: new Date(Date.now() - 1797000).toISOString(),
        durationMs: 3000,
        resourcesProcessed: 25
      },
      {
        stepId: "step-2",
        stepName: "Deduplicate Medications",
        stepType: "transformation",
        status: "failed",
        startTime: new Date(Date.now() - 1797000).toISOString(),
        endTime: new Date(Date.now() - 1795000).toISOString(),
        durationMs: 2000,
        error: "Duplicate detection algorithm failed: invalid RxNorm code format"
      },
      {
        stepId: "step-3",
        stepName: "Create Reconciliation Report",
        stepType: "action",
        status: "skipped"
      }
    ],
    resourceFlows: [
      {
        id: randomUUID(),
        fromStep: "step-1",
        toStep: "step-2",
        resourceType: "MedicationRequest",
        resourceCount: 25,
        transformations: [],
        dataSize: 45000
      }
    ],
    currentStepIndex: 1,
    progress: 33,
    metrics: {
      resourcesInput: 25,
      resourcesOutput: 0,
      transformationsApplied: 0,
      errorsEncountered: 1,
      warningsRaised: 0
    }
  };

  activeExecutions.set(sampleExecution1.executionId, sampleExecution1);
  executionHistory.push(sampleExecution2, failedExecution);

  alerts.push({
    id: randomUUID(),
    executionId: failedExecution.executionId,
    workflowId: failedExecution.workflowId,
    workflowName: failedExecution.workflowName,
    type: "step_failure",
    severity: "error",
    stepId: "step-2",
    stepName: "Deduplicate Medications",
    message: "Medication reconciliation step failed due to invalid RxNorm code format",
    details: { errorCode: "RXNORM_PARSE_ERROR", affectedResources: 25 },
    timestamp: new Date(Date.now() - 1795000).toISOString(),
    acknowledged: false
  });

  alerts.push({
    id: randomUUID(),
    executionId: sampleExecution1.executionId,
    workflowId: sampleExecution1.workflowId,
    workflowName: sampleExecution1.workflowName,
    type: "step_delay",
    severity: "warning",
    stepId: "step-3",
    stepName: "Transform to R4 Format",
    message: "Transformation step is taking longer than expected (>30s)",
    details: { expectedDurationMs: 10000, currentDurationMs: 35000 },
    timestamp: new Date(Date.now() - 5000).toISOString(),
    acknowledged: false
  });
}

initializeSampleData();

export function getMonitoringDashboard(): MonitoringDashboard {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;
  
  const allExecutions = [...Array.from(activeExecutions.values()), ...executionHistory];
  const recent24h = allExecutions.filter(e => new Date(e.startTime).getTime() > last24h);
  
  const completed = recent24h.filter(e => e.status === "completed");
  const successRate = recent24h.length > 0 ? (completed.length / recent24h.length) * 100 : 100;
  
  const avgDuration = completed.length > 0 
    ? completed.reduce((sum, e) => sum + (e.totalDurationMs || 0), 0) / completed.length 
    : 0;

  const activeAlerts = alerts.filter(a => !a.acknowledged).length;
  const resourcesProcessed = recent24h.reduce((sum, e) => sum + e.metrics.resourcesInput, 0);

  return {
    activeExecutions: Array.from(activeExecutions.values()),
    recentExecutions: executionHistory.slice(-20).reverse(),
    alerts: alerts.slice(-50).reverse(),
    statistics: {
      totalExecutions24h: recent24h.length,
      successRate: Math.round(successRate * 10) / 10,
      averageDurationMs: Math.round(avgDuration),
      activeAlerts,
      resourcesProcessed24h: resourcesProcessed
    }
  };
}

export function getExecutionDetails(executionId: string): WorkflowExecutionDetail | null {
  return activeExecutions.get(executionId) || executionHistory.find(e => e.executionId === executionId) || null;
}

export function getExecutionStepVisualization(executionId: string): {
  steps: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    duration: string;
    resources: number;
    position: { x: number; y: number };
  }>;
  connections: Array<{
    from: string;
    to: string;
    resourceCount: number;
    transformations: string[];
  }>;
} | null {
  const execution = getExecutionDetails(executionId);
  if (!execution) return null;

  const steps = execution.steps.map((step, index) => ({
    id: step.stepId,
    name: step.stepName,
    type: step.stepType,
    status: step.status,
    duration: step.durationMs ? `${step.durationMs}ms` : "-",
    resources: step.resourcesProcessed || 0,
    position: { x: 100 + index * 200, y: 150 }
  }));

  const connections = execution.resourceFlows.map(flow => ({
    from: flow.fromStep,
    to: flow.toStep,
    resourceCount: flow.resourceCount,
    transformations: flow.transformations
  }));

  return { steps, connections };
}

export function getResourceFlowChart(executionId: string): {
  nodes: Array<{ id: string; label: string; type: string; value: number }>;
  edges: Array<{ source: string; target: string; value: number; label: string }>;
} | null {
  const execution = getExecutionDetails(executionId);
  if (!execution) return null;

  const nodes = execution.steps.map(step => ({
    id: step.stepId,
    label: step.stepName,
    type: step.stepType,
    value: step.resourcesProcessed || 0
  }));

  const edges = execution.resourceFlows.map(flow => ({
    source: flow.fromStep,
    target: flow.toStep,
    value: flow.resourceCount,
    label: `${flow.resourceCount} ${flow.resourceType}${flow.resourceCount > 1 ? "s" : ""}`
  }));

  return { nodes, edges };
}

export function createAlert(alert: Omit<WorkflowAlert, "id" | "timestamp" | "acknowledged">): WorkflowAlert {
  const newAlert: WorkflowAlert = {
    ...alert,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    acknowledged: false
  };
  alerts.push(newAlert);
  
  if (alerts.length > 200) {
    alerts.shift();
  }

  console.log(`[WorkflowMonitoring] Alert created: ${alert.type} - ${alert.message}`);
  return newAlert;
}

export function acknowledgeAlert(alertId: string, userId: string): WorkflowAlert | null {
  const alert = alerts.find(a => a.id === alertId);
  if (!alert) return null;

  alert.acknowledged = true;
  alert.acknowledgedBy = userId;
  alert.acknowledgedAt = new Date().toISOString();
  return alert;
}

export function getActiveAlerts(): WorkflowAlert[] {
  return alerts.filter(a => !a.acknowledged);
}

export function getAlertsByWorkflow(workflowId: string): WorkflowAlert[] {
  return alerts.filter(a => a.workflowId === workflowId);
}

export async function analyzeExecutionWithAI(executionId: string): Promise<{
  summary: string;
  bottlenecks: string[];
  recommendations: string[];
  riskAssessment: string;
} | null> {
  const execution = getExecutionDetails(executionId);
  if (!execution) return null;

  if (!openai) {
    return {
      summary: `Workflow "${execution.workflowName}" ${execution.status}. Processed ${execution.metrics.resourcesInput} resources with ${execution.metrics.errorsEncountered} errors.`,
      bottlenecks: execution.steps
        .filter(s => s.durationMs && s.durationMs > 10000)
        .map(s => `Step "${s.stepName}" took ${s.durationMs}ms`),
      recommendations: ["Consider optimizing long-running steps", "Add monitoring for error-prone steps"],
      riskAssessment: execution.metrics.errorsEncountered > 0 ? "Medium risk - errors detected" : "Low risk"
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a workflow optimization analyst. Analyze workflow execution data and provide insights.
Return JSON with: summary (string), bottlenecks (array of strings), recommendations (array of strings), riskAssessment (string).`
        },
        {
          role: "user",
          content: `Analyze this workflow execution:\n${JSON.stringify({
            name: execution.workflowName,
            status: execution.status,
            duration: execution.totalDurationMs,
            steps: execution.steps.map(s => ({
              name: s.stepName,
              status: s.status,
              duration: s.durationMs,
              resources: s.resourcesProcessed,
              error: s.error
            })),
            metrics: execution.metrics
          }, null, 2)}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No AI response");

    return JSON.parse(content);
  } catch (error) {
    console.error("[WorkflowMonitoring] AI analysis error:", error);
    return {
      summary: `Workflow "${execution.workflowName}" ${execution.status}.`,
      bottlenecks: [],
      recommendations: ["Enable AI for detailed analysis"],
      riskAssessment: "Unknown"
    };
  }
}

export function simulateStepProgress(executionId: string, stepId: string, progress: number): boolean {
  const execution = activeExecutions.get(executionId);
  if (!execution) return false;

  const step = execution.steps.find(s => s.stepId === stepId);
  if (!step) return false;

  if (step.status === "pending" && progress > 0) {
    step.status = "running";
    step.startTime = new Date().toISOString();
  }

  if (progress >= 100) {
    step.status = "completed";
    step.endTime = new Date().toISOString();
    step.durationMs = step.startTime 
      ? new Date().getTime() - new Date(step.startTime).getTime() 
      : 0;

    const stepIndex = execution.steps.findIndex(s => s.stepId === stepId);
    if (stepIndex < execution.steps.length - 1) {
      execution.currentStepIndex = stepIndex + 1;
    }
  }

  execution.progress = Math.round(
    (execution.steps.filter(s => s.status === "completed").length / execution.steps.length) * 100
  );

  if (execution.steps.every(s => s.status === "completed" || s.status === "skipped")) {
    execution.status = "completed";
    execution.endTime = new Date().toISOString();
    execution.totalDurationMs = new Date().getTime() - new Date(execution.startTime).getTime();
    activeExecutions.delete(executionId);
    executionHistory.push(execution);
  }

  return true;
}

export function getServiceMetadata() {
  return {
    version: "1.0.0",
    aiEnabled: !!openai,
    features: [
      "Real-time execution tracking",
      "Step-by-step visualization",
      "Resource flow charting",
      "Alert management",
      "AI execution analysis",
      "Progress simulation"
    ],
    alertThresholds
  };
}

console.log("[WorkflowMonitoring] Service initialized with", openai ? "AI-powered" : "rule-based", "analysis");
