import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Activity,
  AlertTriangle,
  Heart,
  Brain,
  Target,
  FileText,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  Shield,
} from "lucide-react";

interface PopulationHealthMetric {
  category: string;
  metric: string;
  value: number;
  previousValue: number;
  changePercent: number;
  trend: "improving" | "stable" | "declining";
  benchmark?: number;
  affectedPopulation: number;
}

interface HealthDisparity {
  category: string;
  metric: string;
  groups: Array<{ name: string; value: number; deviation: number }>;
  severity: "minor" | "moderate" | "significant";
  aiInsights?: string;
}

interface PredictiveRiskPatient {
  patientId: string;
  displayName: string;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskType: string;
  riskFactors: Array<{ factor: string; weight: number; description: string }>;
  suggestedInterventions: string[];
  lastAssessment: string;
  confidenceScore: number;
}

interface KPIMetric {
  id: string;
  name: string;
  category: string;
  value: number;
  target: number;
  unit: string;
  trend: "up" | "down" | "stable";
  trendValue: number;
  status: "on_track" | "at_risk" | "off_track";
  sparklineData: number[];
  description: string;
}

interface ProviderAnalyticsDashboard {
  generatedAt: string;
  providerId: string;
  populationOverview: {
    totalPatients: number;
    activePatients: number;
    highRiskPatients: number;
    avgPatientAge: number;
    genderDistribution: Array<{ group: string; count: number; percentage: number }>;
    ageDistribution: Array<{ group: string; count: number; percentage: number }>;
  };
  populationHealthMetrics: PopulationHealthMetric[];
  healthDisparities: HealthDisparity[];
  predictiveRiskPatients: PredictiveRiskPatient[];
  kpiMetrics: KPIMetric[];
  trendCharts: Array<{ chartId: string; title: string; type: string; data: any[] }>;
  aiInsights: string[];
  disclaimer: string;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" | "improving" | "declining" }) {
  if (trend === "up" || trend === "improving") {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === "down" || trend === "declining") {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function StatusBadge({ status }: { status: "on_track" | "at_risk" | "off_track" }) {
  const variants = {
    on_track: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    at_risk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    off_track: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  
  const labels = {
    on_track: "On Track",
    at_risk: "At Risk",
    off_track: "Off Track",
  };
  
  return (
    <Badge className={variants[status]} data-testid={`badge-status-${status}`}>
      {labels[status]}
    </Badge>
  );
}

function RiskLevelBadge({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const variants = {
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  
  return (
    <Badge className={variants[level]} data-testid={`badge-risk-${level}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: "minor" | "moderate" | "significant" }) {
  const variants = {
    minor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    significant: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };
  
  return (
    <Badge className={variants[severity]} data-testid={`badge-severity-${severity}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

function SparklineChart({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg viewBox="0 0 100 50" className="w-24 h-8" data-testid="sparkline-chart">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-primary"
      />
    </svg>
  );
}

export function EnhancedProviderAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const { data: dashboard, isLoading, error, refetch } = useQuery<{ success: boolean; dashboard: ProviderAnalyticsDashboard }>({
    queryKey: ["/api/enhanced-provider-analytics/dashboard"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="w-full" data-testid="analytics-loading">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (error || !dashboard?.success) {
    return (
      <Card className="w-full" data-testid="analytics-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Provider Analytics Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load analytics data. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = dashboard.dashboard;

  return (
    <Card className="w-full" data-testid="enhanced-provider-analytics-dashboard">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Enhanced Provider Analytics Dashboard
            </CardTitle>
            <CardDescription>
              Population health, predictive risk, and customizable KPIs
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh-analytics"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
          <Shield className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
            <strong>NO-CDS Notice:</strong> This dashboard is for operational planning and quality improvement only. 
            It does not provide clinical decision support.
          </AlertDescription>
        </Alert>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Users className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="population" data-testid="tab-population">
              <Activity className="h-4 w-4 mr-2" />
              Population
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Risk
            </TabsTrigger>
            <TabsTrigger value="kpis" data-testid="tab-kpis">
              <Target className="h-4 w-4 mr-2" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">
              <Lightbulb className="h-4 w-4 mr-2" />
              Insights
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card data-testid="card-total-patients">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Patients</p>
                      <p className="text-2xl font-bold">{data.populationOverview.totalPatients}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-active-patients">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Patients</p>
                      <p className="text-2xl font-bold">{data.populationOverview.activePatients}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((data.populationOverview.activePatients / data.populationOverview.totalPatients) * 100)}% of total
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-high-risk">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">High Risk</p>
                      <p className="text-2xl font-bold text-red-500">{data.populationOverview.highRiskPatients}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((data.populationOverview.highRiskPatients / data.populationOverview.totalPatients) * 100)}% of total
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-avg-age">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Patient Age</p>
                      <p className="text-2xl font-bold">{data.populationOverview.avgPatientAge}</p>
                    </div>
                    <Heart className="h-8 w-8 text-pink-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card data-testid="card-gender-distribution">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.populationOverview.genderDistribution.map((item) => (
                      <div key={item.group} className="flex items-center gap-2">
                        <div className="w-20 text-sm">{item.group}</div>
                        <Progress value={item.percentage} className="flex-1" />
                        <div className="w-16 text-sm text-right">{item.count} ({item.percentage}%)</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card data-testid="card-age-distribution">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Age Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.populationOverview.ageDistribution.map((item) => (
                      <div key={item.group} className="flex items-center gap-2">
                        <div className="w-16 text-sm">{item.group}</div>
                        <Progress value={item.percentage} className="flex-1" />
                        <div className="w-16 text-sm text-right">{item.count} ({item.percentage}%)</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="population" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.populationHealthMetrics.map((metric, index) => (
                <Card key={index} data-testid={`card-metric-${index}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2">{metric.category}</Badge>
                        <p className="font-medium text-sm">{metric.metric}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-2xl font-bold">{metric.value}%</span>
                          <div className="flex items-center gap-1">
                            <TrendIcon trend={metric.trend} />
                            <span className={`text-sm ${metric.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {metric.changePercent >= 0 ? "+" : ""}{metric.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {metric.benchmark && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Benchmark: {metric.benchmark}%
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Affects {metric.affectedPopulation} patients
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <Card data-testid="card-health-disparities">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Health Disparities</CardTitle>
                <CardDescription>Identified gaps in health outcomes across demographic groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.healthDisparities.map((disparity, index) => (
                    <div key={index} className="border rounded-lg p-4" data-testid={`disparity-${index}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <p className="font-medium">{disparity.metric}</p>
                          <p className="text-sm text-muted-foreground">{disparity.category}</p>
                        </div>
                        <SeverityBadge severity={disparity.severity} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                        {disparity.groups.map((group, gIndex) => (
                          <div key={gIndex} className="bg-muted/50 rounded p-2 text-center">
                            <p className="text-xs text-muted-foreground">{group.name}</p>
                            <p className="font-medium">{group.value}%</p>
                            <p className={`text-xs ${group.deviation >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {group.deviation >= 0 ? "+" : ""}{group.deviation.toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                      {disparity.aiInsights && (
                        <div className="bg-blue-50 dark:bg-blue-950 rounded p-2 mt-2">
                          <p className="text-xs text-blue-800 dark:text-blue-200">
                            <Brain className="h-3 w-3 inline mr-1" />
                            {disparity.aiInsights}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["critical", "high", "medium", "low"].map((level) => {
                const count = data.predictiveRiskPatients.filter(p => p.riskLevel === level).length;
                return (
                  <Card key={level} data-testid={`card-risk-${level}`}>
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground capitalize">{level} Risk</p>
                      <p className="text-3xl font-bold">{count}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            <Card data-testid="card-risk-patients">
              <CardHeader>
                <CardTitle className="text-sm font-medium">High-Risk Patients Requiring Attention</CardTitle>
                <CardDescription>Predictive risk stratification for proactive care management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.predictiveRiskPatients.map((patient, index) => (
                    <div key={patient.patientId} className="border rounded-lg p-4" data-testid={`risk-patient-${index}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{patient.displayName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {patient.riskType.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <RiskLevelBadge level={patient.riskLevel} />
                          <span className="text-lg font-bold">{patient.riskScore}%</span>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Risk Factors:</p>
                        <div className="flex flex-wrap gap-2">
                          {patient.riskFactors.slice(0, 3).map((factor, fIndex) => (
                            <Badge key={fIndex} variant="outline" className="text-xs">
                              {factor.factor} ({Math.round(factor.weight * 100)}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Interventions:</p>
                        <ul className="space-y-1">
                          {patient.suggestedInterventions.slice(0, 3).map((intervention, iIndex) => (
                            <li key={iIndex} className="text-xs flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 text-primary" />
                              {intervention}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Confidence: {Math.round(patient.confidenceScore * 100)}%
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="kpis" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["on_track", "at_risk", "off_track"].map((status) => {
                const count = data.kpiMetrics.filter(k => k.status === status).length;
                const colors = {
                  on_track: "text-green-500",
                  at_risk: "text-yellow-500",
                  off_track: "text-red-500",
                };
                return (
                  <Card key={status} data-testid={`card-kpi-status-${status}`}>
                    <CardContent className="pt-6 text-center">
                      <p className="text-sm text-muted-foreground capitalize">{status.replace(/_/g, " ")}</p>
                      <p className={`text-3xl font-bold ${colors[status as keyof typeof colors]}`}>{count}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.kpiMetrics.map((kpi, index) => (
                <Card key={kpi.id} data-testid={`card-kpi-${index}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2 capitalize">{kpi.category.replace(/_/g, " ")}</Badge>
                        <p className="font-medium">{kpi.name}</p>
                        <p className="text-xs text-muted-foreground">{kpi.description}</p>
                        
                        <div className="flex items-center gap-4 mt-3">
                          <div>
                            <span className="text-2xl font-bold">{kpi.value}</span>
                            <span className="text-sm text-muted-foreground ml-1">{kpi.unit}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendIcon trend={kpi.trend} />
                            <span className={`text-sm ${kpi.trendValue >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {kpi.trendValue >= 0 ? "+" : ""}{kpi.trendValue.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Progress to Target</span>
                            <span>Target: {kpi.target} {kpi.unit}</span>
                          </div>
                          <Progress value={(kpi.value / kpi.target) * 100} className="h-2" />
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={kpi.status} />
                        <SparklineChart data={kpi.sparklineData} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="insights" className="space-y-4 mt-4">
            <Card data-testid="card-ai-insights">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI-Powered Insights
                </CardTitle>
                <CardDescription>
                  Operational and quality improvement recommendations based on population data analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.aiInsights.map((insight, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                      data-testid={`insight-${index}`}
                    >
                      <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-trends">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Trend Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.trendCharts.map((chart, index) => (
                    <div key={chart.chartId} className="border rounded-lg p-4" data-testid={`trend-chart-${index}`}>
                      <p className="font-medium mb-2">{chart.title}</p>
                      <Badge variant="outline" className="text-xs capitalize">{chart.type}</Badge>
                      <div className="mt-3 h-24 bg-muted/30 rounded flex items-center justify-center">
                        <BarChart3 className="h-8 w-8 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground ml-2">
                          {chart.data.length} data points
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Last updated: {new Date(data.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default EnhancedProviderAnalyticsDashboard;
