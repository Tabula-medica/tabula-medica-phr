# World EHR — Outpatient Revenue Cycle (RCM) Blueprint

**Scope:** every line item of the outpatient revenue cycle, mapped against what `omnihealth-ehr`
(World EHR) already ships, what this PR adds as a portable engine (`server/rcm/`), and how
voice + agentic AI are layered on. Written for the World EHR outpatient division.

**Assumption stated once:** the source notes referenced in the request were not attached, so this
blueprint is built from the EHR's own `docs/RCM-ARCHITECTURE.md`, `PRODUCT-ROADMAP.md`, the
`api/src/rcm` + `clinical` code, and industry RCM practice (HFMA/MGMA KPI definitions, X12
270/271, 278, 837P, 276/277, 835; CMS-0057-F prior-auth timelines; No Surprises Act GFE).

**Porting note:** `server/rcm/` is pure TypeScript with no PHR-specific imports except the
Vertex AI seam (`agents/ai.ts`) and the Express router. Copy the folder to
`omnihealth-ehr/api/src/rcm-next/`, point `agents/ai.ts` at `api/src/ai/vertex.ts`, and mount
`routes.ts` on the API app. Scrubber rule ids are identical to the EHR's `rcm/scrubbing.ts`
so the denial → prevention mapping works in both codebases.

Legend: ✅ EHR has it · 🟡 EHR partial · ⛌ EHR missing · ➕ added here (`server/rcm/...`)

## 1. The cycle, line by line

### Front end (patient access)

| # | Line item | EHR today | This engine | Voice | Agent |
|---|-----------|-----------|-------------|-------|-------|
| 1 | Scheduling + pre-registration | ✅ `/appointments`, kiosk | — (EHR owns) | "check eligibility for …" | `eligibility` runs pre-visit for every scheduled patient |
| 2 | Coverage capture (primary/secondary/tertiary, subscriber, relationship) | ✅ `/coverage` | ➕ `types.ts` Coverage w/ effective/termination + timely-filing days | card OCR (PHR `card-ocr-routes`) | — |
| 3 | Real-time eligibility 270/271 | ✅ Claim.MD seam | ➕ `eligibility.ts`: `build270`, `parse271` (defensive), stub vendor, staleness (30d) | ✅ | ✅ opens `eligibility` queue when not cleared |
| 4 | Registration ↔ payer discrepancy check | ⛌ | ➕ `detectDiscrepancies` (member id / DOB / name) | — | ✅ |
| 5 | Benefits → patient-responsibility estimate | ⛌ | ➕ `estimatePatientResponsibility` (copay, deductible, coinsurance, OOP cap, contract rate) | "how much should I collect" | ✅ |
| 6 | Financial clearance decision | ⛌ | ➕ `financialClearance` (inactive, mismatch, referral, auth, OON → NSA notice) | — | ✅ |
| 7 | Prior authorization rules (per code / per payer / gold-card) | 🟡 drug rule only | ➕ `prior-auth.ts`: `requiresPriorAuth`, `DEFAULT_AUTH_RULES`, contract lists, gold-card exemptions | "start a prior auth for 72148" | `prior-auth` opens 278s from draft claims |
| 8 | 278 request build + documentation checklist | ⛌ | ➕ `build278`, missing-documentation detection | — | ✅ |
| 9 | Auth lifecycle, CMS-0057-F SLA (72h urgent / 7d), expiry, units | ⛌ | ➕ `transitionAuth`, `slaBreached`, `authCoversService`, `consumeAuthUnit`, `authsExpiringWithin` | — | ✅ escalates SLA breaches, renews expiring auths |
| 10 | Referral tracking | ⛌ | ➕ referral number on claim + clearance check | — | — |
| 11 | Consents / financial responsibility | ✅ `/consent` | — | — | — |
| 12 | Point-of-service collection (card/Zelle) | 🟡 | ➕ collect-at-visit amount from clearance | "collect the 30 dollar copay" | — |
| 13 | Good Faith Estimate (No Surprises Act) | ⛌ | ➕ `goodFaithEstimate` with delivery deadlines (3 / 1 business day rules) + $400 dispute disclaimer | — | — |
| 14 | Financial assistance / sliding fee (FPL) | ⛌ | ➕ `fplPercent`, `slidingFeeDiscount` | — | `patient-financial` routes ≤200% FPL to counseling |

### Mid cycle (visit → coded charges)

| # | Line item | EHR today | This engine | Voice | Agent |
|---|-----------|-----------|-------------|-------|-------|
| 15 | Ambient scribe → note | ✅ Vertex scribe | uses EHR/PHR scribe output as `EncounterFacts` | ✅ ambient | — |
| 16 | Charge capture from the signed note (E/M, procedures, in-office orders, vaccines) | ✅ manual `/rcm/charges` | ➕ `deriveCharges`: auto E/M code, -25 / -95 logic, 90471/90472 units, G2211, charge master w/ reference fallback | ➕ `parseVoiceCharge` ("add 99214 with modifier 25, dx E11 point 9, two units of 90472") | scrub agent picks up drafts |
| 17 | Missing / orphan charge detection, charge lag | ⛌ | ➕ `detectChargeGaps` (missing-charge, orphan-charge, no-em, charge-lag vs 2-day target) | — | opens `charge-review` |
| 18 | E/M leveling (2021 MDM: problems/data/risk; time; prolonged 99417) | 🟡 AI suggestion | ➕ `levelEm` deterministic calculator + rationale; AI is advisory only | "level this visit, 35 minutes established" | — |
| 19 | ICD-10 specificity, laterality, HCC / risk-adjustment capture | 🟡 | ➕ `reviewIcd` (unspecified, needs-laterality, hcc-opportunity from problem list) | — | coding queue |
| 20 | AI coding suggestion + CDI queries (Vertex, strict JSON, canonical codes) | ✅ | ➕ `CODING_SYSTEM_PROMPT`, `parseCodingSuggestion` (drops invalid codes), stub when AI off | — | — |
| 21 | Claim scrubbing (NCCI PTP / MUE, modifiers, POS, demographics, dx pointers, timely filing, auth, duplicates, telehealth) | ✅ 20 rules | ➕ `scrubber.ts`: 25 rules, same ids + `timely-filing`, `auth-missing`, `telehealth-modifier-pos`, `coverage-not-effective`, `duplicate-claim`, `total-mismatch`; clean-claim score; `applyAutoFixes` | — | `claim-scrubber` auto-fixes safe edits, stages clean claims |

### Back end (claim → cash)

| # | Line item | EHR today | This engine | Voice | Agent |
|---|-----------|-----------|-------------|-------|-------|
| 22 | Claim assembly (837P normalized, CMS-1500 box map, coverage auto-fill) | ✅ CMS-1500; auto-fill listed as gap | ➕ `buildClaim`, `claimTo837P`, `claimToCms1500Boxes` (coverage → insured block) | — | — |
| 23 | Corrected (freq 7) / void (8) claims | ⛌ | ➕ `correctedClaim` | — | `denials` agent files with approval |
| 24 | Secondary / COB claims from primary ERA | ⛌ | ➕ `secondaryClaim` (carries primary paid) | — | — |
| 25 | Timely-filing deadline per payer | ⛌ | ➕ on every claim; scrub warns at T-14 | — | follow-up prioritizes |
| 26 | Submission to clearinghouse | ✅ Claim.MD | approval-gated `submit-claim` tool (stub transport) | — | ✅ |
| 27 | Claim status 276/277 lifecycle + category-code mapping | ✅ status query | ➕ state machine (`transitionClaim`, `canTransition`), `mapStatusCategory` (A/P/F codes) | — | `claim-followup` |
| 28 | Stale-claim detection (>30d, T-14 timely filing) | ⛌ | ➕ `claimsNeedingFollowUp` | "open the follow up queue" | ✅ |
| 29 | Payer phone follow-up (IVR script, verification, disposition capture) | ⛌ | ➕ `agents/payer-call.ts`: `buildPayerCallScript`, `applyDisposition` | ✅ voice agent script | `payer-call` |
| 30 | ERA / 835 parse (CLP/SVC/CAS, ACH/CHK, reversals) | ✅ | ➕ `parseEra` w/ X12 element fallbacks, reversal + unapplied cash | — | — |
| 31 | Auto-posting to ledger (payments, CO-45 contractual, PR transfer, denials) | 🟡 explicit | ➕ `postRemittance` → ledger entries + claim status + denial records + balanced check | — | ✅ via `/remittance/post` |
| 32 | Underpayment detection vs contract | ⛌ | ➕ contract expected allowed vs actual; `underpayments` queue | — | ✅ |
| 33 | Denial root cause (CARC/RARC) | ✅ 11 CARCs | ➕ 40 CARCs + 16 RARC hints, category, appealability, prevention-rule ids | "note: …" dictation | `denials` |
| 34 | Denial prioritization + appeal deadline | ⛌ | ➕ `denialPriority` (dollars × remediability × deadline) | — | ✅ |
| 35 | Appeal letters (facts from data; AI polish optional) | ✅ | ➕ `generateAppealLetter` (+ Vertex polish, facts preserved) | "appeal claim …" | approval-gated `send-appeal` |
| 36 | Write-off / bill-patient / corrected-claim decisioning | ⛌ | ➕ `recommendAction` w/ small-balance + cost-to-appeal thresholds | — | approval-gated |
| 37 | Denial prevention analytics (which scrub rule would have caught it) | ⛌ | ➕ `denialTrends.topPreventionRules` | — | — |
| 38 | Patient ledger, FIFO aging, statements (cycle 1/2/3/final) | ✅ | ➕ `computeAccount`, `computeAging`, `buildStatement` | — | `patient-financial` |
| 39 | Propensity-to-pay + channel (text-to-pay / email / paper / call / counseling) | ⛌ | ➕ `propensityToPay` | — | ✅ |
| 40 | Payment plans | ⛌ | ➕ `createPaymentPlan` (min installment, autopay) | "payment plan over six months" | ✅ offers ≥$200 |
| 41 | Collections workflow with holds (plan / dispute / assistance) + agency referral | ⛌ | ➕ `collectionsStage` | — | approval-gated `refer-to-agency` |
| 42 | Credit balances & refunds, small-balance write-off | ⛌ | ➕ `detectCreditBalances`, `smallBalanceWriteOffs` | — | approval-gated `issue-refund` |
| 43 | Payer contracts (fee schedule, % Medicare, modifier & multiple-procedure math) | ⛌ | ➕ `contracts.ts` `expectedAllowed`, `expectedForLines`, `varianceReport` | — | — |
| 44 | Contract modeling (what-if) | ⛌ | ➕ `modelContractChange` | — | — |
| 45 | KPIs w/ targets (Days in A/R, A/R>90, clean claim, first-pass, denial, appeal overturn, net/gross collection, charge lag, patient collection, bad debt, cost to collect) | 🟡 | ➕ `computeKpis`, `agingByPayer`, `payerScorecard` | "what are our days in AR" | orchestrator snapshots + flags critical |
| 46 | Unified work queues w/ SLA + priority (11 queues) | 🟡 charge worklist | ➕ `worklists.ts` | "open the denials queue", "next" | every agent writes to queues |
| 47 | Human-in-the-loop approvals + agent audit trail | ⛌ | ➕ `agents/runtime.ts` approvals, audit (ids/amounts only, no PHI) | — | ✅ |

## 2. Voice layer

- **Input:** existing GCP medical Speech-to-Text (BAA) in the EHR/PHR for encounter and
  dictation audio; browser SpeechRecognition only for short command phrases on the Command Center
  (no PHI persisted). `POST /api/rcm/voice/command` → `parseVoiceIntent` → action + `speak`.
- **Intents:** charge capture (codes, modifiers, units, spoken ICD-10 "E11 point 9"), level
  visit, check eligibility, start prior auth, open queue / next item, denial note, appeal,
  collect copay, payment plan, KPI readout, run agent.
- **Output:** short TTS-safe confirmations (`speakIntent`, `speakKpis`); Google TTS path for prod.
- **Payer calls:** `payer-call` agent prepares IVR path, verification fields, question list and a
  disposition schema; a voice agent (or human) fills the disposition and `applyDisposition`
  moves the claim.

## 3. Agentic layer

| Agent | Trigger | Autonomous | Needs approval |
|-------|---------|-----------|----------------|
| `eligibility` | nightly / pre-visit | 270/271 re-checks, clearance items | — |
| `prior-auth` | nightly / on draft claim | open 278, attach approved auth, SLA escalation | — |
| `claim-scrubber` | on draft | scrub, safe auto-fix (-25, 95, pointer, totals), stage ready | `submit-claim` |
| `claim-followup` | nightly | status check, queue stale claims | — |
| `payer-call` | on follow-up item | call script | — |
| `denials` | on ERA / nightly | triage, appeal draft (+Vertex polish), PR → patient | `file-corrected-claim`, `send-appeal`, `write-off` |
| `patient-financial` | nightly | statements by propensity channel, plan offers, <$5 write-off | `issue-refund`, `refer-to-agency` |
| `rcm-orchestrator` | nightly cron | runs the chain + KPI snapshot | inherits |

Guardrails are in code, not prompts: approval-gated tools, max steps, unknown tools blocked,
audit rows carry only ids/amounts, AI off by default (`RCM_AI_ENABLED=true` turns on Vertex
polish/coding suggestions; the provider is fail-closed and never OpenAI/Anthropic for PHI).

## 4. API surface (`/api/rcm`)

`/health` · `/demo/seed` · `/patients` · `/coverage` · `/eligibility/check` · `/prior-auth[/rules|/:id/transition]` ·
`/charge-master` · `/charges/derive` · `/charges/voice` · `/coding/level|review-icd|suggest` · `/scrub/rules` ·
`/claims[/:id/scrub|transition|837p|corrected|secondary|followup]` · `/remittance[/post]` ·
`/denials[/carc|/analyze/:carc|/:id/appeal|/:id/status]` · `/patients/:id/account|statement|propensity|payment-plan|gfe` ·
`/ledger` · `/credit-balances` · `/contracts[/:payerId/expected|variance|model]` · `/analytics/kpis` ·
`/worklist[/:id]` · `/voice/command` · `/agents[/:name/run|/audit]` · `/approvals[/:id]`

UI: `/rcm` (RCM Command Center — KPIs, queues, denials, approvals, agents, payer scorecard, voice bar).

## 5. Rollout for the outpatient division

1. **Week 1 — port + wire.** Copy `server/rcm` into the EHR API; mount router; replace the stub
   eligibility/clearinghouse vendors with the existing Claim.MD adapters (`checkEligibility`,
   `submitClaim`, `listEra`/`getEra` → `parseEra`).
2. **Week 2 — front desk.** Turn on eligibility agent nightly; show clearance + collect-at-visit on
   the kiosk/check-in; GFE for self-pay.
3. **Week 3 — mid cycle.** Scribe → `deriveCharges`; voice charge bar in the encounter; scrubber
   agent on every signed encounter; coding queue for HCC/CDI queries.
4. **Week 4 — back end.** ERA auto-post; denial agent with approvals; follow-up + payer-call
   scripts; underpayment queue seeded from contracts.
5. **Ongoing.** KPI targets on the dashboard; quarterly NCCI/MUE file refresh into
   `reference-data.ts` shapes; contract modeling before renegotiations.

## 6. Compliance notes

- PHI-bearing AI → Vertex only (existing PHR `ai-provider` and EHR `ai/vertex.ts`).
- No PHI in agent audit rows or logs; voice confirmations never read back identifiers.
- Synthetic data only via `/demo/seed`; vendors stub until BAAs + credentials.
- Not a substitute for coder review: every code/bill change is a suggestion until a human confirms.
