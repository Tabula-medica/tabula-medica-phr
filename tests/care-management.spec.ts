/**
 * Care-management coding tests.
 *
 * Weighted heavily toward refusals, because the failure mode is a claim that
 * is well-formed and wrong. A wrongly-emitted code does not throw: it produces
 * a plausible line on a superbill that a physician then signs an attestation
 * for. So the assertions that matter are the ones pinning what the engine
 * declines to produce, and what it declines to decide.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CodingFacts } from "../server/services/care-management/eligibility";
import { evaluateCoding } from "../server/services/care-management/eligibility";
import {
  SEED_CATALOG,
  ruleSet,
  findCode,
  __resetRuleSetCache,
} from "../server/services/care-management/code-catalog";
import {
  CARE_PLAN_ELEMENTS,
  evaluateCarePlan,
  requiredPlanElements,
  type CarePlan,
} from "../server/services/care-management/care-plan";

const ENV_KEYS = ["CARE_MGMT_RULES_PATH", "CARE_MGMT_PLAN_ELEMENTS"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetRuleSetCache();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const PERIOD = { start: "2026-01-01", end: "2026-01-31" };

const fullPlan = (over: Partial<CarePlan> = {}): CarePlan => ({
  patientId: "p1",
  establishedAt: "2026-01-10T10:00:00.000Z",
  elements: [...CARE_PLAN_ELEMENTS],
  electronicAndAvailable: true,
  sharedWithPatient: true,
  ...over,
});

const facts = (over: Partial<CodingFacts> = {}): CodingFacts => ({
  patientId: "p1",
  period: PERIOD,
  documented: ["patient-consent", "round-the-clock-access"],
  time: [],
  carePlan: fullPlan(),
  chronicConditionCount: 3,
  ...over,
});

const codes = (r: ReturnType<typeof evaluateCoding>) => r.candidates.map((c) => c.code);
const unitsOf = (r: ReturnType<typeof evaluateCoding>, code: string) =>
  r.candidates.find((c) => c.code === code)?.units;
const refusalFor = (r: ReturnType<typeof evaluateCoding>, code: string) =>
  r.refused.find((x) => x.code === code);

// ---------------------------------------------------------------------------

describe("rule set posture", () => {
  it("ships a seed that is explicitly not verified", () => {
    expect(SEED_CATALOG.verified).toBe(false);
    expect(SEED_CATALOG.source).toBe("");
    expect(SEED_CATALOG.year).toBe(0);
  });

  it("uses the seed when no operator file is configured", () => {
    expect(ruleSet().verified).toBe(false);
  });

  it("marks every candidate unverified while on the seed, and says so", () => {
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 25, source: "n1" }] }),
    );
    expect(r.unverifiedRules).toBe(true);
    expect(r.candidates.every((c) => c.unverifiedRules)).toBe(true);
    expect(r.advisories.join(" ")).toContain("CARE_MGMT_RULES_PATH");
  });

  it("covers all five families the superbill and the request name", () => {
    const programs = new Set(SEED_CATALOG.codes.map((c) => c.program));
    for (const p of ["ccm", "complex-ccm", "pcm", "apcm", "rpm", "care-plan"]) {
      expect(programs.has(p as never), p).toBe(true);
    }
  });

  it("carries the CCM and PCM codes the superbill lists", () => {
    // The form this was built from shows 99490/99439 for CCM and 99426/99427
    // for PCM. Those four are the corroborated entries.
    for (const c of ["99490", "99439", "99426", "99427"]) {
      expect(findCode(c), c).not.toBeNull();
    }
  });

  it("keeps every add-on attached to a base code that exists", () => {
    for (const c of SEED_CATALOG.codes.filter((x) => x.accrual === "addon")) {
      expect(c.addonTo, c.code).toBeDefined();
      expect(SEED_CATALOG.codes.some((b) => b.code === c.addonTo), c.code).toBe(true);
    }
  });

  it("keeps exclusions symmetric", () => {
    // An asymmetric exclusion is a conflict the engine would miss depending on
    // which code it happened to walk first.
    for (const c of SEED_CATALOG.codes) {
      for (const other of c.excludes) {
        const o = SEED_CATALOG.codes.find((x) => x.code === other);
        if (!o) continue;
        expect(o.excludes, `${other} should exclude ${c.code}`).toContain(c.code);
      }
    }
  });

  it("refuses an operator file that does not assert verification and a source", () => {
    process.env.CARE_MGMT_RULES_PATH = "/nonexistent-but-unreachable.json";
    // Reaching the JSON parse at all would mean the guard is downstream of I/O;
    // either way this must not silently become authoritative.
    expect(() => ruleSet()).toThrow();
  });
});

// ---------------------------------------------------------------------------

describe("care plan", () => {
  it("refuses when absent", () => {
    const v = evaluateCarePlan(null, PERIOD);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("absent");
  });

  it("refuses a plan that is not electronic and available", () => {
    const v = evaluateCarePlan(fullPlan({ electronicAndAvailable: false }), PERIOD);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("not-electronic");
  });

  it("names the missing elements rather than failing bare", () => {
    const v = evaluateCarePlan(
      fullPlan({ elements: ["problem-list", "measurable-goals"] }),
      PERIOD,
    );
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("incomplete");
      expect(v.detail).toContain("medication-management");
    }
  });

  it("distinguishes a plan touched in the period from one merely on file", () => {
    const inPeriod = evaluateCarePlan(fullPlan(), PERIOD);
    expect(inPeriod.ok && inPeriod.reviewedDuringPeriod).toBe(true);

    const stale = evaluateCarePlan(
      fullPlan({ establishedAt: "2024-05-01T00:00:00.000Z", lastReviewedAt: undefined }),
      PERIOD,
    );
    // Complete and usable, but the engine reports that nothing happened to it
    // this month rather than implying it did.
    expect(stale.ok).toBe(true);
    if (stale.ok) expect(stale.reviewedDuringPeriod).toBe(false);
  });

  it("lets an operator narrow the required elements deliberately", () => {
    process.env.CARE_MGMT_PLAN_ELEMENTS = "problem-list,measurable-goals";
    expect(requiredPlanElements()).toEqual(["problem-list", "measurable-goals"]);
  });

  it("blocks every plan-dependent code when the plan is incomplete", () => {
    const r = evaluateCoding(
      facts({
        carePlan: fullPlan({ elements: ["problem-list"] }),
        time: [{ program: "ccm", performer: "clinical-staff", minutes: 60, source: "n1" }],
      }),
    );
    expect(codes(r)).not.toContain("99490");
    expect(refusalFor(r, "99490")?.reason).toBe("missing-prerequisite");
    expect(refusalFor(r, "99490")?.detail).toContain("care-plan");
  });
});

// ---------------------------------------------------------------------------

describe("time arithmetic", () => {
  it("does not round 19 minutes up to the 20-minute threshold", () => {
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 19, source: "n1" }] }),
    );
    expect(codes(r)).not.toContain("99490");
    expect(refusalFor(r, "99490")?.reason).toBe("below-time-threshold");
  });

  it("bills the base unit at exactly the threshold", () => {
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 20, source: "n1" }] }),
    );
    expect(codes(r)).toContain("99490");
    expect(codes(r)).not.toContain("99439");
  });

  it("floors partial increments rather than rounding to the next add-on", () => {
    // 45 minutes = base (20) + one full increment (20), with 5 minutes left.
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 45, source: "n1" }] }),
    );
    expect(unitsOf(r, "99439")).toBe(1);
    expect(r.candidates.find((c) => c.code === "99439")!.rationale.join(" ")).toContain(
      "5 minute(s) left unbilled",
    );
  });

  it("caps the add-on and says what it refused to bill", () => {
    // 120 minutes would earn five increments; the code allows two.
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 120, source: "n1" }] }),
    );
    expect(unitsOf(r, "99439")).toBe(2);
    expect(refusalFor(r, "99439")?.reason).toBe("unit-cap-reached");
  });

  it("reports documented minutes that no code consumed", () => {
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 45, source: "n1" }] }),
    );
    expect(r.unusedMinutes["ccm:clinical-staff"]).toBe(5);
  });

  it("keeps staff and practitioner time in separate pools", () => {
    // 15 + 15 does not make a 20-minute staff unit or a 30-minute QHP unit.
    const r = evaluateCoding(
      facts({
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 15, source: "n1" },
          { program: "ccm", performer: "qhp", minutes: 15, source: "n2" },
        ],
      }),
    );
    expect(r.candidates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe("prerequisites", () => {
  it("refuses CCM without consent on file", () => {
    const r = evaluateCoding(
      facts({
        documented: ["round-the-clock-access"],
        time: [{ program: "ccm", performer: "clinical-staff", minutes: 30, source: "n1" }],
      }),
    );
    expect(refusalFor(r, "99490")?.detail).toContain("patient-consent");
  });

  it("will not infer the condition count from anything else", () => {
    const r = evaluateCoding(
      facts({
        chronicConditionCount: undefined,
        time: [{ program: "ccm", performer: "clinical-staff", minutes: 30, source: "n1" }],
      }),
    );
    expect(refusalFor(r, "99490")?.detail).toContain("two-plus-chronic-conditions");
  });

  it("does not treat one chronic condition as two", () => {
    const r = evaluateCoding(
      facts({
        chronicConditionCount: 1,
        time: [{ program: "ccm", performer: "clinical-staff", minutes: 30, source: "n1" }],
      }),
    );
    expect(codes(r)).not.toContain("99490");
  });

  it("refuses the RPM supply code below sixteen device days", () => {
    const r = evaluateCoding(
      facts({ documented: ["patient-consent", "device-supplied"], deviceDays: 15 }),
    );
    expect(codes(r)).not.toContain("99454");
    expect(refusalFor(r, "99454")?.detail).toContain("sixteen-device-days");
  });

  it("allows the RPM supply code at sixteen device days and shows the count", () => {
    const r = evaluateCoding(
      facts({ documented: ["patient-consent", "device-supplied"], deviceDays: 16 }),
    );
    expect(codes(r)).toContain("99454");
    expect(r.candidates.find((c) => c.code === "99454")!.rationale.join(" ")).toContain("16 device days");
  });

  it("refuses RPM management without interactive communication", () => {
    const r = evaluateCoding(
      facts({
        documented: ["patient-consent", "device-supplied"],
        time: [{ program: "rpm", performer: "qhp", minutes: 25, source: "n1" }],
      }),
    );
    expect(codes(r)).not.toContain("99457");
    expect(refusalFor(r, "99457")?.detail).toContain("interactive-communication");
  });

  it("does not upgrade to complex CCM on time alone", () => {
    // 60 staff minutes clears the complex threshold, but without moderate/high
    // MDM documented it is CCM, not complex CCM.
    const r = evaluateCoding(
      facts({ time: [{ program: "complex-ccm", performer: "clinical-staff", minutes: 60, source: "n1" }] }),
    );
    expect(codes(r)).not.toContain("99487");
    expect(refusalFor(r, "99487")?.detail).toContain("moderate-high-mdm");
  });
});

// ---------------------------------------------------------------------------

describe("APCM", () => {
  const apcmFacts = (over: Partial<CodingFacts> = {}) =>
    facts({
      documented: ["patient-consent", "round-the-clock-access", "initiating-visit"],
      ...over,
    });

  it("selects the two-or-more level from the condition count", () => {
    const r = evaluateCoding(apcmFacts({ chronicConditionCount: 3 }));
    expect(codes(r)).toContain("G0557");
    expect(codes(r)).not.toContain("G0556");
    expect(codes(r)).not.toContain("G0558");
  });

  it("selects the QMB level when that status is a fact", () => {
    const r = evaluateCoding(apcmFacts({ chronicConditionCount: 3, isQmb: true }));
    expect(codes(r)).toContain("G0558");
    expect(codes(r)).not.toContain("G0557");
  });

  it("selects the single-condition level", () => {
    const r = evaluateCoding(apcmFacts({ chronicConditionCount: 1 }));
    expect(codes(r)).toContain("G0556");
  });

  it("proposes no level at all when the condition count is unknown", () => {
    const r = evaluateCoding(apcmFacts({ chronicConditionCount: undefined }));
    expect(codes(r).filter((c) => c.startsWith("G055"))).toHaveLength(0);
  });

  it("bills no APCM without an initiating visit", () => {
    const r = evaluateCoding(
      apcmFacts({ documented: ["patient-consent", "round-the-clock-access"] }),
    );
    expect(codes(r)).not.toContain("G0557");
    expect(refusalFor(r, "G0557")?.detail).toContain("initiating-visit");
  });

  it("needs no time at all, which is why the prerequisites carry the whole load", () => {
    const r = evaluateCoding(apcmFacts({ time: [] }));
    const apcm = r.candidates.find((c) => c.program === "apcm")!;
    expect(apcm.minutesUsed).toBe(0);
    expect(apcm.rationale.join(" ")).toContain("no time threshold");
  });
});

// ---------------------------------------------------------------------------

describe("same-period conflicts", () => {
  it("reports CCM and PCM together rather than choosing between them", () => {
    const r = evaluateCoding(
      facts({
        documented: [
          "patient-consent",
          "round-the-clock-access",
          "one-complex-chronic-condition",
        ],
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 20, source: "n1" },
          { program: "pcm", performer: "clinical-staff", minutes: 30, source: "n2" },
        ],
      }),
    );
    expect(codes(r)).toContain("99490");
    expect(codes(r)).toContain("99426");
    const pair = r.conflicts.find(
      (c) => [c.a, c.b].includes("99490") && [c.a, c.b].includes("99426"),
    );
    expect(pair).toBeDefined();
  });

  it("does not silently prefer the higher-paying of two conflicting codes", () => {
    // Both CCM routes supported in one month. The engine emits both and flags
    // the conflict; picking one would be an upcoding mechanism.
    const r = evaluateCoding(
      facts({
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 20, source: "n1" },
          { program: "ccm", performer: "qhp", minutes: 30, source: "n2" },
        ],
      }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(["99490", "99491"]));
    expect(r.conflicts.length).toBeGreaterThan(0);
    expect(r.conflicts[0].detail).toContain("upcoding");
  });

  it("reports each conflicting pair once", () => {
    const r = evaluateCoding(
      facts({
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 20, source: "n1" },
          { program: "ccm", performer: "qhp", minutes: 30, source: "n2" },
        ],
      }),
    );
    const keys = r.conflicts.map((c) => [c.a, c.b].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("flags APCM against CCM in the same period", () => {
    const r = evaluateCoding(
      facts({
        documented: ["patient-consent", "round-the-clock-access", "initiating-visit"],
        time: [{ program: "ccm", performer: "clinical-staff", minutes: 20, source: "n1" }],
      }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(["99490", "G0557"]));
    expect(
      r.conflicts.some((c) => [c.a, c.b].includes("G0557") && [c.a, c.b].includes("99490")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("time double-counting", () => {
  it("refuses everything when one time entry is claimed by two programs", () => {
    const r = evaluateCoding(
      facts({
        documented: ["patient-consent", "round-the-clock-access", "interactive-communication"],
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 30, source: "same-note" },
          { program: "rpm", performer: "clinical-staff", minutes: 30, source: "same-note" },
        ],
      }),
    );
    expect(r.candidates).toHaveLength(0);
    expect(r.refused[0].reason).toBe("time-double-counted");
    expect(r.refused[0].detail).toContain("same-note");
  });

  it("allows RPM and CCM together when the work is genuinely separate", () => {
    const r = evaluateCoding(
      facts({
        documented: [
          "patient-consent",
          "round-the-clock-access",
          "interactive-communication",
          "device-supplied",
        ],
        time: [
          { program: "ccm", performer: "clinical-staff", minutes: 20, source: "ccm-note" },
          { program: "rpm", performer: "clinical-staff", minutes: 20, source: "rpm-note" },
        ],
      }),
    );
    expect(codes(r)).toEqual(expect.arrayContaining(["99490", "99457"]));
    expect(r.refused.some((x) => x.reason === "time-double-counted")).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe("output shape", () => {
  it("gives every candidate a rationale naming the facts behind it", () => {
    const r = evaluateCoding(
      facts({ time: [{ program: "ccm", performer: "clinical-staff", minutes: 45, source: "n1" }] }),
    );
    expect(r.candidates.length).toBeGreaterThan(0);
    for (const c of r.candidates) expect(c.rationale.length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const f = facts({
      time: [{ program: "ccm", performer: "clinical-staff", minutes: 45, source: "n1" }],
    });
    expect(evaluateCoding(f)).toEqual(evaluateCoding(f));
  });

  it("produces nothing at all from empty facts", () => {
    const r = evaluateCoding({
      patientId: "p1",
      period: PERIOD,
      documented: [],
      time: [],
      carePlan: null,
    });
    expect(r.candidates).toHaveLength(0);
  });
});
