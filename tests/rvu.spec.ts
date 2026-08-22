import { afterEach, describe, expect, it } from "vitest";
import {
  clearPfsTables,
  findRvuRow,
  loadPfsTables,
  normalizeCode,
  pfsTablesLoaded,
  rvuKey,
  validatePfsTables,
  type RawPfsTables,
} from "../server/services/rvu/pfs-tables";
import {
  multipleProcedureFactors,
  priceLine,
  priceSession,
} from "../server/services/rvu/rvu-calculator";
import {
  buildProductivityReport,
  compareAttributionBases,
  type EncounterSession,
} from "../server/services/rvu/provider-productivity";
import type { ServiceLine } from "../shared/rvu";

/**
 * Fixture tables.
 *
 * SYNTHETIC. The RVU values, GPCIs and conversion factor below exercise the
 * engine; they are not the real CMS Physician Fee Schedule. Real pricing needs
 * the official CMS release — see pfs-tables.ts.
 */
function fixtureTables(overrides: Partial<RawPfsTables> = {}): RawPfsTables {
  const base: RawPfsTables = {
    rvu: {
      source: "fixture-RVU26A",
      year: 2026,
      quarter: "A",
      rows: [
        // Office visit: PE differs sharply by site, no multiple-procedure reduction.
        {
          code: "99214",
          workRvu: 1.92,
          facilityPeRvu: 0.8,
          nonFacilityPeRvu: 1.6,
          malpracticeRvu: 0.14,
          status: "A",
          multipleProcedureIndicator: "0",
          globalPeriod: "XXX",
        },
        // Major surgery: participates in MPPR, bilateral rule applies, assistant payable.
        {
          code: "27447",
          workRvu: 20.0,
          facilityPeRvu: 15.0,
          nonFacilityPeRvu: 15.0,
          malpracticeRvu: 4.0,
          status: "A",
          multipleProcedureIndicator: "2",
          bilateralIndicator: "1",
          assistantSurgeryIndicator: "2",
          globalPeriod: "090",
        },
        // Lesser surgery: also MPPR-eligible, lower value.
        {
          code: "29881",
          workRvu: 9.0,
          facilityPeRvu: 6.0,
          nonFacilityPeRvu: 6.0,
          malpracticeRvu: 1.5,
          status: "A",
          multipleProcedureIndicator: "2",
          bilateralIndicator: "1",
          assistantSurgeryIndicator: "2",
          globalPeriod: "090",
        },
        // Code that never pays an assistant.
        {
          code: "12345",
          workRvu: 3.0,
          facilityPeRvu: 2.0,
          nonFacilityPeRvu: 2.0,
          malpracticeRvu: 0.3,
          status: "A",
          multipleProcedureIndicator: "0",
          bilateralIndicator: "0",
          assistantSurgeryIndicator: "1",
        },
        // Bundled — not separately payable.
        {
          code: "99000",
          workRvu: 0,
          facilityPeRvu: 0,
          nonFacilityPeRvu: 0,
          malpracticeRvu: 0,
          status: "B",
        },
        // Imaging split into professional and technical components.
        {
          code: "71046",
          workRvu: 0.22,
          facilityPeRvu: 0.08,
          nonFacilityPeRvu: 0.75,
          malpracticeRvu: 0.02,
          status: "A",
          multipleProcedureIndicator: "0",
        },
        {
          code: "71046",
          modifier: "26",
          workRvu: 0.22,
          facilityPeRvu: 0.07,
          nonFacilityPeRvu: 0.07,
          malpracticeRvu: 0.01,
          status: "A",
          multipleProcedureIndicator: "0",
        },
      ],
    },
    gpci: {
      source: "fixture-GPCI26",
      year: 2026,
      rows: [
        { localityCode: "01", localityName: "Fixture Metro", workGpci: 1.0, peGpci: 1.0, malpracticeGpci: 1.0 },
        { localityCode: "26", localityName: "Fixture High Cost", workGpci: 1.1, peGpci: 1.3, malpracticeGpci: 0.6 },
      ],
    },
    conversionFactor: { source: "fixture-CF26", year: 2026, value: 33.0 },
  };
  return { ...base, ...overrides };
}

const CTX = { localityCode: "01" };

afterEach(() => clearPfsTables());

describe("code normalization", () => {
  it("upper-cases and strips punctuation", () => {
    expect(normalizeCode("99214")).toBe("99214");
    expect(normalizeCode("g0439")).toBe("G0439");
  });

  it("keys modifier-specific rows separately", () => {
    expect(rvuKey("71046", "26")).toBe("71046|26");
    expect(rvuKey("71046")).toBe("71046");
  });
});

describe("table validation", () => {
  it("accepts a well-formed table set", () => {
    expect(validatePfsTables(fixtureTables())).toEqual([]);
  });

  it("rejects tables from mismatched years", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      conversionFactor: { ...t.conversionFactor, year: 2025 },
    });
    expect(problems.some((p) => p.includes("multiple years"))).toBe(true);
  });

  it("rejects a non-positive conversion factor", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      conversionFactor: { ...t.conversionFactor, value: 0 },
    });
    expect(problems.some((p) => p.includes("conversion factor"))).toBe(true);
  });

  it("catches an implausible GPCI, which is nearly always a column offset", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      gpci: {
        ...t.gpci,
        rows: [{ localityCode: "99", workGpci: 100, peGpci: 1, malpracticeGpci: 1 }],
      },
    });
    expect(problems.some((p) => p.includes("implausible"))).toBe(true);
  });

  it("accepts GPCIs at the band's boundaries, which are real localities", () => {
    // Puerto Rico's malpractice GPCI sits at the bottom of the published range
    // and South Florida's near the top. An exclusive band would refuse a
    // legitimate CMS file for having a value exactly on the edge.
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      gpci: {
        ...t.gpci,
        rows: [
          { localityCode: "low", workGpci: 0.3, peGpci: 0.3, malpracticeGpci: 0.3 },
          { localityCode: "high", workGpci: 3.0, peGpci: 3.0, malpracticeGpci: 3.0 },
        ],
      },
    });
    expect(problems.filter((p) => p.includes("implausible"))).toEqual([]);
  });

  it("still rejects a GPCI just outside the band", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      gpci: {
        ...t.gpci,
        rows: [{ localityCode: "99", workGpci: 0.29, peGpci: 1, malpracticeGpci: 3.01 }],
      },
    });
    expect(problems.filter((p) => p.includes("implausible"))).toHaveLength(2);
  });

  it("rejects a duplicate code+modifier row", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      rvu: { ...t.rvu, rows: [...t.rvu.rows, t.rvu.rows[0]] },
    });
    expect(problems.some((p) => p.includes("more than once"))).toBe(true);
  });

  it("rejects an unrecognised status indicator", () => {
    const t = fixtureTables();
    const problems = validatePfsTables({
      ...t,
      rvu: {
        ...t.rvu,
        rows: [
          {
            code: "99999",
            workRvu: 1,
            facilityPeRvu: 1,
            nonFacilityPeRvu: 1,
            malpracticeRvu: 1,
            status: "Z" as never,
          },
        ],
      },
    });
    expect(problems.some((p) => p.includes("status indicator"))).toBe(true);
  });

  it("refuses to load an invalid set", () => {
    const t = fixtureTables();
    expect(() => loadPfsTables({ ...t, gpci: { ...t.gpci, rows: [] } })).toThrow(
      /failed validation/,
    );
  });
});

describe("row lookup", () => {
  it("prefers a modifier-specific row over the global row", () => {
    loadPfsTables(fixtureTables());
    const professional = findRvuRow("71046", ["26"]);
    const global = findRvuRow("71046");
    expect(professional?.modifier).toBe("26");
    expect(global?.modifier).toBeUndefined();
    // The professional component carries far less practice expense.
    expect(professional!.nonFacilityPeRvu).toBeLessThan(global!.nonFacilityPeRvu);
  });

  it("returns null when no tables are loaded", () => {
    expect(pfsTablesLoaded()).toBe(false);
    expect(findRvuRow("99214")).toBeNull();
  });
});

describe("pricing a single line", () => {
  const visit: ServiceLine = { code: "99214", siteOfService: "non-facility" };

  it("refuses to price with no tables loaded", () => {
    const result = priceLine(visit, CTX);
    expect(result.status).toBe("not-priced");
    if (result.status === "not-priced") expect(result.reason).toBe("tables-not-loaded");
  });

  it("sums the three components and applies the conversion factor", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine(visit, CTX);
    expect(result.status).toBe("priced");
    if (result.status === "priced") {
      // 1.92 + 1.60 + 0.14 = 3.66 total RVU; GPCIs are 1.0 in locality 01.
      expect(result.breakdown.totalRvu).toBeCloseTo(3.66, 4);
      expect(result.allowedAmount).toBeCloseTo(3.66 * 33.0, 2);
    }
  });

  it("uses the facility PE column in a facility, and says which it used", () => {
    loadPfsTables(fixtureTables());
    const facility = priceLine({ ...visit, siteOfService: "facility" }, CTX);
    const office = priceLine(visit, CTX);
    if (facility.status === "priced" && office.status === "priced") {
      expect(facility.breakdown.practiceExpenseRvu).toBeCloseTo(0.8, 4);
      expect(office.breakdown.practiceExpenseRvu).toBeCloseTo(1.6, 4);
      expect(facility.allowedAmount).toBeLessThan(office.allowedAmount);
      expect(facility.notes.some((n) => n.includes("facility column"))).toBe(true);
    }
  });

  it("applies each GPCI to its own component, not to the sum", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine(visit, { localityCode: "26" });
    if (result.status === "priced") {
      // 1.92*1.1 + 1.60*1.3 + 0.14*0.6 = 2.112 + 2.08 + 0.084 = 4.276
      expect(result.adjustedRvu).toBeCloseTo(4.276, 3);
      // An averaged-GPCI shortcut would give 3.66 * 1.0 = 3.66. It must not.
      expect(result.adjustedRvu).not.toBeCloseTo(3.66, 2);
    }
  });

  it("withholds pricing for an unknown locality rather than defaulting to 1.0", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine(visit, { localityCode: "ZZ" });
    expect(result.status).toBe("not-priced");
    if (result.status === "not-priced") {
      expect(result.reason).toBe("locality-not-found");
      expect(result.detail).toContain("1.0");
    }
  });

  it("refuses a bundled code", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ code: "99000", siteOfService: "non-facility" }, CTX);
    expect(result.status).toBe("not-priced");
    if (result.status === "not-priced") {
      expect(result.reason).toBe("code-not-separately-payable");
    }
  });

  it("refuses a code absent from the fee schedule", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ code: "00000", siteOfService: "non-facility" }, CTX);
    expect(result.status).toBe("not-priced");
    if (result.status === "not-priced") expect(result.reason).toBe("code-not-in-fee-schedule");
  });

  it("multiplies by units", () => {
    loadPfsTables(fixtureTables());
    const one = priceLine(visit, CTX);
    const three = priceLine({ ...visit, units: 3 }, CTX);
    if (one.status === "priced" && three.status === "priced") {
      expect(three.breakdown.workRvu).toBeCloseTo(one.breakdown.workRvu * 3, 4);
    }
  });
});

describe("modifiers", () => {
  const knee: ServiceLine = { code: "27447", siteOfService: "facility" };

  it("applies the 150% bilateral rule when the indicator permits", () => {
    loadPfsTables(fixtureTables());
    const bilateral = priceLine({ ...knee, modifiers: ["50"] }, CTX);
    const unilateral = priceLine(knee, CTX);
    if (bilateral.status === "priced" && unilateral.status === "priced") {
      expect(bilateral.breakdown.totalRvu).toBeCloseTo(unilateral.breakdown.totalRvu * 1.5, 3);
    }
  });

  it("does NOT apply 150% when the code's bilateral indicator forbids it", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine(
      { code: "12345", siteOfService: "facility", modifiers: ["50"] },
      CTX,
    );
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBe(1);
      expect(result.notes.some((n) => n.includes("NOT applied"))).toBe(true);
    }
  });

  it("pays an assistant at surgery 16%", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ ...knee, modifiers: ["80"] }, CTX);
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBeCloseTo(0.16, 4);
    }
  });

  it("pays a non-physician assistant 85% of the assistant amount", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ ...knee, modifiers: ["AS"] }, CTX);
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBeCloseTo(0.136, 4);
    }
  });

  it("refuses to pay an assistant on a code that never allows one", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine(
      { code: "12345", siteOfService: "facility", modifiers: ["80"] },
      CTX,
    );
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBe(1);
      expect(result.notes.some((n) => n.includes("never pays an assistant"))).toBe(true);
    }
  });

  it("pays each co-surgeon 62.5%", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ ...knee, modifiers: ["62"] }, CTX);
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBeCloseTo(0.625, 4);
    }
  });

  it("flags modifier 52 for review instead of inventing a reduction", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ ...knee, modifiers: ["52"] }, CTX);
    if (result.status === "priced") {
      expect(result.breakdown.modifierFactor).toBe(1);
      expect(result.notes.some((n) => n.includes("manual review"))).toBe(true);
    }
  });

  it("warns when two payment modifiers stack", () => {
    loadPfsTables(fixtureTables());
    const result = priceLine({ ...knee, modifiers: ["80", "62"] }, CTX);
    if (result.status === "priced") {
      expect(result.notes.some((n) => n.includes("more than one payment modifier"))).toBe(true);
    }
  });
});

describe("multiple procedure reduction", () => {
  it("pays the highest-valued procedure at 100% and the next at 50%", () => {
    loadPfsTables(fixtureTables());
    const lines: ServiceLine[] = [
      { code: "29881", siteOfService: "facility" },
      { code: "27447", siteOfService: "facility" },
    ];
    const factors = multipleProcedureFactors(lines, CTX);
    // 27447 is worth more, so it keeps 100% even though it is listed second.
    expect(factors[1]).toBe(1);
    expect(factors[0]).toBe(0.5);
  });

  it("does not reduce a single procedure", () => {
    loadPfsTables(fixtureTables());
    expect(multipleProcedureFactors([{ code: "27447", siteOfService: "facility" }], CTX)).toEqual([
      1,
    ]);
  });

  it("never reduces codes whose indicator is not 2", () => {
    loadPfsTables(fixtureTables());
    const lines: ServiceLine[] = [
      { code: "99214", siteOfService: "non-facility" },
      { code: "99214", siteOfService: "non-facility" },
    ];
    expect(multipleProcedureFactors(lines, CTX)).toEqual([1, 1]);
  });

  it("applies the reduction when pricing the session as a whole", () => {
    loadPfsTables(fixtureTables());
    const session = priceSession(
      [
        { code: "27447", siteOfService: "facility" },
        { code: "29881", siteOfService: "facility" },
      ],
      CTX,
    );
    // 27447 work 20.0 at 100%, 29881 work 9.0 at 50% = 24.5
    expect(session.totalWorkRvu).toBeCloseTo(24.5, 3);
  });

  it("reports unpriced lines separately rather than dropping them", () => {
    loadPfsTables(fixtureTables());
    const session = priceSession(
      [
        { code: "99214", siteOfService: "non-facility" },
        { code: "99000", siteOfService: "non-facility" },
      ],
      CTX,
    );
    expect(session.unpriced).toHaveLength(1);
    expect(session.unpriced[0].code).toBe("99000");
  });
});

describe("per-provider productivity", () => {
  const period = { start: "2026-01-01", end: "2026-12-31" };

  function sessions(): EncounterSession[] {
    return [
      {
        localityCode: "01",
        lines: [
          {
            code: "99214",
            siteOfService: "non-facility",
            dateOfService: "2026-03-02",
            renderingNpi: "1111111111",
            billingNpi: "1111111111",
          },
        ],
      },
      {
        localityCode: "01",
        lines: [
          {
            code: "99214",
            siteOfService: "non-facility",
            dateOfService: "2026-03-03",
            renderingNpi: "1111111111",
            billingNpi: "1111111111",
          },
        ],
      },
      // Incident-to: performed by the APP, billed under the physician.
      {
        localityCode: "01",
        lines: [
          {
            code: "99214",
            siteOfService: "non-facility",
            dateOfService: "2026-03-04",
            renderingNpi: "2222222222",
            billingNpi: "1111111111",
          },
        ],
      },
    ];
  }

  const providers = [
    { npi: "1111111111", name: "Dr Physician", clinicalFte: 1.0 },
    { npi: "2222222222", name: "APP", clinicalFte: 0.5 },
  ];

  it("credits work to the rendering provider by default", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    const physician = report.providers.find((p) => p.npi === "1111111111");
    const app = report.providers.find((p) => p.npi === "2222222222");
    expect(physician?.workRvu).toBeCloseTo(1.92 * 2, 2);
    expect(app?.workRvu).toBeCloseTo(1.92, 2);
  });

  it("credits work to the billing provider when asked", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period, { basis: "billing" });
    const physician = report.providers.find((p) => p.npi === "1111111111");
    expect(physician?.workRvu).toBeCloseTo(1.92 * 3, 2);
    expect(report.providers.find((p) => p.npi === "2222222222")).toBeUndefined();
  });

  it("surfaces every rendering/billing mismatch rather than hiding it in a total", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    expect(report.attributionDiscrepancies).toHaveLength(1);
    expect(report.attributionDiscrepancies[0].renderingNpi).toBe("2222222222");
    expect(report.caveats.some((c) => c.includes("incident-to"))).toBe(true);
  });

  it("normalises by clinical FTE", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    const app = report.providers.find((p) => p.npi === "2222222222");
    expect(app?.workRvuPerFte).toBeCloseTo(1.92 / 0.5, 2);
  });

  it("returns null per-FTE rather than assuming 1.0 when FTE is unknown", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), [], period);
    expect(report.providers.every((p) => p.workRvuPerFte === null)).toBe(true);
    expect(report.caveats.some((c) => c.includes("no clinical FTE"))).toBe(true);
  });

  it("counts distinct encounter days, not lines", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    const physician = report.providers.find((p) => p.npi === "1111111111");
    expect(physician?.encounterDays).toBe(2);
    expect(physician?.lineCount).toBe(2);
  });

  it("warns that a short period cannot be annualised meaningfully", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, {
      start: "2026-03-01",
      end: "2026-03-14",
    });
    expect(report.caveats.some((c) => c.includes("14 day"))).toBe(true);
  });

  it("never invents a benchmark percentile", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    expect(report.caveats.some((c) => c.includes("licensed products"))).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/percentile["\s]*:\s*\d/);
  });

  it("reports productivity in work RVU, not total RVU", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(sessions(), providers, period);
    const physician = report.providers.find((p) => p.npi === "1111111111");
    // Work is 1.92 each; total is 3.66 each. The productivity figure is the former.
    expect(physician?.workRvu).toBeCloseTo(3.84, 2);
    expect(physician?.totalRvu).toBeCloseTo(7.32, 2);
    expect(report.caveats[0]).toContain("work RVU only");
  });

  it("notes lines that carry no NPI and credit nobody", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(
      [{ localityCode: "01", lines: [{ code: "99214", siteOfService: "non-facility" }] }],
      providers,
      period,
    );
    expect(report.providers).toHaveLength(0);
    expect(report.caveats.some((c) => c.includes("credited to nobody"))).toBe(true);
  });

  it("applies the multiple-procedure reduction within a session before crediting", () => {
    loadPfsTables(fixtureTables());
    const report = buildProductivityReport(
      [
        {
          localityCode: "01",
          lines: [
            {
              code: "27447",
              siteOfService: "facility",
              dateOfService: "2026-04-01",
              renderingNpi: "1111111111",
            },
            {
              code: "29881",
              siteOfService: "facility",
              dateOfService: "2026-04-01",
              renderingNpi: "1111111111",
            },
          ],
        },
      ],
      providers,
      period,
    );
    // 20.0 + (9.0 * 0.5) = 24.5, not 29.0.
    expect(report.providers[0].workRvu).toBeCloseTo(24.5, 2);
  });
});

describe("attribution basis comparison", () => {
  it("quantifies exactly how much wRVU moves between named providers", () => {
    loadPfsTables(fixtureTables());
    const comparison = compareAttributionBases(
      [
        {
          localityCode: "01",
          lines: [
            {
              code: "99214",
              siteOfService: "non-facility",
              dateOfService: "2026-05-01",
              renderingNpi: "2222222222",
              billingNpi: "1111111111",
            },
          ],
        },
      ],
      [
        { npi: "1111111111", name: "Dr Physician" },
        { npi: "2222222222", name: "APP" },
      ],
      { start: "2026-01-01", end: "2026-12-31" },
    );

    const physician = comparison.shifts.find((s) => s.npi === "1111111111");
    const app = comparison.shifts.find((s) => s.npi === "2222222222");
    expect(physician?.delta).toBeCloseTo(1.92, 2);
    expect(app?.delta).toBeCloseTo(-1.92, 2);
  });

  it("reports no shifts when rendering and billing always agree", () => {
    loadPfsTables(fixtureTables());
    const comparison = compareAttributionBases(
      [
        {
          localityCode: "01",
          lines: [
            {
              code: "99214",
              siteOfService: "non-facility",
              renderingNpi: "1111111111",
              billingNpi: "1111111111",
            },
          ],
        },
      ],
      [{ npi: "1111111111" }],
      { start: "2026-01-01", end: "2026-12-31" },
    );
    expect(comparison.shifts).toHaveLength(0);
  });
});
