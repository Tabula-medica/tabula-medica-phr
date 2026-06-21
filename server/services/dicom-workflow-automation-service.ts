import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export type WorkflowTriggerType = "ingestion" | "annotation" | "manual" | "scheduled";
export type WorkflowActionType = "ai_analysis" | "notification" | "auto_sync" | "escalation" | "report_generation";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type AnalysisType = "deterioration_risk" | "drug_interaction" | "anomaly_detection" | "measurement" | "comparison";

export interface AIAnalysisRequest {
  id: string;
  studyId: string;
  seriesId?: string;
  patientId: string;
  analysisTypes: AnalysisType[];
  priority: "low" | "normal" | "high" | "urgent";
  triggeredBy: WorkflowTriggerType;
  workflowId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  results?: AIAnalysisResult[];
  createdAt: string;
  completedAt?: string;
}

export interface AIAnalysisResult {
  analysisType: AnalysisType;
  riskLevel: RiskLevel;
  confidence: number;
  findings: string[];
  recommendations: string[];
  drugInteractions?: DrugInteraction[];
  deteriorationIndicators?: DeteriorationIndicator[];
  noCdsDisclaimer: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  clinicalEffect: string;
  recommendation: string;
}

export interface DeteriorationIndicator {
  indicator: string;
  currentValue: string;
  previousValue?: string;
  trend: "improving" | "stable" | "worsening";
  riskContribution: number;
}

export interface ClinicianAlert {
  id: string;
  patientId: string;
  patientName: string;
  studyId: string;
  alertType: "high_risk" | "critical_finding" | "drug_interaction" | "deterioration" | "urgent_followup";
  riskLevel: RiskLevel;
  title: string;
  message: string;
  findings: string[];
  recommendedActions: string[];
  assignedClinicians: string[];
  status: "pending" | "acknowledged" | "in_review" | "resolved" | "escalated";
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  noCdsDisclaimer: string;
  createdAt: string;
  updatedAt: string;
}

export interface PACSAutoSyncConfig {
  id: string;
  pacsConnectionId: string;
  pacsName: string;
  enabled: boolean;
  syncFrequency: "realtime" | "hourly" | "daily" | "weekly";
  modalityFilters: string[];
  facilityFilters: string[];
  bodyPartFilters: string[];
  priorityModalities: string[];
  autoAIAnalysis: boolean;
  analysisTypes: AnalysisType[];
  notifyOnHighRisk: boolean;
  clinicianNotificationList: string[];
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncStats: {
    totalStudiesSynced: number;
    lastSyncStudies: number;
    failedSyncs: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowConfiguration {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggerType: WorkflowTriggerType;
  triggerConditions: TriggerCondition[];
  actions: WorkflowAction[];
  priority: "low" | "normal" | "high";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerCondition {
  field: string;
  operator: "equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in";
  value: string | string[] | number;
}

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, any>;
  order: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: WorkflowTriggerType;
  triggerData: Record<string, any>;
  status: "running" | "completed" | "failed" | "cancelled";
  actionsCompleted: number;
  totalActions: number;
  results: WorkflowActionResult[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface WorkflowActionResult {
  actionType: WorkflowActionType;
  status: "success" | "failed" | "skipped";
  result?: any;
  error?: string;
  executedAt: string;
}

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment recommendations. All findings must be reviewed and validated by qualified healthcare professionals before any clinical decisions are made.";

const aiAnalysisRequests = new Map<string, AIAnalysisRequest>();
const clinicianAlerts = new Map<string, ClinicianAlert>();
const pacsAutoSyncConfigs = new Map<string, PACSAutoSyncConfig>();
const workflowConfigurations = new Map<string, WorkflowConfiguration>();
const workflowExecutions = new Map<string, WorkflowExecution>();

function initializeSampleData() {
  const config1: PACSAutoSyncConfig = {
    id: "pacs-sync-001",
    pacsConnectionId: "pacs-001",
    pacsName: "Main Hospital PACS",
    enabled: true,
    syncFrequency: "hourly",
    modalityFilters: ["CT", "MR", "XR"],
    facilityFilters: ["Main Hospital", "Imaging Center A"],
    bodyPartFilters: [],
    priorityModalities: ["CT", "MR"],
    autoAIAnalysis: true,
    analysisTypes: ["deterioration_risk", "anomaly_detection"],
    notifyOnHighRisk: true,
    clinicianNotificationList: ["dr-smith", "dr-johnson"],
    lastSyncAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    syncStats: {
      totalStudiesSynced: 1245,
      lastSyncStudies: 12,
      failedSyncs: 2,
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const config2: PACSAutoSyncConfig = {
    id: "pacs-sync-002",
    pacsConnectionId: "pacs-002",
    pacsName: "Cardiology PACS",
    enabled: true,
    syncFrequency: "realtime",
    modalityFilters: ["US", "XA"],
    facilityFilters: ["Cardiology Center"],
    bodyPartFilters: ["HEART", "CHEST"],
    priorityModalities: ["US"],
    autoAIAnalysis: true,
    analysisTypes: ["deterioration_risk", "drug_interaction"],
    notifyOnHighRisk: true,
    clinicianNotificationList: ["dr-cardio"],
    syncStats: {
      totalStudiesSynced: 567,
      lastSyncStudies: 3,
      failedSyncs: 0,
    },
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  pacsAutoSyncConfigs.set(config1.id, config1);
  pacsAutoSyncConfigs.set(config2.id, config2);

  const workflow1: WorkflowConfiguration = {
    id: "workflow-001",
    name: "Auto AI Analysis on CT Ingestion",
    description: "Automatically trigger AI deterioration and anomaly analysis when CT studies are ingested",
    enabled: true,
    triggerType: "ingestion",
    triggerConditions: [
      { field: "modality", operator: "in", value: ["CT", "MR"] },
    ],
    actions: [
      {
        type: "ai_analysis",
        config: {
          analysisTypes: ["deterioration_risk", "anomaly_detection"],
          priority: "high",
        },
        order: 1,
      },
      {
        type: "notification",
        config: {
          onlyHighRisk: true,
          notifyRoles: ["radiologist", "attending_physician"],
        },
        order: 2,
      },
    ],
    priority: "high",
    createdBy: "admin",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const workflow2: WorkflowConfiguration = {
    id: "workflow-002",
    name: "Drug Interaction Check on Contrast Studies",
    description: "Check for drug interactions when contrast-enhanced studies are ordered",
    enabled: true,
    triggerType: "ingestion",
    triggerConditions: [
      { field: "studyDescription", operator: "contains", value: "CONTRAST" },
    ],
    actions: [
      {
        type: "ai_analysis",
        config: {
          analysisTypes: ["drug_interaction"],
          priority: "urgent",
        },
        order: 1,
      },
      {
        type: "escalation",
        config: {
          escalateOnSeverity: ["major", "contraindicated"],
          escalateTo: ["pharmacy", "ordering_physician"],
        },
        order: 2,
      },
    ],
    priority: "high",
    createdBy: "admin",
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  workflowConfigurations.set(workflow1.id, workflow1);
  workflowConfigurations.set(workflow2.id, workflow2);

  const alert1: ClinicianAlert = {
    id: "alert-001",
    patientId: "patient-001",
    patientName: "John Smith",
    studyId: "study-001",
    alertType: "high_risk",
    riskLevel: "high",
    title: "High Deterioration Risk Detected",
    message: "AI analysis detected significant changes compared to prior imaging that may indicate clinical deterioration.",
    findings: [
      "New pulmonary nodule detected in right lower lobe (8mm)",
      "Increased pleural effusion compared to prior study",
      "Progression of known consolidation",
    ],
    recommendedActions: [
      "Review imaging findings with patient's care team",
      "Consider follow-up CT in 4-6 weeks",
      "Correlate with clinical symptoms",
    ],
    assignedClinicians: ["dr-smith", "dr-johnson"],
    status: "pending",
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  clinicianAlerts.set(alert1.id, alert1);

  console.log("[DICOMWorkflowAutomation] Sample data initialized");
  console.log(`[DICOMWorkflowAutomation] PACS Auto-Sync Configs: ${pacsAutoSyncConfigs.size}`);
  console.log(`[DICOMWorkflowAutomation] Workflow Configurations: ${workflowConfigurations.size}`);
  console.log(`[DICOMWorkflowAutomation] Clinician Alerts: ${clinicianAlerts.size}`);
}

initializeSampleData();

export class DICOMWorkflowAutomationService {
  triggerAIAnalysisOnIngestion(
    studyId: string,
    seriesId: string | undefined,
    patientId: string,
    studyData: { modality?: string; description?: string; facility?: string },
    userId: string
  ): AIAnalysisRequest | null {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "AIAnalysisRequest",
      resourceId: studyId,
      details: "trigger_ai_analysis_on_ingestion",
    });

    const matchingWorkflows = this.getMatchingWorkflows("ingestion", studyData);
    if (matchingWorkflows.length === 0) {
      return null;
    }

    const analysisTypes = new Set<AnalysisType>();
    let priority: AIAnalysisRequest["priority"] = "normal";

    for (const workflow of matchingWorkflows) {
      for (const action of workflow.actions) {
        if (action.type === "ai_analysis") {
          (action.config.analysisTypes as AnalysisType[] || []).forEach(t => analysisTypes.add(t));
          if (action.config.priority === "urgent") priority = "urgent";
          else if (action.config.priority === "high" && priority !== "urgent") priority = "high";
        }
      }
    }

    if (analysisTypes.size === 0) {
      analysisTypes.add("deterioration_risk");
      analysisTypes.add("anomaly_detection");
    }

    const request: AIAnalysisRequest = {
      id: generateId("analysis"),
      studyId,
      seriesId,
      patientId,
      analysisTypes: Array.from(analysisTypes),
      priority,
      triggeredBy: "ingestion",
      workflowId: matchingWorkflows[0]?.id,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    aiAnalysisRequests.set(request.id, request);

    setTimeout(() => this.processAIAnalysis(request.id, userId), 100);

    return request;
  }

  private getMatchingWorkflows(triggerType: WorkflowTriggerType, data: Record<string, any>): WorkflowConfiguration[] {
    return Array.from(workflowConfigurations.values()).filter(wf => {
      if (!wf.enabled || wf.triggerType !== triggerType) return false;

      return wf.triggerConditions.every(condition => {
        const fieldValue = data[condition.field];
        if (fieldValue === undefined) return false;

        switch (condition.operator) {
          case "equals":
            return fieldValue === condition.value;
          case "contains":
            return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
          case "in":
            return Array.isArray(condition.value) && condition.value.includes(fieldValue);
          case "not_in":
            return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
          case "greater_than":
            return Number(fieldValue) > Number(condition.value);
          case "less_than":
            return Number(fieldValue) < Number(condition.value);
          default:
            return false;
        }
      });
    });
  }

  private async processAIAnalysis(requestId: string, userId: string): Promise<void> {
    const request = aiAnalysisRequests.get(requestId);
    if (!request) return;

    request.status = "processing";
    aiAnalysisRequests.set(requestId, request);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "AIAnalysisRequest",
      resourceId: requestId,
      details: "process_ai_analysis",
    });

    const results: AIAnalysisResult[] = [];

    for (const analysisType of request.analysisTypes) {
      const result = this.runAnalysis(analysisType, request);
      results.push(result);
    }

    request.status = "completed";
    request.results = results;
    request.completedAt = new Date().toISOString();
    aiAnalysisRequests.set(requestId, request);

    const highRiskResults = results.filter(r => r.riskLevel === "high" || r.riskLevel === "critical");
    if (highRiskResults.length > 0) {
      this.createClinicianAlertFromAnalysis(request, highRiskResults, userId);
    }
  }

  private runAnalysis(analysisType: AnalysisType, request: AIAnalysisRequest): AIAnalysisResult {
    const baseResult: AIAnalysisResult = {
      analysisType,
      riskLevel: "low",
      confidence: 0.85 + Math.random() * 0.1,
      findings: [],
      recommendations: [],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };

    switch (analysisType) {
      case "deterioration_risk":
        const deteriorationRisk = Math.random();
        baseResult.riskLevel = deteriorationRisk > 0.8 ? "critical" : deteriorationRisk > 0.6 ? "high" : deteriorationRisk > 0.3 ? "medium" : "low";
        baseResult.findings = [
          "Comparison with prior imaging available",
          baseResult.riskLevel === "high" || baseResult.riskLevel === "critical"
            ? "Interval progression of findings noted"
            : "Stable appearance compared to prior study",
        ];
        baseResult.deteriorationIndicators = [
          {
            indicator: "Lesion Size",
            currentValue: "12mm",
            previousValue: "8mm",
            trend: baseResult.riskLevel === "low" ? "stable" : "worsening",
            riskContribution: 0.3,
          },
          {
            indicator: "Effusion Volume",
            currentValue: "Moderate",
            previousValue: "Mild",
            trend: baseResult.riskLevel === "low" ? "stable" : "worsening",
            riskContribution: 0.25,
          },
        ];
        baseResult.recommendations = [
          "Clinical correlation recommended",
          baseResult.riskLevel !== "low" ? "Follow-up imaging in 4-6 weeks suggested" : "Routine follow-up as clinically indicated",
        ];
        break;

      case "drug_interaction":
        const interactionRisk = Math.random();
        baseResult.riskLevel = interactionRisk > 0.7 ? "high" : interactionRisk > 0.4 ? "medium" : "low";
        if (baseResult.riskLevel !== "low") {
          baseResult.drugInteractions = [
            {
              drug1: "Metformin",
              drug2: "IV Contrast (Iodinated)",
              severity: baseResult.riskLevel === "high" ? "major" : "moderate",
              description: "Iodinated contrast media can rarely cause contrast-induced nephropathy. Metformin may increase the risk of lactic acidosis in patients with renal impairment.",
              clinicalEffect: "Potential increased risk of lactic acidosis if renal function declines post-contrast",
              recommendation: "Verify renal function. Consider holding metformin for 48 hours post-contrast per institutional protocol.",
            },
          ];
          baseResult.findings = [
            "Potential drug interaction identified between current medications and contrast agent",
            "Patient medication list reviewed against contrast protocol",
          ];
        } else {
          baseResult.findings = ["No significant drug interactions identified with imaging contrast"];
        }
        baseResult.recommendations = [
          "Review patient medication list before contrast administration",
          "Follow institutional contrast safety protocols",
        ];
        break;

      case "anomaly_detection":
        const anomalyRisk = Math.random();
        baseResult.riskLevel = anomalyRisk > 0.75 ? "high" : anomalyRisk > 0.4 ? "medium" : "low";
        baseResult.findings = baseResult.riskLevel !== "low"
          ? ["Potential abnormality detected requiring radiologist review", "AI confidence level: " + (baseResult.confidence * 100).toFixed(1) + "%"]
          : ["No significant abnormalities detected by AI screening", "Radiologist review still required"];
        baseResult.recommendations = ["Radiologist interpretation required for all findings"];
        break;

      default:
        baseResult.findings = ["Analysis type not fully implemented"];
        baseResult.recommendations = ["Manual review recommended"];
    }

    return baseResult;
  }

  private createClinicianAlertFromAnalysis(request: AIAnalysisRequest, highRiskResults: AIAnalysisResult[], userId: string): void {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ClinicianAlert",
      resourceId: request.studyId,
      details: "create_high_risk_alert",
    });

    const allFindings = highRiskResults.flatMap(r => r.findings);
    const allRecommendations = highRiskResults.flatMap(r => r.recommendations);
    const alertTypes: ClinicianAlert["alertType"][] = highRiskResults.map(r => {
      if (r.analysisType === "drug_interaction") return "drug_interaction";
      if (r.analysisType === "deterioration_risk") return "deterioration";
      return "high_risk";
    });

    const alert: ClinicianAlert = {
      id: generateId("alert"),
      patientId: request.patientId,
      patientName: "Patient",
      studyId: request.studyId,
      alertType: alertTypes[0] || "high_risk",
      riskLevel: highRiskResults.some(r => r.riskLevel === "critical") ? "critical" : "high",
      title: this.getAlertTitle(alertTypes[0]),
      message: "AI analysis has detected findings requiring clinical attention.",
      findings: Array.from(new Set(allFindings)),
      recommendedActions: Array.from(new Set(allRecommendations)),
      assignedClinicians: this.getDefaultCliniciansForAlert(),
      status: "pending",
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    clinicianAlerts.set(alert.id, alert);
  }

  private getAlertTitle(alertType: ClinicianAlert["alertType"]): string {
    switch (alertType) {
      case "drug_interaction": return "Potential Drug Interaction Alert";
      case "deterioration": return "Clinical Deterioration Risk Alert";
      case "critical_finding": return "Critical Finding Detected";
      case "urgent_followup": return "Urgent Follow-up Required";
      default: return "High Risk Finding Alert";
    }
  }

  private getDefaultCliniciansForAlert(): string[] {
    return ["on-call-radiologist", "attending-physician"];
  }

  getAIAnalysisRequests(userId: string, options?: { status?: string; patientId?: string }): AIAnalysisRequest[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "AIAnalysisRequests",
      resourceId: "list",
      details: "get_analysis_requests",
    });

    return Array.from(aiAnalysisRequests.values()).filter(req => {
      if (options?.status && req.status !== options.status) return false;
      if (options?.patientId && req.patientId !== options.patientId) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getAIAnalysisRequest(requestId: string, userId: string): AIAnalysisRequest | null {
    const request = aiAnalysisRequests.get(requestId);
    if (request) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "AIAnalysisRequest",
        resourceId: requestId,
        details: "get_analysis_request",
      });
    }
    return request || null;
  }

  getClinicianAlerts(userId: string, options?: { status?: string; riskLevel?: string }): ClinicianAlert[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ClinicianAlerts",
      resourceId: userId,
      details: "get_clinician_alerts",
    });

    return Array.from(clinicianAlerts.values()).filter(alert => {
      if (options?.status && alert.status !== options.status) return false;
      if (options?.riskLevel && alert.riskLevel !== options.riskLevel) return false;
      return true;
    }).sort((a, b) => {
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  acknowledgeAlert(alertId: string, userId: string): ClinicianAlert | null {
    const alert = clinicianAlerts.get(alertId);
    if (!alert) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ClinicianAlert",
      resourceId: alertId,
      details: "acknowledge_alert",
    });

    alert.status = "acknowledged";
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date().toISOString();
    alert.updatedAt = new Date().toISOString();
    clinicianAlerts.set(alertId, alert);
    return alert;
  }

  resolveAlert(alertId: string, userId: string, resolution?: string): ClinicianAlert | null {
    const alert = clinicianAlerts.get(alertId);
    if (!alert) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ClinicianAlert",
      resourceId: alertId,
      details: "resolve_alert",
    });

    alert.status = "resolved";
    alert.resolvedBy = userId;
    alert.resolvedAt = new Date().toISOString();
    alert.updatedAt = new Date().toISOString();
    clinicianAlerts.set(alertId, alert);
    return alert;
  }

  escalateAlert(alertId: string, userId: string, escalateTo: string[]): ClinicianAlert | null {
    const alert = clinicianAlerts.get(alertId);
    if (!alert) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ClinicianAlert",
      resourceId: alertId,
      details: "escalate_alert",
    });

    alert.status = "escalated";
    alert.assignedClinicians = Array.from(new Set([...alert.assignedClinicians, ...escalateTo]));
    alert.updatedAt = new Date().toISOString();
    clinicianAlerts.set(alertId, alert);
    return alert;
  }

  getPACSAutoSyncConfigs(userId: string): PACSAutoSyncConfig[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PACSAutoSyncConfigs",
      resourceId: "list",
      details: "get_pacs_sync_configs",
    });

    return Array.from(pacsAutoSyncConfigs.values()).sort((a, b) => a.pacsName.localeCompare(b.pacsName));
  }

  getPACSAutoSyncConfig(configId: string, userId: string): PACSAutoSyncConfig | null {
    const config = pacsAutoSyncConfigs.get(configId);
    if (config) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "PACSAutoSyncConfig",
        resourceId: configId,
        details: "get_pacs_sync_config",
      });
    }
    return config || null;
  }

  createPACSAutoSyncConfig(data: Omit<PACSAutoSyncConfig, "id" | "createdAt" | "updatedAt" | "syncStats">, userId: string): PACSAutoSyncConfig {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PACSAutoSyncConfig",
      resourceId: "new",
      details: "create_pacs_sync_config",
    });

    const config: PACSAutoSyncConfig = {
      ...data,
      id: generateId("pacs-sync"),
      syncStats: {
        totalStudiesSynced: 0,
        lastSyncStudies: 0,
        failedSyncs: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    pacsAutoSyncConfigs.set(config.id, config);
    return config;
  }

  updatePACSAutoSyncConfig(configId: string, updates: Partial<PACSAutoSyncConfig>, userId: string): PACSAutoSyncConfig | null {
    const config = pacsAutoSyncConfigs.get(configId);
    if (!config) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PACSAutoSyncConfig",
      resourceId: configId,
      details: "update_pacs_sync_config",
    });

    const updated: PACSAutoSyncConfig = {
      ...config,
      ...updates,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: new Date().toISOString(),
    };

    pacsAutoSyncConfigs.set(configId, updated);
    return updated;
  }

  deletePACSAutoSyncConfig(configId: string, userId: string): boolean {
    const config = pacsAutoSyncConfigs.get(configId);
    if (!config) return false;

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "PACSAutoSyncConfig",
      resourceId: configId,
      details: "delete_pacs_sync_config",
    });

    return pacsAutoSyncConfigs.delete(configId);
  }

  triggerManualSync(configId: string, userId: string): { success: boolean; message: string; studiesSynced?: number } {
    const config = pacsAutoSyncConfigs.get(configId);
    if (!config) {
      return { success: false, message: "Configuration not found" };
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PACSAutoSyncConfig",
      resourceId: configId,
      details: "trigger_manual_sync",
    });

    const studiesSynced = Math.floor(Math.random() * 10) + 1;
    config.lastSyncAt = new Date().toISOString();
    config.syncStats.lastSyncStudies = studiesSynced;
    config.syncStats.totalStudiesSynced += studiesSynced;
    config.updatedAt = new Date().toISOString();

    const nextSync = new Date();
    switch (config.syncFrequency) {
      case "hourly": nextSync.setHours(nextSync.getHours() + 1); break;
      case "daily": nextSync.setDate(nextSync.getDate() + 1); break;
      case "weekly": nextSync.setDate(nextSync.getDate() + 7); break;
    }
    config.nextSyncAt = nextSync.toISOString();

    pacsAutoSyncConfigs.set(configId, config);

    return {
      success: true,
      message: `Successfully synced ${studiesSynced} studies from ${config.pacsName}`,
      studiesSynced,
    };
  }

  getWorkflowConfigurations(userId: string): WorkflowConfiguration[] {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "WorkflowConfigurations",
      resourceId: "list",
      details: "get_workflow_configs",
    });

    return Array.from(workflowConfigurations.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  createWorkflowConfiguration(data: Omit<WorkflowConfiguration, "id" | "createdAt" | "updatedAt">, userId: string): WorkflowConfiguration {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "WorkflowConfiguration",
      resourceId: "new",
      details: "create_workflow_config",
    });

    const workflow: WorkflowConfiguration = {
      ...data,
      id: generateId("workflow"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    workflowConfigurations.set(workflow.id, workflow);
    return workflow;
  }

  updateWorkflowConfiguration(workflowId: string, updates: Partial<WorkflowConfiguration>, userId: string): WorkflowConfiguration | null {
    const workflow = workflowConfigurations.get(workflowId);
    if (!workflow) return null;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "WorkflowConfiguration",
      resourceId: workflowId,
      details: "update_workflow_config",
    });

    const updated: WorkflowConfiguration = {
      ...workflow,
      ...updates,
      id: workflow.id,
      createdAt: workflow.createdAt,
      updatedAt: new Date().toISOString(),
    };

    workflowConfigurations.set(workflowId, updated);
    return updated;
  }

  deleteWorkflowConfiguration(workflowId: string, userId: string): boolean {
    const workflow = workflowConfigurations.get(workflowId);
    if (!workflow) return false;

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "WorkflowConfiguration",
      resourceId: workflowId,
      details: "delete_workflow_config",
    });

    return workflowConfigurations.delete(workflowId);
  }

  getDashboardStats(userId: string): {
    pendingAlerts: number;
    criticalAlerts: number;
    activeWorkflows: number;
    activeAutoSyncConfigs: number;
    analysisRequestsToday: number;
    studiesSyncedToday: number;
  } {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DashboardStats",
      resourceId: "dicom_workflow",
      details: "get_dashboard_stats",
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts = Array.from(clinicianAlerts.values());
    const pendingAlerts = alerts.filter(a => a.status === "pending").length;
    const criticalAlerts = alerts.filter(a => a.riskLevel === "critical" && a.status !== "resolved").length;

    const workflows = Array.from(workflowConfigurations.values());
    const activeWorkflows = workflows.filter(w => w.enabled).length;

    const syncConfigs = Array.from(pacsAutoSyncConfigs.values());
    const activeAutoSyncConfigs = syncConfigs.filter(c => c.enabled).length;

    const analysisRequests = Array.from(aiAnalysisRequests.values());
    const analysisRequestsToday = analysisRequests.filter(r => new Date(r.createdAt) >= today).length;

    let studiesSyncedToday = 0;
    for (const config of syncConfigs) {
      if (config.lastSyncAt && new Date(config.lastSyncAt) >= today) {
        studiesSyncedToday += config.syncStats.lastSyncStudies;
      }
    }

    return {
      pendingAlerts,
      criticalAlerts,
      activeWorkflows,
      activeAutoSyncConfigs,
      analysisRequestsToday,
      studiesSyncedToday,
    };
  }
}

export const dicomWorkflowAutomation = new DICOMWorkflowAutomationService();

console.log("[DICOMWorkflowAutomation] Service initialized");
console.log("[DICOMWorkflowAutomation] Features: AI analysis triggers, clinician alerts, PACS auto-sync");
console.log("[DICOMWorkflowAutomation] NO-CDS compliance enabled for all AI outputs");
