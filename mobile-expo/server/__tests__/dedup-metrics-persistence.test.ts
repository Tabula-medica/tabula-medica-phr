/**
 * Real Postgres regression coverage for durable, cross-instance AI health.
 * Auto-discovered by scripts/run-server-tests.mjs / npm run test:server.
 *
 * Run: node --import tsx server/__tests__/dedup-metrics-persistence.test.ts
 * Skips only if DATABASE_URL is absent; a configured but broken DB fails.
 * All writes are confined to a uniquely named schema, removed in finally.
 * No application tables or existing global metrics are modified.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";
import { Pool } from "pg";

test("deduplication metrics aggregate across processes, survive restarts, and fall back when unavailable", {
  skip: !process.env.DATABASE_URL && "DATABASE_URL absent: real Postgres required",
  timeout: 120_000,
}, async () => {
  const schema = `dedup_metrics_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
  });
  // Restrict search_path to this schema alone: even if table creation fails,
  // a worker can never accidentally write to public.deduplication_metrics.
  const isolatedUrl = new URL(process.env.DATABASE_URL!);
  isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);

  function instance(mode: string, events: string[] = []) {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: isolatedUrl.toString(),
      NODE_ENV: "test",
      GCP_KEY: "synthetic-test-key",
      SLACK_WEBHOOK_URL: "",
    };
    // A nested node:test context otherwise switches the child to a binary
    // reporter, hiding the explicit JSON result below.
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, [
      "--import", "tsx",
      resolve("server/__tests__/fixtures/dedup-metrics-worker.ts"),
      mode, JSON.stringify(events),
    ], { env, encoding: "utf8", timeout: 25_000, maxBuffer: 2 * 1024 * 1024 });
    assert.ifError(child.error);
    assert.equal(child.status, 0, `fresh instance failed:\n${child.stdout}\n${child.stderr}`);
    const line = child.stdout.split("\n").find((s) => s.startsWith("DEDUP_METRICS_RESULT:"));
    assert.ok(line, "worker must report stats after exercising the real service");
    return JSON.parse(line.slice("DEDUP_METRICS_RESULT:".length));
  }

  async function row() {
    const result = await admin.query(`SELECT * FROM "${schema}".deduplication_metrics`);
    assert.equal(result.rows.length, 1, "exactly one singleton row should exist");
    assert.equal(result.rows[0].id, "global");
    return result.rows[0];
  }

  function counters(stats: any) {
    return [
      stats.totalProcessed, stats.totalDuplicatesFound, stats.totalMerged,
      stats.aiComparisons, stats.ruleBasedFallbacks,
      stats.consecutiveAiFailures, stats.maxConsecutiveAiFailures,
    ];
  }

  async function assertAggregated(snapshot: any, expected: number[]) {
    assert.equal(snapshot.persisted.source, "persisted");
    assert.deepEqual(counters(snapshot.persisted), expected);
    const stored = await row();
    assert.deepEqual([
      stored.total_processed, stored.total_duplicates_found, stored.total_merged,
      stored.ai_comparisons, stored.rule_based_fallbacks,
      stored.consecutive_ai_failures, stored.max_consecutive_ai_failures,
    ], expected, "raw Postgres counters must agree with the persisted getter");
    assert.ok(stored.last_run_at instanceof Date);
    assert.ok(stored.updated_at instanceof Date);
    assert.equal(snapshot.persisted.aiMatchingDegraded,
      expected[5] >= snapshot.persisted.aiDegradedAlertThreshold);
    return stored;
  }

  let created = false;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Minimal isolated copy of the shared/schema.ts table contract. The
    // service's real SQL upsert and real Drizzle select both run against it.
    await admin.query(`CREATE TABLE "${schema}".deduplication_metrics (
      id varchar PRIMARY KEY DEFAULT 'global',
      total_processed integer NOT NULL DEFAULT 0,
      total_duplicates_found integer NOT NULL DEFAULT 0,
      total_merged integer NOT NULL DEFAULT 0,
      last_run_at timestamp,
      ai_comparisons integer NOT NULL DEFAULT 0,
      rule_based_fallbacks integer NOT NULL DEFAULT 0,
      consecutive_ai_failures integer NOT NULL DEFAULT 0,
      max_consecutive_ai_failures integer NOT NULL DEFAULT 0,
      last_ai_failure_reason text,
      last_ai_failure_at timestamp,
      last_ai_success_at timestamp,
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    const empty = instance("read");
    assert.equal(empty.persisted.source, "in_memory", "empty table uses memory");
    assert.deepEqual(counters(empty.persisted), [0, 0, 0, 0, 0, 0, 0]);

    // INSERT, then ON CONFLICT from a separate instance with zeroed memory.
    const first = instance("run", ["failure", "failure", "failure"]);
    const firstRow = await assertAggregated(first, [3, 3, 3, 0, 3, 3, 3]);
    assert.equal(firstRow.last_ai_failure_reason, "provider_error");
    assert.ok(firstRow.last_ai_failure_at instanceof Date);
    assert.equal(firstRow.last_ai_success_at, null);

    const second = instance("run", ["failure", "failure", "failure"]);
    assert.deepEqual(counters(second.memory), [3, 3, 3, 0, 3, 3, 3]);
    await assertAggregated(second, [6, 6, 6, 0, 6, 6, 6]);
    assert.equal(second.persisted.aiMatchingDegraded, true);

    // A reader with no local work still sees the combined counters/streak.
    const restarted = instance("read");
    assert.deepEqual(counters(restarted.memory), [0, 0, 0, 0, 0, 0, 0]);
    await assertAggregated(restarted, [6, 6, 6, 0, 6, 6, 6]);

    // A mixed run whose final event succeeds resets the persisted streak.
    const recovered = instance("run", ["failure", "failure", "success"]);
    const recoveredRow = await assertAggregated(recovered, [9, 9, 9, 1, 8, 0, 6]);
    assert.ok(recoveredRow.last_ai_success_at instanceof Date);
    assert.equal(recovered.persisted.aiMatchingDegraded, false);

    // Later trailing failures accumulate again, retaining the historical max.
    const failingAgain = instance("run", ["success", "failure", "failure"]);
    await assertAggregated(failingAgain, [12, 12, 12, 2, 10, 2, 6]);
    await assertAggregated(instance("read"), [12, 12, 12, 2, 10, 2, 6]);

    const beforeOutage = await row();
    instance("unavailable", ["failure", "failure", "success"]);
    assert.deepEqual(await row(), beforeOutage, "failed flush must not alter durable counters");
  } finally {
    try {
      if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
});
