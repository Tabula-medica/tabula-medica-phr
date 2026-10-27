/**
 * Subscription & Tier Service
 * ============================
 * Implements the Freemium-to-Enterprise pricing model per 2026 standards.
 *
 * Tiers:
 *   Basic (Free)      — Individual patients, basic record storage
 *   Professional       — Independent MDs / small clinics, $49–$99/mo
 *   Enterprise         — Health systems / ACOs / payers, custom licensing
 *   Government/NGO     — DoD, VA, NGO field deployments, custom
 *
 * Feature gates:
 *   - Basic:        Record storage, manual entry, 1 FHIR source, basic export
 *   - Professional: AI dedup, AI summaries, unlimited FHIR, bulk export, CDS, NPI lookup
 *   - Enterprise:   All Pro + TEFCA, ACO reporting, custom integrations, bulk users, SLA
 *   - Gov/NGO:      All Enterprise + field deployment, offline sync, custom BAA, HIPAA audit
 *
 * RevenueCat integration: This service manages the local tier state.
 * RevenueCat handles actual IAP/subscription billing through App Store / Play Store.
 * Apple IAP metadata never contains PHI — only user ID + tier.
 */

import type { Request, Response, NextFunction } from "express";

export type SubscriptionTier = "basic" | "professional" | "enterprise" | "government";
export type BillingCycle = "monthly" | "annual";

export interface TierDefinition {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  audience: string;
  price: {
    monthly: number | null;
    annual: number | null;
    custom: boolean;
  };
  features: string[];
  limits: {
    fhirSources: number;
    users: number;
    aiQueriesPerMonth: number;
    exportFormats: string[];
    storageGB: number;
  };
  highlighted: boolean;
  badge?: string;
  contactSales: boolean;
  revenueCatProductId?: {
    monthly?: string;
    annual?: string;
  };
}

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  status: "active" | "trial" | "expired" | "cancelled" | "grace_period";
  startDate: string;
  currentPeriodEnd: string;
  trialEndDate?: string;
  cancelAtPeriodEnd: boolean;
  revenueCatCustomerId?: string;
  features: string[];
}

export interface FeatureGate {
  feature: string;
  requiredTier: SubscriptionTier;
  description: string;
  upgradeMessage: string;
}

const TIER_DEFINITIONS: TierDefinition[] = [
  {
    id: "basic",
    name: "Basic",
    tagline: "Your health records, always with you",
    audience: "Individual Patients",
    price: { monthly: 0, annual: 0, custom: false },
    features: [
      "Health record storage",
      "Manual record entry",
      "1 FHIR data source",
      "Basic PDF export",
      "Medication list",
      "Appointment tracking",
      "Insurance card scanner",
      "Care Access finder",
      "Drug price lookup",
      "50-language support",
    ],
    limits: {
      fhirSources: 1,
      users: 1,
      aiQueriesPerMonth: 5,
      exportFormats: ["PDF"],
      storageGB: 1,
    },
    highlighted: false,
    badge: "Free forever",
    contactSales: false,
    revenueCatProductId: {},
  },
  {
    id: "professional",
    name: "Professional",
    tagline: "Clinical-grade tools for independent practice",
    audience: "Independent MDs / Small Clinics",
    price: { monthly: 79, annual: 790, custom: false },
    features: [
      "Everything in Basic",
      "AI record deduplication",
      "AI health summaries",
      "Unlimited FHIR sources",
      "Clinical decision support",
      "Prior authorization letters",
      "Drug interaction checker",
      "USPSTF care gap alerts",
      "NPI provider lookup",
      "Bulk FHIR export (JSON, C-CDA)",
      "Dental integrations (OpenDental, Dentrix, Eaglesoft)",
      "Good Faith Estimates",
      "Secure messaging",
      "Provider collaboration",
      "USCDI v6 compliance",
      "14-day free trial",
    ],
    limits: {
      fhirSources: -1,
      users: 5,
      aiQueriesPerMonth: 500,
      exportFormats: ["PDF", "JSON", "C-CDA", "FHIR Bundle"],
      storageGB: 25,
    },
    highlighted: true,
    badge: "Most popular",
    contactSales: false,
    revenueCatProductId: {
      monthly: "tm_professional_monthly",
      annual: "tm_professional_annual",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Scale across your organization",
    audience: "Health Systems / ACOs / Payers",
    price: { monthly: null, annual: null, custom: true },
    features: [
      "Everything in Professional",
      "TEFCA network hub",
      "ACO quality reporting (MSSP, MIPS)",
      "Epic / Cerner / Athena connectors",
      "Custom EHR integrations",
      "Bulk user provisioning (SSO/SAML)",
      "Enterprise analytics dashboard",
      "SOC 2 Type II compliance",
      "BAA agreements",
      "Dedicated support with SLA",
      "Custom branding",
      "HIPAA audit trail",
      "Data lineage tracking",
      "Population health benchmarks",
      "Workflow automation engine",
    ],
    limits: {
      fhirSources: -1,
      users: -1,
      aiQueriesPerMonth: -1,
      exportFormats: ["PDF", "JSON", "C-CDA", "FHIR Bundle", "X12", "HL7v2"],
      storageGB: -1,
    },
    highlighted: false,
    badge: "Custom pricing",
    contactSales: true,
    revenueCatProductId: {},
  },
  {
    id: "government",
    name: "Government & NGO",
    tagline: "Mission-critical for field deployment",
    audience: "DoD / VA / NGOs / Field Operations",
    price: { monthly: null, annual: null, custom: true },
    features: [
      "Everything in Enterprise",
      "Offline-first field deployment",
      "Disconnected sync protocol",
      "Military-grade encryption (FIPS 140-3)",
      "TRICARE / VA integration",
      "ID.me veteran verification",
      "Mass casualty triage workflows",
      "Multi-language field kits",
      "Satellite/mesh connectivity support",
      "Custom compliance frameworks",
      "Air-gapped deployment option",
      "Dedicated GovCloud hosting",
      "FedRAMP pathway support",
    ],
    limits: {
      fhirSources: -1,
      users: -1,
      aiQueriesPerMonth: -1,
      exportFormats: ["PDF", "JSON", "C-CDA", "FHIR Bundle", "X12", "HL7v2", "MilSTD"],
      storageGB: -1,
    },
    highlighted: false,
    badge: "Contact us",
    contactSales: true,
    revenueCatProductId: {},
  },
];

const FEATURE_GATES: FeatureGate[] = [
  { feature: "ai_dedup", requiredTier: "professional", description: "AI record deduplication", upgradeMessage: "Upgrade to Professional to automatically deduplicate records across sources." },
  { feature: "ai_summaries", requiredTier: "professional", description: "AI health summaries", upgradeMessage: "Upgrade to Professional for AI-powered health record summaries." },
  { feature: "unlimited_fhir", requiredTier: "professional", description: "Unlimited FHIR sources", upgradeMessage: "Upgrade to Professional to connect unlimited health systems." },
  { feature: "cds", requiredTier: "professional", description: "Clinical decision support", upgradeMessage: "Upgrade to Professional for prior auth letters, drug interactions, and care gap alerts." },
  { feature: "bulk_export", requiredTier: "professional", description: "Bulk export (JSON, C-CDA)", upgradeMessage: "Upgrade to Professional to export in FHIR JSON, C-CDA, and more formats." },
  { feature: "npi_lookup", requiredTier: "professional", description: "NPI provider lookup", upgradeMessage: "Upgrade to Professional for NPI provider search and verification." },
  { feature: "dental_integrations", requiredTier: "professional", description: "Dental system integrations", upgradeMessage: "Upgrade to Professional for OpenDental, Dentrix, and Eaglesoft integrations." },
  { feature: "secure_messaging", requiredTier: "professional", description: "Secure provider messaging", upgradeMessage: "Upgrade to Professional for HIPAA-compliant secure messaging." },
  { feature: "gfe", requiredTier: "professional", description: "Good Faith Estimates", upgradeMessage: "Upgrade to Professional to generate and receive Good Faith Estimates." },
  { feature: "family_hub", requiredTier: "professional", description: "Family member management", upgradeMessage: "Upgrade to Professional to add and manage family members in your account." },
  { feature: "provider_sharing", requiredTier: "professional", description: "Share records with providers", upgradeMessage: "Upgrade to Professional to share secure record links with providers." },
  { feature: "prior_auth", requiredTier: "professional", description: "Prior authorization letters", upgradeMessage: "Upgrade to Professional to generate prior authorization letters." },
  { feature: "drug_interactions", requiredTier: "professional", description: "Drug interaction checker", upgradeMessage: "Upgrade to Professional for drug interaction checking." },
  { feature: "care_gaps", requiredTier: "professional", description: "USPSTF care gap alerts", upgradeMessage: "Upgrade to Professional for USPSTF care gap alerts." },
  { feature: "provider_collaboration", requiredTier: "professional", description: "Provider collaboration tools", upgradeMessage: "Upgrade to Professional for provider collaboration tools." },
  { feature: "tefca", requiredTier: "enterprise", description: "TEFCA network hub", upgradeMessage: "Contact sales for Enterprise access to the TEFCA network hub." },
  { feature: "aco_reporting", requiredTier: "enterprise", description: "ACO quality reporting", upgradeMessage: "Contact sales for Enterprise ACO/MSSP quality reporting." },
  { feature: "custom_ehr", requiredTier: "enterprise", description: "Custom EHR integrations", upgradeMessage: "Contact sales for custom Epic, Cerner, or Athena integrations." },
  { feature: "sso_saml", requiredTier: "enterprise", description: "SSO/SAML provisioning", upgradeMessage: "Contact sales for Enterprise SSO and bulk user provisioning." },
  { feature: "soc2_compliance", requiredTier: "enterprise", description: "SOC 2 compliance dashboard", upgradeMessage: "Contact sales for Enterprise SOC 2 Type II compliance tools." },
  { feature: "baa_management", requiredTier: "enterprise", description: "BAA agreement management", upgradeMessage: "Contact sales for Enterprise BAA agreement workflows." },
  { feature: "field_deployment", requiredTier: "government", description: "Offline field deployment", upgradeMessage: "Contact us for Government/NGO field deployment capabilities." },
  { feature: "military_encryption", requiredTier: "government", description: "FIPS 140-3 encryption", upgradeMessage: "Contact us for military-grade FIPS 140-3 encryption." },
  { feature: "tricare_va", requiredTier: "government", description: "TRICARE/VA integration", upgradeMessage: "Contact us for TRICARE and VA system integration." },
];

const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  basic: 0,
  professional: 1,
  enterprise: 2,
  government: 3,
};

const userSubscriptions = new Map<string, UserSubscription>();

export function getTierDefinitions(): TierDefinition[] {
  return TIER_DEFINITIONS;
}

export function getTierDefinition(tier: SubscriptionTier): TierDefinition {
  return TIER_DEFINITIONS.find(t => t.id === tier) ?? TIER_DEFINITIONS[0];
}

export function getFeatureGates(): FeatureGate[] {
  return FEATURE_GATES;
}

export function getUserSubscription(userId: string): UserSubscription {
  const existing = userSubscriptions.get(userId);
  if (existing) return existing;

  const defaultSub: UserSubscription = {
    userId,
    tier: "basic",
    billingCycle: "monthly",
    status: "active",
    startDate: new Date().toISOString().split("T")[0],
    currentPeriodEnd: "2099-12-31",
    cancelAtPeriodEnd: false,
    features: TIER_DEFINITIONS[0].features,
  };
  userSubscriptions.set(userId, defaultSub);
  return defaultSub;
}

export function checkFeatureAccess(userId: string, feature: string): {
  allowed: boolean;
  currentTier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
  upgradeMessage?: string;
} {
  const sub = getUserSubscription(userId);
  const gate = FEATURE_GATES.find(g => g.feature === feature);

  if (!gate) return { allowed: true, currentTier: sub.tier };

  const currentLevel = TIER_HIERARCHY[sub.tier];
  const requiredLevel = TIER_HIERARCHY[gate.requiredTier];

  if (currentLevel >= requiredLevel) {
    return { allowed: true, currentTier: sub.tier };
  }

  return {
    allowed: false,
    currentTier: sub.tier,
    requiredTier: gate.requiredTier,
    upgradeMessage: gate.upgradeMessage,
  };
}

export function updateUserSubscription(
  userId: string,
  tier: SubscriptionTier,
  billingCycle: BillingCycle,
  revenueCatCustomerId?: string
): UserSubscription {
  const tierDef = getTierDefinition(tier);
  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "monthly") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  const sub: UserSubscription = {
    userId,
    tier,
    billingCycle,
    status: "active",
    startDate: now.toISOString().split("T")[0],
    currentPeriodEnd: periodEnd.toISOString().split("T")[0],
    cancelAtPeriodEnd: false,
    revenueCatCustomerId,
    features: tierDef.features,
  };
  userSubscriptions.set(userId, sub);
  return sub;
}

export function startTrial(userId: string): UserSubscription {
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const tierDef = getTierDefinition("professional");
  const sub: UserSubscription = {
    userId,
    tier: "professional",
    billingCycle: "monthly",
    status: "trial",
    startDate: now.toISOString().split("T")[0],
    currentPeriodEnd: trialEnd.toISOString().split("T")[0],
    trialEndDate: trialEnd.toISOString().split("T")[0],
    cancelAtPeriodEnd: false,
    features: tierDef.features,
  };
  userSubscriptions.set(userId, sub);
  return sub;
}

export function getComparison(): Array<{
  feature: string;
  basic: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
  government: boolean | string;
}> {
  return [
    { feature: "Health record storage", basic: true, professional: true, enterprise: true, government: true },
    { feature: "FHIR data sources", basic: "1", professional: "Unlimited", enterprise: "Unlimited", government: "Unlimited" },
    { feature: "AI deduplication", basic: false, professional: true, enterprise: true, government: true },
    { feature: "AI health summaries", basic: false, professional: true, enterprise: true, government: true },
    { feature: "AI queries / month", basic: "5", professional: "500", enterprise: "Unlimited", government: "Unlimited" },
    { feature: "Export formats", basic: "PDF", professional: "PDF, JSON, C-CDA", enterprise: "All formats", government: "All + MilSTD" },
    { feature: "Storage", basic: "1 GB", professional: "25 GB", enterprise: "Unlimited", government: "Unlimited" },
    { feature: "Users", basic: "1", professional: "5", enterprise: "Unlimited", government: "Unlimited" },
    { feature: "Clinical decision support", basic: false, professional: true, enterprise: true, government: true },
    { feature: "NPI lookup", basic: false, professional: true, enterprise: true, government: true },
    { feature: "Dental integrations", basic: false, professional: true, enterprise: true, government: true },
    { feature: "Secure messaging", basic: false, professional: true, enterprise: true, government: true },
    { feature: "TEFCA hub", basic: false, professional: false, enterprise: true, government: true },
    { feature: "ACO reporting", basic: false, professional: false, enterprise: true, government: true },
    { feature: "SSO / SAML", basic: false, professional: false, enterprise: true, government: true },
    { feature: "SOC 2 compliance", basic: false, professional: false, enterprise: true, government: true },
    { feature: "BAA management", basic: false, professional: false, enterprise: true, government: true },
    { feature: "Custom EHR integrations", basic: false, professional: false, enterprise: true, government: true },
    { feature: "Dedicated support + SLA", basic: false, professional: false, enterprise: true, government: true },
    { feature: "Offline field deployment", basic: false, professional: false, enterprise: false, government: true },
    { feature: "FIPS 140-3 encryption", basic: false, professional: false, enterprise: false, government: true },
    { feature: "TRICARE / VA integration", basic: false, professional: false, enterprise: false, government: true },
    { feature: "Air-gapped deployment", basic: false, professional: false, enterprise: false, government: true },
    { feature: "GovCloud hosting", basic: false, professional: false, enterprise: false, government: true },
  ];
}

/**
 * Express middleware factory that enforces a feature gate at the route level.
 * Must run AFTER an auth middleware that sets `_authenticatedUserId` on the request.
 * Returns 401 when no authenticated user is present, 403 when the user's tier
 * does not include the requested feature.
 */
export function requireFeature(feature: string) {
  return function featureGateMiddleware(req: Request, res: Response, next: NextFunction) {
    const headerUserId = req.headers?.["x-user-id"];
    const userId: string | undefined =
      (req as any)._authenticatedUserId ||
      (typeof headerUserId === "string" ? headerUserId : undefined);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const access = checkFeatureAccess(userId, feature);
    if (access.allowed) {
      return next();
    }

    return res.status(403).json({
      error: "Subscription upgrade required",
      code: "FEATURE_GATED",
      feature,
      currentTier: access.currentTier,
      requiredTier: access.requiredTier,
      upgradeMessage: access.upgradeMessage,
    });
  };
}

console.log("[Subscription] Tier service initialized");
console.log(`[Subscription] ${TIER_DEFINITIONS.length} tiers, ${FEATURE_GATES.length} feature gates`);
