import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  User,
  Heart,
  Pill,
  Calendar,
  FileText,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Activity,
  Stethoscope,
  Clock,
  Shield,
  Info,
  Download,
  Printer,
  ChevronRight,
  GitBranch,
  Target,
  TestTube,
  Home,
  ArrowUp,
  ArrowDown,
  Minus,
  ImageIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface OnePageHealthSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  expiresAt: string;
  sections: {
    patientOverview: {
      name: string;
      age: string;
      primaryCareProvider: string;
      lastUpdated: string;
    };
    medicalHistoryHighlights: {
      summary: string;
      keyConditions: string[];
      significantEvents: string[];
    };
    currentHealthStatus: {
      summary: string;
      activeConditions: Array<{
        condition: string;
        status: string;
        keyInfo: string;
      }>;
      recentVitals: string;
    };
    medicationSummary: {
      summary: string;
      medicationCount: number;
      keyMedications: Array<{
        name: string;
        purpose: string;
        dosage: string;
      }>;
      allergies: string[];
    };
    upcomingCare: {
      summary: string;
      nextAppointment: string | null;
      appointments: Array<{
        date: string;
        type: string;
        provider: string;
      }>;
    };
    careTeamUpdates: {
      summary: string;
      recentNotes: Array<{
        date: string;
        author: string;
        highlight: string;
      }>;
      actionItems: string[];
    };
  };
  aiInsights: {
    healthTrends: string[];
    attentionAreas: string[];
    positiveProgress: string[];
  };
  healthTimeline: {
    summary: string;
    events: Array<{
      date: string;
      eventType: string;
      title: string;
      description: string;
      significance: string;
    }>;
    keyMilestones: string[];
  };
  careGapsAnalysis: {
    summary: string;
    totalGaps: number;
    highPriorityCount: number;
    gaps: Array<{
      category: string;
      description: string;
      priority: string;
      status: string;
      dueDate?: string;
    }>;
  };
  labAndImagingSummary: {
    summary: string;
    recentLabHighlights: Array<{
      testName: string;
      value: string;
      status: string;
      date: string;
      trend?: string;
    }>;
    recentImagingHighlights: Array<{
      studyType: string;
      date: string;
      impression: string;
      status: string;
    }>;
    criticalFindings: string[];
  };
  socialDeterminantsOfHealth: {
    summary: string;
    identifiedFactors: Array<{
      category: string;
      description: string;
      status: string;
      impact?: string;
    }>;
    resourcesConnected: string[];
    unaddressedNeeds: string[];
  };
  quickReferenceBox: {
    emergencyInfo: string;
    keyAllergies: string;
    criticalMedications: string;
  };
  disclaimer: string;
  metadata: {
    dataSourcesUsed: string[];
    confidenceLevel: "high" | "medium" | "low";
    lastDataUpdate: string;
    summaryVersion: string;
  };
}

function getEventTypeIcon(eventType: string) {
  switch (eventType) {
    case "diagnosis":
      return <Heart className="h-4 w-4" />;
    case "procedure":
      return <Activity className="h-4 w-4" />;
    case "hospitalization":
      return <Home className="h-4 w-4" />;
    case "medication_change":
      return <Pill className="h-4 w-4" />;
    case "lab":
      return <TestTube className="h-4 w-4" />;
    case "imaging":
      return <ImageIcon className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
}

function getSignificanceColor(significance: string) {
  switch (significance) {
    case "critical":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
    case "notable":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "medium":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    default:
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }
}

function getLabStatusColor(status: string) {
  switch (status) {
    case "normal":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "abnormal_high":
    case "abnormal_low":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "critical":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getTrendIcon(trend?: string) {
  switch (trend) {
    case "improving":
      return <ArrowDown className="h-3 w-3 text-green-500" />;
    case "worsening":
      return <ArrowUp className="h-3 w-3 text-red-500" />;
    default:
      return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
}

function getSdohCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    housing: "Housing",
    food_security: "Food Security",
    transportation: "Transportation",
    employment: "Employment",
    education: "Education",
    social_support: "Social Support",
    safety: "Safety",
    health_literacy: "Health Literacy",
    financial_strain: "Financial Strain",
  };
  return labels[category] || category;
}

function getSdohStatusColor(status: string) {
  switch (status) {
    case "addressed":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "monitoring":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "identified":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "controlled":
      return "bg-green-500/10 text-green-600 dark:text-green-400";
    case "uncontrolled":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function SummarySection({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function PatientProfileSummary() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: summaryData, isLoading, refetch } = useQuery<{
    success: boolean;
    summary: OnePageHealthSummary;
    disclaimer: string;
  }>({
    queryKey: ["/api/patient-profile-summary/quick-summary"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/patient-profile-summary/quick-summary", {
        patientId: "patient-default",
      });
      return response.json();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-profile-summary/refresh", {
        patientId: "patient-default",
        includeAiInsights: true,
        summaryFormat: "standard",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-profile-summary/quick-summary"] });
      toast({
        title: "Summary Refreshed",
        description: "Your health summary has been updated with the latest data.",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Could not refresh the summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  const summary = summaryData?.summary;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-64" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">No Summary Available</h2>
              <p className="text-muted-foreground">
                Unable to generate a health summary at this time.
              </p>
              <Button onClick={() => refetch()} data-testid="button-retry">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">One-Page Health Summary</h1>
              <p className="text-muted-foreground">
                AI-generated quick review for {summary.sections.patientOverview.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-summary"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" data-testid="button-print-summary">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" data-testid="button-export-summary">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {summary.disclaimer}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>{summary.sections.patientOverview.name}</CardTitle>
                      <CardDescription>
                        {summary.sections.patientOverview.age} | PCP: {summary.sections.patientOverview.primaryCareProvider}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    Updated {format(new Date(summary.generatedAt), "MMM d, h:mm a")}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                <TabsTrigger value="overview" data-testid="tab-overview" className="text-xs sm:text-sm">
                  <Activity className="h-4 w-4 mr-1 hidden sm:inline" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="timeline" data-testid="tab-timeline" className="text-xs sm:text-sm">
                  <GitBranch className="h-4 w-4 mr-1 hidden sm:inline" />
                  Timeline
                </TabsTrigger>
                <TabsTrigger value="care-gaps" data-testid="tab-care-gaps" className="text-xs sm:text-sm">
                  <Target className="h-4 w-4 mr-1 hidden sm:inline" />
                  Care Gaps
                </TabsTrigger>
                <TabsTrigger value="labs" data-testid="tab-labs" className="text-xs sm:text-sm">
                  <TestTube className="h-4 w-4 mr-1 hidden sm:inline" />
                  Labs
                </TabsTrigger>
                <TabsTrigger value="sdoh" data-testid="tab-sdoh" className="text-xs sm:text-sm">
                  <Home className="h-4 w-4 mr-1 hidden sm:inline" />
                  SDOH
                </TabsTrigger>
                <TabsTrigger value="medications" data-testid="tab-medications" className="text-xs sm:text-sm">
                  <Pill className="h-4 w-4 mr-1 hidden sm:inline" />
                  Meds
                </TabsTrigger>
                <TabsTrigger value="appointments" data-testid="tab-appointments" className="text-xs sm:text-sm">
                  <Calendar className="h-4 w-4 mr-1 hidden sm:inline" />
                  Appts
                </TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes" className="text-xs sm:text-sm">
                  <Stethoscope className="h-4 w-4 mr-1 hidden sm:inline" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-6">
                    <SummarySection icon={Heart} title="Current Health Status">
                      <p className="text-sm text-muted-foreground">
                        {summary.sections.currentHealthStatus.summary}
                      </p>
                      <div className="space-y-2">
                        {summary.sections.currentHealthStatus.activeConditions.map((condition, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            data-testid={`condition-item-${idx}`}
                          >
                            <div>
                              <p className="font-medium text-sm">{condition.condition}</p>
                              <p className="text-xs text-muted-foreground">{condition.keyInfo}</p>
                            </div>
                            <Badge className={getStatusColor(condition.status)}>
                              {condition.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Recent Vitals
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          {summary.sections.currentHealthStatus.recentVitals}
                        </p>
                      </div>
                    </SummarySection>
                  </CardContent>
                </Card>

                {summary.aiInsights && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Health Insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {summary.aiInsights.healthTrends.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            Health Trends
                          </h4>
                          <ul className="space-y-1">
                            {summary.aiInsights.healthTrends.map((trend, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                                {trend}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.aiInsights.attentionAreas.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            Areas Needing Attention
                          </h4>
                          <ul className="space-y-1">
                            {summary.aiInsights.attentionAreas.map((area, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                                {area}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.aiInsights.positiveProgress.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Positive Progress
                          </h4>
                          <ul className="space-y-1">
                            {summary.aiInsights.positiveProgress.map((progress, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                                {progress}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={GitBranch} title="Health Timeline">
                      <p className="text-sm text-muted-foreground">
                        {summary.healthTimeline?.summary || "No timeline data available"}
                      </p>
                      
                      <Alert className="mt-3">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          This timeline is for informational purposes only. It summarizes documented health events and does not constitute clinical decision support. Always verify with complete medical records.
                        </AlertDescription>
                      </Alert>
                      
                      {summary.healthTimeline?.keyMilestones && summary.healthTimeline.keyMilestones.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Key Milestones</h4>
                          <div className="flex flex-wrap gap-2">
                            {summary.healthTimeline.keyMilestones.map((milestone, idx) => (
                              <Badge key={idx} variant="secondary" data-testid={`milestone-${idx}`}>
                                {milestone}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <ScrollArea className="h-96 mt-4">
                        <div className="relative">
                          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" aria-hidden="true" />
                          <div className="space-y-4">
                            {(summary.healthTimeline?.events || [])
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((event, idx) => (
                              <div
                                key={idx}
                                className="relative pl-10"
                                data-testid={`timeline-event-${idx}`}
                              >
                                <div className={`absolute left-2 top-1 p-1 rounded-full border-2 ${getSignificanceColor(event.significance)}`}>
                                  {getEventTypeIcon(event.eventType)}
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="font-medium text-sm">{event.title}</p>
                                    <Badge variant="outline" className="text-xs">{event.date}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{event.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className={`text-xs ${getSignificanceColor(event.significance)}`}>
                                      {event.significance}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground capitalize">{event.eventType.replace("_", " ")}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="care-gaps" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={Target} title="Care Gaps Analysis">
                      <p className="text-sm text-muted-foreground">
                        {summary.careGapsAnalysis?.summary || "No care gaps identified"}
                      </p>
                      
                      {summary.careGapsAnalysis && (
                        <div className="flex gap-4 mt-4">
                          <div className="p-3 rounded-lg bg-muted/50 text-center flex-1">
                            <p className="text-2xl font-bold">{summary.careGapsAnalysis.totalGaps}</p>
                            <p className="text-xs text-muted-foreground">Total Gaps</p>
                          </div>
                          <div className="p-3 rounded-lg bg-red-500/10 text-center flex-1">
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                              {summary.careGapsAnalysis.highPriorityCount}
                            </p>
                            <p className="text-xs text-muted-foreground">High Priority</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3 mt-4">
                        {(summary.careGapsAnalysis?.gaps || []).map((gap, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg border bg-card space-y-2"
                            data-testid={`care-gap-${idx}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{gap.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {gap.category.replace("_", " ")}
                                  </Badge>
                                  <Badge className={`text-xs ${getPriorityColor(gap.priority)}`}>
                                    {gap.priority} priority
                                  </Badge>
                                </div>
                              </div>
                              <Badge className={`text-xs shrink-0 ${
                                gap.status === "overdue" 
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                  : gap.status === "due_soon"
                                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              }`}>
                                {gap.status.replace("_", " ")}
                              </Badge>
                            </div>
                            {gap.dueDate && (
                              <p className="text-xs text-muted-foreground">
                                Due: {gap.dueDate}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </SummarySection>
                  </CardContent>
                </Card>
                
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Care gaps are identified based on clinical guidelines and patient history. This is informational only and does not constitute clinical decision support. Always verify with current clinical guidelines.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="labs" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={TestTube} title="Lab Results & Imaging">
                      <p className="text-sm text-muted-foreground">
                        {summary.labAndImagingSummary?.summary || "No lab or imaging data available"}
                      </p>
                      
                      <Alert className="mt-3">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Lab and imaging summaries are for informational purposes only. This does not constitute clinical decision support. Always review complete reports and consult with healthcare providers for interpretation.
                        </AlertDescription>
                      </Alert>
                      
                      {summary.labAndImagingSummary?.criticalFindings && summary.labAndImagingSummary.criticalFindings.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mt-4">
                          <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Critical Findings
                          </p>
                          <ul className="mt-2 space-y-1">
                            {summary.labAndImagingSummary.criticalFindings.map((finding, idx) => (
                              <li key={idx} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                                <ChevronRight className="h-4 w-4" />
                                {finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="mt-6">
                        <h4 className="text-sm font-medium mb-3">Recent Lab Results</h4>
                        <div className="space-y-2">
                          {(summary.labAndImagingSummary?.recentLabHighlights || []).map((lab, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-muted/50 flex items-center justify-between"
                              data-testid={`lab-result-${idx}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  {getTrendIcon(lab.trend)}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{lab.testName}</p>
                                  <p className="text-xs text-muted-foreground">{lab.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{lab.value}</span>
                                <Badge className={`text-xs ${getLabStatusColor(lab.status)}`}>
                                  {lab.status.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <Separator className="my-6" />
                      
                      <div>
                        <h4 className="text-sm font-medium mb-3">Recent Imaging Studies</h4>
                        <div className="space-y-3">
                          {(summary.labAndImagingSummary?.recentImagingHighlights || []).map((imaging, idx) => (
                            <div
                              key={idx}
                              className="p-4 rounded-lg border bg-card space-y-2"
                              data-testid={`imaging-result-${idx}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  <p className="font-medium text-sm">{imaging.studyType}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">{imaging.date}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{imaging.impression}</p>
                              <Badge className={`text-xs ${
                                imaging.status === "normal"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : imaging.status === "requires_follow_up"
                                  ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              }`}>
                                {imaging.status.replace("_", " ")}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sdoh" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={Home} title="Social Determinants of Health">
                      <p className="text-sm text-muted-foreground">
                        {summary.socialDeterminantsOfHealth?.summary || "No SDOH data available"}
                      </p>
                      
                      <Alert className="mt-3">
                        <Shield className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Social determinants information is for care coordination purposes only. This does not constitute clinical decision support. Refer to social work and community health resources for patient support.
                        </AlertDescription>
                      </Alert>
                      
                      {summary.socialDeterminantsOfHealth?.unaddressedNeeds && 
                       summary.socialDeterminantsOfHealth.unaddressedNeeds.length > 0 && (
                        <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 mt-4">
                          <p className="text-sm font-medium text-orange-700 dark:text-orange-300 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Unaddressed Needs
                          </p>
                          <ul className="mt-2 space-y-1">
                            {summary.socialDeterminantsOfHealth.unaddressedNeeds.map((need, idx) => (
                              <li key={idx} className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                                <ChevronRight className="h-4 w-4" />
                                {need}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="space-y-3 mt-4">
                        {(summary.socialDeterminantsOfHealth?.identifiedFactors || []).map((factor, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg border bg-card space-y-2"
                            data-testid={`sdoh-factor-${idx}`}
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="capitalize">
                                {getSdohCategoryLabel(factor.category)}
                              </Badge>
                              <Badge className={`text-xs ${getSdohStatusColor(factor.status)}`}>
                                {factor.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm">{factor.description}</p>
                            {factor.impact && (
                              <p className="text-xs text-muted-foreground">
                                Impact: {factor.impact}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {summary.socialDeterminantsOfHealth?.resourcesConnected && 
                       summary.socialDeterminantsOfHealth.resourcesConnected.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Connected Resources
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {summary.socialDeterminantsOfHealth.resourcesConnected.map((resource, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs" data-testid={`sdoh-resource-${idx}`}>
                                {resource}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </SummarySection>
                  </CardContent>
                </Card>
                
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Social determinants information is collected for care coordination purposes. This data helps identify factors that may affect health outcomes. Always refer to social work and care coordination teams for patient support services.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={FileText} title="Medical History Highlights">
                      <p className="text-sm text-muted-foreground">
                        {summary.sections.medicalHistoryHighlights.summary}
                      </p>
                      
                      <div className="space-y-4 mt-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Key Conditions</h4>
                          <div className="flex flex-wrap gap-2">
                            {summary.sections.medicalHistoryHighlights.keyConditions.map((condition, idx) => (
                              <Badge key={idx} variant="secondary" data-testid={`history-condition-${idx}`}>
                                {condition}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {summary.sections.medicalHistoryHighlights.significantEvents.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Significant Events</h4>
                            <ul className="space-y-1">
                              {summary.sections.medicalHistoryHighlights.significantEvents.map((event, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                                  <ChevronRight className="h-4 w-4" />
                                  {event}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="medications" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={Pill} title="Medication Summary">
                      <p className="text-sm text-muted-foreground">
                        {summary.sections.medicationSummary.summary}
                      </p>

                      <div className="space-y-3 mt-4">
                        {summary.sections.medicationSummary.keyMedications.map((med, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg bg-muted/50 space-y-1"
                            data-testid={`medication-item-${idx}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm">{med.name}</p>
                              <Badge variant="outline" className="text-xs">
                                {med.dosage}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{med.purpose}</p>
                          </div>
                        ))}
                      </div>

                      {summary.sections.medicationSummary.allergies.length > 0 && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Allergies
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {summary.sections.medicationSummary.allergies.join(", ")}
                          </p>
                        </div>
                      )}
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appointments" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={Calendar} title="Upcoming Care">
                      <p className="text-sm text-muted-foreground">
                        {summary.sections.upcomingCare.summary}
                      </p>

                      {summary.sections.upcomingCare.nextAppointment && (
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 mt-4">
                          <p className="text-xs text-muted-foreground mb-1">Next Appointment</p>
                          <p className="font-medium">{summary.sections.upcomingCare.nextAppointment}</p>
                        </div>
                      )}

                      <div className="space-y-2 mt-4">
                        {summary.sections.upcomingCare.appointments.map((apt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            data-testid={`appointment-item-${idx}`}
                          >
                            <div>
                              <p className="font-medium text-sm">{apt.type}</p>
                              <p className="text-xs text-muted-foreground">{apt.provider}</p>
                            </div>
                            <Badge variant="outline">{apt.date}</Badge>
                          </div>
                        ))}
                      </div>
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <SummarySection icon={Stethoscope} title="Recent Care Team Notes">
                      <p className="text-sm text-muted-foreground">
                        {summary.sections.careTeamUpdates.summary}
                      </p>

                      <ScrollArea className="h-64 mt-4">
                        <div className="space-y-3">
                          {summary.sections.careTeamUpdates.recentNotes.map((note, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-muted/50 space-y-2"
                              data-testid={`care-note-${idx}`}
                            >
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">{note.author}</p>
                                <Badge variant="outline" className="text-xs">{note.date}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{note.highlight}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {summary.sections.careTeamUpdates.actionItems.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium mb-2">Action Items</h4>
                          <ul className="space-y-1">
                            {summary.sections.careTeamUpdates.actionItems.map((item, idx) => (
                              <li key={idx} className="text-sm flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </SummarySection>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
                  Quick Reference
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Emergency Contact</p>
                  <p className="font-medium">{summary.quickReferenceBox.emergencyInfo}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Key Allergies</p>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    {summary.quickReferenceBox.keyAllergies}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground">Critical Medications</p>
                  <p className="font-medium">{summary.quickReferenceBox.criticalMedications}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Summary Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confidence</span>
                  <Badge
                    variant="outline"
                    className={
                      summary.metadata.confidenceLevel === "high"
                        ? "border-green-500 text-green-600"
                        : summary.metadata.confidenceLevel === "medium"
                        ? "border-yellow-500 text-yellow-600"
                        : "border-red-500 text-red-600"
                    }
                  >
                    {summary.metadata.confidenceLevel}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>{summary.metadata.summaryVersion}</span>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Data Sources</p>
                  <div className="flex flex-wrap gap-1">
                    {summary.metadata.dataSourcesUsed.map((source, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Generated: {format(new Date(summary.generatedAt), "PPpp")}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Expires: {format(new Date(summary.expiresAt), "PPpp")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
