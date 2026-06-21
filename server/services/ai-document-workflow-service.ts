import { logPhiAccess } from "../security/hipaa-audit";
import * as docGenService from "./ai-document-generation-service";

const NO_CDS_DISCLAIMER = "DISCLAIMER: Automated workflow suggestions are for documentation assistance purposes only. They do NOT constitute clinical decision support. All generated documents require review and validation by a licensed healthcare provider before official use.";

function auditLog(action: string, userId: string, patientId?: string, details?: string) {
  logPhiAccess({
    userId,
    patientId: patientId || "N/A",
    resourceType: "AIDocumentWorkflow",
    action: action.includes("DELETE") ? "delete" : action.includes("CREATE") || action.includes("ACCEPT") ? "write" : "read",
    details: `[DocumentWorkflow] ${action}: ${details || "N/A"}`,
  });
}

export type ClinicalEventType =
  | "diagnosis_added"
  | "diagnosis_updated"
  | "patient_status_changed"
  | "lab_result_flagged"
  | "medication_prescribed"
  | "referral_requested"
  | "procedure_scheduled"
  | "vitals_abnormal";

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  eventType: ClinicalEventType;
  eventFilters: Record<string, string>;
  targetDocumentTypeId: string;
  contextTemplate: Record<string, string>;
  priority: "low" | "medium" | "high" | "urgent";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalEvent {
  eventType: ClinicalEventType;
  patientId: string;
  patientName: string;
  data: Record<string, string>;
  timestamp: string;
  source?: string;
}

export interface WorkflowSuggestion {
  id: string;
  ruleId: string;
  ruleName: string;
  eventType: ClinicalEventType;
  eventSummary: string;
  patientId: string;
  patientName: string;
  targetDocumentTypeId: string;
  targetDocumentTypeName: string;
  prefilledContext: Record<string, string>;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "accepted" | "dismissed" | "expired";
  generatedDraftId?: string;
  userId: string;
  createdAt: string;
  resolvedAt?: string;
  disclaimer: string;
}

const rules: Map<string, WorkflowRule> = new Map();
const suggestions: Map<string, WorkflowSuggestion> = new Map();
const eventHistory: ClinicalEvent[] = [];
let ruleCounter = 0;
let suggestionCounter = 0;

const EVENT_TYPE_LABELS: Record<ClinicalEventType, string> = {
  diagnosis_added: "Diagnosis Added",
  diagnosis_updated: "Diagnosis Updated",
  patient_status_changed: "Patient Status Changed",
  lab_result_flagged: "Lab Result Flagged",
  medication_prescribed: "Medication Prescribed",
  referral_requested: "Referral Requested",
  procedure_scheduled: "Procedure Scheduled",
  vitals_abnormal: "Vitals Abnormal",
};

const DEFAULT_RULES: Omit<WorkflowRule, "id" | "createdAt" | "updatedAt" | "createdBy">[] = [
  {
    name: "Cardiology Referral on CHF Diagnosis",
    description: "Automatically suggest a referral letter to cardiology when congestive heart failure (CHF) or heart failure is diagnosed",
    enabled: true,
    eventType: "diagnosis_added",
    eventFilters: { diagnosisPattern: "heart failure|CHF|congestive heart|cardiomyopathy" },
    targetDocumentTypeId: "referral-letter",
    contextTemplate: {
      reasonForReferral: "Evaluation and management of newly diagnosed {{diagnosis}}",
      referringProvider: "[Current Provider]",
      referredToProvider: "Cardiology",
      urgency: "Routine",
      clinicalQuestionsForSpecialist: "1. Please evaluate cardiac function and stage of heart failure\n2. Recommend optimal pharmacological management\n3. Assess need for device therapy (ICD/CRT)",
      treatmentsTriedAndOutcomes: "{{treatmentsTriedAndOutcomes}}",
      relevantLabResults: "{{relevantLabResults}}",
      recentImagingFindings: "{{recentImagingFindings}}",
    },
    priority: "high",
  },
  {
    name: "Discharge Summary on Status Change",
    description: "Prompt for a discharge summary when a patient's status changes to discharged",
    enabled: true,
    eventType: "patient_status_changed",
    eventFilters: { newStatus: "discharged" },
    targetDocumentTypeId: "discharge-summary",
    contextTemplate: {
      admissionDate: "{{admissionDate}}",
      dischargeDate: "{{eventDate}}",
      primaryDiagnosis: "{{primaryDiagnosis}}",
      reasonForAdmission: "{{reasonForAdmission}}",
      hospitalCourse: "{{hospitalCourse}}",
      conditionAtDischarge: "{{conditionAtDischarge}}",
      medicationChangesExplained: "{{medicationChangesExplained}}",
      pendingResultsAtDischarge: "{{pendingResultsAtDischarge}}",
      caregiverInstructions: "{{caregiverInstructions}}",
    },
    priority: "high",
  },
  {
    name: "Lab Report Explanation on Critical Results",
    description: "Suggest generating a patient-friendly lab explanation when critical or abnormal lab results are flagged",
    enabled: true,
    eventType: "lab_result_flagged",
    eventFilters: { severity: "critical|abnormal" },
    targetDocumentTypeId: "lab-report-explanation",
    contextTemplate: {
      labTests: "{{labName}}: {{labValue}} ({{flagStatus}})",
      clinicalContext: "Result flagged as {{flagStatus}} — requires clinical review and patient communication",
      reasonForTest: "{{reasonForTest}}",
      priorLabComparison: "{{priorLabComparison}}",
      resultSignificance: "{{resultSignificance}}",
      recommendedFollowUp: "{{recommendedFollowUp}}",
    },
    priority: "urgent",
  },
  {
    name: "Progress Note on New Medication",
    description: "Suggest a progress note when a new medication is prescribed to document the clinical rationale",
    enabled: true,
    eventType: "medication_prescribed",
    eventFilters: {},
    targetDocumentTypeId: "progress-note",
    contextTemplate: {
      chiefComplaint: "Medication management — {{medicationName}} prescribed",
      plan: "Started {{medicationName}} {{dosage}} for {{indication}}",
      visitDate: "{{eventDate}}",
      assessment: "New medication prescribed: {{medicationName}} for {{indication}}",
      reasonForMedicationChange: "{{reasonForMedicationChange}}",
      sharedDecisionMaking: "{{sharedDecisionMaking}}",
    },
    priority: "medium",
  },
  {
    name: "Referral Letter on Specialist Request",
    description: "Generate a referral letter when a referral to a specialist is requested",
    enabled: true,
    eventType: "referral_requested",
    eventFilters: {},
    targetDocumentTypeId: "referral-letter",
    contextTemplate: {
      referringProvider: "[Current Provider]",
      referredToProvider: "{{specialty}}",
      reasonForReferral: "{{reason}}",
      urgency: "{{urgency}}",
      clinicalQuestionsForSpecialist: "{{clinicalQuestionsForSpecialist}}",
      treatmentsTriedAndOutcomes: "{{treatmentsTriedAndOutcomes}}",
      relevantLabResults: "{{relevantLabResults}}",
      recentImagingFindings: "{{recentImagingFindings}}",
      functionalLimitations: "{{functionalLimitations}}",
    },
    priority: "medium",
  },
  {
    name: "Care Plan on Abnormal Vitals",
    description: "Suggest a care plan letter when vitals are flagged as abnormal to communicate the plan to the patient",
    enabled: true,
    eventType: "vitals_abnormal",
    eventFilters: {},
    targetDocumentTypeId: "care-plan-letter",
    contextTemplate: {
      conditions: "Abnormal vitals detected: {{vitalType}} = {{vitalValue}}",
      goals: "Normalize {{vitalType}} to target range ({{normalRange}})",
      selfMonitoringInstructions: "Monitor {{vitalType}} at home; record readings daily",
      triggerSymptoms: "Seek immediate care if {{vitalType}} exceeds critical thresholds or you experience severe symptoms",
      dietaryGuidelines: "{{dietaryGuidelines}}",
      exerciseRecommendations: "{{exerciseRecommendations}}",
    },
    priority: "high",
  },
];

function initializeDefaultRules() {
  if (rules.size === 0) {
    const now = new Date().toISOString();
    DEFAULT_RULES.forEach((r) => {
      ruleCounter++;
      const rule: WorkflowRule = {
        ...r,
        id: `wf-rule-${ruleCounter}`,
        createdBy: "system",
        createdAt: now,
        updatedAt: now,
      };
      rules.set(rule.id, rule);
    });
    console.log(`[DocumentWorkflow] Initialized ${DEFAULT_RULES.length} default workflow rules`);
  }
}

initializeDefaultRules();

export function getRules(userId?: string): WorkflowRule[] {
  auditLog("RULES_VIEWED", userId || "system", undefined, `Viewed ${rules.size} workflow rules`);
  return Array.from(rules.values()).sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function getRule(id: string): WorkflowRule | undefined {
  auditLog("RULE_VIEWED", "system", undefined, `Viewed rule: ${id}`);
  return rules.get(id);
}

export function createRule(input: {
  name: string;
  description: string;
  eventType: ClinicalEventType;
  eventFilters: Record<string, string>;
  targetDocumentTypeId: string;
  contextTemplate: Record<string, string>;
  priority: WorkflowRule["priority"];
  userId: string;
}): WorkflowRule {
  const docType = docGenService.getDocumentType(input.targetDocumentTypeId);
  if (!docType) {
    throw new Error(`Unknown document type: ${input.targetDocumentTypeId}`);
  }

  ruleCounter++;
  const now = new Date().toISOString();
  const rule: WorkflowRule = {
    id: `wf-rule-${ruleCounter}`,
    name: input.name,
    description: input.description,
    enabled: true,
    eventType: input.eventType,
    eventFilters: input.eventFilters,
    targetDocumentTypeId: input.targetDocumentTypeId,
    contextTemplate: input.contextTemplate,
    priority: input.priority,
    createdBy: input.userId,
    createdAt: now,
    updatedAt: now,
  };

  rules.set(rule.id, rule);
  auditLog("RULE_CREATED", input.userId, undefined, `Rule: ${rule.name}, Event: ${rule.eventType}, Target: ${rule.targetDocumentTypeId}`);
  return rule;
}

export function updateRule(
  id: string,
  updates: Partial<Pick<WorkflowRule, "name" | "description" | "enabled" | "eventFilters" | "contextTemplate" | "priority">>,
  userId: string
): WorkflowRule | undefined {
  const rule = rules.get(id);
  if (!rule) return undefined;

  if (updates.name !== undefined) rule.name = updates.name;
  if (updates.description !== undefined) rule.description = updates.description;
  if (updates.enabled !== undefined) rule.enabled = updates.enabled;
  if (updates.eventFilters !== undefined) rule.eventFilters = updates.eventFilters;
  if (updates.contextTemplate !== undefined) rule.contextTemplate = updates.contextTemplate;
  if (updates.priority !== undefined) rule.priority = updates.priority;
  rule.updatedAt = new Date().toISOString();

  auditLog("RULE_UPDATED", userId, undefined, `Rule ${id}: ${rule.name}, enabled=${rule.enabled}`);
  return rule;
}

export function deleteRule(id: string, userId: string): boolean {
  const rule = rules.get(id);
  if (!rule) return false;
  auditLog("RULE_DELETED", userId, undefined, `Deleted rule: ${rule.name}`);
  return rules.delete(id);
}

function matchesFilters(event: ClinicalEvent, rule: WorkflowRule): boolean {
  for (const [filterKey, filterValue] of Object.entries(rule.eventFilters)) {
    if (!filterValue || !filterValue.trim()) continue;

    const eventDataValues = Object.values(event.data).join(" ").toLowerCase();
    const specificValue = event.data[filterKey]?.toLowerCase() || "";

    const patterns = filterValue.split("|").map((p) => p.trim().toLowerCase());
    const matched = patterns.some(
      (pattern) =>
        eventDataValues.includes(pattern) ||
        specificValue.includes(pattern)
    );

    if (!matched) return false;
  }
  return true;
}

function resolveTemplate(template: Record<string, string>, event: ClinicalEvent): Record<string, string> {
  const resolved: Record<string, string> = {};
  const eventDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  for (const [key, value] of Object.entries(template)) {
    let resolvedValue = value;
    resolvedValue = resolvedValue.replace(/\{\{eventDate\}\}/g, eventDate);
    resolvedValue = resolvedValue.replace(/\{\{patientName\}\}/g, event.patientName);
    resolvedValue = resolvedValue.replace(/\{\{patientId\}\}/g, event.patientId);

    for (const [dataKey, dataValue] of Object.entries(event.data)) {
      resolvedValue = resolvedValue.replace(new RegExp(`\\{\\{${dataKey}\\}\\}`, "g"), dataValue || "");
    }

    const hasUnresolved = /\{\{[^}]+\}\}/.test(resolvedValue);
    if (hasUnresolved) {
      const fullyUnresolved = resolvedValue.replace(/\{\{[^}]+\}\}/g, "").trim() === "";
      if (fullyUnresolved) continue;
      resolvedValue = resolvedValue.replace(/\{\{[^}]+\}\}/g, "[To be completed]");
    }
    resolved[key] = resolvedValue;
  }

  resolved.patientName = event.patientName;
  return resolved;
}

function buildEventSummary(event: ClinicalEvent): string {
  const label = EVENT_TYPE_LABELS[event.eventType] || event.eventType;
  const details = Object.entries(event.data)
    .filter(([, v]) => v && v.trim())
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  return `${label} for ${event.patientName}${details ? ` — ${details}` : ""}`;
}

export function evaluateEvent(event: ClinicalEvent, userId: string): WorkflowSuggestion[] {
  auditLog("EVENT_RECEIVED", userId, event.patientId, `Event: ${event.eventType}, Patient: ${event.patientName}`);

  eventHistory.push(event);
  if (eventHistory.length > 500) eventHistory.shift();

  const enabledRules = Array.from(rules.values()).filter(
    (r) => r.enabled && r.eventType === event.eventType
  );

  const newSuggestions: WorkflowSuggestion[] = [];

  for (const rule of enabledRules) {
    if (!matchesFilters(event, rule)) continue;

    const docType = docGenService.getDocumentType(rule.targetDocumentTypeId);
    if (!docType) continue;

    const existingSuggestion = Array.from(suggestions.values()).find(
      (s) =>
        s.ruleId === rule.id &&
        s.patientId === event.patientId &&
        s.status === "pending" &&
        s.userId === userId
    );
    if (existingSuggestion) continue;

    suggestionCounter++;
    const prefilledContext = resolveTemplate(rule.contextTemplate, event);

    const suggestion: WorkflowSuggestion = {
      id: `wf-sug-${suggestionCounter}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      eventType: event.eventType,
      eventSummary: buildEventSummary(event),
      patientId: event.patientId,
      patientName: event.patientName,
      targetDocumentTypeId: rule.targetDocumentTypeId,
      targetDocumentTypeName: docType.name,
      prefilledContext,
      priority: rule.priority,
      status: "pending",
      userId,
      createdAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER,
    };

    suggestions.set(suggestion.id, suggestion);
    newSuggestions.push(suggestion);

    auditLog(
      "SUGGESTION_CREATED",
      userId,
      event.patientId,
      `Rule: ${rule.name}, Document: ${docType.name}, Priority: ${rule.priority}`
    );
  }

  return newSuggestions;
}

export function getSuggestions(userId: string, status?: string): WorkflowSuggestion[] {
  auditLog("SUGGESTIONS_VIEWED", userId, undefined, `Viewed suggestions, filter: ${status || "all"}`);
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  return Array.from(suggestions.values())
    .filter((s) => s.userId === userId && (!status || s.status === status))
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export function getSuggestion(id: string): WorkflowSuggestion | undefined {
  const suggestion = suggestions.get(id);
  if (suggestion) {
    auditLog("SUGGESTION_VIEWED", suggestion.userId, suggestion.patientId, `Viewed suggestion: ${id}`);
  }
  return suggestion;
}

export function getPendingSuggestionCount(userId: string): number {
  auditLog("PENDING_COUNT_VIEWED", userId, undefined, "Checked pending suggestion count");
  return Array.from(suggestions.values()).filter(
    (s) => s.userId === userId && s.status === "pending"
  ).length;
}

export async function acceptSuggestion(
  id: string,
  userId: string,
  additionalContext?: Record<string, string>
): Promise<{ suggestion: WorkflowSuggestion; draft: any }> {
  const suggestion = suggestions.get(id);
  if (!suggestion) throw new Error("Suggestion not found");
  if (suggestion.userId !== userId) throw new Error("Access denied");
  if (suggestion.status !== "pending") throw new Error(`Suggestion already ${suggestion.status}`);

  auditLog("SUGGESTION_ACCEPTED", userId, suggestion.patientId, `Suggestion: ${suggestion.id}, Rule: ${suggestion.ruleName}`);

  const context = { ...suggestion.prefilledContext, ...additionalContext };

  const draft = await docGenService.generateDocument({
    documentTypeId: suggestion.targetDocumentTypeId,
    userId,
    patientId: suggestion.patientId,
    patientName: suggestion.patientName,
    context,
    additionalInstructions: `This document was triggered by an automated workflow rule: "${suggestion.ruleName}". Event: ${suggestion.eventSummary}. Ensure the document reflects the clinical context appropriately.`,
  });

  suggestion.status = "accepted";
  suggestion.generatedDraftId = draft.id;
  suggestion.resolvedAt = new Date().toISOString();

  return { suggestion, draft };
}

export function dismissSuggestion(id: string, userId: string): WorkflowSuggestion | undefined {
  const suggestion = suggestions.get(id);
  if (!suggestion || suggestion.userId !== userId) return undefined;
  if (suggestion.status !== "pending") return suggestion;

  suggestion.status = "dismissed";
  suggestion.resolvedAt = new Date().toISOString();

  auditLog("SUGGESTION_DISMISSED", userId, suggestion.patientId, `Suggestion: ${suggestion.id}, Rule: ${suggestion.ruleName}`);
  return suggestion;
}

export function getEventTypes(): { id: ClinicalEventType; label: string }[] {
  auditLog("EVENT_TYPES_VIEWED", "system", undefined, "Viewed available event types");
  return Object.entries(EVENT_TYPE_LABELS).map(([id, label]) => ({
    id: id as ClinicalEventType,
    label,
  }));
}

export function getRecentEvents(limit = 20): ClinicalEvent[] {
  auditLog("RECENT_EVENTS_VIEWED", "system", undefined, `Viewed recent ${limit} events`);
  return eventHistory.slice(-limit).reverse();
}

export function getWorkflowStats(userId: string) {
  auditLog("WORKFLOW_STATS_VIEWED", userId, undefined, "Viewed workflow statistics");
  const userSuggestions = Array.from(suggestions.values()).filter((s) => s.userId === userId);
  return {
    totalRules: rules.size,
    enabledRules: Array.from(rules.values()).filter((r) => r.enabled).length,
    totalSuggestions: userSuggestions.length,
    pendingSuggestions: userSuggestions.filter((s) => s.status === "pending").length,
    acceptedSuggestions: userSuggestions.filter((s) => s.status === "accepted").length,
    dismissedSuggestions: userSuggestions.filter((s) => s.status === "dismissed").length,
    recentEvents: eventHistory.length,
  };
}

console.log("[DocumentWorkflow] Service initialized with automated workflow rules engine");
console.log(`[DocumentWorkflow] Default rules loaded: ${rules.size}`);
console.log("[DocumentWorkflow] Supported events:", Object.keys(EVENT_TYPE_LABELS).join(", "));
