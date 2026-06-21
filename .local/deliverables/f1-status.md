# F1 Encryption Program — Status Snapshot

**As of:** Session 5 (comprehensive-care-plan-routes.ts) shipped.
Prior milestones: Session 3 (medication-management-routes.ts) closed +
reconciliation accepted + Session 4 (legal-page scaffolding) shipped +
DOMPurify install + LegalDocument html-prop support.

**Metric tracking — new (effective Session 3 close):**
Project-wide F1 grep aggregate is **deprecated** as a program metric
because no canonical counter exists and naive grep variants don't
reproduce the historical "172" figure. Replaced with:
1. **Per-session in-file delta** — every session reports
   `<file>: <pre> → <post>` for each touched file.
2. **Cumulative resolved count** — running sum of per-session deltas
   (see Sessions completed table below).
3. **Files-remaining queue** — maintained in
   `.local/deliverables/f1-action-items.md` triage section + the
   "Recommended next session" block below.
4. **Canonical session-close measurement** — at the end of each
   session that touches F1 work, run
   `npx eslint 'server/**/*.ts' 2>&1 | grep -c "F1"` and record the
   number. Don't try to reconcile against earlier numbers; record what
   ESLint reports now and compare to the next session's number.
   *(Note: only meaningful once the project has an ESLint rule that
   tags F1 violations specifically. If no such rule exists yet, record
   "ESLint F1 rule not configured — skip" and lean on per-session
   deltas.)*

**Cumulative resolved (verified per-file):**
- Phase 1 bundle: 7 (4 small files)
- Dedup engine (Session 2b.5): 25
- Session 3 (medication-management-routes.ts): 29
- Session 5 (comprehensive-care-plan-routes.ts): 41
- **Total verified: 102 violations resolved across documented sessions**

**Session 5 details (2026-04-18):**
- File: `server/comprehensive-care-plan-routes.ts` (982 lines, 12 PHI tables)
- In-file F1: **41 → 0** verified by `grep -E '\bdb\.(select|insert|update|delete)\b'`
- Pattern: `db.` → `phiDb.`, inserts wrapped with `encryptPhiRow(<tableVarName>, ...)`,
  reads decrypted with `decryptPhiRow` / `decryptPhiRows`, joined sub-records
  decrypted per-table.
- In-memory plaintext filter applied to status/category predicates on
  `comprehensiveCarePlansTable` (Action Item I extension pattern from Session 3).
- Unused `db` import removed at session close.
- Pre-flight false-alarm caught and corrected: initial PHI map check used
  snake_case SQL names; all 12 tables present under camelCase variable-name
  keys. **Lesson:** PHI map keys are JS variable names (e.g. `vitalSignsTable`),
  not SQL table names (`vital_signs`). Pre-flight grep updated to use the right
  convention going forward.
- Build healthy post-edit: workflow restarts clean, both routes return 401
  (auth-gated, expected) at `/api/comprehensive-care-plans/*`.
- Out of scope for this session: `logHipaaAudit` console.log → structured
  pino conversion (left as-is; tracked separately if Action Item K extension
  needed).

**Session 5 close — additional follow-ups (2026-04-18):**
- ✅ 7th legal page `/legal/care-access-privacy` scaffolded; smoke-test
  panel expanded 7 → 8 steps; all 7 legal routes return 200.
- ✅ Methodology note "PHI map keys are camelCase JS variable names"
  appended to `object-form-conversion-template.md` (pre-flight checklist
  + Session 5 false-alarm record).
- ✅ Action Item K extension filed (helper-wrapper internal logging:
  `logHipaaAudit` and similar wrappers bypass pino redaction even after
  K-clean grep). First instance: `comprehensive-care-plan-routes.ts`.
- ✅ Action Item O filed AND resolved same session: full GA audit
  confirmed zero tracker firing on any route. Latent risk
  `client/src/lib/firebase.ts` (hardcoded GA4 measurementId
  `G-P6SGG069J5`, dormant but ambush-shaped) deleted per Option A.
  Post-delete client-side sweep returns zero hits; build succeeds; all
  7 legal routes still 200. FTC-fine-level GoodRx-pattern risk
  eliminated.
- ✅ **Resolved (Session 6 follow-up):** `server/services/firebase.ts`
  deleted (also Option A — dormant Firestore wrapper with same dormant
  `firebase/analytics` import). Stale **"Firebase: Client and
  server-side SDKs"** line removed from `replit.md` External
  Dependencies section. Post-cleanup grep across `server/` + `client/`
  for `firebase` returns zero source hits. Build clean, all 7 legal
  routes 200. **User to-do (cannot be agent-executed per skill rules):**
  `npm uninstall firebase` to remove the now-unused npm dependency.
  Correction recorded: `server/services/firebase.ts` was a Firestore
  wrapper, NOT FCM messaging as previously characterized.
- 🔴 **Action Item P filed (PRE-TESTFLIGHT BLOCKER):** the Firebase
  audit also surfaced that `server/appointment-reminders.ts::sendPushNotification`
  is a `console.log` stub. No FCM/APN/Expo/OneSignal/web-push wiring
  exists anywhere. Medication reminders, appointment reminders, care
  gap alerts all silently fail at the delivery hop. User must decide
  push provider before next push-implementation session; reviewer
  recommendation: Capacitor Local Notifications for Phase 1.

**Purpose:** one-screen "where are we" for any future session opener.
**Refresh cadence:** end of every session that touches F1 work or files
new action items.

---

## Session Start Protocol (MANDATORY — read first, every session)

Before touching any code, the agent must:

1. **Read this status doc fully.** Top to bottom. Including this section.
2. **Check for recent reviewer/user directives in chat context** if available.
3. **Report proposed next action with explicit source attribution:**
   > "Proposed next: X. Source: [scratchpad / chat directive / default queue].
   > Expected outcome: Y. Is this target still correct?"
4. **Wait for explicit user/reviewer confirmation before proceeding.**

If chat context is unavailable at session start (normal operating
condition when the agent's window starts fresh), default to whatever
this doc indicates as "recommended next step" — but **explicitly flag**
in the proposed action: *"operating from scratchpad, chat context not
available — please verify alignment."*

**Hard rule — production-state-change pause:** any session-resume
that involves a *production-state change* pauses for explicit
go-ahead, **regardless of what the scratchpad says**. The scratchpad
records the prior session's last state, not the current directive.

Production-state changes include:
- **Schema migrations** — `ALTER TABLE`, `CREATE TABLE`, `DROP`, any DDL
- **Secret value changes** — Replit Secrets, GCP Secret Manager
- **Environment variable changes**
- **Deploy-related edits** — workflow config, deployment manifests, build scripts
- **Package lockfile modifications** — `package-lock.json`, `pnpm-lock.yaml`, etc.
- **Anything non-trivial to roll back**

**Exempt (proceed on scratchpad + protocol check alone, no extra
confirmation needed):** rollback-safe code edits — wrapping calls,
converting loggers (string-form → object-form), in-file refactors,
adding tests, documentation updates inside `.local/`.

**Rationale:** Session 2c was shipped out of sequence on 2026-04-18
because the agent resumed from scratchpad state ("Session 2c in progress,
db:push interrupted") without verifying current directive. The reviewer
had queued `medication-management-routes.ts` for that slot in chat
context the agent never saw. Outcome was retroactively safe (empty
table, additive column, 60/60 tests green) but the process violation
was real. This protocol prevents repeat.

### Mid-session clarification (added Session 6, 2026-04-18)

When a user sends a single-word or ambiguous response (e.g., `"ya"`,
`"ok"`, `"sure"`, `"go"`), **confirm interpretation before acting on
anything irreversible or that changes repo state.** A 2-second
*"Interpreting this as approval for X — proceeding unless you say
otherwise"* beats a retrospective attribution question after the fact.

**When this matters:** package install/uninstall, file deletion,
schema changes, secret writes, deploys, anything outside the
"rollback-safe code edits" exempt list above.

**When it does NOT matter (proceed without re-confirming):** clearly-
directive responses such as `"approved"`, `"proceed with option A"`,
`"ship it"`, `"yes, do the cleanup as described"` — anything that
restates the action being authorized.

**Heuristic:** if the prior agent message ended with a multi-option
offer (*"Want me to do X? I can also do Y. Or skip both."*), a bare
`"ya"` is genuinely ambiguous and needs disambiguation before acting.
If the prior agent message ended with a single-option offer (*"Want
me to run the uninstall?"*), `"ya"` is unambiguous and proceeds.

**Rationale:** Session 6 Firebase uninstall episode (2026-04-18). Agent
offered to run `npm uninstall firebase`, user replied `"ya"`, agent
proceeded via `uninstallLanguagePackages` (sanctioned tool path).
Reviewer correctly flagged that the `"ya"` could have referenced
cross-thread context. Three-layer verification confirmed the action
was correct AND authorized, but a 2-second pre-action confirmation
would have eliminated the doubt entirely. Non-blocking discipline
addendum, not a violation.

### Codebase topology clarification (April 20, 2026)

Filed during reality-reconciliation directive following the unified
architecture planning session. Resolves ambiguity surfaced by that
session's pre-flight recon. Authoritative for all future planning,
session-start orientation, and cross-document references.

| Component | Status in THIS Replit project | Notes |
|---|---|---|
| **Tabula Medica Replit project** | ✅ THIS PROJECT | HIPAA Covered Entity. The patient-centric health-record PWA. Tabula Medica LLC. |
| **Uninsurance Replit project** | ❌ NOT THIS PROJECT — separate Replit project | DMPO-registered entity (Virginia). Separate Replit project, separate deployment, separate Stripe merchant account, separate App Store listing. Cousins of Tabula Medica per `unified-architecture-plan.md` §11. |
| **Care Access microservice** | 🟡 PLANNED, not yet built | Phase 1 of `unified-architecture-plan.md` §7 is the build (sub-phases 1.1 / 1.2 / 1.3, ~8-11 sessions). Currently only `CARE_BRIDGE_SECRET` env var + `client/src/pages/care-index.tsx` UI stub exist as scaffolding. No `server/care-access/` directory exists. |
| **`tabula-medica-mobile/`** | ✅ Capacitor wrapper subdirectory WITHIN this project | NOT a separate repo. Per Mobile Strategy section of `replit.md`: "Native shell: Capacitor (not Expo). Web repo is the trunk; Capacitor wraps for iOS/Android." Some Uninsurance-product files (`UninsuranceScreen.tsx`, `optumEdi.service.ts`, `medicareRates.service.ts`, `goodFaithEstimate.service.ts`, `uninsuredIdentityVault.service.ts`, `hrsa.service.ts`) currently sit here as legacy from earlier scoping; planned migration is to the separate Uninsurance Replit project (no timeline committed). |

**Why this clarification matters:** session-start orientation in
prior sessions occasionally treated Care Access as deployed
infrastructure and `tabula-medica-mobile/` as a separate repo. Both
are misreads. The unified-architecture planning session formalized
the corrections; this entry pins them in the canonical status doc so
the next session that asks "where is X" gets the right answer
without re-discovery.

**Cross-references:**
- `unified-architecture-plan.md` §8.1 — resolved Open Question on
  Care Access status.
- `unified-architecture-plan.md` §7 Phase 1.1/1.2/1.3 — concrete
  build-the-bridge breakdown.
- `replit.md` — pending update to add Care Access "planned, not
  deployed" note + Uninsurance separate-project note (separate
  reconciliation task).

---

## Sessions completed

| Session | Scope | Outcome |
|---|---|---|
| 1 (incl. follow-ups) | 51 mechanical `console.log → logger.info` conversions across 3 files | Done — but went in as string-form (Action Item K covers re-fix) |
| 2a | 85 logger conversions to object-form | Done |
| 2b steps 1–4 | PHR phiDb migration + `noStorePhi` middleware + 14 ciphertext fixtures | Done |
| 2b.5 | Dedup engine 25 F1 → 0; tests 14 → 20 (added forensic snapshot fixtures #15–#20); `phiDb` vs `db` discipline doc; CDN breadcrumb in `noStorePhi` | Done |
| 2b.5 audit cycle | 5 audit deliverables filed (key mgmt, triage, action items J+K+L+M, physician one-pagers stub) | Done |
| Phase 1 bundle | F-2 fix + 7 F1 violations across 4 small files (routes.ts region routes ×3, personalized-education-routes.ts ×2, enhanced-provider-analytics-service.ts ×1, hipaa-compliance-service.ts audit insert ×1) + Action Item K partial (9 stale loggers in hipaa-compliance-service.ts) | Done — boot verified, `/api/region-features` 200, no TS errors |
| 2c (audit-log scrubbing) | (a) `userName` encryption at hipaaAuditLogsTable writer; (b) `accessReason` split into plaintext HIPAA enum + encrypted `accessReasonDetail` (schema + insertSchema + AuditLogEntry interface + writer); (c) `audit-action-validator.ts` with PHI denylist (email/zip+4/SSN/phone/2×DOB/MRN/two-token name/oversize/non-string), wired into hipaa-compliance writer with WARN-and-skip + throwing variant `assertSafeAuditAction`; (d) `fhirApiAuditLogs.metadata` jsonb confirmed in PHI map + fixture; (e) ciphertext fixtures 20 → 23 (+ 14 validator unit tests) | Done — `ALTER TABLE hipaa_audit_logs ADD COLUMN access_reason_detail` applied directly (drizzle-kit prompt unbypassable → filed as Action Item N); reviewer-verified PHI-safe (hipaa_audit_logs=0, profiles=0, accounts=0, patient_identity=3 seed); 60/60 tests pass; boot verified, `/api/region-features` 200; **accepted as shipped** by reviewer post-PHI-verification |
| 3 (medication-management-routes.ts) | Wrap all 5 PHI tables (`medicationsTable`, `medicationRemindersTable`, `medicationAdherenceLogsTable`, `medicationInteractionFlagsTable`, `providerMedicationActionsTable`) with `phiDb` + `encryptPhiRow` on writes + `decryptPhiRow`/`decryptPhiRows` on reads; convert all string-form `logger.*("[bracket-msg]:", err)` calls to object-form `logger.*({ component, err }, "msg")`; refactor `INTERACTION_CHECK` existence-check from `eq(.medication1Name, ...)` SQL predicate (would have triggered Action Item I) to in-memory plaintext filter on decrypted rows (documented inline) | Done — in-file F1 **29 → 0** verified; in-file string-loggers **18 → 0** verified, post-edit final-state grep returns 0 hits; INTERACTION_CHECK refactor accepted as **Action Item I scope extension** (now documented in `f1-action-items.md`); reconciliation items 1–3 closed (project-wide aggregate deprecated; per-file delta + cumulative is the new metric) |
| 4 (legal-page scaffolding) | Build `/legal/{privacy,terms,cookie,disclaimer,accessibility,hipaa-notice}` routes so the existing `LegalFooter` (which already points at `/legal/*`) resolves instead of 404'ing. Single `LegalDocument` wrapper component (breadcrumb + title + last-updated header + `prose` body) + single `LegalPage` content component dispatched on a `slug` prop. 6 routes wired into `App.tsx`. Placeholder body shows "content pending legal review" alert + plaintext "Content will be published here after legal review" + `mailto:privacy@tabulamedica.health` contact. Smoke test panel gets new "Legal pages" required section (7 steps: 6 URL checks + 1 footer-resolves check). Reviewer walkthrough updated with the 6 URLs and a note explaining placeholder bodies. | Done — `LegalFooter` links no longer 404; pages each render title + breadcrumb + placeholder body. **Content insertion (paste cleaned Termly text into `LEGAL_PLACEHOLDERS` map) is a follow-up session, ~10 min/page once Termly export lands.** |

**Reconciliation items 1–3 (closed at Session 3 close):**
1. ✅ **Project-wide F1 count deprecated** as program metric — see
   "Metric tracking — new" section above. File-by-file completion is
   the program metric; aggregate is not tracked.
2. ✅ **Action Item K final-state grep on
   medication-management-routes.ts:** ran
   `grep -nE 'logger\.(info|warn|error|debug)\s*\(\s*["` + "`" + `\x27]'`
   against the file post-edit → **0 hits**. File is K-complete.
   The "18 vs 19" spec discrepancy resolves on actual current state:
   no string-form loggers remain in the file. K marked complete for
   this file (see Action Items table).
3. ✅ **Action Item I scope extension filed** in
   `f1-action-items.md` documenting the
   `eq(encryptedColumn, value)` existence-check refactor pattern,
   with first documented instance pointing to
   `medication-management-routes.ts::INTERACTION_CHECK` (Session 3).

**Recommended next session:** `comprehensive-care-plan-routes.ts`
(highest-hit remaining file at ~41 violations per naive grep) — one
session if pre-flight grep is clean of Action Item I triggers.
Other files in queue (per naive grep, descending):
`services/patient-engagement-service.ts` (~30),
`health-tracking-routes.ts` (~28),
`provider-population-management-routes.ts` (~20),
`patient-reported-outcomes-routes.ts` (~16).

- **Do NOT auto-start.** Per Session Start Protocol above, wait for
  explicit "start next session" directive.

**Sessions pending:** Phase 1 / 2 / 3 / 4 of F1 mechanical migration,
Action Item L (key ring), Action Item I (search audit, runs concurrent
with Phase 2), Action Item N (drizzle-kit drift, before next schema
session). Estimate: **8–9 future sessions to F1 = 0 + key rotation
infra ready**, plus 1 user-side session for Action Item M (escrow).

---

## F1 violation count (the headline metric)

**172 ESLint F1 violations remaining**, across 8 files, post-Phase-1.

| Top files | Count |
|---|---:|
| `comprehensive-care-plan-routes.ts` | 41 |
| `medication-management-routes.ts` | 29 |
| `health-tracking-routes.ts` | 28 |
| `provider-population-management-routes.ts` | 20 |
| `patient-engagement-service.ts` | 18 |
| `database-dedup-service.ts` | 16 |
| `patient-reported-outcomes-routes.ts` | 16 |
| `patient-engagement-hub-routes.ts` | 4 |

Full per-file breakdown + phase plan in
`f1-remaining-violations-triage.md`.

---

## Action items filed (index)

| ID | Title | Status | Owner | Sequencing |
|---|---|---|---|---|
| H | Plaintext → ciphertext backfill | PENDING | agent | After Phase 4 + I + L |
| I | Encryption-search compatibility audit | PENDING | agent | Concurrent with Phase 2 |
| J | Ciphertext-at-rest fixtures 20 → 40 (now 23/40 after Session 2c) | PARTIAL — 23/40 | agent | Foldable into Phases 1–4 |
| K | Stale string-form logger cleanup. Tracked per-file (no longer fraction-of-historical-count): hipaa-compliance-service.ts ✅ (9 converted, file grep-clean); medication-management-routes.ts ✅ (18 converted, post-edit grep returns 0 hits). Future files swept on each F1 migration session. | PARTIAL — per-file: 2 files complete | agent | Bundled with each file's F1 migration |
| L | Versioned ciphertext envelope + key ring + F-9 hash key separation | PENDING | agent | After 2c, before H. ~1.5 sessions + 30–60 min for hash-column rebuild |
| M | Key escrow + recovery runbook | PENDING | **USER** | Before first real-patient signup |
| N | Reconcile drizzle-kit schema drift (rename-detection prompt unbypassable) | PENDING | agent | Before next schema-changing session (i.e. before L) |
| O | Google Analytics placement audit | ✅ RESOLVED (Session 6) | agent | client + server firebase.ts deleted, replit.md cleaned, `npm uninstall firebase` executed, build clean |
| P | Push notification delivery implementation | PENDING | USER (provider decision) → agent (wiring) | 🔴 **PRE-TESTFLIGHT BLOCKER** — implement OR remove push claims from reviewer walkthrough before submission |
| Q | AI opt-out feature implementation | PENDING | agent | 🟡 POST-TESTFLIGHT 60-day window — Privacy Policy promises opt-out; mechanism not yet built. Sequence after N (schema), before real-patient count exceeds ~100 |
| R | Cookie consent banner + preference center + CCPA "Do Not Sell" link | PENDING | agent | 🟡 POST-TESTFLIGHT — must precede any analytics re-introduction (O cadence), EU marketing, or ~1,000 active users (VCDPA threshold). Today's exposure low (zero non-essential cookies), but R is the structural gate that prevents O-class regressions long-term. Pair with Q in same UI (preference center hosts AI toggle too). |
| S | CI pipeline scaffold (`.github/workflows/ci.yml` — typecheck/lint/build on push+PR to main) | ✅ RESOLVED (Session 6, leverage Item 1) | agent | Closes typecheck/build/lint blind spot for direct-to-main commits. Lint job is conditional + soft-fail (`continue-on-error: true`) until user adds `"lint": "eslint ."` script. Future flip to hard-fail tied to T trigger. |
| T | Logger rule severity upgrade (`tabula/no-string-form-logger`: warn → error) | ✅ SHIPPED AS WARN (Session 6, leverage Item 2) | agent | Custom ESLint plugin in `eslint-rules/no-string-form-logger.js`, registered as `tabula/no-string-form-logger` at `warn`. AST detection of `logger.<level>(\`tmpl ${expr}\`)` and `logger.<level>("a"+b)` patterns. Verified: 0 false positives on migrated file, 3 correct hits on `tls-middleware.ts`. Upgrade to `error` requires (a) zero hits server-wide, (b) V resolved, (c) K direct-call grep returns 0. |
| U | Accessibility remediation (post-audit) | PENDING | agent | 🟡 PARTIAL TESTFLIGHT BLOCKER — Findings 1 (button tap targets fail iOS 44pt) + 4 (`prefers-reduced-transparency` not honored) before TestFlight (~3.5hr); Findings 2/3/5 + 3 un-deep-read routes pre-public-launch (~5hr more); long-tail post-launch (~6hr) gated on Auth0 reviewer-test account for runtime axe scan. Audit doc: `accessibility-audit-session-6.md`. |
| V | Vitest test runner health check + CI test integration | PENDING | agent | 🟡 NEXT-SESSION (≤2hr timebox) — smoke run fails at vite module-runner startup; runner needs investigation before adding test job to CI. Hard prerequisite for T's warn→error flip. |
| W | Extend security-gate coverage to direct-to-main commits | PENDING | agent | 🟡 BEFORE PUBLIC LAUNCH (30–60min) — `pr-security-check.yml` (SOC2/SAST/Trivy/TruffleHog) currently PR-only. Saturday cadence pushes directly to main, bypassing security gates. Either extend triggers in-place or create `security-on-push.yml` companion. Not TestFlight-blocking; is App-Store-blocking. |
| X | LegalDocument component production styling | DEFERRED | agent | 🟡 WAITING ON DEPENDENCY (Termly content delivery) — bundles INTO legal-page content-paste session as ~30–60 min styling on top of content paste. Brand color `#0D9488` teal, system-ui stack, WCAG AA contrast, print-friendly CSS, 375px iPhone SE support. Not a standalone session. |
| F-2 | Add `PHI_ENCRYPTION_SALT_V2` to `MANAGED_SECRETS` | DONE (Phase 1) | agent | Landed in `gcp-secret-manager.ts` |

Detail in `f1-action-items.md`. Audit findings backing L and M are in
`key-management-audit.md`.

---

## Test posture

- **Test fixtures:** 20/40 Tier-1 PHI tables covered by ciphertext-at-rest
  round-trip fixtures in `tests/phi-storage.spec.ts`.
- **Test status:** all 20 passing as of 2b.5.
- **Gap to HIPAA-audit-ready:** 20 more fixtures needed (Action Item J).
- **Gap to TestFlight-ready:** none — fixture coverage is auditor
  evidence, not user-facing functionality.

---

## Hard blockers — TestFlight submission

(Things that must be true before the iOS app can be submitted to Apple
review for TestFlight.)

| Blocker | Owner | Status |
|---|---|---|
| Termly policy clean export → legal pages live | USER → agent | User-side: pending Section 12 fix + blanks. Agent-side: 1–2 sessions to build pages once text arrives |
| Auth0 reviewer account credentials for Apple reviewer to log in | USER | Pending |
| `accounts` table repopulation — reviewer account exists in DB | USER | Pending — table currently 0 rows (lost or in-memory only). Re-run `npm run seed:reviewer-account` AND confirm Auth0 dashboard has the matching reviewer identity. Not blocking today; **hard blocker on submission day**. |
| App Store Connect listing finalized | USER | Drafts exist; final pass pending |
| Auth0 BAA executed (HIPAA covered-entity requirement) | USER | Pending — start the email; 2–3 week clock |
| **Push notification implementation (Action Item P)** | USER (provider decision) → agent (wiring) | **Pending — push delivery is currently a `console.log` stub in `server/appointment-reminders.ts::sendPushNotification` and `sendSms`. Must be wired (Capacitor Local Notifications recommended for Phase 1) OR all push-notification claims must be removed from the reviewer walkthrough before TestFlight submission. Either implement or don't promise — Apple reviewer will test it.** See Action Item P. |

F1 work is **NOT** a TestFlight blocker. TestFlight reviewers do not
inspect database ciphertext at rest.

---

## Hard blockers — first real patient signup

(Things that must be true before a non-test-account real patient is
permitted to create an account that will hold their actual PHI.)

| Blocker | Owner | Status |
|---|---|---|
| Action Item M — key escrow + recovery runbook | USER | Pending; cannot be delegated |
| Action Item L — key versioning so rotation is possible if key leaks | agent | Pending; ~1.5 sessions |
| Action Item H — backfill any pre-encryption plaintext rows | agent | Pending; gated on I + L |
| Action Item I — eliminate silent-search-fail risk before H runs | agent | Pending; concurrent with Phase 2 |
| F1 = 0 (every PHI write goes through `phiDb` + `encryptPhiRow`) | agent | 179 → 0 over 7–8 sessions |
| Auth0 BAA executed | USER | Pending |
| Neon plan supports multi-role (separation of audit-writer from app role) | USER | Pending — 4 min check |
| Neon production database confirmed empty of real PHI before encryption flips | USER | Pending — 4 min check |
| Seed baseline reset — clean dev DB before first real signup | USER | Pending — current dev DB has 3 orphaned `patient_identity` rows (Feb 3 batch, no spot-checkable identifiers). Truncate the affected PHI tables and re-run `npm run seed:reviewer-account` to produce a deterministic clean baseline so the first real patient row is unambiguously identifiable. |

---

## Non-F1 program health

- **GCP Secret Manager:** wired (`server/services/gcp-secret-manager.ts`);
  `PHI_ENCRYPTION_SALT_V2` now in `MANAGED_SECRETS` (F-2 done). Awaiting
  user to populate the secret value (still in `<missing_secrets>`).
- **PHI hash key:** NOT independent — `hashPhiForSearch` uses the
  encryption key. F-9 finding; bundled into Action Item L.
- **Audit logs (forensic snapshots):** discipline established in 2b.5
  (mergeHistoryTable `__enc` envelope); broader audit-log scrubbing
  is Session 2c scope.
- **`phiDb` vs `db` receiver discipline:** documented in
  `phiDb-vs-db-pattern.md`; ESLint F1 enforces.
- **Conversion template:** `object-form-conversion-template.md` is
  the canonical reference for migration sessions.

---

## Project state, candidly

The F1 architectural hard parts are done. The remaining 179 violations
are mechanical applications of established patterns; what's left is
volume of work, not unsolved problems. The audit cycle just completed
surfaced two genuine architectural gaps (L and M) that would have bit
us between TestFlight and first-patient — catching them now justifies
the audit pause.

The non-coding bottleneck has shifted ahead of the coding bottleneck.
Five user-side items (Termly, Auth0 reviewer account, Auth0 BAA email,
Neon checks, lint script) collectively take ~70 minutes and unblock
multiple downstream sessions. None should be blocked by the F1 coding
work; they run in parallel.

Phase 1 has landed (F-2 + 7 F1 violations + 9 loggers). Next agent
session is now either Session 2c (audit-log scrubbing — the larger
architectural unblock) or Phase 2 of the mechanical migration starting
with `patient-engagement-hub-routes.ts` (4 violations, smallest
remaining file). 2c should still go first per prior reasoning.

---

## Session 7 progress (2026-04-20) — TMD-1 F1 file: patient-engagement-service.ts

**Approved scope:** Option α — pure mechanical wrapper swap (18 sites).
No audit-log instrumentation in this session (filed as Action Item AA
for dedicated future work).

**Edits applied (14 operations):**
- 1 import addition: `import { phiDb } from "../storage/phi-storage";`
- 7 `replace_all` swaps covering 12 single-line sites
- 6 multi-line precise swaps for `db.select({...}).from(<PHI>)` blocks

**Sites modified by table:**
| PHI table | inserts | updates | selects | total |
|---|---:|---:|---:|---:|
| `engagementMessageThreadsTable` | 1 | 2 | 4 | 7 |
| `engagementMessagesTable` | 1 | 1 | 2 | 4 |
| `engagementAppointmentsTable` | 1 | 1 | 3 | 5 |
| `engagementAppointmentRemindersTable` | 1 | 0 | 1 | 2 |
| **TOTAL** | **4** | **4** | **10** | **18** |

**Non-PHI tables correctly preserved on raw `db`** (10 sites untouched):
`engagementRewardsTable` (3), `engagementStreaksTable` (4),
`engagementPointsLedgerTable` (3) — these are gamification metadata,
not PHI-registered, so raw `db.*` is correct per the eslint rule
allowlist.

**Verification (all green):**
- Secondary grep for camel/snake near-misses: clean (zero hits)
- `phiDb.(insert|update|select)` count in file: 18 (exact match to
  baseline)
- `npx eslint server/services/patient-engagement-service.ts`: 0 errors
  (was 18 — all `no-restricted-syntax` resolved)
- `npx vitest run`: 72/72 tests pass in 6.22s (no regression)

**Cumulative F1 count (Session 7 baseline methodology):**
- Before this file: 102 `no-restricted-syntax` errors repo-wide
- After this file: **84 errors remaining**
- ~3 more files of comparable scope to reach 0 and trigger
  Action Item Y (CI lint Strategy D → C transition)

**Action Item AA filed alongside** in `f1-action-items.md` —
documents the HIPAA §164.312(b) audit log gap discovered during
pre-flight (file currently emits stdout `logHipaaAudit` traces but
writes nothing to `hipaaAuditLogsTable`). Scoped for dedicated
1–2 session future work, NOT to be bundled with F1 throughput.

**Next F1 candidate** (when authorized):
`patient-engagement-hub-routes.ts` (4 violations, smallest remaining
file per the inventory at line 268 above) OR another file from the
post-Phase-1 inventory (line 257+).
