import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ThumbsUp, 
  ThumbsDown,
  Star,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Target,
  Lightbulb,
  Brain,
  ArrowRight,
  MessageCircle,
  Clock
} from "lucide-react";

interface PatientFeedback {
  id: string;
  patientId?: string;
  source: string;
  type: string;
  content: string;
  rating?: number;
  date: string;
  providerName?: string;
  departmentName?: string;
  analyzed?: boolean;
}

interface SentimentResult {
  score: number;
  label: string;
  confidence: number;
  emotionalTone: string[];
}

interface ThemeResult {
  theme: string;
  category: string;
  frequency: number;
  sentiment: string;
  examples: string[];
  priority: string;
}

interface ImprovementArea {
  id: string;
  area: string;
  category: string;
  priority: string;
  currentScore: number;
  targetScore: number;
  feedbackCount: number;
  recommendations: string[];
  estimatedImpact: string;
  relatedThemes: string[];
}

interface AnalyticsSummary {
  periodStart: string;
  periodEnd: string;
  totalFeedback: number;
  averageSentiment: number;
  sentimentDistribution: {
    veryPositive: number;
    positive: number;
    neutral: number;
    negative: number;
    veryNegative: number;
  };
  topThemes: ThemeResult[];
  improvementAreas: ImprovementArea[];
  trendingIssues: { issue: string; trend: string; changePercent: number }[];
  satisfactionScore: number;
  responseRate: number;
}

interface FeedbackAnalysis {
  id: string;
  feedbackId: string;
  sentiment: SentimentResult;
  themes: string[];
  keyPhrases: string[];
  intent: string;
  actionRequired: boolean;
  urgency: string;
  suggestedResponse?: string;
  analyzedAt: string;
}

export default function PatientFeedbackAnalytics() {
  const { toast } = useToast();

  const { data: summaryData, isLoading: summaryLoading } = useQuery<{ success: boolean; data: AnalyticsSummary }>({
    queryKey: ["/api/feedback-analysis/summary"]
  });

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery<{ success: boolean; data: PatientFeedback[] }>({
    queryKey: ["/api/feedback-analysis/feedback"]
  });

  const { data: themesData, isLoading: themesLoading } = useQuery<{ success: boolean; data: ThemeResult[] }>({
    queryKey: ["/api/feedback-analysis/themes"]
  });

  const { data: improvementsData, isLoading: improvementsLoading } = useQuery<{ success: boolean; data: ImprovementArea[] }>({
    queryKey: ["/api/feedback-analysis/improvements"]
  });

  const analyzeMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      return apiRequest("POST", `/api/feedback-analysis/feedback/${feedbackId}/analyze`);
    },
    onSuccess: () => {
      toast({ title: "Feedback analyzed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback-analysis"] });
    },
    onError: () => {
      toast({ title: "Failed to analyze feedback", variant: "destructive" });
    }
  });

  const summary = summaryData?.data;
  const feedback = feedbackData?.data || [];
  const themes = themesData?.data || [];
  const improvements = improvementsData?.data || [];

  const getSentimentColor = (label: string) => {
    switch (label) {
      case "very_positive": return "text-green-600";
      case "positive": return "text-green-500";
      case "neutral": return "text-gray-500";
      case "negative": return "text-orange-500";
      case "very_negative": return "text-red-600";
      default: return "text-gray-500";
    }
  };

  const getSentimentIcon = (label: string) => {
    switch (label) {
      case "very_positive":
      case "positive":
        return <ThumbsUp className="h-4 w-4" />;
      case "negative":
      case "very_negative":
        return <ThumbsDown className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising": return <TrendingUp className="h-4 w-4 text-red-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-green-500" />;
      default: return <ArrowRight className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} 
      />
    ));
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8 text-primary" />
          Patient Feedback Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered analysis of patient feedback to identify themes, sentiment, and improvement opportunities
        </p>
      </div>

      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>AI Insights Disclaimer:</strong> Analysis results are generated by AI for informational purposes only. All findings should be reviewed by appropriate staff before taking action.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
          <TabsTrigger value="themes" data-testid="tab-themes">Themes</TabsTrigger>
          <TabsTrigger value="improvements" data-testid="tab-improvements">Improvements</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {summaryLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : summary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="card-total-feedback">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Feedback</p>
                        <p className="text-3xl font-bold">{summary.totalFeedback}</p>
                      </div>
                      <MessageCircle className="h-10 w-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-satisfaction-score">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Satisfaction Score</p>
                        <p className="text-3xl font-bold">{summary.satisfactionScore.toFixed(1)}/5</p>
                      </div>
                      <Star className="h-10 w-10 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-sentiment">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Average Sentiment</p>
                        <p className={`text-3xl font-bold ${summary.averageSentiment > 0 ? "text-green-600" : summary.averageSentiment < 0 ? "text-red-600" : ""}`}>
                          {summary.averageSentiment > 0 ? "+" : ""}{(summary.averageSentiment * 100).toFixed(0)}%
                        </p>
                      </div>
                      {summary.averageSentiment > 0 ? (
                        <ThumbsUp className="h-10 w-10 text-green-500" />
                      ) : (
                        <ThumbsDown className="h-10 w-10 text-red-500" />
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-response-rate">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Response Rate</p>
                        <p className="text-3xl font-bold">{(summary.responseRate * 100).toFixed(0)}%</p>
                      </div>
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Sentiment Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm">Very Positive</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-green-600" 
                            style={{ width: `${(summary.sentimentDistribution.veryPositive / summary.totalFeedback) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{summary.sentimentDistribution.veryPositive}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm">Positive</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-green-400" 
                            style={{ width: `${(summary.sentimentDistribution.positive / summary.totalFeedback) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{summary.sentimentDistribution.positive}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm">Neutral</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-gray-400" 
                            style={{ width: `${(summary.sentimentDistribution.neutral / summary.totalFeedback) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{summary.sentimentDistribution.neutral}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm">Negative</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-orange-400" 
                            style={{ width: `${(summary.sentimentDistribution.negative / summary.totalFeedback) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{summary.sentimentDistribution.negative}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm">Very Negative</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-red-500" 
                            style={{ width: `${(summary.sentimentDistribution.veryNegative / summary.totalFeedback) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{summary.sentimentDistribution.veryNegative}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      Trending Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.trendingIssues.map((issue, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            {getTrendIcon(issue.trend)}
                            <span className="font-medium">{issue.issue}</span>
                          </div>
                          <Badge variant={issue.trend === "rising" ? "destructive" : issue.trend === "declining" ? "default" : "secondary"}>
                            {issue.changePercent > 0 ? "+" : ""}{issue.changePercent}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Top Themes
                  </CardTitle>
                  <CardDescription>Most frequently mentioned topics in patient feedback</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summary.topThemes.slice(0, 6).map((theme, index) => (
                      <div key={index} className="p-4 rounded-lg border bg-card" data-testid={`card-theme-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{theme.theme}</span>
                          {getPriorityBadge(theme.priority)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{theme.frequency} mentions</span>
                          <span>•</span>
                          <span className={theme.sentiment === "positive" ? "text-green-600" : theme.sentiment === "negative" ? "text-red-600" : ""}>
                            {theme.sentiment}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{theme.category}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Patient Feedback</CardTitle>
              <CardDescription>View and analyze individual feedback submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {feedbackLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {feedback.map((fb) => (
                      <div key={fb.id} className="p-4 rounded-lg border bg-card" data-testid={`card-feedback-${fb.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="outline" className="capitalize">{fb.source}</Badge>
                              <Badge variant="secondary" className="capitalize">{fb.type}</Badge>
                              {fb.departmentName && <Badge variant="outline">{fb.departmentName}</Badge>}
                              {fb.providerName && <Badge variant="outline">{fb.providerName}</Badge>}
                            </div>
                            <p className="text-sm mb-3">{fb.content}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {fb.rating && (
                                <div className="flex items-center gap-1">
                                  {getRatingStars(fb.rating)}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(fb.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => analyzeMutation.mutate(fb.id)}
                            disabled={analyzeMutation.isPending || fb.analyzed}
                            data-testid={`button-analyze-${fb.id}`}
                          >
                            {fb.analyzed ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Analyzed
                              </>
                            ) : (
                              <>
                                <Brain className="h-4 w-4 mr-1" />
                                Analyze
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="themes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Theme Analysis
              </CardTitle>
              <CardDescription>Common themes identified across all patient feedback</CardDescription>
            </CardHeader>
            <CardContent>
              {themesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {themes.map((theme, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-card" data-testid={`card-theme-detail-${index}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-lg capitalize">{theme.theme}</h4>
                          <p className="text-sm text-muted-foreground">{theme.category}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(theme.priority)}
                          <Badge variant={theme.sentiment === "positive" ? "default" : theme.sentiment === "negative" ? "destructive" : "secondary"}>
                            {theme.sentiment}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Frequency:</span>{" "}
                          <span className="font-medium">{theme.frequency} mentions</span>
                        </div>
                      </div>
                      {theme.examples.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-2">Example Feedback:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {theme.examples.map((example, i) => (
                              <li key={i} className="italic">"{example}"</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="improvements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Improvement Opportunities
              </CardTitle>
              <CardDescription>AI-identified areas for service improvement based on feedback analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {improvementsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
                </div>
              ) : improvements.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Critical Improvements Needed</h3>
                  <p className="text-muted-foreground">Feedback analysis indicates generally positive sentiment across all areas.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {improvements.map((improvement) => (
                    <div key={improvement.id} className="p-6 rounded-lg border bg-card" data-testid={`card-improvement-${improvement.id}`}>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-xl font-medium capitalize">{improvement.area}</h4>
                          <p className="text-sm text-muted-foreground">{improvement.category}</p>
                        </div>
                        {getPriorityBadge(improvement.priority)}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold">{improvement.currentScore.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Current Score</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold text-green-600">{improvement.targetScore.toFixed(1)}</p>
                          <p className="text-xs text-muted-foreground">Target Score</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                          <p className="text-2xl font-bold">{improvement.feedbackCount}</p>
                          <p className="text-xs text-muted-foreground">Related Feedback</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-medium mb-1">Estimated Impact</p>
                        <p className="text-sm text-muted-foreground">{improvement.estimatedImpact}</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          Recommendations
                        </p>
                        <ul className="space-y-2">
                          {improvement.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {improvement.relatedThemes.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Related themes: {improvement.relatedThemes.join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Issue Trends
                </CardTitle>
                <CardDescription>How key issues are trending over time</CardDescription>
              </CardHeader>
              <CardContent>
                {summary?.trendingIssues ? (
                  <div className="space-y-4">
                    {summary.trendingIssues.map((issue, index) => (
                      <div key={index} className="p-4 rounded-lg border bg-card" data-testid={`card-trend-${index}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getTrendIcon(issue.trend)}
                            <div>
                              <p className="font-medium">{issue.issue}</p>
                              <p className="text-sm text-muted-foreground capitalize">{issue.trend}</p>
                            </div>
                          </div>
                          <div className={`text-xl font-bold ${issue.changePercent > 0 ? "text-red-500" : issue.changePercent < 0 ? "text-green-500" : ""}`}>
                            {issue.changePercent > 0 ? "+" : ""}{issue.changePercent}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Category Breakdown
                </CardTitle>
                <CardDescription>Feedback by category</CardDescription>
              </CardHeader>
              <CardContent>
                {themes.length > 0 ? (
                  <div className="space-y-3">
                    {Array.from(new Set(themes.map(t => t.category))).map((category, index) => {
                      const categoryThemes = themes.filter(t => t.category === category);
                      const totalMentions = categoryThemes.reduce((sum, t) => sum + t.frequency, 0);
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <span className="w-32 text-sm truncate">{category}</span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${Math.min((totalMentions / feedback.length) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{totalMentions}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How AI Feedback Analysis Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <MessageSquare className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">1. Collect Feedback</h4>
                  <p className="text-sm text-muted-foreground">
                    Patient feedback from surveys, messages, portal submissions, and calls is aggregated.
                  </p>
                </div>
                <div className="text-center p-4">
                  <Brain className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">2. AI Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Natural language processing identifies sentiment, themes, and key phrases in each submission.
                  </p>
                </div>
                <div className="text-center p-4">
                  <Target className="h-12 w-12 text-primary mx-auto mb-3" />
                  <h4 className="font-medium mb-2">3. Actionable Insights</h4>
                  <p className="text-sm text-muted-foreground">
                    Improvement areas are prioritized with specific recommendations for service enhancement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
