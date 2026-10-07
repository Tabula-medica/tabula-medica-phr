/**
 * Medicare care-gaps connector tests.
 *
 * Weighted toward the boundary conditions the connector exists to get right:
 * the AWV's enrollment-date-gated eligibility (not age-gated), the recurring
 * vaccines this repo's other vaccine engines get wrong (annual flu/COVID,
 * decennial Tdap), and the TCM medication-reconciliation deadline staying
 * distinct from the G8427 attestation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evaluateAwvGap } from "../server/services/medicare-care-gaps/awv-gap-rules";
import { evaluateVaccineGaps } from "../server/services/medicare-care-gaps/vaccine-gap-rules";
import { evaluateMedicationReconciliationGaps } from "../server/services/medicare-care-gaps/medication-reconciliation-gap-rules";
import { evaluateCarePlanGap } from "../server/services/medicare-care-gaps/care-plan-gap-rules";
import { evaluateMedicareGaps, type MedicareGapFacts } from "../server/services/medicare-care-gaps";
import {
  SEED_GCODES,
  findGCode,
  __resetMedicareGcodeCache,
} from "../server/services/medicare-care-gaps/g-code-catalog";

const ENV_KEYS = ["MEDICARE_GAPS_CODE_TABLE_PATH"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetMedicareGcodeCache();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const ASOF = new Date("2026-06-15T00:00:00.000Z");
const monthsAgo = (n: number, from: Date = ASOF): string => {
  const d = new Date(from);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};
const daysAgo = (n: number, from: Date = ASOF): string => {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

describe("G-code catalog posture", () => {
  it("ships a seed that is explicitly not verified", () => {
    expect(SEED_GCODES.verified).toBe(false);
    expect(SEED_GCODES.source).toBe("");
  });

  it("finds known codes and returns null for unknown ones", () => {
    expect(findGCode("G0438")?.category).toBe("awv");
    expect(findGCode("Z9999")).toBeNull();
  });
});

describe("AWV gap detection", () => {
  it("refuses when the patient is not Medicare-enrolled", () => {
    const r = evaluateAwvGap({ medicareEnrolled: false }, ASOF);
    expect(r.candidate).toBeNull();
    expect(r.refused?.reason).toBe("not-medicare-enrolled");
  });

  it("refuses when there is no AWV on file and no Part B effective date", () => {
    const r = evaluateAwvGap({ medicareEnrolled: true }, ASOF);
    expect(r.candidate).toBeNull();
    expect(r.refused?.reason).toBe("missing-enrollment-date");
  });

  it("is not_applicable — not overdue — inside the first 12 months of Part B", () => {
    const r = evaluateAwvGap(
      { medicareEnrolled: true, partBEffectiveDate: monthsAgo(6) },
      ASOF,
    );
    expect(r.candidate?.status).toBe("not_applicable");
    expect(r.candidate?.code).toBe("G0438");
  });

  it("is overdue for G0438 once 12 months of Part B have passed with no prior AWV", () => {
    const r = evaluateAwvGap(
      { medicareEnrolled: true, partBEffectiveDate: monthsAgo(13) },
      ASOF,
    );
    expect(r.candidate?.status).toBe("overdue");
    expect(r.candidate?.code).toBe("G0438");
  });

  it("is up_to_date for G0439 within 12 months of the last AWV", () => {
    const r = evaluateAwvGap(
      { medicareEnrolled: true, lastAwvDate: monthsAgo(3) },
      ASOF,
    );
    expect(r.candidate?.status).toBe("up_to_date");
    expect(r.candidate?.code).toBe("G0439");
  });

  it("is overdue for G0439 more than 12 months after the last AWV", () => {
    const r = evaluateAwvGap(
      { medicareEnrolled: true, lastAwvDate: monthsAgo(14) },
      ASOF,
    );
    expect(r.candidate?.status).toBe("overdue");
  });
});

describe("vaccine gap detection", () => {
  it("flags overdue influenza with no dose on file", () => {
    const gaps = evaluateVaccineGaps({ age: 70, doses: {} }, ASOF);
    const flu = gaps.find((g) => g.label.toLowerCase().includes("influenza"));
    expect(flu?.status).toBe("overdue");
    expect(flu?.code).toBe("G0008");
  });

  it("does not mark a 13-month-old flu shot as up to date (the bug this engine avoids)", () => {
    const gaps = evaluateVaccineGaps(
      { age: 70, doses: { influenza: { lastDoseDate: monthsAgo(13) } } },
      ASOF,
    );
    const flu = gaps.find((g) => g.label.toLowerCase().includes("influenza"));
    expect(flu?.status).toBe("overdue");
  });

  it("marks a recent flu shot up to date", () => {
    const gaps = evaluateVaccineGaps(
      { age: 70, doses: { influenza: { lastDoseDate: monthsAgo(2) } } },
      ASOF,
    );
    const flu = gaps.find((g) => g.label.toLowerCase().includes("influenza"));
    expect(flu?.status).toBe("up_to_date");
  });

  it("gates pneumococcal on age 65+ and has no recurrence once a dose is on file", () => {
    const under65 = evaluateVaccineGaps({ age: 60, doses: {} }, ASOF);
    expect(under65.find((g) => g.code === "G0009")?.status).toBe("not_applicable");

    const withDose = evaluateVaccineGaps(
      { age: 70, doses: { pneumococcal: { lastDoseDate: monthsAgo(60) } } },
      ASOF,
    );
    expect(withDose.find((g) => g.code === "G0009")?.status).toBe("up_to_date");
  });

  it("treats a single zoster dose as a series-incomplete gap, not up to date", () => {
    const gaps = evaluateVaccineGaps(
      { age: 70, doses: { zoster: { doseCount: 1, lastDoseDate: monthsAgo(4) } } },
      ASOF,
    );
    const zoster = gaps.find((g) => g.label.toLowerCase().includes("zoster"));
    expect(zoster?.status).not.toBe("up_to_date");
    expect(zoster?.code).toBeNull(); // no Medicare G-code for zoster admin
  });

  it("marks a two-dose zoster series up to date", () => {
    const gaps = evaluateVaccineGaps(
      { age: 70, doses: { zoster: { doseCount: 2, lastDoseDate: monthsAgo(4) } } },
      ASOF,
    );
    const zoster = gaps.find((g) => g.label.toLowerCase().includes("zoster"));
    expect(zoster?.status).toBe("up_to_date");
  });

  it("treats Tdap as decennial, not lifetime-once", () => {
    const recent = evaluateVaccineGaps(
      { age: 70, doses: { tdap: { lastDoseDate: monthsAgo(24) } } },
      ASOF,
    );
    expect(recent.find((g) => g.label.toLowerCase().includes("tdap"))?.status).toBe("up_to_date");

    const stale = evaluateVaccineGaps(
      { age: 70, doses: { tdap: { lastDoseDate: monthsAgo(132) } } }, // 11 years
      ASOF,
    );
    expect(stale.find((g) => g.label.toLowerCase().includes("tdap"))?.status).toBe("overdue");
  });

  it("never assigns a G-code to zoster, Tdap, or COVID-19", () => {
    const gaps = evaluateVaccineGaps({ age: 70, doses: {} }, ASOF);
    for (const key of ["zoster", "tdap", "covid"]) {
      const gap = gaps.find((g) => g.label.toLowerCase().includes(key));
      expect(gap?.code).toBeNull();
    }
  });
});

describe("medication reconciliation gap detection", () => {
  it("flags G8427 as overdue when no medication list is documented", () => {
    const gaps = evaluateMedicationReconciliationGaps(
      { medicationListDocumented: false },
      ASOF,
    );
    expect(gaps.find((g) => g.code === "G8427")?.status).toBe("overdue");
  });

  it("keeps the TCM 14-day deadline distinct from the G8427 attestation", () => {
    const gaps = evaluateMedicationReconciliationGaps(
      {
        medicationListDocumented: true,
        medicationListDocumentedDate: daysAgo(2),
        hospitalDischargeDate: daysAgo(20),
        // No post-discharge med-rec documented — TCM window (14 days) has closed.
      },
      ASOF,
    );
    expect(gaps.find((g) => g.code === "G8427")?.status).toBe("up_to_date");
    const tcm = gaps.find((g) => g.code === null && g.category === "medication-reconciliation");
    expect(tcm?.status).toBe("overdue");
  });

  it("marks TCM med-rec up to date when documented within 14 days", () => {
    const gaps = evaluateMedicationReconciliationGaps(
      {
        medicationListDocumented: true,
        hospitalDischargeDate: daysAgo(20),
        postDischargeMedRecDate: daysAgo(15),
      },
      ASOF,
    );
    const tcm = gaps.find((g) => g.category === "medication-reconciliation" && g.code === null);
    expect(tcm?.status).toBe("up_to_date");
  });
});

describe("care-plan gap detection", () => {
  it("is not_applicable when condition count is unknown", () => {
    const g = evaluateCarePlanGap({ carePlan: null }, ASOF);
    expect(g.status).toBe("not_applicable");
  });

  it("is overdue when conditions qualify and no plan exists", () => {
    const g = evaluateCarePlanGap({ chronicConditionCount: 2, carePlan: null }, ASOF);
    expect(g.status).toBe("overdue");
    expect(g.code).toBe("G0506");
  });

  it("is up_to_date for a complete, current plan", () => {
    const g = evaluateCarePlanGap(
      {
        chronicConditionCount: 2,
        carePlan: {
          patientId: "p1",
          establishedAt: ASOF.toISOString(),
          elements: [
            "problem-list",
            "expected-outcome",
            "measurable-goals",
            "planned-interventions",
            "medication-management",
            "care-team",
            "community-services",
            "information-sharing",
            "review-schedule",
          ],
          electronicAndAvailable: true,
          sharedWithPatient: true,
        },
      },
      ASOF,
    );
    expect(g.status).toBe("up_to_date");
  });
});

describe("orchestrator", () => {
  const baseFacts: MedicareGapFacts = {
    patientId: "p1",
    asOf: "2026-06-15",
    medicareEnrolled: true,
    awv: { lastAwvDate: monthsAgo(3) },
    vaccine: { age: 70, doses: {} },
    medRec: { medicationListDocumented: true },
    carePlan: { chronicConditionCount: 2, carePlan: null },
  };

  it("evaluates all four categories for an enrolled beneficiary", () => {
    const result = evaluateMedicareGaps(baseFacts);
    const categories = new Set(result.candidates.map((c) => c.category));
    expect(categories.has("awv")).toBe(true);
    expect(categories.has("vaccine")).toBe(true);
    expect(categories.has("medication-reconciliation")).toBe(true);
    expect(categories.has("care-plan")).toBe(true);
  });

  it("marks every candidate unverifiedRules when the seed table is in force", () => {
    const result = evaluateMedicareGaps(baseFacts);
    expect(result.unverifiedRules).toBe(true);
    expect(result.candidates.every((c) => c.unverifiedRules)).toBe(true);
  });

  it("refuses everything except the AWV reason when the patient is not Medicare-enrolled", () => {
    const result = evaluateMedicareGaps({ ...baseFacts, medicareEnrolled: false });
    expect(result.candidates).toHaveLength(0);
    expect(result.refused.every((r) => r.reason === "not-medicare-enrolled")).toBe(true);
  });

  it("summarizes candidates by status", () => {
    const result = evaluateMedicareGaps(baseFacts);
    const total =
      result.summary.overdue +
      result.summary.due_soon +
      result.summary.up_to_date +
      result.summary.not_applicable;
    expect(total).toBe(result.candidates.length);
  });
});
