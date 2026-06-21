/**
 * H10 — Signed report output
 *
 * Every audit / disclosure / breach report we hand to a regulator, patient,
 * or external auditor is wrapped in a signed envelope so the recipient can
 * verify it was produced by Tabula Medica and has not been tampered with
 * end-to-end.
 *
 * Default signer: Ed25519 keypair deterministically derived from
 *   HKDF-SHA256(PHI_ENCRYPTION_KEY, salt="tabula-medica/report-signer/v1",
 *               info="ed25519-seed", length=32)
 *
 * Why deterministic:
 *   - The private key never has to be persisted or rotated through a
 *     separate KMS — `PHI_ENCRYPTION_KEY` already exists as the canonical
 *     long-term secret.
 *   - The public key is stable across deploys, which means recipients can
 *     pin it.
 *   - When you DO want managed key rotation later, swap `getReportSigner()`
 *     to return a `GcpKmsSigner` (stub included) — the envelope format and
 *     verify endpoint stay identical.
 *
 * Why Ed25519 (not RSA): smaller signatures (64 B), constant-time, modern.
 * `crypto.sign("ed25519", …)` is in Node ≥ 12; no extra deps.
 */

import { createHash, createPrivateKey, createPublicKey, hkdfSync, sign as nodeSign, verify as nodeVerify, type KeyObject } from "node:crypto";

export type SignedEnvelope<T> = {
  payload: T;
  signature: {
    algorithm: "ed25519";
    keyId: string;
    signedAt: string;
    /** base64url-encoded detached signature over the canonical JSON of `payload`. */
    value: string;
    /** SHA-256 of the canonical JSON of `payload`, also base64url. Quick integrity check. */
    payloadHash: string;
  };
};

export interface ReportSigner {
  /** Stable identifier for the signing key. Goes into the envelope. */
  getKeyId(): string;
  /** Sign a JSON-serialisable payload, returning a complete envelope. */
  sign<T>(payload: T): Promise<SignedEnvelope<T>>;
  /** Verify a signed envelope. Returns true iff signature + payload hash match. */
  verify<T>(envelope: SignedEnvelope<T>): Promise<boolean>;
  /** Public key in PEM (SPKI) format — handed to recipients out-of-band. */
  getPublicKeyPem(): string;
  /** Public key as JWK — for JOSE-style verifiers. */
  getPublicKeyJwk(): { kty: "OKP"; crv: "Ed25519"; x: string; kid: string; alg: "EdDSA"; use: "sig" };
}

// ---------------------------------------------------------------------------
// Canonical JSON — RFC 8785 subset sufficient for our needs.
// Sorts object keys recursively so two semantically-equal payloads serialize
// to identical bytes (and thus produce identical signatures).
// ---------------------------------------------------------------------------
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

// ---------------------------------------------------------------------------
// PKCS8 envelope for raw Ed25519 seed.
// ASN.1 prefix is fixed at 16 bytes for Ed25519 (RFC 8410 §7).
// ---------------------------------------------------------------------------
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
function ed25519PrivateKeyFromSeed(seed: Buffer): KeyObject {
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes");
  const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

// ---------------------------------------------------------------------------
// LocalEd25519Signer
// ---------------------------------------------------------------------------
class LocalEd25519Signer implements ReportSigner {
  private privateKey: KeyObject;
  private publicKey: KeyObject;
  private keyId: string;

  constructor(masterSecret: string) {
    if (!masterSecret || masterSecret.length < 16) {
      throw new Error("PHI_ENCRYPTION_KEY too weak for report signing (min 16 chars)");
    }
    const ikm = Buffer.from(masterSecret, "utf8");
    const salt = Buffer.from("tabula-medica/report-signer/v1", "utf8");
    const info = Buffer.from("ed25519-seed", "utf8");
    const seed = Buffer.from(hkdfSync("sha256", ikm, salt, info, 32));
    this.privateKey = ed25519PrivateKeyFromSeed(seed);
    this.publicKey = createPublicKey(this.privateKey);
    // keyId = first 16 hex chars of SHA-256 of the public key (DER) — stable.
    const pubDer = this.publicKey.export({ format: "der", type: "spki" });
    this.keyId = `tm-ed25519-` + createHash("sha256").update(pubDer).digest("hex").slice(0, 16);
  }

  getKeyId(): string {
    return this.keyId;
  }

  async sign<T>(payload: T): Promise<SignedEnvelope<T>> {
    const canonical = Buffer.from(canonicalize(payload), "utf8");
    const sig = nodeSign(null, canonical, this.privateKey);
    const hash = createHash("sha256").update(canonical).digest();
    return {
      payload,
      signature: {
        algorithm: "ed25519",
        keyId: this.keyId,
        signedAt: new Date().toISOString(),
        value: b64url(sig),
        payloadHash: b64url(hash),
      },
    };
  }

  async verify<T>(envelope: SignedEnvelope<T>): Promise<boolean> {
    if (envelope.signature.algorithm !== "ed25519") return false;
    if (envelope.signature.keyId !== this.keyId) return false;
    const canonical = Buffer.from(canonicalize(envelope.payload), "utf8");
    const expectedHash = b64url(createHash("sha256").update(canonical).digest());
    if (expectedHash !== envelope.signature.payloadHash) return false;
    try {
      return nodeVerify(null, canonical, this.publicKey, b64urlDecode(envelope.signature.value));
    } catch {
      return false;
    }
  }

  getPublicKeyPem(): string {
    return this.publicKey.export({ format: "pem", type: "spki" }).toString();
  }

  getPublicKeyJwk() {
    // SPKI for Ed25519 is 12-byte ASN.1 prefix + 32-byte raw public key.
    const der = this.publicKey.export({ format: "der", type: "spki" }) as Buffer;
    const raw = der.subarray(der.length - 32);
    return {
      kty: "OKP" as const,
      crv: "Ed25519" as const,
      x: b64url(raw),
      kid: this.keyId,
      alg: "EdDSA" as const,
      use: "sig" as const,
    };
  }
}

// ---------------------------------------------------------------------------
// GCP KMS stub — implement when you provision the key.
// Set REPORT_SIGNER=gcp_kms and GCP_KMS_KEY_NAME=projects/.../locations/.../keyRings/.../cryptoKeys/.../cryptoKeyVersions/N
// ---------------------------------------------------------------------------
class GcpKmsSignerStub implements ReportSigner {
  constructor(private keyName: string) {}
  getKeyId(): string { return `gcp-kms:${this.keyName}`; }
  async sign(): Promise<never> {
    throw new Error("GcpKmsSigner not yet implemented. Set REPORT_SIGNER=local or implement GcpKmsSigner.sign() against @google-cloud/kms.");
  }
  async verify(): Promise<never> {
    throw new Error("GcpKmsSigner not yet implemented.");
  }
  getPublicKeyPem(): string {
    throw new Error("GcpKmsSigner not yet implemented.");
  }
  getPublicKeyJwk(): never {
    throw new Error("GcpKmsSigner not yet implemented.");
  }
}

// ---------------------------------------------------------------------------
// Factory — singleton.
// ---------------------------------------------------------------------------
let cached: ReportSigner | null = null;
export function getReportSigner(): ReportSigner {
  if (cached) return cached;
  const driver = (process.env.REPORT_SIGNER ?? "local").toLowerCase();
  if (driver === "gcp_kms") {
    const keyName = process.env.GCP_KMS_KEY_NAME;
    if (!keyName) throw new Error("REPORT_SIGNER=gcp_kms but GCP_KMS_KEY_NAME is unset");
    cached = new GcpKmsSignerStub(keyName);
  } else {
    const secret = process.env.PHI_ENCRYPTION_KEY;
    if (!secret) throw new Error("PHI_ENCRYPTION_KEY required for local report signer");
    cached = new LocalEd25519Signer(secret);
  }
  console.log(`[ReportSigner] driver=${driver} keyId=${cached.getKeyId()}`);
  return cached;
}

// Test-only — reset the cached singleton.
export function _resetReportSignerForTests(): void {
  cached = null;
}
