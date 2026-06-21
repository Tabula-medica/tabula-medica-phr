import { randomUUID } from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][FHIRProfileValidation] ${action} - ${resourceType}:${resourceId} User:${userId} - ${details}`);
}

export type ProfileType = "US_CORE" | "ARGONAUT" | "CARIN_BB" | "MCODE" | "CUSTOM";
export type ValidationSeverity = "ERROR" | "WARNING" | "INFORMATION";
export type ValidationResult = "VALID" | "INVALID" | "WARNINGS_ONLY";

export interface FhirProfile {
  id: string;
  name: string;
  profileType: ProfileType;
  url: string;
  version: string;
  resourceTypes: string[];
  description: string;
  isActive: boolean;
  rules: ProfileValidationRule[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileValidationRule {
  id: string;
  path: string;
  constraint: string;
  severity: ValidationSeverity;
  message: string;
  expression?: string;
  requirements?: string;
}

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code: string;
  path: string;
  message: string;
  profileUrl?: string;
  expression?: string;
  diagnostics?: string;
}

export interface ValidationReport {
  id: string;
  resourceType: string;
  resourceId: string;
  profilesValidated: string[];
  result: ValidationResult;
  issues: ValidationIssue[];
  issueCount: {
    errors: number;
    warnings: number;
    information: number;
  };
  validatedAt: string;
  validatedBy: string;
  duration: number;
}

export interface ProfileValidationConfig {
  id: string;
  name: string;
  description: string;
  profiles: string[];
  resourceTypes: string[];
  validateOnCreate: boolean;
  validateOnUpdate: boolean;
  strictMode: boolean;
  failOnWarnings: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const profiles = new Map<string, FhirProfile>();
const validationReports = new Map<string, ValidationReport>();
const validationConfigs = new Map<string, ProfileValidationConfig>();

function initializeSampleData(): void {
  const now = new Date().toISOString();

  const usCorePatinetProfile: FhirProfile = {
    id: "profile-us-core-patient",
    name: "US Core Patient Profile",
    profileType: "US_CORE",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    version: "6.1.0",
    resourceTypes: ["Patient"],
    description: "Defines constraints on the Patient resource for US Core implementations",
    isActive: true,
    rules: [
      { id: "usc-1", path: "Patient.identifier", constraint: "min", severity: "ERROR", message: "At least one identifier SHALL be present", requirements: "US Core requires patient identifier" },
      { id: "usc-2", path: "Patient.name", constraint: "min", severity: "ERROR", message: "At least one name SHALL be present", requirements: "Patient name is required" },
      { id: "usc-3", path: "Patient.gender", constraint: "required", severity: "ERROR", message: "Gender SHALL be present", requirements: "Administrative gender is required" },
      { id: "usc-4", path: "Patient.birthDate", constraint: "required", severity: "WARNING", message: "Birth date SHOULD be present", requirements: "Birth date is recommended" },
      { id: "usc-5", path: "Patient.address", constraint: "recommended", severity: "INFORMATION", message: "Address is recommended for care coordination" },
      { id: "usc-6", path: "Patient.telecom", constraint: "recommended", severity: "INFORMATION", message: "Contact information is recommended" },
      { id: "usc-7", path: "Patient.communication.language", constraint: "binding", severity: "ERROR", message: "Language must be from urn:ietf:bcp:47 value set" }
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  const usCoreConditionProfile: FhirProfile = {
    id: "profile-us-core-condition",
    name: "US Core Condition Profile",
    profileType: "US_CORE",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
    version: "6.1.0",
    resourceTypes: ["Condition"],
    description: "US Core Condition Profile for Problems and Health Concerns",
    isActive: true,
    rules: [
      { id: "uscc-1", path: "Condition.clinicalStatus", constraint: "required", severity: "ERROR", message: "Clinical status is required" },
      { id: "uscc-2", path: "Condition.verificationStatus", constraint: "required", severity: "ERROR", message: "Verification status is required" },
      { id: "uscc-3", path: "Condition.category", constraint: "min", severity: "ERROR", message: "At least one category SHALL be present" },
      { id: "uscc-4", path: "Condition.code", constraint: "required", severity: "ERROR", message: "Condition code is required" },
      { id: "uscc-5", path: "Condition.subject", constraint: "required", severity: "ERROR", message: "Subject reference is required" },
      { id: "uscc-6", path: "Condition.code.coding", constraint: "binding", severity: "ERROR", message: "Code must be from US Core Condition Code value set" }
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  const usCoreObservationProfile: FhirProfile = {
    id: "profile-us-core-observation-lab",
    name: "US Core Laboratory Result Observation Profile",
    profileType: "US_CORE",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
    version: "6.1.0",
    resourceTypes: ["Observation"],
    description: "US Core Laboratory Result Observation Profile",
    isActive: true,
    rules: [
      { id: "uscol-1", path: "Observation.status", constraint: "required", severity: "ERROR", message: "Status is required" },
      { id: "uscol-2", path: "Observation.category", constraint: "min", severity: "ERROR", message: "Category SHALL include 'laboratory'" },
      { id: "uscol-3", path: "Observation.code", constraint: "required", severity: "ERROR", message: "LOINC code is required" },
      { id: "uscol-4", path: "Observation.subject", constraint: "required", severity: "ERROR", message: "Subject reference is required" },
      { id: "uscol-5", path: "Observation.effectiveDateTime", constraint: "required", severity: "ERROR", message: "Effective date/time is required" },
      { id: "uscol-6", path: "Observation.value[x]", constraint: "conditional", severity: "ERROR", message: "Value is required unless dataAbsentReason is present" }
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  const argonautPatientProfile: FhirProfile = {
    id: "profile-argonaut-patient",
    name: "Argonaut Patient Profile",
    profileType: "ARGONAUT",
    url: "http://fhir.org/guides/argonaut/StructureDefinition/argo-patient",
    version: "1.0.0",
    resourceTypes: ["Patient"],
    description: "Argonaut Data Query Implementation Guide Patient Profile",
    isActive: true,
    rules: [
      { id: "argo-1", path: "Patient.identifier", constraint: "min", severity: "ERROR", message: "At least one identifier is required" },
      { id: "argo-2", path: "Patient.identifier.system", constraint: "required", severity: "ERROR", message: "Identifier system is required" },
      { id: "argo-3", path: "Patient.identifier.value", constraint: "required", severity: "ERROR", message: "Identifier value is required" },
      { id: "argo-4", path: "Patient.name.family", constraint: "required", severity: "ERROR", message: "Family name is required" },
      { id: "argo-5", path: "Patient.name.given", constraint: "min", severity: "ERROR", message: "At least one given name is required" },
      { id: "argo-6", path: "Patient.gender", constraint: "required", severity: "ERROR", message: "Gender is required" }
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  const carinBBProfile: FhirProfile = {
    id: "profile-carin-bb-coverage",
    name: "CARIN BB Coverage Profile",
    profileType: "CARIN_BB",
    url: "http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-Coverage",
    version: "2.0.0",
    resourceTypes: ["Coverage"],
    description: "CARIN Blue Button Coverage Profile for health insurance information",
    isActive: true,
    rules: [
      { id: "carin-1", path: "Coverage.status", constraint: "required", severity: "ERROR", message: "Status is required" },
      { id: "carin-2", path: "Coverage.type", constraint: "required", severity: "ERROR", message: "Coverage type is required" },
      { id: "carin-3", path: "Coverage.subscriber", constraint: "required", severity: "ERROR", message: "Subscriber reference is required" },
      { id: "carin-4", path: "Coverage.beneficiary", constraint: "required", severity: "ERROR", message: "Beneficiary reference is required" },
      { id: "carin-5", path: "Coverage.payor", constraint: "min", severity: "ERROR", message: "At least one payor is required" }
    ],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  [usCorePatinetProfile, usCoreConditionProfile, usCoreObservationProfile, argonautPatientProfile, carinBBProfile]
    .forEach(p => profiles.set(p.id, p));

  const defaultConfig: ProfileValidationConfig = {
    id: "config-default",
    name: "Default Validation Configuration",
    description: "Default profile validation for incoming FHIR resources",
    profiles: ["profile-us-core-patient", "profile-us-core-condition", "profile-us-core-observation-lab"],
    resourceTypes: ["Patient", "Condition", "Observation"],
    validateOnCreate: true,
    validateOnUpdate: true,
    strictMode: false,
    failOnWarnings: false,
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: now
  };

  validationConfigs.set(defaultConfig.id, defaultConfig);

  const sampleReports: ValidationReport[] = [
    {
      id: generateId("report"),
      resourceType: "Patient",
      resourceId: "patient-123",
      profilesValidated: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
      result: "VALID",
      issues: [],
      issueCount: { errors: 0, warnings: 0, information: 0 },
      validatedAt: new Date(Date.now() - 3600000).toISOString(),
      validatedBy: "system",
      duration: 45
    },
    {
      id: generateId("report"),
      resourceType: "Observation",
      resourceId: "observation-456",
      profilesValidated: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"],
      result: "WARNINGS_ONLY",
      issues: [
        { id: generateId("issue"), severity: "WARNING", code: "value-recommended", path: "Observation.interpretation", message: "Interpretation is recommended for laboratory results" }
      ],
      issueCount: { errors: 0, warnings: 1, information: 0 },
      validatedAt: new Date(Date.now() - 7200000).toISOString(),
      validatedBy: "system",
      duration: 38
    },
    {
      id: generateId("report"),
      resourceType: "Condition",
      resourceId: "condition-789",
      profilesValidated: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"],
      result: "INVALID",
      issues: [
        { id: generateId("issue"), severity: "ERROR", code: "required-element-missing", path: "Condition.clinicalStatus", message: "Clinical status is required" },
        { id: generateId("issue"), severity: "ERROR", code: "required-element-missing", path: "Condition.verificationStatus", message: "Verification status is required" }
      ],
      issueCount: { errors: 2, warnings: 0, information: 0 },
      validatedAt: new Date(Date.now() - 1800000).toISOString(),
      validatedBy: "user-001",
      duration: 52
    }
  ];

  sampleReports.forEach(r => validationReports.set(r.id, r));
}

initializeSampleData();

class FhirProfileValidationService {
  validateResource(resource: any, profileIds?: string[], userId: string = "system"): ValidationReport {
    const startTime = Date.now();
    const resourceType = resource.resourceType || "Unknown";
    const resourceId = resource.id || generateId("resource");

    const profilesToValidate = profileIds 
      ? profileIds.map(id => profiles.get(id)).filter(Boolean) as FhirProfile[]
      : Array.from(profiles.values()).filter(p => p.isActive && p.resourceTypes.includes(resourceType));

    const issues: ValidationIssue[] = [];

    for (const profile of profilesToValidate) {
      const profileIssues = this.validateAgainstProfile(resource, profile);
      issues.push(...profileIssues);
    }

    const issueCount = {
      errors: issues.filter(i => i.severity === "ERROR").length,
      warnings: issues.filter(i => i.severity === "WARNING").length,
      information: issues.filter(i => i.severity === "INFORMATION").length
    };

    let result: ValidationResult = "VALID";
    if (issueCount.errors > 0) {
      result = "INVALID";
    } else if (issueCount.warnings > 0) {
      result = "WARNINGS_ONLY";
    }

    const report: ValidationReport = {
      id: generateId("report"),
      resourceType,
      resourceId,
      profilesValidated: profilesToValidate.map(p => p.url),
      result,
      issues,
      issueCount,
      validatedAt: new Date().toISOString(),
      validatedBy: userId,
      duration: Date.now() - startTime
    };

    validationReports.set(report.id, report);

    auditLog("RESOURCE_VALIDATED", resourceType, resourceId, userId,
      `Validated against ${profilesToValidate.length} profiles. Result: ${result}, Errors: ${issueCount.errors}, Warnings: ${issueCount.warnings}`);

    return report;
  }

  private validateAgainstProfile(resource: any, profile: FhirProfile): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const rule of profile.rules) {
      const issue = this.evaluateRule(resource, rule, profile.url);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  private evaluateRule(resource: any, rule: ProfileValidationRule, profileUrl: string): ValidationIssue | null {
    const pathParts = rule.path.split(".");
    const fieldPath = pathParts.slice(1).join(".");
    const value = this.getValueAtPath(resource, fieldPath);

    switch (rule.constraint) {
      case "required":
        if (value === undefined || value === null || value === "") {
          return {
            id: generateId("issue"),
            severity: rule.severity,
            code: "required-element-missing",
            path: rule.path,
            message: rule.message,
            profileUrl,
            diagnostics: `Required element '${fieldPath}' is missing`
          };
        }
        break;

      case "min":
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return {
            id: generateId("issue"),
            severity: rule.severity,
            code: "cardinality-violation",
            path: rule.path,
            message: rule.message,
            profileUrl,
            diagnostics: `Minimum cardinality not met for '${fieldPath}'`
          };
        }
        break;

      case "recommended":
        if (value === undefined || value === null) {
          return {
            id: generateId("issue"),
            severity: "INFORMATION",
            code: "recommended-element-missing",
            path: rule.path,
            message: rule.message,
            profileUrl,
            diagnostics: `Recommended element '${fieldPath}' is not present`
          };
        }
        break;

      case "binding":
        break;

      case "conditional":
        break;
    }

    return null;
  }

  private getValueAtPath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.replace(/\[x\]/g, "").split(".");
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  getProfiles(params?: { type?: ProfileType; resourceType?: string; activeOnly?: boolean }): FhirProfile[] {
    let result = Array.from(profiles.values());

    if (params?.type) {
      result = result.filter(p => p.profileType === params.type);
    }
    if (params?.resourceType) {
      result = result.filter(p => p.resourceTypes.includes(params.resourceType!));
    }
    if (params?.activeOnly) {
      result = result.filter(p => p.isActive);
    }

    return result;
  }

  getProfile(profileId: string): FhirProfile | null {
    return profiles.get(profileId) || null;
  }

  createProfile(params: Omit<FhirProfile, "id" | "createdAt" | "updatedAt">, userId: string): FhirProfile {
    const now = new Date().toISOString();
    const profile: FhirProfile = {
      ...params,
      id: generateId("profile"),
      createdAt: now,
      updatedAt: now
    };

    profiles.set(profile.id, profile);

    auditLog("PROFILE_CREATED", "FhirProfile", profile.id, userId,
      `Created profile: ${profile.name} (${profile.profileType})`);

    return profile;
  }

  updateProfile(profileId: string, updates: Partial<FhirProfile>, userId: string): FhirProfile | null {
    const profile = profiles.get(profileId);
    if (!profile) return null;

    const updated = {
      ...profile,
      ...updates,
      id: profile.id,
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString()
    };

    profiles.set(profileId, updated);

    auditLog("PROFILE_UPDATED", "FhirProfile", profileId, userId,
      `Updated profile: ${updated.name}`);

    return updated;
  }

  deleteProfile(profileId: string, userId: string): boolean {
    const profile = profiles.get(profileId);
    if (!profile) return false;

    profiles.delete(profileId);

    auditLog("PROFILE_DELETED", "FhirProfile", profileId, userId,
      `Deleted profile: ${profile.name}`);

    return true;
  }

  getValidationReports(params?: {
    resourceType?: string;
    result?: ValidationResult;
    fromDate?: string;
    limit?: number;
  }): ValidationReport[] {
    let reports = Array.from(validationReports.values());

    if (params?.resourceType) {
      reports = reports.filter(r => r.resourceType === params.resourceType);
    }
    if (params?.result) {
      reports = reports.filter(r => r.result === params.result);
    }
    if (params?.fromDate) {
      const fromTime = new Date(params.fromDate).getTime();
      reports = reports.filter(r => new Date(r.validatedAt).getTime() >= fromTime);
    }

    reports.sort((a, b) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime());

    return reports.slice(0, params?.limit || 100);
  }

  getValidationReport(reportId: string): ValidationReport | null {
    return validationReports.get(reportId) || null;
  }

  getValidationConfigs(): ProfileValidationConfig[] {
    return Array.from(validationConfigs.values());
  }

  getValidationConfig(configId: string): ProfileValidationConfig | null {
    return validationConfigs.get(configId) || null;
  }

  createValidationConfig(params: Omit<ProfileValidationConfig, "id" | "createdAt" | "updatedAt">, userId: string): ProfileValidationConfig {
    const now = new Date().toISOString();
    const config: ProfileValidationConfig = {
      ...params,
      id: generateId("config"),
      createdAt: now,
      updatedAt: now
    };

    validationConfigs.set(config.id, config);

    auditLog("CONFIG_CREATED", "ProfileValidationConfig", config.id, userId,
      `Created validation config: ${config.name}`);

    return config;
  }

  updateValidationConfig(configId: string, updates: Partial<ProfileValidationConfig>, userId: string): ProfileValidationConfig | null {
    const config = validationConfigs.get(configId);
    if (!config) return null;

    const updated = {
      ...config,
      ...updates,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: new Date().toISOString()
    };

    validationConfigs.set(configId, updated);

    auditLog("CONFIG_UPDATED", "ProfileValidationConfig", configId, userId,
      `Updated validation config: ${updated.name}`);

    return updated;
  }

  getValidationStats(): {
    totalValidations: number;
    validCount: number;
    invalidCount: number;
    warningsOnlyCount: number;
    profileCoverage: Record<string, number>;
    recentTrend: { date: string; valid: number; invalid: number }[];
  } {
    const reports = Array.from(validationReports.values());

    const profileCoverage: Record<string, number> = {};
    reports.forEach(r => {
      r.profilesValidated.forEach(p => {
        profileCoverage[p] = (profileCoverage[p] || 0) + 1;
      });
    });

    const last7Days: { date: string; valid: number; invalid: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayReports = reports.filter(r => r.validatedAt.startsWith(dateStr));
      last7Days.push({
        date: dateStr,
        valid: dayReports.filter(r => r.result === "VALID").length,
        invalid: dayReports.filter(r => r.result === "INVALID").length
      });
    }

    return {
      totalValidations: reports.length,
      validCount: reports.filter(r => r.result === "VALID").length,
      invalidCount: reports.filter(r => r.result === "INVALID").length,
      warningsOnlyCount: reports.filter(r => r.result === "WARNINGS_ONLY").length,
      profileCoverage,
      recentTrend: last7Days
    };
  }

  batchValidate(resources: any[], profileIds?: string[], userId: string = "system"): {
    summary: { total: number; valid: number; invalid: number; warningsOnly: number };
    reports: ValidationReport[];
  } {
    const reports = resources.map(r => this.validateResource(r, profileIds, userId));

    return {
      summary: {
        total: reports.length,
        valid: reports.filter(r => r.result === "VALID").length,
        invalid: reports.filter(r => r.result === "INVALID").length,
        warningsOnly: reports.filter(r => r.result === "WARNINGS_ONLY").length
      },
      reports
    };
  }
}

export const fhirProfileValidationService = new FhirProfileValidationService();

console.log("[FHIRProfileValidation] Service initialized");
console.log("[FHIRProfileValidation] Profiles loaded:", profiles.size);
console.log("[FHIRProfileValidation] Supported profile types: US_CORE, ARGONAUT, CARIN_BB, MCODE, CUSTOM");
