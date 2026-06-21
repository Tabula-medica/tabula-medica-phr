import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const CODE_COUNT = 8;
const SCRYPT_KEYLEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;

function chunk(s: string, n: number): string {
  return s.match(new RegExp(`.{1,${n}}`, "g"))?.join("-") ?? s;
}

export function generateRecoveryCodesPlaintext(count = CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(6)
      .toString("base64")
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 10)
      .padEnd(10, "X");
    codes.push(chunk(raw, 5));
  }
  return codes;
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  const salt = randomBytes(16);
  const derived = scryptSync(normalized, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString("hex")}$${(derived as Buffer).toString("hex")}`;
}

export function verifyRecoveryCode(code: string, hash: string): boolean {
  try {
    const parts = hash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    const normalized = normalizeRecoveryCode(code);
    const derived = scryptSync(normalized, salt, expected.length, { N, r, p }) as Buffer;
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
