import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  MessageSquare, Send, Loader2, Globe, ArrowRight, CheckCircle,
  User, Heart, Pill, AlertTriangle, Stethoscope, Brain, Activity,
  Eye, Ear, Wind, Bone, Droplets, Sparkles, Shield, ChevronRight,
  SkipForward, ClipboardList, FileText, Users, Coffee,
  BookOpen, Mic, Share2, MessageCircle, ChevronDown,
  Clock, Info, Database, Edit, Bell, ShieldAlert, Target,
  List, RefreshCw, Clipboard, HeartHandshake, Lightbulb,
  ChevronUp, PanelRightOpen, PanelRightClose, Plus, Trash2,
  Timer,
} from "lucide-react";

const API_BASE = "/api/patient-ai-onboarding";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
];

interface ChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
  step: string;
}

interface SessionProgress {
  sessionId: string;
  currentStep: string;
  completedSteps: string[];
  totalSteps: number;
  currentStepIndex: number;
  percentComplete: number;
  currentRosSystem: string | null;
  rosProgress: number;
  organSystemsTotal: number;
  organSystemsCurrent: number;
  status: string;
  language: string;
  languageName: string;
  hasPrepopulatedData: boolean;
  prepopulationConfirmed: boolean;
  collectedData: {
    demographics: boolean;
    conditions: number;
    medications: number;
    allergies: number;
    surgeries: number;
    familyHistory: number;
    socialHistory: boolean;
    reviewOfSystems: number;
  };
}

interface PlatformFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  learnMoreRoute: string;
}

interface QuickReply {
  id: string;
  label: string;
  value: string;
  type: "answer" | "action" | "skip";
}

interface ContextualTip {
  id: string;
  title: string;
  content: string;
  category: "info" | "privacy" | "help" | "feature";
  icon: string;
}

interface SamplePatient {
  id: string;
  firstName: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  dateOfBirth: string;
}

interface SessionContext {
  quickReplies: QuickReply[];
  tips: ContextualTip[];
  remainingMinutes: number;
  currentStep: string;
}

const ICON_MAP: Record<string, typeof MessageSquare> = {
  "file-text": FileText,
  "brain": Brain,
  "activity": Activity,
  "heart": Heart,
  "message-square": MessageCircle,
  "pill": Pill,
  "share-2": Share2,
  "mic": Mic,
};

const STEP_ICONS: Record<string, typeof MessageSquare> = {
  demographics: User,
  prepopulation_review: FileText,
  conditions: Heart,
  medications: Pill,
  allergies: AlertTriangle,
  surgeries: Stethoscope,
  family_history: Users,
  social_history: Coffee,
  ros_general: Activity,
  ros_heent: Eye,
  ros_cardiovascular: Heart,
  ros_respiratory: Wind,
  ros_gastrointestinal: Droplets,
  ros_genitourinary: Droplets,
  ros_musculoskeletal: Bone,
  ros_neurological: Brain,
  ros_psychiatric: Brain,
  ros_dermatological: Ear,
  ros_endocrine: Activity,
  ros_hematologic: Droplets,
  review_summary: ClipboardList,
};

const STEP_LABELS: Record<string, string> = {
  language_selection: "Language",
  demographics: "Basic Info",
  prepopulation_review: "Health Records Review",
  conditions: "Medical Conditions",
  medications: "Medications",
  allergies: "Allergies",
  surgeries: "Surgical History",
  family_history: "Family History",
  social_history: "Social History",
  ros_general: "General / Constitutional",
  ros_heent: "Head, Eyes, Ears, Nose, Throat",
  ros_cardiovascular: "Cardiovascular",
  ros_respiratory: "Respiratory",
  ros_gastrointestinal: "Gastrointestinal",
  ros_genitourinary: "Genitourinary",
  ros_musculoskeletal: "Musculoskeletal",
  ros_neurological: "Neurological",
  ros_psychiatric: "Psychiatric / Mental Health",
  ros_dermatological: "Dermatological / Skin",
  ros_endocrine: "Endocrine",
  ros_hematologic: "Hematologic / Lymphatic",
  review_summary: "Final Review",
  completed: "Complete",
};

const TIP_ICONS: Record<string, typeof Info> = {
  info: Info,
  shield: Shield,
  database: Database,
  edit: Edit,
  heart: Heart,
  sparkles: Sparkles,
  pill: Pill,
  bell: Bell,
  "alert-triangle": AlertTriangle,
  "shield-alert": ShieldAlert,
  stethoscope: Stethoscope,
  users: Users,
  list: List,
  "heart-handshake": HeartHandshake,
  target: Target,
  refresh: RefreshCw,
  clipboard: Clipboard,
  "message-circle": MessageCircle,
};

const FORM_STEPS = ["demographics", "medications", "allergies", "conditions"];

export default function AIPatientOnboarding() {
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedSamplePatient, setSelectedSamplePatient] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeView, setActiveView] = useState<"welcome" | "intake" | "complete">("welcome");
  const [showHelpPanel, setShowHelpPanel] = useState(true);
  const [showFormCard, setShowFormCard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const { data: featuresData } = useQuery<{ features: PlatformFeature[] }>({
    queryKey: [API_BASE, "features"],
  });

  const { data: samplePatients } = useQuery<{ patients: SamplePatient[] }>({
    queryKey: [API_BASE, "sample-patients"],
  });

  const { data: timeEstimates } = useQuery<{ steps: Array<{ step: string; label: string; estimatedMinutes: number; isROS: boolean }>; totalMinutes: number }>({
    queryKey: [API_BASE, "time-estimates"],
  });

  const { data: progressData } = useQuery<{ progress: SessionProgress }>({
    queryKey: [API_BASE, "sessions", sessionId, "progress"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/progress`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 5000,
  });
  const progress = progressData?.progress;

  const { data: contextData } = useQuery<SessionContext>({
    queryKey: [API_BASE, "sessions", sessionId, "context"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/context`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch context");
      return res.json();
    },
    enabled: !!sessionId && activeView === "intake",
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (progress?.status === "completed") {
      setActiveView("complete");
    }
  }, [progress?.status]);

  const createSessionMutation = useMutation({
    mutationFn: async (data: { language: string; languageName: string; patientId?: string }) => {
      const endpoint = data.patientId
        ? `${API_BASE}/sessions/with-patient`
        : `${API_BASE}/sessions`;
      const body = data.patientId
        ? { patientId: data.patientId, language: data.language, languageName: data.languageName }
        : { patientId: `patient_${Date.now()}`, language: data.language, languageName: data.languageName };
      const res = await apiRequest("POST", endpoint, body);
      return res.json();
    },
    onSuccess: (data: { session: { id: string; messages: ChatMessage[] } }) => {
      setSessionId(data.session.id);
      setMessages(data.session.messages || []);
      setActiveView("intake");
      toast({ title: "Welcome!", description: "Your health profile setup has begun. The AI assistant will guide you through each step." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start onboarding session.", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { message: string; advanceStep?: boolean }) => {
      const res = await apiRequest("POST", `${API_BASE}/sessions/${sessionId}/messages`, data);
      return res.json();
    },
    onSuccess: (data: { message: ChatMessage; currentStep: string; completedSteps: string[] }) => {
      setMessages(prev => [...prev, data.message]);
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: [API_BASE, "sessions", sessionId, "progress"] });
      queryClient.invalidateQueries({ queryKey: [API_BASE, "sessions", sessionId, "context"] });
      inputRef.current?.focus();
    },
    onError: () => {
      setIsTyping(false);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    },
  });

  const advanceStepMutation = useMutation({
    mutationFn: async (userMessage?: string) => {
      const res = await apiRequest("POST", `${API_BASE}/sessions/${sessionId}/advance`);
      return { result: await res.json(), userMessage };
    },
    onSuccess: ({ userMessage }) => {
      queryClient.invalidateQueries({ queryKey: [API_BASE, "sessions", sessionId, "progress"] });
      queryClient.invalidateQueries({ queryKey: [API_BASE, "sessions", sessionId, "context"] });
      const msg = userMessage || (progress?.language === "en"
        ? "I'm ready to continue to the next section."
        : `[Continue to next section]`);
      sendMessageMutation.mutate({
        message: msg,
        advanceStep: false,
      });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async (data: { section: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `${API_BASE}/sessions/${sessionId}/section`, data);
      return { result: await res.json(), section: data.section };
    },
    onSuccess: ({ section }) => {
      queryClient.invalidateQueries({ queryKey: [API_BASE, "sessions", sessionId, "progress"] });
      const sectionLabel = STEP_LABELS[section] || section;
      const systemMsg: ChatMessage = {
        id: `form_${Date.now()}`,
        role: "system",
        content: `[Form submission] ${sectionLabel} information has been saved via the quick form.`,
        timestamp: new Date().toISOString(),
        step: progress?.currentStep || section,
      };
      setMessages(prev => [...prev, systemMsg]);
      toast({ title: "Saved", description: "Your information has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save information.", variant: "destructive" });
    },
  });

  const handleStartOnboarding = () => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);
    if (!lang) return;
    createSessionMutation.mutate({
      language: lang.code,
      languageName: lang.name,
      patientId: selectedSamplePatient || undefined,
    });
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !sessionId || isTyping) return;
    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
      step: progress?.currentStep || "demographics",
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setInputValue("");
    sendMessageMutation.mutate({ message: inputValue.trim() });
  };

  const handleQuickReply = (reply: QuickReply) => {
    if (!sessionId || isTyping) return;
    const userMsg: ChatMessage = {
      id: `local_${Date.now()}`,
      role: "user",
      content: reply.value,
      timestamp: new Date().toISOString(),
      step: progress?.currentStep || "demographics",
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    if (reply.type === "skip") {
      advanceStepMutation.mutate(reply.value);
    } else {
      sendMessageMutation.mutate({ message: reply.value });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (activeView === "welcome" && !sessionId) {
    return <WelcomeScreen
      selectedLanguage={selectedLanguage}
      setSelectedLanguage={setSelectedLanguage}
      selectedSamplePatient={selectedSamplePatient}
      setSelectedSamplePatient={setSelectedSamplePatient}
      onStart={handleStartOnboarding}
      isLoading={createSessionMutation.isPending}
      features={featuresData?.features || []}
      samplePatients={samplePatients?.patients || []}
      timeEstimates={timeEstimates}
    />;
  }

  if (activeView === "complete" && progress?.status === "completed") {
    return <CompletionScreen progress={progress} />;
  }

  const currentStepLabel = STEP_LABELS[progress?.currentStep || ""] || progress?.currentStep || "";
  const StepIcon = STEP_ICONS[progress?.currentStep || ""] || MessageSquare;
  const canShowForm = FORM_STEPS.includes(progress?.currentStep || "");

  return (
    <div className="flex flex-col h-full" data-testid="ai-onboarding-page">
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold" data-testid="page-title">AI Health Profile Setup</h1>
              <p className="text-sm text-muted-foreground">
                {progress?.languageName || "English"} &middot; Step {(progress?.currentStepIndex ?? 0) + 1} of {progress?.totalSteps ?? 22}
                {contextData?.remainingMinutes !== undefined && (
                  <span className="ml-2">
                    &middot; <Timer className="h-3 w-3 inline" /> ~{contextData.remainingMinutes} min remaining
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="badge-current-step">
              <StepIcon className="h-3 w-3 mr-1" />
              {currentStepLabel}
            </Badge>
            {canShowForm && (
              <Button
                variant={showFormCard ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFormCard(!showFormCard)}
                data-testid="button-toggle-form"
              >
                <Edit className="h-4 w-4 mr-1" />
                {showFormCard ? "Hide Form" : "Quick Form"}
              </Button>
            )}
            <Button
              variant={showHelpPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHelpPanel(!showHelpPanel)}
              data-testid="button-toggle-help"
            >
              {showHelpPanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
            {progress?.currentStep !== "review_summary" && progress?.currentStep !== "completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => advanceStepMutation.mutate()}
                disabled={advanceStepMutation.isPending}
                data-testid="button-skip-section"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Next Section
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Overall Progress</span>
            <span className="text-xs font-medium">{progress?.percentComplete ?? 0}%</span>
          </div>
          <Progress value={progress?.percentComplete ?? 0} className="h-2" data-testid="progress-overall" />
        </div>
        {progress?.currentRosSystem && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Review of Systems: {progress.currentRosSystem} ({progress.organSystemsCurrent}/{progress.organSystemsTotal})
              </span>
              <span className="text-xs font-medium">{progress.rosProgress}%</span>
            </div>
            <Progress value={progress.rosProgress} className="h-1.5" data-testid="progress-ros" />
          </div>
        )}
      </div>

      <Alert className="mx-4 mt-3 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="alert-no-advice">
        <Shield className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          This AI assistant collects health information only. It does not provide medical advice, diagnoses, or treatment recommendations. Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <div className="flex flex-1 overflow-hidden mt-2">
        <div className="hidden lg:block w-64 border-r p-3 overflow-y-auto">
          <StepsSidebar
            currentStep={progress?.currentStep || ""}
            completedSteps={progress?.completedSteps || []}
            collectedData={progress?.collectedData}
          />
        </div>

        <div className="flex-1 flex flex-col">
          {showFormCard && canShowForm && (
            <div className="border-b p-4 bg-muted/30">
              <InlineFormCard
                currentStep={progress?.currentStep || ""}
                onSave={(section, data) => updateSectionMutation.mutate({ section, data })}
                isSaving={updateSectionMutation.isPending}
              />
            </div>
          )}

          <ScrollArea className="flex-1 p-4">
            <div className="max-w-2xl mx-auto space-y-4 pb-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isTyping && (
                <div className="flex items-start gap-3" data-testid="typing-indicator">
                  <div className="p-2 rounded-full bg-primary/10 shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <Card className="max-w-[80%]">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {contextData?.quickReplies && contextData.quickReplies.length > 0 && !isTyping && (
            <div className="border-t px-4 py-2 bg-muted/30" data-testid="quick-replies-container">
              <div className="max-w-2xl mx-auto">
                <p className="text-xs text-muted-foreground mb-2">Quick responses:</p>
                <div className="flex flex-wrap gap-2">
                  {contextData.quickReplies.map((reply) => (
                    <Button
                      key={reply.id}
                      variant={reply.type === "skip" ? "ghost" : "outline"}
                      size="sm"
                      onClick={() => handleQuickReply(reply)}
                      className={`text-xs ${reply.type === "skip" ? "text-muted-foreground" : ""}`}
                      data-testid={`quick-reply-${reply.id}`}
                    >
                      {reply.type === "skip" && <SkipForward className="h-3 w-3 mr-1" />}
                      {reply.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="border-t p-4 bg-card">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                disabled={isTyping || progress?.status === "completed"}
                className="flex-1"
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping || progress?.status === "completed"}
                data-testid="button-send-message"
              >
                {isTyping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {showHelpPanel && (
          <div className="hidden xl:block w-72 border-l p-4 overflow-y-auto bg-muted/20" data-testid="help-panel">
            <ContextualHelpPanel
              tips={contextData?.tips || []}
              currentStep={progress?.currentStep || ""}
              remainingMinutes={contextData?.remainingMinutes}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeScreen({
  selectedLanguage,
  setSelectedLanguage,
  selectedSamplePatient,
  setSelectedSamplePatient,
  onStart,
  isLoading,
  features,
  samplePatients,
  timeEstimates,
}: {
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  selectedSamplePatient: string;
  setSelectedSamplePatient: (id: string) => void;
  onStart: () => void;
  isLoading: boolean;
  features: PlatformFeature[];
  samplePatients: SamplePatient[];
  timeEstimates?: { steps: Array<{ step: string; label: string; estimatedMinutes: number; isROS: boolean }>; totalMinutes: number };
}) {
  const [activeTab, setActiveTab] = useState("get-started");

  return (
    <div className="min-h-[80vh] p-4 md:p-8" data-testid="welcome-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-welcome-title">
            Welcome to Tabula Medica
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your AI-powered health companion. Let's set up your health profile and show you how Tabula Medica helps you take control of your health records.
          </p>
          {timeEstimates && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground" data-testid="text-time-estimate">
              <Clock className="h-4 w-4" />
              <span>Estimated time: <strong>{timeEstimates.totalMinutes} minutes</strong> ({timeEstimates.steps.length} steps)</span>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="get-started" data-testid="tab-get-started">
              <ArrowRight className="h-4 w-4 mr-2" />
              Get Started
            </TabsTrigger>
            <TabsTrigger value="explore" data-testid="tab-explore-features">
              <BookOpen className="h-4 w-4 mr-2" />
              Explore Features
            </TabsTrigger>
            <TabsTrigger value="steps-preview" data-testid="tab-steps-preview">
              <ClipboardList className="h-4 w-4 mr-2" />
              What to Expect
            </TabsTrigger>
          </TabsList>

          <TabsContent value="get-started" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <CardTitle className="text-lg">Choose Your Language</CardTitle>
                  </div>
                  <CardDescription>
                    Our AI assistant speaks your language. Select your preferred language to begin.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger data-testid="select-language">
                      <SelectValue placeholder="Choose a language..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code} data-testid={`option-language-${lang.code}`}>
                          <span className="flex items-center gap-2">
                            <span>{lang.nativeName}</span>
                            <span className="text-muted-foreground">({lang.name})</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">2</span>
                    </div>
                    <CardTitle className="text-lg">Load Existing Records</CardTitle>
                  </div>
                  <CardDescription>
                    Select an existing patient profile to pre-fill your health data, or start fresh.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedSamplePatient} onValueChange={setSelectedSamplePatient}>
                    <SelectTrigger data-testid="select-sample-patient">
                      <SelectValue placeholder="Start fresh or choose a patient..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" data-testid="option-patient-none">
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Start fresh (no existing records)
                        </span>
                      </SelectItem>
                      {samplePatients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id} data-testid={`option-patient-${patient.id}`}>
                          <span className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            {patient.firstName} ({patient.conditions.length} conditions, {patient.medications.length} meds)
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSamplePatient && selectedSamplePatient !== "none" && (
                    <PatientPreviewCard patient={samplePatients.find(p => p.id === selectedSamplePatient)} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                      <span className="text-sm font-bold text-purple-600 dark:text-purple-400">3</span>
                    </div>
                    <CardTitle className="text-lg">Begin Setup</CardTitle>
                  </div>
                  <CardDescription>
                    Your AI assistant will guide you conversationally through each step. You can skip sections or use quick-fill forms.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Conversational AI guidance</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Quick-reply suggestions</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Optional form-based entry</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Skip any section</span>
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={onStart}
                    disabled={!selectedLanguage || isLoading}
                    data-testid="button-start-onboarding"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        Start Health Profile Setup
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Alert className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <Shield className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                This tool collects health information only. It does not provide medical advice. Your data is encrypted and protected under HIPAA regulations. Always consult your healthcare provider for medical decisions.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="explore" className="mt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature) => {
                const FeatureIcon = ICON_MAP[feature.icon] || BookOpen;
                return (
                  <Card key={feature.id} className="flex flex-col" data-testid={`card-feature-${feature.id}`}>
                    <CardHeader className="pb-3">
                      <div className="p-2 rounded-md bg-primary/10 w-fit mb-2">
                        <FeatureIcon className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Badge variant="secondary" className="text-xs">
                        {feature.category === "ai" ? "AI-Powered" : feature.category === "communication" ? "Communication" : feature.category === "sharing" ? "Sharing" : "Core Feature"}
                      </Badge>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground mb-4">Ready to get started? Set up your health profile now.</p>
              <Button
                size="lg"
                onClick={() => setActiveTab("get-started")}
                data-testid="button-go-to-setup"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Setup
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="steps-preview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Your Onboarding Journey
                </CardTitle>
                <CardDescription>
                  Here's what we'll cover during your health profile setup. Each section takes just a few minutes, and you can skip any section you prefer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeEstimates ? (
                  <div className="space-y-1">
                    {timeEstimates.steps.map((step, index) => {
                      const Icon = STEP_ICONS[step.step] || ClipboardList;
                      return (
                        <div
                          key={step.step}
                          className={`flex items-center gap-3 p-2.5 rounded-lg ${step.isROS ? "pl-8 bg-muted/30" : "bg-muted/50"} transition-colors`}
                          data-testid={`step-preview-${step.step}`}
                        >
                          <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{step.label}</p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Clock className="h-3 w-3" />
                            ~{step.estimatedMinutes} min
                          </div>
                        </div>
                      );
                    })}
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between px-2 text-sm font-medium">
                      <span>Total Estimated Time</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        ~{timeEstimates.totalMinutes} minutes
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading step information...
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => setActiveTab("get-started")}
                  data-testid="button-ready-to-start"
                >
                  I'm Ready to Start
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PatientPreviewCard({ patient }: { patient?: SamplePatient }) {
  if (!patient) return null;

  return (
    <div className="rounded-lg border bg-muted/50 p-3 space-y-2" data-testid="patient-preview-card">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{patient.firstName}</span>
        <Badge variant="secondary" className="text-xs">Pre-filled</Badge>
      </div>
      <div className="space-y-1">
        {patient.conditions.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Heart className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{patient.conditions.join(", ")}</span>
          </div>
        )}
        {patient.medications.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Pill className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{patient.medications.length} medications on file</span>
          </div>
        )}
        {patient.allergies.length > 0 && patient.allergies[0] !== "No known drug allergies" && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{patient.allergies.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineFormCard({
  currentStep,
  onSave,
  isSaving,
}: {
  currentStep: string;
  onSave: (section: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [listItems, setListItems] = useState<Array<Record<string, string>>>([]);

  const handleSave = () => {
    if (currentStep === "demographics") {
      onSave("demographics", formData);
    } else if (currentStep === "medications") {
      onSave("medications", { medications: listItems.map(item => ({
        name: item.name || "",
        dosage: item.dosage || "",
        frequency: item.frequency || "",
        prescriber: item.prescriber || "",
        reason: item.reason || "",
      }))});
    } else if (currentStep === "allergies") {
      onSave("allergies", { allergies: listItems.map(item => ({
        allergen: item.allergen || "",
        reaction: item.reaction || "",
        severity: item.severity || "moderate",
      }))});
    } else if (currentStep === "conditions") {
      onSave("conditions", { conditions: listItems.map(item => ({
        name: item.name || "",
        diagnosisDate: item.diagnosisDate || "",
        status: item.status || "active",
        notes: item.notes || "",
      }))});
    }
  };

  if (currentStep === "demographics") {
    return (
      <Card data-testid="form-card-demographics">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Quick Form: Basic Information
          </CardTitle>
          <CardDescription className="text-xs">Fill in directly or continue chatting with the AI assistant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ai-patient-onboarding-first-name" className="text-xs">First Name</Label>
              <Input id="ai-patient-onboarding-first-name"
                placeholder="First name"
                value={formData.firstName || ""}
                onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="h-8 text-sm"
                data-testid="form-input-firstName"
              />
            </div>
            <div>
              <Label htmlFor="ai-patient-onboarding-last-name" className="text-xs">Last Name</Label>
              <Input id="ai-patient-onboarding-last-name"
                placeholder="Last name"
                value={formData.lastName || ""}
                onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="h-8 text-sm"
                data-testid="form-input-lastName"
              />
            </div>
            <div>
              <Label htmlFor="ai-patient-onboarding-date-of-birth" className="text-xs">Date of Birth</Label>
              <Input id="ai-patient-onboarding-date-of-birth"
                type="date"
                value={formData.dateOfBirth || ""}
                onChange={e => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                className="h-8 text-sm"
                data-testid="form-input-dateOfBirth"
              />
            </div>
            <div>
              <Label htmlFor="ai-patient-onboarding-phone" className="text-xs">Phone</Label>
              <Input id="ai-patient-onboarding-phone"
                placeholder="Phone number"
                value={formData.phone || ""}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="h-8 text-sm"
                data-testid="form-input-phone"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="ai-patient-onboarding-email" className="text-xs">Email</Label>
              <Input id="ai-patient-onboarding-email"
                type="email"
                placeholder="Email address"
                value={formData.email || ""}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="h-8 text-sm"
                data-testid="form-input-email"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save-demographics">
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
            Save Information
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (currentStep === "medications") {
    return (
      <Card data-testid="form-card-medications">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            Quick Form: Medications
          </CardTitle>
          <CardDescription className="text-xs">Add medications directly or continue chatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {listItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 items-end" data-testid={`form-medication-row-${idx}`}>
              <div>
                <FieldCaption className="text-xs">Medication</FieldCaption>
                <Input aria-label="Medication"
                  placeholder="Name"
                  value={item.name || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Dosage</FieldCaption>
                <Input aria-label="Dosage"
                  placeholder="e.g., 500mg"
                  value={item.dosage || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], dosage: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Frequency</FieldCaption>
                <Input aria-label="Frequency"
                  placeholder="e.g., twice daily"
                  value={item.frequency || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], frequency: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setListItems(items => items.filter((_, i) => i !== idx))}
                className="h-8"
                data-testid={`button-remove-medication-${idx}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setListItems(items => [...items, {}])}
            data-testid="button-add-medication"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Medication
          </Button>
        </CardContent>
        {listItems.length > 0 && (
          <CardFooter className="pt-0">
            <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save-medications">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Save {listItems.length} Medication{listItems.length !== 1 ? "s" : ""}
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  if (currentStep === "allergies") {
    return (
      <Card data-testid="form-card-allergies">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Quick Form: Allergies
          </CardTitle>
          <CardDescription className="text-xs">Add allergies directly or continue chatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {listItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 items-end" data-testid={`form-allergy-row-${idx}`}>
              <div>
                <FieldCaption className="text-xs">Allergen</FieldCaption>
                <Input aria-label="Allergen"
                  placeholder="e.g., Penicillin"
                  value={item.allergen || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], allergen: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Reaction</FieldCaption>
                <Input aria-label="Reaction"
                  placeholder="e.g., Rash, hives"
                  value={item.reaction || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], reaction: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Severity</FieldCaption>
                <Select
                  value={item.severity || "moderate"}
                  onValueChange={val => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], severity: val };
                    setListItems(updated);
                  }}
                >
                  <SelectTrigger aria-label="Severity" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setListItems(items => items.filter((_, i) => i !== idx))}
                className="h-8"
                data-testid={`button-remove-allergy-${idx}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setListItems(items => [...items, { severity: "moderate" }])}
            data-testid="button-add-allergy"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Allergy
          </Button>
        </CardContent>
        {listItems.length > 0 && (
          <CardFooter className="pt-0">
            <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save-allergies">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Save {listItems.length} Allerg{listItems.length !== 1 ? "ies" : "y"}
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  if (currentStep === "conditions") {
    return (
      <Card data-testid="form-card-conditions">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Quick Form: Medical Conditions
          </CardTitle>
          <CardDescription className="text-xs">Add conditions directly or continue chatting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {listItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-4 gap-2 items-end" data-testid={`form-condition-row-${idx}`}>
              <div>
                <FieldCaption className="text-xs">Condition</FieldCaption>
                <Input aria-label="Condition"
                  placeholder="e.g., Hypertension"
                  value={item.name || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], name: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Diagnosis Date</FieldCaption>
                <Input aria-label="Diagnosis Date"
                  type="date"
                  value={item.diagnosisDate || ""}
                  onChange={e => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], diagnosisDate: e.target.value };
                    setListItems(updated);
                  }}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <FieldCaption className="text-xs">Status</FieldCaption>
                <Select
                  value={item.status || "active"}
                  onValueChange={val => {
                    const updated = [...listItems];
                    updated[idx] = { ...updated[idx], status: val };
                    setListItems(updated);
                  }}
                >
                  <SelectTrigger aria-label="Status" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="managed">Managed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setListItems(items => items.filter((_, i) => i !== idx))}
                className="h-8"
                data-testid={`button-remove-condition-${idx}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setListItems(items => [...items, { status: "active" }])}
            data-testid="button-add-condition"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Condition
          </Button>
        </CardContent>
        {listItems.length > 0 && (
          <CardFooter className="pt-0">
            <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="button-save-conditions">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Save {listItems.length} Condition{listItems.length !== 1 ? "s" : ""}
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  return null;
}

function ContextualHelpPanel({
  tips,
  currentStep,
  remainingMinutes,
}: {
  tips: ContextualTip[];
  currentStep: string;
  remainingMinutes?: number;
}) {
  const stepLabel = STEP_LABELS[currentStep] || currentStep;

  return (
    <div className="space-y-4" data-testid="contextual-help-content">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Help & Tips
        </h3>
        <p className="text-xs text-muted-foreground">
          Current section: <strong>{stepLabel}</strong>
        </p>
        {remainingMinutes !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3 inline mr-1" />
            ~{remainingMinutes} minutes remaining
          </p>
        )}
      </div>

      <Separator />

      {tips.length > 0 ? (
        <div className="space-y-3">
          {tips.map((tip) => {
            const TipIcon = TIP_ICONS[tip.icon] || Info;
            const bgColor = tip.category === "privacy" ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
              : tip.category === "feature" ? "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
              : tip.category === "help" ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
              : "bg-muted/50 border-border";
            const iconColor = tip.category === "privacy" ? "text-blue-600 dark:text-blue-400"
              : tip.category === "feature" ? "text-purple-600 dark:text-purple-400"
              : tip.category === "help" ? "text-green-600 dark:text-green-400"
              : "text-muted-foreground";

            return (
              <div key={tip.id} className={`rounded-lg border p-3 ${bgColor}`} data-testid={`tip-${tip.id}`}>
                <div className="flex items-start gap-2">
                  <TipIcon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                  <div>
                    <p className="text-xs font-medium">{tip.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tip.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center p-4">
          Tips will appear here as you progress through the onboarding steps.
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Need Help?</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageCircle className="h-3 w-3" />
            <span>Ask the AI assistant any question</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SkipForward className="h-3 w-3" />
            <span>Skip any section to come back later</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Edit className="h-3 w-3" />
            <span>Use Quick Form for direct data entry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionScreen({ progress }: { progress: SessionProgress }) {
  return (
    <div className="flex items-center justify-center min-h-[80vh] p-4" data-testid="completion-screen">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/30 w-fit mb-4">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-completion-title">Health Profile Complete!</CardTitle>
          <CardDescription className="text-base">
            Your health profile has been set up successfully. You can now explore all the features Tabula Medica has to offer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {progress.collectedData.demographics && (
              <StatCard icon={User} label="Demographics" value="Completed" />
            )}
            {progress.collectedData.conditions > 0 && (
              <StatCard icon={Heart} label="Conditions" value={`${progress.collectedData.conditions} recorded`} />
            )}
            {progress.collectedData.medications > 0 && (
              <StatCard icon={Pill} label="Medications" value={`${progress.collectedData.medications} recorded`} />
            )}
            {progress.collectedData.allergies > 0 && (
              <StatCard icon={AlertTriangle} label="Allergies" value={`${progress.collectedData.allergies} recorded`} />
            )}
            {progress.collectedData.surgeries > 0 && (
              <StatCard icon={Stethoscope} label="Surgeries" value={`${progress.collectedData.surgeries} recorded`} />
            )}
            {progress.collectedData.familyHistory > 0 && (
              <StatCard icon={Users} label="Family History" value={`${progress.collectedData.familyHistory} recorded`} />
            )}
            {progress.collectedData.socialHistory && (
              <StatCard icon={Coffee} label="Social History" value="Completed" />
            )}
            {progress.collectedData.reviewOfSystems > 0 && (
              <StatCard icon={Activity} label="Systems Reviewed" value={`${progress.collectedData.reviewOfSystems}/12`} />
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-medium">What's Next?</h3>
            <div className="space-y-2 text-left">
              {[
                { label: "View your health records", desc: "See all your medical data in one place", icon: FileText },
                { label: "Connect your providers", desc: "Link your healthcare provider accounts via Fasten Health", icon: Database },
                { label: "Explore AI features", desc: "Get explanations for medical terms and results", icon: Sparkles },
                { label: "View your health snapshot", desc: "See a simplified summary of your health data", icon: Heart },
              ].map(({ label, desc, icon: Icon }) => (
                <div key={label} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                  <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border bg-card text-left" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center" data-testid={`message-system-${message.id}`}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/60 border text-xs text-muted-foreground">
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}
      data-testid={`message-${message.role}-${message.id}`}
    >
      <div className={`p-2 rounded-full shrink-0 ${isAssistant ? "bg-primary/10" : "bg-muted"}`}>
        {isAssistant ? (
          <Sparkles className="h-4 w-4 text-primary" />
        ) : (
          <User className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <Card className={`max-w-[80%] ${isAssistant ? "" : "bg-primary text-primary-foreground"}`}>
        <CardContent className="p-3">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <span className={`text-[10px] mt-1 block ${isAssistant ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function StepsSidebar({
  currentStep,
  completedSteps,
  collectedData,
}: {
  currentStep: string;
  completedSteps: string[];
  collectedData?: SessionProgress["collectedData"];
}) {
  const allSteps = [
    { key: "language_selection", label: "Language" },
    { key: "demographics", label: "Basic Info" },
    { key: "prepopulation_review", label: "Records Review" },
    { key: "conditions", label: "Conditions" },
    { key: "medications", label: "Medications" },
    { key: "allergies", label: "Allergies" },
    { key: "surgeries", label: "Surgeries" },
    { key: "family_history", label: "Family History" },
    { key: "social_history", label: "Social History" },
    { key: "ros_general", label: "ROS: General", isRos: true },
    { key: "ros_heent", label: "ROS: HEENT", isRos: true },
    { key: "ros_cardiovascular", label: "ROS: Cardio", isRos: true },
    { key: "ros_respiratory", label: "ROS: Respiratory", isRos: true },
    { key: "ros_gastrointestinal", label: "ROS: GI", isRos: true },
    { key: "ros_genitourinary", label: "ROS: GU", isRos: true },
    { key: "ros_musculoskeletal", label: "ROS: MSK", isRos: true },
    { key: "ros_neurological", label: "ROS: Neuro", isRos: true },
    { key: "ros_psychiatric", label: "ROS: Psych", isRos: true },
    { key: "ros_dermatological", label: "ROS: Derm", isRos: true },
    { key: "ros_endocrine", label: "ROS: Endo", isRos: true },
    { key: "ros_hematologic", label: "ROS: Heme", isRos: true },
    { key: "review_summary", label: "Final Review" },
  ];

  return (
    <div className="space-y-1" data-testid="steps-sidebar">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Progress</h3>
      {collectedData && (
        <div className="mb-3 space-y-1 text-xs text-muted-foreground">
          {collectedData.conditions > 0 && <div>{collectedData.conditions} conditions</div>}
          {collectedData.medications > 0 && <div>{collectedData.medications} medications</div>}
          {collectedData.allergies > 0 && <div>{collectedData.allergies} allergies</div>}
          {collectedData.surgeries > 0 && <div>{collectedData.surgeries} surgeries</div>}
          {collectedData.familyHistory > 0 && <div>{collectedData.familyHistory} family history</div>}
          {collectedData.reviewOfSystems > 0 && <div>{collectedData.reviewOfSystems}/12 organ systems</div>}
        </div>
      )}
      <Separator className="my-2" />
      {allSteps.map(({ key, label, isRos }) => {
        const isCompleted = completedSteps.includes(key);
        const isCurrent = currentStep === key;
        const Icon = STEP_ICONS[key] || MessageSquare;

        return (
          <div
            key={key}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              isCurrent ? "bg-primary/10 text-primary font-medium" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50"
            } ${isRos ? "pl-4" : ""}`}
            data-testid={`step-indicator-${key}`}
          >
            {isCompleted ? (
              <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
            ) : isCurrent ? (
              <ChevronRight className="h-3 w-3 text-primary shrink-0" />
            ) : (
              <Icon className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
