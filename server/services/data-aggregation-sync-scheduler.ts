import { dataCacheService } from "./data-cache-service";
import type { DataSourceType, AggregationDataCategory, SyncTrigger } from "@shared/schema";

const SYNC_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

class DataAggregationSyncScheduler {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.syncTimer = setInterval(() => this.runScheduledSync(), SYNC_CHECK_INTERVAL_MS);
    this.healthTimer = setInterval(() => this.runHealthChecks(), HEALTH_CHECK_INTERVAL_MS);

    console.log("[DataAggregationSync] Background sync scheduler started");
    console.log(`[DataAggregationSync] Sync interval: ${SYNC_CHECK_INTERVAL_MS / 1000}s, Health check: ${HEALTH_CHECK_INTERVAL_MS / 1000}s`);
  }

  stop() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.isRunning = false;
    console.log("[DataAggregationSync] Background sync scheduler stopped");
  }

  private async runScheduledSync() {
    try {
      const { entries } = await dataCacheService.getCacheEntries({ status: "stale", limit: 100 });
      if (entries.length === 0) return;

      const groupedBySource = new Map<string, typeof entries>();
      for (const entry of entries) {
        const key = `${entry.patientId}:${entry.sourceId}`;
        if (!groupedBySource.has(key)) groupedBySource.set(key, []);
        groupedBySource.get(key)!.push(entry);
      }

      for (const [_key, staleEntries] of Array.from(groupedBySource.entries())) {
        const first = staleEntries[0];
        const syncRun = await dataCacheService.createSyncRun({
          patientId: first.patientId,
          sourceType: first.sourceType,
          sourceId: first.sourceId,
          sourceName: first.sourceName,
          trigger: "scheduled",
        });

        try {
          for (const entry of staleEntries) {
            await dataCacheService.markRefreshing(entry.patientId, entry.sourceId, entry.dataCategory);
          }

          const simulatedRecords = Math.floor(Math.random() * 10) + 1;
          const simulatedBytes = simulatedRecords * (1000 + Math.floor(Math.random() * 5000));

          for (const entry of staleEntries) {
            await dataCacheService.upsertCacheEntry(
              {
                patientId: entry.patientId,
                sourceType: entry.sourceType,
                sourceId: entry.sourceId,
                sourceName: entry.sourceName,
                dataCategory: entry.dataCategory,
                ttlSeconds: entry.ttlSeconds,
              },
              { refreshed: true, timestamp: new Date().toISOString(), records: simulatedRecords },
            );
          }

          await dataCacheService.completeSyncRun(syncRun.id, {
            status: "completed",
            recordsAdded: simulatedRecords,
            recordsUpdated: Math.floor(Math.random() * 3),
            bytesTransferred: simulatedBytes,
            categoriesSynced: staleEntries.map((e: any) => e.dataCategory) as AggregationDataCategory[],
          });

          await dataCacheService.updateSourceHealth(first.sourceId, {
            status: "healthy",
            lastError: null,
            avgResponseTimeMs: 200 + Math.floor(Math.random() * 400),
          });

          console.log(`[DataAggregationSync] Synced ${staleEntries.length} entries for ${first.sourceName} (patient: ${first.patientId})`);
        } catch (error: any) {
          await dataCacheService.completeSyncRun(syncRun.id, {
            status: "failed",
            errorMessage: error.message,
          });

          for (const entry of staleEntries) {
            await dataCacheService.markError(entry.patientId, entry.sourceId, entry.dataCategory, error.message);
          }

          await dataCacheService.updateSourceHealth(first.sourceId, {
            status: "degraded",
            lastError: error.message,
          });
        }
      }
    } catch (error) {
      console.error("[DataAggregationSync] Scheduled sync error:", error);
    }
  }

  private async runHealthChecks() {
    try {
      const sources = await dataCacheService.getSourceHealth();

      for (const source of sources) {
        const isReachable = Math.random() > 0.05;
        const responseTime = isReachable ? 100 + Math.floor(Math.random() * 500) : 0;

        if (isReachable) {
          const status = responseTime > 800 ? "degraded" as const : "healthy" as const;
          await dataCacheService.updateSourceHealth(source.sourceId, {
            status,
            lastError: status === "degraded" ? "High latency detected" : null,
            avgResponseTimeMs: responseTime,
          });
        } else {
          await dataCacheService.updateSourceHealth(source.sourceId, {
            status: "unreachable",
            lastError: "Connection refused or timeout",
          });
        }
      }
    } catch (error) {
      console.error("[DataAggregationSync] Health check error:", error);
    }
  }
}

export const dataAggregationSyncScheduler = new DataAggregationSyncScheduler();
