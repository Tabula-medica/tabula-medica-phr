import { describe, it, expect } from "vitest";
import { createHash, createPublicKey } from "node:crypto";
import {
  canonicalize,
  deriveProvenance,
  generatePassportKeyPair,
  issuePassport,
  keyFingerprint,
  loadSigningKeyFromEnv,
  loadTrustedPublicKeysFromEnv,
  publicKeyDer,
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

    // Internally consistent — but the result must say the issuer is unknown,
    // not merely `valid: true`.
    const unpinned = verifyPassport(forged);
    expect(unpinned).toMatchObject({
      valid: true,
      keyTrust: "unverified-issuer",
      issuerVerified: false,
    });
    if (unpinned.valid) expect(unpinned.caveat).toContain("unauthenticated claims");

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

  it("refuses to let an attacker upgrade the assurance level in transit", () => {
    // The v1 signature covered only the document bytes, so provenance sat
    // outside it: a genuine patient-asserted passport could be relabelled
    // provider-attested and would still verify under the REAL issuer key.
    // This is the forgery the envelope binding exists to stop.
    const { keys, passport } = issue();
    const tampered = JSON.parse(JSON.stringify(passport));
    tampered.provenance.assurance = "provider-attested";
    tampered.provenance.statement =
      "Every element in this summary originated from a verified healthcare source.";

    const result = verifyPassport(tampered, publicKeyDer(keys.publicKeyPem));
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reason: "signature-mismatch" });
  });

  it("refuses a spoofed keyId, which is what an out-of-band check compares", () => {
    const { keys, passport } = issue();
    const tampered = JSON.parse(JSON.stringify(passport));
    tampered.signature.keyId = "PublishedTabulaFp";

    expect(verifyPassport(tampered, publicKeyDer(keys.publicKeyPem))).toMatchObject({
      valid: false,
      reason: "signature-mismatch",
    });
    // And unpinned too: the envelope no longer hangs together at all.
    expect(verifyPassport(tampered).valid).toBe(false);
  });

  it("marks a genuine passport issuer-verified only when the key is pinned", () => {
    const { keys, passport } = issue();

    const unpinned = verifyPassport(passport);
    expect(unpinned).toMatchObject({
      valid: true,
      keyTrust: "unverified-issuer",
      issuerVerified: false,
    });

    const pinned = verifyPassport(passport, publicKeyDer(keys.publicKeyPem));
    expect(pinned).toMatchObject({
      valid: true,
      keyTrust: "pinned",
      issuerVerified: true,
    });
    if (pinned.valid) expect(pinned.caveat).toBeUndefined();
  });

  it("accepts a trusted-key list and verifies against any member", () => {
    const { keys, passport } = issue();
    const other = generatePassportKeyPair();
    const result = verifyPassport(passport, [
      publicKeyDer(other.publicKeyPem),
      publicKeyDer(keys.publicKeyPem),
    ]);
    expect(result).toMatchObject({ valid: true, issuerVerified: true });
  });

  it("rejects the superseded v1 envelope rather than accepting a downgrade", () => {
    // Relabelling a v2 envelope as v1 would restore the ability to edit
    // provenance under a genuine signature, so v1 is refused outright.
    const { passport } = issue();
    const downgraded = JSON.parse(JSON.stringify(passport));
    downgraded.format = "tabula-medica.health-passport.v1";
    expect(verifyPassport(downgraded)).toMatchObject({
      valid: false,
      reason: "superseded-format",
    });
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

describe("loadTrustedPublicKeysFromEnv", () => {
  it("returns an empty list when unset — no trusted key is a valid state", () => {
    delete process.env.PASSPORT_TRUSTED_PUBLIC_KEYS;
    expect(loadTrustedPublicKeysFromEnv()).toEqual([]);
  });

  it("loads a PEM key and one wrapped in base64", () => {
    const a = generatePassportKeyPair();
    const b = generatePassportKeyPair();
    process.env.PASSPORT_TRUSTED_PUBLIC_KEYS = [
      a.publicKeyPem.trim(),
      Buffer.from(b.publicKeyPem).toString("base64"),
    ].join(",");

    const keys = loadTrustedPublicKeysFromEnv();
    expect(keys).toHaveLength(2);
    expect(keys.some((k) => k.equals(publicKeyDer(a.publicKeyPem)))).toBe(true);
    expect(keys.some((k) => k.equals(publicKeyDer(b.publicKeyPem)))).toBe(true);
    delete process.env.PASSPORT_TRUSTED_PUBLIC_KEYS;
  });

  it("skips a malformed entry instead of failing the whole list", () => {
    // Skipping makes the verifier less trusting, never more — the safe way to
    // fail. Taking the endpoint down over one bad key would not be.
    const good = generatePassportKeyPair();
    process.env.PASSPORT_TRUSTED_PUBLIC_KEYS = `not-a-key,${good.publicKeyPem.trim()}`;
    const keys = loadTrustedPublicKeysFromEnv();
    expect(keys).toHaveLength(1);
    expect(keys[0].equals(publicKeyDer(good.publicKeyPem))).toBe(true);
    delete process.env.PASSPORT_TRUSTED_PUBLIC_KEYS;
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
