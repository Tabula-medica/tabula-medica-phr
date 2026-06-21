# Action Item H — Backfill plaintext PHI rows to ciphertext

**Status:** TRACKED, not yet scheduled
**Filed:** 2026-04-18 (end of Session 2b Step 4)
**Origin:** Reviewer note after approval of phiDb wrapper architecture
**Estimate:** 2–3 hours to write, ~30 min to run against a reasonable-sized DB
**Blocking:** First real-patient signup (TestFlight acceptance of real patient data)

## Context

The Session 2b migration shipped `phiDb` + `encryptPhiRow` / `decryptPhiRow(s)`
wrappers and applied them at every PHI call site in
`patient-health-record-routes.ts` (33 → 0 [F1] violations). The wrappers are
idempotent and backward-compatible:

| Scenario                                | Behavior                |
|-----------------------------------------|-------------------------|
| New writes via wrapper                  | encrypted ✅            |
| Reads of plaintext rows (legacy)        | pass-through ✅         |
| Reads of encrypted rows                 | decrypt correctly ✅    |
| **Existing plaintext rows on disk**     | **still plaintext ❌**  |

Test fixture #14 in `tests/phi-storage.spec.ts` proves the mixed-batch read
contract holds, so the app does not crash during the rollout window. But for
**F1 to be auditor-verifiable**, every PHI row must be ciphertext at rest.

## Why not now?

- Dev DB contains only synthetic / seed data (deletable).
- Production has no real PHI yet (pending Neon DB verification).
- Seed script can be re-run to repopulate with encrypted values, eliminating
  the plaintext rows that exist today.

## When does it become urgent?

The moment real patients exist. Specifically: **before TestFlight accepts the
first real patient signup.**

## Implementation outline

Write `scripts/backfill-phi-encryption.ts` that:

1. For each table in `PHI_TABLE_NAMES` (from `server/security/phi-column-map.ts`):
   - `SELECT id, <phi columns> FROM <table>` in batches of 500
   - For each row, run `encryptPhiRow(tableName, row)`
   - `UPDATE <table> SET <phi col> = $1, ... WHERE id = $rowId`
2. Per-table progress log (rows scanned / rows re-encrypted / rows skipped).
3. Idempotent: `encryptPhiRow` skips already-ciphertext strings, so the
   migration is safe to re-run after partial failure or after a race with
   concurrent writes.
4. Dry-run flag: `--dry-run` selects + classifies but does not write.
5. Single-table flag: `--table=<name>` for incremental rollout / debugging.

## Acceptance check (after running)

```sql
-- For each PHI table, every text PHI column must start with the ciphertext
-- prefix recognized by isEncrypted(). Run:
SELECT COUNT(*) FROM medicationsTable WHERE name NOT LIKE 'enc:v1:%';
-- → must return 0 across every (table, phi-column) pair.
```

A wrapper script `scripts/verify-phi-at-rest.ts` should iterate the PHI map
and assert COUNT(*) = 0 for every PHI column. CI gate this in production
deploys after first patient signup.

## Cross-references

- Migration architecture: `server/storage/phi-storage.ts` (phiDb, encrypt/decrypt)
- Backward-compat policy fixture: `tests/phi-storage.spec.ts` test #14
- Reviewer approval thread: Session 2b Step 1+2 reply (filed 2026-04-18)
- Session sequence: schedule AFTER Session 2b.5 (dedup engine 25 F1) and
  routes.ts/infrastructure-routes migrations are complete. Backfill is the
  capstone — no point backfilling tables whose write paths still leak
  plaintext.
