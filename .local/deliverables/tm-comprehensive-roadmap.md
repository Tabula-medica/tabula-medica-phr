# Tabula Medica — Comprehensive Roadmap & Session Plan

**Prepared:** April 20, 2026 (Sunday evening, focus window)
**Purpose:** Master roadmap for TM post-TestFlight through v2.0, integrating Health Mint mining + 2026 regulatory landscape + current state + executable session plan.
**Approach:** I (Claude) produce the thinking + plan; TM Replit agent executes; this document tracks progress session-by-session.
**Companion docs:**
- `health-mint-mining-report.md` — full mining analysis (once uploaded to TM project)
- `unified-architecture-plan.md` — TM+UNIn cousins architecture
- `f1-status.md` — F1 encryption program current status
- `f1-action-items.md` — action items queue

---

## Section A — 2026 Regulatory Landscape (What Changed Since Saturday)

### A.1 HIPAA February 16, 2026 compliance deadline (PASSED)

Notice of Privacy Practices must have been updated by this date. The TM Privacy Policy produced in Termly MUST include:
- Substance Use Disorder (Part 2) records protection language (per 42 CFR Part 2 alignment with HIPAA, effective Feb 16, 2026)
- Updated language around PHI use restrictions

**TM action:** Verify Termly-generated Privacy Policy includes Part 2 / SUD record language. If not, add via Termly's Additional Clause feature. File as Action Item AB.

### A.2 HIPAA Security Rule overhaul (expected finalization May 2026)

HHS NPRM released December 27, 2024 proposing first major Security Rule overhaul since 2003. Expected finalization mid-2026. **Key changes to prepare for:**

- **MFA becomes mandatory** (not just addressable) — TM must have MFA enforced for all admin + provider roles pre-launch
- **Encryption becomes mandatory** for PHI at rest AND in transit — F1 program already aligned
- **Audit logging becomes mandatory with comprehensive written documentation** — Action Item AA (patient-engagement audit gap) becomes higher priority
- **Penetration testing + vulnerability scanning mandatory** — must establish cadence
- **Incident response plans mandatory with tested tabletop exercises** — new requirement for TM
- **Asset inventory + network diagram documentation mandatory**

**TM action:** File Action Items for each new requirement. Prioritize pre-launch items (MFA, encryption, audit logs) ahead of operational items (incident response tabletop exercises).

### A.3 USCDI v3 mandatory January 1, 2026 (PASSED) — TM must comply

ONC's HTI-1 Final Rule requires certified health IT to support USCDI v3 for data exchange. TM as a patient-owned FHIR records app SHOULD support USCDI v3 data classes for exchange with certified EHRs.

**USCDI v3 data classes (TM must support reading these from external EHRs):**
- Allergies & Intolerances
- Assessment & Plan of Treatment
- Care Team Members
- Clinical Notes (8 types)
- Clinical Tests (new in v3)
- Diagnostic Imaging
- Encounter Information
- Goals
- Health Concerns
- Health Insurance Information (new class in v3)
- Health Status Assessments (SDOH — new in v3)
- Immunizations
- Laboratory
- Medications
- Patient Demographics / Information (expanded with preferred language, sexual orientation, gender identity)
- Patient Summary & Reason for Referral
- Problems
- Procedures
- Provenance
- Unique Device Identifier(s) for Implantable Devices
- Vital Signs

**USCDI v5 (published July 2024) and v6 (published July 2025) voluntary via SVAP.** USCDI v7 drafted January 2026.

**TM action:** Audit current FHIR resource handling vs USCDI v3 data classes. Gap analysis: which classes does TM handle today, which are gaps. File as Action Item AC.

### A.4 TEFCA FHIR deadline January 1, 2026 (PASSED)

QHINs now required to support FHIR API-based exchange with HL7 FAST security protocols (UDAP JWT authentication, dynamic registration, fine-grained OAuth scopes). Individual Access Services (IAS) via SMART-on-FHIR is primary consumer-facing use case.

**TM strategic implication:** If TM eventually wants to participate in TEFCA as an IAS app, it needs:
- SMART on FHIR client capabilities (already planned for Phase 1.3 of Care Access)
- UDAP JWT client authentication support
- Onboarding with a QHIN (Epic Nexus, eHealth Exchange, CommonWell, etc.)
- RCE Directory registration
- SOC2 / HITRUST certification typically required by QHINs

**TM decision:** TEFCA participation is v2.0+ scope. v1.0 = direct Fasten Health integration + Apple HealthKit + Google Fit. TEFCA becomes achievable once Care Access microservice Phase 1 is built + SOC2 audit completed.

**File as Action Item AD (v2.0 roadmap).**

### A.5 CMS Prior Authorization for Drugs Proposed Rule (CMS-0062-P, April 2026)

HHS proposing FHIR Da Vinci CDex (Clinical Data Exchange) as standard for prior authorization attachments. Compliance date likely 24 months after final rule (so 2028+).

**TM implication:** Existing TM prior-auth screen is aligned with coming federal standards. Good positioning. No immediate action; monitor.

### A.6 Reproductive Health Rule vacated (June 2025)

Texas federal court vacated the April 2024 Reproductive Health Care Rule that restricted PHI use for reproductive health investigations. **BUT:** The NPP updates for Part 2/SUD records remain in effect (separate requirement).

**TM implication:** Don't include reproductive-health-specific restrictions in privacy policy (rule is vacated). DO include Part 2/SUD record language (still required).

### A.7 AI in Healthcare — Emerging Standards (2026)

- HHS released AI Risk Management framework for healthcare (2025)
- ISO 42001 AI Management System Standard applicable to health AI
- FDA guidance on AI/ML in medical devices continues expanding
- State-level AI transparency laws (California AB 331, Texas SB 1116) require disclosure when AI is used in healthcare decisions

**TM implication:** Any AI feature (Health Mint mining recommendations #1, #2, #6, #9) must include:
- Clear disclosure that AI is being used
- Confidence scores (per Health Mint Pattern C)
- Opt-out mechanism (Action Item Q)
- Training data / model provenance documentation
- Human-in-the-loop for any clinical recommendation

**File as Action Item AE — AI transparency and governance framework for TM's AI features.**

---

## Section B — Current TM State (As of Sunday Evening)

### B.1 Shipped and working

- **F1 PHI encryption program:** 102→84 violations (18 resolved this session), 72/72 tests passing, ESLint rule `tabula/no-string-form-logger` promoted warn→error
- **CI pipeline:** vitest step added, typecheck hard-fails, lint informational (Strategy D)
- **Legal pages scaffolding:** 7 routes live with auth-guard publicLegalRoutes allowlist
- **Accessibility:** 19-toggle AccessibilityProvider, skip links, WCAG AA baseline
- **Compliance features:** Prior authorization screen, drug interaction checker (FDA openFDA), USPSTF Grade A/B care gaps, FIPS 140-3 crypto, CAC/PIV smart card
- **FHIR records:** Core read/write with Fasten Health integration
- **Mobile:** Capacitor wrapper ready for iOS/Android builds
- **Auth:** Auth0 (BAA pending, 2-3 week clock)

### B.2 In-flight

- TMD-1 F1 file execution (done — 18 resolved)
- TMD-2 Health Mint report integration (blocked on file upload)
- Action Item AA: audit-log gap in patient-engagement-service (filed, dedicated session required)
- Action Item Y: CI Strategy C transition (triggered when no-restricted-syntax = 0)

### B.3 Pre-TestFlight blockers (hard)

1. **Apple reviewer response (Path A)** — keep iPad support, debug + fix iPad
   login error (submission `69f718ee`, iPad Air 11-inch M3 / iPadOS 26.4.1,
   "error message when attempting to login"). Path B (drop iPad) was
   considered and REJECTED by user.
2. **Auth0 BAA executed** — 2-3 week external clock
3. **7 legal pages populated with real Termly content** — blocked on Termly Cookie/Disclaimer/Accessibility
4. **Push notification implementation** (Action Item P) — currently console.log stub
5. **Accessibility Findings 1-2** (Action Item U) — button tap targets, prefers-reduced-transparency
6. **Action Item AB (new):** Part 2/SUD NPP language verification

### B.4 Pre-First-Real-Patient blockers (hard)

1. Action Item M (key escrow Monday bank trip)
2. Action Item H (plaintext backfill script)
3. Action Item L (key ring for rotation)
4. Action Item AA (patient-engagement audit logs)
5. Action Item AE (AI transparency framework)

---

## Section C — Master Porting Plan (Sessions 1-N)

Organized by phase. Each session is scoped to be completable in 45-90 minutes with the TM Replit agent following Session Start Protocol.

### Phase A — TestFlight readiness (Sessions 1-5)

**Target:** TM approved on App Store within 7-10 days of starting this phase.

#### Session A1 — TM iOS Path A: iPad login diagnostic + fix
**Scope:** Diagnostic-first investigation of iPad login error, then fix.
iPad support is RETAINED — Path B (drop iPad) was rejected by user.
**Phase 1 (diagnostic, no code):** read iOS configs, grep for iPad-specific
code paths, identify Auth0 integration pattern, list recent auth-touching
commits, produce ranked hypothesis list, propose reproduction strategy.
**Phase 2 (fix execution):** scope determined by Phase 1 findings; user
approves approach before any code changes.
**Files likely touched in Phase 2:** `app.json` and/or
`tabula-medica-mobile/app.config.js` and/or `capacitor.config.ts` (the
project has THREE concurrent mobile configs — see TMD-4 Phase 1 report
finding); possibly Auth0 dashboard settings (user-side); possibly
`server/replit_integrations/auth/replitAuth.ts` (recent commit `9d171a6e`).
**Duration:** Phase 1 = 30-45 min (DONE in TMD-4); Phase 2 sized after
Phase 1 review.
**Status:** Phase 1 COMPLETE (TMD-4, 2026-04-20). Phase 2 awaiting user
selection of fix approach from the hypothesis list.

#### Session A2 — F1 file continuation (next file)
**Candidate:** `services/patient-engagement-service.ts` was done in TMD-1. Next candidate:
- `server/routes/medication-management-routes.ts` (if not yet done)
- `server/routes/health-tracking-routes.ts` (~28 violations)
- TM agent to grep for highest-violation file
**Duration:** 45-60 min
**Dependencies:** TMD-1 complete (DONE)

#### Session A3 — Push notification implementation (Action Item P)
**Scope:** Implement Capacitor Local Notifications Phase 1. Replace console.log stub in `appointment-reminders.ts::sendPushNotification` with real native notifications.
**Files:** `services/appointment-reminders.ts`, Capacitor plugin install, iOS/Android native config
**Duration:** 60-90 min
**Dependencies:** None

#### Session A4 — Accessibility remediation (Action Item U Findings 1-2)
**Scope:**
- Fix all button base sizes to 44×44pt minimum (iOS HIG)
- Implement prefers-reduced-transparency auto-mirror for Liquid Glass UI
**Files:** component library buttons, global CSS, accessibility provider
**Duration:** 60 min
**Dependencies:** None

#### Session A5 — Legal page content integration
**Scope:** Paste Termly-generated policy content into `/legal/*` pages. Remove placeholder language.
**Files:** 7 legal page components
**Duration:** 30-45 min
**Dependencies:** All 5 Termly policies published + reviewed (user task)

---

### Phase B — Post-TestFlight critical path (Sessions 6-10)

#### Session B1 — Action Item AB (Part 2/SUD NPP language)
**Scope:** Verify Termly Privacy Policy includes HIPAA Part 2/SUD record protection language (required by Feb 16, 2026 deadline). Add via Termly Additional Clause if missing.
**Duration:** 15-30 min user task + agent documentation update
**Dependencies:** Termly Privacy Policy accessible

#### Session B2 — F1 file continuation (high-violation file)
**Duration:** 45-60 min
**Target:** Get F1 no-restricted-syntax count below 50

#### Session B3 — Action Item AA (patient-engagement audit logs)
**Scope:** Dedicated session for HIPAA §164.312(b) audit log instrumentation. Design action code taxonomy, reasonCode alignment, userId capture conventions. Instrument ~16 sites in patient-engagement-service.ts.
**Duration:** 90-120 min (dedicated session as flagged by agent)
**Dependencies:** None

#### Session B4 — Action Item AE (AI transparency framework)
**Scope:** Establish TM's AI governance framework before any Health Mint AI features port. Includes:
- AI disclosure UI component (reusable)
- Opt-out state (aiProcessingEnabled boolean in user preferences)
- Middleware that respects opt-out
- Confidence score UI pattern
- Training data provenance docs
**Duration:** 90-120 min
**Dependencies:** None; blocks all subsequent AI feature sessions

#### Session B5 — F1 file continuation
**Duration:** 45-60 min
**Target:** Drive toward F1 program completion

---

### Phase C — Health Mint mining execution (Sessions 11-25)

**Per Health Mint mining report for TM, ranked order:**

#### Session C1 — AI Patient Chart Summary (Health Mint Feature #1)
**Scope:** Auto-refreshing dashboard widget that generates comprehensive patient summary via LLM. Ranked #1 because it's the "this app understands me" onboarding moment.
**Files:** New `AIPatientChartSummary` component, new backend route `POST /api/ai/patient-summary/:profileId`, new `ai_patient_summaries` table, middleware integration with Action Item AE opt-out
**Duration:** 60-90 min
**Dependencies:** Action Item AE complete, BAA with LLM vendor (Anthropic or OpenAI)
**Regulatory:** Apply USCDI v3 data classes to input context

#### Session C2 — Mobile bottom-nav refinement (Health Mint UX Pattern #3)
**Scope:** Audit current TM mobile nav vs Health Mint 5-tab pattern. Refine to ensure 44×44pt tap targets (satisfies Action Item U Finding 1).
**Files:** Mobile navigation components
**Duration:** 45 min
**Dependencies:** None; addresses accessibility finding

#### Session C3 — Framer-motion staggered entrance (Health Mint UX Pattern #4)
**Scope:** Add framer-motion dependency (confirm not already present), apply staggered entrance to dashboard cards. Respects prefers-reduced-motion.
**Duration:** 45 min
**Dependencies:** None

#### Session C4 — AI Predictive Risk Analytics (Health Mint Feature #2)
**Scope:** 6-category structured risk scoring (diabetes, CV, readmission, medication adverse, fall, mental health). Structured JSON output per Health Mint Pattern A. User's specific interest per project memory (population health angle).
**Files:** New route, new table `ai_risk_assessments`, frontend component, weekly regeneration scheduler
**Duration:** 2 sessions (Part 1 = backend + schema, Part 2 = frontend + scheduler)
**Dependencies:** Action Item AE complete, Session C1 complete (builds on patient context pattern)
**Regulatory:** AI transparency framework applied; confidence scores required; opt-out honored

#### Session C5 — Family/Caregiver Sharing (Health Mint Feature #8)
**Scope:** Granular permission matrix for caregiver access (vitals/meds/appointments/labs/notes toggles). Email-based invitation, 1-year default expiry, revocation.
**Files:** Expand existing `shared_access` table, new `/sharing` page, permission enforcement middleware
**Duration:** 2 sessions
**Dependencies:** None
**Regulatory:** HIPAA §164.522 alignment, aligns with 2026 Patient Access Rule

#### Session C6 — Unified Health Hub page (Health Mint Feature #4)
**Scope:** Single "My Connections" page showing all integrated data sources (Fasten, Apple Health, Google Fit, manual FHIR upload, future Epic/Athena). Each connector has standardized UI pattern.
**Files:** New `/connections` page, connector component library
**Duration:** 60-90 min
**Dependencies:** None (extends existing Fasten integration)

#### Session C7 — Automated Care Gaps AI Layer (Health Mint Feature #9)
**Scope:** Extend existing USPSTF rule-based care gaps with LLM augmentation for broader gap identification. Clearly labeled "AI-suggested — confirm with your doctor."
**Files:** `services/care-gaps-ai.ts`, extend existing `routes/care-gaps.ts`
**Duration:** 60 min
**Dependencies:** Action Item AE complete
**Regulatory:** AI transparency + clinical-first with AI-augmented labels per project memory decisions

#### Session C8 — One-Tap Share Export (Health Mint Feature #10)
**Scope:** Patient picks recipient/scope/data, AI generates clinical summary, secure link + PDF share.
**Files:** New route, SendGrid integration, PDF generation
**Duration:** 90 min
**Dependencies:** Session C1 AI patterns established

#### Session C9 — Health Graph Visualization (Health Mint Feature #3)
**Scope:** Interactive graph of conditions ↔ medications ↔ labs ↔ symptoms with LLM-built relationships.
**Files:** New `/health-graph` page with d3-force or xyflow visualization, `health_graph_nodes` + `health_graph_edges` tables, LLM relationship builder
**Duration:** 2-3 sessions
**Dependencies:** Session C1 AI patterns established, Action Item AE
**Note:** This is a differentiator feature — no consumer health app has this

#### Session C10 — AI Care Pathway Generator (Health Mint Feature #6)
**Scope:** Multi-phase care pathway for chronic conditions with medication/lifestyle/monitoring interventions.
**Files:** New route, `care_pathways` table with versioning, frontend
**Duration:** 2 sessions
**Dependencies:** Sessions C1, C4 complete

#### Session C11 — Command Palette (Health Mint UX Pattern #7)
**Scope:** Cmd+K global search/action overlay.
**Files:** New component using cmdk library
**Duration:** 30-45 min
**Dependencies:** None; quick win

---

### Phase D — Care Access Microservice Phase 1 (Sessions 26-35)

Per unified architecture plan §7:

#### Session D1-D5: Phase 1.1 Care Access scaffolding
- Module directory + CARE_BRIDGE_SECRET HMAC signing + internal-trust auth
- Observability (object-form logging per Action Item T)
- PHI-redaction middleware
- Vitest scaffolding
- `replit.md` update

#### Session D6-D7: Phase 1.2 FHIR bridge endpoint
- `/care-access/signal/:cohort` endpoint
- Wire to existing PHI-Deidentification service
- Cohort taxonomy design
- Audit-log writer
- Rate-limiting

#### Session D8-D10: Phase 1.3 SMART-on-FHIR auth server
- Existing scaffolding production-readiness audit
- PKCE-only hardening
- Token endpoint hardening
- `.well-known/smart-configuration` discovery
- Consent screen UI
- `linkConsentsTable` (depends on Action Item N)
- Token-revocation cascade

---

### Phase E — Enhanced integrations (Sessions 36-45)

#### Sessions E1-E3: Ambient Encounter Notes (Health Mint Feature #5)
Whisper via BAA (not browser Web Speech for privacy), 16-language support, structured extraction.

#### Sessions E4-E5: Apple HealthKit deep integration
Beyond basic Fasten passthrough — native iOS HealthKit for richer data types.

#### Sessions E6-E7: Google Fit deep integration
Android equivalent.

#### Sessions E8-E10: TEFCA IAS app onboarding (aspirational v2.0)
QHIN selection, UDAP JWT setup, RCE Directory registration, SOC2 audit prerequisite.

---

## Section D — What TM EXPLICITLY Does NOT Do

Per Health Mint mining "Do Not Port" + strategic clarity:

- **No provider-facing features in v1.0-v2.0** — patient-only focus
- **No compliance theater dashboards** (HITRUST scores, SOC2 live dashboards, etc.)
- **No per-disease modules** (CancerCare, RareDisease, etc.)
- **No gamification** (patient safety concerns)
- **No TEFCA QHIN participation** until v2.0+ (too expensive/slow until product proven)
- **No reproductive-health-specific restrictions** (rule vacated June 2025)
- **No duplicate dashboards** (ONE patient dashboard, ONE admin dashboard, ONE provider dashboard eventually)

---

## Section E — Progress Tracking (Living Document)

### Sessions completed
| Session | Date | Scope | Outcome |
|---|---|---|---|
| TMD-1 | 2026-04-20 | F1 file patient-engagement-service.ts | 18 resolved, cumulative 102→84 |
| TMD-0 | 2026-04-20 | CI pipeline + vitest + Action Item Y | Shipped |

### Sessions queued
| Session | Priority | Dependency | Est. duration |
|---|---|---|---|
| A1 Phase 2 — Path A iOS fix | 🔴 CRITICAL | User picks fix approach from TMD-4 hypothesis list | 30-90 min depending on hypothesis |
| A2 — F1 next file | 🟡 HIGH | None | 45-60 min |
| TMD-2 — Health Mint roadmap doc | 🟡 HIGH | File upload to TM project | 15-20 min |
| B1 — Part 2/SUD verify | 🟡 HIGH | Termly accessible | 15 min |
| B3 — AA audit logs | 🟡 HIGH | Dedicated session | 90-120 min |
| B4 — AE AI framework | 🟡 HIGH | None; blocks Phase C | 90-120 min |
| A3 — Push notifications | 🟡 HIGH | None | 60-90 min |
| A4 — Accessibility | 🟡 HIGH | None | 60 min |
| A5 — Legal content | 🟡 HIGH | Termly policies done | 30-45 min |
| C1 — AI Patient Summary | 🟢 MED | B4 complete + BAA | 60-90 min |
| [... all C1-C11, D1-D10, E1-E10 ...] | | | |

### Action Items Filed
| ID | Status | Description |
|---|---|---|
| H | PENDING | Plaintext backfill |
| I | IN PROGRESS | Encryption audit |
| K | IN PROGRESS | String-form logger sweep |
| L | PENDING | Key-ring for rotation |
| M | USER TASK Monday | Key escrow bank trip |
| N | PENDING | Drizzle reconcile |
| P | 🔴 PRE-TESTFLIGHT | Push notifications |
| Q | 🟡 POST-TESTFLIGHT | AI opt-out |
| R | 🟡 POST-TESTFLIGHT | Cookie consent banner |
| S | ✅ RESOLVED | CI pipeline |
| T | ✅ PROMOTED warn→error | Logger rule |
| U | 🟡 PARTIAL BLOCKER | Accessibility remediation |
| V | ✅ RESOLVED | Vitest runner |
| W | 🟡 BEFORE PUBLIC | Direct-to-main security gates |
| X | 🟡 DEFERRED | LegalDocument styling |
| Y | 🟡 TRIGGERED WHEN F1=0 | CI Strategy C transition |
| Z | 🟡 V1.5+ | TM keeps clinical care-gaps separately |
| **AA** | 🆕 FILED | Patient-engagement audit logs (HIPAA §164.312(b)) |
| **AB** | 🆕 FILED | Part 2/SUD NPP language verification |
| **AC** | 🆕 FILED | USCDI v3 data class gap analysis |
| **AD** | 🆕 FILED | TEFCA IAS participation (v2.0+ roadmap) |
| **AE** | 🆕 FILED | AI transparency framework |

---

## Section F — Next Immediate Actions

### Today (Sunday evening — if continuing)

1. **User:** Review TMD-4 Phase 1 diagnostic report; pick fix approach
   from ranked hypothesis list → dispatch Session A1 Phase 2 (Path A fix)
2. **User:** Upload `health-mint-mining-report.md` to TM project `.local/deliverables/`
3. **Agent (TMD-2):** Integrate Health Mint report → produce `TM-health-mint-roadmap-alignment.md` (~15 min)
4. **User:** Paste Session A1 Phase 2 directive (Path A fix, scope per
   selected hypothesis) to TM agent

### Monday morning

1. Key escrow bank trip (Action Item M)
2. Virginia APEX Accelerator call
3. VIPC SBIR call
4. Add `"test"`+`"lint"` scripts to package.json ✅ DONE
5. Submit new TM iOS build to Apple reviewer after EAS rebuild

### This week

1. Session B1 — Part 2/SUD verification
2. Session B3 — AA audit logs (dedicated)
3. Session B4 — AE AI framework (dedicated, blocks Phase C)
4. Session A2-A5 — remaining TestFlight blockers

### Next 2-3 weeks

- Phase C sessions begin (Health Mint features in ranked order)
- Auth0 BAA clock resolves
- Apple reviewer approves TM iOS (expected)
- First real patient pilot candidates identified

### Next 2-3 months

- Phase D begins — Care Access microservice Phase 1 scaffolding
- TM v1.1 ships with Top 3 Health Mint features
- Uninsurance DMPO registration progresses

### 6-12 months

- Phase E begins — enhanced integrations
- TM v2.0 scope — TEFCA participation, provider features if warranted
- Care Access microservice Phase 1 complete, connects TM ↔ UNIn

---

## Section G — Session Dispatch Directives Template

For each session below, I (Claude) produce the exact paste-to-TM-agent directive when ready. Format:

```
**TMD-<N> — <session name>**

<context>

**Pre-flight:**
1. <read relevant files>
2. <grep for violations or patterns>
3. <report findings>

**Execution plan:**
<specific steps>

**Constraints:**
<what not to do>

**Post-execution verification:**
<eslint, vitest, cumulative count update>

**Session Start Protocol applies.**
```

Each directive will be produced when that session is ready to dispatch, not in advance (so context is fresh).

---

## Section H — Document Maintenance

This document is the master living roadmap. After each session:

1. Move session from "Queued" to "Completed" in Section E
2. Update F1 cumulative count
3. Add new action items if surfaced
4. Update regulatory landscape if news arrives
5. Re-prioritize remaining sessions if needed

I (Claude) maintain this across conversation messages. If conversation context limits require, I'll recreate it from summary.

---

*End of Master Roadmap*

*Next action for user: answer the immediate-action questions in Section F, dispatch Session A1 when ready.*
