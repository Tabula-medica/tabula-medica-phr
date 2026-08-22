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
  format: "tabula-medica.health-passport.v2";
  issuer: string;
  /** SHA-256 of the canonical document bytes, base64url. */
  documentHash: string;
  provenance: PassportProvenance;
  signature: PassportSignature;
  document: IpsBundle;
}

/**
 * How much the verifier actually knows about who signed.
 *
 * `pinned` — the signature verified under a key the verifier already trusted,
 * so `keyId`, `assurance` and `statement` are the issuer's claims.
 *
 * `unverified-issuer` — the signature verified only under the key carried
 * inside the envelope. That proves the envelope is internally consistent and
 * unaltered *since whoever signed it did so*; it says nothing about who that
 * was. Anyone can mint a self-consistent passport with their own key and put
 * any `keyId` and any `assurance` in it.
 */
export type PassportKeyTrust = "pinned" | "unverified-issuer";

export type PassportVerification =
  | {
      valid: true;
      /** Whether the signing key was one the verifier already trusted. */
      keyTrust: PassportKeyTrust;
      /** True only when keyTrust is "pinned". The field callers must branch on. */
      issuerVerified: boolean;
      keyId: string;
      signedAt: string;
      assurance: AssuranceLevel;
      /** Repeated at the top level so callers cannot ignore it. */
      statement: string;
      /**
       * Present whenever `issuerVerified` is false. Says, in the response
       * itself, that `keyId` and `assurance` are unauthenticated claims — a
       * consumer that reads only `valid` would otherwise treat a self-signed
       * forgery as an attested clinical document.
       */
      caveat?: string;
    }
  | { valid: false; reason: PassportFailure; detail: string };

export type PassportFailure =
  | "unsupported-format"
  | "superseded-format"
  | "unsupported-algorithm"
  | "document-too-complex"
  | "malformed-key"
  | "hash-mismatch"
  | "signature-mismatch";

const ISSUER = "Tabula Medica";
const FORMAT = "tabula-medica.health-passport.v2";
/**
 * v1 signed only the document bytes, leaving `provenance.assurance` outside
 * the signature. Accepting it now would be a downgrade attack: an attacker
 * could relabel a v2 envelope as v1 and regain the ability to edit the
 * assurance level under a genuine issuer signature. It is refused outright.
 */
const SUPERSEDED_FORMAT = "tabula-medica.health-passport.v1";

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
export class DocumentTooComplexError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "DocumentTooComplexError";
  }
}

/**
 * Bounds on what canonicalisation will walk.
 *
 * The verify endpoint is unauthenticated by design, so an anonymous caller
 * controls the tree this function recurses over. Without a bound, a deeply
 * nested or very wide body buys an attacker a full recursive walk — key sort
 * and string build at every level — before any cheap cryptographic rejection
 * can happen, and deep enough nesting overflows the stack outright.
 *
 * A real IPS bundle is shallow and a few thousand nodes at most, so these
 * limits are far above any legitimate document and still bound the work.
 */
export const CANONICALIZE_MAX_DEPTH = 64;
export const CANONICALIZE_MAX_NODES = 200_000;

export function canonicalize(value: unknown): string {
  return canonicalizeNode(value, 0, { count: 0 });
}

function canonicalizeNode(
  value: unknown,
  depth: number,
  budget: { count: number },
): string {
  if (depth > CANONICALIZE_MAX_DEPTH) {
    throw new DocumentTooComplexError(
      `Document nests deeper than ${CANONICALIZE_MAX_DEPTH} levels.`,
    );
  }
  if ((budget.count += 1) > CANONICALIZE_MAX_NODES) {
    throw new DocumentTooComplexError(
      `Document holds more than ${CANONICALIZE_MAX_NODES} values.`,
    );
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeNode(v, depth + 1, budget)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalizeNode(v, depth + 1, budget)}`)
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
 * The bytes actually signed.
 *
 * v1 signed the canonical document alone, on the reasoning that re-wrapping
 * the same document with different provenance metadata should not invalidate
 * the signature. That reasoning was backwards. It meant `provenance.assurance`
 * — the field that says whether a clinician may rely on this content — sat
 * outside the signature, so a genuine `patient-asserted` passport could be
 * edited in transit to read `provider-attested` and would still verify under
 * the real issuer key. The whole envelope is now bound.
 *
 * `documentHash` stands in for the document itself: it is checked against a
 * freshly computed hash before the signature is examined, so binding the hash
 * binds the content.
 */
function signedAttributes(passport: {
  format: string;
  issuer: string;
  documentHash: string;
  provenance: PassportProvenance;
  signature: Omit<PassportSignature, "value">;
}): Buffer {
  return Buffer.from(
    canonicalize({
      format: passport.format,
      issuer: passport.issuer,
      documentHash: passport.documentHash,
      provenance: passport.provenance,
      signature: {
        algorithm: passport.signature.algorithm,
        publicKey: passport.signature.publicKey,
        keyId: passport.signature.keyId,
        signedAt: passport.signature.signedAt,
      },
    }),
    "utf8",
  );
}

/**
 * Wrap an IPS document in a signed passport envelope.
 *
 * `signedAt` is injected so the caller controls the clock (and so tests are
 * deterministic). The signature covers the envelope — issuer, document hash,
 * provenance and key metadata — so no field a verifier reads can be altered
 * without breaking it.
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

  const unsigned = {
    format: FORMAT,
    issuer: ISSUER,
    documentHash: b64url(sha256(canonical)),
    provenance,
    signature: {
      algorithm: "Ed25519" as const,
      publicKey: b64url(
        publicKey.export({ type: "spki", format: "der" }) as Buffer,
      ),
      keyId: keyFingerprint(publicKeyPem),
      signedAt,
    },
  };

  // Ed25519 signs the message directly; the algorithm argument must be null.
  const signature = cryptoSign(null, signedAttributes(unsigned), privateKey);

  return {
    ...unsigned,
    format: FORMAT,
    signature: { ...unsigned.signature, value: b64url(signature) },
    document,
  };
}

/**
 * Load public keys this deployment trusts as passport issuers.
 *
 * Accepts a comma- or newline-separated list of SPKI PEM keys (each optionally
 * base64-wrapped, since secret managers differ on newline handling) in
 * `PASSPORT_TRUSTED_PUBLIC_KEYS`. The deployment's own signing key is added by
 * the caller — a host that issues passports trivially trusts itself.
 *
 * An empty list is the honest default: a verifier with no trusted keys reports
 * `issuerVerified: false` rather than pretending it recognised the signer.
 */
export function loadTrustedPublicKeysFromEnv(): Buffer[] {
  const raw = process.env.PASSPORT_TRUSTED_PUBLIC_KEYS;
  if (!raw || !raw.trim()) return [];

  const keys: Buffer[] = [];
  const add = (pem: string | null) => {
    if (!pem) return;
    try {
      const der = createPublicKey(pem).export({
        type: "spki",
        format: "der",
      }) as Buffer;
      if (!keys.some((k) => k.equals(der))) keys.push(der);
    } catch {
      // A malformed entry is skipped rather than thrown: one bad key must not
      // take the verify endpoint down, and the result of skipping is a *less*
      // trusting verifier, never a more trusting one.
    }
  };

  // PEM blocks are pulled out whole first — their bodies contain newlines, so
  // splitting the variable on whitespace would shred them.
  const pemBlock = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g;
  const remainder = raw.replace(/\\n/g, "\n").replace(pemBlock, (block) => {
    add(block);
    return " ";
  });

  // Anything left over is treated as base64-wrapped PEM, since secret managers
  // differ on whether they preserve newlines.
  for (const token of remainder.split(/[,\s]+/)) {
    if (token.trim()) add(safeBase64ToUtf8(token.trim()));
  }

  return keys;
}

function safeBase64ToUtf8(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded.includes("BEGIN") ? decoded : null;
  } catch {
    return null;
  }
}

/** DER SPKI bytes of a PEM public key, for building a trusted-key list. */
export function publicKeyDer(publicKeyPem: string): Buffer {
  return createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  }) as Buffer;
}

const UNVERIFIED_ISSUER_CAVEAT =
  "The signature verified only under the key carried inside this passport, " +
  "which this verifier does not recognise. `keyId`, `assurance` and " +
  "`statement` are therefore unauthenticated claims made by whoever signed " +
  "it — anyone can mint a self-consistent passport asserting any issuer and " +
  "any assurance level. Do NOT treat this document as issuer-verified or " +
  "provider-attested without comparing keyId against the issuer's published " +
  "fingerprint out of band.";

/**
 * Verify a passport with no network access.
 *
 * Pass the public key(s) the verifier trusts. When none are supplied the
 * signature is still checked, but only against the key embedded in the
 * envelope — which proves the envelope is internally consistent and NOT that
 * the signer is who the envelope says. That distinction is carried in the
 * result as `keyTrust` / `issuerVerified` / `caveat`, not left to a docstring,
 * because a caller reading `valid` alone is exactly how signed-document
 * schemes fail in the field.
 */
export function verifyPassport(
  passport: HealthPassport,
  expectedPublicKeyDer?: Buffer | readonly Buffer[],
): PassportVerification {
  // The declared type is a literal, but this input arrives off the wire and
  // can hold anything, so the format is compared as a plain string.
  const declaredFormat: string = passport?.format;
  if (declaredFormat === SUPERSEDED_FORMAT) {
    return {
      valid: false,
      reason: "superseded-format",
      detail:
        `Passport format "${SUPERSEDED_FORMAT}" is no longer accepted: its ` +
        "signature did not cover the provenance block, so the assurance level " +
        "could be altered without breaking the signature. Re-issue as " +
        `"${FORMAT}".`,
    };
  }
  if (declaredFormat !== FORMAT) {
    return {
      valid: false,
      reason: "unsupported-format",
      detail: `Unknown passport format "${declaredFormat}".`,
    };
  }
  if (passport.signature?.algorithm !== "Ed25519") {
    return {
      valid: false,
      reason: "unsupported-algorithm",
      detail: `Unsupported signature algorithm "${passport.signature?.algorithm}".`,
    };
  }

  // Bounded, and the bound is checked before the signature: canonicalising an
  // attacker-supplied tree is the expensive half of this endpoint.
  let canonical: Buffer;
  try {
    canonical = Buffer.from(canonicalize(passport.document), "utf8");
  } catch (error) {
    if (error instanceof DocumentTooComplexError) {
      return {
        valid: false,
        reason: "document-too-complex",
        detail: `${error.message} It was rejected without being verified.`,
      };
    }
    throw error;
  }

  if (b64url(sha256(canonical)) !== passport.documentHash) {
    return {
      valid: false,
      reason: "hash-mismatch",
      detail:
        "The document does not match the hash recorded in the envelope; it has been modified.",
    };
  }

  const trusted = expectedPublicKeyDer
    ? Array.isArray(expectedPublicKeyDer)
      ? (expectedPublicKeyDer as readonly Buffer[])
      : [expectedPublicKeyDer as Buffer]
    : [];

  // With no trusted key, fall back to the envelope's own — and say so in the
  // result. Never silently upgrade a self-asserted key to a trusted one.
  const candidates = trusted.length
    ? trusted
    : [Buffer.from(passport.signature.publicKey, "base64url")];
  const keyTrust: PassportKeyTrust = trusted.length ? "pinned" : "unverified-issuer";

  const signed = signedAttributes(passport);
  const signatureBytes = Buffer.from(passport.signature.value, "base64url");

  let parsedAny = false;
  let verified = false;
  for (const keyDer of candidates) {
    let publicKey;
    try {
      publicKey = createPublicKey({ key: keyDer, format: "der", type: "spki" });
    } catch {
      continue;
    }
    parsedAny = true;
    if (cryptoVerify(null, signed, publicKey, signatureBytes)) {
      verified = true;
      break;
    }
  }

  if (!parsedAny) {
    return {
      valid: false,
      reason: "malformed-key",
      detail:
        trusted.length > 0
          ? "No trusted public key could be parsed."
          : "Public key could not be parsed from the passport envelope.",
    };
  }

  if (!verified) {
    return {
      valid: false,
      reason: "signature-mismatch",
      detail:
        trusted.length > 0
          ? "The signature does not verify against this envelope under any trusted key."
          : "The signature does not verify against this envelope under the key it carries.",
    };
  }

  return {
    valid: true,
    keyTrust,
    issuerVerified: keyTrust === "pinned",
    keyId: passport.signature.keyId,
    signedAt: passport.signature.signedAt,
    assurance: passport.provenance.assurance,
    statement: passport.provenance.statement,
    ...(keyTrust === "pinned" ? {} : { caveat: UNVERIFIED_ISSUER_CAVEAT }),
  };
}
