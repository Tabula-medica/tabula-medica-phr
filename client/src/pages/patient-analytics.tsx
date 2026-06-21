import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Heart,
  Lightbulb,
  Pill,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
  ScatterChart,
  Scatter,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MetricCard, ErrorState } from "@/components/shared";

interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

interface TrendAnalysis {
  metric: string;
  metricType: "vital" | "lab" | "adherence";
  displayName: string;
  unit: string;
  currentValue: number;
  previousValue?: number;
  changePercent: number;
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  trendDirection: "up" | "down" | "flat";
  isPositiveTrend: boolean;
  normalRange?: { min: number; max: number };
  withinNormalRange: boolean;
  dataPoints: TimeSeriesDataPoint[];
  aiInsight?: string;
}

interface Correlation {
  id: string;
  metric1: { name: string; displayName: string; type: string };
  metric2: { name: string; displayName: string; type: string };
  correlationType: "positive" | "negative" | "none";
  strength: number;
  confidence: number;
  description: string;
  clinicalImplication: string;
  recommendation?: string;
  dataPoints?: { x: number; y: number; date: string }[];
}

interface Anomaly {
  id: string;
  patientId: string;
  metric: string;
  metricDisplayName: string;
  detectedAt: string;
  severity: "low" | "medium" | "high" | "critical";
  type: "spike" | "drop" | "pattern_break" | "threshold_breach" | "trend_deviation";
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  description: string;
  possibleCauses: string[];
  recommendedActions: string[];
  acknowledged: boolean;
}

interface AdherenceMetric {
  medicationId: string;
  medicationName: string;
  adherenceRate: number;
  missedDoses: number;
  totalDoses: number;
  streak: number;
  trend: "improving" | "declining" | "stable";
  dataPoints: TimeSeriesDataPoint[];
}

interface PatientAnalyticsDashboard {
  patientId: string;
  patientName: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  overallHealthScore: number;
  healthScoreTrend: "improving" | "declining" | "stable";
  vitalTrends: TrendAnalysis[];
  labTrends: TrendAnalysis[];
  adherenceMetrics: AdherenceMetric[];
  correlations: Correlation[];
  anomalies: Anomaly[];
  aiSummary: string;
  keyInsights: string[];
  riskFactors: string[];
  recommendations: string[];
  aiConfidence: number;
}

const trendColors = {
  improving: "text-green-600 dark:text-green-400",
  worsening: "text-red-600 dark:text-red-400",
  stable: "text-blue-600 dark:text-blue-400",
  fluctuating: "text-orange-600 dark:text-orange-400",
  declining: "text-red-600 dark:text-red-400",
};

const severityColors = {
  low: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  medium: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  high: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  critical: "bg-red-600 text-white",
};

const correlationColors = {
  positive: "#10b981",
  negative: "#ef4444",
  none: "#64748b",
};

function HealthScoreCard({ score, trend }: { score: number; trend: string }) {
  const getScoreColor = () => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = () => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10" data-testid="health-score-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg" data-testid="title-health-score">
          <Heart className="h-5 w-5 text-primary" />
          Overall Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-4">
          <span className={`text-5xl font-bold ${getScoreColor()}`} data-testid="health-score-value">
            {score}
          </span>
          <div className="flex items-center gap-1 mb-2" data-testid="health-score-trend">
            {trend === "improving" && <TrendingUp className="h-4 w-4 text-green-500" />}
            {trend === "declining" && <TrendingDown className="h-4 w-4 text-red-500" />}
            {trend === "stable" && <ArrowRight className="h-4 w-4 text-blue-500" />}
            <span className={`text-sm ${trendColors[trend as keyof typeof trendColors]}`} data-testid="health-score-trend-label">
              {trend}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <Progress value={score} className={`h-2 ${getProgressColor()}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function TrendCard({ trend }: { trend: TrendAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  const chartData = trend.dataPoints
    .slice()
    .reverse()
    .map((p) => ({
      date: format(new Date(p.date), "MMM d"),
      value: p.value,
      isAnomaly: p.isAnomaly,
    }));

  return (
    <Card className="hover-elevate" data-testid={`trend-card-${trend.metric}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium" data-testid={`text-trend-name-${trend.metric}`}>{trend.displayName}</CardTitle>
          <Badge
            variant="outline"
            className={trend.withinNormalRange ? "border-green-500/50 text-green-600" : "border-red-500/50 text-red-600"}
            data-testid={`badge-trend-status-${trend.metric}`}
          >
            {trend.withinNormalRange ? "Normal" : "Abnormal"}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground" data-testid={`text-trend-value-${trend.metric}`}>
            {trend.currentValue} {trend.unit}
          </span>
          <span className={`flex items-center gap-1 text-sm ${trendColors[trend.trend]}`} data-testid={`text-trend-change-${trend.metric}`}>
            {trend.trendDirection === "up" && <ArrowUp className="h-3 w-3" />}
            {trend.trendDirection === "down" && <ArrowDown className="h-3 w-3" />}
            {Math.abs(trend.changePercent).toFixed(1)}%
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${trend.metric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={trend.withinNormalRange ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={trend.withinNormalRange ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trend.withinNormalRange ? "#10b981" : "#ef4444"}
                  fill={`url(#gradient-${trend.metric})`}
                  strokeWidth={2}
                />
                {trend.normalRange && (
                  <>
                    <ReferenceLine y={trend.normalRange.min} stroke="#94a3b8" strokeDasharray="3 3" />
                    <ReferenceLine y={trend.normalRange.max} stroke="#94a3b8" strokeDasharray="3 3" />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-2" data-testid={`expand-trend-${trend.metric}`}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Show less" : "View details"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={trend.withinNormalRange ? "#10b981" : "#ef4444"}
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (payload.isAnomaly) {
                        return <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />;
                      }
                      return <circle cx={cx} cy={cy} r={3} fill={trend.withinNormalRange ? "#10b981" : "#ef4444"} />;
                    }}
                  />
                  {trend.normalRange && (
                    <>
                      <ReferenceLine y={trend.normalRange.min} stroke="#94a3b8" strokeDasharray="3 3" label="Min" />
                      <ReferenceLine y={trend.normalRange.max} stroke="#94a3b8" strokeDasharray="3 3" label="Max" />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {trend.normalRange && (
              <div className="mt-2 text-xs text-muted-foreground text-center" data-testid={`text-trend-range-${trend.metric}`}>
                Normal range: {trend.normalRange.min} - {trend.normalRange.max} {trend.unit}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function CorrelationCard({ correlation }: { correlation: Correlation }) {
  const [showChart, setShowChart] = useState(false);

  return (
    <Card className="hover-elevate" data-testid={`correlation-${correlation.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Badge variant="outline" data-testid={`badge-metric1-${correlation.id}`}>{correlation.metric1.displayName}</Badge>
            <ArrowRight className="h-4 w-4" />
            <Badge variant="outline" data-testid={`badge-metric2-${correlation.id}`}>{correlation.metric2.displayName}</Badge>
          </CardTitle>
          <Badge
            className={
              correlation.correlationType === "positive"
                ? "bg-green-500/10 text-green-700"
                : correlation.correlationType === "negative"
                ? "bg-red-500/10 text-red-700"
                : "bg-slate-500/10"
            }
            data-testid={`badge-correlation-type-${correlation.id}`}
          >
            {correlation.correlationType} ({(correlation.strength * 100).toFixed(0)}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-2" data-testid={`text-correlation-desc-${correlation.id}`}>{correlation.description}</p>
        <div className="bg-muted/30 p-3 rounded-md">
          <p className="text-sm" data-testid={`text-correlation-implication-${correlation.id}`}>
            <strong>Clinical Implication:</strong> {correlation.clinicalImplication}
          </p>
          {correlation.recommendation && (
            <p className="text-sm mt-1" data-testid={`text-correlation-rec-${correlation.id}`}>
              <strong>Recommendation:</strong> {correlation.recommendation}
            </p>
          )}
        </div>
        {correlation.dataPoints && correlation.dataPoints.length > 0 && (
          <Collapsible open={showChart} onOpenChange={setShowChart}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full mt-2" data-testid={`button-toggle-scatter-${correlation.id}`}>
                {showChart ? "Hide" : "Show"} Scatter Plot
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="x" name={correlation.metric1.displayName} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="y" name={correlation.metric2.displayName} tick={{ fontSize: 10 }} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Scatter
                      data={correlation.dataPoints}
                      fill={correlationColors[correlation.correlationType]}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  return (
    <Card className={anomaly.severity === "high" || anomaly.severity === "critical" ? "bg-red-500/5" : "bg-orange-500/5"} data-testid={`anomaly-${anomaly.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${anomaly.severity === "high" || anomaly.severity === "critical" ? "text-red-500" : "text-orange-500"}`} />
            <span className="font-medium" data-testid={`text-anomaly-metric-${anomaly.id}`}>{anomaly.metricDisplayName}</span>
          </div>
          <Badge className={severityColors[anomaly.severity]} data-testid={`badge-severity-${anomaly.id}`}>{anomaly.severity}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-2" data-testid={`text-anomaly-date-${anomaly.id}`}>
          {anomaly.type.replace("_", " ")} detected on {format(new Date(anomaly.detectedAt), "MMM d, yyyy")}
        </p>
        <div className="flex items-center gap-4 text-sm mb-2 flex-wrap">
          <span data-testid={`text-anomaly-value-${anomaly.id}`}>
            <strong>Value:</strong> {anomaly.value}
          </span>
          <span data-testid={`text-anomaly-expected-${anomaly.id}`}>
            <strong>Expected:</strong> {anomaly.expectedRange.min} - {anomaly.expectedRange.max}
          </span>
          <span className="text-red-600 dark:text-red-400" data-testid={`text-anomaly-deviation-${anomaly.id}`}>
            <strong>Deviation:</strong> {anomaly.deviation}%
          </span>
        </div>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full" data-testid={`button-anomaly-details-${anomaly.id}`}>
              View Details
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2 text-sm" data-testid={`anomaly-details-content-${anomaly.id}`}>
              <div>
                <strong data-testid={`label-causes-${anomaly.id}`}>Possible Causes:</strong>
                <ul className="list-disc list-inside ml-2 text-muted-foreground" data-testid={`list-causes-${anomaly.id}`}>
                  {anomaly.possibleCauses.map((cause, i) => (
                    <li key={i} data-testid={`cause-${anomaly.id}-${i}`}>{cause}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong data-testid={`label-actions-${anomaly.id}`}>Recommended Actions:</strong>
                <ul className="list-disc list-inside ml-2 text-muted-foreground" data-testid={`list-actions-${anomaly.id}`}>
                  {anomaly.recommendedActions.map((action, i) => (
                    <li key={i} data-testid={`action-${anomaly.id}-${i}`}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function AdherenceCard({ metrics }: { metrics: AdherenceMetric[] }) {
  const avgAdherence = metrics.length > 0 
    ? Math.round(metrics.reduce((sum, m) => sum + m.adherenceRate, 0) / metrics.length)
    : 0;

  const chartData = metrics.map((m) => ({
    name: m.medicationName.split(" ")[0],
    adherence: m.adherenceRate,
    trend: m.trend,
  }));

  return (
    <Card data-testid="adherence-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="title-medication-adherence">
          <Pill className="h-5 w-5" />
          Medication Adherence
        </CardTitle>
        <CardDescription data-testid="text-adherence-summary">
          Average adherence: <span className="font-bold text-foreground" data-testid="text-adherence-avg">{avgAdherence}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
              />
              <Bar dataKey="adherence" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.adherence >= 80 ? "#10b981" : entry.adherence >= 60 ? "#f59e0b" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {metrics.map((m) => (
            <div key={m.medicationId} className="flex items-center justify-between text-sm" data-testid={`adherence-metric-${m.medicationId}`}>
              <span className="font-medium truncate max-w-[180px]" data-testid={`text-med-name-${m.medicationId}`}>{m.medicationName}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={
                  m.adherenceRate >= 80 ? "border-green-500/50 text-green-600" :
                  m.adherenceRate >= 60 ? "border-yellow-500/50 text-yellow-600" :
                  "border-red-500/50 text-red-600"
                } data-testid={`badge-adherence-rate-${m.medicationId}`}>
                  {m.adherenceRate}%
                </Badge>
                <span className={`text-xs ${trendColors[m.trend]}`} data-testid={`icon-adherence-trend-${m.medicationId}`}>
                  {m.trend === "improving" && <TrendingUp className="h-3 w-3" />}
                  {m.trend === "declining" && <TrendingDown className="h-3 w-3" />}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsightsPanel({ dashboard }: { dashboard: PatientAnalyticsDashboard }) {
  return (
    <Card className="bg-gradient-to-br from-violet-500/5 to-indigo-500/10" data-testid="ai-insights-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="title-ai-insights">
          <Brain className="h-5 w-5 text-violet-600" />
          AI Health Insights
          <Badge variant="outline" className="ml-2 text-xs" data-testid="badge-ai-confidence">
            {Math.round(dashboard.aiConfidence * 100)}% confidence
          </Badge>
        </CardTitle>
        <CardDescription data-testid="text-ai-generated-time">
          Generated {formatDistanceToNow(new Date(dashboard.generatedAt))} ago
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-background/50 p-4 rounded-lg" data-testid="ai-summary">
          <p className="text-sm" data-testid="text-ai-summary">{dashboard.aiSummary}</p>
        </div>

        {dashboard.keyInsights.length > 0 && (
          <div data-testid="ai-key-insights">
            <h4 className="font-medium mb-2 flex items-center gap-2" data-testid="heading-key-insights">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              Key Insights
            </h4>
            <ul className="space-y-2">
              {dashboard.keyInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`insight-${i}`}>
                  <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dashboard.riskFactors.length > 0 && (
          <div data-testid="ai-risk-factors">
            <h4 className="font-medium mb-2 flex items-center gap-2" data-testid="heading-risk-factors">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Risk Factors
            </h4>
            <ul className="space-y-1">
              {dashboard.riskFactors.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-orange-600 dark:text-orange-400" data-testid={`risk-factor-${i}`}>
                  <span className="bg-orange-500 rounded-full w-1.5 h-1.5 shrink-0 mt-2" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dashboard.recommendations.length > 0 && (
          <div data-testid="ai-recommendations">
            <h4 className="font-medium mb-2 flex items-center gap-2" data-testid="heading-recommendations">
              <Target className="h-4 w-4 text-green-500" />
              Recommendations
            </h4>
            <ol className="space-y-2">
              {dashboard.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" data-testid={`recommendation-${i}`}>
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PatientAnalyticsPage() {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState("sarah-unified-001");

  const { data: dashboard, isLoading, refetch, isRefetching } = useQuery<PatientAnalyticsDashboard>({
    queryKey: ["/api/analytics/patient", selectedPatient],
  });

  const handleRefresh = async () => {
    try {
      await apiRequest("DELETE", `/api/analytics/cache/${selectedPatient}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/analytics/patient", selectedPatient] });
      refetch();
      toast({
        title: "Refreshing Analytics",
        description: "Generating new AI-powered insights...",
      });
    } catch {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh analytics data",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-4 max-w-7xl mx-auto">
        <ErrorState
          title="No analytics data available"
          onRetry={() => refetch()}
          retryLabel="Try Again"
          icon={AlertTriangle}
          data-testid="text-no-data"
        />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Activity className="h-6 w-6" />
            Health Analytics Dashboard
          </h1>
          <p className="text-muted-foreground" data-testid="text-patient-info">
            {dashboard.patientName} | {format(new Date(dashboard.dateRange.start), "MMM d")} - {format(new Date(dashboard.dateRange.end), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
            <SelectTrigger className="w-[200px]" data-testid="patient-select">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sarah-unified-001" data-testid="select-patient-sarah">Sarah Johnson</SelectItem>
              <SelectItem value="patient-002" data-testid="select-patient-john">John Smith</SelectItem>
              <SelectItem value="patient-003" data-testid="select-patient-maria">Maria Garcia</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefetching}
            data-testid="button-refresh-analytics"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <HealthScoreCard score={dashboard.overallHealthScore} trend={dashboard.healthScoreTrend} />
        <MetricCard
          label="Vital Signs"
          value={dashboard.vitalTrends.length}
          icon={Heart}
          color="text-red-500"
          testId="stats-vitals"
          description={`${dashboard.vitalTrends.filter((t) => !t.withinNormalRange).length} outside normal range`}
        />
        <MetricCard
          label="Anomalies"
          value={dashboard.anomalies.length}
          icon={AlertTriangle}
          color="text-orange-500"
          testId="stats-anomalies"
          description={`${dashboard.anomalies.filter((a) => a.severity === "high" || a.severity === "critical").length} high priority`}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Brain className="h-4 w-4 mr-2" />
            AI Overview
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <Heart className="h-4 w-4 mr-2" />
            Vital Trends
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">
            <FlaskConical className="h-4 w-4 mr-2" />
            Lab Results
          </TabsTrigger>
          <TabsTrigger value="adherence" data-testid="tab-adherence">
            <Pill className="h-4 w-4 mr-2" />
            Adherence
          </TabsTrigger>
          <TabsTrigger value="correlations" data-testid="tab-correlations">
            <Activity className="h-4 w-4 mr-2" />
            Correlations
          </TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Anomalies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <AIInsightsPanel dashboard={dashboard} />
            <div className="space-y-6">
              <AdherenceCard metrics={dashboard.adherenceMetrics} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="vitals">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.vitalTrends.map((trend) => (
              <TrendCard key={trend.metric} trend={trend} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="labs">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dashboard.labTrends.map((trend) => (
              <TrendCard key={trend.metric} trend={trend} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="adherence">
          <div className="grid gap-6 lg:grid-cols-2">
            <AdherenceCard metrics={dashboard.adherenceMetrics} />
            <Card data-testid="card-adherence-trends">
              <CardHeader>
                <CardTitle data-testid="text-adherence-trends-title">Adherence Trends</CardTitle>
                <CardDescription data-testid="text-adherence-trends-desc">Daily medication tracking over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dashboard.adherenceMetrics[0]?.dataPoints.slice().reverse().map((p, i) => ({
                        date: format(new Date(p.date), "MMM d"),
                        ...dashboard.adherenceMetrics.reduce((acc, m) => {
                          acc[m.medicationName.split(" ")[0]] = m.dataPoints[m.dataPoints.length - 1 - i]?.value || 0;
                          return acc;
                        }, {} as Record<string, number>),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      />
                      {dashboard.adherenceMetrics.map((m, i) => (
                        <Area
                          key={m.medicationId}
                          type="step"
                          dataKey={m.medicationName.split(" ")[0]}
                          stackId="1"
                          stroke={["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"][i % 4]}
                          fill={["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"][i % 4]}
                          fillOpacity={0.3}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="correlations">
          <div className="grid gap-4 md:grid-cols-2">
            {dashboard.correlations.map((corr) => (
              <CorrelationCard key={corr.id} correlation={corr} />
            ))}
          </div>
          {dashboard.correlations.length === 0 && (
            <Card data-testid="card-correlations-empty">
              <CardContent className="p-8 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p data-testid="text-correlations-empty">No significant correlations detected</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="anomalies">
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {dashboard.anomalies.map((anomaly) => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} />
              ))}
              {dashboard.anomalies.length === 0 && (
                <Card data-testid="card-anomalies-empty">
                  <CardContent className="p-8 text-center">
                    <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-lg" data-testid="text-anomalies-empty">No anomalies detected</p>
                    <p className="text-muted-foreground" data-testid="text-anomalies-empty-desc">All metrics are within expected ranges</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
