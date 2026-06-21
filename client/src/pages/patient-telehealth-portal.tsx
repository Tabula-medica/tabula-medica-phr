import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Video, Calendar, Clock, FileText, Plus, Loader2, Sparkles,
  MessageSquare, Send, BookOpen, Activity, ChevronRight,
  CalendarDays, AlertTriangle, CheckCircle, User, Mail
} from "lucide-react";

const PATIENT_ID = "patient-001";

interface PortalDashboard {
  upcomingVisits: any[];
  pastVisits: any[];
  summaries: any[];
  unreadMessages: number;
  totalMessages: number;
  educationArticles: number;
  nextAppointment: any | null;
}

interface MessageThread {
  threadId: string;
  subject: string;
  providerName: string;
  providerId: string;
  lastMessage: string;
  lastSenderName: string;
  lastSenderRole: string;
  lastMessageAt: string;
  unreadCount: number;
  messageCount: number;
  messages: any[];
}

interface EducationArticle {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  content: string;
  topics: string[];
  readingLevel: string;
  noCdsDisclaimer: string;
  aiGenerated: boolean;
  createdAt: string;
}

interface SessionSummary {
  id: string;
  sessionId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  visitDate: string;
  duration: number;
  chiefComplaint: string;
  diagnosisDiscussed: string[];
  treatmentPlan: string;
  medicationChanges: string[];
  followUpInstructions: string[];
  nextSteps: string[];
  patientQuestions: string[];
  additionalNotes: string;
  noCdsDisclaimer: string;
  createdAt: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function PatientTelehealthPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visits");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<SessionSummary | null>(null);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<EducationArticle | null>(null);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [educationTopic, setEducationTopic] = useState("");

  const [scheduleForm, setScheduleForm] = useState({
    clinicianId: "clinician-001",
    clinicianName: "Dr. Sarah Johnson",
    reason: "",
    date: "",
    duration: "30",
  });

  const { data: dashboard, isLoading: dashLoading } = useQuery<PortalDashboard>({
    queryKey: ["/api/telehealth/patient", PATIENT_ID, "portal-dashboard"],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/patient/${PATIENT_ID}/portal-dashboard`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  const { data: messageThreads, isLoading: msgsLoading } = useQuery<MessageThread[]>({
    queryKey: ["/api/telehealth/patient", PATIENT_ID, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/patient/${PATIENT_ID}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
  });

  const { data: educationArticles, isLoading: eduLoading } = useQuery<EducationArticle[]>({
    queryKey: ["/api/telehealth/patient", PATIENT_ID, "education"],
    queryFn: async () => {
      const res = await fetch(`/api/telehealth/patient/${PATIENT_ID}/education`);
      if (!res.ok) throw new Error("Failed to load education content");
      return res.json();
    },
  });

  const { data: availableSlots } = useQuery<any[]>({
    queryKey: ["/api/telehealth/available-slots", scheduleForm.clinicianId, scheduleForm.date],
    queryFn: async () => {
      const date = scheduleForm.date || new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/telehealth/available-slots?clinicianId=${scheduleForm.clinicianId}&date=${date}`);
      if (!res.ok) throw new Error("Failed to load slots");
      return res.json();
    },
    enabled: isScheduleOpen,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/telehealth/appointments", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment Scheduled", description: "Your virtual visit has been scheduled successfully." });
      setIsScheduleOpen(false);
      setScheduleForm({ clinicianId: "clinician-001", clinicianName: "Dr. Sarah Johnson", reason: "", date: "", duration: "30" });
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/patient", PATIENT_ID, "portal-dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment. Please try again.", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; providerId: string; providerName: string; subject: string; parentMessageId?: string }) => {
      const res = await apiRequest("POST", `/api/telehealth/patient/${PATIENT_ID}/messages`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message Sent", description: "Your message has been sent securely." });
      setNewMessageContent("");
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/patient", PATIENT_ID, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/patient", PATIENT_ID, "portal-dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const generateEducationMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", `/api/telehealth/patient/${PATIENT_ID}/education/generate`, { topic });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Content Generated", description: "New educational content is ready." });
      setEducationTopic("");
      setSelectedArticle(data);
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/patient", PATIENT_ID, "education"] });
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/patient", PATIENT_ID, "portal-dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate educational content.", variant: "destructive" });
    },
  });

  const handleSchedule = () => {
    if (!scheduleForm.reason || !scheduleForm.date) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const startTime = new Date(scheduleForm.date);
    const endTime = new Date(startTime.getTime() + parseInt(scheduleForm.duration) * 60000);

    scheduleMutation.mutate({
      patientId: PATIENT_ID,
      clinicianId: scheduleForm.clinicianId,
      patientName: "John Smith",
      clinicianName: scheduleForm.clinicianName,
      scheduledStartTime: startTime.toISOString(),
      scheduledEndTime: endTime.toISOString(),
      duration: parseInt(scheduleForm.duration),
      reason: scheduleForm.reason,
    });
  };

  const totalUnread = messageThreads?.reduce((acc, t) => acc + t.unreadCount, 0) || 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-4 border-b flex-wrap">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">My Telehealth Portal</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
            Manage your virtual visits, messages, and health information
          </p>
        </div>
        <Button onClick={() => setIsScheduleOpen(true)} data-testid="button-schedule-visit">
          <Plus className="w-4 h-4 mr-2" />
          Schedule Visit
        </Button>
      </div>

      {dashLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("visits")} data-testid="stat-upcoming">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upcoming</span>
                </div>
                <p className="text-2xl font-semibold mt-1">{dashboard?.upcomingVisits?.length || 0}</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("summaries")} data-testid="stat-summaries">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Summaries</span>
                </div>
                <p className="text-2xl font-semibold mt-1">{dashboard?.summaries?.length || 0}</p>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("messages")} data-testid="stat-messages">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Messages</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-2xl font-semibold">{dashboard?.totalMessages || 0}</p>
                  {totalUnread > 0 && (
                    <Badge variant="destructive" className="text-xs" data-testid="badge-unread-count">{totalUnread} new</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("education")} data-testid="stat-education">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Education</span>
                </div>
                <p className="text-2xl font-semibold mt-1">{dashboard?.educationArticles || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-4">
              <TabsList className="w-full justify-start flex-wrap">
                <TabsTrigger value="visits" data-testid="tab-visits">
                  <CalendarDays className="w-4 h-4 mr-1" />
                  My Visits
                </TabsTrigger>
                <TabsTrigger value="summaries" data-testid="tab-summaries">
                  <FileText className="w-4 h-4 mr-1" />
                  Summaries
                </TabsTrigger>
                <TabsTrigger value="messages" data-testid="tab-messages">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Messages
                  {totalUnread > 0 && (
                    <Badge variant="destructive" className="ml-1 text-xs">{totalUnread}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="education" data-testid="tab-education">
                  <BookOpen className="w-4 h-4 mr-1" />
                  Education
                </TabsTrigger>
              </TabsList>
            </div>

            {/* My Visits Tab */}
            <TabsContent value="visits" className="flex-1 overflow-auto p-4 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-3" data-testid="text-upcoming-heading">Upcoming Visits</h2>
                {(dashboard?.upcomingVisits?.length || 0) === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground" data-testid="text-no-upcoming">No upcoming visits scheduled</p>
                      <Button variant="outline" className="mt-3" onClick={() => setIsScheduleOpen(true)} data-testid="button-schedule-cta">
                        Schedule a Visit
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {dashboard!.upcomingVisits.map((apt: any) => (
                      <Card key={apt.id} data-testid={`card-upcoming-${apt.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium" data-testid={`text-provider-${apt.id}`}>{apt.clinicianName}</p>
                                <Badge variant={apt.status === "in_progress" ? "default" : "secondary"} data-testid={`badge-status-${apt.id}`}>
                                  {apt.status === "in_progress" ? "In Progress" : "Scheduled"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{apt.reason}</p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {formatDate(apt.scheduledStartTime)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatTime(apt.scheduledStartTime)}
                                </span>
                                <span>{apt.duration} min</span>
                              </div>
                            </div>
                            <Button
                              onClick={() => window.open(`/telehealth/room/${apt.roomId}`, "_blank")}
                              disabled={apt.status !== "in_progress" && apt.status !== "scheduled"}
                              data-testid={`button-join-${apt.id}`}
                            >
                              <Video className="w-4 h-4 mr-2" />
                              {apt.status === "in_progress" ? "Rejoin Call" : "Join Call"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h2 className="text-lg font-semibold mb-3" data-testid="text-past-heading">Past Visits</h2>
                {(dashboard?.pastVisits?.length || 0) === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground" data-testid="text-no-past">No past visits</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {dashboard!.pastVisits.slice(0, 10).map((apt: any) => (
                      <Card key={apt.id} data-testid={`card-past-${apt.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{apt.clinicianName}</p>
                                <Badge
                                  variant={apt.status === "completed" ? "secondary" : "outline"}
                                >
                                  {apt.status === "completed" ? "Completed" : apt.status === "cancelled" ? "Cancelled" : "Past"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{apt.reason}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(apt.scheduledStartTime)} at {formatTime(apt.scheduledStartTime)}
                              </p>
                            </div>
                            {apt.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setActiveTab("summaries");
                                  const summary = dashboard?.summaries?.find(
                                    (s: any) => s.appointmentId === apt.id
                                  );
                                  if (summary) setSelectedSummary(summary);
                                }}
                                data-testid={`button-view-summary-${apt.id}`}
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                View Summary
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Summaries Tab */}
            <TabsContent value="summaries" className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
                <div className="lg:col-span-1 space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2" data-testid="text-summaries-list-heading">Visit Summaries</h3>
                  <ScrollArea className="h-[500px]">
                    {(dashboard?.summaries?.length || 0) === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground" data-testid="text-no-summaries">No visit summaries available yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2 pr-2">
                        {dashboard!.summaries.map((s: any) => (
                          <Card
                            key={s.id}
                            className={`cursor-pointer hover-elevate ${selectedSummary?.id === s.id ? "ring-2 ring-primary" : ""}`}
                            onClick={() => setSelectedSummary(s)}
                            data-testid={`card-summary-${s.id}`}
                          >
                            <CardContent className="p-3">
                              <p className="font-medium text-sm">{s.providerName}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(s.visitDate)}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.chiefComplaint}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="lg:col-span-2">
                  {!selectedSummary ? (
                    <Card className="h-full">
                      <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px]">
                        <FileText className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground" data-testid="text-select-summary">Select a visit summary to view details</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <CardTitle className="text-base" data-testid="text-summary-title">
                              Visit with {selectedSummary.providerName}
                            </CardTitle>
                            <CardDescription>{formatDate(selectedSummary.visitDate)} - {Math.round(selectedSummary.duration / 60)} min</CardDescription>
                          </div>
                          {(selectedSummary as any).aiGenerated && (
                            <Badge variant="secondary" data-testid="badge-ai-generated">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-1">Reason for Visit</h4>
                              <p className="text-sm" data-testid="text-chief-complaint">{selectedSummary.chiefComplaint}</p>
                            </div>

                            {selectedSummary.diagnosisDiscussed.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Topics Discussed</h4>
                                <div className="flex gap-1.5 flex-wrap">
                                  {selectedSummary.diagnosisDiscussed.map((d, i) => (
                                    <Badge key={i} variant="outline">{d}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedSummary.treatmentPlan && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Care Plan Notes</h4>
                                <p className="text-sm">{selectedSummary.treatmentPlan}</p>
                              </div>
                            )}

                            {selectedSummary.medicationChanges.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Medication Updates</h4>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                  {selectedSummary.medicationChanges.map((m, i) => (
                                    <li key={i}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedSummary.followUpInstructions.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Follow-Up Instructions</h4>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                  {selectedSummary.followUpInstructions.map((f, i) => (
                                    <li key={i}>{f}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedSummary.nextSteps.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Next Steps</h4>
                                <ul className="list-disc pl-5 text-sm space-y-1">
                                  {selectedSummary.nextSteps.map((n, i) => (
                                    <li key={i}>{n}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {selectedSummary.additionalNotes && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-1">Additional Notes</h4>
                                <p className="text-sm">{selectedSummary.additionalNotes}</p>
                              </div>
                            )}

                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-4">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="text-disclaimer">
                                  {selectedSummary.noCdsDisclaimer}
                                </p>
                              </div>
                            </div>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Messages Tab */}
            <TabsContent value="messages" className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
                <div className="lg:col-span-1 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-muted-foreground" data-testid="text-messages-heading">Conversations</h3>
                  </div>

                  {msgsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (messageThreads?.length || 0) === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground" data-testid="text-no-messages">No messages yet</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[450px]">
                      <div className="space-y-2 pr-2">
                        {messageThreads!.map((thread) => (
                          <Card
                            key={thread.threadId}
                            className={`cursor-pointer hover-elevate ${selectedThread?.threadId === thread.threadId ? "ring-2 ring-primary" : ""}`}
                            onClick={() => setSelectedThread(thread)}
                            data-testid={`card-thread-${thread.threadId}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{thread.subject}</p>
                                    {thread.unreadCount > 0 && (
                                      <Badge variant="destructive" className="text-xs shrink-0">{thread.unreadCount}</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">{thread.providerName}</p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{thread.lastMessage}</p>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">{formatRelative(thread.lastMessageAt)}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">New Message</h4>
                    <Textarea
                      placeholder="Write a message to your care team..."
                      value={newMessageContent}
                      onChange={(e) => setNewMessageContent(e.target.value)}
                      className="text-sm resize-none"
                      rows={3}
                      data-testid="input-new-message"
                    />
                    <Button
                      size="sm"
                      disabled={!newMessageContent.trim() || sendMessageMutation.isPending}
                      onClick={() => {
                        sendMessageMutation.mutate({
                          content: newMessageContent,
                          providerId: "clinician-001",
                          providerName: "Dr. Sarah Johnson",
                          subject: "New Message",
                        });
                      }}
                      data-testid="button-send-new-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  {!selectedThread ? (
                    <Card className="h-full">
                      <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px]">
                        <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground" data-testid="text-select-thread">Select a conversation to view messages</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="flex flex-col h-full min-h-[500px]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base" data-testid="text-thread-subject">{selectedThread.subject}</CardTitle>
                        <CardDescription>Conversation with {selectedThread.providerName}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col min-h-0">
                        <ScrollArea className="flex-1 h-[350px]">
                          <div className="space-y-3 pr-2">
                            {selectedThread.messages.map((msg: any) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.senderRole === "patient" ? "justify-end" : "justify-start"}`}
                                data-testid={`message-${msg.id}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-md p-3 ${
                                    msg.senderRole === "patient"
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-medium">{msg.senderName}</span>
                                    <span className="text-xs opacity-70">{formatRelative(msg.createdAt)}</span>
                                  </div>
                                  <p className="text-sm">{msg.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Input
                            placeholder="Type a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey && replyContent.trim()) {
                                e.preventDefault();
                                sendMessageMutation.mutate({
                                  content: replyContent,
                                  providerId: selectedThread.providerId,
                                  providerName: selectedThread.providerName,
                                  subject: `Re: ${selectedThread.subject}`,
                                  parentMessageId: selectedThread.threadId,
                                });
                              }
                            }}
                            data-testid="input-reply"
                          />
                          <Button
                            size="icon"
                            disabled={!replyContent.trim() || sendMessageMutation.isPending}
                            onClick={() => {
                              sendMessageMutation.mutate({
                                content: replyContent,
                                providerId: selectedThread.providerId,
                                providerName: selectedThread.providerName,
                                subject: `Re: ${selectedThread.subject}`,
                                parentMessageId: selectedThread.threadId,
                              });
                            }}
                            data-testid="button-send-reply"
                          >
                            {sendMessageMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Education Tab */}
            <TabsContent value="education" className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
                <div className="lg:col-span-1 space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground" data-testid="text-education-heading">Health Education</h3>

                  <Card>
                    <CardContent className="p-3 space-y-2">
                      <Label className="text-sm">Generate Educational Content</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter a health topic..."
                          value={educationTopic}
                          onChange={(e) => setEducationTopic(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && educationTopic.trim()) {
                              generateEducationMutation.mutate(educationTopic);
                            }
                          }}
                          data-testid="input-education-topic"
                        />
                        <Button
                          size="icon"
                          disabled={!educationTopic.trim() || generateEducationMutation.isPending}
                          onClick={() => generateEducationMutation.mutate(educationTopic)}
                          data-testid="button-generate-education"
                        >
                          {generateEducationMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter a topic like "diabetes management" or "blood pressure" to generate personalized educational content
                      </p>
                    </CardContent>
                  </Card>

                  {eduLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (educationArticles?.length || 0) === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground" data-testid="text-no-education">
                        No educational content yet. Generate some using the topic box above.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2 pr-2">
                        {educationArticles!.map((article) => (
                          <Card
                            key={article.id}
                            className={`cursor-pointer hover-elevate ${selectedArticle?.id === article.id ? "ring-2 ring-primary" : ""}`}
                            onClick={() => setSelectedArticle(article)}
                            data-testid={`card-article-${article.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <p className="font-medium text-sm">{article.title}</p>
                                {article.aiGenerated && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Sparkles className="w-3 h-3 mr-0.5" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                              <p className="text-xs text-muted-foreground mt-1">{formatDate(article.createdAt)}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="lg:col-span-2">
                  {!selectedArticle ? (
                    <Card className="h-full">
                      <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px]">
                        <BookOpen className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground" data-testid="text-select-article">
                          Select an article or generate new content to read
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-base" data-testid="text-article-title">{selectedArticle.title}</CardTitle>
                          {selectedArticle.aiGenerated && (
                            <Badge variant="secondary" data-testid="badge-ai-education">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{selectedArticle.summary}</CardDescription>
                        {selectedArticle.topics.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-2">
                            {selectedArticle.topics.map((t, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[350px]">
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            {selectedArticle.content.split("\n").map((para, i) => (
                              <p key={i} className="text-sm mb-3" data-testid={`text-content-para-${i}`}>{para}</p>
                            ))}
                          </div>

                          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mt-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                              <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="text-education-disclaimer">
                                {selectedArticle.noCdsDisclaimer}
                              </p>
                            </div>
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Schedule Visit Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="text-schedule-title">Schedule a Virtual Visit</DialogTitle>
            <DialogDescription>Choose a provider, date, and time for your telehealth appointment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={scheduleForm.clinicianId}
                onValueChange={(v) => {
                  const name = v === "clinician-001" ? "Dr. Sarah Johnson" : "Dr. Michael Chen";
                  setScheduleForm((f) => ({ ...f, clinicianId: v, clinicianName: name }));
                }}
              >
                <SelectTrigger data-testid="select-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinician-001">Dr. Sarah Johnson</SelectItem>
                  <SelectItem value="clinician-002">Dr. Michael Chen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date & Time</Label>
              <Input
                type="datetime-local"
                value={scheduleForm.date}
                onChange={(e) => setScheduleForm((f) => ({ ...f, date: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
                data-testid="input-datetime"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={scheduleForm.duration} onValueChange={(v) => setScheduleForm((f) => ({ ...f, duration: v }))}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Visit</Label>
              <Textarea
                placeholder="Describe the reason for your visit..."
                value={scheduleForm.reason}
                onChange={(e) => setScheduleForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                data-testid="input-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)} data-testid="button-cancel-schedule">
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={scheduleMutation.isPending || !scheduleForm.reason || !scheduleForm.date}
              data-testid="button-confirm-schedule"
            >
              {scheduleMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}