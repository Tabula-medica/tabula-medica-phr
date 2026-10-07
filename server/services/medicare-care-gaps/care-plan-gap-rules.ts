/**
 * Comprehensive care-plan gap detection — G0506.
 *
 * Deliberately thin, and deliberately not a reimplementation. Whether a care
 * plan is complete — problem list, goals, care team, review schedule, and the
 * rest — is already answered element-by-element by
 * `server/services/care-management/care-plan.ts`'s `evaluateCarePlan()`, and
 * duplicating that logic here would create two places that could disagree
 * about the same plan. This module calls it, and translates the verdict into
 * a gap: no plan, or an incomplete one, is a G0506 opportunity; a complete,
 * recently-touched plan is not a gap at all.
 */

import type { GapCandidate } from "@shared/medicare-care-gaps";
import { evaluateCarePlan, type CarePlan } from "../care-management/care-plan";
import { gcodeRuleSet, findGCode } from "./g-code-catalog";

export interface CarePlanGapFacts {
  /** Chronic conditions on the problem list meeting the usual duration/risk test. */
  chronicConditionCount?: number;
  carePlan: CarePlan | null;
}

const MIN_CONDITIONS_FOR_CARE_PLAN = 1;

export function evaluateCarePlanGap(facts: CarePlanGapFacts, asOf: Date): GapCandidate {
  const rules = gcodeRuleSet();
  const unverifiedRules = !rules.verified;
  const g0506 = findGCode("G0506");
  const label = g0506?.label ?? "Comprehensive assessment and care planning";

  if (
    facts.chronicConditionCount === undefined ||
    facts.chronicConditionCount < MIN_CONDITIONS_FOR_CARE_PLAN
  ) {
    return {
      category: "care-plan",
      code: "G0506",
      label,
      status: "not_applicable",
      rationale: [
        facts.chronicConditionCount === undefined
          ? "Chronic condition count not provided; care-plan eligibility for CCM/PCM/APCM " +
            "cannot be assessed without it."
          : `${facts.chronicConditionCount} chronic condition(s) on file — below the ` +
            "threshold most care-management programs require.",
      ],
      unverifiedRules,
    };
  }

  // Use a nominal same-day period: the plan's own establish/review activity
  // is what evaluateCarePlan reasons about, not this connector's evaluation
  // window.
  const asOfIso = asOf.toISOString().slice(0, 10);
  const verdict = evaluateCarePlan(facts.carePlan, { start: asOfIso, end: asOfIso });

  if (!verdict.ok) {
    return {
      category: "care-plan",
      code: "G0506",
      label,
      status: verdict.reason === "absent" ? "overdue" : "due_soon",
      rationale: [verdict.detail],
      unverifiedRules,
    };
  }

  return {
    category: "care-plan",
    code: "G0506",
    label,
    status: "up_to_date",
    lastDate: facts.carePlan?.lastReviewedAt ?? facts.carePlan?.establishedAt,
    rationale: [
      "Comprehensive care plan on file and complete. " +
        (verdict.reviewedDuringPeriod
          ? "Established or revised as of this evaluation."
          : "No establish-or-revise activity recorded as of this evaluation date — " +
            "confirm the plan reflects the patient's current status before relying on it."),
    ],
    unverifiedRules,
  };
}
