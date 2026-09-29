/**
 * Medication reconciliation gap detection.
 *
 * Two distinct things share the name "medication reconciliation" in Medicare
 * billing, and conflating them is how a tool ends up telling a practice it is
 * "done" when it is not:
 *
 *   - **G8427** is a quality-measure *attestation* — the clinician documented
 *     that the current medication list was reviewed. It is not separately
 *     payable.
 *   - **The TCM medication-reconciliation requirement** (CPT 99495/99496) is a
 *     *billing prerequisite* with its own 14-day-from-discharge deadline. This
 *     module reports whether that deadline was met as a distinct fact, and
 *     never lets a G8427 attestation stand in for it.
 *
 * `server/med-reconciliation-service.ts` is a different tool entirely — it
 * finds duplicate/conflicting entries across medication sources. It answers
 * "is the list internally consistent," not "was reconciliation performed and
 * documented within the required window." Both are legitimate; this module
 * only does the second.
 */

import type { GapCandidate, MedicareGapStatus } from "@shared/medicare-care-gaps";
import { MEDICARE_GAP_LIMITS } from "@shared/medicare-care-gaps";
import { gcodeRuleSet, findGCode } from "./g-code-catalog";

export interface MedRecFacts {
  /** Whether the current medication list has been reviewed and documented, at all. */
  medicationListDocumented: boolean;
  /** ISO date it was documented, if known. */
  medicationListDocumentedDate?: string;
  /** Most recent relevant hospital discharge, if any — triggers the TCM clock. */
  hospitalDischargeDate?: string;
  /** Date medication reconciliation was documented after that discharge, if done. */
  postDischargeMedRecDate?: string;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

export function evaluateMedicationReconciliationGaps(
  facts: MedRecFacts,
  asOf: Date,
): GapCandidate[] {
  const rules = gcodeRuleSet();
  const unverifiedRules = !rules.verified;
  const out: GapCandidate[] = [];

  // ── G8427: the quality-measure attestation ──────────────────────────────
  const g8427 = findGCode("G8427");
  out.push({
    category: "medication-reconciliation",
    code: "G8427",
    label: g8427?.label ?? "Medication list documented",
    status: facts.medicationListDocumented ? "up_to_date" : "overdue",
    lastDate: facts.medicationListDocumentedDate,
    rationale: [
      facts.medicationListDocumented
        ? `Current medication list documented${
            facts.medicationListDocumentedDate ? ` on ${facts.medicationListDocumentedDate}` : ""
          }. ${g8427?.note ?? ""}`
        : `No documentation on file that the current medication list was reviewed. ${
            g8427?.note ?? ""
          }`,
    ],
    unverifiedRules,
  });

  // ── TCM's own 14-day post-discharge deadline — a distinct fact ──────────
  if (facts.hospitalDischargeDate) {
    const discharge = new Date(facts.hospitalDischargeDate);
    const windowEnd = new Date(discharge);
    windowEnd.setDate(windowEnd.getDate() + MEDICARE_GAP_LIMITS.TCM_MED_REC_WINDOW_DAYS);

    let status: MedicareGapStatus;
    let rationale: string;
    if (facts.postDischargeMedRecDate) {
      const done = new Date(facts.postDischargeMedRecDate);
      const daysElapsed = daysBetween(discharge, done);
      if (daysElapsed <= MEDICARE_GAP_LIMITS.TCM_MED_REC_WINDOW_DAYS) {
        status = "up_to_date";
        rationale =
          `Medication reconciliation documented ${daysElapsed.toFixed(0)} day(s) after ` +
          `discharge (${facts.hospitalDischargeDate}), within the TCM 14-day window.`;
      } else {
        status = "overdue";
        rationale =
          `Medication reconciliation was documented, but ${daysElapsed.toFixed(0)} day(s) ` +
          "after discharge — past the TCM 99495/99496 14-day requirement. This is a " +
          "billing-prerequisite gap, not something G8427 alone closes.";
      }
    } else if (asOf < windowEnd) {
      status = "due_soon";
      rationale =
        `Discharged ${facts.hospitalDischargeDate}. Medication reconciliation for TCM ` +
        `(CPT 99495/99496) must be documented by ${windowEnd.toISOString().slice(0, 10)}.`;
    } else {
      status = "overdue";
      rationale =
        `Discharged ${facts.hospitalDischargeDate}; the TCM 14-day medication-reconciliation ` +
        "window closed with nothing documented. TCM cannot be billed for this episode " +
        "without it.";
    }

    out.push({
      category: "medication-reconciliation",
      // No G-code: TCM med-rec is a prerequisite for CPT 99495/99496, not a
      // separately billable G-code itself.
      code: null,
      label: "Post-discharge medication reconciliation (TCM prerequisite)",
      status,
      lastDate: facts.postDischargeMedRecDate,
      nextDueDate: windowEnd.toISOString().slice(0, 10),
      rationale: [rationale],
      unverifiedRules,
    });
  }

  return out;
}
