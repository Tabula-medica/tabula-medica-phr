import { storage } from "./storage";
import { syncEhrConnection } from "./fhir";
import type { EhrConnection, SyncScheduleInterval } from "@shared/schema";

async function logSyncTriggered(userId: string, platform: string, connectionId: string, trigger: string): Promise<void> {
  console.log(`[HIPAA-AUDIT][SyncScheduler] Sync triggered: userId=${userId}, platform=${platform}, connectionId=${connectionId}, trigger=${trigger}`);
}

async function logSyncCompleted(userId: string, platform: string, connectionId: string, durationMs: number, recordCount: number): Promise<void> {
  console.log(`[HIPAA-AUDIT][SyncScheduler] Sync completed: userId=${userId}, platform=${platform}, connectionId=${connectionId}, duration=${durationMs}ms, records=${recordCount}`);
}

async function logSyncFailed(userId: string, platform: string, connectionId: string, error: string): Promise<void> {
  console.error(`[HIPAA-AUDIT][SyncScheduler] Sync failed: userId=${userId}, platform=${platform}, connectionId=${connectionId}, error=${error}`);
}

async function checkConnectionTokenExpiry(connection: EhrConnection): Promise<boolean> {
  if (!connection.tokens?.expiresAt) return true;
  const expiresAt = new Date(connection.tokens.expiresAt).getTime();
  return Date.now() >= expiresAt;
}

const SCHEDULER_INTERVAL_MS = 60 * 1000; // Check every minute

function getSyncIntervalMs(interval: SyncScheduleInterval): number {
  switch (interval) {
    case "15min": return 15 * 60 * 1000;
    case "30min": return 30 * 60 * 1000;
    case "1hour": return 60 * 60 * 1000;
    case "4hours": return 4 * 60 * 60 * 1000;
    case "12hours": return 12 * 60 * 60 * 1000;
    case "24hours": return 24 * 60 * 60 * 1000;
    case "manual": return 0;
    default: return 4 * 60 * 60 * 1000;
  }
}

async function shouldSyncConnection(connection: EhrConnection): Promise<boolean> {
  if (!connection.syncSettings?.autoSyncEnabled) {
    return false;
  }
  
  if (connection.syncSettings.syncInterval === "manual") {
    return false;
  }
  
  if (connection.status !== "connected") {
    return false;
  }
  
  if (!connection.tokens || !connection.fhirConfig) {
    return false;
  }
  
  // Check token expiry before syncing
  const isExpired = await checkConnectionTokenExpiry(connection);
  if (isExpired) {
    console.log(`[SyncScheduler] Skipping sync for ${connection.platform}: token expired`);
    return false;
  }
  
  // Check max retries
  const maxRetries = connection.syncSettings.maxRetries ?? 3;
  const retryCount = connection.syncSettings.retryCount ?? 0;
  if (retryCount >= maxRetries) {
    console.log(`[SyncScheduler] Skipping sync for ${connection.platform}: max retries reached`);
    return false;
  }
  
  const intervalMs = getSyncIntervalMs(connection.syncSettings.syncInterval);
  if (intervalMs === 0) {
    return false;
  }
  
  const now = Date.now();
  const lastSync = connection.lastSync ? new Date(connection.lastSync).getTime() : 0;
  
  return (now - lastSync) >= intervalMs;
}

async function runScheduledSync(connection: EhrConnection): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log(`[SyncScheduler] Starting scheduled sync for ${connection.platform} - ${connection.facilityName}`);
    
    await logSyncTriggered(
      connection.userId, 
      connection.platform, 
      connection.id, 
      "scheduled"
    );
    
    await storage.updateEhrConnection(connection.id, { status: "syncing" });
    
    const result = await syncEhrConnection(connection);
    const duration = Date.now() - startTime;
    const recordsAdded = result.patientsAdded + result.recordsAdded + result.medicationsAdded + result.vitalsAdded;
    const partialSync = result.errors.length > 0 && result.success;
    
    // Determine the appropriate status after sync
    const newStatus = result.success || partialSync ? "connected" : "error";
    
    await storage.updateEhrConnection(connection.id, {
      status: newStatus,
      syncError: result.success ? undefined : result.errors.join(", "),
      lastSyncResult: {
        success: result.success,
        recordsAdded,
        errors: result.errors,
        partialSync,
        duration,
      },
      syncSettings: {
        autoSyncEnabled: connection.syncSettings?.autoSyncEnabled ?? true,
        syncInterval: connection.syncSettings?.syncInterval ?? "4hours",
        lastScheduledSync: new Date().toISOString(),
        nextScheduledSync: connection.syncSettings?.syncInterval 
          ? new Date(Date.now() + getSyncIntervalMs(connection.syncSettings.syncInterval)).toISOString()
          : undefined,
        retryCount: result.success ? 0 : (connection.syncSettings?.retryCount || 0) + 1,
        maxRetries: connection.syncSettings?.maxRetries ?? 3,
      },
    });
    
    if (result.success || partialSync) {
      await logSyncCompleted(
        connection.userId, 
        connection.platform, 
        connection.id, 
        recordsAdded, 
        duration, 
        partialSync
      );
      console.log(`[SyncScheduler] Completed sync for ${connection.platform}: ${recordsAdded} records added`);
    } else {
      await logSyncFailed(
        connection.userId, 
        connection.platform, 
        connection.id, 
        result.errors.join(", "),
        connection.syncSettings?.retryCount || 0
      );
      console.log(`[SyncScheduler] Failed sync for ${connection.platform}: ${result.errors.join(", ")}`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[SyncScheduler] Error syncing ${connection.platform}:`, error);
    
    await storage.updateEhrConnection(connection.id, {
      status: "error",
      syncError: errorMessage,
      syncSettings: {
        autoSyncEnabled: connection.syncSettings?.autoSyncEnabled ?? true,
        syncInterval: connection.syncSettings?.syncInterval ?? "4hours",
        lastScheduledSync: connection.syncSettings?.lastScheduledSync,
        nextScheduledSync: connection.syncSettings?.nextScheduledSync,
        retryCount: (connection.syncSettings?.retryCount || 0) + 1,
        maxRetries: connection.syncSettings?.maxRetries ?? 3,
      },
    });
    
    await logSyncFailed(
      connection.userId, 
      connection.platform, 
      connection.id, 
      errorMessage,
      connection.syncSettings?.retryCount || 0
    );
  }
}

async function checkScheduledSyncs(): Promise<void> {
  try {
    const connections = await storage.getEhrConnections();
    
    for (const connection of connections) {
      if (await shouldSyncConnection(connection)) {
        await runScheduledSync(connection);
      }
    }
  } catch (error) {
    console.error("[SyncScheduler] Error checking scheduled syncs:", error);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startSyncScheduler(): void {
  if (schedulerInterval) {
    console.log("[SyncScheduler] Scheduler already running");
    return;
  }
  
  console.log("[SyncScheduler] Starting background sync scheduler");
  
  schedulerInterval = setInterval(checkScheduledSyncs, SCHEDULER_INTERVAL_MS);
  
  setTimeout(checkScheduledSyncs, 5000);
}

export function stopSyncScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[SyncScheduler] Stopped background sync scheduler");
  }
}

export { checkScheduledSyncs, shouldSyncConnection };
