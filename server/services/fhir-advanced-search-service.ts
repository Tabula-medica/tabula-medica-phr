// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

export type SearchOperator = "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "contains" | "exact" | "starts" | "ends" | "fuzzy" | "in" | "not-in" | "missing";
export type SearchModifier = "exact" | "contains" | "text" | "above" | "below" | "not" | "type" | "identifier" | "ofType";

export interface SearchParameter {
  id: string;
  name: string;
  type: "string" | "token" | "reference" | "date" | "number" | "quantity" | "uri" | "composite";
  description: string;
  resourceTypes: string[];
  modifiers?: SearchModifier[];
  comparators?: SearchOperator[];
  target?: string[];
  expression?: string;
}

export interface SearchCondition {
  id: string;
  parameter: string;
  operator: SearchOperator;
  value: string;
  modifier?: SearchModifier;
  valueType?: string;
}

export interface SearchQuery {
  id: string;
  name?: string;
  resourceType: string;
  conditions: SearchCondition[];
  includeRelated?: string[];
  revIncludeRelated?: string[];
  sort?: { field: string; order: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
  fuzzyThreshold?: number;
}

export interface SearchResult {
  resourceType: string;
  id: string;
  data: Record<string, unknown>;
  score?: number;
  matchedFields?: string[];
  relatedResources?: Record<string, unknown>[];
}

export interface SearchResponse {
  query: SearchQuery;
  total: number;
  results: SearchResult[];
  facets?: Record<string, { value: string; count: number }[]>;
  executionTimeMs: number;
  suggestions?: SearchSuggestion[];
}

export interface SearchSuggestion {
  id: string;
  type: "parameter" | "value" | "refinement" | "related";
  suggestion: string;
  description: string;
  confidence: number;
  example?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  createdBy: string;
  createdAt: string;
  usageCount: number;
  isPublic: boolean;
}

class FHIRAdvancedSearchService {
  private openai: OpenAI | null = null;
  private searchParameters: Map<string, SearchParameter[]> = new Map();
  private savedQueries: Map<string, SavedQuery> = new Map();
  private sampleData: Map<string, Record<string, unknown>[]> = new Map();

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    this.initializeSearchParameters();
    if (process.env.NODE_ENV !== 'production') {
      this.initializeSampleData();
      this.initializeSavedQueries();
    }
  }

  private initializeSearchParameters(): void {
    const patientParams: SearchParameter[] = [
      { id: "patient-id", name: "_id", type: "token", description: "Logical ID of the resource", resourceTypes: ["Patient"], comparators: ["eq", "ne"] },
      { id: "patient-identifier", name: "identifier", type: "token", description: "Patient identifier (MRN, SSN, etc.)", resourceTypes: ["Patient"], modifiers: ["exact", "contains"] },
      { id: "patient-name", name: "name", type: "string", description: "Patient name (family, given, or full)", resourceTypes: ["Patient"], modifiers: ["exact", "contains", "text"], comparators: ["eq", "contains", "fuzzy", "starts", "ends"] },
      { id: "patient-family", name: "family", type: "string", description: "Patient family/last name", resourceTypes: ["Patient"], modifiers: ["exact", "contains"], comparators: ["eq", "contains", "fuzzy", "starts"] },
      { id: "patient-given", name: "given", type: "string", description: "Patient given/first name", resourceTypes: ["Patient"], modifiers: ["exact", "contains"], comparators: ["eq", "contains", "fuzzy", "starts"] },
      { id: "patient-birthdate", name: "birthdate", type: "date", description: "Patient date of birth", resourceTypes: ["Patient"], comparators: ["eq", "ne", "lt", "le", "gt", "ge"] },
      { id: "patient-gender", name: "gender", type: "token", description: "Patient gender (male, female, other, unknown)", resourceTypes: ["Patient"], comparators: ["eq", "ne", "in"] },
      { id: "patient-address", name: "address", type: "string", description: "Patient address", resourceTypes: ["Patient"], modifiers: ["contains", "exact"], comparators: ["eq", "contains", "fuzzy"] },
      { id: "patient-address-city", name: "address-city", type: "string", description: "City in patient address", resourceTypes: ["Patient"], comparators: ["eq", "contains", "fuzzy"] },
      { id: "patient-address-state", name: "address-state", type: "string", description: "State in patient address", resourceTypes: ["Patient"], comparators: ["eq", "in"] },
      { id: "patient-address-postalcode", name: "address-postalcode", type: "string", description: "Postal code in patient address", resourceTypes: ["Patient"], comparators: ["eq", "starts"] },
      { id: "patient-phone", name: "phone", type: "token", description: "Patient phone number", resourceTypes: ["Patient"], comparators: ["eq", "contains"] },
      { id: "patient-email", name: "email", type: "token", description: "Patient email address", resourceTypes: ["Patient"], comparators: ["eq", "contains"] },
      { id: "patient-active", name: "active", type: "token", description: "Whether patient record is active", resourceTypes: ["Patient"], comparators: ["eq"] },
      { id: "patient-deceased", name: "deceased", type: "token", description: "Whether patient is deceased", resourceTypes: ["Patient"], comparators: ["eq"] },
      { id: "patient-language", name: "language", type: "token", description: "Patient preferred language", resourceTypes: ["Patient"], comparators: ["eq", "in"] },
      { id: "patient-organization", name: "organization", type: "reference", description: "Managing organization", resourceTypes: ["Patient"], target: ["Organization"] },
      { id: "patient-general-practitioner", name: "general-practitioner", type: "reference", description: "Patient's primary care provider", resourceTypes: ["Patient"], target: ["Practitioner", "PractitionerRole", "Organization"] },
    ];

    const observationParams: SearchParameter[] = [
      { id: "obs-id", name: "_id", type: "token", description: "Logical ID of the observation", resourceTypes: ["Observation"], comparators: ["eq", "ne"] },
      { id: "obs-patient", name: "patient", type: "reference", description: "Patient subject of observation", resourceTypes: ["Observation"], target: ["Patient"] },
      { id: "obs-subject", name: "subject", type: "reference", description: "Subject of observation", resourceTypes: ["Observation"], target: ["Patient", "Group", "Device", "Location"] },
      { id: "obs-code", name: "code", type: "token", description: "Observation code (LOINC, SNOMED)", resourceTypes: ["Observation"], modifiers: ["text", "not"], comparators: ["eq", "in", "not-in"] },
      { id: "obs-category", name: "category", type: "token", description: "Observation category (vital-signs, laboratory, etc.)", resourceTypes: ["Observation"], comparators: ["eq", "in"] },
      { id: "obs-date", name: "date", type: "date", description: "Observation effective date/time", resourceTypes: ["Observation"], comparators: ["eq", "ne", "lt", "le", "gt", "ge"] },
      { id: "obs-status", name: "status", type: "token", description: "Observation status", resourceTypes: ["Observation"], comparators: ["eq", "in"] },
      { id: "obs-value-quantity", name: "value-quantity", type: "quantity", description: "Numeric observation value", resourceTypes: ["Observation"], comparators: ["eq", "ne", "lt", "le", "gt", "ge"] },
      { id: "obs-value-string", name: "value-string", type: "string", description: "Text observation value", resourceTypes: ["Observation"], comparators: ["eq", "contains", "fuzzy"] },
      { id: "obs-value-concept", name: "value-concept", type: "token", description: "Coded observation value", resourceTypes: ["Observation"], comparators: ["eq", "in"] },
      { id: "obs-performer", name: "performer", type: "reference", description: "Who performed the observation", resourceTypes: ["Observation"], target: ["Practitioner", "Organization"] },
      { id: "obs-encounter", name: "encounter", type: "reference", description: "Associated encounter", resourceTypes: ["Observation"], target: ["Encounter"] },
      { id: "obs-component-code", name: "component-code", type: "token", description: "Component observation code", resourceTypes: ["Observation"], comparators: ["eq", "in"] },
      { id: "obs-component-value", name: "component-value-quantity", type: "quantity", description: "Component numeric value", resourceTypes: ["Observation"], comparators: ["eq", "lt", "le", "gt", "ge"] },
    ];

    const conditionParams: SearchParameter[] = [
      { id: "cond-id", name: "_id", type: "token", description: "Logical ID of the condition", resourceTypes: ["Condition"], comparators: ["eq", "ne"] },
      { id: "cond-patient", name: "patient", type: "reference", description: "Patient with condition", resourceTypes: ["Condition"], target: ["Patient"] },
      { id: "cond-subject", name: "subject", type: "reference", description: "Subject of condition", resourceTypes: ["Condition"], target: ["Patient", "Group"] },
      { id: "cond-code", name: "code", type: "token", description: "Condition code (ICD-10, SNOMED)", resourceTypes: ["Condition"], modifiers: ["text", "not"], comparators: ["eq", "in", "not-in"] },
      { id: "cond-clinical-status", name: "clinical-status", type: "token", description: "Clinical status (active, recurrence, etc.)", resourceTypes: ["Condition"], comparators: ["eq", "in"] },
      { id: "cond-verification-status", name: "verification-status", type: "token", description: "Verification status", resourceTypes: ["Condition"], comparators: ["eq", "in"] },
      { id: "cond-category", name: "category", type: "token", description: "Condition category", resourceTypes: ["Condition"], comparators: ["eq", "in"] },
      { id: "cond-severity", name: "severity", type: "token", description: "Condition severity", resourceTypes: ["Condition"], comparators: ["eq", "in"] },
      { id: "cond-onset-date", name: "onset-date", type: "date", description: "Date condition started", resourceTypes: ["Condition"], comparators: ["eq", "lt", "le", "gt", "ge"] },
      { id: "cond-abatement-date", name: "abatement-date", type: "date", description: "Date condition resolved", resourceTypes: ["Condition"], comparators: ["eq", "lt", "le", "gt", "ge"] },
      { id: "cond-recorded-date", name: "recorded-date", type: "date", description: "Date condition recorded", resourceTypes: ["Condition"], comparators: ["eq", "lt", "le", "gt", "ge"] },
      { id: "cond-encounter", name: "encounter", type: "reference", description: "Associated encounter", resourceTypes: ["Condition"], target: ["Encounter"] },
      { id: "cond-asserter", name: "asserter", type: "reference", description: "Who asserted the condition", resourceTypes: ["Condition"], target: ["Practitioner", "Patient"] },
    ];

    const medicationRequestParams: SearchParameter[] = [
      { id: "med-id", name: "_id", type: "token", description: "Logical ID", resourceTypes: ["MedicationRequest"], comparators: ["eq", "ne"] },
      { id: "med-patient", name: "patient", type: "reference", description: "Patient receiving medication", resourceTypes: ["MedicationRequest"], target: ["Patient"] },
      { id: "med-medication", name: "medication", type: "reference", description: "Medication reference", resourceTypes: ["MedicationRequest"], target: ["Medication"] },
      { id: "med-code", name: "code", type: "token", description: "Medication code (RxNorm, NDC)", resourceTypes: ["MedicationRequest"], modifiers: ["text"], comparators: ["eq", "in", "not-in"] },
      { id: "med-status", name: "status", type: "token", description: "Prescription status", resourceTypes: ["MedicationRequest"], comparators: ["eq", "in"] },
      { id: "med-intent", name: "intent", type: "token", description: "Prescription intent", resourceTypes: ["MedicationRequest"], comparators: ["eq", "in"] },
      { id: "med-authoredon", name: "authoredon", type: "date", description: "Date prescription written", resourceTypes: ["MedicationRequest"], comparators: ["eq", "lt", "le", "gt", "ge"] },
      { id: "med-requester", name: "requester", type: "reference", description: "Prescribing provider", resourceTypes: ["MedicationRequest"], target: ["Practitioner", "Organization"] },
      { id: "med-encounter", name: "encounter", type: "reference", description: "Associated encounter", resourceTypes: ["MedicationRequest"], target: ["Encounter"] },
      { id: "med-category", name: "category", type: "token", description: "Medication category", resourceTypes: ["MedicationRequest"], comparators: ["eq", "in"] },
      { id: "med-priority", name: "priority", type: "token", description: "Prescription priority", resourceTypes: ["MedicationRequest"], comparators: ["eq", "in"] },
    ];

    const encounterParams: SearchParameter[] = [
      { id: "enc-id", name: "_id", type: "token", description: "Logical ID", resourceTypes: ["Encounter"], comparators: ["eq", "ne"] },
      { id: "enc-patient", name: "patient", type: "reference", description: "Patient in encounter", resourceTypes: ["Encounter"], target: ["Patient"] },
      { id: "enc-subject", name: "subject", type: "reference", description: "Subject of encounter", resourceTypes: ["Encounter"], target: ["Patient", "Group"] },
      { id: "enc-status", name: "status", type: "token", description: "Encounter status", resourceTypes: ["Encounter"], comparators: ["eq", "in"] },
      { id: "enc-class", name: "class", type: "token", description: "Encounter class (ambulatory, inpatient, etc.)", resourceTypes: ["Encounter"], comparators: ["eq", "in"] },
      { id: "enc-type", name: "type", type: "token", description: "Encounter type", resourceTypes: ["Encounter"], modifiers: ["text"], comparators: ["eq", "in"] },
      { id: "enc-date", name: "date", type: "date", description: "Encounter start date", resourceTypes: ["Encounter"], comparators: ["eq", "lt", "le", "gt", "ge"] },
      { id: "enc-location", name: "location", type: "reference", description: "Encounter location", resourceTypes: ["Encounter"], target: ["Location"] },
      { id: "enc-participant", name: "participant", type: "reference", description: "Encounter participant", resourceTypes: ["Encounter"], target: ["Practitioner", "RelatedPerson"] },
      { id: "enc-reason-code", name: "reason-code", type: "token", description: "Reason for encounter", resourceTypes: ["Encounter"], modifiers: ["text"], comparators: ["eq", "in"] },
      { id: "enc-service-provider", name: "service-provider", type: "reference", description: "Service provider organization", resourceTypes: ["Encounter"], target: ["Organization"] },
      { id: "enc-length", name: "length", type: "quantity", description: "Encounter duration", resourceTypes: ["Encounter"], comparators: ["eq", "lt", "le", "gt", "ge"] },
    ];

    this.searchParameters.set("Patient", patientParams);
    this.searchParameters.set("Observation", observationParams);
    this.searchParameters.set("Condition", conditionParams);
    this.searchParameters.set("MedicationRequest", medicationRequestParams);
    this.searchParameters.set("Encounter", encounterParams);
  }

  private initializeSampleData(): void {
    const patients = [
      { id: "p-001", resourceType: "Patient", name: [{ family: "Smith", given: ["John", "Michael"] }], gender: "male", birthDate: "1965-03-15", address: [{ city: "Boston", state: "MA", postalCode: "02108" }], active: true },
      { id: "p-002", resourceType: "Patient", name: [{ family: "Johnson", given: ["Mary", "Elizabeth"] }], gender: "female", birthDate: "1978-07-22", address: [{ city: "Cambridge", state: "MA", postalCode: "02139" }], active: true },
      { id: "p-003", resourceType: "Patient", name: [{ family: "Davis", given: ["Robert"] }], gender: "male", birthDate: "1952-11-08", address: [{ city: "Newton", state: "MA", postalCode: "02458" }], active: true },
      { id: "p-004", resourceType: "Patient", name: [{ family: "Williams", given: ["Sarah", "Jane"] }], gender: "female", birthDate: "1990-01-30", address: [{ city: "Brookline", state: "MA", postalCode: "02445" }], active: true },
      { id: "p-005", resourceType: "Patient", name: [{ family: "Brown", given: ["James"] }], gender: "male", birthDate: "1945-06-12", address: [{ city: "Somerville", state: "MA", postalCode: "02143" }], active: false, deceasedBoolean: true },
      { id: "p-006", resourceType: "Patient", name: [{ family: "Miller", given: ["Jennifer", "Lynn"] }], gender: "female", birthDate: "1982-09-18", address: [{ city: "Worcester", state: "MA", postalCode: "01608" }], active: true },
      { id: "p-007", resourceType: "Patient", name: [{ family: "Garcia", given: ["Carlos"] }], gender: "male", birthDate: "1970-04-25", address: [{ city: "Springfield", state: "MA", postalCode: "01103" }], active: true },
      { id: "p-008", resourceType: "Patient", name: [{ family: "Martinez", given: ["Maria", "Rosa"] }], gender: "female", birthDate: "1988-12-05", address: [{ city: "Lowell", state: "MA", postalCode: "01852" }], active: true },
    ];

    const observations = [
      { id: "obs-001", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] }, subject: { reference: "Patient/p-001" }, effectiveDateTime: "2026-01-15T10:30:00Z", valueQuantity: { value: 72, unit: "beats/minute" } },
      { id: "obs-002", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] }, subject: { reference: "Patient/p-001" }, effectiveDateTime: "2026-01-15T10:30:00Z", valueQuantity: { value: 138, unit: "mmHg" } },
      { id: "obs-003", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] }, subject: { reference: "Patient/p-002" }, effectiveDateTime: "2026-01-10T08:00:00Z", valueQuantity: { value: 6.8, unit: "%" } },
      { id: "obs-004", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body weight" }] }, subject: { reference: "Patient/p-003" }, effectiveDateTime: "2026-01-20T09:15:00Z", valueQuantity: { value: 185, unit: "lbs" } },
      { id: "obs-005", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "2093-3", display: "Total cholesterol" }] }, subject: { reference: "Patient/p-001" }, effectiveDateTime: "2026-01-12T07:45:00Z", valueQuantity: { value: 215, unit: "mg/dL" } },
      { id: "obs-006", resourceType: "Observation", status: "final", category: [{ coding: [{ code: "vital-signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] }, subject: { reference: "Patient/p-004" }, effectiveDateTime: "2026-01-18T14:00:00Z", valueQuantity: { value: 68, unit: "beats/minute" } },
    ];

    const conditions = [
      { id: "cond-001", resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, verificationStatus: { coding: [{ code: "confirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }] }, subject: { reference: "Patient/p-001" }, onsetDateTime: "2020-05-15" },
      { id: "cond-002", resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, verificationStatus: { coding: [{ code: "confirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }] }, subject: { reference: "Patient/p-002" }, onsetDateTime: "2018-03-20" },
      { id: "cond-003", resourceType: "Condition", clinicalStatus: { coding: [{ code: "resolved" }] }, verificationStatus: { coding: [{ code: "confirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "195967001", display: "Asthma" }] }, subject: { reference: "Patient/p-004" }, onsetDateTime: "2015-08-10", abatementDateTime: "2022-06-01" },
      { id: "cond-004", resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, verificationStatus: { coding: [{ code: "confirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "13644009", display: "Hypercholesterolemia" }] }, subject: { reference: "Patient/p-001" }, onsetDateTime: "2021-01-10" },
      { id: "cond-005", resourceType: "Condition", clinicalStatus: { coding: [{ code: "active" }] }, verificationStatus: { coding: [{ code: "provisional" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "40930008", display: "Hypothyroidism" }] }, subject: { reference: "Patient/p-006" }, onsetDateTime: "2025-11-15" },
    ];

    const medicationRequests = [
      { id: "med-001", resourceType: "MedicationRequest", status: "active", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "314076", display: "Lisinopril 10 MG" }] }, subject: { reference: "Patient/p-001" }, authoredOn: "2026-01-05", requester: { reference: "Practitioner/dr-001" } },
      { id: "med-002", resourceType: "MedicationRequest", status: "active", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG" }] }, subject: { reference: "Patient/p-002" }, authoredOn: "2026-01-08", requester: { reference: "Practitioner/dr-002" } },
      { id: "med-003", resourceType: "MedicationRequest", status: "active", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Atorvastatin 20 MG" }] }, subject: { reference: "Patient/p-001" }, authoredOn: "2026-01-05", requester: { reference: "Practitioner/dr-001" } },
      { id: "med-004", resourceType: "MedicationRequest", status: "stopped", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "310965", display: "Albuterol 90 MCG" }] }, subject: { reference: "Patient/p-004" }, authoredOn: "2020-03-15", requester: { reference: "Practitioner/dr-003" } },
    ];

    const encounters = [
      { id: "enc-001", resourceType: "Encounter", status: "finished", class: { code: "AMB", display: "ambulatory" }, type: [{ coding: [{ code: "annual-wellness", display: "Annual Wellness Visit" }] }], subject: { reference: "Patient/p-001" }, period: { start: "2026-01-15T09:00:00Z", end: "2026-01-15T10:30:00Z" } },
      { id: "enc-002", resourceType: "Encounter", status: "finished", class: { code: "AMB", display: "ambulatory" }, type: [{ coding: [{ code: "follow-up", display: "Follow-up Visit" }] }], subject: { reference: "Patient/p-002" }, period: { start: "2026-01-10T14:00:00Z", end: "2026-01-10T14:45:00Z" } },
      { id: "enc-003", resourceType: "Encounter", status: "in-progress", class: { code: "IMP", display: "inpatient" }, type: [{ coding: [{ code: "emergency", display: "Emergency Visit" }] }], subject: { reference: "Patient/p-003" }, period: { start: "2026-01-28T03:30:00Z" } },
    ];

    this.sampleData.set("Patient", patients);
    this.sampleData.set("Observation", observations);
    this.sampleData.set("Condition", conditions);
    this.sampleData.set("MedicationRequest", medicationRequests);
    this.sampleData.set("Encounter", encounters);
  }

  private initializeSavedQueries(): void {
    const now = new Date().toISOString();
    const queries: SavedQuery[] = [
      {
        id: "saved-001",
        name: "Active Diabetic Patients",
        description: "Find all patients with active Type 2 diabetes",
        query: { id: "q-001", resourceType: "Condition", conditions: [{ id: "c-1", parameter: "code", operator: "contains", value: "diabetes" }, { id: "c-2", parameter: "clinical-status", operator: "eq", value: "active" }] },
        createdBy: "admin",
        createdAt: now,
        usageCount: 45,
        isPublic: true
      },
      {
        id: "saved-002",
        name: "Recent Lab Results",
        description: "Laboratory observations from the last 30 days",
        query: { id: "q-002", resourceType: "Observation", conditions: [{ id: "c-1", parameter: "category", operator: "eq", value: "laboratory" }, { id: "c-2", parameter: "date", operator: "ge", value: "2026-01-01" }] },
        createdBy: "admin",
        createdAt: now,
        usageCount: 120,
        isPublic: true
      },
      {
        id: "saved-003",
        name: "Patients with Hypertension",
        description: "All patients diagnosed with hypertension",
        query: { id: "q-003", resourceType: "Condition", conditions: [{ id: "c-1", parameter: "code", operator: "eq", value: "38341003" }], includeRelated: ["Condition:subject"] },
        createdBy: "admin",
        createdAt: now,
        usageCount: 78,
        isPublic: true
      }
    ];

    for (const query of queries) {
      this.savedQueries.set(query.id, query);
    }
  }

  getSupportedResourceTypes(): string[] {
    return Array.from(this.searchParameters.keys());
  }

  getSearchParameters(resourceType: string): SearchParameter[] {
    console.log(`[HIPAA-AUDIT][FHIRSearch] Search parameters retrieved for: ${resourceType}`);
    return this.searchParameters.get(resourceType) || [];
  }

  getAllSearchParameters(): Record<string, SearchParameter[]> {
    const result: Record<string, SearchParameter[]> = {};
    const entries = Array.from(this.searchParameters.entries());
    for (const [key, value] of entries) {
      result[key] = value;
    }
    return result;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private fuzzyMatch(text: string, pattern: string, threshold: number = 0.7): { match: boolean; score: number } {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    if (textLower.includes(patternLower)) {
      return { match: true, score: 1 };
    }

    const distance = this.levenshteinDistance(textLower, patternLower);
    const maxLen = Math.max(textLower.length, patternLower.length);
    const similarity = 1 - distance / maxLen;

    return { match: similarity >= threshold, score: similarity };
  }

  private matchCondition(resource: Record<string, unknown>, condition: SearchCondition): { match: boolean; score: number; field?: string } {
    const value = this.extractFieldValue(resource, condition.parameter);
    if (value === undefined || value === null) {
      if (condition.operator === "missing") {
        return { match: condition.value === "true", score: 1 };
      }
      return { match: false, score: 0 };
    }

    const valueStr = String(value).toLowerCase();
    const conditionValue = condition.value.toLowerCase();

    switch (condition.operator) {
      case "eq":
      case "exact":
        return { match: valueStr === conditionValue, score: valueStr === conditionValue ? 1 : 0, field: condition.parameter };
      case "ne":
        return { match: valueStr !== conditionValue, score: valueStr !== conditionValue ? 1 : 0, field: condition.parameter };
      case "contains":
        return { match: valueStr.includes(conditionValue), score: valueStr.includes(conditionValue) ? 0.9 : 0, field: condition.parameter };
      case "starts":
        return { match: valueStr.startsWith(conditionValue), score: valueStr.startsWith(conditionValue) ? 0.95 : 0, field: condition.parameter };
      case "ends":
        return { match: valueStr.endsWith(conditionValue), score: valueStr.endsWith(conditionValue) ? 0.95 : 0, field: condition.parameter };
      case "fuzzy":
        const fuzzyResult = this.fuzzyMatch(valueStr, conditionValue, 0.6);
        return { match: fuzzyResult.match, score: fuzzyResult.score, field: condition.parameter };
      case "lt":
        return { match: this.compareValues(value, condition.value) < 0, score: 1, field: condition.parameter };
      case "le":
        return { match: this.compareValues(value, condition.value) <= 0, score: 1, field: condition.parameter };
      case "gt":
        return { match: this.compareValues(value, condition.value) > 0, score: 1, field: condition.parameter };
      case "ge":
        return { match: this.compareValues(value, condition.value) >= 0, score: 1, field: condition.parameter };
      case "in":
        const inValues = condition.value.split(",").map(v => v.trim().toLowerCase());
        return { match: inValues.includes(valueStr), score: 1, field: condition.parameter };
      case "not-in":
        const notInValues = condition.value.split(",").map(v => v.trim().toLowerCase());
        return { match: !notInValues.includes(valueStr), score: 1, field: condition.parameter };
      default:
        return { match: valueStr === conditionValue, score: 1, field: condition.parameter };
    }
  }

  private compareValues(a: unknown, b: string): number {
    if (typeof a === "number") {
      return a - parseFloat(b);
    }
    if (a instanceof Date || (typeof a === "string" && /^\d{4}-\d{2}-\d{2}/.test(a as string))) {
      const dateA = new Date(a as string);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    }
    return String(a).localeCompare(b);
  }

  private extractFieldValue(resource: Record<string, unknown>, fieldPath: string): unknown {
    const fieldMappings: Record<string, string[]> = {
      "name": ["name.0.family", "name.0.given.0"],
      "family": ["name.0.family"],
      "given": ["name.0.given.0"],
      "birthdate": ["birthDate"],
      "address-city": ["address.0.city"],
      "address-state": ["address.0.state"],
      "address-postalcode": ["address.0.postalCode"],
      "clinical-status": ["clinicalStatus.coding.0.code"],
      "verification-status": ["verificationStatus.coding.0.code"],
      "code": ["code.coding.0.code", "code.coding.0.display", "medicationCodeableConcept.coding.0.display"],
      "category": ["category.0.coding.0.code"],
      "date": ["effectiveDateTime", "period.start", "authoredOn", "onsetDateTime"],
      "onset-date": ["onsetDateTime"],
      "abatement-date": ["abatementDateTime"],
      "recorded-date": ["recordedDate"],
      "status": ["status"],
      "value-quantity": ["valueQuantity.value"],
      "value-string": ["valueString"],
      "patient": ["subject.reference"],
      "subject": ["subject.reference"],
      "_id": ["id"],
    };

    const paths = fieldMappings[fieldPath] || [fieldPath];
    
    for (const path of paths) {
      const parts = path.split(".");
      let current: unknown = resource;
      
      for (const part of parts) {
        if (current === null || current === undefined) break;
        if (Array.isArray(current)) {
          const index = parseInt(part);
          current = isNaN(index) ? undefined : current[index];
        } else if (typeof current === "object") {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = undefined;
        }
      }
      
      if (current !== null && current !== undefined) {
        return current;
      }
    }
    
    return undefined;
  }

  async executeSearch(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    console.log(`[HIPAA-AUDIT][FHIRSearch] Search executed: resourceType=${query.resourceType}, conditions=${query.conditions.length}`);

    const resources = this.sampleData.get(query.resourceType) || [];
    const results: SearchResult[] = [];

    for (const resource of resources) {
      let totalScore = 0;
      let allMatch = true;
      const matchedFields: string[] = [];

      for (const condition of query.conditions) {
        const result = this.matchCondition(resource, condition);
        if (!result.match) {
          allMatch = false;
          break;
        }
        totalScore += result.score;
        if (result.field) matchedFields.push(result.field);
      }

      if (allMatch) {
        const avgScore = query.conditions.length > 0 ? totalScore / query.conditions.length : 1;
        
        let relatedResources: Record<string, unknown>[] = [];
        if (query.includeRelated && query.includeRelated.length > 0) {
          relatedResources = this.getRelatedResources(resource, query.includeRelated);
        }

        results.push({
          resourceType: query.resourceType,
          id: resource.id as string,
          data: resource,
          score: avgScore,
          matchedFields: Array.from(new Set(matchedFields)),
          relatedResources: relatedResources.length > 0 ? relatedResources : undefined
        });
      }
    }

    if (query.sort && query.sort.length > 0) {
      results.sort((a, b) => {
        for (const sort of query.sort!) {
          const aVal = this.extractFieldValue(a.data, sort.field);
          const bVal = this.extractFieldValue(b.data, sort.field);
          const cmp = this.compareValues(aVal, String(bVal));
          if (cmp !== 0) return sort.order === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    } else {
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      query,
      total: results.length,
      results: paginatedResults,
      executionTimeMs: Date.now() - startTime
    };
  }

  private getRelatedResources(resource: Record<string, unknown>, includes: string[]): Record<string, unknown>[] {
    const related: Record<string, unknown>[] = [];

    for (const include of includes) {
      const [resourceType, param] = include.split(":");
      
      if (param === "subject" || param === "patient") {
        const subjectRef = (resource as any).subject?.reference || (resource as any).patient?.reference;
        if (subjectRef) {
          const [refType, refId] = subjectRef.split("/");
          const refResources = this.sampleData.get(refType) || [];
          const found = refResources.find(r => r.id === refId);
          if (found) related.push(found);
        }
      }
    }

    return related;
  }

  async getAISearchSuggestions(resourceType: string, currentConditions: SearchCondition[]): Promise<SearchSuggestion[]> {
    console.log(`[HIPAA-AUDIT][FHIRSearch] AI suggestions requested for: ${resourceType}`);

    if (!this.openai) {
      return this.getDefaultSearchSuggestions(resourceType, currentConditions);
    }

    try {
      const params = this.getSearchParameters(resourceType);
      const prompt = `You are a FHIR search expert. Suggest relevant search parameters for querying ${resourceType} resources.

Available search parameters:
${params.slice(0, 15).map(p => `- ${p.name}: ${p.description} (type: ${p.type})`).join("\n")}

Current query conditions:
${currentConditions.length > 0 ? currentConditions.map(c => `- ${c.parameter} ${c.operator} "${c.value}"`).join("\n") : "None yet"}

Suggest 4-5 search improvements. For each, provide:
- type: "parameter" (add new param), "value" (suggest value), "refinement" (improve existing), or "related" (search related resources)
- suggestion: The parameter name or improvement
- description: Brief explanation
- confidence: 0-100 score
- example: Example usage

Return ONLY valid JSON array, no markdown.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "[]";
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const suggestions = JSON.parse(cleanContent);

      return suggestions.map((s: any, i: number) => ({
        id: `suggestion-${i + 1}`,
        type: s.type,
        suggestion: s.suggestion,
        description: s.description,
        confidence: s.confidence,
        example: s.example
      }));
    } catch (error) {
      console.error("[FHIRSearch] AI suggestions error:", error);
      return this.getDefaultSearchSuggestions(resourceType, currentConditions);
    }
  }

  private getDefaultSearchSuggestions(resourceType: string, currentConditions: SearchCondition[]): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    const params = this.getSearchParameters(resourceType);
    const usedParams = new Set(currentConditions.map(c => c.parameter));

    const priorityParams: Record<string, string[]> = {
      Patient: ["name", "birthdate", "gender", "address-city", "active"],
      Observation: ["code", "date", "category", "value-quantity", "status"],
      Condition: ["code", "clinical-status", "onset-date", "verification-status"],
      MedicationRequest: ["code", "status", "authoredon", "intent"],
      Encounter: ["date", "status", "class", "type"]
    };

    const priority = priorityParams[resourceType] || [];
    let id = 1;

    for (const paramName of priority) {
      if (!usedParams.has(paramName) && suggestions.length < 5) {
        const param = params.find(p => p.name === paramName);
        if (param) {
          suggestions.push({
            id: `suggestion-${id++}`,
            type: "parameter",
            suggestion: param.name,
            description: param.description,
            confidence: 85 - suggestions.length * 5,
            example: this.getExampleForParam(param)
          });
        }
      }
    }

    if (currentConditions.length > 0 && suggestions.length < 5) {
      suggestions.push({
        id: `suggestion-${id++}`,
        type: "related",
        suggestion: "Include related resources",
        description: `Add _include to fetch referenced ${resourceType === "Patient" ? "observations and conditions" : "patient information"}`,
        confidence: 75
      });
    }

    if (currentConditions.some(c => c.operator === "eq" && c.parameter === "name") && suggestions.length < 5) {
      suggestions.push({
        id: `suggestion-${id++}`,
        type: "refinement",
        suggestion: "Use fuzzy matching for names",
        description: "Switch to fuzzy operator to catch spelling variations",
        confidence: 80,
        example: 'name fuzzy "Smyth"'
      });
    }

    return suggestions;
  }

  private getExampleForParam(param: SearchParameter): string {
    switch (param.type) {
      case "string":
        return `${param.name} contains "example"`;
      case "date":
        return `${param.name} ge "2025-01-01"`;
      case "token":
        return `${param.name} eq "value"`;
      case "quantity":
        return `${param.name} gt "100"`;
      case "reference":
        return `${param.name} eq "Patient/123"`;
      default:
        return `${param.name} eq "value"`;
    }
  }

  getSavedQueries(): SavedQuery[] {
    return Array.from(this.savedQueries.values());
  }

  saveQuery(name: string, description: string, query: SearchQuery, userId: string, isPublic: boolean = false): SavedQuery {
    const id = `saved-${Date.now().toString(36)}`;
    const savedQuery: SavedQuery = {
      id,
      name,
      description,
      query,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      isPublic
    };
    this.savedQueries.set(id, savedQuery);
    console.log(`[HIPAA-AUDIT][FHIRSearch] Query saved: queryId=${id}, name=${name}`);
    return savedQuery;
  }

  deleteSavedQuery(id: string): boolean {
    const deleted = this.savedQueries.delete(id);
    if (deleted) {
      console.log(`[HIPAA-AUDIT][FHIRSearch] Query deleted: queryId=${id}`);
    }
    return deleted;
  }

  getOperatorsForType(type: string): SearchOperator[] {
    switch (type) {
      case "string":
        return ["eq", "ne", "contains", "exact", "starts", "ends", "fuzzy", "missing"];
      case "token":
        return ["eq", "ne", "in", "not-in", "missing"];
      case "date":
        return ["eq", "ne", "lt", "le", "gt", "ge", "missing"];
      case "number":
      case "quantity":
        return ["eq", "ne", "lt", "le", "gt", "ge", "missing"];
      case "reference":
        return ["eq", "ne", "missing"];
      default:
        return ["eq", "ne", "missing"];
    }
  }
}

export const fhirAdvancedSearchService = new FHIRAdvancedSearchService();
