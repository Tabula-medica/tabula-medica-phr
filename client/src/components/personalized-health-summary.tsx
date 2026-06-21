import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Pill,
  TestTube,
  Stethoscope,
  MessageCircle,
  Clock,
  Heart,
  RefreshCw,
  ChevronRight,
  Activity,
  Info,
} from "lucide-react";

interface WhatsNewItem {
  category: "condition" | "medication" | "lab" | "encounter";
  title: string;
  description: string;
  date: string;
  significance: "high" | "medium" | "low";
}

interface KeyTrend {
  metric: string;
  direction: "improving" | "worsening" | "stable" | "new";
  description: string;
  timeframe: string;
  dataPoints?: { date: string; value: string }[];
  significance: "positive" | "attention" | "neutral";
}

interface NextStep {
  title: string;
  description: string;
  category: "question" | "followup" | "monitoring" | "lifestyle";
  priority: "high" | "medium" | "low";
  suggestedTimeframe?: string;
}

interface PersonalizedHealthSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overviewNarrative: string;
  progressHighlight: string;
  whatsNew: WhatsNewItem[];
  keyTrends: KeyTrend[];
  nextSteps: NextStep[];
  attentionAreas: string[];
  positiveProgress: string[];
  disclaimer: string;
  viewMode: "patient" | "provider";
}

interface PersonalizedHealthSummaryProps {
  patientId: string;
  viewMode?: "patient" | "provider";
  compact?: boolean;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "condition": return <Activity className="w-4 h-4" />;
    case "medication": return <Pill className="w-4 h-4" />;
    case "lab": return <TestTube className="w-4 h-4" />;
    case "encounter": return <Stethoscope className="w-4 h-4" />;
    case "question": return <MessageCircle className="w-4 h-4" />;
    case "followup": return <Calendar className="w-4 h-4" />;
    case "monitoring": return <Activity className="w-4 h-4" />;
    case "lifestyle": return <Heart className="w-4 h-4" />;
    default: return <Info className="w-4 h-4" />;
  }
}

function getTrendIcon(direction: string) {
  switch (direction) {
    case "improving": return <TrendingUp className="w-4 h-4 text-green-500" />;
    case "worsening": return <TrendingDown className="w-4 h-4 text-red-500" />;
    case "stable": return <Minus className="w-4 h-4 text-muted-foreground" />;
    default: return <Sparkles className="w-4 h-4 text-blue-500" />;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PersonalizedHealthSummaryView({ patientId, viewMode = "patient", compact = false }: PersonalizedHealthSummaryProps) {
  const [activeTab, setActiveTab] = useState("whats-new");

  const { data: summary, isLoading, refetch, isFetching } = useQuery<PersonalizedHealthSummary>({
    queryKey: ["/api/personalized-health-summary/summary", patientId, viewMode],
    queryFn: () => fetch(`/api/personalized-health-summary/summary/${patientId}?viewMode=${viewMode}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <Card data-testid="loading-health-summary">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>Unable to generate health summary. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card data-testid="compact-health-summary">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Your Health Summary
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-summary">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" data-testid="text-overview">{summary.overviewNarrative}</p>
          
          {summary.positiveProgress.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
              <p className="text-sm text-green-700 dark:text-green-400">{summary.positiveProgress[0]}</p>
            </div>
          )}

          {summary.attentionAreas.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{summary.attentionAreas[0]}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">{summary.disclaimer}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="personalized-health-summary">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Your Personalized Health Summary
              </CardTitle>
              <CardDescription>
                AI-generated summary based on your health records
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatDate(summary.generatedAt)}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh">
                <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg mb-4">
            <p className="text-base" data-testid="text-narrative">{summary.overviewNarrative}</p>
            {summary.progressHighlight && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {summary.progressHighlight}
              </p>
            )}
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              {summary.disclaimer}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whats-new" data-testid="tab-whats-new">
            What's New
            {summary.whatsNew.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{summary.whatsNew.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">
            Key Trends
            {summary.keyTrends.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{summary.keyTrends.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="next-steps" data-testid="tab-next-steps">
            Next Steps
            {summary.nextSteps.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{summary.nextSteps.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whats-new" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">What's New</CardTitle>
              <CardDescription>Recent changes and updates in your health records</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.whatsNew.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No new updates in the past 60 days.</p>
              ) : (
                <div className="space-y-3">
                  {summary.whatsNew.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`whats-new-item-${index}`}
                    >
                      <div className={`p-2 rounded-full ${
                        item.significance === "high" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        item.significance === "medium" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{item.title}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(item.date)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Key Trends</CardTitle>
              <CardDescription>How your health metrics are changing over time</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.keyTrends.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Not enough data to identify trends yet.</p>
              ) : (
                <div className="space-y-4">
                  {summary.keyTrends.map((trend, index) => (
                    <div key={index} className="border rounded-lg p-4" data-testid={`trend-item-${index}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(trend.direction)}
                          <span className="font-medium">{trend.metric}</span>
                        </div>
                        <Badge 
                          variant={trend.significance === "positive" ? "default" : trend.significance === "attention" ? "destructive" : "secondary"}
                          className="text-xs"
                        >
                          {trend.direction}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{trend.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{trend.timeframe}</p>
                      
                      {trend.dataPoints && trend.dataPoints.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {trend.dataPoints.map((point, i) => (
                              <div key={i} className="flex-shrink-0 text-center">
                                <p className="text-xs text-muted-foreground">{point.date}</p>
                                <p className="text-sm font-medium">{point.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(summary.positiveProgress.length > 0 || summary.attentionAreas.length > 0) && (
                <>
                  <Separator className="my-4" />
                  <div className="grid gap-3 md:grid-cols-2">
                    {summary.positiveProgress.length > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4" /> Positive Progress
                        </h4>
                        <ul className="space-y-1">
                          {summary.positiveProgress.map((item, i) => (
                            <li key={i} className="text-sm text-green-600 dark:text-green-400">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summary.attentionAreas.length > 0 && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4" /> Areas to Discuss
                        </h4>
                        <ul className="space-y-1">
                          {summary.attentionAreas.map((item, i) => (
                            <li key={i} className="text-sm text-amber-600 dark:text-amber-400">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="next-steps" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Next Steps</CardTitle>
              <CardDescription>Topics to discuss with your healthcare provider</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.nextSteps.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No specific action items at this time.</p>
              ) : (
                <div className="space-y-3">
                  {summary.nextSteps.map((step, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                      data-testid={`next-step-item-${index}`}
                    >
                      <div className={`p-2 rounded-full ${
                        step.priority === "high" ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        step.priority === "medium" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {getCategoryIcon(step.category)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{step.title}</p>
                          <Badge 
                            variant={step.priority === "high" ? "destructive" : step.priority === "medium" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {step.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                        {step.suggestedTimeframe && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {step.suggestedTimeframe}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              )}

              <Alert className="mt-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-sm text-blue-700 dark:text-blue-300">Preparing for Your Visit?</AlertTitle>
                <AlertDescription className="text-xs text-blue-600 dark:text-blue-400">
                  Use these topics as a starting point for conversations with your healthcare provider. They know your complete medical history and can provide personalized guidance.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
