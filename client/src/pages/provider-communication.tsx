import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageSquare,
  Send,
  Plus,
  Clock,
  User,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle,
  Shield,
  Eye,
  Paperclip,
  History,
  Users,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Stethoscope
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  organization: string;
  email: string;
}

interface SharedDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  size: number;
}

interface CommunicationMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderOrganization: string;
  content: string;
  priority: "routine" | "urgent" | "stat";
  createdAt: string;
  attachments: SharedDocument[];
}

interface CommunicationThread {
  id: string;
  patientId: string;
  patientName: string;
  subject: string;
  category: "consultation" | "referral" | "care_coordination" | "follow_up" | "urgent_concern";
  participants: Provider[];
  messages: CommunicationMessage[];
  status: "open" | "resolved" | "pending_response";
  createdAt: string;
  lastMessageAt: string;
}

interface AuditEntry {
  id: string;
  threadId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  targetResourceType: string;
  targetResourceId: string;
  patientId: string;
  details: string;
  timestamp: string;
}

interface PatientSummary {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  mrn: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentVisits: Array<{ date: string; provider: string; reason: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  consultation: "Consultation",
  referral: "Referral",
  care_coordination: "Care Coordination",
  follow_up: "Follow-up",
  urgent_concern: "Urgent Concern"
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "Open", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  pending_response: { label: "Pending Response", variant: "outline" }
};

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "stat") {
    return <Badge variant="destructive">STAT</Badge>;
  }
  if (priority === "urgent") {
    return <Badge variant="destructive" className="bg-orange-500">Urgent</Badge>;
  }
  return <Badge variant="secondary">Routine</Badge>;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function ProviderCommunicationPage() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [messagePriority, setMessagePriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [showNewThread, setShowNewThread] = useState(false);
  const [activeTab, setActiveTab] = useState("threads");

  const [newThreadForm, setNewThreadForm] = useState({
    patientId: "patient-001",
    patientName: "John Smith",
    subject: "",
    category: "consultation" as CommunicationThread["category"],
    message: "",
    priority: "routine" as CommunicationMessage["priority"],
    recipientIds: [] as string[]
  });

  const { data: threadsData, isLoading: threadsLoading } = useQuery<{ success: boolean; data: CommunicationThread[] }>({
    queryKey: ["/api/provider-communication/threads"],
    queryFn: async () => {
      const res = await fetch("/api/provider-communication/threads?providerId=prov-current");
      return res.json();
    }
  });

  const { data: providersData } = useQuery<{ success: boolean; data: Provider[] }>({
    queryKey: ["/api/provider-communication/providers"],
    queryFn: async () => {
      const res = await fetch("/api/provider-communication/providers");
      return res.json();
    }
  });

  const { data: auditData } = useQuery<{ success: boolean; data: AuditEntry[] }>({
    queryKey: ["/api/provider-communication/audit-trail"],
    queryFn: async () => {
      const res = await fetch("/api/provider-communication/audit-trail");
      return res.json();
    },
    enabled: activeTab === "audit"
  });

  const { data: patientSummaryData } = useQuery<{ success: boolean; data: PatientSummary }>({
    queryKey: ["/api/provider-communication/patient-summary", "patient-001"],
    queryFn: async () => {
      const res = await fetch("/api/provider-communication/patient-summary/patient-001");
      return res.json();
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/provider-communication/threads/${selectedThread}/messages`, {
        providerId: "prov-current",
        content: newMessage,
        priority: messagePriority,
        attachments: []
      });
      return res.json();
    },
    onSuccess: () => {
      setNewMessage("");
      setMessagePriority("routine");
      queryClient.invalidateQueries({ queryKey: ["/api/provider-communication/threads"] });
    }
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/provider-communication/threads", {
        providerId: "prov-current",
        ...newThreadForm
      });
      return res.json();
    },
    onSuccess: () => {
      setShowNewThread(false);
      setNewThreadForm({
        patientId: "patient-001",
        patientName: "John Smith",
        subject: "",
        category: "consultation",
        message: "",
        priority: "routine",
        recipientIds: []
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-communication/threads"] });
    }
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await apiRequest("POST", `/api/provider-communication/threads/${threadId}/resolve`, {
        providerId: "prov-current"
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/provider-communication/threads"] });
    }
  });

  const threads = threadsData?.data || [];
  const providers = providersData?.data?.filter(p => p.id !== "prov-current") || [];
  const auditEntries = auditData?.data || [];
  const patientSummary = patientSummaryData?.data;
  const currentThread = threads.find(t => t.id === selectedThread);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <MessageSquare className="h-7 w-7 text-primary" />
          Provider Communication
        </h1>
        <p className="text-muted-foreground">
          Secure messaging between healthcare providers with full audit trails.
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          All communications are HIPAA-compliant with complete audit trails. PHI is encrypted in transit and at rest. Access is restricted to authorized providers only.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="threads" data-testid="tab-threads">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary">
            <FileText className="h-4 w-4 mr-2" />
            Patient Summary
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="threads" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Conversations</CardTitle>
                  <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-thread">
                        <Plus className="h-4 w-4 mr-1" />
                        New
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>New Communication</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <label className="text-sm font-medium">Subject</label>
                          <Input
                            value={newThreadForm.subject}
                            onChange={(e) => setNewThreadForm(f => ({ ...f, subject: e.target.value }))}
                            placeholder="Brief description of the concern"
                            data-testid="input-thread-subject"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <Select
                            value={newThreadForm.category}
                            onValueChange={(v) => setNewThreadForm(f => ({ ...f, category: v as any }))}
                          >
                            <SelectTrigger data-testid="select-thread-category">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Recipients</label>
                          <Select
                            value={newThreadForm.recipientIds[0] || ""}
                            onValueChange={(v) => setNewThreadForm(f => ({ ...f, recipientIds: [v] }))}
                          >
                            <SelectTrigger data-testid="select-recipients">
                              <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                              {providers.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} - {p.specialty}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Priority</label>
                          <Select
                            value={newThreadForm.priority}
                            onValueChange={(v) => setNewThreadForm(f => ({ ...f, priority: v as any }))}
                          >
                            <SelectTrigger data-testid="select-thread-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="routine">Routine</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="stat">STAT</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Message</label>
                          <Textarea
                            value={newThreadForm.message}
                            onChange={(e) => setNewThreadForm(f => ({ ...f, message: e.target.value }))}
                            placeholder="Describe the patient concern or request..."
                            rows={4}
                            data-testid="input-thread-message"
                          />
                        </div>
                        <Button
                          onClick={() => createThreadMutation.mutate()}
                          disabled={!newThreadForm.subject || !newThreadForm.message || !newThreadForm.recipientIds.length || createThreadMutation.isPending}
                          className="w-full"
                          data-testid="button-create-thread"
                        >
                          {createThreadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send Message
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  {threadsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No conversations yet
                    </div>
                  ) : (
                    <div className="divide-y">
                      {threads.map(thread => (
                        <div
                          key={thread.id}
                          onClick={() => setSelectedThread(thread.id)}
                          className={`p-3 cursor-pointer hover-elevate ${selectedThread === thread.id ? "bg-muted" : ""}`}
                          data-testid={`thread-item-${thread.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {thread.category === "urgent_concern" && (
                                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                )}
                                <span className="font-medium text-sm truncate">{thread.subject}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {thread.patientName}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={STATUS_CONFIG[thread.status].variant} className="text-xs">
                                  {STATUS_CONFIG[thread.status].label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(thread.lastMessageAt)}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              {currentThread ? (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{currentThread.subject}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {currentThread.patientName}
                          </span>
                          <Badge variant="outline">{CATEGORY_LABELS[currentThread.category]}</Badge>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {currentThread.status !== "resolved" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveThreadMutation.mutate(currentThread.id)}
                            disabled={resolveThreadMutation.isPending}
                            data-testid="button-resolve-thread"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>Participants:</span>
                      {currentThread.participants.map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs">
                          {p.name}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[350px] pr-4">
                      <div className="space-y-4">
                        {currentThread.messages.map(msg => (
                          <div key={msg.id} className="space-y-2" data-testid={`message-${msg.id}`}>
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Stethoscope className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-sm">{msg.senderName}</span>
                                  <span className="text-xs text-muted-foreground">{msg.senderOrganization}</span>
                                  <PriorityBadge priority={msg.priority} />
                                  <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                                </div>
                                <p className="mt-2 text-sm whitespace-pre-wrap">{msg.content}</p>
                                {msg.attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {msg.attachments.map(doc => (
                                      <Badge key={doc.id} variant="outline" className="text-xs flex items-center gap-1">
                                        <Paperclip className="h-3 w-3" />
                                        {doc.name}
                                        <span className="text-muted-foreground">({formatFileSize(doc.size)})</span>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Separator />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {currentThread.status !== "resolved" && (
                      <div className="mt-4 space-y-3">
                        <Textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your reply..."
                          rows={3}
                          data-testid="input-reply-message"
                        />
                        <div className="flex items-center gap-2">
                          <Select value={messagePriority} onValueChange={(v) => setMessagePriority(v as any)}>
                            <SelectTrigger className="w-32" data-testid="select-reply-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="routine">Routine</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="stat">STAT</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => sendMessageMutation.mutate()}
                            disabled={!newMessage.trim() || sendMessageMutation.isPending}
                            className="flex-1"
                            data-testid="button-send-reply"
                          >
                            {sendMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-[500px] text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Select a conversation to view</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          {patientSummary ? (
            <Card data-testid="card-patient-summary">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{patientSummary.patientName}</CardTitle>
                    <CardDescription>
                      DOB: {new Date(patientSummary.dateOfBirth).toLocaleDateString()} | MRN: {patientSummary.mrn}
                    </CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-share-summary">
                        <Send className="h-4 w-4 mr-2" />
                        Share with Provider
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share Patient Summary</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                          Select a provider to share this patient summary with. A new communication thread will be created.
                        </p>
                        <Select
                          value={newThreadForm.recipientIds[0] || ""}
                          onValueChange={(v) => setNewThreadForm(f => ({ ...f, recipientIds: [v] }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select provider" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} - {p.specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Textarea
                          placeholder="Add a note about why you're sharing this summary..."
                          value={newThreadForm.message}
                          onChange={(e) => setNewThreadForm(f => ({ ...f, message: e.target.value }))}
                          rows={3}
                        />
                        <Button
                          className="w-full"
                          disabled={!newThreadForm.recipientIds.length || createThreadMutation.isPending}
                          onClick={() => {
                            setNewThreadForm(f => ({
                              ...f,
                              subject: `Patient Summary: ${patientSummary?.patientName}`,
                              category: "care_coordination",
                              message: f.message || `Sharing patient summary for ${patientSummary?.patientName}. Conditions: ${patientSummary?.conditions.join(", ")}. Current medications: ${patientSummary?.medications.join(", ")}.`
                            }));
                            createThreadMutation.mutate();
                          }}
                          data-testid="button-confirm-share-summary"
                        >
                          {createThreadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Share Summary
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Active Conditions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {patientSummary.conditions.map((c, i) => (
                      <Badge key={i} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Current Medications
                  </h3>
                  <ul className="text-sm space-y-1">
                    {patientSummary.medications.map((m, i) => (
                      <li key={i} className={m.includes("HOLD") ? "text-red-600 font-medium" : ""}>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Allergies
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {patientSummary.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive">{a}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Recent Visits
                  </h3>
                  <div className="space-y-2">
                    {patientSummary.recentVisits.map((v, i) => (
                      <div key={i} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <span>{v.reason}</span>
                        <span className="text-muted-foreground">{v.provider} - {new Date(v.date).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card data-testid="card-audit-trail">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Communication Audit Trail
              </CardTitle>
              <CardDescription>
                Complete record of all provider communications and document access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {auditEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit entries found
                    </div>
                  ) : (
                    auditEntries.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 border rounded-md"
                        data-testid={`audit-entry-${entry.id}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          entry.action === "document_shared" ? "bg-blue-100 text-blue-600" :
                          entry.action === "thread_created" ? "bg-green-100 text-green-600" :
                          entry.action === "thread_resolved" ? "bg-purple-100 text-purple-600" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {entry.action === "document_shared" ? <Paperclip className="h-4 w-4" /> :
                           entry.action === "message_sent" ? <Send className="h-4 w-4" /> :
                           entry.action === "thread_created" ? <Plus className="h-4 w-4" /> :
                           entry.action === "thread_resolved" ? <CheckCircle className="h-4 w-4" /> :
                           <Eye className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">{entry.performedByName}</span>
                            <Badge variant="outline" className="text-xs">
                              {entry.action.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{entry.details}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.timestamp).toLocaleString()}
                            <span className="mx-1">|</span>
                            <span>Patient: {entry.patientId}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
