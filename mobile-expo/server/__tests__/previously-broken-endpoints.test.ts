/**
 * End-to-end smoke tests for the endpoints/symbols that were previously
 * ambient `any` stubs (Task #120 replaced them with real implementations).
 *
 * Before that fix the following would have thrown a ReferenceError at
 * runtime (or silently no-op'd) because the symbols they referenced did
 * not exist. There was no automated coverage proving they now work. This
 * file exercises at least one happy path per previously-broken area, end
 * to end, against the REAL `storage` singleton (Postgres) and, where the
 * route is reachable without minting a federated identity, the REAL
 * Express app booted via `registerRoutes()`:
 *
 *   1. Reviewer demo seeding — `ensureReviewerDemoData` → `createDemoData`
 *      in `server/reviewer-demo-service.ts` (wired in `server/routes/_shared.ts`).
 *   2. Share passcode lockout / verify flow — public `GET /api/share/:token`
 *      in `server/routes/integrations-1.ts`.
 *   3. Attachment download path containment — `uploadsDir` consumer
 *      `GET /api/attachments/:id/file` in `server/routes/collab-2.ts`.
 *   4. Health-journey milestone generation (`generateJourneyMilestones`)
 *      + secure-message triage (`triageMessage` / `generateMessageSuggestions`)
 *      in `server/routes/clinical-3.ts`.
 *   5. Wearable/sensor reading creation, threshold alerts
 *      (`checkAndCreateAlert`), and trend analysis (`analyzeReadings`) plus
 *      the device-sensor helpers in `server/routes/clinical-4.ts`.
 *
 * Auth: protected routes are exercised with a real opaque session token —
 * we insert a `user_sessions` row whose `access_token` is the sha256 of a
 * random bearer token, exactly as `requireAuth` validates it. No GCIP/JWT
 * mocking required.
 *
 * Wire-up mirrors `create-record.test.ts` / `routes-split.test.ts` —
 * framework-agnostic, runs via
 *   `node --import tsx server/__tests__/previously-broken-endpoints.test.ts`
 * and is picked up automatically by `npm run test:server`.
 *
 * Requires a reachable Postgres at $DATABASE_URL with the drizzle schema
 * pushed (the Replit dev DB satisfies this; CI runs `npm run db:push`).
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { eq } from "drizzle-orm";

import { registerRoutes } from "../routes";
import { registerClinical3Routes } from "../routes/clinical-3";
import { createSharedContext } from "../routes/_shared";
import { storage } from "../storage";
import { db } from "../db";
import { users, auditLogs } from "../../shared/schema";

import { createDemoData } from "../reviewer-demo-service";
import { generateJourneyMilestones } from "../health-journey-service";
import {
  triageMessage,
  generateMessageSuggestions,
} from "../message-triage-service";
import { updateUserSubscription } from "../subscription-service";
import {
  getSensorTypesForDevice,
  generateMockSensorValue,
  checkAndCreateAlert,
  analyzeReadings,
} from "../sensor-monitoring-service";

// ---------------------------------------------------------------------------
// Assertion helpers (same shape as the other test files in this dir)
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok    ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function http(
  baseUrl: string,
  method: string,
  pathName: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any; text: string }> {
  const headers: Record<string, string> = {};
  const init: RequestInit = { method, headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(baseUrl + pathName, init);
  const text = await res.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body (e.g. streamed file) */
  }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// DB fixtures
// ---------------------------------------------------------------------------

async function createTestUser(): Promise<string> {
  const tag = randomUUID();
  const [row] = await db
    .insert(users)
    .values({ email: `task133-${tag}@test.local`, name: "Task133 Tester" })
    .returning({ id: users.id });
  return row.id;
}

/**
 * Mint a real opaque session bearer token for `userId`. `requireAuth`
 * hashes the presented bearer with sha256 and looks it up via
 * `getUserSessionByAccessToken`, so we store the hash and return the raw
 * token to send as `Authorization: Bearer <token>`.
 */
async function mintSessionToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex"); // 64-char hex, > 16 chars
  const hashed = createHash("sha256").update(raw).digest("hex");
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  await storage.createUserSession({
    userId,
    deviceId: `task133-${randomUUID()}`,
    accessToken: hashed,
    refreshToken: createHash("sha256").update(randomBytes(32)).digest("hex"),
    accessTokenExpiresAt: inOneHour,
    refreshTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isActive: true,
  } as any);
  return raw;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  let app: Express;
  let server: Server;
  let baseUrl = "";
  let userId = "";
  let token = "";
  const tempFiles: string[] = [];
  const extraUserIds: string[] = [];

  try {
    app = express();
    // Mirror server/index.ts: body parsers must be mounted before the routes
    // so JSON request bodies populate req.body.
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: false, limit: "1mb" }));
    await registerRoutes(app);
    server = createServer(app);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    userId = await createTestUser();
    token = await mintSessionToken(userId);

    // ─── auth sanity: minted session is accepted by requireAuth ──────────────
    section("Opaque session token is accepted by requireAuth");
    {
      const unauth = await http(baseUrl, "GET", "/api/packets");
      ok("no token → 401", unauth.status === 401);
      const authed = await http(baseUrl, "GET", "/api/packets", { token });
      ok("minted session token → not 401 (auth passed)", authed.status !== 401);
    }

    // ─── 1. Reviewer demo seeding (createDemoData) ───────────────────────────
    section("Reviewer demo seeding — createDemoData()");
    {
      const result = await createDemoData(userId);
      ok("seeded all demo records (no failures)", result.failures.length === 0);
      ok("seeded === total === 5", result.seeded === 5 && result.total === 5);

      const sources = await storage.getDataSources(userId);
      ok("two demo data sources persisted", sources.length >= 2);
      const records = await storage.getHealthRecords(userId);
      ok("five demo health records persisted", records.length >= 5);
      ok(
        "demo record content round-trips (PHI decrypts)",
        records.some((r) => r.title === "Annual Physical Examination"),
      );
    }

    // ─── 2. Share passcode lockout / verify flow ─────────────────────────────
    section("Share passcode verify flow — GET /api/share/:token");
    {
      // NOTE: storage.createShareLink() ignores any caller-supplied token and
      // generates its own random token, so the public route must be probed with
      // the server-generated link.token (not a token we choose).
      const link = await storage.createShareLink({
        userId,
        passcode: "secret123",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      } as any);
      ok("share link created", Boolean(link?.id) && Boolean(link?.token));
      const shareToken = link.token;

      const noPass = await http(baseUrl, "GET", `/api/share/${shareToken}`);
      ok(
        "missing passcode → 401 requiresPasscode",
        noPass.status === 401 && noPass.json?.requiresPasscode === true,
      );

      const wrongPass = await http(
        baseUrl,
        "GET",
        `/api/share/${shareToken}?passcode=nope`,
      );
      ok("wrong passcode → 401 invalid", wrongPass.status === 401);

      const goodPass = await http(
        baseUrl,
        "GET",
        `/api/share/${shareToken}?passcode=secret123`,
      );
      ok("correct passcode → 200", goodPass.status === 200);
      ok(
        "verified share returns records array",
        Array.isArray(goodPass.json?.records),
      );
      ok(
        "verified share exposes the seeded demo PHI",
        goodPass.json?.records?.length >= 5,
      );
    }

    // ─── 3. Attachment download path containment (uploadsDir) ────────────────
    section("Attachment download — GET /api/attachments/:id/file (uploadsDir)");
    {
      const uploadsDir = path.join(process.cwd(), "uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });

      const [record] = (await storage.getHealthRecords(userId)).slice(0, 1);
      ok("have a record to attach to", Boolean(record?.id));

      const fileName = `task133-${randomUUID()}.txt`;
      const filePath = path.join(uploadsDir, fileName);
      const fileBody = "task133 attachment payload";
      fs.writeFileSync(filePath, fileBody, "utf8");
      tempFiles.push(filePath);

      const attachment = await storage.createRecordAttachment({
        recordId: record.id,
        userId,
        fileName,
        fileType: "text/plain",
        fileSize: Buffer.byteLength(fileBody),
        filePath,
      } as any);
      ok("attachment row created inside uploadsDir", Boolean(attachment?.id));

      const noAuth = await http(
        baseUrl,
        "GET",
        `/api/attachments/${attachment.id}/file`,
      );
      ok("download without auth → 401", noAuth.status === 401);

      const download = await http(
        baseUrl,
        "GET",
        `/api/attachments/${attachment.id}/file`,
        { token },
      );
      ok("authorized download → 200", download.status === 200);
      ok(
        "downloaded body matches file inside uploadsDir",
        download.text === fileBody,
      );
    }

    // ─── 4a. Health-journey milestone generation ─────────────────────────────
    section(
      "Health-journey milestone generation — generateJourneyMilestones()",
    );
    {
      const milestones = generateJourneyMilestones("diabetes_management", [
        "type 2 diabetes",
      ]);
      ok("generates the 8-milestone template set", milestones.length === 8);
      ok(
        "every milestone has a title",
        milestones.every(
          (m) => typeof m.title === "string" && m.title.length > 0,
        ),
      );
      ok(
        "every milestone has a positive points reward",
        milestones.every((m) => m.pointsReward > 0),
      );
      ok(
        "milestones span phases 1..4",
        new Set(milestones.map((m) => m.phase)).size === 4,
      );

      // End-to-end via the protected route: persists milestones using the helper.
      const created = await http(baseUrl, "POST", "/api/health-journeys", {
        token,
        body: {
          title: "Diabetes Journey",
          journeyType: "diabetes_management",
          relatedConditions: ["type 2 diabetes"],
        },
      });
      ok("POST /api/health-journeys → 201", created.status === 201);
      if (created.status === 201) {
        const detail = await http(
          baseUrl,
          "GET",
          `/api/health-journeys/${created.json.id}`,
          { token },
        );
        ok(
          "journey detail returns generated milestones",
          Array.isArray(detail.json?.milestones) &&
            detail.json.milestones.length === 8,
        );
      }
    }

    // ─── 4b. Secure-message triage ───────────────────────────────────────────
    section(
      "Secure-message triage — triageMessage() / generateMessageSuggestions()",
    );
    {
      const emergency = await triageMessage(
        "I have severe chest pain and can't breathe",
      );
      ok(
        "emergency keyword → emergency priority",
        emergency.priority === "emergency",
      );
      ok(
        "emergency triage routes to 911 auto-response",
        /911|emergency room/i.test(emergency.autoResponse),
      );

      const medication = await triageMessage(
        "I need a prescription refill",
        "general",
      );
      ok(
        "medication keyword → medication category",
        medication.suggestedCategory === "medication",
      );
      ok(
        "routine message → routine priority",
        medication.priority === "routine",
      );

      const suggestions = await generateMessageSuggestions(
        "How do I prepare?",
        "context",
      );
      ok(
        "generates 3 reply suggestions",
        Array.isArray(suggestions) && suggestions.length === 3,
      );
    }

    // ─── 4c. Secure-messaging AI reply route end-to-end (subscription gate) ───
    // Messaging routes enforce requireAuth + requireFeature("secure_messaging")
    // both locally and at the prefix in clinical-1.ts. This proves the route returns
    // suggestions for a user who actually holds the secure_messaging
    // entitlement, and denies callers who do not. Subscription tier state lives
    // in an in-memory map in subscription-service, shared in-process with the
    // booted app, so updateUserSubscription() grants the entitlement directly.
    section(
      "Secure-messaging AI reply route — POST /api/messaging/ai-suggestions",
    );
    {
      const body = {
        message: "How do I prepare for my appointment?",
        context: "general",
      };

      // (a) No token → requireAuth rejects before the feature gate.
      const noAuth = await http(
        baseUrl,
        "POST",
        "/api/messaging/ai-suggestions",
        { body },
      );
      ok("no token → 401", noAuth.status === 401);

      // (b) Authenticated but un-entitled (default basic tier) → 403 feature gate.
      const gatedUserId = await createTestUser();
      extraUserIds.push(gatedUserId);
      const gatedToken = await mintSessionToken(gatedUserId);
      const gated = await http(
        baseUrl,
        "POST",
        "/api/messaging/ai-suggestions",
        {
          token: gatedToken,
          body,
        },
      );
      ok(
        "basic-tier user without secure_messaging → 403",
        gated.status === 403,
      );
      // /api/messaging uses requireFeature from revenuecat-gatekeeper, whose 403
      // body is the paywall shape ({ gated, showPaywall, requiredTier }).
      ok(
        "403 response is the feature-gate paywall payload",
        gated.json?.gated === true &&
          gated.json?.showPaywall === true &&
          gated.json?.requiredTier === "professional",
      );

      // (c) Grant the secure_messaging entitlement (professional tier) → 200 + array.
      const entitledUserId = await createTestUser();
      extraUserIds.push(entitledUserId);
      const entitledToken = await mintSessionToken(entitledUserId);
      updateUserSubscription(entitledUserId, "professional", "monthly");

      const entitled = await http(
        baseUrl,
        "POST",
        "/api/messaging/ai-suggestions",
        {
          token: entitledToken,
          body,
        },
      );
      ok("entitled user → 200", entitled.status === 200);
      ok("200 returns an array of suggestions", Array.isArray(entitled.json));
      ok(
        "returns the 3 reply suggestions",
        Array.isArray(entitled.json) && entitled.json.length === 3,
      );
      ok(
        "every suggestion is a non-empty string",
        Array.isArray(entitled.json) &&
          entitled.json.every(
            (s: unknown) => typeof s === "string" && s.length > 0,
          ),
      );

      // Mount the real route definitions without clinical-1's prefix middleware.
      // Every messaging endpoint must reject callers before any PHI access or
      // mutation even when registration order no longer provides the prefix gate.
      const isolatedApp = express();
      isolatedApp.use(express.json());
      registerClinical3Routes(isolatedApp, await createSharedContext());
      const isolatedServer = createServer(isolatedApp);
      try {
        await new Promise<void>((resolve) =>
          isolatedServer.listen(0, "127.0.0.1", resolve),
        );
        const isolatedUrl = `http://127.0.0.1:${(isolatedServer.address() as AddressInfo).port}`;
        const endpoints = [
          ["GET", "/api/messaging/threads"],
          ["GET", "/api/messaging/unread-count"],
          ["GET", "/api/messaging/threads/nonexistent"],
          ["POST", "/api/messaging/threads"],
          ["POST", "/api/messaging/threads/nonexistent/messages"],
          ["POST", "/api/messaging/messages/nonexistent/read"],
          ["POST", "/api/messaging/ai-suggestions"],
        ];
        for (const [method, endpoint] of endpoints) {
          const requestBody = method === "POST" ? body : undefined;
          const anonymous = await http(isolatedUrl, method, endpoint, { body: requestBody });
          ok(`without prefix: ${method} ${endpoint} no token → 401`, anonymous.status === 401);
          const basic = await http(isolatedUrl, method, endpoint, {
            token: gatedToken,
            body: requestBody,
          });
          ok(
            `without prefix: ${method} ${endpoint} basic tier → 403 paywall`,
            basic.status === 403 &&
              basic.json?.gated === true &&
              basic.json?.showPaywall === true &&
              basic.json?.requiredTier === "professional",
          );
        }
        const isolatedEntitled = await http(
          isolatedUrl,
          "POST",
          "/api/messaging/ai-suggestions",
          { token: entitledToken, body },
        );
        ok(
          "without prefix: entitled user → 200 with 3 non-empty suggestions",
          isolatedEntitled.status === 200 &&
            Array.isArray(isolatedEntitled.json) &&
            isolatedEntitled.json.length === 3 &&
            isolatedEntitled.json.every((s: unknown) => typeof s === "string" && s.length > 0),
        );
      } finally {
        await new Promise<void>((resolve, reject) =>
          isolatedServer.close((error) => error ? reject(error) : resolve()),
        );
      }
    }

    // ─── 5. Sensor reading creation, threshold alerts, trend analysis ────────
    section(
      "Sensor helpers — getSensorTypesForDevice / generateMockSensorValue",
    );
    {
      ok(
        "blood_pressure_monitor maps to [blood_pressure, heart_rate]",
        JSON.stringify(getSensorTypesForDevice("blood_pressure_monitor")) ===
          JSON.stringify(["blood_pressure", "heart_rate"]),
      );
      ok(
        "unknown device → empty sensor list",
        getSensorTypesForDevice("__nope__").length === 0,
      );
      const mock = generateMockSensorValue("glucose") as { value: number };
      ok(
        "generateMockSensorValue('glucose') yields a numeric value",
        typeof mock.value === "number",
      );
    }

    section("Sensor threshold alert — checkAndCreateAlert()");
    {
      await storage.upsertSensorThreshold(userId, "glucose", {
        maxValue: { value: 200 },
        isEnabled: true,
      } as any);

      const reading = await storage.createSensorReading({
        userId,
        deviceId: null,
        dataType: "glucose",
        value: { value: 300 },
        unit: "mg/dL",
        timestamp: new Date(),
        isManual: true,
      } as any);
      ok("sensor reading persisted", Boolean(reading?.id));

      const alertResult = await checkAndCreateAlert(userId, null, reading);
      ok("reading above threshold → alerted", alertResult.alerted === true);
      ok(
        "glucose 300 (> 250) → critical severity",
        alertResult.severity === "critical",
      );

      const alerts = await storage.getSensorAlerts(userId);
      ok(
        "threshold alert persisted to DB",
        alerts.some((a) => a.readingId === reading.id),
      );

      // A reading within bounds must NOT alert.
      const normal = await storage.createSensorReading({
        userId,
        deviceId: null,
        dataType: "glucose",
        value: { value: 110 },
        unit: "mg/dL",
        timestamp: new Date(),
        isManual: true,
      } as any);
      const normalResult = await checkAndCreateAlert(userId, null, normal);
      ok("in-range reading → no alert", normalResult.alerted === false);
    }

    section("Sensor reading creation route — POST /api/sensors/readings");
    {
      const created = await http(baseUrl, "POST", "/api/sensors/readings", {
        token,
        body: { dataType: "heart_rate", value: { bpm: 72 }, unit: "bpm" },
      });
      ok("POST /api/sensors/readings → 201", created.status === 201);
      ok(
        "created reading echoes dataType",
        created.json?.dataType === "heart_rate",
      );
    }

    section("Sensor trend analysis — analyzeReadings()");
    {
      const now = Date.now();
      const synthetic = [120, 122, 130, 140, 150, 160].map((v, i) => ({
        id: `r${i}`,
        userId,
        deviceId: null,
        dataType: "glucose",
        value: { value: v },
        unit: "mg/dL",
        timestamp: new Date(now - (6 - i) * 3600_000),
        quality: null,
        isManual: true,
        notes: null,
        metadata: null,
        createdAt: new Date(),
      }));
      const analysis = await analyzeReadings("glucose", synthetic as any);
      ok("analysis completes", analysis.status === "complete");
      ok(
        "computes statistics",
        typeof analysis.statistics?.average === "number",
      );
      ok(
        "detects increasing trend",
        analysis.trend?.direction === "increasing",
      );
      ok("produces at least one insight", (analysis.insights?.length ?? 0) > 0);
    }
  } catch (err) {
    console.error("\nUNEXPECTED ERROR:", err);
    failed++;
  } finally {
    // Cleanup: remove temp files and the test user (cascades to all rows).
    for (const f of tempFiles) {
      try {
        fs.unlinkSync(f);
      } catch {
        /* best effort */
      }
    }
    // The request audit barrier flushes writes before responses complete.
    // No sleep/retry is needed to avoid audit inserts racing user cleanup.
    for (const id of [userId, ...extraUserIds]) {
      if (!id) continue;
      try {
        // audit_logs.user_id has no ON DELETE CASCADE.
        await db.delete(auditLogs).where(eq(auditLogs.userId, id));
        await db.delete(users).where(eq(users.id, id));
      } catch (e) {
        console.error("cleanup: failed to delete test user:", e);
      }
    }
    try {
      // @ts-expect-error server may be undefined if setup threw early
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
    } catch {
      /* best effort */
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})();
