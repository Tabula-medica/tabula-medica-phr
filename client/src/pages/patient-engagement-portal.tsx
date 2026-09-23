import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parseISO, differenceInDays, differenceInHours } from "date-fns";
import { clickable } from "@/lib/a11y";
import {
  MessageSquare,
  Send,
  Calendar,
  Pill,
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Play,
  FileText,
  Video,
  Loader2,
  Bell,
  MapPin,
  Phone,
  User,
  Stethoscope,
  ClipboardList,
  Heart,
  Info
} from "lucide-react";

interface MessageThread {
  id: string;
  clinicianId: string;
  clinicianName: string;
  clinicianSpecialty: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isUrgent: boolean;
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderType: "patient" | "clinician";
  content: string;
  sentAt: string;
  isRead: boolean;
}

interface EducationalContent {
  id: string;
  title: string;
  description: string;
  category: string;
  contentType: string;
  duration: string;
  relevantConditions: string[];
  isCompleted: boolean;
  progress: number;
}

interface Appointment {
  id: string;
  clinicianName: string;
  clinicianSpecialty: string;
  appointmentType: string;
  scheduledAt: string;
  duration: number;
  location: string;
  status: string;
  reminderSent: boolean;
  hasQuestionnaire: boolean;
  questionnaireCompleted: boolean;
  notes: string | null;
}

interface Questionnaire {
  id: string;
  appointmentId: string;
  title: string;
  questions: Array<{
    id: string;
    text: string;
    type: "text" | "multiple_choice" | "scale" | "boolean";
    options?: string[];
    required: boolean;
  }>;
}

interface Prescription {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  frequency: string;
  prescriberName: string;
  pharmacyName: string;
  pharmacyPhone: string;
  lastFilledDate: string;
  refillsRemaining: number;
  daysSupply: number;
  daysUntilRefill: number;
  status: string;
  canRequestRefill: boolean;
  pendingRefillRequest: boolean;
  instructions: string;
}

const CONTENT_TYPE_ICONS: Record<string, typeof BookOpen> = {
  article: FileText,
  video: Video,
  interactive: Play
};

export default function PatientEngagementPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("messaging");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showQuestionnaireDialog, setShowQuestionnaireDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<Record<string, string | number | boolean>>({});

  const { data: threads, isLoading: threadsLoading, error: threadsError } = useQuery<MessageThread[]>({
    queryKey: ["/api/patient-engagement-portal/messaging/threads"],
  });

  const { data: messages, isLoading: messagesLoading, error: messagesError } = useQuery<Message[]>({
    queryKey: ["/api/patient-engagement-portal/messaging/threads", selectedThread, "messages"],
    queryFn: async () => {
      if (!selectedThread) return [];
      const res = await fetch(`/api/patient-engagement-portal/messaging/threads/${selectedThread}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedThread,
  });

  const { data: educationData, isLoading: educationLoading, error: educationError } = useQuery<{
    content: EducationalContent[];
    categories: string[];
    conditions: string[];
  }>({
    queryKey: ["/api/patient-engagement-portal/education"],
  });

  const { data: appointments, isLoading: appointmentsLoading, error: appointmentsError } = useQuery<Appointment[]>({
    queryKey: ["/api/patient-engagement-portal/appointments"],
  });

  const { data: questionnaire, isLoading: questionnaireLoading, error: questionnaireError } = useQuery<Questionnaire>({
    queryKey: ["/api/patient-engagement-portal/appointments", selectedAppointment?.id, "questionnaire"],
    queryFn: async () => {
      if (!selectedAppointment?.id) throw new Error("No appointment selected");
      const res = await fetch(`/api/patient-engagement-portal/appointments/${selectedAppointment.id}/questionnaire`);
      if (!res.ok) throw new Error("Failed to fetch questionnaire");
      return res.json();
    },
    enabled: showQuestionnaireDialog && !!selectedAppointment?.id,
  });

  const { data: prescriptions, isLoading: prescriptionsLoading, error: prescriptionsError } = useQuery<Prescription[]>({
    queryKey: ["/api/patient-engagement-portal/prescriptions"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThread || !newMessage.trim()) throw new Error("Invalid message");
      return apiRequest("POST", `/api/patient-engagement-portal/messaging/threads/${selectedThread}/messages`, { content: newMessage });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-portal/messaging/threads", selectedThread, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-portal/messaging/threads"] });
      toast({ title: "Message sent", description: "Your message has been sent to your care team." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    }
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment?.id) throw new Error("No appointment");
      const responses = Object.entries(questionnaireResponses).map(([questionId, answer]) => ({ questionId, answer }));
      return apiRequest("POST", `/api/patient-engagement-portal/appointments/${selectedAppointment.id}/questionnaire`, { responses });
    },
    onSuccess: () => {
      setShowQuestionnaireDialog(false);
      setQuestionnaireResponses({});
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-portal/appointments"] });
      toast({ title: "Questionnaire submitted", description: "Your care team will review your responses before your appointment." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit questionnaire. Please try again.", variant: "destructive" });
    }
  });

  const requestRefillMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      return apiRequest("POST", `/api/patient-engagement-portal/prescriptions/${prescriptionId}/refill`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement-portal/prescriptions"] });
      toast({ title: "Refill requested", description: "Your care team will process your request within 24-48 hours." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request refill. Please try again.", variant: "destructive" });
    }
  });

  const formatTimeAgo = (dateStr: string) => {
    const date = parseISO(dateStr);
    const hours = differenceInHours(new Date(), date);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = differenceInDays(new Date(), date);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
  };

  const totalUnread = threads?.reduce((sum, t) => sum + t.unreadCount, 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="patient-engagement-portal">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Patient Portal</h1>
          <p className="text-muted-foreground">Manage your health, connect with your care team</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>This portal is for educational and communication purposes only. Always consult your healthcare provider for medical advice.</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4" data-testid="portal-tabs">
          <TabsTrigger value="messaging" className="relative" data-testid="tab-messaging">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {totalUnread}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">
            <BookOpen className="h-4 w-4 mr-2" />
            Education
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="prescriptions" data-testid="tab-prescriptions">
            <Pill className="h-4 w-4 mr-2" />
            Prescriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messaging" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle>Conversations</CardTitle>
                <CardDescription>Messages with your care team</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[480px]">
                  {threadsLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : threadsError ? (
                    <div className="p-4 text-center text-destructive" data-testid="error-threads">
                      <XCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Failed to load messages</p>
                    </div>
                  ) : threads?.map(thread => (
                    <div
                      key={thread.id}
                      className={`p-4 border-b cursor-pointer hover-elevate ${selectedThread === thread.id ? "bg-muted" : ""}`}
                      {...clickable(() => setSelectedThread(thread.id))}
                      data-testid={`thread-${thread.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Stethoscope className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{thread.clinicianName}</p>
                            <p className="text-xs text-muted-foreground">{thread.clinicianSpecialty}</p>
                          </div>
                        </div>
                        {thread.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">{thread.unreadCount}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{thread.lastMessage}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatTimeAgo(thread.lastMessageAt)}</p>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader className="pb-3 border-b">
                {selectedThread && threads ? (
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {threads.find(t => t.id === selectedThread)?.clinicianName}
                      </CardTitle>
                      <CardDescription>
                        {threads.find(t => t.id === selectedThread)?.clinicianSpecialty}
                      </CardDescription>
                    </div>
                  </div>
                ) : (
                  <CardTitle className="text-muted-foreground">Select a conversation</CardTitle>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {selectedThread ? (
                  <>
                    <ScrollArea className="flex-1 p-4">
                      {messagesLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                        </div>
                      ) : messagesError ? (
                        <div className="text-center py-8 text-destructive" data-testid="error-messages">
                          <XCircle className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Failed to load messages</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {messages?.map(msg => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.senderType === "patient" ? "justify-end" : "justify-start"}`}
                              data-testid={`message-${msg.id}`}
                            >
                              <div className={`max-w-[70%] p-3 rounded-lg ${
                                msg.senderType === "patient"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${
                                  msg.senderType === "patient" ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}>
                                  {format(parseISO(msg.sentAt), "MMM d, h:mm a")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <div className="p-4 border-t">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type your message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="min-h-[60px] resize-none"
                          data-testid="input-message"
                        />
                        <Button
                          onClick={() => sendMessageMutation.mutate()}
                          disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view messages</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="education" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Health Education Library</CardTitle>
              <CardDescription>
                Personalized educational content based on your health conditions.
              </CardDescription>
              <div className="mt-2 p-3 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" data-testid="education-no-cds-disclaimer">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  <strong>NO-CDS Compliance:</strong> This educational content is for informational purposes only and does not constitute medical advice, diagnosis, or clinical decision support. Always consult your healthcare provider for personalized medical guidance.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {educationLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
                </div>
              ) : educationError ? (
                <div className="text-center py-8 text-destructive" data-testid="error-education">
                  <XCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load educational content</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {educationData?.content.map(item => {
                    const ContentIcon = CONTENT_TYPE_ICONS[item.contentType] || BookOpen;
                    return (
                      <Card key={item.id} className="hover-elevate" data-testid={`education-${item.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            {item.isCompleted && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <CardTitle className="text-base mt-2">{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <ContentIcon className="h-3 w-3" />
                              <span>{item.contentType}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{item.duration}</span>
                            </div>
                          </div>
                          {item.progress > 0 && item.progress < 100 && (
                            <Progress value={item.progress} className="h-1 mb-2" />
                          )}
                          <Button variant={item.isCompleted ? "outline" : "default"} size="sm" className="w-full" data-testid={`button-education-${item.id}`}>
                            {item.isCompleted ? "Review" : item.progress > 0 ? "Continue" : "Start"}
                            <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>View and prepare for your scheduled visits</CardDescription>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : appointmentsError ? (
                <div className="text-center py-8 text-destructive" data-testid="error-appointments">
                  <XCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load appointments</p>
                </div>
              ) : appointments?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming appointments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments?.map(apt => {
                    const aptDate = parseISO(apt.scheduledAt);
                    const daysUntil = differenceInDays(aptDate, new Date());
                    const isToday = daysUntil === 0;
                    const isTomorrow = daysUntil === 1;

                    return (
                      <div
                        key={apt.id}
                        className="p-4 rounded-lg border hover-elevate"
                        data-testid={`appointment-${apt.id}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                              isToday ? "bg-orange-100 dark:bg-orange-900" : "bg-primary/10"
                            }`}>
                              <Calendar className={`h-6 w-6 ${isToday ? "text-orange-600" : "text-primary"}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{apt.appointmentType}</h3>
                                {isToday && <Badge variant="destructive">Today</Badge>}
                                {isTomorrow && <Badge variant="outline">Tomorrow</Badge>}
                                {apt.status === "confirmed" && (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Confirmed
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {apt.clinicianName} - {apt.clinicianSpecialty}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(aptDate, "MMM d, yyyy 'at' h:mm a")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {apt.location}
                                </span>
                              </div>
                              {apt.notes && (
                                <div className="mt-2 p-2 bg-muted rounded text-sm">
                                  <Bell className="h-3 w-3 inline mr-1" />
                                  {apt.notes}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {apt.hasQuestionnaire && (
                              <Button
                                variant={apt.questionnaireCompleted ? "outline" : "default"}
                                size="sm"
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setShowQuestionnaireDialog(true);
                                }}
                                data-testid={`button-questionnaire-${apt.id}`}
                              >
                                <ClipboardList className="h-4 w-4 mr-2" />
                                {apt.questionnaireCompleted ? "View Questionnaire" : "Complete Questionnaire"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My Prescriptions</CardTitle>
              <CardDescription>Manage your medications and request refills</CardDescription>
            </CardHeader>
            <CardContent>
              {prescriptionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : prescriptionsError ? (
                <div className="text-center py-8 text-destructive" data-testid="error-prescriptions">
                  <XCircle className="h-12 w-12 mx-auto mb-4" />
                  <p>Failed to load prescriptions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions?.map(rx => (
                    <div
                      key={rx.id}
                      className={`p-4 rounded-lg border hover-elevate ${
                        rx.daysUntilRefill <= 7 ? "border-orange-500/50" : ""
                      }`}
                      data-testid={`prescription-${rx.id}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                            rx.daysUntilRefill <= 7 ? "bg-orange-100 dark:bg-orange-900" : "bg-primary/10"
                          }`}>
                            <Pill className={`h-6 w-6 ${rx.daysUntilRefill <= 7 ? "text-orange-600" : "text-primary"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{rx.medicationName}</h3>
                              {rx.daysUntilRefill <= 7 && (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Refill soon
                                </Badge>
                              )}
                              {rx.pendingRefillRequest && (
                                <Badge variant="outline">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Refill pending
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{rx.genericName}</p>
                            <p className="text-sm mt-1">
                              <strong>{rx.dosage}</strong> - {rx.frequency}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{rx.instructions}</p>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Prescribed by: {rx.prescriberName}</span>
                              <span>Pharmacy: {rx.pharmacyName}</span>
                              <span>{rx.refillsRemaining} refills remaining</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">Days until refill</p>
                            <p className={`text-lg font-bold ${rx.daysUntilRefill <= 7 ? "text-orange-600" : ""}`}>
                              {rx.daysUntilRefill}
                            </p>
                          </div>
                          {rx.canRequestRefill && !rx.pendingRefillRequest && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => requestRefillMutation.mutate(rx.id)}
                              disabled={requestRefillMutation.isPending}
                              data-testid={`button-refill-${rx.id}`}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Request Refill
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">
                            <Phone className="h-4 w-4 mr-2" />
                            {rx.pharmacyPhone}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showQuestionnaireDialog} onOpenChange={setShowQuestionnaireDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-questionnaire">
          <DialogHeader>
            <DialogTitle>{questionnaire?.title || "Pre-Visit Questionnaire"}</DialogTitle>
            <DialogDescription>
              Please complete this questionnaire before your appointment. Your responses help your care team prepare for your visit.
            </DialogDescription>
          </DialogHeader>
          {questionnaireLoading ? (
            <div className="space-y-4 py-4" data-testid="questionnaire-loading">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : questionnaireError ? (
            <div className="text-center py-8 text-destructive" data-testid="error-questionnaire">
              <XCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load questionnaire</p>
              <p className="text-xs text-muted-foreground mt-1">Please try again later</p>
            </div>
          ) : questionnaire && (
            <div className="space-y-6 py-4">
              {questionnaire.questions.map((q, idx) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {idx + 1}. {q.text}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {q.type === "text" && (
                    <Textarea
                      value={(questionnaireResponses[q.id] as string) || ""}
                      onChange={(e) => setQuestionnaireResponses(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Enter your response..."
                      data-testid={`input-${q.id}`}
                    />
                  )}
                  {q.type === "boolean" && (
                    <RadioGroup
                      value={(questionnaireResponses[q.id] as string) || ""}
                      onValueChange={(v) => setQuestionnaireResponses(prev => ({ ...prev, [q.id]: v }))}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                        <Label htmlFor={`${q.id}-yes`}>Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${q.id}-no`} />
                        <Label htmlFor={`${q.id}-no`}>No</Label>
                      </div>
                    </RadioGroup>
                  )}
                  {q.type === "multiple_choice" && q.options && (
                    <RadioGroup
                      value={(questionnaireResponses[q.id] as string) || ""}
                      onValueChange={(v) => setQuestionnaireResponses(prev => ({ ...prev, [q.id]: v }))}
                      className="space-y-2"
                    >
                      {q.options.map(opt => (
                        <div key={opt} className="flex items-center space-x-2">
                          <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                          <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  {q.type === "scale" && (
                    <div className="space-y-2">
                      <Slider
                        value={[(questionnaireResponses[q.id] as number) || 5]}
                        onValueChange={([v]) => setQuestionnaireResponses(prev => ({ ...prev, [q.id]: v }))}
                        min={1}
                        max={10}
                        step={1}
                        data-testid={`slider-${q.id}`}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1 (Poor)</span>
                        <span className="font-medium">{(questionnaireResponses[q.id] as number) || 5}</span>
                        <span>10 (Excellent)</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionnaireDialog(false)} data-testid="button-cancel-questionnaire">
              Cancel
            </Button>
            <Button
              onClick={() => submitQuestionnaireMutation.mutate()}
              disabled={submitQuestionnaireMutation.isPending}
              data-testid="button-submit-questionnaire"
            >
              {submitQuestionnaireMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Questionnaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
