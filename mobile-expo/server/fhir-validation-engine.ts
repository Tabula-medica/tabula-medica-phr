import { db } from "./db";
import { 
  fhirProfiles, 
  fhirValueSets, 
  validationResults,
  terminologyMappings,
  type FhirProfile,
  type FhirValueSet,
  type InsertValidationResult,
  VALIDATION_SEVERITIES,
  TERMINOLOGY_SYSTEMS
} from "../shared/schema";
import { eq, and, or, ilike } from "drizzle-orm";

export interface ValidationIssue {
  severity: typeof VALIDATION_SEVERITIES[number];
  code: string;
  message: string;
  location: string;
  expression?: string;
  details?: Record<string, unknown>;
}

export interface ValidationSuggestion {
  type: "correction" | "enrichment" | "mapping";
  field: string;
  currentValue: unknown;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  resourceType: string;
  resourceId?: string;
  profileUrl?: string;
  severity: typeof VALIDATION_SEVERITIES[number];
  issues: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  validatedAt: Date;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    profile?: string[];
    versionId?: string;
    lastUpdated?: string;
  };
  [key: string]: unknown;
}

const FHIR_R4_RESOURCE_TYPES = [
  "Patient", "Observation", "Condition", "MedicationRequest", "Medication",
  "Procedure", "Immunization", "AllergyIntolerance", "DiagnosticReport",
  "DocumentReference", "Encounter", "Practitioner", "Organization",
  "CarePlan", "CareTeam", "Goal", "ServiceRequest", "Coverage"
];

const REQUIRED_ELEMENTS: Record<string, string[]> = {
  Patient: ["resourceType"],
  Observation: ["resourceType", "status", "code"],
  Condition: ["resourceType", "subject"],
  MedicationRequest: ["resourceType", "status", "intent", "medication", "subject"],
  Procedure: ["resourceType", "status", "subject"],
  Immunization: ["resourceType", "status", "vaccineCode", "patient"],
  AllergyIntolerance: ["resourceType", "patient"],
  DiagnosticReport: ["resourceType", "status", "code"],
  Encounter: ["resourceType", "status", "class"],
  DocumentReference: ["resourceType", "status", "content"],
};

const US_CORE_PROFILES: Record<string, string> = {
  Patient: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  Observation: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
  Condition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
  MedicationRequest: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  Procedure: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  Immunization: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  AllergyIntolerance: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  DiagnosticReport: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
  Encounter: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  DocumentReference: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
};

const INTERNATIONAL_PROFILES: Record<string, Record<string, string>> = {
  "IPS": {
    Patient: "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
    Observation: "http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-uv-ips",
    Condition: "http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips",
    Medication: "http://hl7.org/fhir/uv/ips/StructureDefinition/Medication-uv-ips",
    AllergyIntolerance: "http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips",
    Immunization: "http://hl7.org/fhir/uv/ips/StructureDefinition/Immunization-uv-ips",
  },
  "AU_CORE": {
    Patient: "http://hl7.org.au/fhir/core/StructureDefinition/au-core-patient",
    Observation: "http://hl7.org.au/fhir/core/StructureDefinition/au-core-observation",
    Condition: "http://hl7.org.au/fhir/core/StructureDefinition/au-core-condition",
  },
  "UK_CORE": {
    Patient: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Patient",
    Observation: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Observation",
    Condition: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-Condition",
  }
};

const ARGONAUT_PROFILES: Record<string, string> = {
  Patient: "http://fhir.org/guides/argonaut/StructureDefinition/argo-patient",
  Observation: "http://fhir.org/guides/argonaut/StructureDefinition/argo-observationresults",
  Condition: "http://fhir.org/guides/argonaut/StructureDefinition/argo-condition",
  MedicationRequest: "http://fhir.org/guides/argonaut/StructureDefinition/argo-medicationorder",
  MedicationStatement: "http://fhir.org/guides/argonaut/StructureDefinition/argo-medicationstatement",
  AllergyIntolerance: "http://fhir.org/guides/argonaut/StructureDefinition/argo-allergyintolerance",
  Immunization: "http://fhir.org/guides/argonaut/StructureDefinition/argo-immunization",
  Procedure: "http://fhir.org/guides/argonaut/StructureDefinition/argo-procedure",
  CarePlan: "http://fhir.org/guides/argonaut/StructureDefinition/argo-careplan",
  CareTeam: "http://fhir.org/guides/argonaut/StructureDefinition/argo-careteam",
  Goal: "http://fhir.org/guides/argonaut/StructureDefinition/argo-goal",
  DiagnosticReport: "http://fhir.org/guides/argonaut/StructureDefinition/argo-diagnosticreport",
  DocumentReference: "http://fhir.org/guides/argonaut/StructureDefinition/argo-documentreference",
};

const ARGONAUT_REQUIRED_ELEMENTS: Record<string, string[]> = {
  Patient: ["identifier", "name", "gender"],
  Observation: ["status", "category", "code", "subject"],
  Condition: ["clinicalStatus", "code", "subject"],
  MedicationRequest: ["status", "intent", "medicationCodeableConcept", "subject"],
  AllergyIntolerance: ["clinicalStatus", "code", "patient"],
  Immunization: ["status", "vaccineCode", "patient", "occurrenceDateTime"],
  Procedure: ["status", "code", "subject", "performedDateTime"],
};

export type ProfileType = "US_CORE" | "ARGONAUT" | "IPS" | "AU_CORE" | "UK_CORE" | "CUSTOM";

export interface ProfileValidationOptions {
  profileType: ProfileType;
  strictMode?: boolean;
  checkMustSupport?: boolean;
  checkCardinality?: boolean;
  checkValueSets?: boolean;
}

export interface DataQualityMetrics {
  totalResources: number;
  validResources: number;
  invalidResources: number;
  validationRate: number;
  completenessScore: number;
  consistencyScore: number;
  issuesByType: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  resourceTypeBreakdown: Record<string, {
    total: number;
    valid: number;
    completeness: number;
    commonIssues: string[];
  }>;
  lastUpdated: Date;
}

export class FhirValidationEngine {
  private cachedProfiles: Map<string, FhirProfile> = new Map();
  private cachedValueSets: Map<string, FhirValueSet> = new Map();

  async validateResource(
    resource: FhirResource,
    options: {
      profileUrl?: string;
      jurisdiction?: string;
      strictMode?: boolean;
      checkValueSets?: boolean;
      suggestCorrections?: boolean;
    } = {}
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];
    const resourceType = resource.resourceType;
    const resourceId = resource.id;

    const schemaIssues = this.validateSchema(resource);
    issues.push(...schemaIssues);

    const requiredIssues = this.validateRequiredElements(resource);
    issues.push(...requiredIssues);

    if (options.profileUrl || resource.meta?.profile?.length) {
      const profileUrl = options.profileUrl || resource.meta?.profile?.[0];
      if (profileUrl) {
        const profileIssues = await this.validateAgainstProfile(resource, profileUrl);
        issues.push(...profileIssues);
      }
    } else if (options.jurisdiction) {
      const jurisdictionIssues = await this.validateAgainstJurisdiction(resource, options.jurisdiction);
      issues.push(...jurisdictionIssues);
    }

    if (options.checkValueSets !== false) {
      const valueSetIssues = await this.validateValueSets(resource);
      issues.push(...valueSetIssues);
    }

    const consistencyIssues = this.validateCrossResourceConsistency(resource);
    issues.push(...consistencyIssues);

    const semanticIssues = await this.validateSemantics(resource);
    issues.push(...semanticIssues);

    if (options.suggestCorrections !== false) {
      const correctionSuggestions = await this.generateCorrectionSuggestions(resource, issues);
      suggestions.push(...correctionSuggestions);
    }

    const highestSeverity = this.getHighestSeverity(issues);
    const isValid = !issues.some(i => i.severity === "fatal" || i.severity === "error");

    return {
      isValid,
      resourceType,
      resourceId,
      profileUrl: options.profileUrl || resource.meta?.profile?.[0],
      severity: highestSeverity,
      issues,
      suggestions,
      validatedAt: new Date(),
    };
  }

  private validateSchema(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!resource.resourceType) {
      issues.push({
        severity: "fatal",
        code: "MISSING_RESOURCE_TYPE",
        message: "Resource must have a resourceType property",
        location: "resourceType",
      });
      return issues;
    }

    if (!FHIR_R4_RESOURCE_TYPES.includes(resource.resourceType)) {
      issues.push({
        severity: "warning",
        code: "UNKNOWN_RESOURCE_TYPE",
        message: `Unknown resource type: ${resource.resourceType}`,
        location: "resourceType",
      });
    }

    if (resource.id && typeof resource.id !== "string") {
      issues.push({
        severity: "error",
        code: "INVALID_ID_TYPE",
        message: "Resource id must be a string",
        location: "id",
      });
    }

    return issues;
  }

  private validateRequiredElements(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const required = REQUIRED_ELEMENTS[resource.resourceType] || ["resourceType"];

    for (const element of required) {
      const value = this.getNestedValue(resource, element);
      if (value === undefined || value === null) {
        issues.push({
          severity: "error",
          code: "MISSING_REQUIRED_ELEMENT",
          message: `Missing required element: ${element}`,
          location: element,
          expression: `${resource.resourceType}.${element}`,
        });
      }
    }

    return issues;
  }

  private async validateAgainstProfile(
    resource: FhirResource, 
    profileUrl: string
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    let profile = this.cachedProfiles.get(profileUrl);
    if (!profile) {
      const [dbProfile] = await db
        .select()
        .from(fhirProfiles)
        .where(eq(fhirProfiles.url, profileUrl))
        .limit(1);
      
      if (dbProfile) {
        profile = dbProfile;
        this.cachedProfiles.set(profileUrl, profile);
      }
    }

    if (!profile) {
      issues.push({
        severity: "warning",
        code: "UNKNOWN_PROFILE",
        message: `Profile not found in registry: ${profileUrl}`,
        location: "meta.profile",
        details: { profileUrl }
      });
      return issues;
    }

    if (profile.requiredElements && Array.isArray(profile.requiredElements)) {
      for (const element of profile.requiredElements as string[]) {
        const value = this.getNestedValue(resource, element);
        if (value === undefined || value === null) {
          issues.push({
            severity: "error",
            code: "PROFILE_REQUIRED_ELEMENT_MISSING",
            message: `Profile ${profile.name} requires element: ${element}`,
            location: element,
            expression: `${resource.resourceType}.${element}`,
            details: { profile: profile.name, profileUrl }
          });
        }
      }
    }

    if (profile.constraints && Array.isArray(profile.constraints)) {
      for (const constraint of profile.constraints as Array<{
        key: string;
        expression: string;
        message: string;
        severity: string;
      }>) {
        const constraintValid = this.evaluateConstraint(resource, constraint.expression);
        if (!constraintValid) {
          issues.push({
            severity: (constraint.severity as ValidationIssue["severity"]) || "error",
            code: `CONSTRAINT_VIOLATION_${constraint.key}`,
            message: constraint.message,
            location: constraint.expression,
            expression: constraint.expression,
            details: { constraintKey: constraint.key }
          });
        }
      }
    }

    return issues;
  }

  private async validateAgainstJurisdiction(
    resource: FhirResource,
    jurisdiction: string
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    let profileUrl: string | undefined;
    
    if (jurisdiction === "US") {
      profileUrl = US_CORE_PROFILES[resource.resourceType];
    } else if (INTERNATIONAL_PROFILES[jurisdiction]) {
      profileUrl = INTERNATIONAL_PROFILES[jurisdiction][resource.resourceType];
    }

    if (profileUrl) {
      const profileIssues = await this.validateAgainstProfile(resource, profileUrl);
      issues.push(...profileIssues);
    }

    if (jurisdiction === "US") {
      const usSpecificIssues = this.validateUSCoreSpecific(resource);
      issues.push(...usSpecificIssues);
    }

    return issues;
  }

  private validateUSCoreSpecific(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (resource.resourceType === "Patient") {
      const patient = resource as FhirResource & {
        identifier?: Array<{ system?: string; value?: string }>;
        name?: Array<{ family?: string; given?: string[] }>;
        gender?: string;
        birthDate?: string;
      };

      if (!patient.identifier?.some(id => id.system && id.value)) {
        issues.push({
          severity: "warning",
          code: "US_CORE_MISSING_IDENTIFIER",
          message: "US Core Patient should have at least one identifier with system and value",
          location: "Patient.identifier",
        });
      }

      if (!patient.name?.some(n => n.family || n.given?.length)) {
        issues.push({
          severity: "error",
          code: "US_CORE_MISSING_NAME",
          message: "US Core Patient must have at least one name with family or given",
          location: "Patient.name",
        });
      }

      if (!patient.gender) {
        issues.push({
          severity: "error",
          code: "US_CORE_MISSING_GENDER",
          message: "US Core Patient must have gender",
          location: "Patient.gender",
        });
      }
    }

    if (resource.resourceType === "Observation") {
      const observation = resource as FhirResource & {
        category?: Array<{ coding?: Array<{ system?: string; code?: string }> }>;
        code?: { coding?: Array<{ system?: string; code?: string }> };
      };

      if (!observation.category?.length) {
        issues.push({
          severity: "error",
          code: "US_CORE_MISSING_CATEGORY",
          message: "US Core Observation must have category",
          location: "Observation.category",
        });
      }

      const hasLoincCode = observation.code?.coding?.some(
        c => c.system === "http://loinc.org" && c.code
      );
      if (!hasLoincCode) {
        issues.push({
          severity: "warning",
          code: "US_CORE_PREFER_LOINC",
          message: "US Core recommends LOINC codes for observations",
          location: "Observation.code",
        });
      }
    }

    return issues;
  }

  private async validateValueSets(resource: FhirResource): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const codedElements = this.extractCodedElements(resource);

    for (const codedElement of codedElements) {
      if (!codedElement.system || !codedElement.code) continue;

      const isKnownSystem = TERMINOLOGY_SYSTEMS.includes(codedElement.system as typeof TERMINOLOGY_SYSTEMS[number]);
      if (!isKnownSystem) {
        issues.push({
          severity: "information",
          code: "UNKNOWN_CODE_SYSTEM",
          message: `Unknown code system: ${codedElement.system}`,
          location: codedElement.path,
          details: { system: codedElement.system, code: codedElement.code }
        });
        continue;
      }

      const valueSetValid = await this.checkCodeInValueSet(
        codedElement.system,
        codedElement.code
      );

      if (!valueSetValid) {
        issues.push({
          severity: "warning",
          code: "CODE_NOT_IN_VALUE_SET",
          message: `Code ${codedElement.code} not found in value set for ${codedElement.system}`,
          location: codedElement.path,
          details: { 
            system: codedElement.system, 
            code: codedElement.code,
            display: codedElement.display 
          }
        });
      }
    }

    return issues;
  }

  private validateCrossResourceConsistency(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (resource.resourceType === "MedicationRequest") {
      const medRequest = resource as FhirResource & {
        status?: string;
        intent?: string;
        dosageInstruction?: Array<{ timing?: unknown; doseAndRate?: unknown }>;
      };

      if (medRequest.status === "active" && !medRequest.dosageInstruction?.length) {
        issues.push({
          severity: "warning",
          code: "ACTIVE_MED_NO_DOSAGE",
          message: "Active medication request should have dosage instructions",
          location: "MedicationRequest.dosageInstruction",
        });
      }
    }

    if (resource.resourceType === "Observation") {
      const observation = resource as FhirResource & {
        status?: string;
        value?: unknown;
        valueQuantity?: { value?: number; unit?: string };
        dataAbsentReason?: unknown;
      };

      if (observation.status === "final" && !observation.value && !observation.valueQuantity && !observation.dataAbsentReason) {
        issues.push({
          severity: "error",
          code: "FINAL_OBS_NO_VALUE",
          message: "Final observation must have a value or dataAbsentReason",
          location: "Observation.value[x]",
        });
      }

      if (observation.valueQuantity?.value !== undefined && !observation.valueQuantity?.unit) {
        issues.push({
          severity: "warning",
          code: "QUANTITY_MISSING_UNIT",
          message: "Quantity value should have a unit",
          location: "Observation.valueQuantity.unit",
        });
      }
    }

    if (resource.resourceType === "Condition") {
      const condition = resource as FhirResource & {
        clinicalStatus?: { coding?: Array<{ code?: string }> };
        verificationStatus?: { coding?: Array<{ code?: string }> };
        abatementDateTime?: string;
      };

      const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code;
      const hasAbatement = !!condition.abatementDateTime;

      if (clinicalStatus === "resolved" && !hasAbatement) {
        issues.push({
          severity: "warning",
          code: "RESOLVED_NO_ABATEMENT",
          message: "Resolved condition should have abatement date",
          location: "Condition.abatementDateTime",
        });
      }

      if (clinicalStatus === "active" && hasAbatement) {
        issues.push({
          severity: "error",
          code: "ACTIVE_WITH_ABATEMENT",
          message: "Active condition should not have abatement date",
          location: "Condition.clinicalStatus",
        });
      }
    }

    return issues;
  }

  private async validateSemantics(resource: FhirResource): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (resource.resourceType === "Observation") {
      const observation = resource as FhirResource & {
        effectiveDateTime?: string;
        issued?: string;
        valueQuantity?: { value?: number; unit?: string; code?: string; system?: string };
      };

      if (observation.effectiveDateTime) {
        const effectiveDate = new Date(observation.effectiveDateTime);
        if (effectiveDate > new Date()) {
          issues.push({
            severity: "error",
            code: "FUTURE_EFFECTIVE_DATE",
            message: "Observation effective date cannot be in the future",
            location: "Observation.effectiveDateTime",
            details: { date: observation.effectiveDateTime }
          });
        }
      }

      if (observation.valueQuantity) {
        const { value, unit, code } = observation.valueQuantity;
        
        if (unit === "%" && value !== undefined && (value < 0 || value > 100)) {
          issues.push({
            severity: "warning",
            code: "PERCENTAGE_OUT_OF_RANGE",
            message: "Percentage value should be between 0 and 100",
            location: "Observation.valueQuantity.value",
            details: { value }
          });
        }

        if (unit && !code) {
          issues.push({
            severity: "information",
            code: "MISSING_UCUM_CODE",
            message: "Quantity has display unit but missing UCUM code",
            location: "Observation.valueQuantity.code",
          });
        }
      }
    }

    if (resource.resourceType === "Patient") {
      const patient = resource as FhirResource & {
        birthDate?: string;
        deceasedDateTime?: string;
        deceasedBoolean?: boolean;
      };

      if (patient.birthDate) {
        const birthDate = new Date(patient.birthDate);
        if (birthDate > new Date()) {
          issues.push({
            severity: "error",
            code: "FUTURE_BIRTH_DATE",
            message: "Patient birth date cannot be in the future",
            location: "Patient.birthDate",
          });
        }

        if (patient.deceasedDateTime) {
          const deathDate = new Date(patient.deceasedDateTime);
          if (deathDate < birthDate) {
            issues.push({
              severity: "error",
              code: "DEATH_BEFORE_BIRTH",
              message: "Death date cannot be before birth date",
              location: "Patient.deceasedDateTime",
            });
          }
        }
      }
    }

    return issues;
  }

  private async generateCorrectionSuggestions(
    resource: FhirResource,
    issues: ValidationIssue[]
  ): Promise<ValidationSuggestion[]> {
    const suggestions: ValidationSuggestion[] = [];

    for (const issue of issues) {
      if (issue.code === "US_CORE_PREFER_LOINC") {
        const observation = resource as FhirResource & {
          code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
        };

        const existingCode = observation.code?.coding?.[0];
        if (existingCode?.code && existingCode?.system) {
          const loincMapping = await this.findTerminologyMapping(
            existingCode.system,
            existingCode.code,
            "http://loinc.org"
          );

          if (loincMapping) {
            suggestions.push({
              type: "mapping",
              field: "code.coding",
              currentValue: existingCode,
              suggestedValue: {
                system: "http://loinc.org",
                code: loincMapping.targetCode,
                display: loincMapping.targetDisplay,
              },
              confidence: loincMapping.confidence || 80,
              reason: "LOINC code mapping available from terminology service",
            });
          }
        }
      }

      if (issue.code === "MISSING_UCUM_CODE") {
        const observation = resource as FhirResource & {
          valueQuantity?: { unit?: string };
        };

        const unit = observation.valueQuantity?.unit;
        if (unit) {
          const ucumCode = this.suggestUcumCode(unit);
          if (ucumCode) {
            suggestions.push({
              type: "enrichment",
              field: "valueQuantity.code",
              currentValue: undefined,
              suggestedValue: ucumCode,
              confidence: 90,
              reason: "UCUM code derived from display unit",
            });
          }
        }
      }

      if (issue.code === "QUANTITY_MISSING_UNIT") {
        suggestions.push({
          type: "correction",
          field: "valueQuantity.unit",
          currentValue: undefined,
          suggestedValue: "Review and add appropriate unit",
          confidence: 50,
          reason: "Quantity values should have units for proper interpretation",
        });
      }
    }

    return suggestions;
  }

  private async findTerminologyMapping(
    sourceSystem: string,
    sourceCode: string,
    targetSystem: string
  ) {
    const [mapping] = await db
      .select()
      .from(terminologyMappings)
      .where(and(
        eq(terminologyMappings.sourceSystem, sourceSystem),
        eq(terminologyMappings.sourceCode, sourceCode),
        eq(terminologyMappings.targetSystem, targetSystem)
      ))
      .limit(1);

    return mapping;
  }

  private suggestUcumCode(displayUnit: string): string | null {
    const ucumMappings: Record<string, string> = {
      "mg/dL": "mg/dL",
      "mmol/L": "mmol/L",
      "g/dL": "g/dL",
      "%": "%",
      "mm Hg": "mm[Hg]",
      "mmHg": "mm[Hg]",
      "bpm": "/min",
      "beats/min": "/min",
      "breaths/min": "/min",
      "kg": "kg",
      "lb": "[lb_av]",
      "cm": "cm",
      "in": "[in_i]",
      "°F": "[degF]",
      "°C": "Cel",
      "mL": "mL",
      "L": "L",
      "mg": "mg",
      "mcg": "ug",
      "ng/mL": "ng/mL",
      "U/L": "U/L",
      "IU/L": "[iU]/L",
      "mEq/L": "meq/L",
      "cells/uL": "/uL",
      "10*3/uL": "10*3/uL",
      "10*6/uL": "10*6/uL",
      "fL": "fL",
      "pg": "pg",
      "seconds": "s",
      "minutes": "min",
      "hours": "h",
      "days": "d",
    };

    return ucumMappings[displayUnit] || null;
  }

  private extractCodedElements(
    resource: FhirResource,
    path: string = ""
  ): Array<{ path: string; system?: string; code?: string; display?: string }> {
    const elements: Array<{ path: string; system?: string; code?: string; display?: string }> = [];

    const traverse = (obj: unknown, currentPath: string) => {
      if (!obj || typeof obj !== "object") return;

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => traverse(item, `${currentPath}[${index}]`));
        return;
      }

      const record = obj as Record<string, unknown>;

      if ("coding" in record && Array.isArray(record.coding)) {
        for (const coding of record.coding as Array<{ system?: string; code?: string; display?: string }>) {
          elements.push({
            path: `${currentPath}.coding`,
            system: coding.system,
            code: coding.code,
            display: coding.display,
          });
        }
      }

      if ("system" in record && "code" in record) {
        elements.push({
          path: currentPath,
          system: record.system as string,
          code: record.code as string,
          display: record.display as string | undefined,
        });
      }

      for (const [key, value] of Object.entries(record)) {
        if (key !== "resourceType" && typeof value === "object") {
          traverse(value, currentPath ? `${currentPath}.${key}` : key);
        }
      }
    };

    traverse(resource, resource.resourceType);
    return elements;
  }

  private async checkCodeInValueSet(system: string, code: string): Promise<boolean> {
    let valueSet = this.cachedValueSets.get(system);
    
    if (!valueSet) {
      const [dbValueSet] = await db
        .select()
        .from(fhirValueSets)
        .where(eq(fhirValueSets.codeSystem, system))
        .limit(1);

      if (dbValueSet) {
        valueSet = dbValueSet;
        this.cachedValueSets.set(system, valueSet);
      }
    }

    if (!valueSet || !valueSet.expansion) {
      return true;
    }

    const expansion = valueSet.expansion as { contains?: Array<{ code: string }> };
    return expansion.contains?.some(c => c.code === code) ?? true;
  }

  private evaluateConstraint(resource: FhirResource, expression: string): boolean {
    try {
      if (expression.includes(".exists()")) {
        const path = expression.replace(".exists()", "").trim();
        const value = this.getNestedValue(resource, path);
        return value !== undefined && value !== null;
      }

      if (expression.includes(".count()")) {
        const match = expression.match(/(.+)\.count\(\)\s*(>=|<=|>|<|=)\s*(\d+)/);
        if (match) {
          const path = match[1];
          const operator = match[2];
          const expected = parseInt(match[3], 10);
          const value = this.getNestedValue(resource, path);
          const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
          
          switch (operator) {
            case ">=": return count >= expected;
            case "<=": return count <= expected;
            case ">": return count > expected;
            case "<": return count < expected;
            case "=": return count === expected;
          }
        }
      }

      return true;
    } catch {
      return true;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
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

  private getHighestSeverity(issues: ValidationIssue[]): typeof VALIDATION_SEVERITIES[number] {
    const severityOrder: Record<string, number> = {
      fatal: 0,
      error: 1,
      warning: 2,
      information: 3,
    };

    let highest: typeof VALIDATION_SEVERITIES[number] = "information";
    let highestOrder = severityOrder.information;

    for (const issue of issues) {
      const order = severityOrder[issue.severity];
      if (order < highestOrder) {
        highest = issue.severity;
        highestOrder = order;
      }
    }

    return highest;
  }

  async saveValidationResult(
    result: ValidationResult,
    recordId?: string,
    sourceId?: string
  ): Promise<void> {
    const insertData: InsertValidationResult = {
      recordId,
      sourceId,
      resourceType: result.resourceType,
      resourceId: result.resourceId,
      profileUrl: result.profileUrl,
      isValid: result.isValid,
      severity: result.severity,
      issues: result.issues as unknown as Record<string, unknown>,
      suggestions: result.suggestions as unknown as Record<string, unknown>,
      validatedAt: result.validatedAt,
    };

    await db.insert(validationResults).values(insertData);
  }

  async getValidationSummary(sourceId?: string): Promise<{
    totalValidations: number;
    validCount: number;
    invalidCount: number;
    bySeverity: Record<string, number>;
    byResourceType: Record<string, { valid: number; invalid: number }>;
    commonIssues: Array<{ code: string; count: number }>;
  }> {
    const allResults = await db
      .select()
      .from(validationResults)
      .where(sourceId ? eq(validationResults.sourceId, sourceId) : undefined);

    const summary = {
      totalValidations: allResults.length,
      validCount: 0,
      invalidCount: 0,
      bySeverity: {} as Record<string, number>,
      byResourceType: {} as Record<string, { valid: number; invalid: number }>,
      commonIssues: [] as Array<{ code: string; count: number }>,
    };

    const issueCountMap = new Map<string, number>();

    for (const result of allResults) {
      if (result.isValid) {
        summary.validCount++;
      } else {
        summary.invalidCount++;
      }

      summary.bySeverity[result.severity] = (summary.bySeverity[result.severity] || 0) + 1;

      if (!summary.byResourceType[result.resourceType]) {
        summary.byResourceType[result.resourceType] = { valid: 0, invalid: 0 };
      }
      if (result.isValid) {
        summary.byResourceType[result.resourceType].valid++;
      } else {
        summary.byResourceType[result.resourceType].invalid++;
      }

      if (result.issues && Array.isArray(result.issues)) {
        for (const issue of result.issues as ValidationIssue[]) {
          issueCountMap.set(issue.code, (issueCountMap.get(issue.code) || 0) + 1);
        }
      }
    }

    summary.commonIssues = Array.from(issueCountMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return summary;
  }

  async validateAgainstArgonaut(resource: FhirResource): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const suggestions: ValidationSuggestion[] = [];
    const resourceType = resource.resourceType;

    const schemaIssues = this.validateSchema(resource);
    issues.push(...schemaIssues);

    const requiredElements = ARGONAUT_REQUIRED_ELEMENTS[resourceType] || [];
    for (const element of requiredElements) {
      const value = this.getNestedValue(resource, element);
      if (value === undefined || value === null) {
        issues.push({
          severity: "error",
          code: "ARGONAUT_REQUIRED_ELEMENT_MISSING",
          message: `Argonaut profile requires element: ${element}`,
          location: element,
          expression: `${resourceType}.${element}`,
          details: { profile: "Argonaut" }
        });
      }
    }

    const profileUrl = ARGONAUT_PROFILES[resourceType];
    if (profileUrl) {
      const profileIssues = await this.validateAgainstProfile(resource, profileUrl);
      issues.push(...profileIssues.filter(i => i.code !== "UNKNOWN_PROFILE"));
    }

    if (resourceType === "Patient") {
      const argonautPatientIssues = this.validateArgonautPatient(resource);
      issues.push(...argonautPatientIssues);
    } else if (resourceType === "Observation") {
      const argonautObsIssues = this.validateArgonautObservation(resource);
      issues.push(...argonautObsIssues);
    }

    const highestSeverity = this.getHighestSeverity(issues);
    const isValid = !issues.some(i => i.severity === "fatal" || i.severity === "error");

    return {
      isValid,
      resourceType,
      resourceId: resource.id,
      profileUrl,
      severity: highestSeverity,
      issues,
      suggestions,
      validatedAt: new Date(),
    };
  }

  private validateArgonautPatient(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const patient = resource as any;

    if (!patient.identifier?.some((id: any) => id.system && id.value)) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_PATIENT_IDENTIFIER",
        message: "Argonaut Patient must have at least one identifier with system and value",
        location: "Patient.identifier",
      });
    }

    if (!patient.name?.some((n: any) => n.family && n.given?.length)) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_PATIENT_NAME",
        message: "Argonaut Patient must have at least one name with family and given",
        location: "Patient.name",
      });
    }

    if (!["male", "female", "other", "unknown"].includes(patient.gender)) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_PATIENT_GENDER",
        message: "Argonaut Patient must have a valid gender (male, female, other, unknown)",
        location: "Patient.gender",
      });
    }

    return issues;
  }

  private validateArgonautObservation(resource: FhirResource): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const observation = resource as any;

    if (!observation.category?.some((cat: any) => cat.coding?.length)) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_OBSERVATION_CATEGORY",
        message: "Argonaut Observation must have at least one category with coding",
        location: "Observation.category",
      });
    }

    if (!observation.code?.coding?.length) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_OBSERVATION_CODE",
        message: "Argonaut Observation must have a code with at least one coding",
        location: "Observation.code",
      });
    }

    if (!observation.subject?.reference) {
      issues.push({
        severity: "error",
        code: "ARGONAUT_OBSERVATION_SUBJECT",
        message: "Argonaut Observation must reference a subject",
        location: "Observation.subject",
      });
    }

    return issues;
  }

  async validateWithProfile(
    resource: FhirResource,
    options: ProfileValidationOptions
  ): Promise<ValidationResult> {
    switch (options.profileType) {
      case "ARGONAUT":
        return this.validateAgainstArgonaut(resource);
      case "US_CORE":
        return this.validateResource(resource, { jurisdiction: "US", strictMode: options.strictMode });
      case "IPS":
        return this.validateResource(resource, { jurisdiction: "IPS", strictMode: options.strictMode });
      case "AU_CORE":
        return this.validateResource(resource, { jurisdiction: "AU_CORE", strictMode: options.strictMode });
      case "UK_CORE":
        return this.validateResource(resource, { jurisdiction: "UK_CORE", strictMode: options.strictMode });
      default:
        return this.validateResource(resource, { strictMode: options.strictMode });
    }
  }

  async computeDataQualityMetrics(userId: string): Promise<DataQualityMetrics> {
    const { storage } = await import("./storage");
    const records = await storage.getHealthRecords(userId);
    
    const metrics: DataQualityMetrics = {
      totalResources: records.length,
      validResources: 0,
      invalidResources: 0,
      validationRate: 0,
      completenessScore: 0,
      consistencyScore: 0,
      issuesByType: {},
      issuesBySeverity: {},
      resourceTypeBreakdown: {},
      lastUpdated: new Date(),
    };

    if (records.length === 0) {
      metrics.validationRate = 100;
      metrics.completenessScore = 100;
      metrics.consistencyScore = 100;
      return metrics;
    }

    let totalCompletenessScore = 0;
    let consistencyIssues = 0;

    for (const record of records) {
      const resourceType = record.type || "Unknown";
      
      if (!metrics.resourceTypeBreakdown[resourceType]) {
        metrics.resourceTypeBreakdown[resourceType] = {
          total: 0,
          valid: 0,
          completeness: 0,
          commonIssues: [],
        };
      }
      metrics.resourceTypeBreakdown[resourceType].total++;

      const completeness = this.computeRecordCompleteness(record);
      totalCompletenessScore += completeness;
      metrics.resourceTypeBreakdown[resourceType].completeness += completeness;

      const hasAllRequired = this.checkRequiredFields(record);
      if (hasAllRequired) {
        metrics.validResources++;
        metrics.resourceTypeBreakdown[resourceType].valid++;
      } else {
        metrics.invalidResources++;
        metrics.issuesByType["MISSING_REQUIRED"] = (metrics.issuesByType["MISSING_REQUIRED"] || 0) + 1;
      }

      if (!this.checkDataConsistency(record)) {
        consistencyIssues++;
        metrics.issuesByType["CONSISTENCY_ERROR"] = (metrics.issuesByType["CONSISTENCY_ERROR"] || 0) + 1;
      }
    }

    metrics.validationRate = (metrics.validResources / metrics.totalResources) * 100;
    metrics.completenessScore = totalCompletenessScore / metrics.totalResources;
    metrics.consistencyScore = ((metrics.totalResources - consistencyIssues) / metrics.totalResources) * 100;

    for (const [type, data] of Object.entries(metrics.resourceTypeBreakdown)) {
      if (data.total > 0) {
        data.completeness = data.completeness / data.total;
      }
    }

    return metrics;
  }

  private computeRecordCompleteness(record: any): number {
    const requiredFields = ["title", "date", "provider"];
    const optionalFields = ["description", "summary", "fhirResourceType", "fhirResourceId"];
    
    let filledRequired = 0;
    let filledOptional = 0;

    for (const field of requiredFields) {
      if (record[field]) filledRequired++;
    }

    for (const field of optionalFields) {
      if (record[field]) filledOptional++;
    }

    const requiredScore = (filledRequired / requiredFields.length) * 70;
    const optionalScore = (filledOptional / optionalFields.length) * 30;

    return requiredScore + optionalScore;
  }

  private checkRequiredFields(record: any): boolean {
    return !!(record.title && record.date && record.type);
  }

  private checkDataConsistency(record: any): boolean {
    if (record.date) {
      const recordDate = new Date(record.date);
      if (isNaN(recordDate.getTime())) return false;
      if (recordDate > new Date()) return false;
    }

    if (record.fhirResourceId && !record.fhirResourceType) {
      return false;
    }

    return true;
  }

  getSupportedProfiles(): Array<{
    type: ProfileType;
    name: string;
    description: string;
    resourceTypes: string[];
  }> {
    return [
      {
        type: "US_CORE",
        name: "US Core",
        description: "HL7 FHIR US Core Implementation Guide for US healthcare interoperability",
        resourceTypes: Object.keys(US_CORE_PROFILES),
      },
      {
        type: "ARGONAUT",
        name: "Argonaut",
        description: "Argonaut Data Query Implementation Guide for EHR data access",
        resourceTypes: Object.keys(ARGONAUT_PROFILES),
      },
      {
        type: "IPS",
        name: "International Patient Summary",
        description: "HL7 FHIR International Patient Summary for cross-border health data exchange",
        resourceTypes: Object.keys(INTERNATIONAL_PROFILES["IPS"]),
      },
      {
        type: "AU_CORE",
        name: "Australian Core",
        description: "HL7 FHIR Australian Core for Australian healthcare systems",
        resourceTypes: Object.keys(INTERNATIONAL_PROFILES["AU_CORE"]),
      },
      {
        type: "UK_CORE",
        name: "UK Core",
        description: "HL7 FHIR UK Core for UK NHS systems",
        resourceTypes: Object.keys(INTERNATIONAL_PROFILES["UK_CORE"]),
      },
    ];
  }
}

export const validationEngine = new FhirValidationEngine();
