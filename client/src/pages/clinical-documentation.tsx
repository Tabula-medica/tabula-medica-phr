import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AIProviderAssistantPanel, AIAssistantToggleButton } from "@/components/ai-provider-assistant-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Mic, 
  MicOff, 
  FileText, 
  ClipboardList, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle,
  Upload,
  Play,
  Square,
  RefreshCw,
  FileCheck,
  Edit3,
  Activity,
  Pill,
  AlertTriangle,
  Calendar,
  Stethoscope,
  Tag,
  Hash,
  FlaskConical,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Loader2,
  Percent
} from "lucide-react";

interface EncounterData {
  patientName: string;
  dateOfBirth: string;
  visitDate: string;
  visitType: string;
  chiefComplaint: string;
  symptoms: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
    height?: string;
  };
  medications?: string[];
  allergies?: string[];
  medicalHistory?: string[];
  socialHistory?: string;
  assessment?: string;
  plan?: string;
}

interface EHRSection {
  sectionName: string;
  content: string;
  confidence: "High" | "Medium" | "Low";
  needsReview: boolean;
  reviewNotes?: string;
}

interface SynthesizedNote {
  encounterSummary: string;
  sections: EHRSection[];
  extractedDiagnoses: Array<{
    description: string;
    icdSuggestion?: string;
    confidence: "High" | "Medium" | "Low";
  }>;
  suggestedFollowUp: string;
  disclaimer: string;
}

interface EHRField {
  value: string;
  confidence: "High" | "Medium" | "Low";
  needsReview: boolean;
}

interface ExtractedEHRFields {
  templateType: string;
  fields: Record<string, EHRField>;
  missingFields: string[];
  warnings: string[];
  disclaimer: string;
}

interface NoteAnalysisResult {
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  entities: {
    diagnoses: Array<{ name: string; status: string; confidence: string }>;
    medications: Array<{ name: string; dosage: string; frequency: string; route: string; action: string }>;
    procedures: Array<{ name: string; status: string }>;
    allergies: Array<{ substance: string; reaction: string; severity: string }>;
    labOrders: Array<{ name: string; status: string; value: string; flag: string }>;
    symptoms: Array<{ name: string; duration: string; severity: string }>;
  };
  codeSuggestions: Array<{ type: string; code: string; description: string; confidence: string; rationale: string }>;
  noteSummary: string;
  completenessScore: number;
  missingElements: string[];
  disclaimer: string;
  analyzedAt: string;
  fallback?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: "High" | "Medium" | "Low" }) {
  const variant = confidence === "High" ? "default" : confidence === "Medium" ? "secondary" : "outline";
  return <Badge variant={variant} className="text-xs">{confidence}</Badge>;
}

function SectionCard({ section, onCopy }: { section: EHRSection; onCopy: (text: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(section.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={`hover-elevate ${section.needsReview ? "border-yellow-500/50" : ""}`}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{section.sectionName}</CardTitle>
            <ConfidenceBadge confidence={section.confidence} />
            {section.needsReview && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Review
              </Badge>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            data-testid={`button-copy-section-${section.sectionName.toLowerCase().replace(/\s/g, "-")}`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
        {section.reviewNotes && (
          <p className="text-xs text-yellow-600 mt-2 italic">{section.reviewNotes}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClinicalDocumentation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("note-creator");
  const [inputMode, setInputMode] = useState<"audio" | "structured" | "text">("structured");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [freeTextInput, setFreeTextInput] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("soap");
  const [synthesizedNote, setSynthesizedNote] = useState<SynthesizedNote | null>(null);
  const [extractedFields, setExtractedFields] = useState<ExtractedEHRFields | null>(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [noteCreatorText, setNoteCreatorText] = useState("");
  const [noteCreatorMode, setNoteCreatorMode] = useState<"type" | "dictate">("type");
  const [isNoteRecording, setIsNoteRecording] = useState(false);
  const [noteAudioBlob, setNoteAudioBlob] = useState<Blob | null>(null);
  const [noteTranscript, setNoteTranscript] = useState("");
  const [noteAnalysis, setNoteAnalysis] = useState<NoteAnalysisResult | null>(null);
  const [expandedSoapSections, setExpandedSoapSections] = useState<Record<string, boolean>>({ subjective: true, objective: true, assessment: true, plan: true });
  const [expandedEntityGroups, setExpandedEntityGroups] = useState<Record<string, boolean>>({ diagnoses: true, medications: true, procedures: false, allergies: false, labOrders: false, symptoms: false });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const noteMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const noteAudioChunksRef = useRef<Blob[]>([]);

  const sampleQuery = useQuery<{ success: boolean; data: EncounterData }>({
    queryKey: ["/api/clinical-docs/sample-encounter"],
  });

  const templatesQuery = useQuery<{ success: boolean; data: Array<{ id: string; name: string; description: string; sections: string[] }> }>({
    queryKey: ["/api/clinical-docs/templates"],
  });

  const transcribeMutation = useMutation({
    mutationFn: async (input: { audioBase64: string; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/clinical-docs/transcribe", {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setTranscriptionText(data.data.text);
        toast({
          title: "Transcription complete",
          description: "Audio has been transcribed. Review and edit as needed.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Transcription failed",
        description: "Unable to transcribe audio. Please try again.",
        variant: "destructive",
      });
    },
  });

  const synthesizeMutation = useMutation({
    mutationFn: async (input: { encounterData?: EncounterData; transcriptionText?: string }) => {
      const response = await apiRequest("POST", "/api/clinical-docs/synthesize-note", input);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setSynthesizedNote(data.data);
        setActiveTab("synthesized");
        toast({
          title: "Note synthesized",
          description: "Encounter note has been generated. Review all sections before use.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Synthesis failed",
        description: "Unable to synthesize note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const response = await apiRequest("POST", "/api/clinical-docs/extract-ehr-fields", {
        noteText,
        targetTemplate: selectedTemplate.toUpperCase(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setExtractedFields(data.data);
        setActiveTab("ehr");
        toast({
          title: "EHR fields extracted",
          description: "Fields have been auto-populated. Review before saving to EHR.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Extraction failed",
        description: "Unable to extract EHR fields. Please try again.",
        variant: "destructive",
      });
    },
  });

  const analyzeNoteMutation = useMutation({
    mutationFn: async (input: { noteText: string; patientContext?: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/clinical-docs/analyze-note", input);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setNoteAnalysis(data.data);
        toast({
          title: "Note analyzed",
          description: "AI has categorized your note into SOAP sections and extracted clinical entities.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Unable to analyze the clinical note. Please try again.",
        variant: "destructive",
      });
    },
  });

  const noteTranscribeMutation = useMutation({
    mutationFn: async (input: { audioBase64: string; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/clinical-docs/transcribe", {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setNoteTranscript(data.data.text);
        setNoteCreatorText(data.data.text);
        toast({
          title: "Dictation transcribed",
          description: "Your voice note has been transcribed. Review and edit before analyzing.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Transcription failed",
        description: "Unable to transcribe audio. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startNoteRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      noteMediaRecorderRef.current = mediaRecorder;
      noteAudioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        noteAudioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const recordedMimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(noteAudioChunksRef.current, { type: recordedMimeType });
        setNoteAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsNoteRecording(true);
      toast({ title: "Recording started", description: "Dictate your clinical note clearly." });
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access.", variant: "destructive" });
    }
  };

  const stopNoteRecording = () => {
    if (noteMediaRecorderRef.current && isNoteRecording) {
      noteMediaRecorderRef.current.stop();
      setIsNoteRecording(false);
    }
  };

  const transcribeNoteAudio = async () => {
    if (!noteAudioBlob) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      noteTranscribeMutation.mutate({ audioBase64: base64, mimeType: noteAudioBlob.type });
    };
    reader.readAsDataURL(noteAudioBlob);
  };

  const handleAnalyzeNote = () => {
    const text = noteCreatorText.trim();
    if (!text || text.length < 10) {
      toast({ title: "Note too short", description: "Please enter at least 10 characters of clinical note text.", variant: "destructive" });
      return;
    }
    const patientContext = sampleEncounter ? {
      patientName: sampleEncounter.patientName,
      dateOfBirth: sampleEncounter.dateOfBirth,
      visitDate: sampleEncounter.visitDate,
      visitType: sampleEncounter.visitType,
    } : undefined;
    analyzeNoteMutation.mutate({ noteText: text, patientContext });
  };

  const toggleSoapSection = (key: string) => {
    setExpandedSoapSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEntityGroup = (key: string) => {
    setExpandedEntityGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyNoteSection = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, description: "Section content copied to clipboard." });
  };

  const getEntityCount = (entities: NoteAnalysisResult["entities"]) => {
    return Object.values(entities).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  };

  const getCodeConfidenceBadge = (confidence: string) => {
    const c = confidence.toLowerCase();
    if (c === "high") return <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High</Badge>;
    if (c === "medium") return <Badge className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>;
    return <Badge variant="outline" className="text-xs">Low</Badge>;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const recordedMimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Speak clearly to record the clinical encounter.",
      });
    } catch {
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record audio.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      transcribeMutation.mutate({ audioBase64: base64, mimeType: audioBlob.type });
    };
    reader.readAsDataURL(audioBlob);
  };

  const handleSynthesize = () => {
    if (inputMode === "audio" && transcriptionText) {
      synthesizeMutation.mutate({ transcriptionText });
    } else if (inputMode === "structured" && sampleQuery.data?.data) {
      synthesizeMutation.mutate({ encounterData: sampleQuery.data.data });
    } else if (inputMode === "text" && freeTextInput) {
      synthesizeMutation.mutate({ transcriptionText: freeTextInput });
    } else {
      toast({
        title: "No input provided",
        description: "Please provide audio, structured data, or text input.",
        variant: "destructive",
      });
    }
  };

  const handleExtractToEHR = () => {
    if (!synthesizedNote) return;
    const fullNoteText = synthesizedNote.sections.map(s => `${s.sectionName}:\n${s.content}`).join("\n\n");
    extractMutation.mutate(fullNoteText);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied.",
    });
  };

  const sampleEncounter = sampleQuery.data?.data;
  const templates = templatesQuery.data?.data || [];
  const isProcessing = transcribeMutation.isPending || synthesizeMutation.isPending || extractMutation.isPending || analyzeNoteMutation.isPending || noteTranscribeMutation.isPending;

  if (sampleQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (sampleQuery.isError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load sample data</AlertTitle>
          <AlertDescription>
            Unable to load encounter data. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Clinical Documentation Automation
            </h1>
            <p className="text-muted-foreground">
              AI-powered encounter note synthesis and EHR auto-population
            </p>
          </div>
        </div>
        <AIAssistantToggleButton onClick={() => setAiAssistantOpen(true)} />
      </div>

      <Alert className="mb-6">
        <Sparkles className="h-4 w-4" />
        <AlertTitle>AI Documentation Assistant</AlertTitle>
        <AlertDescription>
          This tool helps synthesize encounter notes from audio or structured data and auto-populates EHR fields. 
          All AI-generated content requires physician review and approval before becoming part of the medical record. 
          This is NOT clinical decision support - it assists with documentation only.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="note-creator" data-testid="tab-note-creator">
            <Stethoscope className="h-4 w-4 mr-2" />
            AI Note Creator
          </TabsTrigger>
          <TabsTrigger value="input" data-testid="tab-input">
            <Edit3 className="h-4 w-4 mr-2" />
            Input
          </TabsTrigger>
          <TabsTrigger value="synthesized" data-testid="tab-synthesized" disabled={!synthesizedNote}>
            <FileCheck className="h-4 w-4 mr-2" />
            Note
          </TabsTrigger>
          <TabsTrigger value="ehr" data-testid="tab-ehr" disabled={!extractedFields}>
            <ClipboardList className="h-4 w-4 mr-2" />
            EHR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="note-creator" className="space-y-6" data-testid="tab-content-note-creator">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    Clinical Note Input
                  </CardTitle>
                  <CardDescription>Type or dictate your clinical note. AI will automatically categorize it into SOAP sections, extract entities, and suggest codes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      variant={noteCreatorMode === "type" ? "default" : "outline"}
                      onClick={() => setNoteCreatorMode("type")}
                      className="flex-1"
                      data-testid="button-note-mode-type"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Type Note
                    </Button>
                    <Button
                      variant={noteCreatorMode === "dictate" ? "default" : "outline"}
                      onClick={() => setNoteCreatorMode("dictate")}
                      className="flex-1"
                      data-testid="button-note-mode-dictate"
                    >
                      <Mic className="h-4 w-4 mr-2" />
                      Dictate
                    </Button>
                  </div>

                  <Separator />

                  {noteCreatorMode === "dictate" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-4 py-6 border-2 border-dashed rounded-lg">
                        {!noteAudioBlob ? (
                          <Button
                            size="lg"
                            variant={isNoteRecording ? "destructive" : "default"}
                            onClick={isNoteRecording ? stopNoteRecording : startNoteRecording}
                            disabled={noteTranscribeMutation.isPending}
                            data-testid="button-note-record"
                          >
                            {isNoteRecording ? (
                              <>
                                <Square className="h-5 w-5 mr-2" />
                                Stop Recording
                              </>
                            ) : (
                              <>
                                <Mic className="h-5 w-5 mr-2" />
                                Start Dictation
                              </>
                            )}
                          </Button>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <Badge variant="secondary" className="px-4 py-2">
                              <Check className="h-4 w-4 mr-2" />
                              Dictation recorded
                            </Badge>
                            <div className="flex gap-2">
                              <Button variant="outline" onClick={() => { setNoteAudioBlob(null); setNoteTranscript(""); }} data-testid="button-note-rerecord">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Re-record
                              </Button>
                              <Button onClick={transcribeNoteAudio} disabled={noteTranscribeMutation.isPending} data-testid="button-note-transcribe">
                                {noteTranscribeMutation.isPending ? (
                                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Transcribing...</>
                                ) : (
                                  <><Play className="h-4 w-4 mr-2" />Transcribe</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      {noteTranscript && (
                        <Alert>
                          <Check className="h-4 w-4" />
                          <AlertDescription className="text-sm">Dictation transcribed. Edit below if needed, then click "Analyze Note".</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <Textarea
                    value={noteCreatorText}
                    onChange={(e) => setNoteCreatorText(e.target.value)}
                    rows={noteCreatorMode === "dictate" ? 8 : 14}
                    placeholder={noteCreatorMode === "dictate"
                      ? "Your transcribed dictation will appear here. You can also type or edit directly..."
                      : "Type your clinical note here...\n\nExample: Patient is a 55-year-old male presenting with a 2-week history of progressive shortness of breath and chest tightness on exertion. Reports fatigue and occasional dizziness. BP 148/92, HR 88, SpO2 94% on room air. Lungs with bilateral basilar crackles. Assessment: Suspected CHF exacerbation with uncontrolled hypertension. Plan: Order BNP, chest X-ray, echocardiogram. Start furosemide 40mg daily. Cardiology referral."}
                    data-testid="textarea-note-creator"
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {noteCreatorText.length > 0 ? `${noteCreatorText.length} characters` : "Minimum 10 characters required"}
                    </p>
                    <div className="flex gap-2">
                      {noteCreatorText.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setNoteCreatorText(""); setNoteAnalysis(null); setNoteTranscript(""); setNoteAudioBlob(null); }}
                          data-testid="button-note-clear"
                        >
                          Clear
                        </Button>
                      )}
                      <Button
                        onClick={handleAnalyzeNote}
                        disabled={analyzeNoteMutation.isPending || noteCreatorText.trim().length < 10}
                        data-testid="button-analyze-note"
                      >
                        {analyzeNoteMutation.isPending ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>
                        ) : (
                          <><Sparkles className="h-4 w-4 mr-2" />Analyze Note</>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {noteAnalysis && noteAnalysis.codeSuggestions && noteAnalysis.codeSuggestions.length > 0 && (
                <Card data-testid="card-code-suggestions">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      ICD-10 / CPT Code Suggestions
                    </CardTitle>
                    <CardDescription className="text-xs">For billing reference only — requires certified coder review</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-left font-medium">Code</th>
                            <th className="px-4 py-2 text-left font-medium">Description</th>
                            <th className="px-4 py-2 text-left font-medium">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {noteAnalysis.codeSuggestions.map((code, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-code-${i}`}>
                              <td className="px-4 py-2">
                                <Badge variant={code.type === "ICD-10" ? "default" : "secondary"} className="text-xs">{code.type}</Badge>
                              </td>
                              <td className="px-4 py-2 font-mono text-xs font-bold">{code.code}</td>
                              <td className="px-4 py-2">
                                <div>
                                  <p className="font-medium">{code.description}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{code.rationale}</p>
                                </div>
                              </td>
                              <td className="px-4 py-2">{getCodeConfidenceBadge(code.confidence)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {analyzeNoteMutation.isPending && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-medium">Analyzing clinical note...</p>
                      <p className="text-sm text-muted-foreground mt-1">Categorizing into SOAP sections, extracting entities, and suggesting codes</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {noteAnalysis && !analyzeNoteMutation.isPending && (
                <>
                  {noteAnalysis.fallback && (
                    <Alert variant="destructive" className="bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Fallback Analysis</AlertTitle>
                      <AlertDescription className="text-sm">AI service unavailable. Basic keyword-based extraction was used. Results may be limited.</AlertDescription>
                    </Alert>
                  )}

                  <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <ShieldAlert className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800 dark:text-yellow-200">Physician Review Required</AlertTitle>
                    <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-xs">
                      {noteAnalysis.disclaimer}
                    </AlertDescription>
                  </Alert>

                  {noteAnalysis.noteSummary && (
                    <Card data-testid="card-note-summary">
                      <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">Encounter Summary</CardTitle>
                          {noteAnalysis.completenessScore !== undefined && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Percent className="h-3 w-3" />
                              {Math.round(noteAnalysis.completenessScore * 100)}% complete
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{noteAnalysis.noteSummary}</p>
                        {noteAnalysis.missingElements && noteAnalysis.missingElements.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-orange-600 mb-1">Missing elements:</p>
                            <div className="flex flex-wrap gap-1">
                              {noteAnalysis.missingElements.map((el, i) => (
                                <Badge key={i} variant="outline" className="text-xs border-orange-300 text-orange-600">{el}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card data-testid="card-soap-sections">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        SOAP Sections
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {(["subjective", "objective", "assessment", "plan"] as const).map((key) => {
                        const labels: Record<string, { label: string; icon: typeof FileText }> = {
                          subjective: { label: "Subjective", icon: FileText },
                          objective: { label: "Objective", icon: Activity },
                          assessment: { label: "Assessment", icon: ClipboardList },
                          plan: { label: "Plan", icon: Calendar },
                        };
                        const { label, icon: Icon } = labels[key];
                        const content = noteAnalysis.soap?.[key] || "";
                        const isExpanded = expandedSoapSections[key];
                        return (
                          <div key={key} className="border rounded-lg overflow-hidden" data-testid={`soap-section-${key}`}>
                            <button
                              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                              onClick={() => toggleSoapSection(key)}
                              data-testid={`button-toggle-soap-${key}`}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" />
                                <span className="font-medium text-sm">{label}</span>
                                {content && <Badge variant="outline" className="text-xs">{content.split(/\s+/).length} words</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); copyNoteSection(content, label); }}
                                  data-testid={`button-copy-soap-${key}`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </button>
                            {isExpanded && content && (
                              <div className="px-4 pb-3 border-t bg-muted/20">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2">{content}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-extracted-entities">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        Extracted Entities
                        <Badge variant="secondary" className="text-xs">{getEntityCount(noteAnalysis.entities)} found</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      {noteAnalysis.entities?.diagnoses?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-diagnoses">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("diagnoses")}>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500" />
                              <span className="text-sm font-medium">Diagnoses</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.diagnoses.length}</Badge>
                            </div>
                            {expandedEntityGroups.diagnoses ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.diagnoses && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.diagnoses.map((d, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span>{d.name}</span>
                                    <Badge variant={d.status === "active" ? "default" : d.status === "suspected" ? "secondary" : "outline"} className="text-xs">{d.status}</Badge>
                                  </div>
                                  {getCodeConfidenceBadge(d.confidence)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {noteAnalysis.entities?.medications?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-medications">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("medications")}>
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Medications</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.medications.length}</Badge>
                            </div>
                            {expandedEntityGroups.medications ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.medications && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.medications.map((m, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <div>
                                    <span className="font-medium">{m.name}</span>
                                    {m.dosage && <span className="text-muted-foreground ml-1">{m.dosage}</span>}
                                    {m.frequency && <span className="text-muted-foreground ml-1">({m.frequency})</span>}
                                  </div>
                                  <Badge variant={m.action === "new" ? "default" : m.action === "discontinued" ? "destructive" : "outline"} className="text-xs">{m.action}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {noteAnalysis.entities?.procedures?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-procedures">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("procedures")}>
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium">Procedures</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.procedures.length}</Badge>
                            </div>
                            {expandedEntityGroups.procedures ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.procedures && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.procedures.map((p, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <span>{p.name}</span>
                                  <Badge variant="outline" className="text-xs">{p.status}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {noteAnalysis.entities?.allergies?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-allergies">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("allergies")}>
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-orange-500" />
                              <span className="text-sm font-medium">Allergies</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.allergies.length}</Badge>
                            </div>
                            {expandedEntityGroups.allergies ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.allergies && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.allergies.map((a, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <div>
                                    <span className="font-medium">{a.substance}</span>
                                    {a.reaction && <span className="text-muted-foreground ml-1">— {a.reaction}</span>}
                                  </div>
                                  <Badge variant={a.severity === "severe" ? "destructive" : a.severity === "moderate" ? "secondary" : "outline"} className="text-xs">{a.severity}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {noteAnalysis.entities?.labOrders?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-labs">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("labOrders")}>
                            <div className="flex items-center gap-2">
                              <FlaskConical className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">Lab Orders/Results</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.labOrders.length}</Badge>
                            </div>
                            {expandedEntityGroups.labOrders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.labOrders && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.labOrders.map((l, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <div>
                                    <span className="font-medium">{l.name}</span>
                                    {l.value && <span className="text-muted-foreground ml-1">: {l.value}</span>}
                                  </div>
                                  <div className="flex gap-1">
                                    <Badge variant="outline" className="text-xs">{l.status}</Badge>
                                    {l.flag && l.flag !== "normal" && <Badge variant="destructive" className="text-xs">{l.flag}</Badge>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {noteAnalysis.entities?.symptoms?.length > 0 && (
                        <div className="border rounded-lg overflow-hidden" data-testid="entity-group-symptoms">
                          <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors text-left" onClick={() => toggleEntityGroup("symptoms")}>
                            <div className="flex items-center gap-2">
                              <Activity className="h-4 w-4 text-red-400" />
                              <span className="text-sm font-medium">Symptoms</span>
                              <Badge variant="outline" className="text-xs">{noteAnalysis.entities.symptoms.length}</Badge>
                            </div>
                            {expandedEntityGroups.symptoms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                          {expandedEntityGroups.symptoms && (
                            <div className="px-4 pb-3 border-t space-y-1.5">
                              {noteAnalysis.entities.symptoms.map((s, i) => (
                                <div key={i} className="flex items-center justify-between py-1 text-sm">
                                  <span>{s.name}</span>
                                  <div className="flex gap-1">
                                    {s.duration && <Badge variant="outline" className="text-xs">{s.duration}</Badge>}
                                    {s.severity && <Badge variant="secondary" className="text-xs">{s.severity}</Badge>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {getEntityCount(noteAnalysis.entities) === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No clinical entities were extracted from the note.</p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}

              {!noteAnalysis && !analyzeNoteMutation.isPending && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <Sparkles className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="font-medium text-muted-foreground">AI Analysis Results</p>
                      <p className="text-sm text-muted-foreground/80 mt-1">Type or dictate a clinical note, then click "Analyze Note" to see SOAP categorization, extracted entities, and code suggestions.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="input" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Input Method</CardTitle>
                <CardDescription>Choose how to provide encounter information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={inputMode === "audio" ? "default" : "outline"}
                    onClick={() => setInputMode("audio")}
                    className="flex-1"
                    data-testid="button-mode-audio"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Audio Recording
                  </Button>
                  <Button
                    variant={inputMode === "structured" ? "default" : "outline"}
                    onClick={() => setInputMode("structured")}
                    className="flex-1"
                    data-testid="button-mode-structured"
                  >
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Structured Data
                  </Button>
                  <Button
                    variant={inputMode === "text" ? "default" : "outline"}
                    onClick={() => setInputMode("text")}
                    className="flex-1"
                    data-testid="button-mode-text"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Free Text
                  </Button>
                </div>

                <Separator />

                {inputMode === "audio" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4 py-8 border-2 border-dashed rounded-lg">
                      {!audioBlob ? (
                        <Button
                          size="lg"
                          variant={isRecording ? "destructive" : "default"}
                          onClick={isRecording ? stopRecording : startRecording}
                          disabled={transcribeMutation.isPending}
                          data-testid="button-record"
                        >
                          {isRecording ? (
                            <>
                              <Square className="h-5 w-5 mr-2" />
                              Stop Recording
                            </>
                          ) : (
                            <>
                              <Mic className="h-5 w-5 mr-2" />
                              Start Recording
                            </>
                          )}
                        </Button>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Badge variant="secondary" className="px-4 py-2">
                            <Check className="h-4 w-4 mr-2" />
                            Audio recorded
                          </Badge>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              onClick={() => setAudioBlob(null)}
                              data-testid="button-clear-audio"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Re-record
                            </Button>
                            <Button
                              onClick={transcribeAudio}
                              disabled={transcribeMutation.isPending}
                              data-testid="button-transcribe"
                            >
                              {transcribeMutation.isPending ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Transcribing...
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Transcribe
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {transcriptionText && (
                      <div className="space-y-2">
                        <Label htmlFor="clinical-documentation-transcription-editable">Transcription (editable)</Label>
                        <Textarea id="clinical-documentation-transcription-editable"
                          value={transcriptionText}
                          onChange={(e) => setTranscriptionText(e.target.value)}
                          rows={8}
                          placeholder="Transcribed text will appear here..."
                          data-testid="textarea-transcription"
                        />
                      </div>
                    )}
                  </div>
                )}

                {inputMode === "structured" && sampleEncounter && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Note: Using pre-populated encounter data. In production, this would integrate with your EHR system.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground">Patient</FieldCaption>
                        <p className="font-medium">{sampleEncounter.patientName}</p>
                      </div>
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground">DOB</FieldCaption>
                        <p className="font-medium">{sampleEncounter.dateOfBirth}</p>
                      </div>
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground">Visit Date</FieldCaption>
                        <p className="font-medium">{sampleEncounter.visitDate}</p>
                      </div>
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground">Visit Type</FieldCaption>
                        <p className="font-medium">{sampleEncounter.visitType}</p>
                      </div>
                    </div>

                    <div>
                      <FieldCaption className="text-xs text-muted-foreground">Chief Complaint</FieldCaption>
                      <p className="font-medium">{sampleEncounter.chiefComplaint}</p>
                    </div>

                    {sampleEncounter.vitalSigns && (
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Vital Signs
                        </FieldCaption>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline">BP: {sampleEncounter.vitalSigns.bloodPressure}</Badge>
                          <Badge variant="outline">HR: {sampleEncounter.vitalSigns.heartRate}</Badge>
                          <Badge variant="outline">Temp: {sampleEncounter.vitalSigns.temperature}</Badge>
                          <Badge variant="outline">SpO2: {sampleEncounter.vitalSigns.oxygenSaturation}</Badge>
                        </div>
                      </div>
                    )}

                    {sampleEncounter.medications && sampleEncounter.medications.length > 0 && (
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Current Medications
                        </FieldCaption>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sampleEncounter.medications.map((med, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{med}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {sampleEncounter.allergies && sampleEncounter.allergies.length > 0 && (
                      <div>
                        <FieldCaption className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Allergies
                        </FieldCaption>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {sampleEncounter.allergies.map((allergy, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">{allergy}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {inputMode === "text" && (
                  <div className="space-y-2">
                    <Label htmlFor="clinical-documentation-free-text-notes">Free Text Notes</Label>
                    <Textarea id="clinical-documentation-free-text-notes"
                      value={freeTextInput}
                      onChange={(e) => setFreeTextInput(e.target.value)}
                      rows={12}
                      placeholder="Enter clinical notes, consultation summary, or any text describing the patient encounter..."
                      data-testid="textarea-freetext"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">EHR Template</CardTitle>
                <CardDescription>Select the target documentation format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {templates.find(t => t.id === selectedTemplate) && (
                  <div className="space-y-2">
                    <FieldCaption className="text-xs text-muted-foreground">Template Sections</FieldCaption>
                    <div className="flex flex-wrap gap-1">
                      {templates.find(t => t.id === selectedTemplate)?.sections.map((section, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{section}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <Button
                  onClick={handleSynthesize}
                  disabled={isProcessing || (inputMode === "audio" && !transcriptionText) || (inputMode === "text" && !freeTextInput)}
                  className="w-full"
                  size="lg"
                  data-testid="button-synthesize"
                >
                  {synthesizeMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Synthesizing Note...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Synthesize Encounter Note
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  AI will analyze the input and generate structured documentation sections
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="synthesized" className="space-y-6">
          {synthesizedNote && (
            <>
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Physician Review Required</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  {synthesizedNote.disclaimer}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Synthesized Note Sections
                    </h2>
                    <Button
                      onClick={handleExtractToEHR}
                      disabled={extractMutation.isPending}
                      data-testid="button-extract-ehr"
                    >
                      {extractMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <ClipboardList className="h-4 w-4 mr-2" />
                          Auto-Populate EHR
                        </>
                      )}
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-3 pr-4">
                      {synthesizedNote.sections.map((section, index) => (
                        <SectionCard
                          key={index}
                          section={section}
                          onCopy={copyToClipboard}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">Encounter Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{synthesizedNote.encounterSummary}</p>
                    </CardContent>
                  </Card>

                  {synthesizedNote.extractedDiagnoses.length > 0 && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium">Identified Diagnoses</CardTitle>
                        <CardDescription className="text-xs">For billing reference only</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {synthesizedNote.extractedDiagnoses.map((diagnosis, i) => (
                          <div key={i} className="flex items-start justify-between gap-2 p-2 bg-muted/50 rounded">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{diagnosis.description}</p>
                              {diagnosis.icdSuggestion && (
                                <p className="text-xs text-muted-foreground">
                                  Suggested: {diagnosis.icdSuggestion}
                                </p>
                              )}
                            </div>
                            <ConfidenceBadge confidence={diagnosis.confidence} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {synthesizedNote.suggestedFollowUp && (
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Administrative Follow-Up
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{synthesizedNote.suggestedFollowUp}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ehr" className="space-y-6">
          {extractedFields && (
            <>
              <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">Review Before Saving</AlertTitle>
                <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  {extractedFields.disclaimer}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {extractedFields.templateType} Template Fields
                    </h2>
                    <Button data-testid="button-save-ehr">
                      <Check className="h-4 w-4 mr-2" />
                      Save to EHR
                    </Button>
                  </div>

                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="space-y-4 pr-4">
                      {Object.entries(extractedFields.fields).map(([key, field]) => (
                        <Card 
                          key={key} 
                          className={field.needsReview ? "border-yellow-500/50" : ""}
                        >
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-sm font-medium capitalize">
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </CardTitle>
                                <ConfidenceBadge confidence={field.confidence} />
                                {field.needsReview && (
                                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Review
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => copyToClipboard(field.value)}
                                data-testid={`button-copy-field-${key}`}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="py-2 px-4">
                            <Textarea
                              defaultValue={field.value}
                              rows={3}
                              className="text-sm"
                              data-testid={`textarea-field-${key}`}
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="space-y-4">
                  {extractedFields.missingFields.length > 0 && (
                    <Card className="border-orange-500/50">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Missing Fields
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {extractedFields.missingFields.map((field, i) => (
                            <li key={i} className="capitalize">
                              {field.replace(/([A-Z])/g, " $1").trim()}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {extractedFields.warnings.length > 0 && (
                    <Card className="border-yellow-500/50">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Warnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {extractedFields.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <AIProviderAssistantPanel
        patientId="1"
        patientName={sampleEncounter?.patientName || "Patient"}
        activeTab={activeTab}
        isOpen={aiAssistantOpen}
        onToggle={() => setAiAssistantOpen(!aiAssistantOpen)}
        patientData={{
          medications: sampleEncounter?.medications?.map((m, i) => ({
            id: `med-${i}`,
            name: m,
            dosage: "",
            frequency: "",
          })) || [],
          allergies: sampleEncounter?.allergies?.map((a, i) => ({
            id: `allergy-${i}`,
            substance: a,
            reaction: "Documented",
            severity: "unknown",
          })) || [],
          vitals: sampleEncounter?.vitalSigns ? [
            ...(sampleEncounter.vitalSigns.bloodPressure ? [{ id: "bp", type: "Blood Pressure", value: sampleEncounter.vitalSigns.bloodPressure, unit: "mmHg", date: sampleEncounter.visitDate || "", status: "normal" as const }] : []),
            ...(sampleEncounter.vitalSigns.heartRate ? [{ id: "hr", type: "Heart Rate", value: sampleEncounter.vitalSigns.heartRate, unit: "bpm", date: sampleEncounter.visitDate || "", status: "normal" as const }] : []),
            ...(sampleEncounter.vitalSigns.temperature ? [{ id: "temp", type: "Temperature", value: sampleEncounter.vitalSigns.temperature, unit: "°F", date: sampleEncounter.visitDate || "", status: "normal" as const }] : []),
          ] : [],
          conditions: sampleEncounter?.medicalHistory?.map((h, i) => ({
            id: `cond-${i}`,
            name: h,
            status: "active",
          })) || [],
        }}
      />
    </div>
  );
}
