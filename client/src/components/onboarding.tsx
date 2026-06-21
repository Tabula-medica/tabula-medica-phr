import { useState, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Search,
  ImageIcon,
  Bell,
  ClipboardList,
  Heart,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Play,
  SkipForward,
  Languages,
} from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/components/language-provider";

// Onboarding steps definition
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  feature: string;
  tips: string[];
  route?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "language",
    title: "Choose Your Language",
    description: "Select your preferred language for the app interface, voice commands, and AI-powered features.",
    icon: <Languages className="h-8 w-8 text-primary" />,
    feature: "Language",
    tips: [
      "16 languages available",
      "Voice commands in your language",
      "AI summaries in your language",
    ],
  },
  {
    id: "welcome",
    title: "Welcome to Tabula Medica",
    description: "Your health records, simplified. This guide shows you how to use the key features.",
    icon: <Heart className="h-8 w-8 text-primary" />,
    feature: "Getting Started",
    tips: [
      "All your health records in one place",
      "AI-powered explanations in plain language",
      "Questions to discuss with your clinician",
    ],
  },
  {
    id: "document-summary",
    title: "Document Summarizer",
    description: "Get plain-language summaries of your medical documents. The AI quotes directly from your records and explains medical terms.",
    icon: <FileText className="h-8 w-8 text-primary" />,
    feature: "Summarize",
    tips: [
      "Tap 'Summarize' on any document",
      "See key findings quoted from the source",
      "Get discussion questions for your doctor",
    ],
    route: "/patient-portal",
  },
  {
    id: "smart-search",
    title: "Smart Health Search",
    description: "Search across all your health records using natural language. Find specific lab results, medications, or conditions quickly.",
    icon: <Search className="h-8 w-8 text-primary" />,
    feature: "Search",
    tips: [
      "Type questions like 'my last blood pressure'",
      "Results show quotes from your records",
      "Filter by date, type, or source",
    ],
    route: "/patient-portal",
  },
  {
    id: "imaging-translator",
    title: "Imaging Report Translator",
    description: "Get plain-language explanations of your imaging reports like X-rays, MRIs, and CT scans.",
    icon: <ImageIcon className="h-8 w-8 text-primary" />,
    feature: "Imaging",
    tips: [
      "Tap 'Explain' on any imaging report",
      "See key findings quoted from the report",
      "Get questions to ask your radiologist",
    ],
    route: "/documents",
  },
  {
    id: "record-observations",
    title: "Record Observations",
    description: "See patterns across your records with discussion prompts. Medications and findings are listed with questions for your clinician.",
    icon: <ClipboardList className="h-8 w-8 text-primary" />,
    feature: "Observations",
    tips: [
      "View your medication list from records",
      "See lab values quoted over time",
      "Get questions to ask about patterns",
    ],
    route: "/patient-portal",
  },
  {
    id: "alerts",
    title: "Health Alerts",
    description: "Get notified about items in your records that may warrant a conversation with your clinician.",
    icon: <Bell className="h-8 w-8 text-primary" />,
    feature: "Alerts",
    tips: [
      "Alerts quote directly from your records",
      "Each alert has discussion prompts",
      "No medical advice - just information",
    ],
    route: "/patient-portal",
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "You now know the key features. Remember: all AI content is informational only, not medical advice.",
    icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
    feature: "Complete",
    tips: [
      "Explore the Patient Portal anytime",
      "Tap the help icon for feature tips",
      "Discuss AI insights with your clinician",
    ],
  },
];

const ONBOARDING_KEY = "tabula_medica_onboarding";

interface OnboardingState {
  completed: boolean;
  currentStep: number;
  stepsCompleted: string[];
  skipped: boolean;
}

function getOnboardingState(): OnboardingState {
  try {
    const stored = localStorage.getItem(ONBOARDING_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse onboarding state:", e);
  }
  return {
    completed: false,
    currentStep: 0,
    stepsCompleted: [],
    skipped: false,
  };
}

function saveOnboardingState(state: OnboardingState): void {
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
}

// Context for onboarding state
interface OnboardingContextType {
  isOnboarding: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  nextStep: () => void;
  prevStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  showOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(getOnboardingState);

  const isOnboarding = !state.completed && !state.skipped;

  const nextStep = () => {
    const newStep = Math.min(state.currentStep + 1, ONBOARDING_STEPS.length - 1);
    const newState = {
      ...state,
      currentStep: newStep,
      stepsCompleted: Array.from(new Set([...state.stepsCompleted, ONBOARDING_STEPS[state.currentStep].id])),
    };
    setState(newState);
    saveOnboardingState(newState);
  };

  const prevStep = () => {
    const newStep = Math.max(state.currentStep - 1, 0);
    const newState = { ...state, currentStep: newStep };
    setState(newState);
    saveOnboardingState(newState);
  };

  const skipOnboarding = () => {
    const newState = { ...state, skipped: true };
    setState(newState);
    saveOnboardingState(newState);
  };

  const completeOnboarding = () => {
    const newState = { ...state, completed: true, stepsCompleted: ONBOARDING_STEPS.map(s => s.id) };
    setState(newState);
    saveOnboardingState(newState);
  };

  const resetOnboarding = () => {
    const newState = { completed: false, currentStep: 0, stepsCompleted: [], skipped: false };
    setState(newState);
    saveOnboardingState(newState);
  };

  const showOnboarding = () => {
    const newState = { completed: false, currentStep: 0, stepsCompleted: [], skipped: false };
    setState(newState);
    saveOnboardingState(newState);
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarding,
        currentStep: state.currentStep,
        steps: ONBOARDING_STEPS,
        nextStep,
        prevStep,
        skipOnboarding,
        completeOnboarding,
        resetOnboarding,
        showOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// Main onboarding dialog
function LanguageStepContent() {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  
  return (
    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto py-2">
      {supportedLanguages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left ${
            language === lang.code
              ? "border-primary bg-primary/5"
              : "border-transparent bg-muted/50 hover:bg-muted"
          }`}
          data-testid={`button-onboard-lang-${lang.code}`}
        >
          <div className="flex items-center gap-2 w-full">
            {language === lang.code && (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="font-medium text-sm truncate">{lang.nativeName}</span>
          </div>
          <span className="text-xs text-muted-foreground mt-1">{lang.name}</span>
        </button>
      ))}
    </div>
  );
}

export function OnboardingDialog() {
  const { isOnboarding, currentStep, steps, nextStep, prevStep, skipOnboarding, completeOnboarding } = useOnboarding();
  
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLanguageStep = step?.id === "language";

  if (!isOnboarding) return null;

  return (
    <Dialog open={isOnboarding} onOpenChange={(open) => !open && skipOnboarding()}>
      <DialogContent className="max-w-md" data-testid="dialog-onboarding">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary" className="text-xs">
              Step {currentStep + 1} of {steps.length}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={skipOnboarding}
              className="text-xs text-muted-foreground"
              data-testid="button-skip-onboarding"
            >
              <SkipForward className="h-3 w-3 mr-1" />
              Skip Tour
            </Button>
          </div>
          <Progress value={progress} className="h-1 mb-4" />
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              {step.icon}
            </div>
          </div>
          <DialogTitle className="text-center">{step.title}</DialogTitle>
          <DialogDescription className="text-center">
            {step.description}
          </DialogDescription>
        </DialogHeader>

        {isLanguageStep ? (
          <LanguageStepContent />
        ) : (
          <div className="space-y-2 my-4">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Tips:
            </p>
            <ul className="space-y-2">
              {step.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={isFirstStep}
            data-testid="button-onboarding-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {isLastStep ? (
            <Button onClick={completeOnboarding} data-testid="button-onboarding-complete">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Get Started
            </Button>
          ) : (
            <Button onClick={nextStep} data-testid="button-onboarding-next">
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Feature tooltip component
interface FeatureTooltipProps {
  feature: string;
  children: React.ReactNode;
}

export function FeatureTooltip({ feature, children }: FeatureTooltipProps) {
  const step = ONBOARDING_STEPS.find(s => s.feature === feature);
  
  if (!step) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-sm">{step.title}</p>
          <p className="text-xs text-muted-foreground">{step.description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// Help button to restart onboarding
export function OnboardingHelpButton() {
  const { showOnboarding } = useOnboarding();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={showOnboarding}
          data-testid="button-show-onboarding"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">Show app tour</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Inline tutorial card for features
interface TutorialCardProps {
  feature: string;
  onDismiss?: () => void;
}

export function TutorialCard({ feature, onDismiss }: TutorialCardProps) {
  const step = ONBOARDING_STEPS.find(s => s.feature === feature);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = `tutorial_dismissed_${feature}`;
    setDismissed(localStorage.getItem(key) === "true");
  }, [feature]);

  if (!step || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(`tutorial_dismissed_${feature}`, "true");
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid={`card-tutorial-${feature}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            How to use {step.title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            data-testid={`button-dismiss-tutorial-${feature}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1">
          {step.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <ChevronRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Quick start guide component
export function QuickStartGuide() {
  const { showOnboarding } = useOnboarding();
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    setShowGuide(localStorage.getItem("quickstart_dismissed") !== "true");
  }, []);

  if (!showGuide) return null;

  const handleDismiss = () => {
    localStorage.setItem("quickstart_dismissed", "true");
    setShowGuide(false);
  };

  return (
    <Card className="border-primary/20" data-testid="card-quickstart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Quick Start Guide
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismiss}
            data-testid="button-dismiss-quickstart"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          New to Tabula Medica? Learn the key features.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-2">
          {ONBOARDING_STEPS.slice(1, 5).map((step) => (
            <div
              key={step.id}
              className="p-2 rounded-lg bg-muted/50 text-center"
            >
              <div className="flex justify-center mb-1">
                {step.icon}
              </div>
              <p className="text-xs font-medium">{step.feature}</p>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant="outline"
          onClick={showOnboarding}
          data-testid="button-start-tour"
        >
          <Play className="h-4 w-4 mr-2" />
          Take the Tour
        </Button>
      </CardFooter>
    </Card>
  );
}
