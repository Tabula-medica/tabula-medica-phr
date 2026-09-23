import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  FileText,
  Pill,
  Link2,
  Shield,
  CheckCircle,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Tabula Medica",
    description: "Your unified health record platform. We'll help you get started with a quick tour of the key features.",
    icon: Sparkles,
    color: "text-primary",
    tip: "You can access this tour anytime from Settings",
  },
  {
    id: "timeline",
    title: "Your Health Timeline",
    description: "See all your medical events, appointments, and health updates in chronological order. Filter by date, type, or provider.",
    icon: Clock,
    color: "text-blue-500",
    tip: "Click on any event to see full details",
  },
  {
    id: "documents",
    title: "Documents & Records",
    description: "All your medical documents, lab results, and clinical notes in one place. Easily search, filter, and share with providers.",
    icon: FileText,
    color: "text-green-500",
    tip: "Upload new documents anytime from the Documents page",
  },
  {
    id: "medications",
    title: "Medication Management",
    description: "Track your prescriptions, set reminders, and request refills. See drug interactions and important safety information.",
    icon: Pill,
    color: "text-purple-500",
    tip: "Set up reminders to never miss a dose",
  },
  {
    id: "connections",
    title: "Connect Your Records",
    description: "Link your health data from hospitals, clinics, and pharmacies. Securely sync via Fasten Health with 25,000+ US providers.",
    icon: Link2,
    color: "text-orange-500",
    tip: "The more sources you connect, the more complete your record",
  },
  {
    id: "privacy",
    title: "Your Privacy Matters",
    description: "You're in control. Manage who can see your data, set sharing preferences, and review access logs anytime.",
    icon: Shield,
    color: "text-cyan-500",
    tip: "All data is encrypted and HIPAA-compliant",
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export function OnboardingTour({ onComplete, onDismiss }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  
  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const isLastStep = currentStep === tourSteps.length - 1;
  const StepIcon = step.icon;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    localStorage.setItem("onboarding_completed", "true");
    setTimeout(onComplete, 300);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem("onboarding_dismissed", "true");
    setTimeout(onDismiss, 300);
  };

  if (!isVisible) return null;

  return (
    <div role="presentation" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={handleDismiss}
      data-testid="tour-backdrop"
    >
      <Card 
        className={`w-full max-w-lg shadow-2xl border-2 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
        data-component-name="onboarding-tour-card"
      >
        <div className="relative">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              data-testid="button-skip-tour"
            >
              Skip Tour
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              data-testid="button-tour-dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary" className="text-xs">
                Step {currentStep + 1} of {tourSteps.length}
              </Badge>
            </div>
            
            <Progress value={progress} className="h-1.5 mb-6" />
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className={`p-4 rounded-2xl bg-muted mb-4 ${step.color}`}>
                <StepIcon className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                {step.description}
              </p>
              {step.tip && (
                <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-primary/10 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-primary font-medium">{step.tip}</span>
                </div>
              )}
            </div>
          </div>
          
          <CardContent className="pt-0 pb-6">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentStep === 0}
                data-testid="button-tour-prev"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex gap-1.5">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentStep 
                        ? 'bg-primary w-6' 
                        : idx < currentStep 
                          ? 'bg-primary/50' 
                          : 'bg-muted-foreground/30'
                    }`}
                    onClick={() => setCurrentStep(idx)}
                    data-testid={`button-tour-dot-${idx}`}
                  />
                ))}
              </div>
              
              <Button onClick={handleNext} data-testid="button-tour-next">
                {isLastStep ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

export function useOnboardingTour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("onboarding_completed");
    const dismissed = localStorage.getItem("onboarding_dismissed");
    
    if (!completed && !dismissed) {
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const resetTour = () => {
    localStorage.removeItem("onboarding_completed");
    localStorage.removeItem("onboarding_dismissed");
    setShowTour(true);
  };

  return {
    showTour,
    setShowTour,
    resetTour,
    TourComponent: showTour ? (
      <OnboardingTour
        onComplete={() => setShowTour(false)}
        onDismiss={() => setShowTour(false)}
      />
    ) : null,
  };
}
