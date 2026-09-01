import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Bell,
  Sparkles,
  User,
  Heart,
  Clock,
  Eye,
  Loader2,
  ChevronRight,
  FileText,
  ShieldAlert,
  RefreshCw,
  BarChart3,
  Target,
  Pill,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { clickable } from "@/lib/a11y";

interface DashboardOverview {
  totalPatients: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  alertsRequiringAttention: number;
  recentAlerts: HighRiskAlert[];
  lastUpdated: string;
}

interface HighRiskAlert {
  patientId: string;
  patientName: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number;
  alertType: string;
  alertTitle: string;
  alertDescription: string;
  triggeredAt: string;
  recommendedActions: string[];
  relatedData: { type: string; value: string; date: string }[];
  requiresImmediateAttention: boolean;
  status: "new" | "acknowledged" | "in_progress" | "resolved";
}

interface PatientHealthTrend {
  patientId: string;
  patientName: string;
  generatedAt: string;
  overallHealthStatus: "stable" | "improving" | "concerning" | "critical";
  trendSummary: string;
  recentLogsHighlights: {
    date: string;
    type: string;
    summary: string;
    significance: string;
  }[];
  keyInsights: {
    category: string;
    insight: string;
    clinicalRelevance: string;
    dataPoints: string[];
  }[];
  vitalsTrend: {
    bloodPressure: { trend: string; current: string; status: string };
    heartRate: { trend: string; current: string; status: string };
    weight: { trend: string; current: string; status: string };
  };
  medicationAdherence: {
    overallRate: number;
    trend: string;
    concerningMedications: string[];
    notes: string;
  };
  labTrends: {
    labName: string;
    latestValue: string;
    trend: string;
    normalRange: string;
    status: string;
  }[];
  riskScore: number;
  confidenceScore: number;
}

interface ProgressReport {
  patientId: string;
  patientName: string;
  reportPeriod: { startDate: string; endDate: string };
  generatedAt: string;
  executiveSummary: string;
  conditionProgress: {
    conditionName: string;
    status: string;
    progressDescription: string;
    keyMetrics: { name: string; value: string; change: string }[];
  }[];
  treatmentEffectiveness: {
    treatmentName: string;
    effectiveness: string;
    evidence: string;
    duration: string;
  }[];
  goalsProgress: {
    goalName: string;
    targetValue: string;
    currentValue: string;
    progressPercentage: number;
    status: string;
    notes: string;
  }[];
  visitSummary: {
    totalVisits: number;
    visitTypes: { type: string; count: number }[];
    keyDiscussionPoints: string[];
    patientConcerns: string[];
  };
  medicationReview: {
    activeMedications: number;
    adherenceRate: number;
    medicationChanges: any[];
    interactions: any[];
    refillStatus: string;
  };
  labTrends: {
    labName: string;
    values: { date: string; value: string }[];
    trend: string;
    clinicalInterpretation: string;
  }[];
  riskAssessment: {
    overallRiskLevel: string;
    riskFactors: { factor: string; severity: string; mitigation: string }[];
    predictiveInsights: string[];
  };
  providerNotes: string[];
  nextSteps: string[];
  overallProgress: string;
  confidenceScore: number;
}

interface ClinicalNotesSummary {
  patientId: string;
  patientName: string;
  generatedAt: string;
  visitDate: string;
  visitType: "routine" | "follow-up" | "urgent" | "telehealth" | "specialist";
  chiefComplaint: string;
  subjectiveNotes: string;
  objectiveFindings: {
    vitals: { type: string; value: string; status: "normal" | "abnormal" }[];
    physicalExam: string[];
    observations: string[];
  };
  assessment: {
    primaryDiagnosis: string;
    secondaryDiagnoses: string[];
    differentialDiagnoses: string[];
    clinicalStatus: "stable" | "improving" | "worsening" | "critical";
  };
  plan: {
    medications: { action: string; medication: string; dosage: string; reason: string }[];
    tests: { name: string; reason: string; urgency: "routine" | "urgent" }[];
    procedures: string[];
    referrals: { specialty: string; reason: string }[];
    followUp: { timeframe: string; reason: string };
    patientEducation: string[];
  };
  summary: string;
  keyPoints: string[];
  confidenceScore: number;
  disclaimer: string;
}

function getRiskBadgeVariant(level: string) {
  switch (level) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "moderate":
      return "secondary";
    default:
      return "outline";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining":
    case "concerning":
    case "critical":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function getProgressIcon(progress: string) {
  switch (progress) {
    case "significant_improvement":
    case "moderate_improvement":
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    case "slight_decline":
    case "significant_decline":
      return <ArrowDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function AIProviderDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [reportMonths, setReportMonths] = useState("3");

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<DashboardOverview>({
    queryKey: ["/api/provider-dashboard/overview"],
  });

  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<HighRiskAlert[]>({
    queryKey: ["/api/provider-dashboard/alerts"],
  });

  const { data: patientTrend, isLoading: trendLoading, refetch: refetchTrend } = useQuery<PatientHealthTrend>({
    queryKey: [`/api/provider-dashboard/patient/${selectedPatientId}/trends`],
    enabled: !!selectedPatientId,
  });

  const { data: progressReport, isLoading: reportLoading, refetch: refetchReport } = useQuery<ProgressReport>({
    queryKey: [`/api/provider-dashboard/patient/${selectedPatientId}/progress-report?months=${reportMonths}`],
    enabled: !!selectedPatientId && activeTab === "reports",
  });

  const { data: clinicalNotes, isLoading: clinicalNotesLoading, refetch: refetchClinicalNotes } = useQuery<ClinicalNotesSummary>({
    queryKey: [`/api/provider-dashboard/patient/${selectedPatientId}/clinical-notes`],
    enabled: !!selectedPatientId && activeTab === "clinical-notes",
  });

  const handleRefresh = () => {
    refetchOverview();
    refetchAlerts();
    if (selectedPatientId) {
      refetchTrend();
      if (activeTab === "reports") {
        refetchReport();
      }
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="ai-provider-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Provider Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered clinical insights, patient trends, and risk alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh" className="min-h-[44px]">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/provider-portal">
            <Button variant="ghost" data-testid="link-provider-portal" className="min-h-[44px]">
              Provider Portal
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="overview" data-testid="tab-overview" className="min-h-[44px]">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts" className="min-h-[44px]">
            <Bell className="h-4 w-4 mr-2" />
            Risk Alerts
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends" className="min-h-[44px]">
            <Activity className="h-4 w-4 mr-2" />
            Health Trends
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports" className="min-h-[44px]">
            <FileText className="h-4 w-4 mr-2" />
            Progress Reports
          </TabsTrigger>
          <TabsTrigger value="clinical-notes" data-testid="tab-clinical-notes" className="min-h-[44px]">
            <Sparkles className="h-4 w-4 mr-2" />
            Clinical Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-patients">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-patients">
                      {overview?.totalPatients || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-high-risk">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">High Risk</CardTitle>
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive" data-testid="text-high-risk">
                      {overview?.highRiskCount || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {overview?.alertsRequiringAttention || 0} requiring attention
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-moderate-risk">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">Moderate Risk</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600" data-testid="text-moderate-risk">
                      {overview?.moderateRiskCount || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-low-risk">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">Low Risk</CardTitle>
                    <Heart className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-low-risk">
                      {overview?.lowRiskCount || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Recent High-Risk Alerts
                  </CardTitle>
                  <CardDescription>
                    Latest alerts requiring provider attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {overview?.recentAlerts && overview.recentAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {overview.recentAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                          {...clickable(() => {
                            setSelectedPatientId(alert.patientId);
                            setActiveTab("trends");
                          })}
                          data-testid={`alert-item-${idx}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${alert.riskLevel === "critical" || alert.riskLevel === "high" ? "bg-destructive/10" : "bg-yellow-500/10"}`}>
                              <AlertTriangle className={`h-4 w-4 ${alert.riskLevel === "critical" || alert.riskLevel === "high" ? "text-destructive" : "text-yellow-500"}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{alert.patientName}</span>
                                <Badge variant={getRiskBadgeVariant(alert.riskLevel)}>
                                  {alert.riskLevel}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium mt-1">{alert.alertTitle}</p>
                              <p className="text-sm text-muted-foreground">{alert.alertDescription}</p>
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No recent alerts
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" onClick={() => setActiveTab("alerts")} data-testid="button-view-all-alerts">
                    View All Alerts
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                High-Risk Patient Alerts
              </CardTitle>
              <CardDescription>
                AI-generated alerts for patients showing concerning patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 border rounded-lg">
                      <Skeleton className="h-5 w-40 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : alerts && alerts.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4 pr-4">
                    {alerts.map((alert, idx) => (
                      <Card key={idx} className={`${alert.requiresImmediateAttention ? "border-destructive" : ""}`} data-testid={`risk-alert-${idx}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span className="font-medium">{alert.patientName}</span>
                              <Badge variant={getRiskBadgeVariant(alert.riskLevel)}>
                                Risk: {alert.riskScore}%
                              </Badge>
                              {alert.requiresImmediateAttention && (
                                <Badge variant="destructive">Immediate Attention</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                            </span>
                          </div>
                          <CardTitle className="text-base">{alert.alertTitle}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{alert.alertDescription}</p>
                          
                          {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-1">Considerations:</h4>
                              <ul className="text-sm text-muted-foreground list-disc list-inside">
                                {alert.recommendedActions.map((action, i) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {alert.relatedData && alert.relatedData.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {alert.relatedData.map((data, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {data.type}: {data.value}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPatientId(alert.patientId);
                              setActiveTab("trends");
                            }}
                            data-testid={`button-view-trends-${idx}`}
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            View Trends
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPatientId(alert.patientId);
                              setActiveTab("reports");
                            }}
                            data-testid={`button-generate-report-${idx}`}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Report
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldAlert className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No high-risk alerts at this time</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {!selectedPatientId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="mb-4">Select a patient from the alerts to view their health trends</p>
                <Button variant="outline" onClick={() => setActiveTab("alerts")} data-testid="button-go-to-alerts">
                  View Alerts
                </Button>
              </CardContent>
            </Card>
          ) : trendLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ) : patientTrend ? (
            <div className="space-y-4">
              <Card data-testid="card-patient-trend">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {patientTrend.patientName}
                      </CardTitle>
                      <CardDescription>
                        Health trend analysis generated {formatDistanceToNow(new Date(patientTrend.generatedAt), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRiskBadgeVariant(patientTrend.overallHealthStatus)}>
                        {patientTrend.overallHealthStatus}
                      </Badge>
                      {getStatusIcon(patientTrend.overallHealthStatus)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI Summary
                    </h4>
                    <p className="text-sm" data-testid="text-trend-summary">{patientTrend.trendSummary}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Medication Adherence
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-2xl font-bold">{patientTrend.medicationAdherence.overallRate}%</span>
                          {getStatusIcon(patientTrend.medicationAdherence.trend)}
                        </div>
                        <Progress value={patientTrend.medicationAdherence.overallRate} className="mb-2" />
                        <p className="text-sm text-muted-foreground">{patientTrend.medicationAdherence.notes}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Risk Score
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 mb-2">
                          <span className="text-2xl font-bold">{patientTrend.riskScore}</span>
                          <span className="text-muted-foreground">/ 100</span>
                        </div>
                        <Progress 
                          value={patientTrend.riskScore} 
                          className={`mb-2 ${patientTrend.riskScore > 60 ? "[&>div]:bg-destructive" : patientTrend.riskScore > 40 ? "[&>div]:bg-yellow-500" : ""}`}
                        />
                        <p className="text-sm text-muted-foreground">
                          Confidence: {patientTrend.confidenceScore}%
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {patientTrend.keyInsights && patientTrend.keyInsights.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Key Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {patientTrend.keyInsights.map((insight, idx) => (
                            <div key={idx} className="p-3 border rounded-lg" data-testid={`insight-${idx}`}>
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline">{insight.category}</Badge>
                                <Badge variant={insight.clinicalRelevance === "high" ? "destructive" : insight.clinicalRelevance === "medium" ? "secondary" : "outline"}>
                                  {insight.clinicalRelevance} relevance
                                </Badge>
                              </div>
                              <p className="text-sm">{insight.insight}</p>
                              {insight.dataPoints && insight.dataPoints.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {insight.dataPoints.map((point, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {point}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {patientTrend.labTrends && patientTrend.labTrends.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Lab Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {patientTrend.labTrends.map((lab, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 border rounded" data-testid={`lab-trend-${idx}`}>
                              <div>
                                <span className="font-medium">{lab.labName}</span>
                                <span className="text-muted-foreground ml-2">({lab.normalRange})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{lab.latestValue}</span>
                                <Badge variant={lab.status === "abnormal" ? "destructive" : lab.status === "borderline" ? "secondary" : "outline"}>
                                  {lab.trend}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
                <CardFooter>
                  <Button onClick={() => setActiveTab("reports")} data-testid="button-generate-progress-report">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Progress Report
                  </Button>
                </CardFooter>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {!selectedPatientId ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="mb-4">Select a patient from the alerts to generate their progress report</p>
                <Button variant="outline" onClick={() => setActiveTab("alerts")} data-testid="button-go-to-alerts-reports">
                  View Alerts
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Progress Report</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Report Period:</span>
                  <Select value={reportMonths} onValueChange={(v) => setReportMonths(v)}>
                    <SelectTrigger className="w-32" data-testid="select-report-months">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month</SelectItem>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {reportLoading ? (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ) : progressReport ? (
                <div className="space-y-4">
                  <Card data-testid="card-progress-report">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <User className="h-5 w-5" />
                            {progressReport.patientName} - Progress Report
                          </CardTitle>
                          <CardDescription>
                            {format(new Date(progressReport.reportPeriod.startDate), "MMM d, yyyy")} - {format(new Date(progressReport.reportPeriod.endDate), "MMM d, yyyy")}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>{progressReport.overallProgress?.replace(/_/g, " ")}</Badge>
                          {getProgressIcon(progressReport.overallProgress)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Executive Summary
                        </h4>
                        <p className="text-sm" data-testid="text-executive-summary">{progressReport.executiveSummary}</p>
                      </div>

                      {progressReport.conditionProgress && progressReport.conditionProgress.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3">Condition Progress</h4>
                          <div className="space-y-3">
                            {progressReport.conditionProgress.map((condition, idx) => (
                              <Card key={idx} data-testid={`condition-progress-${idx}`}>
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{condition.conditionName}</CardTitle>
                                    <Badge variant={condition.status === "improving" || condition.status === "controlled" ? "outline" : "secondary"}>
                                      {condition.status}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-sm text-muted-foreground mb-2">{condition.progressDescription}</p>
                                  {condition.keyMetrics && condition.keyMetrics.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                      {condition.keyMetrics.map((metric, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                          {metric.name}: {metric.value} ({metric.change})
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Visit Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Visits</span>
                                <span className="font-medium">{progressReport.visitSummary?.totalVisits || 0}</span>
                              </div>
                              {progressReport.visitSummary?.visitTypes?.map((vt, i) => (
                                <div key={i} className="flex justify-between">
                                  <span className="text-muted-foreground capitalize">{vt.type}</span>
                                  <span>{vt.count}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Medication Review</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Active Medications</span>
                                <span className="font-medium">{progressReport.medicationReview?.activeMedications || 0}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Adherence Rate</span>
                                <span className="font-medium">{progressReport.medicationReview?.adherenceRate || 0}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Refill Status</span>
                                <span>{progressReport.medicationReview?.refillStatus || "N/A"}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {progressReport.riskAssessment && (
                        <Card className={progressReport.riskAssessment.overallRiskLevel === "high" || progressReport.riskAssessment.overallRiskLevel === "critical" ? "border-destructive" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-base">Risk Assessment</CardTitle>
                              <Badge variant={getRiskBadgeVariant(progressReport.riskAssessment.overallRiskLevel)}>
                                {progressReport.riskAssessment.overallRiskLevel} Risk
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {progressReport.riskAssessment.riskFactors && progressReport.riskAssessment.riskFactors.length > 0 && (
                              <div className="space-y-2">
                                {progressReport.riskAssessment.riskFactors.map((rf, i) => (
                                  <div key={i} className="p-2 border rounded text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">{rf.factor}</span>
                                      <Badge variant="outline">{rf.severity}</Badge>
                                    </div>
                                    <p className="text-muted-foreground">{rf.mitigation}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {progressReport.nextSteps && progressReport.nextSteps.length > 0 && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">Next Steps</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-1 text-sm">
                              {progressReport.nextSteps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground">
                      Report generated {format(new Date(progressReport.generatedAt), "PPpp")} | Confidence: {progressReport.confidenceScore}%
                    </CardFooter>
                  </Card>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="clinical-notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Clinical Notes Generator
              </CardTitle>
              <CardDescription>
                Generate SOAP-style clinical notes summaries from patient records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="ai-provider-dashboard-select-patient" className="text-sm font-medium mb-2 block">Select Patient</label>
                  <Select value={selectedPatientId || ""} onValueChange={setSelectedPatientId}>
                    <SelectTrigger id="ai-provider-dashboard-select-patient" className="min-h-[44px]" data-testid="select-patient-notes">
                      <SelectValue placeholder="Select a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {alerts?.map((alert) => (
                        <SelectItem key={alert.patientId} value={alert.patientId}>
                          {alert.patientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={() => refetchClinicalNotes()} 
                  disabled={!selectedPatientId || clinicalNotesLoading}
                  className="min-h-[44px]"
                  data-testid="button-generate-notes"
                >
                  {clinicalNotesLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Notes
                </Button>
              </div>

              {selectedPatientId && clinicalNotesLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-48 w-full" />
                </div>
              ) : clinicalNotes ? (
                <div className="space-y-4">
                  <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-lg">{clinicalNotes.patientName}</CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline">{clinicalNotes.visitType}</Badge>
                          <Badge variant={
                            clinicalNotes.assessment?.clinicalStatus === "stable" ? "secondary" :
                            clinicalNotes.assessment?.clinicalStatus === "improving" ? "default" :
                            "destructive"
                          }>
                            {clinicalNotes.assessment?.clinicalStatus || "stable"}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        Visit: {format(new Date(clinicalNotes.visitDate), "PPP")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Chief Complaint
                        </h4>
                        <p className="text-sm text-muted-foreground">{clinicalNotes.chiefComplaint}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Subjective</h4>
                        <p className="text-sm text-muted-foreground">{clinicalNotes.subjectiveNotes}</p>
                      </div>

                      {clinicalNotes.objectiveFindings?.vitals?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Heart className="h-4 w-4" />
                            Objective - Vitals
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {clinicalNotes.objectiveFindings.vitals.map((vital, idx) => (
                              <div key={idx} className="p-2 bg-muted/50 rounded-lg">
                                <div className="text-xs text-muted-foreground">{vital.type}</div>
                                <div className="font-medium flex items-center gap-1">
                                  {vital.value}
                                  <span className={vital.status === "normal" ? "text-green-500" : "text-red-500"}>
                                    {vital.status === "normal" ? "✓" : "!"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Assessment
                        </h4>
                        <div className="space-y-1">
                          <p className="text-sm"><strong>Primary:</strong> {clinicalNotes.assessment?.primaryDiagnosis}</p>
                          {clinicalNotes.assessment?.secondaryDiagnoses?.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Secondary:</strong> {clinicalNotes.assessment.secondaryDiagnoses.join(", ")}
                            </p>
                          )}
                        </div>
                      </div>

                      {clinicalNotes.plan?.medications?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Pill className="h-4 w-4" />
                            Plan - Medications
                          </h4>
                          <div className="space-y-1">
                            {clinicalNotes.plan.medications.map((med, idx) => (
                              <div key={idx} className="text-sm flex items-start gap-2">
                                <Badge variant="outline" className="text-xs">{med.action}</Badge>
                                <span>{med.medication} {med.dosage}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {clinicalNotes.plan?.followUp && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Follow-up
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {clinicalNotes.plan.followUp.timeframe} - {clinicalNotes.plan.followUp.reason}
                          </p>
                        </div>
                      )}

                      <div className="p-3 bg-primary/5 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2">Summary</h4>
                        <p className="text-sm">{clinicalNotes.summary}</p>
                      </div>

                      {clinicalNotes.keyPoints?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Key Points</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {clinicalNotes.keyPoints.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2">
                      <div className="text-xs text-muted-foreground w-full">
                        Generated {format(new Date(clinicalNotes.generatedAt), "PPpp")} | Confidence: {clinicalNotes.confidenceScore}%
                      </div>
                      <div className="p-2 bg-yellow-500/10 rounded text-xs text-yellow-700 dark:text-yellow-300 w-full">
                        <strong>Disclaimer:</strong> {clinicalNotes.disclaimer}
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              ) : selectedPatientId ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate Notes" to create AI-powered clinical notes</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a patient to generate clinical notes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
