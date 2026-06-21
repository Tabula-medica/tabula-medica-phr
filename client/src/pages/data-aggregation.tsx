import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  RefreshCw,
  Cloud,
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Server,
  HardDrive,
  Zap,
  ArrowDownToLine,
  Wifi,
  WifiOff,
  Timer,
  FileText,
  Loader2,
} from "lucide-react";

interface SourceHealth {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  status: "healthy" | "degraded" | "unreachable" | "unknown";
  lastHeartbeatAt: string | null;
  lastSuccessfulFetch: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  avgResponseTimeMs: number;
  uptime24h: number;
  patientsConnected: number;
  totalRecordsCached: number;
  objectStorageSizeBytes: number;
  metadata: Record<string, unknown>;
}

interface CacheEntry {
  id: string;
  patientId: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  dataCategory: string;
  cacheStatus: string;
  lastFetchedAt: string | null;
  expiresAt: string | null;
  ttlSeconds: number;
  objectStorageKey: string | null;
  payloadSizeBytes: number;
  recordCount: number;
  errorMessage: string | null;
}

interface SyncRun {
  id: string;
  patientId: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  recordsAdded: number;
  recordsUpdated: number;
  recordsSkipped: number;
  bytesTransferred: number;
  errorMessage: string | null;
  categoriesSynced: string[];
}

interface Dashboard {
  sources: SourceHealth[];
  cacheStats: {
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
    errorEntries: number;
    totalSizeBytes: number;
    objectStorageSizeBytes: number;
  };
  syncStats: {
    totalRuns: number;
    last24Hours: number;
    successRate: number;
    avgDurationMs: number;
    lastSyncAt: string | null;
  };
  recentSyncs: SyncRun[];
  patientCoverage: {
    totalPatients: number;
    patientsWithFreshData: number;
    patientsNeedingRefresh: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "healthy":
    case "fresh":
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "degraded":
    case "stale":
    case "partial":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "unreachable":
    case "error":
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "refreshing":
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    healthy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    fresh: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    degraded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    stale: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    partial: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    unreachable: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    refreshing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    expired: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${variants[status] || "bg-gray-100 text-gray-700"}`} data-testid={`badge-status-${status}`}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function SourceTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "fhir": return <Server className="h-5 w-5 text-blue-500" />;
    case "aggregator": return <Database className="h-5 w-5 text-purple-500" />;
    case "cms_bluebutton": return <FileText className="h-5 w-5 text-indigo-500" />;
    case "wearable": return <Activity className="h-5 w-5 text-pink-500" />;
    default: return <HardDrive className="h-5 w-5 text-gray-500" />;
  }
}

export default function DataAggregationPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const dashboardQuery = useQuery<Dashboard>({
    queryKey: ["/api/data-aggregation/dashboard"],
    refetchInterval: 30000,
  });

  const cacheQuery = useQuery<{ success: boolean; data: CacheEntry[]; total: number }>({
    queryKey: ["/api/data-aggregation/cache"],
  });

  const syncRunsQuery = useQuery<{ success: boolean; data: SyncRun[]; total: number }>({
    queryKey: ["/api/data-aggregation/sync-runs"],
  });

  const refreshMutation = useMutation({
    mutationFn: async (params: { patientId?: string; sourceId?: string }) => {
      const res = await apiRequest("POST", "/api/data-aggregation/cache/refresh", {
        patientId: params.patientId || "patient-001",
        sourceId: params.sourceId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refresh Initiated", description: "Background sync has been triggered. Data will update shortly." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/data-aggregation"] });
      }, 4000);
    },
    onError: () => {
      toast({ title: "Refresh Failed", description: "Could not trigger data refresh.", variant: "destructive" });
    },
  });

  const purgeExpiredMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data-aggregation/cache/purge-expired");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Expired Cache Purged", description: `Removed ${data.data?.purgedCount || 0} expired entries.` });
      queryClient.invalidateQueries({ queryKey: ["/api/data-aggregation"] });
    },
  });

  const dashboard = dashboardQuery.data;
  const isLoading = dashboardQuery.isLoading;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6" data-testid="data-aggregation-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Database className="h-6 w-6 text-primary" />
            Data Aggregation Layer
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage patient data from FHIR connections, health aggregators, and wearable devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => purgeExpiredMutation.mutate()}
            disabled={purgeExpiredMutation.isPending}
            data-testid="btn-purge-expired"
          >
            {purgeExpiredMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Clock className="h-4 w-4 mr-1" />}
            Purge Expired
          </Button>
          <Button
            size="sm"
            onClick={() => refreshMutation.mutate({})}
            disabled={refreshMutation.isPending}
            data-testid="btn-refresh-all"
          >
            {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh All
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : dashboard ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="stat-cache-entries">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cache Entries</p>
                  <p className="text-2xl font-bold">{dashboard.cacheStats.totalEntries}</p>
                </div>
                <HardDrive className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-green-600">{dashboard.cacheStats.freshEntries} fresh</span>
                <span className="text-yellow-600">{dashboard.cacheStats.staleEntries} stale</span>
                <span className="text-red-600">{dashboard.cacheStats.errorEntries} error</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-sync-runs">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sync Runs (24h)</p>
                  <p className="text-2xl font-bold">{dashboard.syncStats.last24Hours}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-green-600">{dashboard.syncStats.successRate}% success</span>
                <span className="text-muted-foreground">avg {formatDuration(dashboard.syncStats.avgDurationMs)}</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-storage">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Data Size</p>
                  <p className="text-2xl font-bold">{formatBytes(dashboard.cacheStats.totalSizeBytes)}</p>
                </div>
                <Cloud className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-blue-600">{formatBytes(dashboard.cacheStats.objectStorageSizeBytes)} in cloud</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-patients">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Patient Coverage</p>
                  <p className="text-2xl font-bold">{dashboard.patientCoverage.totalPatients}</p>
                </div>
                <Wifi className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div className="flex gap-2 mt-2 text-xs">
                <span className="text-green-600">{dashboard.patientCoverage.patientsWithFreshData} current</span>
                <span className="text-yellow-600">{dashboard.patientCoverage.patientsNeedingRefresh} need refresh</span>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">Data Sources</TabsTrigger>
          <TabsTrigger value="cache" data-testid="tab-cache">Cache Entries</TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">Sync History</TabsTrigger>
          <TabsTrigger value="storage" data-testid="tab-storage">Cloud Storage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard?.sources.map(source => (
                <Card key={source.id} className="relative" data-testid={`source-card-${source.sourceId}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SourceTypeIcon type={source.sourceType} />
                        <div>
                          <CardTitle className="text-sm font-semibold">{source.sourceName}</CardTitle>
                          <CardDescription className="text-xs">{source.sourceType.toUpperCase()}</CardDescription>
                        </div>
                      </div>
                      <StatusBadge status={source.status} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Response Time</span>
                        <p className="font-medium">{source.avgResponseTimeMs}ms</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Uptime (24h)</span>
                        <p className="font-medium">{source.uptime24h}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Patients</span>
                        <p className="font-medium">{source.patientsConnected}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Records Cached</span>
                        <p className="font-medium">{source.totalRecordsCached}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last sync: {formatTimeAgo(source.lastSuccessfulFetch)}</span>
                      {source.objectStorageSizeBytes > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Cloud className="h-3 w-3 mr-1" />
                          {formatBytes(source.objectStorageSizeBytes)}
                        </Badge>
                      )}
                    </div>
                    {source.lastError && (
                      <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-xs text-red-600 dark:text-red-400">
                        {source.lastError}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => refreshMutation.mutate({ sourceId: source.sourceId })}
                      disabled={refreshMutation.isPending}
                      data-testid={`btn-refresh-${source.sourceId}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sync Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cache" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Cache Entries</CardTitle>
              <CardDescription>Cached data from all connected sources with TTL and invalidation status</CardDescription>
            </CardHeader>
            <CardContent>
              {cacheQuery.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {(cacheQuery.data?.data || []).map((entry: CacheEntry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`cache-entry-${entry.id}`}>
                      <div className="flex items-center gap-3">
                        <SourceTypeIcon type={entry.sourceType} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{entry.sourceName}</span>
                            <Badge variant="secondary" className="text-xs">{entry.dataCategory}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Patient: {entry.patientId} | {entry.recordCount} records | {formatBytes(entry.payloadSizeBytes)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.objectStorageKey && (
                          <Badge variant="outline" className="text-xs">
                            <Cloud className="h-3 w-3 mr-1" />
                            Cloud
                          </Badge>
                        )}
                        <div className="text-right text-xs text-muted-foreground">
                          <p>Fetched: {formatTimeAgo(entry.lastFetchedAt)}</p>
                          <p>TTL: {Math.floor(entry.ttlSeconds / 3600)}h</p>
                        </div>
                        <StatusBadge status={entry.cacheStatus} />
                      </div>
                    </div>
                  ))}
                  {(cacheQuery.data?.data || []).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No cache entries found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Sync Run History</CardTitle>
              <CardDescription>Background synchronization activity across all data sources</CardDescription>
            </CardHeader>
            <CardContent>
              {syncRunsQuery.isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {(syncRunsQuery.data?.data || []).map((run: SyncRun) => (
                    <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`sync-run-${run.id}`}>
                      <div className="flex items-center gap-3">
                        <StatusIcon status={run.status} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{run.sourceName}</span>
                            <Badge variant={run.trigger === "manual" ? "default" : "secondary"} className="text-xs">{run.trigger}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Patient: {run.patientId} |
                            +{run.recordsAdded} added, ~{run.recordsUpdated} updated |
                            {formatBytes(run.bytesTransferred)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {run.categoriesSynced.length > 0 && (
                          <div className="flex gap-1">
                            {run.categoriesSynced.map(cat => (
                              <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{formatTimeAgo(run.startedAt)}</p>
                          {run.finishedAt && (
                            <p>{formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())}</p>
                          )}
                        </div>
                        <StatusBadge status={run.status} />
                      </div>
                    </div>
                  ))}
                  {(syncRunsQuery.data?.data || []).length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No sync runs recorded yet</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="storage-overview-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Google Cloud Storage
                </CardTitle>
                <CardDescription>HIPAA-compliant object storage for large data payloads</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="text-sm">Storage Status</span>
                    <StatusBadge status="healthy" />
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="text-sm">Encryption</span>
                    <Badge variant="outline">AES-256-GCM</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="text-sm">Compliance</span>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">HIPAA</Badge>
                      <Badge variant="outline" className="text-xs">SOC 2</Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="text-sm">Total Cloud Size</span>
                    <span className="text-sm font-medium">{dashboard ? formatBytes(dashboard.cacheStats.objectStorageSizeBytes) : "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="storage-breakdown-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5" />
                  Storage Breakdown
                </CardTitle>
                <CardDescription>Data stored in cloud storage by source</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard?.sources.filter(s => s.objectStorageSizeBytes > 0).map(source => (
                    <div key={source.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <SourceTypeIcon type={source.sourceType} />
                        <span className="text-sm">{source.sourceName}</span>
                      </div>
                      <span className="text-sm font-medium">{formatBytes(source.objectStorageSizeBytes)}</span>
                    </div>
                  ))}
                  {dashboard?.sources.filter(s => s.objectStorageSizeBytes > 0).length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No data in cloud storage yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
