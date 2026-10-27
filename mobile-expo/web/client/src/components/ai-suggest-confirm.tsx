/**
 * AI Suggestion Confirm Gate — Web component (Task #297)
 *
 * Renders a modal dialog asking the user to confirm before any AI-suggested
 * content fills a form field or document. Dismissed suggestions are logged
 * via a fire-and-forget POST to /api/ai-review/submit.
 *
 * Usage:
 *   <AiSuggestConfirm
 *     suggestion={aiText}
 *     onUse={(text) => form.setValue("field", text)}
 *     onDismiss={() => setSuggestion(null)}
 *   />
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, X } from "lucide-react";

interface AiSuggestConfirmProps {
  /** The AI-generated text to confirm */
  suggestion: string | null;
  /** Called when user taps "Use this suggestion" — receives the suggestion text */
  onUse: (text: string) => void;
  /** Called when user dismisses without using the suggestion */
  onDismiss: () => void;
  /** Optional label for the field being filled (e.g. "Chief Complaint") */
  fieldLabel?: string;
  /** Source route for logging purposes */
  sourceRoute?: string;
}

export function AiSuggestConfirm({
  suggestion,
  onUse,
  onDismiss,
  fieldLabel,
  sourceRoute,
}: AiSuggestConfirmProps) {
  const handleDismiss = () => {
    // Fire-and-forget: log dismissal
    if (suggestion) {
      fetch("/api/ai-review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          route: sourceRoute ?? "web-suggest-confirm-dismissed",
          aiOutput: suggestion,
          requestContext: { action: "user_dismissed", fieldLabel },
        }),
      }).catch(() => {});
    }
    onDismiss();
  };

  return (
    <Dialog open={!!suggestion} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent data-testid="dialog-ai-suggest-confirm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Suggestion
            <Badge variant="outline" className="text-xs ml-1">AI-generated</Badge>
          </DialogTitle>
          <DialogDescription>
            {fieldLabel
              ? `Review the AI suggestion for "${fieldLabel}" before using it.`
              : "Review this AI-generated suggestion before adding it to your record."}
          </DialogDescription>
        </DialogHeader>

        <div
          className="bg-muted/40 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap border"
          data-testid="text-ai-suggestion"
        >
          {suggestion}
        </div>

        <p className="text-xs text-muted-foreground">
          This content is AI-generated. Review it carefully before using it in a medical record or form.
        </p>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleDismiss}
            data-testid="button-dismiss-suggestion"
          >
            <X className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
          <Button
            onClick={() => {
              if (suggestion) onUse(suggestion);
            }}
            data-testid="button-use-suggestion"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Use this suggestion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
