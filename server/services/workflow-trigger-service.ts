import { generateDocument } from "./ai-document-generation-service";
import { suggestCodesFromNote, type CodeSuggestion } from "./healthcare-nlp-service";

function logWorkflowAudit(details: {
  action: string;
  patientId: string;
  triggerId: string;
  executionId: string;
  documentType: string;
  outcome: string;
  metadata?: Record<string, unknown>;
}) {
  console.log(`[HIPAA-AUDIT][WorkflowTrigger] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    ...details,
  })}`);
}

export type TriggerEvent =
  | "encounter.completed"
  | "encounter.status_changed"
  | "lab.results_available"
  | "referral.created"
  | "discharge.initiated"
  | "medication.changed"
  | "appointment.completed";

export interface WorkflowTrigger {
  id: string;
  event: TriggerEvent;
  documentType: string;
  autoGenerate: boolean;
  requiresProviderReview: boolean;
  priority: "high" | "medium" | "low";
  conditions?: Record<string, string>;
}

export interface WorkflowExecution {
  id: string;
  triggerId: string;
  event: TriggerEvent;
  patientId: string;
  status: "pending" | "generating" | "awaiting_review" | "approved" | "rejected" | "failed";
  documentType: string;
  generatedDocumentId?: string;
  generatedContent?: string;
  icdSuggestions?: CodeSuggestion[];
  cptSuggestions?: CodeSuggestion[];
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewNotes?: string;
  error?: string;
}

const DEFAULT_TRIGGERS: WorkflowTrigger[] = [
  {
    id: "trigger-encounter-soap",
    event: "encounter.completed",
    documentType: "soap-note",
    autoGenerate: true,
    requiresProviderReview: true,
    priority: "high",
  },
  {
    id: "trigger-encounter-summary",
    event: "encounter.completed",
    documentType: "patient-summary",
    autoGenerate: true,
    requiresProviderReview: true,
    priority: "medium",
  },
  {
    id: "trigger-referral-letter",
    event: "referral.created",
    documentType: "referral-letter",
    autoGenerate: true,
    requiresProviderReview: true,
    priority: "high",
  },
  {
    id: "trigger-discharge-summary",
    event: "discharge.initiated",
    documentType: "discharge-summary",
    autoGenerate: true,
    requiresProviderReview: true,
    priority: "high",
  },
  {
    id: "trigger-lab-explanation",
    event: "lab.results_available",
    documentType: "lab-report-explanation",
    autoGenerate: true,
    requiresProviderReview: false,
    priority: "medium",
  },
  {
    id: "trigger-med-change-summary",
    event: "medication.changed",
    documentType: "patient-summary",
    autoGenerate: false,
    requiresProviderReview: true,
    priority: "low",
  },
];

let triggers: WorkflowTrigger[] = [...DEFAULT_TRIGGERS];
const executionHistory: WorkflowExecution[] = [];
const eventListeners: Map<TriggerEvent, Array<(data: any) => void>> = new Map();

export function registerTrigger(trigger: WorkflowTrigger): void {
  const existing = triggers.findIndex(t => t.id === trigger.id);
  if (existing >= 0) {
    triggers[existing] = trigger;
  } else {
    triggers.push(trigger);
  }
  console.log(`[WorkflowTrigger] Registered trigger: ${trigger.id} for event: ${trigger.event}`);
}

export function removeTrigger(triggerId: string): boolean {
  const index = triggers.findIndex(t => t.id === triggerId);
  if (index >= 0) {
    triggers.splice(index, 1);
    return true;
  }
  return false;
}

export function getTriggers(): WorkflowTrigger[] {
  return [...triggers];
}

export function getExecutionHistory(patientId?: string): WorkflowExecution[] {
  if (patientId) {
    return executionHistory.filter(e => e.patientId === patientId);
  }
  return [...executionHistory];
}

export function getExecution(executionId: string): WorkflowExecution | undefined {
  return executionHistory.find(e => e.id === executionId);
}

export function onEvent(event: TriggerEvent, listener: (data: any) => void): void {
  const listeners = eventListeners.get(event) || [];
  listeners.push(listener);
  eventListeners.set(event, listeners);
}

export async function emitEvent(
  event: TriggerEvent,
  data: {
    patientId: string;
    encounterId?: string;
    providerId?: string;
    contextData?: Record<string, string>;
  }
): Promise<WorkflowExecution[]> {
  console.log(`[WorkflowTrigger] Event emitted: ${event} for patient: ${data.patientId}`);

  const matchingTriggers = triggers.filter(t => t.event === event);
  if (matchingTriggers.length === 0) {
    console.log(`[WorkflowTrigger] No triggers matched event: ${event}`);
    return [];
  }

  const listeners = eventListeners.get(event) || [];
  for (const listener of listeners) {
    try { listener(data); } catch (e) { console.error("[WorkflowTrigger] Listener error:", e); }
  }

  const executions: WorkflowExecution[] = [];

  for (const trigger of matchingTriggers) {
    if (!trigger.autoGenerate) {
      console.log(`[WorkflowTrigger] Trigger ${trigger.id} is not auto-generate, skipping`);
      continue;
    }

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      triggerId: trigger.id,
      event,
      patientId: data.patientId,
      status: "pending",
      documentType: trigger.documentType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    executionHistory.push(execution);

    try {
      execution.status = "generating";
      execution.updatedAt = new Date().toISOString();

      const fields = buildFieldsFromContext(trigger.documentType, data);

      const result = await generateDocument({
        documentTypeId: trigger.documentType,
        // eslint-disable-next-line tabulaAuth/no-fallback-identity -- legitimate system actor: event-driven trigger auto-generates documents; providerId is optional because events may fire from automated/system sources with no provider
        userId: data.providerId || "system",
        patientId: data.patientId,
        patientName: data.contextData?.patientName,
        context: fields,
      });

      execution.generatedContent = result.content;
      execution.generatedDocumentId = result.id;

      logWorkflowAudit({
        action: "document_generated",
        patientId: data.patientId,
        triggerId: trigger.id,
        executionId: execution.id,
        documentType: trigger.documentType,
        outcome: "success",
        metadata: { documentId: result.id, providerId: data.providerId },
      });

      if (trigger.documentType === "soap-note" && data.contextData?.chiefComplaint) {
        try {
          const soapSections = parseSoapSections(result.content);
          const codeResult = await suggestCodesFromNote(
            soapSections,
            data.contextData.chiefComplaint,
            data.contextData.conditions?.split(",")
          );
          execution.icdSuggestions = codeResult.icd;
          execution.cptSuggestions = codeResult.cpt;

          logWorkflowAudit({
            action: "code_suggestions_generated",
            patientId: data.patientId,
            triggerId: trigger.id,
            executionId: execution.id,
            documentType: trigger.documentType,
            outcome: "success",
            metadata: { icdCount: codeResult.icd.length, cptCount: codeResult.cpt.length },
          });
        } catch (codeError) {
          console.error("[WorkflowTrigger] Code suggestion failed:", codeError);
        }
      }

      execution.status = trigger.requiresProviderReview ? "awaiting_review" : "approved";
      execution.updatedAt = new Date().toISOString();

      console.log(`[WorkflowTrigger] Document generated: ${trigger.documentType} → status: ${execution.status}`);
    } catch (error: any) {
      execution.status = "failed";
      execution.error = error.message || "Document generation failed";
      execution.updatedAt = new Date().toISOString();
      console.error(`[WorkflowTrigger] Execution failed for ${trigger.id}:`, error.message);

      logWorkflowAudit({
        action: "document_generation_failed",
        patientId: data.patientId,
        triggerId: trigger.id,
        executionId: execution.id,
        documentType: trigger.documentType,
        outcome: "failure",
        metadata: { error: error.message },
      });
    }

    executions.push(execution);
  }

  return executions;
}

export function reviewExecution(
  executionId: string,
  decision: "approved" | "rejected",
  reviewedBy: string,
  reviewNotes?: string
): WorkflowExecution | null {
  const execution = executionHistory.find(e => e.id === executionId);
  if (!execution || execution.status !== "awaiting_review") {
    return null;
  }

  execution.status = decision;
  execution.reviewedBy = reviewedBy;
  execution.reviewNotes = reviewNotes;
  execution.updatedAt = new Date().toISOString();

  logWorkflowAudit({
    action: `document_${decision}`,
    patientId: execution.patientId,
    triggerId: execution.triggerId,
    executionId: executionId,
    documentType: execution.documentType,
    outcome: decision,
    metadata: { reviewedBy, reviewNotes },
  });

  console.log(`[WorkflowTrigger] Execution ${executionId} ${decision} by ${reviewedBy}`);
  return execution;
}

function buildFieldsFromContext(
  documentType: string,
  data: { patientId: string; contextData?: Record<string, string> }
): Record<string, string> {
  const fields: Record<string, string> = {
    patientName: data.contextData?.patientName || `Patient ${data.patientId}`,
    ...(data.contextData || {}),
  };

  switch (documentType) {
    case "patient-summary":
      fields.summaryPeriod = fields.summaryPeriod || "Last 6 months";
      break;
    case "referral-letter":
      fields.referringProvider = fields.referringProvider || "Provider";
      fields.referredToProvider = fields.referredToProvider || "Specialist";
      fields.reasonForReferral = fields.reasonForReferral || "Further evaluation";
      break;
    case "discharge-summary":
      fields.admissionDate = fields.admissionDate || new Date().toISOString().split("T")[0];
      fields.dischargeDate = fields.dischargeDate || new Date().toISOString().split("T")[0];
      fields.primaryDiagnosis = fields.primaryDiagnosis || "See clinical notes";
      break;
    case "lab-report-explanation":
      fields.labResults = fields.labResults || "See attached results";
      break;
  }

  return fields;
}

function parseSoapSections(content: string): {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
} {
  const sections: Record<string, string> = {};

  const sectionPatterns = [
    { key: "subjective", pattern: /(?:^|\n)(?:S(?:UBJECTIVE)?[:\s]*)([\s\S]*?)(?=\n(?:O(?:BJECTIVE)?[:\s])|$)/i },
    { key: "objective", pattern: /(?:^|\n)(?:O(?:BJECTIVE)?[:\s]*)([\s\S]*?)(?=\n(?:A(?:SSESSMENT)?[:\s])|$)/i },
    { key: "assessment", pattern: /(?:^|\n)(?:A(?:SSESSMENT)?[:\s]*)([\s\S]*?)(?=\n(?:P(?:LAN)?[:\s])|$)/i },
    { key: "plan", pattern: /(?:^|\n)(?:P(?:LAN)?[:\s]*)([\s\S]*?)$/i },
  ];

  for (const { key, pattern } of sectionPatterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      sections[key] = match[1].trim();
    }
  }

  return sections;
}
