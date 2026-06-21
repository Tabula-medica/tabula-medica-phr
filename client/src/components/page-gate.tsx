import { useEffect, useRef } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import {
  SoftUpgradePrompt,
  useSoftUpgradePrompt,
  type RequiredTier,
} from "@/components/soft-upgrade-prompt";

interface PageGateProps {
  feature: string;
  /**
   * If true, the prompt re-pops on every page mount even after dismissal.
   * Default false: dismissal is remembered for the rest of the browser session
   * so users aren't repeatedly nagged when navigating between gated pages.
   */
  alwaysReprompt?: boolean;
}

const SESSION_KEY = (feature: string) => `tm.upgrade-prompt.dismissed.${feature}`;

function isDismissedThisSession(feature: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY(feature)) === "1";
  } catch {
    return false;
  }
}

function markDismissedThisSession(feature: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY(feature), "1");
  } catch {
    /* sessionStorage unavailable (private mode quota) — fail silently */
  }
}

/**
 * Drop-in soft gate for a Pro/Concierge/Enterprise page.
 *
 * Renders nothing for entitled users. For non-entitled users, pops the
 * SoftUpgradePrompt once per browser session per feature, with the correct
 * tier badge, contextual current-tier note, and tier-appropriate CTA.
 */
export function PageGate({ feature, alwaysReprompt = false }: PageGateProps) {
  const { hasFeature, isLoading, tier, gates } = useSubscription();
  const { open, setOpen, trigger, show } = useSoftUpgradePrompt(feature as never);
  const hasAutoShownRef = useRef(false);

  const requiredTier = (gates[feature]?.requiredTier ?? "pro") as RequiredTier;
  const currentTier = tier;

  useEffect(() => {
    if (isLoading) return;
    if (hasFeature(feature)) return;
    if (hasAutoShownRef.current) return;
    if (!alwaysReprompt && isDismissedThisSession(feature)) return;

    hasAutoShownRef.current = true;
    show(feature as never);
  }, [isLoading, feature, hasFeature, show, alwaysReprompt]);

  const handleOpenChange = (next: boolean) => {
    if (!next) markDismissedThisSession(feature);
    setOpen(next);
  };

  return (
    <SoftUpgradePrompt
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      requiredTier={requiredTier}
      currentTier={currentTier}
    />
  );
}
