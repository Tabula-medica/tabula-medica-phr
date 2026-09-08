import { describe, it, expect } from "vitest";
import {
  buildIpsBundle,
  escapeXhtml,
  type IpsInput,
} from "../server/services/world/ips-generator";
import { validateIpsBundle } from "../server/services/world/ips-validator";
import { ABSENT_UNKNOWN, IPS_CODE_SYSTEM, REQUIRED_SECTION_KEYS } from "@shared/ips";
import type { IpsBundle } from "@shared/ips";

const TIMESTAMP = "2026-08-19T10:00:00.000Z";
const DOC_ID = "11111111-1111-4111-8111-111111111111";

function baseInput(overrides: Partial<IpsInput> = {}): IpsInput {
  return {
    patient: {
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Asha Mehta",
      dob: "1979-04-02",
      gender: "female",
      countryCode: "IN",
      nationalHealthId: "12-3456-7890-1230",
      preferredLanguage: "hi",
    },
    problems: [],
    medications: [],
    allergies: [],
    immunizations: [],
    procedures: [],
    timestamp: TIMESTAMP,
    documentId: DOC_ID,
    ...overrides,
  };
}

function populatedInput(): IpsInput {
  return baseInput({
    problems: [
      {
        id: "p1",
        name: "Type 2 diabetes mellitus",
        onsetDate: "2015-06-01",
        status: "active",
        snomedCode: "44054006",
        localCode: "5A11",
      },
    ],
    medications: [
      {
        id: "m1",
        name: "Metformin",
        dose: "500 mg",
        frequency: "twice daily",
        status: "active",
        startDate: "2015-06-15",
        atcCode: "A10BA02",
      },
    ],
    allergies: [
      {
        id: "a1",
        allergen: "Penicillin",
        reaction: "Anaphylaxis",
        severity: "severe",
        status: "active",
      },
    ],
    immunizations: [
      { id: "i1", vaccineName: "Tetanus toxoid", dateAdministered: "2021-11-03", doseNumber: 2 },
    ],
    procedures: [
      { id: "s1", name: "Appendectomy", performedDate: "2004-02-18" },
    ],
  });
}

/**
 * Read a nested field off a generated resource. IPS resources are
 * deliberately open-ended (`[key: string]: unknown`), so tests need a way to
 * reach into them without scattering casts.
 */
function field<T = unknown>(source: unknown, path: string): T {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc as Record<string, unknown> | undefined)?.[key],
      source,
    ) as T;
}

/** Mutable view of a resource, for the tests that deliberately corrupt one. */
function mutable(source: unknown): Record<string, unknown> {
  return source as Record<string, unknown>;
}

function findComposition(bundle: IpsBundle) {
  return bundle.entry[0].resource as unknown as {
    section: Array<{ title: string; code: { coding?: Array<{ code?: string }> }; entry?: Array<{ reference?: string }> }>;
    type: { coding?: Array<{ code?: string }> };
    subject: { reference?: string };
  };
}

describe("buildIpsBundle — document shape", () => {
  it("produces a document Bundle with the Composition first", () => {
    const bundle = buildIpsBundle(populatedInput());
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("document");
    expect(bundle.entry[0].resource.resourceType).toBe("Composition");
    expect(bundle.timestamp).toBe(TIMESTAMP);
    expect(bundle.identifier.value).toBe(DOC_ID);
  });

  it("types the document as LOINC 60591-5 (Patient summary)", () => {
    const composition = findComposition(buildIpsBundle(populatedInput()));
    expect(composition.type.coding?.[0].code).toBe("60591-5");
  });

  it("includes every required section plus the populated recommended ones", () => {
    const composition = findComposition(buildIpsBundle(populatedInput()));
    const titles = composition.section.map((s) => s.title);
    expect(titles).toEqual([
      "Active Problems",
      "Medication Summary",
      "Allergies and Intolerances",
      "Immunizations",
      "History of Procedures",
    ]);
  });

  it("omits recommended sections that have no data", () => {
    const composition = findComposition(buildIpsBundle(baseInput()));
    const titles = composition.section.map((s) => s.title);
    expect(titles).not.toContain("Immunizations");
    expect(titles).not.toContain("History of Procedures");
  });
});

describe("buildIpsBundle — required sections when the patient has no data", () => {
  it("still emits all three required sections", () => {
    const composition = findComposition(buildIpsBundle(baseInput()));
    expect(composition.section).toHaveLength(REQUIRED_SECTION_KEYS.length);
  });

  it('asserts "no known allergies" rather than leaving the section empty', () => {
    // The distinction is clinical: an empty section means "never asked",
    // an absent-unknown entry means "asked, and the answer was none".
    const bundle = buildIpsBundle(baseInput());
    const allergy = bundle.entry.find(
      (e) => e.resource.resourceType === "AllergyIntolerance",
    );
    expect(allergy).toBeDefined();
    const code = field<{ coding: Array<{ system: string; code: string }> }>(
      allergy!.resource,
      "code",
    );
    expect(code.coding[0].system).toBe(IPS_CODE_SYSTEM.ABSENT_UNKNOWN);
    expect(code.coding[0].code).toBe(ABSENT_UNKNOWN.NO_KNOWN_ALLERGIES);
  });

  it("asserts absence for problems and medications too", () => {
    const bundle = buildIpsBundle(baseInput());
    const condition = bundle.entry.find((e) => e.resource.resourceType === "Condition");
    const medication = bundle.entry.find(
      (e) => e.resource.resourceType === "MedicationStatement",
    );
    expect(field(condition!.resource, "code.coding.0.code")).toBe(
      ABSENT_UNKNOWN.NO_KNOWN_PROBLEMS,
    );
    expect(
      field(medication!.resource, "medicationCodeableConcept.coding.0.code"),
    ).toBe(ABSENT_UNKNOWN.NO_KNOWN_MEDICATIONS);
  });
});

describe("buildIpsBundle — global coding, not US coding", () => {
  it("codes problems in SNOMED CT with the jurisdiction's local system alongside", () => {
    const bundle = buildIpsBundle(populatedInput());
    const condition = bundle.entry.find((e) => e.resource.id === "p1");
    const coding = field<Array<{ system: string; code: string }>>(
      condition!.resource,
      "code.coding",
    );
    expect(coding[0].system).toBe(IPS_CODE_SYSTEM.SNOMED_CT);
    expect(coding[0].code).toBe("44054006");
    // India's jurisdiction entry declares ICD-11 MMS, not ICD-10-CM.
    expect(coding[1].system).toBe(IPS_CODE_SYSTEM.ICD11_MMS);
    expect(coding[1].code).toBe("5A11");
  });

  it("codes medications in WHO ATC, never RxNorm", () => {
    const bundle = buildIpsBundle(populatedInput());
    const med = bundle.entry.find((e) => e.resource.id === "m1");
    const coding = field<Array<{ system: string; code: string }>>(
      med!.resource,
      "medicationCodeableConcept.coding",
    );
    expect(coding[0].system).toBe(IPS_CODE_SYSTEM.ATC);
    expect(JSON.stringify(bundle)).not.toContain("rxnorm");
  });

  it("never emits CVX, which is a US-only immunisation code system", () => {
    const bundle = buildIpsBundle(populatedInput());
    expect(JSON.stringify(bundle)).not.toContain("sid/cvx");
  });
});

describe("buildIpsBundle — patient identity", () => {
  it("publishes a valid ABHA number under the ABDM naming system", () => {
    const bundle = buildIpsBundle(populatedInput());
    const patient = bundle.entry.find((e) => e.resource.resourceType === "Patient");
    const ids = field<Array<{ system: string; value: string }>>(
      patient!.resource,
      "identifier",
    );
    expect(ids[0].system).toBe("https://healthid.abdm.gov.in/ns/abha-number");
    expect(ids[0].value).toBe("12345678901230");
  });

  it("drops a malformed national ID rather than publishing it as authoritative", () => {
    const input = baseInput();
    input.patient.nationalHealthId = "not-a-real-abha";
    const bundle = buildIpsBundle(input);
    const patient = bundle.entry.find((e) => e.resource.resourceType === "Patient");
    const ids = field<Array<{ system: string }>>(patient!.resource, "identifier");
    expect(ids).toHaveLength(1);
    expect(ids[0].system).toBe("urn:tabula-medica:id:profile");
  });

  it("always carries at least one identifier, even with no country", () => {
    const input = baseInput();
    input.patient.countryCode = undefined;
    input.patient.nationalHealthId = undefined;
    const bundle = buildIpsBundle(input);
    const patient = bundle.entry.find((e) => e.resource.resourceType === "Patient");
    expect(field<unknown[]>(patient!.resource, "identifier")).toHaveLength(1);
  });
});

describe("escapeXhtml", () => {
  it("escapes markup so narratives cannot inject script into a viewer", () => {
    expect(escapeXhtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes patient-controlled strings that reach the narrative", () => {
    const input = baseInput({
      allergies: [{ id: "a1", allergen: '<img src=x onerror="steal()">' }],
    });
    const bundle = buildIpsBundle(input);
    const div = field<string>(findComposition(bundle).section[2], "text.div");
    expect(div).not.toContain("<img");
    expect(div).toContain("&lt;img");
  });
});

describe("validateIpsBundle", () => {
  it("passes a generated document with data", () => {
    const result = validateIpsBundle(buildIpsBundle(populatedInput()));
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(result.conformant).toBe(true);
  });

  it("passes an empty-but-conformant document and reports which sections were asserted empty", () => {
    const result = validateIpsBundle(buildIpsBundle(baseInput()));
    expect(result.conformant).toBe(true);
    expect(result.sectionsAssertedEmpty.sort()).toEqual([
      "allergies",
      "medications",
      "problems",
    ]);
  });

  it("rejects a document whose required section was dropped", () => {
    const bundle = buildIpsBundle(populatedInput());
    const composition = mutable(bundle.entry[0].resource);
    composition.section = (composition.section as Array<{ title: string }>).filter(
      (s) => s.title !== "Allergies and Intolerances",
    );
    const result = validateIpsBundle(bundle);
    expect(result.conformant).toBe(false);
    expect(result.issues.some((i) => i.code === "required-section-missing")).toBe(true);
  });

  it("rejects a required section emptied of its entries", () => {
    const bundle = buildIpsBundle(populatedInput());
    const composition = mutable(bundle.entry[0].resource);
    (composition.section as Array<{ entry: unknown[] }>)[0].entry = [];
    const result = validateIpsBundle(bundle);
    expect(result.conformant).toBe(false);
    expect(result.issues.some((i) => i.code === "section-empty")).toBe(true);
  });

  it("catches a reference that does not resolve inside the document", () => {
    const bundle = buildIpsBundle(populatedInput());
    const sections = field<Array<{ entry: unknown[] }>>(
      bundle.entry[0].resource,
      "section",
    );
    sections[0].entry = [{ reference: "urn:uuid:does-not-exist" }];
    const result = validateIpsBundle(bundle);
    expect(result.conformant).toBe(false);
    expect(result.issues.some((i) => i.code === "dangling-reference")).toBe(true);
  });

  it("rejects a Bundle that is not a document", () => {
    const bundle = buildIpsBundle(populatedInput());
    mutable(bundle).type = "collection";
    expect(validateIpsBundle(bundle).conformant).toBe(false);
  });

  it("rejects a document whose Composition is not first", () => {
    const bundle = buildIpsBundle(populatedInput());
    bundle.entry.reverse();
    const result = validateIpsBundle(bundle);
    expect(result.conformant).toBe(false);
    expect(result.issues.some((i) => i.code === "composition-not-first")).toBe(true);
  });
});
