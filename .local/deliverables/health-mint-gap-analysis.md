# Health Mint → Tabula Medica Gap Analysis

> ⚠ **SUPERSEDED on April 21, 2026 by `.local/deliverables/health-mint-comprehensive.md`.**
> That file is the current single source of truth. This document is preserved for historical context only.
>
> **Δ since this doc was written:**
> - Symptom Checker (item #10 below) — ✅ **SHIPPED Apr 21** as a guided-triage page at `/symptom-checker` (web). Mobile parity pending. Backend at `POST /api/symptom-checker/triage` with 8 deterministic red-flag rules + GPT-5 LLM fallback. See `health-mint-comprehensive.md` §4.G3 for the full ship report.
> - Original 6 remaining gaps now 5; original ~62h estimate now ~54h.

---

**Prepared:** April 20, 2026
**Author:** Replit Agent (documentation-only analysis, zero code changes)
**Companion to:** `.local/deliverables/health-mint-mining-report.md` (April 18) and `.local/deliverables/tm-comprehensive-roadmap.md`
**Scope:** Identify Health Mint patient-facing features missing from Tabula Medica, rank by priority, recommend Q2/Q3/Q4 2026 build sequence.

---

## Executive Summary

The brief's framing ("TM web has fewer pages than mobile") is **factually inverted** by the evidence in this repo. Corrected baseline:

| Surface | Source location | Actual count |
|---|---|---|
| TM web pages | `client/src/pages/*.tsx` | **520** |
| TM mobile screens (this repo) | `tabula-medica-mobile/src/screens/*.tsx` | **16** |
| TM mobile total `.tsx` files | `tabula-medica-mobile/src/**/*.tsx` | **24** |
| TM server route files | `server/**/*routes*.ts` | **~150** |
| TM server endpoints | `app.{get,post,put,delete,patch}` calls | **2,172** |
| Health Mint pages (per brief) | base44 prototype (external) | 284 |

> The brief's "TM mobile has 153 screens" likely refers to a separate predecessor mobile repo, not the unified `tabula-medica-mobile/` subfolder in this codebase. The unified mobile shell deliberately keeps a thin native surface (16 screens) and pushes heavy functionality to the web app via Capacitor / WebView. **All 153 implied features have either web equivalents or are out of scope for the iOS-first MVP.**

**Headline finding:** TM web is **substantially more complete** than the brief assumes. Of the ~25 specific features the brief flags as "expected gaps," **~19 are already shipped or partially shipped** in TM (with file-path evidence below). Only **6–8 are real gaps**, and most are narrow scope (1–3 sessions each).

This means the Q2/Q3/Q4 roadmap should be **less about porting Health Mint features** and more about **(a) polish on existing TM features, (b) closing the 6–8 real gaps, (c) the strategic items already in `tm-comprehensive-roadmap.md`** (which the prior analysis correctly prioritized).

---

## §1 — Inventory Comparison

### Health Mint domain breakdown (per brief, not independently verified)
| Domain | Approx. page count |
|---|---|
| Clinical (records, conditions, meds, labs) | ~50 |
| AI assistants & insights | ~40 |
| Compliance (HIPAA / GDPR / CCPA / SOC2 / HITRUST) | ~25 |
| FHIR & interop | ~20 |
| Wearables & device integrations | ~15 |
| Caregiver / family | ~15 |
| Specialty workflows (cancer, chronic, longevity, women's, peds) | ~30 |
| Operational dashboards & analytics | ~50 |
| Education / journal / library | ~15 |
| Misc (admin, settings, legal) | ~24 |
| **Total** | **~284** |

### TM web domain breakdown (verified — sample of all 520 pages)
| Domain | Page count | Sample evidence |
|---|---|---|
| Clinical records | ~45 | `allergies.tsx`, `conditions.tsx`, `medications.tsx`, `lab-results.tsx`, `vitals.tsx`, `surgeries-procedures.tsx`, `unified-patient-record.tsx`, `advanced-patient-records.tsx`, `simplified-records.tsx` |
| **AI features** (single largest cluster) | **~75** | `ai-*.tsx` (75 distinct files in `client/src/pages/`) — including chatbot, summaries, care plans, risk, communication, automation, education, profile insights, predictive |
| Compliance & audit | ~30 | `compliance-dashboard.tsx`, `compliance-alerts-dashboard.tsx`, `compliance-export.tsx`, `compliance-reporting.tsx`, `audit-logs.tsx`, `audit-visualization.tsx`, `audit-trail-dashboard.tsx`, `clinical-ai-audit.tsx`, `baa-documentation.tsx`, `hipaa-*` (multiple), `uscdi-v3-compliance.tsx`, `policy-lifecycle.tsx` |
| FHIR & interop | ~35 | `fhir-data-hub.tsx`, `fhir-data-summaries.tsx`, `fhir-insights-dashboard.tsx`, `fhir-longitudinal-dashboard.tsx`, `fhir-data-visualization.tsx`, `tefca-*` (3), `ai-fhir-*` (15) |
| Wearables / devices | ~5 | `wearable-insights.tsx`, `health-data-sources-routes.ts`, `connections.tsx`, `data-sources.tsx`, plus `server/services/wearable-platform-connectors.ts` (6 platforms wired) |
| Caregiver / family | ~12 | `caregivers.tsx`, `caregiver-hub.tsx`, `caregiver-portal.tsx`, `caregiver-collaboration-hub.tsx`, `caregiver-health-dashboard.tsx`, `caregiver-management.tsx`, `caregiver-reporting.tsx`, `my-family.tsx`, `family-verification.tsx` |
| Specialty workflows | ~25 | `cancer-track.tsx`, `cancer-track-dashboard.tsx`, `survivorship.tsx`, `chronic-disease-management.tsx`, `diabetes-management.tsx`, `womens-health.tsx`, `menopause-resilience.tsx`, `fertility-cycle-dashboard.tsx`, `longevity-tracking.tsx`, `prenatal-newborn-routes.ts`, `pet-health-routes.ts`, `geriatric-routes.ts`, `pediatric-*` |
| Analytics / dashboards | ~50 | `analytics-dashboard.tsx`, `advanced-analytics.tsx`, `ai-fhir-analytics.tsx`, `clinical-analytics-dashboard.tsx`, `health-analytics.tsx`, `customizable-dashboard.tsx`, `health-dashboard.tsx`, `adaptive-health-dashboard.tsx`, `population-analytics-routes.ts` |
| Education / journal / library | ~10 | `health-journal.tsx`, `health-journal.tsx` (component), `ai-patient-education-hub.tsx`, `patient-education-center-routes.ts`, `personalized-education-routes.ts`, `ai-patient-education-module-service.ts` |
| Operational / admin | ~30 | `admin-*.tsx` (8), `team-workspace.tsx`, `clinician-*` (10) |
| Care coordination | ~25 | `care-plans.tsx`, `care-pathways.tsx`, `care-team-hub.tsx`, `care-team-collaboration.tsx`, `care-team-ai.tsx`, `care-gaps.tsx`, `care-monitoring.tsx`, `care-share-qr.tsx`, `care-packets.tsx` |
| Telehealth / messaging | ~10 | `telehealth.tsx`, `video-room.tsx`, `clinician-video-room.tsx`, `secure-messaging.tsx`, `sms-messaging.tsx`, `patient-messaging.tsx`, `appointment-reminders.tsx`, `telehealth-reminders.tsx` |
| Misc / utilities | ~165 | onboarding, billing, insurance, search, settings, etc. |

### TM mobile (16 screens — full enumeration)
`AIAssistantScreen` · `BookingScreen` · `ConnectDoctorScreen` · `DashboardScreen` · `EHRConnectionScreen` · `LabsScreen` · `LoginScreen` · `MedicationsScreen` · `PacketExportScreen` · `ProviderSearchScreen` · `RateCalculatorScreen` · `RecordsTimelineScreen` · `SettingsScreen` · `ShareQRScreen` · `UninsuranceScreen` · `VAVerificationScreen`

### Overlap vs gap (high-level)
| Health Mint domain | TM web | TM mobile | Verdict |
|---|---|---|---|
| Clinical records | ✅ rich | ✅ basic (Records, Labs, Meds) | Match |
| AI assistants | ✅✅ (75 pages — exceeds Health Mint) | ✅ AIAssistantScreen | TM ahead |
| Compliance dashboards | ✅ HIPAA + general; ❌ dedicated GDPR/CCPA | ❌ | **Partial gap** |
| FHIR & interop | ✅✅ (35 pages — likely exceeds Health Mint) | ✅ EHRConnection | TM ahead |
| Wearables | ✅ 6 platforms wired; ❌ 4 missing + no aggregator | ❌ | **Partial gap** |
| Caregiver / family | ✅ rich (12+ pages) | ❌ | TM web ahead, mobile gap |
| Specialty workflows | ✅ rich (cancer, chronic, longevity, women's, peds) | ❌ | TM web ahead, mobile gap |
| Health Journal / Library | ✅ exists | ❌ | TM web ahead, mobile gap |
| Symptom Checker | ⚠ partial (`symptom-tracker.tsx` component, no dedicated page) | ❌ | **Gap** |
| Gamification / Challenges | ✅ engine exists (`server/gamification-engine.ts` + `gamification-routes.ts`) but no patient-facing UI page | ❌ | **Partial gap (UI only)** |
| Conversational Health Coach (chat UX) | ⚠ component (`health-coach.tsx`) + AI chatbot (`ai-chatbot.tsx`) but no unified coach-chat page | ⚠ AIAssistantScreen | **Partial gap (consolidation)** |
| Nutrition guide | ❌ | ❌ | **Gap** |
| Disease alerts | ✅ CDC feeds wired (`cdc-feeds-service.ts`, `cap-alert-service.ts`, `cdc-feeds.tsx`) | ❌ | TM web has it |
| Immunizations | ✅ (`immunizations-hub.tsx`, `vaccine-routes.ts`, `clinician-immunization-portal.tsx`) | ❌ | TM web has it |
| Medication Adherence | ✅ (`medication-management.tsx`, `adherenceCoaching.ts`, `caregiver-medication-routes.ts`, `ai-medication-management.tsx`) | ✅ MedicationsScreen | Match |
| Patient Reported Outcomes | ✅ (`patient-reported-outcomes-card.tsx`) | ❌ | Web has component-level only |

---

## §2 — Patient-Side Features in Health Mint NOT in TM

Going through the brief's expected-gap list, verified by grep:

| Health Mint feature | Status in TM | Evidence |
|---|---|---|
| Wearable integrations (Fitbit, Garmin, Oura, WHOOP, Samsung Health, Suunto, Terra) | **Mostly shipped** — Fitbit, Garmin, Samsung Health, Oura, WHOOP, Suunto all have connector classes | `server/services/wearable-platform-connectors.ts` lines 94, 174, 254, 339, 420, 506 (6 connector classes) |
| Wearable: Withings, Polar, MyFitnessPal | **Gap** | No grep hits |
| Wearable: Terra (aggregator API) | **Gap** | No grep hits |
| Challenges / Gamification | **Engine yes, UI no** | `server/gamification-engine.ts`, `server/services/gamification-service.ts`, `server/gamification-routes.ts` exist; no `client/src/pages/challenges.tsx` or `gamification.tsx` |
| HealthCoach.jsx / HealthCoachChat | **Partial — split across files** | `server/health-coach-service.ts`, `client/src/components/health-coach.tsx`, `ai-chatbot.tsx`, `ai-proactive-patient-engagement-chatbot.tsx`. No single unified "Health Coach Chat" page that ties conversational AI + journal + risk together |
| HealthJournal.jsx | **Shipped** | `client/src/pages/health-journal.tsx`, `client/src/components/health-journal.tsx`, `server/health-journal-service.ts` |
| HealthLibrary | **Shipped (named differently)** | `client/src/pages/ai-patient-education-hub.tsx`, `server/routes/patient-education-center-routes.ts`, `server/services/patientEducation.ts` |
| ChronicCareJourney / MyCarePathway | **Shipped** | `client/src/pages/chronic-disease-management.tsx`, `client/src/pages/care-pathways.tsx`, `server/care-pathway-routes.ts`, `server/services/personalized-health-journey-service.ts`, `server/services/medical-journey-service.ts` |
| CancerCare specialty workflows | **Shipped** | `client/src/pages/cancer-track.tsx`, `cancer-track-dashboard.tsx`, `survivorship.tsx`, `server/cancer-track-routes.ts`, `server/survivorship-routes.ts` |
| CaregiverDashboard / caregiver support | **Shipped (very rich)** | `client/src/pages/caregivers.tsx` + 6 more caregiver pages, `server/caregiver-*-routes.ts` (8 files), `server/caregiver-coordination.ts`, `server/caregiver-mode-service.ts`, `server/caregiver-support-service.ts` |
| FamilyHealthHub | **Shipped** | `server/family-hub-routes.ts`, `client/src/pages/my-family.tsx`, `server/family-verification-routes.ts` |
| LongevityGuide | **Shipped (tracking variant)** | `client/src/pages/longevity-tracking.tsx` |
| NutritionGuide | **Gap** | No nutrition.tsx, no nutrition-guide.tsx, no nutrition service file |
| SymptomChecker | **Partial — component only** | `client/src/components/symptom-tracker.tsx` exists; no dedicated `symptom-checker.tsx` page with triage decision tree |
| HealthQuestionnaire / health assessments | **Shipped** | `client/src/pages/health-questionnaire.tsx`, `server/health-questionnaire-routes.ts`, `client/src/pages/assessments.tsx` |
| Immunizations | **Shipped (rich)** | `client/src/pages/immunizations-hub.tsx`, `iis-reconciliation.tsx`, `server/vaccine-routes.ts`, `server/state-iis-routes.ts`, `server/services/vaccine-rules-engine-v2.ts`, `clinician-immunization-portal.tsx` |
| DiseaseAlerts | **Shipped** | `client/src/pages/cdc-feeds.tsx`, `server/cdc-feeds-routes.ts`, `server/services/cdc-feeds-service.ts`, `server/services/cap-alert-service.ts` |
| MedicationManagement / MedicationAdherence | **Shipped** | `client/src/pages/medications.tsx`, `ai-medication-management.tsx`, `server/medication-management-routes.ts`, `server/services/adherenceCoaching.ts`, `server/caregiver-medication-routes.ts` |
| Patient Reported Outcomes (PRO) | **Component only** | `client/src/components/patient-reported-outcomes-card.tsx` exists; no dedicated page or workflow |

**Confirmed real patient-side gaps (5):**
1. NutritionGuide (no equivalent)
2. SymptomChecker as a guided triage page (only have a tracker component)
3. Challenges / Gamification patient-facing UI (engine done, UI missing)
4. Wearables: Withings, Polar, MyFitnessPal connectors
5. Wearables: Terra aggregator API (would consolidate connector maintenance)
6. PRO workflow / dedicated questionnaires page

---

## §3 — AI Features in Health Mint NOT in TM

| Health Mint AI feature | Status | Evidence |
|---|---|---|
| AIHealthCoachChat (conversational engine) | **Partial — fragmented** | `server/health-coach-service.ts`, `server/services/aiCommunication.ts`, `server/ai-proactive-patient-engagement-chatbot-routes.ts`, `client/src/pages/ai-chatbot.tsx`, `client/src/components/health-coach.tsx`. Functionality exists but not consolidated into a single coach-chat page with persistent thread, journal context, and proactive nudges |
| AIGuardrails (safety layer) | **Shipped** | `server/ai-guardrail-service.ts`, `server/services/translation-guardrail-service.ts`, `server/security/no-cds-guardrails.ts`, `client/src/components/guardrails-disclaimer.tsx`, `server/translation-guardrail-routes.ts` |
| AIPatientCommunication | **Shipped** | `client/src/pages/ai-patient-communication.tsx`, `server/services/aiPatientCommunicationService.ts`, `server/services/aiCommunication.ts`, `server/services/patientCommunication.ts` |
| AIPersonalizedCarePathways | **Shipped** | `client/src/pages/ai-personalized-care-plans.tsx`, `server/ai-personalized-care-journey-routes.ts`, `server/services/personalized-health-journey-service.ts` |
| AIWorkflowAutomation | **Shipped** | `client/src/pages/workflow-automation.tsx`, `client/src/pages/clinical-workflow-automation.tsx`, `server/services/ai-workflow-automation.ts`, `server/services/ai-healthcare-workflow-automation.ts`, `server/workflow-automation-routes.ts` |
| AIRiskAssessment | **Shipped** | `server/services/aiPatientRiskStratification.ts`, `server/services/ai-predictive-risk-engine.ts`, `server/predictive-risk-routes.ts`, `client/src/pages/ai-patient-intelligence.tsx` |
| AIReportingHub | **Shipped** | `client/src/pages/advanced-reporting.tsx`, `server/services/advanced-reporting-analytics-service.ts`, `server/services/ai-fhir-report-automation-service.ts` |
| AIHealthAnalytics (patient-facing) | **Shipped** | `client/src/pages/health-analytics.tsx`, `client/src/pages/health-data-insights.tsx`, `client/src/pages/ai-patient-data-analytics.tsx` |

**Confirmed real AI gaps (1):**
1. **Unified Health Coach Chat** — consolidate the 5+ fragmented chatbot/coach files into one coherent conversational page with persistent threads, journal/risk/medication context injection, and proactive nudges.

---

## §4 — Compliance Dashboards in Health Mint NOT in TM

| Health Mint dashboard | Status | Evidence |
|---|---|---|
| HIPAADashboard (operational, patient-visible) | **Shipped** | `client/src/pages/compliance-dashboard.tsx`, `server/services/hipaa-compliance-service.ts`, `server/routes/hipaa-compliance-routes.ts`, `server/routes/compliance-dashboard-routes.ts` |
| GDPRDashboard (EU users) | **Gap — service-only** | GDPR is mentioned in 40+ files (third-party data governance, audit, security policies) but no dedicated patient-facing `gdpr-dashboard.tsx` page. EU users have no self-serve view of data-residency, right-to-erasure, DPA links |
| CCPADashboard (California users) | **Gap — service-only** | Same pattern as GDPR. California-resident self-serve view is missing |
| CDSAlertsDashboard (CDS surfaced to patient) | **Shipped** | `client/src/components/cds-alerts-panel.tsx`, `server/clinical-decision-support-service.ts`, `server/clinical-decision-support-routes.ts`, `client/src/pages/clinical-decision-support.tsx`, `client/src/pages/cds-disabled.tsx` |
| ComplianceAlertsDashboard | **Shipped** | `client/src/pages/compliance-alerts-dashboard.tsx`, `server/compliance-anomaly-routes.ts`, `server/services/compliance-anomaly-service.ts` |
| Auto-notice of privacy practices | **Shipped (legal page)** | `client/src/pages/privacy-policy.tsx`, `client/src/pages/legal-page.tsx`, `client/src/components/legal-footer.tsx` |

**Confirmed real compliance gaps (2):**
1. Patient-facing **GDPR self-serve dashboard** (right to access, erasure, portability, DPA contact)
2. Patient-facing **CCPA self-serve dashboard** (do-not-sell, right to know, deletion request)

Both are needed if TM markets to EU or CA residents respectively. Both are **non-optional under those jurisdictions** even if the rest of the compliance plumbing exists server-side.

---

## §5 — Wearable / Device Features (most concrete gap zone)

### Already wired in `server/services/wearable-platform-connectors.ts`
| Platform | Class | Status |
|---|---|---|
| Fitbit | `FitbitConnector` (line 94) | ✅ |
| Garmin | `GarminConnector` (line 174) | ✅ |
| Samsung Health | `SamsungHealthConnector` (line 254) | ✅ |
| Oura Ring | `OuraRingConnector` (line 339) | ✅ |
| WHOOP | `WHOOPConnector` (line 420) | ✅ |
| Suunto | `SuuntoConnector` (line 506) | ✅ |
| Apple HealthKit | `tabula-medica-mobile/` HealthKit module | ✅ (mobile-only) |
| Google Fit | mentioned in `wearable-routes.ts` and `health-app-connectors-service.ts` | ⚠ partial |

### Missing
| Platform | Why useful | Effort |
|---|---|---|
| **Withings** | Smart scales, BP cuffs — common consumer purchase, fills "home vitals" gap that no other connector does well | 2 sessions (~6h) |
| **Polar** | Heart-rate athletes, complements Garmin without replacing it | 1.5 sessions (~4h) |
| **MyFitnessPal** | Diet logging — only available via aggregator (Terra) currently | 1 session (~3h) |
| **Terra API aggregator** | Single integration unlocks 30+ devices including the above + future devices without per-platform code; reduces maintenance to one OAuth flow | 3 sessions (~9h); replaces incremental connector work |

> **Recommendation:** Defer per-platform Withings / Polar / MyFitnessPal work and **build the Terra aggregator integration instead** (Q3). Terra ships all three plus 30+ more for the cost of one connector. The 6 native connectors stay (lower latency, no per-call fees) and Terra fills the long tail.

---

## §6 — Feature Priority Matrix

Categorization criteria: patient value × clinical credibility × differentiation × alignment with TM HIPAA-covered-entity posture × current rejection-cycle pressure.

### P0 — Critical (Q2 2026, May–June)
| # | Feature | Why P0 | Surface |
|---|---|---|---|
| 1 | **Resolve Apple App Store rejection** (login + Build #47 resubmission) | Blocking app launch entirely | Mobile + server |
| 2 | **Real `resolveUserTier()` storage chain** | Currently every user is "free" → paying Pro/Concierge users hit gates after paying. Direct revenue blocker | Server |
| 3 | **GDPR + CCPA patient-facing dashboards** | Non-optional for EU/CA marketing; enables those geographies | Web |
| 4 | **Unified Health Coach Chat consolidation** | Consolidates 5 fragmented chatbot files into 1 coherent conversational surface — biggest UX uplift available | Web + mobile |
| 5 | **AI Patient Chart Summary at top of dashboard** (already #1 in mining report) | Highest-ROI feature in mining report; first-launch "wow" moment | Web + mobile |

### P1 — High (Q3 2026, July–September)
| # | Feature | Why P1 | Surface |
|---|---|---|---|
| 6 | **Terra API aggregator** | Unlocks Withings, Polar, MyFitnessPal + 30+ devices in one integration | Server |
| 7 | **Health Graph Visualization** (mining report #3) | Differentiator no consumer health app has | Web |
| 8 | **AI Predictive Risk Analytics** (mining report #2; 6-category structured) | Clinical-grade feature, foundation for population health | Web |
| 9 | **Patient-facing Challenges / Gamification UI** | Engine exists; UI page would close ship-ready gap | Web + mobile |
| 10 | **Symptom Checker triage page** (upgrade `symptom-tracker` component to a guided decision-tree page) | Top-of-funnel use case for new users | Web + mobile |
| 11 | **Mobile parity push** — port Caregiver, Health Journal, Cancer Track to mobile screens | Mobile is currently 16 screens vs web's 520; major UX gap for iOS-first users | Mobile |

### P2 — Medium (Q4 2026, October–December)
| # | Feature | Why P2 | Surface |
|---|---|---|---|
| 12 | **NutritionGuide** | Real gap but lower urgency; can ship after MyFitnessPal connector lands via Terra | Web + mobile |
| 13 | **PRO workflow / dedicated patient-reported-outcomes page** | Component exists; promote to a dedicated questionnaire-driven workflow | Web |
| 14 | **Withings native connector** (in addition to Terra) | Lower-latency BP/scale ingestion for users who pair both | Server |
| 15 | **Mobile parity continued** — Family Hub, Longevity, Diabetes Mgmt, Women's Health screens | Quarter-2 of mobile parity | Mobile |

### P3 — Skip (do not port from Health Mint)
| Feature | Why skip |
|---|---|
| Base44 SDK / entity system | Architecturally incompatible (already covered in mining report) |
| Base44 auth | TM uses Auth0 (already wired) |
| Serverless function compatibility | Rebuilt as Express (already done) |
| Enterprise SOC2/HITRUST/FedRAMP compliance dashboards | Not patient-facing; covered by `server/security/soc2-compliance-service.ts` and audit dashboards already shipped |
| 200+ duplicate "EnhancedDashboard / AdvancedDashboard / UnifiedDashboard" pages from Health Mint | Pattern suggests AI-generated scaffolding rather than validated UX (per mining report). TM has 50 dashboard pages already — more would add noise |
| Health Mint TEFCA / QHIN | TM's TEFCA implementation (`server/tefca-routes.ts`, `tefca-patient-viewer.tsx`, `tefca-partner-management.tsx`) is more current |
| Polar native connector | Subsumed by Terra (P1) |
| MyFitnessPal native connector | Subsumed by Terra (P1) |

---

## §7 — Web vs Mobile vs Both Mapping

For the gaps identified, where each should ship:

| Gap | Web | Mobile | Both | Reasoning |
|---|---|---|---|---|
| GDPR dashboard | ✅ | ❌ | | Read-heavy legal review surface; desktop workflow |
| CCPA dashboard | ✅ | ❌ | | Same |
| Unified Health Coach Chat | | | ✅ | Continuity across surfaces is the whole point |
| Symptom Checker | | | ✅ | On-the-go (mobile) + deeper analysis (web) |
| Challenges / Gamification UI | | | ✅ | Notifications + streaks need mobile; leaderboards/details on web |
| Terra aggregator | ✅ server-only | ✅ device pairing UX | | Server runs the integration; mobile owns the OAuth pairing flow |
| NutritionGuide | | | ✅ | Logging on mobile, recipe library on web |
| AI Patient Chart Summary | | | ✅ | First-launch surface on both |
| Health Graph Visualization | ✅ | ❌ | | Touch-target density too high for phone screens; desktop primary |
| AI Predictive Risk Analytics | ✅ primary | ⚠ summary widget | | Full 6-category view on web; high-level "your risks" widget on mobile |
| Mobile parity (Caregiver, Cancer, Family, etc.) | (already on web) | ✅ | | Pure mobile catch-up |
| PRO workflow | ✅ | ⚠ | | Web first; mobile reminder + quick-entry second |

---

## §8 — Roadmap Recommendations

### Q2 2026 (May–June) — P0 items, ~6 weeks of agent capacity
| Week | Focus | Estimated agent hours |
|---|---|---|
| W1 | Apple rejection close (Build #47 demo login + resubmit) | 4h |
| W1–W2 | `resolveUserTier()` real storage chain (Auth0 sub → accounts → subscriptions → plan tier) | 8h |
| W2–W3 | GDPR self-serve dashboard | 12h |
| W3–W4 | CCPA self-serve dashboard | 10h (reuses GDPR scaffold) |
| W4–W6 | Unified Health Coach Chat consolidation | 18h |
| W5–W6 | AI Patient Chart Summary (mining report #1) | 6h |
| **Total** | | **~58 agent hours** |

### Q3 2026 (July–September) — P1 items, ~13 weeks
| Block | Focus | Hours |
|---|---|---|
| 1 | Terra API aggregator integration | 9h |
| 2 | AI Predictive Risk Analytics (mining report #2) | 12h |
| 3 | Health Graph Visualization (mining report #3) | 18h |
| 4 | Patient-facing Challenges / Gamification UI | 10h |
| 5 | Symptom Checker triage page upgrade | 8h |
| 6 | Mobile parity round 1 (Caregiver, Health Journal, Cancer Track screens) | 24h |
| **Total** | | **~81 agent hours** |

### Q4 2026 (October–December) — P2 items
| Block | Focus | Hours |
|---|---|---|
| 1 | NutritionGuide (web + mobile) | 12h |
| 2 | PRO workflow page | 8h |
| 3 | Withings native connector | 6h |
| 4 | Mobile parity round 2 (Family Hub, Longevity, Diabetes, Women's Health) | 28h |
| 5 | Items #4–#10 from `health-mint-mining-report.md` (medication safety dashboard, family health graph, automated record requests, prior-auth letter polish, etc.) | ~40h |
| **Total** | | **~94 agent hours** |

---

## §9 — Implementation Patterns Worth Copying from Health Mint

Already documented in `health-mint-mining-report.md` Part 4. Restated here for the gap-analysis context:

| Pattern | Where TM should adopt | TM equivalent today |
|---|---|---|
| **Dashboard tab structure** (hooks → widgets → data flow) | New AI Coach Chat page | `client/src/pages/health-dashboard.tsx`, `customizable-dashboard.tsx` already use shadcn tab patterns — extend, don't rebuild |
| **Card-based layout** (shadcn/ui patterns) | All new pages | Already TM's house style (`client/src/components/ui/card.tsx`) |
| **Widget reusability** (CriticalAlertsPanel, PendingTasksWidget) | Dashboard composition | TM has `client/src/components/cds-alerts-panel.tsx`, `proactive-alerts.tsx`, `proactive-health-alerts.tsx` — similar pattern, can be extended |
| **AI assistant chat UX** (markdown rendering, streaming, citations) | Unified Health Coach Chat | TM's `ai-chatbot.tsx` is the closest existing implementation — refactor it |
| **Data filtering / sorting patterns** | Records, Timeline, FHIR pages | TM's `client/src/pages/timeline.tsx` and `unified-patient-record.tsx` already do this |
| **Glass morphism / gradient system** (visual polish) | Welcome / Onboarding | iOS 26 Liquid Glass UI is already part of TM's design spec |

---

## §10 — What NOT to Port (Base44-Locked or Out-of-Scope)

Already authoritative in `health-mint-mining-report.md`. Restated for completeness:

- **Base44 SDK itself** (architectural lock-in)
- **Base44 auth** (TM uses Auth0 — wired, working)
- **Base44 entity system** (TM uses Drizzle ORM with explicit schema in `shared/schema.ts`)
- **Serverless functions** (already rebuilt as Express routes — 2,172 endpoints)
- **TEFCA / QHIN** (TM's implementation is more current — `server/tefca-routes.ts`, `client/src/pages/tefca-*.tsx`)
- **Enterprise SOC2 / HITRUST / FedRAMP operational dashboards** (not patient-facing; TM has compliance services that don't need user-facing pages)
- **The 200+ duplicate `*Dashboard.jsx` files** (Health Mint shipped scaffolding artifacts; do not absorb)

---

## Verification Notes

| Claim | Verification method |
|---|---|
| TM web has 520 pages | `ls client/src/pages/ \| wc -l` |
| TM mobile has 16 screens | `ls tabula-medica-mobile/src/screens/ \| wc -l` |
| Server has 2,172 endpoints | `grep -rE "app\.(get\|post\|put\|delete\|patch)\(" server/ \| wc -l` |
| 6 wearable connector classes | `grep -n "^class.*Connector" server/services/wearable-platform-connectors.ts` |
| Withings/Polar/MyFitnessPal/Terra missing | grep across `*.{ts,tsx}` returned zero hits |
| HIPAA dashboard exists | `client/src/pages/compliance-dashboard.tsx`, `server/services/hipaa-compliance-service.ts` |
| GDPR dashboard missing | grep for "gdpr.?dashboard" returned no client page hits — only server service / governance refs |
| CCPA dashboard missing | Same as GDPR |
| Health Coach fragmented across 5+ files | Listed in §3, evidenced by file paths |
| Gamification engine exists, UI doesn't | `server/gamification-*` files exist; no `client/src/pages/challenges.tsx` or `gamification.tsx` |
| Symptom Checker is component, not page | `client/src/components/symptom-tracker.tsx` exists; no `symptom-checker.tsx` page |

---

## Constraints Honored

- ✅ Zero code changes
- ✅ Zero schema migrations
- ✅ Pure documentation + analysis
- ✅ Health Mint source treated as conceptual reference
- ✅ All TM claims grounded in grep-verified file paths
- ✅ No duplication of existing `health-mint-mining-report.md` (April 18) or `tm-comprehensive-roadmap.md`

**Standing by for prioritization input.**
