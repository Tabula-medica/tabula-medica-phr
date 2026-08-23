import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Target,
  Brain,
  Sparkles,
  RefreshCw,
  Clock,
  Droplets,
  Scale,
  Footprints,
  Moon,
  Loader2,
  ChevronRight,
  Info,
  ShieldAlert,
  Zap,
} from "lucide-react";

interface HealthTrend {
  metric: string;
  direction: "improving" | "declining" | "stable" | "fluctuating";
  percentChange: number;
  period: string;
  dataPoints: Array<{ date: string; value: number }>;
  normalRange: { min: number; max: number };
  unit: string;
  description: string;
}

interface RiskIndicator {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  factors: string[];
  recommendations: string[];
  lastUpdated: string;
}

interface Anomaly {
  id: string;
  metric: string;
  detectedAt: string;
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  severity: "minor" | "moderate" | "severe";
  context: string;
  aiExplanation?: string;
}

interface ActionableInsight {
  id: string;
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actions: Array<{
    type: string;
    label: string;
    details: string;
  }>;
  relatedMetrics: string[];
  estimatedImpact: string;
}

interface DashboardData {
  overview: {
    healthScore: number;
    trendsImproving: number;
    trendsStable: number;
    activeRisks: number;
    anomaliesDetected: number;
    highPriorityItems: number;
  };
  latestVitals: Record<string, number>;
  trends: HealthTrend[];
  topInsights: ActionableInsight[];
  topRisks: RiskIndicator[];
  recentAnomalies: Anomaly[];
  lastUpdated: string;
  disclaimer: string;
}

const severityColors = {
  low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
};

const anomalySeverityColors = {
  minor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  moderate: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  severe: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const priorityColors = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  low: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const trendIcons = {
  improving: TrendingUp,
  declining: TrendingDown,
  stable: Minus,
  fluctuating: Activity,
};

const trendColors = {
  improving: "text-green-500",
  declining: "text-red-500",
  stable: "text-blue-500",
  fluctuating: "text-yellow-500",
};

const metricIcons: Record<string, typeof Heart> = {
  "Blood Pressure (Systolic)": Heart,
  "Blood Pressure (Diastolic)": Heart,
  "Heart Rate": Activity,
  "Blood Glucose": Droplets,
  "Weight": Scale,
  "Oxygen Saturation": Activity,
  "Daily Steps": Footprints,
  "Sleep Duration": Moon,
};

function HealthScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-muted/20"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray={`${(score / 100) * 352} 352`}
            strokeLinecap="round"
            className={getColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${getColor(score)}`}>{score}</span>
          <span className="text-xs text-muted-foreground">Health Score</span>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: HealthTrend }) {
  const data = trend.dataPoints.slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id={`gradient-${trend.metric}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 10 }} 
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          domain={[trend.normalRange.min * 0.9, trend.normalRange.max * 1.1]}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: "hsl(var(--popover))", 
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "hsl(var(--popover-foreground))" }}
        />
        <ReferenceLine y={trend.normalRange.min} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <ReferenceLine y={trend.normalRange.max} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          fill={`url(#gradient-${trend.metric})`}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function PatientHealthAnalyticsDashboard() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("90d");
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [selectedTrend, setSelectedTrend] = useState<HealthTrend | null>(null);
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);

  const { data: dashboardData, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/patient-analytics/dashboard", period],
    queryFn: async () => {
      const res = await fetch(`/api/patient-analytics/dashboard?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });

  const analyzeAnomalyMutation = useMutation({
    mutationFn: async (anomaly: Anomaly) => {
      const res = await apiRequest("POST", "/api/patient-analytics/analyze-anomaly", { anomaly });
      return res.json();
    },
    onSuccess: (data) => {
      if (selectedAnomaly) {
        setSelectedAnomaly({ ...selectedAnomaly, aiExplanation: data.aiExplanation });
      }
    },
    onError: () => {
      toast({
        title: "Unable to analyze",
        description: "Could not generate AI explanation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: aiSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["/api/patient-analytics/ai-summary"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/patient-analytics/ai-summary", {});
      return res.json();
    },
    enabled: aiSummaryOpen,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your health analytics...</p>
        </div>
      </div>
    );
  }

  const { overview, trends, topInsights, topRisks, recentAnomalies, latestVitals } = dashboardData || {
    overview: { healthScore: 0, trendsImproving: 0, trendsStable: 0, activeRisks: 0, anomaliesDetected: 0, highPriorityItems: 0 },
    trends: [],
    topInsights: [],
    topRisks: [],
    recentAnomalies: [],
    latestVitals: {},
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="patient-analytics-dashboard">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Your Health Analytics</h1>
          <p className="text-muted-foreground">Track your health trends and get personalized insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]" data-testid="select-period">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="60d">60 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setAiSummaryOpen(true)} data-testid="button-ai-summary">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Summary
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-500/5 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm">
          This dashboard is for educational purposes only and is NOT medical advice. Always consult your healthcare provider about your health.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1" data-testid="card-health-score">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Health Score</CardTitle>
            <CardDescription>Overall wellness indicator</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-4">
            <HealthScoreGauge score={overview.healthScore} />
          </CardContent>
          <CardFooter className="pt-0">
            <div className="w-full grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span>{overview.trendsImproving} improving</span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-blue-500" />
                <span>{overview.trendsStable} stable</span>
              </div>
            </div>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-3" data-testid="card-quick-stats">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Blood Pressure</span>
                </div>
                <p className="text-xl font-semibold">
                  {(latestVitals as Record<string, number>)["systolic"] || "--"}/{(latestVitals as Record<string, number>)["diastolic"] || "--"}
                </p>
                <p className="text-xs text-muted-foreground">mmHg</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-pink-500" />
                  <span className="text-sm text-muted-foreground">Heart Rate</span>
                </div>
                <p className="text-xl font-semibold">{(latestVitals as Record<string, number>)["heartRate"] || "--"}</p>
                <p className="text-xs text-muted-foreground">bpm</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Blood Glucose</span>
                </div>
                <p className="text-xl font-semibold">{(latestVitals as Record<string, number>)["bloodGlucose"] || "--"}</p>
                <p className="text-xs text-muted-foreground">mg/dL</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Footprints className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Daily Steps</span>
                </div>
                <p className="text-xl font-semibold">{(latestVitals as Record<string, number>)["steps"]?.toLocaleString() || "--"}</p>
                <p className="text-xs text-muted-foreground">today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends" data-testid="tab-trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Lightbulb className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Risk Factors
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertCircle className="h-4 w-4 mr-2" />
            Anomalies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.map((trend) => {
              const TrendIcon = trendIcons[trend.direction];
              const MetricIcon = metricIcons[trend.metric] || Activity;
              
              return (
                <Card 
                  key={trend.metric} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedTrend(trend)}
                  data-testid={`card-trend-${trend.metric.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MetricIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-medium">{trend.metric}</CardTitle>
                      </div>
                      <Badge variant="outline" className={trendColors[trend.direction]}>
                        <TrendIcon className="h-3 w-3 mr-1" />
                        {trend.direction}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">{trend.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <TrendChart trend={trend} />
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>Normal: {trend.normalRange.min}-{trend.normalRange.max} {trend.unit}</span>
                      <span className={trendColors[trend.direction]}>
                        {trend.percentChange > 0 ? "+" : ""}{trend.percentChange}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topInsights.map((insight) => (
              <Card key={insight.id} data-testid={`card-insight-${insight.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {insight.priority === "high" ? (
                        <Zap className="h-4 w-4 text-orange-500" />
                      ) : insight.category.includes("Positive") ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                      )}
                      <CardTitle className="text-base">{insight.title}</CardTitle>
                    </div>
                    <Badge className={priorityColors[insight.priority]}>
                      {insight.priority}
                    </Badge>
                  </div>
                  <CardDescription>{insight.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {insight.actions.slice(0, 3).map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">{action.label}</span>
                          <span className="text-muted-foreground"> - {action.details}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground">{insight.estimatedImpact}</p>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          {topRisks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">No High-Priority Risks</h3>
                <p className="text-muted-foreground">Your health data shows no significant risk factors at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {topRisks.map((risk) => (
                <Card key={risk.id} className={`border-l-4 ${severityColors[risk.severity]}`} data-testid={`card-risk-${risk.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <div>
                          <CardTitle className="text-base">{risk.title}</CardTitle>
                          <CardDescription className="text-xs">{risk.category}</CardDescription>
                        </div>
                      </div>
                      <Badge className={severityColors[risk.severity]}>
                        {risk.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{risk.description}</p>
                    
                    <div>
                      <p className="text-sm font-medium mb-1">Contributing Factors:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {risk.factors.map((factor, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <p className="text-sm font-medium mb-1">Suggestions:</p>
                      <ul className="text-sm space-y-1">
                        {risk.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
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

        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">AI-Powered Anomaly Detection</CardTitle>
              </div>
              <CardDescription>
                Unusual readings detected in your health data. Click on any anomaly to get an AI-powered explanation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentAnomalies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">All Readings Normal</h3>
                  <p className="text-muted-foreground">No anomalies detected in your recent health data.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {recentAnomalies.map((anomaly) => (
                      <div
                        key={anomaly.id}
                        className="p-3 border rounded-lg cursor-pointer hover-elevate"
                        {...clickable(() => {
                          setSelectedAnomaly(anomaly);
                          if (!anomaly.aiExplanation) {
                            analyzeAnomalyMutation.mutate(anomaly);
                          }
                        })}
                        data-testid={`anomaly-${anomaly.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className={`h-4 w-4 ${anomaly.severity === "severe" ? "text-red-500" : anomaly.severity === "moderate" ? "text-yellow-500" : "text-blue-500"}`} />
                            <span className="font-medium">{anomaly.metric}</span>
                          </div>
                          <Badge className={anomalySeverityColors[anomaly.severity]}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Value: </span>
                            <span className="font-medium">{anomaly.value}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expected: </span>
                            <span>{anomaly.expectedRange.min}-{anomaly.expectedRange.max}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date: </span>
                            <span>{new Date(anomaly.detectedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                          <Sparkles className="h-3 w-3" />
                          Click for AI explanation
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedAnomaly} onOpenChange={() => setSelectedAnomaly(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Analysis: {selectedAnomaly?.metric}
            </DialogTitle>
            <DialogDescription>
              Understanding your {selectedAnomaly?.metric?.toLowerCase()} reading
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Your Reading</p>
                <p className="text-xl font-semibold">{selectedAnomaly?.value}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected Range</p>
                <p className="text-xl font-semibold">
                  {selectedAnomaly?.expectedRange.min} - {selectedAnomaly?.expectedRange.max}
                </p>
              </div>
            </div>
            
            {analyzeAnomalyMutation.isPending ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Generating AI explanation...</span>
              </div>
            ) : selectedAnomaly?.aiExplanation ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm">{selectedAnomaly.aiExplanation}</div>
              </div>
            ) : (
              <Button onClick={() => selectedAnomaly && analyzeAnomalyMutation.mutate(selectedAnomaly)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Explanation
              </Button>
            )}
            
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                This is educational information only. It is NOT medical advice. Always consult your healthcare provider.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={aiSummaryOpen} onOpenChange={setAiSummaryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Your Personalized Health Summary
            </DialogTitle>
            <DialogDescription>
              AI-generated overview of your health trends and insights
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Creating your personalized summary...</span>
              </div>
            ) : aiSummary?.summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{aiSummary.summary}</div>
              </div>
            ) : (
              <p className="text-muted-foreground">Unable to generate summary. Please try again.</p>
            )}
          </ScrollArea>
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {aiSummary?.disclaimer || "This summary is for educational purposes only and is NOT medical advice."}
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTrend} onOpenChange={() => setSelectedTrend(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTrend?.metric} Details</DialogTitle>
            <DialogDescription>{selectedTrend?.description}</DialogDescription>
          </DialogHeader>
          {selectedTrend && (
            <div className="space-y-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedTrend.dataPoints.map(d => ({
                    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    value: d.value,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis 
                      domain={[selectedTrend.normalRange.min * 0.9, selectedTrend.normalRange.max * 1.1]}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Legend />
                    <ReferenceLine y={selectedTrend.normalRange.min} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label="Min" />
                    <ReferenceLine y={selectedTrend.normalRange.max} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label="Max" />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 3 }}
                      name={selectedTrend.metric}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Direction</p>
                  <p className={`font-semibold ${trendColors[selectedTrend.direction]}`}>
                    {selectedTrend.direction}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Change</p>
                  <p className="font-semibold">
                    {selectedTrend.percentChange > 0 ? "+" : ""}{selectedTrend.percentChange}%
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Normal Range</p>
                  <p className="font-semibold">
                    {selectedTrend.normalRange.min}-{selectedTrend.normalRange.max} {selectedTrend.unit}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
