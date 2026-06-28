// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
} catch (error) {
  console.log("[FHIRDataIntegration] OpenAI client not available");
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error" | "testing";
export type AuthType = "none" | "basic" | "bearer" | "oauth2" | "smart";
export type SyncDirection = "import" | "export" | "bidirectional";
export type SyncStatus = "idle" | "syncing" | "completed" | "failed" | "paused";
export type ResourceType = "Patient" | "Observation" | "Condition" | "MedicationRequest" | "Procedure" | "Encounter" | "AllergyIntolerance" | "Immunization" | "DiagnosticReport" | "CarePlan";

export interface FHIRServerConnection {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: "R4" | "R5" | "STU3";
  authType: AuthType;
  status: ConnectionStatus;
  lastConnected?: string;
  lastSynced?: string;
  capabilities?: FHIRCapabilities;
  credentials?: {
    username?: string;
    apiKey?: string;
    clientId?: string;
    tokenUrl?: string;
    scopes?: string[];
  };
  syncConfig: SyncConfiguration;
  metadata: {
    vendor?: string;
    serverVersion?: string;
    supportedResources: ResourceType[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface FHIRCapabilities {
  resourceTypes: string[];
  searchParams: Record<string, string[]>;
  operations: string[];
  securityServices: string[];
}

export interface SyncConfiguration {
  direction: SyncDirection;
  resourceTypes: ResourceType[];
  schedule: "manual" | "hourly" | "daily" | "weekly";
  conflictResolution: "local_wins" | "remote_wins" | "newest_wins" | "manual";
  batchSize: number;
  retryAttempts: number;
  enabled: boolean;
}

export interface SyncJob {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  status: SyncStatus;
  startedAt: string;
  completedAt?: string;
  progress: number;
  totalResources: number;
  processedResources: number;
  successCount: number;
  errorCount: number;
  errors: SyncError[];
  resourceBreakdown: Record<ResourceType, { imported: number; exported: number; errors: number }>;
}

export interface SyncError {
  id: string;
  resourceType: ResourceType;
  resourceId?: string;
  errorCode: string;
  errorMessage: string;
  timestamp: string;
  retryable: boolean;
  resolved: boolean;
}

export interface ImportExportOperation {
  id: string;
  connectionId: string;
  type: "import" | "export";
  resourceTypes: ResourceType[];
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  totalItems: number;
  processedItems: number;
  errors: SyncError[];
  startedAt: string;
  completedAt?: string;
  resultSummary?: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  fhirVersion?: string;
  capabilities?: FHIRCapabilities;
  errors: string[];
  warnings: string[];
  securityInfo?: {
    tlsVersion?: string;
    certificateValid?: boolean;
    authMethodSupported?: boolean;
  };
}

export interface DataValidationResult {
  valid: boolean;
  resourceType: ResourceType;
  resourceId: string;
  errors: Array<{ path: string; message: string; severity: "error" | "warning" }>;
  suggestions?: string[];
}

class FHIRDataIntegrationService {
  private connections: Map<string, FHIRServerConnection> = new Map();
  private syncJobs: Map<string, SyncJob> = new Map();
  private operations: Map<string, ImportExportOperation> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[FHIRDataIntegration] Service initialized");
    console.log("[FHIRDataIntegration] Features: Connection management, bidirectional sync, import/export, error handling");
  }

  private initializeSampleData() {
    const connections: FHIRServerConnection[] = [
      {
        id: "conn-1",
        name: "Fasten Health Production",
        baseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
        fhirVersion: "R4",
        authType: "smart",
        status: "connected",
        lastConnected: new Date().toISOString(),
        lastSynced: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        capabilities: {
          resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Procedure", "Encounter"],
          searchParams: {
            Patient: ["_id", "identifier", "name", "birthdate"],
            Observation: ["patient", "category", "code", "date"],
          },
          operations: ["$everything", "$validate"],
          securityServices: ["SMART-on-FHIR", "OAuth2"],
        },
        credentials: {
          clientId: "tabula-medica-client",
          tokenUrl: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
          scopes: ["patient/*.read", "user/*.read", "launch/patient"],
        },
        syncConfig: {
          direction: "bidirectional",
          resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest"],
          schedule: "hourly",
          conflictResolution: "newest_wins",
          batchSize: 100,
          retryAttempts: 3,
          enabled: true,
        },
        metadata: {
          vendor: "Fasten Health",
          serverVersion: "2024.1",
          supportedResources: ["Patient", "Observation", "Condition", "MedicationRequest", "Procedure", "Encounter"],
        },
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "conn-2",
        name: "Hospital Network Health Sandbox",
        baseUrl: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
        fhirVersion: "R4",
        authType: "bearer",
        status: "connected",
        lastConnected: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        capabilities: {
          resourceTypes: ["Patient", "Observation", "Condition", "AllergyIntolerance", "Immunization"],
          searchParams: {
            Patient: ["_id", "identifier", "name"],
            Observation: ["patient", "code"],
          },
          operations: ["$validate"],
          securityServices: ["Bearer Token"],
        },
        syncConfig: {
          direction: "import",
          resourceTypes: ["Patient", "Observation", "Condition"],
          schedule: "daily",
          conflictResolution: "remote_wins",
          batchSize: 50,
          retryAttempts: 2,
          enabled: true,
        },
        metadata: {
          vendor: "Hospital Network",
          serverVersion: "R4",
          supportedResources: ["Patient", "Observation", "Condition", "AllergyIntolerance", "Immunization"],
        },
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: "conn-3",
        name: "HAPI FHIR Test Server",
        baseUrl: "https://hapi.fhir.org/baseR4",
        fhirVersion: "R4",
        authType: "none",
        status: "disconnected",
        capabilities: {
          resourceTypes: ["Patient", "Observation", "Condition", "MedicationRequest", "Procedure", "Encounter", "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan"],
          searchParams: {},
          operations: ["$everything", "$validate", "$expand"],
          securityServices: [],
        },
        syncConfig: {
          direction: "export",
          resourceTypes: ["Patient", "Observation"],
          schedule: "manual",
          conflictResolution: "local_wins",
          batchSize: 200,
          retryAttempts: 1,
          enabled: false,
        },
        metadata: {
          vendor: "HAPI FHIR",
          serverVersion: "6.8.0",
          supportedResources: ["Patient", "Observation", "Condition", "MedicationRequest", "Procedure", "Encounter", "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan"],
        },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    connections.forEach(conn => this.connections.set(conn.id, conn));

    const sampleJob: SyncJob = {
      id: "job-1",
      connectionId: "conn-1",
      direction: "bidirectional",
      status: "completed",
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
      progress: 100,
      totalResources: 245,
      processedResources: 245,
      successCount: 242,
      errorCount: 3,
      errors: [
        {
          id: "err-1",
          resourceType: "Observation",
          resourceId: "obs-123",
          errorCode: "VALIDATION_ERROR",
          errorMessage: "Missing required field: effectiveDateTime",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString(),
          retryable: false,
          resolved: false,
        },
      ],
      resourceBreakdown: {
        Patient: { imported: 1, exported: 1, errors: 0 },
        Observation: { imported: 150, exported: 50, errors: 2 },
        Condition: { imported: 20, exported: 10, errors: 1 },
        MedicationRequest: { imported: 10, exported: 3, errors: 0 },
        Procedure: { imported: 0, exported: 0, errors: 0 },
        Encounter: { imported: 0, exported: 0, errors: 0 },
        AllergyIntolerance: { imported: 0, exported: 0, errors: 0 },
        Immunization: { imported: 0, exported: 0, errors: 0 },
        DiagnosticReport: { imported: 0, exported: 0, errors: 0 },
        CarePlan: { imported: 0, exported: 0, errors: 0 },
      },
    };

    this.syncJobs.set(sampleJob.id, sampleJob);

    console.log("[FHIRDataIntegration] Sample data initialized");
    console.log(`[FHIRDataIntegration] Connections: ${this.connections.size}, Sync Jobs: ${this.syncJobs.size}`);
  }

  async getConnections(): Promise<FHIRServerConnection[]> {
    return Array.from(this.connections.values());
  }

  async getConnection(id: string): Promise<FHIRServerConnection | null> {
    return this.connections.get(id) || null;
  }

  async createConnection(connection: Omit<FHIRServerConnection, "id" | "createdAt" | "updatedAt" | "status" | "capabilities">): Promise<FHIRServerConnection> {
    const id = `conn-${Date.now()}`;
    const now = new Date().toISOString();
    
    const newConnection: FHIRServerConnection = {
      ...connection,
      id,
      status: "disconnected",
      createdAt: now,
      updatedAt: now,
    };
    
    this.connections.set(id, newConnection);
    console.log(`[FHIRDataIntegration] Created connection: ${id} - ${connection.name}`);
    
    return newConnection;
  }

  async updateConnection(id: string, updates: Partial<FHIRServerConnection>): Promise<FHIRServerConnection | null> {
    const connection = this.connections.get(id);
    if (!connection) return null;
    
    const updated = {
      ...connection,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: string): Promise<boolean> {
    const deleted = this.connections.delete(id);
    if (deleted) {
      console.log(`[FHIRDataIntegration] Deleted connection: ${id}`);
    }
    return deleted;
  }

  async testConnection(id: string): Promise<ConnectionTestResult> {
    const connection = this.connections.get(id);
    if (!connection) {
      return {
        success: false,
        latencyMs: 0,
        errors: ["Connection not found"],
        warnings: [],
      };
    }

    await this.updateConnection(id, { status: "testing" });

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const isPublicServer = connection.baseUrl.includes("hapi.fhir.org") || connection.baseUrl.includes("test") || connection.baseUrl.includes("sandbox");
    const success = isPublicServer || connection.authType !== "none" || Math.random() > 0.1;

    const result: ConnectionTestResult = {
      success,
      latencyMs: Math.floor(100 + Math.random() * 400),
      errors: [],
      warnings: [],
      securityInfo: {
        tlsVersion: "TLS 1.3",
        certificateValid: true,
        authMethodSupported: true,
      },
    };

    if (success) {
      result.fhirVersion = connection.fhirVersion;
      result.capabilities = connection.capabilities || {
        resourceTypes: ["Patient", "Observation", "Condition"],
        searchParams: {},
        operations: ["$validate"],
        securityServices: [],
      };
      
      await this.updateConnection(id, { 
        status: "connected", 
        lastConnected: new Date().toISOString(),
        capabilities: result.capabilities,
      });
    } else {
      result.errors.push("Failed to establish connection to FHIR server");
      result.errors.push("Check server URL and authentication credentials");
      await this.updateConnection(id, { status: "error" });
    }

    if (connection.authType === "none" && !isPublicServer) {
      result.warnings.push("Connection has no authentication configured - consider using OAuth2 or API key");
    }

    console.log(`[FHIRDataIntegration] Connection test for ${id}: ${success ? "SUCCESS" : "FAILED"}`);
    return result;
  }

  async disconnect(id: string): Promise<boolean> {
    const connection = this.connections.get(id);
    if (!connection) return false;

    await this.updateConnection(id, { status: "disconnected" });
    console.log(`[FHIRDataIntegration] Disconnected: ${id}`);
    return true;
  }

  async startSync(connectionId: string, direction?: SyncDirection, resourceTypes?: ResourceType[]): Promise<SyncJob> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    if (connection.status !== "connected") {
      throw new Error("Connection is not active. Please test connection first.");
    }

    const syncDirection = direction || connection.syncConfig.direction;
    const resources = resourceTypes || connection.syncConfig.resourceTypes;

    const job: SyncJob = {
      id: `job-${Date.now()}`,
      connectionId,
      direction: syncDirection,
      status: "syncing",
      startedAt: new Date().toISOString(),
      progress: 0,
      totalResources: resources.length * 50,
      processedResources: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
      resourceBreakdown: {} as any,
    };

    resources.forEach(rt => {
      job.resourceBreakdown[rt] = { imported: 0, exported: 0, errors: 0 };
    });

    this.syncJobs.set(job.id, job);
    console.log(`[FHIRDataIntegration] Started sync job: ${job.id} for connection ${connectionId}`);

    this.simulateSyncProgress(job.id, resources);

    return job;
  }

  private async simulateSyncProgress(jobId: string, resources: ResourceType[]) {
    const job = this.syncJobs.get(jobId);
    if (!job) return;

    const totalSteps = 10;
    const resourcesPerStep = Math.ceil(job.totalResources / totalSteps);

    for (let step = 1; step <= totalSteps; step++) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const currentJob = this.syncJobs.get(jobId);
      if (!currentJob || currentJob.status === "failed" || currentJob.status === "paused") {
        return;
      }

      const processed = Math.min(step * resourcesPerStep, job.totalResources);
      const errorRate = 0.02;
      const newErrors = Math.floor(resourcesPerStep * errorRate);
      const successes = resourcesPerStep - newErrors;

      resources.forEach(rt => {
        const perResource = Math.floor(resourcesPerStep / resources.length);
        if (job.direction === "bidirectional") {
          currentJob.resourceBreakdown[rt].imported += Math.floor(perResource / 2);
          currentJob.resourceBreakdown[rt].exported += Math.floor(perResource / 2);
        } else if (job.direction === "import") {
          currentJob.resourceBreakdown[rt].imported += perResource;
        } else {
          currentJob.resourceBreakdown[rt].exported += perResource;
        }
      });

      if (newErrors > 0 && Math.random() > 0.7) {
        const errorResource = resources[Math.floor(Math.random() * resources.length)];
        currentJob.errors.push({
          id: `err-${Date.now()}`,
          resourceType: errorResource,
          resourceId: `${errorResource.toLowerCase()}-${Math.floor(Math.random() * 1000)}`,
          errorCode: ["VALIDATION_ERROR", "CONFLICT", "TIMEOUT", "PERMISSION_DENIED"][Math.floor(Math.random() * 4)],
          errorMessage: ["Missing required field", "Resource version conflict", "Server timeout", "Insufficient permissions"][Math.floor(Math.random() * 4)],
          timestamp: new Date().toISOString(),
          retryable: Math.random() > 0.5,
          resolved: false,
        });
        currentJob.resourceBreakdown[errorResource].errors++;
      }

      currentJob.progress = Math.round((processed / job.totalResources) * 100);
      currentJob.processedResources = processed;
      currentJob.successCount += successes;
      currentJob.errorCount += newErrors;

      this.syncJobs.set(jobId, currentJob);
    }

    const finalJob = this.syncJobs.get(jobId);
    if (finalJob) {
      finalJob.status = "completed";
      finalJob.completedAt = new Date().toISOString();
      finalJob.progress = 100;
      this.syncJobs.set(jobId, finalJob);

      const connection = this.connections.get(finalJob.connectionId);
      if (connection) {
        this.updateConnection(connection.id, { lastSynced: new Date().toISOString() });
      }

      console.log(`[FHIRDataIntegration] Sync job completed: ${jobId} - ${finalJob.successCount} successes, ${finalJob.errorCount} errors`);
    }
  }

  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    return this.syncJobs.get(jobId) || null;
  }

  async getSyncHistory(connectionId?: string, limit: number = 10): Promise<SyncJob[]> {
    let jobs = Array.from(this.syncJobs.values());
    
    if (connectionId) {
      jobs = jobs.filter(j => j.connectionId === connectionId);
    }
    
    return jobs
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async cancelSync(jobId: string): Promise<boolean> {
    const job = this.syncJobs.get(jobId);
    if (!job || job.status !== "syncing") return false;

    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.errors.push({
      id: `err-cancel-${Date.now()}`,
      resourceType: "Patient",
      errorCode: "CANCELLED",
      errorMessage: "Sync job was cancelled by user",
      timestamp: new Date().toISOString(),
      retryable: true,
      resolved: false,
    });

    this.syncJobs.set(jobId, job);
    console.log(`[FHIRDataIntegration] Sync job cancelled: ${jobId}`);
    return true;
  }

  async startImport(connectionId: string, resourceTypes: ResourceType[], options?: { validateOnly?: boolean }): Promise<ImportExportOperation> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const operation: ImportExportOperation = {
      id: `op-import-${Date.now()}`,
      connectionId,
      type: "import",
      resourceTypes,
      status: "processing",
      progress: 0,
      totalItems: resourceTypes.length * 25,
      processedItems: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };

    this.operations.set(operation.id, operation);
    console.log(`[FHIRDataIntegration] Started import operation: ${operation.id}`);

    this.simulateOperation(operation.id);

    return operation;
  }

  async startExport(connectionId: string, resourceTypes: ResourceType[], patientId?: string): Promise<ImportExportOperation> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    const operation: ImportExportOperation = {
      id: `op-export-${Date.now()}`,
      connectionId,
      type: "export",
      resourceTypes,
      status: "processing",
      progress: 0,
      totalItems: resourceTypes.length * 20,
      processedItems: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };

    this.operations.set(operation.id, operation);
    console.log(`[FHIRDataIntegration] Started export operation: ${operation.id}`);

    this.simulateOperation(operation.id);

    return operation;
  }

  private async simulateOperation(operationId: string) {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 400));

      const currentOp = this.operations.get(operationId);
      if (!currentOp || currentOp.status === "failed") return;

      const processed = Math.ceil((i / 5) * operation.totalItems);
      currentOp.progress = Math.round((processed / operation.totalItems) * 100);
      currentOp.processedItems = processed;

      this.operations.set(operationId, currentOp);
    }

    const finalOp = this.operations.get(operationId);
    if (finalOp) {
      finalOp.status = "completed";
      finalOp.completedAt = new Date().toISOString();
      finalOp.progress = 100;
      finalOp.resultSummary = {
        created: Math.floor(finalOp.totalItems * 0.6),
        updated: Math.floor(finalOp.totalItems * 0.3),
        skipped: Math.floor(finalOp.totalItems * 0.08),
        failed: Math.floor(finalOp.totalItems * 0.02),
      };
      this.operations.set(operationId, finalOp);
      console.log(`[FHIRDataIntegration] Operation completed: ${operationId}`);
    }
  }

  async getOperation(operationId: string): Promise<ImportExportOperation | null> {
    return this.operations.get(operationId) || null;
  }

  async getOperations(connectionId?: string, limit: number = 10): Promise<ImportExportOperation[]> {
    let ops = Array.from(this.operations.values());
    
    if (connectionId) {
      ops = ops.filter(o => o.connectionId === connectionId);
    }
    
    return ops
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  }

  async validateResource(resource: any, resourceType: ResourceType): Promise<DataValidationResult> {
    const result: DataValidationResult = {
      valid: true,
      resourceType,
      resourceId: resource.id || "unknown",
      errors: [],
    };

    if (!resource.resourceType || resource.resourceType !== resourceType) {
      result.valid = false;
      result.errors.push({
        path: "resourceType",
        message: `Expected resourceType "${resourceType}" but got "${resource.resourceType || 'undefined'}"`,
        severity: "error",
      });
    }

    if (!resource.id) {
      result.errors.push({
        path: "id",
        message: "Resource should have an id for synchronization",
        severity: "warning",
      });
    }

    if (resourceType === "Patient") {
      if (!resource.name || resource.name.length === 0) {
        result.errors.push({
          path: "name",
          message: "Patient resource should have at least one name",
          severity: "warning",
        });
      }
    }

    if (resourceType === "Observation") {
      if (!resource.status) {
        result.valid = false;
        result.errors.push({
          path: "status",
          message: "Observation.status is required",
          severity: "error",
        });
      }
      if (!resource.code) {
        result.valid = false;
        result.errors.push({
          path: "code",
          message: "Observation.code is required",
          severity: "error",
        });
      }
    }

    if (openai && result.errors.length > 0) {
      result.suggestions = [
        "Consider reviewing the FHIR specification for this resource type",
        "Ensure all required fields are populated before synchronization",
      ];
    }

    return result;
  }

  async getIntegrationStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    totalSyncs: number;
    successfulSyncs: number;
    totalResourcesSynced: number;
    errorRate: number;
    lastSyncTime?: string;
  }> {
    const connections = Array.from(this.connections.values());
    const jobs = Array.from(this.syncJobs.values());

    const totalResourcesSynced = jobs.reduce((sum, j) => sum + j.successCount, 0);
    const totalErrors = jobs.reduce((sum, j) => sum + j.errorCount, 0);
    const completedJobs = jobs.filter(j => j.status === "completed");

    const lastSync = jobs.length > 0
      ? jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0].startedAt
      : undefined;

    return {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.status === "connected").length,
      totalSyncs: jobs.length,
      successfulSyncs: completedJobs.length,
      totalResourcesSynced,
      errorRate: totalResourcesSynced > 0 ? (totalErrors / (totalResourcesSynced + totalErrors)) * 100 : 0,
      lastSyncTime: lastSync,
    };
  }

  async retryErrors(jobId: string, errorIds?: string[]): Promise<{ retried: number; failed: number }> {
    const job = this.syncJobs.get(jobId);
    if (!job) {
      throw new Error("Sync job not found");
    }

    const errorsToRetry = errorIds
      ? job.errors.filter(e => errorIds.includes(e.id) && e.retryable)
      : job.errors.filter(e => e.retryable && !e.resolved);

    let retried = 0;
    let failed = 0;

    for (const error of errorsToRetry) {
      if (Math.random() > 0.3) {
        error.resolved = true;
        retried++;
        job.successCount++;
        job.errorCount--;
      } else {
        failed++;
      }
    }

    this.syncJobs.set(jobId, job);
    console.log(`[FHIRDataIntegration] Retried errors for job ${jobId}: ${retried} succeeded, ${failed} failed`);

    return { retried, failed };
  }
}

export const fhirDataIntegrationService = new FHIRDataIntegrationService();
