# F1 — PHI Encryption Coverage Plan

**Status:** Plan only — no code changes yet. Awaiting user greenlight.
**Author:** main agent
**Date:** 2026-04-18
**Context:** Auditor finding F1 — `encryptPhi` / `decryptPhi` defined in
`server/security/phi-encryption.ts` but never invoked on the actual write/read
paths for patient PHI. F2 (hardcoded salt + wrong key class) and F3 (OAuth
tokens stored plaintext) are already fixed in this session. F1 is the larger
architectural piece.

---

## What "PHI" means here

The auditor flagged five table families as PHI-bearing. They map to the
existing `PHI_FIELDS` constant in `server/security/phi-encryption.ts`:

| Kind          | Fields requiring at-rest encryption                                  |
|---------------|----------------------------------------------------------------------|
| `patient`     | name, email, phone, address, ssn, dateOfBirth, mrn                   |
| `medication`  | patientId, prescribedBy                                              |
| `labResult`   | patientId, orderedBy                                                 |
| `message`     | content, senderName, recipientName                                   |
| `appointment` | patientId, notes                                                     |

`oauthTokens`, `ehrConnection`, `wearableConnection` were added in F3 and are
already wired through their storage methods.

## Current reality (verified)

- `MemStorage` in `server/storage.ts` is a `Map`-backed implementation. There
  is **no Drizzle-backed PostgreSQL persistence** for these PHI families today.
- All reads/writes go through `IStorage` methods.
- `encryptPhi` / `decryptPhi` work correctly (per F2 fix) but are not invoked
  on the patient/medication/lab/message/appointment paths.

This is good news for the migration: there is **one chokepoint** (`MemStorage`)
to wrap, not dozens of route handlers.

## Two-layer plan

### Layer A — Storage-boundary wrapper (ships now, low risk)

Mirror the F3 pattern: encrypt on write, decrypt on read at the `IStorage`
implementation boundary, using a generic helper:

```ts
// server/security/phi-encryption.ts (extension)
export function encryptRecord<T>(record: T, kind: keyof typeof PHI_FIELDS): T;
export function decryptRecord<T>(record: T, kind: keyof typeof PHI_FIELDS): T;
```

Apply to the following `MemStorage` methods:

- **patient:** `createPatient`, `updatePatient`, `getPatient`, `getPatients`,
  `getPatientsByConnection`, `deletePatientsByConnection`
- **medication:** `createMedication`, `updateMedication`, `getMedication`,
  `getMedications`, `getMedicationsByPatient`
- **labResult:** `createLabResult`, `updateLabResult`, `getLabResult`,
  `getLabResults`, `getLabResultsByPatient`
- **message:** `createMessage`, `updateMessage`, `getMessage`, `getMessages`,
  `getMessagesByThread`
- **appointment:** `createAppointment`, `updateAppointment`, `getAppointment`,
  `getAppointments`, `getAppointmentsByPatient`

**Effort:** ~3-4 hours (mostly mechanical wrapping + tests).
**Risk:** Low. No schema changes. No migration. Reversible by reverting
the helper calls.

**Critical guardrails for Layer A:**

1. **Search by encrypted field is broken.** If any existing code does
   `.filter(p => p.email === query)` after the wrap lands, it will silently
   return zero results. Audit all `.filter`/`.find` calls on PHI fields and
   either: (a) decrypt-then-filter, or (b) add a separate non-PHI lookup key
   (e.g. `emailHash` for equality lookups).
2. **JSON serialization of decrypted PHI** must not leak into logs. Existing
   `[Compliance]` redaction needs to be re-verified after the wrap.
3. **Test reseed path.** `seed:reviewer-account` script must be re-run end-
   to-end after the wrap to verify no plaintext lands in the Map.

### Layer B — Drizzle migration (deferred, requires schema cutover)

When `MemStorage` is eventually replaced with a Drizzle-backed implementation
(needed for production multi-instance scale), the encrypt/decrypt boundary
moves from "Map setter/getter" to "Drizzle insert/select wrapper". The Layer A
helpers (`encryptRecord` / `decryptRecord`) are reused unchanged — only the
call sites move.

**Two implementation options for Layer B (decision deferred):**

- **B1: Drizzle `customType<string, string>`** that encrypts on `toDriver` and
  decrypts on `fromDriver`. Pros: zero changes at call sites. Cons: hides
  encryption from code review; harder to opt out per-query; does not handle
  searchable fields.
- **B2: Explicit storage-layer wrapper** (same shape as Layer A). Pros:
  visible in code review; explicit per-method; supports search-key columns.
  Cons: every new storage method must remember to call it.

**Recommendation:** B2. The visibility tax is worth it for a HIPAA system.

### Out of scope for F1 (separate items)

- **express-session token storage.** Auth0 access/refresh tokens land in the
  PG-backed session store as serialized JSON. This is a separate finding —
  needs either an encrypted session store or a custom serializer. Will track
  as F4 if/when the auditor confirms.
- **Audit log encryption.** `auditLogs` records contain `userId` + action
  metadata. Auditor did not flag; revisit during HIPAA pre-launch review.
- **Object storage PHI** (file uploads). Already encrypted at rest by GCS;
  no app-layer change needed unless auditor escalates.

## Suggested execution order

1. Get user greenlight on this plan (now).
2. Implement Layer A helper + wrap `patient` family first. Test reseed.
3. Wrap `medication`, `labResult`, `message`, `appointment` in one batch.
4. Run full reviewer walkthrough end-to-end (per
   `testflight-reviewer-walkthrough.md`).
5. Update `AUDIT_CONTEXT.md` to reflect F1 closure and ship to auditor for
   re-verification.
6. Layer B (Drizzle migration) — separate task, separate session.

## Open questions for user

1. **Search semantics.** Today the app surfaces patient lookup by name/email
   in the global search bar. Acceptable to require exact matches via
   email-hash column, or do we need fuzzy search (which means searchable
   encryption — much bigger lift)?
2. **DB wipe acceptable?** Layer A is in-memory so no wipe needed. Layer B
   will require dev-DB wipe + reseed. Confirm pre-launch is still the
   window.
3. **Who reviews the F1 implementation?** Same auditor (re-verify F1) or
   separate code review pass first?
