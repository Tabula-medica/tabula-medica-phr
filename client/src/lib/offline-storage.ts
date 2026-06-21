const DB_NAME = 'tabula-medica-offline';
const DB_VERSION = 1;

interface CachedData {
  key: string;
  data: unknown;
  timestamp: number;
  expiresAt?: number;
}

interface ConnectionStatus {
  sourceId: string;
  sourceName: string;
  status: 'connected' | 'expired' | 'error' | 'disconnected';
  lastSync: number;
  errorMessage?: string;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<IDBDatabase>;

  constructor() {
    this.dbReady = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('connections')) {
          const connStore = db.createObjectStore('connections', { keyPath: 'sourceId' });
          connStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveToCache(key: string, data: unknown, ttlMs?: number): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('cache', 'readwrite');
      const store = transaction.objectStore('cache');
      
      const cacheEntry: CachedData = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      };

      const request = store.put(cacheEntry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFromCache<T>(key: string): Promise<{ data: T; timestamp: number } | null> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('cache', 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CachedData | undefined;
        if (!result) {
          resolve(null);
          return;
        }

        if (result.expiresAt && result.expiresAt < Date.now()) {
          this.removeFromCache(key);
          resolve(null);
          return;
        }

        resolve({ data: result.data as T, timestamp: result.timestamp });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromCache(key: string): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('cache', 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveConnectionStatus(status: ConnectionStatus): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('connections', 'readwrite');
      const store = transaction.objectStore('connections');
      const request = store.put(status);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getConnectionStatus(sourceId: string): Promise<ConnectionStatus | null> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('connections', 'readonly');
      const store = transaction.objectStore('connections');
      const request = store.get(sourceId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllConnectionStatuses(): Promise<ConnectionStatus[]> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('connections', 'readonly');
      const store = transaction.objectStore('connections');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async addToSyncQueue(action: { type: string; payload: unknown }): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add({ ...action, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<Array<{ id: number; type: string; payload: unknown; timestamp: number }>> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncQueue(): Promise<void> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('syncQueue', 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLastUpdated(key: string): Promise<Date | null> {
    const cached = await this.getFromCache(key);
    return cached ? new Date(cached.timestamp) : null;
  }

  async getCacheStats(): Promise<{ totalItems: number; oldestTimestamp: number | null }> {
    const db = await this.dbReady;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('cache', 'readonly');
      const store = transaction.objectStore('cache');
      const index = store.index('timestamp');
      
      let totalItems = 0;
      let oldestTimestamp: number | null = null;

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        totalItems = countRequest.result;
      };

      const cursorRequest = index.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && oldestTimestamp === null) {
          oldestTimestamp = cursor.value.timestamp;
        }
        resolve({ totalItems, oldestTimestamp });
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();

export function formatLastUpdated(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

export type { ConnectionStatus, CachedData };
