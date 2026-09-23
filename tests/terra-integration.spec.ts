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
});
