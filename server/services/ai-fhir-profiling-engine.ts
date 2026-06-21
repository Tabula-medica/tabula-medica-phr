import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";

export type ProfileStatus = "draft" | "active" | "retired" | "deprecated";
export type DeviationType = "missing_element" | "cardinality_violation" | "type_mismatch" | "value_set_violation" | "constraint_violation" | "extension_required" | "slicing_issue";
export type PatternType = "common_extension" | "recurring_structure" | "value_pattern" | "coding_pattern" | "reference_pattern" | "identifier_pattern";
export type SuggestionType = "custom_profile" | "extension" | "value_set" | "constraint" | "slice_definition";

export interface FHIRProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  status: ProfileStatus;
  description: string;
  baseDefinition: string;
  resourceType: string;
  elements: ProfileElement[];
  extensions: ProfileExtension[];
  constraints: ProfileConstraint[];
  valueSets: ProfileValueSet[];
  slicings: ProfileSlicing[];
  metadata: ProfileMetadata;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ProfileElement {
  path: string;
  min: number;
  max: string;
  type: string[];
  binding?: {
    strength: "required" | "extensible" | "preferred" | "example";
    valueSetUrl: string;
  };
  fixedValue?: unknown;
  pattern?: unknown;
  mustSupport: boolean;
  description?: string;
}

export interface ProfileExtension {
  url: string;
  name: string;
  description: string;
  context: string[];
  valueType: string;
  cardinality: { min: number; max: string };
}

export interface ProfileConstraint {
  key: string;
  severity: "error" | "warning";
  human: string;
  expression: string;
  xpath?: string;
}

export interface ProfileValueSet {
  url: string;
  name: string;
  description: string;
  codes: Array<{ code: string; display: string; system: string }>;
}

export interface ProfileSlicing {
  path: string;
  discriminator: Array<{ type: string; path: string }>;
  rules: "open" | "closed" | "openAtEnd";
  ordered: boolean;
  slices: Array<{ name: string; min: number; max: string; condition?: string }>;
}

export interface ProfileMetadata {
  usageCount: number;
  lastUsedAt?: string;
  sourceAnalysisId?: string;
  aiGenerated: boolean;
  confidence: number;
  tags: string[];
  dataMappingReferences: string[];
}

export interface PatternAnalysis {
  id: string;
  resourceType: string;
  analysisDate: string;
  resourceCount: number;
  patterns: DetectedPattern[];
  deviations: ProfileDeviation[];
  suggestions: ProfileSuggestion[];
  summary: AnalysisSummary;
}

export interface DetectedPattern {
  id: string;
  type: PatternType;
  path: string;
  description: string;
  frequency: number;
  examples: unknown[];
  significance: "high" | "medium" | "low";
  suggestedAction?: string;
}

export interface ProfileDeviation {
  id: string;
  type: DeviationType;
  resourceId: string;
  path: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  profileUrl: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

export interface ProfileSuggestion {
  id: string;
  type: SuggestionType;
  name: string;
  description: string;
  rationale: string;
  confidence: number;
  impact: "high" | "medium" | "low";
  implementation: SuggestionImplementation;
  relatedPatterns: string[];
  relatedDeviations: string[];
}

export interface SuggestionImplementation {
  profileFragment?: Partial<FHIRProfile>;
  extensionDefinition?: ProfileExtension;
  valueSetDefinition?: ProfileValueSet;
  constraintDefinition?: ProfileConstraint;
  slicingDefinition?: ProfileSlicing;
  mappingGuidance?: string;
}

export interface AnalysisSummary {
  totalPatterns: number;
  highSignificancePatterns: number;
  totalDeviations: number;
  criticalDeviations: number;
  totalSuggestions: number;
  highImpactSuggestions: number;
  overallDataQuality: number;
  harmonizationOpportunities: number;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const STANDARD_FHIR_PROFILES: Record<string, { url: string; elements: string[] }> = {
  Patient: {
    url: "http://hl7.org/fhir/StructureDefinition/Patient",
    elements: ["identifier", "name", "telecom", "gender", "birthDate", "address", "maritalStatus", "contact", "communication", "generalPractitioner", "managingOrganization"],
  },
  Observation: {
    url: "http://hl7.org/fhir/StructureDefinition/Observation",
    elements: ["identifier", "status", "category", "code", "subject", "encounter", "effectiveDateTime", "issued", "performer", "valueQuantity", "interpretation", "note", "bodySite", "method", "specimen", "device", "referenceRange", "component"],
  },
  Condition: {
    url: "http://hl7.org/fhir/StructureDefinition/Condition",
    elements: ["identifier", "clinicalStatus", "verificationStatus", "category", "severity", "code", "bodySite", "subject", "encounter", "onsetDateTime", "abatementDateTime", "recordedDate", "recorder", "asserter", "stage", "evidence", "note"],
  },
  MedicationRequest: {
    url: "http://hl7.org/fhir/StructureDefinition/MedicationRequest",
    elements: ["identifier", "status", "statusReason", "intent", "category", "priority", "medicationCodeableConcept", "medicationReference", "subject", "encounter", "authoredOn", "requester", "performer", "reasonCode", "reasonReference", "dosageInstruction", "dispenseRequest", "substitution"],
  },
  Encounter: {
    url: "http://hl7.org/fhir/StructureDefinition/Encounter",
    elements: ["identifier", "status", "class", "type", "serviceType", "priority", "subject", "episodeOfCare", "basedOn", "participant", "appointment", "period", "length", "reasonCode", "diagnosis", "hospitalization", "location", "serviceProvider"],
  },
  Procedure: {
    url: "http://hl7.org/fhir/StructureDefinition/Procedure",
    elements: ["identifier", "instantiatesCanonical", "basedOn", "partOf", "status", "statusReason", "category", "code", "subject", "encounter", "performedDateTime", "performedPeriod", "recorder", "asserter", "performer", "location", "reasonCode", "reasonReference", "bodySite", "outcome", "report", "complication", "followUp", "note", "focalDevice", "usedReference", "usedCode"],
  },
  DiagnosticReport: {
    url: "http://hl7.org/fhir/StructureDefinition/DiagnosticReport",
    elements: ["identifier", "basedOn", "status", "category", "code", "subject", "encounter", "effectiveDateTime", "issued", "performer", "resultsInterpreter", "specimen", "result", "imagingStudy", "media", "conclusion", "conclusionCode", "presentedForm"],
  },
  AllergyIntolerance: {
    url: "http://hl7.org/fhir/StructureDefinition/AllergyIntolerance",
    elements: ["identifier", "clinicalStatus", "verificationStatus", "type", "category", "criticality", "code", "patient", "encounter", "onsetDateTime", "recordedDate", "recorder", "asserter", "lastOccurrence", "note", "reaction"],
  },
};

const US_CORE_EXTENSIONS = [
  { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", name: "US Core Race", context: ["Patient"] },
  { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", name: "US Core Ethnicity", context: ["Patient"] },
  { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", name: "US Core Birth Sex", context: ["Patient"] },
  { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity", name: "US Core Gender Identity", context: ["Patient"] },
];

class AIFHIRProfilingEngine {
  private profiles: Map<string, FHIRProfile> = new Map();
  private analyses: Map<string, PatternAnalysis> = new Map();
  private openai: OpenAI | null = null;

  constructor() {
    this.initializeOpenAI();
    this.seedSampleProfiles();
    console.log("[AIFHIRProfilingEngine] Service initialized");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (apiKey && baseURL) {
      this.openai = new OpenAI({ apiKey, baseURL });
      console.log("[AIFHIRProfilingEngine] OpenAI client configured");
    } else {
      console.log("[AIFHIRProfilingEngine] OpenAI not configured, using rule-based analysis");
    }
  }

  private seedSampleProfiles(): void {
    const usCorePatiProfile: FHIRProfile = {
      id: randomUUID(),
      name: "US Core Patient Profile",
      url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      version: "6.1.0",
      status: "active",
      description: "Defines constraints on the Patient resource for US Core data elements and vocabulary",
      baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
      resourceType: "Patient",
      elements: [
        { path: "Patient.identifier", min: 1, max: "*", type: ["Identifier"], mustSupport: true, description: "An identifier for this patient" },
        { path: "Patient.name", min: 1, max: "*", type: ["HumanName"], mustSupport: true, description: "A name associated with the patient" },
        { path: "Patient.gender", min: 1, max: "1", type: ["code"], mustSupport: true, binding: { strength: "required", valueSetUrl: "http://hl7.org/fhir/ValueSet/administrative-gender" } },
        { path: "Patient.birthDate", min: 0, max: "1", type: ["date"], mustSupport: true },
      ],
      extensions: [
        { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", name: "Race", description: "US Core Race Extension", context: ["Patient"], valueType: "complex", cardinality: { min: 0, max: "1" } },
        { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", name: "Ethnicity", description: "US Core Ethnicity Extension", context: ["Patient"], valueType: "complex", cardinality: { min: 0, max: "1" } },
      ],
      constraints: [
        { key: "us-core-1", severity: "error", human: "Patient.name.family or Patient.name.given or both SHALL be present", expression: "name.family.exists() or name.given.exists()" },
      ],
      valueSets: [],
      slicings: [],
      metadata: {
        usageCount: 156,
        lastUsedAt: new Date().toISOString(),
        aiGenerated: false,
        confidence: 1.0,
        tags: ["us-core", "patient", "standard"],
        dataMappingReferences: [],
      },
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system",
    };

    const customVitalsProfile: FHIRProfile = {
      id: randomUUID(),
      name: "Custom Vital Signs Profile",
      url: "http://tabulamedica.com/fhir/StructureDefinition/custom-vitals",
      version: "1.0.0",
      status: "active",
      description: "Custom profile for vital signs with enhanced precision requirements and source tracking",
      baseDefinition: "http://hl7.org/fhir/StructureDefinition/Observation",
      resourceType: "Observation",
      elements: [
        { path: "Observation.status", min: 1, max: "1", type: ["code"], mustSupport: true },
        { path: "Observation.category", min: 1, max: "*", type: ["CodeableConcept"], mustSupport: true },
        { path: "Observation.code", min: 1, max: "1", type: ["CodeableConcept"], mustSupport: true, binding: { strength: "extensible", valueSetUrl: "http://hl7.org/fhir/ValueSet/observation-vitalsignresult" } },
        { path: "Observation.subject", min: 1, max: "1", type: ["Reference"], mustSupport: true },
        { path: "Observation.effectiveDateTime", min: 1, max: "1", type: ["dateTime"], mustSupport: true },
        { path: "Observation.valueQuantity", min: 0, max: "1", type: ["Quantity"], mustSupport: true },
        { path: "Observation.device", min: 0, max: "1", type: ["Reference"], mustSupport: true, description: "Source device for the measurement" },
      ],
      extensions: [
        { url: "http://tabulamedica.com/fhir/StructureDefinition/measurement-precision", name: "Measurement Precision", description: "Indicates the precision level of the vital sign measurement", context: ["Observation"], valueType: "decimal", cardinality: { min: 0, max: "1" } },
        { url: "http://tabulamedica.com/fhir/StructureDefinition/data-source-confidence", name: "Data Source Confidence", description: "Confidence score for the data source", context: ["Observation"], valueType: "decimal", cardinality: { min: 0, max: "1" } },
      ],
      constraints: [
        { key: "vitals-1", severity: "error", human: "If valueQuantity is present, unit must be specified", expression: "valueQuantity.exists() implies valueQuantity.unit.exists()" },
        { key: "vitals-2", severity: "warning", human: "Device should be specified for automated measurements", expression: "category.coding.where(code='vital-signs').exists() implies device.exists()" },
      ],
      valueSets: [],
      slicings: [],
      metadata: {
        usageCount: 89,
        lastUsedAt: new Date().toISOString(),
        aiGenerated: true,
        confidence: 0.92,
        tags: ["vital-signs", "custom", "precision", "device-tracking"],
        dataMappingReferences: ["mapping-vitals-ehr-1", "mapping-vitals-device-2"],
      },
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: hashIdentifier("admin-user-123"),
    };

    this.profiles.set(usCorePatiProfile.id, usCorePatiProfile);
    this.profiles.set(customVitalsProfile.id, customVitalsProfile);
  }

  async analyzeResources(
    resources: Array<{ resourceType: string; resource: Record<string, unknown> }>,
    options: { targetProfile?: string; detectPatterns?: boolean; suggestProfiles?: boolean } = {}
  ): Promise<PatternAnalysis> {
    const analysisId = randomUUID();
    const resourcesByType = new Map<string, Array<Record<string, unknown>>>();

    for (const { resourceType, resource } of resources) {
      if (!resourcesByType.has(resourceType)) {
        resourcesByType.set(resourceType, []);
      }
      resourcesByType.get(resourceType)!.push(resource);
    }

    const allPatterns: DetectedPattern[] = [];
    const allDeviations: ProfileDeviation[] = [];
    const allSuggestions: ProfileSuggestion[] = [];

    for (const [resourceType, typeResources] of Array.from(resourcesByType.entries())) {
      const patterns = options.detectPatterns !== false ? await this.detectPatterns(resourceType, typeResources) : [];
      const deviations = await this.detectDeviations(resourceType, typeResources, options.targetProfile);
      const suggestions = options.suggestProfiles !== false ? await this.generateSuggestions(resourceType, patterns, deviations, typeResources) : [];

      allPatterns.push(...patterns);
      allDeviations.push(...deviations);
      allSuggestions.push(...suggestions);
    }

    const analysis: PatternAnalysis = {
      id: analysisId,
      resourceType: resources.length > 0 ? resources[0].resourceType : "Mixed",
      analysisDate: new Date().toISOString(),
      resourceCount: resources.length,
      patterns: allPatterns,
      deviations: allDeviations,
      suggestions: allSuggestions,
      summary: this.generateSummary(allPatterns, allDeviations, allSuggestions),
    };

    this.analyses.set(analysisId, analysis);
    return analysis;
  }

  private async detectPatterns(resourceType: string, resources: Array<Record<string, unknown>>): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];
    const fieldUsage = new Map<string, { count: number; values: unknown[] }>();

    for (const resource of resources) {
      this.analyzeFields(resource, "", fieldUsage);
    }

    for (const [path, usage] of Array.from(fieldUsage.entries())) {
      const frequency = usage.count / resources.length;
      
      if (frequency > 0.8 && !this.isStandardField(resourceType, path)) {
        patterns.push({
          id: randomUUID(),
          type: "common_extension",
          path,
          description: `Field "${path}" appears in ${Math.round(frequency * 100)}% of ${resourceType} resources`,
          frequency,
          examples: usage.values.slice(0, 3),
          significance: frequency > 0.95 ? "high" : frequency > 0.85 ? "medium" : "low",
          suggestedAction: `Consider creating a profile element or extension for "${path}"`,
        });
      }

      if (this.hasPatternValue(usage.values)) {
        const patternValue = this.extractPattern(usage.values);
        if (patternValue) {
          patterns.push({
            id: randomUUID(),
            type: "value_pattern",
            path,
            description: `Consistent value pattern detected in "${path}"`,
            frequency,
            examples: usage.values.slice(0, 3),
            significance: "medium",
            suggestedAction: `Consider adding a fixed or pattern value constraint`,
          });
        }
      }

      if (path.includes("coding") || path.includes("code")) {
        const codeSystems = this.extractCodeSystems(usage.values);
        if (codeSystems.length > 0) {
          patterns.push({
            id: randomUUID(),
            type: "coding_pattern",
            path,
            description: `Consistent coding system usage: ${codeSystems.join(", ")}`,
            frequency,
            examples: usage.values.slice(0, 3),
            significance: codeSystems.length === 1 ? "high" : "medium",
            suggestedAction: `Consider binding to a specific value set`,
          });
        }
      }

      if (path.includes("identifier")) {
        const identifierSystems = this.extractIdentifierSystems(usage.values);
        if (identifierSystems.length > 0) {
          patterns.push({
            id: randomUUID(),
            type: "identifier_pattern",
            path,
            description: `Identifier system pattern: ${identifierSystems.slice(0, 2).join(", ")}`,
            frequency,
            examples: [],
            significance: "high",
            suggestedAction: `Define identifier slicing for system-specific identifiers`,
          });
        }
      }
    }

    if (this.openai && patterns.length > 0) {
      try {
        const enhancedPatterns = await this.enhancePatternsWithAI(resourceType, patterns, resources.slice(0, 5));
        return enhancedPatterns;
      } catch (error) {
        console.log("[AIFHIRProfilingEngine] AI enhancement failed, using rule-based patterns");
      }
    }

    return patterns;
  }

  private analyzeFields(obj: unknown, prefix: string, usage: Map<string, { count: number; values: unknown[] }>): void {
    if (obj === null || obj === undefined) return;
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.analyzeFields(item, `${prefix}[${index}]`, usage);
      });
      return;
    }
    
    if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (!usage.has(path)) {
          usage.set(path, { count: 0, values: [] });
        }
        const entry = usage.get(path)!;
        entry.count++;
        if (entry.values.length < 10) {
          entry.values.push(value);
        }
        this.analyzeFields(value, path, usage);
      }
    }
  }

  private isStandardField(resourceType: string, path: string): boolean {
    const cleanPath = path.replace(/\[\d+\]/g, "");
    const baseField = cleanPath.split(".")[0];
    const standardProfile = STANDARD_FHIR_PROFILES[resourceType];
    if (!standardProfile) return false;
    return standardProfile.elements.includes(baseField);
  }

  private hasPatternValue(values: unknown[]): boolean {
    if (values.length < 3) return false;
    const stringValues = values.filter(v => typeof v === "string") as string[];
    if (stringValues.length < 3) return false;

    const prefixes = stringValues.map(v => v.substring(0, Math.min(v.length, 5)));
    const uniquePrefixes = new Set(prefixes);
    return uniquePrefixes.size === 1;
  }

  private extractPattern(values: unknown[]): string | null {
    const stringValues = values.filter(v => typeof v === "string") as string[];
    if (stringValues.length < 2) return null;
    
    let commonPrefix = stringValues[0];
    for (const val of stringValues.slice(1)) {
      while (!val.startsWith(commonPrefix) && commonPrefix.length > 0) {
        commonPrefix = commonPrefix.substring(0, commonPrefix.length - 1);
      }
    }
    return commonPrefix.length > 2 ? commonPrefix : null;
  }

  private extractCodeSystems(values: unknown[]): string[] {
    const systems = new Set<string>();
    for (const val of values) {
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, unknown>;
        if (obj.system && typeof obj.system === "string") {
          systems.add(obj.system);
        }
        if (Array.isArray(obj.coding)) {
          for (const coding of obj.coding) {
            if (coding.system) systems.add(coding.system);
          }
        }
      }
    }
    return Array.from(systems);
  }

  private extractIdentifierSystems(values: unknown[]): string[] {
    const systems = new Set<string>();
    for (const val of values) {
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, unknown>;
        if (obj.system && typeof obj.system === "string") {
          systems.add(obj.system);
        }
      }
      if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === "object" && item !== null && (item as Record<string, unknown>).system) {
            systems.add((item as Record<string, unknown>).system as string);
          }
        }
      }
    }
    return Array.from(systems);
  }

  private async detectDeviations(
    resourceType: string,
    resources: Array<Record<string, unknown>>,
    targetProfileUrl?: string
  ): Promise<ProfileDeviation[]> {
    const deviations: ProfileDeviation[] = [];
    const profile = targetProfileUrl 
      ? Array.from(this.profiles.values()).find(p => p.url === targetProfileUrl)
      : Array.from(this.profiles.values()).find(p => p.resourceType === resourceType && p.status === "active");

    const standardProfile = STANDARD_FHIR_PROFILES[resourceType];
    const profileUrl = profile?.url || standardProfile?.url || "http://hl7.org/fhir/StructureDefinition/" + resourceType;

    for (const resource of resources) {
      const resourceId = hashIdentifier(String(resource.id || randomUUID()));

      if (profile) {
        for (const element of profile.elements) {
          const pathParts = element.path.split(".").slice(1);
          const value = this.getNestedValue(resource, pathParts);
          
          if (element.min > 0 && (value === undefined || value === null)) {
            deviations.push({
              id: randomUUID(),
              type: "missing_element",
              resourceId,
              path: element.path,
              expectedValue: `Required (min: ${element.min})`,
              actualValue: undefined,
              profileUrl,
              severity: "error",
              message: `Required element "${element.path}" is missing`,
              suggestion: `Add the required element with appropriate value`,
            });
          }

          if (value !== undefined && element.max !== "*") {
            const maxNum = parseInt(element.max);
            const actualCount = Array.isArray(value) ? value.length : 1;
            if (actualCount > maxNum) {
              deviations.push({
                id: randomUUID(),
                type: "cardinality_violation",
                resourceId,
                path: element.path,
                expectedValue: `max: ${element.max}`,
                actualValue: `count: ${actualCount}`,
                profileUrl,
                severity: "error",
                message: `Element "${element.path}" exceeds maximum cardinality (max: ${element.max}, actual: ${actualCount})`,
              });
            }
          }
        }
      }

      if (!resource.meta || !(resource.meta as Record<string, unknown>).profile) {
        deviations.push({
          id: randomUUID(),
          type: "missing_element",
          resourceId,
          path: "meta.profile",
          expectedValue: "Profile reference",
          actualValue: undefined,
          profileUrl: "http://hl7.org/fhir/StructureDefinition/" + resourceType,
          severity: "info",
          message: "Resource does not declare a profile in meta.profile",
          suggestion: "Add meta.profile to explicitly declare conformance",
        });
      }

      if (resourceType === "Observation" && !resource.category) {
        deviations.push({
          id: randomUUID(),
          type: "missing_element",
          resourceId,
          path: "Observation.category",
          profileUrl,
          severity: "warning",
          message: "Observation category is recommended for proper classification",
          suggestion: "Add category with appropriate LOINC or local codes",
        });
      }
    }

    return deviations;
  }

  private getNestedValue(obj: Record<string, unknown>, pathParts: string[]): unknown {
    let current: unknown = obj;
    for (const part of pathParts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private async generateSuggestions(
    resourceType: string,
    patterns: DetectedPattern[],
    deviations: ProfileDeviation[],
    resources: Array<Record<string, unknown>>
  ): Promise<ProfileSuggestion[]> {
    const suggestions: ProfileSuggestion[] = [];

    const highSignificancePatterns = patterns.filter(p => p.significance === "high");
    if (highSignificancePatterns.length >= 3) {
      const extensionPatterns = highSignificancePatterns.filter(p => p.type === "common_extension");
      
      if (extensionPatterns.length >= 2) {
        suggestions.push({
          id: randomUUID(),
          type: "custom_profile",
          name: `Custom ${resourceType} Profile`,
          description: `A custom profile capturing ${extensionPatterns.length} commonly used extensions and patterns`,
          rationale: `Analysis detected ${extensionPatterns.length} high-frequency custom fields that would benefit from formal definition`,
          confidence: 0.85,
          impact: "high",
          implementation: {
            profileFragment: {
              name: `TabulaMedica-${resourceType}`,
              url: `http://tabulamedica.com/fhir/StructureDefinition/tm-${resourceType.toLowerCase()}`,
              resourceType,
              elements: extensionPatterns.map(p => ({
                path: `${resourceType}.${p.path}`,
                min: p.frequency > 0.95 ? 1 : 0,
                max: "*",
                type: ["Extension"],
                mustSupport: p.frequency > 0.9,
                description: p.description,
              })),
            },
            mappingGuidance: `Map source fields to the defined extension elements. Use the standard FHIR extension mechanism.`,
          },
          relatedPatterns: extensionPatterns.map(p => p.id),
          relatedDeviations: [],
        });
      }
    }

    const codingPatterns = patterns.filter(p => p.type === "coding_pattern");
    for (const pattern of codingPatterns) {
      if (pattern.significance === "high") {
        suggestions.push({
          id: randomUUID(),
          type: "value_set",
          name: `${resourceType} ${pattern.path} ValueSet`,
          description: `Custom value set based on observed coding patterns`,
          rationale: `Consistent coding system detected: ${pattern.description}`,
          confidence: 0.78,
          impact: "medium",
          implementation: {
            valueSetDefinition: {
              url: `http://tabulamedica.com/fhir/ValueSet/tm-${resourceType.toLowerCase()}-${pattern.path.replace(/\./g, "-")}`,
              name: `TM${resourceType}${pattern.path.replace(/\./g, "")}`,
              description: `Value set for ${pattern.path} in ${resourceType}`,
              codes: this.extractCodesFromExamples(pattern.examples),
            },
            mappingGuidance: `Bind ${pattern.path} to this value set with extensible strength`,
          },
          relatedPatterns: [pattern.id],
          relatedDeviations: [],
        });
      }
    }

    const identifierPatterns = patterns.filter(p => p.type === "identifier_pattern");
    if (identifierPatterns.length > 0) {
      suggestions.push({
        id: randomUUID(),
        type: "slice_definition",
        name: `${resourceType} Identifier Slicing`,
        description: `Slice definition for identifier systems`,
        rationale: `Multiple identifier systems detected that would benefit from formal slicing`,
        confidence: 0.82,
        impact: "medium",
        implementation: {
          slicingDefinition: {
            path: `${resourceType}.identifier`,
            discriminator: [{ type: "value", path: "system" }],
            rules: "open",
            ordered: false,
            slices: identifierPatterns.map(p => ({
              name: p.path.replace(/[^\w]/g, ""),
              min: 0,
              max: "1",
              condition: `system = '${p.examples[0] || "system-url"}'`,
            })),
          },
          mappingGuidance: `When mapping identifiers, ensure the correct slice is populated based on the source system`,
        },
        relatedPatterns: identifierPatterns.map(p => p.id),
        relatedDeviations: [],
      });
    }

    const missingElementDeviations = deviations.filter(d => d.type === "missing_element" && d.severity === "error");
    if (missingElementDeviations.length > resources.length * 0.3) {
      const frequentMissing = this.findFrequentMissing(missingElementDeviations);
      if (frequentMissing.length > 0) {
        suggestions.push({
          id: randomUUID(),
          type: "constraint",
          name: `Relaxed Cardinality Constraints`,
          description: `Modify cardinality for frequently missing required elements`,
          rationale: `${frequentMissing.length} required elements are frequently missing, suggesting source data limitations`,
          confidence: 0.7,
          impact: "high",
          implementation: {
            constraintDefinition: {
              key: `tm-cardinality-1`,
              severity: "warning",
              human: `Elements ${frequentMissing.join(", ")} should be present when available`,
              expression: frequentMissing.map(f => `${f}.exists()`).join(" or "),
            },
            mappingGuidance: `Source systems may not always provide these elements. Map when available.`,
          },
          relatedPatterns: [],
          relatedDeviations: missingElementDeviations.slice(0, 5).map(d => d.id),
        });
      }
    }

    if (this.openai && (patterns.length > 0 || deviations.length > 0)) {
      try {
        const aiSuggestions = await this.generateAISuggestions(resourceType, patterns, deviations, resources.slice(0, 3));
        suggestions.push(...aiSuggestions);
      } catch (error) {
        console.log("[AIFHIRProfilingEngine] AI suggestion generation failed");
      }
    }

    return suggestions;
  }

  private extractCodesFromExamples(examples: unknown[]): Array<{ code: string; display: string; system: string }> {
    const codes: Array<{ code: string; display: string; system: string }> = [];
    for (const example of examples) {
      if (typeof example === "object" && example !== null) {
        const obj = example as Record<string, unknown>;
        if (obj.code && obj.system) {
          codes.push({
            code: String(obj.code),
            display: String(obj.display || obj.code),
            system: String(obj.system),
          });
        }
        if (Array.isArray(obj.coding)) {
          for (const coding of obj.coding) {
            if (coding.code && coding.system) {
              codes.push({
                code: String(coding.code),
                display: String(coding.display || coding.code),
                system: String(coding.system),
              });
            }
          }
        }
      }
    }
    return codes;
  }

  private findFrequentMissing(deviations: ProfileDeviation[]): string[] {
    const pathCounts = new Map<string, number>();
    for (const dev of deviations) {
      pathCounts.set(dev.path, (pathCounts.get(dev.path) || 0) + 1);
    }
    return Array.from(pathCounts.entries())
      .filter(([, count]) => count > 2)
      .map(([path]) => path);
  }

  private generateSummary(
    patterns: DetectedPattern[],
    deviations: ProfileDeviation[],
    suggestions: ProfileSuggestion[]
  ): AnalysisSummary {
    const criticalDeviations = deviations.filter(d => d.severity === "error").length;
    const highImpactSuggestions = suggestions.filter(s => s.impact === "high").length;
    
    const deviationPenalty = Math.min(criticalDeviations * 5, 40);
    const overallQuality = Math.max(0, 100 - deviationPenalty - (deviations.length - criticalDeviations));

    return {
      totalPatterns: patterns.length,
      highSignificancePatterns: patterns.filter(p => p.significance === "high").length,
      totalDeviations: deviations.length,
      criticalDeviations,
      totalSuggestions: suggestions.length,
      highImpactSuggestions,
      overallDataQuality: Math.round(overallQuality),
      harmonizationOpportunities: suggestions.filter(s => s.type === "custom_profile" || s.type === "extension").length,
    };
  }

  private async enhancePatternsWithAI(
    resourceType: string,
    patterns: DetectedPattern[],
    sampleResources: Array<Record<string, unknown>>
  ): Promise<DetectedPattern[]> {
    if (!this.openai) return patterns;

    const prompt = `Analyze these FHIR ${resourceType} resource patterns and enhance the descriptions.
DO NOT provide any clinical advice or medical recommendations.
Focus only on data structure patterns and profile improvements.

Patterns detected:
${patterns.slice(0, 5).map(p => `- ${p.type}: ${p.path} (${Math.round(p.frequency * 100)}% frequency)`).join("\n")}

Sample resource structure:
${JSON.stringify(sampleResources[0], null, 2).substring(0, 1000)}

For each pattern, provide:
1. A refined description
2. Why this pattern matters for data harmonization
3. Suggested action for profile definition

Respond in JSON format:
{ "enhancedPatterns": [{ "id": "pattern-id", "refinedDescription": "...", "harmonizationBenefit": "...", "suggestedAction": "..." }] }`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a FHIR profiling expert. Analyze data patterns and suggest profile improvements. Never provide clinical advice." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.enhancedPatterns) {
          for (const enhanced of parsed.enhancedPatterns) {
            const pattern = patterns.find(p => p.id === enhanced.id);
            if (pattern) {
              pattern.description = enhanced.refinedDescription || pattern.description;
              pattern.suggestedAction = enhanced.suggestedAction || pattern.suggestedAction;
            }
          }
        }
      }
    } catch (error) {
      console.log("[AIFHIRProfilingEngine] AI pattern enhancement failed");
    }

    return patterns;
  }

  private async generateAISuggestions(
    resourceType: string,
    patterns: DetectedPattern[],
    deviations: ProfileDeviation[],
    sampleResources: Array<Record<string, unknown>>
  ): Promise<ProfileSuggestion[]> {
    if (!this.openai) return [];

    const prompt = `Based on the FHIR ${resourceType} analysis, suggest custom profiles or extensions.
DO NOT provide any clinical advice or medical recommendations.
Focus only on data structure and harmonization improvements.

Patterns: ${patterns.length} detected (${patterns.filter(p => p.significance === "high").length} high significance)
Deviations: ${deviations.length} detected (${deviations.filter(d => d.severity === "error").length} errors)

Key patterns:
${patterns.slice(0, 3).map(p => `- ${p.type}: ${p.path}`).join("\n")}

Key issues:
${deviations.slice(0, 3).map(d => `- ${d.type}: ${d.path} - ${d.message}`).join("\n")}

Suggest ONE custom extension that would benefit data harmonization.
Response format:
{
  "extension": {
    "name": "Extension Name",
    "url": "http://tabulamedica.com/fhir/StructureDefinition/...",
    "description": "...",
    "rationale": "...",
    "valueType": "string|code|boolean|Reference|etc",
    "context": ["${resourceType}"]
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a FHIR profiling expert. Suggest practical profile improvements. Never provide clinical advice." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.extension) {
          return [{
            id: randomUUID(),
            type: "extension",
            name: parsed.extension.name,
            description: parsed.extension.description,
            rationale: parsed.extension.rationale,
            confidence: 0.75,
            impact: "medium",
            implementation: {
              extensionDefinition: {
                url: parsed.extension.url,
                name: parsed.extension.name,
                description: parsed.extension.description,
                context: parsed.extension.context,
                valueType: parsed.extension.valueType,
                cardinality: { min: 0, max: "1" },
              },
            },
            relatedPatterns: patterns.slice(0, 2).map(p => p.id),
            relatedDeviations: [],
          }];
        }
      }
    } catch (error) {
      console.log("[AIFHIRProfilingEngine] AI suggestion generation failed");
    }

    return [];
  }

  async createProfile(profileData: Omit<FHIRProfile, "id" | "createdAt" | "updatedAt" | "metadata"> & { createdBy: string }): Promise<FHIRProfile> {
    const profile: FHIRProfile = {
      ...profileData,
      id: randomUUID(),
      createdBy: hashIdentifier(profileData.createdBy),
      metadata: {
        usageCount: 0,
        aiGenerated: false,
        confidence: 1.0,
        tags: [],
        dataMappingReferences: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  async updateProfile(id: string, updates: Partial<FHIRProfile>): Promise<FHIRProfile | null> {
    const existing = this.profiles.get(id);
    if (!existing) return null;

    const updated: FHIRProfile = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(id, updated);
    return updated;
  }

  async getProfile(id: string): Promise<FHIRProfile | null> {
    return this.profiles.get(id) || null;
  }

  async getProfileByUrl(url: string): Promise<FHIRProfile | null> {
    return Array.from(this.profiles.values()).find(p => p.url === url) || null;
  }

  async listProfiles(filters?: {
    resourceType?: string;
    status?: ProfileStatus;
    aiGenerated?: boolean;
    tags?: string[];
  }): Promise<FHIRProfile[]> {
    let profiles = Array.from(this.profiles.values());

    if (filters?.resourceType) {
      profiles = profiles.filter(p => p.resourceType === filters.resourceType);
    }
    if (filters?.status) {
      profiles = profiles.filter(p => p.status === filters.status);
    }
    if (filters?.aiGenerated !== undefined) {
      profiles = profiles.filter(p => p.metadata.aiGenerated === filters.aiGenerated);
    }
    if (filters?.tags && filters.tags.length > 0) {
      profiles = profiles.filter(p => filters.tags!.some(t => p.metadata.tags.includes(t)));
    }

    return profiles.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteProfile(id: string): Promise<boolean> {
    return this.profiles.delete(id);
  }

  async linkProfileToDataMapping(profileId: string, dataMappingId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    if (!profile.metadata.dataMappingReferences.includes(dataMappingId)) {
      profile.metadata.dataMappingReferences.push(dataMappingId);
      profile.metadata.usageCount++;
      profile.metadata.lastUsedAt = new Date().toISOString();
      profile.updatedAt = new Date().toISOString();
    }
    return true;
  }

  async unlinkProfileFromDataMapping(profileId: string, dataMappingId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    const index = profile.metadata.dataMappingReferences.indexOf(dataMappingId);
    if (index > -1) {
      profile.metadata.dataMappingReferences.splice(index, 1);
      profile.updatedAt = new Date().toISOString();
    }
    return true;
  }

  async getProfilesForDataMapping(dataMappingId: string): Promise<FHIRProfile[]> {
    return Array.from(this.profiles.values()).filter(p => 
      p.metadata.dataMappingReferences.includes(dataMappingId)
    );
  }

  async getAnalysis(id: string): Promise<PatternAnalysis | null> {
    return this.analyses.get(id) || null;
  }

  async listAnalyses(): Promise<PatternAnalysis[]> {
    return Array.from(this.analyses.values()).sort((a, b) => 
      new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()
    );
  }

  async applySuggestion(suggestionId: string, analysisId: string, userId: string): Promise<FHIRProfile | null> {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) return null;

    const suggestion = analysis.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return null;

    if (suggestion.type === "custom_profile" && suggestion.implementation.profileFragment) {
      const fragment = suggestion.implementation.profileFragment;
      return this.createProfile({
        name: fragment.name || suggestion.name,
        url: fragment.url || `http://tabulamedica.com/fhir/StructureDefinition/${randomUUID()}`,
        version: "1.0.0",
        status: "draft",
        description: suggestion.description,
        baseDefinition: `http://hl7.org/fhir/StructureDefinition/${fragment.resourceType}`,
        resourceType: fragment.resourceType || "Resource",
        elements: fragment.elements || [],
        extensions: [],
        constraints: [],
        valueSets: [],
        slicings: [],
        createdBy: userId,
      });
    }

    if (suggestion.type === "extension" && suggestion.implementation.extensionDefinition) {
      const ext = suggestion.implementation.extensionDefinition;
      return this.createProfile({
        name: ext.name,
        url: ext.url,
        version: "1.0.0",
        status: "draft",
        description: ext.description,
        baseDefinition: "http://hl7.org/fhir/StructureDefinition/Extension",
        resourceType: "Extension",
        elements: [],
        extensions: [ext],
        constraints: [],
        valueSets: [],
        slicings: [],
        createdBy: userId,
      });
    }

    return null;
  }

  getStandardProfiles(): typeof STANDARD_FHIR_PROFILES {
    return STANDARD_FHIR_PROFILES;
  }

  getUSCoreExtensions(): typeof US_CORE_EXTENSIONS {
    return US_CORE_EXTENSIONS;
  }
}

export const aiFhirProfilingEngine = new AIFHIRProfilingEngine();
