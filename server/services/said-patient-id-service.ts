import crypto from "crypto";

const stateSequences = new Map<string, number>();

function luhnCheckDigit(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const charValues = input.split("").map((c) => {
    const idx = alphabet.indexOf(c.toUpperCase());
    return idx >= 0 ? idx : parseInt(c) || 0;
  });

  let sum = 0;
  let isDouble = true;
  for (let i = charValues.length - 1; i >= 0; i--) {
    let val = charValues[i];
    if (isDouble) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    sum += val;
    isDouble = !isDouble;
  }

  const checkNum = (10 - (sum % 10)) % 10;
  return String.fromCharCode(65 + (checkNum % 26));
}

export function generateSaidPatientId(state: string): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const stateUpper = state.toUpperCase().slice(0, 2);

  const currentSeq = stateSequences.get(stateUpper) || Math.floor(Math.random() * 9000000) + 1000000;
  const nextSeq = currentSeq + 1;
  stateSequences.set(stateUpper, nextSeq);

  const seq = nextSeq.toString().padStart(7, "0");
  const check = luhnCheckDigit(year + stateUpper + seq);

  return `SAID-${year}-${stateUpper}-${seq}-${check}`;
}

export function validateSaidPatientId(saidId: string): boolean {
  const pattern = /^SAID-\d{2}-[A-Z]{2}-\d{7}-[A-Z]$/;
  if (!pattern.test(saidId)) return false;

  const parts = saidId.split("-");
  const year = parts[1];
  const state = parts[2];
  const seq = parts[3];
  const providedCheck = parts[4];
  const expectedCheck = luhnCheckDigit(year + state + seq);

  return providedCheck === expectedCheck;
}

export interface RawPatientName {
  nameFirst: string;
  nameMiddle?: string | null;
  nameLast: string;
}

export function normalizeName(raw: RawPatientName): {
  first: string;
  middle: string;
  last: string;
  isNMN: boolean;
} {
  const first = raw.nameFirst.trim().toUpperCase();
  const last = raw.nameLast.trim().toUpperCase();

  const rawMiddle = raw.nameMiddle?.trim().toUpperCase() ?? "";
  const middle = rawMiddle === "" ? "NMN" : rawMiddle;
  const isNMN = middle === "NMN";

  if (!first || !last) throw new Error("First and last name are required");

  return { first, middle, last, isNMN };
}

export function encryptPatientName(raw: RawPatientName): {
  nameFirstEnc: string;
  nameMiddleEnc: string;
  nameLastEnc: string;
  hasNoMiddleName: boolean;
} {
  const { first, middle, last, isNMN } = normalizeName(raw);

  return {
    nameFirstEnc: encryptField(first),
    nameMiddleEnc: encryptField(middle),
    nameLastEnc: encryptField(last),
    hasNoMiddleName: isNMN,
  };
}

export function formatDisplayName(patient: {
  nameFirstEnc: string;
  nameMiddleEnc: string;
  nameLastEnc: string;
}): string {
  const first = decryptField(patient.nameFirstEnc);
  const middle = decryptField(patient.nameMiddleEnc);
  const last = decryptField(patient.nameLastEnc);

  return `${first} ${middle} ${last}`;
}

export function labOrderName(patient: {
  nameFirstEnc: string;
  nameMiddleEnc: string;
  nameLastEnc: string;
}): {
  hl7: string;
  display: string;
  fhir: { family: string; given: string[] };
} {
  const first = decryptField(patient.nameFirstEnc);
  const middle = decryptField(patient.nameMiddleEnc);
  const last = decryptField(patient.nameLastEnc);

  return {
    hl7: `${last}^${first}^${middle}`,
    display: `${first} ${middle} ${last}`,
    fhir: {
      family: last,
      given: [first, middle],
    },
  };
}

const ENCRYPTION_KEY = process.env.PHI_ENCRYPTION_KEY || crypto.randomBytes(32).toString("hex");
const ALGORITHM = "aes-256-gcm";

export function encryptField(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), encrypted, authTag.toString("base64")].join(":");
}

export function decryptField(encryptedStr: string): string {
  const [ivB64, encrypted, authTagB64] = encryptedStr.split(":");
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function hashDocumentId(documentNumber: string): string {
  return crypto.createHash("sha256").update(documentNumber).digest("hex");
}
