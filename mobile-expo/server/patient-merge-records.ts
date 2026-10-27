import { getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn, AnyPgTable } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import type { db } from "./db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Explicit clinical-subject allowlist, NOT every FK to users: provider/author,
// credentials, consent, sharing grants and audit actors must never be reassigned.
const userOwnedTables = [
  schema.healthRecords, schema.recordAttachments, schema.dataSources,
  schema.harmonizedPatients, schema.dataConflicts, schema.bulkImportJobs,
  schema.fhirSyncJobs, schema.healthPredictions, schema.anomalyDetections,
  schema.healthReports, schema.trendAnalyses, schema.healthGoals, schema.goalProgress,
  schema.medicationReminders, schema.medicationLogs, schema.appointments,
  schema.aiConversations, schema.aiInsights, schema.appointmentSuggestions,
  schema.refillRequests, schema.consultationSummaries, schema.healthJourneys,
  schema.carePlans, schema.sensorReadings, schema.sensorAlerts, schema.sensorTrends,
  schema.episodesOfCare, schema.medicationSchedules, schema.adherenceLogs,
  schema.healthJournalEntries, schema.ambientEncounters, schema.encounterActionItems,
  schema.comprehensiveIntakes, schema.carePlanAdjustments,
  schema.caseSummaries, schema.researchRecommendations, schema.providerCommunications,
];
const patientSubjectTables = [
  schema.messagingThreads, schema.patientPathwayAssignments, schema.aiCaseReviews,
  schema.providerMessageThreads, schema.clinicalNotes, schema.audioTranscripts,
  schema.codeSuggestions, schema.priorAuthRequests, schema.patientSummaries,
  schema.telehealthVisits, schema.labOrders, schema.carePlanNotes,
];

// Integration tests shadow exactly this set on their isolated SQL connection.
export const patientMergeClinicalTableNames = [
  ...userOwnedTables, ...patientSubjectTables,
].map(table => getTableName(table));

export interface ClinicalTransferSnapshot {
  version: 1;
  fromUserId: string;
  toUserId: string;
  tables: Record<string, { ownerColumn: string; rowIds: string[] }>;
}

/**
 * Preserve IDs, content, timestamps, source provenance, and child FKs. Capture
 * UPDATE ... RETURNING IDs rather than a pre-update SELECT so the manifest
 * describes exactly the rows actually changed.
 */
export async function transferPatientClinicalRecords(
  tx: Transaction,
  fromUserId: string,
  toUserId: string,
): Promise<ClinicalTransferSnapshot> {
  const snapshot: ClinicalTransferSnapshot = {
    version: 1, fromUserId, toUserId, tables: {},
  };
  const transfer = async (table: AnyPgTable, owner: AnyPgColumn) => {
    const result = await tx.execute<{ id: string }>(sql`
      UPDATE ${table} SET ${sql.identifier(owner.name)} = ${toUserId}
      WHERE ${owner} = ${fromUserId} RETURNING id
    `);
    snapshot.tables[getTableName(table)] = {
      ownerColumn: owner.name,
      rowIds: result.rows.map(row => row.id),
    };
  };
  for (const table of userOwnedTables) await transfer(table, table.userId);
  for (const table of patientSubjectTables) await transfer(table, table.patientId);
  return snapshot;
}
