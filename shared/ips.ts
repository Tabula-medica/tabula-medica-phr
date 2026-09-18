/**
 * World EHR — HL7 International Patient Summary (IPS) constants and types.
 *
 * The IPS (HL7 FHIR Implementation Guide `uv/ips`) is the WHO- and G7-backed
 * artefact for cross-border clinical exchange: a self-contained FHIR *document*
 * a clinician in any country can open and read, coded in globally-available
 * terminologies rather than national ones.
 *
 * This codebase already speaks USCDI/US Core, which is the correct answer
 * inside the United States and the wrong answer everywhere else — a
 * US Core bundle is coded in ICD-10-CM, RxNorm and CVX, none of which a
 * hospital in Pune, Lagos or Munich can resolve. IPS exists precisely to
 * remove that assumption, and nothing in this repository emitted one before:
 * `IPS` appeared only inside AI prompt strings, never as a generator.
 *
 * ── The rule that makes IPS hard ──
 * IPS defines three REQUIRED sections: Problems, Medication Summary, and
 * Allergies & Intolerances. "Required" is stronger than it sounds — a section
 * may not simply be omitted or left empty when the patient has no such data.
 * A conformant producer must state the absence explicitly, using the IPS
 * absent/unknown CodeSystem ("no known allergies", "no information about
 * medications", …). The distinction is clinically load-bearing: an empty
 * allergy section means "we never asked"; a `no-known-allergies` entry means
 * "we asked and the answer was none". Treating the first as the second is how
 * people get killed by a drug they were known to react to.
 *
 * This module holds the vocabulary; `server/services/ips-generator.ts` builds
 * the document and `server/services/ips-validator.ts` enforces conformance.
 */

// ── Profile canonicals ──────────────────────────────────────────────────────

export const IPS_PROFILE = {
  BUNDLE: "http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips",
  COMPOSITION:
    "http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips",
  PATIENT: "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
  CONDITION: "http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips",
  ALLERGY:
    "http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips",
  MEDICATION_STATEMENT:
    "http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips",
  IMMUNIZATION:
    "http://hl7.org/fhir/uv/ips/StructureDefinition/Immunization-uv-ips",
  PROCEDURE: "http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips",
} as const;

// ── Code systems beyond the US-centric set in fhir-r4.ts ────────────────────

export const IPS_CODE_SYSTEM = {
  LOINC: "http://loinc.org",
  SNOMED_CT: "http://snomed.info/sct",
  /** WHO ICD-11 MMS — the global successor to ICD-10, used outside the US. */
  ICD11_MMS: "http://id.who.int/icd/release/11/mms",
  /** WHO ATC — the international drug classification (RxNorm is US-only). */
  ATC: "http://www.whocc.no/atc",
  /** IPS absent/unknown codes for empty required sections. */
  ABSENT_UNKNOWN:
    "http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips",
  HL7_CONDITION_CLINICAL:
    "http://terminology.hl7.org/CodeSystem/condition-clinical",
  HL7_ALLERGY_CLINICAL:
    "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
  UCUM: "http://unitsofmeasure.org",
} as const;

/**
 * IPS absent/unknown codes. Used as the `code` of a placeholder resource when
 * a required section has no real entries. Each pairs with the resource type
 * the section carries.
 */
export const ABSENT_UNKNOWN = {
  NO_KNOWN_ALLERGIES: "no-known-allergies",
  NO_ALLERGY_INFO: "no-allergy-information",
  NO_KNOWN_MEDICATIONS: "no-known-medications",
  NO_MEDICATION_INFO: "no-medication-info",
  NO_KNOWN_PROBLEMS: "no-known-problems",
  NO_PROBLEM_INFO: "no-problem-info",
} as const;

/** LOINC code identifying the document itself. */
export const IPS_DOCUMENT_TYPE = {
  system: IPS_CODE_SYSTEM.LOINC,
  code: "60591-5",
  display: "Patient summary Document",
} as const;

// ── Sections ────────────────────────────────────────────────────────────────

export type IpsSectionKey =
  | "problems"
  | "medications"
  | "allergies"
  | "immunizations"
  | "procedures"
  | "results"
  | "vitalSigns"
  | "socialHistory";

export interface IpsSectionSpec {
  readonly key: IpsSectionKey;
  readonly title: string;
  readonly loinc: string;
  readonly display: string;
  /**
   * `required` sections must be present in every conformant IPS document and,
   * when empty, must carry an explicit absent/unknown entry.
   * `recommended` sections are included only when they have content.
   */
  readonly conformance: "required" | "recommended";
}

export const IPS_SECTIONS: readonly IpsSectionSpec[] = [
  {
    key: "problems",
    title: "Active Problems",
    loinc: "11450-4",
    display: "Problem list Reported",
    conformance: "required",
  },
  {
    key: "medications",
    title: "Medication Summary",
    loinc: "10160-0",
    display: "History of Medication use Narrative",
    conformance: "required",
  },
  {
    key: "allergies",
    title: "Allergies and Intolerances",
    loinc: "48765-2",
    display: "Allergies and adverse reactions Document",
    conformance: "required",
  },
  {
    key: "immunizations",
    title: "Immunizations",
    loinc: "11369-6",
    display: "History of Immunization Narrative",
    conformance: "recommended",
  },
  {
    key: "procedures",
    title: "History of Procedures",
    loinc: "47519-4",
    display: "History of Procedures Document",
    conformance: "recommended",
  },
  {
    key: "results",
    title: "Diagnostic Results",
    loinc: "30954-2",
    display: "Relevant diagnostic tests/laboratory data Narrative",
    conformance: "recommended",
  },
  {
    key: "vitalSigns",
    title: "Vital Signs",
    loinc: "8716-3",
    display: "Vital signs",
    conformance: "recommended",
  },
  {
    key: "socialHistory",
    title: "Social History",
    loinc: "29762-2",
    display: "Social history Narrative",
    conformance: "recommended",
  },
];

export const REQUIRED_SECTION_KEYS: readonly IpsSectionKey[] = IPS_SECTIONS
  .filter((s) => s.conformance === "required")
  .map((s) => s.key);

// ── Minimal structural types ────────────────────────────────────────────────
// Deliberately narrow: enough to build and validate an IPS document without
// pulling in a full FHIR type universe. `shared/fhir-r4.ts` holds the richer
// Zod-validated R4 resource schemas used elsewhere in the app.

export interface IpsCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface IpsCodeableConcept {
  coding?: IpsCoding[];
  text?: string;
}

export interface IpsReference {
  reference?: string;
  display?: string;
}

export interface IpsNarrative {
  status: "generated" | "extensions" | "additional" | "empty";
  div: string;
}

export interface IpsResource {
  resourceType: string;
  id: string;
  meta?: { profile?: string[] };
  text?: IpsNarrative;
  [key: string]: unknown;
}

export interface IpsCompositionSection {
  title: string;
  code: IpsCodeableConcept;
  text: IpsNarrative;
  entry?: IpsReference[];
}

export interface IpsComposition extends IpsResource {
  resourceType: "Composition";
  status: "final";
  type: IpsCodeableConcept;
  subject: IpsReference;
  date: string;
  author: IpsReference[];
  title: string;
  section: IpsCompositionSection[];
}

export interface IpsBundleEntry {
  fullUrl: string;
  resource: IpsResource;
}

export interface IpsBundle extends IpsResource {
  resourceType: "Bundle";
  type: "document";
  identifier: { system: string; value: string };
  timestamp: string;
  entry: IpsBundleEntry[];
}
