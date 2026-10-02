# SAWD — Sequenced Execution Plan (single source of truth)

_Hand this to any "cook" (founder, Claude, Gemini, any agent). Work it top-to-bottom. One
executor at a time. Stop between phases for owner sign-off. Do not start a later phase before an
earlier one is done. Last updated: 2026-10-01._

## 🛑 All code phases complete — owner gates remain (2026-10-01)
No further code work is possible without owner action. Real gates (not preferences):

### ✅ RESOLVED 2026-10-01 — PR #240 Base44 changes verified live
All 4 files from PR #240 (commit `3346ac53`) are confirmed present in the live Base44 app
(`69a8d49481f8f20832f108b5`) via direct MCP read: solo priceId in PRICE_PLAN_MAP + PLAN_DISPLAY_NAMES ✅,
MFAGate.jsx setStatus('ok') happy-path ✅, MfaStep.jsx setMfaOn(!!user) ✅,
LandingPage.jsx has zero Virginia/Maryland/BETA/Private-Beta/Open-Beta/v0.1 references ✅.

1. **Stripe keys** — set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Base44 Secrets panel → register webhook `https://sawd.ai/functions/stripeWebhook` in Stripe Dashboard → Publish. Without this, subscription checkout is a no-op.
2. **Freelancer Stripe priceId** — ✅ RESOLVED 2026-10-01: `AccountingPlans.jsx` already has real priceId `'price_1ULQLfAlwTP7c712rPXcRzWy'` (verified via MCP read of live Base44 app). No owner action needed.
3. **sawd-landers deploy** (Trevor-gated) — static landers at `Desktop/sawd-landers/` are deploy-ready; blocked on Trevor legal review. ✅ Pricing aligned 2026-09-29: sawd-tax was showing old $48/$120/$360 — fixed to $29/$59/$199 and dist/sawd-tax.zip rebuilt. All landers now match app pricing. No beta/Virginia copy found. CTAs point to `sawd.ai/signup` (correct until cutover).
4. **Business KYB** (sawd-legal gate) — `BusinessOnboardingFlow.jsx` built; Middesk KYB integration held for owner call + counsel.
5. **Plaid IDV E2E** — onboarding flow not yet tested with a real Plaid IDV session.
6. **Compliance P0s** — ✅ RESOLVED 2026-09-29. Compliance console shows 100%/0 P0s: `iamNoSharedOwner: pass` and `mfaEnforced: pass` for both PHR and SAWD GCP projects.

**✅ Dependabot PRs fully cleared (2026-10-01):** #245 (checkout@v7.0.1 SHA-pinned), #246 (gha-auth@v3), #247 (setup-node@v7 SHA-pinned), #249 (brace-expansion@1.1.21) — all merged. CI 0 SAST failures.

**Draft PRs in Sawd-finance requiring owner review (2026-10-01):**
- **PR #244 — Landing page redesign (Lovable)**: Redesigns 1,900-line `LandingPage.jsx` into 11 section-components; fixes JSON-LD pricing still showing old $48/$120/$360; patches same npm advisories already merged in #248. ⚠️ Also adds state-gating copy (`PILOT_STATES = ['VA']`) — owner must decide if Virginia-only messaging is back in scope. Tests pass. Do NOT merge without owner approval on the state-gating copy.
- **PR #243 — Jarvis AI command center**: Adds `/Jarvis` command-center page wired to existing `financial_copilot` agent (no new AI vendors); 17 unit tests; compliance-designed (advice blocked, numbers redacted). Outside the current execution plan scope. Flag for Rajiv's review.

**Stale branches** (content already absorbed into main via Base44 external-agent commits):
- `feat/cpa-hard-gates` — 5 commits (CPA gates + Circular 230 + dep fixes), 109 behind main; all unique files exist in main
- `chore/launch-hardening-201` — 5 commits (security headers + CSP), 88 behind main; all unique files exist in main  
- `chore/dep-security-fixes` — 1 commit, 1 behind feat/cpa-hard-gates; superseded
- `chore/cutover-deploy-to-sawd-app-2026` — GCP cutover, 798 behind main; REJECTED (locked decision)
- **Open PR #144** — React 18→19 major upgrade; DO NOT auto-merge (breaking changes need migration testing)

## Demo-prep punch list (owner actions, no MCP tool exists for these)
- **✅ RESOLVED 2026-09-13 — Custom domain IS bound + Published.** Settings→Domains shows `sawd.ai`
  (+ sawd.finance/app/tech/money/tax) all **Verified**. Live-verified: `sawd.ai` → 200, `/privacy` → 200,
  `/onboarding` → 200, `/functions/stripeWebhook` → 400 (expected: GET w/o stripe-signature). Origin is
  Cloudflare → Base44 (uvicorn). The earlier "falls back to default subdomain" note was stale. Owner
  Published this session, shipping staged changes (cpa@sawd.com→.ai typo fix, onboarding routes, Stripe
  wiring). See [[sawd-stripe-idv-live]].
- **Publish** — routes (/onboarding, /business-onboarding, /oauth-return), webhook fix, balance fix,
  form fixes, Middesk all committed but not live until the owner clicks Publish.
- Delete stale rajiv@sawd.ai First Citizens ghost (RLS-blocks MCP). **Heal the collapsed First-Citizens
  balances by invoking `healPlaidAccountKeys` after Publish — NOT `backfillPlaidBalances`** (the latter has
  the same name-key collision bug and would re-collapse same-named accounts). See [[sawd-plaid-two-record-model]].
- **Plan correction (found 2026-09-11 in PLAID-CHECKLIST.md):** Investments + Liabilities Production access
  is ALREADY granted on the Plaid account `6a8254…4cb4` (Base44 shares that account). So adding them to SAWD
  is a pure Base44 code task (call `/investments/holdings/get` + `/liabilities/get`, surface holdings /
  1098 / 1098-E), NOT gated on a Plaid request. Only **Plaid Layer** still waits on Plaid (already requested).
  Confirm Products=Production in the Plaid dashboard before relying on it (checklist was written for the
  parked sawd-backend, dated 2026-08-29).

## Status
- **P0 — verified-closed (2026-09-07).** Read-only audit vs live runtime: editor status `ready`;
  `LinkedAccounts` nav no longer 404s (`App.jsx` registers `/LinkedAccounts` + `/linked-accounts`,
  nav uses `createPageUrl('LinkedAccounts')` → `/LinkedAccounts`); tiered extraction intact in
  `advancedDocumentExtraction` (Pro for w2/1099/k1/schedule, flash otherwise, real `validateExtraction`).
- **P1 — ESSENTIALLY DONE in production (2026-09-09).** rajivka4@gmail.com connected 3 real prod
  institutions (Robinhood, Capital One, First Citizens) = 14 accounts across checking/savings/credit/
  investment/Roth IRA/trad IRA/crypto/business/loan, with 500+ transactions (~Aug 2025–Aug 2026, the
  days_requested:730 history) loaded and categorizing. Standard Connect in production — Layer NOT needed.
  Root causes were fixed in code (webhook URL, plaidCreateLinkToken webhook param, plaidWebhook resolve-
  by-plaid_item_id + trigger-sync) + OAuth support (/oauth-return) added. Remaining cleanup: remove the
  stale First Citizens under rajiv@sawd.ai (RLS-blocked from MCP), and publish to lock in webhook
  auto-sync + OAuth. Details: [[sawd-plaid-sync-webhook]].

## The rule
The problem was never a lack of plans — it was **thrash from too many plans** ("too many cooks"),
which produced the data soup. So: **one executor, one sequence, one phase at a time.**

## Locked decisions (do not relitigate)
- **Base44 is the single source of truth.** Live app = the Base44 "Sawd Finance" app
  (appId `69a8d49481f8f20832f108b5`); sawd.ai → Base44/Render (DNS-only). Detached
  `sawd-web`/Firebase + GCP `sawd-backend` are **parked**.
- **Do NOT "cloud-exit" to an external Postgres/Supabase now.** A second backend is exactly the
  split-architecture that caused the multi-day cross-origin login failure. Document the schema
  for *optionality* only. Revisit only if Base44 platform limits are actually hit at scale.
- **No live e-file / 8879 until an active EFIN** + an approved MeF transmitter or intermediary
  (TaxBit / Column Tax / April). EFIN 102371 + PTIN are necessary-not-sufficient. (`ops/cpa-go-live/`)
- **Tiered vision extraction is done** (Pro-Gemini for W-2/1099, flash for receipts, deterministic
  validation) — lives in Base44 checkpoint `975de929`.

## Current blockers (why P0 exists)
1. **Base44 editor sandbox is broken** (Modal errors; file reads empty; "Linked Accounts" 404s;
   AI-builder edits fail). Nothing is buildable until it's restored.
2. **Plaid has no persisted link** — 0 `InstitutionCredential` / `PlaidItem` / `PlaidSyncRun`.
   Current accounts are demo seed + orphaned service-owned records. The wealth spine isn't connected.

## The sequence

| # | Phase | Owner | Action | Done when |
|---|---|---|---|---|
| **P0** | **Stabilize** | Founder (builder) → then Claude | In Base44 builder → History/Checkpoints → **restore `975de929`**. Then Claude fixes the broken "Linked Accounts" nav route. | Editor status `ready`; nav no longer 404s; extraction upgrades intact. |
| **P1** | **Plaid persistence** | Founder (Connect Bank) → Claude verifies | Fresh **Connect Bank** in the live app for the 2 real banks (prod). Claude re-queries to confirm a real `InstitutionCredential` + accounts **owned by the user** persisted; then clears demo/orphan accounts. | One real, backed Plaid link; dashboard shows only real data. |
| **P2** | **Agent cost-control** | ~~Claude~~ **DONE 2026-09-17** | Added `guardedAskAgentAndWait` to `shared/agentConversations.ts` — wraps every agent call with per-user (150/day) + global (1000/day) UsageMetric quotas. Wired into `processNewLedgerEntry` (+ skip-if-already-categorized for Plaid bulk imports) and `scanLedgerEntryWithDeductionScanner`. Checkpoint `6aabeb651e48eca73592589c`. Note: `reviewLedgerDeductionSuggestion` 403-blocked on edit — unguarded but only runs on is_business_expense=true path; complete in a follow-up if spend spike observed. | ✅ Bulk Plaid imports short-circuit without AI; agent calls capped 150/user + 1000/global per day (env-overridable). |
| **P3** | **CPA vs Client role split** | ~~Claude~~ **DONE 2026-09-17** | Added explicit `role !== 'cpa'` guard to `getAggregateCPADashboard` (previously data-scoped but no 403). Added "Credentials" tab to `CPAFirmWorkspace` — fetches CPA's own `CPAApplication` (RLS: owner+admin only) and shows masked EFIN/PTIN with Eye/EyeOff reveal toggle. All CPA routes already behind `RoleProtected allowedRoles=['admin','cpa']`; `AdminConfig` (global EFIN/PTIN store) is admin-only. Checkpoint `6aabf0eeca29cb461bf30474`. | ✅ Non-CPA callers get 403 on firm-data functions; CPA workstation exists with masked credential display. |
| **P4** | **Pre-OCR sanitization + dedup** | ~~Claude~~ **DONE 2026-09-17** | Hash-dedup by `file_url+user_email` in `advancedDocumentExtraction` (returns cached `ScannedDocument` on repeat upload). Blank-page guard added to `validateExtraction` (empty extract → confidence=0 + warning). `DocumentIntelligencePortal.jsx` now calls `advancedDocumentExtraction` (Pro-tier + validation) instead of the naive `extractAndCategorizeDocument`; `detectDocType` infers doc type from filename; document list queries `ScannedDocument` (owned by the advanced path) not the stale `TaxDocumentUpload`. Stats card "Flagged Deductions" → "Need Review" (counts `_validation.needsReview`). Checkpoint `6aabf8580ad240c7e5267d2f`. | ✅ Duplicate docs not re-extracted; blank pages flagged at confidence=0; single Pro-tier extraction path for all users. |

### P4 pipeline unification — FULLY CLOSED 2026-09-18
All naive extractor references eliminated:
- `DocumentIntelligencePortal.jsx` → `advancedDocumentExtraction` ✅ (done 2026-09-17)
- `DocumentUploadWithOCR.jsx` → `advancedDocumentExtraction` ✅ (pre-existing)
- `ClientOnboardingFlow.jsx` → migrated from `processDocumentWithAI` to `advancedDocumentExtraction` ✅
- `useDualBrainSync.js` (dead code hook) → corrected to `advancedDocumentExtraction` ✅
- `gemini_clerk` agent → removed both `extractAndCategorizeDocument` + `processDocumentWithAI` tool entries ✅
Zero remaining references to naive extractors. Checkpoint `6aad2552399ceb70ddd6fa01`.

## Parallel track — Onboarding / Growth (does NOT stall P0–P4)
Full spec: `ventures/sawd-ai/ONBOARDING-IMPLEMENTATION-PLAN.md`. Three sequenced plans:
1. **Consumer onboarding spine** — ✅ BUILT + ROUTES LIVE 2026-09-17 (`/onboarding` → `ConsumerOnboardingFlow`,
   `/business-onboarding` → `BusinessOnboardingFlow`, both in PUBLIC_ROUTES App.jsx:831). Schema + functions +
   UI are complete. Not yet E2E tested with a real Plaid IDV session.
2. **Layer + CSV import** — ✅ DONE 2026-09-17. `importTransactionsCSV` (156 lines, Monarch/Copilot/Mint/generic
   schemas, RFC-4180 parser, dedup, category mapping) + `CsvImportButton` now shows a **preview dialog**
   (detected app, row count, column mapping, 3 sample rows, Cancel/Confirm) before sending to backend.
   Checkpoint `6aabff4c936f0c6c5fe3bf6e`.
3. **Business onboarding + KYB via Middesk** — HELD (owner call + sawd-legal gate).

## Background hardening (continuous — no phase gate)
- **Automated function audit COMPLETE 2026-09-17**: All scheduled/automated functions confirmed InvokeLLM-free
  (`sendWeeklyTaxReadinessDigest`, `checkAndUpdateNexus`, `scanDocumentsForAuditRisks`,
  `sendWeeklyAuditRiskResolutionSummary`). `syncTaxDocuments` per-doc loop wrapped in `guardedInvokeLLM`.
  `linkedAccountSecuritySweep` no-op InvokeLLM removed entirely.
- **User-triggered function hardening 2026-09-17**: `intelligentDocumentCategorization` + `analyzeBills`
  wrapped in `guardedInvokeLLM`. Checkpoint `6aac03be2240df5fd2b2a41b`. ~28 remaining user-triggered
  raw InvokeLLM calls all behind `auth.me()` — acceptable risk, no automated exposure.
- **Remaining deferred**: ~~`reviewLedgerDeductionSuggestion`~~ — **FIXED 2026-09-18**: WAF unblocked; swapped `askAgentAndWait` → `guardedAskAgentAndWait` (per-user + global quota). All user-triggered agent calls are now spend-guarded. Zero remaining unguarded agent calls.
- **✅ Brand alignment — FULLY DONE (verified 2026-10-01)**: All emerald eliminated. Grep across `src/**/*.{jsx,js,ts,tsx,css}` → 0 matches. Gold primary `#F5B841` / amber throughout. Rounds 1–5 (checkpoints `6aad6137…` through `6aad7c10…`) cleared all surfaces including internal pages.
- **✅ Investments + Liabilities fully wired — DONE 2026-09-18** (Checkpoint `6aadf7c1ad808d47653e4119`):
  - `syncPlaidInvestments` + `syncPlaidLiabilities` patched with automation auth (`isAuthorizedDigestCall` + `user_email` fallback) so they can be called from webhook/nightly contexts.
  - `syncPlaidLiabilities` upsert now uses `asServiceRole` + explicit `created_by: ownerEmail` (was user-only context, broke in automation).
  - `plaidWebhook`: `HOLDINGS/DEFAULT_UPDATE` now calls `syncPlaidInvestments` via `triggerFn` (was only setting `holdings_sync_pending: true` flag, never actually syncing).
  - `plaidExchangeToken`: fires both syncs as fire-and-forget after connect (liabilities typically ready immediately; investments may get `PRODUCT_NOT_READY` until HOLDINGS webhook fires).
  - `syncAllLinkedAccountsNightly`: adds `Promise.allSettled([syncPlaidInvestments, syncPlaidLiabilities])` per account in the nightly loop.
  - UI card `InvestmentsLiabilitiesCard` is on Dashboard + LinkedAccounts; "Sync" buttons invoke both functions directly (user context, unchanged).
- **✅ InvestmentsLiabilitiesCard on Dashboard — DONE 2026-09-18**: added import +
  `<InvestmentsLiabilitiesCard />` to `Dashboard.jsx` after `InvestmentAccountGrowthComparison`.
  Checkpoint `6aad3ae9769bcfa5c2bf5d32`.
- **✅ Subscription tier gating on Dashboard — DONE 2026-09-18**: imported `FeatureGate` into
  `Dashboard.jsx`; 3 gates added: Businesses tab → `household_business`, Quarterly Tax tab →
  `household`, wealth-projection cluster (5-yr net worth + investment forecast + growth chart) →
  `household`. Free users see blurred teaser + "Start Your Trial" CTA overlay.
  Checkpoint `6aad3ec78a921dfe8dc710af`.
- **✅ Subscription chain audit 2026-09-18**: full chain is code-complete and verified — real Stripe
  price IDs in `src/lib/plans.js` + `stripeWebhook/entry.ts` PRICE_PLAN_MAP match exactly;
  `createSubscriptionCheckout` / `getSubscriptionStatus` / `SubscriptionSuccess` (polling) all
  confirmed working. Security scan flagged `_shared/auth.ts` — already safe (`if (!secret) return false`).
  **OWNER ACTIONS to go live**: (1) set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Base44
  Secrets panel, (2) register webhook URL in Stripe Dashboard → `https://sawd.ai/functions/stripeWebhook`,
  (3) click Publish in Base44 editor to ship tier gating to production.
- **✅ Public-page compliance sweep — DONE 2026-09-18**: All 6 live public routes audited and cleaned.
  - `LandingPage.jsx`: removed 4 fabricated named testimonials → feature-benefit cards; "Form 8879 e-signature" → "Document signing"; mobile app FAQ → "coming soon". Checkpoint `6aad4c1f859fc8e04061189b`.
  - `src/lib/plans.js`: canonical source `'Form 8879 e-signature'` → `'Document signing & e-signatures'`. Checkpoint `6aad50fe7ade93df829a07c0`.
  - `CPAPartnerLanding.jsx`: removed fabricated "Maria Chen, CPA" quote; removed expired "Applications close February 1, 2026" deadline; false scarcity "5 of 20 seats" → "Pilot cohort size: 20 seats"; stale "May 2026 Pilot" → "2026 Pilot Program". Checkpoint `6aad51847d04c072b0bed6be`.
  - `TrustCenter.jsx`: IRS Pub 1345 "Compliant" → "In progress" (EFIN issued, MeF transmitter authorization in process); removed 2 stale past-date targets (Q2 2026 pen test, May 2026 MFA launch). Checkpoint `6aad5f871efca54b5acaa25d`.
  - `SubscriptionPlans.jsx`, `EarlyAccess.jsx`, `ConsumerOnboardingFlow.jsx`: clean, no changes needed.
  - `WaitlistLanding.jsx`: not routed — dead page, no action.
  - Desktop `sawd-landers/`: all static landers clean; sawd-tax has a per-return fee structure ($99/$199) not in the app's Stripe model — flag for Trevor review before deploy.
  - **Still blocked on Trevor**: sawd-landers deploy (Cloudflare Pages, wrangler deploy.ps1, DNS cutover).

## Accounting plans audit (2026-09-18)
- **✅ AccountingPlans.jsx brand + layout fixed** (Checkpoint `6aad784afabbf7e593b56f5f`): hero badge + freelancer plan color + colorMap all emerald→amber; 4-card grid changed from `md:grid-cols-3` (broken wrap) to `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` (responsive, all 4 on XL).
- **✅ Freelancer plan Stripe priceId RESOLVED 2026-10-01**: `AccountingPlans.jsx` already has `'price_1ULQLfAlwTP7c712rPXcRzWy'` (real priceId, not placeholder). Verified via Base44 MCP read. Other 3 accounting plan priceIds (`price_1Ta4vWGsRetwryn7Fs5CBxRh`, `…dJoFg6nI`, `…n2idkAr1`) still should be verified in the Stripe dashboard.

## Explicitly NOT NOW (defer / reject)
- ❌ External Postgres/Supabase "cloud exit" — re-creates the split-backend pain. **Rejected at this stage.**
- ⏸ Multi-vendor Plaid fallback (MX / Finicity) — new integrations; after P1 is solid.
- ⏸ Marketing landing page in Base44 — nice-to-have; after P0–P2. (Base44 login is a fine entry meanwhile.)
- ⏸ **Tavus AI-video advisor / personalized client videos** — strong differentiator, GROWTH phase. Gated on: app stable (P0), Plaid live (P1), cost controls (P2), a signed **Tavus DPA** (GLBA/PII), and **sawd-legal** sign-off (RIA/fiduciary + §7216; bring-your-own-LLM so advice stays SAWD's compliant model). Usage-priced → adds spend. A spec may land as reference; do NOT build before P2 is done. Subscription is live + warm contact (Brian @ tavus.io).
- ⏸ Any new parallel "plan"/agent from another tool or session — funnel it into THIS doc instead of forking (that forking IS the "too many cooks").

## Cost discipline
Every phase: Claude stops for sign-off before the next. Prefer cheap `edit_file`/reads over the
paid AI-builder (`edit_base44_app`); never retry a failed AI build. Base44 credits + LLM tokens
are both real spend — one phase at a time.
