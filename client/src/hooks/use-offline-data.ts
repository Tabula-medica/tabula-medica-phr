import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOnlineStatus, useOfflineCache } from './use-offline';
import { offlineStorage, type ConnectionStatus } from '@/lib/offline-storage';

export function useOfflineTimeline() {
  const isOnline = useOnlineStatus();
  const {
    cachedData,
    lastUpdated,
    lastUpdatedFormatted,
    isUsingCache,
    saveToCache,
  } = useOfflineCache<unknown[]>('timeline-snapshot');

  const { data: onlineData, isLoading } = useQuery({
    queryKey: ['/api/timeline'],
    enabled: isOnline,
  });

  useEffect(() => {
    if (isOnline && onlineData && Array.isArray(onlineData)) {
      saveToCache(onlineData);
    }
  }, [isOnline, onlineData, saveToCache]);

  return {
    data: isOnline ? onlineData : cachedData,
    isLoading: isOnline ? isLoading : false,
    isUsingCache,
    lastUpdated,
    lastUpdatedFormatted,
  };
}

export function useOfflineDashboard() {
  const isOnline = useOnlineStatus();
  const {
    cachedData,
    lastUpdated,
    lastUpdatedFormatted,
    isUsingCache,
    saveToCache,
  } = useOfflineCache<unknown>('dashboard-snapshot');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    enabled: isOnline,
  });

  useEffect(() => {
    if (isOnline && statsData) {
      saveToCache(statsData);
    }
  }, [isOnline, statsData, saveToCache]);

  return {
    stats: isOnline ? statsData : cachedData,
    isLoading: isOnline ? statsLoading : false,
    isUsingCache,
    lastUpdated,
    lastUpdatedFormatted,
  };
}

export function useGlobalConnectionStatus() {
  const isOnline = useOnlineStatus();

  const { data: connectionStatusesApi, refetch } = useQuery<ConnectionStatus[]>({
    queryKey: ['/api/connections/status'],
    enabled: isOnline,
    refetchInterval: isOnline ? 60000 : false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (connectionStatusesApi) {
      connectionStatusesApi.forEach((status) => {
        offlineStorage.saveConnectionStatus(status);
      });
    }
  }, [connectionStatusesApi]);

  const getExpiredConnections = useCallback(() => {
    return connectionStatusesApi?.filter(s => s.status === 'expired') || [];
  }, [connectionStatusesApi]);

  const hasExpiredConnections = useCallback(() => {
    return getExpiredConnections().length > 0;
  }, [getExpiredConnections]);

  return {
    statuses: connectionStatusesApi || [],
    isOnline,
    getExpiredConnections,
    hasExpiredConnections,
    refetch,
  };
}
