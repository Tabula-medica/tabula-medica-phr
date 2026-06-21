/**
 * F1 — PHI storage wrapper.
 *
 * Provides explicit encrypt/decrypt utilities consumed at every Drizzle
 * call site that touches a PHI table. The wrapper is intentionally
 * EXPLICIT (not a transparent proxy) so HIPAA auditors can grep every
 * call site and see encryption applied.
 *
 * Usage at a call site:
 *
 *   // Insert
 *   await db.insert(medicationsTable).values(
 *     encryptPhiRow("medicationsTable", input),
 *   );
 *
 *   // Update
 *   await db.update(medicationsTable)
 *     .set(encryptPhiRow("medicationsTable", patch))
 *     .where(eq(medicationsTable.id, id));
 *
 *   // Select (single row)
 *   const [row] = await db.select().from(medicationsTable).where(...);
 *   return decryptPhiRow("medicationsTable", row);
 *
 *   // Select (many rows)
 *   const rows = await db.select().from(medicationsTable).where(...);
 *   return decryptPhiRows("medicationsTable", rows);
 *
 *   // Searchable lookup (e.g. login by email)
 *   const hash = hashEmail(email);
 *   const [acc] = await db.select().from(accounts)
 *     .where(eq(accounts.emailHash, hash));
 *
 * Every function is a no-op for tables not in PHI_COLUMN_MAP, so it is
 * always safe to wrap (defensive programming).
 */

import {
  encryptPhi,
  decryptPhi,
  hashPhiForSearch,
  isEncrypted,
} from "../security/phi-encryption";
import { PHI_COLUMN_MAP, type PhiColumnSpec } from "../security/phi-column-map";
import { db as rawDb } from "../db";

export type PhiTableName = keyof typeof PHI_COLUMN_MAP;

/**
 * `phiDb` — re-export of the Drizzle `db` client, marked as the PHI-aware
 * caller surface. Use this (NOT raw `db`) at every call site that touches a
 * PHI table. Combine with `encryptPhiRow` / `decryptPhiRow(s)` to wrap values:
 *
 *   import { phiDb, encryptPhiRow, decryptPhiRows } from "@/server/storage/phi-storage";
 *
 *   // SELECT (returns ciphertext rows, decrypt explicitly)
 *   const raw = await phiDb.select().from(medicationsTable).where(...);
 *   const rows = decryptPhiRows("medicationsTable", raw);
 *
 *   // INSERT (encrypt values before persisting)
 *   await phiDb.insert(medicationsTable).values(
 *     encryptPhiRow("medicationsTable", input),
 *   );
 *
 *   // UPDATE
 *   await phiDb.update(medicationsTable)
 *     .set(encryptPhiRow("medicationsTable", patch))
 *     .where(eq(medicationsTable.id, id));
 *
 * The ESLint guardrail (eslint.config.js, F1 rule) blocks `db.insert(<phi>)`,
 * `db.update(<phi>)`, `db.delete(<phi>)`, and `db.select().from(<phi>)`. The
 * same patterns on `phiDb.*` are intentionally allowed — the receiver name
 * encodes the developer's awareness that PHI is in flight.
 */
export const phiDb = rawDb;

const JSONB_ENVELOPE_KEY = "__enc";

/**
 * Encrypt all PHI columns on a row before writing to the DB.
 * Returns a new object — does not mutate the input.
 */
export function encryptPhiRow<T extends Record<string, any>>(
  tableName: string,
  row: T | undefined | null,
): T {
  if (!row) return row as T;
  const spec = PHI_COLUMN_MAP[tableName];
  if (!spec) return row;

  const out: Record<string, any> = { ...row };

  for (const col of spec.text) {
    const v = out[col];
    if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) {
      out[col] = encryptPhi(v);
    }
  }

  if (spec.textArray) {
    for (const col of spec.textArray) {
      const arr = out[col];
      if (Array.isArray(arr)) {
        out[col] = arr.map((el) =>
          typeof el === "string" && el.length > 0 && !isEncrypted(el)
            ? encryptPhi(el)
            : el,
        );
      }
    }
  }

  for (const col of spec.jsonb) {
    const v = out[col];
    if (v != null && !isJsonbEnvelope(v)) {
      out[col] = wrapJsonbEnvelope(v);
    }
  }

  return out as T;
}

/**
 * Decrypt all PHI columns on a row after reading from the DB.
 * Returns a new object — does not mutate the input.
 *
 * Decryption failures (corrupted ciphertext, key mismatch) leave the
 * field as-is; `phi-encryption::decryptPhi` already logs a warning.
 */
export function decryptPhiRow<T extends Record<string, any>>(
  tableName: string,
  row: T | undefined | null,
): T {
  if (!row) return row as T;
  const spec = PHI_COLUMN_MAP[tableName];
  if (!spec) return row;

  const out: Record<string, any> = { ...row };

  for (const col of spec.text) {
    const v = out[col];
    if (typeof v === "string" && isEncrypted(v)) {
      out[col] = decryptPhi(v);
    }
  }

  if (spec.textArray) {
    for (const col of spec.textArray) {
      const arr = out[col];
      if (Array.isArray(arr)) {
        out[col] = arr.map((el) =>
          typeof el === "string" && isEncrypted(el) ? decryptPhi(el) : el,
        );
      }
    }
  }

  for (const col of spec.jsonb) {
    const v = out[col];
    if (isJsonbEnvelope(v)) {
      out[col] = unwrapJsonbEnvelope(v);
    }
  }

  return out as T;
}

/** Vectorised version of `decryptPhiRow` for `.select()` results. */
export function decryptPhiRows<T extends Record<string, any>>(
  tableName: string,
  rows: T[] | undefined | null,
): T[] {
  if (!rows) return [];
  return rows.map((r) => decryptPhiRow(tableName, r));
}

// ---------- Searchable hash helpers ----------

/** Deterministic hash of a normalised email for `accounts.emailHash` lookup. */
export function hashEmail(email: string): string {
  return hashPhiForSearch(email);
}

/** Deterministic hash of a normalised MRN for `patient_identity.mrn_hash`. */
export function hashMrn(mrn: string): string {
  return hashPhiForSearch(mrn);
}

/**
 * Deterministic hash of a normalised E.164 phone number.
 * Caller is expected to pass the canonicalised form (digits-only or E.164).
 */
export function hashPhone(phone: string): string {
  return hashPhiForSearch(phone);
}

// ---------- jsonb envelope helpers ----------

function isJsonbEnvelope(v: unknown): v is { [JSONB_ENVELOPE_KEY]: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    JSONB_ENVELOPE_KEY in (v as object) &&
    typeof (v as any)[JSONB_ENVELOPE_KEY] === "string" &&
    isEncrypted((v as any)[JSONB_ENVELOPE_KEY])
  );
}

function wrapJsonbEnvelope(value: unknown): { [JSONB_ENVELOPE_KEY]: string } {
  const json = JSON.stringify(value);
  return { [JSONB_ENVELOPE_KEY]: encryptPhi(json) };
}

function unwrapJsonbEnvelope(envelope: {
  [JSONB_ENVELOPE_KEY]: string;
}): unknown {
  try {
    const plain = decryptPhi(envelope[JSONB_ENVELOPE_KEY]);
    return JSON.parse(plain);
  } catch {
    return envelope;
  }
}

// ---------- Sanity helper for tests ----------

/** Returns `true` if every PHI column on the given row holds ciphertext. */
export function isRowFullyEncrypted(
  tableName: string,
  row: Record<string, any> | null | undefined,
): boolean {
  if (!row) return true;
  const spec = PHI_COLUMN_MAP[tableName];
  if (!spec) return true;
  for (const col of spec.text) {
    const v = row[col];
    if (typeof v === "string" && v.length > 0 && !isEncrypted(v)) return false;
  }
  if (spec.textArray) {
    for (const col of spec.textArray) {
      const arr = row[col];
      if (Array.isArray(arr)) {
        for (const el of arr) {
          if (typeof el === "string" && el.length > 0 && !isEncrypted(el))
            return false;
        }
      }
    }
  }
  for (const col of spec.jsonb) {
    const v = row[col];
    if (v != null && !isJsonbEnvelope(v)) return false;
  }
  return true;
}
