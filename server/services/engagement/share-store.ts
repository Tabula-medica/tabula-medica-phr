/**
 * Persistence for health-summary share grants.
 *
 * ## Why this is an interface rather than direct DB calls
 *
 * Production runs on Postgres, and it has to: every deploy path in this repo
 * (`deploy.sh`, `deploy-world.sh`, `deploy/gcp-deploy.sh`, `cloudbuild.yaml`)
 * starts Cloud Run with `--max-instances=10` and no session affinity, so a
 * grant that lives in one process is a grant the other nine cannot revoke,
 * cap, or lock. `/s/:token` needs no authentication, which makes that a
 * disclosure bug rather than a consistency nuisance.
 *
 * The test suite has no database. Rather than let that force the module back
 * into a Map, the storage operations are named here as a contract, with a
 * Postgres implementation used everywhere real and an in-memory double used by
 * tests.
 *
 * ## What the double cannot tell you, stated plainly
 *
 * The Postgres implementation claims each view and each failed PIN attempt in
 * a **single conditional UPDATE**, because a read-then-write across ten
 * instances is a race that hands out extra views and extra PIN guesses. The
 * in-memory double is single-threaded and cannot exercise that guarantee at
 * all — under it, a read-modify-write and an atomic update are
 * indistinguishable.
 *
 * So the tests below verify the *contract* (a view is consumed, the cap holds,
 * a wrong PIN does not consume a view, the fifth wrong PIN locks). They do not
 * and cannot verify the *concurrency* property. That needs an integration test
 * against a real Postgres, which this repo has no harness for. It is listed as
 * not-covered in `docs/patient-engagement.md` rather than left to be assumed
 * from a green suite — the whole point of this round was that a comment
 * claiming a property is not the same as the property holding.
 */

import { and, eq, sql } from "drizzle-orm";
import { healthSummarySharesTable } from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRow } from "../../storage/phi-storage";
import type { ShareGrant, SummarySection } from "@shared/health-summary";

/** A grant as the module works with it. `token` is never part of this. */
export interface StoredGrant extends ShareGrant {
  /** SHA-256 of the token, hex. */
  tokenHash: string;
  pinHash?: Buffer;
  pinSalt?: Buffer;
  directive?: Record<string, string>;
  attestations?: Record<string, boolean>;
}

export interface NewGrant {
  profileId: string;
  createdByAccountId: string;
  tokenHash: string;
  sections: readonly SummarySection[];
  initiator: ShareGrant["initiator"];
  createdAt: Date;
  expiresAt: Date;
  maxViews: number;
  language: string;
  pinRequired: boolean;
  pinHash?: Buffer;
  pinSalt?: Buffer;
  label?: string;
  attestations?: Record<string, boolean>;
  directive?: Record<string, string>;
}

export interface PinAttemptOutcome {
  pinAttempts: number;
  locked: boolean;
}

export interface ShareStore {
  insert(grant: NewGrant): Promise<StoredGrant>;
  findByTokenHash(tokenHash: string): Promise<StoredGrant | null>;
  findById(id: string): Promise<StoredGrant | null>;
  listByProfile(profileId: string): Promise<StoredGrant[]>;
  /** Increment the failed-PIN counter and lock at `maxAttempts`, atomically. */
  recordPinFailure(id: string, maxAttempts: number, now: Date): Promise<PinAttemptOutcome>;
  clearPinAttempts(id: string): Promise<void>;
  /**
   * Claim one view, atomically, only if the grant is still live and under its
   * cap. Returns null when the claim loses — cap reached, revoked, locked or
   * expired — so the caller never has to re-check what it just read.
   */
  claimView(id: string, now: Date): Promise<StoredGrant | null>;
  revoke(id: string, reason: string, now: Date): Promise<StoredGrant | null>;
}

// ── Postgres ────────────────────────────────────────────────────────────────

type ShareRow = typeof healthSummarySharesTable.$inferSelect;

export function rowToGrant(row: ShareRow): StoredGrant {
  const r = decryptPhiRow("healthSummarySharesTable", row);
  return {
    id: r.id,
    profileId: r.profileId,
    sections: (r.sections ?? []) as readonly SummarySection[],
    initiator: r.initiator as ShareGrant["initiator"],
    createdByAccountId: r.createdByAccountId,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    maxViews: r.maxViews,
    viewCount: r.viewCount,
    pinAttempts: r.pinAttempts,
    lockedAt: r.lockedAt?.toISOString(),
    revokedAt: r.revokedAt?.toISOString(),
    revokedReason: r.revokedReason ?? undefined,
    language: r.language,
    pinRequired: r.pinRequired,
    label: r.label ?? undefined,
    tokenHash: r.tokenHash,
    pinHash: r.pinHash ? Buffer.from(r.pinHash, "base64") : undefined,
    pinSalt: r.pinSalt ? Buffer.from(r.pinSalt, "base64") : undefined,
    directive: (r.directive as Record<string, string> | null) ?? undefined,
    attestations: (r.attestations as Record<string, boolean> | null) ?? undefined,
  };
}

export const postgresShareStore: ShareStore = {
  async insert(grant) {
    const [row] = await phiDb
      .insert(healthSummarySharesTable)
      .values(
        encryptPhiRow("healthSummarySharesTable", {
          profileId: grant.profileId,
          createdByAccountId: grant.createdByAccountId,
          tokenHash: grant.tokenHash,
          sections: grant.sections as string[],
          initiator: grant.initiator,
          createdAt: grant.createdAt,
          expiresAt: grant.expiresAt,
          maxViews: grant.maxViews,
          viewCount: 0,
          pinAttempts: 0,
          language: grant.language,
          pinRequired: grant.pinRequired,
          pinHash: grant.pinHash ? grant.pinHash.toString("base64") : null,
          pinSalt: grant.pinSalt ? grant.pinSalt.toString("base64") : null,
          label: grant.label ?? null,
          attestations: grant.attestations ?? null,
          directive: grant.directive ?? null,
        }),
      )
      .returning();
    return rowToGrant(row);
  },

  async findByTokenHash(tokenHash) {
    const [row] = await phiDb
      .select()
      .from(healthSummarySharesTable)
      .where(eq(healthSummarySharesTable.tokenHash, tokenHash))
      .limit(1);
    return row ? rowToGrant(row) : null;
  },

  async findById(id) {
    const [row] = await phiDb
      .select()
      .from(healthSummarySharesTable)
      .where(eq(healthSummarySharesTable.id, id))
      .limit(1);
    return row ? rowToGrant(row) : null;
  },

  async listByProfile(profileId) {
    const rows = await phiDb
      .select()
      .from(healthSummarySharesTable)
      .where(eq(healthSummarySharesTable.profileId, profileId));
    return rows.map(rowToGrant).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async recordPinFailure(id, maxAttempts, _now) {
    // One statement. Ten instances guessing in parallel cannot each read the
    // same count and each write back the same increment, and the lock is set
    // by the same UPDATE that raises the counter rather than by a follow-up.
    const [row] = await phiDb
      .update(healthSummarySharesTable)
      .set({
        pinAttempts: sql`${healthSummarySharesTable.pinAttempts} + 1`,
        lockedAt: sql`CASE WHEN ${healthSummarySharesTable.pinAttempts} + 1 >= ${maxAttempts} THEN NOW() ELSE ${healthSummarySharesTable.lockedAt} END`,
      })
      .where(eq(healthSummarySharesTable.id, id))
      .returning();
    return { pinAttempts: row?.pinAttempts ?? 0, locked: Boolean(row?.lockedAt) };
  },

  async clearPinAttempts(id) {
    await phiDb
      .update(healthSummarySharesTable)
      .set({ pinAttempts: 0 })
      .where(eq(healthSummarySharesTable.id, id));
  },

  async claimView(id, _now) {
    // The cap is checked by the same statement that consumes the view.
    // Reading the count and then writing count+1 would let two instances
    // serving the same link both see the last view and both hand out the list.
    const [row] = await phiDb
      .update(healthSummarySharesTable)
      .set({ viewCount: sql`${healthSummarySharesTable.viewCount} + 1` })
      .where(
        and(
          eq(healthSummarySharesTable.id, id),
          sql`${healthSummarySharesTable.viewCount} < ${healthSummarySharesTable.maxViews}`,
          sql`${healthSummarySharesTable.revokedAt} IS NULL`,
          sql`${healthSummarySharesTable.lockedAt} IS NULL`,
          sql`${healthSummarySharesTable.expiresAt} > NOW()`,
        ),
      )
      .returning();
    return row ? rowToGrant(row) : null;
  },

  async revoke(id, reason, now) {
    // Conditional on not-already-revoked, so a second revoke does not
    // overwrite the first one's timestamp and reason.
    const [row] = await phiDb
      .update(healthSummarySharesTable)
      .set({ revokedAt: now, revokedReason: reason })
      .where(
        and(
          eq(healthSummarySharesTable.id, id),
          sql`${healthSummarySharesTable.revokedAt} IS NULL`,
        ),
      )
      .returning();
    if (row) return rowToGrant(row);
    // Already revoked: read it back, so a repeat revoke is idempotent rather
    // than a 404 on a link that is genuinely dead.
    return postgresShareStore.findById(id);
  },
};

// ── In-memory double, for tests only ────────────────────────────────────────

/**
 * Faithful to the contract, silent about concurrency. See the file header:
 * this cannot distinguish an atomic UPDATE from a read-modify-write, so a
 * green suite says the rules are right, not that they survive ten instances.
 */
export function createMemoryShareStore(): ShareStore {
  const rows = new Map<string, StoredGrant>();
  let seq = 0;

  const clone = (g: StoredGrant): StoredGrant => ({ ...g, sections: [...g.sections] });

  return {
    async insert(grant) {
      seq += 1;
      const stored: StoredGrant = {
        id: `share-${seq}`,
        profileId: grant.profileId,
        createdByAccountId: grant.createdByAccountId,
        tokenHash: grant.tokenHash,
        sections: [...grant.sections],
        initiator: grant.initiator,
        createdAt: grant.createdAt.toISOString(),
        expiresAt: grant.expiresAt.toISOString(),
        maxViews: grant.maxViews,
        viewCount: 0,
        pinAttempts: 0,
        language: grant.language,
        pinRequired: grant.pinRequired,
        pinHash: grant.pinHash,
        pinSalt: grant.pinSalt,
        label: grant.label,
        attestations: grant.attestations,
        directive: grant.directive,
      };
      rows.set(stored.id, stored);
      return clone(stored);
    },

    async findByTokenHash(tokenHash) {
      const hit = Array.from(rows.values()).find((g) => g.tokenHash === tokenHash);
      return hit ? clone(hit) : null;
    },

    async findById(id) {
      const g = rows.get(id);
      return g ? clone(g) : null;
    },

    async listByProfile(profileId) {
      return Array.from(rows.values())
        .filter((g) => g.profileId === profileId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(clone);
    },

    async recordPinFailure(id, maxAttempts, now) {
      const g = rows.get(id);
      if (!g) return { pinAttempts: 0, locked: false };
      g.pinAttempts += 1;
      if (g.pinAttempts >= maxAttempts && !g.lockedAt) g.lockedAt = now.toISOString();
      return { pinAttempts: g.pinAttempts, locked: Boolean(g.lockedAt) };
    },

    async clearPinAttempts(id) {
      const g = rows.get(id);
      if (g) g.pinAttempts = 0;
    },

    async claimView(id, now) {
      const g = rows.get(id);
      if (!g) return null;
      if (g.revokedAt || g.lockedAt) return null;
      if (Date.parse(g.expiresAt) <= now.getTime()) return null;
      if (g.viewCount >= g.maxViews) return null;
      g.viewCount += 1;
      return clone(g);
    },

    async revoke(id, reason, now) {
      const g = rows.get(id);
      if (!g) return null;
      if (!g.revokedAt) {
        g.revokedAt = now.toISOString();
        g.revokedReason = reason;
      }
      return clone(g);
    },
  };
}

let active: ShareStore = postgresShareStore;

export function shareStore(): ShareStore {
  return active;
}

/** Test seam. Never called from a request path. */
export function __setShareStore(store: ShareStore): void {
  active = store;
}
