import { generatePhiSafeText } from "./ai-gateway";
import { getAuditLogger } from "./integrations/factory";

export type SyncResourceType = "Patient" | "Condition" | "Medication" | "MedicationRequest";
export type SyncDirection = "inbound" | "outbound" | "bidirectional";
export type ConflictResolutionStrategy = "local_wins" | "remote_wins" | "newest_wins" | "manual_review" | "ai_assisted";
export type ChangeStatus = "pending_review" | "approved" | "rejected" | "auto_applied" | "conflict";
export type SyncJobStatus = "pending" | "running" | "completed" | "failed" | "paused";

export interface FHIRServer {
  id: string;
  name: string;
  endpoint: string;
  authType: "oauth2" | "smart_on_fhir" | "api_key" | "basic";
  isActive: boolean;
  lastSyncAt?: string;
  supportedResources: SyncResourceType[];
  syncDirection: SyncDirection;
  conflictStrategy: ConflictResolutionStrategy;
  autoApproveThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncConfiguration {
  id: string;
  serverId: string;
  resourceType: SyncResourceType;
  syncDirection: SyncDirection;
  enabled: boolean;
  syncOnCreate: boolean;
  syncOnUpdate: boolean;
  syncOnDelete: boolean;
  conflictStrategy: ConflictResolutionStrategy;
  autoApproveThreshold: number;
  fieldMappings: FieldMapping[];
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  localField: string;
  remoteField: string;
  transformation?: string;
  priority: "local" | "remote" | "newest" | "merge";
  required: boolean;
}

export interface PendingChange {
  id: string;
  syncJobId: string;
  serverId: string;
  resourceType: SyncResourceType;
  resourceId: string;
  changeType: "create" | "update" | "delete";
  direction: "inbound" | "outbound";
  status: ChangeStatus;
  localRecord?: Record<string, unknown>;
  remoteRecord?: Record<string, unknown>;
  proposedRecord?: Record<string, unknown>;
  conflicts: FieldConflict[];
  confidence: number;
  aiRecommendation?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldConflict {
  fieldPath: string;
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  proposedValue: unknown;
  resolution: "use_local" | "use_remote" | "use_proposed" | "pending";
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface SyncJob {
  id: string;
  serverId: string;
  resourceTypes: SyncResourceType[];
  direction: SyncDirection;
  status: SyncJobStatus;
  totalRecords: number;
  processedRecords: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  autoApplied: number;
  conflicts: number;
  errors: SyncError[];
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
}

export interface SyncError {
  resourceType: SyncResourceType;
  resourceId: string;
  errorCode: string;
  errorMessage: string;
  timestamp: string;
  retryable: boolean;
  retryCount: number;
}

export interface SyncAuditLog {
  id: string;
  syncJobId: string;
  action: "job_started" | "job_completed" | "job_failed" | "change_detected" | "change_approved" | "change_rejected" | "conflict_resolved" | "auto_applied" | "error_occurred";
  resourceType?: SyncResourceType;
  resourceId?: string;
  changeId?: string;
  userId: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface SyncDashboard {
  activeSyncJobs: number;
  pendingReviewCount: number;
  conflictCount: number;
  recentSyncJobs: SyncJob[];
  serverStatuses: ServerSyncStatus[];
  resourceBreakdown: ResourceSyncStats[];
  syncTrends: SyncTrend[];
}

export interface ServerSyncStatus {
  serverId: string;
  serverName: string;
  status: "healthy" | "degraded" | "offline" | "error";
  lastSyncAt?: string;
  pendingChanges: number;
  conflicts: number;
}

export interface ResourceSyncStats {
  resourceType: SyncResourceType;
  totalRecords: number;
  inSync: number;
  pendingInbound: number;
  pendingOutbound: number;
  conflicts: number;
}

export interface SyncTrend {
  date: string;
  synced: number;
  conflicts: number;
  errors: number;
}

const fhirServers = new Map<string, FHIRServer>();
const syncConfigurations = new Map<string, SyncConfiguration>();
const pendingChanges = new Map<string, PendingChange>();
const syncJobs = new Map<string, SyncJob>();
const syncAuditLogs = new Map<string, SyncAuditLog>();

function generateId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function initializeSampleData(): void {
  const sampleServers: FHIRServer[] = [
    {
      id: "server-epic",
      name: "Primary Care Provider",
      endpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      authType: "smart_on_fhir",
      isActive: true,
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      supportedResources: ["Patient", "Condition", "Medication", "MedicationRequest"],
      syncDirection: "bidirectional",
      conflictStrategy: "manual_review",
      autoApproveThreshold: 0.9,
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "server-cerner",
      name: "Hospital Network",
      endpoint: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
      authType: "smart_on_fhir",
      isActive: true,
      lastSyncAt: new Date(Date.now() - 7200000).toISOString(),
      supportedResources: ["Patient", "Condition", "MedicationRequest"],
      syncDirection: "bidirectional",
      conflictStrategy: "newest_wins",
      autoApproveThreshold: 0.85,
      createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "server-athena",
      name: "Fasten Health",
      endpoint: "https://api.athenahealth.com/fhir/r4",
      authType: "oauth2",
      isActive: true,
      lastSyncAt: new Date(Date.now() - 1800000).toISOString(),
      supportedResources: ["Patient", "Condition", "Medication"],
      syncDirection: "inbound",
      conflictStrategy: "remote_wins",
      autoApproveThreshold: 0.95,
      createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  sampleServers.forEach((server) => fhirServers.set(server.id, server));

  const sampleConfigs: SyncConfiguration[] = [
    {
      id: "config-epic-patient",
      serverId: "server-epic",
      resourceType: "Patient",
      syncDirection: "bidirectional",
      enabled: true,
      syncOnCreate: true,
      syncOnUpdate: true,
      syncOnDelete: false,
      conflictStrategy: "manual_review",
      autoApproveThreshold: 0.9,
      fieldMappings: [
        { localField: "name.given", remoteField: "name.given", priority: "newest", required: true },
        { localField: "name.family", remoteField: "name.family", priority: "newest", required: true },
        { localField: "birthDate", remoteField: "birthDate", priority: "local", required: true },
        { localField: "gender", remoteField: "gender", priority: "newest", required: true },
        { localField: "address", remoteField: "address", priority: "merge", required: false },
        { localField: "telecom", remoteField: "telecom", priority: "merge", required: false },
      ],
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "config-epic-condition",
      serverId: "server-epic",
      resourceType: "Condition",
      syncDirection: "bidirectional",
      enabled: true,
      syncOnCreate: true,
      syncOnUpdate: true,
      syncOnDelete: false,
      conflictStrategy: "manual_review",
      autoApproveThreshold: 0.85,
      fieldMappings: [
        { localField: "code", remoteField: "code", priority: "remote", required: true },
        { localField: "clinicalStatus", remoteField: "clinicalStatus", priority: "newest", required: true },
        { localField: "verificationStatus", remoteField: "verificationStatus", priority: "remote", required: true },
        { localField: "onsetDateTime", remoteField: "onsetDateTime", priority: "local", required: false },
        { localField: "recordedDate", remoteField: "recordedDate", priority: "newest", required: false },
      ],
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "config-epic-medication",
      serverId: "server-epic",
      resourceType: "Medication",
      syncDirection: "bidirectional",
      enabled: true,
      syncOnCreate: true,
      syncOnUpdate: true,
      syncOnDelete: false,
      conflictStrategy: "ai_assisted",
      autoApproveThreshold: 0.9,
      fieldMappings: [
        { localField: "code", remoteField: "code", priority: "remote", required: true },
        { localField: "status", remoteField: "status", priority: "newest", required: true },
        { localField: "form", remoteField: "form", priority: "remote", required: false },
        { localField: "amount", remoteField: "amount", priority: "remote", required: false },
      ],
      lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  sampleConfigs.forEach((config) => syncConfigurations.set(config.id, config));

  const samplePendingChanges: PendingChange[] = [
    {
      id: "change-1",
      syncJobId: "job-1",
      serverId: "server-epic",
      resourceType: "Patient",
      resourceId: "patient-12345",
      changeType: "update",
      direction: "inbound",
      status: "pending_review",
      localRecord: {
        resourceType: "Patient",
        id: "patient-12345",
        name: [{ given: ["John"], family: "Smith" }],
        birthDate: "1980-05-15",
        gender: "male",
        address: [{ city: "Boston", state: "MA" }],
        telecom: [{ system: "phone", value: "555-1234" }],
      },
      remoteRecord: {
        resourceType: "Patient",
        id: "patient-12345",
        name: [{ given: ["John", "Michael"], family: "Smith" }],
        birthDate: "1980-05-15",
        gender: "male",
        address: [{ city: "Cambridge", state: "MA" }],
        telecom: [{ system: "phone", value: "555-5678" }, { system: "email", value: "john.smith@email.com" }],
      },
      proposedRecord: {
        resourceType: "Patient",
        id: "patient-12345",
        name: [{ given: ["John", "Michael"], family: "Smith" }],
        birthDate: "1980-05-15",
        gender: "male",
        address: [{ city: "Cambridge", state: "MA" }],
        telecom: [{ system: "phone", value: "555-5678" }, { system: "email", value: "john.smith@email.com" }],
      },
      conflicts: [
        {
          fieldPath: "name.0.given",
          fieldName: "Given Name",
          localValue: ["John"],
          remoteValue: ["John", "Michael"],
          proposedValue: ["John", "Michael"],
          resolution: "pending",
        },
        {
          fieldPath: "address.0.city",
          fieldName: "City",
          localValue: "Boston",
          remoteValue: "Cambridge",
          proposedValue: "Cambridge",
          resolution: "pending",
        },
        {
          fieldPath: "telecom",
          fieldName: "Contact Info",
          localValue: [{ system: "phone", value: "555-1234" }],
          remoteValue: [{ system: "phone", value: "555-5678" }, { system: "email", value: "john.smith@email.com" }],
          proposedValue: [{ system: "phone", value: "555-5678" }, { system: "email", value: "john.smith@email.com" }],
          resolution: "pending",
        },
      ],
      confidence: 0.75,
      aiRecommendation: "Accept remote changes as they include additional contact information and updated address that appears more current based on the modification timestamp.",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "change-2",
      syncJobId: "job-1",
      serverId: "server-epic",
      resourceType: "Condition",
      resourceId: "condition-67890",
      changeType: "create",
      direction: "inbound",
      status: "pending_review",
      remoteRecord: {
        resourceType: "Condition",
        id: "condition-67890",
        code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" }] },
        clinicalStatus: { coding: [{ code: "active" }] },
        verificationStatus: { coding: [{ code: "confirmed" }] },
        onsetDateTime: "2023-06-15",
        subject: { reference: "Patient/patient-12345" },
      },
      proposedRecord: {
        resourceType: "Condition",
        id: "condition-67890",
        code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" }] },
        clinicalStatus: { coding: [{ code: "active" }] },
        verificationStatus: { coding: [{ code: "confirmed" }] },
        onsetDateTime: "2023-06-15",
        subject: { reference: "Patient/patient-12345" },
      },
      conflicts: [],
      confidence: 0.95,
      aiRecommendation: "Create new condition record. This is a new diagnosis from the EHR with high confidence. Recommend auto-approval.",
      createdAt: new Date(Date.now() - 1200000).toISOString(),
      updatedAt: new Date(Date.now() - 1200000).toISOString(),
    },
    {
      id: "change-3",
      syncJobId: "job-1",
      serverId: "server-epic",
      resourceType: "Medication",
      resourceId: "med-11111",
      changeType: "update",
      direction: "inbound",
      status: "conflict",
      localRecord: {
        resourceType: "Medication",
        id: "med-11111",
        code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Metformin 500mg" }] },
        status: "active",
        form: { coding: [{ code: "tablet" }] },
      },
      remoteRecord: {
        resourceType: "Medication",
        id: "med-11111",
        code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Metformin 1000mg" }] },
        status: "active",
        form: { coding: [{ code: "tablet" }] },
      },
      conflicts: [
        {
          fieldPath: "code.coding.0.display",
          fieldName: "Medication Name/Dosage",
          localValue: "Metformin 500mg",
          remoteValue: "Metformin 1000mg",
          proposedValue: null,
          resolution: "pending",
        },
      ],
      confidence: 0.45,
      aiRecommendation: "CRITICAL: Dosage conflict detected. Local record shows Metformin 500mg while remote shows Metformin 1000mg. This may indicate a dosage change that requires clinical review. Manual verification recommended before applying.",
      createdAt: new Date(Date.now() - 900000).toISOString(),
      updatedAt: new Date(Date.now() - 900000).toISOString(),
    },
    {
      id: "change-4",
      syncJobId: "job-2",
      serverId: "server-cerner",
      resourceType: "Patient",
      resourceId: "patient-22222",
      changeType: "update",
      direction: "outbound",
      status: "pending_review",
      localRecord: {
        resourceType: "Patient",
        id: "patient-22222",
        name: [{ given: ["Sarah"], family: "Johnson" }],
        birthDate: "1975-09-22",
        gender: "female",
        address: [{ city: "New York", state: "NY", postalCode: "10001" }],
        telecom: [{ system: "phone", value: "555-9999" }],
      },
      remoteRecord: {
        resourceType: "Patient",
        id: "patient-22222",
        name: [{ given: ["Sarah"], family: "Johnson" }],
        birthDate: "1975-09-22",
        gender: "female",
        address: [{ city: "New York", state: "NY" }],
      },
      proposedRecord: {
        resourceType: "Patient",
        id: "patient-22222",
        name: [{ given: ["Sarah"], family: "Johnson" }],
        birthDate: "1975-09-22",
        gender: "female",
        address: [{ city: "New York", state: "NY", postalCode: "10001" }],
        telecom: [{ system: "phone", value: "555-9999" }],
      },
      conflicts: [],
      confidence: 0.92,
      aiRecommendation: "Push local changes to remote. Local record has additional data (postal code, phone number) that should be synchronized to the remote system.",
      createdAt: new Date(Date.now() - 600000).toISOString(),
      updatedAt: new Date(Date.now() - 600000).toISOString(),
    },
  ];

  samplePendingChanges.forEach((change) => pendingChanges.set(change.id, change));

  const sampleJobs: SyncJob[] = [
    {
      id: "job-1",
      serverId: "server-epic",
      resourceTypes: ["Patient", "Condition", "Medication"],
      direction: "bidirectional",
      status: "running",
      totalRecords: 150,
      processedRecords: 125,
      pendingReview: 3,
      approved: 95,
      rejected: 2,
      autoApplied: 20,
      conflicts: 1,
      errors: [],
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      triggeredBy: "scheduler",
    },
    {
      id: "job-2",
      serverId: "server-cerner",
      resourceTypes: ["Patient"],
      direction: "outbound",
      status: "paused",
      totalRecords: 50,
      processedRecords: 25,
      pendingReview: 1,
      approved: 20,
      rejected: 0,
      autoApplied: 4,
      conflicts: 0,
      errors: [],
      startedAt: new Date(Date.now() - 7200000).toISOString(),
      triggeredBy: "manual",
    },
  ];

  sampleJobs.forEach((job) => syncJobs.set(job.id, job));
}

initializeSampleData();

async function logAudit(entry: Omit<SyncAuditLog, "id" | "timestamp">): Promise<void> {
  const auditEntry: SyncAuditLog = {
    ...entry,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  syncAuditLogs.set(auditEntry.id, auditEntry);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: entry.userId,
      userRole: "system",
      action: "update",
      resourceType: entry.resourceType || "FHIRSync",
      resourceId: entry.resourceId || entry.syncJobId,
      patientId: "[REDACTED]",
      ipAddress: "internal",
      userAgent: "bidirectional-fhir-sync-service",
      requestPath: "/api/fhir-bidirectional-sync",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: entry.details,
    });
  } catch (e) {
    console.error("[BidirectionalSync] Audit logging failed:", e);
  }
}

export function getServers(): FHIRServer[] {
  return Array.from(fhirServers.values());
}

export function getServer(id: string): FHIRServer | undefined {
  return fhirServers.get(id);
}

export function getConfigurations(serverId?: string): SyncConfiguration[] {
  const configs = Array.from(syncConfigurations.values());
  if (serverId) {
    return configs.filter((c) => c.serverId === serverId);
  }
  return configs;
}

export function getConfiguration(id: string): SyncConfiguration | undefined {
  return syncConfigurations.get(id);
}

export function getPendingChanges(filters?: {
  serverId?: string;
  resourceType?: SyncResourceType;
  status?: ChangeStatus;
  direction?: "inbound" | "outbound";
}): PendingChange[] {
  let changes = Array.from(pendingChanges.values());

  if (filters?.serverId) {
    changes = changes.filter((c) => c.serverId === filters.serverId);
  }
  if (filters?.resourceType) {
    changes = changes.filter((c) => c.resourceType === filters.resourceType);
  }
  if (filters?.status) {
    changes = changes.filter((c) => c.status === filters.status);
  }
  if (filters?.direction) {
    changes = changes.filter((c) => c.direction === filters.direction);
  }

  return changes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getPendingChange(id: string): PendingChange | undefined {
  return pendingChanges.get(id);
}

export function getSyncJobs(filters?: { serverId?: string; status?: SyncJobStatus }): SyncJob[] {
  let jobs = Array.from(syncJobs.values());

  if (filters?.serverId) {
    jobs = jobs.filter((j) => j.serverId === filters.serverId);
  }
  if (filters?.status) {
    jobs = jobs.filter((j) => j.status === filters.status);
  }

  return jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getSyncJob(id: string): SyncJob | undefined {
  return syncJobs.get(id);
}

export async function approveChange(
  changeId: string,
  userId: string,
  notes?: string,
  fieldResolutions?: Record<string, "use_local" | "use_remote" | "use_proposed">
): Promise<PendingChange> {
  const change = pendingChanges.get(changeId);
  if (!change) {
    throw new Error(`Change ${changeId} not found`);
  }

  const wasConflict = change.status === "conflict";

  if (fieldResolutions) {
    change.conflicts = change.conflicts.map((conflict) => ({
      ...conflict,
      resolution: fieldResolutions[conflict.fieldPath] || conflict.resolution,
      resolvedBy: userId,
      resolvedAt: new Date().toISOString(),
    }));
  }

  change.status = "approved";
  change.reviewedBy = userId;
  change.reviewedAt = new Date().toISOString();
  change.reviewNotes = notes;
  change.updatedAt = new Date().toISOString();

  pendingChanges.set(changeId, change);

  await logAudit({
    syncJobId: change.syncJobId,
    action: "change_approved",
    resourceType: change.resourceType,
    resourceId: change.resourceId,
    changeId: change.id,
    userId,
    details: {
      changeType: change.changeType,
      direction: change.direction,
      fieldResolutions,
      notes,
    },
  });

  const job = syncJobs.get(change.syncJobId);
  if (job) {
    job.approved++;
    job.pendingReview = Math.max(0, job.pendingReview - 1);
    if (wasConflict) {
      job.conflicts = Math.max(0, job.conflicts - 1);
    }
    syncJobs.set(job.id, job);
  }

  return change;
}

export async function rejectChange(changeId: string, userId: string, reason: string): Promise<PendingChange> {
  const change = pendingChanges.get(changeId);
  if (!change) {
    throw new Error(`Change ${changeId} not found`);
  }

  const wasConflict = change.status === "conflict";
  change.status = "rejected";
  change.reviewedBy = userId;
  change.reviewedAt = new Date().toISOString();
  change.reviewNotes = reason;
  change.updatedAt = new Date().toISOString();

  pendingChanges.set(changeId, change);

  await logAudit({
    syncJobId: change.syncJobId,
    action: "change_rejected",
    resourceType: change.resourceType,
    resourceId: change.resourceId,
    changeId: change.id,
    userId,
    details: {
      changeType: change.changeType,
      direction: change.direction,
      reason,
    },
  });

  const job = syncJobs.get(change.syncJobId);
  if (job) {
    job.rejected++;
    job.pendingReview = Math.max(0, job.pendingReview - 1);
    if (wasConflict) {
      job.conflicts = Math.max(0, job.conflicts - 1);
    }
    syncJobs.set(job.id, job);
  }

  return change;
}

export async function resolveConflict(
  changeId: string,
  conflictFieldPath: string,
  resolution: "use_local" | "use_remote" | "use_proposed",
  userId: string
): Promise<PendingChange> {
  const change = pendingChanges.get(changeId);
  if (!change) {
    throw new Error(`Change ${changeId} not found`);
  }

  const conflictIndex = change.conflicts.findIndex((c) => c.fieldPath === conflictFieldPath);
  if (conflictIndex === -1) {
    throw new Error(`Conflict for field ${conflictFieldPath} not found`);
  }

  change.conflicts[conflictIndex].resolution = resolution;
  change.conflicts[conflictIndex].resolvedBy = userId;
  change.conflicts[conflictIndex].resolvedAt = new Date().toISOString();

  const allResolved = change.conflicts.every((c) => c.resolution !== "pending");
  if (allResolved && change.status === "conflict") {
    change.status = "pending_review";
  }

  change.updatedAt = new Date().toISOString();
  pendingChanges.set(changeId, change);

  await logAudit({
    syncJobId: change.syncJobId,
    action: "conflict_resolved",
    resourceType: change.resourceType,
    resourceId: change.resourceId,
    changeId: change.id,
    userId,
    details: {
      fieldPath: conflictFieldPath,
      resolution,
      allConflictsResolved: allResolved,
    },
  });

  return change;
}

export async function getAIConflictRecommendation(changeId: string): Promise<string> {
  const change = pendingChanges.get(changeId);
  if (!change) {
    throw new Error(`Change ${changeId} not found`);
  }

  try {
    const recommendationText = await generatePhiSafeText({
      system: `You are a healthcare data analyst helping resolve FHIR resource synchronization conflicts.
Analyze the conflict and provide a recommendation. Be specific about which values to use and why.
Consider data freshness, source reliability, and clinical implications.
Keep your response concise and actionable.`,
      user: `Please analyze this ${change.resourceType} synchronization ${change.changeType === "update" ? "conflict" : "change"}:

Resource Type: ${change.resourceType}
Change Type: ${change.changeType}
Direction: ${change.direction}

Local Record:
${JSON.stringify(change.localRecord, null, 2)}

Remote Record:
${JSON.stringify(change.remoteRecord, null, 2)}

Specific Conflicts:
${change.conflicts.map((c) => `- ${c.fieldName}: Local="${JSON.stringify(c.localValue)}" vs Remote="${JSON.stringify(c.remoteValue)}"`).join("\n")}

Provide a recommendation on how to resolve this, including which source to trust for each conflicting field.`,
      maxTokens: 500,
    });

    const recommendation = recommendationText || "Unable to generate AI recommendation.";
    
    change.aiRecommendation = recommendation;
    change.updatedAt = new Date().toISOString();
    pendingChanges.set(changeId, change);

    return recommendation;
  } catch (error) {
    console.error("[BidirectionalSync] AI recommendation failed:", error);
    return change.aiRecommendation || "AI recommendation not available due to service error. Please review manually.";
  }
}

export async function startSyncJob(
  serverId: string,
  resourceTypes: SyncResourceType[],
  direction: SyncDirection,
  userId: string
): Promise<SyncJob> {
  const server = fhirServers.get(serverId);
  if (!server) {
    throw new Error(`Server ${serverId} not found`);
  }

  const job: SyncJob = {
    id: generateId(),
    serverId,
    resourceTypes,
    direction,
    status: "running",
    totalRecords: 0,
    processedRecords: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    autoApplied: 0,
    conflicts: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    triggeredBy: userId,
  };

  syncJobs.set(job.id, job);

  await logAudit({
    syncJobId: job.id,
    action: "job_started",
    userId,
    details: {
      serverId,
      serverName: server.name,
      resourceTypes,
      direction,
    },
  });

  return job;
}

export async function pauseSyncJob(jobId: string, userId: string): Promise<SyncJob> {
  const job = syncJobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.status = "paused";
  syncJobs.set(jobId, job);

  await logAudit({
    syncJobId: job.id,
    action: "job_completed",
    userId,
    details: { action: "paused" },
  });

  return job;
}

export async function resumeSyncJob(jobId: string, userId: string): Promise<SyncJob> {
  const job = syncJobs.get(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  job.status = "running";
  syncJobs.set(jobId, job);

  await logAudit({
    syncJobId: job.id,
    action: "job_started",
    userId,
    details: { action: "resumed" },
  });

  return job;
}

export function getDashboard(): SyncDashboard {
  const jobs = Array.from(syncJobs.values());
  const changes = Array.from(pendingChanges.values());
  const servers = Array.from(fhirServers.values());

  const activeSyncJobs = jobs.filter((j) => j.status === "running").length;
  const pendingReviewCount = changes.filter((c) => c.status === "pending_review").length;
  const conflictCount = changes.filter((c) => c.status === "conflict").length;

  const serverStatuses: ServerSyncStatus[] = servers.map((server) => {
    const serverChanges = changes.filter((c) => c.serverId === server.id);
    return {
      serverId: server.id,
      serverName: server.name,
      status: server.isActive ? "healthy" : "offline",
      lastSyncAt: server.lastSyncAt,
      pendingChanges: serverChanges.filter((c) => c.status === "pending_review").length,
      conflicts: serverChanges.filter((c) => c.status === "conflict").length,
    };
  });

  const resourceTypes: SyncResourceType[] = ["Patient", "Condition", "Medication", "MedicationRequest"];
  const resourceBreakdown: ResourceSyncStats[] = resourceTypes.map((resourceType) => {
    const typeChanges = changes.filter((c) => c.resourceType === resourceType);
    return {
      resourceType,
      totalRecords: 100 + Math.floor(Math.random() * 400),
      inSync: 80 + Math.floor(Math.random() * 20),
      pendingInbound: typeChanges.filter((c) => c.direction === "inbound" && c.status === "pending_review").length,
      pendingOutbound: typeChanges.filter((c) => c.direction === "outbound" && c.status === "pending_review").length,
      conflicts: typeChanges.filter((c) => c.status === "conflict").length,
    };
  });

  const syncTrends: SyncTrend[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    syncTrends.push({
      date: date.toISOString().split("T")[0],
      synced: 50 + Math.floor(Math.random() * 100),
      conflicts: Math.floor(Math.random() * 10),
      errors: Math.floor(Math.random() * 3),
    });
  }

  return {
    activeSyncJobs,
    pendingReviewCount,
    conflictCount,
    recentSyncJobs: jobs.slice(0, 5),
    serverStatuses,
    resourceBreakdown,
    syncTrends,
  };
}

export function getAuditLogs(filters?: { syncJobId?: string; resourceId?: string }): SyncAuditLog[] {
  let logs = Array.from(syncAuditLogs.values());

  if (filters?.syncJobId) {
    logs = logs.filter((l) => l.syncJobId === filters.syncJobId);
  }
  if (filters?.resourceId) {
    logs = logs.filter((l) => l.resourceId === filters.resourceId);
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function updateConfiguration(
  configId: string,
  updates: Partial<SyncConfiguration>,
  userId: string
): Promise<SyncConfiguration> {
  const config = syncConfigurations.get(configId);
  if (!config) {
    throw new Error(`Configuration ${configId} not found`);
  }

  const updatedConfig: SyncConfiguration = {
    ...config,
    ...updates,
    id: config.id,
    createdAt: config.createdAt,
    updatedAt: new Date().toISOString(),
  };

  syncConfigurations.set(configId, updatedConfig);

  await logAudit({
    syncJobId: "config-update",
    action: "job_completed",
    resourceType: config.resourceType,
    userId,
    details: {
      configId,
      updates,
    },
  });

  return updatedConfig;
}

export const bidirectionalFhirSyncService = {
  getServers,
  getServer,
  getConfigurations,
  getConfiguration,
  getPendingChanges,
  getPendingChange,
  getSyncJobs,
  getSyncJob,
  approveChange,
  rejectChange,
  resolveConflict,
  getAIConflictRecommendation,
  startSyncJob,
  pauseSyncJob,
  resumeSyncJob,
  getDashboard,
  getAuditLogs,
  updateConfiguration,
};

console.log("[BidirectionalSync] Service initialized with bidirectional FHIR synchronization");
console.log("[BidirectionalSync] Features: Conflict resolution, approval workflows, AI-assisted recommendations");
console.log("[BidirectionalSync] Supported resources: Patient, Condition, Medication, MedicationRequest");
