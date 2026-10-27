/**
 * VoiceCommandBar — web voice command button and feedback bar.
 *
 * Usage:
 *   <VoiceCommandBar
 *     onFillField={(field, value) => setValue(field, value)}
 *     onConfirm={handleSubmit}
 *   />
 *
 * FILL_FIELD commands are staged (pendingFill) and only applied after the user
 * taps Confirm or says "confirm". This mirrors the mobile VoiceFAB behaviour.
 */
import { useEffect, useRef } from "react";
import { Mic, MicOff, Loader2, HelpCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWebVoice, type UseWebVoiceOptions } from "@/hooks/useWebVoice";
import { cn } from "@/lib/utils";

interface VoiceCommandBarProps extends UseWebVoiceOptions {
  className?: string;
  compact?: boolean;
  onNavigate?: (screenKey: string) => void;
}

export function VoiceCommandBar({
  onFillField,
  onConfirm,
  onCancel,
  onNavigate,
  ttsEnabled = true,
  className,
  compact = false,
}: VoiceCommandBarProps) {
  const {
    isListening,
    isProcessing,
    isSupported,
    pendingFill,
    lastResult,
    error,
    startListening,
    stopListening,
    applyPendingFill,
    cancelPendingFill,
    clearResult,
  } = useWebVoice({ onFillField, onConfirm, onCancel, onNavigate, ttsEnabled });

  // Auto-clear result feedback after 4 s (but not while a fill is pending)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if ((lastResult || error) && !pendingFill) {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(clearResult, 4000);
    }
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, [lastResult, error, pendingFill, clearResult]);

  if (!isSupported) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-muted-foreground",
          className
        )}
        data-testid="voice-not-supported"
        role="status"
        aria-label="Voice commands not available in this browser"
      >
        <MicOff className="w-4 h-4" />
        {!compact && <span>Voice not available</span>}
      </div>
    );
  }

  // Pending-fill bar takes priority over generic feedback
  if (pendingFill) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 flex-wrap rounded-lg border border-primary/50 bg-primary/5 px-3 py-2",
          className
        )}
        role="region"
        aria-label="Pending voice fill — confirm or cancel"
        aria-live="assertive"
        data-testid="voice-pending-fill"
      >
        <span className="text-sm flex-1 min-w-0 truncate">
          Set <strong>{pendingFill.field}</strong>: {pendingFill.value}
        </span>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={applyPendingFill}
          data-testid="button-voice-confirm"
          aria-label="Confirm voice fill"
          className="gap-1"
        >
          <Check className="w-3 h-3" />
          {!compact && "Confirm"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancelPendingFill}
          data-testid="button-voice-cancel"
          aria-label="Cancel voice fill"
          className="gap-1"
        >
          <X className="w-3 h-3" />
          {!compact && "Cancel"}
        </Button>
      </div>
    );
  }

  const feedbackText = error
    ? error
    : lastResult
      ? lastResult.ttsReadBack
      : null;

  const feedbackVariant: "destructive" | "secondary" | "outline" = error
    ? "destructive"
    : "secondary";

  return (
    <div
      className={cn("flex items-center gap-2 flex-wrap", className)}
      role="region"
      aria-label="Voice command controls"
    >
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size={compact ? "icon" : "sm"}
        onClick={isListening ? stopListening : startListening}
        disabled={isProcessing}
        data-testid="button-voice-toggle"
        aria-label={
          isProcessing
            ? "Processing voice command"
            : isListening
              ? "Stop listening"
              : "Start voice command"
        }
        aria-pressed={isListening}
        className={cn(
          "transition-all",
          isListening && "animate-pulse ring-2 ring-destructive ring-offset-2"
        )}
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isListening ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
        {!compact && (
          <span className="ml-1.5">
            {isProcessing ? "Processing…" : isListening ? "Listening…" : "Voice"}
          </span>
        )}
      </Button>

      {/* Help tooltip trigger */}
      {!compact && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title='Say "Help" for available commands'
          aria-label="Voice command help"
          data-testid="button-voice-help"
          onClick={() => {
            if ("speechSynthesis" in window) {
              window.speechSynthesis.cancel();
              const utt = new SpeechSynthesisUtterance(
                "You can say: Go to records, Go home, Go back, " +
                  "Set first name to Alex, Set date of birth to March 5 1985, " +
                  "Confirm, or Cancel."
              );
              utt.lang = "en-US";
              window.speechSynthesis.speak(utt);
            }
          }}
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </Button>
      )}

      {/* Feedback badge */}
      {feedbackText && (
        <Badge
          variant={feedbackVariant}
          className="text-xs max-w-xs truncate"
          data-testid="voice-feedback"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedbackText}
        </Badge>
      )}
    </div>
  );
}
