/**
 * Attested note to an ABDM OP Consultation Record.
 *
 * The EOI's fourth requirement is that the scribe generate "structured,
 * editable and interoperable ABDM-enabled health records". This file is the
 * interoperable half: it turns a note a clinician has signed into a FHIR
 * document Bundle shaped for the ABDM OP Consultation Record, so it can be
 * linked to an ABHA address and served over the Health Information Provider
 * flows the rest of the world EHR work already anticipates.
 *
 * It reuses `shared/ips.ts` types rather than defining a parallel FHIR model.
 * ABDM's profiles are FHIR R4 constraints, not a different standard, and a
 * second set of types would drift from the first.
 *
 * ## Only an attested note is exchangeable
 *
 * `buildOpConsultBundle` takes an attestation and refuses without one. This is
 * the hard boundary the whole module is built around, restated at the point it
 * would otherwise be crossed: a draft is a machine's reading of a conversation,
 * and putting one into a national exchange makes it a clinical record authored
 * by nobody. Every consumer downstream — another hospital, an insurer under
 * NHCX, the patient's own PHR — will read `Composition.author` and take it at
 * face value, so that field must name a human who actually reviewed the
 * content.
 *
 * ## What is asserted here and what is not
 *
 * The profile URLs and the composition type code below are recorded from the
 * NRCeS ABDM FHIR implementation guide, and this repository has not validated
 * them against the published package — the IG is versioned and revised, and no
 * copy is bundled. So:
 *
 * - `Composition.type` carries the OP Consultation Record code, because a
 *   Composition without a type is not a valid document and omitting it would
 *   produce a bundle that fails validation everywhere rather than one that is
 *   right most places.
 * - **Section codes are omitted unless an IG map is supplied.** They are
 *   optional in base FHIR, and a wrong section code is worse than none: a
 *   receiving system files the content under the wrong heading and the error is
 *   invisible, whereas a missing code degrades to "an untyped section with a
 *   title", which a human reads correctly.
 *
 * `bundleAssurance` reports which of the two situations produced the bundle, so
 * a caller never has to infer it from the absence of a field. The same posture
 * as the health passport's `keyTrust`: report the trust level rather than
 * letting a successful return imply one.
 */

import { randomUUID } from "node:crypto";
import type {
  IpsBundle,
  IpsBundleEntry,
  IpsComposition,
  IpsCompositionSection,
  IpsResource,
} from "@shared/ips";
import type {
  Attestation,
  NoteItem,
  NoteSection,
  ScribeNoteDraft,
  SectionStatus,
} from "@shared/ambient-scribe";
import { escapeXhtml } from "../world/ips-generator";

/**
 * NRCeS ABDM R4 profile identifiers.
 *
 * Recorded from the implementation guide, not validated against a bundled
 * copy. A deployment integrating for real overrides these from the IG package
 * it actually validates against.
 */
export const ABDM_PROFILE = {
  OP_CONSULT_RECORD:
    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultRecord",
  COMPOSITION: "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Composition",
  PATIENT: "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient",
  PRACTITIONER: "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner",
} as const;

/** SNOMED CT concept for a clinical consultation report. */
const OP_CONSULT_TYPE = {
  coding: [
    {
      system: "http://snomed.info/sct",
      code: "371530004",
      display: "Clinical consultation report",
    },
  ],
  text: "OP Consultation Record",
};

/**
 * Optional section coding, supplied by a deployment from its validated IG.
 *
 * Keyed by our internal section. Absent entries produce an uncoded section.
 */
export type SectionCodeMap = Partial<
  Record<NoteSection, { system: string; code: string; display: string }>
>;

/** Human-facing titles. Chosen to match how the ABDM sections are named. */
const SECTION_TITLE: Record<NoteSection, string> = {
  subjective: "Chief complaints and history",
  objective: "Physical examination and observations",
  assessment: "Assessment",
  plan: "Plan, medications and advice",
};

/**
 * What a section says when it holds nothing.
 *
 * The rule this repository applies to an empty allergy list, applied to every
 * section of a consultation note, and it matters more here: a receiving
 * clinician opening an exchanged OP Consultation Record has no other source. An
 * absent Assessment section rendered as blank reads as "nothing was wrong".
 */
const EMPTY_NARRATIVE: Record<Exclude<SectionStatus, "populated">, string> = {
  "not-discussed":
    "Not discussed in this consultation. This is absence of information, not a negative finding.",
  "explicitly-negative":
    "Discussed; the findings recorded were negative. See entries below.",
};

export interface OpConsultInput {
  draft: ScribeNoteDraft;
  attestation: Attestation;
  patient: {
    /** Internal profile id. The ABHA address is attached by the HIP layer. */
    id: string;
    name: string;
  };
  practitioner: {
    id: string;
    name: string;
  };
  /** Overrides the unvalidated defaults above. */
  profiles?: Partial<typeof ABDM_PROFILE>;
  sectionCodes?: SectionCodeMap;
  now?: Date;
}

export type BundleAssurance = "ig-validated-codes" | "titles-only";

export interface OpConsultResult {
  bundle: IpsBundle;
  /**
   * `titles-only` means section codes were omitted because no IG map was
   * supplied. Reported rather than left to be inferred from the payload.
   */
  assurance: BundleAssurance;
  caveats: readonly string[];
}

export class NotAttestedError extends Error {
  readonly reason = "not-attested" as const;
}

function narrative(html: string) {
  return { status: "generated" as const, div: `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>` };
}

function itemsHtml(items: readonly NoteItem[]): string {
  const rows = items
    .map((i) => {
      const code = i.code ? ` <em>(${escapeXhtml(i.code.system)}#${escapeXhtml(i.code.code)})</em>` : "";
      const edited = i.edited ? " <em>[edited by clinician]</em>" : "";
      return `<li>${escapeXhtml(i.text)}${code}${edited}</li>`;
    })
    .join("");
  return `<ul>${rows}</ul>`;
}

/**
 * Build the document.
 *
 * Throws `NotAttestedError` rather than returning a refusal object, because
 * there is no sensible partial result: a caller that reached here without an
 * attestation has a bug, not a condition to handle, and returning something
 * bundle-shaped would invite it to be sent.
 */
export function buildOpConsultBundle(input: OpConsultInput): OpConsultResult {
  const { draft, attestation, patient, practitioner } = input;

  if (!attestation.attestedBy || !attestation.attestedAt) {
    throw new NotAttestedError(
      "Refusing to build an OP Consultation Record from an unattested draft. The bundle " +
        "names an author, and every downstream consumer reads that name as the clinician " +
        "who takes responsibility for the content.",
    );
  }

  const profiles = { ...ABDM_PROFILE, ...input.profiles };
  const sectionCodes = input.sectionCodes;
  const assurance: BundleAssurance = sectionCodes ? "ig-validated-codes" : "titles-only";
  const now = input.now ?? new Date();

  const patientResource: IpsResource = {
    resourceType: "Patient",
    id: patient.id,
    meta: { profile: [profiles.PATIENT] },
    name: [{ text: patient.name }],
  };

  const practitionerResource: IpsResource = {
    resourceType: "Practitioner",
    id: practitioner.id,
    meta: { profile: [profiles.PRACTITIONER] },
    name: [{ text: practitioner.name }],
  };

  const sections: IpsCompositionSection[] = (
    ["subjective", "objective", "assessment", "plan"] as const
  ).map((section) => {
    const items = draft.items.filter((i) => i.section === section);
    const status = draft.sectionStatus[section];
    const html =
      status === "populated"
        ? itemsHtml(items)
        : `<p>${escapeXhtml(EMPTY_NARRATIVE[status])}</p>${items.length > 0 ? itemsHtml(items) : ""}`;

    const coded = sectionCodes?.[section];
    return {
      title: SECTION_TITLE[section],
      // `code` is required by the IpsCompositionSection shape; when no IG map
      // was supplied we emit a text-only CodeableConcept, which is valid FHIR
      // and asserts nothing about which terminology heading this is.
      code: coded
        ? { coding: [{ system: coded.system, code: coded.code, display: coded.display }], text: SECTION_TITLE[section] }
        : { text: SECTION_TITLE[section] },
      text: narrative(html),
    };
  });

  const composition: IpsComposition = {
    resourceType: "Composition",
    id: randomUUID(),
    meta: { profile: [profiles.OP_CONSULT_RECORD] },
    status: "final",
    type: OP_CONSULT_TYPE,
    subject: { reference: `Patient/${patient.id}` },
    date: attestation.attestedAt,
    author: [{ reference: `Practitioner/${practitioner.id}` }],
    title: "OP Consultation Record",
    section: sections,
  };

  const entries: IpsBundleEntry[] = [
    { fullUrl: `urn:uuid:${composition.id}`, resource: composition },
    { fullUrl: `urn:uuid:${patient.id}`, resource: patientResource },
    { fullUrl: `urn:uuid:${practitioner.id}`, resource: practitionerResource },
  ];

  const bundle: IpsBundle = {
    resourceType: "Bundle",
    id: randomUUID(),
    type: "document",
    meta: { profile: [profiles.OP_CONSULT_RECORD] },
    identifier: { system: "urn:tabula-medica:id:op-consult", value: draft.sessionId },
    timestamp: now.toISOString(),
    entry: entries,
  };

  const caveats: string[] = [];
  if (assurance === "titles-only") {
    caveats.push(
      "Section headings carry titles but no terminology codes: no validated ABDM IG " +
        "section map was supplied. Pass `sectionCodes` from the NRCeS package this " +
        "deployment validates against before exchanging these documents.",
    );
  }
  if (draft.languageFallback) {
    caveats.push(
      `The note was rendered in English because no hand-written copy exists for ` +
        `"${draft.language}". The clinical content is unaffected; the section headings ` +
        "and empty-state warnings are not in the patient's language.",
    );
  }
  const uncoded = draft.items.filter((i) => !i.code).length;
  if (uncoded > 0) {
    caveats.push(
      `${uncoded} of ${draft.items.length} items carry text but no terminology code. ` +
        "They are exchangeable as narrative and are not machine-comparable.",
    );
  }

  return { bundle, assurance, caveats };
}
