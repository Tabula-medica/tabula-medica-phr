/**
 * AI FHIR Insights Panel - Display AI-Generated Trend Analysis
 * 
 * Displays AI-driven insights for FHIR data including:
 * - Patient-friendly summaries
 * - Longitudinal trends
 * - Clinical insights for providers
 * 
 * All content is INFORMATIONAL ONLY with mandatory disclaimers.
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  RefreshCw,
  Sparkles,
  Users,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface TrendItem {
  id: string;
  type: 'improving' | 'stable' | 'declining' | 'fluctuating' | 'new';
  description: string;
  timeframe: string;
  significance: 'low' | 'medium' | 'high';
  dataPoints?: number;
}

interface ClinicalInsight {
  id: string;
  category: 'pattern' | 'correlation' | 'frequency' | 'timing' | 'adherence';
  title: string;
  description: string;
  relevance: 'patient' | 'provider' | 'both';
  confidence: 'low' | 'medium' | 'high';
}

interface InsightData {
  id: string;
  patientFriendlySummary: string;
  longitudinalTrends: TrendItem[];
  clinicalInsights: ClinicalInsight[];
  disclaimer: string;
  generatedAt: string;
}

interface AIFHIRInsightsPanelProps {
  patientId: string;
  dataType: 'medications' | 'conditions' | 'labs' | 'encounters';
  data: any[];
  viewMode?: 'patient' | 'provider';
  title?: string;
  showDisclaimer?: boolean;
}

export function AIFHIRInsightsPanel({
  patientId,
  dataType,
  data,
  viewMode = 'patient',
  title,
  showDisclaimer = true,
}: AIFHIRInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllTrends, setShowAllTrends] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);

  const getDataKey = () => {
    switch (dataType) {
      case 'medications': return { medications: data };
      case 'conditions': return { conditions: data };
      case 'labs': return { labs: data };
      case 'encounters': return { encounters: data };
    }
  };

  const { data: insightsResponse, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/ai-fhir-insights/${dataType}/${patientId}`, dataType, patientId],
    queryFn: async () => {
      const response = await apiRequest(
        'POST',
        `/api/ai-fhir-insights/${dataType}/${patientId}`,
        getDataKey()
      );
      return response.json();
    },
    enabled: data.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const insights: InsightData | null = insightsResponse?.data || null;

  const getTrendIcon = (type: string) => {
    switch (type) {
      case 'improving': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'fluctuating': return <Activity className="w-4 h-4 text-amber-500" />;
      case 'new': return <Sparkles className="w-4 h-4 text-blue-500" />;
      default: return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (type: string) => {
    switch (type) {
      case 'improving': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'declining': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'fluctuating': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'new': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSignificanceBadge = (significance: string) => {
    const colors = {
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    };
    return colors[significance as keyof typeof colors] || colors.low;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pattern': return <Activity className="w-4 h-4" />;
      case 'correlation': return <Brain className="w-4 h-4" />;
      case 'frequency': return <RefreshCw className="w-4 h-4" />;
      case 'timing': return <Activity className="w-4 h-4" />;
      case 'adherence': return <TrendingUp className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getRelevanceIcon = (relevance: string) => {
    switch (relevance) {
      case 'provider': return <Users className="w-3 h-3" />;
      case 'patient': return <User className="w-3 h-3" />;
      default: return null;
    }
  };

  const filteredInsights = insights?.clinicalInsights.filter(insight => {
    if (viewMode === 'patient') return insight.relevance === 'patient' || insight.relevance === 'both';
    return true;
  }) || [];

  const displayedTrends = showAllTrends 
    ? insights?.longitudinalTrends 
    : insights?.longitudinalTrends.slice(0, 3);

  const displayedInsights = showAllInsights 
    ? filteredInsights 
    : filteredInsights.slice(0, 3);

  if (data.length === 0) {
    return null;
  }

  const dataTypeTitle = title || dataType.charAt(0).toUpperCase() + dataType.slice(1);

  return (
    <Card data-testid={`ai-insights-panel-${dataType}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" aria-hidden="true" />
              <CardTitle className="text-base">AI Insights: {dataTypeTitle}</CardTitle>
              <Badge variant="outline" className="text-xs">
                Informational Only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => refetch()}
                disabled={isLoading}
                aria-label="Refresh insights"
                data-testid={`button-refresh-${dataType}-insights`}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={isExpanded ? "Collapse" : "Expand"}>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CardDescription className="text-xs">
            AI-generated analysis based on your {dataType} data
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading && (
              <div className="space-y-3" data-testid={`loading-${dataType}-insights`}>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-3/4" />
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Unable to Generate Insights</AlertTitle>
                <AlertDescription>
                  AI insights are temporarily unavailable. Please try again later.
                </AlertDescription>
              </Alert>
            )}

            {insights && !isLoading && (
              <>
                {/* Patient-Friendly Summary */}
                <div 
                  className="bg-primary/5 rounded-lg p-4"
                  data-testid={`summary-${dataType}`}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <h4 className="font-medium text-sm mb-1">Summary</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {insights.patientFriendlySummary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Longitudinal Trends */}
                {displayedTrends && displayedTrends.length > 0 && (
                  <div data-testid={`trends-${dataType}`}>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" aria-hidden="true" />
                      Trends Identified
                    </h4>
                    <div className="space-y-2">
                      {displayedTrends.map((trend) => (
                        <div 
                          key={trend.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                          data-testid={`trend-item-${trend.id}`}
                        >
                          <div className="mt-0.5">{getTrendIcon(trend.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={`text-xs ${getTrendColor(trend.type)}`}>
                                {trend.type}
                              </Badge>
                              <Badge variant="outline" className={`text-xs ${getSignificanceBadge(trend.significance)}`}>
                                {trend.significance} significance
                              </Badge>
                              <span className="text-xs text-muted-foreground">{trend.timeframe}</span>
                            </div>
                            <p className="text-sm mt-1">{trend.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {insights.longitudinalTrends.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllTrends(!showAllTrends)}
                        className="mt-2 w-full"
                        data-testid={`button-show-all-trends-${dataType}`}
                      >
                        {showAllTrends ? 'Show Less' : `Show All ${insights.longitudinalTrends.length} Trends`}
                      </Button>
                    )}
                  </div>
                )}

                {/* Clinical Insights */}
                {displayedInsights.length > 0 && (
                  <div data-testid={`clinical-insights-${dataType}`}>
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <Brain className="w-4 h-4" aria-hidden="true" />
                      Clinical Insights
                      {viewMode === 'provider' && (
                        <Badge variant="outline" className="text-xs">Provider View</Badge>
                      )}
                    </h4>
                    <div className="space-y-2">
                      {displayedInsights.map((insight) => (
                        <div 
                          key={insight.id}
                          className="p-3 rounded-lg border bg-card"
                          data-testid={`insight-item-${insight.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 text-muted-foreground">
                              {getCategoryIcon(insight.category)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium text-sm">{insight.title}</span>
                                <Badge variant="outline" className="text-xs">
                                  {insight.category}
                                </Badge>
                                {insight.relevance !== 'both' && (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    {getRelevanceIcon(insight.relevance)}
                                    {insight.relevance}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredInsights.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowAllInsights(!showAllInsights)}
                        className="mt-2 w-full"
                        data-testid={`button-show-all-insights-${dataType}`}
                      >
                        {showAllInsights ? 'Show Less' : `Show All ${filteredInsights.length} Insights`}
                      </Button>
                    )}
                  </div>
                )}

                {/* Disclaimer */}
                {showDisclaimer && (
                  <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm">
                      Informational Only
                    </AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
                      {viewMode === 'provider' 
                        ? "These AI-generated insights are for clinical reference only. They do not replace clinical judgment or constitute treatment recommendations."
                        : "This summary is for informational purposes only and does not constitute medical advice. Please discuss any concerns with your healthcare provider."}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Generation timestamp */}
                <p className="text-xs text-muted-foreground text-right">
                  Generated: {new Date(insights.generatedAt).toLocaleString()}
                </p>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default AIFHIRInsightsPanel;
