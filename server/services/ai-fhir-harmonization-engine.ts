import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";
import type {
  ExternalSystemMapping,
  FieldMappingDefinition,
  CodeSystemMappingDefinition,
  SemanticDiscrepancy,
  ConsolidatedMappingRule,
  HarmonizationAnalysis,
  HarmonizationConfig,
  DiscrepancyType,
  DiscrepancySeverity,
  ResolutionStrategy,
} from "@shared/schema";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const NO_CDS_SYSTEM_PROMPT = `You are a healthcare data interoperability expert specializing in FHIR R4, HL7, and clinical terminology standards.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER UNDER ANY CIRCUMSTANCES:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Discuss drug interactions or medication guidance
- Make patient care decisions or suggestions
- Recommend any clinical interventions
- Provide symptom interpretation or health assessments

If asked about any clinical matter, you MUST refuse and state: "I cannot provide clinical advice. Please consult a healthcare professional."

YOUR ROLE IS STRICTLY LIMITED TO:
- Data mapping and transformation analysis
- Semantic interoperability recommendations
- Code system harmonization strategies
- FHIR resource structure alignment
- Data quality and consistency guidance
- Technical standardization recommendations
=== END NO-CDS POLICY ===

Provide ONLY data mapping, interoperability, and standardization guidance. Never mention patient health status, diagnoses, or clinical recommendations.`;

const FHIR_R4_RESOURCE_FIELDS: Record<string, string[]> = {
  Patient: ["id", "identifier", "active", "name", "telecom", "gender", "birthDate", "address", "maritalStatus", "contact", "communication", "generalPractitioner", "managingOrganization"],
  Observation: ["id", "identifier", "status", "category", "code", "subject", "encounter", "effectiveDateTime", "issued", "performer", "valueQuantity", "valueCodeableConcept", "interpretation", "note", "referenceRange", "component"],
  Condition: ["id", "identifier", "clinicalStatus", "verificationStatus", "category", "severity", "code", "bodySite", "subject", "encounter", "onsetDateTime", "abatementDateTime", "recordedDate", "recorder", "asserter", "stage", "evidence", "note"],
  MedicationRequest: ["id", "identifier", "status", "intent", "category", "priority", "medicationCodeableConcept", "medicationReference", "subject", "encounter", "authoredOn", "requester", "performer", "reasonCode", "dosageInstruction", "dispenseRequest"],
  AllergyIntolerance: ["id", "identifier", "clinicalStatus", "verificationStatus", "type", "category", "criticality", "code", "patient", "encounter", "onsetDateTime", "recordedDate", "recorder", "asserter", "reaction"],
  Encounter: ["id", "identifier", "status", "class", "type", "serviceType", "priority", "subject", "participant", "period", "reasonCode", "diagnosis", "hospitalization", "location", "serviceProvider"],
  DiagnosticReport: ["id", "identifier", "status", "category", "code", "subject", "encounter", "effectiveDateTime", "issued", "performer", "resultsInterpreter", "specimen", "result", "imagingStudy", "conclusion", "conclusionCode", "presentedForm"],
  Immunization: ["id", "identifier", "status", "statusReason", "vaccineCode", "patient", "encounter", "occurrenceDateTime", "recorded", "primarySource", "location", "manufacturer", "lotNumber", "expirationDate", "site", "route", "doseQuantity", "performer", "note", "reasonCode", "isSubpotent", "protocolApplied"],
  Procedure: ["id", "identifier", "status", "statusReason", "category", "code", "subject", "encounter", "performedDateTime", "performedPeriod", "recorder", "asserter", "performer", "location", "reasonCode", "bodySite", "outcome", "report", "complication", "followUp", "note", "focalDevice", "usedReference", "usedCode"],
};

const STANDARD_CODE_SYSTEMS = {
  "SNOMED_CT": "http://snomed.info/sct",
  "LOINC": "http://loinc.org",
  "ICD10_CM": "http://hl7.org/fhir/sid/icd-10-cm",
  "RXNORM": "http://www.nlm.nih.gov/research/umls/rxnorm",
  "CVX": "http://hl7.org/fhir/sid/cvx",
  "CPT": "http://www.ama-assn.org/go/cpt",
  "NDC": "http://hl7.org/fhir/sid/ndc",
};

class AIFHIRHarmonizationEngine {
  private openai: OpenAI | null = null;
  private systemMappings: Map<string, ExternalSystemMapping> = new Map();
  private discrepancies: Map<string, SemanticDiscrepancy> = new Map();
  private consolidatedRules: Map<string, ConsolidatedMappingRule> = new Map();
  private analyses: Map<string, HarmonizationAnalysis> = new Map();
  private config: HarmonizationConfig = {
    autoDetectDiscrepancies: true,
    autoSuggestRules: true,
    discrepancyThreshold: "medium",
    preferredCodeSystems: ["SNOMED_CT", "LOINC", "RXNORM"],
    preferredDateFormat: "YYYY-MM-DD",
    enableAIAnalysis: true,
    notifyOnCritical: true,
  };

  constructor() {
    this.initializeOpenAI();
    this.initializeSampleMappings();
    console.log("[AIFHIRHarmonization] Engine initialized");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: baseURL || undefined,
      });
      console.log("[AIFHIRHarmonization] OpenAI client configured");
    } else {
      console.log("[AIFHIRHarmonization] OpenAI not configured, using rule-based analysis");
    }
  }

  private initializeSampleMappings(): void {
    const epicMapping: ExternalSystemMapping = {
      id: "mapping-epic",
      systemId: "epic-mychart",
      systemName: "Primary Care Provider",
      systemType: "ehr",
      resourceType: "Patient",
      fieldMappings: [
        { id: "fm-1", sourcePath: "patient.mrn", sourceType: "string", targetPath: "Patient.identifier", targetType: "Identifier", cardinality: "1..*", required: true },
        { id: "fm-2", sourcePath: "patient.firstName", sourceType: "string", targetPath: "Patient.name.given", targetType: "string", cardinality: "1..*", required: true },
        { id: "fm-3", sourcePath: "patient.lastName", sourceType: "string", targetPath: "Patient.name.family", targetType: "string", cardinality: "1..1", required: true },
        { id: "fm-4", sourcePath: "patient.dob", sourceType: "string", targetPath: "Patient.birthDate", targetType: "date", cardinality: "0..1", transform: "MM/DD/YYYY -> YYYY-MM-DD", required: false },
        { id: "fm-5", sourcePath: "patient.gender", sourceType: "string", targetPath: "Patient.gender", targetType: "code", cardinality: "0..1", transform: "M->male, F->female", required: false },
      ],
      codeSystemMappings: [
        { id: "csm-1", sourceCodeSystem: "Source.Gender", sourceCodeSystemUrl: "urn:source:gender", targetCodeSystem: "AdministrativeGender", targetCodeSystemUrl: "http://hl7.org/fhir/administrative-gender", mappings: [
          { sourceCode: "M", sourceDisplay: "Male", targetCode: "male", targetDisplay: "Male", equivalence: "equivalent" },
          { sourceCode: "F", sourceDisplay: "Female", targetCode: "female", targetDisplay: "Female", equivalence: "equivalent" },
          { sourceCode: "U", sourceDisplay: "Unknown", targetCode: "unknown", targetDisplay: "Unknown", equivalence: "equivalent" },
        ]},
      ],
      lastUpdated: new Date().toISOString(),
      version: "1.0.0",
    };

    const cernerMapping: ExternalSystemMapping = {
      id: "mapping-cerner",
      systemId: "cerner-health",
      systemName: "Hospital Network",
      systemType: "ehr",
      resourceType: "Patient",
      fieldMappings: [
        { id: "fm-10", sourcePath: "person.patientId", sourceType: "string", targetPath: "Patient.identifier", targetType: "Identifier", cardinality: "1..*", required: true },
        { id: "fm-11", sourcePath: "person.givenName", sourceType: "string", targetPath: "Patient.name.given", targetType: "string", cardinality: "1..*", required: true },
        { id: "fm-12", sourcePath: "person.familyName", sourceType: "string", targetPath: "Patient.name.family", targetType: "string", cardinality: "1..1", required: true },
        { id: "fm-13", sourcePath: "person.birthDate", sourceType: "date", targetPath: "Patient.birthDate", targetType: "date", cardinality: "0..1", transform: "YYYY-MM-DD", required: false },
        { id: "fm-14", sourcePath: "person.sex", sourceType: "code", targetPath: "Patient.gender", targetType: "code", cardinality: "0..1", transform: "MALE->male, FEMALE->female", required: false },
      ],
      codeSystemMappings: [
        { id: "csm-10", sourceCodeSystem: "Source.Sex", sourceCodeSystemUrl: "urn:source:sex", targetCodeSystem: "AdministrativeGender", targetCodeSystemUrl: "http://hl7.org/fhir/administrative-gender", mappings: [
          { sourceCode: "MALE", sourceDisplay: "Male", targetCode: "male", targetDisplay: "Male", equivalence: "equivalent" },
          { sourceCode: "FEMALE", sourceDisplay: "Female", targetCode: "female", targetDisplay: "Female", equivalence: "equivalent" },
          { sourceCode: "UNKNOWN", sourceDisplay: "Unknown", targetCode: "unknown", targetDisplay: "Unknown", equivalence: "equivalent" },
        ]},
      ],
      lastUpdated: new Date().toISOString(),
      version: "2.1.0",
    };

    const labSystemMapping: ExternalSystemMapping = {
      id: "mapping-lab",
      systemId: "quest-diagnostics",
      systemName: "Quest Diagnostics",
      systemType: "lab",
      resourceType: "Observation",
      fieldMappings: [
        { id: "fm-20", sourcePath: "result.testCode", sourceType: "string", targetPath: "Observation.code", targetType: "CodeableConcept", cardinality: "1..1", required: true },
        { id: "fm-21", sourcePath: "result.value", sourceType: "number", targetPath: "Observation.valueQuantity.value", targetType: "decimal", cardinality: "0..1", required: false },
        { id: "fm-22", sourcePath: "result.unit", sourceType: "string", targetPath: "Observation.valueQuantity.unit", targetType: "string", cardinality: "0..1", required: false },
        { id: "fm-23", sourcePath: "result.refRangeLow", sourceType: "number", targetPath: "Observation.referenceRange.low", targetType: "Quantity", cardinality: "0..1", required: false },
        { id: "fm-24", sourcePath: "result.refRangeHigh", sourceType: "number", targetPath: "Observation.referenceRange.high", targetType: "Quantity", cardinality: "0..1", required: false },
        { id: "fm-25", sourcePath: "result.status", sourceType: "string", targetPath: "Observation.status", targetType: "code", cardinality: "1..1", transform: "FINAL->final, PENDING->preliminary", required: true },
      ],
      codeSystemMappings: [
        { id: "csm-20", sourceCodeSystem: "Quest.TestCodes", sourceCodeSystemUrl: "urn:quest:testcodes", targetCodeSystem: "LOINC", targetCodeSystemUrl: "http://loinc.org", mappings: [
          { sourceCode: "GLU", sourceDisplay: "Glucose", targetCode: "2345-7", targetDisplay: "Glucose [Mass/volume] in Serum or Plasma", equivalence: "equivalent" },
          { sourceCode: "HBA1C", sourceDisplay: "Hemoglobin A1c", targetCode: "4548-4", targetDisplay: "Hemoglobin A1c/Hemoglobin.total in Blood", equivalence: "equivalent" },
          { sourceCode: "CHOL", sourceDisplay: "Cholesterol Total", targetCode: "2093-3", targetDisplay: "Cholesterol [Mass/volume] in Serum or Plasma", equivalence: "equivalent" },
        ]},
      ],
      lastUpdated: new Date().toISOString(),
      version: "3.0.0",
    };

    this.systemMappings.set(epicMapping.id, epicMapping);
    this.systemMappings.set(cernerMapping.id, cernerMapping);
    this.systemMappings.set(labSystemMapping.id, labSystemMapping);

    console.log("[AIFHIRHarmonization] Sample mappings initialized:", this.systemMappings.size);
  }

  async runHarmonizationAnalysis(
    systemIds?: string[],
    resourceTypes?: string[]
  ): Promise<HarmonizationAnalysis> {
    const analysisId = randomUUID();
    const now = new Date().toISOString();

    const analysis: HarmonizationAnalysis = {
      id: analysisId,
      status: "analyzing",
      analyzedSystems: systemIds || Array.from(this.systemMappings.values()).map(m => m.systemId),
      analyzedResourceTypes: resourceTypes || ["Patient", "Observation", "Condition", "MedicationRequest"],
      startedAt: now,
      summary: {
        totalMappingsAnalyzed: 0,
        discrepanciesFound: 0,
        discrepanciesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        discrepanciesByType: { semantic: 0, structural: 0, cardinality: 0, terminology: 0, format: 0, missing: 0 },
        suggestedRules: 0,
        harmonizationScore: 0,
      },
      discrepancies: [],
      suggestedRules: [],
      aiRecommendations: [],
      interoperabilityReport: {
        overallScore: 0,
        categoryScores: {},
        criticalGaps: [],
        recommendations: [],
      },
    };

    this.analyses.set(analysisId, analysis);

    try {
      const mappingsToAnalyze = Array.from(this.systemMappings.values())
        .filter(m => !systemIds || systemIds.includes(m.systemId))
        .filter(m => !resourceTypes || resourceTypes.includes(m.resourceType));

      analysis.summary.totalMappingsAnalyzed = mappingsToAnalyze.reduce(
        (sum, m) => sum + m.fieldMappings.length + m.codeSystemMappings.length,
        0
      );

      const detectedDiscrepancies = await this.detectDiscrepancies(mappingsToAnalyze);
      analysis.discrepancies = detectedDiscrepancies;
      analysis.summary.discrepanciesFound = detectedDiscrepancies.length;

      for (const d of detectedDiscrepancies) {
        analysis.summary.discrepanciesBySeverity[d.severity]++;
        analysis.summary.discrepanciesByType[d.type]++;
        this.discrepancies.set(d.id, d);
      }

      if (this.config.autoSuggestRules && detectedDiscrepancies.length > 0) {
        const suggestedRules = await this.generateConsolidatedRules(detectedDiscrepancies);
        analysis.suggestedRules = suggestedRules;
        analysis.summary.suggestedRules = suggestedRules.length;
        for (const rule of suggestedRules) {
          this.consolidatedRules.set(rule.id, rule);
        }
      }

      if (this.config.enableAIAnalysis && this.openai) {
        const aiAnalysis = await this.getAIHarmonizationAnalysis(mappingsToAnalyze, detectedDiscrepancies);
        analysis.aiRecommendations = aiAnalysis.recommendations;
        analysis.interoperabilityReport = aiAnalysis.interoperabilityReport;
      } else {
        analysis.interoperabilityReport = this.generateRuleBasedInteroperabilityReport(mappingsToAnalyze, detectedDiscrepancies);
        analysis.aiRecommendations = this.generateRuleBasedRecommendations(detectedDiscrepancies);
      }

      analysis.summary.harmonizationScore = this.calculateHarmonizationScore(analysis);
      analysis.interoperabilityReport.overallScore = analysis.summary.harmonizationScore;

      analysis.status = "completed";
      analysis.completedAt = new Date().toISOString();
    } catch (error) {
      console.error("[AIFHIRHarmonization] Analysis failed:", error);
      analysis.status = "failed";
    }

    this.analyses.set(analysisId, analysis);
    return analysis;
  }

  private async detectDiscrepancies(mappings: ExternalSystemMapping[]): Promise<SemanticDiscrepancy[]> {
    const discrepancies: SemanticDiscrepancy[] = [];
    const now = new Date().toISOString();

    const mappingsByResourceType = new Map<string, ExternalSystemMapping[]>();
    for (const m of mappings) {
      const existing = mappingsByResourceType.get(m.resourceType) || [];
      existing.push(m);
      mappingsByResourceType.set(m.resourceType, existing);
    }

    for (const [resourceType, resourceMappings] of Array.from(mappingsByResourceType.entries())) {
      if (resourceMappings.length < 2) continue;

      const fieldsByTarget = new Map<string, Array<{ mapping: ExternalSystemMapping; field: FieldMappingDefinition }>>();
      
      for (const mapping of resourceMappings) {
        for (const field of mapping.fieldMappings) {
          const existing = fieldsByTarget.get(field.targetPath) || [];
          existing.push({ mapping, field });
          fieldsByTarget.set(field.targetPath, existing);
        }
      }

      for (const [targetPath, sources] of Array.from(fieldsByTarget.entries())) {
        if (sources.length < 2) continue;

        const sourceTypes = new Set(sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.field.sourceType));
        if (sourceTypes.size > 1) {
          discrepancies.push({
            id: randomUUID(),
            type: "semantic",
            severity: "high",
            affectedSystems: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.mapping.systemId),
            resourceType,
            fieldPath: targetPath,
            description: `Type mismatch for ${targetPath}: Systems use different source types (${Array.from(sourceTypes).join(", ")})`,
            sourceDetails: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => ({
              systemId: s.mapping.systemId,
              systemName: s.mapping.systemName,
              definition: `${s.field.sourcePath} (${s.field.sourceType})`,
              example: s.field.defaultValue,
            })),
            impact: "May cause data loss or incorrect type conversion during data exchange",
            detectedAt: now,
            status: "open",
          });
        }

        const transforms = sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.field.transform).filter(Boolean);
        const uniqueTransforms = new Set(transforms);
        if (uniqueTransforms.size > 1) {
          discrepancies.push({
            id: randomUUID(),
            type: "format",
            severity: "medium",
            affectedSystems: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.mapping.systemId),
            resourceType,
            fieldPath: targetPath,
            description: `Format transformation conflict for ${targetPath}: Different transformation rules applied`,
            sourceDetails: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => ({
              systemId: s.mapping.systemId,
              systemName: s.mapping.systemName,
              definition: s.field.transform || "No transformation",
            })),
            impact: "Inconsistent data formatting may cause validation failures or data misinterpretation",
            detectedAt: now,
            status: "open",
          });
        }

        const cardinalities = new Set(sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.field.cardinality));
        if (cardinalities.size > 1) {
          discrepancies.push({
            id: randomUUID(),
            type: "cardinality",
            severity: "medium",
            affectedSystems: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => s.mapping.systemId),
            resourceType,
            fieldPath: targetPath,
            description: `Cardinality mismatch for ${targetPath}: Systems define different cardinalities (${Array.from(cardinalities).join(", ")})`,
            sourceDetails: sources.map((s: { mapping: ExternalSystemMapping; field: FieldMappingDefinition }) => ({
              systemId: s.mapping.systemId,
              systemName: s.mapping.systemName,
              definition: `Cardinality: ${s.field.cardinality}`,
            })),
            impact: "Array vs single value handling may differ, causing data truncation or expansion issues",
            detectedAt: now,
            status: "open",
          });
        }
      }

      const codeSystemsByTarget = new Map<string, Array<{ mapping: ExternalSystemMapping; csm: CodeSystemMappingDefinition }>>();
      
      for (const mapping of resourceMappings) {
        for (const csm of mapping.codeSystemMappings) {
          const existing = codeSystemsByTarget.get(csm.targetCodeSystem) || [];
          existing.push({ mapping, csm });
          codeSystemsByTarget.set(csm.targetCodeSystem, existing);
        }
      }

      type CsmSource = { mapping: ExternalSystemMapping; csm: CodeSystemMappingDefinition };
      for (const [targetCodeSystem, sources] of Array.from(codeSystemsByTarget.entries())) {
        if (sources.length < 2) continue;

        const allSourceCodes = new Map<string, string[]>();
        for (const { mapping, csm } of sources) {
          for (const m of csm.mappings) {
            const existing = allSourceCodes.get(m.targetCode) || [];
            existing.push(`${mapping.systemId}:${m.sourceCode}`);
            allSourceCodes.set(m.targetCode, existing);
          }
        }

        for (const [targetCode, sourceCodes] of Array.from(allSourceCodes.entries())) {
          if (sourceCodes.length > 1) {
            const uniqueSources = new Set(sourceCodes.map((sc: string) => sc.split(":")[1]));
            if (uniqueSources.size > 1) {
              discrepancies.push({
                id: randomUUID(),
                type: "terminology",
                severity: "high",
                affectedSystems: sources.map((s: CsmSource) => s.mapping.systemId),
                resourceType,
                fieldPath: `codeSystem:${targetCodeSystem}`,
                description: `Multiple source codes map to the same target code '${targetCode}' in ${targetCodeSystem}`,
                sourceDetails: sources.map((s: CsmSource) => ({
                  systemId: s.mapping.systemId,
                  systemName: s.mapping.systemName,
                  definition: s.csm.mappings.filter((m: { targetCode: string; sourceCode: string; sourceDisplay: string }) => m.targetCode === targetCode).map((m: { sourceCode: string; sourceDisplay: string }) => `${m.sourceCode} (${m.sourceDisplay})`).join(", "),
                })),
                impact: "Ambiguous terminology mapping may cause incorrect clinical interpretations",
                detectedAt: now,
                status: "open",
              });
            }
          }
        }
      }

      const expectedFields = FHIR_R4_RESOURCE_FIELDS[resourceType] || [];
      const coveredFields = new Set<string>();
      
      for (const mapping of resourceMappings) {
        for (const field of mapping.fieldMappings) {
          const basePath = field.targetPath.split(".")[1];
          if (basePath) coveredFields.add(basePath);
        }
      }

      const missingCriticalFields = expectedFields.filter(f => !coveredFields.has(f));
      const criticalFields = ["identifier", "status", "code", "subject", "patient"];
      const missingCritical = missingCriticalFields.filter(f => criticalFields.includes(f));

      if (missingCritical.length > 0) {
        discrepancies.push({
          id: randomUUID(),
          type: "missing",
          severity: "critical",
          affectedSystems: resourceMappings.map(m => m.systemId),
          resourceType,
          fieldPath: missingCritical.join(", "),
          description: `Critical FHIR fields not mapped: ${missingCritical.join(", ")}`,
          sourceDetails: resourceMappings.map(m => ({
            systemId: m.systemId,
            systemName: m.systemName,
            definition: `Missing mappings for: ${missingCritical.join(", ")}`,
          })),
          impact: "Missing critical fields will cause FHIR validation failures and interoperability issues",
          detectedAt: now,
          status: "open",
        });
      }
    }

    return discrepancies;
  }

  private async generateConsolidatedRules(discrepancies: SemanticDiscrepancy[]): Promise<ConsolidatedMappingRule[]> {
    const rules: ConsolidatedMappingRule[] = [];
    const now = new Date().toISOString();

    const discrepanciesByField = new Map<string, SemanticDiscrepancy[]>();
    for (const d of discrepancies) {
      const key = `${d.resourceType}:${d.fieldPath}`;
      const existing = discrepanciesByField.get(key) || [];
      existing.push(d);
      discrepanciesByField.set(key, existing);
    }

    for (const [key, fieldDiscrepancies] of Array.from(discrepanciesByField.entries())) {
      const [resourceType, fieldPath] = key.split(":");
      const firstDiscrepancy = fieldDiscrepancies[0];

      let conflictResolution: ConsolidatedMappingRule["conflictResolution"] = "first_non_null";
      const validationRules: string[] = [];

      if (fieldDiscrepancies.some((d: SemanticDiscrepancy) => d.type === "semantic")) {
        conflictResolution = "highest_priority";
        validationRules.push("Validate type consistency before merge");
      }
      if (fieldDiscrepancies.some((d: SemanticDiscrepancy) => d.type === "format")) {
        validationRules.push("Apply standardized date format: YYYY-MM-DD");
        validationRules.push("Normalize string casing for codes");
      }
      if (fieldDiscrepancies.some((d: SemanticDiscrepancy) => d.type === "cardinality")) {
        conflictResolution = "merge_array";
        validationRules.push("Handle single-to-array conversion");
      }

      const sourceSystemRules = firstDiscrepancy.sourceDetails.map((sd: { systemId: string; systemName: string; definition: string }, index: number) => ({
        systemId: sd.systemId,
        sourcePath: sd.definition.split(" ")[0] || fieldPath,
        priority: index + 1,
      }));

      const rule: ConsolidatedMappingRule = {
        id: randomUUID(),
        name: `Harmonize ${resourceType}.${fieldPath}`,
        description: `Consolidated mapping rule for ${fieldPath} across ${firstDiscrepancy.affectedSystems.length} systems`,
        resourceType,
        fieldPath,
        sourceSystemRules,
        targetDefinition: {
          path: fieldPath,
          type: "auto-detect",
        },
        conflictResolution,
        validationRules,
        isActive: false,
        createdAt: now,
        updatedAt: now,
        aiGenerated: true,
        aiConfidence: 0.75,
      };

      rules.push(rule);
    }

    return rules;
  }

  private async getAIHarmonizationAnalysis(
    mappings: ExternalSystemMapping[],
    discrepancies: SemanticDiscrepancy[]
  ): Promise<{
    recommendations: string[];
    interoperabilityReport: HarmonizationAnalysis["interoperabilityReport"];
  }> {
    if (!this.openai) {
      return {
        recommendations: this.generateRuleBasedRecommendations(discrepancies),
        interoperabilityReport: this.generateRuleBasedInteroperabilityReport(mappings, discrepancies),
      };
    }

    const mappingSummary = mappings.map(m => ({
      system: m.systemName,
      resourceType: m.resourceType,
      fieldCount: m.fieldMappings.length,
      codeSystemCount: m.codeSystemMappings.length,
    }));

    const discrepancySummary = discrepancies.map(d => ({
      type: d.type,
      severity: d.severity,
      resourceType: d.resourceType,
      field: d.fieldPath,
      description: d.description,
      affectedSystems: d.affectedSystems.length,
    }));

    const prompt = `Analyze the following FHIR data mapping configuration across multiple external healthcare systems:

SYSTEM MAPPINGS:
${JSON.stringify(mappingSummary, null, 2)}

DETECTED DISCREPANCIES:
${JSON.stringify(discrepancySummary, null, 2)}

Provide:
1. Prioritized recommendations for achieving data harmonization (list 5-7 actionable items)
2. An interoperability assessment with category scores (0-100) for:
   - Semantic consistency
   - Terminology alignment
   - Structural compliance
   - Data quality
3. Critical gaps that need immediate attention
4. Long-term standardization strategies

Focus ONLY on data mapping, interoperability, and standardization. Do NOT provide any clinical or medical advice.

Respond in JSON format:
{
  "recommendations": ["recommendation1", "recommendation2", ...],
  "categoryScores": { "semantic_consistency": 0-100, "terminology_alignment": 0-100, "structural_compliance": 0-100, "data_quality": 0-100 },
  "criticalGaps": ["gap1", "gap2", ...],
  "longTermStrategies": ["strategy1", "strategy2", ...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content);

      return {
        recommendations: [
          ...(parsed.recommendations || []),
          ...(parsed.longTermStrategies || []),
        ],
        interoperabilityReport: {
          overallScore: this.calculateAverageScore(parsed.categoryScores || {}),
          categoryScores: parsed.categoryScores || {},
          criticalGaps: parsed.criticalGaps || [],
          recommendations: parsed.recommendations || [],
        },
      };
    } catch (error) {
      console.error("[AIFHIRHarmonization] AI analysis error:", error);
      return {
        recommendations: this.generateRuleBasedRecommendations(discrepancies),
        interoperabilityReport: this.generateRuleBasedInteroperabilityReport(mappings, discrepancies),
      };
    }
  }

  private calculateAverageScore(scores: Record<string, number>): number {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  private generateRuleBasedRecommendations(discrepancies: SemanticDiscrepancy[]): string[] {
    const recommendations: string[] = [];

    const criticalCount = discrepancies.filter(d => d.severity === "critical").length;
    const highCount = discrepancies.filter(d => d.severity === "high").length;

    if (criticalCount > 0) {
      recommendations.push(`Address ${criticalCount} critical discrepancies immediately to ensure FHIR validation compliance`);
    }
    if (highCount > 0) {
      recommendations.push(`Resolve ${highCount} high-severity mapping conflicts to improve data quality`);
    }

    const typeGroups = new Map<DiscrepancyType, number>();
    for (const d of discrepancies) {
      typeGroups.set(d.type, (typeGroups.get(d.type) || 0) + 1);
    }

    if (typeGroups.get("terminology")) {
      recommendations.push("Implement standardized code system mappings using SNOMED CT and LOINC as primary terminologies");
    }
    if (typeGroups.get("format")) {
      recommendations.push("Establish consistent date/time formatting using ISO 8601 (YYYY-MM-DD) across all systems");
    }
    if (typeGroups.get("cardinality")) {
      recommendations.push("Define clear cardinality handling rules for array vs single-value conversions");
    }
    if (typeGroups.get("semantic")) {
      recommendations.push("Create a centralized semantic dictionary to ensure consistent field interpretations");
    }
    if (typeGroups.get("missing")) {
      recommendations.push("Extend source system mappings to cover all required FHIR elements");
    }

    recommendations.push("Schedule regular harmonization audits to detect new discrepancies as systems evolve");
    recommendations.push("Implement automated validation pipelines to catch mapping issues before data exchange");

    return recommendations;
  }

  private generateRuleBasedInteroperabilityReport(
    mappings: ExternalSystemMapping[],
    discrepancies: SemanticDiscrepancy[]
  ): HarmonizationAnalysis["interoperabilityReport"] {
    const totalMappings = mappings.reduce((sum, m) => sum + m.fieldMappings.length, 0);
    const criticalCount = discrepancies.filter(d => d.severity === "critical").length;
    const highCount = discrepancies.filter(d => d.severity === "high").length;

    const semanticScore = Math.max(0, 100 - (discrepancies.filter(d => d.type === "semantic").length * 15));
    const terminologyScore = Math.max(0, 100 - (discrepancies.filter(d => d.type === "terminology").length * 12));
    const structuralScore = Math.max(0, 100 - (discrepancies.filter(d => d.type === "structural" || d.type === "cardinality").length * 10));
    const dataQualityScore = Math.max(0, 100 - (criticalCount * 20) - (highCount * 10));

    const overallScore = Math.round((semanticScore + terminologyScore + structuralScore + dataQualityScore) / 4);

    const criticalGaps: string[] = [];
    for (const d of discrepancies.filter(d => d.severity === "critical")) {
      criticalGaps.push(`${d.resourceType}: ${d.description}`);
    }

    return {
      overallScore,
      categoryScores: {
        semantic_consistency: semanticScore,
        terminology_alignment: terminologyScore,
        structural_compliance: structuralScore,
        data_quality: dataQualityScore,
      },
      criticalGaps,
      recommendations: this.generateRuleBasedRecommendations(discrepancies).slice(0, 5),
    };
  }

  private calculateHarmonizationScore(analysis: HarmonizationAnalysis): number {
    const totalMappings = analysis.summary.totalMappingsAnalyzed;
    if (totalMappings === 0) return 100;

    const discrepancyPenalty = 
      (analysis.summary.discrepanciesBySeverity.critical * 20) +
      (analysis.summary.discrepanciesBySeverity.high * 10) +
      (analysis.summary.discrepanciesBySeverity.medium * 5) +
      (analysis.summary.discrepanciesBySeverity.low * 2);

    const rulesBonus = Math.min(analysis.summary.suggestedRules * 2, 10);

    const score = Math.max(0, Math.min(100, 100 - discrepancyPenalty + rulesBonus));
    return Math.round(score);
  }

  listSystemMappings(filters?: { systemType?: string; resourceType?: string }): ExternalSystemMapping[] {
    let mappings = Array.from(this.systemMappings.values());

    if (filters?.systemType) {
      mappings = mappings.filter(m => m.systemType === filters.systemType);
    }
    if (filters?.resourceType) {
      mappings = mappings.filter(m => m.resourceType === filters.resourceType);
    }

    return mappings;
  }

  getSystemMapping(id: string): ExternalSystemMapping | undefined {
    return this.systemMappings.get(id);
  }

  addSystemMapping(mapping: Omit<ExternalSystemMapping, "id" | "lastUpdated" | "version">): ExternalSystemMapping {
    const newMapping: ExternalSystemMapping = {
      ...mapping,
      id: randomUUID(),
      lastUpdated: new Date().toISOString(),
      version: "1.0.0",
    };
    this.systemMappings.set(newMapping.id, newMapping);
    return newMapping;
  }

  updateSystemMapping(id: string, updates: Partial<ExternalSystemMapping>): ExternalSystemMapping | null {
    const existing = this.systemMappings.get(id);
    if (!existing) return null;

    const updated: ExternalSystemMapping = {
      ...existing,
      ...updates,
      id: existing.id,
      lastUpdated: new Date().toISOString(),
    };
    this.systemMappings.set(id, updated);
    return updated;
  }

  deleteSystemMapping(id: string): boolean {
    return this.systemMappings.delete(id);
  }

  listDiscrepancies(filters?: {
    severity?: DiscrepancySeverity;
    type?: DiscrepancyType;
    status?: SemanticDiscrepancy["status"];
    resourceType?: string;
  }): SemanticDiscrepancy[] {
    let discrepancies = Array.from(this.discrepancies.values());

    if (filters?.severity) {
      discrepancies = discrepancies.filter(d => d.severity === filters.severity);
    }
    if (filters?.type) {
      discrepancies = discrepancies.filter(d => d.type === filters.type);
    }
    if (filters?.status) {
      discrepancies = discrepancies.filter(d => d.status === filters.status);
    }
    if (filters?.resourceType) {
      discrepancies = discrepancies.filter(d => d.resourceType === filters.resourceType);
    }

    return discrepancies.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  getDiscrepancy(id: string): SemanticDiscrepancy | undefined {
    return this.discrepancies.get(id);
  }

  updateDiscrepancyStatus(
    id: string,
    status: SemanticDiscrepancy["status"],
    resolution?: SemanticDiscrepancy["resolution"]
  ): SemanticDiscrepancy | null {
    const discrepancy = this.discrepancies.get(id);
    if (!discrepancy) return null;

    discrepancy.status = status;
    if (resolution) {
      discrepancy.resolution = resolution;
    }
    this.discrepancies.set(id, discrepancy);
    return discrepancy;
  }

  listConsolidatedRules(filters?: { resourceType?: string; isActive?: boolean }): ConsolidatedMappingRule[] {
    let rules = Array.from(this.consolidatedRules.values());

    if (filters?.resourceType) {
      rules = rules.filter(r => r.resourceType === filters.resourceType);
    }
    if (filters?.isActive !== undefined) {
      rules = rules.filter(r => r.isActive === filters.isActive);
    }

    return rules;
  }

  getConsolidatedRule(id: string): ConsolidatedMappingRule | undefined {
    return this.consolidatedRules.get(id);
  }

  activateRule(id: string): ConsolidatedMappingRule | null {
    const rule = this.consolidatedRules.get(id);
    if (!rule) return null;

    rule.isActive = true;
    rule.updatedAt = new Date().toISOString();
    this.consolidatedRules.set(id, rule);
    return rule;
  }

  deactivateRule(id: string): ConsolidatedMappingRule | null {
    const rule = this.consolidatedRules.get(id);
    if (!rule) return null;

    rule.isActive = false;
    rule.updatedAt = new Date().toISOString();
    this.consolidatedRules.set(id, rule);
    return rule;
  }

  deleteRule(id: string): boolean {
    return this.consolidatedRules.delete(id);
  }

  getAnalysis(id: string): HarmonizationAnalysis | undefined {
    return this.analyses.get(id);
  }

  listAnalyses(): HarmonizationAnalysis[] {
    return Array.from(this.analyses.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  getConfig(): HarmonizationConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<HarmonizationConfig>): HarmonizationConfig {
    this.config = { ...this.config, ...updates };
    return { ...this.config };
  }

  getDiscrepancySummary(): {
    total: number;
    bySeverity: Record<DiscrepancySeverity, number>;
    byType: Record<DiscrepancyType, number>;
    byStatus: Record<SemanticDiscrepancy["status"], number>;
  } {
    const discrepancies = Array.from(this.discrepancies.values());
    
    const bySeverity: Record<DiscrepancySeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byType: Record<DiscrepancyType, number> = { semantic: 0, structural: 0, cardinality: 0, terminology: 0, format: 0, missing: 0 };
    const byStatus: Record<SemanticDiscrepancy["status"], number> = { open: 0, acknowledged: 0, resolved: 0, ignored: 0 };

    for (const d of discrepancies) {
      bySeverity[d.severity]++;
      byType[d.type]++;
      byStatus[d.status]++;
    }

    return { total: discrepancies.length, bySeverity, byType, byStatus };
  }
}

export const aiFhirHarmonizationEngine = new AIFHIRHarmonizationEngine();
