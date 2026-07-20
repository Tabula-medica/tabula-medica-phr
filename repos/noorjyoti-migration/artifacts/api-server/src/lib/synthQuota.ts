import { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { db, pool, synthHitsTable } from "@workspace/db";
import * as schema from "@workspace/db/schema";

// Per-user rate limit for fresh TTS synthesis. Cache hits do not consume
// budget — only requests that actually call the paid OpenAI API are counted.
// Hits are persisted in Postgres (`synth_hits`) so the cap is enforced
// globally across multiple API instances and survives restarts.
export const SYNTH_MINUTE_MS = 60_000;
export const SYNTH_DAY_MS = 24 * 60 * 60_000;
export const SYNTH_MAX_PER_MINUTE = 5;
export const SYNTH_MAX_PER_DAY = 50;

export type SynthQuotaSnapshot = {
  limitPerDay: number;
  limitPerMinute: number;
  remainingDay: number;
  remainingMinute: number;
  resetDaySeconds: number;
};

export async function getSynthQuotaSnapshot(
  userId: string,
): Promise<SynthQuotaSnapshot> {
  const now = Date.now();
  const dayAgo = new Date(now - SYNTH_DAY_MS);
  const minuteAgo = new Date(now - SYNTH_MINUTE_MS);

  const rows = await db
    .select({ createdAt: synthHitsTable.createdAt })
    .from(synthHitsTable)
    .where(
      and(
        eq(synthHitsTable.userId, userId),
        gte(synthHitsTable.createdAt, dayAgo),
      ),
    );

  const dayCount = rows.length;
  const minuteCount = rows.filter((r) => r.createdAt >= minuteAgo).length;
  const oldestMs = rows.length
    ? Math.min(...rows.map((r) => r.createdAt.getTime()))
    : now;
  const resetDaySeconds = rows.length
    ? Math.max(0, Math.ceil((SYNTH_DAY_MS - (now - oldestMs)) / 1000))
    : 0;

  return {
    limitPerDay: SYNTH_MAX_PER_DAY,
    limitPerMinute: SYNTH_MAX_PER_MINUTE,
    remainingDay: Math.max(0, SYNTH_MAX_PER_DAY - dayCount),
    remainingMinute: Math.max(0, SYNTH_MAX_PER_MINUTE - minuteCount),
    resetDaySeconds,
  };
}

export async function setSynthQuotaHeaders(
  res: { setHeader: (name: string, value: string) => void },
  userId: string,
): Promise<void> {
  try {
    const snap = await getSynthQuotaSnapshot(userId);
    res.setHeader("X-Synth-Limit-Day", String(snap.limitPerDay));
    res.setHeader("X-Synth-Remaining-Day", String(snap.remainingDay));
    res.setHeader("X-Synth-Limit-Minute", String(snap.limitPerMinute));
    res.setHeader("X-Synth-Remaining-Minute", String(snap.remainingMinute));
    res.setHeader("X-Synth-Reset-Day-Seconds", String(snap.resetDaySeconds));
  } catch (err) {
    // Headers are advisory; don't fail the response if the snapshot read errors.
    console.warn("[synthQuota] failed to set quota headers", err);
  }
}

export type SynthReservation =
  | { ok: true; hitId: number }
  | { ok: false; retryAfterSeconds: number; message: string };

// Atomically reserve a synthesis slot for the user.
//
// Concurrency model: we take a Postgres transaction-scoped advisory lock
// keyed on the user id (`pg_advisory_xact_lock(hashtext(user_id))`). That
// serializes every reservation for a given user across all API instances
// regardless of transaction isolation level, so two concurrent workers
// cannot both squeak past the cap. The lock is auto-released when the
// transaction commits or rolls back. Different users hash to different
// lock keys (with vanishingly small collision odds) so per-user
// reservations remain independent.
//
// On failure we return a 429-style result with a Retry-After hint derived
// from the next-oldest hit. On success we return the inserted hit's id so
// callers can release that exact row if the paid call later fails.
export async function reserveSynthHit(
  userId: string,
): Promise<SynthReservation> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const now = new Date();
    const minuteAgo = new Date(now.getTime() - SYNTH_MINUTE_MS);
    const dayAgo = new Date(now.getTime() - SYNTH_DAY_MS);

    // Opportunistic cleanup: drop this user's rows older than the day window
    // so the table doesn't grow unbounded.
    await tx
      .delete(synthHitsTable)
      .where(
        and(
          eq(synthHitsTable.userId, userId),
          lt(synthHitsTable.createdAt, dayAgo),
        ),
      );

    const [minuteRow] = await tx
      .select({ c: count() })
      .from(synthHitsTable)
      .where(
        and(
          eq(synthHitsTable.userId, userId),
          gte(synthHitsTable.createdAt, minuteAgo),
        ),
      );
    const minuteCount = Number(minuteRow?.c ?? 0);

    if (minuteCount >= SYNTH_MAX_PER_MINUTE) {
      const [oldest] = await tx
        .select({ t: synthHitsTable.createdAt })
        .from(synthHitsTable)
        .where(
          and(
            eq(synthHitsTable.userId, userId),
            gte(synthHitsTable.createdAt, minuteAgo),
          ),
        )
        .orderBy(asc(synthHitsTable.createdAt))
        .limit(1);
      const oldestMs = oldest?.t ? oldest.t.getTime() : now.getTime();
      const retry = Math.max(
        1,
        Math.ceil((SYNTH_MINUTE_MS - (now.getTime() - oldestMs)) / 1000),
      );
      return {
        ok: false,
        retryAfterSeconds: retry,
        message: `You're generating audio quickly — please wait about ${retry}s before trying another new track. Already-saved tracks still play instantly.`,
      } as const;
    }

    const [dayRow] = await tx
      .select({ c: count() })
      .from(synthHitsTable)
      .where(
        and(
          eq(synthHitsTable.userId, userId),
          gte(synthHitsTable.createdAt, dayAgo),
        ),
      );
    const dayCount = Number(dayRow?.c ?? 0);

    if (dayCount >= SYNTH_MAX_PER_DAY) {
      const [oldest] = await tx
        .select({ t: synthHitsTable.createdAt })
        .from(synthHitsTable)
        .where(
          and(
            eq(synthHitsTable.userId, userId),
            gte(synthHitsTable.createdAt, dayAgo),
          ),
        )
        .orderBy(asc(synthHitsTable.createdAt))
        .limit(1);
      const oldestMs = oldest?.t ? oldest.t.getTime() : now.getTime();
      const retry = Math.max(
        60,
        Math.ceil((SYNTH_DAY_MS - (now.getTime() - oldestMs)) / 1000),
      );
      return {
        ok: false,
        retryAfterSeconds: retry,
        message: `You've reached today's limit of ${SYNTH_MAX_PER_DAY} new audio generations. Saved tracks still play normally — please try again tomorrow.`,
      } as const;
    }

    const inserted = await tx
      .insert(synthHitsTable)
      .values({ userId, createdAt: now })
      .returning({ id: synthHitsTable.id });
    return { ok: true, hitId: inserted[0]!.id } as const;
  });
}

// Release a previously-reserved hit (by exact id) if the synthesis itself
// failed, so a failed paid call doesn't permanently consume the user's quota.
export async function releaseSynthHit(hitId: number): Promise<void> {
  try {
    await db.delete(synthHitsTable).where(eq(synthHitsTable.id, hitId));
  } catch (err) {
    console.warn("[synthQuota] failed to release synth hit", err);
  }
}

// Acquire a Postgres session-level advisory lock for the given synthesis key,
// run `fn` under the lock, then release it.  Unlike transaction-scoped locks
// (`pg_advisory_xact_lock`) this lock persists across transaction boundaries,
// allowing it to span the full duration of a slow OpenAI call.
//
// The lock serializes synthesis of the same (chapterId, language, voice)
// combination across ALL API instances, so a second instance that races on a
// cold cache entry will find the row already committed when it acquires the
// lock — eliminating duplicate paid upstream calls between instances.
//
// A dedicated pool client is used so the session-level lock is bound to a
// single TCP connection and released deterministically in the `finally` block,
// even if the OpenAI call throws.
// The type of the client-bound Drizzle instance passed to withSynthLock
// callbacks.  All DB operations inside the lock MUST use this instance rather
// than the module-level `db` so that reads and writes share the same
// connection that holds the advisory lock — preventing dual-connection
// consumption per request that would exhaust the pool under concurrency.
//
// NodePgDatabase<typeof schema> covers both Pool- and PoolClient-backed
// instances, so this type is compatible with the PoolClient-bound instance
// created inside withSynthLock.
export type LockedDb = NodePgDatabase<typeof schema>;

export async function withSynthLock<T>(
  key: string,
  fn: (lockedDb: LockedDb) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const lockedDb: LockedDb = drizzle(client, { schema }) as LockedDb;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1)::bigint)", [key]);
    try {
      return await fn(lockedDb);
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1)::bigint)", [key])
        .catch((e) =>
          console.warn("[synthQuota] advisory unlock failed", e),
        );
    }
  } finally {
    client.release();
  }
}
