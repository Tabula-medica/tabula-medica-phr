import { randomUUID } from "crypto";
import { healthcare } from "@googleapis/healthcare";
import { GoogleAuth } from "google-auth-library";

export interface FhirHumanName {
  use?: "official" | "usual" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  text?: string;
}

export interface FhirAddress {
  use?: "home" | "work" | "temp" | "old" | "billing";
  type?: "postal" | "physical" | "both";
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  text?: string;
}

export interface FhirContactPoint {
  system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: "home" | "work" | "temp" | "old" | "mobile";
  rank?: number;
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
  version?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirReference {
  reference?: string;
  type?: string;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirIdentifier {
  use?: "usual" | "official" | "temp" | "secondary" | "old";
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
}

export interface FhirQuantity {
  value?: number;
  unit?: string;
  system?: string;
  code?: string;
  comparator?: "<" | "<=" | ">=" | ">";
}

export interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  profile?: string[];
  security?: FhirCoding[];
  tag?: FhirCoding[];
}

export const FHIR_TERMINOLOGY_SYSTEMS = {
  SNOMED_CT: "http://snomed.info/sct",
  LOINC: "http://loinc.org",
  ICD10_CM: "http://hl7.org/fhir/sid/icd-10-cm",
  RXNORM: "http://www.nlm.nih.gov/research/umls/rxnorm",
  CPT: "http://www.ama-assn.org/go/cpt",
  CVX: "http://hl7.org/fhir/sid/cvx",
  NDC: "http://hl7.org/fhir/sid/ndc",
  UCUM: "http://unitsofmeasure.org",
  US_CORE: "http://hl7.org/fhir/us/core",
  IDENTIFIER_MRN: "http://terminology.hl7.org/CodeSystem/v2-0203",
  IDENTIFIER_SSN: "http://hl7.org/fhir/sid/us-ssn",
  IDENTIFIER_NPI: "http://hl7.org/fhir/sid/us-npi",
} as const;

export const US_CORE_PROFILES = {
  Patient: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  Observation: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
  Condition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
  Procedure: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  MedicationRequest: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  AllergyIntolerance: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  Immunization: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  DocumentReference: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
  Encounter: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  DiagnosticReport: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
} as const;

export function formatHumanName(name: FhirHumanName): string {
  if (name.text) return name.text;
  const parts: string[] = [];
  if (name.prefix?.length) parts.push(name.prefix.join(" "));
  if (name.given?.length) parts.push(name.given.join(" "));
  if (name.family) parts.push(name.family);
  if (name.suffix?.length) parts.push(name.suffix.join(" "));
  return parts.join(" ").trim() || "Unknown";
}

export function formatAddress(address: FhirAddress): string {
  if (address.text) return address.text;
  const parts: string[] = [];
  if (address.line?.length) parts.push(address.line.join(", "));
  const cityState: string[] = [];
  if (address.city) cityState.push(address.city);
  if (address.state) cityState.push(address.state);
  if (cityState.length) parts.push(cityState.join(", "));
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  return parts.join(", ").trim();
}

export function formatContactPoint(contact: FhirContactPoint): string {
  if (!contact.value) return "";
  const label = contact.use ? `(${contact.use})` : "";
  return `${contact.value} ${label}`.trim();
}

export function formatCodeableConcept(concept: FhirCodeableConcept): string {
  if (concept.text) return concept.text;
  if (concept.coding?.length) {
    const primary = concept.coding[0];
    return primary.display || primary.code || "";
  }
  return "";
}

export function formatQuantity(quantity: FhirQuantity): string {
  if (quantity.value === undefined) return "";
  const comp = quantity.comparator || "";
  const unit = quantity.unit || quantity.code || "";
  return `${comp}${quantity.value} ${unit}`.trim();
}

export function formatReference(ref: FhirReference): string {
  return ref.display || ref.reference || "";
}

export function formatPeriod(period: FhirPeriod): string {
  const start = period.start ? formatFhirDate(period.start) : "?";
  const end = period.end ? formatFhirDate(period.end) : "ongoing";
  return `${start} – ${end}`;
}

export function formatFhirDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    if (/^\d{4}$/.test(dateStr)) return dateStr;
    if (/^\d{4}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split("-");
      return `${month}/${year}`;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatFhirDateTime(dateTimeStr: string): string {
  if (!dateTimeStr) return "";
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateTimeStr;
  }
}

export function generateFhirId(): string {
  return randomUUID();
}

export function generateFhirMeta(profile?: string): FhirMeta {
  return {
    versionId: "1",
    lastUpdated: new Date().toISOString(),
    ...(profile ? { profile: [profile] } : {}),
  };
}

export function createFhirBundle(
  type: "searchset" | "transaction" | "batch" | "collection",
  entries: Array<{ resource: Record<string, unknown>; fullUrl?: string }>,
  total?: number
): Record<string, unknown> {
  return {
    resourceType: "Bundle",
    id: generateFhirId(),
    type,
    timestamp: new Date().toISOString(),
    ...(total !== undefined ? { total } : { total: entries.length }),
    entry: entries.map((e) => ({
      fullUrl: e.fullUrl || `urn:uuid:${e.resource.id || generateFhirId()}`,
      resource: e.resource,
    })),
  };
}

export function createOperationOutcome(
  severity: "fatal" | "error" | "warning" | "information",
  code: string,
  diagnostics: string
): Record<string, unknown> {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity,
        code,
        diagnostics,
        details: { text: diagnostics },
      },
    ],
  };
}

export function createFhirIdentifier(
  system: string,
  value: string,
  use: FhirIdentifier["use"] = "official"
): FhirIdentifier {
  return { use, system, value };
}

export function createCoding(
  system: string,
  code: string,
  display?: string
): FhirCoding {
  return { system, code, ...(display ? { display } : {}) };
}

export function createCodeableConcept(
  system: string,
  code: string,
  display?: string,
  text?: string
): FhirCodeableConcept {
  return {
    coding: [createCoding(system, code, display)],
    ...(text ? { text } : display ? { text: display } : {}),
  };
}

export function createReference(
  resourceType: string,
  id: string,
  display?: string
): FhirReference {
  return {
    reference: `${resourceType}/${id}`,
    type: resourceType,
    ...(display ? { display } : {}),
  };
}

export interface FhirValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFhirResource(resource: Record<string, unknown>): FhirValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resource || typeof resource !== "object") {
    return { valid: false, errors: ["Resource must be a valid object"], warnings: [] };
  }

  if (!resource.resourceType || typeof resource.resourceType !== "string") {
    errors.push("Missing or invalid 'resourceType' field");
  }

  if (resource.id !== undefined && typeof resource.id !== "string") {
    errors.push("'id' must be a string");
  }

  if (resource.id && typeof resource.id === "string" && resource.id.length > 64) {
    errors.push("'id' must be 64 characters or fewer");
  }

  if (resource.meta) {
    const meta = resource.meta as Record<string, unknown>;
    if (meta.lastUpdated && typeof meta.lastUpdated === "string") {
      const d = new Date(meta.lastUpdated);
      if (isNaN(d.getTime())) {
        errors.push("'meta.lastUpdated' is not a valid ISO date");
      }
    }
    if (meta.profile && !Array.isArray(meta.profile)) {
      errors.push("'meta.profile' must be an array of URIs");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePatientResource(patient: Record<string, unknown>): FhirValidationResult {
  const base = validateFhirResource(patient);

  if (patient.resourceType !== "Patient") {
    base.errors.push("resourceType must be 'Patient'");
  }

  if (!patient.name || !Array.isArray(patient.name) || patient.name.length === 0) {
    base.errors.push("Patient must have at least one name (US Core requirement)");
  }

  if (!patient.gender) {
    base.errors.push("Patient must have a gender (US Core requirement)");
  } else if (!["male", "female", "other", "unknown"].includes(patient.gender as string)) {
    base.errors.push("Patient gender must be one of: male, female, other, unknown");
  }

  if (patient.birthDate) {
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate as string)) {
      base.errors.push("Patient birthDate must be YYYY, YYYY-MM, or YYYY-MM-DD");
    }
  }

  if (!patient.identifier || !Array.isArray(patient.identifier) || patient.identifier.length === 0) {
    base.warnings.push("Patient should have at least one identifier");
  }

  base.valid = base.errors.length === 0;
  return base;
}

export function validateObservationResource(obs: Record<string, unknown>): FhirValidationResult {
  const base = validateFhirResource(obs);

  if (obs.resourceType !== "Observation") {
    base.errors.push("resourceType must be 'Observation'");
  }

  if (!obs.status) {
    base.errors.push("Observation must have a status");
  } else if (!["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"].includes(obs.status as string)) {
    base.errors.push("Invalid Observation status value");
  }

  if (!obs.code) {
    base.errors.push("Observation must have a code (US Core requirement)");
  }

  if (!obs.subject) {
    base.warnings.push("Observation should reference a subject (patient)");
  }

  if (!obs.effectiveDateTime && !obs.effectivePeriod) {
    base.warnings.push("Observation should have an effective date or period");
  }

  base.valid = base.errors.length === 0;
  return base;
}

export function validateConditionResource(condition: Record<string, unknown>): FhirValidationResult {
  const base = validateFhirResource(condition);

  if (condition.resourceType !== "Condition") {
    base.errors.push("resourceType must be 'Condition'");
  }

  if (!condition.clinicalStatus) {
    base.warnings.push("Condition should have a clinicalStatus");
  }

  if (!condition.code) {
    base.errors.push("Condition must have a code (US Core requirement)");
  }

  if (!condition.subject) {
    base.errors.push("Condition must reference a subject (patient)");
  }

  base.valid = base.errors.length === 0;
  return base;
}

export function extractCodingBySystem(concept: FhirCodeableConcept, system: string): FhirCoding | undefined {
  return concept.coding?.find((c) => c.system === system);
}

export function hasCoding(concept: FhirCodeableConcept, system: string, code: string): boolean {
  return concept.coding?.some((c) => c.system === system && c.code === code) ?? false;
}

export function extractIdentifierBySystem(identifiers: FhirIdentifier[], system: string): string | undefined {
  return identifiers.find((id) => id.system === system)?.value;
}

export function isValidFhirDate(dateStr: string): boolean {
  return /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/.test(dateStr);
}

export function fhirDateToISO(dateStr: string): string {
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01T00:00:00.000Z`;
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return `${dateStr}T00:00:00.000Z`;
  return dateStr;
}

export function calculateAgeFromBirthDate(birthDate: string): number {
  const birth = new Date(fhirDateToISO(birthDate));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getUSCoreProfile(resourceType: string): string | undefined {
  return US_CORE_PROFILES[resourceType as keyof typeof US_CORE_PROFILES];
}

export function addUSCoreProfile(resource: Record<string, unknown>): Record<string, unknown> {
  const profile = getUSCoreProfile(resource.resourceType as string);
  if (!profile) return resource;

  const meta = (resource.meta || {}) as Record<string, unknown>;
  const existing = (meta.profile || []) as string[];
  if (!existing.includes(profile)) {
    meta.profile = [...existing, profile];
  }
  return { ...resource, meta };
}

export function sanitizeForLogging(resource: Record<string, unknown>): Record<string, unknown> {
  const PHI_FIELDS = ["name", "address", "telecom", "birthDate", "identifier", "photo", "contact"];
  const sanitized = { ...resource };
  for (const field of PHI_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }
  return sanitized;
}

export function createAuditEntry(
  action: "create" | "read" | "update" | "delete" | "search",
  resourceType: string,
  resourceId?: string,
  userId?: string,
  outcome: "success" | "failure" = "success"
): Record<string, unknown> {
  return {
    resourceType: "AuditEvent",
    id: generateFhirId(),
    type: createCoding("http://dicom.nema.org/resources/ontology/DCM", "110112", "Query"),
    action: action === "create" ? "C" : action === "read" || action === "search" ? "R" : action === "update" ? "U" : "D",
    recorded: new Date().toISOString(),
    outcome: outcome === "success" ? "0" : "8",
    agent: [
      {
        who: userId ? createReference("Practitioner", userId) : undefined,
        requestor: true,
      },
    ],
    entity: [
      {
        what: resourceId ? createReference(resourceType, resourceId) : { type: resourceType },
        type: createCoding("http://terminology.hl7.org/CodeSystem/audit-entity-type", "2", "System Object"),
      },
    ],
  };
}

const GCP_FHIR_STORE_PATH = "projects/united-planet-485003-n7/locations/us-central1/datasets/tabula-medica-data/fhirStores/patient-records";

let gcpAuthClient: GoogleAuth | null = null;

function getGcpAuth(): GoogleAuth {
  if (!gcpAuthClient) {
    gcpAuthClient = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return gcpAuthClient;
}

function getHealthcareClient() {
  return healthcare({
    version: "v1",
    auth: getGcpAuth(),
  });
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender: "male" | "female" | "other" | "unknown";
  dob: string;
  email?: string;
  phone?: string;
  address?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  mrn?: string;
}

export async function createFhirPatient(patientData: PatientInput): Promise<Record<string, unknown>> {
  const client = getHealthcareClient();

  const given = [patientData.firstName];
  if (patientData.middleName && patientData.middleName !== "NMN") {
    given.push(patientData.middleName);
  }

  const resource: Record<string, unknown> = {
    resourceType: "Patient",
    meta: generateFhirMeta(US_CORE_PROFILES.Patient),
    name: [{ use: "official", family: patientData.lastName, given }],
    gender: patientData.gender,
    birthDate: patientData.dob,
  };

  if (patientData.mrn) {
    resource.identifier = [
      createFhirIdentifier(FHIR_TERMINOLOGY_SYSTEMS.IDENTIFIER_MRN, patientData.mrn),
    ];
  }

  const telecom: FhirContactPoint[] = [];
  if (patientData.phone) telecom.push({ system: "phone", value: patientData.phone, use: "home" });
  if (patientData.email) telecom.push({ system: "email", value: patientData.email });
  if (telecom.length) resource.telecom = telecom;

  if (patientData.address) {
    resource.address = [{
      use: "home" as const,
      line: patientData.address.line,
      city: patientData.address.city,
      state: patientData.address.state,
      postalCode: patientData.address.postalCode,
      country: patientData.address.country || "US",
    }];
  }

  const validation = validatePatientResource(resource);
  if (!validation.valid) {
    throw new Error(`Patient validation failed: ${validation.errors.join("; ")}`);
  }

  try {
    const response = await client.projects.locations.datasets.fhirStores.fhir.create({
      parent: GCP_FHIR_STORE_PATH,
      type: "Patient",
      requestBody: resource,
    });
    console.log("[GCP-FHIR] Patient created:", (response.data as Record<string, unknown>).id);
    return response.data as Record<string, unknown>;
  } catch (error: any) {
    console.error("[GCP-FHIR] Error creating patient:", sanitizeForLogging({ error: error.message }));
    throw error;
  }
}

export async function readFhirResource(resourceType: string, resourceId: string): Promise<Record<string, unknown>> {
  const client = getHealthcareClient();
  const name = `${GCP_FHIR_STORE_PATH}/fhir/${resourceType}/${resourceId}`;

  try {
    const response = await client.projects.locations.datasets.fhirStores.fhir.read({ name });
    return response.data as Record<string, unknown>;
  } catch (error: any) {
    console.error(`[GCP-FHIR] Error reading ${resourceType}/${resourceId}:`, error.message);
    throw error;
  }
}

export async function updateFhirResource(resourceType: string, resourceId: string, resource: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = getHealthcareClient();
  const name = `${GCP_FHIR_STORE_PATH}/fhir/${resourceType}/${resourceId}`;

  const validation = validateFhirResource(resource);
  if (!validation.valid) {
    throw new Error(`Resource validation failed: ${validation.errors.join("; ")}`);
  }

  try {
    const response = await (client.projects.locations.datasets.fhirStores.fhir.update as Function)({
      name,
      requestBody: { ...resource, id: resourceId },
    });
    console.log(`[GCP-FHIR] ${resourceType}/${resourceId} updated`);
    return response.data as Record<string, unknown>;
  } catch (error: any) {
    console.error(`[GCP-FHIR] Error updating ${resourceType}/${resourceId}:`, error.message);
    throw error;
  }
}

export async function deleteFhirResource(resourceType: string, resourceId: string): Promise<void> {
  const client = getHealthcareClient();
  const name = `${GCP_FHIR_STORE_PATH}/fhir/${resourceType}/${resourceId}`;

  try {
    await client.projects.locations.datasets.fhirStores.fhir.delete({ name });
    console.log(`[GCP-FHIR] ${resourceType}/${resourceId} deleted`);
  } catch (error: any) {
    console.error(`[GCP-FHIR] Error deleting ${resourceType}/${resourceId}:`, error.message);
    throw error;
  }
}

export async function searchFhirResources(resourceType: string, params?: Record<string, string>): Promise<Record<string, unknown>> {
  const client = getHealthcareClient();
  const parent = `${GCP_FHIR_STORE_PATH}/fhir/${resourceType}`;

  try {
    const response = await client.projects.locations.datasets.fhirStores.fhir.search({
      parent: GCP_FHIR_STORE_PATH,
      requestBody: { resourceType, ...params },
    });
    return response.data as Record<string, unknown>;
  } catch (error: any) {
    console.error(`[GCP-FHIR] Error searching ${resourceType}:`, error.message);
    throw error;
  }
}

export async function createFhirResource(resourceType: string, resource: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = getHealthcareClient();

  const validation = validateFhirResource({ ...resource, resourceType });
  if (!validation.valid) {
    throw new Error(`Resource validation failed: ${validation.errors.join("; ")}`);
  }

  const profiledResource = addUSCoreProfile({ ...resource, resourceType });

  try {
    const response = await client.projects.locations.datasets.fhirStores.fhir.create({
      parent: GCP_FHIR_STORE_PATH,
      type: resourceType,
      requestBody: profiledResource,
    });
    console.log(`[GCP-FHIR] ${resourceType} created:`, (response.data as Record<string, unknown>).id);
    return response.data as Record<string, unknown>;
  } catch (error: any) {
    console.error(`[GCP-FHIR] Error creating ${resourceType}:`, error.message);
    throw error;
  }
}
