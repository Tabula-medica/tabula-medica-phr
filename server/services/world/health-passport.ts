/**
 * World EHR — sovereign health passport.
 *
 * Pillar 4 (sovereign patient ownership) fails on a detail every "patient
 * owns their data" feature so far has skipped: an export is only ownership if
 * someone else can *trust* it. Today's export path (`patient-export-routes.ts`)
 * emits PDF and CSV — formats a receiving clinician cannot machine-read and
 * cannot verify. Handed a PDF, a hospital in another country has no way to
 * know whether the patient edited their own allergy list before printing it,
 * so in practice they re-take the history and the export is worthless.
 *
 * A passport fixes that by wrapping the IPS document in a detached Ed25519
 * signature over a canonical serialisation. Any third party can then verify,
 * **entirely offline**, that:
 *
 *   1. the document is byte-for-byte what Tabula Medica issued, and
 *   2. it has not been altered since.
 *
 * What it deliberately does NOT assert is that the clinical content is true.
 * Most of a PHR is patient-entered, and signing patient-entered data as if it
 * were provider-attested would be a lie with clinical consequences. Each
 * passport therefore carries an explicit `assurance` level, and verifiers are
 * expected to read it. This is the honest version of the claim, and it is the
 * reason the envelope has a provenance block at all.
 *
 * Offline verification is the whole point: a patient in a village clinic with
 * no connectivity can still prove the document's integrity from the QR code on
 * their phone, given the issuer's public key. Verification never calls home.
 */

import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
  createHash,
} from "node:crypto";
import type { IpsBundle } from "@shared/ips";

/** How much the signature actually vouches for. */
export type AssuranceLevel =
  /** Every element came from a provider feed / verified source. */
  | "provider-attested"
  /** Mixed: some elements provider-sourced, some patient-entered. */
  | "mixed"
  /** All content is patient-entered and unverified. */
  | "patient-asserted";

export interface PassportProvenance {
  assurance: AssuranceLevel;
  /**
   * Plain-language statement of what the signature means, embedded in the
   * envelope so a verifier reading raw JSON cannot miss it.
   */
  statement: string;
  /** Count of elements from a verified source vs. patient-entered. */
  verifiedElements: number;
  patientAssertedElements: number;
}

export interface PassportSignature {
  /** Only Ed25519 is supported; the field exists so the format can evolve. */
  algorithm: "Ed25519";
  /** Base64url signature over the canonical document bytes. */
  value: string;
  /** Base64url SPKI public key, so a verifier can check without a directory. */
  publicKey: string;
  /** Short fingerprint of the public key, for out-of-band comparison. */
  keyId: string;
  signedAt: string;
}

export interface HealthPassport {
  /** Envelope format version — bumped on any breaking canonicalisation change. */
  format: "tabula-medica.health-passport.v1";
  issuer: string;
  /** SHA-256 of the canonical document bytes, base64url. */
  documentHash: string;
  provenance: PassportProvenance;
  signature: PassportSignature;
  document: IpsBundle;
}

export type PassportVerification =
  | {
      valid: true;
      keyId: string;
      signedAt: string;
      assurance: AssuranceLevel;
      /** Repeated at the top level so callers cannot ignore it. */
      statement: string;
    }
  | { valid: false; reason: PassportFailure; detail: string };

export type PassportFailure =
  | "unsupported-format"
  | "unsupported-algorithm"
  | "malformed-key"
  | "hash-mismatch"
  | "signature-mismatch";

const ISSUER = "Tabula Medica";
const FORMAT = "tabula-medica.health-passport.v1";

// ── Canonicalisation ────────────────────────────────────────────────────────

/**
 * Deterministic JSON serialisation: object keys sorted at every level.
 *
 * `JSON.stringify` preserves insertion order, so two semantically identical
 * documents that were built by different code paths (or round-tripped through
 * a parser) can serialise differently and break the signature. Sorting keys
 * removes that whole class of failure. Arrays keep their order — in FHIR,
 * array order is meaningful.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

// ── Keys ────────────────────────────────────────────────────────────────────

export interface PassportKeyPair {
  privateKeyPem: string;
  publicKeyPem: string;
}

/** Generate a fresh Ed25519 signing key pair (PEM encoded). */
export function generatePassportKeyPair(): PassportKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privateKeyPem: privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString(),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
}

/**
 * Load the deployment's passport signing key from the environment.
 *
 * Returns null when unset — callers must degrade to an unsigned export rather
 * than inventing an ephemeral key. A key that changes per process would
 * produce passports nobody can verify tomorrow, which is worse than no
 * signature at all because it looks like one.
 */
export function loadSigningKeyFromEnv(): string | null {
  const raw = process.env.PASSPORT_SIGNING_KEY;
  if (!raw || !raw.trim()) return null;
  // Accept both a literal PEM and a base64-encoded PEM, since secret managers
  // differ on whether they preserve newlines.
  const trimmed = raw.trim();
  if (trimmed.includes("BEGIN")) return trimmed.replace(/\\n/g, "\n");
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Short, human-comparable fingerprint of a public key. */
export function keyFingerprint(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  });
  return b64url(sha256(der)).slice(0, 16);
}

// ── Provenance ──────────────────────────────────────────────────────────────

const STATEMENTS: Record<AssuranceLevel, string> = {
  "provider-attested":
    "Every element in this summary originated from a verified healthcare source. The signature proves the document is unaltered since issue.",
  mixed:
    "This summary mixes verified healthcare-sourced elements with elements entered by the patient. The signature proves the document is unaltered since issue; it does NOT attest that patient-entered content is clinically accurate.",
  "patient-asserted":
    "All content in this summary was entered by the patient and has not been verified against a healthcare source. The signature proves only that the document is unaltered since issue.",
};

/**
 * Derive the assurance level from how many elements came from a verified
 * source. Errs downward: any patient-entered element is enough to prevent a
 * "provider-attested" claim.
 */
export function deriveProvenance(
  verifiedElements: number,
  patientAssertedElements: number,
): PassportProvenance {
  let assurance: AssuranceLevel;
  if (patientAssertedElements === 0 && verifiedElements > 0) {
    assurance = "provider-attested";
  } else if (verifiedElements > 0) {
    assurance = "mixed";
  } else {
    assurance = "patient-asserted";
  }
  return {
    assurance,
    statement: STATEMENTS[assurance],
    verifiedElements,
    patientAssertedElements,
  };
}

// ── Issue / verify ──────────────────────────────────────────────────────────

/**
 * Wrap an IPS document in a signed passport envelope.
 *
 * `signedAt` is injected so the caller controls the clock (and so tests are
 * deterministic). The signature covers the canonical document bytes only —
 * not the envelope — so re-wrapping the same document with different
 * provenance metadata cannot silently invalidate it, and a verifier can
 * always recompute exactly what was signed.
 */
export function issuePassport(params: {
  document: IpsBundle;
  privateKeyPem: string;
  provenance: PassportProvenance;
  signedAt: string;
}): HealthPassport {
  const { document, privateKeyPem, provenance, signedAt } = params;

  const canonical = Buffer.from(canonicalize(document), "utf8");
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(privateKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();

  // Ed25519 signs the message directly; the algorithm argument must be null.
  const signature = cryptoSign(null, canonical, privateKey);

  return {
    format: FORMAT,
    issuer: ISSUER,
    documentHash: b64url(sha256(canonical)),
    provenance,
    signature: {
      algorithm: "Ed25519",
      value: b64url(signature),
      publicKey: b64url(
        publicKey.export({ type: "spki", format: "der" }) as Buffer,
      ),
      keyId: keyFingerprint(publicKeyPem),
      signedAt,
    },
    document,
  };
}

/**
 * Verify a passport with no network access and no prior knowledge of the
 * issuer beyond (optionally) a pinned public key.
 *
 * When `expectedPublicKeyDer` is omitted the signature is checked against the
 * key embedded in the envelope. That proves internal consistency — the
 * document has not been altered since it was signed — but NOT that the signer
 * is Tabula Medica, since an attacker can re-sign modified content with their
 * own key. A verifier that cares about issuer identity must pin the key
 * (compare `signature.keyId` against a published fingerprint, or pass it in
 * here). This asymmetry is stated plainly because getting it wrong is the
 * standard way signed-document schemes fail in the field.
 */
export function verifyPassport(
  passport: HealthPassport,
  expectedPublicKeyDer?: Buffer,
): PassportVerification {
  if (passport?.format !== FORMAT) {
    return {
      valid: false,
      reason: "unsupported-format",
      detail: `Unknown passport format "${passport?.format}".`,
    };
  }
  if (passport.signature?.algorithm !== "Ed25519") {
    return {
      valid: false,
      reason: "unsupported-algorithm",
      detail: `Unsupported signature algorithm "${passport.signature?.algorithm}".`,
    };
  }

  const canonical = Buffer.from(canonicalize(passport.document), "utf8");

  if (b64url(sha256(canonical)) !== passport.documentHash) {
    return {
      valid: false,
      reason: "hash-mismatch",
      detail:
        "The document does not match the hash recorded in the envelope; it has been modified.",
    };
  }

  const keyDer =
    expectedPublicKeyDer ??
    Buffer.from(passport.signature.publicKey, "base64url");

  let publicKey;
  try {
    publicKey = createPublicKey({
      key: keyDer,
      format: "der",
      type: "spki",
    });
  } catch (error) {
    return {
      valid: false,
      reason: "malformed-key",
      detail: `Public key could not be parsed: ${(error as Error).message}`,
    };
  }

  const ok = cryptoVerify(
    null,
    canonical,
    publicKey,
    Buffer.from(passport.signature.value, "base64url"),
  );

  if (!ok) {
    return {
      valid: false,
      reason: "signature-mismatch",
      detail:
        "The signature does not verify against the document under this key.",
    };
  }

  return {
    valid: true,
    keyId: passport.signature.keyId,
    signedAt: passport.signature.signedAt,
    assurance: passport.provenance.assurance,
    statement: passport.provenance.statement,
  };
}
