import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  OnboardingChecklist, 
  useOnboardingChecklist 
} from "@/components/onboarding-checklist";
import { HealthRecordImport } from "@/components/health-record-import";
import { GuidedTour, TourStep, useCompletedTours } from "@/components/guided-tour";
import {
  Sparkles,
  Heart,
  FileText,
  Users,
  Shield,
  ArrowRight,
  ArrowLeft,
  Check,
  Play,
  Home,
  Calendar,
  Pill,
  Activity,
  MessageSquare,
  Bell,
} from "lucide-react";

type OnboardingStep = "welcome" | "tour" | "import" | "checklist" | "complete";

const WELCOME_TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='dashboard']",
    title: "Your Health Dashboard",
    content: "This is your personal health overview. See all your important health information at a glance.",
    placement: "bottom",
  },
  {
    target: "[data-tour='records']",
    title: "Health Records",
    content: "Access all your medical records, lab results, and documents in one place.",
    placement: "right",
  },
  {
    target: "[data-tour='medications']",
    title: "Medications",
    content: "Track your current medications, set reminders, and manage refills.",
    placement: "right",
  },
  {
    target: "[data-tour='appointments']",
    title: "Appointments",
    content: "View upcoming appointments and schedule new visits with your healthcare providers.",
    placement: "right",
  },
  {
    target: "[data-tour='messages']",
    title: "Secure Messages",
    content: "Communicate securely with your care team. All messages are encrypted and HIPAA-compliant.",
    placement: "right",
  },
  {
    target: "[data-tour='profile']",
    title: "Your Profile",
    content: "Manage your personal information, preferences, and accessibility settings.",
    placement: "left",
  },
];

export default function NewUserOnboarding() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStep = (searchParams.get("step") as OnboardingStep) || "welcome";
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [showTour, setShowTour] = useState(false);
  const { markComplete: markChecklistComplete, progress, requiredComplete } = useOnboardingChecklist();
  const { markComplete: markTourComplete, isComplete: isTourComplete } = useCompletedTours();

  const handleStartTour = () => {
    setShowTour(true);
    setCurrentStep("tour");
  };

  const handleTourComplete = () => {
    setShowTour(false);
    markTourComplete("welcome-tour");
    markChecklistComplete("guided_tour");
    setCurrentStep("import");
  };

  const handleTourSkip = () => {
    setShowTour(false);
    setCurrentStep("import");
  };

  const handleImportComplete = () => {
    markChecklistComplete("health_records");
    setCurrentStep("checklist");
  };

  const handleFilesUploaded = (count: number) => {
    if (count > 0) {
      markChecklistComplete("health_records");
    }
  };

  const handleFinishSetup = () => {
    setCurrentStep("complete");
  };

  const handleGoToDashboard = () => {
    setLocation("/");
  };

  const steps: { id: OnboardingStep; label: string }[] = [
    { id: "welcome", label: "Welcome" },
    { id: "tour", label: "Tour" },
    { id: "import", label: "Import" },
    { id: "checklist", label: "Setup" },
    { id: "complete", label: "Done" },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const stepProgress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Heart className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Welcome to Tabula Medica</h1>
                <p className="text-sm text-muted-foreground">
                  Let's get your health records set up
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")}
              data-testid="button-skip-onboarding"
            >
              Skip for now
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    index < currentStepIndex 
                      ? "bg-primary text-primary-foreground"
                      : index === currentStepIndex
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-1 rounded ${
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <Shield className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>Educational Only:</strong> This app does NOT provide medical advice. 
            Always consult your healthcare provider for medical decisions.
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {currentStep === "welcome" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit mb-4">
                  <Sparkles className="h-12 w-12 text-primary" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl">Welcome to Your Health Journey</CardTitle>
                <CardDescription className="text-base">
                  Tabula Medica helps you manage all your health records in one secure place.
                  Let's take a quick tour and get you set up.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-primary" aria-hidden="true" />
                    <p className="font-medium">All Records in One Place</p>
                    <p className="text-sm text-muted-foreground">
                      Import from any provider
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-primary" aria-hidden="true" />
                    <p className="font-medium">Family Health Profiles</p>
                    <p className="text-sm text-muted-foreground">
                      Manage care for loved ones
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-primary" aria-hidden="true" />
                    <p className="font-medium">Secure & Private</p>
                    <p className="text-sm text-muted-foreground">
                      HIPAA-compliant protection
                    </p>
                  </div>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Educational Information Only:</strong> This app helps you organize and understand 
                    your health records. It does NOT provide medical advice. Always consult your healthcare 
                    provider for medical decisions.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="flex justify-center gap-4 pt-4">
                <Button 
                  size="lg" 
                  onClick={handleStartTour}
                  data-testid="button-start-tour"
                >
                  <Play className="h-4 w-4 mr-2" aria-hidden="true" />
                  Take the Tour
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => setCurrentStep("import")}
                  data-testid="button-skip-tour"
                >
                  Skip to Import
                  <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {currentStep === "tour" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Interactive Tour</CardTitle>
                <CardDescription>
                  Learn about the key features of Tabula Medica
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { icon: Home, title: "Dashboard", desc: "Your health at a glance" },
                    { icon: FileText, title: "Records", desc: "All your medical documents" },
                    { icon: Pill, title: "Medications", desc: "Track and manage medications" },
                    { icon: Calendar, title: "Appointments", desc: "Upcoming visits" },
                    { icon: Activity, title: "Health Trends", desc: "See your progress over time" },
                    { icon: MessageSquare, title: "Messages", desc: "Secure provider communication" },
                  ].map((item) => (
                    <div 
                      key={item.title}
                      className="flex items-center gap-3 p-4 rounded-lg border"
                    >
                      <div className="p-2 rounded-lg bg-primary/10">
                        <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Alert>
                  <Bell className="h-4 w-4" />
                  <AlertDescription>
                    You can restart the tour anytime from Settings.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline"
                  onClick={() => setCurrentStep("welcome")}
                  data-testid="button-back-to-welcome"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                  Back
                </Button>
                <Button 
                  onClick={handleTourComplete}
                  data-testid="button-tour-complete"
                >
                  Continue to Import
                  <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {currentStep === "import" && (
          <div className="space-y-6">
            <HealthRecordImport
              onComplete={handleImportComplete}
              onFilesUploaded={handleFilesUploaded}
              onPlatformConnected={(id) => markChecklistComplete("ehr_connection")}
            />
            
            <div className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setCurrentStep("tour")}
                data-testid="button-back-to-tour"
              >
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                Back
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setCurrentStep("checklist")}
                data-testid="button-skip-import"
              >
                Skip for now
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "checklist" && (
          <div className="space-y-6">
            <OnboardingChecklist />
            
            <div className="flex justify-between">
              <Button 
                variant="outline"
                onClick={() => setCurrentStep("import")}
                data-testid="button-back-to-import"
              >
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                Back
              </Button>
              <Button 
                onClick={handleFinishSetup}
                data-testid="button-finish-setup"
              >
                {requiredComplete ? "Finish Setup" : "Continue Anyway"}
                <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === "complete" && (
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/20 w-fit mb-4">
                <Check className="h-12 w-12 text-green-600" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription className="text-base">
                Your health record is ready to use. You can always add more records 
                and complete remaining setup tasks later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Setup Progress</span>
                  <Badge variant="secondary">{Math.round(progress)}% Complete</Badge>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Reminder:</strong> This app is for educational purposes only and does NOT 
                  provide medical advice. Always consult your healthcare provider for medical decisions.
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button 
                size="lg"
                onClick={handleGoToDashboard}
                data-testid="button-go-to-dashboard"
              >
                <Home className="h-4 w-4 mr-2" aria-hidden="true" />
                Go to Dashboard
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>

      {showTour && (
        <GuidedTour
          tourId="welcome-tour"
          steps={WELCOME_TOUR_STEPS}
          onComplete={handleTourComplete}
          onSkip={handleTourSkip}
        />
      )}
    </div>
  );
}
