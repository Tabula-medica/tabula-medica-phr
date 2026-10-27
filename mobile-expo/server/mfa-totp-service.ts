import { db } from "./db";
import { mfaCredentials, users } from "@shared/schema";
import type { InsertMfaCredential, MfaCredential } from "@shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "./utils/logger";

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";
const SECRET_LENGTH = 20;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const TIME_WINDOW = 1;

function getEncryptionKey(): Buffer {
  const keySource = process.env.MFA_ENCRYPTION_KEY;
  if (!keySource && process.env.NODE_ENV === "production") {
    throw new Error("[MFA-TOTP] MFA_ENCRYPTION_KEY must be set in production");
  }
  const effectiveKey = keySource || process.env.DATABASE_URL || "dev-only-mfa-key";
  return crypto.createHash("sha256").update(effectiveKey).digest();
}

function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function base32Encode(buffer: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanedInput = encoded.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleanedInput) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function generateTOTP(secret: string, counter: number): string {
  const decodedSecret = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac(TOTP_ALGORITHM, decodedSecret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

function verifyTOTPToken(secret: string, token: string, window: number = TIME_WINDOW): boolean {
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  for (let i = -window; i <= window; i++) {
    const expectedToken = generateTOTP(secret, counter + i);
    if (token.length === expectedToken.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return true;
    }
  }
  return false;
}

function hashSHA256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateRandomAlphanumeric(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

class MfaTotpService {
  async enrollTotp(userId: string): Promise<{ secret: string; qrCodeUri: string; backupCodes: string[] }> {
    logger.info("[MFA-TOTP] Starting TOTP enrollment", { category: "authentication", metadata: { userId } });

    const rawSecret = crypto.randomBytes(SECRET_LENGTH);
    const base32Secret = base32Encode(rawSecret);

    const backupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      backupCodes.push(generateRandomAlphanumeric(BACKUP_CODE_LENGTH));
    }

    const encryptedSecret = encryptSecret(base32Secret);
    const hashedBackupCodes = backupCodes.map((code) => hashSHA256(code));

    const userResult = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const email = userResult[0]?.email || "user@tabulamedica.com";

    const existing = await db
      .select()
      .from(mfaCredentials)
      .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.method, "totp")))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(mfaCredentials)
        .set({
          secretHash: encryptedSecret,
          backupCodesHash: JSON.stringify(hashedBackupCodes),
          isEnabled: false,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(mfaCredentials.id, existing[0].id));
    } else {
      await db.insert(mfaCredentials).values({
        userId,
        method: "totp",
        isEnabled: false,
        isPrimary: true,
        secretHash: encryptedSecret,
        backupCodesHash: JSON.stringify(hashedBackupCodes),
        failedAttempts: 0,
      });
    }

    const qrCodeUri = `otpauth://totp/TabulaMedica:${encodeURIComponent(email)}?secret=${base32Secret}&issuer=TabulaMedica&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    logger.info("[MFA-TOTP] TOTP enrollment initiated", { category: "authentication", metadata: { userId } });

    return {
      secret: base32Secret,
      qrCodeUri,
      backupCodes,
    };
  }

  async confirmEnrollment(userId: string, token: string): Promise<boolean> {
    logger.info("[MFA-TOTP] Confirming enrollment", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential || !credential.secretHash) {
      logger.warn("[MFA-TOTP] No pending enrollment found", { category: "authentication", metadata: { userId } });
      return false;
    }

    if (credential.isEnabled) {
      logger.warn("[MFA-TOTP] MFA already enabled", { category: "authentication", metadata: { userId } });
      return false;
    }

    const secret = decryptSecret(credential.secretHash);
    const valid = verifyTOTPToken(secret, token);

    if (!valid) {
      logger.warn("[MFA-TOTP] Invalid token during enrollment confirmation", { category: "authentication", metadata: { userId } });
      return false;
    }

    await db
      .update(mfaCredentials)
      .set({
        isEnabled: true,
        isPrimary: true,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mfaCredentials.id, credential.id));

    logger.info("[MFA-TOTP] MFA successfully enabled", { category: "authentication", metadata: { userId } });
    return true;
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    logger.debug("[MFA-TOTP] Verifying token", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential || !credential.isEnabled || !credential.secretHash) {
      logger.warn("[MFA-TOTP] No enabled MFA credential found", { category: "authentication", metadata: { userId } });
      return false;
    }

    if (credential.lockedUntil && new Date(credential.lockedUntil) > new Date()) {
      const remainingMs = new Date(credential.lockedUntil).getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      logger.warn("[MFA-TOTP] Account locked", { category: "authentication", metadata: { userId, remainingMin } });
      return false;
    }

    const secret = decryptSecret(credential.secretHash);
    const valid = verifyTOTPToken(secret, token);

    if (valid) {
      await db
        .update(mfaCredentials)
        .set({
          failedAttempts: 0,
          lockedUntil: null,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mfaCredentials.id, credential.id));

      logger.info("[MFA-TOTP] Token verified successfully", { category: "authentication", metadata: { userId } });
      return true;
    }

    const newFailedAttempts = (credential.failedAttempts || 0) + 1;
    const updateData: Record<string, unknown> = {
      failedAttempts: newFailedAttempts,
      updatedAt: new Date(),
    };

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      logger.warn("[MFA-TOTP] Account locked after failed attempts", { category: "authentication", metadata: { userId, failedAttempts: newFailedAttempts } });
    } else {
      logger.warn("[MFA-TOTP] Failed verification attempt", { category: "authentication", metadata: { userId, attempt: newFailedAttempts, maxAttempts: MAX_FAILED_ATTEMPTS } });
    }

    await db
      .update(mfaCredentials)
      .set(updateData)
      .where(eq(mfaCredentials.id, credential.id));

    return false;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    logger.info("[MFA-TOTP] Verifying backup code", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential || !credential.isEnabled || !credential.backupCodesHash) {
      logger.warn("[MFA-TOTP] No enabled MFA credential with backup codes", { category: "authentication", metadata: { userId } });
      return false;
    }

    if (credential.lockedUntil && new Date(credential.lockedUntil) > new Date()) {
      logger.warn("[MFA-TOTP] Account locked during backup code verification", { category: "authentication", metadata: { userId } });
      return false;
    }

    const normalizedCode = code.toUpperCase().replace(/[-\s]/g, "");
    const hashedInput = hashSHA256(normalizedCode);

    let storedCodes: string[];
    try {
      storedCodes = JSON.parse(credential.backupCodesHash);
    } catch {
      logger.error("[MFA-TOTP] Failed to parse backup codes", { category: "authentication", metadata: { userId } });
      return false;
    }

    const codeIndex = storedCodes.indexOf(hashedInput);
    if (codeIndex === -1) {
      const newFailedAttempts = (credential.failedAttempts || 0) + 1;
      const updateData: Record<string, unknown> = {
        failedAttempts: newFailedAttempts,
        updatedAt: new Date(),
      };
      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        logger.warn("[MFA-TOTP] Account locked after failed backup code", { category: "authentication", metadata: { userId } });
      }
      await db
        .update(mfaCredentials)
        .set(updateData)
        .where(eq(mfaCredentials.id, credential.id));

      logger.warn("[MFA-TOTP] Invalid backup code", { category: "authentication", metadata: { userId } });
      return false;
    }

    storedCodes.splice(codeIndex, 1);

    await db
      .update(mfaCredentials)
      .set({
        backupCodesHash: JSON.stringify(storedCodes),
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mfaCredentials.id, credential.id));

    logger.info("[MFA-TOTP] Backup code verified and consumed", { category: "authentication", metadata: { userId, codesRemaining: storedCodes.length } });
    return true;
  }

  async generateBackupCodes(userId: string): Promise<string[]> {
    logger.info("[MFA-TOTP] Generating new backup codes", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential) {
      throw new Error("No MFA credential found for user");
    }

    const backupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      backupCodes.push(generateRandomAlphanumeric(BACKUP_CODE_LENGTH));
    }

    const hashedCodes = backupCodes.map((code) => hashSHA256(code));

    await db
      .update(mfaCredentials)
      .set({
        backupCodesHash: JSON.stringify(hashedCodes),
        updatedAt: new Date(),
      })
      .where(eq(mfaCredentials.id, credential.id));

    logger.info("[MFA-TOTP] New backup codes generated", { category: "authentication", metadata: { userId, count: BACKUP_CODE_COUNT } });
    return backupCodes;
  }

  async disableMfa(userId: string, token: string): Promise<boolean> {
    logger.info("[MFA-TOTP] Disabling MFA", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential || !credential.isEnabled || !credential.secretHash) {
      logger.warn("[MFA-TOTP] No enabled MFA to disable", { category: "authentication", metadata: { userId } });
      return false;
    }

    const secret = decryptSecret(credential.secretHash);
    const valid = verifyTOTPToken(secret, token);

    if (!valid) {
      logger.warn("[MFA-TOTP] Invalid token when attempting to disable MFA", { category: "authentication", metadata: { userId } });
      return false;
    }

    await db
      .update(mfaCredentials)
      .set({
        isEnabled: false,
        isPrimary: false,
        secretHash: null,
        backupCodesHash: null,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(mfaCredentials.id, credential.id));

    logger.info("[MFA-TOTP] MFA disabled", { category: "authentication", metadata: { userId } });
    return true;
  }

  async getMfaStatus(userId: string): Promise<{
    enrolled: boolean;
    enabled: boolean;
    methods: string[];
    lastUsed: Date | null;
    lockedUntil: Date | null;
    failedAttempts: number;
  }> {
    const credentials = await db
      .select()
      .from(mfaCredentials)
      .where(eq(mfaCredentials.userId, userId));

    if (credentials.length === 0) {
      return {
        enrolled: false,
        enabled: false,
        methods: [],
        lastUsed: null,
        lockedUntil: null,
        failedAttempts: 0,
      };
    }

    const methods = credentials.map((c) => c.method);
    const enabledCredentials = credentials.filter((c) => c.isEnabled);
    const latestUsed = credentials
      .filter((c) => c.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt!.getTime() - a.lastUsedAt!.getTime()))[0];

    const totpCredential = credentials.find((c) => c.method === "totp");

    return {
      enrolled: credentials.length > 0,
      enabled: enabledCredentials.length > 0,
      methods,
      lastUsed: latestUsed?.lastUsedAt || null,
      lockedUntil: totpCredential?.lockedUntil || null,
      failedAttempts: totpCredential?.failedAttempts || 0,
    };
  }

  async isRequired(userId: string): Promise<boolean> {
    return true;
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    logger.info("[MFA-TOTP] Admin reset of failed attempts", { category: "authentication", metadata: { userId } });

    await db
      .update(mfaCredentials)
      .set({
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.method, "totp")));

    logger.info("[MFA-TOTP] Failed attempts reset", { category: "authentication", metadata: { userId } });
  }

  async getEnrollmentStats(): Promise<{
    totalUsers: number;
    enrolledUsers: number;
    enabledUsers: number;
    enrollmentRate: number;
  }> {
    const totalResult = await db.select({ count: count() }).from(users);
    const totalUsers = totalResult[0]?.count || 0;

    const enrolledResult = await db
      .select({ count: count() })
      .from(mfaCredentials)
      .where(eq(mfaCredentials.method, "totp"));
    const enrolledUsers = enrolledResult[0]?.count || 0;

    const enabledResult = await db
      .select({ count: count() })
      .from(mfaCredentials)
      .where(and(eq(mfaCredentials.method, "totp"), eq(mfaCredentials.isEnabled, true)));
    const enabledUsers = enabledResult[0]?.count || 0;

    const enrollmentRate = totalUsers > 0 ? (enabledUsers / totalUsers) * 100 : 0;

    return {
      totalUsers,
      enrolledUsers,
      enabledUsers,
      enrollmentRate: Math.round(enrollmentRate * 100) / 100,
    };
  }

  async rotateSecret(userId: string, currentToken: string): Promise<{ secret: string; qrCodeUri: string; backupCodes: string[] } | null> {
    logger.info("[MFA-TOTP] Rotating secret", { category: "authentication", metadata: { userId } });

    const credential = await this.getCredential(userId);
    if (!credential || !credential.isEnabled || !credential.secretHash) {
      logger.warn("[MFA-TOTP] No enabled MFA credential for secret rotation", { category: "authentication", metadata: { userId } });
      return null;
    }

    const currentSecret = decryptSecret(credential.secretHash);
    const valid = verifyTOTPToken(currentSecret, currentToken);

    if (!valid) {
      logger.warn("[MFA-TOTP] Invalid current token during secret rotation", { category: "authentication", metadata: { userId } });
      return null;
    }

    const rawSecret = crypto.randomBytes(SECRET_LENGTH);
    const newBase32Secret = base32Encode(rawSecret);

    const backupCodes: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      backupCodes.push(generateRandomAlphanumeric(BACKUP_CODE_LENGTH));
    }

    const encryptedSecret = encryptSecret(newBase32Secret);
    const hashedBackupCodes = backupCodes.map((code) => hashSHA256(code));

    const userResult = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const email = userResult[0]?.email || "user@tabulamedica.com";

    await db
      .update(mfaCredentials)
      .set({
        secretHash: encryptedSecret,
        backupCodesHash: JSON.stringify(hashedBackupCodes),
        failedAttempts: 0,
        lockedUntil: null,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mfaCredentials.id, credential.id));

    const qrCodeUri = `otpauth://totp/TabulaMedica:${encodeURIComponent(email)}?secret=${newBase32Secret}&issuer=TabulaMedica&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    logger.info("[MFA-TOTP] Secret rotated successfully", { category: "authentication", metadata: { userId } });

    return {
      secret: newBase32Secret,
      qrCodeUri,
      backupCodes,
    };
  }

  private async getCredential(userId: string): Promise<MfaCredential | null> {
    const results = await db
      .select()
      .from(mfaCredentials)
      .where(and(eq(mfaCredentials.userId, userId), eq(mfaCredentials.method, "totp")))
      .limit(1);

    return results[0] || null;
  }
}

export const mfaTotpService = new MfaTotpService();

export function initializeMfaTotp(): void {
  logger.info("[MFA-TOTP] Service initialized", { category: "system" });
  logger.info(`[MFA-TOTP] TOTP config: ${TOTP_DIGITS}-digit codes, ${TOTP_PERIOD}s period, ±${TIME_WINDOW} window`, { category: "system" });
  logger.info(`[MFA-TOTP] Lockout policy: ${MAX_FAILED_ATTEMPTS} attempts, ${LOCKOUT_DURATION_MS / 60000} min lockout`, { category: "system" });
  logger.info(`[MFA-TOTP] Backup codes: ${BACKUP_CODE_COUNT} codes, ${BACKUP_CODE_LENGTH} chars each`, { category: "system" });
}
