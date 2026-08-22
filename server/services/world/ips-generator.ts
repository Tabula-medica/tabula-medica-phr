/**
 * World EHR — International Patient Summary generator.
 *
 * Turns a patient's PHR rows into a conformant HL7 IPS FHIR *document* Bundle
 * that a clinician in any country can open. See `shared/ips.ts` for why IPS
 * rather than US Core, and for the required-section rule this file enforces.
 *
 * The builder is split in two on purpose:
 *
 *   buildIpsBundle(input)      — PURE. No DB, no clock, no randomness beyond
 *                                what the caller injects. Fully unit-testable
 *                                and the only place document structure lives.
 *   collectIpsInput(profileId) — the I/O half: reads and decrypts PHR rows.
 *
 * Keeping `buildIpsBundle` pure matters for a document that is signed
 * downstream (`health-passport.ts`): the same input must produce byte-identical
 * output, or signatures stop verifying.
 */

import { eq } from "drizzle-orm";
import {
  profiles,
  medicationsTable,
  allergiesTable,
  medicalHistoryTable,
  vaccinesTable,
  surgeriesTable,
} from "@shared/schema";
import {
  ABSENT_UNKNOWN,
  IPS_CODE_SYSTEM,
  IPS_DOCUMENT_TYPE,
  IPS_PROFILE,
  IPS_SECTIONS,
  type IpsBundle,
  type IpsBundleEntry,
  type IpsCodeableConcept,
  type IpsComposition,
  type IpsCompositionSection,
  type IpsNarrative,
  type IpsResource,
  type IpsSectionKey,
  type IpsSectionSpec,
} from "@shared/ips";
import {
  resolveJurisdiction,
  validateHealthId,
  type Jurisdiction,
} from "@shared/jurisdictions";
import { phiDb, decryptPhiRows, decryptPhiRow } from "../../storage/phi-storage";

// ── Input shape (plain data — no DB types leak into the pure builder) ───────

export interface IpsPatientInput {
  id: string;
  fullName: string;
  /** ISO date, YYYY-MM-DD. */
  dob: string;
  gender?: "male" | "female" | "other" | "unknown";
  /** ISO 3166-1 alpha-2, e.g. "IN". Drives identifier + governance. */
  countryCode?: string;
  /** Raw national health identifier, e.g. an ABHA number. */
  nationalHealthId?: string;
  preferredLanguage?: string;
}

export interface IpsProblemInput {
  id: string;
  name: string;
  onsetDate?: string | null;
  status?: string | null;
  /** SNOMED CT code when known — IPS requires SNOMED as the primary coding. */
  snomedCode?: string | null;
  /** Local code (ICD-11 MMS, ICD-10-GM, …) per the patient's jurisdiction. */
  localCode?: string | null;
}

export interface IpsMedicationInput {
  id: string;
  name: string;
  dose?: string | null;
  frequency?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** WHO ATC code when known — the international drug classification. */
  atcCode?: string | null;
}

export interface IpsAllergyInput {
  id: string;
  allergen: string;
  reaction?: string | null;
  severity?: string | null;
  status?: string | null;
  onsetDate?: string | null;
  snomedCode?: string | null;
}

export interface IpsImmunizationInput {
  id: string;
  vaccineName: string;
  dateAdministered?: string | null;
  manufacturer?: string | null;
  lotNumber?: string | null;
  doseNumber?: number | null;
  /** SNOMED CT vaccine code. CVX is US-only and is not emitted. */
  snomedCode?: string | null;
}

export interface IpsProcedureInput {
  id: string;
  name: string;
  performedDate?: string | null;
  snomedCode?: string | null;
}

export interface IpsInput {
  patient: IpsPatientInput;
  problems: IpsProblemInput[];
  medications: IpsMedicationInput[];
  allergies: IpsAllergyInput[];
  immunizations: IpsImmunizationInput[];
  procedures: IpsProcedureInput[];
  /**
   * Document timestamp, ISO 8601. Injected rather than read from the clock so
   * the builder stays pure and its output stays reproducible.
   */
  timestamp: string;
  /** Stable document identifier, injected for the same reason. */
  documentId: string;
  /** Organisation asserting the summary, shown as Composition.author. */
  authorDisplay?: string;
}

// ── Narrative helpers ───────────────────────────────────────────────────────

/**
 * Escape text before it goes into the XHTML narrative. IPS documents are
 * rendered by receiving systems, so unescaped patient-controlled strings
 * (a medication note, an allergen name) would be a stored-XSS vector in
 * every downstream viewer.
 */
export function escapeXhtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function narrative(rowsHtml: string): IpsNarrative {
  return {
    status: "generated",
    div: `<div xmlns="http://www.w3.org/1999/xhtml">${rowsHtml}</div>`,
  };
}

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeXhtml(h)}</th>`).join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td>${escapeXhtml(c || "—")}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// ── Coding helpers ──────────────────────────────────────────────────────────

/**
 * Build a CodeableConcept, preferring SNOMED CT (IPS's required primary
 * terminology) and adding the jurisdiction's local system as a secondary
 * coding so an in-country system can also resolve it. `text` always carries
 * the human string, which is what makes the document readable when neither
 * code is present — the common case for patient-entered data.
 */
function concept(
  text: string,
  snomedCode?: string | null,
  localCode?: string | null,
  localSystem?: string,
): IpsCodeableConcept {
  const coding = [];
  if (snomedCode) {
    coding.push({
      system: IPS_CODE_SYSTEM.SNOMED_CT,
      code: snomedCode,
      display: text,
    });
  }
  if (localCode && localSystem) {
    coding.push({ system: localSystem, code: localCode, display: text });
  }
  return coding.length > 0 ? { coding, text } : { text };
}

function absentConcept(code: string, display: string): IpsCodeableConcept {
  return {
    coding: [{ system: IPS_CODE_SYSTEM.ABSENT_UNKNOWN, code, display }],
    text: display,
  };
}

/**
 * Map the PHR's free-text status onto the FHIR condition-clinical value set.
 * Anything unrecognised becomes "active": under-stating a resolved problem is
 * safe, silently dropping an active one is not.
 */
function clinicalStatus(raw?: string | null): IpsCodeableConcept {
  const v = (raw ?? "active").toLowerCase();
  const code =
    v === "resolved" || v === "inactive" || v === "remission" ? v : "active";
  return {
    coding: [{ system: IPS_CODE_SYSTEM.HL7_CONDITION_CLINICAL, code }],
  };
}

/** IPS AllergyIntolerance criticality is low | high | unable-to-assess. */
function criticality(severity?: string | null): string {
  const v = (severity ?? "").toLowerCase();
  if (v === "severe" || v === "life-threatening" || v === "high") return "high";
  if (v === "mild" || v === "low" || v === "moderate") return "low";
  return "unable-to-assess";
}

/** FHIR dates must be YYYY-MM-DD; drop anything we cannot make sense of. */
function fhirDate(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

// ── The pure builder ────────────────────────────────────────────────────────

interface SectionBuild {
  section: IpsCompositionSection;
  resources: IpsResource[];
}

function ref(resource: IpsResource) {
  return { reference: `urn:uuid:${resource.id}` };
}

function buildPatient(
  input: IpsPatientInput,
  jurisdiction: Jurisdiction,
): IpsResource {
  const identifiers: Array<Record<string, unknown>> = [];

  if (input.nationalHealthId) {
    const result = validateHealthId(jurisdiction, input.nationalHealthId);
    if (result.ok) {
      identifiers.push({
        system: result.system,
        value: result.normalized,
        type: { text: jurisdiction.healthId?.label },
      });
    }
    // A malformed national ID is intentionally omitted rather than emitted
    // as-is. Publishing an unverifiable identifier under an official naming
    // system is worse than publishing none: a receiver would treat it as
    // authoritative and could match the record to the wrong human.
  }

  // Every IPS Patient needs at least one identifier. When the jurisdiction has
  // no national scheme (or the value failed validation) fall back to the
  // record's own stable id under our namespace.
  if (identifiers.length === 0) {
    identifiers.push({
      system: "urn:tabula-medica:id:profile",
      value: input.id,
      type: { text: "Tabula Medica record identifier" },
    });
  }

  const [given, ...familyParts] = input.fullName.trim().split(/\s+/);
  const family = familyParts.join(" ");

  return {
    resourceType: "Patient",
    id: input.id,
    meta: { profile: [IPS_PROFILE.PATIENT] },
    identifier: identifiers,
    name: [
      {
        text: input.fullName,
        ...(family ? { family } : {}),
        given: [given],
      },
    ],
    gender: input.gender ?? "unknown",
    birthDate: fhirDate(input.dob),
    ...(input.preferredLanguage
      ? {
          communication: [
            {
              language: { coding: [{ code: input.preferredLanguage }] },
              preferred: true,
            },
          ],
        }
      : {}),
    ...(jurisdiction.code !== "ZZ"
      ? { address: [{ country: jurisdiction.code }] }
      : {}),
  };
}

function spec(key: IpsSectionKey): IpsSectionSpec {
  const found = IPS_SECTIONS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown IPS section: ${key}`);
  return found;
}

function sectionShell(
  key: IpsSectionKey,
  text: IpsNarrative,
): IpsCompositionSection {
  const s = spec(key);
  return {
    title: s.title,
    code: {
      coding: [
        { system: IPS_CODE_SYSTEM.LOINC, code: s.loinc, display: s.display },
      ],
    },
    text,
  };
}

function buildProblems(
  input: IpsInput,
  patientRef: { reference: string },
  jurisdiction: Jurisdiction,
): SectionBuild {
  if (input.problems.length === 0) {
    // Required section with no data: emit an explicit "no known problems"
    // Condition rather than an empty section. See shared/ips.ts.
    const placeholder: IpsResource = {
      resourceType: "Condition",
      id: `${input.documentId}-no-problems`,
      meta: { profile: [IPS_PROFILE.CONDITION] },
      clinicalStatus: {
        coding: [
          { system: IPS_CODE_SYSTEM.HL7_CONDITION_CLINICAL, code: "active" },
        ],
      },
      code: absentConcept(
        ABSENT_UNKNOWN.NO_KNOWN_PROBLEMS,
        "No known problems",
      ),
      subject: patientRef,
    };
    const section = sectionShell(
      "problems",
      narrative("<p>No known problems recorded.</p>"),
    );
    section.entry = [ref(placeholder)];
    return { section, resources: [placeholder] };
  }

  const resources = input.problems.map<IpsResource>((p) => ({
    resourceType: "Condition",
    id: p.id,
    meta: { profile: [IPS_PROFILE.CONDITION] },
    clinicalStatus: clinicalStatus(p.status),
    code: concept(
      p.name,
      p.snomedCode,
      p.localCode,
      jurisdiction.localProblemCodeSystem,
    ),
    subject: patientRef,
    ...(fhirDate(p.onsetDate) ? { onsetDateTime: fhirDate(p.onsetDate) } : {}),
  }));

  const section = sectionShell(
    "problems",
    narrative(
      table(
        ["Problem", "Onset", "Status"],
        input.problems.map((p) => [
          p.name,
          fhirDate(p.onsetDate) ?? "",
          p.status ?? "active",
        ]),
      ),
    ),
  );
  section.entry = resources.map(ref);
  return { section, resources };
}

function buildMedications(
  input: IpsInput,
  patientRef: { reference: string },
): SectionBuild {
  if (input.medications.length === 0) {
    const placeholder: IpsResource = {
      resourceType: "MedicationStatement",
      id: `${input.documentId}-no-medications`,
      meta: { profile: [IPS_PROFILE.MEDICATION_STATEMENT] },
      status: "unknown",
      medicationCodeableConcept: absentConcept(
        ABSENT_UNKNOWN.NO_KNOWN_MEDICATIONS,
        "No known medications",
      ),
      subject: patientRef,
      effectivePeriod: { start: input.timestamp },
    };
    const section = sectionShell(
      "medications",
      narrative("<p>No known medications recorded.</p>"),
    );
    section.entry = [ref(placeholder)];
    return { section, resources: [placeholder] };
  }

  const resources = input.medications.map<IpsResource>((m) => {
    const active = (m.status ?? "active").toLowerCase() === "active";
    return {
      resourceType: "MedicationStatement",
      id: m.id,
      meta: { profile: [IPS_PROFILE.MEDICATION_STATEMENT] },
      status: active ? "active" : "completed",
      medicationCodeableConcept: m.atcCode
        ? {
            coding: [
              {
                system: IPS_CODE_SYSTEM.ATC,
                code: m.atcCode,
                display: m.name,
              },
            ],
            text: m.name,
          }
        : { text: m.name },
      subject: patientRef,
      effectivePeriod: {
        ...(fhirDate(m.startDate) ? { start: fhirDate(m.startDate) } : {}),
        ...(fhirDate(m.endDate) ? { end: fhirDate(m.endDate) } : {}),
      },
      ...(m.dose || m.frequency
        ? {
            dosage: [
              { text: [m.dose, m.frequency].filter(Boolean).join(" — ") },
            ],
          }
        : {}),
    };
  });

  const section = sectionShell(
    "medications",
    narrative(
      table(
        ["Medication", "Dose", "Frequency", "Status"],
        input.medications.map((m) => [
          m.name,
          m.dose ?? "",
          m.frequency ?? "",
          m.status ?? "active",
        ]),
      ),
    ),
  );
  section.entry = resources.map(ref);
  return { section, resources };
}

function buildAllergies(
  input: IpsInput,
  patientRef: { reference: string },
): SectionBuild {
  if (input.allergies.length === 0) {
    const placeholder: IpsResource = {
      resourceType: "AllergyIntolerance",
      id: `${input.documentId}-no-allergies`,
      meta: { profile: [IPS_PROFILE.ALLERGY] },
      clinicalStatus: {
        coding: [
          { system: IPS_CODE_SYSTEM.HL7_ALLERGY_CLINICAL, code: "active" },
        ],
      },
      code: absentConcept(
        ABSENT_UNKNOWN.NO_KNOWN_ALLERGIES,
        "No known allergies",
      ),
      patient: patientRef,
    };
    const section = sectionShell(
      "allergies",
      narrative("<p>No known allergies recorded.</p>"),
    );
    section.entry = [ref(placeholder)];
    return { section, resources: [placeholder] };
  }

  const resources = input.allergies.map<IpsResource>((a) => ({
    resourceType: "AllergyIntolerance",
    id: a.id,
    meta: { profile: [IPS_PROFILE.ALLERGY] },
    clinicalStatus: {
      coding: [
        {
          system: IPS_CODE_SYSTEM.HL7_ALLERGY_CLINICAL,
          code: (a.status ?? "active").toLowerCase() === "resolved"
            ? "resolved"
            : "active",
        },
      ],
    },
    code: concept(a.allergen, a.snomedCode),
    patient: patientRef,
    criticality: criticality(a.severity),
    ...(fhirDate(a.onsetDate) ? { onsetDateTime: fhirDate(a.onsetDate) } : {}),
    ...(a.reaction
      ? { reaction: [{ manifestation: [{ text: a.reaction }] }] }
      : {}),
  }));

  const section = sectionShell(
    "allergies",
    narrative(
      table(
        ["Allergen", "Reaction", "Severity", "Status"],
        input.allergies.map((a) => [
          a.allergen,
          a.reaction ?? "",
          a.severity ?? "",
          a.status ?? "active",
        ]),
      ),
    ),
  );
  section.entry = resources.map(ref);
  return { section, resources };
}

function buildImmunizations(
  input: IpsInput,
  patientRef: { reference: string },
): SectionBuild | null {
  // Recommended section — omitted entirely when empty, which is conformant.
  if (input.immunizations.length === 0) return null;

  const resources = input.immunizations.map<IpsResource>((v) => ({
    resourceType: "Immunization",
    id: v.id,
    meta: { profile: [IPS_PROFILE.IMMUNIZATION] },
    status: "completed",
    vaccineCode: concept(v.vaccineName, v.snomedCode),
    patient: patientRef,
    ...(fhirDate(v.dateAdministered)
      ? { occurrenceDateTime: fhirDate(v.dateAdministered) }
      : { occurrenceString: "Date not recorded" }),
    ...(v.lotNumber ? { lotNumber: v.lotNumber } : {}),
    ...(v.manufacturer ? { manufacturer: { display: v.manufacturer } } : {}),
  }));

  const section = sectionShell(
    "immunizations",
    narrative(
      table(
        ["Vaccine", "Date", "Dose #"],
        input.immunizations.map((v) => [
          v.vaccineName,
          fhirDate(v.dateAdministered) ?? "",
          v.doseNumber != null ? String(v.doseNumber) : "",
        ]),
      ),
    ),
  );
  section.entry = resources.map(ref);
  return { section, resources };
}

function buildProcedures(
  input: IpsInput,
  patientRef: { reference: string },
): SectionBuild | null {
  if (input.procedures.length === 0) return null;

  const resources = input.procedures.map<IpsResource>((p) => ({
    resourceType: "Procedure",
    id: p.id,
    meta: { profile: [IPS_PROFILE.PROCEDURE] },
    status: "completed",
    code: concept(p.name, p.snomedCode),
    subject: patientRef,
    ...(fhirDate(p.performedDate)
      ? { performedDateTime: fhirDate(p.performedDate) }
      : {}),
  }));

  const section = sectionShell(
    "procedures",
    narrative(
      table(
        ["Procedure", "Date"],
        input.procedures.map((p) => [
          p.name,
          fhirDate(p.performedDate) ?? "",
        ]),
      ),
    ),
  );
  section.entry = resources.map(ref);
  return { section, resources };
}

/**
 * Build a conformant IPS document Bundle.
 *
 * Pure: identical input yields identical output, including key order, which
 * is what lets `health-passport.ts` sign the serialised document and have the
 * signature still verify after a round trip.
 */
export function buildIpsBundle(input: IpsInput): IpsBundle {
  const jurisdiction = resolveJurisdiction(input.patient.countryCode);
  const patient = buildPatient(input.patient, jurisdiction);
  const patientRef = ref(patient);

  const builds: SectionBuild[] = [
    buildProblems(input, patientRef, jurisdiction),
    buildMedications(input, patientRef),
    buildAllergies(input, patientRef),
  ];

  const optional = [
    buildImmunizations(input, patientRef),
    buildProcedures(input, patientRef),
  ].filter((b): b is SectionBuild => b !== null);

  builds.push(...optional);

  const composition: IpsComposition = {
    resourceType: "Composition",
    id: input.documentId,
    meta: { profile: [IPS_PROFILE.COMPOSITION] },
    status: "final",
    type: { coding: [{ ...IPS_DOCUMENT_TYPE }] },
    subject: patientRef,
    date: input.timestamp,
    author: [{ display: input.authorDisplay ?? "Tabula Medica (patient-held)" }],
    title: "International Patient Summary",
    section: builds.map((b) => b.section),
  };

  const entries: IpsBundleEntry[] = [
    { fullUrl: `urn:uuid:${composition.id}`, resource: composition },
    { fullUrl: `urn:uuid:${patient.id}`, resource: patient },
    ...builds.flatMap((b) =>
      b.resources.map((r) => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })),
    ),
  ];

  return {
    resourceType: "Bundle",
    id: input.documentId,
    meta: { profile: [IPS_PROFILE.BUNDLE] },
    type: "document",
    identifier: {
      system: "urn:tabula-medica:ips",
      value: input.documentId,
    },
    timestamp: input.timestamp,
    entry: entries,
  };
}

// ── The I/O half ────────────────────────────────────────────────────────────

/**
 * Read and decrypt everything the IPS needs for one profile.
 *
 * Every table touched here is in `PHI_COLUMN_MAP`, so reads go through
 * `phiDb` + `decryptPhiRow(s)` per the F1 encryption guardrail.
 */
export async function collectIpsInput(
  profileId: string,
  opts: { timestamp: string; documentId: string; countryCode?: string },
): Promise<IpsInput | null> {
  const [profileRow] = await phiDb
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profileRow) return null;
  const profile = decryptPhiRow("profiles", profileRow);

  const [medRows, allergyRows, historyRows, vaccineRows, surgeryRows] =
    await Promise.all([
      phiDb
        .select()
        .from(medicationsTable)
        .where(eq(medicationsTable.profileId, profileId)),
      phiDb
        .select()
        .from(allergiesTable)
        .where(eq(allergiesTable.profileId, profileId)),
      phiDb
        .select()
        .from(medicalHistoryTable)
        .where(eq(medicalHistoryTable.profileId, profileId)),
      phiDb
        .select()
        .from(vaccinesTable)
        .where(eq(vaccinesTable.profileId, profileId)),
      phiDb
        .select()
        .from(surgeriesTable)
        .where(eq(surgeriesTable.profileId, profileId)),
    ]);

  const medications = decryptPhiRows("medicationsTable", medRows);
  const allergies = decryptPhiRows("allergiesTable", allergyRows);
  const history = decryptPhiRows("medicalHistoryTable", historyRows);
  const vaccines = decryptPhiRows("vaccinesTable", vaccineRows);
  const surgeries = decryptPhiRows("surgeriesTable", surgeryRows);

  // Country and national health ID are patient-declared and live in the
  // profile's encrypted metadata blob; neither has a dedicated column yet.
  const metadata = (profile.metadata ?? {}) as Record<string, unknown>;
  const countryCode =
    opts.countryCode ??
    (typeof metadata.countryCode === "string" ? metadata.countryCode : undefined);
  const nationalHealthId =
    typeof metadata.nationalHealthId === "string"
      ? metadata.nationalHealthId
      : undefined;
  const gender =
    metadata.gender === "male" ||
    metadata.gender === "female" ||
    metadata.gender === "other"
      ? metadata.gender
      : "unknown";

  return {
    patient: {
      id: profile.id,
      fullName: profile.fullName,
      dob: String(profile.dob),
      gender,
      countryCode,
      nationalHealthId,
      preferredLanguage: profile.preferredLanguage,
    },
    problems: history.map((h) => ({
      id: h.id,
      name: h.condition,
      onsetDate: h.diagnosedDate,
      status: h.status,
    })),
    medications: medications.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose,
      frequency: m.frequency,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
    })),
    allergies: allergies.map((a) => ({
      id: a.id,
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity,
      status: a.status,
      onsetDate: a.onsetDate,
    })),
    immunizations: vaccines.map((v) => ({
      id: v.id,
      vaccineName: v.vaccineName,
      dateAdministered: v.dateAdministered,
      manufacturer: v.manufacturer,
      lotNumber: v.lotNumber,
      doseNumber: v.doseNumber,
    })),
    procedures: surgeries.map((s) => ({
      id: s.id,
      name: s.procedureName,
      performedDate: s.surgeryDate,
    })),
    timestamp: opts.timestamp,
    documentId: opts.documentId,
  };
}
