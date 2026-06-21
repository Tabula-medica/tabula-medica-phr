import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Heart,
  Shield,
  Activity,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  Info,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { ExplainInsightModal } from "@/components/explain-insight-modal";

interface HealthInsight {
  id: string;
  category: "trend" | "risk_awareness" | "lifestyle" | "preventive" | "monitoring";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  dataPoints: string[];
  suggestedAction: string;
  disclaimer: string;
  relatedConditions?: string[];
  generatedAt: string;
}

interface HealthInsightsResponse {
  patientName: string;
  generatedAt: string;
  insights: HealthInsight[];
  overallHealthStatus: string;
  nextSteps: string[];
}

const categoryConfig: Record<HealthInsight["category"], { label: string; icon: typeof TrendingUp; bgColor: string; textColor: string }> = {
  trend: {
    label: "Trend",
    icon: TrendingUp,
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-700 dark:text-blue-300",
  },
  risk_awareness: {
    label: "Awareness",
    icon: AlertCircle,
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-700 dark:text-amber-300",
  },
  lifestyle: {
    label: "Lifestyle",
    icon: Heart,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-300",
  },
  preventive: {
    label: "Preventive",
    icon: Shield,
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-700 dark:text-purple-300",
  },
  monitoring: {
    label: "Monitoring",
    icon: Activity,
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    textColor: "text-cyan-700 dark:text-cyan-300",
  },
};

const priorityConfig: Record<HealthInsight["priority"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  high: { label: "High Priority", variant: "default" },
  medium: { label: "Medium", variant: "secondary" },
  low: { label: "Low", variant: "outline" },
};

function InsightCard({ insight }: { insight: HealthInsight }) {
  const category = categoryConfig[insight.category];
  const priority = priorityConfig[insight.priority];
  const Icon = category.icon;

  return (
    <AccordionItem
      value={insight.id}
      className="border rounded-lg mb-3 overflow-visible"
      data-testid={`insight-card-${insight.id}`}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover-elevate rounded-t-lg">
        <div className="flex items-start gap-3 w-full text-left">
          <div className={`p-2 rounded-md ${category.bgColor}`}>
            <Icon className={`h-4 w-4 ${category.textColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid={`insight-title-${insight.id}`}>
                {insight.title}
              </span>
              <Badge variant={priority.variant} className="text-xs">
                {priority.label}
              </Badge>
              <Badge variant="outline" className={`text-xs ${category.textColor}`}>
                {category.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {insight.description.slice(0, 100)}...
            </p>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" data-testid={`insight-description-${insight.id}`}>
            {insight.description}
          </p>

          {insight.dataPoints.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Supporting Data
              </h5>
              <ul className="space-y-1 bg-muted/50 rounded-md p-3">
                {insight.dataPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.relatedConditions && insight.relatedConditions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Related to:</span>
              {insight.relatedConditions.map((condition, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {condition}
                </Badge>
              ))}
            </div>
          )}

          <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <h5 className="text-sm font-medium flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Suggested Next Step
            </h5>
            <p className="text-sm" data-testid={`insight-action-${insight.id}`}>
              {insight.suggestedAction}
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span data-testid={`insight-disclaimer-${insight.id}`}>{insight.disclaimer}</span>
          </div>

          <div className="pt-2 border-t">
            <ExplainInsightModal
              insight={insight.description}
              dataSources={insight.dataPoints.map((point, idx) => ({
                source: "Health Record",
                dataType: insight.category === "trend" ? "Trend Data" : 
                          insight.category === "lifestyle" ? "Lifestyle Data" :
                          insight.category === "preventive" ? "Preventive Care" : "Clinical Data",
                excerpt: point,
              }))}
              derivationSteps={[
                "Your health records were securely analyzed",
                `Data points from ${insight.dataPoints.length} sources were identified`,
                "The AI identified patterns in your health data",
                "This observation was generated with supporting citations",
              ]}
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function HealthInsights() {
  const { data: insights, isLoading, refetch, isFetching } = useQuery<HealthInsightsResponse>({
    queryKey: ["/api/health-insights"],
    queryFn: async () => {
      const response = await fetch("/api/health-insights");
      if (!response.ok) throw new Error("Failed to fetch health insights");
      return response.json();
    },
  });

  return (
    <Card className="w-full" data-testid="health-insights-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Personalized Health Insights
            </CardTitle>
            <CardDescription>
              AI-powered observations based on your health data
            </CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh health insights"
          data-testid="button-refresh-insights"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <InsightsSkeleton />
        ) : insights ? (
          <div className="space-y-6">
            <div className="space-y-3 p-4 rounded-lg bg-muted/50" data-testid="insights-overview">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Overview
              </h3>
              <p className="text-sm leading-relaxed" data-testid="insights-status">
                {insights.overallHealthStatus}
              </p>

              {insights.nextSteps.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-medium">Recommended Actions</h4>
                  <ul className="space-y-1">
                    {insights.nextSteps.map((step, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        data-testid={`next-step-${idx}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <ScrollArea className="h-[450px] pr-4">
              <Accordion type="multiple" className="space-y-0" data-testid="insights-list">
                {insights.insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </Accordion>
            </ScrollArea>

            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                These insights are generated by AI based on your health data and are intended for
                informational purposes only. They do not constitute medical advice. Always consult
                with your healthcare provider for personalized medical guidance.
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No health insights available at this time.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
