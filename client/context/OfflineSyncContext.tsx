/**
 * OfflineSyncContext — React context for offline-first operation
 *
 * Provides components with:
 *   - isOnline / isOffline status
 *   - pendingSync count (badge on sync button)
 *   - triggerSync() — manual sync
 *   - offlineReady — true once DB is initialized and FIPS self-test passed
 *
 * Usage:
 *   const { isOnline, pendingSync, offlineReady } = useOfflineSync();
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode
} from "react";
import {
  initOfflineDatabase, startNetworkMonitor, syncOfflineQueue,
  getPendingCount, getOfflineStats, type NetworkStatus
} from "../lib/offline-database";

interface OfflineSyncContextType {
  isOnline: boolean;
  isOfflineReady: boolean;
  pendingSync: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  networkType: string;
  triggerSync: () => Promise<void>;
  offlineStats: Awaited<ReturnType<typeof getOfflineStats>> | null;
  fipsPassed: boolean;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: false,
  isOfflineReady: false,
  pendingSync: 0,
  isSyncing: false,
  lastSyncAt: null,
  networkType: "unknown",
  triggerSync: async () => {},
  offlineStats: null,
  fipsPassed: false,
});

interface OfflineSyncProviderProps {
  children: ReactNode;
  apiBaseUrl: string;
  getAuthToken: () => Promise<string | null>;
  userSecret: string;
}

export function OfflineSyncProvider({
  children,
  apiBaseUrl,
  getAuthToken,
  userSecret,
}: OfflineSyncProviderProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [networkType, setNetworkType] = useState("unknown");
  const [offlineStats, setOfflineStats] = useState<Awaited<ReturnType<typeof getOfflineStats>> | null>(null);
  const [fipsPassed, setFipsPassed] = useState(false);

  const syncLockRef = useRef(false);

  // Initialize DB on mount
  useEffect(() => {
    (async () => {
      try {
        await initOfflineDatabase(userSecret);
        const stats = await getOfflineStats();
        setFipsPassed(stats.fipsSelfTest.passed);
        setOfflineStats(stats);
        setPendingSync(stats.pendingSync);
        setIsOfflineReady(true);
      } catch (err) {
        console.error("[OfflineSync] Init failed:", err);
        setFipsPassed(false);
      }
    })();
  }, [userSecret]);

  const doSync = useCallback(async () => {
    if (syncLockRef.current || !isOnline || !isOfflineReady) return;
    syncLockRef.current = true;
    setIsSyncing(true);

    try {
      const token = await getAuthToken();
      if (!token) return;
      await syncOfflineQueue(apiBaseUrl, token);
      const stats = await getOfflineStats();
      setPendingSync(stats.pendingSync);
      setOfflineStats(stats);
      setLastSyncAt(new Date().toISOString());
    } catch (err) {
      console.error("[OfflineSync] Sync error:", err);
    } finally {
      syncLockRef.current = false;
      setIsSyncing(false);
    }
  }, [isOnline, isOfflineReady, apiBaseUrl, getAuthToken]);

  // Network monitor
  useEffect(() => {
    // Single subscription — handles both state updates and reconnect sync
    const unsubscribe = startNetworkMonitor((status: NetworkStatus) => {
      const prevOnline = isOnline;
      setIsOnline(status.isConnected && (status.isInternetReachable ?? true));
      setNetworkType(status.type);
      // Auto-sync on reconnect
      if (!prevOnline && status.isConnected && (status.isInternetReachable ?? true)) {
        doSync();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [doSync]);

  // Refresh pending count every 30s
  useEffect(() => {
    if (!isOfflineReady) return;
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingSync(count);
    }, 30_000);
    return () => clearInterval(interval);
  }, [isOfflineReady]);

  return (
    <OfflineSyncContext.Provider value={{
      isOnline,
      isOfflineReady,
      pendingSync,
      isSyncing,
      lastSyncAt,
      networkType,
      triggerSync: doSync,
      offlineStats,
      fipsPassed,
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  return ctx;
}
