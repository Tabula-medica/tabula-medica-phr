import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, Hand, Lock, Save } from "lucide-react";
import {
  PERMISSION_STRINGS,
  hasSeenPrePrompt,
  markPrePromptSeen,
  logPermissionTelemetry,
} from "@/lib/permission-strings";

interface MicRecordingExplainerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void | Promise<void>;
  onCancel?: () => void;
}

export function MicRecordingExplainer({
  open,
  onOpenChange,
  onContinue,
  onCancel,
}: MicRecordingExplainerProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      logPermissionTelemetry("microphone", "shown");
      markPrePromptSeen("microphone");
    }
  }, [open]);

  const handleContinue = async () => {
    setBusy(true);
    logPermissionTelemetry("microphone", "accepted");
    try {
      await onContinue();
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    logPermissionTelemetry("microphone", "declined");
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-mic-explainer">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-950/40">
            <Mic className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          </div>
          <DialogTitle className="text-center" data-testid="text-mic-title">
            How recording works
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="text-mic-canonical">
            {PERMISSION_STRINGS.microphone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-start gap-3">
            <Hand className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">You're in control.</span> Recording
              only starts when you tap the red record button and stops the
              moment you tap stop. Nothing is captured otherwise.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">Encrypted on device.</span> The
              audio is encrypted on your phone before it ever leaves it. We
              never have access to an unencrypted copy.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Save className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">Uploaded only when you save.</span>{" "}
              After you stop, you can review the transcript and either save the
              encounter (which uploads the encrypted recording for transcription
              by HIPAA-covered services) or discard it (which deletes it).
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={busy}
            data-testid="button-mic-cancel"
          >
            Not now
          </Button>
          <Button
            onClick={handleContinue}
            disabled={busy}
            data-testid="button-mic-continue"
          >
            {busy ? "Requesting access…" : "Allow microphone access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowMicPrePrompt(): boolean {
  return !hasSeenPrePrompt("microphone");
}
