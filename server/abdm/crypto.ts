// ABDM field encryption (India). Aadhaar/mobile/OTP must be RSA-encrypted with ABDM's public cert
// before leaving the server. OAEP-SHA1 default (confirm against the live sandbox; switch to pkcs1 if
// a call returns a decryption error). Never log plaintext/ciphertext of identifiers.
// Mirrors omnihealth-ehr api/src/integrations/abdm-crypto.ts.
import { publicEncrypt, createPublicKey, constants } from "node:crypto";
import { abdmConfig } from "./config";
import { abdmFetch } from "./fetch";

export type RsaPadding = "oaep-sha1" | "pkcs1";

export function rsaEncrypt(publicKeyPem: string, value: string, padding: RsaPadding = "oaep-sha1"): string {
  const key = createPublicKey(publicKeyPem);
  const opts =
    padding === "pkcs1"
      ? { key, padding: constants.RSA_PKCS1_PADDING }
      : { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" as const };
  return publicEncrypt(opts, Buffer.from(value, "utf8")).toString("base64");
}

let cachedCert: { pem: string; fetchedAtMs: number } | null = null;
const CERT_TTL_MS = 6 * 60 * 60 * 1000;

export async function getAbdmPublicCert(nowMs: number): Promise<string> {
  if (cachedCert && cachedCert.fetchedAtMs > nowMs - CERT_TTL_MS) return cachedCert.pem;
  const res = await abdmFetch(`${abdmConfig.abhaBaseUrl}/v3/profile/public/certificate`, {
    method: "GET",
    headers: { "X-CM-ID": abdmConfig.cmId },
  });
  if (!res.ok) throw new Error(`ABDM public certificate fetch failed: ${res.status}`);
  const text = await res.text();
  const pem = text.trim().startsWith("{") ? (JSON.parse(text).publicKey as string) : text;
  if (!pem?.includes("PUBLIC KEY") && !pem?.includes("CERTIFICATE")) throw new Error("ABDM certificate response was not a PEM");
  cachedCert = { pem, fetchedAtMs: nowMs };
  return pem;
}

export function _resetAbdmCertCache(): void {
  cachedCert = null;
}
