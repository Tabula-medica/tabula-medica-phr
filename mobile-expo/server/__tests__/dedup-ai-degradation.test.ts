/**
 * Regression tests for AI-path observability in the Vertex deduplication
 * service (Task #134).
 *
 * `server/vertex-deduplication-service.ts` routes its FHIR entity-resolution
 * comparisons through `chatComplete()`. When the AI policy gate blocks the
 * call (or the Vertex provider is unavailable) the service silently falls
 * back to the deterministic rule-based matcher. Operators previously had no
 * signal that AI-quality matching had stopped.
 *
 * These tests inject a fake `chatComplete` via the module's TEST-ONLY seam
 * (`__setChatCompleteImplForTesting`) and assert that:
 *   1. Successful AI comparisons are counted (`aiComparisons`) and reset the
 *      consecutive-failure streak.
 *   2. Policy-blocked / provider-error comparisons increment
 *      `ruleBasedFallbacks` and `consecutiveAiFailures`, and tag the reason.
 *   3. Once the consecutive-failure streak crosses
 *      `aiDegradedAlertThreshold`, `aiMatchingDegraded` flips true (the
 *      log alert fires alongside it).
 *   4. A later AI success clears the degraded flag.
 *
 * Wired into `npm run test:server` via scripts/run-server-tests.mjs and the
 * CI `server-tests` job (see replit.md). Run directly with:
 *   node --import tsx server/__tests__/dedup-ai-degradation.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after } from "node:test";

// VERTEX_AI_AVAILABLE is evaluated at module load from these env vars, so it
// must be set before the service module is imported below.
process.env.GCP_KEY = process.env.GCP_KEY || "test-service-account-key";

import { PolicyBlockedError } from "../ai-client";
import {
  findDuplicateRecords,
  getDeduplicationStats,
  __setChatCompleteImplForTesting,
} from "../vertex-deduplication-service";

// Controls what the injected chatComplete does for the next comparison.
let chatCompleteBehavior: "success" | "policy" | "error" = "success";

before(() => {
  __setChatCompleteImplForTesting((async () => {
    if (chatCompleteBehavior === "policy") {
      throw new PolicyBlockedError("blocked", ["FORBIDDEN_ENV_VAR:AI_INTEGRATIONS_OPENAI_KEY"], null);
    }
    if (chatCompleteBehavior === "error") {
      throw new Error("vertex unavailable");
    }
    return {
      content: '{"isDuplicate":true,"confidence":0.9,"reason":"same code"}',
      json: { isDuplicate: true, confidence: 0.9, reason: "same code" },
      provider: "vertex_ai",
      model: "deep",
    };
  }) as any);
});

after(() => {
  __setChatCompleteImplForTesting(null);
});

const recordA = {
  resourceType: "Observation",
  id: "obs-a",
  code: { coding: [{ system: "http://loinc.org", code: "1234-5", display: "Glucose" }] },
  effectiveDateTime: "2026-01-01T10:00:00Z",
};
const recordB = {
  resourceType: "Observation",
  id: "obs-b",
  code: { coding: [{ system: "http://loinc.org", code: "1234-5", display: "Glucose" }] },
  effectiveDateTime: "2026-01-01T10:00:00Z",
};

test("successful AI comparison increments aiComparisons and keeps streak at zero", async () => {
  chatCompleteBehavior = "success";
  const before = getDeduplicationStats();
  await findDuplicateRecords(recordA, recordB);
  const stats = getDeduplicationStats();
  assert.equal(stats.aiComparisons, before.aiComparisons + 1);
  assert.equal(stats.consecutiveAiFailures, 0);
  assert.equal(stats.aiMatchingDegraded, false);
});

test("policy-blocked comparison records a rule-based fallback with reason", async () => {
  chatCompleteBehavior = "policy";
  const before = getDeduplicationStats();
  await findDuplicateRecords(recordA, recordB);
  const stats = getDeduplicationStats();
  assert.equal(stats.ruleBasedFallbacks, before.ruleBasedFallbacks + 1);
  assert.equal(stats.consecutiveAiFailures, before.consecutiveAiFailures + 1);
  assert.equal(stats.lastAiFailureReason, "policy_blocked");
});

test("provider-error comparison records reason provider_error", async () => {
  chatCompleteBehavior = "error";
  await findDuplicateRecords(recordA, recordB);
  const stats = getDeduplicationStats();
  assert.equal(stats.lastAiFailureReason, "provider_error");
});

test("consecutive failures past the threshold flip aiMatchingDegraded true", async () => {
  chatCompleteBehavior = "error";
  const threshold = getDeduplicationStats().aiDegradedAlertThreshold;
  for (let i = 0; i < threshold + 1; i++) {
    await findDuplicateRecords(recordA, recordB);
  }
  const stats = getDeduplicationStats();
  assert.ok(stats.consecutiveAiFailures >= threshold, "streak should be at/above threshold");
  assert.equal(stats.aiMatchingDegraded, true);
  assert.ok(stats.maxConsecutiveAiFailures >= threshold);
});

test("a later AI success clears the degraded flag and resets the streak", async () => {
  chatCompleteBehavior = "success";
  await findDuplicateRecords(recordA, recordB);
  const stats = getDeduplicationStats();
  assert.equal(stats.consecutiveAiFailures, 0);
  assert.equal(stats.aiMatchingDegraded, false);
});
