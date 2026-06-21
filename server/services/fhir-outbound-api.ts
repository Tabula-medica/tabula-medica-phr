import { randomUUID, createHash } from "crypto";

/**
 * FHIR Outbound API Service
 * 
 * SECURITY NOTES FOR PRODUCTION DEPLOYMENT:
 * 1. All outbound endpoints must require authentication and authorization
 * 2. Server credentials must be stored encrypted (use secrets management)
 * 3. Validate target server URLs against an allowlist
 * 4. Rate limiting should prevent abuse of external server connections
 * 5. US Core validation is simplified - production requires full profile validation
 * 
 * This service provides outbound FHIR operations to external servers.
 * Production deployments require additional security hardening.
 */

export interface OutboundRequest {
  id: string;
  serverId: string;
  resourceType: string;
  operation: "create" | "update" | "delete" | "transaction";
  status: "pending" | "in_progress" | "completed" | "failed" | "validation_failed";
  requestedBy: string;
  requestedAt: string;
  completedAt?: string;
  resourceId?: string;
  localResourceId?: string;
  responseResourceId?: string;
  errorMessage?: string;
  validationErrors: string[];
}

export interface USCoreResource {
  resourceType: string;
  id?: string;
  meta?: {
    profile?: string[];
    lastUpdated?: string;
    versionId?: string;
  };
  [key: string]: unknown;
}

export interface TransactionBundle {
  resourceType: "Bundle";
  type: "transaction";
  entry: Array<{
    fullUrl?: string;
    resource: USCoreResource;
    request: {
      method: "POST" | "PUT" | "DELETE";
      url: string;
    };
  }>;
}

export interface TransactionResult {
  id: string;
  requestedBy?: string;
  status: "completed" | "partial" | "failed";
  totalEntries: number;
  successful: number;
  failed: number;
  results: Array<{
    resourceType: string;
    localId?: string;
    remoteId?: string;
    status: "created" | "updated" | "deleted" | "failed";
    error?: string;
  }>;
  completedAt: string;
}

const US_CORE_PROFILES: Record<string, string> = {
  Patient: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  Observation: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
  Condition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns",
  MedicationRequest: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  AllergyIntolerance: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  Procedure: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  Immunization: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  DiagnosticReport: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
  CarePlan: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
  Goal: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
  Encounter: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  DocumentReference: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
};

const VITAL_SIGNS_PROFILES: Record<string, string> = {
  "blood-pressure": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure",
  "body-weight": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-weight",
  "body-height": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-height",
  "body-temperature": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-temperature",
  "heart-rate": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-heart-rate",
  "respiratory-rate": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-respiratory-rate",
  "pulse-oximetry": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-pulse-oximetry",
  "bmi": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-bmi",
};

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const sanitizedDetails = Object.entries(details)
    .map(([k, v]) => `${k}:${typeof v === "string" && k.includes("Id") ? hashIdentifier(v) : v}`)
    .join(" ");
  console.log(`[HIPAA-AUDIT][OutboundFHIR] ${timestamp} - ${action} - ${sanitizedDetails}`);
}

interface USCoreValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  profile: string;
}

function validateUSCoreResource(resource: USCoreResource): USCoreValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resourceType = resource.resourceType;
  const profile = US_CORE_PROFILES[resourceType] || "";

  if (!resourceType) {
    errors.push("resourceType is required");
    return { isValid: false, errors, warnings, profile: "" };
  }

  switch (resourceType) {
    case "Patient":
      if (!resource.name || !Array.isArray(resource.name) || resource.name.length === 0) {
        errors.push("Patient.name is required (US Core)");
      } else {
        const name = resource.name[0] as { family?: string; given?: string[] };
        if (!name.family) errors.push("Patient.name.family is required (US Core)");
      }
      if (!resource.gender) errors.push("Patient.gender is required (US Core)");
      if (!resource.identifier || !Array.isArray(resource.identifier) || resource.identifier.length === 0) {
        errors.push("Patient.identifier is required (US Core)");
      }
      break;

    case "Observation":
      if (!resource.status) errors.push("Observation.status is required");
      if (!resource.code) errors.push("Observation.code is required");
      if (!resource.subject) errors.push("Observation.subject is required (patient reference)");
      if (!resource.category) {
        warnings.push("Observation.category is recommended (US Core)");
      }
      break;

    case "Condition":
      if (!resource.clinicalStatus) errors.push("Condition.clinicalStatus is required (US Core)");
      if (!resource.verificationStatus) warnings.push("Condition.verificationStatus is recommended");
      if (!resource.category) errors.push("Condition.category is required (US Core)");
      if (!resource.code) errors.push("Condition.code is required (US Core)");
      if (!resource.subject) errors.push("Condition.subject is required");
      break;

    case "MedicationRequest":
      if (!resource.status) errors.push("MedicationRequest.status is required");
      if (!resource.intent) errors.push("MedicationRequest.intent is required");
      if (!resource.medication && !resource.medicationCodeableConcept && !resource.medicationReference) {
        errors.push("MedicationRequest must have medication[x] (US Core)");
      }
      if (!resource.subject) errors.push("MedicationRequest.subject is required");
      if (!resource.requester) errors.push("MedicationRequest.requester is required (US Core)");
      if (!resource.authoredOn) warnings.push("MedicationRequest.authoredOn is recommended (US Core)");
      break;

    case "AllergyIntolerance":
      if (!resource.clinicalStatus) warnings.push("AllergyIntolerance.clinicalStatus is recommended");
      if (!resource.code) errors.push("AllergyIntolerance.code is required (US Core)");
      if (!resource.patient) errors.push("AllergyIntolerance.patient is required");
      break;

    case "Procedure":
      if (!resource.status) errors.push("Procedure.status is required");
      if (!resource.code) errors.push("Procedure.code is required (US Core)");
      if (!resource.subject) errors.push("Procedure.subject is required");
      if (!resource.performed && !resource.performedDateTime && !resource.performedPeriod) {
        errors.push("Procedure.performed[x] is required (US Core)");
      }
      break;

    case "Immunization":
      if (!resource.status) errors.push("Immunization.status is required");
      if (!resource.vaccineCode) errors.push("Immunization.vaccineCode is required (US Core)");
      if (!resource.patient) errors.push("Immunization.patient is required");
      if (!resource.occurrence && !resource.occurrenceDateTime && !resource.occurrenceString) {
        errors.push("Immunization.occurrence[x] is required (US Core)");
      }
      if (resource.primarySource === undefined) {
        errors.push("Immunization.primarySource is required (US Core)");
      }
      break;

    case "DiagnosticReport":
      if (!resource.status) errors.push("DiagnosticReport.status is required");
      if (!resource.category) errors.push("DiagnosticReport.category is required (US Core)");
      if (!resource.code) errors.push("DiagnosticReport.code is required (US Core)");
      if (!resource.subject) errors.push("DiagnosticReport.subject is required");
      if (!resource.effective && !resource.effectiveDateTime && !resource.effectivePeriod) {
        errors.push("DiagnosticReport.effective[x] is required (US Core)");
      }
      break;

    case "CarePlan":
      if (!resource.status) errors.push("CarePlan.status is required");
      if (!resource.intent) errors.push("CarePlan.intent is required");
      if (!resource.category) errors.push("CarePlan.category is required (US Core)");
      if (!resource.subject) errors.push("CarePlan.subject is required");
      break;

    case "Goal":
      if (!resource.lifecycleStatus) errors.push("Goal.lifecycleStatus is required");
      if (!resource.description) errors.push("Goal.description is required (US Core)");
      if (!resource.subject) errors.push("Goal.subject is required");
      break;

    case "Encounter":
      if (!resource.status) errors.push("Encounter.status is required");
      if (!resource.class) errors.push("Encounter.class is required");
      if (!resource.type) errors.push("Encounter.type is required (US Core)");
      if (!resource.subject) errors.push("Encounter.subject is required");
      break;

    case "DocumentReference":
      if (!resource.status) errors.push("DocumentReference.status is required");
      if (!resource.type) errors.push("DocumentReference.type is required (US Core)");
      if (!resource.category) errors.push("DocumentReference.category is required (US Core)");
      if (!resource.subject) errors.push("DocumentReference.subject is required");
      if (!resource.content || !Array.isArray(resource.content) || resource.content.length === 0) {
        errors.push("DocumentReference.content is required");
      }
      break;

    default:
      warnings.push(`No US Core validation rules defined for ${resourceType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    profile,
  };
}

function ensureUSCoreProfile(resource: USCoreResource): USCoreResource {
  const resourceType = resource.resourceType;
  const profile = US_CORE_PROFILES[resourceType];

  if (!profile) {
    return resource;
  }

  const meta = resource.meta || {};
  const existingProfiles = meta.profile || [];

  if (!existingProfiles.includes(profile)) {
    return {
      ...resource,
      meta: {
        ...meta,
        profile: [...existingProfiles, profile],
      },
    };
  }

  return resource;
}

class FHIROutboundAPI {
  private outboundRequests: Map<string, OutboundRequest> = new Map();
  private transactionResults: Map<string, TransactionResult> = new Map();
  private serverTokens: Map<string, { token: string; expiresAt: Date }> = new Map();
  private serverConfigs: Map<string, { baseUrl: string; authMethod: string; credentials?: unknown; ownerId?: string }> = new Map();

  constructor() {
    console.log("[OutboundFHIR] FHIR Outbound API service initialized");
    console.log("[OutboundFHIR] Supported US Core profiles:", Object.keys(US_CORE_PROFILES).length);
    console.log("[OutboundFHIR] Vital signs profiles:", Object.keys(VITAL_SIGNS_PROFILES).length);
  }

  registerServer(
    serverId: string,
    baseUrl: string,
    authMethod: string,
    credentials?: unknown,
    ownerId?: string
  ): void {
    this.serverConfigs.set(serverId, { baseUrl, authMethod, credentials, ownerId });
    logHipaaAudit("OUTBOUND_SERVER_REGISTERED", { serverId, authMethod });
  }

  private checkServerOwnership(serverId: string, callerId: string): void {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Server '${serverId}' not registered`);
    }
    if (config.ownerId && config.ownerId !== callerId) {
      throw new Error("Access denied: server not owned by caller");
    }
  }

  private async getAuthHeaders(serverId: string): Promise<Record<string, string>> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      return {};
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
    };

    if (config.authMethod === "bearer") {
      const token = this.serverTokens.get(serverId);
      if (token && token.expiresAt > new Date()) {
        headers["Authorization"] = `Bearer ${token.token}`;
      }
    } else if (config.authMethod === "basic") {
      const creds = config.credentials as { username: string; password: string };
      if (creds) {
        const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");
        headers["Authorization"] = `Basic ${encoded}`;
      }
    }

    return headers;
  }

  validateResource(resource: USCoreResource): USCoreValidationResult {
    return validateUSCoreResource(resource);
  }

  async createResource(
    serverId: string,
    resource: USCoreResource,
    userId: string,
    enforceUSCore: boolean = true
  ): Promise<OutboundRequest> {
    this.checkServerOwnership(serverId, userId);
    const requestId = `outbound-${randomUUID().slice(0, 8)}`;
    const request: OutboundRequest = {
      id: requestId,
      serverId,
      resourceType: resource.resourceType,
      operation: "create",
      status: "pending",
      requestedBy: userId,
      requestedAt: new Date().toISOString(),
      localResourceId: resource.id,
      validationErrors: [],
    };

    this.outboundRequests.set(requestId, request);

    logHipaaAudit("OUTBOUND_CREATE_INITIATED", {
      requestId,
      serverId,
      resourceType: resource.resourceType,
      userId,
    });

    if (enforceUSCore) {
      const validation = validateUSCoreResource(resource);
      if (!validation.isValid) {
        request.status = "validation_failed";
        request.validationErrors = validation.errors;
        request.completedAt = new Date().toISOString();
        this.outboundRequests.set(requestId, request);

        logHipaaAudit("OUTBOUND_VALIDATION_FAILED", {
          requestId,
          errors: validation.errors.length,
        });

        return request;
      }

      resource = ensureUSCoreProfile(resource);
    }

    const config = this.serverConfigs.get(serverId);
    if (!config) {
      request.status = "failed";
      request.errorMessage = "Server not configured";
      request.completedAt = new Date().toISOString();
      this.outboundRequests.set(requestId, request);
      return request;
    }

    try {
      request.status = "in_progress";
      this.outboundRequests.set(requestId, request);

      const headers = await this.getAuthHeaders(serverId);
      const url = `${config.baseUrl}/${resource.resourceType}`;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const createdResource = await response.json();
      request.status = "completed";
      request.responseResourceId = createdResource.id;
      request.completedAt = new Date().toISOString();

      logHipaaAudit("OUTBOUND_CREATE_COMPLETED", {
        requestId,
        serverId,
        resourceType: resource.resourceType,
        responseResourceId: createdResource.id,
      });
    } catch (error) {
      request.status = "failed";
      request.errorMessage = error instanceof Error ? error.message : "Unknown error";
      request.completedAt = new Date().toISOString();

      logHipaaAudit("OUTBOUND_CREATE_FAILED", {
        requestId,
        serverId,
        error: request.errorMessage,
      });
    }

    this.outboundRequests.set(requestId, request);
    return request;
  }

  async updateResource(
    serverId: string,
    resource: USCoreResource,
    userId: string,
    enforceUSCore: boolean = true
  ): Promise<OutboundRequest> {
    this.checkServerOwnership(serverId, userId);
    const requestId = `outbound-${randomUUID().slice(0, 8)}`;
    const request: OutboundRequest = {
      id: requestId,
      serverId,
      resourceType: resource.resourceType,
      operation: "update",
      status: "pending",
      requestedBy: userId,
      requestedAt: new Date().toISOString(),
      resourceId: resource.id,
      localResourceId: resource.id,
      validationErrors: [],
    };

    this.outboundRequests.set(requestId, request);

    logHipaaAudit("OUTBOUND_UPDATE_INITIATED", {
      requestId,
      serverId,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      userId,
    });

    if (!resource.id) {
      request.status = "failed";
      request.errorMessage = "Resource ID is required for update";
      request.completedAt = new Date().toISOString();
      this.outboundRequests.set(requestId, request);
      return request;
    }

    if (enforceUSCore) {
      const validation = validateUSCoreResource(resource);
      if (!validation.isValid) {
        request.status = "validation_failed";
        request.validationErrors = validation.errors;
        request.completedAt = new Date().toISOString();
        this.outboundRequests.set(requestId, request);
        return request;
      }

      resource = ensureUSCoreProfile(resource);
    }

    const config = this.serverConfigs.get(serverId);
    if (!config) {
      request.status = "failed";
      request.errorMessage = "Server not configured";
      request.completedAt = new Date().toISOString();
      this.outboundRequests.set(requestId, request);
      return request;
    }

    try {
      request.status = "in_progress";
      this.outboundRequests.set(requestId, request);

      const headers = await this.getAuthHeaders(serverId);
      const url = `${config.baseUrl}/${resource.resourceType}/${resource.id}`;

      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const updatedResource = await response.json();
      request.status = "completed";
      request.responseResourceId = updatedResource.id;
      request.completedAt = new Date().toISOString();

      logHipaaAudit("OUTBOUND_UPDATE_COMPLETED", {
        requestId,
        serverId,
        resourceType: resource.resourceType,
        resourceId: resource.id,
      });
    } catch (error) {
      request.status = "failed";
      request.errorMessage = error instanceof Error ? error.message : "Unknown error";
      request.completedAt = new Date().toISOString();

      logHipaaAudit("OUTBOUND_UPDATE_FAILED", {
        requestId,
        serverId,
        error: request.errorMessage,
      });
    }

    this.outboundRequests.set(requestId, request);
    return request;
  }

  async pushTransaction(
    serverId: string,
    bundle: TransactionBundle,
    userId: string,
    enforceUSCore: boolean = true
  ): Promise<TransactionResult> {
    this.checkServerOwnership(serverId, userId);
    const resultId = `transaction-${randomUUID().slice(0, 8)}`;

    logHipaaAudit("OUTBOUND_TRANSACTION_INITIATED", {
      resultId,
      serverId,
      entryCount: bundle.entry.length,
      userId,
    });

    if (enforceUSCore) {
      for (let i = 0; i < bundle.entry.length; i++) {
        const entry = bundle.entry[i];
        const validation = validateUSCoreResource(entry.resource);
        if (!validation.isValid) {
          const result: TransactionResult = {
            id: resultId,
            requestedBy: userId,
            status: "failed",
            totalEntries: bundle.entry.length,
            successful: 0,
            failed: bundle.entry.length,
            results: [{
              resourceType: entry.resource.resourceType,
              localId: entry.resource.id,
              status: "failed",
              error: `Entry ${i}: ${validation.errors.join("; ")}`,
            }],
            completedAt: new Date().toISOString(),
          };
          this.transactionResults.set(resultId, result);

          logHipaaAudit("OUTBOUND_TRANSACTION_VALIDATION_FAILED", {
            resultId,
            entryIndex: i,
            errors: validation.errors.length,
          });

          return result;
        }

        bundle.entry[i].resource = ensureUSCoreProfile(entry.resource);
      }
    }

    const config = this.serverConfigs.get(serverId);
    if (!config) {
      const result: TransactionResult = {
        id: resultId,
        requestedBy: userId,
        status: "failed",
        totalEntries: bundle.entry.length,
        successful: 0,
        failed: bundle.entry.length,
        results: [{
          resourceType: "Bundle",
          status: "failed",
          error: "Server not configured",
        }],
        completedAt: new Date().toISOString(),
      };
      this.transactionResults.set(resultId, result);
      return result;
    }

    try {
      const headers = await this.getAuthHeaders(serverId);
      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(bundle),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseBundle = await response.json();
      const results: TransactionResult["results"] = [];
      let successful = 0;
      let failed = 0;

      if (responseBundle.entry) {
        for (let i = 0; i < responseBundle.entry.length; i++) {
          const responseEntry = responseBundle.entry[i];
          const originalEntry = bundle.entry[i];

          const location = responseEntry.response?.location;
          const status = responseEntry.response?.status;

          if (status && status.startsWith("2")) {
            successful++;
            results.push({
              resourceType: originalEntry.resource.resourceType,
              localId: originalEntry.resource.id,
              remoteId: location?.split("/").pop(),
              status: originalEntry.request.method === "DELETE" ? "deleted" :
                      originalEntry.request.method === "POST" ? "created" : "updated",
            });
          } else {
            failed++;
            results.push({
              resourceType: originalEntry.resource.resourceType,
              localId: originalEntry.resource.id,
              status: "failed",
              error: responseEntry.response?.outcome?.issue?.[0]?.diagnostics || "Unknown error",
            });
          }
        }
      }

      const result: TransactionResult = {
        id: resultId,
        requestedBy: userId,
        status: failed === 0 ? "completed" : failed === bundle.entry.length ? "failed" : "partial",
        totalEntries: bundle.entry.length,
        successful,
        failed,
        results,
        completedAt: new Date().toISOString(),
      };

      this.transactionResults.set(resultId, result);

      logHipaaAudit("OUTBOUND_TRANSACTION_COMPLETED", {
        resultId,
        serverId,
        totalEntries: bundle.entry.length,
        successful,
        failed,
      });

      return result;
    } catch (error) {
      const result: TransactionResult = {
        id: resultId,
        requestedBy: userId,
        status: "failed",
        totalEntries: bundle.entry.length,
        successful: 0,
        failed: bundle.entry.length,
        results: [{
          resourceType: "Bundle",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        }],
        completedAt: new Date().toISOString(),
      };

      this.transactionResults.set(resultId, result);

      logHipaaAudit("OUTBOUND_TRANSACTION_FAILED", {
        resultId,
        serverId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return result;
    }
  }

  createVitalSignObservation(
    vitalType: keyof typeof VITAL_SIGNS_PROFILES,
    patientReference: string,
    value: number,
    unit: string,
    effectiveDateTime: string,
    additionalData?: Record<string, unknown>
  ): USCoreResource {
    const codes: Record<string, { code: string; display: string }> = {
      "blood-pressure": { code: "85354-9", display: "Blood pressure panel" },
      "body-weight": { code: "29463-7", display: "Body weight" },
      "body-height": { code: "8302-2", display: "Body height" },
      "body-temperature": { code: "8310-5", display: "Body temperature" },
      "heart-rate": { code: "8867-4", display: "Heart rate" },
      "respiratory-rate": { code: "9279-1", display: "Respiratory rate" },
      "pulse-oximetry": { code: "59408-5", display: "Oxygen saturation" },
      "bmi": { code: "39156-5", display: "Body mass index" },
    };

    const codeInfo = codes[vitalType] || { code: "unknown", display: vitalType };
    const profile = VITAL_SIGNS_PROFILES[vitalType];

    const observation: USCoreResource = {
      resourceType: "Observation",
      meta: {
        profile: profile ? [profile] : [],
      },
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "vital-signs",
              display: "Vital Signs",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://loinc.org",
            code: codeInfo.code,
            display: codeInfo.display,
          },
        ],
      },
      subject: {
        reference: patientReference,
      },
      effectiveDateTime,
      valueQuantity: {
        value,
        unit,
        system: "http://unitsofmeasure.org",
        code: unit,
      },
      ...additionalData,
    };

    return observation;
  }

  createCarePlanProgress(
    carePlanId: string,
    patientReference: string,
    status: string,
    activities: Array<{ description: string; status: string }>,
    notes?: string
  ): USCoreResource {
    const carePlan: USCoreResource = {
      resourceType: "CarePlan",
      id: carePlanId,
      meta: {
        profile: [US_CORE_PROFILES.CarePlan],
      },
      status,
      intent: "plan",
      category: [
        {
          coding: [
            {
              system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
              code: "assess-plan",
              display: "Assessment and Plan of Treatment",
            },
          ],
        },
      ],
      subject: {
        reference: patientReference,
      },
      activity: activities.map(a => ({
        detail: {
          status: a.status,
          description: a.description,
        },
      })),
    };

    if (notes) {
      carePlan.note = [{ text: notes }];
    }

    return carePlan;
  }

  getOutboundRequests(filters?: {
    serverId?: string;
    status?: string;
    resourceType?: string;
    requestedBy?: string;
  }): OutboundRequest[] {
    let requests = Array.from(this.outboundRequests.values());

    if (filters?.requestedBy) {
      requests = requests.filter(r => r.requestedBy === filters.requestedBy);
    }
    if (filters?.serverId) {
      requests = requests.filter(r => r.serverId === filters.serverId);
    }
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    if (filters?.resourceType) {
      requests = requests.filter(r => r.resourceType === filters.resourceType);
    }

    return requests.sort((a, b) => 
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  getOutboundRequest(id: string): OutboundRequest | undefined {
    return this.outboundRequests.get(id);
  }

  getTransactionResults(userId?: string): TransactionResult[] {
    const all = Array.from(this.transactionResults.values());
    return userId ? all.filter(r => r.requestedBy === userId) : all;
  }

  getOutboundRequestsForOwner(ownerId: string, filters?: {
    serverId?: string;
    status?: string;
    resourceType?: string;
  }): OutboundRequest[] {
    let requests = Array.from(this.outboundRequests.values()).filter(r => r.requestedBy === ownerId);

    if (filters?.serverId) {
      requests = requests.filter(r => r.serverId === filters.serverId);
    }
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    if (filters?.resourceType) {
      requests = requests.filter(r => r.resourceType === filters.resourceType);
    }

    return requests.sort((a, b) =>
      new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  getOutboundRequestForOwner(id: string, ownerId: string): OutboundRequest | undefined {
    const request = this.outboundRequests.get(id);
    if (!request || request.requestedBy !== ownerId) return undefined;
    return request;
  }

  getTransactionResultsForOwner(ownerId: string): TransactionResult[] {
    return Array.from(this.transactionResults.values()).filter(r => r.requestedBy === ownerId);
  }

  getTransactionResult(id: string): TransactionResult | undefined {
    return this.transactionResults.get(id);
  }

  getSupportedProfiles(): typeof US_CORE_PROFILES {
    return { ...US_CORE_PROFILES };
  }

  getVitalSignProfiles(): typeof VITAL_SIGNS_PROFILES {
    return { ...VITAL_SIGNS_PROFILES };
  }
}

export const fhirOutboundAPI = new FHIROutboundAPI();
