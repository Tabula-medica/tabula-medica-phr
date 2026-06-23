import { useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Users,
  FileText,
  UserPlus,
  Database,
  Brain,
  Layers,
  Search,
  Stethoscope,
  MessageSquare,
  Heart,
  Share2,
  ShieldAlert,
  Pill,
  HeartPulse,
  Activity,
  Network,
  Globe2,
  BarChart3,
  Plug,
  KeyRound,
  ShieldCheck,
  FileSignature,
  Tent,
  Lock,
  Flag,
  Check,
  type LucideIcon,
} from "lucide-react";

export type UpgradeTrigger =
  // Original 5 mobile triggers
  | "fhir_limit"
  | "ai_feature"
  | "care_team"
  | "documents"
  | "profiles"
  // 24 gated feature keys
  | "ai_dedup"
  | "ai_summaries"
  | "pro_outcomes"
  | "unlimited_fhir"
  | "bulk_export"
  | "npi_lookup"
  | "secure_messaging"
  | "family_hub"
  | "provider_sharing"
  | "drug_interactions"
  | "dental_integrations"
  | "gfe"
  | "prior_auth"
  | "care_gaps"
  | "cds"
  | "provider_collaboration"
  | "tefca"
  | "aco_reporting"
  | "custom_ehr"
  | "sso_saml"
  | "soc2_compliance"
  | "baa_management"
  | "field_deployment"
  | "military_encryption"
  | "tricare_va";

export type RequiredTier = "pro" | "concierge" | "enterprise";

interface PromptConfig {
  title: string;
  description: string;
  icon: LucideIcon;
  proFeatures: string[];
  /** Optional override; defaults are derived from requiredTier. */
  ctaLabel?: string;
  ctaHref?: string;
  /** Default tier when caller doesn't supply one. Falls back to "pro". */
  defaultTier?: RequiredTier;
}

const PROMPT_CONFIG: Record<UpgradeTrigger, PromptConfig> = {
  // ===== Original 5 mobile-parity triggers =====
  fhir_limit: {
    title: "Connect More Providers",
    description: "You've reached the free tier connection limit. Upgrade to Pro for unlimited FHIR provider integrations.",
    icon: Database,
    proFeatures: ["Unlimited FHIR connections", "Auto-sync across providers", "Priority sync queue"],
    defaultTier: "pro",
  },
  ai_feature: {
    title: "Unlock AI Insights",
    description: "AI-powered features help you understand your health data faster. Available with Pro.",
    icon: Brain,
    proFeatures: ["AI health summaries", "Smart deduplication", "Natural language search"],
    defaultTier: "pro",
  },
  care_team: {
    title: "Expand Your Care Team",
    description: "Invite more providers and family members to your care team with Pro.",
    icon: Users,
    proFeatures: ["Unlimited care team members", "Provider messaging", "Shared care plans"],
    defaultTier: "pro",
  },
  documents: {
    title: "Unlock Document Features",
    description: "Upload, organize, and share unlimited medical documents with Pro.",
    icon: FileText,
    proFeatures: ["Unlimited document storage", "OCR + AI tagging", "Secure provider sharing"],
    defaultTier: "pro",
  },
  profiles: {
    title: "Add Family Profiles",
    description: "Manage health records for your entire family with up to 6 profiles on Pro.",
    icon: UserPlus,
    proFeatures: ["Up to 6 family profiles", "Pediatric tracking", "Dependent management"],
    defaultTier: "pro",
  },

  // ===== Pro tier features =====
  ai_dedup: {
    title: "AI Record Deduplication",
    description: "Automatically detect and merge duplicate health records using AI.",
    icon: Layers,
    proFeatures: ["Cross-provider duplicate detection", "Smart merge with conflict resolution", "Audit trail of merges"],
    defaultTier: "pro",
  },
  ai_summaries: {
    title: "AI Health Summaries",
    description: "Get AI-generated summaries of your medical history, lab results, and visits.",
    icon: Sparkles,
    proFeatures: ["Visit summary generation", "Lab result explanations", "Care plan summaries"],
    defaultTier: "pro",
  },
  pro_outcomes: {
    title: "Patient-Reported Outcomes",
    description: "Track validated PRO measures like PHQ-9 and GAD-7 to see your progress over time.",
    icon: Activity,
    proFeatures: ["PHQ-9, GAD-7 & PROMIS-29 instruments", "Auto-scored severity bands", "Trend visualization over time"],
    defaultTier: "pro",
  },
  unlimited_fhir: {
    title: "Unlimited FHIR Connections",
    description: "Connect to unlimited healthcare providers and EHR systems.",
    icon: Database,
    proFeatures: ["No connection cap", "All major EHRs supported", "Background sync"],
    defaultTier: "pro",
  },
  bulk_export: {
    title: "Bulk FHIR Export",
    description: "Export your complete health record in FHIR-compliant bulk format.",
    icon: FileText,
    proFeatures: ["FHIR R4 bulk export", "Multiple format options", "Scheduled exports"],
    defaultTier: "pro",
  },
  npi_lookup: {
    title: "NPI Provider Lookup",
    description: "Search and verify healthcare providers using the NPPES NPI registry.",
    icon: Search,
    proFeatures: ["Full NPPES registry access", "Provider verification", "Specialty filtering"],
    defaultTier: "pro",
  },
  secure_messaging: {
    title: "Secure Provider Messaging",
    description: "HIPAA-compliant secure messaging with your care team.",
    icon: MessageSquare,
    proFeatures: ["End-to-end encrypted messages", "File attachments", "Read receipts"],
    defaultTier: "pro",
  },
  family_hub: {
    title: "Family Health Hub",
    description: "Manage health records for your family — children, parents, and dependents.",
    icon: Heart,
    proFeatures: ["Up to 6 family profiles", "Pediatric milestone tracking", "Caregiver permissions"],
    defaultTier: "pro",
  },
  provider_sharing: {
    title: "Provider Record Sharing",
    description: "Share your complete record with any healthcare provider via secure link.",
    icon: Share2,
    proFeatures: ["One-click secure sharing", "Time-limited access", "Audit log of views"],
    defaultTier: "pro",
  },
  drug_interactions: {
    title: "Drug Interaction Checker",
    description: "Real-time drug interaction warnings across all your medications.",
    icon: Pill,
    proFeatures: ["Real-time interaction alerts", "Allergy cross-checks", "Severity ratings"],
    defaultTier: "pro",
  },

  // ===== Concierge tier features =====
  dental_integrations: {
    title: "Dental EHR Integrations",
    description: "Connect to OpenDental, Dentrix, and Eaglesoft dental practice systems.",
    icon: Stethoscope,
    proFeatures: ["OpenDental integration", "Dentrix integration", "Eaglesoft integration"],
    defaultTier: "concierge",
  },
  gfe: {
    title: "Good Faith Estimates",
    description: "No Surprises Act compliant Good Faith Estimates for self-pay patients.",
    icon: FileSignature,
    proFeatures: ["NSA-compliant GFE generation", "Patient-facing estimates", "Estimate vs. actual tracking"],
    defaultTier: "concierge",
  },
  prior_auth: {
    title: "Prior Authorization Workflow",
    description: "Streamlined prior authorization tracking and submission.",
    icon: ShieldAlert,
    proFeatures: ["Auth status tracking", "Payer integration", "Approval timeline alerts"],
    defaultTier: "concierge",
  },
  care_gaps: {
    title: "Care Gap Identification",
    description: "AI-identified gaps in preventive care and recommended next steps.",
    icon: HeartPulse,
    proFeatures: ["Preventive care gap analysis", "USPSTF recommendation matching", "Personalized action items"],
    defaultTier: "concierge",
  },
  cds: {
    title: "Clinical Decision Support",
    description: "Evidence-based clinical decision support for providers.",
    icon: Activity,
    proFeatures: ["CDS Hooks integration", "Evidence-based alerts", "Clinical pathway guidance"],
    defaultTier: "concierge",
  },

  // ===== Enterprise tier features =====
  provider_collaboration: {
    title: "Multi-Provider Collaboration",
    description: "Collaborative case review with multiple providers across organizations.",
    icon: Network,
    proFeatures: ["Cross-org case review", "Secure provider chat", "Shared care plans"],
    defaultTier: "enterprise",
  },
  tefca: {
    title: "TEFCA Network Participation",
    description: "TEFCA-compliant nationwide health information exchange.",
    icon: Globe2,
    proFeatures: ["QHIN connectivity", "Nationwide HIE", "RCE-compliant workflows"],
    defaultTier: "enterprise",
  },
  aco_reporting: {
    title: "ACO Quality Reporting",
    description: "MIPS, MSSP, and ACO REACH quality measure reporting.",
    icon: BarChart3,
    proFeatures: ["MIPS reporting", "MSSP measure tracking", "ACO REACH dashboards"],
    defaultTier: "enterprise",
  },
  custom_ehr: {
    title: "Custom EHR Integrations",
    description: "Custom integrations with proprietary or legacy EHR systems.",
    icon: Plug,
    proFeatures: ["Bespoke EHR connectors", "HL7 v2 / FHIR bridging", "Dedicated integration engineer"],
    defaultTier: "enterprise",
  },
  sso_saml: {
    title: "SAML Single Sign-On",
    description: "Enterprise SSO via SAML 2.0 or OIDC identity providers.",
    icon: KeyRound,
    proFeatures: ["SAML 2.0 / OIDC", "SCIM provisioning", "Just-in-time user creation"],
    defaultTier: "enterprise",
  },
  soc2_compliance: {
    title: "SOC 2 Compliance Reporting",
    description: "SOC 2 Type II compliance dashboards and audit-ready reports.",
    icon: ShieldCheck,
    proFeatures: ["Type II evidence collection", "Auditor-ready reports", "Continuous control monitoring"],
    defaultTier: "enterprise",
  },
  baa_management: {
    title: "BAA Management",
    description: "Business Associate Agreement lifecycle management for HIPAA compliance.",
    icon: FileSignature,
    proFeatures: ["BAA template library", "E-signature workflow", "Renewal tracking"],
    defaultTier: "enterprise",
  },
  field_deployment: {
    title: "Field/Tactical Deployment",
    description: "Offline-capable field deployment for tactical and disaster scenarios.",
    icon: Tent,
    proFeatures: ["Offline-first sync", "Mesh networking support", "Ruggedized device packages"],
    defaultTier: "enterprise",
  },
  military_encryption: {
    title: "Military-Grade Encryption",
    description: "FIPS 140-2 / Suite B cryptography for federal/DoD deployments.",
    icon: Lock,
    proFeatures: ["FIPS 140-2 validated modules", "Suite B cryptography", "DoD STIG compliance"],
    defaultTier: "enterprise",
  },
  tricare_va: {
    title: "TRICARE / VA Integration",
    description: "Direct integration with TRICARE, VA, and DoD health systems.",
    icon: Flag,
    proFeatures: ["VA VistA integration", "TRICARE eligibility", "DoD MHS GENESIS connectivity"],
    defaultTier: "enterprise",
  },
};

// Tier display metadata. Single source of truth for label, badge color, CTA, and price hint.
export const TIER_DISPLAY: Record<RequiredTier, {
  label: string;
  badgeClass: string;
  ctaLabel: string;
  ctaHref: string;
  priceHint: string;
}> = {
  pro: {
    label: "Pro",
    badgeClass: "bg-primary/15 text-primary border-primary/30",
    ctaLabel: "Upgrade to Pro",
    ctaHref: "/billing-dashboard?plan=pro",
    priceHint: "$9.99/mo · cancel anytime",
  },
  concierge: {
    label: "Concierge",
    badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    ctaLabel: "Upgrade to Concierge",
    ctaHref: "/billing-dashboard?plan=concierge",
    priceHint: "Premium plan · concierge support included",
  },
  enterprise: {
    label: "Enterprise",
    badgeClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
    ctaLabel: "Contact Sales",
    ctaHref: "/billing-dashboard?plan=enterprise",
    priceHint: "Custom pricing · talk to our team",
  },
};

export interface SoftUpgradePromptProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: UpgradeTrigger;
  /** Server-supplied title takes precedence over static config. */
  overrideTitle?: string;
  /** Server-supplied description (e.g., from a 403 upgradeMessage). */
  overrideDescription?: string;
  /** Required tier — drives badge, CTA label, and price hint. Falls back to config.defaultTier or "pro". */
  requiredTier?: RequiredTier;
  /** Current user tier — shown contextually so the user understands the upgrade path. */
  currentTier?: "free" | RequiredTier;
  /** Current usage count against a tier limit (e.g., FHIR connections used). */
  currentUsage?: number;
  /** The tier limit the usage is measured against. */
  limit?: number;
  /** Server-supplied upgrade price hint (e.g., "$9.99/mo"). */
  upgradePrice?: string;
  /** Server-supplied trial length in days. */
  trialDays?: number;
}

export function SoftUpgradePrompt({
  open,
  onOpenChange,
  trigger,
  overrideTitle,
  overrideDescription,
  requiredTier,
  currentTier,
  currentUsage,
  limit,
  upgradePrice,
  trialDays,
}: SoftUpgradePromptProps) {
  const config = PROMPT_CONFIG[trigger];
  if (!config) {
    console.warn(`[SoftUpgradePrompt] unknown trigger: ${trigger}`);
    return null;
  }

  const Icon = config.icon;
  const tier: RequiredTier = requiredTier ?? config.defaultTier ?? "pro";
  const tierMeta = TIER_DISPLAY[tier];

  const title = overrideTitle ?? config.title;
  const description = overrideDescription ?? config.description;
  const ctaLabel = config.ctaLabel ?? tierMeta.ctaLabel;
  const ctaHref = config.ctaHref ?? tierMeta.ctaHref;

  // Prefer server-supplied price/trial hints when provided; otherwise fall back to static tier metadata.
  const priceHint = [
    upgradePrice,
    typeof trialDays === "number" && trialDays > 0 ? `${trialDays}-day free trial` : undefined,
  ]
    .filter(Boolean)
    .join(" · ") || tierMeta.priceHint;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid={`dialog-upgrade-${trigger}`}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle data-testid={`text-upgrade-title-${trigger}`}>{title}</DialogTitle>
                <Badge
                  variant="outline"
                  className={tierMeta.badgeClass}
                  data-testid={`badge-required-tier-${trigger}`}
                >
                  {tierMeta.label}
                </Badge>
              </div>
              {currentTier && currentTier !== tier && (
                <p className="text-xs text-muted-foreground mt-1" data-testid={`text-current-tier-${trigger}`}>
                  You're on <span className="font-medium capitalize">{currentTier}</span>
                </p>
              )}
            </div>
          </div>
          <DialogDescription className="pt-2" data-testid={`text-upgrade-description-${trigger}`}>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm font-medium text-foreground mb-2">What you'll get:</p>
          <ul className="space-y-1.5">
            {config.proFeatures.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {typeof currentUsage === "number" && typeof limit === "number" && (
            <p
              className="text-xs text-muted-foreground mt-3"
              data-testid={`text-usage-${trigger}`}
            >
              You've used <span className="font-medium">{currentUsage}</span> of{" "}
              <span className="font-medium">{limit}</span> on your current plan.
            </p>
          )}
          <p
            className="text-xs text-muted-foreground mt-3 italic"
            data-testid={`text-price-hint-${trigger}`}
          >
            {priceHint}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange?.(false)}
            data-testid={`button-upgrade-dismiss-${trigger}`}
          >
            Maybe Later
          </Button>
          <Link href={ctaHref}>
            <Button
              onClick={() => onOpenChange?.(false)}
              data-testid={`button-upgrade-cta-${trigger}`}
            >
              {ctaLabel}
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convenience hook for pages that want to manage their own SoftUpgradePrompt
 * state inline (e.g., when a user clicks a Pro action client-side).
 */
export function useSoftUpgradePrompt(initialTrigger?: UpgradeTrigger) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<UpgradeTrigger>(initialTrigger ?? "fhir_limit");

  const show = (t: UpgradeTrigger) => {
    setTrigger(t);
    setOpen(true);
  };

  return { open, setOpen, trigger, show };
}

export const UPGRADE_PROMPT_KEYS = Object.keys(PROMPT_CONFIG) as UpgradeTrigger[];

// TODO(build-repair): minimal stub for missing Replit-snapshot component — verify UX
/**
 * Modal upgrade dialog. Thin wrapper over {@link SoftUpgradePrompt} (which already
 * renders inside a shadcn Dialog) so callers can use a dialog-flavored name and
 * pass usage context (currentUsage/limit) plus server-supplied price/trial hints.
 */
export interface UpgradeDialogProps extends SoftUpgradePromptProps {}

export function UpgradeDialog(props: UpgradeDialogProps) {
  return <SoftUpgradePrompt {...props} />;
}

// TODO(build-repair): minimal stub for missing Replit-snapshot component — verify UX
export interface InlineFhirLimitBannerProps {
  /** Connections used against the free-tier FHIR limit. */
  used: number;
  /** The free-tier FHIR connection limit. */
  limit: number;
  /** Server-supplied upgrade price hint (e.g., "$9.99/mo"). */
  upgradePrice?: string;
  /** Server-supplied trial length in days. */
  trialDays?: number;
}

/**
 * Inline (non-modal) banner shown on the connections page when a free-tier user
 * is at/near their FHIR connection limit. Renders real upgrade UI with a CTA to
 * the billing page — does not return null.
 */
export function InlineFhirLimitBanner({
  used,
  limit,
  upgradePrice,
  trialDays,
}: InlineFhirLimitBannerProps) {
  const tierMeta = TIER_DISPLAY.pro;
  const priceHint = [
    upgradePrice,
    typeof trialDays === "number" && trialDays > 0 ? `${trialDays}-day free trial` : undefined,
  ]
    .filter(Boolean)
    .join(" · ") || tierMeta.priceHint;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid="banner-fhir-limit"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Database className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {used >= limit
              ? "You've reached your free connection limit"
              : "You're approaching your free connection limit"}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">{used}</span> of{" "}
            <span className="font-medium">{limit}</span> connection
            {limit !== 1 ? "s" : ""} used. Upgrade to Pro for unlimited FHIR provider integrations.
            {priceHint ? <span className="italic"> {priceHint}.</span> : null}
          </p>
        </div>
      </div>
      <Link href={tierMeta.ctaHref} className="flex-shrink-0">
        <Button size="sm" data-testid="button-fhir-limit-upgrade">
          {tierMeta.ctaLabel}
        </Button>
      </Link>
    </div>
  );
}
