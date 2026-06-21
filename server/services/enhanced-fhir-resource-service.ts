import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type FHIRResourceType = 
  | "Patient" | "Condition" | "Medication" | "MedicationRequest"
  | "AllergyIntolerance" | "Immunization" | "Procedure"
  | "Observation" | "DiagnosticReport" | "Encounter"
  | "CarePlan" | "CareTeam" | "Goal" | "ServiceRequest";

export interface FHIRProfile {
  id: string;
  name: string;
  resourceType: FHIRResourceType;
  version: "R4" | "R5";
  url: string;
  description: string;
  requiredFields: string[];
  recommendedFields: string[];
  validationRules: ValidationRule[];
  codeSystemBindings: CodeSystemBinding[];
  isActive: boolean;
}

export interface ValidationRule {
  id: string;
  field: string;
  ruleType: "required" | "format" | "code_binding" | "cardinality" | "reference" | "conditional" | "regex" | "custom";
  condition?: string;
  expectedValue?: string | string[];
  minCardinality?: number;
  maxCardinality?: number;
  errorMessage: string;
  severity: "error" | "warning" | "info";
}

export interface CodeSystemBinding {
  field: string;
  codeSystem: string;
  valueSet?: string;
  strength: "required" | "extensible" | "preferred" | "example";
  allowedCodes?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  resourceType: FHIRResourceType;
  resourceId: string;
  profilesChecked: string[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  completenessScore: number;
  qualityScore: number;
  validatedAt: string;
}

export interface ValidationIssue {
  field: string;
  ruleId: string;
  message: string;
  actualValue?: any;
  expectedValue?: any;
  suggestion?: string;
}

export interface SyncConfiguration {
  id: string;
  serverId: string;
  serverName: string;
  resourceConfigs: ResourceSyncConfig[];
  syncSchedule: "realtime" | "hourly" | "daily" | "weekly" | "manual";
  lastSyncAt?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceSyncConfig {
  resourceType: FHIRResourceType;
  enabled: boolean;
  direction: "inbound" | "outbound" | "bidirectional";
  profileId?: string;
  filterCriteria?: Record<string, string>;
  conflictResolution: "local_wins" | "remote_wins" | "newest_wins" | "manual";
  autoValidate: boolean;
  lastSyncCount?: number;
  lastSyncAt?: string;
}

export interface FHIRResource {
  resourceType: FHIRResourceType;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: any;
}

export interface SyncJob {
  id: string;
  configId: string;
  resourceType: FHIRResourceType;
  direction: "inbound" | "outbound";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

const NO_CDS_DISCLAIMER = "For informational purposes only. Not clinical decision support.";

function logHIPAAAudit(action: string, details: Record<string, any>) {
  console.log(`[HIPAA-AUDIT][ENHANCED-FHIR] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    details,
    noCdsCompliance: NO_CDS_DISCLAIMER,
  })}`);
}

class EnhancedFHIRResourceService {
  private profiles: Map<string, FHIRProfile> = new Map();
  private syncConfigs: Map<string, SyncConfiguration> = new Map();
  private resources: Map<string, FHIRResource[]> = new Map();
  private syncJobs: Map<string, SyncJob> = new Map();

  constructor() {
    this.initializeProfiles();
    this.initializeSyncConfigs();
    this.initializeSampleResources();
  }

  private initializeProfiles() {
    const baseProfiles: Omit<FHIRProfile, "id">[] = [
      {
        name: "US Core Patient",
        resourceType: "Patient",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        description: "US Core Patient Profile for USCDI compliance",
        requiredFields: ["identifier", "name", "gender", "birthDate"],
        recommendedFields: ["address", "telecom", "communication", "race", "ethnicity"],
        validationRules: [
          { id: "pat-1", field: "identifier", ruleType: "required", errorMessage: "Patient must have at least one identifier", severity: "error" },
          { id: "pat-2", field: "name", ruleType: "required", errorMessage: "Patient must have at least one name", severity: "error" },
          { id: "pat-3", field: "gender", ruleType: "code_binding", expectedValue: ["male", "female", "other", "unknown"], errorMessage: "Gender must be a valid code", severity: "error" },
          { id: "pat-4", field: "birthDate", ruleType: "format", expectedValue: "date", errorMessage: "Birth date must be a valid date", severity: "error" },
        ],
        codeSystemBindings: [
          { field: "gender", codeSystem: "http://hl7.org/fhir/administrative-gender", strength: "required" },
          { field: "maritalStatus", codeSystem: "http://hl7.org/fhir/ValueSet/marital-status", strength: "extensible" },
        ],
        isActive: true,
      },
      {
        name: "US Core AllergyIntolerance",
        resourceType: "AllergyIntolerance",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
        description: "US Core AllergyIntolerance Profile",
        requiredFields: ["clinicalStatus", "code", "patient"],
        recommendedFields: ["verificationStatus", "category", "criticality", "reaction"],
        validationRules: [
          { id: "allergy-1", field: "clinicalStatus", ruleType: "required", errorMessage: "Clinical status is required", severity: "error" },
          { id: "allergy-2", field: "code", ruleType: "required", errorMessage: "Allergy code is required", severity: "error" },
          { id: "allergy-3", field: "patient", ruleType: "reference", expectedValue: "Patient", errorMessage: "Patient reference is required", severity: "error" },
          { id: "allergy-4", field: "category", ruleType: "code_binding", expectedValue: ["food", "medication", "environment", "biologic"], errorMessage: "Invalid category", severity: "warning" },
          { id: "allergy-5", field: "criticality", ruleType: "code_binding", expectedValue: ["low", "high", "unable-to-assess"], errorMessage: "Invalid criticality", severity: "warning" },
        ],
        codeSystemBindings: [
          { field: "clinicalStatus", codeSystem: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", strength: "required" },
          { field: "verificationStatus", codeSystem: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", strength: "required" },
        ],
        isActive: true,
      },
      {
        name: "US Core Immunization",
        resourceType: "Immunization",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
        description: "US Core Immunization Profile",
        requiredFields: ["status", "vaccineCode", "patient", "occurrenceDateTime"],
        recommendedFields: ["primarySource", "manufacturer", "lotNumber", "site", "route", "doseQuantity"],
        validationRules: [
          { id: "imm-1", field: "status", ruleType: "required", errorMessage: "Immunization status is required", severity: "error" },
          { id: "imm-2", field: "vaccineCode", ruleType: "required", errorMessage: "Vaccine code is required", severity: "error" },
          { id: "imm-3", field: "patient", ruleType: "reference", expectedValue: "Patient", errorMessage: "Patient reference is required", severity: "error" },
          { id: "imm-4", field: "occurrenceDateTime", ruleType: "format", expectedValue: "dateTime", errorMessage: "Occurrence date/time is required", severity: "error" },
          { id: "imm-5", field: "status", ruleType: "code_binding", expectedValue: ["completed", "entered-in-error", "not-done"], errorMessage: "Invalid status", severity: "error" },
        ],
        codeSystemBindings: [
          { field: "vaccineCode", codeSystem: "http://hl7.org/fhir/sid/cvx", strength: "extensible" },
          { field: "status", codeSystem: "http://hl7.org/fhir/event-status", strength: "required" },
        ],
        isActive: true,
      },
      {
        name: "US Core Procedure",
        resourceType: "Procedure",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
        description: "US Core Procedure Profile",
        requiredFields: ["status", "code", "subject", "performedDateTime"],
        recommendedFields: ["performer", "location", "reasonCode", "bodySite", "outcome"],
        validationRules: [
          { id: "proc-1", field: "status", ruleType: "required", errorMessage: "Procedure status is required", severity: "error" },
          { id: "proc-2", field: "code", ruleType: "required", errorMessage: "Procedure code is required", severity: "error" },
          { id: "proc-3", field: "subject", ruleType: "reference", expectedValue: "Patient", errorMessage: "Subject reference is required", severity: "error" },
          { id: "proc-4", field: "status", ruleType: "code_binding", expectedValue: ["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"], errorMessage: "Invalid status", severity: "error" },
        ],
        codeSystemBindings: [
          { field: "code", codeSystem: "http://www.ama-assn.org/go/cpt", strength: "extensible" },
          { field: "status", codeSystem: "http://hl7.org/fhir/event-status", strength: "required" },
        ],
        isActive: true,
      },
      {
        name: "US Core Condition",
        resourceType: "Condition",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
        description: "US Core Condition Profile for problems, diagnoses, health concerns",
        requiredFields: ["clinicalStatus", "category", "code", "subject"],
        recommendedFields: ["verificationStatus", "severity", "onsetDateTime", "abatementDateTime"],
        validationRules: [
          { id: "cond-1", field: "clinicalStatus", ruleType: "required", errorMessage: "Clinical status is required", severity: "error" },
          { id: "cond-2", field: "category", ruleType: "required", errorMessage: "Category is required", severity: "error" },
          { id: "cond-3", field: "code", ruleType: "required", errorMessage: "Condition code is required", severity: "error" },
          { id: "cond-4", field: "subject", ruleType: "reference", expectedValue: "Patient", errorMessage: "Subject reference is required", severity: "error" },
        ],
        codeSystemBindings: [
          { field: "clinicalStatus", codeSystem: "http://terminology.hl7.org/CodeSystem/condition-clinical", strength: "required" },
          { field: "code", codeSystem: "http://snomed.info/sct", strength: "extensible" },
        ],
        isActive: true,
      },
      {
        name: "US Core MedicationRequest",
        resourceType: "MedicationRequest",
        version: "R4",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
        description: "US Core MedicationRequest Profile",
        requiredFields: ["status", "intent", "medicationCodeableConcept", "subject", "authoredOn", "requester"],
        recommendedFields: ["dosageInstruction", "dispenseRequest", "reasonCode"],
        validationRules: [
          { id: "medreq-1", field: "status", ruleType: "required", errorMessage: "Status is required", severity: "error" },
          { id: "medreq-2", field: "intent", ruleType: "required", errorMessage: "Intent is required", severity: "error" },
          { id: "medreq-3", field: "subject", ruleType: "reference", expectedValue: "Patient", errorMessage: "Subject reference is required", severity: "error" },
        ],
        codeSystemBindings: [
          { field: "status", codeSystem: "http://hl7.org/fhir/CodeSystem/medicationrequest-status", strength: "required" },
          { field: "intent", codeSystem: "http://hl7.org/fhir/CodeSystem/medicationrequest-intent", strength: "required" },
        ],
        isActive: true,
      },
    ];

    baseProfiles.forEach((profile, index) => {
      const id = `profile-${profile.resourceType.toLowerCase()}-uscore`;
      this.profiles.set(id, { ...profile, id });
    });
  }

  private initializeSyncConfigs() {
    const configs: SyncConfiguration[] = [
      {
        id: "sync-config-epic",
        serverId: "server-epic",
        serverName: "Primary Care Provider",
        resourceConfigs: [
          { resourceType: "Patient", enabled: true, direction: "bidirectional", profileId: "profile-patient-uscore", conflictResolution: "newest_wins", autoValidate: true },
          { resourceType: "Condition", enabled: true, direction: "bidirectional", profileId: "profile-condition-uscore", conflictResolution: "manual", autoValidate: true },
          { resourceType: "MedicationRequest", enabled: true, direction: "bidirectional", profileId: "profile-medicationrequest-uscore", conflictResolution: "manual", autoValidate: true },
          { resourceType: "AllergyIntolerance", enabled: true, direction: "inbound", profileId: "profile-allergyintolerance-uscore", conflictResolution: "remote_wins", autoValidate: true },
          { resourceType: "Immunization", enabled: true, direction: "inbound", profileId: "profile-immunization-uscore", conflictResolution: "remote_wins", autoValidate: true },
          { resourceType: "Procedure", enabled: false, direction: "inbound", profileId: "profile-procedure-uscore", conflictResolution: "remote_wins", autoValidate: true },
        ],
        syncSchedule: "hourly",
        lastSyncAt: "2026-01-31T10:00:00Z",
        isEnabled: true,
        createdAt: "2025-06-01T00:00:00Z",
        updatedAt: "2026-01-31T10:00:00Z",
      },
      {
        id: "sync-config-cerner",
        serverId: "server-cerner",
        serverName: "Hospital Network",
        resourceConfigs: [
          { resourceType: "Patient", enabled: true, direction: "bidirectional", conflictResolution: "newest_wins", autoValidate: true },
          { resourceType: "Condition", enabled: true, direction: "bidirectional", conflictResolution: "newest_wins", autoValidate: true },
          { resourceType: "AllergyIntolerance", enabled: true, direction: "bidirectional", conflictResolution: "manual", autoValidate: true },
          { resourceType: "Immunization", enabled: true, direction: "bidirectional", conflictResolution: "manual", autoValidate: true },
          { resourceType: "Procedure", enabled: true, direction: "bidirectional", conflictResolution: "manual", autoValidate: true },
        ],
        syncSchedule: "daily",
        lastSyncAt: "2026-01-30T02:00:00Z",
        isEnabled: true,
        createdAt: "2025-07-15T00:00:00Z",
        updatedAt: "2026-01-30T02:00:00Z",
      },
    ];

    configs.forEach(config => this.syncConfigs.set(config.id, config));
  }

  private initializeSampleResources() {
    const allergies: FHIRResource[] = [
      {
        resourceType: "AllergyIntolerance",
        id: "allergy-001",
        meta: { lastUpdated: "2026-01-15T08:30:00Z", profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"] },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active", display: "Active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "confirmed", display: "Confirmed" }] },
        category: ["medication"],
        criticality: "high",
        code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "7980", display: "Penicillin" }], text: "Penicillin" },
        patient: { reference: "Patient/patient-12345", display: "John Smith" },
        recordedDate: "2019-05-15",
        reaction: [{ manifestation: [{ coding: [{ system: "http://snomed.info/sct", code: "39579001", display: "Anaphylaxis" }] }], severity: "severe" }],
      },
      {
        resourceType: "AllergyIntolerance",
        id: "allergy-002",
        meta: { lastUpdated: "2026-01-10T14:20:00Z" },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
        category: ["food"],
        criticality: "low",
        code: { coding: [{ system: "http://snomed.info/sct", code: "91935009", display: "Peanut allergy" }], text: "Peanuts" },
        patient: { reference: "Patient/patient-12345" },
        recordedDate: "2020-02-20",
        reaction: [{ manifestation: [{ coding: [{ system: "http://snomed.info/sct", code: "247472004", display: "Hives" }] }], severity: "mild" }],
      },
    ];

    const immunizations: FHIRResource[] = [
      {
        resourceType: "Immunization",
        id: "imm-001",
        meta: { lastUpdated: "2025-10-15T10:00:00Z", profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"] },
        status: "completed",
        vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "197", display: "Influenza, high-dose quadrivalent" }], text: "Flu Shot (High-Dose)" },
        patient: { reference: "Patient/patient-12345", display: "John Smith" },
        occurrenceDateTime: "2025-10-15",
        primarySource: true,
        location: { reference: "Location/loc-001", display: "Downtown Medical Center" },
        manufacturer: { display: "Sanofi Pasteur" },
        lotNumber: "FL2025-4521",
        performer: [{ actor: { reference: "Practitioner/pract-001", display: "Nurse Johnson" } }],
      },
      {
        resourceType: "Immunization",
        id: "imm-002",
        meta: { lastUpdated: "2024-06-20T14:30:00Z" },
        status: "completed",
        vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "208", display: "COVID-19 mRNA, bivalent" }], text: "COVID-19 Vaccine (Bivalent)" },
        patient: { reference: "Patient/patient-12345" },
        occurrenceDateTime: "2024-06-20",
        primarySource: true,
        manufacturer: { display: "Pfizer-BioNTech" },
        lotNumber: "PF2024-9872",
      },
      {
        resourceType: "Immunization",
        id: "imm-003",
        meta: { lastUpdated: "2023-08-10T09:15:00Z" },
        status: "completed",
        vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "121", display: "Zoster, recombinant" }], text: "Shingrix (Shingles)" },
        patient: { reference: "Patient/patient-12345" },
        occurrenceDateTime: "2023-08-10",
        primarySource: true,
      },
    ];

    const procedures: FHIRResource[] = [
      {
        resourceType: "Procedure",
        id: "proc-001",
        meta: { lastUpdated: "2025-11-20T16:00:00Z", profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure"] },
        status: "completed",
        code: { coding: [{ system: "http://www.ama-assn.org/go/cpt", code: "45378", display: "Colonoscopy" }], text: "Colonoscopy, diagnostic" },
        subject: { reference: "Patient/patient-12345", display: "John Smith" },
        performedDateTime: "2025-11-20",
        performer: [{ actor: { reference: "Practitioner/pract-002", display: "Dr. Martinez" } }],
        location: { reference: "Location/loc-002", display: "Endoscopy Center" },
        outcome: { coding: [{ system: "http://snomed.info/sct", code: "385669000", display: "Successful" }], text: "Normal - no polyps found" },
      },
      {
        resourceType: "Procedure",
        id: "proc-002",
        meta: { lastUpdated: "2024-03-15T11:30:00Z" },
        status: "completed",
        code: { coding: [{ system: "http://www.ama-assn.org/go/cpt", code: "99213", display: "Office visit, established patient" }], text: "Annual Physical Exam" },
        subject: { reference: "Patient/patient-12345" },
        performedDateTime: "2024-03-15",
        performer: [{ actor: { reference: "Practitioner/pract-003", display: "Dr. Sarah Chen" } }],
      },
    ];

    this.resources.set("AllergyIntolerance", allergies);
    this.resources.set("Immunization", immunizations);
    this.resources.set("Procedure", procedures);
  }

  getProfiles(): FHIRProfile[] {
    return Array.from(this.profiles.values());
  }

  getProfile(id: string): FHIRProfile | undefined {
    return this.profiles.get(id);
  }

  getProfilesByResourceType(resourceType: FHIRResourceType): FHIRProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.resourceType === resourceType);
  }

  getSyncConfigurations(): SyncConfiguration[] {
    return Array.from(this.syncConfigs.values());
  }

  getSyncConfiguration(id: string): SyncConfiguration | undefined {
    return this.syncConfigs.get(id);
  }

  updateSyncConfiguration(id: string, updates: Partial<SyncConfiguration>): SyncConfiguration | null {
    const config = this.syncConfigs.get(id);
    if (!config) return null;

    const updated = { ...config, ...updates, updatedAt: new Date().toISOString() };
    this.syncConfigs.set(id, updated);

    logHIPAAAudit("UPDATE_SYNC_CONFIGURATION", { configId: id, updates });
    return updated;
  }

  updateResourceSyncConfig(
    configId: string,
    resourceType: FHIRResourceType,
    updates: Partial<ResourceSyncConfig>
  ): SyncConfiguration | null {
    const config = this.syncConfigs.get(configId);
    if (!config) return null;

    const resourceIndex = config.resourceConfigs.findIndex(r => r.resourceType === resourceType);
    if (resourceIndex === -1) {
      config.resourceConfigs.push({
        resourceType,
        enabled: true,
        direction: "bidirectional",
        conflictResolution: "manual",
        autoValidate: true,
        ...updates,
      });
    } else {
      config.resourceConfigs[resourceIndex] = { ...config.resourceConfigs[resourceIndex], ...updates };
    }

    config.updatedAt = new Date().toISOString();
    this.syncConfigs.set(configId, config);

    logHIPAAAudit("UPDATE_RESOURCE_SYNC_CONFIG", { configId, resourceType, updates });
    return config;
  }

  validateResource(resource: FHIRResource, profileId?: string): ValidationResult {
    const resourceType = resource.resourceType;
    const profiles = profileId
      ? [this.profiles.get(profileId)].filter(Boolean) as FHIRProfile[]
      : this.getProfilesByResourceType(resourceType);

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    let requiredFieldsPresent = 0;
    let totalRequiredFields = 0;

    for (const profile of profiles) {
      for (const requiredField of profile.requiredFields) {
        totalRequiredFields++;
        const value = this.getNestedValue(resource, requiredField);
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          errors.push({
            field: requiredField,
            ruleId: `${profile.id}-req-${requiredField}`,
            message: `Required field '${requiredField}' is missing`,
            suggestion: `Add a value for ${requiredField}`,
          });
        } else {
          requiredFieldsPresent++;
        }
      }

      for (const rule of profile.validationRules) {
        const value = this.getNestedValue(resource, rule.field);
        const issue = this.checkValidationRule(rule, value, resource);
        if (issue) {
          if (rule.severity === "error") errors.push(issue);
          else if (rule.severity === "warning") warnings.push(issue);
          else info.push(issue);
        }
      }

      for (const recommendedField of profile.recommendedFields) {
        const value = this.getNestedValue(resource, recommendedField);
        if (value === undefined || value === null) {
          info.push({
            field: recommendedField,
            ruleId: `${profile.id}-rec-${recommendedField}`,
            message: `Recommended field '${recommendedField}' is not present`,
            suggestion: `Consider adding ${recommendedField} for better data quality`,
          });
        }
      }
    }

    const completenessScore = totalRequiredFields > 0 ? (requiredFieldsPresent / totalRequiredFields) * 100 : 100;
    const qualityScore = Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5));

    logHIPAAAudit("VALIDATE_RESOURCE", {
      resourceType,
      resourceId: resource.id,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      completenessScore,
      qualityScore,
    });

    return {
      isValid: errors.length === 0,
      resourceType,
      resourceId: resource.id,
      profilesChecked: profiles.map(p => p.id),
      errors,
      warnings,
      info,
      completenessScore,
      qualityScore,
      validatedAt: new Date().toISOString(),
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private checkValidationRule(rule: ValidationRule, value: any, resource: FHIRResource): ValidationIssue | null {
    switch (rule.ruleType) {
      case "required":
        if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
          return { field: rule.field, ruleId: rule.id, message: rule.errorMessage };
        }
        break;

      case "code_binding":
        if (value && rule.expectedValue) {
          const codeValue = typeof value === "object" ? value.coding?.[0]?.code || value.code : value;
          if (codeValue && Array.isArray(rule.expectedValue) && !rule.expectedValue.includes(codeValue)) {
            return {
              field: rule.field,
              ruleId: rule.id,
              message: rule.errorMessage,
              actualValue: codeValue,
              expectedValue: rule.expectedValue,
              suggestion: `Use one of: ${rule.expectedValue.join(", ")}`,
            };
          }
        }
        break;

      case "reference":
        if (value && rule.expectedValue) {
          const refValue = typeof value === "object" ? value.reference : value;
          if (refValue && !refValue.includes(rule.expectedValue as string)) {
            return {
              field: rule.field,
              ruleId: rule.id,
              message: rule.errorMessage,
              actualValue: refValue,
              expectedValue: rule.expectedValue,
            };
          }
        }
        break;

      case "format":
        if (value && rule.expectedValue === "date") {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) {
            return {
              field: rule.field,
              ruleId: rule.id,
              message: rule.errorMessage,
              actualValue: value,
              suggestion: "Use format YYYY-MM-DD",
            };
          }
        }
        break;

      case "cardinality":
        if (Array.isArray(value)) {
          if (rule.minCardinality !== undefined && value.length < rule.minCardinality) {
            return {
              field: rule.field,
              ruleId: rule.id,
              message: `${rule.field} must have at least ${rule.minCardinality} items`,
              actualValue: value.length,
              expectedValue: `>= ${rule.minCardinality}`,
            };
          }
          if (rule.maxCardinality !== undefined && value.length > rule.maxCardinality) {
            return {
              field: rule.field,
              ruleId: rule.id,
              message: `${rule.field} must have at most ${rule.maxCardinality} items`,
              actualValue: value.length,
              expectedValue: `<= ${rule.maxCardinality}`,
            };
          }
        }
        break;
    }

    return null;
  }

  getResources(resourceType: FHIRResourceType): FHIRResource[] {
    return this.resources.get(resourceType) || [];
  }

  getResource(resourceType: FHIRResourceType, id: string): FHIRResource | undefined {
    return this.resources.get(resourceType)?.find(r => r.id === id);
  }

  async startSyncJob(configId: string, resourceType: FHIRResourceType, direction: "inbound" | "outbound"): Promise<SyncJob> {
    const config = this.syncConfigs.get(configId);
    if (!config) {
      throw new Error("Sync configuration not found");
    }

    const resourceConfig = config.resourceConfigs.find(r => r.resourceType === resourceType);
    if (!resourceConfig || !resourceConfig.enabled) {
      throw new Error(`Resource type ${resourceType} is not enabled for sync`);
    }

    const job: SyncJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      configId,
      resourceType,
      direction,
      status: "running",
      progress: 0,
      totalRecords: Math.floor(Math.random() * 50) + 10,
      processedRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };

    this.syncJobs.set(job.id, job);

    logHIPAAAudit("START_SYNC_JOB", {
      jobId: job.id,
      configId,
      resourceType,
      direction,
    });

    this.simulateSyncProgress(job.id);

    return job;
  }

  private async simulateSyncProgress(jobId: string) {
    const job = this.syncJobs.get(jobId);
    if (!job) return;

    const interval = setInterval(() => {
      const currentJob = this.syncJobs.get(jobId);
      if (!currentJob || currentJob.status !== "running") {
        clearInterval(interval);
        return;
      }

      currentJob.processedRecords += Math.floor(Math.random() * 5) + 1;
      if (currentJob.processedRecords >= currentJob.totalRecords) {
        currentJob.processedRecords = currentJob.totalRecords;
        currentJob.status = "completed";
        currentJob.completedAt = new Date().toISOString();
        clearInterval(interval);
      }

      currentJob.validRecords = Math.floor(currentJob.processedRecords * 0.95);
      currentJob.invalidRecords = currentJob.processedRecords - currentJob.validRecords;
      currentJob.progress = Math.round((currentJob.processedRecords / currentJob.totalRecords) * 100);

      this.syncJobs.set(jobId, currentJob);
    }, 500);
  }

  getSyncJob(jobId: string): SyncJob | undefined {
    return this.syncJobs.get(jobId);
  }

  getSyncJobs(): SyncJob[] {
    return Array.from(this.syncJobs.values()).sort((a, b) =>
      new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime()
    );
  }

  cancelSyncJob(jobId: string): boolean {
    const job = this.syncJobs.get(jobId);
    if (!job || job.status !== "running") return false;

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    this.syncJobs.set(jobId, job);

    logHIPAAAudit("CANCEL_SYNC_JOB", { jobId });
    return true;
  }

  async getAIValidationSuggestions(resource: FHIRResource): Promise<{ suggestions: string[]; disclaimer: string }> {
    try {
      const validationResult = this.validateResource(resource);

      const prompt = `Analyze this FHIR ${resource.resourceType} resource and its validation results. Provide suggestions to improve data quality.

Resource: ${JSON.stringify(resource, null, 2)}

Validation Issues:
- Errors: ${validationResult.errors.map(e => `${e.field}: ${e.message}`).join("; ") || "None"}
- Warnings: ${validationResult.warnings.map(w => `${w.field}: ${w.message}`).join("; ") || "None"}
- Info: ${validationResult.info.map(i => `${i.field}: ${i.message}`).join("; ") || "None"}

Provide 3-5 specific, actionable suggestions to improve this resource's data quality and FHIR compliance. Format as a JSON object with a "suggestions" array.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a FHIR data quality expert. Provide practical suggestions to improve healthcare data quality and interoperability." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const aiResponse = JSON.parse(response.choices[0]?.message?.content || '{"suggestions":[]}');

      return {
        suggestions: aiResponse.suggestions || [],
        disclaimer: NO_CDS_DISCLAIMER,
      };
    } catch (error) {
      console.error("Error getting AI validation suggestions:", error);
      return {
        suggestions: ["Unable to generate AI suggestions at this time"],
        disclaimer: NO_CDS_DISCLAIMER,
      };
    }
  }

  getSupportedResourceTypes(): FHIRResourceType[] {
    return [
      "Patient", "Condition", "Medication", "MedicationRequest",
      "AllergyIntolerance", "Immunization", "Procedure",
      "Observation", "DiagnosticReport", "Encounter",
      "CarePlan", "CareTeam", "Goal", "ServiceRequest"
    ];
  }

  getDashboardStats() {
    const allConfigs = Array.from(this.syncConfigs.values());
    const allJobs = Array.from(this.syncJobs.values());
    const allProfiles = Array.from(this.profiles.values());

    const enabledResourceTypes = new Set<FHIRResourceType>();
    allConfigs.forEach(config => {
      config.resourceConfigs.filter(r => r.enabled).forEach(r => enabledResourceTypes.add(r.resourceType));
    });

    return {
      totalProfiles: allProfiles.length,
      activeProfiles: allProfiles.filter(p => p.isActive).length,
      syncConfigurations: allConfigs.length,
      enabledResourceTypes: Array.from(enabledResourceTypes),
      recentSyncJobs: allJobs.slice(0, 5),
      resourceCounts: {
        AllergyIntolerance: this.resources.get("AllergyIntolerance")?.length || 0,
        Immunization: this.resources.get("Immunization")?.length || 0,
        Procedure: this.resources.get("Procedure")?.length || 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const enhancedFHIRResourceService = new EnhancedFHIRResourceService();
