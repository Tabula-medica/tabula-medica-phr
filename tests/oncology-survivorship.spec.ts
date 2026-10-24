// Oncology course aggregation + provider-facing survivorship suggestions.
import { describe, it, expect } from "vitest";
import {
  PROTOCOL_SOURCES,
  buildOncologyCourse,
  buildSurvivorshipSuggestions,
  cardiacRiskTier,
  deriveExposures,
  oncologyCaseFromCancerTrack,
  parseDoseGy,
  summarizeForClinician,
  tumorMarkerStudiesFromLabs,
  type OncologyCase,
} from "../shared/oncology-survivorship";

const TODAY = new Date("2026-10-22T00:00:00Z");
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

function breastCase(over: Partial<OncologyCase> = {}): OncologyCase {
  return {
    primarySite: "breast",
    histology: "Invasive ductal carcinoma",
    stage: "IIA",
    diagnosisDate: "2021-03-15",
    status: "remission",
    biomarkers: [
      { name: "ER", value: "95%", status: "positive" },
      { name: "PR", value: "85%", status: "positive" },
      { name: "HER2/neu", value: "IHC 1+", status: "negative" },
    ],
    studies: [
      { id: "p1", kind: "pathology", date: "2021-03-20", title: "Core biopsy", pathology: { histology: "Invasive ductal carcinoma", grade: "Grade 2" } },
      { id: "p2", kind: "pathology", date: "2021-05-01", title: "Surgical pathology", pathology: { margins: "negative", nodesExamined: 12, nodesPositive: 1, lymphovascularInvasion: false, tumorSizeMm: 22 } },
      { id: "i1", kind: "imaging", modality: "Mammogram", date: "2025-06-10", title: "Screening mammogram", response: "ned" },
    ],
    treatments: [
      { id: "t1", modality: "surgery", title: "Mastectomy with axillary dissection", start: "2021-05-01", surgery: { procedure: "Mastectomy", axillaryDissection: true } },
      { id: "t2", modality: "chemotherapy", title: "AC-T", start: "2021-06-15", end: "2021-11-30", agents: ["Doxorubicin", "Cyclophosphamide", "Paclitaxel"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 240 }] },
      { id: "t3", modality: "radiation", title: "Chest wall radiation", start: "2021-12-15", end: "2022-01-20", radiation: { site: "Chest wall and supraclavicular", doseGy: 50 } },
      { id: "t4", modality: "hormone_therapy", title: "Anastrozole", start: "2022-02-01", ongoing: true, intent: "adjuvant", agents: ["Anastrozole"] },
    ],
    treatmentSummaryDocumented: false,
    survivorshipCarePlanDocumented: false,
    ...over,
  };
}

describe("catalogue integrity", () => {
  it("every rule source key resolves to a named source", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), { age: 52, sex: "female", today: TODAY });
    for (const s of set.suggestions) {
      expect(s.sources.length).toBeGreaterThan(0);
      for (const src of s.sources) expect(Object.values(PROTOCOL_SOURCES)).toContain(src);
    }
  });
  it("suggestion ids are unique and slug-safe", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), { age: 52, sex: "female", today: TODAY });
    expect(new Set(ids(set.suggestions)).size).toBe(set.suggestions.length);
    for (const s of set.suggestions) expect(s.id).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("exposure derivation", () => {
  it("detects drug classes, radiation fields and doxorubicin-equivalent dose", () => {
    const p = deriveExposures(breastCase());
    expect([...p.exposures]).toEqual(
      expect.arrayContaining(["anthracycline", "alkylator", "taxane", "aromatase_inhibitor", "chest_rt", "axillary_treatment", "topoisomerase_ii"]),
    );
    expect(p.anthracyclineDoxEquivMgM2).toBe(240);
    expect(p.chestRtDoseGy).toBe(50);
    expect(p.longTermTherapyAgents).toContain("Anastrozole");
  });
  it("converts epirubicin with the COG factor", () => {
    const c = breastCase({
      treatments: [{ id: "x", modality: "chemotherapy", title: "FEC", start: "2021-01-01", end: "2021-05-01", agents: ["Epirubicin"], cumulativeDoseMgM2: [{ agent: "Epirubicin", dose: 300 }] }],
    });
    expect(deriveExposures(c).anthracyclineDoxEquivMgM2).toBe(201);
  });
  it("flags anthracycline exposure with no dose as undocumented", () => {
    const c = breastCase({ treatments: [{ id: "x", modality: "chemotherapy", title: "AC", start: "2021-01-01", end: "2021-05-01", agents: ["Doxorubicin"] }] });
    expect(deriveExposures(c).anthracyclineDoseDocumented).toBe(false);
    expect(buildOncologyCourse(c, { today: TODAY }).dataGaps.join(" ")).toMatch(/cumulative dose/i);
  });
  it("parses radiation doses", () => {
    expect(parseDoseGy("50 Gy")).toBe(50);
    expect(parseDoseGy("5040 cGy")).toBe(50.4);
    expect(parseDoseGy("50.4Gy in 28 fractions")).toBe(50.4);
    expect(parseDoseGy("none")).toBeUndefined();
  });
});

describe("cardiac risk tiering", () => {
  const profile = (c: OncologyCase) => deriveExposures(c);
  it("is high at ≥250 mg/m² doxorubicin-equivalent", () => {
    const c = breastCase({ treatments: [{ id: "x", modality: "chemotherapy", title: "AC", start: "2021-01-01", end: "2021-05-01", agents: ["Doxorubicin"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 300 }] }] });
    expect(cardiacRiskTier(profile(c), {})).toBe("high");
  });
  it("is high for anthracycline plus trastuzumab", () => {
    const c = breastCase({
      treatments: [{ id: "x", modality: "chemotherapy", title: "AC-TH", start: "2021-01-01", end: "2021-12-01", agents: ["Doxorubicin", "Trastuzumab"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 240 }] }],
    });
    expect(cardiacRiskTier(profile(c), {})).toBe("high");
  });
  it("240 mg/m² with chest RT 50 Gy is high; moderate dose alone is intermediate", () => {
    expect(cardiacRiskTier(profile(breastCase()), {})).toBe("high");
    const c = breastCase({
      treatments: [{ id: "x", modality: "chemotherapy", title: "AC", start: "2021-01-01", end: "2021-05-01", agents: ["Doxorubicin"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 200 }] }],
    });
    expect(cardiacRiskTier(profile(c), {})).toBe("intermediate");
    expect(cardiacRiskTier(profile(c), { hasHypertension: true, hasDiabetes: true })).toBe("high");
  });
  it("is unknown when exposed without a documented dose and none without exposure", () => {
    const c = breastCase({ treatments: [{ id: "x", modality: "chemotherapy", title: "AC", start: "2021-01-01", end: "2021-05-01", agents: ["Doxorubicin"] }] });
    expect(cardiacRiskTier(profile(c), {})).toBe("unknown");
    expect(cardiacRiskTier(profile(breastCase({ treatments: [] })), {})).toBe("none");
  });
});

describe("buildOncologyCourse", () => {
  it("assembles pathology digest, phase and timeline", () => {
    const course = buildOncologyCourse(breastCase(), { today: TODAY });
    expect(course.pathology.histology).toBe("Invasive ductal carcinoma");
    expect(course.pathology.margins).toBe("negative");
    expect(course.pathology.nodes).toBe("1/12 positive");
    expect(course.pathology.lymphovascularInvasion).toBe("not identified");
    // Anastrozole is long-term therapy and must not hold the case in "active treatment".
    expect(course.phase).toBe("intermediate_survivorship");
    expect(course.lastDefinitiveTreatmentEnd).toBe("2022-01-20");
    expect(course.timeline[0].type).toBe("diagnosis");
    expect(course.timeline.map((e) => e.date)).toEqual([...course.timeline.map((e) => e.date)].sort());
    expect(course.derivedDiseaseStatus).toBe("no_evidence_of_disease");
  });
  it("detects progression and discordant remission status", () => {
    const c = breastCase({
      studies: [...breastCase().studies, { id: "i2", kind: "imaging", modality: "CT", date: "2026-09-01", title: "CT chest/abdomen", response: "progression" }],
    });
    const course = buildOncologyCourse(c, { today: TODAY });
    expect(course.derivedDiseaseStatus).toBe("progression_suspected");
    expect(ids(course.alerts)).toEqual(expect.arrayContaining(["progression-read", "status-discordant"]));
    expect(course.timeline.some((e) => e.type === "recurrence")).toBe(true);
  });
  it("trends tumor markers and flags a rising value above ULN", () => {
    const c = breastCase({
      primarySite: "colon",
      studies: [
        { id: "m1", kind: "tumor_marker", date: "2026-03-01", title: "CEA", marker: { name: "CEA", value: 2.1, unit: "ng/mL", refHigh: 3 } },
        { id: "m2", kind: "tumor_marker", date: "2026-09-01", title: "CEA", marker: { name: "CEA", value: 5.4, unit: "ng/mL", refHigh: 3 } },
      ],
    });
    const course = buildOncologyCourse(c, { today: TODAY });
    const cea = course.markerTrends[0];
    expect(cea.direction).toBe("rising");
    expect(cea.aboveUln).toBe(true);
    expect(course.alerts.find((a) => a.id.startsWith("marker-rising"))?.severity).toBe("critical");
  });
  it("ignores exposure-only entries for phase and timeline", () => {
    const c = breastCase();
    c.treatments.push({ id: "dose", modality: "chemotherapy", title: "Doxorubicin (recorded dose)", start: "2026-10-22", exposureOnly: true, agents: ["Doxorubicin"], cumulativeDoseMgM2: [{ agent: "Doxorubicin", dose: 60 }] });
    const course = buildOncologyCourse(c, { today: TODAY });
    expect(course.phase).toBe("intermediate_survivorship");
    expect(course.timeline.some((e) => e.title.includes("recorded dose"))).toBe(false);
    expect(deriveExposures(c).anthracyclineDoxEquivMgM2).toBe(300);
  });
  it("reports missing pathology and stage as data gaps", () => {
    const c = breastCase({ stage: undefined, studies: [], histology: undefined, biomarkers: [] });
    const gaps = buildOncologyCourse(c, { today: TODAY }).dataGaps.join(" | ");
    expect(gaps).toMatch(/No pathology report/);
    expect(gaps).toMatch(/Stage not documented/);
    expect(gaps).toMatch(/No biomarkers/);
  });
  it("flags LVEF below 50% and osteoporosis-range T-score", () => {
    const c = breastCase({
      studies: [
        ...breastCase().studies,
        { id: "e1", kind: "cardiac", date: "2026-01-10", title: "Echo", lvefPercent: 42 },
        { id: "d1", kind: "bone_density", date: "2026-02-10", title: "DEXA", tScore: -2.7 },
      ],
    });
    expect(ids(buildOncologyCourse(c, { today: TODAY }).alerts)).toEqual(expect.arrayContaining(["lvef-e1", "dexa-d1"]));
  });
});

describe("buildSurvivorshipSuggestions", () => {
  const ctx = { age: 52, sex: "female" as const, today: TODAY };

  it("is provider-scoped and carries the clinician disclaimer", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), ctx);
    expect(set.generatedFor).toBe("clinician");
    expect(set.disclaimer).toMatch(/clinician review only/i);
    expect(set.disclaimer).toMatch(/not shown to patients/i);
  });

  it("breast survivor on anastrozole after AC-T + chest wall RT", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), ctx);
    expect(ids(set.suggestions)).toEqual(
      expect.arrayContaining([
        "care-plan-treatment-summary",
        "disease-surveillance",
        "cardiac-surveillance",
        "bone-health",
        "neuropathy-assessment",
        "lymphedema",
        "thyroid-function",
        "second-cancer-heme",
        "endocrine-therapy-adherence",
        "psychosocial-distress",
        "immunization",
      ]),
    );
    // Surveillance cadence text comes from the breast schedule.
    expect(set.suggestions.find((s) => s.id === "disease-surveillance")?.cadence).toMatch(/mammogram/i);
    // High priority items sort first.
    expect(set.suggestions[0].priority).toBe("high");
    expect(set.scope).toBe("survivorship");
  });

  it("does not suggest ADT metabolic monitoring or pulmonary testing for this breast case", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), ctx);
    expect(ids(set.suggestions)).not.toContain("metabolic-adt");
    // Chest RT does trigger pulmonary consideration, but not for the wrong reason (no bleomycin).
    const pulm = set.suggestions.find((s) => s.id === "pulmonary-function");
    expect(pulm?.triggers.join(" ")).not.toMatch(/bleomycin/i);
  });

  it("recommends breast MRI screening only for women irradiated at ages 10–30", () => {
    const young: OncologyCase = {
      primarySite: "lymphoma",
      histology: "Hodgkin lymphoma",
      diagnosisDate: "2008-02-01",
      status: "remission",
      biomarkers: [],
      studies: [],
      treatments: [{ id: "rt", modality: "radiation", title: "Mantle field", start: "2008-09-01", end: "2008-10-15", radiation: { site: "Mediastinum / mantle", doseGy: 30 } }],
    };
    const dx25 = buildSurvivorshipSuggestions(young, { age: 43, sex: "female", today: TODAY }); // 43 now -> 25 at RT
    expect(ids(dx25.suggestions)).toContain("second-cancer-breast-after-chest-rt");
    const older = buildSurvivorshipSuggestions(young, { age: 75, sex: "female", today: TODAY }); // 57 at RT
    expect(ids(older.suggestions)).not.toContain("second-cancer-breast-after-chest-rt");
    const male = buildSurvivorshipSuggestions(young, { age: 43, sex: "male", today: TODAY });
    expect(ids(male.suggestions)).not.toContain("second-cancer-breast-after-chest-rt");
  });

  it("prostate on ADT: bone and metabolic monitoring, PSA surveillance", () => {
    const c: OncologyCase = {
      primarySite: "prostate",
      diagnosisDate: "2022-01-01",
      status: "surveillance",
      biomarkers: [],
      studies: [],
      treatments: [
        { id: "rt", modality: "radiation", title: "IMRT prostate", start: "2022-03-01", end: "2022-05-01", radiation: { site: "Prostate and pelvis", doseGy: 78 } },
        { id: "adt", modality: "hormone_therapy", title: "Leuprolide", start: "2022-03-01", end: "2023-09-01", agents: ["Leuprolide"] },
      ],
    };
    const set = buildSurvivorshipSuggestions(c, { age: 70, sex: "male", today: TODAY });
    expect(ids(set.suggestions)).toEqual(expect.arrayContaining(["bone-health", "metabolic-adt", "disease-surveillance", "second-cancer-colorectal-after-rt"]));
    expect(set.suggestions.find((s) => s.id === "disease-surveillance")?.cadence).toMatch(/PSA/);
  });

  it("limits scope and drops surveillance when progression is reported", () => {
    const c = breastCase({
      studies: [...breastCase().studies, { id: "i2", kind: "imaging", modality: "CT", date: "2026-09-01", title: "CT", response: "progression" }],
    });
    const set = buildSurvivorshipSuggestions(c, ctx);
    expect(set.scope).toBe("limited_active_disease");
    expect(set.scopeNote).toMatch(/treating oncologist/i);
    expect(ids(set.suggestions)).not.toContain("disease-surveillance");
    expect(ids(set.suggestions)).not.toContain("care-plan-treatment-summary");
  });

  it("current treatment keeps the case out of the survivorship surveillance schedule", () => {
    const c = breastCase({ status: "active_treatment" });
    expect(buildSurvivorshipSuggestions(c, ctx).scope).toBe("limited_active_disease");
  });

  it("completion dates drive due state", () => {
    const base = buildSurvivorshipSuggestions(breastCase(), ctx);
    expect(base.suggestions.find((s) => s.id === "bone-health")?.dueState).toBe("no_record");
    const overdue = buildSurvivorshipSuggestions(breastCase(), { ...ctx, completions: { "bone-health": "2022-01-01" } });
    expect(overdue.suggestions.find((s) => s.id === "bone-health")?.dueState).toBe("overdue");
    const fresh = buildSurvivorshipSuggestions(breastCase(), { ...ctx, completions: { "bone-health": "2026-09-01" } });
    expect(fresh.suggestions.find((s) => s.id === "bone-health")?.dueState).toBe("upcoming");
  });

  it("genetics referral: young or triple-negative breast, suppressed when a result exists", () => {
    const tn = breastCase({ biomarkers: [{ name: "ER", value: "0%", status: "negative" }, { name: "PR", value: "0%", status: "negative" }, { name: "HER2", value: "0", status: "negative" }] });
    expect(ids(buildSurvivorshipSuggestions(tn, ctx).suggestions)).toContain("genetics-referral");
    const done = { ...tn, geneticFindings: [{ gene: "BRCA1", result: "negative" as const }] };
    expect(ids(buildSurvivorshipSuggestions(done, ctx).suggestions)).not.toContain("genetics-referral");
    // 52 now, dx 2021 -> 47 at diagnosis: age ≤50 triggers even when receptor-positive.
    expect(ids(buildSurvivorshipSuggestions(breastCase(), ctx).suggestions)).toContain("genetics-referral");
  });

  it("endocrine adherence follows the current regimen, not a past aromatase inhibitor", () => {
    const laterRegimen = breastCase({
      treatments: [
        ...breastCase().treatments.filter((t) => t.id !== "t4"),
        { id: "t4", modality: "hormone_therapy", title: "Anastrozole", start: "2022-02-01", end: "2024-02-01", agents: ["Anastrozole"] },
        { id: "cape", modality: "chemotherapy", title: "Capecitabine", start: "2025-06-01", ongoing: true, agents: ["Capecitabine"] },
      ],
    });
    expect(ids(buildSurvivorshipSuggestions(laterRegimen, ctx).suggestions)).not.toContain("endocrine-therapy-adherence");
    const onTherapy = buildSurvivorshipSuggestions(breastCase(), ctx).suggestions.find((s) => s.id === "endocrine-therapy-adherence");
    expect(onTherapy?.triggers).toEqual(["Anastrozole ongoing"]);
  });

  it("tobacco cessation only for current smokers", () => {
    expect(ids(buildSurvivorshipSuggestions(breastCase(), { ...ctx, smokingStatus: "current" }).suggestions)).toContain("tobacco-cessation");
    expect(ids(buildSurvivorshipSuggestions(breastCase(), { ...ctx, smokingStatus: "never" }).suggestions)).not.toContain("tobacco-cessation");
  });

  it("checkpoint inhibitor: thyroid and late irAE watch", () => {
    const c: OncologyCase = {
      primarySite: "melanoma",
      diagnosisDate: "2023-01-01",
      status: "remission",
      biomarkers: [],
      studies: [],
      treatments: [{ id: "io", modality: "immunotherapy", title: "Pembrolizumab", start: "2023-02-01", end: "2024-02-01", agents: ["Pembrolizumab"] }],
    };
    expect(ids(buildSurvivorshipSuggestions(c, { age: 60, sex: "male", today: TODAY }).suggestions)).toEqual(expect.arrayContaining(["thyroid-function", "irae-late-surveillance", "disease-surveillance"]));
  });

  it("stem cell transplant: long-term follow-up marked high priority", () => {
    const c: OncologyCase = {
      primarySite: "leukemia",
      diagnosisDate: "2019-01-01",
      status: "remission",
      biomarkers: [],
      studies: [],
      treatments: [{ id: "h", modality: "stem_cell_transplant", title: "Allogeneic HSCT", start: "2019-06-01", end: "2019-07-01", allogeneicTransplant: true }],
    };
    const s = buildSurvivorshipSuggestions(c, { age: 40, sex: "female", today: TODAY }).suggestions.find((x) => x.id === "hct-long-term-followup");
    expect(s?.priority).toBe("high");
  });

  it("every consideration is phrased for the clinician, never as a patient instruction", () => {
    const set = buildSurvivorshipSuggestions(breastCase(), { ...ctx, smokingStatus: "current" });
    for (const s of set.suggestions) {
      expect(s.consideration).not.toMatch(/\byou\b|\byour\b/i);
    }
  });
});

describe("adapter + export", () => {
  it("maps Cancer Track records, folders and chart tumor-marker labs", () => {
    const c = oncologyCaseFromCancerTrack(
      { cancerType: "breast", subtype: "IDC", stage: "IIA", diagnosisDate: "2024-03-15", inRemission: false, isActive: true, biomarkers: [{ name: "ER", value: "95%", status: "positive" }] },
      [
        { id: "t1", treatmentType: "radiation", title: "RT", startDate: "2024-08-01", endDate: "2024-09-10", details: { radiationSite: "Left breast", radiationDose: "4005 cGy" } },
        { id: "t2", treatmentType: "surgery", title: "Lumpectomy with axillary dissection", startDate: "2024-04-20", details: { surgeryType: "Lumpectomy" } },
        { id: "t3", treatmentType: "diagnosis", title: "Dx", startDate: "2024-03-15" },
      ],
      [
        { id: "d1", folderType: "pathology_reports", title: "Surgical pathology", documentDate: "2024-04-25" },
        { id: "d2", folderType: "imaging_pet_ct", title: "PET/CT", documentDate: "2024-03-30" },
        { id: "d3", folderType: "insurance", title: "EOB", documentDate: "2024-05-01" },
      ],
      { studies: tumorMarkerStudiesFromLabs([{ id: "l1", testName: "CA 15-3", value: "24", unit: "U/mL", referenceRange: "0-30", collectionDate: "2025-01-05T10:00:00Z" }, { id: "l2", testName: "Hemoglobin", value: "13", collectionDate: "2025-01-05" }]) },
    );
    expect(c.treatments).toHaveLength(2);
    expect(c.treatments.find((t) => t.modality === "radiation")?.radiation?.doseGy).toBeCloseTo(40.05);
    expect(c.treatments.find((t) => t.modality === "surgery")?.surgery?.axillaryDissection).toBe(true);
    expect(c.studies.map((s) => s.kind).sort()).toEqual(["imaging", "pathology", "tumor_marker"]);
    expect(c.studies.find((s) => s.kind === "tumor_marker")?.marker?.refHigh).toBe(30);
    expect(c.status).toBe("unknown");
  });

  it("clinician summary includes the course and the considerations with decisions", () => {
    const c = breastCase();
    const course = buildOncologyCourse(c, { today: TODAY });
    const set = buildSurvivorshipSuggestions(c, { age: 52, sex: "female", today: TODAY });
    const text = summarizeForClinician(course, set, {
      "bone-health": { suggestionId: "bone-health", status: "accepted", decidedBy: "u1", decidedAt: "2026-10-22T00:00:00Z" },
    });
    expect(text).toMatch(/ONCOLOGY COURSE/);
    expect(text).toMatch(/SURVIVORSHIP CONSIDERATIONS FOR CLINICIAN REVIEW/);
    expect(text).toMatch(/bone density.*\[accepted\]/i);
    expect(text).toMatch(/clinician review only/i);
  });
});
