# Tabula Medica - Safe Migration & QA Plan

## Scope

This plan covers the safe deduplication of patient history/event data, deployment of consolidated UI/logic changes (shared components, streamlined sidebar), and monitoring for the first 72 hours post-launch.

---

## 1. Pre-Migration Steps

### 1.1 Full Database Backup

```bash
# 1. Create a timestamped Postgres dump (all 67 tables)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --file="backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump"

# 2. Verify the backup is valid
pg_restore --list "backup_pre_migration_*.dump" | head -20

# 3. Upload backup to object storage (private bucket)
#    Store in .private/backups/ directory
```

### 1.2 Snapshot In-Memory State

The application uses 153 in-memory `Map` objects in `server/storage.ts` for demo data. These reset on restart, so snapshot them before migration:

```bash
# Export current in-memory state via API
curl -s http://localhost:5000/api/demo/export > inmemory_snapshot_$(date +%s).json
```

### 1.3 Export Sample of Duplicated Records

Run these queries to identify and export duplicate candidates before migration:

```sql
-- Duplicate timeline events (same patient, same date, same type)
SELECT patient_id, event_date, event_type, COUNT(*) as dupe_count
FROM timeline_events
GROUP BY patient_id, event_date, event_type
HAVING COUNT(*) > 1
ORDER BY dupe_count DESC;

-- Duplicate medications (same patient, same name)
SELECT patient_id, medication_name, COUNT(*) as dupe_count
FROM medications_new
GROUP BY patient_id, medication_name
HAVING COUNT(*) > 1;

-- Duplicate vital signs (same patient, same type, same timestamp)
SELECT patient_id, vital_type, recorded_at, COUNT(*) as dupe_count
FROM vital_signs
GROUP BY patient_id, vital_type, recorded_at
HAVING COUNT(*) > 1;

-- Duplicate patient messages
SELECT patient_id, subject, sent_at, COUNT(*) as dupe_count
FROM patient_messages
GROUP BY patient_id, subject, sent_at
HAVING COUNT(*) > 1;
```

Export results:

```bash
psql "$DATABASE_URL" -c "COPY (
  SELECT * FROM timeline_events te
  WHERE EXISTS (
    SELECT 1 FROM timeline_events te2
    WHERE te2.patient_id = te.patient_id
      AND te2.event_date = te.event_date
      AND te2.event_type = te.event_type
      AND te2.id != te.id
  )
) TO STDOUT WITH CSV HEADER" > duplicated_timeline_events_sample.csv
```

### 1.4 Record Baseline Counts

```sql
-- Save these counts to verify post-migration
SELECT 'timeline_events' AS tbl, COUNT(*) FROM timeline_events
UNION ALL SELECT 'medications_new', COUNT(*) FROM medications_new
UNION ALL SELECT 'vital_signs', COUNT(*) FROM vital_signs
UNION ALL SELECT 'patient_messages', COUNT(*) FROM patient_messages
UNION ALL SELECT 'patient_appointments', COUNT(*) FROM patient_appointments
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'hipaa_audit_logs', COUNT(*) FROM hipaa_audit_logs
UNION ALL SELECT 'users', COUNT(*) FROM users
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles;
```

---

## 2. Migration Script Outline

### 2.1 Fingerprinting Strategy

Each record type gets a deterministic fingerprint for deduplication:

```typescript
// server/migration/dedupe-fingerprint.ts

import crypto from "crypto";

interface FingerprintConfig {
  table: string;
  fields: string[];        // fields that define uniqueness
  fuzzyFields?: string[];  // fields compared with similarity threshold
  tiebreaker: string;      // field to pick the "winner" (e.g. updated_at DESC)
}

const FINGERPRINT_CONFIGS: FingerprintConfig[] = [
  {
    table: "timeline_events",
    fields: ["patient_id", "event_type", "event_date"],
    fuzzyFields: ["description"],
    tiebreaker: "created_at DESC",
  },
  {
    table: "medications_new",
    fields: ["patient_id"],
    fuzzyFields: ["medication_name"],  // uses existing normalizeMedicationName()
    tiebreaker: "updated_at DESC",
  },
  {
    table: "vital_signs",
    fields: ["patient_id", "vital_type", "recorded_at"],
    tiebreaker: "id DESC",
  },
  {
    table: "patient_messages",
    fields: ["patient_id", "subject", "sent_at"],
    tiebreaker: "id DESC",
  },
  {
    table: "patient_appointments",
    fields: ["patient_id", "appointment_date", "provider_name"],
    fuzzyFields: ["reason"],
    tiebreaker: "updated_at DESC",
  },
];

function computeFingerprint(record: Record<string, unknown>, fields: string[]): string {
  const normalized = fields
    .map((f) => String(record[f] ?? "").toLowerCase().trim())
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
```

### 2.2 Migration Script (Transactional, Reversible)

```typescript
// server/migration/deduplicate-records.ts

import { db } from "../db";
import { sql } from "drizzle-orm";

interface IdMapping {
  table: string;
  oldId: string;
  newId: string;  // the "winner" ID that survives
  fingerprint: string;
  mergedAt: Date;
}

async function deduplicateTable(config: FingerprintConfig): Promise<IdMapping[]> {
  const mappings: IdMapping[] = [];

  return await db.transaction(async (tx) => {
    // Step 1: Create temp table to hold fingerprints
    await tx.execute(sql`
      CREATE TEMP TABLE dedupe_work (
        id UUID,
        fingerprint TEXT,
        row_rank INTEGER
      ) ON COMMIT DROP
    `);

    // Step 2: Compute fingerprints and rank within each group
    //         ROW_NUMBER() picks the "winner" per group using tiebreaker
    const fieldList = config.fields.join(", ");
    await tx.execute(sql.raw(`
      INSERT INTO dedupe_work (id, fingerprint, row_rank)
      SELECT
        id,
        md5(concat_ws('|', ${fieldList})) AS fingerprint,
        ROW_NUMBER() OVER (
          PARTITION BY md5(concat_ws('|', ${fieldList}))
          ORDER BY ${config.tiebreaker}
        ) AS row_rank
      FROM ${config.table}
    `));

    // Step 3: Identify losers (row_rank > 1) and map to winners (row_rank = 1)
    const dupes = await tx.execute(sql.raw(`
      SELECT
        loser.id AS old_id,
        winner.id AS new_id,
        loser.fingerprint
      FROM dedupe_work loser
      JOIN dedupe_work winner
        ON winner.fingerprint = loser.fingerprint
        AND winner.row_rank = 1
      WHERE loser.row_rank > 1
    `));

    // Step 4: Store ID mappings for rollback and reference updates
    for (const row of dupes.rows) {
      mappings.push({
        table: config.table,
        oldId: row.old_id as string,
        newId: row.new_id as string,
        fingerprint: row.fingerprint as string,
        mergedAt: new Date(),
      });
    }

    // Step 5: Update foreign key references in child tables
    //         (e.g. timeline_event_documents, timeline_event_tags)
    const childTables = CHILD_TABLE_MAP[config.table] || [];
    for (const child of childTables) {
      for (const mapping of mappings) {
        await tx.execute(sql.raw(`
          UPDATE ${child.table}
          SET ${child.fkColumn} = '${mapping.newId}'
          WHERE ${child.fkColumn} = '${mapping.oldId}'
        `));
      }
    }

    // Step 6: Soft-delete losers (move to archive table, don't hard-delete)
    if (mappings.length > 0) {
      const oldIds = mappings.map((m) => `'${m.oldId}'`).join(",");
      await tx.execute(sql.raw(`
        INSERT INTO dedupe_archive (source_table, record_id, record_data, archived_at)
        SELECT '${config.table}', id, row_to_json(${config.table}.*)::jsonb, NOW()
        FROM ${config.table}
        WHERE id IN (${oldIds})
      `));

      await tx.execute(sql.raw(`
        DELETE FROM ${config.table}
        WHERE id IN (${oldIds})
      `));
    }

    return mappings;
  });
}

// Child table FK references that need updating when parent IDs are merged
const CHILD_TABLE_MAP: Record<string, { table: string; fkColumn: string }[]> = {
  timeline_events: [
    { table: "timeline_event_documents", fkColumn: "event_id" },
    { table: "timeline_event_tags", fkColumn: "event_id" },
  ],
  medications_new: [
    { table: "medication_adherence_logs", fkColumn: "medication_id" },
    { table: "medication_interaction_flags", fkColumn: "medication_id" },
    { table: "medication_reminders", fkColumn: "medication_id" },
  ],
  patient_appointments: [
    { table: "engagement_appointment_reminders", fkColumn: "appointment_id" },
  ],
};
```

### 2.3 In-Memory Deduplication

The existing `server/deduplication.ts` already handles medications, allergies, problems, and medical records using Levenshtein similarity. The in-memory maps in `server/storage.ts` should apply this on read:

```typescript
// Apply existing deduplication on aggregated queries
// Already implemented: deduplicateMedications(), deduplicateAllergies(),
// deduplicateProblems(), deduplicateMedicalRecords()
// No migration needed - these dedupe at query time
```

---

## 3. Rollback Steps

### 3.1 Database Rollback

```bash
# Option A: Full restore from backup
pg_restore \
  --clean --if-exists \
  --no-owner \
  --dbname="$DATABASE_URL" \
  "backup_pre_migration_*.dump"

# Option B: Selective rollback from archive table (preferred)
psql "$DATABASE_URL" <<'SQL'
BEGIN;

-- Restore archived records back to their original tables
INSERT INTO timeline_events
SELECT (record_data ->> 'id')::uuid, ...
FROM dedupe_archive
WHERE source_table = 'timeline_events'
  AND archived_at >= '<migration_timestamp>';

-- Reverse FK reference updates using id_mappings
UPDATE timeline_event_documents
SET event_id = m.old_id
FROM dedupe_id_mappings m
WHERE timeline_event_documents.event_id = m.new_id
  AND m.source_table = 'timeline_events';

-- Repeat for each affected table...

COMMIT;
SQL
```

### 3.2 Application Rollback

```bash
# Revert to pre-migration code checkpoint
# Replit checkpoints provide automatic rollback to any previous state
# Use the "View Checkpoints" feature in the Replit UI

# Or revert the deployment
# Replit deployments support instant rollback to previous versions
```

### 3.3 Rollback Decision Matrix

| Signal | Threshold | Action |
|--------|-----------|--------|
| API error rate | > 5% for 10 min | Rollback deployment |
| Missing records reported | Any patient report | Selective rollback from archive |
| FK constraint violations | Any occurrence | Immediate full rollback |
| AI summary failures | > 20% for 30 min | Disable AI features, keep UI |
| Page load failures | > 3% for 5 min | Rollback deployment |

---

## 4. Validation Checks Post-Migration

### 4.1 Count Verification

```sql
-- Compare pre/post counts (expect fewer rows due to dedup)
SELECT 'timeline_events' AS tbl, COUNT(*) AS post_count FROM timeline_events
UNION ALL SELECT 'medications_new', COUNT(*) FROM medications_new
UNION ALL SELECT 'vital_signs', COUNT(*) FROM vital_signs
UNION ALL SELECT 'patient_messages', COUNT(*) FROM patient_messages;

-- Verify no duplicate fingerprints remain
SELECT COUNT(*) AS remaining_dupes
FROM (
  SELECT md5(concat_ws('|', patient_id, event_type, event_date)) AS fp
  FROM timeline_events
  GROUP BY fp
  HAVING COUNT(*) > 1
) sub;
-- Expected: 0

-- Verify archive table has the removed records
SELECT source_table, COUNT(*) AS archived_count
FROM dedupe_archive
GROUP BY source_table;
```

### 4.2 Random Record Spot-Checks

```sql
-- Pull 10 random surviving records and verify data integrity
SELECT * FROM timeline_events
ORDER BY RANDOM()
LIMIT 10;

-- Verify no orphaned child records
SELECT COUNT(*) AS orphaned_docs
FROM timeline_event_documents ted
WHERE NOT EXISTS (
  SELECT 1 FROM timeline_events te WHERE te.id = ted.event_id
);
-- Expected: 0

SELECT COUNT(*) AS orphaned_tags
FROM timeline_event_tags tet
WHERE NOT EXISTS (
  SELECT 1 FROM timeline_events te WHERE te.id = tet.event_id
);
-- Expected: 0

SELECT COUNT(*) AS orphaned_adherence
FROM medication_adherence_logs mal
WHERE NOT EXISTS (
  SELECT 1 FROM medications_new m WHERE m.id = mal.medication_id
);
-- Expected: 0
```

### 4.3 Referential Integrity

```sql
-- Verify all FK references still resolve
SELECT COUNT(*) AS broken_fks
FROM timeline_event_documents d
LEFT JOIN timeline_events e ON d.event_id = e.id
WHERE e.id IS NULL;

SELECT COUNT(*) AS broken_fks
FROM medication_adherence_logs l
LEFT JOIN medications_new m ON l.medication_id = m.id
WHERE m.id IS NULL;

SELECT COUNT(*) AS broken_fks
FROM medication_reminders r
LEFT JOIN medications_new m ON r.medication_id = m.id
WHERE m.id IS NULL;
```

### 4.4 ID Mapping Verification

```sql
-- Verify mapping table is complete
SELECT source_table, COUNT(*) AS mappings
FROM dedupe_id_mappings
GROUP BY source_table;

-- Verify every old_id no longer exists in the source table
SELECT COUNT(*) AS ghost_records
FROM dedupe_id_mappings m
JOIN timeline_events te ON te.id = m.old_id
WHERE m.source_table = 'timeline_events';
-- Expected: 0
```

---

## 5. Automated Tests to Add

### 5.1 Unit Tests - Deduplication Logic

```typescript
// tests/unit/deduplication.test.ts

describe("Deduplication Engine", () => {
  describe("computeFingerprint", () => {
    it("produces identical hashes for records differing only in case", () => {
      const fp1 = computeFingerprint({ name: "Lisinopril", dose: "10mg" }, ["name", "dose"]);
      const fp2 = computeFingerprint({ name: "lisinopril", dose: "10MG" }, ["name", "dose"]);
      expect(fp1).toBe(fp2);
    });

    it("produces different hashes for genuinely different records", () => {
      const fp1 = computeFingerprint({ name: "Lisinopril", dose: "10mg" }, ["name", "dose"]);
      const fp2 = computeFingerprint({ name: "Metformin", dose: "500mg" }, ["name", "dose"]);
      expect(fp1).not.toBe(fp2);
    });

    it("handles null/undefined fields gracefully", () => {
      const fp = computeFingerprint({ name: null, dose: undefined }, ["name", "dose"]);
      expect(fp).toBeDefined();
    });
  });

  describe("deduplicateMedications (existing)", () => {
    it("merges brand and generic names into one group", () => {
      const meds = [
        mockMed({ name: "Lisinopril 10mg", sourceFacility: "Hospital A" }),
        mockMed({ name: "Zestril 10mg", sourceFacility: "Hospital B" }),
      ];
      const { groups } = deduplicateMedications(meds);
      expect(groups.length).toBe(1);
      expect(groups[0].totalCount).toBe(2);
    });

    it("keeps distinct medications separate", () => {
      const meds = [
        mockMed({ name: "Lisinopril 10mg", sourceFacility: "A" }),
        mockMed({ name: "Metformin 500mg", sourceFacility: "B" }),
      ];
      const { groups } = deduplicateMedications(meds);
      expect(groups.length).toBe(2);
    });

    it("picks the active medication as primary", () => {
      const meds = [
        mockMed({ name: "Lisinopril", status: "discontinued", sourceFacility: "A" }),
        mockMed({ name: "Lisinopril", status: "active", sourceFacility: "B" }),
      ];
      const { groups } = deduplicateMedications(meds);
      expect(groups[0].primaryItem.status).toBe("active");
    });

    it("detects dosage conflicts between sources", () => {
      const meds = [
        mockMed({ name: "Lisinopril", dosage: "10mg", sourceFacility: "A" }),
        mockMed({ name: "Lisinopril", dosage: "20mg", sourceFacility: "B" }),
      ];
      const { stats } = deduplicateMedications(meds);
      expect(stats.conflictsDetected).toBeGreaterThan(0);
    });
  });

  describe("ID Mapping", () => {
    it("maps all loser IDs to a single winner ID", () => {
      const mappings = buildIdMappings(dupeGroup);
      const winnerIds = new Set(mappings.map((m) => m.newId));
      expect(winnerIds.size).toBe(1);
    });

    it("preserves the most recently updated record as winner", () => {
      const mappings = buildIdMappings(dupeGroupWithDates);
      const winner = mappings[0].newId;
      expect(winner).toBe(mostRecentRecordId);
    });
  });
});
```

### 5.2 API Contract Tests

```typescript
// tests/api/health-records.test.ts

describe("Health Records API - Post-Dedup", () => {
  describe("GET /api/health-records/:patientId/timeline", () => {
    it("returns 200 with deduplicated events", async () => {
      const res = await request(app).get("/api/health-records/test-patient/timeline");
      expect(res.status).toBe(200);
      expect(res.body.events).toBeDefined();

      // Verify no duplicate fingerprints in response
      const fingerprints = res.body.events.map((e: any) =>
        `${e.eventType}|${e.eventDate}`
      );
      const unique = new Set(fingerprints);
      expect(unique.size).toBe(fingerprints.length);
    });
  });

  describe("GET /api/health-records/:patientId/medications", () => {
    it("returns deduplicated medication list", async () => {
      const res = await request(app).get("/api/health-records/test-patient/medications");
      expect(res.status).toBe(200);

      // No two medications with the same normalized name
      const names = res.body.map((m: any) => m.name.toLowerCase().trim());
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe("GET /api/secure-health-records/:patientId", () => {
    it("validates patient ID format", async () => {
      const res = await request(app).get("/api/secure-health-records/INVALID!");
      expect(res.status).toBe(400);
    });

    it("returns security headers", async () => {
      const res = await request(app).get("/api/secure-health-records/PAT-001");
      expect(res.headers["cache-control"]).toContain("no-store");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });
  });
});
```

### 5.3 E2E Tests for Streamlined Flows

```typescript
// tests/e2e/streamlined-navigation.test.ts (Playwright)

test.describe("Streamlined Navigation", () => {
  test("sidebar shows consolidated sections", async ({ page }) => {
    await page.goto("/");
    // After auth...
    const sidebar = page.locator("[data-testid='sidebar']");
    await expect(sidebar.getByText("Main Navigation")).toBeVisible();
    await expect(sidebar.getByText("Health Data")).toBeVisible();
    await expect(sidebar.getByText("Care & Communication")).toBeVisible();
    // Removed sections should not appear
    await expect(sidebar.getByText("FHIR Data Pipeline")).not.toBeVisible();
    await expect(sidebar.getByText("Bidirectional FHIR Sync")).not.toBeVisible();
  });

  test("Health Records page loads with deduplicated data", async ({ page }) => {
    await page.goto("/health-records");
    await expect(page.locator("[data-testid='health-records-page']")).toBeVisible();
    // Verify shared components render
    await expect(page.locator("[data-testid='page-header']")).toBeVisible();
  });

  test("My Health Record page renders correctly", async ({ page }) => {
    await page.goto("/my-health-record");
    await expect(page.locator("[data-testid='health-record-page']")).toBeVisible();
  });

  test("all sidebar links navigate to valid pages", async ({ page }) => {
    const sidebarLinks = [
      "/my-health-record", "/health-records", "/timeline", "/documents",
      "/medications", "/conditions", "/lab-results", "/vitals",
      "/messages", "/patient-telehealth-portal", "/care-team-hub",
      "/find-provider", "/assessments", "/rewards",
      "/provider-portal", "/clinician-dashboard", "/patients",
      "/admin-analytics", "/compliance-dashboard",
      "/accessibility", "/security", "/privacy", "/privacy-policy",
    ];
    for (const path of sidebarLinks) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
    }
  });
});
```

---

## 6. Monitoring & Alerting (First 72 Hours)

### 6.1 Error Rate Monitoring

```typescript
// server/monitoring/post-launch-monitor.ts

interface LaunchMetrics {
  apiErrorRate: number;       // Target: < 1%
  apiLatencyP95: number;      // Target: < 2000ms
  aiSummaryFailRate: number;  // Target: < 5%
  pageLoadErrors: number;     // Target: 0
  fkViolations: number;       // Target: 0
}

// Express middleware to track error rates
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    metrics.recordRequest({
      path: req.path,
      method: req.method,
      status: res.statusCode,
      duration,
      isError: res.statusCode >= 500,
      timestamp: new Date(),
    });
  });
  next();
});
```

### 6.2 Key Metrics to Watch

| Metric | Warning | Critical | Check Interval |
|--------|---------|----------|----------------|
| API 5xx error rate | > 1% | > 5% | Every 1 min |
| API P95 latency | > 1500ms | > 3000ms | Every 1 min |
| AI summary generation failures | > 10% | > 25% | Every 5 min |
| Page load errors (frontend) | > 1% | > 3% | Every 1 min |
| FK constraint violations | Any | Any | Every 5 min |
| Missing record reports (user) | Any | 3+ in 1 hr | On occurrence |
| Dedupe archive growth | > 1000/hr | > 5000/hr | Every 15 min |

### 6.3 Health Check Endpoints

```typescript
// Add to server/routes.ts
app.get("/api/health/migration", async (req, res) => {
  const checks = {
    database: await checkDbConnection(),
    orphanedRecords: await countOrphanedRecords(),
    duplicatesRemaining: await countRemainingDuplicates(),
    archiveIntegrity: await verifyArchiveIntegrity(),
    fkIntegrity: await checkForeignKeyIntegrity(),
    timestamp: new Date().toISOString(),
  };

  const healthy = checks.orphanedRecords === 0
    && checks.duplicatesRemaining === 0
    && checks.fkIntegrity;

  res.status(healthy ? 200 : 503).json(checks);
});
```

### 6.4 Automated Alerts

```typescript
// Periodic health check (runs every 5 minutes for 72 hours)
const MONITORING_DURATION_MS = 72 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function runPostLaunchMonitoring() {
  const startTime = Date.now();

  const interval = setInterval(async () => {
    if (Date.now() - startTime > MONITORING_DURATION_MS) {
      clearInterval(interval);
      console.log("[PostLaunch] 72-hour monitoring period complete");
      return;
    }

    const health = await fetch("/api/health/migration").then(r => r.json());

    if (health.orphanedRecords > 0) {
      await sendAlert("CRITICAL", `${health.orphanedRecords} orphaned records detected`);
    }
    if (health.duplicatesRemaining > 0) {
      await sendAlert("WARNING", `${health.duplicatesRemaining} duplicate groups still exist`);
    }
    if (!health.fkIntegrity) {
      await sendAlert("CRITICAL", "Foreign key integrity check failed");
    }
  }, CHECK_INTERVAL_MS);
}
```

---

## 7. Launch Checklist

### Pre-Launch (Day Before)

- [ ] Full database backup completed and verified
- [ ] In-memory state snapshot exported
- [ ] Duplicate record sample exported and reviewed
- [ ] Baseline record counts documented
- [ ] `dedupe_archive` table created in database
- [ ] `dedupe_id_mappings` table created in database
- [ ] Migration script tested against staging/copy of production data
- [ ] All unit tests passing (deduplication logic)
- [ ] All API contract tests passing
- [ ] Auth0 callback URL updated for production domain
- [ ] Shared component library verified (StatusBadge, FlagBadge, etc.)
- [ ] Sidebar navigation verified (all 39 links resolve to valid routes)

### Launch Day

- [ ] Announce maintenance window (if applicable)
- [ ] Run migration script in a single transaction
- [ ] Verify post-migration counts match expectations
- [ ] Run orphaned record checks (all return 0)
- [ ] Run FK integrity checks (all pass)
- [ ] Verify `/api/health/migration` returns 200
- [ ] Deploy updated frontend (consolidated sidebar, shared components)
- [ ] Smoke test: load Home, Health Records, Timeline, Medications pages
- [ ] Smoke test: AI summary generation works
- [ ] Enable 72-hour monitoring
- [ ] Verify no error spikes in first 15 minutes

### Post-Launch (72 Hours)

- [ ] Review error rate trends daily
- [ ] Check for user-reported missing records
- [ ] Verify AI summary quality hasn't degraded
- [ ] Review dedupe_archive for any records that need restoration
- [ ] After 72 hours: disable enhanced monitoring, keep standard alerts
- [ ] After 7 days: if no issues, mark migration as stable
- [ ] After 30 days: consider purging dedupe_archive (with final backup)

---

## 8. Rollback Cutover Plan

### Trigger Conditions

Initiate rollback if ANY of the following occur within 72 hours:

1. API error rate exceeds 5% for more than 10 consecutive minutes
2. Any patient reports missing health records
3. FK constraint violations detected (any count > 0)
4. AI summary failures exceed 25% for 30 minutes
5. Data integrity check (`/api/health/migration`) returns 503

### Rollback Procedure (Estimated: 15-30 minutes)

```
Step 1: Announce rollback decision (Slack/internal channel)
        Time: 0 min

Step 2: Stop application traffic (put in maintenance mode)
        Time: +1 min

Step 3: Assess scope
        - If only data issue: Use selective rollback from dedupe_archive
        - If code + data issue: Use full restore
        Time: +3 min

Step 4a: Selective Rollback (data only)
        - Restore records from dedupe_archive
        - Reverse FK mappings using dedupe_id_mappings
        - Verify counts match pre-migration baseline
        Time: +10 min

Step 4b: Full Rollback (code + data)
        - Restore database from pg_dump backup
        - Revert to pre-migration code checkpoint (Replit checkpoints)
        - Restart application
        Time: +15 min

Step 5: Verify rollback
        - Run baseline count comparison
        - Run FK integrity checks
        - Smoke test key pages
        Time: +5 min

Step 6: Resume traffic
        Time: +2 min

Step 7: Post-mortem within 24 hours
        - Document what triggered rollback
        - Identify root cause
        - Plan fix before re-attempting migration
```

### Rollback Communication Template

```
Subject: [Tabula Medica] Data Migration Rollback - [DATE]

Status: Rollback initiated at [TIME]
Reason: [Brief description of trigger]
Impact: [What users may have experienced]
Resolution: All data restored to pre-migration state
ETA for re-attempt: [TBD after post-mortem]
```

---

## Architecture Notes

- **Hybrid storage**: 67 Postgres tables + 153 in-memory Maps (demo data)
- **Existing dedup engine**: `server/deduplication.ts` handles medications, allergies, problems, medical records with Levenshtein similarity at query time
- **FHIR dedup**: `server/fhir/deduplication-service.ts` for FHIR resource deduplication
- **Patient dedup**: NMN standard implementation at `/api/deduplication/*`
- **Shared components**: `client/src/components/shared/` (StatusBadge, FlagBadge, format-helpers, StatCardGrid, DataFiltersBar, PageHeader, LoadingState, EmptyState, WizardShell, ExpandableCard)
- **Sidebar**: Reduced from ~150 to ~39 items across 7 sections
