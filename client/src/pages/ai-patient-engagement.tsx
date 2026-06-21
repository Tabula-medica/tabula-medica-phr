import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Heart,
  BookOpen,
  Bell,
  ClipboardCheck,
  Send,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Star,
  MessageSquare,
  RefreshCw,
  Eye,
  ThumbsUp,
  Loader2,
  ArrowRight,
  Activity,
  Shield,
  FileText,
  Target,
  Lightbulb,
} from "lucide-react";

interface PreventiveCareOutreach {
  id: string;
  patientId: string;
  patientName: string;
  type: "screening" | "immunization" | "wellness_visit" | "chronic_care" | "preventive_test";
  guidelineSource: string;
  recommendation: string;
  priority: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  lastCompleted?: string;
  ageGroup: string;
  riskFactors: string[];
  outreachStatus: "pending" | "sent" | "scheduled" | "completed" | "declined";
  aiReasoning: string;
  createdAt: string;
}

interface PersonalizedEducationContent {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  category: string;
  readingLevel: string;
  format: string;
  relevanceScore: number;
  relatedConditions: string[];
  keyTakeaways: string[];
  estimatedReadTime: number;
  delivered: boolean;
  viewed: boolean;
  viewedAt?: string;
  feedbackRating?: number;
  aiPersonalizationNote: string;
  createdAt: string;
}

interface AppointmentReminder {
  id: string;
  patientId: string;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  providerName: string;
  location: string;
  reminderType: string;
  channel: string;
  message: string;
  aiPersonalizedNote: string;
  sentAt?: string;
  status: "scheduled" | "sent" | "confirmed" | "rescheduled" | "cancelled";
  rescheduleRequested: boolean;
  alternativeSlots?: { date: string; time: string; available: boolean }[];
  createdAt: string;
}

interface SatisfactionSurvey {
  id: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  providerName: string;
  visitType: string;
  surveyType: string;
  status: "pending" | "sent" | "started" | "completed" | "expired";
  sentAt?: string;
  completedAt?: string;
  overallRating?: number;
  npsScore?: number;
  aiSentimentAnalysis?: {
    sentiment: "positive" | "neutral" | "negative";
    keyThemes: string[];
    improvementSuggestions: string[];
    followUpNeeded: boolean;
  };
  createdAt: string;
}

interface DashboardData {
  stats: {
    pendingOutreach: number;
    educationDelivered: number;
    upcomingReminders: number;
    surveysCompleted: number;
    avgSatisfactionScore: number;
    responseRate: number;
  };
  recentOutreach: PreventiveCareOutreach[];
  recentEducation: PersonalizedEducationContent[];
  upcomingReminders: AppointmentReminder[];
  recentSurveys: SatisfactionSurvey[];
  aiInsights: {
    type: "trend" | "recommendation" | "alert";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
  }[];
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "completed": case "confirmed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "sent": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "pending": case "scheduled": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "declined": case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "neutral": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "negative": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AIPatientEngagementPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["/api/patient-engagement-ai/dashboard"],
  });

  const sendOutreachMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/patient-engagement-ai/outreach/${id}/status`, { status: "sent" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-ai/dashboard"] });
      toast({ title: "Outreach sent successfully" });
    },
  });

  const deliverEducationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/patient-engagement-ai/education/${id}/deliver`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-ai/dashboard"] });
      toast({ title: "Education content delivered" });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/patient-engagement-ai/reminders/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-ai/dashboard"] });
      toast({ title: "Reminder sent successfully" });
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/patient-engagement-ai/reminders/${id}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-ai/dashboard"] });
      toast({ title: "Appointment confirmed" });
    },
  });

  const sendSurveyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/patient-engagement-ai/surveys/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-ai/dashboard"] });
      toast({ title: "Survey sent successfully" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">AI Patient Engagement</h1>
          <p className="text-muted-foreground">Proactive outreach, personalized education, and patient satisfaction</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800" data-testid="no-cds-disclaimer">
        <Shield className="h-4 w-4" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          This AI-powered patient engagement system is for informational and operational purposes only. 
          All recommendations are based on clinical guidelines but do not constitute clinical decision support. 
          Healthcare providers should use professional judgment for all patient care decisions.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-pending-outreach">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Outreach</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.pendingOutreach || 0}</div>
            <p className="text-xs text-muted-foreground">Preventive care campaigns</p>
          </CardContent>
        </Card>

        <Card data-testid="card-education-delivered">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Education Delivered</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.educationDelivered || 0}</div>
            <p className="text-xs text-muted-foreground">Personalized content</p>
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-reminders">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Reminders</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.upcomingReminders || 0}</div>
            <p className="text-xs text-muted-foreground">Appointment notifications</p>
          </CardContent>
        </Card>

        <Card data-testid="card-satisfaction-score">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.stats.avgSatisfactionScore || 0}/5</div>
            <p className="text-xs text-muted-foreground">{dashboard?.stats.responseRate || 0}% response rate</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="outreach" data-testid="tab-outreach">Preventive Outreach</TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">Education</TabsTrigger>
          <TabsTrigger value="reminders" data-testid="tab-reminders">Reminders</TabsTrigger>
          <TabsTrigger value="surveys" data-testid="tab-surveys">Surveys</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {dashboard?.aiInsights && dashboard.aiInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {dashboard.aiInsights.map((insight, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="flex items-start gap-3">
                        {insight.type === "trend" && <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />}
                        {insight.type === "alert" && <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />}
                        {insight.type === "recommendation" && <Target className="h-5 w-5 text-green-500 mt-0.5" />}
                        <div>
                          <h4 className="font-medium">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Recent Preventive Outreach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {dashboard?.recentOutreach.slice(0, 3).map(outreach => (
                      <div key={outreach.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{outreach.patientName}</span>
                            <Badge className={getPriorityColor(outreach.priority)}>{outreach.priority}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{outreach.recommendation}</p>
                          <p className="text-xs text-muted-foreground mt-1">Source: {outreach.guidelineSource}</p>
                        </div>
                        <Badge className={getStatusColor(outreach.outreachStatus)}>{outreach.outreachStatus}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Upcoming Appointment Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {dashboard?.upcomingReminders.slice(0, 3).map(reminder => (
                      <div key={reminder.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{reminder.patientName}</span>
                            <Badge variant="outline">{reminder.channel}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {reminder.appointmentType} with {reminder.providerName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {reminder.appointmentDate} at {reminder.appointmentTime}
                          </p>
                        </div>
                        <Badge className={getStatusColor(reminder.status)}>{reminder.status}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Recent Education Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {dashboard?.recentEducation.slice(0, 3).map(edu => (
                      <div key={edu.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{edu.title}</span>
                            <Badge variant="outline">{edu.format}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{edu.summary}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">{edu.estimatedReadTime} min read</span>
                            {edu.viewed && <CheckCircle className="h-3 w-3 text-green-500" />}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{Math.round(edu.relevanceScore * 100)}%</div>
                          <div className="text-xs text-muted-foreground">match</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Recent Satisfaction Surveys
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    {dashboard?.recentSurveys.slice(0, 3).map(survey => (
                      <div key={survey.id} className="flex items-start justify-between gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{survey.patientName}</span>
                            <Badge className={getStatusColor(survey.status)}>{survey.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {survey.visitType} - {survey.providerName}
                          </p>
                          {survey.aiSentimentAnalysis && (
                            <Badge className={`mt-2 ${getSentimentColor(survey.aiSentimentAnalysis.sentiment)}`}>
                              {survey.aiSentimentAnalysis.sentiment}
                            </Badge>
                          )}
                        </div>
                        {survey.overallRating && (
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="font-medium">{survey.overallRating.toFixed(1)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="outreach" className="space-y-4">
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Guideline-Based Outreach</AlertTitle>
            <AlertDescription>
              Preventive care recommendations are based on USPSTF, CDC ACIP, and ACA guidelines. 
              This is informational only and not clinical decision support.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Preventive Care Outreach Queue</CardTitle>
              <CardDescription>Proactive patient outreach based on clinical guidelines and patient history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.recentOutreach.map(outreach => (
                  <Card key={outreach.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{outreach.patientName}</span>
                          <Badge className={getPriorityColor(outreach.priority)}>{outreach.priority} priority</Badge>
                          <Badge variant="outline">{outreach.type.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-base mt-2">{outreach.recommendation}</p>
                        
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium">AI Reasoning:</p>
                          <p className="text-sm text-muted-foreground">{outreach.aiReasoning}</p>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                          <span>Source: {outreach.guidelineSource}</span>
                          <span>Age Group: {outreach.ageGroup}</span>
                          {outreach.dueDate && <span>Due: {formatDate(outreach.dueDate)}</span>}
                        </div>

                        {outreach.riskFactors.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {outreach.riskFactors.map((factor, idx) => (
                              <Badge key={idx} variant="secondary">{factor}</Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={getStatusColor(outreach.outreachStatus)}>{outreach.outreachStatus}</Badge>
                        {outreach.outreachStatus === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => sendOutreachMutation.mutate(outreach.id)}
                            disabled={sendOutreachMutation.isPending}
                            data-testid={`button-send-outreach-${outreach.id}`}
                          >
                            {sendOutreachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                            Send Outreach
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="education" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalized Health Education</CardTitle>
              <CardDescription>AI-curated educational content tailored to each patient's conditions and needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.recentEducation.map(edu => (
                  <Card key={edu.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{edu.title}</span>
                          <Badge variant="outline">{edu.format}</Badge>
                          <Badge variant="outline">{edu.readingLevel} level</Badge>
                        </div>
                        <p className="text-muted-foreground mt-2">{edu.summary}</p>

                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium">Key Takeaways:</p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                            {edu.keyTakeaways.slice(0, 3).map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm font-medium">Personalization:</p>
                          <p className="text-sm text-muted-foreground">{edu.aiPersonalizationNote}</p>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {edu.relatedConditions.map((condition, idx) => (
                            <Badge key={idx} variant="secondary">{condition}</Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" /> {edu.estimatedReadTime} min read
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-4 w-4" /> {Math.round(edu.relevanceScore * 100)}% relevant
                          </span>
                          {edu.viewed && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Eye className="h-4 w-4" /> Viewed
                            </span>
                          )}
                          {edu.feedbackRating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> {edu.feedbackRating}/5
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={edu.delivered ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                          {edu.delivered ? "Delivered" : "Pending"}
                        </Badge>
                        {!edu.delivered && (
                          <Button
                            size="sm"
                            onClick={() => deliverEducationMutation.mutate(edu.id)}
                            disabled={deliverEducationMutation.isPending}
                            data-testid={`button-deliver-education-${edu.id}`}
                          >
                            {deliverEducationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                            Deliver Content
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Driven Appointment Reminders</CardTitle>
              <CardDescription>Personalized reminders with rescheduling options</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.upcomingReminders.map(reminder => (
                  <Card key={reminder.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{reminder.patientName}</span>
                          <Badge variant="outline">{reminder.reminderType.replace("_", " ")}</Badge>
                          <Badge variant="outline">{reminder.channel}</Badge>
                        </div>

                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">{reminder.appointmentType}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {reminder.appointmentDate} at {reminder.appointmentTime}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            with {reminder.providerName} at {reminder.location}
                          </p>
                        </div>

                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm font-medium">AI Personalized Note:</p>
                          <p className="text-sm text-muted-foreground">{reminder.aiPersonalizedNote}</p>
                        </div>

                        {reminder.alternativeSlots && reminder.alternativeSlots.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Alternative Time Slots:</p>
                            <div className="flex flex-wrap gap-2">
                              {reminder.alternativeSlots.map((slot, idx) => (
                                <Badge
                                  key={idx}
                                  variant={slot.available ? "outline" : "secondary"}
                                  className={slot.available ? "cursor-pointer hover-elevate" : "opacity-50"}
                                >
                                  {slot.date} {slot.time}
                                  {!slot.available && " (Unavailable)"}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <Badge className={getStatusColor(reminder.status)}>{reminder.status}</Badge>
                        <div className="flex flex-col gap-2">
                          {reminder.status === "scheduled" && (
                            <Button
                              size="sm"
                              onClick={() => sendReminderMutation.mutate(reminder.id)}
                              disabled={sendReminderMutation.isPending}
                              data-testid={`button-send-reminder-${reminder.id}`}
                            >
                              {sendReminderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                              Send Reminder
                            </Button>
                          )}
                          {(reminder.status === "sent" || reminder.status === "scheduled") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmAppointmentMutation.mutate(reminder.id)}
                              disabled={confirmAppointmentMutation.isPending}
                              data-testid={`button-confirm-appointment-${reminder.id}`}
                            >
                              {confirmAppointmentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                              Confirm
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surveys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patient Satisfaction Surveys</CardTitle>
              <CardDescription>Automated post-visit surveys with AI sentiment analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboard?.recentSurveys.map(survey => (
                  <Card key={survey.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-lg">{survey.patientName}</span>
                          <Badge variant="outline">{survey.surveyType.replace("_", " ")}</Badge>
                          <Badge className={getStatusColor(survey.status)}>{survey.status}</Badge>
                        </div>

                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium">{survey.visitType}</p>
                          <p className="text-sm text-muted-foreground">
                            Provider: {survey.providerName} | Visit: {formatDate(survey.visitDate)}
                          </p>
                        </div>

                        {survey.aiSentimentAnalysis && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-medium">AI Sentiment Analysis:</p>
                              <Badge className={getSentimentColor(survey.aiSentimentAnalysis.sentiment)}>
                                {survey.aiSentimentAnalysis.sentiment}
                              </Badge>
                              {survey.aiSentimentAnalysis.followUpNeeded && (
                                <Badge variant="destructive">Follow-up Needed</Badge>
                              )}
                            </div>
                            
                            {survey.aiSentimentAnalysis.keyThemes.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-sm text-muted-foreground">Themes:</span>
                                {survey.aiSentimentAnalysis.keyThemes.map((theme, idx) => (
                                  <Badge key={idx} variant="secondary">{theme}</Badge>
                                ))}
                              </div>
                            )}

                            {survey.aiSentimentAnalysis.improvementSuggestions.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm text-muted-foreground">Suggestions:</span>
                                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                                  {survey.aiSentimentAnalysis.improvementSuggestions.map((sugg, idx) => (
                                    <li key={idx}>{sugg}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-4 mt-3">
                          {survey.overallRating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="font-medium">{survey.overallRating.toFixed(1)}/5</span>
                              <span className="text-sm text-muted-foreground">rating</span>
                            </div>
                          )}
                          {survey.npsScore !== undefined && (
                            <div className="flex items-center gap-1">
                              <ThumbsUp className="h-4 w-4" />
                              <span className="font-medium">{survey.npsScore}</span>
                              <span className="text-sm text-muted-foreground">NPS</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        {survey.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => sendSurveyMutation.mutate(survey.id)}
                            disabled={sendSurveyMutation.isPending}
                            data-testid={`button-send-survey-${survey.id}`}
                          >
                            {sendSurveyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                            Send Survey
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
