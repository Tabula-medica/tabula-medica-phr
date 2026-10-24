import { describe, expect, it } from "vitest";
import { resolveDeployment } from "../shared/deployment-region";
import { textDirection } from "../shared/i18n/direction";
import { createBilingualRecord, textForReader } from "../shared/i18n/bilingual";
import { assertPhiSpeechEngine, preferSpeechEngine } from "../shared/voice/policy";
import { textScaleFactor } from "../shared/a11y/preferences";
import { integrationById } from "../shared/devices/catalog";
import { toFhirObservation } from "../shared/devices/observation";
import { consentIsActive } from "../shared/devices/consent";
import { compareDemographics } from "../shared/identity/match";
import { regulatoryRoleFor } from "../shared/privacy/regulatory-role";
import {
  applySemanticDecision,
  hasExplicitOffset,
  reconcileRecords,
  sourceRecordCount,
  type IncomingFhirRecord,
} from "../shared/fhir/reconcile";

const RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm";
const LOINC = "http://loinc.org";

function record(overrides: Partial<IncomingFhirRecord> & Pick<IncomingFhirRecord, "source" | "sourceResourceId" | "clinicalClass">): IncomingFhirRecord {
  return {
    patientId: "patient-1",
    sourceSystem: "org-a",
    resourceType: "Observation",
    identifiers: [],
    codings: [],
    ...overrides,
  };
}

describe("deployment region", () => {
  it("keeps the US default, with Fasten independent of TEFCA", () => {
    expect(resolveDeployment({})).toEqual({
      region: "us",
      accepted: true,
      tefcaEnabled: true,
      fastenEnabled: true,
    });
    expect(resolveDeployment({ TEFCA_ENABLED: "false" })).toMatchObject({
      tefcaEnabled: false,
      fastenEnabled: true,
    });
  });

  it("turns TEFCA and Fasten off for world", () => {
    expect(resolveDeployment({ TABULA_REGION: "world", TEFCA_ENABLED: "true", FASTEN_ENABLED: "true" })).toEqual({
      region: "world",
      accepted: true,
      tefcaEnabled: false,
      fastenEnabled: false,
    });
  });

  it("fails closed on an unknown region", () => {
    expect(resolveDeployment({ TABULA_REGION: "wrld" })).toEqual({
      region: null,
      accepted: false,
      tefcaEnabled: false,
      fastenEnabled: false,
    });
  });
});

describe("legal role and identity match", () => {
  it("treats a direct member as a PHR vendor and a data-receiving sponsor as a business associate", () => {
    expect(regulatoryRoleFor({ sponsored: false, sponsorReceivesData: false, sponsorDirectsService: false })).toBe("phr-vendor");
    expect(regulatoryRoleFor({ sponsored: true, sponsorReceivesData: false, sponsorDirectsService: false })).toBe("phr-vendor");
    expect(regulatoryRoleFor({ sponsored: true, sponsorReceivesData: true, sponsorDirectsService: false })).toBe("hipaa-business-associate");
  });

  it("quarantines a chart whose name or birth date does not match, and refuses a missing birth date", () => {
    expect(compareDemographics(
      { familyName: "Garcia", birthDate: "1980-01-02" },
      { familyName: "Garcia", birthDate: "1980-01-02" },
    )).toBe("same-person");
    expect(compareDemographics(
      { familyName: "Garcia", birthDate: "1980-01-02" },
      { familyName: "Nguyen", birthDate: "1980-01-02" },
    )).toBe("mismatch");
    expect(compareDemographics({ familyName: "Garcia" }, { familyName: "Garcia", birthDate: "1980-01-02" })).toBe("insufficient");
  });
});

describe("language and voice scaffolding", () => {
  it("marks Arabic as RTL and keeps the original beside a translation", () => {
    expect(textDirection("ar-SA")).toBe("rtl");
    const recordText = createBilingualRecord(
      { lang: "en", text: "Lisinopril 10 mg" },
      { lang: "es", text: "Lisinopril 10 mg", engine: "human", translatedAt: "2026-10-24" },
    );
    expect(textForReader(recordText, "es").isTranslation).toBe(true);
    expect(recordText.original.text).toBe("Lisinopril 10 mg");
  });

  it("refuses a non-BAA speech engine", () => {
    expect(assertPhiSpeechEngine("gcp-speech")).toBe("gcp-speech");
    expect(preferSpeechEngine(true, "gcp-tts")).toBe("on-device");
    expect(() => assertPhiSpeechEngine("web-speech")).toThrow(/PHI/);
    expect(textScaleFactor("extra-large")).toBe(1.5);
  });
});

describe("device ingestion", () => {
  it("requires a BAA for Terra and none for an on-device HealthKit read", () => {
    expect(integrationById("terra")?.agreement).toBe("baa-required");
    expect(integrationById("apple-healthkit")?.agreement).toBe("none-on-device");
  });

  it("maps a reading to a LOINC Observation tagged as device data", () => {
    const observation = toFhirObservation({
      patientId: "patient-1",
      kind: "heart-rate",
      value: 72,
      ucum: "/min",
      unitLabel: "beats/min",
      effectiveAt: "2026-10-24T12:00:00Z",
      integrationId: "apple-healthkit",
      deviceLabel: "Apple Watch",
    });
    expect(observation.code.coding[0].code).toBe("8867-4");
    expect(observation.meta.tag[0].code).toBe("device");
  });

  it("stops a revoked device consent", () => {
    expect(consentIsActive({
      integrationId: "ble-gatt",
      scopes: ["blood-pressure"],
      grantedAt: "2026-01-01T00:00:00Z",
      revokedAt: "2026-06-01T00:00:00Z",
    }, "2026-07-01T00:00:00Z", "blood-pressure")).toBe(false);
  });
});

describe("FHIR reconciliation", () => {
  it("does not merge two same-day heart-rate readings and ignores a bare calendar day", () => {
    expect(hasExplicitOffset("2026-04-01")).toBe(false);
    expect(hasExplicitOffset("2026-04-01T15:00:00Z")).toBe(true);
    const morning = record({
      source: "device",
      sourceResourceId: "hr-1",
      clinicalClass: "device-stream",
      codings: [{ system: LOINC, code: "8867-4" }],
      effectiveInstant: "2026-04-01T15:00:00Z",
      valueKey: "72|/min",
    });
    const evening = record({
      source: "device",
      sourceResourceId: "hr-2",
      clinicalClass: "device-stream",
      codings: [{ system: LOINC, code: "8867-4" }],
      effectiveInstant: "2026-04-01T23:00:00Z",
      valueKey: "72|/min",
    });
    const { groups, confirmationCandidates } = reconcileRecords([morning, evening]);
    expect(groups).toHaveLength(2);
    expect(confirmationCandidates).toHaveLength(0);
    expect(sourceRecordCount(groups)).toBe(2);
  });

  it("groups two copies of one accession and keeps both values when they differ", () => {
    const first = record({
      source: "fasten",
      sourceResourceId: "lab-1",
      clinicalClass: "lab",
      resourceType: "Observation",
      identifiers: [{ system: "urn:lab:accession", value: "ACC-9" }],
      valueKey: "100|mg/dL",
    });
    const corrected = record({
      source: "direct-smart",
      sourceSystem: "epic",
      sourceResourceId: "lab-2",
      clinicalClass: "lab",
      resourceType: "Observation",
      identifiers: [{ system: "urn:lab:accession", value: "ACC-9" }],
      valueKey: "110|mg/dL",
      status: "amended",
    });
    const { groups } = reconcileRecords([first, corrected]);
    expect(groups).toHaveLength(1);
    expect(groups[0].conflict).toBe(true);
    expect(groups[0].members).toHaveLength(2);
  });

  it("asks the member before treating a Blue Button fill and a MedicationRequest as the same drug", () => {
    const claim = record({
      source: "cms-blue-button",
      sourceResourceId: "eob-1",
      clinicalClass: "medication",
      resourceType: "ExplanationOfBenefit",
      codings: [{ system: RXNORM, code: "29046" }],
    });
    const order = record({
      source: "direct-smart",
      sourceResourceId: "med-1",
      clinicalClass: "medication",
      resourceType: "MedicationRequest",
      codings: [{ system: RXNORM, code: "29046" }],
    });
    const { groups, confirmationCandidates } = reconcileRecords([claim, order]);
    expect(groups).toHaveLength(2);
    expect(confirmationCandidates).toHaveLength(1);
    expect(confirmationCandidates[0].requiresPatientConfirmation).toBe(true);
  });

  it("does not auto-merge an allergy on a high model score", () => {
    const left = record({ source: "fasten", sourceResourceId: "a", clinicalClass: "allergy", resourceType: "AllergyIntolerance" });
    const right = record({ source: "direct-smart", sourceResourceId: "b", clinicalClass: "allergy", resourceType: "AllergyIntolerance" });
    const first = reconcileRecords([left, right]);
    const decided = applySemanticDecision(first.groups, left, right, { same: true, score: 0.99, model: "vertex-gemini" });
    expect(sourceRecordCount(decided.groups)).toBe(2);
    expect(decided.confirmationCandidates).toHaveLength(1);
    expect(decided.groups.every((group) => group.algorithm === "singleton")).toBe(true);
  });
});
