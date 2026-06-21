# Health Mint → Tabula Medica Feature Mining Report

**Prepared:** April 18, 2026 (Saturday evening)
**Purpose:** Systematic feature extraction from the Health Mint predecessor codebase (284 pages, 1,867 components, 132 backend functions) to inform the unified Tabula Medica roadmap.
**Framing:** This is a MINING report, not a merge plan. Health Mint and Tabula Medica are architecturally incompatible (base44 BaaS vs Node/Neon/Drizzle, JavaScript vs TypeScript). Value is in **ideas, patterns, and feature specifications** — not in code reuse.

---

## Executive Summary

**Health Mint's actual value to Tabula Medica is:**
1. A proven **feature catalog** of what a best-in-class patient health platform looks like
2. Battle-tested **LLM prompt engineering** for clinical AI (risk stratification, care pathways, summaries)
3. A proven **integration taxonomy** — 40+ data sources spanning EHRs, wearables, pharmacies, payers
4. A **UX pattern library** — command palette, modal flows, glass morphism, gradient system
5. A **compliance scope map** — what domains a HIPAA/SOC2/HITRUST/TEFCA/FedRAMP-grade app must cover

**What Health Mint is NOT useful for:**
- Direct code porting (JS → TS + base44 → Neon = rewrite, not migration)
- Architecture reference (base44 BaaS abstracts what Tabula Medica explicitly owns for HIPAA reasons)
- Data model (entities are base44 SDK-flavored, not compatible with Drizzle schema)
- The 200+ duplicate "dashboard" pages (EnhancedDashboard vs AdvancedAnalyticsDashboard vs UnifiedDashboard — pattern suggests AI-generated scaffolding, not validated UX)

**Core recommendation:** Treat this as a **36-month product roadmap catalog**. Pick 8-12 high-leverage features to pull into Tabula Medica v1.0-v1.5. Defer or discard the rest. Do not try to absorb the whole thing — you'd end up with an app that looks comprehensive but does nothing well.

---

## Part 1 — Top 10 Features Worth Porting (Ranked by ROI)

Criteria for ranking: patient value × clinical credibility × implementation feasibility × differentiation vs competitors × alignment with Tabula Medica's HIPAA-covered entity posture.

### 🥇 #1 — AI Patient Chart Summary (auto-refreshing, top-of-dashboard)
**Source:** `src/components/clinical-ai/AIPatientChartSummary.jsx` + `base44/functions/generatePatientSummary/`
**What it does:** On dashboard load, auto-generates (or retrieves cached) LLM-produced comprehensive patient summary covering conditions, active meds, recent labs, risks, and upcoming care needs. Refreshes every 5 minutes. Sits at top of Home page.
**Why #1:** Immediately signals "this app understands me." Single most powerful onboarding moment — new user sees a coherent summary of their own health on first login, not an empty dashboard.
**Tabula Medica port scope:**
- Backend: new route `POST /api/ai/patient-summary/:profileId` in the existing BAA+ZDR AI pipeline
- Storage: new `ai_patient_summaries` table (cached, regenerated on data change or 24h TTL)
- Frontend: `<AIPatientChartSummary>` component at top of authenticated dashboard
- Respect Action Item Q (AI opt-out) — if disabled, surface a placeholder
- Estimated: 1 Replit session (~3 hours)

### 🥈 #2 — AI Predictive Risk Analytics (6-category structured risk scoring)
**Source:** `src/components/ai-predictive/AIPredictiveAnalytics.jsx`
**What it does:** Aggregates vitals + conditions + meds + journal entries + appointments + labs, sends structured prompt to LLM with strict JSON schema, returns 6-category risk scores (diabetes complications, cardiovascular events, hospital readmission, medication adverse events, fall risk, mental health crisis). Each risk includes: score, level, confidence, timeframe, key factors, interventions with urgency, warning signs, trend.
**Why #2 (and addresses user's specific interest in population health analytics):** This is clinical-grade predictive analytics that individual patients can act on, AND aggregated it becomes population health dashboard data for provider-side users. The structured-output JSON schema is the key innovation — bounded LLM output that's safe to display clinically.
**Tabula Medica port scope:**
- Backend: `POST /api/ai/risk-assessment/:profileId` returning the 6-category structured output
- Storage: `ai_risk_assessments` table with full JSON response, regenerated weekly or on significant data change
- Frontend: dedicated Risk Assessment page + compact widget on dashboard
- Critical: the JSON schema itself is the valuable IP — pre-constrains LLM to clinical categories that matter
- Estimated: 2 Replit sessions (~6 hours)

### 🥉 #3 — Health Graph Visualization (conditions ↔ medications ↔ labs ↔ symptoms relationships)
**Source:** `src/components/health-graph/HealthGraphVisualization.jsx` + `base44/functions/buildHealthGraph/entry.ts`
**What it does:** LLM analyzes all patient data and builds a graph of clinical relationships — "this medication treats this condition," "this lab correlates with this diagnosis," "this symptom may indicate this condition," "this side effect follows this medication change." Nodes are typed (medication / diagnosis / lab / episode / specialist / symptom); edges have relationship types (treats, caused_by, monitors, triggered_by, follows, related_to, side_effect_of, correlates_with) and strength 0.0-1.0.
**Why #3:** No consumer health app has this. Patients routinely don't understand why they take a particular medication or what a lab test measures. The graph makes it visually obvious. For providers, it's a rapid clinical orientation tool.
**Tabula Medica port scope:**
- Backend: `POST /api/ai/health-graph/:profileId` - builds the nodes + edges via structured LLM output
- Storage: `health_graph_nodes` + `health_graph_edges` tables (regenerate when underlying data changes)
- Frontend: interactive graph view (use `@xyflow/react` or `d3-force`)
- Filter by node type, search, click-to-explain
- Estimated: 2 Replit sessions (~6 hours) + 1 session for UX polish

### #4 — Unified Health Hub (one-screen integration manager)
**Source:** `src/pages/UnifiedHealthHub.jsx` + `src/components/integrations/*`
**What it does:** Single page where a patient connects every data source: Epic MyChart, Healow, AthenaHealth, CMS Patient Access, Fitbit, Garmin, Oura, Whoop, Apple Health, Google Fit, LabCorp, Quest, Surescripts, TEFCA partners. Each connector has standardized UI: "what you'll get," connect button, sync status, last sync time, auto-sync toggle.
**Why #4:** Current Tabula Medica talks to Fasten Health as the FHIR middleware, but doesn't have a unified "my connections" UX. This is the marketing-differentiator screen — "Everything in one place" — for App Store descriptions and investor demos.
**Tabula Medica port scope:**
- Page: `/connections` or `/data-sources`
- Component pattern: `<IntegrationConnector>` base with per-source implementations
- Backend: extend existing Fasten Health integration to normalize connection status into a unified table
- Phase 1 sources (realistic): Epic via Fasten, Apple Health (iOS), Google Fit (Android), manual CSV import
- Phase 2 sources: Fitbit, Garmin, Oura (via Terra API aggregator — Health Mint uses this pattern)
- Estimated: 1 session for the UX shell + 1 session per new integration after Fasten

### #5 — Ambient Encounter Notes with Multi-Language Speech Recognition
**Source:** `src/components/ambient/AmbientListener.jsx`
**What it does:** Browser Web Speech Recognition API → real-time transcript → LLM extracts structured data (symptoms, history, medications, allergies, family history, social history, lifestyle, mental health). Supports 16 languages natively. Record type selection steers extraction.
**Why #5:** Tabula Medica already commits to ambient audio via Section 12 of Privacy Policy ("audio processed in memory only, discarded immediately after transcription"). The commitment exists; the feature needs to match. Health Mint's implementation is a solid reference.
**Note:** Tabula Medica's version should use **Whisper via BAA** (already budgeted in F1 encryption work) rather than browser Web Speech (no BAA, sends audio to Google servers). This is the critical privacy-architecture upgrade when porting.
**Tabula Medica port scope:**
- Frontend: `<AmbientEncounterNote>` component with Whisper integration
- Backend: audio POST → Whisper via BAA → structured extraction LLM → in-memory processing → discard audio → save transcript
- Match Privacy Policy commitment exactly: "never written to persistent storage"
- Estimated: 2 sessions (harder because of the audio pipeline + privacy guarantees)

### #6 — AI Care Pathway Generator (phased intervention plan)
**Source:** `src/components/ai-care-pathways/AICarePathwayGenerator.jsx`
**What it does:** Given a patient's full record, LLM generates a multi-phase care pathway with objectives, interventions (medication/lifestyle/monitoring/therapy), frequency, priority, expected outcomes, and duration.
**Why #6:** For patients with chronic conditions, this is the feature that makes the app feel like a care manager. Aligns with Uninsurance's "connect to affordable care" positioning — the pathway recommends where to go next.
**Tabula Medica port scope:**
- Backend: `POST /api/ai/care-pathway/:profileId` with structured output
- Storage: `care_pathways` table with versioning (re-generate on status change)
- Frontend: Care Pathway page showing phases, current position, check-off interventions
- Estimated: 1.5 sessions

### #7 — Command Palette (Cmd+K global search/action)
**Source:** `src/components/CommandPalette.jsx`
**What it does:** Cmd+K opens a Spotlight-style overlay. Static quick-nav actions + dynamic search (patients, records, appointments). Keyboard-first. Every section of app reachable in 2 keystrokes.
**Why #7:** Tabula Medica will eventually have many pages (you already have 20+, will grow to 40+ with these additions). Command palette scales UX complexity without requiring more navigation layers. Power users love it. Accessibility win.
**Tabula Medica port scope:**
- Component: lift verbatim to TypeScript
- Backend: minimal — mostly client-side
- Keyboard handler at App-level
- Estimated: 0.5 session (3-4 hours)

### #8 — Family/Caregiver Sharing with Granular Permissions
**Source:** `src/components/engagement/FamilyCaregiverSharing.jsx`
**What it does:** Patient grants specific caregivers access with per-category toggles: vitals, medications, appointments, lab results, clinical notes. Each share has expiry (default 1 year). Active/inactive toggle. Email-based share invitation.
**Why #8:** Tabula Medica's vision includes caregiver access. This is the most mature implementation I've seen — granular permissions, expiration, revocation. Aligns with HIPAA §164.522 patient rights.
**Tabula Medica port scope:**
- Table: `shared_access` (already partly exists in Tabula Medica — needs expansion)
- UX: `/sharing` page with active shares list, new share form with permission matrix
- Backend: permission enforcement middleware checks `shared_access` on every cross-user PHI read
- Estimated: 2 sessions (backend permission logic is the hard part)

### #9 — Automated Care Gaps Detection (already partially in Tabula Medica, extend to AI)
**Source:** `base44/functions/identifyCareGaps/entry.ts`
**What it does:** Scheduled backend function that analyzes patient data against clinical guidelines, identifies gaps (missing cancer screenings, overdue immunizations, diabetic eye exams, missing A1C tests, overdue specialist referrals, medication therapy management needs), and writes `CareGap` records for UI display.
**Why #9:** Tabula Medica has rule-based USPSTF Grade A/B care gap detection already. Health Mint's version uses LLM for broader gap identification beyond USPSTF. Combining both = best coverage.
**Note:** Rule-based USPSTF should remain the authoritative layer (explainable, auditable). LLM layer adds "nice-to-know" gaps with "AI-suggested — confirm with your doctor" labels.
**Tabula Medica port scope:**
- Backend: `POST /api/care-gaps/generate/:profileId` with LLM augmentation of existing USPSTF engine
- Label AI-generated vs guideline-generated in UI (different icons/badges)
- Estimated: 1 session

### #10 — One-Tap Share Export (with AI clinical summary for recipient)
**Source:** `src/components/sharing/OneTapShareExport.jsx`
**What it does:** Patient selects recipient (specialist/PCP/family), data scope (meds/conditions/labs/imaging/full), clicks Share. System generates AI clinical summary ("2-paragraph summary suitable for a specialist"), packages with selected data, emails via secure link.
**Why #10:** Solves the "I'm seeing a new doctor, they want my history, how do I transfer it?" problem. Huge patient frustration point. Uses AI to format for clinical audience, not raw JSON.
**Tabula Medica port scope:**
- Backend: `POST /api/share/one-tap` generating PDF + email + secure link
- Storage: `share_events` audit table with expiry/revocation
- Frontend: OneTapShareExport component + "Share with my doctor" entry points throughout app
- Integration: use existing SendGrid infrastructure (add if missing)
- Estimated: 1.5 sessions

---

## Part 2 — Top 5 UX Patterns Worth Porting

These are design patterns, not features. Port the idea, not the code.

### UX #1 — Gradient + Glass Morphism System
**Source:** `Layout.jsx`, `globals.css`, home page hero
**Pattern:** Each major feature gets its own gradient color (violet→purple for brand, emerald→teal for meds, blue→cyan for records, green→emerald for telehealth, indigo→purple for caregiver). `bg-white/70 backdrop-blur-xl` glass morphism for nav/card surfaces.
**Why it works:** Visually distinctive, modern, differentiates from the "generic healthcare dashboard" look. BUT — accessibility risk (your audit already flagged Liquid Glass contrast concerns).
**Tabula Medica adaptation:** **Use gradients sparingly**. Action Item U (accessibility audit) flagged Liquid Glass post-blur contrast failures. Port the gradient-as-feature-identity idea but:
- Limit gradient surfaces to hero/CTA sections, not dense clinical data
- Always have a `--reduced-transparency` variant (already in Tabula Medica)
- WCAG AA contrast ratio tested for all text over gradients
- Teal primary (Tabula Medica's brand) with Uninsurance using a complementary variant from the same family

### UX #2 — Dashboard Customizer (patient-controlled widget visibility)
**Source:** `src/components/dashboard/DashboardCustomizer.jsx` + Home page `isWidgetVisible()` pattern
**Pattern:** Every widget on the home dashboard can be toggled on/off by user. Preferences stored in `localStorage` (with server sync option). Each widget block checks `isWidgetVisible('vitals')` before rendering.
**Why it works:** Patients have different information needs (chronic condition patient wants vitals; healthy patient wants preventive care). One dashboard doesn't fit all. Customization reduces cognitive load.
**Tabula Medica adaptation:** Add `user_dashboard_preferences` table; wrap all home-page widgets with visibility check; Settings → Dashboard Customization. Respects Action Item U accessibility findings.

### UX #3 — Mobile Bottom-Nav with Iconography
**Source:** `Layout.jsx` bottom nav pattern (lines 160-184)
**Pattern:** Fixed 5-item bottom navigation on mobile, 60px tall, gradient-colored when active, 44×44pt tap targets. Hidden on desktop (which has top nav instead).
**Why it works:** Patient apps are mobile-first. Bottom nav is the iOS/Android standard. Thumb-reachable.
**Tabula Medica adaptation:** This directly solves Action Item U Finding #1 (button tap target issues). Already aligned with iOS HIG. Port the layout pattern.

### UX #4 — Motion Design with `framer-motion`
**Source:** Home page, most content pages
**Pattern:** Staggered entrance animations (`initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` with incrementing `delay` per card). Honors `prefers-reduced-motion`.
**Why it works:** Feels premium, professional, apple-product-launch-like. Subtle enough to not be distracting. Dramatically improves perceived performance (content appears "on its way in" rather than "popping").
**Tabula Medica adaptation:** Add `framer-motion` dependency (if not present), apply staggered entrance to dashboard cards and form surfaces. Critical: must check `prefers-reduced-motion` (already global CSS in Health Mint).

### UX #5 — AI Health Coach CTA (persistent entry point)
**Source:** Home page `<CTACard>` with Sparkles icon → HealthCoachChat
**Pattern:** Persistent bottom-of-dashboard CTA inviting patients to chat with AI. Not a popup, not intrusive, but always visible.
**Why it works:** Patients don't know they can ask questions. A visible invitation to "Ask the AI" reduces the activation-energy gap for engagement. Addresses the "what do I do now?" problem after login.
**Tabula Medica adaptation:** New `<AIHealthCoachCTA>` component on home, routing to chat interface. Must respect Action Item Q (AI opt-out) — if user has opted out, CTA is hidden.

---

## Part 3 — Integrations to Add to Tabula Medica (Ranked Priority)

Your current state connects to Fasten Health as the FHIR middleware. Health Mint shows you what a "fully connected" patient record app looks like. Priority order:

### P1 — Must-Have for v1.0 (TestFlight launch)
1. **Apple Health (HealthKit)** — iOS-native, no BAA issues, user owns the data. Capacitor-bundled mode (your current architecture) supports this natively.
2. **Google Fit** — Android equivalent.
3. **Manual FHIR JSON upload** — CCDA, C-CDA, FHIR Bundle — user uploads from their EHR's export, Tabula Medica parses and ingests.
4. **Document upload with OCR** — Photo/scan of paper records, extract text via OCR, structure via LLM. Health Mint has `DocumentUploadOCR.jsx`.
5. **Epic MyChart (via Fasten Health)** — largest US EHR, already in Tabula Medica's integration plan.

### P2 — v1.5 Expansion
6. **Athena Health (via Fasten Health)**
7. **Healow / eClinicalWorks (via Fasten Health)**
8. **CMS Patient Access API** — Medicare / Medicaid claims data, public government endpoint (no BAA needed with CMS directly)
9. **Surescripts** — pharmacy benefit data, prescription history

### P3 — v2.0 Aggregator-Mediated
10. **Terra API (wearable aggregator)** — single connection unlocks Fitbit, Garmin, Oura, Whoop, Suunto, Samsung Health, MyFitnessPal. One BAA, multiple devices.
11. **Particle Health / Health Samurai** — FHIR-as-a-Service, backup to Fasten
12. **LabCorp / Quest Direct APIs** — if patients want lab results outside EHR integration

### P4 — Enterprise/Provider Features (post-Series A)
13. **TEFCA Qualified Health Information Network** — federal interoperability framework
14. **HIE (Health Information Exchange)** regional connections
15. **Payer Claims APIs** (Blue Button for Medicare, state Medicaid APIs)

**Tabula Medica integration philosophy:**
- Every integration flows through the `phiDb` wrapper (your F1 architecture)
- BAA required for every vendor that sees PHI
- User consent required for every new data source (CCPA/GDPR)
- Integration status visible on `/connections` page
- Auto-sync on/off per source, per user

---

## Part 4 — "Do Not Port" List (Explicitly Reject)

These are Health Mint features/pages that would ADD complexity without ADDING value. Actively avoid porting them.

### ❌ The 200+ Compliance Dashboard Pages
Health Mint has separate pages for: HIPAA Dashboard, HITRUST Dashboard, SOC2 Dashboard, ISO42001 Dashboard, FedRAMP Dashboard, PCI-DSS Dashboard, GDPR Dashboard, CCPA Dashboard, VA Mobile Compliance, Unified Compliance Dashboard, Advanced Compliance Suite, Compliance Evolution, Compliance Hub, Compliance Testing Hub, plus many more.

**This is compliance theater.** A real HIPAA audit doesn't happen in a dashboard — it happens in a binder with documentation, BAAs, policies, training records, incident response logs, pen-test reports, penetration test results, and third-party audit attestations. The dashboards display vanity metrics that don't pass a real audit.

**What Tabula Medica should have instead:** One admin page called `/admin/compliance-status` showing actual verifiable facts (last BAA review date, # BAAs active, last pen-test date, encryption status, audit log retention age, open incidents). No LLM-generated "compliance scores" — those are audit findings waiting to happen.

### ❌ Duplicate/Redundant Dashboard Pages
Health Mint has: `AdminAnalyticsDashboard`, `AdvancedAnalyticsDashboard`, `AdvancedAnalytics`, `InteractiveAnalyticsDashboard`, `AdvancedHealthAnalytics`, `EnhancedDashboard`, `UnifiedPatientDashboard`, `ProviderDashboardNew`, `ProviderDashboardHub`, `ProviderDashboardPortal`, plus 20+ more "dashboard" pages.

This is classic AI-generated scaffold bloat — each page claiming to be "the" dashboard without clear distinction. Tabula Medica should have ONE patient dashboard, ONE provider dashboard, ONE admin dashboard. Maximum three.

### ❌ Per-Disease Dedicated Pages
Health Mint has: `CancerCare`, `ChronicCareJourney`, `ChronicManagement`, `DiseaseAlerts`, `DiseaseOutbreakAlerts`, `RareDiseaseGuide`, etc. 

Per-disease UI doesn't scale. There are 10,000+ recognized human diseases. A general-purpose chronic condition management module + AI-powered personalization is cleaner than N hardcoded disease modules.

### ❌ Provider-Facing Features (for now)
`ProviderPortal`, `ProviderDashboard`, `ProviderCollaboration`, `ProviderMessagingHub`, `ProviderReferrals`, etc.

Tabula Medica is patient-facing. Providers are NOT the initial user. Adding provider-facing features before you've proven patient product-market fit is classic scope creep. Defer until you have 10,000+ patient users requesting provider connections.

### ❌ TEFCA / HIE / Enterprise Interop Features
Valuable eventually, but this is federal/hospital-system integration territory — requires 1-3 year regulatory certification processes, QHIN affiliation, partner contracts. Way past TestFlight.

### ❌ Gamification (debatable — see below)
Health Mint has extensive gamification (points, achievements, leaderboards, challenges, badges).

**My recommendation:** SKIP for v1.0. Reasons:
1. Gamification on health data has patient safety risks (encouraging risky "streak" behaviors)
2. HIPAA covered entities rarely gamify PHI — looks unserious
3. Accessibility barriers — gamification is cognitive-load heavy
4. Apple's app review scrutinizes medical-gamification interaction

If you want engagement loops, focus on **care pathway check-offs** (functionally similar, clinically valid) rather than generic "streaks" and "points."

---

## Part 5 — Health Mint Features Tabula Medica ALREADY HAS (For Your Awareness)

So you don't accidentally think these are new:

| Feature | Tabula Medica Status |
|---|---|
| FHIR health records | ✅ Built |
| Drug interaction checker | ✅ Built (FDA openFDA) |
| Care gap detection | ✅ Built (USPSTF Grade A/B, rule-based) |
| HIPAA audit logs | ✅ Built (Session 2c architecture) |
| AES-256-GCM field-level encryption | ✅ Built (F1 program, 102+ violations resolved Saturday) |
| Accessibility provider with 19 toggles | ✅ Built (per Action Item U audit) |
| Skip links, focus indicators | ✅ Built |
| Prior authorization screen | ✅ Built |
| Care Access microservice (FQHC, Medicaid, GoodRx, SAMHSA) | ✅ Built |
| WhatsApp sharing | ✅ Built |
| 22-language support | ✅ Built |
| CAC/PIV smart card module | ✅ Built (DoD) |
| FIPS 140-3 cryptography | ✅ Built |
| Legal pages scaffolding (7 routes, DOMPurify, auth guard) | ✅ Built (Session 4 Saturday) |
| Push notification infrastructure | ❌ STUB (Action Item P — pre-TestFlight blocker) |
| Consent banner | ❌ NOT BUILT (Action Item R — post-TestFlight) |
| AI opt-out mechanism | ❌ NOT BUILT (Action Item Q — post-TestFlight 60-day) |
| Ambient encounter notes | ⚠️ Promised in Privacy Policy, not yet implemented |

---

## Part 6 — Technology Stack Learnings

What Health Mint uses that Tabula Medica should consider adding:

### ✅ Worth adopting
- **`sonner`** (toast notifications) — already lightweight, works well with tailwind
- **`canvas-confetti`** — small UX delighter for positive moments (care goal achieved)
- **`embla-carousel-react`** — clean touch-friendly carousel for onboarding
- **`framer-motion`** — motion design (see UX #4 above)
- **`recharts`** — already likely in Tabula Medica; worth verifying — best React chart library
- **`react-day-picker`** — accessible date picker, beats native for medical dates
- **`react-markdown`** — for rendering AI-generated clinical summaries with formatting
- **`cmdk`** — backend for the Command Palette (UX #7)

### ⚠️ Consider carefully
- **`three`** (3D graphics) — Health Mint uses this for "advanced visualization." Heavy dependency. Only worth it for ACTUAL 3D use cases (anatomical models, molecular diagrams). Don't add "just in case."
- **`html2canvas` + `jspdf`** — for "print this record as PDF" features. Useful but large. Lazy-load.
- **`qrcode`** — QR sharing is a nice feature. Small dep. Worth adding when sharing UX expands.
- **`input-otp`** — for MFA. Already likely handled by Auth0 UI.
- **`react-leaflet`** — maps for FQHC finder, nearby providers. Good addition when Care Access gets a map view.

### ❌ Do not adopt
- **`@base44/sdk`** — base44 backend-as-a-service. Incompatible with Tabula Medica's owned architecture.
- **`next-themes`** — light/dark mode. Overkill for v1. Rely on `prefers-color-scheme` + existing accessibility provider.
- **`otpauth` + `qrcode`** for custom 2FA — Auth0 handles this already.

---

## Part 7 — LLM Prompt Engineering Patterns Worth Studying

Health Mint's most valuable technical asset is **battle-tested clinical LLM prompts**. Extract these patterns:

### Pattern A — Structured Output Schema (Always)
Every LLM call specifies a `response_json_schema` to constrain output. No free-text responses. Reduces hallucination and makes output renderable.

Example (from AI Predictive Analytics):
```javascript
response_json_schema: {
  type: "object",
  properties: {
    overall_risk_score: { type: "number" },
    predictions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          risk_score: { type: "number" },
          confidence: { type: "number" },
          timeframe: { type: "string" },
          interventions: { type: "array", items: { ... } },
          warning_signs: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
}
```

### Pattern B — Comprehensive Data Aggregation Before LLM Call
Prompts include ALL relevant patient data: vitals, labs, meds, conditions, symptoms, appointments, recent hospitalizations, mental health indicators. Not chunks — full context.

### Pattern C — Multi-Domain Analysis Prompting
Prompts ask for analysis across multiple risk categories simultaneously (cardiovascular + diabetes + mental health + fall risk) rather than separate single-category calls. One prompt, comprehensive output, lower cost.

### Pattern D — Action-Oriented Output
Every AI output includes actionable next steps, not just analysis. "Here are 3 specific things to do this week" vs "your risk is elevated."

### Pattern E — Confidence Scores
Every AI-generated claim has a numeric confidence (0-1) displayed. Patients calibrate trust accordingly. Defensible from a clinical-ethics perspective.

**Tabula Medica should port these patterns into your existing BAA+ZDR AI pipeline** — not just copy the prompts, but adopt the engineering discipline (structured schema, comprehensive context, multi-domain, actionable, confidence-scored).

---

## Part 8 — Implementation Roadmap (Phased)

### Phase A — v1.0 (TestFlight Submission)
**Target date:** 2-3 weeks from today
**Feature adds from Health Mint:** None (focus on TestFlight blockers)
**Exception:** If Command Palette (UX #7) is genuinely 3-4 hours of work and doesn't destabilize TestFlight readiness, add it — pure UX upgrade, zero risk.

### Phase B — v1.1 (Post-TestFlight, 4-6 weeks)
**Feature adds:**
- 🥇 #1 AI Patient Chart Summary
- UX #3 Mobile bottom-nav (addresses Action Item U Finding #1)
- UX #1 Gradient system (accessibility-gated)
- UX #4 Motion design with framer-motion
- UX #5 AI Health Coach CTA
- Integration P1 — Apple Health, Google Fit, Manual FHIR upload

### Phase C — v1.2 (Second month post-launch)
**Feature adds:**
- 🥈 #2 AI Predictive Risk Analytics
- #8 Family/Caregiver Sharing
- UX #2 Dashboard Customizer
- Integration P1 — Document OCR, Epic MyChart

### Phase D — v1.5 (3-4 months post-launch)
**Feature adds:**
- 🥉 #3 Health Graph Visualization
- #4 Unified Health Hub page
- #6 AI Care Pathway Generator
- #9 Extended Care Gaps (AI layer)
- #10 One-Tap Share Export
- Integration P2 — Athena, eClinicalWorks, CMS, Surescripts

### Phase E — v2.0 (6 months post-launch)
**Feature adds:**
- #5 Ambient Encounter Notes (Whisper via BAA)
- Integration P3 — Terra API for wearables
- Provider-facing features (if patient growth justifies it)

### Out of scope (maybe v3.0+)
- TEFCA / HIE connections
- Provider portal expansion
- Gamification
- Per-disease modules

---

## Part 9 — Total Effort Estimate

| Phase | Features | Replit sessions | Calendar weeks |
|---|---|---|---|
| A (current focus) | TestFlight blockers | 3-5 | 2-3 |
| B | Top 1 + 4 UX + 3 integrations | 8-10 | 4-6 |
| C | Top 2 + #8 + 2 UX + 2 integrations | 10-12 | 5-8 |
| D | Top 3 + #4, #6, #9, #10 + 4 integrations | 18-22 | 10-14 |
| E | Top 5 + Terra | 8-10 | 5-8 |
| **Total** | | **47-59 sessions** | **26-39 weeks** |

**Reality check:** ~6-9 months of focused engineering from TestFlight date, working at Saturday-session cadence (1-2 sessions/weekend) plus some weekday time. That's realistic for a founder-CEO with external obligations.

**Accelerator option:** If you hire one part-time engineer post-Seed (say $3K/month contractor), the timeline compresses to 3-4 months.

---

## Part 10 — Critical Decisions You Need to Make

Before the Replit agent starts porting ANY of this, you need to decide:

### Decision 1 — Brand color direction
Health Mint = violet/purple. Tabula Medica planned = teal (`#0D9488`). Uninsurance = teal variant (cousin).
- **Option A:** Stay teal. Defensible — distinguishes from Health Mint's predecessor.
- **Option B:** Switch to Health Mint violet. Inherits visual identity but creates brand confusion.
- **Option C:** New palette (e.g., deep blue like Mayo Clinic). Clean slate, new identity.
**Recommendation:** A. You've already committed teal in Termly Privacy Policy branding settings.

### Decision 2 — Motion design philosophy
- Health Mint-style staggered animations everywhere? or minimal/functional only?
**Recommendation:** Minimal. Respect `prefers-reduced-motion` universally. Delight at key moments (care gap closed, goal achieved) rather than default everywhere.

### Decision 3 — AI-first vs clinical-first surface
Health Mint puts AI EVERYWHERE. Every feature has an AI component. This is maximally modern but can feel overwhelming and questionable for medical use.
- **Option A:** AI-first (like Health Mint). Every dashboard widget is AI-generated. Action Item Q opt-out becomes critical.
- **Option B:** Clinical-first, AI-augmented. Rule-based care gap detection is authoritative; AI is a supplementary layer with clear labels.
- **Recommendation:** B. Safer clinically. Auditable. Trustworthy for HIPAA covered entity status. Aligns with your existing USPSTF rule-based architecture.

### Decision 4 — Capacitor native vs web-only
Tabula Medica plans iOS/Android native via Capacitor. Health Mint is web-only. Some features (Apple HealthKit, Google Fit, biometric auth, push notifications) REQUIRE native.
- **Recommendation:** Stick with Capacitor-bundled mode per project memory. It's the right architecture for a HIPAA patient app.

### Decision 5 — Provider features scope
- Do you want ANY provider-facing features in v1.0? Or strictly patient?
- **Recommendation:** Strictly patient for v1.0. Provider features v2.0+. Complex permission models, separate user accounts, different marketing, separate app store listing potentially.

---

## Part 11 — What To Do Right Now

### Immediate (tonight)
1. Read through this report — confirm it matches your mental model
2. Answer the 5 decisions in Part 10
3. **Finish Termly** — Cookie Policy + Disclaimer + Accessibility (the actual TestFlight critical path)
4. Let the Replit agent continue its parked state

### Tomorrow (Sunday)
1. Review Part 10 decisions with fresh eyes
2. If decisions stick — file this report at `.local/deliverables/health-mint-mining-report.md` in the Replit project
3. Generate a condensed "v1.1 feature backlog" document specifically scoped to what the Replit agent can pull

### Next week
1. Start Phase B (v1.1) planning after TestFlight submission
2. Identify which Health Mint features pull first based on marketing value
3. Build Sprint #1 = AI Patient Chart Summary + Mobile Bottom-Nav + Framer Motion (3 feature-adds, one sprint)

---

## Part 12 — Final Honest Assessment

**Health Mint represents probably 3-5 years of product exploration in ~1500 component files.** Not all of it is good. The AI-generated scaffolding produces many duplicate pages of uncertain quality. The compliance dashboard theater is a waste of effort. Provider-side features are premature for a patient-focused v1.

**But the GEMS in Health Mint are genuinely valuable:**
- AI Predictive Risk Analytics (best patient-level risk scoring I've seen in consumer code)
- Health Graph Visualization (unique differentiator)
- Comprehensive integration taxonomy (roadmap of what "fully connected" means)
- LLM prompt engineering patterns (structured output schemas, comprehensive context, multi-domain analysis)
- Modern UX patterns (command palette, gradient system, motion design)

**Tabula Medica's correct posture:**
1. Finish TestFlight with your CURRENT feature set (which is already strong — encryption architecture, legal pages, Care Access, FHIR, drug interactions, care gaps)
2. Ship v1.0 and collect real patient feedback
3. Mine Health Mint for v1.1-v2.0 features based on what patients actually ask for
4. Don't try to absorb all of Health Mint at once — you'd dilute the tight product Tabula Medica is today

**You didn't waste months on Health Mint** — you built a reference catalog of what your ultimate product looks like. Now you know the destination. The journey is porting 10-12 high-ROI features over 6-9 months, not shipping a 284-page scaffold.

---

*End of Mining Report*

*Next action: file this at `.local/deliverables/health-mint-mining-report.md` in the Replit project for Replit agent reference. Then finish Termly. Then TestFlight.*
