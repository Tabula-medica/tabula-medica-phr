import { randomUUID } from "crypto";
import { getAuditLogger } from "./integrations/factory";

export interface RecordSource {
  connectionId: string;
  connectionName: string;
  resourceType: string;
  resourceId: string;
  data: Record<string, unknown>;
  receivedAt: string;
  confidence: number;
  provenance: ProvenanceInfo;
}

export interface ProvenanceInfo {
  sourceSystem: string;
  sourceVersion?: string;
  lastModified: string;
  author?: string;
  attestation?: string;
}

export interface MatchResult {
  id: string;
  matchScore: number;
  matchType: "exact" | "probable" | "possible" | "no_match";
  matchedFields: string[];
  unmatchedFields: string[];
  sources: RecordSource[];
  conflicts: FieldConflict[];
  suggestedMerge?: Record<string, unknown>;
  status: "pending" | "auto_merged" | "manual_review" | "resolved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface FieldConflict {
  fieldPath: string;
  fieldName: string;
  values: Array<{
    source: string;
    value: unknown;
    confidence: number;
    lastModified: string;
  }>;
  suggestedValue?: unknown;
  resolutionStrategy?: ResolutionStrategy;
  resolved: boolean;
  resolvedValue?: unknown;
}

export type ResolutionStrategy = 
  | "most_recent"
  | "highest_confidence"
  | "most_complete"
  | "manual"
  | "source_priority";

export interface MergeRule {
  id: string;
  name: string;
  resourceType: string;
  fieldRules: FieldMergeRule[];
  sourcePriority: string[];
  autoMergeThreshold: number;
  isActive: boolean;
  createdAt: string;
}

export interface FieldMergeRule {
  fieldPath: string;
  strategy: ResolutionStrategy;
  customPriority?: string[];
  transformBeforeMerge?: string;
}

export interface DuplicateGroup {
  id: string;
  resourceType: string;
  canonicalRecordId?: string;
  members: GroupMember[];
  matchScore: number;
  status: "identified" | "reviewing" | "merged" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  recordId: string;
  sourceConnection: string;
  matchScore: number;
  isCanonical: boolean;
  data: Record<string, unknown>;
}

const matchResults: Map<string, MatchResult> = new Map();
const mergeRules: Map<string, MergeRule> = new Map();
const duplicateGroups: Map<string, DuplicateGroup> = new Map();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logReconciliationActivity(
  action: string,
  resourceId: string,
  userId: string,
  details: Record<string, unknown>,
  ipAddress: string = "internal"
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashIdentifier(userId),
      userRole: "system",
      action: "create" as const,
      resourceType: "DataReconciliation",
      resourceId,
      patientId: hashIdentifier("system"),
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "reconciliation-service",
      requestPath: "/api/reconciliation",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        reconciliationAction: action,
        resourceIdHash: hashIdentifier(resourceId),
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[DataReconciliation] Audit logging failed:", e);
  }
}

initializeDefaultMergeRules();

function initializeDefaultMergeRules() {
  const defaultRules: Omit<MergeRule, "id" | "createdAt">[] = [
    {
      name: "Patient Demographics Merge",
      resourceType: "Patient",
      fieldRules: [
        { fieldPath: "name", strategy: "most_complete" },
        { fieldPath: "birthDate", strategy: "highest_confidence" },
        { fieldPath: "gender", strategy: "highest_confidence" },
        { fieldPath: "address", strategy: "most_recent" },
        { fieldPath: "telecom", strategy: "most_complete" },
        { fieldPath: "identifier", strategy: "most_complete" },
      ],
      sourcePriority: ["Fasten Health", "local"],
      autoMergeThreshold: 0.95,
      isActive: true,
    },
    {
      name: "Medication Merge",
      resourceType: "MedicationRequest",
      fieldRules: [
        { fieldPath: "medicationCodeableConcept", strategy: "source_priority" },
        { fieldPath: "dosageInstruction", strategy: "most_recent" },
        { fieldPath: "authoredOn", strategy: "most_recent" },
        { fieldPath: "status", strategy: "most_recent" },
      ],
      sourcePriority: ["pharmacy", "ehr", "local"],
      autoMergeThreshold: 0.9,
      isActive: true,
    },
    {
      name: "Observation Merge",
      resourceType: "Observation",
      fieldRules: [
        { fieldPath: "code", strategy: "highest_confidence" },
        { fieldPath: "value", strategy: "most_recent" },
        { fieldPath: "effectiveDateTime", strategy: "most_recent" },
        { fieldPath: "interpretation", strategy: "highest_confidence" },
      ],
      sourcePriority: ["lab", "ehr", "local"],
      autoMergeThreshold: 0.85,
      isActive: true,
    },
  ];

  defaultRules.forEach((rule) => {
    const id = randomUUID();
    mergeRules.set(id, {
      ...rule,
      id,
      createdAt: new Date().toISOString(),
    });
  });
}

export function calculateMatchScore(record1: Record<string, unknown>, record2: Record<string, unknown>, resourceType: string): number {
  let totalWeight = 0;
  let matchedWeight = 0;

  const fieldWeights: Record<string, Record<string, number>> = {
    Patient: {
      "identifier": 30,
      "name.family": 20,
      "name.given": 15,
      "birthDate": 20,
      "gender": 5,
      "telecom": 5,
      "address": 5,
    },
    MedicationRequest: {
      "medicationCodeableConcept.coding.code": 40,
      "dosageInstruction": 20,
      "status": 10,
      "authoredOn": 15,
      "subject": 15,
    },
    Observation: {
      "code.coding.code": 35,
      "effectiveDateTime": 25,
      "value": 20,
      "subject": 20,
    },
  };

  const weights = fieldWeights[resourceType] || { "id": 100 };

  for (const [field, weight] of Object.entries(weights)) {
    totalWeight += weight;
    const value1 = getNestedValue(record1, field);
    const value2 = getNestedValue(record2, field);
    
    if (value1 && value2) {
      if (typeof value1 === "string" && typeof value2 === "string") {
        const similarity = calculateStringSimilarity(value1.toLowerCase(), value2.toLowerCase());
        matchedWeight += weight * similarity;
      } else if (JSON.stringify(value1) === JSON.stringify(value2)) {
        matchedWeight += weight;
      } else if (typeof value1 === "object" && typeof value2 === "object") {
        matchedWeight += weight * 0.5;
      }
    }
  }

  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

export async function findMatches(
  newRecord: RecordSource,
  existingRecords: RecordSource[],
  userId: string,
  ipAddress: string
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const existing of existingRecords) {
    if (existing.resourceType !== newRecord.resourceType) continue;
    if (existing.connectionId === newRecord.connectionId && existing.resourceId === newRecord.resourceId) continue;

    const matchScore = calculateMatchScore(
      newRecord.data,
      existing.data,
      newRecord.resourceType
    );

    if (matchScore < 0.3) continue;

    let matchType: "exact" | "probable" | "possible" | "no_match";
    if (matchScore >= 0.95) {
      matchType = "exact";
    } else if (matchScore >= 0.8) {
      matchType = "probable";
    } else if (matchScore >= 0.5) {
      matchType = "possible";
    } else {
      matchType = "no_match";
    }

    const conflicts = identifyConflicts(newRecord, existing);
    const suggestedMerge = conflicts.length > 0 ? generateSuggestedMerge(newRecord, existing, conflicts) : undefined;

    const result: MatchResult = {
      id: randomUUID(),
      matchScore,
      matchType,
      matchedFields: getMatchedFields(newRecord.data, existing.data),
      unmatchedFields: getUnmatchedFields(newRecord.data, existing.data),
      sources: [newRecord, existing],
      conflicts,
      suggestedMerge,
      status: matchScore >= 0.95 ? "auto_merged" : "pending",
      createdAt: new Date().toISOString(),
    };

    matchResults.set(result.id, result);
    results.push(result);
  }

  if (results.length > 0) {
    await logReconciliationActivity("find_matches", newRecord.resourceId, userId, {
      resourceType: newRecord.resourceType,
      matchCount: results.length,
      exactMatches: results.filter((r) => r.matchType === "exact").length,
    }, ipAddress);
  }

  return results;
}

function identifyConflicts(record1: RecordSource, record2: RecordSource): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  const allKeys = Array.from(new Set([...Object.keys(record1.data), ...Object.keys(record2.data)]));

  for (const key of allKeys) {
    if (key === "id" || key === "resourceType" || key === "meta") continue;

    const value1 = record1.data[key];
    const value2 = record2.data[key];

    if (value1 !== undefined && value2 !== undefined && JSON.stringify(value1) !== JSON.stringify(value2)) {
      conflicts.push({
        fieldPath: key,
        fieldName: key,
        values: [
          {
            source: record1.connectionName,
            value: value1,
            confidence: record1.confidence,
            lastModified: record1.provenance.lastModified,
          },
          {
            source: record2.connectionName,
            value: value2,
            confidence: record2.confidence,
            lastModified: record2.provenance.lastModified,
          },
        ],
        suggestedValue: selectBestValue(value1, value2, record1, record2),
        resolved: false,
      });
    }
  }

  return conflicts;
}

function selectBestValue(
  value1: unknown,
  value2: unknown,
  source1: RecordSource,
  source2: RecordSource
): unknown {
  if (source1.confidence !== source2.confidence) {
    return source1.confidence > source2.confidence ? value1 : value2;
  }

  const date1 = new Date(source1.provenance.lastModified).getTime();
  const date2 = new Date(source2.provenance.lastModified).getTime();
  return date1 > date2 ? value1 : value2;
}

function getMatchedFields(data1: Record<string, unknown>, data2: Record<string, unknown>): string[] {
  const matched: string[] = [];
  for (const key of Object.keys(data1)) {
    if (data2[key] !== undefined && JSON.stringify(data1[key]) === JSON.stringify(data2[key])) {
      matched.push(key);
    }
  }
  return matched;
}

function getUnmatchedFields(data1: Record<string, unknown>, data2: Record<string, unknown>): string[] {
  const unmatched: string[] = [];
  const allKeys = Array.from(new Set([...Object.keys(data1), ...Object.keys(data2)]));
  for (const key of allKeys) {
    if (data1[key] === undefined || data2[key] === undefined || JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
      unmatched.push(key);
    }
  }
  return unmatched;
}

function generateSuggestedMerge(
  record1: RecordSource,
  record2: RecordSource,
  conflicts: FieldConflict[]
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...record1.data,
    ...record2.data,
  };

  for (const conflict of conflicts) {
    if (conflict.suggestedValue !== undefined) {
      merged[conflict.fieldPath] = conflict.suggestedValue;
    }
  }

  merged.meta = {
    ...((merged.meta as Record<string, unknown>) || {}),
    source: "merged",
    mergedFrom: [
      { connection: record1.connectionName, resourceId: record1.resourceId },
      { connection: record2.connectionName, resourceId: record2.resourceId },
    ],
    mergedAt: new Date().toISOString(),
  };

  return merged;
}

export async function resolveMatch(
  matchId: string,
  resolution: "accept_suggested" | "manual" | "reject",
  manualMerge: Record<string, unknown> | undefined,
  userId: string,
  ipAddress: string,
  notes?: string
): Promise<MatchResult | null> {
  const match = matchResults.get(matchId);
  if (!match) return null;

  if (resolution === "accept_suggested" && match.suggestedMerge) {
    match.status = "resolved";
    match.resolvedAt = new Date().toISOString();
    match.resolvedBy = userId;
    match.resolutionNotes = notes || "Accepted suggested merge";
    match.conflicts.forEach((c) => {
      c.resolved = true;
      c.resolvedValue = c.suggestedValue;
    });
  } else if (resolution === "manual" && manualMerge) {
    match.status = "resolved";
    match.resolvedAt = new Date().toISOString();
    match.resolvedBy = userId;
    match.resolutionNotes = notes || "Manual merge applied";
    match.suggestedMerge = manualMerge;
    match.conflicts.forEach((c) => {
      c.resolved = true;
      c.resolvedValue = manualMerge[c.fieldPath];
    });
  } else if (resolution === "reject") {
    match.status = "rejected";
    match.resolvedAt = new Date().toISOString();
    match.resolvedBy = userId;
    match.resolutionNotes = notes || "Match rejected - records are distinct";
  }

  matchResults.set(matchId, match);

  await logReconciliationActivity("resolve_match", matchId, userId, {
    resolution,
    matchType: match.matchType,
    conflictCount: match.conflicts.length,
  }, ipAddress);

  return match;
}

export function getMatchResults(status?: string): MatchResult[] {
  const results = Array.from(matchResults.values());
  return status ? results.filter((r) => r.status === status) : results;
}

export function getMatchResult(id: string): MatchResult | undefined {
  return matchResults.get(id);
}

export function getMergeRules(): MergeRule[] {
  return Array.from(mergeRules.values());
}

export async function createDuplicateGroup(
  resourceType: string,
  members: GroupMember[],
  userId: string,
  ipAddress: string
): Promise<DuplicateGroup> {
  const id = randomUUID();
  const now = new Date().toISOString();

  let totalScore = 0;
  for (const member of members) {
    totalScore += member.matchScore;
  }
  const avgScore = members.length > 0 ? totalScore / members.length : 0;

  const group: DuplicateGroup = {
    id,
    resourceType,
    members,
    matchScore: avgScore,
    status: "identified",
    createdAt: now,
    updatedAt: now,
  };

  duplicateGroups.set(id, group);

  await logReconciliationActivity("create_duplicate_group", id, userId, {
    resourceType,
    memberCount: members.length,
    matchScore: avgScore,
  }, ipAddress);

  return group;
}

export function getDuplicateGroups(status?: string): DuplicateGroup[] {
  const groups = Array.from(duplicateGroups.values());
  return status ? groups.filter((g) => g.status === status) : groups;
}

export function getReconciliationStats(): {
  totalMatches: number;
  pendingReview: number;
  autoMerged: number;
  manuallyResolved: number;
  rejected: number;
  duplicateGroups: number;
  byResourceType: Record<string, number>;
} {
  const matches = Array.from(matchResults.values());
  const groups = Array.from(duplicateGroups.values());
  
  const byResourceType: Record<string, number> = {};
  for (const match of matches) {
    if (match.sources[0]) {
      const rt = match.sources[0].resourceType;
      byResourceType[rt] = (byResourceType[rt] || 0) + 1;
    }
  }

  return {
    totalMatches: matches.length,
    pendingReview: matches.filter((m) => m.status === "pending" || m.status === "manual_review").length,
    autoMerged: matches.filter((m) => m.status === "auto_merged").length,
    manuallyResolved: matches.filter((m) => m.status === "resolved").length,
    rejected: matches.filter((m) => m.status === "rejected").length,
    duplicateGroups: groups.length,
    byResourceType,
  };
}

console.log("[DataReconciliation] Service initialized with", mergeRules.size, "merge rules");
