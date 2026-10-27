import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClinicalDisclaimerProps {
  className?: string;
  variant?: "default" | "compact" | "card";
  testId?: string;
}

const DISCLAIMER_TEXT =
  "For informational purposes only. Not for clinical decision-making.";

export function ClinicalDisclaimer({
  className,
  variant = "default",
  testId = "clinical-disclaimer",
}: ClinicalDisclaimerProps) {
  if (variant === "compact") {
    return (
      <p
        data-testid={testId}
        className={cn(
          "text-xs text-muted-foreground italic text-center mt-2",
          className,
        )}
      >
        {DISCLAIMER_TEXT}
      </p>
    );
  }

  if (variant === "card") {
    return (
      <div
        data-testid={testId}
        className={cn(
          "rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 flex items-start gap-2",
          className,
        )}
      >
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          {DISCLAIMER_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        "mt-6 pt-4 border-t border-border/60 flex items-start gap-2",
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        {DISCLAIMER_TEXT}
      </p>
    </div>
  );
}

export const CLINICAL_DISCLAIMER_TEXT = DISCLAIMER_TEXT;
