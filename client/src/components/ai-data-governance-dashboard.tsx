import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Database,
  Eye,
  FileSearch,
  Lock,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface DataClassification {
  id: string;
  resourceId: string;
  resourceType: string;
  classificationLevel: string;
  phiElements: { fieldPath: string; phiType: string; confidence: number }[];
  sensitivityScore: number;
  classifiedAt: string;
  classifiedBy: string;
  aiConfidence?: number;
  reviewRequired: boolean;
  lastReviewedAt?: string;
}

interface DataQualityCheck {
  id: string;
  checkType: string;
  resourceType: string;
  fieldPath?: string;
  rule: string;
  severity: string;
  enabled: boolean;
  passRate?: number;
  lastRunAt?: string;
}

interface DataAnomaly {
  id: string;
  resourceId: string;
  resourceType: string;
  anomalyType: string;
  severity: string;
  description: string;
  affectedFields: string[];
  detectedAt: string;
  aiAnalysis?: string;
  resolved: boolean;
  falsePositive?: boolean;
}

interface DataAccessPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: { type: string; operator: string; value: string | string[] }[];
  actions: { type: string; fields?: string[]; maskingStrategy?: string }[];
  resourceTypes: string[];
  classificationLevels: string[];
}

interface GovernanceDashboard {
  summary: {
    totalResources: number;
    classifiedResources: number;
    phiResources: number;
    pendingReviews: number;
    activePolicies: number;
    qualityScore: number;
    anomaliesDetected: number;
    policyViolationsToday: number;
  };
  classificationBreakdown: Record<string, number>;
  qualityMetrics: {
    completeness: number;
    consistency: number;
    validity: number;
    timeliness: number;
    accuracy: number;
  };
  recentAnomalies: DataAnomaly[];
  recentViolations: { timestamp: string; userId: string; resourceType: string; policyName: string; action: string }[];
  trendData: { date: string; qualityScore: number; anomalies: number; violations: number }[];
}

export function AIDataGovernanceDashboard() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");

  const { data: dashboard, isLoading } = useQuery<GovernanceDashboard>({
    queryKey: ["/api/data-governance/dashboard"],
  });

  const classificationUrl = classificationFilter === "all"
    ? "/api/data-governance/classifications"
    : `/api/data-governance/classifications?level=${classificationFilter}`;

  const { data: classifications } = useQuery<DataClassification[]>({
    queryKey: [classificationUrl],
  });

  const { data: qualityChecks } = useQuery<DataQualityCheck[]>({
    queryKey: ["/api/data-governance/quality-checks"],
  });

  const anomalyUrl = anomalyFilter === "all"
    ? "/api/data-governance/anomalies?resolved=false"
    : `/api/data-governance/anomalies?severity=${anomalyFilter}&resolved=false`;

  const { data: anomalies } = useQuery<DataAnomaly[]>({
    queryKey: [anomalyUrl],
  });

  const { data: policies } = useQuery<DataAccessPolicy[]>({
    queryKey: ["/api/data-governance/policies"],
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/data-governance/generate-report");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Report Generated", description: "AI governance report has been generated." });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate report.", variant: "destructive" });
    },
  });

  const reviewClassificationMutation = useMutation({
    mutationFn: async ({ id, approved, newLevel }: { id: string; approved: boolean; newLevel?: string }) => {
      const response = await apiRequest("PATCH", `/api/data-governance/classifications/${id}/review`, {
        approved,
        newLevel,
        reviewedBy: "admin"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/classifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/dashboard"] });
      toast({ title: "Classification Reviewed", description: "Classification has been reviewed and updated." });
    },
  });

  const togglePolicyMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/data-governance/policies/${id}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/dashboard"] });
      toast({ title: "Policy Updated", description: "Policy status has been changed." });
    },
  });

  const resolveAnomalyMutation = useMutation({
    mutationFn: async ({ id, falsePositive }: { id: string; falsePositive: boolean }) => {
      const response = await apiRequest("POST", `/api/data-governance/anomalies/${id}/resolve`, { falsePositive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-governance/dashboard"] });
      toast({ title: "Anomaly Resolved", description: "Anomaly has been marked as resolved." });
    },
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  const getClassificationBadge = (level: string) => {
    const variants: Record<string, string> = {
      public: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      internal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      confidential: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      phi: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      highly_sensitive: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={variants[level] || variants.internal}>{level.replace("_", " ")}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      error: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={variants[severity] || variants.info}>{severity}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = dashboard?.summary;
  const qualityMetrics = dashboard?.qualityMetrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-governance-title">
            AI Data Governance
          </h2>
          <p className="text-muted-foreground">
            Intelligent data classification, quality monitoring, and policy enforcement
          </p>
        </div>
        <Button
          onClick={() => generateReportMutation.mutate()}
          disabled={generateReportMutation.isPending}
          data-testid="button-generate-report"
        >
          <Brain className="mr-2 h-4 w-4" />
          {generateReportMutation.isPending ? "Generating..." : "Generate AI Report"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PHI Resources</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-phi-resources">
              {summary?.phiResources || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              of {summary?.classifiedResources || 0} classified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-quality-score">
              {summary?.qualityScore || 0}%
            </div>
            <Progress value={summary?.qualityScore || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-anomalies">
              {summary?.anomaliesDetected || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              active issues detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-policies">
              {summary?.activePolicies || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.policyViolationsToday || 0} violations today
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Database className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="classifications" data-testid="tab-classifications">
            <FileSearch className="mr-2 h-4 w-4" />
            Classifications
          </TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">
            <CheckCircle className="mr-2 h-4 w-4" />
            Quality
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Anomalies
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">
            <Shield className="mr-2 h-4 w-4" />
            Policies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Classification Breakdown</CardTitle>
                <CardDescription>Distribution of data sensitivity levels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="classification-breakdown">
                  {dashboard?.classificationBreakdown && Object.entries(dashboard.classificationBreakdown).map(([level, count]) => (
                    <div key={level} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getClassificationBadge(level)}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(count / (summary?.classifiedResources || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quality Metrics</CardTitle>
                <CardDescription>Data quality dimensions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="quality-metrics">
                  {qualityMetrics && Object.entries(qualityMetrics).map(([metric, value]) => (
                    <div key={metric} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm capitalize">{metric}</span>
                        <span className="text-sm font-medium">{value.toFixed(1)}%</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Anomalies</CardTitle>
                <CardDescription>Latest data quality issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-recent-anomalies">
                  {dashboard?.recentAnomalies?.slice(0, 5).map((anomaly) => (
                    <div key={anomaly.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{anomaly.anomalyType.replace("_", " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{anomaly.resourceType}</p>
                      </div>
                      {getSeverityBadge(anomaly.severity)}
                    </div>
                  ))}
                  {(!dashboard?.recentAnomalies || dashboard.recentAnomalies.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No anomalies detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Violations</CardTitle>
                <CardDescription>Policy enforcement actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-recent-violations">
                  {dashboard?.recentViolations?.slice(0, 5).map((violation, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{violation.policyName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{violation.resourceType} - {violation.action}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(violation.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {(!dashboard?.recentViolations || dashboard.recentViolations.length === 0) && (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No violations today</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="classifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Data Classifications</CardTitle>
                  <CardDescription>AI-powered sensitivity classification for FHIR resources</CardDescription>
                </div>
                <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                  <SelectTrigger className="w-40" data-testid="select-classification-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="phi">PHI</SelectItem>
                    <SelectItem value="highly_sensitive">Highly Sensitive</SelectItem>
                    <SelectItem value="confidential">Confidential</SelectItem>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-classifications">
                {classifications?.slice(0, 20).map((classification) => (
                  <div key={classification.id} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{classification.resourceType}</span>
                          {getClassificationBadge(classification.classificationLevel)}
                          {classification.classifiedBy === "ai" && (
                            <Badge variant="outline" className="gap-1">
                              <Brain className="h-3 w-3" />
                              AI
                            </Badge>
                          )}
                          {classification.reviewRequired && (
                            <Badge variant="destructive">Review Required</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Resource ID: {classification.resourceId}
                        </p>
                        {classification.phiElements.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {classification.phiElements.map((el, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {el.phiType}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{classification.sensitivityScore}</div>
                        <p className="text-xs text-muted-foreground">Sensitivity</p>
                      </div>
                    </div>
                    {classification.reviewRequired && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewClassificationMutation.mutate({ id: classification.id, approved: true })}
                          data-testid={`button-approve-${classification.id}`}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewClassificationMutation.mutate({ id: classification.id, approved: false, newLevel: "phi" })}
                          data-testid={`button-escalate-${classification.id}`}
                        >
                          Escalate to PHI
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quality Checks</CardTitle>
              <CardDescription>Automated data quality validation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-quality-checks">
                {qualityChecks?.map((check) => (
                  <div key={check.id} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{check.checkType}</Badge>
                          <span className="font-medium">{check.resourceType}</span>
                          {check.fieldPath && <span className="text-muted-foreground">/ {check.fieldPath}</span>}
                          {getSeverityBadge(check.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground">{check.rule}</p>
                      </div>
                      <div className="text-right">
                        {check.passRate !== undefined && (
                          <>
                            <div className="text-lg font-bold">{check.passRate.toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">Pass Rate</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Switch checked={check.enabled} disabled />
                        <span className="text-sm">{check.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      {check.lastRunAt && (
                        <span className="text-xs text-muted-foreground">
                          Last run: {formatDate(check.lastRunAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Data Anomalies</CardTitle>
                  <CardDescription>AI-detected data quality issues and outliers</CardDescription>
                </div>
                <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
                  <SelectTrigger className="w-40" data-testid="select-anomaly-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-anomalies">
                {anomalies?.map((anomaly) => (
                  <div key={anomaly.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{anomaly.anomalyType.replace(/_/g, " ")}</span>
                          {getSeverityBadge(anomaly.severity)}
                          <Badge variant="outline">{anomaly.resourceType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{anomaly.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {anomaly.affectedFields.map((field, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{field}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatDate(anomaly.detectedAt)}
                      </div>
                    </div>
                    {anomaly.aiAnalysis && (
                      <div className="p-3 rounded-md bg-muted/50">
                        <p className="text-xs font-medium mb-1 flex items-center gap-1">
                          <Brain className="h-3 w-3" /> AI Analysis
                        </p>
                        <p className="text-sm text-muted-foreground">{anomaly.aiAnalysis}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveAnomalyMutation.mutate({ id: anomaly.id, falsePositive: true })}
                        data-testid={`button-false-positive-${anomaly.id}`}
                      >
                        False Positive
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => resolveAnomalyMutation.mutate({ id: anomaly.id, falsePositive: false })}
                        data-testid={`button-resolve-${anomaly.id}`}
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                ))}
                {(!anomalies || anomalies.length === 0) && (
                  <div className="text-center py-8">
                    <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">No Active Anomalies</h3>
                    <p className="text-sm text-muted-foreground">All detected anomalies have been resolved</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Policies</CardTitle>
              <CardDescription>Role-based data access controls and enforcement rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="list-policies">
                {policies?.map((policy) => (
                  <div key={policy.id} className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{policy.name}</span>
                          <Badge variant="outline">Priority: {policy.priority}</Badge>
                          {policy.enabled ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{policy.description}</p>
                      </div>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(checked) => togglePolicyMutation.mutate({ id: policy.id, enabled: checked })}
                        data-testid={`switch-policy-${policy.id}`}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                      <div>
                        <p className="text-xs font-medium mb-1">Conditions</p>
                        <div className="flex flex-wrap gap-1">
                          {policy.conditions.map((c, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {c.type}: {Array.isArray(c.value) ? c.value.join(", ") : c.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">Actions</p>
                        <div className="flex flex-wrap gap-1">
                          {policy.actions.map((a, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {a.type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground mr-2">Resources:</span>
                      {policy.resourceTypes.map((rt, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{rt}</Badge>
                      ))}
                      <span className="text-xs text-muted-foreground mx-2">Levels:</span>
                      {policy.classificationLevels.map((cl, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{cl}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
