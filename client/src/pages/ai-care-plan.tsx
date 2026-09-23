import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Brain, 
  Sparkles, 
  Target, 
  ListTodo, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  FileText,
  Loader2,
  ChevronRight,
  Lightbulb,
  Activity,
  Zap,
  BarChart3,
  ArrowRight,
  Heart,
  UtensilsCrossed,
  Stethoscope,
  Apple,
  Dumbbell,
  Moon,
  AlertCircle,
  BookOpen,
  Calendar,
  ShieldCheck
} from "lucide-react";
import type { CarePlan, CarePlanGoal, CarePlanIntervention, CareTeamRole } from "@shared/schema";

interface PatientContext {
  patientId: string;
  patientName: string;
  age?: number;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

interface GeneratedCarePlan {
  title: string;
  description: string;
  category: string;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  recommendedTeamRoles: CareTeamRole[];
  rationale: string;
  evidenceBasis: string[];
}

interface TaskRecommendation {
  title: string;
  description: string;
  priority: "urgent" | "high" | "normal" | "low";
  category: string;
  suggestedAssignee: string;
  dueInDays: number;
  rationale: string;
}

interface InterventionSuggestion {
  goalId: string;
  description: string;
  frequency: string;
  suggestedAssignee: string;
  evidenceBasis: string;
  expectedOutcome: string;
}

interface CarePlanOptimization {
  currentIssues: {
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
  }[];
  suggestedAdjustments: {
    targetType: string;
    targetId: string;
    adjustment: string;
    rationale: string;
  }[];
  predictedOutcome: {
    metric: string;
    currentTrajectory: string;
    optimizedTrajectory: string;
  }[];
}

interface ProgressSummary {
  summary: string;
  keyAchievements: string[];
  areasOfConcern: string[];
  nextSteps: string[];
  overallProgress: number;
}

interface LifestyleRecommendation {
  id: string;
  category: "exercise" | "sleep" | "stress_management" | "social" | "environment" | "habits";
  title: string;
  description: string;
  frequency: string;
  duration?: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedBenefit: string;
  precautions?: string[];
}

interface DietaryRecommendation {
  id: string;
  category: "nutrition" | "hydration" | "supplements" | "restrictions" | "meal_planning";
  title: string;
  description: string;
  foods_to_include: string[];
  foods_to_avoid: string[];
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedBenefit: string;
  considerations?: string[];
}

interface TreatmentRecommendation {
  id: string;
  category: "medication" | "therapy" | "procedure" | "monitoring" | "preventive";
  title: string;
  description: string;
  frequency?: string;
  duration?: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  expectedOutcome: string;
  sideEffects?: string[];
  contraindications?: string[];
  requiresSpecialist: boolean;
}

interface PersonalizedCarePlan {
  carePlan: GeneratedCarePlan;
  lifestyleRecommendations: LifestyleRecommendation[];
  dietaryRecommendations: DietaryRecommendation[];
  treatmentRecommendations: TreatmentRecommendation[];
  patientEducation: {
    topic: string;
    summary: string;
    resources: string[];
  }[];
  riskFactors: {
    factor: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  }[];
  followUpSchedule: {
    type: string;
    interval: string;
    purpose: string;
  }[];
}

const samplePatientContext: PatientContext = {
  patientId: "patient-1",
  patientName: "Sample Patient",
  age: 65,
  conditions: ["Type 2 Diabetes", "Hypertension", "Chronic Kidney Disease Stage 3"],
  medications: ["Metformin 1000mg", "Lisinopril 20mg", "Amlodipine 10mg"],
  allergies: ["Penicillin", "Sulfa drugs"],
};

const sampleCarePlan: CarePlan = {
  id: "care-plan-1",
  patientId: "patient-1",
  title: "Diabetes Management Plan",
  description: "Comprehensive management plan for Type 2 Diabetes with comorbidities",
  category: "chronic_disease",
  status: "active",
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  endDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  conditions: ["Type 2 Diabetes", "Hypertension"],
  createdBy: "provider-1",
  goals: [
    {
      id: "goal-1",
      description: "Achieve HbA1c below 7%",
      targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      priority: "high",
      status: "in_progress",
      progress: 45,
      metrics: [{ name: "HbA1c", target: "< 7%", current: "7.8%", unit: "%" }],
    },
    {
      id: "goal-2",
      description: "Blood pressure consistently below 130/80 mmHg",
      targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      priority: "high",
      status: "in_progress",
      progress: 60,
      metrics: [{ name: "Blood Pressure", target: "< 130/80", current: "142/88", unit: "mmHg" }],
    },
    {
      id: "goal-3",
      description: "Maintain eGFR stability",
      targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      priority: "medium",
      status: "in_progress",
      progress: 75,
      metrics: [{ name: "eGFR", target: "> 45", current: "48", unit: "mL/min/1.73m²" }],
    },
  ],
  interventions: [
    {
      id: "int-1",
      goalId: "goal-1",
      description: "Monthly HbA1c monitoring",
      frequency: "Monthly",
      startDate: new Date().toISOString().split("T")[0],
      status: "in_progress",
    },
    {
      id: "int-2",
      goalId: "goal-2",
      description: "Daily blood pressure monitoring",
      frequency: "Daily",
      startDate: new Date().toISOString().split("T")[0],
      status: "in_progress",
    },
  ],
  careTeam: [],
  progressNotes: [
    {
      id: "note-1",
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      recordedBy: "Dr. Smith",
      note: "Patient showing good adherence to medication regimen.",
      type: "progress_note",
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function AICarePlanPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("personalized");
  const [patientContext, setPatientContext] = useState<PatientContext>(samplePatientContext);
  const [primaryCondition, setPrimaryCondition] = useState("Type 2 Diabetes");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedCarePlan | null>(null);
  const [suggestedTasks, setSuggestedTasks] = useState<TaskRecommendation[]>([]);
  const [interventionSuggestions, setInterventionSuggestions] = useState<InterventionSuggestion[]>([]);
  const [optimization, setOptimization] = useState<CarePlanOptimization | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [personalizedPlan, setPersonalizedPlan] = useState<PersonalizedCarePlan | null>(null);
  const [treatmentGoals, setTreatmentGoals] = useState<string[]>(["Improve blood sugar control", "Reduce cardiovascular risk"]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/generate", { patientContext, primaryCondition, additionalNotes });
      return res.json() as Promise<GeneratedCarePlan>;
    },
    onSuccess: (data) => {
      setGeneratedPlan(data);
      toast({ title: "Care Plan Generated", description: "AI has created a comprehensive care plan." });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Unable to generate care plan.", variant: "destructive" });
    },
  });

  const suggestTasksMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/suggest-tasks", { carePlan: sampleCarePlan, patientContext });
      return res.json() as Promise<TaskRecommendation[]>;
    },
    onSuccess: (data) => {
      setSuggestedTasks(data);
      toast({ title: "Tasks Suggested", description: `AI has recommended ${data.length} tasks.` });
    },
    onError: () => {
      toast({ title: "Suggestion Failed", description: "Unable to suggest tasks.", variant: "destructive" });
    },
  });

  const suggestInterventionsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/suggest-interventions", { carePlan: sampleCarePlan, patientContext });
      return res.json() as Promise<InterventionSuggestion[]>;
    },
    onSuccess: (data) => {
      setInterventionSuggestions(data);
      toast({ title: "Interventions Suggested", description: `AI has recommended ${data.length} interventions.` });
    },
    onError: () => {
      toast({ title: "Suggestion Failed", description: "Unable to suggest interventions.", variant: "destructive" });
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/optimize", { carePlan: sampleCarePlan, patientContext });
      return res.json() as Promise<CarePlanOptimization>;
    },
    onSuccess: (data) => {
      setOptimization(data);
      toast({ title: "Optimization Complete", description: "AI has analyzed your care plan." });
    },
    onError: () => {
      toast({ title: "Optimization Failed", description: "Unable to optimize care plan.", variant: "destructive" });
    },
  });

  const progressMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/progress-summary", { carePlan: sampleCarePlan, patientContext });
      return res.json() as Promise<ProgressSummary>;
    },
    onSuccess: (data) => {
      setProgressSummary(data);
      toast({ title: "Summary Generated", description: "AI has created a progress summary." });
    },
    onError: () => {
      toast({ title: "Summary Failed", description: "Unable to generate summary.", variant: "destructive" });
    },
  });

  const personalizedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-care-plan/personalized", { 
        patientContext, 
        primaryCondition, 
        treatmentGoals,
        additionalNotes 
      });
      return res.json() as Promise<PersonalizedCarePlan>;
    },
    onSuccess: (data) => {
      setPersonalizedPlan(data);
      toast({ 
        title: "Personalized Plan Generated", 
        description: "AI has created lifestyle, dietary, and treatment recommendations." 
      });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Unable to generate personalized plan.", variant: "destructive" });
    },
  });

  const priorityColors = {
    urgent: "bg-red-500/10 text-red-600 border-red-500/20",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    normal: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    low: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  };

  const severityColors = {
    high: "bg-red-500/10 text-red-600",
    medium: "bg-yellow-500/10 text-yellow-600",
    low: "bg-green-500/10 text-green-600",
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Care Plan Automation</h1>
          <p className="text-muted-foreground">
            Leverage AI to generate, optimize, and enhance care plans
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 lg:w-auto lg:inline-grid">
          <TabsTrigger value="personalized" className="gap-2" data-testid="tab-personalized">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Personalized</span>
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2" data-testid="tab-generate">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Generate</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2" data-testid="tab-tasks">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">Tasks</span>
          </TabsTrigger>
          <TabsTrigger value="interventions" className="gap-2" data-testid="tab-interventions">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Interventions</span>
          </TabsTrigger>
          <TabsTrigger value="optimize" className="gap-2" data-testid="tab-optimize">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Optimize</span>
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-2" data-testid="tab-summary">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Summary</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personalized" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Patient Information
                </CardTitle>
                <CardDescription>
                  Configure patient details for personalized recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-care-plan-primary-condition">Primary Condition</Label>
                  <Input id="ai-care-plan-primary-condition"
                    value={primaryCondition}
                    onChange={(e) => setPrimaryCondition(e.target.value)}
                    placeholder="e.g., Type 2 Diabetes"
                    data-testid="input-personalized-condition"
                  />
                </div>
                <div className="space-y-2">
                  <FieldCaption>Treatment Goals</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {treatmentGoals.map((goal, i) => (
                      <Badge key={i} variant="secondary">{goal}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Current Conditions</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.conditions.map((c, i) => (
                      <Badge key={i} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Medications</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.medications.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Allergies</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="bg-red-100 text-red-700 text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-care-plan-additional-notes">Additional Notes</Label>
                  <Textarea id="ai-care-plan-additional-notes"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any additional context..."
                    rows={2}
                    data-testid="input-personalized-notes"
                  />
                </div>
                <Button 
                  onClick={() => personalizedMutation.mutate()} 
                  disabled={personalizedMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-personalized"
                >
                  {personalizedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Heart className="h-4 w-4 mr-2" />
                      Generate Personalized Plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              {personalizedPlan ? (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5 text-green-500" />
                        Lifestyle Recommendations
                      </CardTitle>
                      <CardDescription>Personalized lifestyle changes based on patient conditions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-72">
                        <div className="space-y-3">
                          {personalizedPlan.lifestyleRecommendations.map((rec, i) => (
                            <div key={rec.id || i} className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800" data-testid={`lifestyle-rec-${i}`}>
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                                  {rec.category === "exercise" && <Dumbbell className="h-4 w-4 text-green-600" />}
                                  {rec.category === "sleep" && <Moon className="h-4 w-4 text-green-600" />}
                                  {rec.category === "stress_management" && <Heart className="h-4 w-4 text-green-600" />}
                                  {!["exercise", "sleep", "stress_management"].includes(rec.category) && <Activity className="h-4 w-4 text-green-600" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <h4 className="font-medium">{rec.title}</h4>
                                    <Badge className={priorityColors[rec.priority] || priorityColors.normal}>
                                      {rec.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {rec.frequency}
                                    </Badge>
                                    {rec.duration && (
                                      <Badge variant="outline" className="text-xs">{rec.duration}</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Expected Benefit:</strong> {rec.expectedBenefit}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Apple className="h-5 w-5 text-orange-500" />
                        Dietary Recommendations
                      </CardTitle>
                      <CardDescription>Nutrition and dietary guidance for optimal health</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-72">
                        <div className="space-y-3">
                          {personalizedPlan.dietaryRecommendations.map((rec, i) => (
                            <div key={rec.id || i} className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800" data-testid={`dietary-rec-${i}`}>
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                                  <UtensilsCrossed className="h-4 w-4 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <h4 className="font-medium">{rec.title}</h4>
                                    <Badge className={priorityColors[rec.priority] || priorityColors.normal}>
                                      {rec.priority}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                  <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div>
                                      <p className="text-xs font-medium text-green-600 mb-1">Include:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {rec.foods_to_include.slice(0, 4).map((food, j) => (
                                          <Badge key={j} variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30">
                                            {food}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-red-600 mb-1">Avoid:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {rec.foods_to_avoid.slice(0, 4).map((food, j) => (
                                          <Badge key={j} variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30">
                                            {food}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-blue-500" />
                        Treatment Recommendations
                      </CardTitle>
                      <CardDescription>Evidence-based treatment options and monitoring</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-72">
                        <div className="space-y-3">
                          {personalizedPlan.treatmentRecommendations.map((rec, i) => (
                            <div key={rec.id || i} className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800" data-testid={`treatment-rec-${i}`}>
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                                  <Stethoscope className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <h4 className="font-medium">{rec.title}</h4>
                                    <div className="flex items-center gap-2">
                                      {rec.requiresSpecialist && (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600">
                                          Specialist
                                        </Badge>
                                      )}
                                      <Badge className={priorityColors[rec.priority] || priorityColors.normal}>
                                        {rec.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                  {rec.frequency && (
                                    <Badge variant="outline" className="text-xs mt-2">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {rec.frequency}
                                    </Badge>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Expected Outcome:</strong> {rec.expectedOutcome}
                                  </p>
                                  {rec.sideEffects && rec.sideEffects.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-yellow-600">
                                        <AlertCircle className="h-3 w-3 inline mr-1" />
                                        Possible: {rec.sideEffects.slice(0, 2).join(", ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-indigo-500" />
                          Patient Education
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {personalizedPlan.patientEducation.map((edu, i) => (
                            <div key={i} className="p-2 bg-muted rounded text-sm" data-testid={`education-${i}`}>
                              <p className="font-medium">{edu.topic}</p>
                              <p className="text-xs text-muted-foreground mt-1">{edu.summary}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Risk Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {personalizedPlan.riskFactors.map((risk, i) => (
                            <div key={i} className="p-2 bg-muted rounded text-sm" data-testid={`risk-${i}`}>
                              <div className="flex items-center gap-2">
                                <Badge className={severityColors[risk.severity]}>{risk.severity}</Badge>
                                <span className="font-medium">{risk.factor}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{risk.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-teal-500" />
                          Follow-up Schedule
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {personalizedPlan.followUpSchedule.map((schedule, i) => (
                            <div key={i} className="p-2 bg-muted rounded text-sm" data-testid={`followup-${i}`}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{schedule.interval}</Badge>
                                <span className="font-medium">{schedule.type}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{schedule.purpose}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card className="h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center py-12">
                    <div className="p-4 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                      <Heart className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Generate Personalized Care Plan</h3>
                    <p className="text-muted-foreground max-w-md">
                      Click "Generate Personalized Plan" to get AI-powered lifestyle changes, 
                      dietary recommendations, and treatment options based on patient conditions.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Patient Context
                </CardTitle>
                <CardDescription>
                  Provide patient information for AI-generated care plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-care-plan-primary-condition-2">Primary Condition</Label>
                  <Input id="ai-care-plan-primary-condition-2"
                    value={primaryCondition}
                    onChange={(e) => setPrimaryCondition(e.target.value)}
                    placeholder="e.g., Type 2 Diabetes"
                    data-testid="input-primary-condition"
                  />
                </div>
                <div className="space-y-2">
                  <FieldCaption>Current Conditions</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.conditions.map((c, i) => (
                      <Badge key={i} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Medications</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.medications.map((m, i) => (
                      <Badge key={i} variant="outline">{m}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Allergies</FieldCaption>
                  <div className="flex flex-wrap gap-2">
                    {patientContext.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="bg-red-100 text-red-700">{a}</Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-care-plan-additional-notes-2">Additional Notes</Label>
                  <Textarea id="ai-care-plan-additional-notes-2"
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any additional context for the care plan..."
                    rows={3}
                    data-testid="input-additional-notes"
                  />
                </div>
                <Button 
                  onClick={() => generateMutation.mutate()} 
                  disabled={generateMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-plan"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Care Plan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {generatedPlan && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {generatedPlan.title}
                  </CardTitle>
                  <CardDescription>{generatedPlan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Goals ({generatedPlan.goals.length})</h4>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {generatedPlan.goals.map((goal, i) => (
                          <div key={i} className="p-3 bg-muted rounded-lg">
                            <div className="flex items-start gap-2">
                              <Target className="h-4 w-4 mt-0.5 text-primary" />
                              <div>
                                <p className="text-sm font-medium">{goal.description}</p>
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {goal.priority} priority
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Recommended Team</h4>
                    <div className="flex flex-wrap gap-2">
                      {generatedPlan.recommendedTeamRoles.map((role, i) => (
                        <Badge key={i} variant="secondary" className="capitalize">
                          <Users className="h-3 w-3 mr-1" />
                          {role.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Clinical Rationale</h4>
                    <p className="text-sm text-muted-foreground">{generatedPlan.rationale}</p>
                  </div>
                  {generatedPlan.evidenceBasis.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Evidence Basis</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {generatedPlan.evidenceBasis.map((e, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                AI Task Suggestions
              </CardTitle>
              <CardDescription>
                Get intelligent task recommendations based on the care plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => suggestTasksMutation.mutate()} 
                disabled={suggestTasksMutation.isPending}
                className="mb-4"
                data-testid="button-suggest-tasks"
              >
                {suggestTasksMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Suggest Tasks
                  </>
                )}
              </Button>

              {suggestedTasks.length > 0 && (
                <div className="space-y-4">
                  {suggestedTasks.map((task, i) => (
                    <Card key={i} className="border-l-4" style={{ borderLeftColor: task.priority === "urgent" ? "#ef4444" : task.priority === "high" ? "#f97316" : "#3b82f6" }}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge className={priorityColors[task.priority]}>
                                {task.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                            <div className="flex flex-wrap gap-3 text-sm">
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {task.suggestedAssignee.replace(/_/g, " ")}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                Due in {task.dueInDays} days
                              </span>
                              <Badge variant="outline" className="capitalize">
                                {task.category.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" data-testid={`button-add-task-${i}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground">
                          <span className="font-medium">Rationale:</span> {task.rationale}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interventions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                AI Intervention Suggestions
              </CardTitle>
              <CardDescription>
                Evidence-based interventions to support care plan goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => suggestInterventionsMutation.mutate()} 
                disabled={suggestInterventionsMutation.isPending}
                className="mb-4"
                data-testid="button-suggest-interventions"
              >
                {suggestInterventionsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Suggest Interventions
                  </>
                )}
              </Button>

              {interventionSuggestions.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  {interventionSuggestions.map((intervention, i) => (
                    <Card key={i}>
                      <CardContent className="pt-4">
                        <h4 className="font-medium mb-2">{intervention.description}</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frequency:</span>
                            <span>{intervention.frequency}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Assigned to:</span>
                            <span className="capitalize">{intervention.suggestedAssignee.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">Evidence:</span>
                            <p className="mt-1">{intervention.evidenceBasis}</p>
                          </div>
                          <div>
                            <span className="font-medium text-muted-foreground">Expected Outcome:</span>
                            <p className="mt-1">{intervention.expectedOutcome}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-3" data-testid={`button-add-intervention-${i}`}>
                          Add to Care Plan
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimize" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Care Plan Optimization
              </CardTitle>
              <CardDescription>
                AI-powered analysis to improve care plan effectiveness
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => optimizeMutation.mutate()} 
                disabled={optimizeMutation.isPending}
                className="mb-4"
                data-testid="button-optimize-plan"
              >
                {optimizeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Analyze & Optimize
                  </>
                )}
              </Button>

              {optimization && (
                <div className="space-y-6">
                  {optimization.currentIssues.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Identified Issues
                      </h4>
                      <div className="space-y-3">
                        {optimization.currentIssues.map((issue, i) => (
                          <Card key={i} className="border-l-4" style={{ 
                            borderLeftColor: issue.severity === "high" ? "#ef4444" : issue.severity === "medium" ? "#eab308" : "#22c55e" 
                          }}>
                            <CardContent className="pt-4">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <Badge className={severityColors[issue.severity]} variant="outline">
                                    {issue.severity}
                                  </Badge>
                                  <Badge variant="outline" className="ml-2 capitalize">{issue.type}</Badge>
                                </div>
                              </div>
                              <p className="mt-2 font-medium">{issue.description}</p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-medium">Recommendation:</span> {issue.recommendation}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {optimization.predictedOutcome.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        Predicted Outcomes
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {optimization.predictedOutcome.map((outcome, i) => (
                          <Card key={i}>
                            <CardContent className="pt-4">
                              <h5 className="font-medium mb-3">{outcome.metric}</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Current Trajectory:</span>
                                  <span className="text-yellow-600">{outcome.currentTrajectory}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Optimized Trajectory:</span>
                                  <span className="text-green-600">{outcome.optimizedTrajectory}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                AI Progress Summary
              </CardTitle>
              <CardDescription>
                Comprehensive AI-generated summary of care plan progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => progressMutation.mutate()} 
                disabled={progressMutation.isPending}
                className="mb-4"
                data-testid="button-generate-summary"
              >
                {progressMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>

              {progressSummary && (
                <div className="space-y-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Overall Progress</h4>
                      <span className="text-2xl font-bold">{progressSummary.overallProgress}%</span>
                    </div>
                    <Progress value={progressSummary.overallProgress} className="h-3" />
                  </div>

                  <div>
                    <p className="text-muted-foreground">{progressSummary.summary}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {progressSummary.keyAchievements.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Key Achievements
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {progressSummary.keyAchievements.map((a, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-green-500" />
                                {a}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {progressSummary.areasOfConcern.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Areas of Concern
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {progressSummary.areasOfConcern.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <ChevronRight className="h-4 w-4 mt-0.5 text-yellow-500" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {progressSummary.nextSteps.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-blue-500" />
                          Recommended Next Steps
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {progressSummary.nextSteps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-ai-care-plan-disclaimer" />
    </div>
  );
}