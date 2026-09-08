/**
 * Persistence for TCPA / DPDP consent.
 *
 * Same defect, same reasoning as `share-store.ts`, but this one is worse.
 *
 * The registry was a process-local `Map`, with a comment saying "a production
 * deployment persists this; the interface is what matters here". Every deploy
 * path in this repo runs Cloud Run with `--max-instances=10` and no session
 * affinity, so production already ran ten copies of that Map. A patient texts
 * STOP, the webhook lands on instance 3, and instances 1, 2 and 4-10 have
 * never heard of it — they keep passing the send gate and keep texting
 * somebody who has exercised a statutory opt-out.
 *
 * That is the precise failure the engagement module exists to prevent, and it
 * is the third time this PR has arrived at it from a different direction: the
 * open webhook in round 2, the schema mismatch that made revocation inert in
 * round 3, and now a revocation that works but reaches a tenth of the fleet.
 *
 * ## Phone numbers are PHI here
 *
 * The original comment argued this was "contact-preference metadata" and
 * deliberately outside the encrypted PHI path, so the consent check could run
 * before any PHI loaded. The first half of that is wrong: a phone number held
 * by a covered entity because that person is a patient is individually
 * identifiable health information, and a table of them is a patient list. The
 * second half survives — lookup is by HMAC (`hashPhone`), so a number can be
 * found without decrypting anything, and the number itself is encrypted at
 * rest.
 */

import { eq } from "drizzle-orm";
import { engagementConsentsTable } from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRow, hashPhone } from "../../storage/phi-storage";
import type { ConsentRecord, EngagementPurpose } from "@shared/engagement";

export interface ConsentStore {
  /** By normalised E.164. Returns null when nothing is on file. */
  find(phone: string): Promise<ConsentRecord | null>;
  /** Insert or replace the record for this number. */
  put(record: ConsentRecord): Promise<ConsentRecord>;
}

type ConsentRow = typeof engagementConsentsTable.$inferSelect;

function rowToRecord(row: ConsentRow): ConsentRecord {
  const r = decryptPhiRow("engagementConsentsTable", row);
  return {
    phone: r.phone,
    state: r.state as ConsentRecord["state"],
    purposes: (r.purposes ?? []) as EngagementPurpose[],
    capturedVia: (r.capturedVia as ConsentRecord["capturedVia"]) ?? undefined,
    capturedAt: r.capturedAt?.toISOString(),
    revokedAt: r.revokedAt?.toISOString(),
    revokedByKeyword: r.revokedByKeyword ?? undefined,
    noticeLanguage: r.noticeLanguage ?? undefined,
    noticeVersion: r.noticeVersion ?? undefined,
  };
}

export const postgresConsentStore: ConsentStore = {
  async find(phone) {
    const [row] = await phiDb
      .select()
      .from(engagementConsentsTable)
      .where(eq(engagementConsentsTable.phoneHash, hashPhone(phone)))
      .limit(1);
    return row ? rowToRecord(row) : null;
  },

  async put(record) {
    const values = encryptPhiRow("engagementConsentsTable", {
      phoneHash: hashPhone(record.phone),
      phone: record.phone,
      state: record.state,
      purposes: record.purposes as string[],
      capturedVia: record.capturedVia ?? null,
      capturedAt: record.capturedAt ? new Date(record.capturedAt) : null,
      revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
      revokedByKeyword: record.revokedByKeyword ?? null,
      noticeLanguage: record.noticeLanguage ?? null,
      noticeVersion: record.noticeVersion ?? null,
      updatedAt: new Date(),
    });

    const [row] = await phiDb
      .insert(engagementConsentsTable)
      .values(values)
      .onConflictDoUpdate({
        target: engagementConsentsTable.phoneHash,
        set: {
          phone: values.phone,
          state: values.state,
          purposes: values.purposes,
          capturedVia: values.capturedVia,
          capturedAt: values.capturedAt,
          revokedAt: values.revokedAt,
          revokedByKeyword: values.revokedByKeyword,
          noticeLanguage: values.noticeLanguage,
          noticeVersion: values.noticeVersion,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    return rowToRecord(row);
  },
};

/** Test double. Faithful to the contract; says nothing about concurrency. */
export function createMemoryConsentStore(): ConsentStore {
  const rows = new Map<string, ConsentRecord>();
  return {
    async find(phone) {
      return rows.get(phone) ?? null;
    },
    async put(record) {
      rows.set(record.phone, record);
      return record;
    },
  };
}

let active: ConsentStore = postgresConsentStore;

export function consentStore(): ConsentStore {
  return active;
}

/** Test seam. Never called from a request path. */
export function __setConsentStore(store: ConsentStore): void {
  active = store;
}
