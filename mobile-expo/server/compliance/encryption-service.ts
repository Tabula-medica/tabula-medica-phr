import crypto from "crypto";
import { logger } from "../utils/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
// PBKDF2 iteration count. Per OWASP 2023, PBKDF2-SHA512 should use 210K+; we
// pick 600K (the SHA-256 minimum, conservative for SHA-512). The derived key
// is cached after first use so the ~100ms one-time cost only hits at boot.
// Bumped 2026-05-18 per audit finding M-1 (was 100000).
const ITERATIONS = 600000;

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const masterKey = process.env.PHI_ENCRYPTION_KEY;
  if (!masterKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[SECURITY] PHI_ENCRYPTION_KEY must be set in production. Refusing to use a fallback key for PHI encryption.");
    }
    logger.warn("[SECURITY] PHI_ENCRYPTION_KEY not set - using insecure fallback. This must not be used in production.");
  }
  const keySource = masterKey || "dev-only-key-not-for-production";

  // Audit finding M-2 (2026-05-18): a deterministic NODE_ENV-derived salt is
  // predictable across instances. Require an explicit PHI_ENCRYPTION_SALT in
  // production; allow the NODE_ENV fallback only in dev.
  if (!process.env.PHI_ENCRYPTION_SALT && process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] PHI_ENCRYPTION_SALT must be set in production. Refusing to derive PHI encryption key from a predictable salt.");
  }

  let salt: Buffer;
  if (process.env.PHI_ENCRYPTION_SALT) {
    salt = crypto.createHash("sha256").update(process.env.PHI_ENCRYPTION_SALT).digest();
  } else {
    salt = crypto.createHash("sha256")
      .update(`tabula-medica-phi-${process.env.NODE_ENV || "development"}`)
      .digest();
  }

  cachedKey = crypto.pbkdf2Sync(keySource, salt, ITERATIONS, KEY_LENGTH, "sha512");
  return cachedKey;
}

export function encryptPHI(plaintext: string): string {
  if (!plaintext) return plaintext;

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    
    return `enc:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    logger.error("[ENCRYPTION] Failed to encrypt PHI", { error: error instanceof Error ? error.message : error });
    throw new Error("Encryption failed");
  }
}

export function decryptPHI(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  
  if (!ciphertext.startsWith("enc:")) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted format");
    }

    const [, ivHex, authTagHex, encrypted] = parts;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    logger.error("[ENCRYPTION] Failed to decrypt PHI", { error: error instanceof Error ? error.message : error });
    throw new Error("Decryption failed");
  }
}

export function hashPHI(value: string): string {
  if (!value) return value;
  
  if (!process.env.PHI_HASH_SALT && process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] PHI_HASH_SALT must be set in production. Refusing to use a fallback salt for PHI hashing.");
  }
  const salt = process.env.PHI_HASH_SALT || "tabula-medica-phi-hash-salt";
  return crypto.createHmac("sha256", salt).update(value).digest("hex");
}

export function maskPHI(value: string, type: "ssn" | "phone" | "email" | "name" | "dob" | "mrn"): string {
  if (!value) return value;

  switch (type) {
    case "ssn":
      return `***-**-${value.slice(-4)}`;
    
    case "phone":
      const cleaned = value.replace(/\D/g, "");
      return `(***) ***-${cleaned.slice(-4)}`;
    
    case "email":
      const [local, domain] = value.split("@");
      if (!domain) return "***@***.***";
      return `${local.charAt(0)}***@${domain}`;
    
    case "name":
      return `${value.charAt(0)}${"*".repeat(value.length - 1)}`;
    
    case "dob":
      return "**/**/****";
    
    case "mrn":
      return `***${value.slice(-4)}`;
    
    default:
      return "*".repeat(value.length);
  }
}

export function tokenizePHI(value: string): { token: string; lookup: string } {
  const token = crypto.randomUUID();
  const lookup = encryptPHI(value);
  
  return { token, lookup };
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512");
  
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [saltHex, hashHex] = stored.split(":");
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");
    
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512");
    
    return crypto.timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}

export interface EncryptedField<T = string> {
  encrypted: string;
  hash: string;
  maskedPreview?: string;
}

export function createEncryptedField<T extends string>(
  value: T,
  maskType?: "ssn" | "phone" | "email" | "name" | "dob" | "mrn"
): EncryptedField<T> {
  return {
    encrypted: encryptPHI(value),
    hash: hashPHI(value),
    maskedPreview: maskType ? maskPHI(value, maskType) : undefined,
  };
}

export function decryptField<T extends string>(field: EncryptedField<T>): T {
  return decryptPHI(field.encrypted) as T;
}

const PHI_FIELDS = new Set([
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "dob",
  "birthDate",
  "medicalRecordNumber",
  "mrn",
  "insuranceId",
  "policyNumber",
  "memberId",
  "driversLicense",
  "passport",
  "bankAccount",
  "creditCard",
  "diagnosis",
  "medication",
  "procedure",
  "labResult",
  "genomicData",
  "mentalHealthNotes",
  "substanceAbuseRecords",
  "hivStatus",
  "pregnancyStatus",
]);

export function isPHIField(fieldName: string): boolean {
  return PHI_FIELDS.has(fieldName) || 
         PHI_FIELDS.has(fieldName.toLowerCase()) ||
         /ssn|dob|mrn|diagnosis|medication|lab|genetic|hiv|mental/i.test(fieldName);
}

export function encryptPHIObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToEncrypt?: string[]
): T {
  const result = { ...obj };
  
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string") {
      const shouldEncrypt = fieldsToEncrypt 
        ? fieldsToEncrypt.includes(key)
        : isPHIField(key);
      
      if (shouldEncrypt) {
        (result as Record<string, unknown>)[key] = encryptPHI(value);
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = encryptPHIObject(value as Record<string, unknown>, fieldsToEncrypt);
    }
  }
  
  return result;
}

export function decryptPHIObject<T extends Record<string, unknown>>(
  obj: T,
  fieldsToDecrypt?: string[]
): T {
  const result = { ...obj };
  
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "string" && value.startsWith("enc:")) {
      const shouldDecrypt = fieldsToDecrypt 
        ? fieldsToDecrypt.includes(key)
        : true;
      
      if (shouldDecrypt) {
        (result as Record<string, unknown>)[key] = decryptPHI(value);
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      (result as Record<string, unknown>)[key] = decryptPHIObject(value as Record<string, unknown>, fieldsToDecrypt);
    }
  }
  
  return result;
}

export const EncryptionService = {
  encrypt: encryptPHI,
  decrypt: decryptPHI,
  hash: hashPHI,
  mask: maskPHI,
  tokenize: tokenizePHI,
  generateToken: generateSecureToken,
  hashPassword,
  verifyPassword,
  createField: createEncryptedField,
  decryptField,
  isPHIField,
  encryptObject: encryptPHIObject,
  decryptObject: decryptPHIObject,
};
