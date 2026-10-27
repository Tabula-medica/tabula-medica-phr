import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  payerRefreshBackoffMs, isRetryableRefreshStatus,
  PAYER_RETRY_BASE_MS, PAYER_RETRY_MAX_MS, PAYER_RETRY_ALERT_COOLDOWN_MS,
} from "../payer-refresh-policy";
import type { PayerRetryDependencies } from "../payer-token-retry-service";

let service: typeof import("../payer-token-retry-service");
let broker: typeof import("../auth0-fhir-broker");
let db: typeof import("../db")["db"];
let encrypt: typeof import("../said-patient-service")["encryptField"];
const testKey = "payer-retry-unit-test-key";

before(async () => {
  process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
  // Use synthetic tokens/key only. No live DB or HTTP requests in this suite.
  process.env.PHI_ENCRYPTION_KEY = testKey;
  ({ db } = await import("../db"));
  ({ encryptField: encrypt } = await import("../said-patient-service"));
  service = await import("../payer-token-retry-service");
  broker = await import("../auth0-fhir-broker");
});
after(() => service.stopPayerTokenRetryScheduler());

test("retry backoff doubles from 5 minutes to a 6-hour cap", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(payerRefreshBackoffMs),
    [5, 10, 20, 40, 80].map(m => m * 60_000));
  assert.equal(payerRefreshBackoffMs(20), PAYER_RETRY_MAX_MS);
  assert.equal(payerRefreshBackoffMs(1_000_000), PAYER_RETRY_MAX_MS);
  assert.equal(payerRefreshBackoffMs(0), PAYER_RETRY_BASE_MS);
});

test("rate limits and upstream failures are retryable; rejected credentials are not", () => {
  for (const status of [408, 429, 500, 502, 503, 504]) assert.ok(isRetryableRefreshStatus(status));
  for (const status of [400, 401, 403]) assert.equal(isRetryableRefreshStatus(status), false);
});

function fixture() {
  let now = new Date("2026-10-25T00:00:00Z");
  const row = {
    id: "connection-test", userId: "patient-test", sourceType: "cigna",
    status: "error", failures: 0, next: now.getTime(), alerted: null as number | null,
  };
  const alerts: Record<string, unknown>[] = [];
  let calls = 0;
  let behavior: "fail" | "recover" | "reauth" | "throw" = "fail";
  let delivered = true;
  const deps: PayerRetryDependencies = {
    now: () => now,
    async listDue() {
      return row.status === "error" && row.next <= now.getTime() ? [row] : [];
    },
    async claim() {
      if (row.status !== "error" || row.next > now.getTime()) return false;
      row.next = now.getTime() + PAYER_RETRY_BASE_MS;
      return true;
    },
    async refresh() {
      calls++;
      if (behavior === "throw") throw new Error("must not log synthetic-token");
      if (behavior === "recover" || behavior === "reauth") {
        row.status = behavior === "recover" ? "active" : "needs_reauth";
        row.failures = 0;
        row.alerted = null;
      } else {
        row.failures++;
        row.next = now.getTime() + payerRefreshBackoffMs(row.failures);
      }
    },
    async claimAlert() {
      if (row.status !== "error" || row.failures < 5 ||
          (row.alerted !== null && now.getTime() - row.alerted < PAYER_RETRY_ALERT_COOLDOWN_MS)) return null;
      row.alerted = now.getTime();
      return { failures: row.failures };
    },
    async releaseAlert() { row.alerted = null; },
    critical: async (_message, metadata) => { alerts.push(metadata); return delivered; },
  };
  return {
    row, deps, alerts, calls: () => calls,
    behavior: (value: typeof behavior) => { behavior = value; },
    deliver: (value: boolean) => { delivered = value; },
    advanceToDue: () => { now = new Date(row.next); },
    advanceDay: () => { now = new Date(now.getTime() + PAYER_RETRY_ALERT_COOLDOWN_MS); },
  };
}

test("five failures escalate once, persist cooldown over worker restart, and re-alert after a day", async () => {
  const f = fixture();
  const sweep = service.createPayerTokenRetryWorker(f.deps);
  for (let i = 0; i < 5; i++) {
    f.advanceToDue();
    await sweep();
    await sweep(); // No repeated calls before due time.
  }
  assert.equal(f.calls(), 5);
  assert.equal(f.alerts.length, 1);
  assert.equal(f.alerts[0].consecutiveFailures, 5);
  const restarted = service.createPayerTokenRetryWorker(f.deps);
  f.advanceToDue();
  await restarted();
  assert.equal(f.alerts.length, 1);
  f.advanceDay();
  await restarted();
  assert.equal(f.alerts.length, 2);
  const serialized = JSON.stringify(f.alerts);
  for (const secret of ["patient-test", "connection-test", "synthetic-token"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("recovery and needs_reauth stop retries and do not page ops", async () => {
  for (const behavior of ["recover", "reauth"] as const) {
    const f = fixture();
    f.row.failures = 4;
    f.behavior(behavior);
    const sweep = service.createPayerTokenRetryWorker(f.deps);
    await sweep();
    f.advanceDay();
    await sweep();
    assert.equal(f.calls(), 1);
    assert.equal(f.row.failures, 0);
    assert.equal(f.alerts.length, 0);
  }
  const f = fixture();
  f.row.status = "needs_reauth";
  await service.createPayerTokenRetryWorker(f.deps)();
  assert.equal(f.calls(), 0);
});

test("failed or missing notification delivery releases cooldown and retries until delivered", async () => {
  const f = fixture();
  f.row.failures = 4;
  f.deliver(false);
  const sweep = service.createPayerTokenRetryWorker(f.deps);
  await sweep();
  assert.equal(f.alerts.length, 1);
  assert.equal(f.row.alerted, null);
  f.advanceToDue();
  f.deliver(true);
  await sweep();
  assert.equal(f.alerts.length, 2);
  assert.notEqual(f.row.alerted, null);
  f.advanceToDue();
  await sweep();
  assert.equal(f.alerts.length, 2);
});

test("two replicas cannot claim the same due connection; local sweeps are single-flight", async () => {
  const f = fixture();
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const refresh = f.deps.refresh;
  f.deps.refresh = async (...args) => { await waiting; return refresh(...args); };
  const a = service.createPayerTokenRetryWorker(f.deps);
  const b = service.createPayerTokenRetryWorker(f.deps);
  const first = a();
  await a();
  await b();
  release();
  await first;
  assert.equal(f.calls(), 1);
});

test("a thrown refresh leaves a bounded lease and does not prevent later retries", async () => {
  const f = fixture();
  f.behavior("throw");
  const sweep = service.createPayerTokenRetryWorker(f.deps);
  await sweep();
  await sweep();
  assert.equal(f.calls(), 1);
  f.advanceToDue();
  f.behavior("recover");
  await sweep();
  assert.equal(f.calls(), 2);
});

test("sweep DB errors emit an ops critical without raw exception details, and release single-flight", async () => {
  const f = fixture();
  const list = f.deps.listDue;
  f.deps.listDue = async () => { throw new Error("synthetic-token"); };
  const sweep = service.createPayerTokenRetryWorker(f.deps);
  await sweep();
  assert.deepEqual(f.alerts, [{ event: "payer_token_retry_sweep_failed" }]);
  f.deps.listDue = list;
  await sweep();
  assert.equal(f.calls(), 1);
});

test("sweep failures retry undelivered notifications after 5 minutes and suppress delivered repeats", async () => {
  const f = fixture();
  f.deps.listDue = async () => { throw new Error("synthetic-token"); };
  f.deliver(false);
  const sweep = service.createPayerTokenRetryWorker(f.deps);
  await sweep();
  await sweep();
  assert.equal(f.alerts.length, 1);
  f.row.next += PAYER_RETRY_BASE_MS;
  f.advanceToDue();
  f.deliver(true);
  await sweep();
  assert.equal(f.alerts.length, 2);
  f.row.next += PAYER_RETRY_BASE_MS;
  f.advanceToDue();
  await sweep();
  assert.equal(f.alerts.length, 2);
});
test("production repository filters by error and due time, atomically claims leases and alert cooldown", async () => {
  const predicates: { sql: string; params: unknown[] }[] = [];
  const sets: any[] = [];
  const dialect = new PgDialect();
  const oldSelect = db.select;
  const oldUpdate = db.update;
  (db as any).select = () => ({
    from: () => ({
      where: (predicate: any) => {
        predicates.push(dialect.sqlToQuery(predicate));
        return { orderBy: () => ({ limit: async (limit: number) => {
          assert.equal(limit, 50);
          return [{ id: "test", userId: "test", sourceType: "cigna" }];
        } }) };
      },
    }),
  });
  (db as any).update = () => ({
    set: (values: any) => {
      sets.push(values);
      return { where: (predicate: any) => {
        predicates.push(dialect.sqlToQuery(predicate));
        return { returning: async () => [] }; // Another replica claimed it.
      } };
    },
  });
  try {
    await service.createPayerTokenRetryWorker()();
    assert.equal(predicates.length, 2);
    for (const query of predicates) {
      assert.ok(query.sql.includes('"sync_status" ='));
      assert.ok(query.params.includes("error"));
      assert.ok(!query.params.includes("needs_reauth"));
      assert.ok(query.sql.includes('"next_refresh_retry_at" <='));
      assert.ok(query.sql.includes('"last_refresh_attempt_at" <='));
    }
    assert.ok(sets[0].nextRefreshRetryAt instanceof Date);
  } finally {
    db.select = oldSelect;
    db.update = oldUpdate;
  }
});

test("production alert claim requires error status, threshold and persisted cooldown", async () => {
  const predicates: { sql: string; params: unknown[] }[] = [];
  const dialect = new PgDialect();
  const oldSelect = db.select;
  const oldUpdate = db.update;
  const oldInsert = db.insert;
  const { logger } = await import("../utils/logger");
  const critical = mock.method(logger, "critical", () => {});
  let updates = 0;
  let selects = 0;
  (db as any).select = () => ({
    from: () => ({ where: () => {
      selects++;
      if (selects === 1) return { orderBy: () => ({ limit: async () => [
        { id: "test", userId: "test", sourceType: "cigna" },
      ] }) };
      // Simulate deletion after claim. No network call or token reads.
      return { limit: async () => [] };
    } }),
  });
  (db as any).update = () => ({
    set: () => ({ where: (predicate: any) => {
      predicates.push(dialect.sqlToQuery(predicate));
      updates++;
      return { returning: async () => updates === 1 ? [{ id: "test" }] : [] };
    } }),
  });
  (db as any).insert = () => ({ values: async () => {} });
  try {
    await service.createPayerTokenRetryWorker()();
    const alert = predicates[1];
    assert.match(alert.sql, /"sync_status" =/);
    assert.match(alert.sql, /"consecutive_refresh_failures" >=/);
    assert.match(alert.sql, /"last_refresh_alert_at" is null/);
    assert.match(alert.sql, /"last_refresh_alert_at" <=/);
    assert.ok(alert.params.includes("error"));
    assert.ok(alert.params.includes(5));
    // Drizzle's timestamp encoder serializes bound dates to ISO strings.
    assert.ok(alert.params.some(v => typeof v === "string" &&
      Math.abs(Date.now() - Date.parse(v) - PAYER_RETRY_ALERT_COOLDOWN_MS) < 5000));
    assert.equal(critical.mock.calls.length, 0);
  } finally {
    db.select = oldSelect;
    db.update = oldUpdate;
    db.insert = oldInsert;
    critical.mock.restore();
  }
});

test("production escalation sends an ops notification, and failed delivery compare-and-clears its claim", async () => {
  const oldSelect = db.select;
  const oldUpdate = db.update;
  const oldInsert = db.insert;
  const { __setOpsAlertFetchImplForTesting } = await import("../utils/ops-alert");
  const { logger } = await import("../utils/logger");
  const critical = mock.method(logger, "critical", () => {});
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/synthetic-payer-retry";
  const payloads: any[] = [];
  const releasePredicates: { sql: string; params: unknown[] }[] = [];
  let delivered = true;
  let selects = 0;
  let updates = 0;
  const dialect = new PgDialect();
  __setOpsAlertFetchImplForTesting(async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    assert.ok(init.signal instanceof AbortSignal);
    return { ok: delivered, status: delivered ? 200 : 503 };
  });
  (db as any).select = () => ({
    from: () => ({ where: () => {
      selects++;
      return selects % 2 === 1
        ? { orderBy: () => ({ limit: async () => [
            { id: "private-connection", userId: "private-patient", sourceType: "private-source" },
          ] }) }
        : { limit: async () => [] };
    } }),
  });
  (db as any).update = () => ({
    set: (set: any) => ({ where: (predicate: any) => {
      if (set.lastRefreshAlertAt === null) {
        releasePredicates.push(dialect.sqlToQuery(predicate));
        return Promise.resolve([]);
      }
      updates++;
      return { returning: async () => updates % 2 === 1
        ? [{ id: "private-connection" }] : [{ failures: 5 }] };
    } }),
  });
  (db as any).insert = () => ({ values: async () => {} });
  try {
    await service.createPayerTokenRetryWorker()();
    assert.equal(payloads.length, 1);
    assert.equal(critical.mock.calls.length, 1);
    assert.equal(releasePredicates.length, 0);
    assert.ok(JSON.stringify(payloads[0]).includes("payer_token_refresh_exhausted"));
    assert.ok(JSON.stringify(payloads[0]).includes("consecutiveFailures"));
    for (const privateValue of ["private-connection", "private-patient", "private-source"]) {
      assert.equal(JSON.stringify(payloads).includes(privateValue), false);
    }
    delivered = false;
    await service.createPayerTokenRetryWorker()();
    assert.equal(payloads.length, 2);
    assert.equal(releasePredicates.length, 1);
    assert.match(releasePredicates[0].sql, /"id" =/);
    assert.match(releasePredicates[0].sql, /"last_refresh_alert_at" =/);
  } finally {
    db.select = oldSelect;
    db.update = oldUpdate;
    db.insert = oldInsert;
    critical.mock.restore();
    __setOpsAlertFetchImplForTesting(null);
    delete process.env.SLACK_WEBHOOK_URL;
  }
});

test("production sweep failure sends an ops notification without leaking the DB error", async () => {
  const oldSelect = db.select;
  const { __setOpsAlertFetchImplForTesting } = await import("../utils/ops-alert");
  const { logger } = await import("../utils/logger");
  const critical = mock.method(logger, "critical", () => {});
  process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/synthetic-payer-retry";
  const payloads: any[] = [];
  __setOpsAlertFetchImplForTesting(async (_url, init) => {
    payloads.push(JSON.parse(init.body));
    return { ok: true, status: 200 };
  });
  (db as any).select = () => { throw new Error("private-db-connection-string"); };
  try {
    const sweep = service.createPayerTokenRetryWorker();
    await sweep();
    await sweep();
    assert.equal(payloads.length, 1);
    assert.equal(critical.mock.calls.length, 1);
    assert.ok(JSON.stringify(payloads).includes("payer_token_retry_sweep_failed"));
    assert.equal(JSON.stringify(payloads).includes("private-db-connection-string"), false);
  } finally {
    db.select = oldSelect;
    critical.mock.restore();
    __setOpsAlertFetchImplForTesting(null);
    delete process.env.SLACK_WEBHOOK_URL;
  }
});

test("scheduler starts immediately, runs every minute and is idempotent and stoppable", async () => {
  const oldSelect = db.select;
  (db as any).select = () => ({
    from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => [] }) }) }),
  });
  let unrefs = 0;
  const interval = mock.method(globalThis, "setInterval", (_fn: any, ms: number) => {
    assert.equal(ms, 60_000);
    return { unref: () => { unrefs++; } } as any;
  });
  const clear = mock.method(globalThis, "clearInterval", () => {});
  try {
    service.startPayerTokenRetryScheduler();
    service.startPayerTokenRetryScheduler();
    assert.equal(interval.mock.calls.length, 1);
    assert.equal(unrefs, 1);
    service.stopPayerTokenRetryScheduler();
    assert.equal(clear.mock.calls.length, 1);
  } finally {
    // Let the initial no-op sweep finish before restoring the repository.
    await new Promise<void>(resolve => setImmediate(resolve));
    db.select = oldSelect;
    interval.mock.restore();
    clear.mock.restore();
  }
});

test("broker persists transient failures/backoff, rejects bad grants, and clears retry state on recovery", async () => {
  const oldSelect = db.select;
  const oldUpdate = db.update;
  const oldInsert = db.insert;
  const oldFetch = globalThis.fetch;
  let httpStatus = 503;
  let body: unknown = {};
  const updates: any[] = [];
  const upserts: any[] = [];
  const row = {
    accessTokenEncrypted: encrypt("synthetic-access", testKey),
    refreshTokenEncrypted: encrypt("synthetic-refresh", testKey),
    expiresAt: new Date(), connectedAt: new Date(),
    fhirBaseUrl: "", sourceType: "cigna",
  };
  (db as any).select = () => ({
    from: () => ({ where: () => ({ limit: async () => [row] }) }),
  });
  (db as any).update = () => ({
    set: (set: any) => { updates.push(set); return { where: async () => [] }; },
  });
  (db as any).insert = () => ({
    values: () => ({
      onConflictDoUpdate: async ({ set }: any) => { upserts.push(set); },
    }),
  });
  globalThis.fetch = (async (_url: any, init: any) => {
    assert.ok(init.signal instanceof AbortSignal);
    return new Response(JSON.stringify(body), { status: httpStatus });
  }) as typeof fetch;
  try {
    for (httpStatus of [503, 429, 400]) {
      assert.equal(await broker.refreshPayerToken("test", "cigna"), null);
    }
    assert.deepEqual(updates.map(u => u.syncStatus), ["error", "error", "needs_reauth"]);
    const dialect = new PgDialect();
    const count = dialect.sqlToQuery(updates[0].consecutiveRefreshFailures);
    assert.match(count.sql, /consecutive_refresh_failures.*\+ 1/);
    const retry = dialect.sqlToQuery(updates[0].nextRefreshRetryAt);
    assert.match(retry.sql, /LEAST\(21600, 300 \* POWER/);
    assert.equal(updates[2].nextRefreshRetryAt, null);
    httpStatus = 200;
    body = { unexpected: "invalid response" };
    assert.equal(await broker.refreshPayerToken("test", "cigna"), null);
    assert.equal(updates.at(-1).syncStatus, "error");
    body = { access_token: "synthetic-new-access", expires_in: 3600 };
    assert.ok(await broker.refreshPayerToken("test", "cigna"));
    assert.equal(upserts[0].syncStatus, "active");
    assert.equal(upserts[0].consecutiveRefreshFailures, 0);
    assert.equal(upserts[0].nextRefreshRetryAt, null);
    assert.equal(upserts[0].lastRefreshAlertAt, null);
  } finally {
    db.select = oldSelect;
    db.update = oldUpdate;
    db.insert = oldInsert;
    globalThis.fetch = oldFetch;
  }
});
