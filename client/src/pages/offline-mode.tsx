import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { OfflineIndicator, OfflineBanner } from '@/components/offline-indicator';
import { useOnlineStatus, useOfflineCache, useSyncQueue } from '@/hooks/use-offline';
import { offlineStorage, formatLastUpdated, type ConnectionStatus } from '@/lib/offline-storage';
import { apiRequest } from '@/lib/queryClient';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Database, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Trash2,
  Download,
  Activity,
  FileText,
  Pill,
  Heart,
  Calendar
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  description?: string;
}

interface DashboardSnapshot {
  medications: Array<{ id: string; name: string; dosage: string }>;
  conditions: Array<{ id: string; name: string; status: string }>;
  upcomingAppointments: Array<{ id: string; date: string; provider: string }>;
}

export default function OfflineModePage() {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionStatuses, setConnectionStatuses] = useState<ConnectionStatus[]>([]);

  const { 
    cachedData: timelineCache, 
    lastUpdated: timelineLastUpdated,
    saveToCache: saveTimeline,
    clearCache: clearTimeline,
  } = useOfflineCache<TimelineEvent[]>('timeline-snapshot');

  const { 
    cachedData: dashboardCache, 
    lastUpdated: dashboardLastUpdated,
    saveToCache: saveDashboard,
    clearCache: clearDashboard,
  } = useOfflineCache<DashboardSnapshot>('dashboard-snapshot');

  const { queueLength, isSyncing, processQueue, clearQueue } = useSyncQueue();

  const { data: connectionStatusesApi, refetch: refetchConnections } = useQuery({
    queryKey: ['/api/connections/status'],
    enabled: isOnline,
  });

  useEffect(() => {
    if (connectionStatusesApi) {
      setConnectionStatuses(connectionStatusesApi as ConnectionStatus[]);
      (connectionStatusesApi as ConnectionStatus[]).forEach((status: ConnectionStatus) => {
        offlineStorage.saveConnectionStatus(status);
      });
    }
  }, [connectionStatusesApi]);

  const refreshTimelineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/offline/timeline');
      return response.json();
    },
    onSuccess: (data) => {
      saveTimeline(data.data);
      toast({ title: 'Timeline Cached', description: 'Timeline snapshot saved for offline use' });
    },
    onError: () => {
      toast({ title: 'Cache Failed', description: 'Could not refresh timeline cache', variant: 'destructive' });
    },
  });

  const refreshDashboardMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/offline/dashboard');
      return response.json();
    },
    onSuccess: (data) => {
      saveDashboard(data.data);
      toast({ title: 'Dashboard Cached', description: 'Dashboard snapshot saved for offline use' });
    },
    onError: () => {
      toast({ title: 'Cache Failed', description: 'Could not refresh dashboard cache', variant: 'destructive' });
    },
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshTimelineMutation.mutateAsync(),
        refreshDashboardMutation.mutateAsync(),
        refetchConnections(),
      ]);
      toast({ title: 'All Data Cached', description: 'Your data is ready for offline use' });
    } catch {
      toast({ title: 'Partial Cache', description: 'Some data could not be cached', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await Promise.all([clearTimeline(), clearDashboard()]);
      toast({ title: 'Cache Cleared', description: 'Offline data has been removed' });
    } catch {
      toast({ title: 'Clear Failed', description: 'Could not clear cache', variant: 'destructive' });
    }
  };

  const handleReconnect = async (sourceId: string) => {
    try {
      const response = await apiRequest('POST', `/api/connections/${sourceId}/reconnect`);
      const data = await response.json();
      
      if (data.reconnectUrl) {
        window.open(data.reconnectUrl, '_blank');
        toast({ title: 'Reconnection Started', description: 'Complete authorization in the new window' });
      }
    } catch {
      toast({ title: 'Reconnect Failed', description: 'Could not start reconnection', variant: 'destructive' });
    }
  };

  const handleSyncNow = async () => {
    await processQueue(async (item) => {
      try {
        await apiRequest('POST', '/api/sync/process', { items: [item] });
        return true;
      } catch {
        return false;
      }
    });
    toast({ title: 'Sync Complete', description: 'Pending changes have been synced' });
  };

  const expiredConnections = connectionStatuses.filter(s => s.status === 'expired');
  const errorConnections = connectionStatuses.filter(s => s.status === 'error');
  const connectedSources = connectionStatuses.filter(s => s.status === 'connected');

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <OfflineBanner />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Offline Mode</h1>
        <p className="text-muted-foreground">
          Access your health records even without internet. Data is cached locally and syncs when you reconnect.
        </p>
      </div>

      <OfflineIndicator
        lastUpdated={Math.max(timelineLastUpdated || 0, dashboardLastUpdated || 0) || null}
        onReconnect={handleReconnect}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        pendingSyncCount={queueLength}
      />

      <div className="grid gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
              Connection Status
            </CardTitle>
            <CardDescription>
              {isOnline 
                ? 'You are connected to the internet' 
                : 'You are offline - viewing cached data'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={isOnline ? 'default' : 'secondary'}>
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
                {queueLength > 0 && (
                  <Badge variant="outline">
                    {queueLength} pending sync{queueLength !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {isOnline && (
                  <Button
                    onClick={handleRefreshAll}
                    disabled={isRefreshing}
                    data-testid="button-refresh-all-cache"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? 'Caching...' : 'Cache All Data'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {(expiredConnections.length > 0 || errorConnections.length > 0) && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Connection Issues
              </CardTitle>
              <CardDescription>
                Some data sources require attention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {expiredConnections.map((conn) => (
                <div 
                  key={conn.sourceId}
                  className="flex items-center justify-between p-3 bg-destructive/10 rounded-md"
                  data-testid={`expired-connection-${conn.sourceId}`}
                >
                  <div>
                    <p className="font-medium">{conn.sourceName}</p>
                    <p className="text-sm text-destructive">Token expired - reconnection required</p>
                    {conn.lastSync > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {formatLastUpdated(conn.lastSync)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReconnect(conn.sourceId)}
                    disabled={!isOnline}
                    data-testid={`button-reconnect-${conn.sourceId}`}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reconnect
                  </Button>
                </div>
              ))}
              
              {errorConnections.map((conn) => (
                <div 
                  key={conn.sourceId}
                  className="flex items-center justify-between p-3 bg-amber-500/10 rounded-md"
                  data-testid={`error-connection-${conn.sourceId}`}
                >
                  <div>
                    <p className="font-medium">{conn.sourceName}</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {conn.errorMessage || 'Connection error'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReconnect(conn.sourceId)}
                    disabled={!isOnline}
                    data-testid={`button-retry-${conn.sourceId}`}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cached Data
            </CardTitle>
            <CardDescription>
              Data stored locally for offline access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Timeline</span>
                  </div>
                  {timelineCache ? (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Cached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not cached</Badge>
                  )}
                </div>
                {timelineLastUpdated && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatLastUpdated(timelineLastUpdated)}
                  </p>
                )}
                {timelineCache && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {Array.isArray(timelineCache) ? timelineCache.length : 0} events
                  </p>
                )}
              </div>

              <div className="p-4 border rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Dashboard</span>
                  </div>
                  {dashboardCache ? (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Cached
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Not cached</Badge>
                  )}
                </div>
                {dashboardLastUpdated && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatLastUpdated(dashboardLastUpdated)}
                  </p>
                )}
                {dashboardCache && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">
                      <Pill className="h-3 w-3 mr-1" />
                      {dashboardCache.medications?.length || 0} meds
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Heart className="h-3 w-3 mr-1" />
                      {dashboardCache.conditions?.length || 0} conditions
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cache Management</p>
                <p className="text-xs text-muted-foreground">
                  Clear local data to free up storage
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                data-testid="button-clear-cache"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear Cache
              </Button>
            </div>
          </CardContent>
        </Card>

        {connectedSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                Connected Sources
              </CardTitle>
              <CardDescription>
                Data sources currently syncing with your records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {connectedSources.map((conn) => (
                  <div 
                    key={conn.sourceId}
                    className="flex items-center justify-between p-3 border rounded-md"
                    data-testid={`connected-source-${conn.sourceId}`}
                  >
                    <div>
                      <p className="font-medium">{conn.sourceName}</p>
                      {conn.lastSync > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {formatLastUpdated(conn.lastSync)}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              How Offline Mode Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Automatic Caching</p>
                <p>Your timeline and dashboard data are cached when you visit those pages while online.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <WifiOff className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Offline Access</p>
                <p>When you lose connectivity, the app automatically switches to cached data.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Automatic Sync</p>
                <p>Changes made offline are queued and synced when connectivity is restored.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Last Updated</p>
                <p>The "Last updated" timestamp shows when your cached data was last refreshed.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
