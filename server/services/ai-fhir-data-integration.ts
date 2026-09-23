import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

const CDS_PROHIBITED_PATTERNS = [
  /\b(prescribe|should take|recommend starting|administer|give the patient)\b/i,
  /\b(diagnose with|diagnosis of|you have|patient has)\b/i,
  /\b(increase dose|decrease dose|stop taking|discontinue)\b/i,
  /\b(start treatment|begin therapy|initiate)\b/i,
  /\b(refer to specialist|order test|schedule procedure)\b/i,
];

function enforceCdsCompliance(text: string): string {
  let sanitized = text;
  CDS_PROHIBITED_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "[REDACTED - CDS]");
  });
  return sanitized;
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const hashedDetails = { ...details };
  if (hashedDetails.patientId) {
    hashedDetails.patientId = hashIdentifier(hashedDetails.patientId);
  }
  if (hashedDetails.sourceRecordId) {
    hashedDetails.sourceRecordId = hashIdentifier(hashedDetails.sourceRecordId);
  }
  console.log(`[HIPAA_AUDIT] ${timestamp} | ${action} | ${JSON.stringify(hashedDetails)}`);
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const NO_CDS_INTEGRATION_PROMPT = `You are a healthcare data integration expert specializing in FHIR R4 data transformation and interoperability.

CRITICAL COMPLIANCE REQUIREMENTS:
- You MUST NOT provide any clinical decision support (CDS)
- You MUST NOT recommend treatments, medications, or clinical interventions
- You MUST NOT make diagnostic suggestions
- Focus ONLY on data mapping, transformation, and integration tasks
- All analysis is for data quality and interoperability purposes only
- Use technical, data-focused language only

Your role is to assist with data integration and transformation, NOT clinical care.`;

export type SourceDataFormat = "hl7v2" | "ccd" | "ccda" | "csv" | "json" | "xml" | "custom";
export type IntegrationStatus = "pending" | "mapping" | "validating" | "transforming" | "completed" | "failed" | "conflict_detected";
export type ConflictType = "duplicate" | "semantic_mismatch" | "value_conflict" | "missing_required" | "format_incompatible" | "code_system_conflict";
export type ConflictResolution = "use_source" | "use_target" | "merge" | "manual_review" | "skip" | "auto_resolved";

export interface SourceDataField {
  path: string;
  value: any;
  dataType: string;
  required: boolean;
}

export interface MappingRule {
  id: string;
  sourcePath: string;
  sourceFormat: SourceDataFormat;
  targetFhirPath: string;
  targetResourceType: string;
  transformationType: "direct" | "computed" | "lookup" | "conditional" | "aggregate";
  transformationLogic?: string;
  codeSystemMapping?: {
    sourceSystem: string;
    targetSystem: string;
    mappingTable: Record<string, string>;
  };
  defaultValue?: any;
  required: boolean;
  validated: boolean;
}

export interface IntegrationConflict {
  id: string;
  integrationId: string;
  conflictType: ConflictType;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  sourcePath: string;
  sourceValue: any;
  targetPath?: string;
  targetValue?: any;
  suggestedResolution: ConflictResolution;
  resolutionDetails?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  actualResolution?: ConflictResolution;
}

export interface DataQualityInsight {
  id: string;
  integrationId: string;
  category: "completeness" | "accuracy" | "consistency" | "timeliness" | "validity" | "uniqueness";
  score: number;
  findings: string[];
  recommendations: string[];
  affectedFields: string[];
  trend?: "improving" | "stable" | "declining";
}

export interface FhirTransformedResource {
  resourceType: string;
  id: string;
  originalSourceId: string;
  sourceFormat: SourceDataFormat;
  fhirResource: any;
  mappingsApplied: string[];
  qualityScore: number;
  validationErrors: string[];
  createdAt: string;
}

export interface DataIntegration {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  sourceFormat: SourceDataFormat;
  status: IntegrationStatus;
  mappingRules: MappingRule[];
  conflicts: IntegrationConflict[];
  qualityInsights: DataQualityInsight[];
  transformedResources: FhirTransformedResource[];
  statistics: {
    totalRecords: number;
    successfulTransforms: number;
    failedTransforms: number;
    conflictsDetected: number;
    conflictsResolved: number;
    averageQualityScore: number;
  };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SourceDataPayload {
  format: SourceDataFormat;
  sourceSystem: string;
  records: any[];
  metadata?: {
    encoding?: string;
    delimiter?: string;
    dateFormat?: string;
  };
}

const integrationCache = new Map<string, DataIntegration>();
const mappingRuleLibrary = new Map<string, MappingRule[]>();

const FHIR_RESOURCE_TEMPLATES: Record<string, any> = {
  Patient: {
    resourceType: "Patient",
    identifier: [],
    active: true,
    name: [],
    telecom: [],
    gender: null,
    birthDate: null,
    address: [],
  },
  Observation: {
    resourceType: "Observation",
    identifier: [],
    status: "final",
    category: [],
    code: {},
    subject: {},
    effectiveDateTime: null,
    valueQuantity: null,
  },
  Condition: {
    resourceType: "Condition",
    identifier: [],
    clinicalStatus: {},
    verificationStatus: {},
    category: [],
    code: {},
    subject: {},
    onsetDateTime: null,
  },
  MedicationRequest: {
    resourceType: "MedicationRequest",
    identifier: [],
    status: "active",
    intent: "order",
    medicationCodeableConcept: {},
    subject: {},
    authoredOn: null,
    dosageInstruction: [],
  },
  Encounter: {
    resourceType: "Encounter",
    identifier: [],
    status: "finished",
    class: {},
    type: [],
    subject: {},
    period: {},
  },
};

const DEFAULT_CODE_SYSTEM_MAPPINGS: Record<string, Record<string, string>> = {
  gender: {
    M: "male",
    F: "female",
    Male: "male",
    Female: "female",
    U: "unknown",
    Unknown: "unknown",
    O: "other",
    Other: "other",
  },
  encounterClass: {
    IP: "IMP",
    OP: "AMB",
    ER: "EMER",
    Inpatient: "IMP",
    Outpatient: "AMB",
    Emergency: "EMER",
  },
  conditionStatus: {
    Active: "active",
    Resolved: "resolved",
    Inactive: "inactive",
    Remission: "remission",
  },
};

function initializeSampleMappingRules(): void {
  const hl7v2PatientMappings: MappingRule[] = [
    {
      id: "hl7-pid-1",
      sourcePath: "PID.3",
      sourceFormat: "hl7v2",
      targetFhirPath: "Patient.identifier",
      targetResourceType: "Patient",
      transformationType: "computed",
      transformationLogic: "Extract MRN from PID.3 segment, create Identifier with system and value",
      required: true,
      validated: true,
    },
    {
      id: "hl7-pid-5",
      sourcePath: "PID.5",
      sourceFormat: "hl7v2",
      targetFhirPath: "Patient.name",
      targetResourceType: "Patient",
      transformationType: "computed",
      transformationLogic: "Parse XPN format: family^given^middle^suffix^prefix",
      required: true,
      validated: true,
    },
    {
      id: "hl7-pid-7",
      sourcePath: "PID.7",
      sourceFormat: "hl7v2",
      targetFhirPath: "Patient.birthDate",
      targetResourceType: "Patient",
      transformationType: "computed",
      transformationLogic: "Convert HL7 TS format (YYYYMMDD) to FHIR date (YYYY-MM-DD)",
      required: false,
      validated: true,
    },
    {
      id: "hl7-pid-8",
      sourcePath: "PID.8",
      sourceFormat: "hl7v2",
      targetFhirPath: "Patient.gender",
      targetResourceType: "Patient",
      transformationType: "lookup",
      codeSystemMapping: {
        sourceSystem: "HL7v2.Gender",
        targetSystem: "http://hl7.org/fhir/administrative-gender",
        mappingTable: DEFAULT_CODE_SYSTEM_MAPPINGS.gender,
      },
      required: false,
      validated: true,
    },
  ];

  const csvPatientMappings: MappingRule[] = [
    {
      id: "csv-mrn",
      sourcePath: "mrn",
      sourceFormat: "csv",
      targetFhirPath: "Patient.identifier[0].value",
      targetResourceType: "Patient",
      transformationType: "direct",
      required: true,
      validated: true,
    },
    {
      id: "csv-firstname",
      sourcePath: "first_name",
      sourceFormat: "csv",
      targetFhirPath: "Patient.name[0].given[0]",
      targetResourceType: "Patient",
      transformationType: "direct",
      required: true,
      validated: true,
    },
    {
      id: "csv-lastname",
      sourcePath: "last_name",
      sourceFormat: "csv",
      targetFhirPath: "Patient.name[0].family",
      targetResourceType: "Patient",
      transformationType: "direct",
      required: true,
      validated: true,
    },
    {
      id: "csv-dob",
      sourcePath: "date_of_birth",
      sourceFormat: "csv",
      targetFhirPath: "Patient.birthDate",
      targetResourceType: "Patient",
      transformationType: "computed",
      transformationLogic: "Parse date from various formats to YYYY-MM-DD",
      required: false,
      validated: true,
    },
    {
      id: "csv-gender",
      sourcePath: "gender",
      sourceFormat: "csv",
      targetFhirPath: "Patient.gender",
      targetResourceType: "Patient",
      transformationType: "lookup",
      codeSystemMapping: {
        sourceSystem: "CSV.Gender",
        targetSystem: "http://hl7.org/fhir/administrative-gender",
        mappingTable: DEFAULT_CODE_SYSTEM_MAPPINGS.gender,
      },
      required: false,
      validated: true,
    },
  ];

  mappingRuleLibrary.set("hl7v2:Patient", hl7v2PatientMappings);
  mappingRuleLibrary.set("csv:Patient", csvPatientMappings);
}

initializeSampleMappingRules();

export async function createIntegration(
  name: string,
  description: string,
  sourceSystem: string,
  sourceFormat: SourceDataFormat
): Promise<DataIntegration> {
  const id = `integration-${randomUUID().substring(0, 8)}`;

  logHipaaAudit("DATA_INTEGRATION_CREATED", {
    integrationId: id,
    sourceSystem,
    sourceFormat,
  });

  const mappingKey = `${sourceFormat}:Patient`;
  const defaultMappings = mappingRuleLibrary.get(mappingKey) || [];

  const integration: DataIntegration = {
    id,
    name,
    description,
    sourceSystem,
    sourceFormat,
    status: "pending",
    mappingRules: defaultMappings.map((r) => ({ ...r, id: `${id}-${r.id}` })),
    conflicts: [],
    qualityInsights: [],
    transformedResources: [],
    statistics: {
      totalRecords: 0,
      successfulTransforms: 0,
      failedTransforms: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      averageQualityScore: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  integrationCache.set(id, integration);
  return integration;
}

export async function generateMappingRules(
  integrationId: string,
  sampleData: any[]
): Promise<MappingRule[]> {
  const integration = integrationCache.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  logHipaaAudit("MAPPING_RULES_GENERATION_REQUESTED", {
    integrationId,
    sampleRecordCount: sampleData.length,
  });

  integration.status = "mapping";
  integration.updatedAt = new Date().toISOString();

  const detectedFields = analyzeSourceStructure(sampleData, integration.sourceFormat);
  let generatedRules: MappingRule[] = [];

  if (aiEnabled) {
    try {
      const content = await generatePhiSafeText({
        system: NO_CDS_INTEGRATION_PROMPT,
        user: `Analyze this source data structure and generate FHIR R4 mapping rules.

Source Format: ${integration.sourceFormat}
Source System: ${integration.sourceSystem}
Detected Fields: ${JSON.stringify(detectedFields, null, 2)}
Sample Record: ${JSON.stringify(sampleData[0], null, 2)}

Generate mapping rules in JSON format:
{
  "mappings": [
    {
      "sourcePath": "field.path",
      "targetFhirPath": "ResourceType.fhirPath",
      "targetResourceType": "Patient|Observation|Condition|etc",
      "transformationType": "direct|computed|lookup|conditional",
      "transformationLogic": "Description of transformation if needed",
      "required": true|false
    }
  ],
  "suggestedResourceTypes": ["Patient", "Observation"],
  "dataQualityNotes": ["Note about data quality..."]
}

Focus on accurate FHIR R4 mapping. No clinical recommendations.`,
        responseMimeType: "application/json",
      });

      if (content) {
        const parsed = JSON.parse(content);
        generatedRules = (parsed.mappings || []).map((m: any, idx: number) => ({
          id: `${integrationId}-rule-${idx + 1}`,
          sourcePath: m.sourcePath,
          sourceFormat: integration.sourceFormat,
          targetFhirPath: m.targetFhirPath,
          targetResourceType: m.targetResourceType,
          transformationType: m.transformationType || "direct",
          transformationLogic: m.transformationLogic
            ? enforceCdsCompliance(m.transformationLogic)
            : undefined,
          required: m.required ?? false,
          validated: false,
        }));
      }
    } catch (error) {
      console.error("[AIFHIRIntegration] OpenAI mapping generation failed:", error);
    }
  }

  if (generatedRules.length === 0) {
    generatedRules = generateFallbackMappingRules(detectedFields, integration.sourceFormat);
  }

  integration.mappingRules = [...integration.mappingRules, ...generatedRules];
  integration.updatedAt = new Date().toISOString();

  logHipaaAudit("MAPPING_RULES_GENERATED", {
    integrationId,
    rulesGenerated: generatedRules.length,
  });

  return generatedRules;
}

function analyzeSourceStructure(
  data: any[],
  format: SourceDataFormat
): SourceDataField[] {
  const fields: SourceDataField[] = [];

  if (data.length === 0) return fields;

  const sample = data[0];

  function extractFields(obj: any, prefix: string = ""): void {
    if (typeof obj !== "object" || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        extractFields(value, path);
      } else {
        fields.push({
          path,
          value: value,
          dataType: Array.isArray(value) ? "array" : typeof value,
          required: value !== null && value !== undefined && value !== "",
        });
      }
    }
  }

  extractFields(sample);
  return fields;
}

function generateFallbackMappingRules(
  fields: SourceDataField[],
  format: SourceDataFormat
): MappingRule[] {
  const rules: MappingRule[] = [];
  const fieldPathLower = (path: string) => path.toLowerCase();

  const patientFieldMappings: Record<string, string> = {
    mrn: "Patient.identifier[0].value",
    id: "Patient.identifier[0].value",
    patient_id: "Patient.identifier[0].value",
    first_name: "Patient.name[0].given[0]",
    firstname: "Patient.name[0].given[0]",
    given_name: "Patient.name[0].given[0]",
    last_name: "Patient.name[0].family",
    lastname: "Patient.name[0].family",
    family_name: "Patient.name[0].family",
    surname: "Patient.name[0].family",
    dob: "Patient.birthDate",
    date_of_birth: "Patient.birthDate",
    birthdate: "Patient.birthDate",
    birth_date: "Patient.birthDate",
    gender: "Patient.gender",
    sex: "Patient.gender",
    phone: "Patient.telecom[0].value",
    telephone: "Patient.telecom[0].value",
    email: "Patient.telecom[1].value",
    address: "Patient.address[0].line[0]",
    street: "Patient.address[0].line[0]",
    city: "Patient.address[0].city",
    state: "Patient.address[0].state",
    zip: "Patient.address[0].postalCode",
    postal_code: "Patient.address[0].postalCode",
  };

  for (const field of fields) {
    const lowerPath = fieldPathLower(field.path);
    const fhirPath = patientFieldMappings[lowerPath];

    if (fhirPath) {
      rules.push({
        id: `fallback-${field.path}`,
        sourcePath: field.path,
        sourceFormat: format,
        targetFhirPath: fhirPath,
        targetResourceType: "Patient",
        transformationType: fhirPath.includes("gender") ? "lookup" : "direct",
        codeSystemMapping: fhirPath.includes("gender")
          ? {
              sourceSystem: "Source.Gender",
              targetSystem: "http://hl7.org/fhir/administrative-gender",
              mappingTable: DEFAULT_CODE_SYSTEM_MAPPINGS.gender,
            }
          : undefined,
        required: field.required,
        validated: false,
      });
    }
  }

  return rules;
}

export async function transformData(
  integrationId: string,
  sourceData: SourceDataPayload
): Promise<FhirTransformedResource[]> {
  const integration = integrationCache.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  logHipaaAudit("DATA_TRANSFORMATION_STARTED", {
    integrationId,
    recordCount: sourceData.records.length,
    format: sourceData.format,
  });

  integration.status = "transforming";
  integration.statistics.totalRecords = sourceData.records.length;
  integration.updatedAt = new Date().toISOString();

  const transformedResources: FhirTransformedResource[] = [];
  const conflicts: IntegrationConflict[] = [];

  for (let i = 0; i < sourceData.records.length; i++) {
    const record = sourceData.records[i];
    const sourceId = record.id || record.mrn || `record-${i}`;

    try {
      const resourcesByType = new Map<string, any>();

      for (const rule of integration.mappingRules) {
        const sourceValue = getValueByPath(record, rule.sourcePath);

        if (sourceValue === undefined || sourceValue === null) {
          if (rule.required) {
            conflicts.push({
              id: `conflict-${randomUUID().substring(0, 8)}`,
              integrationId,
              conflictType: "missing_required",
              severity: "high",
              description: `Required field missing: ${rule.sourcePath}`,
              sourcePath: rule.sourcePath,
              sourceValue: null,
              targetPath: rule.targetFhirPath,
              suggestedResolution: "manual_review",
            });
          }
          continue;
        }

        if (!resourcesByType.has(rule.targetResourceType)) {
          resourcesByType.set(
            rule.targetResourceType,
            JSON.parse(JSON.stringify(FHIR_RESOURCE_TEMPLATES[rule.targetResourceType] || {}))
          );
        }

        const resource = resourcesByType.get(rule.targetResourceType);
        const transformedValue = applyTransformation(rule, sourceValue);

        if (transformedValue.conflict) {
          conflicts.push({
            id: `conflict-${randomUUID().substring(0, 8)}`,
            integrationId,
            conflictType: transformedValue.conflict.type,
            severity: transformedValue.conflict.severity,
            description: transformedValue.conflict.description,
            sourcePath: rule.sourcePath,
            sourceValue: sourceValue,
            targetPath: rule.targetFhirPath,
            suggestedResolution: transformedValue.conflict.suggestedResolution,
            resolutionDetails: transformedValue.conflict.details,
          });
        }

        setValueByPath(resource, rule.targetFhirPath.replace(`${rule.targetResourceType}.`, ""), transformedValue.value);
      }

      for (const [resourceType, resource] of Array.from(resourcesByType.entries())) {
        resource.id = `${hashIdentifier(sourceId)}-${resourceType.toLowerCase()}`;

        const qualityScore = calculateResourceQualityScore(resource, resourceType);
        const validationErrors = validateFhirResource(resource, resourceType);

        transformedResources.push({
          resourceType,
          id: resource.id,
          originalSourceId: hashIdentifier(sourceId),
          sourceFormat: sourceData.format,
          fhirResource: resource,
          mappingsApplied: integration.mappingRules
            .filter((r) => r.targetResourceType === resourceType)
            .map((r) => r.id),
          qualityScore,
          validationErrors,
          createdAt: new Date().toISOString(),
        });

        if (validationErrors.length === 0) {
          integration.statistics.successfulTransforms++;
        } else {
          integration.statistics.failedTransforms++;
        }
      }
    } catch (error: any) {
      console.error(`[AIFHIRIntegration] Transform error for record ${i}:`, error);
      integration.statistics.failedTransforms++;
    }
  }

  integration.conflicts = [...integration.conflicts, ...conflicts];
  integration.transformedResources = transformedResources;
  integration.statistics.conflictsDetected = integration.conflicts.length;
  integration.statistics.averageQualityScore =
    transformedResources.length > 0
      ? transformedResources.reduce((sum, r) => sum + r.qualityScore, 0) / transformedResources.length
      : 0;

  if (conflicts.length > 0) {
    integration.status = "conflict_detected";
  } else {
    integration.status = "completed";
    integration.completedAt = new Date().toISOString();
  }

  integration.updatedAt = new Date().toISOString();

  logHipaaAudit("DATA_TRANSFORMATION_COMPLETED", {
    integrationId,
    successfulTransforms: integration.statistics.successfulTransforms,
    failedTransforms: integration.statistics.failedTransforms,
    conflictsDetected: conflicts.length,
  });

  return transformedResources;
}

function getValueByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);

    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);

      if (!current[arrayName]) current[arrayName] = [];
      while (current[arrayName].length <= index) {
        current[arrayName].push({});
      }
      current = current[arrayName][index];
    } else {
      if (!current[part]) current[part] = {};
      current = current[part];
    }
  }

  const lastPart = parts[parts.length - 1];
  const lastArrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);

  if (lastArrayMatch) {
    const arrayName = lastArrayMatch[1];
    const index = parseInt(lastArrayMatch[2]);
    if (!current[arrayName]) current[arrayName] = [];
    while (current[arrayName].length <= index) {
      current[arrayName].push(null);
    }
    current[arrayName][index] = value;
  } else {
    current[lastPart] = value;
  }
}

function applyTransformation(
  rule: MappingRule,
  sourceValue: any
): { value: any; conflict?: { type: ConflictType; severity: "critical" | "high" | "medium" | "low"; description: string; suggestedResolution: ConflictResolution; details?: string } } {
  switch (rule.transformationType) {
    case "direct":
      return { value: sourceValue };

    case "lookup":
      if (rule.codeSystemMapping) {
        const mapped = rule.codeSystemMapping.mappingTable[sourceValue];
        if (mapped) {
          return { value: mapped };
        } else {
          return {
            value: sourceValue,
            conflict: {
              type: "code_system_conflict",
              severity: "medium",
              description: `Unknown code value: ${sourceValue} for ${rule.sourcePath}`,
              suggestedResolution: "manual_review",
              details: `Value "${sourceValue}" not found in mapping table for ${rule.codeSystemMapping.sourceSystem}`,
            },
          };
        }
      }
      return { value: sourceValue };

    case "computed":
      if (rule.targetFhirPath.includes("birthDate") || rule.targetFhirPath.includes("Date")) {
        const parsed = parseDate(sourceValue);
        if (parsed) {
          return { value: parsed };
        } else {
          return {
            value: null,
            conflict: {
              type: "format_incompatible",
              severity: "medium",
              description: `Unable to parse date: ${sourceValue}`,
              suggestedResolution: "manual_review",
            },
          };
        }
      }
      if (rule.targetFhirPath.includes("identifier")) {
        return {
          value: {
            system: "urn:source-system",
            value: String(sourceValue),
          },
        };
      }
      return { value: sourceValue };

    case "conditional":
      return { value: sourceValue };

    case "aggregate":
      return { value: sourceValue };

    default:
      return { value: sourceValue };
  }
}

function parseDate(value: any): string | null {
  if (!value) return null;

  const str = String(value);

  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{4})(\d{2})(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      if (format === formats[0]) return str;
      if (format === formats[1]) return `${match[1]}-${match[2]}-${match[3]}`;
      if (format === formats[2]) return `${match[3]}-${match[1]}-${match[2]}`;
      if (format === formats[3]) return `${match[3]}-${match[1]}-${match[2]}`;
    }
  }

  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {
    return null;
  }

  return null;
}

function calculateResourceQualityScore(resource: any, resourceType: string): number {
  let score = 100;
  const template = FHIR_RESOURCE_TEMPLATES[resourceType];

  if (!template) return 50;

  const requiredFields: Record<string, string[]> = {
    Patient: ["identifier", "name"],
    Observation: ["status", "code", "subject"],
    Condition: ["clinicalStatus", "code", "subject"],
    MedicationRequest: ["status", "intent", "medicationCodeableConcept", "subject"],
    Encounter: ["status", "class", "subject"],
  };

  const required = requiredFields[resourceType] || [];
  const missingRequired = required.filter((f) => {
    const val = resource[f];
    return val === null || val === undefined || (Array.isArray(val) && val.length === 0);
  });

  score -= missingRequired.length * 20;

  const totalFields = Object.keys(template).length;
  const populatedFields = Object.entries(resource).filter(([_, v]) => {
    return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
  }).length;

  const completeness = populatedFields / totalFields;
  score = Math.min(score, completeness * 100);

  return Math.max(0, Math.round(score));
}

function validateFhirResource(resource: any, resourceType: string): string[] {
  const errors: string[] = [];

  if (!resource.resourceType || resource.resourceType !== resourceType) {
    errors.push(`Invalid or missing resourceType: expected ${resourceType}`);
  }

  const requiredFields: Record<string, string[]> = {
    Patient: ["identifier"],
    Observation: ["status", "code"],
    Condition: ["code"],
    MedicationRequest: ["status", "intent"],
    Encounter: ["status", "class"],
  };

  const required = requiredFields[resourceType] || [];
  for (const field of required) {
    const val = resource[field];
    if (val === null || val === undefined || (Array.isArray(val) && val.length === 0)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return errors;
}

export async function detectConflicts(integrationId: string): Promise<IntegrationConflict[]> {
  const integration = integrationCache.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  logHipaaAudit("CONFLICT_DETECTION_REQUESTED", { integrationId });

  const newConflicts: IntegrationConflict[] = [];

  const resourceGroups = new Map<string, FhirTransformedResource[]>();
  for (const resource of integration.transformedResources) {
    const key = `${resource.resourceType}-${resource.originalSourceId}`;
    if (!resourceGroups.has(key)) {
      resourceGroups.set(key, []);
    }
    resourceGroups.get(key)!.push(resource);
  }

  for (const [key, resources] of Array.from(resourceGroups.entries())) {
    if (resources.length > 1) {
      newConflicts.push({
        id: `conflict-dup-${randomUUID().substring(0, 8)}`,
        integrationId,
        conflictType: "duplicate",
        severity: "high",
        description: `Duplicate resources detected for ${key}`,
        sourcePath: "record",
        sourceValue: resources.length,
        suggestedResolution: "merge",
        resolutionDetails: `${resources.length} duplicate resources found. Consider merging or deduplicating.`,
      });
    }
  }

  for (const resource of integration.transformedResources) {
    if (resource.validationErrors.length > 0) {
      newConflicts.push({
        id: `conflict-val-${randomUUID().substring(0, 8)}`,
        integrationId,
        conflictType: "format_incompatible",
        severity: "medium",
        description: `Validation errors in ${resource.resourceType} ${resource.id}`,
        sourcePath: resource.resourceType,
        sourceValue: resource.validationErrors,
        suggestedResolution: "manual_review",
      });
    }
  }

  integration.conflicts = [...integration.conflicts, ...newConflicts];
  integration.statistics.conflictsDetected = integration.conflicts.length;
  integration.updatedAt = new Date().toISOString();

  logHipaaAudit("CONFLICT_DETECTION_COMPLETED", {
    integrationId,
    conflictsFound: newConflicts.length,
  });

  return newConflicts;
}

export async function resolveConflict(
  integrationId: string,
  conflictId: string,
  resolution: ConflictResolution,
  resolvedBy: string = "system"
): Promise<IntegrationConflict> {
  const integration = integrationCache.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const conflict = integration.conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new Error("Conflict not found");
  }

  logHipaaAudit("CONFLICT_RESOLUTION_APPLIED", {
    integrationId,
    conflictId,
    resolution,
    resolvedBy,
  });

  conflict.actualResolution = resolution;
  conflict.resolvedAt = new Date().toISOString();
  conflict.resolvedBy = resolvedBy;

  integration.statistics.conflictsResolved++;
  integration.updatedAt = new Date().toISOString();

  const unresolvedConflicts = integration.conflicts.filter((c) => !c.resolvedAt);
  if (unresolvedConflicts.length === 0 && integration.status === "conflict_detected") {
    integration.status = "completed";
    integration.completedAt = new Date().toISOString();
  }

  return conflict;
}

export async function generateQualityInsights(integrationId: string): Promise<DataQualityInsight[]> {
  const integration = integrationCache.get(integrationId);
  if (!integration) {
    throw new Error("Integration not found");
  }

  logHipaaAudit("QUALITY_INSIGHTS_REQUESTED", { integrationId });

  const insights: DataQualityInsight[] = [];
  const resources = integration.transformedResources;

  if (resources.length === 0) {
    return insights;
  }

  const totalFields = resources.reduce((sum, r) => {
    return sum + Object.keys(r.fhirResource || {}).length;
  }, 0);

  const populatedFields = resources.reduce((sum, r) => {
    return sum + Object.entries(r.fhirResource || {}).filter(([_, v]) => {
      return v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);
    }).length;
  }, 0);

  const completenessScore = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;

  let completenessFindings = [
    enforceCdsCompliance(`${populatedFields} of ${totalFields} fields populated across all resources`),
  ];
  let completenessRecommendations: string[] = [];

  if (completenessScore < 70) {
    completenessFindings.push(enforceCdsCompliance("Low field population rate detected"));
    completenessRecommendations.push(enforceCdsCompliance("Review source data for missing fields"));
    completenessRecommendations.push(enforceCdsCompliance("Consider adding default value mappings"));
  }

  insights.push({
    id: `insight-completeness-${randomUUID().substring(0, 8)}`,
    integrationId,
    category: "completeness",
    score: completenessScore,
    findings: completenessFindings,
    recommendations: completenessRecommendations,
    affectedFields: [],
    trend: completenessScore > 80 ? "stable" : "declining",
  });

  const validResources = resources.filter((r) => r.validationErrors.length === 0).length;
  const validityScore = Math.round((validResources / resources.length) * 100);

  let validityFindings = [
    enforceCdsCompliance(`${validResources} of ${resources.length} resources passed validation`),
  ];
  let validityRecommendations: string[] = [];

  if (validityScore < 90) {
    validityFindings.push(enforceCdsCompliance("Some resources have validation errors"));
    validityRecommendations.push(enforceCdsCompliance("Review and fix validation errors"));
    validityRecommendations.push(enforceCdsCompliance("Update mapping rules to ensure FHIR compliance"));
  }

  insights.push({
    id: `insight-validity-${randomUUID().substring(0, 8)}`,
    integrationId,
    category: "validity",
    score: validityScore,
    findings: validityFindings,
    recommendations: validityRecommendations,
    affectedFields: [],
    trend: validityScore > 90 ? "stable" : "declining",
  });

  const avgQuality = integration.statistics.averageQualityScore;
  const accuracyScore = Math.round(avgQuality);

  let accuracyFindings = [
    enforceCdsCompliance(`Average resource quality score: ${accuracyScore}%`),
  ];
  let accuracyRecommendations: string[] = [];

  if (accuracyScore < 80) {
    accuracyFindings.push(enforceCdsCompliance("Quality score below target threshold"));
    accuracyRecommendations.push(enforceCdsCompliance("Review transformation rules for accuracy"));
    accuracyRecommendations.push(enforceCdsCompliance("Validate code system mappings"));
  }

  insights.push({
    id: `insight-accuracy-${randomUUID().substring(0, 8)}`,
    integrationId,
    category: "accuracy",
    score: accuracyScore,
    findings: accuracyFindings,
    recommendations: accuracyRecommendations,
    affectedFields: [],
    trend: accuracyScore > 85 ? "improving" : "stable",
  });

  if (aiEnabled) {
    try {
      const content = await generatePhiSafeText({
        system: NO_CDS_INTEGRATION_PROMPT,
        user: `Analyze data quality for this FHIR integration:

Integration: ${integration.name}
Source: ${integration.sourceSystem} (${integration.sourceFormat})
Total Records: ${integration.statistics.totalRecords}
Successful: ${integration.statistics.successfulTransforms}
Failed: ${integration.statistics.failedTransforms}
Conflicts: ${integration.statistics.conflictsDetected}
Avg Quality: ${integration.statistics.averageQualityScore}%

Provide additional quality insights in JSON format:
{
  "insights": [
    {
      "category": "consistency|timeliness|uniqueness",
      "score": 0-100,
      "findings": ["..."],
      "recommendations": ["..."]
    }
  ]
}

Focus on data quality and interoperability. No clinical recommendations.`,
        responseMimeType: "application/json",
      });

      if (content) {
        const parsed = JSON.parse(content);
        for (const aiInsight of parsed.insights || []) {
          insights.push({
            id: `insight-ai-${randomUUID().substring(0, 8)}`,
            integrationId,
            category: aiInsight.category,
            score: aiInsight.score,
            findings: (aiInsight.findings || []).map((f: string) => enforceCdsCompliance(f)),
            recommendations: (aiInsight.recommendations || []).map((r: string) => enforceCdsCompliance(r)),
            affectedFields: aiInsight.affectedFields || [],
          });
        }
      }
    } catch (error) {
      console.error("[AIFHIRIntegration] OpenAI quality analysis failed:", error);
    }
  }

  const consistencyScore = 100 - (integration.statistics.conflictsDetected * 5);
  insights.push({
    id: `insight-consistency-${randomUUID().substring(0, 8)}`,
    integrationId,
    category: "consistency",
    score: Math.max(0, consistencyScore),
    findings: [
      enforceCdsCompliance(`${integration.statistics.conflictsDetected} data conflicts detected`),
      enforceCdsCompliance(`${integration.statistics.conflictsResolved} conflicts resolved`),
    ],
    recommendations: consistencyScore < 80
      ? [enforceCdsCompliance("Review and resolve remaining conflicts"), enforceCdsCompliance("Standardize source data formats")]
      : [],
    affectedFields: [],
    trend: consistencyScore > 90 ? "improving" : "stable",
  });

  integration.qualityInsights = insights;
  integration.updatedAt = new Date().toISOString();

  logHipaaAudit("QUALITY_INSIGHTS_GENERATED", {
    integrationId,
    insightsCount: insights.length,
  });

  return insights;
}

export function getIntegration(id: string): DataIntegration | undefined {
  return integrationCache.get(id);
}

export function getAllIntegrations(): DataIntegration[] {
  return Array.from(integrationCache.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function deleteIntegration(id: string): boolean {
  logHipaaAudit("DATA_INTEGRATION_DELETED", { integrationId: id });
  return integrationCache.delete(id);
}

export function getMappingRuleLibrary(): Map<string, MappingRule[]> {
  return mappingRuleLibrary;
}

console.log("[AIFHIRDataIntegration] Service initialized");
