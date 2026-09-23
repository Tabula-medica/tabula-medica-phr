import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { verifyTerraWebhookSignature, mapTerraPayloadToReadings } from "../server/services/terra-integration-service";

const SIGNING_SECRET = "test-signing-secret";

function signPayload(body: string, timestamp: string, secret = SIGNING_SECRET): string {
  const hmac = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

describe("verifyTerraWebhookSignature", () => {
  const originalSecret = process.env.TERRA_SIGNING_SECRET;

  beforeEach(() => {
    process.env.TERRA_SIGNING_SECRET = SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.TERRA_SIGNING_SECRET = originalSecret;
  });

  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(body, timestamp);

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(body, timestamp);

    const tamperedBody = JSON.stringify({ type: "activity", user: { user_id: "attacker" }, data: [] });
    expect(verifyTerraWebhookSignature(Buffer.from(tamperedBody), signature)).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(body, timestamp, "wrong-secret");

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    expect(verifyTerraWebhookSignature(Buffer.from(body), undefined)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    expect(verifyTerraWebhookSignature(Buffer.from(body), "not-a-valid-header")).toBe(false);
  });

  it("fails closed when TERRA_SIGNING_SECRET is not configured", () => {
    delete process.env.TERRA_SIGNING_SECRET;
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(body, timestamp);

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature)).toBe(false);
  });

  it("rejects a stale timestamp even with a valid signature (replay protection)", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const nowMs = Date.now();
    const staleTimestamp = Math.floor((nowMs - 10 * 60 * 1000) / 1000).toString(); // 10 minutes old
    const signature = signPayload(body, staleTimestamp);

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature, nowMs)).toBe(false);
  });

  it("accepts a timestamp within the tolerance window", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const nowMs = Date.now();
    const recentTimestamp = Math.floor((nowMs - 60 * 1000) / 1000).toString(); // 1 minute old
    const signature = signPayload(body, recentTimestamp);

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature, nowMs)).toBe(true);
  });

  it("rejects a non-numeric timestamp", () => {
    const body = JSON.stringify({ type: "activity", user: { user_id: "abc" }, data: [] });
    const signature = signPayload(body, "not-a-number");

    expect(verifyTerraWebhookSignature(Buffer.from(body), signature)).toBe(false);
  });
});

describe("mapTerraPayloadToReadings", () => {
  it("maps a daily payload's steps to a wellness reading, not a clinical vital", () => {
    const { clinical, wellness } = mapTerraPayloadToReadings("daily", {
      metadata: { start_time: "2026-09-20T00:00:00Z", end_time: "2026-09-20T23:59:59Z" },
      distance_data: { summary: { steps: 8342 } },
    });

    expect(wellness).toContainEqual(expect.objectContaining({ metricType: "steps", value: 8342, unit: "steps" }));
    expect(clinical).toHaveLength(0);
  });

  it("maps a daily payload's resting heart rate to a clinical vital", () => {
    const { clinical } = mapTerraPayloadToReadings("daily", {
      metadata: { start_time: "2026-09-20T00:00:00Z" },
      heart_rate_data: { summary: { resting_hr_bpm: 58 } },
    });

    expect(clinical).toContainEqual(expect.objectContaining({ vitalType: "heart_rate", value: 58, unit: "bpm" }));
  });

  it("converts body payload weight from kg to lbs for the clinical vital", () => {
    const { clinical } = mapTerraPayloadToReadings("body", {
      metadata: { start_time: "2026-09-20T00:00:00Z" },
      body_data: { weight_kg: 70 },
    });

    const weightReading = clinical.find((r) => r.vitalType === "weight");
    expect(weightReading).toBeDefined();
    expect(weightReading!.value).toBeCloseTo(154.32, 1);
    expect(weightReading!.unit).toBe("lbs");
  });

  it("returns no readings for an entry with no recognized fields", () => {
    const { clinical, wellness } = mapTerraPayloadToReadings("nutrition", { metadata: {} });
    expect(clinical).toHaveLength(0);
    expect(wellness).toHaveLength(0);
  });

  it("routes avg_hr_bpm to wellness, not the clinical resting-heart-rate path", () => {
    const { clinical, wellness } = mapTerraPayloadToReadings("daily", {
      metadata: { start_time: "2026-09-20T00:00:00Z" },
      heart_rate_data: { summary: { avg_hr_bpm: 145, resting_hr_bpm: 58 } },
    });

    // avg_hr_bpm spans active periods — a normal workout average must
    // never reach the clinical resting-HR threshold check.
    expect(wellness).toContainEqual(expect.objectContaining({ metricType: "avg_heart_rate", value: 145, unit: "bpm" }));
    expect(clinical.filter((r) => r.vitalType === "heart_rate")).toHaveLength(1);
    expect(clinical).toContainEqual(expect.objectContaining({ vitalType: "heart_rate", value: 58, unit: "bpm" }));
  });

  it("maps an activity payload's start/end time to a workout wellness reading", () => {
    const { wellness } = mapTerraPayloadToReadings("activity", {
      metadata: { start_time: "2026-09-20T07:00:00Z", end_time: "2026-09-20T07:45:00Z" },
    });

    expect(wellness).toContainEqual(expect.objectContaining({ metricType: "workout", value: 45, unit: "minutes" }));
  });

  it("does not produce a workout reading when start/end times are missing", () => {
    const { wellness } = mapTerraPayloadToReadings("activity", {
      metadata: {},
    });

    expect(wellness.find((r) => r.metricType === "workout")).toBeUndefined();
  });
});
