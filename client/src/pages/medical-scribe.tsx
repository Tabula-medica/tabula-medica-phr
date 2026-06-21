import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  MessageSquare,
  Activity,
  Pill,
  AlertCircle,
  CheckCircle2,
  Clock,
  Stethoscope,
  Clipboard,
  Sparkles,
  Send,
  FileCheck,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  Calendar,
  User,
  Heart,
  ThermometerSun,
  Mic,
  MicOff,
  Loader2,
  ListTodo,
  Bell,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  CircleDot,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useVoiceRecorder } from "../../replit_integrations/audio/useVoiceRecorder";

interface ActionItem {
  id: string;
  task: string;
  category: string;
  priority: string;
  dueDescription?: string;
  dueDays?: number | null;
  completed: boolean;
}

interface ClinicalNote {
  noteId: string;
  noteType: string;
  patientId?: string;
  generatedAt: string;
  status: string;
  sections: any;
  extractedEntities: {
    symptoms: string[];
    diagnoses: string[];
    medications: string[];
    procedures: string[];
    labTests: string[];
    vitals: string[];
    allergies: string[];
    actionItems?: ActionItem[];
  };
  confidence: number;
  disclaimer: string;
}

interface ConversationSummary {
  summaryId: string;
  keyPoints: string[];
  symptoms: string[];
  diagnoses: string[];
  treatments: string[];
  patientConcerns: string[];
  followUpPlan: string;
  safetyFlags: string[];
  generatedAt: string;
  confidence: number;
}

interface PostVisitSummary {
  summaryId: string;
  patientFriendlySummary: string;
  whatWasDiscussed: string[];
  actionItems: ActionItem[];
  medicationChanges: Array<{ medication: string; change: string }>;
  followUpAppointments: Array<{ description: string; timing: string; dueDays?: number | null }>;
  warningSignsToWatch: string[];
  questionsToAsk: string[];
  generatedAt: string;
  disclaimer: string;
}

const categoryIcons: Record<string, JSX.Element> = {
  medication: <Pill className="h-4 w-4" />,
  appointment: <Calendar className="h-4 w-4" />,
  lab_test: <Activity className="h-4 w-4" />,
  lifestyle: <Heart className="h-4 w-4" />,
  monitoring: <CircleDot className="h-4 w-4" />,
  referral: <ArrowRight className="h-4 w-4" />,
  other: <ListTodo className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-green-500/10 text-green-600 border-green-500/30",
};

export default function MedicalScribePage() {
  useSEO({ title: "Record Visit - AI Medical Scribe | Tabula Medica" });
  const [activeTab, setActiveTab] = useState("generate");
  const [inputText, setInputText] = useState("");
  const [inputType, setInputType] = useState<"free_text" | "conversation">("free_text");
  const [noteType, setNoteType] = useState<string>("SOAP");
  const [generatedNote, setGeneratedNote] = useState<ClinicalNote | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [postVisitSummary, setPostVisitSummary] = useState<PostVisitSummary | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { toast } = useToast();
  const { state: recordingState, startRecording, stopRecording } = useVoiceRecorder();

  const { data: noteTypesData } = useQuery<{ noteTypes: Array<{ value: string; label: string; description: string }>; disclaimer: string }>({
    queryKey: ["/api/medical-scribe/note-types"],
  });

  const { data: recentNotesData, isLoading: notesLoading } = useQuery<{ notes: ClinicalNote[]; disclaimer: string }>({
    queryKey: ["/api/medical-scribe/notes"],
  });

  const generateNoteMutation = useMutation({
    mutationFn: async (data: { content: string; inputType: string; noteType: string }) => {
      const response = await apiRequest("POST", "/api/medical-scribe/generate", data);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedNote(data.note);
      toast({ title: "Note Generated", description: "Clinical note has been generated. Please review before use." });
      queryClient.invalidateQueries({ queryKey: ["/api/medical-scribe/notes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const summarizeMutation = useMutation({
    mutationFn: async (conversation: string) => {
      const response = await apiRequest("POST", "/api/medical-scribe/summarize", { conversation });
      return response.json();
    },
    onSuccess: (data) => {
      setSummary(data.summary);
      toast({ title: "Summary Generated", description: "Conversation summary has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const postVisitMutation = useMutation({
    mutationFn: async (conversation: string) => {
      const response = await apiRequest("POST", "/api/medical-scribe/post-visit-summary", { conversation });
      return response.json();
    },
    onSuccess: (data) => {
      setPostVisitSummary(data.postVisitSummary);
      setCompletedItems(new Set());
      toast({ title: "Post-Visit Summary Ready", description: "Your to-do list and follow-up reminders have been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createRemindersMutation = useMutation({
    mutationFn: async (data: { actionItems: ActionItem[]; followUpAppointments: PostVisitSummary["followUpAppointments"] }) => {
      const response = await apiRequest("POST", "/api/medical-scribe/create-reminders", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Reminders Set", description: `${data.count} reminder(s) have been scheduled.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ noteId, status }: { noteId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/medical-scribe/notes/${noteId}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Status Updated", description: "Note status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/medical-scribe/notes"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!inputText.trim()) {
      toast({ title: "Input Required", description: "Please enter clinical content to process.", variant: "destructive" });
      return;
    }
    generateNoteMutation.mutate({ content: inputText, inputType, noteType });
  };

  const handleSummarize = () => {
    if (!inputText.trim()) {
      toast({ title: "Input Required", description: "Please enter a conversation to summarize.", variant: "destructive" });
      return;
    }
    summarizeMutation.mutate(inputText);
  };

  const handlePostVisitSummary = () => {
    if (!inputText.trim()) {
      toast({ title: "Input Required", description: "Please enter or record an encounter first.", variant: "destructive" });
      return;
    }
    postVisitMutation.mutate(inputText);
  };

  const handleSetReminders = () => {
    if (!postVisitSummary) return;
    const uncompleted = postVisitSummary.actionItems.filter(item => !completedItems.has(item.id));
    createRemindersMutation.mutate({
      actionItems: uncompleted,
      followUpAppointments: postVisitSummary.followUpAppointments,
    });
  };

  const toggleItemCompleted = (id: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleRecording = async () => {
    if (recordingState === "recording") {
      setIsTranscribing(true);
      try {
        const audioBlob = await stopRecording();
        if (audioBlob.size === 0) {
          toast({ title: "No Audio", description: "No audio was captured. Please try again.", variant: "destructive" });
          setIsTranscribing(false);
          return;
        }
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("format", "webm");
        const response = await fetch("/api/voice/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Transcription failed");
        const data = await response.json();
        const transcript = data.transcript || data.text || "";
        if (transcript) {
          setInputText((prev) => prev ? prev + "\n\n" + transcript : transcript);
          setInputType("conversation");
          toast({ title: "Recording Transcribed", description: "Audio has been transcribed and added to the input." });
        } else {
          toast({ title: "No Speech Detected", description: "Could not detect speech in the recording.", variant: "destructive" });
        }
      } catch (err: any) {
        toast({ title: "Transcription Error", description: err.message || "Failed to transcribe audio.", variant: "destructive" });
      } finally {
        setIsTranscribing(false);
      }
    } else {
      try {
        await startRecording();
        toast({ title: "Recording Started", description: "Speak clearly to capture your encounter." });
      } catch (err: any) {
        toast({ title: "Microphone Access Denied", description: "Please allow microphone access to record.", variant: "destructive" });
      }
    }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    pending_review: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    reviewed: "bg-green-500/10 text-green-600 border-green-500/30",
    finalized: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  };

  const statusIcons: Record<string, JSX.Element> = {
    draft: <Clock className="h-3 w-3" />,
    pending_review: <RefreshCw className="h-3 w-3" />,
    reviewed: <CheckCircle2 className="h-3 w-3" />,
    finalized: <FileCheck className="h-3 w-3" />,
  };

  const recentNotes = recentNotesData?.notes || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Stethoscope className="h-6 w-6" />
            Record Visit
          </h1>
          <p className="text-muted-foreground">Record your encounter, generate notes, get your to-do list and reminders</p>
        </div>
        <Button
          onClick={handleToggleRecording}
          disabled={isTranscribing}
          variant={recordingState === "recording" ? "destructive" : "default"}
          data-testid="button-toggle-recording"
        >
          {isTranscribing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Transcribing...
            </>
          ) : recordingState === "recording" ? (
            <>
              <MicOff className="h-4 w-4 mr-2" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="h-4 w-4 mr-2" />
              Record Encounter
            </>
          )}
        </Button>
      </div>

      {recordingState === "recording" && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <Mic className="h-4 w-4 text-red-500 animate-pulse" />
          <AlertTitle>Recording in Progress</AlertTitle>
          <AlertDescription>
            Your encounter is being recorded. Click "Stop Recording" when finished to transcribe the audio automatically.
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Documentation Assistance Only</AlertTitle>
        <AlertDescription>
          This AI scribe is for documentation assistance only, NOT clinical decision support. All generated notes must be reviewed and verified by a licensed healthcare provider before use.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="generate" data-testid="tab-generate" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Generate Note</span>
            <span className="sm:hidden">Note</span>
          </TabsTrigger>
          <TabsTrigger value="post-visit" data-testid="tab-post-visit" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Post-Visit Summary</span>
            <span className="sm:hidden">To-Do</span>
          </TabsTrigger>
          <TabsTrigger value="summarize" data-testid="tab-summarize" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Summarize</span>
            <span className="sm:hidden">Summary</span>
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Recent Notes</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Generate Note Tab */}
        <TabsContent value="generate" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Input
                </CardTitle>
                <CardDescription>Enter clinical conversation or free-text notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Input Type</label>
                    <Select value={inputType} onValueChange={(v) => setInputType(v as any)}>
                      <SelectTrigger data-testid="select-input-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free_text">Free Text / Notes</SelectItem>
                        <SelectItem value="conversation">Doctor-Patient Conversation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Note Type</label>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger data-testid="select-note-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {noteTypesData?.noteTypes?.map((nt) => (
                          <SelectItem key={nt.value} value={nt.value}>
                            {nt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  placeholder={inputType === "conversation"
                    ? "Doctor: What brings you in today?\nPatient: I've been having headaches for the past week..."
                    : "Enter clinical notes, symptoms, observations, or any medical text to process..."
                  }
                  className="min-h-[300px] font-mono text-sm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  data-testid="input-clinical-text"
                />
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleGenerate}
                  disabled={generateNoteMutation.isPending || !inputText.trim()}
                  className="w-full"
                  data-testid="button-generate-note"
                >
                  {generateNoteMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Clinical Note
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clipboard className="h-5 w-5" />
                  Generated Note
                </CardTitle>
                <CardDescription>AI-generated structured clinical documentation</CardDescription>
              </CardHeader>
              <CardContent>
                {generateNoteMutation.isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : generatedNote ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Badge className={statusColors[generatedNote.status]}>
                          {statusIcons[generatedNote.status]}
                          <span className="ml-1">{generatedNote.status.replace("_", " ")}</span>
                        </Badge>
                        <Badge variant="outline">
                          Confidence: {Math.round(generatedNote.confidence * 100)}%
                        </Badge>
                      </div>

                      {generatedNote.sections.chiefComplaint && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">Chief Complaint</h4>
                          <p className="text-sm text-muted-foreground">{generatedNote.sections.chiefComplaint}</p>
                        </div>
                      )}

                      {generatedNote.sections.subjective && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                            <User className="h-4 w-4" /> Subjective
                          </h4>
                          <p className="text-sm text-muted-foreground">{generatedNote.sections.subjective}</p>
                        </div>
                      )}

                      {generatedNote.sections.historyOfPresentIllness && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1">History of Present Illness</h4>
                          <p className="text-sm text-muted-foreground">{generatedNote.sections.historyOfPresentIllness}</p>
                        </div>
                      )}

                      {generatedNote.sections.objective && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                            <Activity className="h-4 w-4" /> Objective
                          </h4>
                          <p className="text-sm text-muted-foreground">{generatedNote.sections.objective}</p>
                        </div>
                      )}

                      {generatedNote.sections.physicalExam?.vitalSigns && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                            <ThermometerSun className="h-4 w-4" /> Vital Signs
                          </h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(generatedNote.sections.physicalExam.vitalSigns as Record<string, string>).filter(([_, value]) => !!value).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                <span>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {generatedNote.sections.assessment?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Assessment</h4>
                          <div className="space-y-2">
                            {generatedNote.sections.assessment.map((a: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="text-xs">
                                  {a.status}
                                </Badge>
                                <span>{a.diagnosis}</span>
                                {a.icdCode && <span className="text-muted-foreground">({a.icdCode})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {generatedNote.sections.plan?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Plan</h4>
                          <ul className="space-y-1">
                            {generatedNote.sections.plan.map((p: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <Badge variant="outline" className="text-xs shrink-0">{p.type}</Badge>
                                <span>{p.intervention}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {generatedNote.sections.followUp && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> Follow-up
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {generatedNote.sections.followUp.timing} - {generatedNote.sections.followUp.reason}
                          </p>
                        </div>
                      )}

                      {generatedNote.extractedEntities.actionItems && generatedNote.extractedEntities.actionItems.length > 0 && (
                        <>
                          <Separator />
                          <div>
                            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                              <ListTodo className="h-4 w-4" /> Action Items
                            </h4>
                            <div className="space-y-2">
                              {generatedNote.extractedEntities.actionItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50">
                                  {categoryIcons[item.category] || categoryIcons.other}
                                  <div className="flex-1">
                                    <span>{item.task}</span>
                                    {item.dueDescription && (
                                      <span className="text-muted-foreground ml-1">({item.dueDescription})</span>
                                    )}
                                  </div>
                                  <Badge className={priorityColors[item.priority] || priorityColors.medium} variant="outline">
                                    {item.priority}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      <Separator />

                      <div>
                        <h4 className="font-semibold text-sm mb-2">Extracted Entities</h4>
                        <div className="flex flex-wrap gap-1">
                          {generatedNote.extractedEntities.symptoms.map((s, i) => (
                            <Badge key={`sym-${i}`} variant="secondary" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />{s}
                            </Badge>
                          ))}
                          {generatedNote.extractedEntities.medications.map((m, i) => (
                            <Badge key={`med-${i}`} variant="secondary" className="text-xs">
                              <Pill className="h-3 w-3 mr-1" />{m}
                            </Badge>
                          ))}
                          {generatedNote.extractedEntities.diagnoses.map((d, i) => (
                            <Badge key={`dx-${i}`} variant="secondary" className="text-xs">
                              <Heart className="h-3 w-3 mr-1" />{d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Enter clinical content and click generate</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Post-Visit Summary Tab */}
        <TabsContent value="post-visit" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Visit Recording
                </CardTitle>
                <CardDescription>
                  Record or paste your doctor visit, then get a clear to-do list and follow-up reminders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Record your visit using the button above, or paste the conversation here...&#10;&#10;Doctor: Good morning, what brings you in today?&#10;Patient: I've been feeling really tired and having trouble sleeping..."
                  className="min-h-[250px] font-mono text-sm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  data-testid="input-post-visit-text"
                />
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handlePostVisitSummary}
                  disabled={postVisitMutation.isPending || !inputText.trim()}
                  className="w-full"
                  data-testid="button-generate-post-visit"
                >
                  {postVisitMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating Your Summary...
                    </>
                  ) : (
                    <>
                      <ListTodo className="h-4 w-4 mr-2" />
                      Get My To-Do List & Reminders
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <div className="space-y-4">
              {postVisitMutation.isPending ? (
                <Card>
                  <CardContent className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ) : postVisitSummary ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clipboard className="h-5 w-5" />
                        Your Visit Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed" data-testid="text-patient-summary">
                        {postVisitSummary.patientFriendlySummary}
                      </p>
                      {postVisitSummary.whatWasDiscussed.length > 0 && (
                        <div className="mt-3">
                          <h4 className="font-medium text-sm mb-1">What was discussed:</h4>
                          <ul className="list-disc list-inside space-y-0.5 text-sm text-muted-foreground">
                            {postVisitSummary.whatWasDiscussed.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {postVisitSummary.actionItems.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <ListTodo className="h-5 w-5" />
                            Your To-Do List
                          </CardTitle>
                          <Badge variant="outline">
                            {completedItems.size}/{postVisitSummary.actionItems.length} done
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {postVisitSummary.actionItems.map((item) => (
                            <div
                              key={item.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                completedItems.has(item.id) ? "bg-muted/30 opacity-60" : "bg-card"
                              }`}
                              data-testid={`action-item-${item.id}`}
                            >
                              <Checkbox
                                checked={completedItems.has(item.id)}
                                onCheckedChange={() => toggleItemCompleted(item.id)}
                                className="mt-0.5"
                                data-testid={`checkbox-${item.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {categoryIcons[item.category] || categoryIcons.other}
                                  <span className={`text-sm font-medium ${completedItems.has(item.id) ? "line-through" : ""}`}>
                                    {item.task}
                                  </span>
                                </div>
                                {item.dueDescription && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.dueDescription}
                                  </p>
                                )}
                              </div>
                              <Badge className={priorityColors[item.priority] || priorityColors.medium} variant="outline">
                                {item.priority}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          onClick={handleSetReminders}
                          disabled={createRemindersMutation.isPending}
                          className="w-full"
                          variant="outline"
                          data-testid="button-set-reminders"
                        >
                          {createRemindersMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Setting Reminders...
                            </>
                          ) : (
                            <>
                              <Bell className="h-4 w-4 mr-2" />
                              Set Reminders for Uncompleted Items
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}

                  {postVisitSummary.medicationChanges.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Pill className="h-5 w-5" />
                          Medication Changes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {postVisitSummary.medicationChanges.map((mc, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                              <Pill className="h-4 w-4 shrink-0 text-blue-500" />
                              <span className="font-medium">{mc.medication}:</span>
                              <span className="text-muted-foreground">{mc.change}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {postVisitSummary.followUpAppointments.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Calendar className="h-5 w-5" />
                          Follow-Up Appointments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {postVisitSummary.followUpAppointments.map((apt, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/50">
                              <Calendar className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                              <div>
                                <span className="font-medium">{apt.description}</span>
                                <p className="text-muted-foreground">{apt.timing}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {postVisitSummary.warningSignsToWatch.length > 0 && (
                    <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      <AlertTitle className="text-red-700 dark:text-red-400">Warning Signs to Watch For</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                          {postVisitSummary.warningSignsToWatch.map((sign, i) => (
                            <li key={i}>{sign}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {postVisitSummary.questionsToAsk.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <HelpCircle className="h-5 w-5" />
                          Questions for Next Visit
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {postVisitSummary.questionsToAsk.map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-3">
                      <ListTodo className="h-12 w-12 mx-auto opacity-50" />
                      <div>
                        <p className="font-medium">Record or enter your visit</p>
                        <p className="text-sm">Get a clear to-do list, medication changes, follow-up reminders, and warning signs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Summarize Tab */}
        <TabsContent value="summarize" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation Input
                </CardTitle>
                <CardDescription>Enter a doctor-patient conversation to summarize</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Doctor: Good morning. What brings you in today?&#10;Patient: I've been experiencing severe headaches for about a week now...&#10;Doctor: Can you describe the headaches? Where exactly is the pain?"
                  className="min-h-[300px] font-mono text-sm"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  data-testid="input-conversation"
                />
              </CardContent>
              <CardFooter>
                <Button
                  onClick={handleSummarize}
                  disabled={summarizeMutation.isPending || !inputText.trim()}
                  className="w-full"
                  data-testid="button-summarize"
                >
                  {summarizeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Summarize Conversation
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Summary
                </CardTitle>
                <CardDescription>Key points extracted from the conversation</CardDescription>
              </CardHeader>
              <CardContent>
                {summarizeMutation.isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : summary ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-end">
                        <Badge variant="outline">
                          Confidence: {Math.round(summary.confidence * 100)}%
                        </Badge>
                      </div>

                      {summary.keyPoints.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Key Points</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {summary.keyPoints.map((kp, i) => (
                              <li key={i}>{kp}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.symptoms.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" /> Symptoms
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {summary.symptoms.map((s, i) => (
                              <Badge key={i} variant="secondary">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {summary.diagnoses.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Diagnoses Discussed</h4>
                          <div className="flex flex-wrap gap-1">
                            {summary.diagnoses.map((d, i) => (
                              <Badge key={i} variant="outline">{d}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {summary.treatments.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                            <Pill className="h-4 w-4" /> Treatments
                          </h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {summary.treatments.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.patientConcerns.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Patient Concerns</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {summary.patientConcerns.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.followUpPlan && (
                        <div>
                          <h4 className="font-semibold text-sm mb-1 flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> Follow-up Plan
                          </h4>
                          <p className="text-sm text-muted-foreground">{summary.followUpPlan}</p>
                        </div>
                      )}

                      {summary.safetyFlags.length > 0 && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Safety Flags</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside">
                              {summary.safetyFlags.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Enter a conversation and click summarize</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Recent Clinical Notes
              </CardTitle>
              <CardDescription>Previously generated notes requiring review</CardDescription>
            </CardHeader>
            <CardContent>
              {notesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : recentNotes.length > 0 ? (
                <div className="space-y-3">
                  {recentNotes.map((note) => (
                    <Card key={note.noteId} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{note.noteType}</Badge>
                              <Badge className={statusColors[note.status]}>
                                {statusIcons[note.status]}
                                <span className="ml-1">{note.status.replace("_", " ")}</span>
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Generated: {new Date(note.generatedAt).toLocaleString()}
                            </p>
                            {note.sections.chiefComplaint && (
                              <p className="text-sm">
                                <span className="font-medium">Chief Complaint:</span> {note.sections.chiefComplaint}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {note.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ noteId: note.noteId, status: "pending_review" })}
                                data-testid={`button-review-${note.noteId}`}
                              >
                                Mark for Review
                              </Button>
                            )}
                            {note.status === "pending_review" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ noteId: note.noteId, status: "reviewed" })}
                                data-testid={`button-approve-${note.noteId}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No notes generated yet</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
