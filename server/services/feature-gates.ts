import type { SubscriptionTier } from "@shared/schema";

export interface FeatureGateConfig {
  key: string;
  title: string;
  description: string;
  upgradeMessage: string;
  requiredTier: SubscriptionTier;
}

export const FEATURE_GATES: Record<string, FeatureGateConfig> = {
  ai_dedup: {
    key: "ai_dedup",
    title: "AI Record Deduplication",
    description: "Automatically detect and merge duplicate health records using AI.",
    upgradeMessage: "AI-powered deduplication is a Pro feature. Upgrade to consolidate duplicate records automatically.",
    requiredTier: "pro",
  },
  ai_summaries: {
    key: "ai_summaries",
    title: "AI Health Summaries",
    description: "Get AI-generated summaries of your medical history, lab results, and visits.",
    upgradeMessage: "AI summaries are a Pro feature. Upgrade to get instant insights from your records.",
    requiredTier: "pro",
  },
  pro_outcomes: {
    key: "pro_outcomes",
    title: "Patient-Reported Outcomes",
    description: "Track validated patient-reported outcome measures (PHQ-9, GAD-7, PROMIS-29) over time.",
    upgradeMessage: "Track validated patient-reported outcomes with Pro. Submit standardized questionnaires and watch your trends over time.",
    requiredTier: "pro",
  },
  unlimited_fhir: {
    key: "unlimited_fhir",
    title: "Unlimited FHIR Connections",
    description: "Connect to unlimited healthcare providers and EHR systems.",
    upgradeMessage: "Free tier limits FHIR connections. Upgrade to Pro for unlimited provider integrations.",
    requiredTier: "pro",
  },
  bulk_export: {
    key: "bulk_export",
    title: "Bulk FHIR Export",
    description: "Export your complete health record in FHIR-compliant bulk format.",
    upgradeMessage: "Bulk export is a Pro feature. Upgrade to download your complete health record.",
    requiredTier: "pro",
  },
  npi_lookup: {
    key: "npi_lookup",
    title: "NPI Provider Lookup",
    description: "Search and verify healthcare providers using the NPPES NPI registry.",
    upgradeMessage: "NPI lookup is a Pro feature. Upgrade to verify and connect with any U.S. healthcare provider.",
    requiredTier: "pro",
  },
  secure_messaging: {
    key: "secure_messaging",
    title: "Secure Provider Messaging",
    description: "HIPAA-compliant secure messaging with your care team.",
    upgradeMessage: "Secure messaging is a Pro feature. Upgrade to communicate directly with your providers.",
    requiredTier: "pro",
  },
  family_hub: {
    key: "family_hub",
    title: "Family Health Hub",
    description: "Manage health records for your family — children, parents, and dependents.",
    upgradeMessage: "Family Hub is a Pro feature. Upgrade to manage up to 6 family member profiles.",
    requiredTier: "pro",
  },
  provider_sharing: {
    key: "provider_sharing",
    title: "Provider Record Sharing",
    description: "Share your complete record with any healthcare provider via secure link.",
    upgradeMessage: "Provider sharing is a Pro feature. Upgrade to share your record with any provider in seconds.",
    requiredTier: "pro",
  },
  drug_interactions: {
    key: "drug_interactions",
    title: "Drug Interaction Checker",
    description: "Real-time drug interaction warnings across all your medications.",
    upgradeMessage: "Drug interaction alerts are a Pro feature. Upgrade for safety checks across all your medications.",
    requiredTier: "pro",
  },
  dental_integrations: {
    key: "dental_integrations",
    title: "Dental EHR Integrations",
    description: "Connect to OpenDental, Dentrix, and Eaglesoft dental practice systems.",
    upgradeMessage: "Dental integrations are a Concierge feature. Upgrade to connect with dental EHR systems.",
    requiredTier: "concierge",
  },
  gfe: {
    key: "gfe",
    title: "Good Faith Estimates",
    description: "No Surprises Act compliant Good Faith Estimates for self-pay patients.",
    upgradeMessage: "Good Faith Estimates are a Concierge feature. Upgrade for No Surprises Act compliance.",
    requiredTier: "concierge",
  },
  prior_auth: {
    key: "prior_auth",
    title: "Prior Authorization Workflow",
    description: "Streamlined prior authorization tracking and submission.",
    upgradeMessage: "Prior auth workflow is a Concierge feature. Upgrade to manage prior auths efficiently.",
    requiredTier: "concierge",
  },
  care_gaps: {
    key: "care_gaps",
    title: "Care Gap Identification",
    description: "AI-identified gaps in preventive care and recommended next steps.",
    upgradeMessage: "Care gap analysis is a Concierge feature. Upgrade to identify preventive care opportunities.",
    requiredTier: "concierge",
  },
  cds: {
    key: "cds",
    title: "Clinical Decision Support",
    description: "Evidence-based clinical decision support for providers.",
    upgradeMessage: "Clinical Decision Support is a Concierge feature. Upgrade to access evidence-based recommendations.",
    requiredTier: "concierge",
  },
  provider_collaboration: {
    key: "provider_collaboration",
    title: "Multi-Provider Collaboration",
    description: "Collaborative case review with multiple providers across organizations.",
    upgradeMessage: "Multi-provider collaboration is an Enterprise feature. Contact sales to enable.",
    requiredTier: "enterprise",
  },
  tefca: {
    key: "tefca",
    title: "TEFCA Network Participation",
    description: "TEFCA-compliant nationwide health information exchange.",
    upgradeMessage: "TEFCA participation is an Enterprise feature. Contact sales for QHIN onboarding.",
    requiredTier: "enterprise",
  },
  aco_reporting: {
    key: "aco_reporting",
    title: "ACO Quality Reporting",
    description: "MIPS, MSSP, and ACO REACH quality measure reporting.",
    upgradeMessage: "ACO reporting is an Enterprise feature. Contact sales for value-based care reporting.",
    requiredTier: "enterprise",
  },
  custom_ehr: {
    key: "custom_ehr",
    title: "Custom EHR Integrations",
    description: "Custom integrations with proprietary or legacy EHR systems.",
    upgradeMessage: "Custom EHR integrations are an Enterprise feature. Contact sales to discuss your systems.",
    requiredTier: "enterprise",
  },
  sso_saml: {
    key: "sso_saml",
    title: "SAML Single Sign-On",
    description: "Enterprise SSO via SAML 2.0 or OIDC identity providers.",
    upgradeMessage: "SAML SSO is an Enterprise feature. Contact sales to configure your identity provider.",
    requiredTier: "enterprise",
  },
  soc2_compliance: {
    key: "soc2_compliance",
    title: "SOC 2 Compliance Reporting",
    description: "SOC 2 Type II compliance dashboards and audit-ready reports.",
    upgradeMessage: "SOC 2 reporting is an Enterprise feature. Contact sales for compliance documentation.",
    requiredTier: "enterprise",
  },
  baa_management: {
    key: "baa_management",
    title: "BAA Management",
    description: "Business Associate Agreement lifecycle management for HIPAA compliance.",
    upgradeMessage: "BAA management is an Enterprise feature. Contact sales for compliance tooling.",
    requiredTier: "enterprise",
  },
  field_deployment: {
    key: "field_deployment",
    title: "Field/Tactical Deployment",
    description: "Offline-capable field deployment for tactical and disaster scenarios.",
    upgradeMessage: "Field deployment is an Enterprise feature. Contact sales for tactical configurations.",
    requiredTier: "enterprise",
  },
  military_encryption: {
    key: "military_encryption",
    title: "Military-Grade Encryption",
    description: "FIPS 140-2 / Suite B cryptography for federal/DoD deployments.",
    upgradeMessage: "Military-grade encryption is an Enterprise feature. Contact sales for federal deployments.",
    requiredTier: "enterprise",
  },
  tricare_va: {
    key: "tricare_va",
    title: "TRICARE / VA Integration",
    description: "Direct integration with TRICARE, VA, and DoD health systems.",
    upgradeMessage: "TRICARE/VA integration is an Enterprise feature. Contact sales for federal health system access.",
    requiredTier: "enterprise",
  },
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  concierge: 2,
  enterprise: 3,
};

export function tierIncludesFeature(
  userTier: SubscriptionTier,
  featureKey: string,
): boolean {
  const gate = FEATURE_GATES[featureKey];
  if (!gate) return false;
  return TIER_RANK[userTier] >= TIER_RANK[gate.requiredTier];
}

export function entitlementsForTier(
  userTier: SubscriptionTier,
): Record<string, boolean> {
  const features: Record<string, boolean> = {};
  for (const key of Object.keys(FEATURE_GATES)) {
    features[key] = tierIncludesFeature(userTier, key);
  }
  return features;
}

export function getFeatureGate(featureKey: string): FeatureGateConfig | undefined {
  return FEATURE_GATES[featureKey];
}
