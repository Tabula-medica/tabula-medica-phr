import { describe, it, expect } from "vitest";
import { createHash, createPublicKey } from "node:crypto";
import {
  canonicalize,
  deriveProvenance,
  generatePassportKeyPair,
  issuePassport,
  keyFingerprint,
  loadSigningKeyFromEnv,
  verifyPassport,
  type HealthPassport,
} from "../server/services/world/health-passport";
import { buildIpsBundle, type IpsInput } from "../server/services/world/ips-generator";

const SIGNED_AT = "2026-08-19T10:00:00.000Z";

function sampleInput(): IpsInput {
  return {
    patient: {
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Asha Mehta",
      dob: "1979-04-02",
      gender: "female",
      countryCode: "IN",
      nationalHealthId: "12-3456-7890-1230",
    },
    problems: [{ id: "p1", name: "Type 2 diabetes mellitus", status: "active" }],
    medications: [{ id: "m1", name: "Metformin", dose: "500 mg", status: "active" }],
    allergies: [{ id: "a1", allergen: "Penicillin", severity: "severe" }],
    immunizations: [],
    procedures: [],
    timestamp: SIGNED_AT,
    documentId: "11111111-1111-4111-8111-111111111111",
  };
}

function issue() {
  const keys = generatePassportKeyPair();
  const passport = issuePassport({
    document: buildIpsBundle(sampleInput()),
    privateKeyPem: keys.privateKeyPem,
    provenance: deriveProvenance(0, 3),
    signedAt: SIGNED_AT,
  });
  return { keys, passport };
}

describe("canonicalize", () => {
  it("is key-order independent", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it("preserves array order, which is meaningful in FHIR", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("sorts keys recursively", () => {
    expect(canonicalize({ z: { d: 1, c: 2 } })).toBe('{"z":{"c":2,"d":1}}');
  });

  it("drops undefined values rather than emitting invalid JSON", () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("survives a JSON round trip of a real IPS document", () => {
    const bundle = buildIpsBundle(sampleInput());
    const roundTripped = JSON.parse(JSON.stringify(bundle));
    expect(canonicalize(roundTripped)).toBe(canonicalize(bundle));
  });
});

describe("buildIpsBundle determinism", () => {
  it("produces byte-identical output for identical input", () => {
    // The signature depends on this. If the builder ever became
    // non-deterministic, passports would stop verifying.
    expect(canonicalize(buildIpsBundle(sampleInput()))).toBe(
      canonicalize(buildIpsBundle(sampleInput())),
    );
  });
});

describe("issuePassport / verifyPassport", () => {
  it("verifies a freshly issued passport", () => {
    const { passport } = issue();
    const result = verifyPassport(passport);
    expect(result.valid).toBe(true);
  });

  it("verifies after a JSON round trip, as a real recipient would receive it", () => {
    const { passport } = issue();
    const wire = JSON.parse(JSON.stringify(passport));
    expect(verifyPassport(wire).valid).toBe(true);
  });

  it("detects a tampered clinical value", () => {
    const { passport } = issue();
    const tampered = JSON.parse(JSON.stringify(passport));
    const entries = tampered.document.entry as Array<{
      resource: { resourceType: string; code: { text: string } };
    }>;
    const allergy = entries.find(
      (e) => e.resource.resourceType === "AllergyIntolerance",
    );
    allergy!.resource.code.text = "Peanut";

    const result = verifyPassport(tampered);
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: "hash-mismatch" });
  });

  it("detects tampering that also updates the hash but not the signature", () => {
    const { passport } = issue();
    const tampered = JSON.parse(JSON.stringify(passport));
    tampered.document.entry[0].resource.title = "Forged Summary";
    // Recompute the hash the way an attacker would, leaving the signature stale.
    tampered.documentHash = createHash("sha256")
      .update(Buffer.from(canonicalize(tampered.document), "utf8"))
      .digest()
      .toString("base64url");

    const result = verifyPassport(tampered);
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: "signature-mismatch" });
  });

  it("rejects a passport re-signed with a different key when the key is pinned", () => {
    // Without pinning, an attacker who re-signs modified content with their
    // own key produces an internally consistent envelope. Pinning is what
    // makes the issuer identity claim real.
    const { keys } = issue();
    const attacker = generatePassportKeyPair();
    const forged = issuePassport({
      document: buildIpsBundle({ ...sampleInput(), allergies: [] }),
      privateKeyPem: attacker.privateKeyPem,
      provenance: deriveProvenance(0, 0),
      signedAt: SIGNED_AT,
    });

    expect(verifyPassport(forged).valid).toBe(true); // internally consistent
    const pinned = Buffer.from(
      createPublicKey(keys.publicKeyPem).export({ type: "spki", format: "der" }),
    );
    const result = verifyPassport(forged, pinned);
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: "signature-mismatch" });
  });

  it("rejects an unknown envelope format", () => {
    const { passport } = issue();
    const bad = { ...passport, format: "something-else" } as unknown as HealthPassport;
    expect(verifyPassport(bad)).toMatchObject({ reason: "unsupported-format" });
  });

  it("rejects an unsupported signature algorithm", () => {
    const { passport } = issue();
    const bad = JSON.parse(JSON.stringify(passport));
    bad.signature.algorithm = "RS256";
    expect(verifyPassport(bad)).toMatchObject({ reason: "unsupported-algorithm" });
  });

  it("reports a malformed public key instead of throwing", () => {
    const { passport } = issue();
    const bad = JSON.parse(JSON.stringify(passport));
    bad.signature.publicKey = Buffer.from("garbage").toString("base64url");
    expect(verifyPassport(bad)).toMatchObject({ reason: "malformed-key" });
  });

  it("carries the assurance statement through to the verification result", () => {
    const { passport } = issue();
    const result = verifyPassport(passport);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.assurance).toBe("patient-asserted");
      expect(result.statement).toContain("entered by the patient");
    }
  });
});

describe("deriveProvenance", () => {
  it("only claims provider-attested when nothing is patient-entered", () => {
    expect(deriveProvenance(5, 0).assurance).toBe("provider-attested");
  });

  it("downgrades to mixed as soon as any element is patient-entered", () => {
    expect(deriveProvenance(5, 1).assurance).toBe("mixed");
  });

  it("reports patient-asserted when nothing is verified", () => {
    expect(deriveProvenance(0, 4).assurance).toBe("patient-asserted");
    expect(deriveProvenance(0, 0).assurance).toBe("patient-asserted");
  });
});

describe("keyFingerprint", () => {
  it("is stable for a key and distinct across keys", () => {
    const a = generatePassportKeyPair();
    const b = generatePassportKeyPair();
    expect(keyFingerprint(a.publicKeyPem)).toBe(keyFingerprint(a.publicKeyPem));
    expect(keyFingerprint(a.publicKeyPem)).not.toBe(keyFingerprint(b.publicKeyPem));
  });
});

describe("loadSigningKeyFromEnv", () => {
  it("returns null when unset, so callers degrade instead of inventing a key", () => {
    const prev = process.env.PASSPORT_SIGNING_KEY;
    delete process.env.PASSPORT_SIGNING_KEY;
    expect(loadSigningKeyFromEnv()).toBeNull();
    if (prev !== undefined) process.env.PASSPORT_SIGNING_KEY = prev;
  });

  it("accepts a literal PEM", () => {
    const prev = process.env.PASSPORT_SIGNING_KEY;
    const keys = generatePassportKeyPair();
    process.env.PASSPORT_SIGNING_KEY = keys.privateKeyPem;
    expect(loadSigningKeyFromEnv()).toContain("BEGIN PRIVATE KEY");
    if (prev === undefined) delete process.env.PASSPORT_SIGNING_KEY;
    else process.env.PASSPORT_SIGNING_KEY = prev;
  });

  it("accepts a base64-encoded PEM, since secret managers mangle newlines", () => {
    const prev = process.env.PASSPORT_SIGNING_KEY;
    const keys = generatePassportKeyPair();
    process.env.PASSPORT_SIGNING_KEY = Buffer.from(keys.privateKeyPem).toString("base64");
    expect(loadSigningKeyFromEnv()).toBe(keys.privateKeyPem);
    if (prev === undefined) delete process.env.PASSPORT_SIGNING_KEY;
    else process.env.PASSPORT_SIGNING_KEY = prev;
  });
});
