import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  Activity,
  FileText,
  Wrench,
  RefreshCw,
  Play,
  Clock,
  Target,
  BarChart3,
  Zap,
  Shield,
  LineChart
} from "lucide-react";

interface DataSource {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  connectionStatus: "connected" | "disconnected" | "error";
  lastSync: string | null;
}

interface DashboardMetrics {
  dataSources: { connected: number; total: number };
  riskScore: number;
  predictions: { critical: number; high: number; medium: number; low: number };
  trendSummary: { improving: number; stable: number; deteriorating: number };
  remediations: { suggested: number; inProgress: number; completed: number };
}

interface ComplianceDeviation {
  id: string;
  type: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  predictedDate: string;
  confidence: number;
  aiAnalysis: string;
  status: string;
  createdAt: string;
}

interface RemediationSuggestion {
  id: string;
  deviationId: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  steps: Array<{ order: number; action: string; responsible: string; automated: boolean; estimatedDuration: string }>;
  estimatedEffort: string;
  expectedImpact: string;
  automatable: boolean;
  aiRationale: string;
  status: string;
  createdAt: string;
}

interface ForecastReport {
  id: string;
  generatedAt: string;
  forecastPeriod: { start: string; end: string };
  overallRiskScore: number;
  riskTrend: string;
  executiveSummary: string;
  regulatoryImpact: {
    hipaa: { riskLevel: string; forecast: string };
    gdpr: { riskLevel: string; forecast: string };
    soc2: { riskLevel: string; forecast: string };
    hitech: { riskLevel: string; forecast: string };
  };
  keyMetrics: {
    predictedViolations: number;
    highRiskAreas: string[];
    improvementOpportunities: string[];
  };
}

export default function PredictiveCompliance() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedDeviation, setSelectedDeviation] = useState<ComplianceDeviation | null>(null);
  const [selectedReport, setSelectedReport] = useState<ForecastReport | null>(null);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<{
    metrics: DashboardMetrics;
    recentDeviations: ComplianceDeviation[];
    pendingRemediations: RemediationSuggestion[];
    recentReports: ForecastReport[];
  }>({
    queryKey: ["/api/predictive-compliance/dashboard"]
  });

  const { data: dataSources } = useQuery<DataSource[]>({
    queryKey: ["/api/predictive-compliance/data-sources"]
  });

  const { data: deviations } = useQuery<ComplianceDeviation[]>({
    queryKey: ["/api/predictive-compliance/deviations"]
  });

  const { data: remediations } = useQuery<RemediationSuggestion[]>({
    queryKey: ["/api/predictive-compliance/remediations"]
  });

  const { data: reports } = useQuery<ForecastReport[]>({
    queryKey: ["/api/predictive-compliance/reports"]
  });

  const syncSourceMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      return apiRequest("POST", `/api/predictive-compliance/data-sources/${sourceId}/sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/data-sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/dashboard"] });
      toast({ title: "Data source synced" });
    },
  });

  const predictDeviationsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/predictive-compliance/deviations/predict", { forecastDays: 14 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/deviations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/dashboard"] });
      toast({ title: "Predictions generated" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/predictive-compliance/reports/forecast", { forecastDays: 30 });
      return result.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/dashboard"] });
      setSelectedReport(data);
      toast({ title: "Forecast report generated" });
    },
  });

  const generateRemediationsMutation = useMutation({
    mutationFn: async (deviationId: string) => {
      return apiRequest("POST", `/api/predictive-compliance/deviations/${deviationId}/remediations`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/remediations"] });
      toast({ title: "Remediation suggestions generated" });
    },
  });

  const updateRemediationStatusMutation = useMutation({
    mutationFn: async ({ remediationId, status }: { remediationId: string; status: string }) => {
      return apiRequest("PATCH", `/api/predictive-compliance/remediations/${remediationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/remediations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/predictive-compliance/dashboard"] });
      toast({ title: "Remediation status updated" });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return "text-red-500";
    if (score >= 40) return "text-yellow-500";
    return "text-green-500";
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingDown className="h-4 w-4 text-green-500" />;
      case "deteriorating": return <TrendingUp className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Predictive Compliance</h1>
          <p className="text-muted-foreground">AI-powered compliance forecasting and trend analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => predictDeviationsMutation.mutate()}
            disabled={predictDeviationsMutation.isPending}
            data-testid="button-predict-deviations"
          >
            <Zap className="h-4 w-4 mr-2" />
            Predict Deviations
          </Button>
          <Button
            onClick={() => generateReportMutation.mutate()}
            disabled={generateReportMutation.isPending}
            data-testid="button-generate-report"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-navigation">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="sources" data-testid="tab-sources">Data Sources</TabsTrigger>
          <TabsTrigger value="predictions" data-testid="tab-predictions">Predictions</TabsTrigger>
          <TabsTrigger value="remediations" data-testid="tab-remediations">Remediations</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboard && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-risk-score">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Overall Risk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${getRiskScoreColor(dashboard.metrics.riskScore)}`}>
                      {dashboard.metrics.riskScore}
                      <span className="text-sm text-muted-foreground font-normal">/100</span>
                    </div>
                    <Progress 
                      value={dashboard.metrics.riskScore} 
                      className="mt-2"
                    />
                  </CardContent>
                </Card>

                <Card data-testid="card-data-sources">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Data Sources
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {dashboard.metrics.dataSources.connected}
                      <span className="text-sm text-muted-foreground font-normal">
                        /{dashboard.metrics.dataSources.total} connected
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-predictions">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Active Predictions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {dashboard.metrics.predictions.critical > 0 && (
                        <Badge variant="destructive">{dashboard.metrics.predictions.critical} Critical</Badge>
                      )}
                      {dashboard.metrics.predictions.high > 0 && (
                        <Badge className="bg-orange-500">{dashboard.metrics.predictions.high} High</Badge>
                      )}
                      {dashboard.metrics.predictions.medium > 0 && (
                        <Badge className="bg-yellow-500">{dashboard.metrics.predictions.medium} Medium</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-trends">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <LineChart className="h-4 w-4" />
                      Trend Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1 text-green-500">
                        <TrendingDown className="h-4 w-4" />
                        {dashboard.metrics.trendSummary.improving}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Activity className="h-4 w-4" />
                        {dashboard.metrics.trendSummary.stable}
                      </div>
                      <div className="flex items-center gap-1 text-red-500">
                        <TrendingUp className="h-4 w-4" />
                        {dashboard.metrics.trendSummary.deteriorating}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-recent-deviations">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Recent Predicted Deviations
                    </CardTitle>
                    <CardDescription>Compliance issues forecasted to occur</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboard.recentDeviations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No predictions yet. Click "Predict Deviations" to generate forecasts.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dashboard.recentDeviations.map((deviation) => (
                          <div 
                            key={deviation.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                            {...clickable(() => {
                              setSelectedDeviation(deviation);
                              setActiveTab("predictions");
                            })}
                            data-testid={`deviation-item-${deviation.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge className={getSeverityColor(deviation.severity)}>
                                {deviation.severity}
                              </Badge>
                              <div>
                                <p className="font-medium">{deviation.category.replace(/_/g, " ")}</p>
                                <p className="text-sm text-muted-foreground">
                                  Predicted: {new Date(deviation.predictedDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{Math.round(deviation.confidence * 100)}%</p>
                              <p className="text-xs text-muted-foreground">Confidence</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-pending-remediations">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-5 w-5" />
                      Pending Remediations
                    </CardTitle>
                    <CardDescription>Suggested actions to prevent compliance issues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboard.pendingRemediations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        No pending remediations
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {dashboard.pendingRemediations.map((remediation) => (
                          <div 
                            key={remediation.id}
                            className="p-3 rounded-lg border"
                            data-testid={`remediation-item-${remediation.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{remediation.title}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">{remediation.category}</Badge>
                                  <Badge variant="outline">{remediation.estimatedEffort} effort</Badge>
                                  {remediation.automatable && (
                                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Automatable
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => updateRemediationStatusMutation.mutate({
                                  remediationId: remediation.id,
                                  status: "approved"
                                })}
                                data-testid={`button-approve-${remediation.id}`}
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connected Data Sources
              </CardTitle>
              <CardDescription>
                Multi-source data integration for comprehensive compliance monitoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataSources?.map((source) => (
                  <div 
                    key={source.id} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                    data-testid={`source-item-${source.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        source.connectionStatus === "connected" ? "bg-green-500" :
                        source.connectionStatus === "error" ? "bg-red-500" : "bg-yellow-500"
                      }`} />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{source.type.replace(/_/g, " ")}</Badge>
                          {source.lastSync && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last sync: {new Date(source.lastSync).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncSourceMutation.mutate(source.id)}
                      disabled={syncSourceMutation.isPending}
                      data-testid={`button-sync-${source.id}`}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Predicted Deviations
                </CardTitle>
                <CardDescription>
                  AI-forecasted compliance issues based on trend analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deviations?.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No predictions available</p>
                    <Button 
                      className="mt-4"
                      onClick={() => predictDeviationsMutation.mutate()}
                      disabled={predictDeviationsMutation.isPending}
                    >
                      Generate Predictions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {deviations?.map((deviation) => (
                      <div 
                        key={deviation.id}
                        className={`p-4 rounded-lg border cursor-pointer hover-elevate ${
                          selectedDeviation?.id === deviation.id ? "ring-2 ring-primary" : ""
                        }`}
                        {...clickable(() => setSelectedDeviation(deviation))}
                        data-testid={`prediction-item-${deviation.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getSeverityColor(deviation.severity)}>
                                {deviation.severity}
                              </Badge>
                              <span className="font-medium">
                                {deviation.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {deviation.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              {Math.round(deviation.confidence * 100)}%
                            </div>
                            <div className="text-xs text-muted-foreground">confidence</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            Predicted: {new Date(deviation.predictedDate).toLocaleDateString()}
                          </span>
                          <Badge variant="outline">{deviation.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Deviation Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDeviation ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Category</h3>
                      <p>{selectedDeviation.category.replace(/_/g, " ")}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">AI Analysis</h3>
                      <p className="text-sm text-muted-foreground">{selectedDeviation.aiAnalysis}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Predicted Date</h3>
                      <p>{new Date(selectedDeviation.predictedDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Confidence Level</h3>
                      <div className="flex items-center gap-2">
                        <Progress value={selectedDeviation.confidence * 100} className="flex-1" />
                        <span className="font-medium">{Math.round(selectedDeviation.confidence * 100)}%</span>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => generateRemediationsMutation.mutate(selectedDeviation.id)}
                      disabled={generateRemediationsMutation.isPending}
                      data-testid="button-generate-remediations"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Generate Remediations
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a deviation to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="remediations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Remediation Suggestions
              </CardTitle>
              <CardDescription>
                AI-generated recommendations to address predicted compliance issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {remediations?.length === 0 ? (
                <div className="text-center py-8">
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No remediation suggestions yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Generate predictions first, then create remediations
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {remediations?.map((remediation) => (
                    <Card key={remediation.id} data-testid={`remediation-card-${remediation.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{remediation.title}</CardTitle>
                            <div className="flex gap-2 mt-2">
                              <Badge className={getSeverityColor(remediation.priority)}>
                                {remediation.priority}
                              </Badge>
                              <Badge variant="outline">{remediation.category}</Badge>
                              <Badge variant="outline">{remediation.estimatedEffort} effort</Badge>
                              {remediation.automatable && (
                                <Badge className="bg-blue-500/10 text-blue-500">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Automatable
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline">{remediation.status}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">{remediation.description}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Expected Impact</h4>
                          <p className="text-sm text-muted-foreground">{remediation.expectedImpact}</p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Steps</h4>
                          <div className="space-y-2">
                            {remediation.steps.map((step) => (
                              <div 
                                key={step.order}
                                className="flex items-center gap-3 p-2 rounded bg-muted/50"
                              >
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">
                                  {step.order}
                                </span>
                                <div className="flex-1">
                                  <p className="text-sm">{step.action}</p>
                                  <div className="flex gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">{step.responsible}</span>
                                    <span className="text-xs text-muted-foreground">{step.estimatedDuration}</span>
                                    {step.automated && (
                                      <Badge variant="outline" className="text-xs">
                                        <Zap className="h-3 w-3 mr-1" />
                                        Auto
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">AI Rationale</h4>
                          <p className="text-sm text-muted-foreground italic">{remediation.aiRationale}</p>
                        </div>
                        {remediation.status === "suggested" && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => updateRemediationStatusMutation.mutate({
                                remediationId: remediation.id,
                                status: "approved"
                              })}
                              data-testid={`button-approve-remediation-${remediation.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => updateRemediationStatusMutation.mutate({
                                remediationId: remediation.id,
                                status: "rejected"
                              })}
                              data-testid={`button-reject-remediation-${remediation.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        {remediation.status === "approved" && (
                          <Button
                            onClick={() => updateRemediationStatusMutation.mutate({
                              remediationId: remediation.id,
                              status: "in_progress"
                            })}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start Implementation
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Forecast Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reports?.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No reports generated yet</p>
                    <Button 
                      className="mt-4"
                      onClick={() => generateReportMutation.mutate()}
                      disabled={generateReportMutation.isPending}
                    >
                      Generate Report
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {reports?.map((report) => (
                      <div
                        key={report.id}
                        className={`p-3 rounded-lg border cursor-pointer hover-elevate ${
                          selectedReport?.id === report.id ? "ring-2 ring-primary" : ""
                        }`}
                        {...clickable(() => setSelectedReport(report))}
                        data-testid={`report-item-${report.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Forecast Report</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(report.generatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className={`text-lg font-bold ${getRiskScoreColor(report.overallRiskScore)}`}>
                            {report.overallRiskScore}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Report Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedReport ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Overall Risk Score</h4>
                        <div className={`text-3xl font-bold ${getRiskScoreColor(selectedReport.overallRiskScore)}`}>
                          {selectedReport.overallRiskScore}/100
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground">Risk Trend</h4>
                        <div className="flex items-center gap-2 text-lg">
                          {getTrendIcon(selectedReport.riskTrend)}
                          <span className="capitalize">{selectedReport.riskTrend}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Executive Summary</h4>
                      <p className="text-sm text-muted-foreground">{selectedReport.executiveSummary}</p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Regulatory Impact</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedReport.regulatoryImpact).map(([reg, data]) => (
                          <div key={reg} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium uppercase text-sm">{reg}</span>
                              <Badge className={getSeverityColor(data.riskLevel)}>
                                {data.riskLevel}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{data.forecast}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">High-Risk Areas</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.keyMetrics.highRiskAreas.map((area) => (
                            <Badge key={area} variant="destructive">
                              {area.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          {selectedReport.keyMetrics.highRiskAreas.length === 0 && (
                            <span className="text-sm text-muted-foreground">No high-risk areas identified</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Improvement Opportunities</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedReport.keyMetrics.improvementOpportunities.map((opp) => (
                            <Badge key={opp} className="bg-green-500/10 text-green-500">
                              {opp.replace(/_/g, " ")}
                            </Badge>
                          ))}
                          {selectedReport.keyMetrics.improvementOpportunities.length === 0 && (
                            <span className="text-sm text-muted-foreground">None identified</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Select a report to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
