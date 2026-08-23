import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Users,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Upload,
  Calendar,
  Heart,
  Activity,
  Scale,
  Pill,
  Moon,
  Droplet,
  Brain,
  Loader2,
  ArrowRight,
  Home,
  Link2,
} from "lucide-react";

type WizardStep = "welcome" | "profile" | "family" | "documents" | "goals" | "complete";

const STEP_CONFIG: Record<WizardStep, { title: string; description: string; icon: typeof User }> = {
  welcome: { title: "Welcome", description: "Let's get you set up", icon: Sparkles },
  profile: { title: "Your Profile", description: "Tell us about yourself", icon: User },
  family: { title: "Family Members", description: "Add family profiles (optional)", icon: Users },
  documents: { title: "Health Records", description: "Link your first documents", icon: FileText },
  goals: { title: "Health Goals", description: "Set your priorities", icon: Target },
  complete: { title: "All Set!", description: "You're ready to go", icon: CheckCircle2 },
};

const STEP_ORDER: WizardStep[] = ["welcome", "profile", "family", "documents", "goals", "complete"];

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  timezone: string;
  preferredLanguage: string;
}

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string;
}

interface HealthGoal {
  id: string;
  category: string;
  name: string;
  target: string;
  isSelected: boolean;
}

interface Preferences {
  notifications: {
    appointments: boolean;
    medications: boolean;
    results: boolean;
    goals: boolean;
  };
  accessibility: {
    largeText: boolean;
    highContrast: boolean;
    simplifiedView: boolean;
  };
}

const GOAL_TEMPLATES: HealthGoal[] = [
  { id: "1", category: "fitness", name: "Stay Active", target: "30 minutes of exercise daily", isSelected: false },
  { id: "2", category: "nutrition", name: "Eat Healthier", target: "5 servings of fruits/vegetables daily", isSelected: false },
  { id: "3", category: "weight", name: "Manage Weight", target: "Track weight weekly", isSelected: false },
  { id: "4", category: "sleep", name: "Better Sleep", target: "7-8 hours of sleep nightly", isSelected: false },
  { id: "5", category: "hydration", name: "Stay Hydrated", target: "8 glasses of water daily", isSelected: false },
  { id: "6", category: "medication", name: "Medication Adherence", target: "Take medications on schedule", isSelected: false },
  { id: "7", category: "mental", name: "Mental Wellness", target: "Practice mindfulness daily", isSelected: false },
  { id: "8", category: "checkups", name: "Regular Checkups", target: "Annual wellness visits", isSelected: false },
];

const GOAL_ICONS: Record<string, typeof Heart> = {
  fitness: Activity,
  nutrition: Heart,
  weight: Scale,
  sleep: Moon,
  hydration: Droplet,
  medication: Pill,
  mental: Brain,
  checkups: Calendar,
  custom: Target,
};

export default function GuidedOnboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome");
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  // Check if onboarding was already completed
  const savedOnboardingId = typeof window !== "undefined" ? localStorage.getItem("tabula_onboarding_id") : null;
  const isAlreadyComplete = typeof window !== "undefined" ? localStorage.getItem("tabula_onboarding_complete") === "true" : false;

  // Fetch saved onboarding data if exists
  const { data: savedOnboarding } = useQuery({
    queryKey: ["/api/guided-onboarding", savedOnboardingId],
    enabled: !!savedOnboardingId && isAlreadyComplete,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (savedOnboardingId) {
      setOnboardingId(savedOnboardingId);
    }
  }, [savedOnboardingId]);

  // Pre-populate from saved data if available
  useEffect(() => {
    const data = savedOnboarding as any;
    if (data?.profile) {
      setProfile(data.profile);
    }
    if (data?.familyMembers) {
      setFamilyMembers(data.familyMembers);
    }
    if (data?.documentActions) {
      setDocumentActions(data.documentActions);
    }
    if (data?.goals) {
      setGoals(prev => prev.map(g => ({
        ...g,
        isSelected: data.goals.some((sg: HealthGoal) => sg.id === g.id)
      })));
    }
  }, [savedOnboarding]);
  
  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    preferredLanguage: "en",
  });
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [documentActions, setDocumentActions] = useState<{ type: string; provider?: string }[]>([]);
  const [goals, setGoals] = useState<HealthGoal[]>(GOAL_TEMPLATES);
  const [customGoal, setCustomGoal] = useState({ name: "", target: "" });
  
  const [preferences, setPreferences] = useState<Preferences>({
    notifications: {
      appointments: true,
      medications: true,
      results: true,
      goals: true,
    },
    accessibility: {
      largeText: false,
      highContrast: false,
      simplifiedView: false,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/guided-onboarding/complete", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guided-onboarding/status"] });
      localStorage.setItem("tabula_onboarding_complete", "true");
      if (data?.onboardingId) {
        localStorage.setItem("tabula_onboarding_id", data.onboardingId);
        setOnboardingId(data.onboardingId);
      }
      toast({ title: "Setup Complete", description: "Your profile has been created successfully!" });
    },
    onError: () => {
      localStorage.setItem("tabula_onboarding_complete", "true");
      toast({ title: "Setup Complete", description: "Your profile has been saved locally." });
    },
  });

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = currentStep === "welcome" ? 0 : currentStep === "complete" ? 100 : ((currentStepIndex) / (STEP_ORDER.length - 1)) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "profile":
        return profile.firstName && profile.lastName && profile.dateOfBirth;
      case "family":
      case "documents":
      case "goals":
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      if (currentStep === "goals") {
        saveMutation.mutate({
          profile,
          familyMembers,
          documentActions,
          goals: goals.filter(g => g.isSelected),
          preferences,
        });
      }
      setCurrentStep(STEP_ORDER[nextIndex]);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, {
      id: Date.now().toString(),
      firstName: "",
      lastName: "",
      relationship: "",
      dateOfBirth: "",
    }]);
  };

  const updateFamilyMember = (id: string, field: keyof FamilyMember, value: string) => {
    setFamilyMembers(familyMembers.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const removeFamilyMember = (id: string) => {
    setFamilyMembers(familyMembers.filter(m => m.id !== id));
  };

  const toggleGoal = (id: string) => {
    setGoals(goals.map(g => 
      g.id === id ? { ...g, isSelected: !g.isSelected } : g
    ));
  };

  const addCustomGoal = () => {
    if (customGoal.name && customGoal.target) {
      setGoals([...goals, {
        id: Date.now().toString(),
        category: "custom",
        name: customGoal.name,
        target: customGoal.target,
        isSelected: true,
      }]);
      setCustomGoal({ name: "", target: "" });
    }
  };

  const StepIcon = STEP_CONFIG[currentStep].icon;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="guided-onboarding-page">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-full">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="wizard-title">Welcome to Tabula Medica</h1>
            <p className="text-muted-foreground">Let's set up your health profile</p>
          </div>
        </div>

        {isAlreadyComplete && currentStep === "welcome" && (
          <Alert className="mb-4 border-primary/50 bg-primary/5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
              <span>You've already completed the setup wizard. You can update your information below.</span>
              <Link href="/patient-dashboard">
                <Button variant="outline" size="sm" data-testid="button-go-to-dashboard-banner">
                  Go to Dashboard
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {currentStep !== "welcome" && currentStep !== "complete" && (
          <div className="flex items-center gap-2 mb-4">
            {STEP_ORDER.slice(1, -1).map((step, index) => {
              const stepIndex = index + 1;
              const isCompleted = currentStepIndex > stepIndex;
              const isCurrent = step === currentStep;
              const Icon = STEP_CONFIG[step].icon;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted ? "bg-primary border-primary text-primary-foreground" :
                    isCurrent ? "border-primary text-primary" :
                    "border-muted text-muted-foreground"
                  }`} data-testid={`step-indicator-${step}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  {index < 3 && (
                    <div className={`flex-1 h-1 mx-2 rounded ${
                      isCompleted ? "bg-primary" : "bg-muted"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle data-testid="step-title">{STEP_CONFIG[currentStep].title}</CardTitle>
                  <CardDescription>{STEP_CONFIG[currentStep].description}</CardDescription>
                </div>
              </div>
              {currentStep !== "welcome" && currentStep !== "complete" && (
                <Badge variant="outline" data-testid="step-badge">
                  Step {currentStepIndex} of {STEP_ORDER.length - 2}
                </Badge>
              )}
            </div>
            {currentStep !== "welcome" && currentStep !== "complete" && (
              <Progress value={progress} className="mt-4" data-testid="wizard-progress" />
            )}
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <ScrollArea className="min-h-[400px] max-h-[500px]">
              {currentStep === "welcome" && <WelcomeStep />}
              {currentStep === "profile" && (
                <ProfileStep profile={profile} setProfile={setProfile} />
              )}
              {currentStep === "family" && (
                <FamilyStep 
                  members={familyMembers}
                  onAdd={addFamilyMember}
                  onUpdate={updateFamilyMember}
                  onRemove={removeFamilyMember}
                />
              )}
              {currentStep === "documents" && (
                <DocumentsStep 
                  documentActions={documentActions}
                  setDocumentActions={setDocumentActions}
                />
              )}
              {currentStep === "goals" && (
                <GoalsStep 
                  goals={goals}
                  onToggle={toggleGoal}
                  customGoal={customGoal}
                  setCustomGoal={setCustomGoal}
                  onAddCustom={addCustomGoal}
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
              )}
              {currentStep === "complete" && (
                <CompleteStep 
                  profile={profile}
                  familyCount={familyMembers.length}
                  documentActionCount={documentActions.length}
                  goalCount={goals.filter(g => g.isSelected).length}
                />
              )}
            </ScrollArea>
          </CardContent>

          <Separator />

          <CardFooter className="flex justify-between gap-4 pt-4 flex-wrap">
            {currentStep !== "welcome" && currentStep !== "complete" ? (
              <Button variant="outline" onClick={goToPreviousStep} data-testid="button-previous">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}
            
            {currentStep === "complete" ? (
              <Link href="/patient-dashboard">
                <Button data-testid="button-go-dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Button 
                onClick={goToNextStep} 
                disabled={!canProceed() || saveMutation.isPending}
                data-testid="button-next"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {currentStep === "welcome" ? "Get Started" : currentStep === "goals" ? "Complete Setup" : "Continue"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-6 py-4" data-testid="welcome-content">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">Welcome to Your Health Journey</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          This quick setup will help you create your health profile, add family members, 
          link your medical records, and set personal health goals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-8">
        {[
          { icon: User, title: "Create Your Profile", desc: "Personal health information" },
          { icon: Users, title: "Add Family Members", desc: "Manage family health profiles" },
          { icon: FileText, title: "Link Health Records", desc: "Connect your medical documents" },
          { icon: Target, title: "Set Health Goals", desc: "Track what matters to you" },
        ].map((item, i) => (
          <Card key={i} className="hover-elevate">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="p-2 bg-primary/10 rounded-lg">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert className="mt-6">
        <CheckCircle2 className="w-4 h-4" />
        <AlertDescription>
          This setup takes about 5-10 minutes. You can skip optional sections and complete them later.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ProfileStep({ 
  profile, 
  setProfile 
}: { 
  profile: ProfileData; 
  setProfile: (p: ProfileData) => void;
}) {
  return (
    <div className="space-y-6" data-testid="profile-content">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input 
            id="firstName"
            value={profile.firstName}
            onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
            placeholder="Enter your first name"
            data-testid="input-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input 
            id="lastName"
            value={profile.lastName}
            onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
            placeholder="Enter your last name"
            data-testid="input-last-name"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input 
            id="dateOfBirth"
            type="date"
            value={profile.dateOfBirth}
            onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
            data-testid="input-date-of-birth"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
            <SelectTrigger id="gender" data-testid="select-gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input 
            id="email"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            placeholder="your.email@example.com"
            data-testid="input-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="(555) 123-4567"
            data-testid="input-phone"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="language">Preferred Language</Label>
          <Select value={profile.preferredLanguage} onValueChange={(v) => setProfile({ ...profile, preferredLanguage: v })}>
            <SelectTrigger id="language" data-testid="select-language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="zh">Chinese</SelectItem>
              <SelectItem value="vi">Vietnamese</SelectItem>
              <SelectItem value="ko">Korean</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select value={profile.timezone} onValueChange={(v) => setProfile({ ...profile, timezone: v })}>
            <SelectTrigger id="timezone" data-testid="select-timezone">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/New_York">Eastern Time</SelectItem>
              <SelectItem value="America/Chicago">Central Time</SelectItem>
              <SelectItem value="America/Denver">Mountain Time</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
              <SelectItem value="America/Anchorage">Alaska Time</SelectItem>
              <SelectItem value="Pacific/Honolulu">Hawaii Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <User className="w-4 h-4" />
        <AlertDescription>
          Fields marked with * are required. You can update other details anytime from your profile settings.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function FamilyStep({
  members,
  onAdd,
  onUpdate,
  onRemove,
}: {
  members: FamilyMember[];
  onAdd: () => void;
  onUpdate: (id: string, field: keyof FamilyMember, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-6" data-testid="family-content">
      <div className="text-center space-y-2 pb-4">
        <Users className="w-12 h-12 text-primary mx-auto" />
        <h3 className="text-lg font-medium">Add Family Members</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add family members to manage their health profiles. This is optional and can be done later.
        </p>
      </div>

      {members.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No family members added yet</p>
            <Button onClick={onAdd} data-testid="button-add-first-member">
              <Plus className="w-4 h-4 mr-2" />
              Add Family Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member, index) => (
            <Card key={member.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base">Family Member {index + 1}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onRemove(member.id)}
                    data-testid={`button-remove-member-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <FieldCaption>First Name</FieldCaption>
                    <Input aria-label="First Name" 
                      value={member.firstName}
                      onChange={(e) => onUpdate(member.id, "firstName", e.target.value)}
                      placeholder="First name"
                      data-testid={`input-member-firstname-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <FieldCaption>Last Name</FieldCaption>
                    <Input aria-label="Last Name" 
                      value={member.lastName}
                      onChange={(e) => onUpdate(member.id, "lastName", e.target.value)}
                      placeholder="Last name"
                      data-testid={`input-member-lastname-${index}`}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <FieldCaption>Relationship</FieldCaption>
                    <Select 
                      value={member.relationship} 
                      onValueChange={(v) => onUpdate(member.id, "relationship", v)}
                    >
                      <SelectTrigger aria-label="Relationship" data-testid={`select-member-relationship-${index}`}>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse/Partner</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="grandparent">Grandparent</SelectItem>
                        <SelectItem value="grandchild">Grandchild</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <FieldCaption>Date of Birth</FieldCaption>
                    <Input aria-label="Date of Birth" 
                      type="date"
                      value={member.dateOfBirth}
                      onChange={(e) => onUpdate(member.id, "dateOfBirth", e.target.value)}
                      data-testid={`input-member-dob-${index}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={onAdd} className="w-full" data-testid="button-add-another-member">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Family Member
          </Button>
        </div>
      )}

      <Alert>
        <Users className="w-4 h-4" />
        <AlertDescription>
          Family members will have their own health profiles. You'll be able to manage access permissions later.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function DocumentsStep({ 
  documentActions, 
  setDocumentActions 
}: { 
  documentActions: { type: string; provider?: string }[];
  setDocumentActions: (actions: { type: string; provider?: string }[]) => void;
}) {
  const toggleAction = (type: string, provider?: string) => {
    const exists = documentActions.some(a => a.type === type && a.provider === provider);
    if (exists) {
      setDocumentActions(documentActions.filter(a => !(a.type === type && a.provider === provider)));
    } else {
      setDocumentActions([...documentActions, { type, provider }]);
    }
  };

  const isSelected = (type: string, provider?: string) => 
    documentActions.some(a => a.type === type && a.provider === provider);

  const providers = ["Fasten Health", "CMS Blue Button"];

  return (
    <div className="space-y-6" data-testid="documents-content">
      <div className="text-center space-y-2 pb-4">
        <FileText className="w-12 h-12 text-primary mx-auto" />
        <h3 className="text-lg font-medium">Link Your Health Records</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Select how you'd like to add your health records. You can choose multiple options.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className={`cursor-pointer transition-colors ${isSelected("upload") ? "border-primary bg-primary/5" : "hover-elevate"}`}
          onClick={() => toggleAction("upload")}
          data-testid="card-upload-documents"
        >
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-between mb-3">
              <Upload className={`w-10 h-10 ${isSelected("upload") ? "text-primary" : "text-muted-foreground"}`} />
              <Checkbox checked={isSelected("upload")} />
            </div>
            <h4 className="font-medium mb-1 text-left">Upload Documents</h4>
            <p className="text-sm text-muted-foreground text-left">
              Upload PDFs, images, or scanned records after setup
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-colors ${documentActions.some(a => a.type === "provider") ? "border-primary bg-primary/5" : "hover-elevate"}`}
          data-testid="card-connect-provider"
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Link2 className={`w-10 h-10 ${documentActions.some(a => a.type === "provider") ? "text-primary" : "text-muted-foreground"}`} />
              <Badge variant="outline">{documentActions.filter(a => a.type === "provider").length} selected</Badge>
            </div>
            <h4 className="font-medium mb-1">Connect Provider</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Select providers to connect after setup
            </p>
            <div className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <Badge
                  key={provider}
                  variant={isSelected("provider", provider) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); toggleAction("provider", provider); }}
                  data-testid={`badge-provider-${provider.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {isSelected("provider", provider) && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {provider}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {documentActions.length > 0 && (
        <Alert>
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <AlertDescription>
            You've selected {documentActions.length} action{documentActions.length > 1 ? "s" : ""}. 
            We'll guide you through these after setup is complete.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <FileText className="w-4 h-4" />
        <AlertDescription>
          This step is optional. You can add documents anytime from the Documents section. 
          Your data is encrypted and HIPAA-compliant.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function GoalsStep({
  goals,
  onToggle,
  customGoal,
  setCustomGoal,
  onAddCustom,
  preferences,
  setPreferences,
}: {
  goals: HealthGoal[];
  onToggle: (id: string) => void;
  customGoal: { name: string; target: string };
  setCustomGoal: (g: { name: string; target: string }) => void;
  onAddCustom: () => void;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
}) {
  const selectedCount = goals.filter(g => g.isSelected).length;

  return (
    <div className="space-y-6" data-testid="goals-content">
      <div className="text-center space-y-2 pb-2">
        <Target className="w-12 h-12 text-primary mx-auto" />
        <h3 className="text-lg font-medium">Set Your Health Goals</h3>
        <p className="text-sm text-muted-foreground">
          Select goals you'd like to track. You can customize these anytime.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {goals.map((goal) => {
          const Icon = GOAL_ICONS[goal.category] || Target;
          return (
            <Card 
              key={goal.id} 
              className={`cursor-pointer transition-colors ${goal.isSelected ? "border-primary bg-primary/5" : "hover-elevate"}`}
              onClick={() => onToggle(goal.id)}
              data-testid={`goal-card-${goal.id}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${goal.isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="font-medium">{goal.name}</h4>
                    <Checkbox checked={goal.isSelected} />
                  </div>
                  <p className="text-sm text-muted-foreground">{goal.target}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add Custom Goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input 
              placeholder="Goal name (e.g., 'Reduce Stress')"
              value={customGoal.name}
              onChange={(e) => setCustomGoal({ ...customGoal, name: e.target.value })}
              data-testid="input-custom-goal-name"
            />
            <Input 
              placeholder="Target (e.g., '10 min meditation daily')"
              value={customGoal.target}
              onChange={(e) => setCustomGoal({ ...customGoal, target: e.target.value })}
              data-testid="input-custom-goal-target"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onAddCustom}
            disabled={!customGoal.name || !customGoal.target}
            data-testid="button-add-custom-goal"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Goal
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium">Notification Preferences</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { key: "appointments", label: "Appointment Reminders" },
            { key: "medications", label: "Medication Reminders" },
            { key: "results", label: "New Test Results" },
            { key: "goals", label: "Goal Progress Updates" },
          ].map((item) => (
            <div key={item.key} className="flex items-center space-x-2">
              <Checkbox 
                id={`notify-${item.key}`}
                checked={preferences.notifications[item.key as keyof typeof preferences.notifications]}
                onCheckedChange={(checked) => setPreferences({
                  ...preferences,
                  notifications: { ...preferences.notifications, [item.key]: !!checked },
                })}
                data-testid={`checkbox-notify-${item.key}`}
              />
              <Label htmlFor={`notify-${item.key}`} className="text-sm">{item.label}</Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Accessibility Options</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { key: "largeText", label: "Larger Text Size" },
            { key: "highContrast", label: "High Contrast Mode" },
            { key: "simplifiedView", label: "Simplified View" },
          ].map((item) => (
            <div key={item.key} className="flex items-center space-x-2">
              <Checkbox 
                id={`access-${item.key}`}
                checked={preferences.accessibility[item.key as keyof typeof preferences.accessibility]}
                onCheckedChange={(checked) => setPreferences({
                  ...preferences,
                  accessibility: { ...preferences.accessibility, [item.key]: !!checked },
                })}
                data-testid={`checkbox-access-${item.key}`}
              />
              <Label htmlFor={`access-${item.key}`} className="text-sm">{item.label}</Label>
            </div>
          ))}
        </div>
      </div>

      {selectedCount > 0 && (
        <Alert>
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <AlertDescription>
            You've selected {selectedCount} health goal{selectedCount > 1 ? "s" : ""} to track.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function CompleteStep({
  profile,
  familyCount,
  documentActionCount,
  goalCount,
}: {
  profile: ProfileData;
  familyCount: number;
  documentActionCount: number;
  goalCount: number;
}) {
  return (
    <div className="space-y-6 py-4" data-testid="complete-content">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-semibold">You're All Set, {profile.firstName}!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your health profile has been created successfully. Here's a summary of what you've set up:
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Primary Profile</h4>
              <p className="text-sm text-muted-foreground">{profile.firstName} {profile.lastName}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Family Members</h4>
              <p className="text-sm text-muted-foreground">
                {familyCount === 0 ? "None added" : `${familyCount} member${familyCount > 1 ? "s" : ""} added`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Health Records</h4>
              <p className="text-sm text-muted-foreground">
                {documentActionCount === 0 ? "Ready to add documents" : `${documentActionCount} action${documentActionCount > 1 ? "s" : ""} planned`}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Health Goals</h4>
              <p className="text-sm text-muted-foreground">
                {goalCount === 0 ? "None selected" : `${goalCount} goal${goalCount > 1 ? "s" : ""} set`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What's Next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: FileText, text: "Upload your health documents", link: "/enhanced-documents" },
            { icon: Activity, text: "Connect your healthcare providers", link: "/ehr-connect" },
            { icon: Target, text: "Start tracking your health goals", link: "/health-metrics" },
            { icon: Users, text: "Invite caregivers for access", link: "/caregiver-dashboard" },
          ].map((item, i) => (
            <Link key={i} href={item.link}>
              <div className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer">
                <item.icon className="w-4 h-4 text-primary" />
                <span className="text-sm flex-1">{item.text}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
