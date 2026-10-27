/**
 * Exercise the real routes, auth middleware, and onboarding service over HTTP.
 * Only persistence/auth lookups are replaced; no real database writes or
 * outbound FHIR requests are needed. The server runner discovers this file.
 *
 * The original test plan predates the current contract: there is no
 * `fhir_endpoint` step, radiology's fhir_test is required, and webhook HMAC
 * keys are encrypted (not hashed, since verification needs the original key).
 */
import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { storage } from "../storage";
import { decryptPHI } from "../compliance/encryption-service";
import { registerProviderOnboardingRoutes } from "../routes/provider-onboarding-routes";
import type {
  OnboardingStepId,
  ProviderOnboardingSession,
  ProviderPersona,
} from "../provider-onboarding-service";

const token = "provider-onboarding-test-token-not-a-real-credential";
const userId = "onboarding-test-user";
const prefix = "/api/onboarding/provider";
const dialect = new PgDialect();
const rows = new Map<string, Record<string, unknown>>();
const writes: Array<{ sql: string; params: unknown[] }> = [];
let server: Server;
let base: string;

// Independent expectations: deriving these from getPersonaStepDefs would hide
// accidental removal of required steps or accidental changes to optionality.
const personas: Record<ProviderPersona, {
  steps: OnboardingStepId[];
  optional: OnboardingStepId[];
}> = {
  provider: {
    steps: ["org_info", "ehr_selection", "fhir_test", "team_invites", "golive_checklist"],
    optional: ["fhir_test", "team_invites"],
  },
  lab: {
    steps: ["org_info", "result_delivery", "webhook_provision", "test_result_send"],
    optional: [],
  },
  radiology: {
    steps: ["org_info", "dicom_endpoint", "fhir_test"],
    optional: [],
  },
  hospital: {
    steps: ["org_info", "bulk_fhir_consent", "tefca_participation", "baa_upload"],
    optional: [],
  },
  dpc: {
    steps: ["org_info", "panel_size", "patient_import", "revenuecat_link"],
    optional: ["patient_import"],
  },
};

before(async () => {
  // Use the shared Drizzle singleton seam, not module mocking (tsx runs CJS).
  // Fail on unexpected SQL rather than falling back to a real database.
  mock.method(db, "execute", async (statement: Parameters<typeof dialect.sqlToQuery>[0]) => {
    const query = dialect.sqlToQuery(statement);
    const { sql, params: p } = query;
    if (sql.includes("INSERT INTO provider_onboarding_sessions")) {
      writes.push(query);
      const prior = rows.get(p[0] as string);
      rows.set(p[0] as string, {
        id: p[0], user_id: p[1], persona: p[2], org_name: p[3],
        contact_email: p[4], npi_number: p[5], taxonomy_code: p[6],
        steps_json: JSON.parse(p[7] as string), overall_status: p[8],
        fhir_base_url: p[9], fhir_test_result: p[10],
        webhook_endpoint_url: p[11],
        webhook_secret_enc: prior?.webhook_secret_enc ?? p[12],
        created_at: new Date(p[13] as string),
        updated_at: new Date(p[14] as string),
      });
      return { rows: [] };
    }
    if (sql.includes("UPDATE provider_onboarding_sessions")) {
      writes.push(query);
      const row = rows.get(p[3] as string);
      assert.ok(row, "webhook update must target a persisted session");
      assert.equal(row.user_id, p[4]);
      row.webhook_endpoint_url = p[0];
      row.webhook_secret_enc = p[1];
      row.updated_at = new Date(p[2] as string);
      return { rows: [] };
    }
    if (sql.includes("SELECT * FROM provider_onboarding_sessions WHERE id =")) {
      const row = rows.get(p[0] as string);
      // Independent row objects force the service to persist mutations.
      return { rows: row ? [structuredClone(row)] : [] };
    }
    throw new Error(`Unexpected onboarding SQL: ${sql}`);
  });
  mock.method(storage, "getUserSessionByAccessToken", async (hash: string) => {
    assert.equal(hash, createHash("sha256").update(token).digest("hex"));
    return {
      id: "onboarding-test-auth-session", userId, isActive: true,
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
    };
  });
  mock.method(storage, "updateUserSessionActivity", async () => undefined);
  // requireAuth's best-effort identity-provider lookup needs no real SQL.
  mock.method(db, "select", () => ({
    from: () => ({ where: async () => [] }),
  }));

  const app = express();
  app.use(express.json());
  registerProviderOnboardingRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
  mock.restoreAll();
});

async function request(path: string, body?: Record<string, unknown>, authenticated = true) {
  const response = await fetch(`${base}${prefix}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function start(persona: ProviderPersona): Promise<ProviderOnboardingSession> {
  const result = await request("/start", {
    persona, orgName: "  Test Organization  ", contactEmail: " CONTACT@EXAMPLE.TEST ",
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.session.orgName, "Test Organization");
  assert.equal(result.body.session.contactEmail, "contact@example.test");
  assert.equal(result.body.session.userId, userId);
  assert.deepEqual(result.body.session.steps.map((step: { stepId: string }) => step.stepId),
    personas[persona].steps);
  assert.deepEqual(result.body.session.steps.map((step: { status: string }) => step.status),
    personas[persona].steps.map((_, index) => index === 0 ? "in_progress" : "pending"));
  return result.body.session;
}

test("start rejects each missing or invalid required field with 400", async (t) => {
  const valid = { persona: "provider", orgName: "Test Org", contactEmail: "contact@example.test" };
  const cases = [
    { persona: undefined }, { persona: "unknown" },
    { orgName: undefined }, { orgName: " " }, { orgName: 42 },
    { contactEmail: undefined }, { contactEmail: "not-an-email" }, { contactEmail: 42 },
  ];
  for (const invalid of cases) {
    await t.test(JSON.stringify(invalid) + Object.keys(invalid)[0], async () => {
      const count = writes.length;
      const result = await request("/start", { ...valid, ...invalid });
      assert.equal(result.status, 400);
      assert.match(result.body.error, new RegExp(Object.keys(invalid)[0]));
      assert.equal(writes.length, count, "validation failure must not create a session");
    });
  }
});

for (const persona of Object.keys(personas) as ProviderPersona[]) {
  test(`${persona}: each step advances, persists, and completed sessions return 409`, async () => {
    const session = await start(persona);
    const steps = personas[persona].steps;
    for (const [index, stepId] of steps.entries()) {
      const data = { testValue: `${persona}-${stepId}` };
      const result = await request("/step", { sessionId: session.sessionId, stepId, data });
      assert.equal(result.status, 200);
      const updated: ProviderOnboardingSession = result.body.session;
      assert.deepEqual(updated.steps.slice(0, index + 1).map((step) => step.status),
        Array(index + 1).fill("completed"));
      assert.deepEqual(updated.steps[index].data, data);
      assert.ok(Number.isFinite(Date.parse(updated.steps[index].completedAt!)));
      assert.equal(updated.overallStatus, index === steps.length - 1 ? "completed" : "in_progress");
      if (index < steps.length - 1) {
        assert.equal(updated.steps[index + 1].status, "in_progress");
      }
      const saved = await request(`/status/${session.sessionId}`);
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.body.session, updated);
    }
    const before = structuredClone(rows.get(session.sessionId));
    for (const skip of [false, true]) {
      const result = await request("/step", {
        sessionId: session.sessionId, stepId: steps[0], skip,
      });
      assert.equal(result.status, 409);
      assert.match(result.body.error, /already completed/);
      assert.deepEqual(rows.get(session.sessionId), before);
    }
  });

  test(`${persona}: only explicitly optional steps can be skipped`, async () => {
    const session = await start(persona);
    for (const stepId of personas[persona].steps) {
      const before = structuredClone(rows.get(session.sessionId));
      const result = await request("/step", { sessionId: session.sessionId, stepId, skip: true });
      if (personas[persona].optional.includes(stepId)) {
        assert.equal(result.status, 200);
        assert.equal(result.body.session.steps.find(
          (step: { stepId: string }) => step.stepId === stepId).status, "skipped");
        const saved = await request(`/status/${session.sessionId}`);
        assert.deepEqual(saved.body.session, result.body.session);
      } else {
        assert.equal(result.status, 400);
        assert.match(result.body.error, /required.*cannot be skipped/);
        assert.deepEqual(rows.get(session.sessionId), before);
      }
    }
    // No persona may bypass the guard by naming a nonexistent shared step.
    const unknown = await request("/step", {
      sessionId: session.sessionId, stepId: "fhir_endpoint", skip: true,
    });
    assert.equal(unknown.status, 400);
    assert.match(unknown.body.error, /not valid for persona/);
  });
}

test("webhook secret is 64-char hex, encrypted at rest, and returned only once", async () => {
  const session = await start("lab");
  const first = await request("/provision-webhook", { sessionId: session.sessionId });
  assert.equal(first.status, 200);
  const provision = first.body.provision;
  assert.match(provision.secretPlaintext, /^[0-9a-f]{64}$/);
  assert.equal(provision.algorithm, "hmac-sha256");
  assert.equal(provision.headerName, "X-Tabula-Signature");
  assert.ok(provision.endpointUrl.endsWith(`/webhooks/provider/${session.sessionId}`));
  const stored = rows.get(session.sessionId)!;
  assert.match(stored.webhook_secret_enc as string, /^enc:/);
  assert.equal(decryptPHI(stored.webhook_secret_enc as string), provision.secretPlaintext);
  assert.ok(!JSON.stringify(stored).includes(provision.secretPlaintext));
  assert.ok(!JSON.stringify(writes).includes(provision.secretPlaintext));
  const status = await request(`/status/${session.sessionId}`);
  assert.ok(!JSON.stringify(status.body).includes(provision.secretPlaintext));
  assert.ok(!JSON.stringify(status.body).includes(stored.webhook_secret_enc as string));

  const writeCount = writes.length;
  const repeat = await request("/provision-webhook", { sessionId: session.sessionId });
  assert.equal(repeat.status, 200);
  assert.deepEqual(repeat.body.provision, {
    endpointUrl: provision.endpointUrl, secretPlaintext: "",
    algorithm: "hmac-sha256", headerName: "X-Tabula-Signature", alreadyProvisioned: true,
  });
  assert.equal(writes.length, writeCount, "repeat provisioning must not rotate the secret");
});

test("metrics rejects unauthenticated requests, including a spoofed user header", async () => {
  const result = await request("/metrics", undefined, false);
  assert.equal(result.status, 401);
  assert.equal(result.body.error, "Unauthorized");
  const spoofed = await fetch(`${base}${prefix}/metrics`, {
    headers: { "x-user-id": userId },
  });
  assert.equal(spoofed.status, 401);
});

test("FHIR ping records an SSRF-safe failure without completing the connection step", async () => {
  const session = await start("provider");
  const result = await request("/test-fhir", {
    sessionId: session.sessionId, fhirBaseUrl: "http://127.0.0.1/private-fhir",
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.result.ok, false);
  assert.match(result.body.result.error, /disallowed|private|https/i);
  assert.ok(Number.isFinite(Date.parse(result.body.result.testedAt)));
  const saved = await request(`/status/${session.sessionId}`);
  assert.deepEqual(saved.body.session.fhirTestResult, result.body.result);
  assert.equal(saved.body.session.fhirBaseUrl, "http://127.0.0.1/private-fhir");
  assert.deepEqual(saved.body.session.steps, session.steps);
});
