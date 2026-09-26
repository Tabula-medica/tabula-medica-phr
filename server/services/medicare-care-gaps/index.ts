/**
 * The Medicare care-gaps connector.
 *
 * One evaluation across the four gaps a Medicare population-health tool is
 * expected to close — Annual Wellness Visit, adult vaccines, medication
 * reconciliation, and the comprehensive care plan — each mapped to its
 * Medicare G-code where one exists, and to a plainly-stated "no G-code for
 * this" where it does not. Same discipline as
 * `server/services/care-management/eligibility.ts`: facts in, candidates out,
 * nothing here is a claim.
 *
 * Deliberately not a re-implementation of what already exists. Care-plan
 * completeness is answered by `care-management/care-plan.ts`. The monthly
 * CCM/PCM/APCM codes those plans unlock are answered by
 * `care-management/eligibility.ts`. USPSTF screening gaps (colorectal,
 * breast, cervical, lung, diabetes, hypertension, depression, statin) are
 * answered by `server/care-gaps-service.ts`. This connector's job is the four
 * gaps none of those cover, tied together behind one evaluation.
 */

import type { GapCandidate, GapRefused } from "@shared/medicare-care-gaps";
import { gcodeRuleSet } from "./g-code-catalog";
import { evaluateAwvGap, type AwvFacts } from "./awv-gap-rules";
import { evaluateVaccineGaps, type VaccineFacts } from "./vaccine-gap-rules";
import {
  evaluateMedicationReconciliationGaps,
  type MedRecFacts,
} from "./medication-reconciliation-gap-rules";
import { evaluateCarePlanGap, type CarePlanGapFacts } from "./care-plan-gap-rules";

export interface MedicareGapFacts {
  patientId: string;
  /** ISO date this evaluation is being made as of. Defaults to now. */
  asOf?: string;
  medicareEnrolled: boolean;
  awv: Pick<AwvFacts, "partBEffectiveDate" | "lastAwvDate">;
  vaccine: VaccineFacts;
  medRec: MedRecFacts;
  carePlan: CarePlanGapFacts;
}

export interface MedicareGapEvaluation {
  candidates: readonly GapCandidate[];
  refused: readonly GapRefused[];
  summary: {
    overdue: number;
    due_soon: number;
    up_to_date: number;
    not_applicable: number;
  };
  unverifiedRules: boolean;
  evaluatedAt: string;
}

export function evaluateMedicareGaps(facts: MedicareGapFacts): MedicareGapEvaluation {
  const rules = gcodeRuleSet();
  const unverifiedRules = !rules.verified;
  const asOf = facts.asOf ? new Date(facts.asOf) : new Date();

  const candidates: GapCandidate[] = [];
  const refused: GapRefused[] = [];

  const awvResult = evaluateAwvGap(
    { medicareEnrolled: facts.medicareEnrolled, ...facts.awv },
    asOf,
  );
  if (awvResult.candidate) candidates.push(awvResult.candidate);
  if (awvResult.refused) refused.push(awvResult.refused);

  if (facts.medicareEnrolled) {
    candidates.push(...evaluateVaccineGaps(facts.vaccine, asOf));
    candidates.push(...evaluateMedicationReconciliationGaps(facts.medRec, asOf));
    candidates.push(evaluateCarePlanGap(facts.carePlan, asOf));
  } else {
    refused.push({
      category: "vaccine",
      reason: "not-medicare-enrolled",
      detail:
        "Patient is not recorded as Medicare-enrolled. Vaccine, medication-reconciliation, " +
        "and care-plan gaps here are evaluated against Medicare's G-code/quality-measure " +
        "framework and are only meaningful for enrolled beneficiaries.",
    });
  }

  const summary = {
    overdue: candidates.filter((c) => c.status === "overdue").length,
    due_soon: candidates.filter((c) => c.status === "due_soon").length,
    up_to_date: candidates.filter((c) => c.status === "up_to_date").length,
    not_applicable: candidates.filter((c) => c.status === "not_applicable").length,
  };

  return {
    candidates,
    refused,
    summary,
    unverifiedRules,
    evaluatedAt: new Date().toISOString(),
  };
}
