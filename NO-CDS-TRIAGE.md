# PHR `server/services/` — NO-CDS Triage (2026-06-22)

The Cloud Build `medical-safety-checks` gate flags 85 AI service files lacking a
"NO-CDS" marker. Triaged by **what the code actually does** (AI prompt + how output
is used), against FDA Non-Device CDS criteria (21st Century Cures Act §3060 / FDA
2022 final guidance). None analyze raw images/signals — exposure is on the
*recommendation* prong (does it drive clinical management?).

**Result: 52 NON-CDS (safe to mark) · 33 CDS-REVIEW (do NOT mark without counsel).**

⚠️ Stamping the 52 NON-CDS files will **not** turn the build green — the gate fails
until all 85 are resolved. The 33 below are a material regulatory question
(potential device-CDS / SaMD), not a code chore. Disclaimers ("informational only")
do **not** change what the output is — most of these carry them and are still CDS.

---

## 33 CDS-REVIEW — needs human/counsel disposition

### Tier A — strongest CDS (prompt self-identifies as CDS, or textbook safety alerting)
- `aiCarePlanAutomation.ts` — full care plans w/ med/treatment recs; prompt = "clinical decision support"
- `aiCarePlanDraftService.ts` — med-dosing + care-plan drafts
- `collaborativeCarePlan.ts` — intervention/goal change suggestions; prompt = "clinical decision support AI"
- `aiProactiveMonitoring.ts` — early-warning alerts + intervention recs; prompt = "clinical decision support AI"
- `remoteMonitoring.ts` — RPM deterioration alerts; prompt = "clinical decision support system"
- `providerPortal.ts` — clinical synopsis, risk factors, recommended actions; prompt = "clinical decision support"
- `medicationSafety.ts` — drug-drug interactions up to "contraindicated", intervention strategies
- `aiDrugInteractionService.ts` — interaction severity, contraindication/provider alerts
- `cds-hooks-service.ts` — HL7 CDS Hooks: drug-interaction/abnormal-lab alerts in prescribe/order workflow
- `ascvd-calculator-service.ts` — Pooled Cohort Equations risk score + 2018 ACC/AHA statin guidance

### Tier B — risk stratification / scoring
- `ai-risk-stratification-service.ts`, `aiPatientRiskStratification.ts`, `ai-chart-insights-service.ts`,
  `ai-fhir-insights-engine-service.ts`, `ai-fhir-data-lake-analytics-service.ts`, `ai-health-summary-service.ts`,
  `automatedOnboardingService.ts`, `careTeamOutreachService.ts`, `patientAnalytics.ts`,
  `aiPatientInsightsService.ts`, `aiProactiveRiskAnalysis.ts`, `proactive-patient-support-service.ts`,
  `adherenceCoaching.ts`

### Tier C — clinical interpretation / triage / flags
- `aiAdminAutomation.ts` (SOAP assessment/plan + ICD-10/CPT), `aiDocumentInsights.ts` (abnormal-result severity),
  `aiCommunication.ts` (clinical urgency triage), `aiPatientOutreachService.ts` (check-in red/escalation),
  `aiProgressFeedbackService.ts` (clinician flags), `aiVisualizationInsights.ts` (warning/critical flags),
  `patientCommunication.ts` (RPM recs + clinical Q&A), `provider-communication-portal-service.ts` (urgency triage),
  `ai-conflict-resolution-service.ts` (picks clinical value on conflict), `fhir-visualization-service.ts` (riskLevel + interaction strings)

---

## 52 NON-CDS — administrative / factual / data-plumbing (safe to mark NO-CDS)

accessibility-population-service, ai-audit-engine, ai-data-ingestion-service, ai-fhir-data-exchange-service,
ai-fhir-data-monetization-service, ai-fhir-data-quality-engine, ai-fhir-nl-search-service, ai-fhir-profiling-engine,
ai-fhir-resource-generator-service, ai-fhir-resource-mapper-service, ai-fhir-template-generator-service,
ai-fhir-visualization-service, ai-fhir-workflow-builder-service, ai-guided-recall-service, ai-imaging-diagnostic-service,
ai-onboarding-assistant, ai-onboarding-service, ai-patient-summary-service, ai-personalized-engagement,
ai-phi-anonymization-service, ai-provider, ai-realtime-fhir-quality-service, bidirectional-fhir-sync-service,
documentTranslationService, dual-mode-ecosystem-service, educationLibraryService, educationRecommendationService,
enhanced-data-ingestion-service, fhir-advanced-search-service, fhir-api-gateway-security-service,
fhir-conformance-checking-service, fhir-data-integration-service, fhir-export-service, fhir-integration-monitoring-service,
gamification-service, healthcare-data-aggregator-service, medication-summary-service, multilingualVoiceService,
operations-analytics-service, patient-engagement-hub-service, patient-feedback-analysis-service, patient-outreach-service,
patientEducationMessagingService, personalizedHealthContentService, phr-orchestration-service, predictiveAnalytics,
snapshot-pdf-service, third-party-data-governance-service, translation-guardrail-service, user-role-management-service,
workflow-monitoring-service, zero-click-retrieval-service

*(`predictiveAnalytics.ts` = SaaS churn/feature-adoption, not clinical, despite the name.)*

---

## Disposition options for the 33 (your / counsel call — not auto-applied)
1. **Counsel review** — determine which qualify as *non-device* CDS under the Cures Act 4-prong test
   (transparent basis, provider can independently review, not time-critical, no image/signal analysis).
   Those that pass can be marked NO-CDS truthfully.
2. **Refactor** — strip the recommendation/risk-scoring behavior so the service becomes genuinely factual.
3. **Gate/disable** — feature-flag the 33 off in production until dispositioned (keeps build shippable, no false claim).
4. **Do NOT** mass-stamp NO-CDS to force the build green — that is a false compliance assertion (ties to TODO #22).
</content>
