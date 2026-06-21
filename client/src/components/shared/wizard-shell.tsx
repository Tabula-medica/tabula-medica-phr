import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  content: React.ReactNode;
  isValid?: boolean;
}

export function StepProgress({
  steps,
  currentStep,
  "data-testid": testId,
}: {
  steps: { id: string; title: string }[];
  currentStep: number;
  "data-testid"?: string;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto" data-testid={testId || "step-progress"}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-1 shrink-0">
          <div
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
              index < currentStep
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : index === currentStep
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
            data-testid={`step-indicator-${step.id}`}
          >
            {index < currentStep ? <CheckCircle className="h-4 w-4" /> : index + 1}
          </div>
          <span
            className={`text-xs hidden sm:inline ${
              index === currentStep ? "font-medium" : "text-muted-foreground"
            }`}
          >
            {step.title}
          </span>
          {index < steps.length - 1 && (
            <div
              className={`w-6 h-px ${
                index < currentStep ? "bg-green-500" : "bg-border"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function WizardShell({
  title,
  subtitle,
  steps,
  onComplete,
  showSecurityBadge = false,
  "data-testid": testId,
}: {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  onComplete?: () => void;
  showSecurityBadge?: boolean;
  "data-testid"?: string;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  const canGoNext = steps[currentStep]?.isValid !== false;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="container max-w-3xl mx-auto p-4 sm:p-6 space-y-6" data-testid={testId || "wizard-shell"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-wizard-title">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {showSecurityBadge && (
          <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1" data-testid="badge-secured">
            <Shield className="h-3 w-3" />
            Secured
          </Badge>
        )}
      </div>

      <StepProgress
        steps={steps.map((s) => ({ id: s.id, title: s.title }))}
        currentStep={currentStep}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-step-title">
            {steps[currentStep]?.icon && (() => {
              const Icon = steps[currentStep].icon!;
              return <Icon className="h-5 w-5" />;
            })()}
            {steps[currentStep]?.title}
          </CardTitle>
          {steps[currentStep]?.description && (
            <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
          )}
        </CardHeader>
        <CardContent data-testid={`step-content-${steps[currentStep]?.id}`}>
          {steps[currentStep]?.content}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          data-testid="button-wizard-back"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {isLastStep ? (
          <Button
            onClick={onComplete}
            disabled={!canGoNext}
            data-testid="button-wizard-complete"
          >
            Complete
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={!canGoNext}
            data-testid="button-wizard-next"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
