/**
 * RAF scoring for CMS-HCC V28.
 *
 * Two things happen here, and the order matters:
 *
 *   1. Hierarchy ("trumping"). Within a disease family, the severe HCC
 *      suppresses the milder ones. A patient coded for both diabetes with
 *      chronic complications and diabetes without complications is paid for the
 *      former only. Skipping this step inflates every score it touches, which
 *      is the direction that draws a False Claims Act complaint.
 *
 *   2. Summation against the *correct model segment*. The same HCC is worth
 *      different amounts to a community non-dual aged enrollee and to an
 *      institutional one. The segment is a required input with no default.
 *
 * Only conditions on a real, clinician-signed encounter are countable. Suspects
 * and problem-list entries are carried through the pipeline so a clinician can
 * see them, and are excluded from the arithmetic until attested.
 */

import {
  type HccCondition,
  type HccModelSegment,
  type RafResult,
} from "@shared/hcc-v28";
import { getHccTables, hccForIcd10 } from "./hcc-tables";

export interface RafDemographics {
  segment: HccModelSegment;
  /** Age at the CMS-defined reference date for the payment year. */
  age: number;
  sex: "male" | "female";
  /** True when the enrollee originally qualified for Medicare by disability. */
  originallyDisabled?: boolean;
}

export interface HierarchyOutcome {
  /** HCCs that survive and are paid. */
  payable: readonly number[];
  /** HCCs removed by a more severe HCC in the same family. */
  suppressed: readonly { hcc: number; suppressedBy: number }[];
}

/**
 * Apply the V28 hierarchy to a set of HCCs.
 *
 * Suppression is computed against the *original* set, not iteratively against
 * the shrinking one. If A suppresses B and B suppresses C, then a patient with
 * all three keeps only A — but C must not survive merely because B was already
 * removed when C's turn came. Evaluating every rule against the input set
 * avoids that order-dependence.
 */
export function applyHierarchy(hccs: readonly number[]): HierarchyOutcome {
  const tables = getHccTables();
  const unique = Array.from(new Set(hccs)).sort((a, b) => a - b);
  if (!tables) {
    // With no hierarchy table we cannot claim anything was suppressed. Report
    // the raw set; the caller's RAF attempt will refuse separately.
    return { payable: unique, suppressed: [] };
  }

  const suppressed: { hcc: number; suppressedBy: number }[] = [];
  const removed = new Set<number>();

  for (const candidate of unique) {
    for (const holder of unique) {
      if (holder === candidate) continue;
      if (tables.hierarchy.get(holder)?.has(candidate)) {
        if (!removed.has(candidate)) {
          removed.add(candidate);
          suppressed.push({ hcc: candidate, suppressedBy: holder });
        }
      }
    }
  }

  return {
    payable: unique.filter((h) => !removed.has(h)),
    suppressed,
  };
}

/** Resolve conditions to countable HCCs: coded encounters, or attested suspects. */
export function countableHccs(conditions: readonly HccCondition[]): number[] {
  const out: number[] = [];
  for (const condition of conditions) {
    const countable =
      condition.origin === "coded-encounter" || condition.clinicianAttested === true;
    if (!countable) continue;
    const hcc = condition.hcc ?? hccForIcd10(condition.icd10);
    if (hcc !== null) out.push(hcc);
  }
  return Array.from(new Set(out));
}

/**
 * The demographic factor name CMS uses for an age/sex cell.
 *
 * CMS publishes these as `F65_69`, `M70_74`, and so on, with open-ended top and
 * bottom bands. Producing a name that is not in the coefficient table causes a
 * *withheld* score rather than a silently-zero contribution — see below.
 */
export function demographicFactorName(age: number, sex: "male" | "female"): string {
  const prefix = sex === "female" ? "F" : "M";
  if (age < 35) return `${prefix}0_34`;
  if (age >= 95) return `${prefix}95_GT`;
  const lower = Math.floor((age - 35) / 5) * 5 + 35;
  return `${prefix}${lower}_${lower + 4}`;
}

/**
 * Compute a RAF score, or refuse.
 *
 * The refusal path is the important one. Every branch that returns
 * `status: "not-scored"` is a case where a number *could* have been produced —
 * by treating a missing coefficient as zero, or by defaulting the segment — and
 * where that number would have been wrong in a way nobody downstream could see.
 * A withheld score surfaces as a visible gap; a wrong score is billed.
 */
export function calculateRaf(
  conditions: readonly HccCondition[],
  demographics: RafDemographics,
): RafResult {
  const tables = getHccTables();
  if (!tables) {
    return {
      status: "not-scored",
      reason: "coefficients-not-loaded",
      detail:
        "No CMS-HCC V28 model tables are loaded. Set HCC_V28_TABLES_PATH to the " +
        "converted CMS release to enable RAF scoring. HCC eligibility and " +
        "documentation-gap detection do not require it and remain available.",
    };
  }

  if (!Number.isFinite(demographics.age) || demographics.age < 0) {
    return {
      status: "not-scored",
      reason: "missing-demographics",
      detail: "A valid age is required; CMS coefficients are age-banded.",
    };
  }

  const { segment } = demographics;
  const contributions: { factor: string; value: number }[] = [];
  const missingFactors: string[] = [];

  const demographicFactor = demographicFactorName(demographics.age, demographics.sex);
  const demographicValue = tables.coefficients.get(`${segment}::${demographicFactor}`);
  if (demographicValue === undefined) {
    missingFactors.push(demographicFactor);
  } else {
    contributions.push({ factor: demographicFactor, value: demographicValue });
  }

  const { payable } = applyHierarchy(countableHccs(conditions));
  for (const hcc of payable) {
    const factor = `HCC_${hcc}`;
    const value = tables.coefficients.get(`${segment}::${factor}`);
    if (value === undefined) {
      // A payable HCC with no coefficient in this segment is a table problem,
      // not a zero-weight condition. Treating it as zero would quietly
      // under-report; refusing makes the broken table visible.
      missingFactors.push(factor);
    } else {
      contributions.push({ factor, value });
    }
  }

  if (missingFactors.length > 0) {
    return {
      status: "not-scored",
      reason: "coefficients-not-loaded",
      detail:
        `The loaded ${tables.paymentYear} tables have no coefficient for segment ` +
        `"${segment}" and factor(s): ${missingFactors.join(", ")}. Scoring was ` +
        "withheld rather than treating the missing factors as zero.",
    };
  }

  const raf = contributions.reduce((sum, c) => sum + c.value, 0);

  return {
    status: "scored",
    // CMS publishes and applies RAF to three decimals.
    raf: Math.round(raf * 1000) / 1000,
    segment,
    contributions,
    provenance: tables.provenance.coefficients,
  };
}
