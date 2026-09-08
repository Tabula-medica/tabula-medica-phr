/**
 * World EHR — IPS conformance validator.
 *
 * Checks a Bundle against the structural rules of the HL7 International
 * Patient Summary IG that can be evaluated without a terminology server.
 * It is deliberately *not* a full FHIR validator: it does not resolve
 * ValueSets or check SNOMED CT membership, because doing so requires network
 * calls to a terminology service and a World EHR must be able to produce and
 * check a summary offline, in a clinic with no connectivity.
 *
 * What it does catch is the class of error that actually breaks cross-border
 * exchange in practice: a missing required section, an empty required section
 * with no absent/unknown entry, a dangling internal reference, a document
 * whose Composition is not the first entry.
 *
 * `validateIpsBundle` is pure and synchronous — safe to run on every produced
 * document, which is what `ips-routes.ts` does before handing one out.
 */

import {
  IPS_CODE_SYSTEM,
  IPS_DOCUMENT_TYPE,
  IPS_SECTIONS,
  REQUIRED_SECTION_KEYS,
  type IpsBundle,
  type IpsComposition,
  type IpsCompositionSection,
} from "@shared/ips";

export type IpsIssueSeverity = "error" | "warning";

export interface IpsIssue {
  severity: IpsIssueSeverity;
  /** Stable machine code, e.g. "required-section-missing". */
  code: string;
  /** FHIRPath-ish location, e.g. "Bundle.entry[0].resource.section[2]". */
  location: string;
  message: string;
}

export interface IpsValidationResult {
  /** True when there are no `error`-severity issues. Warnings do not block. */
  conformant: boolean;
  issues: IpsIssue[];
  /** Section keys actually present in the document. */
  sectionsPresent: string[];
  /** Required sections that carried an absent/unknown entry rather than data. */
  sectionsAssertedEmpty: string[];
}

function err(code: string, location: string, message: string): IpsIssue {
  return { severity: "error", code, location, message };
}

function warn(code: string, location: string, message: string): IpsIssue {
  return { severity: "warning", code, location, message };
}

const SECTION_BY_LOINC = new Map(IPS_SECTIONS.map((s) => [s.loinc, s]));

export function validateIpsBundle(bundle: IpsBundle): IpsValidationResult {
  const issues: IpsIssue[] = [];
  const sectionsPresent: string[] = [];
  const assertedEmpty: string[] = [];

  // ── Bundle-level ──────────────────────────────────────────────────────────
  if (bundle.resourceType !== "Bundle") {
    issues.push(
      err("not-a-bundle", "Bundle", `Expected a Bundle, got ${bundle.resourceType}.`),
    );
    return {
      conformant: false,
      issues,
      sectionsPresent,
      sectionsAssertedEmpty: assertedEmpty,
    };
  }

  if (bundle.type !== "document") {
    issues.push(
      err(
        "bundle-type",
        "Bundle.type",
        `An IPS must be a document Bundle; found type "${bundle.type}".`,
      ),
    );
  }
  if (!bundle.identifier?.value) {
    issues.push(
      err("bundle-identifier", "Bundle.identifier", "Bundle.identifier is required on an IPS document."),
    );
  }
  if (!bundle.timestamp) {
    issues.push(
      err("bundle-timestamp", "Bundle.timestamp", "Bundle.timestamp is required on an IPS document."),
    );
  }

  const entries = bundle.entry ?? [];
  if (entries.length === 0) {
    issues.push(err("bundle-empty", "Bundle.entry", "Bundle has no entries."));
    return {
      conformant: false,
      issues,
      sectionsPresent,
      sectionsAssertedEmpty: assertedEmpty,
    };
  }

  // ── Composition must be first ─────────────────────────────────────────────
  const first = entries[0].resource;
  if (first?.resourceType !== "Composition") {
    issues.push(
      err(
        "composition-not-first",
        "Bundle.entry[0]",
        "The first entry of a document Bundle must be the Composition.",
      ),
    );
    return {
      conformant: false,
      issues,
      sectionsPresent,
      sectionsAssertedEmpty: assertedEmpty,
    };
  }

  const composition = first as IpsComposition;

  if (composition.status !== "final") {
    issues.push(
      warn(
        "composition-status",
        "Composition.status",
        `Composition.status is "${composition.status}"; a shared summary is normally "final".`,
      ),
    );
  }

  const typeCode = composition.type?.coding?.[0];
  if (typeCode?.code !== IPS_DOCUMENT_TYPE.code) {
    issues.push(
      err(
        "composition-type",
        "Composition.type",
        `Composition.type must be LOINC ${IPS_DOCUMENT_TYPE.code} (${IPS_DOCUMENT_TYPE.display}).`,
      ),
    );
  }

  if (!composition.subject?.reference) {
    issues.push(
      err("composition-subject", "Composition.subject", "Composition.subject is required."),
    );
  }
  if (!composition.author || composition.author.length === 0) {
    issues.push(
      err("composition-author", "Composition.author", "Composition.author is required."),
    );
  }
  if (!composition.date) {
    issues.push(err("composition-date", "Composition.date", "Composition.date is required."));
  }

  // ── Referential integrity ─────────────────────────────────────────────────
  // Every urn:uuid reference inside the document must resolve to an entry in
  // the same Bundle. A document that points outside itself is not
  // self-contained, which defeats the entire purpose of the format.
  const fullUrls = new Set(entries.map((e) => e.fullUrl));
  const danglingRefs = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (
          key === "reference" &&
          typeof value === "string" &&
          value.startsWith("urn:uuid:") &&
          !fullUrls.has(value)
        ) {
          danglingRefs.add(value);
        } else {
          walk(value);
        }
      }
    }
  };
  walk(entries.map((e) => e.resource));

  Array.from(danglingRefs).forEach((r) => {
    issues.push(
      err(
        "dangling-reference",
        "Bundle.entry",
        `Reference "${r}" does not resolve to any entry in the document.`,
      ),
    );
  });

  // ── Patient present ───────────────────────────────────────────────────────
  const patient = entries.find((e) => e.resource?.resourceType === "Patient");
  if (!patient) {
    issues.push(err("no-patient", "Bundle.entry", "The document contains no Patient resource."));
  } else {
    const identifiers = (patient.resource as Record<string, unknown>).identifier;
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      issues.push(
        err(
          "patient-identifier",
          "Patient.identifier",
          "IPS requires at least one Patient.identifier.",
        ),
      );
    }
    if (!(patient.resource as Record<string, unknown>).birthDate) {
      issues.push(
        warn(
          "patient-birthdate",
          "Patient.birthDate",
          "Patient.birthDate is missing; receivers use it for identity matching.",
        ),
      );
    }
  }

  // ── Sections ──────────────────────────────────────────────────────────────
  const sections = composition.section ?? [];
  const seenKeys = new Set<string>();

  sections.forEach((section, i) => {
    const loc = `Composition.section[${i}]`;
    const loinc = section.code?.coding?.[0]?.code;
    const s = loinc ? SECTION_BY_LOINC.get(loinc) : undefined;

    if (!s) {
      issues.push(
        warn(
          "unknown-section",
          loc,
          `Section code "${loinc ?? "(none)"}" is not one of the IPS-defined sections.`,
        ),
      );
      return;
    }

    seenKeys.add(s.key);
    sectionsPresent.push(s.key);

    if (!section.text?.div) {
      issues.push(
        err(
          "section-narrative",
          `${loc}.text`,
          `Section "${s.title}" has no narrative; IPS sections must be human-readable.`,
        ),
      );
    }

    const entryCount = section.entry?.length ?? 0;
    if (entryCount === 0) {
      issues.push(
        err(
          "section-empty",
          `${loc}.entry`,
          `Section "${s.title}" has no entries. A required IPS section must carry at least an absent/unknown entry.`,
        ),
      );
      return;
    }

    if (s.conformance === "required" && detectAbsentAssertion(section, entries)) {
      assertedEmpty.push(s.key);
    }
  });

  for (const key of REQUIRED_SECTION_KEYS) {
    if (!seenKeys.has(key)) {
      const s = IPS_SECTIONS.find((x) => x.key === key);
      issues.push(
        err(
          "required-section-missing",
          "Composition.section",
          `Required IPS section "${s?.title ?? key}" (LOINC ${s?.loinc}) is missing.`,
        ),
      );
    }
  }

  return {
    conformant: issues.every((i) => i.severity !== "error"),
    issues,
    sectionsPresent,
    sectionsAssertedEmpty: assertedEmpty,
  };
}

/**
 * True when a section's single entry is an IPS absent/unknown assertion
 * ("no known allergies" and friends) rather than real clinical content.
 *
 * Resolved by following the reference into the Bundle rather than trusting a
 * marker on the section, so the answer reflects the resource that will
 * actually be transmitted — and so the check works on any conformant IPS,
 * not just documents this codebase produced.
 */
function detectAbsentAssertion(
  section: IpsCompositionSection,
  entries: IpsBundle["entry"],
): boolean {
  const refs = section.entry ?? [];
  if (refs.length !== 1) return false;
  const target = entries.find((e) => e.fullUrl === refs[0].reference);
  if (!target) return false;

  const resource = target.resource as Record<string, unknown>;
  const candidates = [resource.code, resource.medicationCodeableConcept];
  return candidates.some((c) => {
    const coding = (c as { coding?: Array<{ system?: string }> } | undefined)
      ?.coding;
    return coding?.some((x) => x.system === IPS_CODE_SYSTEM.ABSENT_UNKNOWN) ?? false;
  });
}
