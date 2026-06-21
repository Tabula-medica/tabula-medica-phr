import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  OrganizationType,
  SubscriptionPlan,
  Subscription,
  Organization,
  OrganizationMember,
} from "@shared/schema";
import {
  entitlementsForTier,
  FEATURE_GATES,
} from "./feature-gates";

interface PlanFeatures {
  maxProfiles: number;
  maxFhirSources: number;
  maxDocumentStorageMb: number;
  aiAssistant: boolean;
  advancedPacketSharing: boolean;
  carePathways: boolean;
  iotIntegration: boolean;
  telehealth: boolean;
  prioritySupport: boolean;
  customAuditExports: boolean;
  apiAccess: boolean;
  whiteLabeling: boolean;
  sso: boolean;
  dedicatedAccountManager: boolean;
  intakeTools: boolean;
  outcomeTracking: boolean;
  populationHealth: boolean;
  careTeamSharing: boolean;
  timelineView: boolean;
  drugSavings: boolean;
  fqhcFinder: boolean;
}

interface SubscriptionPlanConfig {
  id: string;
  name: string;
  tier: SubscriptionTier;
  description: string;
  targetAudience: OrganizationType;
  priceMonthly: number;
  priceAnnual: number;
  pricePerProvider?: number;
  pricePmpm?: number;
  features: PlanFeatures;
  trialDays: number;
  popular?: boolean;
}

const DEFAULT_PLANS: SubscriptionPlanConfig[] = [
  {
    id: "plan_free",
    name: "Free",
    tier: "free",
    description: "Basic health record management for individuals",
    targetAudience: "consumer",
    priceMonthly: 0,
    priceAnnual: 0,
    trialDays: 0,
    features: {
      maxProfiles: 1,
      maxFhirSources: 1,
      maxDocumentStorageMb: 100,
      aiAssistant: false,
      advancedPacketSharing: false,
      carePathways: false,
      iotIntegration: false,
      telehealth: false,
      prioritySupport: false,
      customAuditExports: false,
      apiAccess: false,
      whiteLabeling: false,
      sso: false,
      dedicatedAccountManager: false,
      intakeTools: false,
      outcomeTracking: false,
      populationHealth: false,
      careTeamSharing: false,
      timelineView: true,
      drugSavings: true,
      fqhcFinder: true,
    },
  },
  {
    id: "plan_pro",
    name: "Pro",
    tier: "pro",
    description: "Unlimited connections, AI assistant, and family profiles",
    targetAudience: "consumer",
    priceMonthly: 999,
    priceAnnual: 9990,
    trialDays: 14,
    popular: true,
    features: {
      maxProfiles: 6,
      maxFhirSources: 999,
      maxDocumentStorageMb: 5000,
      aiAssistant: true,
      advancedPacketSharing: true,
      carePathways: true,
      iotIntegration: true,
      telehealth: true,
      prioritySupport: false,
      customAuditExports: false,
      apiAccess: false,
      whiteLabeling: false,
      sso: false,
      dedicatedAccountManager: false,
      intakeTools: false,
      outcomeTracking: false,
      populationHealth: false,
      careTeamSharing: true,
      timelineView: true,
      drugSavings: true,
      fqhcFinder: true,
    },
  },
  {
    id: "plan_concierge",
    name: "Concierge Practice",
    tier: "concierge",
    description: "Per-provider pricing for boutique practices",
    targetAudience: "concierge_practice",
    priceMonthly: 0,
    priceAnnual: 0,
    pricePerProvider: 19900, // $199/provider/month
    trialDays: 30,
    features: {
      maxProfiles: 999999,
      maxFhirSources: 999,
      maxDocumentStorageMb: 50000,
      aiAssistant: true,
      advancedPacketSharing: true,
      carePathways: true,
      iotIntegration: true,
      telehealth: true,
      prioritySupport: true,
      customAuditExports: true,
      apiAccess: true,
      whiteLabeling: false,
      sso: false,
      dedicatedAccountManager: false,
      intakeTools: true,
      outcomeTracking: true,
      populationHealth: false,
      careTeamSharing: true,
      timelineView: true,
      drugSavings: true,
      fqhcFinder: true,
    },
  },
  {
    id: "plan_aco",
    name: "ACO/MA Plan Pilot",
    tier: "enterprise",
    description: "PMPM pricing tied to outcome improvements",
    targetAudience: "aco",
    priceMonthly: 0,
    priceAnnual: 0,
    pricePmpm: 150,
    trialDays: 0,
    features: {
      maxProfiles: 999999,
      maxFhirSources: 999,
      maxDocumentStorageMb: 999999,
      aiAssistant: true,
      advancedPacketSharing: true,
      carePathways: true,
      iotIntegration: true,
      telehealth: true,
      prioritySupport: true,
      customAuditExports: true,
      apiAccess: true,
      whiteLabeling: false,
      sso: true,
      dedicatedAccountManager: true,
      intakeTools: true,
      outcomeTracking: true,
      populationHealth: true,
      careTeamSharing: true,
      timelineView: true,
      drugSavings: true,
      fqhcFinder: true,
    },
  },
  {
    id: "plan_enterprise",
    name: "Enterprise",
    tier: "enterprise",
    description: "Custom pricing with all features and add-ons",
    targetAudience: "enterprise",
    priceMonthly: 0,
    priceAnnual: 0,
    trialDays: 0,
    features: {
      maxProfiles: 999999,
      maxFhirSources: 999,
      maxDocumentStorageMb: 999999,
      aiAssistant: true,
      advancedPacketSharing: true,
      carePathways: true,
      iotIntegration: true,
      telehealth: true,
      prioritySupport: true,
      customAuditExports: true,
      apiAccess: true,
      whiteLabeling: true,
      sso: true,
      dedicatedAccountManager: true,
      intakeTools: true,
      outcomeTracking: true,
      populationHealth: true,
      careTeamSharing: true,
      timelineView: true,
      drugSavings: true,
      fqhcFinder: true,
    },
  },
];

const ENTERPRISE_ADDONS = [
  {
    id: "addon_white_label",
    name: "White Labeling",
    description: "Custom branding, colors, and domain",
    priceMonthly: 49900, // $499/month
  },
  {
    id: "addon_sso",
    name: "SSO Integration",
    description: "SAML/OIDC single sign-on",
    priceMonthly: 29900, // $299/month
  },
  {
    id: "addon_custom_audit",
    name: "Custom Audit Exports",
    description: "HIPAA-compliant audit trail exports",
    priceMonthly: 19900, // $199/month
  },
  {
    id: "addon_dedicated_support",
    name: "Dedicated Support",
    description: "24/7 dedicated account manager",
    priceMonthly: 99900, // $999/month
  },
  {
    id: "addon_custom_integrations",
    name: "Custom Integrations",
    description: "Custom EHR/API integrations",
    priceMonthly: 149900, // $1,499/month
  },
];

const OUTCOME_METRICS = [
  {
    id: "duplicate_test_reduction",
    name: "Reduced Duplicate Tests",
    description: "Percentage reduction in duplicate lab/imaging orders",
    targetReduction: 15, // 15% reduction target
    incentivePerPoint: 5000, // $50 per percentage point improvement
  },
  {
    id: "care_transition_success",
    name: "Improved Care Transitions",
    description: "Successful care transition rate improvement",
    targetImprovement: 20, // 20% improvement target
    incentivePerPoint: 7500, // $75 per percentage point
  },
  {
    id: "medication_adherence",
    name: "Medication Adherence",
    description: "Improvement in medication adherence rates",
    targetImprovement: 10,
    incentivePerPoint: 4000,
  },
  {
    id: "er_visit_reduction",
    name: "ER Visit Reduction",
    description: "Reduction in avoidable ER visits",
    targetReduction: 12,
    incentivePerPoint: 10000,
  },
  {
    id: "readmission_reduction",
    name: "30-Day Readmission Reduction",
    description: "Reduction in 30-day hospital readmissions",
    targetReduction: 10,
    incentivePerPoint: 15000,
  },
];

interface SubscriptionWithPlan extends Subscription {
  plan?: SubscriptionPlan;
}

interface BillingUsage {
  providers: number;
  members: number;
  apiCalls: number;
  storageGb: number;
}

interface OutcomeResult {
  metricId: string;
  baseline: number;
  current: number;
  improvement: number;
  targetMet: boolean;
  incentiveEarned: number;
}

class MonetizationService {
  getPlans(): SubscriptionPlanConfig[] {
    return DEFAULT_PLANS;
  }

  getPlanById(planId: string): SubscriptionPlanConfig | undefined {
    return DEFAULT_PLANS.find((p) => p.id === planId);
  }

  getPlansByAudience(audience: OrganizationType): SubscriptionPlanConfig[] {
    return DEFAULT_PLANS.filter(
      (p) => p.targetAudience === audience || p.targetAudience === "consumer"
    );
  }

  getEnterpriseAddons() {
    return ENTERPRISE_ADDONS;
  }

  getOutcomeMetrics() {
    return OUTCOME_METRICS;
  }

  checkFeatureAccess(
    subscription: SubscriptionWithPlan | null,
    featureKey: Exclude<keyof PlanFeatures, "maxProfiles">
  ): boolean {
    if (!subscription || subscription.status !== "active") {
      const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free");
      return Boolean(freePlan?.features[featureKey] ?? false);
    }

    const plan = this.getPlanById(subscription.planId as unknown as string);
    if (!plan) return false;

    if (subscription.addons) {
      const addons = subscription.addons as Record<string, boolean>;
      if (featureKey === "whiteLabeling" && addons.whiteLabeling) return true;
      if (featureKey === "sso" && addons.sso) return true;
      if (featureKey === "customAuditExports" && addons.customAuditExports)
        return true;
    }

    return Boolean(plan.features[featureKey] ?? false);
  }

  checkFhirSourceLimit(
    subscription: SubscriptionWithPlan | null,
    currentSources: number
  ): { allowed: boolean; limit: number; used: number; remaining: number; tier: string } {
    const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free");
    const defaultLimit = freePlan?.features.maxFhirSources ?? 1;

    if (!subscription || subscription.status !== "active") {
      return {
        allowed: currentSources < defaultLimit,
        limit: defaultLimit,
        used: currentSources,
        remaining: Math.max(0, defaultLimit - currentSources),
        tier: "free",
      };
    }

    const plan = this.getPlanById(subscription.planId as unknown as string);
    const limit = plan?.features.maxFhirSources ?? defaultLimit;

    return {
      allowed: currentSources < limit,
      limit,
      used: currentSources,
      remaining: Math.max(0, limit - currentSources),
      tier: plan?.tier ?? "free",
    };
  }

  getEntitlements(subscription: SubscriptionWithPlan | null): {
    tier: string;
    planName: string;
    limits: { fhirSources: number; profiles: number; documentStorageMb: number };
    features: Record<string, boolean>;
    upgradeAvailable: boolean;
    upgradePlanId: string | null;
    upgradePlanName: string | null;
    upgradePrice: string | null;
    trialDays: number;
  } {
    const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free")!;
    const plan = subscription && subscription.status === "active"
      ? this.getPlanById(subscription.planId as unknown as string) ?? freePlan
      : freePlan;
    const proPlan = DEFAULT_PLANS.find((p) => p.tier === "pro")!;
    const isUpgradeable = plan.tier === "free";

    return {
      tier: plan.tier,
      planName: plan.name,
      limits: {
        fhirSources: plan.features.maxFhirSources,
        profiles: plan.features.maxProfiles,
        documentStorageMb: plan.features.maxDocumentStorageMb,
      },
      features: {
        aiAssistant: plan.features.aiAssistant,
        advancedPacketSharing: plan.features.advancedPacketSharing,
        carePathways: plan.features.carePathways,
        iotIntegration: plan.features.iotIntegration,
        telehealth: plan.features.telehealth,
        careTeamSharing: plan.features.careTeamSharing,
        timelineView: plan.features.timelineView,
        drugSavings: plan.features.drugSavings,
        fqhcFinder: plan.features.fqhcFinder,
      },
      upgradeAvailable: isUpgradeable,
      upgradePlanId: isUpgradeable ? proPlan.id : null,
      upgradePlanName: isUpgradeable ? proPlan.name : null,
      upgradePrice: isUpgradeable ? this.formatPrice(proPlan.priceMonthly) : null,
      trialDays: isUpgradeable ? proPlan.trialDays : 0,
    };
  }

  checkProfileLimit(
    subscription: SubscriptionWithPlan | null,
    currentProfiles: number
  ): { allowed: boolean; limit: number; remaining: number } {
    const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free");
    const defaultLimit = freePlan?.features.maxProfiles ?? 1;

    if (!subscription || subscription.status !== "active") {
      return {
        allowed: currentProfiles < defaultLimit,
        limit: defaultLimit,
        remaining: Math.max(0, defaultLimit - currentProfiles),
      };
    }

    const plan = this.getPlanById(subscription.planId as unknown as string);
    const limit = plan?.features.maxProfiles ?? defaultLimit;

    return {
      allowed: currentProfiles < limit,
      limit,
      remaining: Math.max(0, limit - currentProfiles),
    };
  }

  calculateMonthlyPrice(
    planId: string,
    billingCycle: BillingCycle,
    providerCount?: number,
    memberCount?: number
  ): number {
    const plan = this.getPlanById(planId);
    if (!plan) return 0;

    if (plan.pricePerProvider && providerCount) {
      return plan.pricePerProvider * providerCount;
    }

    if (plan.pricePmpm && memberCount) {
      return plan.pricePmpm * memberCount;
    }

    if (billingCycle === "annual" && plan.priceAnnual) {
      return Math.round(plan.priceAnnual / 12);
    }

    return plan.priceMonthly;
  }

  calculateOutcomeIncentives(outcomes: OutcomeResult[]): number {
    return outcomes.reduce((total, outcome) => {
      if (outcome.targetMet) {
        return total + outcome.incentiveEarned;
      }
      return total;
    }, 0);
  }

  generateInvoiceLineItems(
    subscription: SubscriptionWithPlan,
    usage: BillingUsage
  ): Array<{ description: string; quantity: number; unitPrice: number; amount: number }> {
    const plan = this.getPlanById(subscription.planId as unknown as string);
    if (!plan) return [];

    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }> = [];

    if (plan.pricePerProvider && usage.providers > 0) {
      items.push({
        description: `${plan.name} - Provider Licenses`,
        quantity: usage.providers,
        unitPrice: plan.pricePerProvider,
        amount: plan.pricePerProvider * usage.providers,
      });
    } else if (plan.pricePmpm && usage.members > 0) {
      items.push({
        description: `${plan.name} - Member Coverage (PMPM)`,
        quantity: usage.members,
        unitPrice: plan.pricePmpm,
        amount: plan.pricePmpm * usage.members,
      });
    } else if (plan.priceMonthly > 0) {
      const cycle = subscription.billingCycle;
      const price =
        cycle === "annual" && plan.priceAnnual
          ? plan.priceAnnual
          : plan.priceMonthly;
      items.push({
        description: `${plan.name} Subscription (${cycle})`,
        quantity: 1,
        unitPrice: price,
        amount: price,
      });
    }

    if (subscription.addons) {
      const addons = subscription.addons as Record<string, boolean>;
      for (const addon of ENTERPRISE_ADDONS) {
        const key = addon.id.replace("addon_", "");
        if (addons[key]) {
          items.push({
            description: addon.name,
            quantity: 1,
            unitPrice: addon.priceMonthly,
            amount: addon.priceMonthly,
          });
        }
      }
    }

    return items;
  }

  formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  getSubscriptionSummary(subscription: SubscriptionWithPlan | null): {
    tier: SubscriptionTier;
    planName: string;
    status: SubscriptionStatus;
    features: PlanFeatures;
    nextBillingDate?: string;
    monthlyPrice: number;
  } {
    if (!subscription) {
      const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free")!;
      return {
        tier: "free",
        planName: freePlan.name,
        status: "active",
        features: freePlan.features,
        monthlyPrice: 0,
      };
    }

    const plan = this.getPlanById(subscription.planId as unknown as string);
    if (!plan) {
      const freePlan = DEFAULT_PLANS.find((p) => p.tier === "free")!;
      return {
        tier: "free",
        planName: freePlan.name,
        status: "active",
        features: freePlan.features,
        monthlyPrice: 0,
      };
    }

    return {
      tier: plan.tier,
      planName: plan.name,
      status: subscription.status,
      features: plan.features,
      nextBillingDate: subscription.currentPeriodEnd?.toISOString(),
      monthlyPrice: this.calculateMonthlyPrice(
        plan.id,
        subscription.billingCycle,
        subscription.providerCount ?? undefined,
        subscription.memberCount ?? undefined
      ),
    };
  }

  /**
   * Bulk entitlements lookup used by the client `useSubscription()` hook
   * and by the `requireFeature()` middleware. Returns the current tier,
   * a feature-key → boolean map covering all 24 gated features, and
   * any numeric limits. Legacy `PlanFeatures` shape is preserved as
   * `legacyFeatures` for backwards compatibility — do not remove.
   */
  getEntitlements(tier: SubscriptionTier): {
    tier: SubscriptionTier;
    features: Record<string, boolean>;
    limits: { maxProfiles: number };
    legacyFeatures: PlanFeatures;
  } {
    const plan =
      DEFAULT_PLANS.find((p) => p.tier === tier) ??
      DEFAULT_PLANS.find((p) => p.tier === "free")!;
    return {
      tier,
      features: entitlementsForTier(tier),
      limits: { maxProfiles: plan.features.maxProfiles },
      legacyFeatures: plan.features,
    };
  }

  getFeatureGates() {
    return FEATURE_GATES;
  }

  hipaaAuditLog(
    action: string,
    details: Record<string, unknown>,
    userId?: string
  ): void {
    console.log(
      `[HIPAA-AUDIT][Monetization] ${action}`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        action,
        ...details,
      })
    );
  }
}

export const monetizationService = new MonetizationService();
