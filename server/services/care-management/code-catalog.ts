/**
 * The rules: which code, how much time, what has to be on file.
 *
 * ## No rule set is bundled for production use
 *
 * The same posture as `PFS_RVU_TABLES_PATH` and `HCC_V28_TABLES_PATH`, for a
 * sharper reason. CPT descriptors and their time thresholds are revised
 * annually; HCPCS G-codes for care management have been added, redefined and
 * retired inside a single rule cycle; and what may be billed alongside what is
 * set by the Physician Fee Schedule final rule and then modified by MAC-level
 * edits that differ by jurisdiction.
 *
 * A catalog compiled once and shipped does not fail loudly when it goes stale.
 * It produces a claim that is well-formed, plausible, and asserts something
 * about a month that the current rules do not support. That is the shape of a
 * false claim, and it looks exactly like a correct one on the way out.
 *
 * So a deployment loads `CARE_MGMT_RULES_PATH` from its own verified source —
 * the current CPT/HCPCS release plus the PFS final rule for the payment year,
 * reconciled against its MAC's edits.
 *
 * ## What `SEED_CATALOG` is for
 *
 * Exercising the engine in development and in tests, and nothing else. It is
 * marked `verified: false`, every candidate built from it carries
 * `unverifiedRules: true`, and that flag is never suppressed — the engine has
 * no mode in which seed-derived output looks like verified output.
 *
 * The seed's *structure* is the durable part and is worth reading: the
 * base/add-on shape, the time floors, the prerequisite sets and the
 * same-period exclusions are how these programs are built, and they are what
 * the engine reasons over. The specific numbers are what needs checking.
 *
 * > Compiled from secondary familiarity with the code families, corroborated
 * > against a 2024 Optelle Health CCM/PCM superbill for the CCM and PCM
 * > entries. **Not** reconciled against a current CPT release or PFS final
 * > rule. The APCM G-codes in particular are recent and are the entries most
 * > likely to be wrong. Treat every number here as needing verification.
 */

import { readFileSync } from "node:fs";
import type { CareCode } from "@shared/care-management";

export interface RuleSet {
  /** Payment year these rules were published for. */
  year: number;
  /** False for the seed. An operator file asserts true and names its source. */
  verified: boolean;
  /** Where the operator got this. Empty on the seed. */
  source: string;
  codes: readonly CareCode[];
}

/**
 * Development seed. Not a billing rule set.
 *
 * Ordered by family so the shape of each program is readable in one place.
 */
export const SEED_CATALOG: RuleSet = {
  year: 0,
  verified: false,
  source: "",
  codes: [
    // ---- Chronic Care Management -------------------------------------
    // Two ways to reach CCM: clinical staff time under direction, or the
    // practitioner's own time. They are alternatives for the same month, not
    // additive, which is why each excludes the other.
    {
      code: "99490",
      program: "ccm",
      accrual: "base",
      label: "CCM, first 20 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 20,
      maxUnits: 1,
      requires: [
        "patient-consent",
        "care-plan",
        "two-plus-chronic-conditions",
        "round-the-clock-access",
      ],
      excludes: ["99491", "99487", "99424", "99426", "G0556", "G0557", "G0558"],
    },
    {
      code: "99439",
      program: "ccm",
      accrual: "addon",
      label: "CCM, each additional 20 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 20,
      addonTo: "99490",
      maxUnits: 2,
      requires: ["patient-consent", "care-plan", "two-plus-chronic-conditions"],
      excludes: [],
    },
    {
      code: "99491",
      program: "ccm",
      accrual: "base",
      label: "CCM, first 30 minutes of physician or QHP time",
      performer: "qhp",
      minMinutes: 30,
      maxUnits: 1,
      requires: [
        "patient-consent",
        "care-plan",
        "two-plus-chronic-conditions",
        "round-the-clock-access",
      ],
      excludes: ["99490", "99487", "99424", "99426", "G0556", "G0557", "G0558"],
    },
    {
      code: "99437",
      program: "ccm",
      accrual: "addon",
      label: "CCM, each additional 30 minutes of physician or QHP time",
      performer: "qhp",
      minMinutes: 30,
      addonTo: "99491",
      requires: ["patient-consent", "care-plan", "two-plus-chronic-conditions"],
      excludes: [],
    },

    // ---- Complex CCM --------------------------------------------------
    // Distinguished from CCM by decision-making complexity, not only by time.
    // A month with 60 minutes of staff time but straightforward MDM is CCM,
    // not complex CCM, and the engine will not upgrade it on time alone.
    {
      code: "99487",
      program: "complex-ccm",
      accrual: "base",
      label: "Complex CCM, first 60 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 60,
      maxUnits: 1,
      requires: [
        "patient-consent",
        "care-plan",
        "two-plus-chronic-conditions",
        "moderate-high-mdm",
        "round-the-clock-access",
      ],
      excludes: ["99490", "99491", "99424", "99426", "G0556", "G0557", "G0558"],
    },
    {
      code: "99489",
      program: "complex-ccm",
      accrual: "addon",
      label: "Complex CCM, each additional 30 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 30,
      addonTo: "99487",
      requires: ["patient-consent", "care-plan", "two-plus-chronic-conditions", "moderate-high-mdm"],
      excludes: [],
    },

    // ---- Principal Care Management ------------------------------------
    // One condition rather than two or more. The superbill this was built
    // from lists 99426/99427 as "PCM FIRST 30 MINS" / "PCM ADDNTL 30 MIN".
    {
      code: "99424",
      program: "pcm",
      accrual: "base",
      label: "PCM, first 30 minutes of physician or QHP time",
      performer: "qhp",
      minMinutes: 30,
      maxUnits: 1,
      requires: ["patient-consent", "one-complex-chronic-condition", "care-plan"],
      excludes: ["99426", "99490", "99491", "99487", "G0556", "G0557", "G0558"],
    },
    {
      code: "99425",
      program: "pcm",
      accrual: "addon",
      label: "PCM, each additional 30 minutes of physician or QHP time",
      performer: "qhp",
      minMinutes: 30,
      addonTo: "99424",
      requires: ["patient-consent", "one-complex-chronic-condition"],
      excludes: [],
    },
    {
      code: "99426",
      program: "pcm",
      accrual: "base",
      label: "PCM, first 30 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 30,
      maxUnits: 1,
      requires: ["patient-consent", "one-complex-chronic-condition", "care-plan"],
      excludes: ["99424", "99490", "99491", "99487", "G0556", "G0557", "G0558"],
    },
    {
      code: "99427",
      program: "pcm",
      accrual: "addon",
      label: "PCM, each additional 30 minutes of clinical staff time",
      performer: "clinical-staff",
      minMinutes: 30,
      addonTo: "99426",
      requires: ["patient-consent", "one-complex-chronic-condition"],
      excludes: [],
    },

    // ---- Advanced Primary Care Management -----------------------------
    // The one family with no time threshold at all: a monthly bundle
    // stratified by condition count and beneficiary status. Because there is
    // no time floor, the ONLY things standing between a patient and a monthly
    // claim are the prerequisites — which makes enforcing them the whole job.
    //
    // These G-codes are the most recent entries here and the most likely to
    // be wrong. Verify before use.
    {
      code: "G0556",
      program: "apcm",
      accrual: "bundle",
      label: "APCM, patient with one or fewer chronic conditions",
      maxUnits: 1,
      requires: ["patient-consent", "care-plan", "initiating-visit", "round-the-clock-access"],
      excludes: ["99490", "99491", "99487", "99424", "99426", "G0557", "G0558"],
    },
    {
      code: "G0557",
      program: "apcm",
      accrual: "bundle",
      label: "APCM, patient with two or more chronic conditions",
      maxUnits: 1,
      requires: [
        "patient-consent",
        "care-plan",
        "initiating-visit",
        "round-the-clock-access",
        "two-plus-chronic-conditions",
      ],
      excludes: ["99490", "99491", "99487", "99424", "99426", "G0556", "G0558"],
    },
    {
      code: "G0558",
      program: "apcm",
      accrual: "bundle",
      label: "APCM, two or more chronic conditions, qualified Medicare beneficiary",
      maxUnits: 1,
      requires: [
        "patient-consent",
        "care-plan",
        "initiating-visit",
        "round-the-clock-access",
        "two-plus-chronic-conditions",
      ],
      excludes: ["99490", "99491", "99487", "99424", "99426", "G0556", "G0557"],
    },

    // ---- Remote Physiologic Monitoring --------------------------------
    // Billable alongside CCM and PCM — the work is genuinely different — but
    // the same minutes may never be counted toward both. That rule lives in
    // the engine, not here, because it is about time rather than about codes.
    {
      code: "99453",
      program: "rpm",
      accrual: "one-time",
      label: "RPM, setup and patient education on use of equipment",
      maxUnits: 1,
      requires: ["patient-consent", "device-supplied"],
      excludes: [],
    },
    {
      code: "99454",
      program: "rpm",
      accrual: "one-time",
      label: "RPM, device supply with daily recordings, each 30 days",
      maxUnits: 1,
      requires: ["patient-consent", "device-supplied", "sixteen-device-days"],
      excludes: [],
    },
    {
      code: "99457",
      program: "rpm",
      accrual: "base",
      label: "RPM treatment management, first 20 minutes",
      minMinutes: 20,
      maxUnits: 1,
      requires: ["patient-consent", "interactive-communication"],
      excludes: ["99091"],
    },
    {
      code: "99458",
      program: "rpm",
      accrual: "addon",
      label: "RPM treatment management, each additional 20 minutes",
      minMinutes: 20,
      addonTo: "99457",
      requires: ["patient-consent", "interactive-communication"],
      excludes: [],
    },
    {
      code: "99091",
      program: "rpm",
      accrual: "base",
      label: "Collection and interpretation of physiologic data, 30 minutes per 30 days",
      performer: "qhp",
      minMinutes: 30,
      maxUnits: 1,
      requires: ["patient-consent", "device-supplied"],
      excludes: ["99457"],
    },

    // ---- Care planning ------------------------------------------------
    // The add-on for the assessment and care-planning work done at the
    // initiating visit. One-time, and it is the only place in this catalog
    // where the care plan is the billed thing rather than a precondition.
    {
      code: "G0506",
      program: "care-plan",
      accrual: "one-time",
      label: "Comprehensive assessment and care planning, add-on to the initiating visit",
      maxUnits: 1,
      requires: ["patient-consent", "care-plan", "initiating-visit"],
      excludes: [],
    },
  ],
};

let loaded: RuleSet | null = null;
let loadedFrom: string | null = null;

/**
 * The rule set this process will use.
 *
 * Absence of an operator file is a supported state — the engine still runs and
 * still reasons — but everything it produces is marked unverified.
 */
export function ruleSet(): RuleSet {
  const path = process.env.CARE_MGMT_RULES_PATH;
  if (!path) return SEED_CATALOG;
  if (loaded && loadedFrom === path) return loaded;

  const parsed = JSON.parse(readFileSync(path, "utf8")) as RuleSet;
  if (!parsed.verified || !parsed.source) {
    throw new Error(
      `Care-management rule set at ${path} does not assert verified:true with a source. ` +
        "A file loaded as authoritative has to say who verified it against which CPT " +
        "release and which PFS final rule; otherwise it is a seed wearing a filename.",
    );
  }
  loaded = parsed;
  loadedFrom = path;
  return parsed;
}

export function findCode(code: string): CareCode | null {
  return ruleSet().codes.find((c) => c.code === code) ?? null;
}

/** Test seam. Never called from a request path. */
export function __resetRuleSetCache(): void {
  loaded = null;
  loadedFrom = null;
}
