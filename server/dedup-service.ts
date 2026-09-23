import { logPhiAccess } from "./security/hipaa-audit";
import { storage } from "./storage";
import type { DedupRecordType, ConflictSeverity, DedupConflictType } from "@shared/schema";
import { generatePhiSafeText } from "./services/ai-gateway";

export interface SourceRecord {
  sourceId: string;
  sourceName: string;
  sourceType: "ehr" | "pharmacy" | "lab" | "hospital" | "patient_reported" | "claims";
  recordId: string;
  rawValue: string;
  normalizedValue?: string;
  lastUpdated: Date;
  confidence: number;
}

export interface MergedRecord {
  id: string;
  type: "medication" | "lab_result" | "condition" | "allergy" | "procedure";
  displayName: string;
  normalizedName: string;
  status: "active" | "inactive" | "resolved";
  sources: SourceRecord[];
  sourceCount: number;
  lastUpdated: Date;
  hasConflict: boolean;
  conflictDetails?: string;
  mergedDetails: Record<string, any>;
  confidenceScore: number;
}

export interface DedupSummary {
  totalRecords: number;
  uniqueRecords: number;
  duplicatesRemoved: number;
  conflictsDetected: number;
  recordsByType: Record<string, number>;
}

export interface DeduplicatedRecordsResponse {
  patientId: string;
  generatedAt: Date;
  medications: MergedRecord[];
  labResults: MergedRecord[];
  conditions: MergedRecord[];
  allergies: MergedRecord[];
  procedures: MergedRecord[];
  summary: DedupSummary;
}

function getSampleRawRecords(patientId: string): {
  medications: Array<{ name: string; dosage: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>;
  labResults: Array<{ name: string; value: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>;
  conditions: Array<{ name: string; status: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>;
  allergies: Array<{ name: string; reaction: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>;
  procedures: Array<{ name: string; date: Date; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>;
} {
  const now = new Date();

  return {
    medications: [
      { name: "Metformin 500mg", dosage: "500mg twice daily", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10), details: { ndc: "00093-7212-01" } },
      { name: "Metformin HCl 500mg", dosage: "500mg BID", source: "CVS Pharmacy", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 5), details: { rxNumber: "7234521" } },
      { name: "Metformin", dosage: "500mg twice a day", source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 2, 15) },
      { name: "Lisinopril 10mg", dosage: "10mg daily", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10), details: { ndc: "00378-0803-01" } },
      { name: "Lisinopril 10mg", dosage: "10mg once daily", source: "Walgreens", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 2) },
      { name: "Atorvastatin 20mg", dosage: "20mg daily", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { name: "Atorvastatin Calcium 20mg", dosage: "20mg at bedtime", source: "CVS Pharmacy", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 5) },
      { name: "Lipitor 20mg", dosage: "20mg daily", source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 3, 20) },
      { name: "Vitamin D3 2000 IU", dosage: "2000 IU daily", source: "Patient Reported", sourceType: "patient_reported", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 1) },
      { name: "Vitamin D 2000 IU", dosage: "2000 IU once daily", source: "CVS Pharmacy", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
    ],
    labResults: [
      { name: "Hemoglobin A1C", value: "6.5%", source: "Quest Diagnostics", sourceType: "lab", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { name: "HbA1c", value: "6.5%", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 16) },
      { name: "Glycated Hemoglobin", value: "6.5%", source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 20) },
      { name: "Total Cholesterol", value: "185 mg/dL", source: "Quest Diagnostics", sourceType: "lab", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { name: "Cholesterol, Total", value: "185 mg/dL", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 16) },
      { name: "LDL Cholesterol", value: "95 mg/dL", source: "Quest Diagnostics", sourceType: "lab", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { name: "LDL-C", value: "95 mg/dL", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 16) },
      { name: "eGFR", value: "85 mL/min", source: "Quest Diagnostics", sourceType: "lab", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { name: "Vitamin D, 25-Hydroxy", value: "35 ng/mL", source: "Quest Diagnostics", sourceType: "lab", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 15) },
      { name: "Vitamin D Level", value: "35 ng/mL", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 16) },
    ],
    conditions: [
      { name: "Type 2 Diabetes Mellitus", status: "active", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { name: "Diabetes mellitus type 2", status: "active", source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 2, 5) },
      { name: "T2DM", status: "active", source: "Hospital Network", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 3, 20) },
      { name: "Essential Hypertension", status: "active", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { name: "Hypertension, Primary", status: "active", source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 2, 5) },
      { name: "High Blood Pressure", status: "active", source: "Patient Reported", sourceType: "patient_reported", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 1) },
      { name: "Hyperlipidemia", status: "active", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 1, 10) },
      { name: "Dyslipidemia", status: "active", source: "Hospital Network", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 3, 20) },
      { name: "High Cholesterol", status: "active", source: "Patient Reported", sourceType: "patient_reported", lastUpdated: new Date(now.getFullYear(), now.getMonth(), 1) },
    ],
    allergies: [
      { name: "Penicillin", reaction: "Rash", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 6, 10) },
      { name: "Penicillin allergy", reaction: "Skin rash", source: "Walgreens", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 3, 5) },
      { name: "PCN", reaction: "Rash", source: "City Hospital", sourceType: "hospital", lastUpdated: new Date(now.getFullYear() - 1, 5, 20) },
      { name: "Sulfa drugs", reaction: "Hives", source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 6, 10) },
      { name: "Sulfonamides", reaction: "Urticaria", source: "CVS Pharmacy", sourceType: "pharmacy", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 2, 15) },
    ],
    procedures: [
      { name: "Echocardiogram", date: new Date(now.getFullYear(), now.getMonth() - 9, 5), source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 9, 6) },
      { name: "Echo", date: new Date(now.getFullYear(), now.getMonth() - 9, 5), source: "Blue Cross Claims", sourceType: "claims", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 9, 15) },
      { name: "Electrocardiogram", date: new Date(now.getFullYear(), now.getMonth() - 9, 5), source: "Primary Care Provider", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 9, 6) },
      { name: "EKG", date: new Date(now.getFullYear(), now.getMonth() - 9, 5), source: "Cardiology Associates", sourceType: "ehr", lastUpdated: new Date(now.getFullYear(), now.getMonth() - 9, 5) },
    ],
  };
}

async function matchRecordsWithAI(
  records: Array<{ name: string; source: string; dosage?: string; value?: string; reaction?: string; status?: string; date?: string; details?: Record<string, any> }>,
  recordType: string
): Promise<Array<{ group: number; normalizedName: string; hasConflict: boolean; conflictDetails?: string }>> {
  const systemPrompt = `You are a medical record matching expert. Your job is to identify duplicate records that refer to the same medication, lab test, condition, allergy, or procedure.

Rules:
1. Match records that refer to the same thing (e.g., "Metformin 500mg" and "Metformin HCl 500mg" are the same)
2. Match brand names to generic names (e.g., "Lipitor" = "Atorvastatin")
3. Match abbreviations to full names (e.g., "HbA1c" = "Hemoglobin A1C")
4. Match common variations (e.g., "T2DM" = "Type 2 Diabetes Mellitus")
5. IMPORTANT: Detect conflicts when dosages, values, or other key details differ between sources (e.g., one source says "500mg" and another says "1000mg")
6. Provide a normalized/canonical name for each group
7. Set hasConflict=true and provide conflictDetails when important details differ`;

  const recordsForAI = records.map((r, i) => ({
    index: i,
    name: r.name,
    source: r.source,
    ...(r.dosage && { dosage: r.dosage }),
    ...(r.value && { value: r.value }),
    ...(r.reaction && { reaction: r.reaction }),
    ...(r.status && { status: r.status }),
    ...(r.date && { date: r.date }),
  }));

  const userPrompt = `Match these ${recordType} records and identify duplicates. Pay attention to dosage/value discrepancies that indicate conflicts:

${JSON.stringify(recordsForAI, null, 2)}

Respond with JSON:
{
  "matches": [
    {
      "indices": [0, 1, 2],
      "normalizedName": "Canonical name for this group",
      "hasConflict": false,
      "conflictDetails": null
    }
  ]
}

If records in a group have different dosages/values/reactions, set hasConflict=true and describe the discrepancy in conflictDetails.`;

  try {
    // P1-1.2: PHI-bearing record matching runs through the Vertex/BAA gateway.
    const content = await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      responseMimeType: "application/json",
      temperature: 0.3,
      maxTokens: 1500,
    });
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    const result: Array<{ group: number; normalizedName: string; hasConflict: boolean; conflictDetails?: string }> = [];

    (parsed.matches || []).forEach((match: any, groupIndex: number) => {
      (match.indices || []).forEach((idx: number) => {
        result[idx] = {
          group: groupIndex,
          normalizedName: match.normalizedName || records[idx]?.name || "Unknown",
          hasConflict: match.hasConflict || false,
          conflictDetails: match.conflictDetails,
        };
      });
    });

    records.forEach((_, idx) => {
      if (!result[idx]) {
        result[idx] = {
          group: 100 + idx,
          normalizedName: records[idx].name,
          hasConflict: false,
        };
      }
    });

    return result;
  } catch (error) {
    console.error("[Dedup] AI matching failed, using fallback:", error);
    return records.map((r, idx) => ({
      group: idx,
      normalizedName: r.name,
      hasConflict: false,
    }));
  }
}

function calculateConfidence(sources: SourceRecord[]): number {
  const sourceTypeWeights: Record<SourceRecord["sourceType"], number> = {
    ehr: 0.95,
    hospital: 0.90,
    lab: 0.90,
    pharmacy: 0.85,
    claims: 0.75,
    patient_reported: 0.60,
  };

  if (sources.length === 0) return 0;

  const avgWeight = sources.reduce((sum, s) => sum + sourceTypeWeights[s.sourceType], 0) / sources.length;
  const sourceCountBonus = Math.min(sources.length * 0.02, 0.10);
  const recencyBonus = sources.some((s) => {
    const daysSince = (Date.now() - s.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 30;
  }) ? 0.05 : 0;

  return Math.min(avgWeight + sourceCountBonus + recencyBonus, 1.0);
}

function mergeRecordGroup<T extends { name: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>(
  records: T[],
  normalizedName: string,
  recordType: MergedRecord["type"],
  hasConflict: boolean,
  conflictDetails?: string
): MergedRecord {
  const sources: SourceRecord[] = records.map((r, idx) => ({
    sourceId: `src-${idx}-${Date.now()}`,
    sourceName: r.source,
    sourceType: r.sourceType,
    recordId: `rec-${idx}`,
    rawValue: r.name,
    normalizedValue: normalizedName,
    lastUpdated: r.lastUpdated,
    confidence: {
      ehr: 0.95,
      hospital: 0.90,
      lab: 0.90,
      pharmacy: 0.85,
      claims: 0.75,
      patient_reported: 0.60,
    }[r.sourceType],
  }));

  const latestUpdate = records.reduce((latest, r) =>
    r.lastUpdated > latest ? r.lastUpdated : latest,
    records[0].lastUpdated
  );

  const mergedDetails: Record<string, any> = {};
  records.forEach((r) => {
    if (r.details) {
      Object.assign(mergedDetails, r.details);
    }
  });

  return {
    id: `merged-${recordType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: recordType,
    displayName: normalizedName,
    normalizedName,
    status: "active",
    sources,
    sourceCount: sources.length,
    lastUpdated: latestUpdate,
    hasConflict,
    conflictDetails,
    mergedDetails,
    confidenceScore: calculateConfidence(sources),
  };
}

export async function getDeduplicatedRecords(patientId: string): Promise<DeduplicatedRecordsResponse> {
  logPhiAccess({
    action: "read",
    resourceType: "DeduplicatedRecords",
    userId: patientId,
    patientId,
    details: "Retrieved deduplicated health records with source confidence",
  });

  const rawRecords = getSampleRawRecords(patientId);

  const [medMatches, labMatches, condMatches, allergyMatches, procMatches] = await Promise.all([
    matchRecordsWithAI(rawRecords.medications.map((m) => ({ name: m.name, source: m.source, dosage: m.dosage, details: m.details })), "medications"),
    matchRecordsWithAI(rawRecords.labResults.map((l) => ({ name: l.name, source: l.source, value: l.value, details: l.details })), "lab results"),
    matchRecordsWithAI(rawRecords.conditions.map((c) => ({ name: c.name, source: c.source, status: c.status, details: c.details })), "conditions"),
    matchRecordsWithAI(rawRecords.allergies.map((a) => ({ name: a.name, source: a.source, reaction: a.reaction, details: a.details })), "allergies"),
    matchRecordsWithAI(rawRecords.procedures.map((p) => ({ name: p.name, source: p.source, date: p.date.toISOString(), details: p.details })), "procedures"),
  ]);

  function groupAndMerge<T extends { name: string; source: string; sourceType: SourceRecord["sourceType"]; lastUpdated: Date; details?: Record<string, any> }>(
    records: T[],
    matches: Array<{ group: number; normalizedName: string; hasConflict: boolean; conflictDetails?: string }>,
    recordType: MergedRecord["type"]
  ): MergedRecord[] {
    const groups = new Map<number, { records: T[]; normalizedName: string; hasConflict: boolean; conflictDetails?: string }>();

    records.forEach((record, idx) => {
      const match = matches[idx];
      if (!groups.has(match.group)) {
        groups.set(match.group, {
          records: [],
          normalizedName: match.normalizedName,
          hasConflict: match.hasConflict,
          conflictDetails: match.conflictDetails,
        });
      }
      groups.get(match.group)!.records.push(record);
    });

    return Array.from(groups.values()).map((g) =>
      mergeRecordGroup(g.records, g.normalizedName, recordType, g.hasConflict, g.conflictDetails)
    );
  }

  const medications = groupAndMerge(rawRecords.medications, medMatches, "medication");
  const labResults = groupAndMerge(rawRecords.labResults, labMatches, "lab_result");
  const conditions = groupAndMerge(rawRecords.conditions, condMatches, "condition");
  const allergies = groupAndMerge(rawRecords.allergies, allergyMatches, "allergy");
  const procedures = groupAndMerge(rawRecords.procedures, procMatches, "procedure");

  const totalRaw = rawRecords.medications.length + rawRecords.labResults.length +
    rawRecords.conditions.length + rawRecords.allergies.length + rawRecords.procedures.length;
  const totalMerged = medications.length + labResults.length + conditions.length + allergies.length + procedures.length;
  const conflictsDetected = [...medications, ...labResults, ...conditions, ...allergies, ...procedures]
    .filter((r) => r.hasConflict).length;

  return {
    patientId,
    generatedAt: new Date(),
    medications,
    labResults,
    conditions,
    allergies,
    procedures,
    summary: {
      totalRecords: totalRaw,
      uniqueRecords: totalMerged,
      duplicatesRemoved: totalRaw - totalMerged,
      conflictsDetected,
      recordsByType: {
        medications: medications.length,
        labResults: labResults.length,
        conditions: conditions.length,
        allergies: allergies.length,
        procedures: procedures.length,
      },
    },
  };
}

export function getSourceTypeInfo(sourceType: SourceRecord["sourceType"]): { label: string; color: string } {
  const info: Record<SourceRecord["sourceType"], { label: string; color: string }> = {
    ehr: { label: "EHR", color: "blue" },
    hospital: { label: "Hospital", color: "purple" },
    lab: { label: "Lab", color: "green" },
    pharmacy: { label: "Pharmacy", color: "orange" },
    claims: { label: "Claims", color: "gray" },
    patient_reported: { label: "Self-Reported", color: "cyan" },
  };
  return info[sourceType] || { label: "Unknown", color: "gray" };
}

// ============================================
// DEDUP ANALYTICS EVENT LOGGING
// ============================================

export async function logDedupGroupCreated(
  userId: string,
  dedupGroupId: string,
  recordType: DedupRecordType,
  recordCount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    eventType: "dedup_group_created",
    userId,
    description: `Created dedup group for ${recordCount} ${recordType} records`,
    metadata: {
      dedupGroupId: String(dedupGroupId),
      recordType: String(recordType),
      recordCount: String(recordCount),
      algorithm: "ai_matching",
    },
    ipAddress: ipAddress || "Unknown",
    userAgent: userAgent || "Unknown",
  });
}

export async function logDedupConflictDetected(
  userId: string,
  dedupGroupId: string,
  conflictId: string,
  conflictType: DedupConflictType,
  severity: ConflictSeverity,
  fieldName: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    eventType: "dedup_conflict_detected",
    userId,
    description: `Detected ${severity} ${conflictType} conflict in field ${fieldName}`,
    metadata: {
      dedupGroupId: String(dedupGroupId),
      conflictId: String(conflictId),
      conflictType: String(conflictType),
      conflictSeverity: String(severity),
      fieldName: String(fieldName),
    },
    ipAddress: ipAddress || "Unknown",
    userAgent: userAgent || "Unknown",
  });
}

export async function logDedupUserViewedProvenance(
  userId: string,
  dedupGroupId: string,
  recordType: DedupRecordType,
  sourceCount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    eventType: "dedup_user_viewed_provenance",
    userId,
    description: `User viewed provenance for ${recordType} with ${sourceCount} sources`,
    metadata: {
      dedupGroupId: String(dedupGroupId),
      recordType: String(recordType),
      sourceCount: String(sourceCount),
      viewedAt: new Date().toISOString(),
    },
    ipAddress: ipAddress || "Unknown",
    userAgent: userAgent || "Unknown",
  });
}

export async function logDedupConflictResolved(
  userId: string,
  conflictId: string,
  dedupGroupId: string,
  conflictType: DedupConflictType,
  resolvedValue: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await storage.createSecurityAuditLog({
    eventType: "dedup_conflict_resolved",
    userId,
    description: `Resolved ${conflictType} conflict with value: ${resolvedValue}`,
    metadata: {
      dedupGroupId: String(dedupGroupId),
      conflictId: String(conflictId),
      conflictType: String(conflictType),
      resolvedValue: String(resolvedValue),
      resolvedAt: new Date().toISOString(),
    },
    ipAddress: ipAddress || "Unknown",
    userAgent: userAgent || "Unknown",
  });
}

// ============================================
// ENHANCED DEDUP WITH PERSISTENT STORAGE
// ============================================

export async function createDedupGroupWithProvenance(
  userId: string,
  recordType: DedupRecordType,
  mergedRecord: MergedRecord,
  ipAddress?: string,
  userAgent?: string
): Promise<{ dedupGroupId: string; conflictIds: string[] }> {
  const dedupGroup = await storage.createDedupGroup({
    userId,
    recordType,
    status: "active",
    canonicalName: mergedRecord.normalizedName,
    canonicalData: mergedRecord.mergedDetails,
    matchingAlgorithm: "ai_matching",
    matchScore: mergedRecord.confidenceScore,
    sourceCount: mergedRecord.sourceCount,
    hasConflicts: mergedRecord.hasConflict,
    conflictCount: mergedRecord.hasConflict ? 1 : 0,
  });

  await logDedupGroupCreated(userId, dedupGroup.id, recordType, mergedRecord.sourceCount, ipAddress, userAgent);

  for (let i = 0; i < mergedRecord.sources.length; i++) {
    const source = mergedRecord.sources[i];
    await storage.createProvenanceLink({
      dedupGroupId: dedupGroup.id,
      originalRecordId: source.recordId,
      recordType,
      sourceConnectionId: source.sourceId,
      sourcePlatform: source.sourceType,
      sourceFacility: source.sourceName,
      importedAt: source.lastUpdated.toISOString(),
      rawData: { rawValue: source.rawValue, normalizedValue: source.normalizedValue },
      confidence: source.confidence,
      isPrimary: i === 0,
    });
  }

  const conflictIds: string[] = [];
  if (mergedRecord.hasConflict && mergedRecord.conflictDetails) {
    const conflict = await storage.createDedupConflict({
      dedupGroupId: dedupGroup.id,
      userId,
      conflictType: detectConflictType(mergedRecord),
      severity: detectConflictSeverity(mergedRecord),
      fieldName: detectConflictField(mergedRecord),
      values: mergedRecord.sources.map(s => ({
        sourceConnectionId: s.sourceId,
        sourcePlatform: s.sourceType,
        value: s.rawValue,
        recordId: s.recordId,
        recordDate: s.lastUpdated.toISOString(),
      })),
      status: "pending",
    });
    conflictIds.push(conflict.id);

    await logDedupConflictDetected(
      userId,
      dedupGroup.id,
      conflict.id,
      conflict.conflictType,
      conflict.severity,
      conflict.fieldName,
      ipAddress,
      userAgent
    );
  }

  return { dedupGroupId: dedupGroup.id, conflictIds };
}

function detectConflictType(mergedRecord: MergedRecord): DedupConflictType {
  const details = mergedRecord.conflictDetails?.toLowerCase() || "";
  if (details.includes("dose") || details.includes("dosage")) return "dose_mismatch";
  if (details.includes("frequency") || details.includes("times")) return "frequency_mismatch";
  if (details.includes("value") || details.includes("result")) return "value_mismatch";
  if (details.includes("status")) return "status_mismatch";
  if (details.includes("date")) return "date_mismatch";
  if (details.includes("provider") || details.includes("prescriber")) return "provider_mismatch";
  return "value_mismatch";
}

function detectConflictSeverity(mergedRecord: MergedRecord): ConflictSeverity {
  const details = mergedRecord.conflictDetails?.toLowerCase() || "";
  if (details.includes("critical") || details.includes("dangerous")) return "critical";
  if (details.includes("dose") || details.includes("dosage")) return "high";
  if (details.includes("frequency")) return "medium";
  return "low";
}

function detectConflictField(mergedRecord: MergedRecord): string {
  const details = mergedRecord.conflictDetails?.toLowerCase() || "";
  if (details.includes("dose") || details.includes("dosage")) return "dosage";
  if (details.includes("frequency")) return "frequency";
  if (details.includes("value")) return "value";
  if (details.includes("status")) return "status";
  if (details.includes("date")) return "date";
  return "value";
}

export async function getDedupSummaryStats(userId: string): Promise<{
  totalGroups: number;
  groupsByType: Record<DedupRecordType, number>;
  totalConflicts: number;
  pendingConflicts: number;
  resolvedConflicts: number;
  duplicatesRemoved: number;
  averageSourcesPerGroup: number;
}> {
  const groups = await storage.getDedupGroups(userId);
  const conflicts = await storage.getDedupConflicts(userId);

  const groupsByType: Record<DedupRecordType, number> = {
    medication: 0,
    lab_result: 0,
    document: 0,
    condition: 0,
    allergy: 0,
  };

  let totalSources = 0;
  for (const group of groups) {
    groupsByType[group.recordType]++;
    totalSources += group.sourceCount;
  }

  const averageSourcesPerGroup = groups.length > 0 ? totalSources / groups.length : 0;

  return {
    totalGroups: groups.length,
    groupsByType,
    totalConflicts: conflicts.length,
    pendingConflicts: conflicts.filter(c => c.status === "pending").length,
    resolvedConflicts: conflicts.filter(c => c.status === "resolved").length,
    averageSourcesPerGroup,
    duplicatesRemoved: totalSources - groups.length,
  };
}
