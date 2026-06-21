import { useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GuardrailsDisclaimerProps {
  variant?: "banner" | "inline" | "compact";
  className?: string;
}

export function GuardrailsDisclaimer({ variant = "inline", className = "" }: GuardrailsDisclaimerProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("tm-disclaimer-dismissed") === "true";
    }
    return false;
  });

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("tm-disclaimer-dismissed", "true");
  };

  if (variant === "compact") {
    return (
      <div 
        className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
        data-testid="disclaimer-compact"
        role="note"
        aria-label="Medical information disclaimer"
      >
        <Info className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        <span>Free for patients. Not clinical advice — a longitudinal health record.</span>
      </div>
    );
  }

  if (variant === "banner") {
    if (dismissed) return null;
    return (
      <div 
        className={`w-full bg-amber-50/80 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-800/50 px-4 py-2 ${className}`}
        data-testid="disclaimer-banner"
        role="banner"
        aria-label="Medical information disclaimer"
      >
        <div className="container max-w-7xl mx-auto flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
          <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1">
            Tabula Medica is a free longitudinal health record — not a substitute for professional medical advice, diagnosis, or treatment. It helps you save time, reduce costs, and avoid duplicate testing by keeping all your health information in one place. Always free for patients.
          </span>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
            aria-label="Dismiss disclaimer"
            data-testid="button-dismiss-disclaimer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Alert 
      className={`border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 ${className}`}
      data-testid="disclaimer-inline"
      role="note"
      aria-label="Medical information disclaimer"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <strong>Free for Patients. Not Clinical Advice:</strong> Tabula Medica is a free longitudinal health record that helps you save time, reduce costs, and avoid duplicate testing.
        Always consult a qualified healthcare provider for medical decisions.
      </AlertDescription>
    </Alert>
  );
}

export function NoCDSBadge({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-medium ${className}`}
      data-testid="badge-no-cds"
      role="status"
      aria-label="NO-CDS compliance badge"
    >
      <Info className="h-3 w-3" aria-hidden="true" />
      <span>NO-CDS Compliant</span>
    </div>
  );
}

export function AIDisclaimerFooter({ className = "" }: { className?: string }) {
  return (
    <footer 
      className={`mt-4 pt-4 border-t text-center ${className}`}
      data-testid="disclaimer-footer"
      role="contentinfo"
      aria-label="AI disclaimer footer"
    >
      <p className="text-xs text-muted-foreground">
        AI-generated content is for informational purposes only. 
        This is a longitudinal health record, not a source of medical advice, diagnosis, or treatment recommendations.
      </p>
    </footer>
  );
}
