/**
 * Tiny pub/sub bus for cross-cutting feature-gate events. Used by the
 * fetch interceptor in queryClient.ts to push server-issued 403
 * FEATURE_GATED responses to the global ServerFeatureGateListener,
 * which renders a SoftUpgradePrompt anywhere in the app.
 *
 * Intentionally framework-agnostic — no React, no RN, no DOM.
 */

export interface FeatureGateEvent {
  feature: string;
  currentTier?: string;
  requiredTier?: string;
  upgradeMessage?: string;
  title?: string;
}

type Listener = (event: FeatureGateEvent) => void;

const listeners: Set<Listener> = new Set();

export function subscribeFeatureGate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitFeatureGate(event: FeatureGateEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error("[feature-gate-events] listener threw:", err);
    }
  }
}
