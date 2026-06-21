import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";
import { automatedSyncScheduler, SyncSchedule, SyncHistoryEntry } from "./automated-sync-scheduler";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "retrying" | "dead";
export type JobType = "health_data_sync" | "fhir_import" | "document_ingestion" | "medication_sync" | "lab_results_sync" | "wearable_sync";
export type JobPriority = "critical" | "high" | "normal" | "low";

export interface BackgroundJob {
  id: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  payload: JobPayload;
  result?: JobResult;
  error?: JobError;
  retryConfig: RetryConfig;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
  metadata: JobMetadata;
}

export interface JobPayload {
  patientId: string;
  userId: string;
  sourceId?: string;
  sourceName?: string;
  sourceType?: string;
  scheduleId?: string;
  customData?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  resourceBreakdown: { type: string; count: number }[];
  warnings: string[];
  syncHistoryId?: string;
}

export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
  category: "network" | "auth" | "validation" | "rate_limit" | "server" | "unknown";
  details?: Record<string, unknown>;
  stack?: string;
  occurredAt: string;
}

export interface RetryConfig {
  strategy: "exponential" | "linear" | "fixed";
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
  backoffMultiplier: number;
}

export interface JobMetadata {
  correlationId?: string;
  triggeredBy: "schedule" | "manual" | "webhook" | "system";
  sourceIp?: string;
  userAgent?: string;
  tags: string[];
}

export interface JobQueue {
  id: string;
  name: string;
  concurrency: number;
  rateLimitPerMinute: number;
  activeJobs: number;
  pendingJobs: number;
  isPaused: boolean;
  lastProcessedAt?: string;
}

export interface JobStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  deadJobs: number;
  retryingJobs: number;
  averageProcessingTimeMs: number;
  successRate: number;
  jobsByType: { type: JobType; count: number }[];
  jobsByHour: { hour: string; completed: number; failed: number }[];
  recentErrors: JobError[];
  throughputPerMinute: number;
}

export interface DeadLetterEntry {
  id: string;
  job: BackgroundJob;
  failureReason: string;
  lastError: JobError;
  movedAt: string;
  canRetry: boolean;
}

const jobs = new Map<string, BackgroundJob>();
const deadLetterQueue = new Map<string, DeadLetterEntry>();
const jobQueues = new Map<string, JobQueue>();
const processingIntervals = new Map<string, NodeJS.Timeout>();

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  strategy: "exponential",
  baseDelayMs: 1000,
  maxDelayMs: 300000,
  jitterMs: 500,
  backoffMultiplier: 2,
};

const ERROR_CATEGORIES: Record<string, { retryable: boolean; category: JobError["category"] }> = {
  ECONNREFUSED: { retryable: true, category: "network" },
  ETIMEDOUT: { retryable: true, category: "network" },
  ENOTFOUND: { retryable: false, category: "network" },
  "401": { retryable: false, category: "auth" },
  "403": { retryable: false, category: "auth" },
  "429": { retryable: true, category: "rate_limit" },
  "500": { retryable: true, category: "server" },
  "502": { retryable: true, category: "server" },
  "503": { retryable: true, category: "server" },
  "504": { retryable: true, category: "server" },
};

function initializeQueues(): void {
  const defaultQueues: Omit<JobQueue, "activeJobs" | "pendingJobs">[] = [
    { id: "health_sync", name: "Health Data Sync", concurrency: 3, rateLimitPerMinute: 60, isPaused: false },
    { id: "document_ingestion", name: "Document Ingestion", concurrency: 2, rateLimitPerMinute: 30, isPaused: false },
    { id: "critical_sync", name: "Critical Sync", concurrency: 5, rateLimitPerMinute: 100, isPaused: false },
  ];

  for (const queue of defaultQueues) {
    jobQueues.set(queue.id, { ...queue, activeJobs: 0, pendingJobs: 0 });
  }
}

initializeQueues();

function generateJobId(): string {
  return `job-${Date.now()}-${randomUUID().substring(0, 8)}`;
}

function calculateRetryDelay(config: RetryConfig, retryCount: number): number {
  let delay: number;

  switch (config.strategy) {
    case "exponential":
      delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount);
      break;
    case "linear":
      delay = config.baseDelayMs * (retryCount + 1);
      break;
    case "fixed":
    default:
      delay = config.baseDelayMs;
  }

  delay = Math.min(delay, config.maxDelayMs);
  const jitter = Math.random() * config.jitterMs * 2 - config.jitterMs;
  return Math.max(0, delay + jitter);
}

function categorizeError(error: Error | string): { retryable: boolean; category: JobError["category"]; code: string } {
  const errorStr = typeof error === "string" ? error : error.message;
  
  for (const [code, config] of Object.entries(ERROR_CATEGORIES)) {
    if (errorStr.includes(code)) {
      return { ...config, code };
    }
  }

  return { retryable: true, category: "unknown", code: "UNKNOWN_ERROR" };
}

export class BackgroundJobService {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log("[BackgroundJobService] Service initialized");
    this.startProcessing();
    this.seedSampleJobs();
  }

  private seedSampleJobs(): void {
    const sampleJobs: Partial<BackgroundJob>[] = [
      {
        type: "health_data_sync",
        priority: "high",
        status: "completed",
        payload: { patientId: "patient-1", userId: "user-1", sourceId: "fastenhealth", sourceName: "Fasten Health" },
        result: { success: true, recordsProcessed: 45, recordsImported: 40, recordsUpdated: 5, recordsSkipped: 0, resourceBreakdown: [{ type: "Observation", count: 25 }, { type: "Condition", count: 10 }], warnings: [] },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3500000).toISOString(),
        processingTimeMs: 4500,
      },
      {
        type: "lab_results_sync",
        priority: "normal",
        status: "completed",
        payload: { patientId: "patient-1", userId: "user-1", sourceId: "quest_diagnostics", sourceName: "Quest Diagnostics" },
        result: { success: true, recordsProcessed: 12, recordsImported: 12, recordsUpdated: 0, recordsSkipped: 0, resourceBreakdown: [{ type: "Observation", count: 12 }], warnings: [] },
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        completedAt: new Date(Date.now() - 7100000).toISOString(),
        processingTimeMs: 2300,
      },
      {
        type: "medication_sync",
        priority: "high",
        status: "failed",
        payload: { patientId: "patient-1", userId: "user-1", sourceId: "cvs_pharmacy", sourceName: "CVS Pharmacy" },
        error: { code: "ETIMEDOUT", message: "Connection timeout while fetching medication data", retryable: true, category: "network", occurredAt: new Date(Date.now() - 1800000).toISOString() },
        retryCount: 2,
        createdAt: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        type: "wearable_sync",
        priority: "low",
        status: "pending",
        payload: { patientId: "patient-1", userId: "user-1", sourceId: "fitbit", sourceName: "Fitbit" },
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
    ];

    for (const sample of sampleJobs) {
      const job = this.createJobObject(sample);
      jobs.set(job.id, job);
    }
  }

  private createJobObject(partial: Partial<BackgroundJob>): BackgroundJob {
    return {
      id: partial.id || generateJobId(),
      type: partial.type || "health_data_sync",
      priority: partial.priority || "normal",
      status: partial.status || "pending",
      payload: partial.payload || { patientId: "", userId: "" },
      result: partial.result,
      error: partial.error,
      retryConfig: partial.retryConfig || DEFAULT_RETRY_CONFIG,
      retryCount: partial.retryCount || 0,
      maxRetries: partial.maxRetries || 5,
      nextRetryAt: partial.nextRetryAt,
      createdAt: partial.createdAt || new Date().toISOString(),
      startedAt: partial.startedAt,
      completedAt: partial.completedAt,
      processingTimeMs: partial.processingTimeMs,
      metadata: partial.metadata || { triggeredBy: "manual", tags: [] },
    };
  }

  async createJob(params: {
    type: JobType;
    payload: JobPayload;
    priority?: JobPriority;
    retryConfig?: Partial<RetryConfig>;
    maxRetries?: number;
    metadata?: Partial<JobMetadata>;
  }): Promise<BackgroundJob> {
    const job: BackgroundJob = {
      id: generateJobId(),
      type: params.type,
      priority: params.priority || "normal",
      status: "pending",
      payload: params.payload,
      retryConfig: { ...DEFAULT_RETRY_CONFIG, ...params.retryConfig },
      retryCount: 0,
      maxRetries: params.maxRetries ?? 5,
      createdAt: new Date().toISOString(),
      metadata: {
        triggeredBy: params.metadata?.triggeredBy || "manual",
        correlationId: params.metadata?.correlationId,
        sourceIp: params.metadata?.sourceIp,
        userAgent: params.metadata?.userAgent,
        tags: params.metadata?.tags || [],
      },
    };

    jobs.set(job.id, job);

    await logPhiAccess({
      userId: params.payload.userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: job.id,
      patientId: params.payload.patientId,
      details: `Created background job: ${params.type}`,
    });

    return job;
  }

  async getJob(jobId: string): Promise<BackgroundJob | undefined> {
    return jobs.get(jobId);
  }

  async getJobs(filters?: {
    status?: JobStatus;
    type?: JobType;
    patientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: BackgroundJob[]; total: number }> {
    let result = Array.from(jobs.values());

    if (filters?.status) {
      result = result.filter(j => j.status === filters.status);
    }
    if (filters?.type) {
      result = result.filter(j => j.type === filters.type);
    }
    if (filters?.patientId) {
      result = result.filter(j => j.payload.patientId === filters.patientId);
    }

    result.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const total = result.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    result = result.slice(offset, offset + limit);

    return { jobs: result, total };
  }

  async cancelJob(jobId: string, userId: string): Promise<boolean> {
    const job = jobs.get(jobId);
    if (!job || job.status === "running" || job.status === "completed") {
      return false;
    }

    job.status = "dead";
    job.completedAt = new Date().toISOString();
    job.error = {
      code: "JOB_CANCELLED",
      message: "Job was cancelled by user",
      retryable: false,
      category: "unknown",
      occurredAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: jobId,
      details: "Job cancelled by user",
    });

    return true;
  }

  async retryJob(jobId: string, userId: string): Promise<BackgroundJob | null> {
    const job = jobs.get(jobId);
    if (!job || (job.status !== "failed" && job.status !== "dead")) {
      return null;
    }

    job.status = "pending";
    job.retryCount = 0;
    job.error = undefined;
    job.nextRetryAt = undefined;
    jobs.set(jobId, job);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: jobId,
      details: "Job manually retried",
    });

    return job;
  }

  async retryFromDeadLetter(entryId: string, userId: string): Promise<BackgroundJob | null> {
    const entry = deadLetterQueue.get(entryId);
    if (!entry || !entry.canRetry) {
      return null;
    }

    const job = entry.job;
    job.status = "pending";
    job.retryCount = 0;
    job.error = undefined;
    job.maxRetries = 3;
    jobs.set(job.id, job);
    deadLetterQueue.delete(entryId);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: job.id,
      details: "Job retried from dead letter queue",
    });

    return job;
  }

  getDeadLetterQueue(): DeadLetterEntry[] {
    return Array.from(deadLetterQueue.values())
      .sort((a, b) => new Date(b.movedAt).getTime() - new Date(a.movedAt).getTime());
  }

  async purgeDeadLetterQueue(userId: string): Promise<number> {
    const count = deadLetterQueue.size;
    deadLetterQueue.clear();

    await logPhiAccess({
      userId,
      action: "delete",
      resourceType: "DeadLetterQueue",
      details: `Purged ${count} entries from dead letter queue`,
    });

    return count;
  }

  getStats(): JobStats {
    const allJobs = Array.from(jobs.values());
    const completedJobs = allJobs.filter(j => j.status === "completed");
    const failedJobs = allJobs.filter(j => j.status === "failed");
    
    const avgProcessingTime = completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => sum + (j.processingTimeMs || 0), 0) / completedJobs.length
      : 0;

    const successRate = (completedJobs.length + failedJobs.length) > 0
      ? (completedJobs.length / (completedJobs.length + failedJobs.length)) * 100
      : 100;

    const jobsByTypeMap = new Map<JobType, number>();
    for (const job of allJobs) {
      jobsByTypeMap.set(job.type, (jobsByTypeMap.get(job.type) || 0) + 1);
    }

    const jobsByHourMap = new Map<string, { completed: number; failed: number }>();
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 3600000);
      const hourStr = hour.toISOString().substring(0, 13);
      jobsByHourMap.set(hourStr, { completed: 0, failed: 0 });
    }

    for (const job of allJobs) {
      if (job.completedAt) {
        const hourStr = job.completedAt.substring(0, 13);
        const entry = jobsByHourMap.get(hourStr);
        if (entry) {
          if (job.status === "completed") entry.completed++;
          else if (job.status === "failed") entry.failed++;
        }
      }
    }

    const recentJobs = allJobs
      .filter(j => j.createdAt > new Date(Date.now() - 60000).toISOString())
      .length;

    return {
      totalJobs: allJobs.length,
      pendingJobs: allJobs.filter(j => j.status === "pending").length,
      runningJobs: allJobs.filter(j => j.status === "running").length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      deadJobs: allJobs.filter(j => j.status === "dead").length,
      retryingJobs: allJobs.filter(j => j.status === "retrying").length,
      averageProcessingTimeMs: Math.round(avgProcessingTime),
      successRate: Math.round(successRate * 100) / 100,
      jobsByType: Array.from(jobsByTypeMap.entries()).map(([type, count]) => ({ type, count })),
      jobsByHour: Array.from(jobsByHourMap.entries()).map(([hour, data]) => ({ hour, ...data })),
      recentErrors: failedJobs
        .filter(j => j.error)
        .slice(-10)
        .map(j => j.error!),
      throughputPerMinute: recentJobs,
    };
  }

  getQueues(): JobQueue[] {
    return Array.from(jobQueues.values());
  }

  async pauseQueue(queueId: string): Promise<boolean> {
    const queue = jobQueues.get(queueId);
    if (!queue) return false;
    queue.isPaused = true;
    jobQueues.set(queueId, queue);
    return true;
  }

  async resumeQueue(queueId: string): Promise<boolean> {
    const queue = jobQueues.get(queueId);
    if (!queue) return false;
    queue.isPaused = false;
    jobQueues.set(queueId, queue);
    return true;
  }

  private startProcessing(): void {
    if (this.processInterval) return;

    this.processInterval = setInterval(() => {
      this.processNextJobs();
    }, 5000);

    console.log("[BackgroundJobService] Job processing started");
  }

  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log("[BackgroundJobService] Job processing stopped");
    }
  }

  private async processNextJobs(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = Array.from(jobs.values())
        .filter(j => j.status === "pending" || (j.status === "retrying" && j.nextRetryAt && new Date(j.nextRetryAt) <= new Date()))
        .sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 3);

      for (const job of pendingJobs) {
        await this.processJob(job);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: BackgroundJob): Promise<void> {
    const startTime = Date.now();
    job.status = "running";
    job.startedAt = new Date().toISOString();
    jobs.set(job.id, job);

    await logPhiAccess({
      userId: job.payload.userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: job.id,
      details: `Job status changed: pending → running`,
    });

    try {
      const result = await this.executeJob(job);
      
      job.status = "completed";
      job.result = result;
      job.completedAt = new Date().toISOString();
      job.processingTimeMs = Date.now() - startTime;

      await logPhiAccess({
        userId: job.payload.userId,
        action: "write",
        resourceType: "BackgroundJob",
        resourceId: job.id,
        details: `Job status changed: running → completed (${result.recordsProcessed} records)`,
      });

      await logPhiAccess({
        userId: job.payload.userId,
        action: "read",
        resourceType: "HealthData",
        patientId: job.payload.patientId,
        details: `Job completed: ${result.recordsProcessed} records processed`,
      });

    } catch (error) {
      const errorInfo = categorizeError(error as Error);
      
      job.error = {
        code: errorInfo.code,
        message: (error as Error).message || "Unknown error",
        retryable: errorInfo.retryable,
        category: errorInfo.category,
        stack: (error as Error).stack,
        occurredAt: new Date().toISOString(),
      };

      if (errorInfo.retryable && job.retryCount < job.maxRetries) {
        job.retryCount++;
        job.status = "retrying";
        const delay = calculateRetryDelay(job.retryConfig, job.retryCount);
        job.nextRetryAt = new Date(Date.now() + delay).toISOString();
        
        await logPhiAccess({
          userId: job.payload.userId,
          action: "write",
          resourceType: "BackgroundJob",
          resourceId: job.id,
          details: `Job status changed: running → retrying (attempt ${job.retryCount}/${job.maxRetries})`,
        });
        
        console.log(`[BackgroundJobService] Job ${job.id} scheduled for retry #${job.retryCount} in ${delay}ms`);
      } else {
        job.status = "failed";
        job.completedAt = new Date().toISOString();
        job.processingTimeMs = Date.now() - startTime;

        await logPhiAccess({
          userId: job.payload.userId,
          action: "write",
          resourceType: "BackgroundJob",
          resourceId: job.id,
          details: `Job status changed: running → failed (${job.error?.code || "unknown"})`,
        });

        if (job.retryCount >= job.maxRetries) {
          this.moveToDeadLetter(job, "Max retries exceeded");
        }
      }
    }

    jobs.set(job.id, job);
  }

  private async executeJob(job: BackgroundJob): Promise<JobResult> {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    if (Math.random() < 0.1) {
      throw new Error("ETIMEDOUT: Connection timed out");
    }

    const recordsProcessed = Math.floor(Math.random() * 50) + 10;
    const recordsImported = Math.floor(recordsProcessed * 0.8);
    const recordsUpdated = Math.floor(recordsProcessed * 0.15);
    const recordsSkipped = recordsProcessed - recordsImported - recordsUpdated;

    return {
      success: true,
      recordsProcessed,
      recordsImported,
      recordsUpdated,
      recordsSkipped,
      resourceBreakdown: [
        { type: "Observation", count: Math.floor(recordsImported * 0.4) },
        { type: "Condition", count: Math.floor(recordsImported * 0.2) },
        { type: "MedicationRequest", count: Math.floor(recordsImported * 0.2) },
        { type: "Encounter", count: Math.floor(recordsImported * 0.1) },
        { type: "Procedure", count: Math.floor(recordsImported * 0.1) },
      ],
      warnings: [],
    };
  }

  private moveToDeadLetter(job: BackgroundJob, reason: string): void {
    const entry: DeadLetterEntry = {
      id: `dlq-${Date.now()}-${randomUUID().substring(0, 8)}`,
      job: { ...job },
      failureReason: reason,
      lastError: job.error!,
      movedAt: new Date().toISOString(),
      canRetry: job.error?.category !== "auth",
    };

    deadLetterQueue.set(entry.id, entry);
    job.status = "dead";
    jobs.set(job.id, job);

    logPhiAccess({
      userId: job.payload.userId,
      action: "write",
      resourceType: "BackgroundJob",
      resourceId: job.id,
      details: `Job status changed: failed → dead (moved to dead letter queue: ${reason})`,
    });

    console.log(`[BackgroundJobService] Job ${job.id} moved to dead letter queue: ${reason}`);
  }

  async triggerScheduledSync(scheduleId: string, userId: string): Promise<BackgroundJob> {
    const schedule = await automatedSyncScheduler.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    return this.createJob({
      type: this.mapSourceTypeToJobType(schedule.sourceType),
      payload: {
        patientId: schedule.patientId,
        userId,
        sourceId: schedule.sourceId,
        sourceName: schedule.sourceName,
        sourceType: schedule.sourceType,
        scheduleId,
      },
      priority: "high",
      metadata: {
        triggeredBy: "schedule",
        tags: [schedule.sourceType, schedule.sourceId],
      },
    });
  }

  private mapSourceTypeToJobType(sourceType: string): JobType {
    const mapping: Record<string, JobType> = {
      ehr: "health_data_sync",
      lab: "lab_results_sync",
      pharmacy: "medication_sync",
      wearable: "wearable_sync",
      health_app: "health_data_sync",
    };
    return mapping[sourceType] || "health_data_sync";
  }
}

export const backgroundJobService = new BackgroundJobService();
