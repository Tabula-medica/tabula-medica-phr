// ABDM health-information data-flow cryptography (India).
//
// Distinct from `crypto.ts`. That module RSA-encrypts identifiers (Aadhaar, OTP) for the ABHA
// enrollment API. This module implements the ABDM/NCG *data flow* scheme, which is how clinical
// payloads move from a HIP to a HIU:
//
//   1. Each side generates an ephemeral X25519 keypair and a 32-byte nonce.
//   2. Public keys and nonces are exchanged in the clear as `keyMaterial`.
//   3. sharedSecret = X25519(ourPrivate, theirPublic)
//   4. xor       = ourNonce XOR theirNonce        (32 bytes; XOR is commutative, so both
//                                                  sides derive the same value regardless of
//                                                  which one is "sender")
//      salt      = xor[0..20)
//      iv        = xor[20..32)
//   5. aesKey    = HKDF-SHA256(ikm = sharedSecret, salt, info, 32 bytes)
//   6. payload   = AES-256-GCM(aesKey, iv), the 16-byte tag APPENDED to the ciphertext
//      (Java's `AES/GCM/NoPadding`, which every ABDM reference implementation uses, produces
//      exactly this layout — Node keeps the tag separate, so we split it off explicitly).
//
// UNVERIFIED AGAINST A LIVE HIP: the HKDF `info` parameter. The ABDM reference implementations
// derive with an EMPTY info, which is the default below and is centralized in HKDF_INFO. If a
// real sandbox transfer fails to decrypt with an auth-tag error and the key material was
// exchanged correctly, this is the first parameter to check. A wrong `info` produces a wrong
// key, which GCM reports as an authentication failure — it cannot silently return wrong
// plaintext, so the failure mode here is loud.
//
// Nothing in this file logs. Keys, nonces and plaintext are all either secret or PHI.
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";

export const ABDM_CRYPTO_ALG = "ECDH";
export const ABDM_CURVE = "Curve25519";
/** ABDM's literal `parameters` string for the DH public key. Sent verbatim; do not "tidy" it. */
export const ABDM_DH_PARAMETERS = "Curve25519/32byte random key";

const NONCE_BYTES = 32;
const SALT_BYTES = 20;
const IV_BYTES = 12;
const AES_KEY_BYTES = 32;
const GCM_TAG_BYTES = 16;
/** See the header note: empty in every ABDM reference implementation. */
const HKDF_INFO = Buffer.alloc(0);
/** DER SPKI prefix for an X25519 public key (OID 1.3.101.110), followed by the raw 32 bytes. */
const X25519_SPKI_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** ABDM `keyMaterial` block, exchanged in the clear alongside every data-flow request/transfer. */
export interface AbdmKeyMaterial {
  cryptoAlg: string;
  curve: string;
  dhPublicKey: { expiry: string; parameters: string; keyValue: string };
  nonce: string;
}

/** Our half of a key exchange. `privateKeyPem` never leaves the server and is never logged. */
export interface AbdmKeyPairMaterial {
  keyMaterial: AbdmKeyMaterial;
  privateKeyPem: string;
  nonce: string;
}

function decodeBase64(value: unknown, label: string): Buffer {
  if (typeof value !== "string") throw new Error(`${label} is missing`);
  const compact = value.replace(/\s+/g, "");
  if (!compact || !BASE64.test(compact)) throw new Error(`${label} is not valid base64`);
  return Buffer.from(compact, "base64");
}

function decodeNonce(value: unknown, label: string): Buffer {
  const buf = decodeBase64(value, label);
  // Exact length, never padded or truncated. A short nonce silently yields a different salt/IV
  // and therefore a different key — and it is remote-controlled input, so it is also the lever
  // an attacker would reach for. Refuse instead.
  if (buf.length !== NONCE_BYTES) {
    throw new Error(`${label} must be ${NONCE_BYTES} bytes, got ${buf.length}`);
  }
  return buf;
}

/**
 * Import a peer's X25519 public key. ABDM implementations are inconsistent about the encoding,
 * so both are accepted: raw 32 bytes (the common case) and full DER SPKI. Anything that parses
 * to a non-X25519 key is refused — a P-256 key reaching this path would be a curve-confusion
 * attempt, not a formatting quirk.
 */
export function importPeerPublicKey(keyValue: unknown): KeyObject {
  const raw = decodeBase64(keyValue, "dhPublicKey.keyValue");
  let key: KeyObject;
  if (raw.length === 32) {
    key = createPublicKey({ key: Buffer.concat([X25519_SPKI_PREFIX, raw]), format: "der", type: "spki" });
  } else {
    try {
      key = createPublicKey({ key: raw, format: "der", type: "spki" });
    } catch {
      throw new Error("dhPublicKey.keyValue is neither a raw 32-byte X25519 key nor DER SPKI");
    }
  }
  if (key.asymmetricKeyType !== "x25519") {
    throw new Error(`dhPublicKey.keyValue is a ${key.asymmetricKeyType ?? "unknown"} key, expected x25519`);
  }
  return key;
}

/** Raw 32-byte base64 — the encoding ABDM peers expect in `dhPublicKey.keyValue`. */
function exportRawPublicKey(key: KeyObject): string {
  return key.export({ type: "spki", format: "der" }).subarray(X25519_SPKI_PREFIX.length).toString("base64");
}

/**
 * Generate our ephemeral half of a data-flow key exchange. Ephemeral per request: reusing a
 * keypair across transactions would let one recovered private key decrypt every past transfer.
 */
export function generateKeyMaterial(nowMs: number, ttlMs = 24 * 60 * 60 * 1000): AbdmKeyPairMaterial {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  const nonce = randomBytes(NONCE_BYTES).toString("base64");
  return {
    keyMaterial: {
      cryptoAlg: ABDM_CRYPTO_ALG,
      curve: ABDM_CURVE,
      dhPublicKey: {
        expiry: new Date(nowMs + ttlMs).toISOString(),
        parameters: ABDM_DH_PARAMETERS,
        keyValue: exportRawPublicKey(publicKey),
      },
      nonce,
    },
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    nonce,
  };
}

export interface TransferSecretInput {
  /** PKCS#8 PEM from `generateKeyMaterial`. */
  privateKeyPem: string;
  /** The peer's `keyMaterial.dhPublicKey.keyValue`. */
  peerKeyValue: string;
  /** Our `keyMaterial.nonce`. */
  ourNonce: string;
  /** The peer's `keyMaterial.nonce`. */
  peerNonce: string;
}

/** Derive the AES key and IV for one transfer. Both nonces must be present and 32 bytes. */
export function deriveTransferSecret(input: TransferSecretInput): { key: Buffer; iv: Buffer } {
  const ourNonce = decodeNonce(input.ourNonce, "our nonce");
  const peerNonce = decodeNonce(input.peerNonce, "peer nonce");
  const shared = diffieHellman({
    privateKey: importOurPrivateKey(input.privateKeyPem),
    publicKey: importPeerPublicKey(input.peerKeyValue),
  });
  // Defence in depth: OpenSSL already refuses a low-order peer key, but an all-zero shared
  // secret must never be allowed to derive a working key — it would be a key the peer chose.
  if (shared.every((b) => b === 0)) throw new Error("X25519 produced an all-zero shared secret");

  const xor = Buffer.alloc(NONCE_BYTES);
  for (let i = 0; i < NONCE_BYTES; i++) xor[i] = ourNonce[i] ^ peerNonce[i];

  return {
    key: Buffer.from(hkdfSync("sha256", shared, xor.subarray(0, SALT_BYTES), HKDF_INFO, AES_KEY_BYTES)),
    iv: xor.subarray(NONCE_BYTES - IV_BYTES),
  };
}

function importOurPrivateKey(pem: string): KeyObject {
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== "x25519") {
    throw new Error(`our private key is a ${key.asymmetricKeyType ?? "unknown"} key, expected x25519`);
  }
  return key;
}

/**
 * Decrypt one ABDM transfer entry. Returns UTF-8 (entries are FHIR bundles).
 *
 * A wrong key, a tampered payload, or a swapped nonce all surface here as a GCM authentication
 * failure. That is the intended behaviour — there is no configuration under which this returns
 * plaintext it could not authenticate.
 */
export function decryptHealthInformation(content: string, secret: { key: Buffer; iv: Buffer }): string {
  const payload = decodeBase64(content, "encrypted content");
  if (payload.length <= GCM_TAG_BYTES) throw new Error("encrypted content is too short to carry a GCM tag");
  const ciphertext = payload.subarray(0, payload.length - GCM_TAG_BYTES);
  const tag = payload.subarray(payload.length - GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", secret.key, secret.iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * The HIP side of the same scheme. Present because a decryption routine with no counterpart
 * cannot be tested end-to-end, and an untested crypto path is one that fails in the sandbox
 * instead of here.
 */
export function encryptHealthInformation(plaintext: string, secret: { key: Buffer; iv: Buffer }): string {
  const cipher = createCipheriv("aes-256-gcm", secret.key, secret.iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([ciphertext, cipher.getAuthTag()]).toString("base64");
}
