/**
 * Regression tests for on-call alerting when AI duplicate-matching degrades
 * (Task #220).
 *
 * Task #134 added a high-severity log line + an authenticated stats field
 * (`aiMatchingDegraded`) when Vertex AI entity-resolution falls back to the
 * rule-based matcher for too many consecutive comparisons, but nobody was
 * actively paged. This wires the degrade/recovery transitions in
 * `server/vertex-deduplication-service.ts` into `sendOpsAlert()`
 * (`server/utils/ops-alert.ts`), which posts to the team's existing Slack
 * webhook (`SLACK_WEBHOOK_URL`).
 *
 * These tests:
 *   1. Assert the ops-alert helper is a safe no-op (`skipped`) with no webhook
 *      and delivers (`sent`) / fails (`failed`) correctly via an injected fetch.
 *   2. Drive the dedup service across the degraded threshold and assert a
 *      single `critical` "DEGRADED" alert fires, then a `resolved` "RECOVERED"
 *      alert fires when AI matching recovers.
 *
 * Run directly with:
 *   node --import tsx server/__tests__/dedup-ai-degradation-alert.test.ts
 */
import assert from "node:assert/strict";
import { test, before, after, beforeEach } from "node:test";

// VERTEX_AI_AVAILABLE is evaluated at module load from these env vars, so it
// must be set before the service module is imported below.
process.env.GCP_KEY = process.env.GCP_KEY || "test-service-account-key";
// Ensure the helper has a webhook to deliver to (value unused — fetch is stubbed).
process.env.SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "https://hooks.slack.test/services/T/B/X";

import { PolicyBlockedError } from "../ai-client";
import {
  findDuplicateRecords,
  getDeduplicationStats,
  __setChatCompleteImplForTesting,
} from "../vertex-deduplication-service";
import {
  sendOpsAlert,
  __setOpsAlertFetchImplForTesting,
  type OpsAlert,
} from "../utils/ops-alert";

// Captures every alert payload routed through the injected fetch.
const capturedAlerts: OpsAlert[] = [];
let fetchOk = true;

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

  __setOpsAlertFetchImplForTesting(async (_url, init: any) => {
    const body = JSON.parse(init.body);
    // Reconstruct a minimal OpsAlert-shaped record from the Slack payload so
    // tests can assert on title/severity without coupling to block layout.
    capturedAlerts.push({
      title: body.blocks?.[0]?.text?.text ?? "",
      detail: body.blocks?.[1]?.text?.text ?? "",
      severity: body.icon_emoji === ":rotating_light:" ? "critical"
        : body.icon_emoji === ":white_check_mark:" ? "resolved"
        : body.icon_emoji === ":warning:" ? "warning" : "info",
    });
    return { ok: fetchOk, status: fetchOk ? 200 : 500 };
  });
});

after(() => {
  __setChatCompleteImplForTesting(null);
  __setOpsAlertFetchImplForTesting(null);
});

beforeEach(() => {
  capturedAlerts.length = 0;
  fetchOk = true;
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

test("sendOpsAlert is a no-op (skipped) when no webhook is configured", async () => {
  const original = process.env.SLACK_WEBHOOK_URL;
  delete process.env.SLACK_WEBHOOK_URL;
  try {
    const result = await sendOpsAlert({ title: "t", detail: "d", severity: "info" });
    assert.equal(result, "skipped");
    assert.equal(capturedAlerts.length, 0, "no delivery attempted without a webhook");
  } finally {
    process.env.SLACK_WEBHOOK_URL = original;
  }
});

test("sendOpsAlert delivers (sent) when the webhook accepts the message", async () => {
  fetchOk = true;
  const result = await sendOpsAlert({ title: "ping", detail: "d", severity: "warning" });
  assert.equal(result, "sent");
  assert.equal(capturedAlerts.length, 1);
  assert.equal(capturedAlerts[0].title, "ping");
});

test("sendOpsAlert returns failed (never throws) on a non-2xx webhook response", async () => {
  fetchOk = false;
  const result = await sendOpsAlert({ title: "ping", detail: "d", severity: "critical" });
  assert.equal(result, "failed");
});

test("crossing the degraded threshold fires a single critical DEGRADED alert", async () => {
  // Recover first so the streak/flag are reset regardless of prior tests.
  chatCompleteBehavior = "success";
  await findDuplicateRecords(recordA, recordB);
  capturedAlerts.length = 0;

  chatCompleteBehavior = "error";
  const threshold = getDeduplicationStats().aiDegradedAlertThreshold;
  for (let i = 0; i < threshold + 2; i++) {
    await findDuplicateRecords(recordA, recordB);
  }

  assert.equal(getDeduplicationStats().aiMatchingDegraded, true);
  const degraded = capturedAlerts.filter((a) => a.severity === "critical");
  assert.equal(degraded.length, 1, "exactly one DEGRADED alert despite continued failures");
  assert.match(degraded[0].title, /DEGRADED/);
});

test("recovery after a degraded state fires a resolved RECOVERED alert", async () => {
  // Ensure we are currently degraded.
  chatCompleteBehavior = "error";
  const threshold = getDeduplicationStats().aiDegradedAlertThreshold;
  for (let i = 0; i < threshold + 1; i++) {
    await findDuplicateRecords(recordA, recordB);
  }
  assert.equal(getDeduplicationStats().aiMatchingDegraded, true);
  capturedAlerts.length = 0;

  chatCompleteBehavior = "success";
  await findDuplicateRecords(recordA, recordB);

  assert.equal(getDeduplicationStats().aiMatchingDegraded, false);
  const resolved = capturedAlerts.filter((a) => a.severity === "resolved");
  assert.equal(resolved.length, 1, "exactly one RECOVERED alert on recovery");
  assert.match(resolved[0].title, /RECOVERED/);
});

test("degraded reminders repeat every 30 minutes without traffic and reset after recovery", async (t) => {
  chatCompleteBehavior = "success";
  await findDuplicateRecords(recordA, recordB);
  capturedAlerts.length = 0;
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: new Date("2026-01-01T00:00:00Z") });
  const interval = 30 * 60 * 1000;
  const degrade = async () => {
    chatCompleteBehavior = "error";
    for (let i = 0; i < getDeduplicationStats().aiDegradedAlertThreshold; i++) {
      await findDuplicateRecords(recordA, recordB);
    }
  };
  try {
    await degrade();
    assert.equal(capturedAlerts.length, 1);
    t.mock.timers.tick(interval - 1);
    assert.equal(capturedAlerts.length, 1, "no early reminder");
    // Extra failures must not create more timers or restart the cadence.
    await findDuplicateRecords(recordA, recordB);
    t.mock.timers.tick(1);
    assert.equal(capturedAlerts.length, 2);
    assert.match(capturedAlerts[1].title, /STILL DEGRADED/);
    assert.equal(capturedAlerts[1].severity, "critical");
    assert.match(capturedAlerts[1].detail, /0\.5h \(30 minutes\)/);

    // No additional comparisons are needed for the next reminder.
    t.mock.timers.tick(interval);
    assert.equal(capturedAlerts.length, 3);
    assert.match(capturedAlerts[2].detail, /1\.0h \(60 minutes\)/);
    chatCompleteBehavior = "success";
    await findDuplicateRecords(recordA, recordB);
    assert.equal(capturedAlerts.length, 4);
    assert.match(capturedAlerts[3].title, /RECOVERED/);
    t.mock.timers.tick(2 * interval);
    assert.equal(capturedAlerts.length, 4, "recovery cancels reminders");

    await degrade();
    assert.equal(capturedAlerts.length, 5, "a new incident pages immediately");
    t.mock.timers.tick(interval);
    assert.equal(capturedAlerts.length, 6, "only one timer for the new incident");
    assert.match(capturedAlerts[5].detail, /0\.5h \(30 minutes\)/);
  } finally {
    chatCompleteBehavior = "success";
    await findDuplicateRecords(recordA, recordB);
    t.mock.timers.reset();
  }
});

test("failed reminder delivery stays bounded to the 30-minute cadence", async (t) => {
  chatCompleteBehavior = "success";
  await findDuplicateRecords(recordA, recordB);
  capturedAlerts.length = 0;
  t.mock.timers.enable({ apis: ["setInterval", "Date"], now: new Date("2026-01-01T00:00:00Z") });
  const interval = 30 * 60 * 1000;
  try {
    fetchOk = false;
    chatCompleteBehavior = "policy";
    for (let i = 0; i < getDeduplicationStats().aiDegradedAlertThreshold; i++) {
      await findDuplicateRecords(recordA, recordB);
    }
    t.mock.timers.tick(interval);
    assert.equal(capturedAlerts.length, 2);
    t.mock.timers.tick(interval - 1);
    assert.equal(capturedAlerts.length, 2, "delivery failures do not cause rapid retries");
    t.mock.timers.tick(1);
    assert.equal(capturedAlerts.length, 3);
    assert.match(capturedAlerts[2].title, /STILL DEGRADED/);
  } finally {
    chatCompleteBehavior = "success";
    await findDuplicateRecords(recordA, recordB);
    t.mock.timers.reset();
  }
});
