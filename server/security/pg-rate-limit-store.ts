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
 * `rate_limit_hits` and `rate_limit_key_secret` are normal Drizzle-managed
 * tables (`shared/schema.ts`), applied via the project's db:push/publish
 * flow like every other table — this store does not run DDL itself
 * (`.local/skills/database/references/database-migrations-on-publish.md`
 * prohibits startup-time schema mutation). IMPORTANT: `deploy.sh` /
 * `deploy-world.sh` deploy straight to Cloud Run via `gcloud run deploy
 * --source .` and do not run a schema-publish step, so the schema must be
 * applied to the production database out-of-band (`npm run db:push` against
 * the production `DATABASE_URL`, or the team's equivalent release step)
 * *before* a deploy that relies on this store reaches production traffic.
 * If either table is missing, every query rejects with Postgres error
 * 42P01 ("relation does not exist"); `logMissingTableOnce()` below turns
 * that into a loud, one-time `rate_limit_schema_missing` security event
 * instead of a failure indistinguishable from an ordinary DB hiccup, and
 * `passOnStoreError: true` on each limiter still fails that limiter open
 * rather than 500ing the request.
 *
 * Keys are namespaced per limiter and run through a keyed HMAC before
 * storage — a bare hash of a namespace + IP is enumerable (the namespace is
 * known and the IPv4 space is small enough to brute-force offline). The
 * HMAC key is *not* read from an env var like `SESSION_SECRET`: an
 * env-sourced secret is captured once at process start, so an old and a new
 * Cloud Run revision serving traffic concurrently during a rollout (or two
 * instances started with different env values) would hash the same caller
 * to two different rows and double their effective limit for the overlap.
 * Instead the key lives in `rate_limit_key_secret`, the same database that
 * already coordinates the counts themselves, so every instance and every
 * revision converges on one value regardless of deploy/rotation timing.
 */
import type { Pool } from "pg";
import { createHmac, randomBytes } from "crypto";
import { logSecurityEvent } from "./gcp-audit-logger";

export interface ClientRateLimitInfo {
  totalHits: number;
  resetTime: Date | undefined;
}

const TABLE = "rate_limit_hits";
const SECRET_TABLE = "rate_limit_key_secret";

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
    `[pg-rate-limit-store] "${TABLE}" or "${SECRET_TABLE}" does not exist — rate limiting is failing open on every limiter using this store. ` +
      "Apply the schema (npm run db:push against the production database, or the team's schema-publish step) before this deploy serves traffic.",
  );
  void logSecurityEvent({
    eventType: "rate_limit_schema_missing",
    actor: "system",
    riskLevel: "critical",
    details: { namespace, tables: `${TABLE},${SECRET_TABLE}` },
  });
}

export class PgRateLimitStore {
  private readonly pool: Queryable;
  private readonly namespace: string;
  private windowMs = 15 * 60 * 1000;
  private keySecretPromise: Promise<string> | null = null;

  constructor(pool: Queryable, namespace: string) {
    this.pool = pool;
    this.namespace = namespace;
  }

  private async query<T extends { rows: unknown[] }>(sql: string, params: unknown[]): Promise<T> {
    try {
      return (await this.pool.query(sql, params)) as T;
    } catch (err) {
      if (isUndefinedTableError(err)) logMissingTableOnce(this.namespace);
      throw err;
    }
  }

  /**
   * Fetches the shared HMAC key from `rate_limit_key_secret`, provisioning
   * it on first use. The insert/select pair is race-safe: if two instances
   * (or two stores in this process) reach this at the same time, the
   * `ON CONFLICT DO NOTHING` loser simply reads back whichever value won.
   */
  private getKeySecret(): Promise<string> {
    if (!this.keySecretPromise) {
      this.keySecretPromise = (async () => {
        const candidate = randomBytes(32).toString("hex");
        const inserted = await this.query<{ rows: { secret: string }[] }>(
          `INSERT INTO ${SECRET_TABLE} (id, secret) VALUES (1, $1) ON CONFLICT (id) DO NOTHING RETURNING secret`,
          [candidate],
        );
        if (inserted.rows.length > 0) return inserted.rows[0].secret;
        const existing = await this.query<{ rows: { secret: string }[] }>(
          `SELECT secret FROM ${SECRET_TABLE} WHERE id = 1`,
          [],
        );
        return existing.rows[0].secret;
      })().catch((err) => {
        this.keySecretPromise = null; // allow a retry on the next call rather than wedging forever
        throw err;
      });
    }
    return this.keySecretPromise;
  }

  private async scopedKey(key: string): Promise<string> {
    const secret = await this.getKeySecret();
    return createHmac("sha256", secret).update(`${this.namespace}:${key}`).digest("hex");
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const scoped = await this.scopedKey(key);
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
    const row = res.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  async decrement(key: string): Promise<void> {
    const scoped = await this.scopedKey(key);
    await this.query(`UPDATE ${TABLE} SET hits = GREATEST(hits - 1, 0) WHERE key = $1`, [scoped]);
  }

  async resetKey(key: string): Promise<void> {
    const scoped = await this.scopedKey(key);
    await this.query(`DELETE FROM ${TABLE} WHERE key = $1`, [scoped]);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const scoped = await this.scopedKey(key);
    const res = await this.query<{ rows: { hits: number; reset_time: Date }[] }>(
      `SELECT hits, reset_time FROM ${TABLE} WHERE key = $1 AND reset_time > now()`,
      [scoped],
    );
    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return { totalHits: row.hits, resetTime: row.reset_time };
  }

  shutdown(): void {
    /* pool lifecycle is owned by server/db.ts, not this store */
  }
}
