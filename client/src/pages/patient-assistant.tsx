import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AIPatientAssistantChat } from "@/components/ai-patient-assistant-chat";
import { 
  MessageCircle, 
  Calendar, 
  Lightbulb, 
  Mail, 
  Clock,
  CheckCircle2,
  X,
  Send,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Pill,
  Apple,
  Dumbbell,
  Moon,
  Brain,
  Shield,
  Bell,
  RefreshCw,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";

const patientId = "patient-1";

interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  type: string;
  available: boolean;
}

interface HealthTip {
  id: string;
  patientId: string;
  title: string;
  content: string;
  category: "medication" | "diet" | "exercise" | "sleep" | "mental_health" | "preventive_care";
  priority: "low" | "medium" | "high";
  basedOn: string[];
  createdAt: string;
  dismissed: boolean;
}

interface HealthReminder {
  id: string;
  patientId: string;
  title: string;
  description: string;
  type: "medication" | "appointment" | "lab_work" | "vaccination" | "screening";
  scheduledFor: string;
  recurring: boolean;
  recurrencePattern?: string;
  status: "pending" | "completed" | "snoozed" | "dismissed";
  createdAt: string;
}

interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: "patient" | "provider" | "ai_assistant";
  senderName: string;
  recipientId: string;
  recipientType: "patient" | "provider" | "care_team";
  recipientName: string;
  subject?: string;
  content: string;
  aiSuggested: boolean;
  aiDraft?: string;
  readAt?: string;
  createdAt: string;
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  medication: <Pill className="w-4 h-4" />,
  diet: <Apple className="w-4 h-4" />,
  exercise: <Dumbbell className="w-4 h-4" />,
  sleep: <Moon className="w-4 h-4" />,
  mental_health: <Brain className="w-4 h-4" />,
  preventive_care: <Shield className="w-4 h-4" />
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

function AppointmentScheduling() {
  const [appointmentRequest, setAppointmentRequest] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [aiResponse, setAiResponse] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: slotsData, isLoading: loadingSlots } = useQuery<{ success: boolean; slots: AppointmentSlot[] }>({
    queryKey: ["/api/patient-assistant/appointments/slots"]
  });

  const processMutation = useMutation({
    mutationFn: async (request: string) => {
      const result = await apiRequest("POST", "/api/patient-assistant/appointments/process", { patientId, request });
      return result.json();
    },
    onSuccess: (data) => {
      setAiResponse(data.response);
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const result = await apiRequest("POST", "/api/patient-assistant/appointments/confirm", { patientId, slotId });
      return result.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Appointment Confirmed",
        description: `Your confirmation number is ${data.confirmationNumber}`
      });
      setSelectedSlot(null);
      setAiResponse("");
      queryClient.invalidateQueries({ queryKey: ["/api/patient-assistant/appointments/slots"] });
    }
  });

  const slots = slotsData?.slots || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Appointment Assistant
          </CardTitle>
          <CardDescription>
            Describe what you need in natural language, and I'll help you schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., I need to schedule a checkup next week..."
              value={appointmentRequest}
              onChange={(e) => setAppointmentRequest(e.target.value)}
              data-testid="input-appointment-request"
              onKeyDown={(e) => {
                if (e.key === "Enter" && appointmentRequest.trim()) {
                  processMutation.mutate(appointmentRequest);
                }
              }}
            />
            <Button
              onClick={() => processMutation.mutate(appointmentRequest)}
              disabled={!appointmentRequest.trim() || processMutation.isPending}
              data-testid="button-process-appointment"
            >
              {processMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          
          {aiResponse && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4 whitespace-pre-wrap text-sm">
                {aiResponse}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Available Appointment Slots</CardTitle>
          <CardDescription>Select a time that works for you</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSlots ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-muted-foreground text-sm">No available slots at this time.</p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "w-full p-4 rounded-lg border text-left transition-colors hover-elevate",
                    selectedSlot?.id === slot.id 
                      ? "border-primary bg-primary/5" 
                      : "border-border"
                  )}
                  data-testid={`slot-${slot.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{slot.date} at {slot.time}</p>
                      <p className="text-sm text-muted-foreground">{slot.provider} - {slot.type}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {selectedSlot && (
            <div className="mt-4 pt-4 border-t">
              <p className="font-medium mb-2">Confirm your appointment:</p>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedSlot.date} at {selectedSlot.time} with {selectedSlot.provider}
              </p>
              <Button
                onClick={() => confirmMutation.mutate(selectedSlot.id)}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm-appointment"
              >
                {confirmMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Appointment</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthTipsAndReminders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tipsData, isLoading: loadingTips } = useQuery<{ success: boolean; tips: HealthTip[] }>({
    queryKey: ["/api/patient-assistant/health-tips", patientId]
  });

  const { data: remindersData, isLoading: loadingReminders } = useQuery<{ success: boolean; reminders: HealthReminder[] }>({
    queryKey: ["/api/patient-assistant/reminders", patientId]
  });

  const dismissTipMutation = useMutation({
    mutationFn: async (tipId: string) => {
      const result = await apiRequest("POST", `/api/patient-assistant/health-tips/${tipId}/dismiss`, { patientId });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-assistant/health-tips", patientId] });
      toast({ title: "Tip dismissed" });
    }
  });

  const generateTipsMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/patient-assistant/health-tips/generate", { 
        patientId, 
        conditions: ["Type 2 Diabetes", "Hypertension"],
        medications: ["Metformin", "Lisinopril"]
      });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-assistant/health-tips", patientId] });
      toast({ title: "New health tips generated" });
    }
  });

  const updateReminderMutation = useMutation({
    mutationFn: async ({ reminderId, status }: { reminderId: string; status: string }) => {
      const result = await apiRequest("PATCH", `/api/patient-assistant/reminders/${reminderId}`, { patientId, status });
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-assistant/reminders", patientId] });
    }
  });

  const tips = tipsData?.tips || [];
  const reminders = remindersData?.reminders || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Personalized Health Tips
              </CardTitle>
              <CardDescription className="mt-1">AI-generated wellness advice tailored to you</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateTipsMutation.mutate()}
              disabled={generateTipsMutation.isPending}
              data-testid="button-generate-tips"
            >
              {generateTipsMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <><Sparkles className="w-4 h-4 mr-1" /> Generate New</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTips ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : tips.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No health tips available. Click "Generate New" to get personalized tips.</p>
          ) : (
            <div className="space-y-3">
              {tips.map((tip) => (
                <Card key={tip.id} className="relative overflow-visible">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        {CATEGORY_ICONS[tip.category] || <Lightbulb className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-medium">{tip.title}</h4>
                          <Badge className={cn("text-xs", PRIORITY_COLORS[tip.priority])}>
                            {tip.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {tip.category.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tip.content}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => dismissTipMutation.mutate(tip.id)}
                        className="flex-shrink-0"
                        data-testid={`button-dismiss-tip-${tip.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-blue-500" />
            Health Reminders
          </CardTitle>
          <CardDescription>Upcoming health tasks and appointments</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingReminders ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : reminders.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No pending reminders.</p>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex items-center justify-between p-4 rounded-lg border gap-4"
                  data-testid={`reminder-${reminder.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{reminder.title}</p>
                      <p className="text-sm text-muted-foreground">{reminder.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Due: {new Date(reminder.scheduledFor).toLocaleDateString()}
                        {reminder.recurring && <span className="ml-2">({reminder.recurrencePattern})</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateReminderMutation.mutate({ reminderId: reminder.id, status: "completed" })}
                      data-testid={`button-complete-reminder-${reminder.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateReminderMutation.mutate({ reminderId: reminder.id, status: "dismissed" })}
                      data-testid={`button-dismiss-reminder-${reminder.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong>Disclaimer:</strong> Health tips are for educational purposes only and are NOT medical advice. 
              Always consult your healthcare provider before making changes to your health routine.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecureMessaging() {
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messagesData, isLoading: loadingMessages } = useQuery<{ success: boolean; messages: SecureMessage[] }>({
    queryKey: ["/api/patient-assistant/messages", patientId]
  });

  const { data: careTeamData } = useQuery<{ success: boolean; providers: Provider[] }>({
    queryKey: ["/api/patient-assistant/care-team"]
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const provider = careTeamData?.providers.find(p => p.id === selectedRecipient);
      const result = await apiRequest("POST", "/api/patient-assistant/messages", {
        patientId,
        recipientId: selectedRecipient,
        recipientType: "provider",
        recipientName: provider?.name || "Care Team",
        content: newMessage,
        subject: subject || undefined
      });
      return result.json();
    },
    onSuccess: (data) => {
      toast({ title: "Message sent successfully" });
      if (data.aiDraft) {
        setAiDraft(data.aiDraft);
      }
      setNewMessage("");
      setSubject("");
      queryClient.invalidateQueries({ queryKey: ["/api/patient-assistant/messages", patientId] });
    }
  });

  const suggestReplyMutation = useMutation({
    mutationFn: async (incomingMessage: string) => {
      const result = await apiRequest("POST", "/api/patient-assistant/messages/suggest-reply", {
        patientId,
        incomingMessage
      });
      return result.json();
    },
    onSuccess: (data) => {
      setNewMessage(data.suggestedReply);
      toast({ title: "AI suggested a reply" });
    }
  });

  const messages = messagesData?.messages || [];
  const providers = careTeamData?.providers || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-green-500" />
            Compose Message
          </CardTitle>
          <CardDescription>Send a secure message to your care team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">To:</label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger data-testid="select-recipient">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} - {provider.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1.5 block">Subject (optional):</label>
            <Input
              placeholder="e.g., Question about my medication"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="input-message-subject"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Message:</label>
            <Textarea
              placeholder="Type your message here..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
              data-testid="textarea-message-content"
            />
          </div>

          {aiDraft && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI-Polished Version
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {aiDraft}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewMessage(aiDraft);
                      setAiDraft("");
                    }}
                    data-testid="button-use-ai-draft"
                  >
                    Use This Version
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!selectedRecipient || !newMessage.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send Message</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Message History</CardTitle>
          <CardDescription>Your conversations with your care team</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMessages ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">No messages yet.</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {messages.map((message) => (
                  <Card
                    key={message.id}
                    className={cn(
                      message.senderType === "patient" ? "ml-8" : "mr-8"
                    )}
                    data-testid={`message-${message.id}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                          message.senderType === "patient" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        )}>
                          {message.senderType === "patient" ? <User className="w-4 h-4" /> : message.senderName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{message.senderName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(message.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {message.subject && (
                        <p className="font-medium text-sm mb-1">Re: {message.subject}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      
                      {message.senderType === "provider" && (
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRecipient(message.senderId);
                              suggestReplyMutation.mutate(message.content);
                            }}
                            disabled={suggestReplyMutation.isPending}
                            data-testid={`button-suggest-reply-${message.id}`}
                          >
                            {suggestReplyMutation.isPending ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <><Sparkles className="w-4 h-4 mr-1" /> AI Suggest Reply</>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientAssistantPage() {
  const [activeTab, setActiveTab] = useState("chat");

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" data-testid="text-page-title">AI Patient Assistant</h1>
        <p className="text-muted-foreground">Your personal health companion powered by AI</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="chat" className="flex items-center gap-2" data-testid="tab-chat">
            <MessageCircle className="w-4 h-4" />
            <span>Health Q&A</span>
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2" data-testid="tab-appointments">
            <Calendar className="w-4 h-4" />
            <span>Appointments</span>
          </TabsTrigger>
          <TabsTrigger value="tips" className="flex items-center gap-2" data-testid="tab-tips">
            <Lightbulb className="w-4 h-4" />
            <span>Health Tips</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2" data-testid="tab-messages">
            <Mail className="w-4 h-4" />
            <span>Secure Messages</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-0">
          <div className="h-[calc(100vh-12rem)]">
            <AIPatientAssistantChat patientId={patientId} className="h-full" />
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-0">
          <AppointmentScheduling />
        </TabsContent>

        <TabsContent value="tips" className="mt-0">
          <HealthTipsAndReminders />
        </TabsContent>

        <TabsContent value="messages" className="mt-0">
          <SecureMessaging />
        </TabsContent>
      </Tabs>
    </div>
  );
}
