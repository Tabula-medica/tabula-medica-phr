import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  RefreshCw,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  User,
  Stethoscope,
  Pill,
  FileText,
  Play,
  Pause,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Activity,
  BarChart3,
  Settings,
  History,
  ChevronRight,
  Minus,
  TrendingUp,
  Database,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FHIRServer {
  id: string;
  name: string;
  endpoint: string;
  authType: string;
  isActive: boolean;
  lastSyncAt?: string;
  supportedResources: string[];
  syncDirection: string;
  conflictStrategy: string;
  autoApproveThreshold: number;
}

interface FieldConflict {
  fieldPath: string;
  fieldName: string;
  localValue: unknown;
  remoteValue: unknown;
  proposedValue: unknown;
  resolution: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

interface PendingChange {
  id: string;
  syncJobId: string;
  serverId: string;
  resourceType: string;
  resourceId: string;
  changeType: string;
  direction: string;
  status: string;
  localRecord?: Record<string, unknown>;
  remoteRecord?: Record<string, unknown>;
  proposedRecord?: Record<string, unknown>;
  conflicts: FieldConflict[];
  confidence: number;
  aiRecommendation?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncJob {
  id: string;
  serverId: string;
  resourceTypes: string[];
  direction: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  autoApplied: number;
  conflicts: number;
  errors: { resourceType: string; resourceId: string; errorMessage: string }[];
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
}

interface SyncDashboard {
  activeSyncJobs: number;
  pendingReviewCount: number;
  conflictCount: number;
  recentSyncJobs: SyncJob[];
  serverStatuses: { serverId: string; serverName: string; status: string; lastSyncAt?: string; pendingChanges: number; conflicts: number }[];
  resourceBreakdown: { resourceType: string; totalRecords: number; inSync: number; pendingInbound: number; pendingOutbound: number; conflicts: number }[];
  syncTrends: { date: string; synced: number; conflicts: number; errors: number }[];
}

const statusColors: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  auto_applied: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  conflict: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  paused: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  healthy: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  offline: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const resourceIcons: Record<string, typeof User> = {
  Patient: User,
  Condition: Stethoscope,
  Medication: Pill,
  MedicationRequest: Pill,
};

function DashboardTab() {
  const { data: dashboard, isLoading, refetch, isFetching } = useQuery<SyncDashboard>({
    queryKey: ["/api/fhir-bidirectional-sync/dashboard"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Sync Overview</h3>
          <p className="text-sm text-muted-foreground">Real-time status of bidirectional FHIR synchronization</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-dashboard">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sync Jobs</p>
                <p className="text-2xl font-bold">{dashboard?.activeSyncJobs || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{dashboard?.pendingReviewCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conflicts</p>
                <p className="text-2xl font-bold">{dashboard?.conflictCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Server className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connected Servers</p>
                <p className="text-2xl font-bold">{dashboard?.serverStatuses.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync Trends (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.syncTrends || []}>
                  <defs>
                    <linearGradient id="syncedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="synced" stroke="hsl(var(--primary))" fill="url(#syncedGradient)" name="Synced" />
                  <Line type="monotone" dataKey="conflicts" stroke="hsl(var(--destructive))" name="Conflicts" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resource Sync Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.resourceBreakdown.map((resource) => {
                const Icon = resourceIcons[resource.resourceType] || FileText;
                const syncPercentage = resource.totalRecords > 0 ? Math.round((resource.inSync / resource.totalRecords) * 100) : 0;
                return (
                  <div key={resource.resourceType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{resource.resourceType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600">{resource.inSync} synced</span>
                        {resource.pendingInbound > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                            {resource.pendingInbound}
                          </Badge>
                        )}
                        {resource.conflicts > 0 && (
                          <Badge className={statusColors.conflict}>{resource.conflicts} conflicts</Badge>
                        )}
                      </div>
                    </div>
                    <Progress value={syncPercentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {dashboard?.serverStatuses.map((server) => (
              <div key={server.serverId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{server.serverName}</p>
                    <p className="text-xs text-muted-foreground">
                      {server.lastSyncAt ? `Last sync: ${new Date(server.lastSyncAt).toLocaleString()}` : "Never synced"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[server.status] || ""}>{server.status}</Badge>
                  {server.pendingChanges > 0 && (
                    <Badge variant="outline">{server.pendingChanges} pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingChangesTab() {
  const [selectedChange, setSelectedChange] = useState<PendingChange | null>(null);
  const [filter, setFilter] = useState<{ status?: string; resourceType?: string; direction?: string }>({});
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.resourceType) params.set("resourceType", filter.resourceType);
    if (filter.direction) params.set("direction", filter.direction);
    const queryString = params.toString();
    return `/api/fhir-bidirectional-sync/pending-changes${queryString ? `?${queryString}` : ""}`;
  };

  const { data: changes, isLoading, refetch, isFetching } = useQuery<PendingChange[]>({
    queryKey: ["/api/fhir-bidirectional-sync/pending-changes", filter.status, filter.resourceType, filter.direction],
    queryFn: async () => {
      const response = await fetch(buildQueryUrl());
      if (!response.ok) throw new Error("Failed to fetch pending changes");
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ changeId, notes, fieldResolutions }: { changeId: string; notes?: string; fieldResolutions?: Record<string, string> }) => {
      const response = await apiRequest("POST", `/api/fhir-bidirectional-sync/pending-changes/${changeId}/approve`, { notes, fieldResolutions });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/dashboard"] });
      setSelectedChange(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ changeId, reason }: { changeId: string; reason: string }) => {
      const response = await apiRequest("POST", `/api/fhir-bidirectional-sync/pending-changes/${changeId}/reject`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/dashboard"] });
      setSelectedChange(null);
      setShowRejectDialog(false);
      setRejectReason("");
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ changeId, fieldPath, resolution }: { changeId: string; fieldPath: string; resolution: string }) => {
      const response = await apiRequest("POST", `/api/fhir-bidirectional-sync/pending-changes/${changeId}/resolve-conflict`, { fieldPath, resolution });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/pending-changes"] });
    },
  });

  const getAiRecommendationMutation = useMutation({
    mutationFn: async (changeId: string) => {
      const response = await apiRequest("GET", `/api/fhir-bidirectional-sync/pending-changes/${changeId}/ai-recommendation`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const pendingChanges = changes || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Pending Changes Review</h3>
          <p className="text-sm text-muted-foreground">Review and approve or reject sync changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter.status || "all"} onValueChange={(v) => setFilter({ ...filter, status: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-36" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="conflict">Conflict</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.resourceType || "all"} onValueChange={(v) => setFilter({ ...filter, resourceType: v === "all" ? undefined : v })}>
            <SelectTrigger className="w-36" data-testid="select-filter-resource">
              <SelectValue placeholder="Resource" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="Patient">Patient</SelectItem>
              <SelectItem value="Condition">Condition</SelectItem>
              <SelectItem value="Medication">Medication</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-changes">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {pendingChanges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <p className="text-lg font-medium">All Caught Up!</p>
            <p className="text-muted-foreground">No pending changes require review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingChanges.map((change) => {
            const Icon = resourceIcons[change.resourceType] || FileText;
            return (
              <Card key={change.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedChange(change)} data-testid={`card-change-${change.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{change.resourceType}</span>
                          <Badge variant="outline" className="text-xs">{change.resourceId}</Badge>
                          <Badge className={statusColors[change.status] || ""}>{change.status.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {change.direction === "inbound" ? (
                              <ArrowDownToLine className="h-3 w-3" />
                            ) : (
                              <ArrowUpFromLine className="h-3 w-3" />
                            )}
                            {change.direction}
                          </span>
                          <span className="capitalize">{change.changeType}</span>
                          <span>{new Date(change.createdAt).toLocaleString()}</span>
                        </div>
                        {change.conflicts.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-orange-600">{change.conflicts.length} field conflict(s)</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-sm font-medium">Confidence</p>
                        <p className={`text-lg font-bold ${change.confidence >= 0.8 ? "text-green-500" : change.confidence >= 0.6 ? "text-yellow-500" : "text-red-500"}`}>
                          {Math.round(change.confidence * 100)}%
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedChange(change); }} data-testid={`button-view-change-${change.id}`}>
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedChange} onOpenChange={() => setSelectedChange(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {selectedChange && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = resourceIcons[selectedChange.resourceType] || FileText;
                    return <Icon className="h-5 w-5" />;
                  })()}
                  Review {selectedChange.resourceType} Change
                </DialogTitle>
                <DialogDescription>
                  {selectedChange.changeType} • {selectedChange.direction} • {selectedChange.resourceId}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge className={statusColors[selectedChange.status] || ""}>{selectedChange.status.replace("_", " ")}</Badge>
                    <div>
                      <span className="text-sm text-muted-foreground">Confidence: </span>
                      <span className={`font-bold ${selectedChange.confidence >= 0.8 ? "text-green-500" : selectedChange.confidence >= 0.6 ? "text-yellow-500" : "text-red-500"}`}>
                        {Math.round(selectedChange.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => getAiRecommendationMutation.mutate(selectedChange.id)}
                    disabled={getAiRecommendationMutation.isPending}
                  >
                    {getAiRecommendationMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />
                    )}
                    Get AI Recommendation
                  </Button>
                </div>

                {(selectedChange.aiRecommendation || getAiRecommendationMutation.data?.recommendation) && (
                  <Card className="border-purple-500/20 bg-purple-500/5">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-purple-700 dark:text-purple-400">AI Recommendation</p>
                          <p className="text-sm mt-1">{getAiRecommendationMutation.data?.recommendation || selectedChange.aiRecommendation}</p>
                          <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">
                            NO-CDS: This AI-generated recommendation is for informational purposes only and does not constitute clinical decision support. 
                            Always verify with authoritative data sources before applying changes to patient records.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedChange.conflicts.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Field Conflicts ({selectedChange.conflicts.length})
                    </h4>
                    <div className="space-y-4">
                      {selectedChange.conflicts.map((conflict, i) => (
                        <Card key={i} className="border-orange-500/20">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{conflict.fieldName}</p>
                                <Badge variant={conflict.resolution === "pending" ? "outline" : "secondary"}>
                                  {conflict.resolution}
                                </Badge>
                              </div>
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Local Value</p>
                                  <code className="text-xs">{JSON.stringify(conflict.localValue, null, 2)}</code>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Remote Value</p>
                                  <code className="text-xs">{JSON.stringify(conflict.remoteValue, null, 2)}</code>
                                </div>
                              </div>
                              {conflict.resolution === "pending" && (
                                <RadioGroup
                                  defaultValue="use_proposed"
                                  onValueChange={(value) => resolveConflictMutation.mutate({ changeId: selectedChange.id, fieldPath: conflict.fieldPath, resolution: value })}
                                  className="flex gap-4"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="use_local" id={`local-${i}`} />
                                    <Label htmlFor={`local-${i}`}>Use Local</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="use_remote" id={`remote-${i}`} />
                                    <Label htmlFor={`remote-${i}`}>Use Remote</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="use_proposed" id={`proposed-${i}`} />
                                    <Label htmlFor={`proposed-${i}`}>Use AI Proposed</Label>
                                  </div>
                                </RadioGroup>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {selectedChange.localRecord && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Database className="h-4 w-4" /> Local Record
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(selectedChange.localRecord, null, 2)}</pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                  {selectedChange.remoteRecord && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Server className="h-4 w-4" /> Remote Record
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(selectedChange.remoteRecord, null, 2)}</pre>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {selectedChange.proposedRecord && (
                  <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" /> Proposed Result
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-48">
                        <pre className="text-xs overflow-x-auto">{JSON.stringify(selectedChange.proposedRecord, null, 2)}</pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedChange(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject-change"
                >
                  <ThumbsDown className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button
                  onClick={() => approveMutation.mutate({ changeId: selectedChange.id })}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-change"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Change</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this change.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => selectedChange && rejectMutation.mutate({ changeId: selectedChange.id, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SyncJobsTab() {
  const { data: jobs, isLoading, refetch, isFetching } = useQuery<SyncJob[]>({
    queryKey: ["/api/fhir-bidirectional-sync/jobs"],
  });

  const { data: servers } = useQuery<FHIRServer[]>({
    queryKey: ["/api/fhir-bidirectional-sync/servers"],
  });

  const startJobMutation = useMutation({
    mutationFn: async ({ serverId, resourceTypes, direction }: { serverId: string; resourceTypes: string[]; direction: string }) => {
      const response = await apiRequest("POST", "/api/fhir-bidirectional-sync/jobs/start", { serverId, resourceTypes, direction });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/dashboard"] });
    },
  });

  const pauseJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/fhir-bidirectional-sync/jobs/${jobId}/pause`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/jobs"] });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/fhir-bidirectional-sync/jobs/${jobId}/resume`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/jobs"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const syncJobs = jobs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Sync Jobs</h3>
          <p className="text-sm text-muted-foreground">Manage and monitor synchronization jobs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-jobs">
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (servers && servers.length > 0) {
                startJobMutation.mutate({
                  serverId: servers[0].id,
                  resourceTypes: ["Patient", "Condition", "Medication"],
                  direction: "bidirectional",
                });
              }
            }}
            disabled={startJobMutation.isPending || !servers?.length}
            data-testid="button-start-sync"
          >
            {startJobMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start New Sync
          </Button>
        </div>
      </div>

      {syncJobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Sync Jobs</p>
            <p className="text-muted-foreground">Start a new synchronization job to begin</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {syncJobs.map((job) => {
            const progress = job.totalRecords > 0 ? Math.round((job.processedRecords / job.totalRecords) * 100) : 0;
            const serverName = servers?.find((s) => s.id === job.serverId)?.name || job.serverId;
            return (
              <Card key={job.id} data-testid={`card-job-${job.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{serverName}</span>
                        <Badge className={statusColors[job.status] || ""}>{job.status}</Badge>
                        <Badge variant="outline">
                          {job.direction === "bidirectional" ? (
                            <ArrowLeftRight className="h-3 w-3 mr-1" />
                          ) : job.direction === "inbound" ? (
                            <ArrowDownToLine className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowUpFromLine className="h-3 w-3 mr-1" />
                          )}
                          {job.direction}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span>Resources: {job.resourceTypes.join(", ")}</span>
                        <span>Started: {new Date(job.startedAt).toLocaleString()}</span>
                        <span>Triggered by: {job.triggeredBy}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === "running" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => pauseJobMutation.mutate(job.id)}
                          disabled={pauseJobMutation.isPending}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {job.status === "paused" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resumeJobMutation.mutate(job.id)}
                          disabled={resumeJobMutation.isPending}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{job.processedRecords} / {job.totalRecords} records ({progress}%)</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="grid grid-cols-5 gap-4 mt-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-yellow-500">{job.pendingReview}</p>
                      <p className="text-xs text-muted-foreground">Pending Review</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-500">{job.approved}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">{job.rejected}</p>
                      <p className="text-xs text-muted-foreground">Rejected</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-500">{job.autoApplied}</p>
                      <p className="text-xs text-muted-foreground">Auto-Applied</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-500">{job.conflicts}</p>
                      <p className="text-xs text-muted-foreground">Conflicts</p>
                    </div>
                  </div>

                  {job.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                        <XCircle className="h-4 w-4" /> {job.errors.length} Error(s)
                      </p>
                      <ul className="mt-2 space-y-1">
                        {job.errors.slice(0, 3).map((error, i) => (
                          <li key={i} className="text-xs text-red-600 dark:text-red-400">
                            {error.resourceType}/{error.resourceId}: {error.errorMessage}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfigurationTab() {
  const { data: servers, isLoading: loadingServers } = useQuery<FHIRServer[]>({
    queryKey: ["/api/fhir-bidirectional-sync/servers"],
  });

  const { data: configurations, isLoading: loadingConfigs, refetch } = useQuery({
    queryKey: ["/api/fhir-bidirectional-sync/configurations"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ configId, updates }: { configId: string; updates: Record<string, unknown> }) => {
      const response = await apiRequest("PATCH", `/api/fhir-bidirectional-sync/configurations/${configId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-bidirectional-sync/configurations"] });
    },
  });

  if (loadingServers || loadingConfigs) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold">Sync Configuration</h3>
          <p className="text-sm text-muted-foreground">Configure bidirectional synchronization settings for each server and resource</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-config">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {servers?.map((server) => (
          <Card key={server.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{server.name}</CardTitle>
                    <CardDescription className="text-xs">{server.endpoint}</CardDescription>
                  </div>
                </div>
                <Badge className={server.isActive ? statusColors.healthy : statusColors.offline}>
                  {server.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div>
                  <FieldCaption className="text-xs text-muted-foreground">Auth Type</FieldCaption>
                  <p className="font-medium">{server.authType}</p>
                </div>
                <div>
                  <FieldCaption className="text-xs text-muted-foreground">Sync Direction</FieldCaption>
                  <p className="font-medium capitalize">{server.syncDirection}</p>
                </div>
                <div>
                  <FieldCaption className="text-xs text-muted-foreground">Conflict Strategy</FieldCaption>
                  <p className="font-medium capitalize">{server.conflictStrategy.replace("_", " ")}</p>
                </div>
                <div>
                  <FieldCaption className="text-xs text-muted-foreground">Auto-Approve Threshold</FieldCaption>
                  <p className="font-medium">{Math.round(server.autoApproveThreshold * 100)}%</p>
                </div>
              </div>

              <div>
                <FieldCaption className="text-xs text-muted-foreground mb-2 block">Supported Resources</FieldCaption>
                <div className="flex flex-wrap gap-2">
                  {server.supportedResources.map((resource) => {
                    const Icon = resourceIcons[resource] || FileText;
                    return (
                      <Badge key={resource} variant="secondary" className="flex items-center gap-1">
                        <Icon className="h-3 w-3" /> {resource}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {server.lastSyncAt && (
                <p className="text-xs text-muted-foreground mt-4">
                  Last sync: {new Date(server.lastSyncAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function FhirBidirectionalSync() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="p-6 space-y-6" data-testid="page-fhir-bidirectional-sync">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
            Bidirectional FHIR Sync
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage bidirectional synchronization for Patient, Condition, and Medication resources
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Changes
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Activity className="h-4 w-4 mr-2" />
            Sync Jobs
          </TabsTrigger>
          <TabsTrigger value="config" data-testid="tab-config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="pending">
          <PendingChangesTab />
        </TabsContent>

        <TabsContent value="jobs">
          <SyncJobsTab />
        </TabsContent>

        <TabsContent value="config">
          <ConfigurationTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
