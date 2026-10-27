/**
 * Real-DB integration test for the patient-merge write path and clinical transfer.
 *
 * Task #131 unit-tested the MPI *scoring* and the merge *decision*
 * (auto_merge / flag_for_review / create_new) by stubbing the drizzle layer
 * in memory. It deliberately did NOT cover what `mergePatients()` in
 * `server/deduplication-service.ts` actually writes when two records are
 * merged — and a bug there is high-risk (could drop a patient's data or
 * attribute records to the wrong patient).
 *
 * This suite drives the real DB-write behavior against a live Postgres:
 *   - survivor keeps its non-null fields,
 *   - survivor fills in blanks from the merged record,
 *   - identifiers transfer from the merged patient to the survivor,
 *   - a patient_merge_history row is written with field resolutions +
 *     a merged-data snapshot,
 *   - duplicate_candidates status flips to auto_merged / confirmed_duplicate,
 *   - a patient_merge audit_logs row is written,
 *   - clinical rows and attachments follow the survivor, with an exact manifest,
 *   - a late FK failure rolls back clinical and demographic changes together.
 * It also covers `resolveDuplicate()` confirming a duplicate and triggering
 * the merge.
 *
 * Requires a reachable Postgres at `DATABASE_URL`. In CI the Replit
 * environment provides one. If the connection fails the test exits 0 with a
 * clear "SKIP" log so disconnected dev laptops do not red the gate — schema
 * regressions are still caught wherever a DB is reachable.
 *
 * Wired into `npm run test:server` automatically via
 * `scripts/run-server-tests.mjs` (picks up any `*.test.ts` under
 * `server/__tests__/`).
 *
 * Run via: node --import tsx server/__tests__/mpi-merge-integration.test.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import { db, pool } from "../db";
import { DeduplicationService } from "../deduplication-service";
import {
  patientProfiles,
  patientIdentifiers,
  duplicateCandidates,
  patientMergeHistory,
  auditLogs,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

const failures: string[] = [];
function assert(cond: any, msg: string) {
  if (!cond) failures.push(msg);
}
function assertEq(actual: any, expected: any, msg: string) {
  if (actual !== expected) {
    failures.push(
      `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Preflight: confirm Postgres is reachable; otherwise SKIP (exit 0).
// ---------------------------------------------------------------------------

async function preflight(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await pool.query("select 1");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? String(e) };
  }
}

// ---------------------------------------------------------------------------
// Fixtures: real users + patient profiles so the FK
// patient_profiles.user_id -> users.id (and its UNIQUE) resolve.
//
// All created rows are tracked and cleaned up in a finally block. Cleanup is
// ordered to respect FKs: candidates / merge-history / identifiers / audit
// first, then profiles, then users (profiles cascade from users, but we delete
// explicitly so a partial failure still cleans up).
// ---------------------------------------------------------------------------

const RUN_TAG = `task217-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createdUserIds: string[] = [];
const createdPatientIds: string[] = [];

async function patientUserId(patientId: string): Promise<string> {
  const result = await pool.query("select user_id from patient_profiles where id = $1", [patientId]);
  return result.rows[0].user_id;
}

async function makeClinicalHistory(patientId: string, providerId?: string) {
  const owner = await patientUserId(patientId);
  const source = (await pool.query(
    "insert into data_sources (user_id, name, type) values ($1, 'Merge fixture', 'fhir') returning id",
    [owner],
  )).rows[0].id;
  const record = (await pool.query(
    `insert into health_records (user_id, type, title, date, source_id, details)
     values ($1, 'lab', 'Synthetic merge lab', now(), $2, '{"value":42}') returning id`,
    [owner, source],
  )).rows[0].id;
  const attachment = (await pool.query(
    `insert into record_attachments (user_id, record_id, file_name, file_type, file_size, file_path)
     values ($1, $2, 'fixture.pdf', 'application/pdf', 12, 'merge-fixtures/fixture.pdf') returning id`,
    [owner, record],
  )).rows[0].id;
  const version = (await pool.query(
    `insert into resource_versions (record_id, version_number, raw_data, change_type)
     values ($1, 1, '{"fixture":true}', 'create') returning id`, [record],
  )).rows[0].id;
  const reminder = (await pool.query(
    `insert into medication_reminders (user_id, health_record_id, medication_name, frequency, scheduled_times, start_date)
     values ($1, $2, 'Fixture medication', 'once_daily', '["08:00"]', now()) returning id`,
    [owner, record],
  )).rows[0].id;
  const log = (await pool.query(
    `insert into medication_logs (user_id, reminder_id, scheduled_time, action)
     values ($1, $2, now(), 'taken') returning id`, [owner, reminder],
  )).rows[0].id;
  const journal = (await pool.query(
    `insert into health_journal_entries (user_id, entry_type, content, entry_date)
     values ($1, 'symptom', 'Synthetic fixture', now()) returning id`, [owner],
  )).rows[0].id;
  const note = (await pool.query(
    `insert into clinical_notes (patient_id, provider_id, note_type, title)
     values ($1, $2, 'progress', 'Synthetic note') returning id`, [owner, providerId ?? owner],
  )).rows[0].id;
  const intake = (await pool.query(
    "insert into comprehensive_intakes (user_id) values ($1) returning id", [owner],
  )).rows[0].id;
  const labOrder = (await pool.query(
    `insert into lab_orders (patient_id, provider_id, lab_provider, tests)
     values ($1, $2, 'Synthetic lab', '[]') returning id`, [owner, providerId ?? owner],
  )).rows[0].id;
  const carePlan = (await pool.query(
    `insert into care_plans (user_id, title, category)
     values ($1, 'Synthetic care plan', 'preventive') returning id`, [owner],
  )).rows[0].id;
  const carePlanNote = (await pool.query(
    `insert into care_plan_notes (care_plan_id, patient_id, author_id, author_name, author_role, content)
     values ($1, $2, $2, 'Synthetic patient', 'patient', 'Synthetic progress note') returning id`,
    [carePlan, owner],
  )).rows[0].id;
  return { owner, source, record, attachment, version, reminder, log, journal, note, intake, labOrder, carePlan, carePlanNote };
}

async function makeUser(): Promise<string> {
  const email = `${RUN_TAG}-${createdUserIds.length}@test.invalid`;
  const r = await pool.query(
    `insert into users (email, name) values ($1, $2) returning id`,
    [email, "Task 217 Test User"],
  );
  const id = r.rows[0].id as string;
  createdUserIds.push(id);
  return id;
}

async function makePatient(fields: Record<string, unknown>): Promise<string> {
  const userId = await makeUser();
  const [row] = await db
    .insert(patientProfiles)
    .values({ userId, ...(fields as any) })
    .returning();
  createdPatientIds.push(row.id);
  return row.id;
}

async function cleanup(): Promise<void> {
  try {
    for (const pid of createdPatientIds) {
      await pool.query(`delete from patient_merge_history where survivor_patient_id = $1`, [pid]);
      await pool.query(`delete from patient_identifiers where patient_id = $1`, [pid]);
      await pool.query(
        `delete from duplicate_candidates where primary_patient_id = $1 or duplicate_patient_id = $1`,
        [pid],
      );
      await pool.query(`delete from audit_logs where resource_id = $1`, [pid]);
    }
    // Deleting users cascades to patient_profiles (user_id ON DELETE CASCADE).
    for (const uid of createdUserIds) {
      // lab_orders.patient_id intentionally has no FK/cascade in this schema.
      await pool.query(`delete from lab_orders where patient_id = $1`, [uid]);
      await pool.query(`delete from users where id = $1`, [uid]);
    }
  } catch (e: any) {
    console.error(`cleanup error (non-fatal): ${e?.message ?? e}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testMergeCombinesFieldsAndTransfersData() {
  const dedup = DeduplicationService.getInstance();
  const reviewerId = await makeUser();

  // Survivor has firstName/lastName/email but BLANK phone, city, bloodType.
  const survivorId = await makePatient({
    firstName: "John",
    lastName: "Smith",
    middleName: "Michael",
    email: "john.smith@example.com",
    phone: null,
    city: null,
    bloodType: null,
    primaryPhysician: "Dr. Survivor",
  });

  // Merged (loser) has the missing fields filled, plus a CONFLICTING
  // primaryPhysician and email that must NOT overwrite the survivor's.
  const mergedId = await makePatient({
    firstName: "John",
    lastName: "Smith",
    middleName: "Michael",
    email: "john.different@example.com",
    phone: "555-123-4567",
    city: "Springfield",
    bloodType: "O+",
    primaryPhysician: "Dr. Loser",
  });
  const survivorClinical = await makeClinicalHistory(survivorId, reviewerId);
  const movedClinical = await makeClinicalHistory(mergedId, reviewerId);
  const unrelatedId = await makePatient({ firstName: "Unrelated" });
  const unrelatedClinical = await makeClinicalHistory(unrelatedId, reviewerId);
  const grant = (await pool.query(
    `insert into share_links (user_id, token, expires_at)
     values ($1, $2, now() + interval '1 day') returning id`,
    [movedClinical.owner, `synthetic-merge-share-${RUN_TAG}`],
  )).rows[0].id;
  const originalAudit = (await pool.query(
    `insert into audit_logs (user_id, action, resource_id)
     values ($1, 'synthetic_original_action', $2) returning id`, [movedClinical.owner, mergedId],
  )).rows[0].id;

  // Identifiers live on the merged record and must move to the survivor.
  await pool.query(
    `insert into patient_identifiers (patient_id, identifier_type, identifier_value, is_active)
     values ($1, 'mrn', $2, true), ($1, 'ssn_last4', '6789', true)`,
    [mergedId, `MRN-${RUN_TAG}`],
  );

  // A pending duplicate-candidate row for this pair (manual_merge path will
  // flip it to confirmed_duplicate).
  await db.insert(duplicateCandidates).values({
    primaryPatientId: survivorId,
    duplicatePatientId: mergedId,
    similarityScore: 0.92,
    matchType: "probabilistic",
    matchedFields: { firstName: 1.0, lastName: 1.0 },
    status: "pending",
  });

  const result = await dedup.mergePatients(
    survivorId,
    mergedId,
    reviewerId,
    "manual_merge",
    0.92,
  );
  assert(result.success, `mergePatients should succeed: ${result.error ?? ""}`);

  // --- Survivor field resolution -----------------------------------------
  const survivor = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.id, survivorId))
    .then((r) => r[0]);

  assertEq(survivor.email, "john.smith@example.com", "survivor keeps its own non-null email");
  assertEq(
    survivor.primaryPhysician,
    "Dr. Survivor",
    "survivor keeps its own non-null primaryPhysician (no overwrite)",
  );
  assertEq(survivor.phone, "555-123-4567", "survivor fills BLANK phone from merged record");
  assertEq(survivor.city, "Springfield", "survivor fills BLANK city from merged record");
  assertEq(survivor.bloodType, "O+", "survivor fills BLANK bloodType from merged record");

  // --- Identifiers transferred -------------------------------------------
  const survivorIdents = await db
    .select()
    .from(patientIdentifiers)
    .where(eq(patientIdentifiers.patientId, survivorId));
  assertEq(survivorIdents.length, 2, "both identifiers moved to the survivor");
  const mergedIdents = await db
    .select()
    .from(patientIdentifiers)
    .where(eq(patientIdentifiers.patientId, mergedId));
  assertEq(mergedIdents.length, 0, "no identifiers left on the merged record");

  // --- Merge-history snapshot --------------------------------------------
  const history = await db
    .select()
    .from(patientMergeHistory)
    .where(eq(patientMergeHistory.survivorPatientId, survivorId));
  assertEq(history.length, 1, "exactly one patient_merge_history row written");
  const h = history[0];
  assertEq(h.mergedPatientId, mergedId, "history records the merged-from patient id");
  assertEq(h.mergeType, "manual_merge", "history records the merge type");
  assertEq(h.similarityScore, 0.92, "history records the similarity score");

  const snapshot = h.mergedData as Record<string, unknown>;
  assert(snapshot != null, "merged-data snapshot is present");
  assertEq(snapshot.id, mergedId, "snapshot captures the merged patient's id");
  assertEq(snapshot.phone, "555-123-4567", "snapshot captures merged patient's data");
  const transfer = snapshot.clinicalTransfer as {
    version: number; fromUserId: string; toUserId: string;
    tables: Record<string, { ownerColumn: string; rowIds: string[] }>;
  };
  assertEq(transfer.version, 1, "clinical manifest is versioned");
  assertEq(transfer.fromUserId, movedClinical.owner, "manifest captures original user owner");
  assertEq(transfer.toUserId, survivorClinical.owner, "manifest captures surviving user owner");
  const expectedMoves = {
    health_records: movedClinical.record, record_attachments: movedClinical.attachment,
    data_sources: movedClinical.source, medication_reminders: movedClinical.reminder,
    medication_logs: movedClinical.log, health_journal_entries: movedClinical.journal,
    clinical_notes: movedClinical.note,
    comprehensive_intakes: movedClinical.intake, lab_orders: movedClinical.labOrder,
    care_plans: movedClinical.carePlan, care_plan_notes: movedClinical.carePlanNote,
  };
  for (const [table, id] of Object.entries(expectedMoves)) {
    assertEq(JSON.stringify(transfer.tables[table]?.rowIds), JSON.stringify([id]),
      `${table} manifest captures exactly the moved row, not survivor or unrelated rows`);
  }
  // Query the same user_id used by unified-record reads. Both histories are now
  // visible and no allowlisted clinical rows remain on the losing user.
  const unified = await pool.query("select id from health_records where user_id = $1", [survivorClinical.owner]);
  assertEq(unified.rows.length, 2, "survivor sees both histories via ordinary user ownership query");
  for (const [table, entry] of Object.entries(transfer.tables)) {
    // These identifiers originate only from the service's fixed schema allowlist.
    const left = await pool.query(`select id from "${table}" where "${entry.ownerColumn}" = $1`, [movedClinical.owner]);
    assertEq(left.rows.length, 0, `${table}: no clinical rows orphaned on loser`);
    for (const id of entry.rowIds) {
      const row = (await pool.query(`select "${entry.ownerColumn}" as owner from "${table}" where id = $1`, [id])).rows[0];
      assertEq(row?.owner, survivorClinical.owner, `${table}: moved row belongs to survivor`);
    }
  }
  const attachment = (await pool.query("select * from record_attachments where id = $1", [movedClinical.attachment])).rows[0];
  assertEq(attachment.record_id, movedClinical.record, "attachment record FK unchanged");
  assertEq(attachment.file_path, "merge-fixtures/fixture.pdf", "attachment path unchanged");
  const record = (await pool.query("select * from health_records where id = $1", [movedClinical.record])).rows[0];
  assertEq(record.source_id, movedClinical.source, "record source provenance unchanged");
  assertEq(record.details.value, 42, "clinical payload preserved");
  const version = (await pool.query("select record_id from resource_versions where id = $1", [movedClinical.version])).rows[0];
  assertEq(version.record_id, movedClinical.record, "record-only child follows unchanged");
  const note = (await pool.query("select provider_id from clinical_notes where id = $1", [movedClinical.note])).rows[0];
  assertEq(note.provider_id, reviewerId, "clinical provider attribution must not move");
  // Patient-level history filters on patient_id, not the unchanged plan FK.
  const patientNotes = await pool.query(
    "select * from care_plan_notes where patient_id = $1 and is_archived = false",
    [survivorClinical.owner],
  );
  const movedNote = patientNotes.rows.find(row => row.id === movedClinical.carePlanNote);
  assert(movedNote != null, "patient-level survivor history includes the losing patient's care-plan note");
  assertEq(movedNote?.care_plan_id, movedClinical.carePlan, "care-plan note parent linkage unchanged");
  assertEq(movedNote?.author_id, movedClinical.owner, "patient-authored note preserves original author attribution");
  const unrelated = (await pool.query("select user_id from health_records where id = $1", [unrelatedClinical.record])).rows[0];
  assertEq(unrelated.user_id, unrelatedClinical.owner, "unrelated patient's history untouched");
  assertEq(await patientUserId(mergedId), movedClinical.owner, "loser profile retains account identity for audit");
  const usersLeft = await pool.query("select id from users where id = $1", [movedClinical.owner]);
  assertEq(usersLeft.rows.length, 1, "loser user is not deleted");
  assertEq((await pool.query("select user_id from share_links where id = $1", [grant])).rows[0].user_id,
    movedClinical.owner, "merge does not transfer sharing authorization");
  assertEq((await pool.query("select user_id from audit_logs where id = $1", [originalAudit])).rows[0].user_id,
    movedClinical.owner, "historical audit actor is not rewritten");
  const matchDetails = h.matchDetails as { transferredIdentifierIds: string[] };
  assertEq(matchDetails.transferredIdentifierIds.length, 2, "identifier manifest supports selective reversal");

  const resolutions = h.fieldResolutions as Record<string, { chosen: string }>;
  assert(resolutions != null, "field resolutions are present");
  assertEq(resolutions.email?.chosen, "survivor", "email resolved in favor of survivor");
  assertEq(resolutions.phone?.chosen, "merged", "phone resolved in favor of merged (survivor blank)");
  assertEq(
    resolutions.primaryPhysician?.chosen,
    "survivor",
    "conflicting primaryPhysician resolved in favor of survivor",
  );

  // --- Duplicate-candidate status ----------------------------------------
  const cand = await db
    .select()
    .from(duplicateCandidates)
    .where(
      and(
        eq(duplicateCandidates.primaryPatientId, survivorId),
        eq(duplicateCandidates.duplicatePatientId, mergedId),
      ),
    )
    .then((r) => r[0]);
  assertEq(
    cand.status,
    "confirmed_duplicate",
    "manual_merge flips duplicate_candidates -> confirmed_duplicate",
  );
  assertEq(cand.reviewedBy, reviewerId, "candidate records the reviewer");

  // --- Audit log ----------------------------------------------------------
  const audit = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.resourceId, survivorId));
  const mergeAudit = audit.find((a) => a.action === "patient_merge");
  assert(mergeAudit != null, "a patient_merge audit_logs row is written");
  assertEq(mergeAudit!.resourceType, "patient_profile", "audit resourceType is patient_profile");
  assertEq(mergeAudit!.userId, reviewerId, "audit records the acting user");
  const meta = mergeAudit!.metadata as Record<string, unknown>;
  assertEq(meta.survivorId, survivorId, "audit metadata records survivorId");
  assertEq(meta.mergedId, mergedId, "audit metadata records mergedId");
  const counts = meta.clinicalTransferCounts as Record<string, number>;
  assertEq(counts.health_records, 1, "audit records moved record count");
  assertEq(counts.record_attachments, 1, "audit records moved attachment count");
}

async function testAutoMergeStatus() {
  const dedup = DeduplicationService.getInstance();

  const survivorId = await makePatient({ firstName: "Jane", lastName: "Doe" });
  const mergedId = await makePatient({ firstName: "Jane", lastName: "Doe", phone: "555-000-1111" });
  const clinical = await makeClinicalHistory(mergedId);

  await db.insert(duplicateCandidates).values({
    primaryPatientId: survivorId,
    duplicatePatientId: mergedId,
    similarityScore: 0.97,
    matchType: "probabilistic",
    matchedFields: { firstName: 1.0, lastName: 1.0 },
    status: "pending",
  });

  const result = await dedup.mergePatients(survivorId, mergedId, undefined, "auto_merge", 0.97);
  assert(result.success, `auto_merge mergePatients should succeed: ${result.error ?? ""}`);

  const cand = await db
    .select()
    .from(duplicateCandidates)
    .where(eq(duplicateCandidates.primaryPatientId, survivorId))
    .then((r) => r[0]);
  assertEq(cand.status, "auto_merged", "auto_merge flips duplicate_candidates -> auto_merged");
  const record = (await pool.query("select user_id from health_records where id = $1", [clinical.record])).rows[0];
  assertEq(record.user_id, await patientUserId(survivorId), "auto merge also transfers clinical history");

  // Auto-merge with no userId still writes a (null-user) audit row.
  const audit = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.resourceId, survivorId));
  const mergeAudit = audit.find((a) => a.action === "patient_merge");
  assert(mergeAudit != null, "auto_merge still writes a patient_merge audit row");
  assertEq(mergeAudit!.userId, null, "auto_merge with no userId writes a null-user audit row");
}

async function testMergeMissingRecordFails() {
  const dedup = DeduplicationService.getInstance();
  const survivorId = await makePatient({ firstName: "Ghost", lastName: "Patient" });
  const result = await dedup.mergePatients(
    survivorId,
    "00000000-0000-0000-0000-000000000000",
    undefined,
    "manual_merge",
  );
  assert(!result.success, "merge with a non-existent merged record must fail");
  assert(
    (result.error ?? "").includes("not found"),
    "missing-record error is reported clearly",
  );
}

async function testResolveDuplicateConfirmsAndMerges() {
  const dedup = DeduplicationService.getInstance();
  const reviewerId = await makeUser();

  const survivorId = await makePatient({
    firstName: "Robert",
    lastName: "Jones",
    email: "robert.jones@example.com",
    phone: null,
  });
  const mergedId = await makePatient({
    firstName: "Robert",
    lastName: "Jones",
    email: null,
    phone: "555-222-3333",
  });
  const clinical = await makeClinicalHistory(mergedId, reviewerId);

  const [candidate] = await db
    .insert(duplicateCandidates)
    .values({
      primaryPatientId: survivorId,
      duplicatePatientId: mergedId,
      similarityScore: 0.9,
      matchType: "probabilistic",
      matchedFields: { firstName: 1.0, lastName: 1.0 },
      status: "pending",
    })
    .returning();

  const result = await dedup.resolveDuplicate(
    candidate.id,
    "confirmed_duplicate",
    reviewerId,
    "Verified same patient",
    true,
  );
  assert(result.success, `resolveDuplicate should succeed: ${result.error ?? ""}`);

  // The merge actually happened: survivor filled its blank phone.
  const survivor = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.id, survivorId))
    .then((r) => r[0]);
  assertEq(survivor.phone, "555-222-3333", "resolveDuplicate triggers merge: survivor fills blank phone");

  // Merge history exists for this survivor (written by mergePatients).
  const history = await db
    .select()
    .from(patientMergeHistory)
    .where(eq(patientMergeHistory.survivorPatientId, survivorId));
  assertEq(history.length, 1, "resolveDuplicate -> merge wrote a merge-history row");
  const record = (await pool.query("select user_id from health_records where id = $1", [clinical.record])).rows[0];
  assertEq(record.user_id, await patientUserId(survivorId), "review-confirm merge transfers clinical records");

  // Final candidate state is confirmed_duplicate with reviewer + notes.
  const cand = await db
    .select()
    .from(duplicateCandidates)
    .where(eq(duplicateCandidates.id, candidate.id))
    .then((r) => r[0]);
  assertEq(cand.status, "confirmed_duplicate", "candidate ends as confirmed_duplicate");
  assertEq(cand.reviewedBy, reviewerId, "candidate records the reviewer");
  assertEq(cand.reviewNotes, "Verified same patient", "candidate records the review notes");
}

async function testResolveDuplicateUniqueDoesNotMerge() {
  const dedup = DeduplicationService.getInstance();
  const reviewerId = await makeUser();

  const survivorId = await makePatient({
    firstName: "Alan",
    lastName: "Turing",
    phone: null,
  });
  const otherId = await makePatient({
    firstName: "Alan",
    lastName: "Turing",
    phone: "555-444-5555",
  });
  const clinical = await makeClinicalHistory(otherId, reviewerId);

  const [candidate] = await db
    .insert(duplicateCandidates)
    .values({
      primaryPatientId: survivorId,
      duplicatePatientId: otherId,
      similarityScore: 0.83,
      matchType: "probabilistic",
      matchedFields: { firstName: 1.0, lastName: 1.0 },
      status: "pending",
    })
    .returning();

  const result = await dedup.resolveDuplicate(
    candidate.id,
    "confirmed_unique",
    reviewerId,
    "Different people",
    true,
  );
  assert(result.success, `resolveDuplicate(unique) should succeed: ${result.error ?? ""}`);

  // No merge happened: survivor's blank phone stays blank.
  const survivor = await db
    .select()
    .from(patientProfiles)
    .where(eq(patientProfiles.id, survivorId))
    .then((r) => r[0]);
  assertEq(survivor.phone, null, "confirmed_unique must NOT merge data into the survivor");

  const history = await db
    .select()
    .from(patientMergeHistory)
    .where(eq(patientMergeHistory.survivorPatientId, survivorId));
  assertEq(history.length, 0, "confirmed_unique writes no merge-history row");
  const record = (await pool.query("select user_id from health_records where id = $1", [clinical.record])).rows[0];
  assertEq(record.user_id, clinical.owner, "confirmed_unique never transfers clinical history");

  const cand = await db
    .select()
    .from(duplicateCandidates)
    .where(eq(duplicateCandidates.id, candidate.id))
    .then((r) => r[0]);
  assertEq(cand.status, "confirmed_unique", "candidate ends as confirmed_unique");
}

async function testLateFailureRollsBackEverything() {
  const dedup = DeduplicationService.getInstance();
  const survivor = await makePatient({ firstName: "Rollback", phone: null });
  const loser = await makePatient({ firstName: "Rollback", phone: "555-000-9999" });
  const clinical = await makeClinicalHistory(loser);
  const identifier = (await pool.query(
    "insert into patient_identifiers (patient_id, identifier_type, identifier_value) values ($1, 'mrn', $2) returning id",
    [loser, `rollback-${RUN_TAG}`],
  )).rows[0].id;
  const [candidate] = await db.insert(duplicateCandidates).values({
    primaryPatientId: survivor, duplicatePatientId: loser,
    similarityScore: 0.99, matchType: "deterministic", matchedFields: {}, status: "pending",
  }).returning();
  // Valid-format but nonexistent reviewer fails history's merged_by FK, AFTER
  // the clinical and demographic updates have executed.
  const result = await dedup.mergePatients(survivor, loser, "00000000-0000-0000-0000-000000000000");
  assert(!result.success, "invalid reviewer fails merge");
  assertEq(result.error, "Patient merge failed; no changes were saved", "failed merge does not expose SQL/PHI");
  for (const [table, id, column] of [
    ["health_records", clinical.record, "user_id"],
    ["record_attachments", clinical.attachment, "user_id"],
    ["data_sources", clinical.source, "user_id"],
    ["medication_logs", clinical.log, "user_id"],
    ["clinical_notes", clinical.note, "patient_id"],
    ["comprehensive_intakes", clinical.intake, "user_id"],
    ["lab_orders", clinical.labOrder, "patient_id"],
    ["care_plans", clinical.carePlan, "user_id"],
    ["care_plan_notes", clinical.carePlanNote, "patient_id"],
  ]) {
    const row = (await pool.query(`select "${column}" as owner from "${table}" where id = $1`, [id])).rows[0];
    assertEq(row.owner, clinical.owner, `${table}: ownership rolled back`);
  }
  assertEq((await pool.query("select phone from patient_profiles where id = $1", [survivor])).rows[0].phone,
    null, "demographics rolled back");
  assertEq((await pool.query("select patient_id from patient_identifiers where id = $1", [identifier])).rows[0].patient_id,
    loser, "identifier rolled back");
  assertEq((await pool.query("select status from duplicate_candidates where id = $1", [candidate.id])).rows[0].status,
    "pending", "candidate unchanged after failure");
  assertEq((await pool.query("select id from patient_merge_history where survivor_patient_id = $1", [survivor])).rows.length,
    0, "failed transfer has no history");
  assertEq((await pool.query("select id from audit_logs where resource_id = $1", [survivor])).rows.length,
    0, "failed transfer has no success audit");
}

async function testOverlappingMergesAndReplays() {
  const dedup = DeduplicationService.getInstance();
  const first = await makePatient({ firstName: "Concurrent" });
  const second = await makePatient({ firstName: "Concurrent" });
  const firstClinical = await makeClinicalHistory(first);
  const secondClinical = await makeClinicalHistory(second);
  const results = await Promise.all([
    dedup.mergePatients(first, second), dedup.mergePatients(second, first),
  ]);
  assertEq(results.filter(result => result.success).length, 1, "opposite concurrent merges have exactly one winner");
  const winner = results[0].success ? first : second;
  const loser = winner === first ? second : first;
  const winnerUser = await patientUserId(winner);
  const records = await pool.query("select user_id from health_records where id = ANY($1::varchar[])",
    [[firstClinical.record, secondClinical.record]]);
  assert(records.rows.every(row => row.user_id === winnerUser), "concurrent merge does not split clinical history");
  assert(!(await dedup.mergePatients(winner, loser)).success, "replay rejected without another history entry");
  assert(!(await dedup.mergePatients(loser, winner)).success, "merged profile cannot become a survivor");
  assert(!(await dedup.mergePatients(winner, winner)).success, "self merge rejected");
  // A survivor may later become the loser of a legitimate merge. All prior
  // clinical rows must follow it, not just the records originally owned by it.
  const final = await makePatient({ firstName: "Final survivor" });
  assert((await dedup.mergePatients(final, winner)).success, "chained survivor merge succeeds");
  const finalUser = await patientUserId(final);
  const chained = await pool.query("select user_id from health_records where id = ANY($1::varchar[])",
    [[firstClinical.record, secondClinical.record]]);
  assertEq(chained.rows.length, 2, "chained merge preserves every record");
  assert(chained.rows.every(row => row.user_id === finalUser), "chained merge moves unified history together");
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const pf = await preflight();
    if (!pf.ok) {
      console.log(
        `SKIP — MPI merge integration test: Postgres unreachable (${pf.reason})`,
      );
      try { await pool.end(); } catch {}
      process.exit(0);
    }

    const tests: Array<[string, () => Promise<void>]> = [
      ["mergeCombinesFieldsAndTransfersData", testMergeCombinesFieldsAndTransfersData],
      ["autoMergeStatus", testAutoMergeStatus],
      ["mergeMissingRecordFails", testMergeMissingRecordFails],
      ["resolveDuplicateConfirmsAndMerges", testResolveDuplicateConfirmsAndMerges],
      ["resolveDuplicateUniqueDoesNotMerge", testResolveDuplicateUniqueDoesNotMerge],
      ["lateFailureRollsBackEverything", testLateFailureRollsBackEverything],
      ["overlappingMergesAndReplays", testOverlappingMergesAndReplays],
    ];
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  ok  ${name}`);
      } catch (e: any) {
        failures.push(`${name} threw: ${e?.message ?? e}`);
        console.log(`  ERR ${name}: ${e?.message ?? e}`);
      }
    }

    await cleanup();
    try { await pool.end(); } catch {}

    if (failures.length) {
      console.error("\nFAIL — MPI merge integration:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("OK — patient merge write-path end-to-end (real Postgres) holds");
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
