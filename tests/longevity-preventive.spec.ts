// Longevity & Preventive Health protocol — plan builder, biomarker assessment, units.
import { describe, it, expect } from "vitest";
import {
  ADULT_VACCINES,
  BIOMARKER_TARGETS,
  PREVENTIVE_SCREENINGS,
  assessBiomarker,
  buildLongevityPlan,
  formatTargetRange,
  fromDisplayUnit,
  summarizePlanForClinician,
  toDisplayUnit,
  type LongevityProfile,
} from "../shared/longevity-preventive";

const TODAY = new Date("2026-09-07T00:00:00Z");
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("catalogue integrity", () => {
  it("has unique ids across screenings, vaccines and biomarkers", () => {
    const all = [...ids(PREVENTIVE_SCREENINGS), ...ids(ADULT_VACCINES), ...ids(BIOMARKER_TARGETS)];
    expect(new Set(all).size).toBe(all.length);
  });
  it("every screening carries a source for both regions", () => {
    for (const s of PREVENTIVE_SCREENINGS) {
      expect(s.source.us.length).toBeGreaterThan(0);
      expect(s.source.international.length).toBeGreaterThan(0);
    }
  });
});

describe("buildLongevityPlan — age/sex/risk gating", () => {
  it("52-year-old woman: mammography, colorectal, cervical, lipids due; no PSA, AAA or lung", () => {
    const plan = buildLongevityPlan({ age: 52, sex: "female" }, { today: TODAY });
    const s = ids(plan.screenings);
    expect(s).toEqual(expect.arrayContaining(["breast", "colorectal", "cervical", "lipids-apob", "lipoprotein-a", "blood-pressure"]));
    expect(s).not.toContain("prostate");
    expect(s).not.toContain("aaa");
    expect(s).not.toContain("lung");
    expect(plan.screenings.find((i) => i.id === "breast")?.status).toBe("due");
  });

  it("68-year-old male former heavy smoker: lung LDCT, AAA and PSA (discuss) apply", () => {
    const profile: LongevityProfile = { age: 68, sex: "male", smokingStatus: "former", packYears: 30, quitYears: 10 };
    const plan = buildLongevityPlan(profile, { today: TODAY });
    const s = ids(plan.screenings);
    expect(s).toContain("lung");
    expect(s).toContain("aaa");
    expect(plan.screenings.find((i) => i.id === "prostate")?.status).toBe("discuss");
    expect(s).toContain("cognitive");
    expect(s).toContain("falls-function");
  });

  it("quit more than 15 years ago removes LDCT eligibility", () => {
    const plan = buildLongevityPlan({ age: 60, sex: "male", smokingStatus: "former", packYears: 30, quitYears: 20 }, { today: TODAY });
    expect(ids(plan.screenings)).not.toContain("lung");
  });

  it("family history of colorectal cancer pulls the start age to 40 with a note", () => {
    const plan = buildLongevityPlan({ age: 41, sex: "male", familyHistoryColorectalCancer: true }, { today: TODAY });
    const crc = plan.screenings.find((i) => i.id === "colorectal");
    expect(crc).toBeDefined();
    expect(crc?.note).toMatch(/First-degree relative/);
    const without = buildLongevityPlan({ age: 41, sex: "male" }, { today: TODAY });
    expect(ids(without.screenings)).not.toContain("colorectal");
  });

  it("diabetes brings kidney uACR and yearly retinal exam into a 30-year-old's plan", () => {
    const plan = buildLongevityPlan({ age: 30, sex: "female", hasDiabetes: true }, { today: TODAY });
    const s = ids(plan.screenings);
    expect(s).toContain("kidney-uacr");
    expect(s).toContain("hearing-vision");
    // Known diabetes: HbA1c is monitoring (biomarker tab), not screening.
    expect(s).not.toContain("diabetes-screen");
    const overweight30 = buildLongevityPlan({ age: 30, sex: "male", bmi: 27 }, { today: TODAY });
    expect(ids(overweight30.screenings)).toContain("diabetes-screen");
  });

  it("vaccines: RSV only at 75+ or 50–74 with risk; pneumococcal from 50", () => {
    const healthy60 = buildLongevityPlan({ age: 60, sex: "female" }, { today: TODAY });
    expect(ids(healthy60.vaccines)).not.toContain("rsv");
    expect(ids(healthy60.vaccines)).toContain("pneumococcal");
    expect(ids(healthy60.vaccines)).toContain("zoster");
    const diabetic60 = buildLongevityPlan({ age: 60, sex: "female", hasDiabetes: true }, { today: TODAY });
    expect(ids(diabetic60.vaccines)).toContain("rsv");
    const seventySix = buildLongevityPlan({ age: 76, sex: "male" }, { today: TODAY });
    expect(ids(seventySix.vaccines)).toContain("rsv");
  });
});

describe("buildLongevityPlan — completion status", () => {
  it("marks recent completions up to date, near-expiry upcoming, and old ones due", () => {
    const plan = buildLongevityPlan(
      { age: 50, sex: "female" },
      {
        today: TODAY,
        completions: {
          breast: "2025-10-01", // 24-month cadence → next 2027-10 → up to date
          "blood-pressure": "2025-10-15", // 12-month → next 2026-10-15 → within 90 days → upcoming
          influenza: "2024-10-01", // 12-month → overdue
          "lipoprotein-a": "2019-01-01", // one-time → up to date forever
        },
      },
    );
    const byId = Object.fromEntries([...plan.screenings, ...plan.vaccines].map((i) => [i.id, i]));
    expect(byId.breast.status).toBe("up_to_date");
    expect(byId["blood-pressure"].status).toBe("upcoming");
    expect(byId["blood-pressure"].nextDue).toBe("2026-10-15");
    expect(byId.influenza.status).toBe("due");
    expect(byId["lipoprotein-a"].status).toBe("up_to_date");
    expect(plan.counts.due + plan.counts.upcoming + plan.counts.upToDate + plan.counts.discuss).toBe(
      plan.screenings.length + plan.vaccines.length,
    );
  });

  it("sorts due items ahead of upcoming and up-to-date", () => {
    const plan = buildLongevityPlan({ age: 50, sex: "male" }, { today: TODAY, completions: { "blood-pressure": "2026-08-01" } });
    const statuses = plan.screenings.map((i) => i.status);
    const firstUpToDate = statuses.indexOf("up_to_date");
    const lastDue = statuses.lastIndexOf("due");
    expect(lastDue).toBeLessThan(firstUpToDate);
  });
});

describe("international profile", () => {
  it("uses WHO/EU windows: mammography 50–69, colorectal from 50, cervical HPV from 30", () => {
    const us = buildLongevityPlan({ age: 45, sex: "female" }, { today: TODAY, region: "us" });
    const intl = buildLongevityPlan({ age: 45, sex: "female" }, { today: TODAY, region: "international" });
    expect(ids(us.screenings)).toContain("breast");
    expect(ids(intl.screenings)).not.toContain("breast");
    expect(ids(us.screenings)).toContain("colorectal");
    expect(ids(intl.screenings)).not.toContain("colorectal");
    expect(intl.screenings.find((i) => i.id === "cervical")?.cadence).toMatch(/WHO/);
    expect(intl.vaccines.every((v) => v.grade.startsWith("WHO"))).toBe(true);
  });
});

describe("assessBiomarker", () => {
  it("classifies ApoB across optimal / borderline / concern", () => {
    expect(assessBiomarker("apob", 70, "male")).toBe("optimal");
    expect(assessBiomarker("apob", 90, "male")).toBe("borderline");
    expect(assessBiomarker("apob", 120, "male")).toBe("concern");
  });
  it("applies sex-specific HDL and ALT thresholds", () => {
    expect(assessBiomarker("hdl", 45, "male")).toBe("optimal");
    expect(assessBiomarker("hdl", 45, "female")).toBe("borderline");
    expect(assessBiomarker("alt", 28, "male")).toBe("optimal");
    expect(assessBiomarker("alt", 28, "female")).toBe("borderline");
  });
  it("handles two-sided ranges and unknown ids", () => {
    expect(assessBiomarker("vitamin-d", 45, "female")).toBe("optimal");
    expect(assessBiomarker("vitamin-d", 15, "female")).toBe("concern");
    expect(assessBiomarker("vitamin-d", 25, "female")).toBe("borderline");
    expect(assessBiomarker("not-a-marker", 1, "male")).toBe("unknown");
    expect(assessBiomarker("apob", Number.NaN, "male")).toBe("unknown");
  });
});

describe("unit conversion", () => {
  const ldl = BIOMARKER_TARGETS.find((b) => b.id === "ldl")!;
  it("round-trips LDL between mg/dL and mmol/L", () => {
    const si = toDisplayUnit(ldl, 100, "si");
    expect(si.unit).toBe("mmol/L");
    expect(si.value).toBeCloseTo(2.59, 2);
    expect(fromDisplayUnit(ldl, si.value, "si")).toBeCloseTo(100, 0);
  });
  it("formats sex-specific target ranges in the requested unit", () => {
    expect(formatTargetRange(ldl, "male", "conventional")).toBe("< 100 mg/dL");
    expect(formatTargetRange(ldl, "male", "si")).toBe("< 2.59 mmol/L");
    const ferritin = BIOMARKER_TARGETS.find((b) => b.id === "ferritin")!;
    expect(formatTargetRange(ferritin, "female", "conventional")).toBe("30–150 ng/mL");
  });
});

describe("summarizePlanForClinician", () => {
  it("produces a paste-ready text block with counts and sections", () => {
    const plan = buildLongevityPlan({ age: 55, sex: "male", hasHypertension: true }, { today: TODAY });
    const text = summarizePlanForClinician(plan);
    expect(text).toMatch(/55-year-old male, hypertension/);
    expect(text).toMatch(/Screenings/);
    expect(text).toMatch(/Immunizations/);
    expect(text).toMatch(/ApoB < 80/);
  });
});
