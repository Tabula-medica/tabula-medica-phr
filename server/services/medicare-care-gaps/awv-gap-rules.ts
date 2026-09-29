/**
 * Annual Wellness Visit gap detection — G0438 (initial) / G0439 (subsequent).
 *
 * Nobody upstream of this module gets to assert eligibility from age alone.
 * The initial AWV has a hard floor of 12 months *since the Part B effective
 * date*, not since birth or since enrollment in this product, and a
 * deployment that skipped that distinction would put patients newly on
 * Medicare in front of a code they cannot yet receive. Where that date is
 * missing, the engine refuses rather than guesses it from age.
 */

import type { GapCandidate, GapRefused, MedicareGapStatus } from "@shared/medicare-care-gaps";
import { MEDICARE_GAP_LIMITS } from "@shared/medicare-care-gaps";
import { gcodeRuleSet, findGCode } from "./g-code-catalog";

export interface AwvFacts {
  medicareEnrolled: boolean;
  /** ISO date. Required to time the initial AWV window when no AWV is on file. */
  partBEffectiveDate?: string;
  /** ISO date of the most recent AWV (initial or subsequent), if any. */
  lastAwvDate?: string;
}

export interface AwvGapResult {
  candidate: GapCandidate | null;
  refused: GapRefused | null;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

export function evaluateAwvGap(facts: AwvFacts, asOf: Date): AwvGapResult {
  const rules = gcodeRuleSet();
  const unverifiedRules = !rules.verified;

  if (!facts.medicareEnrolled) {
    return {
      candidate: null,
      refused: {
        category: "awv",
        reason: "not-medicare-enrolled",
        detail:
          "Patient is not recorded as Medicare-enrolled. The Annual Wellness Visit " +
          "(G0438/G0439) is a Medicare Part B benefit.",
      },
    };
  }

  const g0438 = findGCode("G0438");
  const g0439 = findGCode("G0439");

  if (!facts.lastAwvDate) {
    if (!facts.partBEffectiveDate) {
      return {
        candidate: null,
        refused: {
          category: "awv",
          reason: "missing-enrollment-date",
          detail:
            "No Part B effective date on file. The initial AWV (G0438) is not payable " +
            "until 12 months after that date, so it must be documented before " +
            "eligibility can be determined — it is not inferred from age.",
        },
      };
    }

    const monthsEnrolled = monthsBetween(new Date(facts.partBEffectiveDate), asOf);
    const eligible = monthsEnrolled >= MEDICARE_GAP_LIMITS.AWV_INTERVAL_MONTHS;

    return {
      candidate: {
        category: "awv",
        code: "G0438",
        label: g0438?.label ?? "Initial Annual Wellness Visit",
        status: eligible ? "overdue" : "not_applicable",
        rationale: eligible
          ? [
              `No prior AWV on file. Part B effective ${facts.partBEffectiveDate}, ` +
                `${monthsEnrolled.toFixed(1)} months ago — the initial AWV window is open.`,
            ]
          : [
              `Part B effective ${facts.partBEffectiveDate}; ${monthsEnrolled.toFixed(1)} ` +
                "months of enrollment. G0438 is not payable until 12 months after the " +
                "Part B effective date.",
            ],
        unverifiedRules,
      },
      refused: null,
    };
  }

  // A prior AWV exists — this is the subsequent-visit clock.
  const last = new Date(facts.lastAwvDate);
  const next = new Date(last);
  next.setMonth(next.getMonth() + MEDICARE_GAP_LIMITS.AWV_INTERVAL_MONTHS);
  const dueSoonThreshold = new Date(asOf);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + MEDICARE_GAP_LIMITS.DUE_SOON_WINDOW_DAYS);

  let status: MedicareGapStatus;
  if (next < asOf) status = "overdue";
  else if (next <= dueSoonThreshold) status = "due_soon";
  else status = "up_to_date";

  return {
    candidate: {
      category: "awv",
      code: "G0439",
      label: g0439?.label ?? "Subsequent Annual Wellness Visit",
      status,
      lastDate: facts.lastAwvDate,
      nextDueDate: next.toISOString().slice(0, 10),
      rationale: [
        `Last AWV on ${facts.lastAwvDate}. G0439 is payable once every 12 months from ` +
          "the prior AWV.",
      ],
      unverifiedRules,
    },
    refused: null,
  };
}
