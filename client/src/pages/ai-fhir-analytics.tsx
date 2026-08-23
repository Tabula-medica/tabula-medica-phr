import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  TrendingUp, 
  FileText, 
  Users, 
  Activity, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronRight,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Heart,
  Shield,
  Clock,
  Loader2
} from "lucide-react";

interface PatientData {
  id: string;
  demographics: {
    age?: number;
    gender?: string;
    race?: string;
    ethnicity?: string;
  };
  conditions: Array<{ code: string; display: string; status: string; category?: string }>;
  medications: Array<{ code: string; display: string; status: string; dosage?: string }>;
  observations: Array<{ code: string; display: string; value?: string | number; unit?: string; category?: string }>;
  encounters: Array<{ type: string; status: string; reason?: string }>;
  riskFactors: string[];
}

interface PredictiveModel {
  id: string;
  modelType: string;
  patientId: string;
  prediction: {
    outcome: string;
    probability: number;
    confidence: number;
    timeframe: string;
  };
  riskFactors: Array<{ factor: string; impact: string; contribution: number; evidence: string }>;
  protectiveFactors: string[];
  recommendations: string[];
  modelMetadata: {
    algorithm: string;
    trainingDataSize: number;
    accuracy: number;
    lastUpdated: string;
  };
  generatedAt: string;
  disclaimer: string;
}

interface PopulationHealthTrend {
  id: string;
  trendType: string;
  condition?: string;
  metric: string;
  timeRange: { start: string; end: string };
  dataPoints: Array<{ date: string; value: number; count: number }>;
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    trend: string;
    percentChange: number;
  };
  demographicBreakdown?: Array<{ category: string; value: string; count: number; percentage: number; risk?: number }>;
  riskFactorAnalysis: Array<{ factor: string; prevalence: number; relativeRisk: number; attributableRisk: number; affectedPopulation: number }>;
  insights: string[];
  generatedAt: string;
  disclaimer: string;
}

interface NaturalLanguageReport {
  id: string;
  reportType: string;
  title: string;
  executiveSummary: string;
  sections: Array<{ title: string; content: string }>;
  keyFindings: Array<{ finding: string; significance: string; evidence: string; actionRequired: boolean }>;
  recommendations: Array<{ recommendation: string; priority: string; impact: string; resources: string }>;
  dataQuality: { completeness: number; accuracy: number; timeliness: number; issues: string[] };
  generatedAt: string;
  generatedBy: string;
  disclaimer: string;
}

interface AnalyticsMetadata {
  version: string;
  supportedModelTypes: string[];
  supportedTrendTypes: string[];
  supportedReportTypes: string[];
  totalPredictions: number;
  totalTrends: number;
  totalReports: number;
  noCdsCompliance: string;
}

export default function AIFHIRAnalytics() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("predictions");
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedModelType, setSelectedModelType] = useState<string>("readmission_risk");
  const [selectedTrendType, setSelectedTrendType] = useState<string>("prevalence");
  const [selectedReportType, setSelectedReportType] = useState<string>("population_analysis");
  const [trendCondition, setTrendCondition] = useState<string>("");

  const { data: metadata } = useQuery<AnalyticsMetadata>({
    queryKey: ["/api/fhir-analytics/metadata"],
  });

  const { data: patientsData } = useQuery<{ patients: PatientData[] }>({
    queryKey: ["/api/fhir-analytics/patients"],
  });

  const { data: predictionsData, isLoading: loadingPredictions } = useQuery<{ predictions: PredictiveModel[] }>({
    queryKey: ["/api/fhir-analytics/predictions"],
  });

  const { data: trendsData, isLoading: loadingTrends } = useQuery<{ trends: PopulationHealthTrend[] }>({
    queryKey: ["/api/fhir-analytics/trends"],
  });

  const { data: reportsData, isLoading: loadingReports } = useQuery<{ reports: NaturalLanguageReport[] }>({
    queryKey: ["/api/fhir-analytics/reports"],
  });

  const generatePredictionMutation = useMutation({
    mutationFn: async (data: { patientId: string; modelType: string }) => {
      const response = await apiRequest("POST", "/api/fhir-analytics/predictions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Success", description: "Predictive model generated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateTrendMutation = useMutation({
    mutationFn: async (data: { trendType: string; condition?: string; timeRangeMonths?: number }) => {
      const response = await apiRequest("POST", "/api/fhir-analytics/trends", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Success", description: "Population trend analysis completed" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: { reportType: string; patientId?: string; condition?: string }) => {
      const response = await apiRequest("POST", "/api/fhir-analytics/reports", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Success", description: "Natural language report generated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePredictionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-analytics/predictions/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/predictions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Deleted", description: "Prediction removed" });
    },
  });

  const deleteTrendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-analytics/trends/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Deleted", description: "Trend analysis removed" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-analytics/reports/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
      toast({ title: "Deleted", description: "Report removed" });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/metadata"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/predictions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/trends"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fhir-analytics/reports"] });
    toast({ title: "Refreshed", description: "Data reloaded" });
  };

  const getRiskBadge = (probability: number) => {
    if (probability >= 0.7) return <Badge variant="destructive" data-testid="badge-risk-high">High Risk</Badge>;
    if (probability >= 0.4) return <Badge variant="default" data-testid="badge-risk-medium">Medium Risk</Badge>;
    return <Badge variant="secondary" data-testid="badge-risk-low">Low Risk</Badge>;
  };

  const getImpactBadge = (impact: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      high: "destructive",
      medium: "default",
      low: "secondary",
    };
    return <Badge variant={variants[impact] || "outline"} data-testid={`badge-impact-${impact}`}>{impact}</Badge>;
  };

  const getSignificanceBadge = (significance: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      critical: "destructive",
      high: "default",
      medium: "secondary",
      low: "outline",
    };
    return <Badge variant={variants[significance] || "outline"} data-testid={`badge-significance-${significance}`}>{significance}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      immediate: "destructive",
      "short-term": "default",
      "long-term": "secondary",
    };
    return <Badge variant={variants[priority] || "outline"} data-testid={`badge-priority-${priority}`}>{priority}</Badge>;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-foreground" />;
    if (trend === "decreasing") return <TrendingUp className="h-4 w-4 text-muted-foreground rotate-180" />;
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const patients = patientsData?.patients || [];
  const predictions = predictionsData?.predictions || [];
  const trends = trendsData?.trends || [];
  const reports = reportsData?.reports || [];

  return (
    <div className="min-h-screen bg-background p-6" data-testid="page-ai-fhir-analytics">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Brain className="h-8 w-8" />
              AI FHIR Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Predictive modeling, population health trends, and natural language reporting
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Alert variant="default" data-testid="alert-compliance">
          <Shield className="h-4 w-4" />
          <AlertTitle>NO-CDS Compliance Notice</AlertTitle>
          <AlertDescription>
            All analytics outputs are for INFORMATIONAL, OPERATIONAL PLANNING, and QUALITY IMPROVEMENT purposes ONLY. 
            They do NOT constitute clinical decision support, medical advice, or treatment recommendations.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-predictions">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Predictive Models</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-predictions">{metadata?.totalPredictions || 0}</div>
              <p className="text-xs text-muted-foreground">{metadata?.supportedModelTypes.length || 5} model types</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-trends">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Population Trends</CardTitle>
              <LineChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-trends">{metadata?.totalTrends || 0}</div>
              <p className="text-xs text-muted-foreground">{metadata?.supportedTrendTypes.length || 5} trend types</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-reports">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NL Reports</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-reports">{metadata?.totalReports || 0}</div>
              <p className="text-xs text-muted-foreground">{metadata?.supportedReportTypes.length || 5} report types</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-patients">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sample Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-stat-patients">{patients.length}</div>
              <p className="text-xs text-muted-foreground">Available for analysis</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="predictions" data-testid="tab-predictions">
              <Target className="h-4 w-4 mr-2" />
              Predictions
            </TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">
              <BarChart3 className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Clock className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="predictions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Predictive Model</CardTitle>
                <CardDescription>
                  Create AI-powered outcome predictions based on patient FHIR data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-select-patient" className="text-sm font-medium">Select Patient</label>
                    <Select value={selectedPatient} onValueChange={setSelectedPatient} data-testid="select-patient">
                      <SelectTrigger id="ai-fhir-analytics-select-patient" data-testid="select-patient-trigger">
                        <SelectValue placeholder="Choose a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id} data-testid={`option-patient-${patient.id}`}>
                            {patient.id} - {patient.demographics.age}y {patient.demographics.gender}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-model-type" className="text-sm font-medium">Model Type</label>
                    <Select value={selectedModelType} onValueChange={setSelectedModelType} data-testid="select-model-type">
                      <SelectTrigger id="ai-fhir-analytics-model-type" data-testid="select-model-type-trigger">
                        <SelectValue placeholder="Choose model type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="readmission_risk">Readmission Risk</SelectItem>
                        <SelectItem value="disease_progression">Disease Progression</SelectItem>
                        <SelectItem value="mortality_risk">Mortality Risk</SelectItem>
                        <SelectItem value="complication_risk">Complication Risk</SelectItem>
                        <SelectItem value="treatment_response">Treatment Response</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        if (selectedPatient) {
                          generatePredictionMutation.mutate({
                            patientId: selectedPatient,
                            modelType: selectedModelType,
                          });
                        }
                      }}
                      disabled={!selectedPatient || generatePredictionMutation.isPending}
                      data-testid="button-generate-prediction"
                    >
                      {generatePredictionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4 mr-2" />
                      )}
                      Generate Prediction
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingPredictions ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : predictions.length > 0 ? (
              <div className="space-y-4">
                {predictions.slice(0, 5).map((prediction) => (
                  <Card key={prediction.id} data-testid={`card-prediction-${prediction.id}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Heart className="h-5 w-5" />
                            {prediction.modelType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          </CardTitle>
                          <CardDescription>
                            Patient: {prediction.patientId} | Generated: {new Date(prediction.generatedAt).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(prediction.prediction.probability)}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deletePredictionMutation.mutate(prediction.id)}
                            data-testid={`button-delete-prediction-${prediction.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">Probability</div>
                          <div className="text-2xl font-bold" data-testid={`text-probability-${prediction.id}`}>
                            {(prediction.prediction.probability * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">Confidence</div>
                          <div className="text-2xl font-bold">
                            {(prediction.prediction.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">Timeframe</div>
                          <div className="text-2xl font-bold">{prediction.prediction.timeframe}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Outcome Assessment</h4>
                        <p className="text-sm text-muted-foreground" data-testid={`text-outcome-${prediction.id}`}>
                          {prediction.prediction.outcome}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Risk Factors</h4>
                        <div className="space-y-2">
                          {prediction.riskFactors.slice(0, 3).map((rf, idx) => (
                            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted rounded">
                              <span className="text-sm">{rf.factor}</span>
                              <div className="flex items-center gap-2">
                                {getImpactBadge(rf.impact)}
                                <span className="text-xs text-muted-foreground">
                                  {(rf.contribution * 100).toFixed(0)}% contribution
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <ul className="space-y-1">
                          {prediction.recommendations.slice(0, 3).map((rec, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Alert variant="default">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{prediction.disclaimer}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No predictions generated yet. Select a patient and model type to begin.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analyze Population Health Trends</CardTitle>
                <CardDescription>
                  Identify patterns and risk factors from aggregated FHIR records
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-trend-type" className="text-sm font-medium">Trend Type</label>
                    <Select value={selectedTrendType} onValueChange={setSelectedTrendType} data-testid="select-trend-type">
                      <SelectTrigger id="ai-fhir-analytics-trend-type" data-testid="select-trend-type-trigger">
                        <SelectValue placeholder="Choose trend type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prevalence">Prevalence</SelectItem>
                        <SelectItem value="incidence">Incidence</SelectItem>
                        <SelectItem value="outcome">Outcome</SelectItem>
                        <SelectItem value="utilization">Utilization</SelectItem>
                        <SelectItem value="cost">Cost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-condition-optional" className="text-sm font-medium">Condition (Optional)</label>
                    <Select value={trendCondition} onValueChange={setTrendCondition} data-testid="select-trend-condition">
                      <SelectTrigger id="ai-fhir-analytics-condition-optional" data-testid="select-trend-condition-trigger">
                        <SelectValue placeholder="All conditions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Conditions</SelectItem>
                        <SelectItem value="hypertension">Hypertension</SelectItem>
                        <SelectItem value="diabetes">Diabetes</SelectItem>
                        <SelectItem value="heart_failure">Heart Failure</SelectItem>
                        <SelectItem value="asthma">Asthma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        generateTrendMutation.mutate({
                          trendType: selectedTrendType,
                          condition: trendCondition || undefined,
                          timeRangeMonths: 12,
                        });
                      }}
                      disabled={generateTrendMutation.isPending}
                      data-testid="button-analyze-trends"
                    >
                      {generateTrendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingUp className="h-4 w-4 mr-2" />
                      )}
                      Analyze Trends
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingTrends ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : trends.length > 0 ? (
              <div className="space-y-4">
                {trends.slice(0, 5).map((trend) => (
                  <Card key={trend.id} data-testid={`card-trend-${trend.id}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            {trend.metric}
                          </CardTitle>
                          <CardDescription>
                            {trend.condition ? `Condition: ${trend.condition} | ` : ""}
                            Period: {new Date(trend.timeRange.start).toLocaleDateString()} - {new Date(trend.timeRange.end).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {getTrendIcon(trend.statistics.trend)}
                            <span className="text-sm font-medium">{trend.statistics.trend}</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteTrendMutation.mutate(trend.id)}
                            data-testid={`button-delete-trend-${trend.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground">Mean</div>
                          <div className="text-lg font-bold">{trend.statistics.mean.toFixed(1)}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground">Median</div>
                          <div className="text-lg font-bold">{trend.statistics.median.toFixed(1)}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground">Std Dev</div>
                          <div className="text-lg font-bold">{trend.statistics.stdDev.toFixed(1)}</div>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <div className="text-xs text-muted-foreground">Change</div>
                          <div className="text-lg font-bold">{trend.statistics.percentChange.toFixed(1)}%</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Population Risk Factors</h4>
                        <div className="space-y-2">
                          {trend.riskFactorAnalysis.slice(0, 3).map((rf, idx) => (
                            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted rounded">
                              <span className="text-sm">{rf.factor}</span>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>Prevalence: {(rf.prevalence * 100).toFixed(0)}%</span>
                                <span>RR: {rf.relativeRisk.toFixed(2)}</span>
                                <span>Affected: {rf.affectedPopulation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Key Insights</h4>
                        <ul className="space-y-1">
                          {trend.insights.slice(0, 3).map((insight, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Alert variant="default">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{trend.disclaimer}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No trend analyses generated yet. Select a trend type to begin population health analysis.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Natural Language Report</CardTitle>
                <CardDescription>
                  Create comprehensive narrative reports summarizing key findings from FHIR data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-report-type" className="text-sm font-medium">Report Type</label>
                    <Select value={selectedReportType} onValueChange={setSelectedReportType} data-testid="select-report-type">
                      <SelectTrigger id="ai-fhir-analytics-report-type" data-testid="select-report-type-trigger">
                        <SelectValue placeholder="Choose report type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient_summary">Patient Summary</SelectItem>
                        <SelectItem value="population_analysis">Population Analysis</SelectItem>
                        <SelectItem value="trend_report">Trend Report</SelectItem>
                        <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
                        <SelectItem value="quality_metrics">Quality Metrics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="ai-fhir-analytics-patient-optional" className="text-sm font-medium">Patient (Optional)</label>
                    <Select data-testid="select-report-patient">
                      <SelectTrigger id="ai-fhir-analytics-patient-optional" data-testid="select-report-patient-trigger">
                        <SelectValue placeholder="All patients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Patients</SelectItem>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.id} - {patient.demographics.age}y {patient.demographics.gender}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        generateReportMutation.mutate({
                          reportType: selectedReportType,
                        });
                      }}
                      disabled={generateReportMutation.isPending}
                      data-testid="button-generate-report"
                    >
                      {generateReportMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-2" />
                      )}
                      Generate Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loadingReports ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : reports.length > 0 ? (
              <div className="space-y-4">
                {reports.slice(0, 5).map((report) => (
                  <Card key={report.id} data-testid={`card-report-${report.id}`}>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {report.title}
                          </CardTitle>
                          <CardDescription>
                            Type: {report.reportType.replace(/_/g, " ")} | Generated: {new Date(report.generatedAt).toLocaleString()}
                          </CardDescription>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteReportMutation.mutate(report.id)}
                          data-testid={`button-delete-report-${report.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Executive Summary</h4>
                        <p className="text-sm text-muted-foreground" data-testid={`text-summary-${report.id}`}>
                          {report.executiveSummary}
                        </p>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Key Findings</h4>
                        <div className="space-y-2">
                          {report.keyFindings.slice(0, 3).map((finding, idx) => (
                            <div key={idx} className="p-3 bg-muted rounded-lg">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-medium">{finding.finding}</span>
                                <div className="flex items-center gap-2">
                                  {getSignificanceBadge(finding.significance)}
                                  {finding.actionRequired && (
                                    <Badge variant="destructive">Action Required</Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{finding.evidence}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Recommendations</h4>
                        <div className="space-y-2">
                          {report.recommendations.slice(0, 3).map((rec, idx) => (
                            <div key={idx} className="p-3 bg-muted rounded-lg">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-medium">{rec.recommendation}</span>
                                {getPriorityBadge(rec.priority)}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Impact: {rec.impact} | Resources: {rec.resources}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Data Quality</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 bg-muted rounded text-center">
                            <div className="text-lg font-bold">{(report.dataQuality.completeness * 100).toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">Completeness</div>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <div className="text-lg font-bold">{(report.dataQuality.accuracy * 100).toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">Accuracy</div>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <div className="text-lg font-bold">{(report.dataQuality.timeliness * 100).toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">Timeliness</div>
                          </div>
                        </div>
                      </div>

                      <Alert variant="default">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{report.disclaimer}</AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No reports generated yet. Select a report type to generate a natural language summary.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics History</CardTitle>
                <CardDescription>
                  View all generated analytics outputs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Predictive Models ({predictions.length})
                    </h4>
                    {predictions.length > 0 ? (
                      <div className="space-y-2">
                        {predictions.map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                            <div>
                              <span className="font-medium">{p.modelType.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground ml-2">Patient: {p.patientId}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getRiskBadge(p.prediction.probability)}
                              <span className="text-xs text-muted-foreground">
                                {new Date(p.generatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No predictions yet</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Population Trends ({trends.length})
                    </h4>
                    {trends.length > 0 ? (
                      <div className="space-y-2">
                        {trends.map((t) => (
                          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                            <div>
                              <span className="font-medium">{t.trendType}</span>
                              {t.condition && <span className="text-muted-foreground ml-2">({t.condition})</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              {getTrendIcon(t.statistics.trend)}
                              <span className="text-sm">{t.statistics.percentChange.toFixed(1)}%</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(t.generatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No trends yet</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Natural Language Reports ({reports.length})
                    </h4>
                    {reports.length > 0 ? (
                      <div className="space-y-2">
                        {reports.map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted rounded-lg">
                            <div>
                              <span className="font-medium">{r.title}</span>
                              <span className="text-muted-foreground ml-2">({r.reportType.replace(/_/g, " ")})</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.generatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No reports yet</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
