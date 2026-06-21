# F1 Encryption — Action Items Index

This file is the single index of follow-up work that the F1 (PHI encryption
at rest) program has surfaced but deferred out of the active migration
sessions. Each item below links to its detailed spec where one exists.

**Sequencing rule (do not violate):**

```
routes.ts + infrastructure-routes.ts F1 migrations  (mechanical, deferred)
                                ↓
                     Action Item I   (search audit)
                                ↓
                     Action Item H   (plaintext backfill)
                                ↓
              First real patient signup / TestFlight
```

Reasoning: Action Item H rewrites every plaintext PHI cell in the database
to ciphertext. The instant it runs, every `eq()` / `LIKE` query against a
PHI column that has not yet been migrated to a hash column starts silently
returning zero rows. There is no error, no exception — patient lookup just
returns empty. Action Item I MUST audit and fix every such call site
BEFORE the H backfill runs.

---

## Next-session quick-fix bundle (carry-on items)

Bundle these into whatever the next coding session is — too small to
deserve their own session, too risky to defer indefinitely:

1. **F-2 fix:** add `"PHI_ENCRYPTION_SALT_V2"` to the `MANAGED_SECRETS`
   array in `server/services/gcp-secret-manager.ts` (currently lines
   5–13, between `PHI_ENCRYPTION_SALT` and `SESSION_SECRET`). One-line
   edit. ~5 minutes including the workflow restart to verify the secret
   loader still boots cleanly. Sanity-checks the GCP→Replit secret load
   path before Action Item L adds another versioned secret to the same
   flow. Reference: `key-management-audit.md` finding F-2.

(Add additional carry-on items here as future audits surface them.)

## Action Item H — Plaintext → ciphertext backfill

**Status:** PENDING (pre-TestFlight blocker).
**Spec:** `.local/deliverables/action-item-H-plaintext-backfill.md`.
**Estimate:** 1 focused session (script + dry-run + production run).

**Summary:** A one-shot migration script that walks every PHI table, reads
each row, and re-writes it through `encryptPhiRow` so legacy plaintext
cells become ciphertext. Idempotent (`encryptPhiRow` skips already-
ciphertext strings) so re-running is safe. Required before TestFlight
because reviewers (and real patients) cannot have their data sitting
plaintext at rest in Neon — that would void the HIPAA at-rest encryption
control regardless of the wrapper code being correct on the path forward.

**Hard prerequisites before running:**

- All F1 migrations on routes that touch PHI tables must be merged
  (`routes.ts`, `infrastructure-routes.ts`, audit-log work, etc.) — so
  every write path produces ciphertext after H runs.
- Action Item I (below) MUST be complete — otherwise H silently breaks
  patient lookup the moment it finishes.
- Neon PHI multi-role check (PENDING USER) — confirms whether the
  backfill script can run under a separate `phi_writer` role for blast
  radius containment.

---

## Action Item I — Encryption-search compatibility audit (NEW)

**Status:** PENDING (pre-TestFlight blocker; sequenced BEFORE H).
**Estimate:** 3–5 hours (audit + migrate exact-match queries + document
fuzzy-search removals).

### The problem

After F1 backfill (Action Item H) runs, every PHI text column contains
ciphertext like `iv:abc123:def456:...`. Each call to `encryptPlaintext()`
emits a fresh random IV, so the SAME plaintext value encrypts to a
DIFFERENT ciphertext on every write. This means:

```sql
-- BEFORE F1: works fine
SELECT * FROM patient_identity WHERE email = 'user@example.com';

-- AFTER F1 backfill: silently returns zero rows
-- (compares 'user@example.com' against an iv-prefixed ciphertext blob)
SELECT * FROM patient_identity WHERE email = 'user@example.com';

-- AFTER F1 backfill: silently returns zero rows
-- (LIKE pattern '%smith%' searches inside a ciphertext blob)
SELECT * FROM patient_identity WHERE first_name ILIKE '%smith%';
```

This is not a gradual degradation — it is a cliff. The day H runs against
a database with real patients, every patient-lookup-by-name/email/MRN flow
breaks completely. **No error, no exception, just silently empty results.**

### Known cases (seed list — audit will likely find more)

1. **`server/services/deduplication-engine-service.ts`**
   - `checkDeterministicMatch()` — `eq(table.ssnLast4, ...)`,
     `eq(table.dateOfBirth, ...)`, `eq(table.stateId, ...)`,
     `eq(table.mrn, ...)`, `eq(table.email, ...)`. Already flagged
     inline with `F1-LATENT` comments and at the file-top NOTE
     (Session 2b.5).
   - `findProbabilisticMatches()` — `eq(table.dateOfBirth, ...)` anchor.
   - `searchPatients()` — `lower(first_name) LIKE '%...%'` and
     `eq(table.email, ...)`. The first-known cliff site, flagged inline.
2. **`server/patient-health-record-routes.ts`** — needs re-audit; the
   F1 wrapper migration completed there did NOT touch query predicates.
3. **`server/routes.ts`** — DEFERRED file; will need full audit when
   that migration session lands.
4. **`server/infrastructure-routes.ts`** — same.
5. **Auth flows** — login by email, OTP lookup by phone, etc. Likely
   live in `server/auth/*`. Must audit.
6. **MPI / patient-identity adjacent code** — anywhere that resolves a
   patient by MRN, SSN-last-4, DOB, state ID.

### Resolution options per call site

For every `eq()` / `like()` / `ilike()` against a PHI column, exactly
one of the following must apply:

**(A) Migrate to a hash column (preferred for exact match).**
We already have `emailHash`, `mrnHash`, `phoneHash` defined in
`PHI_HASH_COLUMNS` (`server/security/phi-column-map.ts`). Use
`hashPhiForSearch()` (or the convenience helpers `hashEmail`, `hashMrn`,
`hashPhone` from `phi-storage.ts`) and rewrite the query to look up by
the hash:

```ts
// Before
const [row] = await phiDb.select().from(patientIdentityTable)
  .where(eq(patientIdentityTable.email, email.toLowerCase()));

// After
const [row] = await phiDb.select().from(patientIdentityTable)
  .where(eq(patientIdentityTable.emailHash, hashEmail(email)));
```

For columns that DO NOT YET have a hash column (candidates: `ssnLast4`,
`stateId`, `dateOfBirth`), Action Item I includes a sub-task:

- **I.a — Add hash columns ONLY for proven exact-match query sites.**
  This sub-task is **audit-driven, not preemptive.** Before adding any
  hash column to `patientIdentityTable`, the audit (deliverable below)
  must produce at least one exact-match call site that needs it.
  "Add all possible hash columns just in case" produces schema bloat
  and should be rejected.

  Current best-guess (subject to audit confirmation):
    - `ssnLast4Hash` — likely needed; dedup `checkDeterministicMatch()`
      Priority 2 uses `eq(table.ssnLast4, ...)`.
    - `stateIdHash` — likely needed; dedup Priority 3 uses
      `eq(table.stateId, ...)` paired with `stateIdState`.
    - `dateOfBirthHash` — UNCERTAIN. DOB is usually a secondary match
      factor alongside name, not a primary lookup key. Verify whether
      any flow actually does `WHERE dateOfBirth = ?` as a primary
      lookup before adding the column.

  When the column IS justified by the audit: extend `PHI_HASH_COLUMNS`,
  run `npm run db:push --force`, update `encryptPhiRow` to populate the
  hash on insert/update (same pattern as `emailHash`).

**(B) Remove the feature for v1 MVP.**
For fuzzy / `LIKE` / `ILIKE` searches that fundamentally cannot work
against random-IV ciphertext (e.g. provider-side "search patients by
partial last name"), the v1 patient-facing app does NOT need this
feature. Delete the route and the UI surface that calls it. Document
the removal in `replit.md` so a future engineer doesn't re-add it
without thinking about the encryption constraint.

**(C) Document as broken-by-design until V2.**
For features that we want to keep but can't fix in v1, add an explicit
`F1-LATENT` comment at the call site AND a tracked entry in this file
under "Known broken-by-design searches". The v2 fix is searchable
encryption (CipherSweet pattern) — out of v1 scope.

### Audit deliverable

When Action Item I is executed, produce
`.local/deliverables/action-item-I-search-audit.md` containing:

- A table of every PHI-column predicate found in the codebase.
- The chosen resolution per row (A migrate / B remove / C defer).
- The new hash columns added (if any) and their migration plan.
- A list of feature surfaces removed in v1 (for the changelog).
- Confirmation that `grep -r "eq(.*Table\.\(email\|mrn\|firstName\|...\))"`
  across `server/` returns ONLY hash-column lookups or annotated
  `F1-LATENT` lines.

### Why I sequences before H

If H runs before I:
- Real patient signs up → row stored as ciphertext.
- Patient logs in → `WHERE email = ?` returns zero rows → login fails.
- We restore from backup (which still has plaintext) → at-rest
  encryption control voided.
- We restore + re-run H + ship I → multi-day patient-data outage.

If I runs before H:
- Codebase queries by hash columns.
- Then H rewrites plaintext to ciphertext + populates hash columns
  on every existing row.
- Patient logs in → `WHERE emailHash = ?` matches → login works.
- Zero-downtime cutover.

### Hard TestFlight blocker

This is on the critical path between "F1 wrapper code is shipped" and
"first real patient signs up." Until Action Item I is complete, the
F1 backfill cannot run safely, and until the F1 backfill runs, real
patient PHI cannot land in the production database under HIPAA
at-rest-encryption controls.

---

---

## Action Item J — Expand ciphertext-at-rest test coverage 20 → 40 tables

**Status:** PENDING (post-TestFlight, pre-HIPAA-audit-certification).
**Estimate:** Foldable into Phases 1–4 of the F1 remaining migration
(see `f1-remaining-violations-triage.md`); add the fixture for each new
table when its migration session lands. Net new work: ~30 min per
table × 20 tables = ~10 focused hours.

### The gap

Reviewer's Gap 3 audit: v2.1 identified 40 Tier-1 PHI tables. Current
`tests/phi-storage.spec.ts` covers 20. Half the tables are unverified
by ciphertext-at-rest fixtures — meaning an auditor asking "show me
ciphertext at rest for every PHI table" gets 20/40.

### Tables not yet fixture-covered

Per Gap 3 inventory:

- `medication_reminders`, `medication_adherence_logs`,
  `medication_interaction_flags`, `provider_medication_actions`
- `phr_surgeries`, `phr_medical_history`, `phr_social_history`,
  `phr_vaccines`, `phr_sdoh`
- `symptom_entries`, `followups`, `monitoring_alerts`
- `health_goals`, `goal_progress`
- `comprehensive_care_plans` + 6 care-plan link tables
- `patient_symptom_logs`, `patient_experience_feedback`
- `engagement_message_threads`, `engagement_messages`,
  `engagement_appointments`, `engagement_appointment_reminders`
- `packet_exports`, `share_links`
- `fhir_api_audit_logs`

### Fixture template per table

Reuse the established pattern (see fixtures #15–#20 added in 2b.5):

1. Construct realistic insert payload with all PHI columns populated.
2. `encryptPhiRow("<tableName>", input)` → assert each PHI text column
   matches `isEncrypted(...)`, each PHI jsonb column has `__enc`
   envelope, each non-PHI column passes through unchanged.
3. `decryptPhiRow("<tableName>", encrypted)` → assert deep equality with
   the original input.
4. For tables with append-only forensic semantics (audit logs, snapshots),
   add a backward-compat fixture that proves legacy plaintext rows
   coexist in the same SELECT batch without throwing.

### Why not blocker for TestFlight

TestFlight reviewers do not run our test suite. They evaluate the
shipped product behavior. The 20 existing fixtures already prove the
wrapper is correct; the missing 20 are evidence-of-correctness for an
auditor, not gates on user-facing functionality. Sequenced after H so
real patient flows are exercised end-to-end first.

### Why blocker for HIPAA audit certification

A HIPAA audit (164.312(a)(2)(iv) at-rest encryption control) requires
documented evidence that PHI is encrypted for every storage location
holding PHI. "20 of 40 tables tested" is a partial control. Auditors
will ask for the missing 20.

---

## Action Item K — Stale string-form logger conversions  🟡

**Status:** PENDING (low-priority but cheap to clear).
**Estimate:** ~30 minutes per file, foldable into the F1 migration
session for each affected file.

### The gap

Reviewer's Gap 4: early Session 1 did 51 mechanical
`console.log → logger.info` conversions across 3 files. They went in
as **string-form** (`logger.info("text " + value)`) which Pino's
redact path cannot scrub. Object-form is required
(`logger.info({ data }, "text")`) so PHI in interpolated values is
caught by the redact paths configured against the field names.

`server/services/deduplication-engine-service.ts` was fixed during 2b.5.
The other two files were skipped in Session 2a triage as "mostly
converted" — but verification shows that meant "string-form, doesn't
redact," not "done."

### Verified counts (re-audit, session 2b.5 close)

| File | string-form | object-form | total |
|---|---:|---:|---:|
| `server/services/hipaa-compliance-service.ts` | **9** | 0 | 9 |
| `server/medication-management-routes.ts` | **19** | 0 | 19 |

Both files have **zero** object-form logger calls. Every existing call
is the broken pattern. Bundle these fixes with the F1 migration session
for each file (medication-management is Phase 2; hipaa-compliance is
Phase 1 per `f1-remaining-violations-triage.md`).

### Conversion pattern

```ts
// Before (broken — Pino redact does not catch interpolated values)
logger.info(`Patient ${patientId} medication updated: ${medName}`);

// After (object-form — redact catches `patient.id` and `medication.name`
// per Pino redact paths configured in server/lib/logger.ts)
logger.info(
  { component: "MedicationRoutes", patient: { id: patientId }, medication: { name: medName } },
  "patient medication updated",
);
```

The conversion template at
`.local/deliverables/object-form-conversion-template.md` documents the
"sticky pitfalls" section that applies here.

---

---

## Action Item L — Versioned ciphertext envelope + key rotation infrastructure  🔴

**Status:** PENDING. Sequencing: **after Session 2c (audit-log scrubbing),
before Action Item H (plaintext backfill).** Estimated 1.5 sessions.
**Filed at:** session 2b.5 close, in response to Gap 1 reviewer audit
(F-1 finding in `key-management-audit.md`).

### Why this exists

Today's ciphertext format is `<ivHex>:<authTagHex>:<encryptedHex>` with
no key-version byte. This means rotating `PHI_ENCRYPTION_KEY` is
impossible without one of:

- **Coordinated stop-the-world rotation** — decrypt every PHI cell with
  old key, re-encrypt with new key, take downtime for hours.
- **Dual-key operation with version dispatch** — what this Action Item
  builds. Decrypt-by-version, encrypt-with-current, background backfill
  to retire old key gradually.

If the key leaks today, neither option is available. We have no rotation
procedure at all. HIPAA §164.312(a)(2)(iv) auditors interpret crypto
key lifecycle as in-scope; "no procedure" is a finding.

### Architectural outline

1. **New file** `server/security/key-ring.ts`:
   - Loads versioned keys from env: `PHI_ENCRYPTION_KEY_V1`,
     `PHI_ENCRYPTION_KEY_V2`, etc. (with backward-compat alias for the
     unversioned `PHI_ENCRYPTION_KEY` → V1).
   - Exposes `getKey(version: number): Buffer` (memoized; see F-5 perf
     finding — the per-call `scryptSync` cost compounds without a cache).
   - Exposes `getCurrentVersion(): number` for new writes.
2. **Modify** `phi-encryption.ts::encryptPhi(plaintext)`:
   - Old format: `<iv>:<authTag>:<ct>`
   - New format: `v<N>:<iv>:<authTag>:<ct>` where `<N>` is the current
     keyring version.
3. **Modify** `phi-encryption.ts::decryptPhi(encryptedData)`:
   - If string starts with `v<digits>:`, parse version and look up the
     key from keyring.
   - If string has the legacy 3-part shape (no `v` prefix), treat as
     V1 ciphertext (backward compat for everything written before this
     change ships).
   - Decrypt with the resolved key.
4. **Modify** `isEncrypted(value)` to accept both shapes.
5. **Update** `tests/phi-storage.spec.ts` to add fixtures proving:
   - Round-trip with V1 unversioned shape (legacy data)
   - Round-trip with V2 versioned shape (new writes)
   - Mixed-version SELECT (one of each in the same row batch)
   - Decrypt fails cleanly if version byte points at a key not in keyring
6. **New** `scripts/rotate-phi-key.ts` — backfill script that walks every
   PHI table, reads each row, decrypts under V<old>, re-encrypts under
   V<current>, writes back. Idempotent (skips rows already at current
   version per the version byte).
7. **Documentation**: rotation playbook in
   `.local/deliverables/key-rotation-runbook.md` covering: add new key
   version, flip current pointer, run backfill, verify, retire old key.

### Coupling with F-9 (hash key independence)

When Action Item L lands, take the opportunity to also fix F-9: introduce
`PHI_HASH_KEY` as an independent env var so `hashPhiForSearch()` is
decoupled from encryption-key rotation. Otherwise rotating
`PHI_ENCRYPTION_KEY` invalidates every hash column too, and Action Item I
(the search-by-hash architecture) becomes a moving target during the
backfill window. **F-9 is verified NOT fixed** as of session 2b.5 close
— grep against `server/` returns zero hits for `PHI_HASH_KEY`, and
`phi-encryption.ts:151` still calls `getEncryptionKey()` as the scrypt
input. (Reviewer recollection at session 2b.5 close was that this had
been addressed in an earlier session — that recollection is incorrect;
the intent existed but the code change did not ship.)

### Hard sequencing

- Cannot precede Session 2c (audit-log scrubbing); 2c touches the same
  encryption path and would conflict.
- Must precede Action Item H (plaintext backfill). Reason: H rewrites
  every PHI plaintext value through `encryptPhi()`. If H runs before L,
  every cell ends up tagged "V1" with no version byte and we've doubled
  the backfill cost we'll pay later when L finally ships.
- Soft prereq: F-2 (add `PHI_ENCRYPTION_SALT_V2` to `MANAGED_SECRETS`)
  should land first as a sanity check — proves the GCP→Replit secret
  load path is healthy before adding a second secret to the same flow.

---

## Action Item M — Key escrow and recovery runbook  🔴 USER TASK

**Status:** PENDING. **Cannot be delegated to agent** — physical
security decisions and personal accountability. Hard prerequisite
before first real patient signup.
**Filed at:** session 2b.5 close, in response to Gap 1 reviewer audit
(F-4 finding in `key-management-audit.md`).
**Estimate:** 3 hours total (1h escrow + 2h runbook authoring).

### Why this exists

If `PHI_ENCRYPTION_KEY` is lost — Replit Secrets corruption, GCP project
deletion, account compromise that nukes both — every PHI cell at rest
becomes **permanently unrecoverable**. Not "hard to recover";
mathematically lost. There is currently no backup, no escrow, no
documented recovery procedure.

This is true for any properly-encrypted system. The mitigation is
escrow, not better backups (a backup of an encrypted database without
the key is useless).

### What the user must do

1. **Print on paper** the hex values of:
   - `PHI_ENCRYPTION_KEY`
   - `PHI_ENCRYPTION_SALT` (legacy)
   - `PHI_ENCRYPTION_SALT_V2`
   - `PHI_HASH_KEY` (once it exists per F-9 / Action Item L coupling)
   - `SESSION_SECRET` (separate concern but same escrow logistics)
2. **Seal in tamper-evident envelopes.** Two copies, two physical
   locations (e.g., personal bank safe deposit box + cofounder's bank
   safe deposit box, or attorney's safe).
3. **Document in 1Password / Bitwarden** a sealed note titled
   "Tabula Medica — PHI master key (DO NOT SHARE)" with: the key value,
   the salt value, the escrow location addresses, the rotation date,
   and the GCP Secret Manager project ID where the canonical online
   copy lives.
4. **Authorize one trusted second human** (cofounder, lawyer, spouse)
   with vault access for founder-unavailability scenarios.
5. **Author the recovery runbook** at
   `.local/deliverables/key-recovery-runbook.md` covering:
   - Symptoms of a key-loss incident
   - First-response actions ("do not run H backfill, do not encrypt
     anything new, preserve database snapshot")
   - Retrieval procedure from each escrow location
   - Re-injection steps (Replit Secrets paste → GCP Secret Manager
     update → service restart sequence)
   - Verification test (insert+select round-trip on a known plaintext)
   - Last-resort breach-notification path per HIPAA Breach Notification
     Rule §164.404 if recovery fails
6. **Schedule quarterly recovery drill.** Once per quarter, simulate
   key loss in a staging environment, run the runbook end-to-end, fix
   any gaps the drill exposes.

### Why agent cannot do this

Steps 1–4 require physical-world actions (printing, envelope sealing,
travel to a bank, granting human-to-human vault access). Step 5 (the
runbook) the agent CAN draft, but only after the user has decided on
the escrow location addresses to reference in the runbook — those are
inputs the agent does not have.

### Runbook scope addendum — incident-response decision tree

When the runbook is eventually authored (step 5), it must include a
**key-loss incident-response decision tree** that distinguishes the
two failure modes and their HIPAA obligations. Filed at session 2b.5
close as a scope note so future-author has the questions enumerated:

1. **Lost vs compromised — first triage question.**
   - *Lost-key scenario:* the operational copy is gone (Replit Secrets
     wiped, GCP project deleted, account locked) but escrow is intact
     and unread. Recovery path: retrieve from escrow, re-inject, verify.
   - *Compromised-key scenario:* the key value is known to an
     unauthorized party (leaked log, departed employee with access,
     stolen device). Escrow is irrelevant — the escrowed key IS the
     compromised key. Required path: rotate via Action Item L
     procedure, then run rotation backfill, THEN destroy the old key.
   - The runbook's first decision must force the responder to answer
     "is the key value still secret?" before doing anything else.
2. **HIPAA §164.404 breach-notification obligation analysis.**
   - HHS guidance: §164.402 defines "breach" as "unauthorized
     acquisition, access, use, or disclosure of unsecured protected
     health information." "Unsecured" = not rendered unusable per the
     HHS-specified encryption/destruction methods.
   - Lost-key event where data remained encrypted at rest throughout:
     **generally NOT a breach** — the PHI was secured (AES-256-GCM)
     for the entire duration of the incident. The "data is
     unrecoverable forever" outcome is a business-continuity
     catastrophe, not a HIPAA breach. The runbook MUST document this
     reasoning explicitly so the founder, in crisis, doesn't
     mis-classify a lost-key event as a reportable breach (which
     triggers 60-day notification to every affected patient + HHS +
     in some cases media — a trauma the founder shouldn't impose on
     patients unnecessarily).
   - Compromised-key event: the §164.402(2) "low probability of
     compromise" risk-assessment analysis applies. Auditor consensus
     leans toward "key compromise = PHI compromise" because the
     attacker can decrypt any ciphertext snapshot they may also have
     obtained. Runbook should presume reportable and document the
     risk-assessment factors that could support a non-reportable
     determination (e.g., "no evidence ciphertext was ever exfiltrated
     during the compromise window").
3. **Escrow-recovery event — reportable?**
   - Generally **no**. If the key was lost, then retrieved from a
     sealed envelope in a bank vault, and no third party ever held
     the key value during the incident — the §164.402 "unauthorized
     acquisition" element was never met. Data was secured throughout.
   - But: confirm with HIPAA counsel before the runbook ships. A
     defensible determination needs a documented attorney sign-off on
     the runbook itself, not a founder-only judgement call in the
     middle of an incident.
4. **Counsel-sign-off requirement.**
   - The runbook must be reviewed by a HIPAA-experienced attorney
     before it is treated as authoritative. The founder's
     decision-tree reasoning is not a substitute for legal sign-off
     on the breach-notification determinations.

### Hard sequencing

Before first real patient signup. Not before TestFlight (TestFlight
data is test-account synthetic), but before the production deploy
that accepts the first real-patient Auth0 signup. If a real patient's
PHI lands in a database whose key is not escrowed, the founder has
accepted unbacked single-point-of-failure liability for that
patient's data.

---

## Action Item I — extension: `eq()` on encrypted columns inside existence-check queries  🟡

When migrating a route that contains an existence check or de-dup
filter expressed as `eq(phiTable.encryptedColumn, value)` inside the
SQL `where` predicate, that predicate will silently match zero rows
post-encryption (the database holds ciphertext, the comparison value
is plaintext, and no envelope-deterministic encoding is in place).
This is a member of the broader Action Item I class but presents
specifically inside `await phiDb.select().from(table).where(and(...))`
chains rather than as a search endpoint.

**Refactor pattern (verified against Session 3):**

1. **Query by non-encrypted columns only** (`profileId`, `status`,
   timestamps, foreign keys, anything in the
   `phi-column-map.ts` allowlist of plaintext columns).
2. **Decrypt the candidate set** with `decryptPhiRows(tableName, rows)`.
3. **Filter in-memory** on the plaintext values you actually wanted to
   match against.
4. **Document the choice inline** at the call site so a future
   refactorer doesn't reintroduce the SQL predicate.

**Acceptable scope:** small candidate sets (rule of thumb: < 1000
rows). For larger or hot paths, the correct fix is a separate hash
column (deterministic HMAC-SHA-256 of the plaintext, salted with
a hash-only key separate from the encryption key — see Action Item L
F-9 hash key separation), with the SQL predicate matching the hash.

> **Heuristic subject to revision after production telemetry.** The
> < 1000-row threshold is a working estimate based on profile-scoped
> medication candidate sets observed in dev/synthetic data. It is NOT
> a tested production threshold. Once we have production telemetry on
> per-route candidate-set sizes (Phase 2 of the post-launch
> observability rollout), revisit this threshold and either confirm,
> raise, lower, or replace it with a per-route case-by-case rule.

**First documented instance:** `medication-management-routes.ts` ::
`POST /interactions/check` (Session 3, 2026-04-18). The route
originally executed `eq(medicationInteractionFlagsTable.medication1Name,
interaction.medication1Name)` to look up "is there already a pending
flag for this drug pair" — that's a small per-profile candidate set,
so the in-memory filter pattern is appropriate. Inline comment in the
file explains the choice for future maintainers.

**Sequencing:** every time this pattern is found in a Phase 2/3/4
migration, the migrating session should refactor it on the spot using
the steps above and document the new instance in this list (or in a
co-located instances table if the list grows). Do NOT defer — the
broken-by-encryption SQL predicate stays in the file and ships if not
fixed at migration time.

---

## Action Item N — Reconcile drizzle-kit schema drift  🟡

**Status:** PENDING — agent
**Estimated effort:** 30–45 min
**Filed:** Session 2c (post-mortem) — surfaced when `npm run db:push`
hit a non-bypassable interactive rename-detection prompt for the
SECOND time in the F1 program (first occurrence: hash-column add in
Session 1).

### Symptom

Every `npm run db:push` (with or without `--force`) currently halts
on:

```
Is fhir_api_audit_logs table created or renamed from another table?
❯ + fhir_api_audit_logs                      create table
  ~ fasten_connections › fhir_api_audit_logs rename table
  ~ patients › fhir_api_audit_logs           rename table
```

`--force` does not bypass interactive prompts in drizzle-kit; piped
stdin newlines are not consumed by the prompt's TTY reader. Result:
the agent must hand-craft `ALTER TABLE` statements outside the
migration tool, which (1) bypasses drizzle's safety checks, (2)
leaves schema state un-snapshotted, and (3) makes every future
schema change harder, not easier.

### Root cause (suspected)

drizzle-kit's diff engine compares the current `schema.ts` against
the live DB and uses heuristics to detect renames. When historical
tables (`fasten_connections`, `patients`) were dropped without
clearing their migration snapshot entries, drizzle's heuristic
mis-flags new tables with similar column shapes as potential
renames. Until the snapshot history is reconciled with the actual
DB state, every new table or substantive column add will trigger
the same prompt.

### Resolution (proposed)

1. **Audit the migrations folder.** Inventory every file under
   the drizzle-managed migration directory (typically
   `migrations/` or `drizzle/`). Catalog which entries reference
   tables that no longer exist in `shared/schema.ts`.
2. **Snapshot reconciliation.** Either (a) regenerate snapshots
   from the current `schema.ts` against the live DB
   (`drizzle-kit generate` then prune obsolete entries), or
   (b) drop the migrations folder and re-baseline against the
   current DB state. Decision depends on whether any partner /
   reviewer needs an auditable migration log.
3. **Verify clean push.** Run `npm run db:push` and confirm it
   completes without prompts on a no-op diff.
4. **Document the chosen reconciliation pattern** in
   `f1-key-management-strategy.md` (or a new `db-migration-runbook.md`)
   so the next agent doesn't re-discover this from scratch.
5. **Include a brief dropped-table history** in the resolution doc:
   for each table drizzle-kit currently suspects as a rename source
   (today: `fasten_connections`, `patients`), record the table name,
   approximate drop date, and the reason it was dropped (e.g.
   `fasten_connections` was the pre-Medplum FHIR connection table
   replaced by the new partner-account model; `patients` was the
   pre-`patient_identity` denormalized PHI table replaced during the
   Tier-1 encryption split). Without this context, a future engineer
   who sees the rename-detection prompt re-appear (e.g. after a
   schema reshuffle) cannot tell whether to trust the suggestion or
   refuse it.

### Sequencing

Should land BEFORE Action Item L (versioned ciphertext envelope +
hash-column rebuild), because L will require multiple coordinated
schema migrations and cannot tolerate the rename-detection prompt
on every push. Can run concurrent with any Phase 1–4 file-level F1
migration (those don't touch schema).

### Risk if deferred

Each F1 session that needs a schema change will continue to
work around the prompt with hand-crafted `ALTER TABLE` statements,
compounding the snapshot drift and increasing the chance that a
future migration silently does the wrong thing (e.g. accepting a
"rename" suggestion that is actually a destructive drop).

---

## Pending USER asks (non-coding, blocking next sessions)

These are reviewer-flagged user-side items with explicit estimates.
The reviewer has stated they will not direct further coding sessions
until the 11-minute trio is complete.

1. **`"lint": "eslint ."` in `package.json`.** 30 seconds. The agent
   is forbidden by skill rules from editing `package.json` without
   explicit user approval, so user must do this manually.
2. **Neon console PHI row-count check** on `profiles`,
   `patient_identity`, `medications`. 5 minutes. Confirms no real
   patient data is present (gates Action Item H safely).
3. **Neon console multi-role availability check** (Settings → Roles).
   3 minutes. Determines whether `phi_writer` separate role is
   feasible (Phase 2 work).
4. **Auth0 reviewer account** for App Store Apple reviewers.
   Pre-TestFlight blocker.
5. **Auth0 BAA email** to support@auth0.com — required HIPAA
   covered-entity paperwork.
6. **Termly privacy-policy text export** — required for legal pages
   build.
7. **Physician meeting debrief** — one sentence is enough.
8. **Uninsurance DMPO registration** — partner-facing milestone.

---

## Action Item K — extension: helper-wrapper internal logging  🟡

**Filed:** Session 5 close (2026-04-18). Reviewer-directed.

**Retirement mechanism:** Action Item T (custom ESLint rule
`tabula/no-string-form-logger`, shipped Session 6 leverage Item 2) detects
direct `logger.<level>(`backtick`)` and `logger.<level>("a" + b)` patterns
at lint-time. K's helper-wrapper variants (the `console.log(`backtick`)`
inside `logHipaaAudit()` etc.) are NOT yet covered by T's AST matcher —
those need either (a) wrapper migration to call `logger.X` directly so T
catches them, or (b) a second AST rule that matches `console.<method>(`
calls inside files matching `**/audit*.ts` / `**/log*.ts`. Path (a) is
preferred because it eliminates the wrapper's purpose entirely. See
Action Item T § "Phase 2 expansion" for the timing.

### The gap

Several files contain their own `logHipaaAudit()` (or similarly-named)
wrapper functions that internally use `console.log` rather than the
structured pino logger. These wrappers **bypass the PHI redaction
pipeline even after the file itself passes a clean Action Item K grep**
(`grep -nE "console\."` returns 0 hits because the only `console.log`
left lives inside the helper, and the helper looks like a function call
at every site that uses it).

### Why this matters

A `logHipaaAudit({ patientName, mrn, action })` call site looks fine to
the K-pass grep, but the wrapper's body does:

```ts
console.log(`[HIPAA-AUDIT] ${event.action} on patient ${event.patientName} (MRN: ${event.mrn})`);
```

That string-form interpolation:
- Does **not** flow through pino's `redact:` config — the PHI keys
  (`patientName`, `mrn`) are baked into the message string before pino
  ever sees it, so the redaction allow/deny list is irrelevant.
- Does **not** benefit from the object-form spread pattern that lets
  reviewers visually scan the metadata without reading the message.
- **Could leak PHI in audit log output** — the exact scenario Session
  2c's audit-log scrubbing work was supposed to eliminate.
- Contradicts the whole point of the audit-log redaction program.

### Conversion pattern

For each helper wrapper found, convert its internal logging to use the
pino logger via structured object-form calls:

```ts
// before
function logHipaaAudit(event: AuditEvent): void {
  console.log(`[HIPAA-AUDIT] ${event.action} on patient ${event.patientName}`);
}

// after
import { logger } from "../lib/logger"; // path resolves relative

function logHipaaAudit(event: AuditEvent): void {
  logger.info(
    {
      hipaaAudit: true,
      action: event.action,
      patientName: event.patientName,
      mrn: event.mrn,
      profileId: event.profileId,
      // ... any other event fields
    },
    "HIPAA-AUDIT",
  );
}
```

The pino redact list (configured in `server/lib/logger.ts`) will then
strip `patientName`, `mrn`, and other PHI keys at serialization time,
leaving structured non-PHI metadata (action, profileId, timestamp)
intact for compliance auditors.

### First instance

`server/comprehensive-care-plan-routes.ts::logHipaaAudit`, identified
during Session 5 close-out. Out of scope for that session (migration
focus was F1 PHI encryption); filed here for the next pass through that
file or the next session that touches an audit-helper wrapper.

### Estimated effort

5-10 minutes per wrapper. Fast: change the import, swap the
console.log line for an object-form logger call, verify the redact
config covers any new keys, restart and confirm the line renders with
PHI keys redacted.

### Detection grep (run pre-flight on any new file before declaring it K-clean)

```bash
grep -rEn "function (log[A-Z]|audit[A-Z])\w*\(.*\{" server/ | head -20
# then for each match, inspect the function body for console.log
```

### Files to audit (seed list — expand as new instances are found)

| File | Wrapper name | First-found session | Status |
|---|---|---|---|
| `server/comprehensive-care-plan-routes.ts` | `logHipaaAudit` | Session 5 | ⏳ pending |

Append rows as future sessions surface additional wrappers.

---

## Action Item O — Google Analytics placement audit  ✅ RESOLVED

**Filed:** Session 5 close (2026-04-18). Reviewer-directed. **Priority:
before public launch (NOT a TestFlight blocker).**

**Resolved:** Session 5 close (2026-04-18, same session, plus Session 6
follow-up sweep). Full audit confirmed no GA tag firing on any route,
public or authenticated. Latent risks fully eliminated:
- `client/src/lib/firebase.ts` deleted (hardcoded GA4 measurement ID
  `G-P6SGG069J5`, dormant but ambush-shaped — Option A applied).
- `server/services/firebase.ts` deleted (dormant Firestore wrapper that
  also imported `firebase/analytics` and would have throw on first call
  because `FIREBASE_CONFIG` env var is not set — Option A applied
  symmetrically).
- Stale documentation line **"Firebase: Client and server-side SDKs"**
  removed from `replit.md` External Dependencies section. Documentation
  no longer overstates dependency surface.
- `firebase` npm package flagged for user to run `npm uninstall firebase`
  — `package.json` edits require user action per fullstack-js skill
  rules. Verify with `grep -rn "from ['\"]firebase" server/ client/
  --include="*.ts" --include="*.tsx"` → must return zero hits before
  uninstalling.

FTC-fine-level risk (GoodRx pattern) eliminated. Reference: GoodRx
$1.5M FTC settlement, 2023.

**Re-audit cadence:** verify before each public launch or major release
that no new tracker SDKs have been introduced. Re-run on every
`package.json` change, every new `client/public/*.html` addition, and
every new `<script>` tag in `client/index.html`.

**Cleanup steps performed:**
1. `client/src/lib/firebase.ts` deleted (`rm` confirmed).
2. Pre-delete and post-delete grep sweeps across `client/`, `.env*`,
   `package.json`, `README.md`, `replit.md`, and `.local/deliverables/`
   for `firebase/analytics`, `getFirebaseAnalytics`, `G-P6SGG069J5`,
   `measurementId`, `VITE_FIREBASE_*`, and `@/lib/firebase` import
   paths. **Post-delete `client/` sweep: zero hits.** No `.env.example`
   exists; no orphaned env-template references to clean. The only
   remaining doc-level mentions are inside this Action Item O entry
   itself — historical record, not config that re-enables GA.
3. `firebase` package retained in `package.json` (still used by
   `server/services/firebase.ts`; see follow-up note below).
4. Workflow restarted clean. `npm run build` succeeds (only
   pre-existing vite.config.ts ESM/CJS cosmetic warnings, unrelated).
   All 7 `/legal/*` routes return 200.

**Follow-up flagged for separate review (NOT auto-resolved):**
`server/services/firebase.ts` ALSO imports `firebase/analytics` and
`getAnalytics` (lines 1-2), even though the file's exported functions
(`getFirebaseApp`, `getFirebaseDb`) only use Firestore. The
`firebase/analytics` import is unused on the server side and would
no-op at runtime (it requires `window`), but:
- Server-side this file appears to also be dead code: no other
  `server/` file imports `services/firebase`. The Firestore client it
  exposes is never wired up.
- The unused analytics import is misleading scaffolding that mirrors
  the same ambush pattern as the now-deleted client file.
- **Correction to prior characterization:** I had earlier described
  `server/services/firebase.ts` as "FCM messaging." That was wrong —
  it's actually a Firestore client wrapper, also dormant.

**Recommended:** Same Option-A treatment for `server/services/firebase.ts`
(delete entirely; nothing imports it; if Firestore is ever needed
server-side, recreate intentionally with proper PHI-handling review).
**Awaiting user direction** before touching the server file — out of
scope for the originally-approved client-only deletion.

**Re-audit cadence (unchanged from filing):** re-run on every
`package.json` change, every new `client/public/*.html` addition,
every new `<script>` tag in `client/index.html`, and immediately
before the public-launch milestone.

---

## Action Item O — original filing (preserved for audit trail)

### The requirement

Confirm that any Google Analytics tag (or equivalent third-party
analytics SDK — GTM, PostHog, Mixpanel, Amplitude, Hotjar, FullStory,
Heap, Segment, Plausible, Fathom) fires **ONLY** on public marketing
pages (the `tabulamedica.health` homepage and other logged-out routes)
and **NEVER** on any authenticated route. If GA runs on any
authenticated route, **remove it immediately** — it is an FTC-fine-level
HIPAA risk regardless of what the Privacy Policy states.

### Reference

GoodRx $1.5 million FTC settlement, February 2023. The FTC found that
GoodRx's use of pixels and analytics SDKs (Meta Pixel, Google
Analytics) on pages where users could view medication and condition
data constituted unauthorized PHI disclosure to third-party advertising
platforms. The settlement included a permanent ban on sharing health
information for advertising purposes. This precedent applies directly
to any digital-health platform that runs GA (or equivalent) on
authenticated routes.

### First-pass audit results (Session 5, 2026-04-18) — REFERENCE

A pre-emptive audit was run during Session 5 close. **Verdict at that
snapshot: no GA tag fires on any route, public or authenticated.**

Specifics:
- Zero `gtag(...)` calls anywhere in `client/`, `server/`, or any HTML
  file (`client/index.html`, `client/public/*.html`).
- Zero `googletagmanager` / `google-analytics` script tags in the SPA
  shell or the five marketing HTML files.
- Zero third-party analytics SDK packages in `package.json`
  (no PostHog, Mixpanel, Amplitude, Hotjar, FullStory, Heap, Segment,
  Plausible, Fathom).
- Zero `VITE_GA_*` / `GA_MEASUREMENT_*` environment variables.
- Internal terms that look like analytics on grep are not third-party
  trackers:
  - `AdminAnalytics` / `InternalAnalytics` — in-app dashboards
  - `logPermissionTelemetry` — writes to localStorage + in-house
    `POST /api/telemetry/permission`, no external data flow
  - `getAnalyticsPayload` in `data-quality.tsx` — builds JSON for
    in-house `/api/...` endpoints

### Latent risk identified — REQUIRES ACTION before public launch

`client/src/lib/firebase.ts` imports `firebase/analytics` and hard-codes
a GA4 measurement ID (`G-P6SGG069J5`). Today it is **dormant**:
- Zero importers across the entire codebase.
- `getFirebaseAnalytics()` is never invoked.
- Vite tree-shakes unused modules, so the SDK does not ship to the
  production bundle today.

But the file is an **ambush waiting to happen**. Any future engineer
who innocently adds `import { getFirebaseAnalytics } from "@/lib/firebase"`
and calls it would silently start streaming pageview/session events to
GA4 from inside authenticated PHI routes, with no auth-route guard, no
review gate, and no comment warning the file was deliberately gated.

### Resolution options

- **(A) Delete `client/src/lib/firebase.ts` entirely.** Cleanest. Safe
  because nothing imports it. Removes the ambush surface completely.
  Server has its own separate `server/services/firebase.ts` for FCM
  messaging — unrelated.
- **(B) Strip the analytics surface only.** Remove the
  `firebase/analytics` import, the `getFirebaseAnalytics` function, and
  the `measurementId` field; leave only `getFirebaseApp` for future
  Firebase Auth / Firestore use. Add a HIPAA warning comment at the top
  of the file forbidding analytics imports without auth-route gating
  review.
- **(C) Leave as-is and document.** Accept the latent risk; note in the
  threat model and rely on code review to catch any future
  reintroduction.

**Recommended:** Option A. Pending user decision before action is
taken — the audit verdict is "not firing today", which means there is
no urgent removal pressure, but waiting introduces drift risk.

### Re-audit cadence

Re-run the GA audit:
- Whenever `package.json` changes (new dependency could add a
  tracker).
- Whenever a new HTML file is added to `client/public/`.
- Whenever a new `<script>` tag appears in `client/index.html`.
- At minimum, immediately before the public-launch milestone.

### Detection grep (one-shot re-audit)

```bash
grep -rEn "gtag|googletagmanager|google-analytics|GA_MEASUREMENT|G-[A-Z0-9]{6,}|UA-[0-9]{4,}|posthog|mixpanel|amplitude|hotjar|fullstory|heap\.io|plausible|fathom" \
  --include="*.html" --include="*.ts" --include="*.tsx" \
  --include="*.js" --include="*.jsx" --include="*.json" \
  client/ server/ package.json
```

Expected output: only the dormant `firebase.ts` measurementId line
(until it's removed per Option A/B above).

---

## Action Item P — Push notification delivery implementation  🔴 PRE-TESTFLIGHT BLOCKER

**Filed:** Session 6 (2026-04-18). Surfaced during Action Item O
Firebase audit cleanup. Reviewer-classified as pre-TestFlight blocker.

### Finding

Server-side push notification is a **`console.log` stub**.
`server/appointment-reminders.ts::sendPushNotification` returns `true`
without calling any actual push delivery SDK:

```ts
async function sendPushNotification(userId: string, title: string, body: string): Promise<boolean> {
  console.log(`[AppointmentReminders] Push to ${userId}, Title: ${title}`);
  return true;
}
```

Same pattern in `sendSms` (also a console.log stub returning true).

The `unified-notification-service.ts` plumbs `"push"` as a channel type
through type definitions and routing logic, but the delivery hop is a
no-op. **Zero FCM, APN, Expo Push, OneSignal, web-push, or
firebase-admin wiring exists in the codebase.** Verified by exhaustive
grep across `server/` for FCM, `messaging()`, `firebase-admin`,
`@react-native-firebase`, `expo-server-sdk`, `node-apn`,
`@google-cloud/messaging`, `OneSignal`, `expo-notifications`, and
`web-push` patterns — all returned zero hits.

### Impact

- **Medication reminders silently fail to deliver** → patient-safety
  concern for adherence-dependent users. Every missed dose reminder is
  a potential safety event in a health app.
- **Appointment reminders silently fail** → missed appointments, user
  complaints.
- **Care gap alerts silently fail** → preventive care recommendations
  never reach users.
- **App Store reviewer walkthrough will fail if reviewer tests push
  notification features** → guideline rejection risk.
- **Product memory / marketing likely overstates this capability** to
  users → trust / accuracy concern.

### Resolution path (required before TestFlight)

**1. Decide push delivery provider.** Options:

| Option | Pros | Cons | BAA needed |
|---|---|---|---|
| (a) Capacitor Local Notifications | No server, works offline, no BAA, fastest path | On-device scheduled only; no server-triggered events | No |
| (b) Apple Push Notification Service (APN direct) | First-party, lowest fees | Apple-only; certificate setup; you handle delivery infra | Apple does not offer a BAA — keep payloads PHI-free |
| (c) Firebase Cloud Messaging via firebase-admin | Cross-platform; mature SDK | Ironic given this cleanup but valid; Google offers BAA via Workspace | Yes (Google BAA) |
| (d) Expo Push Service | Easy DX | Requires Expo-managed build → conflicts with current Capacitor-bundled approach | No BAA path |
| (e) OneSignal | Commercial, full-featured | Needs BAA for HIPAA; commercial pricing | Yes (OneSignal HIPAA tier) |

**Reviewer recommendation (filed in this entry for ready reference):**
**Phase 1: Capacitor Local Notifications** (medication + appointment
reminders on-device, no server push, no BAA, works offline).
**Phase 2: APN direct or FCM** for server-triggered events (care gap
alerts, shared record access notifications) only after Phase 1 ships.

**2. BAA requirement.** Whichever provider is chosen, signed BAA is
required if push payload contains any PHI (medication names,
appointment details, clinical messages). **Safer pattern: keep push
content generic** ("You have an update — tap to view") and load PHI
inside the authenticated app. This avoids BAA burden for the push
provider AND protects against lock-screen PHI leak (which is its own
HIPAA exposure regardless of provider).

**3. Implementation.** Replace the two stubs in
`server/appointment-reminders.ts` and any other push call sites. Wire
through a single `server/services/push-notification-service.ts` with
provider-agnostic interface so swapping providers later is a one-file
change. Unit tests for happy path + failure path + PHI-redaction of
payload.

**4. Reviewer walkthrough alignment.** If push notifications are NOT
implemented before TestFlight, **remove any mention of them from the
reviewer walkthrough**. Either implement or don't promise. Auditing the
walkthrough for current push claims is part of this action item.

### Sequencing

- **After:** user selects a push provider (user-side decision, not
  agent-side).
- **Before:** TestFlight submission.
- **Estimated effort:** 1-2 sessions depending on provider choice and
  BAA coordination. Apple certificate setup (if APN direct) is
  user-side work and adds 1-3 days waiting on Apple Developer console.

### User action required

**Decide push provider before next Replit session that starts push
work.** Reviewer recommendation above (Capacitor Local Notifications
Phase 1 → APN/FCM Phase 2) is the suggested default but not binding.
Decision can wait until next weekend (not Saturday-urgent), but file
mentally so when we loop back to push implementation, you're ready to
decide.

**Capacitor mode confirmation (added per reviewer note):** Phase 1
Capacitor Local Notifications recommendation assumes Capacitor
**bundled-asset mode**, which the project is already on per
`replit.md` mobile-wrap section. Good fit confirmed — no mode change
needed before Phase 1 implementation.

---

## Action Item Q — AI opt-out feature implementation  🟡 POST-TESTFLIGHT (60-day window)

**Filed:** Session 6 close-out (2026-04-18), at reviewer direction.
**Owner:** agent (after Termly + TestFlight ship).
**Status:** scoped, not yet built.
**Priority:** before any user-reported privacy complaint tests the
promise. Recommend implementing within **60 days of TestFlight
submission**, **before active-user count exceeds ~100 real patients**
(whichever comes first).

### Why this is filed

The Privacy Policy (Termly draft, AI-processing section) promises
that **"users can opt out of AI-based processing at any time."**
This is a binding statement under both:

- Termly's published policy (once we paste it into `/legal/privacy`)
- HIPAA Notice of Privacy Practices reasonable-expectation principle
- General consumer-protection (FTC) deceptive-practice exposure if
  the promise isn't honored mechanically

**Today the implementation does not exist.** AI features
(drug-interaction analysis, SOAP-note generation, translation,
summarization, anything that hits Vertex AI / OpenAI route handlers)
run unconditionally for every authenticated user. There is no user
preference, no middleware check, no settings toggle.

This is **not a TestFlight blocker** — Apple reviewers do not test
opt-out mechanics on consent claims. But it **is** a real-patient
blocker the moment a user reads the Privacy Policy and asks for the
toggle. Filing now so it does not get lost in post-TestFlight
celebration drift.

### Scope (1-session estimate)

1. **Schema:** add `aiProcessingEnabled: boolean('ai_processing_enabled').notNull().default(true)`
   to the user-preferences table in `shared/schema.ts`. Default
   `true` preserves current behavior for existing users; opt-out is
   user-initiated.
2. **Middleware:** new `requireAIConsent` middleware in
   `server/middleware/` that reads the authenticated user's
   preference row and short-circuits with HTTP 403 + structured
   error code `AI_PROCESSING_DISABLED` if disabled. Apply to every
   AI-invoking route. Inventory required (likely candidates):
   - drug-interaction analysis routes
   - SOAP-note generation routes
   - translation/summarization routes
   - any Vertex AI or OpenAI passthrough endpoint
3. **Frontend handling:** AI-feature components catch the
   `AI_PROCESSING_DISABLED` response and render a clear unavailable
   state with a one-click link to the settings toggle, NOT a generic
   error toast.
4. **Settings toggle:** `client/src/pages/account-settings.tsx`
   (or wherever preferences live) gets a clearly-labeled section:
   > **AI features**
   > AI helps you understand your records and check for medication
   > interactions, but you can turn it off at any time. When off,
   > AI-powered features will be unavailable but all other app
   > functionality continues to work.
   > [Toggle]
5. **Telemetry:** add a count metric for users with AI disabled.
   Useful for product decisions (if 30%+ disable, the AI value-prop
   isn't landing; if 1% disable, the toggle is just a compliance
   safety net). No PHI in the metric — just an aggregate count.
6. **Tests:**
   - Unit: middleware blocks when disabled, passes when enabled
   - E2E: toggle off → drug-interaction page shows unavailable state
     → toggle on → page works
   - Smoke: Privacy Policy AI-section claim reconciles with actual
     toggle existence (manual checklist item, not automated)

### Deliberately deferred to next session (NOT today)

- AI-route inventory (need to walk every `server/*-routes.ts` for
  Vertex/OpenAI calls — easily 30 minutes alone)
- Telemetry pipeline decision (existing pino structured-log channel
  vs. dedicated metric — depends on what monitoring stack we have
  by then; may have moved off pure-pino by post-TestFlight)
- Migration sequencing for the new preference column — needs to
  coordinate with Action Item N (drizzle-kit drift reconcile)
- Whether the toggle should also revoke past AI-derived inferences
  cached in the DB (probably no; opt-out is forward-looking, but
  worth confirming with legal counsel before shipping)

### Sequencing

1. Termly content paste-in (next session, blocks TestFlight)
2. TestFlight submission (user-driven on USER's open items)
3. **Action Item Q implementation** (within 60 days post-TestFlight)
4. Action Items H + L + N (encryption envelope work) can interleave
   but Q has the user-promise pressure, so Q goes first

### Connection to other action items

- **Action Item I (encryption-search audit):** if `aiProcessingEnabled`
  is ever queried with `eq()`, the column should NOT be encrypted —
  it's a non-PHI configuration flag. Trivial, but worth noting so
  future encryption sweeps don't accidentally encrypt it and break
  the middleware lookup.
- **Action Item N (drizzle drift):** the new column will appear in
  the next `db:push` and will trigger the rename-detection prompt
  if N isn't resolved first. Sequence N before Q's schema change.

---

## Action Item R — Cookie consent banner and preference center  🟡 POST-TESTFLIGHT (pre-EU-scale, pre-analytics)

**Filed:** Session 6 close-out (2026-04-18), at reviewer direction
following Cookie Policy URL audit + LegalFooter cookie-link addition.
**Owner:** agent (after Termly + TestFlight ship; sequenced with O cadence).
**Status:** scoped, not yet built.
**Priority:** POST-TESTFLIGHT, with three specific triggers (any one
of which advances priority to "must ship before crossing this line"):

1. Before launching any **EU-targeted marketing**
2. Before adding any **non-essential cookie or third-party tracker**
   (ties directly to Action Item O cadence — re-introducing analytics
   after the Firebase cleanup means consent infrastructure first)
3. Before exceeding **~1,000 active users** (Virginia VCDPA threshold
   for consumer data controllers — Tabula Medica's home state)

### Why this is filed now (not later)

Today's exposure is genuinely low because the Session 6 audit
confirmed Tabula Medica runs **zero non-essential cookies**:

| Cookie | Purpose | Consent required? |
|---|---|---|
| `connect.sid` | Session auth | NO — strictly necessary (GDPR Art 6(1)(b)/(f)) |
| CSRF token | Security | NO — strictly necessary |
| `sidebar_state` | UI preference | Arguable — typically considered functional, low-risk |

No marketing cookies. No tracking pixels. No third-party analytics
(post-O cleanup). This is the **best possible posture** for not
needing a consent banner *today*.

But this posture is **fragile.** The moment any of the following lands,
banner-or-bust:

- Mixpanel / PostHog / Amplitude / Heap (product analytics)
- Hotjar / FullStory / LogRocket (session replay — also PHI risk)
- Google Tag Manager / Meta Pixel (marketing attribution)
- Re-introduction of GA4 (the Action Item O class of risk)
- Stripe Sift / fraud-detection cookies (third-party tracking)
- Intercom / Drift / Crisp (chat widgets that drop tracking cookies)

Filing now so the consent-banner gate is **already on the radar** when
any future product/marketing decision considers these tools. The
pattern Action Item O caught (latent GA4 measurement ID sitting
dormant in `firebase.ts`, ready to fire on first analytics import) is
exactly the failure mode this gate prevents.

### Regulatory framing

| Regime | Tabula Medica exposure | Banner requirement triggered when |
|---|---|---|
| **Virginia VCDPA** (home state) | Direct — health data is "sensitive personal data" | >100K consumers in 12 months OR derives >50% revenue from sale of personal data; lower bar for sensitive data processing consent UX |
| **GDPR + ePrivacy Directive** (EU) | Indirect today; direct on first EU signup | ANY non-essential cookie + ANY EU user. ePrivacy is per-user, not per-volume |
| **CCPA / CPRA** (California) | Direct — health data triggers heightened protections | Threshold-based for full applicability, but **"Do Not Sell or Share My Personal Information"** link required at any volume if selling/sharing |
| **App Tracking Transparency (Apple)** | Direct on iOS submission | Any tracking across apps/sites — separate flow from cookie banner but adjacent consent UX |

Per-Termly cookie policy will note the "we don't use non-essential
cookies" posture; the banner is the enforcement mechanism that keeps
that posture honest.

### Scope (1–2 sessions when work begins)

1. **Consent banner component** (first-visit, persisted)
   - Accept All / Reject All / Customize options — three buttons,
     equal visual weight (GDPR Art 7: consent must be freely given,
     so "Reject" cannot be visually subordinate to "Accept")
   - Plain-language category explanations (one sentence each)
   - **Honor Global Privacy Control (GPC) signal**: if the browser
     sends `Sec-GPC: 1`, the banner pre-selects Reject across
     non-essential categories and respects that choice without
     requiring further interaction. Termly cookie policy already
     promises GPC honor — this is the implementation hook
   - Stored in `localStorage` (NOT a cookie — meta-cookie problem)
   - Re-prompt after 12 months (standard practice; aligns with
     ICO and CNIL guidance)

2. **Preference center** (always-accessible from footer)
   - Toggle switches per category:
     - **Strictly Necessary** (always on, disabled toggle, explained)
     - **Functional** (default off; sidebar_state would live here)
     - **Performance/Analytics** (default off)
     - **Marketing** (default off)
   - Last-saved preferences displayed with timestamp
   - "Reset to defaults" button
   - Footer link: `link-legal-cookie-preferences` (separate from
     `link-legal-cookie` which goes to the policy text)

3. **"Do Not Sell or Share My Personal Information" link** in footer
   - Required by CCPA/CPRA at any volume for California users
   - Can route to preference center or dedicated CCPA intake form;
     decision deferred to implementation session
   - Even though Tabula Medica doesn't sell data, the link is
     required to be present — its absence is itself a violation

4. **Cookie auto-blocking pre-consent**
   - Non-essential cookies blocked until user consents
   - Requires cookie inventory and tag-loading discipline (no
     direct `<script>` tags for analytics — must route through a
     consent-aware loader)
   - Lower risk today (no non-essential cookies), but the loader
     pattern must be in place before any analytics tool is added,
     so building it WITH the banner makes sense

5. **Termly CMP vs custom build decision**
   - Termly offers a Consent Management Platform at paid tiers
     ($15–$49/month depending on plan)
   - Pros (Termly CMP): regulatory updates handled, IAB TCF v2.2
     compliance built-in, less code to maintain
   - Pros (custom): no recurring cost, full UX control, no
     third-party script loading on every page (which is itself
     ironic for a privacy banner), no vendor lock-in
   - Decision deferred to implementation session — both viable

6. **Persistence + audit trail**
   - Consent record (categories accepted, timestamp, GPC state,
     banner version) stored locally + optionally synced to backend
     for HIPAA-grade audit trail
   - User can export their consent history (GDPR Art 15 right of
     access touches this)

### Deliberately deferred to implementation session

- Termly-CMP-vs-custom decision (depends on Termly plan tier the
  user has at that point, and whether iAB TCF compliance is needed
  for any ad-network integration that may be on the table)
- Whether CCPA "Do Not Sell" link routes to preference center or
  dedicated form (depends on volume of CCPA requests at that point)
- Backend audit-trail design (whether to log consent records to
  the same audit channel as PHI access events, or separate channel)
- Mobile-app native consent UX vs web banner (Capacitor wraps web,
  so web banner shows in-app; but Apple ATT prompt is separate)

### Sequencing

1. Termly content paste-in (next session, blocks TestFlight)
2. TestFlight submission (user-driven on USER's open items)
3. Action Item Q (AI opt-out, 60-day post-TestFlight window)
4. **Action Item R implementation** — must precede:
   - any analytics/tracking tool re-introduction (Action Item O cadence)
   - any EU marketing launch
   - ~1,000-active-user threshold
5. Action Items H + L + N (encryption envelope work) interleave on
   their own track

### Connection to other action items

- **Action Item O (analytics audit, RESOLVED):** the consent banner
  is the **structural gate** that prevents O-class regressions. After
  R ships, any future analytics tool can only fire post-consent,
  which means even if a `firebase.ts`-style dormant import lands
  again, it can't actually call home without explicit user consent.
  R is the durable fix; O was the cleanup.
- **Action Item Q (AI opt-out):** R's preference center is the
  natural home for Q's AI-processing toggle too. When R is built,
  retrofit Q's `aiProcessingEnabled` flag into the same preference
  surface — single settings page covers both consent contexts. This
  is a session-saver: build R's UI scaffolding once, attach Q's
  toggle to it, ~30 minutes saved on Q.
- **Termly Cookie Policy (pending paste-in):** the policy text
  (once Termly delivers) will reference the banner and preference
  center as the user-facing controls. R must ship within reasonable
  time of policy publication, otherwise the Cookie Policy describes
  controls that don't exist — same trust-gap pattern as Q.

### Estimate

**1–2 sessions** depending on Termly-CMP-vs-custom decision:
- Termly CMP integration: ~1 session (drop-in script + footer link
  + preference-center wiring)
- Custom build: ~2 sessions (banner UI + preference center + GPC
  detection + consent loader + tests)

Tied to the Termly subscription tier the user holds at that point
($15–$49/month for CMP feature).

---

## Action Item S — CI pipeline scaffold  ✅ RESOLVED (Session 6, leverage Item 1)

**Filed:** Session 6 (2026-04-18), at reviewer release of three-leverage queue.
**Owner:** agent.
**Status:** ✅ RESOLVED — `.github/workflows/ci.yml` shipped with 3 jobs.
**Discovery context:** existing `pr-security-check.yml` and `soc2-deploy.yml`
already in repo; new file complements them per Decision Option B
(separate dev-loop CI from SOC2/security gates). Different audiences,
different cadences, unambiguous failure signals.

### Workflow surface

**File:** `.github/workflows/ci.yml`
**Triggers:** `push: branches: [main]` AND `pull_request: branches: [main]`
— closes the direct-to-main bypass that `pr-security-check.yml`
(PR-only) leaves open for Saturday agent commits.

**Jobs:**

| Job | Command | Severity | Notes |
|---|---|---|---|
| typecheck | `npm run check` (`tsc`) | 🔴 hard-fail | Duplicates pr-security-check.yml typecheck — acceptable; redundant coverage beats missed coverage on direct-to-main path |
| lint | `npm run lint` if script present | 🟡 soft-fail (`continue-on-error: true`) + skip-with-warning if script missing | Will hard-fail upgrade after Action Item T retires Action Item K |
| build | `npm run build` (esbuild via `script/build.ts`) | 🔴 hard-fail | Native build, NOT Docker — complements `pr-security-check.yml::build-verify` which builds the container |

### Open follow-ups linked from this resolution

- **USER task** — add `"lint": "eslint ."` to `package.json` scripts.
  Currently on standing user-side ask list. Until added, lint job
  emits a graceful warning and skips. No CI red.
- **Action Item V** — vitest runner health + test job integration
  (filed below). Test job intentionally NOT in S; deferred to V to
  avoid red-CI-from-infrastructure-noise antipattern.
- **Action Item W** — extend `pr-security-check.yml` triggers to
  cover direct-to-main (filed below). Coverage gap on the SOC2/SAST
  side that S only partially closes.
- **Action Item T** — logger rule severity upgrade (warn → error).
  S's lint job soft-fail is the holding pattern until T flips.

### Verification

- File created and committed.
- Workflow YAML syntax valid (will be confirmed on first GitHub
  Actions run).
- Local `npm run check` passes (last verified Session 6).
- Local `npm run build` passes (last verified after Firebase
  uninstall, Session 6 — 2.2s, only pre-existing vite.config.ts
  ESM/CJS cosmetic warnings).

---

## Action Item V — Vitest test runner health check + CI test integration  🟡 NEXT-SESSION (1 session, ≤2 hour timebox)

**Filed:** Session 6 (2026-04-18), at reviewer direction during Item 1
CI scaffold work.
**Owner:** agent.
**Status:** PENDING.
**Priority:** **Before Action Item T** (logger rule hard-fail upgrade)
— can't enforce regression protection in CI if the test suite isn't
runnable.

### Finding

`package.json` has no `"test"` script. Smoke-running
`tests/logger-redact.spec.ts` via `npx vitest run` errored out in
vite's module runner before tests executed (`ServerModuleRunner.import`
chain failure during `loadCustomReporterModule`). The 23 ciphertext
fixtures, the 14 audit-action-validator unit tests, and the
logger-redact tests may all be in the same blocked state.

The test files exist (`tests/audit-action-validator.spec.ts`,
`tests/logger-redact.spec.ts`, `tests/phi-storage.spec.ts`). Vitest
config exists (`vitest.config.ts` with proper `@shared` alias). What's
broken is the runner invocation — likely a path-alias resolution
issue, a missing config piece, or a dep mismatch surfaced by recent
package activity (firebase uninstall doesn't touch vitest, but
`npm install` runs since then could have shifted resolver behavior).

### Resolution scope

1. **Investigate the vite module-runner startup error.** Likely
   suspects: vitest version mismatch, vite plugin incompatibility,
   `tsx` interop, or path-alias chain (`@shared`, `@assets`, `@`)
   not all wired into vitest config.
2. **Add `"test": "vitest run"` and `"test:watch": "vitest"` to
   `package.json` scripts.** USER task (per package.json edit
   prohibition); agent will draft exact lines and request user-side
   add.
3. **Verify each existing test file runs:**
   - `tests/logger-redact.spec.ts`
   - `tests/phi-storage.spec.ts` (23 ciphertext fixtures)
   - `tests/audit-action-validator.spec.ts` (14 validator tests)
4. **Fix any test failures surfaced** — only re-enabling existing
   coverage, not writing new tests.
5. **Add `test` job to `.github/workflows/ci.yml`** once suite is
   green locally. Hard-fail on test failures.

### Timebox

**1 session, capped at 2 hours.** If runner debugging exceeds 2
hours, scope down to smallest passing subset and file the remainder
as V-extension. Do NOT let this become a 4-hour rabbit hole — the
75% leverage (typecheck + build + native CI) is already captured by
Action Item S regardless.

### Connection to other action items

- **Action Item S (CI scaffold, RESOLVED):** S deliberately omits
  test job; V completes the picture.
- **Action Item T (logger rule severity upgrade):** T cannot ship
  until V is RESOLVED (need test enforcement before flipping the
  rule from warn to error).
- **Action Item J (PHI fixture coverage 23/40):** the 17 missing
  fixtures should be added AFTER V resolves the runner — no point
  writing fixtures into a broken runner.

---

## Action Item W — Extend security-gate coverage to direct-to-main commits  🟡 BEFORE PUBLIC LAUNCH (30–60 min)

**Filed:** Session 6 (2026-04-18), surfaced during Item 1 CI scaffold
discovery.
**Owner:** agent.
**Status:** PENDING.
**Priority:** **Before public launch** (TestFlight is internal-only,
so not a TestFlight blocker; becomes blocker for App Store public
release).

### Finding

`.github/workflows/pr-security-check.yml` triggers ONLY on
`pull_request: branches: [main]`. Every direct-to-main commit
(including the entire 2026 Saturday Replit-agent cadence — Sessions
1–6 inclusive — and every reviewer-approved direct merge) bypasses:

- SOC2 PR audit metadata recording
- Semgrep SAST (`p/owasp-top-ten`, `p/secrets`, etc.)
- TruffleHog secret scan (verified-only)
- Hadolint Dockerfile lint
- Trivy container vulnerability scan
- npm audit + audit-ci dependency vulnerability scan

For a HIPAA-class project with active direct-to-main cadence, this
is a real coverage blind spot. SOC2 audit completeness in particular
depends on the metadata capture step running on every change to main,
not just PR-mediated changes.

### Decision scope

Two viable approaches — implementer (likely future me) picks at
implementation time:

**Option A — Extend triggers in place:**
Add `push: branches: [main]` to `pr-security-check.yml` triggers.
Single-file change. Simplest. Risk: PR-context steps (e.g., the
`pr-metadata` job uses `${{ github.event.pull_request.* }}`) need
fallback for push events where `pull_request` is undefined.

**Option B — Restructure into separate security-on-push workflow:**
New `.github/workflows/security-on-push.yml` that runs the same
security/SAST/audit jobs but on push only. Cleaner separation;
PR-context steps stay PR-only. More files to maintain.

Recommendation deferred until implementation. Option A is faster;
Option B is cleaner.

### Estimate

**30–60 minutes** depending on which option is chosen and how many
PR-context steps need fallback handling.

### Sequencing

- AFTER Action Items S + V (CI scaffold + test runner): security
  gates piggybacking on a healthy CI is easier than retrofitting
  later.
- BEFORE App Store public launch: SOC2 audit coverage cannot have
  a known direct-to-main blind spot at scale.
- Independent of Termly / TestFlight / push provider tracks.

### Connection to other action items

- **Action Item S (CI scaffold, RESOLVED):** S closed the
  typecheck/build/lint blind spot for direct-to-main. W closes the
  security/SAST/audit blind spot. Both are needed for full coverage.
- **Action Item O (RESOLVED, Firebase analytics audit):** if the
  dormant-import pattern recurs (e.g., a dev installs Mixpanel
  thinking it's harmless), the SAST scan SHOULD catch it — but only
  if SAST runs on the merge that introduces it. W ensures it does.

---

## Action Item T — Logger rule severity upgrade (warn → error)  🟡 ACTIVE AS WARN

**Filed:** Session 6 close (2026-04-18). Leverage queue Item 2.
**Status:** ✅ SHIPPED AS WARN. Upgrade trigger pending.

### What shipped

Custom ESLint rule `tabula/no-string-form-logger` defined in
`eslint-rules/no-string-form-logger.js`, registered in `eslint.config.js`
under the `server/**/*.ts` files block, severity `warn`.

**Detection (AST-based, no false positives confirmed):**
- Receiver: literal `Identifier` named `logger` (chained `.child(...)` and
  aliased loggers explicitly out of v1 scope — see Phase 2 below)
- Method: one of `info | warn | error | debug | fatal | trace`
- First arg type:
  - `TemplateLiteral` with ≥1 `${expression}` (pure-string templates with
    zero interpolations are SAFE and intentionally not flagged — they
    are equivalent to a string `Literal` from pino's perspective)
  - `BinaryExpression` with `+` operator (string concat at any depth)

**Message:** Includes the offending level + extracted variable hints from
the template (up to 3) so the developer sees exactly what to move into
the context object. Example output observed during verification:

```
[F1/T] String-form logger call bypasses pino redaction — PHI in ${{}}
interpolations is logged in plaintext. Move all variables into the
first-arg object: logger.error({ method, path, statusCode }, "static message")
```

**Exemptions:** `tests/**/*.ts` is `off` (test diagnostics may legitimately
string-format; PHI never flows through tests). `phi-storage.ts` and
`scripts/check-phi-db-access.ts` keep their existing PHI-rule exemption
but have no special exemption for the logger rule (they should object-form
log too).

**Verification (Session 6 close):**
- Migrated file `server/comprehensive-care-plan-routes.ts`: 0 logger
  warnings (3 unrelated TS findings — `no-unsafe-function-type`,
  `prefer-const` — out of scope of T)
- Unmigrated file `server/services/patient-engagement-service.ts`: 0
  logger warnings (file uses `console.*` not `logger.*` — within Action
  Item K scope, not T scope)
- Real-world hit: `server/security/tls-middleware.ts` lines 181/183/185
  — three template-literal `logger.error/warn/debug` calls correctly
  flagged with variable hints `method, path, statusCode`
- `npm run build`: exit 0
- CI lint job (S, shipped same session): picks up the rule automatically
  via `npm run check` — wait, that's typecheck. Lint job picks it up via
  `npm run lint` once the user adds that script. **Until then T's
  warnings are visible only via `npx eslint server/**/*.ts` locally.**

### Upgrade trigger (warn → error)

Flip severity from `warn` to `error` in `eslint.config.js` AND flip
`continue-on-error: true` → `false` on the lint job in
`.github/workflows/ci.yml` **only when ALL of the following are true**:

1. **Zero direct hits remain.** Verify with:
   ```bash
   npx eslint server --rule '{"tabula/no-string-form-logger":"error"}' \
                    --rule '{"no-restricted-syntax":"off"}' \
                    --no-warn-ignored 2>&1 | grep -c "no-string-form-logger"
   ```
   Must return `0`. The PHI rule is temporarily disabled in this run so
   pre-existing PHI errors don't mask the count.

2. **Action Item V (vitest runner) is RESOLVED.** Reason: a green test
   suite is required before tightening any CI gate, otherwise a flaky
   runner combined with a hard-fail lint creates two compounding failure
   modes that are hard to triage.

3. **Action Item K (console.* migration) is fully retired** for direct
   call sites. K-extension wrapper variants are tracked under T Phase 2
   below — they do NOT block the warn→error flip for direct calls.

### Phase 2 expansion (deferred, post-warn→error flip)

Add a second AST rule (or extend this one) to catch the K-extension
patterns:
- `console.<method>(` inside files matching `server/**/audit*.ts`,
  `server/**/log*.ts`, `server/**/*-logger.ts`, `server/services/audit*`
- Match `Literal` string args containing `[HIPAA-AUDIT]`, `[AUDIT]`,
  `[PHI]` prefixes (heuristic — these are the tell-tale wrapper outputs)

Phase 2 is gated behind: (a) the warn→error flip on Phase 1, AND (b)
either (i) wrapper migration completing — preferred, eliminates the
need entirely — or (ii) explicit reviewer go-ahead to ship the second
AST rule independently.

### Connection to other action items

- **Action Item K (console.* migration):** T is K's editor-time
  enforcement layer for the `logger.X` half. K's `console.X` half stays
  with K. Once K's direct-call grep returns 0 AND T's logger grep
  returns 0, the entire string-form logging vector is closed at the
  AST level for direct calls. K-extension wrapper variants then become
  the only remaining attack surface, addressed by T Phase 2.
- **Action Item S (CI scaffold, RESOLVED):** S's lint job is currently
  `continue-on-error: true`. T's warn→error trigger is the explicit
  signal to flip that flag to `false`. The flip is a single-line
  change in `ci.yml` (line 67 in the current revision).
- **Action Item V (vitest runner):** Hard prerequisite for the
  warn→error flip. See trigger 2.

---

## Action Item U — Accessibility remediation (post-audit)  🟡 PARTIAL TESTFLIGHT BLOCKER

**Filed:** Session 6 close (2026-04-18). Leverage queue Item 3.
**Audit document:** `.local/deliverables/accessibility-audit-session-6.md`

### Audit summary

5 routes audited (`/`, `/medications`, `/collaborative-care-plans`,
`/my-health-record`, `/appointments`) via static analysis. 18 findings:
1 critical (app-wide), 6 serious, 8 moderate, 3 minor. Methodology
limitations explicit: no axe-core runtime scan (Auth0 reviewer account
not yet issued), no iPhone SE device emulator, no Chrome DevTools
post-blur contrast sampling. Static-analysis findings are
high-confidence; runtime-confirmation findings are flagged separately.

### Top 5 findings (severity-ranked)

1. **Button base tap targets fail iOS 44pt HIG** — `client/src/components/ui/button.tsx:28-33`. Default 36px, sm 32px, lg 40px, icon 36×36. CRITICAL. App-wide. Pre-TestFlight. ~3hr code+QA.
2. **`prefers-reduced-transparency` not honored** — `client/src/components/accessibility-provider.tsx:36-57`. iOS-level Reduce Transparency setting not auto-mirrored to in-app `reducedTransparency` toggle. SERIOUS. Pre-TestFlight. ~20min.
3. **`--muted-foreground` token at 5.04:1 contrast** — `client/src/index.css:51`. Borderline AA, fails AAA. Used app-wide on `text-xs`. SERIOUS. Pre-public-launch. ~15min + ripple analysis.
4. **Broken `/health-dashboard` link on Dashboard** — `client/src/pages/dashboard.tsx:218`. Route not in App.tsx routing table. MODERATE. Pre-public-launch. ~5min.
5. **Landing nav text-over-hero at `bg-background/60`** — `client/src/pages/landing.tsx:253`. Post-blur effective contrast not measurable from static analysis. MODERATE. Pre-public-launch (low risk — not TestFlight reviewer entry point). ~10min once measurement available.

### Priority breakdown

- **WCAG AA critical violations → before TestFlight:** Findings 1 + 2 only. Findings 1 and 2 are deterministic from source code; both ship without needing runtime axe confirmation. Total ~3.5 hours.
- **Pre-public-launch:** Findings 3, 4, 5 + the ~5–6 hours of post-axe-scan findings on the 3 routes that were not deep-read in this session.
- **Post-public-launch:** Anything surfaced by future runtime axe + screen-reader passes.

### Total estimate

- **Critical-path (pre-TestFlight):** ~3.5 hours
- **Full pre-public-launch:** ~5 hours additional
- **Long-tail (post-launch backlog):** ~6 hours after Auth0 reviewer
  account lands and runtime axe scan completes

**Total audit + remediation:** ~14 hours of dev work spread across
TestFlight prep, public launch prep, and post-launch maintenance.

### Standing dependencies surfaced by audit

1. **Auth0 reviewer-test account** (already a standing user ask from
   Session 4). Gates the runtime axe-core scan.
2. **iPhone SE device or Chrome DevTools device-toolbar access.** Gates
   real-device layout testing for Part B of the audit.
3. **Chrome DevTools Accessibility tab.** Gates post-blur contrast
   sampling for the 2 medium-risk Liquid Glass surfaces in Part C.

None of these block the critical-path work (Findings 1 + 2) — those
are deterministic and TestFlight-ready without runtime verification.

### Connection to other action items

- **Standing user ask (Auth0 reviewer account, Session 4):** Direct
  gating dependency for runtime audit completion.
- **Action Item S (CI scaffold, RESOLVED):** A future axe-CI integration
  could extend ci.yml with an `accessibility` job once the Auth0 flow is
  scriptable. Out of scope for U; flagged for downstream consideration.
- **Action Item X (LegalDocument styling, deferred):** Legal-pages
  content-paste session must apply WCAG AA contrast to the LegalDocument
  component. U's Finding 3 (muted-foreground token tweak) directly
  reduces the work X would otherwise need to do for prose contrast.

---

## Action Item X — LegalDocument component production styling  🟡 DEFERRED

**Filed:** Session 6 close (2026-04-18). Reviewer-directed pre-emptive filing.
**Status:** WAITING ON DEPENDENCY (Termly content delivery from user).

### Why filed now (not started)

Reviewer drafted a comprehensive LegalDocument styling directive in a
prior message. Per directive: "Don't start that work now. File it as
planned Action Item X, wait until Termly content is delivered." This
filing exists so the directive doesn't get lost when the Termly content
finally arrives and the legal-pages content-paste session begins.

### Trigger

Termly delivers the content for the 7 legal pages
(`/legal/privacy`, `/legal/terms`, `/legal/cookie`, `/legal/disclaimer`,
`/legal/accessibility`, `/legal/hipaa-notice`, `/legal/care-access-privacy`).
Currently all 7 routes return 200 with placeholder content per Session 5
verification. Once Termly delivers, the content-paste session begins.

### Scope (per reviewer directive, full text preserved for handoff)

- **Brand color:** `#0D9488` (teal) for accent surfaces, links, headings
  where appropriate
- **Typography:** system-ui stack (consistent with rest of app)
- **WCAG AA contrast minimum** for all body text (4.5:1 normal, 3:1 large)
- **Print-friendly CSS** — `@media print` rules: hide nav, hide footer
  CTAs, ensure prose flows cleanly, force black-on-white text, page
  break hints between sections
- **375px iPhone SE support** — no horizontal overflow, prose readable
  at 375px viewport without zoom
- Legal-document-specific patterns: numbered/lettered section
  hierarchy, defined-term emphasis, table-of-contents anchor links,
  "last updated" timestamp prominent, version number visible

### Bundling

NOT a standalone session. Bundles INTO the legal-page content-paste
session as ~30–60 min of additional styling work on top of the
content-paste itself. Reviewer expectation: same session, one
deliverable.

### Estimate

30–60 minutes additional on top of legal content paste (which itself
is ~1–2 hours depending on Termly content depth and number of
custom-per-page edits needed).

### Connection to other action items

- **Action Item U (a11y remediation):** U's Finding 3 (`--muted-foreground`
  token tweak from 5.04:1 → 6.2:1) directly improves prose contrast on
  the legal pages. If U Finding 3 ships before X, X's contrast work is
  already half done at the token level.
- **Action Item R (cookie consent banner):** R's banner content references
  `/legal/cookie`. X's styling makes that linked destination presentable
  enough to not undercut R's UX investment.
- **No dependency on T, V, W, S** — X is purely UI styling, untouched
  by lint/test/CI/security tracks.

---

## Action Item Y — Transition CI lint from Strategy D to Strategy C  🟡 DEFERRED (post-F1)

**Filed:** 2026-04-20 (Session 7).
**Trigger:** F1 PHI guardrail backlog reaches 0 (`no-restricted-syntax`
violation count = 0 across `server/**/*.ts`).
**Estimate:** 30–45 minutes (config edits + verification).
**Severity:** 🟡 deferred — quality-of-life CI hardening, not a
TestFlight or launch blocker.

### Background

Session 7 conducted a full repo-wide lint scan (1,131 files, 87 with
issues) producing the following baseline:

| Rule | err |
|---|---:|
| `no-restricted-syntax` (PHI guardrail) | 102 |
| `prefer-const` | 71 |
| `@typescript-eslint/no-unused-vars` | 50 |
| `@typescript-eslint/no-explicit-any` | 47 |
| `@typescript-eslint/no-unsafe-function-type` | 10 |
| `@typescript-eslint/no-require-imports` | 3 |
| `tabula/no-string-form-logger` | 0 (T promoted, all sites cleaned) |
| **TOTAL** | **283 errors, 0 warnings** |

The 102 `no-restricted-syntax` errors ARE the F1 program — each F1
file shipped reduces this number, expected to reach 0 in ~3-4 more
F1 sessions.

The remaining 181 errors are pre-existing TypeScript noise outside
`server/**/*.ts` (the existing eslint config silences these rules
ONLY within the server scope; outside that scope they fire). These
are not new debt — they are pre-existing bookkeeping that was never
gated.

Four CI strategies were considered (A: strict everywhere; B: extend
silencing repo-wide; C: strict only on actively-guarded rules; D:
status quo `continue-on-error: true`). User selected **D for now,
C later** to avoid blocking F1 throughput on cleanup work.

### Trigger condition

Run the breakdown command and confirm:

```sh
npx eslint . --no-fix --format=json 2>/dev/null \
  | node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8'));let n=0;for(const f of r)for(const m of f.messages)if(m.ruleId==='no-restricted-syntax')n++;console.log(n);"
```

When this prints `0`, the F1 PHI guardrail backlog is cleared and Y
becomes actionable.

### Action when triggered

1. **Edit `.github/workflows/ci.yml`** — flip the `lint` job's
   `continue-on-error: true` to `false`. Update the comment block
   above the job to reflect the new strict-enforcement posture.
2. **Add a rule-filtered second lint step** (or a separate `lint-strict`
   job) that runs only the actively-guarded rules:
   ```sh
   npx eslint server --rule '{"no-restricted-syntax": "error", "tabula/no-string-form-logger": "error"}' --no-eslintrc-rules
   ```
   (Exact flag syntax to be verified against ESLint 10 at trigger time;
   alternative is a dedicated `eslint.strict.config.js` extending the
   main config with only those two rules enabled.)
3. **Leave the 181 non-server-scope TS noise errors visible-but-non-blocking** —
   the general lint job continues to surface them as CI annotations
   without blocking merges. This preserves long-term code quality
   signal without creating cleanup pressure.
4. **Update `replit.md` Codebase Topology section or add a CI section** —
   document that lint is now strict for actively-guarded rules.
5. **Verify** — push a deliberate string-form logger violation in a
   throwaway branch, confirm CI hard-fails. Revert.
6. **Mark this action item ✅ RESOLVED** with the resolution date and
   the F1 session number that finally cleared `no-restricted-syntax`.

### Connection to other action items

- **Action Item T (logger rule warn → error):** prerequisite. ✅ resolved
  Session 7 — T promotion + 3-site cleanup in `tls-middleware.ts`.
- **Action Item V (vitest runner health check):** prerequisite. ✅ resolved
  Session 7 — vitest runs clean, 72/72 tests pass, foundation laid.
- **Action Item S (CI pipeline scaffold):** Y is the natural successor to
  S — S established the lint job in soft-fail mode; Y promotes it to
  hard-fail once the F1 backlog clears.
- **Action Item W (security gates → direct-to-main coverage):** independent
  of Y; W and Y can land in either order.
- **Action Item K (stale string-form logger conversions):** indirect link —
  K's cleanup of legacy logger calls reduces the chance that any new
  T-rule violations reappear during F1 throughput, keeping the count
  at 0 once Y goes strict.

### Why this is filed and not "do it now"

Doing Y now would block CI on the 102 active F1 errors and the 181
pre-existing TS-noise errors. Either of those would freeze the F1
throughput program (the actual current priority) until cleanup
completed — a multi-session detour for marginal CI benefit. Strategy D
preserves visibility (lint runs and annotates) without blocking. The
upgrade to C/Y becomes virtually free once F1 closes naturally.

---

## Action Item AA — HIPAA §164.312(b) audit log gap in patient-engagement-service.ts  🟡 OPEN (dedicated session required)

**Filed:** 2026-04-20 (Session 7, surfaced during TMD-1 F1 pre-flight on this file).
**Status:** OPEN, dedicated session required (NOT to be mixed with F1
throughput work).
**Severity:** 🟡 Medium-High — not a TestFlight blocker, IS a
pre-public-launch requirement. HIPAA OCR investigation scenario would
flag this as a control gap.
**Effort estimate:** 1–2 sessions of dedicated audit-only work.
**Prerequisites:** None — can proceed any time after TMD-1 F1
mechanical work on this file completes.

### Background

`server/services/patient-engagement-service.ts` (592 lines) handles
secure messaging, appointments, and reminders — all PHI operations
under HIPAA §164.312(b) (Technical Safeguards — Audit Controls).

**Current state:** the file contains a local helper
`logHipaaAudit(action, details)` that emits a `console.log` with a
`[HIPAA-AUDIT][PatientEngagement]` prefix at 10 sites
(MESSAGE_THREAD_CREATED, MESSAGE_THREADS_ACCESS, PROVIDER_THREADS_ACCESS,
MESSAGE_SENT, MESSAGES_ACCESS, APPOINTMENT_SCHEDULED, APPOINTMENTS_ACCESS,
APPOINTMENT_STATUS_UPDATED, POINTS_AWARDED, BADGE_AWARDED, REWARDS_ACCESS).
**However, none of these write durable records to `hipaaAuditLogsTable`** —
they emit stdout traces that vanish on container restart and are not
queryable for the 6-year retention window HIPAA expects of audit
controls. From an OCR-investigation standpoint, stdout traces do not
constitute audit controls per §164.312(b).

Surfaced during TMD-1 F1 pre-flight on this file
(`grep -nE "(hipaaAudit|auditLog|writeAudit)" returned 0` for
durable-audit calls; the local helper uses `logHipaaAudit` which is
distinct from `hipaaAuditLog*`).

### Scope of remediation (for future dedicated session)

1. **Design action code taxonomy for engagement operations:**
   - `ENGAGEMENT_MESSAGE_THREAD_CREATE`, `ENGAGEMENT_MESSAGE_SEND`,
     `ENGAGEMENT_MESSAGE_VIEW`
   - `ENGAGEMENT_APPOINTMENT_CREATE`, `ENGAGEMENT_APPOINTMENT_UPDATE`,
     `ENGAGEMENT_APPOINTMENT_CANCEL`
   - `ENGAGEMENT_REMINDER_CREATE`, `ENGAGEMENT_REMINDER_SEND`
2. **Decide reasonCode taxonomy alignment** — reference Session 2c
   work on accessReason enum split.
3. **Decide userId capture conventions** — session user vs system
   user for automated reminders.
4. **Instrument all 16+ sites** — every PHI insert/update/select
   needs an appropriate audit log write to `hipaaAuditLogsTable`,
   replacing or supplementing the existing stdout `logHipaaAudit`
   calls.
5. **Consider whether message-READ operations also need audit logs**
   (typically yes for HIPAA — message disclosure is a tracked
   access event).
6. **Add tests** validating audit log entries for each operation
   type (extend `tests/` to cover the audit-write contract per
   action code).
7. **Deprecation decision** — once durable audit writes are in
   place, decide fate of `logHipaaAudit` stdout helper (keep as
   debug companion vs delete to avoid confusion).

### Connection to other action items

- **Cross-reference Session 2c audit log architecture decisions** —
  reasonCode enum and userId capture conventions originate there.
- **Independent of TMD-1 / F1 throughput** — F1 mechanical wrapper
  swaps complete this file's encryption story; audit logging is a
  separate concern handled in its own dedicated session.
- **No overlap with Action Item Y** — Y is CI lint hardening; AA is
  HIPAA control implementation. They share no code paths.
- **Pattern template for future audit work** — the design decisions
  in this AA session (action codes, reasonCode mapping, system-user
  conventions) become the blueprint for similar gaps in other PHI
  services as they're discovered.

### Why filed and not done now

User decision in TMD-1 dispatch: bundling audit-log instrumentation
into F1 throughput would convert a pure mechanical wrapper-swap
(zero risk) into a multi-decision design exercise (high cognitive
load mid-session). Separating the work preserves F1 velocity AND
gives audit-log design the focused attention it deserves rather
than getting tacked on as a side effect.

---

> **TMD-3 batch (filed 2026-04-20):** Action Items AB, AC, AD, AE were
> surfaced in the master roadmap (`tm-comprehensive-roadmap.md`,
> Section A — 2026 Regulatory Landscape and Section E — Action Items
> Filed table). AA was filed earlier this session during TMD-1
> pre-flight (see entry above). The four below complete the AA-AE set
> referenced in the roadmap.

---

## Action Item AB — HIPAA Part 2 / SUD record protection language in NPP  🔴 PRE-TESTFLIGHT

**Filed:** 2026-04-20 (Session 7 / TMD-3, surfaced in master roadmap §A.1).
**Severity:** 🔴 Pre-launch compliance gap. The Feb 16, 2026 HIPAA
Notice of Privacy Practices update deadline has already passed; TM
must verify its NPP includes the required language before any patient
sees the published privacy policy.
**Effort estimate:** 15–30 min user task + agent documentation update.
**Prerequisites:** Termly Privacy Policy accessible (user task).

### Background

HIPAA's Feb 16, 2026 deadline required Notice of Privacy Practices
(NPP) updates to incorporate language aligning with 42 CFR Part 2
(Substance Use Disorder records protection). Per master roadmap §A.1,
the TM Privacy Policy (generated via Termly) MUST include:
- Substance Use Disorder (Part 2) records protection language
- Updated language around PHI use restrictions per the Feb 2026 rule

Note: the Reproductive Health Care Rule that originally accompanied
this update was vacated by a Texas federal court in June 2025 and
should NOT be included (per master roadmap §A.6). Only the Part 2 /
SUD language remains required.

### Action when triggered

1. **User opens Termly-generated TM Privacy Policy** and searches for
   "Part 2", "Substance Use Disorder", "SUD", or "42 CFR" keywords.
2. **If present:** verify the language matches Feb 2026 rule
   requirements; mark AB ✅ resolved with the verification date.
3. **If absent:** add language via Termly's "Additional Clause"
   feature. Reference text should align with HHS guidance on §164.520
   NPP requirements as updated by the Feb 2026 rule.
4. **Republish** the policy and re-paste content into TM's
   `/legal/privacy` page (bundles with Action Item X — LegalDocument
   styling — and Session A5 in the master roadmap).
5. **Document:** record verification date and language source in
   `f1-status.md` for audit trail.

### Connection to other action items

- **Action Item X (LegalDocument styling):** AB content goes into the
  same component X is styling. Bundle B1 + X resolution into one
  Termly-content-paste session.
- **Master roadmap Session B1:** "Part 2/SUD verify" — AB is the
  action-item form of that session.
- **Independent of F1 / Y / AA / AC / AD / AE.**

### Why filed and not done now

This is a USER task (Termly access required); agent cannot verify or
edit Termly-generated content directly. Filing surfaces the gap so it
isn't forgotten between sessions.

---

## Action Item AC — USCDI v3 data class gap analysis  🟡 POST-TESTFLIGHT

**Filed:** 2026-04-20 (Session 7 / TMD-3, surfaced in master roadmap §A.3).
**Severity:** 🟡 Post-TestFlight requirement. USCDI v3 became
mandatory January 1, 2026 for certified health IT under ONC's HTI-1
Final Rule. TM as a patient-owned FHIR records app SHOULD support
USCDI v3 data classes for exchange with certified EHRs.
**Effort estimate:** 1 dedicated session for the gap analysis;
remediation effort sized after gap is mapped.
**Prerequisites:** None — can run any time.

### Background

USCDI v3 mandates support for ~21 data classes for data exchange
between certified health IT systems. Per master roadmap §A.3, TM
must audit its current FHIR resource handling against the v3 list
to identify which data classes are supported today and which are
gaps requiring implementation.

**USCDI v3 data classes to audit:** Allergies & Intolerances,
Assessment & Plan of Treatment, Care Team Members, Clinical Notes
(8 types), Clinical Tests (new in v3), Diagnostic Imaging, Encounter
Information, Goals, Health Concerns, Health Insurance Information
(new class in v3), Health Status Assessments (SDOH — new in v3),
Immunizations, Laboratory, Medications, Patient Demographics
(expanded with preferred language, sexual orientation, gender
identity), Patient Summary & Reason for Referral, Problems,
Procedures, Provenance, Unique Device Identifier(s) for Implantable
Devices, Vital Signs.

USCDI v5 (Jul 2024) and v6 (Jul 2025) are voluntary via SVAP. v7
drafted Jan 2026.

### Action when triggered

1. **Inventory:** for each of the 21 USCDI v3 data classes, document
   TM's current support status (full / partial / none) and the
   responsible FHIR resource(s) and code paths.
2. **Gap list:** produce a prioritized gap list ordered by patient
   value × implementation effort.
3. **Spec:** write per-gap implementation specs (FHIR resources,
   schema extensions, route additions, validation rules).
4. **File new action items** for any high-priority gaps so they
   become discoverable session backlog.
5. **Defer v5/v6 voluntary classes** to v2.0+ unless a specific
   feature requires them earlier.

### Connection to other action items

- **Master roadmap Session C1+ (AI features):** USCDI v3 data
  classes feed the Patient Summary input context. AC informs the
  scope of "comprehensive context" per Health Mint mining Pattern B.
- **Action Item AD (TEFCA):** USCDI v3 support is a prerequisite for
  TEFCA IAS participation. AC must complete before AD becomes
  feasible.
- **Independent of F1 / Y / AA / AB / AE.**

### Why filed and not done now

This is a discovery + analysis session, not a fix. Filing it
surfaces the work so it can be prioritized against other
post-TestFlight sessions.

---

## Action Item AD — TEFCA IAS app participation (v2.0+ roadmap)  🟢 V2.0+ ROADMAP

**Filed:** 2026-04-20 (Session 7 / TMD-3, surfaced in master roadmap §A.4).
**Severity:** 🟢 V2.0+ aspirational. NOT a TestFlight or v1.0 blocker.
**Effort estimate:** Multi-session program (not single-session). 6+
months calendar time including SOC2 audit prerequisite.
**Prerequisites:** Action Item AC (USCDI v3 gap analysis) complete;
Care Access microservice Phase 1 built; SOC2 / HITRUST certification
obtained; Auth0 BAA executed.

### Background

The TEFCA (Trusted Exchange Framework and Common Agreement) FHIR
deadline of January 1, 2026 has passed. QHINs (Qualified Health
Information Networks) are now required to support FHIR API-based
exchange with HL7 FAST security protocols (UDAP JWT authentication,
dynamic registration, fine-grained OAuth scopes). Individual Access
Services (IAS) via SMART-on-FHIR is the primary consumer-facing use
case — i.e., a patient-facing app like TM accessing data from
TEFCA-connected EHRs through a QHIN.

Per master roadmap §A.4, TEFCA participation is **v2.0+ scope**, not
v1.0. v1.0 strategy = direct Fasten Health integration + Apple
HealthKit + Google Fit. TEFCA becomes achievable once Care Access
microservice Phase 1 is built AND SOC2 audit completed.

### Scope of remediation (when triggered)

If/when TM pursues TEFCA IAS participation:

1. **SMART on FHIR client capabilities** — already planned for Care
   Access Phase 1.3 per unified-architecture-plan.md.
2. **UDAP JWT client authentication support** — new implementation,
   requires JWT signing infrastructure.
3. **QHIN onboarding** — select a QHIN (Epic Nexus, eHealth Exchange,
   CommonWell, Health Gorilla, Konza, Kno2, MedAllies). Each has
   different onboarding, fees, and SLAs.
4. **RCE Directory registration** — TEFCA's central registration
   process.
5. **SOC2 / HITRUST certification** — typically required by QHINs
   before they accept new IAS applicants. This alone is a 6–9 month
   audit cycle.
6. **Legal:** TEFCA participation agreements, data exchange BAAs.

### Connection to other action items

- **Action Item AC (USCDI v3):** AC is a prerequisite — TEFCA
  exchange uses USCDI v3 data classes.
- **Master roadmap Phase D (Care Access microservice):** AD's SMART
  on FHIR client work overlaps with Care Access Phase 1.3.
- **Master roadmap Phase E sessions E8-E10:** AD is the action-item
  form of those sessions.
- **Independent of F1 / Y / AA / AB / AE in the short term.**

### Why filed and not done now

V2.0+ scope per explicit user decision in master roadmap §A.4.
Filing preserves the multi-step path so it isn't lost. AC must
complete first.

---

## Action Item AE — AI transparency and governance framework  🔴 BLOCKS PHASE C

**Filed:** 2026-04-20 (Session 7 / TMD-3, surfaced in master roadmap §A.7).
**Severity:** 🔴 Blocks all Phase C (Health Mint AI feature) sessions
in the master roadmap. NOT a TestFlight blocker, but is a
pre-first-AI-feature blocker.
**Effort estimate:** 90–120 min dedicated session per master roadmap
Session B4 estimate.
**Prerequisites:** None.

### Background

Per master roadmap §A.7, emerging healthcare AI standards in 2026
require any AI-enabled feature in TM to include specific transparency
and governance controls:

- HHS AI Risk Management framework for healthcare (released 2025)
- ISO 42001 AI Management System Standard applicable to health AI
- FDA guidance on AI/ML in medical devices (continuously expanding)
- State-level AI transparency laws — California AB 331, Texas SB 1116
  — require disclosure when AI is used in healthcare decisions

Health Mint mining identified multiple AI features TM intends to port
(features #1, #2, #6, #9 in the mining report's ranked list). None
of these can ship safely without an AI governance framework in place
first.

### Scope of remediation (Session B4 in master roadmap)

1. **Reusable AI Disclosure UI component** — clear "AI was used here"
   labeling, surfaceable on any AI-generated output. Pattern parallel
   to the "AI-suggested — confirm with your doctor" labeling already
   used in care-gaps work.
2. **Opt-out state** — `aiProcessingEnabled` boolean in user
   preferences (overlaps with Action Item Q — AI opt-out — which is
   the storage/UX side; AE is the framework).
3. **Middleware that respects opt-out** — server-side guard preventing
   any AI inference call when user has opted out; surfaces a
   placeholder UI per master roadmap §A.7.
4. **Confidence score UI pattern** — every AI output displays
   numeric confidence (0–1) per Health Mint mining Pattern E.
5. **Training data / model provenance documentation** — internal
   docs covering which models, which training data, what BAAs are
   in place with vendors.
6. **Human-in-the-loop policy** — for any clinical recommendation,
   document the human review path. No AI output should be presented
   as definitive clinical advice.
7. **State-law compliance docs** — California AB 331 and Texas SB
   1116 compliance checklists with TM's specific control mappings.

### Connection to other action items

- **Action Item Q (AI opt-out):** Q is the user-facing opt-out
  mechanism; AE is the framework that ensures Q is respected
  end-to-end. AE supersedes / wraps Q in scope.
- **Master roadmap Phase C sessions C1, C4, C7, C9, C10:** all
  blocked on AE completion. AE is the gate that opens the entire
  Health Mint AI feature porting program.
- **Action Item AA (patient-engagement audit logs):** AE's audit
  requirements (every AI call logged, every opt-out enforcement
  logged) overlap with AA's HIPAA §164.312(b) audit log
  instrumentation. Coordinate so audit-log infrastructure built
  for AA is reused for AI-call logging in AE.
- **Independent of F1 / Y / AB / AC / AD.**

### Why filed and not done now

Master roadmap explicitly sequences AE as Session B4 (post-TestFlight,
before Phase C begins). Filing now ensures it surfaces in the
discoverable backlog so a future session-dispatch directive picks it
up rather than letting Phase C sessions trip over the missing
framework.

---

## Action Item AF — Mobile config consolidation (three concurrent configs)

**Status:** OPEN — dedicated session required AFTER iPad rejection (TMD-4) resolved
**Severity:** 🟡 MEDIUM — not a TestFlight blocker, but an ongoing risk and root cause
of the TMD-4 three-way diagnostic ambiguity.
**Filed:** Surfaced by TMD-4 Phase 1 mobile-config diagnostic.
**Effort estimate:** 1–2 sessions
**Prerequisites:** TMD-4 Phase 2 iPad login fix shipped and TM approved on App Store
**Priority:** Post-TestFlight, **PRE-Phase-C** (blocks AI feature porting that depends
on push-notification registration, which requires bundle-ID consistency)
**Related action items:** None — this is new architectural work surfaced by TMD-4.

### Background

TMD-4 Phase 1 iPad login diagnostic surfaced three concurrent mobile-app
configurations in the repo, all declaring iOS targets, with conflicting
identifiers:

| # | File | Type | Slug | Scheme | Bundle / AppId | newArch | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `app.json` (root) | Expo | `tabula-medica` | `tabulamedica` | `com.tabulamedica.app` | `true` | `experiments.reactCompiler: true`; full HealthKit + NFC + biometrics infoPlist; buildNumber `"2"` |
| 2 | `tabula-medica-mobile/app.config.js` | Expo | `tabula-medica-mobile` | `com.tabulamedica.app` | `com.tabulamedica.app` | `true` | Minimal infoPlist; reads Auth0 from `Constants.expoConfig.extra`; EAS connected here per user |
| 3 | `capacitor.config.ts` | Capacitor | n/a | n/a | `health.tabulamedica.app` (DIFFERENT) | n/a | `limitsNavigationsToAppBoundDomains: true`; appears to be a parallel/unfinished web-wrapper migration |

Two of the three share bundle ID `com.tabulamedica.app`. The Capacitor wrapper
uses a different bundle ID `health.tabulamedica.app`. **No single source of
truth exists for "which mobile config produces the shipped App Store build."**

### Risk

1. **Ambiguity about which config actually ships.** This is the root cause that
   forced TMD-4's three-way diagnostic and Test A (user has to check the EAS
   dashboard to figure out which config produced submission `69f718ee`). Future
   rejections will repeat the same diagnostic overhead.
2. **Future iOS changes may be made to the wrong config.** A developer fixing
   an Auth0 callback URL or adding a new `infoPlist` permission has no way to
   know which file is canonical without grepping all three.
3. **One canonical mobile identity required.** Auth0 callback URLs, push-
   notification registration (APNs), deep links, and universal links all need
   to agree on ONE bundle ID and ONE URL scheme. Currently the ecosystem is
   split.
4. **Capacitor wrapper with different bundle ID** strongly suggests a parallel
   migration was started and not finished. Either it should be completed
   (Capacitor replaces Expo) or retired (Expo remains canonical).

### Scope of remediation (dedicated session post-iPad fix)

1. **Determine canonical config.** Most likely `tabula-medica-mobile/app.config.js`
   since EAS is wired to it and it's the directory name suggesting "the mobile
   project." Confirm with user before retiring others.
2. **Retire the other two** — archive (`*.deprecated.json`) or delete, with
   migration notes captured in commit message and `replit.md`.
3. **Reconcile bundle IDs** — pick ONE bundle ID for iOS, document the reason
   (probably `com.tabulamedica.app` since that's what App Store Connect
   currently knows). The Capacitor `health.tabulamedica.app` ID would be retired.
4. **Migrate any unique infoPlist entries** from `app.json` (NFC, HealthKit,
   etc.) into the canonical config so nothing is lost.
5. **Update `README.md`** and `unified-architecture-plan.md` with explicit
   "canonical mobile config" reference.
6. **Verify Auth0 application allow-lists** align with the canonical scheme
   (`com.tabulamedica.app://auth/callback` is what `tabula-medica-mobile/src/services/auth.ts`
   uses).
7. **Verify App Store Connect listing** uses the canonical bundle ID and that
   no orphaned bundle entries exist on the Apple side.
8. **Document in `replit.md`** under a new "Mobile architecture" section so
   future agents (and Claude) don't re-derive this from scratch.

### Why filed and not done now

Doing this consolidation while TMD-4 is unresolved would (a) create merge risk
during the Apple resubmit cycle and (b) potentially modify the very file that's
shipping the buggy build. Wait until TMD-4 Phase 2 lands a working iPad build
in TestFlight, THEN consolidate against the known-good baseline.

### Connection to other action items

- **TMD-4 (iPad login fix):** AF is the architectural debt TMD-4 surfaced. AF
  must wait for TMD-4 to close so we know which config is the "good" baseline.
- **Phase C (Health Mint AI features):** AF should land before Phase C starts
  because push-notification registration (used by AI-driven engagement nudges)
  requires bundle-ID consistency that AF establishes.
- **Independent of F1 / Y / AB / AC / AD / AE.**

---

## Action Item AF-2 — Unified-repo iOS build pipeline (scaffold-in-waiting)

**Status:** SCAFFOLD COMPLETE — local files only, **NOT pushed to GitHub**, awaiting AF-3 + Apple approval before activation.
**Severity:** 🟡 MEDIUM — premature activation = ships an inferior app to Apple and risks EAS `buildNumber` collision with mobile-only repo.
**Filed:** 2026-04-19 by main agent during pipeline build session.
**Effort estimate:** 0 (scaffold built); ~30 min activation work post-AF-3.
**Prerequisites:**
1. Mobile-only repo Build #41 (run `24641117006`, commit `98783e3`, includes TMD-4 fix) completes and is **Apple-approved**.
2. AF-3 ports the 3 monetization commits from `Tabula-medica/tabula-medica-mobile` into this unified repo:
   - `a14786c` (Task #3: FhirApi + NPI + dental upgrade prompts)
   - `28b6914` (Task #4: server-side tier checks)
   - `4a32a19` (Task #7: server-driven upgrade prompts + DICOM/Ambient/FHIR gates)
   - via `git format-patch 9cc6b32^..4a32a19 -o /tmp/patches/` then `git am --directory=tabula-medica-mobile /tmp/patches/*.patch`
3. AF-3 also brings over: Apple rejection fixes (2.5.1 / 2.1a / 3.1.1), RevenueCat IAP wiring, axios `1.15.0` CVE bump.
4. One test `workflow_dispatch` from unified (action=`build` only, no submit) succeeds.

**Files staged locally (do NOT push prematurely):**

| Path | Status |
|---|---|
| `.github/workflows/mobile-ios-submit.yml` | Workflow gated with `if: ${{ false }}` so it cannot fire even if accidentally pushed. Remove the guard only when activation criteria above are met. |
| `tabula-medica-mobile/eas.json` | Updated `submit.production.ios` to use `$EXPO_APPLE_*` env-var refs. Safe to push (no behavior change unless workflow runs). |
| `tabula-medica-mobile/PIPELINE_SETUP.md` | Setup + run + troubleshooting guide. Safe to push (docs only). |

### Activation checklist (when AF-3 + Apple approval done)

1. Verify mobile-only Build #41 status = "Approved" or "Ready for Sale" in App Store Connect.
2. Confirm AF-3 monetization commits + Apple-rejection fixes + RevenueCat + axios bump are all merged into unified `main`.
3. Add 5 GitHub Actions secrets to `Tabula-medica/Tabula-Medica-web-version`: `EXPO_TOKEN`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `ASC_APP_ID` (mirror from Replit secrets).
4. Run `npx eas-cli credentials` once interactively to register iOS Distribution Certificate + Provisioning Profile with EAS.
5. **Remove `if: ${{ false }}` line** from `.github/workflows/mobile-ios-submit.yml`.
6. Trigger workflow_dispatch with action=`build`, profile=`production`. Verify build completes on EAS without `buildNumber` collision (EAS `appVersionSource: remote` should prevent this, but verify).
7. If build OK, trigger workflow_dispatch with action=`build-and-submit`. Verify upload to App Store Connect.
8. Archive `Tabula-medica/tabula-medica-mobile` repo (set to read-only / archived in GitHub settings) so future pushes can't accidentally trigger the legacy mobile-only pipeline.

### Why filed and not done now (AF-2)

Mobile-only Build #41 is actively running (run `24641117006`) on commit `98783e3` with the TMD-4 iPad fix. Activating the unified pipeline now would:
- Risk EAS `buildNumber` collision with mobile-only #52 (autoIncrement is repo-local, EAS-side is the source of truth via `appVersionSource: remote` — but the safest path is no concurrent autoincrement attempts).
- Ship an inferior app missing 3 monetization commits + Apple rejection fixes + RevenueCat IAP + axios CVE.
- Break the in-flight Apple resubmission cycle.

The work is correct, the timing is not. Pipeline ships AFTER mobile-only #41 is Apple-approved AND AF-3 has merged.

### Connection to other action items

- **AF (mobile config consolidation):** AF-2 is the operational handoff that follows AF — once one canonical mobile config exists, this pipeline is the only build path.
- **AF-3 (monetization + Apple-rejection ports, separately tracked in mobile agent's queue):** Hard blocker for AF-2 activation.
- **TMD-4 (iPad login fix):** Build #41 carries the fix; AF-2 cannot ship until #41 is approved.


---

## Action Item AG — Section 508 / WCAG 2.0 AA conformance program

**Status:** OPEN — multi-session remediation program. Foundation complete (this session); per-page audit + third-party audit pending.
**Severity:** 🟡 MEDIUM — formal Section 508 conformance is a prerequisite for federal-agency contracts (VA, HHS, HRSA grants) and procurement by health systems with federal funding.
**Filed:** 2026-04-19 by main agent.
**Effort estimate:** 4–6 sessions of internal remediation + 1 third-party audit cycle (~8–12 weeks calendar).
**Prerequisites:** None — can run in parallel with other workstreams.
**Related:** TestFlight launch (does not block; required for federal procurement).

### Current conformance posture (as of 2026-04-19)

Foundation work already complete in unified codebase:
- ✅ `<html lang="en">` set
- ✅ Skip-to-main-content link wired (`SkipLink` in `accessibility-provider.tsx`)
- ✅ Semantic landmarks (`<main role="main" id="main-content">`, `<nav aria-label="Main navigation">`, `<header role="banner">`)
- ✅ AccessibilityProvider with 21 user-controllable settings (font, contrast, motion, color-blind modes, dyslexia, cursor, line spacing, sticky keys, reading guide, simple language, one-task mode, geriatric mode, screen-reader-optimized)
- ✅ `prefers-reduced-motion` system pref auto-detected + global CSS media query enforces it
- ✅ Per-page `<title>` updates via `useEffect` in `AppContent` (covers all 100+ routes from `pageTitles` map)
- ✅ Color-blind simulation modes (protanopia, deuteranopia, tritanopia) via CSS filters
- ✅ Voice navigation + voice commands (opt-in, never required)
- ✅ Session timeout modal with extend-time control (WCAG 2.2.1)
- ✅ Form errors via shadcn `<FormMessage>` with `aria-describedby`
- ✅ Focus rings via Tailwind `focus:ring-2 focus:ring-ring` (shadcn primitives)
- ✅ Dedicated `/accessibility` settings page
- ✅ Formal VPAT/ACR drafted at `.local/deliverables/section-508-vpat.md`

### Remediation sub-tasks

**AG-1: Alt-text audit for dynamic images** (1 session)
- Audit every `<img>` and `<Image>` for `alt` attribute presence and quality
- Target: user-uploaded medical document scans (lab reports, ID cards, insurance cards, prescription photos)
- Approach: server-side OCR-derived alt text where possible; fallback to generic descriptive alt; user can override in document detail view
- Acceptance: zero `<img>` tags without `alt` attribute; axe-core `image-alt` rule = 0 violations

**AG-2: Heading hierarchy audit across 100+ pages** (1–2 sessions)
- Verify every page has exactly one `<h1>` and a logical `h2`/`h3`/`h4` structure
- Target: pages currently using `<div className="text-2xl font-bold">` instead of semantic headings
- Approach: grep for class-based heading patterns, replace with proper tags
- Acceptance: axe-core `page-has-heading-one` and `heading-order` rules = 0 violations across all routes

**AG-3: Color contrast audit for dynamic content** (1 session)
- Static design tokens are AA-compliant (verified). Dynamic content needs verification:
  - Chart series colors (`--chart-1` through `--chart-5`) on chart background
  - Status badge color combinations (success / warning / error / info on each surface)
  - Alert banner text on alert background
  - Disabled state contrast (often the silent failure point)
- Approach: contrast-ratio audit script using `wcag-contrast` package against rendered DOM
- Acceptance: all foreground/background pairs ≥ 4.5:1 (normal text) or ≥ 3:1 (large text / UI components)

**AG-4: Keyboard navigation audit** (1 session)
- Manual keyboard-only walkthrough of top 20 user flows: signup, EHR connect, view records, share, export, telehealth, billing
- Verify: all actions reachable via Tab; no keyboard traps in modals; focus returns to trigger on dialog close; custom keyboard shortcuts documented
- Acceptance: every Pro user flow completable without mouse; focus visible at every step

**AG-5: Screen reader QA pass** (1 session)
- Test top 20 flows with VoiceOver (macOS/iOS), NVDA (Windows), TalkBack (Android)
- Verify: live regions announce dynamic updates (toast, save confirmations, real-time vitals); form errors announced on submit; navigation landmarks navigable by H/L/R keys
- Acceptance: each flow completable with screen reader; no "button" announcements without label

**AG-6: Automated a11y CI integration** (0.5 session)
- Add `@axe-core/playwright` to existing testing skill workflow
- Run a11y audit per page in CI; fail build on serious or critical violations
- Acceptance: CI fails if regression introduces axe violation; baseline of accepted minor violations documented

**AG-7: Independent third-party audit** (external — 4–6 weeks)
- Engage certified accessibility auditor (e.g., Deque, Level Access, Knowbility)
- Deliverable: third-party VPAT/ACR with auditor signature
- Cost estimate: $5K–$15K depending on app size and depth
- Acceptance: signed VPAT 2.5 Rev document; remediation list addressed

**AG-8: VA/HHS/HRSA federal procurement readiness** (0.5 session)
- Publish post-audit VPAT to public-facing site (`/legal/accessibility` page)
- Add accessibility statement linking to VPAT
- Add feedback channel (`accessibility@tabulamedica.health`) per § 502.4 requirement
- Acceptance: federal-agency procurement officer can locate and verify VPAT in < 60 seconds

### Deliverables

1. `.local/deliverables/section-508-vpat.md` — internal-review VPAT (DONE this session)
2. Per-AG-task acceptance evidence (axe reports, screen-reader notes, contrast matrices)
3. Third-party-signed VPAT (post AG-7)
4. Public `/legal/accessibility` page linking to published VPAT (post AG-7)

### Why filed and not done now

The app is already functionally accessible to most assistive-tech users — the remaining work is incremental tightening and formal certification, not foundational gaps. Per-page audits and third-party audit are calendar-bounded (need real auditors and real test cycles), so blocking other workstreams on them adds zero value. The internal VPAT (this session) gives federal procurement officers the document they need to begin evaluation; certified VPAT follows after AG-7.

### Connection to other action items

- **Independent of F1 / Y / AB / AC / AD / AE / AF / AF-2.**
- **Enables federal procurement** (VA, HHS, HRSA grants): mid-stage prerequisite, not Day-1.
