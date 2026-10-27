import { useEffect, useState } from "react";
import {
  subscribeFeatureGate,
  type FeatureGateEvent,
} from "@/lib/feature-gate-events";
import {
  SoftUpgradePrompt,
  UPGRADE_PROMPT_KEYS,
  type UpgradeTrigger,
} from "@/components/soft-upgrade-prompt";

/**
 * Mounted once near the root of the app. Subscribes to feature-gate
 * events emitted by the queryClient fetch interceptor whenever the
 * server returns 403 { code: "FEATURE_GATED", ... }, and renders a
 * SoftUpgradePrompt with the server-supplied upgrade message.
 */
export function ServerFeatureGateListener() {
  const [event, setEvent] = useState<FeatureGateEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeFeatureGate((next) => {
      setEvent(next);
      setOpen(true);
    });
  }, []);

  if (!event) return null;

  // Map server feature key to a known trigger; fall back to ai_feature
  // (a generic Pro-feature prompt) for unknown keys so the user still
  // sees the server's upgradeMessage.
  const trigger: UpgradeTrigger = (UPGRADE_PROMPT_KEYS as string[]).includes(
    event.feature,
  )
    ? (event.feature as UpgradeTrigger)
    : "ai_feature";

  return (
    <SoftUpgradePrompt
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      overrideTitle={event.title}
      overrideDescription={event.upgradeMessage}
    />
  );
}
