import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Minus,
  AlertTriangle, 
  Activity, 
  User, 
  Calendar,
  RefreshCw,
  Clock,
  Shield,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type TrendDirection = "improving" | "stable" | "declining" | "fluctuating" | "insufficient_data";

interface ClinicalEvent {
  id: string;
  eventType: string;
  title: string;
  description: string;
  date: string;
  severity: string;
  sourceDocuments: string[];
  extractedFrom: string;
  relatedConditions: string[];
  keyFindings: string[];
  aiConfidence: number;
}

interface ClinicalEventSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  timeframeDays: number;
  totalEventsIdentified: number;
  criticalEvents: ClinicalEvent[];
  significantEvents: ClinicalEvent[];
  eventTimeline: { date: string; events: ClinicalEvent[] }[];
  narrativeSummary: string;
  keyThemes: string[];
  aiConfidence: number;
  disclaimer: string;
}

interface RiskInsightSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  overallRiskLevel: string;
  riskScore: number;
  primaryConcerns: {
    condition: string;
    riskLevel: string;
    contributingFactors: string[];
    timeframe: string;
    dataSupporting: string;
  }[];
  protectiveFactors: string[];
  monitoringPriorities: {
    metric: string;
    currentValue: string;
    targetRange: string;
    trend: TrendDirection;
    urgency: string;
  }[];
  comprehensiveSummary: string;
  patientFriendlySummary: string;
  aiConfidence: number;
  disclaimer: string;
}

interface HistoricalTrendComparison {
  id: string;
  patientId: string;
  generatedAt: string;
  comparisonTimeframe: string;
  healthDomains: {
    domain: string;
    currentStatus: string;
    historicalBaseline: string;
    trendDirection: TrendDirection;
    percentageChange?: number;
    clinicalSignificance: string;
    keyObservations: string[];
  }[];
  vitalSignsTrends: {
    metric: string;
    currentValue: string;
    previousValue: string;
    trendDirection: TrendDirection;
    normalRange: string;
    observations: string;
  }[];
  labTrends: {
    testName: string;
    currentValue: string;
    historicalRange: string;
    trendDirection: TrendDirection;
    clinicalContext: string;
  }[];
  overallProgressNarrative: string;
  patientFriendlyComparison: string;
  aiConfidence: number;
  disclaimer: string;
}

interface EnrichedPatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  clinicalEventSummary: ClinicalEventSummary;
  riskInsightSummary: RiskInsightSummary;
  historicalComparison: HistoricalTrendComparison;
  executiveSummary: string;
  keyTakeaways: string[];
  prioritizedActionItems: {
    item: string;
    priority: string;
    rationale: string;
    suggestedTimeframe: string;
  }[];
  dataCompleteness: {
    overallScore: number;
    gaps: string[];
    recommendations: string[];
  };
  aiConfidence: number;
  disclaimer: string;
}

interface Patient {
  patientId: string;
  name: string;
  conditions: number;
  medications: number;
  recentLabsCount: number;
  clinicalNotesCount: number;
}

interface DashboardSummary {
  availablePatients: number;
  cachedEnrichments: number;
  samplePatients: Patient[];
  disclaimer: string;
}

function TrendIcon({ trend }: { trend: TrendDirection }) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "stable":
      return <Minus className="h-4 w-4 text-blue-500" />;
    case "fluctuating":
      return <Activity className="h-4 w-4 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    significant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    routine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  };
  return (
    <Badge className={variants[severity] || variants.routine} data-testid={`badge-severity-${severity}`}>
      {severity}
    </Badge>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    elevated: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  };
  return (
    <Badge className={variants[level] || variants.moderate} data-testid={`badge-risk-${level}`}>
      {level}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  };
  return (
    <Badge className={variants[priority] || variants.medium} data-testid={`badge-priority-${priority}`}>
      {priority}
    </Badge>
  );
}

export default function PatientSummaryEnrichment() {
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [timeframeDays, setTimeframeDays] = useState<number>(90);
  const [comparisonTimeframe, setComparisonTimeframe] = useState<string>("90_days");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/patient-summary-enrichment/dashboard']
  });

  const [enrichedSummary, setEnrichedSummary] = useState<EnrichedPatientSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enrichSummaryMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest('POST', '/api/patient-summary-enrichment/enriched-summary', {
        patientId,
        timeframeDays,
        comparisonTimeframe,
        forceRefresh: false
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      if (data?.enrichedSummary) {
        setEnrichedSummary(data.enrichedSummary);
        setError(null);
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to generate summary');
      console.error('Enrichment error:', err);
    }
  });

  const refreshSummaryMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await apiRequest('POST', '/api/patient-summary-enrichment/enriched-summary', {
        patientId,
        timeframeDays,
        comparisonTimeframe,
        forceRefresh: true
      });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      if (data?.enrichedSummary) {
        setEnrichedSummary(data.enrichedSummary);
        setError(null);
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to refresh summary');
      console.error('Refresh error:', err);
    }
  });

  const handleGenerateSummary = () => {
    if (selectedPatient) {
      setError(null);
      enrichSummaryMutation.mutate(selectedPatient);
    }
  };

  const handleRefreshSummary = () => {
    if (selectedPatient) {
      setError(null);
      refreshSummaryMutation.mutate(selectedPatient);
    }
  };

  const isLoading = enrichSummaryMutation.isPending || refreshSummaryMutation.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-patient-summary-enrichment">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Brain className="h-8 w-8 text-primary" />
          AI Patient Summary Enrichment
        </h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          AI-powered clinical event extraction, risk insights, and historical trend analysis
        </p>
      </div>

      <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950" data-testid="alert-disclaimer">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription className="text-sm">
          This AI-generated analysis is for INFORMATIONAL PURPOSES ONLY. It does NOT constitute medical advice or clinical recommendations. Healthcare decisions should ONLY be made by qualified healthcare providers.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card data-testid="card-patient-selection">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Selection
          </CardTitle>
          <CardDescription>
            Select a patient and configure analysis parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-2 min-w-[200px]">
              <label className="text-sm font-medium">Patient</label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient} data-testid="select-patient">
                <SelectTrigger className="w-[240px]" data-testid="select-trigger-patient">
                  <SelectValue placeholder="Select patient..." />
                </SelectTrigger>
                <SelectContent>
                  {dashboardLoading ? (
                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                  ) : (
                    dashboard?.samplePatients?.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId} data-testid={`select-item-patient-${p.patientId}`}>
                        {p.name} ({p.conditions} conditions)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Timeframe (days)</label>
              <Select value={timeframeDays.toString()} onValueChange={(v) => setTimeframeDays(parseInt(v))} data-testid="select-timeframe">
                <SelectTrigger className="w-[140px]" data-testid="select-trigger-timeframe">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Comparison Period</label>
              <Select value={comparisonTimeframe} onValueChange={setComparisonTimeframe} data-testid="select-comparison">
                <SelectTrigger className="w-[140px]" data-testid="select-trigger-comparison">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7_days">7 days</SelectItem>
                  <SelectItem value="30_days">30 days</SelectItem>
                  <SelectItem value="90_days">90 days</SelectItem>
                  <SelectItem value="6_months">6 months</SelectItem>
                  <SelectItem value="1_year">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleGenerateSummary} 
                disabled={!selectedPatient || isLoading}
                data-testid="button-generate-summary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Enriched Summary
                  </>
                )}
              </Button>
              {enrichedSummary && (
                <Button 
                  variant="outline" 
                  onClick={handleRefreshSummary} 
                  disabled={isLoading}
                  data-testid="button-refresh-summary"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {enrichedSummary && (
        <div className="space-y-6">
          <Card data-testid="card-executive-summary">
            <CardHeader>
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Executive Summary: {enrichedSummary.patientName || 'Patient'}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4" />
                    Generated: {enrichedSummary.generatedAt ? new Date(enrichedSummary.generatedAt).toLocaleString() : 'Just now'}
                    <span className="text-muted-foreground">|</span>
                    <Shield className="h-4 w-4" />
                    AI Confidence: {Math.round((enrichedSummary.aiConfidence ?? 0) * 100)}%
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {enrichedSummary.riskInsightSummary && (
                    <>
                      <RiskLevelBadge level={enrichedSummary.riskInsightSummary.overallRiskLevel || 'moderate'} />
                      <span className="text-sm text-muted-foreground">
                        Score: {enrichedSummary.riskInsightSummary.riskScore ?? 0}/100
                      </span>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground" data-testid="text-executive-summary">
                {enrichedSummary.executiveSummary || 'No summary available'}
              </p>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Key Takeaways</h4>
                <ul className="space-y-1">
                  {(enrichedSummary.keyTakeaways || []).map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" data-testid={`text-takeaway-${idx}`}>
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
              {enrichedSummary.dataCompleteness && (
                <div>
                  <h4 className="font-medium mb-2">Data Completeness: {enrichedSummary.dataCompleteness.overallScore ?? 0}%</h4>
                  <div className="w-full bg-muted rounded-full h-2 mb-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${enrichedSummary.dataCompleteness.overallScore ?? 0}%` }}
                      data-testid="progress-data-completeness"
                    />
                  </div>
                  {(enrichedSummary.dataCompleteness.gaps?.length ?? 0) > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Gaps: {enrichedSummary.dataCompleteness.gaps?.join(", ") || 'None'}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="events" className="w-full" data-testid="tabs-analysis">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="events" data-testid="tab-events">
                <FileText className="h-4 w-4 mr-2" />
                Clinical Events
              </TabsTrigger>
              <TabsTrigger value="risks" data-testid="tab-risks">
                <AlertCircle className="h-4 w-4 mr-2" />
                Risk Insights
              </TabsTrigger>
              <TabsTrigger value="trends" data-testid="tab-trends">
                <TrendingUp className="h-4 w-4 mr-2" />
                Historical Trends
              </TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">
                <CheckCircle className="h-4 w-4 mr-2" />
                Action Items
              </TabsTrigger>
            </TabsList>

            <TabsContent value="events" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clinical Event Summary</CardTitle>
                  <CardDescription>
                    {enrichedSummary.clinicalEventSummary?.totalEventsIdentified ?? 0} events identified over {enrichedSummary.clinicalEventSummary?.timeframeDays ?? 0} days
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground" data-testid="text-events-narrative">
                    {enrichedSummary.clinicalEventSummary?.narrativeSummary || 'No clinical events summary available'}
                  </p>
                  
                  {(enrichedSummary.clinicalEventSummary?.keyThemes?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(enrichedSummary.clinicalEventSummary?.keyThemes || []).map((theme, idx) => (
                        <Badge key={idx} variant="secondary" data-testid={`badge-theme-${idx}`}>
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {(enrichedSummary.clinicalEventSummary?.eventTimeline || []).map((day, dayIdx) => (
                        <div key={dayIdx} className="space-y-2" data-testid={`timeline-day-${dayIdx}`}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{day.date ? new Date(day.date).toLocaleDateString() : 'Unknown date'}</span>
                          </div>
                          {(day.events || []).map((event, eventIdx) => (
                            <Card key={eventIdx} className="ml-6" data-testid={`card-event-${dayIdx}-${eventIdx}`}>
                              <CardContent className="py-3">
                                <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{event.title || 'Event'}</span>
                                  </div>
                                  <SeverityBadge severity={event.severity || 'moderate'} />
                                </div>
                                <p className="text-sm text-muted-foreground ml-6">
                                  {event.description || 'No description'}
                                </p>
                                {(event.keyFindings?.length ?? 0) > 0 && (
                                  <div className="ml-6 mt-2 flex flex-wrap gap-1">
                                    {(event.keyFindings || []).map((finding, fIdx) => (
                                      <Badge key={fIdx} variant="outline" className="text-xs">
                                        {finding}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Primary Concerns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(enrichedSummary.riskInsightSummary?.primaryConcerns || []).map((concern, idx) => (
                        <div key={idx} className="border rounded-lg p-3" data-testid={`card-concern-${idx}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium">{concern.condition || 'Unknown condition'}</span>
                            <RiskLevelBadge level={concern.riskLevel || 'moderate'} />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{concern.dataSupporting || 'No data'}</p>
                          {(concern.contributingFactors?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(concern.contributingFactors || []).map((factor, fIdx) => (
                                <Badge key={fIdx} variant="outline" className="text-xs">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Monitoring Priorities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(enrichedSummary.riskInsightSummary?.monitoringPriorities || []).map((priority, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0" data-testid={`row-monitoring-${idx}`}>
                          <div className="flex items-center gap-2">
                            <TrendIcon trend={priority.trend || 'stable'} />
                            <div>
                              <span className="font-medium">{priority.metric || 'Unknown metric'}</span>
                              <p className="text-sm text-muted-foreground">
                                Current: {priority.currentValue || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={priority.urgency === "immediate" ? "destructive" : "secondary"}>
                            {priority.urgency || 'routine'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Patient-Friendly Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="text-patient-friendly-summary">
                      {enrichedSummary.riskInsightSummary?.patientFriendlySummary || 'No patient-friendly summary available'}
                    </p>
                    {(enrichedSummary.riskInsightSummary?.protectiveFactors?.length ?? 0) > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2 text-green-600 dark:text-green-400">Protective Factors</h4>
                        <div className="flex flex-wrap gap-2">
                          {(enrichedSummary.riskInsightSummary?.protectiveFactors || []).map((factor, idx) => (
                            <Badge key={idx} className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="mt-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Health Domain Trends</CardTitle>
                    <CardDescription>
                      Comparison over {(enrichedSummary.historicalComparison?.comparisonTimeframe || '90_days').replace("_", " ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(enrichedSummary.historicalComparison?.healthDomains || []).map((domain, idx) => (
                        <div key={idx} className="border rounded-lg p-4" data-testid={`card-domain-${idx}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <TrendIcon trend={domain.trendDirection || 'stable'} />
                              <span className="font-medium">{domain.domain || 'Unknown domain'}</span>
                            </div>
                            <Badge variant="secondary">{domain.clinicalSignificance || 'moderate'}</Badge>
                          </div>
                          <div className="grid md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Current: </span>
                              {domain.currentStatus || 'N/A'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Baseline: </span>
                              {domain.historicalBaseline || 'N/A'}
                            </div>
                          </div>
                          {(domain.keyObservations?.length ?? 0) > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(domain.keyObservations || []).map((obs, oIdx) => (
                                <Badge key={oIdx} variant="outline" className="text-xs">
                                  {obs}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lab Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(enrichedSummary.historicalComparison?.labTrends || []).map((lab, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0" data-testid={`row-lab-${idx}`}>
                            <div className="flex items-center gap-2">
                              <TrendIcon trend={lab.trendDirection || 'stable'} />
                              <div>
                                <span className="font-medium">{lab.testName || 'Unknown test'}</span>
                                <p className="text-sm text-muted-foreground">{lab.currentValue || 'N/A'}</p>
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{lab.clinicalContext || ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Vital Signs Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(enrichedSummary.historicalComparison?.vitalSignsTrends || []).map((vital, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0" data-testid={`row-vital-${idx}`}>
                            <div className="flex items-center gap-2">
                              <TrendIcon trend={vital.trendDirection || 'stable'} />
                              <div>
                                <span className="font-medium">{vital.metric || 'Unknown metric'}</span>
                                <p className="text-sm text-muted-foreground">{vital.currentValue || 'N/A'}</p>
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{vital.normalRange || ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Overall Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground" data-testid="text-progress-narrative">
                      {enrichedSummary.historicalComparison?.overallProgressNarrative || 'No progress narrative available'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Prioritized Action Items</CardTitle>
                  <CardDescription>
                    Items identified from comprehensive analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(enrichedSummary.prioritizedActionItems || []).map((item, idx) => (
                      <div key={idx} className="border rounded-lg p-4" data-testid={`card-action-${idx}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium">{item.item || 'Action item'}</span>
                          <PriorityBadge priority={item.priority || 'medium'} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{item.rationale || 'No rationale provided'}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{item.suggestedTimeframe || 'No timeframe specified'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {!enrichedSummary && !isLoading && (
        <Card className="border-dashed" data-testid="card-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Brain className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Summary Generated</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Select a patient and click "Generate Enriched Summary" to create an AI-powered analysis of clinical events, risk insights, and historical trends.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
