import { stateIISConnectorService, StateIISConnector, IISSyncJob } from "./state-iis-connector-service";
import { logPhiAccess } from "../security/hipaa-audit";

export interface IISSyncSchedule {
  id: string;
  connectorId: string;
  stateCode: string;
  patientId: string;
  frequency: "hourly" | "daily" | "weekly";
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface IISBackgroundSyncStats {
  isRunning: boolean;
  schedulerStartedAt?: string;
  totalSchedules: number;
  activeSchedules: number;
  pausedSchedules: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobsToday: number;
  failedJobsToday: number;
  nextScheduledRun?: string;
}

const syncSchedules = new Map<string, IISSyncSchedule>();
let schedulerRunning = false;
let schedulerStartedAt: string | undefined;
let schedulerInterval: NodeJS.Timeout | null = null;
let completedJobsToday = 0;
let failedJobsToday = 0;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function initializeSampleSchedules(): void {
  const connectedStates = stateIISConnectorService.getConnectedStates();
  
  connectedStates.forEach((connector) => {
    const schedule: IISSyncSchedule = {
      id: generateId("iis-sched"),
      connectorId: connector.id,
      stateCode: connector.stateCode,
      patientId: "patient-1",
      frequency: "daily",
      enabled: true,
      lastRunAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      nextRunAt: new Date(Date.now() + Math.random() * 86400000).toISOString(),
      consecutiveFailures: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    syncSchedules.set(schedule.id, schedule);
  });

  console.log(`[IISBackgroundSync] Initialized ${syncSchedules.size} sample sync schedules`);
}

async function runScheduledSync(schedule: IISSyncSchedule): Promise<void> {
  try {
    logPhiAccess({
      userId: "scheduler",
      action: "read",
      resourceType: "IISSyncSchedule",
      resourceId: schedule.id,
      patientId: schedule.patientId,
      details: `Scheduled IIS sync: ${schedule.stateCode}`,
    });

    const job = await stateIISConnectorService.triggerSync(
      schedule.connectorId,
      schedule.patientId,
      "scheduler"
    );

    schedule.lastRunAt = new Date().toISOString();
    schedule.nextRunAt = calculateNextRunTime(schedule.frequency);
    schedule.consecutiveFailures = 0;
    schedule.updatedAt = new Date().toISOString();
    syncSchedules.set(schedule.id, schedule);

    await waitForJobCompletion(job.id);
    
    const completedJob = stateIISConnectorService.getSyncJob(job.id);
    if (completedJob?.status === "completed") {
      completedJobsToday++;
    } else if (completedJob?.status === "failed") {
      failedJobsToday++;
      schedule.consecutiveFailures++;
      syncSchedules.set(schedule.id, schedule);
    }
  } catch (error) {
    failedJobsToday++;
    schedule.consecutiveFailures++;
    schedule.updatedAt = new Date().toISOString();
    syncSchedules.set(schedule.id, schedule);
    console.error(`[IISBackgroundSync] Sync failed for ${schedule.stateCode}:`, error);
  }
}

async function waitForJobCompletion(jobId: string, maxWaitMs = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const job = stateIISConnectorService.getSyncJob(jobId);
    if (job && (job.status === "completed" || job.status === "failed")) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

function calculateNextRunTime(frequency: "hourly" | "daily" | "weekly"): string {
  const now = Date.now();
  switch (frequency) {
    case "hourly":
      return new Date(now + 60 * 60 * 1000).toISOString();
    case "daily":
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    case "weekly":
      return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }
}

async function processScheduledSyncs(): Promise<void> {
  const now = Date.now();
  const schedulesToRun = Array.from(syncSchedules.values()).filter(
    (s) => s.enabled && s.nextRunAt && new Date(s.nextRunAt).getTime() <= now
  );

  for (const schedule of schedulesToRun) {
    if (schedule.consecutiveFailures >= 3) {
      console.log(`[IISBackgroundSync] Skipping ${schedule.stateCode} - too many failures`);
      continue;
    }
    await runScheduledSync(schedule);
  }
}

export const iisBackgroundSyncService = {
  start(): void {
    if (schedulerRunning) {
      console.log("[IISBackgroundSync] Scheduler already running");
      return;
    }

    initializeSampleSchedules();
    schedulerRunning = true;
    schedulerStartedAt = new Date().toISOString();

    schedulerInterval = setInterval(async () => {
      try {
        await processScheduledSyncs();
      } catch (error) {
        console.error("[IISBackgroundSync] Scheduler error:", error);
      }
    }, 60000);

    console.log("[IISBackgroundSync] Background sync scheduler started (1 minute interval)");
  },

  stop(): void {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    schedulerRunning = false;
    schedulerStartedAt = undefined;
    console.log("[IISBackgroundSync] Background sync scheduler stopped");
  },

  isRunning(): boolean {
    return schedulerRunning;
  },

  getStats(): IISBackgroundSyncStats {
    const schedules = Array.from(syncSchedules.values());
    const activeSchedules = schedules.filter((s) => s.enabled);
    const nextRun = activeSchedules
      .filter((s) => s.nextRunAt)
      .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())[0];

    const syncHealth = stateIISConnectorService.getSyncHealth();

    return {
      isRunning: schedulerRunning,
      schedulerStartedAt,
      totalSchedules: schedules.length,
      activeSchedules: activeSchedules.length,
      pausedSchedules: schedules.length - activeSchedules.length,
      queuedJobs: syncHealth.activeSyncJobs,
      processingJobs: syncHealth.activeSyncJobs,
      completedJobsToday,
      failedJobsToday,
      nextScheduledRun: nextRun?.nextRunAt,
    };
  },

  getAllSchedules(): IISSyncSchedule[] {
    return Array.from(syncSchedules.values());
  },

  getSchedule(scheduleId: string): IISSyncSchedule | undefined {
    return syncSchedules.get(scheduleId);
  },

  async createSchedule(
    connectorId: string,
    patientId: string,
    frequency: "hourly" | "daily" | "weekly",
    userId: string
  ): Promise<IISSyncSchedule> {
    const connector = stateIISConnectorService.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector not found: ${connectorId}`);
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IISSyncSchedule",
      resourceId: connectorId,
      patientId,
      details: `Create IIS sync schedule: ${connector.stateCode}`,
    });

    const schedule: IISSyncSchedule = {
      id: generateId("iis-sched"),
      connectorId,
      stateCode: connector.stateCode,
      patientId,
      frequency,
      enabled: true,
      nextRunAt: calculateNextRunTime(frequency),
      consecutiveFailures: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    syncSchedules.set(schedule.id, schedule);
    return schedule;
  },

  async updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<IISSyncSchedule, "frequency" | "enabled">>,
    userId: string
  ): Promise<IISSyncSchedule> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "IISSyncSchedule",
      resourceId: scheduleId,
      patientId: schedule.patientId,
      details: `Update IIS sync schedule: ${schedule.stateCode}`,
    });

    if (updates.frequency !== undefined) {
      schedule.frequency = updates.frequency;
      schedule.nextRunAt = calculateNextRunTime(updates.frequency);
    }
    if (updates.enabled !== undefined) {
      schedule.enabled = updates.enabled;
    }
    schedule.updatedAt = new Date().toISOString();

    syncSchedules.set(scheduleId, schedule);
    return schedule;
  },

  async deleteSchedule(scheduleId: string, userId: string): Promise<boolean> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "IISSyncSchedule",
      resourceId: scheduleId,
      patientId: schedule.patientId,
      details: `Delete IIS sync schedule: ${schedule.stateCode}`,
    });

    return syncSchedules.delete(scheduleId);
  },

  async triggerManualSync(scheduleId: string, userId: string): Promise<IISSyncJob> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "IISSyncSchedule",
      resourceId: scheduleId,
      patientId: schedule.patientId,
      details: `Manual IIS sync trigger: ${schedule.stateCode}`,
    });

    return stateIISConnectorService.triggerSync(schedule.connectorId, schedule.patientId, userId);
  },

  resetDailyStats(): void {
    completedJobsToday = 0;
    failedJobsToday = 0;
  },
};

iisBackgroundSyncService.start();

console.log("[IISBackgroundSync] Service initialized with background scheduler");
