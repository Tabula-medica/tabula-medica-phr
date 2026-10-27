import { db } from "./db";
import { 
  healthRecords,
  canonicalPatientViews,
  harmonizationRules,
  dataConflicts,
  harmonizedPatients,
  type HealthRecord,
  type InsertCanonicalPatientView,
  type InsertDataConflict,
  HARMONIZATION_RULE_TYPES
} from "../shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { terminologyService, type CodeableConcept } from "./terminology-service";
import { validationEngine, type FhirResource } from "./fhir-validation-engine";

export interface HarmonizationResult {
  success: boolean;
  resourceType: string;
  sourceRecordIds: string[];
  canonicalData: Record<string, unknown>;
  terminologyMappings: TerminologyMappingResult[];
  conflicts: DataConflictResult[];
  harmonizationScore: number;
  harmonizedAt: Date;
}

export interface TerminologyMappingResult {
  field: string;
  originalSystem: string;
  originalCode: string;
  mappedSystem: string;
  mappedCode: string;
  mappedDisplay?: string;
  confidence: number;
}

export interface DataConflictResult {
  field: string;
  conflictType: string;
  values: Array<{ sourceId: string; value: unknown }>;
  resolution?: unknown;
  resolutionMethod?: string;
}

export interface HarmonizationOptions {
  preferredTerminology?: string;
  conflictResolution?: "latest" | "earliest" | "most_complete" | "highest_confidence" | "manual";
  includeAllMappings?: boolean;
  validateResult?: boolean;
}

const FIELD_PRIORITY: Record<string, string[]> = {
  Patient: ["identifier", "name", "gender", "birthDate", "address", "telecom"],
  Observation: ["code", "value", "effectiveDateTime", "status", "category"],
  Condition: ["code", "clinicalStatus", "verificationStatus", "onsetDateTime", "subject"],
  MedicationRequest: ["medication", "dosageInstruction", "status", "intent", "subject"],
  Procedure: ["code", "status", "performedDateTime", "subject"],
  Immunization: ["vaccineCode", "occurrenceDateTime", "status", "patient"],
  AllergyIntolerance: ["code", "clinicalStatus", "type", "category", "patient"],
  DiagnosticReport: ["code", "status", "effectiveDateTime", "result", "subject"],
};

const UNIT_CONVERSIONS: Record<string, Record<string, { factor: number; targetUnit: string; converter?: (v: number) => number }>> = {
  "weight": {
    "[lb_av]": { factor: 0.453592, targetUnit: "kg" },
    "lb": { factor: 0.453592, targetUnit: "kg" },
    "oz": { factor: 0.0283495, targetUnit: "kg" },
    "g": { factor: 0.001, targetUnit: "kg" },
  },
  "height": {
    "[in_i]": { factor: 2.54, targetUnit: "cm" },
    "in": { factor: 2.54, targetUnit: "cm" },
    "ft": { factor: 30.48, targetUnit: "cm" },
    "m": { factor: 100, targetUnit: "cm" },
  },
  "temperature": {
    "[degF]": { factor: 1, targetUnit: "Cel", converter: (v: number) => (v - 32) * 5/9 },
    "degF": { factor: 1, targetUnit: "Cel", converter: (v: number) => (v - 32) * 5/9 },
  },
  "glucose": {
    "mg/dL": { factor: 0.0555, targetUnit: "mmol/L" },
  },
  "cholesterol": {
    "mg/dL": { factor: 0.0259, targetUnit: "mmol/L" },
  },
};

export class AIHarmonizationEngine {
  private rulesCache: Map<string, typeof harmonizationRules.$inferSelect[]> = new Map();

  async harmonizeRecords(
    userId: string,
    recordIds: string[],
    options: HarmonizationOptions = {}
  ): Promise<HarmonizationResult> {
    const records = await db
      .select()
      .from(healthRecords)
      .where(and(
        eq(healthRecords.userId, userId),
        inArray(healthRecords.id, recordIds)
      ));

    if (records.length === 0) {
      throw new Error("No records found for harmonization");
    }

    const resourceTypes = [...new Set(records.map(r => r.fhirResourceType || r.type))];
    if (resourceTypes.length > 1) {
      throw new Error("Cannot harmonize records of different resource types");
    }

    const resourceType = resourceTypes[0] || "Unknown";
    const terminologyMappings: TerminologyMappingResult[] = [];
    const conflicts: DataConflictResult[] = [];

    const rawResources = records
      .filter(r => r.rawFhirJson)
      .map(r => ({
        id: r.id,
        sourceId: r.sourceId,
        data: r.rawFhirJson as FhirResource
      }));

    const canonicalData = await this.mergeResources(
      rawResources,
      resourceType,
      options,
      terminologyMappings,
      conflicts
    );

    const harmonizationScore = this.calculateHarmonizationScore(
      canonicalData,
      terminologyMappings,
      conflicts
    );

    if (options.validateResult !== false) {
      const validationResult = await validationEngine.validateResource(canonicalData as FhirResource, {
        suggestCorrections: false,
      });

      if (!validationResult.isValid) {
        canonicalData._validationIssues = validationResult.issues;
      }
    }

    const result: HarmonizationResult = {
      success: true,
      resourceType,
      sourceRecordIds: recordIds,
      canonicalData,
      terminologyMappings,
      conflicts,
      harmonizationScore,
      harmonizedAt: new Date(),
    };

    await this.saveCanonicalView(userId, result);

    for (const conflict of conflicts) {
      if (!conflict.resolution) {
        await this.saveConflict(userId, recordIds, conflict);
      }
    }

    return result;
  }

  private async mergeResources(
    resources: Array<{ id: string; sourceId: string | null; data: FhirResource }>,
    resourceType: string,
    options: HarmonizationOptions,
    terminologyMappings: TerminologyMappingResult[],
    conflicts: DataConflictResult[]
  ): Promise<Record<string, unknown>> {
    if (resources.length === 0) {
      return { resourceType };
    }

    if (resources.length === 1) {
      const harmonized = await this.harmonizeSingleResource(
        resources[0].data,
        options,
        terminologyMappings
      );
      return harmonized;
    }

    const canonical: Record<string, unknown> = {
      resourceType,
      meta: {
        profile: [],
        source: "harmonization-engine",
        lastUpdated: new Date().toISOString(),
      },
    };

    const priorityFields = FIELD_PRIORITY[resourceType] || Object.keys(resources[0].data);

    for (const field of priorityFields) {
      const fieldValues = resources
        .filter(r => r.data[field] !== undefined && r.data[field] !== null)
        .map(r => ({
          sourceId: r.sourceId || r.id,
          value: r.data[field],
          recordId: r.id,
        }));

      if (fieldValues.length === 0) continue;

      if (fieldValues.length === 1) {
        canonical[field] = await this.harmonizeFieldValue(
          field,
          fieldValues[0].value,
          options,
          terminologyMappings
        );
        continue;
      }

      const uniqueValues = this.getUniqueValues(fieldValues);
      
      if (uniqueValues.length === 1) {
        canonical[field] = await this.harmonizeFieldValue(
          field,
          fieldValues[0].value,
          options,
          terminologyMappings
        );
        continue;
      }

      const conflict: DataConflictResult = {
        field,
        conflictType: this.determineConflictType(field, fieldValues),
        values: fieldValues.map(v => ({ sourceId: v.sourceId, value: v.value })),
      };

      const resolution = await this.resolveConflict(conflict, options);
      if (resolution !== undefined) {
        conflict.resolution = resolution.value;
        conflict.resolutionMethod = resolution.method;
        canonical[field] = await this.harmonizeFieldValue(
          field,
          resolution.value,
          options,
          terminologyMappings
        );
      }

      conflicts.push(conflict);
    }

    for (const resource of resources) {
      for (const [key, value] of Object.entries(resource.data)) {
        if (!(key in canonical) && !priorityFields.includes(key) && key !== "resourceType") {
          canonical[key] = await this.harmonizeFieldValue(
            key,
            value,
            options,
            terminologyMappings
          );
        }
      }
    }

    return canonical;
  }

  private async harmonizeSingleResource(
    resource: FhirResource,
    options: HarmonizationOptions,
    terminologyMappings: TerminologyMappingResult[]
  ): Promise<Record<string, unknown>> {
    const harmonized: Record<string, unknown> = { ...resource };

    for (const [key, value] of Object.entries(resource)) {
      harmonized[key] = await this.harmonizeFieldValue(
        key,
        value,
        options,
        terminologyMappings
      );
    }

    return harmonized;
  }

  private async harmonizeFieldValue(
    field: string,
    value: unknown,
    options: HarmonizationOptions,
    terminologyMappings: TerminologyMappingResult[]
  ): Promise<unknown> {
    if (value === null || value === undefined) return value;

    if (this.isCodeableConcept(value)) {
      return await this.harmonizeCodeableConcept(
        field,
        value as CodeableConcept,
        options,
        terminologyMappings
      );
    }

    if (this.isQuantity(value)) {
      return this.normalizeQuantity(field, value as QuantityValue);
    }

    if (typeof value === "string" && this.isDateString(value)) {
      return this.normalizeDateTime(value);
    }

    if (Array.isArray(value)) {
      return Promise.all(
        value.map(item => this.harmonizeFieldValue(field, item, options, terminologyMappings))
      );
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = await this.harmonizeFieldValue(`${field}.${k}`, v, options, terminologyMappings);
      }
      return result;
    }

    return value;
  }

  private async harmonizeCodeableConcept(
    field: string,
    concept: CodeableConcept,
    options: HarmonizationOptions,
    terminologyMappings: TerminologyMappingResult[]
  ): Promise<CodeableConcept> {
    if (!concept.coding?.length) return concept;

    const harmonized: CodeableConcept = {
      ...concept,
      coding: [...(concept.coding || [])],
    };

    const preferredSystem = options.preferredTerminology || "http://snomed.info/sct";

    for (const coding of concept.coding || []) {
      if (!coding.system || !coding.code) continue;
      if (coding.system === preferredSystem) continue;

      const mapping = await terminologyService.translateCode(
        coding.system,
        coding.code,
        preferredSystem
      );

      if (mapping) {
        const alreadyHas = harmonized.coding?.some(
          c => c.system === mapping.targetSystem && c.code === mapping.targetCode
        );

        if (!alreadyHas) {
          harmonized.coding?.push({
            system: mapping.targetSystem,
            code: mapping.targetCode,
            display: mapping.targetDisplay,
          });

          terminologyMappings.push({
            field,
            originalSystem: mapping.sourceSystem,
            originalCode: mapping.sourceCode,
            mappedSystem: mapping.targetSystem,
            mappedCode: mapping.targetCode,
            mappedDisplay: mapping.targetDisplay,
            confidence: mapping.confidence,
          });
        }
      }
    }

    return harmonized;
  }

  private normalizeQuantity(field: string, quantity: QuantityValue): QuantityValue {
    if (!quantity.value || !quantity.unit && !quantity.code) {
      return quantity;
    }

    const unitCode = quantity.code || quantity.unit || "";
    
    const measureType = this.getMeasureType(field, unitCode);
    if (!measureType) return quantity;

    const conversions = UNIT_CONVERSIONS[measureType];
    if (!conversions) return quantity;

    const conversion = conversions[unitCode];
    if (!conversion) return quantity;

    let convertedValue: number;
    if ("converter" in conversion && typeof conversion.converter === "function") {
      convertedValue = conversion.converter(quantity.value);
    } else {
      convertedValue = quantity.value * conversion.factor;
    }

    return {
      ...quantity,
      value: Math.round(convertedValue * 100) / 100,
      unit: conversion.targetUnit,
      code: conversion.targetUnit,
      system: "http://unitsofmeasure.org",
    };
  }

  private getMeasureType(field: string, unit: string): string | null {
    const fieldLower = field.toLowerCase();
    
    if (fieldLower.includes("weight") || fieldLower.includes("mass")) return "weight";
    if (fieldLower.includes("height") || fieldLower.includes("length")) return "height";
    if (fieldLower.includes("temp")) return "temperature";
    if (fieldLower.includes("glucose")) return "glucose";
    if (fieldLower.includes("cholesterol")) return "cholesterol";

    for (const [measureType, conversions] of Object.entries(UNIT_CONVERSIONS)) {
      if (unit in conversions) return measureType;
    }

    return null;
  }

  private normalizeDateTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString();
    } catch {
      return dateString;
    }
  }

  private getUniqueValues(fieldValues: Array<{ sourceId: string; value: unknown }>): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const { value } of fieldValues) {
      const serialized = JSON.stringify(value);
      if (!seen.has(serialized)) {
        seen.add(serialized);
        unique.push(value);
      }
    }

    return unique;
  }

  private determineConflictType(field: string, values: Array<{ value: unknown }>): string {
    if (values.some(v => typeof v.value === "string" && this.isDateString(v.value as string))) {
      return "date_mismatch";
    }

    if (values.every(v => this.isCodeableConcept(v.value))) {
      return "semantic";
    }

    return "value_mismatch";
  }

  private async resolveConflict(
    conflict: DataConflictResult,
    options: HarmonizationOptions
  ): Promise<{ value: unknown; method: string } | undefined> {
    const strategy = options.conflictResolution || "most_complete";

    switch (strategy) {
      case "latest":
        return {
          value: conflict.values[conflict.values.length - 1]?.value,
          method: "latest",
        };

      case "earliest":
        return {
          value: conflict.values[0]?.value,
          method: "earliest",
        };

      case "most_complete":
        const mostComplete = conflict.values.reduce((best, current) => {
          const bestScore = this.calculateCompletenessScore(best.value);
          const currentScore = this.calculateCompletenessScore(current.value);
          return currentScore > bestScore ? current : best;
        });
        return {
          value: mostComplete.value,
          method: "most_complete",
        };

      case "highest_confidence":
        if (conflict.conflictType === "semantic") {
          const semanticResolution = await this.resolveSemanticConflict(conflict);
          if (semanticResolution) return semanticResolution;
        }
        return {
          value: conflict.values[0]?.value,
          method: "highest_confidence_fallback",
        };

      case "manual":
        return undefined;

      default:
        return {
          value: conflict.values[0]?.value,
          method: "default",
        };
    }
  }

  private async resolveSemanticConflict(
    conflict: DataConflictResult
  ): Promise<{ value: unknown; method: string } | undefined> {
    const codeableConcepts = conflict.values
      .filter(v => this.isCodeableConcept(v.value))
      .map(v => v.value as CodeableConcept);

    if (codeableConcepts.length < 2) return undefined;

    const allCodes = codeableConcepts.flatMap(c => c.coding || []);
    
    const snomedCodes = allCodes.filter(c => c.system === "http://snomed.info/sct");
    if (snomedCodes.length > 0) {
      return {
        value: { coding: snomedCodes, text: codeableConcepts[0].text },
        method: "prefer_snomed",
      };
    }

    const loincCodes = allCodes.filter(c => c.system === "http://loinc.org");
    if (loincCodes.length > 0) {
      return {
        value: { coding: loincCodes, text: codeableConcepts[0].text },
        method: "prefer_loinc",
      };
    }

    return undefined;
  }

  private calculateCompletenessScore(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value !== "object") return 1;

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.calculateCompletenessScore(item), 0);
    }

    const obj = value as Record<string, unknown>;
    let score = 0;

    for (const v of Object.values(obj)) {
      if (v !== null && v !== undefined) {
        score += 1 + this.calculateCompletenessScore(v) * 0.5;
      }
    }

    return score;
  }

  private calculateHarmonizationScore(
    canonicalData: Record<string, unknown>,
    terminologyMappings: TerminologyMappingResult[],
    conflicts: DataConflictResult[]
  ): number {
    let score = 100;

    const unresolvedConflicts = conflicts.filter(c => !c.resolution);
    score -= unresolvedConflicts.length * 10;

    const avgMappingConfidence = terminologyMappings.length > 0
      ? terminologyMappings.reduce((sum, m) => sum + m.confidence, 0) / terminologyMappings.length
      : 100;
    score = score * (avgMappingConfidence / 100);

    const resourceType = canonicalData.resourceType as string;
    const requiredFields = FIELD_PRIORITY[resourceType] || [];
    const presentFields = requiredFields.filter(f => canonicalData[f] !== undefined);
    const fieldCompleteness = requiredFields.length > 0
      ? presentFields.length / requiredFields.length
      : 1;
    score = score * fieldCompleteness;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async saveCanonicalView(
    userId: string,
    result: HarmonizationResult
  ): Promise<void> {
    const insertData: InsertCanonicalPatientView = {
      userId,
      resourceType: result.resourceType,
      canonicalData: result.canonicalData as Record<string, unknown>,
      sourceRecordIds: result.sourceRecordIds as unknown as Record<string, unknown>,
      terminologyMappings: result.terminologyMappings as unknown as Record<string, unknown>,
      harmonizationScore: result.harmonizationScore,
      lastHarmonizedAt: result.harmonizedAt,
    };

    await db.insert(canonicalPatientViews).values(insertData);
  }

  private async saveConflict(
    userId: string,
    recordIds: string[],
    conflict: DataConflictResult
  ): Promise<void> {
    const insertData: InsertDataConflict = {
      userId,
      recordIds: recordIds as unknown as Record<string, unknown>,
      conflictType: conflict.conflictType,
      field: conflict.field,
      values: conflict.values as unknown as Record<string, unknown>,
      resolution: conflict.resolutionMethod,
      isResolved: !!conflict.resolution,
    };

    await db.insert(dataConflicts).values(insertData);
  }

  async getUnresolvedConflicts(userId: string): Promise<typeof dataConflicts.$inferSelect[]> {
    return db
      .select()
      .from(dataConflicts)
      .where(and(
        eq(dataConflicts.userId, userId),
        eq(dataConflicts.isResolved, false)
      ));
  }

  async resolveConflictManually(
    conflictId: string,
    resolvedValue: unknown,
    resolvedBy: string
  ): Promise<void> {
    await db
      .update(dataConflicts)
      .set({
        resolvedValue: resolvedValue as Record<string, unknown>,
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      })
      .where(eq(dataConflicts.id, conflictId));
  }

  async getCanonicalViews(
    userId: string,
    resourceType?: string
  ): Promise<typeof canonicalPatientViews.$inferSelect[]> {
    if (resourceType) {
      return db
        .select()
        .from(canonicalPatientViews)
        .where(and(
          eq(canonicalPatientViews.userId, userId),
          eq(canonicalPatientViews.resourceType, resourceType)
        ));
    }

    return db
      .select()
      .from(canonicalPatientViews)
      .where(eq(canonicalPatientViews.userId, userId));
  }

  async getHarmonizationStatistics(userId: string): Promise<{
    totalCanonicalViews: number;
    byResourceType: Record<string, number>;
    averageScore: number;
    unresolvedConflicts: number;
    terminologyMappingCount: number;
  }> {
    const views = await this.getCanonicalViews(userId);
    const conflicts = await this.getUnresolvedConflicts(userId);

    const stats = {
      totalCanonicalViews: views.length,
      byResourceType: {} as Record<string, number>,
      averageScore: 0,
      unresolvedConflicts: conflicts.length,
      terminologyMappingCount: 0,
    };

    let totalScore = 0;

    for (const view of views) {
      stats.byResourceType[view.resourceType] = (stats.byResourceType[view.resourceType] || 0) + 1;
      totalScore += view.harmonizationScore || 0;

      if (Array.isArray(view.terminologyMappings)) {
        stats.terminologyMappingCount += view.terminologyMappings.length;
      }
    }

    stats.averageScore = views.length > 0 ? Math.round(totalScore / views.length) : 0;

    return stats;
  }

  private isCodeableConcept(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return "coding" in obj || "text" in obj;
  }

  private isQuantity(value: unknown): boolean {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return "value" in obj && (typeof obj.value === "number") && ("unit" in obj || "code" in obj);
  }

  private isDateString(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
}

interface QuantityValue {
  value?: number;
  unit?: string;
  code?: string;
  system?: string;
  comparator?: string;
}

export const harmonizationEngine = new AIHarmonizationEngine();
