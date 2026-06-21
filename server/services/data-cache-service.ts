import { createHash, randomUUID } from "crypto";
import type {
  DataCacheEntry, InsertDataCacheEntry,
  DataSyncRun, InsertDataSyncRun,
  DataSourceHealth, DataAggregationDashboard,
  DataCacheStatus, AggregationDataCategory, DataSourceType,
  SourceHealthStatus, SyncTrigger,
} from "@shared/schema";

const DEFAULT_TTL_BY_CATEGORY: Record<AggregationDataCategory, number> = {
  labs: 4 * 3600,
  medications: 8 * 3600,
  documents: 24 * 3600,
  claims: 12 * 3600,
  vitals: 2 * 3600,
  conditions: 24 * 3600,
  procedures: 24 * 3600,
  immunizations: 24 * 3600,
  allergies: 24 * 3600,
  imaging: 12 * 3600,
};

class DataCacheService {
  private cacheEntries: Map<string, DataCacheEntry> = new Map();
  private syncRuns: DataSyncRun[] = [];
  private sourceHealth: Map<string, DataSourceHealth> = new Map();

  constructor() {
    this.initializeSampleData();
    this.startCacheExpiryChecker();
    console.log("[DataCacheService] Initialized with TTL-based invalidation and object storage support");
  }

  private getCacheKey(patientId: string, sourceId: string, category: AggregationDataCategory): string {
    return `${patientId}:${sourceId}:${category}`;
  }

  private computeFingerprint(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex").substring(0, 16);
  }

  async getCacheEntry(patientId: string, sourceId: string, category: AggregationDataCategory): Promise<DataCacheEntry | undefined> {
    const key = this.getCacheKey(patientId, sourceId, category);
    const entry = this.cacheEntries.get(key);
    if (!entry) return undefined;

    if (this.isExpired(entry)) {
      entry.cacheStatus = "expired";
      entry.updatedAt = new Date().toISOString();
    }
    return entry;
  }

  async getCacheEntries(filters: {
    patientId?: string;
    sourceType?: DataSourceType;
    sourceId?: string;
    category?: AggregationDataCategory;
    status?: DataCacheStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: DataCacheEntry[]; total: number }> {
    let entries = Array.from(this.cacheEntries.values());

    if (filters.patientId) entries = entries.filter(e => e.patientId === filters.patientId);
    if (filters.sourceType) entries = entries.filter(e => e.sourceType === filters.sourceType);
    if (filters.sourceId) entries = entries.filter(e => e.sourceId === filters.sourceId);
    if (filters.category) entries = entries.filter(e => e.dataCategory === filters.category);
    if (filters.status) entries = entries.filter(e => e.cacheStatus === filters.status);

    entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const total = entries.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;

    return { entries: entries.slice(offset, offset + limit), total };
  }

  async upsertCacheEntry(
    insert: InsertDataCacheEntry,
    data: unknown,
    objectStorageKey?: string,
  ): Promise<DataCacheEntry> {
    const key = this.getCacheKey(insert.patientId, insert.sourceId, insert.dataCategory);
    const existing = this.cacheEntries.get(key);
    const now = new Date().toISOString();
    const ttl = insert.ttlSeconds || DEFAULT_TTL_BY_CATEGORY[insert.dataCategory] || 3600;
    const fingerprint = this.computeFingerprint(data);
    const payloadStr = JSON.stringify(data);
    const recordCount = Array.isArray(data) ? data.length : 1;

    if (existing && existing.fingerprintHash === fingerprint) {
      existing.lastFetchedAt = now;
      existing.expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      existing.cacheStatus = "fresh";
      existing.errorMessage = null;
      existing.updatedAt = now;
      return existing;
    }

    const entry: DataCacheEntry = {
      id: existing?.id || randomUUID(),
      patientId: insert.patientId,
      sourceType: insert.sourceType,
      sourceId: insert.sourceId,
      sourceName: insert.sourceName,
      dataCategory: insert.dataCategory,
      cacheStatus: "fresh",
      lastFetchedAt: now,
      lastVisitDate: existing?.lastVisitDate || null,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      ttlSeconds: ttl,
      etag: null,
      fingerprintHash: fingerprint,
      objectStorageKey: objectStorageKey || existing?.objectStorageKey || null,
      payloadSizeBytes: payloadStr.length,
      recordCount,
      errorMessage: null,
      metadata: insert.metadata || {},
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.cacheEntries.set(key, entry);
    return entry;
  }

  async markStale(patientId: string, sourceId?: string, category?: AggregationDataCategory): Promise<number> {
    let count = 0;
    for (const entry of Array.from(this.cacheEntries.values())) {
      if (entry.patientId !== patientId) continue;
      if (sourceId && entry.sourceId !== sourceId) continue;
      if (category && entry.dataCategory !== category) continue;
      if (entry.cacheStatus === "fresh" || entry.cacheStatus === "expired") {
        entry.cacheStatus = "stale";
        entry.updatedAt = new Date().toISOString();
        count++;
      }
    }
    return count;
  }

  async markRefreshing(patientId: string, sourceId: string, category: AggregationDataCategory): Promise<boolean> {
    const key = this.getCacheKey(patientId, sourceId, category);
    const entry = this.cacheEntries.get(key);
    if (entry) {
      entry.cacheStatus = "refreshing";
      entry.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async markError(patientId: string, sourceId: string, category: AggregationDataCategory, error: string): Promise<void> {
    const key = this.getCacheKey(patientId, sourceId, category);
    const entry = this.cacheEntries.get(key);
    if (entry) {
      entry.cacheStatus = "error";
      entry.errorMessage = error;
      entry.updatedAt = new Date().toISOString();
    }
  }

  async updateLastVisitDate(patientId: string, sourceId: string, visitDate: string): Promise<number> {
    let count = 0;
    for (const entry of Array.from(this.cacheEntries.values())) {
      if (entry.patientId === patientId && entry.sourceId === sourceId) {
        const oldVisit = entry.lastVisitDate ? new Date(entry.lastVisitDate).getTime() : 0;
        const newVisit = new Date(visitDate).getTime();
        if (newVisit > oldVisit) {
          entry.lastVisitDate = visitDate;
          if (entry.lastFetchedAt && newVisit > new Date(entry.lastFetchedAt).getTime()) {
            entry.cacheStatus = "stale";
          }
          entry.updatedAt = new Date().toISOString();
          count++;
        }
      }
    }
    return count;
  }

  async invalidateByVisitDate(): Promise<number> {
    let count = 0;
    for (const entry of Array.from(this.cacheEntries.values())) {
      if (entry.lastVisitDate && entry.lastFetchedAt) {
        const visitTime = new Date(entry.lastVisitDate).getTime();
        const fetchTime = new Date(entry.lastFetchedAt).getTime();
        if (visitTime > fetchTime && entry.cacheStatus === "fresh") {
          entry.cacheStatus = "stale";
          entry.updatedAt = new Date().toISOString();
          count++;
        }
      }
    }
    return count;
  }

  private isExpired(entry: DataCacheEntry): boolean {
    if (!entry.expiresAt) return false;
    return new Date(entry.expiresAt).getTime() < Date.now();
  }

  async createSyncRun(insert: InsertDataSyncRun): Promise<DataSyncRun> {
    const run: DataSyncRun = {
      id: randomUUID(),
      ...insert,
      status: "running",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      bytesTransferred: 0,
      errorMessage: null,
      categoriesSynced: [],
      metadata: {},
    };
    this.syncRuns.unshift(run);
    if (this.syncRuns.length > 500) this.syncRuns.length = 500;
    return run;
  }

  async completeSyncRun(
    runId: string,
    result: {
      status: "completed" | "failed" | "partial";
      recordsAdded?: number;
      recordsUpdated?: number;
      recordsSkipped?: number;
      bytesTransferred?: number;
      errorMessage?: string;
      categoriesSynced?: AggregationDataCategory[];
    }
  ): Promise<DataSyncRun | undefined> {
    const run = this.syncRuns.find(r => r.id === runId);
    if (!run) return undefined;

    run.status = result.status;
    run.finishedAt = new Date().toISOString();
    run.recordsAdded = result.recordsAdded ?? 0;
    run.recordsUpdated = result.recordsUpdated ?? 0;
    run.recordsSkipped = result.recordsSkipped ?? 0;
    run.bytesTransferred = result.bytesTransferred ?? 0;
    run.errorMessage = result.errorMessage || null;
    run.categoriesSynced = result.categoriesSynced || [];
    return run;
  }

  async getSyncRuns(filters: {
    patientId?: string;
    sourceId?: string;
    status?: string;
    trigger?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ runs: DataSyncRun[]; total: number }> {
    let runs = [...this.syncRuns];
    if (filters.patientId) runs = runs.filter(r => r.patientId === filters.patientId);
    if (filters.sourceId) runs = runs.filter(r => r.sourceId === filters.sourceId);
    if (filters.status) runs = runs.filter(r => r.status === filters.status);
    if (filters.trigger) runs = runs.filter(r => r.trigger === filters.trigger);
    const total = runs.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || 25;
    return { runs: runs.slice(offset, offset + limit), total };
  }

  async getSourceHealth(sourceId?: string): Promise<DataSourceHealth[]> {
    if (sourceId) {
      const health = this.sourceHealth.get(sourceId);
      return health ? [health] : [];
    }
    return Array.from(this.sourceHealth.values());
  }

  async updateSourceHealth(
    sourceId: string,
    update: Partial<Pick<DataSourceHealth, "status" | "lastError" | "avgResponseTimeMs">>
  ): Promise<DataSourceHealth | undefined> {
    const health = this.sourceHealth.get(sourceId);
    if (!health) return undefined;

    const now = new Date().toISOString();
    health.lastHeartbeatAt = now;
    health.updatedAt = now;

    if (update.status) health.status = update.status;
    if (update.status === "healthy") {
      health.consecutiveFailures = 0;
      health.lastSuccessfulFetch = now;
    } else if (update.status === "unreachable" || update.status === "degraded") {
      health.consecutiveFailures++;
    }
    if (update.lastError !== undefined) health.lastError = update.lastError;
    if (update.avgResponseTimeMs !== undefined) health.avgResponseTimeMs = update.avgResponseTimeMs;

    const cacheEntries = Array.from(this.cacheEntries.values()).filter(e => e.sourceId === sourceId);
    health.totalRecordsCached = cacheEntries.reduce((sum, e) => sum + e.recordCount, 0);
    health.objectStorageSizeBytes = cacheEntries.reduce((sum, e) => e.objectStorageKey ? sum + e.payloadSizeBytes : sum, 0);

    return health;
  }

  async getDashboard(): Promise<DataAggregationDashboard> {
    const sources = Array.from(this.sourceHealth.values());
    const entries = Array.from(this.cacheEntries.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 3600 * 1000;

    const freshEntries = entries.filter(e => e.cacheStatus === "fresh").length;
    const staleEntries = entries.filter(e => e.cacheStatus === "stale" || e.cacheStatus === "expired").length;
    const errorEntries = entries.filter(e => e.cacheStatus === "error").length;
    const totalSizeBytes = entries.reduce((sum, e) => sum + e.payloadSizeBytes, 0);
    const objectStorageSizeBytes = entries.filter(e => e.objectStorageKey).reduce((sum, e) => sum + e.payloadSizeBytes, 0);

    const recentRuns = this.syncRuns.filter(r => new Date(r.startedAt).getTime() > oneDayAgo);
    const completedRuns = this.syncRuns.filter(r => r.status === "completed" || r.status === "partial");
    const failedRuns = this.syncRuns.filter(r => r.status === "failed");
    const avgDuration = completedRuns.length > 0
      ? completedRuns.reduce((sum, r) => {
          const dur = r.finishedAt ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime() : 0;
          return sum + dur;
        }, 0) / completedRuns.length
      : 0;

    const patientIds = new Set(entries.map(e => e.patientId));
    const freshPatients = new Set(entries.filter(e => e.cacheStatus === "fresh").map(e => e.patientId));

    return {
      sources,
      cacheStats: {
        totalEntries: entries.length,
        freshEntries,
        staleEntries,
        errorEntries,
        totalSizeBytes,
        objectStorageSizeBytes,
      },
      syncStats: {
        totalRuns: this.syncRuns.length,
        last24Hours: recentRuns.length,
        successRate: this.syncRuns.length > 0
          ? Math.round((completedRuns.length / (completedRuns.length + failedRuns.length)) * 100)
          : 100,
        avgDurationMs: Math.round(avgDuration),
        lastSyncAt: this.syncRuns.length > 0 ? this.syncRuns[0].startedAt : null,
      },
      recentSyncs: this.syncRuns.slice(0, 10),
      patientCoverage: {
        totalPatients: patientIds.size,
        patientsWithFreshData: freshPatients.size,
        patientsNeedingRefresh: patientIds.size - freshPatients.size,
      },
    };
  }

  async deleteCacheEntry(id: string): Promise<boolean> {
    for (const [key, entry] of Array.from(this.cacheEntries.entries())) {
      if (entry.id === id) {
        this.cacheEntries.delete(key);
        return true;
      }
    }
    return false;
  }

  async purgeExpired(): Promise<number> {
    let count = 0;
    for (const [key, entry] of Array.from(this.cacheEntries.entries())) {
      if (this.isExpired(entry) && entry.cacheStatus !== "refreshing") {
        this.cacheEntries.delete(key);
        count++;
      }
    }
    return count;
  }

  private startCacheExpiryChecker() {
    setInterval(() => {
      this.invalidateByVisitDate();
      let expired = 0;
      for (const entry of Array.from(this.cacheEntries.values())) {
        if (this.isExpired(entry) && entry.cacheStatus === "fresh") {
          entry.cacheStatus = "stale";
          entry.updatedAt = new Date().toISOString();
          expired++;
        }
      }
      if (expired > 0) {
        console.log(`[DataCacheService] Marked ${expired} entries as stale (TTL expired)`);
      }
    }, 60 * 1000);
  }

  private initializeSampleData() {
    const now = new Date();

    const sampleSources: Omit<DataSourceHealth, "createdAt" | "updatedAt">[] = [
      {
        id: "src-epic-fhir",
        sourceType: "fhir",
        sourceId: "epic-mychart",
        sourceName: "Fasten Health (FHIR R4)",
        status: "healthy",
        lastHeartbeatAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        lastSuccessfulFetch: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        avgResponseTimeMs: 342,
        uptime24h: 99.8,
        patientsConnected: 3,
        totalRecordsCached: 47,
        objectStorageSizeBytes: 2_458_000,
        metadata: { fhirVersion: "R4", authMethod: "SMART on FHIR" },
      },
      {
        id: "src-cerner-fhir",
        sourceType: "fhir",
        sourceId: "oracle-health-cerner",
        sourceName: "Hospital Network",
        status: "healthy",
        lastHeartbeatAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
        lastSuccessfulFetch: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        avgResponseTimeMs: 518,
        uptime24h: 99.2,
        patientsConnected: 2,
        totalRecordsCached: 31,
        objectStorageSizeBytes: 1_890_000,
        metadata: { fhirVersion: "R4", authMethod: "SMART on FHIR" },
      },
      {
        id: "src-cms-bb",
        sourceType: "cms_bluebutton",
        sourceId: "cms-bluebutton-2",
        sourceName: "CMS Blue Button 2.0",
        status: "degraded",
        lastHeartbeatAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        lastSuccessfulFetch: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
        lastError: "Rate limit exceeded (429)",
        consecutiveFailures: 2,
        avgResponseTimeMs: 1250,
        uptime24h: 94.5,
        patientsConnected: 2,
        totalRecordsCached: 18,
        objectStorageSizeBytes: 4_200_000,
        metadata: { apiVersion: "v2", dataTypes: ["claims", "coverage", "patient"] },
      },
      {
        id: "src-fasten-health",
        sourceType: "aggregator",
        sourceId: "fasten-health",
        sourceName: "Fasten Health (Quest/LabCorp)",
        status: "healthy",
        lastHeartbeatAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
        lastSuccessfulFetch: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        avgResponseTimeMs: 420,
        uptime24h: 99.5,
        patientsConnected: 3,
        totalRecordsCached: 22,
        objectStorageSizeBytes: 850_000,
        metadata: { labPartners: ["Quest Diagnostics", "LabCorp"] },
      },
      {
        id: "src-wearable",
        sourceType: "wearable",
        sourceId: "apple-healthkit",
        sourceName: "Apple HealthKit",
        status: "healthy",
        lastHeartbeatAt: new Date(now.getTime() - 1 * 60 * 1000).toISOString(),
        lastSuccessfulFetch: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        lastError: null,
        consecutiveFailures: 0,
        avgResponseTimeMs: 95,
        uptime24h: 100,
        patientsConnected: 2,
        totalRecordsCached: 156,
        objectStorageSizeBytes: 320_000,
        metadata: { syncMethod: "push", dataTypes: ["vitals", "activity", "sleep"] },
      },
    ];

    for (const src of sampleSources) {
      this.sourceHealth.set(src.sourceId, {
        ...src,
        createdAt: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(),
        updatedAt: src.lastHeartbeatAt || now.toISOString(),
      });
    }

    const sampleEntries: Array<{
      insert: InsertDataCacheEntry;
      status: DataCacheStatus;
      lastFetched: Date;
      recordCount: number;
      sizeBytes: number;
      objectKey?: string;
    }> = [
      { insert: { patientId: "patient-001", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider", dataCategory: "labs" }, status: "fresh", lastFetched: new Date(now.getTime() - 15 * 60 * 1000), recordCount: 12, sizeBytes: 45_200 },
      { insert: { patientId: "patient-001", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider", dataCategory: "medications" }, status: "fresh", lastFetched: new Date(now.getTime() - 15 * 60 * 1000), recordCount: 5, sizeBytes: 18_300 },
      { insert: { patientId: "patient-001", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider", dataCategory: "conditions" }, status: "stale", lastFetched: new Date(now.getTime() - 6 * 3600 * 1000), recordCount: 8, sizeBytes: 12_000 },
      { insert: { patientId: "patient-001", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider", dataCategory: "documents" }, status: "fresh", lastFetched: new Date(now.getTime() - 30 * 60 * 1000), recordCount: 3, sizeBytes: 2_100_000, objectKey: "patient-001/epic/documents/bundle-2026-02.json" },
      { insert: { patientId: "patient-001", sourceType: "aggregator", sourceId: "fasten-health", sourceName: "Fasten Health", dataCategory: "labs" }, status: "fresh", lastFetched: new Date(now.getTime() - 45 * 60 * 1000), recordCount: 8, sizeBytes: 32_000 },
      { insert: { patientId: "patient-002", sourceType: "fhir", sourceId: "oracle-health-cerner", sourceName: "Hospital Network", dataCategory: "labs" }, status: "fresh", lastFetched: new Date(now.getTime() - 25 * 60 * 1000), recordCount: 15, sizeBytes: 58_000 },
      { insert: { patientId: "patient-002", sourceType: "fhir", sourceId: "oracle-health-cerner", sourceName: "Hospital Network", dataCategory: "medications" }, status: "stale", lastFetched: new Date(now.getTime() - 10 * 3600 * 1000), recordCount: 7, sizeBytes: 24_000 },
      { insert: { patientId: "patient-002", sourceType: "cms_bluebutton", sourceId: "cms-bluebutton-2", sourceName: "CMS Blue Button 2.0", dataCategory: "claims" }, status: "error", lastFetched: new Date(now.getTime() - 3 * 3600 * 1000), recordCount: 0, sizeBytes: 0 },
      { insert: { patientId: "patient-003", sourceType: "wearable", sourceId: "apple-healthkit", sourceName: "Apple HealthKit", dataCategory: "vitals" }, status: "fresh", lastFetched: new Date(now.getTime() - 10 * 60 * 1000), recordCount: 48, sizeBytes: 15_000 },
      { insert: { patientId: "patient-003", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider", dataCategory: "immunizations" }, status: "fresh", lastFetched: new Date(now.getTime() - 2 * 3600 * 1000), recordCount: 12, sizeBytes: 9_800 },
      { insert: { patientId: "patient-004", sourceType: "cms_bluebutton", sourceId: "cms-bluebutton-2", sourceName: "CMS Blue Button 2.0", dataCategory: "claims" }, status: "fresh", lastFetched: new Date(now.getTime() - 1 * 3600 * 1000), recordCount: 18, sizeBytes: 4_200_000, objectKey: "patient-004/cms/claims/bundle-2026-Q1.json" },
    ];

    for (const s of sampleEntries) {
      const key = this.getCacheKey(s.insert.patientId, s.insert.sourceId, s.insert.dataCategory);
      const ttl = DEFAULT_TTL_BY_CATEGORY[s.insert.dataCategory];
      this.cacheEntries.set(key, {
        id: randomUUID(),
        ...s.insert,
        cacheStatus: s.status,
        lastFetchedAt: s.lastFetched.toISOString(),
        lastVisitDate: null,
        expiresAt: new Date(s.lastFetched.getTime() + ttl * 1000).toISOString(),
        ttlSeconds: ttl,
        etag: null,
        fingerprintHash: this.computeFingerprint({ sample: true, category: s.insert.dataCategory }),
        objectStorageKey: s.objectKey || null,
        payloadSizeBytes: s.sizeBytes,
        recordCount: s.recordCount,
        errorMessage: s.status === "error" ? "Rate limit exceeded - retry after cooldown" : null,
        metadata: s.insert.metadata || {},
        createdAt: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
        updatedAt: s.lastFetched.toISOString(),
      });
    }

    const sampleRuns: DataSyncRun[] = [
      {
        id: randomUUID(), patientId: "patient-001", sourceType: "fhir", sourceId: "epic-mychart", sourceName: "Primary Care Provider",
        trigger: "scheduled", status: "completed", startedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 14 * 60 * 1000).toISOString(), recordsAdded: 3, recordsUpdated: 2, recordsSkipped: 12,
        bytesTransferred: 75_500, errorMessage: null, categoriesSynced: ["labs", "medications"], metadata: {},
      },
      {
        id: randomUUID(), patientId: "patient-002", sourceType: "fhir", sourceId: "oracle-health-cerner", sourceName: "Hospital Network",
        trigger: "scheduled", status: "completed", startedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 24 * 60 * 1000).toISOString(), recordsAdded: 1, recordsUpdated: 0, recordsSkipped: 14,
        bytesTransferred: 58_000, errorMessage: null, categoriesSynced: ["labs"], metadata: {},
      },
      {
        id: randomUUID(), patientId: "patient-002", sourceType: "cms_bluebutton", sourceId: "cms-bluebutton-2", sourceName: "CMS Blue Button 2.0",
        trigger: "manual", status: "failed", startedAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 3 * 3600 * 1000 + 5000).toISOString(), recordsAdded: 0, recordsUpdated: 0, recordsSkipped: 0,
        bytesTransferred: 0, errorMessage: "HTTP 429: Rate limit exceeded", categoriesSynced: [], metadata: {},
      },
      {
        id: randomUUID(), patientId: "patient-003", sourceType: "wearable", sourceId: "apple-healthkit", sourceName: "Apple HealthKit",
        trigger: "webhook", status: "completed", startedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 9.5 * 60 * 1000).toISOString(), recordsAdded: 48, recordsUpdated: 0, recordsSkipped: 0,
        bytesTransferred: 15_000, errorMessage: null, categoriesSynced: ["vitals"], metadata: {},
      },
      {
        id: randomUUID(), patientId: "patient-001", sourceType: "aggregator", sourceId: "fasten-health", sourceName: "Fasten Health",
        trigger: "scheduled", status: "completed", startedAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
        finishedAt: new Date(now.getTime() - 44 * 60 * 1000).toISOString(), recordsAdded: 2, recordsUpdated: 1, recordsSkipped: 5,
        bytesTransferred: 32_000, errorMessage: null, categoriesSynced: ["labs"], metadata: {},
      },
    ];
    this.syncRuns = sampleRuns;
  }
}

export const dataCacheService = new DataCacheService();
