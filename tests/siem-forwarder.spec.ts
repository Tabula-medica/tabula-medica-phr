import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildHecEnvelope,
  scrubDetails,
  isDeniedDetailKey,
  forwardSecurityEvent,
  flushSiemQueue,
  isSiemEnabled,
  getSiemStatus,
  setSiemTransportForTest,
  resetSiemForTest,
} from "../server/security/siem-forwarder";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("siem-forwarder — PHI/secret allowlisting", () => {
  it.each([
    "email", "patientEmail", "phone", "ssn", "dateOfBirth", "dob", "mrn", "firstName", "lastName",
    "password", "accessToken", "id_token", "authorization", "cookie", "apiKey", "diagnosis", "medications", "address",
  ])("denies detail key %s", (key) => {
    expect(isDeniedDetailKey(key)).toBe(true);
  });

  it.each(["requestId", "path", "method", "limiter", "ruleIds", "severity", "mode", "statusCode", "reasons"])(
    "allows telemetry key %s",
    (key) => {
      expect(isDeniedDetailKey(key)).toBe(false);
    },
  );

  it("redacts denied keys, collapses nested objects, truncates long strings", () => {
    const out = scrubDetails({
      requestId: "req-1",
      email: "jane@example.com",
      patient: { firstName: "Jane", dob: "1970-01-01" },
      context: { nested: true, firstName: "Jane" },
      note: "x".repeat(500),
      list: [1, "two", { nested: true }],
    });
    expect(out.requestId).toBe("req-1");
    expect(out.email).toBe("[REDACTED]");
    expect(out.patient).toBe("[REDACTED]");
    expect(out.context).toBe("[object]");
    expect(String(out.note).length).toBeLessThan(260);
    expect(String(out.note)).toContain("[truncated]");
    expect(out.list).toEqual([1, "two", "[object]"]);
    expect(JSON.stringify(out)).not.toContain("Jane");
    expect(JSON.stringify(out)).not.toContain("1970-01-01");
  });

  it("envelope only carries allowlisted top-level fields", () => {
    const env = buildHecEnvelope({
      eventType: "auth_rate_limited",
      actor: "user-123",
      riskLevel: "medium",
      timestamp: "2026-09-06T12:00:00.000Z",
      // @ts-expect-error — deliberately smuggling a non-allowlisted field
      patientName: "Jane Doe",
      details: { path: "/api/auth/gcip/session" },
    });
    expect(env.time).toBe(Date.parse("2026-09-06T12:00:00.000Z") / 1000);
    expect(env.sourcetype).toBe("_json");
    expect(env.event.eventType).toBe("auth_rate_limited");
    expect(env.event).not.toHaveProperty("patientName");
    expect(JSON.stringify(env)).not.toContain("Jane Doe");
  });
});

describe("siem-forwarder — transport behaviour", () => {
  beforeEach(() => {
    resetSiemForTest();
  });
  afterEach(() => {
    setSiemTransportForTest(null);
    resetSiemForTest();
    restoreEnv();
  });

  it("is disabled when env is unset and drops events silently", async () => {
    delete process.env.SIEM_HEC_URL;
    delete process.env.SIEM_HEC_TOKEN;
    expect(isSiemEnabled()).toBe(false);
    expect(forwardSecurityEvent({ eventType: "x" })).toBe(false);
    await flushSiemQueue();
    expect(getSiemStatus().queued).toBe(0);
  });

  it("refuses non-https endpoints", () => {
    process.env.SIEM_HEC_URL = "http://collector.example/services/collector/event";
    process.env.SIEM_HEC_TOKEN = "t";
    expect(isSiemEnabled()).toBe(false);
  });

  it("POSTs newline-delimited HEC envelopes with a bearer token", async () => {
    process.env.SIEM_HEC_URL = "https://abc.ingest.us-1.crowdstrike.com/services/collector/event";
    process.env.SIEM_HEC_TOKEN = "hec-token-xyz";
    process.env.SIEM_BATCH_SIZE = "2";

    const calls: Array<{ url: string; token: string; body: string }> = [];
    setSiemTransportForTest(async (url, token, body) => {
      calls.push({ url, token, body });
      return { ok: true, status: 200 };
    });

    forwardSecurityEvent({ eventType: "session_binding_anomaly", actor: "u1", details: { reasons: ["country_changed"], email: "leak@example.com" } });
    forwardSecurityEvent({ eventType: "ai_prompt_injection_detected", actor: "u2", details: { score: 7 } });
    await flushSiemQueue();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("ingest.us-1.crowdstrike.com");
    expect(calls[0].token).toBe("hec-token-xyz");
    const lines = calls[0].body.split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.event.eventType).toBe("session_binding_anomaly");
    expect(first.event.details.email).toBe("[REDACTED]");
    expect(calls[0].body).not.toContain("leak@example.com");
    expect(getSiemStatus().sent).toBe(2);
  });

  it("counts failed batches without throwing", async () => {
    process.env.SIEM_HEC_URL = "https://collector.example/services/collector/event";
    process.env.SIEM_HEC_TOKEN = "t";
    process.env.SIEM_BATCH_SIZE = "1";
    setSiemTransportForTest(async () => ({ ok: false, status: 401 }));
    forwardSecurityEvent({ eventType: "x" });
    await flushSiemQueue();
    const st = getSiemStatus();
    expect(st.failedBatches).toBe(1);
    expect(st.dropped).toBe(1);
  });
});
