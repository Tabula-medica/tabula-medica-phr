import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Send,
  Sparkles,
  Pill,
  Calendar,
  ClipboardList,
  Heart,
  HelpCircle,
  FolderOpen,
  Bot,
  User,
  Clock,
  Bell,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Info,
  ArrowLeft,
  CalendarPlus,
  Stethoscope,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MedicationReminder {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  nextDose: string;
  instructions: string;
  adherenceScore: number;
  missedDoses: number;
  tips: string[];
}

interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  location: string;
  duration: number;
  available: boolean;
}

interface VisitGuidance {
  id: string;
  appointmentId: string;
  appointmentType: string;
  provider: string;
  date: string;
  phase: "pre_visit" | "post_visit";
  checklist: Array<{
    id: string;
    task: string;
    description: string;
    completed: boolean;
    required: boolean;
  }>;
  preparations: string[];
  questionsToAsk: string[];
  documentsToReview: string[];
  instructions: string[];
  followUpActions?: string[];
  noCdsDisclaimer: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
}

export default function PatientAIAssistant() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm your personal health assistant. I can help you with medication reminders, scheduling appointments, preparing for visits, and answering common health questions. How can I help you today?\n\nNote: This assistant provides educational information only and does not constitute medical advice. Always consult your healthcare provider for medical decisions.",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [appointmentReason, setAppointmentReason] = useState("");
  const [schedulingConfirmation, setSchedulingConfirmation] = useState<{ message: string; disclaimer: string } | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: quickActionsData, isLoading: loadingQuickActions } = useQuery<{ quickActions: QuickAction[]; stats: any }>({
    queryKey: ["/api/health-assistant/quick-actions"],
  });

  const { data: medicationData, isLoading: loadingMedications, refetch: refetchMedications } = useQuery<{ reminders: MedicationReminder[] }>({
    queryKey: ["/api/health-assistant/medication-reminders"],
    enabled: activeTab === "medications",
  });

  const { data: appointmentSlotsData, isLoading: loadingSlots, refetch: refetchSlots } = useQuery<{ slots: AppointmentSlot[] }>({
    queryKey: ["/api/health-assistant/appointment-slots"],
    enabled: activeTab === "schedule",
  });

  const visitPhase = activeTab === "pre-visit" ? "pre_visit" : "post_visit";
  const { data: visitGuidanceData, isLoading: loadingGuidance } = useQuery<{ guidance: VisitGuidance }>({
    queryKey: [`/api/health-assistant/visit-guidance?appointmentId=upcoming-1&phase=${visitPhase}`],
    enabled: activeTab === "pre-visit" || activeTab === "post-visit",
  });

  const scheduleAppointmentMutation = useMutation({
    mutationFn: async (data: { type: string; preferredDate: string; preferredTime: string; provider: string; specialty: string; reason: string }) => {
      const response = await apiRequest("POST", "/api/health-assistant/appointments", data);
      return response.json();
    },
    onSuccess: (result: { success: boolean; message: string; noCdsDisclaimer?: string }) => {
      const disclaimer = result.noCdsDisclaimer || "This is a scheduling confirmation only. For medical questions, please contact your healthcare provider.";
      toast({ 
        title: "Appointment Scheduled", 
        description: `${result.message}\n\n${disclaimer}` 
      });
      setSchedulingConfirmation({ message: result.message, disclaimer });
      setSelectedSlot(null);
      setAppointmentReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/appointment-slots"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment", variant: "destructive" });
    },
  });

  const askQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await apiRequest("POST", "/api/health-assistant/ask", { question });
      return response.json();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/health-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: inputMessage }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let assistantMessage = "";

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMessage += data.content;
              setMessages((prev) => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: "assistant",
                  content: assistantMessage,
                  timestamp: new Date(),
                };
                return newMessages;
              });
            }
          } catch (e) {}
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      calendar: Calendar,
      pill: Pill,
      clipboard: ClipboardList,
      heart: Heart,
      help: HelpCircle,
      folder: FolderOpen,
    };
    const Icon = icons[iconName] || HelpCircle;
    return <Icon className="h-5 w-5" />;
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "schedule":
        setActiveTab("schedule");
        break;
      case "medications":
        setActiveTab("medications");
        break;
      case "pre_visit":
        setActiveTab("pre-visit");
        break;
      case "post_visit":
        setActiveTab("post-visit");
        break;
      case "ask":
        setActiveTab("chat");
        inputRef.current?.focus();
        break;
      case "records":
        window.location.href = "/records";
        break;
    }
  };

  const toggleCheckItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Your Health Assistant</h1>
            <p className="text-muted-foreground">I'm here to help you manage your health</p>
          </div>
        </div>

        {!loadingQuickActions && quickActionsData?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quickActionsData.stats.upcomingAppointments}</p>
                  <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Pill className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quickActionsData.stats.activeMedications}</p>
                  <p className="text-sm text-muted-foreground">Active Medications</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-500/10">
                  <FolderOpen className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{quickActionsData.stats.documentsToReview}</p>
                  <p className="text-sm text-muted-foreground">Documents to Review</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="chat" className="gap-2" data-testid="tab-chat">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="medications" className="gap-2" data-testid="tab-medications">
              <Pill className="h-4 w-4" />
              <span className="hidden sm:inline">Medications</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2" data-testid="tab-schedule">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule</span>
            </TabsTrigger>
            <TabsTrigger value="pre-visit" className="gap-2" data-testid="tab-pre-visit">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Pre-Visit</span>
            </TabsTrigger>
            <TabsTrigger value="post-visit" className="gap-2" data-testid="tab-post-visit">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Post-Visit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <Card className="lg:col-span-3 flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Chat with Your Assistant
                  </CardTitle>
                  <CardDescription>Ask me about your medications, appointments, or health questions</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                              {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs opacity-70 mt-1">
                              {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                      {isStreaming && (
                        <div className="flex gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-muted">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
                <CardFooter>
                  <form
                    className="flex gap-2 w-full"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                  >
                    <Input
                      ref={inputRef}
                      placeholder="Type your message..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      disabled={isStreaming}
                      data-testid="input-chat-message"
                    />
                    <Button type="submit" disabled={isStreaming || !inputMessage.trim()} data-testid="button-send-message">
                      {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </CardFooter>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loadingQuickActions ? (
                      Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                    ) : (
                      quickActionsData?.quickActions?.map((action) => (
                        <Button
                          key={action.id}
                          variant="outline"
                          className="w-full justify-start gap-2 h-auto py-2"
                          onClick={() => handleQuickAction(action.action)}
                          data-testid={`quick-action-${action.id}`}
                        >
                          {getIconComponent(action.icon)}
                          <div className="text-left">
                            <p className="font-medium text-sm">{action.title}</p>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                          </div>
                        </Button>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important Notice</AlertTitle>
              <AlertDescription>
                This assistant provides general information only and is not a substitute for professional medical advice. For medical emergencies, call 911. For medical questions, contact your healthcare provider.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="medications" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Pill className="h-5 w-5 text-primary" />
                Medication Reminders
              </h2>
              <Button variant="outline" size="sm" onClick={() => refetchMedications()} data-testid="button-refresh-medications">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {loadingMedications ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
              </div>
            ) : medicationData?.reminders?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {medicationData.reminders.map((med) => (
                  <Card key={med.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{med.medicationName}</CardTitle>
                          <CardDescription>{med.dosage} - {med.frequency}</CardDescription>
                        </div>
                        <Badge variant={med.adherenceScore >= 90 ? "default" : med.adherenceScore >= 70 ? "secondary" : "destructive"}>
                          {med.adherenceScore}% adherence
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Next dose: {format(new Date(med.nextDose), "h:mm a, MMM d")}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span>{med.instructions}</span>
                      </div>
                      <Progress value={med.adherenceScore} className="h-2" />
                      {med.missedDoses > 0 && (
                        <p className="text-xs text-orange-500">
                          {med.missedDoses} missed dose{med.missedDoses > 1 ? "s" : ""} this week
                        </p>
                      )}
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Tips:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {med.tips.slice(0, 2).map((tip, i) => (
                            <li key={i} className="flex gap-1">
                              <span>•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No medications found</p>
                  <p className="text-sm">Your medication reminders will appear here</p>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>NO-CDS Disclaimer</AlertTitle>
              <AlertDescription>
                Medication reminders are for informational purposes only. Always follow your healthcare provider's instructions for taking medications.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule an Appointment
              </h2>
            </div>

            {schedulingConfirmation && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950" data-testid="scheduling-confirmation">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-700 dark:text-green-300">Appointment Confirmed</AlertTitle>
                <AlertDescription className="text-green-600 dark:text-green-400">
                  <p className="mb-2">{schedulingConfirmation.message}</p>
                  <p className="text-xs opacity-80">{schedulingConfirmation.disclaimer}</p>
                </AlertDescription>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2" 
                  onClick={() => setSchedulingConfirmation(null)}
                  data-testid="button-dismiss-confirmation"
                >
                  Dismiss
                </Button>
              </Alert>
            )}

            {selectedSlot ? (
              <Card>
                <CardHeader>
                  <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setSelectedSlot(null)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Available Slots
                  </Button>
                  <CardTitle>Confirm Your Appointment</CardTitle>
                  <CardDescription>Review and confirm your appointment details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Date & Time</p>
                      <p className="font-medium">{format(new Date(selectedSlot.date), "MMMM d, yyyy")} at {selectedSlot.time}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="font-medium">{selectedSlot.provider}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Specialty</p>
                      <p className="font-medium">{selectedSlot.specialty}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{selectedSlot.location}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Reason for Visit (optional)</label>
                    <Input
                      placeholder="e.g., Annual checkup, Follow-up visit"
                      value={appointmentReason}
                      onChange={(e) => setAppointmentReason(e.target.value)}
                      data-testid="input-appointment-reason"
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={scheduleAppointmentMutation.isPending}
                    onClick={() => {
                      scheduleAppointmentMutation.mutate({
                        type: "schedule",
                        preferredDate: selectedSlot.date,
                        preferredTime: selectedSlot.time,
                        provider: selectedSlot.provider,
                        specialty: selectedSlot.specialty,
                        reason: appointmentReason,
                      });
                    }}
                    data-testid="button-confirm-appointment"
                  >
                    {scheduleAppointmentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CalendarPlus className="h-4 w-4 mr-2" />
                    )}
                    Confirm Appointment
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Available Appointments</AlertTitle>
                  <AlertDescription>
                    Select a time slot to schedule your appointment. Available times are shown for the next two weeks.
                  </AlertDescription>
                </Alert>

                {loadingSlots ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                  </div>
                ) : appointmentSlotsData?.slots?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {appointmentSlotsData.slots.map((slot) => (
                      <Card
                        key={slot.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedSlot(slot)}
                        data-testid={`slot-${slot.id}`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{format(new Date(slot.date), "EEE, MMM d")}</p>
                              <p className="text-lg font-bold text-primary">{slot.time}</p>
                            </div>
                            <Badge variant="outline">{slot.duration} min</Badge>
                          </div>
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <Stethoscope className="h-4 w-4 text-muted-foreground" />
                              <span>{slot.provider}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{slot.specialty}</p>
                            <p className="text-xs text-muted-foreground">{slot.location}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No available slots found</p>
                      <p className="text-sm">Please try again later or contact our office</p>
                    </CardContent>
                  </Card>
                )}

                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>NO-CDS Disclaimer</AlertTitle>
                  <AlertDescription>
                    Appointment scheduling is for convenience only. This does not constitute medical advice. For medical questions or urgent concerns, please contact your healthcare provider directly.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>

          <TabsContent value="pre-visit" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Pre-Visit Preparation
            </h2>

            {loadingGuidance ? (
              <Skeleton className="h-96 w-full" />
            ) : visitGuidanceData?.guidance ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Preparation Checklist</CardTitle>
                    <CardDescription>
                      Complete these items before your {visitGuidanceData.guidance.appointmentType} with {visitGuidanceData.guidance.provider}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {visitGuidanceData.guidance.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                        onClick={() => toggleCheckItem(item.id)}
                      >
                        <Checkbox
                          checked={checkedItems.has(item.id)}
                          onCheckedChange={() => toggleCheckItem(item.id)}
                          data-testid={`checkbox-${item.id}`}
                        />
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${checkedItems.has(item.id) ? "line-through text-muted-foreground" : ""}`}>
                            {item.task}
                            {item.required && <Badge variant="secondary" className="ml-2 text-xs">Required</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        {checkedItems.has(item.id) && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                    ))}
                    <div className="pt-4">
                      <Progress value={(checkedItems.size / visitGuidanceData.guidance.checklist.length) * 100} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        {checkedItems.size} of {visitGuidanceData.guidance.checklist.length} items completed
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Questions to Ask</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {visitGuidanceData.guidance.questionsToAsk.map((q, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <HelpCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Documents to Bring</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {visitGuidanceData.guidance.documentsToReview.map((doc, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span>{doc}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming appointments</p>
                  <p className="text-sm">Schedule an appointment to see preparation guidance</p>
                  <Button variant="outline" className="mt-4" onClick={() => setActiveTab("schedule")}>
                    Schedule Appointment
                  </Button>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>NO-CDS Disclaimer</AlertTitle>
              <AlertDescription>
                {visitGuidanceData?.guidance?.noCdsDisclaimer || "This guidance is for informational purposes only and does not constitute medical advice. Always follow your healthcare provider's specific instructions."}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="post-visit" className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Post-Visit Care Instructions
            </h2>

            {loadingGuidance ? (
              <Skeleton className="h-96 w-full" />
            ) : visitGuidanceData?.guidance ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Follow-Up Checklist</CardTitle>
                    <CardDescription>
                      Complete these items after your visit
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {visitGuidanceData.guidance.checklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover-elevate"
                        onClick={() => toggleCheckItem(item.id)}
                      >
                        <Checkbox
                          checked={checkedItems.has(item.id)}
                          onCheckedChange={() => toggleCheckItem(item.id)}
                          data-testid={`checkbox-post-${item.id}`}
                        />
                        <div className="flex-1">
                          <p className={`font-medium text-sm ${checkedItems.has(item.id) ? "line-through text-muted-foreground" : ""}`}>
                            {item.task}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                        {checkedItems.has(item.id) && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Care Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {visitGuidanceData.guidance.instructions?.map((instruction, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{instruction}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {visitGuidanceData.guidance.followUpActions && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Follow-Up Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {visitGuidanceData.guidance.followUpActions.map((action, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent visits</p>
                  <p className="text-sm">Post-visit care instructions will appear here after your appointment</p>
                </CardContent>
              </Card>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>NO-CDS Disclaimer</AlertTitle>
              <AlertDescription>
                {visitGuidanceData?.guidance?.noCdsDisclaimer || "This guidance is for informational purposes only and does not constitute medical advice. Always follow your healthcare provider's specific instructions."}
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
