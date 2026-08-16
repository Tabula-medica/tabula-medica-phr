import { generatePhiSafeText } from "./ai-gateway";
import crypto from "crypto";

// PHI-bearing generation runs through the Vertex/BAA gateway (P1-1.2).
const aiEnabled = true;

if (aiEnabled) {
  console.log("[AIWorkflowAutomation] Vertex/BAA gateway enabled for event-driven automation");
}

const NO_CDS_DISCLAIMER = "CRITICAL COMPLIANCE NOTICE: This automation is for DATA QUALITY, GOVERNANCE, and OPERATIONAL efficiency purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice. All outputs must be reviewed by qualified personnel. This system explicitly DOES NOT make clinical decisions.";

export interface FHIREventTrigger {
  id: string;
  eventType: "resource_created" | "resource_updated" | "resource_deleted" | "batch_import";
  resourceType: string;
  patientId: string;
  resourceId: string;
  timestamp: Date;
  sourceSystem: string;
  metadata?: Record<string, unknown>;
}

export interface DataQualityAssessment {
  id: string;
  patientId: string;
  triggeredBy: string;
  assessmentType: "completeness" | "consistency" | "timeliness" | "accuracy";
  score: number;
  issues: DataQualityIssue[];
  recommendations: string[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface DataQualityIssue {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedResources: string[];
  suggestedAction: string;
}

export interface MedicationDataAlert {
  id: string;
  alertType: "potential_data_conflict" | "missing_dosage_info" | "format_inconsistency" | "temporal_gap" | "duplicate_entry";
  severity: "critical" | "high" | "medium" | "low";
  patientId: string;
  medications: MedicationDataIssue[];
  dataQualityImpact: string;
  suggestedDataRemediation: string;
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface MedicationDataIssue {
  medicationId: string;
  medicationName: string;
  issueDescription: string;
  sourceConflicts: { source: string; value: unknown }[];
}

export interface RemediationTask {
  id: string;
  taskType: "data_correction" | "source_reconciliation" | "manual_review" | "automated_fix" | "escalation";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedResources: string[];
  suggestedActions: string[];
  estimatedEffort: string;
  assignedTo?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: Date;
  dueDate?: Date;
  correlatedAlerts: string[];
  noCdsCompliance: string;
}

export interface SecurityRecommendation {
  id: string;
  findingId: string;
  findingSeverity: "critical" | "high" | "medium" | "low";
  category: "access_control" | "encryption" | "audit_logging" | "consent_management" | "network_security" | "data_masking";
  currentConfiguration: Record<string, unknown>;
  recommendedConfiguration: Record<string, unknown>;
  rationale: string;
  implementationSteps: string[];
  riskReduction: string;
  complianceImpact: string[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface WorkflowAutomationStats {
  totalEventsProcessed: number;
  assessmentsGenerated: number;
  medicationAlertsGenerated: number;
  remediationTasksCreated: number;
  securityRecommendations: number;
  automatedReportsGenerated: number;
  complianceAlertsTriggered: number;
  byEventType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface AutomatedReportTrigger {
  id: string;
  triggerType: "discharge_event" | "quality_threshold" | "scheduled" | "manual" | "encounter_complete";
  triggeredBy: string;
  patientId?: string;
  reportType: "patient_summary" | "discharge_summary" | "compliance_report" | "quality_report" | "audit_report";
  status: "pending" | "generating" | "completed" | "failed";
  priority: "urgent" | "high" | "medium" | "low";
  createdAt: Date;
  completedAt?: Date;
  reportId?: string;
  noCdsCompliance: string;
}

export interface GeneratedReport {
  id: string;
  reportType: AutomatedReportTrigger["reportType"];
  title: string;
  patientId?: string;
  triggerId: string;
  content: ReportContent;
  format: "json" | "pdf" | "fhir_bundle";
  generatedAt: Date;
  expiresAt?: Date;
  downloadUrl?: string;
  noCdsCompliance: string;
}

export interface ReportContent {
  summary: string;
  sections: ReportSection[];
  dataQualityScore?: number;
  complianceStatus?: string;
  recommendations: string[];
  metadata: Record<string, unknown>;
}

export interface ReportSection {
  title: string;
  content: string;
  dataPoints?: Record<string, unknown>[];
  charts?: { type: string; data: unknown }[];
}

export interface QualityThresholdConfig {
  id: string;
  name: string;
  thresholdType: "data_quality" | "completeness" | "timeliness" | "accuracy";
  thresholdValue: number;
  comparisonOperator: "lt" | "lte" | "gt" | "gte" | "eq";
  reportType: AutomatedReportTrigger["reportType"];
  enabled: boolean;
  notifyRoles: string[];
  lastTriggered?: Date;
  createdAt: Date;
}

export interface EventDrivenRule {
  id: string;
  name: string;
  description: string;
  eventPattern: {
    resourceType: string;
    eventType: FHIREventTrigger["eventType"];
    conditions?: Record<string, unknown>;
  };
  action: {
    type: "generate_report" | "send_notification" | "create_task" | "trigger_workflow";
    reportType?: AutomatedReportTrigger["reportType"];
    priority?: AutomatedReportTrigger["priority"];
    notifyRoles?: string[];
  };
  enabled: boolean;
  executionCount: number;
  lastExecuted?: Date;
  createdAt: Date;
}

const dataQualityAssessments = new Map<string, DataQualityAssessment>();
const automatedReportTriggers = new Map<string, AutomatedReportTrigger>();
const generatedReports = new Map<string, GeneratedReport>();
const qualityThresholds = new Map<string, QualityThresholdConfig>();
const eventDrivenRules = new Map<string, EventDrivenRule>();
const medicationDataAlerts = new Map<string, MedicationDataAlert>();
const remediationTasks = new Map<string, RemediationTask>();
const securityRecommendations = new Map<string, SecurityRecommendation>();
const eventLog: FHIREventTrigger[] = [];

function initializeSampleData() {
  const now = new Date();

  const assessment1: DataQualityAssessment = {
    id: "assess-001",
    patientId: "patient-001",
    triggeredBy: "event-fhir-import-001",
    assessmentType: "completeness",
    score: 78.5,
    issues: [
      {
        id: "issue-001",
        category: "missing_data",
        severity: "high",
        description: "Patient allergy information is incomplete across sources",
        affectedResources: ["AllergyIntolerance/allergy-001", "AllergyIntolerance/allergy-002"],
        suggestedAction: "Request updated allergy records from primary care provider"
      },
      {
        id: "issue-002",
        category: "stale_data",
        severity: "medium",
        description: "Lab results older than 90 days with no recent updates",
        affectedResources: ["Observation/obs-lab-001", "Observation/obs-lab-002"],
        suggestedAction: "Schedule data refresh from lab system integration"
      }
    ],
    recommendations: [
      "Initiate data reconciliation workflow for allergy records",
      "Configure automated lab result refresh schedule",
      "Review data source sync configurations"
    ],
    generatedAt: now,
    noCdsCompliance: "Data completeness assessment for governance purposes only. Not for clinical decision-making."
  };

  const assessment2: DataQualityAssessment = {
    id: "assess-002",
    patientId: "patient-002",
    triggeredBy: "event-fhir-update-002",
    assessmentType: "consistency",
    score: 85.2,
    issues: [
      {
        id: "issue-003",
        category: "value_mismatch",
        severity: "medium",
        description: "Patient address differs between EHR and pharmacy records",
        affectedResources: ["Patient/patient-002"],
        suggestedAction: "Verify current address with patient during next interaction"
      }
    ],
    recommendations: [
      "Flag record for address verification",
      "Update data quality monitoring rules"
    ],
    generatedAt: new Date(now.getTime() - 3600000),
    noCdsCompliance: "Data consistency assessment for governance purposes only. Not for clinical decision-making."
  };

  dataQualityAssessments.set(assessment1.id, assessment1);
  dataQualityAssessments.set(assessment2.id, assessment2);

  const medAlert1: MedicationDataAlert = {
    id: "med-alert-001",
    alertType: "potential_data_conflict",
    severity: "high",
    patientId: "patient-001",
    medications: [
      {
        medicationId: "med-001",
        medicationName: "Metformin",
        issueDescription: "Dosage values differ between pharmacy and EHR records",
        sourceConflicts: [
          { source: "Primary Care Provider", value: "500mg twice daily" },
          { source: "CVS Pharmacy", value: "1000mg once daily" }
        ]
      }
    ],
    dataQualityImpact: "Medication dosage inconsistency affects data reliability scoring",
    suggestedDataRemediation: "Reconcile medication records across sources to establish authoritative dosage value",
    generatedAt: now,
    noCdsCompliance: "Medication DATA QUALITY alert only. This is NOT a clinical drug interaction warning. Data reconciliation purposes only."
  };

  const medAlert2: MedicationDataAlert = {
    id: "med-alert-002",
    alertType: "missing_dosage_info",
    severity: "medium",
    patientId: "patient-002",
    medications: [
      {
        medicationId: "med-002",
        medicationName: "Lisinopril",
        issueDescription: "Dosage frequency not specified in imported record",
        sourceConflicts: [
          { source: "Imported CCD", value: "10mg (frequency missing)" }
        ]
      }
    ],
    dataQualityImpact: "Incomplete medication data reduces record completeness score",
    suggestedDataRemediation: "Request complete medication details from originating system",
    generatedAt: new Date(now.getTime() - 7200000),
    noCdsCompliance: "Medication DATA QUALITY alert only. This is NOT a clinical recommendation. Data completeness purposes only."
  };

  medicationDataAlerts.set(medAlert1.id, medAlert1);
  medicationDataAlerts.set(medAlert2.id, medAlert2);

  const task1: RemediationTask = {
    id: "task-001",
    taskType: "source_reconciliation",
    priority: "high",
    title: "Reconcile medication dosage discrepancy",
    description: "Medication dosage values differ between Fasten Health and CVS Pharmacy for patient-001. Determine authoritative source and update records.",
    affectedResources: ["MedicationRequest/med-001"],
    suggestedActions: [
      "Contact pharmacy to verify current prescription details",
      "Review recent prescription history in EHR",
      "Update authoritative source configuration if needed"
    ],
    estimatedEffort: "30 minutes",
    status: "pending",
    createdAt: now,
    dueDate: new Date(now.getTime() + 86400000),
    correlatedAlerts: ["med-alert-001", "assess-001"],
    noCdsCompliance: "Data remediation task for governance purposes only. Not for clinical decision-making."
  };

  const task2: RemediationTask = {
    id: "task-002",
    taskType: "manual_review",
    priority: "medium",
    title: "Review incomplete allergy records",
    description: "Patient allergy information is incomplete. Manual review required to ensure data quality standards are met.",
    affectedResources: ["AllergyIntolerance/allergy-001", "AllergyIntolerance/allergy-002"],
    suggestedActions: [
      "Request complete allergy history from referring provider",
      "Update patient intake questionnaire to capture missing details",
      "Document review completion in data quality log"
    ],
    estimatedEffort: "1 hour",
    status: "pending",
    createdAt: new Date(now.getTime() - 1800000),
    correlatedAlerts: ["assess-001"],
    noCdsCompliance: "Data remediation task for governance purposes only. Not for clinical decision-making."
  };

  remediationTasks.set(task1.id, task1);
  remediationTasks.set(task2.id, task2);

  const secRec1: SecurityRecommendation = {
    id: "sec-rec-001",
    findingId: "finding-access-001",
    findingSeverity: "critical",
    category: "access_control",
    currentConfiguration: {
      sessionTimeout: 480,
      mfaRequired: false,
      ipWhitelisting: false
    },
    recommendedConfiguration: {
      sessionTimeout: 30,
      mfaRequired: true,
      ipWhitelisting: true,
      allowedIPs: ["10.0.0.0/8", "192.168.0.0/16"]
    },
    rationale: "Current session timeout exceeds HIPAA recommended limits. MFA not enforced for PHI access.",
    implementationSteps: [
      "Update session configuration to 30-minute timeout",
      "Enable MFA requirement for all users accessing PHI",
      "Configure IP whitelist for known organizational networks",
      "Test access controls with sample accounts before rollout"
    ],
    riskReduction: "Reduces unauthorized access risk by approximately 85%",
    complianceImpact: ["HIPAA Security Rule 164.312(d)", "SOC2 CC6.1", "NIST 800-53 IA-2"],
    generatedAt: now,
    noCdsCompliance: "Security configuration recommendation for infrastructure purposes only. Not for clinical decision-making."
  };

  const secRec2: SecurityRecommendation = {
    id: "sec-rec-002",
    findingId: "finding-encrypt-001",
    findingSeverity: "high",
    category: "encryption",
    currentConfiguration: {
      atRestEncryption: "AES-128",
      inTransitEncryption: "TLS 1.2",
      keyRotationDays: 365
    },
    recommendedConfiguration: {
      atRestEncryption: "AES-256-GCM",
      inTransitEncryption: "TLS 1.3",
      keyRotationDays: 90
    },
    rationale: "Current encryption standards below recommended levels for PHI protection. Key rotation interval too long.",
    implementationSteps: [
      "Upgrade encryption algorithm to AES-256-GCM",
      "Enable TLS 1.3 support on all endpoints",
      "Configure 90-day key rotation schedule",
      "Validate encryption changes with security scan"
    ],
    riskReduction: "Reduces data breach exposure risk by approximately 60%",
    complianceImpact: ["HIPAA Security Rule 164.312(a)(2)(iv)", "SOC2 CC6.7"],
    generatedAt: new Date(now.getTime() - 3600000),
    noCdsCompliance: "Security configuration recommendation for infrastructure purposes only. Not for clinical decision-making."
  };

  securityRecommendations.set(secRec1.id, secRec1);
  securityRecommendations.set(secRec2.id, secRec2);

  eventLog.push(
    {
      id: "event-001",
      eventType: "resource_created",
      resourceType: "Observation",
      patientId: "patient-001",
      resourceId: "obs-new-001",
      timestamp: now,
      sourceSystem: "Primary Care Provider"
    },
    {
      id: "event-002",
      eventType: "batch_import",
      resourceType: "Bundle",
      patientId: "patient-002",
      resourceId: "bundle-import-001",
      timestamp: new Date(now.getTime() - 3600000),
      sourceSystem: "CCD Import"
    }
  );

  const dischargeRule: EventDrivenRule = {
    id: "rule-discharge-summary",
    name: "Discharge Event Summary Report",
    description: "Automatically generate patient summary report when a discharge event is recorded",
    eventPattern: {
      resourceType: "Encounter",
      eventType: "resource_updated",
      conditions: { status: "finished", class: "discharge" }
    },
    action: {
      type: "generate_report",
      reportType: "discharge_summary",
      priority: "high",
      notifyRoles: ["care_coordinator", "attending_physician"]
    },
    enabled: true,
    executionCount: 12,
    lastExecuted: new Date(now.getTime() - 86400000),
    createdAt: new Date(now.getTime() - 30 * 86400000)
  };

  const labResultRule: EventDrivenRule = {
    id: "rule-abnormal-lab",
    name: "Abnormal Lab Result Notification",
    description: "Trigger quality report when lab results contain abnormal values requiring data validation",
    eventPattern: {
      resourceType: "Observation",
      eventType: "resource_created",
      conditions: { category: "laboratory", interpretation: "abnormal" }
    },
    action: {
      type: "generate_report",
      reportType: "quality_report",
      priority: "medium",
      notifyRoles: ["data_steward"]
    },
    enabled: true,
    executionCount: 45,
    lastExecuted: new Date(now.getTime() - 3600000),
    createdAt: new Date(now.getTime() - 60 * 86400000)
  };

  const admissionRule: EventDrivenRule = {
    id: "rule-admission-summary",
    name: "Admission Patient Summary",
    description: "Generate patient summary report when a new admission encounter is created",
    eventPattern: {
      resourceType: "Encounter",
      eventType: "resource_created",
      conditions: { class: "inpatient" }
    },
    action: {
      type: "generate_report",
      reportType: "patient_summary",
      priority: "high",
      notifyRoles: ["care_team"]
    },
    enabled: true,
    executionCount: 28,
    lastExecuted: new Date(now.getTime() - 7200000),
    createdAt: new Date(now.getTime() - 45 * 86400000)
  };

  eventDrivenRules.set(dischargeRule.id, dischargeRule);
  eventDrivenRules.set(labResultRule.id, labResultRule);
  eventDrivenRules.set(admissionRule.id, admissionRule);

  const qualityThreshold1: QualityThresholdConfig = {
    id: "threshold-data-quality-70",
    name: "Critical Data Quality Drop",
    thresholdType: "data_quality",
    thresholdValue: 70,
    comparisonOperator: "lt",
    reportType: "compliance_report",
    enabled: true,
    notifyRoles: ["compliance_officer", "data_steward"],
    createdAt: new Date(now.getTime() - 90 * 86400000)
  };

  const qualityThreshold2: QualityThresholdConfig = {
    id: "threshold-completeness-80",
    name: "Data Completeness Warning",
    thresholdType: "completeness",
    thresholdValue: 80,
    comparisonOperator: "lt",
    reportType: "quality_report",
    enabled: true,
    notifyRoles: ["data_steward"],
    createdAt: new Date(now.getTime() - 60 * 86400000)
  };

  const qualityThreshold3: QualityThresholdConfig = {
    id: "threshold-timeliness-85",
    name: "Timeliness SLA Breach",
    thresholdType: "timeliness",
    thresholdValue: 85,
    comparisonOperator: "lt",
    reportType: "audit_report",
    enabled: true,
    notifyRoles: ["operations_manager"],
    lastTriggered: new Date(now.getTime() - 48 * 3600000),
    createdAt: new Date(now.getTime() - 30 * 86400000)
  };

  qualityThresholds.set(qualityThreshold1.id, qualityThreshold1);
  qualityThresholds.set(qualityThreshold2.id, qualityThreshold2);
  qualityThresholds.set(qualityThreshold3.id, qualityThreshold3);

  const sampleTrigger: AutomatedReportTrigger = {
    id: "trigger-001",
    triggerType: "discharge_event",
    triggeredBy: "Encounter/enc-discharge-001",
    patientId: "patient-001",
    reportType: "discharge_summary",
    status: "completed",
    priority: "high",
    createdAt: new Date(now.getTime() - 86400000),
    completedAt: new Date(now.getTime() - 85800000),
    reportId: "report-001",
    noCdsCompliance: NO_CDS_DISCLAIMER
  };

  const sampleReport: GeneratedReport = {
    id: "report-001",
    reportType: "discharge_summary",
    title: "Discharge Summary - Patient John Smith",
    patientId: "patient-001",
    triggerId: "trigger-001",
    content: {
      summary: "Patient discharge summary generated automatically upon encounter completion. This is an administrative document for care coordination purposes only.",
      sections: [
        {
          title: "Patient Demographics",
          content: "Summary of patient demographic data from EHR sources",
          dataPoints: [{ field: "Age", value: 65 }, { field: "Gender", value: "Male" }]
        },
        {
          title: "Encounter Summary",
          content: "Overview of the hospital encounter and discharge status",
          dataPoints: [{ field: "LOS", value: "3 days" }, { field: "Discharge Date", value: now.toISOString().split("T")[0] }]
        },
        {
          title: "Care Coordination Notes",
          content: "Follow-up appointments and care transition information",
          dataPoints: []
        }
      ],
      dataQualityScore: 92,
      recommendations: [
        "Schedule follow-up appointment within 7 days",
        "Coordinate with primary care provider",
        "Update patient contact information if needed"
      ],
      metadata: { generatedBy: "AI Workflow Automation", version: "1.0" }
    },
    format: "json",
    generatedAt: new Date(now.getTime() - 85800000),
    noCdsCompliance: NO_CDS_DISCLAIMER
  };

  automatedReportTriggers.set(sampleTrigger.id, sampleTrigger);
  generatedReports.set(sampleReport.id, sampleReport);
}

initializeSampleData();

export class AIWorkflowAutomationService {

  async processFHIREvent(event: FHIREventTrigger): Promise<{
    assessments: DataQualityAssessment[];
    medicationAlerts: MedicationDataAlert[];
    tasks: RemediationTask[];
    noCdsCompliance: string;
  }> {
    eventLog.push(event);

    const assessments: DataQualityAssessment[] = [];
    const medicationAlerts: MedicationDataAlert[] = [];
    const tasks: RemediationTask[] = [];

    if (["resource_created", "resource_updated", "batch_import"].includes(event.eventType)) {
      const assessment = await this.generateDataQualityAssessment(event);
      assessments.push(assessment);
      dataQualityAssessments.set(assessment.id, assessment);

      if (event.resourceType === "MedicationRequest" || event.resourceType === "MedicationStatement") {
        const alert = await this.generateMedicationDataAlert(event);
        if (alert) {
          medicationAlerts.push(alert);
          medicationDataAlerts.set(alert.id, alert);
        }
      }

      for (const assessment of assessments) {
        if (assessment.issues.some(i => i.severity === "critical" || i.severity === "high")) {
          const task = await this.generateRemediationTask(assessment, medicationAlerts);
          tasks.push(task);
          remediationTasks.set(task.id, task);
        }
      }
    }

    return {
      assessments,
      medicationAlerts,
      tasks,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  async generateDataQualityAssessment(event: FHIREventTrigger): Promise<DataQualityAssessment> {
    const assessmentId = `assess-${crypto.randomUUID().slice(0, 8)}`;
    
    let issues: DataQualityIssue[] = [];
    let recommendations: string[] = [];
    let score = 85;

    if (aiEnabled) {
      try {
        const responseText = await generatePhiSafeText({
          system: `${NO_CDS_DISCLAIMER}

You are a healthcare DATA QUALITY analyst. Analyze FHIR events for DATA QUALITY issues only.
DO NOT provide any clinical interpretations or recommendations.
Focus ONLY on: data completeness, consistency, format compliance, and timeliness.

Return JSON with: issues (array of data quality issues), recommendations (array of data governance actions), score (0-100 data quality score).`,
          user: `Analyze this FHIR event for DATA QUALITY issues only:
Event Type: ${event.eventType}
Resource Type: ${event.resourceType}
Patient ID: ${event.patientId}
Source System: ${event.sourceSystem}
Timestamp: ${event.timestamp.toISOString()}

Generate data quality assessment with issues and recommendations.`,
          responseMimeType: "application/json",
          maxTokens: 1000,
        });

        const result = JSON.parse(responseText || "{}");
        issues = (result.issues || []).map((i: any, idx: number) => ({
          id: `issue-${assessmentId}-${idx}`,
          category: i.category || "general",
          severity: i.severity || "medium",
          description: i.description || "Data quality issue detected",
          affectedResources: i.affectedResources || [event.resourceId],
          suggestedAction: i.suggestedAction || "Review and correct data"
        }));
        recommendations = result.recommendations || [];
        score = result.score || 85;
      } catch (error) {
        console.error("OpenAI error in assessment generation:", error);
      }
    }

    if (issues.length === 0) {
      issues = this.generateRuleBasedIssues(event, assessmentId);
      recommendations = this.generateRuleBasedRecommendations(event);
      score = this.calculateRuleBasedScore(issues);
    }

    return {
      id: assessmentId,
      patientId: event.patientId,
      triggeredBy: event.id,
      assessmentType: "completeness",
      score,
      issues,
      recommendations,
      generatedAt: new Date(),
      noCdsCompliance: "Data quality assessment for governance purposes only. Not for clinical decision-making."
    };
  }

  private generateRuleBasedIssues(event: FHIREventTrigger, assessmentId: string): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];

    if (event.eventType === "batch_import") {
      issues.push({
        id: `issue-${assessmentId}-1`,
        category: "import_validation",
        severity: "medium",
        description: "Batch import requires validation against existing records",
        affectedResources: [event.resourceId],
        suggestedAction: "Run deduplication check against existing patient records"
      });
    }

    if (event.resourceType === "Observation") {
      issues.push({
        id: `issue-${assessmentId}-2`,
        category: "completeness",
        severity: "low",
        description: "Verify observation includes required reference ranges",
        affectedResources: [event.resourceId],
        suggestedAction: "Check reference range population in lab observations"
      });
    }

    return issues;
  }

  private generateRuleBasedRecommendations(event: FHIREventTrigger): string[] {
    const recommendations: string[] = [];

    recommendations.push("Validate data against FHIR R4 profile requirements");
    recommendations.push("Check for duplicate records in existing dataset");

    if (event.eventType === "batch_import") {
      recommendations.push("Review import mapping configuration for source system");
    }

    return recommendations;
  }

  private calculateRuleBasedScore(issues: DataQualityIssue[]): number {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case "critical": score -= 25; break;
        case "high": score -= 15; break;
        case "medium": score -= 10; break;
        case "low": score -= 5; break;
      }
    }
    return Math.max(0, score);
  }

  async generateMedicationDataAlert(event: FHIREventTrigger): Promise<MedicationDataAlert | null> {
    const alertId = `med-alert-${crypto.randomUUID().slice(0, 8)}`;

    let medications: MedicationDataIssue[] = [];
    let alertType: MedicationDataAlert["alertType"] = "potential_data_conflict";
    let severity: MedicationDataAlert["severity"] = "medium";

    if (aiEnabled) {
      try {
        const responseText = await generatePhiSafeText({
          system: `${NO_CDS_DISCLAIMER}

You are a healthcare DATA QUALITY analyst focusing on MEDICATION DATA quality.
DO NOT provide clinical drug interaction warnings or treatment recommendations.
Focus ONLY on: data consistency, format compliance, completeness, and source conflicts.

This is NOT a clinical drug interaction check. This is DATA QUALITY analysis only.

Return JSON with: alertType (potential_data_conflict|missing_dosage_info|format_inconsistency|temporal_gap|duplicate_entry), severity (critical|high|medium|low), medications (array of data issues), dataQualityImpact (string), suggestedDataRemediation (string).`,
          user: `Analyze this medication-related FHIR event for DATA QUALITY issues only:
Resource Type: ${event.resourceType}
Resource ID: ${event.resourceId}
Patient ID: ${event.patientId}
Source System: ${event.sourceSystem}

Generate medication DATA QUALITY alert if issues found. Focus on data consistency, not clinical implications.`,
          responseMimeType: "application/json",
          maxTokens: 800,
        });

        const result = JSON.parse(responseText || "{}");
        if (result.medications && result.medications.length > 0) {
          medications = result.medications;
          alertType = result.alertType || "potential_data_conflict";
          severity = result.severity || "medium";
        }
      } catch (error) {
        console.error("OpenAI error in medication alert generation:", error);
      }
    }

    if (medications.length === 0) {
      medications = [{
        medicationId: event.resourceId,
        medicationName: "Medication Record",
        issueDescription: "New medication record requires cross-source validation",
        sourceConflicts: [{ source: event.sourceSystem, value: "Pending validation" }]
      }];
    }

    return {
      id: alertId,
      alertType,
      severity,
      patientId: event.patientId,
      medications,
      dataQualityImpact: "Medication data requires validation for record completeness",
      suggestedDataRemediation: "Cross-reference medication record with authoritative pharmacy data",
      generatedAt: new Date(),
      noCdsCompliance: "Medication DATA QUALITY alert only. This is NOT a clinical drug interaction warning. Data reconciliation purposes only."
    };
  }

  async generateRemediationTask(
    assessment: DataQualityAssessment,
    alerts: MedicationDataAlert[]
  ): Promise<RemediationTask> {
    const taskId = `task-${crypto.randomUUID().slice(0, 8)}`;
    const criticalIssues = assessment.issues.filter(i => i.severity === "critical" || i.severity === "high");

    let title = "Data quality remediation required";
    let description = "";
    let suggestedActions: string[] = [];
    let taskType: RemediationTask["taskType"] = "manual_review";
    let priority: RemediationTask["priority"] = "medium";

    if (aiEnabled) {
      try {
        const responseText = await generatePhiSafeText({
          system: `${NO_CDS_DISCLAIMER}

You are a healthcare DATA GOVERNANCE specialist creating remediation tasks.
DO NOT include any clinical recommendations or treatment-related actions.
Focus ONLY on: data correction, source reconciliation, quality improvement.

Return JSON with: title (string), description (string), taskType (data_correction|source_reconciliation|manual_review|automated_fix|escalation), priority (urgent|high|medium|low), suggestedActions (array of strings).`,
          user: `Create a data remediation task for these DATA QUALITY issues:
Issues: ${JSON.stringify(criticalIssues)}
Related Medication Alerts: ${JSON.stringify(alerts.map(a => ({ id: a.id, type: a.alertType, severity: a.severity })))}

Generate remediation task focused on DATA GOVERNANCE, not clinical actions.`,
          responseMimeType: "application/json",
          maxTokens: 600,
        });

        const result = JSON.parse(responseText || "{}");
        title = result.title || title;
        description = result.description || "";
        taskType = result.taskType || taskType;
        priority = result.priority || priority;
        suggestedActions = result.suggestedActions || [];
      } catch (error) {
        console.error("OpenAI error in task generation:", error);
      }
    }

    if (suggestedActions.length === 0) {
      title = `Remediate ${criticalIssues.length} high-priority data quality issues`;
      description = criticalIssues.map(i => i.description).join("; ");
      suggestedActions = criticalIssues.map(i => i.suggestedAction);
      priority = criticalIssues.some(i => i.severity === "critical") ? "urgent" : "high";
      taskType = "source_reconciliation";
    }

    return {
      id: taskId,
      taskType,
      priority,
      title,
      description,
      affectedResources: criticalIssues.flatMap(i => i.affectedResources),
      suggestedActions,
      estimatedEffort: criticalIssues.length > 2 ? "2 hours" : "1 hour",
      status: "pending",
      createdAt: new Date(),
      dueDate: new Date(Date.now() + (priority === "urgent" ? 4 * 3600000 : 24 * 3600000)),
      correlatedAlerts: [assessment.id, ...alerts.map(a => a.id)],
      noCdsCompliance: "Data remediation task for governance purposes only. Not for clinical decision-making."
    };
  }

  async generateSecurityRecommendation(
    findingId: string,
    findingSeverity: "critical" | "high" | "medium" | "low",
    category: SecurityRecommendation["category"],
    currentConfig: Record<string, unknown>
  ): Promise<SecurityRecommendation> {
    const recId = `sec-rec-${crypto.randomUUID().slice(0, 8)}`;

    let recommendedConfig: Record<string, unknown> = {};
    let rationale = "";
    let implementationSteps: string[] = [];
    let riskReduction = "";
    let complianceImpact: string[] = [];

    if (aiEnabled) {
      try {
        const responseText = await generatePhiSafeText({
          system: `${NO_CDS_DISCLAIMER}

You are a healthcare SECURITY specialist providing infrastructure recommendations.
Focus on: access control, encryption, audit logging, network security configurations.

Return JSON with: recommendedConfiguration (object), rationale (string), implementationSteps (array of strings), riskReduction (string), complianceImpact (array of compliance framework references).`,
          user: `Generate security configuration recommendation:
Finding ID: ${findingId}
Severity: ${findingSeverity}
Category: ${category}
Current Configuration: ${JSON.stringify(currentConfig)}

Provide specific, actionable security recommendations for healthcare infrastructure.`,
          responseMimeType: "application/json",
          maxTokens: 800,
        });

        const result = JSON.parse(responseText || "{}");
        recommendedConfig = result.recommendedConfiguration || {};
        rationale = result.rationale || "";
        implementationSteps = result.implementationSteps || [];
        riskReduction = result.riskReduction || "";
        complianceImpact = result.complianceImpact || [];
      } catch (error) {
        console.error("OpenAI error in security recommendation:", error);
      }
    }

    if (Object.keys(recommendedConfig).length === 0) {
      const ruleBasedRec = this.generateRuleBasedSecurityRecommendation(category, currentConfig, findingSeverity);
      recommendedConfig = ruleBasedRec.recommendedConfig;
      rationale = ruleBasedRec.rationale;
      implementationSteps = ruleBasedRec.steps;
      riskReduction = ruleBasedRec.riskReduction;
      complianceImpact = ruleBasedRec.compliance;
    }

    const recommendation: SecurityRecommendation = {
      id: recId,
      findingId,
      findingSeverity,
      category,
      currentConfiguration: currentConfig,
      recommendedConfiguration: recommendedConfig,
      rationale,
      implementationSteps,
      riskReduction,
      complianceImpact,
      generatedAt: new Date(),
      noCdsCompliance: "Security configuration recommendation for infrastructure purposes only. Not for clinical decision-making."
    };

    securityRecommendations.set(recId, recommendation);
    return recommendation;
  }

  private generateRuleBasedSecurityRecommendation(
    category: string,
    currentConfig: Record<string, unknown>,
    severity: string
  ): {
    recommendedConfig: Record<string, unknown>;
    rationale: string;
    steps: string[];
    riskReduction: string;
    compliance: string[];
  } {
    const configs: Record<string, any> = {
      access_control: {
        recommendedConfig: {
          sessionTimeout: 30,
          mfaRequired: true,
          passwordMinLength: 14,
          passwordComplexity: "high",
          accountLockoutThreshold: 5
        },
        rationale: "Enhanced access controls reduce unauthorized access risk",
        steps: [
          "Update session timeout to 30 minutes",
          "Enable MFA for all PHI access",
          "Enforce strong password policy"
        ],
        riskReduction: "Reduces unauthorized access risk by 80%",
        compliance: ["HIPAA 164.312(d)", "SOC2 CC6.1"]
      },
      encryption: {
        recommendedConfig: {
          atRestEncryption: "AES-256-GCM",
          inTransitEncryption: "TLS 1.3",
          keyRotationDays: 90
        },
        rationale: "Stronger encryption protects PHI from data breaches",
        steps: [
          "Upgrade to AES-256-GCM encryption",
          "Enable TLS 1.3",
          "Configure 90-day key rotation"
        ],
        riskReduction: "Reduces data breach exposure by 70%",
        compliance: ["HIPAA 164.312(a)(2)(iv)", "SOC2 CC6.7"]
      },
      audit_logging: {
        recommendedConfig: {
          logRetentionDays: 2190,
          realTimeAlerts: true,
          phiAccessLogging: true,
          tamperProofLogs: true
        },
        rationale: "Comprehensive audit logging enables security monitoring and compliance",
        steps: [
          "Configure 6-year log retention",
          "Enable real-time security alerts",
          "Implement tamper-proof log storage"
        ],
        riskReduction: "Improves incident detection by 90%",
        compliance: ["HIPAA 164.312(b)", "SOC2 CC7.2"]
      }
    };

    return configs[category] || configs.access_control;
  }

  getStats(): WorkflowAutomationStats {
    const assessments = Array.from(dataQualityAssessments.values());
    const alerts = Array.from(medicationDataAlerts.values());
    const tasks = Array.from(remediationTasks.values());
    const secRecs = Array.from(securityRecommendations.values());

    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const assessment of assessments) {
      for (const issue of assessment.issues) {
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      }
    }

    for (const alert of alerts) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    }

    const byEventType: Record<string, number> = {};
    for (const event of eventLog) {
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;
    }

    const reports = Array.from(generatedReports.values());
    const triggers = Array.from(automatedReportTriggers.values());
    const complianceAlerts = triggers.filter(t => t.triggerType === "quality_threshold").length;

    return {
      totalEventsProcessed: eventLog.length,
      assessmentsGenerated: assessments.length,
      medicationAlertsGenerated: alerts.length,
      remediationTasksCreated: tasks.length,
      securityRecommendations: secRecs.length,
      automatedReportsGenerated: reports.length,
      complianceAlertsTriggered: complianceAlerts,
      byEventType,
      bySeverity
    };
  }

  getDataQualityAssessments(patientId?: string): DataQualityAssessment[] {
    const assessments = Array.from(dataQualityAssessments.values());
    if (patientId) {
      return assessments.filter(a => a.patientId === patientId);
    }
    return assessments;
  }

  getMedicationDataAlerts(patientId?: string): MedicationDataAlert[] {
    const alerts = Array.from(medicationDataAlerts.values());
    if (patientId) {
      return alerts.filter(a => a.patientId === patientId);
    }
    return alerts;
  }

  getRemediationTasks(status?: RemediationTask["status"]): RemediationTask[] {
    const tasks = Array.from(remediationTasks.values());
    if (status) {
      return tasks.filter(t => t.status === status);
    }
    return tasks;
  }

  updateTaskStatus(taskId: string, status: RemediationTask["status"], assignedTo?: string): RemediationTask | null {
    const task = remediationTasks.get(taskId);
    if (task) {
      task.status = status;
      if (assignedTo) task.assignedTo = assignedTo;
      remediationTasks.set(taskId, task);
      return task;
    }
    return null;
  }

  getSecurityRecommendations(severity?: SecurityRecommendation["findingSeverity"]): SecurityRecommendation[] {
    const recs = Array.from(securityRecommendations.values());
    if (severity) {
      return recs.filter(r => r.findingSeverity === severity);
    }
    return recs;
  }

  getEventLog(): FHIREventTrigger[] {
    return eventLog.slice(-100);
  }

  async processEventWithRules(event: FHIREventTrigger): Promise<{
    matchedRules: EventDrivenRule[];
    triggeredReports: AutomatedReportTrigger[];
    noCdsCompliance: string;
  }> {
    const matchedRules: EventDrivenRule[] = [];
    const triggeredReports: AutomatedReportTrigger[] = [];

    for (const rule of Array.from(eventDrivenRules.values())) {
      if (!rule.enabled) continue;

      if (this.matchesEventPattern(event, rule.eventPattern)) {
        matchedRules.push(rule);
        rule.executionCount++;
        rule.lastExecuted = new Date();
        eventDrivenRules.set(rule.id, rule);

        if (rule.action.type === "generate_report" && rule.action.reportType) {
          const trigger = await this.createReportTrigger(
            this.getTriggerTypeFromRule(rule),
            event.resourceId,
            event.patientId,
            rule.action.reportType,
            rule.action.priority || "medium"
          );
          triggeredReports.push(trigger);

          const report = await this.generateAutomatedReport(trigger, event);
          if (report) {
            trigger.status = "completed";
            trigger.completedAt = new Date();
            trigger.reportId = report.id;
            automatedReportTriggers.set(trigger.id, trigger);
          }
        }
      }
    }

    console.log(`[AIWorkflowAutomation] Event ${event.id} matched ${matchedRules.length} rules, triggered ${triggeredReports.length} reports`);

    return {
      matchedRules,
      triggeredReports,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  private getTriggerTypeFromRule(rule: EventDrivenRule): AutomatedReportTrigger["triggerType"] {
    const pattern = rule.eventPattern;
    if (pattern.resourceType === "Encounter" && pattern.conditions?.status === "finished") {
      return "discharge_event";
    }
    if (pattern.resourceType === "Encounter" && pattern.eventType === "resource_created") {
      return "encounter_complete";
    }
    return "scheduled";
  }

  private matchesEventPattern(
    event: FHIREventTrigger,
    pattern: EventDrivenRule["eventPattern"]
  ): boolean {
    if (event.resourceType !== pattern.resourceType) return false;
    if (event.eventType !== pattern.eventType) return false;

    if (pattern.conditions) {
      for (const [key, value] of Object.entries(pattern.conditions)) {
        if (event.metadata && event.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  async createReportTrigger(
    triggerType: AutomatedReportTrigger["triggerType"],
    triggeredBy: string,
    patientId: string | undefined,
    reportType: AutomatedReportTrigger["reportType"],
    priority: AutomatedReportTrigger["priority"]
  ): Promise<AutomatedReportTrigger> {
    const trigger: AutomatedReportTrigger = {
      id: `trigger-${crypto.randomUUID().slice(0, 8)}`,
      triggerType,
      triggeredBy,
      patientId,
      reportType,
      status: "generating",
      priority,
      createdAt: new Date(),
      noCdsCompliance: NO_CDS_DISCLAIMER
    };

    automatedReportTriggers.set(trigger.id, trigger);
    console.log(`[AIWorkflowAutomation] Created report trigger ${trigger.id} for ${reportType}`);
    return trigger;
  }

  async generateAutomatedReport(
    trigger: AutomatedReportTrigger,
    event?: FHIREventTrigger
  ): Promise<GeneratedReport | null> {
    const reportId = `report-${crypto.randomUUID().slice(0, 8)}`;

    let title = "";
    let content: ReportContent;

    switch (trigger.reportType) {
      case "discharge_summary":
        title = `Discharge Summary - Patient ${trigger.patientId || "Unknown"}`;
        content = await this.generateDischargeSummaryContent(trigger, event);
        break;
      case "patient_summary":
        title = `Patient Summary - ${trigger.patientId || "Unknown"}`;
        content = await this.generatePatientSummaryContent(trigger, event);
        break;
      case "compliance_report":
        title = `Compliance Report - Quality Threshold Breach`;
        content = await this.generateComplianceReportContent(trigger);
        break;
      case "quality_report":
        title = `Data Quality Report`;
        content = await this.generateQualityReportContent(trigger);
        break;
      case "audit_report":
        title = `Audit Trail Report`;
        content = await this.generateAuditReportContent(trigger);
        break;
      default:
        return null;
    }

    const report: GeneratedReport = {
      id: reportId,
      reportType: trigger.reportType,
      title,
      patientId: trigger.patientId,
      triggerId: trigger.id,
      content,
      format: "json",
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      noCdsCompliance: NO_CDS_DISCLAIMER
    };

    generatedReports.set(reportId, report);
    console.log(`[AIWorkflowAutomation] Generated automated report ${reportId}`);
    return report;
  }

  private async generateDischargeSummaryContent(
    trigger: AutomatedReportTrigger,
    event?: FHIREventTrigger
  ): Promise<ReportContent> {
    let sections: ReportSection[] = [];
    let summary = "";
    let recommendations: string[] = [];

    if (aiEnabled) {
      try {
        const responseText = await generatePhiSafeText({
          system: `${NO_CDS_DISCLAIMER}

You are generating an ADMINISTRATIVE discharge summary for care coordination purposes.
DO NOT provide clinical recommendations, treatment plans, or medical advice.
Focus on: administrative data, scheduling, care coordination, and documentation completeness.

Return JSON with: summary (string), sections (array of {title, content}), recommendations (array of administrative actions).`,
          user: `Generate an administrative discharge summary for:
Patient ID: ${trigger.patientId}
Trigger: ${trigger.triggeredBy}
Event Source: ${event?.sourceSystem || "Unknown"}
Timestamp: ${new Date().toISOString()}

Focus on care coordination, follow-up scheduling, and administrative completeness.`,
          responseMimeType: "application/json",
          maxTokens: 1000,
        });

        const result = JSON.parse(responseText || "{}");
        summary = result.summary || "Discharge summary generated for care coordination purposes.";
        sections = (result.sections || []).map((s: any) => ({
          title: s.title || "Section",
          content: s.content || "",
          dataPoints: s.dataPoints || []
        }));
        recommendations = result.recommendations || [];
      } catch (error) {
        console.error("[AIWorkflowAutomation] AI error generating discharge summary:", error);
      }
    }

    if (!summary) {
      summary = "Automated discharge summary generated for administrative and care coordination purposes. This document does not contain clinical recommendations.";
      sections = [
        { title: "Patient Information", content: `Patient ID: ${trigger.patientId}`, dataPoints: [] },
        { title: "Discharge Status", content: "Patient discharged - encounter completed", dataPoints: [] },
        { title: "Care Coordination", content: "Follow-up appointments and care transition required", dataPoints: [] }
      ];
      recommendations = [
        "Schedule follow-up appointment within 7 days",
        "Verify primary care provider contact information",
        "Confirm medication list reconciliation complete",
        "Send discharge documentation to care team"
      ];
    }

    return {
      summary,
      sections,
      dataQualityScore: 88,
      recommendations,
      metadata: {
        generatedBy: "AI Workflow Automation",
        eventSource: event?.sourceSystem || "Unknown",
        aiAssisted: aiEnabled
      }
    };
  }

  private async generatePatientSummaryContent(
    trigger: AutomatedReportTrigger,
    event?: FHIREventTrigger
  ): Promise<ReportContent> {
    return {
      summary: "Patient summary generated for administrative review. This is not a clinical summary.",
      sections: [
        { title: "Demographics", content: `Patient ID: ${trigger.patientId}`, dataPoints: [] },
        { title: "Active Encounters", content: "Current encounter information for care coordination", dataPoints: [] },
        { title: "Data Sources", content: `Data aggregated from: ${event?.sourceSystem || "Multiple sources"}`, dataPoints: [] }
      ],
      dataQualityScore: 90,
      recommendations: [
        "Verify patient contact information is current",
        "Review data source synchronization status",
        "Check for duplicate records"
      ],
      metadata: { generatedBy: "AI Workflow Automation", triggerId: trigger.id }
    };
  }

  private async generateComplianceReportContent(trigger: AutomatedReportTrigger): Promise<ReportContent> {
    return {
      summary: "Compliance report generated due to data quality threshold breach. Immediate review required.",
      sections: [
        { title: "Threshold Violation", content: "Data quality score dropped below configured threshold", dataPoints: [] },
        { title: "Affected Areas", content: "Data completeness and consistency metrics below SLA", dataPoints: [] },
        { title: "Remediation Required", content: "Review and correct identified data quality issues", dataPoints: [] }
      ],
      dataQualityScore: 65,
      complianceStatus: "WARNING",
      recommendations: [
        "Initiate data quality remediation workflow",
        "Review data source integration configurations",
        "Schedule compliance review meeting",
        "Document corrective actions taken"
      ],
      metadata: { generatedBy: "AI Workflow Automation", complianceType: "data_quality" }
    };
  }

  private async generateQualityReportContent(trigger: AutomatedReportTrigger): Promise<ReportContent> {
    return {
      summary: "Data quality report generated for operational monitoring.",
      sections: [
        { title: "Quality Metrics", content: "Current data quality assessment scores and trends", dataPoints: [] },
        { title: "Issue Summary", content: "Overview of identified data quality issues", dataPoints: [] },
        { title: "Recommendations", content: "Suggested actions for quality improvement", dataPoints: [] }
      ],
      dataQualityScore: 82,
      recommendations: [
        "Address high-priority data quality issues",
        "Update data validation rules",
        "Review integration error logs"
      ],
      metadata: { generatedBy: "AI Workflow Automation" }
    };
  }

  private async generateAuditReportContent(trigger: AutomatedReportTrigger): Promise<ReportContent> {
    return {
      summary: "Audit trail report generated for compliance monitoring.",
      sections: [
        { title: "Audit Summary", content: "Overview of system access and data modifications", dataPoints: [] },
        { title: "Access Patterns", content: "PHI access patterns and user activity summary", dataPoints: [] },
        { title: "Anomalies", content: "Unusual access patterns or policy violations", dataPoints: [] }
      ],
      recommendations: [
        "Review flagged access patterns",
        "Update access control policies as needed",
        "Schedule periodic audit review"
      ],
      metadata: { generatedBy: "AI Workflow Automation", auditPeriod: "Last 30 days" }
    };
  }

  async checkQualityThresholds(currentScore: number, thresholdType: QualityThresholdConfig["thresholdType"]): Promise<{
    breached: boolean;
    thresholds: QualityThresholdConfig[];
    triggeredReports: AutomatedReportTrigger[];
    noCdsCompliance: string;
  }> {
    const breachedThresholds: QualityThresholdConfig[] = [];
    const triggeredReports: AutomatedReportTrigger[] = [];

    for (const threshold of Array.from(qualityThresholds.values())) {
      if (!threshold.enabled || threshold.thresholdType !== thresholdType) continue;

      let breached = false;
      switch (threshold.comparisonOperator) {
        case "lt": breached = currentScore < threshold.thresholdValue; break;
        case "lte": breached = currentScore <= threshold.thresholdValue; break;
        case "gt": breached = currentScore > threshold.thresholdValue; break;
        case "gte": breached = currentScore >= threshold.thresholdValue; break;
        case "eq": breached = currentScore === threshold.thresholdValue; break;
      }

      if (breached) {
        breachedThresholds.push(threshold);
        threshold.lastTriggered = new Date();
        qualityThresholds.set(threshold.id, threshold);

        const trigger = await this.createReportTrigger(
          "quality_threshold",
          `threshold:${threshold.id}`,
          undefined,
          threshold.reportType,
          "high"
        );
        triggeredReports.push(trigger);

        const report = await this.generateAutomatedReport(trigger);
        if (report) {
          trigger.status = "completed";
          trigger.completedAt = new Date();
          trigger.reportId = report.id;
          automatedReportTriggers.set(trigger.id, trigger);
        }

        console.log(`[AIWorkflowAutomation] Quality threshold ${threshold.name} breached - score ${currentScore} ${threshold.comparisonOperator} ${threshold.thresholdValue}`);
      }
    }

    return {
      breached: breachedThresholds.length > 0,
      thresholds: breachedThresholds,
      triggeredReports,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  getEventDrivenRules(): EventDrivenRule[] {
    return Array.from(eventDrivenRules.values());
  }

  getQualityThresholds(): QualityThresholdConfig[] {
    return Array.from(qualityThresholds.values());
  }

  getAutomatedReportTriggers(status?: AutomatedReportTrigger["status"]): AutomatedReportTrigger[] {
    const triggers = Array.from(automatedReportTriggers.values());
    if (status) {
      return triggers.filter(t => t.status === status);
    }
    return triggers;
  }

  getGeneratedReports(reportType?: GeneratedReport["reportType"]): GeneratedReport[] {
    const reports = Array.from(generatedReports.values());
    if (reportType) {
      return reports.filter(r => r.reportType === reportType);
    }
    return reports;
  }

  getReportById(reportId: string): GeneratedReport | undefined {
    return generatedReports.get(reportId);
  }

  createEventDrivenRule(rule: Omit<EventDrivenRule, "id" | "executionCount" | "createdAt">): EventDrivenRule {
    const newRule: EventDrivenRule = {
      ...rule,
      id: `rule-${crypto.randomUUID().slice(0, 8)}`,
      executionCount: 0,
      createdAt: new Date()
    };
    eventDrivenRules.set(newRule.id, newRule);
    console.log(`[AIWorkflowAutomation] Created new event-driven rule: ${newRule.name}`);
    return newRule;
  }

  updateEventDrivenRule(ruleId: string, updates: Partial<EventDrivenRule>): EventDrivenRule | null {
    const rule = eventDrivenRules.get(ruleId);
    if (rule) {
      const updated = { ...rule, ...updates, id: ruleId };
      eventDrivenRules.set(ruleId, updated);
      return updated;
    }
    return null;
  }

  deleteEventDrivenRule(ruleId: string): boolean {
    return eventDrivenRules.delete(ruleId);
  }

  createQualityThreshold(threshold: Omit<QualityThresholdConfig, "id" | "createdAt">): QualityThresholdConfig {
    const newThreshold: QualityThresholdConfig = {
      ...threshold,
      id: `threshold-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date()
    };
    qualityThresholds.set(newThreshold.id, newThreshold);
    console.log(`[AIWorkflowAutomation] Created new quality threshold: ${newThreshold.name}`);
    return newThreshold;
  }

  updateQualityThreshold(thresholdId: string, updates: Partial<QualityThresholdConfig>): QualityThresholdConfig | null {
    const threshold = qualityThresholds.get(thresholdId);
    if (threshold) {
      const updated = { ...threshold, ...updates, id: thresholdId };
      qualityThresholds.set(thresholdId, updated);
      return updated;
    }
    return null;
  }

  deleteQualityThreshold(thresholdId: string): boolean {
    return qualityThresholds.delete(thresholdId);
  }

  async simulateDischargeEvent(patientId: string): Promise<{
    event: FHIREventTrigger;
    matchedRules: EventDrivenRule[];
    triggeredReports: AutomatedReportTrigger[];
    generatedReports: GeneratedReport[];
    noCdsCompliance: string;
  }> {
    const event: FHIREventTrigger = {
      id: `event-discharge-${crypto.randomUUID().slice(0, 8)}`,
      eventType: "resource_updated",
      resourceType: "Encounter",
      patientId,
      resourceId: `Encounter/enc-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date(),
      sourceSystem: "Hospital EHR",
      metadata: { status: "finished", class: "discharge" }
    };

    eventLog.push(event);
    const result = await this.processEventWithRules(event);

    const reports = result.triggeredReports
      .map(t => t.reportId)
      .filter((id): id is string => !!id)
      .map(id => generatedReports.get(id))
      .filter((r): r is GeneratedReport => !!r);

    console.log(`[AIWorkflowAutomation] Simulated discharge event for patient ${patientId}`);

    return {
      event,
      matchedRules: result.matchedRules,
      triggeredReports: result.triggeredReports,
      generatedReports: reports,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  async simulateQualityThresholdBreach(score: number, thresholdType: QualityThresholdConfig["thresholdType"]): Promise<{
    currentScore: number;
    thresholdType: string;
    breached: boolean;
    thresholds: QualityThresholdConfig[];
    triggeredReports: AutomatedReportTrigger[];
    generatedReports: GeneratedReport[];
    noCdsCompliance: string;
  }> {
    const result = await this.checkQualityThresholds(score, thresholdType);

    const reports = result.triggeredReports
      .map(t => t.reportId)
      .filter((id): id is string => !!id)
      .map(id => generatedReports.get(id))
      .filter((r): r is GeneratedReport => !!r);

    console.log(`[AIWorkflowAutomation] Simulated quality threshold check: score ${score}, breached: ${result.breached}`);

    return {
      currentScore: score,
      thresholdType,
      breached: result.breached,
      thresholds: result.thresholds,
      triggeredReports: result.triggeredReports,
      generatedReports: reports,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }
}

export const workflowAutomationService = new AIWorkflowAutomationService();
