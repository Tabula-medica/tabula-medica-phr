/**
 * Medical Record Number (MRN) — human-readable, stable patient identifier.
 *
 * Derived deterministically from a profile's UUID (`profiles.id`), so it needs
 * no extra column, no migration, and no backfill: every existing and future
 * profile has a stable MRN the moment it has an id. Because it is a truncation
 * of an already-unique UUID, collisions are astronomically unlikely at any
 * realistic patient scale (60-bit space; birthday-bound ~10^9 profiles).
 *
 * Format:  TM-XXXX-XXXX-XXXX   (Crockford base32, unambiguous — no I/L/O/U)
 *
 * If MRN-based *lookup* is ever needed, persist this value in a unique-indexed
 * column and search on it; the derivation here is the canonical generator.
 */

// Crockford base32 — excludes I, L, O, U to avoid visual/OCR ambiguity.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Encode a non-negative BigInt as a fixed-length Crockford base32 string. */
function toBase32(value: bigint, length: number): string {
  let out = "";
  let v = value;
  const base = 32n;
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[Number(v % base)] + out;
    v /= base;
  }
  return out;
}

/**
 * Format a profile UUID into an MRN. Returns "TM-XXXX-XXXX-XXXX".
 * Falls back to a safe placeholder if given a malformed id.
 */
export function formatMrn(profileId: string): string {
  const hex = (profileId || "").replace(/-/g, "").toLowerCase();
  if (hex.length < 15 || /[^0-9a-f]/.test(hex.slice(0, 15))) {
    return "TM-0000-0000-0000";
  }
  // Take the first 60 bits (15 hex chars) → 12 base32 chars.
  const bits = BigInt("0x" + hex.slice(0, 15));
  const b32 = toBase32(bits, 12);
  return `TM-${b32.slice(0, 4)}-${b32.slice(4, 8)}-${b32.slice(8, 12)}`;
}

/** True if a string looks like a well-formed MRN. */
export function isMrn(value: string): boolean {
  return /^TM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(value);
}
