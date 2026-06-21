import OpenAI from "openai";
import { storage } from "../storage";
import { createHash } from "crypto";
import * as fhirValidation from "./fhir-validation-service";
import * as dataReconciliation from "./data-reconciliation-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return "H" + createHash("sha256").update(id).digest("hex").substring(0, 8);
}

function logLearningAudit(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "AIFHIRQualityEngine",
    subComponent: "LearningSystem",
    action,
    details: {
      ...details,
      patientId: details.patientId ? hashIdentifier(String(details.patientId)) : undefined,
      userId: details.userId ? hashIdentifier(String(details.userId)) : undefined,
    },
  }));
}

const CDS_PROHIBITED_PATTERNS = [
  /\b(prescribe|prescription|medication|drug|dosage|dose|mg|ml)\b/i,
  /\b(diagnose|diagnosis|prognosis|treatment plan|therapy|intervention)\b/i,
  /\b(recommend|suggest|advise) (taking|starting|stopping|changing|adjusting)\b/i,
  /\b(clinical trial|clinical study|clinical outcome|clinical indication)\b/i,
  /\b(symptom|symptoms|side effect|adverse event|contraindication)\b/i,
  /\b(bloodwork|lab results|test results|imaging|mri|ct scan|x-ray)\b/i,
  /\b(increase|decrease|adjust|modify) (medication|treatment|therapy|dosage)\b/i,
  /\b(consult|refer to) (specialist|physician|doctor|oncologist|cardiologist)\b/i,
];

function enforceCdsCompliance(text: string): { compliant: boolean; sanitized: string } {
  let sanitized = text;
  let hadViolation = false;

  CDS_PROHIBITED_PATTERNS.forEach((pattern) => {
    if (pattern.test(text)) {
      hadViolation = true;
      sanitized = sanitized.replace(new RegExp(pattern.source, "gi"), "[data quality]");
    }
  });

  if (hadViolation) {
    console.log(JSON.stringify({
      type: "CDS_GUARDRAIL_VIOLATION",
      timestamp: new Date().toISOString(),
      component: "AIFHIRQualityEngine",
      action: "LEARNING_CONTENT_SANITIZED",
    }));
  }

  return { compliant: !hadViolation, sanitized };
}

function sanitizeStringArray(arr: string[]): string[] {
  return arr.map(s => enforceCdsCompliance(s).sanitized);
}

export type QualityIssueSeverity = "critical" | "high" | "medium" | "low";
export type QualityIssueStatus = "detected" | "pending_review" | "correction_suggested" | "auto_corrected" | "manually_corrected" | "dismissed" | "escalated";

export type QualityIssueType = 
  | "missing_required_field"
  | "invalid_code_system"
  | "inconsistent_data"
  | "orphaned_reference"
  | "stale_data"
  | "duplicate_record"
  | "format_violation"
  | "business_rule_violation"
  | "terminology_mismatch"
  | "temporal_inconsistency";

export interface FHIRQualityIssue {
  id: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  issueType: QualityIssueType;
  severity: QualityIssueSeverity;
  title: string;
  description: string;
  fieldPath?: string;
  currentValue?: unknown;
  expectedValue?: unknown;
  suggestedCorrection?: CorrectionSuggestion;
  aiAnalysis?: string;
  relatedIssues: string[];
  status: QualityIssueStatus;
  detectedAt: string;
  detectedBy: "rule_engine" | "ai_analysis" | "reconciliation" | "manual";
  reviewedAt?: string;
  reviewedBy?: string;
  correctedAt?: string;
  correctedBy?: string;
  correctionNotes?: string;
  metadata: Record<string, unknown>;
}

export interface CorrectionSuggestion {
  id: string;
  issueId: string;
  type: "auto_apply" | "manual_review" | "escalate";
  confidence: number;
  suggestedValue: unknown;
  reasoning: string;
  validationRules: string[];
  sideEffects: string[];
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;
  applied: boolean;
  appliedAt?: string;
}

export interface QualityProfile {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  issueTypesMonitored: QualityIssueType[];
  severityThreshold: QualityIssueSeverity;
  autoCorrectEnabled: boolean;
  autoCorrectThreshold: number;
  escalationRules: EscalationRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EscalationRule {
  condition: string;
  escalateTo: string;
  priority: "urgent" | "high" | "normal";
  notifyChannels: ("email" | "in_app" | "webhook")[];
}

export interface QualityScan {
  id: string;
  profileId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "cancelled";
  resourcesScanned: number;
  issuesFound: number;
  issuesBySeverity: Record<QualityIssueSeverity, number>;
  issuesByType: Record<string, number>;
  autoCorrectionsApplied: number;
  escalationsCreated: number;
  errorMessage?: string;
  triggeredBy: string;
}

export interface QualityMetrics {
  totalIssues: number;
  openIssues: number;
  correctedIssues: number;
  dismissedIssues: number;
  avgResolutionTimeHours: number;
  issuesByResourceType: Record<string, number>;
  issuesBySeverity: Record<QualityIssueSeverity, number>;
  issuesByType: Record<QualityIssueType, number>;
  trendData: Array<{ date: string; detected: number; resolved: number }>;
  complianceScore: number;
}

export type CorrectionOutcome = "accepted" | "modified" | "rejected" | "dismissed";

export interface CorrectionFeedback {
  id: string;
  issueId: string;
  correctionId?: string;
  originalSuggestion?: unknown;
  appliedCorrection: unknown;
  outcome: CorrectionOutcome;
  userModification?: string;
  resourceType: string;
  issueType: QualityIssueType;
  fieldPath?: string;
  patternSignature: string;
  confidenceAtDetection: number;
  feedbackTimestamp: string;
  userId: string;
}

export interface LearningPattern {
  id: string;
  patternSignature: string;
  patternType: "issue_detection" | "correction_preference" | "dismissal_pattern" | "modification_pattern";
  resourceType: string;
  issueType: QualityIssueType;
  fieldPath?: string;
  description: string;
  occurrences: number;
  acceptanceRate: number;
  averageConfidence: number;
  lastSeenAt: string;
  firstSeenAt: string;
  examples: Array<{ issueId: string; outcome: CorrectionOutcome; timestamp: string }>;
  aiInsight?: string;
  confidenceAdjustment: number;
  isActive: boolean;
}

export interface LearningInsights {
  totalFeedback: number;
  acceptanceRate: number;
  rejectionRate: number;
  modificationRate: number;
  topPatterns: LearningPattern[];
  confidenceCalibration: { original: number; calibrated: number; improvement: number };
  learningCurve: Array<{ date: string; accuracy: number; feedbackCount: number }>;
  recommendations: string[];
}

const issueStore = new Map<string, FHIRQualityIssue>();
const correctionStore = new Map<string, CorrectionSuggestion>();
const profileStore = new Map<string, QualityProfile>();
const scanStore = new Map<string, QualityScan>();
const feedbackStore = new Map<string, CorrectionFeedback>();
const patternStore = new Map<string, LearningPattern>();
const confidenceCalibrationCache = new Map<string, number>();

const SEVERITY_ORDER: Record<QualityIssueSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const FHIR_REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: ["identifier", "name", "gender", "birthDate"],
  Observation: ["status", "code", "subject"],
  Condition: ["clinicalStatus", "code", "subject"],
  MedicationRequest: ["status", "intent", "medication[x]", "subject"],
  AllergyIntolerance: ["clinicalStatus", "code", "patient"],
  Procedure: ["status", "code", "subject"],
  DiagnosticReport: ["status", "code", "subject"],
  Immunization: ["status", "vaccineCode", "patient", "occurrence[x]"],
  Encounter: ["status", "class", "subject"],
  CarePlan: ["status", "intent", "subject"],
};

const CODE_SYSTEMS: Record<string, string[]> = {
  Observation: ["http://loinc.org"],
  Condition: ["http://snomed.info/sct", "http://hl7.org/fhir/sid/icd-10"],
  Procedure: ["http://snomed.info/sct", "http://www.ama-assn.org/go/cpt"],
  MedicationRequest: ["http://www.nlm.nih.gov/research/umls/rxnorm"],
  AllergyIntolerance: ["http://snomed.info/sct", "http://www.nlm.nih.gov/research/umls/rxnorm"],
};

initializeDefaultProfiles();

function initializeDefaultProfiles(): void {
  const defaultProfile: QualityProfile = {
    id: "default-comprehensive",
    name: "Comprehensive FHIR Quality Profile",
    description: "Monitors all resource types for common quality issues",
    resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Procedure"],
    issueTypesMonitored: [
      "missing_required_field",
      "invalid_code_system",
      "inconsistent_data",
      "orphaned_reference",
      "stale_data",
      "duplicate_record",
      "format_violation",
      "terminology_mismatch",
      "temporal_inconsistency",
      "business_rule_violation",
    ],
    severityThreshold: "low",
    autoCorrectEnabled: true,
    autoCorrectThreshold: 0.95,
    escalationRules: [
      {
        condition: "severity == 'critical' && issueType == 'missing_required_field'",
        escalateTo: "data_steward",
        priority: "urgent",
        notifyChannels: ["in_app", "email"],
      },
      {
        condition: "issueCount > 10 && resourceType == 'Patient'",
        escalateTo: "admin",
        priority: "high",
        notifyChannels: ["in_app"],
      },
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profileStore.set(defaultProfile.id, defaultProfile);
}

function analyzeResourceForMissingFields(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];
  const requiredFields = FHIR_REQUIRED_FIELDS[resourceType] || [];

  for (const field of requiredFields) {
    const fieldName = field.replace("[x]", "");
    const hasField = Object.keys(resource).some((key) => key.startsWith(fieldName));

    if (!hasField || resource[fieldName] === null || resource[fieldName] === undefined) {
      const isChoice = field.includes("[x]");
      if (isChoice) {
        const choiceFields = Object.keys(resource).filter((k) => k.startsWith(fieldName));
        if (choiceFields.length === 0) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "missing_required_field",
            severity: determineSeverity("missing_required_field", fieldName),
            title: `Missing required field: ${field}`,
            description: `${resourceType} is missing required choice field ${field}`,
            fieldPath: `${resourceType}.${fieldName}`,
            detectedBy: "rule_engine",
          }));
        }
      } else {
        issues.push(createIssue({
          resourceType,
          resourceId: resource.id as string,
          patientId: extractPatientId(resource),
          issueType: "missing_required_field",
          severity: determineSeverity("missing_required_field", fieldName),
          title: `Missing required field: ${field}`,
          description: `${resourceType} is missing required field ${field}`,
          fieldPath: `${resourceType}.${field}`,
          detectedBy: "rule_engine",
        }));
      }
    }
  }

  return issues;
}

function analyzeResourceForCodeSystems(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];
  const expectedSystems = CODE_SYSTEMS[resourceType];

  if (!expectedSystems) return issues;

  const code = resource.code as Record<string, unknown> | undefined;
  if (code && code.coding) {
    const codings = Array.isArray(code.coding) ? code.coding : [code.coding];
    const hasValidSystem = codings.some((c: Record<string, unknown>) => 
      expectedSystems.includes(c.system as string)
    );

    if (!hasValidSystem) {
      const actualSystems = codings.map((c: Record<string, unknown>) => c.system).filter(Boolean);
      issues.push(createIssue({
        resourceType,
        resourceId: resource.id as string,
        patientId: extractPatientId(resource),
        issueType: "invalid_code_system",
        severity: "medium",
        title: "Non-standard code system",
        description: `${resourceType} uses non-standard code system. Expected: ${expectedSystems.join(" or ")}`,
        fieldPath: `${resourceType}.code.coding.system`,
        currentValue: actualSystems.join(", "),
        expectedValue: expectedSystems.join(" | "),
        detectedBy: "rule_engine",
      }));
    }
  }

  return issues;
}

function analyzeResourceForTemporalInconsistencies(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];

  const now = new Date();
  const dateFields = ["effectiveDateTime", "authoredOn", "recordedDate", "onsetDateTime", "performedDateTime", "issued"];

  for (const field of dateFields) {
    const value = resource[field];
    if (value && typeof value === "string") {
      const date = new Date(value);
      
      if (date > now) {
        issues.push(createIssue({
          resourceType,
          resourceId: resource.id as string,
          patientId: extractPatientId(resource),
          issueType: "temporal_inconsistency",
          severity: "high",
          title: "Future date detected",
          description: `${resourceType}.${field} has a future date: ${value}`,
          fieldPath: `${resourceType}.${field}`,
          currentValue: value,
          expectedValue: "Date in the past or present",
          detectedBy: "rule_engine",
        }));
      }

      if (resourceType === "Patient") {
        const birthDate = resource.birthDate;
        if (birthDate && typeof birthDate === "string") {
          const birth = new Date(birthDate);
          if (date < birth) {
            issues.push(createIssue({
              resourceType,
              resourceId: resource.id as string,
              patientId: extractPatientId(resource),
              issueType: "temporal_inconsistency",
              severity: "critical",
              title: "Date before birth",
              description: `${resourceType}.${field} (${value}) is before patient birth date (${birthDate})`,
              fieldPath: `${resourceType}.${field}`,
              currentValue: value,
              expectedValue: `Date after ${birthDate}`,
              detectedBy: "rule_engine",
            }));
          }
        }
      }
    }
  }

  return issues;
}

function analyzeResourceForStaleData(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];

  const meta = resource.meta as Record<string, unknown> | undefined;
  if (meta && meta.lastUpdated) {
    const lastUpdated = new Date(meta.lastUpdated as string);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    const staleThresholds: Record<string, number> = {
      MedicationRequest: 90,
      Observation: 180,
      CarePlan: 90,
      Condition: 365,
    };

    const threshold = staleThresholds[resourceType];
    if (threshold && daysSinceUpdate > threshold) {
      issues.push(createIssue({
        resourceType,
        resourceId: resource.id as string,
        patientId: extractPatientId(resource),
        issueType: "stale_data",
        severity: daysSinceUpdate > threshold * 2 ? "high" : "medium",
        title: "Potentially stale data",
        description: `${resourceType} has not been updated in ${Math.floor(daysSinceUpdate)} days (threshold: ${threshold} days)`,
        fieldPath: `${resourceType}.meta.lastUpdated`,
        currentValue: meta.lastUpdated,
        detectedBy: "rule_engine",
        metadata: { daysSinceUpdate, threshold },
      }));
    }
  }

  return issues;
}

function extractPatientId(resource: Record<string, unknown>): string | undefined {
  if (resource.resourceType === "Patient") {
    return resource.id as string;
  }
  
  const subjectRef = resource.subject || resource.patient;
  if (subjectRef && typeof subjectRef === "object") {
    const ref = (subjectRef as Record<string, unknown>).reference;
    if (typeof ref === "string") {
      return ref.replace("Patient/", "");
    }
  }
  
  return undefined;
}

function analyzeResourceForOrphanedReferences(
  resource: Record<string, unknown>,
  resourceType: string,
  knownResourceIds: Set<string> = new Set()
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];
  const referenceFields = ["subject", "patient", "encounter", "performer", "author", "requester", "recorder", "asserter"];

  for (const field of referenceFields) {
    const ref = resource[field];
    if (ref && typeof ref === "object") {
      const reference = (ref as Record<string, unknown>).reference as string;
      if (reference && !reference.startsWith("#")) {
        const [refType, refId] = reference.split("/");
        if (refId && knownResourceIds.size > 0 && !knownResourceIds.has(reference)) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "orphaned_reference",
            severity: "high",
            title: `Orphaned reference: ${field}`,
            description: `Reference to ${refType}/${hashIdentifier(refId)} could not be resolved`,
            fieldPath: `${resourceType}.${field}.reference`,
            currentValue: `${refType}/${hashIdentifier(refId)}`,
            detectedBy: "rule_engine",
          }));
        }
      }
    }
  }

  return issues;
}

function analyzeResourceForFormatViolations(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];

  if (resource.birthDate && typeof resource.birthDate === "string") {
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(resource.birthDate)) {
      issues.push(createIssue({
        resourceType,
        resourceId: resource.id as string,
        patientId: extractPatientId(resource),
        issueType: "format_violation",
        severity: "medium",
        title: "Invalid date format",
        description: "birthDate does not match FHIR date format (YYYY, YYYY-MM, or YYYY-MM-DD)",
        fieldPath: `${resourceType}.birthDate`,
        currentValue: resource.birthDate,
        expectedValue: "YYYY-MM-DD format",
        detectedBy: "rule_engine",
      }));
    }
  }

  if (resource.telecom && Array.isArray(resource.telecom)) {
    for (let i = 0; i < resource.telecom.length; i++) {
      const contact = resource.telecom[i] as Record<string, unknown>;
      if (contact.system === "phone" && contact.value) {
        const phone = contact.value as string;
        if (!/^[\d\s\-\+\(\)\.]+$/.test(phone)) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "format_violation",
            severity: "low",
            title: "Invalid phone format",
            description: `Phone number contains invalid characters`,
            fieldPath: `${resourceType}.telecom[${i}].value`,
            currentValue: phone,
            detectedBy: "rule_engine",
          }));
        }
      }
      if (contact.system === "email" && contact.value) {
        const email = contact.value as string;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "format_violation",
            severity: "low",
            title: "Invalid email format",
            description: `Email address format is invalid`,
            fieldPath: `${resourceType}.telecom[${i}].value`,
            currentValue: email,
            detectedBy: "rule_engine",
          }));
        }
      }
    }
  }

  return issues;
}

function analyzeResourceForBusinessRules(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];

  if (resourceType === "MedicationRequest") {
    const status = resource.status as string;
    const dosage = resource.dosageInstruction as unknown[];
    if (status === "active" && (!dosage || dosage.length === 0)) {
      issues.push(createIssue({
        resourceType,
        resourceId: resource.id as string,
        patientId: extractPatientId(resource),
        issueType: "business_rule_violation",
        severity: "high",
        title: "Active medication without dosage",
        description: "Active MedicationRequest should have dosage instructions",
        fieldPath: `${resourceType}.dosageInstruction`,
        detectedBy: "rule_engine",
      }));
    }
  }

  if (resourceType === "Condition") {
    const clinicalStatus = resource.clinicalStatus as Record<string, unknown>;
    const abatement = resource.abatementDateTime || resource.abatementPeriod;
    if (clinicalStatus) {
      const coding = (clinicalStatus.coding as unknown[]) || [];
      const isResolved = coding.some((c: any) => c.code === "resolved" || c.code === "remission");
      if (isResolved && !abatement) {
        issues.push(createIssue({
          resourceType,
          resourceId: resource.id as string,
          patientId: extractPatientId(resource),
          issueType: "business_rule_violation",
          severity: "medium",
          title: "Resolved condition without abatement date",
          description: "Resolved/remission conditions should have an abatement date",
          fieldPath: `${resourceType}.abatementDateTime`,
          detectedBy: "rule_engine",
        }));
      }
    }
  }

  if (resourceType === "Observation") {
    const status = resource.status as string;
    const value = resource.valueQuantity || resource.valueCodeableConcept || resource.valueString;
    if (status === "final" && !value && !resource.dataAbsentReason) {
      issues.push(createIssue({
        resourceType,
        resourceId: resource.id as string,
        patientId: extractPatientId(resource),
        issueType: "business_rule_violation",
        severity: "high",
        title: "Final observation without value",
        description: "Final observations must have a value or dataAbsentReason",
        fieldPath: `${resourceType}.value[x]`,
        detectedBy: "rule_engine",
      }));
    }
  }

  return issues;
}

function analyzeResourceForTerminologyMismatches(
  resource: Record<string, unknown>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];

  const codeableConceptFields = ["code", "medicationCodeableConcept", "vaccineCode", "type", "category"];
  
  for (const field of codeableConceptFields) {
    const concept = resource[field] as Record<string, unknown> | undefined;
    if (concept && concept.coding && Array.isArray(concept.coding)) {
      const codings = concept.coding as Array<Record<string, unknown>>;
      
      for (let i = 0; i < codings.length; i++) {
        const coding = codings[i];
        if (coding.code && !coding.display) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "terminology_mismatch",
            severity: "low",
            title: "Missing display value for code",
            description: `Code ${coding.code} in ${field} is missing a display value`,
            fieldPath: `${resourceType}.${field}.coding[${i}].display`,
            currentValue: coding.code,
            detectedBy: "rule_engine",
          }));
        }

        if (coding.system && coding.code) {
          const system = coding.system as string;
          const code = coding.code as string;
          
          if (system === "http://loinc.org" && !/^\d{4,5}-\d$/.test(code)) {
            issues.push(createIssue({
              resourceType,
              resourceId: resource.id as string,
              patientId: extractPatientId(resource),
              issueType: "terminology_mismatch",
              severity: "medium",
              title: "Invalid LOINC code format",
              description: `LOINC code ${code} does not match expected format (NNNNN-N)`,
              fieldPath: `${resourceType}.${field}.coding[${i}].code`,
              currentValue: code,
              expectedValue: "NNNNN-N format",
              detectedBy: "rule_engine",
            }));
          }
        }
      }
    }
  }

  return issues;
}

function analyzeResourcesForDuplicates(
  resources: Array<Record<string, unknown>>,
  resourceType: string
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];
  const seen = new Map<string, Record<string, unknown>>();

  for (const resource of resources) {
    if (resource.resourceType !== resourceType) continue;
    
    const identifiers = resource.identifier as Array<Record<string, unknown>> | undefined;
    if (identifiers) {
      for (const id of identifiers) {
        const key = `${id.system}|${id.value}`;
        const existing = seen.get(key);
        if (existing && existing.id !== resource.id) {
          issues.push(createIssue({
            resourceType,
            resourceId: resource.id as string,
            patientId: extractPatientId(resource),
            issueType: "duplicate_record",
            severity: "high",
            title: "Duplicate identifier detected",
            description: `Same identifier ${hashIdentifier(key)} found in multiple ${resourceType} resources`,
            fieldPath: `${resourceType}.identifier`,
            detectedBy: "rule_engine",
            relatedIssues: [hashIdentifier(existing.id as string)],
            metadata: { duplicateOf: hashIdentifier(existing.id as string) },
          }));
        } else {
          seen.set(key, resource);
        }
      }
    }
  }

  return issues;
}

function analyzeResourcesForInconsistencies(
  resources: Array<Record<string, unknown>>
): FHIRQualityIssue[] {
  const issues: FHIRQualityIssue[] = [];
  
  const patientResources = new Map<string, Array<Record<string, unknown>>>();
  for (const resource of resources) {
    const patientId = extractPatientId(resource);
    if (patientId) {
      const existing = patientResources.get(patientId) || [];
      existing.push(resource);
      patientResources.set(patientId, existing);
    }
  }

  for (const [patientId, patientData] of Array.from(patientResources.entries())) {
    const conditions = patientData.filter((r) => r.resourceType === "Condition");
    const medications = patientData.filter((r) => r.resourceType === "MedicationRequest");

    for (const condition of conditions) {
      const clinicalStatus = condition.clinicalStatus as Record<string, unknown> | undefined;
      if (clinicalStatus) {
        const coding = (clinicalStatus.coding as Array<Record<string, unknown>>) || [];
        const isResolved = coding.some((c) => c.code === "resolved" || c.code === "inactive");
        
        if (isResolved) {
          const conditionCode = (condition.code as Record<string, unknown>)?.coding as Array<Record<string, unknown>>;
          if (conditionCode) {
            for (const med of medications) {
              const status = med.status as string;
              if (status === "active") {
                const reasonRef = med.reasonReference as Array<Record<string, unknown>> | undefined;
                if (reasonRef?.some((r) => (r.reference as string)?.includes(condition.id as string))) {
                  issues.push(createIssue({
                    resourceType: "MedicationRequest",
                    resourceId: med.id as string,
                    patientId,
                    issueType: "inconsistent_data",
                    severity: "high",
                    title: "Active medication for resolved condition",
                    description: `Active MedicationRequest references a resolved/inactive Condition`,
                    fieldPath: `MedicationRequest.reasonReference`,
                    detectedBy: "rule_engine",
                    relatedIssues: [hashIdentifier(condition.id as string)],
                    metadata: { 
                      conditionIdHash: hashIdentifier(condition.id as string),
                      conditionStatus: "resolved",
                    },
                  }));
                }
              }
            }
          }
        }
      }
    }

    const allergies = patientData.filter((r) => r.resourceType === "AllergyIntolerance");
    for (const allergy of allergies) {
      const allergyCode = (allergy.code as Record<string, unknown>)?.coding as Array<Record<string, unknown>>;
      const allergyCodes = allergyCode?.map((c) => c.code) || [];
      
      for (const med of medications) {
        const medCode = (med.medicationCodeableConcept as Record<string, unknown>)?.coding as Array<Record<string, unknown>>;
        const medCodes = medCode?.map((c) => c.code) || [];
        
        const overlap = allergyCodes.filter((a) => medCodes.includes(a));
        if (overlap.length > 0) {
          issues.push(createIssue({
            resourceType: "MedicationRequest",
            resourceId: med.id as string,
            patientId,
            issueType: "inconsistent_data",
            severity: "critical",
            title: "Medication matches known allergy",
            description: `Active MedicationRequest code matches patient's documented allergy`,
            fieldPath: `MedicationRequest.medicationCodeableConcept`,
            detectedBy: "rule_engine",
            relatedIssues: [hashIdentifier(allergy.id as string)],
            metadata: { 
              allergyIdHash: hashIdentifier(allergy.id as string),
              matchingCodes: overlap.map((c) => hashIdentifier(String(c))),
            },
          }));
        }
      }
    }
  }

  return issues;
}

async function importValidationFailuresAsIssues(): Promise<FHIRQualityIssue[]> {
  const issues: FHIRQualityIssue[] = [];
  
  try {
    const failures = fhirValidation.getValidationFailures({ status: "open" });
    
    for (const failure of failures) {
      const existingIssue = Array.from(issueStore.values()).find(
        (i) => i.metadata.validationFailureId === failure.id
      );
      if (existingIssue) continue;

      const issueType: QualityIssueType = 
        failure.ruleId.includes("required") ? "missing_required_field" :
        failure.ruleId.includes("code") ? "invalid_code_system" :
        failure.ruleId.includes("format") ? "format_violation" : "business_rule_violation";

      const issue = createIssue({
        resourceType: failure.resourceType,
        resourceId: failure.resourceId,
        patientId: failure.patientId,
        issueType,
        severity: failure.severity as QualityIssueSeverity,
        title: failure.ruleName,
        description: failure.errorMessage,
        fieldPath: failure.fieldPath,
        currentValue: failure.actualValue,
        expectedValue: failure.expectedValue,
        detectedBy: "rule_engine",
        metadata: {
          validationFailureId: failure.id,
          ruleId: failure.ruleId,
          suggestion: failure.suggestion,
        },
      });

      issueStore.set(issue.id, issue);
      issues.push(issue);
    }
  } catch (error) {
    console.error("[AIFHIRQuality] Error importing validation failures:", error);
  }

  return issues;
}

async function checkReconciliationForIssues(): Promise<FHIRQualityIssue[]> {
  const issues: FHIRQualityIssue[] = [];

  try {
    const matchResults = dataReconciliation.getMatchResults("pending");
    
    for (const match of matchResults) {
      const existingIssue = Array.from(issueStore.values()).find(
        (i) => i.metadata.reconciliationMatchId === match.id
      );
      if (existingIssue) continue;

      const generatedIssues = await integrateWithReconciliation(match);
      issues.push(...generatedIssues);
    }
  } catch (error) {
    console.error("[AIFHIRQuality] Error checking reconciliation:", error);
  }

  return issues;
}

function determineSeverity(issueType: QualityIssueType, fieldName?: string): QualityIssueSeverity {
  const criticalFields = ["identifier", "status", "subject", "patient", "code"];
  
  if (issueType === "missing_required_field" && fieldName && criticalFields.includes(fieldName)) {
    return "critical";
  }

  const severityMap: Record<QualityIssueType, QualityIssueSeverity> = {
    missing_required_field: "high",
    invalid_code_system: "medium",
    inconsistent_data: "high",
    orphaned_reference: "high",
    stale_data: "low",
    duplicate_record: "medium",
    format_violation: "medium",
    business_rule_violation: "high",
    terminology_mismatch: "medium",
    temporal_inconsistency: "high",
  };

  return severityMap[issueType] || "medium";
}

function createIssue(params: Partial<FHIRQualityIssue> & {
  resourceType: string;
  resourceId: string;
  issueType: QualityIssueType;
  severity: QualityIssueSeverity;
  title: string;
  description: string;
  detectedBy: FHIRQualityIssue["detectedBy"];
}): FHIRQualityIssue {
  return {
    id: `fhir-quality-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "detected",
    relatedIssues: [],
    detectedAt: new Date().toISOString(),
    metadata: {},
    ...params,
    resourceId: hashIdentifier(params.resourceId),
    patientId: params.patientId ? hashIdentifier(params.patientId) : undefined,
  };
}

async function generateAISuggestion(issue: FHIRQualityIssue): Promise<CorrectionSuggestion | null> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return generateRuleBasedSuggestion(issue);
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content: `You are a FHIR data quality expert. Analyze the data quality issue and suggest a correction.
Return JSON only with these fields:
- suggestedValue: The corrected value (null if cannot determine)
- confidence: Number 0-1 indicating confidence in the suggestion
- reasoning: Brief explanation of the suggestion
- requiresApproval: Boolean indicating if human review is needed
- sideEffects: Array of potential side effects of applying this correction

IMPORTANT: Do NOT provide clinical advice. Focus only on data quality and FHIR standards compliance.
If the issue involves clinical interpretation, set requiresApproval to true and suggest review by a clinician.`,
        },
        {
          role: "user",
          content: `Analyze this FHIR data quality issue and suggest a correction:

Resource Type: ${issue.resourceType}
Issue Type: ${issue.issueType}
Title: ${issue.title}
Description: ${issue.description}
Field Path: ${issue.fieldPath || "N/A"}
Current Value: ${JSON.stringify(issue.currentValue)}
Expected Value: ${JSON.stringify(issue.expectedValue)}

Provide a JSON response with your correction suggestion.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return generateRuleBasedSuggestion(issue);

    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
      
      return {
        id: `correction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        issueId: issue.id,
        type: parsed.confidence >= 0.95 ? "auto_apply" : parsed.confidence >= 0.7 ? "manual_review" : "escalate",
        confidence: parsed.confidence || 0.5,
        suggestedValue: parsed.suggestedValue,
        reasoning: parsed.reasoning || "AI-generated suggestion",
        validationRules: [],
        sideEffects: parsed.sideEffects || [],
        requiresApproval: parsed.requiresApproval ?? true,
        applied: false,
      };
    } catch {
      return generateRuleBasedSuggestion(issue);
    }
  } catch (error) {
    console.error("[AIFHIRQuality] AI suggestion generation failed:", error);
    return generateRuleBasedSuggestion(issue);
  }
}

function generateRuleBasedSuggestion(issue: FHIRQualityIssue): CorrectionSuggestion | null {
  let suggestion: Partial<CorrectionSuggestion> = {
    id: `correction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    issueId: issue.id,
    type: "manual_review",
    confidence: 0.6,
    validationRules: [],
    sideEffects: [],
    requiresApproval: true,
    applied: false,
  };

  switch (issue.issueType) {
    case "invalid_code_system":
      const expectedSystems = CODE_SYSTEMS[issue.resourceType];
      if (expectedSystems && expectedSystems.length > 0) {
        suggestion = {
          ...suggestion,
          suggestedValue: { system: expectedSystems[0], code: "NEEDS_MAPPING", display: "Requires terminology mapping" },
          reasoning: `Map local code to standard ${expectedSystems[0]} terminology`,
          type: "manual_review",
          confidence: 0.7,
        };
      }
      break;

    case "missing_required_field":
      suggestion = {
        ...suggestion,
        suggestedValue: null,
        reasoning: `Required field ${issue.fieldPath} must be populated. Review source data or contact data provider.`,
        type: "escalate",
        confidence: 0.3,
      };
      break;

    case "temporal_inconsistency":
      if (issue.title.includes("Future date")) {
        suggestion = {
          ...suggestion,
          suggestedValue: new Date().toISOString(),
          reasoning: "Replace future date with current timestamp or correct source data",
          type: "manual_review",
          confidence: 0.5,
        };
      }
      break;

    case "stale_data":
      suggestion = {
        ...suggestion,
        suggestedValue: null,
        reasoning: "Review and refresh data from source system, or mark as historically accurate",
        type: "manual_review",
        confidence: 0.8,
      };
      break;

    default:
      suggestion = {
        ...suggestion,
        reasoning: "Manual review required to determine appropriate correction",
        type: "manual_review",
      };
  }

  return suggestion as CorrectionSuggestion;
}

export async function analyzeResource(
  resource: Record<string, unknown>,
  generateSuggestions: boolean = true,
  knownResourceIds: Set<string> = new Set()
): Promise<FHIRQualityIssue[]> {
  const resourceType = resource.resourceType as string;
  if (!resourceType) return [];

  const issues: FHIRQualityIssue[] = [
    ...analyzeResourceForMissingFields(resource, resourceType),
    ...analyzeResourceForCodeSystems(resource, resourceType),
    ...analyzeResourceForTemporalInconsistencies(resource, resourceType),
    ...analyzeResourceForStaleData(resource, resourceType),
    ...analyzeResourceForOrphanedReferences(resource, resourceType, knownResourceIds),
    ...analyzeResourceForFormatViolations(resource, resourceType),
    ...analyzeResourceForBusinessRules(resource, resourceType),
    ...analyzeResourceForTerminologyMismatches(resource, resourceType),
  ];

  for (const issue of issues) {
    issueStore.set(issue.id, issue);

    if (generateSuggestions && issue.severity !== "low") {
      const suggestion = await generateAISuggestion(issue);
      if (suggestion) {
        correctionStore.set(suggestion.id, suggestion);
        issue.suggestedCorrection = suggestion;
        issue.status = "correction_suggested";
      }
    }
  }

  return issues;
}


export async function runQualityScan(
  profileId: string,
  resources: Array<Record<string, unknown>>,
  triggeredBy: string,
  ipAddress: string = "internal"
): Promise<QualityScan> {
  const profile = profileStore.get(profileId) || profileStore.get("default-comprehensive")!;
  
  const scan: QualityScan = {
    id: `scan-${Date.now()}`,
    profileId: profile.id,
    startedAt: new Date().toISOString(),
    status: "running",
    resourcesScanned: 0,
    issuesFound: 0,
    issuesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    issuesByType: {},
    autoCorrectionsApplied: 0,
    escalationsCreated: 0,
    triggeredBy: hashIdentifier(triggeredBy),
  };

  scanStore.set(scan.id, scan);

  try {
    const filteredResources = resources.filter(
      (r) => profile.resourceTypes.includes(r.resourceType as string)
    );

    const knownResourceIds = new Set<string>();
    for (const resource of resources) {
      if (resource.id) {
        knownResourceIds.add(`${resource.resourceType}/${resource.id}`);
      }
    }

    for (const resource of filteredResources) {
      scan.resourcesScanned++;
      
      const issues = await analyzeResource(resource, true, knownResourceIds);
      
      for (const issue of issues) {
        if (!profile.issueTypesMonitored.includes(issue.issueType)) continue;
        if (SEVERITY_ORDER[issue.severity] < SEVERITY_ORDER[profile.severityThreshold]) continue;

        scan.issuesFound++;
        scan.issuesBySeverity[issue.severity]++;
        scan.issuesByType[issue.issueType] = (scan.issuesByType[issue.issueType] || 0) + 1;

        if (
          profile.autoCorrectEnabled &&
          issue.suggestedCorrection &&
          issue.suggestedCorrection.confidence >= profile.autoCorrectThreshold &&
          !issue.suggestedCorrection.requiresApproval
        ) {
          issue.status = "auto_corrected";
          issue.suggestedCorrection.applied = true;
          issue.suggestedCorrection.appliedAt = new Date().toISOString();
          scan.autoCorrectionsApplied++;
        }

        for (const rule of profile.escalationRules) {
          if (evaluateEscalationCondition(rule.condition, issue, scan)) {
            issue.status = "escalated";
            scan.escalationsCreated++;
            break;
          }
        }
      }
    }

    const validationIssues = await importValidationFailuresAsIssues();
    for (const issue of validationIssues) {
      if (!profile.issueTypesMonitored.includes(issue.issueType)) continue;
      scan.issuesFound++;
      scan.issuesBySeverity[issue.severity]++;
      scan.issuesByType[issue.issueType] = (scan.issuesByType[issue.issueType] || 0) + 1;
    }

    const reconciliationIssues = await checkReconciliationForIssues();
    for (const issue of reconciliationIssues) {
      if (!profile.issueTypesMonitored.includes(issue.issueType)) continue;
      scan.issuesFound++;
      scan.issuesBySeverity[issue.severity]++;
      scan.issuesByType[issue.issueType] = (scan.issuesByType[issue.issueType] || 0) + 1;
    }

    for (const resourceType of profile.resourceTypes) {
      const duplicateIssues = analyzeResourcesForDuplicates(resources, resourceType);
      for (const issue of duplicateIssues) {
        if (!profile.issueTypesMonitored.includes(issue.issueType)) continue;
        issueStore.set(issue.id, issue);
        scan.issuesFound++;
        scan.issuesBySeverity[issue.severity]++;
        scan.issuesByType[issue.issueType] = (scan.issuesByType[issue.issueType] || 0) + 1;
      }
    }

    const inconsistencyIssues = analyzeResourcesForInconsistencies(resources);
    for (const issue of inconsistencyIssues) {
      if (!profile.issueTypesMonitored.includes(issue.issueType)) continue;
      issueStore.set(issue.id, issue);
      scan.issuesFound++;
      scan.issuesBySeverity[issue.severity]++;
      scan.issuesByType[issue.issueType] = (scan.issuesByType[issue.issueType] || 0) + 1;
    }

    scan.status = "completed";
    scan.completedAt = new Date().toISOString();
  } catch (error: any) {
    scan.status = "failed";
    scan.errorMessage = error.message;
  }

  scanStore.set(scan.id, scan);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(triggeredBy),
    eventType: "admin_action",
    description: `FHIR quality scan completed: ${scan.issuesFound} issues found`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      scanId: scan.id,
      profileId: profile.id,
      resourcesScanned: String(scan.resourcesScanned),
      issuesFound: String(scan.issuesFound),
      status: scan.status,
    },
  });

  return scan;
}

function evaluateEscalationCondition(
  condition: string,
  issue: FHIRQualityIssue,
  scan: QualityScan
): boolean {
  if (condition.includes("severity == 'critical'") && issue.severity === "critical") {
    if (condition.includes("issueType == 'missing_required_field'") && issue.issueType === "missing_required_field") {
      return true;
    }
  }

  if (condition.includes("issueCount > 10")) {
    const resourceTypeMatch = condition.match(/resourceType == '(\w+)'/);
    if (resourceTypeMatch && issue.resourceType === resourceTypeMatch[1]) {
      return scan.issuesFound > 10;
    }
  }

  return false;
}

export async function integrateWithReconciliation(
  matchResult: dataReconciliation.MatchResult
): Promise<FHIRQualityIssue[]> {
  const issues: FHIRQualityIssue[] = [];

  if (matchResult.conflicts.length > 0) {
    for (const conflict of matchResult.conflicts) {
      const issue = createIssue({
        resourceType: matchResult.sources[0]?.resourceType || "Unknown",
        resourceId: matchResult.id,
        issueType: "inconsistent_data",
        severity: "high",
        title: `Data conflict: ${conflict.fieldName}`,
        description: `Multiple sources have different values for ${conflict.fieldPath}`,
        fieldPath: conflict.fieldPath,
        currentValue: conflict.values.map((v) => ({ source: v.source, value: v.value })),
        detectedBy: "reconciliation",
        metadata: {
          conflictId: matchResult.id,
          sources: conflict.values.map((v) => v.source),
        },
      });

      const suggestion = await generateAISuggestion(issue);
      if (suggestion) {
        correctionStore.set(suggestion.id, suggestion);
        issue.suggestedCorrection = suggestion;
        issue.status = "correction_suggested";
      }

      issueStore.set(issue.id, issue);
      issues.push(issue);
    }
  }

  if (matchResult.matchType === "probable" || matchResult.matchType === "possible") {
    const issue = createIssue({
      resourceType: matchResult.sources[0]?.resourceType || "Unknown",
      resourceId: matchResult.id,
      issueType: "duplicate_record",
      severity: matchResult.matchType === "probable" ? "high" : "medium",
      title: "Potential duplicate record",
      description: `${matchResult.matchType} match found with score ${(matchResult.matchScore * 100).toFixed(1)}%`,
      detectedBy: "reconciliation",
      metadata: {
        matchScore: matchResult.matchScore,
        matchedFields: matchResult.matchedFields,
        unmatchedFields: matchResult.unmatchedFields,
      },
    });

    issueStore.set(issue.id, issue);
    issues.push(issue);
  }

  return issues;
}

export async function applyCorrection(
  correctionId: string,
  userId: string,
  ipAddress: string
): Promise<{ success: boolean; issue?: FHIRQualityIssue; error?: string }> {
  const correction = correctionStore.get(correctionId);
  if (!correction) {
    return { success: false, error: "Correction not found" };
  }

  const issue = issueStore.get(correction.issueId);
  if (!issue) {
    return { success: false, error: "Associated issue not found" };
  }

  if (correction.requiresApproval && !correction.approvedBy) {
    return { success: false, error: "Correction requires approval before application" };
  }

  correction.applied = true;
  correction.appliedAt = new Date().toISOString();
  correctionStore.set(correctionId, correction);

  issue.status = "manually_corrected";
  issue.correctedAt = new Date().toISOString();
  issue.correctedBy = hashIdentifier(userId);
  issueStore.set(issue.id, issue);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `FHIR quality correction applied: ${issue.title}`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      issueId: issue.id,
      correctionId: correctionId,
      resourceType: issue.resourceType,
      issueType: issue.issueType,
    },
  });

  return { success: true, issue };
}

export async function approveCorrection(
  correctionId: string,
  userId: string,
  ipAddress: string
): Promise<{ success: boolean; correction?: CorrectionSuggestion; error?: string }> {
  const correction = correctionStore.get(correctionId);
  if (!correction) {
    return { success: false, error: "Correction not found" };
  }

  correction.approvedBy = hashIdentifier(userId);
  correction.approvedAt = new Date().toISOString();
  correctionStore.set(correctionId, correction);

  const issue = issueStore.get(correction.issueId);
  if (issue) {
    issue.status = "correction_suggested";
    issue.reviewedAt = new Date().toISOString();
    issue.reviewedBy = hashIdentifier(userId);
    issueStore.set(issue.id, issue);
  }

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `FHIR quality correction approved`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      correctionId: correctionId,
      issueId: correction.issueId,
    },
  });

  return { success: true, correction };
}

export function getIssues(
  filters?: {
    resourceType?: string;
    severity?: QualityIssueSeverity;
    status?: QualityIssueStatus;
    issueType?: QualityIssueType;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  },
  limit: number = 100
): FHIRQualityIssue[] {
  let issues = Array.from(issueStore.values());

  if (filters?.resourceType) {
    issues = issues.filter((i) => i.resourceType === filters.resourceType);
  }
  if (filters?.severity) {
    issues = issues.filter((i) => i.severity === filters.severity);
  }
  if (filters?.status) {
    issues = issues.filter((i) => i.status === filters.status);
  }
  if (filters?.issueType) {
    issues = issues.filter((i) => i.issueType === filters.issueType);
  }
  if (filters?.patientId) {
    issues = issues.filter((i) => i.patientId === filters.patientId);
  }
  if (filters?.startDate) {
    issues = issues.filter((i) => i.detectedAt >= filters.startDate!);
  }
  if (filters?.endDate) {
    issues = issues.filter((i) => i.detectedAt <= filters.endDate!);
  }

  return issues
    .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
    .slice(0, limit);
}

export function getIssue(id: string): FHIRQualityIssue | undefined {
  return issueStore.get(id);
}

export async function updateIssueStatus(
  id: string,
  status: QualityIssueStatus,
  userId: string,
  ipAddress: string,
  notes?: string
): Promise<FHIRQualityIssue | null> {
  const issue = issueStore.get(id);
  if (!issue) return null;

  issue.status = status;
  
  if (status === "pending_review" || status === "dismissed") {
    issue.reviewedAt = new Date().toISOString();
    issue.reviewedBy = hashIdentifier(userId);
  }
  
  if (status === "manually_corrected") {
    issue.correctedAt = new Date().toISOString();
    issue.correctedBy = hashIdentifier(userId);
    issue.correctionNotes = notes;
  }

  issueStore.set(id, issue);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `FHIR quality issue status updated to ${status}`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      issueId: id,
      newStatus: status,
      notes: notes || "",
    },
  });

  return issue;
}

export function getScans(limit: number = 50): QualityScan[] {
  return Array.from(scanStore.values())
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

export function getScan(id: string): QualityScan | undefined {
  return scanStore.get(id);
}

export function getProfiles(): QualityProfile[] {
  return Array.from(profileStore.values());
}

export function getProfile(id: string): QualityProfile | undefined {
  return profileStore.get(id);
}

export async function createProfile(
  profile: Omit<QualityProfile, "id" | "createdAt" | "updatedAt">,
  userId: string,
  ipAddress: string
): Promise<QualityProfile> {
  const newProfile: QualityProfile = {
    ...profile,
    id: `profile-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  profileStore.set(newProfile.id, newProfile);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `FHIR quality profile "${newProfile.name}" created`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      profileId: newProfile.id,
      profileName: newProfile.name,
    },
  });

  return newProfile;
}

export async function updateProfile(
  id: string,
  updates: Partial<QualityProfile>,
  userId: string,
  ipAddress: string
): Promise<QualityProfile | null> {
  const profile = profileStore.get(id);
  if (!profile) return null;

  const updated = {
    ...profile,
    ...updates,
    id: profile.id,
    createdAt: profile.createdAt,
    updatedAt: new Date().toISOString(),
  };

  profileStore.set(id, updated);

  await storage.createSecurityAuditLog({
    userId: hashIdentifier(userId),
    eventType: "admin_action",
    description: `FHIR quality profile "${updated.name}" updated`,
    ipAddress: hashIdentifier(ipAddress),
    userAgent: "ai-fhir-quality-engine",
    platform: "web",
    appVersion: "1.0.0",
    metadata: {
      profileId: id,
      updatedFields: Object.keys(updates).join(","),
    },
  });

  return updated;
}

export function getMetrics(): QualityMetrics {
  const issues = Array.from(issueStore.values());
  
  const openStatuses: QualityIssueStatus[] = ["detected", "pending_review", "correction_suggested", "escalated"];
  const correctedStatuses: QualityIssueStatus[] = ["auto_corrected", "manually_corrected"];

  const openIssues = issues.filter((i) => openStatuses.includes(i.status));
  const correctedIssues = issues.filter((i) => correctedStatuses.includes(i.status));
  const dismissedIssues = issues.filter((i) => i.status === "dismissed");

  const issuesByResourceType: Record<string, number> = {};
  const issuesBySeverity: Record<QualityIssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const issuesByType: Record<string, number> = {};

  for (const issue of issues) {
    issuesByResourceType[issue.resourceType] = (issuesByResourceType[issue.resourceType] || 0) + 1;
    issuesBySeverity[issue.severity]++;
    issuesByType[issue.issueType] = (issuesByType[issue.issueType] || 0) + 1;
  }

  let totalResolutionTime = 0;
  let resolvedCount = 0;
  for (const issue of correctedIssues) {
    if (issue.correctedAt) {
      const detectedTime = new Date(issue.detectedAt).getTime();
      const correctedTime = new Date(issue.correctedAt).getTime();
      totalResolutionTime += (correctedTime - detectedTime) / (1000 * 60 * 60);
      resolvedCount++;
    }
  }

  const totalIssues = issues.length;
  const criticalOpen = issues.filter((i) => i.severity === "critical" && openStatuses.includes(i.status)).length;
  const complianceScore = totalIssues > 0 
    ? Math.max(0, 100 - (criticalOpen * 20) - (openIssues.length * 2))
    : 100;

  return {
    totalIssues,
    openIssues: openIssues.length,
    correctedIssues: correctedIssues.length,
    dismissedIssues: dismissedIssues.length,
    avgResolutionTimeHours: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    issuesByResourceType,
    issuesBySeverity,
    issuesByType: issuesByType as Record<QualityIssueType, number>,
    trendData: generateTrendData(issues),
    complianceScore,
  };
}

function generateTrendData(issues: FHIRQualityIssue[]): Array<{ date: string; detected: number; resolved: number }> {
  const last7Days: Array<{ date: string; detected: number; resolved: number }> = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];

    const detected = issues.filter((issue) => issue.detectedAt.startsWith(dateStr)).length;
    const resolved = issues.filter(
      (issue) => issue.correctedAt && issue.correctedAt.startsWith(dateStr)
    ).length;

    last7Days.push({ date: dateStr, detected, resolved });
  }

  return last7Days;
}

export function getCorrections(issueId?: string): CorrectionSuggestion[] {
  let corrections = Array.from(correctionStore.values());

  if (issueId) {
    corrections = corrections.filter((c) => c.issueId === issueId);
  }

  return corrections;
}

export function getCorrection(id: string): CorrectionSuggestion | undefined {
  return correctionStore.get(id);
}

function generatePatternSignature(
  resourceType: string,
  issueType: QualityIssueType,
  fieldPath?: string
): string {
  return `${resourceType}:${issueType}:${fieldPath || "general"}`;
}

export async function recordCorrectionFeedback(
  issueId: string,
  outcome: CorrectionOutcome,
  appliedCorrection: unknown,
  userId: string,
  userModification?: string
): Promise<CorrectionFeedback> {
  const issue = issueStore.get(issueId);
  if (!issue) {
    throw new Error("Issue not found");
  }

  const correction = issue.suggestedCorrection;
  const patternSignature = generatePatternSignature(issue.resourceType, issue.issueType, issue.fieldPath);
  
  const feedback: CorrectionFeedback = {
    id: `feedback-${Date.now()}`,
    issueId,
    correctionId: correction?.id,
    originalSuggestion: correction?.suggestedValue,
    appliedCorrection,
    outcome,
    userModification,
    resourceType: issue.resourceType,
    issueType: issue.issueType,
    fieldPath: issue.fieldPath,
    patternSignature,
    confidenceAtDetection: correction?.confidence || 0,
    feedbackTimestamp: new Date().toISOString(),
    userId: hashIdentifier(userId),
  };

  feedbackStore.set(feedback.id, feedback);

  await updateLearningPatterns(feedback);
  await recalibrateConfidence(patternSignature);

  logLearningAudit("FEEDBACK_RECORDED", {
    feedbackId: feedback.id,
    issueId: hashIdentifier(issueId),
    outcome,
    resourceType: issue.resourceType,
    issueType: issue.issueType,
    userId,
  });

  console.log(`[AIFHIRQualityEngine] Recorded feedback: ${outcome} for issue ${issueId}`);

  return feedback;
}

async function updateLearningPatterns(feedback: CorrectionFeedback): Promise<void> {
  const existingPattern = patternStore.get(feedback.patternSignature);

  if (existingPattern) {
    const totalPrevious = existingPattern.occurrences;
    const acceptedCount = Math.round(existingPattern.acceptanceRate * totalPrevious / 100);
    const newAcceptedCount = feedback.outcome === "accepted" ? acceptedCount + 1 : acceptedCount;
    const newTotal = totalPrevious + 1;

    existingPattern.occurrences = newTotal;
    existingPattern.acceptanceRate = Math.round((newAcceptedCount / newTotal) * 100);
    existingPattern.averageConfidence = (existingPattern.averageConfidence * totalPrevious + feedback.confidenceAtDetection) / newTotal;
    existingPattern.lastSeenAt = feedback.feedbackTimestamp;
    existingPattern.examples.push({
      issueId: feedback.issueId,
      outcome: feedback.outcome,
      timestamp: feedback.feedbackTimestamp,
    });
    if (existingPattern.examples.length > 20) {
      existingPattern.examples = existingPattern.examples.slice(-20);
    }

    if (feedback.outcome === "rejected" && existingPattern.acceptanceRate < 30) {
      existingPattern.confidenceAdjustment = Math.max(-0.3, existingPattern.confidenceAdjustment - 0.05);
    } else if (feedback.outcome === "accepted" && existingPattern.acceptanceRate > 80) {
      existingPattern.confidenceAdjustment = Math.min(0.2, existingPattern.confidenceAdjustment + 0.02);
    }

    patternStore.set(feedback.patternSignature, existingPattern);
  } else {
    const patternType = feedback.outcome === "dismissed" ? "dismissal_pattern" 
      : feedback.outcome === "modified" ? "modification_pattern"
      : feedback.outcome === "rejected" ? "dismissal_pattern"
      : "correction_preference";

    const newPattern: LearningPattern = {
      id: `pattern-${Date.now()}`,
      patternSignature: feedback.patternSignature,
      patternType,
      resourceType: feedback.resourceType,
      issueType: feedback.issueType,
      fieldPath: feedback.fieldPath,
      description: `Pattern for ${feedback.resourceType} ${feedback.issueType} issues`,
      occurrences: 1,
      acceptanceRate: feedback.outcome === "accepted" ? 100 : 0,
      averageConfidence: feedback.confidenceAtDetection,
      lastSeenAt: feedback.feedbackTimestamp,
      firstSeenAt: feedback.feedbackTimestamp,
      examples: [{ issueId: feedback.issueId, outcome: feedback.outcome, timestamp: feedback.feedbackTimestamp }],
      confidenceAdjustment: 0,
      isActive: true,
    };

    patternStore.set(feedback.patternSignature, newPattern);
  }
}

async function recalibrateConfidence(patternSignature: string): Promise<void> {
  const pattern = patternStore.get(patternSignature);
  if (!pattern || pattern.occurrences < 5) return;

  const calibratedConfidence = pattern.acceptanceRate / 100;
  confidenceCalibrationCache.set(patternSignature, calibratedConfidence);
}

export function getCalibratedConfidence(
  resourceType: string,
  issueType: QualityIssueType,
  baseConfidence: number,
  fieldPath?: string
): number {
  const signature = generatePatternSignature(resourceType, issueType, fieldPath);
  const pattern = patternStore.get(signature);
  
  if (!pattern || pattern.occurrences < 5) {
    return baseConfidence;
  }

  const adjustment = pattern.confidenceAdjustment;
  const calibrated = Math.max(0, Math.min(1, baseConfidence + adjustment));
  
  return calibrated;
}

export function getLearningInsights(): LearningInsights {
  const allFeedback = Array.from(feedbackStore.values());
  const allPatterns = Array.from(patternStore.values());

  const totalFeedback = allFeedback.length;
  const acceptedCount = allFeedback.filter(f => f.outcome === "accepted").length;
  const rejectedCount = allFeedback.filter(f => f.outcome === "rejected").length;
  const modifiedCount = allFeedback.filter(f => f.outcome === "modified").length;

  const topPatterns = allPatterns
    .filter(p => p.occurrences >= 3)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 10);

  const avgOriginalConfidence = allFeedback.length > 0 
    ? allFeedback.reduce((sum, f) => sum + f.confidenceAtDetection, 0) / allFeedback.length 
    : 0;

  const calibratedPatterns = allPatterns.filter(p => p.occurrences >= 5);
  const avgCalibrated = calibratedPatterns.length > 0
    ? calibratedPatterns.reduce((sum, p) => sum + (p.averageConfidence + p.confidenceAdjustment), 0) / calibratedPatterns.length
    : avgOriginalConfidence;

  const learningCurve = generateLearningCurve(allFeedback);

  const rawRecommendations = generateLearningRecommendations(allPatterns, allFeedback);
  const recommendations = sanitizeStringArray(rawRecommendations);

  logLearningAudit("INSIGHTS_ACCESSED", {
    totalFeedback,
    patternCount: allPatterns.length,
    topPatternsCount: topPatterns.length,
  });

  return {
    totalFeedback,
    acceptanceRate: totalFeedback > 0 ? Math.round((acceptedCount / totalFeedback) * 100) : 0,
    rejectionRate: totalFeedback > 0 ? Math.round((rejectedCount / totalFeedback) * 100) : 0,
    modificationRate: totalFeedback > 0 ? Math.round((modifiedCount / totalFeedback) * 100) : 0,
    topPatterns,
    confidenceCalibration: {
      original: Math.round(avgOriginalConfidence * 100),
      calibrated: Math.round(avgCalibrated * 100),
      improvement: Math.round((avgCalibrated - avgOriginalConfidence) * 100),
    },
    learningCurve,
    recommendations,
  };
}

function generateLearningCurve(
  feedback: CorrectionFeedback[]
): Array<{ date: string; accuracy: number; feedbackCount: number }> {
  const last14Days: Array<{ date: string; accuracy: number; feedbackCount: number }> = [];
  const now = new Date();

  for (let i = 13; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];

    const dayFeedback = feedback.filter(f => f.feedbackTimestamp.startsWith(dateStr));
    const accepted = dayFeedback.filter(f => f.outcome === "accepted").length;
    const accuracy = dayFeedback.length > 0 ? Math.round((accepted / dayFeedback.length) * 100) : 0;

    last14Days.push({ date: dateStr, accuracy, feedbackCount: dayFeedback.length });
  }

  return last14Days;
}

function generateLearningRecommendations(
  patterns: LearningPattern[],
  feedback: CorrectionFeedback[]
): string[] {
  const recommendations: string[] = [];

  const lowAcceptancePatterns = patterns.filter(p => p.occurrences >= 5 && p.acceptanceRate < 50);
  if (lowAcceptancePatterns.length > 0) {
    recommendations.push(`${lowAcceptancePatterns.length} issue patterns have low acceptance rates. Consider adjusting detection rules for: ${lowAcceptancePatterns.map(p => p.issueType).join(", ")}`);
  }

  const highDismissalPatterns = patterns.filter(p => p.patternType === "dismissal_pattern" && p.occurrences >= 3);
  if (highDismissalPatterns.length > 0) {
    recommendations.push(`Frequent dismissals detected for ${highDismissalPatterns.length} patterns. Review if these issue types need refinement.`);
  }

  const modificationPatterns = patterns.filter(p => p.patternType === "modification_pattern" && p.occurrences >= 3);
  if (modificationPatterns.length > 0) {
    recommendations.push(`${modificationPatterns.length} patterns frequently require user modifications. AI suggestions may need improvement.`);
  }

  const recentFeedback = feedback.filter(f => {
    const feedbackDate = new Date(f.feedbackTimestamp);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return feedbackDate > weekAgo;
  });
  
  if (recentFeedback.length > 0) {
    const recentAcceptance = recentFeedback.filter(f => f.outcome === "accepted").length / recentFeedback.length;
    if (recentAcceptance > 0.8) {
      recommendations.push("Recent acceptance rate is above 80%. The learning system is performing well.");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue collecting feedback to improve anomaly detection accuracy.");
  }

  return recommendations;
}

export function getPatterns(
  filters?: { resourceType?: string; issueType?: QualityIssueType; minOccurrences?: number }
): LearningPattern[] {
  let patterns = Array.from(patternStore.values());

  if (filters?.resourceType) {
    patterns = patterns.filter(p => p.resourceType === filters.resourceType);
  }
  if (filters?.issueType) {
    patterns = patterns.filter(p => p.issueType === filters.issueType);
  }
  if (filters?.minOccurrences) {
    patterns = patterns.filter(p => p.occurrences >= filters.minOccurrences!);
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

export function getFeedback(
  filters?: { issueId?: string; outcome?: CorrectionOutcome; startDate?: string; endDate?: string },
  limit: number = 100
): CorrectionFeedback[] {
  let feedback = Array.from(feedbackStore.values());

  if (filters?.issueId) {
    feedback = feedback.filter(f => f.issueId === filters.issueId);
  }
  if (filters?.outcome) {
    feedback = feedback.filter(f => f.outcome === filters.outcome);
  }
  if (filters?.startDate) {
    feedback = feedback.filter(f => f.feedbackTimestamp >= filters.startDate!);
  }
  if (filters?.endDate) {
    feedback = feedback.filter(f => f.feedbackTimestamp <= filters.endDate!);
  }

  return feedback
    .sort((a, b) => new Date(b.feedbackTimestamp).getTime() - new Date(a.feedbackTimestamp).getTime())
    .slice(0, limit);
}

export async function analyzeAnomalyPatterns(): Promise<{
  anomalyInsights: string[];
  emergingPatterns: LearningPattern[];
  confidenceImprovements: Array<{ pattern: string; before: number; after: number }>;
}> {
  const patterns = Array.from(patternStore.values());
  const feedback = Array.from(feedbackStore.values());
  const anomalyInsights: string[] = [];
  const emergingPatterns: LearningPattern[] = [];
  const confidenceImprovements: Array<{ pattern: string; before: number; after: number }> = [];

  const recentPatterns = patterns.filter(p => {
    const lastSeen = new Date(p.lastSeenAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastSeen > weekAgo && p.occurrences >= 2;
  });

  for (const pattern of recentPatterns) {
    const recentExamples = pattern.examples.filter(e => {
      const ts = new Date(e.timestamp);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return ts > weekAgo;
    });

    if (recentExamples.length >= 3) {
      emergingPatterns.push(pattern);
    }
  }

  for (const pattern of patterns.filter(p => p.occurrences >= 5)) {
    if (Math.abs(pattern.confidenceAdjustment) > 0.05) {
      confidenceImprovements.push({
        pattern: pattern.patternSignature,
        before: Math.round(pattern.averageConfidence * 100),
        after: Math.round((pattern.averageConfidence + pattern.confidenceAdjustment) * 100),
      });
    }
  }

  const issueTypeCounts: Record<string, number> = {};
  for (const f of feedback) {
    issueTypeCounts[f.issueType] = (issueTypeCounts[f.issueType] || 0) + 1;
  }
  const topIssueTypes = Object.entries(issueTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topIssueTypes.length > 0) {
    anomalyInsights.push(`Most common issues: ${topIssueTypes.map(([type, count]) => `${type} (${count})`).join(", ")}`);
  }

  const resourceTypeCounts: Record<string, number> = {};
  for (const f of feedback) {
    resourceTypeCounts[f.resourceType] = (resourceTypeCounts[f.resourceType] || 0) + 1;
  }
  const topResources = Object.entries(resourceTypeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topResources.length > 0) {
    anomalyInsights.push(`Resources with most issues: ${topResources.map(([type, count]) => `${type} (${count})`).join(", ")}`);
  }

  if (emergingPatterns.length > 0) {
    anomalyInsights.push(`${emergingPatterns.length} new patterns emerging this week`);
  }

  const sanitizedInsights = sanitizeStringArray(anomalyInsights);

  logLearningAudit("ANOMALY_ANALYSIS_ACCESSED", {
    emergingPatternsCount: emergingPatterns.length,
    confidenceImprovementsCount: confidenceImprovements.length,
    insightsCount: sanitizedInsights.length,
  });

  return {
    anomalyInsights: sanitizedInsights,
    emergingPatterns,
    confidenceImprovements,
  };
}

initializeSampleLearningData();

function initializeSampleLearningData(): void {
  const sampleFeedback: CorrectionFeedback[] = [
    {
      id: "feedback-sample-1",
      issueId: "sample-issue-1",
      outcome: "accepted",
      appliedCorrection: "2024-01-15",
      resourceType: "Patient",
      issueType: "format_violation",
      fieldPath: "Patient.birthDate",
      patternSignature: "Patient:format_violation:Patient.birthDate",
      confidenceAtDetection: 0.85,
      feedbackTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      userId: "user-sample",
    },
    {
      id: "feedback-sample-2",
      issueId: "sample-issue-2",
      outcome: "modified",
      appliedCorrection: { system: "http://loinc.org", code: "12345-6" },
      userModification: "Selected different LOINC code",
      resourceType: "Observation",
      issueType: "invalid_code_system",
      fieldPath: "Observation.code.coding.system",
      patternSignature: "Observation:invalid_code_system:Observation.code.coding.system",
      confidenceAtDetection: 0.72,
      feedbackTimestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      userId: "user-sample",
    },
    {
      id: "feedback-sample-3",
      issueId: "sample-issue-3",
      outcome: "dismissed",
      appliedCorrection: null,
      resourceType: "Condition",
      issueType: "stale_data",
      patternSignature: "Condition:stale_data:general",
      confidenceAtDetection: 0.65,
      feedbackTimestamp: new Date().toISOString(),
      userId: "user-sample",
    },
  ];

  for (const f of sampleFeedback) {
    feedbackStore.set(f.id, f);
  }

  const samplePatterns: LearningPattern[] = [
    {
      id: "pattern-sample-1",
      patternSignature: "Patient:format_violation:Patient.birthDate",
      patternType: "correction_preference",
      resourceType: "Patient",
      issueType: "format_violation",
      fieldPath: "Patient.birthDate",
      description: "Date format corrections in Patient resources",
      occurrences: 15,
      acceptanceRate: 87,
      averageConfidence: 0.82,
      lastSeenAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      examples: [
        { issueId: "sample-issue-1", outcome: "accepted", timestamp: new Date().toISOString() },
      ],
      confidenceAdjustment: 0.05,
      isActive: true,
    },
    {
      id: "pattern-sample-2",
      patternSignature: "Observation:invalid_code_system:Observation.code.coding.system",
      patternType: "modification_pattern",
      resourceType: "Observation",
      issueType: "invalid_code_system",
      fieldPath: "Observation.code.coding.system",
      description: "Code system corrections often require user selection",
      occurrences: 23,
      acceptanceRate: 45,
      averageConfidence: 0.68,
      lastSeenAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      examples: [
        { issueId: "sample-issue-2", outcome: "modified", timestamp: new Date().toISOString() },
      ],
      aiInsight: "Users frequently modify code suggestions. Consider expanding code lookup to include more context.",
      confidenceAdjustment: -0.1,
      isActive: true,
    },
    {
      id: "pattern-sample-3",
      patternSignature: "Condition:stale_data:general",
      patternType: "dismissal_pattern",
      resourceType: "Condition",
      issueType: "stale_data",
      description: "Stale condition data often dismissed as expected for chronic conditions",
      occurrences: 8,
      acceptanceRate: 25,
      averageConfidence: 0.60,
      lastSeenAt: new Date().toISOString(),
      firstSeenAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      examples: [
        { issueId: "sample-issue-3", outcome: "dismissed", timestamp: new Date().toISOString() },
      ],
      aiInsight: "High dismissal rate suggests stale data thresholds may need adjustment for Condition resources.",
      confidenceAdjustment: -0.15,
      isActive: true,
    },
  ];

  for (const p of samplePatterns) {
    patternStore.set(p.patternSignature, p);
  }

  console.log("[AIFHIRQualityEngine] Sample learning data initialized");
}

console.log("[AIFHIRQualityEngine] Service initialized with learning capabilities");
