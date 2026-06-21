import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) return false;

    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    const storedKey = Buffer.from(hash, "hex");

    if (derivedKey.length !== storedKey.length) return false;
    return timingSafeEqual(derivedKey, storedKey);
  } catch {
    return false;
  }
}
