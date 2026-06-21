export type FhirEventType = 
  | "patient.created"
  | "patient.updated"
  | "patient.deleted"
  | "observation.created"
  | "observation.updated"
  | "condition.created"
  | "condition.updated"
  | "medication.created"
  | "medication.updated"
  | "encounter.created"
  | "encounter.updated"
  | "encounter.completed"
  | "diagnostic.created"
  | "diagnostic.updated"
  | "immunization.created"
  | "procedure.created"
  | "procedure.updated"
  | "allergy.created"
  | "allergy.updated"
  | "carePlan.created"
  | "carePlan.updated"
  | "document.uploaded"
  | "document.processed"
  | "reconciliation.started"
  | "reconciliation.completed"
  | "reconciliation.conflict"
  | "quality.issue"
  | "quality.improved"
  | "sync.started"
  | "sync.completed"
  | "sync.failed"
  | "connection.established"
  | "connection.lost";

export type FhirEventSeverity = "info" | "warning" | "error" | "success";

export type FhirEventSource = 
  | "fastenhealth"
  | "cms-bluebutton"
  | "internal"
  | "upload"
  | "reconciliation";

export interface FhirEvent {
  id: string;
  type: FhirEventType;
  severity: FhirEventSeverity;
  source: FhirEventSource;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface FhirStreamMessage {
  type: "event" | "heartbeat" | "subscribe" | "unsubscribe" | "subscribed" | "error";
  payload?: FhirEvent | FhirEvent[] | { channels: string[] } | { message: string };
  timestamp: string;
}

export interface FhirSubscription {
  channels: FhirEventType[];
  sources?: FhirEventSource[];
  patientIds?: string[];
}

export const FHIR_EVENT_LABELS: Record<FhirEventType, string> = {
  "patient.created": "New Patient Record",
  "patient.updated": "Patient Record Updated",
  "patient.deleted": "Patient Record Removed",
  "observation.created": "New Observation",
  "observation.updated": "Observation Updated",
  "condition.created": "New Condition Recorded",
  "condition.updated": "Condition Updated",
  "medication.created": "New Medication Added",
  "medication.updated": "Medication Updated",
  "encounter.created": "New Encounter",
  "encounter.updated": "Encounter Updated",
  "encounter.completed": "Encounter Completed",
  "diagnostic.created": "New Diagnostic Report",
  "diagnostic.updated": "Diagnostic Report Updated",
  "immunization.created": "New Immunization Record",
  "procedure.created": "New Procedure Recorded",
  "procedure.updated": "Procedure Updated",
  "allergy.created": "New Allergy Recorded",
  "allergy.updated": "Allergy Information Updated",
  "carePlan.created": "New Care Plan Created",
  "carePlan.updated": "Care Plan Updated",
  "document.uploaded": "Document Uploaded",
  "document.processed": "Document Processed",
  "reconciliation.started": "Data Reconciliation Started",
  "reconciliation.completed": "Data Reconciliation Completed",
  "reconciliation.conflict": "Reconciliation Conflict Detected",
  "quality.issue": "Data Quality Issue",
  "quality.improved": "Data Quality Improved",
  "sync.started": "EHR Sync Started",
  "sync.completed": "EHR Sync Completed",
  "sync.failed": "EHR Sync Failed",
  "connection.established": "Connection Established",
  "connection.lost": "Connection Lost",
};

export const FHIR_SOURCE_LABELS: Record<FhirEventSource, string> = {
  "fastenhealth": "Fasten Health",
  "cms-bluebutton": "CMS Blue Button 2.0",
  "internal": "Tabula Medica",
  "upload": "Document Upload",
  "reconciliation": "Reconciliation Engine",
};
