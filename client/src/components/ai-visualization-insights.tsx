import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb, 
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { apiRequest } from "@/lib/queryClient";

interface DataPoint {
  date: string;
  value: number;
  label?: string;
  unit?: string;
}

interface ChartInsight {
  id: string;
  type: "trend" | "anomaly" | "achievement" | "warning" | "recommendation" | "correlation";
  severity: "info" | "success" | "warning" | "critical";
  title: string;
  description: string;
  dataContext?: {
    highlightPoints?: number[];
    trendDirection?: "up" | "down" | "stable";
    changePercent?: number;
  };
  actionItems?: string[];
  relatedMetrics?: string[];
}

interface VisualizationInsightsResponse {
  chartId: string;
  insights: ChartInsight[];
  summary: string;
  generatedAt: string;
  confidenceScore: number;
}

interface AIVisualizationInsightsProps {
  chartType: "vital_trends" | "lab_results" | "medication_adherence" | "health_score" | "wellness_metrics" | "appointments" | "goals_progress";
  dataPoints: DataPoint[];
  metricName: string;
  unit?: string;
  normalRange?: { min: number; max: number };
  compact?: boolean;
  autoLoad?: boolean;
}

const insightIcons: Record<string, React.ElementType> = {
  trend: TrendingUp,
  anomaly: AlertTriangle,
  achievement: CheckCircle2,
  warning: AlertTriangle,
  recommendation: Lightbulb,
  correlation: Zap,
};

const severityColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const trendIcons: Record<string, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: ArrowRight,
};

export function AIVisualizationInsights({
  chartType,
  dataPoints,
  metricName,
  unit,
  normalRange,
  compact = false,
  autoLoad = false
}: AIVisualizationInsightsProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const insightsMutation = useMutation({
    mutationFn: async () => {
      console.log("[AI Insights] Starting mutation for", metricName);
      const response = await apiRequest("POST", "/api/ai-insights/chart", {
        chartType,
        dataPoints,
        metricName,
        unit,
        normalRange
      });
      const data = await response.json() as VisualizationInsightsResponse;
      console.log("[AI Insights] Received data:", data);
      return data;
    },
  });

  const displayData = insightsMutation.data;
  const loading = insightsMutation.isPending;
  const error = insightsMutation.error;
  const isSuccess = insightsMutation.isSuccess;

  console.log("[AI Insights] Render state:", { loading, isSuccess, hasData: !!displayData, error: !!error });

  const handleGenerateInsights = () => {
    console.log("[AI Insights] Generate clicked");
    insightsMutation.mutate();
  };

  if (compact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-between gap-2"
            data-testid="btn-toggle-ai-insights"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm">AI Insights</span>
              {displayData && (
                <Badge variant="secondary" className="text-xs">
                  {displayData.insights.length}
                </Badge>
              )}
            </span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <AIInsightsContent
            insights={displayData}
            loading={loading}
            error={error}
            onGenerate={handleGenerateInsights}
            dataPointsCount={dataPoints.length}
          />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card data-testid="card-ai-visualization-insights">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Brain className="h-4 w-4 text-primary" />
          AI Analysis
          {displayData && (
            <Badge variant="outline" className="text-xs font-normal">
              {Math.round(displayData.confidenceScore * 100)}% confidence
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Intelligent insights for {metricName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AIInsightsContent
          insights={displayData}
          loading={loading}
          error={error}
          onGenerate={handleGenerateInsights}
          dataPointsCount={dataPoints.length}
        />
      </CardContent>
    </Card>
  );
}

interface AIInsightsContentProps {
  insights: VisualizationInsightsResponse | undefined;
  loading: boolean;
  error: Error | null;
  onGenerate: () => void;
  dataPointsCount: number;
}

function AIInsightsContent({ insights, loading, error, onGenerate, dataPointsCount }: AIInsightsContentProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="loading-ai-insights">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Analyzing your data...
        </div>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4" data-testid="error-ai-insights">
        <p className="text-sm text-muted-foreground mb-2">Unable to generate insights</p>
        <Button variant="outline" size="sm" onClick={onGenerate} data-testid="btn-retry-insights">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-4" data-testid="generate-ai-insights-prompt">
        <Sparkles className="h-8 w-8 mx-auto text-primary/50 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          {dataPointsCount > 0 
            ? "Get AI-powered insights about your health data"
            : "Add data points to enable AI analysis"}
        </p>
        <Button 
          onClick={onGenerate} 
          disabled={dataPointsCount === 0}
          size="sm"
          data-testid="btn-generate-insights"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Insights
        </Button>
      </div>
    );
  }

  const insightsList = Array.isArray(insights.insights) ? insights.insights : [];
  
  const formatGeneratedTime = () => {
    try {
      if (!insights.generatedAt) return "recently";
      const date = new Date(insights.generatedAt);
      return isNaN(date.getTime()) ? "recently" : date.toLocaleTimeString();
    } catch {
      return "recently";
    }
  };
  
  return (
    <div className="space-y-4" data-testid="ai-insights-list">
      {insights.summary && typeof insights.summary === 'string' && (
        <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3" data-testid="ai-insights-summary">
          {insights.summary}
        </p>
      )}

      <div className="space-y-3">
        {insightsList.filter(Boolean).map((insight, idx) => (
          <InsightCard key={insight?.id || `insight-${idx}`} insight={insight} />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          Generated {formatGeneratedTime()}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onGenerate}
          data-testid="btn-refresh-insights"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>
    </div>
  );
}

interface InsightCardProps {
  insight: ChartInsight;
}

function InsightCard({ insight }: InsightCardProps) {
  if (!insight || typeof insight !== 'object') return null;
  
  const title = String(insight.title ?? "Insight");
  const description = String(insight.description ?? "");
  const insightType = String(insight.type ?? "recommendation");
  const insightSeverity = String(insight.severity ?? "info");
  
  const getIcon = () => {
    switch (insightType) {
      case "trend": return TrendingUp;
      case "anomaly": return AlertTriangle;
      case "achievement": return CheckCircle2;
      case "warning": return AlertTriangle;
      case "correlation": return Zap;
      default: return Lightbulb;
    }
  };
  
  const Icon = getIcon();
  
  const getBorderClass = () => {
    switch (insightSeverity) {
      case "critical": return "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20";
      case "warning": return "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20";
      case "success": return "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20";
      default: return "border-border";
    }
  };
  
  const getIconBgClass = () => {
    switch (insightSeverity) {
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "warning": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      case "success": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const actionItems = Array.isArray(insight.actionItems) ? insight.actionItems : [];
  const relatedMetrics = Array.isArray(insight.relatedMetrics) ? insight.relatedMetrics : [];
  const trendDirection = insight.dataContext?.trendDirection;
  const changePercent = insight.dataContext?.changePercent;

  return (
    <div 
      className={`p-3 rounded-lg border ${getBorderClass()}`}
      data-testid={`insight-${insight.id || 'item'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-md ${getIconBgClass()}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h4 className="font-medium text-sm">{title}</h4>
            {trendDirection && typeof changePercent === 'number' && (
              <Badge variant="outline" className="text-xs gap-1">
                {trendDirection === "up" && <TrendingUp className="h-3 w-3" />}
                {trendDirection === "down" && <TrendingDown className="h-3 w-3" />}
                {trendDirection === "stable" && <ArrowRight className="h-3 w-3" />}
                {changePercent > 0 ? "+" : ""}{changePercent.toFixed(1)}%
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          
          {actionItems.length > 0 && (
            <ul className="mt-2 space-y-1">
              {actionItems.map((item, idx) => (
                <li key={idx} className="text-xs flex items-start gap-2">
                  <ArrowRight className="h-3 w-3 mt-0.5 text-primary" />
                  <span>{String(item)}</span>
                </li>
              ))}
            </ul>
          )}

          {relatedMetrics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {relatedMetrics.map((metric, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {String(metric)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardAIInsights({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/personal-health/dashboard"],
    staleTime: 60 * 1000,
  });

  const insightsMutation = useMutation({
    mutationFn: async () => {
      const dashboardData = data as any;
      const response = await apiRequest("POST", "/api/ai-insights/dashboard", {
        healthScore: dashboardData?.healthScore?.overall || 0,
        vitals: {},
        medications: dashboardData?.medications?.list?.map((m: any) => ({
          name: m.name,
          adherenceRate: m.adherenceRate || 0.8
        })) || [],
        goals: dashboardData?.goals?.list?.map((g: any) => ({
          name: g.name,
          progress: g.currentValue || 0,
          target: g.targetValue || 100
        })) || [],
        labResults: {}
      });
      return response.json();
    }
  });

  return (
    <Card className={className} data-testid="card-dashboard-ai-insights">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Health Insights
              </CardTitle>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">Unable to load insights</p>
            ) : insightsMutation.data ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {(insightsMutation.data as any).overallInsight}
                </p>
                
                {(insightsMutation.data as any).highlights?.map((h: any, idx: number) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                      h.type === "positive" ? "bg-green-50 dark:bg-green-950/20" :
                      h.type === "attention" ? "bg-amber-50 dark:bg-amber-950/20" :
                      "bg-muted/50"
                    }`}
                  >
                    {h.type === "positive" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {h.type === "attention" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    {h.type === "info" && <Lightbulb className="h-4 w-4 text-blue-600" />}
                    <span>{h.text}</span>
                  </div>
                ))}

                {(insightsMutation.data as any).recommendations?.length > 0 && (
                  <div className="pt-2 border-t">
                    <h5 className="text-xs font-medium text-muted-foreground mb-2">Recommendations</h5>
                    <ul className="space-y-1">
                      {(insightsMutation.data as any).recommendations.slice(0, 3).map((rec: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <ArrowRight className="h-3 w-3 mt-1 text-primary" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <Button 
                  onClick={() => insightsMutation.mutate()}
                  disabled={insightsMutation.isPending || !data}
                  size="sm"
                  data-testid="btn-generate-dashboard-insights"
                >
                  {insightsMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze My Health Data
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
