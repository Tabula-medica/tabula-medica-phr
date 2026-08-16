import { generatePhiSafeText } from "./ai-gateway";
import crypto from "crypto";

const aiEnabled = true;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data harmonization assistant. You provide ONLY:
- Data inconsistency detection and reporting
- Harmonization rule suggestions
- Conflict resolution recommendations based on data quality metrics
- Source reliability assessments

CRITICAL: You must NEVER provide:
- Clinical diagnoses or recommendations
- Treatment suggestions
- Medical advice of any kind
- Clinical interpretations of data

All outputs must include explicit NO-CDS disclaimers.`;

export interface DataInconsistency {
  id: string;
  resourceType: string;
  resourceId: string;
  fieldPath: string;
  sources: {
    sourceId: string;
    sourceSystem: string;
    value: any;
    timestamp: Date;
    confidenceScore: number;
  }[];
  inconsistencyType: "value_mismatch" | "format_difference" | "missing_data" | "temporal_conflict" | "semantic_difference" | "unit_mismatch";
  severity: "low" | "medium" | "high" | "critical";
  detectedAt: Date;
  status: "pending" | "resolved" | "ignored" | "escalated";
  resolvedValue?: any;
  resolutionMethod?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface HarmonizationRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  fieldPath: string;
  ruleType: "source_priority" | "most_recent" | "highest_confidence" | "majority_vote" | "custom_logic" | "ai_suggested";
  priority: number;
  isActive: boolean;
  configuration: {
    sourcePriority?: string[];
    confidenceThreshold?: number;
    customLogic?: string;
    votingThreshold?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  appliedCount: number;
  successRate: number;
}

export interface ConflictResolution {
  id: string;
  inconsistencyId: string;
  ruleId?: string;
  resolvedValue: any;
  resolutionMethod: "automatic" | "manual" | "ai_assisted";
  confidence: number;
  reasoning: string;
  appliedAt: Date;
  appliedBy: string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface HarmonizationSuggestion {
  id: string;
  targetInconsistency: string;
  suggestedRule: Partial<HarmonizationRule>;
  suggestedValue: any;
  confidence: number;
  reasoning: string;
  alternativeValues: { value: any; confidence: number; source: string }[];
  generatedAt: Date;
  noCdsCompliance: string;
}

export interface SourceReliability {
  sourceId: string;
  sourceSystem: string;
  overallReliability: number;
  fieldReliability: Record<string, number>;
  lastAssessment: Date;
  totalRecords: number;
  conflictRate: number;
  updateFrequency: "real-time" | "daily" | "weekly" | "monthly" | "irregular";
}

const inconsistencies: Map<string, DataInconsistency> = new Map();
const harmonizationRules: Map<string, HarmonizationRule> = new Map();
const resolutions: Map<string, ConflictResolution> = new Map();
const sourceReliability: Map<string, SourceReliability> = new Map();

function initializeSampleData(): void {
  const rule1: HarmonizationRule = {
    id: "rule-source-priority",
    name: "EHR Source Priority",
    description: "Prioritize EHR systems over claims and wearable data for clinical fields",
    resourceType: "Patient",
    fieldPath: "*",
    ruleType: "source_priority",
    priority: 1,
    isActive: true,
    configuration: {
      sourcePriority: ["Fasten Health", "local"]
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    createdBy: "system",
    appliedCount: 1250,
    successRate: 97.5
  };

  const rule2: HarmonizationRule = {
    id: "rule-lab-most-recent",
    name: "Lab Results Most Recent",
    description: "Use most recent lab result when multiple sources report different values",
    resourceType: "Observation",
    fieldPath: "valueQuantity.value",
    ruleType: "most_recent",
    priority: 2,
    isActive: true,
    configuration: {},
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    createdBy: "system",
    appliedCount: 890,
    successRate: 99.1
  };

  const rule3: HarmonizationRule = {
    id: "rule-confidence-threshold",
    name: "High Confidence Selection",
    description: "Select value with highest confidence score above threshold",
    resourceType: "*",
    fieldPath: "*",
    ruleType: "highest_confidence",
    priority: 3,
    isActive: true,
    configuration: {
      confidenceThreshold: 0.85
    },
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    createdBy: "system",
    appliedCount: 567,
    successRate: 94.8
  };

  const rule4: HarmonizationRule = {
    id: "rule-medication-majority",
    name: "Medication Majority Vote",
    description: "Use majority vote for medication status when sources disagree",
    resourceType: "MedicationRequest",
    fieldPath: "status",
    ruleType: "majority_vote",
    priority: 2,
    isActive: true,
    configuration: {
      votingThreshold: 0.6
    },
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
    createdBy: "system",
    appliedCount: 234,
    successRate: 92.3
  };

  harmonizationRules.set(rule1.id, rule1);
  harmonizationRules.set(rule2.id, rule2);
  harmonizationRules.set(rule3.id, rule3);
  harmonizationRules.set(rule4.id, rule4);

  const inconsistency1: DataInconsistency = {
    id: "inc-001",
    resourceType: "Condition",
    resourceId: "cond-patient001-hypertension",
    fieldPath: "onsetDateTime",
    sources: [
      { sourceId: "epic-001", sourceSystem: "Primary Care Provider", value: "2018-03-15", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), confidenceScore: 0.95 },
      { sourceId: "cerner-001", sourceSystem: "Hospital Network", value: "2017-11-20", timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), confidenceScore: 0.88 }
    ],
    inconsistencyType: "value_mismatch",
    severity: "medium",
    detectedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: "pending"
  };

  const inconsistency2: DataInconsistency = {
    id: "inc-002",
    resourceType: "Observation",
    resourceId: "obs-patient001-heartrate",
    fieldPath: "valueQuantity.value",
    sources: [
      { sourceId: "epic-001", sourceSystem: "Primary Care Provider", value: 72, timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), confidenceScore: 0.98 },
      { sourceId: "healthkit-001", sourceSystem: "Apple HealthKit", value: 78, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), confidenceScore: 0.75 }
    ],
    inconsistencyType: "value_mismatch",
    severity: "low",
    detectedAt: new Date(Date.now() - 30 * 60 * 1000),
    status: "pending"
  };

  const inconsistency3: DataInconsistency = {
    id: "inc-003",
    resourceType: "MedicationRequest",
    resourceId: "med-patient001-metformin",
    fieldPath: "dosageInstruction[0].doseAndRate[0].doseQuantity.value",
    sources: [
      { sourceId: "epic-001", sourceSystem: "Primary Care Provider", value: 500, timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), confidenceScore: 0.92 },
      { sourceId: "cvs-001", sourceSystem: "CVS Pharmacy", value: 1000, timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), confidenceScore: 0.96 }
    ],
    inconsistencyType: "value_mismatch",
    severity: "high",
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "pending"
  };

  const inconsistency4: DataInconsistency = {
    id: "inc-004",
    resourceType: "Patient",
    resourceId: "patient-001",
    fieldPath: "telecom[0].value",
    sources: [
      { sourceId: "epic-001", sourceSystem: "Primary Care Provider", value: "(555) 123-4567", timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000), confidenceScore: 0.90 },
      { sourceId: "cerner-001", sourceSystem: "Hospital Network", value: "555-123-4567", timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), confidenceScore: 0.90 }
    ],
    inconsistencyType: "format_difference",
    severity: "low",
    detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "pending"
  };

  inconsistencies.set(inconsistency1.id, inconsistency1);
  inconsistencies.set(inconsistency2.id, inconsistency2);
  inconsistencies.set(inconsistency3.id, inconsistency3);
  inconsistencies.set(inconsistency4.id, inconsistency4);

  const reliability1: SourceReliability = {
    sourceId: "epic-001",
    sourceSystem: "Primary Care Provider",
    overallReliability: 0.96,
    fieldReliability: {
      "Patient.name": 0.99,
      "Patient.birthDate": 0.99,
      "Condition.code": 0.95,
      "Observation.value": 0.94
    },
    lastAssessment: new Date(),
    totalRecords: 15000,
    conflictRate: 0.02,
    updateFrequency: "real-time"
  };

  const reliability2: SourceReliability = {
    sourceId: "healthkit-001",
    sourceSystem: "Apple HealthKit",
    overallReliability: 0.78,
    fieldReliability: {
      "Observation.value": 0.75,
      "Observation.effectiveDateTime": 0.95
    },
    lastAssessment: new Date(),
    totalRecords: 50000,
    conflictRate: 0.08,
    updateFrequency: "real-time"
  };

  sourceReliability.set(reliability1.sourceId, reliability1);
  sourceReliability.set(reliability2.sourceId, reliability2);
}

initializeSampleData();

export function getInconsistencies(filters?: {
  status?: string;
  severity?: string;
  resourceType?: string;
}): DataInconsistency[] {
  let result = Array.from(inconsistencies.values());

  if (filters?.status) {
    result = result.filter(i => i.status === filters.status);
  }
  if (filters?.severity) {
    result = result.filter(i => i.severity === filters.severity);
  }
  if (filters?.resourceType) {
    result = result.filter(i => i.resourceType === filters.resourceType);
  }

  return result.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getInconsistency(id: string): DataInconsistency | undefined {
  return inconsistencies.get(id);
}

export function getHarmonizationRules(filters?: {
  resourceType?: string;
  isActive?: boolean;
}): HarmonizationRule[] {
  let result = Array.from(harmonizationRules.values());

  if (filters?.resourceType) {
    result = result.filter(r => r.resourceType === filters.resourceType || r.resourceType === "*");
  }
  if (filters?.isActive !== undefined) {
    result = result.filter(r => r.isActive === filters.isActive);
  }

  return result.sort((a, b) => a.priority - b.priority);
}

export function getHarmonizationRule(id: string): HarmonizationRule | undefined {
  return harmonizationRules.get(id);
}

export function createHarmonizationRule(rule: Omit<HarmonizationRule, "id" | "createdAt" | "updatedAt" | "appliedCount" | "successRate">): HarmonizationRule {
  const newRule: HarmonizationRule = {
    ...rule,
    id: `rule-${crypto.randomBytes(4).toString("hex")}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    appliedCount: 0,
    successRate: 0
  };

  harmonizationRules.set(newRule.id, newRule);
  return newRule;
}

export function updateHarmonizationRule(id: string, updates: Partial<HarmonizationRule>): HarmonizationRule | null {
  const rule = harmonizationRules.get(id);
  if (!rule) return null;

  const updatedRule = {
    ...rule,
    ...updates,
    id: rule.id,
    createdAt: rule.createdAt,
    updatedAt: new Date()
  };

  harmonizationRules.set(id, updatedRule);
  return updatedRule;
}

export function deleteHarmonizationRule(id: string): boolean {
  return harmonizationRules.delete(id);
}

export async function resolveInconsistency(
  inconsistencyId: string,
  resolution: {
    ruleId?: string;
    resolvedValue: any;
    resolutionMethod: "automatic" | "manual" | "ai_assisted";
    reasoning: string;
    appliedBy: string;
  }
): Promise<ConflictResolution | null> {
  const inconsistency = inconsistencies.get(inconsistencyId);
  if (!inconsistency) return null;

  const conflictResolution: ConflictResolution = {
    id: `res-${crypto.randomBytes(4).toString("hex")}`,
    inconsistencyId,
    ruleId: resolution.ruleId,
    resolvedValue: resolution.resolvedValue,
    resolutionMethod: resolution.resolutionMethod,
    confidence: calculateResolutionConfidence(inconsistency, resolution.resolvedValue),
    reasoning: resolution.reasoning,
    appliedAt: new Date(),
    appliedBy: resolution.appliedBy,
    verified: false
  };

  resolutions.set(conflictResolution.id, conflictResolution);

  inconsistency.status = "resolved";
  inconsistency.resolvedValue = resolution.resolvedValue;
  inconsistency.resolutionMethod = resolution.resolutionMethod;
  inconsistency.resolvedAt = new Date();
  inconsistency.resolvedBy = resolution.appliedBy;

  if (resolution.ruleId) {
    const rule = harmonizationRules.get(resolution.ruleId);
    if (rule) {
      rule.appliedCount++;
      rule.updatedAt = new Date();
    }
  }

  return conflictResolution;
}

function calculateResolutionConfidence(inconsistency: DataInconsistency, resolvedValue: any): number {
  const matchingSource = inconsistency.sources.find(s => s.value === resolvedValue);
  if (matchingSource) {
    return matchingSource.confidenceScore;
  }
  return 0.75;
}

export async function generateHarmonizationSuggestion(inconsistencyId: string): Promise<HarmonizationSuggestion | null> {
  const inconsistency = inconsistencies.get(inconsistencyId);
  if (!inconsistency) return null;

  const sortedSources = [...inconsistency.sources].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const highestConfidenceSource = sortedSources[0];

  let suggestedValue = highestConfidenceSource.value;
  let confidence = highestConfidenceSource.confidenceScore;
  let reasoning = `Selected value from ${highestConfidenceSource.sourceSystem} with highest confidence score (${(confidence * 100).toFixed(1)}%).`;

  if (inconsistency.inconsistencyType === "format_difference") {
    reasoning = `Format difference detected. Values appear semantically equivalent. Normalized to standard format.`;
    confidence = 0.95;
  }

  const applicableRules = getHarmonizationRules({ resourceType: inconsistency.resourceType, isActive: true });
  let suggestedRule: Partial<HarmonizationRule> | undefined;

  if (applicableRules.length > 0) {
    const bestRule = applicableRules[0];
    suggestedRule = {
      id: bestRule.id,
      name: bestRule.name,
      ruleType: bestRule.ruleType
    };

    if (bestRule.ruleType === "source_priority" && bestRule.configuration.sourcePriority) {
      const prioritizedSource = inconsistency.sources.find(s =>
        bestRule.configuration.sourcePriority!.includes(s.sourceSystem)
      );
      if (prioritizedSource) {
        suggestedValue = prioritizedSource.value;
        confidence = prioritizedSource.confidenceScore;
        reasoning = `Applied source priority rule. Selected ${prioritizedSource.sourceSystem} as highest priority source.`;
      }
    } else if (bestRule.ruleType === "most_recent") {
      const mostRecentSource = [...inconsistency.sources].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      suggestedValue = mostRecentSource.value;
      confidence = mostRecentSource.confidenceScore * 0.95;
      reasoning = `Applied most recent rule. Selected value from ${mostRecentSource.sourceSystem} (${mostRecentSource.timestamp.toISOString()}).`;
    }
  }

  try {
    const aiSuggestion = await getAISuggestion(inconsistency);
    if (aiSuggestion) {
      if (aiSuggestion.confidence > confidence) {
        suggestedValue = aiSuggestion.value;
        confidence = aiSuggestion.confidence;
        reasoning = aiSuggestion.reasoning;
      }
    }
  } catch (error) {
    console.log("[Harmonization] AI suggestion unavailable, using rule-based");
  }

  const suggestion: HarmonizationSuggestion = {
    id: `sug-${crypto.randomBytes(4).toString("hex")}`,
    targetInconsistency: inconsistencyId,
    suggestedRule: suggestedRule || {},
    suggestedValue,
    confidence,
    reasoning,
    alternativeValues: sortedSources.map(s => ({
      value: s.value,
      confidence: s.confidenceScore,
      source: s.sourceSystem
    })),
    generatedAt: new Date(),
    noCdsCompliance: "Harmonization suggestion for data quality only. Not for clinical decision-making."
  };

  return suggestion;
}

async function getAISuggestion(inconsistency: DataInconsistency): Promise<{ value: any; confidence: number; reasoning: string } | null> {
  if (!aiEnabled) {
    return null;
  }

  const prompt = `Analyze this data inconsistency and suggest the best resolution (data quality decision ONLY, no clinical interpretation):

Resource Type: ${inconsistency.resourceType}
Field: ${inconsistency.fieldPath}
Inconsistency Type: ${inconsistency.inconsistencyType}
Values from sources:
${inconsistency.sources.map(s => `- ${s.sourceSystem}: ${JSON.stringify(s.value)} (confidence: ${s.confidenceScore}, updated: ${s.timestamp})`).join("\n")}

Provide a JSON response with:
- value: the recommended resolved value
- confidence: confidence score 0-1
- reasoning: explanation of why this value was selected (data quality reasoning only)`;

  const content = await generatePhiSafeText({
    system: NO_CDS_SYSTEM_PROMPT,
    user: prompt,
    responseMimeType: "application/json",
    maxTokens: 300
  });

  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function detectInconsistencies(resources: any[]): Promise<DataInconsistency[]> {
  const detected: DataInconsistency[] = [];

  const resourceGroups = new Map<string, any[]>();
  for (const resource of resources) {
    const key = `${resource.resourceType}-${resource.id}`;
    if (!resourceGroups.has(key)) {
      resourceGroups.set(key, []);
    }
    resourceGroups.get(key)!.push(resource);
  }

  for (const [_key, group] of Array.from(resourceGroups.entries())) {
    if (group.length < 2) continue;

    const fields = collectFields(group[0]);
    for (const fieldPath of fields) {
      const values = group.map((r: any) => ({
        source: r.meta?.source || "unknown",
        value: getNestedValue(r, fieldPath),
        timestamp: new Date(r.meta?.lastUpdated || Date.now()),
        confidence: r.meta?.confidence || 0.85
      }));

      const uniqueValues = new Set(values.map((v: { value: any }) => JSON.stringify(v.value)));
      if (uniqueValues.size > 1) {
        const inconsistency: DataInconsistency = {
          id: `inc-${crypto.randomBytes(4).toString("hex")}`,
          resourceType: group[0].resourceType,
          resourceId: group[0].id,
          fieldPath,
          sources: values.map((v: { source: string; value: any; timestamp: Date; confidence: number }) => ({
            sourceId: `src-${crypto.randomBytes(2).toString("hex")}`,
            sourceSystem: v.source,
            value: v.value,
            timestamp: v.timestamp,
            confidenceScore: v.confidence
          })),
          inconsistencyType: detectInconsistencyType(values),
          severity: determineSeverity(group[0].resourceType, fieldPath),
          detectedAt: new Date(),
          status: "pending"
        };

        detected.push(inconsistency);
        inconsistencies.set(inconsistency.id, inconsistency);
      }
    }
  }

  return detected;
}

function collectFields(obj: any, prefix = ""): string[] {
  const fields: string[] = [];
  for (const key of Object.keys(obj)) {
    if (["id", "meta", "resourceType"].includes(key)) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      fields.push(...collectFields(obj[key], path));
    } else {
      fields.push(path);
    }
  }
  return fields;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function detectInconsistencyType(values: { value: any }[]): DataInconsistency["inconsistencyType"] {
  const stringValues = values.map(v => String(v.value));
  const normalized = stringValues.map(s => s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase());

  if (new Set(normalized).size === 1) {
    return "format_difference";
  }

  return "value_mismatch";
}

function determineSeverity(resourceType: string, fieldPath: string): DataInconsistency["severity"] {
  const criticalFields = ["MedicationRequest.dosageInstruction", "AllergyIntolerance.code", "Condition.code"];
  const highFields = ["Patient.birthDate", "Patient.identifier", "Observation.value"];

  const fullPath = `${resourceType}.${fieldPath}`;

  if (criticalFields.some(f => fullPath.startsWith(f))) return "critical";
  if (highFields.some(f => fullPath.startsWith(f))) return "high";
  if (fieldPath.includes("code") || fieldPath.includes("value")) return "medium";

  return "low";
}

export function getSourceReliabilityScores(): SourceReliability[] {
  return Array.from(sourceReliability.values());
}

export function getHarmonizationStats(): {
  totalInconsistencies: number;
  pendingInconsistencies: number;
  resolvedInconsistencies: number;
  totalRules: number;
  activeRules: number;
  averageSuccessRate: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
} {
  const allInconsistencies = Array.from(inconsistencies.values());
  const allRules = Array.from(harmonizationRules.values());
  const activeRules = allRules.filter(r => r.isActive);

  const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const byType: Record<string, number> = {};

  for (const inc of allInconsistencies) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byType[inc.inconsistencyType] = (byType[inc.inconsistencyType] || 0) + 1;
  }

  const avgSuccessRate = activeRules.length > 0
    ? activeRules.reduce((sum, r) => sum + r.successRate, 0) / activeRules.length
    : 0;

  return {
    totalInconsistencies: allInconsistencies.length,
    pendingInconsistencies: allInconsistencies.filter(i => i.status === "pending").length,
    resolvedInconsistencies: allInconsistencies.filter(i => i.status === "resolved").length,
    totalRules: allRules.length,
    activeRules: activeRules.length,
    averageSuccessRate: avgSuccessRate,
    bySeverity,
    byType
  };
}

export async function autoResolveInconsistencies(): Promise<{ resolved: number; failed: number; skipped: number }> {
  const pending = getInconsistencies({ status: "pending" });
  let resolved = 0;
  let failed = 0;
  let skipped = 0;

  for (const inconsistency of pending) {
    if (inconsistency.severity === "critical") {
      skipped++;
      continue;
    }

    try {
      const suggestion = await generateHarmonizationSuggestion(inconsistency.id);
      if (suggestion && suggestion.confidence >= 0.85) {
        await resolveInconsistency(inconsistency.id, {
          ruleId: suggestion.suggestedRule?.id,
          resolvedValue: suggestion.suggestedValue,
          resolutionMethod: "automatic",
          reasoning: suggestion.reasoning,
          appliedBy: "system"
        });
        resolved++;
      } else {
        skipped++;
      }
    } catch (error) {
      failed++;
    }
  }

  return { resolved, failed, skipped };
}
