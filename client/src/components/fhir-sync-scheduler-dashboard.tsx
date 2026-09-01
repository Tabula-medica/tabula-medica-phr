import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  Play,
  Pause,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Server,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  FileText,
  GitMerge,
  Activity,
  Plus,
  Zap,
  Database,
} from "lucide-react";

interface SyncStatistics {
  totalConfigurations: number;
  activeConfigurations: number;
  totalJobs: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  pendingConflicts: number;
  resourcesSyncedToday: number;
  averageSyncDuration: number;
  lastSyncTime?: string;
}

interface SyncEndpoint {
  id: string;
  name: string;
  url: string;
  fhirVersion: "R4" | "R5";
  authType: string;
  isActive: boolean;
  healthStatus: "healthy" | "degraded" | "unavailable" | "unknown";
  lastConnected?: string;
}

interface SyncConfiguration {
  id: string;
  name: string;
  description: string;
  endpointId: string;
  direction: "bidirectional" | "push" | "pull";
  frequency: "realtime" | "hourly" | "daily" | "weekly" | "custom";
  resourceTypes: string[];
  conflictResolution: string;
  incrementalSync: boolean;
  isActive: boolean;
  lastSyncTime?: string;
  nextSyncTime?: string;
}

interface SyncJob {
  id: string;
  configurationId: string;
  status: "idle" | "running" | "completed" | "failed" | "paused";
  direction: string;
  startTime: string;
  endTime?: string;
  resourcesProcessed: number;
  resourcesPushed: number;
  resourcesPulled: number;
  conflictsDetected: number;
  conflictsResolved: number;
  errors: number;
  errorMessages: string[];
  isIncremental: boolean;
  triggeredBy: string;
}

interface SyncConflict {
  id: string;
  jobId: string;
  configurationId: string;
  resourceType: string;
  resourceId: string;
  localVersion: { data: Record<string, unknown>; lastModified: string; versionId: string };
  remoteVersion: { data: Record<string, unknown>; lastModified: string; versionId: string };
  status: "pending" | "resolved" | "dismissed";
  resolutionStrategy?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

interface SyncLogEntry {
  id: string;
  jobId: string;
  configurationId: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "debug";
  message: string;
  resourceType?: string;
  resourceId?: string;
  direction?: string;
}

export function FHIRSyncSchedulerDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isCreateConfigOpen, setIsCreateConfigOpen] = useState(false);
  const { toast } = useToast();

  const { data: statistics, isLoading: statsLoading } = useQuery<SyncStatistics>({
    queryKey: ["/api/fhir-sync-scheduler/statistics"],
  });

  const { data: endpoints } = useQuery<SyncEndpoint[]>({
    queryKey: ["/api/fhir-sync-scheduler/endpoints"],
  });

  const { data: configurations, isLoading: configsLoading } = useQuery<SyncConfiguration[]>({
    queryKey: ["/api/fhir-sync-scheduler/configurations"],
  });

  const { data: jobs, isLoading: jobsLoading } = useQuery<SyncJob[]>({
    queryKey: ["/api/fhir-sync-scheduler/jobs"],
  });

  const { data: conflicts } = useQuery<SyncConflict[]>({
    queryKey: ["/api/fhir-sync-scheduler/conflicts"],
  });

  const { data: logs } = useQuery<SyncLogEntry[]>({
    queryKey: ["/api/fhir-sync-scheduler/logs"],
  });

  const toggleConfigMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("POST", `/api/fhir-sync-scheduler/configurations/${id}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/statistics"] });
      toast({ title: "Configuration updated" });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async (configurationId: string) => {
      return apiRequest("POST", "/api/fhir-sync-scheduler/jobs", { configurationId, triggeredBy: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/statistics"] });
      toast({ title: "Sync job started" });
    },
    onError: (error) => {
      toast({ title: "Failed to start sync", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ id, strategy }: { id: string; strategy: string }) => {
      return apiRequest("POST", `/api/fhir-sync-scheduler/conflicts/${id}/resolve`, { strategy });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/statistics"] });
      toast({ title: "Conflict resolved" });
    },
  });

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case "bidirectional": return <ArrowLeftRight className="h-4 w-4" />;
      case "push": return <ArrowUpFromLine className="h-4 w-4" />;
      case "pull": return <ArrowDownToLine className="h-4 w-4" />;
      default: return <ArrowLeftRight className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running": return <Badge className="bg-blue-500">Running</Badge>;
      case "completed": return <Badge className="bg-green-500">Completed</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "paused": return <Badge variant="secondary">Paused</Badge>;
      default: return <Badge variant="outline">Idle</Badge>;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case "healthy": return <Badge className="bg-green-500">Healthy</Badge>;
      case "degraded": return <Badge className="bg-amber-500">Degraded</Badge>;
      case "unavailable": return <Badge variant="destructive">Unavailable</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Sync Scheduler</h1>
          <p className="text-muted-foreground">
            Automated bidirectional data synchronization with external FHIR servers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler"] })}
            data-testid="btn-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateConfigOpen} onOpenChange={setIsCreateConfigOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-create-config">
                <Plus className="h-4 w-4 mr-2" />
                New Sync
              </Button>
            </DialogTrigger>
            <CreateConfigDialog endpoints={endpoints || []} onClose={() => setIsCreateConfigOpen(false)} />
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Active Syncs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-syncs">
              {statsLoading ? "..." : statistics?.activeConfigurations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {statistics?.totalConfigurations || 0} total configurations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Synced Today</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-synced-today">
              {statsLoading ? "..." : statistics?.resourcesSyncedToday?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">resources processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Pending Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-conflicts">
              {statsLoading ? "..." : statistics?.pendingConflicts || 0}
            </div>
            <p className="text-xs text-muted-foreground">require resolution</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-duration">
              {statsLoading ? "..." : formatDuration(statistics?.averageSyncDuration || 0)}
            </div>
            <p className="text-xs text-muted-foreground">per sync job</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="configurations" data-testid="tab-configurations">
            <Settings className="h-4 w-4 mr-2" />
            Configurations
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Zap className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            <GitMerge className="h-4 w-4 mr-2" />
            Conflicts
            {(statistics?.pendingConflicts ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-2">{statistics?.pendingConflicts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="endpoints" data-testid="tab-endpoints">
            <Server className="h-4 w-4 mr-2" />
            Endpoints
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sync Features</CardTitle>
                <CardDescription>Capabilities of the synchronization system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: ArrowLeftRight, title: "Bidirectional Sync", desc: "Push and pull changes between systems" },
                  { icon: Clock, title: "Scheduled Jobs", desc: "Daily, hourly, or custom cron schedules" },
                  { icon: Zap, title: "Incremental Sync", desc: "Only sync changed resources for efficiency" },
                  { icon: GitMerge, title: "Conflict Resolution", desc: "Last-write-wins, source-priority, manual merge" },
                  { icon: FileText, title: "Detailed Logging", desc: "Track every sync operation and error" },
                ].map(item => (
                  <div key={item.title} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <item.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest sync jobs and status</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-3">
                    {jobs?.slice(0, 5).map(job => {
                      const config = configurations?.find(c => c.id === job.configurationId);
                      return (
                        <div key={job.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {getDirectionIcon(job.direction)}
                            <div>
                              <p className="font-medium text-sm">{config?.name || job.configurationId}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(job.startTime).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(job.status)}
                            <p className="text-xs text-muted-foreground mt-1">
                              {job.resourcesProcessed} resources
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {!jobs?.length && (
                      <p className="text-center text-muted-foreground py-8">No recent jobs</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="configurations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configurations</CardTitle>
              <CardDescription>Manage scheduled data synchronization settings</CardDescription>
            </CardHeader>
            <CardContent>
              {configsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !configurations?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sync configurations</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsCreateConfigOpen(true)}
                    data-testid="btn-add-first-config"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Configuration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {configurations.map(config => {
                    const endpoint = endpoints?.find(e => e.id === config.endpointId);
                    return (
                      <Card key={config.id} className="hover-elevate" data-testid={`config-${config.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                {getDirectionIcon(config.direction)}
                                <h3 className="font-semibold">{config.name}</h3>
                                <Badge variant={config.isActive ? "default" : "secondary"}>
                                  {config.isActive ? "Active" : "Paused"}
                                </Badge>
                                <Badge variant="outline">{config.frequency}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{config.description}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Endpoint: {endpoint?.name || config.endpointId}</span>
                                <span>Strategy: {config.conflictResolution}</span>
                                {config.incrementalSync && <Badge variant="outline" className="text-xs">Incremental</Badge>}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {config.resourceTypes.slice(0, 4).map(type => (
                                  <Badge key={type} variant="secondary" className="text-xs">{type}</Badge>
                                ))}
                                {config.resourceTypes.length > 4 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{config.resourceTypes.length - 4} more
                                  </Badge>
                                )}
                              </div>
                              {config.nextSyncTime && (
                                <p className="text-xs text-muted-foreground">
                                  Next sync: {new Date(config.nextSyncTime).toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startJobMutation.mutate(config.id)}
                                disabled={startJobMutation.isPending || !config.isActive}
                                data-testid={`btn-start-${config.id}`}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Sync Now
                              </Button>
                              <Switch
                                checked={config.isActive}
                                onCheckedChange={(checked) =>
                                  toggleConfigMutation.mutate({ id: config.id, isActive: checked })
                                }
                                data-testid={`switch-${config.id}`}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Jobs</CardTitle>
              <CardDescription>History of synchronization job executions</CardDescription>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {jobs?.map(job => {
                      const config = configurations?.find(c => c.id === job.configurationId);
                      const duration = job.endTime
                        ? new Date(job.endTime).getTime() - new Date(job.startTime).getTime()
                        : Date.now() - new Date(job.startTime).getTime();

                      return (
                        <Card key={job.id} className="hover-elevate" data-testid={`job-${job.id}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {getDirectionIcon(job.direction)}
                                  <span className="font-medium">{config?.name || job.configurationId}</span>
                                  {getStatusBadge(job.status)}
                                  {job.isIncremental && <Badge variant="outline" className="text-xs">Incremental</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Started: {new Date(job.startTime).toLocaleString()} | Duration: {formatDuration(duration)}
                                </p>
                                <div className="flex gap-4 text-xs">
                                  <span>Processed: {job.resourcesProcessed}</span>
                                  <span>Pushed: {job.resourcesPushed}</span>
                                  <span>Pulled: {job.resourcesPulled}</span>
                                  {job.conflictsDetected > 0 && (
                                    <span className="text-amber-500">
                                      Conflicts: {job.conflictsResolved}/{job.conflictsDetected}
                                    </span>
                                  )}
                                  {job.errors > 0 && (
                                    <span className="text-destructive">Errors: {job.errors}</span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs">{job.triggeredBy}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {!jobs?.length && (
                      <p className="text-center text-muted-foreground py-8">No sync jobs found</p>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Conflicts</CardTitle>
              <CardDescription>Resolve conflicts between local and remote data</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {conflicts?.filter(c => c.status === "pending").map(conflict => (
                    <Card key={conflict.id} className="border-amber-500/50" data-testid={`conflict-${conflict.id}`}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                              <span className="font-medium">{conflict.resourceType}/{conflict.resourceId}</span>
                              <Badge variant="outline">Pending</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(conflict.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-xs font-medium mb-1">Local Version (v{conflict.localVersion.versionId})</p>
                              <p className="text-xs text-muted-foreground">
                                Modified: {new Date(conflict.localVersion.lastModified).toLocaleString()}
                              </p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-xs font-medium mb-1">Remote Version (v{conflict.remoteVersion.versionId})</p>
                              <p className="text-xs text-muted-foreground">
                                Modified: {new Date(conflict.remoteVersion.lastModified).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflictMutation.mutate({ id: conflict.id, strategy: "last-write-wins" })}
                              data-testid={`btn-lww-${conflict.id}`}
                            >
                              Last Write Wins
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflictMutation.mutate({ id: conflict.id, strategy: "local-priority" })}
                              data-testid={`btn-local-${conflict.id}`}
                            >
                              Keep Local
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflictMutation.mutate({ id: conflict.id, strategy: "source-priority" })}
                              data-testid={`btn-remote-${conflict.id}`}
                            >
                              Keep Remote
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {!conflicts?.filter(c => c.status === "pending").length && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                      <p>No pending conflicts</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Logs</CardTitle>
              <CardDescription>Detailed activity logs for sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {logs?.map(log => (
                    <div
                      key={log.id}
                      className={`p-2 rounded-lg text-sm flex items-start gap-2 ${
                        log.level === "error" ? "bg-destructive/10 text-destructive" :
                        log.level === "warning" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                        "bg-muted/50"
                      }`}
                      data-testid={`log-${log.id}`}
                    >
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="flex-1">{log.message}</span>
                      {log.resourceType && (
                        <Badge variant="secondary" className="text-xs">
                          {log.resourceType}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {!logs?.length && (
                    <p className="text-center text-muted-foreground py-8">No logs available</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FHIR Endpoints</CardTitle>
              <CardDescription>External FHIR servers configured for synchronization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpoints?.map(endpoint => (
                  <Card key={endpoint.id} className="hover-elevate" data-testid={`endpoint-${endpoint.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            <span className="font-medium">{endpoint.name}</span>
                            {getHealthBadge(endpoint.healthStatus)}
                            <Badge variant="outline">{endpoint.fhirVersion}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">{endpoint.url}</p>
                          <p className="text-xs text-muted-foreground">
                            Auth: {endpoint.authType} | Last connected: {endpoint.lastConnected ? new Date(endpoint.lastConnected).toLocaleString() : "Never"}
                          </p>
                        </div>
                        <Switch checked={endpoint.isActive} data-testid={`switch-ep-${endpoint.id}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {!endpoints?.length && (
                  <p className="text-center text-muted-foreground py-8">No endpoints configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateConfigDialog({ endpoints, onClose }: { endpoints: SyncEndpoint[]; onClose: () => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    endpointId: "",
    direction: "bidirectional" as "bidirectional" | "push" | "pull",
    frequency: "daily" as "realtime" | "hourly" | "daily" | "weekly" | "custom",
    resourceTypes: ["Patient", "Observation"],
    conflictResolution: "last-write-wins",
    incrementalSync: true,
    batchSize: 100,
    retryAttempts: 3,
    retryDelayMs: 5000,
    isActive: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/fhir-sync-scheduler/configurations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-sync-scheduler/statistics"] });
      toast({ title: "Configuration created successfully" });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to create configuration", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.endpointId) {
      toast({ title: "Please select an endpoint", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Create Sync Configuration</DialogTitle>
        <DialogDescription>
          Set up automated synchronization with an external FHIR server
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Daily Patient Sync"
              required
              data-testid="input-config-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endpoint">FHIR Endpoint</Label>
            <Select
              value={formData.endpointId}
              onValueChange={(value) => setFormData({ ...formData, endpointId: value })}
            >
              <SelectTrigger data-testid="select-endpoint">
                <SelectValue placeholder="Select endpoint" />
              </SelectTrigger>
              <SelectContent>
                {endpoints.map(ep => (
                  <SelectItem key={ep.id} value={ep.id}>{ep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Sync patient demographics and observations"
            data-testid="input-description"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fhir-sync-scheduler-dash-direction">Direction</Label>
            <Select
              value={formData.direction}
              onValueChange={(value: "bidirectional" | "push" | "pull") => setFormData({ ...formData, direction: value })}
            >
              <SelectTrigger id="fhir-sync-scheduler-dash-direction" data-testid="select-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bidirectional">Bidirectional</SelectItem>
                <SelectItem value="push">Push Only</SelectItem>
                <SelectItem value="pull">Pull Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fhir-sync-scheduler-dash-frequency">Frequency</Label>
            <Select
              value={formData.frequency}
              onValueChange={(value: "realtime" | "hourly" | "daily" | "weekly" | "custom") => setFormData({ ...formData, frequency: value })}
            >
              <SelectTrigger id="fhir-sync-scheduler-dash-frequency" data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fhir-sync-scheduler-dash-conflict-resolution">Conflict Resolution</Label>
            <Select
              value={formData.conflictResolution}
              onValueChange={(value) => setFormData({ ...formData, conflictResolution: value })}
            >
              <SelectTrigger id="fhir-sync-scheduler-dash-conflict-resolution" data-testid="select-conflict">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-write-wins">Last Write Wins</SelectItem>
                <SelectItem value="source-priority">Source Priority</SelectItem>
                <SelectItem value="local-priority">Local Priority</SelectItem>
                <SelectItem value="manual-merge">Manual Merge</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.incrementalSync}
              onChange={(e) => setFormData({ ...formData, incrementalSync: e.target.checked })}
            />
            Incremental Sync
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            Start Active
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-config">
            {createMutation.isPending ? "Creating..." : "Create Configuration"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
