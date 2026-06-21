import { randomUUID } from "crypto";
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = `DISCLAIMER: This FHIR data standardization system is for DATA INTEROPERABILITY AND TECHNICAL PURPOSES ONLY. It does NOT constitute clinical decision support, medical advice, diagnosis, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.`;

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data interoperability expert specializing in FHIR R4, HL7 v2, and clinical terminology standards.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Discuss drug interactions or medication guidance
- Make patient care decisions or suggestions

YOUR ROLE IS STRICTLY LIMITED TO:
- Data mapping and transformation analysis
- Semantic interoperability recommendations
- Code system harmonization strategies
- FHIR resource structure alignment
- Data quality and consistency guidance
=== END NO-CDS POLICY ===`;

export interface FHIRStandardizationRequest {
  id: string;
  sourceResources: any[];
  sourceFormat: "FHIR_R4" | "FHIR_STU3" | "FHIR_DSTU2" | "HL7_V2" | "CDA" | "CUSTOM";
  targetFormat: "FHIR_R4";
  options: StandardizationOptions;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  result?: StandardizationResult;
}

export interface StandardizationOptions {
  harmonizeCodeSystems: boolean;
  normalizeUnits: boolean;
  standardizeDates: boolean;
  deduplicateResources: boolean;
  inferMissingFields: boolean;
  validateOutput: boolean;
  preferredCodeSystems: string[];
}

export interface StandardizationResult {
  standardizedResources: any[];
  mappingReport: MappingReport;
  qualityScore: number;
  issues: StandardizationIssue[];
  recommendations: string[];
}

export interface MappingReport {
  totalResources: number;
  successfullyMapped: number;
  partiallyMapped: number;
  unmapped: number;
  codeSystemsMapped: CodeSystemMapping[];
  fieldsMapped: FieldMapping[];
  unitsConverted: UnitConversion[];
}

export interface CodeSystemMapping {
  sourceSystem: string;
  targetSystem: string;
  sourceCodes: number;
  mappedCodes: number;
  unmappedCodes: string[];
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformationType: "direct" | "computed" | "ai_inferred" | "default";
  confidence: number;
}

export interface UnitConversion {
  sourceUnit: string;
  targetUnit: string;
  conversionFactor: number;
  resourcesAffected: number;
}

export interface StandardizationIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "missing_field" | "invalid_code" | "unit_mismatch" | "format_error" | "semantic_conflict";
  resourceId: string;
  resourceType: string;
  field: string;
  description: string;
  suggestedFix?: string;
}

export interface HarmonizationProfile {
  id: string;
  name: string;
  description: string;
  sourceProfiles: string[];
  targetProfile: string;
  mappingRules: MappingRule[];
  codeSystemPreferences: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface MappingRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  transformationType: "copy" | "map" | "compute" | "ai_infer" | "default";
  transformationLogic?: string;
  defaultValue?: any;
  condition?: string;
  priority: number;
}

export interface CommonDataElement {
  id: string;
  name: string;
  description: string;
  fhirPath: string;
  dataType: string;
  codeSystem?: string;
  valueSet?: string;
  occurrenceAcrossProfiles: number;
  profiles: string[];
  semanticMeaning: string;
}

const STANDARD_CODE_SYSTEMS = {
  "SNOMED_CT": "http://snomed.info/sct",
  "LOINC": "http://loinc.org",
  "ICD10_CM": "http://hl7.org/fhir/sid/icd-10-cm",
  "ICD10_PCS": "http://hl7.org/fhir/sid/icd-10-pcs",
  "RXNORM": "http://www.nlm.nih.gov/research/umls/rxnorm",
  "CVX": "http://hl7.org/fhir/sid/cvx",
  "CPT": "http://www.ama-assn.org/go/cpt",
  "NDC": "http://hl7.org/fhir/sid/ndc",
  "UCUM": "http://unitsofmeasure.org"
};

const UNIT_CONVERSIONS: Record<string, { target: string; factor: number }> = {
  "mg/dL": { target: "mmol/L", factor: 0.0555 },
  "lb": { target: "kg", factor: 0.453592 },
  "in": { target: "cm", factor: 2.54 },
  "°F": { target: "°C", factor: 0 },
  "oz": { target: "mL", factor: 29.5735 }
};

class AIFHIRDataStandardizationService {
  private openai: OpenAI | null = null;
  private requests: Map<string, FHIRStandardizationRequest> = new Map();
  private profiles: Map<string, HarmonizationProfile> = new Map();
  private commonElements: Map<string, CommonDataElement> = new Map();

  constructor() {
    this.initializeOpenAI();
    this.initializeSampleProfiles();
    this.initializeCommonDataElements();
    console.log("[AIFHIRStandardization] Service initialized with AI-powered harmonization");
    console.log("[AIFHIRStandardization] NO-CDS compliance enabled for all outputs");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (apiKey) {
      this.openai = new OpenAI({ apiKey, baseURL: baseURL || undefined });
      console.log("[AIFHIRStandardization] OpenAI client configured for intelligent mapping");
    } else {
      console.log("[AIFHIRStandardization] Using rule-based standardization (AI not configured)");
    }
  }

  private initializeSampleProfiles(): void {
    const epicProfile: HarmonizationProfile = {
      id: "profile-epic-r4",
      name: "Fasten Health FHIR R4",
      description: "Harmonization profile for Fasten Health FHIR R4 resources",
      sourceProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
      targetProfile: "internal-standard-patient",
      mappingRules: [
        { id: "rule-1", sourcePath: "Patient.name", targetPath: "patient.fullName", transformationType: "compute", transformationLogic: "concat(given, ' ', family)", priority: 1 },
        { id: "rule-2", sourcePath: "Patient.identifier", targetPath: "patient.mrn", transformationType: "map", condition: "type.coding.code == 'MR'", priority: 1 }
      ],
      codeSystemPreferences: { "condition": "SNOMED_CT", "observation": "LOINC", "medication": "RXNORM" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    const cernerProfile: HarmonizationProfile = {
      id: "profile-cerner-r4",
      name: "Hospital Network FHIR R4",
      description: "Harmonization profile for Hospital Network FHIR R4 resources",
      sourceProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"],
      targetProfile: "internal-standard-condition",
      mappingRules: [
        { id: "rule-3", sourcePath: "Condition.code", targetPath: "condition.diagnosis", transformationType: "copy", priority: 1 },
        { id: "rule-4", sourcePath: "Condition.clinicalStatus", targetPath: "condition.status", transformationType: "map", priority: 1 }
      ],
      codeSystemPreferences: { "condition": "ICD10_CM", "observation": "LOINC" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    this.profiles.set(epicProfile.id, epicProfile);
    this.profiles.set(cernerProfile.id, cernerProfile);
  }

  private initializeCommonDataElements(): void {
    const elements: CommonDataElement[] = [
      {
        id: "cde-patient-mrn",
        name: "Medical Record Number",
        description: "Unique patient identifier within the healthcare system",
        fhirPath: "Patient.identifier.where(type.coding.code='MR').value",
        dataType: "string",
        occurrenceAcrossProfiles: 98,
        profiles: ["Fasten Health", "Hospital Network", "provider", "Healthcare Provider"],
        semanticMeaning: "Primary patient identifier for clinical records"
      },
      {
        id: "cde-condition-code",
        name: "Diagnosis Code",
        description: "Coded representation of a medical condition",
        fhirPath: "Condition.code.coding",
        dataType: "Coding",
        codeSystem: "SNOMED_CT",
        valueSet: "http://hl7.org/fhir/ValueSet/condition-code",
        occurrenceAcrossProfiles: 95,
        profiles: ["Fasten Health", "Hospital Network", "provider"],
        semanticMeaning: "Clinical diagnosis or problem list entry"
      },
      {
        id: "cde-observation-value",
        name: "Observation Value",
        description: "Measured or observed clinical value",
        fhirPath: "Observation.valueQuantity",
        dataType: "Quantity",
        codeSystem: "UCUM",
        occurrenceAcrossProfiles: 92,
        profiles: ["Fasten Health", "Hospital Network", "provider", "Healthcare Provider"],
        semanticMeaning: "Clinical measurement result with units"
      },
      {
        id: "cde-medication-code",
        name: "Medication Code",
        description: "Coded representation of a medication",
        fhirPath: "MedicationRequest.medicationCodeableConcept.coding",
        dataType: "Coding",
        codeSystem: "RXNORM",
        occurrenceAcrossProfiles: 88,
        profiles: ["Fasten Health", "Hospital Network", "provider"],
        semanticMeaning: "Prescribed or administered medication identifier"
      }
    ];

    elements.forEach(el => this.commonElements.set(el.id, el));
  }

  async standardizeResources(
    sourceResources: any[],
    sourceFormat: FHIRStandardizationRequest["sourceFormat"],
    options: StandardizationOptions,
    userId: string
  ): Promise<FHIRStandardizationRequest> {
    const requestId = `std-${Date.now()}-${randomUUID().substring(0, 8)}`;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "FHIRStandardization",
      resourceId: requestId,
      details: `Starting standardization of ${sourceResources.length} resources from ${sourceFormat}`
    });

    const request: FHIRStandardizationRequest = {
      id: requestId,
      sourceResources,
      sourceFormat,
      targetFormat: "FHIR_R4",
      options,
      status: "processing",
      createdAt: new Date().toISOString()
    };

    this.requests.set(requestId, request);

    try {
      const result = await this.performStandardization(sourceResources, sourceFormat, options, userId);
      request.result = result;
      request.status = "completed";
      request.completedAt = new Date().toISOString();

      logPhiAccess({
        userId,
        action: "write",
        resourceType: "FHIRStandardization",
        resourceId: requestId,
        details: `Completed standardization: ${result.mappingReport.successfullyMapped}/${result.mappingReport.totalResources} mapped, quality score: ${result.qualityScore}`
      });
    } catch (error) {
      request.status = "failed";
      console.error("[AIFHIRStandardization] Standardization failed:", error);
    }

    return request;
  }

  private async performStandardization(
    resources: any[],
    sourceFormat: string,
    options: StandardizationOptions,
    userId: string
  ): Promise<StandardizationResult> {
    const standardizedResources: any[] = [];
    const issues: StandardizationIssue[] = [];
    const codeSystemMappings: CodeSystemMapping[] = [];
    const fieldMappings: FieldMapping[] = [];
    const unitConversions: UnitConversion[] = [];

    for (const resource of resources) {
      const { standardized, resourceIssues, mappings } = await this.standardizeResource(resource, sourceFormat, options, userId);
      standardizedResources.push(standardized);
      issues.push(...resourceIssues);
      
      mappings.fields.forEach(fm => {
        if (!fieldMappings.find(f => f.sourceField === fm.sourceField && f.targetField === fm.targetField)) {
          fieldMappings.push(fm);
        }
      });
    }

    if (options.harmonizeCodeSystems) {
      const csMapping = this.harmonizeCodeSystems(standardizedResources, options.preferredCodeSystems);
      codeSystemMappings.push(...csMapping);
    }

    if (options.normalizeUnits) {
      const unitConvs = this.normalizeUnits(standardizedResources);
      unitConversions.push(...unitConvs);
    }

    if (options.deduplicateResources) {
      this.deduplicateResources(standardizedResources);
    }

    const recommendations = await this.generateAIRecommendations(standardizedResources, issues, userId);

    const qualityScore = this.calculateQualityScore(standardizedResources, issues, fieldMappings);

    return {
      standardizedResources,
      mappingReport: {
        totalResources: resources.length,
        successfullyMapped: standardizedResources.filter(r => r._standardized).length,
        partiallyMapped: standardizedResources.filter(r => r._partiallyStandardized).length,
        unmapped: standardizedResources.filter(r => !r._standardized && !r._partiallyStandardized).length,
        codeSystemsMapped: codeSystemMappings,
        fieldsMapped: fieldMappings,
        unitsConverted: unitConversions
      },
      qualityScore,
      issues,
      recommendations
    };
  }

  private async standardizeResource(
    resource: any,
    sourceFormat: string,
    options: StandardizationOptions,
    userId: string
  ): Promise<{ standardized: any; resourceIssues: StandardizationIssue[]; mappings: { fields: FieldMapping[] } }> {
    const resourceIssues: StandardizationIssue[] = [];
    const fieldMappings: FieldMapping[] = [];

    let standardized = { ...resource };
    standardized.meta = standardized.meta || {};
    standardized.meta.lastUpdated = new Date().toISOString();
    standardized.meta.source = `tabula-medica:standardization:${sourceFormat}`;
    standardized._standardized = true;

    if (options.standardizeDates) {
      standardized = this.standardizeDates(standardized);
    }

    if (resource.resourceType === "Condition") {
      standardized = this.standardizeCondition(standardized, resourceIssues, fieldMappings, options);
    } else if (resource.resourceType === "Observation") {
      standardized = this.standardizeObservation(standardized, resourceIssues, fieldMappings, options);
    } else if (resource.resourceType === "Patient") {
      standardized = this.standardizePatient(standardized, resourceIssues, fieldMappings, options);
    } else if (resource.resourceType === "MedicationRequest") {
      standardized = this.standardizeMedicationRequest(standardized, resourceIssues, fieldMappings, options);
    }

    if (options.inferMissingFields && this.openai) {
      standardized = await this.aiInferMissingFields(standardized, resourceIssues, userId);
    }

    return { standardized, resourceIssues, mappings: { fields: fieldMappings } };
  }

  private standardizeCondition(resource: any, issues: StandardizationIssue[], mappings: FieldMapping[], options: StandardizationOptions): any {
    const standardized = { ...resource };

    if (!standardized.clinicalStatus) {
      standardized.clinicalStatus = {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }]
      };
      issues.push({
        id: randomUUID(),
        severity: "warning",
        category: "missing_field",
        resourceId: resource.id || "unknown",
        resourceType: "Condition",
        field: "clinicalStatus",
        description: "Missing clinicalStatus, defaulted to 'active'",
        suggestedFix: "Verify clinical status from source system"
      });
      mappings.push({ sourceField: "", targetField: "clinicalStatus", transformationType: "default", confidence: 0.6 });
    }

    if (!standardized.verificationStatus) {
      standardized.verificationStatus = {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed", display: "Confirmed" }]
      };
    }

    if (standardized.code?.coding) {
      standardized.code.coding = this.mapCodeToPreferred(standardized.code.coding, options.preferredCodeSystems, "condition");
      mappings.push({ sourceField: "code.coding", targetField: "code.coding", transformationType: "computed", confidence: 0.85 });
    }

    return standardized;
  }

  private standardizeObservation(resource: any, issues: StandardizationIssue[], mappings: FieldMapping[], options: StandardizationOptions): any {
    const standardized = { ...resource };

    if (!standardized.status) {
      standardized.status = "final";
      issues.push({
        id: randomUUID(),
        severity: "warning",
        category: "missing_field",
        resourceId: resource.id || "unknown",
        resourceType: "Observation",
        field: "status",
        description: "Missing status, defaulted to 'final'"
      });
    }

    if (standardized.code?.coding) {
      const loincCoding = standardized.code.coding.find((c: any) => c.system?.includes("loinc"));
      if (!loincCoding) {
        issues.push({
          id: randomUUID(),
          severity: "info",
          category: "invalid_code",
          resourceId: resource.id || "unknown",
          resourceType: "Observation",
          field: "code.coding",
          description: "No LOINC code found for observation"
        });
      }
      mappings.push({ sourceField: "code.coding", targetField: "code.coding", transformationType: "direct", confidence: 0.9 });
    }

    if (standardized.valueQuantity?.unit && options.normalizeUnits) {
      const conversion = UNIT_CONVERSIONS[standardized.valueQuantity.unit];
      if (conversion) {
        standardized.valueQuantity.value = standardized.valueQuantity.value * conversion.factor;
        standardized.valueQuantity.unit = conversion.target;
        standardized.valueQuantity.system = STANDARD_CODE_SYSTEMS.UCUM;
      }
    }

    return standardized;
  }

  private standardizePatient(resource: any, issues: StandardizationIssue[], mappings: FieldMapping[], options: StandardizationOptions): any {
    const standardized = { ...resource };

    if (!standardized.identifier?.length) {
      issues.push({
        id: randomUUID(),
        severity: "critical",
        category: "missing_field",
        resourceId: resource.id || "unknown",
        resourceType: "Patient",
        field: "identifier",
        description: "No patient identifiers found"
      });
    } else {
      mappings.push({ sourceField: "identifier", targetField: "identifier", transformationType: "direct", confidence: 1.0 });
    }

    if (standardized.name?.length) {
      standardized.name = standardized.name.map((n: any) => ({
        ...n,
        use: n.use || "official",
        text: n.text || [n.prefix?.join(" "), ...n.given || [], n.family].filter(Boolean).join(" ")
      }));
      mappings.push({ sourceField: "name", targetField: "name", transformationType: "computed", confidence: 0.95 });
    }

    return standardized;
  }

  private standardizeMedicationRequest(resource: any, issues: StandardizationIssue[], mappings: FieldMapping[], options: StandardizationOptions): any {
    const standardized = { ...resource };

    if (!standardized.status) {
      standardized.status = "active";
    }

    if (!standardized.intent) {
      standardized.intent = "order";
    }

    if (standardized.medicationCodeableConcept?.coding) {
      const rxnormCoding = standardized.medicationCodeableConcept.coding.find((c: any) => c.system?.includes("rxnorm"));
      if (!rxnormCoding) {
        issues.push({
          id: randomUUID(),
          severity: "warning",
          category: "invalid_code",
          resourceId: resource.id || "unknown",
          resourceType: "MedicationRequest",
          field: "medicationCodeableConcept.coding",
          description: "No RxNorm code found for medication"
        });
      }
      mappings.push({ sourceField: "medicationCodeableConcept.coding", targetField: "medicationCodeableConcept.coding", transformationType: "direct", confidence: 0.88 });
    }

    return standardized;
  }

  private standardizeDates(resource: any): any {
    const dateFields = ["birthDate", "effectiveDateTime", "onsetDateTime", "recordedDate", "authoredOn", "issued"];
    const standardized = { ...resource };

    for (const field of dateFields) {
      if (standardized[field] && typeof standardized[field] === "string") {
        try {
          const date = new Date(standardized[field]);
          if (!isNaN(date.getTime())) {
            standardized[field] = date.toISOString();
          }
        } catch (e) {
        }
      }
    }

    return standardized;
  }

  private mapCodeToPreferred(codings: any[], preferredSystems: string[], resourceType: string): any[] {
    const systemUrls = preferredSystems.map(s => STANDARD_CODE_SYSTEMS[s as keyof typeof STANDARD_CODE_SYSTEMS]).filter(Boolean);
    
    const sorted = [...codings].sort((a, b) => {
      const aIndex = systemUrls.indexOf(a.system);
      const bIndex = systemUrls.indexOf(b.system);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return sorted;
  }

  private harmonizeCodeSystems(resources: any[], preferredSystems: string[]): CodeSystemMapping[] {
    const mappings: CodeSystemMapping[] = [];
    const systemCounts: Record<string, { source: number; mapped: number; unmapped: string[] }> = {};

    for (const resource of resources) {
      this.extractCodings(resource, (coding) => {
        const system = coding.system || "unknown";
        if (!systemCounts[system]) {
          systemCounts[system] = { source: 0, mapped: 0, unmapped: [] };
        }
        systemCounts[system].source++;
        
        const isPreferred = preferredSystems.some(ps => 
          STANDARD_CODE_SYSTEMS[ps as keyof typeof STANDARD_CODE_SYSTEMS] === system
        );
        if (isPreferred) {
          systemCounts[system].mapped++;
        } else if (coding.code) {
          systemCounts[system].unmapped.push(coding.code);
        }
      });
    }

    for (const [system, counts] of Object.entries(systemCounts)) {
      mappings.push({
        sourceSystem: system,
        targetSystem: preferredSystems[0] ? STANDARD_CODE_SYSTEMS[preferredSystems[0] as keyof typeof STANDARD_CODE_SYSTEMS] : system,
        sourceCodes: counts.source,
        mappedCodes: counts.mapped,
        unmappedCodes: counts.unmapped.slice(0, 10)
      });
    }

    return mappings;
  }

  private extractCodings(obj: any, callback: (coding: any) => void): void {
    if (!obj || typeof obj !== "object") return;
    
    if (obj.coding && Array.isArray(obj.coding)) {
      obj.coding.forEach(callback);
    }
    
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "object") {
        this.extractCodings(obj[key], callback);
      }
    }
  }

  private normalizeUnits(resources: any[]): UnitConversion[] {
    const conversions: UnitConversion[] = [];
    const conversionCounts: Record<string, { target: string; count: number; factor: number }> = {};

    for (const resource of resources) {
      if (resource.valueQuantity?.unit) {
        const conv = UNIT_CONVERSIONS[resource.valueQuantity.unit];
        if (conv) {
          const key = `${resource.valueQuantity.unit}->${conv.target}`;
          if (!conversionCounts[key]) {
            conversionCounts[key] = { target: conv.target, count: 0, factor: conv.factor };
          }
          conversionCounts[key].count++;
        }
      }
    }

    for (const [key, data] of Object.entries(conversionCounts)) {
      const sourceUnit = key.split("->")[0];
      conversions.push({
        sourceUnit,
        targetUnit: data.target,
        conversionFactor: data.factor,
        resourcesAffected: data.count
      });
    }

    return conversions;
  }

  private deduplicateResources(resources: any[]): void {
    const seen = new Set<string>();
    for (let i = resources.length - 1; i >= 0; i--) {
      const key = `${resources[i].resourceType}-${resources[i].id}`;
      if (seen.has(key)) {
        resources.splice(i, 1);
      } else {
        seen.add(key);
      }
    }
  }

  private async aiInferMissingFields(resource: any, issues: StandardizationIssue[], userId: string): Promise<any> {
    if (!this.openai) return resource;

    const missingFields = issues.filter(i => i.category === "missing_field" && i.severity !== "info");
    if (missingFields.length === 0) return resource;

    try {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "FHIRResource",
        resourceId: resource.id || "unknown",
        details: `AI inference for ${missingFields.length} missing fields in ${resource.resourceType}`
      });

      const prompt = `Analyze this ${resource.resourceType} FHIR resource and suggest values for missing required fields.
Resource (PHI redacted): ${JSON.stringify(this.redactPHI(resource), null, 2)}

Missing fields: ${missingFields.map(f => f.field).join(", ")}

For each missing field, suggest a reasonable default value based on the resource type and context.
Return ONLY a JSON object with field paths as keys and suggested values. Do not provide clinical advice.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        try {
          const suggestions = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
          for (const [field, value] of Object.entries(suggestions)) {
            this.setNestedValue(resource, field, value);
            resource._aiInferred = resource._aiInferred || [];
            resource._aiInferred.push(field);
          }
        } catch (e) {
        }
      }
    } catch (error) {
      console.error("[AIFHIRStandardization] AI inference failed:", error);
    }

    return resource;
  }

  private redactPHI(resource: any): any {
    const redacted = JSON.parse(JSON.stringify(resource));
    const phiFields = ["name", "telecom", "address", "birthDate", "identifier", "photo"];
    
    for (const field of phiFields) {
      if (redacted[field]) {
        redacted[field] = "[REDACTED]";
      }
    }
    
    return redacted;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  private async generateAIRecommendations(resources: any[], issues: StandardizationIssue[], userId: string): Promise<string[]> {
    const recommendations: string[] = [];

    const criticalIssues = issues.filter(i => i.severity === "critical");
    const warningIssues = issues.filter(i => i.severity === "warning");

    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical issues: ${criticalIssues.map(i => i.category).filter((v, i, a) => a.indexOf(v) === i).join(", ")}`);
    }

    if (warningIssues.length > 5) {
      recommendations.push(`Review ${warningIssues.length} warnings to improve data quality`);
    }

    const missingCodes = issues.filter(i => i.category === "invalid_code");
    if (missingCodes.length > 0) {
      recommendations.push(`Map ${missingCodes.length} codes to standard terminologies (SNOMED-CT, LOINC, RxNorm)`);
    }

    if (this.openai && resources.length > 0) {
      try {
        logPhiAccess({
          userId,
          action: "read",
          resourceType: "FHIRStandardization",
          details: `Generating AI recommendations for ${resources.length} resources`
        });

        const summary = {
          resourceTypes: Array.from(new Set(resources.map(r => r.resourceType))),
          totalIssues: issues.length,
          criticalCount: criticalIssues.length,
          warningCount: warningIssues.length,
          issueCategoryCounts: issues.reduce((acc, i) => {
            acc[i.category] = (acc[i.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        };

        const response = await this.openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_SYSTEM_PROMPT },
            { role: "user", content: `Based on this FHIR standardization summary, provide 3-5 technical recommendations for improving data interoperability. Focus on data quality, not clinical aspects.\n\nSummary: ${JSON.stringify(summary)}` }
          ],
          max_tokens: 300,
          temperature: 0.5
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const aiRecs = content.split(/\d+\.\s+/).filter(r => r.trim().length > 10).slice(0, 5);
          recommendations.push(...aiRecs.map(r => r.trim()));
        }
      } catch (error) {
        console.error("[AIFHIRStandardization] AI recommendations failed:", error);
      }
    }

    return recommendations;
  }

  private calculateQualityScore(resources: any[], issues: StandardizationIssue[], mappings: FieldMapping[]): number {
    let score = 100;

    const criticalIssues = issues.filter(i => i.severity === "critical").length;
    const warningIssues = issues.filter(i => i.severity === "warning").length;
    
    score -= criticalIssues * 10;
    score -= warningIssues * 2;

    const avgConfidence = mappings.length > 0
      ? mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
      : 0.5;
    
    score = score * avgConfidence;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async identifyCommonElements(resources: any[], userId: string): Promise<CommonDataElement[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "FHIRResources",
      details: `Identifying common data elements across ${resources.length} resources`
    });

    const elementOccurrences: Record<string, { count: number; profiles: Set<string> }> = {};

    for (const resource of resources) {
      const profile = resource.meta?.profile?.[0] || resource.meta?.source || "unknown";
      this.traverseResource(resource, "", (path, value) => {
        if (!elementOccurrences[path]) {
          elementOccurrences[path] = { count: 0, profiles: new Set() };
        }
        elementOccurrences[path].count++;
        elementOccurrences[path].profiles.add(profile);
      });
    }

    const commonElements: CommonDataElement[] = [];
    for (const [path, data] of Object.entries(elementOccurrences)) {
      if (data.count >= resources.length * 0.5) {
        commonElements.push({
          id: `cde-${randomUUID().substring(0, 8)}`,
          name: path.split(".").pop() || path,
          description: `Common element found in ${Math.round(data.count / resources.length * 100)}% of resources`,
          fhirPath: path,
          dataType: "unknown",
          occurrenceAcrossProfiles: Math.round(data.count / resources.length * 100),
          profiles: Array.from(data.profiles),
          semanticMeaning: "Auto-detected common element"
        });
      }
    }

    return commonElements;
  }

  private traverseResource(obj: any, path: string, callback: (path: string, value: any) => void): void {
    if (!obj || typeof obj !== "object") {
      if (path) callback(path, obj);
      return;
    }

    for (const key of Object.keys(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      if (Array.isArray(obj[key])) {
        callback(newPath, obj[key]);
        obj[key].forEach((item: any, index: number) => {
          this.traverseResource(item, newPath, callback);
        });
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        this.traverseResource(obj[key], newPath, callback);
      } else {
        callback(newPath, obj[key]);
      }
    }
  }

  getProfiles(): HarmonizationProfile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(id: string): HarmonizationProfile | undefined {
    return this.profiles.get(id);
  }

  getCommonElements(): CommonDataElement[] {
    return Array.from(this.commonElements.values());
  }

  getRequest(id: string): FHIRStandardizationRequest | undefined {
    return this.requests.get(id);
  }

  getStats(): { totalRequests: number; completedRequests: number; avgQualityScore: number } {
    const requests = Array.from(this.requests.values());
    const completed = requests.filter(r => r.status === "completed");
    const avgScore = completed.length > 0
      ? completed.reduce((sum, r) => sum + (r.result?.qualityScore || 0), 0) / completed.length
      : 0;

    return {
      totalRequests: requests.length,
      completedRequests: completed.length,
      avgQualityScore: Math.round(avgScore)
    };
  }
}

export const aiFhirDataStandardizationService = new AIFHIRDataStandardizationService();
export { NO_CDS_DISCLAIMER };
