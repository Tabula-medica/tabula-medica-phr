import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  Activity, 
  FileText, 
  Pill, 
  Users, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Building2,
  Beaker,
  ShoppingCart,
  Watch,
  Smartphone,
  Settings,
  Play,
  Pause,
  Trash2,
  ChevronRight,
  BarChart3,
  PieChart,
  LineChart
} from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area } from "recharts";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PATIENT_ID = "patient-1";

type SyncSchedule = {
  id: string;
  patientId: string;
  sourceId: string;
  sourceName: string;
  sourceType: "ehr" | "lab" | "pharmacy" | "wearable" | "health_app";
  frequency: string;
  status: string;
  lastSyncAt?: string;
  nextSyncAt?: string;
  syncCount: number;
  recordsSynced: number;
};

type SyncHistoryEntry = {
  id: string;
  sourceName: string;
  status: string;
  recordsImported: number;
  duration: number;
  syncedAt: string;
  errors: string[];
};

export default function ExternalSyncDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/sync-dashboard/overview"],
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ["/api/external-sync/schedules", PATIENT_ID],
  });

  const { data: historyData } = useQuery({
    queryKey: ["/api/external-sync/history", PATIENT_ID],
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/external-sync/analytics", PATIENT_ID],
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/external-sync/schedules/${scheduleId}/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-sync/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-sync/history"] });
      toast({ title: "Sync started", description: "Data sync has been initiated" });
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Failed to start sync", variant: "destructive" });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ scheduleId, updates }: { scheduleId: string; updates: { status?: string; frequency?: string } }) => {
      const res = await fetch(`/api/external-sync/schedules/${scheduleId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-sync/schedules"] });
      toast({ title: "Schedule updated", description: "Sync schedule has been updated" });
    },
  });

  const dashboard = (dashboardData as any)?.data;
  const schedules = ((schedulesData as any)?.data || []) as SyncSchedule[];
  const history = ((historyData as any)?.data || []) as SyncHistoryEntry[];
  const analytics = (analyticsData as any)?.data;

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "ehr": return <Building2 className="w-4 h-4" />;
      case "lab": return <Beaker className="w-4 h-4" />;
      case "pharmacy": return <ShoppingCart className="w-4 h-4" />;
      case "wearable": return <Watch className="w-4 h-4" />;
      case "health_app": return <Smartphone className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
      case "success":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>;
      case "paused":
        return <Badge variant="secondary"><Pause className="w-3 h-3 mr-1" />Paused</Badge>;
      case "error":
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case "partial":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><AlertTriangle className="w-3 h-3 mr-1" />Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (dashboardLoading || schedulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">External Health Data Sync</h1>
          <p className="text-muted-foreground">Manage and monitor your connected health data sources</p>
        </div>
        <Button onClick={() => queryClient.invalidateQueries()} data-testid="button-refresh-all">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Patients</p>
                  <p className="text-2xl font-bold" data-testid="text-total-patients">{dashboard.summary.totalPatients.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Documents</p>
                  <p className="text-2xl font-bold" data-testid="text-total-documents">{dashboard.summary.totalDocuments.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <RefreshCw className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Syncs</p>
                  <p className="text-2xl font-bold" data-testid="text-total-syncs">{dashboard.summary.totalSyncs.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Activity className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Connections</p>
                  <p className="text-2xl font-bold" data-testid="text-active-connections">{dashboard.summary.activeConnections.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-teal-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold" data-testid="text-success-rate">{dashboard.summary.avgSyncSuccessRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <Activity className="w-4 h-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <LineChart className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Patient Growth
                </CardTitle>
                <CardDescription>New and active patients over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.patientGrowth && (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dashboard.patientGrowth.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <Legend />
                      <Area type="monotone" dataKey="activePatients" name="Active Patients" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                      <Area type="monotone" dataKey="newPatients" name="New Patients" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Document Volume
                </CardTitle>
                <CardDescription>Documents uploaded and synced over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.documentVolume && (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboard.documentVolume.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <Legend />
                      <Bar dataKey="uploaded" name="Uploaded" fill="#8b5cf6" />
                      <Bar dataKey="synced" name="Synced" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="w-5 h-5" />
                  Medication Trends
                </CardTitle>
                <CardDescription>Prescription activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.medicationTrends && (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsLineChart data={dashboard.medicationTrends.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <Legend />
                      <Line type="monotone" dataKey="newPrescriptions" name="New Rx" stroke="#f59e0b" strokeWidth={2} />
                      <Line type="monotone" dataKey="refills" name="Refills" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="discontinued" name="Discontinued" stroke="#ef4444" strokeWidth={2} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Data Quality Metrics
                </CardTitle>
                <CardDescription>Overall health data quality scores</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard?.dataQualityMetrics && (
                  <div className="space-y-4">
                    {Object.entries(dashboard.dataQualityMetrics).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize">{key}</span>
                          <span className="text-sm text-muted-foreground">{value as number}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              (value as number) >= 95 ? "bg-green-500" : 
                              (value as number) >= 90 ? "bg-yellow-500" : "bg-red-500"
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Syncs by Source</CardTitle>
              <CardDescription>Record volume from each connected source</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard?.syncsBySource && (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboard.syncsBySource} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="source" type="category" width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="syncs" name="Sync Count" fill="#3b82f6" />
                    <Bar dataKey="records" name="Records" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <Alert>
            <Activity className="w-4 h-4" />
            <AlertDescription>
              Manage your connected health data sources. You can pause, resume, or adjust sync frequency for each connection.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        {getSourceIcon(schedule.sourceType)}
                      </div>
                      <div>
                        <h3 className="font-semibold">{schedule.sourceName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="capitalize">{schedule.sourceType}</Badge>
                          {getStatusBadge(schedule.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{schedule.syncCount}</p>
                        <p className="text-xs text-muted-foreground">Syncs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{schedule.recordsSynced.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Records</p>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="text-sm">
                        <p className="text-muted-foreground">Last sync: {formatDate(schedule.lastSyncAt)}</p>
                        {schedule.nextSyncAt && (
                          <p className="text-muted-foreground">Next sync: {formatDate(schedule.nextSyncAt)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={schedule.frequency}
                        onValueChange={(value) => updateScheduleMutation.mutate({ scheduleId: schedule.id, updates: { frequency: value } })}
                      >
                        <SelectTrigger className="w-32" data-testid={`select-frequency-${schedule.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Realtime</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => triggerSyncMutation.mutate(schedule.id)}
                        disabled={triggerSyncMutation.isPending}
                        data-testid={`button-sync-${schedule.id}`}
                      >
                        <RefreshCw className={`w-4 h-4 ${triggerSyncMutation.isPending ? "animate-spin" : ""}`} />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => updateScheduleMutation.mutate({ 
                          scheduleId: schedule.id, 
                          updates: { status: schedule.status === "active" ? "paused" : "active" } 
                        })}
                        data-testid={`button-toggle-${schedule.id}`}
                      >
                        {schedule.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>

                      <Button variant="outline" size="icon" data-testid={`button-settings-${schedule.id}`}>
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent synchronization activity across all sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.slice(0, 20).map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {entry.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : entry.status === "partial" ? (
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{entry.sourceName}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(entry.syncedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-medium">{entry.recordsImported} records</p>
                        <p className="text-sm text-muted-foreground">{formatDuration(entry.duration)}</p>
                      </div>
                      {entry.errors.length > 0 && (
                        <Badge variant="destructive">{entry.errors.length} errors</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Syncs</p>
                    <p className="text-2xl font-bold">{analytics.totalSyncs}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Successful</p>
                    <p className="text-2xl font-bold text-green-500">{analytics.successfulSyncs}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-500">{analytics.failedSyncs}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(analytics.averageDuration)}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Daily Sync Activity</CardTitle>
                  <CardDescription>Syncs and records imported per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={analytics.syncsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip labelFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <Legend />
                      <Area yAxisId="left" type="monotone" dataKey="count" name="Syncs" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                      <Area yAxisId="right" type="monotone" dataKey="records" name="Records" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {analytics.recentErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-500">Recent Errors</CardTitle>
                    <CardDescription>Failed sync attempts that need attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analytics.recentErrors.map((error: { source: string; error: string; timestamp: string }, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                          <div className="flex items-center gap-3">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <div>
                              <p className="font-medium">{error.source}</p>
                              <p className="text-sm text-muted-foreground">{error.error}</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatDate(error.timestamp)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
