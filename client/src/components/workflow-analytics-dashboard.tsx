import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  CheckCircle,
  Clock,
  Cog,
  GitBranch,
  Lightbulb,
  Play,
  RefreshCw,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

interface WorkflowMetrics {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  successRate: number;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  errorFrequency: number;
  lastExecutedAt?: string;
  executionTrend: Array<{ date: string; count: number; successRate: number }>;
}

interface ResourceUtilization {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  totalTriggers: number;
  totalActions: number;
  triggerTypeDistribution: Record<string, number>;
  actionTypeDistribution: Record<string, number>;
  resourceTypeDistribution: Record<string, number>;
  averageActionsPerWorkflow: number;
  averageTriggersPerWorkflow: number;
}

interface ExecutionHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  triggerId: string;
  triggerType?: string;
  actionsCompleted: number;
  actionsTotal: number;
  errorMessage?: string;
}

interface AIBottleneckInsight {
  id: string;
  workflowId: string;
  workflowName: string;
  insightType: "bottleneck" | "improvement" | "warning" | "optimization";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  recommendation: string;
  metrics?: Record<string, number | string>;
  generatedAt: string;
}

interface AnalyticsDashboard {
  summary: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
    averageDurationMs: number;
    errorsLast24h: number;
  };
  resourceUtilization: ResourceUtilization;
  topPerformingWorkflows: WorkflowMetrics[];
  bottomPerformingWorkflows: WorkflowMetrics[];
  recentExecutions: ExecutionHistoryEntry[];
  executionTrendLast7Days: Array<{ date: string; total: number; successful: number; failed: number }>;
  bottleneckInsights: AIBottleneckInsight[];
}

export function WorkflowAnalyticsDashboard() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [historyFilter, setHistoryFilter] = useState<string>("all");

  const { data: dashboard, isLoading } = useQuery<AnalyticsDashboard>({
    queryKey: ["/api/fhir-workflow-builder/analytics/dashboard"],
  });

  const { data: executionHistory } = useQuery<ExecutionHistoryEntry[]>({
    queryKey: ["/api/fhir-workflow-builder/analytics/execution-history", historyFilter],
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-workflow-builder/analytics/insights/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-workflow-builder/analytics/dashboard"] });
      toast({
        title: "Insights Generated",
        description: "AI analysis complete with new recommendations.",
      });
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Could not generate insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: typeof CheckCircle }> = {
      completed: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
      running: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Play },
      pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
      cancelled: { color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", icon: XCircle },
    };
    const { color, icon: Icon } = variants[status] || variants.pending;
    return (
      <Badge className={`${color} gap-1`} data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <Badge className={variants[severity] || variants.low}>{severity}</Badge>;
  };

  const getInsightIcon = (type: string) => {
    const icons: Record<string, typeof AlertTriangle> = {
      bottleneck: AlertTriangle,
      improvement: Lightbulb,
      warning: AlertTriangle,
      optimization: Zap,
    };
    return icons[type] || Lightbulb;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const summary = dashboard?.summary;
  const utilization = dashboard?.resourceUtilization;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" data-testid="text-analytics-title">
            Workflow Analytics
          </h2>
          <p className="text-muted-foreground">
            Monitor performance, identify bottlenecks, and optimize your workflows
          </p>
        </div>
        <Button
          onClick={() => generateInsightsMutation.mutate()}
          disabled={generateInsightsMutation.isPending}
          data-testid="button-generate-insights"
        >
          <Brain className="mr-2 h-4 w-4" />
          {generateInsightsMutation.isPending ? "Analyzing..." : "Generate AI Insights"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-workflows">
              {summary?.totalWorkflows || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.activeWorkflows || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-executions">
              {summary?.totalExecutions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all workflows
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {summary?.successRate || 0}%
            </div>
            <Progress value={summary?.successRate || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-duration">
              {formatDuration(summary?.averageDurationMs || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.errorsLast24h || 0} errors in 24h
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="mr-2 h-4 w-4" />
            Execution History
          </TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">
            <TrendingUp className="mr-2 h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Cog className="mr-2 h-4 w-4" />
            Resource Usage
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Brain className="mr-2 h-4 w-4" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Execution Trend (Last 7 Days)</CardTitle>
                <CardDescription>Daily workflow execution counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="chart-execution-trend">
                  {dashboard?.executionTrendLast7Days?.map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-20">
                        {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${day.total > 0 ? (day.successful / day.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-12 text-right">{day.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Latest workflow runs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3" data-testid="list-recent-executions">
                  {dashboard?.recentExecutions?.slice(0, 5).map((exec) => (
                    <div key={exec.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{exec.workflowName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(exec.startedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {exec.durationMs && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(exec.durationMs)}
                          </span>
                        )}
                        {getStatusBadge(exec.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {dashboard?.bottleneckInsights && dashboard.bottleneckInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Insights Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2" data-testid="list-insights-summary">
                  {dashboard.bottleneckInsights.slice(0, 4).map((insight) => {
                    const InsightIcon = getInsightIcon(insight.insightType);
                    return (
                      <div
                        key={insight.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <InsightIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium truncate">{insight.title}</span>
                            {getSeverityBadge(insight.severity)}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {insight.recommendation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Execution History</CardTitle>
                  <CardDescription>Complete history of workflow executions</CardDescription>
                </div>
                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                  <SelectTrigger className="w-40" data-testid="select-history-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3" data-testid="list-execution-history">
                {(executionHistory || dashboard?.recentExecutions)
                  ?.filter((exec) => historyFilter === "all" || exec.status === historyFilter)
                  .map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{exec.workflowName}</p>
                          {getStatusBadge(exec.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Started: {formatDate(exec.startedAt)}</span>
                          {exec.completedAt && (
                            <span>Completed: {formatDate(exec.completedAt)}</span>
                          )}
                          {exec.triggerType && (
                            <Badge variant="outline" className="text-xs">
                              {exec.triggerType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {exec.actionsCompleted}/{exec.actionsTotal} actions
                        </div>
                        {exec.durationMs && (
                          <div className="text-xs text-muted-foreground">
                            {formatDuration(exec.durationMs)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-500" />
                  Top Performing Workflows
                </CardTitle>
                <CardDescription>Highest success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" data-testid="list-top-performers">
                  {dashboard?.topPerformingWorkflows?.map((wf) => (
                    <div key={wf.workflowId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{wf.workflowName}</span>
                        <span className="text-sm text-green-600 dark:text-green-400">
                          {wf.successRate}% success
                        </span>
                      </div>
                      <Progress value={wf.successRate} className="h-2" />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{wf.totalExecutions} executions</span>
                        <span>Avg: {formatDuration(wf.averageDurationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Workflows with lower success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" data-testid="list-needs-attention">
                  {dashboard?.bottomPerformingWorkflows?.map((wf) => (
                    <div key={wf.workflowId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{wf.workflowName}</span>
                        <span className="text-sm text-red-600 dark:text-red-400">
                          {wf.successRate}% success
                        </span>
                      </div>
                      <Progress value={wf.successRate} className="h-2" />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{wf.failedExecutions} failures</span>
                        <span>{wf.errorFrequency}% error rate</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Workflow Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4" data-testid="chart-workflow-distribution">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Workflows</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {utilization?.activeWorkflows || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Inactive Workflows</span>
                    <span className="font-bold text-muted-foreground">
                      {utilization?.inactiveWorkflows || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Triggers</span>
                    <span className="font-bold">{utilization?.totalTriggers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Actions</span>
                    <span className="font-bold">{utilization?.totalActions || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trigger Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2" data-testid="chart-trigger-distribution">
                  {Object.entries(utilization?.triggerTypeDistribution || {})
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Action Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2" data-testid="chart-action-distribution">
                  {Object.entries(utilization?.actionTypeDistribution || {})
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resource Type Coverage</CardTitle>
              <CardDescription>FHIR resources monitored by triggers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2" data-testid="list-resource-types">
                {Object.entries(utilization?.resourceTypeDistribution || {}).map(([type, count]) => (
                  <Badge key={type} variant="outline" className="gap-1">
                    {type}
                    <span className="text-muted-foreground">({count})</span>
                  </Badge>
                ))}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                <div>
                  Average triggers per workflow: <span className="font-medium text-foreground">{utilization?.averageTriggersPerWorkflow || 0}</span>
                </div>
                <div>
                  Average actions per workflow: <span className="font-medium text-foreground">{utilization?.averageActionsPerWorkflow || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI-Powered Insights
                  </CardTitle>
                  <CardDescription>
                    Machine learning analysis of workflow performance and bottlenecks
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => generateInsightsMutation.mutate()}
                  disabled={generateInsightsMutation.isPending}
                  data-testid="button-refresh-insights"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${generateInsightsMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh Analysis
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboard?.bottleneckInsights && dashboard.bottleneckInsights.length > 0 ? (
                <div className="space-y-4" data-testid="list-ai-insights">
                  {dashboard.bottleneckInsights.map((insight) => {
                    const InsightIcon = getInsightIcon(insight.insightType);
                    return (
                      <div
                        key={insight.id}
                        className="p-4 rounded-lg border bg-card space-y-3"
                        data-testid={`insight-${insight.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <InsightIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="font-medium">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground">{insight.workflowName}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {insight.insightType}
                            </Badge>
                            {getSeverityBadge(insight.severity)}
                          </div>
                        </div>
                        <p className="text-sm">{insight.description}</p>
                        <div className="p-3 rounded-md bg-muted/50">
                          <p className="text-sm font-medium mb-1">Recommendation</p>
                          <p className="text-sm text-muted-foreground">{insight.recommendation}</p>
                        </div>
                        {insight.metrics && Object.keys(insight.metrics).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(insight.metrics).map(([key, value]) => (
                              <Badge key={key} variant="secondary" className="gap-1">
                                <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                                <span className="font-medium">{value}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No insights yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Generate AI Insights" to analyze your workflows
                  </p>
                  <Button
                    onClick={() => generateInsightsMutation.mutate()}
                    disabled={generateInsightsMutation.isPending}
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze Workflows
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
