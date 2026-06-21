import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Activity,
  Watch,
  Hospital,
  MessageSquare,
  TrendingUp,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
  Sparkles,
  Target,
  Shield,
  Zap,
  Home,
  Clock,
  Pill,
  Lightbulb,
  Users,
  Plus,
  Trash2,
} from "lucide-react";
import type { HealthGoal, InsertHealthGoal, HealthGoalCategory } from "@shared/schema";

const ONBOARDING_STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles, minutes: 0.5 },
  { id: "location", title: "Find Portals", icon: Target, minutes: 1 },
  { id: "data-sources", title: "Connect Data", icon: Hospital, minutes: 2 },
  { id: "tutorial", title: "App Tour", icon: Home, minutes: 1 },
  { id: "goals", title: "Health Goals", icon: Target, minutes: 1 },
];

const zipToRegion: Record<string, string> = {
  "0": "Northeast", "1": "Northeast", "2": "Southeast",
  "3": "Southeast", "4": "Midwest", "5": "Midwest",
  "6": "Midwest", "7": "Southwest", "8": "Southwest", "9": "West",
};

const healthSystemsByRegion: Record<string, { name: string; id: string; popular: boolean }[]> = {
  "Northeast": [
    { id: "mass-general", name: "Mass General Brigham", popular: true },
    { id: "mount-sinai", name: "Mount Sinai", popular: false },
    { id: "nyu-langone", name: "NYU Langone", popular: true },
    { id: "upenn-health", name: "Penn Medicine", popular: false },
  ],
  "Southeast": [
    { id: "duke-health", name: "Duke Health", popular: true },
    { id: "emory-healthcare", name: "Emory Healthcare", popular: false },
    { id: "johns-hopkins", name: "Johns Hopkins", popular: true },
  ],
  "Midwest": [
    { id: "cleveland-clinic", name: "Cleveland Clinic", popular: true },
    { id: "mayo-clinic", name: "Mayo Clinic", popular: true },
    { id: "northwestern", name: "Northwestern Medicine", popular: false },
  ],
  "Southwest": [
    { id: "banner-health", name: "Banner Health", popular: true },
    { id: "ut-southwestern", name: "UT Southwestern", popular: false },
    { id: "texas-health", name: "Texas Health Resources", popular: false },
  ],
  "West": [
    { id: "kaiser-permanente", name: "Kaiser Permanente", popular: true },
    { id: "cedars-sinai", name: "Cedars-Sinai", popular: true },
    { id: "stanford-health", name: "Stanford Health Care", popular: false },
    { id: "uchealth", name: "UC Health", popular: false },
  ],
};

const emailDomainToSystem: Record<string, string> = {
  "kaiser": "kaiser-permanente",
  "stanfordhealthcare": "stanford-health",
  "mayoclinic": "mayo-clinic",
  "clevelandclinic": "cleveland-clinic",
  "duke": "duke-health",
  "massgeneral": "mass-general",
  "mgh": "mass-general",
  "nyu": "nyu-langone",
  "mountsinai": "mount-sinai",
  "cedars": "cedars-sinai",
  "northwestern": "northwestern",
  "pennmedicine": "upenn-health",
  "jhmi": "johns-hopkins",
  "jhu": "johns-hopkins",
};

const healthGoalCategories: { value: HealthGoalCategory; label: string; icon: typeof Heart; description: string }[] = [
  { value: "weight", label: "Weight Management", icon: Activity, description: "Track and manage your weight goals" },
  { value: "exercise", label: "Exercise & Fitness", icon: Activity, description: "Stay active and build strength" },
  { value: "nutrition", label: "Nutrition", icon: Heart, description: "Eat healthier and track your diet" },
  { value: "medication", label: "Medication Adherence", icon: Pill, description: "Never miss a dose" },
  { value: "mental_health", label: "Mental Wellness", icon: Sparkles, description: "Manage stress and improve wellbeing" },
  { value: "sleep", label: "Sleep Quality", icon: Clock, description: "Get better rest every night" },
  { value: "other", label: "Other Goals", icon: Target, description: "Custom health objectives" },
];

interface GoalDraft {
  id: string;
  category: HealthGoalCategory;
  title: string;
  description: string;
  targetValue: string;
  unit: string;
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [zipCode, setZipCode] = useState("");
  const [email, setEmail] = useState("");
  const [detectedRegion, setDetectedRegion] = useState("");
  const [detectedSystems, setDetectedSystems] = useState<{ name: string; id: string; popular: boolean; detected: boolean }[]>([]);
  const [newGoal, setNewGoal] = useState<GoalDraft>({
    id: "",
    category: "exercise",
    title: "",
    description: "",
    targetValue: "",
    unit: "",
  });

  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100;
  const totalMinutes = ONBOARDING_STEPS.reduce((sum, s) => sum + s.minutes, 0);
  const completedMinutes = ONBOARDING_STEPS.slice(0, currentStep).reduce((sum, s) => sum + s.minutes, 0);
  const remainingMinutes = Math.ceil(totalMinutes - completedMinutes);

  useEffect(() => {
    if (zipCode.length >= 1) {
      const region = zipToRegion[zipCode[0]] || "West";
      setDetectedRegion(region);
      
      const regional = healthSystemsByRegion[region] || [];
      const emailDomain = email.split("@")[1]?.toLowerCase() || "";
      
      let detectedSystemId = "";
      for (const [key, sysId] of Object.entries(emailDomainToSystem)) {
        if (emailDomain.includes(key)) {
          detectedSystemId = sysId;
          break;
        }
      }
      
      const systems = regional.map(sys => ({
        ...sys,
        detected: sys.id === detectedSystemId,
      }));
      
      systems.sort((a, b) => {
        if (a.detected && !b.detected) return -1;
        if (!a.detected && b.detected) return 1;
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return 0;
      });
      
      setDetectedSystems(systems);
    }
  }, [zipCode, email]);

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: { completedSteps: string[]; goals: GoalDraft[] }) => {
      return apiRequest("POST", "/api/onboarding/complete", data);
    },
    onSuccess: () => {
      toast({
        title: "Welcome aboard!",
        description: "Your account is set up and ready to go.",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Setup complete",
        description: "Redirecting to your dashboard...",
      });
      setLocation("/");
    },
  });

  const handleNext = () => {
    const currentStepId = ONBOARDING_STEPS[currentStep].id;
    if (!completedSteps.includes(currentStepId)) {
      setCompletedSteps([...completedSteps, currentStepId]);
    }
    
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const allSteps = ONBOARDING_STEPS.map(s => s.id);
    completeOnboardingMutation.mutate({ 
      completedSteps: allSteps, 
      goals 
    });
  };

  const handleSkip = () => {
    toast({
      title: "Skipped for now",
      description: "You can always set up this section later in Settings.",
    });
    handleNext();
  };

  const addGoal = () => {
    if (!newGoal.title.trim()) {
      toast({
        title: "Please enter a goal title",
        variant: "destructive",
      });
      return;
    }
    
    setGoals([...goals, { ...newGoal, id: Date.now().toString() }]);
    setNewGoal({
      id: "",
      category: "exercise",
      title: "",
      description: "",
      targetValue: "",
      unit: "",
    });
    setShowAddGoal(false);
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
  };

  const renderStep = () => {
    switch (ONBOARDING_STEPS[currentStep].id) {
      case "welcome":
        return <WelcomeStep onNext={handleNext} />;
      case "location":
        return (
          <LocationStep
            zipCode={zipCode}
            email={email}
            detectedRegion={detectedRegion}
            detectedSystems={detectedSystems}
            onZipChange={setZipCode}
            onEmailChange={setEmail}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        );
      case "data-sources":
        return <DataSourcesStep onNext={handleNext} onSkip={handleSkip} detectedSystems={detectedSystems} />;
      case "tutorial":
        return <TutorialStep onNext={handleNext} />;
      case "goals":
        return (
          <GoalsStep
            goals={goals}
            showAddGoal={showAddGoal}
            newGoal={newGoal}
            onAddGoal={addGoal}
            onRemoveGoal={removeGoal}
            onNewGoalChange={setNewGoal}
            onShowAddGoal={setShowAddGoal}
            onComplete={handleComplete}
            isSubmitting={completeOnboardingMutation.isPending}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Tabula Medica</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/")}
          data-testid="button-skip-onboarding"
        >
          Skip Setup
        </Button>
      </header>

      <div className="px-4 py-2">
        <Progress value={progress} className="h-2" data-testid="progress-onboarding" />
        <div className="flex justify-between mt-2">
          {ONBOARDING_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = index === currentStep;
            
            return (
              <div 
                key={step.id}
                className={`flex flex-col items-center gap-1 ${
                  isCurrent ? "text-primary" : isCompleted ? "text-primary/60" : "text-muted-foreground"
                }`}
                data-testid={`step-indicator-${step.id}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCurrent ? "border-primary bg-primary/10" : 
                  isCompleted ? "border-primary/60 bg-primary/5" : "border-muted"
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[10px] font-medium hidden sm:block">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="flex-1 p-4 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="p-4 border-t bg-background/80 backdrop-blur">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
            data-testid="button-onboarding-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Step {currentStep + 1} of {ONBOARDING_STEPS.length}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {remainingMinutes} min left
            </span>
          </div>
          
          {currentStep < ONBOARDING_STEPS.length - 1 ? (
            <Button onClick={handleNext} data-testid="button-onboarding-next">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleComplete} 
              disabled={completeOnboardingMutation.isPending}
              data-testid="button-onboarding-complete"
            >
              {completeOnboardingMutation.isPending ? "Setting up..." : "Get Started"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function LocationStep({
  zipCode,
  email,
  detectedRegion,
  detectedSystems,
  onZipChange,
  onEmailChange,
  onNext,
  onSkip,
}: {
  zipCode: string;
  email: string;
  detectedRegion: string;
  detectedSystems: { name: string; id: string; popular: boolean; detected: boolean }[];
  onZipChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6" data-testid="step-location">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Find Your Health Systems</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Enter your ZIP code to auto-detect nearby hospitals and clinics
        </p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              ZIP Code
            </Label>
            <Input
              id="zip"
              placeholder="Enter your ZIP code"
              value={zipCode}
              onChange={(e) => onZipChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
              className="text-lg"
              data-testid="input-zip-code"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Hospital className="h-4 w-4" />
              Email (optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              data-testid="input-email"
            />
            <p className="text-xs text-muted-foreground">
              If you use a health system email, we can auto-detect your portals
            </p>
          </div>

          {detectedRegion && (
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Region: {detectedRegion}</span>
              </div>
              {detectedSystems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Health systems found:</p>
                  <div className="flex flex-wrap gap-2">
                    {detectedSystems.slice(0, 4).map((sys) => (
                      <Badge 
                        key={sys.id} 
                        variant={sys.detected ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {sys.detected && <Zap className="h-3 w-3 mr-1" />}
                        {sys.name}
                      </Badge>
                    ))}
                    {detectedSystems.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{detectedSystems.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center gap-4">
        <Button variant="ghost" onClick={onSkip} data-testid="button-skip-location">
          Skip for Now
        </Button>
        <Button onClick={onNext} disabled={zipCode.length < 1} data-testid="button-continue-location">
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6 py-8" data-testid="step-welcome">
      <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Heart className="h-10 w-10 text-primary" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome to Tabula Medica</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Your personal health companion that brings all your medical records together in one secure place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-left max-w-xl mx-auto pt-4">
        <Card className="hover-elevate" data-testid="feature-unified-records">
          <CardContent className="pt-4">
            <Shield className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Unified Records</h3>
            <p className="text-sm text-muted-foreground">
              All your health data from different providers in one view
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate" data-testid="feature-ai-insights">
          <CardContent className="pt-4">
            <Sparkles className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">AI Insights</h3>
            <p className="text-sm text-muted-foreground">
              Plain-English explanations of your medical information
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate" data-testid="feature-secure">
          <CardContent className="pt-4">
            <Zap className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold mb-1">Always Secure</h3>
            <p className="text-sm text-muted-foreground">
              HIPAA-compliant with you in control of your data
            </p>
          </CardContent>
        </Card>
      </div>

      <Button size="lg" onClick={onNext} className="mt-6" data-testid="button-get-started">
        Let's Get Started
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

function DataSourcesStep({ 
  onNext, 
  onSkip, 
  detectedSystems 
}: { 
  onNext: () => void; 
  onSkip: () => void;
  detectedSystems: { name: string; id: string; popular: boolean; detected: boolean }[];
}) {
  const [, setLocation] = useLocation();

  const commonPortals = [
    { name: "Fasten Health", id: "fasten-health", icon: Hospital, connected: false, popular: true, detected: false, isCommon: true },
    { name: "Medicare Blue Button", id: "medicare", icon: Shield, connected: false, popular: false, detected: false, isCommon: true },
  ];
  
  const regionalSystems = detectedSystems
    .filter(sys => !commonPortals.find(p => p.id === sys.id))
    .map(sys => ({ 
      name: sys.name, 
      id: sys.id,
      icon: Hospital, 
      connected: false, 
      popular: sys.popular, 
      detected: sys.detected,
      isCommon: false,
    }));
  
  const allEhrSources = [
    ...regionalSystems.filter(s => s.detected),
    ...commonPortals,
    ...regionalSystems.filter(s => !s.detected),
  ];

  const wearableSources = [
    { name: "Apple Health", icon: Watch, connected: false, popular: true },
    { name: "Fitbit", icon: Activity, connected: false, popular: true },
    { name: "Garmin", icon: Watch, connected: false, popular: false },
    { name: "Oura Ring", icon: Activity, connected: false, popular: false },
  ];

  const handleConnectSource = () => {
    setLocation("/connections");
  };

  return (
    <div className="space-y-6" data-testid="step-data-sources">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Connect Your Health Data</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Link your medical records and wearable devices to get a complete picture of your health.
        </p>
      </div>

      <Card data-testid="card-ehr-sources">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hospital className="h-5 w-5" />
            Electronic Health Records
          </CardTitle>
          <CardDescription>
            Connect to your healthcare providers to sync your medical records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {allEhrSources.map((source) => (
            <div 
              key={source.name}
              className={`flex items-center justify-between p-3 rounded-lg border hover-elevate ${source.detected ? "ring-2 ring-primary" : ""}`}
              data-testid={`source-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <source.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {source.name}
                    {source.detected && (
                      <Badge variant="default" className="text-[10px]">
                        <Zap className="h-2 w-2 mr-1" />
                        Detected
                      </Badge>
                    )}
                    {!source.detected && source.popular && (
                      <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {source.isCommon ? "Common Portal" : "FHIR R4 Compatible"}
                  </div>
                </div>
              </div>
              <Button 
                size="sm"
                onClick={handleConnectSource}
                data-testid={`button-connect-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {source.detected ? "One-Tap Connect" : "Connect"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="card-wearable-sources">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Watch className="h-5 w-5" />
            Wearable Devices
          </CardTitle>
          <CardDescription>
            Sync fitness and health data from your wearable devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {wearableSources.map((source) => (
            <div 
              key={source.name}
              className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
              data-testid={`source-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <source.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {source.name}
                    {source.popular && (
                      <Badge variant="secondary" className="text-[10px]">Popular</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Real-time sync</div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleConnectSource}
                data-testid={`button-connect-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                Connect
              </Button>
            </div>
          ))}
        </CardContent>
        <CardFooter className="pt-0">
          <p className="text-xs text-muted-foreground">
            You can connect more sources anytime from the Data Sources page.
          </p>
        </CardFooter>
      </Card>

      <div className="flex justify-center gap-4">
        <Button variant="ghost" onClick={onSkip} data-testid="button-skip-connections">
          Skip for Now
        </Button>
        <Button onClick={onNext} data-testid="button-continue-connections">
          Continue
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function TutorialStep({ onNext }: { onNext: () => void }) {
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: Home,
      description: "Your health overview at a glance. See recent activity, upcoming appointments, and health alerts.",
      path: "/",
    },
    {
      id: "timeline",
      title: "Health Timeline",
      icon: Clock,
      description: "A chronological view of all your health events, from doctor visits to lab results.",
      path: "/timeline",
    },
    {
      id: "medications",
      title: "Medication Manager",
      icon: Pill,
      description: "Track all your medications, set reminders, and get drug interaction alerts.",
      path: "/medications",
    },
    {
      id: "messages",
      title: "Secure Messaging",
      icon: MessageSquare,
      description: "Communicate securely with your healthcare providers. Ask questions and get answers.",
      path: "/messages",
    },
    {
      id: "insights",
      title: "Health Insights",
      icon: Lightbulb,
      description: "AI-powered analysis of your health data with personalized recommendations.",
      path: "/insights",
    },
    {
      id: "caregivers",
      title: "Caregiver Access",
      icon: Users,
      description: "Share your health information with family members and caregivers you trust.",
      path: "/caregivers",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [features.length]);

  return (
    <div className="space-y-6" data-testid="step-tutorial">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Explore Your Health Hub</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Here's a quick tour of the main features available to you.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          const isActive = index === activeFeature;
          
          return (
            <Card 
              key={feature.id}
              className={`cursor-pointer transition-all ${
                isActive ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setActiveFeature(index)}
              data-testid={`tutorial-feature-${feature.id}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/10"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h4 className="font-medium">Pro Tip: Voice Commands</h4>
              <p className="text-sm text-muted-foreground">
                Use the microphone button to navigate and ask questions using your voice in any language.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={onNext} data-testid="button-continue-tutorial">
          Got It, Let's Set Goals
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function GoalsStep({
  goals,
  showAddGoal,
  newGoal,
  onAddGoal,
  onRemoveGoal,
  onNewGoalChange,
  onShowAddGoal,
  onComplete,
  isSubmitting,
}: {
  goals: GoalDraft[];
  showAddGoal: boolean;
  newGoal: GoalDraft;
  onAddGoal: () => void;
  onRemoveGoal: (id: string) => void;
  onNewGoalChange: (goal: GoalDraft) => void;
  onShowAddGoal: (show: boolean) => void;
  onComplete: () => void;
  isSubmitting: boolean;
}) {
  const suggestedGoals: GoalDraft[] = [
    {
      id: "suggested-1",
      category: "exercise",
      title: "Walk 10,000 steps daily",
      description: "Stay active by walking more every day",
      targetValue: "10000",
      unit: "steps",
    },
    {
      id: "suggested-2",
      category: "medication",
      title: "Take medications on time",
      description: "Never miss a dose of your prescribed medications",
      targetValue: "100",
      unit: "% adherence",
    },
    {
      id: "suggested-3",
      category: "sleep",
      title: "Sleep 7-8 hours nightly",
      description: "Improve your sleep quality and duration",
      targetValue: "7.5",
      unit: "hours",
    },
  ];

  const addSuggestedGoal = (goal: GoalDraft) => {
    const exists = goals.some(g => g.title === goal.title);
    if (!exists) {
      onNewGoalChange({ ...goal, id: Date.now().toString() });
      onShowAddGoal(false);
      const updatedGoals = [...goals, { ...goal, id: Date.now().toString() }];
    }
  };

  return (
    <div className="space-y-6" data-testid="step-goals">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Set Your Health Goals</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          What would you like to focus on? We'll help you track progress and stay motivated.
        </p>
      </div>

      {goals.length > 0 && (
        <Card data-testid="card-my-goals">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              My Goals ({goals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {goals.map((goal) => {
              const category = healthGoalCategories.find(c => c.value === goal.category);
              const Icon = category?.icon || Target;
              
              return (
                <div 
                  key={goal.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`goal-item-${goal.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{goal.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {goal.targetValue && `Target: ${goal.targetValue} ${goal.unit}`}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onRemoveGoal(goal.id)}
                    data-testid={`button-remove-goal-${goal.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!showAddGoal && (
        <Card data-testid="card-suggested-goals">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Suggested Goals
            </CardTitle>
            <CardDescription>
              Quick-add popular health goals or create your own
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestedGoals.map((goal) => {
              const category = healthGoalCategories.find(c => c.value === goal.category);
              const Icon = category?.icon || Target;
              const isAdded = goals.some(g => g.title === goal.title);
              
              return (
                <div 
                  key={goal.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                  data-testid={`suggested-goal-${goal.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{goal.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{goal.description}</div>
                    </div>
                  </div>
                  <Button 
                    variant={isAdded ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (!isAdded) {
                        const newId = Date.now().toString();
                        onNewGoalChange({ ...goal, id: newId });
                        onAddGoal();
                      }
                    }}
                    disabled={isAdded}
                    data-testid={`button-add-suggested-${goal.id}`}
                  >
                    {isAdded ? "Added" : "Add"}
                    {!isAdded && <Plus className="h-3 w-3 ml-1" />}
                  </Button>
                </div>
              );
            })}
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => onShowAddGoal(true)}
              data-testid="button-create-custom-goal"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Goal
            </Button>
          </CardFooter>
        </Card>
      )}

      {showAddGoal && (
        <Card data-testid="card-add-goal-form">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Create a Goal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-category">Category</Label>
              <Select
                value={newGoal.category}
                onValueChange={(value) => onNewGoalChange({ ...newGoal, category: value as HealthGoalCategory })}
              >
                <SelectTrigger id="goal-category" data-testid="select-goal-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {healthGoalCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title</Label>
              <Input
                id="goal-title"
                placeholder="e.g., Exercise 3 times a week"
                value={newGoal.title}
                onChange={(e) => onNewGoalChange({ ...newGoal, title: e.target.value })}
                data-testid="input-goal-title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="goal-description">Description (optional)</Label>
              <Textarea
                id="goal-description"
                placeholder="Describe your goal..."
                value={newGoal.description}
                onChange={(e) => onNewGoalChange({ ...newGoal, description: e.target.value })}
                className="resize-none"
                rows={2}
                data-testid="input-goal-description"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal-target">Target Value</Label>
                <Input
                  id="goal-target"
                  placeholder="e.g., 10000"
                  value={newGoal.targetValue}
                  onChange={(e) => onNewGoalChange({ ...newGoal, targetValue: e.target.value })}
                  data-testid="input-goal-target"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-unit">Unit</Label>
                <Input
                  id="goal-unit"
                  placeholder="e.g., steps"
                  value={newGoal.unit}
                  onChange={(e) => onNewGoalChange({ ...newGoal, unit: e.target.value })}
                  data-testid="input-goal-unit"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="gap-2 flex-wrap">
            <Button 
              variant="ghost" 
              onClick={() => onShowAddGoal(false)}
              data-testid="button-cancel-goal"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newGoal.title.trim()) {
                  onAddGoal();
                }
              }}
              data-testid="button-save-goal"
            >
              Add Goal
              <Plus className="h-4 w-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="text-center pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          {goals.length === 0 
            ? "You can add goals now or skip and set them up later."
            : `Great! You've set ${goals.length} goal${goals.length > 1 ? 's' : ''}.`
          }
        </p>
        <Button 
          size="lg" 
          onClick={onComplete}
          disabled={isSubmitting}
          data-testid="button-finish-onboarding"
        >
          {isSubmitting ? "Setting up..." : "Complete Setup"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
