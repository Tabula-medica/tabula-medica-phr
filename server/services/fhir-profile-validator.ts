import { randomUUID } from "crypto";

export type ValidationSeverity = "error" | "warning" | "information";
export type ProfileType = "standard" | "custom" | "extension";

export interface FHIRProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  type: ProfileType;
  baseDefinition: string;
  resourceType: string;
  description: string;
  constraints: ProfileConstraint[];
  extensions: ProfileExtension[];
  slices: ProfileSlice[];
  required: string[];
  mustSupport: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileConstraint {
  id: string;
  path: string;
  severity: ValidationSeverity;
  expression?: string;
  human: string;
  source?: string;
}

export interface ProfileExtension {
  id: string;
  url: string;
  path: string;
  min: number;
  max: string;
  type: string;
}

export interface ProfileSlice {
  id: string;
  path: string;
  discriminator: { type: string; path: string }[];
  rules: "open" | "closed" | "openAtEnd";
  slices: Array<{ name: string; min: number; max: string; conditions: Record<string, unknown> }>;
}

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  path: string;
  message: string;
  constraint?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  suggestion?: ValidationSuggestion;
}

export interface ValidationSuggestion {
  type: "add_field" | "remove_field" | "modify_value" | "add_extension" | "change_type" | "fix_cardinality";
  description: string;
  suggestedValue?: unknown;
  profileAdjustment?: string;
}

export interface ValidationResult {
  id: string;
  resourceType: string;
  resourceId: string;
  profileId: string;
  profileName: string;
  valid: boolean;
  issues: ValidationIssue[];
  complianceScore: number;
  validatedAt: string;
  processingTimeMs: number;
}

export interface ValidationBatchJob {
  id: string;
  profileId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  totalResources: number;
  processedResources: number;
  validCount: number;
  invalidCount: number;
  startedAt?: string;
  completedAt?: string;
  results: ValidationResult[];
}

const STANDARD_PROFILES: FHIRProfile[] = [
  {
    id: "profile-us-core-patient",
    name: "US Core Patient Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
    resourceType: "Patient",
    description: "US Core Patient Profile based on USCDI requirements",
    constraints: [
      { id: "us-core-1", path: "Patient.name", severity: "error", human: "Patient must have at least one name", expression: "name.count() >= 1" },
      { id: "us-core-2", path: "Patient.identifier", severity: "error", human: "Patient must have at least one identifier", expression: "identifier.count() >= 1" },
      { id: "us-core-3", path: "Patient.gender", severity: "error", human: "Patient must have gender", expression: "gender.exists()" },
    ],
    extensions: [
      { id: "ext-race", url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", path: "Patient.extension", min: 0, max: "1", type: "Extension" },
      { id: "ext-ethnicity", url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", path: "Patient.extension", min: 0, max: "1", type: "Extension" },
      { id: "ext-birthsex", url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", path: "Patient.extension", min: 0, max: "1", type: "Extension" },
    ],
    slices: [],
    required: ["identifier", "name", "gender"],
    mustSupport: ["identifier", "name", "telecom", "gender", "birthDate", "address", "communication"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-observation",
    name: "US Core Observation Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Observation",
    resourceType: "Observation",
    description: "US Core Observation Profile for clinical observations",
    constraints: [
      { id: "us-core-obs-1", path: "Observation.status", severity: "error", human: "Observation must have status", expression: "status.exists()" },
      { id: "us-core-obs-2", path: "Observation.code", severity: "error", human: "Observation must have code", expression: "code.exists()" },
      { id: "us-core-obs-3", path: "Observation.subject", severity: "error", human: "Observation must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "code", "subject"],
    mustSupport: ["status", "category", "code", "subject", "effectiveDateTime", "value[x]"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-condition",
    name: "US Core Condition Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Condition",
    resourceType: "Condition",
    description: "US Core Condition Profile for patient conditions/diagnoses",
    constraints: [
      { id: "us-core-cond-1", path: "Condition.clinicalStatus", severity: "warning", human: "Condition should have clinical status", expression: "clinicalStatus.exists()" },
      { id: "us-core-cond-2", path: "Condition.code", severity: "error", human: "Condition must have code", expression: "code.exists()" },
      { id: "us-core-cond-3", path: "Condition.subject", severity: "error", human: "Condition must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["code", "subject"],
    mustSupport: ["clinicalStatus", "verificationStatus", "category", "code", "subject"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-medication",
    name: "US Core MedicationRequest Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/MedicationRequest",
    resourceType: "MedicationRequest",
    description: "US Core MedicationRequest Profile for medication orders",
    constraints: [
      { id: "us-core-med-1", path: "MedicationRequest.status", severity: "error", human: "MedicationRequest must have status", expression: "status.exists()" },
      { id: "us-core-med-2", path: "MedicationRequest.intent", severity: "error", human: "MedicationRequest must have intent", expression: "intent.exists()" },
      { id: "us-core-med-3", path: "MedicationRequest.subject", severity: "error", human: "MedicationRequest must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "intent", "medication[x]", "subject"],
    mustSupport: ["status", "intent", "medication[x]", "subject", "authoredOn", "requester", "dosageInstruction"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-encounter",
    name: "US Core Encounter Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Encounter",
    resourceType: "Encounter",
    description: "US Core Encounter Profile for patient visits",
    constraints: [
      { id: "us-core-enc-1", path: "Encounter.status", severity: "error", human: "Encounter must have status", expression: "status.exists()" },
      { id: "us-core-enc-2", path: "Encounter.class", severity: "error", human: "Encounter must have class", expression: "class.exists()" },
      { id: "us-core-enc-3", path: "Encounter.subject", severity: "error", human: "Encounter must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "class", "type", "subject"],
    mustSupport: ["identifier", "status", "class", "type", "subject", "participant", "period", "location"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-allergy",
    name: "US Core AllergyIntolerance Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/AllergyIntolerance",
    resourceType: "AllergyIntolerance",
    description: "US Core AllergyIntolerance Profile for patient allergies and intolerances per USCDI",
    constraints: [
      { id: "us-core-allergy-1", path: "AllergyIntolerance.clinicalStatus", severity: "warning", human: "AllergyIntolerance should have clinical status if active", expression: "clinicalStatus.exists() or verificationStatus.coding.where(code='entered-in-error').exists()" },
      { id: "us-core-allergy-2", path: "AllergyIntolerance.code", severity: "error", human: "AllergyIntolerance must have code", expression: "code.exists()" },
      { id: "us-core-allergy-3", path: "AllergyIntolerance.patient", severity: "error", human: "AllergyIntolerance must reference a patient", expression: "patient.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["code", "patient"],
    mustSupport: ["clinicalStatus", "verificationStatus", "code", "patient", "reaction", "reaction.manifestation"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-procedure",
    name: "US Core Procedure Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Procedure",
    resourceType: "Procedure",
    description: "US Core Procedure Profile for medical procedures per USCDI",
    constraints: [
      { id: "us-core-proc-1", path: "Procedure.status", severity: "error", human: "Procedure must have status", expression: "status.exists()" },
      { id: "us-core-proc-2", path: "Procedure.code", severity: "error", human: "Procedure must have code", expression: "code.exists()" },
      { id: "us-core-proc-3", path: "Procedure.subject", severity: "error", human: "Procedure must reference a patient", expression: "subject.exists()" },
      { id: "us-core-proc-4", path: "Procedure.performed[x]", severity: "error", human: "Procedure must have performed date", expression: "performed.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "code", "subject", "performed[x]"],
    mustSupport: ["status", "code", "subject", "performedDateTime", "performedPeriod"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-immunization",
    name: "US Core Immunization Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Immunization",
    resourceType: "Immunization",
    description: "US Core Immunization Profile for vaccination records per USCDI",
    constraints: [
      { id: "us-core-imm-1", path: "Immunization.status", severity: "error", human: "Immunization must have status", expression: "status.exists()" },
      { id: "us-core-imm-2", path: "Immunization.vaccineCode", severity: "error", human: "Immunization must have vaccine code", expression: "vaccineCode.exists()" },
      { id: "us-core-imm-3", path: "Immunization.patient", severity: "error", human: "Immunization must reference a patient", expression: "patient.exists()" },
      { id: "us-core-imm-4", path: "Immunization.occurrence[x]", severity: "error", human: "Immunization must have occurrence date", expression: "occurrence.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "vaccineCode", "patient", "occurrence[x]", "primarySource"],
    mustSupport: ["status", "statusReason", "vaccineCode", "patient", "occurrenceDateTime", "occurrenceString", "primarySource"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-diagnostic-report",
    name: "US Core DiagnosticReport Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/DiagnosticReport",
    resourceType: "DiagnosticReport",
    description: "US Core DiagnosticReport Profile for laboratory results per USCDI",
    constraints: [
      { id: "us-core-dr-1", path: "DiagnosticReport.status", severity: "error", human: "DiagnosticReport must have status", expression: "status.exists()" },
      { id: "us-core-dr-2", path: "DiagnosticReport.category", severity: "error", human: "DiagnosticReport must have category", expression: "category.exists()" },
      { id: "us-core-dr-3", path: "DiagnosticReport.code", severity: "error", human: "DiagnosticReport must have code", expression: "code.exists()" },
      { id: "us-core-dr-4", path: "DiagnosticReport.subject", severity: "error", human: "DiagnosticReport must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [
      { id: "slice-category", path: "DiagnosticReport.category", discriminator: [{ type: "pattern", path: "coding.code" }], rules: "open", slices: [{ name: "LAB", min: 1, max: "1", conditions: { "coding.code": "LAB" } }] }
    ],
    required: ["status", "category", "code", "subject"],
    mustSupport: ["status", "category", "code", "subject", "effectiveDateTime", "effectivePeriod", "issued", "result"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-careplan",
    name: "US Core CarePlan Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/CarePlan",
    resourceType: "CarePlan",
    description: "US Core CarePlan Profile for patient treatment plans per USCDI",
    constraints: [
      { id: "us-core-cp-1", path: "CarePlan.status", severity: "error", human: "CarePlan must have status", expression: "status.exists()" },
      { id: "us-core-cp-2", path: "CarePlan.intent", severity: "error", human: "CarePlan must have intent", expression: "intent.exists()" },
      { id: "us-core-cp-3", path: "CarePlan.subject", severity: "error", human: "CarePlan must reference a patient", expression: "subject.exists()" },
      { id: "us-core-cp-4", path: "CarePlan.category", severity: "error", human: "CarePlan must have category with assess-plan", expression: "category.coding.where(code='assess-plan').exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["status", "intent", "category", "subject"],
    mustSupport: ["status", "intent", "category", "subject", "activity"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "profile-us-core-goal",
    name: "US Core Goal Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
    version: "6.0.0",
    type: "standard",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Goal",
    resourceType: "Goal",
    description: "US Core Goal Profile for patient health goals per USCDI",
    constraints: [
      { id: "us-core-goal-1", path: "Goal.lifecycleStatus", severity: "error", human: "Goal must have lifecycle status", expression: "lifecycleStatus.exists()" },
      { id: "us-core-goal-2", path: "Goal.description", severity: "error", human: "Goal must have description", expression: "description.exists()" },
      { id: "us-core-goal-3", path: "Goal.subject", severity: "error", human: "Goal must reference a patient", expression: "subject.exists()" },
    ],
    extensions: [],
    slices: [],
    required: ["lifecycleStatus", "description", "subject"],
    mustSupport: ["lifecycleStatus", "description", "subject", "target", "target.dueDate"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class FhirProfileValidator {
  private profiles: Map<string, FHIRProfile> = new Map();
  private jobs: Map<string, ValidationBatchJob> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();

  constructor() {
    STANDARD_PROFILES.forEach(p => this.profiles.set(p.id, p));
    console.log("[ProfileValidator] Initialized with", this.profiles.size, "standard profiles");
  }

  async validateResource(
    resource: Record<string, unknown>,
    profileId: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const profile = this.profiles.get(profileId);
    
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    if (resource.resourceType !== profile.resourceType) {
      throw new Error(`Resource type mismatch: expected ${profile.resourceType}, got ${resource.resourceType}`);
    }

    const issues: ValidationIssue[] = [];

    this.validateRequiredFields(resource, profile, issues);
    this.validateMustSupportFields(resource, profile, issues);
    this.validateConstraints(resource, profile, issues);
    this.validateDataTypes(resource, profile, issues);
    this.validateCardinality(resource, profile, issues);
    this.validateExtensions(resource, profile, issues);

    const valid = !issues.some(i => i.severity === "error");
    const complianceScore = this.calculateComplianceScore(issues, profile);

    const result: ValidationResult = {
      id: randomUUID(),
      resourceType: resource.resourceType as string,
      resourceId: resource.id as string || "unknown",
      profileId: profile.id,
      profileName: profile.name,
      valid,
      issues,
      complianceScore,
      validatedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };

    const cacheKey = `${resource.resourceType}/${resource.id}/${profileId}`;
    this.validationCache.set(cacheKey, result);

    console.log(`[ProfileValidator] Validated ${resource.resourceType}/${resource.id}: ${valid ? "VALID" : "INVALID"} (${issues.length} issues)`);

    return result;
  }

  private validateRequiredFields(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    for (const field of profile.required) {
      const value = this.getFieldValue(resource, field);
      
      if (value === undefined || value === null) {
        issues.push({
          id: randomUUID(),
          severity: "error",
          path: `${profile.resourceType}.${field}`,
          message: `Required field '${field}' is missing`,
          constraint: `required:${field}`,
          suggestion: {
            type: "add_field",
            description: `Add the required '${field}' field to the resource`,
            suggestedValue: this.suggestDefaultValue(field, profile.resourceType),
          },
        });
      } else if (Array.isArray(value) && value.length === 0) {
        issues.push({
          id: randomUUID(),
          severity: "error",
          path: `${profile.resourceType}.${field}`,
          message: `Required field '${field}' is empty`,
          constraint: `required:${field}`,
          actualValue: value,
          suggestion: {
            type: "add_field",
            description: `Add at least one item to the '${field}' array`,
          },
        });
      }
    }
  }

  private validateMustSupportFields(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    for (const field of profile.mustSupport) {
      const fieldBase = field.replace(/\[x\]$/, "");
      const value = this.getFieldValue(resource, fieldBase);
      
      if (value === undefined && !profile.required.includes(field)) {
        issues.push({
          id: randomUUID(),
          severity: "information",
          path: `${profile.resourceType}.${field}`,
          message: `Must-support field '${field}' is not present`,
          constraint: `mustSupport:${field}`,
          suggestion: {
            type: "add_field",
            description: `Consider adding '${field}' for better interoperability`,
            profileAdjustment: `If not applicable, document why this field is not populated`,
          },
        });
      }
    }
  }

  private validateConstraints(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    for (const constraint of profile.constraints) {
      const pathParts = constraint.path.split(".");
      const fieldPath = pathParts.slice(1).join(".");
      
      if (!constraint.expression) continue;

      const isValid = this.evaluateConstraint(resource, constraint.expression, fieldPath);
      
      if (!isValid) {
        issues.push({
          id: randomUUID(),
          severity: constraint.severity,
          path: constraint.path,
          message: constraint.human,
          constraint: constraint.id,
          suggestion: this.generateConstraintSuggestion(constraint, resource, fieldPath),
        });
      }
    }
  }

  private validateDataTypes(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    const typeChecks: Array<{ field: string; expectedType: string; validator: (v: unknown) => boolean }> = [
      { field: "birthDate", expectedType: "date", validator: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) },
      { field: "gender", expectedType: "code", validator: (v) => typeof v === "string" && ["male", "female", "other", "unknown"].includes(v) },
      { field: "active", expectedType: "boolean", validator: (v) => typeof v === "boolean" },
      { field: "deceasedBoolean", expectedType: "boolean", validator: (v) => typeof v === "boolean" },
      { field: "deceasedDateTime", expectedType: "dateTime", validator: (v) => typeof v === "string" && !isNaN(Date.parse(v)) },
      { field: "multipleBirthInteger", expectedType: "integer", validator: (v) => typeof v === "number" && Number.isInteger(v) },
    ];

    for (const check of typeChecks) {
      const value = this.getFieldValue(resource, check.field);
      if (value !== undefined && !check.validator(value)) {
        issues.push({
          id: randomUUID(),
          severity: "error",
          path: `${profile.resourceType}.${check.field}`,
          message: `Invalid data type for '${check.field}': expected ${check.expectedType}`,
          actualValue: value,
          expectedValue: check.expectedType,
          suggestion: {
            type: "modify_value",
            description: `Convert '${check.field}' to valid ${check.expectedType} format`,
          },
        });
      }
    }
  }

  private validateCardinality(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    const cardinalityRules: Array<{ field: string; min: number; max: string }> = [
      { field: "identifier", min: 1, max: "*" },
      { field: "name", min: 1, max: "*" },
      { field: "telecom", min: 0, max: "*" },
      { field: "address", min: 0, max: "*" },
    ];

    for (const rule of cardinalityRules) {
      if (!profile.required.includes(rule.field) && rule.min === 0) continue;

      const value = this.getFieldValue(resource, rule.field);
      
      if (Array.isArray(value)) {
        if (value.length < rule.min) {
          issues.push({
            id: randomUUID(),
            severity: "error",
            path: `${profile.resourceType}.${rule.field}`,
            message: `Cardinality violation: '${rule.field}' requires at least ${rule.min} item(s)`,
            actualValue: value.length,
            expectedValue: `>= ${rule.min}`,
            suggestion: {
              type: "fix_cardinality",
              description: `Add ${rule.min - value.length} more item(s) to '${rule.field}'`,
            },
          });
        }

        if (rule.max !== "*" && value.length > parseInt(rule.max)) {
          issues.push({
            id: randomUUID(),
            severity: "error",
            path: `${profile.resourceType}.${rule.field}`,
            message: `Cardinality violation: '${rule.field}' allows at most ${rule.max} item(s)`,
            actualValue: value.length,
            expectedValue: `<= ${rule.max}`,
            suggestion: {
              type: "fix_cardinality",
              description: `Remove ${value.length - parseInt(rule.max)} item(s) from '${rule.field}'`,
            },
          });
        }
      }
    }
  }

  private validateExtensions(
    resource: Record<string, unknown>,
    profile: FHIRProfile,
    issues: ValidationIssue[]
  ): void {
    const extensions = resource.extension as Array<Record<string, unknown>> | undefined;
    
    for (const extDef of profile.extensions) {
      const found = extensions?.filter(e => e.url === extDef.url) || [];
      
      if (found.length < extDef.min) {
        issues.push({
          id: randomUUID(),
          severity: extDef.min > 0 ? "error" : "information",
          path: extDef.path,
          message: `Extension '${extDef.url}' is ${extDef.min > 0 ? "required" : "recommended"} but not present`,
          constraint: `extension:${extDef.id}`,
          suggestion: {
            type: "add_extension",
            description: `Add the '${extDef.url}' extension`,
            profileAdjustment: extDef.min === 0 ? "Consider if this extension is applicable to your use case" : undefined,
          },
        });
      }
    }
  }

  private evaluateConstraint(resource: Record<string, unknown>, expression: string, fieldPath: string): boolean {
    if (expression.includes(".exists()")) {
      const path = expression.replace(".exists()", "").replace(/\w+\./, "");
      const value = this.getFieldValue(resource, path);
      return value !== undefined && value !== null;
    }
    
    if (expression.includes(".count() >= ")) {
      const match = expression.match(/(\w+)\.count\(\) >= (\d+)/);
      if (match) {
        const value = this.getFieldValue(resource, match[1]);
        return Array.isArray(value) && value.length >= parseInt(match[2]);
      }
    }

    return true;
  }

  private generateConstraintSuggestion(
    constraint: ProfileConstraint,
    resource: Record<string, unknown>,
    fieldPath: string
  ): ValidationSuggestion {
    if (constraint.expression?.includes(".exists()")) {
      return {
        type: "add_field",
        description: `Add the '${fieldPath}' field to satisfy constraint ${constraint.id}`,
        suggestedValue: this.suggestDefaultValue(fieldPath, resource.resourceType as string),
      };
    }

    if (constraint.expression?.includes(".count()")) {
      return {
        type: "fix_cardinality",
        description: `Ensure '${fieldPath}' has the required number of items`,
      };
    }

    return {
      type: "modify_value",
      description: `Review and fix '${fieldPath}' to satisfy: ${constraint.human}`,
    };
  }

  private suggestDefaultValue(field: string, resourceType: string): unknown {
    const suggestions: Record<string, unknown> = {
      identifier: [{ system: "http://example.org/identifiers", value: "example-id" }],
      name: [{ family: "Unknown", given: ["Unknown"] }],
      gender: "unknown",
      status: resourceType === "Observation" ? "final" : resourceType === "Condition" ? "active" : "unknown",
      code: { coding: [{ system: "http://example.org", code: "unknown", display: "Unknown" }] },
      subject: { reference: "Patient/unknown" },
      class: { code: "AMB", display: "ambulatory" },
      intent: "order",
    };

    return suggestions[field];
  }

  private getFieldValue(resource: Record<string, unknown>, field: string): unknown {
    const parts = field.split(".");
    let current: unknown = resource;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      
      const basePart = part.replace(/\[x\]$/, "");
      
      if (part.endsWith("[x]")) {
        const obj = current as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
          if (key.startsWith(basePart)) {
            current = obj[key];
            break;
          }
        }
      } else {
        current = (current as Record<string, unknown>)[basePart];
      }
    }

    return current;
  }

  private calculateComplianceScore(issues: ValidationIssue[], profile: FHIRProfile): number {
    const errorCount = issues.filter(i => i.severity === "error").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;
    const infoCount = issues.filter(i => i.severity === "information").length;
    
    const totalChecks = profile.required.length + profile.mustSupport.length + profile.constraints.length + 5;
    const penalty = (errorCount * 10) + (warningCount * 3) + (infoCount * 1);
    
    const score = Math.max(0, Math.min(100, 100 - (penalty / totalChecks * 100)));
    return Math.round(score);
  }

  async createProfile(profile: Omit<FHIRProfile, "id" | "createdAt" | "updatedAt">): Promise<FHIRProfile> {
    const newProfile: FHIRProfile = {
      ...profile,
      id: `profile-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(newProfile.id, newProfile);
    console.log("[ProfileValidator] Created profile:", newProfile.name);
    return newProfile;
  }

  async updateProfile(profileId: string, updates: Partial<FHIRProfile>): Promise<FHIRProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const updated: FHIRProfile = {
      ...profile,
      ...updates,
      id: profileId,
      updatedAt: new Date().toISOString(),
    };

    this.profiles.set(profileId, updated);
    return updated;
  }

  async deleteProfile(profileId: string): Promise<void> {
    if (!this.profiles.has(profileId)) {
      throw new Error("Profile not found");
    }
    const profile = this.profiles.get(profileId);
    if (profile?.type === "standard") {
      throw new Error("Cannot delete standard profiles");
    }
    this.profiles.delete(profileId);
  }

  async getProfile(profileId: string): Promise<FHIRProfile | undefined> {
    return this.profiles.get(profileId);
  }

  async listProfiles(type?: ProfileType): Promise<FHIRProfile[]> {
    const profiles = Array.from(this.profiles.values());
    return type ? profiles.filter(p => p.type === type) : profiles;
  }

  async startBatchValidation(profileId: string, resources: Record<string, unknown>[]): Promise<ValidationBatchJob> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }

    const job: ValidationBatchJob = {
      id: randomUUID(),
      profileId,
      status: "pending",
      totalResources: resources.length,
      processedResources: 0,
      validCount: 0,
      invalidCount: 0,
      results: [],
    };

    this.jobs.set(job.id, job);
    this.processBatchValidation(job.id, resources);

    return job;
  }

  private async processBatchValidation(jobId: string, resources: Record<string, unknown>[]): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = "in_progress";
    job.startedAt = new Date().toISOString();

    for (const resource of resources) {
      try {
        const result = await this.validateResource(resource, job.profileId);
        job.results.push(result);
        if (result.valid) {
          job.validCount++;
        } else {
          job.invalidCount++;
        }
      } catch (error) {
        job.invalidCount++;
      }
      job.processedResources++;
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
  }

  async getJob(jobId: string): Promise<ValidationBatchJob | undefined> {
    return this.jobs.get(jobId);
  }

  async listJobs(): Promise<ValidationBatchJob[]> {
    return Array.from(this.jobs.values());
  }

  getValidationStats(): {
    totalProfiles: number;
    standardProfiles: number;
    customProfiles: number;
    totalValidations: number;
    cacheSize: number;
  } {
    const profiles = Array.from(this.profiles.values());
    return {
      totalProfiles: profiles.length,
      standardProfiles: profiles.filter(p => p.type === "standard").length,
      customProfiles: profiles.filter(p => p.type === "custom").length,
      totalValidations: this.validationCache.size,
      cacheSize: this.validationCache.size,
    };
  }

  getSupportedResourceTypes(): string[] {
    const types = new Set(Array.from(this.profiles.values()).map(p => p.resourceType));
    return Array.from(types);
  }
}

export const fhirProfileValidator = new FhirProfileValidator();
