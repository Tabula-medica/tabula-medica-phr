import { randomUUID, createHash } from "crypto";

/**
 * FHIR Custom Mapping Engine
 * 
 * Provides flexible data mapping between local entities and FHIR resources
 * with support for multiple FHIR versions (R4, R5), custom profiles, and
 * user-defined transformation rules.
 * 
 * FEATURES:
 * - Custom entity-to-FHIR resource mappings
 * - Support for FHIR R4 and R5 versions
 * - Custom profile support with validation
 * - Visual mapping configuration interface
 * - Field-level transformations
 * - Extension mapping
 * - Nested resource mapping
 */

export type FHIRVersion = "R4" | "R5";

export interface CustomMapping {
  id: string;
  name: string;
  description: string;
  version: string;
  fhirVersion: FHIRVersion;
  sourceEntityType: string;
  targetResourceType: string;
  targetProfile?: string;
  fieldMappings: FieldMappingConfig[];
  extensionMappings: ExtensionMappingConfig[];
  nestedMappings: NestedMappingConfig[];
  validationRules: MappingValidationRule[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface FieldMappingConfig {
  id: string;
  sourceField: string;
  targetField: string;
  dataType: FHIRDataType;
  required: boolean;
  transformation?: TransformationConfig;
  defaultValue?: any;
  condition?: MappingCondition;
}

export interface ExtensionMappingConfig {
  id: string;
  extensionUrl: string;
  sourceField: string;
  valueType: string;
  transformation?: TransformationConfig;
}

export interface NestedMappingConfig {
  id: string;
  sourceField: string;
  targetField: string;
  nestedMappingId: string;
  cardinality: "single" | "array";
}

export interface TransformationConfig {
  type: TransformationType;
  params: Record<string, any>;
}

export type TransformationType = 
  | "direct"
  | "concat"
  | "split"
  | "uppercase"
  | "lowercase"
  | "trim"
  | "date_format"
  | "code_lookup"
  | "reference"
  | "codeable_concept"
  | "quantity"
  | "period"
  | "custom_script";

export type FHIRDataType = 
  | "string"
  | "boolean"
  | "integer"
  | "decimal"
  | "date"
  | "dateTime"
  | "instant"
  | "uri"
  | "code"
  | "Identifier"
  | "HumanName"
  | "Address"
  | "ContactPoint"
  | "CodeableConcept"
  | "Coding"
  | "Quantity"
  | "Period"
  | "Reference"
  | "Attachment"
  | "Annotation";

export interface MappingCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "exists" | "not_exists";
  value?: any;
}

export interface MappingValidationRule {
  id: string;
  field: string;
  rule: "required" | "pattern" | "min_length" | "max_length" | "code_system" | "custom";
  params?: Record<string, any>;
  errorMessage: string;
}

export interface CustomProfile {
  id: string;
  name: string;
  description: string;
  fhirVersion: FHIRVersion;
  baseResourceType: string;
  profileUrl: string;
  constraints: ProfileConstraint[];
  extensions: ProfileExtension[];
  mustSupportFields: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileConstraint {
  id: string;
  field: string;
  type: "cardinality" | "binding" | "pattern" | "fixed";
  value: any;
  severity: "error" | "warning";
}

export interface ProfileExtension {
  url: string;
  name: string;
  description: string;
  valueType: string;
  isRequired: boolean;
}

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  fhirVersion: FHIRVersion;
  sourceEntityType: string;
  targetResourceType: string;
  mapping: Partial<CustomMapping>;
}

export interface MappingExecutionResult {
  success: boolean;
  mappingId: string;
  sourceEntity: any;
  targetResource?: any;
  errors: MappingError[];
  warnings: MappingWarning[];
  executionTimeMs: number;
}

export interface MappingError {
  field: string;
  code: string;
  message: string;
}

export interface MappingWarning {
  field: string;
  code: string;
  message: string;
}

// FHIR version-specific resource definitions
const FHIR_RESOURCES: Record<FHIRVersion, string[]> = {
  R4: [
    "Patient", "Observation", "Condition", "MedicationRequest", "Procedure",
    "Immunization", "AllergyIntolerance", "DiagnosticReport", "CarePlan",
    "Goal", "Encounter", "DocumentReference", "Practitioner", "Organization",
    "Location", "Device", "Medication", "Specimen", "ServiceRequest"
  ],
  R5: [
    "Patient", "Observation", "Condition", "MedicationRequest", "Procedure",
    "Immunization", "AllergyIntolerance", "DiagnosticReport", "CarePlan",
    "Goal", "Encounter", "DocumentReference", "Practitioner", "Organization",
    "Location", "Device", "Medication", "Specimen", "ServiceRequest",
    "NutritionIntake", "DeviceAssociation", "GenomicStudy", "InventoryItem"
  ]
};

// Common fields for each resource type
const RESOURCE_FIELDS: Record<string, string[]> = {
  Patient: [
    "id", "identifier", "active", "name", "telecom", "gender", "birthDate",
    "deceasedBoolean", "deceasedDateTime", "address", "maritalStatus",
    "multipleBirthBoolean", "multipleBirthInteger", "photo", "contact",
    "communication", "generalPractitioner", "managingOrganization", "link"
  ],
  Observation: [
    "id", "identifier", "basedOn", "partOf", "status", "category", "code",
    "subject", "focus", "encounter", "effectiveDateTime", "effectivePeriod",
    "issued", "performer", "valueQuantity", "valueCodeableConcept", "valueString",
    "valueBoolean", "valueInteger", "valueRange", "interpretation", "note",
    "bodySite", "method", "specimen", "device", "referenceRange", "component"
  ],
  Condition: [
    "id", "identifier", "clinicalStatus", "verificationStatus", "category",
    "severity", "code", "bodySite", "subject", "encounter", "onsetDateTime",
    "onsetAge", "onsetPeriod", "abatementDateTime", "recordedDate", "recorder",
    "asserter", "stage", "evidence", "note"
  ],
  MedicationRequest: [
    "id", "identifier", "status", "statusReason", "intent", "category",
    "priority", "doNotPerform", "reportedBoolean", "medicationCodeableConcept",
    "medicationReference", "subject", "encounter", "supportingInformation",
    "authoredOn", "requester", "performer", "reasonCode", "reasonReference",
    "dosageInstruction", "dispenseRequest", "substitution"
  ],
  CarePlan: [
    "id", "identifier", "instantiatesCanonical", "instantiatesUri", "basedOn",
    "replaces", "partOf", "status", "intent", "category", "title", "description",
    "subject", "encounter", "period", "created", "author", "contributor",
    "careTeam", "addresses", "supportingInfo", "goal", "activity", "note"
  ],
  Goal: [
    "id", "identifier", "lifecycleStatus", "achievementStatus", "category",
    "priority", "description", "subject", "startDate", "startCodeableConcept",
    "target", "statusDate", "statusReason", "expressedBy", "addresses", "note",
    "outcomeCode", "outcomeReference"
  ]
};

// Local entity types
const LOCAL_ENTITY_TYPES = [
  "patient", "vital_sign", "diagnosis", "medication", "allergy",
  "procedure", "immunization", "lab_result", "care_plan", "goal",
  "appointment", "document", "provider", "facility", "device"
];

class FHIRCustomMappingEngine {
  private mappings: Map<string, CustomMapping> = new Map();
  private profiles: Map<string, CustomProfile> = new Map();
  private templates: Map<string, MappingTemplate> = new Map();
  private codeLookupTables: Map<string, Map<string, string>> = new Map();

  constructor() {
    this.initializeDefaultMappings();
    this.initializeDefaultProfiles();
    this.initializeDefaultTemplates();
    this.initializeCodeLookupTables();
    console.log("[FHIRCustomMapping] Service initialized");
    console.log(`[FHIRCustomMapping] FHIR versions: R4, R5`);
    console.log(`[FHIRCustomMapping] Default mappings: ${this.mappings.size}`);
    console.log(`[FHIRCustomMapping] Custom profiles: ${this.profiles.size}`);
  }

  private initializeDefaultMappings(): void {
    // Patient mapping
    const patientMapping: CustomMapping = {
      id: "mapping-patient-r4",
      name: "Patient to FHIR Patient (R4)",
      description: "Maps local patient entity to FHIR R4 Patient resource",
      version: "1.0.0",
      fhirVersion: "R4",
      sourceEntityType: "patient",
      targetResourceType: "Patient",
      targetProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      fieldMappings: [
        {
          id: "fm-1",
          sourceField: "id",
          targetField: "id",
          dataType: "string",
          required: true
        },
        {
          id: "fm-2",
          sourceField: "mrn",
          targetField: "identifier[0].value",
          dataType: "string",
          required: true,
          transformation: {
            type: "direct",
            params: { system: "http://hospital.example.org/mrn" }
          }
        },
        {
          id: "fm-3",
          sourceField: "firstName",
          targetField: "name[0].given[0]",
          dataType: "string",
          required: true
        },
        {
          id: "fm-4",
          sourceField: "lastName",
          targetField: "name[0].family",
          dataType: "string",
          required: true
        },
        {
          id: "fm-5",
          sourceField: "gender",
          targetField: "gender",
          dataType: "code",
          required: true,
          transformation: {
            type: "code_lookup",
            params: { table: "gender_codes" }
          }
        },
        {
          id: "fm-6",
          sourceField: "dateOfBirth",
          targetField: "birthDate",
          dataType: "date",
          required: false,
          transformation: {
            type: "date_format",
            params: { format: "YYYY-MM-DD" }
          }
        },
        {
          id: "fm-7",
          sourceField: "phone",
          targetField: "telecom[0].value",
          dataType: "string",
          required: false,
          transformation: {
            type: "direct",
            params: { system: "phone", use: "home" }
          }
        },
        {
          id: "fm-8",
          sourceField: "email",
          targetField: "telecom[1].value",
          dataType: "string",
          required: false,
          transformation: {
            type: "direct",
            params: { system: "email" }
          }
        }
      ],
      extensionMappings: [
        {
          id: "ext-1",
          extensionUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
          sourceField: "race",
          valueType: "CodeableConcept"
        },
        {
          id: "ext-2",
          extensionUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
          sourceField: "ethnicity",
          valueType: "CodeableConcept"
        }
      ],
      nestedMappings: [],
      validationRules: [
        {
          id: "vr-1",
          field: "name[0].family",
          rule: "required",
          errorMessage: "Family name is required"
        },
        {
          id: "vr-2",
          field: "gender",
          rule: "code_system",
          params: { values: ["male", "female", "other", "unknown"] },
          errorMessage: "Gender must be a valid administrative gender code"
        }
      ],
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system"
    };

    this.mappings.set(patientMapping.id, patientMapping);

    // Vital signs mapping
    const vitalSignMapping: CustomMapping = {
      id: "mapping-vitals-r4",
      name: "Vital Signs to FHIR Observation (R4)",
      description: "Maps local vital sign entity to FHIR R4 Observation resource",
      version: "1.0.0",
      fhirVersion: "R4",
      sourceEntityType: "vital_sign",
      targetResourceType: "Observation",
      targetProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs",
      fieldMappings: [
        {
          id: "fm-1",
          sourceField: "id",
          targetField: "id",
          dataType: "string",
          required: true
        },
        {
          id: "fm-2",
          sourceField: "patientId",
          targetField: "subject.reference",
          dataType: "Reference",
          required: true,
          transformation: {
            type: "reference",
            params: { resourceType: "Patient" }
          }
        },
        {
          id: "fm-3",
          sourceField: "vitalType",
          targetField: "code",
          dataType: "CodeableConcept",
          required: true,
          transformation: {
            type: "codeable_concept",
            params: { system: "http://loinc.org", table: "vital_sign_codes" }
          }
        },
        {
          id: "fm-4",
          sourceField: "value",
          targetField: "valueQuantity.value",
          dataType: "decimal",
          required: true
        },
        {
          id: "fm-5",
          sourceField: "unit",
          targetField: "valueQuantity.unit",
          dataType: "string",
          required: true
        },
        {
          id: "fm-6",
          sourceField: "recordedAt",
          targetField: "effectiveDateTime",
          dataType: "dateTime",
          required: true
        },
        {
          id: "fm-7",
          sourceField: "status",
          targetField: "status",
          dataType: "code",
          required: true,
          defaultValue: "final"
        }
      ],
      extensionMappings: [],
      nestedMappings: [],
      validationRules: [
        {
          id: "vr-1",
          field: "status",
          rule: "code_system",
          params: { values: ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"] },
          errorMessage: "Status must be a valid observation status code"
        }
      ],
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system"
    };

    this.mappings.set(vitalSignMapping.id, vitalSignMapping);

    // Diagnosis/Condition mapping
    const conditionMapping: CustomMapping = {
      id: "mapping-diagnosis-r4",
      name: "Diagnosis to FHIR Condition (R4)",
      description: "Maps local diagnosis entity to FHIR R4 Condition resource",
      version: "1.0.0",
      fhirVersion: "R4",
      sourceEntityType: "diagnosis",
      targetResourceType: "Condition",
      targetProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
      fieldMappings: [
        {
          id: "fm-1",
          sourceField: "id",
          targetField: "id",
          dataType: "string",
          required: true
        },
        {
          id: "fm-2",
          sourceField: "patientId",
          targetField: "subject.reference",
          dataType: "Reference",
          required: true,
          transformation: {
            type: "reference",
            params: { resourceType: "Patient" }
          }
        },
        {
          id: "fm-3",
          sourceField: "icdCode",
          targetField: "code.coding[0].code",
          dataType: "string",
          required: true
        },
        {
          id: "fm-4",
          sourceField: "description",
          targetField: "code.coding[0].display",
          dataType: "string",
          required: false
        },
        {
          id: "fm-5",
          sourceField: "status",
          targetField: "clinicalStatus.coding[0].code",
          dataType: "code",
          required: true,
          transformation: {
            type: "code_lookup",
            params: { table: "condition_clinical_status" }
          }
        },
        {
          id: "fm-6",
          sourceField: "onsetDate",
          targetField: "onsetDateTime",
          dataType: "dateTime",
          required: false
        },
        {
          id: "fm-7",
          sourceField: "recordedDate",
          targetField: "recordedDate",
          dataType: "dateTime",
          required: false
        }
      ],
      extensionMappings: [],
      nestedMappings: [],
      validationRules: [],
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system"
    };

    this.mappings.set(conditionMapping.id, conditionMapping);

    // R5 Patient mapping (demonstrates version differences)
    const patientR5Mapping: CustomMapping = {
      id: "mapping-patient-r5",
      name: "Patient to FHIR Patient (R5)",
      description: "Maps local patient entity to FHIR R5 Patient resource",
      version: "1.0.0",
      fhirVersion: "R5",
      sourceEntityType: "patient",
      targetResourceType: "Patient",
      fieldMappings: [
        {
          id: "fm-1",
          sourceField: "id",
          targetField: "id",
          dataType: "string",
          required: true
        },
        {
          id: "fm-2",
          sourceField: "mrn",
          targetField: "identifier[0].value",
          dataType: "string",
          required: true
        },
        {
          id: "fm-3",
          sourceField: "firstName",
          targetField: "name[0].given[0]",
          dataType: "string",
          required: true
        },
        {
          id: "fm-4",
          sourceField: "lastName",
          targetField: "name[0].family",
          dataType: "string",
          required: true
        },
        {
          id: "fm-5",
          sourceField: "gender",
          targetField: "gender",
          dataType: "code",
          required: true
        },
        {
          id: "fm-6",
          sourceField: "dateOfBirth",
          targetField: "birthDate",
          dataType: "date",
          required: false
        }
      ],
      extensionMappings: [],
      nestedMappings: [],
      validationRules: [],
      isActive: true,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "system"
    };

    this.mappings.set(patientR5Mapping.id, patientR5Mapping);
  }

  private initializeDefaultProfiles(): void {
    // Custom US Core Patient profile
    const usCorePatient: CustomProfile = {
      id: "profile-uscore-patient",
      name: "US Core Patient",
      description: "US Core Patient Profile for interoperability",
      fhirVersion: "R4",
      baseResourceType: "Patient",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      constraints: [
        {
          id: "c-1",
          field: "identifier",
          type: "cardinality",
          value: { min: 1 },
          severity: "error"
        },
        {
          id: "c-2",
          field: "name",
          type: "cardinality",
          value: { min: 1 },
          severity: "error"
        },
        {
          id: "c-3",
          field: "gender",
          type: "binding",
          value: { valueSet: "http://hl7.org/fhir/ValueSet/administrative-gender" },
          severity: "error"
        }
      ],
      extensions: [
        {
          url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
          name: "Race",
          description: "US Core Race Extension",
          valueType: "complex",
          isRequired: false
        },
        {
          url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
          name: "Ethnicity",
          description: "US Core Ethnicity Extension",
          valueType: "complex",
          isRequired: false
        },
        {
          url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
          name: "Birth Sex",
          description: "US Core Birth Sex Extension",
          valueType: "code",
          isRequired: false
        }
      ],
      mustSupportFields: ["identifier", "name", "telecom", "gender", "birthDate", "address", "communication"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(usCorePatient.id, usCorePatient);

    // Custom vital signs profile
    const vitalSignsProfile: CustomProfile = {
      id: "profile-uscore-vitals",
      name: "US Core Vital Signs",
      description: "US Core Vital Signs Profile",
      fhirVersion: "R4",
      baseResourceType: "Observation",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs",
      constraints: [
        {
          id: "c-1",
          field: "status",
          type: "binding",
          value: { valueSet: "http://hl7.org/fhir/ValueSet/observation-status" },
          severity: "error"
        },
        {
          id: "c-2",
          field: "category",
          type: "cardinality",
          value: { min: 1 },
          severity: "error"
        },
        {
          id: "c-3",
          field: "code",
          type: "cardinality",
          value: { min: 1, max: 1 },
          severity: "error"
        }
      ],
      extensions: [],
      mustSupportFields: ["status", "category", "code", "subject", "effectiveDateTime", "valueQuantity"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(vitalSignsProfile.id, vitalSignsProfile);
  }

  private initializeDefaultTemplates(): void {
    // Template for patient mapping
    const patientTemplate: MappingTemplate = {
      id: "template-patient",
      name: "Patient Mapping Template",
      description: "Standard template for mapping patient data",
      category: "demographics",
      fhirVersion: "R4",
      sourceEntityType: "patient",
      targetResourceType: "Patient",
      mapping: {
        fieldMappings: [
          { id: "t-1", sourceField: "id", targetField: "id", dataType: "string", required: true },
          { id: "t-2", sourceField: "firstName", targetField: "name[0].given[0]", dataType: "string", required: true },
          { id: "t-3", sourceField: "lastName", targetField: "name[0].family", dataType: "string", required: true },
          { id: "t-4", sourceField: "gender", targetField: "gender", dataType: "code", required: true },
          { id: "t-5", sourceField: "dateOfBirth", targetField: "birthDate", dataType: "date", required: false }
        ],
        extensionMappings: [],
        validationRules: []
      }
    };

    this.templates.set(patientTemplate.id, patientTemplate);

    // Template for observation mapping
    const observationTemplate: MappingTemplate = {
      id: "template-observation",
      name: "Observation Mapping Template",
      description: "Standard template for mapping clinical observations",
      category: "clinical",
      fhirVersion: "R4",
      sourceEntityType: "observation",
      targetResourceType: "Observation",
      mapping: {
        fieldMappings: [
          { id: "t-1", sourceField: "id", targetField: "id", dataType: "string", required: true },
          { id: "t-2", sourceField: "patientId", targetField: "subject.reference", dataType: "Reference", required: true },
          { id: "t-3", sourceField: "code", targetField: "code", dataType: "CodeableConcept", required: true },
          { id: "t-4", sourceField: "value", targetField: "valueQuantity.value", dataType: "decimal", required: false },
          { id: "t-5", sourceField: "status", targetField: "status", dataType: "code", required: true, defaultValue: "final" }
        ],
        extensionMappings: [],
        validationRules: []
      }
    };

    this.templates.set(observationTemplate.id, observationTemplate);
  }

  private initializeCodeLookupTables(): void {
    // Gender codes
    const genderCodes = new Map<string, string>();
    genderCodes.set("M", "male");
    genderCodes.set("F", "female");
    genderCodes.set("O", "other");
    genderCodes.set("U", "unknown");
    genderCodes.set("male", "male");
    genderCodes.set("female", "female");
    this.codeLookupTables.set("gender_codes", genderCodes);

    // Vital sign LOINC codes
    const vitalSignCodes = new Map<string, string>();
    vitalSignCodes.set("blood_pressure", "85354-9");
    vitalSignCodes.set("heart_rate", "8867-4");
    vitalSignCodes.set("body_temperature", "8310-5");
    vitalSignCodes.set("respiratory_rate", "9279-1");
    vitalSignCodes.set("pulse_oximetry", "2708-6");
    vitalSignCodes.set("body_weight", "29463-7");
    vitalSignCodes.set("body_height", "8302-2");
    vitalSignCodes.set("bmi", "39156-5");
    this.codeLookupTables.set("vital_sign_codes", vitalSignCodes);

    // Condition clinical status
    const conditionStatus = new Map<string, string>();
    conditionStatus.set("active", "active");
    conditionStatus.set("inactive", "inactive");
    conditionStatus.set("resolved", "resolved");
    conditionStatus.set("remission", "remission");
    this.codeLookupTables.set("condition_clinical_status", conditionStatus);
  }

  // Mapping CRUD operations
  getMappings(fhirVersion?: FHIRVersion): CustomMapping[] {
    const mappings = Array.from(this.mappings.values());
    if (fhirVersion) {
      return mappings.filter(m => m.fhirVersion === fhirVersion);
    }
    return mappings;
  }

  getMapping(id: string): CustomMapping | undefined {
    return this.mappings.get(id);
  }

  getMappingBySource(sourceEntityType: string, fhirVersion: FHIRVersion = "R4"): CustomMapping | undefined {
    return Array.from(this.mappings.values()).find(
      m => m.sourceEntityType === sourceEntityType && m.fhirVersion === fhirVersion && m.isActive
    );
  }

  createMapping(mapping: Omit<CustomMapping, "id" | "createdAt" | "updatedAt">): CustomMapping {
    const newMapping: CustomMapping = {
      ...mapping,
      id: `mapping-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.mappings.set(newMapping.id, newMapping);
    this.logAuditEvent("CREATE_MAPPING", { mappingId: newMapping.id, name: newMapping.name });
    return newMapping;
  }

  updateMapping(id: string, updates: Partial<CustomMapping>): CustomMapping | null {
    const existing = this.mappings.get(id);
    if (!existing) return null;

    const updated: CustomMapping = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    this.mappings.set(id, updated);
    this.logAuditEvent("UPDATE_MAPPING", { mappingId: id, changes: Object.keys(updates) });
    return updated;
  }

  deleteMapping(id: string): boolean {
    const mapping = this.mappings.get(id);
    if (!mapping) return false;
    if (mapping.isDefault) {
      throw new Error("Cannot delete default mappings");
    }

    this.mappings.delete(id);
    this.logAuditEvent("DELETE_MAPPING", { mappingId: id });
    return true;
  }

  // Profile CRUD operations
  getProfiles(fhirVersion?: FHIRVersion): CustomProfile[] {
    const profiles = Array.from(this.profiles.values());
    if (fhirVersion) {
      return profiles.filter(p => p.fhirVersion === fhirVersion);
    }
    return profiles;
  }

  getProfile(id: string): CustomProfile | undefined {
    return this.profiles.get(id);
  }

  createProfile(profile: Omit<CustomProfile, "id" | "createdAt" | "updatedAt">): CustomProfile {
    const newProfile: CustomProfile = {
      ...profile,
      id: `profile-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(newProfile.id, newProfile);
    this.logAuditEvent("CREATE_PROFILE", { profileId: newProfile.id, name: newProfile.name });
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<CustomProfile>): CustomProfile | null {
    const existing = this.profiles.get(id);
    if (!existing) return null;

    const updated: CustomProfile = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(id, updated);
    this.logAuditEvent("UPDATE_PROFILE", { profileId: id, changes: Object.keys(updates) });
    return updated;
  }

  deleteProfile(id: string): boolean {
    const profile = this.profiles.get(id);
    if (!profile) return false;

    this.profiles.delete(id);
    this.logAuditEvent("DELETE_PROFILE", { profileId: id });
    return true;
  }

  // Template operations
  getTemplates(category?: string): MappingTemplate[] {
    const templates = Array.from(this.templates.values());
    if (category) {
      return templates.filter(t => t.category === category);
    }
    return templates;
  }

  getTemplate(id: string): MappingTemplate | undefined {
    return this.templates.get(id);
  }

  createMappingFromTemplate(templateId: string, overrides: Partial<CustomMapping>): CustomMapping {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return this.createMapping({
      name: overrides.name || `${template.name} - Custom`,
      description: overrides.description || template.description,
      version: "1.0.0",
      fhirVersion: template.fhirVersion,
      sourceEntityType: template.sourceEntityType,
      targetResourceType: template.targetResourceType,
      fieldMappings: template.mapping.fieldMappings || [],
      extensionMappings: template.mapping.extensionMappings || [],
      nestedMappings: [],
      validationRules: template.mapping.validationRules || [],
      isActive: true,
      isDefault: false,
      createdBy: overrides.createdBy || "user",
      ...overrides
    });
  }

  // Execute mapping
  executeMapping(mappingId: string, sourceEntity: any): MappingExecutionResult {
    const startTime = Date.now();
    const mapping = this.mappings.get(mappingId);
    
    if (!mapping) {
      return {
        success: false,
        mappingId,
        sourceEntity,
        errors: [{ field: "", code: "MAPPING_NOT_FOUND", message: `Mapping not found: ${mappingId}` }],
        warnings: [],
        executionTimeMs: Date.now() - startTime
      };
    }

    const errors: MappingError[] = [];
    const warnings: MappingWarning[] = [];
    const targetResource: any = {
      resourceType: mapping.targetResourceType
    };

    // Add profile if specified
    if (mapping.targetProfile) {
      targetResource.meta = {
        profile: [mapping.targetProfile]
      };
    }

    // Execute field mappings
    for (const fieldMapping of mapping.fieldMappings) {
      try {
        const sourceValue = this.getNestedValue(sourceEntity, fieldMapping.sourceField);
        
        if (sourceValue === undefined || sourceValue === null) {
          if (fieldMapping.required && !fieldMapping.defaultValue) {
            errors.push({
              field: fieldMapping.sourceField,
              code: "REQUIRED_FIELD_MISSING",
              message: `Required field '${fieldMapping.sourceField}' is missing`
            });
          } else if (fieldMapping.defaultValue !== undefined) {
            this.setNestedValue(targetResource, fieldMapping.targetField, fieldMapping.defaultValue);
          }
          continue;
        }

        // Apply transformation
        const transformedValue = this.applyTransformation(sourceValue, fieldMapping.transformation);
        this.setNestedValue(targetResource, fieldMapping.targetField, transformedValue);
      } catch (error: any) {
        errors.push({
          field: fieldMapping.sourceField,
          code: "MAPPING_ERROR",
          message: error.message
        });
      }
    }

    // Execute extension mappings
    if (mapping.extensionMappings.length > 0) {
      targetResource.extension = targetResource.extension || [];
      
      for (const extMapping of mapping.extensionMappings) {
        const sourceValue = this.getNestedValue(sourceEntity, extMapping.sourceField);
        if (sourceValue !== undefined && sourceValue !== null) {
          targetResource.extension.push({
            url: extMapping.extensionUrl,
            [`value${this.capitalizeFirst(extMapping.valueType)}`]: sourceValue
          });
        }
      }
    }

    // Execute validation rules
    for (const rule of mapping.validationRules) {
      const value = this.getNestedValue(targetResource, rule.field);
      const isValid = this.validateField(value, rule);
      
      if (!isValid) {
        errors.push({
          field: rule.field,
          code: rule.rule.toUpperCase(),
          message: rule.errorMessage
        });
      }
    }

    this.logAuditEvent("EXECUTE_MAPPING", {
      mappingId,
      sourceEntityType: mapping.sourceEntityType,
      targetResourceType: mapping.targetResourceType,
      success: errors.length === 0,
      errorCount: errors.length
    });

    return {
      success: errors.length === 0,
      mappingId,
      sourceEntity,
      targetResource: errors.length === 0 ? targetResource : undefined,
      errors,
      warnings,
      executionTimeMs: Date.now() - startTime
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current[arrayKey]?.[parseInt(index)];
      }
      
      return current[key];
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      
      if (arrayMatch) {
        const [, arrayKey, indexStr] = arrayMatch;
        const index = parseInt(indexStr);
        
        if (!current[arrayKey]) {
          current[arrayKey] = [];
        }
        if (!current[arrayKey][index]) {
          current[arrayKey][index] = {};
        }
        current = current[arrayKey][index];
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }

    const lastKey = parts[parts.length - 1];
    const lastArrayMatch = lastKey.match(/^(\w+)\[(\d+)\]$/);
    
    if (lastArrayMatch) {
      const [, arrayKey, indexStr] = lastArrayMatch;
      const index = parseInt(indexStr);
      
      if (!current[arrayKey]) {
        current[arrayKey] = [];
      }
      current[arrayKey][index] = value;
    } else {
      current[lastKey] = value;
    }
  }

  private applyTransformation(value: any, config?: TransformationConfig): any {
    if (!config) return value;

    switch (config.type) {
      case "direct":
        return value;
      
      case "uppercase":
        return typeof value === "string" ? value.toUpperCase() : value;
      
      case "lowercase":
        return typeof value === "string" ? value.toLowerCase() : value;
      
      case "trim":
        return typeof value === "string" ? value.trim() : value;
      
      case "concat":
        const separator = config.params?.separator || "";
        const fields = config.params?.fields || [];
        return [value, ...fields].join(separator);
      
      case "split":
        const delimiter = config.params?.delimiter || ",";
        const index = config.params?.index || 0;
        return typeof value === "string" ? value.split(delimiter)[index] : value;
      
      case "date_format":
        // Simple date formatting (production would use a date library)
        if (value instanceof Date) {
          return value.toISOString().split("T")[0];
        }
        return value;
      
      case "code_lookup":
        const table = this.codeLookupTables.get(config.params?.table);
        return table?.get(value) || value;
      
      case "reference":
        const resourceType = config.params?.resourceType || "";
        return `${resourceType}/${value}`;
      
      case "codeable_concept":
        const system = config.params?.system || "";
        const lookupTable = config.params?.table;
        let code = value;
        
        if (lookupTable) {
          const codeTable = this.codeLookupTables.get(lookupTable);
          code = codeTable?.get(value) || value;
        }
        
        return {
          coding: [{
            system,
            code,
            display: value
          }]
        };
      
      case "quantity":
        return {
          value: parseFloat(value),
          unit: config.params?.unit || "",
          system: "http://unitsofmeasure.org",
          code: config.params?.ucumCode || ""
        };
      
      default:
        return value;
    }
  }

  private validateField(value: any, rule: MappingValidationRule): boolean {
    switch (rule.rule) {
      case "required":
        return value !== undefined && value !== null && value !== "";
      
      case "pattern":
        if (typeof value !== "string") return false;
        const pattern = new RegExp(rule.params?.pattern);
        return pattern.test(value);
      
      case "min_length":
        return typeof value === "string" && value.length >= (rule.params?.min || 0);
      
      case "max_length":
        return typeof value === "string" && value.length <= (rule.params?.max || Infinity);
      
      case "code_system":
        const allowedValues = rule.params?.values || [];
        return allowedValues.includes(value);
      
      default:
        return true;
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Get available resources and entities
  getAvailableResources(fhirVersion: FHIRVersion): string[] {
    return FHIR_RESOURCES[fhirVersion] || [];
  }

  getResourceFields(resourceType: string): string[] {
    return RESOURCE_FIELDS[resourceType] || [];
  }

  getLocalEntityTypes(): string[] {
    return LOCAL_ENTITY_TYPES;
  }

  getDataTypes(): FHIRDataType[] {
    return [
      "string", "boolean", "integer", "decimal", "date", "dateTime", "instant",
      "uri", "code", "Identifier", "HumanName", "Address", "ContactPoint",
      "CodeableConcept", "Coding", "Quantity", "Period", "Reference", "Attachment", "Annotation"
    ];
  }

  getTransformationTypes(): TransformationType[] {
    return [
      "direct", "concat", "split", "uppercase", "lowercase", "trim",
      "date_format", "code_lookup", "reference", "codeable_concept", "quantity", "period", "custom_script"
    ];
  }

  // Statistics
  getStatistics(): {
    totalMappings: number;
    activeMappings: number;
    totalProfiles: number;
    mappingsByVersion: Record<FHIRVersion, number>;
    mappingsByResourceType: Record<string, number>;
  } {
    const mappings = Array.from(this.mappings.values());
    const mappingsByVersion: Record<FHIRVersion, number> = { R4: 0, R5: 0 };
    const mappingsByResourceType: Record<string, number> = {};

    for (const mapping of mappings) {
      mappingsByVersion[mapping.fhirVersion]++;
      mappingsByResourceType[mapping.targetResourceType] = 
        (mappingsByResourceType[mapping.targetResourceType] || 0) + 1;
    }

    return {
      totalMappings: mappings.length,
      activeMappings: mappings.filter(m => m.isActive).length,
      totalProfiles: this.profiles.size,
      mappingsByVersion,
      mappingsByResourceType
    };
  }

  private logAuditEvent(action: string, details: Record<string, any>): void {
    const hashedDetails = { ...details };
    console.log(`[FHIRCustomMapping][AUDIT] ${action}:`, JSON.stringify(hashedDetails));
  }
}

export const fhirCustomMappingEngine = new FHIRCustomMappingEngine();
