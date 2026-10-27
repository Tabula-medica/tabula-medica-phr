import crypto from "crypto";
import { EncryptionService } from "./encryption-service";

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "sha1";

export interface MFASecret {
  secret: string;
  encryptedSecret: string;
  backupCodes: string[];
  createdAt: Date;
}

export interface MFAVerification {
  valid: boolean;
  method: "totp" | "backup_code";
  timestamp: Date;
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

export function generateMFASecret(userId: string): MFASecret {
  const secret = crypto.randomBytes(20);
  const base32Secret = base32Encode(secret);
  
  const backupCodes: string[] = [];
  for (let i = 0; i < 10; i++) {
    backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }

  return {
    secret: base32Secret,
    encryptedSecret: EncryptionService.encrypt(base32Secret),
    backupCodes: backupCodes.map(code => EncryptionService.hash(code)),
    createdAt: new Date(),
  };
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

export function verifyTOTP(secret: string, token: string, window: number = 1): boolean {
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  
  for (let i = -window; i <= window; i++) {
    const expectedToken = generateTOTP(secret, counter + i);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      return true;
    }
  }
  
  return false;
}

export function verifyBackupCode(hashedCodes: string[], code: string): { valid: boolean; usedIndex: number } {
  const hashedInput = EncryptionService.hash(code.toUpperCase().replace(/-/g, ""));
  
  for (let i = 0; i < hashedCodes.length; i++) {
    if (hashedCodes[i] === hashedInput) {
      return { valid: true, usedIndex: i };
    }
  }
  
  return { valid: false, usedIndex: -1 };
}

export function generateMFAUri(secret: string, email: string, issuer: string = "TabulaMedica"): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=${TOTP_ALGORITHM.toUpperCase()}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

export function getCurrentTOTP(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);
  return generateTOTP(secret, counter);
}

export function getTimeRemaining(): number {
  const now = Date.now() / 1000;
  const counter = Math.floor(now / TOTP_PERIOD);
  const nextCounter = counter + 1;
  return Math.ceil(nextCounter * TOTP_PERIOD - now);
}

export interface MFAChallenge {
  challengeId: string;
  userId: string;
  method: "totp" | "backup_code";
  createdAt: Date;
  expiresAt: Date;
  verified: boolean;
}

const activeChallenges = new Map<string, MFAChallenge>();

export function createMFAChallenge(userId: string): MFAChallenge {
  const challenge: MFAChallenge = {
    challengeId: crypto.randomUUID(),
    userId,
    method: "totp",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    verified: false,
  };
  
  activeChallenges.set(challenge.challengeId, challenge);
  
  return challenge;
}

export function verifyMFAChallenge(
  challengeId: string,
  encryptedSecret: string,
  token: string,
  backupCodes?: string[]
): MFAVerification {
  const challenge = activeChallenges.get(challengeId);
  
  if (!challenge) {
    return { valid: false, method: "totp", timestamp: new Date() };
  }
  
  if (new Date() > challenge.expiresAt) {
    activeChallenges.delete(challengeId);
    return { valid: false, method: "totp", timestamp: new Date() };
  }
  
  const secret = EncryptionService.decrypt(encryptedSecret);
  
  if (token.length === TOTP_DIGITS) {
    const valid = verifyTOTP(secret, token);
    if (valid) {
      challenge.verified = true;
      activeChallenges.delete(challengeId);
    }
    return { valid, method: "totp", timestamp: new Date() };
  }
  
  if (backupCodes && token.length === 8) {
    const result = verifyBackupCode(backupCodes, token);
    if (result.valid) {
      challenge.verified = true;
      activeChallenges.delete(challengeId);
    }
    return { valid: result.valid, method: "backup_code", timestamp: new Date() };
  }
  
  return { valid: false, method: "totp", timestamp: new Date() };
}

setInterval(() => {
  const now = new Date();
  for (const [id, challenge] of activeChallenges.entries()) {
    if (now > challenge.expiresAt) {
      activeChallenges.delete(id);
    }
  }
}, 60 * 1000);

export const MFAService = {
  generateSecret: generateMFASecret,
  verifyTOTP,
  verifyBackupCode,
  generateUri: generateMFAUri,
  getCurrentTOTP,
  getTimeRemaining,
  createChallenge: createMFAChallenge,
  verifyChallenge: verifyMFAChallenge,
};
