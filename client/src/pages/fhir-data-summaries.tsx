import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronUp,
  FileText,
  FlaskConical,
  Heart,
  Info,
  Pill,
  RefreshCw,
  Sparkles,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";

type ViewType = "medications" | "conditions" | "labs" | "encounters" | "comprehensive";
type AudienceType = "patient" | "provider" | "caregiver";

interface TrendAnalysis {
  metric: string;
  trend: "improving" | "worsening" | "stable" | "fluctuating";
  direction?: "increasing" | "decreasing" | "unchanged";
  description: string;
  significance: "high" | "medium" | "low";
}

interface KeyHighlight {
  category: "attention" | "positive" | "informational" | "change";
  title: string;
  description: string;
  relatedData?: string[];
  priority: "high" | "medium" | "low";
}

interface SummarySection {
  title: string;
  content: string;
  dataType: string;
  itemCount: number;
}

interface DataViewSummary {
  id: string;
  patientId: string;
  viewType: ViewType;
  audience: AudienceType;
  generatedAt: string;
  naturalLanguageSummary: string;
  sections: SummarySection[];
  trends: TrendAnalysis[];
  highlights: KeyHighlight[];
  itemCount: number;
  disclaimer: string;
}

interface CrossDataInsight {
  title: string;
  description: string;
  relatedCategories: ViewType[];
  insight: string;
  significance: "high" | "medium" | "low";
}

interface ComprehensiveSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overallSummary: string;
  medicationsSummary: DataViewSummary | null;
  conditionsSummary: DataViewSummary | null;
  labsSummary: DataViewSummary | null;
  encountersSummary: DataViewSummary | null;
  crossDataInsights: CrossDataInsight[];
  longitudinalTrends: TrendAnalysis[];
  keyHighlights: KeyHighlight[];
  disclaimer: string;
}

const SAMPLE_PATIENT_ID = "patient-001";

export default function FHIRDataSummaries() {
  const { toast } = useToast();
  const [selectedView, setSelectedView] = useState<ViewType>("comprehensive");
  const [audience, setAudience] = useState<AudienceType>("patient");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data: summaryData, isLoading, refetch, isFetching } = useQuery<{ summary: DataViewSummary | ComprehensiveSummary }>({
    queryKey: [`/api/fhir-summarization/${selectedView}/${SAMPLE_PATIENT_ID}`, { audience }],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-summarization/summarize", {
        patientId: SAMPLE_PATIENT_ID,
        viewType: selectedView,
        audience,
        includeTrends: true,
        includeHighlights: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/fhir-summarization/${selectedView}/${SAMPLE_PATIENT_ID}`] });
      toast({ title: "Summary Refreshed", description: "AI summary has been regenerated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to refresh summary", variant: "destructive" });
    },
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const getViewIcon = (view: ViewType) => {
    switch (view) {
      case "medications": return <Pill className="h-4 w-4" />;
      case "conditions": return <Heart className="h-4 w-4" />;
      case "labs": return <FlaskConical className="h-4 w-4" />;
      case "encounters": return <Stethoscope className="h-4 w-4" />;
      case "comprehensive": return <Brain className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable": return <ArrowRight className="h-4 w-4 text-blue-500" />;
      case "fluctuating": return <Activity className="h-4 w-4 text-yellow-500" />;
      default: return <ArrowRight className="h-4 w-4" />;
    }
  };

  const getHighlightColor = (category: string) => {
    switch (category) {
      case "attention": return "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950";
      case "positive": return "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950";
      case "informational": return "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950";
      case "change": return "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950";
      default: return "";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="destructive">High Priority</Badge>;
      case "medium": return <Badge variant="secondary">Medium</Badge>;
      case "low": return <Badge variant="outline">Low</Badge>;
      default: return null;
    }
  };

  const renderDataViewSummary = (summary: DataViewSummary) => (
    <div className="space-y-6" data-testid="container-data-view-summary">
      <Card data-testid="card-ai-summary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI-Generated Summary</CardTitle>
            </div>
            <Badge variant="outline" data-testid="badge-item-count">
              {summary.itemCount} {summary.viewType === "medications" ? "medications" : 
                summary.viewType === "conditions" ? "conditions" :
                summary.viewType === "labs" ? "results" : "encounters"}
            </Badge>
          </div>
          <CardDescription data-testid="text-generated-info">
            Generated {new Date(summary.generatedAt).toLocaleString()} for {audience}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-natural-language-summary">
            {summary.naturalLanguageSummary}
          </p>
        </CardContent>
      </Card>

      {summary.sections.length > 0 && (
        <Card data-testid="card-details">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-testid="content-details">
            {summary.sections.map((section, idx) => (
              <div 
                key={idx} 
                className="border rounded-lg overflow-hidden"
              >
                <button
                  className="w-full p-3 flex items-center justify-between text-left hover-elevate"
                  onClick={() => toggleSection(`section-${idx}`)}
                  data-testid={`button-toggle-section-${idx}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{section.title}</span>
                    <Badge variant="outline" className="text-xs">{section.itemCount} items</Badge>
                  </div>
                  {expandedSections.has(`section-${idx}`) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.has(`section-${idx}`) && (
                  <div className="p-3 pt-0 border-t bg-muted/30">
                    <p className="text-sm text-muted-foreground">{section.content}</p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {summary.trends.length > 0 && (
        <Card data-testid="card-trends">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="content-trends">
              {summary.trends.map((trend, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`item-trend-${idx}`}>
                  {getTrendIcon(trend.trend)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" data-testid={`text-trend-metric-${idx}`}>{trend.metric}</span>
                      <Badge variant={trend.significance === "high" ? "default" : "secondary"} className="text-xs" data-testid={`badge-trend-status-${idx}`}>
                        {trend.trend}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-trend-description-${idx}`}>{trend.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary.highlights.length > 0 && (
        <Card data-testid="card-highlights">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Key Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="content-highlights">
              {summary.highlights.map((highlight, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 border rounded-lg ${getHighlightColor(highlight.category)}`}
                  data-testid={`item-highlight-${idx}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="font-medium" data-testid={`text-highlight-title-${idx}`}>{highlight.title}</span>
                    {getPriorityBadge(highlight.priority)}
                  </div>
                  <p className="text-sm" data-testid={`text-highlight-description-${idx}`}>{highlight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderComprehensiveSummary = (summary: ComprehensiveSummary) => (
    <div className="space-y-6" data-testid="container-comprehensive-summary">
      <Card data-testid="card-comprehensive-overview">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Comprehensive Health Overview</CardTitle>
          </div>
          <CardDescription data-testid="text-comprehensive-generated-info">
            Integrated summary across all health data - Generated {new Date(summary.generatedAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-overall-summary">
            {summary.overallSummary}
          </p>
        </CardContent>
      </Card>

      {summary.crossDataInsights.length > 0 && (
        <Card data-testid="card-cross-data-insights">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Cross-Data Insights
            </CardTitle>
            <CardDescription>
              Connections identified across different types of health data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="content-cross-data-insights">
              {summary.crossDataInsights.map((insight, idx) => (
                <div key={idx} className="p-3 border rounded-lg" data-testid={`item-insight-${idx}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-medium" data-testid={`text-insight-title-${idx}`}>{insight.title}</span>
                    <Badge variant={insight.significance === "high" ? "default" : "secondary"} className="text-xs" data-testid={`badge-insight-significance-${idx}`}>
                      {insight.significance}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`text-insight-description-${idx}`}>{insight.description}</p>
                  <p className="text-sm mt-2" data-testid={`text-insight-content-${idx}`}>{insight.insight}</p>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {insight.relatedCategories.map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs" data-testid={`badge-insight-category-${cat}`}>
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="conditions" className="w-full" data-testid="tabs-data-categories">
        <TabsList className="grid grid-cols-4 w-full" data-testid="list-tabs">
          <TabsTrigger value="conditions" className="flex items-center gap-1" data-testid="trigger-tab-conditions">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Conditions</span>
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-1" data-testid="trigger-tab-medications">
            <Pill className="h-4 w-4" />
            <span className="hidden sm:inline">Medications</span>
          </TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-1" data-testid="trigger-tab-labs">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Labs</span>
          </TabsTrigger>
          <TabsTrigger value="encounters" className="flex items-center gap-1" data-testid="trigger-tab-encounters">
            <Stethoscope className="h-4 w-4" />
            <span className="hidden sm:inline">Visits</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions" className="mt-4">
          {summary.conditionsSummary ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">
                  {summary.conditionsSummary.naturalLanguageSummary}
                </p>
                {summary.conditionsSummary.highlights.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {summary.conditionsSummary.highlights.slice(0, 2).map((h, i) => (
                      <div key={i} className={`p-2 rounded text-sm ${getHighlightColor(h.category)}`}>
                        <strong>{h.title}:</strong> {h.description}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 text-center text-muted-foreground">
                No conditions data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="medications" className="mt-4">
          {summary.medicationsSummary ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">
                  {summary.medicationsSummary.naturalLanguageSummary}
                </p>
                {summary.medicationsSummary.sections.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {summary.medicationsSummary.sections.map((s, i) => (
                      <div key={i} className="p-2 bg-muted/50 rounded text-sm">
                        <strong>{s.title}:</strong> {s.content}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 text-center text-muted-foreground">
                No medications data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="labs" className="mt-4">
          {summary.labsSummary ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">
                  {summary.labsSummary.naturalLanguageSummary}
                </p>
                {summary.labsSummary.trends.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {summary.labsSummary.trends.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        {getTrendIcon(t.trend)}
                        <span><strong>{t.metric}:</strong> {t.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 text-center text-muted-foreground">
                No lab results data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="encounters" className="mt-4">
          {summary.encountersSummary ? (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm leading-relaxed">
                  {summary.encountersSummary.naturalLanguageSummary}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 text-center text-muted-foreground">
                No encounters data available
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {summary.keyHighlights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Key Highlights Across All Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.keyHighlights.map((highlight, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 border rounded-lg ${getHighlightColor(highlight.category)}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="font-medium">{highlight.title}</span>
                    {getPriorityBadge(highlight.priority)}
                  </div>
                  <p className="text-sm">{highlight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const summary = summaryData?.summary;
  const isComprehensive = selectedView === "comprehensive";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Health Data Summaries
            </h1>
            <p className="text-muted-foreground mt-1">
              Natural language summaries of your FHIR health records
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isFetching}
            data-testid="button-refresh-summary"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(refreshMutation.isPending || isFetching) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">View Type</label>
            <Select value={selectedView} onValueChange={(v) => setSelectedView(v as ViewType)}>
              <SelectTrigger data-testid="trigger-view-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comprehensive">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Comprehensive Overview
                  </div>
                </SelectItem>
                <SelectItem value="medications">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    Medications
                  </div>
                </SelectItem>
                <SelectItem value="conditions">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Conditions
                  </div>
                </SelectItem>
                <SelectItem value="labs">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" />
                    Lab Results
                  </div>
                </SelectItem>
                <SelectItem value="encounters">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Healthcare Visits
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Summary For</label>
            <Select value={audience} onValueChange={(v) => setAudience(v as AudienceType)}>
              <SelectTrigger data-testid="trigger-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Patient (Plain Language)
                  </div>
                </SelectItem>
                <SelectItem value="provider">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4" />
                    Healthcare Provider
                  </div>
                </SelectItem>
                <SelectItem value="caregiver">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Caregiver
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert className="mb-6 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" data-testid="alert-no-cds-disclaimer">
          <Info className="h-4 w-4" />
          <AlertTitle>Important Notice</AlertTitle>
          <AlertDescription className="text-sm" data-testid="text-disclaimer">
            {summary?.disclaimer || "These AI-generated summaries are for informational purposes only and do NOT constitute medical advice. Always consult with your healthcare provider for medical guidance."}
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full mt-2" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full mt-2" />
              </CardContent>
            </Card>
          </div>
        ) : summary ? (
          <ScrollArea className="h-[calc(100vh-320px)]">
            {isComprehensive 
              ? renderComprehensiveSummary(summary as ComprehensiveSummary)
              : renderDataViewSummary(summary as DataViewSummary)
            }
          </ScrollArea>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No summary data available</p>
              <Button 
                className="mt-4" 
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                data-testid="button-generate-summary"
              >
                Generate Summary
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
