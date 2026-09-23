/**
 * Outpatient dispensing policy — 100-day supply, 1 refill.
 *
 * Product decision: most medications should default to a 100-day supply with
 * one refill in the outpatient setting, dispensed at an explicit dose and
 * formulation. Long fills cut pharmacy trips, cut the gaps where chronic
 * patients lapse, and match how mail-order dispensing already works.
 *
 * "Most" is the operative word, and it is enforced here rather than assumed.
 * A blanket 100-day default applied to every drug would emit prescriptions
 * that are clinically wrong and, in several classes, facially illegal:
 *
 *   - Schedule II controlled substances cannot be refilled at all under US
 *     federal law (21 CFR 1306.12), and most states cap a single fill at 30
 *     days. "100 days, 1 refill" is not a valid Schedule II prescription.
 *   - Antibiotics and antivirals are finite courses. A 100-day amoxicillin
 *     supply is both a dosing error and a driver of resistance.
 *   - Monitoring-bound drugs (warfarin/INR, clozapine/ANC, lithium/level)
 *     are deliberately dispensed in short intervals so that the refill is the
 *     forcing function for the blood test. Extending the fill removes the
 *     safety interlock.
 *   - REMS-restricted teratogens (isotretinoin under iPLEDGE) are capped at
 *     30 days with no refills as a condition of the programme.
 *
 * So the default is expressed as a policy with a class-based cap table. Every
 * medication carries a `DispenseClass`; the extended default applies to the
 * chronic-maintenance class and is capped for the rest, with the reason
 * recorded on the result so the prescriber sees why they got 30 days instead
 * of 100 rather than silently receiving a different number.
 *
 * Nothing here prescribes. It computes defaults for a draft that a clinician
 * still reviews and signs — see `prescription-draft-service.ts`.
 */

/** The product default, in days. */
export const DEFAULT_DAYS_SUPPLY = 100;

/** The product default refill count. */
export const DEFAULT_REFILLS = 1;

/** Dispensing is an outpatient concept; inpatient is per-administration. */
export const DEFAULT_CARE_SETTING = "outpatient" as const;

export type CareSetting = "outpatient" | "inpatient";

/**
 * Why a medication may or may not take the extended default.
 *
 * The class drives the cap. Assigning a drug the wrong class is the way this
 * module fails, so each entry names the constraint it encodes.
 */
export type DispenseClass =
  /** Stable long-term therapy. Takes the full 100-day default. */
  | "chronic-maintenance"
  /** Finite treatment course — antibiotics, antivirals, steroid tapers. */
  | "acute-course"
  /** Guideline-bounded course reassessed at a fixed point (e.g. PPI 8 weeks). */
  | "guideline-limited-course"
  /** Refill interval is the forcing function for lab monitoring. */
  | "monitoring-bound"
  /** US Schedule II — non-refillable by law. */
  | "controlled-schedule-ii"
  /** US Schedules III–V — refills limited by law. */
  | "controlled-schedule-iii-v"
  /** REMS / risk-management programme with a mandated dispensing limit. */
  | "rems-restricted"
  /** As-needed rescue medication — dispensed by pack, not by days. */
  | "prn-rescue"
  /** Not classified. Cannot be granted the extended default. */
  | "unclassified";

interface ClassRule {
  /** Hard ceiling on days supply for this class. */
  readonly maxDaysSupply: number;
  /** Hard ceiling on refills for this class. */
  readonly maxRefills: number;
  /** Shown to the prescriber when a cap changes the default. */
  readonly reason: string;
}

/**
 * Caps by class. A class absent from this table takes the product default.
 *
 * The numbers are deliberately conservative: where a jurisdiction is stricter
 * than this table, the stricter rule governs, and the prescriber is the
 * backstop. This is a default generator, not a compliance engine.
 */
const CLASS_RULES: Readonly<Record<DispenseClass, ClassRule | null>> = {
  "chronic-maintenance": null,

  "acute-course": {
    maxDaysSupply: 14,
    maxRefills: 0,
    reason:
      "Finite treatment course — dispensed for the prescribed course, not an extended supply.",
  },

  "guideline-limited-course": {
    maxDaysSupply: 56,
    maxRefills: 0,
    reason:
      "Guideline-bounded course (8 weeks) — therapy is reassessed before continuing.",
  },

  "monitoring-bound": {
    maxDaysSupply: 30,
    maxRefills: 0,
    reason:
      "Refill interval is the forcing function for required lab monitoring — extending it removes that check.",
  },

  "controlled-schedule-ii": {
    maxDaysSupply: 30,
    maxRefills: 0,
    reason:
      "Schedule II controlled substance — refills are prohibited (21 CFR 1306.12).",
  },

  "controlled-schedule-iii-v": {
    maxDaysSupply: 30,
    maxRefills: 5,
    reason:
      "Schedule III–V controlled substance — refills limited to 5 within 6 months.",
  },

  "rems-restricted": {
    maxDaysSupply: 30,
    maxRefills: 0,
    reason:
      "REMS programme mandates a 30-day limit with no refills.",
  },

  "prn-rescue": {
    maxDaysSupply: 30,
    maxRefills: 2,
    reason:
      "As-needed rescue medication — dispensed by pack rather than by days supply.",
  },

  unclassified: {
    maxDaysSupply: 30,
    maxRefills: 0,
    reason:
      "Medication is not in the classified catalogue. The extended supply is withheld because the system cannot rule out an antibiotic, controlled substance, or monitoring-bound drug.",
  },
};

/**
 * Initial fill of a newly started medication, in days.
 *
 * Even for chronic therapy the first fill is short. Committing a patient to
 * 100 days of a drug they have never taken means 100 days of product wasted
 * if they cannot tolerate it, and a longer window before the intolerance is
 * noticed. The extended supply starts at the first continuation fill.
 */
export const NEW_START_DAYS_SUPPLY = 30;

export interface DispenseDefaultsInput {
  dispenseClass: DispenseClass;
  /** Number of doses taken per day; drives the quantity calculation. */
  dosesPerDay: number;
  /** Outpatient unless explicitly inpatient. */
  careSetting?: CareSetting;
  /**
   * True when this is the patient's first fill of the medication. Shortens
   * the supply regardless of class — see NEW_START_DAYS_SUPPLY.
   */
  isNewStart?: boolean;
  /** Prescriber override. Still subject to the class cap. */
  requestedDaysSupply?: number;
  /** Prescriber override. Still subject to the class cap. */
  requestedRefills?: number;
}

export interface DispenseDefaults {
  daysSupply: number;
  refills: number;
  /** doses/day × days supply, rounded up to a whole dose unit. */
  quantity: number;
  careSetting: CareSetting;
  /** Human-readable duration, e.g. "100 days". */
  duration: string;
  /** Which rule produced this result. */
  appliedPolicy:
    | "standard-100-day"
    | "class-capped"
    | "new-start"
    | "prescriber-override"
    | "inpatient";
  /** Present when the result differs from the product default. */
  capReason?: string;
}

/**
 * Resolve the dispensing defaults for one medication.
 *
 * Precedence, strictest wins:
 *   1. Inpatient — the 100-day concept does not apply.
 *   2. Class cap — legal and clinical ceilings.
 *   3. New start — short first fill.
 *   4. Prescriber request, if any.
 *   5. The product default: 100 days, 1 refill.
 *
 * A prescriber override is honoured up to the class cap but never through it:
 * this generates a *draft*, and a draft that quietly proposes an illegal
 * Schedule II refill because someone passed `requestedRefills: 3` is worse
 * than no draft at all.
 */
export function resolveDispenseDefaults(
  input: DispenseDefaultsInput,
): DispenseDefaults {
  const careSetting = input.careSetting ?? DEFAULT_CARE_SETTING;
  const dosesPerDay = input.dosesPerDay > 0 ? input.dosesPerDay : 1;

  if (careSetting === "inpatient") {
    // Inpatient medication is dispensed per administration by the ward, so a
    // days-supply default is meaningless. Emit a single day and let the
    // administration record drive it.
    return {
      daysSupply: 1,
      refills: 0,
      quantity: Math.ceil(dosesPerDay),
      careSetting,
      duration: "1 day",
      appliedPolicy: "inpatient",
      capReason:
        "Inpatient order — dispensed per administration, not as a days supply.",
    };
  }

  const rule = CLASS_RULES[input.dispenseClass];

  // Start from the product default or the prescriber's request.
  let daysSupply = input.requestedDaysSupply ?? DEFAULT_DAYS_SUPPLY;
  let refills = input.requestedRefills ?? DEFAULT_REFILLS;
  let appliedPolicy: DispenseDefaults["appliedPolicy"] =
    input.requestedDaysSupply != null || input.requestedRefills != null
      ? "prescriber-override"
      : "standard-100-day";
  let capReason: string | undefined;

  // New start shortens the supply but never lengthens it.
  if (input.isNewStart && daysSupply > NEW_START_DAYS_SUPPLY) {
    daysSupply = NEW_START_DAYS_SUPPLY;
    appliedPolicy = "new-start";
    capReason =
      "First fill of a newly started medication — shortened so tolerance is confirmed before an extended supply.";
  }

  // Class cap is the outermost limit and overrides everything above it.
  if (rule) {
    const cappedDays = Math.min(daysSupply, rule.maxDaysSupply);
    const cappedRefills = Math.min(refills, rule.maxRefills);
    if (cappedDays !== daysSupply || cappedRefills !== refills) {
      daysSupply = cappedDays;
      refills = cappedRefills;
      appliedPolicy = "class-capped";
      capReason = rule.reason;
    }
  }

  return {
    daysSupply,
    refills,
    quantity: Math.ceil(dosesPerDay * daysSupply),
    careSetting,
    duration: `${daysSupply} days`,
    appliedPolicy,
    capReason,
  };
}

/**
 * Parse a free-text frequency ("twice daily", "once daily at bedtime") into
 * doses per day, for quantity calculation.
 *
 * Returns null when the frequency cannot be read confidently. Callers must
 * treat null as "do not compute a quantity" rather than assuming 1 — guessing
 * here produces a quantity that silently under- or over-dispenses.
 */
export function dosesPerDayFromFrequency(frequency: string): number | null {
  const f = frequency.toLowerCase().trim();

  if (/\b(four times|qid|4 times)\b/.test(f)) return 4;
  if (/\b(three times|tid|3 times|every 8 hours)\b/.test(f)) return 3;
  if (/\b(twice|bid|2 times|every 12 hours)\b/.test(f)) return 2;
  if (/\b(once|daily|qd|every 24 hours|each morning|at bedtime|nightly)\b/.test(f)) {
    return 1;
  }
  if (/\bevery other day\b/.test(f)) return 0.5;
  if (/\b(weekly|once a week)\b/.test(f)) return 1 / 7;

  return null;
}
