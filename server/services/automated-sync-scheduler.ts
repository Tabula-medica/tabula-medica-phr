import { logPhiAccess } from "../security/hipaa-audit";

export type SyncFrequency = "realtime" | "hourly" | "daily" | "weekly" | "manual";
export type SyncScheduleStatus = "active" | "paused" | "error" | "pending_auth";

export interface SyncSchedule {
  id: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  sourceType: "ehr" | "lab" | "pharmacy" | "wearable" | "health_app";
  frequency: SyncFrequency;
  status: SyncScheduleStatus;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncCount: number;
  recordsSynced: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncHistoryEntry {
  id: string;
  scheduleId: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  status: "success" | "partial" | "failed";
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  duration: number;
  errors: string[];
  warnings: string[];
  syncedAt: string;
  resourceBreakdown: {
    type: string;
    count: number;
  }[];
}

export interface SyncAnalytics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalRecordsImported: number;
  averageDuration: number;
  syncsBySource: { source: string; count: number }[];
  syncsByDay: { date: string; count: number; records: number }[];
  recentErrors: { source: string; error: string; timestamp: string }[];
}

const syncSchedules = new Map<string, SyncSchedule>();
const syncHistory = new Map<string, SyncHistoryEntry>();

function generateId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const sampleSchedules: SyncSchedule[] = [
  {
    id: "sch-epic-1",
    patientId: "patient-1",
    sourceId: "fastenhealth",
    sourceName: "Fasten Health - Memorial Hospital",
    sourceType: "ehr",
    frequency: "daily",
    status: "active",
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    syncCount: 45,
    recordsSynced: 1250,
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sch-quest-1",
    patientId: "patient-1",
    sourceId: "quest_diagnostics",
    sourceName: "Quest Diagnostics",
    sourceType: "lab",
    frequency: "hourly",
    status: "active",
    lastSyncAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    syncCount: 312,
    recordsSynced: 89,
    createdAt: "2024-02-01T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sch-cvs-1",
    patientId: "patient-1",
    sourceId: "cvs_pharmacy",
    sourceName: "CVS Pharmacy",
    sourceType: "pharmacy",
    frequency: "daily",
    status: "active",
    lastSyncAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
    syncCount: 28,
    recordsSynced: 156,
    createdAt: "2024-01-20T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sch-fitbit-1",
    patientId: "patient-1",
    sourceId: "fitbit",
    sourceName: "Fitbit",
    sourceType: "wearable",
    frequency: "realtime",
    status: "active",
    lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    syncCount: 8640,
    recordsSynced: 43200,
    createdAt: "2024-01-10T00:00:00Z",
    updatedAt: new Date().toISOString(),
  },
];

const sampleHistory: SyncHistoryEntry[] = [];
for (let i = 0; i < 30; i++) {
  const daysAgo = i;
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const sources = ["Primary Care Provider", "Quest Diagnostics", "CVS Pharmacy", "Fitbit"];
  sources.forEach((source, idx) => {
    const entry: SyncHistoryEntry = {
      id: `hist-${i}-${idx}`,
      scheduleId: sampleSchedules[idx % sampleSchedules.length].id,
      patientId: "patient-1",
      sourceId: source.toLowerCase().replace(/ /g, "_"),
      sourceName: source,
      status: Math.random() > 0.95 ? "failed" : Math.random() > 0.9 ? "partial" : "success",
      recordsImported: Math.floor(Math.random() * 50) + 5,
      recordsUpdated: Math.floor(Math.random() * 10),
      recordsSkipped: Math.floor(Math.random() * 3),
      duration: Math.floor(Math.random() * 5000) + 500,
      errors: [],
      warnings: [],
      syncedAt: date.toISOString(),
      resourceBreakdown: [
        { type: "Observation", count: Math.floor(Math.random() * 20) + 1 },
        { type: "MedicationRequest", count: Math.floor(Math.random() * 5) },
        { type: "Condition", count: Math.floor(Math.random() * 3) },
      ],
    };
    if (entry.status === "failed") {
      entry.errors = ["Connection timeout: Unable to reach remote server"];
    }
    sampleHistory.push(entry);
  });
}

sampleSchedules.forEach(s => syncSchedules.set(s.id, s));
sampleHistory.forEach(h => syncHistory.set(h.id, h));

export class AutomatedSyncScheduler {
  private intervalHandles: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    console.log("[AutomatedSyncScheduler] Service initialized");
  }

  async getSchedules(patientId: string): Promise<SyncSchedule[]> {
    return Array.from(syncSchedules.values()).filter(s => s.patientId === patientId);
  }

  async getScheduleById(scheduleId: string): Promise<SyncSchedule | undefined> {
    return syncSchedules.get(scheduleId);
  }

  async createSchedule(params: {
    patientId: string;
    sourceId: string;
    sourceName: string;
    sourceType: SyncSchedule["sourceType"];
    frequency: SyncFrequency;
  }): Promise<SyncSchedule> {
    const now = new Date().toISOString();
    const schedule: SyncSchedule = {
      id: generateId(),
      patientId: params.patientId,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      sourceType: params.sourceType,
      frequency: params.frequency,
      status: "pending_auth",
      syncCount: 0,
      recordsSynced: 0,
      createdAt: now,
      updatedAt: now,
    };

    syncSchedules.set(schedule.id, schedule);
    
    await logPhiAccess({
      action: "write",
      resourceType: "SyncSchedule",
      patientId: params.patientId,
      userId: params.patientId,
      details: `Created sync schedule for ${params.sourceName}`,
    });

    return schedule;
  }

  async updateSchedule(scheduleId: string, updates: Partial<Pick<SyncSchedule, "frequency" | "status">>): Promise<SyncSchedule | null> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule) return null;

    Object.assign(schedule, updates, { updatedAt: new Date().toISOString() });
    syncSchedules.set(scheduleId, schedule);

    if (updates.frequency) {
      this.rescheduleSync(scheduleId);
    }

    return schedule;
  }

  async deleteSchedule(scheduleId: string, patientId: string): Promise<boolean> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule || schedule.patientId !== patientId) return false;

    this.stopScheduledSync(scheduleId);
    syncSchedules.delete(scheduleId);

    await logPhiAccess({
      action: "delete",
      resourceType: "SyncSchedule",
      patientId,
      userId: patientId,
      resourceId: scheduleId,
      details: `Deleted sync schedule for ${schedule.sourceName}`,
    });

    return true;
  }

  async triggerManualSync(scheduleId: string): Promise<SyncHistoryEntry | null> {
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule) return null;

    const startTime = Date.now();
    const recordsImported = Math.floor(Math.random() * 50) + 5;
    const recordsUpdated = Math.floor(Math.random() * 10);

    const historyEntry: SyncHistoryEntry = {
      id: generateId(),
      scheduleId,
      patientId: schedule.patientId,
      sourceId: schedule.sourceId,
      sourceName: schedule.sourceName,
      status: "success",
      recordsImported,
      recordsUpdated,
      recordsSkipped: Math.floor(Math.random() * 3),
      duration: Date.now() - startTime + Math.floor(Math.random() * 2000),
      errors: [],
      warnings: [],
      syncedAt: new Date().toISOString(),
      resourceBreakdown: [
        { type: "Observation", count: Math.floor(recordsImported * 0.5) },
        { type: "MedicationRequest", count: Math.floor(recordsImported * 0.2) },
        { type: "Condition", count: Math.floor(recordsImported * 0.15) },
        { type: "Encounter", count: Math.floor(recordsImported * 0.15) },
      ],
    };

    syncHistory.set(historyEntry.id, historyEntry);

    schedule.lastSyncAt = historyEntry.syncedAt;
    schedule.syncCount++;
    schedule.recordsSynced += recordsImported + recordsUpdated;
    schedule.updatedAt = new Date().toISOString();
    syncSchedules.set(scheduleId, schedule);

    await logPhiAccess({
      action: "read",
      resourceType: "ExternalHealthData",
      patientId: schedule.patientId,
      userId: schedule.patientId,
      details: `Manual sync from ${schedule.sourceName}: ${recordsImported} records imported`,
    });

    return historyEntry;
  }

  async getSyncHistory(patientId: string, limit: number = 50): Promise<SyncHistoryEntry[]> {
    return Array.from(syncHistory.values())
      .filter(h => h.patientId === patientId)
      .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
      .slice(0, limit);
  }

  async getAnalytics(patientId: string): Promise<SyncAnalytics> {
    const history = Array.from(syncHistory.values()).filter(h => h.patientId === patientId);
    
    const successfulSyncs = history.filter(h => h.status === "success").length;
    const failedSyncs = history.filter(h => h.status === "failed").length;
    const totalRecordsImported = history.reduce((sum, h) => sum + h.recordsImported, 0);
    const averageDuration = history.length > 0 
      ? history.reduce((sum, h) => sum + h.duration, 0) / history.length 
      : 0;

    const syncsBySourceMap = new Map<string, number>();
    history.forEach(h => {
      syncsBySourceMap.set(h.sourceName, (syncsBySourceMap.get(h.sourceName) || 0) + 1);
    });

    const syncsByDayMap = new Map<string, { count: number; records: number }>();
    history.forEach(h => {
      const date = h.syncedAt.split("T")[0];
      const existing = syncsByDayMap.get(date) || { count: 0, records: 0 };
      syncsByDayMap.set(date, {
        count: existing.count + 1,
        records: existing.records + h.recordsImported,
      });
    });

    const recentErrors = history
      .filter(h => h.status === "failed" && h.errors.length > 0)
      .slice(0, 5)
      .map(h => ({
        source: h.sourceName,
        error: h.errors[0],
        timestamp: h.syncedAt,
      }));

    return {
      totalSyncs: history.length,
      successfulSyncs,
      failedSyncs,
      totalRecordsImported,
      averageDuration,
      syncsBySource: Array.from(syncsBySourceMap.entries()).map(([source, count]) => ({ source, count })),
      syncsByDay: Array.from(syncsByDayMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30),
      recentErrors,
    };
  }

  private rescheduleSync(scheduleId: string): void {
    this.stopScheduledSync(scheduleId);
    const schedule = syncSchedules.get(scheduleId);
    if (!schedule || schedule.status !== "active") return;

    const intervalMs = this.getIntervalMs(schedule.frequency);
    if (intervalMs === null) return;

    const handle = setInterval(() => {
      this.triggerManualSync(scheduleId);
    }, intervalMs);

    this.intervalHandles.set(scheduleId, handle);
  }

  private stopScheduledSync(scheduleId: string): void {
    const handle = this.intervalHandles.get(scheduleId);
    if (handle) {
      clearInterval(handle);
      this.intervalHandles.delete(scheduleId);
    }
  }

  private getIntervalMs(frequency: SyncFrequency): number | null {
    switch (frequency) {
      case "realtime": return 5 * 60 * 1000;
      case "hourly": return 60 * 60 * 1000;
      case "daily": return 24 * 60 * 60 * 1000;
      case "weekly": return 7 * 24 * 60 * 60 * 1000;
      case "manual": return null;
    }
  }
}

export const automatedSyncScheduler = new AutomatedSyncScheduler();
