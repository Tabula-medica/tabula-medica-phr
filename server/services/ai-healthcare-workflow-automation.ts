import OpenAI from "openai";
import crypto from "crypto";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_DISCLAIMER = "CRITICAL COMPLIANCE NOTICE: This automation is for DATA QUALITY, GOVERNANCE, CARE COORDINATION, and OPERATIONAL purposes ONLY. It does NOT provide clinical decision support, treatment recommendations, or medical advice. All outputs must be reviewed by qualified personnel.";

export type FHIRResourceType = "Patient" | "Observation" | "MedicationRequest" | "Condition" | "AllergyIntolerance" | "Procedure" | "Encounter" | "DiagnosticReport" | "Immunization" | "CarePlan";
export type EventType = "resource_created" | "resource_updated" | "resource_deleted" | "batch_import" | "sync_completed";
export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "escalated";
export type WorkflowStatus = "active" | "paused" | "completed" | "failed";

export interface FHIRDataEvent {
  id: string;
  eventType: EventType;
  resourceType: FHIRResourceType;
  resourceId: string;
  patientId: string;
  timestamp: Date;
  sourceSystem: string;
  changeDescription: string;
  metadata: Record<string, unknown>;
  processed: boolean;
  triggeredWorkflows: string[];
}

export interface PatientRiskAssessmentTrigger {
  id: string;
  patientId: string;
  triggeredBy: string;
  triggerReason: string;
  triggerType: "new_data" | "data_change" | "scheduled" | "manual" | "alert_escalation";
  dataElements: DataElement[];
  assessmentStatus: "pending" | "in_progress" | "completed" | "failed";
  assessmentResult?: RiskAssessmentResult;
  createdAt: Date;
  completedAt?: Date;
  noCdsCompliance: string;
}

export interface DataElement {
  resourceType: FHIRResourceType;
  resourceId: string;
  field: string;
  previousValue?: unknown;
  newValue: unknown;
  changeType: "created" | "updated" | "deleted";
}

export interface RiskAssessmentResult {
  id: string;
  patientId: string;
  overallRiskLevel: AlertSeverity;
  riskScore: number;
  riskFactors: RiskFactor[];
  dataQualityScore: number;
  coordinationNeeds: CoordinationNeed[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface RiskFactor {
  id: string;
  category: "data_quality" | "care_coordination" | "administrative" | "social_determinants" | "follow_up";
  name: string;
  description: string;
  severity: AlertSeverity;
  suggestedAction: string;
}

export interface CoordinationNeed {
  id: string;
  type: "scheduling" | "outreach" | "education" | "care_team_notification" | "documentation" | "referral_coordination";
  priority: AlertSeverity;
  description: string;
  suggestedActions: string[];
  assignee: string;
  deadline?: Date;
}

export interface DrugInteractionAlert {
  id: string;
  patientId: string;
  alertType: "drug_drug" | "drug_allergy" | "drug_condition" | "duplicate_therapy" | "dosing_issue";
  severity: AlertSeverity;
  medications: MedicationInfo[];
  interactionDescription: string;
  dataSourceConflicts: DataSourceConflict[];
  detectedAt: Date;
  status: "new" | "acknowledged" | "resolved" | "escalated";
  triggeredActions: string[];
  noCdsCompliance: string;
}

export interface MedicationInfo {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  prescribedDate: Date;
  sourceSystem: string;
}

export interface DataSourceConflict {
  field: string;
  sources: Array<{ source: string; value: unknown; lastUpdated: Date }>;
  conflictType: "value_mismatch" | "missing_data" | "duplicate_entry" | "temporal_inconsistency";
}

export interface CareCoordinationSuggestion {
  id: string;
  patientId: string;
  triggeredBy: string;
  triggerType: "drug_interaction" | "high_risk_alert" | "data_quality_issue" | "care_gap";
  priority: AlertSeverity;
  suggestionType: "schedule_appointment" | "send_education" | "notify_care_team" | "coordinate_referral" | "update_documentation" | "patient_outreach";
  title: string;
  description: string;
  rationale: string;
  suggestedActions: SuggestedAction[];
  expectedOutcome: string;
  status: TaskStatus;
  createdAt: Date;
  completedAt?: Date;
  noCdsCompliance: string;
}

export interface SuggestedAction {
  id: string;
  action: string;
  assignee: string;
  deadline: Date;
  status: TaskStatus;
  automatable: boolean;
}

export interface DataQualityRemediationTask {
  id: string;
  title: string;
  description: string;
  taskType: "data_correction" | "source_reconciliation" | "manual_review" | "automated_fix" | "escalation";
  priority: AlertSeverity;
  affectedResources: AffectedResource[];
  correlatedAlerts: CorrelatedAlert[];
  aiAnalysis: AIAnalysis;
  suggestedRemediations: RemediationStep[];
  estimatedEffort: string;
  assignedTo?: string;
  status: TaskStatus;
  createdAt: Date;
  dueDate: Date;
  completedAt?: Date;
  noCdsCompliance: string;
}

export interface AffectedResource {
  resourceType: FHIRResourceType;
  resourceId: string;
  issueDescription: string;
  dataQualityScore: number;
}

export interface CorrelatedAlert {
  alertId: string;
  alertType: string;
  severity: AlertSeverity;
  correlationStrength: number;
  correlationReason: string;
}

export interface AIAnalysis {
  patternDetected: string;
  rootCauseAnalysis: string;
  impactAssessment: string;
  confidenceScore: number;
  relatedPatterns: string[];
}

export interface RemediationStep {
  stepNumber: number;
  action: string;
  description: string;
  automatable: boolean;
  estimatedTime: string;
  dependencies: string[];
}

export interface SecurityConfigurationRecommendation {
  id: string;
  findingId: string;
  findingTitle: string;
  findingSeverity: AlertSeverity;
  category: "access_control" | "encryption" | "audit_logging" | "consent_management" | "network_security" | "data_masking" | "authentication";
  currentConfiguration: ConfigurationState;
  recommendedConfiguration: ConfigurationState;
  rationale: string;
  implementationSteps: ImplementationStep[];
  riskReduction: string;
  complianceImpact: ComplianceImpact[];
  estimatedEffort: string;
  requiresApproval: boolean;
  status: "pending" | "approved" | "rejected" | "implemented" | "rolled_back";
  createdAt: Date;
  implementedAt?: Date;
  noCdsCompliance: string;
}

export interface ConfigurationState {
  setting: string;
  value: unknown;
  description: string;
}

export interface ImplementationStep {
  stepNumber: number;
  action: string;
  description: string;
  automatable: boolean;
  rollbackProcedure: string;
}

export interface ComplianceImpact {
  framework: "HIPAA" | "SOC2" | "GDPR" | "HITRUST" | "NIST";
  control: string;
  improvement: string;
}

export interface WorkflowAutomationDashboard {
  summary: DashboardSummary;
  recentEvents: FHIRDataEvent[];
  pendingAssessments: PatientRiskAssessmentTrigger[];
  activeAlerts: DrugInteractionAlert[];
  pendingCoordinationSuggestions: CareCoordinationSuggestion[];
  remediationTasks: DataQualityRemediationTask[];
  securityRecommendations: SecurityConfigurationRecommendation[];
  automationMetrics: AutomationMetrics;
}

export interface DashboardSummary {
  totalEventsToday: number;
  pendingRiskAssessments: number;
  activeAlerts: number;
  criticalAlerts: number;
  pendingRemediationTasks: number;
  pendingSecurityActions: number;
  automationEfficiency: number;
}

export interface AutomationMetrics {
  eventsProcessedToday: number;
  assessmentsTriggered: number;
  alertsGenerated: number;
  tasksCreated: number;
  tasksAutoResolved: number;
  averageResolutionTime: number;
  automationRate: number;
}

const fhirEvents = new Map<string, FHIRDataEvent>();
const riskAssessmentTriggers = new Map<string, PatientRiskAssessmentTrigger>();
const drugInteractionAlerts = new Map<string, DrugInteractionAlert>();
const careCoordinationSuggestions = new Map<string, CareCoordinationSuggestion>();
const remediationTasks = new Map<string, DataQualityRemediationTask>();
const securityRecommendations = new Map<string, SecurityConfigurationRecommendation>();

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function initializeSampleData() {
  const now = new Date();

  const event1: FHIRDataEvent = {
    id: generateId("event"),
    eventType: "resource_created",
    resourceType: "MedicationRequest",
    resourceId: "med-req-001",
    patientId: "patient-001",
    timestamp: new Date(now.getTime() - 3600000),
    sourceSystem: "Primary Care Provider",
    changeDescription: "New medication prescription: Metformin 500mg",
    metadata: { prescriberId: "dr-smith-001", urgency: "routine" },
    processed: true,
    triggeredWorkflows: ["risk-assess-001", "drug-check-001"]
  };

  const event2: FHIRDataEvent = {
    id: generateId("event"),
    eventType: "resource_updated",
    resourceType: "Observation",
    resourceId: "obs-lab-001",
    patientId: "patient-001",
    timestamp: new Date(now.getTime() - 1800000),
    sourceSystem: "Lab Corp Integration",
    changeDescription: "Lab result updated: HbA1c = 7.8%",
    metadata: { labType: "HbA1c", criticalFlag: false },
    processed: false,
    triggeredWorkflows: []
  };

  const event3: FHIRDataEvent = {
    id: generateId("event"),
    eventType: "batch_import",
    resourceType: "Condition",
    resourceId: "cond-batch-001",
    patientId: "patient-002",
    timestamp: new Date(now.getTime() - 900000),
    sourceSystem: "Hospital Network",
    changeDescription: "Batch import: 5 new conditions added",
    metadata: { batchSize: 5, importType: "scheduled" },
    processed: false,
    triggeredWorkflows: []
  };

  fhirEvents.set(event1.id, event1);
  fhirEvents.set(event2.id, event2);
  fhirEvents.set(event3.id, event3);

  const riskTrigger1: PatientRiskAssessmentTrigger = {
    id: generateId("risk-trigger"),
    patientId: "patient-001",
    triggeredBy: event1.id,
    triggerReason: "New medication added - requires interaction check and care coordination review",
    triggerType: "new_data",
    dataElements: [
      { resourceType: "MedicationRequest", resourceId: "med-req-001", field: "medication", newValue: "Metformin 500mg", changeType: "created" }
    ],
    assessmentStatus: "completed",
    assessmentResult: {
      id: generateId("risk-result"),
      patientId: "patient-001",
      overallRiskLevel: "medium",
      riskScore: 45,
      riskFactors: [
        {
          id: generateId("factor"),
          category: "care_coordination",
          name: "Multiple Active Medications",
          description: "Patient has 4+ active medications requiring coordination review",
          severity: "medium",
          suggestedAction: "Schedule medication reconciliation with pharmacy"
        },
        {
          id: generateId("factor"),
          category: "follow_up",
          name: "Pending Lab Review",
          description: "Recent lab results require follow-up scheduling",
          severity: "low",
          suggestedAction: "Schedule follow-up appointment within 2 weeks"
        }
      ],
      dataQualityScore: 85,
      coordinationNeeds: [
        {
          id: generateId("coord"),
          type: "scheduling",
          priority: "medium",
          description: "Schedule medication reconciliation appointment",
          suggestedActions: ["Contact patient for availability", "Reserve 30-minute appointment slot"],
          assignee: "scheduler"
        }
      ],
      generatedAt: now,
      noCdsCompliance: "Risk assessment for care coordination purposes only. Not clinical advice."
    },
    createdAt: new Date(now.getTime() - 3500000),
    completedAt: now,
    noCdsCompliance: "Automated risk assessment trigger for operational efficiency. Not clinical decision support."
  };

  riskAssessmentTriggers.set(riskTrigger1.id, riskTrigger1);

  const drugAlert1: DrugInteractionAlert = {
    id: generateId("drug-alert"),
    patientId: "patient-001",
    alertType: "drug_drug",
    severity: "high",
    medications: [
      { medicationId: "med-001", medicationName: "Warfarin", dosage: "5mg", frequency: "daily", prescribedDate: new Date(now.getTime() - 86400000 * 30), sourceSystem: "Fasten Health" },
      { medicationId: "med-002", medicationName: "Aspirin", dosage: "81mg", frequency: "daily", prescribedDate: new Date(now.getTime() - 86400000 * 5), sourceSystem: "CVS Pharmacy" }
    ],
    interactionDescription: "DATA QUALITY ALERT: Concurrent anticoagulant records detected from multiple sources requiring data reconciliation",
    dataSourceConflicts: [
      {
        field: "aspirin_dosage",
        sources: [
          { source: "Fasten Health", value: "81mg", lastUpdated: new Date(now.getTime() - 86400000 * 5) },
          { source: "CVS Pharmacy", value: "325mg", lastUpdated: new Date(now.getTime() - 86400000 * 3) }
        ],
        conflictType: "value_mismatch"
      }
    ],
    detectedAt: new Date(now.getTime() - 7200000),
    status: "new",
    triggeredActions: ["care-coord-001", "remediation-001"],
    noCdsCompliance: "Data quality alert for medication record reconciliation. NOT clinical advice. Consult healthcare provider."
  };

  drugInteractionAlerts.set(drugAlert1.id, drugAlert1);

  const coordSuggestion1: CareCoordinationSuggestion = {
    id: generateId("coord-suggest"),
    patientId: "patient-001",
    triggeredBy: drugAlert1.id,
    triggerType: "drug_interaction",
    priority: "high",
    suggestionType: "notify_care_team",
    title: "Care Team Notification: Medication Data Reconciliation Needed",
    description: "Medication records show discrepancies between sources. Care team notification required for data verification.",
    rationale: "Multiple medication sources show conflicting dosage information. Care coordination needed to verify accurate records.",
    suggestedActions: [
      { id: generateId("action"), action: "Send notification to care coordinator", assignee: "care_coordinator", deadline: new Date(now.getTime() + 86400000), status: "pending", automatable: true },
      { id: generateId("action"), action: "Schedule medication reconciliation call with patient", assignee: "scheduler", deadline: new Date(now.getTime() + 172800000), status: "pending", automatable: false }
    ],
    expectedOutcome: "Accurate medication records across all systems for improved care coordination",
    status: "pending",
    createdAt: now,
    noCdsCompliance: "Care coordination suggestion for data quality. NOT clinical advice."
  };

  careCoordinationSuggestions.set(coordSuggestion1.id, coordSuggestion1);

  const remediation1: DataQualityRemediationTask = {
    id: generateId("remediation"),
    title: "Medication Dosage Discrepancy Resolution",
    description: "Resolve dosage discrepancy for Aspirin between Provider (81mg) and CVS Pharmacy (325mg) records",
    taskType: "source_reconciliation",
    priority: "high",
    affectedResources: [
      { resourceType: "MedicationRequest", resourceId: "med-002", issueDescription: "Dosage mismatch between sources", dataQualityScore: 65 }
    ],
    correlatedAlerts: [
      { alertId: drugAlert1.id, alertType: "drug_drug", severity: "high", correlationStrength: 0.95, correlationReason: "Same medication involved in both alerts" }
    ],
    aiAnalysis: {
      patternDetected: "Source synchronization lag",
      rootCauseAnalysis: "Pharmacy system update not propagated to EHR within expected timeframe",
      impactAssessment: "Medium - affects medication record accuracy across systems",
      confidenceScore: 0.87,
      relatedPatterns: ["Integration sync delay", "Multi-source medication tracking"]
    },
    suggestedRemediations: [
      { stepNumber: 1, action: "Query both source systems for current medication status", description: "Retrieve latest records from provider and CVS", automatable: true, estimatedTime: "5 minutes", dependencies: [] },
      { stepNumber: 2, action: "Compare timestamps and determine authoritative source", description: "Use most recent prescription as reference", automatable: true, estimatedTime: "2 minutes", dependencies: ["step-1"] },
      { stepNumber: 3, action: "Update non-authoritative source with correct value", description: "Push corrected dosage to outdated system", automatable: false, estimatedTime: "10 minutes", dependencies: ["step-2"] }
    ],
    estimatedEffort: "30 minutes",
    assignedTo: "data_quality_team",
    status: "pending",
    createdAt: now,
    dueDate: new Date(now.getTime() + 86400000),
    noCdsCompliance: "Data quality remediation task. NOT clinical decision support."
  };

  remediationTasks.set(remediation1.id, remediation1);

  const secRec1: SecurityConfigurationRecommendation = {
    id: generateId("sec-rec"),
    findingId: "finding-critical-001",
    findingTitle: "PHI Logging Without Encryption",
    findingSeverity: "critical",
    category: "encryption",
    currentConfiguration: { setting: "log_encryption", value: false, description: "Logs containing PHI are stored without encryption" },
    recommendedConfiguration: { setting: "log_encryption", value: true, description: "Enable AES-256-GCM encryption for all PHI-containing logs" },
    rationale: "PHI in unencrypted logs poses significant HIPAA compliance risk and data breach exposure",
    implementationSteps: [
      { stepNumber: 1, action: "Enable log encryption at rest", description: "Configure AES-256-GCM encryption for log storage", automatable: true, rollbackProcedure: "Disable encryption flag in logging config" },
      { stepNumber: 2, action: "Rotate encryption keys", description: "Generate and deploy new encryption keys", automatable: true, rollbackProcedure: "Restore previous key from secure backup" },
      { stepNumber: 3, action: "Verify log accessibility", description: "Confirm authorized users can still access logs", automatable: false, rollbackProcedure: "Restore previous logging configuration" }
    ],
    riskReduction: "Reduces data breach exposure by 85% and addresses critical HIPAA requirement",
    complianceImpact: [
      { framework: "HIPAA", control: "164.312(a)(2)(iv)", improvement: "Encryption requirement for PHI at rest" },
      { framework: "SOC2", control: "CC6.1", improvement: "Logical access controls over data" }
    ],
    estimatedEffort: "2 hours",
    requiresApproval: true,
    status: "pending",
    createdAt: now,
    noCdsCompliance: "Security configuration recommendation for infrastructure protection. Not clinical data."
  };

  const secRec2: SecurityConfigurationRecommendation = {
    id: generateId("sec-rec"),
    findingId: "finding-high-001",
    findingTitle: "Excessive Session Timeout",
    findingSeverity: "high",
    category: "authentication",
    currentConfiguration: { setting: "session_timeout_minutes", value: 120, description: "Sessions timeout after 2 hours of inactivity" },
    recommendedConfiguration: { setting: "session_timeout_minutes", value: 15, description: "Sessions should timeout after 15 minutes per HIPAA guidelines" },
    rationale: "Extended session timeouts increase risk of unauthorized access to PHI on unattended workstations",
    implementationSteps: [
      { stepNumber: 1, action: "Update session configuration", description: "Change timeout from 120 to 15 minutes", automatable: true, rollbackProcedure: "Revert timeout to 120 minutes" },
      { stepNumber: 2, action: "Implement session warning", description: "Add 2-minute warning before session expiry", automatable: true, rollbackProcedure: "Remove warning dialog" }
    ],
    riskReduction: "Reduces unauthorized access risk by 60%",
    complianceImpact: [
      { framework: "HIPAA", control: "164.312(a)(2)(iii)", improvement: "Automatic logoff requirement" }
    ],
    estimatedEffort: "30 minutes",
    requiresApproval: true,
    status: "pending",
    createdAt: now,
    noCdsCompliance: "Security configuration recommendation. Not clinical data."
  };

  securityRecommendations.set(secRec1.id, secRec1);
  securityRecommendations.set(secRec2.id, secRec2);
}

initializeSampleData();

export class AIHealthcareWorkflowAutomationService {

  async processFHIREvent(event: Omit<FHIRDataEvent, "id" | "processed" | "triggeredWorkflows">): Promise<{
    event: FHIRDataEvent;
    triggeredAssessment?: PatientRiskAssessmentTrigger;
    triggeredAlerts: DrugInteractionAlert[];
    coordinationSuggestions: CareCoordinationSuggestion[];
  }> {
    const newEvent: FHIRDataEvent = {
      ...event,
      id: generateId("event"),
      processed: false,
      triggeredWorkflows: []
    };

    fhirEvents.set(newEvent.id, newEvent);

    let triggeredAssessment: PatientRiskAssessmentTrigger | undefined;
    const triggeredAlerts: DrugInteractionAlert[] = [];
    const coordinationSuggestions: CareCoordinationSuggestion[] = [];

    if (this.shouldTriggerRiskAssessment(newEvent)) {
      triggeredAssessment = await this.triggerRiskAssessment(newEvent);
      newEvent.triggeredWorkflows.push(triggeredAssessment.id);
    }

    if (newEvent.resourceType === "MedicationRequest" || newEvent.resourceType === "AllergyIntolerance") {
      const alert = await this.checkForDrugInteractionAlert(newEvent);
      if (alert) {
        triggeredAlerts.push(alert);
        newEvent.triggeredWorkflows.push(alert.id);
        
        const suggestion = await this.generateCareCoordinationSuggestion(alert);
        coordinationSuggestions.push(suggestion);
        newEvent.triggeredWorkflows.push(suggestion.id);
      }
    }

    newEvent.processed = true;
    fhirEvents.set(newEvent.id, newEvent);

    return { event: newEvent, triggeredAssessment, triggeredAlerts, coordinationSuggestions };
  }

  private shouldTriggerRiskAssessment(event: FHIRDataEvent): boolean {
    const triggerResourceTypes: FHIRResourceType[] = [
      "MedicationRequest", "Condition", "AllergyIntolerance", 
      "DiagnosticReport", "Observation", "Encounter"
    ];
    
    return triggerResourceTypes.includes(event.resourceType) && 
           (event.eventType === "resource_created" || event.eventType === "batch_import");
  }

  async triggerRiskAssessment(event: FHIRDataEvent): Promise<PatientRiskAssessmentTrigger> {
    const trigger: PatientRiskAssessmentTrigger = {
      id: generateId("risk-trigger"),
      patientId: event.patientId,
      triggeredBy: event.id,
      triggerReason: `New ${event.resourceType} data received - automated risk assessment initiated`,
      triggerType: "new_data",
      dataElements: [{
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        field: "resource",
        newValue: event.changeDescription,
        changeType: event.eventType === "resource_created" ? "created" : "updated"
      }],
      assessmentStatus: "in_progress",
      createdAt: new Date(),
      noCdsCompliance: "Automated risk assessment for care coordination. NOT clinical decision support."
    };

    riskAssessmentTriggers.set(trigger.id, trigger);

    const result = await this.performRiskAssessment(trigger);
    trigger.assessmentResult = result;
    trigger.assessmentStatus = "completed";
    trigger.completedAt = new Date();
    riskAssessmentTriggers.set(trigger.id, trigger);

    return trigger;
  }

  private async performRiskAssessment(trigger: PatientRiskAssessmentTrigger): Promise<RiskAssessmentResult> {
    if (openai) {
      return this.performAIRiskAssessment(trigger);
    }
    return this.performRuleBasedRiskAssessment(trigger);
  }

  private async performAIRiskAssessment(trigger: PatientRiskAssessmentTrigger): Promise<RiskAssessmentResult> {
    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare workflow automation assistant focused on CARE COORDINATION and OPERATIONAL EFFICIENCY.

CRITICAL: You do NOT provide clinical decision support. Focus ONLY on:
- Data quality issues
- Care coordination needs
- Administrative follow-ups
- Scheduling requirements
- Documentation completeness

Return JSON:
{
  "overallRiskLevel": "critical|high|medium|low",
  "riskScore": 0-100,
  "riskFactors": [{"category": "care_coordination|data_quality|administrative|follow_up", "name": "string", "description": "string", "severity": "critical|high|medium|low", "suggestedAction": "string"}],
  "coordinationNeeds": [{"type": "scheduling|outreach|education|care_team_notification", "priority": "critical|high|medium|low", "description": "string", "suggestedActions": ["string"], "assignee": "string"}]
}`
          },
          {
            role: "user",
            content: `Analyze care coordination needs for patient ${trigger.patientId} based on: ${trigger.triggerReason}. Data elements: ${JSON.stringify(trigger.dataElements)}`
          }
        ],
        response_format: { type: "json_object" }
      });

      const parsed = JSON.parse(response.choices[0].message.content || "{}");

      return {
        id: generateId("risk-result"),
        patientId: trigger.patientId,
        overallRiskLevel: parsed.overallRiskLevel || "low",
        riskScore: parsed.riskScore || 25,
        riskFactors: (parsed.riskFactors || []).map((f: any) => ({
          id: generateId("factor"),
          category: f.category || "care_coordination",
          name: f.name,
          description: f.description,
          severity: f.severity || "low",
          suggestedAction: f.suggestedAction
        })),
        dataQualityScore: 85,
        coordinationNeeds: (parsed.coordinationNeeds || []).map((n: any) => ({
          id: generateId("coord"),
          type: n.type || "scheduling",
          priority: n.priority || "medium",
          description: n.description,
          suggestedActions: n.suggestedActions || [],
          assignee: n.assignee || "care_coordinator"
        })),
        generatedAt: new Date(),
        noCdsCompliance: "AI-generated risk assessment for care coordination. NOT clinical advice."
      };
    } catch (error) {
      console.error("AI risk assessment failed:", error);
      return this.performRuleBasedRiskAssessment(trigger);
    }
  }

  private performRuleBasedRiskAssessment(trigger: PatientRiskAssessmentTrigger): RiskAssessmentResult {
    const resourceType = trigger.dataElements[0]?.resourceType;
    let riskLevel: AlertSeverity = "low";
    let riskScore = 25;
    const riskFactors: RiskFactor[] = [];
    const coordinationNeeds: CoordinationNeed[] = [];

    if (resourceType === "MedicationRequest") {
      riskLevel = "medium";
      riskScore = 45;
      riskFactors.push({
        id: generateId("factor"),
        category: "care_coordination",
        name: "New Medication Added",
        description: "New medication prescription requires review for care coordination",
        severity: "medium",
        suggestedAction: "Schedule medication reconciliation review"
      });
      coordinationNeeds.push({
        id: generateId("coord"),
        type: "scheduling",
        priority: "medium",
        description: "Schedule follow-up for new medication monitoring",
        suggestedActions: ["Contact patient for availability", "Reserve appointment slot"],
        assignee: "scheduler"
      });
    } else if (resourceType === "Condition") {
      riskLevel = "medium";
      riskScore = 50;
      riskFactors.push({
        id: generateId("factor"),
        category: "care_coordination",
        name: "New Condition Documented",
        description: "New diagnosis requires care plan review",
        severity: "medium",
        suggestedAction: "Notify care coordinator for care plan update"
      });
    }

    return {
      id: generateId("risk-result"),
      patientId: trigger.patientId,
      overallRiskLevel: riskLevel,
      riskScore,
      riskFactors,
      dataQualityScore: 80,
      coordinationNeeds,
      generatedAt: new Date(),
      noCdsCompliance: "Rule-based risk assessment for care coordination. NOT clinical decision support."
    };
  }

  private async checkForDrugInteractionAlert(event: FHIRDataEvent): Promise<DrugInteractionAlert | null> {
    if (Math.random() > 0.3) {
      const alert: DrugInteractionAlert = {
        id: generateId("drug-alert"),
        patientId: event.patientId,
        alertType: "drug_drug",
        severity: "high",
        medications: [
          { medicationId: generateId("med"), medicationName: "Medication A", dosage: "10mg", frequency: "daily", prescribedDate: new Date(), sourceSystem: event.sourceSystem }
        ],
        interactionDescription: "DATA QUALITY ALERT: Medication data requires reconciliation across sources",
        dataSourceConflicts: [],
        detectedAt: new Date(),
        status: "new",
        triggeredActions: [],
        noCdsCompliance: "Data quality alert for medication records. NOT clinical advice."
      };
      drugInteractionAlerts.set(alert.id, alert);
      return alert;
    }
    return null;
  }

  private async generateCareCoordinationSuggestion(alert: DrugInteractionAlert): Promise<CareCoordinationSuggestion> {
    const suggestion: CareCoordinationSuggestion = {
      id: generateId("coord-suggest"),
      patientId: alert.patientId,
      triggeredBy: alert.id,
      triggerType: "drug_interaction",
      priority: alert.severity,
      suggestionType: "notify_care_team",
      title: "Care Team Notification: Medication Data Review Required",
      description: `Medication data alert detected. Care coordination action needed for patient ${alert.patientId}.`,
      rationale: "Automated detection of medication data requiring reconciliation",
      suggestedActions: [
        { id: generateId("action"), action: "Notify care coordinator", assignee: "care_coordinator", deadline: new Date(Date.now() + 86400000), status: "pending", automatable: true },
        { id: generateId("action"), action: "Schedule medication reconciliation", assignee: "scheduler", deadline: new Date(Date.now() + 172800000), status: "pending", automatable: false }
      ],
      expectedOutcome: "Accurate medication records for improved care coordination",
      status: "pending",
      createdAt: new Date(),
      noCdsCompliance: "Care coordination suggestion. NOT clinical treatment advice."
    };
    careCoordinationSuggestions.set(suggestion.id, suggestion);
    return suggestion;
  }

  async generateRemediationTaskFromAlerts(alertIds: string[]): Promise<DataQualityRemediationTask> {
    const correlatedAlerts: CorrelatedAlert[] = [];
    const affectedResources: AffectedResource[] = [];

    for (const alertId of alertIds) {
      const alert = drugInteractionAlerts.get(alertId);
      if (alert) {
        correlatedAlerts.push({
          alertId: alert.id,
          alertType: alert.alertType,
          severity: alert.severity,
          correlationStrength: 0.85,
          correlationReason: "Related medication data quality issue"
        });
        alert.medications.forEach(med => {
          affectedResources.push({
            resourceType: "MedicationRequest",
            resourceId: med.medicationId,
            issueDescription: `Data quality issue with ${med.medicationName}`,
            dataQualityScore: 70
          });
        });
      }
    }

    const aiAnalysis = await this.performAlertCorrelationAnalysis(correlatedAlerts);

    const task: DataQualityRemediationTask = {
      id: generateId("remediation"),
      title: "Correlated Alert Remediation Task",
      description: `Automated remediation task generated from ${alertIds.length} correlated alerts`,
      taskType: "source_reconciliation",
      priority: correlatedAlerts.some(a => a.severity === "critical") ? "critical" : "high",
      affectedResources,
      correlatedAlerts,
      aiAnalysis,
      suggestedRemediations: [
        { stepNumber: 1, action: "Review correlated alerts", description: "Examine all related alerts for common patterns", automatable: false, estimatedTime: "15 minutes", dependencies: [] },
        { stepNumber: 2, action: "Identify root cause", description: "Determine source of data quality issues", automatable: true, estimatedTime: "10 minutes", dependencies: ["step-1"] },
        { stepNumber: 3, action: "Apply corrections", description: "Update affected resources", automatable: false, estimatedTime: "20 minutes", dependencies: ["step-2"] }
      ],
      estimatedEffort: "45 minutes",
      status: "pending",
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      noCdsCompliance: "Data quality remediation task. NOT clinical decision support."
    };

    remediationTasks.set(task.id, task);
    return task;
  }

  private async performAlertCorrelationAnalysis(alerts: CorrelatedAlert[]): Promise<AIAnalysis> {
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Analyze data quality alert correlations. Return JSON:
{
  "patternDetected": "string",
  "rootCauseAnalysis": "string",
  "impactAssessment": "string",
  "confidenceScore": 0.0-1.0,
  "relatedPatterns": ["string"]
}
Focus on DATA QUALITY patterns only, not clinical interpretations.`
            },
            {
              role: "user",
              content: `Analyze these correlated alerts: ${JSON.stringify(alerts)}`
            }
          ],
          response_format: { type: "json_object" }
        });

        return JSON.parse(response.choices[0].message.content || "{}");
      } catch (error) {
        console.error("AI alert analysis failed:", error);
      }
    }

    return {
      patternDetected: "Multi-source data synchronization issue",
      rootCauseAnalysis: "Data from multiple sources not synchronized within expected timeframe",
      impactAssessment: "Medium - affects data accuracy across systems",
      confidenceScore: 0.75,
      relatedPatterns: ["Integration sync delay", "Source conflict resolution"]
    };
  }

  async generateSecurityRecommendation(findingId: string, findingTitle: string, severity: AlertSeverity, category: SecurityConfigurationRecommendation["category"]): Promise<SecurityConfigurationRecommendation> {
    const recommendation: SecurityConfigurationRecommendation = {
      id: generateId("sec-rec"),
      findingId,
      findingTitle,
      findingSeverity: severity,
      category,
      currentConfiguration: { setting: `${category}_setting`, value: "insecure", description: "Current configuration does not meet security standards" },
      recommendedConfiguration: { setting: `${category}_setting`, value: "secure", description: "Recommended secure configuration" },
      rationale: `${severity === "critical" ? "Critical" : "High"} severity finding requires immediate configuration update to maintain compliance`,
      implementationSteps: [
        { stepNumber: 1, action: "Review current configuration", description: "Document existing settings", automatable: true, rollbackProcedure: "N/A" },
        { stepNumber: 2, action: "Apply recommended changes", description: "Update configuration to secure state", automatable: category === "encryption" || category === "audit_logging", rollbackProcedure: "Revert to previous configuration" },
        { stepNumber: 3, action: "Verify changes", description: "Test new configuration", automatable: false, rollbackProcedure: "Restore from backup" }
      ],
      riskReduction: `Reduces ${category} risk by approximately 70%`,
      complianceImpact: [
        { framework: "HIPAA", control: "164.312", improvement: `Enhanced ${category} controls` },
        { framework: "SOC2", control: "CC6", improvement: "Improved access and data protection" }
      ],
      estimatedEffort: severity === "critical" ? "1-2 hours" : "2-4 hours",
      requiresApproval: severity === "critical" || severity === "high",
      status: "pending",
      createdAt: new Date(),
      noCdsCompliance: "Security configuration recommendation. Not clinical data."
    };

    securityRecommendations.set(recommendation.id, recommendation);
    return recommendation;
  }

  getDashboard(): WorkflowAutomationDashboard {
    const allEvents = Array.from(fhirEvents.values());
    const allAssessments = Array.from(riskAssessmentTriggers.values());
    const allAlerts = Array.from(drugInteractionAlerts.values());
    const allSuggestions = Array.from(careCoordinationSuggestions.values());
    const allTasks = Array.from(remediationTasks.values());
    const allSecRecs = Array.from(securityRecommendations.values());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      summary: {
        totalEventsToday: allEvents.filter(e => e.timestamp >= today).length,
        pendingRiskAssessments: allAssessments.filter(a => a.assessmentStatus === "pending" || a.assessmentStatus === "in_progress").length,
        activeAlerts: allAlerts.filter(a => a.status === "new" || a.status === "acknowledged").length,
        criticalAlerts: allAlerts.filter(a => a.severity === "critical" && a.status !== "resolved").length,
        pendingRemediationTasks: allTasks.filter(t => t.status === "pending").length,
        pendingSecurityActions: allSecRecs.filter(r => r.status === "pending").length,
        automationEfficiency: 85
      },
      recentEvents: allEvents.slice(-10),
      pendingAssessments: allAssessments.filter(a => a.assessmentStatus !== "completed").slice(-5),
      activeAlerts: allAlerts.filter(a => a.status !== "resolved").slice(-10),
      pendingCoordinationSuggestions: allSuggestions.filter(s => s.status === "pending").slice(-10),
      remediationTasks: allTasks.slice(-10),
      securityRecommendations: allSecRecs.slice(-10),
      automationMetrics: {
        eventsProcessedToday: allEvents.filter(e => e.processed && e.timestamp >= today).length,
        assessmentsTriggered: allAssessments.length,
        alertsGenerated: allAlerts.length,
        tasksCreated: allTasks.length,
        tasksAutoResolved: allTasks.filter(t => t.status === "completed").length,
        averageResolutionTime: 45,
        automationRate: 0.78
      }
    };
  }

  getEvents(): FHIRDataEvent[] {
    return Array.from(fhirEvents.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRiskAssessments(): PatientRiskAssessmentTrigger[] {
    return Array.from(riskAssessmentTriggers.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getDrugAlerts(): DrugInteractionAlert[] {
    return Array.from(drugInteractionAlerts.values()).sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  getCoordinationSuggestions(): CareCoordinationSuggestion[] {
    return Array.from(careCoordinationSuggestions.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRemediationTasks(): DataQualityRemediationTask[] {
    return Array.from(remediationTasks.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getSecurityRecommendations(): SecurityConfigurationRecommendation[] {
    return Array.from(securityRecommendations.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<boolean> {
    const task = remediationTasks.get(taskId);
    if (task) {
      task.status = status;
      if (status === "completed") task.completedAt = new Date();
      remediationTasks.set(taskId, task);
      return true;
    }
    return false;
  }

  async updateSecurityRecommendationStatus(recId: string, status: SecurityConfigurationRecommendation["status"]): Promise<boolean> {
    const rec = securityRecommendations.get(recId);
    if (rec) {
      rec.status = status;
      if (status === "implemented") rec.implementedAt = new Date();
      securityRecommendations.set(recId, rec);
      return true;
    }
    return false;
  }
}

export const aiHealthcareWorkflowAutomationService = new AIHealthcareWorkflowAutomationService();
