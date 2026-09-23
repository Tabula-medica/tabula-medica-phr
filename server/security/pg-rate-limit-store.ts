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
 * The `rate_limit_hits` table is a normal Drizzle-managed table
 * (`shared/schema.ts` → `rateLimitHitsTable`), applied via the project's
 * db:push/publish flow like every other table — this store does not run
 * DDL itself (`.local/skills/database/references/database-migrations-on-publish.md`
 * prohibits startup-time schema mutation). If the table is missing —
 * pre-publish, or a role without DDL rights — `increment`/`get`/etc. reject
 * and `passOnStoreError: true` on each limiter fails that limiter open
 * rather than 500ing the request.
 *
 * Keys are namespaced per limiter and hashed before storage: the raw key
 * express-rate-limit passes in is IP-derived, and hashing keeps the table
 * from holding a plaintext, queryable list of caller IPs.
 */
import type { Pool } from "pg";
import { createHash } from "crypto";

export interface ClientRateLimitInfo {
  totalHits: number;
  resetTime: Date | undefined;
}

const TABLE = "rate_limit_hits";

/** Minimal shape this store needs from `pg.Pool` — lets tests inject a fake without a real database. */
export type Queryable = Pick<Pool, "query">;

export class PgRateLimitStore {
  private readonly pool: Queryable;
  private readonly namespace: string;
  private windowMs = 15 * 60 * 1000;

  constructor(pool: Queryable, namespace: string) {
    this.pool = pool;
    this.namespace = namespace;
  }

  private scopedKey(key: string): string {
    return createHash("sha256").update(`${this.namespace}:${key}`).digest("hex");
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
    const res = await this.pool.query(
      `INSERT INTO ${TABLE} (key, hits, reset_time)
       VALUES ($1, 1, now() + $2::interval)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN ${TABLE}.reset_time <= now() THEN 1 ELSE ${TABLE}.hits + 1 END,
         reset_time = CASE WHEN ${TABLE}.reset_time <= now() THEN now() + $2::interval ELSE ${TABLE}.reset_time END
       RETURNING hits, reset_time`,
      [scoped, `${this.windowMs} milliseconds`],
    );
    const row = res.rows[0] as { hits: number; reset_time: Date };
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  async decrement(key: string): Promise<void> {
    await this.pool.query(`UPDATE ${TABLE} SET hits = GREATEST(hits - 1, 0) WHERE key = $1`, [this.scopedKey(key)]);
  }

  async resetKey(key: string): Promise<void> {
    await this.pool.query(`DELETE FROM ${TABLE} WHERE key = $1`, [this.scopedKey(key)]);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const res = await this.pool.query(`SELECT hits, reset_time FROM ${TABLE} WHERE key = $1 AND reset_time > now()`, [
      this.scopedKey(key),
    ]);
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0] as { hits: number; reset_time: Date };
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  shutdown(): void {
    /* pool lifecycle is owned by server/db.ts, not this store */
  }
}
