import { useState, useEffect, useCallback } from 'react';
import { offlineStorage, formatLastUpdated, type ConnectionStatus } from '@/lib/offline-storage';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineCache<T>(cacheKey: string) {
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isOnline = useOnlineStatus();

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await offlineStorage.getFromCache<T>(cacheKey);
      if (cached) {
        setCachedData(cached.data);
        setLastUpdated(cached.timestamp);
      }
    } catch (error) {
      console.error('Failed to load from cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  const saveToCache = useCallback(async (data: T) => {
    try {
      await offlineStorage.saveToCache(cacheKey, data);
      setCachedData(data);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Failed to save to cache:', error);
    }
  }, [cacheKey]);

  const clearCache = useCallback(async () => {
    try {
      await offlineStorage.removeFromCache(cacheKey);
      setCachedData(null);
      setLastUpdated(null);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [cacheKey]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  return {
    cachedData,
    lastUpdated,
    lastUpdatedFormatted: lastUpdated ? formatLastUpdated(lastUpdated) : null,
    isLoading,
    isOnline,
    isUsingCache: !isOnline && cachedData !== null,
    saveToCache,
    clearCache,
    refreshCache: loadFromCache,
  };
}

export function useConnectionStatuses() {
  const [statuses, setStatuses] = useState<ConnectionStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStatuses = useCallback(async () => {
    try {
      const allStatuses = await offlineStorage.getAllConnectionStatuses();
      setStatuses(allStatuses);
    } catch (error) {
      console.error('Failed to load connection statuses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateStatus = useCallback(async (status: ConnectionStatus) => {
    try {
      await offlineStorage.saveConnectionStatus(status);
      setStatuses(prev => {
        const existing = prev.findIndex(s => s.sourceId === status.sourceId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = status;
          return updated;
        }
        return [...prev, status];
      });
    } catch (error) {
      console.error('Failed to update connection status:', error);
    }
  }, []);

  const getExpiredConnections = useCallback(() => {
    return statuses.filter(s => s.status === 'expired');
  }, [statuses]);

  const getErrorConnections = useCallback(() => {
    return statuses.filter(s => s.status === 'error');
  }, [statuses]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

  return {
    statuses,
    isLoading,
    updateStatus,
    getExpiredConnections,
    getErrorConnections,
    refresh: loadStatuses,
  };
}

export function useSyncQueue() {
  const [queue, setQueue] = useState<Array<{ id: number; type: string; payload: unknown; timestamp: number }>>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  const loadQueue = useCallback(async () => {
    try {
      const items = await offlineStorage.getSyncQueue();
      setQueue(items);
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }, []);

  const addToQueue = useCallback(async (type: string, payload: unknown) => {
    try {
      await offlineStorage.addToSyncQueue({ type, payload });
      await loadQueue();
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
    }
  }, [loadQueue]);

  const processQueue = useCallback(async (processor: (item: { type: string; payload: unknown }) => Promise<boolean>) => {
    if (!isOnline || isSyncing || queue.length === 0) return;

    setIsSyncing(true);
    try {
      for (const item of queue) {
        const success = await processor({ type: item.type, payload: item.payload });
        if (success) {
          await offlineStorage.removeFromSyncQueue(item.id);
        }
      }
      await loadQueue();
    } catch (error) {
      console.error('Failed to process sync queue:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, queue, loadQueue]);

  const clearQueue = useCallback(async () => {
    try {
      await offlineStorage.clearSyncQueue();
      setQueue([]);
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return {
    queue,
    queueLength: queue.length,
    isSyncing,
    isOnline,
    addToQueue,
    processQueue,
    clearQueue,
    refresh: loadQueue,
  };
}
