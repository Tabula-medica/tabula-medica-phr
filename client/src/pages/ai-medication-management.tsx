import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Brain,
  Pill,
  AlertTriangle,
  Bell,
  BookOpen,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Shield,
  CheckCircle,
  Clock,
  Target,
  Lightbulb,
  Heart,
  Zap,
  Activity,
  AlertCircle,
  ChevronRight,
  Loader2,
  Sparkles,
  Mic,
  MessageSquare,
  Send,
  Package,
  Phone,
  Mail,
  ThumbsUp,
  ThumbsDown,
  SkipForward,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdherencePrediction {
  patientId: string;
  medicationId: string;
  medicationName: string;
  currentAdherenceRate: number;
  predictedAdherenceRate: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskFactors: string[];
  predictedIssues: string[];
  suggestedInterventions: string[];
  confidence: number;
  analysisDate: string;
}

interface PersonalizedReminder {
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  personalizedMessage: string;
  educationalTip: string;
  motivationalNote: string;
}

interface DrugInteractionAlert {
  id: string;
  medications: { id: string; name: string; dosage: string }[];
  severity: "minor" | "moderate" | "major" | "contraindicated";
  interactionType: string;
  description: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendations: string[];
  alternativeOptions?: string[];
  monitoringRequired: string[];
  aiConfidence: number;
  detectedAt: string;
}

interface MedicationEducation {
  medicationId: string;
  medicationName: string;
  purpose: string;
  howItWorks: string;
  commonSideEffects: string[];
  importantWarnings: string[];
  bestPractices: string[];
  foodInteractions: string[];
  lifestyleTips: string[];
}

interface RefillReminder {
  medicationId: string;
  medicationName: string;
  dosage: string;
  refillsRemaining: number;
  daysUntilRefillNeeded: number;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  reminderMessage: string;
  refillInstructions: string;
  pharmacyInfo?: string;
  canRequestRefill: boolean;
  refillRequestOptions: RefillRequestOption[];
}

interface RefillRequestOption {
  id: string;
  method: "pharmacy_call" | "app_request" | "provider_message" | "mail_order";
  label: string;
  description: string;
  estimatedTime: string;
}

interface AdherencePatternAnalysis {
  patientId: string;
  analysisDate: string;
  overallAdherenceRate: number;
  patterns: AdherencePattern[];
  risks: AdherenceRisk[];
  insights: string[];
  recommendations: string[];
  trendDirection: "improving" | "stable" | "declining";
  confidence: number;
}

interface AdherencePattern {
  patternType: string;
  description: string;
  frequency: string;
  impact: "positive" | "neutral" | "negative";
  dataPoints: number;
}

interface AdherenceRisk {
  riskType: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedMedications: string[];
  mitigationStrategies: string[];
}

interface PersonalizedTips {
  sideEffectTips: SideEffectTip[];
  adherenceTips: AdherenceTip[];
}

interface SideEffectTip {
  sideEffect: string;
  severity: "mild" | "moderate" | "severe";
  managementTips: string[];
  whenToSeekHelp: string;
  lifestyleAdjustments: string[];
  relatedMedications: string[];
}

interface AdherenceTip {
  tipId: string;
  category: string;
  title: string;
  description: string;
  actionableSteps: string[];
  expectedBenefit: string;
  personalizedReason: string;
}

interface VoiceCommandResult {
  success: boolean;
  command: string;
  action: string;
  response: string;
  data?: any;
}

interface DashboardData {
  summary: {
    totalMedications: number;
    activeMedications: number;
    overallAdherence: number;
    activeReminders: number;
    pendingInteractions: number;
    criticalAlerts: number;
  };
  medications: any[];
  recentAdherence: any[];
  interactions: any[];
  reminders: any[];
}

function getRiskColor(risk: string): string {
  switch (risk) {
    case "critical":
    case "contraindicated":
      return "bg-red-500 text-white";
    case "high":
    case "major":
      return "bg-orange-500 text-white";
    case "moderate":
      return "bg-yellow-500 text-black";
    case "low":
    case "minor":
      return "bg-green-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getRiskIcon(risk: string) {
  switch (risk) {
    case "critical":
    case "contraindicated":
      return <AlertTriangle className="h-4 w-4" />;
    case "high":
    case "major":
      return <AlertCircle className="h-4 w-4" />;
    case "moderate":
      return <Activity className="h-4 w-4" />;
    default:
      return <CheckCircle className="h-4 w-4" />;
  }
}

export default function AIMedicationManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedMedication, setSelectedMedication] = useState<string | null>(null);
  const [educationDialogOpen, setEducationDialogOpen] = useState(false);
  
  const [predictions, setPredictions] = useState<AdherencePrediction[]>([]);
  const [reminders, setReminders] = useState<PersonalizedReminder[]>([]);
  const [interactions, setInteractions] = useState<DrugInteractionAlert[]>([]);
  const [education, setEducation] = useState<MedicationEducation | null>(null);
  
  // New state for enhanced features
  const [voiceCommand, setVoiceCommand] = useState("");
  const [sideEffectDescription, setSideEffectDescription] = useState("");
  const [commandResult, setCommandResult] = useState<VoiceCommandResult | null>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/ai-medication/dashboard"],
  });

  // Fetch refill reminders
  const { data: refillReminders, isLoading: refillsLoading, refetch: refetchRefills } = useQuery<RefillReminder[]>({
    queryKey: ["/api/ai-medication/refill-reminders"],
  });

  // Fetch adherence analysis
  const { data: adherenceAnalysis, isLoading: analysisLoading, refetch: refetchAnalysis } = useQuery<AdherencePatternAnalysis>({
    queryKey: ["/api/ai-medication/adherence-analysis"],
  });

  // Fetch personalized tips
  const { data: personalizedTips, isLoading: tipsLoading, refetch: refetchTips } = useQuery<PersonalizedTips>({
    queryKey: ["/api/ai-medication/personalized-tips"],
  });

  const predictAdherenceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-medication/predict-adherence", {});
      return response.json();
    },
    onSuccess: (data: AdherencePrediction[]) => {
      setPredictions(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-medication/dashboard"] });
      toast({ title: "Analysis Complete", description: "Adherence predictions have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze adherence.", variant: "destructive" });
    },
  });

  const generateRemindersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-medication/generate-reminders", {});
      return response.json();
    },
    onSuccess: (data: PersonalizedReminder[]) => {
      setReminders(data);
      toast({ title: "Reminders Generated", description: "Personalized reminders are ready." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate reminders.", variant: "destructive" });
    },
  });

  const analyzeInteractionsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-medication/analyze-interactions", {});
      return response.json();
    },
    onSuccess: (data: DrugInteractionAlert[]) => {
      setInteractions(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-medication/dashboard"] });
      toast({ title: "Analysis Complete", description: "Drug interactions have been analyzed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to analyze interactions.", variant: "destructive" });
    },
  });

  const getEducationMutation = useMutation({
    mutationFn: async (medicationId: string) => {
      const response = await fetch(`/api/ai-medication/education/${medicationId}`);
      if (!response.ok) throw new Error("Failed to fetch education");
      return response.json();
    },
    onSuccess: (data: MedicationEducation) => {
      setEducation(data);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to load medication information.", variant: "destructive" });
    },
  });

  // Request medication refill
  const requestRefillMutation = useMutation({
    mutationFn: async ({ medicationId, method }: { medicationId: string; method: string }) => {
      const response = await apiRequest("POST", "/api/ai-medication/request-refill", { medicationId, method });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Refill Requested", description: data.message });
      refetchRefills();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to request refill.", variant: "destructive" });
    },
  });

  // Process voice/text command
  const processCommandMutation = useMutation({
    mutationFn: async (command: string) => {
      const response = await apiRequest("POST", "/api/ai-medication/voice-command", { 
        command, 
        reportMethod: "text" 
      });
      return response.json();
    },
    onSuccess: (data: VoiceCommandResult) => {
      setCommandResult(data);
      setVoiceCommand("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai-medication/dashboard"] });
      if (data.success) {
        toast({ title: "Command Processed", description: data.response });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process command.", variant: "destructive" });
    },
  });

  // Report side effect
  const reportSideEffectMutation = useMutation({
    mutationFn: async (description: string) => {
      const response = await apiRequest("POST", "/api/ai-medication/report-side-effect", { 
        description, 
        reportMethod: "text" 
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSideEffectDescription("");
      toast({ 
        title: data.requiresProviderAttention ? "Side Effect Reported - Review Needed" : "Side Effect Reported", 
        description: data.aiAnalysis,
        variant: data.requiresProviderAttention ? "destructive" : "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-medication/personalized-tips"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to report side effect.", variant: "destructive" });
    },
  });

  // Log medication intake
  const logIntakeMutation = useMutation({
    mutationFn: async ({ medicationId, action, notes }: { medicationId: string; action: string; notes?: string }) => {
      const response = await apiRequest("POST", "/api/ai-medication/log-intake", { medicationId, action, notes });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Intake Logged", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-medication/dashboard"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log intake.", variant: "destructive" });
    },
  });

  const predictionsLoading = predictAdherenceMutation.isPending;
  const remindersLoading = generateRemindersMutation.isPending;
  const interactionsLoading = analyzeInteractionsMutation.isPending;
  const educationLoading = getEducationMutation.isPending;

  if (dashboardLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Medication Management
            </h1>
            <p className="text-muted-foreground">
              AI-powered insights for better medication adherence and safety
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => predictAdherenceMutation.mutate()}
              disabled={predictAdherenceMutation.isPending}
              data-testid="button-analyze-adherence"
            >
              {predictAdherenceMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-1" />
              )}
              Analyze Adherence
            </Button>
            <Button
              variant="outline"
              onClick={() => analyzeInteractionsMutation.mutate()}
              disabled={analyzeInteractionsMutation.isPending}
              data-testid="button-check-interactions"
            >
              {analyzeInteractionsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-1" />
              )}
              Check Interactions
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Medications</p>
                  <p className="text-2xl font-bold" data-testid="text-active-medications">
                    {dashboard?.summary.activeMedications || 0}
                  </p>
                </div>
                <Pill className="h-8 w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Adherence</p>
                  <p className="text-2xl font-bold" data-testid="text-overall-adherence">
                    {dashboard?.summary.overallAdherence || 0}%
                  </p>
                </div>
                <Target className="h-8 w-8 text-green-500 opacity-50" />
              </div>
              <Progress value={dashboard?.summary.overallAdherence || 0} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Reminders</p>
                  <p className="text-2xl font-bold" data-testid="text-active-reminders">
                    {dashboard?.summary.activeReminders || 0}
                  </p>
                </div>
                <Bell className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Interaction Alerts</p>
                  <p className="text-2xl font-bold" data-testid="text-interaction-alerts">
                    {dashboard?.summary.pendingInteractions || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {(dashboard?.summary.criticalAlerts || 0) > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Alerts</AlertTitle>
            <AlertDescription>
              You have {dashboard?.summary.criticalAlerts} critical medication interactions that require immediate attention.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 lg:w-auto lg:grid-cols-none lg:flex flex-wrap gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="h-4 w-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="quick-actions" data-testid="tab-quick-actions">
              <MessageSquare className="h-4 w-4 mr-1" />
              Quick Actions
            </TabsTrigger>
            <TabsTrigger value="refills" data-testid="tab-refills">
              <Package className="h-4 w-4 mr-1" />
              Refills
            </TabsTrigger>
            <TabsTrigger value="adherence" data-testid="tab-adherence">
              <TrendingUp className="h-4 w-4 mr-1" />
              Adherence
            </TabsTrigger>
            <TabsTrigger value="tips" data-testid="tab-tips">
              <Lightbulb className="h-4 w-4 mr-1" />
              Tips
            </TabsTrigger>
            <TabsTrigger value="reminders" data-testid="tab-reminders">
              <Bell className="h-4 w-4 mr-1" />
              Reminders
            </TabsTrigger>
            <TabsTrigger value="interactions" data-testid="tab-interactions">
              <Shield className="h-4 w-4 mr-1" />
              Interactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Pill className="h-5 w-5" />
                    Your Medications
                  </CardTitle>
                  <CardDescription>Active medications in your treatment plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {dashboard?.medications.map((med) => (
                        <div
                          key={med.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                          data-testid={`card-medication-${med.id}`}
                        >
                          <div>
                            <p className="font-medium">{med.name}</p>
                            <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={med.status === "active" ? "default" : "secondary"}>
                              {med.status}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedMedication(med.id);
                                setEducation(null);
                                setEducationDialogOpen(true);
                                getEducationMutation.mutate(med.id);
                              }}
                              data-testid={`button-learn-${med.id}`}
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {(!dashboard?.medications || dashboard.medications.length === 0) && (
                        <p className="text-center text-muted-foreground py-8">
                          No medications found. Connect your health records to see medications.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your recent medication activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-2">
                      {dashboard?.recentAdherence.map((record, idx) => (
                        <div
                          key={record.id || idx}
                          className="flex items-center justify-between p-2 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            {record.action === "taken" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-orange-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">{record.medicationName}</p>
                              <p className="text-xs text-muted-foreground">{record.scheduledTime}</p>
                            </div>
                          </div>
                          <Badge variant={record.action === "taken" ? "default" : "secondary"}>
                            {record.action}
                          </Badge>
                        </div>
                      ))}
                      {(!dashboard?.recentAdherence || dashboard.recentAdherence.length === 0) && (
                        <p className="text-center text-muted-foreground py-8">
                          No recent activity to display.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Insights
                </CardTitle>
                <CardDescription>Smart recommendations for better health outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Timing Tip</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Taking medications at the same time each day helps build a consistent routine and improves effectiveness.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Health Reminder</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stay hydrated! Drinking water with your medications helps them work better.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">Quick Tip</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Keep your medications in a visible spot to help remember to take them on time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Actions Tab - Voice/Text Commands */}
          <TabsContent value="quick-actions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Log Intake with Text/Voice */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Log Medication Intake
                  </CardTitle>
                  <CardDescription>
                    Use natural language to log your medications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder='Try: "I took my lisinopril" or "Skipped metformin this morning"'
                      value={voiceCommand}
                      onChange={(e) => setVoiceCommand(e.target.value)}
                      className="flex-1 min-h-[80px]"
                      data-testid="input-voice-command"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => processCommandMutation.mutate(voiceCommand)}
                      disabled={!voiceCommand.trim() || processCommandMutation.isPending}
                      data-testid="button-send-command"
                    >
                      {processCommandMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Send
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setVoiceCommand("I took my morning medications")}
                      size="sm"
                      data-testid="button-quick-morning"
                    >
                      Morning Meds
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setVoiceCommand("I took my evening medications")}
                      size="sm"
                      data-testid="button-quick-evening"
                    >
                      Evening Meds
                    </Button>
                  </div>
                  
                  {commandResult && (
                    <Alert className={commandResult.success ? "border-green-500" : "border-red-500"}>
                      {commandResult.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <AlertTitle>{commandResult.action}</AlertTitle>
                      <AlertDescription>{commandResult.response}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Report Side Effect */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    Report Side Effect
                  </CardTitle>
                  <CardDescription>
                    Describe any side effects you're experiencing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder='Describe your side effect, e.g., "I feel dizzy after taking my blood pressure medication"'
                    value={sideEffectDescription}
                    onChange={(e) => setSideEffectDescription(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="input-side-effect"
                  />
                  <Button
                    onClick={() => reportSideEffectMutation.mutate(sideEffectDescription)}
                    disabled={!sideEffectDescription.trim() || reportSideEffectMutation.isPending}
                    variant="outline"
                    className="w-full"
                    data-testid="button-report-side-effect"
                  >
                    {reportSideEffectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    Report Side Effect
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Quick Intake Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  Quick Log
                </CardTitle>
                <CardDescription>
                  Quickly log your medication intake with one tap
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboard?.medications.slice(0, 6).map((med) => (
                    <Card key={med.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-medium">{med.name}</p>
                            <p className="text-xs text-muted-foreground">{med.dosage}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => logIntakeMutation.mutate({ medicationId: med.id, action: "taken" })}
                            disabled={logIntakeMutation.isPending}
                            data-testid={`button-log-taken-${med.id}`}
                          >
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Taken
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => logIntakeMutation.mutate({ medicationId: med.id, action: "skipped" })}
                            disabled={logIntakeMutation.isPending}
                            data-testid={`button-log-skipped-${med.id}`}
                          >
                            <SkipForward className="h-3 w-3 mr-1" />
                            Skip
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!dashboard?.medications || dashboard.medications.length === 0) && (
                    <p className="col-span-full text-center text-muted-foreground py-8">
                      No medications to display.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Refills Tab */}
          <TabsContent value="refills" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Refill Reminders
                  </CardTitle>
                  <CardDescription>AI-generated reminders for upcoming refills</CardDescription>
                </div>
                <Button
                  onClick={() => refetchRefills()}
                  variant="outline"
                  data-testid="button-refresh-refills"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {refillsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-40" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {refillReminders && refillReminders.length > 0 ? (
                      refillReminders.map((reminder) => (
                        <Card 
                          key={reminder.medicationId} 
                          className="border-l-4"
                          style={{ 
                            borderLeftColor: reminder.urgencyLevel === "critical" ? "var(--red-500)" :
                              reminder.urgencyLevel === "high" ? "var(--orange-500)" :
                              reminder.urgencyLevel === "medium" ? "var(--yellow-500)" : "var(--green-500)"
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold">{reminder.medicationName}</h3>
                                  <Badge variant="outline">{reminder.dosage}</Badge>
                                  <Badge className={getRiskColor(reminder.urgencyLevel)}>
                                    {reminder.urgencyLevel === "critical" ? "Urgent" : 
                                     reminder.urgencyLevel === "high" ? "Soon" :
                                     reminder.urgencyLevel === "medium" ? "Upcoming" : "Planned"}
                                  </Badge>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm">{reminder.reminderMessage}</p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-4 w-4" />
                                      {reminder.daysUntilRefillNeeded <= 0 
                                        ? "Refill needed now" 
                                        : `${reminder.daysUntilRefillNeeded} days until refill needed`}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Package className="h-4 w-4" />
                                      {reminder.refillsRemaining} refills remaining
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{reminder.refillInstructions}</p>
                                </div>
                              </div>
                              {reminder.canRequestRefill && (
                                <div className="flex flex-col gap-2 min-w-[140px]">
                                  {reminder.refillRequestOptions.slice(0, 3).map((option) => (
                                    <Button
                                      key={option.id}
                                      size="sm"
                                      variant={option.method === "app_request" ? "default" : "outline"}
                                      onClick={() => requestRefillMutation.mutate({ 
                                        medicationId: reminder.medicationId, 
                                        method: option.method 
                                      })}
                                      disabled={requestRefillMutation.isPending}
                                      data-testid={`button-refill-${reminder.medicationId}-${option.method}`}
                                    >
                                      {option.method === "pharmacy_call" && <Phone className="h-3 w-3 mr-1" />}
                                      {option.method === "app_request" && <Send className="h-3 w-3 mr-1" />}
                                      {option.method === "mail_order" && <Mail className="h-3 w-3 mr-1" />}
                                      {option.method === "provider_message" && <MessageSquare className="h-3 w-3 mr-1" />}
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No refill reminders at this time.</p>
                        <p className="text-sm">Your medications are well-stocked.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personalized Tips Tab */}
          <TabsContent value="tips" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Adherence Tips */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-green-500" />
                      Adherence Tips
                    </CardTitle>
                    <CardDescription>Personalized tips to help you stay on track</CardDescription>
                  </div>
                  <Button
                    onClick={() => refetchTips()}
                    variant="outline"
                    size="sm"
                    data-testid="button-refresh-tips"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {tipsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : personalizedTips?.adherenceTips && personalizedTips.adherenceTips.length > 0 ? (
                    <div className="space-y-4">
                      {personalizedTips.adherenceTips.map((tip) => (
                        <div key={tip.tipId} className="p-4 rounded-lg border bg-green-50/50 dark:bg-green-900/10">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                              <Lightbulb className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{tip.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{tip.description}</p>
                              <div className="mt-2">
                                <p className="text-xs font-medium text-green-600">{tip.expectedBenefit}</p>
                              </div>
                              {tip.actionableSteps.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {tip.actionableSteps.slice(0, 2).map((step, idx) => (
                                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      {step}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No personalized tips available yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Side Effect Tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    Side Effect Management
                  </CardTitle>
                  <CardDescription>Tips for managing potential side effects</CardDescription>
                </CardHeader>
                <CardContent>
                  {tipsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : personalizedTips?.sideEffectTips && personalizedTips.sideEffectTips.length > 0 ? (
                    <div className="space-y-4">
                      {personalizedTips.sideEffectTips.map((tip, idx) => (
                        <div key={idx} className="p-4 rounded-lg border">
                          <div className="flex items-start gap-3">
                            <Badge 
                              className={
                                tip.severity === "severe" ? "bg-red-500" :
                                tip.severity === "moderate" ? "bg-orange-500" : "bg-yellow-500"
                              }
                            >
                              {tip.severity}
                            </Badge>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{tip.sideEffect}</h4>
                              {tip.relatedMedications.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Related to: {tip.relatedMedications.join(", ")}
                                </p>
                              )}
                              <div className="mt-2 space-y-2">
                                <div>
                                  <p className="text-xs font-medium">Management Tips:</p>
                                  <ul className="mt-1 space-y-1">
                                    {tip.managementTips.slice(0, 2).map((t, i) => (
                                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                                        <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
                                        {t}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="p-2 rounded bg-orange-50 dark:bg-orange-900/20">
                                  <p className="text-xs font-medium text-orange-600">When to Seek Help:</p>
                                  <p className="text-xs text-muted-foreground mt-1">{tip.whenToSeekHelp}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No side effect tips available.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Adherence Pattern Analysis */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    Adherence Pattern Analysis
                  </CardTitle>
                  <CardDescription>AI insights into your medication-taking patterns</CardDescription>
                </div>
                <Button
                  onClick={() => refetchAnalysis()}
                  variant="outline"
                  data-testid="button-refresh-analysis"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Analyze
                </Button>
              </CardHeader>
              <CardContent>
                {analysisLoading ? (
                  <Skeleton className="h-40" />
                ) : adherenceAnalysis ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Overall Adherence:</span>
                        <Badge className={
                          adherenceAnalysis.overallAdherenceRate >= 80 ? "bg-green-500" :
                          adherenceAnalysis.overallAdherenceRate >= 60 ? "bg-yellow-500" : "bg-red-500"
                        }>
                          {adherenceAnalysis.overallAdherenceRate}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Trend:</span>
                        <Badge variant="outline" className="flex items-center gap-1">
                          {adherenceAnalysis.trendDirection === "improving" ? (
                            <TrendingUp className="h-3 w-3 text-green-500" />
                          ) : adherenceAnalysis.trendDirection === "declining" ? (
                            <TrendingDown className="h-3 w-3 text-red-500" />
                          ) : (
                            <Activity className="h-3 w-3 text-blue-500" />
                          )}
                          {adherenceAnalysis.trendDirection}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">AI Confidence:</span>
                        <span className="text-sm text-muted-foreground">{adherenceAnalysis.confidence}%</span>
                      </div>
                    </div>

                    {adherenceAnalysis.insights.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Key Insights:</p>
                        <div className="space-y-2">
                          {adherenceAnalysis.insights.slice(0, 3).map((insight, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Sparkles className="h-4 w-4 mt-0.5 text-purple-500 flex-shrink-0" />
                              {insight}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adherenceAnalysis.recommendations.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                        <div className="space-y-2">
                          {adherenceAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Analyze" to get AI-powered insights.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adherence" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Adherence Predictions</CardTitle>
                  <CardDescription>AI-powered analysis of your medication adherence patterns</CardDescription>
                </div>
                <Button
                  onClick={() => predictAdherenceMutation.mutate()}
                  disabled={predictAdherenceMutation.isPending}
                  data-testid="button-refresh-predictions"
                >
                  {predictAdherenceMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Refresh Analysis
                </Button>
              </CardHeader>
              <CardContent>
                {predictionsLoading || predictAdherenceMutation.isPending ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-32" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {predictions && predictions.length > 0 ? (
                      predictions.map((prediction) => (
                        <Card key={prediction.medicationId} className="border-l-4" style={{ borderLeftColor: prediction.riskLevel === "low" ? "var(--green-500)" : prediction.riskLevel === "moderate" ? "var(--yellow-500)" : "var(--red-500)" }}>
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{prediction.medicationName}</h3>
                                  <Badge className={getRiskColor(prediction.riskLevel)}>
                                    {getRiskIcon(prediction.riskLevel)}
                                    <span className="ml-1 capitalize">{prediction.riskLevel} Risk</span>
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Current Adherence</p>
                                    <p className="text-lg font-bold">{prediction.currentAdherenceRate}%</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Predicted</p>
                                    <p className="text-lg font-bold flex items-center gap-1">
                                      {prediction.predictedAdherenceRate}%
                                      {prediction.predictedAdherenceRate < prediction.currentAdherenceRate ? (
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                      ) : (
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">AI Confidence</p>
                                    <p className="text-lg font-bold">{prediction.confidence}%</p>
                                  </div>
                                </div>
                                {prediction.riskFactors.length > 0 && (
                                  <div className="mb-2">
                                    <p className="text-sm font-medium mb-1">Risk Factors:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {prediction.riskFactors.map((factor, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {factor}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {prediction.suggestedInterventions.length > 0 && (
                                  <div>
                                    <p className="text-sm font-medium mb-1">Suggested Actions:</p>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                      {prediction.suggestedInterventions.slice(0, 3).map((intervention, idx) => (
                                        <li key={idx} className="flex items-start gap-1">
                                          <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                          {intervention}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No adherence predictions available yet.</p>
                        <p className="text-sm">Click "Refresh Analysis" to generate predictions.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reminders" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Personalized Reminders</CardTitle>
                  <CardDescription>AI-generated reminders customized for you</CardDescription>
                </div>
                <Button
                  onClick={() => generateRemindersMutation.mutate()}
                  disabled={generateRemindersMutation.isPending}
                  data-testid="button-generate-reminders"
                >
                  {generateRemindersMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-1" />
                  )}
                  Generate Reminders
                </Button>
              </CardHeader>
              <CardContent>
                {remindersLoading || generateRemindersMutation.isPending ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-40" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reminders && reminders.length > 0 ? (
                      reminders.map((reminder, idx) => (
                        <Card key={reminder.medicationId || idx}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="p-3 rounded-full bg-primary/10">
                                <Bell className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold">{reminder.medicationName}</h3>
                                  <Badge variant="outline">{reminder.dosage}</Badge>
                                </div>
                                <div className="space-y-3">
                                  <div className="p-3 rounded-lg bg-muted">
                                    <p className="text-sm font-medium mb-1">Your Personal Reminder:</p>
                                    <p className="text-sm">{reminder.personalizedMessage}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                    <p className="text-sm font-medium mb-1 flex items-center gap-1">
                                      <Lightbulb className="h-4 w-4" />
                                      Educational Tip:
                                    </p>
                                    <p className="text-sm">{reminder.educationalTip}</p>
                                  </div>
                                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                    <p className="text-sm font-medium mb-1 flex items-center gap-1">
                                      <Heart className="h-4 w-4" />
                                      Motivation:
                                    </p>
                                    <p className="text-sm">{reminder.motivationalNote}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No personalized reminders generated yet.</p>
                        <p className="text-sm">Click "Generate Reminders" to create personalized messages.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interactions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Drug Interaction Analysis</CardTitle>
                  <CardDescription>AI-powered safety checks for your medications</CardDescription>
                </div>
                <Button
                  onClick={() => analyzeInteractionsMutation.mutate()}
                  disabled={analyzeInteractionsMutation.isPending}
                  data-testid="button-refresh-interactions"
                >
                  {analyzeInteractionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Run Analysis
                </Button>
              </CardHeader>
              <CardContent>
                {interactionsLoading || analyzeInteractionsMutation.isPending ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => (
                      <Skeleton key={i} className="h-48" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interactions && interactions.length > 0 ? (
                      interactions.map((interaction) => (
                        <Alert
                          key={interaction.id}
                          variant={interaction.severity === "contraindicated" || interaction.severity === "major" ? "destructive" : "default"}
                        >
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="flex items-center gap-2">
                            {interaction.medications.map(m => m.name).join(" + ")}
                            <Badge className={getRiskColor(interaction.severity)}>
                              {interaction.severity.toUpperCase()}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription className="mt-2 space-y-2">
                            <p>{interaction.description}</p>
                            {interaction.clinicalEffects.length > 0 && (
                              <div>
                                <p className="font-medium text-sm">Potential Effects:</p>
                                <ul className="list-disc list-inside text-sm">
                                  {interaction.clinicalEffects.map((effect, idx) => (
                                    <li key={idx}>{effect}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {interaction.recommendations.length > 0 && (
                              <div>
                                <p className="font-medium text-sm">Recommendations:</p>
                                <ul className="list-disc list-inside text-sm">
                                  {interaction.recommendations.map((rec, idx) => (
                                    <li key={idx}>{rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                              <span>AI Confidence: {interaction.aiConfidence}%</span>
                              <span>|</span>
                              <span>Detected: {new Date(interaction.detectedAt).toLocaleDateString()}</span>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                        <p className="text-green-600 font-medium">No Drug Interactions Detected</p>
                        <p className="text-sm">Your current medications appear to be safe together.</p>
                        <p className="text-xs mt-2">Click "Run Analysis" to check for new interactions.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={educationDialogOpen} onOpenChange={setEducationDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Medication Education
              </DialogTitle>
              <DialogDescription>
                Learn about your medication to take it safely and effectively
              </DialogDescription>
            </DialogHeader>
            {educationLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : education ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{education.medicationName}</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium flex items-center gap-1">
                      <Target className="h-4 w-4" /> Purpose
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">{education.purpose}</p>
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-1">
                      <Brain className="h-4 w-4" /> How It Works
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">{education.howItWorks}</p>
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" /> Common Side Effects
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {education.commonSideEffects.map((effect, idx) => (
                        <li key={idx}>{effect}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-1 text-orange-500">
                      <AlertTriangle className="h-4 w-4" /> Important Warnings
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {education.importantWarnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Best Practices
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {education.bestPractices.map((practice, idx) => (
                        <li key={idx}>{practice}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium flex items-center gap-1">
                      <Lightbulb className="h-4 w-4" /> Lifestyle Tips
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {education.lifestyleTips.map((tip, idx) => (
                        <li key={idx}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Select a medication to view educational content.
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEducationDialogOpen(false)} data-testid="button-close-education">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-ai-medication-management-disclaimer" />
      </div>
    </ScrollArea>
  );
}
