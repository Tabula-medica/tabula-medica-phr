import { getAuditLogger } from "./integrations/factory";

export type SyncDirection = "inbound" | "outbound" | "bidirectional";
export type SyncStatus = "pending" | "in_progress" | "completed" | "failed" | "partial";
export type ExternalSystemType = "ehr" | "lab" | "pharmacy" | "imaging" | "registry";

export interface ExternalSystem {
  id: string;
  name: string;
  type: ExternalSystemType;
  endpoint: string;
  authType: "oauth2" | "api_key" | "smart_on_fhir" | "basic";
  isActive: boolean;
  lastSyncAt?: string;
  syncDirection: SyncDirection;
  supportedResources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncJob {
  id: string;
  externalSystemId: string;
  direction: SyncDirection;
  status: SyncStatus;
  resourceTypes: string[];
  totalResources: number;
  syncedResources: number;
  failedResources: number;
  errors: SyncError[];
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  metadata: Record<string, unknown>;
}

export interface SyncError {
  resourceId: string;
  resourceType: string;
  errorCode: string;
  errorMessage: string;
  timestamp: string;
}

export interface SyncConflict {
  id: string;
  jobId: string;
  resourceId: string;
  resourceType: string;
  localVersion: Record<string, unknown>;
  remoteVersion: Record<string, unknown>;
  conflictType: "update_conflict" | "delete_conflict" | "create_conflict";
  resolution?: "keep_local" | "keep_remote" | "merge" | "skip";
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface SyncAuditEntry {
  id: string;
  jobId: string;
  action: "sync_started" | "sync_completed" | "sync_failed" | "resource_synced" | "conflict_detected" | "conflict_resolved";
  resourceType?: string;
  resourceId?: string;
  direction: SyncDirection;
  externalSystemId: string;
  details: Record<string, unknown>;
  timestamp: string;
  userId: string;
}

const externalSystems = new Map<string, ExternalSystem>();
const syncJobs = new Map<string, SyncJob>();
const syncConflicts = new Map<string, SyncConflict>();
const syncAuditLog = new Map<string, SyncAuditEntry>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const sampleExternalSystems: ExternalSystem[] = [
  {
    id: "sys-epic",
    name: "Primary Care Provider",
    type: "ehr",
    endpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    authType: "smart_on_fhir",
    isActive: true,
    lastSyncAt: "2024-03-15T10:30:00Z",
    syncDirection: "bidirectional",
    supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation", "AllergyIntolerance", "Immunization", "Procedure", "Encounter"],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-03-15T10:30:00Z",
  },
  {
    id: "sys-cerner",
    name: "Hospital Network",
    type: "ehr",
    endpoint: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
    authType: "smart_on_fhir",
    isActive: true,
    lastSyncAt: "2024-03-14T08:00:00Z",
    syncDirection: "bidirectional",
    supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation", "DiagnosticReport"],
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-03-14T08:00:00Z",
  },
  {
    id: "sys-quest",
    name: "Quest Diagnostics",
    type: "lab",
    endpoint: "https://fhir.questdiagnostics.com/r4",
    authType: "oauth2",
    isActive: true,
    lastSyncAt: "2024-03-15T06:00:00Z",
    syncDirection: "inbound",
    supportedResources: ["DiagnosticReport", "Observation", "Specimen"],
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: "2024-03-15T06:00:00Z",
  },
  {
    id: "sys-cvs",
    name: "CVS Pharmacy",
    type: "pharmacy",
    endpoint: "https://fhir.cvs.com/r4",
    authType: "api_key",
    isActive: true,
    lastSyncAt: "2024-03-15T12:00:00Z",
    syncDirection: "bidirectional",
    supportedResources: ["MedicationRequest", "MedicationDispense", "Medication"],
    createdAt: "2024-02-15T00:00:00Z",
    updatedAt: "2024-03-15T12:00:00Z",
  },
];

function initializeSampleData(): void {
  sampleExternalSystems.forEach((sys) => externalSystems.set(sys.id, sys));
}

initializeSampleData();

async function logSyncAudit(
  entry: Omit<SyncAuditEntry, "id" | "timestamp">,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const auditEntry: SyncAuditEntry = {
    ...entry,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  syncAuditLog.set(auditEntry.id, auditEntry);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: entry.userId,
      userRole: "system",
      action: "update",
      resourceType: "FHIRSync",
      resourceId: entry.jobId,
      patientId: "[REDACTED]",
      ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
      userAgent,
      requestPath: "/api/fhir-sync",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        syncAction: entry.action,
        direction: entry.direction,
        externalSystem: entry.externalSystemId,
        resourceType: entry.resourceType || "multiple",
      },
    });
  } catch (e) {
    console.error("[FHIRSync] Audit logging failed:", e);
  }
}

export function getExternalSystems(): ExternalSystem[] {
  return Array.from(externalSystems.values());
}

export function getExternalSystem(id: string): ExternalSystem | undefined {
  return externalSystems.get(id);
}

export async function registerExternalSystem(
  system: Omit<ExternalSystem, "id" | "createdAt" | "updatedAt">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<ExternalSystem> {
  const id = generateId();
  const now = new Date().toISOString();
  const newSystem: ExternalSystem = {
    ...system,
    id,
    createdAt: now,
    updatedAt: now,
  };
  externalSystems.set(id, newSystem);

  await logSyncAudit(
    {
      jobId: id,
      action: "sync_started",
      direction: system.syncDirection,
      externalSystemId: id,
      details: { systemName: system.name, systemType: system.type },
      userId,
    },
    ipAddress,
    userAgent
  );

  return newSystem;
}

export async function startSyncJob(
  externalSystemId: string,
  direction: SyncDirection,
  resourceTypes: string[],
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<SyncJob> {
  const system = externalSystems.get(externalSystemId);
  if (!system) {
    throw new Error(`External system ${externalSystemId} not found`);
  }

  const jobId = generateId();
  const now = new Date().toISOString();

  const job: SyncJob = {
    id: jobId,
    externalSystemId,
    direction,
    status: "in_progress",
    resourceTypes,
    totalResources: 0,
    syncedResources: 0,
    failedResources: 0,
    errors: [],
    startedAt: now,
    triggeredBy: userId,
    metadata: { systemName: system.name },
  };

  syncJobs.set(jobId, job);

  await logSyncAudit(
    {
      jobId,
      action: "sync_started",
      direction,
      externalSystemId,
      details: { resourceTypes, systemName: system.name },
      userId,
    },
    ipAddress,
    userAgent
  );

  simulateSync(job, userId, ipAddress, userAgent);

  return job;
}

async function simulateSync(
  job: SyncJob,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const resourceCounts: Record<string, number> = {
    Patient: 5,
    Condition: 12,
    MedicationRequest: 8,
    Observation: 25,
    AllergyIntolerance: 3,
    Immunization: 10,
    Procedure: 6,
    Encounter: 15,
    DiagnosticReport: 7,
    Specimen: 4,
    MedicationDispense: 5,
    Medication: 8,
  };

  let totalResources = 0;
  let syncedResources = 0;
  let failedResources = 0;
  const errors: SyncError[] = [];

  for (const resourceType of job.resourceTypes) {
    const count = resourceCounts[resourceType] || Math.floor(Math.random() * 10) + 1;
    totalResources += count;

    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.95) {
        failedResources++;
        errors.push({
          resourceId: `${resourceType.toLowerCase()}-${i}`,
          resourceType,
          errorCode: "SYNC_ERROR",
          errorMessage: "Resource validation failed",
          timestamp: new Date().toISOString(),
        });
      } else {
        syncedResources++;
      }
    }
  }

  const updatedJob: SyncJob = {
    ...job,
    status: failedResources > 0 ? "partial" : "completed",
    totalResources,
    syncedResources,
    failedResources,
    errors,
    completedAt: new Date().toISOString(),
  };

  syncJobs.set(job.id, updatedJob);

  const system = externalSystems.get(job.externalSystemId);
  if (system) {
    const updatedSystem: ExternalSystem = {
      ...system,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    externalSystems.set(system.id, updatedSystem);
  }

  await logSyncAudit(
    {
      jobId: job.id,
      action: failedResources > 0 ? "sync_completed" : "sync_completed",
      direction: job.direction,
      externalSystemId: job.externalSystemId,
      details: { totalResources, syncedResources, failedResources },
      userId,
    },
    ipAddress,
    userAgent
  );
}

export function getSyncJob(jobId: string): SyncJob | undefined {
  return syncJobs.get(jobId);
}

export function getSyncJobs(externalSystemId?: string, limit = 20): SyncJob[] {
  let jobs = Array.from(syncJobs.values());
  if (externalSystemId) {
    jobs = jobs.filter((j) => j.externalSystemId === externalSystemId);
  }
  return jobs
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

export function getSyncConflicts(jobId?: string): SyncConflict[] {
  let conflicts = Array.from(syncConflicts.values());
  if (jobId) {
    conflicts = conflicts.filter((c) => c.jobId === jobId);
  }
  return conflicts;
}

export async function resolveConflict(
  conflictId: string,
  resolution: SyncConflict["resolution"],
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<SyncConflict> {
  const conflict = syncConflicts.get(conflictId);
  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const resolvedConflict: SyncConflict = {
    ...conflict,
    resolution,
    resolvedAt: new Date().toISOString(),
    resolvedBy: userId,
  };

  syncConflicts.set(conflictId, resolvedConflict);

  await logSyncAudit(
    {
      jobId: conflict.jobId,
      action: "conflict_resolved",
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId,
      direction: "bidirectional",
      externalSystemId: "",
      details: { resolution, conflictType: conflict.conflictType },
      userId,
    },
    ipAddress,
    userAgent
  );

  return resolvedConflict;
}

export function getSyncAuditLog(jobId?: string, limit = 50): SyncAuditEntry[] {
  let entries = Array.from(syncAuditLog.values());
  if (jobId) {
    entries = entries.filter((e) => e.jobId === jobId);
  }
  return entries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getSyncMetrics(): {
  totalSystems: number;
  activeSystems: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalResourcesSynced: number;
  bySystemType: Record<string, number>;
} {
  const systems = Array.from(externalSystems.values());
  const jobs = Array.from(syncJobs.values());

  const bySystemType: Record<string, number> = {};
  systems.forEach((s) => {
    bySystemType[s.type] = (bySystemType[s.type] || 0) + 1;
  });

  return {
    totalSystems: systems.length,
    activeSystems: systems.filter((s) => s.isActive).length,
    totalJobs: jobs.length,
    completedJobs: jobs.filter((j) => j.status === "completed" || j.status === "partial").length,
    failedJobs: jobs.filter((j) => j.status === "failed").length,
    totalResourcesSynced: jobs.reduce((sum, j) => sum + j.syncedResources, 0),
    bySystemType,
  };
}

console.log("[FHIRSync] Service initialized with", externalSystems.size, "external systems");
