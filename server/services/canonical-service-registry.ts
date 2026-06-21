/**
 * Canonical Service Registry
 * 
 * Documents the authoritative service for each domain to prevent
 * duplicate implementations and ensure consistent behavior.
 * 
 * When adding new functionality, check this registry first to find
 * the correct service to extend rather than creating a new one.
 * 
 * DEPRECATION POLICY:
 * - Services marked [DEPRECATED] should be migrated to the canonical service
 * - Deprecated services re-export from canonical to maintain backward compatibility
 * - New code MUST use canonical services only
 */

export const CANONICAL_SERVICES = {
  providerDashboard: {
    canonical: "server/services/ai-provider-dashboard-service.ts",
    deprecated: ["server/services/aiProviderDashboardService.ts"],
    description: "AI Provider Dashboard with patient summary, referral letters, differential dx, trend analysis, clinical notes",
  },

  patientSummary: {
    canonical: "server/services/patient-summary-generator-service.ts",
    deprecated: [
      "server/services/ai-patient-summary-service.ts",
      "server/services/ai-patient-summary-generator.ts",
    ],
    related: ["server/services/ai-patient-summary-enrichment-service.ts"],
    description: "Patient record summary generation with FHIR integration, role-based views, and data quality flags",
  },

  healthJourney: {
    canonical: "server/services/enhanced-health-journey-service.ts",
    deprecated: [
      "server/services/healthJourneyService.ts",
      "server/services/medical-journey-service.ts",
      "server/services/ai-journey-summary-service.ts",
    ],
    related: [
      "server/services/enhanced-ai-health-journey-service.ts",
      "server/services/personalized-health-journey-service.ts",
      "server/services/ai-personalized-care-journey-service.ts",
      "server/services/health-graph-service.ts",
      "server/services/ai-patient-journey-explorer.ts",
      "server/services/journeyAnalyticsService.ts",
    ],
    description: "Unified longitudinal health journey with timeline, milestones, and AI analysis",
  },

  patientEducation: {
    canonical: "server/services/ai-patient-education-hub.ts",
    deprecated: [
      "server/services/patientEducation.ts",
      "server/services/ai-patient-education-module-service.ts",
    ],
    related: [
      "server/services/educationLibraryService.ts",
      "server/services/educationRecommendationService.ts",
      "server/services/patientEducationMessagingService.ts",
    ],
    description: "AI-powered patient education with personalized content, literacy-aware delivery",
  },

  carePlan: {
    canonical: "server/services/aiCarePlanService.ts",
    deprecated: [
      "server/services/aiCarePlanDraftService.ts",
    ],
    related: [
      "server/services/aiCarePlanAutomation.ts",
      "server/services/collaborativeCarePlan.ts",
    ],
    description: "AI-assisted care plan generation and management",
  },

  careTeam: {
    canonical: "server/services/careTeamCollaboration.ts",
    deprecated: [
      "server/services/careTeamCollaborationService.ts",
    ],
    related: [
      "server/services/provider-care-collaboration-service.ts",
      "server/services/provider-collaboration-hub-service.ts",
      "server/services/clinician-collaboration.ts",
      "server/services/caregiver-collaboration-service.ts",
    ],
    description: "Care team management with secure messaging and collaboration",
  },

  patientEngagement: {
    canonical: "server/services/aiPatientEngagement.ts",
    deprecated: [
      "server/services/ai-patient-engagement-service.ts",
      "server/services/ai-personalized-engagement.ts",
    ],
    related: [
      "server/services/patient-engagement-hub-service.ts",
      "server/services/patient-engagement-service.ts",
      "server/services/ai-proactive-patient-engagement-chatbot-service.ts",
    ],
    description: "AI-powered patient engagement with behavior-driven content and nudges",
  },

  patientOutreach: {
    canonical: "server/services/aiOutreachOrchestrator.ts",
    deprecated: [
      "server/services/aiPatientOutreachService.ts",
      "server/services/ai-patient-outreach-service.ts",
    ],
    related: [
      "server/services/patient-outreach-service.ts",
      "server/services/careTeamOutreachService.ts",
    ],
    description: "Automated patient outreach with multi-channel delivery",
  },

  dataHarmonization: {
    canonical: "server/services/ai-fhir-data-harmonization-service.ts",
    deprecated: [
      "server/services/ai-data-harmonization-service.ts",
      "server/services/ai-fhir-harmonization-engine.ts",
    ],
    related: [
      "server/services/ai-fhir-harmonization-enhanced.ts",
      "server/services/ai-fhir-data-standardization.ts",
      "server/services/ai-fhir-advanced-standardization.ts",
      "server/services/ai-fhir-transformation.ts",
      "server/services/ai-harmonization-assistant.ts",
      "server/services/fhir-custom-mapping-engine.ts",
      "server/services/fhir-standards-mapping-service.ts",
    ],
    description: "FHIR data harmonization with terminology mapping and quality assurance",
  },

  riskStratification: {
    canonical: "server/services/ai-risk-stratification-service.ts",
    deprecated: [
      "server/services/aiPatientRiskStratification.ts",
    ],
    related: [
      "server/services/ai-predictive-risk-engine.ts",
      "server/services/predictiveAnalytics.ts",
      "server/services/predictive-analytics-service.ts",
    ],
    description: "AI risk stratification with population health analytics",
  },

  auditTrail: {
    canonical: "server/services/comprehensive-audit-trail-service.ts",
    related: [
      "server/services/worm-audit-log-service.ts",
      "server/services/ai-audit-log-enrichment-service.ts",
      "server/services/ai-audit-engine.ts",
      "server/services/ai-audit-log-analyzer.ts",
      "server/services/clinician-audit-service.ts",
      "server/services/fhir-audit-service.ts",
    ],
    description: "HIPAA-compliant audit trail with WORM storage and AI enrichment",
  },

  deduplication: {
    canonical: "server/services/deduplication-engine-service.ts",
    related: [
      "server/services/ai-patient-reconciliation-engine.ts",
      "server/services/data-reconciliation-service.ts",
    ],
    description: "Patient deduplication with NMN matching and confidence scoring",
  },

  communication: {
    canonical: "server/services/unified-communication-hub-service.ts",
    deprecated: [
      "server/services/patientCommunication.ts",
      "server/services/aiCommunication.ts",
    ],
    related: [
      "server/services/aiPatientCommunicationService.ts",
      "server/services/ai-communication-analytics-service.ts",
      "server/services/provider-communication-service.ts",
      "server/services/provider-communication-portal-service.ts",
    ],
    description: "Unified messaging, appointments, telehealth, and document sharing",
  },
} as const;

export type ServiceDomain = keyof typeof CANONICAL_SERVICES;

export function getCanonicalService(domain: ServiceDomain): string {
  return CANONICAL_SERVICES[domain].canonical;
}

export function isDeprecated(filePath: string): boolean {
  for (const domain of Object.values(CANONICAL_SERVICES)) {
    if ("deprecated" in domain && (domain.deprecated as readonly string[]).includes(filePath)) {
      return true;
    }
  }
  return false;
}
