import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";

function shortFingerprint(value: string | undefined): string {
  if (!value) return "MISSING";
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function getEffectiveSalt(): string | undefined {
  const v2 = process.env.PHI_ENCRYPTION_SALT_V2;
  const legacy = process.env.PHI_ENCRYPTION_SALT;
  const key = process.env.PHI_ENCRYPTION_KEY || "";
  if (v2 && v2.length === 64 && v2 !== key) return v2;
  if (legacy && legacy.length === 64 && legacy !== key) return legacy;
  if (legacy && legacy.length === 128 && key && legacy.startsWith(key)) {
    const stripped = legacy.slice(64);
    if (stripped !== key) return stripped;
  }
  return legacy || undefined;
}

let fingerprintsLogged = false;
export function logPhiKeyFingerprints(): void {
  if (fingerprintsLogged) return;
  fingerprintsLogged = true;
  const fp = (n: string) => `${n}=${shortFingerprint(process.env[n])}`;
  const effective = getEffectiveSalt();
  const effFp = effective ? shortFingerprint(effective) : "MISSING";
  const lengthInfo = effective ? `len=${effective.length}` : "len=0";
  console.log(
    `[PHI-Encryption] Key fingerprints (sha256[:12]) — ${fp("PHI_ENCRYPTION_KEY")} | ${fp("PHI_ENCRYPTION_SALT")} | EFFECTIVE_SALT=${effFp} (${lengthInfo}) | ${fp("CARE_BRIDGE_SECRET")}`,
  );
  const key = process.env.PHI_ENCRYPTION_KEY || "";
  if (effective && effective === key) {
    console.warn("[PHI-Encryption] WARNING: effective salt equals encryption key — KDF reduced to single-secret mode");
  }
  if (process.env.PHI_ENCRYPTION_SALT && key && process.env.PHI_ENCRYPTION_SALT.includes(key)) {
    console.warn("[PHI-Encryption] WARNING: PHI_ENCRYPTION_SALT contains PHI_ENCRYPTION_KEY substring — please rotate salt to a fresh random value");
  }
}


const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.PHI_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  
  if (isProduction && !process.env.PHI_ENCRYPTION_KEY) {
    throw new Error("CRITICAL: PHI_ENCRYPTION_KEY must be set in production for HIPAA compliance");
  }
  
  if (!secret) {
    if (isProduction) {
      throw new Error("CRITICAL: No encryption key available in production");
    }
    console.warn("[PHI-Encryption] WARNING: Using development fallback key - NOT FOR PRODUCTION USE");
  }
  
  const effectiveSecret = secret || "dev-only-key-not-for-production-use";
  const salt = getEffectiveSalt() || (isProduction ? undefined : "dev-salt");
  
  if (isProduction && !getEffectiveSalt()) {
    throw new Error("CRITICAL: PHI_ENCRYPTION_SALT (or _V2) must be set in production");
  }
  
  return scryptSync(effectiveSecret, salt || "dev-salt", KEY_LENGTH);
}

export function encryptPhi(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptPhi(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(":")) return encryptedData;
  
  const parts = encryptedData.split(":");
  if (parts.length !== 3) return encryptedData;
  
  const [ivHex, authTagHex, encrypted] = parts;
  
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error("Invalid authentication tag length");
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("[PHI-Encryption] Decryption failed - data may be corrupted or key mismatch");
    return encryptedData;
  }
}

export function encryptPhiObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fieldsToEncrypt) {
    const value = result[field];
    if (typeof value === "string" && value) {
      (result as any)[field] = encryptPhi(value);
    }
  }
  
  return result;
}

export function decryptPhiObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fieldsToDecrypt) {
    const value = result[field];
    if (typeof value === "string" && value) {
      (result as any)[field] = decryptPhi(value);
    }
  }
  
  return result;
}

export function hashPhiForSearch(value: string): string {
  const key = getEncryptionKey();
  const hash = scryptSync(value.toLowerCase().trim(), key, 32);
  return hash.toString("hex");
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encrypted] = parts;
  return ivHex.length === IV_LENGTH * 2 && 
         authTagHex.length === AUTH_TAG_LENGTH * 2 && 
         encrypted.length > 0;
}

export const PHI_FIELDS = {
  patient: ["name", "email", "phone", "address", "ssn", "dateOfBirth", "mrn"] as const,
  medication: ["patientId", "prescribedBy"] as const,
  labResult: ["patientId", "orderedBy"] as const,
  message: ["content", "senderName", "recipientName"] as const,
  appointment: ["patientId", "notes"] as const,
  oauthTokens: ["accessToken", "refreshToken", "idToken"] as const,
  ehrConnection: ["accessToken", "refreshToken", "idToken", "clientSecret"] as const,
  wearableConnection: ["accessToken", "refreshToken", "idToken"] as const,
} as const;

export const OAUTH_TOKEN_FIELDS = PHI_FIELDS.oauthTokens;

export function encryptOAuthTokens<T extends Record<string, any>>(tokens: T): T {
  return encryptPhiObject(tokens, OAUTH_TOKEN_FIELDS as unknown as (keyof T)[]);
}

export function decryptOAuthTokens<T extends Record<string, any>>(tokens: T | undefined): T | undefined {
  if (!tokens) return tokens;
  return decryptPhiObject(tokens, OAUTH_TOKEN_FIELDS as unknown as (keyof T)[]);
}

export function encryptConnectionForStorage<T extends Record<string, any>>(
  connection: T,
  kind: "ehrConnection" | "wearableConnection",
): T {
  if (!connection) return connection;
  const result = { ...connection } as any;
  const topLevelFields = PHI_FIELDS[kind] as readonly string[];
  for (const field of topLevelFields) {
    if (typeof result[field] === "string" && result[field]) {
      result[field] = encryptPhi(result[field]);
    }
  }
  if (result.tokens && typeof result.tokens === "object") {
    result.tokens = encryptOAuthTokens(result.tokens);
  }
  return result as T;
}

export function decryptConnectionFromStorage<T extends Record<string, any>>(
  connection: T | undefined,
  kind: "ehrConnection" | "wearableConnection",
): T | undefined {
  if (!connection) return connection;
  const result = { ...connection } as any;
  const topLevelFields = PHI_FIELDS[kind] as readonly string[];
  for (const field of topLevelFields) {
    if (typeof result[field] === "string" && result[field] && isEncrypted(result[field])) {
      result[field] = decryptPhi(result[field]);
    }
  }
  if (result.tokens && typeof result.tokens === "object") {
    result.tokens = decryptOAuthTokens(result.tokens);
  }
  return result as T;
}

export function getSecurityStatus(): {
  tlsMinVersion: string;
  encryptionAlgorithm: string;
  keyDerivation: string;
  keyLength: number;
  ivLength: number;
  isProductionReady: boolean;
} {
  const hasCustomKey = !!(process.env.PHI_ENCRYPTION_KEY && process.env.PHI_ENCRYPTION_KEY !== "default-dev-key-change-in-production");
  
  return {
    tlsMinVersion: "1.2",
    encryptionAlgorithm: ALGORITHM,
    keyDerivation: "scrypt",
    keyLength: KEY_LENGTH * 8,
    ivLength: IV_LENGTH * 8,
    isProductionReady: hasCustomKey,
  };
}
