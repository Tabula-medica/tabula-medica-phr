import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  GitMerge,
  History,
  Layers,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  ShieldAlert,
  Eye,
  CheckCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import type {
  CareTeamDataQualityDashboard,
  DataQualityIssue,
  DataQualityAction,
} from "@shared/schema";

const severityColors = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
} as const;

const severityIcons = {
  critical: AlertTriangle,
  high: AlertTriangle,
  medium: FileWarning,
  low: Clock,
};

const statusColors = {
  open: "destructive",
  in_review: "secondary",
  resolved: "default",
  dismissed: "outline",
} as const;

const recordTypeLabels: Record<string, string> = {
  medication: "Medications",
  lab_result: "Lab Results",
  document: "Documents",
  condition: "Conditions",
  allergy: "Allergies",
};

const issueTypeLabels: Record<string, string> = {
  duplicate_record: "Duplicate Record",
  missing_required_field: "Missing Field",
  invalid_code_system: "Invalid Code",
  inconsistent_data: "Inconsistent Data",
  stale_record: "Stale Record",
  normalization_error: "Normalization Error",
  source_conflict: "Source Conflict",
};

export default function DataQualityDashboard() {
  const { toast } = useToast();
  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"merge" | "confirm" | "dismiss" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [validationPatientFilter, setValidationPatientFilter] = useState<string>("all");
  const [validationResourceFilter, setValidationResourceFilter] = useState<string>("all");
  const [validationSeverityFilter, setValidationSeverityFilter] = useState<string>("all");
  const [validationStatusFilter, setValidationStatusFilter] = useState<string>("open");
  const [selectedValidationFailure, setSelectedValidationFailure] = useState<any | null>(null);
  const [validationActionDialogOpen, setValidationActionDialogOpen] = useState(false);
  const [validationActionNotes, setValidationActionNotes] = useState("");

  const { data: dashboard, isLoading } = useQuery<CareTeamDataQualityDashboard>({
    queryKey: ["/api/care-team/data-quality/dashboard"],
  });

  const { data: issuesData } = useQuery<{ issues: DataQualityIssue[]; total: number }>({
    queryKey: ["/api/care-team/data-quality/issues", statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const response = await fetch(`/api/care-team/data-quality/issues?${params}`);
      if (!response.ok) throw new Error("Failed to fetch issues");
      return response.json();
    },
  });

  const { data: validationSummary } = useQuery<{ summary: { totalFailures: number; criticalCount: number; errorCount: number; warningCount: number; openCount: number; acknowledgedCount: number; correctedCount: number; byResourceType: Record<string, number>; byPatient: Record<string, { name: string; count: number }> } }>({
    queryKey: ["/api/fhir-validation/summary"],
  });

  const { data: validationFailures } = useQuery<{ failures: Array<{ id: string; ruleId: string; ruleName: string; patientId: string; patientName: string; resourceType: string; resourceId: string; severity: string; errorMessage: string; suggestion: string; fieldPath: string; actualValue?: string; expectedValue?: string; status: string; detectedAt: string; acknowledgedAt?: string; acknowledgedBy?: string; correctedAt?: string; correctedBy?: string; notes?: string }> }>({
    queryKey: ["/api/fhir-validation/failures", validationPatientFilter, validationResourceFilter, validationSeverityFilter, validationStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (validationPatientFilter !== "all") params.set("patientId", validationPatientFilter);
      if (validationResourceFilter !== "all") params.set("resourceType", validationResourceFilter);
      if (validationSeverityFilter !== "all") params.set("severity", validationSeverityFilter);
      if (validationStatusFilter !== "all") params.set("status", validationStatusFilter);
      const response = await fetch(`/api/fhir-validation/failures?${params}`);
      if (!response.ok) throw new Error("Failed to fetch validation failures");
      return response.json();
    },
  });

  const { data: validationPatients } = useQuery<{ patients: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/fhir-validation/patients"],
  });

  const { data: validationResourceTypes } = useQuery<{ resourceTypes: string[] }>({
    queryKey: ["/api/fhir-validation/resource-types"],
  });

  const updateValidationStatusMutation = useMutation({
    mutationFn: async ({ failureId, status, notes }: { failureId: string; status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/fhir-validation/failures/${failureId}/status`, { status, notes });
    },
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Validation failure status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-validation/failures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-validation/summary"] });
      setValidationActionDialogOpen(false);
      setSelectedValidationFailure(null);
      setValidationActionNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ issueId, notes }: { issueId: string; notes: string }) => {
      const issue = selectedIssue;
      if (!issue) throw new Error("No issue selected");
      return apiRequest("POST", `/api/care-team/data-quality/issues/${issueId}/merge`, {
        sourceRecordIds: issue.affectedRecordIds,
        targetRecordId: issue.affectedRecordIds[0],
        mergedValues: issue.details,
        notes,
      });
    },
    onSuccess: () => {
      toast({ title: "Records Merged", description: "The duplicate records have been merged successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/issues"] });
      setActionDialogOpen(false);
      setSelectedIssue(null);
      setActionNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to merge records. Please try again.", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ issueId, notes }: { issueId: string; notes: string }) => {
      return apiRequest("POST", `/api/care-team/data-quality/issues/${issueId}/confirm`, { notes });
    },
    onSuccess: () => {
      toast({ title: "Duplicate Confirmed", description: "The duplicate has been confirmed and resolved." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/issues"] });
      setActionDialogOpen(false);
      setSelectedIssue(null);
      setActionNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to confirm duplicate. Please try again.", variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ issueId, notes }: { issueId: string; notes: string }) => {
      return apiRequest("POST", `/api/care-team/data-quality/issues/${issueId}/dismiss`, { notes });
    },
    onSuccess: () => {
      toast({ title: "Issue Dismissed", description: "The issue has been dismissed." });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality/issues"] });
      setActionDialogOpen(false);
      setSelectedIssue(null);
      setActionNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to dismiss issue. Please try again.", variant: "destructive" });
    },
  });

  const handleAction = () => {
    if (!selectedIssue || !actionType) return;
    
    const payload = { issueId: selectedIssue.id, notes: actionNotes };
    
    switch (actionType) {
      case "merge":
        mergeMutation.mutate(payload);
        break;
      case "confirm":
        confirmMutation.mutate(payload);
        break;
      case "dismiss":
        dismissMutation.mutate(payload);
        break;
    }
  };

  const openActionDialog = (issue: DataQualityIssue, type: "merge" | "confirm" | "dismiss") => {
    setSelectedIssue(issue);
    setActionType(type);
    setActionNotes("");
    setActionDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-spinner">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const metrics = dashboard?.metrics;
  const severityChartData = metrics
    ? [
        { name: "Critical", value: metrics.issuesBySeverity.critical, fill: "hsl(var(--destructive))" },
        { name: "High", value: metrics.issuesBySeverity.high, fill: "hsl(var(--destructive))" },
        { name: "Medium", value: metrics.issuesBySeverity.medium, fill: "hsl(var(--secondary))" },
        { name: "Low", value: metrics.issuesBySeverity.low, fill: "hsl(var(--muted))" },
      ]
    : [];

  const recordTypeChartData = metrics
    ? Object.entries(metrics.issuesByRecordType).map(([key, value]) => ({
        name: recordTypeLabels[key] || key,
        value,
      }))
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="data-quality-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Data Quality Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and resolve data quality issues across patient records
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/care-team/data-quality"] })}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-issues">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-issues">{metrics?.totalIssues || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.issuesByStatus.open || 0} open, {metrics?.issuesByStatus.resolved || 0} resolved
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-duplicate-groups">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duplicate Groups</CardTitle>
            <GitMerge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-duplicate-groups">{metrics?.duplicateGroups || 0}</div>
            <p className="text-xs text-muted-foreground">Pending merge review</p>
          </CardContent>
        </Card>

        <Card data-testid="card-resolution-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            {(metrics?.resolutionRate || 0) > 50 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolution-rate">{metrics?.resolutionRate || 0}%</div>
            <Progress value={metrics?.resolutionRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card data-testid="card-resolved-this-week">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved This Week</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved-week">{metrics?.resolvedThisWeek || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg resolution: {metrics?.averageResolutionTimeHours || 0}h
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-severity-chart">
          <CardHeader>
            <CardTitle>Issues by Severity</CardTitle>
            <CardDescription>Distribution of data quality issues by severity level</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {severityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-record-type-chart">
          <CardHeader>
            <CardTitle>Issues by Record Type</CardTitle>
            <CardDescription>Breakdown of issues across different record categories</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recordTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-trend-chart">
        <CardHeader>
          <CardTitle>Issue Trend (Last 7 Days)</CardTitle>
          <CardDescription>Track open issues and resolution progress over time</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dashboard?.issuesTrend || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="open" stroke="hsl(var(--destructive))" strokeWidth={2} name="Open" />
              <Line type="monotone" dataKey="resolved" stroke="hsl(var(--primary))" strokeWidth={2} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList data-testid="tabs-quality">
          <TabsTrigger value="issues" data-testid="tab-issues">
            <FileWarning className="h-4 w-4 mr-2" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Validation Failures
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Severity:</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32" data-testid="select-severity-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {(issuesData?.issues || dashboard?.recentIssues || []).map((issue) => {
              const SeverityIcon = severityIcons[issue.severity];
              return (
                <Card key={issue.id} data-testid={`card-issue-${issue.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <SeverityIcon
                          className={`h-5 w-5 ${
                            issue.severity === "critical" || issue.severity === "high"
                              ? "text-destructive"
                              : issue.severity === "medium"
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div>
                          <CardTitle className="text-base">{issue.description}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Badge variant={severityColors[issue.severity]}>{issue.severity}</Badge>
                            <Badge variant="outline">{recordTypeLabels[issue.recordType]}</Badge>
                            <Badge variant={statusColors[issue.status]}>{issue.status}</Badge>
                            <span className="text-xs">{issueTypeLabels[issue.issueType]}</span>
                          </CardDescription>
                        </div>
                      </div>
                      {issue.status === "open" && (
                        <div className="flex items-center gap-2">
                          {issue.issueType === "duplicate_record" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openActionDialog(issue, "merge")}
                                data-testid={`button-merge-${issue.id}`}
                              >
                                <GitMerge className="h-4 w-4 mr-1" />
                                Merge
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openActionDialog(issue, "confirm")}
                                data-testid={`button-confirm-${issue.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Confirm
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openActionDialog(issue, "dismiss")}
                            data-testid={`button-dismiss-${issue.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {issue.details && (issue.details as any).records && (
                      <div className="mt-2 space-y-2">
                        <Label className="text-xs text-muted-foreground">Affected Records:</Label>
                        <div className="grid gap-2">
                          {((issue.details as any).records as any[]).slice(0, 3).map((record: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-sm p-2 bg-muted rounded-md flex items-center justify-between gap-2"
                            >
                              <span className="font-medium">{record.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {record.source}
                                </Badge>
                                {record.dosage && <span>{record.dosage}</span>}
                                {record.value && <span>{record.value}</span>}
                                {record.reaction && <span>{record.reaction}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {issue.suggestedAction && (
                          <div className="mt-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                            <span className="text-xs font-medium text-primary">Suggested: </span>
                            <span className="text-xs">{issue.suggestedAction}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {issue.resolvedBy && (
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
                        <Shield className="h-3 w-3" />
                        Resolved by {issue.resolvedBy} on {new Date(issue.resolvedAt!).toLocaleDateString()}
                        {issue.resolutionNote && ` - ${issue.resolutionNote}`}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {(issuesData?.issues || dashboard?.recentIssues || []).length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No data quality issues found matching your filters.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-600">{validationSummary?.summary.criticalCount || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Errors</p>
                    <p className="text-2xl font-bold text-orange-600">{validationSummary?.summary.errorCount || 0}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Warnings</p>
                    <p className="text-2xl font-bold text-yellow-600">{validationSummary?.summary.warningCount || 0}</p>
                  </div>
                  <FileWarning className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Corrected</p>
                    <p className="text-2xl font-bold text-green-600">{validationSummary?.summary.correctedCount || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Patient:</Label>
              <Select value={validationPatientFilter} onValueChange={setValidationPatientFilter}>
                <SelectTrigger className="w-40" data-testid="select-validation-patient">
                  <SelectValue placeholder="All Patients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Patients</SelectItem>
                  {validationPatients?.patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Resource:</Label>
              <Select value={validationResourceFilter} onValueChange={setValidationResourceFilter}>
                <SelectTrigger className="w-40" data-testid="select-validation-resource">
                  <SelectValue placeholder="All Resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Resources</SelectItem>
                  {validationResourceTypes?.resourceTypes.map((rt) => (
                    <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Severity:</Label>
              <Select value={validationSeverityFilter} onValueChange={setValidationSeverityFilter}>
                <SelectTrigger className="w-32" data-testid="select-validation-severity">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={validationStatusFilter} onValueChange={setValidationStatusFilter}>
                <SelectTrigger className="w-36" data-testid="select-validation-status">
                  <SelectValue placeholder="Open" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="corrected">Corrected</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Validation Failures ({validationFailures?.failures.length || 0})
              </CardTitle>
              <CardDescription>FHIR resources that violate validation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {validationFailures?.failures.map((failure) => (
                    <div key={failure.id} className="p-4 rounded-lg border" data-testid={`validation-failure-${failure.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{failure.ruleName}</span>
                            <Badge variant={failure.severity === "critical" ? "destructive" : failure.severity === "error" ? "secondary" : "outline"}>
                              {failure.severity}
                            </Badge>
                            <Badge variant={failure.status === "open" ? "destructive" : failure.status === "corrected" ? "default" : "secondary"}>
                              {failure.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-red-600 dark:text-red-400">{failure.errorMessage}</p>
                        </div>
                        <div className="flex gap-2">
                          {failure.status === "open" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setSelectedValidationFailure(failure); setValidationActionDialogOpen(true); }} data-testid={`button-acknowledge-${failure.id}`}>
                                <Eye className="h-4 w-4 mr-1" />Acknowledge
                              </Button>
                              <Button size="sm" onClick={() => updateValidationStatusMutation.mutate({ failureId: failure.id, status: "corrected" })} data-testid={`button-correct-${failure.id}`}>
                                <CheckCircle className="h-4 w-4 mr-1" />Mark Corrected
                              </Button>
                            </>
                          )}
                          {failure.status === "acknowledged" && (
                            <Button size="sm" onClick={() => updateValidationStatusMutation.mutate({ failureId: failure.id, status: "corrected" })} data-testid={`button-correct-${failure.id}`}>
                              <CheckCircle className="h-4 w-4 mr-1" />Mark Corrected
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-2">
                        <div>
                          <span className="text-muted-foreground">Patient:</span> {failure.patientName}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Resource:</span> {failure.resourceType}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Field:</span> <code className="text-xs bg-muted px-1 rounded">{failure.fieldPath}</code>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Detected:</span> {new Date(failure.detectedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {(failure.actualValue || failure.expectedValue) && (
                        <div className="text-sm mb-2 p-2 bg-muted/50 rounded">
                          {failure.actualValue && <p><span className="text-muted-foreground">Actual:</span> <span className="text-red-600">{failure.actualValue}</span></p>}
                          {failure.expectedValue && <p><span className="text-muted-foreground">Expected:</span> <span className="text-green-600">{failure.expectedValue}</span></p>}
                        </div>
                      )}
                      <div className="text-sm p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <span className="font-medium text-blue-700 dark:text-blue-300">Suggestion:</span> {failure.suggestion}
                      </div>
                      {failure.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">Notes: {failure.notes}</p>
                      )}
                      {failure.correctedAt && (
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Corrected by {failure.correctedBy} on {new Date(failure.correctedAt).toLocaleString()}
                        </p>
                      )}
                      {failure.acknowledgedAt && !failure.correctedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Acknowledged by {failure.acknowledgedBy} on {new Date(failure.acknowledgedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                  {(!validationFailures?.failures || validationFailures.failures.length === 0) && (
                    <div className="py-8 text-center text-muted-foreground">
                      <ShieldAlert className="h-12 w-12 mx-auto mb-4" />
                      <p>No validation failures found matching your filters.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                HIPAA Audit Trail
              </CardTitle>
              <CardDescription>
                Complete audit log of all data quality management actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(dashboard?.recentActions || []).map((action) => (
                  <div
                    key={action.id}
                    className="flex items-start justify-between p-3 border rounded-lg"
                    data-testid={`audit-entry-${action.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{action.actionType.replace(/_/g, " ")}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(action.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {action.notes && <p className="text-sm text-muted-foreground">{action.notes}</p>}
                      <div className="text-xs text-muted-foreground">
                        User: {action.userId} | IP: {action.ipAddress}
                      </div>
                    </div>
                  </div>
                ))}

                {(dashboard?.recentActions || []).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4" />
                    <p>No audit entries yet. Actions you take will appear here.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "merge" && "Merge Records"}
              {actionType === "confirm" && "Confirm Duplicate"}
              {actionType === "dismiss" && "Dismiss Issue"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "merge" &&
                "This will merge the duplicate records into a single canonical entry. This action will be logged for HIPAA compliance."}
              {actionType === "confirm" &&
                "Confirming this duplicate will mark it as reviewed and resolved. This action will be logged for HIPAA compliance."}
              {actionType === "dismiss" &&
                "Dismissing this issue indicates it is not a true data quality problem. Please provide a reason."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any relevant notes about this action..."
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                data-testid="input-action-notes"
              />
            </div>
            {selectedIssue && (
              <div className="p-3 bg-muted rounded-md">
                <Label className="text-xs">Affected Records:</Label>
                <p className="text-sm mt-1">{selectedIssue.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedIssue.affectedRecordIds.length} records will be affected
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} data-testid="button-cancel-action">
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={mergeMutation.isPending || confirmMutation.isPending || dismissMutation.isPending}
              data-testid="button-confirm-action"
            >
              {(mergeMutation.isPending || confirmMutation.isPending || dismissMutation.isPending) && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              {actionType === "merge" && "Merge Records"}
              {actionType === "confirm" && "Confirm Duplicate"}
              {actionType === "dismiss" && "Dismiss Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={validationActionDialogOpen} onOpenChange={setValidationActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Validation Failure</DialogTitle>
            <DialogDescription>
              Add notes to acknowledge this validation failure. This action will be logged for compliance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="validation-notes">Notes</Label>
              <Textarea
                id="validation-notes"
                placeholder="Add notes about this validation failure..."
                value={validationActionNotes}
                onChange={(e) => setValidationActionNotes(e.target.value)}
                data-testid="input-validation-notes"
              />
            </div>
            {selectedValidationFailure && (
              <div className="p-3 bg-muted rounded-md space-y-2">
                <p className="text-sm font-medium">{selectedValidationFailure.ruleName}</p>
                <p className="text-sm text-red-600">{selectedValidationFailure.errorMessage}</p>
                <p className="text-xs text-muted-foreground">
                  Patient: {selectedValidationFailure.patientName} | Resource: {selectedValidationFailure.resourceType}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationActionDialogOpen(false)} data-testid="button-cancel-validation">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedValidationFailure) {
                  updateValidationStatusMutation.mutate({
                    failureId: selectedValidationFailure.id,
                    status: "acknowledged",
                    notes: validationActionNotes,
                  });
                }
              }}
              disabled={updateValidationStatusMutation.isPending}
              data-testid="button-confirm-validation"
            >
              {updateValidationStatusMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
