import { describe, it, expect, beforeEach } from "vitest";
import { PgRateLimitStore, type Queryable } from "../server/security/pg-rate-limit-store";

/**
 * In-memory fake of the one Postgres feature this store actually needs: an
 * atomic "insert or bump, resetting an expired window" upsert. Mirrors the
 * real SQL's semantics so this suite can run without a database, the way
 * the other two security-layer spec files do — but a synchronous fake can't
 * expose a real read/write race, so it doesn't stand in for proof that
 * concurrent increments are serialized by Postgres itself. That property is
 * covered separately by `tests/pg-rate-limit-store.integration.spec.ts`,
 * which runs against a real `postgres` service container in CI.
 */
type FakeRow = { hits: number; reset_time: Date };
type FakeSecretRow = { secret: string };
type FakeQueryResult = { rows: (FakeRow | FakeSecretRow)[] };

function fakeQueryable(): Queryable & { rows: Map<string, { hits: number; resetTime: Date }> } {
  const rows = new Map<string, { hits: number; resetTime: Date }>();
  let secret: string | undefined;
  const run = async (sql: string, params?: unknown[]): Promise<FakeQueryResult> => {
    const text = String(sql);

    if (text.includes("rate_limit_key_secret")) {
      if (text.startsWith("INSERT INTO")) {
        const [candidate] = params as [string];
        if (secret === undefined) {
          secret = candidate;
          return { rows: [{ secret }] };
        }
        return { rows: [] }; // ON CONFLICT DO NOTHING — already provisioned
      }
      if (text.startsWith("SELECT")) {
        return { rows: [{ secret: secret as string }] };
      }
      throw new Error(`fakeQueryable: unhandled secret-table query: ${text}`);
    }

    if (text.startsWith("INSERT INTO")) {
      const [key, intervalStr] = params as [string, string];
      const windowMs = parseInt(intervalStr, 10);
      const now = new Date();
      const existing = rows.get(key);
      const expired = !existing || existing.resetTime <= now;
      const row = expired
        ? { hits: 1, resetTime: new Date(now.getTime() + windowMs) }
        : { hits: existing.hits + 1, resetTime: existing.resetTime };
      rows.set(key, row);
      return { rows: [{ hits: row.hits, reset_time: row.resetTime }] };
    }

    if (text.startsWith("UPDATE") && text.includes("hits = GREATEST")) {
      const [key] = params as [string];
      const existing = rows.get(key);
      if (existing) existing.hits = Math.max(existing.hits - 1, 0);
      return { rows: [] };
    }

    if (text.startsWith("DELETE")) {
      const [key] = params as [string];
      rows.delete(key);
      return { rows: [] };
    }

    if (text.startsWith("SELECT")) {
      const [key] = params as [string];
      const existing = rows.get(key);
      if (!existing || existing.resetTime <= new Date()) return { rows: [] };
      return { rows: [{ hits: existing.hits, reset_time: existing.resetTime }] };
    }

    throw new Error(`fakeQueryable: unhandled query: ${text}`);
  };
  return { query: run as Queryable["query"], rows };
}

describe("PgRateLimitStore", () => {
  let pool: ReturnType<typeof fakeQueryable>;
  let store: PgRateLimitStore;

  beforeEach(() => {
    pool = fakeQueryable();
    store = new PgRateLimitStore(pool, "test_ns");
    store.init({ windowMs: 15 * 60 * 1000 });
  });

  it("increments a fresh key to 1, then 2, then 3", async () => {
    expect((await store.increment("1.2.3.4")).totalHits).toBe(1);
    expect((await store.increment("1.2.3.4")).totalHits).toBe(2);
    expect((await store.increment("1.2.3.4")).totalHits).toBe(3);
  });

  it("scopes keys by namespace so two limiters sharing a table never collide", async () => {
    const other = new PgRateLimitStore(pool, "other_ns");
    other.init({ windowMs: 15 * 60 * 1000 });
    await store.increment("shared-ip");
    await store.increment("shared-ip");
    const own = await store.get("shared-ip");
    const theirs = await other.get("shared-ip");
    expect(own?.totalHits).toBe(2);
    expect(theirs).toBeUndefined();
  });

  it("get() reflects the current count without incrementing", async () => {
    await store.increment("k1");
    await store.increment("k1");
    expect((await store.get("k1"))?.totalHits).toBe(2);
    expect((await store.get("k1"))?.totalHits).toBe(2); // unchanged by the read
  });

  it("decrement lowers the count, floored at zero", async () => {
    await store.increment("k2");
    await store.decrement("k2");
    expect((await store.get("k2"))?.totalHits).toBe(0);
    await store.decrement("k2"); // already zero; must not go negative
    expect((await store.get("k2"))?.totalHits).toBe(0);
  });

  it("resetKey removes the key entirely", async () => {
    await store.increment("k3");
    await store.resetKey("k3");
    expect(await store.get("k3")).toBeUndefined();
  });

  it("restarts the count once the window has elapsed instead of accumulating forever", async () => {
    const shortStore = new PgRateLimitStore(pool, "short_ns");
    shortStore.init({ windowMs: 50 });
    await shortStore.increment("k4");
    await shortStore.increment("k4");
    await new Promise((r) => setTimeout(r, 80));
    const r = await shortStore.increment("k4");
    expect(r.totalHits).toBe(1); // window elapsed -> restarted, not 3
  });

  it("never stores the raw rate-limit key — only an opaque hash of namespace+key", async () => {
    await store.increment("203.0.113.5");
    const storedKeys = [...pool.rows.keys()];
    expect(storedKeys).toHaveLength(1);
    expect(storedKeys[0]).not.toContain("203.0.113.5");
    expect(storedKeys[0]).not.toContain("test_ns");
    expect(storedKeys[0]).toMatch(/^[0-9a-f]{64}$/); // sha256 hex digest
  });

  it("propagates a query failure instead of swallowing it, so passOnStoreError can fail the limiter open", async () => {
    const failingPool: Queryable = {
      query: (() => Promise.reject(new Error("connection refused"))) as Queryable["query"],
    };
    const brokenStore = new PgRateLimitStore(failingPool, "broken_ns");
    brokenStore.init({ windowMs: 1000 });
    await expect(brokenStore.increment("k5")).rejects.toThrow("connection refused");
    await expect(brokenStore.get("k5")).rejects.toThrow("connection refused");
  });
});
