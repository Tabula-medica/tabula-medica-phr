/**
 * Africa-region storage layer.
 *
 * All methods read/write the af_* extension tables in shared/schema-af.ts.
 * *Enc columns are encrypted before persist and decrypted on read using the
 * standard phi-storage helpers.
 */

import { eq } from "drizzle-orm";
import { phiDb, encryptPhiRow, decryptPhiRow } from "./phi-storage";
import {
  afPatientIdentifiers,
  afPatientDemographics,
  afHealthCoverage,
  afConditionCodes,
  type AfPatientIdentifiers,
  type AfPatientDemographics,
  type AfHealthCoverage,
  type InsertAfPatientIdentifiers,
} from "../../shared/schema-af";

// ─── Identifiers ──────────────────────────────────────────────────────────────

async function getIdentifiers(
  profileId: string,
): Promise<AfPatientIdentifiers | null> {
  const [row] = await phiDb
    .select()
    .from(afPatientIdentifiers)
    .where(eq(afPatientIdentifiers.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("afPatientIdentifiers", row) : null;
}

async function upsertIdentifiers(
  profileId: string,
  input: Omit<InsertAfPatientIdentifiers, "profileId">,
): Promise<AfPatientIdentifiers> {
  const values = encryptPhiRow("afPatientIdentifiers", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(afPatientIdentifiers)
    .values(values)
    .onConflictDoUpdate({
      target: afPatientIdentifiers.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("afPatientIdentifiers", row);
}

// ─── Demographics ─────────────────────────────────────────────────────────────

async function getDemographics(
  profileId: string,
): Promise<AfPatientDemographics | null> {
  const [row] = await phiDb
    .select()
    .from(afPatientDemographics)
    .where(eq(afPatientDemographics.profileId, profileId))
    .limit(1);
  return row ? decryptPhiRow("afPatientDemographics", row) : null;
}

async function upsertDemographics(
  profileId: string,
  input: Partial<
    Omit<AfPatientDemographics, "id" | "profileId" | "createdAt" | "updatedAt">
  >,
): Promise<AfPatientDemographics> {
  const values = encryptPhiRow("afPatientDemographics", {
    ...input,
    profileId,
  });

  const [row] = await phiDb
    .insert(afPatientDemographics)
    .values(values as any)
    .onConflictDoUpdate({
      target: afPatientDemographics.profileId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return decryptPhiRow("afPatientDemographics", row);
}

// ─── Health Coverage ──────────────────────────────────────────────────────────

async function getCoverage(profileId: string): Promise<AfHealthCoverage[]> {
  return phiDb
    .select()
    .from(afHealthCoverage)
    .where(eq(afHealthCoverage.profileId, profileId));
}

async function upsertCoverage(
  profileId: string,
  id: string | undefined,
  input: Partial<Omit<AfHealthCoverage, "id" | "profileId" | "createdAt" | "updatedAt">>,
): Promise<AfHealthCoverage> {
  if (id) {
    const [row] = await phiDb
      .update(afHealthCoverage)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(afHealthCoverage.id, id))
      .returning();
    return row;
  }

  const [row] = await phiDb
    .insert(afHealthCoverage)
    .values({ ...input, profileId } as any)
    .returning();
  return row;
}

export const afStorage = {
  getIdentifiers,
  upsertIdentifiers,
  getDemographics,
  upsertDemographics,
  getCoverage,
  upsertCoverage,
};
