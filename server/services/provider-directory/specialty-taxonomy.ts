/**
 * Specialty → NPPES taxonomy mapping.
 *
 * NPPES indexes providers by NUCC taxonomy description, not by the words
 * patients and clinicians use. Searching NPPES for "heart doctor" returns
 * nothing; searching for "cardiology" returns nothing useful either, because
 * the actual taxonomy strings are "Internal Medicine, Cardiovascular Disease"
 * and friends. This table does the translation.
 *
 * Each specialty carries the taxonomy *search fragments* NPPES will match with
 * a trailing wildcard, plus the spoken forms a voice interface has to accept.
 */

export interface SpecialtyDefinition {
  id: string;
  /** Display name. */
  name: string;
  /**
   * Fragments passed to NPPES `taxonomy_description` with a trailing `*`.
   * The client queries every fragment and merges the results by NPI, because a
   * specialty maps onto more than one NUCC string. Ordered most specific
   * first: the first record seen for an NPI wins, so a provider matched by the
   * specific fragment keeps that taxonomy label.
   */
  taxonomyFragments: string[];
  /** Spoken and typed forms a user might offer, all lowercase. */
  synonyms: string[];
}

export const SPECIALTIES: readonly SpecialtyDefinition[] = [
  {
    id: "cardiology",
    name: "Cardiology",
    taxonomyFragments: ["Cardiovascular Disease", "Cardiology"],
    synonyms: ["cardiology", "cardiologist", "heart doctor", "heart specialist", "cardiac"],
  },
  {
    id: "dermatology",
    name: "Dermatology",
    taxonomyFragments: ["Dermatology"],
    synonyms: ["dermatology", "dermatologist", "skin doctor", "skin specialist"],
  },
  {
    id: "endocrinology",
    name: "Endocrinology",
    taxonomyFragments: ["Endocrinology, Diabetes & Metabolism", "Endocrinology"],
    synonyms: [
      "endocrinology",
      "endocrinologist",
      "diabetes doctor",
      "thyroid doctor",
      "hormone specialist",
    ],
  },
  {
    id: "gastroenterology",
    name: "Gastroenterology",
    taxonomyFragments: ["Gastroenterology"],
    synonyms: [
      "gastroenterology",
      "gastroenterologist",
      "gi",
      "gi doctor",
      "stomach doctor",
      "liver doctor",
      "hepatology",
    ],
  },
  {
    id: "hematology",
    name: "Hematology",
    taxonomyFragments: ["Hematology & Oncology", "Hematology"],
    synonyms: ["hematology", "hematologist", "haematology", "blood doctor", "blood specialist"],
  },
  {
    id: "nephrology",
    name: "Nephrology",
    taxonomyFragments: ["Nephrology"],
    synonyms: ["nephrology", "nephrologist", "kidney doctor", "kidney specialist", "renal"],
  },
  {
    id: "neurology",
    name: "Neurology",
    taxonomyFragments: ["Neurology"],
    synonyms: ["neurology", "neurologist", "nerve doctor", "brain doctor"],
  },
  {
    id: "oncology",
    name: "Oncology",
    taxonomyFragments: ["Medical Oncology", "Hematology & Oncology"],
    synonyms: ["oncology", "oncologist", "cancer doctor", "cancer specialist"],
  },
  {
    id: "ophthalmology",
    name: "Ophthalmology",
    taxonomyFragments: ["Ophthalmology"],
    synonyms: ["ophthalmology", "ophthalmologist", "eye doctor", "eye specialist"],
  },
  {
    id: "orthopedics",
    name: "Orthopedic Surgery",
    taxonomyFragments: ["Orthopaedic Surgery"],
    synonyms: [
      "orthopedics",
      "orthopedic",
      "orthopaedics",
      "orthopedic surgeon",
      "bone doctor",
      "joint doctor",
      "ortho",
    ],
  },
  {
    id: "pulmonology",
    name: "Pulmonology",
    taxonomyFragments: ["Pulmonary Disease"],
    synonyms: ["pulmonology", "pulmonologist", "lung doctor", "chest doctor", "respiratory"],
  },
  {
    id: "rheumatology",
    name: "Rheumatology",
    taxonomyFragments: ["Rheumatology"],
    synonyms: [
      "rheumatology",
      "rheumatologist",
      "arthritis doctor",
      "arthritis specialist",
      "joint specialist",
    ],
  },
  {
    id: "urology",
    name: "Urology",
    taxonomyFragments: ["Urology"],
    synonyms: ["urology", "urologist", "bladder doctor", "prostate doctor"],
  },
  {
    id: "psychiatry",
    name: "Psychiatry",
    taxonomyFragments: ["Psychiatry"],
    synonyms: ["psychiatry", "psychiatrist", "mental health doctor"],
  },
  {
    id: "general-surgery",
    name: "General Surgery",
    taxonomyFragments: ["Surgery"],
    synonyms: ["general surgery", "surgeon", "general surgeon"],
  },
  {
    id: "primary-care",
    name: "Primary Care",
    taxonomyFragments: ["Family Medicine", "Internal Medicine"],
    synonyms: [
      "primary care",
      "family medicine",
      "family doctor",
      "gp",
      "general practitioner",
      "internal medicine",
      "internist",
      "pcp",
    ],
  },
  {
    id: "obgyn",
    name: "Obstetrics & Gynecology",
    taxonomyFragments: ["Obstetrics & Gynecology"],
    synonyms: ["obgyn", "ob gyn", "gynecology", "gynecologist", "obstetrician", "womens health"],
  },
  {
    id: "allergy-immunology",
    name: "Allergy & Immunology",
    taxonomyFragments: ["Allergy & Immunology"],
    synonyms: ["allergy", "allergist", "immunology", "immunologist"],
  },
];

const BY_ID = new Map(SPECIALTIES.map((s) => [s.id, s]));

export function getSpecialty(id: string): SpecialtyDefinition | null {
  return BY_ID.get(id) ?? null;
}

/**
 * Resolve a spoken or typed phrase to a specialty.
 *
 * Built for voice input, where the transcript is a whole utterance rather than
 * a search box value: "find me a heart doctor nearby" must resolve to
 * cardiology. Matching therefore looks for a synonym *contained in* the
 * phrase, preferring the longest synonym so "heart specialist" is not
 * shadowed by a shorter accidental substring.
 *
 * Returns null when nothing matches, so the caller can ask again rather than
 * guessing a specialty and sending the patient to the wrong clinic.
 */
export function resolveSpecialty(phrase: string): SpecialtyDefinition | null {
  const p = phrase.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!p) return null;

  let best: { spec: SpecialtyDefinition; length: number } | null = null;

  for (const spec of SPECIALTIES) {
    for (const syn of spec.synonyms) {
      const isWholePhrase = p === syn;
      const isContained = p.includes(syn);
      if (!isWholePhrase && !isContained) continue;

      // Exact whole-phrase match wins outright.
      if (isWholePhrase) return spec;
      if (!best || syn.length > best.length) {
        best = { spec, length: syn.length };
      }
    }
  }

  return best?.spec ?? null;
}

export function listSpecialties(): Array<{ id: string; name: string }> {
  return SPECIALTIES.map((s) => ({ id: s.id, name: s.name }));
}
