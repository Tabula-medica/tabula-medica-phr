import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { PgRateLimitStore } from "../server/security/pg-rate-limit-store";

/**
 * Runs against a real Postgres instance (the `postgres` service container in
 * the `pg-rate-limit-integration` CI job — see .github/workflows/security-scan.yml).
 * The unit spec's in-memory fake mirrors the store's SQL semantics but can't
 * exercise real concurrent connections, so it can't prove the one property
 * this store exists for: that Postgres's `ON CONFLICT` upsert actually
 * serializes simultaneous increments from multiple callers (standing in for
 * multiple Cloud Run instances) into one correct count. This spec proves it
 * against the database engine itself.
 *
 * Skipped outside CI (or anywhere without TEST_DATABASE_URL) rather than
 * failing local `npm test` runs that don't have a Postgres instance handy.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("PgRateLimitStore (real Postgres)", () => {
  const dbUrl = TEST_DATABASE_URL as string;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        key TEXT PRIMARY KEY,
        hits INTEGER NOT NULL,
        reset_time TIMESTAMPTZ NOT NULL
      )
    `);
  });

  afterAll(async () => {
    await pool.query("DROP TABLE IF EXISTS rate_limit_hits");
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE rate_limit_hits");
  });

  it("serializes truly concurrent increments from one store instance into an exact count", async () => {
    const store = new PgRateLimitStore(pool, "concurrency_test");
    store.init({ windowMs: 15 * 60 * 1000 });

    await Promise.all(Array.from({ length: 30 }, () => store.increment("same-caller")));

    const result = await store.get("same-caller");
    expect(result?.totalHits).toBe(30);
  });

  it("shares counts across separate store instances on the same pool — the actual multi-instance scenario this store fixes", async () => {
    // Two instances, same as two Cloud Run replicas both backed by the same
    // Postgres database, racing to increment the same caller's counter.
    const instanceA = new PgRateLimitStore(pool, "multi_instance_test");
    const instanceB = new PgRateLimitStore(pool, "multi_instance_test");
    instanceA.init({ windowMs: 15 * 60 * 1000 });
    instanceB.init({ windowMs: 15 * 60 * 1000 });

    await Promise.all([
      ...Array.from({ length: 10 }, () => instanceA.increment("shared-caller")),
      ...Array.from({ length: 10 }, () => instanceB.increment("shared-caller")),
    ]);

    const seenByA = await instanceA.get("shared-caller");
    const seenByB = await instanceB.get("shared-caller");
    expect(seenByA?.totalHits).toBe(20);
    expect(seenByB?.totalHits).toBe(20);
  });

  it("restarts the window after expiry under real Postgres timestamps", async () => {
    const store = new PgRateLimitStore(pool, "window_test");
    store.init({ windowMs: 50 });

    await store.increment("k1");
    await store.increment("k1");
    await new Promise((r) => setTimeout(r, 100));
    const afterExpiry = await store.increment("k1");

    expect(afterExpiry.totalHits).toBe(1);
  });

  it("propagates a real connection error so passOnStoreError fails the limiter open", async () => {
    const deadPool = new Pool({ connectionString: dbUrl.replace(/\/[^/]+$/, "/nonexistent_db_for_test") });
    const store = new PgRateLimitStore(deadPool, "error_test");
    store.init({ windowMs: 1000 });

    await expect(store.increment("k1")).rejects.toThrow();
    await deadPool.end();
  });

  it("rejects with Postgres error 42P01 when the schema hasn't been published yet — the pre-deploy gap this store must fail loud on", async () => {
    // Simulates the real deploy hazard this test exists to catch: Cloud Run
    // traffic promoted before `rate_limit_hits` has been applied to the
    // production database via db:push/publish.
    await pool.query("ALTER TABLE rate_limit_hits RENAME TO rate_limit_hits_temp_rename");
    try {
      const store = new PgRateLimitStore(pool, "missing_schema_test");
      store.init({ windowMs: 1000 });
      await expect(store.increment("k1")).rejects.toMatchObject({ code: "42P01" });
    } finally {
      await pool.query("ALTER TABLE rate_limit_hits_temp_rename RENAME TO rate_limit_hits");
    }
  });
});
