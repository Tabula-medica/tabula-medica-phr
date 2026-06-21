/**
 * FHIR R4 Deduplication Service
 * Code-system aware record matching and merging
 */

import { 
  CodeSystemURIs, 
  type Coding, 
  type CodeableConcept,
  type Identifier,
  type FHIRResource 
} from "@shared/fhir-r4";

// ============================================
// DEDUPLICATION CONFIGURATION
// ============================================

export interface DeduplicationConfig {
  matchThreshold: number; // 0-1, minimum confidence for auto-match
  requireManualReviewThreshold: number; // 0-1, threshold for manual review
  codeSystemWeights: Record<string, number>;
  identifierSystemWeights: Record<string, number>;
}

export const defaultDeduplicationConfig: DeduplicationConfig = {
  matchThreshold: 0.85,
  requireManualReviewThreshold: 0.70,
  codeSystemWeights: {
    [CodeSystemURIs.SNOMED_CT]: 1.0,
    [CodeSystemURIs.LOINC]: 1.0,
    [CodeSystemURIs.ICD10_CM]: 0.95,
    [CodeSystemURIs.RXNORM]: 1.0,
    [CodeSystemURIs.NDC]: 0.9,
    [CodeSystemURIs.CVX]: 0.95,
  },
  identifierSystemWeights: {
    "urn:oid:2.16.840.1.113883.4.1": 1.0, // SSN
    "http://hl7.org/fhir/sid/us-medicare": 0.95,
    "http://hospital.example.org/mrn": 0.85,
  },
};

// ============================================
// MATCH RESULT TYPES
// ============================================

export interface MatchCandidate {
  resourceId: string;
  resourceType: string;
  confidence: number;
  matchFactors: MatchFactor[];
  codeSystemMatches: CodeSystemMatch[];
  identifierMatches: IdentifierMatch[];
  requiresReview: boolean;
}

export interface MatchFactor {
  field: string;
  sourceValue: string;
  targetValue: string;
  weight: number;
  matched: boolean;
}

export interface CodeSystemMatch {
  system: string;
  sourceCode: string;
  targetCode: string;
  sourceDisplay?: string;
  targetDisplay?: string;
  matched: boolean;
  weight: number;
}

export interface IdentifierMatch {
  system: string;
  sourceValue: string;
  targetValue: string;
  matched: boolean;
  weight: number;
}

// ============================================
// MERGE RESULT TYPES
// ============================================

export interface MergeResult {
  mergedResourceId: string;
  sourceResourceIds: string[];
  mergedResource: FHIRResource;
  provenance: MergeProvenance;
  conflicts: MergeConflict[];
  confidence: number;
}

export interface MergeProvenance {
  id: string;
  mergedAt: string;
  mergedBy: string;
  algorithm: string;
  algorithmVersion: string;
  sourceRecords: SourceRecordInfo[];
}

export interface SourceRecordInfo {
  resourceId: string;
  resourceType: string;
  sourceSystem: string;
  sourceFacility: string;
  importedAt: string;
  isPrimary: boolean;
}

export interface MergeConflict {
  id: string;
  field: string;
  conflictType: string;
  sourceValues: { resourceId: string; value: unknown }[];
  resolvedValue?: unknown;
  resolution?: "auto" | "manual" | "pending";
  resolvedBy?: string;
  resolvedAt?: string;
  severity: "low" | "medium" | "high" | "critical";
}

// ============================================
// DEDUPLICATION SERVICE
// ============================================

export class FHIRDeduplicationService {
  private config: DeduplicationConfig;

  constructor(config: DeduplicationConfig = defaultDeduplicationConfig) {
    this.config = config;
  }

  /**
   * Compare two CodeableConcept values for equivalence
   */
  compareCodeableConcepts(
    source: CodeableConcept | undefined,
    target: CodeableConcept | undefined
  ): { matched: boolean; confidence: number; matches: CodeSystemMatch[] } {
    if (!source || !target) {
      return { matched: false, confidence: 0, matches: [] };
    }

    const matches: CodeSystemMatch[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    const sourceCodingsMap = new Map<string, Coding>();
    (source.coding || []).forEach((c) => {
      if (c.system && c.code) {
        sourceCodingsMap.set(`${c.system}|${c.code}`, c);
      }
    });

    for (const targetCoding of target.coding || []) {
      if (!targetCoding.system || !targetCoding.code) continue;

      const weight = this.config.codeSystemWeights[targetCoding.system] || 0.5;
      totalWeight += weight;

      const key = `${targetCoding.system}|${targetCoding.code}`;
      const sourceCoding = sourceCodingsMap.get(key);

      const match: CodeSystemMatch = {
        system: targetCoding.system,
        sourceCode: sourceCoding?.code || "",
        targetCode: targetCoding.code,
        sourceDisplay: sourceCoding?.display,
        targetDisplay: targetCoding.display,
        matched: !!sourceCoding,
        weight,
      };

      if (sourceCoding) {
        matchedWeight += weight;
      }

      matches.push(match);
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    return {
      matched: confidence >= this.config.matchThreshold,
      confidence,
      matches,
    };
  }

  /**
   * Compare two Identifier arrays for matches
   */
  compareIdentifiers(
    source: Identifier[] | undefined,
    target: Identifier[] | undefined
  ): { matched: boolean; confidence: number; matches: IdentifierMatch[] } {
    if (!source || !target || source.length === 0 || target.length === 0) {
      return { matched: false, confidence: 0, matches: [] };
    }

    const matches: IdentifierMatch[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    const sourceMap = new Map<string, string>();
    source.forEach((id) => {
      if (id.system && id.value) {
        sourceMap.set(id.system, id.value);
      }
    });

    for (const targetId of target) {
      if (!targetId.system || !targetId.value) continue;

      const weight = this.config.identifierSystemWeights[targetId.system] || 0.5;
      totalWeight += weight;

      const sourceValue = sourceMap.get(targetId.system);
      const matched = sourceValue === targetId.value;

      if (matched) {
        matchedWeight += weight;
      }

      matches.push({
        system: targetId.system,
        sourceValue: sourceValue || "",
        targetValue: targetId.value,
        matched,
        weight,
      });
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    return {
      matched: confidence >= this.config.matchThreshold,
      confidence,
      matches,
    };
  }

  /**
   * Find potential matches for a resource
   */
  findMatches(
    sourceResource: FHIRResource,
    candidateResources: FHIRResource[]
  ): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];

    for (const candidate of candidateResources) {
      if (candidate.id === sourceResource.id) continue;
      if (candidate.resourceType !== sourceResource.resourceType) continue;

      const matchResult = this.compareResources(sourceResource, candidate);
      if (matchResult.confidence >= this.config.requireManualReviewThreshold) {
        candidates.push({
          resourceId: candidate.id || "",
          resourceType: candidate.resourceType,
          confidence: matchResult.confidence,
          matchFactors: matchResult.factors,
          codeSystemMatches: matchResult.codeMatches,
          identifierMatches: matchResult.identifierMatches,
          requiresReview: matchResult.confidence < this.config.matchThreshold,
        });
      }
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Compare two resources for deduplication
   */
  private compareResources(
    source: FHIRResource,
    target: FHIRResource
  ): {
    confidence: number;
    factors: MatchFactor[];
    codeMatches: CodeSystemMatch[];
    identifierMatches: IdentifierMatch[];
  } {
    const factors: MatchFactor[] = [];
    const codeMatches: CodeSystemMatch[] = [];
    const identifierMatches: IdentifierMatch[] = [];
    let totalWeight = 0;
    let matchedWeight = 0;

    // Compare identifiers
    if ("identifier" in source && "identifier" in target) {
      const idResult = this.compareIdentifiers(
        source.identifier as Identifier[],
        target.identifier as Identifier[]
      );
      identifierMatches.push(...idResult.matches);
      if (idResult.matches.length > 0) {
        totalWeight += 2;
        matchedWeight += idResult.confidence * 2;
      }
    }

    // Compare code (for Condition, Observation, etc.)
    if ("code" in source && "code" in target) {
      const codeResult = this.compareCodeableConcepts(
        source.code as CodeableConcept,
        target.code as CodeableConcept
      );
      codeMatches.push(...codeResult.matches);
      if (codeResult.matches.length > 0) {
        totalWeight += 3;
        matchedWeight += codeResult.confidence * 3;
      }
    }

    // Compare medicationCodeableConcept (for MedicationRequest)
    if ("medicationCodeableConcept" in source && "medicationCodeableConcept" in target) {
      const medResult = this.compareCodeableConcepts(
        source.medicationCodeableConcept as CodeableConcept,
        target.medicationCodeableConcept as CodeableConcept
      );
      codeMatches.push(...medResult.matches);
      if (medResult.matches.length > 0) {
        totalWeight += 3;
        matchedWeight += medResult.confidence * 3;
      }
    }

    // Compare subject/patient reference
    if ("subject" in source && "subject" in target) {
      const sourceRef = (source.subject as any)?.reference;
      const targetRef = (target.subject as any)?.reference;
      const matched = sourceRef && targetRef && sourceRef === targetRef;
      factors.push({
        field: "subject",
        sourceValue: sourceRef || "",
        targetValue: targetRef || "",
        weight: 1.5,
        matched,
      });
      totalWeight += 1.5;
      if (matched) matchedWeight += 1.5;
    }

    const confidence = totalWeight > 0 ? matchedWeight / totalWeight : 0;
    return { confidence, factors, codeMatches, identifierMatches };
  }

  /**
   * Merge multiple resources into a canonical record
   */
  mergeResources(
    primaryResource: FHIRResource,
    secondaryResources: FHIRResource[],
    mergedBy: string
  ): MergeResult {
    const conflicts: MergeConflict[] = [];
    const sourceRecords: SourceRecordInfo[] = [
      {
        resourceId: primaryResource.id || "",
        resourceType: primaryResource.resourceType,
        sourceSystem: (primaryResource.meta?.source || "unknown"),
        sourceFacility: "primary",
        importedAt: primaryResource.meta?.lastUpdated || new Date().toISOString(),
        isPrimary: true,
      },
      ...secondaryResources.map((r) => ({
        resourceId: r.id || "",
        resourceType: r.resourceType,
        sourceSystem: (r.meta?.source || "unknown"),
        sourceFacility: "secondary",
        importedAt: r.meta?.lastUpdated || new Date().toISOString(),
        isPrimary: false,
      })),
    ];

    // Create merged resource using primary as base
    const mergedResource = { ...primaryResource };
    const mergedId = `merged-${Date.now()}`;
    mergedResource.id = mergedId;
    mergedResource.meta = {
      ...mergedResource.meta,
      lastUpdated: new Date().toISOString(),
      source: "deduplication-service",
      tag: [
        { system: "http://tabula-medica.com/dedup", code: "merged", display: "Merged Record" },
      ],
    };

    // Detect conflicts for each secondary resource
    for (const secondary of secondaryResources) {
      this.detectConflicts(primaryResource, secondary, conflicts);
    }

    const provenance: MergeProvenance = {
      id: `provenance-${mergedId}`,
      mergedAt: new Date().toISOString(),
      mergedBy,
      algorithm: "fhir-r4-code-aware",
      algorithmVersion: "1.0.0",
      sourceRecords,
    };

    const allResources = [primaryResource, ...secondaryResources];
    const avgConfidence = 0.9;

    return {
      mergedResourceId: mergedId,
      sourceResourceIds: allResources.map((r) => r.id || ""),
      mergedResource,
      provenance,
      conflicts,
      confidence: avgConfidence,
    };
  }

  /**
   * Detect conflicts between two resources
   */
  private detectConflicts(
    primary: FHIRResource,
    secondary: FHIRResource,
    conflicts: MergeConflict[]
  ): void {
    // Compare status fields
    if ("status" in primary && "status" in secondary) {
      if (primary.status !== secondary.status) {
        conflicts.push({
          id: `conflict-${conflicts.length + 1}`,
          field: "status",
          conflictType: "status_mismatch",
          sourceValues: [
            { resourceId: primary.id || "", value: primary.status },
            { resourceId: secondary.id || "", value: secondary.status },
          ],
          resolution: "pending",
          severity: "medium",
        });
      }
    }

    // Compare date fields
    const dateFields = [
      "effectiveDateTime",
      "authoredOn",
      "recordedDate",
      "occurrenceDateTime",
    ];
    for (const field of dateFields) {
      if (field in primary && field in secondary) {
        const primaryVal = (primary as any)[field];
        const secondaryVal = (secondary as any)[field];
        if (primaryVal && secondaryVal && primaryVal !== secondaryVal) {
          const diff = Math.abs(new Date(primaryVal).getTime() - new Date(secondaryVal).getTime());
          if (diff > 86400000) { // More than 1 day difference
            conflicts.push({
              id: `conflict-${conflicts.length + 1}`,
              field,
              conflictType: "date_mismatch",
              sourceValues: [
                { resourceId: primary.id || "", value: primaryVal },
                { resourceId: secondary.id || "", value: secondaryVal },
              ],
              resolution: "pending",
              severity: diff > 604800000 ? "high" : "low", // > 1 week is high
            });
          }
        }
      }
    }
  }

  /**
   * Resolve a merge conflict
   */
  resolveConflict(
    conflict: MergeConflict,
    resolvedValue: unknown,
    resolvedBy: string
  ): MergeConflict {
    return {
      ...conflict,
      resolvedValue,
      resolution: "manual",
      resolvedBy,
      resolvedAt: new Date().toISOString(),
    };
  }
}

export const deduplicationService = new FHIRDeduplicationService();

console.log("[Deduplication] FHIR R4 code-system aware deduplication service loaded");
