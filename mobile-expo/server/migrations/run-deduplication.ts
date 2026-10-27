import { db } from "../db";
import { sql } from "drizzle-orm";
import { createHash } from "crypto";

interface DedupStats {
  totalRecords: number;
  fingerprintsComputed: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  fkRemapped: {
    recordConflicts: number;
    medicationReminders: number;
    appointmentReminders: number;
    duplicateTestChecks: number;
    recordQualityScores: number;
  };
  errors: string[];
}

function computeFingerprint(
  userId: string,
  type: string,
  title: string,
  date: string,
  provider: string | null,
): string {
  const normalized = [
    userId,
    type,
    (title || "").toLowerCase().trim(),
    date,
    (provider || "").toLowerCase().trim(),
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function runDeduplication(options: {
  dryRun?: boolean;
  sampleExportLimit?: number;
} = {}): Promise<DedupStats> {
  const { dryRun = true, sampleExportLimit = 100 } = options;
  const stats: DedupStats = {
    totalRecords: 0,
    fingerprintsComputed: 0,
    duplicatesFound: 0,
    duplicatesRemoved: 0,
    fkRemapped: {
      recordConflicts: 0,
      medicationReminders: 0,
      appointmentReminders: 0,
      duplicateTestChecks: 0,
      recordQualityScores: 0,
    },
    errors: [],
  };

  try {
    const countResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM health_records`);
    stats.totalRecords = parseInt(countResult.rows[0]?.cnt as string) || 0;
    console.log(`[DEDUP] Total records before migration: ${stats.totalRecords}`);

    const colCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'health_records' AND column_name = 'dedup_fingerprint'
    `);
    if (colCheck.rows.length === 0) {
      console.log("[DEDUP] Adding dedup_fingerprint column...");
      if (!dryRun) {
        await db.execute(sql`ALTER TABLE health_records ADD COLUMN IF NOT EXISTS dedup_fingerprint VARCHAR`);
      }
    }

    console.log("[DEDUP] Computing fingerprints...");
    if (!dryRun) {
      await db.execute(sql`
        UPDATE health_records
        SET dedup_fingerprint = ENCODE(
          SHA256(
            (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
          ),
          'hex'
        )
      `);
      const fpCount = await db.execute(sql`SELECT COUNT(*) AS cnt FROM health_records WHERE dedup_fingerprint IS NOT NULL`);
      stats.fingerprintsComputed = parseInt(fpCount.rows[0]?.cnt as string) || 0;
    } else {
      stats.fingerprintsComputed = stats.totalRecords;
    }
    console.log(`[DEDUP] Fingerprints computed: ${stats.fingerprintsComputed}`);

    const dupQuery = sql`
      WITH ranked AS (
        SELECT id, 
               ENCODE(
                 SHA256(
                   (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                 ),
                 'hex'
               ) AS fp,
               user_id,
               type, title, date, provider,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, ENCODE(
                   SHA256(
                     (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                   ),
                   'hex'
                 )
                 ORDER BY
                   CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
                   CASE WHEN is_manual = true THEN 0 ELSE 1 END,
                   created_at ASC
               ) AS rn,
               FIRST_VALUE(id) OVER (
                 PARTITION BY user_id, ENCODE(
                   SHA256(
                     (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                   ),
                   'hex'
                 )
                 ORDER BY
                   CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
                   CASE WHEN is_manual = true THEN 0 ELSE 1 END,
                   created_at ASC
               ) AS keeper_id
        FROM health_records
      )
      SELECT id AS old_id, keeper_id, user_id, type, title, date
      FROM ranked
      WHERE rn > 1
      ORDER BY user_id, fp
    `;

    const duplicates = await db.execute(dupQuery);
    stats.duplicatesFound = duplicates.rows.length;
    console.log(`[DEDUP] Duplicates found: ${stats.duplicatesFound}`);

    if (stats.duplicatesFound === 0) {
      console.log("[DEDUP] No duplicates found. Migration complete.");
      return stats;
    }

    const sampleRows = duplicates.rows.slice(0, sampleExportLimit);
    console.log(`[DEDUP] Sample of duplicates (first ${sampleRows.length}):`);
    for (const row of sampleRows) {
      console.log(`  old_id=${row.old_id} → keeper=${row.keeper_id} | user=${row.user_id} | ${row.type}: ${row.title} (${row.date})`);
    }

    if (dryRun) {
      console.log(`[DEDUP] DRY RUN complete. ${stats.duplicatesFound} records would be removed. No changes made.`);
      return stats;
    }

    console.log("[DEDUP] Creating ID mapping table...");
    await db.execute(sql`
      CREATE TEMP TABLE IF NOT EXISTS dedup_id_map AS
      WITH ranked AS (
        SELECT id,
               ENCODE(
                 SHA256(
                   (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                 ),
                 'hex'
               ) AS fp,
               user_id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id, ENCODE(
                   SHA256(
                     (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                   ),
                   'hex'
                 )
                 ORDER BY
                   CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
                   CASE WHEN is_manual = true THEN 0 ELSE 1 END,
                   created_at ASC
               ) AS rn,
               FIRST_VALUE(id) OVER (
                 PARTITION BY user_id, ENCODE(
                   SHA256(
                     (user_id || '|' || type || '|' || LOWER(TRIM(title)) || '|' || DATE(date)::TEXT || '|' || COALESCE(LOWER(TRIM(provider)), ''))::BYTEA
                   ),
                   'hex'
                 )
                 ORDER BY
                   CASE WHEN fhir_resource_id IS NOT NULL THEN 0 ELSE 1 END,
                   CASE WHEN is_manual = true THEN 0 ELSE 1 END,
                   created_at ASC
               ) AS keeper_id
        FROM health_records
      )
      SELECT id AS old_id, keeper_id
      FROM ranked
      WHERE rn > 1
    `);

    console.log("[DEDUP] Remapping foreign key references...");

    const tableExists = async (table: string): Promise<boolean> => {
      const res = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = ${table}
        ) AS exists
      `);
      return res.rows[0]?.exists === true || res.rows[0]?.exists === "true" || res.rows[0]?.exists === "t";
    };

    if (await tableExists("record_conflicts")) {
      try {
        const res = await db.execute(sql`
          UPDATE record_conflicts SET record_id = m.keeper_id
          FROM dedup_id_map m WHERE record_conflicts.record_id = m.old_id
        `);
        stats.fkRemapped.recordConflicts = res.rowCount || 0;
      } catch (e: any) { stats.errors.push(`record_conflicts remap: ${e.message}`); }
    }

    if (await tableExists("medication_reminders")) {
      try {
        const res = await db.execute(sql`
          UPDATE medication_reminders SET health_record_id = m.keeper_id
          FROM dedup_id_map m WHERE medication_reminders.health_record_id = m.old_id
        `);
        stats.fkRemapped.medicationReminders = res.rowCount || 0;
      } catch (e: any) { stats.errors.push(`medication_reminders remap: ${e.message}`); }
    }

    if (await tableExists("appointment_reminders")) {
      try {
        const res = await db.execute(sql`
          UPDATE appointment_reminders SET health_record_id = m.keeper_id
          FROM dedup_id_map m WHERE appointment_reminders.health_record_id = m.old_id
        `);
        stats.fkRemapped.appointmentReminders = res.rowCount || 0;
      } catch (e: any) { stats.errors.push(`appointment_reminders remap: ${e.message}`); }
    }

    if (await tableExists("duplicate_test_checks")) {
      try {
        const res = await db.execute(sql`
          UPDATE duplicate_test_checks SET trigger_event_id = m.keeper_id
          FROM dedup_id_map m WHERE duplicate_test_checks.trigger_event_id = m.old_id
        `);
        stats.fkRemapped.duplicateTestChecks = res.rowCount || 0;
      } catch (e: any) { stats.errors.push(`duplicate_test_checks remap: ${e.message}`); }
    }

    if (await tableExists("record_quality_scores")) {
      try {
        const res = await db.execute(sql`
          UPDATE record_quality_scores SET health_record_id = m.keeper_id
          FROM dedup_id_map m WHERE record_quality_scores.health_record_id = m.old_id
        `);
        stats.fkRemapped.recordQualityScores = res.rowCount || 0;
      } catch (e: any) { stats.errors.push(`record_quality_scores remap: ${e.message}`); }
    }

    console.log("[DEDUP] FK remapping complete:", stats.fkRemapped);

    console.log("[DEDUP] Deleting duplicate records...");
    const deleteResult = await db.execute(sql`
      DELETE FROM health_records WHERE id IN (SELECT old_id FROM dedup_id_map)
    `);
    stats.duplicatesRemoved = deleteResult.rowCount || 0;
    console.log(`[DEDUP] Deleted ${stats.duplicatesRemoved} duplicate records`);

    console.log("[DEDUP] Logging deduplication run...");
    await db.execute(sql`
      INSERT INTO deduplication_runs (run_type, status, total_records_scanned, duplicates_found, auto_merged, started_at, completed_at, configuration)
      VALUES (
        'full_scan', 'completed',
        ${stats.totalRecords},
        ${stats.duplicatesFound},
        ${stats.duplicatesRemoved},
        NOW(), NOW(),
        ${{
          strategy: "fingerprint",
          fields: ["user_id", "type", "title", "date", "provider"],
          dryRun: false,
        }}::JSONB
      )
    `);

    const postCount = await db.execute(sql`SELECT COUNT(*) AS cnt FROM health_records`);
    const postTotal = parseInt(postCount.rows[0]?.cnt as string) || 0;
    const expectedTotal = stats.totalRecords - stats.duplicatesRemoved;

    if (postTotal !== expectedTotal) {
      stats.errors.push(`Count mismatch: expected ${expectedTotal}, got ${postTotal}`);
      console.error(`[DEDUP] WARNING: Count mismatch! Expected ${expectedTotal}, got ${postTotal}`);
    } else {
      console.log(`[DEDUP] Count verification passed: ${postTotal} records remaining (removed ${stats.duplicatesRemoved})`);
    }

    await db.execute(sql`DROP TABLE IF EXISTS dedup_id_map`);

    console.log("[DEDUP] Migration complete!", stats);
    return stats;

  } catch (error: any) {
    stats.errors.push(`Fatal error: ${error.message}`);
    console.error("[DEDUP] Fatal error during migration:", error);
    throw error;
  }
}

export async function runIntegrityChecks(): Promise<{
  orphanedAttachments: number;
  duplicateFingerprints: number;
  zeroRecordUsers: number;
  orphanedMedReminders: number;
  orphanedQualityScores: number;
  allPassed: boolean;
}> {
  const checks = {
    orphanedAttachments: 0,
    duplicateFingerprints: 0,
    zeroRecordUsers: 0,
    orphanedMedReminders: 0,
    orphanedQualityScores: 0,
    allPassed: true,
  };

  try {
    const att = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM record_attachments ra
      LEFT JOIN health_records hr ON ra.record_id = hr.id
      WHERE hr.id IS NULL
    `);
    checks.orphanedAttachments = parseInt(att.rows[0]?.cnt as string) || 0;
  } catch { }

  try {
    const hasCol = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'health_records' AND column_name = 'dedup_fingerprint'
    `);
    if (hasCol.rows.length > 0) {
      const fp = await db.execute(sql`
        SELECT COUNT(*) AS cnt FROM (
          SELECT user_id, dedup_fingerprint FROM health_records
          WHERE dedup_fingerprint IS NOT NULL
          GROUP BY user_id, dedup_fingerprint HAVING COUNT(*) > 1
        ) dups
      `);
      checks.duplicateFingerprints = parseInt(fp.rows[0]?.cnt as string) || 0;
    }
  } catch { }

  try {
    const zu = await db.execute(sql`
      SELECT COUNT(DISTINCT u.id) AS cnt FROM users u
      LEFT JOIN health_records hr ON hr.user_id = u.id
      WHERE hr.id IS NULL AND u.id IN (
        SELECT DISTINCT user_id FROM audit_logs WHERE action = 'health_record_create'
      )
    `);
    checks.zeroRecordUsers = parseInt(zu.rows[0]?.cnt as string) || 0;
  } catch { }

  try {
    const mr = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM medication_reminders mr
      WHERE mr.health_record_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM health_records hr WHERE hr.id = mr.health_record_id)
    `);
    checks.orphanedMedReminders = parseInt(mr.rows[0]?.cnt as string) || 0;
  } catch { }

  try {
    const qs = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM record_quality_scores rqs
      WHERE NOT EXISTS (SELECT 1 FROM health_records hr WHERE hr.id = rqs.health_record_id)
    `);
    checks.orphanedQualityScores = parseInt(qs.rows[0]?.cnt as string) || 0;
  } catch { }

  checks.allPassed =
    checks.orphanedAttachments === 0 &&
    checks.duplicateFingerprints === 0 &&
    checks.zeroRecordUsers === 0 &&
    checks.orphanedMedReminders === 0 &&
    checks.orphanedQualityScores === 0;

  return checks;
}
