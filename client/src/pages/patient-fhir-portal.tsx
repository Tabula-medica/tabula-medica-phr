import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  User,
  Pill,
  AlertTriangle,
  Activity,
  Users,
  MessageSquare,
  ClipboardList,
  FileText,
  Heart,
  Send,
  Plus,
  Clock,
  CheckCircle,
  ShieldCheck,
  Dna,
  Scissors,
  RefreshCw,
} from "lucide-react";

interface PatientMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  status: "active" | "discontinued" | "on-hold";
  instructions?: string;
  refillsRemaining?: number;
}

interface PatientAllergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
  verifiedDate?: string;
  notes?: string;
}

interface PatientCondition {
  id: string;
  name: string;
  status: "active" | "resolved" | "inactive";
  onsetDate: string;
  category: string;
  managedBy?: string;
  notes?: string;
}

interface PatientSurgery {
  id: string;
  procedure: string;
  date: string;
  surgeon?: string;
  facility?: string;
  outcome?: string;
}

interface FamilyHistoryItem {
  id: string;
  relationship: string;
  condition: string;
  ageAtOnset?: number;
  deceased?: boolean;
  geneticRiskLevel?: "low" | "moderate" | "high";
  notes?: string;
}

interface CarePlanTemplate {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "active";
  createdAt: string;
  updatedAt: string;
  goals: Array<{ id: string; description: string; targetDate: string; status: string }>;
  interventions: Array<{ id: string; description: string; frequency: string; assignedTo: string }>;
  notes?: string;
}

interface MessageThread {
  id: string;
  subject: string;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  isUrgent: boolean;
}

interface SecureMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  sentAt: string;
  readAt?: string;
  isUrgent: boolean;
}

interface HealthQuestionnaire {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: QuestionnaireQuestion[];
  dueDate?: string;
  completedAt?: string;
  status: "pending" | "in_progress" | "completed";
}

interface QuestionnaireQuestion {
  id: string;
  text: string;
  type: "text" | "single_choice" | "multiple_choice" | "scale" | "date" | "boolean";
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  answer?: string | string[] | number | boolean;
}

interface Recipient {
  id: string;
  name: string;
  role: string;
  specialty?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  mild: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  severe: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  discontinued: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  "on-hold": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
};

export default function PatientFHIRPortal() {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [newThreadRecipient, setNewThreadRecipient] = useState("");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadContent, setNewThreadContent] = useState("");
  const [newThreadUrgent, setNewThreadUrgent] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string | null>(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, unknown>>({});

  const patientsQuery = useQuery<{ patients: Array<{ id: string; name: string }> }>({
    queryKey: ["/api/patient-portal/patients"],
  });

  const medicationsQuery = useQuery<{ medications: PatientMedication[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "medications"],
    enabled: !!selectedPatient,
  });

  const allergiesQuery = useQuery<{ allergies: PatientAllergy[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "allergies"],
    enabled: !!selectedPatient,
  });

  const conditionsQuery = useQuery<{ conditions: PatientCondition[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "conditions"],
    enabled: !!selectedPatient,
  });

  const surgeriesQuery = useQuery<{ surgeries: PatientSurgery[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "surgeries"],
    enabled: !!selectedPatient,
  });

  const familyHistoryQuery = useQuery<{ familyHistory: FamilyHistoryItem[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "family-history"],
    enabled: !!selectedPatient,
  });

  const carePlansQuery = useQuery<{ carePlans: CarePlanTemplate[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "care-plans"],
    enabled: !!selectedPatient,
  });

  const threadsQuery = useQuery<{ threads: MessageThread[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "message-threads"],
    enabled: !!selectedPatient,
  });

  const messagesQuery = useQuery<{ messages: SecureMessage[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "messages", selectedThread],
    enabled: !!selectedPatient && !!selectedThread,
  });

  const recipientsQuery = useQuery<{ recipients: Recipient[] }>({
    queryKey: ["/api/patient-portal/recipients"],
  });

  const questionnairesQuery = useQuery<{ questionnaires: HealthQuestionnaire[] }>({
    queryKey: ["/api/patient-portal", selectedPatient, "questionnaires"],
    enabled: !!selectedPatient,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedThread) return;
      const thread = threadsQuery.data?.threads.find((t) => t.id === selectedThread);
      if (!thread) return;
      const recipient = thread.participants.find((p) => p.role !== "patient");
      if (!recipient) return;

      const response = await apiRequest("POST", `/api/patient-portal/${selectedPatient}/messages`, {
        threadId: selectedThread,
        content: newMessageContent,
        recipientId: recipient.id,
        recipientName: recipient.name,
        subject: thread.subject,
        isUrgent: false,
      });
      return response.json();
    },
    onSuccess: () => {
      setNewMessageContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", selectedPatient, "messages", selectedThread] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", selectedPatient, "message-threads"] });
      toast({ title: "Message Sent", description: "Your message has been sent securely." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async () => {
      const recipient = recipientsQuery.data?.recipients.find((r) => r.id === newThreadRecipient);
      if (!recipient) throw new Error("Recipient not found");

      const response = await apiRequest("POST", `/api/patient-portal/${selectedPatient}/threads`, {
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientRole: recipient.role,
        subject: newThreadSubject,
        content: newThreadContent,
        isUrgent: newThreadUrgent,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setShowNewThreadDialog(false);
      setNewThreadRecipient("");
      setNewThreadSubject("");
      setNewThreadContent("");
      setNewThreadUrgent(false);
      setSelectedThread(data.thread.id);
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", selectedPatient, "message-threads"] });
      toast({ title: "Message Sent", description: "Your message has been sent to your care team." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQuestionnaire) return;
      const responses = Object.entries(questionnaireAnswers).map(([questionId, answer]) => ({
        questionId,
        answer: answer as string | string[] | number | boolean,
      }));

      const response = await apiRequest("POST", `/api/patient-portal/${selectedPatient}/questionnaires/submit`, {
        questionnaireId: selectedQuestionnaire,
        responses,
      });
      return response.json();
    },
    onSuccess: () => {
      setSelectedQuestionnaire(null);
      setQuestionnaireAnswers({});
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", selectedPatient, "questionnaires"] });
      toast({ title: "Questionnaire Submitted", description: "Thank you for completing the questionnaire." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit questionnaire.", variant: "destructive" });
    },
  });

  const selectedQuestionnaireData = questionnairesQuery.data?.questionnaires.find((q) => q.id === selectedQuestionnaire);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <User className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Health Records</h1>
          <p className="text-muted-foreground">View your health records and communicate with your care team</p>
        </div>
      </div>

      <Alert className="mb-6">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Secure Portal</AlertTitle>
        <AlertDescription>
          Your health information is protected. All interactions are encrypted and logged for your privacy and security.
        </AlertDescription>
      </Alert>

      <div className="mb-6">
        <Label htmlFor="patient-fhir-portal-select-your-profile">Select Your Profile</Label>
        {patientsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground mt-2">Loading...</p>
        ) : (
          <Select value={selectedPatient} onValueChange={(val) => { setSelectedPatient(val); setSelectedThread(null); }}>
            <SelectTrigger id="patient-fhir-portal-select-your-profile" className="w-64 mt-2" data-testid="select-patient">
              <SelectValue placeholder="Choose your profile" />
            </SelectTrigger>
            <SelectContent>
              {patientsQuery.data?.patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {selectedPatient && (
        <Tabs defaultValue="health-records">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="health-records"><Heart className="h-4 w-4 mr-2" />Health Records</TabsTrigger>
            <TabsTrigger value="care-plans"><ClipboardList className="h-4 w-4 mr-2" />Care Plans</TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 mr-2" />Messages</TabsTrigger>
            <TabsTrigger value="questionnaires"><FileText className="h-4 w-4 mr-2" />Forms</TabsTrigger>
            <TabsTrigger value="family-history"><Dna className="h-4 w-4 mr-2" />Family History</TabsTrigger>
          </TabsList>

          <TabsContent value="health-records" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" />Medications</CardTitle>
                  <CardDescription>Your current and past medications</CardDescription>
                </CardHeader>
                <CardContent>
                  {medicationsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {medicationsQuery.data?.medications.map((med) => (
                          <div key={med.id} className="p-3 rounded border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{med.name}</span>
                              <Badge className={STATUS_COLORS[med.status]}>{med.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                            <p className="text-xs text-muted-foreground mt-1">Prescribed by {med.prescriber}</p>
                            {med.instructions && <p className="text-xs mt-1 italic">{med.instructions}</p>}
                            {med.refillsRemaining !== undefined && (
                              <p className="text-xs text-muted-foreground mt-1">{med.refillsRemaining} refills remaining</p>
                            )}
                          </div>
                        ))}
                        {!medicationsQuery.data?.medications.length && (
                          <p className="text-center text-muted-foreground py-4">No medications on file.</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Allergies</CardTitle>
                  <CardDescription>Your documented allergies and reactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {allergiesQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {allergiesQuery.data?.allergies.map((allergy) => (
                          <div key={allergy.id} className="p-3 rounded border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{allergy.allergen}</span>
                              <Badge className={SEVERITY_COLORS[allergy.severity]}>{allergy.severity}</Badge>
                            </div>
                            <p className="text-sm">{allergy.reaction}</p>
                            {allergy.notes && <p className="text-xs text-muted-foreground mt-1">{allergy.notes}</p>}
                          </div>
                        ))}
                        {!allergiesQuery.data?.allergies.length && (
                          <p className="text-center text-muted-foreground py-4">No allergies on file.</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Conditions</CardTitle>
                  <CardDescription>Your health conditions and diagnoses</CardDescription>
                </CardHeader>
                <CardContent>
                  {conditionsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {conditionsQuery.data?.conditions.map((condition) => (
                          <div key={condition.id} className="p-3 rounded border">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{condition.name}</span>
                              <Badge className={STATUS_COLORS[condition.status]}>{condition.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">Category: {condition.category}</p>
                            <p className="text-xs text-muted-foreground">Since {new Date(condition.onsetDate).toLocaleDateString()}</p>
                            {condition.managedBy && <p className="text-xs mt-1">Managed by: {condition.managedBy}</p>}
                            {condition.notes && <p className="text-xs text-muted-foreground mt-1 italic">{condition.notes}</p>}
                          </div>
                        ))}
                        {!conditionsQuery.data?.conditions.length && (
                          <p className="text-center text-muted-foreground py-4">No conditions on file.</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Scissors className="h-5 w-5" />Surgeries & Procedures</CardTitle>
                  <CardDescription>Your surgical history</CardDescription>
                </CardHeader>
                <CardContent>
                  {surgeriesQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-3">
                        {surgeriesQuery.data?.surgeries.map((surgery) => (
                          <div key={surgery.id} className="p-3 rounded border">
                            <span className="font-medium">{surgery.procedure}</span>
                            <p className="text-sm text-muted-foreground">{new Date(surgery.date).toLocaleDateString()}</p>
                            {surgery.surgeon && <p className="text-xs">Surgeon: {surgery.surgeon}</p>}
                            {surgery.facility && <p className="text-xs text-muted-foreground">{surgery.facility}</p>}
                            {surgery.outcome && <p className="text-xs mt-1 text-green-600 dark:text-green-400">{surgery.outcome}</p>}
                          </div>
                        ))}
                        {!surgeriesQuery.data?.surgeries.length && (
                          <p className="text-center text-muted-foreground py-4">No surgeries on file.</p>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="care-plans" className="mt-6">
            <Alert className="mb-4">
              <ClipboardList className="h-4 w-4" />
              <AlertTitle>Care Plan Templates - For Review Only</AlertTitle>
              <AlertDescription>
                These care plans are provided for your review and discussion with your care team. They do not constitute medical advice. All clinical decisions are made by your healthcare providers.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              {carePlansQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading care plans...</p>
              ) : carePlansQuery.data?.carePlans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.title}</CardTitle>
                      <Badge className={STATUS_COLORS[plan.status]}>{plan.status.replace("_", " ")}</Badge>
                    </div>
                    <CardDescription>Last updated: {new Date(plan.updatedAt).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4" />Goals</h4>
                        <div className="space-y-2">
                          {plan.goals.map((goal) => (
                            <div key={goal.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span className="text-sm">{goal.description}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Target: {new Date(goal.targetDate).toLocaleDateString()}</Badge>
                                <Badge className={STATUS_COLORS[goal.status] || ""}>{goal.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" />Care Activities</h4>
                        <div className="space-y-2">
                          {plan.interventions.map((intervention) => (
                            <div key={intervention.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span className="text-sm">{intervention.description}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{intervention.frequency}</Badge>
                                <span className="text-xs text-muted-foreground">{intervention.assignedTo}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      {plan.notes && (
                        <>
                          <Separator />
                          <p className="text-sm text-muted-foreground italic">{plan.notes}</p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!carePlansQuery.data?.carePlans.length && (
                <Card><CardContent className="py-8 text-center text-muted-foreground">No care plans on file.</CardContent></Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-6">
            <Alert className="mb-4">
              <MessageSquare className="h-4 w-4" />
              <AlertTitle>Secure Messaging</AlertTitle>
              <AlertDescription>
                Messages are encrypted and logged for your security. For urgent medical concerns, please call your provider directly or visit an emergency room. Response times may vary.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Conversations</CardTitle>
                    <Dialog open={showNewThreadDialog} onOpenChange={setShowNewThreadDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-new-message"><Plus className="h-4 w-4 mr-1" />New</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>New Message</DialogTitle>
                          <DialogDescription>Send a secure message to your care team</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <Label htmlFor="patient-fhir-portal-to">To</Label>
                            <Select value={newThreadRecipient} onValueChange={setNewThreadRecipient}>
                              <SelectTrigger id="patient-fhir-portal-to" className="mt-1" data-testid="select-recipient">
                                <SelectValue placeholder="Select recipient" />
                              </SelectTrigger>
                              <SelectContent>
                                {recipientsQuery.data?.recipients.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name} - {r.specialty || r.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="patient-fhir-portal-subject">Subject</Label>
                            <Input id="patient-fhir-portal-subject" value={newThreadSubject} onChange={(e) => setNewThreadSubject(e.target.value)} className="mt-1" placeholder="Enter subject" data-testid="input-subject" />
                          </div>
                          <div>
                            <Label htmlFor="patient-fhir-portal-message">Message</Label>
                            <Textarea id="patient-fhir-portal-message" value={newThreadContent} onChange={(e) => setNewThreadContent(e.target.value)} className="mt-1" rows={4} placeholder="Type your message..." data-testid="input-message-content" />
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="urgent" checked={newThreadUrgent} onCheckedChange={(c) => setNewThreadUrgent(c === true)} />
                            <label htmlFor="urgent" className="text-sm">Mark as urgent</label>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowNewThreadDialog(false)}>Cancel</Button>
                          <Button onClick={() => createThreadMutation.mutate()} disabled={!newThreadRecipient || !newThreadSubject || !newThreadContent || createThreadMutation.isPending} data-testid="button-send-new-message">
                            {createThreadMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                            Send
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {threadsQuery.data?.threads.map((thread) => (
                        <div key={thread.id} {...clickable(() => setSelectedThread(thread.id))} className={`p-3 rounded border cursor-pointer hover-elevate ${selectedThread === thread.id ? "border-primary bg-primary/5" : ""}`} data-testid={`thread-${thread.id}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">{thread.subject}</span>
                            {thread.isUrgent && <Badge className="bg-red-100 text-red-800">Urgent</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{thread.participants.find((p) => p.role !== "patient")?.name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(thread.lastMessageAt).toLocaleDateString()}</span>
                            {thread.unreadCount > 0 && <Badge variant="secondary" className="text-xs">{thread.unreadCount} new</Badge>}
                          </div>
                        </div>
                      ))}
                      {!threadsQuery.data?.threads.length && (
                        <p className="text-center text-muted-foreground py-4 text-sm">No messages yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{selectedThread ? threadsQuery.data?.threads.find((t) => t.id === selectedThread)?.subject : "Select a conversation"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedThread ? (
                    <>
                      <ScrollArea className="h-[300px] mb-4">
                        <div className="space-y-3">
                          {messagesQuery.data?.messages.map((msg) => (
                            <div key={msg.id} className={`p-3 rounded ${msg.senderRole === "patient" ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{msg.senderName}</span>
                                <span className="text-xs text-muted-foreground">{new Date(msg.sentAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <Separator className="my-4" />
                      <div className="flex gap-2">
                        <Textarea value={newMessageContent} onChange={(e) => setNewMessageContent(e.target.value)} placeholder="Type your reply..." className="flex-1" rows={2} data-testid="input-reply" />
                        <Button onClick={() => sendMessageMutation.mutate()} disabled={!newMessageContent.trim() || sendMessageMutation.isPending} data-testid="button-send-reply">
                          {sendMessageMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">Select a conversation to view messages</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="questionnaires" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Health Forms</CardTitle>
                  <CardDescription>Complete forms to help your care team</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {questionnairesQuery.data?.questionnaires.map((q) => (
                        <div key={q.id} {...clickable(() => q.status !== "completed" && setSelectedQuestionnaire(q.id))} className={`p-3 rounded border ${q.status !== "completed" ? "cursor-pointer hover-elevate" : ""} ${selectedQuestionnaire === q.id ? "border-primary" : ""}`} data-testid={`questionnaire-${q.id}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{q.title}</span>
                            <Badge className={STATUS_COLORS[q.status]}>{q.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{q.description}</p>
                          {q.dueDate && q.status !== "completed" && (
                            <p className="text-xs text-muted-foreground mt-1">Due: {new Date(q.dueDate).toLocaleDateString()}</p>
                          )}
                          {q.completedAt && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Completed {new Date(q.completedAt).toLocaleDateString()}</p>
                          )}
                        </div>
                      ))}
                      {!questionnairesQuery.data?.questionnaires.length && (
                        <p className="text-center text-muted-foreground py-4">No forms available.</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{selectedQuestionnaireData?.title || "Select a Form"}</CardTitle>
                  {selectedQuestionnaireData && <CardDescription>{selectedQuestionnaireData.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  {selectedQuestionnaireData ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-4 pr-4">
                        {selectedQuestionnaireData.questions.map((question, idx) => (
                          <div key={question.id} className="space-y-2">
                            <Label className="flex items-start gap-2">
                              <span className="text-muted-foreground">{idx + 1}.</span>
                              <span>{question.text}{question.required && <span className="text-red-500 ml-1">*</span>}</span>
                            </Label>
                            {question.type === "text" && (
                              <Textarea value={(questionnaireAnswers[question.id] as string) || ""} onChange={(e) => setQuestionnaireAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))} placeholder="Your answer..." data-testid={`question-${question.id}`} />
                            )}
                            {question.type === "single_choice" && question.options && (
                              <RadioGroup value={(questionnaireAnswers[question.id] as string) || ""} onValueChange={(val) => setQuestionnaireAnswers((prev) => ({ ...prev, [question.id]: val }))}>
                                {question.options.map((opt) => (
                                  <div key={opt} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                                    <label htmlFor={`${question.id}-${opt}`} className="text-sm">{opt}</label>
                                  </div>
                                ))}
                              </RadioGroup>
                            )}
                            {question.type === "multiple_choice" && question.options && (
                              <div className="space-y-2">
                                {question.options.map((opt) => {
                                  const currentAnswers = (questionnaireAnswers[question.id] as string[]) || [];
                                  return (
                                    <div key={opt} className="flex items-center space-x-2">
                                      <Checkbox id={`${question.id}-${opt}`} checked={currentAnswers.includes(opt)} onCheckedChange={(checked) => {
                                        setQuestionnaireAnswers((prev) => ({
                                          ...prev,
                                          [question.id]: checked ? [...currentAnswers, opt] : currentAnswers.filter((a) => a !== opt),
                                        }));
                                      }} />
                                      <label htmlFor={`${question.id}-${opt}`} className="text-sm">{opt}</label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {question.type === "scale" && (
                              <div className="space-y-2">
                                <Slider value={[(questionnaireAnswers[question.id] as number) || question.scaleMin || 1]} onValueChange={(val) => setQuestionnaireAnswers((prev) => ({ ...prev, [question.id]: val[0] }))} min={question.scaleMin || 1} max={question.scaleMax || 10} step={1} />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>{question.scaleMin || 1}</span>
                                  <span className="font-medium">{(questionnaireAnswers[question.id] as number) || question.scaleMin || 1}</span>
                                  <span>{question.scaleMax || 10}</span>
                                </div>
                              </div>
                            )}
                            {question.type === "boolean" && (
                              <RadioGroup value={questionnaireAnswers[question.id] === true ? "yes" : questionnaireAnswers[question.id] === false ? "no" : ""} onValueChange={(val) => setQuestionnaireAnswers((prev) => ({ ...prev, [question.id]: val === "yes" }))}>
                                <div className="flex items-center space-x-4">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                                    <label htmlFor={`${question.id}-yes`}>Yes</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="no" id={`${question.id}-no`} />
                                    <label htmlFor={`${question.id}-no`}>No</label>
                                  </div>
                                </div>
                              </RadioGroup>
                            )}
                          </div>
                        ))}
                        <Button className="w-full mt-4" onClick={() => submitQuestionnaireMutation.mutate()} disabled={submitQuestionnaireMutation.isPending} data-testid="button-submit-questionnaire">
                          {submitQuestionnaireMutation.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                          Submit Form
                        </Button>
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">Select a form to complete</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="family-history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Dna className="h-5 w-5" />Family Health History</CardTitle>
                <CardDescription>Understanding your family history helps identify potential genetic risks</CardDescription>
              </CardHeader>
              <CardContent>
                {familyHistoryQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <div className="space-y-3">
                    {familyHistoryQuery.data?.familyHistory.map((item) => (
                      <div key={item.id} className="p-4 rounded border flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{item.relationship}</span>
                            {item.deceased && <Badge variant="outline" className="text-xs">Deceased</Badge>}
                          </div>
                          <p className="text-sm">{item.condition}</p>
                          {item.ageAtOnset && <p className="text-xs text-muted-foreground">Age at onset: {item.ageAtOnset}</p>}
                          {item.notes && <p className="text-xs text-muted-foreground mt-1 italic">{item.notes}</p>}
                        </div>
                        {item.geneticRiskLevel && (
                          <Badge className={RISK_COLORS[item.geneticRiskLevel]}>
                            {item.geneticRiskLevel} risk
                          </Badge>
                        )}
                      </div>
                    ))}
                    {!familyHistoryQuery.data?.familyHistory.length && (
                      <p className="text-center text-muted-foreground py-8">No family history on file.</p>
                    )}
                  </div>
                )}
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Genetic Risk Information</AlertTitle>
                  <AlertDescription>
                    Risk levels are based on documented family history. Please discuss with your healthcare provider about appropriate screenings and preventive measures.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
