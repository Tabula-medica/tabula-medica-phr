import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Switch } from "@/components/ui/switch";
import { 
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Loader2,
  Shield,
  FileCheck,
  Sparkles,
  ClipboardCheck,
  Eye,
  Edit3,
  Check,
  X,
  ChevronRight,
  BarChart3,
  ListChecks,
  Settings,
  Wand2
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface ValidationIssue {
  id: string;
  resourceType: string;
  resourceId: string;
  ruleId: string;
  ruleName: string;
  category: string;
  severity: "error" | "warning" | "info";
  fieldPath: string;
  currentValue: any;
  expectedValue?: string;
  message: string;
  status: "open" | "in_review" | "corrected" | "ignored" | "escalated";
  aiSuggestion?: AISuggestion;
  correctedValue?: any;
  correctedBy?: string;
  correctedAt?: string;
  notes?: string;
  detectedAt: string;
}

interface AISuggestion {
  id: string;
  issueId: string;
  suggestedValue: any;
  confidence: number;
  rationale: string;
  sources?: string[];
  generatedAt: string;
  disclaimer: string;
}

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  category: string;
  severity: string;
  fieldPath: string;
  enabled: boolean;
}

interface Dashboard {
  summary: {
    totalIssues: number;
    openIssues: number;
    criticalIssues: number;
    aiSuggestionsAvailable: number;
    resourcesWithIssues: number;
  };
  issuesByStatus: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  issuesByCategory: Record<string, number>;
  issuesByResource: Record<string, number>;
  latestScan?: any;
  recentIssues: ValidationIssue[];
  rules: ValidationRule[];
  disclaimer: string;
}

export default function FhirDataQuality() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedIssue, setSelectedIssue] = useState<ValidationIssue | null>(null);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [correctionValue, setCorrectionValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<Dashboard>({
    queryKey: ["/api/fhir-data-quality/dashboard"],
  });

  const { data: issuesData, isLoading: loadingIssues } = useQuery<{ issues: ValidationIssue[]; total: number }>({
    queryKey: ["/api/fhir-data-quality/issues"],
  });

  const { data: rulesData } = useQuery<{ rules: ValidationRule[]; total: number }>({
    queryKey: ["/api/fhir-data-quality/rules"],
  });

  const scanMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/fhir-data-quality/scan"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-quality"] });
    },
  });

  const generateSuggestionMutation = useMutation({
    mutationFn: (issueId: string) => apiRequest("POST", `/api/fhir-data-quality/issues/${issueId}/suggestion`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-quality/issues"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ issueId, status, notes }: { issueId: string; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/fhir-data-quality/issues/${issueId}/status`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-quality"] });
    },
  });

  const applyCorrectionMutation = useMutation({
    mutationFn: ({ issueId, correctedValue }: { issueId: string; correctedValue: any }) =>
      apiRequest("POST", `/api/fhir-data-quality/issues/${issueId}/correct`, { correctedValue }),
    onSuccess: () => {
      setShowCorrectionDialog(false);
      setSelectedIssue(null);
      setCorrectionValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-quality"] });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/fhir-data-quality/rules/${ruleId}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-data-quality/rules"] });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <XCircle className="w-4 h-4 text-red-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "info": return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error": return <Badge className="bg-red-500 text-white">Error</Badge>;
      case "warning": return <Badge className="bg-amber-500 text-black">Warning</Badge>;
      case "info": return <Badge className="bg-blue-500 text-white">Info</Badge>;
      default: return <Badge>{severity}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open": return <Badge variant="outline" className="border-red-300 text-red-600">Open</Badge>;
      case "in_review": return <Badge variant="outline" className="border-amber-300 text-amber-600">In Review</Badge>;
      case "corrected": return <Badge className="bg-green-500 text-white">Corrected</Badge>;
      case "ignored": return <Badge variant="outline" className="border-gray-300 text-gray-600">Ignored</Badge>;
      case "escalated": return <Badge className="bg-purple-500 text-white">Escalated</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      required_field: "Required Field",
      data_type: "Data Type",
      timestamp: "Timestamp",
      reference: "Reference",
      code_system: "Code System",
      consistency: "Consistency",
      completeness: "Completeness",
      format: "Format"
    };
    return labels[category] || category;
  };

  const filteredIssues = issuesData?.issues?.filter(issue => {
    if (statusFilter !== "all" && issue.status !== statusFilter) return false;
    if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
    if (resourceFilter !== "all" && issue.resourceType !== resourceFilter) return false;
    return true;
  }) || [];

  const handleApplySuggestion = (issue: ValidationIssue) => {
    if (issue.aiSuggestion?.suggestedValue !== undefined) {
      setCorrectionValue(typeof issue.aiSuggestion.suggestedValue === "object" 
        ? JSON.stringify(issue.aiSuggestion.suggestedValue, null, 2)
        : String(issue.aiSuggestion.suggestedValue));
      setSelectedIssue(issue);
      setShowCorrectionDialog(true);
    }
  };

  const handleManualCorrection = (issue: ValidationIssue) => {
    setCorrectionValue(issue.currentValue !== undefined 
      ? (typeof issue.currentValue === "object" 
        ? JSON.stringify(issue.currentValue, null, 2)
        : String(issue.currentValue))
      : "");
    setSelectedIssue(issue);
    setShowCorrectionDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCheck className="w-8 h-8 text-primary" />
            FHIR Data Quality
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated validation and AI-powered data correction
          </p>
        </div>
        <Button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          data-testid="button-run-scan"
        >
          {scanMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Run Validation Scan
        </Button>
      </div>

      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
        <Shield className="w-4 h-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
          <strong>NO-CDS Disclaimer:</strong> AI suggestions are for informational purposes only. 
          All corrections must be reviewed and approved by qualified personnel. 
          This is NOT clinical decision support.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-issues">
            <ListChecks className="w-4 h-4 mr-2" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="w-4 h-4 mr-2" />
            Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loadingDashboard ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard?.summary.totalIssues || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Open Issues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-500">{dashboard?.summary.openIssues || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Critical (Errors)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">{dashboard?.summary.criticalIssues || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">AI Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-purple-500">{dashboard?.summary.aiSuggestionsAvailable || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Affected Resources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dashboard?.summary.resourcesWithIssues || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Issues by Severity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span>Errors</span>
                        </div>
                        <Badge className="bg-red-500 text-white">{dashboard?.issuesBySeverity?.error || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                          <span>Warnings</span>
                        </div>
                        <Badge className="bg-amber-500 text-black">{dashboard?.issuesBySeverity?.warning || 0}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Info className="w-5 h-5 text-blue-500" />
                          <span>Info</span>
                        </div>
                        <Badge className="bg-blue-500 text-white">{dashboard?.issuesBySeverity?.info || 0}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Issues by Resource Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard?.issuesByResource || {}).map(([resourceType, count]) => (
                        <div key={resourceType} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <span>{resourceType}</span>
                          <Badge variant="outline">{count as number}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Recent Issues</CardTitle>
                    <CardDescription>Latest validation issues detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dashboard?.recentIssues?.slice(0, 5).map((issue) => (
                        <div
                          key={issue.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                          {...clickable(() => {
                            setSelectedIssue(issue);
                            setActiveTab("issues");
                          })}
                          data-testid={`recent-issue-${issue.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {getSeverityIcon(issue.severity)}
                            <div>
                              <p className="font-medium">{issue.message}</p>
                              <p className="text-xs text-muted-foreground">
                                {issue.resourceType}/{issue.resourceId} - {issue.fieldPath}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(issue.status)}
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="corrected">Corrected</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40" data-testid="filter-severity">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-48" data-testid="filter-resource">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="Patient">Patient</SelectItem>
                <SelectItem value="Condition">Condition</SelectItem>
                <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                <SelectItem value="Observation">Observation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingIssues ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIssues.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <div className="text-center text-muted-foreground">
                      <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>No issues found matching your filters</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                filteredIssues.map((issue) => (
                  <Card key={issue.id} className={selectedIssue?.id === issue.id ? "ring-2 ring-primary" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityIcon(issue.severity)}
                            <span className="font-semibold">{issue.message}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {getSeverityBadge(issue.severity)}
                            {getStatusBadge(issue.status)}
                            <Badge variant="outline">{getCategoryLabel(issue.category)}</Badge>
                            <Badge variant="outline">{issue.resourceType}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Resource:</strong> {issue.resourceType}/{issue.resourceId}</p>
                            <p><strong>Field:</strong> {issue.fieldPath}</p>
                            <p><strong>Current Value:</strong> {JSON.stringify(issue.currentValue)}</p>
                            {issue.expectedValue && <p><strong>Expected:</strong> {issue.expectedValue}</p>}
                          </div>

                          {issue.aiSuggestion && (
                            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                <span className="font-medium text-purple-700 dark:text-purple-300">AI Suggestion</span>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(issue.aiSuggestion.confidence * 100)}% confidence
                                </Badge>
                              </div>
                              <p className="text-sm mb-2">
                                <strong>Suggested:</strong> {JSON.stringify(issue.aiSuggestion.suggestedValue)}
                              </p>
                              <p className="text-sm text-muted-foreground">{issue.aiSuggestion.rationale}</p>
                            </div>
                          )}

                          {issue.status === "corrected" && (
                            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="font-medium text-green-700 dark:text-green-300">Corrected</span>
                              </div>
                              <p className="text-sm">
                                <strong>New Value:</strong> {JSON.stringify(issue.correctedValue)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                By {issue.correctedBy} on {new Date(issue.correctedAt!).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {issue.status === "open" && (
                            <>
                              {!issue.aiSuggestion ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateSuggestionMutation.mutate(issue.id)}
                                  disabled={generateSuggestionMutation.isPending}
                                  data-testid={`button-suggest-${issue.id}`}
                                >
                                  {generateSuggestionMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Wand2 className="w-4 h-4 mr-1" />
                                  )}
                                  AI Suggest
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleApplySuggestion(issue)}
                                  data-testid={`button-apply-${issue.id}`}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Apply
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleManualCorrection(issue)}
                                data-testid={`button-edit-${issue.id}`}
                              >
                                <Edit3 className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateStatusMutation.mutate({ issueId: issue.id, status: "ignored" })}
                                data-testid={`button-ignore-${issue.id}`}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Ignore
                              </Button>
                            </>
                          )}
                          {issue.status === "in_review" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleManualCorrection(issue)}
                              data-testid={`button-review-${issue.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation Rules</CardTitle>
              <CardDescription>Configure which validation rules are active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rulesData?.rules?.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{rule.name}</span>
                        {getSeverityBadge(rule.severity)}
                        <Badge variant="outline">{rule.resourceType}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Field: <code className="bg-muted px-1 rounded">{rule.fieldPath}</code>
                      </p>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) => toggleRuleMutation.mutate({ ruleId: rule.id, enabled })}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Correction</DialogTitle>
            <DialogDescription>
              Review and apply the corrected value for this issue.
            </DialogDescription>
          </DialogHeader>
          {selectedIssue && (
            <div className="space-y-4">
              <div>
                <FieldCaption>Issue</FieldCaption>
                <p className="text-sm text-muted-foreground">{selectedIssue.message}</p>
              </div>
              <div>
                <FieldCaption>Current Value</FieldCaption>
                <p className="text-sm font-mono bg-muted p-2 rounded">
                  {JSON.stringify(selectedIssue.currentValue)}
                </p>
              </div>
              <div>
                <Label htmlFor="correction">Corrected Value</Label>
                <Textarea
                  id="correction"
                  value={correctionValue}
                  onChange={(e) => setCorrectionValue(e.target.value)}
                  placeholder="Enter the corrected value"
                  rows={4}
                  data-testid="input-correction"
                />
              </div>
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  By applying this correction, you confirm that you have reviewed the value 
                  and take responsibility for the data change.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCorrectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedIssue) {
                  let parsedValue: any;
                  try {
                    parsedValue = JSON.parse(correctionValue);
                  } catch {
                    parsedValue = correctionValue;
                  }
                  applyCorrectionMutation.mutate({
                    issueId: selectedIssue.id,
                    correctedValue: parsedValue
                  });
                }
              }}
              disabled={applyCorrectionMutation.isPending}
              data-testid="button-confirm-correction"
            >
              {applyCorrectionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ClipboardCheck className="w-4 h-4 mr-2" />
              )}
              Apply Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
