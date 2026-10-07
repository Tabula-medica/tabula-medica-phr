/**
 * Durable, unifiedPatientId-keyed storage for `server/rcm/eligibility.ts`'s
 * real X12 270/271 logic.
 *
 * `server/rcm/store.ts` is explicitly tenant-scoped and in-memory by design
 * ("mirrors the EHR pattern: runtime in-memory until a DATABASE_URL-backed
 * store is provided"). This bridges its output into the PHR's own durable
 * record so the Patient Operations status survives a restart, without
 * touching or duplicating the RCM module itself — `checkEligibility`,
 * `stubEligibilityVendor`, and `build270`/`parse271` are reused exactly as
 * written.
 *
 * The `source` field is carried through unchanged. `financialClearance` in
 * `eligibility.ts` already refuses to treat a `"stub"` result as verified
 * financial clearance; this module extends that same honesty to the
 * persisted record and the status view, never upgrading "stub" to look
 * like a real payer response.
 */
import { eq, desc } from "drizzle-orm";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "../../storage/phi-storage";
import { patientEligibilityChecksTable, type PatientEligibilityCheckRow } from "@shared/schema";
import { checkEligibility, stubEligibilityVendor, type EligibilityRequest, type EligibilityVendor } from "../../rcm/eligibility";
import type { PersistedEligibilityCheck } from "@shared/patient-operations";

function toPersisted(row: PatientEligibilityCheckRow): PersistedEligibilityCheck {
  return {
    id: row.id,
    unifiedPatientId: row.unifiedPatientId,
    active: row.active,
    planName: row.planName ?? undefined,
    copayOfficeVisit: row.copayOfficeVisit ?? undefined,
    coinsurancePct: row.coinsurancePct ?? undefined,
    deductibleRemaining: row.deductibleRemaining ?? undefined,
    networkStatus: row.networkStatus ?? undefined,
    requiresReferral: row.requiresReferral ?? undefined,
    source: row.source,
    checkedAt: row.checkedAt.toISOString(),
  };
}

export async function runEligibilityCheck(
  unifiedPatientId: string,
  request: EligibilityRequest,
  vendor: EligibilityVendor = stubEligibilityVendor,
): Promise<PersistedEligibilityCheck> {
  const benefits = await checkEligibility(request, vendor);
  const [row] = await phiDb
    .insert(patientEligibilityChecksTable)
    .values(
      encryptPhiRow("patientEligibilityChecksTable", {
        unifiedPatientId,
        active: benefits.active,
        planName: benefits.planName,
        copayOfficeVisit: benefits.copayOfficeVisit,
        coinsurancePct: benefits.coinsurancePct,
        deductibleRemaining: benefits.deductibleRemaining,
        networkStatus: benefits.networkStatus,
        requiresReferral: benefits.requiresReferral,
        source: benefits.source,
        checkedAt: new Date(benefits.checkedAt),
      }),
    )
    .returning();
  return toPersisted(decryptPhiRow("patientEligibilityChecksTable", row));
}

export async function getLatestEligibility(unifiedPatientId: string): Promise<PersistedEligibilityCheck | undefined> {
  const rows = await phiDb
    .select()
    .from(patientEligibilityChecksTable)
    .where(eq(patientEligibilityChecksTable.unifiedPatientId, unifiedPatientId))
    .orderBy(desc(patientEligibilityChecksTable.checkedAt))
    .limit(1);
  const [row] = decryptPhiRows("patientEligibilityChecksTable", rows);
  return row ? toPersisted(row) : undefined;
}
