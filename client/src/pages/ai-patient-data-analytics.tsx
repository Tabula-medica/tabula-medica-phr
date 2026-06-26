import { useState } from "react";
import { useActiveProfile } from "@/contexts/profile-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Brain,
  BarChart3,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Stethoscope,
  Pill,
  Info,
  Shield,
  Sparkles,
  ChevronRight,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Calendar,
  Clipboard,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ConditionTrend {
  id: string;
  conditionCode: string;
  conditionName: string;
  patientId: string;
  trendDirection: "improving" | "stable" | "declining" | "fluctuating";
  trendStrength: "strong" | "moderate" | "weak";
  dataPoints: { date: string; value: number }[];
  statistics: {
    startValue: number;
    currentValue: number;
    percentChange: number;
    averageValue: number;
    volatility: number;
  };
  timeRange: { start: string; end: string; durationMonths: number };
  relatedFactors: { factor: string; correlation: string; strength: number; description: string }[];
  insights: string[];
  generatedAt: string;
}

interface HealthRiskPrediction {
  id: string;
  patientId: string;
  riskType: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  confidence: number;
  timeframe: string;
  contributingFactors: {
    factor: string;
    category: string;
    impact: string;
    contribution: number;
    evidence: string;
    modifiable: boolean;
  }[];
  protectiveFactors: { factor: string; impact: string; description: string }[];
  historicalContext: {
    previousRiskScore: number;
    previousAssessmentDate: string;
    trend: string;
  };
  recommendations: {
    recommendation: string;
    priority: string;
    category: string;
    rationale: string;
  }[];
  disclaimer: string;
}

interface PersonalizedHealthReport {
  id: string;
  patientId: string;
  reportType: string;
  generatedAt: string;
  summary: {
    overallHealthStatus: string;
    keyHighlights: string[];
    areasOfConcern: string[];
    improvements: string[];
  };
  sections: { title: string; content: string; importance: string }[];
  conditionsSummary: {
    conditionName: string;
    status: string;
    trend: string;
    keyMetrics: { name: string; value: string; trend: string }[];
  }[];
  medicationsSummary: {
    medicationName: string;
    dosage: string;
    frequency: string;
    adherenceEstimate: number;
    purpose: string;
  }[];
  vitalsTrends: {
    vitalType: string;
    currentValue: number;
    unit: string;
    normalRange: { min: number; max: number };
    trend: string;
    history: { date: string; value: number }[];
  }[];
  labTrends: {
    labTest: string;
    currentValue: number;
    unit: string;
    referenceRange: string;
    status: string;
    trend: string;
  }[];
  recommendations: {
    recommendation: string;
    category: string;
    priority: string;
    basedOn: string;
    timeframe: string;
  }[];
  nextSteps: { action: string; dueDate?: string; importance: string }[];
  disclaimer: string;
}

interface DashboardData {
  patientId: string;
  lastUpdated: string;
  overallHealthScore: number;
  conditionTrends: ConditionTrend[];
  riskPredictions: HealthRiskPrediction[];
  recentChanges: { date: string; category: string; description: string; significance: string }[];
  upcomingActions: { action: string; dueDate?: string; importance: string }[];
  dataCompleteness: number;
  disclaimer: string;
}

const trendIcons = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
  fluctuating: Activity,
};

const trendColors = {
  improving: "text-green-500",
  stable: "text-blue-500",
  declining: "text-red-500",
  fluctuating: "text-orange-500",
};

const riskLevelColors = {
  low: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function useActiveProfile() {
  const { data } = useQuery<{ profile: { id: string } }>({
    queryKey: ["/api/profiles/active"],
  });
  return data?.profile?.id || "patient-default";
}

function NoCdsDisclaimer({ disclaimer }: { disclaimer?: string }) {
  if (!disclaimer) return null;
  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5 mb-6" data-testid="card-no-cds-disclaimer">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-700 dark:text-yellow-400">Informational Only</p>
            <p className="text-sm text-muted-foreground mt-1">{disclaimer}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthScoreGauge({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-blue-500";
    if (s >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    if (s >= 40) return "Fair";
    return "Needs Attention";
  };

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted/20"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            className={getScoreColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <p className={`mt-2 font-semibold ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
    </div>
  );
}

function ConditionTrendsSection({ patientId }: { patientId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ trends: ConditionTrend[]; disclaimer: string }>({
    queryKey: [`/api/patient-data-analytics/condition-trends/${patientId}`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  const trends = data?.trends || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Condition Trends Analysis
          </h3>
          <p className="text-sm text-muted-foreground">AI-powered analysis of your health condition patterns</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-trends">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <NoCdsDisclaimer disclaimer={data?.disclaimer} />

      {trends.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No condition trends available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {trends.map((trend) => {
            const TrendIcon = trendIcons[trend.trendDirection] || Minus;
            return (
              <Card key={trend.id} className="hover-elevate" data-testid={`card-trend-${trend.conditionCode}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        {trend.conditionName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <TrendIcon className={`h-4 w-4 ${trendColors[trend.trendDirection]}`} />
                        <span className="capitalize">{trend.trendDirection}</span>
                        <Badge variant="outline" className="text-xs ml-2">
                          {trend.trendStrength} trend
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{trend.statistics.currentValue}</p>
                      <p className={`text-xs flex items-center gap-1 ${trend.statistics.percentChange < 0 ? "text-green-500" : trend.statistics.percentChange > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {trend.statistics.percentChange < 0 ? (
                          <ArrowDownRight className="h-3 w-3" />
                        ) : trend.statistics.percentChange > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : null}
                        {Math.abs(trend.statistics.percentChange).toFixed(1)}% change
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trend.dataPoints}>
                        <defs>
                          <linearGradient id={`gradient-${trend.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(date) => new Date(date).toLocaleDateString("en-US", { month: "short" })}
                        />
                        <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 5", "dataMax + 5"]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                          labelFormatter={(date) => new Date(date).toLocaleDateString()}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          fill={`url(#gradient-${trend.id})`}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {trend.insights.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        AI Insights
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {trend.insights.slice(0, 3).map((insight, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {trend.relatedFactors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {trend.relatedFactors.slice(0, 3).map((factor, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {factor.factor}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RiskPredictionsSection({ patientId }: { patientId: string }) {
  const [selectedRisk, setSelectedRisk] = useState<HealthRiskPrediction | null>(null);
  const { data, isLoading, refetch, isFetching } = useQuery<{ predictions: HealthRiskPrediction[]; disclaimer: string }>({
    queryKey: [`/api/patient-data-analytics/risk-predictions/${patientId}`],
  });

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  const predictions = data?.predictions || [];

  const radarData = predictions.map((p) => ({
    risk: p.riskType.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    score: p.riskScore,
    fullMark: 100,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-500" />
            Predictive Health Risk Analysis
          </h3>
          <p className="text-sm text-muted-foreground">AI-powered risk predictions based on your FHIR health records</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-risks">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <NoCdsDisclaimer disclaimer={data?.disclaimer} />

      {predictions.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Risk Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="risk" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar
                    name="Risk Score"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {predictions.map((prediction) => (
          <Card
            key={prediction.id}
            className="hover-elevate cursor-pointer"
            onClick={() => setSelectedRisk(prediction)}
            data-testid={`card-risk-${prediction.riskType}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm capitalize">
                  {prediction.riskType.replace("_", " ")} Risk
                </CardTitle>
                <Badge className={riskLevelColors[prediction.riskLevel]}>{prediction.riskLevel}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold">{prediction.riskScore}%</span>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Confidence: {prediction.confidence}%</p>
                    <p>{prediction.timeframe}</p>
                  </div>
                </div>
                <Progress value={prediction.riskScore} className="h-2" />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {prediction.historicalContext.trend === "decreasing" ? (
                    <TrendingDown className="h-3 w-3 text-green-500" />
                  ) : prediction.historicalContext.trend === "increasing" ? (
                    <TrendingUp className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  <span>
                    {prediction.historicalContext.trend === "decreasing"
                      ? "Improving"
                      : prediction.historicalContext.trend === "increasing"
                        ? "Increasing"
                        : "Stable"}{" "}
                    from {prediction.historicalContext.previousRiskScore}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedRisk} onOpenChange={() => setSelectedRisk(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedRisk && (
            <>
              <DialogHeader>
                <DialogTitle className="capitalize flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {selectedRisk.riskType.replace("_", " ")} Risk Details
                </DialogTitle>
                <DialogDescription>
                  Detailed analysis and recommendations based on your health data
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Score</p>
                    <p className="text-3xl font-bold">{selectedRisk.riskScore}%</p>
                  </div>
                  <Badge className={`${riskLevelColors[selectedRisk.riskLevel]} text-lg px-4 py-2`}>
                    {selectedRisk.riskLevel}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Contributing Factors
                  </h4>
                  <div className="space-y-3">
                    {selectedRisk.contributingFactors.map((factor, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{factor.factor}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {factor.category}
                            </Badge>
                            {factor.modifiable && (
                              <Badge variant="secondary" className="text-xs">
                                Modifiable
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Progress value={factor.contribution} className="h-2 mb-2" />
                        <p className="text-xs text-muted-foreground">{factor.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Protective Factors
                  </h4>
                  <div className="space-y-2">
                    {selectedRisk.protectiveFactors.map((factor, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <Shield className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{factor.factor}</p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-500" />
                    Recommendations
                  </h4>
                  <div className="space-y-2">
                    {selectedRisk.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={rec.priority === "immediate" ? "destructive" : "secondary"} className="text-xs capitalize">
                            {rec.priority.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {rec.category}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium">{rec.recommendation}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  {selectedRisk.disclaimer}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonalizedReportSection({ patientId }: { patientId: string }) {
  const [reportType, setReportType] = useState<string>("comprehensive");
  const { data, isLoading, refetch, isFetching } = useQuery<{ report: PersonalizedHealthReport }>({
    queryKey: [`/api/patient-data-analytics/health-report/${patientId}`, reportType],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-data-analytics/generate-report", {
        patientId,
        reportType,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patient-data-analytics/health-report/${patientId}`] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const report = data?.report;

  const statusColors = {
    excellent: "text-green-500 bg-green-50 dark:bg-green-950/30",
    good: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    fair: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
    needs_attention: "text-red-500 bg-red-50 dark:bg-red-950/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Personalized Health Report
          </h3>
          <p className="text-sm text-muted-foreground">AI-generated summary of your health data and findings</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-40" data-testid="select-report-type">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comprehensive">Comprehensive</SelectItem>
              <SelectItem value="condition_focused">Condition Focused</SelectItem>
              <SelectItem value="trend_summary">Trend Summary</SelectItem>
              <SelectItem value="risk_assessment">Risk Assessment</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-report"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Generate
          </Button>
        </div>
      </div>

      {report && (
        <>
          <Card className={statusColors[report.summary.overallHealthStatus as keyof typeof statusColors] || ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center">
                    <Heart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Health Status</p>
                    <p className="text-2xl font-bold capitalize">{report.summary.overallHealthStatus.replace("_", " ")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Generated</p>
                  <p className="text-sm">{new Date(report.generatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Key Highlights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.summary.keyHighlights.map((highlight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Areas of Concern
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.summary.areasOfConcern.map((concern, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                      {concern}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Improvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.summary.improvements.map((improvement, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowUpRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {improvement}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Conditions Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {report.conditionsSummary.map((condition, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{condition.conditionName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {condition.status}
                        </Badge>
                        <span className={`text-xs flex items-center gap-1 ${condition.trend === "improving" ? "text-green-500" : condition.trend === "worsening" ? "text-red-500" : "text-muted-foreground"}`}>
                          {condition.trend === "improving" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : condition.trend === "worsening" ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {condition.trend}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {condition.keyMetrics.slice(0, 2).map((metric, j) => (
                        <Badge key={j} variant="secondary" className="text-xs">
                          {metric.name}: {metric.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-500" />
                Medications Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {report.medicationsSummary.map((med, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-sm">{med.medicationName}</p>
                      <Badge variant="outline" className="text-xs">
                        {med.adherenceEstimate}% adherence
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {med.dosage} • {med.frequency}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{med.purpose}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-5 w-5 text-green-500" />
                Recommendations & Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={rec.priority === "high" ? "destructive" : "secondary"} className="text-xs capitalize">
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {rec.category}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{rec.recommendation}</p>
                    <p className="text-xs text-muted-foreground mt-1">Based on: {rec.basedOn}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Upcoming Actions
                </h4>
                <div className="space-y-2">
                  {report.nextSteps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clipboard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{step.action}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(step.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <Badge variant={step.importance === "urgent" ? "destructive" : "outline"} className="text-xs capitalize">
                          {step.importance}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {report.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardOverview({ patientId }: { patientId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: [`/api/patient-data-analytics/dashboard/${patientId}`],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const dashboard = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Analytics Dashboard
          </h3>
          <p className="text-sm text-muted-foreground">
            Overview of your health analytics and insights
            {dashboard?.lastUpdated && (
              <span className="ml-2">• Updated {new Date(dashboard.lastUpdated).toLocaleString()}</span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-dashboard">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <NoCdsDisclaimer disclaimer={dashboard?.disclaimer} />

      {dashboard && (
        <>
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <HealthScoreGauge score={dashboard.overallHealthScore} />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conditions Tracked</p>
                    <p className="text-2xl font-bold">{dashboard.conditionTrends.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk Factors Analyzed</p>
                    <p className="text-2xl font-bold">{dashboard.riskPredictions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data Completeness</p>
                    <p className="text-2xl font-bold">{dashboard.dataCompleteness}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {dashboard.recentChanges.map((change, i) => (
                      <div key={i} className="flex items-start gap-3 p-2 border-b last:border-0">
                        <div className={`h-2 w-2 rounded-full mt-2 ${change.significance === "major" ? "bg-primary" : "bg-muted"}`} />
                        <div>
                          <p className="text-sm font-medium">{change.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {change.category}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(change.date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-500" />
                  Upcoming Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {dashboard.upcomingActions.map((action, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{action.action}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {action.dueDate && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(action.dueDate).toLocaleDateString()}
                            </span>
                          )}
                          <Badge
                            variant={action.importance === "urgent" ? "destructive" : "outline"}
                            className="text-xs capitalize"
                          >
                            {action.importance}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function AIPatientDataAnalytics() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const patientId = useActiveProfile();

  return (
    <div className="p-6 space-y-6" data-testid="page-ai-patient-data-analytics">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-6 w-6 text-purple-500" />
            AI Patient Data Analytics
          </h1>
          <p className="text-lg text-muted-foreground">
            AI-powered health trend analysis, risk predictions, and personalized reports
          </p>
        </div>
      </div>

      <Card className="border-yellow-500/20 bg-yellow-500/5" data-testid="card-global-no-cds-disclaimer">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">NO Clinical Decision Support - Informational Only</p>
              <p className="text-sm text-muted-foreground mt-1">
                All analytics, predictions, and recommendations on this page are for PATIENT EDUCATION and AWARENESS purposes only. 
                This information does NOT constitute medical advice, diagnosis, or treatment recommendations. 
                Always consult with your healthcare provider for clinical decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Condition Trends
          </TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">
            <Shield className="h-4 w-4 mr-2" />
            Risk Predictions
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Health Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardOverview patientId={patientId} />
        </TabsContent>

        <TabsContent value="trends">
          <ConditionTrendsSection patientId={patientId} />
        </TabsContent>

        <TabsContent value="risks">
          <RiskPredictionsSection patientId={patientId} />
        </TabsContent>

        <TabsContent value="reports">
          <PersonalizedReportSection patientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
