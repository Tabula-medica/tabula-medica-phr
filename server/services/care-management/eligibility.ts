/**
 * Documented facts in, billable candidates out.
 *
 * Pure and deterministic: no clock, no database, no network. The same facts
 * produce the same candidates, which is what makes the output reviewable and
 * the tests worth anything.
 *
 * ## Three rules that shape everything here
 *
 * **1. Time is never rounded up.** Nineteen minutes of clinical staff time is
 * not twenty. This sounds obvious and is the single most common way a
 * care-management claim becomes false — not by fabrication, but by a coder
 * looking at 19 and thinking "that's basically the threshold". The arithmetic
 * here floors, always, and the leftover minutes are reported so nobody
 * wonders where they went.
 *
 * **2. An undocumented prerequisite refuses the code.** It does not warn, and
 * it does not proceed with a note attached. Consent, a care plan, the
 * condition count, sixteen device days — each is a fact that either is on file
 * or is not, and a system that inferred any of them from context would be
 * manufacturing exactly the document an audit asks to see.
 *
 * **3. The engine never resolves a conflict in favour of revenue.** Where two
 * codes are mutually exclusive and both are supported — CCM by staff time and
 * CCM by practitioner time, in a month that had both — it emits both and marks
 * the conflict. It does not pick the higher-paying one. An automated system
 * that silently chose would be a machine for upcoding, and it would be right
 * often enough that nobody checked.
 *
 * The one place selection *is* automatic is APCM's three levels, because those
 * are determined by facts about the patient rather than by a choice: condition
 * count and beneficiary status decide it, and there is nothing to prefer.
 */

import type {
  CareCode,
  CareProgram,
  CodeCandidate,
  CodeRefused,
  PerformerType,
  Prerequisite,
  ServicePeriod,
  TimeEntry,
} from "@shared/care-management";
import { CARE_MGMT_LIMITS } from "@shared/care-management";
import { ruleSet } from "./code-catalog";
import { evaluateCarePlan, planActivityNote, type CarePlan } from "./care-plan";

export interface CodingFacts {
  patientId: string;
  period: ServicePeriod;
  /** Prerequisites the practice has documented. Anything absent is absent. */
  documented: readonly Prerequisite[];
  /** Minutes worked, attributed to exactly one program each. */
  time: readonly TimeEntry[];
  /** The plan itself, so its completeness is checked rather than asserted. */
  carePlan: CarePlan | null;
  /** Days with device readings in the 30-day supply period. */
  deviceDays?: number;
  /** Chronic conditions meeting the duration and risk tests. */
  chronicConditionCount?: number;
  /** Qualified Medicare Beneficiary, which selects the APCM level. */
  isQmb?: boolean;
}

export interface CodingResult {
  candidates: readonly CodeCandidate[];
  refused: readonly CodeRefused[];
  /**
   * Pairs of proposed codes that may not both be billed. Reported for a human
   * to resolve; never resolved here.
   */
  conflicts: readonly { a: string; b: string; detail: string }[];
  /** Minutes documented but not consumed by any candidate, by program. */
  unusedMinutes: Readonly<Record<string, number>>;
  /** True when the rules came from the development seed. */
  unverifiedRules: boolean;
  /** Notes for the coder that are not refusals. */
  advisories: readonly string[];
}

function minutesFor(
  time: readonly TimeEntry[],
  program: CareProgram,
  performer?: PerformerType,
): number {
  return time
    .filter((t) => t.program === program && (!performer || t.performer === performer))
    .reduce((sum, t) => sum + t.minutes, 0);
}

/**
 * Prerequisites that are answered by a count rather than by a checkbox.
 *
 * Derived here so a practice cannot tick "two or more chronic conditions" on a
 * form while the record shows one. Where the count is simply unknown, the
 * prerequisite stays unmet — unknown is not a synonym for satisfied.
 */
function derivedPrerequisites(facts: CodingFacts): Prerequisite[] {
  const out: Prerequisite[] = [];
  const count = facts.chronicConditionCount;
  if (count !== undefined && count >= 2) out.push("two-plus-chronic-conditions");
  if (
    facts.deviceDays !== undefined &&
    facts.deviceDays >= CARE_MGMT_LIMITS.RPM_MIN_DEVICE_DAYS
  ) {
    out.push("sixteen-device-days");
  }
  return out;
}

function missingPrerequisites(
  code: CareCode,
  available: ReadonlySet<Prerequisite>,
): Prerequisite[] {
  return code.requires.filter((r) => !available.has(r));
}

/**
 * Which APCM level the facts support, if any.
 *
 * The only automatic selection in this module, and it is safe precisely
 * because it is not a preference: the level follows from the condition count
 * and beneficiary status, so there is no higher-paying option to drift toward.
 */
function apcmLevel(facts: CodingFacts): string | null {
  const count = facts.chronicConditionCount;
  if (count === undefined) return null;
  if (count >= 2) return facts.isQmb ? "G0558" : "G0557";
  return "G0556";
}

export function evaluateCoding(facts: CodingFacts): CodingResult {
  const rules = ruleSet();
  const unverifiedRules = !rules.verified;

  const candidates: CodeCandidate[] = [];
  const refused: CodeRefused[] = [];
  const advisories: string[] = [];

  // --- The care plan, once, before any code that depends on it ------------
  const planVerdict = evaluateCarePlan(facts.carePlan, facts.period);
  const available = new Set<Prerequisite>([
    ...facts.documented.filter((p) => p !== "care-plan"),
    ...derivedPrerequisites(facts),
  ]);
  if (planVerdict.ok) {
    available.add("care-plan");
    const note = planActivityNote(planVerdict);
    if (note) advisories.push(note);
  }

  // --- The same minutes may not serve two programs ------------------------
  // Attribution is explicit on each entry, so a double count shows up as one
  // source id appearing under two programs. RPM and CCM are legitimately
  // billable in the same month; the work has to actually be different.
  const sourcesByProgram = new Map<string, Set<CareProgram>>();
  for (const t of facts.time) {
    const set = sourcesByProgram.get(t.source) ?? new Set<CareProgram>();
    set.add(t.program);
    sourcesByProgram.set(t.source, set);
  }
  const doubleCounted = Array.from(sourcesByProgram.entries()).filter(
    ([, programs]) => programs.size > 1,
  );
  for (const [source, programs] of doubleCounted) {
    refused.push({
      code: "*",
      program: Array.from(programs)[0],
      reason: "time-double-counted",
      detail:
        `Time entry "${source}" is attributed to ${Array.from(programs).join(" and ")}. ` +
        "RPM and chronic-care management can both be billed in a month, but the same " +
        "minutes cannot count toward both — the work has to actually be different.",
    });
  }
  if (doubleCounted.length > 0) {
    return {
      candidates: [],
      refused,
      conflicts: [],
      unusedMinutes: {},
      unverifiedRules,
      advisories,
    };
  }

  // --- Walk the base codes ------------------------------------------------
  const consumed = new Map<string, number>();
  const apcmChoice = apcmLevel(facts);

  for (const code of rules.codes) {
    if (code.accrual === "addon") continue;

    // APCM: only the level the facts select is even considered. The other two
    // are not refusals, they are simply not this patient's code.
    if (code.program === "apcm" && code.code !== apcmChoice) continue;

    const missing = missingPrerequisites(code, available);
    if (missing.length > 0) {
      refused.push({
        code: code.code,
        program: code.program,
        reason: "missing-prerequisite",
        detail:
          `Not documented: ${missing.join(", ")}.` +
          (missing.includes("care-plan") && !planVerdict.ok
            ? ` Care plan: ${planVerdict.detail}`
            : ""),
      });
      continue;
    }

    const rationale: string[] = [
      `Prerequisites documented: ${code.requires.join(", ") || "none"}.`,
    ];

    // Bundles and one-time codes have no time floor. For APCM that is the
    // defining feature and also the hazard: with no minutes to clear, the
    // prerequisites above are the only thing standing between this patient and
    // a monthly claim.
    if (code.accrual === "bundle" || code.accrual === "one-time") {
      if (code.code === "99454" && facts.deviceDays !== undefined) {
        rationale.push(
          `${facts.deviceDays} device days in the period, at or above the ` +
            `${CARE_MGMT_LIMITS.RPM_MIN_DEVICE_DAYS}-day minimum.`,
        );
      }
      if (code.accrual === "bundle") {
        rationale.push("Monthly bundle: no time threshold applies.");
      }
      candidates.push({
        code: code.code,
        program: code.program,
        units: 1,
        label: code.label,
        rationale,
        minutesUsed: 0,
        unverifiedRules,
      });
      continue;
    }

    // Time-based base code.
    const pool = minutesFor(facts.time, code.program, code.performer);
    const floor = code.minMinutes ?? 0;
    if (pool < floor) {
      refused.push({
        code: code.code,
        program: code.program,
        reason: "below-time-threshold",
        detail:
          `${pool} minutes documented against a ${floor}-minute threshold. ` +
          "Not rounded up: a threshold that bends is not a threshold, and the gap " +
          "between 19 and 20 minutes is where a well-meant claim becomes a false one.",
      });
      continue;
    }

    rationale.push(`${floor} of ${pool} documented minutes consume the base unit.`);
    candidates.push({
      code: code.code,
      program: code.program,
      units: 1,
      label: code.label,
      rationale,
      minutesUsed: floor,
      unverifiedRules,
    });
    consumed.set(`${code.program}:${code.performer ?? "any"}`, floor);

    // --- Add-ons, floored, capped ----------------------------------------
    const addon = rules.codes.find((c) => c.addonTo === code.code);
    if (!addon) continue;

    const addonMissing = missingPrerequisites(addon, available);
    if (addonMissing.length > 0) {
      refused.push({
        code: addon.code,
        program: addon.program,
        reason: "missing-prerequisite",
        detail: `Not documented: ${addonMissing.join(", ")}.`,
      });
      continue;
    }

    const remaining = pool - floor;
    const step = addon.minMinutes ?? 0;
    if (step <= 0) continue;

    const earned = Math.floor(remaining / step);
    if (earned === 0) {
      if (remaining > 0) {
        refused.push({
          code: addon.code,
          program: addon.program,
          reason: "below-time-threshold",
          detail:
            `${remaining} minutes remain after the base unit, below the ${step}-minute ` +
            "increment. Partial increments are not billable and are not rounded.",
        });
      }
      continue;
    }

    const capped = addon.maxUnits !== undefined ? Math.min(earned, addon.maxUnits) : earned;
    if (capped < earned) {
      refused.push({
        code: addon.code,
        program: addon.program,
        reason: "unit-cap-reached",
        detail:
          `${earned} increments were documented but this code is capped at ` +
          `${addon.maxUnits} per period. Billing the extra ${earned - capped} would be ` +
          "a claim the code does not support, however real the time was.",
      });
    }

    candidates.push({
      code: addon.code,
      program: addon.program,
      units: capped,
      label: addon.label,
      rationale: [
        `${remaining} minutes remained after the base unit.`,
        `${capped} full ${step}-minute increment(s) billed; ` +
          `${remaining - capped * step} minute(s) left unbilled.`,
      ],
      minutesUsed: capped * step,
      unverifiedRules,
    });
    consumed.set(
      `${code.program}:${code.performer ?? "any"}`,
      floor + capped * step,
    );
  }

  // --- Same-period conflicts, reported and not resolved -------------------
  const proposed = new Set(candidates.map((c) => c.code));
  const conflicts: { a: string; b: string; detail: string }[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const rule = rules.codes.find((r) => r.code === c.code);
    if (!rule) continue;
    for (const other of rule.excludes) {
      if (!proposed.has(other)) continue;
      const key = [c.code, other].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        a: c.code,
        b: other,
        detail:
          `${c.code} and ${other} cannot both be billed for this patient in this period. ` +
          "Both are supported by the documented facts, so the choice is a clinical and " +
          "billing judgement rather than an arithmetic one — reported rather than made " +
          "here, because an automated preference between two payable codes is an " +
          "upcoding mechanism whichever way it leans.",
      });
    }
  }

  // --- What was documented and not billed ---------------------------------
  const unusedMinutes: Record<string, number> = {};
  for (const t of facts.time) {
    const key = `${t.program}:${t.performer}`;
    unusedMinutes[key] = (unusedMinutes[key] ?? 0) + t.minutes;
  }
  for (const [key, used] of Array.from(consumed.entries())) {
    if (key in unusedMinutes) unusedMinutes[key] -= used;
  }
  for (const key of Object.keys(unusedMinutes)) {
    if (unusedMinutes[key] <= 0) delete unusedMinutes[key];
  }

  if (unverifiedRules) {
    advisories.push(
      "Rules came from the development seed, not an operator-verified file. Every " +
        "candidate is marked unverifiedRules. Set CARE_MGMT_RULES_PATH to a rule set " +
        "reconciled against the current CPT release and PFS final rule before any of " +
        "this reaches a claim.",
    );
  }

  return { candidates, refused, conflicts, unusedMinutes, unverifiedRules, advisories };
}
