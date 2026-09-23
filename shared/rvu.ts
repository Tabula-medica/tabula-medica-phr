/**
 * Medicare Physician Fee Schedule — RVU types and model facts.
 *
 * ## The formula
 *
 * A service's Medicare allowed amount is:
 *
 *   allowed = [ (wRVU × workGPCI)
 *             + (peRVU × peGPCI)
 *             + (mpRVU × mpGPCI) ] × conversionFactor
 *
 * Three separately-geographically-adjusted components, then one national dollar
 * multiplier. Each piece matters:
 *
 *   - **wRVU** (work) is the physician's time, skill and intensity. This is the
 *     component used for productivity and compensation, because it is the only
 *     one that reflects what the clinician did rather than what the practice
 *     spent or insured.
 *   - **peRVU** (practice expense) comes in two flavours — *facility* and
 *     *non-facility* — and they differ a great deal. The same office visit pays
 *     materially less in a hospital outpatient department, because the hospital
 *     is separately paid for the overhead. Using the wrong one is one of the
 *     easiest ways to produce a confidently wrong number.
 *   - **mpRVU** (malpractice) is small and specialty-driven.
 *
 * ## What this file does not contain
 *
 * No RVU values, no GPCIs, no conversion factor. Those are ~10,000 rows CMS
 * republishes every year (and revises quarterly), and a stale conversion factor
 * silently misprices every claim it touches. They load at runtime — see
 * `server/services/rvu/pfs-tables.ts`.
 *
 * ## CPT is licensed
 *
 * The RVU *values* in the CMS Relative Value File are US Government work. The
 * CPT **code descriptors** are copyright the American Medical Association and
 * require a license to store or display. This module therefore keeps descriptors
 * optional throughout: the engine works on codes alone, and a deployment
 * supplies descriptors only if it holds a license. Nothing here ships a
 * descriptor.
 */

export const PFS_MODEL = {
  name: "Medicare Physician Fee Schedule",
  /** The three RVU components, each separately geographically adjusted. */
  components: ["work", "practice-expense", "malpractice"],
  /**
   * CMS revises the Relative Value File quarterly within a year (RVU25A, RVU25B,
   * …). A file's quarter is part of its identity, not a detail.
   */
  revisedQuarterly: true,
} as const;

/** Where the service was performed. Selects which PE RVU applies. */
export type SiteOfService = "facility" | "non-facility";

/**
 * PFS status indicator — whether a code is separately payable at all.
 *
 * Ignoring this is how a bundled or non-covered code ends up contributing a
 * cheerful dollar figure to a report. Only some indicators are payable under
 * the fee schedule.
 */
export type PfsStatusIndicator =
  /** Active code, separately payable. */
  | "A"
  /** Bundled — payment is always bundled into another service. */
  | "B"
  /** Carrier-priced; no national RVU. */
  | "C"
  /** Non-covered by Medicare. */
  | "N"
  /** Measurement code / not valid for Medicare. */
  | "I"
  /** Restricted coverage. */
  | "R"
  /** Excluded from the PFS by regulation. */
  | "X"
  /** Deleted/discontinued. */
  | "D";

/** Indicators under which a code is separately payable on the PFS. */
export const PAYABLE_STATUS_INDICATORS: readonly PfsStatusIndicator[] = ["A", "R"];

/** One row of the CMS Relative Value File. */
export interface RvuRow {
  /** HCPCS/CPT code, 5 characters. */
  code: string;
  /** Modifier the row is specific to, when the file splits by modifier
   *  (`26` professional component, `TC` technical component). */
  modifier?: string;
  workRvu: number;
  /** Practice expense RVU when performed in a facility. */
  facilityPeRvu: number;
  /** Practice expense RVU when performed outside a facility. */
  nonFacilityPeRvu: number;
  malpracticeRvu: number;
  status: PfsStatusIndicator;
  /**
   * Multiple-procedure indicator. `2` means the standard surgical reduction
   * applies (100% / 50% / 50% …); `0` means no reduction. Other values carry
   * their own rules and are treated as "do not reduce, flag for review".
   */
  multipleProcedureIndicator?: string;
  /** Global period, e.g. "000", "010", "090", "XXX". */
  globalPeriod?: string;
  /** Bilateral surgery indicator — `1` means the 150% bilateral rule applies. */
  bilateralIndicator?: string;
  /** Assistant-at-surgery indicator — `0`/`1`/`2`/`9`. `1` = never payable. */
  assistantSurgeryIndicator?: string;
}

/** Geographic Practice Cost Indices for one Medicare locality. */
export interface GpciRow {
  /** Medicare Administrative Contractor locality code. */
  localityCode: string;
  localityName?: string;
  workGpci: number;
  peGpci: number;
  malpracticeGpci: number;
}

/** Provenance for a loaded CMS file, so a dollar figure can be traced back. */
export interface PfsProvenance {
  source: string;
  /** Calendar year the file is published for. */
  year: number;
  /** Quarterly revision the file belongs to, e.g. "A", "B", "C", "D". */
  quarter?: string;
  sha256: string;
  loadedAt: string;
}

/** A single billed service line. */
export interface ServiceLine {
  code: string;
  /** CPT/HCPCS modifiers on the line, e.g. ["26"], ["50"], ["80"]. */
  modifiers?: readonly string[];
  units?: number;
  siteOfService: SiteOfService;
  /** ISO-8601 date of service. */
  dateOfService?: string;
  /** NPI of the clinician who actually performed the service. */
  renderingNpi?: string;
  /** NPI the line was billed under. Differs from rendering under incident-to. */
  billingNpi?: string;
}

/** Per-component breakdown, kept so a number can be argued with. */
export interface RvuBreakdown {
  workRvu: number;
  practiceExpenseRvu: number;
  malpracticeRvu: number;
  totalRvu: number;
  /** Which PE column was used. */
  siteOfService: SiteOfService;
  /** Multiplier applied by modifiers, before geographic adjustment. */
  modifierFactor: number;
  /** Multiplier applied by the multiple-procedure rule. */
  multipleProcedureFactor: number;
  units: number;
}

/** Result of pricing a line — a number, or an explicit refusal. */
export type RvuLineResult =
  | {
      status: "priced";
      code: string;
      breakdown: RvuBreakdown;
      /** Geographically adjusted total, before the conversion factor. */
      adjustedRvu: number;
      /** Medicare allowed amount in dollars. */
      allowedAmount: number;
      localityCode: string;
      notes: readonly string[];
      provenance: PfsProvenance;
    }
  | {
      status: "not-priced";
      code: string;
      reason:
        | "tables-not-loaded"
        | "code-not-in-fee-schedule"
        | "code-not-separately-payable"
        | "locality-not-found"
        | "conversion-factor-not-loaded";
      detail: string;
    };
