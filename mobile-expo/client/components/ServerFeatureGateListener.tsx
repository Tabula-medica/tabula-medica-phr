import React, { useEffect, useState } from "react";
import UpgradePrompt from "@/components/UpgradePrompt";
import {
  subscribeServerFeatureGate,
  type ServerFeatureGateEvent,
} from "@/lib/feature-gate-events";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/feature-flags";

export function ServerFeatureGateListener() {
  const [visible, setVisible] = useState(false);
  const [event, setEvent] = useState<ServerFeatureGateEvent | null>(null);

  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) return;
    const unsubscribe = subscribeServerFeatureGate((next) => {
      setEvent(next);
      setVisible(true);
    });
    return unsubscribe;
  }, []);

  if (!SUBSCRIPTIONS_ENABLED) return null;

  return (
    <UpgradePrompt
      visible={visible}
      featureKey={event?.feature ?? null}
      onDismiss={() => setVisible(false)}
      overrideDescription={event?.upgradeMessage}
    />
  );
}

export default ServerFeatureGateListener;
