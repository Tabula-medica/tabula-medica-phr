/**
 * RVU and allowed-amount calculation for the Medicare Physician Fee Schedule.
 *
 * Order of operations, which is not arbitrary:
 *
 *   1. Pick the row — modifier-specific (`26`/`TC`) if one exists, else global.
 *   2. Pick the PE column by site of service. Facility and non-facility differ
 *      substantially; the wrong column is a large, invisible error.
 *   3. Apply payment modifiers (bilateral, assistant, co-surgeon).
 *   4. Apply the multiple-procedure reduction across the session's lines.
 *   5. Apply units.
 *   6. Geographically adjust each component by its own GPCI.
 *   7. Multiply by the conversion factor.
 *
 * Steps 6 and 7 are last because GPCIs are per-component: adjusting a summed
 * total by an averaged GPCI is a different — and wrong — number.
 *
 * ## Modifiers this refuses to price
 *
 * `52` (reduced services), `53` (discontinued), `54`/`55` (split surgical care)
 * change payment by amounts that depend on the individual code's global package
 * or on carrier discretion. There is no national percentage to apply. Rather
 * than invent one, lines carrying them are priced without a factor and flagged
 * for manual review — a flagged line gets looked at; a quietly-guessed one does
 * not.
 */

import {
  type RvuBreakdown,
  type RvuLineResult,
  type ServiceLine,
  type SiteOfService,
} from "@shared/rvu";
import {
  findGpci,
  findRvuRow,
  getPfsTables,
  isSeparatelyPayable,
  normalizeModifier,
  type LoadedRvuRow,
} from "./pfs-tables";

/**
 * Payment percentages that are national policy and code-independent.
 *
 * Deliberately short. Each entry is a rule that applies the same way to every
 * code it is valid on; anything code-dependent is handled as a review flag
 * instead.
 */
const MODIFIER_FACTORS: Record<string, { factor: number; label: string }> = {
  // Bilateral procedure — 150%, but only when the code's bilateral indicator
  // says the rule applies. Guarded below.
  "50": { factor: 1.5, label: "bilateral procedure (150%)" },
  // Assistant at surgery — 16% of the fee schedule amount.
  "80": { factor: 0.16, label: "assistant at surgery (16%)" },
  "81": { factor: 0.16, label: "minimum assistant at surgery (16%)" },
  "82": { factor: 0.16, label: "assistant at surgery, no resident available (16%)" },
  // Non-physician assistant — 85% of the 16% assistant amount.
  AS: { factor: 0.16 * 0.85, label: "non-physician assistant at surgery (85% of 16%)" },
  // Co-surgeons — each surgeon is paid 62.5%.
  "62": { factor: 0.625, label: "co-surgeon (62.5% each)" },
};

/** Modifiers whose effect is code-specific or carrier-priced. */
const REVIEW_MODIFIERS: Record<string, string> = {
  "52": "reduced services — payment reduction is carrier-determined, not a national percentage",
  "53": "discontinued procedure — payment depends on the point of discontinuation",
  "54": "surgical care only — the split depends on this code's global package",
  "55": "postoperative management only — the split depends on this code's global package",
  "66": "team surgery — carrier priced",
};

export interface PricingContext {
  /** Medicare locality for the place of service. */
  localityCode: string;
}

function peRvuFor(row: LoadedRvuRow, site: SiteOfService): number {
  return site === "facility" ? row.facilityPeRvu : row.nonFacilityPeRvu;
}

/**
 * Resolve the modifier multiplier for one line, plus any review notes.
 *
 * Multiple payment modifiers multiply. That is rare and usually a coding error,
 * so it is noted rather than silently compounded.
 */
function resolveModifierFactor(
  row: LoadedRvuRow,
  modifiers: readonly string[],
): { factor: number; notes: string[] } {
  const notes: string[] = [];
  let factor = 1;
  let applied = 0;

  for (const raw of modifiers) {
    const modifier = normalizeModifier(raw);

    if (modifier === "50") {
      // The 150% bilateral rule only applies when the code's bilateral
      // indicator permits it. On indicator 0 or 2 the code is already priced
      // as bilateral, and applying 150% overpays by half.
      if (row.bilateralIndicator === "1") {
        factor *= MODIFIER_FACTORS["50"].factor;
        applied += 1;
        notes.push(MODIFIER_FACTORS["50"].label);
      } else {
        notes.push(
          `modifier 50 present but this code's bilateral indicator is ` +
            `"${row.bilateralIndicator ?? "unknown"}" — the 150% rule was NOT applied`,
        );
      }
      continue;
    }

    if (modifier === "80" || modifier === "81" || modifier === "82" || modifier === "AS") {
      if (row.assistantSurgeryIndicator === "1") {
        notes.push(
          "assistant-at-surgery modifier present but this code never pays an " +
            "assistant (indicator 1) — no assistant factor applied",
        );
        continue;
      }
      const entry = MODIFIER_FACTORS[modifier];
      factor *= entry.factor;
      applied += 1;
      notes.push(entry.label);
      continue;
    }

    const known = MODIFIER_FACTORS[modifier];
    if (known) {
      factor *= known.factor;
      applied += 1;
      notes.push(known.label);
      continue;
    }

    const review = REVIEW_MODIFIERS[modifier];
    if (review) {
      notes.push(`modifier ${modifier} needs manual review: ${review}`);
    }
    // 26/TC are handled by row selection, not by a factor. Informational and
    // documentation modifiers are correctly ignored here.
  }

  if (applied > 1) {
    notes.push(
      "more than one payment modifier applied to this line; the factors were " +
        "multiplied, but verify the combination is correct",
    );
  }

  return { factor, notes };
}

/**
 * Price one line in isolation.
 *
 * `multipleProcedureFactor` is supplied by the caller because the reduction
 * depends on the *other* lines in the session — it cannot be known from one
 * line alone.
 */
export function priceLine(
  line: ServiceLine,
  context: PricingContext,
  multipleProcedureFactor = 1,
): RvuLineResult {
  const tables = getPfsTables();
  if (!tables) {
    return {
      status: "not-priced",
      code: line.code,
      reason: "tables-not-loaded",
      detail:
        "No CMS Physician Fee Schedule tables are loaded. Set PFS_RVU_TABLES_PATH " +
        "to the converted CMS Relative Value File, GPCI file and conversion factor.",
    };
  }

  const modifiers = line.modifiers ?? [];
  const row = findRvuRow(line.code, modifiers);
  if (!row) {
    return {
      status: "not-priced",
      code: line.code,
      reason: "code-not-in-fee-schedule",
      detail:
        `${line.code} is not in the loaded ${tables.year} Relative Value File. It may ` +
        "be a carrier-priced, non-covered or non-PFS code.",
    };
  }

  if (!isSeparatelyPayable(row)) {
    return {
      status: "not-priced",
      code: line.code,
      reason: "code-not-separately-payable",
      detail:
        `${line.code} carries PFS status indicator "${row.status}", which is not ` +
        "separately payable under the fee schedule (e.g. bundled, non-covered, " +
        "or carrier-priced). It contributes no RVUs.",
    };
  }

  const gpci = findGpci(context.localityCode);
  if (!gpci) {
    return {
      status: "not-priced",
      code: line.code,
      reason: "locality-not-found",
      detail:
        `Locality "${context.localityCode}" is not in the loaded ${tables.year} GPCI ` +
        "file. Pricing was withheld rather than defaulting to a GPCI of 1.0, which " +
        "would misprice every line in this locality.",
    };
  }

  const units = line.units && line.units > 0 ? line.units : 1;
  const { factor: modifierFactor, notes } = resolveModifierFactor(row, modifiers);
  const scale = modifierFactor * multipleProcedureFactor * units;

  const workRvu = row.workRvu * scale;
  const practiceExpenseRvu = peRvuFor(row, line.siteOfService) * scale;
  const malpracticeRvu = row.malpracticeRvu * scale;

  const breakdown: RvuBreakdown = {
    workRvu: round(workRvu, 4),
    practiceExpenseRvu: round(practiceExpenseRvu, 4),
    malpracticeRvu: round(malpracticeRvu, 4),
    totalRvu: round(workRvu + practiceExpenseRvu + malpracticeRvu, 4),
    siteOfService: line.siteOfService,
    modifierFactor,
    multipleProcedureFactor,
    units,
  };

  // Each component takes its own GPCI. Summing first and adjusting once would
  // be a different number.
  const adjustedRvu =
    workRvu * gpci.workGpci +
    practiceExpenseRvu * gpci.peGpci +
    malpracticeRvu * gpci.malpracticeGpci;

  if (row.nonFacilityPeRvu !== row.facilityPeRvu) {
    notes.push(
      `practice expense used the ${line.siteOfService} column ` +
        `(${peRvuFor(row, line.siteOfService)}); the other column is ` +
        `${peRvuFor(row, line.siteOfService === "facility" ? "non-facility" : "facility")}`,
    );
  }

  return {
    status: "priced",
    code: row.code,
    breakdown,
    adjustedRvu: round(adjustedRvu, 4),
    allowedAmount: round(adjustedRvu * tables.conversionFactor, 2),
    localityCode: context.localityCode,
    notes,
    provenance: tables.provenance.rvu,
  };
}

/**
 * Compute per-line multiple-procedure factors for one session.
 *
 * The standard surgical reduction pays the highest-valued procedure at 100% and
 * each subsequent one at 50%. Ranking is by *adjusted* RVU, not by the order the
 * lines arrived in — billing systems do not sort, and applying the reduction to
 * whichever line happened to come first underpays the major procedure.
 *
 * Only lines whose multiple-procedure indicator is `2` participate. E/M visits,
 * add-on codes and modifier-51-exempt codes are indicator `0` or `9` and are
 * never reduced.
 */
export function multipleProcedureFactors(
  lines: readonly ServiceLine[],
  context: PricingContext,
): number[] {
  const factors = new Array<number>(lines.length).fill(1);

  const eligible: { index: number; value: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = findRvuRow(lines[i].code, lines[i].modifiers ?? []);
    if (!row || row.multipleProcedureIndicator !== "2") continue;
    // Rank on the unreduced price of the line.
    const priced = priceLine(lines[i], context, 1);
    if (priced.status !== "priced") continue;
    eligible.push({ index: i, value: priced.adjustedRvu });
  }

  if (eligible.length < 2) return factors;

  eligible.sort((a, b) => b.value - a.value);
  eligible.forEach((entry, rank) => {
    factors[entry.index] = rank === 0 ? 1 : 0.5;
  });

  return factors;
}

export interface SessionPricing {
  lines: readonly RvuLineResult[];
  /** Sum of work RVUs across successfully priced lines. */
  totalWorkRvu: number;
  totalRvu: number;
  totalAllowedAmount: number;
  /** Lines that could not be priced, with the reason. */
  unpriced: readonly { code: string; reason: string; detail: string }[];
}

/** Price every line in a session, applying the multiple-procedure rule across them. */
export function priceSession(
  lines: readonly ServiceLine[],
  context: PricingContext,
): SessionPricing {
  const factors = multipleProcedureFactors(lines, context);
  const priced = lines.map((line, i) => priceLine(line, context, factors[i]));

  let totalWorkRvu = 0;
  let totalRvu = 0;
  let totalAllowedAmount = 0;
  const unpriced: { code: string; reason: string; detail: string }[] = [];

  for (const result of priced) {
    if (result.status === "priced") {
      totalWorkRvu += result.breakdown.workRvu;
      totalRvu += result.breakdown.totalRvu;
      totalAllowedAmount += result.allowedAmount;
    } else {
      unpriced.push({ code: result.code, reason: result.reason, detail: result.detail });
    }
  }

  return {
    lines: priced,
    totalWorkRvu: round(totalWorkRvu, 4),
    totalRvu: round(totalRvu, 4),
    totalAllowedAmount: round(totalAllowedAmount, 2),
    unpriced,
  };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
