import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  Database,
  Minus,
  Play,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
  Lock,
  Eye,
  Target,
  Layers
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataQualityTrend {
  metricName: string;
  currentValue: number;
  predictedValue: number;
  confidenceInterval: { lower: number; upper: number };
  trendDirection: "improving" | "stable" | "degrading" | "critical";
  daysToThresholdBreach?: number;
  riskProbability: number;
}

interface DataQualityForecast {
  id: string;
  forecastPeriodDays: number;
  generatedAt: string;
  trends: DataQualityTrend[];
  overallRiskScore: number;
  recommendations: string[];
  noCdsCompliance: string;
}

interface SystemicPattern {
  id: string;
  patternType: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedSystems: string[];
  affectedPatientCount: number;
  description: string;
  rootCause: string;
  firstDetected: string;
  occurrenceCount: number;
  suggestedRemediation: string[];
  dataQualityImpact: number;
}

interface PatternAnalysis {
  id: string;
  analysisType: string;
  patterns: SystemicPattern[];
  systemHealthScore: number;
  criticalFindings: number;
  recommendations: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface ThreatPrediction {
  id: string;
  threatType: string;
  likelihood: string;
  impact: string;
  riskScore: number;
  indicators: string[];
  predictedTimeframe: string;
  affectedAssets: string[];
}

interface AdaptiveControl {
  id: string;
  controlType: string;
  triggerCondition: string;
  currentState: "active" | "standby" | "disabled";
  recommendedState: "active" | "standby" | "disabled";
  automationLevel: string;
  effectivenessScore: number;
}

interface SecurityPostureAnalysis {
  id: string;
  overallRiskScore: number;
  threatPredictions: ThreatPrediction[];
  adaptiveControls: AdaptiveControl[];
  emergingThreats: string[];
  complianceGaps: string[];
  recommendations: string[];
  generatedAt: string;
  noCdsCompliance: string;
}

interface AnalyticsStats {
  totalForecasts: number;
  totalPatternAnalyses: number;
  totalSecurityAnalyses: number;
  criticalPatternsDetected: number;
  highRiskThreats: number;
  adaptiveControlsActive: number;
}

export default function AdvancedAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedAnalysis, setSelectedAnalysis] = useState<SecurityPostureAnalysis | null>(null);
  const { toast } = useToast();

  const { data: statsData, refetch: refetchStats } = useQuery<{ stats: AnalyticsStats }>({
    queryKey: ["/api/advanced-analytics/stats"]
  });

  const { data: forecastsData, refetch: refetchForecasts } = useQuery<{ forecasts: DataQualityForecast[] }>({
    queryKey: ["/api/advanced-analytics/forecasts"]
  });

  const { data: patternsData, refetch: refetchPatterns } = useQuery<{ analyses: PatternAnalysis[] }>({
    queryKey: ["/api/advanced-analytics/patterns"]
  });

  const { data: securityData, refetch: refetchSecurity } = useQuery<{ analyses: SecurityPostureAnalysis[] }>({
    queryKey: ["/api/advanced-analytics/security"]
  });

  const generateForecastMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/advanced-analytics/forecasts", { forecastDays: 30 });
    },
    onSuccess: () => {
      toast({ title: "Forecast Generated", description: "New data quality forecast created" });
      refetchForecasts();
      refetchStats();
    }
  });

  const generatePatternsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/advanced-analytics/patterns", { analysisType: "comprehensive" });
    },
    onSuccess: () => {
      toast({ title: "Pattern Analysis Complete", description: "Systemic patterns identified" });
      refetchPatterns();
      refetchStats();
    }
  });

  const generateSecurityMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/advanced-analytics/security", {});
    },
    onSuccess: () => {
      toast({ title: "Security Analysis Complete", description: "Threat predictions generated" });
      refetchSecurity();
      refetchStats();
    }
  });

  const updateControlMutation = useMutation({
    mutationFn: async ({ analysisId, controlId, newState }: { analysisId: string; controlId: string; newState: string }) => {
      return apiRequest("PATCH", `/api/advanced-analytics/security/${analysisId}/controls/${controlId}`, { newState });
    },
    onSuccess: () => {
      toast({ title: "Control Updated", description: "Adaptive control state changed" });
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-analytics/security"] });
    }
  });

  const stats = statsData?.stats;
  const forecasts = forecastsData?.forecasts || [];
  const patterns = patternsData?.analyses || [];
  const securityAnalyses = securityData?.analyses || [];

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "degrading": return <TrendingDown className="h-4 w-4 text-orange-500" />;
      case "critical": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      case "very_high": return "bg-red-600";
      default: return "bg-gray-500";
    }
  };

  const getControlStateBadge = (state: string) => {
    switch (state) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "standby": return <Badge className="bg-yellow-500">Standby</Badge>;
      case "disabled": return <Badge variant="secondary">Disabled</Badge>;
      default: return <Badge variant="outline">{state}</Badge>;
    }
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchForecasts();
    refetchPatterns();
    refetchSecurity();
    toast({ title: "Refreshed", description: "All analytics data refreshed" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Advanced AI Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Predictive insights for data governance, patterns, and security
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefreshAll} data-testid="button-refresh-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          NO-CDS COMPLIANCE: All analytics are for DATA GOVERNANCE, OPERATIONAL EFFICIENCY, and SECURITY purposes ONLY. This system does NOT provide clinical predictions, diagnostic outcomes, or treatment recommendations.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Forecasts</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalForecasts || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Pattern Analyses</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPatternAnalyses || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Security Analyses</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSecurityAnalyses || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Critical Patterns</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.criticalPatternsDetected || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">High-Risk Threats</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.highRiskThreats || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium">Active Controls</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.adaptiveControlsActive || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="forecasts" data-testid="tab-forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns">Patterns</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Data Quality Forecasts
                </CardTitle>
                <CardDescription>Predictive trends for data quality metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {forecasts.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Overall Risk</span>
                      <Badge className={forecasts[0].overallRiskScore > 50 ? "bg-red-500" : "bg-green-500"}>
                        {forecasts[0].overallRiskScore}%
                      </Badge>
                    </div>
                    <Progress value={100 - forecasts[0].overallRiskScore} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {forecasts[0].trends.length} metrics tracked
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No forecasts available
                  </div>
                )}
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => generateForecastMutation.mutate()}
                  disabled={generateForecastMutation.isPending}
                  data-testid="button-generate-forecast"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generate Forecast
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Systemic Patterns
                </CardTitle>
                <CardDescription>Cross-system data quality issues</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {patterns.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">System Health</span>
                      <Badge className={patterns[0].systemHealthScore < 50 ? "bg-red-500" : "bg-green-500"}>
                        {patterns[0].systemHealthScore}%
                      </Badge>
                    </div>
                    <Progress value={patterns[0].systemHealthScore} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {patterns[0].patterns.length} patterns detected
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No pattern analyses available
                  </div>
                )}
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => generatePatternsMutation.mutate()}
                  disabled={generatePatternsMutation.isPending}
                  data-testid="button-generate-patterns"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Analyze Patterns
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security Posture
                </CardTitle>
                <CardDescription>Threat predictions and adaptive controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {securityAnalyses.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Risk Score</span>
                      <Badge className={securityAnalyses[0].overallRiskScore > 50 ? "bg-red-500" : "bg-green-500"}>
                        {securityAnalyses[0].overallRiskScore}%
                      </Badge>
                    </div>
                    <Progress value={100 - securityAnalyses[0].overallRiskScore} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {securityAnalyses[0].threatPredictions.length} threats predicted
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No security analyses available
                  </div>
                )}
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => generateSecurityMutation.mutate()}
                  disabled={generateSecurityMutation.isPending}
                  data-testid="button-generate-security"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Analyze Security
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {forecasts.map((forecast) => (
                <Card key={forecast.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {forecast.forecastPeriodDays}-Day Forecast
                      </CardTitle>
                      <Badge className={forecast.overallRiskScore > 50 ? "bg-red-500" : forecast.overallRiskScore > 30 ? "bg-yellow-500" : "bg-green-500"}>
                        Risk: {forecast.overallRiskScore}%
                      </Badge>
                    </div>
                    <CardDescription>
                      Generated: {new Date(forecast.generatedAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{forecast.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      {forecast.trends.map((trend, idx) => (
                        <div key={idx} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getTrendIcon(trend.trendDirection)}
                              <span className="font-medium">{trend.metricName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold">{trend.currentValue}%</span>
                              {trend.trendDirection !== "stable" && (
                                <>
                                  {trend.predictedValue > trend.currentValue ? (
                                    <ArrowUp className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <ArrowDown className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="text-sm text-muted-foreground">
                                    {trend.predictedValue}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <Progress value={trend.currentValue} className="h-2 mb-2" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              CI: [{trend.confidenceInterval.lower}%, {trend.confidenceInterval.upper}%]
                            </span>
                            {trend.daysToThresholdBreach && (
                              <Badge variant="outline" className="text-orange-500">
                                Breach in {trend.daysToThresholdBreach} days
                              </Badge>
                            )}
                            <span>Risk: {(trend.riskProbability * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {forecast.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {forecast.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {patterns.map((analysis) => (
                <Card key={analysis.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg capitalize">
                        {analysis.analysisType.replace(/_/g, " ")} Analysis
                      </CardTitle>
                      <div className="flex gap-2">
                        <Badge className={analysis.systemHealthScore < 50 ? "bg-red-500" : analysis.systemHealthScore < 75 ? "bg-yellow-500" : "bg-green-500"}>
                          Health: {analysis.systemHealthScore}%
                        </Badge>
                        {analysis.criticalFindings > 0 && (
                          <Badge className="bg-red-500">{analysis.criticalFindings} Critical</Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      {analysis.patterns.length} patterns detected | Generated: {new Date(analysis.generatedAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                      {analysis.patterns.map((pattern) => (
                        <div key={pattern.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getSeverityColor(pattern.severity)}>{pattern.severity}</Badge>
                              <span className="font-medium capitalize">{pattern.patternType.replace(/_/g, " ")}</span>
                            </div>
                            <Badge variant="outline">
                              {pattern.affectedPatientCount} patients
                            </Badge>
                          </div>
                          <p className="text-sm mb-2">{pattern.description}</p>
                          <div className="text-sm text-muted-foreground mb-2">
                            <strong>Root Cause:</strong> {pattern.rootCause}
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {pattern.affectedSystems.map((sys, idx) => (
                              <Badge key={idx} variant="outline">{sys}</Badge>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{pattern.occurrenceCount} occurrences</span>
                            <span>Data Quality Impact: -{pattern.dataQualityImpact}%</span>
                          </div>
                          {pattern.suggestedRemediation.length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                              <span className="text-xs font-medium">Remediation:</span>
                              <ul className="list-disc list-inside text-xs text-muted-foreground">
                                {pattern.suggestedRemediation.slice(0, 2).map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {securityAnalyses.map((analysis) => (
                <Card key={analysis.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Security Posture Analysis</CardTitle>
                      <Badge className={analysis.overallRiskScore > 50 ? "bg-red-500" : analysis.overallRiskScore > 30 ? "bg-yellow-500" : "bg-green-500"}>
                        Risk: {analysis.overallRiskScore}%
                      </Badge>
                    </div>
                    <CardDescription>
                      Generated: {new Date(analysis.generatedAt).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-muted/50">
                      <Shield className="h-4 w-4" />
                      <AlertDescription className="text-xs">{analysis.noCdsCompliance}</AlertDescription>
                    </Alert>

                    <div>
                      <h4 className="font-medium mb-2">Threat Predictions</h4>
                      <div className="space-y-2">
                        {analysis.threatPredictions.map((threat) => (
                          <div key={threat.id} className="p-3 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium capitalize">{threat.threatType.replace(/_/g, " ")}</span>
                              <div className="flex gap-2">
                                <Badge className={getSeverityColor(threat.likelihood)}>
                                  Likelihood: {threat.likelihood}
                                </Badge>
                                <Badge className={getSeverityColor(threat.impact)}>
                                  Impact: {threat.impact}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span>Risk Score: {threat.riskScore}%</span>
                              <span>Timeframe: {threat.predictedTimeframe}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <strong>Indicators:</strong> {threat.indicators.join("; ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">Adaptive Controls</h4>
                      <div className="space-y-2">
                        {analysis.adaptiveControls.map((control) => (
                          <div key={control.id} className="p-3 rounded-lg border flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium capitalize">{control.controlType.replace(/_/g, " ")}</span>
                                {getControlStateBadge(control.currentState)}
                                {control.currentState !== control.recommendedState && (
                                  <Badge variant="outline" className="text-orange-500">
                                    Recommend: {control.recommendedState}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {control.triggerCondition}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Effectiveness: {(control.effectivenessScore * 100).toFixed(0)}% | {control.automationLevel}
                              </div>
                            </div>
                            {control.currentState !== control.recommendedState && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateControlMutation.mutate({
                                  analysisId: analysis.id,
                                  controlId: control.id,
                                  newState: control.recommendedState
                                })}
                                disabled={updateControlMutation.isPending}
                                data-testid={`button-activate-control-${control.id}`}
                              >
                                Activate
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {analysis.emergingThreats.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Emerging Threats</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground">
                            {analysis.emergingThreats.map((threat, idx) => (
                              <li key={idx}>{threat}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}

                    {analysis.complianceGaps.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Compliance Gaps</h4>
                          <ul className="list-disc list-inside text-sm text-orange-600 dark:text-orange-400">
                            {analysis.complianceGaps.map((gap, idx) => (
                              <li key={idx}>{gap}</li>
                            ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
