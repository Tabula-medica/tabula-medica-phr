import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Clock, Play, Square, Zap, AlertTriangle, Info, RefreshCw, Wand2, FileCheck, TrendingUp, Activity, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ConformanceIssue {
  id: string;
  resourceId: string;
  resourceType: string;
  profileId: string;
  profileName: string;
  severity: "error" | "warning" | "info";
  category: string;
  element: string;
  message: string;
  actualValue?: string;
  expectedValue?: string;
  suggestion?: string;
  autoFixable: boolean;
  detectedAt: string;
  status: "open" | "fixed" | "ignored" | "pending-review";
}

interface ConformanceScanResult {
  scanId: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  resourcesScanned: number;
  resourcesPassed: number;
  resourcesFailed: number;
  totalIssues: number;
  criticalIssues: number;
  autoFixableIssues: number;
  profileBreakdown: Record<string, { passed: number; failed: number }>;
}

interface DashboardStats {
  totalResources: number;
  conformantResources: number;
  nonConformantResources: number;
  conformanceRate: number;
  openIssues: number;
  criticalIssues: number;
  autoFixableIssues: number;
  recentScans: ConformanceScanResult[];
  issuesByProfile: Record<string, number>;
  issuesByCategory: Record<string, number>;
  trendData: { date: string; conformanceRate: number; issues: number }[];
  topFailingResources: { resourceId: string; resourceType: string; issueCount: number }[];
}

interface ConformanceProfile {
  id: string;
  name: string;
  resourceType: string;
  category: string;
  isActive: boolean;
}

export function FHIRConformanceDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["/api/fhir-conformance/dashboard"],
    refetchInterval: 30000,
  });

  const { data: issuesData, isLoading: issuesLoading, refetch: refetchIssues } = useQuery<{ issues: ConformanceIssue[] }>({
    queryKey: ["/api/fhir-conformance/issues", statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const response = await fetch(`/api/fhir-conformance/issues?${params.toString()}`);
      return response.json();
    },
  });

  const { data: profilesData } = useQuery<{ profiles: ConformanceProfile[] }>({
    queryKey: ["/api/fhir-conformance/profiles"],
  });

  const { data: schedulerData, refetch: refetchScheduler } = useQuery<{ isActive: boolean; lastScan: string | null }>({
    queryKey: ["/api/fhir-conformance/scheduler/status"],
  });

  const runScanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-conformance/scan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-conformance"] });
      toast({ title: "Conformance scan completed" });
    },
    onError: (error: Error) => {
      toast({ title: "Scan failed", description: error.message, variant: "destructive" });
    },
  });

  const startSchedulerMutation = useMutation({
    mutationFn: async (intervalMinutes: number) => {
      const response = await apiRequest("POST", "/api/fhir-conformance/scheduler/start", { intervalMinutes });
      return response.json();
    },
    onSuccess: () => {
      refetchScheduler();
      toast({ title: "Background scheduler started" });
    },
  });

  const stopSchedulerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-conformance/scheduler/stop");
      return response.json();
    },
    onSuccess: () => {
      refetchScheduler();
      toast({ title: "Background scheduler stopped" });
    },
  });

  const autoFixMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const response = await apiRequest("POST", `/api/fhir-conformance/auto-fix/${issueId}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-conformance"] });
      toast({ title: "Auto-fix applied", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Auto-fix failed", description: error.message, variant: "destructive" });
    },
  });

  const batchAutoFixMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      const response = await apiRequest("POST", "/api/fhir-conformance/auto-fix-batch", { issueIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-conformance"] });
      setSelectedIssues([]);
      toast({ title: "Batch auto-fix complete", description: `${data.successful} fixed, ${data.failed} failed` });
    },
  });

  const aiSuggestionsMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      const response = await apiRequest("POST", "/api/fhir-conformance/ai-suggestions", { issueIds });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "AI suggestions generated" });
    },
  });

  const updateIssueStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/fhir-conformance/issues/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-conformance"] });
    },
  });

  const stats = dashboardData?.stats;
  const issues = issuesData?.issues || [];
  const profiles = profilesData?.profiles || [];

  const handleSelectIssue = (issueId: string, checked: boolean) => {
    if (checked) {
      setSelectedIssues((prev) => [...prev, issueId]);
    } else {
      setSelectedIssues((prev) => prev.filter((id) => id !== issueId));
    }
  };

  const handleSelectAllAutoFixable = () => {
    const autoFixableIds = issues.filter((i) => i.autoFixable && i.status === "open").map((i) => i.id);
    setSelectedIssues(autoFixableIds);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline">Open</Badge>;
      case "fixed":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Fixed</Badge>;
      case "ignored":
        return <Badge variant="secondary">Ignored</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading conformance dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-conformance-title">FHIR Conformance Checking</h2>
          <p className="text-muted-foreground">Monitor and enforce FHIR profile conformance across all resources</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchDashboard();
              refetchIssues();
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => runScanMutation.mutate()}
            disabled={runScanMutation.isPending}
            data-testid="button-run-scan"
          >
            {runScanMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run Scan
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conformance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-conformance-rate">{stats?.conformanceRate || 0}%</div>
            <Progress value={stats?.conformanceRate || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.conformantResources || 0} of {stats?.totalResources || 0} resources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-open-issues">{stats?.openIssues || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.criticalIssues || 0} critical errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Fixable</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-auto-fixable">{stats?.autoFixableIssues || 0}</div>
            <p className="text-xs text-muted-foreground">
              Can be automatically corrected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Background Scheduler</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Switch
                checked={schedulerData?.isActive || false}
                onCheckedChange={(checked) => {
                  if (checked) {
                    startSchedulerMutation.mutate(60);
                  } else {
                    stopSchedulerMutation.mutate();
                  }
                }}
                data-testid="switch-scheduler"
              />
              <span className="text-sm">{schedulerData?.isActive ? "Active" : "Inactive"}</span>
            </div>
            {schedulerData?.lastScan && (
              <p className="text-xs text-muted-foreground mt-1">
                Last: {new Date(schedulerData.lastScan).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-issues">
            <AlertCircle className="h-4 w-4 mr-2" />
            Issues ({stats?.openIssues || 0})
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileCheck className="h-4 w-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Issues by Profile</CardTitle>
                <CardDescription>Distribution of conformance issues across profiles</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.issuesByProfile && Object.keys(stats.issuesByProfile).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.issuesByProfile).map(([profileId, count]) => {
                      const profile = profiles.find((p) => p.id === profileId);
                      return (
                        <div key={profileId} className="flex items-center justify-between">
                          <span className="text-sm">{profile?.name || profileId}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No issues found</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Issues by Category</CardTitle>
                <CardDescription>Types of conformance violations detected</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.issuesByCategory && Object.keys(stats.issuesByCategory).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.issuesByCategory).map(([category, count]) => (
                      <div key={category} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{category.replace(/-/g, " ")}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No issues found</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Failing Resources</CardTitle>
              <CardDescription>Resources with the most conformance issues</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.topFailingResources && stats.topFailingResources.length > 0 ? (
                <div className="space-y-3">
                  {stats.topFailingResources.map((resource) => (
                    <div key={resource.resourceId} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{resource.resourceType}</Badge>
                        <span className="text-sm font-mono">{resource.resourceId}</span>
                      </div>
                      <Badge variant="destructive">{resource.issueCount} issues</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mr-2 text-green-500" />
                  All resources are conformant!
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Scans</CardTitle>
              <CardDescription>History of conformance validation scans</CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentScans && stats.recentScans.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {stats.recentScans.map((scan) => (
                      <div key={scan.scanId} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="flex items-center gap-2">
                          {scan.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : scan.status === "running" ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="text-sm">{new Date(scan.startedAt).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-green-500">{scan.resourcesPassed} passed</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-destructive">{scan.resourcesFailed} failed</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-4">No scans yet. Run a scan to start.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conformance Issues</CardTitle>
                  <CardDescription>Resources failing profile validation</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="ignored">Ignored</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[120px]" data-testid="select-severity-filter">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                      <SelectItem value="warning">Warnings</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedIssues.length > 0 && (
                <div className="flex items-center gap-2 mb-4 p-2 rounded-md bg-muted">
                  <span className="text-sm">{selectedIssues.length} selected</span>
                  <Button
                    size="sm"
                    onClick={() => batchAutoFixMutation.mutate(selectedIssues)}
                    disabled={batchAutoFixMutation.isPending}
                    data-testid="button-batch-fix"
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Auto-Fix Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => aiSuggestionsMutation.mutate(selectedIssues)}
                    disabled={aiSuggestionsMutation.isPending}
                    data-testid="button-ai-suggestions"
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Get AI Suggestions
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIssues([])}>
                    Clear
                  </Button>
                </div>
              )}

              <div className="mb-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllAutoFixable}
                  data-testid="button-select-auto-fixable"
                >
                  Select All Auto-Fixable
                </Button>
              </div>

              {issuesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : issues.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-start gap-3 p-3 rounded-md border hover-elevate"
                        data-testid={`issue-${issue.id}`}
                      >
                        <Checkbox
                          checked={selectedIssues.includes(issue.id)}
                          onCheckedChange={(checked) => handleSelectIssue(issue.id, checked as boolean)}
                          disabled={!issue.autoFixable}
                          data-testid={`checkbox-issue-${issue.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getSeverityIcon(issue.severity)}
                            <Badge variant="outline">{issue.resourceType}</Badge>
                            <span className="text-sm font-mono truncate">{issue.resourceId}</span>
                            {getSeverityBadge(issue.severity)}
                            {getStatusBadge(issue.status)}
                            {issue.autoFixable && (
                              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                <Zap className="h-3 w-3 mr-1" />
                                Auto-Fixable
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm mt-1">{issue.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Element:</span> {issue.element} |{" "}
                            <span className="font-medium">Profile:</span> {issue.profileName}
                          </p>
                          {issue.suggestion && (
                            <p className="text-xs text-blue-500 mt-1">{issue.suggestion}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {issue.autoFixable && issue.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => autoFixMutation.mutate(issue.id)}
                              disabled={autoFixMutation.isPending}
                              data-testid={`button-fix-${issue.id}`}
                            >
                              <Zap className="h-3 w-3" />
                            </Button>
                          )}
                          {issue.status === "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateIssueStatusMutation.mutate({ id: issue.id, status: "ignored" })}
                              data-testid={`button-ignore-${issue.id}`}
                            >
                              Ignore
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                  <p>No issues found matching your filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Conformance Profiles</CardTitle>
              <CardDescription>Profiles used for validation (US Core, CARIN, mCODE, etc.)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {profiles.map((profile) => (
                  <Card key={profile.id} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{profile.name}</CardTitle>
                        <Badge variant={profile.isActive ? "default" : "secondary"}>
                          {profile.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">Resource Type:</span> {profile.resourceType}</p>
                        <p><span className="text-muted-foreground">Category:</span> <Badge variant="outline" className="capitalize">{profile.category}</Badge></p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Background Scheduler Settings</CardTitle>
              <CardDescription>Configure automated conformance validation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable Background Validation</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically validate all resources against their declared profiles
                  </p>
                </div>
                <Switch
                  checked={schedulerData?.isActive || false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      startSchedulerMutation.mutate(60);
                    } else {
                      stopSchedulerMutation.mutate();
                    }
                  }}
                  data-testid="switch-scheduler-settings"
                />
              </div>

              <div className="flex items-center gap-4">
                <p className="text-sm font-medium">Scan Interval:</p>
                <Select
                  defaultValue="60"
                  onValueChange={(value) => {
                    if (schedulerData?.isActive) {
                      stopSchedulerMutation.mutate();
                      setTimeout(() => startSchedulerMutation.mutate(parseInt(value)), 500);
                    }
                  }}
                >
                  <SelectTrigger className="w-[150px]" data-testid="select-scan-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="1440">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {schedulerData?.lastScan && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Last scan: {new Date(schedulerData.lastScan).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manual Actions</CardTitle>
              <CardDescription>Trigger conformance operations manually</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={() => runScanMutation.mutate()}
                disabled={runScanMutation.isPending}
                data-testid="button-manual-scan"
              >
                {runScanMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Run Full Conformance Scan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
