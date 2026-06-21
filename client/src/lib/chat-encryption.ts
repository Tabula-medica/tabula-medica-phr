const ALGO = "AES-GCM";
const KEY_LENGTH = 256;

function uint8ToBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes).map((b) => String.fromCharCode(b)).join(""));
}

function base64ToUint8(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return uint8ToBase64(new Uint8Array(exported));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToUint8(base64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  salt: string
): Promise<CryptoKey> {
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );

  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBytes, info: encoder.encode("telehealth-chat") },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: uint8ToBase64(new Uint8Array(encrypted)),
    iv: uint8ToBase64(iv),
  };
}

export async function decryptMessage(
  key: CryptoKey,
  ciphertext: string,
  iv: string
): Promise<string> {
  const decoder = new TextDecoder();
  const cipherBytes = base64ToUint8(ciphertext);
  const ivBytes = base64ToUint8(iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGO, iv: ivBytes },
    key,
    cipherBytes
  );
  return decoder.decode(decrypted);
}
