import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { promises as dns } from "dns";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error" | "authentication_required";
export type AuthMethod = "none" | "basic" | "bearer" | "smart_on_fhir" | "oauth2_client_credentials";

export interface ExternalFHIRServer {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: "R4" | "STU3" | "DSTU2";
  authMethod: AuthMethod;
  status: ConnectionStatus;
  lastConnectedAt?: string;
  lastSyncAt?: string;
  metadata?: FHIRCapabilityStatement;
  supportedResources: string[];
  errorMessage?: string;
  isTestServer: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FHIRCapabilityStatement {
  fhirVersion: string;
  status: string;
  kind: string;
  software?: { name: string; version: string };
  implementation?: { description: string; url: string };
  rest?: Array<{
    mode: string;
    resource?: Array<{
      type: string;
      interaction?: Array<{ code: string }>;
      searchParam?: Array<{ name: string; type: string }>;
    }>;
  }>;
}

export interface FHIRServerConfig {
  name: string;
  baseUrl: string;
  fhirVersion: "R4" | "STU3" | "DSTU2";
  authMethod: AuthMethod;
  credentials?: {
    username?: string;
    password?: string;
    bearerToken?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
  };
  isTestServer?: boolean;
}

export interface FHIRDataExchange {
  id: string;
  serverId: string;
  direction: "import" | "export";
  resourceType: string;
  resourceCount: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  details: ExchangeDetail[];
  createdBy: string;
}

export interface ExchangeDetail {
  resourceId: string;
  action: "created" | "updated" | "skipped" | "failed";
  message?: string;
}

export interface FHIRSearchParams {
  resourceType: string;
  params: Record<string, string>;
  includeCount?: boolean;
  pageSize?: number;
  page?: number;
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: "searchset" | "collection" | "batch" | "transaction";
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{
    fullUrl?: string;
    resource?: Record<string, unknown>;
    search?: { mode: string; score?: number };
  }>;
}

export class FhirValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FhirValidationError";
  }
}

const ALLOWED_FHIR_RESOURCE_TYPES = new Set([
  "Account", "ActivityDefinition", "AdverseEvent", "AllergyIntolerance", "Appointment",
  "AppointmentResponse", "AuditEvent", "Basic", "Binary", "BiologicallyDerivedProduct",
  "BodyStructure", "Bundle", "CapabilityStatement", "CarePlan", "CareTeam",
  "CatalogEntry", "ChargeItem", "ChargeItemDefinition", "Claim", "ClaimResponse",
  "ClinicalImpression", "CodeSystem", "Communication", "CommunicationRequest",
  "CompartmentDefinition", "Composition", "ConceptMap", "Condition", "Consent",
  "Contract", "Coverage", "CoverageEligibilityRequest", "CoverageEligibilityResponse",
  "DetectedIssue", "Device", "DeviceDefinition", "DeviceMetric", "DeviceRequest",
  "DeviceUseStatement", "DiagnosticReport", "DocumentManifest", "DocumentReference",
  "EffectEvidenceSynthesis", "Encounter", "Endpoint", "EnrollmentRequest",
  "EnrollmentResponse", "EpisodeOfCare", "EventDefinition", "Evidence", "EvidenceVariable",
  "ExampleScenario", "ExplanationOfBenefit", "FamilyMemberHistory", "Flag", "Goal",
  "GraphDefinition", "Group", "GuidanceResponse", "HealthcareService", "ImagingStudy",
  "Immunization", "ImmunizationEvaluation", "ImmunizationRecommendation",
  "ImplementationGuide", "InsurancePlan", "Invoice", "Library", "Linkage", "List",
  "Location", "Measure", "MeasureReport", "Media", "Medication", "MedicationAdministration",
  "MedicationDispense", "MedicationKnowledge", "MedicationRequest", "MedicationStatement",
  "MedicinalProduct", "MedicinalProductAuthorization", "MedicinalProductContraindication",
  "MedicinalProductIndication", "MedicinalProductIngredient", "MedicinalProductInteraction",
  "MedicinalProductManufactured", "MedicinalProductPackaged", "MedicinalProductPharmaceutical",
  "MedicinalProductUndesirableEffect", "MessageDefinition", "MessageHeader",
  "MolecularSequence", "NamingSystem", "NutritionOrder", "Observation",
  "ObservationDefinition", "OperationDefinition", "OperationOutcome", "Organization",
  "OrganizationAffiliation", "Patient", "PaymentNotice", "PaymentReconciliation", "Person",
  "PlanDefinition", "Practitioner", "PractitionerRole", "Procedure", "Provenance",
  "Questionnaire", "QuestionnaireResponse", "RelatedPerson", "RequestGroup",
  "ResearchDefinition", "ResearchElementDefinition", "ResearchStudy", "ResearchSubject",
  "RiskAssessment", "RiskEvidenceSynthesis", "Schedule", "SearchParameter",
  "ServiceRequest", "Slot", "Specimen", "SpecimenDefinition", "StructureDefinition",
  "StructureMap", "Subscription", "Substance", "SubstanceNucleicAcid",
  "SubstancePolymer", "SubstanceProtein", "SubstanceReferenceInformation",
  "SubstanceSourceMaterial", "SubstanceSpecification", "SupplyDelivery", "SupplyRequest",
  "Task", "TerminologyCapabilities", "TestReport", "TestScript", "ValueSet",
  "VerificationResult", "VisionPrescription",
]);

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = Object.entries(details)
    .map(([k, v]) => `${k}:${typeof v === "string" && k.includes("Id") ? hashIdentifier(v) : v}`)
    .join(" ");
  console.log(`[HIPAA-AUDIT][ExternalFHIR] ${timestamp} - ${action} - ${sanitizedDetails}`);
}

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^fec0:/i,
  /^ff[0-9a-f]{2}:/i,
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.internal",
  "169.254.169.254",
]);

function isPrivateAddress(address: string): boolean {
  const addr = address.toLowerCase().replace(/^\[|\]$/, "");
  if (BLOCKED_HOSTNAMES.has(addr)) return true;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(addr)) return true;
  }
  const ipv4MappedDotted = /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (ipv4MappedDotted) {
    return isPrivateAddress(`${ipv4MappedDotted[1]}.${ipv4MappedDotted[2]}.${ipv4MappedDotted[3]}.${ipv4MappedDotted[4]}`);
  }
  const ipv4MappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(addr);
  if (ipv4MappedHex) {
    const hi = parseInt(ipv4MappedHex[1], 16);
    const lo = parseInt(ipv4MappedHex[2], 16);
    const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateAddress(dotted);
  }
  if (/^::ffff:/i.test(addr)) return true;
  return false;
}

async function validateFhirUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FhirValidationError("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new FhirValidationError("Only HTTPS URLs are permitted for external FHIR connections");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/, "");

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new FhirValidationError("Connection to this host is not permitted");
  }

  if (
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".localhost")
  ) {
    throw new FhirValidationError("Connection to this host is not permitted");
  }

  if (isPrivateAddress(hostname)) {
    throw new FhirValidationError("Connection to private IP ranges is not permitted");
  }

  const isLiteralIp =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
  if (isLiteralIp) return;

  const resolvedAddresses: string[] = [];
  try {
    const ipv4Records = await dns.resolve4(hostname);
    resolvedAddresses.push(...ipv4Records);
  } catch { /* hostname may not have A records */ }
  try {
    const ipv6Records = await dns.resolve6(hostname);
    resolvedAddresses.push(...ipv6Records);
  } catch { /* hostname may not have AAAA records */ }

  if (resolvedAddresses.length === 0) {
    throw new FhirValidationError("Unable to resolve host or connection not permitted");
  }

  for (const addr of resolvedAddresses) {
    if (isPrivateAddress(addr)) {
      throw new FhirValidationError("Connection to private IP ranges is not permitted");
    }
  }
}

function validateResourceType(resourceType: string): void {
  if (!ALLOWED_FHIR_RESOURCE_TYPES.has(resourceType)) {
    throw new FhirValidationError(`Resource type '${resourceType}' is not supported`);
  }
}

function validateResourceId(resourceId: string): void {
  if (!/^[A-Za-z0-9._\-]{1,64}$/.test(resourceId)) {
    throw new FhirValidationError("Invalid resource ID format");
  }
}

const SYSTEM_USER = "__system__";

const PUBLIC_TEST_SERVERS: ExternalFHIRServer[] = [
  {
    id: "test-hapi-r4",
    name: "HAPI FHIR R4 Test Server",
    baseUrl: "https://hapi.fhir.org/baseR4",
    fhirVersion: "R4",
    authMethod: "none",
    status: "disconnected",
    supportedResources: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Procedure", "Immunization", "DiagnosticReport", "CarePlan", "Goal", "Encounter"],
    isTestServer: true,
    createdBy: SYSTEM_USER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "test-synthea",
    name: "Synthea Public Sandbox",
    baseUrl: "https://syntheticmass.mitre.org/v1/fhir",
    fhirVersion: "R4",
    authMethod: "none",
    status: "disconnected",
    supportedResources: ["Patient", "Observation", "Condition", "MedicationRequest", "Encounter", "Procedure", "Immunization"],
    isTestServer: true,
    createdBy: SYSTEM_USER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

class ExternalFHIRConnector {
  private servers: Map<string, ExternalFHIRServer> = new Map();
  private exchanges: Map<string, FHIRDataExchange> = new Map();
  private accessTokens: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor() {
    PUBLIC_TEST_SERVERS.forEach(s => this.servers.set(s.id, s));
    console.log("[ExternalFHIR] Initialized with", this.servers.size, "test servers");
  }

  async addServer(config: FHIRServerConfig, userId: string): Promise<ExternalFHIRServer> {
    await validateFhirUrl(config.baseUrl);

    const id = `fhir-server-${randomUUID().slice(0, 8)}`;

    const server: ExternalFHIRServer = {
      id,
      name: config.name,
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      fhirVersion: config.fhirVersion,
      authMethod: config.authMethod,
      status: "disconnected",
      supportedResources: [],
      isTestServer: config.isTestServer || false,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.servers.set(id, server);
    logHipaaAudit("FHIR_SERVER_ADDED", { userId, serverId: id, serverName: config.name, fhirVersion: config.fhirVersion });
    return server;
  }

  async testConnection(serverId: string, userId: string): Promise<{ success: boolean; message: string; metadata?: FHIRCapabilityStatement }> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.createdBy !== SYSTEM_USER && server.createdBy !== userId) throw new Error("Server not found");

    try {
      await validateFhirUrl(server.baseUrl);
      server.status = "connecting";
      this.servers.set(serverId, server);

      const response = await fetch(`${server.baseUrl}/metadata`, {
        method: "GET",
        headers: { "Accept": "application/fhir+json", "Content-Type": "application/fhir+json" },
        redirect: "manual",
      });

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        throw new Error("Redirects are not followed to prevent SSRF");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const metadata = await response.json() as FHIRCapabilityStatement;
      const supportedResources = metadata.rest?.[0]?.resource?.map(r => r.type) || [];

      server.status = "connected";
      server.lastConnectedAt = new Date().toISOString();
      server.metadata = metadata;
      server.supportedResources = supportedResources;
      server.errorMessage = undefined;
      this.servers.set(serverId, server);
      logHipaaAudit("FHIR_SERVER_CONNECTED", { userId, serverId, fhirVersion: metadata.fhirVersion, resourceCount: supportedResources.length });

      return { success: true, message: `Connected successfully. Server supports ${supportedResources.length} resource types.`, metadata };
    } catch (error) {
      server.status = "error";
      server.errorMessage = error instanceof Error ? error.message : "Connection failed";
      this.servers.set(serverId, server);
      logHipaaAudit("FHIR_SERVER_CONNECTION_FAILED", { userId, serverId, error: server.errorMessage });
      return { success: false, message: server.errorMessage };
    }
  }

  async searchResources(serverId: string, params: FHIRSearchParams, userId: string): Promise<FHIRBundle> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.createdBy !== SYSTEM_USER && server.createdBy !== userId) throw new Error("Server not found");

    validateResourceType(params.resourceType);
    await validateFhirUrl(server.baseUrl);

    const queryParams = new URLSearchParams();
    Object.entries(params.params).forEach(([key, value]) => { if (value) queryParams.append(key, value); });
    if (params.pageSize) queryParams.append("_count", params.pageSize.toString());
    if (params.page && params.page > 1) queryParams.append("_offset", ((params.page - 1) * (params.pageSize || 20)).toString());
    if (params.includeCount) queryParams.append("_total", "accurate");

    const searchUrl = `${server.baseUrl}/${params.resourceType}?${queryParams.toString()}`;
    logHipaaAudit("FHIR_SEARCH_INITIATED", { userId, serverId, resourceType: params.resourceType, paramCount: Object.keys(params.params).length });

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: { "Accept": "application/fhir+json", "Content-Type": "application/fhir+json" },
        redirect: "manual",
      });

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) throw new Error("Redirects are not followed to prevent SSRF");
      if (!response.ok) throw new Error(`Search failed: HTTP ${response.status}`);

      const bundle = await response.json() as FHIRBundle;
      logHipaaAudit("FHIR_SEARCH_COMPLETED", { userId, serverId, resourceType: params.resourceType, resultCount: bundle.entry?.length || 0, total: bundle.total });
      return bundle;
    } catch (error) {
      logHipaaAudit("FHIR_SEARCH_FAILED", { userId, serverId, resourceType: params.resourceType, error: error instanceof Error ? error.message : "Unknown error" });
      throw error;
    }
  }

  async getResource(serverId: string, resourceType: string, resourceId: string, userId: string): Promise<Record<string, unknown>> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.createdBy !== SYSTEM_USER && server.createdBy !== userId) throw new Error("Server not found");

    validateResourceType(resourceType);
    validateResourceId(resourceId);
    await validateFhirUrl(server.baseUrl);

    logHipaaAudit("FHIR_RESOURCE_READ", { userId, serverId, resourceType, resourceId });

    const response = await fetch(`${server.baseUrl}/${resourceType}/${resourceId}`, {
      method: "GET",
      headers: { "Accept": "application/fhir+json" },
      redirect: "manual",
    });

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) throw new Error("Redirects are not followed to prevent SSRF");
    if (!response.ok) throw new Error(`Failed to fetch resource: HTTP ${response.status}`);

    return response.json();
  }

  async importPatientData(serverId: string, patientId: string, resourceTypes: string[], userId: string): Promise<FHIRDataExchange> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.createdBy !== SYSTEM_USER && server.createdBy !== userId) throw new Error("Server not found");

    for (const rt of resourceTypes) validateResourceType(rt);
    await validateFhirUrl(server.baseUrl);

    const exchangeId = `exchange-${randomUUID().slice(0, 8)}`;
    const exchange: FHIRDataExchange = {
      id: exchangeId, serverId, direction: "import",
      resourceType: resourceTypes.join(", "), resourceCount: 0,
      status: "in_progress", startedAt: new Date().toISOString(), details: [], createdBy: userId,
    };
    this.exchanges.set(exchangeId, exchange);
    logHipaaAudit("FHIR_IMPORT_STARTED", { userId, serverId, patientId, resourceTypes: resourceTypes.join(",") });

    try {
      let totalImported = 0;
      for (const resourceType of resourceTypes) {
        const bundle = await this.searchResources(serverId, { resourceType, params: { patient: patientId }, pageSize: 100 }, userId);
        if (bundle.entry) {
          for (const entry of bundle.entry) {
            if (entry.resource) {
              exchange.details.push({ resourceId: (entry.resource as any).id || "unknown", action: "created", message: `Imported ${resourceType} resource` });
              totalImported++;
            }
          }
        }
      }
      exchange.status = "completed";
      exchange.resourceCount = totalImported;
      exchange.completedAt = new Date().toISOString();
      this.exchanges.set(exchangeId, exchange);
      logHipaaAudit("FHIR_IMPORT_COMPLETED", { userId, serverId, patientId, resourceCount: totalImported });
      return exchange;
    } catch (error) {
      exchange.status = "failed";
      exchange.errorMessage = error instanceof Error ? error.message : "Import failed";
      exchange.completedAt = new Date().toISOString();
      this.exchanges.set(exchangeId, exchange);
      logHipaaAudit("FHIR_IMPORT_FAILED", { userId, serverId, error: exchange.errorMessage });
      return exchange;
    }
  }

  async exportPatientBundle(patientData: Record<string, unknown>[], serverId: string, userId: string): Promise<FHIRDataExchange> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error("Server not found");
    if (server.createdBy !== SYSTEM_USER && server.createdBy !== userId) throw new Error("Server not found");

    await validateFhirUrl(server.baseUrl);

    const exchangeId = `exchange-${randomUUID().slice(0, 8)}`;
    const exchange: FHIRDataExchange = {
      id: exchangeId, serverId, direction: "export", resourceType: "Bundle",
      resourceCount: patientData.length, status: "in_progress",
      startedAt: new Date().toISOString(), details: [], createdBy: userId,
    };
    this.exchanges.set(exchangeId, exchange);
    logHipaaAudit("FHIR_EXPORT_STARTED", { userId, serverId, resourceCount: patientData.length });

    try {
      const bundle: FHIRBundle = {
        resourceType: "Bundle", type: "transaction",
        entry: patientData.map(resource => ({ resource: resource as Record<string, unknown>, request: { method: "POST", url: (resource as any).resourceType } })),
      };

      const response = await fetch(server.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/fhir+json", "Accept": "application/fhir+json" },
        body: JSON.stringify(bundle),
        redirect: "manual",
      });

      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) throw new Error("Redirects are not followed to prevent SSRF");
      if (!response.ok) throw new Error(`Export failed: HTTP ${response.status}`);

      exchange.status = "completed";
      exchange.completedAt = new Date().toISOString();
      patientData.forEach((_, idx) => exchange.details.push({ resourceId: `resource-${idx}`, action: "created" }));
      this.exchanges.set(exchangeId, exchange);
      logHipaaAudit("FHIR_EXPORT_COMPLETED", { userId, serverId, resourceCount: patientData.length });
      return exchange;
    } catch (error) {
      exchange.status = "failed";
      exchange.errorMessage = error instanceof Error ? error.message : "Export failed";
      exchange.completedAt = new Date().toISOString();
      this.exchanges.set(exchangeId, exchange);
      logHipaaAudit("FHIR_EXPORT_FAILED", { userId, serverId, error: exchange.errorMessage });
      return exchange;
    }
  }

  getServers(userId: string): ExternalFHIRServer[] {
    return Array.from(this.servers.values()).filter(s => s.createdBy === SYSTEM_USER || s.createdBy === userId);
  }

  getServer(id: string, userId: string): ExternalFHIRServer | undefined {
    const server = this.servers.get(id);
    if (!server) return undefined;
    if (server.createdBy === SYSTEM_USER || server.createdBy === userId) return server;
    return undefined;
  }

  getExchanges(userId: string, serverId?: string): FHIRDataExchange[] {
    return Array.from(this.exchanges.values()).filter(e => {
      if (e.createdBy !== userId) return false;
      if (serverId) return e.serverId === serverId;
      return true;
    });
  }

  getExchange(id: string, userId: string): FHIRDataExchange | undefined {
    const exchange = this.exchanges.get(id);
    if (!exchange || exchange.createdBy !== userId) return undefined;
    return exchange;
  }

  removeServer(id: string, userId: string): boolean {
    const server = this.servers.get(id);
    if (!server || server.createdBy === SYSTEM_USER || server.createdBy !== userId) return false;
    this.servers.delete(id);
    logHipaaAudit("FHIR_SERVER_REMOVED", { userId, serverId: id, serverName: server.name });
    return true;
  }

  getSupportedSearchParams(resourceType: string): Array<{ name: string; type: string; description: string }> {
    const commonParams = [
      { name: "_id", type: "token", description: "Logical ID of the resource" },
      { name: "_lastUpdated", type: "date", description: "When the resource was last updated" },
      { name: "_profile", type: "uri", description: "Profiles this resource claims to conform to" },
      { name: "_tag", type: "token", description: "Tags applied to this resource" },
      { name: "_count", type: "number", description: "Maximum number of results per page" },
      { name: "_sort", type: "string", description: "Order of returned results" },
      { name: "_include", type: "string", description: "Include referenced resources" },
      { name: "_revinclude", type: "string", description: "Include resources that reference this" },
    ];

    const resourceParams: Record<string, Array<{ name: string; type: string; description: string }>> = {
      Patient: [
        { name: "family", type: "string", description: "Family (last) name" },
        { name: "given", type: "string", description: "Given (first) name" },
        { name: "name", type: "string", description: "Any part of the name" },
        { name: "birthdate", type: "date", description: "Date of birth" },
        { name: "gender", type: "token", description: "Gender of the patient" },
        { name: "identifier", type: "token", description: "Patient identifier (MRN, SSN, etc.)" },
        { name: "address", type: "string", description: "Address of the patient" },
        { name: "phone", type: "token", description: "Phone number" },
        { name: "email", type: "token", description: "Email address" },
      ],
      Observation: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "code", type: "token", description: "The code of the observation (LOINC)" },
        { name: "category", type: "token", description: "Category of observation" },
        { name: "date", type: "date", description: "Effective date of observation" },
        { name: "status", type: "token", description: "Status of the observation" },
        { name: "value-quantity", type: "quantity", description: "Quantity value" },
      ],
      Condition: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "code", type: "token", description: "Condition code (ICD-10, SNOMED)" },
        { name: "clinical-status", type: "token", description: "active | recurrence | relapse | inactive | remission | resolved" },
        { name: "verification-status", type: "token", description: "unconfirmed | provisional | differential | confirmed | refuted | entered-in-error" },
        { name: "category", type: "token", description: "Category of the condition" },
        { name: "onset-date", type: "date", description: "Date of onset" },
        { name: "recorded-date", type: "date", description: "Date condition was recorded" },
      ],
      MedicationRequest: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "medication", type: "reference", description: "Reference to the medication" },
        { name: "code", type: "token", description: "Medication code (RxNorm)" },
        { name: "status", type: "token", description: "active | on-hold | cancelled | completed | entered-in-error | stopped | draft | unknown" },
        { name: "intent", type: "token", description: "proposal | plan | order | original-order | reflex-order | filler-order | instance-order | option" },
        { name: "authoredon", type: "date", description: "When the prescription was written" },
        { name: "requester", type: "reference", description: "Who requested the medication" },
      ],
      AllergyIntolerance: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "code", type: "token", description: "Allergy or intolerance code" },
        { name: "clinical-status", type: "token", description: "active | inactive | resolved" },
        { name: "verification-status", type: "token", description: "unconfirmed | confirmed | refuted | entered-in-error" },
        { name: "type", type: "token", description: "allergy | intolerance" },
        { name: "category", type: "token", description: "food | medication | environment | biologic" },
        { name: "criticality", type: "token", description: "low | high | unable-to-assess" },
      ],
      Immunization: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "vaccine-code", type: "token", description: "Vaccine code (CVX)" },
        { name: "status", type: "token", description: "completed | entered-in-error | not-done" },
        { name: "date", type: "date", description: "Vaccination date" },
        { name: "location", type: "reference", description: "Where vaccination was administered" },
      ],
      Procedure: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "code", type: "token", description: "Procedure code (CPT, SNOMED)" },
        { name: "status", type: "token", description: "preparation | in-progress | not-done | on-hold | stopped | completed | entered-in-error | unknown" },
        { name: "date", type: "date", description: "When the procedure was performed" },
        { name: "performer", type: "reference", description: "Who performed the procedure" },
      ],
      DiagnosticReport: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "code", type: "token", description: "Report code (LOINC)" },
        { name: "category", type: "token", description: "Category of report" },
        { name: "status", type: "token", description: "registered | partial | preliminary | final" },
        { name: "date", type: "date", description: "Report date" },
        { name: "issued", type: "date", description: "When report was issued" },
      ],
      CarePlan: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "status", type: "token", description: "draft | active | on-hold | revoked | completed | entered-in-error | unknown" },
        { name: "intent", type: "token", description: "proposal | plan | order | option" },
        { name: "category", type: "token", description: "Type of care plan" },
        { name: "date", type: "date", description: "Time period plan is intended for" },
      ],
      Encounter: [
        { name: "patient", type: "reference", description: "The patient reference" },
        { name: "status", type: "token", description: "planned | arrived | triaged | in-progress | onleave | finished | cancelled" },
        { name: "class", type: "token", description: "Classification of encounter (AMB, IMP, EMER)" },
        { name: "type", type: "token", description: "Type of encounter" },
        { name: "date", type: "date", description: "Date of the encounter" },
        { name: "participant", type: "reference", description: "Practitioners involved" },
      ],
    };

    return [...commonParams, ...(resourceParams[resourceType] || [])];
  }
}

export const externalFhirConnector = new ExternalFHIRConnector();
