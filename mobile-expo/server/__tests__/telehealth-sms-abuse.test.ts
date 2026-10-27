/**
 * Regression tests for Task #141 — Telehealth and SMS Abuse hardening.
 *
 * These tests guard three previously-vulnerable surface areas:
 *
 *   1. SMS / Twilio relay endpoints — all must require authentication.
 *      An unauthenticated caller must receive 401, not 200/500, proving
 *      Twilio is never reached without a valid session.
 *
 *   2. Telehealth visit endpoints — all visit-specific routes must require
 *      authentication.  Unauthenticated probes must receive 401.
 *
 *   3. Telehealth reminder endpoints — ownership is enforced server-side:
 *      (a) Unauthenticated callers → 401.
 *      (b) An authenticated user who does NOT own the visit → 403.
 *      The 403 case directly exercises the assertVisitOwner() guard added in
 *      this task for GET /reminders and POST /reminders/schedule.
 *
 * Wire-up mirrors `routes-split.test.ts` — framework-agnostic, runs via
 *   `node --import tsx server/__tests__/telehealth-sms-abuse.test.ts`
 * and is automatically picked up by `npm run test:server`.
 */

import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { createHash } from "node:crypto";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { db } from "../db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failures: string[] = [];
function assertStatus(
  actual: number,
  expected: number[],
  label: string,
) {
  if (!expected.includes(actual)) {
    failures.push(
      `${label}: expected status in [${expected.join(", ")}], got ${actual}`,
    );
  }
}

type Probe = {
  method: "get" | "post" | "patch" | "delete";
  path: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

async function httpProbe(
  baseUrl: string,
  p: Probe,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const url = baseUrl + p.path;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(p.headers ?? {}),
    ...(extraHeaders ?? {}),
  };
  const init: RequestInit = {
    method: p.method.toUpperCase(),
    headers,
  };
  if (p.method !== "get" && p.method !== "delete") {
    init.body = JSON.stringify(p.body ?? {});
  }
  const res = await fetch(url, init);
  let body: any;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// App setup — one shared server for all probes
// ---------------------------------------------------------------------------

let app: Express;
let server: Server;
let baseUrl: string;

async function setup() {
  app = express();
  await registerRoutes(app);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ sentinel: true });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
}

async function teardown() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// 1. SMS endpoints — must require authentication (401 without a token)
// ---------------------------------------------------------------------------

const SMS_PROBES: Probe[] = [
  { method: "get",  path: "/api/sms/log" },
  { method: "post", path: "/api/sms/log",                         body: { recipientPhone: "+15550001111", messagePreview: "test" } },
  { method: "post", path: "/api/sms/send",                        body: { to: "+15550001111", message: "spam" } },
  { method: "post", path: "/api/sms/verification/send",           body: { phone: "+15550001111" } },
  { method: "post", path: "/api/sms/verification/verify",         body: { code: "123456" } },
  { method: "post", path: "/api/sms/medication-reminder/send",    body: { medicationName: "Ibuprofen" } },
  { method: "post", path: "/api/sms/medication-reminder/test",    body: { phone: "+15550001111" } },
  { method: "get",  path: "/api/sms/reminder-status" },
];

async function testSmsEndpointsRequireAuth() {
  for (const p of SMS_PROBES) {
    const { status } = await httpProbe(baseUrl, p);
    assertStatus(
      status,
      [401],
      `Unauthenticated ${p.method.toUpperCase()} ${p.path}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Telehealth visit endpoints — must require authentication
// ---------------------------------------------------------------------------

const FAKE_VISIT_ID = "00000000-0000-0000-0000-000000000001";

const TELEHEALTH_VISIT_PROBES: Probe[] = [
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}` },
  { method: "patch", path: `/api/telehealth/visits/${FAKE_VISIT_ID}/status`,          body: { status: "completed" } },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/consent`,         body: { consent: true } },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/document`,        body: { documentType: "note", content: "test" } },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/ai-summary`,      body: {} },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/rate`,            body: { rating: 5 } },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/cancel`,          body: {} },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/reschedule`,      body: { scheduledAt: new Date().toISOString() } },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/transcription`,   body: { audioUrl: "gs://bucket/file.webm" } },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/transcription` },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/apply-ai-notes`,  body: {} },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/security-log` },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/chat` },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/chat`,            body: { message: "hello" } },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/shared-documents` },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/shared-documents`, body: { title: "doc", documentType: "image" } },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/recording` },
  { method: "get",   path: `/api/telehealth/visits/${FAKE_VISIT_ID}/reminders` },
  { method: "post",  path: `/api/telehealth/visits/${FAKE_VISIT_ID}/reminders/schedule`, body: {} },
];

async function testTelehealthVisitEndpointsRequireAuth() {
  for (const p of TELEHEALTH_VISIT_PROBES) {
    const { status } = await httpProbe(baseUrl, p);
    assertStatus(
      status,
      [401],
      `Unauthenticated ${p.method.toUpperCase()} ${p.path}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Reminder ownership enforcement
//
//    (a) Forged x-user-id header without a bearer token → 401.
//        Confirms the header alone never bypasses the auth gate.
//
//    (b) Valid authenticated session for "user-A" but visit is owned by
//        "user-B" → 403.  This is the direct regression test for the
//        assertVisitOwner() guard added in this task.
//
//    For (b) we monkey-patch three singletons for the duration of the test:
//      - storage.getUserSessionByAccessToken  → returns a real session for user-A
//      - storage.updateUserSessionActivity    → no-op (fire-and-forget call)
//      - telehealthService.getVisitById       → returns a visit owned by user-B
//    We also stub db.select so the session-provider inference step (which
//    queries external_identities) returns an empty row set, causing
//    requireAuth to tag the session as "session" provider — no GCIP JWT needed.
// ---------------------------------------------------------------------------

const OWNERSHIP_VISIT_ID = "00000000-0000-0000-0000-000000000099";
const USER_A_RAW_TOKEN   = "a1b2c3d4e5f6".repeat(8).slice(0, 64); // 64-char hex, no dots
const USER_A_TOKEN_HASH  = createHash("sha256").update(USER_A_RAW_TOKEN).digest("hex");

async function testReminderUnauthenticated() {
  const probes: Probe[] = [
    { method: "get",  path: `/api/telehealth/visits/${OWNERSHIP_VISIT_ID}/reminders`,           headers: { "x-user-id": "attacker-id" } },
    { method: "post", path: `/api/telehealth/visits/${OWNERSHIP_VISIT_ID}/reminders/schedule`,  headers: { "x-user-id": "attacker-id" } },
  ];
  for (const p of probes) {
    const { status } = await httpProbe(baseUrl, p);
    assertStatus(
      status,
      [401],
      `Forged x-user-id with no token ${p.method.toUpperCase()} ${p.path}`,
    );
  }
}

async function testReminderAuthenticatedNonOwnerGets403() {
  // Stub strategy:
  //   - storage.getUserSessionByAccessToken → return a valid session for user-A.
  //     This must be patched directly; storage.getUserSessionByAccessToken calls
  //     db.select internally, so we cannot stub db.select globally without also
  //     breaking the session lookup.
  //   - telehealthService.getVisitById → return a visit owned by user-B.
  //     This is the function assertVisitOwner() calls after auth passes.
  //   - inferSessionProvider (inside requireAuth) calls db.select for
  //     external_identities but catches all errors and returns "session" as the
  //     default; we leave the real db.select in place and rely on that fallback.

  const origGetSession     = (storage as any).getUserSessionByAccessToken;
  const origUpdateActivity = (storage as any).updateUserSessionActivity;

  (storage as any).getUserSessionByAccessToken = async (hash: string) => {
    if (hash === USER_A_TOKEN_HASH) {
      return {
        id: "sess-test-ownership",
        userId: "user-A",
        accessToken: USER_A_TOKEN_HASH,
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
        isActive: true,
      };
    }
    return null;
  };

  // fire-and-forget activity update — allow it to fail gracefully against the
  // real DB (no matching session row); requireAuth calls it with .catch() so
  // any error is swallowed.  Stub to a no-op anyway for cleanliness.
  (storage as any).updateUserSessionActivity = async () => {};

  // Patch telehealthService.getVisitById so assertVisitOwner sees a visit
  // owned by user-B.  assertVisitOwner uses a dynamic import so it picks up
  // the same cached module singleton we patch here.
  const mod = await import("../telehealth-service");
  const telehealthService = mod.telehealthService;
  const origGetVisitById = telehealthService.getVisitById.bind(telehealthService);
  telehealthService.getVisitById = async (visitId: string) => {
    if (visitId === OWNERSHIP_VISIT_ID) {
      return { id: OWNERSHIP_VISIT_ID, patientId: "user-B" };
    }
    return null;
  };

  const authHeader = `Bearer ${USER_A_RAW_TOKEN}`;
  try {
    // GET reminders — user-A authenticated, visit owned by user-B → must be 403.
    const r1 = await httpProbe(
      baseUrl,
      { method: "get", path: `/api/telehealth/visits/${OWNERSHIP_VISIT_ID}/reminders` },
      { authorization: authHeader },
    );
    assertStatus(r1.status, [403], "Authenticated non-owner GET /reminders");

    // POST reminders/schedule — same expectation.
    const r2 = await httpProbe(
      baseUrl,
      { method: "post", path: `/api/telehealth/visits/${OWNERSHIP_VISIT_ID}/reminders/schedule`, body: {} },
      { authorization: authHeader },
    );
    assertStatus(r2.status, [403], "Authenticated non-owner POST /reminders/schedule");
  } finally {
    (storage as any).getUserSessionByAccessToken = origGetSession;
    (storage as any).updateUserSessionActivity   = origUpdateActivity;
    telehealthService.getVisitById               = origGetVisitById;
  }
}

// ---------------------------------------------------------------------------
// 4. Chat and shared-document POST must use session identity, not x-user-id
// ---------------------------------------------------------------------------

async function testTelehealthChatAndDocsSpoofingPrevented() {
  const probes: Probe[] = [
    {
      method: "post",
      path: `/api/telehealth/visits/${FAKE_VISIT_ID}/chat`,
      body: { message: "forged provider message", senderRole: "provider" },
      headers: { "x-user-id": "attacker-id" },
    },
    {
      method: "post",
      path: `/api/telehealth/visits/${FAKE_VISIT_ID}/shared-documents`,
      body: { title: "fake doc", sharedByRole: "provider" },
      headers: { "x-user-id": "attacker-id" },
    },
  ];
  for (const p of probes) {
    const { status } = await httpProbe(baseUrl, p);
    assertStatus(
      status,
      [401],
      `Spoofed identity without token ${p.method.toUpperCase()} ${p.path}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type TestFn = () => Promise<void>;
const TESTS: Array<[string, TestFn]> = [
  [
    "SMS endpoints — all return 401 to unauthenticated callers (no Twilio relay possible)",
    testSmsEndpointsRequireAuth,
  ],
  [
    "Telehealth visit endpoints — all return 401 to unauthenticated callers",
    testTelehealthVisitEndpointsRequireAuth,
  ],
  [
    "Reminder endpoints — no bearer token returns 401 even with forged x-user-id",
    testReminderUnauthenticated,
  ],
  [
    "Reminder endpoints — authenticated non-owner returns 403 (ownership enforcement)",
    testReminderAuthenticatedNonOwnerGets403,
  ],
  [
    "Chat and shared-document POST — spoofed x-user-id + role without token returns 401",
    testTelehealthChatAndDocsSpoofingPrevented,
  ],
];

export async function checkTelehealthSmsAbuse(): Promise<{ ok: boolean; pass: number; fail: number }> {
  await setup();
  let pass = 0;
  let fail = 0;
  try {
    for (const [name, fn] of TESTS) {
      const before = failures.length;
      try {
        await fn();
        const added = failures.slice(before);
        if (added.length === 0) {
          console.log(`  ok    ${name}`);
          pass += 1;
        } else {
          console.log(`  FAIL  ${name}`);
          for (const m of added) console.log(`         - ${m}`);
          fail += 1;
        }
      } catch (e: any) {
        console.log(`  FAIL  ${name} — threw: ${e?.message ?? e}`);
        if (e?.stack) console.log(e.stack);
        fail += 1;
      }
    }
  } finally {
    await teardown();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return { ok: fail === 0, pass, fail };
}

if (require.main === module) {
  checkTelehealthSmsAbuse()
    .then(({ ok }) => {
      process.exit(ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
