// Stage 6: coding — deterministic 2021+ AMA E/M leveling (MDM or time), ICD-10 specificity
// and HCC capture checks, plus an AI suggestion hook that is a SUGGESTION ONLY (provider
// confirms; never auto-bills). PHI-bearing AI goes through ai-provider (Vertex default).
import { HCC_PREFIXES } from "./reference-data";
import { isValidIcd10 } from "./util";

export interface MdmInputs {
  // Problems addressed
  problems: Array<{ severity: "minimal" | "self-limited" | "stable-chronic" | "acute-uncomplicated" | "chronic-exacerbation" | "undiagnosed-uncertain" | "acute-systemic" | "chronic-severe-exacerbation" | "life-threatening" }>;
  // Data reviewed/ordered
  uniqueTestsOrderedOrReviewed: number;
  externalNotesReviewed: number;
  independentHistorian: boolean;
  independentInterpretation: boolean;
  discussionWithExternalPhysician: boolean;
  // Risk
  risk: "minimal" | "low" | "moderate" | "high";
  // Time-based alternative
  totalTimeMinutes?: number;
  newPatient: boolean;
}

export type MdmLevel = "straightforward" | "low" | "moderate" | "high";

function problemsLevel(p: MdmInputs["problems"]): MdmLevel {
  const s = p.map((x) => x.severity);
  if (s.some((x) => x === "life-threatening" || x === "chronic-severe-exacerbation")) return "high";
  if (s.some((x) => x === "chronic-exacerbation" || x === "undiagnosed-uncertain" || x === "acute-systemic")) return "moderate";
  if (s.filter((x) => x === "stable-chronic").length >= 2) return "moderate";
  if (s.some((x) => x === "stable-chronic" || x === "acute-uncomplicated")) return "low";
  if (s.filter((x) => x === "self-limited").length >= 2) return "low";
  return "straightforward";
}

function dataLevel(i: MdmInputs): MdmLevel {
  const cat1 = i.uniqueTestsOrderedOrReviewed + i.externalNotesReviewed + (i.independentHistorian ? 1 : 0);
  const categoriesMet = [cat1 >= 3, i.independentInterpretation, i.discussionWithExternalPhysician].filter(Boolean).length;
  if (categoriesMet >= 2) return "high";
  if (categoriesMet >= 1 || cat1 >= 3) return "moderate";
  if (cat1 >= 2 || i.independentHistorian) return "low";
  return "straightforward";
}

function riskLevel(r: MdmInputs["risk"]): MdmLevel {
  return r === "minimal" ? "straightforward" : r;
}

const ORDER: MdmLevel[] = ["straightforward", "low", "moderate", "high"];

// MDM = the level met by at least 2 of the 3 elements.
export function mdmLevel(i: MdmInputs): { level: MdmLevel; elements: { problems: MdmLevel; data: MdmLevel; risk: MdmLevel } } {
  const elements = { problems: problemsLevel(i.problems), data: dataLevel(i), risk: riskLevel(i.risk) };
  const ranks = Object.values(elements).map((l) => ORDER.indexOf(l)).sort((a, b) => b - a);
  return { level: ORDER[ranks[1]], elements };
}

const TIME_THRESHOLDS = {
  new: [{ code: "99202", min: 15 }, { code: "99203", min: 30 }, { code: "99204", min: 45 }, { code: "99205", min: 60 }],
  est: [{ code: "99212", min: 10 }, { code: "99213", min: 20 }, { code: "99214", min: 30 }, { code: "99215", min: 40 }],
};

export interface EmLevelResult {
  code: string;
  level: 2 | 3 | 4 | 5;
  basis: "mdm" | "time";
  mdm: ReturnType<typeof mdmLevel>;
  timeCode?: string;
  prolongedServiceUnits?: number; // 99417 / G2212 units when time basis exceeds top level
  rationale: string;
}

export function levelEm(i: MdmInputs): EmLevelResult {
  const mdm = mdmLevel(i);
  const idx = ORDER.indexOf(mdm.level); // 0..3 → 2..5
  const mdmLevelNum = (idx + 2) as 2 | 3 | 4 | 5;
  const mdmCode = i.newPatient ? `9920${mdmLevelNum}` : `9921${mdmLevelNum}`;
  let timeCode: string | undefined;
  let timeLevel: 2 | 3 | 4 | 5 | undefined;
  let prolonged = 0;
  if (i.totalTimeMinutes !== undefined) {
    const table = i.newPatient ? TIME_THRESHOLDS.new : TIME_THRESHOLDS.est;
    const met = table.filter((t) => i.totalTimeMinutes! >= t.min);
    if (met.length) {
      const top = met[met.length - 1];
      timeCode = top.code;
      timeLevel = (parseInt(top.code.slice(-1), 10)) as 2 | 3 | 4 | 5;
      const topMin = table[table.length - 1].min;
      if (timeLevel === 5 && i.totalTimeMinutes >= topMin + 15) prolonged = Math.floor((i.totalTimeMinutes - topMin) / 15);
    }
  }
  const useTime = timeLevel !== undefined && timeLevel > mdmLevelNum;
  const level = useTime ? timeLevel! : mdmLevelNum;
  return {
    code: useTime ? timeCode! : mdmCode,
    level,
    basis: useTime ? "time" : "mdm",
    mdm,
    timeCode,
    prolongedServiceUnits: useTime && prolonged > 0 ? prolonged : undefined,
    rationale: useTime
      ? `Total time ${i.totalTimeMinutes} min supports ${timeCode} (exceeds MDM-based ${mdmCode}).`
      : `MDM ${mdm.level}: problems ${mdm.elements.problems}, data ${mdm.elements.data}, risk ${mdm.elements.risk} → ${mdmCode}.`,
  };
}

export interface IcdFinding { code: string; kind: "invalid" | "unspecified" | "hcc-opportunity" | "needs-laterality" | "ok"; message: string }

export function reviewIcd(codes: string[], activeProblems: string[] = []): IcdFinding[] {
  const out: IcdFinding[] = [];
  for (const raw of codes) {
    const code = raw.toUpperCase();
    if (!isValidIcd10(code)) { out.push({ code, kind: "invalid", message: "Not a valid ICD-10-CM format" }); continue; }
    if (/\.9$|\.90$|\.99$|9$/.test(code) && code.length >= 4 && /[.]/.test(code) && /9$/.test(code)) {
      out.push({ code, kind: "unspecified", message: "Unspecified code; document specificity (type, site, acuity) to reduce medical-necessity denials" });
    } else if (/^(M1[6-9]|M2[0-5]|S[0-9]|H[0-5]|C50)/.test(code) && !/[.][0-9]*[12]\d*$/.test(code) && code.length < 6) {
      out.push({ code, kind: "needs-laterality", message: "Laterality/site likely required for this code family" });
    } else {
      out.push({ code, kind: "ok", message: "Valid" });
    }
  }
  const coded = new Set(codes.map((c) => c.toUpperCase()));
  for (const p of activeProblems) {
    const P = p.toUpperCase();
    if (!coded.has(P) && HCC_PREFIXES.some((h) => P.startsWith(h))) out.push({ code: P, kind: "hcc-opportunity", message: "Active HCC condition on problem list not coded this visit; address & document (MEAT) to capture risk adjustment" });
  }
  return out;
}

export function isHcc(code: string): boolean {
  const C = code.toUpperCase();
  return HCC_PREFIXES.some((h) => C.startsWith(h));
}

// AI suggestion seam — strict JSON, codes must be canonical, output is advisory.
export interface AiCodingSuggestion {
  em: { code: string; rationale: string };
  icd: Array<{ code: string; description: string }>;
  cptSuggestions: Array<{ code: string; rationale: string }>;
  queries: string[]; // clinical documentation improvement (CDI) queries for the provider
  disclaimer: string;
  source: string;
}

export const CODING_DISCLAIMER = "AI suggestion for provider review only. Not a bill and not a change to clinical codes; the rendering provider selects final codes.";

export const CODING_SYSTEM_PROMPT = `You are an outpatient medical coding assistant (2021+ AMA E/M guidelines, ICD-10-CM, CPT/HCPCS).
Given a SOAP note and problem list, return STRICT JSON only:
{"em":{"code":"9921x|9920x","rationale":"..."},"icd":[{"code":"...","description":"..."}],"cptSuggestions":[{"code":"...","rationale":"..."}],"queries":["CDI question for provider"]}
Rules: never invent diagnoses or procedures not documented; prefer the most specific ICD-10 code supported; flag laterality/acuity gaps as queries; codes must be canonical and untranslated.`;

export function buildCodingPrompt(note: { subjective: string; objective: string; assessment: string; plan: string }, problems: string[], newPatient: boolean, timeMinutes?: number): string {
  return `Patient type: ${newPatient ? "new" : "established"}${timeMinutes ? `; total time ${timeMinutes} min` : ""}\nActive problems: ${problems.join("; ") || "none"}\n\nS: ${note.subjective}\nO: ${note.objective}\nA: ${note.assessment}\nP: ${note.plan}`;
}

export function parseCodingSuggestion(text: string, source: string): AiCodingSuggestion {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned) as Partial<AiCodingSuggestion>;
  const okCode = (c: unknown) => typeof c === "string" && /^[A-Z0-9.]{3,8}$/i.test(c);
  return {
    em: parsed.em && okCode(parsed.em.code) ? { code: parsed.em.code.toUpperCase(), rationale: String(parsed.em.rationale ?? "") } : { code: "", rationale: "no E/M suggested" },
    icd: (parsed.icd ?? []).filter((x) => okCode(x.code) && isValidIcd10(x.code)).map((x) => ({ code: x.code.toUpperCase(), description: String(x.description ?? "") })),
    cptSuggestions: (parsed.cptSuggestions ?? []).filter((x) => okCode(x.code)).map((x) => ({ code: x.code.toUpperCase(), rationale: String(x.rationale ?? "") })),
    queries: (parsed.queries ?? []).map(String).slice(0, 10),
    disclaimer: CODING_DISCLAIMER,
    source,
  };
}

// Deterministic stub used when AI is disabled or fails closed.
export function stubCodingSuggestion(problems: string[], newPatient: boolean): AiCodingSuggestion {
  const icd = problems.filter(isValidIcd10).map((c) => ({ code: c.toUpperCase(), description: "from problem list" }));
  return {
    em: { code: newPatient ? "99203" : "99213", rationale: "Stub: low-complexity default pending provider MDM entry" },
    icd,
    cptSuggestions: [],
    queries: icd.length ? [] : ["No coded problems supplied; document at least one assessed diagnosis."],
    disclaimer: CODING_DISCLAIMER,
    source: "stub",
  };
}
