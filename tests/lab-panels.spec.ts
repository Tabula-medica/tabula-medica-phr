import { describe, it, expect } from "vitest";
import {
  LAB_PANELS,
  getLabPanel,
  listLabPanels,
  mergePanels,
  resolvePanel,
  validateLabPanelCatalog,
} from "../server/services/clinical-catalog/lab-panels";

describe("catalog integrity", () => {
  it("has no structural problems", () => {
    expect(validateLabPanelCatalog()).toEqual([]);
  });

  it("covers every requested indication", () => {
    const ids = LAB_PANELS.map((p) => p.id).sort();
    expect(ids).toEqual([
      "anemia",
      "annual-wellness",
      "arthritis",
      "diabetes",
      "fatigue",
      "hypertension",
      "liver-enzyme-elevation",
    ]);
  });

  it("attributes every panel to a guideline source", () => {
    for (const p of LAB_PANELS) expect(p.guideline, p.id).toBeTruthy();
  });

  it("gives every panel at least one clinician note", () => {
    for (const p of LAB_PANELS) expect(p.notes.length, p.id).toBeGreaterThan(0);
  });
});

describe("tiering — the reason this is not a flat list", () => {
  it("keeps every panel's first-line set small enough to be actionable", () => {
    for (const p of LAB_PANELS) {
      const firstLine = p.tests.filter((t) => t.tier === "first-line");
      expect(firstLine.length, `${p.id} first-line`).toBeLessThanOrEqual(8);
    }
  });

  it("gives every reflex test an explicit trigger", () => {
    for (const p of LAB_PANELS) {
      for (const t of p.tests.filter((x) => x.tier === "reflex")) {
        expect(t.trigger, `${p.id}/${t.shortName}`).toBeTruthy();
      }
    }
  });

  it("holds the Wilson disease screen back from the first-line liver workup", () => {
    // Ceruloplasmin on every raised ALT produces far more false positives
    // than cases of Wilson disease.
    const panel = getLabPanel("liver-enzyme-elevation")!;
    const cerulo = panel.tests.find((t) => t.shortName === "Ceruloplasmin")!;
    expect(cerulo.tier).toBe("reflex");
    expect(cerulo.trigger).toMatch(/40/);
  });

  it("holds ANA back from the first-line arthritis workup", () => {
    const panel = getLabPanel("arthritis")!;
    const ana = panel.tests.find((t) => t.shortName === "ANA")!;
    expect(ana.tier).toBe("reflex");
  });

  it("does not put vitamin D in the first-line fatigue panel", () => {
    const panel = getLabPanel("fatigue")!;
    const vitD = panel.tests.find((t) => t.shortName.startsWith("Vitamin D"))!;
    expect(vitD.tier).toBe("reflex");
  });
});

describe("resolvePanel", () => {
  it("returns only first-line tests by default", () => {
    const r = resolvePanel("anemia")!;
    expect(r.firstLine.every((t) => t.tier === "first-line")).toBe(true);
    expect(r.reflex.length).toBeGreaterThan(0);
  });

  it("flags fasting when a first-line test needs it", () => {
    const wellness = resolvePanel("annual-wellness")!;
    expect(wellness.requiresFasting).toBe(true);
    expect(wellness.patientPreparation).toContain("Fast for");
  });

  it("does not demand fasting for a panel that does not need it", () => {
    const arthritis = resolvePanel("arthritis")!;
    expect(arthritis.requiresFasting).toBe(false);
    expect(arthritis.patientPreparation).toBeNull();
  });

  it("returns null for an unknown panel rather than throwing", () => {
    expect(resolvePanel("not-a-panel")).toBeNull();
    expect(getLabPanel("not-a-panel")).toBeNull();
  });

  it("includes reflex tests only when asked", () => {
    const a = resolvePanel("fatigue")!;
    const b = resolvePanel("fatigue", { includeReflex: true })!;
    expect(b.firstLine.length).toBe(a.firstLine.length);
    expect(b.reflex.length).toBeGreaterThan(0);
  });
});

describe("mergePanels", () => {
  it("deduplicates a test shared by two panels", () => {
    const merged = mergePanels(["diabetes", "hypertension"]);
    const cmpCount = merged.filter((t) => t.shortName === "CMP").length;
    expect(cmpCount).toBe(1);
  });

  it("keeps a test that is first-line in one panel and reflex in another", () => {
    // HbA1c is first-line for diabetes and reflex for fatigue; collapsing them
    // would silently downgrade the diabetes order.
    const merged = mergePanels(["diabetes", "fatigue"]);
    const a1c = merged.filter((t) => t.shortName === "HbA1c");
    expect(a1c.length).toBe(2);
    expect(a1c.map((t) => t.tier).sort()).toEqual(["first-line", "reflex"]);
  });

  it("ignores unknown panel ids", () => {
    expect(mergePanels(["nope"])).toEqual([]);
    expect(mergePanels(["anemia", "nope"]).length).toBeGreaterThan(0);
  });
});

describe("listLabPanels", () => {
  it("summarises each panel with its tier counts", () => {
    const list = listLabPanels();
    expect(list).toHaveLength(LAB_PANELS.length);
    for (const row of list) {
      expect(row.firstLineCount).toBeGreaterThan(0);
      expect(row.name).toBeTruthy();
    }
  });
});
