/**
 * Shared types for care-management billing: RPM, CCM, PCM, APCM.
 *
 * Built from an Optelle Health CCM/PCM superbill — the paper form a care
 * coordinator fills in at the end of a service period. The form is the honest
 * statement of the problem: a grid of codes with checkboxes, filled in from
 * memory at month end, signed by a physician attesting to accuracy. Every
 * failure mode this module exists to prevent is a plausible outcome of filling
 * that grid in slightly wrong.
 *
 * ## These codes are claims to the federal government
 *
 * The same framing the HCC engine carries, and it applies harder here. A RAF
 * coefficient error produces a wrong number. A care-management coding error
 * produces a claim asserting that a specific quantity of a specific kind of
 * work happened in a specific month. Care management is among the most
 * actively audited areas in Medicare, and the recurring findings are not
 * exotic:
 *
 * | Audit finding | What the module does about it |
 * |---|---|
 * | Time billed that was not documented | Time is an input with a source, never inferred; no rounding up |
 * | No comprehensive care plan on file | An absent or incomplete plan blocks every code that requires one |
 * | Consent never obtained | No consent on file refuses the month outright |
 * | CCM and PCM both billed for one patient | Same-month exclusivity is computed, not left to the coder |
 * | 99454 billed without 16 days of readings | Device-day count is a required input and is checked |
 * | The same minutes counted twice | Time is attributed to one program; overlap is refused |
 *
 * ## Nothing here is a bill
 *
 * The engine emits **candidates** with the facts that justify them. A
 * candidate is a proposal to a human coder, not an instruction to a
 * clearinghouse, for exactly the reason the ambient scribe emits drafts rather
 * than notes: the system can check arithmetic and prerequisites, and it cannot
 * know whether the twenty minutes were really spent.
 */

/** The four care-management families this module reasons about. */
export type CareProgram =
  /** Chronic Care Management — 2+ chronic conditions. */
  | "ccm"
  /** Complex CCM — as CCM, with moderate/high MDM and more time. */
  | "complex-ccm"
  /** Principal Care Management — one complex chronic condition. */
  | "pcm"
  /** Advanced Primary Care Management — monthly bundle, no time threshold. */
  | "apcm"
  /** Remote Physiologic Monitoring. */
  | "rpm"
  /** One-time care-planning add-on. */
  | "care-plan";

/** Who performed the time. The distinction changes which code applies. */
export type PerformerType =
  /** Physician or other qualified health professional, personally. */
  | "qhp"
  /** Clinical staff, under the direction of a physician/QHP. */
  | "clinical-staff";

/**
 * How a code accumulates.
 *
 * `base` is the first unit and carries the time floor. `addon` may only appear
 * alongside its base and is capped. `bundle` has no time component at all —
 * APCM's defining feature, and the reason it cannot be reasoned about with the
 * same arithmetic as the rest.
 */
export type CodeAccrual = "base" | "addon" | "bundle" | "one-time";

export interface CareCode {
  /** CPT or HCPCS code as it appears on a claim. */
  code: string;
  program: CareProgram;
  accrual: CodeAccrual;
  /** Human-readable, matching the descriptor family rather than quoting CPT. */
  label: string;
  performer?: PerformerType;
  /**
   * Minutes that must be documented before this unit may be proposed.
   * Absent for `bundle` and `one-time` codes.
   */
  minMinutes?: number;
  /** For an add-on, the base code it attaches to. */
  addonTo?: string;
  /** Maximum units of this code in one service period. */
  maxUnits?: number;
  /** Prerequisites that must be documented, or the code is refused. */
  requires: readonly Prerequisite[];
  /**
   * Codes that may not appear in the same service period for the same patient
   * and practitioner. Symmetry is not assumed — it is asserted by a test.
   */
  excludes: readonly string[];
}

/**
 * A fact that must be on file before a code can be proposed.
 *
 * Each maps to a documented requirement, and each is a real audit finding when
 * missing. None of them are inferable from the rest of the record: a system
 * that assumed consent because a patient was enrolled would be manufacturing
 * the very document an auditor asks for.
 */
export type Prerequisite =
  /** Patient agreed to the service, was told about cost sharing, and it is recorded. */
  | "patient-consent"
  /** A comprehensive, electronic care plan exists and is available to the care team. */
  | "care-plan"
  /** 2+ chronic conditions expected to last 12 months or until death. */
  | "two-plus-chronic-conditions"
  /** One complex chronic condition expected to last at least 3 months. */
  | "one-complex-chronic-condition"
  /** Moderate or high complexity medical decision making in the period. */
  | "moderate-high-mdm"
  /** An initiating visit within the required lookback. */
  | "initiating-visit"
  /** 24/7 access to a care team member for urgent needs. */
  | "round-the-clock-access"
  /** A device transmitting physiologic data was supplied. */
  | "device-supplied"
  /** At least 16 days of readings in the 30-day period. */
  | "sixteen-device-days"
  /** Live interactive contact with the patient or caregiver in the period. */
  | "interactive-communication";

/** Why a candidate was not produced. Every one is a deliberate refusal. */
export type CodingRefusal =
  | "rules-not-loaded"
  | "unknown-code"
  | "missing-prerequisite"
  | "below-time-threshold"
  | "unit-cap-reached"
  | "same-period-conflict"
  | "time-double-counted"
  | "no-service-period"
  | "performer-mismatch";

/** A calendar month, which is the unit these programs are billed in. */
export interface ServicePeriod {
  /** ISO date of the first day. */
  start: string;
  /** ISO date of the last day, inclusive. */
  end: string;
}

/** Minutes of work, attributed to one program and one performer type. */
export interface TimeEntry {
  program: CareProgram;
  performer: PerformerType;
  minutes: number;
  /** Where this came from — a note id, a log entry. Never blank. */
  source: string;
}

/** A proposed code, with the reasoning that produced it. */
export interface CodeCandidate {
  code: string;
  program: CareProgram;
  units: number;
  label: string;
  /** The facts that justified it, in the order they were checked. */
  rationale: readonly string[];
  /** Minutes consumed by this candidate, for the double-count check. */
  minutesUsed: number;
  /**
   * True when the catalog backing this candidate is the development seed
   * rather than an operator-loaded rule set. Never suppressed.
   */
  unverifiedRules: boolean;
}

/** A code that was considered and declined, with the reason. */
export interface CodeRefused {
  code: string;
  program: CareProgram;
  reason: CodingRefusal;
  detail: string;
}

export const CARE_MGMT_LIMITS = {
  /** Device readings required in a 30-day period before the supply code applies. */
  RPM_MIN_DEVICE_DAYS: 16,
  /** RPM device-supply period. Not a calendar month, which is a common error. */
  RPM_SUPPLY_PERIOD_DAYS: 30,
} as const;
