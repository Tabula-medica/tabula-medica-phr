import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  PROTOCOL_VERSION,
  SCREENING_RULES,
  BIOMARKER_TARGETS,
  FIVE_NUMBERS,
} from "../shared/longevity-protocol";
import { careGapsService } from "../server/care-gaps-service";

const target = (name: string) => BIOMARKER_TARGETS.find((b) => b.name === name)?.optimal;

describe("longevity protocol — canonical values", () => {
  it("has a well-formed version stamp", () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d{4}\.\d{2}$/);
  });

  it("locks the five headline numbers to the reference doc", () => {
    const by = Object.fromEntries(FIVE_NUMBERS.map((n) => [n.key, n.target]));
    expect(by.apob).toBe("< 80 mg/dL");
    expect(by.bp).toBe("< 120/80");
    expect(by.glycemic).toBe("< 5.6 % · < 8 µIU/mL");
    expect(by.grip).toBe("≥ 40 kg M · ≥ 25 kg F");
  });

  it("keeps biomarker targets aligned to the doc (guards the drift we fixed)", () => {
    expect(target("ApoB")).toBe("< 80");
    expect(target("HbA1c")).toBe("< 5.6");        // was < 5.7 in the app
    expect(target("Fasting Insulin")).toBe("< 8"); // was 2-6 in the app
    expect(target("Vitamin B12")).toBe("> 400");   // was 500-1000
    expect(target("TSH")).toBe("0.5-4.0");          // was 0.5-2.5
  });
});

describe("care-gap engine ↔ shared table", () => {
  const patient = {
    age: 55,
    biologicalSex: "female" as const,
    bmi: 28,
    cvdRiskFactorCount: 1,
    lastScreenings: {},
  };
  const codes = careGapsService.evaluate(patient).gaps.map((g) => g.code);

  it("emits exactly the eight Grade A/B rule codes from the table", () => {
    for (const key of ["colorectal", "breast", "cervical", "lung", "diabetes", "hypertension", "depression", "statin"]) {
      expect(codes).toContain(SCREENING_RULES[key].code);
    }
  });

  it("never auto-flags shared-decision (Grade C/I) items", () => {
    expect(codes).not.toContain(SCREENING_RULES.psa.code);
    expect(codes).not.toContain(SCREENING_RULES.aaa.code);
  });

  it("flags a 55yo woman with no prior mammogram as overdue on the table's 40–74 window", () => {
    const breast = careGapsService
      .evaluate(patient)
      .gaps.find((g) => g.code === SCREENING_RULES.breast.code);
    expect(breast?.status).toBe("overdue");
    expect(breast?.intervalMonths).toBe(SCREENING_RULES.breast.intervalMonths);
  });
});

describe("cross-repo drift tripwire", () => {
  const norm = (s: string) => s.replace(/\r\n/g, "\n");
  const files = ["shared/longevity-protocol.ts", "server/care-gaps-service.ts"];

  it("matches the committed checksum (fails if a copy is hand-edited without resync)", () => {
    const h = createHash("sha256");
    for (const rel of files) {
      h.update(rel + "\n");
      h.update(norm(readFileSync(rel, "utf8")));
    }
    const committed = norm(readFileSync("shared/longevity-protocol.sha256", "utf8")).trim();
    expect(h.digest("hex")).toBe(committed);
  });
});
