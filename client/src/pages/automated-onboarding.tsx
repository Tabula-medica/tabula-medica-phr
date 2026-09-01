import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Heart,
  User,
  FileText,
  Pill,
  AlertTriangle,
  Shield,
  Activity,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  Plus,
  X,
  MapPin,
  Target,
  TrendingUp,
  Stethoscope,
  Folder,
  Clock,
  ArrowRight,
  Info,
  Star,
  Map,
  Clipboard,
} from "lucide-react";

interface PersonalizedWelcome {
  greeting: string;
  introduction: string;
  keyBenefits: string[];
  recommendedActions: string[];
  healthFocusAreas: string[];
  estimatedTime: string;
  motivationalMessage: string;
  generatedAt: string;
}

interface FeatureIntroduction {
  featureId: string;
  name: string;
  description: string;
  benefits: string[];
  icon: string;
  relevanceScore: number;
  personalizedTip?: string;
  quickStartAction: string;
  learnMoreUrl: string;
}

interface HealthConcern {
  area: string;
  level: "low" | "moderate" | "elevated" | "high";
  factors: string[];
  explanation: string;
}

interface HealthRecommendation {
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actionableSteps: string[];
  relatedFeature?: string;
}

interface InitialHealthAssessment {
  id: string;
  userId: string;
  overallRiskLevel: "low" | "moderate" | "elevated" | "high";
  riskScore: number;
  primaryConcerns: HealthConcern[];
  recommendations: HealthRecommendation[];
  screeningsNeeded: { name: string; reason: string; frequency: string; dueStatus: string }[];
  lifestyleFactors: { category: string; currentStatus: string; impact: string; suggestion?: string }[];
  disclaimers: string[];
  generatedAt: string;
}

interface OnboardingWorkflowState {
  sessionId: string;
  userId: string;
  currentStep: string;
  completedSteps: string[];
  stepData: Record<string, any>;
  startedAt: string;
  updatedAt: string;
  isComplete: boolean;
}

type StepId = "welcome" | "demographics" | "health_history" | "lifestyle" | "health_assessment" | "feature_tour" | "goals" | "complete";

const STEPS: { id: StepId; title: string; icon: typeof Heart }[] = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "demographics", title: "About You", icon: User },
  { id: "health_history", title: "Health History", icon: FileText },
  { id: "lifestyle", title: "Lifestyle", icon: Activity },
  { id: "health_assessment", title: "Health Assessment", icon: ClipboardCheck },
  { id: "feature_tour", title: "Your Features", icon: Star },
  { id: "goals", title: "Set Goals", icon: Target },
  { id: "complete", title: "Complete", icon: CheckCircle2 },
];

const featureIcons: Record<string, typeof Heart> = {
  map: Map,
  shield: Shield,
  clipboard: Clipboard,
  pill: Pill,
  folder: Folder,
  heart: Heart,
};

const riskLevelColors: Record<string, string> = {
  low: "bg-green-500",
  moderate: "bg-yellow-500",
  elevated: "bg-orange-500",
  high: "bg-red-500",
};

export default function AutomatedOnboarding() {
  useSEO({
    title: "Welcome to Tabula Medica - Get Started",
    description: "Complete your personalized onboarding to unlock your health management portal",
  });

  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [currentStep, setCurrentStep] = useState<StepId>("welcome");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<PersonalizedWelcome | null>(null);
  const [healthAssessment, setHealthAssessment] = useState<InitialHealthAssessment | null>(null);
  const [features, setFeatures] = useState<FeatureIntroduction[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    conditions: [] as string[],
    medications: [] as { name: string; dosage: string }[],
    allergies: [] as string[],
    familyHistory: [] as { condition: string; relation: string }[],
    lifestyle: {
      smokingStatus: "",
      alcoholUse: "",
      exerciseFrequency: "",
      sleepHours: 7,
      dietType: "",
      stressLevel: "",
    },
    goals: [] as { category: string; description: string }[],
  });

  const [newCondition, setNewCondition] = useState("");
  const [newMedication, setNewMedication] = useState({ name: "", dosage: "" });
  const [newAllergy, setNewAllergy] = useState("");
  const [newGoal, setNewGoal] = useState({ category: "", description: "" });

  const startWorkflowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/workflow/start", {});
      return res.json();
    },
    onSuccess: (data: OnboardingWorkflowState) => {
      setSessionId(data.sessionId);
    },
  });

  const generateWelcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/welcome/generate", formData);
      return res.json();
    },
    onSuccess: (data: PersonalizedWelcome) => {
      setWelcomeMessage(data);
    },
  });

  const generateAssessmentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/health-assessment/generate", formData);
      return res.json();
    },
    onSuccess: (data: InitialHealthAssessment) => {
      setHealthAssessment(data);
    },
  });

  const getFeaturesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/features/personalized", formData);
      return res.json();
    },
    onSuccess: (data: FeatureIntroduction[]) => {
      setFeatures(data);
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No session");
      const res = await apiRequest("POST", `/api/onboarding/workflow/complete/${sessionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Welcome to Tabula Medica!", description: "Your personalized health portal is ready." });
      navigate("/dashboard");
    },
  });

  useEffect(() => {
    startWorkflowMutation.mutate();
  }, []);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex].id;
      
      if (nextStep === "health_assessment" && !healthAssessment) {
        generateAssessmentMutation.mutate();
      }
      if (nextStep === "feature_tour" && features.length === 0) {
        getFeaturesMutation.mutate();
      }
      
      setCurrentStep(nextStep);
    }
  };

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const addCondition = () => {
    if (newCondition.trim()) {
      setFormData(prev => ({ ...prev, conditions: [...prev.conditions, newCondition.trim()] }));
      setNewCondition("");
    }
  };

  const addMedication = () => {
    if (newMedication.name.trim()) {
      setFormData(prev => ({ ...prev, medications: [...prev.medications, newMedication] }));
      setNewMedication({ name: "", dosage: "" });
    }
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData(prev => ({ ...prev, allergies: [...prev.allergies, newAllergy.trim()] }));
      setNewAllergy("");
    }
  };

  const addGoal = () => {
    if (newGoal.category && newGoal.description.trim()) {
      setFormData(prev => ({ ...prev, goals: [...prev.goals, newGoal] }));
      setNewGoal({ category: "", description: "" });
    }
  };

  const handleComplete = () => {
    completeOnboardingMutation.mutate();
  };

  const renderWelcomeStep = () => (
    <div className="space-y-6">
      {welcomeMessage ? (
        <>
          <div className="text-center mb-8">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-greeting">{welcomeMessage.greeting}</h1>
            <p className="text-muted-foreground text-lg">{welcomeMessage.introduction}</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                What You'll Get
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {welcomeMessage.keyBenefits.map((benefit, i) => (
                  <div key={i} className="flex items-start gap-3" data-testid={`benefit-${i}`}>
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Estimated time: <strong>{welcomeMessage.estimatedTime}</strong>
            </AlertDescription>
          </Alert>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <p className="italic text-center">"{welcomeMessage.motivationalMessage}"</p>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12">
          <div className="space-y-4">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Welcome to Tabula Medica</h1>
            <p className="text-muted-foreground">Let's personalize your experience. First, tell us your name.</p>
          </div>
          
          <div className="max-w-md mx-auto mt-8 space-y-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Your first name"
                data-testid="input-first-name"
              />
            </div>
            <Button 
              onClick={() => generateWelcomeMutation.mutate()} 
              disabled={!formData.firstName || generateWelcomeMutation.isPending}
              className="w-full"
              data-testid="button-generate-welcome"
            >
              {generateWelcomeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating your personalized welcome...
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderDemographicsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Tell Us About Yourself</h2>
        <p className="text-muted-foreground">This helps us personalize your health experience</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Your last name"
                data-testid="input-last-name"
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                data-testid="input-dob"
              />
            </div>
          </div>

          <div>
            <FieldCaption>Gender</FieldCaption>
            <RadioGroup
              value={formData.gender}
              onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
              className="flex flex-wrap gap-4 mt-2"
            >
              {["Male", "Female", "Non-binary", "Prefer not to say"].map(option => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.toLowerCase().replace(/ /g, "_")} id={option} />
                  <Label htmlFor={option} className="font-normal">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderHealthHistoryStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Your Health History</h2>
        <p className="text-muted-foreground">Add any conditions, medications, and allergies</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Health Conditions</CardTitle>
          <CardDescription>Any diagnosed conditions or chronic illnesses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              placeholder="e.g., Type 2 Diabetes, Hypertension"
              onKeyDown={(e) => e.key === "Enter" && addCondition()}
              data-testid="input-new-condition"
            />
            <Button onClick={addCondition} size="icon" data-testid="button-add-condition">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.conditions.map((condition, i) => (
              <Badge key={i} variant="secondary" className="gap-1" data-testid={`badge-condition-${i}`}>
                {condition}
                <button onClick={() => setFormData(prev => ({ ...prev, conditions: prev.conditions.filter((_, idx) => idx !== i) }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Medications</CardTitle>
          <CardDescription>Include prescriptions and regular supplements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newMedication.name}
              onChange={(e) => setNewMedication(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Medication name"
              className="flex-1"
              data-testid="input-medication-name"
            />
            <Input
              value={newMedication.dosage}
              onChange={(e) => setNewMedication(prev => ({ ...prev, dosage: e.target.value }))}
              placeholder="Dosage"
              className="w-32"
              data-testid="input-medication-dosage"
            />
            <Button onClick={addMedication} size="icon" data-testid="button-add-medication">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.medications.map((med, i) => (
              <Badge key={i} variant="secondary" className="gap-1" data-testid={`badge-medication-${i}`}>
                {med.name} {med.dosage && `(${med.dosage})`}
                <button onClick={() => setFormData(prev => ({ ...prev, medications: prev.medications.filter((_, idx) => idx !== i) }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Allergies</CardTitle>
          <CardDescription>Drug, food, or environmental allergies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newAllergy}
              onChange={(e) => setNewAllergy(e.target.value)}
              placeholder="e.g., Penicillin, Peanuts"
              onKeyDown={(e) => e.key === "Enter" && addAllergy()}
              data-testid="input-new-allergy"
            />
            <Button onClick={addAllergy} size="icon" data-testid="button-add-allergy">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.allergies.map((allergy, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-red-500/50 text-red-600" data-testid={`badge-allergy-${i}`}>
                <AlertTriangle className="h-3 w-3" />
                {allergy}
                <button onClick={() => setFormData(prev => ({ ...prev, allergies: prev.allergies.filter((_, idx) => idx !== i) }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLifestyleStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Your Lifestyle</h2>
        <p className="text-muted-foreground">Help us understand your daily habits</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="automated-onboarding-exercise-frequency">Exercise Frequency</Label>
            <Select
              value={formData.lifestyle.exerciseFrequency}
              onValueChange={(value) => setFormData(prev => ({ ...prev, lifestyle: { ...prev.lifestyle, exerciseFrequency: value } }))}
            >
              <SelectTrigger id="automated-onboarding-exercise-frequency" data-testid="select-exercise">
                <SelectValue placeholder="How often do you exercise?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Rarely or never</SelectItem>
                <SelectItem value="occasional">1-2 times per week</SelectItem>
                <SelectItem value="moderate">3-4 times per week</SelectItem>
                <SelectItem value="active">5+ times per week</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="automated-onboarding-sleep-hours-per-night">Sleep (hours per night)</Label>
            <Select
              value={formData.lifestyle.sleepHours?.toString() || "7"}
              onValueChange={(value) => setFormData(prev => ({ ...prev, lifestyle: { ...prev.lifestyle, sleepHours: parseInt(value) } }))}
            >
              <SelectTrigger id="automated-onboarding-sleep-hours-per-night" data-testid="select-sleep">
                <SelectValue placeholder="Average sleep hours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">Less than 6 hours</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="7">7 hours</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="9">9+ hours</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="automated-onboarding-smoking-status">Smoking Status</Label>
            <Select
              value={formData.lifestyle.smokingStatus}
              onValueChange={(value) => setFormData(prev => ({ ...prev, lifestyle: { ...prev.lifestyle, smokingStatus: value } }))}
            >
              <SelectTrigger id="automated-onboarding-smoking-status" data-testid="select-smoking">
                <SelectValue placeholder="Smoking status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never smoked</SelectItem>
                <SelectItem value="former">Former smoker</SelectItem>
                <SelectItem value="current">Current smoker</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <Label htmlFor="automated-onboarding-stress-level">Stress Level</Label>
            <Select
              value={formData.lifestyle.stressLevel}
              onValueChange={(value) => setFormData(prev => ({ ...prev, lifestyle: { ...prev.lifestyle, stressLevel: value } }))}
            >
              <SelectTrigger id="automated-onboarding-stress-level" data-testid="select-stress">
                <SelectValue placeholder="Your typical stress level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="very_high">Very High</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderHealthAssessmentStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Your Initial Health Assessment</h2>
        <p className="text-muted-foreground">Based on the information you provided</p>
      </div>

      {generateAssessmentMutation.isPending ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Analyzing your health profile...</p>
            <p className="text-muted-foreground">This may take a moment</p>
          </CardContent>
        </Card>
      ) : healthAssessment ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Overall Health Summary</CardTitle>
                <Badge className={`${riskLevelColors[healthAssessment.overallRiskLevel]} text-white`}>
                  {healthAssessment.overallRiskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Risk Score</span>
                    <span className="text-sm font-medium">{healthAssessment.riskScore}/100</span>
                  </div>
                  <Progress value={healthAssessment.riskScore} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {healthAssessment.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Personalized Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {healthAssessment.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-lg bg-muted/50" data-testid={`recommendation-${i}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        rec.priority === "high" ? "bg-red-500/10 text-red-500" :
                        rec.priority === "medium" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-blue-500/10 text-blue-500"
                      }`}>
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{rec.title}</h4>
                          <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        {rec.actionableSteps.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {rec.actionableSteps.map((step, j) => (
                              <li key={j} className="text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                {step}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Important Disclaimer</AlertTitle>
            <AlertDescription>
              {healthAssessment.disclaimers[0]}
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg">Click "Next" to generate your personalized health assessment</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderFeatureTourStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Features Made for You</h2>
        <p className="text-muted-foreground">Based on your profile, these features will be most helpful</p>
      </div>

      {getFeaturesMutation.isPending ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : features.length > 0 ? (
        <div className="grid gap-4">
          {features.slice(0, 4).map((feature, i) => {
            const IconComponent = featureIcons[feature.icon] || Star;
            return (
              <Card key={feature.featureId} className={i === 0 ? "border-primary" : ""} data-testid={`feature-card-${feature.featureId}`}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      i === 0 ? "bg-primary/10 text-primary" : "bg-muted"
                    }`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{feature.name}</h3>
                        {i === 0 && <Badge className="bg-primary">Top Pick</Badge>}
                        <Badge variant="outline">{feature.relevanceScore}% match</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                      {feature.personalizedTip && (
                        <p className="text-sm text-primary italic mb-2">{feature.personalizedTip}</p>
                      )}
                      <Button size="sm" variant="outline" onClick={() => navigate(feature.learnMoreUrl)}>
                        {feature.quickStartAction}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg">Loading personalized features...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderGoalsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Set Your Health Goals</h2>
        <p className="text-muted-foreground">What would you like to achieve?</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="automated-onboarding-goal-category">Goal Category</Label>
              <Select
                value={newGoal.category}
                onValueChange={(value) => setNewGoal(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="automated-onboarding-goal-category" data-testid="select-goal-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight">Weight Management</SelectItem>
                  <SelectItem value="exercise">Exercise & Fitness</SelectItem>
                  <SelectItem value="nutrition">Nutrition</SelectItem>
                  <SelectItem value="medication">Medication Adherence</SelectItem>
                  <SelectItem value="mental_health">Mental Wellness</SelectItem>
                  <SelectItem value="sleep">Sleep</SelectItem>
                  <SelectItem value="condition">Condition Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="automated-onboarding-goal-description">Goal Description</Label>
              <Input id="automated-onboarding-goal-description"
                value={newGoal.description}
                onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g., Walk 10,000 steps daily"
                data-testid="input-goal-description"
              />
            </div>
          </div>
          <Button onClick={addGoal} disabled={!newGoal.category || !newGoal.description} data-testid="button-add-goal">
            <Plus className="h-4 w-4 mr-2" />
            Add Goal
          </Button>
        </CardContent>
      </Card>

      {formData.goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formData.goals.map((goal, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`goal-${i}`}>
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{goal.description}</p>
                      <p className="text-sm text-muted-foreground capitalize">{goal.category.replace("_", " ")}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setFormData(prev => ({ ...prev, goals: prev.goals.filter((_, idx) => idx !== i) }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="text-center space-y-6 py-8">
      <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold mb-2">You're All Set!</h2>
        <p className="text-lg text-muted-foreground">
          Welcome to your personalized health portal, {formData.firstName}
        </p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">What's Next?</h3>
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <span>Explore your personalized dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <span>Connect your health records</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">3</span>
              </div>
              <span>Start tracking your health goals</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button size="lg" onClick={handleComplete} disabled={completeOnboardingMutation.isPending} data-testid="button-go-to-dashboard">
        {completeOnboardingMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Setting up your portal...
          </>
        ) : (
          <>
            Go to Your Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome": return renderWelcomeStep();
      case "demographics": return renderDemographicsStep();
      case "health_history": return renderHealthHistoryStep();
      case "lifestyle": return renderLifestyleStep();
      case "health_assessment": return renderHealthAssessmentStep();
      case "feature_tour": return renderFeatureTourStep();
      case "goals": return renderGoalsStep();
      case "complete": return renderCompleteStep();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {STEPS[currentStepIndex].title}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          
          <div className="flex justify-center gap-2 mt-4 overflow-x-auto pb-2">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              
              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors ${
                    isCompleted ? "bg-green-500 text-white" :
                    isCurrent ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
                  }`}
                  title={step.title}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-280px)]">
          {renderCurrentStep()}
        </ScrollArea>

        {currentStep !== "complete" && (
          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button
              variant="outline"
              onClick={goToPrevStep}
              disabled={currentStepIndex === 0}
              data-testid="button-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={goToNextStep}
              disabled={
                (currentStep === "welcome" && !welcomeMessage) ||
                generateAssessmentMutation.isPending ||
                getFeaturesMutation.isPending
              }
              data-testid="button-next"
            >
              {currentStepIndex === STEPS.length - 2 ? "Complete Setup" : "Continue"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
