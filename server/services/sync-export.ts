import { randomUUID, createHash } from "crypto";
import type { 
  BatchExportJob, 
  SyncHookConfig, 
  FhirResource 
} from "./integrations/interfaces";
import { getFhirStore, getAnalyticsStore, getAuditLogger } from "./integrations/factory";

const exportJobs: Map<string, BatchExportJob> = new Map();
let syncBuffer: FhirResource[] = [];
let syncConfig: SyncHookConfig = {
  enabled: false,
  resourceTypes: ["Patient", "Observation", "MedicationRequest", "Encounter"],
  destination: "analytics_store",
  deIdentify: true,
  batchSize: 100,
  flushIntervalMs: 30000,
};
let flushTimer: NodeJS.Timeout | null = null;

const DEIDENTIFY_SALT = process.env.DEIDENTIFY_SALT || randomUUID();

function hashIdentifier(value: string): string {
  return createHash("sha256").update(DEIDENTIFY_SALT + value).digest("hex").slice(0, 32);
}

function deIdentifyResource(resource: FhirResource): Record<string, unknown> {
  const deIdentified: Record<string, unknown> = { ...resource };
  
  delete deIdentified.name;
  delete deIdentified.address;
  delete deIdentified.telecom;
  delete deIdentified.identifier;
  delete deIdentified.photo;
  delete deIdentified.contact;
  delete deIdentified.communication;
  delete deIdentified.managingOrganization;
  delete deIdentified.generalPractitioner;
  
  if ((resource as any).birthDate) {
    const date = new Date((resource as any).birthDate);
    deIdentified.birthYear = date.getFullYear();
    delete deIdentified.birthDate;
  }
  
  if ((resource as any).deceasedDateTime) {
    const date = new Date((resource as any).deceasedDateTime);
    deIdentified.deceasedYear = date.getFullYear();
    delete deIdentified.deceasedDateTime;
  }
  
  if ((resource as any).subject?.reference) {
    const patientId = (resource as any).subject.reference.replace("Patient/", "");
    deIdentified.patientHash = hashIdentifier(patientId);
    delete (deIdentified as any).subject;
  }
  
  if ((resource as any).patient?.reference) {
    const patientId = (resource as any).patient.reference.replace("Patient/", "");
    deIdentified.patientHash = hashIdentifier(patientId);
    delete (deIdentified as any).patient;
  }
  
  if (resource.id) {
    deIdentified.resourceHash = hashIdentifier(resource.id);
    delete deIdentified.id;
  }
  
  if ((resource as any).performer) {
    delete deIdentified.performer;
  }
  if ((resource as any).recorder) {
    delete deIdentified.recorder;
  }
  if ((resource as any).author) {
    delete deIdentified.author;
  }
  
  if ((resource as any).text) {
    delete deIdentified.text;
  }
  
  return deIdentified;
}

async function flushSyncBuffer(): Promise<void> {
  if (syncBuffer.length === 0) return;
  
  const analyticsStore = getAnalyticsStore();
  const auditLogger = getAuditLogger();
  
  const resourcesByType = new Map<string, FhirResource[]>();
  for (const resource of syncBuffer) {
    const type = resource.resourceType;
    if (!resourcesByType.has(type)) {
      resourcesByType.set(type, []);
    }
    resourcesByType.get(type)!.push(resource);
  }
  
  let totalInserted = 0;
  const entries = Array.from(resourcesByType.entries());
  for (const [resourceType, resources] of entries) {
    const rows = syncConfig.deIdentify 
      ? resources.map(deIdentifyResource)
      : resources.map((r: FhirResource) => ({ ...r }));
    
    try {
      const result = await analyticsStore.insertData(`fhir_${resourceType.toLowerCase()}`, rows);
      totalInserted += result.insertedCount;
    } catch (error) {
      console.error(`[SyncExport] Failed to insert ${resourceType} data:`, error);
    }
  }
  
  await auditLogger.log({
    userId: "system",
    userRole: "system",
    action: "export",
    resourceType: "SyncFlush",
    ipAddress: "internal",
    userAgent: "sync-export-service",
    requestPath: "/internal/sync/flush",
    requestMethod: "POST",
    responseStatus: 200,
    responseTimeMs: 0,
    phiAccessed: !syncConfig.deIdentify,
    details: { 
      recordsExported: totalInserted,
      resourceTypes: Array.from(resourcesByType.keys()),
      deIdentified: syncConfig.deIdentify,
    },
  });
  
  console.log(`[SyncExport] Flushed ${totalInserted} records to analytics store`);
  syncBuffer = [];
}

export function startSyncHook(config?: Partial<SyncHookConfig>): void {
  if (config) {
    syncConfig = { ...syncConfig, ...config };
  }
  
  syncConfig.enabled = true;
  
  if (flushTimer) {
    clearInterval(flushTimer);
  }
  
  flushTimer = setInterval(flushSyncBuffer, syncConfig.flushIntervalMs);
  console.log(`[SyncExport] Sync hook started with ${syncConfig.flushIntervalMs}ms interval`);
}

export function stopSyncHook(): void {
  syncConfig.enabled = false;
  
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  
  flushSyncBuffer();
  console.log("[SyncExport] Sync hook stopped");
}

export function pushToSyncBuffer(resource: FhirResource): void {
  if (!syncConfig.enabled) return;
  if (!syncConfig.resourceTypes.includes(resource.resourceType)) return;
  
  syncBuffer.push(resource);
  
  if (syncBuffer.length >= syncConfig.batchSize) {
    flushSyncBuffer();
  }
}

export function getSyncConfig(): SyncHookConfig {
  return { ...syncConfig };
}

export function updateSyncConfig(config: Partial<SyncHookConfig>): SyncHookConfig {
  syncConfig = { ...syncConfig, ...config };
  
  if (syncConfig.enabled && flushTimer) {
    clearInterval(flushTimer);
    flushTimer = setInterval(flushSyncBuffer, syncConfig.flushIntervalMs);
  }
  
  return { ...syncConfig };
}

export async function createBatchExportJob(params: {
  resourceTypes: string[];
  patientIds?: string[];
  deIdentify: boolean;
  format: BatchExportJob["format"];
  destination: BatchExportJob["destination"];
}): Promise<BatchExportJob> {
  const job: BatchExportJob = {
    jobId: randomUUID(),
    status: "pending",
    resourceTypes: params.resourceTypes,
    patientIds: params.patientIds,
    deIdentify: params.deIdentify,
    format: params.format,
    destination: params.destination,
    createdAt: new Date().toISOString(),
  };
  
  exportJobs.set(job.jobId, job);
  
  processBatchExportJob(job.jobId);
  
  return job;
}

async function processBatchExportJob(jobId: string): Promise<void> {
  const job = exportJobs.get(jobId);
  if (!job) return;
  
  job.status = "running";
  job.startedAt = new Date().toISOString();
  exportJobs.set(jobId, job);
  
  const fhirStore = getFhirStore();
  const analyticsStore = getAnalyticsStore();
  const auditLogger = getAuditLogger();
  
  try {
    let totalRecords = 0;
    
    for (const resourceType of job.resourceTypes) {
      const bundle = await fhirStore.searchResources(resourceType, { _count: 1000 });
      let resources = (bundle.entry || []).map(e => e.resource);
      
      if (job.patientIds && job.patientIds.length > 0) {
        resources = resources.filter(r => {
          const patientRef = (r as any).subject?.reference || (r as any).patient?.reference;
          if (!patientRef) return false;
          const patientId = patientRef.replace("Patient/", "");
          return job.patientIds!.includes(patientId);
        });
      }
      
      const rows = job.deIdentify 
        ? resources.map(deIdentifyResource)
        : resources.map(r => ({ ...r }));
      
      if (job.destination.type === "bigquery") {
        await analyticsStore.insertData(`export_${resourceType.toLowerCase()}`, rows);
      }
      
      totalRecords += resources.length;
    }
    
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.recordsExported = totalRecords;
    exportJobs.set(jobId, job);
    
    await auditLogger.log({
      userId: "system",
      userRole: "system",
      action: "export",
      resourceType: "BatchExport",
      resourceId: jobId,
      ipAddress: "internal",
      userAgent: "batch-export-service",
      requestPath: `/internal/export/${jobId}`,
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: Date.now() - new Date(job.startedAt!).getTime(),
      phiAccessed: !job.deIdentify,
      details: {
        resourceTypes: job.resourceTypes,
        recordsExported: totalRecords,
        deIdentified: job.deIdentify,
        format: job.format,
        destination: job.destination,
      },
    });
    
    console.log(`[SyncExport] Batch export job ${jobId} completed: ${totalRecords} records`);
  } catch (error: any) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error.message;
    exportJobs.set(jobId, job);
    
    console.error(`[SyncExport] Batch export job ${jobId} failed:`, error);
  }
}

export function getBatchExportJob(jobId: string): BatchExportJob | null {
  return exportJobs.get(jobId) || null;
}

export function listBatchExportJobs(status?: BatchExportJob["status"]): BatchExportJob[] {
  const jobs = Array.from(exportJobs.values());
  if (status) {
    return jobs.filter(j => j.status === status);
  }
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function deleteBatchExportJob(jobId: string): boolean {
  return exportJobs.delete(jobId);
}

export async function triggerFullExport(options: {
  deIdentify: boolean;
  destination: BatchExportJob["destination"];
}): Promise<BatchExportJob> {
  return createBatchExportJob({
    resourceTypes: [
      "Patient",
      "Observation",
      "Condition",
      "MedicationRequest",
      "MedicationStatement",
      "Encounter",
      "Procedure",
      "Immunization",
      "AllergyIntolerance",
      "DiagnosticReport",
    ],
    deIdentify: options.deIdentify,
    format: "fhir_ndjson",
    destination: options.destination,
  });
}
