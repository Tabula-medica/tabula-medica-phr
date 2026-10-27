import crypto from "crypto";
import { google } from "googleapis";
import { gcsHIPAAStorage, type DocumentType, type StoredDocument, type UploadOptions } from "../gcs-hipaa-storage";
import { logger } from "./logger";

const GCP_PROJECT_ID = process.env.GCS_PROJECT_ID || "united-planet-485003-n7";
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || "tabula-medica-phi-storage";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GCP_DATASET_ID = process.env.GCP_DATASET_ID || "tabula-medica-data";
const GCP_FHIR_STORE_ID = process.env.GCP_FHIR_STORE_ID || "patient-records";

const FHIR_STORE_PARENT = `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/datasets/${GCP_DATASET_ID}/fhirStores/${GCP_FHIR_STORE_ID}`;

const healthcare = google.healthcare("v1");

let cachedAuthClient: any = null;

async function getHealthcareAuthClient() {
  if (cachedAuthClient) return cachedAuthClient;

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  cachedAuthClient = await auth.getClient();
  google.options({ auth: cachedAuthClient });
  return cachedAuthClient;
}

export interface PatientHealthData {
  patientId: string;
  dataType: DocumentType;
  content: string | Buffer;
  contentType: string;
  sourceSystem?: string;
  encounterDate?: string;
  providerName?: string;
  facilityName?: string;
  fhirResourceId?: string;
  fhirResourceType?: string;
  retentionDays?: number;
}

export interface PatientDataFilter {
  dataType?: DocumentType;
  startDate?: Date;
  endDate?: Date;
  sourceSystem?: string;
}

export interface HealthDataSummary {
  patientId: string;
  totalDocuments: number;
  totalSizeBytes: number;
  documentsByType: Record<string, { count: number; sizeBytes: number }>;
  lastUploadDate: Date | null;
  encryptionCoverage: number;
}

const HIPAA_RETENTION_YEARS = 7;
const DEFAULT_RETENTION_DAYS = HIPAA_RETENTION_YEARS * 365;

const FHIR_DOC_TYPE_MAP: Record<string, DocumentType> = {
  DiagnosticReport: "lab_result",
  DocumentReference: "clinical_note",
  ImagingStudy: "imaging",
  Encounter: "clinical_note",
  MedicationRequest: "prescription",
  Composition: "clinical_note",
  Condition: "clinical_note",
  Observation: "lab_result",
  Procedure: "clinical_note",
  Immunization: "clinical_note",
  AllergyIntolerance: "clinical_note",
  CarePlan: "clinical_note",
  ClinicalImpression: "clinical_note",
};

function sanitizeMetadataValue(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "").substring(0, 256);
}

function buildPHIMetadata(data: PatientHealthData): Record<string, string> {
  const patientHash = crypto.createHash("sha256").update(data.patientId).digest("hex").substring(0, 16);

  const meta: Record<string, string> = {
    "x-phi-patient-hash": patientHash,
    "x-phi-data-type": data.dataType,
    "x-phi-upload-timestamp": new Date().toISOString(),
    "x-phi-encryption": "AES-256-GCM",
    "x-phi-compliance": "HIPAA",
    "x-phi-project": GCP_PROJECT_ID,
  };

  if (data.sourceSystem) {
    meta["x-phi-source-system"] = sanitizeMetadataValue(data.sourceSystem);
  }
  if (data.encounterDate) {
    meta["x-phi-encounter-date"] = sanitizeMetadataValue(data.encounterDate);
  }
  if (data.providerName) {
    meta["x-phi-provider-hash"] = crypto.createHash("sha256").update(data.providerName).digest("hex").substring(0, 16);
  }
  if (data.facilityName) {
    meta["x-phi-facility"] = sanitizeMetadataValue(data.facilityName);
  }
  if (data.fhirResourceId) {
    meta["x-phi-fhir-resource-id"] = sanitizeMetadataValue(data.fhirResourceId);
  }
  if (data.fhirResourceType) {
    meta["x-phi-fhir-resource-type"] = sanitizeMetadataValue(data.fhirResourceType);
  }

  return meta;
}

export async function storePatientHealthData(data: PatientHealthData): Promise<StoredDocument> {
  if (!data.patientId || !data.content) {
    throw new Error("[HealthcareUtils] Patient ID and content are required");
  }

  const metadata = buildPHIMetadata(data);

  const options: UploadOptions = {
    contentType: data.contentType || "application/json",
    metadata,
    encryptionAlgorithm: "AES-256-GCM",
    retentionPeriodDays: data.retentionDays || DEFAULT_RETENTION_DAYS,
  };

  const sourceId = data.sourceSystem || "tabula-medica";

  logger.info("[HealthcareUtils] Storing patient health data", {
    category: "phi_access",
    metadata: {
      patientHash: metadata["x-phi-patient-hash"],
      dataType: data.dataType,
      sourceSystem: sourceId,
      contentType: data.contentType,
    },
  });

  const document = await gcsHIPAAStorage.uploadDocument(
    data.patientId,
    sourceId,
    data.dataType,
    data.content,
    options
  );

  if (data.retentionDays) {
    await gcsHIPAAStorage.setRetentionPolicy(document.id, data.retentionDays);
  }

  logger.info("[HealthcareUtils] Patient health data stored successfully", {
    category: "phi_access",
    metadata: {
      documentId: document.id,
      dataType: data.dataType,
      sizeBytes: document.sizeBytes,
    },
  });

  return document;
}

export async function retrievePatientHealthData(
  documentId: string,
  requestingUserId: string
): Promise<{ document: StoredDocument; data: Buffer }> {
  logger.info("[HealthcareUtils] Retrieving patient health data", {
    category: "phi_access",
    metadata: {
      documentId,
      requestingUser: crypto.createHash("sha256").update(requestingUserId).digest("hex").substring(0, 16),
    },
  });

  gcsHIPAAStorage.auditAccess(documentId, requestingUserId, "PATIENT_DATA_RETRIEVE");

  const result = await gcsHIPAAStorage.downloadDocument(documentId);

  logger.info("[HealthcareUtils] Patient health data retrieved", {
    category: "phi_access",
    metadata: {
      documentId,
      dataType: result.document.documentType,
      sizeBytes: result.document.sizeBytes,
    },
  });

  return result;
}

export async function listPatientDocuments(
  patientId: string,
  filters?: PatientDataFilter
): Promise<StoredDocument[]> {
  logger.info("[HealthcareUtils] Listing patient documents", {
    category: "phi_access",
    metadata: {
      patientHash: crypto.createHash("sha256").update(patientId).digest("hex").substring(0, 16),
      filters: filters ? { dataType: filters.dataType, hasDateRange: !!(filters.startDate || filters.endDate) } : null,
    },
  });

  const documents = await gcsHIPAAStorage.listDocuments(patientId, {
    documentType: filters?.dataType,
    startDate: filters?.startDate,
    endDate: filters?.endDate,
  });

  if (filters?.sourceSystem) {
    return documents.filter(doc => doc.sourceId === filters.sourceSystem);
  }

  return documents;
}

export async function deletePatientDocument(
  documentId: string,
  requestingUserId: string,
  reason: string
): Promise<void> {
  logger.info("[HealthcareUtils] Deleting patient document", {
    category: "phi_access",
    metadata: {
      documentId,
      requestingUser: crypto.createHash("sha256").update(requestingUserId).digest("hex").substring(0, 16),
      reason,
    },
  });

  gcsHIPAAStorage.auditAccess(documentId, requestingUserId, `DELETE_REQUESTED: ${reason}`);

  await gcsHIPAAStorage.deleteDocument(documentId);

  logger.info("[HealthcareUtils] Patient document deleted", {
    category: "phi_access",
    metadata: { documentId },
  });
}

export async function getPatientDataSummary(patientId: string): Promise<HealthDataSummary> {
  const stats = await gcsHIPAAStorage.getStorageStats(patientId);
  const documents = await gcsHIPAAStorage.listDocuments(patientId);

  let lastUploadDate: Date | null = null;
  for (const doc of documents) {
    if (!lastUploadDate || doc.uploadedAt > lastUploadDate) {
      lastUploadDate = doc.uploadedAt;
    }
  }

  const totalDocs = stats.encryptionStatus.encrypted + stats.encryptionStatus.unencrypted;
  const encryptionCoverage = totalDocs > 0 ? (stats.encryptionStatus.encrypted / totalDocs) * 100 : 100;

  return {
    patientId,
    totalDocuments: stats.totalDocuments,
    totalSizeBytes: stats.totalSizeBytes,
    documentsByType: stats.byType,
    lastUploadDate,
    encryptionCoverage,
  };
}

export async function generateSecureShareLink(
  documentId: string,
  requestingUserId: string,
  expiresInMinutes: number = 15
): Promise<string> {
  if (expiresInMinutes > 60) {
    throw new Error("[HealthcareUtils] Signed URLs cannot exceed 60 minutes for PHI documents");
  }

  gcsHIPAAStorage.auditAccess(documentId, requestingUserId, "SIGNED_URL_REQUESTED");

  const url = await gcsHIPAAStorage.generateSignedUrl(documentId, expiresInMinutes);

  logger.info("[HealthcareUtils] Secure share link generated", {
    category: "phi_access",
    metadata: {
      documentId,
      expiresInMinutes,
      requestingUser: crypto.createHash("sha256").update(requestingUserId).digest("hex").substring(0, 16),
    },
  });

  return url;
}

export function mapFhirResourceToDocType(fhirResourceType: string): DocumentType {
  return FHIR_DOC_TYPE_MAP[fhirResourceType] || "historical_data";
}

export async function storeFhirResource(
  patientId: string,
  fhirResource: Record<string, unknown>,
  sourceSystem?: string
): Promise<StoredDocument> {
  const resourceType = (fhirResource.resourceType as string) || "Unknown";
  const resourceId = (fhirResource.id as string) || crypto.randomUUID();
  const dataType = mapFhirResourceToDocType(resourceType);

  return storePatientHealthData({
    patientId,
    dataType,
    content: JSON.stringify(fhirResource),
    contentType: "application/fhir+json",
    sourceSystem: sourceSystem || "fhir-import",
    fhirResourceId: resourceId,
    fhirResourceType: resourceType,
    retentionDays: DEFAULT_RETENTION_DAYS,
  });
}

export async function storeBatchFhirResources(
  patientId: string,
  resources: Record<string, unknown>[],
  sourceSystem?: string
): Promise<{ stored: StoredDocument[]; errors: { resource: string; error: string }[] }> {
  const stored: StoredDocument[] = [];
  const errors: { resource: string; error: string }[] = [];

  for (const resource of resources) {
    const resourceType = (resource.resourceType as string) || "Unknown";
    const resourceId = (resource.id as string) || "unknown";
    try {
      const doc = await storeFhirResource(patientId, resource, sourceSystem);
      stored.push(doc);
    } catch (err: any) {
      errors.push({
        resource: `${resourceType}/${resourceId}`,
        error: err.message || "Unknown error",
      });
      logger.error("[HealthcareUtils] Failed to store FHIR resource", {
        category: "phi_access",
        metadata: { resourceType, resourceId, error: err.message },
      });
    }
  }

  logger.info("[HealthcareUtils] Batch FHIR import complete", {
    category: "phi_access",
    metadata: {
      patientHash: crypto.createHash("sha256").update(patientId).digest("hex").substring(0, 16),
      stored: stored.length,
      errors: errors.length,
      total: resources.length,
    },
  });

  return { stored, errors };
}

export function getStorageConfig(): {
  projectId: string;
  bucketName: string;
  configured: boolean;
  encryptionMethod: string;
  retentionPolicy: string;
} {
  return {
    projectId: GCP_PROJECT_ID,
    bucketName: GCS_BUCKET_NAME,
    configured: gcsHIPAAStorage.isConfigured(),
    encryptionMethod: "AES-256-GCM",
    retentionPolicy: `${HIPAA_RETENTION_YEARS} years (${DEFAULT_RETENTION_DAYS} days)`,
  };
}

export function getAccessAuditTrail(limit: number = 100) {
  return gcsHIPAAStorage.getAuditTrail(limit);
}

export interface FhirPatientInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  mrn?: string;
  ssn?: string;
}

function buildFhirPatientResource(patientData: FhirPatientInput): Record<string, unknown> {
  const given: string[] = [patientData.firstName];
  if (patientData.middleName && patientData.middleName !== "NMN") {
    given.push(patientData.middleName);
  }

  const resource: Record<string, unknown> = {
    resourceType: "Patient",
    name: [{
      use: "official",
      family: patientData.lastName,
      given,
    }],
  };

  if (patientData.gender) {
    resource.gender = patientData.gender;
  }
  if (patientData.dob) {
    resource.birthDate = patientData.dob;
  }

  const telecoms: Record<string, unknown>[] = [];
  if (patientData.phone) {
    telecoms.push({ system: "phone", value: patientData.phone, use: "home" });
  }
  if (patientData.email) {
    telecoms.push({ system: "email", value: patientData.email, use: "home" });
  }
  if (telecoms.length > 0) {
    resource.telecom = telecoms;
  }

  if (patientData.addressLine || patientData.city || patientData.state || patientData.postalCode) {
    resource.address = [{
      use: "home",
      line: patientData.addressLine ? [patientData.addressLine] : undefined,
      city: patientData.city,
      state: patientData.state,
      postalCode: patientData.postalCode,
      country: patientData.country || "US",
    }];
  }

  const identifiers: Record<string, unknown>[] = [];
  if (patientData.mrn) {
    identifiers.push({
      use: "usual",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR" }] },
      system: `urn:oid:${GCP_PROJECT_ID}`,
      value: patientData.mrn,
    });
  }
  if (patientData.ssn) {
    identifiers.push({
      use: "official",
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "SS" }] },
      system: "http://hl7.org/fhir/sid/us-ssn",
      value: patientData.ssn,
    });
  }
  if (identifiers.length > 0) {
    resource.identifier = identifiers;
  }

  return resource;
}

export async function createFhirPatient(patientData: FhirPatientInput): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  const resource = buildFhirPatientResource(patientData);

  logger.info("[HealthcareUtils] Creating FHIR Patient in GCP Healthcare API", {
    category: "phi_access",
    metadata: {
      fhirStore: FHIR_STORE_PARENT,
      patientLastNameHash: crypto.createHash("sha256").update(patientData.lastName).digest("hex").substring(0, 12),
    },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.create({
      parent: FHIR_STORE_PARENT,
      type: "Patient",
      requestBody: resource,
    });

    logger.info("[HealthcareUtils] FHIR Patient created successfully", {
      category: "phi_access",
      metadata: {
        fhirId: (response.data as any)?.id,
        resourceType: "Patient",
      },
    });

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error creating FHIR Patient", {
      category: "phi_access",
      metadata: { error: error.message, code: error.code },
    });
    throw error;
  }
}

export async function readFhirPatient(patientId: string): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  const name = `${FHIR_STORE_PARENT}/fhir/Patient/${patientId}`;

  logger.info("[HealthcareUtils] Reading FHIR Patient", {
    category: "phi_access",
    metadata: { fhirId: patientId },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.read({
      name,
    });

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error reading FHIR Patient", {
      category: "phi_access",
      metadata: { fhirId: patientId, error: error.message },
    });
    throw error;
  }
}

export async function updateFhirPatient(patientId: string, patientData: FhirPatientInput): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  const resource = buildFhirPatientResource(patientData);
  resource.id = patientId;

  const name = `${FHIR_STORE_PARENT}/fhir/Patient/${patientId}`;

  logger.info("[HealthcareUtils] Updating FHIR Patient", {
    category: "phi_access",
    metadata: { fhirId: patientId },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.update({
      name,
      requestBody: resource,
    });

    logger.info("[HealthcareUtils] FHIR Patient updated", {
      category: "phi_access",
      metadata: { fhirId: patientId },
    });

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error updating FHIR Patient", {
      category: "phi_access",
      metadata: { fhirId: patientId, error: error.message },
    });
    throw error;
  }
}

export async function deleteFhirPatient(patientId: string): Promise<void> {
  await getHealthcareAuthClient();

  const name = `${FHIR_STORE_PARENT}/fhir/Patient/${patientId}`;

  logger.info("[HealthcareUtils] Deleting FHIR Patient", {
    category: "phi_access",
    metadata: { fhirId: patientId },
  });

  try {
    await healthcare.projects.locations.datasets.fhirStores.fhir.delete({
      name,
    });

    logger.info("[HealthcareUtils] FHIR Patient deleted", {
      category: "phi_access",
      metadata: { fhirId: patientId },
    });
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error deleting FHIR Patient", {
      category: "phi_access",
      metadata: { fhirId: patientId, error: error.message },
    });
    throw error;
  }
}

export async function searchFhirPatients(
  params: { family?: string; given?: string; birthdate?: string; gender?: string; identifier?: string }
): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  const searchParams: string[] = [];
  if (params.family) searchParams.push(`family=${encodeURIComponent(params.family)}`);
  if (params.given) searchParams.push(`given=${encodeURIComponent(params.given)}`);
  if (params.birthdate) searchParams.push(`birthdate=${encodeURIComponent(params.birthdate)}`);
  if (params.gender) searchParams.push(`gender=${encodeURIComponent(params.gender)}`);
  if (params.identifier) searchParams.push(`identifier=${encodeURIComponent(params.identifier)}`);

  const parent = FHIR_STORE_PARENT;
  const resourceType = "Patient";

  logger.info("[HealthcareUtils] Searching FHIR Patients", {
    category: "phi_access",
    metadata: { paramCount: searchParams.length },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.search({
      parent,
      requestBody: { resourceType, searchParams: searchParams.join("&") },
    } as any);

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error searching FHIR Patients", {
      category: "phi_access",
      metadata: { error: error.message },
    });
    throw error;
  }
}

export async function createFhirResource(
  resourceType: string,
  resource: Record<string, unknown>
): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  resource.resourceType = resourceType;

  logger.info("[HealthcareUtils] Creating FHIR resource in GCP Healthcare API", {
    category: "phi_access",
    metadata: {
      resourceType,
      fhirStore: FHIR_STORE_PARENT,
    },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.create({
      parent: FHIR_STORE_PARENT,
      type: resourceType,
      requestBody: resource,
    });

    logger.info("[HealthcareUtils] FHIR resource created", {
      category: "phi_access",
      metadata: {
        resourceType,
        fhirId: (response.data as any)?.id,
      },
    });

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error creating FHIR resource", {
      category: "phi_access",
      metadata: { resourceType, error: error.message },
    });
    throw error;
  }
}

export async function getPatientEverything(patientId: string): Promise<Record<string, unknown>> {
  await getHealthcareAuthClient();

  const name = `${FHIR_STORE_PARENT}/fhir/Patient/${patientId}`;

  logger.info("[HealthcareUtils] Fetching Patient $everything", {
    category: "phi_access",
    metadata: { fhirId: patientId },
  });

  try {
    const response = await healthcare.projects.locations.datasets.fhirStores.fhir.PatientEverything({
      name,
    });

    logger.info("[HealthcareUtils] Patient $everything retrieved", {
      category: "phi_access",
      metadata: {
        fhirId: patientId,
        totalEntries: (response.data as any)?.total || (response.data as any)?.entry?.length || 0,
      },
    });

    return response.data as Record<string, unknown>;
  } catch (error: any) {
    logger.error("[HealthcareUtils] Error fetching Patient $everything", {
      category: "phi_access",
      metadata: { fhirId: patientId, error: error.message },
    });
    throw error;
  }
}

export function getFhirStoreConfig() {
  return {
    projectId: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    datasetId: GCP_DATASET_ID,
    fhirStoreId: GCP_FHIR_STORE_ID,
    parent: FHIR_STORE_PARENT,
  };
}
