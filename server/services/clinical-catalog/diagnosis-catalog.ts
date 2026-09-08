/**
 * Diagnosis pick list with search, autocomplete, and linked workup.
 *
 * Backs the "start typing a diagnosis" control: a curated, ICD-coded catalog
 * of common ambulatory diagnoses that a clinician selects from, rather than
 * free text that nobody can code, count, or bill.
 *
 * ── Coding ──
 * Every entry carries BOTH an ICD-10-CM code (US billing) and, where a stable
 * mapping exists, a SNOMED CT concept id. SNOMED is the code that travels
 * internationally — see `shared/ips.ts` — so an entry with only ICD-10-CM is
 * a US-only entry, and this catalog is explicit about which those are.
 *
 * ── Search behaviour ──
 * Clinicians type abbreviations ("htn", "dm2", "afib", "gerd"), lay terms
 * ("high blood pressure"), and misspellings. A catalog that only matches the
 * official ICD description is useless at the keyboard, so every entry carries
 * `synonyms`, and ranking prefers exact-code and prefix matches over the
 * substring matches that would otherwise flood the list.
 *
 * ── Linked workup ──
 * Entries reference the lab panel that belongs with them (`labPanelId`), which
 * is what lets selecting "elevated liver enzymes" propose the AASLD workup
 * instead of leaving the clinician to remember it.
 */

import type { LabPanelId } from "./lab-panels";

export type DiagnosisCategory =
  | "cardiovascular"
  | "endocrine"
  | "gastrointestinal"
  | "hematologic"
  | "musculoskeletal"
  | "respiratory"
  | "neurologic"
  | "psychiatric"
  | "renal"
  | "infectious"
  | "constitutional";

export interface DiagnosisEntry {
  /** Stable internal id, kebab-case. */
  id: string;
  /** Preferred clinical display name. */
  name: string;
  /** ICD-10-CM code. */
  icd10: string;
  /** SNOMED CT concept id, when a stable mapping exists. */
  snomed?: string;
  category: DiagnosisCategory;
  /** Abbreviations, lay terms, and alternate names used for matching. */
  synonyms: string[];
  /** Lab panel that belongs with this diagnosis, when one applies. */
  labPanelId?: LabPanelId;
  /**
   * True when this is a *finding* requiring a workup rather than a settled
   * diagnosis. The UI should nudge toward resolving it, not leave it on the
   * problem list forever.
   */
  isWorkupFinding?: boolean;
}

export const DIAGNOSIS_CATALOG: readonly DiagnosisEntry[] = [
  // ── Cardiovascular ────────────────────────────────────────────────────────
  {
    id: "essential-hypertension",
    name: "Essential (primary) hypertension",
    icd10: "I10",
    snomed: "59621000",
    category: "cardiovascular",
    synonyms: ["htn", "high blood pressure", "hypertension", "raised bp"],
    labPanelId: "hypertension",
  },
  {
    id: "hyperlipidemia",
    name: "Hyperlipidemia, unspecified",
    icd10: "E78.5",
    snomed: "55822004",
    category: "cardiovascular",
    synonyms: ["high cholesterol", "dyslipidemia", "lipids", "hld"],
  },
  {
    id: "atrial-fibrillation",
    name: "Atrial fibrillation, unspecified",
    icd10: "I48.91",
    snomed: "49436004",
    category: "cardiovascular",
    synonyms: ["afib", "a-fib", "af", "irregular heartbeat"],
  },
  {
    id: "heart-failure-reduced-ef",
    name: "Heart failure with reduced ejection fraction",
    icd10: "I50.20",
    snomed: "703272007",
    category: "cardiovascular",
    synonyms: ["hfref", "chf", "systolic heart failure", "congestive heart failure"],
  },
  {
    id: "coronary-artery-disease",
    name: "Atherosclerotic heart disease of native coronary artery",
    icd10: "I25.10",
    snomed: "53741008",
    category: "cardiovascular",
    synonyms: ["cad", "coronary artery disease", "ischemic heart disease", "ihd"],
  },

  // ── Endocrine ─────────────────────────────────────────────────────────────
  {
    id: "type-2-diabetes",
    name: "Type 2 diabetes mellitus without complications",
    icd10: "E11.9",
    snomed: "44054006",
    category: "endocrine",
    synonyms: ["dm2", "t2dm", "type 2 diabetes", "diabetes", "sugar"],
    labPanelId: "diabetes",
  },
  {
    id: "type-1-diabetes",
    name: "Type 1 diabetes mellitus without complications",
    icd10: "E10.9",
    snomed: "46635009",
    category: "endocrine",
    synonyms: ["dm1", "t1dm", "type 1 diabetes", "juvenile diabetes"],
    labPanelId: "diabetes",
  },
  {
    id: "prediabetes",
    name: "Prediabetes",
    icd10: "R73.03",
    snomed: "714628002",
    category: "endocrine",
    synonyms: ["impaired glucose tolerance", "igt", "borderline diabetes"],
    labPanelId: "diabetes",
  },
  {
    id: "hypothyroidism",
    name: "Hypothyroidism, unspecified",
    icd10: "E03.9",
    snomed: "40930008",
    category: "endocrine",
    synonyms: ["underactive thyroid", "low thyroid", "hypothyroid"],
  },
  {
    id: "obesity",
    name: "Obesity, unspecified",
    icd10: "E66.9",
    snomed: "414916001",
    category: "endocrine",
    synonyms: ["overweight", "raised bmi", "obese"],
  },
  {
    id: "vitamin-d-deficiency",
    name: "Vitamin D deficiency, unspecified",
    icd10: "E55.9",
    snomed: "34713006",
    category: "endocrine",
    synonyms: ["low vitamin d", "vit d deficiency"],
  },

  // ── Gastrointestinal / hepatic ────────────────────────────────────────────
  {
    id: "elevated-liver-enzymes",
    name: "Elevated liver enzymes (abnormal LFTs)",
    icd10: "R74.01",
    snomed: "166603001",
    category: "gastrointestinal",
    synonyms: [
      "raised alt",
      "raised ast",
      "transaminitis",
      "abnormal lfts",
      "deranged lfts",
      "elevated transaminases",
      "liver enzyme elevation",
    ],
    labPanelId: "liver-enzyme-elevation",
    isWorkupFinding: true,
  },
  {
    id: "gerd",
    name: "Gastro-esophageal reflux disease without esophagitis",
    icd10: "K21.9",
    snomed: "235595009",
    category: "gastrointestinal",
    synonyms: ["gerd", "reflux", "acid reflux", "heartburn", "gord"],
  },
  {
    id: "nafld",
    name: "Nonalcoholic fatty liver disease",
    icd10: "K76.0",
    snomed: "197321007",
    category: "gastrointestinal",
    synonyms: ["nafld", "fatty liver", "hepatic steatosis", "masld"],
    labPanelId: "liver-enzyme-elevation",
  },
  {
    id: "chronic-hepatitis-c",
    name: "Chronic viral hepatitis C without hepatic coma",
    icd10: "B18.2",
    snomed: "128302006",
    category: "gastrointestinal",
    synonyms: ["hep c", "hcv", "hepatitis c"],
    labPanelId: "liver-enzyme-elevation",
  },
  {
    id: "celiac-disease",
    name: "Celiac disease",
    icd10: "K90.0",
    snomed: "396331005",
    category: "gastrointestinal",
    synonyms: ["coeliac", "celiac", "gluten enteropathy", "sprue"],
  },

  // ── Hematologic ───────────────────────────────────────────────────────────
  {
    id: "iron-deficiency-anemia",
    name: "Iron deficiency anemia, unspecified",
    icd10: "D50.9",
    snomed: "87522002",
    category: "hematologic",
    synonyms: ["ida", "iron deficiency", "low iron", "low hemoglobin"],
    labPanelId: "anemia",
  },
  {
    id: "anemia-unspecified",
    name: "Anemia, unspecified",
    icd10: "D64.9",
    snomed: "271737000",
    category: "hematologic",
    synonyms: ["anemia", "anaemia", "low hb", "low haemoglobin"],
    labPanelId: "anemia",
    isWorkupFinding: true,
  },
  {
    id: "b12-deficiency-anemia",
    name: "Vitamin B12 deficiency anemia, unspecified",
    icd10: "D51.9",
    snomed: "52675002",
    category: "hematologic",
    synonyms: ["b12 deficiency", "pernicious anemia", "macrocytic anemia"],
    labPanelId: "anemia",
  },
  {
    id: "thalassemia-trait",
    name: "Thalassemia minor",
    icd10: "D56.3",
    snomed: "65959000",
    category: "hematologic",
    synonyms: ["thalassemia trait", "thal trait", "thalassaemia minor"],
    labPanelId: "anemia",
  },

  // ── Musculoskeletal / rheumatologic ───────────────────────────────────────
  {
    id: "osteoarthritis",
    name: "Osteoarthritis, unspecified site",
    icd10: "M19.90",
    snomed: "396275006",
    category: "musculoskeletal",
    synonyms: ["oa", "osteoarthritis", "degenerative joint disease", "djd", "wear and tear"],
  },
  {
    id: "rheumatoid-arthritis",
    name: "Rheumatoid arthritis, unspecified",
    icd10: "M06.9",
    snomed: "69896004",
    category: "musculoskeletal",
    synonyms: ["ra", "rheumatoid", "inflammatory arthritis"],
    labPanelId: "arthritis",
  },
  {
    id: "polyarthralgia",
    name: "Pain in unspecified joint (polyarthralgia)",
    icd10: "M25.50",
    snomed: "57676002",
    category: "musculoskeletal",
    synonyms: ["joint pain", "arthralgia", "aching joints", "polyarthralgia", "arthritis"],
    labPanelId: "arthritis",
    isWorkupFinding: true,
  },
  {
    id: "gout",
    name: "Gout, unspecified",
    icd10: "M10.9",
    snomed: "90560007",
    category: "musculoskeletal",
    synonyms: ["gout", "gouty arthritis", "podagra"],
    labPanelId: "arthritis",
  },
  {
    id: "systemic-lupus",
    name: "Systemic lupus erythematosus, unspecified",
    icd10: "M32.9",
    snomed: "55464009",
    category: "musculoskeletal",
    synonyms: ["sle", "lupus"],
    labPanelId: "arthritis",
  },
  {
    id: "ankylosing-spondylitis",
    name: "Ankylosing spondylitis of unspecified sites in spine",
    icd10: "M45.9",
    snomed: "9631008",
    category: "musculoskeletal",
    synonyms: ["as", "ankylosing spondylitis", "axial spondyloarthritis", "axspa"],
    labPanelId: "arthritis",
  },
  {
    id: "osteoporosis",
    name: "Age-related osteoporosis without current pathological fracture",
    icd10: "M81.0",
    snomed: "64859006",
    category: "musculoskeletal",
    synonyms: ["osteoporosis", "thin bones", "low bone density"],
  },

  // ── Constitutional ────────────────────────────────────────────────────────
  {
    id: "fatigue",
    name: "Other fatigue",
    icd10: "R53.83",
    snomed: "84229001",
    category: "constitutional",
    synonyms: ["tiredness", "fatigue", "exhaustion", "low energy", "lethargy"],
    labPanelId: "fatigue",
    isWorkupFinding: true,
  },
  {
    id: "malaise",
    name: "Malaise",
    icd10: "R53.81",
    snomed: "367391008",
    category: "constitutional",
    synonyms: ["malaise", "generally unwell", "run down"],
    labPanelId: "fatigue",
    isWorkupFinding: true,
  },
  {
    id: "unintentional-weight-loss",
    name: "Abnormal weight loss",
    icd10: "R63.4",
    snomed: "89362005",
    category: "constitutional",
    synonyms: ["weight loss", "losing weight", "unintentional weight loss"],
    isWorkupFinding: true,
  },

  // ── Respiratory ───────────────────────────────────────────────────────────
  {
    id: "asthma",
    name: "Unspecified asthma, uncomplicated",
    icd10: "J45.909",
    snomed: "195967001",
    category: "respiratory",
    synonyms: ["asthma", "wheeze", "reactive airway"],
  },
  {
    id: "copd",
    name: "Chronic obstructive pulmonary disease, unspecified",
    icd10: "J44.9",
    snomed: "13645005",
    category: "respiratory",
    synonyms: ["copd", "emphysema", "chronic bronchitis"],
  },
  {
    id: "obstructive-sleep-apnea",
    name: "Obstructive sleep apnea (adult) (pediatric)",
    icd10: "G47.33",
    snomed: "78275009",
    category: "respiratory",
    synonyms: ["osa", "sleep apnea", "sleep apnoea", "snoring"],
    labPanelId: "fatigue",
  },

  // ── Renal ─────────────────────────────────────────────────────────────────
  {
    id: "ckd-stage-3a",
    name: "Chronic kidney disease, stage 3a",
    icd10: "N18.31",
    snomed: "700378005",
    category: "renal",
    synonyms: ["ckd", "chronic kidney disease", "renal impairment", "kidney disease"],
  },

  // ── Neurologic / psychiatric ──────────────────────────────────────────────
  {
    id: "migraine",
    name: "Migraine, unspecified, not intractable",
    icd10: "G43.909",
    snomed: "37796009",
    category: "neurologic",
    synonyms: ["migraine", "migrane", "headache"],
  },
  {
    id: "peripheral-neuropathy",
    name: "Polyneuropathy, unspecified",
    icd10: "G62.9",
    snomed: "302226006",
    category: "neurologic",
    synonyms: ["neuropathy", "peripheral neuropathy", "numbness", "tingling"],
    labPanelId: "fatigue",
  },
  {
    id: "major-depressive-disorder",
    name: "Major depressive disorder, single episode, unspecified",
    icd10: "F32.9",
    snomed: "370143000",
    category: "psychiatric",
    synonyms: ["depression", "mdd", "low mood", "depressive disorder"],
    labPanelId: "fatigue",
  },
  {
    id: "generalized-anxiety",
    name: "Generalized anxiety disorder",
    icd10: "F41.1",
    snomed: "21897009",
    category: "psychiatric",
    synonyms: ["gad", "anxiety", "anxious"],
  },

  // ── Infectious ────────────────────────────────────────────────────────────
  {
    id: "uti",
    name: "Urinary tract infection, site not specified",
    icd10: "N39.0",
    snomed: "68566005",
    category: "infectious",
    synonyms: ["uti", "urine infection", "bladder infection", "cystitis"],
  },
];

// ── Search ──────────────────────────────────────────────────────────────────

export interface DiagnosisSearchHit {
  entry: DiagnosisEntry;
  /** Higher is better. Exposed so callers can apply their own cutoff. */
  score: number;
  /** Which field produced the match — lets the UI show why a row is listed. */
  matchedOn: "code" | "name" | "synonym";
}

/** Normalise for matching: lowercase, collapse whitespace, drop punctuation. */
function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise an ICD-10 code for comparison by removing every non-alphanumeric
 * character. Clinicians write the same code as "M10.9", "M109", and "m10.9";
 * the general `norm` turns the dot into a space, so "M10.9" would never match
 * a stored "M109". Codes need their own rule.
 */
function normCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Search the catalog for an autocomplete control.
 *
 * Ranking, highest first:
 *   100  exact ICD-10 code
 *    90  name starts with the query
 *    80  synonym exactly equals the query  ("htn", "dm2")
 *    70  synonym starts with the query
 *    50  name contains the query
 *    40  synonym contains the query
 *
 * Exact synonym outranks name-prefix on purpose: someone typing "af" means
 * atrial fibrillation, and burying it under every condition whose name starts
 * with those letters is how a pick list becomes slower than free text.
 */
export function searchDiagnoses(
  query: string,
  opts: { limit?: number; category?: DiagnosisCategory } = {},
): DiagnosisSearchHit[] {
  const q = norm(query);
  if (!q) return [];

  const qCode = normCode(query);
  const limit = opts.limit ?? 10;
  const hits: DiagnosisSearchHit[] = [];

  for (const entry of DIAGNOSIS_CATALOG) {
    if (opts.category && entry.category !== opts.category) continue;

    const name = norm(entry.name);
    const code = normCode(entry.icd10);

    let score = 0;
    let matchedOn: DiagnosisSearchHit["matchedOn"] = "name";

    if (code === qCode) {
      score = 100;
      matchedOn = "code";
    } else if (name.startsWith(q)) {
      score = 90;
    } else {
      // Best synonym match wins; a query can hit several.
      let synScore = 0;
      for (const syn of entry.synonyms) {
        const s = norm(syn);
        if (s === q) synScore = Math.max(synScore, 80);
        else if (s.startsWith(q)) synScore = Math.max(synScore, 70);
        else if (s.includes(q)) synScore = Math.max(synScore, 40);
      }
      if (name.includes(q)) {
        score = Math.max(synScore, 50);
        matchedOn = synScore > 50 ? "synonym" : "name";
      } else if (synScore > 0) {
        score = synScore;
        matchedOn = "synonym";
      }
    }

    if (score > 0) hits.push({ entry, score, matchedOn });
  }

  // Stable tie-break by name so the list does not reshuffle between keystrokes.
  hits.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.entry.name.localeCompare(b.entry.name),
  );

  return hits.slice(0, limit);
}

const BY_ID = new Map(DIAGNOSIS_CATALOG.map((d) => [d.id, d]));
const BY_ICD10 = new Map(DIAGNOSIS_CATALOG.map((d) => [normCode(d.icd10), d]));

export function getDiagnosis(id: string): DiagnosisEntry | null {
  return BY_ID.get(id) ?? null;
}

export function getDiagnosisByIcd10(code: string): DiagnosisEntry | null {
  return BY_ICD10.get(normCode(code)) ?? null;
}

export function listDiagnosisCategories(): DiagnosisCategory[] {
  return Array.from(new Set(DIAGNOSIS_CATALOG.map((d) => d.category))).sort();
}

/** The lab panel that belongs with a diagnosis, if any. */
export function suggestedPanelFor(diagnosisId: string): LabPanelId | null {
  return getDiagnosis(diagnosisId)?.labPanelId ?? null;
}

/** Structural checks, run as a test rather than at import. */
export function validateDiagnosisCatalog(): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenIcd = new Set<string>();

  for (const d of DIAGNOSIS_CATALOG) {
    if (seenIds.has(d.id)) problems.push(`duplicate id: ${d.id}`);
    seenIds.add(d.id);

    if (seenIcd.has(d.icd10)) problems.push(`duplicate ICD-10: ${d.icd10} (${d.id})`);
    seenIcd.add(d.icd10);

    // ICD-10-CM: letter, 2 digits, then optional .subcategory of 1-4 chars.
    if (!/^[A-TV-Z][0-9][0-9AB](\.[0-9A-Z]{1,4})?$/.test(d.icd10)) {
      problems.push(`${d.id}: "${d.icd10}" is not a well-formed ICD-10-CM code`);
    }
    if (d.snomed && !/^\d{6,18}$/.test(d.snomed)) {
      problems.push(`${d.id}: "${d.snomed}" is not a well-formed SNOMED CT id`);
    }
    if (d.synonyms.length === 0) {
      problems.push(`${d.id}: has no synonyms, so it is unfindable by abbreviation`);
    }
  }

  return problems;
}
