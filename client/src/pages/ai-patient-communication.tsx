import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  MessageSquare,
  Bell,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  Pill,
  Sparkles,
  AlertTriangle,
  Mail,
  RefreshCw,
  Eye,
  BarChart3,
} from "lucide-react";

interface PatientInquiry {
  id: string;
  patientId: string;
  patientName: string;
  subject: string;
  message: string;
  receivedAt: string;
  priority: "low" | "normal" | "high" | "urgent";
  category: string;
}

interface AIResponseDraft {
  id: string;
  inquiryId: string;
  patientId: string;
  subject: string;
  body: string;
  personalizedElements: {
    patientName: string;
    referencedCarePlanGoals?: string[];
    referencedAppointments?: string[];
    referencedMedications?: string[];
    suggestedFollowUp?: string;
  };
  tone: string;
  confidenceScore: number;
  suggestedActions: string[];
  requiresProviderReview: boolean;
  reviewReason?: string;
  safetyDisclaimer: string;
  generatedAt: string;
  status: "draft" | "approved" | "sent" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
}

interface ProactiveMessage {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  subject: string;
  body: string;
  personalizedContent: {
    greeting: string;
    mainMessage: string;
    actionItems?: string[];
    encouragement?: string;
  };
  scheduledFor: string;
  channel: string;
  priority: string;
  status: "scheduled" | "sent" | "delivered" | "failed" | "cancelled";
  createdAt: string;
}

interface MessageStats {
  total: number;
  scheduled: number;
  sent: number;
  delivered: number;
  cancelled: number;
  byType: Record<string, number>;
}

export default function AIPatientCommunicationPage() {
  const { toast } = useToast();
  const [selectedInquiry, setSelectedInquiry] = useState<PatientInquiry | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<AIResponseDraft | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ProactiveMessage | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateType, setGenerateType] = useState<"reminder" | "follow_up">("reminder");
  const [newMessagePatient, setNewMessagePatient] = useState({ id: "", name: "" });
  const [appointmentDetails, setAppointmentDetails] = useState({
    id: "",
    type: "",
    provider: "",
    scheduledDate: "",
    location: "",
  });
  const [followUpType, setFollowUpType] = useState<"post_visit" | "medication_check" | "wellness_check" | "goal_progress">("post_visit");

  const { data: inquiries = [], isLoading: loadingInquiries } = useQuery<PatientInquiry[]>({
    queryKey: ["/api/ai-patient-communication/inquiries"],
  });

  const { data: drafts = [], isLoading: loadingDrafts } = useQuery<AIResponseDraft[]>({
    queryKey: ["/api/ai-patient-communication/response-drafts"],
  });

  const { data: proactiveMessages = [], isLoading: loadingMessages } = useQuery<ProactiveMessage[]>({
    queryKey: ["/api/ai-patient-communication/proactive-messages"],
  });

  const { data: stats } = useQuery<MessageStats>({
    queryKey: ["/api/ai-patient-communication/proactive-messages/stats"],
  });

  const draftResponseMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/inquiries/${inquiryId}/draft-response`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/response-drafts"] });
      toast({ title: "Response drafted", description: "AI has generated a personalized response" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate response", variant: "destructive" });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/response-drafts/${draftId}/approve`, {
        approvedBy: "Care Team",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/response-drafts"] });
      setSelectedDraft(null);
      toast({ title: "Draft approved", description: "Response has been approved for sending" });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async ({ draftId, reason }: { draftId: string; reason: string }) => {
      return apiRequest("POST", `/api/ai-patient-communication/response-drafts/${draftId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/response-drafts"] });
      setSelectedDraft(null);
      toast({ title: "Draft rejected", description: "Response has been rejected" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/proactive-messages/${messageId}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages/stats"] });
      toast({ title: "Message sent", description: "The message has been sent to the patient" });
    },
  });

  const cancelMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/ai-patient-communication/proactive-messages/${messageId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages/stats"] });
      toast({ title: "Message cancelled", description: "The scheduled message has been cancelled" });
    },
  });

  const generateReminderMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ai-patient-communication/generate/appointment-reminder", {
        patientId: newMessagePatient.id,
        patientName: newMessagePatient.name,
        appointment: appointmentDetails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages/stats"] });
      setShowGenerateDialog(false);
      toast({ title: "Reminder generated", description: "AI has created a personalized appointment reminder" });
    },
  });

  const generateFollowUpMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ai-patient-communication/generate/follow-up", {
        patientId: newMessagePatient.id,
        patientName: newMessagePatient.name,
        followUpType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-patient-communication/proactive-messages/stats"] });
      setShowGenerateDialog(false);
      toast({ title: "Follow-up generated", description: "AI has created a personalized follow-up message" });
    },
  });

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500/10 text-red-500";
      case "high": return "bg-orange-500/10 text-orange-500";
      case "normal": return "bg-blue-500/10 text-blue-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": case "sent": case "delivered": return "bg-green-500/10 text-green-500";
      case "scheduled": return "bg-blue-500/10 text-blue-500";
      case "draft": return "bg-yellow-500/10 text-yellow-500";
      case "rejected": case "failed": case "cancelled": return "bg-red-500/10 text-red-500";
      default: return "bg-gray-500/10 text-gray-500";
    }
  };

  const messageTypeIcon = (type: string) => {
    switch (type) {
      case "appointment_reminder": return <Calendar className="h-4 w-4" />;
      case "medication_reminder": return <Pill className="h-4 w-4" />;
      case "follow_up": case "check_in": return <MessageSquare className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Patient Communication
          </h1>
          <p className="text-muted-foreground mt-1">
            Draft personalized responses and send proactive messages to patients
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-message">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Message
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.scheduled}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-sm text-muted-foreground">Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.delivered}</p>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                  <p className="text-sm text-muted-foreground">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="inquiries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inquiries" data-testid="tab-inquiries">
            <MessageSquare className="h-4 w-4 mr-2" />
            Patient Inquiries ({inquiries.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Drafts ({drafts.filter(d => d.status === "draft").length})
          </TabsTrigger>
          <TabsTrigger value="proactive" data-testid="tab-proactive">
            <Bell className="h-4 w-4 mr-2" />
            Proactive Messages ({proactiveMessages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inquiries" className="space-y-4">
          {loadingInquiries ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading inquiries...</CardContent></Card>
          ) : inquiries.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No patient inquiries</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {inquiries.map((inquiry) => (
                <Card key={inquiry.id} className="hover-elevate" data-testid={`card-inquiry-${inquiry.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{inquiry.subject}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4" />
                          {inquiry.patientName}
                          <span className="text-xs">
                            {new Date(inquiry.receivedAt).toLocaleString()}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={priorityColor(inquiry.priority)}>{inquiry.priority}</Badge>
                        <Badge variant="outline">{inquiry.category}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{inquiry.message}</p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInquiry(inquiry)}
                      data-testid={`button-view-inquiry-${inquiry.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => draftResponseMutation.mutate(inquiry.id)}
                      disabled={draftResponseMutation.isPending}
                      data-testid={`button-draft-response-${inquiry.id}`}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {draftResponseMutation.isPending ? "Generating..." : "Draft AI Response"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          {loadingDrafts ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading drafts...</CardContent></Card>
          ) : drafts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No response drafts. Generate one from a patient inquiry.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {drafts.map((draft) => (
                <Card key={draft.id} className="hover-elevate" data-testid={`card-draft-${draft.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{draft.subject}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4" />
                          {draft.personalizedElements.patientName}
                          <span className="text-xs">
                            Generated {new Date(draft.generatedAt).toLocaleString()}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColor(draft.status)}>{draft.status}</Badge>
                        {draft.requiresProviderReview && (
                          <Badge variant="outline" className="text-amber-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Provider Review
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{draft.body}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span>Confidence: {draft.confidenceScore}%</span>
                      <span>Tone: {draft.tone}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDraft(draft)}
                      data-testid={`button-view-draft-${draft.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                    {draft.status === "draft" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejectDraftMutation.mutate({ draftId: draft.id, reason: "Needs revision" })}
                          data-testid={`button-reject-draft-${draft.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveDraftMutation.mutate(draft.id)}
                          data-testid={`button-approve-draft-${draft.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="proactive" className="space-y-4">
          {loadingMessages ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading messages...</CardContent></Card>
          ) : proactiveMessages.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No proactive messages scheduled. Generate a reminder or follow-up message.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {proactiveMessages.map((message) => (
                <Card key={message.id} className="hover-elevate" data-testid={`card-message-${message.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {messageTypeIcon(message.type)}
                          {message.subject}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4" />
                          {message.patientName}
                          <span className="text-xs">
                            Scheduled: {new Date(message.scheduledFor).toLocaleString()}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColor(message.status)}>{message.status}</Badge>
                        <Badge variant="outline">{message.type.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {message.personalizedContent.mainMessage}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMessage(message)}
                      data-testid={`button-view-message-${message.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                    {message.status === "scheduled" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelMessageMutation.mutate(message.id)}
                          data-testid={`button-cancel-message-${message.id}`}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => sendMessageMutation.mutate(message.id)}
                          data-testid={`button-send-message-${message.id}`}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Send Now
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedInquiry?.subject}</DialogTitle>
            <DialogDescription>
              From {selectedInquiry?.patientName} - {selectedInquiry && new Date(selectedInquiry.receivedAt).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Badge className={priorityColor(selectedInquiry?.priority || "normal")}>
                  {selectedInquiry?.priority}
                </Badge>
                <Badge variant="outline">{selectedInquiry?.category}</Badge>
              </div>
              <Separator />
              <p className="whitespace-pre-wrap">{selectedInquiry?.message}</p>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInquiry(null)}>Close</Button>
            <Button
              onClick={() => {
                if (selectedInquiry) {
                  draftResponseMutation.mutate(selectedInquiry.id);
                  setSelectedInquiry(null);
                }
              }}
              disabled={draftResponseMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review AI Draft Response</DialogTitle>
            <DialogDescription>
              For {selectedDraft?.personalizedElements.patientName}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColor(selectedDraft?.status || "draft")}>
                  {selectedDraft?.status}
                </Badge>
                <Badge variant="outline">Confidence: {selectedDraft?.confidenceScore}%</Badge>
                <Badge variant="outline">Tone: {selectedDraft?.tone}</Badge>
                {selectedDraft?.requiresProviderReview && (
                  <Badge variant="outline" className="text-amber-500">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {selectedDraft.reviewReason}
                  </Badge>
                )}
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Subject</h4>
                <p className="text-sm">{selectedDraft?.subject}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Response Body</h4>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm whitespace-pre-wrap">{selectedDraft?.body}</p>
                </div>
              </div>
              {selectedDraft?.personalizedElements.referencedCarePlanGoals && selectedDraft.personalizedElements.referencedCarePlanGoals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Referenced Care Plan Goals</h4>
                  <ul className="list-disc pl-4 text-sm">
                    {selectedDraft.personalizedElements.referencedCarePlanGoals.map((goal, idx) => (
                      <li key={idx}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedDraft?.suggestedActions && selectedDraft.suggestedActions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Suggested Actions for Care Team</h4>
                  <ul className="list-disc pl-4 text-sm">
                    {selectedDraft.suggestedActions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-md">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {selectedDraft?.safetyDisclaimer}
                </p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedDraft(null)}>Close</Button>
            {selectedDraft?.status === "draft" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedDraft) {
                      rejectDraftMutation.mutate({ draftId: selectedDraft.id, reason: "Needs revision" });
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    if (selectedDraft) {
                      approveDraftMutation.mutate(selectedDraft.id);
                    }
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Send
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedMessage && messageTypeIcon(selectedMessage.type)}
              {selectedMessage?.subject}
            </DialogTitle>
            <DialogDescription>
              For {selectedMessage?.patientName} - {selectedMessage?.type.replace(/_/g, " ")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <Badge className={statusColor(selectedMessage?.status || "scheduled")}>
                  {selectedMessage?.status}
                </Badge>
                <Badge variant="outline">{selectedMessage?.channel}</Badge>
                <Badge variant="outline">{selectedMessage?.priority} priority</Badge>
              </div>
              <Separator />
              <div className="bg-muted p-4 rounded-md">
                <p className="font-medium mb-2">{selectedMessage?.personalizedContent.greeting}</p>
                <p className="text-sm mb-3">{selectedMessage?.personalizedContent.mainMessage}</p>
                {selectedMessage?.personalizedContent.actionItems && selectedMessage.personalizedContent.actionItems.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium mb-1">Things to keep in mind:</p>
                    <ul className="list-disc pl-4 text-sm">
                      {selectedMessage.personalizedContent.actionItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedMessage?.personalizedContent.encouragement && (
                  <p className="text-sm italic">{selectedMessage.personalizedContent.encouragement}</p>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                <p>Scheduled for: {selectedMessage && new Date(selectedMessage.scheduledFor).toLocaleString()}</p>
                <p>Created: {selectedMessage && new Date(selectedMessage.createdAt).toLocaleString()}</p>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedMessage(null)}>Close</Button>
            {selectedMessage?.status === "scheduled" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedMessage) {
                      cancelMessageMutation.mutate(selectedMessage.id);
                      setSelectedMessage(null);
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedMessage) {
                      sendMessageMutation.mutate(selectedMessage.id);
                      setSelectedMessage(null);
                    }
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Proactive Message</DialogTitle>
            <DialogDescription>
              Create an AI-generated appointment reminder or follow-up message
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select value={generateType} onValueChange={(v: "reminder" | "follow_up") => setGenerateType(v)}>
                <SelectTrigger data-testid="select-message-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reminder">Appointment Reminder</SelectItem>
                  <SelectItem value="follow_up">Follow-up Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Patient ID</Label>
                <Input
                  placeholder="e.g., patient-1"
                  value={newMessagePatient.id}
                  onChange={(e) => setNewMessagePatient({ ...newMessagePatient, id: e.target.value })}
                  data-testid="input-patient-id"
                />
              </div>
              <div className="space-y-2">
                <Label>Patient Name</Label>
                <Input
                  placeholder="e.g., John Smith"
                  value={newMessagePatient.name}
                  onChange={(e) => setNewMessagePatient({ ...newMessagePatient, name: e.target.value })}
                  data-testid="input-patient-name"
                />
              </div>
            </div>
            {generateType === "reminder" && (
              <div className="space-y-4 border rounded-md p-4">
                <h4 className="font-medium">Appointment Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Appointment Type</Label>
                    <Input
                      placeholder="e.g., Annual Checkup"
                      value={appointmentDetails.type}
                      onChange={(e) => setAppointmentDetails({ ...appointmentDetails, type: e.target.value })}
                      data-testid="input-appointment-type"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Input
                      placeholder="e.g., Dr. Smith"
                      value={appointmentDetails.provider}
                      onChange={(e) => setAppointmentDetails({ ...appointmentDetails, provider: e.target.value })}
                      data-testid="input-provider"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date/Time</Label>
                    <Input
                      type="datetime-local"
                      value={appointmentDetails.scheduledDate}
                      onChange={(e) => setAppointmentDetails({ ...appointmentDetails, scheduledDate: e.target.value })}
                      data-testid="input-scheduled-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      placeholder="e.g., Main Clinic"
                      value={appointmentDetails.location}
                      onChange={(e) => setAppointmentDetails({ ...appointmentDetails, location: e.target.value })}
                      data-testid="input-location"
                    />
                  </div>
                </div>
              </div>
            )}
            {generateType === "follow_up" && (
              <div className="space-y-2">
                <Label>Follow-up Type</Label>
                <Select value={followUpType} onValueChange={(v: any) => setFollowUpType(v)}>
                  <SelectTrigger data-testid="select-followup-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post_visit">Post-Visit Check-in</SelectItem>
                    <SelectItem value="medication_check">Medication Check</SelectItem>
                    <SelectItem value="wellness_check">Wellness Check</SelectItem>
                    <SelectItem value="goal_progress">Goal Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (generateType === "reminder") {
                  generateReminderMutation.mutate();
                } else {
                  generateFollowUpMutation.mutate();
                }
              }}
              disabled={generateReminderMutation.isPending || generateFollowUpMutation.isPending || !newMessagePatient.id || !newMessagePatient.name}
              data-testid="button-generate-submit"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateReminderMutation.isPending || generateFollowUpMutation.isPending ? "Generating..." : "Generate Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
