/**
 * A fresh service instance for the Postgres integration test. Not a test file:
 * the parent invokes it once per simulated server restart.
 */
import assert from "node:assert/strict";

async function main() {
  const {
    deduplicateFhirBundle,
    getDeduplicationStats,
    getPersistedDeduplicationStats,
    __setChatCompleteImplForTesting,
  } = await import("../../vertex-deduplication-service");
  const { pool } = await import("../../db");
  const mode = process.argv[2];
  const events: string[] = JSON.parse(process.argv[3] || "[]");
  let comparisons = 0;

  __setChatCompleteImplForTesting((async () => {
    const event = events[comparisons++];
    assert.ok(event, "every AI comparison must have a scripted outcome");
    if (event === "failure") throw new Error("synthetic provider outage");
    return {
      content: '{"isDuplicate":true,"confidence":0.99,"reason":"synthetic match"}',
      json: { isDuplicate: true, confidence: 0.99, reason: "synthetic match" },
      provider: "vertex_ai",
      model: "deep",
    };
  }) as any);

  try {
    const initial = getDeduplicationStats();
    assert.equal(initial.totalProcessed, 0, "a new process starts with empty memory");
    assert.equal(initial.ruleBasedFallbacks, 0);
    assert.equal(initial.aiComparisons, 0);
    assert.equal(initial.consecutiveAiFailures, 0);

    if (mode === "run" || mode === "unavailable") {
      // Closing the real pool makes both writes and reads fail immediately,
      // without mocking Drizzle or risking a slow network timeout.
      if (mode === "unavailable") await pool.end();
      const records = ["a", "b", "c"].map((id) => ({
        resourceType: "Observation",
        id: `synthetic-${id}`,
        code: { coding: [{ system: "http://loinc.org", code: "1234-5" }] },
        effectiveDateTime: "2026-01-01T10:00:00Z",
      }));
      const result = await deduplicateFhirBundle(records);
      assert.equal(comparisons, 3, "the run must exercise all three AI comparisons");
      assert.equal(comparisons, events.length);
      assert.equal(result.totalRecords, 3);
      assert.equal(result.duplicatesFound, 3);
      assert.equal(result.mergedRecords, 3);
    } else {
      assert.equal(mode, "read");
    }

    const memory = getDeduplicationStats();
    const persisted = await getPersistedDeduplicationStats();
    if (mode === "unavailable") {
      assert.deepEqual(persisted, { ...memory, source: "in_memory" });
      assert.equal(memory.totalProcessed, 3, "DB failure must not block deduplication");
      assert.equal(memory.aiComparisons, 1);
      assert.equal(memory.ruleBasedFallbacks, 2);
    }
    console.log(`DEDUP_METRICS_RESULT:${JSON.stringify({ memory, persisted })}`);
  } finally {
    __setChatCompleteImplForTesting(null);
    if (mode !== "unavailable") await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
