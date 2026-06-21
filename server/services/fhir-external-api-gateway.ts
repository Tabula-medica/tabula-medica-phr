import { z } from "zod";
import crypto from "crypto";
import { rbacService, type UserRole, type PermissionAction } from "./rbac-service";
import { fhirAuditService, type FhirAuditAction, type FhirAuditOutcome } from "./fhir-audit-service";

export type FHIRVersion = "R4" | "R5";
export type FHIROperation = "read" | "vread" | "update" | "patch" | "delete" | "create" | "search" | "capabilities" | "history" | "batch" | "transaction";

export interface OAuthScope {
  resource: string;
  action: "read" | "write" | "*";
  context: "patient" | "user" | "system";
}

export interface AuthContext {
  userId: string;
  userRole: UserRole;
  clientId: string;
  scopes: string[];
  patientContext?: string;
  sessionId?: string;
  tokenExpiry?: string;
}

export interface APIGatewayClient {
  id: string;
  name: string;
  description: string;
  clientId: string;
  clientSecretHash: string;
  redirectUris: string[];
  allowedScopes: string[];
  allowedResourceTypes: string[];
  fhirVersions: FHIRVersion[];
  isActive: boolean;
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  customProfiles?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GatewayRequest {
  id: string;
  clientId: string;
  authContext: AuthContext;
  fhirVersion: FHIRVersion;
  operation: FHIROperation;
  resourceType: string;
  resourceId?: string;
  versionId?: string;
  queryParams?: Record<string, string | string[]>;
  body?: unknown;
  headers: Record<string, string>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface GatewayResponse {
  success: boolean;
  statusCode: number;
  body?: unknown;
  headers?: Record<string, string>;
  operationOutcome?: FHIROperationOutcome;
}

export interface FHIROperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics?: string;
    details?: { text: string };
    location?: string[];
  }>;
}

export interface CustomProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  fhirVersion: FHIRVersion;
  resourceType: string;
  constraints: ProfileConstraint[];
  extensions: ProfileExtension[];
  isActive: boolean;
}

export interface ProfileConstraint {
  id: string;
  path: string;
  severity: "error" | "warning";
  human: string;
  expression?: string;
  xpath?: string;
}

export interface ProfileExtension {
  url: string;
  path: string;
  valueType: string;
  isRequired: boolean;
}

export interface CapabilityStatement {
  resourceType: "CapabilityStatement";
  status: "active" | "draft";
  date: string;
  kind: "instance";
  software: { name: string; version: string };
  fhirVersion: string;
  format: string[];
  rest: RestResource[];
}

interface RestResource {
  mode: "server";
  security?: {
    cors: boolean;
    service: Array<{ coding: Array<{ system: string; code: string }> }>;
    description: string;
  };
  resource: Array<{
    type: string;
    profile?: string;
    interaction: Array<{ code: string }>;
    versioning?: string;
    searchParam?: Array<{ name: string; type: string }>;
  }>;
}

const FHIR_RESOURCE_TYPES = [
  "Patient", "Observation", "Condition", "MedicationRequest", "Medication",
  "AllergyIntolerance", "Immunization", "Procedure", "DiagnosticReport",
  "CarePlan", "CareTeam", "Encounter", "DocumentReference", "Practitioner",
  "Organization", "Location", "Coverage", "Claim", "ExplanationOfBenefit",
  "Goal", "ServiceRequest", "Device", "DeviceMetric", "Provenance", "AuditEvent"
];

const SCOPE_TO_PERMISSION_MAP: Record<string, { action: PermissionAction; resource: string }> = {
  "patient/*.read": { action: "read", resource: "patient_records" },
  "patient/*.write": { action: "update", resource: "patient_records" },
  "patient/*.*": { action: "configure", resource: "patient_records" },
  "user/*.read": { action: "read", resource: "patient_records" },
  "user/*.write": { action: "update", resource: "patient_records" },
  "user/*.*": { action: "configure", resource: "patient_records" },
  "system/*.read": { action: "read", resource: "data_sources" },
  "system/*.write": { action: "update", resource: "data_sources" },
  "system/*.*": { action: "configure", resource: "system_config" },
};

const FHIR_OP_TO_SCOPE: Record<FHIROperation, "read" | "write"> = {
  read: "read",
  vread: "read",
  search: "read",
  capabilities: "read",
  history: "read",
  create: "write",
  update: "write",
  patch: "write",
  delete: "write",
  batch: "write",
  transaction: "write",
};

class FHIRExternalAPIGateway {
  private clients: Map<string, APIGatewayClient> = new Map();
  private customProfiles: Map<string, CustomProfile> = new Map();
  private rateLimitCounters: Map<string, { minute: number; hour: number; day: number; lastReset: { minute: number; hour: number; day: number } }> = new Map();
  private resourceStore: Map<string, Map<string, { resource: unknown; versions: Array<{ version: string; resource: unknown; timestamp: string }> }>> = new Map();

  constructor() {
    this.initializeSampleClients();
    this.initializeCustomProfiles();
    this.initializeSampleResources();
    console.log("[FHIR API Gateway] Service initialized");
    console.log(`[FHIR API Gateway] Clients: ${this.clients.size}`);
    console.log(`[FHIR API Gateway] Custom Profiles: ${this.customProfiles.size}`);
    console.log(`[FHIR API Gateway] Resource Types: ${FHIR_RESOURCE_TYPES.length}`);
  }

  private initializeSampleClients(): void {
    const clients: APIGatewayClient[] = [
      {
        id: "client-ehr-epic",
        name: "Fasten Health EHR Integration",
        description: "Fasten Health patient data exchange",
        clientId: "epic-mychart-client",
        clientSecretHash: crypto.createHash("sha256").update("epic-secret-123").digest("hex"),
        redirectUris: ["https://mychart.epic.com/callback", "https://localhost:3000/callback"],
        allowedScopes: ["patient/*.read", "patient/*.write", "launch/patient", "openid", "fhirUser"],
        allowedResourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Immunization"],
        fhirVersions: ["R4"],
        isActive: true,
        rateLimits: { requestsPerMinute: 60, requestsPerHour: 1000, requestsPerDay: 10000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "client-cerner",
        name: "Hospital Network Integration",
        description: "Hospital Network data exchange",
        clientId: "cerner-millennium-client",
        clientSecretHash: crypto.createHash("sha256").update("cerner-secret-456").digest("hex"),
        redirectUris: ["https://cerner.com/callback"],
        allowedScopes: ["patient/*.read", "user/*.read", "system/*.read", "openid"],
        allowedResourceTypes: ["Patient", "Observation", "Condition", "Encounter", "DiagnosticReport", "Procedure"],
        fhirVersions: ["R4", "R5"],
        isActive: true,
        rateLimits: { requestsPerMinute: 30, requestsPerHour: 500, requestsPerDay: 5000 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "client-analytics",
        name: "Population Health Analytics",
        description: "Bulk data analytics platform",
        clientId: "analytics-platform-client",
        clientSecretHash: crypto.createHash("sha256").update("analytics-secret-789").digest("hex"),
        redirectUris: ["https://analytics.example.com/callback"],
        allowedScopes: ["system/*.read", "system/*.write"],
        allowedResourceTypes: FHIR_RESOURCE_TYPES,
        fhirVersions: ["R4", "R5"],
        isActive: true,
        rateLimits: { requestsPerMinute: 100, requestsPerHour: 5000, requestsPerDay: 50000 },
        customProfiles: ["us-core-patient", "us-core-observation"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    clients.forEach(c => this.clients.set(c.id, c));
  }

  private initializeCustomProfiles(): void {
    const profiles: CustomProfile[] = [
      {
        id: "us-core-patient",
        name: "US Core Patient Profile",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
        version: "6.1.0",
        fhirVersion: "R4",
        resourceType: "Patient",
        constraints: [
          { id: "us-core-1", path: "Patient.name", severity: "error", human: "Patient.name is required", expression: "name.exists()" },
          { id: "us-core-2", path: "Patient.identifier", severity: "error", human: "At least one identifier is required", expression: "identifier.exists()" },
          { id: "us-core-3", path: "Patient.gender", severity: "error", human: "Gender is required", expression: "gender.exists()" },
        ],
        extensions: [
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", path: "Patient", valueType: "Extension", isRequired: false },
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", path: "Patient", valueType: "Extension", isRequired: false },
          { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", path: "Patient", valueType: "code", isRequired: false },
        ],
        isActive: true,
      },
      {
        id: "us-core-observation",
        name: "US Core Observation Profile",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
        version: "6.1.0",
        fhirVersion: "R4",
        resourceType: "Observation",
        constraints: [
          { id: "us-core-obs-1", path: "Observation.status", severity: "error", human: "Status is required", expression: "status.exists()" },
          { id: "us-core-obs-2", path: "Observation.category", severity: "error", human: "Category is required", expression: "category.exists()" },
          { id: "us-core-obs-3", path: "Observation.code", severity: "error", human: "Code is required (LOINC preferred)", expression: "code.exists()" },
          { id: "us-core-obs-4", path: "Observation.subject", severity: "error", human: "Subject reference is required", expression: "subject.exists()" },
        ],
        extensions: [],
        isActive: true,
      },
      {
        id: "us-core-condition",
        name: "US Core Condition Profile",
        url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
        version: "6.1.0",
        fhirVersion: "R4",
        resourceType: "Condition",
        constraints: [
          { id: "us-core-cond-1", path: "Condition.clinicalStatus", severity: "error", human: "Clinical status is required", expression: "clinicalStatus.exists()" },
          { id: "us-core-cond-2", path: "Condition.code", severity: "error", human: "Condition code is required", expression: "code.exists()" },
          { id: "us-core-cond-3", path: "Condition.subject", severity: "error", human: "Subject reference is required", expression: "subject.exists()" },
        ],
        extensions: [],
        isActive: true,
      },
    ];
    profiles.forEach(p => this.customProfiles.set(p.id, p));
  }

  private initializeSampleResources(): void {
    FHIR_RESOURCE_TYPES.forEach(type => {
      this.resourceStore.set(type, new Map());
    });

    const patients = this.resourceStore.get("Patient")!;
    patients.set("patient-001", {
      resource: {
        resourceType: "Patient",
        id: "patient-001",
        meta: { versionId: "1", lastUpdated: new Date().toISOString() },
        identifier: [{ system: "http://hospital.example.org/patient", value: "12345" }],
        name: [{ use: "official", family: "Smith", given: ["John", "Michael"] }],
        gender: "male",
        birthDate: "1980-05-15",
        address: [{ line: ["123 Main St"], city: "Boston", state: "MA", postalCode: "02101" }],
      },
      versions: [],
    });

    const observations = this.resourceStore.get("Observation")!;
    observations.set("obs-001", {
      resource: {
        resourceType: "Observation",
        id: "obs-001",
        meta: { versionId: "1", lastUpdated: new Date().toISOString() },
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
        code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
        subject: { reference: "Patient/patient-001" },
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: { value: 72, unit: "beats/minute", system: "http://unitsofmeasure.org", code: "/min" },
      },
      versions: [],
    });
  }

  parseScopes(scopeString: string): OAuthScope[] {
    return scopeString.split(" ").filter(Boolean).map(scope => {
      const match = scope.match(/^(patient|user|system)\/(\*|[A-Za-z]+)\.(\*|read|write)$/);
      if (match) {
        return {
          context: match[1] as "patient" | "user" | "system",
          resource: match[2],
          action: match[3] as "read" | "write" | "*",
        };
      }
      return null;
    }).filter(Boolean) as OAuthScope[];
  }

  checkScopeAuthorization(scopes: OAuthScope[], operation: FHIROperation, resourceType: string): { allowed: boolean; reason: string } {
    const requiredAction = FHIR_OP_TO_SCOPE[operation];
    
    for (const scope of scopes) {
      const resourceMatch = scope.resource === "*" || scope.resource === resourceType;
      const actionMatch = scope.action === "*" || scope.action === requiredAction;
      
      if (resourceMatch && actionMatch) {
        return { allowed: true, reason: `Scope ${scope.context}/${scope.resource}.${scope.action} authorizes ${operation} on ${resourceType}` };
      }
    }

    return { allowed: false, reason: `No scope authorizes ${operation} on ${resourceType}. Required: ${requiredAction}` };
  }

  async authorize(request: GatewayRequest): Promise<{ allowed: boolean; reason: string; auditId: string }> {
    const auditId = `auth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const { authContext, operation, resourceType, clientId } = request;

    const client = Array.from(this.clients.values()).find(c => c.clientId === clientId);
    if (!client) {
      return { allowed: false, reason: "Unknown client ID", auditId };
    }

    if (!client.isActive) {
      return { allowed: false, reason: "Client is disabled", auditId };
    }

    if (!client.allowedResourceTypes.includes(resourceType) && resourceType !== "CapabilityStatement") {
      return { allowed: false, reason: `Client not authorized for resource type: ${resourceType}`, auditId };
    }

    if (!client.fhirVersions.includes(request.fhirVersion)) {
      return { allowed: false, reason: `Client not authorized for FHIR version: ${request.fhirVersion}`, auditId };
    }

    const rateLimitResult = this.checkRateLimit(client);
    if (!rateLimitResult.allowed) {
      return { allowed: false, reason: rateLimitResult.reason, auditId };
    }

    const scopes = this.parseScopes(authContext.scopes.join(" "));
    const scopeAuth = this.checkScopeAuthorization(scopes, operation, resourceType);
    if (!scopeAuth.allowed && operation !== "capabilities") {
      return { allowed: false, reason: scopeAuth.reason, auditId };
    }

    const rbacAction = this.mapOperationToRBACAction(operation);
    const rbacDecision = await rbacService.checkAccess(
      authContext.userId,
      authContext.userRole,
      "patient_records",
      rbacAction,
      request.resourceId
    );

    if (!rbacDecision.allowed && operation !== "capabilities") {
      return { allowed: false, reason: `RBAC denied: ${rbacDecision.reason}`, auditId };
    }

    return { allowed: true, reason: "Authorization successful", auditId };
  }

  private mapOperationToRBACAction(operation: FHIROperation): PermissionAction {
    const mapping: Record<FHIROperation, PermissionAction> = {
      read: "read",
      vread: "read",
      search: "read",
      capabilities: "read",
      history: "read",
      create: "create",
      update: "update",
      patch: "update",
      delete: "delete",
      batch: "execute",
      transaction: "execute",
    };
    return mapping[operation];
  }

  private checkRateLimit(client: APIGatewayClient): { allowed: boolean; reason: string } {
    const now = Date.now();
    let counter = this.rateLimitCounters.get(client.id);

    if (!counter) {
      counter = {
        minute: 0,
        hour: 0,
        day: 0,
        lastReset: { minute: now, hour: now, day: now },
      };
      this.rateLimitCounters.set(client.id, counter);
    }

    if (now - counter.lastReset.minute > 60000) {
      counter.minute = 0;
      counter.lastReset.minute = now;
    }
    if (now - counter.lastReset.hour > 3600000) {
      counter.hour = 0;
      counter.lastReset.hour = now;
    }
    if (now - counter.lastReset.day > 86400000) {
      counter.day = 0;
      counter.lastReset.day = now;
    }

    if (counter.minute >= client.rateLimits.requestsPerMinute) {
      return { allowed: false, reason: "Rate limit exceeded: requests per minute" };
    }
    if (counter.hour >= client.rateLimits.requestsPerHour) {
      return { allowed: false, reason: "Rate limit exceeded: requests per hour" };
    }
    if (counter.day >= client.rateLimits.requestsPerDay) {
      return { allowed: false, reason: "Rate limit exceeded: requests per day" };
    }

    counter.minute++;
    counter.hour++;
    counter.day++;

    return { allowed: true, reason: "Within rate limits" };
  }

  validateAgainstProfile(resource: unknown, profileId?: string): { valid: boolean; issues: Array<{ severity: string; message: string; path: string }> } {
    const issues: Array<{ severity: string; message: string; path: string }> = [];
    const res = resource as Record<string, unknown>;

    if (!res || typeof res !== "object") {
      issues.push({ severity: "error", message: "Resource must be a valid object", path: "" });
      return { valid: false, issues };
    }

    const resourceType = res.resourceType as string;
    if (!resourceType) {
      issues.push({ severity: "error", message: "resourceType is required", path: "resourceType" });
      return { valid: false, issues };
    }

    if (profileId) {
      const profile = this.customProfiles.get(profileId);
      if (profile && profile.resourceType === resourceType) {
        for (const constraint of profile.constraints) {
          const pathParts = constraint.path.split(".").slice(1);
          let current: unknown = res;
          
          for (const part of pathParts) {
            if (current && typeof current === "object") {
              current = (current as Record<string, unknown>)[part];
            } else {
              current = undefined;
              break;
            }
          }

          if (!current && constraint.severity === "error") {
            issues.push({
              severity: constraint.severity,
              message: constraint.human,
              path: constraint.path,
            });
          }
        }
      }
    }

    return { valid: issues.filter(i => i.severity === "error").length === 0, issues };
  }

  async processRequest(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    let outcome: FhirAuditOutcome = "success";
    let response: GatewayResponse;

    try {
      const authResult = await this.authorize(request);
      if (!authResult.allowed) {
        outcome = "failure";
        response = this.createErrorResponse(403, "security", authResult.reason);
      } else {
        response = await this.executeOperation(request);
        outcome = response.success ? "success" : "failure";
      }
    } catch (error) {
      outcome = "failure";
      response = this.createErrorResponse(500, "exception", error instanceof Error ? error.message : "Internal server error");
    }

    const responseTime = Date.now() - startTime;
    await this.logAudit(request, response, outcome, responseTime);

    return response;
  }

  private async executeOperation(request: GatewayRequest): Promise<GatewayResponse> {
    const { operation, resourceType, resourceId, body, queryParams } = request;

    switch (operation) {
      case "capabilities":
        return this.getCapabilityStatement(request.fhirVersion);

      case "read":
        return this.readResource(resourceType, resourceId!);

      case "vread":
        return this.vreadResource(resourceType, resourceId!, request.versionId!);

      case "search":
        return this.searchResources(resourceType, queryParams || {});

      case "create":
        return this.createResource(resourceType, body, request.authContext.clientId);

      case "update":
        return this.updateResource(resourceType, resourceId!, body);

      case "patch":
        return this.patchResource(resourceType, resourceId!, body);

      case "delete":
        return this.deleteResource(resourceType, resourceId!);

      case "history":
        return this.getHistory(resourceType, resourceId);

      default:
        return this.createErrorResponse(400, "not-supported", `Operation ${operation} is not supported`);
    }
  }

  private getCapabilityStatement(fhirVersion: FHIRVersion): GatewayResponse {
    const statement: CapabilityStatement = {
      resourceType: "CapabilityStatement",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      software: { name: "Tabula Medica FHIR API Gateway", version: "1.0.0" },
      fhirVersion: fhirVersion === "R5" ? "5.0.0" : "4.0.1",
      format: ["application/fhir+json", "application/json"],
      rest: [
        {
          mode: "server",
          security: {
            cors: true,
            service: [
              { coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "SMART-on-FHIR" }] },
              { coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "OAuth" }] },
            ],
            description: "OAuth 2.0 with SMART on FHIR and PKCE support",
          },
          resource: FHIR_RESOURCE_TYPES.map(type => ({
            type,
            profile: this.getProfileForResource(type, fhirVersion),
            interaction: [
              { code: "read" },
              { code: "vread" },
              { code: "update" },
              { code: "patch" },
              { code: "delete" },
              { code: "create" },
              { code: "search-type" },
              { code: "history-instance" },
            ],
            versioning: "versioned",
            searchParam: this.getSearchParamsForResource(type),
          })),
        },
      ],
    };

    return { success: true, statusCode: 200, body: statement };
  }

  private getProfileForResource(resourceType: string, fhirVersion: FHIRVersion): string | undefined {
    const profile = Array.from(this.customProfiles.values()).find(
      p => p.resourceType === resourceType && p.fhirVersion === fhirVersion
    );
    return profile?.url;
  }

  private getSearchParamsForResource(resourceType: string): Array<{ name: string; type: string }> {
    const commonParams = [
      { name: "_id", type: "token" },
      { name: "_lastUpdated", type: "date" },
    ];

    const resourceSpecificParams: Record<string, Array<{ name: string; type: string }>> = {
      Patient: [
        { name: "identifier", type: "token" },
        { name: "name", type: "string" },
        { name: "birthdate", type: "date" },
        { name: "gender", type: "token" },
      ],
      Observation: [
        { name: "patient", type: "reference" },
        { name: "category", type: "token" },
        { name: "code", type: "token" },
        { name: "date", type: "date" },
      ],
      Condition: [
        { name: "patient", type: "reference" },
        { name: "clinical-status", type: "token" },
        { name: "code", type: "token" },
      ],
      MedicationRequest: [
        { name: "patient", type: "reference" },
        { name: "status", type: "token" },
        { name: "medication", type: "reference" },
      ],
    };

    return [...commonParams, ...(resourceSpecificParams[resourceType] || [])];
  }

  private readResource(resourceType: string, resourceId: string): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const entry = typeStore.get(resourceId);
    if (!entry) {
      return this.createErrorResponse(404, "not-found", `${resourceType}/${resourceId} not found`);
    }

    return {
      success: true,
      statusCode: 200,
      body: entry.resource,
      headers: {
        "ETag": `W/"${(entry.resource as { meta?: { versionId?: string } }).meta?.versionId || "1"}"`,
        "Last-Modified": (entry.resource as { meta?: { lastUpdated?: string } }).meta?.lastUpdated || new Date().toISOString(),
      },
    };
  }

  private vreadResource(resourceType: string, resourceId: string, versionId: string): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const entry = typeStore.get(resourceId);
    if (!entry) {
      return this.createErrorResponse(404, "not-found", `${resourceType}/${resourceId} not found`);
    }

    const version = entry.versions.find(v => v.version === versionId);
    if (version) {
      return { success: true, statusCode: 200, body: version.resource };
    }

    const currentVersion = (entry.resource as { meta?: { versionId?: string } }).meta?.versionId;
    if (currentVersion === versionId) {
      return { success: true, statusCode: 200, body: entry.resource };
    }

    return this.createErrorResponse(404, "not-found", `Version ${versionId} of ${resourceType}/${resourceId} not found`);
  }

  private searchResources(resourceType: string, queryParams: Record<string, string | string[]>): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const resources = Array.from(typeStore.values()).map(e => e.resource);
    
    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: resources.length,
      link: [
        { relation: "self", url: `/api/fhir-gateway/${resourceType}?${new URLSearchParams(queryParams as Record<string, string>).toString()}` },
      ],
      entry: resources.map(resource => ({
        fullUrl: `${resourceType}/${(resource as { id: string }).id}`,
        resource,
        search: { mode: "match" },
      })),
    };

    return { success: true, statusCode: 200, body: bundle };
  }

  private createResource(resourceType: string, body: unknown, clientId: string): GatewayResponse {
    const resource = body as Record<string, unknown>;
    
    if (!resource || resource.resourceType !== resourceType) {
      return this.createErrorResponse(400, "invalid", `Resource type mismatch: expected ${resourceType}`);
    }

    const validation = this.validateAgainstProfile(resource);
    if (!validation.valid) {
      return this.createErrorResponse(400, "invalid", validation.issues.map(i => i.message).join("; "));
    }

    const id = resource.id as string || `${resourceType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const versionId = "1";
    const timestamp = new Date().toISOString();

    const newResource = {
      ...resource,
      id,
      meta: {
        versionId,
        lastUpdated: timestamp,
        source: `urn:client:${clientId}`,
      },
    };

    const typeStore = this.resourceStore.get(resourceType);
    if (typeStore) {
      typeStore.set(id, { resource: newResource, versions: [] });
    }

    return {
      success: true,
      statusCode: 201,
      body: newResource,
      headers: {
        "Location": `/api/fhir-gateway/${resourceType}/${id}/_history/${versionId}`,
        "ETag": `W/"${versionId}"`,
      },
    };
  }

  private updateResource(resourceType: string, resourceId: string, body: unknown): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const existing = typeStore.get(resourceId);
    if (!existing) {
      return this.createResource(resourceType, body, "system");
    }

    const resource = body as Record<string, unknown>;
    const validation = this.validateAgainstProfile(resource);
    if (!validation.valid) {
      return this.createErrorResponse(400, "invalid", validation.issues.map(i => i.message).join("; "));
    }

    const currentVersion = (existing.resource as { meta?: { versionId?: string } }).meta?.versionId || "1";
    const newVersion = String(parseInt(currentVersion) + 1);
    const timestamp = new Date().toISOString();

    existing.versions.push({
      version: currentVersion,
      resource: existing.resource,
      timestamp: (existing.resource as { meta?: { lastUpdated?: string } }).meta?.lastUpdated || timestamp,
    });

    const updatedResource = {
      ...resource,
      id: resourceId,
      meta: {
        versionId: newVersion,
        lastUpdated: timestamp,
      },
    };

    existing.resource = updatedResource;

    return {
      success: true,
      statusCode: 200,
      body: updatedResource,
      headers: {
        "ETag": `W/"${newVersion}"`,
        "Last-Modified": timestamp,
      },
    };
  }

  private patchResource(resourceType: string, resourceId: string, body: unknown): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const existing = typeStore.get(resourceId);
    if (!existing) {
      return this.createErrorResponse(404, "not-found", `${resourceType}/${resourceId} not found`);
    }

    const patches = body as Array<{ op: string; path: string; value?: unknown }>;
    let resource = JSON.parse(JSON.stringify(existing.resource));

    for (const patch of patches) {
      const pathParts = patch.path.split("/").filter(Boolean);
      let target = resource;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        target = target[pathParts[i]];
      }

      const lastKey = pathParts[pathParts.length - 1];
      
      switch (patch.op) {
        case "add":
        case "replace":
          target[lastKey] = patch.value;
          break;
        case "remove":
          delete target[lastKey];
          break;
      }
    }

    return this.updateResource(resourceType, resourceId, resource);
  }

  private deleteResource(resourceType: string, resourceId: string): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    if (!typeStore.has(resourceId)) {
      return this.createErrorResponse(404, "not-found", `${resourceType}/${resourceId} not found`);
    }

    typeStore.delete(resourceId);

    return { success: true, statusCode: 204 };
  }

  private getHistory(resourceType: string, resourceId?: string): GatewayResponse {
    const typeStore = this.resourceStore.get(resourceType);
    if (!typeStore) {
      return this.createErrorResponse(404, "not-found", `Resource type ${resourceType} not found`);
    }

    const entries: Array<{ fullUrl: string; resource: unknown; request: { method: string; url: string } }> = [];

    if (resourceId) {
      const entry = typeStore.get(resourceId);
      if (!entry) {
        return this.createErrorResponse(404, "not-found", `${resourceType}/${resourceId} not found`);
      }

      entries.push({
        fullUrl: `${resourceType}/${resourceId}`,
        resource: entry.resource,
        request: { method: "PUT", url: `${resourceType}/${resourceId}` },
      });

      entry.versions.forEach(v => {
        entries.push({
          fullUrl: `${resourceType}/${resourceId}/_history/${v.version}`,
          resource: v.resource,
          request: { method: "PUT", url: `${resourceType}/${resourceId}` },
        });
      });
    } else {
      typeStore.forEach((entry, id) => {
        entries.push({
          fullUrl: `${resourceType}/${id}`,
          resource: entry.resource,
          request: { method: "PUT", url: `${resourceType}/${id}` },
        });
      });
    }

    const bundle = {
      resourceType: "Bundle",
      type: "history",
      total: entries.length,
      entry: entries,
    };

    return { success: true, statusCode: 200, body: bundle };
  }

  private createErrorResponse(statusCode: number, code: string, message: string): GatewayResponse {
    const operationOutcome: FHIROperationOutcome = {
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: statusCode >= 500 ? "fatal" : "error",
          code,
          diagnostics: message,
        },
      ],
    };

    return { success: false, statusCode, body: operationOutcome, operationOutcome };
  }

  private async logAudit(request: GatewayRequest, response: GatewayResponse, outcome: FhirAuditOutcome, responseTimeMs: number): Promise<void> {
    const auditAction: FhirAuditAction = this.mapOperationToAuditAction(request.operation);
    
    await fhirAuditService.log({
      userId: request.authContext.userId,
      userRole: request.authContext.userRole,
      action: auditAction,
      outcome,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      patientId: request.authContext.patientContext,
      fhirVersion: request.fhirVersion,
      operationType: `Gateway:${request.operation}`,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      requestPath: `/api/fhir-gateway/${request.fhirVersion.toLowerCase()}/${request.resourceType}${request.resourceId ? `/${request.resourceId}` : ""}`,
      requestMethod: this.operationToMethod(request.operation),
      queryParameters: request.queryParams as Record<string, string>,
      responseStatus: response.statusCode,
      responseTimeMs,
      phiAccessed: this.isPhiResource(request.resourceType),
      accessReason: "External API Gateway access",
      sourceSystem: request.authContext.clientId,
      metadata: {
        gatewayVersion: "1.0.0",
        scopes: request.authContext.scopes,
        sessionId: request.authContext.sessionId,
      },
    });
  }

  private mapOperationToAuditAction(operation: FHIROperation): FhirAuditAction {
    const mapping: Record<FHIROperation, FhirAuditAction> = {
      read: "read",
      vread: "read",
      search: "search",
      capabilities: "read",
      history: "read",
      create: "create",
      update: "update",
      patch: "update",
      delete: "delete",
      batch: "import",
      transaction: "import",
    };
    return mapping[operation];
  }

  private operationToMethod(operation: FHIROperation): string {
    const mapping: Record<FHIROperation, string> = {
      read: "GET",
      vread: "GET",
      search: "GET",
      capabilities: "GET",
      history: "GET",
      create: "POST",
      update: "PUT",
      patch: "PATCH",
      delete: "DELETE",
      batch: "POST",
      transaction: "POST",
    };
    return mapping[operation];
  }

  private isPhiResource(resourceType: string): boolean {
    const phiResources = ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", 
      "Immunization", "Procedure", "DiagnosticReport", "CarePlan", "Encounter", "DocumentReference"];
    return phiResources.includes(resourceType);
  }

  getClients(): APIGatewayClient[] {
    return Array.from(this.clients.values());
  }

  getClient(id: string): APIGatewayClient | undefined {
    return this.clients.get(id);
  }

  createClient(data: Omit<APIGatewayClient, "id" | "clientSecretHash" | "createdAt" | "updatedAt"> & { clientSecret: string }): APIGatewayClient {
    const id = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const client: APIGatewayClient = {
      id,
      ...data,
      clientSecretHash: crypto.createHash("sha256").update(data.clientSecret).digest("hex"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.clients.set(id, client);
    return client;
  }

  updateClient(id: string, updates: Partial<APIGatewayClient>): APIGatewayClient | null {
    const client = this.clients.get(id);
    if (!client) return null;

    const updated: APIGatewayClient = {
      ...client,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.clients.set(id, updated);
    return updated;
  }

  deleteClient(id: string): boolean {
    return this.clients.delete(id);
  }

  getCustomProfiles(): CustomProfile[] {
    return Array.from(this.customProfiles.values());
  }

  getCustomProfile(id: string): CustomProfile | undefined {
    return this.customProfiles.get(id);
  }

  createCustomProfile(profile: Omit<CustomProfile, "id">): CustomProfile {
    const id = `profile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newProfile: CustomProfile = { id, ...profile };
    this.customProfiles.set(id, newProfile);
    return newProfile;
  }

  getSupportedResourceTypes(): string[] {
    return FHIR_RESOURCE_TYPES;
  }

  getStatistics(): {
    totalClients: number;
    activeClients: number;
    totalProfiles: number;
    resourceTypes: number;
    rateLimitStatus: Array<{ clientId: string; minute: number; hour: number; day: number }>;
  } {
    const activeClients = Array.from(this.clients.values()).filter(c => c.isActive).length;
    const rateLimitStatus = Array.from(this.rateLimitCounters.entries()).map(([clientId, counter]) => ({
      clientId,
      minute: counter.minute,
      hour: counter.hour,
      day: counter.day,
    }));

    return {
      totalClients: this.clients.size,
      activeClients,
      totalProfiles: this.customProfiles.size,
      resourceTypes: FHIR_RESOURCE_TYPES.length,
      rateLimitStatus,
    };
  }
}

export const fhirExternalAPIGateway = new FHIRExternalAPIGateway();
