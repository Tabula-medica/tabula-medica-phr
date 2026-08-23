import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  Users,
  Target,
  FileText,
  Brain,
  Stethoscope,
  Shield,
  DollarSign,
  Clock,
  Heart,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface DashboardData {
  generatedAt: string;
  summary: {
    totalPatients: number;
    activeTreatments: number;
    protocolAdherence: number;
    averageOutcomeScore: number;
    kpiPerformance: number;
  };
  outcomePredictions: {
    totalPredictions: number;
    highRiskPatients: number;
    criticalAlerts: number;
    predictionAccuracy: number;
  };
  protocolDeviations: {
    totalDeviations: number;
    criticalDeviations: number;
    pendingReview: number;
    resolutionRate: number;
  };
  kpiOverview: Array<{
    category: string;
    onTarget: number;
    belowTarget: number;
    averagePerformance: number;
  }>;
  populationHealthSummary: {
    chronicDiseasePrevalence: number;
    preventiveCareCompliance: number;
    highRiskPopulation: number;
    improvementTrend: number;
  };
  noCdsDisclaimer: string;
}

interface HealthcareKPI {
  id: string;
  category: string;
  name: string;
  description: string;
  value: number;
  unit: string;
  target: number;
  previousValue: number;
  trend: "improving" | "stable" | "declining";
  trendPercentage: number;
  benchmark: number;
  benchmarkSource: string;
  dataPoints: Array<{ date: string; value: number }>;
  dimensions: Array<{ name: string; value: number; percentage: number }>;
  insights: string[];
  actionableRecommendations: string[];
  lastUpdated: string;
}

interface TreatmentProtocolDeviation {
  id: string;
  patientId: string;
  protocolId: string;
  protocolName: string;
  condition: string;
  deviationType: string;
  severity: string;
  description: string;
  expectedAction: string;
  actualAction: string;
  detectedAt: string;
  clinicalContext: string;
  potentialImpact: string;
  suggestedResolution: string;
  reviewStatus: string;
  reviewedBy?: string;
  reviewNotes?: string;
  noCdsDisclaimer: string;
}

interface PatientOutcomePrediction {
  id: string;
  patientId: string;
  predictionType: string;
  riskScore: number;
  riskLevel: string;
  confidenceInterval: { lower: number; upper: number };
  timeframe: string;
  contributingFactors: Array<{
    factor: string;
    weight: number;
    category: string;
    direction: string;
  }>;
  recommendedInterventions: string[];
  modelVersion: string;
  generatedAt: string;
  noCdsDisclaimer: string;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "quality": return <Target className="h-4 w-4" />;
    case "efficiency": return <Clock className="h-4 w-4" />;
    case "patient_safety": return <Shield className="h-4 w-4" />;
    case "financial": return <DollarSign className="h-4 w-4" />;
    case "access": return <Users className="h-4 w-4" />;
    case "engagement": return <Heart className="h-4 w-4" />;
    default: return <BarChart3 className="h-4 w-4" />;
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-yellow-500" />;
  }
}

function getSeverityBadge(severity: string) {
  const colors: Record<string, string> = {
    minor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    major: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  };
  return <Badge className={colors[severity] || colors.moderate}>{severity}</Badge>;
}

function getRiskBadge(riskLevel: string) {
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  };
  return <Badge className={colors[riskLevel] || colors.moderate}>{riskLevel}</Badge>;
}

export default function HealthcareAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPatient, setSelectedPatient] = useState("patient-001");
  const [selectedPredictionType, setSelectedPredictionType] = useState<string>("readmission");
  const [selectedKPICategory, setSelectedKPICategory] = useState<string>("all");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [populationAgeRange, setPopulationAgeRange] = useState({ min: 18, max: 85 });
  const [populationConditions, setPopulationConditions] = useState<string[]>(["diabetes", "hypertension"]);
  const [populationRiskLevels, setPopulationRiskLevels] = useState<string[]>(["moderate", "high"]);
  const [populationAnalysisResult, setPopulationAnalysisResult] = useState<any>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/healthcare-analytics/dashboard"]
  });

  const { data: kpis, isLoading: kpisLoading } = useQuery<HealthcareKPI[]>({
    queryKey: ["/api/healthcare-analytics/kpis", selectedKPICategory],
    queryFn: () => fetch(`/api/healthcare-analytics/kpis${selectedKPICategory !== "all" ? `?category=${selectedKPICategory}` : ""}`).then(r => r.json())
  });

  const { data: deviations, isLoading: deviationsLoading } = useQuery<TreatmentProtocolDeviation[]>({
    queryKey: ["/api/healthcare-analytics/protocol-deviations"]
  });

  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = useQuery<PatientOutcomePrediction[]>({
    queryKey: ["/api/healthcare-analytics/predictions"]
  });

  const predictMutation = useMutation({
    mutationFn: async (data: { patientId: string; predictionType: string }) => {
      return apiRequest("POST", "/api/healthcare-analytics/predict-outcome", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/healthcare-analytics/predictions"] });
    }
  });

  const reviewMutation = useMutation({
    mutationFn: async (data: { id: string; reviewStatus: string; reviewedBy: string; reviewNotes?: string }) => {
      return apiRequest("PATCH", `/api/healthcare-analytics/protocol-deviations/${data.id}/review`, {
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewNotes: data.reviewNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/healthcare-analytics/protocol-deviations"] });
    }
  });

  const populationAnalysisMutation = useMutation({
    mutationFn: async (data: { ageRange: { min: number; max: number }; conditions: string[]; riskLevels: string[] }) => {
      const response = await fetch("/api/healthcare-analytics/population-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPopulationAnalysisResult(data);
    },
    onError: (error) => {
      console.error("[PopulationAnalysis] Error:", error);
    }
  });

  const handleRunPopulationAnalysis = () => {
    populationAnalysisMutation.mutate({
      ageRange: populationAgeRange,
      conditions: populationConditions,
      riskLevels: populationRiskLevels
    });
  };

  const handleGeneratePrediction = () => {
    predictMutation.mutate({
      patientId: selectedPatient,
      predictionType: selectedPredictionType
    });
  };

  const handleReviewDeviation = (deviationId: string, status: string) => {
    reviewMutation.mutate({
      id: deviationId,
      reviewStatus: status,
      reviewedBy: "Current Provider",
      reviewNotes: reviewNotes[deviationId]
    });
  };

  if (dashboardLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="healthcare-analytics-dashboard">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6 text-primary" />
            Healthcare Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            AI-powered insights for population health, patient outcomes, and healthcare KPIs
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/healthcare-analytics"] })} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {dashboard?.noCdsDisclaimer && (
        <Alert data-testid="alert-no-cds">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{dashboard.noCdsDisclaimer}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-total-patients">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-xl font-bold">{dashboard?.summary.totalPatients.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-protocol-adherence">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Protocol Adherence</p>
                <p className="text-xl font-bold">{dashboard?.summary.protocolAdherence}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-high-risk">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High-Risk Patients</p>
                <p className="text-xl font-bold">{dashboard?.outcomePredictions.highRiskPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-reviews">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FileText className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Reviews</p>
                <p className="text-xl font-bold">{dashboard?.protocolDeviations.pendingReview}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-kpi-performance">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900">
                <Target className="h-5 w-5 text-teal-600 dark:text-teal-300" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">KPI Performance</p>
                <p className="text-xl font-bold">{dashboard?.summary.kpiPerformance}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-analytics">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="kpis" data-testid="tab-kpis">KPIs</TabsTrigger>
          <TabsTrigger value="predictions" data-testid="tab-predictions">Predictions</TabsTrigger>
          <TabsTrigger value="deviations" data-testid="tab-deviations">Protocol Deviations</TabsTrigger>
          <TabsTrigger value="population" data-testid="tab-population">Population Health</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-kpi-overview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  KPI Performance by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dashboard?.kpiOverview.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(category.category)}
                        <span className="capitalize">{category.category.replace("_", " ")}</span>
                      </div>
                      <span className="text-sm">{category.averagePerformance}%</span>
                    </div>
                    <Progress value={category.averagePerformance} className="h-2" />
                    <div className="flex gap-2 text-xs">
                      <span className="text-green-600">{category.onTarget} on target</span>
                      <span className="text-red-600">{category.belowTarget} below target</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-population-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Population Health Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Chronic Disease Prevalence</p>
                    <p className="text-2xl font-bold">{dashboard?.populationHealthSummary.chronicDiseasePrevalence}%</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Preventive Care Compliance</p>
                    <p className="text-2xl font-bold">{dashboard?.populationHealthSummary.preventiveCareCompliance}%</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">High-Risk Population</p>
                    <p className="text-2xl font-bold">{dashboard?.populationHealthSummary.highRiskPopulation}%</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Improvement Trend</p>
                    <p className="text-2xl font-bold flex items-center gap-1">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      {dashboard?.populationHealthSummary.improvementTrend}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-predictions-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Predictions Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Total Predictions</span>
                  <span className="font-bold">{dashboard?.outcomePredictions.totalPredictions}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>High-Risk Patients</span>
                  <Badge variant="destructive">{dashboard?.outcomePredictions.highRiskPatients}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Critical Alerts</span>
                  <Badge variant="destructive">{dashboard?.outcomePredictions.criticalAlerts}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Prediction Accuracy</span>
                  <span className="font-bold text-green-600">{dashboard?.outcomePredictions.predictionAccuracy}%</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-deviations-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Protocol Deviations Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Total Deviations</span>
                  <span className="font-bold">{dashboard?.protocolDeviations.totalDeviations}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Critical Deviations</span>
                  <Badge variant="destructive">{dashboard?.protocolDeviations.criticalDeviations}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Pending Review</span>
                  <Badge variant="secondary">{dashboard?.protocolDeviations.pendingReview}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span>Resolution Rate</span>
                  <span className="font-bold text-green-600">{dashboard?.protocolDeviations.resolutionRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={selectedKPICategory} onValueChange={setSelectedKPICategory}>
              <SelectTrigger className="w-48" data-testid="select-kpi-category">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
                <SelectItem value="efficiency">Efficiency</SelectItem>
                <SelectItem value="patient_safety">Patient Safety</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="access">Access</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kpisLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {kpis?.map((kpi) => (
                <Card key={kpi.id} data-testid={`card-kpi-${kpi.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {getCategoryIcon(kpi.category)}
                        {kpi.name}
                      </CardTitle>
                      {getTrendIcon(kpi.trend)}
                    </div>
                    <CardDescription>{kpi.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-3xl font-bold">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                        <p className="text-sm text-muted-foreground">{kpi.unit}</p>
                      </div>
                      <div className={`text-sm ${kpi.trendPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {kpi.trendPercentage >= 0 ? <ArrowUp className="h-4 w-4 inline" /> : <ArrowDown className="h-4 w-4 inline" />}
                        {Math.abs(kpi.trendPercentage).toFixed(1)}% from previous
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Target: {kpi.target}</span>
                        <span>Benchmark: {kpi.benchmark}</span>
                      </div>
                      <Progress 
                        value={Math.min(100, (kpi.value / kpi.target) * 100)} 
                        className="h-2" 
                      />
                      <p className="text-xs text-muted-foreground">Benchmark source: {kpi.benchmarkSource}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Breakdown by Dimension</p>
                      <div className="space-y-2">
                        {kpi.dimensions.slice(0, 3).map((dim, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>{dim.name}</span>
                            <div className="flex items-center gap-2">
                              <Progress value={dim.percentage} className="w-20 h-1" />
                              <span className="text-muted-foreground w-12 text-right">{dim.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Key Insights</p>
                      <ul className="text-sm space-y-1">
                        {kpi.insights.slice(0, 2).map((insight, i) => (
                          <li key={i} className="text-muted-foreground">• {insight}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="text-sm font-medium mb-2">Recommendations</p>
                      <ul className="text-sm space-y-1">
                        {kpi.actionableRecommendations.slice(0, 2).map((rec, i) => (
                          <li key={i} className="text-muted-foreground flex items-start gap-1">
                            <CheckCircle className="h-3 w-3 mt-1 text-green-500 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <Card data-testid="card-generate-prediction">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Generate AI Outcome Prediction
              </CardTitle>
              <CardDescription>
                Use AI to predict patient outcomes for operational planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <label htmlFor="healthcare-analytics-das-patient" className="text-sm font-medium">Patient</label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger id="healthcare-analytics-das-patient" className="w-48" data-testid="select-patient">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient-001">John Smith (Diabetes/HTN)</SelectItem>
                      <SelectItem value="patient-002">Maria Garcia (Lupus/RA)</SelectItem>
                      <SelectItem value="patient-003">Robert Johnson (Heart Failure)</SelectItem>
                      <SelectItem value="patient-004">Susan Williams (Breast Cancer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="healthcare-analytics-das-prediction-type" className="text-sm font-medium">Prediction Type</label>
                  <Select value={selectedPredictionType} onValueChange={setSelectedPredictionType}>
                    <SelectTrigger id="healthcare-analytics-das-prediction-type" className="w-48" data-testid="select-prediction-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="readmission">30-Day Readmission</SelectItem>
                      <SelectItem value="mortality">1-Year Mortality</SelectItem>
                      <SelectItem value="complication">Complication Risk</SelectItem>
                      <SelectItem value="recovery">Recovery Trajectory</SelectItem>
                      <SelectItem value="deterioration">Clinical Deterioration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleGeneratePrediction}
                  disabled={predictMutation.isPending}
                  data-testid="button-generate-prediction"
                >
                  {predictMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate Prediction
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {predictionsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : predictions && predictions.length > 0 ? (
            <div className="space-y-4">
              {predictions.map((prediction) => (
                <Card key={prediction.id} data-testid={`card-prediction-${prediction.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        {prediction.predictionType.replace("_", " ")} Prediction
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {getRiskBadge(prediction.riskLevel)}
                        <span className="text-sm text-muted-foreground">
                          Timeframe: {prediction.timeframe}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">Risk Score</p>
                        <p className="text-3xl font-bold">{prediction.riskScore.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">
                          CI: {prediction.confidenceInterval.lower.toFixed(1)} - {prediction.confidenceInterval.upper.toFixed(1)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Contributing Factors</p>
                        <ul className="text-sm space-y-1">
                          {prediction.contributingFactors.slice(0, 3).map((factor, i) => (
                            <li key={i} className="flex justify-between">
                              <span>{factor.factor}</span>
                              <span className={factor.direction === "positive" ? "text-green-600" : "text-red-600"}>
                                {(factor.weight * 100).toFixed(0)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Recommended Interventions</p>
                        <ul className="text-sm space-y-1">
                          {prediction.recommendedInterventions.slice(0, 3).map((intervention, i) => (
                            <li key={i} className="text-muted-foreground">• {intervention}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{prediction.noCdsDisclaimer}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No predictions generated yet. Use the form above to generate AI outcome predictions.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deviations" className="space-y-4">
          {deviationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {deviations?.map((deviation) => (
                <Card key={deviation.id} data-testid={`card-deviation-${deviation.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        {deviation.protocolName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(deviation.severity)}
                        <Badge variant={deviation.reviewStatus === "pending" ? "secondary" : "outline"}>
                          {deviation.reviewStatus}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {deviation.condition} • {deviation.deviationType.replace("_", " ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Expected Action</p>
                        <p className="text-sm text-muted-foreground">{deviation.expectedAction}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Actual Action</p>
                        <p className="text-sm text-muted-foreground">{deviation.actualAction}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Description</p>
                      <p className="text-sm text-muted-foreground">{deviation.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Clinical Context</p>
                        <p className="text-sm text-muted-foreground">{deviation.clinicalContext}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Potential Impact</p>
                        <p className="text-sm text-muted-foreground">{deviation.potentialImpact}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium">Suggested Resolution</p>
                      <p className="text-sm text-muted-foreground">{deviation.suggestedResolution}</p>
                    </div>

                    {deviation.reviewStatus === "pending" && (
                      <div className="space-y-3 pt-3 border-t">
                        <Textarea
                          placeholder="Add review notes (optional)..."
                          value={reviewNotes[deviation.id] || ""}
                          onChange={(e) => setReviewNotes(prev => ({ ...prev, [deviation.id]: e.target.value }))}
                          data-testid={`textarea-review-${deviation.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => handleReviewDeviation(deviation.id, "justified")}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-justify-${deviation.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Justified
                          </Button>
                          <Button
                            onClick={() => handleReviewDeviation(deviation.id, "corrected")}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-correct-${deviation.id}`}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Mark Corrected
                          </Button>
                        </div>
                      </div>
                    )}

                    {deviation.reviewedBy && (
                      <div className="pt-3 border-t">
                        <p className="text-sm">
                          <span className="font-medium">Reviewed by:</span> {deviation.reviewedBy}
                        </p>
                        {deviation.reviewNotes && (
                          <p className="text-sm text-muted-foreground mt-1">{deviation.reviewNotes}</p>
                        )}
                      </div>
                    )}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{deviation.noCdsDisclaimer}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="population" className="space-y-4">
          <Card data-testid="card-population-analysis-form">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Population Analysis
              </CardTitle>
              <CardDescription>
                Run AI-powered population health analysis to identify trends and at-risk cohorts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age-range">Age Range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="age-range-min"
                      type="number"
                      value={populationAgeRange.min}
                      onChange={(e) => setPopulationAgeRange({ ...populationAgeRange, min: parseInt(e.target.value) || 0 })}
                      className="w-20"
                      data-testid="input-age-min"
                    />
                    <span>to</span>
                    <Input
                      id="age-range-max"
                      type="number"
                      value={populationAgeRange.max}
                      onChange={(e) => setPopulationAgeRange({ ...populationAgeRange, max: parseInt(e.target.value) || 0 })}
                      className="w-20"
                      data-testid="input-age-max"
                    />
                    <span className="text-sm text-muted-foreground">years</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthcare-analytics-das-conditions">Conditions</Label>
                  <Select
                    value={populationConditions.join(",")}
                    onValueChange={(value) => setPopulationConditions(value.split(","))}
                  >
                    <SelectTrigger id="healthcare-analytics-das-conditions" data-testid="select-conditions">
                      <SelectValue placeholder="Select conditions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diabetes,hypertension">Diabetes & Hypertension</SelectItem>
                      <SelectItem value="diabetes">Diabetes Only</SelectItem>
                      <SelectItem value="hypertension">Hypertension Only</SelectItem>
                      <SelectItem value="diabetes,hypertension,heart_disease">All Chronic Conditions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="healthcare-analytics-das-risk-levels">Risk Levels</Label>
                  <Select
                    value={populationRiskLevels.join(",")}
                    onValueChange={(value) => setPopulationRiskLevels(value.split(","))}
                  >
                    <SelectTrigger id="healthcare-analytics-das-risk-levels" data-testid="select-risk-levels">
                      <SelectValue placeholder="Select risk levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low,moderate">Low to Moderate</SelectItem>
                      <SelectItem value="moderate,high">Moderate to High</SelectItem>
                      <SelectItem value="high,critical">High & Critical</SelectItem>
                      <SelectItem value="low,moderate,high,critical">All Risk Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleRunPopulationAnalysis}
                disabled={populationAnalysisMutation.isPending}
                data-testid="btn-run-analysis"
              >
                {populationAnalysisMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Run Analysis
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {populationAnalysisResult && (
            <Card data-testid="card-population-analysis-result">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {populationAnalysisResult.noCdsDisclaimer || "IMPORTANT: This analytics report is for INFORMATIONAL and OPERATIONAL purposes only. It does NOT constitute clinical decision support."}
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Patients</p>
                    <p className="text-xl font-bold">{populationAnalysisResult.analysis?.demographics?.totalPatients || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Average Age</p>
                    <p className="text-xl font-bold">{populationAnalysisResult.analysis?.demographics?.averageAge || 0}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                    <p className="text-xl font-bold">{((populationAnalysisResult.analysis?.overallRiskScore || 0) * 100).toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Intervention Priority</p>
                    <p className="text-xl font-bold capitalize">{populationAnalysisResult.analysis?.interventionPriority || "N/A"}</p>
                  </div>
                </div>
                {populationAnalysisResult.analysis?.aiInsights && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">AI Insights</h4>
                    <p className="text-sm text-muted-foreground">{populationAnalysisResult.analysis.aiInsights}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-chronic-prevalence">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                    <Heart className="h-5 w-5 text-red-600 dark:text-red-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Chronic Disease Prevalence</p>
                    <p className="text-xl font-bold">{dashboard?.populationHealthSummary.chronicDiseasePrevalence}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-preventive-compliance">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Preventive Care Compliance</p>
                    <p className="text-xl font-bold">{dashboard?.populationHealthSummary.preventiveCareCompliance}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-high-risk-population">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">High-Risk Population</p>
                    <p className="text-xl font-bold">{dashboard?.populationHealthSummary.highRiskPopulation}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-improvement-trend">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Improvement Trend</p>
                    <p className="text-xl font-bold text-green-600">+{dashboard?.populationHealthSummary.improvementTrend}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Population Health Trends</CardTitle>
              <CardDescription>
                Overview of key population health metrics and trends across your patient population
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">Risk Stratification</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Low Risk</span>
                        <span>45%</span>
                      </div>
                      <Progress value={45} className="h-2 bg-green-100" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Moderate Risk</span>
                        <span>32%</span>
                      </div>
                      <Progress value={32} className="h-2 bg-yellow-100" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>High Risk</span>
                        <span>18%</span>
                      </div>
                      <Progress value={18} className="h-2 bg-orange-100" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Critical</span>
                        <span>5%</span>
                      </div>
                      <Progress value={5} className="h-2 bg-red-100" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-4">Key Population Insights</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                      <span>Preventive care utilization has improved 8% over the past quarter</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                      <span>Diabetes management shows opportunity for improvement in 65+ age group</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Activity className="h-4 w-4 text-blue-500 mt-0.5" />
                      <span>Emergency department utilization trending downward</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-purple-500 mt-0.5" />
                      <span>Care coordination programs showing positive outcomes</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
