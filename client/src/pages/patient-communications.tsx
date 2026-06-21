import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bot,
  Sparkles,
  Mail,
  Bell,
  Calendar,
  Activity,
  Pill,
  FileText,
  RefreshCw,
  Plus,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, MetricCard, ErrorState } from "@/components/shared";

const SAMPLE_PATIENT_ID = "mock-patient-1";

type CommunicationType = "follow_up" | "appointment_reminder" | "screening_reminder" | "medication_reminder" | "lab_result_notification" | "rpm_alert" | "health_tip" | "care_gap_alert" | "query_response" | "wellness_check" | "post_encounter_summary";
type CommunicationStatus = "draft" | "scheduled" | "pending" | "sent" | "delivered" | "failed" | "cancelled";
type CommunicationChannel = "email" | "sms" | "in_app" | "push_notification";

interface PatientCommunication {
  id: string;
  patientId: string;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  priority: string;
  subject?: string;
  content: string;
  aiGeneratedContent?: string;
  aiConfidence?: number;
  status: CommunicationStatus;
  triggerType: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

interface PatientQueryResponse {
  id: string;
  patientId: string;
  query: string;
  queryCategory?: string;
  aiResponse: string;
  aiConfidence: number;
  aiReasoningSteps?: string[];
  wasHelpful?: boolean;
  patientFeedback?: string;
  requiresFollowUp: boolean;
  createdAt: string;
}

interface CommunicationStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  aiGenerated: number;
  averageConfidence: number;
}

function formatDate(dateString: string) {
  try {
    return format(parseISO(dateString), "MMM d, yyyy h:mm a");
  } catch {
    return dateString;
  }
}

function getTypeIcon(type: CommunicationType) {
  switch (type) {
    case "appointment_reminder":
      return <Calendar className="w-4 h-4" />;
    case "medication_reminder":
      return <Pill className="w-4 h-4" />;
    case "rpm_alert":
      return <Activity className="w-4 h-4" />;
    case "screening_reminder":
      return <FileText className="w-4 h-4" />;
    case "follow_up":
    case "post_encounter_summary":
      return <MessageSquare className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getStatusBadge(status: CommunicationStatus) {
  switch (status) {
    case "delivered":
    case "sent":
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />{status}</Badge>;
    case "pending":
    case "scheduled":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{status}</Badge>;
    case "failed":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    case "draft":
      return <Badge variant="outline">{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getChannelIcon(channel: CommunicationChannel) {
  switch (channel) {
    case "email":
      return <Mail className="w-4 h-4" />;
    case "sms":
      return <MessageSquare className="w-4 h-4" />;
    case "push_notification":
      return <Bell className="w-4 h-4" />;
    default:
      return <MessageSquare className="w-4 h-4" />;
  }
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatsCard({ stats, isLoading }: { stats: CommunicationStats | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <Skeleton className="h-8 w-12 mx-auto mb-2" />
              <Skeleton className="h-4 w-20 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const deliveredCount = (stats.byStatus?.delivered || 0) + (stats.byStatus?.sent || 0);
  const pendingCount = (stats.byStatus?.pending || 0) + (stats.byStatus?.scheduled || 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <MetricCard
        label="Total Messages"
        value={stats.total}
        icon={MessageSquare}
        layout="center"
        testId="card-stat-total"
      />
      <MetricCard
        label="Delivered"
        value={deliveredCount}
        icon={CheckCircle2}
        layout="center"
        testId="card-stat-delivered"
      />
      <MetricCard
        label="Pending"
        value={pendingCount}
        icon={Clock}
        layout="center"
        testId="card-stat-pending"
      />
      <MetricCard
        label="AI Generated"
        value={stats.aiGenerated}
        icon={Bot}
        layout="center"
        testId="card-stat-ai"
      />
    </div>
  );
}

function CommunicationsList({ patientId }: { patientId: string }) {
  const { data: communications, isLoading, isError, error, refetch } = useQuery<PatientCommunication[]>({
    queryKey: ["/api/communications/patient", patientId],
  });

  if (isLoading) return <LoadingState />;

  if (isError) {
    return (
      <ErrorState
        title="Failed to load communications"
        message={(error as Error)?.message || "Please try again"}
        onRetry={() => refetch()}
        data-testid="error-communications"
      />
    );
  }

  const msgs = communications || [];

  if (msgs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-communications">
        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No communications yet</p>
        <p className="text-sm mt-2">Automated messages will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground" data-testid="text-communication-count">{msgs.length} communication(s)</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-communications">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {msgs.map((comm) => (
          <Card key={comm.id} className="hover-elevate" data-testid={`card-communication-${comm.id}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    {getTypeIcon(comm.communicationType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium" data-testid={`text-subject-${comm.id}`}>
                        {comm.subject || comm.communicationType.replace(/_/g, " ")}
                      </h4>
                      {comm.aiGeneratedContent && (
                        <Badge variant="outline" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{comm.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {getChannelIcon(comm.channel)}
                        {comm.channel}
                      </span>
                      <span>{formatDistanceToNow(parseISO(comm.createdAt))} ago</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(comm.status)}
                  {comm.aiConfidence && (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(comm.aiConfidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AskQuestionTab({ patientId }: { patientId: string }) {
  const [question, setQuestion] = useState("");
  const { toast } = useToast();

  const { data: responses, isLoading: responsesLoading, isError: responsesError, refetch: refetchResponses } = useQuery<PatientQueryResponse[]>({
    queryKey: ["/api/communications/query", patientId],
  });

  const askMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/communications/query", { patientId, query });
      return response.json();
    },
    onSuccess: () => {
      setQuestion("");
      refetchResponses();
      toast({ title: "Response generated", description: "Your question has been answered" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ queryId, wasHelpful }: { queryId: string; wasHelpful: boolean }) => {
      const response = await apiRequest("PATCH", `/api/communications/query/${queryId}/feedback`, { wasHelpful });
      return response.json();
    },
    onSuccess: () => {
      refetchResponses();
      toast({ title: "Thank you!", description: "Your feedback helps us improve" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      askMutation.mutate(question);
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-ask-question">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Ask a Health Question
          </CardTitle>
          <CardDescription>
            Get answers based on your health records. Note: This is for educational purposes only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Ask about your medications, conditions, appointments, or lab results..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-question"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={askMutation.isPending || !question.trim()} data-testid="button-ask">
                {askMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Ask Question
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {responsesLoading && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Previous Questions</h3>
          <LoadingState />
        </div>
      )}

      {responsesError && (
        <Card className="border-destructive" data-testid="error-responses">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-destructive opacity-50" />
            <p className="text-destructive font-medium text-sm">Failed to load previous questions</p>
            <Button variant="outline" size="sm" onClick={() => refetchResponses()} className="mt-3" data-testid="button-retry-responses">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!responsesLoading && !responsesError && responses && responses.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Previous Questions</h3>
          {responses.map((resp) => (
            <Card key={resp.id} data-testid={`card-response-${resp.id}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" data-testid={`text-query-${resp.id}`}>{resp.query}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resp.queryCategory && <Badge variant="outline" className="mr-2">{resp.queryCategory}</Badge>}
                      {formatDistanceToNow(parseISO(resp.createdAt))} ago
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 pl-2 border-l-2 border-primary/20 ml-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm" data-testid={`text-response-${resp.id}`}>{resp.aiResponse}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-muted-foreground">
                        {Math.round(resp.aiConfidence * 100)}% confidence
                      </span>
                      {resp.wasHelpful === undefined ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Was this helpful?</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => feedbackMutation.mutate({ queryId: resp.id, wasHelpful: true })}
                            data-testid={`button-helpful-${resp.id}`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => feedbackMutation.mutate({ queryId: resp.id, wasHelpful: false })}
                            data-testid={`button-not-helpful-${resp.id}`}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={resp.wasHelpful ? "default" : "secondary"}>
                          {resp.wasHelpful ? "Helpful" : "Not helpful"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TriggerCommunicationDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState("");
  const { toast } = useToast();

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const eventData: Record<string, unknown> = { patientId };

      if (eventType === "encounter_completed") {
        eventData.encounterId = "encounter-1";
        eventData.date = new Date().toISOString();
        eventData.providerName = "Dr. Smith";
        eventData.reason = "Annual checkup";
      } else if (eventType === "appointment_upcoming") {
        eventData.appointmentId = "appointment-1";
        eventData.date = new Date(Date.now() + 86400000).toLocaleDateString();
        eventData.time = "10:00 AM";
        eventData.providerName = "Dr. Johnson";
      } else if (eventType === "screening_overdue") {
        eventData.screeningName = "Blood pressure screening";
        eventData.importance = "Early detection helps prevent heart disease";
      } else if (eventType === "rpm_data_reviewed") {
        eventData.deviceType = "Blood Pressure Monitor";
        eventData.readings = [
          { type: "Systolic", value: "125 mmHg", date: new Date().toISOString(), status: "normal" },
          { type: "Diastolic", value: "82 mmHg", date: new Date().toISOString(), status: "normal" },
        ];
        eventData.trend = "Stable";
      }

      const response = await apiRequest("POST", "/api/communications/trigger", { eventType, eventData });
      return response.json();
    },
    onSuccess: (data) => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/communications/patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/communications/stats/summary"] });
      toast({
        title: "Communication triggered",
        description: `Generated ${data.triggered} message(s)`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-trigger-communication">
          <Plus className="w-4 h-4 mr-2" />
          Trigger Communication
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger Automated Communication</DialogTitle>
          <DialogDescription>
            Select an event type to generate a personalized AI communication.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger data-testid="select-event-type">
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encounter_completed">Post-Encounter Follow-Up</SelectItem>
                <SelectItem value="appointment_upcoming">Appointment Reminder</SelectItem>
                <SelectItem value="screening_overdue">Screening Reminder</SelectItem>
                <SelectItem value="rpm_data_reviewed">RPM Data Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-trigger">Cancel</Button>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={!eventType || triggerMutation.isPending}
            data-testid="button-confirm-trigger"
          >
            {triggerMutation.isPending ? "Generating..." : "Generate Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PatientCommunicationsPage() {
  const [activeTab, setActiveTab] = useState("messages");

  const { data: stats, isLoading: statsLoading } = useQuery<CommunicationStats>({
    queryKey: ["/api/communications/stats/summary"],
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="patient-communications-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-6">
          <PageHeader
            title="Patient Communications"
            subtitle="AI-powered automated messaging and patient support"
            icon={
              <div className="p-3 bg-primary/10 rounded-full">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
            }
            data-testid="page-title"
            actions={<TriggerCommunicationDialog patientId={SAMPLE_PATIENT_ID} />}
          />
        </div>

        <StatsCard stats={stats} isLoading={statsLoading} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list">
            <TabsTrigger value="messages" data-testid="tab-messages">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="ask" data-testid="tab-ask">
              <Bot className="w-4 h-4 mr-2" />
              Ask a Question
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-6">
            <CommunicationsList patientId={SAMPLE_PATIENT_ID} />
          </TabsContent>

          <TabsContent value="ask" className="mt-6">
            <AskQuestionTab patientId={SAMPLE_PATIENT_ID} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
