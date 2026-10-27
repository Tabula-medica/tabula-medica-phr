import { storage } from "./storage";
import type { InsertHealthRecord, InsertDataSource } from "@shared/schema";
import { mapFhirToHealthRecord } from "./fhir-client";

// Audit logging types for GCP Healthcare operations
export type GCPOperationType = 
  | "authenticate"
  | "list_datasets"
  | "list_fhir_stores"
  | "create_dataset"
  | "delete_dataset"
  | "get_dataset"
  | "create_fhir_store"
  | "delete_fhir_store"
  | "get_fhir_store"
  | "search_patients"
  | "get_patient_everything"
  | "get_resource"
  | "search_resources"
  | "create_resource"
  | "update_resource"
  | "delete_resource"
  | "bulk_export_start"
  | "bulk_export_status"
  | "bulk_import_start"
  | "bulk_import_status"
  | "sync_source";

export interface GCPAuditLogEntry {
  timestamp: Date;
  operation: GCPOperationType;
  userId?: string;
  projectId: string;
  location?: string;
  datasetId?: string;
  fhirStoreId?: string;
  resourceType?: string;
  resourceId?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  durationMs?: number;
}

// In-memory audit log storage (can be replaced with database storage)
const gcpAuditLogs: GCPAuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 10000;

export function logGCPOperation(entry: GCPAuditLogEntry): void {
  gcpAuditLogs.unshift(entry);
  if (gcpAuditLogs.length > MAX_AUDIT_LOGS) {
    gcpAuditLogs.pop();
  }
}

export function getGCPAuditLogs(
  filters?: {
    userId?: string;
    projectId?: string;
    operation?: GCPOperationType;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
  },
  limit: number = 100
): GCPAuditLogEntry[] {
  let logs = gcpAuditLogs;

  if (filters) {
    logs = logs.filter((log) => {
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.projectId && log.projectId !== filters.projectId) return false;
      if (filters.operation && log.operation !== filters.operation) return false;
      if (filters.success !== undefined && log.success !== filters.success) return false;
      if (filters.startDate && log.timestamp < filters.startDate) return false;
      if (filters.endDate && log.timestamp > filters.endDate) return false;
      return true;
    });
  }

  return logs.slice(0, limit);
}

export function getGCPAuditStats(projectId?: string): {
  totalOperations: number;
  successRate: number;
  operationCounts: Record<string, number>;
  avgDurationMs: number;
} {
  const logs = projectId 
    ? gcpAuditLogs.filter(l => l.projectId === projectId)
    : gcpAuditLogs;

  const successful = logs.filter(l => l.success).length;
  const operationCounts: Record<string, number> = {};
  let totalDuration = 0;
  let durationCount = 0;

  for (const log of logs) {
    operationCounts[log.operation] = (operationCounts[log.operation] || 0) + 1;
    if (log.durationMs) {
      totalDuration += log.durationMs;
      durationCount++;
    }
  }

  return {
    totalOperations: logs.length,
    successRate: logs.length > 0 ? successful / logs.length : 1,
    operationCounts,
    avgDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
  };
}

// Bulk operation job tracking
export interface BulkOperationJob {
  id: string;
  type: "export" | "import";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  projectId: string;
  location: string;
  datasetId: string;
  fhirStoreId: string;
  userId: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  totalResources?: number;
  processedResources?: number;
  gcpOperationName?: string;
  gcsUri?: string;
  resourceTypes?: string[];
  errorMessage?: string;
  metadata?: Record<string, any>;
}

const bulkJobs = new Map<string, BulkOperationJob>();

export function getBulkJob(jobId: string): BulkOperationJob | undefined {
  return bulkJobs.get(jobId);
}

export function listBulkJobs(userId: string, limit: number = 50): BulkOperationJob[] {
  return Array.from(bulkJobs.values())
    .filter(job => job.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

function updateBulkJob(jobId: string, updates: Partial<BulkOperationJob>): void {
  const job = bulkJobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
  }
}

function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface GCPHealthcareConfig {
  projectId: string;
  location: string;
  datasetId: string;
  fhirStoreId: string;
}

export interface GCPCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

const GCP_HEALTHCARE_SCOPE = "https://www.googleapis.com/auth/cloud-healthcare";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function createJWT(credentials: GCPCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: credentials.private_key_id,
  };

  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: expiry,
    scope: GCP_HEALTHCARE_SCOPE,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const signature = sign.sign(credentials.private_key, "base64url");

  return `${unsignedToken}.${signature}`;
}

export async function getAccessToken(credentials: GCPCredentials): Promise<string> {
  const jwt = await createJWT(credentials);

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data: TokenResponse = await response.json();
  return data.access_token;
}

export function buildFhirBaseUrl(config: GCPHealthcareConfig): string {
  return `https://healthcare.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/datasets/${config.datasetId}/fhirStores/${config.fhirStoreId}/fhir`;
}

export async function listFhirStores(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string
): Promise<Array<{ name: string; version: string }>> {
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list FHIR stores: ${error}`);
  }

  const data = await response.json();
  return (data.fhirStores || []).map((store: any) => ({
    name: store.name.split("/").pop(),
    version: store.version || "R4",
  }));
}

export async function listDatasets(
  credentials: GCPCredentials,
  projectId: string,
  location: string
): Promise<string[]> {
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list datasets: ${error}`);
  }

  const data = await response.json();
  return (data.datasets || []).map((ds: any) => ds.name.split("/").pop());
}

export async function getCapabilityStatement(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig
): Promise<any> {
  const accessToken = await getAccessToken(credentials);
  const url = `${buildFhirBaseUrl(config)}/metadata`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get capability statement: ${error}`);
  }

  return response.json();
}

export async function searchPatients(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  searchParams?: Record<string, string>
): Promise<any[]> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  
  const params = new URLSearchParams(searchParams || {});
  const url = `${baseUrl}/Patient${params.toString() ? `?${params}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search patients: ${error}`);
  }

  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}

export async function getPatientEverything(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  patientId: string
): Promise<any[]> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  const url = `${baseUrl}/Patient/${patientId}/$everything`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get patient data: ${error}`);
  }

  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}

export async function getFhirResource(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  resourceType: string,
  resourceId: string
): Promise<any> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  const url = `${baseUrl}/${resourceType}/${resourceId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get resource: ${error}`);
  }

  return response.json();
}

export async function searchFhirResources(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  resourceType: string,
  searchParams?: Record<string, string>
): Promise<any[]> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  
  const params = new URLSearchParams(searchParams || {});
  const url = `${baseUrl}/${resourceType}${params.toString() ? `?${params}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/fhir+json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search ${resourceType}: ${error}`);
  }

  const bundle = await response.json();
  return bundle.entry?.map((e: any) => e.resource) || [];
}

export async function createFhirResource(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  resource: any
): Promise<any> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  const url = `${baseUrl}/${resource.resourceType}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
    },
    body: JSON.stringify(resource),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create resource: ${error}`);
  }

  return response.json();
}

export async function updateFhirResource(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  resource: any
): Promise<any> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  const url = `${baseUrl}/${resource.resourceType}/${resource.id}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/fhir+json",
      Accept: "application/fhir+json",
    },
    body: JSON.stringify(resource),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update resource: ${error}`);
  }

  return response.json();
}

export async function deleteFhirResource(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  resourceType: string,
  resourceId: string
): Promise<void> {
  const accessToken = await getAccessToken(credentials);
  const baseUrl = buildFhirBaseUrl(config);
  const url = `${baseUrl}/${resourceType}/${resourceId}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete resource: ${error}`);
  }
}

export async function syncGCPHealthcareSource(
  sourceId: string,
  credentials: GCPCredentials
): Promise<number> {
  const source = await storage.getDataSource(sourceId);
  if (!source || source.type !== "gcp_healthcare") {
    throw new Error("Invalid GCP Healthcare source");
  }

  const gcpConfig = (source as any).gcpConfig as GCPHealthcareConfig;
  if (!gcpConfig) {
    throw new Error("Missing GCP Healthcare configuration");
  }

  const patientId = source.patientId;
  if (!patientId) {
    throw new Error("Missing patient ID for sync");
  }

  const resources = await getPatientEverything(credentials, gcpConfig, patientId);

  let importedCount = 0;
  for (const resource of resources) {
    if (resource.resourceType === "Patient") continue;

    const record = mapFhirToHealthRecord(resource, source.userId, source.id);
    if (record) {
      const existingRecords = await storage.getHealthRecords(source.userId);
      const exists = existingRecords.some(
        (r: { fhirResourceId: string | null; fhirResourceType: string | null }) => 
          r.fhirResourceId === resource.id && r.fhirResourceType === resource.resourceType
      );

      if (!exists) {
        await storage.createHealthRecord(record);
        importedCount++;
      }
    }
  }

  await storage.updateDataSource(sourceId, {
    lastSyncAt: new Date(),
    recordCount: (source.recordCount || 0) + importedCount,
  });

  return importedCount;
}

export async function validateGCPCredentials(credentials: GCPCredentials): Promise<boolean> {
  try {
    await getAccessToken(credentials);
    return true;
  } catch {
    return false;
  }
}

export async function discoverGCPResources(
  credentials: GCPCredentials,
  projectId: string,
  location: string
): Promise<{
  datasets: string[];
  fhirStores: Map<string, Array<{ name: string; version: string }>>;
}> {
  const datasets = await listDatasets(credentials, projectId, location);
  const fhirStores = new Map<string, Array<{ name: string; version: string }>>();

  for (const dataset of datasets) {
    try {
      const stores = await listFhirStores(credentials, projectId, location, dataset);
      fhirStores.set(dataset, stores);
    } catch (error) {
      console.warn(`Failed to list stores for dataset ${dataset}:`, error);
      fhirStores.set(dataset, []);
    }
  }

  return { datasets, fhirStores };
}

export const GCP_LOCATIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "us-west1",
  "us-west2",
  "us-west3",
  "us-west4",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "europe-west4",
  "europe-west6",
  "asia-east1",
  "asia-east2",
  "asia-northeast1",
  "asia-northeast2",
  "asia-northeast3",
  "asia-south1",
  "asia-southeast1",
  "asia-southeast2",
  "australia-southeast1",
  "northamerica-northeast1",
  "southamerica-east1",
];

// ============================================
// Dataset Management
// ============================================

export async function createDataset(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  userId?: string
): Promise<{ name: string; timeZone: string }> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets?datasetId=${datasetId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeZone: "UTC",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create dataset: ${error}`);
    }

    const data = await response.json();
    
    logGCPOperation({
      timestamp: new Date(),
      operation: "create_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: true,
      durationMs: Date.now() - startTime,
    });

    return {
      name: data.name,
      timeZone: data.timeZone || "UTC",
    };
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "create_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

export async function deleteDataset(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  userId?: string
): Promise<void> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete dataset: ${error}`);
    }

    logGCPOperation({
      timestamp: new Date(),
      operation: "delete_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: true,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "delete_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

export async function getDataset(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  userId?: string
): Promise<{ name: string; timeZone: string }> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get dataset: ${error}`);
    }

    const data = await response.json();
    
    logGCPOperation({
      timestamp: new Date(),
      operation: "get_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: true,
      durationMs: Date.now() - startTime,
    });

    return {
      name: data.name,
      timeZone: data.timeZone || "UTC",
    };
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "get_dataset",
      userId,
      projectId,
      location,
      datasetId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

// ============================================
// FHIR Store Management
// ============================================

export interface FHIRStoreConfig {
  version?: "DSTU2" | "STU3" | "R4" | "R5";
  enableUpdateCreate?: boolean;
  disableReferentialIntegrity?: boolean;
  disableResourceVersioning?: boolean;
  labels?: Record<string, string>;
  notificationConfigs?: Array<{
    pubsubTopic: string;
    sendForBulkImport?: boolean;
  }>;
}

export async function createFhirStore(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  fhirStoreId: string,
  config?: FHIRStoreConfig,
  userId?: string
): Promise<{ name: string; version: string }> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores?fhirStoreId=${fhirStoreId}`;

  try {
    const body: any = {
      version: config?.version || "R4",
      enableUpdateCreate: config?.enableUpdateCreate ?? true,
      disableReferentialIntegrity: config?.disableReferentialIntegrity ?? false,
      disableResourceVersioning: config?.disableResourceVersioning ?? false,
    };

    if (config?.labels) {
      body.labels = config.labels;
    }

    if (config?.notificationConfigs && config.notificationConfigs.length > 0) {
      body.notificationConfigs = config.notificationConfigs.map((nc) => ({
        pubsubTopic: nc.pubsubTopic,
        sendForBulkImport: nc.sendForBulkImport ?? false,
      }));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create FHIR store: ${error}`);
    }

    const data = await response.json();
    
    logGCPOperation({
      timestamp: new Date(),
      operation: "create_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: true,
      metadata: { version: body.version, hasPubSub: !!(config?.notificationConfigs?.length) },
      durationMs: Date.now() - startTime,
    });

    return {
      name: data.name,
      version: data.version || body.version,
    };
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "create_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

export async function deleteFhirStore(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  fhirStoreId: string,
  userId?: string
): Promise<void> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores/${fhirStoreId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete FHIR store: ${error}`);
    }

    logGCPOperation({
      timestamp: new Date(),
      operation: "delete_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: true,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "delete_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

export async function getFhirStore(
  credentials: GCPCredentials,
  projectId: string,
  location: string,
  datasetId: string,
  fhirStoreId: string,
  userId?: string
): Promise<{
  name: string;
  version: string;
  enableUpdateCreate: boolean;
  disableReferentialIntegrity: boolean;
  disableResourceVersioning: boolean;
  labels?: Record<string, string>;
}> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores/${fhirStoreId}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get FHIR store: ${error}`);
    }

    const data = await response.json();
    
    logGCPOperation({
      timestamp: new Date(),
      operation: "get_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: true,
      durationMs: Date.now() - startTime,
    });

    return {
      name: data.name,
      version: data.version || "R4",
      enableUpdateCreate: data.enableUpdateCreate ?? true,
      disableReferentialIntegrity: data.disableReferentialIntegrity ?? false,
      disableResourceVersioning: data.disableResourceVersioning ?? false,
      labels: data.labels,
    };
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "get_fhir_store",
      userId,
      projectId,
      location,
      datasetId,
      fhirStoreId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

// ============================================
// Bulk Export Operations (Async)
// ============================================

export interface BulkExportOptions {
  gcsDestination: string;
  resourceTypes?: string[];
  since?: string;
}

export async function startBulkExport(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  options: BulkExportOptions,
  userId: string
): Promise<BulkOperationJob> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const baseUrl = `https://healthcare.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/datasets/${config.datasetId}/fhirStores/${config.fhirStoreId}`;
  const url = `${baseUrl}:export`;

  const jobId = generateJobId();
  const job: BulkOperationJob = {
    id: jobId,
    type: "export",
    status: "pending",
    projectId: config.projectId,
    location: config.location,
    datasetId: config.datasetId,
    fhirStoreId: config.fhirStoreId,
    userId,
    createdAt: new Date(),
    gcsUri: options.gcsDestination,
    resourceTypes: options.resourceTypes,
  };
  bulkJobs.set(jobId, job);

  try {
    const body: any = {
      gcsDestination: {
        uriPrefix: options.gcsDestination,
      },
    };

    if (options.resourceTypes && options.resourceTypes.length > 0) {
      body.resourceTypes = options.resourceTypes;
    }

    if (options.since) {
      body._since = options.since;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start bulk export: ${error}`);
    }

    const data = await response.json();
    
    updateBulkJob(jobId, {
      status: "running",
      startedAt: new Date(),
      gcpOperationName: data.name,
    });

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_export_start",
      userId,
      projectId: config.projectId,
      location: config.location,
      datasetId: config.datasetId,
      fhirStoreId: config.fhirStoreId,
      success: true,
      metadata: { jobId, operationName: data.name, gcsUri: options.gcsDestination },
      durationMs: Date.now() - startTime,
    });

    return bulkJobs.get(jobId)!;
  } catch (error) {
    updateBulkJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_export_start",
      userId,
      projectId: config.projectId,
      location: config.location,
      datasetId: config.datasetId,
      fhirStoreId: config.fhirStoreId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });

    throw error;
  }
}

export async function checkBulkExportStatus(
  credentials: GCPCredentials,
  jobId: string,
  userId?: string
): Promise<BulkOperationJob> {
  const job = bulkJobs.get(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  if (!job.gcpOperationName) {
    return job;
  }

  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/${job.gcpOperationName}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check export status: ${error}`);
    }

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        updateBulkJob(jobId, {
          status: "failed",
          completedAt: new Date(),
          errorMessage: data.error.message,
        });
      } else {
        const metadata = data.metadata || {};
        updateBulkJob(jobId, {
          status: "completed",
          completedAt: new Date(),
          totalResources: metadata.resourceCount,
          processedResources: metadata.resourceCount,
          progress: 100,
        });
      }
    } else {
      const metadata = data.metadata || {};
      if (metadata.counter) {
        updateBulkJob(jobId, {
          processedResources: parseInt(metadata.counter),
        });
      }
    }

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_export_status",
      userId,
      projectId: job.projectId,
      location: job.location,
      datasetId: job.datasetId,
      fhirStoreId: job.fhirStoreId,
      success: true,
      metadata: { jobId, done: data.done },
      durationMs: Date.now() - startTime,
    });

    return bulkJobs.get(jobId)!;
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_export_status",
      userId,
      projectId: job.projectId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

// ============================================
// Bulk Import Operations (Async)
// ============================================

export interface BulkImportOptions {
  gcsSource: string;
  contentStructure?: "BUNDLE" | "RESOURCE" | "BUNDLE_PRETTY" | "RESOURCE_PRETTY";
}

export async function startBulkImport(
  credentials: GCPCredentials,
  config: GCPHealthcareConfig,
  options: BulkImportOptions,
  userId: string
): Promise<BulkOperationJob> {
  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const baseUrl = `https://healthcare.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/datasets/${config.datasetId}/fhirStores/${config.fhirStoreId}`;
  const url = `${baseUrl}:import`;

  const jobId = generateJobId();
  const job: BulkOperationJob = {
    id: jobId,
    type: "import",
    status: "pending",
    projectId: config.projectId,
    location: config.location,
    datasetId: config.datasetId,
    fhirStoreId: config.fhirStoreId,
    userId,
    createdAt: new Date(),
    gcsUri: options.gcsSource,
  };
  bulkJobs.set(jobId, job);

  try {
    const body = {
      contentStructure: options.contentStructure || "RESOURCE",
      gcsSource: {
        uri: options.gcsSource,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start bulk import: ${error}`);
    }

    const data = await response.json();
    
    updateBulkJob(jobId, {
      status: "running",
      startedAt: new Date(),
      gcpOperationName: data.name,
    });

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_import_start",
      userId,
      projectId: config.projectId,
      location: config.location,
      datasetId: config.datasetId,
      fhirStoreId: config.fhirStoreId,
      success: true,
      metadata: { jobId, operationName: data.name, gcsUri: options.gcsSource },
      durationMs: Date.now() - startTime,
    });

    return bulkJobs.get(jobId)!;
  } catch (error) {
    updateBulkJob(jobId, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_import_start",
      userId,
      projectId: config.projectId,
      location: config.location,
      datasetId: config.datasetId,
      fhirStoreId: config.fhirStoreId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });

    throw error;
  }
}

export async function checkBulkImportStatus(
  credentials: GCPCredentials,
  jobId: string,
  userId?: string
): Promise<BulkOperationJob> {
  const job = bulkJobs.get(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  if (!job.gcpOperationName) {
    return job;
  }

  const startTime = Date.now();
  const accessToken = await getAccessToken(credentials);
  const url = `https://healthcare.googleapis.com/v1/${job.gcpOperationName}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to check import status: ${error}`);
    }

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        updateBulkJob(jobId, {
          status: "failed",
          completedAt: new Date(),
          errorMessage: data.error.message,
        });
      } else {
        const metadata = data.response || {};
        updateBulkJob(jobId, {
          status: "completed",
          completedAt: new Date(),
          totalResources: metadata.resourceCount,
          processedResources: metadata.resourceCount,
          progress: 100,
        });
      }
    } else {
      const metadata = data.metadata || {};
      if (metadata.counter) {
        updateBulkJob(jobId, {
          processedResources: parseInt(metadata.counter),
        });
      }
    }

    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_import_status",
      userId,
      projectId: job.projectId,
      location: job.location,
      datasetId: job.datasetId,
      fhirStoreId: job.fhirStoreId,
      success: true,
      metadata: { jobId, done: data.done },
      durationMs: Date.now() - startTime,
    });

    return bulkJobs.get(jobId)!;
  } catch (error) {
    logGCPOperation({
      timestamp: new Date(),
      operation: "bulk_import_status",
      userId,
      projectId: job.projectId,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}
