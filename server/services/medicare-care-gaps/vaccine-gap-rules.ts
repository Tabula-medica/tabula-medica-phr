/**
 * Adult vaccine gap detection for the Medicare population.
 *
 * Deliberately a fresh, interval-correct evaluator rather than a reuse of
 * `server/services/vaccine-schedule-engine.ts`. That engine models
 * `dosesReceived >= dosesRequired` as a lifetime "up to date," and hard-codes
 * `dosesRequired: 1` for influenza and COVID-19 — which reads a flu shot from
 * five years ago as still current. A gap detector built on that logic would
 * silently under-report exactly the recurring vaccines Medicare quality
 * programs (and a competent care-gaps connector) care about most, so the
 * recurring vaccines here get their own interval math. Only Medicare G-codes
 * exist for influenza, pneumococcal, and hepatitis B administration; Tdap,
 * zoster, and COVID-19 are billed under CPT vaccine-administration codes, and
 * this module reports the clinical gap for them without inventing a G-code
 * that does not exist.
 */

import type { GapCandidate, MedicareGapStatus } from "@shared/medicare-care-gaps";
import { MEDICARE_GAP_LIMITS } from "@shared/medicare-care-gaps";
import { gcodeRuleSet, findGCode } from "./g-code-catalog";

export type VaccineKey = "influenza" | "pneumococcal" | "zoster" | "tdap" | "covid19";

export interface VaccineDoseRecord {
  /** ISO date of the most recent documented dose, if any. */
  lastDoseDate?: string;
  /** Total doses on file for this vaccine, when the series matters (zoster). */
  doseCount?: number;
}

export interface VaccineFacts {
  age: number;
  doses: Partial<Record<VaccineKey, VaccineDoseRecord>>;
}

interface VaccineRule {
  key: VaccineKey;
  label: string;
  gCode: string | null;
  minAge: number;
  /** 0 = no recurrence modeled (one-time adult series, e.g. pneumococcal). */
  intervalMonths: number;
  seriesDoses?: number;
  minInterDoseMonths?: number;
  notes: string;
}

const VACCINE_RULES: Record<VaccineKey, VaccineRule> = {
  influenza: {
    key: "influenza",
    label: "Seasonal influenza vaccination",
    gCode: "G0008",
    minAge: 0,
    intervalMonths: MEDICARE_GAP_LIMITS.INFLUENZA_INTERVAL_MONTHS,
    notes:
      "Annual, by ACIP recommendation. Modeled here as a 12-month interval from the " +
      "last documented dose, which approximates but does not exactly track the " +
      "fall/winter season boundary.",
  },
  pneumococcal: {
    key: "pneumococcal",
    label: "Pneumococcal vaccination",
    gCode: "G0009",
    minAge: 65,
    intervalMonths: 0,
    notes:
      "One-time adult series (PCV20, or PCV15 followed by PPSV23) for most " +
      "beneficiaries 65+ with no prior record. ACIP allows a second, later dose in " +
      "specific age/risk scenarios this engine does not model — an up_to_date result " +
      "means a dose is on file, not that no further dose could be indicated.",
  },
  zoster: {
    key: "zoster",
    label: "Zoster (shingles) vaccination — Shingrix, 2-dose series",
    gCode: null,
    minAge: 50,
    intervalMonths: 0,
    seriesDoses: 2,
    minInterDoseMonths: MEDICARE_GAP_LIMITS.ZOSTER_MIN_DOSE_INTERVAL_MONTHS,
    notes:
      "Billed under CPT vaccine-administration codes, not a Medicare G-code. Requires " +
      "2 doses at least 2 months apart; a single dose on file is reported as a gap " +
      "(series incomplete), not as up to date.",
  },
  tdap: {
    key: "tdap",
    label: "Tdap booster",
    gCode: null,
    minAge: 0,
    intervalMonths: MEDICARE_GAP_LIMITS.TDAP_INTERVAL_MONTHS,
    notes:
      "ACIP recommends a Td/Tdap booster every 10 years. Billed under CPT " +
      "vaccine-administration codes, not a Medicare G-code.",
  },
  covid19: {
    key: "covid19",
    label: "COVID-19 vaccination (current formulation)",
    gCode: null,
    minAge: 0,
    intervalMonths: MEDICARE_GAP_LIMITS.COVID_INTERVAL_MONTHS,
    notes:
      "Modeled as an annual updated-formulation dose per current ACIP/CDC guidance. " +
      "Billed under CPT/vaccine-specific codes, not a Medicare G-code. The current-season " +
      "recommendation changes; verify against it before relying on this interval.",
  },
};

function intervalStatus(
  lastIso: string | undefined,
  intervalMonths: number,
  asOf: Date,
): { status: MedicareGapStatus; nextDueDate?: string } {
  if (!lastIso) return { status: "overdue" };
  const last = new Date(lastIso);
  if (isNaN(last.getTime())) return { status: "overdue" };
  const next = new Date(last);
  next.setMonth(next.getMonth() + intervalMonths);
  const dueSoonThreshold = new Date(asOf);
  dueSoonThreshold.setDate(dueSoonThreshold.getDate() + MEDICARE_GAP_LIMITS.DUE_SOON_WINDOW_DAYS);
  const dueIso = next.toISOString().slice(0, 10);

  if (next < asOf) return { status: "overdue", nextDueDate: dueIso };
  if (next <= dueSoonThreshold) return { status: "due_soon", nextDueDate: dueIso };
  return { status: "up_to_date", nextDueDate: dueIso };
}

function evaluateOne(rule: VaccineRule, facts: VaccineFacts, asOf: Date, unverifiedRules: boolean): GapCandidate {
  const record = facts.doses[rule.key];
  const gcode = rule.gCode ? findGCode(rule.gCode) : null;
  const label = gcode?.label ?? rule.label;

  if (facts.age < rule.minAge) {
    return {
      category: "vaccine",
      code: rule.gCode,
      label,
      status: "not_applicable",
      rationale: [`Patient age ${facts.age} is below the ${rule.minAge}+ window for ${rule.label}.`],
      unverifiedRules,
    };
  }

  // Series-based vaccine (zoster): dose count matters, not just recency.
  if (rule.seriesDoses) {
    const count = record?.doseCount ?? 0;
    if (count >= rule.seriesDoses) {
      return {
        category: "vaccine",
        code: rule.gCode,
        label,
        status: "up_to_date",
        lastDate: record?.lastDoseDate,
        rationale: [`${count} of ${rule.seriesDoses} doses on file. Series complete. ${rule.notes}`],
        unverifiedRules,
      };
    }
    if (count === 0) {
      return {
        category: "vaccine",
        code: rule.gCode,
        label,
        status: "overdue",
        rationale: [`No doses on file. ${rule.notes}`],
        unverifiedRules,
      };
    }
    // One dose in, series incomplete — due unless the minimum inter-dose
    // interval has not yet elapsed, in which case it is not a gap yet.
    const minMonths = rule.minInterDoseMonths ?? 0;
    const { status, nextDueDate } = intervalStatus(record?.lastDoseDate, minMonths, asOf);
    const seriesStatus: MedicareGapStatus = status === "up_to_date" ? "due_soon" : status;
    return {
      category: "vaccine",
      code: rule.gCode,
      label,
      status: seriesStatus,
      lastDate: record?.lastDoseDate,
      nextDueDate,
      rationale: [
        `${count} of ${rule.seriesDoses} doses on file; series incomplete. ${rule.notes}`,
      ],
      unverifiedRules,
    };
  }

  // One-time series with no recurrence modeled (pneumococcal).
  if (rule.intervalMonths === 0) {
    if (record?.lastDoseDate) {
      return {
        category: "vaccine",
        code: rule.gCode,
        label,
        status: "up_to_date",
        lastDate: record.lastDoseDate,
        rationale: [`Dose on file (${record.lastDoseDate}). ${rule.notes}`],
        unverifiedRules,
      };
    }
    return {
      category: "vaccine",
      code: rule.gCode,
      label,
      status: "overdue",
      rationale: [`No dose on file. ${rule.notes}`],
      unverifiedRules,
    };
  }

  // Recurring, interval-based (influenza, COVID-19, Tdap).
  const { status, nextDueDate } = intervalStatus(record?.lastDoseDate, rule.intervalMonths, asOf);
  return {
    category: "vaccine",
    code: rule.gCode,
    label,
    status,
    lastDate: record?.lastDoseDate,
    nextDueDate,
    rationale: [
      record?.lastDoseDate
        ? `Last dose on ${record.lastDoseDate}. ${rule.notes}`
        : `No prior dose on file. ${rule.notes}`,
    ],
    unverifiedRules,
  };
}

export function evaluateVaccineGaps(facts: VaccineFacts, asOf: Date): GapCandidate[] {
  const rules = gcodeRuleSet();
  const unverifiedRules = !rules.verified;
  return (Object.keys(VACCINE_RULES) as VaccineKey[]).map((key) =>
    evaluateOne(VACCINE_RULES[key], facts, asOf, unverifiedRules),
  );
}
