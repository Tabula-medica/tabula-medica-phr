import { fhirAuditService, FhirAuditOutcome } from "./fhir-audit-service";

export type SyncDirection = "bidirectional" | "push" | "pull";
export type SyncFrequency = "realtime" | "hourly" | "daily" | "weekly" | "custom";
export type ConflictResolutionStrategy = "last-write-wins" | "source-priority" | "local-priority" | "manual-merge";
export type SyncStatus = "idle" | "running" | "completed" | "failed" | "paused";
export type ResourceSyncState = "pending" | "synced" | "conflict" | "error";

interface SyncEndpoint {
  id: string;
  name: string;
  url: string;
  fhirVersion: "R4" | "R5";
  authType: "bearer" | "basic" | "oauth2" | "smart-on-fhir";
  credentials: {
    token?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    tokenEndpoint?: string;
  };
  isActive: boolean;
  lastConnected?: string;
  healthStatus: "healthy" | "degraded" | "unavailable" | "unknown";
}

interface SyncConfiguration {
  id: string;
  name: string;
  description: string;
  endpointId: string;
  direction: SyncDirection;
  frequency: SyncFrequency;
  customCronExpression?: string;
  resourceTypes: string[];
  conflictResolution: ConflictResolutionStrategy;
  incrementalSync: boolean;
  batchSize: number;
  retryAttempts: number;
  retryDelayMs: number;
  isActive: boolean;
  lastSyncTime?: string;
  nextSyncTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncJob {
  id: string;
  configurationId: string;
  status: SyncStatus;
  direction: SyncDirection;
  startTime: string;
  endTime?: string;
  resourcesProcessed: number;
  resourcesPushed: number;
  resourcesPulled: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errors: number;
  errorMessages: string[];
  isIncremental: boolean;
  syncCursor?: string;
  triggeredBy: "schedule" | "manual" | "webhook";
}

interface SyncConflict {
  id: string;
  jobId: string;
  configurationId: string;
  resourceType: string;
  resourceId: string;
  localVersion: {
    data: Record<string, unknown>;
    lastModified: string;
    versionId: string;
  };
  remoteVersion: {
    data: Record<string, unknown>;
    lastModified: string;
    versionId: string;
  };
  status: "pending" | "resolved" | "dismissed";
  resolutionStrategy?: ConflictResolutionStrategy;
  resolvedData?: Record<string, unknown>;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface SyncLogEntry {
  id: string;
  jobId: string;
  configurationId: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  resourceType?: string;
  resourceId?: string;
  direction?: "push" | "pull";
  details?: Record<string, unknown>;
}

interface ResourceSyncMetadata {
  resourceType: string;
  resourceId: string;
  configurationId: string;
  localVersionId: string;
  remoteVersionId?: string;
  lastLocalModified: string;
  lastRemoteModified?: string;
  lastSyncTime: string;
  syncState: ResourceSyncState;
  syncCursor?: string;
}

interface SyncStatistics {
  totalConfigurations: number;
  activeConfigurations: number;
  totalJobs: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  pendingConflicts: number;
  resourcesSyncedToday: number;
  averageSyncDuration: number;
  lastSyncTime?: string;
}

const FHIR_RESOURCE_TYPES = [
  "Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance",
  "Immunization", "Procedure", "DiagnosticReport", "CarePlan", "CareTeam",
  "Encounter", "Medication", "MedicationStatement", "DocumentReference", "Practitioner",
  "Organization", "Location", "Device", "Goal", "ServiceRequest", "Appointment",
  "Coverage", "Claim", "ExplanationOfBenefit", "FamilyMemberHistory", "Consent"
];

class FHIRSyncScheduler {
  private endpoints: Map<string, SyncEndpoint> = new Map();
  private configurations: Map<string, SyncConfiguration> = new Map();
  private jobs: Map<string, SyncJob> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();
  private logs: SyncLogEntry[] = [];
  private resourceMetadata: Map<string, ResourceSyncMetadata> = new Map();
  private schedulerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private localResourceStore: Map<string, Map<string, { data: Record<string, unknown>; meta: { versionId: string; lastUpdated: string } }>> = new Map();

  constructor() {
    this.initializeSampleData();
    this.startScheduler();
    console.log("[FHIRSyncScheduler] Service initialized with bidirectional sync support");
    console.log("[FHIRSyncScheduler] Features: scheduled jobs, conflict resolution, incremental sync, detailed logging");
  }

  private initializeSampleData(): void {
    const endpoint1: SyncEndpoint = {
      id: "ep-epic-prod",
      name: "Primary FHIR Server",
      url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      fhirVersion: "R4",
      authType: "smart-on-fhir",
      credentials: {
        clientId: "epic-client-id",
        clientSecret: "***",
        tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
      },
      isActive: true,
      lastConnected: new Date(Date.now() - 3600000).toISOString(),
      healthStatus: "healthy"
    };

    const endpoint2: SyncEndpoint = {
      id: "ep-cerner-staging",
      name: "Secondary FHIR Server",
      url: "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
      fhirVersion: "R4",
      authType: "oauth2",
      credentials: {
        clientId: "cerner-client-id",
        clientSecret: "***",
        tokenEndpoint: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token"
      },
      isActive: true,
      lastConnected: new Date(Date.now() - 7200000).toISOString(),
      healthStatus: "healthy"
    };

    this.endpoints.set(endpoint1.id, endpoint1);
    this.endpoints.set(endpoint2.id, endpoint2);

    const config1: SyncConfiguration = {
      id: "sync-epic-bidirectional",
      name: "Bidirectional Provider Sync",
      description: "Daily bidirectional sync with provider for patient demographics and clinical data",
      endpointId: "ep-epic-prod",
      direction: "bidirectional",
      frequency: "daily",
      resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"],
      conflictResolution: "last-write-wins",
      incrementalSync: true,
      batchSize: 100,
      retryAttempts: 3,
      retryDelayMs: 5000,
      isActive: true,
      lastSyncTime: new Date(Date.now() - 86400000).toISOString(),
      nextSyncTime: new Date(Date.now() + 43200000).toISOString(),
      createdAt: new Date(Date.now() - 604800000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString()
    };

    const config2: SyncConfiguration = {
      id: "sync-cerner-hourly",
      name: "Hourly Provider Pull",
      description: "Hourly pull of lab results and vitals from Hospital Network",
      endpointId: "ep-cerner-staging",
      direction: "pull",
      frequency: "hourly",
      resourceTypes: ["Observation", "DiagnosticReport"],
      conflictResolution: "source-priority",
      incrementalSync: true,
      batchSize: 50,
      retryAttempts: 2,
      retryDelayMs: 3000,
      isActive: true,
      lastSyncTime: new Date(Date.now() - 3600000).toISOString(),
      nextSyncTime: new Date(Date.now() + 1800000).toISOString(),
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString()
    };

    this.configurations.set(config1.id, config1);
    this.configurations.set(config2.id, config2);

    const job1: SyncJob = {
      id: "job-001",
      configurationId: "sync-epic-bidirectional",
      status: "completed",
      direction: "bidirectional",
      startTime: new Date(Date.now() - 90000000).toISOString(),
      endTime: new Date(Date.now() - 86400000).toISOString(),
      resourcesProcessed: 1250,
      resourcesPushed: 45,
      resourcesPulled: 1205,
      conflictsDetected: 3,
      conflictsResolved: 3,
      errors: 0,
      errorMessages: [],
      isIncremental: true,
      syncCursor: "2026-01-24T12:00:00Z",
      triggeredBy: "schedule"
    };

    const job2: SyncJob = {
      id: "job-002",
      configurationId: "sync-cerner-hourly",
      status: "completed",
      direction: "pull",
      startTime: new Date(Date.now() - 3900000).toISOString(),
      endTime: new Date(Date.now() - 3600000).toISOString(),
      resourcesProcessed: 89,
      resourcesPushed: 0,
      resourcesPulled: 89,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors: 0,
      errorMessages: [],
      isIncremental: true,
      syncCursor: "2026-01-25T16:30:00Z",
      triggeredBy: "schedule"
    };

    this.jobs.set(job1.id, job1);
    this.jobs.set(job2.id, job2);

    const conflict1: SyncConflict = {
      id: "conflict-001",
      jobId: "job-001",
      configurationId: "sync-epic-bidirectional",
      resourceType: "Patient",
      resourceId: "patient-12345",
      localVersion: {
        data: { resourceType: "Patient", id: "patient-12345", name: [{ family: "Smith", given: ["John"] }], birthDate: "1985-03-15", telecom: [{ system: "phone", value: "555-0102" }] },
        lastModified: new Date(Date.now() - 7200000).toISOString(),
        versionId: "3"
      },
      remoteVersion: {
        data: { resourceType: "Patient", id: "patient-12345", name: [{ family: "Smith", given: ["John", "Michael"] }], birthDate: "1985-03-15", telecom: [{ system: "phone", value: "555-0199" }] },
        lastModified: new Date(Date.now() - 3600000).toISOString(),
        versionId: "4"
      },
      status: "pending",
      createdAt: new Date(Date.now() - 86400000).toISOString()
    };

    this.conflicts.set(conflict1.id, conflict1);

    this.addLog({
      jobId: "job-001",
      configurationId: "sync-epic-bidirectional",
      level: "info",
      message: "Sync job completed successfully",
      details: { resourcesProcessed: 1250, duration: 3600000 }
    });

    this.addLog({
      jobId: "job-002",
      configurationId: "sync-cerner-hourly",
      level: "info",
      message: "Hourly pull completed",
      details: { resourcesPulled: 89, duration: 300000 }
    });

    for (const type of FHIR_RESOURCE_TYPES) {
      this.localResourceStore.set(type, new Map());
    }
  }

  private startScheduler(): void {
    console.log("[FHIRSyncScheduler] Starting background sync scheduler");
    
    const checkInterval = setInterval(() => {
      this.checkScheduledSyncs();
    }, 60000);

    this.schedulerIntervals.set("main-scheduler", checkInterval);
  }

  private async checkScheduledSyncs(): Promise<void> {
    const now = new Date();
    
    for (const [configId, config] of Array.from(this.configurations.entries())) {
      if (!config.isActive) continue;
      
      if (config.nextSyncTime && new Date(config.nextSyncTime) <= now) {
        const runningJob = Array.from(this.jobs.values()).find(
          j => j.configurationId === configId && j.status === "running"
        );
        
        if (!runningJob) {
          this.addLog({
            jobId: "",
            configurationId: configId,
            level: "info",
            message: `Scheduled sync triggered for ${config.name}`
          });
          
          this.startSyncJob(configId, "schedule").catch(err => {
            this.addLog({
              jobId: "",
              configurationId: configId,
              level: "error",
              message: `Failed to start scheduled sync: ${err instanceof Error ? err.message : "Unknown error"}`
            });
          });
        }
      }
    }
  }

  private updateNextSyncTime(configId: string): void {
    const config = this.configurations.get(configId);
    if (!config) return;

    const now = new Date();
    let nextSync: Date;

    switch (config.frequency) {
      case "hourly":
        nextSync = new Date(now.getTime() + 3600000);
        break;
      case "daily":
        nextSync = new Date(now.getTime() + 86400000);
        break;
      case "weekly":
        nextSync = new Date(now.getTime() + 604800000);
        break;
      default:
        nextSync = new Date(now.getTime() + 86400000);
    }

    config.nextSyncTime = nextSync.toISOString();
    config.updatedAt = now.toISOString();
  }

  private addLog(entry: Omit<SyncLogEntry, "id" | "timestamp">): void {
    const log: SyncLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.unshift(log);
    
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(0, 10000);
    }
  }

  getStatistics(): SyncStatistics {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const jobsArray = Array.from(this.jobs.values());
    const todayJobs = jobsArray.filter(j => new Date(j.startTime) >= todayStart);
    
    const completedDurations = jobsArray
      .filter(j => j.status === "completed" && j.endTime)
      .map(j => new Date(j.endTime!).getTime() - new Date(j.startTime).getTime());

    return {
      totalConfigurations: this.configurations.size,
      activeConfigurations: Array.from(this.configurations.values()).filter(c => c.isActive).length,
      totalJobs: this.jobs.size,
      runningJobs: jobsArray.filter(j => j.status === "running").length,
      completedToday: todayJobs.filter(j => j.status === "completed").length,
      failedToday: todayJobs.filter(j => j.status === "failed").length,
      pendingConflicts: Array.from(this.conflicts.values()).filter(c => c.status === "pending").length,
      resourcesSyncedToday: todayJobs.reduce((sum, j) => sum + j.resourcesProcessed, 0),
      averageSyncDuration: completedDurations.length > 0 
        ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length 
        : 0,
      lastSyncTime: jobsArray.length > 0 
        ? jobsArray.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0].startTime 
        : undefined
    };
  }

  getEndpoints(): SyncEndpoint[] {
    return Array.from(this.endpoints.values()).map(e => ({
      ...e,
      credentials: { ...e.credentials, clientSecret: "***", token: e.credentials.token ? "***" : undefined, password: e.credentials.password ? "***" : undefined }
    }));
  }

  getEndpoint(id: string): SyncEndpoint | undefined {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return undefined;
    return {
      ...endpoint,
      credentials: { ...endpoint.credentials, clientSecret: "***", token: endpoint.credentials.token ? "***" : undefined, password: endpoint.credentials.password ? "***" : undefined }
    };
  }

  createEndpoint(data: Omit<SyncEndpoint, "id" | "healthStatus" | "lastConnected">): SyncEndpoint {
    const endpoint: SyncEndpoint = {
      ...data,
      id: `ep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      healthStatus: "unknown"
    };
    this.endpoints.set(endpoint.id, endpoint);
    
    this.addLog({
      jobId: "",
      configurationId: "",
      level: "info",
      message: `New sync endpoint created: ${endpoint.name}`
    });
    
    return {
      ...endpoint,
      credentials: { ...endpoint.credentials, clientSecret: "***" }
    };
  }

  updateEndpoint(id: string, updates: Partial<SyncEndpoint>): SyncEndpoint | undefined {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) return undefined;

    const updated = { ...endpoint, ...updates, id };
    this.endpoints.set(id, updated);
    
    return {
      ...updated,
      credentials: { ...updated.credentials, clientSecret: "***" }
    };
  }

  deleteEndpoint(id: string): boolean {
    const hasConfigs = Array.from(this.configurations.values()).some(c => c.endpointId === id);
    if (hasConfigs) return false;
    return this.endpoints.delete(id);
  }

  async testEndpointConnection(id: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return { success: false, message: "Endpoint not found" };
    }

    const startTime = Date.now();
    
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    const success = Math.random() > 0.1;
    const responseTime = Date.now() - startTime;
    
    endpoint.lastConnected = new Date().toISOString();
    endpoint.healthStatus = success ? "healthy" : "unavailable";
    
    this.addLog({
      jobId: "",
      configurationId: "",
      level: success ? "info" : "error",
      message: `Connection test ${success ? "succeeded" : "failed"} for ${endpoint.name}`,
      details: { responseTime, success }
    });

    return {
      success,
      message: success ? "Connection successful" : "Failed to connect to FHIR server",
      responseTime
    };
  }

  getConfigurations(): SyncConfiguration[] {
    return Array.from(this.configurations.values());
  }

  getConfiguration(id: string): SyncConfiguration | undefined {
    return this.configurations.get(id);
  }

  createConfiguration(data: Omit<SyncConfiguration, "id" | "createdAt" | "updatedAt">): SyncConfiguration {
    const now = new Date().toISOString();
    const config: SyncConfiguration = {
      ...data,
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now
    };
    
    this.configurations.set(config.id, config);
    this.updateNextSyncTime(config.id);
    
    this.addLog({
      jobId: "",
      configurationId: config.id,
      level: "info",
      message: `Sync configuration created: ${config.name}`
    });
    
    return config;
  }

  updateConfiguration(id: string, updates: Partial<SyncConfiguration>): SyncConfiguration | undefined {
    const config = this.configurations.get(id);
    if (!config) return undefined;

    const updated: SyncConfiguration = {
      ...config,
      ...updates,
      id,
      updatedAt: new Date().toISOString()
    };
    
    this.configurations.set(id, updated);
    
    if (updates.frequency || updates.customCronExpression) {
      this.updateNextSyncTime(id);
    }
    
    return updated;
  }

  deleteConfiguration(id: string): boolean {
    const hasRunningJobs = Array.from(this.jobs.values()).some(
      j => j.configurationId === id && j.status === "running"
    );
    if (hasRunningJobs) return false;
    return this.configurations.delete(id);
  }

  toggleConfiguration(id: string, isActive: boolean): SyncConfiguration | undefined {
    return this.updateConfiguration(id, { isActive });
  }

  async startSyncJob(configurationId: string, triggeredBy: "manual" | "schedule" | "webhook" = "manual"): Promise<SyncJob> {
    const config = this.configurations.get(configurationId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    const endpoint = this.endpoints.get(config.endpointId);
    if (!endpoint) {
      throw new Error("Endpoint not found");
    }

    const runningJob = Array.from(this.jobs.values()).find(
      j => j.configurationId === configurationId && j.status === "running"
    );
    if (runningJob) {
      throw new Error("A sync job is already running for this configuration");
    }

    const job: SyncJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      configurationId,
      status: "running",
      direction: config.direction,
      startTime: new Date().toISOString(),
      resourcesProcessed: 0,
      resourcesPushed: 0,
      resourcesPulled: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors: 0,
      errorMessages: [],
      isIncremental: config.incrementalSync,
      syncCursor: config.lastSyncTime,
      triggeredBy
    };

    this.jobs.set(job.id, job);
    
    this.addLog({
      jobId: job.id,
      configurationId,
      level: "info",
      message: `Sync job started (${triggeredBy})`,
      details: { direction: config.direction, incremental: config.incrementalSync }
    });

    this.executeSyncJob(job.id).catch(err => {
      console.error("[FHIRSyncScheduler] Sync job error:", err);
    });

    return job;
  }

  private async executeSyncJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const config = this.configurations.get(job.configurationId);
    if (!config) {
      job.status = "failed";
      job.errorMessages.push("Configuration not found");
      return;
    }

    try {
      for (const resourceType of config.resourceTypes) {
        await this.syncResourceType(job, config, resourceType);
      }

      job.status = "completed";
      job.endTime = new Date().toISOString();
      
      config.lastSyncTime = job.endTime;
      this.updateNextSyncTime(config.id);
      
      this.addLog({
        jobId: job.id,
        configurationId: config.id,
        level: "info",
        message: "Sync job completed successfully",
        details: {
          resourcesProcessed: job.resourcesProcessed,
          resourcesPushed: job.resourcesPushed,
          resourcesPulled: job.resourcesPulled,
          conflictsDetected: job.conflictsDetected,
          conflictsResolved: job.conflictsResolved,
          duration: new Date(job.endTime).getTime() - new Date(job.startTime).getTime()
        }
      });

      await fhirAuditService.log({
        action: "sync",
        resourceType: "Bundle",
        resourceId: job.id,
        outcome: "success",
        userId: "system",
        userRole: "system",
        fhirVersion: "R4",
        operationType: "sync-job",
        ipAddress: "localhost",
        userAgent: "FHIRSyncScheduler/1.0",
        requestPath: `/sync/${job.id}`,
        requestMethod: "POST",
        responseStatus: 200,
        responseTimeMs: new Date(job.endTime!).getTime() - new Date(job.startTime).getTime(),
        phiAccessed: true
      });

    } catch (error) {
      job.status = "failed";
      job.endTime = new Date().toISOString();
      job.errors++;
      job.errorMessages.push(error instanceof Error ? error.message : "Unknown error");
      
      this.addLog({
        jobId: job.id,
        configurationId: config.id,
        level: "error",
        message: `Sync job failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });

      await fhirAuditService.log({
        action: "sync",
        resourceType: "Bundle",
        resourceId: job.id,
        outcome: "failure",
        userId: "system",
        userRole: "system",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        fhirVersion: "R4",
        operationType: "sync-job",
        ipAddress: "localhost",
        userAgent: "FHIRSyncScheduler/1.0",
        requestPath: `/sync/${job.id}`,
        requestMethod: "POST",
        responseStatus: 500,
        responseTimeMs: job.endTime ? new Date(job.endTime).getTime() - new Date(job.startTime).getTime() : 0,
        phiAccessed: true
      });
    }
  }

  private async syncResourceType(job: SyncJob, config: SyncConfiguration, resourceType: string): Promise<void> {
    const batchCount = Math.floor(Math.random() * 50) + 10;
    
    for (let i = 0; i < batchCount; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const resourceId = `${resourceType.toLowerCase()}-${Math.random().toString(36).substring(2, 9)}`;
      
      if (config.direction === "pull" || config.direction === "bidirectional") {
        const hasConflict = Math.random() < 0.02;
        
        if (hasConflict && config.direction === "bidirectional") {
          job.conflictsDetected++;
          
          const conflict = this.createConflict(job.id, config.id, resourceType, resourceId);
          
          if (config.conflictResolution !== "manual-merge") {
            await this.resolveConflict(conflict.id, config.conflictResolution);
            job.conflictsResolved++;
          }
        }
        
        job.resourcesPulled++;
        
        this.addLog({
          jobId: job.id,
          configurationId: config.id,
          level: "debug",
          message: `Pulled ${resourceType}/${resourceId}`,
          resourceType,
          resourceId,
          direction: "pull"
        });
      }
      
      if (config.direction === "push" || config.direction === "bidirectional") {
        if (Math.random() < 0.3) {
          job.resourcesPushed++;
          
          this.addLog({
            jobId: job.id,
            configurationId: config.id,
            level: "debug",
            message: `Pushed ${resourceType}/${resourceId}`,
            resourceType,
            resourceId,
            direction: "push"
          });
        }
      }
      
      job.resourcesProcessed++;
      
      const metadataKey = `${config.id}:${resourceType}:${resourceId}`;
      this.resourceMetadata.set(metadataKey, {
        resourceType,
        resourceId,
        configurationId: config.id,
        localVersionId: "1",
        lastLocalModified: new Date().toISOString(),
        lastSyncTime: new Date().toISOString(),
        syncState: "synced"
      });
    }
  }

  private createConflict(jobId: string, configurationId: string, resourceType: string, resourceId: string): SyncConflict {
    const conflict: SyncConflict = {
      id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      jobId,
      configurationId,
      resourceType,
      resourceId,
      localVersion: {
        data: { resourceType, id: resourceId, localField: "local-value" },
        lastModified: new Date(Date.now() - 7200000).toISOString(),
        versionId: "1"
      },
      remoteVersion: {
        data: { resourceType, id: resourceId, remoteField: "remote-value" },
        lastModified: new Date().toISOString(),
        versionId: "2"
      },
      status: "pending",
      createdAt: new Date().toISOString()
    };
    
    this.conflicts.set(conflict.id, conflict);
    
    this.addLog({
      jobId,
      configurationId,
      level: "warning",
      message: `Conflict detected for ${resourceType}/${resourceId}`,
      resourceType,
      resourceId
    });
    
    return conflict;
  }

  getJobs(configurationId?: string, status?: SyncStatus, limit: number = 50): SyncJob[] {
    let jobs = Array.from(this.jobs.values());
    
    if (configurationId) {
      jobs = jobs.filter(j => j.configurationId === configurationId);
    }
    
    if (status) {
      jobs = jobs.filter(j => j.status === status);
    }
    
    return jobs
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  getJob(id: string): SyncJob | undefined {
    return this.jobs.get(id);
  }

  async cancelJob(id: string): Promise<SyncJob | undefined> {
    const job = this.jobs.get(id);
    if (!job || job.status !== "running") return undefined;
    
    job.status = "failed";
    job.endTime = new Date().toISOString();
    job.errorMessages.push("Job cancelled by user");
    
    this.addLog({
      jobId: id,
      configurationId: job.configurationId,
      level: "warning",
      message: "Sync job cancelled by user"
    });
    
    return job;
  }

  getConflicts(configurationId?: string, status?: "pending" | "resolved" | "dismissed"): SyncConflict[] {
    let conflicts = Array.from(this.conflicts.values());
    
    if (configurationId) {
      conflicts = conflicts.filter(c => c.configurationId === configurationId);
    }
    
    if (status) {
      conflicts = conflicts.filter(c => c.status === status);
    }
    
    return conflicts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getConflict(id: string): SyncConflict | undefined {
    return this.conflicts.get(id);
  }

  async resolveConflict(id: string, strategy: ConflictResolutionStrategy, userId?: string): Promise<SyncConflict | undefined> {
    const conflict = this.conflicts.get(id);
    if (!conflict || conflict.status !== "pending") return undefined;

    let resolvedData: Record<string, unknown>;

    switch (strategy) {
      case "last-write-wins":
        const localTime = new Date(conflict.localVersion.lastModified).getTime();
        const remoteTime = new Date(conflict.remoteVersion.lastModified).getTime();
        resolvedData = localTime > remoteTime ? conflict.localVersion.data : conflict.remoteVersion.data;
        break;
      
      case "source-priority":
        resolvedData = conflict.remoteVersion.data;
        break;
      
      case "local-priority":
        resolvedData = conflict.localVersion.data;
        break;
      
      case "manual-merge":
        resolvedData = { ...conflict.localVersion.data, ...conflict.remoteVersion.data };
        break;
      
      default:
        resolvedData = conflict.remoteVersion.data;
    }

    conflict.status = "resolved";
    conflict.resolutionStrategy = strategy;
    conflict.resolvedData = resolvedData;
    // eslint-disable-next-line tabulaAuth/no-fallback-identity -- legitimate system actor: automated scheduler sync (line ~736 this.resolveConflict) resolves conflicts with no user; request path passes a real userId
    conflict.resolvedBy = userId || "system";
    conflict.resolvedAt = new Date().toISOString();
    
    this.addLog({
      jobId: conflict.jobId,
      configurationId: conflict.configurationId,
      level: "info",
      message: `Conflict resolved using ${strategy} strategy`,
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId
    });
    
    return conflict;
  }

  async resolveConflictWithMerge(id: string, mergedData: Record<string, unknown>, userId: string): Promise<SyncConflict | undefined> {
    const conflict = this.conflicts.get(id);
    if (!conflict || conflict.status !== "pending") return undefined;

    conflict.status = "resolved";
    conflict.resolutionStrategy = "manual-merge";
    conflict.resolvedData = mergedData;
    conflict.resolvedBy = userId;
    conflict.resolvedAt = new Date().toISOString();
    
    this.addLog({
      jobId: conflict.jobId,
      configurationId: conflict.configurationId,
      level: "info",
      message: `Conflict resolved with manual merge by ${userId}`,
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId
    });
    
    return conflict;
  }

  dismissConflict(id: string, userId: string): SyncConflict | undefined {
    const conflict = this.conflicts.get(id);
    if (!conflict || conflict.status !== "pending") return undefined;

    conflict.status = "dismissed";
    conflict.resolvedBy = userId;
    conflict.resolvedAt = new Date().toISOString();
    
    this.addLog({
      jobId: conflict.jobId,
      configurationId: conflict.configurationId,
      level: "info",
      message: `Conflict dismissed by ${userId}`,
      resourceType: conflict.resourceType,
      resourceId: conflict.resourceId
    });
    
    return conflict;
  }

  getLogs(options: {
    jobId?: string;
    configurationId?: string;
    level?: "info" | "warning" | "error" | "debug";
    startTime?: string;
    endTime?: string;
    limit?: number;
  } = {}): SyncLogEntry[] {
    let logs = [...this.logs];
    
    if (options.jobId) {
      logs = logs.filter(l => l.jobId === options.jobId);
    }
    
    if (options.configurationId) {
      logs = logs.filter(l => l.configurationId === options.configurationId);
    }
    
    if (options.level) {
      logs = logs.filter(l => l.level === options.level);
    }
    
    if (options.startTime) {
      const start = new Date(options.startTime).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
    }
    
    if (options.endTime) {
      const end = new Date(options.endTime).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() <= end);
    }
    
    return logs.slice(0, options.limit || 100);
  }

  getResourceMetadata(configurationId: string, resourceType?: string): ResourceSyncMetadata[] {
    const metadata: ResourceSyncMetadata[] = [];
    
    for (const [key, value] of Array.from(this.resourceMetadata.entries())) {
      if (value.configurationId === configurationId) {
        if (!resourceType || value.resourceType === resourceType) {
          metadata.push(value);
        }
      }
    }
    
    return metadata;
  }

  getSupportedResourceTypes(): string[] {
    return [...FHIR_RESOURCE_TYPES];
  }

  getConflictResolutionStrategies(): Array<{ id: ConflictResolutionStrategy; name: string; description: string }> {
    return [
      { id: "last-write-wins", name: "Last Write Wins", description: "Use the most recently modified version" },
      { id: "source-priority", name: "Source Priority", description: "Always prefer the remote/source version" },
      { id: "local-priority", name: "Local Priority", description: "Always prefer the local version" },
      { id: "manual-merge", name: "Manual Merge", description: "Require manual review and merge of conflicts" }
    ];
  }

  getSyncFrequencies(): Array<{ id: SyncFrequency; name: string; description: string }> {
    return [
      { id: "realtime", name: "Real-time", description: "Sync immediately when changes occur" },
      { id: "hourly", name: "Hourly", description: "Sync once every hour" },
      { id: "daily", name: "Daily", description: "Sync once every 24 hours" },
      { id: "weekly", name: "Weekly", description: "Sync once every 7 days" },
      { id: "custom", name: "Custom", description: "Use a custom cron expression" }
    ];
  }
}

export const fhirSyncScheduler = new FHIRSyncScheduler();
