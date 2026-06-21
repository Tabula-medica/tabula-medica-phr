import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Link,
  Link2Off,
  Play,
  RefreshCw,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

interface StateIISConnector {
  id: string;
  stateCode: string;
  stateName: string;
  registryName: string;
  protocol: string;
  connectionStatus: "connected" | "disconnected" | "pending" | "error" | "auth_required";
  syncStatus: "idle" | "syncing" | "success" | "failed" | "partial";
  lastSyncAt?: string;
  nextSyncAt?: string;
  recordsVerified: number;
  recordsPending: number;
  features: {
    queryByPatient: boolean;
    queryByVaccine: boolean;
    forecastSupport: boolean;
    realTimeQuery: boolean;
  };
}

interface IISSyncHealth {
  overallHealth: "healthy" | "degraded" | "critical";
  connectedStates: number;
  totalStates: number;
  activeSyncJobs: number;
  pendingRecords: number;
  lastSuccessfulSync?: string;
  recentErrors: { stateCode: string; errorCode: string; message: string; occurredAt: string; resolved: boolean }[];
  syncStats: {
    totalSyncs24h: number;
    successfulSyncs24h: number;
    failedSyncs24h: number;
    recordsVerified24h: number;
    averageSyncDuration: number;
    syncsByState: { stateCode: string; count: number; successRate: number }[];
  };
}

interface SchedulerStats {
  isRunning: boolean;
  schedulerStartedAt?: string;
  totalSchedules: number;
  activeSchedules: number;
  pausedSchedules: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobsToday: number;
  failedJobsToday: number;
  nextScheduledRun?: string;
}

export default function IISSyncStatus() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: healthData, isLoading: healthLoading, error: healthError } = useQuery<IISSyncHealth>({
    queryKey: ["/api/iis/health"],
  });

  const { data: connectorsData, isLoading: connectorsLoading } = useQuery<{ connectors: StateIISConnector[] }>({
    queryKey: ["/api/iis/connectors"],
  });

  const { data: schedulerStats, isLoading: schedulerLoading } = useQuery<SchedulerStats>({
    queryKey: ["/api/iis/scheduler/stats"],
  });

  const connectMutation = useMutation({
    mutationFn: async (stateCode: string) => {
      const response = await fetch(`/api/iis/connect/${stateCode}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to connect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis"] });
      toast({ title: "Connected", description: "Successfully connected to state IIS registry" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to connect to registry", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (stateCode: string) => {
      const response = await fetch(`/api/iis/disconnect/${stateCode}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to disconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis"] });
      toast({ title: "Disconnected", description: "Successfully disconnected from state IIS registry" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disconnect from registry", variant: "destructive" });
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      const response = await fetch(`/api/iis/sync/${connectorId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: "patient-1" }),
      });
      if (!response.ok) throw new Error("Failed to start sync");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/iis"] });
      toast({ title: "Sync Started", description: "Immunization record sync has been initiated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start sync", variant: "destructive" });
    },
  });

  const filteredConnectors = connectorsData?.connectors?.filter((c) => {
    const matchesSearch =
      c.stateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.stateCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.registryName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "connected" && c.connectionStatus === "connected") ||
      (statusFilter === "disconnected" && c.connectionStatus !== "connected");
    return matchesSearch && matchesStatus;
  });

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Connected</Badge>;
      case "disconnected":
        return <Badge variant="secondary">Disconnected</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Success</Badge>;
      case "syncing":
        return <Badge variant="outline" className="animate-pulse">Syncing...</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "partial":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Partial</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">State IIS Sync Status</h1>
          <p className="text-muted-foreground">
            Manage connections to state Immunization Information Systems and track verification status
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Shield className="h-4 w-4 mr-1" />
          HIPAA Compliant
        </Badge>
      </div>

      {healthError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load IIS sync health status.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${healthData?.overallHealth === "healthy" ? "bg-green-100 dark:bg-green-950" : healthData?.overallHealth === "degraded" ? "bg-yellow-100 dark:bg-yellow-950" : "bg-red-100 dark:bg-red-950"}`}>
                <Activity className={`h-5 w-5 ${getHealthColor(healthData?.overallHealth || "")}`} />
              </div>
              <div>
                <div className="text-2xl font-bold capitalize" data-testid="text-overall-health">
                  {healthLoading ? <Skeleton className="h-7 w-20" /> : healthData?.overallHealth || "Unknown"}
                </div>
                <p className="text-xs text-muted-foreground">Overall Health</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-connected-states">
                  {healthLoading ? <Skeleton className="h-7 w-16" /> : `${healthData?.connectedStates || 0}/${healthData?.totalStates || 0}`}
                </div>
                <p className="text-xs text-muted-foreground">States Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-verified-24h">
                  {healthLoading ? <Skeleton className="h-7 w-12" /> : healthData?.syncStats?.recordsVerified24h || 0}
                </div>
                <p className="text-xs text-muted-foreground">Verified (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-pending-records">
                  {healthLoading ? <Skeleton className="h-7 w-12" /> : healthData?.pendingRecords || 0}
                </div>
                <p className="text-xs text-muted-foreground">Pending Verification</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="connectors" data-testid="tab-connectors">
            <Globe className="h-4 w-4 mr-2" />
            State Registries ({connectorsData?.connectors?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="scheduler" data-testid="tab-scheduler">
            <Clock className="h-4 w-4 mr-2" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="errors" data-testid="tab-errors">
            <AlertCircle className="h-4 w-4 mr-2" />
            Errors ({healthData?.recentErrors?.filter((e) => !e.resolved).length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Sync Statistics (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-green-600">{healthData?.syncStats?.successfulSyncs24h || 0}</div>
                        <p className="text-xs text-muted-foreground">Successful</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold text-red-600">{healthData?.syncStats?.failedSyncs24h || 0}</div>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">{healthData?.syncStats?.totalSyncs24h || 0}</div>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Avg Duration: {healthData?.syncStats?.averageSyncDuration || 0}ms
                    </div>
                    {healthData?.lastSuccessfulSync && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Last Success: {new Date(healthData.lastSuccessfulSync).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Top Connected States
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {healthData?.syncStats?.syncsByState?.slice(0, 5).map((state) => (
                      <div key={state.stateCode} className="flex items-center justify-between p-2 rounded bg-muted/30">
                        <span className="font-medium">{state.stateCode}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{state.count} syncs</span>
                          <Badge variant={state.successRate >= 0.9 ? "default" : state.successRate >= 0.7 ? "secondary" : "destructive"}>
                            {Math.round(state.successRate * 100)}%
                          </Badge>
                        </div>
                      </div>
                    )) || <p className="text-sm text-muted-foreground">No sync data available</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connectors" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search states..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-states"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {connectorsLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredConnectors?.map((connector) => (
                      <div key={connector.id} className="p-4 flex items-center justify-between gap-4" data-testid={`connector-${connector.stateCode}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${connector.connectionStatus === "connected" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : "bg-muted text-muted-foreground"}`}>
                            {connector.stateCode}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{connector.stateName}</span>
                              {getStatusBadge(connector.connectionStatus)}
                              {connector.connectionStatus === "connected" && getSyncStatusBadge(connector.syncStatus)}
                            </div>
                            <p className="text-sm text-muted-foreground">{connector.registryName} ({connector.protocol})</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {connector.connectionStatus === "connected" && (
                            <div className="text-right text-sm">
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3 w-3" />
                                {connector.recordsVerified} verified
                              </div>
                              {connector.lastSyncAt && (
                                <p className="text-xs text-muted-foreground">
                                  Last: {new Date(connector.lastSyncAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {connector.connectionStatus === "connected" ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => triggerSyncMutation.mutate(connector.id)}
                                  disabled={triggerSyncMutation.isPending || connector.syncStatus === "syncing"}
                                  data-testid={`button-sync-${connector.stateCode}`}
                                >
                                  <RefreshCw className={`h-4 w-4 ${connector.syncStatus === "syncing" ? "animate-spin" : ""}`} />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => disconnectMutation.mutate(connector.stateCode)}
                                  disabled={disconnectMutation.isPending}
                                  data-testid={`button-disconnect-${connector.stateCode}`}
                                >
                                  <Link2Off className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => connectMutation.mutate(connector.stateCode)}
                                disabled={connectMutation.isPending}
                                data-testid={`button-connect-${connector.stateCode}`}
                              >
                                <Link className="h-4 w-4 mr-1" />
                                Connect
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Background Sync Scheduler
              </CardTitle>
              <CardDescription>Automated synchronization with connected state IIS registries</CardDescription>
            </CardHeader>
            <CardContent>
              {schedulerLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className={`p-3 rounded-full ${schedulerStats?.isRunning ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                      {schedulerStats?.isRunning ? (
                        <Play className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        Scheduler Status: {schedulerStats?.isRunning ? "Running" : "Stopped"}
                      </div>
                      {schedulerStats?.schedulerStartedAt && (
                        <p className="text-sm text-muted-foreground">
                          Started: {new Date(schedulerStats.schedulerStartedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-xl font-bold">{schedulerStats?.activeSchedules || 0}</div>
                      <p className="text-xs text-muted-foreground">Active Schedules</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-xl font-bold">{schedulerStats?.queuedJobs || 0}</div>
                      <p className="text-xs text-muted-foreground">Queued Jobs</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-xl font-bold text-green-600">{schedulerStats?.completedJobsToday || 0}</div>
                      <p className="text-xs text-muted-foreground">Completed Today</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-xl font-bold text-red-600">{schedulerStats?.failedJobsToday || 0}</div>
                      <p className="text-xs text-muted-foreground">Failed Today</p>
                    </div>
                  </div>

                  {schedulerStats?.nextScheduledRun && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Next Scheduled Run: {new Date(schedulerStats.nextScheduledRun).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Recent Sync Errors
              </CardTitle>
              <CardDescription>Errors from IIS synchronization attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : healthData?.recentErrors && healthData.recentErrors.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {healthData.recentErrors.map((error, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg ${error.resolved ? "bg-muted/30" : "bg-red-50 dark:bg-red-950/20"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{error.stateCode}</span>
                              <Badge variant="outline">{error.errorCode}</Badge>
                              {error.resolved ? (
                                <Badge variant="secondary">Resolved</Badge>
                              ) : (
                                <Badge variant="destructive">Active</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{error.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(error.occurredAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <p>No recent errors</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>HIPAA Compliance Notice</AlertTitle>
        <AlertDescription>
          IIS data is for record verification only. This is NOT clinical decision support. All immunization decisions must be made by qualified healthcare providers in consultation with patients.
        </AlertDescription>
      </Alert>
    </div>
  );
}
