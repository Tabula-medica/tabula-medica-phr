import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  action?: "click" | "hover" | "none";
}

interface GuidedTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

const TOUR_STORAGE_KEY = "tabula_completed_tours";

export function useCompletedTours() {
  const [completedTours, setCompletedTours] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(TOUR_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const markComplete = useCallback((tourId: string) => {
    setCompletedTours(prev => {
      const updated = [...prev, tourId];
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isComplete = useCallback((tourId: string) => {
    return completedTours.includes(tourId);
  }, [completedTours]);

  const resetTour = useCallback((tourId: string) => {
    setCompletedTours(prev => {
      const updated = prev.filter(id => id !== tourId);
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { completedTours, markComplete, isComplete, resetTour };
}

export function GuidedTour({ tourId, steps, onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(true);
  const { markComplete } = useCompletedTours();

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  useEffect(() => {
    if (!step?.target) return;

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        const placement = step.placement || "bottom";

        let top = 0;
        let left = 0;

        switch (placement) {
          case "top":
            top = rect.top - 160;
            left = rect.left + rect.width / 2 - 160;
            break;
          case "bottom":
            top = rect.bottom + 16;
            left = rect.left + rect.width / 2 - 160;
            break;
          case "left":
            top = rect.top + rect.height / 2 - 80;
            left = rect.left - 340;
            break;
          case "right":
            top = rect.top + rect.height / 2 - 80;
            left = rect.right + 16;
            break;
        }

        top = Math.max(16, Math.min(top, window.innerHeight - 200));
        left = Math.max(16, Math.min(left, window.innerWidth - 340));

        setPosition({ top, left });

        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("tour-highlight");
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("resize", updatePosition);
      const element = document.querySelector(step.target);
      if (element) {
        element.classList.remove("tour-highlight");
      }
    };
  }, [step]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const element = document.querySelector(step.target);
      if (element) {
        element.classList.remove("tour-highlight");
      }
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const element = document.querySelector(step.target);
      if (element) {
        element.classList.remove("tour-highlight");
      }
      setCurrentStep(prev => prev - 1);
    }
  };

  const cleanupHighlight = useCallback(() => {
    steps.forEach(s => {
      const el = document.querySelector(s.target);
      if (el) el.classList.remove("tour-highlight");
    });
  }, [steps]);

  const handleComplete = () => {
    cleanupHighlight();
    markComplete(tourId);
    setIsVisible(false);
    onComplete?.();
  };

  const handleSkip = () => {
    cleanupHighlight();
    markComplete(tourId);
    setIsVisible(false);
    onSkip?.();
  };

  if (!isVisible || !step) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]" 
        data-testid="tour-overlay"
      />
      <Card
        className="fixed z-[9999] w-80 shadow-lg"
        style={{ top: position.top, left: position.left }}
        data-testid="tour-tooltip"
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Step {currentStep + 1} of {steps.length}
              </p>
              <h4 className="font-semibold text-sm">{step.title}</h4>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2 -mt-1"
              onClick={handleSkip}
              data-testid="button-tour-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{step.content}</p>

          <Progress value={progress} className="h-1 mb-4" />

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              data-testid="button-tour-skip"
            >
              Skip tour
            </Button>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  data-testid="button-tour-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                data-testid="button-tour-next"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export const TOUR_DEFINITIONS = {
  welcome: [
    {
      target: "[data-testid='nav-timeline']",
      title: "Your Health Timeline",
      content: "View all your health events in chronological order. See appointments, test results, medications, and more.",
      placement: "right" as const,
    },
    {
      target: "[data-testid='nav-medications']",
      title: "Medications",
      content: "Track your current medications, dosages, and refill schedules. Get alerts for potential interactions.",
      placement: "right" as const,
    },
    {
      target: "[data-testid='nav-visualizations']",
      title: "Health Visualizations",
      content: "See trends in your vitals, lab results, and other health metrics with interactive charts.",
      placement: "right" as const,
    },
    {
      target: "[data-testid='nav-data-sources']",
      title: "Connected Data Sources",
      content: "Manage connections to your healthcare providers, wearables, and other health data sources.",
      placement: "right" as const,
    },
  ],
  timeline: [
    {
      target: "[data-testid='timeline-filters']",
      title: "Filter Your Timeline",
      content: "Use filters to focus on specific types of health events like labs, encounters, or medications.",
      placement: "bottom" as const,
    },
    {
      target: "[data-testid='timeline-search']",
      title: "Search Events",
      content: "Search for specific conditions, medications, or providers across your entire health history.",
      placement: "bottom" as const,
    },
    {
      target: "[data-testid='timeline-event']",
      title: "Event Details",
      content: "Click any event to see full details, related documents, and AI-generated explanations.",
      placement: "left" as const,
    },
  ],
  visualizations: [
    {
      target: "[data-testid='chart-vitals']",
      title: "Vital Signs Trends",
      content: "Track your blood pressure, heart rate, and other vitals over time. Normal ranges are highlighted.",
      placement: "bottom" as const,
    },
    {
      target: "[data-testid='chart-labs']",
      title: "Lab Results",
      content: "View your lab values with trend lines. Abnormal results are flagged for easy identification.",
      placement: "bottom" as const,
    },
    {
      target: "[data-testid='chart-medications']",
      title: "Medication Adherence",
      content: "See your medication taking patterns and identify opportunities to improve adherence.",
      placement: "bottom" as const,
    },
  ],
};
