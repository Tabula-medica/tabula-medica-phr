/**
 * The Medicare G-codes this connector maps gaps to.
 *
 * Same posture as `server/services/care-management/code-catalog.ts` and
 * `server/services/risk-adjustment/hcc-tables.ts`, for the same reason: a
 * HCPCS code's descriptor, frequency limit, and NCCI pairing are set by the
 * annual HCPCS release and the Physician Fee Schedule final rule, and a
 * catalog compiled once and shipped does not fail loudly when either moves.
 *
 * `SEED_GCODES` exists to exercise the gap-detection engine in development
 * and tests. It is marked `verified: false`, every candidate built from it
 * carries `unverifiedRules: true`, and that flag is never suppressed. An
 * operator points `MEDICARE_GAPS_CODE_TABLE_PATH` at a file that asserts
 * `verified: true` and names its source before any output here should be read
 * as billable.
 *
 * The codes themselves are long-standing, low-churn HCPCS entries (AWV,
 * vaccine administration, the care-planning add-on, the medication-list
 * attestation) — none of them carry the "most likely to be wrong" warning
 * this codebase attaches to the newer APCM G-codes in code-catalog.ts. That
 * does not exempt them from the same verification discipline; it only means
 * the deployment's job on verifying them is smaller.
 */

import { readFileSync } from "node:fs";
import type { MedicareGCode } from "@shared/medicare-care-gaps";

export interface MedicareGCodeRuleSet {
  /** Payment year these codes were published for. */
  year: number;
  /** False for the seed. An operator file asserts true and names its source. */
  verified: boolean;
  /** Where the operator got this. Empty on the seed. */
  source: string;
  codes: readonly MedicareGCode[];
}

export const SEED_GCODES: MedicareGCodeRuleSet = {
  year: 0,
  verified: false,
  source: "",
  codes: [
    {
      code: "G0438",
      category: "awv",
      label:
        "Annual wellness visit, includes a personalized prevention plan of service (PPPS), initial visit",
      note:
        "Payable once per beneficiary lifetime, no earlier than 12 months after the " +
        "Part B effective date. Mutually exclusive with G0439 in the same period.",
    },
    {
      code: "G0439",
      category: "awv",
      label: "Annual wellness visit, includes a PPPS, subsequent visit",
      note:
        "Payable once every 12 months after the initial AWV (G0438) or a prior G0439. " +
        "Mutually exclusive with G0438 in the same period.",
    },
    {
      code: "G0008",
      category: "vaccine",
      label: "Administration of influenza virus vaccine",
      note:
        "Administration only — the vaccine product itself is billed separately " +
        "(e.g. CPT 90662/90686). Payable once per influenza season.",
    },
    {
      code: "G0009",
      category: "vaccine",
      label: "Administration of pneumococcal vaccine",
      note:
        "Administration only — the vaccine product (PCV20, or PCV15/PPSV23) is billed " +
        "separately. ACIP allows a second, later dose in specific age/risk scenarios this " +
        "engine does not model; an `up_to_date` result here means a dose is on file, not " +
        "that no further dose could ever be indicated.",
    },
    {
      code: "G0010",
      category: "vaccine",
      label: "Administration of hepatitis B vaccine",
      note:
        "Administration only, billed when hepatitis B vaccination is clinically " +
        "indicated (ESRD, other risk factors) — not a routine gap for most adult " +
        "Medicare beneficiaries.",
    },
    {
      code: "G0506",
      category: "care-plan",
      label:
        "Comprehensive assessment and care planning, add-on to the initiating visit",
      note:
        "One-time add-on when a comprehensive care plan is established at a qualifying " +
        "initiating visit for CCM/complex-CCM/PCM/APCM. The monthly program codes it " +
        "initiates are evaluated by server/services/care-management/, not by this " +
        "connector.",
    },
    {
      code: "G8427",
      category: "medication-reconciliation",
      label:
        "Eligible clinician attests to documenting, in the medical record, that the " +
        "patient's current medications were reviewed",
      note:
        "A quality-measure attestation code (Medication Reconciliation Post-Discharge), " +
        "not a separately payable service. It does not satisfy, and is not a substitute " +
        "for, the CPT 99495/99496 Transitional Care Management medication-reconciliation " +
        "requirement, which has its own 14-day-from-discharge deadline.",
    },
  ],
};

let loaded: MedicareGCodeRuleSet | null = null;
let loadedFrom: string | null = null;

/**
 * The G-code table this process will use.
 *
 * Absence of an operator file is a supported state — the engine still runs
 * and still reasons — but everything it produces is marked unverified.
 */
export function gcodeRuleSet(): MedicareGCodeRuleSet {
  const path = process.env.MEDICARE_GAPS_CODE_TABLE_PATH;
  if (!path) return SEED_GCODES;
  if (loaded && loadedFrom === path) return loaded;

  const parsed = JSON.parse(readFileSync(path, "utf8")) as MedicareGCodeRuleSet;
  if (!parsed.verified || !parsed.source) {
    throw new Error(
      `Medicare care-gaps code table at ${path} does not assert verified:true with a ` +
        "source. A file loaded as authoritative has to say who verified it against " +
        "which HCPCS release and which PFS final rule; otherwise it is a seed wearing " +
        "a filename.",
    );
  }
  loaded = parsed;
  loadedFrom = path;
  return parsed;
}

export function findGCode(code: string): MedicareGCode | null {
  return gcodeRuleSet().codes.find((c) => c.code === code) ?? null;
}

/** Test seam. Never called from a request path. */
export function __resetMedicareGcodeCache(): void {
  loaded = null;
  loadedFrom = null;
}
