import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  FileText,
  Heart,
  Activity,
  Pill,
  Search,
  Clock,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  User,
  Bell,
  Sparkles,
  TestTube,
  Stethoscope,
  Weight,
  Thermometer,
  Droplets,
  Upload,
  Loader2,
  Plus,
  Syringe,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  Gauge,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek } from "date-fns";
import { Link } from "wouter";

interface PatientProfile {
  id: string;
  name: string;
  dateOfBirth: string;
  avatarUrl?: string;
  primaryCondition?: string;
  careTeam: Array<{ name: string; role: string }>;
}

interface Appointment {
  id: string;
  patientName: string;
  providerName: string;
  facilityName: string;
  appointmentType: string;
  scheduledAt: string;
  status: string;
}

interface Document {
  id: string;
  title: string;
  category: string;
  updatedAt: string;
  latestVersion?: {
    extraction?: {
      summary: string;
      medications: any[];
      labValues: any[];
    };
  };
}

interface HealthMetric {
  id: string;
  name: string;
  value: string;
  unit: string;
  date: string;
  trend: "up" | "down" | "stable";
  isNormal: boolean;
  icon: string;
}

interface SearchResult {
  documentId: string;
  title: string;
  category: string;
  relevanceScore: number;
  matchedContent: string;
  highlightedSnippet: string;
}

interface HealthSummary {
  overview: string;
  keyInsights: Array<{
    category: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    actionable: boolean;
    action?: string;
  }>;
  recentConditions: Array<{
    name: string;
    status: string;
    onsetDate: string;
    severity: string;
  }>;
  activeMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    purpose: string;
    adherenceRate: number;
  }>;
  upcomingAppointments: Array<{
    type: string;
    provider: string;
    date: string;
    location: string;
  }>;
  latestVitals: Array<{
    name: string;
    value: string;
    unit: string;
    date: string;
    trend: "improving" | "stable" | "concerning";
    isNormal: boolean;
  }>;
  healthScore: number;
  riskAlerts: Array<{
    type: string;
    message: string;
    severity: "warning" | "critical" | "info";
  }>;
  lastUpdated: string;
  disclaimer: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: "condition" | "medication" | "appointment" | "observation" | "procedure" | "immunization" | "document";
  title: string;
  description: string;
  category: string;
  severity?: "low" | "medium" | "high";
  status?: string;
  icon?: string;
}

const categoryLabels: Record<string, string> = {
  labs: "Labs",
  imaging: "Imaging",
  medications: "Medications",
  diagnosis_pathology: "Diagnosis",
  treatment: "Treatment",
  follow_ups: "Follow-ups",
  general_medical: "General",
};

const emptyProfile: PatientProfile = {
  id: "",
  name: "",
  dateOfBirth: "",
  primaryCondition: "",
  careTeam: [],
};

function getMetricIcon(iconType: string) {
  switch (iconType) {
    case "heart": return Heart;
    case "activity": return Activity;
    case "weight": return Weight;
    case "droplets": return Droplets;
    case "test-tube": return TestTube;
    default: return Activity;
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "up": return TrendingUp;
    case "down": return TrendingDown;
    default: return Minus;
  }
}

function formatAppointmentDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
  if (isTomorrow(date)) return `Tomorrow at ${format(date, "h:mm a")}`;
  if (isThisWeek(date)) return format(date, "EEEE 'at' h:mm a");
  return format(date, "MMM d 'at' h:mm a");
}

export default function PatientHomeDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: profileData } = useQuery<{ profile: PatientProfile }>({
    queryKey: ["/api/profiles/current"],
  });
  
  const profile = profileData?.profile || {
    ...emptyProfile,
    name: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
    id: user?.id || "",
  };

  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: [`/api/appointments?profileId=${profile.id}`],
  });

  const { data: documentsData, isLoading: documentsLoading } = useQuery<{ documents: Document[] }>({
    queryKey: [`/api/documents/enhanced?profileId=${profile.id}`],
  });

  const { data: healthSummary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<HealthSummary>({
    queryKey: ["/api/health-summary/summary", profile.id],
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: ["/api/health-summary/timeline", profile.id],
  });
  
  const healthMetrics: HealthMetric[] = [];

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/documents/enhanced/search", { 
        query,
        profileId: profile.id,
      });
      return response.json();
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const upcomingAppointments = (appointmentsData?.appointments || [])
    .filter(a => a.status === "scheduled" && new Date(a.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 4);

  const recentDocuments = (documentsData?.documents || [])
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const searchResults = searchMutation.data?.results as SearchResult[] | undefined;

  const allMedications = recentDocuments
    .flatMap(doc => doc.latestVersion?.extraction?.medications || [])
    .slice(0, 5);

  const abnormalLabs = recentDocuments
    .flatMap(doc => doc.latestVersion?.extraction?.labValues || [])
    .filter((lab: any) => lab.isAbnormal)
    .slice(0, 3);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.avatarUrl} />
              <AvatarFallback className="text-lg">{profile.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-patient-name">
                Welcome back, {profile.name.split(" ")[0]}
              </h1>
              <p className="text-muted-foreground">
                {profile.primaryCondition && (
                  <span className="flex items-center gap-1">
                    <Stethoscope className="w-4 h-4" />
                    {profile.primaryCondition}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
            </Button>
            <Link href="/enhanced-documents">
              <Button data-testid="button-upload-document">
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {user && !user.isVerified && (
        <Alert className="mb-6" data-testid="alert-verification-pending">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle data-testid="text-verification-title">Identity Verification Pending</AlertTitle>
          <AlertDescription data-testid="text-verification-description">
            Your identity has not been verified yet. Some sensitive medical records may be restricted.{" "}
            <Link href="/login">
              <span className="underline font-medium cursor-pointer" data-testid="link-verify-identity">Sign in to verify your identity</span>
            </Link>{" "}
            to unlock full access to your health records.
          </AlertDescription>
        </Alert>
      )}

      {user?.isVerified && user.verificationProvider && (
        <Alert className="mb-6 border-primary/30" data-testid="alert-verification-confirmed">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle data-testid="text-verified-title">Identity Verified</AlertTitle>
          <AlertDescription data-testid="text-verified-description">
            Your identity has been verified — full access to your health records is enabled.
          </AlertDescription>
        </Alert>
      )}

      {/* AI Health Summary Section */}
      <Card className="mb-6 overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-6 h-6 text-primary" />
                My Health Summary
              </CardTitle>
              <CardDescription className="mt-1">
                AI-powered synthesis of your health records
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {healthSummary && (
                <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
                  <Gauge className="w-5 h-5 text-primary" />
                  <div className="text-right">
                    <p className="text-sm font-medium">Health Score</p>
                    <p className="text-lg font-bold">{healthSummary.healthScore}/100</p>
                  </div>
                </div>
              )}
              <Button variant="outline" size="icon" onClick={() => refetchSummary()} data-testid="button-refresh-summary">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            </div>
          ) : healthSummary ? (
            <>
              {/* Overview */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-base leading-relaxed">{healthSummary.overview}</p>
              </div>

              {/* Risk Alerts */}
              {healthSummary.riskAlerts.length > 0 && (
                <div className="space-y-2">
                  {healthSummary.riskAlerts.map((alert, idx) => (
                    <Alert key={idx} variant={alert.severity === "critical" ? "destructive" : "default"}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="capitalize">{alert.type.replace(/_/g, " ")}</AlertTitle>
                      <AlertDescription>{alert.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Key Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {healthSummary.keyInsights.map((insight, idx) => (
                  <Card key={idx} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant={insight.priority === "high" ? "destructive" : insight.priority === "medium" ? "default" : "secondary"}>
                          {insight.priority}
                        </Badge>
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                      </div>
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      {insight.actionable && insight.action && (
                        <div className="mt-2 flex items-center gap-1 text-primary text-sm">
                          <ArrowRight className="w-3 h-3" />
                          {insight.action}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Stethoscope className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{healthSummary.recentConditions.filter(c => c.status === "active").length}</p>
                    <p className="text-xs text-muted-foreground">Active Conditions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Pill className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{healthSummary.activeMedications.length}</p>
                    <p className="text-xs text-muted-foreground">Medications</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                    <p className="text-2xl font-bold">{healthSummary.upcomingAppointments.length}</p>
                    <p className="text-xs text-muted-foreground">Upcoming Appts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Activity className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                    <p className="text-2xl font-bold">{healthSummary.latestVitals.filter(v => !v.isNormal).length}</p>
                    <p className="text-xs text-muted-foreground">Vitals to Watch</p>
                  </CardContent>
                </Card>
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground text-center italic">
                {healthSummary.disclaimer}
              </p>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Health summary unavailable</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Timeline */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-primary" />
            Health Timeline
          </CardTitle>
          <CardDescription>
            Recent health events in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : timelineData?.events && timelineData.events.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {timelineData.events.slice(0, 8).map((event, idx) => (
                  <div key={event.id} className="relative pl-10" data-testid={`timeline-event-${idx}`}>
                    <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                      event.type === "condition" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" :
                      event.type === "medication" ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" :
                      event.type === "appointment" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" :
                      event.type === "procedure" ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" :
                      event.type === "immunization" ? "bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {event.type === "condition" && <Stethoscope className="w-3 h-3" />}
                      {event.type === "medication" && <Pill className="w-3 h-3" />}
                      {event.type === "appointment" && <Calendar className="w-3 h-3" />}
                      {event.type === "procedure" && <ClipboardCheck className="w-3 h-3" />}
                      {event.type === "immunization" && <Syringe className="w-3 h-3" />}
                      {event.type === "observation" && <Activity className="w-3 h-3" />}
                    </div>
                    <div className="p-3 rounded-lg border hover-elevate">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className="text-xs">{event.category}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {timelineData.events.length > 8 && (
                <div className="mt-4 text-center">
                  <Link href="/timeline">
                    <Button variant="ghost" size="sm" data-testid="button-view-full-timeline">
                      View Full Timeline
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No timeline events yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Search Your Health Records
          </CardTitle>
          <CardDescription>
            Ask questions in plain English to find information across all your documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., 'What are my current medications?' or 'Show recent lab results'"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
              data-testid="input-dashboard-search"
            />
            <Button 
              onClick={handleSearch} 
              disabled={searchMutation.isPending || !searchQuery.trim()}
              data-testid="button-dashboard-search"
            >
              {searchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["My medications", "Recent lab results", "Upcoming appointments", "Treatment history"].map(suggestion => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery(suggestion);
                  searchMutation.mutate(suggestion);
                }}
                data-testid={`button-suggestion-${suggestion.slice(0, 10)}`}
              >
                {suggestion}
              </Button>
            ))}
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Search Results ({searchResults.length})</p>
              {searchResults.slice(0, 3).map((result, idx) => (
                <div key={result.documentId} className="p-3 rounded-lg border hover-elevate">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-muted-foreground">{result.highlightedSnippet}</p>
                    </div>
                    <Badge variant="secondary">{Math.round(result.relevanceScore * 100)}%</Badge>
                  </div>
                </div>
              ))}
              <Link href="/enhanced-documents">
                <Button variant="ghost" size="sm" className="px-0">
                  View all results
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
              <Link href="/appointments">
                <Button variant="ghost" size="sm" data-testid="button-view-all-appointments">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No upcoming appointments</p>
                  <Link href="/appointments">
                    <Button variant="ghost" size="sm">Schedule an appointment</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map(apt => (
                    <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{apt.appointmentType}</p>
                          <p className="text-sm text-muted-foreground">{apt.providerName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatAppointmentDate(apt.scheduledAt)}</p>
                        <p className="text-xs text-muted-foreground">{apt.facilityName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-primary" />
                Recent Documents
              </CardTitle>
              <Link href="/enhanced-documents">
                <Button variant="ghost" size="sm" data-testid="button-view-all-documents">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : recentDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No documents yet</p>
                  <Link href="/enhanced-documents">
                    <Button variant="ghost" size="sm">Upload your first document</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border hover-elevate">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {doc.latestVersion?.extraction?.summary || categoryLabels[doc.category] || doc.category}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{categoryLabels[doc.category] || doc.category}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Health Metrics
              </CardTitle>
              <Link href="/health-metrics">
                <Button variant="ghost" size="sm" data-testid="button-view-all-metrics">
                  View All
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {healthMetrics.map(metric => {
                const Icon = getMetricIcon(metric.icon);
                const TrendIcon = getTrendIcon(metric.trend);
                return (
                  <div key={metric.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        metric.isNormal ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                      }`}>
                        <Icon className={`w-4 h-4 ${metric.isNormal ? "text-green-600" : "text-amber-600"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(metric.date), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{metric.value}</span>
                      <span className="text-xs text-muted-foreground">{metric.unit}</span>
                      <TrendIcon className={`w-4 h-4 ${
                        metric.trend === "up" ? "text-green-500" :
                        metric.trend === "down" ? "text-red-500" :
                        "text-muted-foreground"
                      }`} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
            <CardFooter className="pt-0">
              <Link href="/health-metrics" className="w-full">
                <Button variant="outline" className="w-full" data-testid="button-log-metric-dashboard">
                  <Plus className="w-4 h-4 mr-2" />
                  Log New Metric
                </Button>
              </Link>
            </CardFooter>
          </Card>

          {allMedications.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Pill className="w-5 h-5 text-blue-500" />
                  Current Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allMedications.map((med: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded border">
                      <div>
                        <p className="text-sm font-medium">{med.name}</p>
                        {med.dosage && <p className="text-xs text-muted-foreground">{med.dosage}</p>}
                      </div>
                      {med.frequency && (
                        <Badge variant="outline" className="text-xs">{med.frequency}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {abnormalLabs.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Attention Needed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {abnormalLabs.map((lab: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-amber-50 dark:bg-amber-900/20">
                      <div>
                        <p className="text-sm font-medium">{lab.testName}</p>
                        <p className="text-xs text-muted-foreground">
                          {lab.value} {lab.unit} (Ref: {lab.referenceRange})
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs">Abnormal</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" />
                Care Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profile.careTeam.map((member, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
