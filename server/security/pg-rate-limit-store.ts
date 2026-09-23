/**
 * Postgres-backed `express-rate-limit` store.
 *
 * Why: every limiter in `api-protection.ts` used the library's default
 * in-memory store, which is per-process. This app runs on Cloud Run with up
 * to 10 instances (`deploy.sh` / `deploy-world.sh`, `--max-instances 10`),
 * so a caller distributed across instances got roughly N× the configured
 * limit before any single instance tripped the 429 / SIEM-visible event a
 * limiter like `sessionExchangeRateLimiter` exists to raise. This store
 * makes the counter shared, so the limit holds regardless of which
 * instance answers a given request.
 *
 * `rate_limit_hits` is a normal Drizzle-managed table (`shared/schema.ts`),
 * applied via the project's db:push/publish flow like every other table —
 * this store does not run DDL itself
 * (`.local/skills/database/references/database-migrations-on-publish.md`
 * prohibits startup-time schema mutation). IMPORTANT: `deploy.sh` /
 * `deploy-world.sh` deploy straight to Cloud Run via `gcloud run deploy
 * --source .` and do not run a schema-publish step, so the schema must be
 * applied to the production database out-of-band (`npm run db:push` against
 * the production `DATABASE_URL`, or the team's equivalent release step)
 * *before* a deploy that relies on this store reaches production traffic.
 * If the table is missing, every query rejects with Postgres error 42P01
 * ("relation does not exist"); `logMissingTableOnce()` below turns that into
 * a loud, one-time `rate_limit_schema_missing` security event instead of a
 * failure indistinguishable from an ordinary DB hiccup, and
 * `passOnStoreError: true` on each limiter still fails that limiter open
 * rather than 500ing the request.
 *
 * Keys are namespaced per limiter and run through a keyed HMAC before
 * storage — a bare hash of a namespace + IP is enumerable (the namespace is
 * known and the IPv4 space is small enough to brute-force offline). The
 * HMAC key is `SESSION_SECRET`, the same convention `siem-forwarder.ts`
 * uses for its own IP hashing — deliberately *not* stored alongside the
 * digests it protects (an earlier revision of this file tried that, to get
 * perfect cross-revision key stability, but that co-locates the key with
 * the exact data it's meant to keep opaque: anyone who can read this
 * database can then trivially reverse it). The accepted trade-off: if
 * `SESSION_SECRET` is rotated, an old and a new Cloud Run revision serving
 * traffic concurrently during that rollout briefly hash the same caller to
 * two different rows, up to doubling their effective limit for the overlap
 * window. `SESSION_SECRET` also signs this app's session cookies directly
 * (`replitAuth.ts`), so a rotation already invalidates every active session
 * fleet-wide — it's a rare, deliberate, already-disruptive event, and a
 * transient widening of a rate limit during that same window is a strictly
 * smaller cost than the alternative of making caller identities recoverable
 * from a database read.
 */
import type { Pool } from "pg";
import { createHmac, randomBytes } from "crypto";
import { logSecurityEvent } from "./gcp-audit-logger";

export interface ClientRateLimitInfo {
  totalHits: number;
  resetTime: Date | undefined;
}

const TABLE = "rate_limit_hits";
const KEY_HASH_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

// A row only ever gets touched again if the same caller returns within its
// window; a one-time caller's row would otherwise live forever. Rather than
// a separate scheduled job, each increment() has a small chance of also
// sweeping rows that expired well in the past — amortized, no new
// infrastructure, and never touches a row close enough to expiry to still
// be legitimately reused by the upsert below.
const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_GRACE = "1 day";
// Caps each sweep's own DELETE to a bounded batch. Without this, a table
// that's accumulated a large backlog (e.g. cleanup was broken for a while)
// would have some unlucky authentication request pay for a single
// transaction deleting the entire backlog — long lock hold, WAL spike. A
// bounded batch means the cost per sweep is small and constant; a large
// backlog just clears over more requests instead of a bigger single one.
const CLEANUP_BATCH_SIZE = 500;

/** Minimal shape this store needs from `pg.Pool` — lets tests inject a fake without a real database. */
export type Queryable = Pick<Pool, "query">;

let warnedMissingTable = false;

/** Postgres error code for "relation does not exist" — the un-published-schema case. */
function isUndefinedTableError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "42P01";
}

function logMissingTableOnce(namespace: string): void {
  if (warnedMissingTable) return;
  warnedMissingTable = true;
  console.error(
    `[pg-rate-limit-store] "${TABLE}" does not exist — rate limiting is failing open on every limiter using this store. ` +
      "Apply the schema (npm run db:push against the production database, or the team's schema-publish step) before this deploy serves traffic.",
  );
  void logSecurityEvent({
    eventType: "rate_limit_schema_missing",
    actor: "system",
    riskLevel: "critical",
    details: { namespace, table: TABLE },
  });
}

export class PgRateLimitStore {
  private readonly pool: Queryable;
  private readonly namespace: string;
  private windowMs = 15 * 60 * 1000;

  constructor(pool: Queryable, namespace: string) {
    this.pool = pool;
    this.namespace = namespace;
  }

  private scopedKey(key: string): string {
    return createHmac("sha256", KEY_HASH_SECRET).update(`${this.namespace}:${key}`).digest("hex");
  }

  private async query<T extends { rows: unknown[] }>(sql: string, params: unknown[]): Promise<T> {
    try {
      return (await this.pool.query(sql, params)) as T;
    } catch (err) {
      if (isUndefinedTableError(err)) logMissingTableOnce(this.namespace);
      throw err;
    }
  }

  private maybeSweepExpired(): void {
    if (Math.random() >= CLEANUP_PROBABILITY) return;
    void this.pool
      .query(
        `DELETE FROM ${TABLE} WHERE key IN (
           SELECT key FROM ${TABLE} WHERE reset_time < now() - interval '${CLEANUP_GRACE}' LIMIT ${CLEANUP_BATCH_SIZE}
         )`,
        [],
      )
      .catch(() => {
        /* best-effort; a failed sweep just means slightly more accumulation until the next lucky roll */
      });
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const scoped = this.scopedKey(key);
    // Atomic upsert: one round trip, no read-check-write race across
    // concurrent requests (from this instance or any other). A row whose
    // window has already elapsed restarts the count; otherwise it's
    // incremented in place.
    const res = await this.query<{ rows: { hits: number; reset_time: Date }[] }>(
      `INSERT INTO ${TABLE} (key, hits, reset_time)
       VALUES ($1, 1, now() + $2::interval)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN ${TABLE}.reset_time <= now() THEN 1 ELSE ${TABLE}.hits + 1 END,
         reset_time = CASE WHEN ${TABLE}.reset_time <= now() THEN now() + $2::interval ELSE ${TABLE}.reset_time END
       RETURNING hits, reset_time`,
      [scoped, `${this.windowMs} milliseconds`],
    );
    this.maybeSweepExpired();
    const row = res.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  async decrement(key: string): Promise<void> {
    await this.query(`UPDATE ${TABLE} SET hits = GREATEST(hits - 1, 0) WHERE key = $1`, [this.scopedKey(key)]);
  }

  async resetKey(key: string): Promise<void> {
    await this.query(`DELETE FROM ${TABLE} WHERE key = $1`, [this.scopedKey(key)]);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const res = await this.query<{ rows: { hits: number; reset_time: Date }[] }>(
      `SELECT hits, reset_time FROM ${TABLE} WHERE key = $1 AND reset_time > now()`,
      [this.scopedKey(key)],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  shutdown(): void {
    /* pool lifecycle is owned by server/db.ts, not this store */
  }
}
