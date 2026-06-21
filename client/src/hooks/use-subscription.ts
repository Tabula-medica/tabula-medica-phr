import { useQuery } from "@tanstack/react-query";

export type SubscriptionTier = "free" | "pro" | "concierge" | "enterprise";

export interface FeatureGateConfig {
  key: string;
  title: string;
  description: string;
  upgradeMessage: string;
  requiredTier: SubscriptionTier;
}

export interface EntitlementsResponse {
  success: boolean;
  tier: SubscriptionTier;
  features: Record<string, boolean>;
  limits: { maxProfiles: number };
  legacyFeatures: Record<string, boolean | number>;
  gates: Record<string, FeatureGateConfig>;
}

/**
 * Single source of truth for the current user's subscription tier and
 * feature entitlements. Reads /api/billing/entitlements (cached for 5
 * minutes; the server returns all 24 gated feature flags in one call).
 *
 * Public API:
 *   const { tier, features, hasFeature, gates, isLoading } = useSubscription();
 */
export function useSubscription() {
  const { data, isLoading, error } = useQuery<EntitlementsResponse>({
    queryKey: ["/api/billing/entitlements"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const tier: SubscriptionTier = data?.tier ?? "free";
  const features: Record<string, boolean> = data?.features ?? {};
  const gates: Record<string, FeatureGateConfig> = data?.gates ?? {};
  const limits = data?.limits ?? { maxProfiles: 1 };

  const hasFeature = (key: string): boolean => Boolean(features[key]);

  return {
    tier,
    features,
    gates,
    limits,
    hasFeature,
    isLoading,
    isError: Boolean(error),
  };
}
