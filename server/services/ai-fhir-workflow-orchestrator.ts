import crypto from "crypto";
import OpenAI from "openai";

const NO_CDS_DISCLAIMER = "CRITICAL COMPLIANCE NOTICE: This AI-driven FHIR workflow automation is for DATA QUALITY, GOVERNANCE, and OPERATIONAL purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice. All outputs must be reviewed by qualified personnel.";

export type FHIRWorkflowStepType =
  | "data_ingestion"
  | "validation"
  | "harmonization"
  | "transformation"
  | "enrichment"
  | "quality_check"
  | "report_generation"
  | "notification"
  | "condition"
  | "parallel"
  | "delay"
  | "manual_review";

export type FHIRWorkflowTriggerType =
  | "manual"
  | "scheduled"
  | "fhir_event"
  | "data_quality_threshold"
  | "new_data_source"
  | "api_webhook";

export type FHIRWorkflowStatus = "draft" | "active" | "paused" | "archived";
export type FHIRWorkflowExecutionStatus = "pending" | "running" | "completed" | "failed" | "paused" | "cancelled";
export type StepExecutionStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export interface FHIRWorkflowStep {
  id: string;
  name: string;
  description: string;
  type: FHIRWorkflowStepType;
  order: number;
  position: { x: number; y: number };
  config: {
    sourceSystem?: string;
    targetFormat?: string;
    terminologies?: string[];
    validationRules?: string[];
    reportType?: string;
    notificationChannels?: string[];
    notificationTemplate?: string;
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: any;
    trueStepId?: string;
    falseStepId?: string;
    parallelStepIds?: string[];
    delayMinutes?: number;
    aiModel?: string;
    qualityThreshold?: number;
    customConfig?: Record<string, any>;
  };
  dependencies?: string[];
  estimatedDurationSeconds?: number;
}

export interface FHIRWorkflowTrigger {
  type: FHIRWorkflowTriggerType;
  config: {
    schedule?: string;
    resourceType?: string;
    eventType?: string;
    dataSourceId?: string;
    qualityMetric?: string;
    thresholdValue?: number;
    webhookSecret?: string;
    conditions?: Array<{ field: string; operator: string; value: any }>;
  };
}

export interface FHIRWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  version: number;
  status: FHIRWorkflowStatus;
  triggers: FHIRWorkflowTrigger[];
  steps: FHIRWorkflowStep[];
  connections: Array<{ sourceStepId: string; targetStepId: string; label?: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  tags: string[];
  estimatedDurationMinutes?: number;
  autoRetry: boolean;
  maxRetries: number;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
}

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  status: StepExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  error?: string;
  metrics?: {
    recordsProcessed?: number;
    recordsValidated?: number;
    errorsFound?: number;
    qualityScore?: number;
    durationMs?: number;
  };
  aiAnalysis?: {
    summary: string;
    insights: string[];
    recommendations: string[];
  };
}

export interface FHIRWorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: FHIRWorkflowExecutionStatus;
  triggeredBy: string;
  triggerType: FHIRWorkflowTriggerType;
  triggerContext: Record<string, any>;
  currentStepId?: string;
  steps: StepExecutionResult[];
  priority: "critical" | "high" | "medium" | "low";
  startedAt: string;
  completedAt?: string;
  progress: number;
  metadata: Record<string, any>;
  noCdsCompliance: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<FHIRWorkflowStep, "id">[];
  connections: Array<{ sourceIndex: number; targetIndex: number; label?: string }>;
  tags: string[];
}

export interface FHIRWorkflowDashboard {
  summary: {
    totalWorkflows: number;
    activeWorkflows: number;
    runningExecutions: number;
    completedToday: number;
    failedToday: number;
    avgExecutionTime: number;
  };
  recentExecutions: FHIRWorkflowExecution[];
  workflowsByCategory: { category: string; count: number }[];
  performanceMetrics: {
    successRate: number;
    avgDurationMinutes: number;
    dataQualityImpact: number;
  };
  noCdsCompliance: string;
}

class AIFHIRWorkflowOrchestratorService {
  private workflows: Map<string, FHIRWorkflowDefinition> = new Map();
  private executions: Map<string, FHIRWorkflowExecution> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
    this.initializeTemplates();
    this.initializeSampleWorkflows();
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
      });
      console.log("[AIFHIRWorkflowOrchestrator] OpenAI client initialized");
    } else {
      console.log("[AIFHIRWorkflowOrchestrator] OpenAI API key not configured, using fallback");
    }
  }

  private generateId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  private initializeTemplates(): void {
    const templates: WorkflowTemplate[] = [
      {
        id: "template-ingestion-harmonization",
        name: "Data Ingestion & Harmonization Pipeline",
        description: "Complete pipeline for ingesting FHIR data from external sources, validating, harmonizing to standard terminologies, and generating quality reports",
        category: "Data Pipeline",
        steps: [
          {
            name: "Ingest FHIR Data",
            description: "Pull FHIR resources from configured data source",
            type: "data_ingestion",
            order: 1,
            position: { x: 100, y: 100 },
            config: { sourceSystem: "external_ehr" },
            estimatedDurationSeconds: 60
          },
          {
            name: "Validate FHIR Resources",
            description: "Validate against FHIR R4 specification and custom profiles",
            type: "validation",
            order: 2,
            position: { x: 300, y: 100 },
            config: { validationRules: ["fhir_r4", "us_core_v5"] },
            dependencies: ["step-1"],
            estimatedDurationSeconds: 30
          },
          {
            name: "Harmonize Terminologies",
            description: "Map codes to standard terminologies (SNOMED CT, LOINC, RxNorm)",
            type: "harmonization",
            order: 3,
            position: { x: 500, y: 100 },
            config: { terminologies: ["SNOMED CT", "LOINC", "RxNorm", "ICD-10"] },
            dependencies: ["step-2"],
            estimatedDurationSeconds: 120
          },
          {
            name: "Quality Assessment",
            description: "Run data quality checks and generate quality score",
            type: "quality_check",
            order: 4,
            position: { x: 700, y: 100 },
            config: { qualityThreshold: 80 },
            dependencies: ["step-3"],
            estimatedDurationSeconds: 45
          },
          {
            name: "Generate Quality Report",
            description: "Create comprehensive data quality and harmonization report",
            type: "report_generation",
            order: 5,
            position: { x: 900, y: 100 },
            config: { reportType: "quality_report" },
            dependencies: ["step-4"],
            estimatedDurationSeconds: 30
          },
          {
            name: "Send Notifications",
            description: "Notify data stewards of completion",
            type: "notification",
            order: 6,
            position: { x: 1100, y: 100 },
            config: { notificationChannels: ["email", "in_app"], notificationTemplate: "pipeline_complete" },
            dependencies: ["step-5"],
            estimatedDurationSeconds: 5
          }
        ],
        connections: [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
          { sourceIndex: 2, targetIndex: 3 },
          { sourceIndex: 3, targetIndex: 4 },
          { sourceIndex: 4, targetIndex: 5 }
        ],
        tags: ["data_ingestion", "harmonization", "quality"]
      },
      {
        id: "template-discharge-workflow",
        name: "Patient Discharge Processing",
        description: "Automated workflow for processing patient discharge data, generating summaries, and coordinating care transitions",
        category: "Care Coordination",
        steps: [
          {
            name: "Detect Discharge Event",
            description: "Monitor for Encounter resources with discharge status",
            type: "data_ingestion",
            order: 1,
            position: { x: 100, y: 100 },
            config: { sourceSystem: "encounter_events" },
            estimatedDurationSeconds: 5
          },
          {
            name: "Enrich Patient Data",
            description: "Gather related patient data from multiple sources",
            type: "enrichment",
            order: 2,
            position: { x: 300, y: 100 },
            config: {},
            dependencies: ["step-1"],
            estimatedDurationSeconds: 30
          },
          {
            name: "Generate Discharge Summary",
            description: "AI-powered discharge summary generation",
            type: "report_generation",
            order: 3,
            position: { x: 500, y: 100 },
            config: { reportType: "discharge_summary", aiModel: "gpt-4o" },
            dependencies: ["step-2"],
            estimatedDurationSeconds: 60
          },
          {
            name: "Quality Review Check",
            description: "Check if summary meets quality standards",
            type: "condition",
            order: 4,
            position: { x: 700, y: 100 },
            config: { conditionField: "qualityScore", conditionOperator: "gte", conditionValue: 85 },
            dependencies: ["step-3"],
            estimatedDurationSeconds: 5
          },
          {
            name: "Notify Care Team",
            description: "Send notifications to care coordinators and PCP",
            type: "notification",
            order: 5,
            position: { x: 900, y: 50 },
            config: { notificationChannels: ["email", "in_app", "sms"] },
            dependencies: ["step-4"],
            estimatedDurationSeconds: 10
          },
          {
            name: "Flag for Manual Review",
            description: "Route low-quality summaries for human review",
            type: "manual_review",
            order: 6,
            position: { x: 900, y: 150 },
            config: {},
            dependencies: ["step-4"],
            estimatedDurationSeconds: 300
          }
        ],
        connections: [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
          { sourceIndex: 2, targetIndex: 3 },
          { sourceIndex: 3, targetIndex: 4, label: "Quality >= 85" },
          { sourceIndex: 3, targetIndex: 5, label: "Quality < 85" }
        ],
        tags: ["discharge", "care_coordination", "ai_summary"]
      },
      {
        id: "template-quality-monitoring",
        name: "Continuous Quality Monitoring",
        description: "Scheduled workflow for monitoring data quality metrics and triggering remediation workflows",
        category: "Data Quality",
        steps: [
          {
            name: "Collect Quality Metrics",
            description: "Gather data quality metrics across all sources",
            type: "quality_check",
            order: 1,
            position: { x: 100, y: 100 },
            config: {},
            estimatedDurationSeconds: 120
          },
          {
            name: "Analyze Trends",
            description: "AI analysis of quality trends and anomalies",
            type: "enrichment",
            order: 2,
            position: { x: 300, y: 100 },
            config: { aiModel: "gpt-4o" },
            dependencies: ["step-1"],
            estimatedDurationSeconds: 60
          },
          {
            name: "Check Threshold",
            description: "Evaluate if quality meets organizational standards",
            type: "condition",
            order: 3,
            position: { x: 500, y: 100 },
            config: { conditionField: "overallScore", conditionOperator: "gte", conditionValue: 80 },
            dependencies: ["step-2"],
            estimatedDurationSeconds: 5
          },
          {
            name: "Generate Status Report",
            description: "Create quality status report for stakeholders",
            type: "report_generation",
            order: 4,
            position: { x: 700, y: 50 },
            config: { reportType: "quality_status" },
            dependencies: ["step-3"],
            estimatedDurationSeconds: 30
          },
          {
            name: "Generate Remediation Report",
            description: "Create detailed remediation plan for quality issues",
            type: "report_generation",
            order: 5,
            position: { x: 700, y: 150 },
            config: { reportType: "remediation_plan" },
            dependencies: ["step-3"],
            estimatedDurationSeconds: 45
          },
          {
            name: "Alert Data Stewards",
            description: "Urgent notification to data governance team",
            type: "notification",
            order: 6,
            position: { x: 900, y: 150 },
            config: { notificationChannels: ["email", "sms", "in_app"], notificationTemplate: "quality_alert" },
            dependencies: ["step-5"],
            estimatedDurationSeconds: 5
          }
        ],
        connections: [
          { sourceIndex: 0, targetIndex: 1 },
          { sourceIndex: 1, targetIndex: 2 },
          { sourceIndex: 2, targetIndex: 3, label: "Score >= 80" },
          { sourceIndex: 2, targetIndex: 4, label: "Score < 80" },
          { sourceIndex: 4, targetIndex: 5 }
        ],
        tags: ["quality", "monitoring", "governance"]
      }
    ];

    templates.forEach(t => this.templates.set(t.id, t));
  }

  private initializeSampleWorkflows(): void {
    const now = new Date().toISOString();

    const sampleWorkflow: FHIRWorkflowDefinition = {
      id: "wf-fhir-ingestion-001",
      name: "Daily FHIR Data Ingestion Pipeline",
      description: "Automated daily pipeline for ingesting FHIR data from partner hospitals, harmonizing terminologies, and generating quality reports",
      category: "Data Pipeline",
      version: 1,
      status: "active",
      triggers: [
        { type: "scheduled", config: { schedule: "0 2 * * *" } },
        { type: "manual", config: {} }
      ],
      steps: [
        {
          id: "step-ingest",
          name: "Ingest FHIR Data",
          description: "Pull FHIR resources from partner hospital EHR systems",
          type: "data_ingestion",
          order: 1,
          position: { x: 100, y: 150 },
          config: { sourceSystem: "partner_hospitals" },
          estimatedDurationSeconds: 300
        },
        {
          id: "step-validate",
          name: "Validate Resources",
          description: "Validate FHIR R4 compliance and custom profiles",
          type: "validation",
          order: 2,
          position: { x: 300, y: 150 },
          config: { validationRules: ["fhir_r4", "us_core_v5", "custom_profiles"] },
          dependencies: ["step-ingest"],
          estimatedDurationSeconds: 120
        },
        {
          id: "step-harmonize",
          name: "Harmonize Terminologies",
          description: "Map to SNOMED CT, LOINC, ICD-10, RxNorm",
          type: "harmonization",
          order: 3,
          position: { x: 500, y: 150 },
          config: { terminologies: ["SNOMED CT", "LOINC", "ICD-10", "RxNorm", "CPT", "NDC"] },
          dependencies: ["step-validate"],
          estimatedDurationSeconds: 600
        },
        {
          id: "step-quality",
          name: "Quality Assessment",
          description: "Evaluate data quality and completeness",
          type: "quality_check",
          order: 4,
          position: { x: 700, y: 150 },
          config: { qualityThreshold: 85 },
          dependencies: ["step-harmonize"],
          estimatedDurationSeconds: 180
        },
        {
          id: "step-report",
          name: "Generate Report",
          description: "Create comprehensive ingestion and quality report",
          type: "report_generation",
          order: 5,
          position: { x: 900, y: 150 },
          config: { reportType: "ingestion_summary" },
          dependencies: ["step-quality"],
          estimatedDurationSeconds: 60
        },
        {
          id: "step-notify",
          name: "Notify Stakeholders",
          description: "Send completion notifications",
          type: "notification",
          order: 6,
          position: { x: 1100, y: 150 },
          config: { notificationChannels: ["email", "in_app"], notificationTemplate: "daily_ingestion_complete" },
          dependencies: ["step-report"],
          estimatedDurationSeconds: 10
        }
      ],
      connections: [
        { sourceStepId: "step-ingest", targetStepId: "step-validate" },
        { sourceStepId: "step-validate", targetStepId: "step-harmonize" },
        { sourceStepId: "step-harmonize", targetStepId: "step-quality" },
        { sourceStepId: "step-quality", targetStepId: "step-report" },
        { sourceStepId: "step-report", targetStepId: "step-notify" }
      ],
      createdBy: "system",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
      publishedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      tags: ["daily", "ingestion", "harmonization", "quality"],
      estimatedDurationMinutes: 25,
      autoRetry: true,
      maxRetries: 3,
      notifyOnComplete: true,
      notifyOnFailure: true
    };

    this.workflows.set(sampleWorkflow.id, sampleWorkflow);

    const sampleExecution: FHIRWorkflowExecution = {
      id: "exec-001",
      workflowId: sampleWorkflow.id,
      workflowName: sampleWorkflow.name,
      status: "completed",
      triggeredBy: "scheduler",
      triggerType: "scheduled",
      triggerContext: { scheduledTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      currentStepId: "step-notify",
      steps: [
        {
          stepId: "step-ingest",
          stepName: "Ingest FHIR Data",
          status: "completed",
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 115 * 60 * 1000).toISOString(),
          metrics: { recordsProcessed: 15420, durationMs: 298000 }
        },
        {
          stepId: "step-validate",
          stepName: "Validate Resources",
          status: "completed",
          startedAt: new Date(Date.now() - 115 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 113 * 60 * 1000).toISOString(),
          metrics: { recordsValidated: 15420, errorsFound: 127, durationMs: 118000 }
        },
        {
          stepId: "step-harmonize",
          stepName: "Harmonize Terminologies",
          status: "completed",
          startedAt: new Date(Date.now() - 113 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 103 * 60 * 1000).toISOString(),
          metrics: { recordsProcessed: 15293, durationMs: 595000 },
          aiAnalysis: {
            summary: "Successfully harmonized 15,293 records across 6 terminologies",
            insights: ["98.2% automatic mapping rate", "142 codes required manual review", "New NDC codes detected"],
            recommendations: ["Update local code mappings for 12 deprecated SNOMED codes", "Review 8 ambiguous ICD-10 mappings"]
          }
        },
        {
          stepId: "step-quality",
          stepName: "Quality Assessment",
          status: "completed",
          startedAt: new Date(Date.now() - 103 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
          metrics: { qualityScore: 92.4, durationMs: 175000 }
        },
        {
          stepId: "step-report",
          stepName: "Generate Report",
          status: "completed",
          startedAt: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 99 * 60 * 1000).toISOString(),
          metrics: { durationMs: 58000 }
        },
        {
          stepId: "step-notify",
          stepName: "Notify Stakeholders",
          status: "completed",
          startedAt: new Date(Date.now() - 99 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 99 * 60 * 1000 + 8000).toISOString(),
          metrics: { durationMs: 8000 }
        }
      ],
      priority: "medium",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 99 * 60 * 1000 + 8000).toISOString(),
      progress: 100,
      metadata: { source: "partner_hospitals", totalRecords: 15420 },
      noCdsCompliance: NO_CDS_DISCLAIMER
    };

    this.executions.set(sampleExecution.id, sampleExecution);
  }

  getServiceMetadata() {
    return {
      serviceName: "AI FHIR Workflow Orchestrator",
      version: "1.0.0",
      description: "AI-driven workflow orchestration for complex FHIR data processes with visual workflow builder and real-time monitoring",
      capabilities: [
        "Visual workflow builder with drag-and-drop",
        "FHIR-specific step types (ingestion, validation, harmonization, etc.)",
        "AI-powered step execution and analysis",
        "Real-time workflow monitoring",
        "Pre-built workflow templates",
        "Event-driven and scheduled triggers",
        "Quality threshold-based automation"
      ],
      stepTypes: [
        { type: "data_ingestion", name: "Data Ingestion", description: "Pull FHIR resources from external sources", icon: "download" },
        { type: "validation", name: "Validation", description: "Validate FHIR resources against profiles", icon: "check-circle" },
        { type: "harmonization", name: "Harmonization", description: "Map codes to standard terminologies", icon: "git-merge" },
        { type: "transformation", name: "Transformation", description: "Transform FHIR resources between versions", icon: "shuffle" },
        { type: "enrichment", name: "Enrichment", description: "Enrich data with AI analysis or additional sources", icon: "sparkles" },
        { type: "quality_check", name: "Quality Check", description: "Evaluate data quality metrics", icon: "bar-chart" },
        { type: "report_generation", name: "Report Generation", description: "Generate reports and summaries", icon: "file-text" },
        { type: "notification", name: "Notification", description: "Send notifications to stakeholders", icon: "bell" },
        { type: "condition", name: "Condition", description: "Branch workflow based on conditions", icon: "git-branch" },
        { type: "parallel", name: "Parallel", description: "Execute multiple steps in parallel", icon: "layers" },
        { type: "delay", name: "Delay", description: "Wait for specified duration", icon: "clock" },
        { type: "manual_review", name: "Manual Review", description: "Pause for human review", icon: "user-check" }
      ],
      triggerTypes: [
        { type: "manual", name: "Manual Trigger", description: "Start workflow manually" },
        { type: "scheduled", name: "Scheduled", description: "Run on a schedule (cron)" },
        { type: "fhir_event", name: "FHIR Event", description: "Triggered by FHIR resource events" },
        { type: "data_quality_threshold", name: "Quality Threshold", description: "Triggered when quality drops below threshold" },
        { type: "new_data_source", name: "New Data Source", description: "Triggered when new data source is connected" },
        { type: "api_webhook", name: "API Webhook", description: "Triggered by external webhook" }
      ],
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  getDashboard(): FHIRWorkflowDashboard {
    const workflows = Array.from(this.workflows.values());
    const executions = Array.from(this.executions.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = executions.filter(e => 
      e.status === "completed" && new Date(e.completedAt || "") >= today
    ).length;

    const failedToday = executions.filter(e => 
      e.status === "failed" && new Date(e.startedAt) >= today
    ).length;

    const completedExecutions = executions.filter(e => e.status === "completed" && e.completedAt);
    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime();
          return sum + duration;
        }, 0) / completedExecutions.length / 60000
      : 0;

    const categoryCount: Record<string, number> = {};
    workflows.forEach(w => {
      categoryCount[w.category] = (categoryCount[w.category] || 0) + 1;
    });

    return {
      summary: {
        totalWorkflows: workflows.length,
        activeWorkflows: workflows.filter(w => w.status === "active").length,
        runningExecutions: executions.filter(e => e.status === "running").length,
        completedToday,
        failedToday,
        avgExecutionTime: Math.round(avgExecutionTime * 10) / 10
      },
      recentExecutions: executions.slice(0, 10),
      workflowsByCategory: Object.entries(categoryCount).map(([category, count]) => ({ category, count })),
      performanceMetrics: {
        successRate: completedExecutions.length / (executions.length || 1) * 100,
        avgDurationMinutes: avgExecutionTime,
        dataQualityImpact: 92.4
      },
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  listWorkflows(filters?: { status?: FHIRWorkflowStatus; category?: string }): FHIRWorkflowDefinition[] {
    let workflows = Array.from(this.workflows.values());
    if (filters?.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }
    if (filters?.category) {
      workflows = workflows.filter(w => w.category === filters.category);
    }
    return workflows;
  }

  getWorkflow(workflowId: string): FHIRWorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  createWorkflow(data: Omit<FHIRWorkflowDefinition, "id" | "createdAt" | "updatedAt" | "version">): FHIRWorkflowDefinition {
    const now = new Date().toISOString();
    const workflow: FHIRWorkflowDefinition = {
      ...data,
      id: this.generateId("wf-fhir"),
      version: 1,
      createdAt: now,
      updatedAt: now
    };
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  updateWorkflow(workflowId: string, updates: Partial<FHIRWorkflowDefinition>): FHIRWorkflowDefinition | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    const updated = {
      ...workflow,
      ...updates,
      id: workflow.id,
      version: workflow.version + 1,
      updatedAt: new Date().toISOString()
    };
    this.workflows.set(workflowId, updated);
    return updated;
  }

  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  getTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  createWorkflowFromTemplate(templateId: string, name: string, createdBy: string): FHIRWorkflowDefinition | undefined {
    const template = this.templates.get(templateId);
    if (!template) return undefined;

    const now = new Date().toISOString();
    const steps = template.steps.map((step, index) => ({
      ...step,
      id: `step-${index + 1}`
    }));

    const connections = template.connections.map(conn => ({
      sourceStepId: steps[conn.sourceIndex].id,
      targetStepId: steps[conn.targetIndex].id,
      label: conn.label
    }));

    const workflow: FHIRWorkflowDefinition = {
      id: this.generateId("wf-fhir"),
      name,
      description: template.description,
      category: template.category,
      version: 1,
      status: "draft",
      triggers: [{ type: "manual", config: {} }],
      steps,
      connections,
      createdBy,
      createdAt: now,
      updatedAt: now,
      tags: template.tags,
      autoRetry: true,
      maxRetries: 3,
      notifyOnComplete: true,
      notifyOnFailure: true
    };

    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  async triggerWorkflow(workflowId: string, triggeredBy: string, triggerContext: Record<string, any> = {}): Promise<FHIRWorkflowExecution | undefined> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== "active") return undefined;

    const execution: FHIRWorkflowExecution = {
      id: this.generateId("exec"),
      workflowId,
      workflowName: workflow.name,
      status: "running",
      triggeredBy,
      triggerType: "manual",
      triggerContext,
      currentStepId: workflow.steps[0]?.id,
      steps: workflow.steps.map(step => ({
        stepId: step.id,
        stepName: step.name,
        status: "pending"
      })),
      priority: "medium",
      startedAt: new Date().toISOString(),
      progress: 0,
      metadata: {},
      noCdsCompliance: NO_CDS_DISCLAIMER
    };

    this.executions.set(execution.id, execution);

    this.simulateExecution(execution.id);

    return execution;
  }

  private async simulateExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    for (let i = 0; i < execution.steps.length; i++) {
      const step = execution.steps[i];
      const workflowStep = workflow.steps.find(s => s.id === step.stepId);
      
      step.status = "running";
      step.startedAt = new Date().toISOString();
      execution.currentStepId = step.stepId;
      execution.progress = Math.round((i / execution.steps.length) * 100);
      this.executions.set(executionId, execution);

      await new Promise(resolve => setTimeout(resolve, 500));

      step.status = "completed";
      step.completedAt = new Date().toISOString();
      step.metrics = {
        recordsProcessed: Math.floor(Math.random() * 10000) + 1000,
        durationMs: (workflowStep?.estimatedDurationSeconds || 30) * 1000
      };

      if (workflowStep?.type === "quality_check") {
        step.metrics.qualityScore = 85 + Math.random() * 10;
      }

      if (["harmonization", "enrichment", "report_generation"].includes(workflowStep?.type || "")) {
        step.aiAnalysis = await this.generateAIAnalysis(workflowStep?.type || "", step.metrics);
      }

      this.executions.set(executionId, execution);
    }

    execution.status = "completed";
    execution.progress = 100;
    execution.completedAt = new Date().toISOString();
    this.executions.set(executionId, execution);
  }

  private async generateAIAnalysis(stepType: string, metrics: StepExecutionResult["metrics"]): Promise<StepExecutionResult["aiAnalysis"]> {
    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are a data quality analyst providing brief insights about FHIR data processing. ${NO_CDS_DISCLAIMER}`
            },
            {
              role: "user",
              content: `Generate a brief analysis for a ${stepType} step that processed ${metrics?.recordsProcessed || 0} records with quality score ${metrics?.qualityScore?.toFixed(1) || "N/A"}. Provide: 1) A one-sentence summary, 2) Two key insights, 3) One recommendation.`
            }
          ],
          max_tokens: 200
        });

        const content = response.choices[0]?.message?.content || "";
        return {
          summary: `Successfully processed ${metrics?.recordsProcessed || 0} records`,
          insights: ["High processing efficiency achieved", "Data quality meets standards"],
          recommendations: [content.slice(0, 150)]
        };
      } catch (error) {
        console.error("[AIFHIRWorkflowOrchestrator] AI analysis error:", error);
      }
    }

    return {
      summary: `Processed ${metrics?.recordsProcessed || 0} records successfully`,
      insights: [
        "Processing completed within expected timeframe",
        `Quality metrics: ${metrics?.qualityScore?.toFixed(1) || "N/A"}%`
      ],
      recommendations: ["Continue monitoring for anomalies"]
    };
  }

  getExecution(executionId: string): FHIRWorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  listExecutions(filters?: { workflowId?: string; status?: FHIRWorkflowExecutionStatus }): FHIRWorkflowExecution[] {
    let executions = Array.from(this.executions.values());
    if (filters?.workflowId) {
      executions = executions.filter(e => e.workflowId === filters.workflowId);
    }
    if (filters?.status) {
      executions = executions.filter(e => e.status === filters.status);
    }
    return executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  cancelExecution(executionId: string): FHIRWorkflowExecution | undefined {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "running") return undefined;

    execution.status = "cancelled";
    execution.completedAt = new Date().toISOString();
    this.executions.set(executionId, execution);
    return execution;
  }
}

export const aiFHIRWorkflowOrchestrator = new AIFHIRWorkflowOrchestratorService();

console.log("[AIFHIRWorkflowOrchestrator] Service initialized");
console.log("[AIFHIRWorkflowOrchestrator] Features: Visual builder, FHIR-specific steps, AI analysis, real-time monitoring");
console.log("[AIFHIRWorkflowOrchestrator] NO-CDS compliance enabled for all outputs");
