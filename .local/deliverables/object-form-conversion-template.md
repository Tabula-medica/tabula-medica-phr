# Logger Object-Form Conversion Template

**Status:** Canonical pattern. Required for all PHI-touching files in F1 Phase-1 conversion.
**Verified by:** `tests/logger-redact.spec.ts` (8/8 green) — proves object-form keys get redacted to `[PHI_REDACTED]` while string interpolation leaks raw PHI, and proves opaque UUIDs remain visible per the policy below.
**Reference implementation:** `server/services/deduplication-engine-service.ts` (fully converted, 16 call sites).

---

## What counts as PHI vs. opaque identifiers

**Reviewer-approved policy (2026-04-18):**

Opaque UUIDs (`patientId`, `profileId`, `userId`, `granteeId`, `packageId`, `requestId`, `consentId`, `permissionId`, etc.) are **NOT** added to `PHI_FIELD_NAMES`. They are foreign-key pointers into encrypted tables, not identifiable data under **HIPAA Safe Harbor (45 CFR §164.514(b)(2))**. A bare UUID like `57a8bacf-a952-4c7f-ad46-01be45abc63d` reveals nothing about a human; mapping it to a person requires access to the encrypted `patients` table, which is already protected by the F1 wrapper.

Decrypted PHI fields (`firstName`, `lastName`, `email`, `mrn`, `dob`, `ssn`, `phoneNumber`, `address`, etc.) **ARE** redacted via `PHI_FIELD_NAMES`. That list is auto-derived from `PHI_COLUMN_MAP` so the redaction list and the encryption list cannot drift.

This policy allows audit logs to remain forensically useful (a **§164.312(b)** requirement — covered entities must be able to "examine activity in information systems") while protecting all identifying information.

**Practical consequence for converters:** When emitting an audit line, you may include `patientId` / `profileId` / `userId` directly as object keys without worrying about leakage. PHI fields like `mrn` or `email` will redact automatically because they are in `PHI_FIELD_NAMES`. If you find yourself logging a decrypted `firstName` or `email` on purpose for debugging — stop, restructure to use the opaque UUID instead.

---

## The rule

PHI must enter the logger as **object keys**, never as string interpolation.

```ts
// ✅ CORRECT — pino sees `patientId` as a key, redact() removes it
logger.info({ patientId, matchId, decision: "confirmed" }, "patient merge decision");

// ❌ WRONG — string is opaque to redact(); raw UUID hits stdout
logger.info(`Patient ${patientId} confirmed merge for match ${matchId}`);
```

## Anatomy

```
logger.<level>({ <metadata-object> }, "<short, static, English message>");
            ^                          ^
            |                          |
            redact-eligible            human-readable, no interpolation
```

- **Metadata object first.** Always `{ component, ...phiFields, ...contextFields }`.
- **Message second.** Short, static, declarative. No template literals. No PHI substring.
- **Always include `component`.** Lets ops filter logs by service.
- **Errors go in `err`.** Pino has built-in serialization for `err`. Use `logger.error({ component, err: error, ...ctx }, "msg")`.

## PHI fields that get redacted

Defined in `server/security/phi-column-map.ts::PHI_FIELD_NAMES` (auto-derived from `PHI_COLUMN_MAP`). Includes: `email`, `ssn`, `mrn`, `dateOfBirth`, `phoneNumber`, `firstName`, `lastName`, `dob`, `address`, plus ~80 other column-derived names.

**Does NOT include opaque UUIDs** — see "What counts as PHI vs. opaque identifiers" above. `patientId`, `userId`, `profileId` are intentionally absent from this list.

To verify a field is redacted: `grep -i "fieldname" server/security/phi-column-map.ts`.
If missing, add it to `PHI_COLUMN_MAP` (single source of truth) — it propagates automatically.

## Common patterns

### Pattern: Init / boot
```ts
// Before
logger.info("[ServiceName] Service initialized");
// After
logger.info({ component: "ServiceName" }, "service initialized");
```

### Pattern: Counters / non-PHI values
```ts
// Before
logger.info(`[Engine] Found ${count} candidates`);
// After
logger.info({ component: "Engine", candidateCount: count }, "found candidates");
```

### Pattern: PHI-bearing context
```ts
// Before  ❌ string interpolation — opaque to redact even for true PHI
logger.info(`Retrieved ${n} reviews for patient: ${patientId} (mrn: ${mrn})`);
// After  ✅ patientId visible (opaque UUID, not PHI), mrn redacted automatically
logger.info({ component: "Engine", patientId, mrn, pendingReviewCount: n }, "retrieved pending reviews");
// Output: {"component":"Engine","patientId":"57a8bacf-...","mrn":"[PHI_REDACTED]","pendingReviewCount":3,"msg":"retrieved pending reviews"}
```

### Pattern: Errors
```ts
// Before
logger.error("[Engine] Error processing patient:", error);
// After
logger.error({ component: "Engine", err: error }, "error processing patient");
```

### Pattern: HIPAA-AUDIT lines
```ts
// Before  ❌ patientId, action LEAK
console.log(`[HIPAA-AUDIT] ${userId} accessed ${resourceType} ${resourceId}`);
// After  ✅ all PHI redacted, structured for SIEM
logger.info({
  audit: "HIPAA",
  userId,
  resourceType,
  resourceId,
  action: "read",
}, "PHI accessed");
```

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| `logger.info(\`patient ${id}\`)` | String interpolation — redact can't see `id` as a field |
| `logger.info({ msg: \`patient ${id}\` })` | Same problem; `msg` is a string |
| `logger.info({ data: patientObj })` where `patientObj` has PHI | Pino redact paths must match — bury under `data.patient.*` and your redact pattern misses |
| `logger.info(error)` (raw) | Stack trace may include PHI from upstream interpolation |
| `console.log(...)` anywhere in PHI paths | Not piped through redact at all |

## phiDb vs db — the receiver-name pattern (F1)

**TL;DR:** Both `phiDb` and `db` are the same Drizzle client. The variable
name encodes PHI awareness. ESLint blocks `db.{insert,update,delete,select}`
against any table in `PHI_COLUMN_MAP` and exempts the `phiDb` alias.

### Why two names for one client?

We need a programmatic signal — visible to ESLint, code review, and grep —
that the developer thought about PHI before writing the call. Doing this
with comments is unenforceable. Doing it with a separate import that ESLint
can pattern-match is cheap, mechanical, and impossible to skip accidentally.

```ts
// ❌ BLOCKED by ESLint rule [F1] — wrong receiver
await db.insert(medicationsTable).values({ name, dose });

// ✅ ALLOWED — explicit phiDb receiver + encryptPhiRow wrapper
import { phiDb, encryptPhiRow, decryptPhiRows } from "../storage/phi-storage";
await phiDb.insert(medicationsTable).values(
  encryptPhiRow("medicationsTable", { name, dose })
);
```

### The four canonical patterns

```ts
// (1) INSERT — wrap values with encryptPhiRow, decrypt the .returning() result
const [rawRow] = await phiDb.insert(patientIdentityTable).values(
  encryptPhiRow("patientIdentityTable", { firstName, lastName, dateOfBirth })
).returning();
const row = decryptPhiRow("patientIdentityTable", rawRow);

// (2) UPDATE — wrap .set() payload with encryptPhiRow
await phiDb.update(patientIdentityTable)
  .set(encryptPhiRow("patientIdentityTable", { lastName: newName }))
  .where(eq(patientIdentityTable.id, id));

// (3) SELECT (single row) — wrap result with decryptPhiRow
const [raw] = await phiDb.select().from(patientIdentityTable)
  .where(eq(patientIdentityTable.id, id));
if (!raw) return null;
const row = decryptPhiRow("patientIdentityTable", raw);

// (4) SELECT (list) — wrap result with decryptPhiRows
const raws = await phiDb.select().from(patientIdentityTable).limit(50);
const rows = decryptPhiRows("patientIdentityTable", raws);
```

### Aggregate / projection queries

When `.select({...})` projects to scalar fields (counts, sums) and not to
PHI columns, no decrypt is needed. Still route through `phiDb` to satisfy
the ESLint guard:

```ts
const [stats] = await phiDb
  .select({ count: sql<number>`count(*)::int` })
  .from(patientIdentityTable);
// stats.count is just a number — nothing to decrypt.
```

### Backward compatibility (auditor-relevant)

`encryptPhiRow` is **idempotent** (skips already-ciphertext strings) and
`decryptPhiRows` **passes plaintext rows through unchanged**. This is what
allows the F1 migration to deploy against a database containing pre-existing
plaintext rows without a preceding backfill. Action Item H tracks the
backfill that eliminates the legacy plaintext rows. Until that runs:

- New writes via `phiDb` produce ciphertext
- Reads of either ciphertext (new) or plaintext (legacy) rows succeed
- A re-run of the backfill is safe because of idempotency

Locked by `tests/phi-storage.spec.ts` fixture #14 (medications) and #20
(mergeHistory).

### Forensic snapshots (mergeHistoryTable.postmergeData)

The dedup engine snapshots full patient rows into `mergeHistoryTable`.
Per `PHI_COLUMN_MAP`, `premergeData` and `postmergeData` are jsonb PHI →
`encryptPhiRow` wraps them as `{__enc: <ciphertext>}` envelopes. This gives
defense-in-depth: even if the inner row's per-column encryption ever changed,
the snapshot envelope still hides it. Lookup by opaque UUIDs
(`survivingPatientId` / `retiredPatientId`) continues to work because those
columns are not encrypted (HIPAA Safe Harbor §164.514(b)(2)).

### Where the magic lives

- **Wrapper definition:** `server/storage/phi-storage.ts` — exports
  `phiDb`, `encryptPhiRow`, `decryptPhiRow`, `decryptPhiRows`,
  `isRowFullyEncrypted`, `hashEmail`, `hashMrn`, `hashPhone`.
- **PHI source of truth:** `server/security/phi-column-map.ts::PHI_COLUMN_MAP`
  — declares which text + jsonb columns of which tables are PHI. Adding a
  new PHI column here propagates to encryption, redaction, and ESLint guard
  in one edit.
- **ESLint guard:** `eslint.config.js` — `[F1]` selectors (`callee.object.name="db"`).
- **Reference migrations:** `server/patient-health-record-routes.ts`
  (33 → 0 sites) and `server/services/deduplication-engine-service.ts`
  (25 → 0 sites; covers the jsonb forensic-snapshot pattern).

## ESLint enforcement (Action F)

`eslint.config.js` ships a custom `no-restricted-syntax` rule that blocks:
- `db.insert(<phi_table>)` / `.update(<phi_table>)` / `.delete(<phi_table>)`
- `db.select().from(<phi_table>)`

Verified firing on synthetic violation (3/3 errors). Wrappers in `server/storage/phi-storage.ts` are exempted via override block.

**Run locally:** `npx eslint <path>` (no npm script yet — `package.json` is forbidden territory; user must add `"lint": "eslint ."` manually).

## Conversion checklist (per file)

1. `import { logger } from "../lib/logger";` (path varies; resolve relative)
2. Replace every `console.log/.warn/.error/.info` with `logger.<level>`
3. Replace every template-literal logger call with `logger.<level>({...}, "msg")`
4. Move every `${var}` from the message string into a metadata key
5. Run `npx tsc --noEmit` to catch missing imports
6. `grep -nE "logger\.\w+\(\`|console\." <file>` → must return 0 hits
7. Restart workflow, hit a route that triggers the file, confirm log line shows `[REDACTED]` for PHI keys

## Status snapshot

| File | Calls | PHI-leak sites | Status |
|---|---|---|---|
| `services/deduplication-engine-service.ts` | 16 | 3 (1097, 1106, 732) | ✅ converted |
| `routes.ts` | 120 | many | ⏳ next |
| `services/ai-personalized-care-journey-service.ts` | 69 | several | ⏳ next |
| `routes/ai-safety-analysis-routes.ts` | 66 | HIPAA-AUDIT | ⏳ next |
| `services/ai-medication-service.ts` | 50 | medication.name | ⏳ next |

## Methodology note: PHI map key naming convention

The PHI map in `server/security/phi-column-map.ts` is keyed on **camelCase
JS variable names** (e.g. `vitalSignsTable`, `medicationRemindersTable`,
`carePlanProgressNotesTable`), **NOT snake_case SQL table names** (e.g.
`vital_signs`, `medication_reminders`, `care_plan_progress_notes`).

When pre-flight checking whether a given table is registered in the PHI
map before starting a per-file F1 migration, grep for the **camelCase
variable name** as it appears in `shared/schema.ts`, not the SQL table
name. Both forms exist in the codebase and grep results look superficially
similar, which is exactly the trap.

**First occurrence of the confusion:** Session 5,
`server/comprehensive-care-plan-routes.ts` migration. An initial
pre-flight grep using snake_case names returned zero hits across all 12
PHI tables in that file and almost triggered a false-alarm "PHI map is
incomplete, pause the session" report. A 30-second secondary grep using
the correct camelCase keys confirmed all 12 tables were already
registered with proper column-level encryption specs.

**Lesson — institutionalized:** Caught via secondary grep before any code
changed. Documenting here so future sessions don't repeat the
false-alarm pattern. The 30-second double-check saved an estimated
30-60 minutes of wasted investigation work and prevented a potential
silent-no-op bug had bogus map entries been added "to fix" a
non-existent gap.

**Pre-flight checklist (mandatory before starting an F1 file migration):**
1. List every PHI table the file touches — extract from the file's
   imports of tables from `shared/schema.ts`.
2. For each, grep `server/security/phi-column-map.ts` for the
   **camelCase variable name** (e.g. `vitalSignsTable`), not the SQL
   table name.
3. If any table appears genuinely missing, **grep again with both
   case styles** before declaring a gap. Only after both forms return
   zero hits is the gap real.
4. Only then proceed to the migration or surface the gap.
