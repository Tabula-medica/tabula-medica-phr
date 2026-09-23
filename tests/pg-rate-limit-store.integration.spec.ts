import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { randomBytes } from "crypto";
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
 *
 * Everything this spec creates lives inside its own, uniquely-named Postgres
 * schema (via the pool's `search_path`), not the default `public` schema —
 * so if `TEST_DATABASE_URL` is ever pointed at a real dev/prod database by
 * mistake, this suite can't create, truncate, rename, or drop that
 * database's actual `rate_limit_hits` table. Teardown drops only this run's
 * own schema.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)("PgRateLimitStore (real Postgres)", () => {
  const dbUrl = TEST_DATABASE_URL as string;
  const schema = `rate_limit_test_${randomBytes(6).toString("hex")}`;
  let pool: Pool;

  beforeAll(async () => {
    // A bootstrap connection (default search_path) creates the isolated
    // schema; the actual test pool then defaults every connection it opens
    // into that schema, so the store's unqualified "rate_limit_hits" table
    // name resolves inside it, never the caller's real public schema.
    const bootstrap = new Pool({ connectionString: dbUrl });
    await bootstrap.query(`CREATE SCHEMA "${schema}"`);
    await bootstrap.end();

    pool = new Pool({ connectionString: dbUrl, options: `-c search_path="${schema}"` });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        key TEXT PRIMARY KEY,
        hits INTEGER NOT NULL,
        reset_time TIMESTAMPTZ NOT NULL
      )
    `);
  });

  afterAll(async () => {
    await pool.end();
    const bootstrap = new Pool({ connectionString: dbUrl });
    await bootstrap.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await bootstrap.end();
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

  it("sweeps a row expired well in the past on a real table, without touching one still in its window", async () => {
    const store = new PgRateLimitStore(pool, "sweep_test");
    store.init({ windowMs: 15 * 60 * 1000 });
    // A caller who hit the limiter once, two days ago, and never came back.
    await pool.query(
      `INSERT INTO rate_limit_hits (key, hits, reset_time) VALUES ($1, 1, now() - interval '2 days')`,
      [store["scopedKey"]("long-gone-caller")],
    );

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0); // force the sweep to run
    try {
      await store.increment("fresh-caller"); // any increment can trigger the sweep as a side effect
      await new Promise((r) => setTimeout(r, 50)); // the sweep is fire-and-forget; give it a moment to land
    } finally {
      randomSpy.mockRestore();
    }

    const remainingKeys = await pool.query("SELECT key FROM rate_limit_hits");
    expect(remainingKeys.rows.map((r) => r.key)).not.toContain(store["scopedKey"]("long-gone-caller"));
    expect((await store.get("fresh-caller"))?.totalHits).toBe(1); // its own fresh row is untouched
  });
});
