import crypto from "crypto";

export interface CacheEntry<T> {
  key: string;
  data: T;
  fetchedAt: Date;
  expiresAt: Date;
  lastVisitDate?: Date;
  etag?: string;
  sourceMetadata: {
    sourceId: string;
    resourceType: string;
    userId: string;
    sourceName?: string;
    sourceType?: string;
  };
  lastAccessedAt: Date;
  needsRefresh: boolean;
}

export interface CacheConfig {
  maxSize: number;
  evictionPolicy: "lru";
  ttlByResourceType: Record<string, number>;
  defaultTtlMs: number;
  pruneIntervalMs: number;
}

export interface CacheStats {
  hitCount: number;
  missCount: number;
  evictionCount: number;
  entryCount: number;
  hitRate: number;
}

export interface InvalidationRule {
  id: string;
  resourceType?: string;
  sourceId?: string;
  reason: string;
  condition: "visit_after_cache" | "manual" | "ttl_expired" | "source_updated";
  createdAt: Date;
}

export interface DataSourceSync {
  sourceId: string;
  userId: string;
  lastSyncAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  syncStatus: "idle" | "syncing" | "success" | "failed";
  errorMessage?: string;
  resourceTypes: string[];
}

const DEFAULT_TTL_MS: Record<string, number> = {
  labs: 1 * 60 * 60 * 1000,
  medications: 4 * 60 * 60 * 1000,
  conditions: 24 * 60 * 60 * 1000,
  documents: 12 * 60 * 60 * 1000,
  demographics: 48 * 60 * 60 * 1000,
};

const DEFAULT_TTL_FALLBACK_MS = 2 * 60 * 60 * 1000;

class DataAggregationCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private stats: { hitCount: number; missCount: number; evictionCount: number };
  private pruneTimer: ReturnType<typeof setInterval>;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 10000,
      evictionPolicy: config?.evictionPolicy ?? "lru",
      ttlByResourceType: config?.ttlByResourceType ?? { ...DEFAULT_TTL_MS },
      defaultTtlMs: config?.defaultTtlMs ?? DEFAULT_TTL_FALLBACK_MS,
      pruneIntervalMs: config?.pruneIntervalMs ?? 5 * 60 * 1000,
    };

    this.stats = { hitCount: 0, missCount: 0, evictionCount: 0 };

    this.pruneTimer = setInterval(() => {
      this.pruneExpired();
    }, this.config.pruneIntervalMs);

    if (this.pruneTimer.unref) {
      this.pruneTimer.unref();
    }

    console.log(`[DataCache] Initialized with maxSize=${this.config.maxSize}, pruneInterval=${this.config.pruneIntervalMs}ms`);
  }

  get<T>(userId: string, sourceId: string, resourceType: string): CacheEntry<T> | null {
    const key = this.buildKey(userId, sourceId, resourceType);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.missCount++;
      return null;
    }

    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.missCount++;
      console.log(`[DataCache] Expired entry removed: ${key}`);
      return null;
    }

    if (entry.needsRefresh) {
      this.stats.missCount++;
      return null;
    }

    entry.lastAccessedAt = new Date();
    this.touchAccessOrder(key);
    this.stats.hitCount++;
    return entry;
  }

  set<T>(
    userId: string,
    sourceId: string,
    resourceType: string,
    data: T,
    options?: {
      ttlMs?: number;
      etag?: string;
      lastVisitDate?: Date;
      sourceName?: string;
      sourceType?: string;
    }
  ): void {
    const key = this.buildKey(userId, sourceId, resourceType);

    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttlMs =
      options?.ttlMs ??
      this.config.ttlByResourceType[resourceType] ??
      this.config.defaultTtlMs;

    const now = new Date();
    const entry: CacheEntry<T> = {
      key,
      data,
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      lastVisitDate: options?.lastVisitDate,
      etag: options?.etag,
      sourceMetadata: {
        sourceId,
        resourceType,
        userId,
        sourceName: options?.sourceName,
        sourceType: options?.sourceType,
      },
      lastAccessedAt: now,
      needsRefresh: false,
    };

    this.cache.set(key, entry as CacheEntry<unknown>);
    this.touchAccessOrder(key);
    console.log(`[DataCache] Set entry: ${key}, TTL=${ttlMs}ms, expires=${entry.expiresAt.toISOString()}`);
  }

  invalidate(userId: string, sourceId?: string, resourceType?: string): number {
    let count = 0;
    const prefix = sourceId
      ? resourceType
        ? this.buildKey(userId, sourceId, resourceType)
        : `${userId}:${sourceId}:`
      : `${userId}:`;

    for (const key of Array.from(this.cache.keys())) {
      if (resourceType && sourceId) {
        if (key === prefix) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          count++;
        }
      } else if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        count++;
      }
    }

    console.log(`[DataCache] Invalidated ${count} entries for userId=${userId}, sourceId=${sourceId ?? "all"}, resourceType=${resourceType ?? "all"}`);
    return count;
  }

  invalidateByLastVisit(userId: string, sourceId: string, lastVisitDate: Date): number {
    let count = 0;
    const prefix = `${userId}:${sourceId}:`;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (key.startsWith(prefix)) {
        if (lastVisitDate > entry.fetchedAt) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          count++;
        }
      }
    }

    console.log(`[DataCache] Smart invalidation: ${count} entries invalidated for userId=${userId}, sourceId=${sourceId}, visitDate=${lastVisitDate.toISOString()}`);
    return count;
  }

  manualRefresh(userId: string, sourceId?: string): number {
    let count = 0;
    const prefix = sourceId ? `${userId}:${sourceId}:` : `${userId}:`;

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        entry.needsRefresh = true;
        count++;
      }
    }

    console.log(`[DataCache] Marked ${count} entries for refresh: userId=${userId}, sourceId=${sourceId ?? "all"}`);
    return count;
  }

  getStats(): CacheStats {
    const total = this.stats.hitCount + this.stats.missCount;
    return {
      hitCount: this.stats.hitCount,
      missCount: this.stats.missCount,
      evictionCount: this.stats.evictionCount,
      entryCount: this.cache.size,
      hitRate: total > 0 ? this.stats.hitCount / total : 0,
    };
  }

  getCacheStatus(userId: string): Array<{
    sourceId: string;
    resourceType: string;
    status: "cached" | "stale" | "missing";
    fetchedAt?: Date;
    expiresAt?: Date;
    needsRefresh: boolean;
  }> {
    const results: Array<{
      sourceId: string;
      resourceType: string;
      status: "cached" | "stale" | "missing";
      fetchedAt?: Date;
      expiresAt?: Date;
      needsRefresh: boolean;
    }> = [];

    const prefix = `${userId}:`;
    const now = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        const isExpired = now > entry.expiresAt;
        results.push({
          sourceId: entry.sourceMetadata.sourceId,
          resourceType: entry.sourceMetadata.resourceType,
          status: isExpired || entry.needsRefresh ? "stale" : "cached",
          fetchedAt: entry.fetchedAt,
          expiresAt: entry.expiresAt,
          needsRefresh: entry.needsRefresh,
        });
      }
    }

    return results;
  }

  pruneExpired(): number {
    const now = new Date();
    let count = 0;

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[DataCache] Pruned ${count} expired entries, remaining=${this.cache.size}`);
    }

    return count;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.stats = { hitCount: 0, missCount: 0, evictionCount: 0 };
    console.log(`[DataCache] Cleared ${size} entries`);
  }

  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const oldestKey = this.accessOrder.shift()!;
    this.cache.delete(oldestKey);
    this.stats.evictionCount++;
    console.log(`[DataCache] LRU eviction: ${oldestKey}`);
  }

  private buildKey(userId: string, sourceId: string, resourceType: string): string {
    return `${userId}:${sourceId}:${resourceType}`;
  }

  private touchAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
  }
}

export const dataAggregationCache = new DataAggregationCache();
