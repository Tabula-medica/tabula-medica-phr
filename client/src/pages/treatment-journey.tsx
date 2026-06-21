import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Heart,
  Pill,
  Stethoscope,
  Target,
  TrendingUp,
  Activity,
  AlertTriangle,
  ChevronRight,
  Star,
  Sparkles,
  User,
  Building2,
  Phone,
  MapPin,
  Syringe,
  Radiation,
  Scissors,
  Shield,
  FlaskConical,
  ClipboardList,
  MessageSquare,
  Info,
  Bot,
  Send,
  Loader2,
  HelpCircle,
  X,
} from "lucide-react";

interface TreatmentPhase {
  id: string;
  name: string;
  description: string;
  status: "completed" | "in_progress" | "upcoming" | "skipped";
  startDate: string;
  endDate?: string;
  progress: number;
  provider?: string;
  facility?: string;
  notes?: string;
  milestones: TreatmentMilestone[];
}

interface TreatmentMilestone {
  id: string;
  title: string;
  date: string;
  status: "completed" | "in_progress" | "upcoming";
  type: "appointment" | "procedure" | "lab" | "imaging" | "medication" | "followup";
  notes?: string;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "discontinued";
  purpose: string;
  prescribedBy: string;
}

interface CareTeamMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  facility: string;
  phone?: string;
  isPrimary: boolean;
}

interface TreatmentJourneyData {
  patientId: string;
  patientName: string;
  condition: string;
  conditionSubtype?: string;
  diagnosisDate: string;
  currentPhase: string;
  overallProgress: number;
  phases: TreatmentPhase[];
  medications: Medication[];
  careTeam: CareTeamMember[];
  upcomingAppointments: {
    id: string;
    title: string;
    date: string;
    time: string;
    provider: string;
    facility: string;
    type: string;
  }[];
  recentActivity: {
    id: string;
    type: string;
    title: string;
    date: string;
    description: string;
  }[];
  aiSummary: {
    currentStatus: string;
    nextSteps: string[];
    encouragement: string;
  };
}

const phaseIcons: Record<string, typeof Activity> = {
  diagnosis: Stethoscope,
  surgery: Scissors,
  chemotherapy: FlaskConical,
  radiation: Radiation,
  immunotherapy: Shield,
  hormone_therapy: Pill,
  recovery: Heart,
  surveillance: Target,
  followup: ClipboardList,
};

const milestoneTypeIcons: Record<string, typeof Activity> = {
  appointment: Calendar,
  procedure: Scissors,
  lab: FlaskConical,
  imaging: Radiation,
  medication: Pill,
  followup: ClipboardList,
};

const statusColors: Record<string, string> = {
  completed: "text-green-600 bg-green-100 dark:bg-green-900/30",
  in_progress: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  upcoming: "text-gray-600 bg-gray-100 dark:bg-gray-800/30",
  skipped: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  active: "text-green-600 bg-green-100 dark:bg-green-900/30",
  discontinued: "text-red-600 bg-red-100 dark:bg-red-900/30",
};

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

interface AIMessage {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;
}

export default function TreatmentJourney() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: journeyData, isLoading } = useQuery<TreatmentJourneyData>({
    queryKey: ["/api/treatment-journey"],
  });

  const askAIMutation = useMutation({
    mutationFn: async (question: string) => {
      const context = journeyData ? {
        condition: journeyData.condition,
        conditionSubtype: journeyData.conditionSubtype,
        currentPhase: journeyData.currentPhase,
        overallProgress: journeyData.overallProgress,
        phases: journeyData.phases.map(p => ({
          name: p.name,
          status: p.status,
          progress: p.progress,
        })),
        upcomingMilestones: journeyData.upcomingAppointments.slice(0, 3).map(a => a.title),
      } : undefined;

      const response = await apiRequest("POST", "/api/ai-timeline/ask", { question, context });
      return response.json();
    },
    onSuccess: (data) => {
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        disclaimer: data.disclaimer,
      }]);
    },
  });

  const explainPhaseMutation = useMutation({
    mutationFn: async (phase: TreatmentPhase) => {
      const response = await apiRequest("POST", "/api/ai-timeline/explain-phase", {
        phaseName: phase.name,
        phaseDescription: phase.description,
        condition: journeyData?.condition,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: data.explanation,
        disclaimer: data.disclaimer,
      }]);
      setShowAIAssistant(true);
    },
  });

  const explainMilestoneMutation = useMutation({
    mutationFn: async ({ milestone, phaseName }: { milestone: TreatmentMilestone; phaseName: string }) => {
      const response = await apiRequest("POST", "/api/ai-timeline/explain-milestone", {
        milestoneTitle: milestone.title,
        milestoneType: milestone.type,
        phaseName,
        condition: journeyData?.condition,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: data.explanation,
        disclaimer: data.disclaimer,
      }]);
      setShowAIAssistant(true);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSendMessage = () => {
    if (!userInput.trim() || askAIMutation.isPending) return;
    setAiMessages(prev => [...prev, { role: "user", content: userInput }]);
    askAIMutation.mutate(userInput);
    setUserInput("");
  };

  const handleExplainPhase = (phase: TreatmentPhase) => {
    setAiMessages(prev => [...prev, { role: "user", content: `Tell me about the ${phase.name} phase` }]);
    explainPhaseMutation.mutate(phase);
  };

  const handleExplainMilestone = (milestone: TreatmentMilestone, phaseName: string) => {
    setAiMessages(prev => [...prev, { role: "user", content: `Explain: ${milestone.title}` }]);
    explainMilestoneMutation.mutate({ milestone, phaseName });
  };

  const isAILoading = askAIMutation.isPending || explainPhaseMutation.isPending || explainMilestoneMutation.isPending;

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-6 px-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!journeyData) {
    return (
      <div className="container max-w-6xl py-6 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Treatment Journey Found</h2>
            <p className="text-muted-foreground">
              Your treatment journey will appear here once you have active treatment records.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedPhases = journeyData.phases.filter(p => p.status === "completed").length;
  const totalPhases = journeyData.phases.length;
  const activeMedications = journeyData.medications.filter(m => m.status === "active");

  return (
    <div className="container max-w-6xl py-6 px-4 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-treatment-journey-title">
          My Treatment Journey
        </h1>
        <p className="text-muted-foreground">
          Track your treatment progress, milestones, and care team
        </p>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          This information is for educational purposes only and does not constitute medical advice. 
          Always consult your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{journeyData.overallProgress}%</p>
              </div>
            </div>
            <Progress value={journeyData.overallProgress} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phases Completed</p>
                <p className="text-2xl font-bold">{completedPhases} / {totalPhases}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Pill className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Medications</p>
                <p className="text-2xl font-bold">{activeMedications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Since Diagnosis</p>
                <p className="text-2xl font-bold">{getDaysSince(journeyData.diagnosisDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Journey Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">{journeyData.aiSummary.currentStatus}</p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Next Steps:</p>
            <ul className="space-y-1">
              {journeyData.aiSummary.nextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
              <Star className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {journeyData.aiSummary.encouragement}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Timeline</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Care Team</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Treatment Timeline
              </CardTitle>
              <CardDescription>
                Your treatment phases and milestones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {journeyData.phases.map((phase, idx) => {
                    const PhaseIcon = phaseIcons[phase.id] || Activity;
                    const isActive = phase.status === "in_progress";
                    const isCompleted = phase.status === "completed";
                    
                    return (
                      <div key={phase.id} className="relative pl-10 pb-8 last:pb-0">
                        <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          isCompleted 
                            ? "bg-green-100 dark:bg-green-900/50 text-green-600" 
                            : isActive 
                            ? "bg-blue-100 dark:bg-blue-900/50 text-blue-600 ring-2 ring-blue-400 ring-offset-2 ring-offset-background" 
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <PhaseIcon className="h-4 w-4" />
                          )}
                        </div>
                        
                        <div className={`p-4 rounded-lg border ${isActive ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20" : "bg-card"}`}>
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{phase.name}</h3>
                                <Badge variant="outline" className={statusColors[phase.status]}>
                                  {phase.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{phase.description}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs mb-2"
                                onClick={() => handleExplainPhase(phase)}
                                disabled={isAILoading}
                                data-testid={`button-explain-phase-${phase.id}`}
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Explain
                              </Button>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(phase.startDate)}
                                  {phase.endDate && ` - ${formatDate(phase.endDate)}`}
                                </span>
                                {phase.provider && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {phase.provider}
                                  </span>
                                )}
                              </div>
                            </div>
                            {phase.status !== "upcoming" && (
                              <div className="text-right">
                                <p className="text-sm font-medium">{phase.progress}%</p>
                                <Progress value={phase.progress} className="w-20 h-1.5 mt-1" />
                              </div>
                            )}
                          </div>

                          {phase.milestones.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Milestones</p>
                              <div className="space-y-2">
                                {phase.milestones.map(milestone => {
                                  const MilestoneIcon = milestoneTypeIcons[milestone.type] || Circle;
                                  return (
                                    <div key={milestone.id} className="flex items-center gap-2 text-sm">
                                      {milestone.status === "completed" ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : milestone.status === "in_progress" ? (
                                        <Clock className="h-4 w-4 text-blue-500" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <MilestoneIcon className="h-3 w-3 text-muted-foreground" />
                                      <span className={milestone.status === "completed" ? "text-muted-foreground" : ""}>
                                        {milestone.title}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {formatDate(milestone.date)}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0"
                                        onClick={() => handleExplainMilestone(milestone, phase.name)}
                                        disabled={isAILoading}
                                        data-testid={`button-explain-milestone-${milestone.id}`}
                                      >
                                        <Sparkles className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Current Medications
              </CardTitle>
              <CardDescription>
                Your active and past treatment medications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {journeyData.medications.map(med => (
                  <div key={med.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${med.status === "active" ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}`}>
                          <Pill className={`h-4 w-4 ${med.status === "active" ? "text-green-600" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <h4 className="font-medium">{med.name}</h4>
                          <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                          <p className="text-xs text-muted-foreground mt-1">{med.purpose}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColors[med.status]}>
                        {med.status}
                      </Badge>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Started: {formatDate(med.startDate)}
                      </span>
                      {med.endDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Ended: {formatDate(med.endDate)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {med.prescribedBy}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Care Team
              </CardTitle>
              <CardDescription>
                Healthcare providers involved in your treatment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {journeyData.careTeam.map(member => (
                  <div key={member.id} className={`p-4 rounded-lg border ${member.isPrimary ? "border-primary/50 bg-primary/5" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-muted">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{member.name}</h4>
                          {member.isPrimary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        <p className="text-sm text-primary">{member.role}</p>
                        {member.specialty && (
                          <p className="text-xs text-muted-foreground">{member.specialty}</p>
                        )}
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {member.facility}
                          </p>
                          {member.phone && (
                            <p className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {member.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Appointments
              </CardTitle>
              <CardDescription>
                Your scheduled visits and procedures
              </CardDescription>
            </CardHeader>
            <CardContent>
              {journeyData.upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming appointments scheduled</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {journeyData.upcomingAppointments.map(appt => (
                    <div key={appt.id} className="p-4 rounded-lg border hover-elevate">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Calendar className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{appt.title}</h4>
                            <p className="text-sm text-muted-foreground">{appt.provider}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="h-3 w-3" />
                              {appt.facility}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatDate(appt.date)}</p>
                          <p className="text-sm text-muted-foreground">{appt.time}</p>
                          <Badge variant="outline" className="mt-1">{appt.type}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Floating AI Assistant Button */}
      {!showAIAssistant && (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0"
          onClick={() => setShowAIAssistant(true)}
          data-testid="button-open-ai-assistant"
        >
          <Bot className="h-6 w-6" />
        </Button>
      )}

      {/* AI Timeline Assistant Panel */}
      {showAIAssistant && (
        <Card className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] shadow-xl z-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Timeline Assistant</CardTitle>
                  <CardDescription className="text-xs">Ask about your treatment journey</CardDescription>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowAIAssistant(false)}
                data-testid="button-close-ai-assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-72 pr-2">
              {aiMessages.length === 0 ? (
                <div className="space-y-3 py-4">
                  <p className="text-sm text-muted-foreground text-center">
                    I can help you understand your treatment journey. Try asking:
                  </p>
                  <div className="space-y-2">
                    {[
                      "What phase am I in?",
                      "What's next in my treatment?",
                      "Explain chemotherapy side effects",
                      "How far have I come?",
                    ].map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left h-auto py-2 px-3"
                        onClick={() => {
                          setAiMessages([{ role: "user", content: suggestion }]);
                          askAIMutation.mutate(suggestion);
                        }}
                        disabled={isAILoading}
                        data-testid={`button-suggestion-${idx}`}
                      >
                        <HelpCircle className="h-3 w-3 mr-2 shrink-0" />
                        <span className="text-xs">{suggestion}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {aiMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.disclaimer && (
                          <p className="text-xs mt-2 opacity-70 italic">{msg.disclaimer}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isAILoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            <Separator className="my-2" />
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your journey..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isAILoading}
                data-testid="input-ai-question"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!userInput.trim() || isAILoading}
                data-testid="button-send-ai-question"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <Alert className="mt-3">
              <Info className="h-3 w-3" />
              <AlertDescription className="text-xs">
                For educational purposes only. Always consult your care team for medical advice.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
