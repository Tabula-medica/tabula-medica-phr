# The Patient Operations Hub

**Status:** Phase 1 built (forms + eligibility + status + messaging bridge). No voice agent.
**Scope:** onboarding intake, insurance eligibility, status — keyed by `unifiedPatientId`.

---

## 1. What this is, and what prompted it

A request to build "a connector better than MiiHealth AI" for the whole patient-operations
lifecycle: onboarding, insurance checks, secure messaging, and intake forms. MiiHealth AI's
actual product (DAINA + Mediiflow) is a voice-conversational intake agent — it calls or greets
a patient, conducts a spoken clinical history, and writes an EHR-ready note. This connector
does **not** build that. It builds the form-based, data-model half of the same job now, with
the explicit decision (made with the requester) to add a voice agent later rather than block on
one — see §5.

## 2. What was found before writing anything

An inventory of this codebase turned up the exact failure pattern this codebase's other
connectors exist to avoid, three more times:

| Area | What existed | Verdict |
|---|---|---|
| Onboarding | 9+ separate `register*OnboardingRoutes` flows, every one backed by a process-local `Map` or `MemStorage` — none DB-persisted | Duplicated, none durable |
| Insurance eligibility | `server/rcm/eligibility.ts` — real X12 270/271 logic, `stubEligibilityVendor` by design, `server/rcm/store.ts` explicitly in-memory ("mirrors the EHR pattern... until a DATABASE_URL-backed store is provided") | Real logic, no durable record |
| Secure messaging | `server/messaging-routes.ts` (in-memory stub, zero `db`/`phiDb` imports) **and separately** `patient-engagement-service.ts` (real, `phiDb`-backed, PHI-governed) both reachable from `routes.ts` | One real, one stub — easy to build on the wrong one |
| Intake forms | `server/services/questionnaire-service.ts` — `SAMPLE_QUESTIONNAIRES`/`SAMPLE_RESPONSES` hardcoded arrays, no persistence | Pure stub, no real system existed |

This connector does not touch or delete any of the above — picking a winner among 9 onboarding
flows, or deleting a stub a reviewer might be relying on for a demo, is a bigger and more
destructive change than this PR's scope. Instead it adds one new, real, consolidated layer on
top: `server/services/patient-operations/`.

## 3. What it actually does

```
Clinic staff (requireClinicStaff):
  GET  /api/patient-operations/status?unifiedPatientId=
  POST /api/patient-operations/forms/assign
  POST /api/patient-operations/eligibility/check
  POST /api/patient-operations/welcome-message/send

Patient-facing, token-based — no login required:
  GET  /api/patient-operations/intake/:token
  POST /api/patient-operations/intake/:token/submit
```

- **`forms-service.ts`** — a closed, deterministic catalog of intake-form templates
  (`SEED_FORM_TEMPLATES`: new-patient intake, insurance update, consent-to-treat), the same
  closed-candidate discipline `g-code-catalog.ts` and `care-management/code-catalog.ts` use.
  A submission can only answer fields that exist on its template; any other key is **discarded
  in code** (`discardedFields`, returned to the caller, never silently stored) — mirrors
  `hcc-ai-reviewer.ts`'s "an invented id is dropped, not merely discouraged" rule, applied here
  to a patient's own submitted data instead of an AI's.
- **Delivery is a single-use, time-limited token**, not a login. Most patients filling out a
  new-patient intake form do not have an account yet; a magic-link-style token (72-hour TTL,
  `crypto.randomUUID()`, rate-limited) is the realistic shape of that handoff.
- **`eligibility-bridge.ts`** — calls `checkEligibility`/`stubEligibilityVendor` from
  `server/rcm/eligibility.ts` exactly as written (no fork, no rewrite), and persists the result
  keyed by `unifiedPatientId` so it survives past the RCM store's in-memory lifetime. The
  `source` field (`"stub" | "clearinghouse" | "manual" | "admin-override"`) is carried through
  unchanged — a stub result is never relabeled as verified, the same guarantee
  `financialClearance()` already enforces for RCM's own callers.
- **`messaging-bridge.ts`** — sends through `patient-engagement-service.ts`
  (`engagementMessageThreadsTable`/`engagementMessagesTable`, real `phiDb` calls, PHI-audited),
  never `messaging-routes.ts`'s in-memory stub.
- **`status.ts`** — composes the three into one deterministic `PatientOperationsStatus`. Every
  step's status is derived from a real persisted row; nothing here infers "on track" from
  absence of a problem.

## 4. The one place this almost became dishonest, and how it didn't

`unifiedPatientId` and a logged-in `profiles.id` are different identity systems with no mapping
table between them in this codebase (a pre-existing gap `resolve-profile.ts` documents for its
own, separate reason). That means the "welcome message" step cannot know whether a message was
sent for a given `unifiedPatientId` unless the caller also supplies the `profiles.id` — most
newly-onboarded or EHR-synced patients won't have one. The first draft of `status.ts` reported
this step as a hardcoded `"not-started"` with no real backing at all, which would have made it
indistinguishable from a step that genuinely never fired. It now takes an optional
`patientProfileId` and only checks `hasSentWelcomeMessage` when one is supplied; without it, the
step honestly says "no linked patient account to message yet" instead of quietly always
reporting the same status regardless of what actually happened.

## 5. What is deliberately not built, and why

- **No voice-conversational intake agent.** DAINA (MiiHealth AI) and Nuance DAX both operate by
  phone/tablet conversation, not typed forms — a materially different build (telephony, a
  BAA-covered speech vendor, real-time dialogue management), explicitly deferred per the
  requester's own call: ship forms now, keep the data model (`submitResponse`'s token + closed
  field set) shaped so a future voice agent calls the same entry point rather than a parallel
  one.
- **No real clearinghouse vendor adapter.** `stubEligibilityVendor` is still the only
  `EligibilityVendor` implementation in this codebase; `runEligibilityCheck` takes a vendor
  parameter specifically so a real one can be swapped in without changing this connector.
- **No FHIR `Questionnaire`/`QuestionnaireResponse` resource mapping.** `shared/fhir-r4.ts` has
  no `Questionnaire` resource type today, and modeling one correctly is its own task. Intake
  data is stored in this connector's own shape; calling that "FHIR-grounded" would overstate
  what the code does. `unifiedPatientId` — the identity model FHIR-synced data already uses via
  `server/fhir/mapper.ts` — is what's actually reused here.
- **Existing onboarding/messaging/questionnaire duplicates were not touched.** See §2.

## 6. Limitations, stated rather than buried

- The DB round trip (`createAssignment`, `submitResponse`, `runEligibilityCheck`,
  `getLatestEligibility`) is unverified in this environment — no live Postgres connection is
  available to this session. `tests/patient-operations.spec.ts` covers the pure,
  deterministic logic (template catalog shape, answer filtering, status-step derivation) only;
  it does not prove the Drizzle insert/select statements against `intake_form_assignments`,
  `intake_form_responses`, or `patient_eligibility_checks` are correct. CI's own "Postgres
  integration tests" job is the authoritative signal for that, and `npm run db:push` must be run
  before these tables exist in any real database.
- The token endpoints are unauthenticated by design (see §3); their only protection against
  guessing is the token's own entropy plus `intakeRateLimiter`. A leaked link grants one-time
  access to that one form.
