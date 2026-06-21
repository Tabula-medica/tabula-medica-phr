# F1 Remaining Violations — Triage

**Generated:** session 2b.5 close, post-dedup migration.
**Total:** 179 F1 violations across 12 files.
**Source:** `npx eslint server` parsed and grouped by file.

> **Note on methodology:** F1 = ESLint rule that fires on
> `db.{insert|update|delete|select}` against any table named in
> `PHI_COLUMN_MAP`. Each violation is one call site that must be
> migrated to `phiDb` + `encryptPhiRow`/`decryptPhiRow` per the canonical
> pattern documented in `object-form-conversion-template.md`. The
> mechanical work is well-understood; what differs per-file is hot/cold
> path priority and exposure to the encryption-search latent issue
> (Action Item I).

---

## Distribution

| Rank | File | F1 count | % of remaining |
|---|---|---:|---:|
| 1 | `server/comprehensive-care-plan-routes.ts` | 41 | 22.9% |
| 2 | `server/medication-management-routes.ts` | 29 | 16.2% |
| 3 | `server/health-tracking-routes.ts` | 28 | 15.6% |
| 4 | `server/provider-population-management-routes.ts` | 20 | 11.2% |
| 5 | `server/services/patient-engagement-service.ts` | 18 | 10.1% |
| 6 | `server/services/database-dedup-service.ts` | 16 | 8.9% |
| 7 | `server/patient-reported-outcomes-routes.ts` | 16 | 8.9% |
| 8 | `server/patient-engagement-hub-routes.ts` | 4 | 2.2% |
| 9 | `server/routes.ts` | 3 | 1.7% |
| 10 | `server/personalized-education-routes.ts` | 2 | 1.1% |
| 11 | `server/services/hipaa-compliance-service.ts` | 1 | 0.6% |
| 12 | `server/services/enhanced-provider-analytics-service.ts` | 1 | 0.6% |
| | **TOTAL** | **179** | **100%** |

> **Correction to prior session-status notes:** earlier sessions referenced
> "routes.ts (1480 leaks)". That figure was for a *different* category
> (likely raw-string PHI interpolation in logger/console paths, not F1
> `db.*`-against-PHI-table calls). For F1 specifically, `routes.ts` has
> only **3** violations — it is among the smallest remaining files, not
> the largest. The 1480 figure should be re-categorized in the next
> triage cycle.

---

## Per-file classification

### Path classification

- **HOT** = end-user-reachable HTTP route, fires on every patient session,
  high write volume, blocks UI. Migration regression here is immediately
  visible.
- **WARM** = provider-facing or admin route, lower volume, regression
  visible within hours.
- **COLD** = background service, batch path, internal tool. Regression
  may take days to surface.

### Encryption-search dependency (Action Item I)

- **I-blocked** = file contains at least one `eq()` / `like()` / `ilike()`
  predicate against a PHI text column. Migration to `phiDb` does NOT fix
  this — the query will silently return zero rows once Action Item H
  backfill runs. Action Item I (hash-column migration) must complete OR
  the predicate must be removed/documented before this file's migration
  is "safe."
- **I-clear** = no PHI-column predicates; safe to migrate independently.
- **UNKNOWN** = needs per-file inspection during migration session.

---

| Rank | File | Count | Path | I-status | Notes |
|---:|---|---:|---|---|---|
| 1 | `comprehensive-care-plan-routes.ts` | 41 | HOT | UNKNOWN | Largest single file. Care plan tables are PHI-dense (jsonb plan blobs, link tables). Likely 1 full session by itself. Audit for I-blocking predicates first; care-plan lookups are usually by `patientId` UUID (I-clear) but the link tables may have name predicates. |
| 2 | `medication-management-routes.ts` | 29 | HOT | UNKNOWN | **Also has Gap 4 string-form-logger debt: 19/19 logger calls are string-form (zero object-form).** Batch both fixes in same session. Medication routes hit on every dashboard load. |
| 3 | `health-tracking-routes.ts` | 28 | HOT | I-clear (likely) | Symptom logs, vitals, monitoring alerts. Lookups typically by `patientId` + date range, not by PHI text. Low I-risk. |
| 4 | `provider-population-management-routes.ts` | 20 | WARM | I-blocked (likely) | Provider-side patient search by name/MRN. Almost certainly has `ilike(firstName, ...)` predicates. Migration here exposes the worst case of Action Item I. |
| 5 | `patient-engagement-service.ts` | 18 | WARM | I-clear (likely) | Engagement messaging, appointment reminders. Lookups by thread/appointment UUID. |
| 6 | `database-dedup-service.ts` | 16 | COLD | I-blocked | Companion to the dedup engine already migrated. Same encryption-search constraints as `deduplication-engine-service.ts`. Same `F1-LATENT` annotations should propagate. |
| 7 | `patient-reported-outcomes-routes.ts` | 16 | HOT | I-clear (likely) | PRO surveys, patient experience feedback. Lookups by `patientId`. |
| 8 | `patient-engagement-hub-routes.ts` | 4 | WARM | UNKNOWN | Small file; quick win. |
| 9 | `routes.ts` | 3 | HOT | UNKNOWN | Was previously assumed enormous; actually trivial F1-wise. **3 calls** in the giant grab-bag router. Likely the last 3 surface routes that didn't get refactored into specialized routers. |
| 10 | `personalized-education-routes.ts` | 2 | WARM | I-clear | Educational content — low PHI density. |
| 11 | `hipaa-compliance-service.ts` | 1 | COLD | I-clear | **Also has Gap 4 string-form-logger debt: 9/9 logger calls are string-form (zero object-form).** Batch both fixes. |
| 12 | `enhanced-provider-analytics-service.ts` | 1 | WARM | I-clear | One-liner. |

---

## Recommended migration order (revised)

The right ordering is **NOT** strictly "biggest first." It is "fix Action
Item I prerequisites first, then biggest hot-path, then the rest":

### Phase 1 — Quick wins + prep (1 session)

Migrate the three smallest files together: **#9 routes.ts (3) + #10
personalized-education (2) + #11 hipaa-compliance (1) + #12
enhanced-provider-analytics (1)**. Total: 7 violations across 4 files.
Bundle with the **stale string-form logger fix** in `hipaa-compliance`
(9 calls). Single session, ~7 hours of work. Clears one third of the
file count, builds confidence in the pattern across heterogeneous files.

### Phase 2 — High-value hot paths (3 sessions)

In this order:

1. **#7 patient-reported-outcomes** (16, HOT, I-clear) — fast, no
   surprises.
2. **#3 health-tracking** (28, HOT, I-clear-likely) — second-biggest
   single file, low risk.
3. **#2 medication-management** (29, HOT, UNKNOWN) — bundle with the
   stale string-form logger fix (19 calls). Heaviest single session
   except for #1.

### Phase 3 — The big one (1 session, possibly two)

**#1 comprehensive-care-plan-routes** (41) — full session reserved.
Care-plan jsonb encryption likely needs the same `__enc` envelope
treatment that `mergeHistoryTable` got. Audit the link tables first.

### Phase 4 — Provider-side + service tier (2 sessions)

1. **#4 provider-population-management** (20, WARM, I-blocked-likely) —
   THIS is the file that forces Action Item I to start. Cannot be
   "safely" migrated until either (a) hash columns exist for the
   predicates the file uses, or (b) provider-side fuzzy search is
   removed from v1 scope.
2. **#5 patient-engagement-service** (18) + **#6 database-dedup-service**
   (16) + **#8 patient-engagement-hub** (4). Service-tier and a small
   hub file. Bundle.

### Total estimate

| Phase | Sessions | Cumulative F1 cleared |
|---|---:|---:|
| Phase 1 | 1 | 7 |
| Phase 2 | 3 | 80 |
| Phase 3 | 1–2 | 121 |
| Phase 4 | 2 | 179 |
| **Total** | **7–8 sessions** | **179** |

Plus 1 session for Session 2c (audit log scrubbing — separate architectural
work) before Phase 1 starts. Budget: **8–9 sessions to F1 = 0.**

---

## Hard sequencing constraints

1. **Action Item I MUST start concurrently with Phase 2, not after Phase 4.**
   Earlier framing said "before Phase 4." That framing was too lax.
   Reviewer correction (session 2b.5 close): the encryption-search audit
   work has long lead time (it requires schema changes — adding hash
   columns to whichever PHI tables get name/MRN/phone predicates — plus
   backfilling those hash columns). If we start I only when Phase 4
   blocks on it, file #4 (provider-population) will sit half-migrated
   for a session+ while I catches up. Start I in parallel with Phase 2
   so by the time Phase 4 begins, the hash columns and backfilled hash
   values are already in place. Net effect: I is a background workstream
   that runs alongside Phases 2–3 and lands just-in-time for Phase 4.
2. **Action Item H runs after Phase 4 + Action Item I + Action Item L.**
   L (versioned ciphertext envelope) must precede H, otherwise H
   produces an unversioned ciphertext at every cell and we double the
   eventual rotation backfill cost. Order: Phase 4 done → I done → L
   done → H runs.
3. **Action Item J** (test fixture expansion 20 → 40) can be folded
   into Phases 1–4 as each new table is touched — write the fixture
   when migrating the file, not as a separate session.
4. **Action Item L scope creep — hash-column rebuild.** Filed at
   session 2b.5 close per reviewer note. Every existing populated row
   in `email_hash` / `mrn_hash` / `phone_hash` columns today was
   computed using `hashPhiForSearch(value) → scryptSync(value, getEncryptionKey(), 32)`.
   When Action Item L introduces `PHI_HASH_KEY` as a distinct keyring
   member (the F-9 fix bundled into L's scope), `hashPhiForSearch()`
   will switch its KDF input from the encryption key to the hash key.
   **Existing hash values become invalid the moment that switch
   lands** — login by `email_hash`, dedup by `mrn_hash`, SMS lookup
   by `phone_hash` all silently fail until rehash backfill completes.
   Action Item L's session must therefore also:
   - Read every row from every table with a `*_hash` column.
   - Re-derive the hash under `PHI_HASH_KEY`.
   - Write the new hash back atomically per row.
   - Audit and flag every login/dedup/lookup code path that depends
     on these columns; coordinate the cutover so rehash completes
     before the new hash key becomes the default for the lookup
     calls.
   - Estimate: add **30–60 min** to L's session budget. Detection
     checklist: grep for `eq(.*Hash,` and `where.*_hash` across
     `server/` to enumerate the impacted predicates before the
     session starts. (Today: presumably auth0-identity-service.ts
     for email_hash login lookup, dedup-engine for mrn_hash matching,
     SMS routes for phone_hash. Confirm at L kickoff.)

---

## What "F1 = 0" buys us

Once the 179 are zero:
- ESLint guard catches every future regression.
- Every PHI write goes through `encryptPhiRow`.
- Every PHI read goes through `decryptPhiRows`.
- The receiver-name discipline (`phiDb` vs `db`) becomes self-enforcing
  via tooling rather than memory.

It does NOT, by itself, mean PHI is encrypted at rest in production —
that requires Action Item H (the backfill). And H requires Action Item I
(the search audit) first. F1 = 0 is the prerequisite, not the finish
line.
