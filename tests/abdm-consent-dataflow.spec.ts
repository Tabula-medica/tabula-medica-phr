// ABDM consent evaluation + health-information data flow (HIU side).
//
// Two things are worth testing hard here and both are tested against their failure mode, not
// their happy path: the consent gate must REFUSE, and the transfer endpoint must not decrypt
// anything it did not ask for.
import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clampToConsentWindow,
  evaluateConsentArtefact,
  type ConsentArtefact,
  type ConsentExpectation,
} from "../server/abdm/consent";
import {
  decryptHealthInformation,
  deriveTransferSecret,
  encryptHealthInformation,
  generateKeyMaterial,
  importPeerPublicKey,
} from "../server/abdm/hi-crypto";
import {
  _resetHiExchanges,
  acceptTransfer,
  bindTransactionId,
  completeHiExchange,
  requestHealthInformation,
  TransferRefused,
} from "../server/abdm/data-flow";

const NOW = Date.parse("2026-06-01T00:00:00Z");

function artefact(overrides: Partial<ConsentArtefact> = {}): ConsentArtefact {
  return {
    consentId: "consent-1",
    status: "GRANTED",
    purpose: { code: "PATRQT", text: "Self requested" },
    patient: { id: "asha.patel@sbx" },
    hiu: { id: "TABULA-PHR" },
    hiTypes: ["OPConsultation", "Prescription"],
    permission: {
      accessMode: "VIEW",
      dateRange: { from: "2020-01-01T00:00:00Z", to: "2026-06-01T00:00:00Z" },
      dataEraseAt: "2026-12-31T00:00:00Z",
    },
    ...overrides,
  };
}

function expectation(overrides: Partial<ConsentExpectation> = {}): ConsentExpectation {
  return {
    abhaAddress: "asha.patel@sbx",
    hiuId: "TABULA-PHR",
    hiTypes: ["OPConsultation"],
    ...overrides,
  };
}

function codes(a: ConsentArtefact | null, e: ConsentExpectation, now = NOW): string[] {
  return evaluateConsentArtefact(a, e, now).refusals.map((r) => r.code);
}

describe("consent evaluation", () => {
  it("authorises a granted artefact that covers the request", () => {
    const result = evaluateConsentArtefact(artefact(), expectation(), NOW);
    expect(result.authorised).toBe(true);
    expect(result.refusals).toEqual([]);
    expect(result.eraseAtMs).toBe(Date.parse("2026-12-31T00:00:00Z"));
  });

  it("never reports the artefact issuer as verified, and says why", () => {
    // No Consent Manager key is pinned, so signature verification has not happened. A caller
    // reading `authorised` alone must not be able to mistake that for issuer proof.
    const result = evaluateConsentArtefact(artefact(), expectation(), NOW);
    expect(result.issuerVerified).toBe(false);
    expect(result.caveats.join(" ")).toMatch(/signature was not verified/i);
  });

  it.each(["REQUESTED", "DENIED", "REVOKED", "EXPIRED"])("refuses a %s artefact", (status) => {
    expect(codes(artefact({ status }), expectation())).toContain("consent-not-granted");
  });

  it("refuses an artefact with no status rather than assuming it was granted", () => {
    expect(codes(artefact({ status: undefined }), expectation())).toContain("consent-not-granted");
  });

  it("refuses an artefact granted for a different patient", () => {
    // The check that stops one user's request being served under another user's consent.
    expect(codes(artefact({ patient: { id: "someone.else@sbx" } }), expectation())).toContain("patient-mismatch");
  });

  it("compares ABHA addresses case-insensitively", () => {
    const result = evaluateConsentArtefact(artefact({ patient: { id: "Asha.Patel@SBX" } }), expectation(), NOW);
    expect(result.authorised).toBe(true);
  });

  it("refuses an artefact granted to a different HIU", () => {
    expect(codes(artefact({ hiu: { id: "SOME-OTHER-HIU" } }), expectation())).toContain("hiu-mismatch");
  });

  it("refuses when our own HIU id is unconfigured, rather than matching anything", () => {
    expect(codes(artefact(), expectation({ hiuId: "" }))).toContain("hiu-mismatch");
  });

  it("refuses a purpose a PHR cannot honestly assert", () => {
    // CAREMGT belongs to a treating provider; BTG is an emergency override.
    expect(codes(artefact({ purpose: { code: "CAREMGT" } }), expectation())).toContain("purpose-not-permitted");
    expect(codes(artefact({ purpose: { code: "BTG" } }), expectation())).toContain("purpose-not-permitted");
  });

  it("refuses the whole request when any requested HI type is unconsented", () => {
    // Not "fetch the subset that is covered": a partial result is indistinguishable from the
    // patient having no records of the missing type.
    const result = evaluateConsentArtefact(
      artefact(),
      expectation({ hiTypes: ["OPConsultation", "DiagnosticReport"] }),
      NOW,
    );
    expect(result.authorised).toBe(false);
    expect(result.refusals.find((r) => r.code === "hi-type-not-consented")?.detail).toContain("DiagnosticReport");
  });

  it("refuses a request naming no HI types", () => {
    expect(codes(artefact(), expectation({ hiTypes: [] }))).toContain("hi-type-not-consented");
  });

  it("refuses once the erase deadline has passed", () => {
    const past = Date.parse("2027-01-01T00:00:00Z");
    expect(codes(artefact(), expectation(), past)).toContain("consent-erase-deadline-passed");
  });

  it("refuses an unparseable erase deadline instead of treating it as no deadline", () => {
    const broken = artefact({
      permission: { dateRange: { from: "2020-01-01T00:00:00Z", to: "2026-06-01T00:00:00Z" }, dataEraseAt: "whenever" },
    });
    expect(codes(broken, expectation())).toContain("malformed-artefact");
  });

  it("refuses a requested window wider than the consented one, and names the consented window", () => {
    const result = evaluateConsentArtefact(
      artefact(),
      expectation({ dateRange: { from: "2015-01-01T00:00:00Z", to: "2026-06-01T00:00:00Z" } }),
      NOW,
    );
    expect(result.authorised).toBe(false);
    expect(result.refusals.find((r) => r.code === "date-range-not-covered")?.detail).toContain("2020-01-01");
  });

  it("accepts a requested window inside the consented one", () => {
    const result = evaluateConsentArtefact(
      artefact(),
      expectation({ dateRange: { from: "2024-01-01T00:00:00Z", to: "2025-01-01T00:00:00Z" } }),
      NOW,
    );
    expect(result.authorised).toBe(true);
  });

  it("refuses a malformed artefact rather than passing it through", () => {
    expect(codes(null, expectation())).toContain("malformed-artefact");
    expect(codes(artefact({ permission: undefined }), expectation())).toContain("malformed-artefact");
  });

  it("collects every independent refusal, not just the first", () => {
    const bad = artefact({ status: "REVOKED", patient: { id: "other@sbx" }, hiu: { id: "X" } });
    const found = codes(bad, expectation());
    expect(found).toEqual(expect.arrayContaining(["consent-not-granted", "patient-mismatch", "hiu-mismatch"]));
  });
});

describe("clampToConsentWindow", () => {
  it("narrows only when the caller explicitly asks", () => {
    const evaluation = evaluateConsentArtefact(artefact(), expectation(), NOW);
    expect(clampToConsentWindow({ from: "2015-01-01T00:00:00Z", to: "2025-01-01T00:00:00Z" }, evaluation)).toEqual({
      from: "2020-01-01T00:00:00.000Z",
      to: "2025-01-01T00:00:00.000Z",
    });
  });

  it("returns null when the windows do not overlap", () => {
    const evaluation = evaluateConsentArtefact(artefact(), expectation(), NOW);
    expect(clampToConsentWindow({ from: "2010-01-01T00:00:00Z", to: "2011-01-01T00:00:00Z" }, evaluation)).toBeNull();
  });
});

describe("data-flow crypto", () => {
  it("round-trips a payload between two independently generated key materials", () => {
    const hiu = generateKeyMaterial(NOW);
    const hip = generateKeyMaterial(NOW);
    const hipSecret = deriveTransferSecret({
      privateKeyPem: hip.privateKeyPem,
      peerKeyValue: hiu.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hip.nonce,
      peerNonce: hiu.nonce,
    });
    const hiuSecret = deriveTransferSecret({
      privateKeyPem: hiu.privateKeyPem,
      peerKeyValue: hip.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hiu.nonce,
      peerNonce: hip.nonce,
    });
    // Both sides must land on the same key even though each XORs the nonces in its own order.
    expect(hiuSecret.key.equals(hipSecret.key)).toBe(true);
    expect(hiuSecret.iv.equals(hipSecret.iv)).toBe(true);

    const bundle = JSON.stringify({ resourceType: "Bundle", id: "b1" });
    expect(decryptHealthInformation(encryptHealthInformation(bundle, hipSecret), hiuSecret)).toBe(bundle);
  });

  it("emits a 32-byte public key and a 32-byte nonce", () => {
    const km = generateKeyMaterial(NOW).keyMaterial;
    expect(Buffer.from(km.dhPublicKey.keyValue, "base64")).toHaveLength(32);
    expect(Buffer.from(km.nonce, "base64")).toHaveLength(32);
    expect(km.curve).toBe("Curve25519");
  });

  it("fails authentication rather than returning wrong plaintext when the nonce is wrong", () => {
    const hiu = generateKeyMaterial(NOW);
    const hip = generateKeyMaterial(NOW);
    const good = deriveTransferSecret({
      privateKeyPem: hip.privateKeyPem,
      peerKeyValue: hiu.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hip.nonce,
      peerNonce: hiu.nonce,
    });
    const wrong = deriveTransferSecret({
      privateKeyPem: hiu.privateKeyPem,
      peerKeyValue: hip.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hiu.nonce,
      peerNonce: generateKeyMaterial(NOW).nonce,
    });
    expect(() => decryptHealthInformation(encryptHealthInformation("x", good), wrong)).toThrow();
  });

  it("detects a tampered ciphertext", () => {
    const hiu = generateKeyMaterial(NOW);
    const hip = generateKeyMaterial(NOW);
    const secret = deriveTransferSecret({
      privateKeyPem: hip.privateKeyPem,
      peerKeyValue: hiu.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hip.nonce,
      peerNonce: hiu.nonce,
    });
    const ours = deriveTransferSecret({
      privateKeyPem: hiu.privateKeyPem,
      peerKeyValue: hip.keyMaterial.dhPublicKey.keyValue,
      ourNonce: hiu.nonce,
      peerNonce: hip.nonce,
    });
    const payload = Buffer.from(encryptHealthInformation("sensitive", secret), "base64");
    payload[0] ^= 0xff;
    expect(() => decryptHealthInformation(payload.toString("base64"), ours)).toThrow();
  });

  it("refuses a nonce that is not exactly 32 bytes instead of padding it", () => {
    const hiu = generateKeyMaterial(NOW);
    const hip = generateKeyMaterial(NOW);
    expect(() =>
      deriveTransferSecret({
        privateKeyPem: hiu.privateKeyPem,
        peerKeyValue: hip.keyMaterial.dhPublicKey.keyValue,
        ourNonce: hiu.nonce,
        peerNonce: Buffer.alloc(8).toString("base64"),
      }),
    ).toThrow(/must be 32 bytes/);
  });

  it("refuses a peer key on the wrong curve", () => {
    // A P-256 key arriving where X25519 is expected is curve confusion, not a formatting quirk.
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const der = publicKey.export({ type: "spki", format: "der" }) as Buffer;
    expect(() => importPeerPublicKey(der.toString("base64"))).toThrow(/expected x25519/);
  });

  it("refuses ciphertext too short to carry a GCM tag", () => {
    const km = generateKeyMaterial(NOW);
    const secret = deriveTransferSecret({
      privateKeyPem: km.privateKeyPem,
      peerKeyValue: generateKeyMaterial(NOW).keyMaterial.dhPublicKey.keyValue,
      ourNonce: km.nonce,
      peerNonce: generateKeyMaterial(NOW).nonce,
    });
    expect(() => decryptHealthInformation(Buffer.alloc(4).toString("base64"), secret)).toThrow(/too short/);
  });
});

describe("transfer acceptance", () => {
  const evaluation = () => evaluateConsentArtefact(artefact(), expectation(), NOW);

  beforeEach(() => {
    _resetHiExchanges();
  });

  async function openExchange() {
    const ack = await requestHealthInformation(
      {
        consentId: "consent-1",
        abhaAddress: "asha.patel@sbx",
        hiTypes: ["OPConsultation"],
        dateRange: { from: "2024-01-01T00:00:00Z", to: "2025-01-01T00:00:00Z" },
      },
      evaluation(),
      NOW,
    );
    bindTransactionId(ack.requestId, "txn-1");
    return ack;
  }

  /** Encrypt a payload as a HIP would, against the HIU public key we published. */
  function hipPage(hiuPublicKeyValue: string, hiuNonce: string, plaintext: string) {
    const hip = generateKeyMaterial(NOW);
    const secret = deriveTransferSecret({
      privateKeyPem: hip.privateKeyPem,
      peerKeyValue: hiuPublicKeyValue,
      ourNonce: hip.nonce,
      peerNonce: hiuNonce,
    });
    return {
      transactionId: "txn-1",
      pageNumber: 1,
      pageCount: 1,
      keyMaterial: hip.keyMaterial,
      entries: [{ content: encryptHealthInformation(plaintext, secret), careContextReference: "cc-1" }],
    };
  }

  it("refuses to fetch under an unauthorised consent", async () => {
    const denied = evaluateConsentArtefact(artefact({ status: "REVOKED" }), expectation(), NOW);
    await expect(
      requestHealthInformation(
        {
          consentId: "consent-1",
          abhaAddress: "asha.patel@sbx",
          hiTypes: ["OPConsultation"],
          dateRange: { from: "2024-01-01T00:00:00Z", to: "2025-01-01T00:00:00Z" },
        },
        denied,
        NOW,
      ),
    ).rejects.toThrow(/does not authorise/);
  });

  it("refuses a transfer for a transaction this process never requested", () => {
    // The property that makes a publicly reachable push endpoint safe: no pending exchange
    // means no private key, so an unsolicited payload cannot enter the record.
    expect(() => acceptTransfer({ transactionId: "not-ours", entries: [] }, NOW)).toThrow(TransferRefused);
    try {
      acceptTransfer({ transactionId: "not-ours", entries: [] }, NOW);
    } catch (e) {
      expect((e as TransferRefused).code).toBe("unknown-transaction");
    }
  });

  it("refuses a transfer with no transactionId", () => {
    expect(() => acceptTransfer({ entries: [] }, NOW)).toThrow(TransferRefused);
  });

  it("decrypts a page pushed against the key material we published", async () => {
    const ack = await openExchange();
    expect(ack.source).toBe("stub");
    // Re-derive what the HIU published by replaying the exchange through the public API.
    const km = ack.keyMaterial;
    const result = acceptTransfer(hipPage(km.dhPublicKey.keyValue, km.nonce, '{"resourceType":"Bundle"}'), NOW);
    expect(result.entries).toEqual([{ careContextReference: "cc-1", content: '{"resourceType":"Bundle"}' }]);
    expect(result.failures).toEqual([]);
    expect(result.consentId).toBe("consent-1");
    expect(result.eraseAtMs).toBe(Date.parse("2026-12-31T00:00:00Z"));
  });

  it("reports a bad entry without discarding the rest of the page", async () => {
    const ack = await openExchange();
    const km = ack.keyMaterial;
    const page = hipPage(km.dhPublicKey.keyValue, km.nonce, "ok");
    page.entries.push({ content: "!!!not base64!!!", careContextReference: "cc-2" });
    const result = acceptTransfer(page, NOW);
    expect(result.entries).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].index).toBe(1);
  });

  it("refuses a transfer carrying no key material", async () => {
    await openExchange();
    try {
      acceptTransfer({ transactionId: "txn-1", entries: [] }, NOW);
      throw new Error("expected a refusal");
    } catch (e) {
      expect((e as TransferRefused).code).toBe("missing-key-material");
    }
  });

  it("refuses a transfer once the exchange has expired", async () => {
    const ack = await openExchange();
    const km = ack.keyMaterial;
    const page = hipPage(km.dhPublicKey.keyValue, km.nonce, "ok");
    // Specifically `exchange-expired`, not `unknown-transaction`: a late transfer and a
    // correlation bug send whoever is debugging a live integration to different places.
    try {
      acceptTransfer(page, NOW + 2 * 60 * 60 * 1000);
      throw new Error("expected a refusal");
    } catch (e) {
      expect(e).toBeInstanceOf(TransferRefused);
      expect((e as TransferRefused).code).toBe("exchange-expired");
    }
  });

  it("will not rebind a transactionId to a second request", async () => {
    const first = await openExchange();
    const second = await requestHealthInformation(
      {
        consentId: "consent-1",
        abhaAddress: "asha.patel@sbx",
        hiTypes: ["OPConsultation"],
        dateRange: { from: "2024-01-01T00:00:00Z", to: "2025-01-01T00:00:00Z" },
      },
      evaluation(),
      NOW,
    );
    expect(first.requestId).not.toBe(second.requestId);
    expect(bindTransactionId(second.requestId, "txn-1")).toBe(false);
  });

  it("drops the private key once the exchange is completed", async () => {
    const ack = await openExchange();
    const km = ack.keyMaterial;
    const page = hipPage(km.dhPublicKey.keyValue, km.nonce, "ok");
    expect(completeHiExchange("txn-1")).toBe(true);
    expect(() => acceptTransfer(page, NOW)).toThrow(TransferRefused);
  });
});
