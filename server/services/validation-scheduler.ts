import { getAuditLogger } from "./integrations/factory";
import {
  getValidationRules,
  getValidationFailures,
  addOrUpdateFailure,
  markFailureAsCorrected,
  FHIRValidationRule,
  FHIRValidationFailure,
  ValidationSeverity,
} from "./fhir-validation-service";

export interface ValidationScanResult {
  scanId: string;
  startedAt: string;
  completedAt: string;
  resourcesScanned: number;
  newViolationsFound: number;
  existingViolationsUpdated: number;
  rulesApplied: number;
  status: "completed" | "failed" | "partial";
  errorMessage?: string;
}

export interface FHIRResourceForValidation {
  id: string;
  resourceType: string;
  patientId: string;
  patientName: string;
  data: Record<string, unknown>;
  source: string;
  lastUpdated: string;
}

const SAMPLE_FHIR_RESOURCES: FHIRResourceForValidation[] = [
  {
    id: "condition-001",
    resourceType: "Condition",
    patientId: "patient-001",
    patientName: "John Smith",
    data: {
      code: { coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }] },
      clinicalStatus: { coding: [{ system: "http://hl7.org/fhir/condition-clinical", code: "active" }] },
    },
    source: "Fasten Health",
    lastUpdated: "2024-01-15T10:00:00Z",
  },
  {
    id: "condition-002",
    resourceType: "Condition",
    patientId: "patient-001",
    patientName: "John Smith",
    data: {
      code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }] },
      clinicalStatus: { coding: [{ system: "http://hl7.org/fhir/condition-clinical", code: "active" }] },
      onsetDateTime: "2020-03-15",
    },
    source: "Fasten Health",
    lastUpdated: "2024-01-15T10:00:00Z",
  },
  {
    id: "medication-001",
    resourceType: "MedicationRequest",
    patientId: "patient-001",
    patientName: "John Smith",
    data: {
      status: "active",
      medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500mg" }] },
    },
    source: "Fasten Health",
    lastUpdated: "2024-01-14T08:00:00Z",
  },
  {
    id: "observation-001",
    resourceType: "Observation",
    patientId: "patient-001",
    patientName: "John Smith",
    data: {
      status: "final",
      code: { coding: [{ system: "http://local.hospital/codes", code: "GLU", display: "Glucose" }] },
      valueQuantity: { value: 126, unit: "mg/dL" },
    },
    source: "Quest",
    lastUpdated: "2024-01-16T14:00:00Z",
  },
  {
    id: "allergy-001",
    resourceType: "AllergyIntolerance",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    data: {
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "723", display: "Penicillin" }] },
    },
    source: "CVS",
    lastUpdated: "2024-01-12T09:00:00Z",
  },
  {
    id: "patient-001",
    resourceType: "Patient",
    patientId: "patient-001",
    patientName: "John Smith",
    data: {
      identifier: [{ system: "http://hospital.example.org/mrn", value: "MRN12345" }],
      name: [{ family: "Smith", given: ["John"] }],
      birthDate: "1965-04-15",
    },
    source: "Fasten Health",
    lastUpdated: "2024-01-10T10:00:00Z",
  },
  {
    id: "patient-002",
    resourceType: "Patient",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    data: {
      name: [{ family: "Johnson", given: ["Mary"] }],
      birthDate: "1978-08-22",
    },
    source: "provider",
    lastUpdated: "2024-01-10T10:00:00Z",
  },
];

let lastScanResult: ValidationScanResult | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;

function generateId(): string {
  return `failure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function evaluateRule(rule: FHIRValidationRule, resource: FHIRResourceForValidation): { passed: boolean; actualValue?: string; fieldPath: string } {
  const data = resource.data;
  
  switch (rule.ruleType) {
    case "required_field":
      if (rule.resourceType === "Condition") {
        const hasOnset = data.onsetDateTime || data.onsetPeriod;
        return { passed: !!hasOnset, actualValue: hasOnset ? String(hasOnset) : "missing", fieldPath: "onsetDateTime" };
      }
      if (rule.resourceType === "MedicationRequest") {
        const status = data.status as string;
        const validStatuses = ["active", "completed", "cancelled", "stopped"];
        return { passed: validStatuses.includes(status), actualValue: status || "missing", fieldPath: "status" };
      }
      if (rule.resourceType === "Patient") {
        const identifiers = data.identifier as unknown[];
        return { passed: Array.isArray(identifiers) && identifiers.length > 0, actualValue: identifiers?.length?.toString() || "0", fieldPath: "identifier" };
      }
      if (rule.resourceType === "AllergyIntolerance") {
        const hasReaction = data.reaction;
        return { passed: !!hasReaction, actualValue: hasReaction ? "present" : "missing", fieldPath: "reaction" };
      }
      break;
    case "code_system":
      if (rule.resourceType === "Observation") {
        const code = data.code as { coding?: Array<{ system?: string }> };
        const hasLoinc = code?.coding?.some(c => c.system === "http://loinc.org");
        const systems = code?.coding?.map(c => c.system).join(", ") || "none";
        return { passed: !!hasLoinc, actualValue: systems, fieldPath: "code.coding.system" };
      }
      break;
  }
  return { passed: true, fieldPath: "unknown" };
}

export async function checkDataQualityValidation(): Promise<ValidationScanResult> {
  const scanId = `scan-${Date.now()}`;
  const startedAt = new Date().toISOString();
  
  console.log(`[ValidationScheduler] Starting validation scan ${scanId}`);
  
  try {
    const rules = getValidationRules();
    const enabledRules = rules.filter(r => r.enabled);
    let newViolationsFound = 0;
    let existingViolationsUpdated = 0;
    
    await logScanActivity("scan_started", { scanId, rulesCount: enabledRules.length, resourcesCount: SAMPLE_FHIR_RESOURCES.length });
    
    for (const resource of SAMPLE_FHIR_RESOURCES) {
      const applicableRules = enabledRules.filter(r => r.resourceType === resource.resourceType);
      
      for (const rule of applicableRules) {
        const result = evaluateRule(rule, resource);
        
        if (!result.passed) {
          const newFailure: FHIRValidationFailure = {
            id: generateId(),
            ruleId: rule.id,
            ruleName: rule.name,
            patientId: resource.patientId,
            patientName: resource.patientName,
            resourceType: resource.resourceType,
            resourceId: resource.id,
            severity: rule.severity,
            errorMessage: rule.errorMessage,
            suggestion: rule.suggestion,
            fieldPath: result.fieldPath,
            actualValue: result.actualValue,
            expectedValue: rule.expression,
            status: "open",
            detectedAt: new Date().toISOString(),
          };
          const { isNew } = addOrUpdateFailure(newFailure);
          if (isNew) {
            newViolationsFound++;
          } else {
            existingViolationsUpdated++;
          }
        } else {
          markFailureAsCorrected(rule.id, resource.id);
        }
      }
    }
    
    const completedAt = new Date().toISOString();
    const scanResult: ValidationScanResult = {
      scanId,
      startedAt,
      completedAt,
      resourcesScanned: SAMPLE_FHIR_RESOURCES.length,
      newViolationsFound,
      existingViolationsUpdated,
      rulesApplied: enabledRules.length,
      status: "completed",
    };
    
    lastScanResult = scanResult;
    
    await logScanActivity("scan_completed", {
      scanId,
      resourcesScanned: SAMPLE_FHIR_RESOURCES.length,
      newViolationsFound,
      existingViolationsUpdated,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
    });
    
    console.log(`[ValidationScheduler] Scan ${scanId} completed: ${newViolationsFound} new violations, ${existingViolationsUpdated} updated`);
    
    return scanResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ValidationScheduler] Scan ${scanId} failed:`, error);
    
    await logScanActivity("scan_failed", { scanId, error: errorMessage });
    
    const failedResult: ValidationScanResult = {
      scanId,
      startedAt,
      completedAt: new Date().toISOString(),
      resourcesScanned: 0,
      newViolationsFound: 0,
      existingViolationsUpdated: 0,
      rulesApplied: 0,
      status: "failed",
      errorMessage,
    };
    
    lastScanResult = failedResult;
    return failedResult;
  }
}

export function startValidationScheduler(intervalMs: number = 86400000): void {
  if (isSchedulerRunning) {
    console.log("[ValidationScheduler] Scheduler already running");
    return;
  }
  
  console.log(`[ValidationScheduler] Starting scheduler with interval ${intervalMs}ms (${intervalMs / 3600000} hours)`);
  isSchedulerRunning = true;
  
  checkDataQualityValidation();
  
  schedulerInterval = setInterval(async () => {
    console.log("[ValidationScheduler] Running scheduled validation check");
    await checkDataQualityValidation();
  }, intervalMs);
  
  logScanActivity("scheduler_started", { intervalMs });
}

export function stopValidationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  isSchedulerRunning = false;
  console.log("[ValidationScheduler] Scheduler stopped");
  logScanActivity("scheduler_stopped", {});
}

export function triggerValidationOnDataUpdate(resourceType: string, resourceId: string): void {
  console.log(`[ValidationScheduler] Triggering validation for ${resourceType}/${resourceId} update`);
  logScanActivity("data_update_trigger", { resourceType, resourceId: "[REDACTED]" });
  checkDataQualityValidation();
}

export function getSchedulerStatus(): {
  isRunning: boolean;
  lastScan: ValidationScanResult | null;
  totalFailures: number;
} {
  const failures = getValidationFailures({ status: "open" });
  return {
    isRunning: isSchedulerRunning,
    lastScan: lastScanResult,
    totalFailures: failures.length,
  };
}

export function getSchedulerFailures(): FHIRValidationFailure[] {
  return getValidationFailures();
}

async function logScanActivity(action: string, details: Record<string, unknown>): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: "[REDACTED]",
      userRole: "system",
      action: "create",
      resourceType: "ValidationScan",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/fhir-validation/scheduler",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: {
        schedulerAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[ValidationScheduler] Audit logging failed:", e);
  }
}
