import { randomUUID, createHash } from "crypto";

/**
 * FHIR Resource Mapper Service
 * 
 * Provides mapping and transformation of FHIR resources between different
 * formats and US Core profiles. Supports import of FHIR bundles and 
 * individual resources with validation.
 * 
 * SECURITY NOTES FOR PRODUCTION:
 * 1. Mapping operations should be protected with authentication
 * 2. Resource imports should validate source and enforce access control
 * 3. HIPAA audit logging is implemented for all mapping operations
 */

export interface MappingRule {
  id: string;
  sourceResourceType: string;
  targetEntityType: string;
  fieldMappings: FieldMapping[];
  transformations: Transformation[];
  validationRules: ValidationRule[];
  priority: number;
  isActive: boolean;
  useCoreProfile?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  sourcePath: string;
  targetField: string;
  dataType: "string" | "number" | "boolean" | "date" | "datetime" | "reference" | "coding" | "quantity" | "array";
  isRequired: boolean;
  defaultValue?: unknown;
  codingSystem?: string;
}

export interface Transformation {
  type: "concat" | "split" | "format" | "lookup" | "calculate" | "extract_coding" | "extract_reference";
  sourceFields: string[];
  targetField: string;
  config: Record<string, unknown>;
}

export interface ValidationRule {
  field: string;
  rule: "required" | "format" | "range" | "regex" | "code_system" | "reference_exists";
  config: Record<string, unknown>;
  errorMessage: string;
}

export interface MappedEntity {
  id: string;
  userId: string;
  entityType: string;
  sourceResourceId: string;
  sourceResourceType: string;
  sourceServerId: string;
  data: Record<string, unknown>;
  mappingRuleId: string;
  validationErrors: string[];
  importedAt: string;
  lastUpdatedAt: string;
}

export interface ImportResult {
  id: string;
  userId: string;
  serverId: string;
  resourceType: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  entities: MappedEntity[];
  errors: Array<{ resourceId: string; error: string }>;
  startedAt: string;
  completedAt: string;
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = Object.entries(details)
    .map(([k, v]) => `${k}:${typeof v === "string" && k.includes("Id") ? hashIdentifier(v) : v}`)
    .join(" ");
  console.log(`[HIPAA-AUDIT][ResourceMapper] ${timestamp} - ${action} - ${sanitizedDetails}`);
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

function extractCoding(resource: unknown, path: string, system?: string): { code: string; display: string; system: string } | null {
  const value = getNestedValue(resource, path);
  
  if (!value) return null;
  
  if (Array.isArray(value)) {
    const codings = value as Array<{ system?: string; code?: string; display?: string }>;
    const match = system 
      ? codings.find(c => c.system === system) 
      : codings[0];
    if (match) {
      return {
        code: match.code || "",
        display: match.display || "",
        system: match.system || "",
      };
    }
  } else if (typeof value === "object") {
    const coding = value as { system?: string; code?: string; display?: string };
    return {
      code: coding.code || "",
      display: coding.display || "",
      system: coding.system || "",
    };
  }
  
  return null;
}

function extractReference(resource: unknown, path: string): { reference: string; type: string; id: string } | null {
  const value = getNestedValue(resource, path) as { reference?: string; type?: string; display?: string } | undefined;
  
  if (!value?.reference) return null;
  
  const refParts = value.reference.split("/");
  return {
    reference: value.reference,
    type: refParts.length >= 2 ? refParts[refParts.length - 2] : value.type || "",
    id: refParts[refParts.length - 1],
  };
}

const US_CORE_MAPPING_RULES: MappingRule[] = [
  {
    id: "map-patient",
    sourceResourceType: "Patient",
    targetEntityType: "patient",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "identifier[0].value", targetField: "mrn", dataType: "string", isRequired: false },
      { sourcePath: "name[0].given[0]", targetField: "firstName", dataType: "string", isRequired: true },
      { sourcePath: "name[0].family", targetField: "lastName", dataType: "string", isRequired: true },
      { sourcePath: "birthDate", targetField: "dateOfBirth", dataType: "date", isRequired: true },
      { sourcePath: "gender", targetField: "gender", dataType: "string", isRequired: true },
      { sourcePath: "telecom", targetField: "contactInfo", dataType: "array", isRequired: false },
      { sourcePath: "address[0].line[0]", targetField: "addressLine1", dataType: "string", isRequired: false },
      { sourcePath: "address[0].city", targetField: "city", dataType: "string", isRequired: false },
      { sourcePath: "address[0].state", targetField: "state", dataType: "string", isRequired: false },
      { sourcePath: "address[0].postalCode", targetField: "zipCode", dataType: "string", isRequired: false },
      { sourcePath: "communication[0].language.coding[0].code", targetField: "preferredLanguage", dataType: "string", isRequired: false },
      { sourcePath: "extension", targetField: "extensions", dataType: "array", isRequired: false },
    ],
    transformations: [
      {
        type: "concat",
        sourceFields: ["name[0].given[0]", "name[0].family"],
        targetField: "fullName",
        config: { separator: " " },
      },
    ],
    validationRules: [
      { field: "firstName", rule: "required", config: {}, errorMessage: "First name is required" },
      { field: "lastName", rule: "required", config: {}, errorMessage: "Last name is required" },
    ],
    priority: 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-condition",
    sourceResourceType: "Condition",
    targetEntityType: "condition",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].code", targetField: "code", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].display", targetField: "displayName", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].system", targetField: "codeSystem", dataType: "string", isRequired: false },
      { sourcePath: "clinicalStatus.coding[0].code", targetField: "clinicalStatus", dataType: "string", isRequired: true },
      { sourcePath: "verificationStatus.coding[0].code", targetField: "verificationStatus", dataType: "string", isRequired: false },
      { sourcePath: "category[0].coding[0].code", targetField: "category", dataType: "string", isRequired: true },
      { sourcePath: "onsetDateTime", targetField: "onsetDate", dataType: "datetime", isRequired: false },
      { sourcePath: "abatementDateTime", targetField: "abatementDate", dataType: "datetime", isRequired: false },
      { sourcePath: "recordedDate", targetField: "recordedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "encounter.reference", targetField: "encounterReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "code", rule: "required", config: {}, errorMessage: "Condition code is required" },
      { field: "clinicalStatus", rule: "required", config: {}, errorMessage: "Clinical status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-observation",
    sourceResourceType: "Observation",
    targetEntityType: "observation",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].code", targetField: "code", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].display", targetField: "displayName", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].system", targetField: "codeSystem", dataType: "string", isRequired: false, codingSystem: "http://loinc.org" },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "category[0].coding[0].code", targetField: "category", dataType: "string", isRequired: true },
      { sourcePath: "effectiveDateTime", targetField: "effectiveDate", dataType: "datetime", isRequired: false },
      { sourcePath: "issued", targetField: "issuedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "valueQuantity.value", targetField: "value", dataType: "number", isRequired: false },
      { sourcePath: "valueQuantity.unit", targetField: "unit", dataType: "string", isRequired: false },
      { sourcePath: "valueString", targetField: "valueText", dataType: "string", isRequired: false },
      { sourcePath: "valueCodeableConcept.coding[0].display", targetField: "valueCodeDisplay", dataType: "string", isRequired: false },
      { sourcePath: "interpretation[0].coding[0].code", targetField: "interpretation", dataType: "string", isRequired: false },
      { sourcePath: "referenceRange[0].low.value", targetField: "referenceRangeLow", dataType: "number", isRequired: false },
      { sourcePath: "referenceRange[0].high.value", targetField: "referenceRangeHigh", dataType: "number", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "performer[0].reference", targetField: "performerReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "code", rule: "required", config: {}, errorMessage: "Observation code is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-medication-request",
    sourceResourceType: "MedicationRequest",
    targetEntityType: "medication",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "medicationCodeableConcept.coding[0].code", targetField: "medicationCode", dataType: "string", isRequired: true, codingSystem: "http://www.nlm.nih.gov/research/umls/rxnorm" },
      { sourcePath: "medicationCodeableConcept.coding[0].display", targetField: "medicationName", dataType: "string", isRequired: true },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "intent", targetField: "intent", dataType: "string", isRequired: true },
      { sourcePath: "authoredOn", targetField: "prescribedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "dosageInstruction[0].text", targetField: "dosageInstructions", dataType: "string", isRequired: false },
      { sourcePath: "dosageInstruction[0].timing.repeat.frequency", targetField: "frequency", dataType: "number", isRequired: false },
      { sourcePath: "dosageInstruction[0].timing.repeat.period", targetField: "period", dataType: "number", isRequired: false },
      { sourcePath: "dosageInstruction[0].timing.repeat.periodUnit", targetField: "periodUnit", dataType: "string", isRequired: false },
      { sourcePath: "dosageInstruction[0].route.coding[0].display", targetField: "route", dataType: "string", isRequired: false },
      { sourcePath: "dispenseRequest.quantity.value", targetField: "dispenseQuantity", dataType: "number", isRequired: false },
      { sourcePath: "dispenseRequest.numberOfRepeatsAllowed", targetField: "refills", dataType: "number", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "requester.reference", targetField: "prescriberReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "medicationName", rule: "required", config: {}, errorMessage: "Medication name is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-allergy-intolerance",
    sourceResourceType: "AllergyIntolerance",
    targetEntityType: "allergy",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].code", targetField: "code", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].display", targetField: "displayName", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].system", targetField: "codeSystem", dataType: "string", isRequired: false },
      { sourcePath: "clinicalStatus.coding[0].code", targetField: "clinicalStatus", dataType: "string", isRequired: true },
      { sourcePath: "verificationStatus.coding[0].code", targetField: "verificationStatus", dataType: "string", isRequired: false },
      { sourcePath: "type", targetField: "type", dataType: "string", isRequired: false },
      { sourcePath: "category[0]", targetField: "category", dataType: "string", isRequired: false },
      { sourcePath: "criticality", targetField: "criticality", dataType: "string", isRequired: false },
      { sourcePath: "onsetDateTime", targetField: "onsetDate", dataType: "datetime", isRequired: false },
      { sourcePath: "recordedDate", targetField: "recordedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "reaction[0].manifestation[0].coding[0].display", targetField: "reaction", dataType: "string", isRequired: false },
      { sourcePath: "reaction[0].severity", targetField: "reactionSeverity", dataType: "string", isRequired: false },
      { sourcePath: "patient.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
    ],
    transformations: [],
    validationRules: [
      { field: "displayName", rule: "required", config: {}, errorMessage: "Allergy name is required" },
      { field: "clinicalStatus", rule: "required", config: {}, errorMessage: "Clinical status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-procedure",
    sourceResourceType: "Procedure",
    targetEntityType: "procedure",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].code", targetField: "code", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].display", targetField: "displayName", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].system", targetField: "codeSystem", dataType: "string", isRequired: false },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "category.coding[0].display", targetField: "category", dataType: "string", isRequired: false },
      { sourcePath: "performedDateTime", targetField: "performedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "performedPeriod.start", targetField: "performedStart", dataType: "datetime", isRequired: false },
      { sourcePath: "performedPeriod.end", targetField: "performedEnd", dataType: "datetime", isRequired: false },
      { sourcePath: "outcome.coding[0].display", targetField: "outcome", dataType: "string", isRequired: false },
      { sourcePath: "complication[0].coding[0].display", targetField: "complication", dataType: "string", isRequired: false },
      { sourcePath: "bodySite[0].coding[0].display", targetField: "bodySite", dataType: "string", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "performer[0].actor.reference", targetField: "performerReference", dataType: "reference", isRequired: false },
      { sourcePath: "encounter.reference", targetField: "encounterReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "code", rule: "required", config: {}, errorMessage: "Procedure code is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-immunization",
    sourceResourceType: "Immunization",
    targetEntityType: "immunization",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "vaccineCode.coding[0].code", targetField: "vaccineCode", dataType: "string", isRequired: true, codingSystem: "http://hl7.org/fhir/sid/cvx" },
      { sourcePath: "vaccineCode.coding[0].display", targetField: "vaccineName", dataType: "string", isRequired: true },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "statusReason.coding[0].display", targetField: "statusReason", dataType: "string", isRequired: false },
      { sourcePath: "occurrenceDateTime", targetField: "administeredDate", dataType: "datetime", isRequired: true },
      { sourcePath: "primarySource", targetField: "primarySource", dataType: "boolean", isRequired: false },
      { sourcePath: "lotNumber", targetField: "lotNumber", dataType: "string", isRequired: false },
      { sourcePath: "expirationDate", targetField: "expirationDate", dataType: "date", isRequired: false },
      { sourcePath: "site.coding[0].display", targetField: "site", dataType: "string", isRequired: false },
      { sourcePath: "route.coding[0].display", targetField: "route", dataType: "string", isRequired: false },
      { sourcePath: "doseQuantity.value", targetField: "doseQuantity", dataType: "number", isRequired: false },
      { sourcePath: "doseQuantity.unit", targetField: "doseUnit", dataType: "string", isRequired: false },
      { sourcePath: "patient.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "performer[0].actor.reference", targetField: "performerReference", dataType: "reference", isRequired: false },
      { sourcePath: "location.reference", targetField: "locationReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "vaccineName", rule: "required", config: {}, errorMessage: "Vaccine name is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-diagnostic-report",
    sourceResourceType: "DiagnosticReport",
    targetEntityType: "diagnosticReport",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "code.coding[0].code", targetField: "code", dataType: "string", isRequired: true, codingSystem: "http://loinc.org" },
      { sourcePath: "code.coding[0].display", targetField: "displayName", dataType: "string", isRequired: true },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "category[0].coding[0].display", targetField: "category", dataType: "string", isRequired: true },
      { sourcePath: "effectiveDateTime", targetField: "effectiveDate", dataType: "datetime", isRequired: false },
      { sourcePath: "issued", targetField: "issuedDate", dataType: "datetime", isRequired: false },
      { sourcePath: "conclusion", targetField: "conclusion", dataType: "string", isRequired: false },
      { sourcePath: "conclusionCode[0].coding[0].display", targetField: "conclusionCode", dataType: "string", isRequired: false },
      { sourcePath: "presentedForm[0].contentType", targetField: "attachmentType", dataType: "string", isRequired: false },
      { sourcePath: "presentedForm[0].url", targetField: "attachmentUrl", dataType: "string", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "performer[0].reference", targetField: "performerReference", dataType: "reference", isRequired: false },
      { sourcePath: "result", targetField: "results", dataType: "array", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "code", rule: "required", config: {}, errorMessage: "Report code is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-care-plan",
    sourceResourceType: "CarePlan",
    targetEntityType: "carePlan",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "title", targetField: "title", dataType: "string", isRequired: false },
      { sourcePath: "description", targetField: "description", dataType: "string", isRequired: false },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "intent", targetField: "intent", dataType: "string", isRequired: true },
      { sourcePath: "category[0].coding[0].display", targetField: "category", dataType: "string", isRequired: true },
      { sourcePath: "period.start", targetField: "periodStart", dataType: "datetime", isRequired: false },
      { sourcePath: "period.end", targetField: "periodEnd", dataType: "datetime", isRequired: false },
      { sourcePath: "created", targetField: "createdDate", dataType: "datetime", isRequired: false },
      { sourcePath: "addresses", targetField: "addressedConditions", dataType: "array", isRequired: false },
      { sourcePath: "goal", targetField: "goals", dataType: "array", isRequired: false },
      { sourcePath: "activity", targetField: "activities", dataType: "array", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "author.reference", targetField: "authorReference", dataType: "reference", isRequired: false },
      { sourcePath: "careTeam", targetField: "careTeamReferences", dataType: "array", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
      { field: "intent", rule: "required", config: {}, errorMessage: "Intent is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-goal",
    sourceResourceType: "Goal",
    targetEntityType: "goal",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "description.text", targetField: "description", dataType: "string", isRequired: true },
      { sourcePath: "lifecycleStatus", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "achievementStatus.coding[0].code", targetField: "achievementStatus", dataType: "string", isRequired: false },
      { sourcePath: "category[0].coding[0].display", targetField: "category", dataType: "string", isRequired: false },
      { sourcePath: "priority.coding[0].display", targetField: "priority", dataType: "string", isRequired: false },
      { sourcePath: "startDate", targetField: "startDate", dataType: "date", isRequired: false },
      { sourcePath: "target[0].dueDate", targetField: "targetDate", dataType: "date", isRequired: false },
      { sourcePath: "target[0].measure.coding[0].display", targetField: "targetMeasure", dataType: "string", isRequired: false },
      { sourcePath: "target[0].detailQuantity.value", targetField: "targetValue", dataType: "number", isRequired: false },
      { sourcePath: "target[0].detailQuantity.unit", targetField: "targetUnit", dataType: "string", isRequired: false },
      { sourcePath: "statusDate", targetField: "statusDate", dataType: "date", isRequired: false },
      { sourcePath: "statusReason", targetField: "statusReason", dataType: "string", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "expressedBy.reference", targetField: "expressedByReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "description", rule: "required", config: {}, errorMessage: "Goal description is required" },
      { field: "status", rule: "required", config: {}, errorMessage: "Lifecycle status is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-encounter",
    sourceResourceType: "Encounter",
    targetEntityType: "encounter",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "identifier[0].value", targetField: "encounterNumber", dataType: "string", isRequired: false },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "class.code", targetField: "class", dataType: "string", isRequired: true },
      { sourcePath: "class.display", targetField: "classDisplay", dataType: "string", isRequired: false },
      { sourcePath: "type[0].coding[0].code", targetField: "typeCode", dataType: "string", isRequired: true },
      { sourcePath: "type[0].coding[0].display", targetField: "typeDisplay", dataType: "string", isRequired: false },
      { sourcePath: "priority.coding[0].display", targetField: "priority", dataType: "string", isRequired: false },
      { sourcePath: "period.start", targetField: "startDate", dataType: "datetime", isRequired: false },
      { sourcePath: "period.end", targetField: "endDate", dataType: "datetime", isRequired: false },
      { sourcePath: "reasonCode[0].coding[0].display", targetField: "reason", dataType: "string", isRequired: false },
      { sourcePath: "hospitalization.dischargeDisposition.coding[0].display", targetField: "dischargeDisposition", dataType: "string", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "participant", targetField: "participants", dataType: "array", isRequired: false },
      { sourcePath: "location[0].location.reference", targetField: "locationReference", dataType: "reference", isRequired: false },
      { sourcePath: "serviceProvider.reference", targetField: "serviceProviderReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
      { field: "class", rule: "required", config: {}, errorMessage: "Encounter class is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "map-document-reference",
    sourceResourceType: "DocumentReference",
    targetEntityType: "document",
    useCoreProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
    fieldMappings: [
      { sourcePath: "id", targetField: "fhirId", dataType: "string", isRequired: true },
      { sourcePath: "identifier[0].value", targetField: "documentId", dataType: "string", isRequired: false },
      { sourcePath: "status", targetField: "status", dataType: "string", isRequired: true },
      { sourcePath: "docStatus", targetField: "documentStatus", dataType: "string", isRequired: false },
      { sourcePath: "type.coding[0].code", targetField: "typeCode", dataType: "string", isRequired: true, codingSystem: "http://loinc.org" },
      { sourcePath: "type.coding[0].display", targetField: "typeDisplay", dataType: "string", isRequired: true },
      { sourcePath: "category[0].coding[0].display", targetField: "category", dataType: "string", isRequired: true },
      { sourcePath: "date", targetField: "createdDate", dataType: "datetime", isRequired: false },
      { sourcePath: "description", targetField: "description", dataType: "string", isRequired: false },
      { sourcePath: "content[0].attachment.contentType", targetField: "contentType", dataType: "string", isRequired: false },
      { sourcePath: "content[0].attachment.url", targetField: "contentUrl", dataType: "string", isRequired: false },
      { sourcePath: "content[0].attachment.title", targetField: "contentTitle", dataType: "string", isRequired: false },
      { sourcePath: "content[0].attachment.size", targetField: "contentSize", dataType: "number", isRequired: false },
      { sourcePath: "subject.reference", targetField: "patientReference", dataType: "reference", isRequired: true },
      { sourcePath: "author", targetField: "authors", dataType: "array", isRequired: false },
      { sourcePath: "custodian.reference", targetField: "custodianReference", dataType: "reference", isRequired: false },
      { sourcePath: "context.encounter[0].reference", targetField: "encounterReference", dataType: "reference", isRequired: false },
    ],
    transformations: [],
    validationRules: [
      { field: "status", rule: "required", config: {}, errorMessage: "Status is required" },
      { field: "typeDisplay", rule: "required", config: {}, errorMessage: "Document type is required" },
    ],
    priority: 2,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class FHIRResourceMapper {
  private mappingRules: Map<string, MappingRule> = new Map();
  private mappedEntities: Map<string, MappedEntity> = new Map();
  private importResults: Map<string, ImportResult> = new Map();

  constructor() {
    US_CORE_MAPPING_RULES.forEach(rule => this.mappingRules.set(rule.id, rule));
    console.log("[ResourceMapper] Initialized with", this.mappingRules.size, "US Core mapping rules");
  }

  getMappingRules(): MappingRule[] {
    return Array.from(this.mappingRules.values());
  }

  getMappingRuleByResourceType(resourceType: string): MappingRule | undefined {
    return Array.from(this.mappingRules.values()).find(r => r.sourceResourceType === resourceType);
  }

  addCustomMappingRule(rule: Omit<MappingRule, "id" | "createdAt" | "updatedAt">): MappingRule {
    const id = `custom-map-${randomUUID().slice(0, 8)}`;
    const fullRule: MappingRule = {
      ...rule,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mappingRules.set(id, fullRule);
    return fullRule;
  }

  mapResource(
    resource: Record<string, unknown>,
    serverId: string,
    userId: string
  ): MappedEntity | null {
    const resourceType = resource.resourceType as string;
    if (!resourceType) {
      return null;
    }

    const rule = this.getMappingRuleByResourceType(resourceType);
    if (!rule || !rule.isActive) {
      return null;
    }

    const entityId = `entity-${randomUUID().slice(0, 8)}`;
    const data: Record<string, unknown> = {};
    const validationErrors: string[] = [];

    for (const mapping of rule.fieldMappings) {
      const value = getNestedValue(resource, mapping.sourcePath);
      
      if (value !== undefined && value !== null) {
        switch (mapping.dataType) {
          case "coding":
            const coding = extractCoding(resource, mapping.sourcePath, mapping.codingSystem);
            if (coding) {
              data[mapping.targetField] = coding;
            }
            break;
          case "reference":
            const ref = extractReference(resource, mapping.sourcePath);
            if (ref) {
              data[mapping.targetField] = ref.reference;
              data[`${mapping.targetField}Type`] = ref.type;
              data[`${mapping.targetField}Id`] = ref.id;
            } else {
              data[mapping.targetField] = value;
            }
            break;
          case "date":
          case "datetime":
            data[mapping.targetField] = value;
            break;
          default:
            data[mapping.targetField] = value;
        }
      } else if (mapping.defaultValue !== undefined) {
        data[mapping.targetField] = mapping.defaultValue;
      } else if (mapping.isRequired) {
        validationErrors.push(`Missing required field: ${mapping.targetField}`);
      }
    }

    for (const transform of rule.transformations) {
      const sourceValues = transform.sourceFields.map(f => getNestedValue(resource, f));
      
      switch (transform.type) {
        case "concat":
          const separator = transform.config.separator as string || " ";
          data[transform.targetField] = sourceValues.filter(v => v).join(separator);
          break;
        case "split":
          const splitChar = transform.config.splitChar as string || " ";
          const index = transform.config.index as number || 0;
          if (typeof sourceValues[0] === "string") {
            data[transform.targetField] = sourceValues[0].split(splitChar)[index];
          }
          break;
        case "extract_coding":
          const codingValue = extractCoding(resource, transform.sourceFields[0], transform.config.system as string);
          if (codingValue) {
            data[transform.targetField] = codingValue;
          }
          break;
        case "extract_reference":
          const refValue = extractReference(resource, transform.sourceFields[0]);
          if (refValue) {
            data[transform.targetField] = refValue;
          }
          break;
      }
    }

    for (const validation of rule.validationRules) {
      const value = data[validation.field];
      
      switch (validation.rule) {
        case "required":
          if (value === undefined || value === null || value === "") {
            validationErrors.push(validation.errorMessage);
          }
          break;
        case "regex":
          if (value && typeof value === "string") {
            const pattern = new RegExp(validation.config.pattern as string);
            if (!pattern.test(value)) {
              validationErrors.push(validation.errorMessage);
            }
          }
          break;
        case "range":
          if (typeof value === "number") {
            const min = validation.config.min as number;
            const max = validation.config.max as number;
            if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
              validationErrors.push(validation.errorMessage);
            }
          }
          break;
      }
    }

    const entity: MappedEntity = {
      id: entityId,
      userId,
      entityType: rule.targetEntityType,
      sourceResourceId: resource.id as string || "unknown",
      sourceResourceType: resourceType,
      sourceServerId: serverId,
      data,
      mappingRuleId: rule.id,
      validationErrors,
      importedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };

    this.mappedEntities.set(entityId, entity);

    logHipaaAudit("RESOURCE_MAPPED", {
      entityId,
      entityType: rule.targetEntityType,
      sourceResourceType: resourceType,
      sourceResourceId: resource.id,
      serverId,
      hasErrors: validationErrors.length > 0,
      userId,
    });

    return entity;
  }

  async importBundle(
    bundle: { entry?: Array<{ resource?: Record<string, unknown> }> },
    serverId: string,
    userId: string
  ): Promise<ImportResult> {
    const resultId = `import-${randomUUID().slice(0, 8)}`;
    const result: ImportResult = {
      id: resultId,
      userId,
      serverId,
      resourceType: "Bundle",
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      entities: [],
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: "",
    };

    if (!bundle.entry) {
      result.completedAt = new Date().toISOString();
      this.importResults.set(resultId, result);
      return result;
    }

    for (const entry of bundle.entry) {
      if (!entry.resource) {
        result.skipped++;
        continue;
      }

      result.totalProcessed++;
      const resourceType = entry.resource.resourceType as string;

      try {
        const entity = this.mapResource(entry.resource, serverId, userId);
        
        if (entity) {
          if (entity.validationErrors.length === 0) {
            result.successful++;
            result.entities.push(entity);
          } else {
            result.failed++;
            result.errors.push({
              resourceId: entry.resource.id as string || "unknown",
              error: entity.validationErrors.join("; "),
            });
          }
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          resourceId: entry.resource.id as string || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    result.completedAt = new Date().toISOString();
    this.importResults.set(resultId, result);

    logHipaaAudit("BUNDLE_IMPORT_COMPLETED", {
      resultId,
      serverId,
      totalProcessed: result.totalProcessed,
      successful: result.successful,
      failed: result.failed,
      skipped: result.skipped,
      userId,
    });

    return result;
  }

  getMappedEntities(filters?: {
    userId?: string;
    entityType?: string;
    serverId?: string;
    hasErrors?: boolean;
  }): MappedEntity[] {
    let entities = Array.from(this.mappedEntities.values());

    if (filters?.userId) {
      entities = entities.filter(e => e.userId === filters.userId);
    }
    if (filters?.entityType) {
      entities = entities.filter(e => e.entityType === filters.entityType);
    }
    if (filters?.serverId) {
      entities = entities.filter(e => e.sourceServerId === filters.serverId);
    }
    if (filters?.hasErrors !== undefined) {
      entities = entities.filter(e => 
        filters.hasErrors ? e.validationErrors.length > 0 : e.validationErrors.length === 0
      );
    }

    return entities;
  }

  getImportResults(userId: string): ImportResult[] {
    return Array.from(this.importResults.values()).filter(r => r.userId === userId);
  }

  getImportResult(id: string, userId: string): ImportResult | undefined {
    const result = this.importResults.get(id);
    if (!result || result.userId !== userId) return undefined;
    return result;
  }

  getSupportedResourceTypes(): string[] {
    return Array.from(this.mappingRules.values())
      .filter(r => r.isActive)
      .map(r => r.sourceResourceType);
  }
}

export const fhirResourceMapper = new FHIRResourceMapper();
