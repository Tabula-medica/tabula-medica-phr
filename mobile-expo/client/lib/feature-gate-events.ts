export type ServerFeatureGateEvent = {
  feature: string;
  currentTier?: string;
  requiredTier?: string;
  upgradeMessage?: string;
};

type Listener = (event: ServerFeatureGateEvent) => void;

const listeners: Set<Listener> = new Set();

export function emitServerFeatureGate(event: ServerFeatureGateEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.warn("[feature-gate] listener error:", err);
    }
  });
}

export function subscribeServerFeatureGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
