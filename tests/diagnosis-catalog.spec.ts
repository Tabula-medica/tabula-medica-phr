import { describe, it, expect } from "vitest";
import {
  DIAGNOSIS_CATALOG,
  getDiagnosis,
  getDiagnosisByIcd10,
  listDiagnosisCategories,
  searchDiagnoses,
  suggestedPanelFor,
  validateDiagnosisCatalog,
} from "../server/services/clinical-catalog/diagnosis-catalog";
import { getLabPanel } from "../server/services/clinical-catalog/lab-panels";

describe("catalog integrity", () => {
  it("has no structural problems", () => {
    expect(validateDiagnosisCatalog()).toEqual([]);
  });

  it("codes every entry in ICD-10-CM", () => {
    for (const d of DIAGNOSIS_CATALOG) expect(d.icd10, d.id).toBeTruthy();
  });

  it("carries SNOMED on entries so they survive crossing a border", () => {
    // ICD-10-CM is a US clinical modification; SNOMED is what an IPS needs.
    const withSnomed = DIAGNOSIS_CATALOG.filter((d) => d.snomed);
    expect(withSnomed.length).toBe(DIAGNOSIS_CATALOG.length);
  });

  it("points every labPanelId at a panel that exists", () => {
    for (const d of DIAGNOSIS_CATALOG) {
      if (d.labPanelId) expect(getLabPanel(d.labPanelId), d.id).not.toBeNull();
    }
  });

  it("covers the indications the lab panels were built for", () => {
    for (const panelId of [
      "hypertension",
      "diabetes",
      "anemia",
      "liver-enzyme-elevation",
      "arthritis",
      "fatigue",
    ]) {
      const linked = DIAGNOSIS_CATALOG.filter((d) => d.labPanelId === panelId);
      expect(linked.length, panelId).toBeGreaterThan(0);
    }
  });
});

describe("search — how clinicians actually type", () => {
  it("resolves abbreviations", () => {
    expect(searchDiagnoses("htn")[0].entry.id).toBe("essential-hypertension");
    expect(searchDiagnoses("dm2")[0].entry.id).toBe("type-2-diabetes");
    expect(searchDiagnoses("afib")[0].entry.id).toBe("atrial-fibrillation");
    expect(searchDiagnoses("gerd")[0].entry.id).toBe("gerd");
    expect(searchDiagnoses("copd")[0].entry.id).toBe("copd");
    expect(searchDiagnoses("ra")[0].entry.id).toBe("rheumatoid-arthritis");
  });

  it("resolves lay terms", () => {
    expect(searchDiagnoses("high blood pressure")[0].entry.id).toBe(
      "essential-hypertension",
    );
    expect(searchDiagnoses("tiredness")[0].entry.id).toBe("fatigue");
    expect(searchDiagnoses("heartburn")[0].entry.id).toBe("gerd");
  });

  it("ranks an exact ICD-10 code first", () => {
    const hit = searchDiagnoses("I10")[0];
    expect(hit.entry.id).toBe("essential-hypertension");
    expect(hit.matchedOn).toBe("code");
    expect(hit.score).toBe(100);
  });

  it("ranks an exact abbreviation above a name-prefix collision", () => {
    // "as" is ankylosing spondylitis; asthma's name also starts with "as".
    const top = searchDiagnoses("as")[0];
    expect(top.entry.id).toBe("ankylosing-spondylitis");
    expect(top.matchedOn).toBe("synonym");
  });

  it("is punctuation- and case-insensitive", () => {
    expect(searchDiagnoses("i10")[0].entry.id).toBe("essential-hypertension");
    expect(searchDiagnoses("I.10")[0].entry.id).toBe("essential-hypertension");
    expect(searchDiagnoses("  HTN  ")[0].entry.id).toBe("essential-hypertension");
  });

  it("returns nothing for an empty query rather than the whole catalog", () => {
    expect(searchDiagnoses("")).toEqual([]);
    expect(searchDiagnoses("   ")).toEqual([]);
  });

  it("respects the limit", () => {
    expect(searchDiagnoses("a", { limit: 3 })).toHaveLength(3);
  });

  it("filters by category", () => {
    const hits = searchDiagnoses("a", { category: "hematologic", limit: 50 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.entry.category === "hematologic")).toBe(true);
  });

  it("orders ties stably so the list does not reshuffle between keystrokes", () => {
    const a = searchDiagnoses("dis", { limit: 20 }).map((h) => h.entry.id);
    const b = searchDiagnoses("dis", { limit: 20 }).map((h) => h.entry.id);
    expect(a).toEqual(b);
  });

  it("finds nothing for a query that matches nothing", () => {
    expect(searchDiagnoses("zzzzqqq")).toEqual([]);
  });
});

describe("lookup", () => {
  it("gets by id and by ICD-10, case-insensitively", () => {
    expect(getDiagnosis("gout")?.icd10).toBe("M10.9");
    expect(getDiagnosisByIcd10("m10.9")?.id).toBe("gout");
    expect(getDiagnosis("nope")).toBeNull();
    expect(getDiagnosisByIcd10("ZZ9.9")).toBeNull();
  });

  it("lists categories", () => {
    const cats = listDiagnosisCategories();
    expect(cats).toContain("cardiovascular");
    expect(cats).toEqual([...cats].sort());
  });
});

describe("linked workup", () => {
  it("proposes the AASLD workup when elevated liver enzymes is selected", () => {
    expect(suggestedPanelFor("elevated-liver-enzymes")).toBe(
      "liver-enzyme-elevation",
    );
  });

  it("proposes the arthritis panel for inflammatory joint disease", () => {
    expect(suggestedPanelFor("rheumatoid-arthritis")).toBe("arthritis");
    expect(suggestedPanelFor("polyarthralgia")).toBe("arthritis");
  });

  it("does not attach a serology panel to osteoarthritis", () => {
    // OA is a clinical/radiographic diagnosis; serology on it yields false positives.
    expect(suggestedPanelFor("osteoarthritis")).toBeNull();
  });

  it("returns null for a diagnosis with no linked panel", () => {
    expect(suggestedPanelFor("migraine")).toBeNull();
    expect(suggestedPanelFor("does-not-exist")).toBeNull();
  });

  it("marks findings that need resolving, not settled diagnoses", () => {
    expect(getDiagnosis("elevated-liver-enzymes")?.isWorkupFinding).toBe(true);
    expect(getDiagnosis("fatigue")?.isWorkupFinding).toBe(true);
    expect(getDiagnosis("type-2-diabetes")?.isWorkupFinding).toBeUndefined();
  });
});
