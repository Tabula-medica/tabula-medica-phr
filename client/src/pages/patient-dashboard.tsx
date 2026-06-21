import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from "recharts";
import {
  Calendar,
  Activity,
  Heart,
  Thermometer,
  Stethoscope,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  Star,
  Send,
  Loader2,
  Pill,
  Scissors,
  ClipboardList,
  User,
  ChevronRight,
  BookOpen,
  Quote,
  AlertTriangle,
  Globe
} from "lucide-react";
import { formatDate, LoadingState } from "@/components/shared";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface HealthEvent {
  id: string;
  type: "appointment" | "diagnosis" | "procedure" | "lab" | "medication" | "immunization";
  title: string;
  description: string;
  date: string;
  provider?: string;
  location?: string;
  status: "completed" | "scheduled" | "cancelled";
  details?: Record<string, string>;
}

interface VitalSign {
  date: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  oxygenSaturation?: number;
}

interface PatientOutcome {
  id: string;
  type: "pain" | "mood" | "energy" | "sleep" | "function" | "satisfaction";
  score: number;
  maxScore: number;
  date: string;
  notes?: string;
}

interface FeedbackSubmission {
  id: string;
  category: string;
  rating: number;
  comment: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "addressed";
}

const EVENT_TYPE_CONFIG: Record<string, { icon: typeof Calendar; color: string; label: string }> = {
  appointment: { icon: Calendar, color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300", label: "Appointment" },
  diagnosis: { icon: Stethoscope, color: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300", label: "Diagnosis" },
  procedure: { icon: Scissors, color: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300", label: "Procedure" },
  lab: { icon: FileText, color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300", label: "Lab Result" },
  medication: { icon: Pill, color: "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-300", label: "Medication" },
  immunization: { icon: Activity, color: "bg-teal-100 text-teal-600 dark:bg-teal-900 dark:text-teal-300", label: "Immunization" }
};

const OUTCOME_LABELS: Record<string, string> = {
  pain: "Pain Level",
  mood: "Mood",
  energy: "Energy Level",
  sleep: "Sleep Quality",
  function: "Daily Function",
  satisfaction: "Treatment Satisfaction"
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export default function PatientDashboardPage() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [vitalType, setVitalType] = useState("blood_pressure");
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState("care_quality");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [outcomeType, setOutcomeType] = useState("pain");
  const [outcomeScore, setOutcomeScore] = useState([5]);
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [summaryLanguage, setSummaryLanguage] = useState("en");
  const [summaryTimeRange, setSummaryTimeRange] = useState("month");

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ success: boolean; data: HealthEvent[] }>({
    queryKey: ["/api/patient-dashboard/events"],
    queryFn: async () => {
      const res = await fetch("/api/patient-dashboard/events");
      return res.json();
    }
  });

  const { data: vitalsData } = useQuery<{ success: boolean; data: VitalSign[] }>({
    queryKey: ["/api/patient-dashboard/vitals"],
    queryFn: async () => {
      const res = await fetch("/api/patient-dashboard/vitals");
      return res.json();
    }
  });

  const { data: outcomesData } = useQuery<{ success: boolean; data: PatientOutcome[] }>({
    queryKey: ["/api/patient-dashboard/outcomes"],
    queryFn: async () => {
      const res = await fetch("/api/patient-dashboard/outcomes");
      return res.json();
    }
  });

  const { data: feedbackData } = useQuery<{ success: boolean; data: FeedbackSubmission[] }>({
    queryKey: ["/api/patient-dashboard/feedback"],
    queryFn: async () => {
      const res = await fetch("/api/patient-dashboard/feedback");
      return res.json();
    }
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/patient-dashboard/feedback", {
        category: feedbackCategory,
        rating: feedbackRating,
        comment: feedbackComment
      });
      return res.json();
    },
    onSuccess: () => {
      setFeedbackComment("");
      setFeedbackRating(5);
      queryClient.invalidateQueries({ queryKey: ["/api/patient-dashboard/feedback"] });
    }
  });

  const submitOutcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/patient-dashboard/outcomes", {
        type: outcomeType,
        score: outcomeScore[0],
        maxScore: 10,
        notes: outcomeNotes
      });
      return res.json();
    },
    onSuccess: () => {
      setOutcomeNotes("");
      setOutcomeScore([5]);
      queryClient.invalidateQueries({ queryKey: ["/api/patient-dashboard/outcomes"] });
    }
  });

  const events = eventsData?.data || [];
  const vitals = vitalsData?.data || [];
  const outcomes = outcomesData?.data || [];
  const feedback = feedbackData?.data || [];

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    if (summaryTimeRange === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (summaryTimeRange === "quarter") {
      startDate.setMonth(startDate.getMonth() - 3);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0]
    };
  };

  const { startDate, endDate } = getDateRange();

  const { data: timelineSummaryData, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<{
    success: boolean;
    data: {
      language: string;
      time_range: string;
      key_events: string[];
      new_results: string[];
      medications_documented: string[];
      documents_added: string[];
      what_changed: string[];
      quoted_evidence: Array<{ quote: string; source: string; date: string; record_id: string }>;
      limitations: string[];
      disclaimer: string;
    }
  }>({
    queryKey: ["/api/translation/timeline-summary", summaryLanguage, summaryTimeRange],
    queryFn: async () => {
      const timelineEvents = events.map(e => ({
        date: e.date,
        type: e.type,
        title: e.title,
        keyFields: e.details || {},
        source: e.provider || "Unknown",
        recordId: e.id
      }));
      const res = await fetch("/api/translation/timeline-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: summaryLanguage,
          startDate,
          endDate,
          events: timelineEvents
        })
      });
      return res.json();
    },
    enabled: events.length > 0
  });

  const timelineSummary = timelineSummaryData?.data;

  const sortedEvents = [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const groupedEvents = sortedEvents.reduce((acc, event) => {
    const year = new Date(event.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(event);
    return acc;
  }, {} as Record<number, HealthEvent[]>);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <User className="h-7 w-7 text-primary" />
          My Health Dashboard
        </h1>
        <p className="text-muted-foreground">
          View your health timeline, track vitals, and share how you're feeling.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-appointments">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{events.filter(e => e.type === "appointment").length}</p>
                <p className="text-xs text-muted-foreground">Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-diagnoses">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                <Stethoscope className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{events.filter(e => e.type === "diagnosis").length}</p>
                <p className="text-xs text-muted-foreground">Diagnoses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-procedures">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900">
                <Scissors className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{events.filter(e => e.type === "procedure").length}</p>
                <p className="text-xs text-muted-foreground">Procedures</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-outcomes">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                <ClipboardList className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outcomes.length}</p>
                <p className="text-xs text-muted-foreground">Reports Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary">
            <BookOpen className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <Heart className="h-4 w-4 mr-2" />
            Vitals
          </TabsTrigger>
          <TabsTrigger value="outcomes" data-testid="tab-outcomes">
            <TrendingUp className="h-4 w-4 mr-2" />
            My Reports
          </TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card data-testid="card-timeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Health Timeline
              </CardTitle>
              <CardDescription>
                Your appointments, diagnoses, procedures, and other health events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <LoadingState />
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No health events recorded yet
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-8">
                    {Object.entries(groupedEvents)
                      .sort(([a], [b]) => Number(b) - Number(a))
                      .map(([year, yearEvents]) => (
                        <div key={year}>
                          <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-background py-2">{year}</h3>
                          <div className="relative border-l-2 border-muted ml-4 space-y-6">
                            {yearEvents.map((event) => {
                              const config = EVENT_TYPE_CONFIG[event.type];
                              const Icon = config.icon;
                              return (
                                <div key={event.id} className="relative pl-6" data-testid={`event-${event.id}`}>
                                  <div className={`absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center ${config.color}`}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="bg-muted/30 rounded-lg p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{event.title}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {config.label}
                                          </Badge>
                                          {event.status === "scheduled" && (
                                            <Badge variant="secondary" className="text-xs">Upcoming</Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                                        {event.provider && (
                                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {event.provider}
                                            {event.location && ` • ${event.location}`}
                                          </p>
                                        )}
                                      </div>
                                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                                        {formatDate(event.date)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <Card data-testid="card-timeline-summary">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Health Story Summary
                  </CardTitle>
                  <CardDescription>
                    AI-generated summary of your health records with source citations
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={summaryTimeRange} onValueChange={(v) => { setSummaryTimeRange(v); }}>
                    <SelectTrigger className="w-[140px]" data-testid="select-time-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Past Month</SelectItem>
                      <SelectItem value="quarter">Past 3 Months</SelectItem>
                      <SelectItem value="year">Past Year</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={summaryLanguage} onValueChange={(v) => { setSummaryLanguage(v); }}>
                    <SelectTrigger className="w-[140px]" data-testid="select-language">
                      <Globe className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="zh-CN">中文</SelectItem>
                      <SelectItem value="vi">Tiếng Việt</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="ko">한국어</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => refetchSummary()} data-testid="button-refresh-summary">
                    Generate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <LoadingState />
              ) : !timelineSummary ? (
                <div className="text-center py-12 text-muted-foreground">
                  Select a time range and language, then click Generate to create your health summary.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{timelineSummary.time_range}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        Key Events
                      </h4>
                      <ul className="space-y-2">
                        {timelineSummary.key_events.map((event, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span>{event}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        New Results
                      </h4>
                      <ul className="space-y-2">
                        {timelineSummary.new_results.map((result, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Pill className="h-4 w-4 text-pink-500" />
                        Medications (as documented)
                      </h4>
                      <ul className="space-y-2">
                        {timelineSummary.medications_documented.map((med, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span>{med}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        Documents Added
                      </h4>
                      <ul className="space-y-2">
                        {timelineSummary.documents_added.map((doc, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {timelineSummary.what_changed.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        What Changed
                      </h4>
                      <ul className="space-y-2">
                        {timelineSummary.what_changed.map((change, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {timelineSummary.quoted_evidence.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Quote className="h-4 w-4 text-purple-500" />
                        Source Citations
                      </h4>
                      <div className="space-y-3">
                        {timelineSummary.quoted_evidence.map((evidence, i) => (
                          <div key={i} className="bg-muted/30 rounded-lg p-3 border-l-2 border-purple-500">
                            <p className="text-sm italic">"{evidence.quote}"</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              Source: {evidence.source} | Date: {formatDate(evidence.date)} | ID: {evidence.record_id}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {timelineSummary.limitations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Limitations
                      </h4>
                      <ul className="space-y-1">
                        {timelineSummary.limitations.map((limitation, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {timelineSummary.disclaimer}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vitals" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2" data-testid="card-vitals-chart">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Vital Sign Trends
                  </CardTitle>
                  <Select value={vitalType} onValueChange={setVitalType}>
                    <SelectTrigger className="w-[180px]" data-testid="select-vital-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                      <SelectItem value="heart_rate">Heart Rate</SelectItem>
                      <SelectItem value="weight">Weight</SelectItem>
                      <SelectItem value="oxygen">Oxygen Saturation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {vitalType === "blood_pressure" ? (
                      <AreaChart data={vitals}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" />
                        <YAxis domain={[60, 180]} className="text-xs" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                          labelFormatter={(label) => formatDate(label)}
                        />
                        <Legend />
                        <Area type="monotone" dataKey="systolic" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" name="Systolic" />
                        <Area type="monotone" dataKey="diastolic" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Diastolic" />
                      </AreaChart>
                    ) : vitalType === "heart_rate" ? (
                      <LineChart data={vitals}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" />
                        <YAxis domain={[50, 120]} className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="heartRate" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: "hsl(var(--destructive))" }} name="Heart Rate (bpm)" />
                      </LineChart>
                    ) : vitalType === "weight" ? (
                      <LineChart data={vitals}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" />
                        <YAxis domain={["auto", "auto"]} className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} name="Weight (lbs)" />
                      </LineChart>
                    ) : (
                      <LineChart data={vitals}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tickFormatter={formatShortDate} className="text-xs" />
                        <YAxis domain={[90, 100]} className="text-xs" />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Line type="monotone" dataKey="oxygenSaturation" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-3))" }} name="O2 Sat (%)" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-latest-vitals">
              <CardHeader>
                <CardTitle className="text-lg">Latest Readings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {vitals.length > 0 && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Blood Pressure</span>
                      </div>
                      <span className="font-medium">{vitals[vitals.length - 1]?.systolic}/{vitals[vitals.length - 1]?.diastolic}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Heart Rate</span>
                      </div>
                      <span className="font-medium">{vitals[vitals.length - 1]?.heartRate} bpm</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Weight</span>
                      </div>
                      <span className="font-medium">{vitals[vitals.length - 1]?.weight} lbs</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-teal-500" />
                        <span className="text-sm">O2 Saturation</span>
                      </div>
                      <span className="font-medium">{vitals[vitals.length - 1]?.oxygenSaturation}%</span>
                    </div>
                  </>
                )}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Last updated: {vitals.length > 0 ? formatDate(vitals[vitals.length - 1]?.date) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="outcomes" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-submit-outcome">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Report How You're Feeling
                </CardTitle>
                <CardDescription>
                  Track your symptoms and daily function to help your care team
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">What would you like to report?</label>
                  <Select value={outcomeType} onValueChange={setOutcomeType}>
                    <SelectTrigger className="mt-1" data-testid="select-outcome-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pain">Pain Level</SelectItem>
                      <SelectItem value="mood">Mood</SelectItem>
                      <SelectItem value="energy">Energy Level</SelectItem>
                      <SelectItem value="sleep">Sleep Quality</SelectItem>
                      <SelectItem value="function">Daily Function</SelectItem>
                      <SelectItem value="satisfaction">Treatment Satisfaction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Score: {outcomeScore[0]}/10</label>
                    <span className="text-xs text-muted-foreground">
                      {outcomeScore[0] <= 3 ? "Low" : outcomeScore[0] <= 6 ? "Moderate" : "High"}
                    </span>
                  </div>
                  <Slider
                    value={outcomeScore}
                    onValueChange={setOutcomeScore}
                    max={10}
                    min={1}
                    step={1}
                    className="w-full"
                    data-testid="slider-outcome-score"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1</span>
                    <span>5</span>
                    <span>10</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Additional Notes (optional)</label>
                  <Textarea
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    placeholder="Any details you'd like to share..."
                    rows={3}
                    className="mt-1"
                    data-testid="input-outcome-notes"
                  />
                </div>

                <Button
                  onClick={() => submitOutcomeMutation.mutate()}
                  disabled={submitOutcomeMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-outcome"
                >
                  {submitOutcomeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Report
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-outcome-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Your Recent Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {outcomes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No reports submitted yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outcomes.map((outcome) => (
                        <div
                          key={outcome.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`outcome-${outcome.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{OUTCOME_LABELS[outcome.type]}</span>
                              <Badge variant={outcome.score <= 3 ? "secondary" : outcome.score <= 6 ? "outline" : "default"}>
                                {outcome.score}/{outcome.maxScore}
                              </Badge>
                            </div>
                            {outcome.notes && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{outcome.notes}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(outcome.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card data-testid="card-submit-feedback">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Share Your Feedback
                </CardTitle>
                <CardDescription>
                  Help us improve your care experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={feedbackCategory} onValueChange={setFeedbackCategory}>
                    <SelectTrigger className="mt-1" data-testid="select-feedback-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="care_quality">Quality of Care</SelectItem>
                      <SelectItem value="communication">Communication</SelectItem>
                      <SelectItem value="wait_times">Wait Times</SelectItem>
                      <SelectItem value="facility">Facility</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Rating</label>
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className="p-1"
                        data-testid={`star-${star}`}
                      >
                        <Star
                          className={`h-6 w-6 ${star <= feedbackRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Your Feedback</label>
                  <Textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Tell us about your experience..."
                    rows={4}
                    className="mt-1"
                    data-testid="input-feedback-comment"
                  />
                </div>

                <Button
                  onClick={() => submitFeedbackMutation.mutate()}
                  disabled={!feedbackComment.trim() || submitFeedbackMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-feedback"
                >
                  {submitFeedbackMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-feedback-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Your Submitted Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  {feedback.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No feedback submitted yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {feedback.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border rounded-lg"
                          data-testid={`feedback-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="capitalize">{item.category.replace("_", " ")}</Badge>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: item.rating }).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-sm mt-2">{item.comment}</p>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant={item.status === "addressed" ? "default" : item.status === "reviewed" ? "secondary" : "outline"} className="text-xs">
                              {item.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatDate(item.submittedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Educational content only. Not medical advice.</strong> This dashboard is for informational purposes only. 
          It does not provide clinical recommendations or treatment guidance. Always consult with your healthcare provider 
          for medical decisions.
        </AlertDescription>
      </Alert>
    </div>
  );
}
