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
import { Heart, Lock, EyeOff, Settings } from "lucide-react";
import {
  PERMISSION_STRINGS,
  hasSeenPrePrompt,
  markPrePromptSeen,
  logPermissionTelemetry,
} from "@/lib/permission-strings";

interface HealthKitConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void | Promise<void>;
  onCancel?: () => void;
}

export function HealthKitConsentDialog({
  open,
  onOpenChange,
  onContinue,
  onCancel,
}: HealthKitConsentDialogProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      logPermissionTelemetry("healthShare", "shown");
      markPrePromptSeen("healthShare");
    }
  }, [open]);

  const handleContinue = async () => {
    setBusy(true);
    logPermissionTelemetry("healthShare", "accepted");
    try {
      await onContinue();
    } finally {
      setBusy(false);
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    logPermissionTelemetry("healthShare", "declined");
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-healthkit-consent">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/40">
            <Heart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <DialogTitle className="text-center" data-testid="text-healthkit-title">
            Connect Apple Health
          </DialogTitle>
          <DialogDescription className="text-center" data-testid="text-healthkit-canonical">
            {PERMISSION_STRINGS.healthShare}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">Stays encrypted.</span> Your Health
              data is encrypted on your device before it ever leaves it.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">Per-category control.</span> Apple's
              next screen lets you pick exactly which categories (steps, heart
              rate, sleep, etc.) we can read. You can deny any of them.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Settings className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-600 dark:text-teal-400" />
            <p>
              <span className="font-medium">Disable anytime.</span> Open
              Settings → Privacy &amp; Security → Health → Tabula Medica to
              revoke access. Removing access does not delete records you've
              already saved here.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={busy}
            data-testid="button-healthkit-cancel"
          >
            Not now
          </Button>
          <Button
            onClick={handleContinue}
            disabled={busy}
            data-testid="button-healthkit-continue"
          >
            {busy ? "Opening Health…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function shouldShowHealthKitPrePrompt(): boolean {
  return !hasSeenPrePrompt("healthShare");
}
