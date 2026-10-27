/**
 * Full-population scan against real Postgres, discovered by test:server.
 * SKIP only when Postgres is unreachable; schema/assertion failures fail.
 *
 * A full scan cannot safely run over the shared development population.
 * Transaction-local tables copy the installed schema (columns, defaults,
 * indexes and checks), and shadow public tables on one real connection.
 * Foreign keys are restored explicitly because LIKE does not copy them.
 * All service queries remain real SQL; no matching or write paths are mocked.
 * Transaction completion drops every temporary table; failures roll back.
 *
 * Run: node --import tsx server/__tests__/mpi-full-scan-integration.test.ts
 */
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, asc } from "drizzle-orm";
import { db, pool } from "../db";
import { DeduplicationService } from "../deduplication-service";
import { patientMergeClinicalTableNames } from "../patient-merge-records";
import {
  users,
  patientProfiles,
  patientIdentifiers,
  duplicateCandidates,
  patientMergeHistory,
  deduplicationRuns,
  auditLogs,
  healthRecords,
  recordAttachments,
} from "@shared/schema";

async function main() {
  // Connection failures alone qualify for SKIP, not missing tables/columns.
  const client = await pool.connect().catch(() => null);
  if (!client) {
    console.log("SKIP — MPI full-scan integration: Postgres unreachable");
    return;
  }

  const original = {
    select: db.select, insert: db.insert, update: db.update,
    transaction: db.transaction,
  };
  try {
    // The outer transaction owns the temporary fixtures. mergePatients must
    // use a nested transaction/savepoint on THIS client, not a pool connection
    // (and not a second BEGIN/COMMIT, which would drop ON COMMIT DROP tables).
    await drizzle(client).transaction(async isolated => {
    for (const table of [
      "users", "patient_profiles", "patient_identifiers",
      "duplicate_candidates", "patient_merge_history",
      "deduplication_runs", "audit_logs",
      ...patientMergeClinicalTableNames,
    ]) {
      // Fixed allowlist, never user input. No modifications to public tables.
      await client.query(
        `CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`,
      );
    }
    await client.query(`
      ALTER TABLE pg_temp.patient_profiles
        ADD FOREIGN KEY (user_id) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.patient_identifiers
        ADD FOREIGN KEY (patient_id) REFERENCES pg_temp.patient_profiles(id);
      ALTER TABLE pg_temp.duplicate_candidates
        ADD FOREIGN KEY (primary_patient_id) REFERENCES pg_temp.patient_profiles(id),
        ADD FOREIGN KEY (duplicate_patient_id) REFERENCES pg_temp.patient_profiles(id),
        ADD FOREIGN KEY (reviewed_by) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.patient_merge_history
        ADD FOREIGN KEY (survivor_patient_id) REFERENCES pg_temp.patient_profiles(id),
        ADD FOREIGN KEY (merged_by) REFERENCES pg_temp.users(id),
        ADD FOREIGN KEY (undone_by) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.deduplication_runs
        ADD FOREIGN KEY (triggered_by) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.audit_logs
        ADD FOREIGN KEY (user_id) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.health_records
        ADD FOREIGN KEY (user_id) REFERENCES pg_temp.users(id);
      ALTER TABLE pg_temp.record_attachments
        ADD FOREIGN KEY (user_id) REFERENCES pg_temp.users(id),
        ADD FOREIGN KEY (record_id) REFERENCES pg_temp.health_records(id);
    `);

    // Route the singleton's queries onto this connection so every query sees
    // the same isolated population, including mergePatients' transaction.
    db.select = isolated.select.bind(isolated) as typeof db.select;
    db.insert = isolated.insert.bind(isolated) as typeof db.insert;
    db.update = isolated.update.bind(isolated) as typeof db.update;
    db.transaction = isolated.transaction.bind(isolated) as typeof db.transaction;

    const [reviewer] = await db.insert(users).values({
      email: "scan-reviewer@test.invalid", name: "Scan reviewer",
    }).returning();
    let sequence = 0;
    async function patient(fields: Partial<typeof patientProfiles.$inferInsert>) {
      const order = sequence++;
      const [user] = await db.insert(users).values({
        email: `scan-patient-${order}@test.invalid`, name: "Scan fixture",
      }).returning();
      const [profile] = await db.insert(patientProfiles).values({
        userId: user.id,
        middleName: null, // Avoid the default NMN becoming shared match evidence.
        middleNameStatus: "unknown",
        createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, order)),
        ...fields,
      }).returning();
      return profile;
    }

    const duplicate = await patient({
      firstName: "Alice", lastName: "Baker",
      email: "alice@test.invalid", dateOfBirth: new Date("1980-02-03"),
      city: "Fixture City",
    });
    const survivor = await patient({
      firstName: "Alice", lastName: "Baker",
      email: "alice@test.invalid", dateOfBirth: new Date("1980-02-03"),
    });
    // Robert/Richard yield 0.85 phonetic credit; Jones/James match phonetically.
    // Their weighted score is ~0.933: review, not auto-merge.
    const nearA = await patient({ firstName: "Robert", lastName: "Jones" });
    const nearB = await patient({ firstName: "Richard", lastName: "James" });
    const unique = await patient({ firstName: "Xenia", lastName: "Quetzal" });
    await db.insert(patientIdentifiers).values({
      patientId: duplicate.id, identifierType: "mrn",
      identifierValue: "scan-fixture-mrn", isActive: true,
    });
    const [clinicalRecord] = await db.insert(healthRecords).values({
      userId: duplicate.userId, type: "lab", title: "Synthetic full-scan lab",
      date: new Date("2020-01-01"),
    }).returning();
    const [attachment] = await db.insert(recordAttachments).values({
      userId: duplicate.userId, recordId: clinicalRecord.id, fileName: "scan.pdf",
      fileType: "application/pdf", fileSize: 12, filePath: "fixtures/scan.pdf",
    }).returning();

    const result = await DeduplicationService.getInstance().runFullScan(reviewer.id);
    // Counts classify each visited profile: one merge, one review, and the
    // two surviving pair members plus the unrelated profile as newRecords.
    assert.deepEqual(result, {
      autoMerged: 1, flaggedForReview: 1, newRecords: 3, errors: [],
    });

    const history = await db.select().from(patientMergeHistory);
    assert.equal(history.length, 1, "exactly one merge, no self/cross-pair merges");
    assert.equal(history[0].survivorPatientId, survivor.id);
    assert.equal(history[0].mergedPatientId, duplicate.id);
    assert.equal(history[0].mergeType, "auto_merge");
    assert.equal(history[0].similarityScore, 1);
    assert.equal((history[0].mergedData as { id: string }).id, duplicate.id);
    const [updatedSurvivor] = await db.select().from(patientProfiles)
      .where(eq(patientProfiles.id, survivor.id));
    assert.equal(updatedSurvivor.city, "Fixture City", "merge actually fills survivor");
    const [identifier] = await db.select().from(patientIdentifiers);
    assert.equal(identifier.patientId, survivor.id, "merge transfers identifier");
    const records = await db.select().from(healthRecords);
    assert.equal(records.length, 1, "full scan preserves clinical record");
    assert.equal(records[0].userId, survivor.userId, "full-scan merge transfers clinical ownership");
    const [movedAttachment] = await db.select().from(recordAttachments);
    assert.equal(movedAttachment.id, attachment.id);
    assert.equal(movedAttachment.userId, survivor.userId, "full-scan merge transfers attachment ownership");
    assert.equal(movedAttachment.recordId, clinicalRecord.id);
    const manifest = history[0].mergedData as {
      clinicalTransfer: { tables: Record<string, { rowIds: string[] }> };
    };
    assert.deepEqual(manifest.clinicalTransfer.tables.health_records.rowIds, [clinicalRecord.id]);
    assert.deepEqual(manifest.clinicalTransfer.tables.record_attachments.rowIds, [attachment.id]);

    const candidates = await db.select().from(duplicateCandidates);
    assert.equal(candidates.length, 1, "one pending pair, no reversed duplicate");
    assert.equal(candidates[0].primaryPatientId, nearB.id);
    assert.equal(candidates[0].duplicatePatientId, nearA.id);
    assert.equal(candidates[0].status, "pending");
    assert.equal(candidates[0].sourceSystem, "full_scan");
    assert.equal(candidates[0].autoMergeEligible, false);
    assert.ok(candidates[0].similarityScore >= 0.8 && candidates[0].similarityScore < 0.95);

    const runs = await db.select().from(deduplicationRuns);
    assert.equal(runs.length, 1);
    const run = runs[0];
    assert.equal(run.status, "completed");
    assert.equal(run.runType, "full_scan");
    assert.equal(run.triggeredBy, reviewer.id);
    assert.equal(run.totalRecordsScanned, 5);
    assert.equal(run.duplicatesFound, result.autoMerged + result.flaggedForReview);
    assert.equal(run.autoMerged, result.autoMerged);
    assert.equal(run.flaggedForReview, result.flaggedForReview);
    assert.equal(run.errors, 0);
    assert.equal(run.errorDetails, null);
    assert.ok(run.completedAt);
    assert.ok(run.completedAt >= run.startedAt);

    const audit = await db.select().from(auditLogs);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, "patient_merge");
    assert.equal(audit[0].resourceId, survivor.id);
    assert.equal(audit[0].userId, reviewer.id);
    const profiles = await db.select().from(patientProfiles)
      .orderBy(asc(patientProfiles.createdAt));
    assert.deepEqual(profiles.map(p => p.id), [
      duplicate.id, survivor.id, nearA.id, nearB.id, unique.id,
    ]);
    assert.deepEqual(profiles.slice(2), [nearA, nearB, unique],
      "review and unique profiles must remain unchanged");
    console.log("OK — full scan tallies, merges, pending review and completed run (real Postgres)");
    });
  } finally {
    Object.assign(db, original);
    client.release();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("FAIL — MPI full-scan integration:", error);
    process.exitCode = 1;
  }).finally(() => pool.end());
}
