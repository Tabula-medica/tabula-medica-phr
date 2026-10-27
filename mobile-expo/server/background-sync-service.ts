import crypto from "crypto";
import { logger } from "./utils/logger";

export interface SyncJob {
  id: string;
  userId: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  lastRunAt: Date | null;
  nextRunAt: Date;
  intervalMinutes: number;
  priority: number;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  jobId: string;
  sourceId: string;
  recordsFetched: number;
  recordsUpdated: number;
  recordsNew: number;
  duration: number;
  success: boolean;
  errors: string[];
}

export interface SyncSchedule {
  [sourceType: string]: number;
}

export interface SyncConfig {
  maxConcurrentJobs: number;
  defaultInterval: number;
  retryBackoff: number;
  enabledSourceTypes: string[];
}

export interface SyncStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  recordsSynced: number;
  lastRunAt: Date | null;
}

const DEFAULT_SYNC_SCHEDULE: SyncSchedule = {
  fhir: 60,
  ehr: 120,
  lab: 30,
  pharmacy: 240,
  insurance: 720,
  wearable: 15,
  idme: 1440,
  imaging: 360,
  fasten: 180,
};

class BackgroundSyncService {
  private jobs: Map<string, SyncJob> = new Map();
  private syncHistory: SyncResult[] = [];
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private running: boolean = false;
  private activeJobs: number = 0;
  private config: SyncConfig;
  private schedule: SyncSchedule;
  private totalRecordsSynced: number = 0;
  private lastRunAt: Date | null = null;

  constructor(config?: Partial<SyncConfig>, schedule?: SyncSchedule) {
    this.config = {
      maxConcurrentJobs: config?.maxConcurrentJobs ?? 3,
      defaultInterval: config?.defaultInterval ?? 120,
      retryBackoff: config?.retryBackoff ?? 5,
      enabledSourceTypes: config?.enabledSourceTypes ?? [
        "fhir", "ehr", "lab", "pharmacy", "insurance", "wearable", "idme", "imaging", "fasten",
      ],
    };
    this.schedule = { ...DEFAULT_SYNC_SCHEDULE, ...schedule };
  }

  registerSource(
    userId: string,
    sourceId: string,
    sourceName: string,
    sourceType: string,
    intervalMinutes?: number
  ): SyncJob {
    const interval =
      intervalMinutes ??
      this.schedule[sourceType] ??
      this.config.defaultInterval;

    const job: SyncJob = {
      id: crypto.randomUUID(),
      userId,
      sourceId,
      sourceName,
      sourceType,
      status: "pending",
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + interval * 60 * 1000),
      intervalMinutes: interval,
      priority: this.getPriority(sourceType),
      retryCount: 0,
      maxRetries: 3,
      errorMessage: null,
      metadata: {},
    };

    this.jobs.set(job.id, job);
    logger.info(
      `[BackgroundSync] Registered source "${sourceName}" (${sourceType}) for user ${userId}, interval: ${interval}min`
    );
    return job;
  }

  unregisterSource(userId: string, sourceId: string): boolean {
    const job = this.findJob(userId, sourceId);
    if (!job) return false;

    this.jobs.delete(job.id);
    logger.info(
      `[BackgroundSync] Unregistered source "${job.sourceName}" for user ${userId}`
    );
    return true;
  }

  pauseSource(userId: string, sourceId: string): boolean {
    const job = this.findJob(userId, sourceId);
    if (!job || job.status === "paused") return false;

    job.status = "paused";
    logger.info(
      `[BackgroundSync] Paused source "${job.sourceName}" for user ${userId}`
    );
    return true;
  }

  resumeSource(userId: string, sourceId: string): boolean {
    const job = this.findJob(userId, sourceId);
    if (!job || job.status !== "paused") return false;

    job.status = "pending";
    job.nextRunAt = new Date(Date.now() + job.intervalMinutes * 60 * 1000);
    job.retryCount = 0;
    job.errorMessage = null;
    logger.info(
      `[BackgroundSync] Resumed source "${job.sourceName}" for user ${userId}`
    );
    return true;
  }

  async triggerSync(userId: string, sourceId?: string): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    const jobsToSync = sourceId
      ? [this.findJob(userId, sourceId)].filter(Boolean) as SyncJob[]
      : Array.from(this.jobs.values()).filter((j) => j.userId === userId && j.status !== "paused");

    for (const job of jobsToSync) {
      const result = await this.executeSync(job);
      results.push(result);
    }

    return results;
  }

  getJobs(userId?: string): SyncJob[] {
    const allJobs = Array.from(this.jobs.values());
    if (userId) {
      return allJobs.filter((j) => j.userId === userId);
    }
    return allJobs;
  }

  getJobStatus(jobId: string): SyncJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  getSyncHistory(userId: string, sourceId?: string, limit?: number): SyncResult[] {
    let history = this.syncHistory.filter((r) => {
      const job = this.jobs.get(r.jobId);
      if (!job || job.userId !== userId) return false;
      if (sourceId && r.sourceId !== sourceId) return false;
      return true;
    });

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  getStats(): SyncStats {
    const allJobs = Array.from(this.jobs.values());
    return {
      totalJobs: allJobs.length,
      activeJobs: allJobs.filter((j) => j.status === "running").length,
      completedJobs: allJobs.filter((j) => j.status === "completed").length,
      failedJobs: allJobs.filter((j) => j.status === "failed").length,
      recordsSynced: this.totalRecordsSynced,
      lastRunAt: this.lastRunAt,
    };
  }

  start(): void {
    if (this.running) {
      logger.info("[BackgroundSync] Scheduler already running");
      return;
    }

    this.running = true;
    this.schedulerInterval = setInterval(() => this.runScheduler(), 30_000);
    logger.info("[BackgroundSync] Scheduler started (30s check interval)");
  }

  stop(): void {
    if (!this.running) {
      logger.info("[BackgroundSync] Scheduler not running");
      return;
    }

    this.running = false;
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    logger.info("[BackgroundSync] Scheduler stopped");
  }

  private async runScheduler(): Promise<void> {
    if (!this.running) return;

    const dueJobs = Array.from(this.jobs.values())
      .filter((job) => this.shouldSync(job))
      .sort((a, b) => a.priority - b.priority);

    for (const job of dueJobs) {
      if (this.activeJobs >= this.config.maxConcurrentJobs) {
        logger.info(
          `[BackgroundSync] Max concurrent jobs (${this.config.maxConcurrentJobs}) reached, deferring remaining`
        );
        break;
      }

      this.executeSync(job).catch((err) => {
        logger.error(
          `[BackgroundSync] Unhandled error syncing job ${job.id}:`,
          err
        );
      });
    }
  }

  private async executeFastenSync(job: SyncJob): Promise<{ fetched: number; newRecords: number; updated: number }> {
    const orgConnectionId = job.metadata.orgConnectionId as string | undefined;
    if (!orgConnectionId) {
      throw new Error("No orgConnectionId in job metadata");
    }

    const { triggerEhiExport, downloadAndImportFhirData } = await import("./fasten-health-service");

    const exportResult = await triggerEhiExport(orgConnectionId);
    if (!exportResult) {
      logger.warn(`[BackgroundSync] Fasten EHI export returned null for ${orgConnectionId} — API keys may not be configured`);
      return { fetched: 0, newRecords: 0, updated: 0 };
    }

    const FASTEN_API_BASE = process.env.FASTEN_API_BASE || "https://api.fastenhealth.com/v1";
    const downloadUrl = `${FASTEN_API_BASE}/bridge/fhir/ehi-export/${exportResult.taskId}`;
    const importResult = await downloadAndImportFhirData(
      job.userId,
      downloadUrl,
      orgConnectionId,
      job.sourceName
    );
    const fetched = importResult.imported + importResult.errors;
    const newRecords = importResult.imported;

    if (importResult.imported > 0) {
      try {
        const { runPostImportPipeline } = await import("./phr-pipeline-service");
        await runPostImportPipeline(job.userId);
        logger.info(`[BackgroundSync] Post-import pipeline completed for user ${job.userId}`);
      } catch (pipelineErr: any) {
        logger.warn(`[BackgroundSync] Post-import pipeline failed (non-blocking): ${pipelineErr.message}`);
      }
    }

    return { fetched, newRecords, updated: 0 };
  }

  private async executeSync(job: SyncJob): Promise<SyncResult> {
    const startTime = Date.now();
    job.status = "running";
    this.activeJobs++;

    logger.info(
      `[BackgroundSync] Starting sync for "${job.sourceName}" (${job.sourceType}), job ${job.id}`
    );

    try {
      let recordsFetched: number;
      let recordsNew: number;
      let recordsUpdated: number;

      if (job.sourceType === "fasten") {
        const fastenResult = await this.executeFastenSync(job);
        recordsFetched = fastenResult.fetched;
        recordsNew = fastenResult.newRecords;
        recordsUpdated = fastenResult.updated;
      } else {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 + Math.random() * 200)
        );
        recordsFetched = 0;
        recordsNew = 0;
        recordsUpdated = 0;
      }

      const duration = Date.now() - startTime;

      const result: SyncResult = {
        jobId: job.id,
        sourceId: job.sourceId,
        recordsFetched,
        recordsUpdated,
        recordsNew,
        duration,
        success: true,
        errors: [],
      };

      job.status = "completed";
      job.lastRunAt = new Date();
      job.retryCount = 0;
      job.errorMessage = null;
      job.nextRunAt = this.calculateNextRun(job);

      this.totalRecordsSynced += recordsFetched;
      this.lastRunAt = new Date();
      this.addToHistory(result);

      logger.info(
        `[BackgroundSync] Sync completed for "${job.sourceName}": ${recordsFetched} fetched, ${recordsNew} new, ${recordsUpdated} updated (${duration}ms)`
      );

      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      job.retryCount++;
      job.errorMessage = errorMessage;

      if (job.retryCount >= job.maxRetries) {
        job.status = "failed";
        logger.error(
          `[BackgroundSync] Sync failed permanently for "${job.sourceName}" after ${job.retryCount} retries: ${errorMessage}`
        );
      } else {
        job.status = "pending";
        job.nextRunAt = this.calculateNextRun(job);
        logger.warn(
          `[BackgroundSync] Sync failed for "${job.sourceName}" (retry ${job.retryCount}/${job.maxRetries}), next attempt at ${job.nextRunAt.toISOString()}`
        );
      }

      const result: SyncResult = {
        jobId: job.id,
        sourceId: job.sourceId,
        recordsFetched: 0,
        recordsUpdated: 0,
        recordsNew: 0,
        duration,
        success: false,
        errors: [errorMessage],
      };

      this.lastRunAt = new Date();
      this.addToHistory(result);

      return result;
    } finally {
      this.activeJobs--;
    }
  }

  private calculateNextRun(job: SyncJob): Date {
    if (job.retryCount > 0 && job.retryCount < job.maxRetries) {
      const backoffMinutes =
        this.config.retryBackoff * Math.pow(2, job.retryCount - 1);
      return new Date(Date.now() + backoffMinutes * 60 * 1000);
    }

    return new Date(Date.now() + job.intervalMinutes * 60 * 1000);
  }

  private shouldSync(job: SyncJob): boolean {
    if (job.status === "running" || job.status === "paused" || job.status === "failed") {
      return false;
    }

    if (!this.config.enabledSourceTypes.includes(job.sourceType)) {
      return false;
    }

    return new Date() >= job.nextRunAt;
  }

  private findJob(userId: string, sourceId: string): SyncJob | undefined {
    return Array.from(this.jobs.values()).find(
      (j) => j.userId === userId && j.sourceId === sourceId
    );
  }

  private getPriority(sourceType: string): number {
    const priorities: Record<string, number> = {
      lab: 1,
      wearable: 2,
      fhir: 3,
      fasten: 3,
      ehr: 4,
      pharmacy: 5,
      imaging: 6,
      insurance: 7,
      idme: 8,
    };
    return priorities[sourceType] ?? 5;
  }

  private addToHistory(result: SyncResult): void {
    this.syncHistory.push(result);
    if (this.syncHistory.length > 1000) {
      this.syncHistory = this.syncHistory.slice(-1000);
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();

export function registerFastenSource(
  userId: string,
  orgConnectionId: string,
  sourceName: string,
  intervalMinutes?: number
): SyncJob {
  const existing = backgroundSyncService.getJobs(userId).find(
    (j) => j.sourceType === "fasten" && j.metadata.orgConnectionId === orgConnectionId
  );
  if (existing) {
    logger.info(`[BackgroundSync] Fasten source "${sourceName}" already registered for user ${userId}`);
    return existing;
  }

  return backgroundSyncService.registerSource(
    userId,
    `fasten-${orgConnectionId}`,
    sourceName,
    "fasten",
    intervalMinutes
  );
}

export function registerFastenSourceWithMetadata(
  userId: string,
  orgConnectionId: string,
  sourceName: string,
  intervalMinutes?: number
): SyncJob {
  const job = registerFastenSource(userId, orgConnectionId, sourceName, intervalMinutes);
  job.metadata.orgConnectionId = orgConnectionId;
  return job;
}

export function initializeBackgroundSync(): void {
  logger.info("[BackgroundSync] Initializing background sync service");
  backgroundSyncService.start();
}
