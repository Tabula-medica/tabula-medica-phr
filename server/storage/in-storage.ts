/**
 * India-region storage layer.
 *
 * All methods read/write the in_* extension tables in shared/schema-in.ts.
 * *Enc columns are encrypted before persist and decrypted on read using the
 * standard phi-storage helpers.
 */

import { eq } from "drizzle-orm";
import { phiDb, encryptPhiRow, decryptPhiRow } from "./phi-storage";
import {
  inPatientIdentifiers,
  inPatientDemographics,
  inHealthCoverage,
  inConditionCodes,
  inAbdmConsent,
  type InPatientIdentifiers,
  type InPatientDemographics,
  type InHealthCoverage,
  type InAbdmConsent,
  type InsertInPatientIdentifiers,
} from "../../shared/schema-in";

// ─── Identifiers ──────────────────────────────────────────────────────────────

async function getIdentifiers(
  profileId: string,
): Promise<InPatientIdentifiers | null> {
  const [row] = await phiDb
    .select()
    .from(inPatientIdentifiers)
    .where(eq(inPatientIdentifiers.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("inPatientIdentifiers", row) : null;
}

async function upsertIdentifiers(
  profileId: string,
  input: Omit<InsertInPatientIdentifiers, "profileId">,
): Promise<InPatientIdentifiers> {
  const values = encryptPhiRow("inPatientIdentifiers", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(inPatientIdentifiers)
    .values(values)
    .onConflictDoUpdate({
      target: inPatientIdentifiers.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("inPatientIdentifiers", row);
}

// ─── Demographics ─────────────────────────────────────────────────────────────

async function getDemographics(
  profileId: string,
): Promise<InPatientDemographics | null> {
  const [row] = await phiDb
    .select()
    .from(inPatientDemographics)
    .where(eq(inPatientDemographics.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("inPatientDemographics", row) : null;
}

async function upsertDemographics(
  profileId: string,
  input: Partial<
    Omit<InPatientDemographics, "id" | "profileId" | "createdAt" | "updatedAt">
  >,
): Promise<InPatientDemographics> {
  const values = encryptPhiRow("inPatientDemographics", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(inPatientDemographics)
    .values(values as any)
    .onConflictDoUpdate({
      target: inPatientDemographics.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("inPatientDemographics", row);
}

// ─── Health Coverage ──────────────────────────────────────────────────────────

async function getCoverage(profileId: string): Promise<InHealthCoverage[]> {
  return phiDb
    .select()
    .from(inHealthCoverage)
    .where(eq(inHealthCoverage.profileId, profileId));
}

async function upsertCoverage(
  profileId: string,
  id: string | undefined,
  input: Partial<Omit<InHealthCoverage, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<InHealthCoverage> {
  if (id) {
    const [row] = await phiDb
      .update(inHealthCoverage)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(inHealthCoverage.id, id))
      .returning();
    return row;
  }

  const [row] = await phiDb
    .insert(inHealthCoverage)
    .values({ ...input, profileId } as any)
    .returning();
  return row;
}

// ─── ABDM Consent ─────────────────────────────────────────────────────────────

async function getAbdmConsent(
  profileId: string,
): Promise<InAbdmConsent | null> {
  const [row] = await phiDb
    .select()
    .from(inAbdmConsent)
    .where(eq(inAbdmConsent.profileId, profileId))
    .limit(1);
  return row ?? null;
}

async function upsertAbdmConsent(
  profileId: string,
  input: Partial<Omit<InAbdmConsent, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<InAbdmConsent> {
  const [row] = await phiDb
    .insert(inAbdmConsent)
    .values({ ...input, profileId } as any)
    .onConflictDoUpdate({
      target: inAbdmConsent.profileId,
      set: { ...input, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export const inStorage = {
  getIdentifiers,
  upsertIdentifiers,
  getDemographics,
  upsertDemographics,
  getCoverage,
  upsertCoverage,
  getAbdmConsent,
  upsertAbdmConsent,
};
