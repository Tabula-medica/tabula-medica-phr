import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Users,
  CheckCircle,
  Activity,
  Map,
  Clock,
  MessageSquare,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
  Target,
  Star,
  Database,
  FileCheck,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { AdminAnalyticsDashboard as DashboardData } from "@shared/schema";

const timeRangeOptions = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last year" },
];

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminJourneyAnalytics() {
  const [timeRange, setTimeRange] = useState("30d");

  const { data: dashboard, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ["/api/admin/journey-analytics/dashboard", timeRange],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/journey-analytics/dashboard?timeRange=${timeRange}`);
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground" data-testid="text-error-message">Failed to load analytics dashboard</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid="button-try-again">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { journeySummary, templateMetrics, patientEngagement, trends, feedbackSummary, dataQuality } = dashboard;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin-analytics">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Journey Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Patient engagement and journey completion metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} data-testid={`option-time-${option.value}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-journeys-started">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Journeys Started</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-journeys-started">{journeySummary.totalJourneysStarted}</div>
            <p className="text-xs text-muted-foreground" data-testid="value-journeys-active">
              {journeySummary.totalJourneysActive} currently active
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-completion-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-completion-rate">{journeySummary.completionRate.toFixed(1)}%</div>
            <Progress value={journeySummary.completionRate} className="mt-2" data-testid="progress-completion-rate" />
          </CardContent>
        </Card>

        <Card data-testid="card-engagement-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-engagement-score">{journeySummary.averageEngagementScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground" data-testid="value-avg-completion-days">
              Avg {journeySummary.averageCompletionDays} days to complete
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-patients">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-active-patients">{patientEngagement.totalActivePatients}</div>
            <p className="text-xs text-muted-foreground" data-testid="value-journeys-per-patient">
              {patientEngagement.averageJourneysPerPatient.toFixed(1)} journeys/patient
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">By Template</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
          <TabsTrigger value="quality" data-testid="tab-quality">Data Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Journey Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Completed", value: journeySummary.totalJourneysCompleted, color: "#22c55e" },
                          { name: "Active", value: journeySummary.totalJourneysActive, color: "#3b82f6" },
                          { name: "Abandoned", value: journeySummary.totalJourneysAbandoned, color: "#ef4444" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {[
                          { name: "Completed", value: journeySummary.totalJourneysCompleted, color: "#22c55e" },
                          { name: "Active", value: journeySummary.totalJourneysActive, color: "#3b82f6" },
                          { name: "Abandoned", value: journeySummary.totalJourneysAbandoned, color: "#ef4444" },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Data Submission Rate</span>
                    <span className="font-medium">{patientEngagement.dataSubmissionRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={patientEngagement.dataSubmissionRate} />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Reminder Response Rate</span>
                    <span className="font-medium">{patientEngagement.reminderResponseRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={patientEngagement.reminderResponseRate} />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Steps Completed/Day</span>
                    <span className="font-medium">{patientEngagement.averageStepsCompletedPerDay}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Patients</span>
                    <span className="font-medium">{patientEngagement.totalPatientsWithJourneys}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Journey Template Performance</CardTitle>
              <CardDescription>Metrics by individual journey template</CardDescription>
            </CardHeader>
            <CardContent>
              {templateMetrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No journey data available for this time period
                </div>
              ) : (
                <div className="space-y-4">
                  {templateMetrics.map((template) => (
                    <div
                      key={template.templateId}
                      className="p-4 border rounded-lg space-y-3"
                      data-testid={`template-${template.templateId}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium">{template.templateName}</h4>
                          <Badge variant="outline" className="text-xs mt-1">
                            {template.category}
                          </Badge>
                        </div>
                        <Badge
                          className={
                            template.completionRate >= 70
                              ? "bg-green-500"
                              : template.completionRate >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }
                        >
                          {template.completionRate.toFixed(0)}% complete
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Started</span>
                          <p className="font-medium">{template.totalStarted}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Active</span>
                          <p className="font-medium">{template.totalActive}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Completed</span>
                          <p className="font-medium">{template.totalCompleted}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Abandoned</span>
                          <p className="font-medium">{template.totalAbandoned}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Avg {template.averageCompletionDays} days
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {template.averageProgressPercent.toFixed(0)}% avg progress
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {template.totalDataPointsCollected} data points
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Journeys Started Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.journeysStarted}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Step Completions Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.stepCompletions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                      />
                      <Bar dataKey="value" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.engagementScores}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "Engagement"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Submissions Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends.dataSubmissions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => format(new Date(v), "MMM d")}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                      />
                      <Bar dataKey="value" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  Feedback Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold">
                      {feedbackSummary.averageRating.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">Average Rating (1-5)</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Based on {feedbackSummary.totalFeedbackSubmissions} check-ins
                    </div>
                  </div>

                  <div className="space-y-2">
                    {feedbackSummary.ratingDistribution.map((item) => (
                      <div key={item.rating} className="flex items-center gap-2">
                        <span className="w-8 text-sm">{item.rating} star</span>
                        <Progress
                          value={
                            feedbackSummary.totalFeedbackSubmissions > 0
                              ? (item.count / feedbackSummary.totalFeedbackSubmissions) * 100
                              : 0
                          }
                          className="flex-1"
                        />
                        <span className="w-8 text-sm text-right">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Common Themes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedbackSummary.commonChallenges.length === 0 &&
                feedbackSummary.commonQuestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No feedback themes available yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedbackSummary.commonChallenges.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                          Common Challenges
                        </h4>
                        <ul className="space-y-1">
                          {feedbackSummary.commonChallenges.map((c, i) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-center justify-between"
                            >
                              <span className="truncate">{c.challenge}</span>
                              <Badge variant="outline" className="ml-2 shrink-0">
                                {c.count}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {feedbackSummary.commonQuestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3 text-blue-500" />
                          Common Questions
                        </h4>
                        <ul className="space-y-1">
                          {feedbackSummary.commonQuestions.map((q, i) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-center justify-between"
                            >
                              <span className="truncate">{q.question}</span>
                              <Badge variant="outline" className="ml-2 shrink-0">
                                {q.count}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-green-500" />
                  Data Quality Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold">{dataQuality.overallScore.toFixed(0)}</div>
                  <div className="text-sm text-muted-foreground">Overall Score</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Completeness</span>
                      <span>{dataQuality.completenessScore.toFixed(0)}%</span>
                    </div>
                    <Progress value={dataQuality.completenessScore} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Accuracy</span>
                      <span>{dataQuality.accuracyScore.toFixed(0)}%</span>
                    </div>
                    <Progress value={dataQuality.accuracyScore} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Timeliness</span>
                      <span>{dataQuality.timelinessScore.toFixed(0)}%</span>
                    </div>
                    <Progress value={dataQuality.timelinessScore} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Consistency</span>
                      <span>{dataQuality.consistencyScore.toFixed(0)}%</span>
                    </div>
                    <Progress value={dataQuality.consistencyScore} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Issues Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold">{dataQuality.issuesDetected}</div>
                  <div className="text-sm text-muted-foreground">
                    Issues across {dataQuality.totalRecordsAnalyzed} records
                  </div>
                </div>

                {dataQuality.issuesByCategory.length === 0 ? (
                  <div className="flex flex-col items-center py-4">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
                    <p className="text-sm text-muted-foreground">No issues detected</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dataQuality.issuesByCategory.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle
                            className={`h-4 w-4 ${
                              issue.severity === "high"
                                ? "text-red-500"
                                : issue.severity === "medium"
                                  ? "text-amber-500"
                                  : "text-blue-500"
                            }`}
                          />
                          <span className="text-sm">{issue.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              issue.severity === "high"
                                ? "border-red-500 text-red-500"
                                : issue.severity === "medium"
                                  ? "border-amber-500 text-amber-500"
                                  : "border-blue-500 text-blue-500"
                            }
                          >
                            {issue.severity}
                          </Badge>
                          <span className="font-medium">{issue.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-muted-foreground">
              Data generated: {format(new Date(dashboard.generatedAt), "MMM d, yyyy h:mm a")}
            </span>
            <Link href="/health-journeys">
              <Button variant="ghost" size="sm" data-testid="button-view-journeys">
                View Health Journeys <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
