# Tabula Medica — Safe Migration & QA Plan

**Version:** 1.0  
**Date:** 2026-02-17  
**Scope:** Remove duplicated health records and patient profiles, deploy streamlined UI/logic changes, and ensure data integrity throughout.

---

## 1. Pre-Migration Steps

### 1.1 Full Database Backup

```sql
-- Run via Replit Postgres tooling or pg_dump
-- Captures all 804 health_records, 25 patient_profiles, 437 audit_logs

-- Option A: Replit checkpoint (automatic, recommended)
-- A checkpoint is created before every migration run.

-- Option B: Logical export of critical tables
COPY health_records        TO '/tmp/backup_health_records.csv'        WITH CSV HEADER;
COPY patient_profiles      TO '/tmp/backup_patient_profiles.csv'      WITH CSV HEADER;
COPY patient_identifiers   TO '/tmp/backup_patient_identifiers.csv'   WITH CSV HEADER;
COPY duplicate_candidates  TO '/tmp/backup_duplicate_candidates.csv'  WITH CSV HEADER;
COPY patient_merge_history TO '/tmp/backup_patient_merge_history.csv' WITH CSV HEADER;
COPY record_attachments    TO '/tmp/backup_record_attachments.csv'    WITH CSV HEADER;
COPY audit_logs            TO '/tmp/backup_audit_logs.csv'            WITH CSV HEADER;
```

### 1.2 Export Sample of Duplicated Records

Run the following queries to identify and export duplicates before making any changes:

```sql
-- 1A. Health Record duplicates (same user + type + title + date)
SELECT user_id, type, title, date, COUNT(*) AS dup_count,
       ARRAY_AGG(id ORDER BY created_at ASC) AS record_ids
FROM health_records
GROUP BY user_id, type, title, date
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;

-- 1B. Near-duplicates using content fingerprint (type + title + provider + date)
SELECT user_id, type, title, provider, DATE(date) AS record_date,
       COUNT(*) AS dup_count,
       ARRAY_AGG(id ORDER BY created_at ASC) AS record_ids
FROM health_records
GROUP BY user_id, type, title, provider, DATE(date)
HAVING COUNT(*) > 1;

-- 1C. FHIR resource ID duplicates (same source importing twice)
SELECT user_id, fhir_resource_type, fhir_resource_id, source_id,
       COUNT(*) AS dup_count,
       ARRAY_AGG(id ORDER BY created_at ASC) AS record_ids
FROM health_records
WHERE fhir_resource_id IS NOT NULL
GROUP BY user_id, fhir_resource_type, fhir_resource_id, source_id
HAVING COUNT(*) > 1;

-- 1D. Patient Profile duplicates (MPI — same name + DOB)
SELECT LOWER(first_name), LOWER(last_name), DATE(date_of_birth),
       COUNT(*) AS dup_count,
       ARRAY_AGG(id ORDER BY created_at ASC) AS profile_ids
FROM patient_profiles
GROUP BY LOWER(first_name), LOWER(last_name), DATE(date_of_birth)
HAVING COUNT(*) > 1;

-- Save results for audit trail
-- COPY (<any query above>) TO '/tmp/pre_migration_duplicates.csv' WITH CSV HEADER;
```

### 1.3 Freeze Incoming Data

- Pause any background sync jobs (zero-click discovery, FHIR connectors, wearable syncs).
- Put the reminder processor into read-only mode.
- Announce a short maintenance window if in production.

---

## 2. Migration Script Outline

### 2.1 Health Record Deduplication

The fingerprint is computed as:  
`SHA-256( user_id || type || LOWER(TRIM(title)) || DATE(date) || COALESCE(LOWER(TRIM(provider)), '') )`

For FHIR-sourced records, an alternative deterministic key is:  
`user_id || source_id || fhir_resource_type || fhir_resource_id`

#### Algorithm

```
BEGIN TRANSACTION;

-- Step 1: Add fingerprint column
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS dedup_fingerprint VARCHAR;

-- Step 2: Compute fingerprints
UPDATE health_records
SET dedup_fingerprint = ENCODE(
  SHA256(
    (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
  ),
  'hex'
);

-- Step 3: Identify keeper records (oldest created_at wins per fingerprint per user)
-- This is a dry-run query — log results before acting
WITH ranked AS (
  SELECT id, dedup_fingerprint, user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, dedup_fingerprint
           ORDER BY
             CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,  -- prefer FHIR-sourced
             CASE WHEN is_manual = true THEN 0 ELSE 1 END,              -- prefer manually entered
             created_at ASC                                              -- oldest wins
         ) AS rn
  FROM health_records
)
SELECT id, dedup_fingerprint, user_id, rn
FROM ranked
WHERE rn > 1;
-- ^^ These are the records that will be removed.

-- Step 4: Build ID mapping table (old_id → keeper_id)
CREATE TEMP TABLE dedup_id_map AS
WITH ranked AS (
  SELECT id, dedup_fingerprint, user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, dedup_fingerprint
           ORDER BY
             CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
             CASE WHEN is_manual = true THEN 0 ELSE 1 END,
             created_at ASC
         ) AS rn,
         FIRST_VALUE(id) OVER (
           PARTITION BY user_id, dedup_fingerprint
           ORDER BY
             CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
             CASE WHEN is_manual = true THEN 0 ELSE 1 END,
             created_at ASC
         ) AS keeper_id
  FROM health_records
)
SELECT id AS old_id, keeper_id
FROM ranked
WHERE rn > 1;

-- Step 5: Re-point foreign key references before deleting
-- record_attachments (CASCADE will auto-delete, but log first)
-- record_conflicts (recordId → keeper)
UPDATE record_conflicts SET record_id = m.keeper_id
FROM dedup_id_map m WHERE record_conflicts.record_id = m.old_id;

-- medication_reminders (health_record_id → SET NULL on delete, but remap if desired)
UPDATE medication_reminders SET health_record_id = m.keeper_id
FROM dedup_id_map m WHERE medication_reminders.health_record_id = m.old_id;

-- appointment_reminders (health_record_id → SET NULL on delete, but remap)
UPDATE appointment_reminders SET health_record_id = m.keeper_id
FROM dedup_id_map m WHERE appointment_reminders.health_record_id = m.old_id;

-- duplicate_test_checks (trigger_event_id)
UPDATE duplicate_test_checks SET trigger_event_id = m.keeper_id
FROM dedup_id_map m WHERE duplicate_test_checks.trigger_event_id = m.old_id;

-- record_quality_scores (health_record_id)
UPDATE record_quality_scores SET health_record_id = m.keeper_id
FROM dedup_id_map m WHERE record_quality_scores.health_record_id = m.old_id;

-- Step 6: Archive duplicate records (soft-delete or export)
-- INSERT INTO health_records_archive SELECT * FROM health_records WHERE id IN (SELECT old_id FROM dedup_id_map);

-- Step 7: Delete duplicates (CASCADE handles attachments, record_provenance)
DELETE FROM health_records WHERE id IN (SELECT old_id FROM dedup_id_map);

-- Step 8: Log the migration
INSERT INTO deduplication_runs (run_type, status, total_records_scanned, duplicates_found, auto_merged, started_at, completed_at, configuration)
VALUES (
  'full_scan', 'completed',
  (SELECT COUNT(*) FROM health_records),
  (SELECT COUNT(*) FROM dedup_id_map),
  (SELECT COUNT(*) FROM dedup_id_map),
  NOW(), NOW(),
  '{"strategy": "fingerprint", "fields": ["user_id","type","title","date","provider"]}'::JSONB
);

COMMIT;
```

### 2.2 Patient Profile Deduplication (MPI)

Uses the existing `DeduplicationService` which already implements:
- **Pass 1 — Deterministic:** Exact match on identifiers (MRN, SSN last 4, email+DOB).
- **Pass 2 — Probabilistic:** Weighted Levenshtein across firstName (0.20), lastName (0.25), middleName (0.10), DOB (0.25), email (0.15), phone (0.05).
- **Thresholds:** >= 95% auto-merge, 80-95% flag for review, < 80% new record.

```
-- Trigger via existing API
POST /api/deduplication/scan

-- Or run programmatically:
const service = DeduplicationService.getInstance();
await service.runBatchDeduplication(triggeredByUserId);
```

The service already creates `patient_merge_history` entries with full data snapshots and field resolutions for undo capability.

---

## 3. Rollback Steps

### 3.1 Replit Checkpoint Rollback (Preferred)

Replit automatically creates a checkpoint before each migration. To rollback:
1. Open the Checkpoints panel in Replit.
2. Select the checkpoint created immediately before the migration.
3. Rollback code, database, and chat state together.

### 3.2 Manual Rollback (If Checkpoint Unavailable)

```sql
-- Step A: Restore deleted health records from archive
INSERT INTO health_records SELECT * FROM health_records_archive;

-- Step B: Reverse FK remapping using the dedup_id_map
-- (Only needed if archive table was used instead of checkpoint)
UPDATE record_conflicts SET record_id = m.old_id
FROM dedup_id_map m WHERE record_conflicts.record_id = m.keeper_id
  AND m.old_id != m.keeper_id;

-- Repeat for each remapped table...

-- Step C: Undo patient merges via existing service
POST /api/deduplication/resolve/:mergeId  { "action": "undo" }
-- The patientMergeHistory table stores full data snapshots for undo.

-- Step D: Remove fingerprint column if added
ALTER TABLE health_records DROP COLUMN IF EXISTS dedup_fingerprint;
```

### 3.3 Rollback Decision Criteria

Trigger a rollback if any of the following occur within 72 hours:

| Signal | Threshold | Action |
|--------|-----------|--------|
| Missing records reported by users | Any report | Immediate rollback |
| API error rate increase | > 2x baseline | Investigate, rollback if sustained > 15 min |
| AI summary failure rate | > 10% of requests | Investigate AI context pipeline |
| Broken FK references | Any orphaned reference | Targeted fix or rollback |
| Health record count drop > expected | More than dedup_id_map count | Immediate rollback |

---

## 4. Validation Checks (Post-Migration)

Run these immediately after migration and again at T+24h and T+72h.

### 4.1 Record Count Verification

```sql
-- Total records should equal: pre_migration_count - dedup_id_map count
SELECT COUNT(*) AS post_migration_count FROM health_records;

-- Per-user counts should never drop to zero (no user should lose all records)
SELECT user_id, COUNT(*) AS record_count
FROM health_records
GROUP BY user_id
ORDER BY record_count ASC
LIMIT 10;

-- Per-type distribution should remain proportional
SELECT type, COUNT(*) AS cnt FROM health_records GROUP BY type ORDER BY cnt DESC;
```

### 4.2 Fingerprint Uniqueness

```sql
-- After dedup, no fingerprint should appear more than once per user
SELECT user_id, dedup_fingerprint, COUNT(*) AS cnt
FROM health_records
GROUP BY user_id, dedup_fingerprint
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### 4.3 Foreign Key Integrity

```sql
-- No orphaned attachments
SELECT COUNT(*) FROM record_attachments ra
LEFT JOIN health_records hr ON ra.record_id = hr.id
WHERE hr.id IS NULL;
-- Expected: 0

-- No orphaned medication reminders
SELECT COUNT(*) FROM medication_reminders mr
WHERE mr.health_record_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM health_records hr WHERE hr.id = mr.health_record_id);
-- Expected: 0

-- No orphaned quality scores
SELECT COUNT(*) FROM record_quality_scores rqs
WHERE NOT EXISTS (SELECT 1 FROM health_records hr WHERE hr.id = rqs.health_record_id);
-- Expected: 0
```

### 4.4 Random Record Spot Checks

```sql
-- Pull 10 random records and verify they have valid data
SELECT id, user_id, type, title, date, provider, source_id, fhir_resource_id
FROM health_records
ORDER BY RANDOM()
LIMIT 10;

-- Verify merged patient profiles retained best data
SELECT id, first_name, last_name, date_of_birth, email, phone
FROM patient_profiles
WHERE id IN (SELECT survivor_patient_id FROM patient_merge_history)
ORDER BY created_at DESC
LIMIT 5;
```

### 4.5 AI Context Integrity

```sql
-- Verify AI conversations still reference valid records
SELECT ac.id, ac.context, COUNT(am.id) AS message_count
FROM ai_conversations ac
LEFT JOIN ai_messages am ON am.conversation_id = ac.id
GROUP BY ac.id, ac.context
ORDER BY message_count DESC
LIMIT 10;
```

### 4.6 Audit Trail Completeness

```sql
-- Confirm deduplication run was logged
SELECT * FROM deduplication_runs ORDER BY started_at DESC LIMIT 1;

-- Confirm merge history entries exist for every merge
SELECT COUNT(*) FROM patient_merge_history WHERE is_undone = false;
```

---

## 5. Automated Tests to Add

### 5.1 Unit Tests — Deduplication Logic

| Test | What It Covers |
|------|---------------|
| `fingerprint-generation.test.ts` | Same input always produces same hash; different inputs produce different hashes; null provider handled gracefully |
| `levenshtein-similarity.test.ts` | Exact match = 1.0; completely different = ~0.0; known distance pairs verified; empty strings handled |
| `match-threshold.test.ts` | Score >= 0.95 returns `auto_merge`; 0.80–0.94 returns `flag_for_review`; < 0.80 returns `create_new` |
| `merge-field-resolution.test.ts` | Survivor keeps non-null values; merged non-null fills survivor gaps; snapshot captures full merged data |
| `keeper-selection.test.ts` | FHIR-sourced preferred over manual; oldest record wins in tie; single record per fingerprint after dedup |

### 5.2 API Contract Tests

| Endpoint | Assertions |
|----------|------------|
| `GET /api/health-records` | Returns array; no duplicate fingerprints per user; each record has required fields (id, type, title, date) |
| `POST /api/deduplication/scan` | Returns 200 with `{ autoMerged, flaggedForReview, newRecords, errors }`; creates `deduplication_runs` entry |
| `POST /api/deduplication/merge/:id` | Returns 200; creates `patient_merge_history` entry; updates `duplicate_candidates` status |
| `POST /api/ai-history/chat` | Returns 200 with `{ message, conversationId, disclaimer }`; disclaimer present; referencedRecords contain valid IDs |
| `GET /api/ai-history/prompts` | Returns array of prompts; each has `category`, `text`, `icon`; categories match expected set |
| `GET /api/deduplication/stats` | Returns counts; `pending` count matches `duplicate_candidates` where status = 'pending' |

### 5.3 End-to-End Tests (Playwright)

| Flow | Steps |
|------|-------|
| **Dedup Center Review** | Navigate to Profile → Dedup Center → Verify pending candidates list → Approve a merge → Confirm record count decreases by 1 → Verify merge history entry appears |
| **Health Record Timeline** | Navigate to Health Record → Verify no visible duplicate entries (same title+date should not appear twice) → Scroll through timeline → Tap a record → Verify detail view loads |
| **AI History Assistant** | Navigate to Profile → Health History Assistant → Verify prompt cards render → Tap a prompt → Verify chat response appears with disclaimer → Verify referenced records link to valid records |
| **Patient Profile Integrity** | Navigate to My Profile → Verify all fields populated → Check that merged data shows most complete version |
| **Post-Merge Search** | Use Natural Language Query → Search for a record that was deduplicated → Verify it returns the keeper record, not the deleted one |

---

## 6. Monitoring & Alerting (First 72 Hours)

### 6.1 Error Rate Monitoring

| Metric | Baseline | Alert Threshold | Channel |
|--------|----------|-----------------|---------|
| API 5xx error rate | < 0.1% | > 1% for 5 min | Console log + audit_logs |
| API 4xx error rate | ~5% (auth) | > 15% for 5 min | Console log |
| Unhandled exceptions | 0 | Any | Console log + process.on('uncaughtException') |

### 6.2 API Latency Monitoring

| Endpoint Group | P50 Baseline | P95 Alert | P99 Alert |
|---------------|-------------|-----------|-----------|
| `/api/health-records/*` | ~100ms | > 500ms | > 2s |
| `/api/deduplication/*` | ~200ms | > 1s | > 5s |
| `/api/ai-history/*` | ~2s (GPT-4o) | > 8s | > 15s |
| `/api/ai-health/*` | ~2s (GPT-4o) | > 8s | > 15s |

**Implementation:** Add middleware timing to Express:

```typescript
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms (status: ${res.statusCode})`);
    }
  });
  next();
});
```

### 6.3 AI Summary Failure Monitoring

| Signal | Detection | Response |
|--------|-----------|----------|
| OpenAI API timeout | Response > 30s or connection error | Log, retry once, return graceful fallback message |
| Empty AI response | `completion.choices[0]?.message?.content` is null/empty | Log as `ai_empty_response`, return fallback |
| AI context too large | Token count exceeds model limit | Truncate oldest records, log truncation |
| AI conversation creation failure | DB insert fails | Log error, return 500 with actionable message |

**Log queries for monitoring dashboard:**

```sql
-- AI failures in last 24h
SELECT action, COUNT(*) AS failure_count, MAX(created_at) AS last_seen
FROM audit_logs
WHERE action IN ('ai_history_chat', 'ai_health_chat')
  AND created_at > NOW() - INTERVAL '24 hours'
  AND metadata->>'error' IS NOT NULL
GROUP BY action;

-- Deduplication activity in last 72h
SELECT run_type, status, duplicates_found, auto_merged, flagged_for_review, started_at
FROM deduplication_runs
WHERE started_at > NOW() - INTERVAL '72 hours'
ORDER BY started_at DESC;
```

### 6.4 Data Integrity Canary Checks (Automated, Every 6 Hours)

```sql
-- Run as a scheduled check and alert if any return non-zero
SELECT 'orphaned_attachments' AS check_name,
  (SELECT COUNT(*) FROM record_attachments ra
   LEFT JOIN health_records hr ON ra.record_id = hr.id
   WHERE hr.id IS NULL) AS count
UNION ALL
SELECT 'duplicate_fingerprints',
  (SELECT COUNT(*) FROM (
    SELECT user_id, dedup_fingerprint FROM health_records
    GROUP BY user_id, dedup_fingerprint HAVING COUNT(*) > 1
  ) dups)
UNION ALL
SELECT 'zero_record_users',
  (SELECT COUNT(DISTINCT u.id) FROM users u
   LEFT JOIN health_records hr ON hr.user_id = u.id
   WHERE hr.id IS NULL AND u.id IN (
     SELECT DISTINCT user_id FROM audit_logs WHERE action = 'health_record_create'
   ));
```

---

## 7. Launch Checklist

### Pre-Launch (Day -1)

- [ ] Replit checkpoint created (automatic)
- [ ] Pre-migration duplicate queries run and results exported
- [ ] Background sync jobs paused (FHIR connectors, wearable sync, zero-click discovery)
- [ ] Reminder processor set to read-only
- [ ] Team notified of maintenance window
- [ ] Rollback procedure reviewed and printed

### Migration Execution (Day 0)

- [ ] Run fingerprint computation on health_records
- [ ] Review dry-run output of records to be removed (log keeper IDs + removed IDs)
- [ ] Execute FK remapping for dependent tables
- [ ] Delete duplicate health_records
- [ ] Run MPI batch deduplication via `/api/deduplication/scan`
- [ ] Verify deduplication_runs entry created with correct counts
- [ ] Run all 6 validation check categories (Section 4)

### Post-Launch Verification (Day 0, T+1h)

- [ ] API health check returns 200 on all major endpoints
- [ ] Random spot-check: 10 health records load correctly in UI
- [ ] AI History Assistant responds to a test prompt
- [ ] AI Health Assistant responds to a test prompt
- [ ] Dedup Center shows updated (reduced) pending count
- [ ] Health Record timeline shows no visible duplicates
- [ ] Express latency middleware active and logging

### Monitoring Active (Days 0–3)

- [ ] Console logs monitored for `[SLOW]` entries
- [ ] Error rate check at T+1h, T+6h, T+12h, T+24h, T+48h, T+72h
- [ ] Canary integrity queries run at T+6h intervals
- [ ] AI failure rate reviewed at T+24h
- [ ] No user-reported missing records

### All Clear (Day 3)

- [ ] 72-hour monitoring period complete with no rollback triggers hit
- [ ] Resume background sync jobs
- [ ] Resume reminder processor normal operation
- [ ] Drop `dedup_id_map` temp table and `health_records_archive` if used
- [ ] Update replit.md with migration completion date
- [ ] Close maintenance window

---

## 8. Rollback Cutover Plan

**Decision authority:** Any team member can trigger rollback if a critical threshold is met.

| Time Window | Rollback Method | Expected Downtime |
|-------------|----------------|-------------------|
| T+0 to T+1h | Replit checkpoint rollback (DB + code) | ~2 minutes |
| T+1h to T+24h | Replit checkpoint + re-run sync jobs | ~5 minutes |
| T+24h to T+72h | Manual SQL restore from archive + FK reversal | ~15 minutes |
| T+72h+ | Full backup restore (if archive purged) | ~30 minutes |

**Cutover steps:**

1. **Stop all traffic:** Set Express to return 503 on all API routes.
2. **Assess scope:** Is it health records, patient profiles, or both?
3. **Execute rollback:** Use the appropriate method from the table above.
4. **Verify restoration:** Run Section 4 validation checks against pre-migration baseline counts.
5. **Resume traffic:** Remove 503 mode, verify API responses.
6. **Post-mortem:** Document what triggered the rollback, root cause, and prevention plan.

---

## Current Database State (Reference)

| Table | Count |
|-------|-------|
| health_records | 804 |
| patient_profiles | 25 |
| duplicate_candidates | 0 |
| patient_merge_history | 0 |
| deduplication_runs | 0 |
| audit_logs | 437 |
| record_attachments | 0 |
| ai_conversations | 0 |
| ai_messages | 0 |
| Unique users with records | 155 |

**Record type distribution:** visit (157), medication (156), immunization (156), lab (156), imaging (155), intake (22), vital (1), dental (1).

**Current exact-match duplicates (user+type+title+date):** 0 detected.  
Note: Near-duplicates requiring fuzzy matching may still exist and will be caught by the fingerprint strategy above.

---

## 9. Implementation References (2026-02-17)

### Executable Scripts & Middleware

| Component | File | Description |
|-----------|------|-------------|
| **Migration Script** | `server/migrations/run-deduplication.ts` | SHA-256 fingerprinting, dry-run mode, FK remapping across 5 dependent tables, deduplication_runs audit logging, count verification |
| **Monitoring Middleware** | `server/monitoring-middleware.ts` | Per-route latency bucketing, slow request logging (>2s), error rate tracking, 6-hour canary integrity checks |
| **Integration** | `server/routes.ts` | Middleware registered at app startup; canary scheduler auto-starts; 3 new API endpoints added |

### API Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/migration/dedup` | POST | Required | Run deduplication (body: `{ dryRun: true/false }`) |
| `/api/migration/validate` | GET | Required | Run all integrity checks + record stats |
| `/api/monitoring/latency` | GET | Required | View latency buckets, error rates, alerts |

### Dry-Run Results (2026-02-17)

- **Total records scanned:** 804
- **Fingerprints computed:** 804
- **Duplicates found:** 0
- **All integrity checks:** PASSED (orphaned attachments: 0, duplicate fingerprints: 0, zero-record users: 0, orphaned med reminders: 0, orphaned quality scores: 0)
- **Canary check status:** Running (6-hour interval), initial check passed
