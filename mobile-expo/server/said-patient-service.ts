import crypto from "crypto";

function luhnCheckDigit(input: string): number {
  const digits = input.replace(/\D/g, "");
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

function generateSequence(): string {
  const random = crypto.randomBytes(4).readUInt32BE(0) % 10_000_000;
  return random.toString().padStart(7, "0");
}

export function generateSaidPatientId(state: string): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const normalizedState = state.toUpperCase().slice(0, 2);
  const seq = generateSequence();
  const numericPayload = year + normalizedState.split("").map((c) => c.charCodeAt(0) - 64).join("") + seq;
  const check = luhnCheckDigit(numericPayload);
  return `SAID-${year}-${normalizedState}-${seq}-${check}`;
}

export function normalizeName(
  first: string,
  middle: string | null | undefined,
  last: string
): { nameFirst: string; nameMiddle: string; nameLast: string; isNMN: boolean } {
  const trimmedFirst = first.trim().toUpperCase();
  const trimmedLast = last.trim().toUpperCase();
  const rawMiddle = middle?.trim().toUpperCase() ?? "";
  const resolvedMiddle = rawMiddle === "" || rawMiddle === "NMN" ? "NMN" : rawMiddle;

  if (!trimmedFirst || !trimmedLast) {
    throw new Error("First and last name are required");
  }

  return {
    nameFirst: trimmedFirst,
    nameMiddle: resolvedMiddle,
    nameLast: trimmedLast,
    isNMN: resolvedMiddle === "NMN",
  };
}

export function encryptField(plaintext: string, key: string): string {
  const keyBuffer = crypto.scryptSync(key, "said-salt", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return iv.toString("hex") + ":" + authTag + ":" + encrypted;
}

export function decryptField(ciphertext: string, key: string): string {
  const keyBuffer = crypto.scryptSync(key, "said-salt", 32);
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted field format");
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv, { authTagLength: 16 } as any);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function hashIdDocument(documentNumber: string): string {
  return crypto.createHash("sha256").update(documentNumber).digest("hex");
}

export function validateSaidPatientId(saidId: string): boolean {
  const pattern = /^SAID-\d{2}-[A-Z]{2}-\d{7}-\d$/;
  if (!pattern.test(saidId)) return false;
  const parts = saidId.split("-");
  const year = parts[1];
  const state = parts[2];
  const seq = parts[3];
  const providedCheck = parseInt(parts[4], 10);
  const numericPayload = year + state.split("").map((c) => c.charCodeAt(0) - 64).join("") + seq;
  const expectedCheck = luhnCheckDigit(numericPayload);
  return providedCheck === expectedCheck;
}
