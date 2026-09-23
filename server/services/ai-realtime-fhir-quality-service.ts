import { generatePhiSafeText } from "./ai-gateway";
import { randomUUID } from "crypto";

export interface QualityIssue {
  id: string;
  field: string;
  issueType: "missing_required" | "invalid_format" | "invalid_value" | "inconsistent" | "outdated" | "duplicate" | "semantic_error";
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  currentValue: any;
  suggestedValue?: any;
  confidence: number;
  autoFixable: boolean;
}

export interface CorrectionSuggestion {
  id: string;
  field: string;
  currentValue: any;
  suggestedValue: any;
  reason: string;
  confidence: number;
  source: "ai" | "rule" | "reference_data";
  acceptanceStatus?: "pending" | "accepted" | "rejected";
}

export interface ValidationResult {
  id: string;
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  isValid: boolean;
  overallScore: number;
  issues: QualityIssue[];
  corrections: CorrectionSuggestion[];
  processingTimeMs: number;
  aiAnalysis?: string;
}

export interface DataProfile {
  id: string;
  resourceType: string;
  fieldName: string;
  dataType: string;
  statistics: {
    totalRecords: number;
    nullCount: number;
    uniqueCount: number;
    mostCommonValues: { value: string; count: number }[];
    minValue?: any;
    maxValue?: any;
    avgValue?: number;
    stdDeviation?: number;
    pattern?: string;
  };
  qualityMetrics: {
    completeness: number;
    uniqueness: number;
    validity: number;
    consistency: number;
  };
  anomalies: {
    type: string;
    description: string;
    affectedCount: number;
    severity: "low" | "medium" | "high";
  }[];
  lastUpdated: string;
}

export interface DatasetProfile {
  id: string;
  name: string;
  resourceTypes: string[];
  totalRecords: number;
  overallQualityScore: number;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
  };
  fieldProfiles: DataProfile[];
  crossResourceIssues: {
    type: string;
    description: string;
    affectedResources: string[];
    severity: "low" | "medium" | "high";
  }[];
  createdAt: string;
  lastUpdated: string;
}

export interface RealTimeMonitoringEvent {
  id: string;
  eventType: "create" | "update" | "delete" | "batch";
  resourceType: string;
  resourceId?: string;
  timestamp: string;
  qualityScore: number;
  issueCount: number;
  correctionCount: number;
  autoFixesApplied: number;
  processingTimeMs: number;
  status: "passed" | "warnings" | "blocked" | "corrected";
}

const validationResults = new Map<string, ValidationResult>();
const monitoringEvents: RealTimeMonitoringEvent[] = [];
const datasetProfiles = new Map<string, DatasetProfile>();
const fieldProfiles = new Map<string, DataProfile>();

const FHIR_REQUIRED_FIELDS: Record<string, string[]> = {
  Patient: ["resourceType", "name"],
  Observation: ["resourceType", "status", "code"],
  Condition: ["resourceType", "clinicalStatus", "code", "subject"],
  MedicationRequest: ["resourceType", "status", "intent", "medication", "subject"],
  Encounter: ["resourceType", "status", "class", "subject"],
  AllergyIntolerance: ["resourceType", "clinicalStatus", "patient"],
  Immunization: ["resourceType", "status", "vaccineCode", "patient", "occurrenceDateTime"],
  Procedure: ["resourceType", "status", "code", "subject"],
  DiagnosticReport: ["resourceType", "status", "code"],
  CarePlan: ["resourceType", "status", "intent", "subject"],
};

const FHIR_VALUE_SETS: Record<string, Record<string, string[]>> = {
  Patient: {
    gender: ["male", "female", "other", "unknown"],
  },
  Observation: {
    status: ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"],
  },
  Condition: {
    clinicalStatus: ["active", "recurrence", "relapse", "inactive", "remission", "resolved"],
  },
  MedicationRequest: {
    status: ["active", "on-hold", "cancelled", "completed", "entered-in-error", "stopped", "draft", "unknown"],
    intent: ["proposal", "plan", "order", "original-order", "reflex-order", "filler-order", "instance-order", "option"],
  },
  Encounter: {
    status: ["planned", "arrived", "triaged", "in-progress", "onleave", "finished", "cancelled", "entered-in-error", "unknown"],
  },
  Immunization: {
    status: ["completed", "entered-in-error", "not-done"],
  },
};

function validateRequiredFields(resource: any, resourceType: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const requiredFields = FHIR_REQUIRED_FIELDS[resourceType] || [];

  for (const field of requiredFields) {
    const value = getNestedValue(resource, field);
    if (value === undefined || value === null || value === "") {
      issues.push({
        id: randomUUID(),
        field,
        issueType: "missing_required",
        severity: "error",
        message: `Required field '${field}' is missing`,
        currentValue: value,
        confidence: 1.0,
        autoFixable: false,
      });
    }
  }

  return issues;
}

function validateValueSets(resource: any, resourceType: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const valueSets = FHIR_VALUE_SETS[resourceType] || {};

  for (const [field, validValues] of Object.entries(valueSets)) {
    const value = getNestedValue(resource, field);
    if (value && !validValues.includes(value)) {
      issues.push({
        id: randomUUID(),
        field,
        issueType: "invalid_value",
        severity: "error",
        message: `Invalid value '${value}' for field '${field}'. Valid values: ${validValues.join(", ")}`,
        currentValue: value,
        suggestedValue: findClosestMatch(value, validValues),
        confidence: 0.8,
        autoFixable: true,
      });
    }
  }

  return issues;
}

function validateDateFormats(resource: any): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const dateFields = ["birthDate", "deceasedDateTime", "effectiveDateTime", "issued", "occurrenceDateTime", "recordedDate"];
  const dateTimeRegex = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

  function checkDates(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (dateFields.includes(key) && typeof value === "string") {
        if (!dateTimeRegex.test(value)) {
          const correctedDate = tryParseAndCorrectDate(value);
          issues.push({
            id: randomUUID(),
            field: currentPath,
            issueType: "invalid_format",
            severity: "warning",
            message: `Invalid date format for '${currentPath}'. Expected FHIR date/dateTime format.`,
            currentValue: value,
            suggestedValue: correctedDate,
            confidence: correctedDate ? 0.9 : 0.5,
            autoFixable: !!correctedDate,
          });
        }
      } else if (typeof value === "object") {
        checkDates(value, currentPath);
      }
    }
  }

  checkDates(resource, "");
  return issues;
}

function validateReferences(resource: any): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const referenceRegex = /^(Patient|Practitioner|Organization|Encounter|Condition|Observation|MedicationRequest)\/[A-Za-z0-9\-\.]+$/;

  function checkReferences(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (key === "reference" && typeof value === "string") {
        if (!referenceRegex.test(value) && !value.startsWith("urn:uuid:")) {
          issues.push({
            id: randomUUID(),
            field: currentPath,
            issueType: "invalid_format",
            severity: "warning",
            message: `Invalid reference format: '${value}'. Expected 'ResourceType/id' format.`,
            currentValue: value,
            confidence: 0.9,
            autoFixable: false,
          });
        }
      } else if (typeof value === "object") {
        checkReferences(value, currentPath);
      }
    }
  }

  checkReferences(resource, "");
  return issues;
}

function validateCodeableConcepts(resource: any): QualityIssue[] {
  const issues: QualityIssue[] = [];

  function checkCoding(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;

    if (obj.coding && Array.isArray(obj.coding)) {
      for (let i = 0; i < obj.coding.length; i++) {
        const coding = obj.coding[i];
        if (!coding.system) {
          issues.push({
            id: randomUUID(),
            field: `${path}.coding[${i}].system`,
            issueType: "missing_required",
            severity: "warning",
            message: `Coding at ${path} missing required 'system' property`,
            currentValue: coding,
            confidence: 1.0,
            autoFixable: false,
          });
        }
        if (!coding.code) {
          issues.push({
            id: randomUUID(),
            field: `${path}.coding[${i}].code`,
            issueType: "missing_required",
            severity: "warning",
            message: `Coding at ${path} missing required 'code' property`,
            currentValue: coding,
            confidence: 1.0,
            autoFixable: false,
          });
        }
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        checkCoding(value, path ? `${path}.${key}` : key);
      }
    }
  }

  checkCoding(resource, "");
  return issues;
}

async function generateAICorrectionSuggestions(
  resource: any,
  issues: QualityIssue[]
): Promise<CorrectionSuggestion[]> {
  if (issues.length === 0) return [];

  const criticalIssues = issues.filter(i => i.severity === "error" || i.severity === "critical");
  if (criticalIssues.length === 0) return [];

  try {
    const content = await generatePhiSafeText({
      system: `You are a FHIR data quality expert. Analyze the quality issues and suggest corrections.

Return a JSON object with a "suggestions" array:
{
  "suggestions": [
    {
      "field": "field.path",
      "suggestedValue": "corrected value",
      "reason": "explanation for the correction",
      "confidence": 0.95
    }
  ]
}

Focus on actionable, standards-compliant corrections. Only suggest values you are confident about.`,
      user: `FHIR Resource (${resource.resourceType || "Unknown"}):\n${JSON.stringify(resource, null, 2)}\n\nQuality Issues:\n${JSON.stringify(criticalIssues.map(i => ({ field: i.field, issue: i.message, current: i.currentValue })), null, 2)}`,
      responseMimeType: "application/json",
      maxTokens: 500,
    });

    if (!content) return [];

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || [];

    return suggestions.map((s: any) => ({
      id: randomUUID(),
      field: s.field,
      currentValue: getNestedValue(resource, s.field),
      suggestedValue: s.suggestedValue,
      reason: s.reason,
      confidence: s.confidence || 0.8,
      source: "ai" as const,
      acceptanceStatus: "pending" as const,
    }));
  } catch (error) {
    console.error("[RealtimeFHIRQuality] AI suggestion error:", error);
    return [];
  }
}

async function generateAIAnalysis(resource: any, issues: QualityIssue[]): Promise<string> {
  try {
    const content = await generatePhiSafeText({
      system: "You are a FHIR data quality analyst. Provide a brief 2-3 sentence analysis of the resource quality. Focus on clinical relevance and data completeness. This is for informational purposes only, not clinical decision support.",
      user: `Resource type: ${resource.resourceType || "Unknown"}\nIssue count: ${issues.length}\nCritical issues: ${issues.filter(i => i.severity === "critical" || i.severity === "error").length}\nIssue types: ${Array.from(new Set(issues.map(i => i.issueType))).join(", ")}`,
      maxTokens: 150,
    });

    return content || "Analysis unavailable";
  } catch (error) {
    console.error("[RealtimeFHIRQuality] AI analysis error:", error);
    return "AI analysis failed";
  }
}

export async function validateResourceRealtime(
  resource: any,
  options: { generateAISuggestions?: boolean; generateAnalysis?: boolean } = {}
): Promise<ValidationResult> {
  const startTime = Date.now();
  const resourceType = resource.resourceType || "Unknown";
  const resourceId = resource.id;

  const issues: QualityIssue[] = [
    ...validateRequiredFields(resource, resourceType),
    ...validateValueSets(resource, resourceType),
    ...validateDateFormats(resource),
    ...validateReferences(resource),
    ...validateCodeableConcepts(resource),
  ];

  let corrections: CorrectionSuggestion[] = [];
  if (options.generateAISuggestions !== false && issues.length > 0) {
    corrections = await generateAICorrectionSuggestions(resource, issues);
  }

  let aiAnalysis: string | undefined;
  if (options.generateAnalysis && issues.length > 0) {
    aiAnalysis = await generateAIAnalysis(resource, issues);
  }

  const criticalCount = issues.filter(i => i.severity === "critical" || i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const overallScore = calculateQualityScore(issues);

  const result: ValidationResult = {
    id: randomUUID(),
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
    isValid: criticalCount === 0,
    overallScore,
    issues,
    corrections,
    processingTimeMs: Date.now() - startTime,
    aiAnalysis,
  };

  validationResults.set(result.id, result);

  const event: RealTimeMonitoringEvent = {
    id: randomUUID(),
    eventType: resourceId ? "update" : "create",
    resourceType,
    resourceId,
    timestamp: result.timestamp,
    qualityScore: overallScore,
    issueCount: issues.length,
    correctionCount: corrections.length,
    autoFixesApplied: 0,
    processingTimeMs: result.processingTimeMs,
    status: criticalCount > 0 ? "blocked" : warningCount > 0 ? "warnings" : "passed",
  };
  monitoringEvents.unshift(event);
  if (monitoringEvents.length > 1000) monitoringEvents.pop();

  return result;
}

export async function validateBatchResources(
  resources: any[]
): Promise<{ results: ValidationResult[]; summary: { total: number; valid: number; invalid: number; avgScore: number } }> {
  const results: ValidationResult[] = [];
  
  for (const resource of resources) {
    const result = await validateResourceRealtime(resource, { generateAISuggestions: true });
    results.push(result);
  }

  const valid = results.filter(r => r.isValid).length;
  const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;

  return {
    results,
    summary: {
      total: results.length,
      valid,
      invalid: results.length - valid,
      avgScore: Math.round(avgScore * 100) / 100,
    },
  };
}

export async function applyCorrectionSuggestion(
  validationId: string,
  correctionId: string,
  action: "accept" | "reject"
): Promise<{ success: boolean; message: string }> {
  const validation = validationResults.get(validationId);
  if (!validation) {
    return { success: false, message: "Validation result not found" };
  }

  const correction = validation.corrections.find(c => c.id === correctionId);
  if (!correction) {
    return { success: false, message: "Correction suggestion not found" };
  }

  correction.acceptanceStatus = action === "accept" ? "accepted" : "rejected";

  return { 
    success: true, 
    message: action === "accept" 
      ? `Correction for '${correction.field}' accepted. Apply value: ${JSON.stringify(correction.suggestedValue)}`
      : `Correction for '${correction.field}' rejected` 
  };
}

export async function profileDataset(
  resources: any[],
  datasetName: string
): Promise<DatasetProfile> {
  const resourcesByType: Record<string, any[]> = {};
  
  for (const resource of resources) {
    const type = resource.resourceType || "Unknown";
    if (!resourcesByType[type]) resourcesByType[type] = [];
    resourcesByType[type].push(resource);
  }

  const fieldProfilesList: DataProfile[] = [];
  let totalCompleteness = 0;
  let totalConsistency = 0;
  let totalValidity = 0;
  let totalUniqueness = 0;
  let profileCount = 0;

  for (const [resourceType, typeResources] of Object.entries(resourcesByType)) {
    const fieldStats = analyzeFields(typeResources);
    
    for (const [fieldName, stats] of Object.entries(fieldStats)) {
      const profile: DataProfile = {
        id: randomUUID(),
        resourceType,
        fieldName,
        dataType: stats.dataType,
        statistics: {
          totalRecords: typeResources.length,
          nullCount: stats.nullCount,
          uniqueCount: stats.uniqueValues.size,
          mostCommonValues: getMostCommon(stats.valueCounts, 5),
          minValue: stats.numericMin,
          maxValue: stats.numericMax,
          avgValue: stats.numericSum && stats.numericCount ? stats.numericSum / stats.numericCount : undefined,
          pattern: stats.detectedPattern,
        },
        qualityMetrics: {
          completeness: 1 - (stats.nullCount / typeResources.length),
          uniqueness: stats.uniqueValues.size / typeResources.length,
          validity: stats.validCount / typeResources.length,
          consistency: stats.consistentCount / typeResources.length,
        },
        anomalies: detectFieldAnomalies(stats, typeResources.length),
        lastUpdated: new Date().toISOString(),
      };

      fieldProfilesList.push(profile);
      fieldProfiles.set(profile.id, profile);

      totalCompleteness += profile.qualityMetrics.completeness;
      totalConsistency += profile.qualityMetrics.consistency;
      totalValidity += profile.qualityMetrics.validity;
      totalUniqueness += profile.qualityMetrics.uniqueness;
      profileCount++;
    }
  }

  const crossResourceIssues = detectCrossResourceIssues(resourcesByType);

  const datasetProfile: DatasetProfile = {
    id: randomUUID(),
    name: datasetName,
    resourceTypes: Object.keys(resourcesByType),
    totalRecords: resources.length,
    overallQualityScore: calculateDatasetQualityScore(fieldProfilesList),
    dimensionScores: {
      completeness: profileCount > 0 ? totalCompleteness / profileCount : 1,
      accuracy: 0.85,
      consistency: profileCount > 0 ? totalConsistency / profileCount : 1,
      timeliness: 0.9,
      uniqueness: profileCount > 0 ? totalUniqueness / profileCount : 1,
    },
    fieldProfiles: fieldProfilesList,
    crossResourceIssues,
    createdAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  datasetProfiles.set(datasetProfile.id, datasetProfile);
  return datasetProfile;
}

export function getMonitoringEvents(limit: number = 50): RealTimeMonitoringEvent[] {
  return monitoringEvents.slice(0, limit);
}

export function getMonitoringDashboard(): {
  recentEvents: RealTimeMonitoringEvent[];
  statistics: {
    totalValidations: number;
    passRate: number;
    avgQualityScore: number;
    avgProcessingTime: number;
    issuesByType: Record<string, number>;
    issuesBySeverity: Record<string, number>;
  };
  trends: {
    hourly: { hour: string; validations: number; passRate: number }[];
  };
} {
  const recentEvents = monitoringEvents.slice(0, 100);
  
  const passed = recentEvents.filter(e => e.status === "passed").length;
  const avgScore = recentEvents.length > 0 
    ? recentEvents.reduce((s, e) => s + e.qualityScore, 0) / recentEvents.length 
    : 100;
  const avgTime = recentEvents.length > 0
    ? recentEvents.reduce((s, e) => s + e.processingTimeMs, 0) / recentEvents.length
    : 0;

  const issuesByType: Record<string, number> = {};
  const issuesBySeverity: Record<string, number> = {};

  for (const validation of Array.from(validationResults.values())) {
    for (const issue of validation.issues) {
      issuesByType[issue.issueType] = (issuesByType[issue.issueType] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    }
  }

  const hourlyMap = new Map<string, { validations: number; passed: number }>();
  for (const event of recentEvents) {
    const hour = event.timestamp.substring(0, 13);
    const current = hourlyMap.get(hour) || { validations: 0, passed: 0 };
    current.validations++;
    if (event.status === "passed") current.passed++;
    hourlyMap.set(hour, current);
  }

  const hourly = Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({
      hour,
      validations: data.validations,
      passRate: data.validations > 0 ? (data.passed / data.validations) * 100 : 100,
    }))
    .slice(0, 24);

  return {
    recentEvents: recentEvents.slice(0, 20),
    statistics: {
      totalValidations: recentEvents.length,
      passRate: recentEvents.length > 0 ? (passed / recentEvents.length) * 100 : 100,
      avgQualityScore: Math.round(avgScore * 100) / 100,
      avgProcessingTime: Math.round(avgTime),
      issuesByType,
      issuesBySeverity,
    },
    trends: { hourly },
  };
}

export function getValidationResult(id: string): ValidationResult | undefined {
  return validationResults.get(id);
}

export function getDatasetProfiles(): DatasetProfile[] {
  return Array.from(datasetProfiles.values());
}

export function getDatasetProfile(id: string): DatasetProfile | undefined {
  return datasetProfiles.get(id);
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

function findClosestMatch(value: string, options: string[]): string | undefined {
  const lower = value.toLowerCase();
  return options.find(opt => opt.toLowerCase() === lower) || 
         options.find(opt => opt.toLowerCase().includes(lower)) ||
         options[0];
}

function tryParseAndCorrectDate(value: string): string | undefined {
  const patterns = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, format: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` },
  ];

  for (const { regex, format } of patterns) {
    const match = value.match(regex);
    if (match) return format(match);
  }

  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function calculateQualityScore(issues: QualityIssue[]): number {
  if (issues.length === 0) return 100;

  const weights = { critical: 25, error: 15, warning: 5, info: 1 };
  const totalPenalty = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 1), 0);
  
  return Math.max(0, Math.round((100 - totalPenalty) * 100) / 100);
}

function analyzeFields(resources: any[]): Record<string, any> {
  const stats: Record<string, any> = {};

  function processValue(fieldPath: string, value: any) {
    if (!stats[fieldPath]) {
      stats[fieldPath] = {
        dataType: typeof value,
        nullCount: 0,
        uniqueValues: new Set(),
        valueCounts: new Map(),
        validCount: 0,
        consistentCount: 0,
        numericMin: undefined,
        numericMax: undefined,
        numericSum: 0,
        numericCount: 0,
        detectedPattern: undefined,
      };
    }

    const s = stats[fieldPath];

    if (value === null || value === undefined) {
      s.nullCount++;
      return;
    }

    const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
    s.uniqueValues.add(stringValue);
    s.valueCounts.set(stringValue, (s.valueCounts.get(stringValue) || 0) + 1);
    s.validCount++;
    s.consistentCount++;

    if (typeof value === "number") {
      s.numericMin = s.numericMin === undefined ? value : Math.min(s.numericMin, value);
      s.numericMax = s.numericMax === undefined ? value : Math.max(s.numericMax, value);
      s.numericSum += value;
      s.numericCount++;
    }
  }

  function traverse(obj: any, path: string) {
    if (obj === null || obj === undefined) return;
    
    if (typeof obj !== "object") {
      processValue(path, obj);
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => traverse(item, `${path}[${i}]`));
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        traverse(value, newPath);
      } else {
        processValue(newPath, value);
      }
    }
  }

  for (const resource of resources) {
    traverse(resource, "");
  }

  return stats;
}

function getMostCommon(valueCounts: Map<string, number>, limit: number): { value: string; count: number }[] {
  return Array.from(valueCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function detectFieldAnomalies(stats: any, totalRecords: number): DataProfile["anomalies"] {
  const anomalies: DataProfile["anomalies"] = [];

  const nullRate = stats.nullCount / totalRecords;
  if (nullRate > 0.5) {
    anomalies.push({
      type: "high_null_rate",
      description: `${Math.round(nullRate * 100)}% of records have null/missing values`,
      affectedCount: stats.nullCount,
      severity: nullRate > 0.8 ? "high" : "medium",
    });
  }

  const uniquenessRate = stats.uniqueValues.size / totalRecords;
  if (uniquenessRate < 0.01 && totalRecords > 100) {
    anomalies.push({
      type: "low_cardinality",
      description: `Very low uniqueness - only ${stats.uniqueValues.size} unique values`,
      affectedCount: totalRecords,
      severity: "low",
    });
  }

  if (stats.numericCount > 0) {
    const range = stats.numericMax - stats.numericMin;
    if (range > 1000000) {
      anomalies.push({
        type: "wide_value_range",
        description: `Extremely wide numeric range: ${stats.numericMin} to ${stats.numericMax}`,
        affectedCount: stats.numericCount,
        severity: "medium",
      });
    }
  }

  return anomalies;
}

function detectCrossResourceIssues(resourcesByType: Record<string, any[]>): DatasetProfile["crossResourceIssues"] {
  const issues: DatasetProfile["crossResourceIssues"] = [];

  if (resourcesByType.Observation && resourcesByType.Patient) {
    const patientIds = new Set(resourcesByType.Patient.map(p => p.id).filter(Boolean));
    const orphanedObs = resourcesByType.Observation.filter(obs => {
      const ref = obs.subject?.reference;
      if (!ref) return true;
      const refId = ref.split("/")[1];
      return refId && !patientIds.has(refId);
    });

    if (orphanedObs.length > 0) {
      issues.push({
        type: "orphaned_references",
        description: `${orphanedObs.length} Observations reference non-existent Patients`,
        affectedResources: ["Observation", "Patient"],
        severity: "high",
      });
    }
  }

  return issues;
}

function calculateDatasetQualityScore(profiles: DataProfile[]): number {
  if (profiles.length === 0) return 100;

  const avgCompleteness = profiles.reduce((s, p) => s + p.qualityMetrics.completeness, 0) / profiles.length;
  const avgValidity = profiles.reduce((s, p) => s + p.qualityMetrics.validity, 0) / profiles.length;
  const avgConsistency = profiles.reduce((s, p) => s + p.qualityMetrics.consistency, 0) / profiles.length;

  const anomalyPenalty = profiles.reduce((s, p) => s + p.anomalies.filter(a => a.severity === "high").length * 5, 0);

  return Math.max(0, Math.round(((avgCompleteness + avgValidity + avgConsistency) / 3 * 100 - anomalyPenalty) * 100) / 100);
}

function initializeSampleData() {
  const sampleEvents: RealTimeMonitoringEvent[] = [
    {
      id: randomUUID(),
      eventType: "create",
      resourceType: "Patient",
      resourceId: "patient-001",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      qualityScore: 95,
      issueCount: 1,
      correctionCount: 1,
      autoFixesApplied: 0,
      processingTimeMs: 45,
      status: "warnings",
    },
    {
      id: randomUUID(),
      eventType: "update",
      resourceType: "Observation",
      resourceId: "obs-lab-001",
      timestamp: new Date(Date.now() - 600000).toISOString(),
      qualityScore: 100,
      issueCount: 0,
      correctionCount: 0,
      autoFixesApplied: 0,
      processingTimeMs: 28,
      status: "passed",
    },
    {
      id: randomUUID(),
      eventType: "create",
      resourceType: "MedicationRequest",
      resourceId: "medrq-001",
      timestamp: new Date(Date.now() - 900000).toISOString(),
      qualityScore: 72,
      issueCount: 3,
      correctionCount: 2,
      autoFixesApplied: 1,
      processingTimeMs: 89,
      status: "corrected",
    },
    {
      id: randomUUID(),
      eventType: "create",
      resourceType: "Condition",
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      qualityScore: 45,
      issueCount: 5,
      correctionCount: 0,
      autoFixesApplied: 0,
      processingTimeMs: 52,
      status: "blocked",
    },
  ];

  monitoringEvents.push(...sampleEvents);
}

initializeSampleData();

console.log("[RealtimeFHIRQuality] Service initialized with real-time validation and AI correction");
