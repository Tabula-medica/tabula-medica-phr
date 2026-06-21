import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Brain,
  Calendar,
  ChevronRight,
  Cpu,
  FileWarning,
  Lightbulb,
  MapPin,
  Pill,
  RefreshCw,
  Shield,
  Stethoscope,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";

interface ForecastingDashboard {
  lastUpdated: string;
  activeOutbreakForecasts: number;
  criticalShortages: number;
  pendingInterventions: number;
  overallHealthRiskIndex: number;
  topThreats: { threat: string; riskLevel: string; trend: string }[];
  recentAlerts: { type: string; message: string; severity: string; timestamp: string }[];
  noCdsDisclaimer: string;
}

interface OutbreakForecast {
  id: string;
  diseaseType: string;
  diseaseName: string;
  region: string;
  currentCases: number;
  predictedCases: { week1: number; week2: number; week4: number; week8: number };
  riskLevel: string;
  confidenceScore: number;
  contributingFactors: string[];
  seasonalTrends: string;
  transmissionRate: number;
  predictedPeakDate: string;
  predictedPeakCases: number;
  modelType: string;
  aiInsights: string[];
  lastUpdated: string;
  noCdsDisclaimer: string;
}

interface MedicationShortage {
  id: string;
  medicationName: string;
  therapeuticClass: string;
  currentInventoryLevel: string;
  daysOfSupplyRemaining: number;
  affectedRegions: string[];
  affectedFacilities: number;
  supplyChainStatus: {
    manufacturerStatus: string;
    nextExpectedShipment: string;
    leadTimeDays: number;
  };
  demandForecast: { currentDemand: number; projectedDemand: number; demandTrend: string };
  alternativeMedications: { name: string; availability: string; substitutionNotes: string }[];
  aiPrediction: {
    predictedShortageDate: string;
    predictedRecoveryDate: string;
    riskScore: number;
    keyDrivers: string[];
  };
  recommendedActions: string[];
  noCdsDisclaimer: string;
}

interface Intervention {
  id: string;
  interventionType: string;
  title: string;
  description: string;
  targetPopulation: { ageGroups: string[]; riskFactors: string[]; regions: string[]; estimatedSize: number };
  priority: string;
  rationale: string[];
  expectedImpact: { livesProtected: number; casesAverted: number; costSavings: number; roiPercentage: number };
  resourceRequirements: { personnel: number; budget: number; timeframeDays: number; materials: string[] };
  implementationSteps: string[];
  successMetrics: string[];
  barriers: string[];
  aiConfidenceScore: number;
  noCdsDisclaimer: string;
}

interface TrendAnalysis {
  id: string;
  analysisType: string;
  title: string;
  timeframe: string;
  keyFindings: string[];
  trendDirection: string;
  statisticalSignificance: number;
  dataPoints: { date: string; value: number; predicted?: boolean }[];
  correlations: { factor: string; correlationStrength: number; relationship: string }[];
  aiInterpretation: string;
  actionableInsights: string[];
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated analysis is for public health surveillance and planning purposes only. It does NOT constitute medical advice, clinical decision support, or treatment recommendations.";

export default function AIPublicHealthForecasting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedForecast, setSelectedForecast] = useState<OutbreakForecast | null>(null);
  const [selectedShortage, setSelectedShortage] = useState<MedicationShortage | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<ForecastingDashboard>({
    queryKey: ["/api/public-health-forecasting/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/public-health-forecasting/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: forecastsData } = useQuery<{ forecasts: OutbreakForecast[] }>({
    queryKey: ["/api/public-health-forecasting/outbreaks"],
    queryFn: async () => {
      const res = await fetch("/api/public-health-forecasting/outbreaks");
      if (!res.ok) throw new Error("Failed to fetch forecasts");
      return res.json();
    },
  });

  const { data: shortagesData } = useQuery<{ shortages: MedicationShortage[] }>({
    queryKey: ["/api/public-health-forecasting/shortages"],
    queryFn: async () => {
      const res = await fetch("/api/public-health-forecasting/shortages");
      if (!res.ok) throw new Error("Failed to fetch shortages");
      return res.json();
    },
  });

  const { data: interventionsData } = useQuery<{ interventions: Intervention[] }>({
    queryKey: ["/api/public-health-forecasting/interventions"],
    queryFn: async () => {
      const res = await fetch("/api/public-health-forecasting/interventions");
      if (!res.ok) throw new Error("Failed to fetch interventions");
      return res.json();
    },
  });

  const { data: trendsData } = useQuery<{ analyses: TrendAnalysis[] }>({
    queryKey: ["/api/public-health-forecasting/trends"],
    queryFn: async () => {
      const res = await fetch("/api/public-health-forecasting/trends");
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
  });

  const generateInterventionMutation = useMutation({
    mutationFn: async (context: { threatType: string; region: string; population: number }) => {
      const res = await apiRequest("POST", "/api/public-health-forecasting/interventions/generate", context);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-health-forecasting/interventions"] });
      toast({ title: "Intervention recommendation generated" });
    },
    onError: () => {
      toast({ title: "Failed to generate intervention", variant: "destructive" });
    },
  });

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive" data-testid="badge-risk-critical">Critical</Badge>;
      case "high":
        return <Badge className="bg-red-500 hover:bg-red-600" data-testid="badge-risk-high">High</Badge>;
      case "elevated":
        return <Badge className="bg-orange-500 hover:bg-orange-600" data-testid="badge-risk-elevated">Elevated</Badge>;
      case "moderate":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600" data-testid="badge-risk-moderate">Moderate</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-risk-low">Low</Badge>;
    }
  };

  const getInventoryBadge = (level: string) => {
    switch (level) {
      case "stockout":
        return <Badge variant="destructive">Stockout</Badge>;
      case "critical":
        return <Badge className="bg-red-500">Critical</Badge>;
      case "low":
        return <Badge className="bg-orange-500">Low</Badge>;
      default:
        return <Badge className="bg-green-500">Adequate</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "emergency":
        return <Badge variant="destructive">Emergency</Badge>;
      case "urgent":
        return <Badge className="bg-orange-500">Urgent</Badge>;
      case "elevated":
        return <Badge className="bg-yellow-500">Elevated</Badge>;
      default:
        return <Badge variant="secondary">Routine</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <div className="p-6 space-y-6" data-testid="ai-public-health-forecasting-page">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Brain className="w-7 h-7 text-primary" />
          AI Public Health Forecasting
        </h1>
        <p className="text-muted-foreground">
          Disease outbreak prediction, medication shortage detection, and intervention recommendations
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">NO-CDS Compliance</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          {NO_CDS_DISCLAIMER}
        </AlertDescription>
      </Alert>

      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-risk-index">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${dashboardData.overallHealthRiskIndex >= 60 ? "bg-red-100 dark:bg-red-900" : dashboardData.overallHealthRiskIndex >= 30 ? "bg-orange-100 dark:bg-orange-900" : "bg-green-100 dark:bg-green-900"}`}>
                  <Shield className={`w-5 h-5 ${dashboardData.overallHealthRiskIndex >= 60 ? "text-red-600" : dashboardData.overallHealthRiskIndex >= 30 ? "text-orange-600" : "text-green-600"}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboardData.overallHealthRiskIndex}</p>
                  <p className="text-xs text-muted-foreground">Health Risk Index</p>
                </div>
              </div>
              <Progress value={dashboardData.overallHealthRiskIndex} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-stat-outbreaks">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboardData.activeOutbreakForecasts}</p>
                  <p className="text-xs text-muted-foreground">Active Forecasts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-shortages">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
                  <Pill className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboardData.criticalShortages}</p>
                  <p className="text-xs text-muted-foreground">Critical Shortages</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-interventions">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{dashboardData.pendingInterventions}</p>
                  <p className="text-xs text-muted-foreground">Recommended Actions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {dashboardData && dashboardData.recentAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.recentAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-2 rounded-md ${
                    alert.severity === "critical" ? "bg-red-50 dark:bg-red-950/30" :
                    alert.severity === "warning" ? "bg-orange-50 dark:bg-orange-950/30" :
                    "bg-blue-50 dark:bg-blue-950/30"
                  }`}
                  data-testid={`alert-item-${idx}`}
                >
                  {alert.severity === "critical" ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : alert.severity === "warning" ? (
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-sm flex-1">{alert.message}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4" data-testid="tabs-forecasting">
          <TabsTrigger value="dashboard" data-testid="tab-outbreaks">
            <Activity className="w-4 h-4 mr-2" />
            Outbreak Forecasts
          </TabsTrigger>
          <TabsTrigger value="shortages" data-testid="tab-shortages">
            <Pill className="w-4 h-4 mr-2" />
            Medication Shortages
          </TabsTrigger>
          <TabsTrigger value="interventions" data-testid="tab-interventions">
            <Target className="w-4 h-4 mr-2" />
            Interventions
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <BarChart3 className="w-4 h-4 mr-2" />
            Trend Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {forecastsData?.forecasts?.map((forecast) => (
              <Card
                key={forecast.id}
                className="cursor-pointer hover-elevate"
                onClick={() => setSelectedForecast(forecast)}
                data-testid={`card-forecast-${forecast.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{forecast.diseaseName}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {forecast.region}
                      </CardDescription>
                    </div>
                    {getRiskBadge(forecast.riskLevel)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-2xl font-bold">{formatNumber(forecast.currentCases)}</p>
                      <p className="text-xs text-muted-foreground">Current Cases</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold flex items-center gap-1">
                        {formatNumber(forecast.predictedCases.week4)}
                        {forecast.predictedCases.week4 > forecast.currentCases ? (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">4-Week Forecast</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{(forecast.confidenceScore * 100).toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Confidence</p>
                    </div>
                  </div>

                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={[
                          { week: "Now", cases: forecast.currentCases },
                          { week: "W1", cases: forecast.predictedCases.week1 },
                          { week: "W2", cases: forecast.predictedCases.week2 },
                          { week: "W4", cases: forecast.predictedCases.week4 },
                          { week: "W8", cases: forecast.predictedCases.week8 },
                        ]}
                      >
                        <defs>
                          <linearGradient id={`gradient-${forecast.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={forecast.riskLevel === "critical" || forecast.riskLevel === "high" ? "#ef4444" : "#3b82f6"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={forecast.riskLevel === "critical" || forecast.riskLevel === "high" ? "#ef4444" : "#3b82f6"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                        <YAxis hide />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="cases"
                          stroke={forecast.riskLevel === "critical" || forecast.riskLevel === "high" ? "#ef4444" : "#3b82f6"}
                          fill={`url(#gradient-${forecast.id})`}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground mb-2">AI Insights:</p>
                    <ul className="text-xs space-y-1">
                      {forecast.aiInsights.slice(0, 2).map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <Brain className="w-3 h-3 mt-0.5 text-purple-500 shrink-0" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="shortages" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {shortagesData?.shortages?.map((shortage) => (
              <Card
                key={shortage.id}
                className={`cursor-pointer hover-elevate ${shortage.currentInventoryLevel === "critical" || shortage.currentInventoryLevel === "stockout" ? "border-red-500" : ""}`}
                onClick={() => setSelectedShortage(shortage)}
                data-testid={`card-shortage-${shortage.id}`}
              >
                <CardContent className="pt-4">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Pill className={`w-5 h-5 ${shortage.currentInventoryLevel === "critical" ? "text-red-500" : "text-orange-500"}`} />
                        <h3 className="font-medium">{shortage.medicationName}</h3>
                        {getInventoryBadge(shortage.currentInventoryLevel)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{shortage.therapeuticClass}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xl font-bold">{shortage.daysOfSupplyRemaining}</p>
                          <p className="text-xs text-muted-foreground">Days Supply Left</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{shortage.affectedFacilities}</p>
                          <p className="text-xs text-muted-foreground">Affected Facilities</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{(shortage.aiPrediction.riskScore * 100).toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">Risk Score</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold capitalize">{shortage.demandForecast.demandTrend}</p>
                          <p className="text-xs text-muted-foreground">Demand Trend</p>
                        </div>
                      </div>
                    </div>

                    <div className="lg:w-64">
                      <p className="text-xs text-muted-foreground mb-2">Affected Regions:</p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {shortage.affectedRegions.map((region, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{region}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">Next Shipment:</p>
                      <p className="text-sm">{new Date(shortage.supplyChainStatus.nextExpectedShipment).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Recommended Actions:</p>
                    <div className="flex flex-wrap gap-2">
                      {shortage.recommendedActions.slice(0, 3).map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">{action}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="interventions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>AI-Recommended Interventions</CardTitle>
                <CardDescription>Targeted public health actions based on predictive analysis</CardDescription>
              </div>
              <Button
                onClick={() => {
                  if (forecastsData?.forecasts?.[0]) {
                    generateInterventionMutation.mutate({
                      threatType: forecastsData.forecasts[0].diseaseName,
                      region: forecastsData.forecasts[0].region,
                      population: 500000,
                    });
                  }
                }}
                disabled={generateInterventionMutation.isPending}
                data-testid="button-generate-intervention"
              >
                <Cpu className="w-4 h-4 mr-2" />
                {generateInterventionMutation.isPending ? "Generating..." : "Generate AI Recommendation"}
              </Button>
            </CardHeader>
            <CardContent>
              {interventionsData?.interventions && interventionsData.interventions.length > 0 ? (
                <div className="space-y-4">
                  {interventionsData.interventions.map((intervention) => (
                    <Card
                      key={intervention.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedIntervention(intervention)}
                      data-testid={`card-intervention-${intervention.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-5 h-5 text-blue-500" />
                              <h4 className="font-medium">{intervention.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground">{intervention.description}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {getPriorityBadge(intervention.priority)}
                            <Badge variant="outline" className="capitalize">{intervention.interventionType.replace(/_/g, " ")}</Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-2 bg-green-50 dark:bg-green-950/30 rounded-md">
                            <p className="text-lg font-bold text-green-600">{formatNumber(intervention.expectedImpact.livesProtected)}</p>
                            <p className="text-xs text-muted-foreground">Lives Protected</p>
                          </div>
                          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                            <p className="text-lg font-bold text-blue-600">{formatNumber(intervention.expectedImpact.casesAverted)}</p>
                            <p className="text-xs text-muted-foreground">Cases Averted</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded-md">
                            <p className="text-lg font-bold text-purple-600">{formatCurrency(intervention.expectedImpact.costSavings)}</p>
                            <p className="text-xs text-muted-foreground">Cost Savings</p>
                          </div>
                          <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                            <p className="text-lg font-bold text-amber-600">{intervention.expectedImpact.roiPercentage}%</p>
                            <p className="text-xs text-muted-foreground">ROI</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">AI Confidence:</span>
                          <Progress value={intervention.aiConfidenceScore * 100} className="w-24 h-2" />
                          <span className="text-xs font-medium">{(intervention.aiConfidenceScore * 100).toFixed(0)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No intervention recommendations yet</p>
                  <p className="text-sm">Generate AI-powered recommendations based on current forecasts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {trendsData?.analyses && trendsData.analyses.length > 0 ? (
            trendsData.analyses.map((trend) => (
              <Card key={trend.id} data-testid={`card-trend-${trend.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{trend.title}</CardTitle>
                      <CardDescription>{trend.timeframe}</CardDescription>
                    </div>
                    <Badge
                      className={
                        trend.trendDirection === "worsening" ? "bg-red-500" :
                        trend.trendDirection === "improving" ? "bg-green-500" :
                        trend.trendDirection === "stable" ? "bg-blue-500" : ""
                      }
                    >
                      {trend.trendDirection === "worsening" && <TrendingUp className="w-3 h-3 mr-1" />}
                      {trend.trendDirection === "improving" && <TrendingDown className="w-3 h-3 mr-1" />}
                      {trend.trendDirection.charAt(0).toUpperCase() + trend.trendDirection.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend.dataPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.predicted) {
                              return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" strokeDasharray="3 3" />;
                            }
                            return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" />;
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        Key Findings
                      </h4>
                      <ul className="space-y-1">
                        {trend.keyFindings.map((finding, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                            {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-blue-500" />
                        Actionable Insights
                      </h4>
                      <ul className="space-y-1">
                        {trend.actionableInsights.map((insight, idx) => (
                          <li key={idx} className="text-sm flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-500" />
                      AI Interpretation
                    </h4>
                    <p className="text-sm text-muted-foreground">{trend.aiInterpretation}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No trend analyses available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedForecast} onOpenChange={() => setSelectedForecast(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              {selectedForecast?.diseaseName}
            </DialogTitle>
            <DialogDescription>{selectedForecast?.region}</DialogDescription>
          </DialogHeader>
          {selectedForecast && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getRiskBadge(selectedForecast.riskLevel)}
                <span className="text-sm">R₀ = {selectedForecast.transmissionRate}</span>
                <span className="text-sm">Confidence: {(selectedForecast.confidenceScore * 100).toFixed(0)}%</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Predicted Peak</p>
                  <p className="font-medium">{new Date(selectedForecast.predictedPeakDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Peak Cases</p>
                  <p className="font-medium">{formatNumber(selectedForecast.predictedPeakCases)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Seasonal Trends:</p>
                <p className="text-sm text-muted-foreground">{selectedForecast.seasonalTrends}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Contributing Factors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedForecast.contributingFactors.map((factor, idx) => (
                    <li key={idx} className="text-sm">{factor}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">AI Insights:</p>
                <ul className="space-y-2">
                  {selectedForecast.aiInsights.map((insight, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <Brain className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {selectedForecast.noCdsDisclaimer}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedShortage} onOpenChange={() => setSelectedShortage(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="w-5 h-5" />
              {selectedShortage?.medicationName}
            </DialogTitle>
            <DialogDescription>{selectedShortage?.therapeuticClass}</DialogDescription>
          </DialogHeader>
          {selectedShortage && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getInventoryBadge(selectedShortage.currentInventoryLevel)}
                <span className="text-sm">{selectedShortage.daysOfSupplyRemaining} days supply</span>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Supply Chain Status:</p>
                <p className="text-sm text-muted-foreground">{selectedShortage.supplyChainStatus.manufacturerStatus}</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">AI Prediction:</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Shortage Date</p>
                    <p>{selectedShortage.aiPrediction.predictedShortageDate ? new Date(selectedShortage.aiPrediction.predictedShortageDate).toLocaleDateString() : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recovery Date</p>
                    <p>{selectedShortage.aiPrediction.predictedRecoveryDate ? new Date(selectedShortage.aiPrediction.predictedRecoveryDate).toLocaleDateString() : "N/A"}</p>
                  </div>
                </div>
              </div>

              {selectedShortage.alternativeMedications.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Alternative Medications:</p>
                  <div className="space-y-2">
                    {selectedShortage.alternativeMedications.map((alt, idx) => (
                      <div key={idx} className="p-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{alt.name}</span>
                          <Badge variant="outline" className="text-xs">{alt.availability}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{alt.substitutionNotes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {selectedShortage.noCdsDisclaimer}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedIntervention} onOpenChange={() => setSelectedIntervention(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              {selectedIntervention?.title}
            </DialogTitle>
            <DialogDescription>{selectedIntervention?.description}</DialogDescription>
          </DialogHeader>
          {selectedIntervention && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getPriorityBadge(selectedIntervention.priority)}
                <Badge variant="outline" className="capitalize">{selectedIntervention.interventionType.replace(/_/g, " ")}</Badge>
                <span className="text-sm">Confidence: {(selectedIntervention.aiConfidenceScore * 100).toFixed(0)}%</span>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Target Population:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Age Groups: {selectedIntervention.targetPopulation.ageGroups.join(", ")}</div>
                  <div>Regions: {selectedIntervention.targetPopulation.regions.join(", ")}</div>
                  <div>Size: {formatNumber(selectedIntervention.targetPopulation.estimatedSize)}</div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Rationale:</p>
                <ul className="list-disc list-inside space-y-1">
                  {selectedIntervention.rationale.map((r, idx) => (
                    <li key={idx} className="text-sm">{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Implementation Steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  {selectedIntervention.implementationSteps.map((step, idx) => (
                    <li key={idx} className="text-sm">{step}</li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Resource Requirements:</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>Personnel: {selectedIntervention.resourceRequirements.personnel}</div>
                  <div>Budget: {formatCurrency(selectedIntervention.resourceRequirements.budget)}</div>
                  <div>Timeline: {selectedIntervention.resourceRequirements.timeframeDays} days</div>
                </div>
              </div>

              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {selectedIntervention.noCdsDisclaimer}
                </AlertDescription>
              </Alert>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
