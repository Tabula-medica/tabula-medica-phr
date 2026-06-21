import { randomUUID, createHash } from "crypto";

/**
 * FHIR Bidirectional Sync Engine
 * 
 * DEVELOPMENT/MOCK IMPLEMENTATION
 * This service provides the framework and interface for bidirectional FHIR synchronization.
 * It demonstrates sync configuration management, US Core validation, and job tracking.
 * 
 * PRODUCTION REQUIREMENTS:
 * 1. Authentication/RBAC on all endpoints (currently unauthenticated for development)
 * 2. Full FHIR R4 profile validation (CodeableConcept, Quantity, bindings, slicing)
 * 3. Database persistence for configurations and job history
 * 4. Integration with actual FHIR server connectors
 * 5. Request body validation with Zod schemas
 * 6. Rate limiting and input size limits
 * 7. PHI data encrypted in transit (TLS 1.2+) and at rest
 * 8. Encrypted credential storage for server connections
 * 
 * CURRENT VALIDATION:
 * - Required field presence checks
 * - Code system binding validation for simple fields
 * - Must-support field warnings
 * - Profile declaration warnings
 * Note: Does not validate complex FHIR types (CodeableConcept structure, Quantity units)
 */

export interface SyncConfiguration {
  id: string;
  name: string;
  description: string;
  sourceServerId: string; // "local" for internal data
  targetServerId: string;
  resourceTypes: SyncResourceConfig[];
  syncDirection: "push" | "pull" | "bidirectional";
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  enabled: boolean;
  lastSyncAt?: string;
  nextSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResourceConfig {
  resourceType: string;
  enabled: boolean;
  syncOnCreate: boolean;
  syncOnUpdate: boolean;
  syncOnDelete: boolean;
  filterCriteria?: Record<string, string>;
  fieldMappings?: FieldSyncMapping[];
  validationProfile: string; // US Core profile to validate against
}

export interface FieldSyncMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
}

export interface SyncJob {
  id: string;
  configurationId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  direction: "push" | "pull";
  resourceType: string;
  resourceId?: string;
  startedAt?: string;
  completedAt?: string;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  errors: SyncError[];
  auditLogId: string;
}

export interface SyncError {
  resourceType: string;
  resourceId: string;
  errorCode: string;
  errorMessage: string;
  timestamp: string;
  retryable: boolean;
}

export interface SyncEvent {
  id: string;
  type: "create" | "update" | "delete";
  resourceType: string;
  resourceId: string;
  patientId?: string;
  data: any;
  timestamp: string;
  processed: boolean;
  syncJobId?: string;
}

export interface USCoreValidationResult {
  valid: boolean;
  resourceType: string;
  profile: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code: string;
}

// US Core profile definitions with required fields
const US_CORE_PROFILES: Record<string, {
  profile: string;
  requiredFields: string[];
  mustSupportFields: string[];
  codeSystemBindings: Record<string, string[]>;
}> = {
  Patient: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    requiredFields: ["identifier", "name", "gender"],
    mustSupportFields: ["birthDate", "address", "telecom", "communication", "race", "ethnicity"],
    codeSystemBindings: {
      gender: ["male", "female", "other", "unknown"]
    }
  },
  Observation: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
    requiredFields: ["status", "category", "code", "subject"],
    mustSupportFields: ["effectiveDateTime", "valueQuantity", "valueCodeableConcept", "interpretation"],
    codeSystemBindings: {
      status: ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"]
    }
  },
  Condition: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
    requiredFields: ["clinicalStatus", "category", "code", "subject"],
    mustSupportFields: ["verificationStatus", "severity", "onsetDateTime", "abatementDateTime", "recordedDate"],
    codeSystemBindings: {
      clinicalStatus: ["active", "recurrence", "relapse", "inactive", "remission", "resolved"]
    }
  },
  MedicationRequest: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    requiredFields: ["status", "intent", "medicationCodeableConcept", "subject", "authoredOn", "requester"],
    mustSupportFields: ["dosageInstruction", "dispenseRequest", "substitution"],
    codeSystemBindings: {
      status: ["active", "on-hold", "cancelled", "completed", "entered-in-error", "stopped", "draft", "unknown"],
      intent: ["proposal", "plan", "order", "original-order", "reflex-order", "filler-order", "instance-order", "option"]
    }
  },
  CarePlan: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
    requiredFields: ["status", "intent", "category", "subject"],
    mustSupportFields: ["title", "description", "period", "author", "goal", "activity"],
    codeSystemBindings: {
      status: ["draft", "active", "on-hold", "revoked", "completed", "entered-in-error", "unknown"],
      intent: ["proposal", "plan", "order", "option"]
    }
  },
  Goal: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
    requiredFields: ["lifecycleStatus", "description", "subject"],
    mustSupportFields: ["category", "priority", "startDate", "target", "statusDate", "statusReason"],
    codeSystemBindings: {
      lifecycleStatus: ["proposed", "planned", "accepted", "active", "on-hold", "completed", "cancelled", "entered-in-error", "rejected"]
    }
  },
  Procedure: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
    requiredFields: ["status", "code", "subject", "performedDateTime"],
    mustSupportFields: ["category", "performer", "location", "reasonCode", "outcome"],
    codeSystemBindings: {
      status: ["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"]
    }
  },
  Immunization: {
    profile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
    requiredFields: ["status", "vaccineCode", "patient", "occurrenceDateTime", "primarySource"],
    mustSupportFields: ["statusReason", "lotNumber", "expirationDate", "site", "route", "performer"],
    codeSystemBindings: {
      status: ["completed", "entered-in-error", "not-done"]
    }
  }
};

// Vital signs LOINC codes for automatic detection
const VITAL_SIGNS_LOINC: Record<string, string> = {
  "85354-9": "Blood Pressure",
  "8867-4": "Heart Rate",
  "8310-5": "Body Temperature",
  "9279-1": "Respiratory Rate",
  "2708-6": "Pulse Oximetry",
  "29463-7": "Body Weight",
  "8302-2": "Body Height",
  "39156-5": "BMI"
};

class FHIRSyncEngine {
  private configurations: Map<string, SyncConfiguration> = new Map();
  private syncJobs: Map<string, SyncJob> = new Map();
  private pendingEvents: SyncEvent[] = [];
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initializeDefaultConfigurations();
    this.initialized = true;
    console.log("[FHIRSyncEngine] Service initialized");
    console.log("[FHIRSyncEngine] US Core profiles: 8");
    console.log("[FHIRSyncEngine] Vital signs LOINC codes: 8");
  }

  private initializeDefaultConfigurations(): void {
    // Sample sync configuration for samplenstration
    const sampleConfig: SyncConfiguration = {
      id: "sync-config-1",
      name: "Primary EHR Sync",
      description: "Sync vitals and care plans with primary EHR system",
      sourceServerId: "local",
      targetServerId: "server-epic-1",
      syncDirection: "push",
      syncFrequency: "realtime",
      enabled: true,
      resourceTypes: [
        {
          resourceType: "Observation",
          enabled: true,
          syncOnCreate: true,
          syncOnUpdate: true,
          syncOnDelete: false,
          filterCriteria: { category: "vital-signs" },
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs"
        },
        {
          resourceType: "CarePlan",
          enabled: true,
          syncOnCreate: true,
          syncOnUpdate: true,
          syncOnDelete: false,
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"
        },
        {
          resourceType: "Goal",
          enabled: true,
          syncOnCreate: true,
          syncOnUpdate: true,
          syncOnDelete: false,
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal"
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.configurations.set(sampleConfig.id, sampleConfig);

    // Add a sample bidirectional config
    const bidirectionalConfig: SyncConfiguration = {
      id: "sync-config-2",
      name: "Health Network Exchange",
      description: "Bidirectional sync with regional health information exchange",
      sourceServerId: "local",
      targetServerId: "server-hie-1",
      syncDirection: "bidirectional",
      syncFrequency: "hourly",
      enabled: false,
      resourceTypes: [
        {
          resourceType: "Patient",
          enabled: true,
          syncOnCreate: false,
          syncOnUpdate: true,
          syncOnDelete: false,
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
        },
        {
          resourceType: "Condition",
          enabled: true,
          syncOnCreate: true,
          syncOnUpdate: true,
          syncOnDelete: false,
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"
        },
        {
          resourceType: "MedicationRequest",
          enabled: true,
          syncOnCreate: true,
          syncOnUpdate: true,
          syncOnDelete: false,
          validationProfile: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.configurations.set(bidirectionalConfig.id, bidirectionalConfig);
  }

  // Validate resource against US Core profile
  validateAgainstUSCore(resource: any, resourceType: string): USCoreValidationResult {
    const profile = US_CORE_PROFILES[resourceType];
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!profile) {
      return {
        valid: false,
        resourceType,
        profile: "unknown",
        errors: [{
          path: "resourceType",
          message: `No US Core profile defined for resource type: ${resourceType}`,
          code: "UNKNOWN_RESOURCE_TYPE"
        }],
        warnings: []
      };
    }

    // Validate required fields
    for (const field of profile.requiredFields) {
      const value = this.getNestedValue(resource, field);
      if (value === undefined || value === null || value === "") {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing or empty`,
          code: "REQUIRED_FIELD_MISSING"
        });
      }
    }

    // Check must-support fields (warnings only)
    for (const field of profile.mustSupportFields) {
      const value = this.getNestedValue(resource, field);
      if (value === undefined || value === null) {
        warnings.push({
          path: field,
          message: `Must-support field '${field}' is not present`,
          code: "MUST_SUPPORT_MISSING"
        });
      }
    }

    // Validate code system bindings
    for (const [field, allowedValues] of Object.entries(profile.codeSystemBindings)) {
      const value = this.getNestedValue(resource, field);
      if (value !== undefined && value !== null && !allowedValues.includes(value)) {
        errors.push({
          path: field,
          message: `Field '${field}' has invalid value '${value}'. Allowed values: ${allowedValues.join(", ")}`,
          code: "INVALID_CODE_VALUE"
        });
      }
    }

    // Validate meta.profile if present
    if (resource.meta?.profile && Array.isArray(resource.meta.profile)) {
      if (!resource.meta.profile.includes(profile.profile)) {
        warnings.push({
          path: "meta.profile",
          message: `Resource should declare US Core profile: ${profile.profile}`,
          code: "PROFILE_NOT_DECLARED"
        });
      }
    } else {
      warnings.push({
        path: "meta.profile",
        message: `Resource should include meta.profile with US Core profile URL`,
        code: "NO_PROFILE_DECLARED"
      });
    }

    // Log validation for HIPAA audit
    this.logAuditEvent("VALIDATE_US_CORE", {
      resourceType,
      resourceId: resource.id,
      profile: profile.profile,
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return {
      valid: errors.length === 0,
      resourceType,
      profile: profile.profile,
      errors,
      warnings
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => {
      if (current === undefined || current === null) return undefined;
      
      // Handle array notation like "name[0]"
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, index] = arrayMatch;
        return current[arrayKey]?.[parseInt(index)];
      }
      
      return current[key];
    }, obj);
  }

  // Configuration management
  getConfigurations(): SyncConfiguration[] {
    return Array.from(this.configurations.values());
  }

  getConfiguration(id: string): SyncConfiguration | undefined {
    return this.configurations.get(id);
  }

  createConfiguration(config: Omit<SyncConfiguration, "id" | "createdAt" | "updatedAt">): SyncConfiguration {
    const newConfig: SyncConfiguration = {
      ...config,
      id: `sync-config-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.configurations.set(newConfig.id, newConfig);

    // Set up sync timer if enabled and not manual
    if (newConfig.enabled && newConfig.syncFrequency !== "manual") {
      this.setupSyncTimer(newConfig);
    }

    this.logAuditEvent("CREATE_SYNC_CONFIG", {
      configId: newConfig.id,
      name: newConfig.name,
      targetServer: newConfig.targetServerId,
      direction: newConfig.syncDirection
    });

    return newConfig;
  }

  updateConfiguration(id: string, updates: Partial<SyncConfiguration>): SyncConfiguration | null {
    const existing = this.configurations.get(id);
    if (!existing) return null;

    const updated: SyncConfiguration = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    this.configurations.set(id, updated);

    // Update sync timer
    this.clearSyncTimer(id);
    if (updated.enabled && updated.syncFrequency !== "manual") {
      this.setupSyncTimer(updated);
    }

    this.logAuditEvent("UPDATE_SYNC_CONFIG", {
      configId: id,
      changes: Object.keys(updates)
    });

    return updated;
  }

  deleteConfiguration(id: string): boolean {
    const config = this.configurations.get(id);
    if (!config) return false;

    this.clearSyncTimer(id);
    this.configurations.delete(id);

    this.logAuditEvent("DELETE_SYNC_CONFIG", {
      configId: id,
      name: config.name
    });

    return true;
  }

  private setupSyncTimer(config: SyncConfiguration): void {
    const intervals: Record<string, number> = {
      realtime: 0, // Handled by event queue
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000
    };

    const interval = intervals[config.syncFrequency];
    if (interval > 0) {
      const timer = setInterval(() => {
        this.executeSyncJob(config.id, config.syncDirection === "bidirectional" ? "push" : config.syncDirection);
      }, interval);
      this.syncTimers.set(config.id, timer);
    }
  }

  private clearSyncTimer(configId: string): void {
    const timer = this.syncTimers.get(configId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(configId);
    }
  }

  // Sync job execution
  async executeSyncJob(configId: string, direction: "push" | "pull"): Promise<SyncJob> {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`Sync configuration not found: ${configId}`);
    }

    const job: SyncJob = {
      id: `sync-job-${randomUUID().slice(0, 8)}`,
      configurationId: configId,
      status: "running",
      direction,
      resourceType: "multiple",
      startedAt: new Date().toISOString(),
      recordsProcessed: 0,
      recordsSucceeded: 0,
      recordsFailed: 0,
      errors: [],
      auditLogId: `audit-${randomUUID().slice(0, 8)}`
    };

    this.syncJobs.set(job.id, job);

    this.logAuditEvent("START_SYNC_JOB", {
      jobId: job.id,
      configId,
      direction,
      targetServer: config.targetServerId
    });

    try {
      // Process each enabled resource type
      for (const resourceConfig of config.resourceTypes) {
        if (!resourceConfig.enabled) continue;

        if (direction === "push") {
          await this.pushResourceType(job, config, resourceConfig);
        } else {
          await this.pullResourceType(job, config, resourceConfig);
        }
      }

      job.status = job.recordsFailed > 0 ? "completed" : "completed";
      job.completedAt = new Date().toISOString();

      // Update last sync time on configuration
      config.lastSyncAt = new Date().toISOString();
      this.configurations.set(configId, config);

    } catch (error: any) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      job.errors.push({
        resourceType: "system",
        resourceId: "n/a",
        errorCode: "SYNC_FAILED",
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
        retryable: true
      });
    }

    this.syncJobs.set(job.id, job);

    this.logAuditEvent("COMPLETE_SYNC_JOB", {
      jobId: job.id,
      status: job.status,
      recordsProcessed: job.recordsProcessed,
      recordsSucceeded: job.recordsSucceeded,
      recordsFailed: job.recordsFailed
    });

    return job;
  }

  private async pushResourceType(
    job: SyncJob,
    config: SyncConfiguration,
    resourceConfig: SyncResourceConfig
  ): Promise<void> {
    // In production, this would query local database for pending changes
    // For sample, we simulate processing some records
    const simulatedRecords = this.getSimulatedLocalRecords(resourceConfig.resourceType);

    for (const record of simulatedRecords) {
      job.recordsProcessed++;

      // Validate against US Core
      const validation = this.validateAgainstUSCore(record, resourceConfig.resourceType);
      
      if (!validation.valid) {
        job.recordsFailed++;
        job.errors.push({
          resourceType: resourceConfig.resourceType,
          resourceId: record.id || "unknown",
          errorCode: "VALIDATION_FAILED",
          errorMessage: validation.errors.map(e => e.message).join("; "),
          timestamp: new Date().toISOString(),
          retryable: false
        });
        continue;
      }

      // Simulate push to external server
      try {
        await this.simulatePushToServer(config.targetServerId, record);
        job.recordsSucceeded++;
      } catch (error: any) {
        job.recordsFailed++;
        job.errors.push({
          resourceType: resourceConfig.resourceType,
          resourceId: record.id || "unknown",
          errorCode: "PUSH_FAILED",
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
          retryable: true
        });
      }
    }
  }

  private async pullResourceType(
    job: SyncJob,
    config: SyncConfiguration,
    resourceConfig: SyncResourceConfig
  ): Promise<void> {
    // In production, this would query external FHIR server
    // For sample, we simulate receiving some records
    const simulatedRecords = this.getSimulatedExternalRecords(resourceConfig.resourceType);

    for (const record of simulatedRecords) {
      job.recordsProcessed++;

      // Validate against US Core
      const validation = this.validateAgainstUSCore(record, resourceConfig.resourceType);
      
      if (!validation.valid) {
        job.recordsFailed++;
        job.errors.push({
          resourceType: resourceConfig.resourceType,
          resourceId: record.id || "unknown",
          errorCode: "VALIDATION_FAILED",
          errorMessage: validation.errors.map(e => e.message).join("; "),
          timestamp: new Date().toISOString(),
          retryable: false
        });
        continue;
      }

      // Simulate storing locally
      try {
        await this.simulateStoreLocally(record);
        job.recordsSucceeded++;
      } catch (error: any) {
        job.recordsFailed++;
        job.errors.push({
          resourceType: resourceConfig.resourceType,
          resourceId: record.id || "unknown",
          errorCode: "STORE_FAILED",
          errorMessage: error.message,
          timestamp: new Date().toISOString(),
          retryable: true
        });
      }
    }
  }

  private getSimulatedLocalRecords(resourceType: string): any[] {
    // Simulated local records
    const records: Record<string, any[]> = {
      Observation: [
        {
          id: "obs-vital-1",
          resourceType: "Observation",
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
          code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart Rate" }] },
          subject: { reference: "Patient/patient-1" },
          effectiveDateTime: new Date().toISOString(),
          valueQuantity: { value: 72, unit: "beats/minute", system: "http://unitsofmeasure.org", code: "/min" }
        }
      ],
      CarePlan: [
        {
          id: "careplan-1",
          resourceType: "CarePlan",
          status: "active",
          intent: "plan",
          category: [{ coding: [{ system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category", code: "assess-plan" }] }],
          subject: { reference: "Patient/patient-1" },
          title: "Diabetes Management Plan",
          period: { start: "2024-01-01", end: "2024-12-31" }
        }
      ],
      Goal: [
        {
          id: "goal-1",
          resourceType: "Goal",
          lifecycleStatus: "active",
          description: { text: "Maintain HbA1c below 7%" },
          subject: { reference: "Patient/patient-1" },
          target: [{ measure: { coding: [{ system: "http://loinc.org", code: "4548-4" }] }, detailQuantity: { value: 7, unit: "%" } }]
        }
      ]
    };

    return records[resourceType] || [];
  }

  private getSimulatedExternalRecords(resourceType: string): any[] {
    // Simulated external records
    return [];
  }

  private async simulatePushToServer(serverId: string, resource: any): Promise<void> {
    // In production, this would make actual FHIR API calls
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`[FHIRSyncEngine] Pushed ${resource.resourceType}/${resource.id} to ${serverId}`);
  }

  private async simulateStoreLocally(resource: any): Promise<void> {
    // In production, this would store in local database
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`[FHIRSyncEngine] Stored ${resource.resourceType}/${resource.id} locally`);
  }

  // Event queue for realtime sync
  queueSyncEvent(event: Omit<SyncEvent, "id" | "timestamp" | "processed">): void {
    const syncEvent: SyncEvent = {
      ...event,
      id: `event-${randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      processed: false
    };

    this.pendingEvents.push(syncEvent);

    // Process realtime events immediately
    this.processRealtimeEvents();
  }

  private async processRealtimeEvents(): Promise<void> {
    const realtimeConfigs = Array.from(this.configurations.values())
      .filter(c => c.enabled && c.syncFrequency === "realtime");

    for (const event of this.pendingEvents.filter(e => !e.processed)) {
      for (const config of realtimeConfigs) {
        const resourceConfig = config.resourceTypes.find(
          r => r.resourceType === event.resourceType && r.enabled
        );

        if (!resourceConfig) continue;

        const shouldSync = (
          (event.type === "create" && resourceConfig.syncOnCreate) ||
          (event.type === "update" && resourceConfig.syncOnUpdate) ||
          (event.type === "delete" && resourceConfig.syncOnDelete)
        );

        if (shouldSync) {
          // Validate before syncing
          const validation = this.validateAgainstUSCore(event.data, event.resourceType);
          
          if (validation.valid) {
            try {
              await this.simulatePushToServer(config.targetServerId, event.data);
              
              this.logAuditEvent("REALTIME_SYNC", {
                eventId: event.id,
                configId: config.id,
                resourceType: event.resourceType,
                resourceId: event.resourceId,
                eventType: event.type
              });
            } catch (error: any) {
              console.error(`[FHIRSyncEngine] Realtime sync failed: ${error.message}`);
            }
          } else {
            console.warn(`[FHIRSyncEngine] Skipped sync due to validation errors: ${validation.errors.map(e => e.message).join(", ")}`);
          }
        }
      }

      event.processed = true;
    }

    // Clean up processed events
    this.pendingEvents = this.pendingEvents.filter(e => !e.processed);
  }

  // Sync job management
  getSyncJobs(configId?: string): SyncJob[] {
    const jobs = Array.from(this.syncJobs.values());
    if (configId) {
      return jobs.filter(j => j.configurationId === configId);
    }
    return jobs;
  }

  getSyncJob(jobId: string): SyncJob | undefined {
    return this.syncJobs.get(jobId);
  }

  async cancelSyncJob(jobId: string): Promise<boolean> {
    const job = this.syncJobs.get(jobId);
    if (!job || job.status !== "running") return false;

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    this.syncJobs.set(jobId, job);

    this.logAuditEvent("CANCEL_SYNC_JOB", { jobId });

    return true;
  }

  // Get sync statistics
  getSyncStatistics(): {
    totalConfigurations: number;
    enabledConfigurations: number;
    totalJobsRun: number;
    totalRecordsSynced: number;
    lastSyncTime?: string;
    syncByResourceType: Record<string, number>;
  } {
    const jobs = Array.from(this.syncJobs.values());
    const configs = Array.from(this.configurations.values());

    const syncByResourceType: Record<string, number> = {};
    let totalRecordsSynced = 0;
    let lastSyncTime: string | undefined;

    for (const job of jobs) {
      if (job.status === "completed") {
        totalRecordsSynced += job.recordsSucceeded;
        if (!lastSyncTime || job.completedAt! > lastSyncTime) {
          lastSyncTime = job.completedAt;
        }
      }
    }

    return {
      totalConfigurations: configs.length,
      enabledConfigurations: configs.filter(c => c.enabled).length,
      totalJobsRun: jobs.length,
      totalRecordsSynced,
      lastSyncTime,
      syncByResourceType
    };
  }

  // Get supported profiles
  getSupportedProfiles(): { resourceType: string; profile: string; requiredFields: string[] }[] {
    return Object.entries(US_CORE_PROFILES).map(([resourceType, profile]) => ({
      resourceType,
      profile: profile.profile,
      requiredFields: profile.requiredFields
    }));
  }

  // HIPAA audit logging
  private logAuditEvent(action: string, details: Record<string, any>): void {
    const hashedDetails = { ...details };
    
    // Hash any patient identifiers for HIPAA compliance
    if (hashedDetails.patientId) {
      hashedDetails.patientIdHash = createHash("sha256").update(hashedDetails.patientId).digest("hex").slice(0, 16);
      delete hashedDetails.patientId;
    }

    console.log(`[FHIRSyncEngine][AUDIT] ${action}:`, JSON.stringify(hashedDetails));
  }
}

export const fhirSyncEngine = new FHIRSyncEngine();
