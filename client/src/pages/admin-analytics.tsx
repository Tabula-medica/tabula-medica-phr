import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { 
  AnalyticsDashboardSummary,
  FeatureUsage,
  TaskSuccessMetric,
  ChurnPrediction,
  SafetyIncident,
} from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, LoadingState } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  ThumbsUp,
  Clock,
  Target,
  BarChart3,
  PieChart,
  RefreshCw,
  Filter,
  Download,
  ChevronRight,
  UserX,
  Zap,
  Shield,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Brain,
  Sparkles,
  ArrowUpRight,
  Eye,
  Phone,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
} from "recharts";

const CHURN_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const SEVERITY_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30d");
  const [churnFilter, setChurnFilter] = useState("all");
  const [incidentFilter, setIncidentFilter] = useState("all");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<AnalyticsDashboardSummary>({
    queryKey: ["/api/admin/analytics/summary"],
  });

  const { data: featureUsage, isLoading: featuresLoading } = useQuery<FeatureUsage[]>({
    queryKey: ["/api/admin/analytics/features"],
  });

  const { data: taskMetrics, isLoading: tasksLoading } = useQuery<TaskSuccessMetric[]>({
    queryKey: ["/api/admin/analytics/tasks"],
  });

  const { data: churnPredictions, isLoading: churnLoading } = useQuery<ChurnPrediction[]>({
    queryKey: ["/api/admin/analytics/churn", churnFilter !== "all" ? churnFilter : undefined],
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery<SafetyIncident[]>({
    queryKey: ["/api/admin/analytics/incidents", incidentFilter !== "all" ? { status: incidentFilter } : undefined],
  });

  const { data: featureAdoption, isLoading: adoptionLoading } = useQuery<{
    overallAdoptionRate: number;
    predictedAdoptionRate30Days: number;
    predictedAdoptionRate90Days: number;
    topGrowingFeatures: {
      featureId: string;
      featureName: string;
      currentUsage: number;
      predictedUsage30Days: number;
      predictedUsage90Days: number;
      trend: "growing" | "stable" | "declining";
      growthRate: number;
      confidenceScore: number;
      factors: string[];
      recommendations: string[];
      historicalData: { date: string; usage: number }[];
    }[];
    decliningFeatures: {
      featureId: string;
      featureName: string;
      currentUsage: number;
      predictedUsage30Days: number;
      predictedUsage90Days: number;
      trend: "growing" | "stable" | "declining";
      growthRate: number;
      confidenceScore: number;
      factors: string[];
      recommendations: string[];
      historicalData: { date: string; usage: number }[];
    }[];
    recommendations: string[];
    insights: { type: string; message: string; priority: "high" | "medium" | "low" }[];
  }>({
    queryKey: ["/api/predictive-dashboard/feature-adoption"],
  });

  const { data: churnMitigation, isLoading: churnMitigationLoading } = useQuery<{
    totalAtRisk: number;
    criticalRisk: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    predictedChurnRate: number;
    avgChurnProbability: number;
    topRiskFactors: { factor: string; affectedUsers: number; avgImpact: number }[];
    recommendedInterventions: { intervention: string; targetUsers: number; expectedRetention: number }[];
    atRiskUsers: {
      userId: string;
      userName: string;
      churnRisk: "critical" | "high" | "medium" | "low";
      churnProbability: number;
      riskFactors: { factor: string; impact: "high" | "medium" | "low"; description: string }[];
      mitigationStrategies: {
        id: string;
        strategy: string;
        priority: "immediate" | "short_term" | "long_term";
        expectedImpact: number;
        actionSteps: string[];
        estimatedCost: "low" | "medium" | "high";
        successProbability: number;
      }[];
      lastEngagement: string;
      engagementScore: number;
    }[];
    trends: { date: string; atRisk: number; churned: number; retained: number }[];
  }>({
    queryKey: ["/api/predictive-dashboard/churn-mitigation"],
  });

  const [selectedUser, setSelectedUser] = useState<typeof churnMitigation extends { atRiskUsers: (infer U)[] } ? U : never | null>(null);
  
  const [selectedFeature, setSelectedFeature] = useState<{
    featureId: string;
    featureName: string;
    currentUsage: number;
    predictedUsage30Days: number;
    predictedUsage90Days: number;
    trend: "growing" | "stable" | "declining";
    growthRate: number;
    confidenceScore: number;
    factors: string[];
    recommendations: string[];
    historicalData: { date: string; usage: number }[];
  } | null>(null);

  const isLoading = summaryLoading || featuresLoading || tasksLoading || churnLoading || incidentsLoading;

  const filteredChurn = churnFilter === "all" 
    ? churnPredictions 
    : churnPredictions?.filter(p => p.churnRisk === churnFilter);

  const filteredIncidents = incidentFilter === "all"
    ? incidents
    : incidents?.filter(i => i.status === incidentFilter);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Admin Analytics Dashboard"
        subtitle="Comprehensive metrics, user engagement, and predictive analytics"
        actions={
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]" data-testid="select-date-range">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetchSummary()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" data-testid="button-export">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingState message="Loading analytics..." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.totalUsers?.toLocaleString() || 0}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="text-green-500 flex items-center">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{summary?.newUsersThisMonth || 0}
                  </span>
                  <span className="ml-1">new this month</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.activeUsers?.toLocaleString() || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {summary?.totalUsers ? Math.round((summary.activeUsers / summary.totalUsers) * 100) : 0}% of total users
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-nps-score">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                <ThumbsUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avgNpsScore || 0}</div>
                <div className="text-xs text-muted-foreground">
                  Industry benchmark: 50+
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-sus-score">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">SUS Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avgSusScore?.toFixed(1) || 0}</div>
                <div className="text-xs text-muted-foreground">
                  Above average (&gt;68)
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-task-success">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Task Success Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{((summary?.taskSuccessRate || 0) * 100).toFixed(1)}%</div>
                <Progress value={(summary?.taskSuccessRate || 0) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card data-testid="card-session-duration">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Session Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.avgSessionDuration?.toFixed(1) || 0} min</div>
                <div className="text-xs text-muted-foreground">
                  Per active session
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-open-incidents">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.openIncidents || 0}</div>
                <div className="flex items-center text-xs">
                  {(summary?.criticalIncidents || 0) > 0 ? (
                    <span className="text-red-500 flex items-center">
                      <XCircle className="h-3 w-3 mr-1" />
                      {summary?.criticalIncidents} critical
                    </span>
                  ) : (
                    <span className="text-green-500 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      No critical issues
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-churn-risk">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">High Churn Risk</CardTitle>
                <UserX className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary?.highRiskChurnUsers || 0}</div>
                <div className="text-xs text-muted-foreground">
                  Users at risk of leaving
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList data-testid="tabs-analytics" className="flex-wrap">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="engagement" data-testid="tab-engagement">Engagement</TabsTrigger>
              <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
              <TabsTrigger value="predictive" data-testid="tab-predictive">
                <Brain className="h-4 w-4 mr-1" />
                Predictive
              </TabsTrigger>
              <TabsTrigger value="churn" data-testid="tab-churn">Churn Risk</TabsTrigger>
              <TabsTrigger value="incidents" data-testid="tab-incidents">Safety Incidents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Engagement Trend
                    </CardTitle>
                    <CardDescription>Daily active users over the past 30 days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={summary?.engagementTrend || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ThumbsUp className="h-5 w-5" />
                      Satisfaction Trend
                    </CardTitle>
                    <CardDescription>NPS and SUS scores over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={summary?.satisfactionTrend || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5, 7)} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="nps" name="NPS" stroke="#8884d8" strokeWidth={2} />
                          <Line type="monotone" dataKey="sus" name="SUS" stroke="#82ca9d" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Top Features
                    </CardTitle>
                    <CardDescription>Most used features by usage count</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {summary?.topFeatures?.map((feature, index) => (
                        <div key={feature.name} className="flex items-center gap-4">
                          <div className="w-8 text-center font-bold text-muted-foreground">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{feature.name}</div>
                            <Progress value={(feature.usage / (summary.topFeatures?.[0]?.usage || 1)) * 100} className="mt-1" />
                          </div>
                          <div className="text-sm font-medium">
                            {feature.usage.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      Low Adoption Features
                    </CardTitle>
                    <CardDescription>Features needing attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary?.lowAdoptionFeatures?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          All features have healthy adoption rates
                        </div>
                      ) : (
                        summary?.lowAdoptionFeatures?.map((feature) => (
                          <div key={feature} className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                            <div className="flex items-center gap-2">
                              <MinusCircle className="h-4 w-4 text-orange-500" />
                              <span className="font-medium">{feature}</span>
                            </div>
                            <Button variant="ghost" size="sm" data-testid={`button-view-${feature.toLowerCase().replace(/\s/g, "-")}`}>
                              View Details
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Engagement Analytics</CardTitle>
                  <CardDescription>Detailed breakdown of user engagement metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summary?.engagementTrend || []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="value" name="Active Users" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Feature Usage Analytics</CardTitle>
                  <CardDescription>Detailed usage statistics for all features</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Total Usage</TableHead>
                        <TableHead className="text-right">Unique Users</TableHead>
                        <TableHead className="text-right">Success Rate</TableHead>
                        <TableHead className="text-right">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {featureUsage?.map((feature) => (
                        <TableRow key={feature.id} data-testid={`row-feature-${feature.featureName.toLowerCase().replace(/\s/g, "-")}`}>
                          <TableCell className="font-medium">{feature.featureName}</TableCell>
                          <TableCell className="text-right">{feature.totalUsage.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{feature.uniqueUsers.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={feature.successRate >= 0.9 ? "default" : feature.successRate >= 0.8 ? "secondary" : "destructive"}>
                              {(feature.successRate * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className={`flex items-center justify-end gap-1 ${
                              feature.trendDirection === "up" ? "text-green-500" : 
                              feature.trendDirection === "down" ? "text-red-500" : "text-muted-foreground"
                            }`}>
                              {feature.trendDirection === "up" ? <TrendingUp className="h-4 w-4" /> : 
                               feature.trendDirection === "down" ? <TrendingDown className="h-4 w-4" /> :
                               <MinusCircle className="h-4 w-4" />}
                              {feature.trendPercentage > 0 ? "+" : ""}{feature.trendPercentage}%
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Success Metrics</CardTitle>
                  <CardDescription>Completion rates for key user tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={taskMetrics || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="taskName" width={180} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                        <Bar dataKey="successRate" name="Success Rate" fill="hsl(var(--primary))" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="churn" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Churn Risk Analysis</h3>
                  <p className="text-sm text-muted-foreground">Users at risk of leaving the platform</p>
                </div>
                <Select value={churnFilter} onValueChange={setChurnFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-churn-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                {(["critical", "high", "medium", "low"] as const).map((level) => {
                  const count = churnPredictions?.filter(p => p.churnRisk === level).length || 0;
                  return (
                    <Card key={level} data-testid={`card-churn-${level}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium capitalize flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHURN_COLORS[level] }} />
                          {level} Risk
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" style={{ color: CHURN_COLORS[level] }}>{count}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Risk Level</TableHead>
                          <TableHead>Probability</TableHead>
                          <TableHead>Days Since Login</TableHead>
                          <TableHead>Engagement Score</TableHead>
                          <TableHead>Risk Factors</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredChurn?.map((prediction) => (
                          <TableRow key={prediction.id} data-testid={`row-churn-${prediction.userId}`}>
                            <TableCell className="font-medium">{prediction.userId}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                style={{ 
                                  borderColor: CHURN_COLORS[prediction.churnRisk],
                                  color: CHURN_COLORS[prediction.churnRisk]
                                }}
                              >
                                {prediction.churnRisk}
                              </Badge>
                            </TableCell>
                            <TableCell>{(prediction.churnProbability * 100).toFixed(0)}%</TableCell>
                            <TableCell>{prediction.daysSinceLastLogin}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={prediction.engagementScore} className="w-16" />
                                <span className="text-sm">{prediction.engagementScore}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[200px]">
                              <div className="flex flex-wrap gap-1">
                                {prediction.riskFactors.slice(0, 2).map((factor, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {factor.length > 25 ? factor.slice(0, 25) + "..." : factor}
                                  </Badge>
                                ))}
                                {prediction.riskFactors.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{prediction.riskFactors.length - 2}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" data-testid={`button-action-${prediction.userId}`}>
                                Take Action
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="incidents" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Safety Incident Reports</h3>
                  <p className="text-sm text-muted-foreground">Track and manage safety-related incidents</p>
                </div>
                <Select value={incidentFilter} onValueChange={setIncidentFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-incident-filter">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="reported">Reported</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card data-testid="card-incident-total">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-incident-total">{incidents?.length || 0}</div>
                  </CardContent>
                </Card>
                <Card data-testid="card-incident-critical">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                      Critical
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500" data-testid="text-incident-critical">
                      {incidents?.filter(i => i.severity === "critical").length || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-incident-high">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-orange-500" />
                      High Priority
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-500" data-testid="text-incident-high">
                      {incidents?.filter(i => i.severity === "high").length || 0}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-incident-resolved">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      Resolved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-500" data-testid="text-incident-resolved">
                      {incidents?.filter(i => i.status === "resolved" || i.status === "closed").length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {filteredIncidents?.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <h3 className="text-lg font-semibold">No Incidents</h3>
                      <p className="text-muted-foreground">No safety incidents match your current filter</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Severity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Reported</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredIncidents?.map((incident) => (
                            <TableRow key={incident.id} data-testid={`row-incident-${incident.id}`}>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {incident.title}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{incident.incidentType}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  style={{
                                    borderColor: SEVERITY_COLORS[incident.severity],
                                    color: SEVERITY_COLORS[incident.severity],
                                  }}
                                >
                                  {incident.severity}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  incident.status === "resolved" || incident.status === "closed" ? "default" :
                                  incident.status === "investigating" ? "secondary" : "outline"
                                }>
                                  {incident.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(incident.reportedAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" data-testid={`button-view-incident-${incident.id}`}>
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="predictive" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Predictive Analytics Dashboard
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    AI-powered feature adoption trends and churn mitigation strategies
                  </p>
                </div>
              </div>

              {(adoptionLoading || churnMitigationLoading) ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <Skeleton className="h-4 w-32" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-24 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card data-testid="card-adoption-rate">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Adoption Rate</CardTitle>
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{featureAdoption?.overallAdoptionRate || 0}%</div>
                        <div className="flex items-center gap-1 text-xs text-green-500">
                          <ArrowUpRight className="h-3 w-3" />
                          Predicted: {featureAdoption?.predictedAdoptionRate30Days || 0}% in 30 days
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-churn-at-risk">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Users at Risk</CardTitle>
                        <UserX className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{churnMitigation?.totalAtRisk || 0}</div>
                        <div className="text-xs text-muted-foreground">
                          {churnMitigation?.criticalRisk || 0} critical, {churnMitigation?.highRisk || 0} high
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-churn-rate">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Predicted Churn Rate</CardTitle>
                        <TrendingDown className="h-4 w-4 text-orange-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{churnMitigation?.predictedChurnRate || 0}%</div>
                        <div className="text-xs text-muted-foreground">
                          Avg probability: {churnMitigation?.avgChurnProbability || 0}%
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-growing-features">
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Growing Features</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{featureAdoption?.topGrowingFeatures?.length || 0}</div>
                        <div className="text-xs text-muted-foreground">
                          {featureAdoption?.decliningFeatures?.length || 0} declining
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card data-testid="card-feature-trends">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Feature Adoption Trends
                        </CardTitle>
                        <CardDescription>Click on a bar for detailed breakdown (all features)</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={[
                                ...(featureAdoption?.topGrowingFeatures?.map(f => ({
                                  name: f.featureName.length > 12 ? f.featureName.slice(0, 12) + "..." : f.featureName,
                                  fullName: f.featureName,
                                  current: f.currentUsage,
                                  predicted30: f.predictedUsage30Days,
                                  predicted90: f.predictedUsage90Days,
                                  growth: f.growthRate,
                                  trend: f.trend,
                                  feature: f,
                                })) || []),
                                ...(featureAdoption?.decliningFeatures?.map(f => ({
                                  name: f.featureName.length > 12 ? f.featureName.slice(0, 12) + "..." : f.featureName,
                                  fullName: f.featureName,
                                  current: f.currentUsage,
                                  predicted30: f.predictedUsage30Days,
                                  predicted90: f.predictedUsage90Days,
                                  growth: f.growthRate,
                                  trend: f.trend,
                                  feature: f,
                                })) || [])
                              ]}
                              margin={{ bottom: 60 }}
                              onClick={(data) => {
                                if (data && data.activePayload && data.activePayload[0]) {
                                  const clickedFeature = data.activePayload[0].payload.feature;
                                  setSelectedFeature(clickedFeature);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const isGrowing = data.trend === "growing";
                                    return (
                                      <div className="bg-popover border rounded-md p-2 text-sm shadow-md">
                                        <p className="font-medium">{data.fullName}</p>
                                        <p>Current: {data.current?.toLocaleString()}</p>
                                        <p>30-day: {data.predicted30?.toLocaleString()}</p>
                                        <p>90-day: {data.predicted90?.toLocaleString()}</p>
                                        <p className={isGrowing ? "text-green-500" : "text-red-500"}>
                                          {isGrowing ? "+" : ""}{data.growth}% ({data.trend})
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">Click for details</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend />
                              <Bar dataKey="current" name="Current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="predicted30" name="30-Day Prediction" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="predicted90" name="90-Day Prediction" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-2 text-xs text-center text-muted-foreground">
                          Click any bar to see detailed feature analytics
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-churn-trends">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5" />
                          Churn Risk Trends
                        </CardTitle>
                        <CardDescription>Historical churn data and retention</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={churnMitigation?.trends || []}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip />
                              <Legend />
                              <Area type="monotone" dataKey="atRisk" name="At Risk" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.3} />
                              <Area type="monotone" dataKey="churned" name="Churned" stackId="2" stroke="#dc2626" fill="#dc2626" fillOpacity={0.3} />
                              <Area type="monotone" dataKey="retained" name="Retained" stackId="3" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card data-testid="card-risk-factors">
                      <CardHeader>
                        <CardTitle>Top Churn Risk Factors</CardTitle>
                        <CardDescription>Most common factors leading to user churn</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {churnMitigation?.topRiskFactors?.map((factor, idx) => (
                            <div key={idx} className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-sm">{factor.factor}</span>
                                  <span className="text-xs text-muted-foreground">{factor.affectedUsers} users</span>
                                </div>
                                <Progress value={factor.avgImpact} className="h-2" />
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {factor.avgImpact}% impact
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-interventions">
                      <CardHeader>
                        <CardTitle>Recommended Interventions</CardTitle>
                        <CardDescription>AI-suggested actions to reduce churn</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {churnMitigation?.recommendedInterventions?.map((intervention, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-md bg-primary/10">
                                  {idx === 0 ? <Mail className="h-4 w-4" /> : idx === 1 ? <Phone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{intervention.intervention}</p>
                                  <p className="text-xs text-muted-foreground">Target: {intervention.targetUsers} users</p>
                                </div>
                              </div>
                              <Badge variant="secondary">{intervention.expectedRetention}% retention</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card data-testid="card-at-risk-users">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        At-Risk Users with Mitigation Strategies
                      </CardTitle>
                      <CardDescription>Click on a user to see detailed mitigation strategies</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[350px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Risk Level</TableHead>
                              <TableHead>Probability</TableHead>
                              <TableHead>Engagement</TableHead>
                              <TableHead>Last Active</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {churnMitigation?.atRiskUsers?.map((user) => (
                              <TableRow key={user.userId} data-testid={`row-user-${user.userId}`}>
                                <TableCell className="font-medium">{user.userName}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    style={{
                                      borderColor: CHURN_COLORS[user.churnRisk],
                                      color: CHURN_COLORS[user.churnRisk],
                                    }}
                                  >
                                    {user.churnRisk}
                                  </Badge>
                                </TableCell>
                                <TableCell>{user.churnProbability}%</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Progress value={user.engagementScore} className="w-16" />
                                    <span className="text-sm">{user.engagementScore}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(user.lastEngagement).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setSelectedUser(user as any)}
                                    data-testid={`button-view-strategies-${user.userId}`}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Strategies
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {featureAdoption?.insights && featureAdoption.insights.length > 0 && (
                    <Card data-testid="card-insights">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          AI Insights & Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {featureAdoption.insights.map((insight, idx) => (
                            <div 
                              key={idx}
                              data-testid={`insight-${idx}`}
                              className={`p-3 border ${
                                insight.priority === "high" ? "border-red-500/50 bg-red-500/5" :
                                insight.priority === "medium" ? "border-yellow-500/50 bg-yellow-500/5" :
                                "border-green-500/50 bg-green-500/5"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs capitalize">{insight.type}</Badge>
                                <Badge 
                                  variant="outline"
                                  className={`text-xs ${
                                    insight.priority === "high" ? "text-red-500 border-red-500" :
                                    insight.priority === "medium" ? "text-yellow-500 border-yellow-500" :
                                    "text-green-500 border-green-500"
                                  }`}
                                >
                                  {insight.priority}
                                </Badge>
                              </div>
                              <p className="text-sm" data-testid={`insight-message-${idx}`}>{insight.message}</p>
                            </div>
                          ))}
                        </div>
                        {featureAdoption.recommendations && featureAdoption.recommendations.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="font-medium mb-2">Recommendations</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                              {featureAdoption.recommendations.map((rec, idx) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>

          <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Mitigation Strategies for {selectedUser?.userName}
                </DialogTitle>
                <DialogDescription>
                  Churn probability: {selectedUser?.churnProbability}% | Risk level: {selectedUser?.churnRisk}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Risk Factors</h4>
                  <div className="space-y-2">
                    {selectedUser?.riskFactors?.map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            factor.impact === "high" ? "text-red-500 border-red-500" :
                            factor.impact === "medium" ? "text-yellow-500 border-yellow-500" :
                            "text-green-500 border-green-500"
                          }`}
                        >
                          {factor.impact}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{factor.factor}</p>
                          <p className="text-xs text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Recommended Strategies</h4>
                  <div className="space-y-3">
                    {selectedUser?.mitigationStrategies?.map((strategy, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant={
                                    strategy.priority === "immediate" ? "destructive" :
                                    strategy.priority === "short_term" ? "default" : "secondary"
                                  }
                                >
                                  {strategy.priority.replace("_", " ")}
                                </Badge>
                                <Badge variant="outline">{strategy.successProbability}% success</Badge>
                              </div>
                              <p className="font-medium text-sm mb-2">{strategy.strategy}</p>
                              <div className="space-y-1">
                                {strategy.actionSteps?.map((step, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    {step}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-500">+{strategy.expectedImpact}%</div>
                              <div className="text-xs text-muted-foreground">impact</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedUser(null)} data-testid="button-close-user-dialog">
                    Close
                  </Button>
                  <Button data-testid="button-start-intervention">
                    Start Intervention
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={!!selectedFeature} onOpenChange={(open) => !open && setSelectedFeature(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2" data-testid="text-feature-dialog-title">
                  <BarChart3 className="h-5 w-5" />
                  {selectedFeature?.featureName} - Detailed Analytics
                </DialogTitle>
                <DialogDescription data-testid="text-feature-dialog-description">
                  Trend: {selectedFeature?.trend} | Growth Rate: {selectedFeature?.growthRate}% | Confidence: {selectedFeature?.confidenceScore}%
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-muted/50" data-testid="stat-current-usage">
                    <p className="text-sm text-muted-foreground">Current Usage</p>
                    <p className="text-2xl font-bold">{selectedFeature?.currentUsage?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-muted/50" data-testid="stat-predicted-30">
                    <p className="text-sm text-muted-foreground">30-Day Prediction</p>
                    <p className="text-2xl font-bold">{selectedFeature?.predictedUsage30Days?.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-muted/50" data-testid="stat-predicted-90">
                    <p className="text-sm text-muted-foreground">90-Day Prediction</p>
                    <p className="text-2xl font-bold">{selectedFeature?.predictedUsage90Days?.toLocaleString()}</p>
                  </div>
                </div>

                {selectedFeature?.historicalData && selectedFeature.historicalData.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Historical Usage Trend</h4>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedFeature.historicalData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="usage" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {selectedFeature?.factors && selectedFeature.factors.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Key Growth Factors</h4>
                    <div className="space-y-2">
                      {selectedFeature.factors.map((factor, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50" data-testid={`factor-${idx}`}>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFeature?.recommendations && selectedFeature.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {selectedFeature.recommendations.map((rec, idx) => (
                        <li key={idx} data-testid={`recommendation-${idx}`}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedFeature(null)} data-testid="button-close-feature-dialog">
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
