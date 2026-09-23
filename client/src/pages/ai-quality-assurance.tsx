import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  AlertTriangle,
  CheckCircle,
  Brain,
  TrendingUp,
  Lightbulb,
  Target,
  Zap,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  GraduationCap,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type QualityIssueSeverity = "critical" | "high" | "medium" | "low";
type QualityIssueStatus = "detected" | "pending_review" | "correction_suggested" | "auto_corrected" | "manually_corrected" | "dismissed" | "escalated";
type CorrectionOutcome = "accepted" | "modified" | "rejected" | "dismissed";

interface FHIRQualityIssue {
  id: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  issueType: string;
  severity: QualityIssueSeverity;
  title: string;
  description: string;
  fieldPath?: string;
  currentValue?: unknown;
  expectedValue?: unknown;
  suggestedCorrection?: { id: string; suggestedValue: unknown; confidence: number; reasoning: string };
  aiAnalysis?: string;
  status: QualityIssueStatus;
  detectedAt: string;
  detectedBy: string;
}

interface LearningPattern {
  id: string;
  patternSignature: string;
  patternType: string;
  resourceType: string;
  issueType: string;
  fieldPath?: string;
  description: string;
  occurrences: number;
  acceptanceRate: number;
  averageConfidence: number;
  lastSeenAt: string;
  aiInsight?: string;
  confidenceAdjustment: number;
}

interface LearningInsights {
  totalFeedback: number;
  acceptanceRate: number;
  rejectionRate: number;
  modificationRate: number;
  topPatterns: LearningPattern[];
  confidenceCalibration: { original: number; calibrated: number; improvement: number };
  learningCurve: Array<{ date: string; accuracy: number; feedbackCount: number }>;
  recommendations: string[];
}

interface QualityMetrics {
  totalIssues: number;
  openIssues: number;
  correctedIssues: number;
  dismissedIssues: number;
  avgResolutionTimeHours: number;
  issuesByResourceType: Record<string, number>;
  issuesBySeverity: Record<QualityIssueSeverity, number>;
  issuesByType: Record<string, number>;
  trendData: Array<{ date: string; detected: number; resolved: number }>;
  complianceScore: number;
}

const severityColors: Record<QualityIssueSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

const CHART_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];

export default function AIQualityAssurance() {
  const { toast } = useToast();
  const [selectedIssue, setSelectedIssue] = useState<FHIRQualityIssue | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackOutcome, setFeedbackOutcome] = useState<CorrectionOutcome>("accepted");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: metricsData, isLoading: metricsLoading } = useQuery<{ success: boolean; metrics: QualityMetrics }>({
    queryKey: ["/api/fhir-quality/metrics"],
  });

  const { data: issuesData, isLoading: issuesLoading } = useQuery<{ success: boolean; issues: FHIRQualityIssue[]; total: number }>({
    queryKey: ["/api/fhir-quality/issues", statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const response = await fetch(`/api/fhir-quality/issues?${params}`);
      if (!response.ok) throw new Error("Failed to fetch issues");
      return response.json();
    },
  });

  const { data: learningInsightsData, isLoading: insightsLoading } = useQuery<{ success: boolean; insights: LearningInsights }>({
    queryKey: ["/api/fhir-quality/learning/insights"],
  });

  const { data: patternsData } = useQuery<{ success: boolean; patterns: LearningPattern[]; total: number }>({
    queryKey: ["/api/fhir-quality/learning/patterns"],
  });

  const { data: anomalyData } = useQuery<{ success: boolean; anomalyInsights: string[]; emergingPatterns: LearningPattern[]; confidenceImprovements: Array<{ pattern: string; before: number; after: number }> }>({
    queryKey: ["/api/fhir-quality/learning/anomaly-analysis"],
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ issueId, outcome, appliedCorrection, userModification }: { issueId: string; outcome: CorrectionOutcome; appliedCorrection: unknown; userModification?: string }) => {
      return apiRequest("POST", "/api/fhir-quality/learning/feedback", {
        issueId,
        outcome,
        appliedCorrection,
        userModification,
      });
    },
    onSuccess: () => {
      toast({ title: "Feedback Recorded", description: "Your feedback has been saved and will improve future detection." });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-quality/learning/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-quality/learning/patterns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-quality/issues"] });
      setFeedbackDialogOpen(false);
      setSelectedIssue(null);
      setFeedbackNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record feedback. Please try again.", variant: "destructive" });
    },
  });

  const handleFeedback = () => {
    if (!selectedIssue) return;
    feedbackMutation.mutate({
      issueId: selectedIssue.id,
      outcome: feedbackOutcome,
      appliedCorrection: selectedIssue.suggestedCorrection?.suggestedValue || null,
      userModification: feedbackNotes || undefined,
    });
  };

  const metrics = metricsData?.metrics;
  const insights = learningInsightsData?.insights;
  const issues = issuesData?.issues || [];
  const patterns = patternsData?.patterns || [];

  const pieData = metrics ? Object.entries(metrics.issuesBySeverity).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <Brain className="w-8 h-8 text-primary" />
              AI Quality Assurance
            </h1>
            <p className="text-muted-foreground mt-1">
              Intelligent FHIR data quality monitoring with adaptive learning
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            Learning Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="card-open-issues">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-open-issues">{metrics?.openIssues || 0}</div>
              <p className="text-xs text-muted-foreground">of {metrics?.totalIssues || 0} total</p>
            </CardContent>
          </Card>

          <Card data-testid="card-compliance-score">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
              <Target className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-compliance-score">{metrics?.complianceScore || 0}%</div>
              <Progress value={metrics?.complianceScore || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-acceptance-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">AI Acceptance Rate</CardTitle>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-acceptance-rate">{insights?.acceptanceRate || 0}%</div>
              <p className="text-xs text-muted-foreground">{insights?.totalFeedback || 0} corrections reviewed</p>
            </CardContent>
          </Card>

          <Card data-testid="card-confidence-improvement">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Confidence Improvement</CardTitle>
              <Zap className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="text-confidence-improvement">
                  {(insights?.confidenceCalibration?.improvement || 0) > 0 ? "+" : ""}{insights?.confidenceCalibration?.improvement || 0}%
                </span>
                {(insights?.confidenceCalibration?.improvement || 0) > 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">From learning patterns</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="issues" className="space-y-4">
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="issues" data-testid="tab-issues">Quality Issues</TabsTrigger>
            <TabsTrigger value="learning" data-testid="tab-learning">Learning Insights</TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">Detected Patterns</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="issues">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Quality Issues</CardTitle>
                    <CardDescription>Review and provide feedback on detected issues</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger className="w-32" data-testid="select-severity">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36" data-testid="select-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="detected">Detected</SelectItem>
                        <SelectItem value="pending_review">Pending Review</SelectItem>
                        <SelectItem value="correction_suggested">Suggested</SelectItem>
                        <SelectItem value="manually_corrected">Corrected</SelectItem>
                        <SelectItem value="dismissed">Dismissed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {issuesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : issues.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p>No issues found matching your filters</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {issues.map((issue) => (
                        <div
                          key={issue.id}
                          className="p-4 border rounded-lg hover-elevate cursor-pointer"
                          {...clickable(() => {
                            setSelectedIssue(issue);
                            setFeedbackDialogOpen(true);
                          })}
                          data-testid={`card-issue-${issue.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium" data-testid={`text-issue-title-${issue.id}`}>{issue.title}</span>
                                <Badge className={severityColors[issue.severity]} data-testid={`badge-severity-${issue.id}`}>
                                  {issue.severity}
                                </Badge>
                                <Badge variant="outline" data-testid={`badge-status-${issue.id}`}>
                                  {issue.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`text-issue-desc-${issue.id}`}>{issue.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>{issue.resourceType}</span>
                                <span>{issue.issueType.replace("_", " ")}</span>
                                <span>{new Date(issue.detectedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {issue.suggestedCorrection && (
                              <div className="flex items-center gap-1 text-sm">
                                <Lightbulb className="w-4 h-4 text-yellow-500" />
                                <span className="text-muted-foreground">{Math.round(issue.suggestedCorrection.confidence * 100)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learning">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Learning Curve
                  </CardTitle>
                  <CardDescription>AI accuracy improvement over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {insights?.learningCurve && insights.learningCurve.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={insights.learningCurve}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="accuracy" stroke="#22c55e" strokeWidth={2} name="Accuracy %" />
                        <Line type="monotone" dataKey="feedbackCount" stroke="#3b82f6" strokeWidth={2} name="Feedback Count" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Collecting learning data...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    AI Recommendations
                  </CardTitle>
                  <CardDescription>Suggestions based on learned patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights?.recommendations?.map((rec, i) => (
                      <div key={i} className="p-3 bg-muted rounded-lg" data-testid={`card-recommendation-${i}`}>
                        <p className="text-sm" data-testid={`text-recommendation-${i}`}>{rec}</p>
                      </div>
                    )) || (
                      <p className="text-muted-foreground text-center py-4">No recommendations yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Confidence Calibration</CardTitle>
                  <CardDescription>How the system adjusts its confidence based on feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold" data-testid="text-original-confidence">{insights?.confidenceCalibration?.original || 0}%</p>
                      <p className="text-xs text-muted-foreground">Original</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-green-600" data-testid="text-calibrated-confidence">{insights?.confidenceCalibration?.calibrated || 0}%</p>
                      <p className="text-xs text-muted-foreground">Calibrated</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {(insights?.confidenceCalibration?.improvement || 0) > 0 ? "+" : ""}{insights?.confidenceCalibration?.improvement || 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Improvement</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Distribution</CardTitle>
                  <CardDescription>How users respond to AI suggestions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Accepted</span>
                      <div className="flex items-center gap-2">
                        <Progress value={insights?.acceptanceRate || 0} className="w-32" />
                        <span className="text-sm font-medium w-12" data-testid="text-acceptance-pct">{insights?.acceptanceRate || 0}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Modified</span>
                      <div className="flex items-center gap-2">
                        <Progress value={insights?.modificationRate || 0} className="w-32" />
                        <span className="text-sm font-medium w-12" data-testid="text-modification-pct">{insights?.modificationRate || 0}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rejected</span>
                      <div className="flex items-center gap-2">
                        <Progress value={insights?.rejectionRate || 0} className="w-32" />
                        <span className="text-sm font-medium w-12" data-testid="text-rejection-pct">{insights?.rejectionRate || 0}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="patterns">
            <Card>
              <CardHeader>
                <CardTitle>Learned Patterns</CardTitle>
                <CardDescription>Patterns detected from correction feedback history</CardDescription>
              </CardHeader>
              <CardContent>
                {patterns.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No patterns learned yet. Provide feedback on issues to start learning.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patterns.map((pattern) => (
                      <div key={pattern.id} className="p-4 border rounded-lg" data-testid={`card-pattern-${pattern.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium" data-testid={`text-pattern-type-${pattern.id}`}>{pattern.patternType.replace("_", " ")}</span>
                              <Badge variant="outline">{pattern.resourceType}</Badge>
                              <Badge variant="secondary">{pattern.issueType.replace("_", " ")}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2" data-testid={`text-pattern-desc-${pattern.id}`}>{pattern.description}</p>
                            {pattern.aiInsight && (
                              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-700 dark:text-blue-300" data-testid={`text-pattern-insight-${pattern.id}`}>
                                <Lightbulb className="w-4 h-4 inline mr-1" />
                                {pattern.aiInsight}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold" data-testid={`text-pattern-occurrences-${pattern.id}`}>{pattern.occurrences}</div>
                            <p className="text-xs text-muted-foreground">occurrences</p>
                            <div className="mt-2">
                              <Badge className={pattern.acceptanceRate >= 70 ? "bg-green-500" : pattern.acceptanceRate >= 40 ? "bg-yellow-500" : "bg-red-500"}>
                                {pattern.acceptanceRate}% accepted
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Issue Trend</CardTitle>
                  <CardDescription>Detection vs resolution over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {metrics?.trendData && metrics.trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={metrics.trendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="detected" fill="#ef4444" name="Detected" />
                        <Bar dataKey="resolved" fill="#22c55e" name="Resolved" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">No trend data available</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Issues by Severity</CardTitle>
                  <CardDescription>Distribution of issue severity levels</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">No severity data available</div>
                  )}
                </CardContent>
              </Card>

              {anomalyData?.emergingPatterns && anomalyData.emergingPatterns.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-orange-500" />
                      Emerging Patterns
                    </CardTitle>
                    <CardDescription>New patterns detected this week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {anomalyData.emergingPatterns.map((pattern) => (
                        <div key={pattern.id} className="p-3 border rounded-lg" data-testid={`card-emerging-${pattern.id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-orange-500" />
                            <span className="font-medium text-sm">{pattern.resourceType}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{pattern.issueType.replace("_", " ")}</p>
                          <p className="text-sm mt-1">{pattern.occurrences} occurrences</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {anomalyData?.anomalyInsights && anomalyData.anomalyInsights.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Anomaly Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {anomalyData.anomalyInsights.map((insight, i) => (
                        <div key={i} className="p-3 bg-muted rounded-lg" data-testid={`card-anomaly-insight-${i}`}>
                          <p className="text-sm" data-testid={`text-anomaly-insight-${i}`}>{insight}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Provide Correction Feedback</DialogTitle>
              <DialogDescription>
                Your feedback helps improve AI detection accuracy
              </DialogDescription>
            </DialogHeader>
            {selectedIssue && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg" data-testid="dialog-issue-summary">
                  <p className="font-medium" data-testid="text-dialog-issue-title">{selectedIssue.title}</p>
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-dialog-issue-desc">{selectedIssue.description}</p>
                </div>

                {selectedIssue.suggestedCorrection && (
                  <div className="p-3 border rounded-lg" data-testid="dialog-ai-suggestion">
                    <p className="text-sm font-medium mb-1" data-testid="text-dialog-suggestion-confidence">AI Suggestion ({Math.round(selectedIssue.suggestedCorrection.confidence * 100)}% confidence):</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-dialog-suggestion-reasoning">{selectedIssue.suggestedCorrection.reasoning}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="feedback-outcome">Your Decision</Label>
                  <Select value={feedbackOutcome} onValueChange={(v) => setFeedbackOutcome(v as CorrectionOutcome)}>
                    <SelectTrigger id="feedback-outcome" data-testid="select-feedback-outcome">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accepted" data-testid="option-accepted">Accept suggestion as-is</SelectItem>
                      <SelectItem value="modified" data-testid="option-modified">Accept with modifications</SelectItem>
                      <SelectItem value="rejected" data-testid="option-rejected">Reject suggestion</SelectItem>
                      <SelectItem value="dismissed" data-testid="option-dismissed">Dismiss issue entirely</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(feedbackOutcome === "modified" || feedbackOutcome === "rejected") && (
                  <div className="space-y-2">
                    <Label htmlFor="ai-quality-assurance-notes-optional">Notes (optional)</Label>
                    <Textarea id="ai-quality-assurance-notes-optional"
                      value={feedbackNotes}
                      onChange={(e) => setFeedbackNotes(e.target.value)}
                      placeholder="Describe why you modified or rejected the suggestion..."
                      data-testid="textarea-feedback-notes"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)} data-testid="button-cancel-feedback">
                Cancel
              </Button>
              <Button onClick={handleFeedback} disabled={feedbackMutation.isPending} data-testid="button-submit-feedback">
                {feedbackMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
