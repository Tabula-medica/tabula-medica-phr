import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Activity,
  DollarSign,
  AlertTriangle,
  Sparkles,
  FileBarChart,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Lightbulb,
  Target,
  Stethoscope,
  Building2,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReadmissionRiskPrediction {
  patientId: string;
  patientName: string;
  demographics: { ageGroup: string; gender: string; region: string };
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskFactors: Array<{ factor: string; impact: number; category: string }>;
  suggestedInterventions: string[];
}

interface TreatmentEfficacyAnalysis {
  treatmentId: string;
  treatmentName: string;
  condition: string;
  demographics: { ageGroup: string; gender: string };
  sampleSize: number;
  efficacyRate: number;
  successRate: number;
  costEffectivenessScore: number;
  significantFactors: Array<{ factor: string; correlation: number; direction: "positive" | "negative" }>;
}

interface ResourceAllocationInsight {
  resourceType: string;
  currentAllocation: number;
  optimalAllocation: number;
  utilizationRate: number;
  trendDirection: "increasing" | "stable" | "decreasing";
  recommendations: Array<{ action: string; priority: "high" | "medium" | "low"; estimatedImpact: string }>;
  costSavingsPotential: number;
}

interface PopulationHealthTrend {
  trendId: string;
  category: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  direction: "improving" | "stable" | "declining";
  dataPoints: Array<{ date: string; value: number }>;
  insights: string[];
}

interface PopulationDashboard {
  generatedAt: string;
  populationSize: number;
  readmissionAnalytics: {
    overallRiskScore: number;
    riskDistribution: { low: number; moderate: number; high: number; critical: number };
    topRiskPatients: ReadmissionRiskPrediction[];
    trendComparison: { current: number; previous: number; change: number };
  };
  treatmentEfficacy: {
    totalAnalyzed: number;
    topPerformers: TreatmentEfficacyAnalysis[];
    demographicInsights: Array<{ demographic: string; insight: string; significance: string }>;
  };
  resourceAllocation: {
    overallUtilization: number;
    insights: ResourceAllocationInsight[];
    savingsOpportunity: number;
  };
  healthTrends: PopulationHealthTrend[];
  disclaimer: string;
}

export default function PopulationAnalyticsPage() {
  useSEO({ title: "Population Health Analytics | Tabula Medica" });
  const [activeTab, setActiveTab] = useState("overview");
  const [aiQuery, setAiQuery] = useState("");
  const { toast } = useToast();

  const { data: dashboard, isLoading } = useQuery<PopulationDashboard>({
    queryKey: ["/api/population-analytics/dashboard"],
  });

  const aiInsightsMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/population-analytics/ai-insights", { query });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "AI Insights Generated", description: "Analysis complete." });
    },
    onError: (error: Error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });

  const riskLevelColors: Record<string, string> = {
    low: "bg-green-500/10 text-green-600 border-green-500/30",
    moderate: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    critical: "bg-red-500/10 text-red-600 border-red-500/30",
  };

  const trendIcons: Record<string, JSX.Element> = {
    improving: <TrendingUp className="h-4 w-4 text-green-500" />,
    stable: <Minus className="h-4 w-4 text-gray-500" />,
    declining: <TrendingDown className="h-4 w-4 text-red-500" />,
    increasing: <ArrowUpRight className="h-4 w-4 text-blue-500" />,
    decreasing: <ArrowDownRight className="h-4 w-4 text-amber-500" />,
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6" />
            Population Health Analytics
          </h1>
          <p className="text-muted-foreground">AI-driven insights for patient populations</p>
        </div>
        <Badge variant="outline" className="text-xs" data-testid="badge-population-size">
          {dashboard?.populationSize?.toLocaleString() || 0} patients
        </Badge>
      </div>

      <Alert className="bg-amber-500/10 border-amber-500/30" data-testid="alert-no-cds">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Operational analytics only.</strong> This is NOT clinical decision support. All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-population-size">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Population Size</p>
                <p className="text-2xl font-bold" data-testid="text-population-count">{dashboard?.populationSize?.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-readmission-rate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Readmission Rate</p>
                <p className="text-2xl font-bold">{dashboard?.readmissionAnalytics?.trendComparison?.current}%</p>
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {Math.abs(dashboard?.readmissionAnalytics?.trendComparison?.change || 0)}% improvement
                </p>
              </div>
              <Activity className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-utilization">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resource Utilization</p>
                <p className="text-2xl font-bold">{dashboard?.resourceAllocation?.overallUtilization}%</p>
                <Progress value={dashboard?.resourceAllocation?.overallUtilization} className="mt-2 h-2" />
              </div>
              <Building2 className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-savings">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Savings Opportunity</p>
                <p className="text-2xl font-bold text-green-600">${((dashboard?.resourceAllocation?.savingsOpportunity || 0) / 1000).toFixed(0)}K</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl" data-testid="tabs-analytics">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <PieChart className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="readmission" data-testid="tab-readmission">
            <Activity className="h-4 w-4 mr-2" />
            Readmission
          </TabsTrigger>
          <TabsTrigger value="treatment" data-testid="tab-treatment">
            <Stethoscope className="h-4 w-4 mr-2" />
            Treatment
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Target className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
          <TabsTrigger value="ai-insights" data-testid="tab-ai-insights">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-risk-distribution">
              <CardHeader>
                <CardTitle>Readmission Risk Distribution</CardTitle>
                <CardDescription>Patient stratification by risk level</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard?.readmissionAnalytics?.riskDistribution && (() => {
                  const distribution = dashboard.readmissionAnalytics.riskDistribution;
                  const total = Object.values(distribution).reduce((sum, val) => sum + val, 0) || 1;
                  return Object.entries(distribution).map(([level, count]) => (
                    <div key={level} className="flex items-center gap-4" data-testid={`row-risk-${level}`}>
                      <Badge variant="outline" className={`w-20 justify-center ${riskLevelColors[level]}`}>
                        {level}
                      </Badge>
                      <Progress value={(count / total) * 100} className="flex-1" />
                      <span className="text-sm font-medium w-8">{count}</span>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>

            <Card data-testid="card-health-trends">
              <CardHeader>
                <CardTitle>Health Trends</CardTitle>
                <CardDescription>Key population metrics over time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.healthTrends?.slice(0, 4).map((trend, i) => (
                  <div key={trend.trendId} className="flex items-center justify-between p-2 rounded border" data-testid={`row-trend-${i}`}>
                    <div className="flex items-center gap-2">
                      {trendIcons[trend.direction]}
                      <span className="text-sm font-medium">{trend.metric}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{trend.currentValue}</span>
                      <Badge variant="outline" className={trend.direction === "improving" ? "text-green-600" : trend.direction === "declining" ? "text-red-600" : ""}>
                        {trend.changePercent > 0 ? "+" : ""}{trend.changePercent.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-demographic-insights">
            <CardHeader>
              <CardTitle>Demographic Insights</CardTitle>
              <CardDescription>Treatment efficacy patterns by population segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dashboard?.treatmentEfficacy?.demographicInsights?.map((insight, i) => (
                  <div key={i} className="p-4 rounded-lg border" data-testid={`card-insight-${i}`}>
                    <Badge variant="secondary" className="mb-2">{insight.demographic}</Badge>
                    <p className="text-sm">{insight.insight}</p>
                    <p className="text-xs text-muted-foreground mt-2">Significance: {insight.significance}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readmission" className="space-y-6">
          <Card data-testid="card-high-risk-patients">
            <CardHeader>
              <CardTitle>High Risk Patients</CardTitle>
              <CardDescription>Patients with elevated 30-day readmission risk</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.readmissionAnalytics?.topRiskPatients?.map((patient, i) => (
                  <div key={patient.patientId} className="p-4 rounded-lg border" data-testid={`row-patient-${i}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={riskLevelColors[patient.riskLevel]}>
                          {patient.riskLevel}
                        </Badge>
                        <div>
                          <p className="font-medium">{patient.patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            {patient.demographics.gender} • {patient.demographics.ageGroup} • {patient.demographics.region}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{patient.riskScore}%</p>
                        <p className="text-xs text-muted-foreground">Risk Score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Risk Factors</p>
                        <div className="flex flex-wrap gap-1">
                          {patient.riskFactors.slice(0, 3).map((factor, fi) => (
                            <Badge key={fi} variant="secondary" className="text-xs" data-testid={`badge-factor-${i}-${fi}`}>
                              {factor.factor} (+{factor.impact}%)
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Interventions</p>
                        <ul className="text-xs space-y-1">
                          {patient.suggestedInterventions.slice(0, 2).map((intervention, ii) => (
                            <li key={ii} className="flex items-start gap-1">
                              <Lightbulb className="h-3 w-3 mt-0.5 text-amber-500" />
                              {intervention}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatment" className="space-y-6">
          <Card data-testid="card-treatment-efficacy">
            <CardHeader>
              <CardTitle>Treatment Efficacy Analysis</CardTitle>
              <CardDescription>Performance by treatment and demographic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.treatmentEfficacy?.topPerformers?.map((treatment, i) => (
                  <div key={treatment.treatmentId} className="p-4 rounded-lg border" data-testid={`row-treatment-${i}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">{treatment.treatmentName}</p>
                        <p className="text-xs text-muted-foreground">{treatment.condition}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-green-600">{treatment.efficacyRate}%</p>
                          <p className="text-xs text-muted-foreground">Efficacy</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-bold">{treatment.successRate}%</p>
                          <p className="text-xs text-muted-foreground">Success</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{treatment.demographics.gender}</Badge>
                      <Badge variant="outline">{treatment.demographics.ageGroup}</Badge>
                      <Badge variant="secondary" className="text-xs">n={treatment.sampleSize}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {treatment.significantFactors.slice(0, 3).map((factor, fi) => (
                        <Badge key={fi} variant="outline" className={factor.direction === "positive" ? "border-green-500/30" : "border-red-500/30"}>
                          {factor.factor}: {factor.correlation.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card data-testid="card-resource-optimization">
            <CardHeader>
              <CardTitle>Resource Optimization</CardTitle>
              <CardDescription>AI-driven allocation recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {dashboard?.resourceAllocation?.insights?.map((resource, i) => (
                  <div key={i} className="p-4 rounded-lg border" data-testid={`row-resource-${i}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium">{resource.resourceType}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {trendIcons[resource.trendDirection]}
                          <span className="text-xs text-muted-foreground">{resource.trendDirection} demand</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        ${(resource.costSavingsPotential / 1000).toFixed(0)}K savings
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-lg font-bold">{resource.currentAllocation}</p>
                        <p className="text-xs text-muted-foreground">Current</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-lg font-bold">{resource.optimalAllocation}</p>
                        <p className="text-xs text-muted-foreground">Optimal</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-lg font-bold">{resource.utilizationRate}%</p>
                        <p className="text-xs text-muted-foreground">Utilization</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Recommendations</p>
                      {resource.recommendations.map((rec, ri) => (
                        <div key={ri} className="flex items-start gap-2 p-2 rounded border">
                          <Badge variant="outline" className={rec.priority === "high" ? "border-red-500/30 text-red-600" : rec.priority === "medium" ? "border-amber-500/30 text-amber-600" : "border-green-500/30 text-green-600"}>
                            {rec.priority}
                          </Badge>
                          <div className="flex-1">
                            <p className="text-sm">{rec.action}</p>
                            <p className="text-xs text-muted-foreground">Impact: {rec.estimatedImpact}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-insights" className="space-y-6">
          <Card data-testid="card-ai-query">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Population Insights
              </CardTitle>
              <CardDescription>Ask questions about population health trends and patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="E.g., What are the key factors driving readmission rates?"
                  data-testid="input-ai-query"
                />
                <Button
                  onClick={() => aiQuery && aiInsightsMutation.mutate(aiQuery)}
                  disabled={!aiQuery || aiInsightsMutation.isPending}
                  data-testid="button-generate-insights"
                >
                  {aiInsightsMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />Generate</>
                  )}
                </Button>
              </div>

              {aiInsightsMutation.data && (
                <div className="space-y-4 mt-4" data-testid="section-ai-results">
                  <Alert className="border-blue-500/30 bg-blue-500/10" data-testid="alert-ai-disclaimer">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                      {aiInsightsMutation.data.disclaimer}
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Insights</h4>
                    <ul className="space-y-2">
                      {aiInsightsMutation.data.insights?.map((insight: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-insight-${i}`}>
                          <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Recommendations</h4>
                    <ul className="space-y-2">
                      {aiInsightsMutation.data.recommendations?.map((rec: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-recommendation-${i}`}>
                          <Target className="h-4 w-4 mt-0.5 text-green-500" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm mb-2">Key Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {aiInsightsMutation.data.dataPoints?.map((dp: { metric: string; value: number; trend: string }, i: number) => (
                        <div key={i} className="p-2 rounded border text-center" data-testid={`card-metric-${i}`}>
                          <p className="text-lg font-bold">{dp.value}</p>
                          <p className="text-xs text-muted-foreground">{dp.metric}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {dp.trend === "up" ? <TrendingUp className="h-3 w-3 mr-1" /> : dp.trend === "down" ? <TrendingDown className="h-3 w-3 mr-1" /> : <Minus className="h-3 w-3 mr-1" />}
                            {dp.trend}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center" data-testid="text-disclaimer">
        {dashboard?.disclaimer}
      </p>
    </div>
  );
}
