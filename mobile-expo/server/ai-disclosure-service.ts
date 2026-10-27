/**
 * AI Disclosure Service — 1.5 Jurisdiction-aware AI disclosure layer
 *
 * Implements state AI-law disclaimers for:
 *   - California AB 3030 (AI-generated patient clinical communications)
 *   - Colorado AI Act (effective June 30, 2026)
 *   - Texas TRAIGA (effective Jan 1, 2026)
 *   - Utah AI Disclosure Act
 *
 * Every AI-drafted patient message carries { ai_generated: true, clinician_reviewed: bool }.
 * The send pipeline calls appendDisclaimer() which appends or suppresses the notice
 * based on the practice's jurisdiction + whether a clinician reviewed the message.
 */

export interface PracticeAiConfig {
  practiceId: string;
  state: string;
  aiDisclosureRequired: boolean;
  clinicianReviewSuppressesDisclaimer: boolean;
}

export interface AiMessageMeta {
  ai_generated: boolean;
  clinician_reviewed: boolean;
  model_used?: string;
  generated_at?: string;
}

export interface DisclosureResult {
  shouldAppend: boolean;
  disclaimerText: string | null;
  legalBasis: string | null;
}

const STATE_LAWS: Record<string, {
  name: string;
  effectiveDate: string;
  requiresDisclosure: boolean;
  suppressibleByClinicianReview: boolean;
  disclaimer: string;
}> = {
  CA: {
    name: "California AB 3030",
    effectiveDate: "2025-01-01",
    requiresDisclosure: true,
    suppressibleByClinicianReview: true,
    disclaimer:
      "This message was generated with the assistance of artificial intelligence. " +
      "It has not been reviewed by a licensed healthcare provider. " +
      "Please consult your care team for medical advice.",
  },
  CO: {
    name: "Colorado Artificial Intelligence Act",
    effectiveDate: "2026-06-30",
    requiresDisclosure: true,
    suppressibleByClinicianReview: false,
    disclaimer:
      "Artificial intelligence was used to assist in preparing this communication. " +
      "For questions about your care, please contact your healthcare provider.",
  },
  TX: {
    name: "Texas Responsible AI Governance Act (TRAIGA)",
    effectiveDate: "2026-01-01",
    requiresDisclosure: true,
    suppressibleByClinicianReview: true,
    disclaimer:
      "This communication was prepared with AI assistance. " +
      "Your healthcare provider remains responsible for your care.",
  },
  UT: {
    name: "Utah Artificial Intelligence Policy Act",
    effectiveDate: "2024-05-01",
    requiresDisclosure: true,
    suppressibleByClinicianReview: true,
    disclaimer:
      "AI technology was used to help generate this message. " +
      "Please reach out to your care team with any health concerns.",
  },
};

const DEFAULT_CONFIG: Omit<PracticeAiConfig, "practiceId" | "state"> = {
  aiDisclosureRequired: false,
  clinicianReviewSuppressesDisclaimer: true,
};

const practiceConfigs = new Map<string, PracticeAiConfig>();

export function setPracticeAiConfig(config: PracticeAiConfig): void {
  practiceConfigs.set(config.practiceId, config);
}

export function getPracticeAiConfig(practiceId: string, state?: string): PracticeAiConfig {
  const stored = practiceConfigs.get(practiceId);
  if (stored) return stored;

  const stateCode = (state || "").toUpperCase();
  const law = STATE_LAWS[stateCode];
  return {
    practiceId,
    state: stateCode,
    aiDisclosureRequired: law?.requiresDisclosure ?? DEFAULT_CONFIG.aiDisclosureRequired,
    clinicianReviewSuppressesDisclaimer:
      law?.suppressibleByClinicianReview ?? DEFAULT_CONFIG.clinicianReviewSuppressesDisclaimer,
  };
}

export function evaluateDisclosure(
  config: PracticeAiConfig,
  meta: AiMessageMeta
): DisclosureResult {
  if (!meta.ai_generated) {
    return { shouldAppend: false, disclaimerText: null, legalBasis: null };
  }

  if (!config.aiDisclosureRequired) {
    return { shouldAppend: false, disclaimerText: null, legalBasis: null };
  }

  const law = STATE_LAWS[config.state.toUpperCase()];
  if (!law) {
    return { shouldAppend: false, disclaimerText: null, legalBasis: null };
  }

  if (meta.clinician_reviewed && law.suppressibleByClinicianReview) {
    return {
      shouldAppend: false,
      disclaimerText: null,
      legalBasis: `${law.name} — disclaimer suppressed by clinician review`,
    };
  }

  return {
    shouldAppend: true,
    disclaimerText: law.disclaimer,
    legalBasis: law.name,
  };
}

export function appendDisclaimer(
  messageBody: string,
  config: PracticeAiConfig,
  meta: AiMessageMeta
): { body: string; disclosureAppended: boolean; legalBasis: string | null } {
  const result = evaluateDisclosure(config, meta);
  if (!result.shouldAppend || !result.disclaimerText) {
    return { body: messageBody, disclosureAppended: false, legalBasis: result.legalBasis };
  }

  const separator = messageBody.trim().endsWith("\n") ? "\n" : "\n\n";
  return {
    body: `${messageBody}${separator}---\n${result.disclaimerText}`,
    disclosureAppended: true,
    legalBasis: result.legalBasis,
  };
}

export function buildAiMessageMeta(
  modelUsed: string,
  clinicianReviewed = false
): AiMessageMeta {
  return {
    ai_generated: true,
    clinician_reviewed: clinicianReviewed,
    model_used: modelUsed,
    generated_at: new Date().toISOString(),
  };
}

export function getStateLaws(): typeof STATE_LAWS {
  return STATE_LAWS;
}

export function getSupportedJurisdictions(): string[] {
  return Object.keys(STATE_LAWS);
}
