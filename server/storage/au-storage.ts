/**
 * AU-region storage layer.
 *
 * All methods read/write the au_* extension tables defined in shared/schema-au.ts.
 * Identifier values that are marked *Enc in the schema are encrypted before
 * persist and decrypted on read using the standard phi-storage helpers.
 *
 * Usage:
 *   import { auStorage } from "@/server/storage/au-storage";
 *   const ids = await auStorage.getIdentifiers(profileId);
 */

import { eq } from "drizzle-orm";
import { phiDb, encryptPhiRow, decryptPhiRow } from "./phi-storage";
import {
  auPatientIdentifiers,
  auPatientDemographics,
  auHealthCoverage,
  auMedicationCodes,
  auConditionCodes,
  auMyhrConsent,
  type AuPatientIdentifiers,
  type AuPatientDemographics,
  type AuHealthCoverage,
  type AuMedicationCodes,
  type AuConditionCodes,
  type AuMyhrConsent,
  type InsertAuPatientIdentifiers,
} from "../../shared/schema-au";

// ─── Identifiers ──────────────────────────────────────────────────────────────

async function getIdentifiers(
  profileId: string,
): Promise<AuPatientIdentifiers | null> {
  const [row] = await phiDb
    .select()
    .from(auPatientIdentifiers)
    .where(eq(auPatientIdentifiers.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("auPatientIdentifiers", row) : null;
}

async function upsertIdentifiers(
  profileId: string,
  input: Omit<InsertAuPatientIdentifiers, "profileId">,
): Promise<AuPatientIdentifiers> {
  const values = encryptPhiRow("auPatientIdentifiers", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(auPatientIdentifiers)
    .values(values)
    .onConflictDoUpdate({
      target: auPatientIdentifiers.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("auPatientIdentifiers", row);
}

// ─── Demographics ─────────────────────────────────────────────────────────────

async function getDemographics(
  profileId: string,
): Promise<AuPatientDemographics | null> {
  const [row] = await phiDb
    .select()
    .from(auPatientDemographics)
    .where(eq(auPatientDemographics.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("auPatientDemographics", row) : null;
}

async function upsertDemographics(
  profileId: string,
  input: Partial<Omit<AuPatientDemographics, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<AuPatientDemographics> {
  const values = encryptPhiRow("auPatientDemographics", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(auPatientDemographics)
    .values(values)
    .onConflictDoUpdate({
      target: auPatientDemographics.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("auPatientDemographics", row);
}

// ─── Health Coverage ──────────────────────────────────────────────────────────

async function getCoverage(profileId: string): Promise<AuHealthCoverage[]> {
  return phiDb
    .select()
    .from(auHealthCoverage)
    .where(eq(auHealthCoverage.profileId, profileId));
}

async function upsertCoverage(
  profileId: string,
  coverageId: string,
  input: Partial<Omit<AuHealthCoverage, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<AuHealthCoverage> {
  const values = { ...input, profileId, id: coverageId };
  const [row] = await phiDb
    .insert(auHealthCoverage)
    .values(values)
    .onConflictDoUpdate({
      target: auHealthCoverage.id,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

// ─── Medication codes ─────────────────────────────────────────────────────────

async function getMedicationCodes(
  medicationId: string,
): Promise<AuMedicationCodes | null> {
  const [row] = await phiDb
    .select()
    .from(auMedicationCodes)
    .where(eq(auMedicationCodes.medicationId, medicationId))
    .limit(1);
  return row ?? null;
}

async function upsertMedicationCodes(
  medicationId: string,
  input: Partial<Omit<AuMedicationCodes, "id" | "medicationId" | "createdAt" | "updatedAt">>,
): Promise<AuMedicationCodes> {
  const values = { ...input, medicationId };
  const [row] = await phiDb
    .insert(auMedicationCodes)
    .values(values)
    .onConflictDoUpdate({
      target: auMedicationCodes.medicationId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

// ─── Condition codes ──────────────────────────────────────────────────────────

async function getConditionCodes(
  medicalHistoryId: string,
): Promise<AuConditionCodes | null> {
  const [row] = await phiDb
    .select()
    .from(auConditionCodes)
    .where(eq(auConditionCodes.medicalHistoryId, medicalHistoryId))
    .limit(1);
  return row ?? null;
}

async function upsertConditionCodes(
  medicalHistoryId: string,
  input: Partial<Omit<AuConditionCodes, "id" | "medicalHistoryId" | "createdAt">>,
): Promise<AuConditionCodes> {
  const [row] = await phiDb
    .insert(auConditionCodes)
    .values({ ...input, medicalHistoryId })
    .onConflictDoUpdate({
      target: auConditionCodes.medicalHistoryId,
      set: input,
    })
    .returning();
  return row;
}

// ─── MyHR Consent ─────────────────────────────────────────────────────────────

async function getMyhrConsent(
  profileId: string,
): Promise<AuMyhrConsent | null> {
  const [row] = await phiDb
    .select()
    .from(auMyhrConsent)
    .where(eq(auMyhrConsent.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("auMyhrConsent", row) : null;
}

async function upsertMyhrConsent(
  profileId: string,
  input: Partial<Omit<AuMyhrConsent, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<AuMyhrConsent> {
  const values = encryptPhiRow("auMyhrConsent", { ...input, profileId });
  const [row] = await phiDb
    .insert(auMyhrConsent)
    .values(values)
    .onConflictDoUpdate({
      target: auMyhrConsent.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return decryptPhiRow("auMyhrConsent", row);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const auStorage = {
  getIdentifiers,
  upsertIdentifiers,
  getDemographics,
  upsertDemographics,
  getCoverage,
  upsertCoverage,
  getMedicationCodes,
  upsertMedicationCodes,
  getConditionCodes,
  upsertConditionCodes,
  getMyhrConsent,
  upsertMyhrConsent,
};
