import { afterEach, describe, expect, it } from "vitest";
import {
  clearHccTables,
  hccForIcd10,
  hccTablesLoaded,
  loadHccTables,
  normalizeIcd10,
  validateHccTables,
  type RawHccTables,
} from "../server/services/risk-adjustment/hcc-tables";
import {
  applyHierarchy,
  calculateRaf,
  countableHccs,
  demographicFactorName,
} from "../server/services/risk-adjustment/raf-calculator";
import {
  assessMeat,
  findRecaptureGaps,
  isChronicOrPermanent,
} from "../server/services/risk-adjustment/documentation-gaps";
import { findSuspects } from "../server/services/risk-adjustment/suspect-rules";
import type { HccCondition } from "../shared/hcc-v28";

/**
 * Fixture tables.
 *
 * These are SYNTHETIC. The HCC numbers, labels and coefficients below are chosen
 * to exercise the engine, not to represent the real CMS-HCC V28 model. Real
 * scoring requires the official CMS release; see hcc-tables.ts.
 */
function fixtureTables(overrides: Partial<RawHccTables> = {}): RawHccTables {
  const base: RawHccTables = {
    crosswalk: {
      source: "fixture",
      paymentYear: 2026,
      rows: [
        { icd10: "E1122", hcc: 37 },
        { icd10: "E119", hcc: 38 },
        { icd10: "N1832", hcc: 327 },
        { icd10: "I5022", hcc: 226 },
      ],
    },
    categories: {
      source: "fixture",
      paymentYear: 2026,
      rows: [
        { hcc: 37, label: "Fixture diabetes, severe", family: "diabetes" },
        { hcc: 38, label: "Fixture diabetes, mild", family: "diabetes" },
        { hcc: 327, label: "Fixture CKD", family: "renal" },
        { hcc: 226, label: "Fixture heart failure", family: "cardiac" },
      ],
    },
    hierarchy: {
      source: "fixture",
      paymentYear: 2026,
      rows: [{ hcc: 37, suppresses: [38] }],
    },
    coefficients: {
      source: "fixture",
      paymentYear: 2026,
      rows: [
        { segment: "community-nondual-aged", factor: "F70_74", value: 0.4 },
        { segment: "community-nondual-aged", factor: "M70_74", value: 0.35 },
        { segment: "community-nondual-aged", factor: "HCC_37", value: 0.3 },
        { segment: "community-nondual-aged", factor: "HCC_38", value: 0.1 },
        { segment: "community-nondual-aged", factor: "HCC_327", value: 0.2 },
        { segment: "community-nondual-aged", factor: "HCC_226", value: 0.25 },
        { segment: "institutional", factor: "F70_74", value: 0.9 },
        { segment: "institutional", factor: "HCC_37", value: 0.5 },
      ],
    },
  };
  return { ...base, ...overrides };
}

afterEach(() => clearHccTables());

describe("ICD-10 normalization", () => {
  it("strips dots and upper-cases, matching how CMS ships codes", () => {
    expect(normalizeIcd10("e11.22")).toBe("E1122");
    expect(normalizeIcd10("N18.32")).toBe("N1832");
  });
});

describe("table validation", () => {
  it("accepts a well-formed table set", () => {
    expect(validateHccTables(fixtureTables())).toEqual([]);
  });

  it("rejects tables that span multiple payment years", () => {
    const tables = fixtureTables();
    const mixed = {
      ...tables,
      coefficients: { ...tables.coefficients, paymentYear: 2025 },
    };
    const problems = validateHccTables(mixed);
    expect(problems.some((p) => p.includes("multiple payment years"))).toBe(true);
  });

  it("rejects a crosswalk pointing at an unknown HCC", () => {
    const tables = fixtureTables();
    const broken = {
      ...tables,
      crosswalk: {
        ...tables.crosswalk,
        rows: [...tables.crosswalk.rows, { icd10: "Z999", hcc: 9999 }],
      },
    };
    expect(validateHccTables(broken).some((p) => p.includes("9999"))).toBe(true);
  });

  it("rejects a code mapped to two HCCs", () => {
    const tables = fixtureTables();
    const dup = {
      ...tables,
      crosswalk: {
        ...tables.crosswalk,
        rows: [...tables.crosswalk.rows, { icd10: "E11.22", hcc: 38 }],
      },
    };
    expect(validateHccTables(dup).some((p) => p.includes("more than once"))).toBe(true);
  });

  it("rejects an HCC that suppresses itself", () => {
    const tables = fixtureTables();
    const selfSuppress = {
      ...tables,
      hierarchy: { ...tables.hierarchy, rows: [{ hcc: 37, suppresses: [37] }] },
    };
    expect(validateHccTables(selfSuppress).some((p) => p.includes("suppresses itself"))).toBe(true);
  });

  it("refuses to load an invalid table set", () => {
    const tables = fixtureTables();
    expect(() =>
      loadHccTables({ ...tables, categories: { ...tables.categories, rows: [] } }),
    ).toThrow(/failed validation/);
  });
});

describe("crosswalk lookup", () => {
  it("returns null for every code when no tables are loaded", () => {
    expect(hccTablesLoaded()).toBe(false);
    expect(hccForIcd10("E11.22")).toBeNull();
  });

  it("maps codes once tables are loaded, dotted or not", () => {
    loadHccTables(fixtureTables());
    expect(hccForIcd10("E11.22")).toBe(37);
    expect(hccForIcd10("e1122")).toBe(37);
  });

  it("never guesses at an unmapped code", () => {
    loadHccTables(fixtureTables());
    // E11.21 is adjacent to a mapped code and must still return null.
    expect(hccForIcd10("E11.21")).toBeNull();
  });
});

describe("hierarchy", () => {
  it("suppresses the milder HCC when the severe one is present", () => {
    loadHccTables(fixtureTables());
    const outcome = applyHierarchy([37, 38]);
    expect(outcome.payable).toEqual([37]);
    expect(outcome.suppressed).toEqual([{ hcc: 38, suppressedBy: 37 }]);
  });

  it("leaves unrelated HCCs alone", () => {
    loadHccTables(fixtureTables());
    expect(applyHierarchy([38, 327]).payable).toEqual([38, 327]);
  });

  it("is order-independent", () => {
    loadHccTables(fixtureTables());
    expect(applyHierarchy([38, 37]).payable).toEqual(applyHierarchy([37, 38]).payable);
  });

  it("claims no suppression when no tables are loaded", () => {
    expect(applyHierarchy([37, 38]).suppressed).toEqual([]);
  });
});

describe("countable conditions", () => {
  it("counts coded encounters and excludes unattested suspects", () => {
    loadHccTables(fixtureTables());
    const conditions: HccCondition[] = [
      { icd10: "E11.22", hcc: 37, origin: "coded-encounter" },
      { icd10: "N18.32", hcc: 327, origin: "suspected" },
      { icd10: "I50.22", hcc: 226, origin: "problem-list" },
    ];
    expect(countableHccs(conditions)).toEqual([37]);
  });

  it("counts a suspect once a clinician attests to it", () => {
    loadHccTables(fixtureTables());
    const conditions: HccCondition[] = [
      { icd10: "N18.32", hcc: 327, origin: "suspected", clinicianAttested: true },
    ];
    expect(countableHccs(conditions)).toEqual([327]);
  });
});

describe("demographic factor naming", () => {
  it("bands ages the way CMS publishes them", () => {
    expect(demographicFactorName(72, "female")).toBe("F70_74");
    expect(demographicFactorName(35, "male")).toBe("M35_39");
    expect(demographicFactorName(30, "female")).toBe("F0_34");
    expect(demographicFactorName(97, "male")).toBe("M95_GT");
  });
});

describe("RAF calculation", () => {
  const demographics = {
    segment: "community-nondual-aged" as const,
    age: 72,
    sex: "female" as const,
  };

  it("refuses to score when no tables are loaded", () => {
    const result = calculateRaf([], demographics);
    expect(result.status).toBe("not-scored");
    if (result.status === "not-scored") {
      expect(result.reason).toBe("coefficients-not-loaded");
    }
  });

  it("sums demographic and HCC coefficients after the hierarchy", () => {
    loadHccTables(fixtureTables());
    const result = calculateRaf(
      [
        { icd10: "E11.22", hcc: 37, origin: "coded-encounter" },
        { icd10: "E11.9", hcc: 38, origin: "coded-encounter" },
      ],
      demographics,
    );
    expect(result.status).toBe("scored");
    if (result.status === "scored") {
      // 0.4 demographic + 0.3 for HCC 37. HCC 38 is trumped and contributes nothing.
      expect(result.raf).toBe(0.7);
      expect(result.contributions.map((c) => c.factor)).toEqual(["F70_74", "HCC_37"]);
    }
  });

  it("scores the same patient differently in a different segment", () => {
    loadHccTables(fixtureTables());
    const community = calculateRaf(
      [{ icd10: "E11.22", hcc: 37, origin: "coded-encounter" }],
      demographics,
    );
    const institutional = calculateRaf(
      [{ icd10: "E11.22", hcc: 37, origin: "coded-encounter" }],
      { ...demographics, segment: "institutional" },
    );
    expect(community.status).toBe("scored");
    expect(institutional.status).toBe("scored");
    if (community.status === "scored" && institutional.status === "scored") {
      expect(institutional.raf).not.toBe(community.raf);
      expect(institutional.raf).toBe(1.4);
    }
  });

  it("withholds the score rather than treating a missing coefficient as zero", () => {
    loadHccTables(fixtureTables());
    // HCC 327 has no coefficient in the institutional segment of the fixture.
    const result = calculateRaf(
      [{ icd10: "N18.32", hcc: 327, origin: "coded-encounter" }],
      { ...demographics, segment: "institutional" },
    );
    expect(result.status).toBe("not-scored");
    if (result.status === "not-scored") {
      expect(result.detail).toContain("HCC_327");
      expect(result.detail).toContain("withheld");
    }
  });

  it("excludes unattested suspects from the arithmetic", () => {
    loadHccTables(fixtureTables());
    const withSuspect = calculateRaf(
      [
        { icd10: "E11.22", hcc: 37, origin: "coded-encounter" },
        { icd10: "N18.32", hcc: 327, origin: "suspected" },
      ],
      demographics,
    );
    const withoutSuspect = calculateRaf(
      [{ icd10: "E11.22", hcc: 37, origin: "coded-encounter" }],
      demographics,
    );
    expect(withSuspect.status).toBe("scored");
    if (withSuspect.status === "scored" && withoutSuspect.status === "scored") {
      expect(withSuspect.raf).toBe(withoutSuspect.raf);
    }
  });

  it("records provenance so a score can be traced to its table", () => {
    loadHccTables(fixtureTables());
    const result = calculateRaf(
      [{ icd10: "E11.22", hcc: 37, origin: "coded-encounter" }],
      demographics,
    );
    if (result.status === "scored") {
      expect(result.provenance.source).toBe("fixture");
      expect(result.provenance.paymentYear).toBe(2026);
      expect(result.provenance.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("chronicity", () => {
  it("recognises chronic and permanent families", () => {
    expect(isChronicOrPermanent("N18.32")).toBe(true);
    expect(isChronicOrPermanent("Z89.411")).toBe(true);
    expect(isChronicOrPermanent("J44.9")).toBe(true);
  });

  it("does not treat acute events as chronic", () => {
    expect(isChronicOrPermanent("I21.4")).toBe(false); // acute MI
    expect(isChronicOrPermanent("J18.9")).toBe(false); // pneumonia
    expect(isChronicOrPermanent("S72.001A")).toBe(false); // femur fracture
  });
});

describe("annual recapture", () => {
  it("flags a chronic condition not re-documented this year", () => {
    const gaps = findRecaptureGaps({
      priorYear: [{ icd10: "N18.32", name: "CKD stage 3b", year: 2025 }],
      codedThisYear: ["I10"],
      currentYear: 2026,
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].icd10).toBe("N18.32");
    expect(gaps[0].lastCodedYear).toBe(2025);
  });

  it("does not flag a condition re-documented at a different stage", () => {
    const gaps = findRecaptureGaps({
      priorYear: [{ icd10: "N18.32", year: 2025 }],
      codedThisYear: ["N18.4"],
      currentYear: 2026,
    });
    expect(gaps).toHaveLength(0);
  });

  it("does not propose recapturing a resolved acute event", () => {
    const gaps = findRecaptureGaps({
      priorYear: [{ icd10: "I21.4", name: "NSTEMI", year: 2025 }],
      codedThisYear: [],
      currentYear: 2026,
    });
    expect(gaps).toHaveLength(0);
  });

  it("reports the most recent capture year when a code repeats", () => {
    const gaps = findRecaptureGaps({
      priorYear: [
        { icd10: "J44.9", year: 2023 },
        { icd10: "J44.9", year: 2025 },
      ],
      codedThisYear: [],
      currentYear: 2026,
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].lastCodedYear).toBe(2025);
  });

  it("ignores prior entries from the current year or later", () => {
    const gaps = findRecaptureGaps({
      priorYear: [{ icd10: "N18.32", year: 2026 }],
      codedThisYear: [],
      currentYear: 2026,
    });
    expect(gaps).toHaveLength(0);
  });
});

describe("MEAT assessment", () => {
  it("finds treatment and monitoring language", () => {
    const result = assessMeat(
      "A/P: CKD stage 3b, stable. Continue lisinopril. Reviewed labs today.",
      "CKD stage 3b",
    );
    expect(result.adequate).toBe(true);
    expect(result.present).toContain("treat");
    expect(result.present).toContain("monitor");
  });

  it("reports inadequacy when the note only lists the problem", () => {
    const result = assessMeat("Problem list: CKD stage 3b, hypertension.", "CKD stage 3b");
    expect(result.adequate).toBe(false);
    expect(result.missing).toHaveLength(4);
    expect(result.guidance).toContain("does not support coding it");
  });

  it("names the phrase that satisfied each element, for review", () => {
    const result = assessMeat("Assessment: diabetes, well controlled.", "diabetes");
    expect(result.matches.some((m) => m.element === "assess")).toBe(true);
    expect(result.matches.every((m) => m.phrase.length > 0)).toBe(true);
  });
});

describe("suspect rules", () => {
  it("flags CKD on two low eGFRs 90 days apart", () => {
    const hits = findSuspects({
      labs: [
        { code: "48642-3", name: "eGFR", value: 44, observedAt: "2026-01-10" },
        { code: "48642-3", name: "eGFR", value: 41, observedAt: "2026-06-20" },
      ],
    });
    expect(hits.some((h) => h.rule.id === "ckd-stage-from-egfr")).toBe(true);
  });

  it("does not flag CKD on a single low eGFR", () => {
    const hits = findSuspects({
      labs: [{ code: "48642-3", name: "eGFR", value: 44, observedAt: "2026-01-10" }],
    });
    expect(hits.some((h) => h.rule.id === "ckd-stage-from-egfr")).toBe(false);
  });

  it("does not flag CKD on two low eGFRs less than 90 days apart", () => {
    const hits = findSuspects({
      labs: [
        { code: "48642-3", name: "eGFR", value: 44, observedAt: "2026-01-10" },
        { code: "48642-3", name: "eGFR", value: 41, observedAt: "2026-02-10" },
      ],
    });
    expect(hits.some((h) => h.rule.id === "ckd-stage-from-egfr")).toBe(false);
  });

  it("stays quiet when the condition is already coded this year", () => {
    const hits = findSuspects({
      labs: [
        { code: "48642-3", name: "eGFR", value: 44, observedAt: "2026-01-10" },
        { code: "48642-3", name: "eGFR", value: 41, observedAt: "2026-06-20" },
      ],
      codedThisYear: ["N18.32"],
    });
    expect(hits.some((h) => h.rule.id === "ckd-stage-from-egfr")).toBe(false);
  });

  it("flags chronic respiratory failure for a patient on home oxygen", () => {
    const hits = findSuspects({ services: ["home-oxygen"] });
    expect(hits.some((h) => h.rule.id === "chronic-respiratory-failure-home-o2")).toBe(true);
  });

  it("flags morbid obesity from BMI but not from an ordinary BMI", () => {
    expect(
      findSuspects({ vitals: [{ type: "bmi", value: 43.1, observedAt: "2026-05-01" }] }).some(
        (h) => h.rule.id === "morbid-obesity-from-bmi",
      ),
    ).toBe(true);
    expect(
      findSuspects({ vitals: [{ type: "bmi", value: 31, observedAt: "2026-05-01" }] }).some(
        (h) => h.rule.id === "morbid-obesity-from-bmi",
      ),
    ).toBe(false);
  });

  it("requires a complication before suggesting diabetes-with-complications", () => {
    const withoutComplication = findSuspects({
      labs: [{ code: "4548-4", name: "Hemoglobin A1c", value: 8.2 }],
      medications: [{ name: "Metformin 1000mg", active: true }],
    });
    expect(
      withoutComplication.some((h) => h.rule.id === "diabetes-with-chronic-complications"),
    ).toBe(false);

    const withComplication = findSuspects({
      labs: [{ code: "4548-4", name: "Hemoglobin A1c", value: 8.2 }],
      medications: [{ name: "Metformin 1000mg", active: true }],
      problemList: [{ name: "Diabetic peripheral neuropathy" }],
    });
    expect(
      withComplication.some((h) => h.rule.id === "diabetes-with-chronic-complications"),
    ).toBe(true);
  });

  it("ignores discontinued medications", () => {
    const hits = findSuspects({
      labs: [{ code: "phq9", name: "PHQ-9", value: 18 }],
      medications: [{ name: "Sertraline 100mg", active: false }],
    });
    expect(hits.some((h) => h.rule.id === "major-depression-from-phq9")).toBe(false);
  });

  it("returns nothing for a patient with no supporting evidence", () => {
    expect(findSuspects({})).toEqual([]);
    expect(findSuspects({ labs: [], medications: [], vitals: [] })).toEqual([]);
  });

  it("attaches the evidence that triggered each hit", () => {
    const hits = findSuspects({ services: ["home-oxygen"] });
    const hit = hits.find((h) => h.rule.id === "chronic-respiratory-failure-home-o2");
    expect(hit?.evidence.length).toBeGreaterThan(0);
    expect(hit?.rule.requiresConfirmation).toBeTruthy();
  });
});
