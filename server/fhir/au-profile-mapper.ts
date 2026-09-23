/**
 * FHIR AU Base profile mapper.
 *
 * Converts between internal PHR rows (profiles + au_* extension tables) and
 * FHIR R4 resources conforming to:
 *   - AU Base Patient   http://hl7.org.au/fhir/StructureDefinition/au-patient
 *   - AU Base MedicationRequest  http://hl7.org.au/fhir/StructureDefinition/au-medicationrequest
 *   - AU Base Condition  http://hl7.org.au/fhir/StructureDefinition/au-condition
 *   - AU Base Coverage   http://hl7.org.au/fhir/StructureDefinition/au-coverage
 *
 * All URL constants are from the published AU Base IG (Jan 2024 edition).
 * Keep these in sync with https://build.fhir.org/ig/hl7au/au-fhir-base/
 */

import type {
  AuPatientIdentifiers,
  AuPatientDemographics,
  AuHealthCoverage,
  AuMedicationCodes,
  AuConditionCodes,
} from "../../shared/schema-au";

// ─── System URL constants ─────────────────────────────────────────────────────

export const AU_SYSTEMS = {
  IHI: "http://ns.electronichealth.net.au/id/hi/ihi/1.0",
  HPII: "http://ns.electronichealth.net.au/id/hi/hpii/1.0",
  HPIO: "http://ns.electronichealth.net.au/id/hi/hpio/1.0",
  MEDICARE: "http://ns.electronichealth.net.au/id/medicare-number",
  DVA: "http://ns.electronichealth.net.au/id/dva",
  CONCESSION_PCC: "http://ns.electronichealth.net.au/id/pensioner-concession-card",
  CONCESSION_HCC: "http://ns.electronichealth.net.au/id/health-care-card",
  CONCESSION_CSHC: "http://ns.electronichealth.net.au/id/commonwealth-seniors-health-card",

  PBS_ITEM: "http://pbs.gov.au/code/item",
  AMT_SNOMED: "http://snomed.info/sct",   // AU edition SNOMED CT
  ARTG: "http://www.tga.gov.au/artg",
  GTIN: "http://www.gs1.org/gtin",

  ICD10AM: "http://hl7.org/fhir/sid/icd-10-am",
  ACHI: "http://hl7.org/fhir/sid/achi",

  PATIENT_PROFILE: "http://hl7.org.au/fhir/StructureDefinition/au-patient",
  MED_REQUEST_PROFILE: "http://hl7.org.au/fhir/StructureDefinition/au-medicationrequest",
  CONDITION_PROFILE: "http://hl7.org.au/fhir/StructureDefinition/au-condition",
  COVERAGE_PROFILE: "http://hl7.org.au/fhir/StructureDefinition/au-coverage",
} as const;

// ─── AU Extension URLs ────────────────────────────────────────────────────────

export const AU_EXTENSIONS = {
  IHI_STATUS: "http://hl7.org.au/fhir/StructureDefinition/ihi-status",
  IHI_RECORD_STATUS: "http://hl7.org.au/fhir/StructureDefinition/ihi-record-status",
  DATE_ACCURACY: "http://hl7.org.au/fhir/StructureDefinition/date-accuracy-indicator",
  INDIGENOUS_STATUS: "http://hl7.org.au/fhir/StructureDefinition/indigenous-status",
  GENDER_IDENTITY: "http://hl7.org.au/fhir/StructureDefinition/gender-identity",
  SEX_AT_BIRTH: "http://hl7.org.au/fhir/StructureDefinition/individual-recorded-sex-or-gender",
  PBS_BENEFIT_TYPE: "http://hl7.org.au/fhir/StructureDefinition/pbs-benefit-type",
  PBS_ITEM_CODE: "http://hl7.org.au/fhir/StructureDefinition/pbs-item-code",
} as const;

// ─── Minimal FHIR R4 types (only fields we produce/consume) ──────────────────

interface FhirCoding {
  system: string;
  code: string;
  display?: string;
  version?: string;
}

interface FhirExtension {
  url: string;
  valueCode?: string;
  valueCoding?: FhirCoding;
  valueString?: string;
  valueBoolean?: boolean;
}

interface FhirIdentifier {
  type?: { coding: FhirCoding[] };
  system: string;
  value: string;
  extension?: FhirExtension[];
}

interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

// ─── AU Patient resource builder ─────────────────────────────────────────────

export interface AuPatientInput {
  profileId: string;
  fullName: string;
  dob: string;                       // ISO date
  preferredLanguage?: string;
  identifiers?: AuPatientIdentifiers | null;
  demographics?: AuPatientDemographics | null;
}

/**
 * Build FHIR AU Base Patient identifiers slice from AU identifier rows.
 *
 * The AU Base Patient IG constrains identifier to named slices:
 *   ihi, medicare, dva, hpii, hpio (plus generic fallback).
 */
export function buildAuPatientIdentifiers(
  ids: AuPatientIdentifiers,
): FhirIdentifier[] {
  const result: FhirIdentifier[] = [];

  if (ids.ihiNumberEnc) {
    const id: FhirIdentifier = {
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "NI", display: "National unique individual identifier" }] },
      system: AU_SYSTEMS.IHI,
      value: ids.ihiNumberEnc, // caller must decrypt before passing in
      extension: [],
    };
    if (ids.ihiStatus) {
      id.extension!.push({ url: AU_EXTENSIONS.IHI_STATUS, valueCode: ids.ihiStatus });
    }
    if (ids.ihiRecordStatus) {
      id.extension!.push({ url: AU_EXTENSIONS.IHI_RECORD_STATUS, valueCode: ids.ihiRecordStatus });
    }
    result.push(id);
  }

  if (ids.medicareNumberEnc) {
    // Medicare FHIR value = "XXXXXXXXXX/Y" (card number + IRN)
    const irn = ids.medicareIrn ?? "1";
    result.push({
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MC", display: "Patient's Medicare Number" }] },
      system: AU_SYSTEMS.MEDICARE,
      value: `${ids.medicareNumberEnc}/${irn}`,
    });
  }

  if (ids.dvaNumberEnc) {
    result.push({
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "DVA", display: "DVA Number" }] },
      system: AU_SYSTEMS.DVA,
      value: ids.dvaNumberEnc,
    });
  }

  if (ids.hpiiNumberEnc) {
    result.push({
      type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "NPI", display: "National provider identifier" }] },
      system: AU_SYSTEMS.HPII,
      value: ids.hpiiNumberEnc,
    });
  }

  return result;
}

/**
 * Build AU-specific extensions on the FHIR Patient resource.
 */
export function buildAuPatientExtensions(
  demographics: AuPatientDemographics,
): FhirExtension[] {
  const exts: FhirExtension[] = [];

  if (demographics.indigenousStatus) {
    // METEOR 602543 value set
    const codeMap: Record<string, { code: string; display: string }> = {
      aboriginal:             { code: "1", display: "Aboriginal but not Torres Strait Islander origin" },
      torres_strait_islander: { code: "2", display: "Torres Strait Islander but not Aboriginal origin" },
      both:                   { code: "3", display: "Both Aboriginal and Torres Strait Islander origin" },
      neither:                { code: "4", display: "Neither Aboriginal nor Torres Strait Islander origin" },
      not_stated:             { code: "9", display: "Not stated/inadequately described" },
    };
    const v = codeMap[demographics.indigenousStatus];
    if (v) {
      exts.push({
        url: AU_EXTENSIONS.INDIGENOUS_STATUS,
        valueCoding: {
          system: "https://healthterminologies.gov.au/fhir/CodeSystem/australian-indigenous-status-1",
          code: v.code,
          display: v.display,
        },
      });
    }
  }

  if (demographics.genderIdentity) {
    exts.push({
      url: AU_EXTENSIONS.GENDER_IDENTITY,
      valueString: demographics.genderIdentity,
    });
  }

  if (demographics.sexAssignedAtBirth) {
    exts.push({
      url: AU_EXTENSIONS.SEX_AT_BIRTH,
      valueCode: demographics.sexAssignedAtBirth,
    });
  }

  if (demographics.dobAccuracy && demographics.dobAccuracy !== "AAA") {
    exts.push({
      url: AU_EXTENSIONS.DATE_ACCURACY,
      valueCoding: {
        system: "https://healthterminologies.gov.au/fhir/CodeSystem/date-accuracy-indicator-1",
        code: demographics.dobAccuracy,
      },
    });
  }

  return exts;
}

/**
 * Build a FHIR AU Base Patient resource.
 * Returns a plain object ready to serialise as FHIR JSON.
 */
export function toFhirAuPatient(input: AuPatientInput): Record<string, unknown> {
  const patient: Record<string, unknown> = {
    resourceType: "Patient",
    meta: { profile: [AU_SYSTEMS.PATIENT_PROFILE] },
    id: input.profileId,
    name: [parseAuName(input.fullName)],
    birthDate: input.dob,
  };

  const identifiers: FhirIdentifier[] = [];
  const extensions: FhirExtension[] = [];

  if (input.identifiers) {
    identifiers.push(...buildAuPatientIdentifiers(input.identifiers));
  }
  if (input.demographics) {
    extensions.push(...buildAuPatientExtensions(input.demographics));

    if (input.demographics.addressLine1) {
      patient.address = [
        {
          use: "home",
          line: [
            input.demographics.addressLine1,
            input.demographics.addressLine2,
          ].filter(Boolean),
          city: input.demographics.suburb,
          state: input.demographics.state,
          postalCode: input.demographics.postcode,
          country: input.demographics.country ?? "AU",
        },
      ];
    }

    if (input.demographics.mobilePhone || input.demographics.homePhone) {
      patient.telecom = [
        input.demographics.mobilePhone && { system: "phone", value: input.demographics.mobilePhone, use: "mobile" },
        input.demographics.homePhone && { system: "phone", value: input.demographics.homePhone, use: "home" },
      ].filter(Boolean);
    }
  }

  if (identifiers.length) patient.identifier = identifiers;
  if (extensions.length) patient.extension = extensions;

  if (input.preferredLanguage) {
    patient.communication = [
      { language: { coding: [{ system: "urn:ietf:bcp:47", code: input.preferredLanguage }] }, preferred: true },
    ];
  }

  return patient;
}

// ─── AU MedicationRequest builder ────────────────────────────────────────────

export interface AuMedRequestInput {
  medicationId: string;
  profileId: string;
  medicationName: string;
  dose?: string;
  frequency?: string;
  status: string;
  startDate?: string;
  auCodes?: AuMedicationCodes | null;
}

/**
 * Build a FHIR AU Base MedicationRequest.
 * Prefers AMT CTPP (most specific) → TPP → MPP → free-text name.
 */
export function toFhirAuMedicationRequest(
  input: AuMedRequestInput,
): Record<string, unknown> {
  const coding: FhirCoding[] = [];
  const extensions: FhirExtension[] = [];

  if (input.auCodes) {
    // AMT hierarchy — most to least specific
    const amtSctId =
      input.auCodes.amtCtppSctId ??
      input.auCodes.amtTppSctId ??
      input.auCodes.amtMppSctId;

    if (amtSctId) {
      coding.push({
        system: AU_SYSTEMS.AMT_SNOMED,
        code: amtSctId,
        display: input.auCodes.amtTgaApprovedName ?? input.medicationName,
      });
    }

    if (input.auCodes.pbsItemCode) {
      coding.push({
        system: AU_SYSTEMS.PBS_ITEM,
        code: input.auCodes.pbsItemCode,
      });
      if (input.auCodes.pbsBenefitType) {
        extensions.push({
          url: AU_EXTENSIONS.PBS_BENEFIT_TYPE,
          valueCode: input.auCodes.pbsBenefitType,
        });
      }
    }

    if (input.auCodes.artgId) {
      coding.push({ system: AU_SYSTEMS.ARTG, code: input.auCodes.artgId });
    }
  }

  // Always include a text fallback so display works without AU codes
  const medicationCodeableConcept: FhirCodeableConcept = {
    coding: coding.length ? coding : [],
    text: input.auCodes?.amtTgaApprovedName ?? input.medicationName,
  };

  const resource: Record<string, unknown> = {
    resourceType: "MedicationRequest",
    meta: { profile: [AU_SYSTEMS.MED_REQUEST_PROFILE] },
    id: input.medicationId,
    status: fhirMedStatus(input.status),
    intent: "order",
    subject: { reference: `Patient/${input.profileId}` },
    medicationCodeableConcept,
    authoredOn: input.startDate,
  };

  if (input.dose || input.frequency) {
    resource.dosageInstruction = [
      {
        text: [input.dose, input.frequency].filter(Boolean).join(" "),
        ...(input.frequency && {
          timing: { code: { text: input.frequency } },
        }),
        ...(input.dose && {
          doseAndRate: [{ doseQuantity: { value: parseDoseValue(input.dose), unit: parseDoseUnit(input.dose) } }],
        }),
      },
    ];
  }

  if (extensions.length) resource.extension = extensions;
  return resource;
}

// ─── AU Condition builder ─────────────────────────────────────────────────────

export interface AuConditionInput {
  conditionId: string;
  profileId: string;
  conditionName: string;
  status: string;
  diagnosedDate?: string;
  auCodes?: AuConditionCodes | null;
}

/**
 * Build a FHIR AU Base Condition.
 * Codes: ICD-10-AM takes precedence; SNOMED CT-AU as additional coding.
 */
export function toFhirAuCondition(
  input: AuConditionInput,
): Record<string, unknown> {
  const coding: FhirCoding[] = [];

  if (input.auCodes?.icd10amCode) {
    coding.push({
      system: AU_SYSTEMS.ICD10AM,
      code: input.auCodes.icd10amCode,
      display: input.auCodes.icd10amDisplay ?? input.conditionName,
      ...(input.auCodes.icd10amEdition && { version: input.auCodes.icd10amEdition }),
    });
  }

  if (input.auCodes?.snomedSctId) {
    coding.push({
      system: AU_SYSTEMS.AMT_SNOMED,
      code: input.auCodes.snomedSctId,
      display: input.auCodes.snomedDisplay ?? input.conditionName,
    });
  }

  return {
    resourceType: "Condition",
    meta: { profile: [AU_SYSTEMS.CONDITION_PROFILE] },
    id: input.conditionId,
    subject: { reference: `Patient/${input.profileId}` },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: fhirCondStatus(input.status) }],
    },
    code: {
      coding: coding.length ? coding : [],
      text: input.conditionName,
    },
    ...(input.diagnosedDate && { onsetDateTime: input.diagnosedDate }),
  };
}

// ─── AU Coverage builder ──────────────────────────────────────────────────────

export interface AuCoverageInput {
  coverageId: string;
  profileId: string;
  coverage: AuHealthCoverage;
}

/**
 * Build a FHIR AU Base Coverage resource.
 */
export function toFhirAuCoverage(
  input: AuCoverageInput,
): Record<string, unknown> {
  const { coverage } = input;

  // Map AU coverage type to FHIR Coverage.type
  const typeMap: Record<string, FhirCoding> = {
    medicare:        { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "PUBLICPOL", display: "Public Healthcare" },
    pbs:             { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "DRUGPOL",   display: "Drug Policy" },
    private_hospital:{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HIP",       display: "Health Insurance Plan" },
    private_extras:  { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HIP",       display: "Health Insurance Plan (Extras)" },
    dva:             { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "PUBLICPOL", display: "DVA" },
  };

  const resource: Record<string, unknown> = {
    resourceType: "Coverage",
    meta: { profile: [AU_SYSTEMS.COVERAGE_PROFILE] },
    id: input.coverageId,
    status: coverage.isActive ? "active" : "cancelled",
    beneficiary: { reference: `Patient/${input.profileId}` },
    type: { coding: [typeMap[coverage.coverageType] ?? { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HIP" }] },
  };

  if (coverage.insurerName) {
    resource.payor = [{ display: coverage.insurerName }];
  }

  if (coverage.membershipNumber || coverage.policyNumber) {
    resource.subscriberId = coverage.membershipNumber ?? coverage.policyNumber;
  }

  if (coverage.effectiveDate || coverage.terminationDate) {
    resource.period = {
      ...(coverage.effectiveDate && { start: coverage.effectiveDate }),
      ...(coverage.terminationDate && { end: coverage.terminationDate }),
    };
  }

  return resource;
}

// ─── Inbound: parse AU FHIR Patient → AU identifier rows ─────────────────────

/**
 * Extract AU identifiers from an inbound FHIR AU Patient resource.
 * Call this when ingesting from MyHR or AU GP software FHIR endpoints.
 */
export function fromFhirAuPatientIdentifiers(
  patient: Record<string, unknown>,
): Partial<AuPatientIdentifiers> {
  const identifiers = (patient.identifier as FhirIdentifier[] | undefined) ?? [];
  const result: Partial<AuPatientIdentifiers> = {};

  for (const id of identifiers) {
    switch (id.system) {
      case AU_SYSTEMS.IHI: {
        result.ihiNumberEnc = id.value; // caller encrypts before storing
        const statusExt = id.extension?.find(e => e.url === AU_EXTENSIONS.IHI_STATUS);
        const recordExt = id.extension?.find(e => e.url === AU_EXTENSIONS.IHI_RECORD_STATUS);
        if (statusExt?.valueCode) result.ihiStatus = statusExt.valueCode as AuPatientIdentifiers["ihiStatus"];
        if (recordExt?.valueCode) result.ihiRecordStatus = recordExt.valueCode as AuPatientIdentifiers["ihiRecordStatus"];
        break;
      }
      case AU_SYSTEMS.MEDICARE: {
        // Value is "XXXXXXXXXX/Y"
        const [num, irn] = id.value.split("/");
        result.medicareNumberEnc = num;
        result.medicareIrn = irn ?? "1";
        break;
      }
      case AU_SYSTEMS.DVA: {
        result.dvaNumberEnc = id.value;
        break;
      }
      case AU_SYSTEMS.HPII: {
        result.hpiiNumberEnc = id.value;
        break;
      }
      case AU_SYSTEMS.HPIO: {
        result.hpioNumberEnc = id.value;
        break;
      }
    }
  }

  return result;
}

/**
 * Extract AU demographics extensions from an inbound FHIR AU Patient.
 */
export function fromFhirAuPatientDemographics(
  patient: Record<string, unknown>,
): Partial<AuPatientDemographics> {
  const extensions = (patient.extension as FhirExtension[] | undefined) ?? [];
  const result: Partial<AuPatientDemographics> = {};

  for (const ext of extensions) {
    switch (ext.url) {
      case AU_EXTENSIONS.INDIGENOUS_STATUS:
        if (ext.valueCoding) {
          const codeMap: Record<string, AuPatientDemographics["indigenousStatus"]> = {
            "1": "aboriginal",
            "2": "torres_strait_islander",
            "3": "both",
            "4": "neither",
            "9": "not_stated",
          };
          result.indigenousStatus = codeMap[ext.valueCoding.code] ?? "not_stated";
        }
        break;
      case AU_EXTENSIONS.GENDER_IDENTITY:
        result.genderIdentity = ext.valueString;
        break;
      case AU_EXTENSIONS.DATE_ACCURACY:
        if (ext.valueCoding?.code) {
          result.dobAccuracy = ext.valueCoding.code as AuPatientDemographics["dobAccuracy"];
        }
        break;
    }
  }

  // Address
  const addresses = (patient.address as Record<string, unknown>[] | undefined) ?? [];
  const home = addresses.find(a => a.use === "home") ?? addresses[0];
  if (home) {
    const lines = home.line as string[] | undefined;
    result.addressLine1 = lines?.[0];
    result.addressLine2 = lines?.[1];
    result.suburb = home.city as string;
    result.state = home.state as AuPatientDemographics["state"];
    result.postcode = home.postalCode as string;
    result.country = (home.country as string) ?? "AU";
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAuName(fullName: string): Record<string, unknown> {
  const parts = fullName.trim().split(/\s+/);
  const family = parts.length > 1 ? parts.pop()! : fullName;
  return { use: "official", family, given: parts.length ? parts : undefined };
}

function fhirMedStatus(status: string): string {
  const map: Record<string, string> = {
    active: "active",
    inactive: "stopped",
    completed: "completed",
    cancelled: "cancelled",
    "on-hold": "on-hold",
  };
  return map[status] ?? "active";
}

function fhirCondStatus(status: string): string {
  const map: Record<string, string> = {
    active: "active",
    resolved: "resolved",
    inactive: "inactive",
    remission: "remission",
  };
  return map[status] ?? "active";
}

function parseDoseValue(dose: string): number | undefined {
  const m = dose.match(/^[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}

function parseDoseUnit(dose: string): string | undefined {
  const m = dose.match(/[a-zA-Z]+$/);
  return m ? m[0] : undefined;
}
