import { getAuditLogger } from "./integrations/factory";

export type ValidationSeverity = "critical" | "error" | "warning";
export type ValidationStatus = "open" | "acknowledged" | "corrected" | "dismissed";

export interface FHIRValidationRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  ruleType: "required_field" | "format" | "code_system" | "reference" | "business" | "custom";
  expression: string;
  severity: ValidationSeverity;
  errorMessage: string;
  suggestion: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FHIRValidationFailure {
  id: string;
  ruleId: string;
  ruleName: string;
  patientId: string;
  patientName: string;
  resourceType: string;
  resourceId: string;
  severity: ValidationSeverity;
  errorMessage: string;
  suggestion: string;
  fieldPath: string;
  actualValue?: string;
  expectedValue?: string;
  status: ValidationStatus;
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  correctedAt?: string;
  correctedBy?: string;
  notes?: string;
}

export interface ValidationSummary {
  totalFailures: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  openCount: number;
  acknowledgedCount: number;
  correctedCount: number;
  byResourceType: Record<string, number>;
  byPatient: Record<string, { name: string; count: number }>;
}

const SAMPLE_RULES: FHIRValidationRule[] = [
  {
    id: "rule-001",
    name: "Condition Onset Required",
    description: "All Condition resources must have an onset date",
    resourceType: "Condition",
    ruleType: "required_field",
    expression: "onsetDateTime != null || onsetPeriod != null",
    severity: "error",
    errorMessage: "Condition is missing onset date",
    suggestion: "Add onsetDateTime or onsetPeriod to specify when the condition began",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "rule-002",
    name: "Medication Status Required",
    description: "All MedicationRequest resources must have a valid status",
    resourceType: "MedicationRequest",
    ruleType: "required_field",
    expression: "status in ('active', 'completed', 'cancelled', 'stopped')",
    severity: "critical",
    errorMessage: "MedicationRequest has invalid or missing status",
    suggestion: "Set status to one of: active, completed, cancelled, stopped",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "rule-003",
    name: "Patient Identifier Required",
    description: "All Patient resources must have at least one identifier",
    resourceType: "Patient",
    ruleType: "required_field",
    expression: "identifier.count() >= 1",
    severity: "critical",
    errorMessage: "Patient is missing identifier",
    suggestion: "Add at least one identifier (MRN, SSN, or other ID)",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "rule-004",
    name: "Observation Code System",
    description: "Observation codes must use LOINC coding system",
    resourceType: "Observation",
    ruleType: "code_system",
    expression: "code.coding.where(system = 'http://loinc.org').exists()",
    severity: "warning",
    errorMessage: "Observation code is not using LOINC coding system",
    suggestion: "Map the observation code to the corresponding LOINC code",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "rule-005",
    name: "AllergyIntolerance Reaction Required",
    description: "AllergyIntolerance should include reaction information",
    resourceType: "AllergyIntolerance",
    ruleType: "required_field",
    expression: "reaction.exists()",
    severity: "warning",
    errorMessage: "AllergyIntolerance is missing reaction details",
    suggestion: "Add reaction manifestation and severity information",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "rule-006",
    name: "Procedure Date Required",
    description: "All Procedure resources must have a performed date",
    resourceType: "Procedure",
    ruleType: "required_field",
    expression: "performedDateTime != null || performedPeriod != null",
    severity: "error",
    errorMessage: "Procedure is missing performed date",
    suggestion: "Add performedDateTime or performedPeriod",
    enabled: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
  },
];

const SAMPLE_FAILURES: FHIRValidationFailure[] = [
  {
    id: "failure-001",
    ruleId: "rule-001",
    ruleName: "Condition Onset Required",
    patientId: "patient-001",
    patientName: "John Smith",
    resourceType: "Condition",
    resourceId: "cond-diabetes-001",
    severity: "error",
    errorMessage: "Condition is missing onset date",
    suggestion: "Add onsetDateTime or onsetPeriod to specify when the condition began",
    fieldPath: "Condition.onsetDateTime",
    status: "open",
    detectedAt: "2024-01-25T10:30:00Z",
  },
  {
    id: "failure-002",
    ruleId: "rule-002",
    ruleName: "Medication Status Required",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    resourceType: "MedicationRequest",
    resourceId: "med-req-003",
    severity: "critical",
    errorMessage: "MedicationRequest has invalid status 'draft'",
    suggestion: "Set status to one of: active, completed, cancelled, stopped",
    fieldPath: "MedicationRequest.status",
    actualValue: "draft",
    expectedValue: "active | completed | cancelled | stopped",
    status: "acknowledged",
    detectedAt: "2024-01-24T14:20:00Z",
    acknowledgedAt: "2024-01-24T16:00:00Z",
    acknowledgedBy: "Dr. Williams",
  },
  {
    id: "failure-003",
    ruleId: "rule-004",
    ruleName: "Observation Code System",
    patientId: "patient-001",
    patientName: "John Smith",
    resourceType: "Observation",
    resourceId: "obs-glucose-001",
    severity: "warning",
    errorMessage: "Observation code is not using LOINC coding system",
    suggestion: "Map the observation code to the corresponding LOINC code",
    fieldPath: "Observation.code.coding.system",
    actualValue: "http://local.org/codes",
    expectedValue: "http://loinc.org",
    status: "corrected",
    detectedAt: "2024-01-23T09:15:00Z",
    correctedAt: "2024-01-23T11:00:00Z",
    correctedBy: "System Admin",
    notes: "Mapped local code to LOINC 2345-7",
  },
  {
    id: "failure-004",
    ruleId: "rule-005",
    ruleName: "AllergyIntolerance Reaction Required",
    patientId: "patient-003",
    patientName: "Robert Davis",
    resourceType: "AllergyIntolerance",
    resourceId: "allergy-penicillin-003",
    severity: "warning",
    errorMessage: "AllergyIntolerance is missing reaction details",
    suggestion: "Add reaction manifestation and severity information",
    fieldPath: "AllergyIntolerance.reaction",
    status: "open",
    detectedAt: "2024-01-25T08:45:00Z",
  },
  {
    id: "failure-005",
    ruleId: "rule-001",
    ruleName: "Condition Onset Required",
    patientId: "patient-004",
    patientName: "Sarah Wilson",
    resourceType: "Condition",
    resourceId: "cond-anxiety-004",
    severity: "error",
    errorMessage: "Condition is missing onset date",
    suggestion: "Add onsetDateTime or onsetPeriod to specify when the condition began",
    fieldPath: "Condition.onsetDateTime",
    status: "open",
    detectedAt: "2024-01-25T11:00:00Z",
  },
  {
    id: "failure-006",
    ruleId: "rule-006",
    ruleName: "Procedure Date Required",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    resourceType: "Procedure",
    resourceId: "proc-surgery-002",
    severity: "error",
    errorMessage: "Procedure is missing performed date",
    suggestion: "Add performedDateTime or performedPeriod",
    fieldPath: "Procedure.performedDateTime",
    status: "acknowledged",
    detectedAt: "2024-01-24T16:30:00Z",
    acknowledgedAt: "2024-01-25T09:00:00Z",
    acknowledgedBy: "Nurse Sarah",
    notes: "Waiting for surgical team to confirm date",
  },
  {
    id: "failure-007",
    ruleId: "rule-003",
    ruleName: "Patient Identifier Required",
    patientId: "patient-005",
    patientName: "Michael Brown",
    resourceType: "Patient",
    resourceId: "patient-005",
    severity: "critical",
    errorMessage: "Patient is missing identifier",
    suggestion: "Add at least one identifier (MRN, SSN, or other ID)",
    fieldPath: "Patient.identifier",
    status: "open",
    detectedAt: "2024-01-25T12:00:00Z",
  },
];

const ruleStore: FHIRValidationRule[] = [...SAMPLE_RULES];
const failureStore: FHIRValidationFailure[] = [...SAMPLE_FAILURES];

export function addOrUpdateFailure(failure: FHIRValidationFailure): { isNew: boolean } {
  const existingIndex = failureStore.findIndex(
    f => f.ruleId === failure.ruleId && f.resourceId === failure.resourceId && f.status === "open"
  );
  
  if (existingIndex >= 0) {
    failureStore[existingIndex].detectedAt = failure.detectedAt;
    return { isNew: false };
  } else {
    failureStore.push(failure);
    return { isNew: true };
  }
}

export function markFailureAsCorrected(ruleId: string, resourceId: string): boolean {
  const failure = failureStore.find(
    f => f.ruleId === ruleId && f.resourceId === resourceId && f.status === "open"
  );
  if (failure) {
    failure.status = "corrected";
    failure.correctedAt = new Date().toISOString();
    failure.correctedBy = "Automated Scan";
    return true;
  }
  return false;
}

export function getValidationRules(): FHIRValidationRule[] {
  return ruleStore.filter((r) => r.enabled);
}

export function getAllValidationRules(): FHIRValidationRule[] {
  return ruleStore;
}

export async function createValidationRule(
  rule: Omit<FHIRValidationRule, "id" | "createdAt" | "updatedAt">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRValidationRule> {
  const newRule: FHIRValidationRule = {
    ...rule,
    id: `rule-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  ruleStore.push(newRule);

  await logValidationActivity("create_rule", { ruleId: newRule.id, ruleName: newRule.name }, userId, ipAddress, userAgent);

  return newRule;
}

export async function updateValidationRule(
  ruleId: string,
  updates: Partial<FHIRValidationRule>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRValidationRule | null> {
  const rule = ruleStore.find((r) => r.id === ruleId);
  if (!rule) return null;

  Object.assign(rule, updates, { updatedAt: new Date().toISOString() });

  await logValidationActivity("update_rule", { ruleId, updates: Object.keys(updates) }, userId, ipAddress, userAgent);

  return rule;
}

export function getValidationFailures(filters?: {
  patientId?: string;
  resourceType?: string;
  severity?: ValidationSeverity;
  status?: ValidationStatus;
}): FHIRValidationFailure[] {
  let failures = failureStore;

  if (filters?.patientId) {
    failures = failures.filter((f) => f.patientId === filters.patientId);
  }
  if (filters?.resourceType) {
    failures = failures.filter((f) => f.resourceType === filters.resourceType);
  }
  if (filters?.severity) {
    failures = failures.filter((f) => f.severity === filters.severity);
  }
  if (filters?.status) {
    failures = failures.filter((f) => f.status === filters.status);
  }

  return failures.sort((a, b) => {
    const severityOrder = { critical: 0, error: 1, warning: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}

export function getValidationSummary(): ValidationSummary {
  const failures = failureStore;

  const byResourceType: Record<string, number> = {};
  const byPatient: Record<string, { name: string; count: number }> = {};

  failures.forEach((f) => {
    byResourceType[f.resourceType] = (byResourceType[f.resourceType] || 0) + 1;
    if (!byPatient[f.patientId]) {
      byPatient[f.patientId] = { name: f.patientName, count: 0 };
    }
    byPatient[f.patientId].count++;
  });

  return {
    totalFailures: failures.length,
    criticalCount: failures.filter((f) => f.severity === "critical").length,
    errorCount: failures.filter((f) => f.severity === "error").length,
    warningCount: failures.filter((f) => f.severity === "warning").length,
    openCount: failures.filter((f) => f.status === "open").length,
    acknowledgedCount: failures.filter((f) => f.status === "acknowledged").length,
    correctedCount: failures.filter((f) => f.status === "corrected").length,
    byResourceType,
    byPatient,
  };
}

export async function updateFailureStatus(
  failureId: string,
  status: ValidationStatus,
  notes: string | undefined,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<FHIRValidationFailure | null> {
  const failure = failureStore.find((f) => f.id === failureId);
  if (!failure) return null;

  const oldStatus = failure.status;
  failure.status = status;
  if (notes) failure.notes = notes;

  if (status === "acknowledged" && oldStatus !== "acknowledged") {
    failure.acknowledgedAt = new Date().toISOString();
    failure.acknowledgedBy = userId;
  }
  if (status === "corrected" && oldStatus !== "corrected") {
    failure.correctedAt = new Date().toISOString();
    failure.correctedBy = userId;
  }

  await logValidationActivity(
    "update_failure_status",
    { failureId, oldStatus, newStatus: status, resourceType: failure.resourceType },
    userId,
    ipAddress,
    userAgent
  );

  return failure;
}

export function getPatientsList(): Array<{ id: string; name: string }> {
  const patients = new Map<string, string>();
  failureStore.forEach((f) => {
    patients.set(f.patientId, f.patientName);
  });
  return Array.from(patients.entries()).map(([id, name]) => ({ id, name }));
}

export function getResourceTypes(): string[] {
  return Array.from(new Set(failureStore.map((f) => f.resourceType)));
}

export async function logValidationAccess(
  action: string,
  details: Record<string, unknown>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: "[REDACTED]",
      userRole: "user",
      action: "read",
      resourceType: "FHIRValidation",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/fhir-validation",
      requestMethod: "GET",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: {
        validationAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[FHIRValidation] Audit logging failed:", e);
  }
}

async function logValidationActivity(
  action: string,
  details: Record<string, unknown>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: "[REDACTED]",
      userRole: "admin",
      action: "update",
      resourceType: "FHIRValidation",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/fhir-validation",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: {
        validationAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[FHIRValidation] Audit logging failed:", e);
  }
}

console.log("[FHIRValidation] Service initialized");
