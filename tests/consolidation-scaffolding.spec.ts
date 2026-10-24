import { describe, expect, it } from "vitest";
import { resolveDeployment } from "../shared/deployment-region";
import { textDirection } from "../shared/i18n/direction";
import { createBilingualRecord, textForReader } from "../shared/i18n/bilingual";
import { assertPhiSpeechEngine, preferSpeechEngine } from "../shared/voice/policy";
import { textScaleFactor } from "../shared/a11y/preferences";
import { integrationById } from "../shared/devices/catalog";
import { toFhirObservation } from "../shared/devices/observation";
import { consentIsActive } from "../shared/devices/consent";
import {
  applySemanticDecision,
  reconcileDeterministic,
  sourceRecordCount,
  terminologyStatus,
  type IncomingFhirRecord,
} from "../shared/fhir/reconcile";

const RXNORM = "http://www.nlm.nih.gov/research/umls/rxnorm";
const LOINC = "http://loinc.org";

function record(overrides: Partial<IncomingFhirRecord> & Pick<IncomingFhirRecord, "source" | "sourceResourceId">): IncomingFhirRecord {
  return {
    patientId: "patient-1",
    sourceSystem: "org-a",
    resourceType: "MedicationStatement",
    identifiers: [],
    codings: [{ system: RXNORM, code: "29046" }],
    effectiveDate: "2026-04-01",
    valueKey: "10|mg",
    ...overrides,
  };
}

describe("deployment region", () => {
  it("keeps TEFCA on for the US default", () => {
    expect(resolveDeployment({})).toEqual({ region: "us", tefcaEnabled: true });
  });

  it("turns TEFCA off for the world region even if the legacy flag is true", () => {
    expect(resolveDeployment({ TABULA_REGION: "world", TEFCA_ENABLED: "true" })).toEqual({
      region: "world",
      tefcaEnabled: false,
    });
  });

  it("still honors an explicit US opt-out", () => {
    expect(resolveDeployment({ TABULA_REGION: "us", TEFCA_ENABLED: "false" }).tefcaEnabled).toBe(false);
  });
});

describe("language and voice scaffolding", () => {
  it("marks Arabic and Urdu as RTL and leaves the original beside a translation", () => {
    expect(textDirection("ar-SA")).toBe("rtl");
    expect(textDirection("ur")).toBe("rtl");
    expect(textDirection("es")).toBe("ltr");
    const recordText = createBilingualRecord(
      { lang: "en", text: "Lisinopril 10 mg" },
      { lang: "es", text: "Lisinopril 10 mg", engine: "human", translatedAt: "2026-10-24" },
    );
    expect(textForReader(recordText, "es").isTranslation).toBe(true);
    expect(recordText.original.text).toBe("Lisinopril 10 mg");
  });

  it("refuses a record with no original and refuses a non-BAA speech engine", () => {
    expect(() => createBilingualRecord({ lang: "en", text: "  " })).toThrow(/original/);
    expect(assertPhiSpeechEngine("gcp-speech")).toBe("gcp-speech");
    expect(preferSpeechEngine(true, "gcp-tts")).toBe("on-device");
    expect(() => assertPhiSpeechEngine("web-speech")).toThrow(/PHI/);
  });

  it("scales text for low-vision preferences", () => {
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
    expect(observation.subject.reference).toBe("Patient/patient-1");
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
  it("merges the same medication from Fasten and a direct SMART pull and keeps both sources", () => {
    const fasten = record({ source: "fasten", sourceResourceId: "fasten-1", identifiers: [{ system: "urn:org:med", value: "med-9" }] });
    const direct = record({
      source: "direct-smart",
      sourceSystem: "epic",
      sourceResourceId: "epic-1",
      identifiers: [{ system: "urn:org:med", value: "med-9" }],
    });
    const { groups } = reconcileDeterministic([fasten, direct, fasten]);
    expect(groups).toHaveLength(1);
    expect(groups[0].algorithm).toBe("deterministic");
    expect(sourceRecordCount(groups)).toBe(2);
  });

  it("does not merge two patients or two different values", () => {
    const left = record({ source: "fasten", sourceResourceId: "a", codings: [{ system: LOINC, code: "8867-4" }], resourceType: "Observation", valueKey: "72|/min" });
    const otherPatient = record({ source: "fasten", sourceResourceId: "b", patientId: "patient-2", codings: [{ system: LOINC, code: "8867-4" }], resourceType: "Observation", valueKey: "72|/min" });
    const otherValue = record({ source: "device", sourceResourceId: "c", codings: [{ system: LOINC, code: "8867-4" }], resourceType: "Observation", valueKey: "110|/min" });
    const result = reconcileDeterministic([left, otherPatient, otherValue]);
    expect(result.groups.every((group) => group.members.length === 1)).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].reason).toBe("same-code-different-value");
  });

  it("holds fuzzy pairs for Vertex and can merge them without dropping a source", () => {
    const named = record({
      source: "fasten",
      sourceResourceId: "a",
      codings: [{ system: "http://hospital.example/meds", code: "LIS10" }],
    });
    const canonical = record({ source: "direct-smart", sourceResourceId: "b" });
    const first = reconcileDeterministic([named, canonical]);
    expect(terminologyStatus(named.codings[0])).toBe("unmapped");
    expect(first.semanticCandidates).toHaveLength(1);
    const merged = applySemanticDecision(first.groups, first.semanticCandidates[0], {
      same: true,
      score: 0.91,
      model: "vertex-embeddings",
    });
    expect(sourceRecordCount(merged)).toBe(2);
    expect(merged.some((group) => group.algorithm === "semantic")).toBe(true);
  });
});
