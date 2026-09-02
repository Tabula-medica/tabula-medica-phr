/**
 * Persistence for scribe sessions and recording consent.
 *
 * Postgres from the first commit, not a `Map` with a comment promising a
 * database later. That mistake was made twice on this branch already — the
 * engagement consent registry and the share-grant registry were both
 * process-local while every deploy script ran `--max-instances=10` — and the
 * failure here would be worse than either.
 *
 * A withdrawn recording consent held in one process means nine other instances
 * happily start recording a patient who has said stop. There is no version of
 * that which is recoverable, because the audio exists by the time anyone
 * notices.
 *
 * Every write that bounds a session goes through a conditional UPDATE rather
 * than read-decide-write, for the same reason the share view cap does: two
 * concurrent attestations of the same draft must not both succeed, and a
 * read-modify-write cannot promise that.
 *
 * > **What the tests do not cover.** The suite has no database, so this runs
 * > against an in-memory double that is faithful to the contract and **cannot**
 * > exercise the concurrency guarantee — under a single-threaded double an
 * > atomic UPDATE and a read-modify-write are indistinguishable. The rules are
 * > tested; the races are not. Said here rather than left to be inferred from
 * > a green suite.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { scribeConsentsTable, scribeSessionsTable } from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRow } from "../../storage/phi-storage";
import type { Attestation, ScribeNoteDraft, ScribeSessionStatus, Transcript } from "@shared/ambient-scribe";
import type { RecordingConsent, NoticeElement, ConsentMethod, ConsentState, RecordingPurpose } from "./consent";

export interface ScribeSession {
  id: string;
  profileId: string;
  clinicianAccountId: string;
  jurisdiction: string;
  status: ScribeSessionStatus;
  language: string;
  mixedWith: readonly string[];
  engine?: string;
  processedInRegion?: string;
  rolesEstablished: boolean;
  startedAt: string;
  endedAt?: string;
  audioDeletedAt?: string;
  draftExpiresAt?: string;
  transcript?: Transcript;
  draft?: ScribeNoteDraft;
  attestation?: Attestation;
}

export interface ScribeStore {
  createSession(input: {
    profileId: string;
    clinicianAccountId: string;
    jurisdiction: string;
    language: string;
    mixedWith: readonly string[];
    processedInRegion: string;
    draftExpiresAt: Date;
  }): Promise<ScribeSession>;

  getSession(id: string): Promise<ScribeSession | null>;

  /** Attach the transcript and draft. Only valid while the session is unattested. */
  saveDraft(input: {
    id: string;
    transcript: Transcript;
    draft: ScribeNoteDraft;
    rolesEstablished: boolean;
    engine: string;
  }): Promise<ScribeSession | null>;

  /**
   * Sign the note. Succeeds only when the session is still unattested, so a
   * double submit produces one attestation and one null rather than two.
   */
  attest(id: string, attestation: Attestation): Promise<ScribeSession | null>;

  /** Record that the working audio is gone. */
  markAudioDeleted(id: string, at: Date): Promise<void>;

  /** Withdrawal before attestation: the draft and transcript are destroyed. */
  purgeDraft(id: string): Promise<void>;

  findConsent(profileId: string, purpose: RecordingPurpose): Promise<RecordingConsent | null>;
  putConsent(consent: RecordingConsent): Promise<RecordingConsent>;
}

type SessionRow = typeof scribeSessionsTable.$inferSelect;
type ConsentRow = typeof scribeConsentsTable.$inferSelect;

function rowToSession(row: SessionRow): ScribeSession {
  const r = decryptPhiRow("scribeSessionsTable", row);
  return {
    id: r.id,
    profileId: r.profileId,
    clinicianAccountId: r.clinicianAccountId,
    jurisdiction: r.jurisdiction,
    status: r.status as ScribeSessionStatus,
    language: r.language,
    mixedWith: (r.mixedWith ?? []) as string[],
    engine: r.engine ?? undefined,
    processedInRegion: r.processedInRegion ?? undefined,
    rolesEstablished: Boolean(r.rolesEstablished),
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString(),
    audioDeletedAt: r.audioDeletedAt?.toISOString(),
    draftExpiresAt: r.draftExpiresAt?.toISOString(),
    transcript: (r.transcript as unknown as Transcript) ?? undefined,
    draft: (r.draft as unknown as ScribeNoteDraft) ?? undefined,
    attestation: (r.attestation as unknown as Attestation) ?? undefined,
  };
}

function rowToConsent(row: ConsentRow): RecordingConsent {
  const r = decryptPhiRow("scribeConsentsTable", row);
  return {
    patientId: r.profileId,
    jurisdiction: r.jurisdiction,
    purpose: r.purpose as RecordingPurpose,
    state: r.state as ConsentState,
    method: r.method as ConsentMethod,
    noticeLanguage: r.noticeLanguage,
    noticeVersion: r.noticeVersion,
    noticeElements: (r.noticeElements ?? []) as NoticeElement[],
    capturedAt: r.capturedAt.toISOString(),
    capturedBy: r.capturedBy ?? undefined,
    withdrawnAt: r.withdrawnAt?.toISOString(),
  };
}

export const postgresScribeStore: ScribeStore = {
  async createSession(input) {
    const values = encryptPhiRow("scribeSessionsTable", {
      profileId: input.profileId,
      clinicianAccountId: input.clinicianAccountId,
      jurisdiction: input.jurisdiction,
      status: "recording" satisfies ScribeSessionStatus,
      language: input.language,
      mixedWith: input.mixedWith as string[],
      processedInRegion: input.processedInRegion,
      rolesEstablished: false,
      draftExpiresAt: input.draftExpiresAt,
    });
    const [row] = await phiDb.insert(scribeSessionsTable).values(values).returning();
    return rowToSession(row);
  },

  async getSession(id) {
    const [row] = await phiDb
      .select()
      .from(scribeSessionsTable)
      .where(eq(scribeSessionsTable.id, id))
      .limit(1);
    return row ? rowToSession(row) : null;
  },

  async saveDraft(input) {
    const values = encryptPhiRow("scribeSessionsTable", {
      transcript: input.transcript as unknown as Record<string, unknown>,
      draft: input.draft as unknown as Record<string, unknown>,
      rolesEstablished: input.rolesEstablished,
      engine: input.engine,
      status: "draft" satisfies ScribeSessionStatus,
      endedAt: new Date(),
      updatedAt: new Date(),
    });
    const [row] = await phiDb
      .update(scribeSessionsTable)
      .set(values)
      // Refuse to overwrite the material behind a signature.
      .where(and(eq(scribeSessionsTable.id, input.id), isNull(scribeSessionsTable.attestation)))
      .returning();
    return row ? rowToSession(row) : null;
  },

  async attest(id, attestation) {
    const values = encryptPhiRow("scribeSessionsTable", {
      attestation: attestation as unknown as Record<string, unknown>,
      status: "attested" satisfies ScribeSessionStatus,
      updatedAt: new Date(),
    });
    const [row] = await phiDb
      .update(scribeSessionsTable)
      .set(values)
      // The condition is the whole point: a second concurrent attest finds a
      // non-null attestation and updates nothing.
      .where(and(eq(scribeSessionsTable.id, id), isNull(scribeSessionsTable.attestation)))
      .returning();
    return row ? rowToSession(row) : null;
  },

  async markAudioDeleted(id, at) {
    await phiDb
      .update(scribeSessionsTable)
      .set({ audioDeletedAt: at, updatedAt: new Date() })
      .where(eq(scribeSessionsTable.id, id));
  },

  async purgeDraft(id) {
    await phiDb
      .update(scribeSessionsTable)
      .set({
        transcript: null,
        draft: null,
        status: "abandoned" satisfies ScribeSessionStatus,
        audioDeletedAt: sql`COALESCE(${scribeSessionsTable.audioDeletedAt}, NOW())`,
        updatedAt: new Date(),
      })
      // Never purge behind an attestation: that content is a clinical record.
      .where(and(eq(scribeSessionsTable.id, id), isNull(scribeSessionsTable.attestation)));
  },

  async findConsent(profileId, purpose) {
    const [row] = await phiDb
      .select()
      .from(scribeConsentsTable)
      .where(
        and(
          eq(scribeConsentsTable.profileId, profileId),
          eq(scribeConsentsTable.purpose, purpose),
        ),
      )
      .limit(1);
    return row ? rowToConsent(row) : null;
  },

  async putConsent(consent) {
    const values = encryptPhiRow("scribeConsentsTable", {
      profileId: consent.patientId,
      jurisdiction: consent.jurisdiction,
      purpose: consent.purpose,
      state: consent.state,
      method: consent.method,
      noticeLanguage: consent.noticeLanguage,
      noticeVersion: consent.noticeVersion,
      noticeElements: consent.noticeElements as string[],
      capturedAt: new Date(consent.capturedAt),
      capturedBy: consent.capturedBy ?? null,
      withdrawnAt: consent.withdrawnAt ? new Date(consent.withdrawnAt) : null,
      updatedAt: new Date(),
    });
    const [row] = await phiDb.insert(scribeConsentsTable).values(values).returning();
    return rowToConsent(row);
  },
};

/**
 * Test double. Faithful to the contract; says nothing about concurrency.
 *
 * The conditional-update semantics are reproduced — `attest` returns null when
 * an attestation already exists, `saveDraft` refuses behind one — so the rules
 * are exercised. What cannot be exercised is two callers racing, because there
 * is only ever one.
 */
export function createMemoryScribeStore(): ScribeStore {
  const sessions = new Map<string, ScribeSession>();
  const consents = new Map<string, RecordingConsent>();
  let counter = 0;

  return {
    async createSession(input) {
      const id = `scribe-${++counter}`;
      const session: ScribeSession = {
        id,
        profileId: input.profileId,
        clinicianAccountId: input.clinicianAccountId,
        jurisdiction: input.jurisdiction,
        status: "recording",
        language: input.language,
        mixedWith: input.mixedWith,
        processedInRegion: input.processedInRegion,
        rolesEstablished: false,
        startedAt: new Date().toISOString(),
        draftExpiresAt: input.draftExpiresAt.toISOString(),
      };
      sessions.set(id, session);
      return session;
    },

    async getSession(id) {
      return sessions.get(id) ?? null;
    },

    async saveDraft(input) {
      const existing = sessions.get(input.id);
      if (!existing || existing.attestation) return null;
      const next: ScribeSession = {
        ...existing,
        transcript: input.transcript,
        draft: input.draft,
        rolesEstablished: input.rolesEstablished,
        engine: input.engine,
        status: "draft",
        endedAt: new Date().toISOString(),
      };
      sessions.set(input.id, next);
      return next;
    },

    async attest(id, attestation) {
      const existing = sessions.get(id);
      if (!existing || existing.attestation) return null;
      const next: ScribeSession = { ...existing, attestation, status: "attested" };
      sessions.set(id, next);
      return next;
    },

    async markAudioDeleted(id, at) {
      const existing = sessions.get(id);
      if (existing) sessions.set(id, { ...existing, audioDeletedAt: at.toISOString() });
    },

    async purgeDraft(id) {
      const existing = sessions.get(id);
      if (!existing || existing.attestation) return;
      sessions.set(id, {
        ...existing,
        transcript: undefined,
        draft: undefined,
        status: "abandoned",
        audioDeletedAt: existing.audioDeletedAt ?? new Date().toISOString(),
      });
    },

    async findConsent(profileId, purpose) {
      return consents.get(`${profileId}:${purpose}`) ?? null;
    },

    async putConsent(consent) {
      consents.set(`${consent.patientId}:${consent.purpose}`, consent);
      return consent;
    },
  };
}

let active: ScribeStore = postgresScribeStore;

export function scribeStore(): ScribeStore {
  return active;
}

/** Test seam. Never called from a request path. */
export function __setScribeStore(store: ScribeStore): void {
  active = store;
}
