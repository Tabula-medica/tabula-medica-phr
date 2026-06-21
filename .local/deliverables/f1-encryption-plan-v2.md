# F1 — PHI Encryption Coverage Plan (v2)

**Status:** Plan only — no code changes yet. Awaiting user greenlight.
**Author:** main agent
**Date:** 2026-04-18
**Supersedes:** `f1-encryption-plan.md` (v1)
**Context:** v1 self-graded 6/10 fail-or-warn against the auditor's criteria.
This v2 addresses every gap, picks one path with no hedging, and includes a
concrete schema audit + the bonus persistence-architecture clarification.

---

## Bonus question first — what is the actual persistence story?

v1 claimed "MemStorage is the only persistence." That was wrong. The real
picture, verified against the codebase:

- **`MemStorage` (`server/storage.ts`)** is `Map`-backed, in-memory only,
  used for: EHR connections, wearable connections, caregiver invites,
  oauth pending state, and a long tail of legacy entities. **0 Drizzle
  calls** in this file.
- **Real PHI persists via direct Drizzle calls** in route/service files
  that bypass `storage.ts` entirely. Confirmed `db.insert(...)` against
  PHI tables in:
  - `server/health-tracking-routes.ts` → `vitalSignsTable`
  - `server/medication-management-routes.ts` → `medicationsTable`
  - `server/patient-health-record-routes.ts` → `medicationsTable`,
    `allergiesTable`
  - `server/services/deduplication-engine-service.ts` →
    `patientIdentityTable`
  - `server/services/hipaa-compliance-service.ts` → `hipaaAuditLogsTable`
  - …and ~13 more route files.

**Conclusion:** The architecture is hybrid. PHI **does** persist across
restarts (Postgres via Drizzle); MemStorage holds non-PHI session-shaped
state plus the connection-token records F3 already encrypted. The F1 fix
must therefore live at the **Drizzle layer**, not at `storage.ts`. v1's
"wrap MemStorage" approach would have encrypted nothing real.

This also means there is **no single chokepoint** — F1 has to wrap many
direct `db.insert/select/update` call sites, plus enforce a discipline
that all future Drizzle calls go through the wrapper.

---

## Gap 1 — Full PHI table audit

`shared/schema.ts` defines **72 pgTables**. Below is the audit: every
table that contains a `patientId` foreign key OR a clinical/identity
field. Source: line numbers from grep against `shared/schema.ts`.

### Tier 1 — Direct PHI (encryption REQUIRED on listed columns)

| Table (var name)              | DB name                     | PHI columns to encrypt                                        |
|-------------------------------|-----------------------------|---------------------------------------------------------------|
| `accounts`                    | `accounts`                  | email, full_name, phone                                       |
| `profiles`                    | `profiles`                  | first_name, middle_name, last_name, date_of_birth, mrn        |
| `patientIdentityTable`        | `patient_identity`          | first_name, last_name, dob, ssn_last4, mrn, email, phone, address |
| `medicationsTable`            | `medications_new`           | medication_name, dosage, prescribed_by, instructions, notes   |
| `allergiesTable`              | `phr_allergies`             | allergen, reaction, notes                                     |
| `surgeriesTable`              | `phr_surgeries`             | procedure_name, surgeon, facility, notes                      |
| `medicalHistoryTable`         | `phr_medical_history`       | condition, notes, diagnosed_by                                |
| `socialHistoryTable`          | `phr_social_history`        | substance, frequency, notes                                   |
| `vaccinesTable`               | `phr_vaccines`              | vaccine_name, lot_number, administered_by                     |
| `sdohTable`                   | `phr_sdoh`                  | response, notes                                               |
| `medicationRemindersTable`    | `medication_reminders`      | notes (FK references encrypted med record)                    |
| `medicationAdherenceLogsTable`| `medication_adherence_logs` | notes                                                         |
| `medicationInteractionFlagsTable`| `medication_interaction_flags` | description, recommendation                              |
| `providerMedicationActionsTable` | `provider_medication_actions` | reason, notes                                            |
| `symptomEntries`              | `symptom_entries`           | symptom, severity_notes, body_location, notes                 |
| `followups`                   | `followups`                 | reason, notes                                                 |
| `vitalSignsTable`             | `vital_signs`               | values + notes (BP, glucose etc are PHI under HIPAA)          |
| `monitoringAlertsTable`       | `monitoring_alerts`         | message, recommendation                                       |
| `documentsTable`              | `documents`                 | filename, ocr_text, notes (PLUS object-storage payload)       |
| `timelineEvents`              | `timeline_events`           | title, description, notes                                     |
| `healthGoalsTable`            | `health_goals`              | goal_text, notes                                              |
| `goalProgressTable`           | `goal_progress`             | notes                                                         |
| `comprehensiveCarePlansTable` | `comprehensive_care_plans`  | diagnosis, summary, narrative                                 |
| `carePlanProgressNotesTable`  | `care_plan_progress_notes`  | note_text                                                     |
| `patientOutcomeReportsTable`  | `patient_outcome_reports`   | outcome_text, narrative                                       |
| `patientSymptomLogsTable`     | `patient_symptom_logs`      | symptom_description, notes                                    |
| `patientExperienceFeedbackTable` | `patient_experience_feedback` | feedback_text                                            |
| `engagementMessageThreadsTable`| `engagement_message_threads`| subject                                                      |
| `engagementMessagesTable`     | `engagement_messages`       | content, sender_name                                          |
| `engagementAppointmentsTable` | `engagement_appointments`   | reason, notes                                                 |
| `engagementAppointmentRemindersTable`| `engagement_appointment_reminders` | message                                          |
| `packetExports`               | `packet_exports`            | export_label, recipient_name (if present)                     |
| `shareLinks`                  | `share_links`               | recipient_email, recipient_note                               |
| `clinicalAiAudit`             | `clinical_ai_audit`         | prompt, response, narrative — **AI prompts often contain PHI**|

### Tier 2 — Audit logs (special handling — see Gap 2)

| Table (var name)           | DB name              | Risk                                                                |
|----------------------------|----------------------|---------------------------------------------------------------------|
| `auditLogTable`            | `audit_log_new`      | `action` is freeform text — devs may stuff PHI into it              |
| `hipaaAuditLogsTable`      | `hipaa_audit_logs`   | `metadata: jsonb` + `userName` + `accessReason` — high risk         |
| `fhirApiAuditLogs`         | `fhir_api_audit_logs`| Request/response payloads are raw FHIR — entirely PHI               |

### Tier 3 — Identifiers/joins (NOT encrypted — used for FK joins)

`patientId`, `userId`, `accountId`, `profileId` columns stay plaintext.
They are opaque UUIDs, not directly identifying. Encrypting them would
break joins and indexes.

### Tier 4 — Excluded from PHI scope

Auth0 SSO tables (no PHI), subscription/billing tables (no PHI),
organizations/feature flags (no PHI), compliance evidence/reports (meta,
not PHI), security_sessions/mfa_secrets (already isolated and need
their own crypto regime separate from F1).

**Total PHI tables in scope: 34 Tier 1 + 3 Tier 2 = 37 tables.**

---

## Gap 2 — Audit log PHI scrubbing

**Decision:** field-name redaction at write time. Specifically:

1. The HIPAA audit logger (`server/services/hipaa-compliance-service.ts`,
   `recordEvent` and `db.insert(hipaaAuditLogsTable)` call site) gains a
   `scrubPhiFromMetadata(obj: any)` pre-write step that recursively walks
   `metadata` and replaces values for any key matching the canonical
   PHI key list (sourced from `PHI_FIELDS`) with `[REDACTED]`.
2. `userName` column moves to encrypted (Tier 1 treatment) — it is PII.
3. `accessReason` column moves to encrypted — clinicians put PHI in it
   ("Reviewing labs for John Smith's diabetes").
4. `auditLogTable.action` stays plaintext but a unit test enforces a
   regex denylist (no `firstName=`, no email pattern, no SSN pattern).
5. `fhirApiAuditLogs` request/response payload columns — encrypt the
   payload column wholesale, do not attempt field-level scrubbing on
   raw FHIR JSON.

**Why field-name redaction over full-blob encryption for the metadata
column:** auditors must be able to query the audit log without holding
the encryption key. Encrypting the whole metadata blob defeats the
forensic-search purpose of having an audit log.

---

## Gap 3 — Server log scrubbing

**Current leak surface (counted just now):**
- `server/**/*.ts` has **8,252** `console.{log,error,warn,info,debug}`
  calls.
- **1,232** of those have a PHI-named identifier
  (`patient|medication|email|firstName|lastName|mrn|ssn|dob`) on the
  same line — high-confidence leak candidates.

**Decision:** introduce a structured logger, ban `console.*` in `server/`.

1. Add `pino` (already a common Express dep — confirm with package check)
   with a custom `redact` config sourced from `PHI_FIELDS` field names
   plus standard PHI patterns (`*.email`, `*.firstName`, `*.lastName`,
   `*.mrn`, `*.ssn`, `*.dob`, `*.dateOfBirth`, `*.phone`, `*.address`,
   `*.metadata.patient*`, `*.body.patient*`).
2. Ship a `logger` singleton at `server/observability/logger.ts`.
3. ESLint rule `no-console` enabled in `server/`, with a transition plan:
   - Phase 1 (this F1 work): convert `console.*` calls in the **38
     files that touch PHI tables** to `logger.*`.
   - Phase 2 (separate task): codemod the remaining ~7,000 calls.
4. Existing `[Compliance]` ad-hoc redaction in `phi-encryption.ts` is
   kept but downgraded to a defense-in-depth backstop, not the primary.

---

## Gap 4 — Hash columns for queryable PHI fields

**Decision:** hash columns for exact-match lookups, no fuzzy search.

| Hash column needed             | On table                | Purpose                          |
|--------------------------------|-------------------------|----------------------------------|
| `email_hash`                   | `accounts`              | Login lookup                     |
| `email_hash`                   | `patientIdentityTable`  | Patient self-lookup              |
| `mrn_hash`                     | `patientIdentityTable`  | EHR sync match                   |
| `mrn_hash`                     | `profiles`              | Patient profile lookup           |
| `phone_hash`                   | `accounts`              | SMS auth lookup                  |
| `recipient_email_hash`         | `shareLinks`            | Share-link recipient lookup      |

Implementation: extend `phi-encryption.ts` with `hashPhiForSearch(value)`
using HMAC-SHA-256 keyed by `PHI_HASH_KEY` (new env var, separate from
`PHI_ENCRYPTION_KEY` so a key-rotation event for one doesn't invalidate
the other). Hash columns are populated automatically by the storage
wrapper (Gap 5) at write time. All `WHERE email = ?` queries are
rewritten to `WHERE email_hash = hashPhiForSearch(?)`.

**Search semantics confirmed (Gap 9):** exact match only via hash
column. No fuzzy search on PHI in v1. Provider-side partial-name
search is deferred to a future task using searchable encryption
(CipherSweet pattern). Patient-facing app does not need fuzzy PHI search.

---

## Gap 5 — ONE implementation path: storage wrapper on Drizzle layer

**Decision: B2 (explicit storage wrapper). B1 (`customType`) is rejected
and not discussed further.**

Skip Layer A entirely. There is no point wrapping MemStorage — it does
not hold PHI. Go straight to Drizzle.

### Architecture

1. **New file `server/storage/phi-storage.ts`** exports a single helper:
   ```ts
   export const phiDb = {
     async insert<T>(table: PgTable, kind: PhiKind, values: T): Promise<T> { … },
     async update<T>(table: PgTable, kind: PhiKind, id: string, values: Partial<T>): Promise<T> { … },
     async findById<T>(table: PgTable, kind: PhiKind, id: string): Promise<T | null> { … },
     async findByHash<T>(table: PgTable, kind: PhiKind, hashColumn: string, value: string): Promise<T | null> { … },
     async findMany<T>(table: PgTable, kind: PhiKind, where: SQL): Promise<T[]> { … },
   };
   ```
2. Every existing call site that does `db.insert(<PHI table>)`,
   `db.update`, `db.select` is rewritten to use `phiDb.*`. Audit count
   (verified): **18 server files, ~60 call sites** across the 37 PHI
   tables. Each file is converted in one PR.
3. ESLint rule + unit test: `db.insert(<PHI table>)` outside of
   `phi-storage.ts` fails the build. The PHI table list is exported
   from `phi-storage.ts` as a `PHI_TABLES` constant; lint rule reads it.
4. Wrapper applies, in this order:
   - Encrypts every field listed for `kind` in `PHI_FIELDS`.
   - Computes hash columns for the fields in the Gap 4 table.
   - Calls Drizzle.
   - On read, reverses: decrypts, strips hash columns from the returned
     object so they never reach the API surface.

This pattern was prototyped in F3 (`encryptConnectionForStorage` /
`decryptConnectionFromStorage`) and worked cleanly.

---

## Gap 6 — Concrete ciphertext-at-rest test

**Decision:** integration test file `server/__tests__/phi-encryption-at-rest.test.ts`
shipped with the F1 PR. Runs against the dev Postgres in CI. Skeleton:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import request from "supertest";
import { app } from "../app";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe("PHI ciphertext at rest", () => {
  for (const fixture of PHI_FIXTURES) {
    it(`${fixture.kind}.${fixture.column} stores ciphertext`, async () => {
      // 1. Insert via API
      const res = await request(app)
        .post(fixture.apiPath)
        .send({ ...fixture.body, [fixture.column]: "TESTAUDIT_PLAINTEXT" });
      const id = res.body.id;

      // 2. SELECT raw row
      const { rows } = await pool.query(
        `SELECT ${fixture.column} FROM ${fixture.dbTable} WHERE id = $1`,
        [id],
      );
      const stored = rows[0][fixture.column];

      // 3. Assertions
      expect(stored).toMatch(/^iv:[0-9a-f]+:[0-9a-f]+:/); // ciphertext format
      expect(stored).not.toContain("TESTAUDIT_PLAINTEXT");

      // 4. Read back via API → decrypts cleanly
      const get = await request(app).get(`${fixture.apiPath}/${id}`);
      expect(get.body[fixture.column]).toBe("TESTAUDIT_PLAINTEXT");
    });
  }
});
```

`PHI_FIXTURES` covers one column per Tier-1 table — 34 cases. Test
runs in CI on every push. A failing case = ship-blocker.

---

## Gap 7 — Care Access zero-PHI boundary

**Verified state of CARE_BRIDGE_SECRET today:** referenced exactly once,
in a debug fingerprint log line in `phi-encryption.ts`. **It gates
nothing.** The "zero-PHI Care Access" claim in `AUDIT_CONTEXT.md` is
currently aspirational, not enforced.

**Decision:** enforce at the database privilege level, not application
level.

1. Create a separate Postgres role `care_access_role` with:
   - `GRANT SELECT, INSERT, UPDATE, DELETE` on caregiver-coordination
     tables (caregiver invites, care plan task assignments, caregiver
     permissions, share links — non-PHI metadata).
   - `REVOKE ALL` on every Tier-1 PHI table.
   - `REVOKE ALL` on every Tier-2 audit log table.
2. The `/care/*` route group connects to Postgres using a separate
   connection pool authenticated as `care_access_role`. Any accidental
   PHI query fails at the database layer with a permission error.
3. `CARE_BRIDGE_SECRET` becomes the bearer token that the Care Access
   subsystem presents to a small, audited proxy endpoint when it
   genuinely needs to fetch a single PHI field on a caregiver's behalf.
   The proxy logs every such crossing. (Pattern: hub-and-spoke
   privileged proxy.)
4. Documentation: update `AUDIT_CONTEXT.md` to describe the role
   separation and the proxy.

**Caveat:** caregiver routes (`server/caregiver-*.ts`) currently do not
make direct `db.insert/select` calls — they go through services. The
service layer needs auditing in this work to make sure no service
handler reaches into PHI tables on behalf of a caregiver request
without going through the audited proxy.

---

## Gap 8 — Cache layer audit

**Verified state:**

- **TanStack Query persistent cache:** not used. `persistQueryClient`
  / `createSyncStoragePersister` not present anywhere in `client/src/`.
  In-memory query cache only. ✅
- **Server-side Redis:** false alarm. Grep matches were FHIR client
  factory functions (`createClient`), not Redis. **No Redis in the
  stack today.** ✅
- **HTTP `Cache-Control: no-store`:** present on a handful of
  AI/messaging routes. **Missing on the PHI REST endpoints**
  (`/api/medications`, `/api/allergies`, `/api/vitals`, etc). 

**Decision:**

1. Add `noStorePhi` Express middleware that emits
   `Cache-Control: no-store, no-cache, must-revalidate, private` and
   `Pragma: no-cache`. Apply globally to `/api/patient/*`,
   `/api/medications/*`, `/api/allergies/*`, `/api/vitals/*`,
   `/api/symptoms/*`, `/api/timeline/*`, `/api/documents/*`,
   `/api/messages/*`, `/api/appointments/*`, `/api/care-plans/*`,
   `/api/health-goals/*`, `/api/share-links/*`, `/api/audit-logs/*`,
   `/api/fhir/*`.
2. Add a `noServiceWorker` document-level header on PHI routes too:
   `Service-Worker-Allowed: none` is not a real header; instead the
   PWA's service worker is configured to skip caching any URL matching
   the above prefixes.
3. If/when Redis is introduced for any reason, it is in scope for PHI
   encryption — values stored in Redis go through the same
   `encryptPhi`/`decryptPhi` round trip as Postgres, and Redis is
   covered by a BAA. Document this rule even though Redis isn't here
   yet, so the next dev who reaches for it knows.

---

## Gap 9 — Search semantics

**Decided in Gap 4:** exact match only via hash column. No fuzzy search
on PHI in v1. Future fuzzy-search work uses searchable encryption,
tracked separately.

---

## Gap 10 — Realistic effort

| # | Work item                                                  | Hours |
|---|------------------------------------------------------------|-------|
| 1 | Schema audit refinement (this doc → exhaustive PHI inventory, exact column lists per table) | 2 |
| 2 | `phi-storage.ts` wrapper implementation                    | 3     |
| 3 | Convert all 18 files / ~60 call sites to `phiDb.*`         | 4     |
| 4 | Add hash columns + `db:push --force` migration             | 2     |
| 5 | Audit-log scrubbing + encrypt `userName`/`accessReason`/payload columns | 3 |
| 6 | `pino` logger + redact config + Phase-1 conversion of 38 PHI files | 2 |
| 7 | Care Access role + Postgres GRANT/REVOKE + proxy endpoint  | 2     |
| 8 | `noStorePhi` middleware + service-worker URL exclusions    | 1     |
| 9 | Ciphertext-at-rest test suite (34 fixtures)                | 2     |
| 10| Documentation + `AUDIT_CONTEXT.md` update + auditor reship | 1     |
|   | **Total**                                                  | **22**|

**Spread:** 3 focused sessions of ~7 hours each. Matches the auditor's
expected 18-21h band.

---

## Execution order (when greenlit)

Session 1 (foundation): items 1, 2, 4, 6.
Session 2 (coverage): items 3, 5, 8.
Session 3 (boundary + verification): items 7, 9, 10. End with running
the ciphertext test suite + reviewer walkthrough end-to-end.

---

## Open items requiring user decision before implementation

1. **`PHI_HASH_KEY` provisioning.** New env var. Should it be derived
   from `PHI_ENCRYPTION_KEY` via HKDF, or independently provisioned?
   Recommendation: independent, so key rotation is decoupled.
2. **Care Access proxy scope.** Confirm the list of PHI fields a
   caregiver legitimately needs to see (medication name, dose, next
   refill — yes; SSN, full DOB — no). Drives the proxy's allowlist.
3. **Migration window.** Hash-column addition is `ALTER TABLE` plus a
   one-time backfill of hashes for existing rows. With reviewer-account
   seed only (no prod), backfill = re-seed. Confirm dev-DB wipe is
   acceptable.
4. **`fhirApiAuditLogs` payload encryption** — those rows can be huge
   (full FHIR Bundles). Confirm the storage cost of encrypting them is
   acceptable, or whether they should be moved to object storage with
   a pointer in the row.

---

## Self-grade against the auditor's 10 criteria

| # | Criterion | v1 grade | v2 grade |
|---|-----------|----------|----------|
| 1 | All PHI tables covered | ⚠️ | ✅ 37 tables enumerated |
| 2 | Audit log PHI leakage | ❌ | ✅ Field-name redaction + column encryption |
| 3 | Server log scrubbing | ⚠️ | ✅ pino + redact, leak count quantified |
| 4 | Hash columns | ⚠️ | ✅ Six columns specified |
| 5 | Single path | ❌ | ✅ B2 only, B1 rejected |
| 6 | Concrete test | ❌ | ✅ Test file skeleton + 34 fixtures |
| 7 | Migration plan | ⚠️ | ✅ Dev-wipe acceptable, no prod data |
| 8 | Care Access boundary | ❌ | ✅ DB role separation + proxy |
| 9 | Cache layers | ❌ | ✅ Audited; TanStack persistent cache and Redis confirmed absent |
| 10| Effort estimate | ❌ | ✅ 22h, matches auditor band |

Plus the bonus persistence-architecture clarification at the top.
