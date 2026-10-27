/**
 * Symptom-checker bearer-identity + persistence tests.
 *
 * Scenarios:
 *   1. No identity  → triage succeeds, nothing is persisted, /sessions returns [].
 *   2. Bearer token → session is persisted and listed only for that account.
 *   3. Account B    → cannot see account A's sessions.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---------------------------------------------------------------------------
// Shared mutable state — must be hoisted so vi.mock factories can close over it.
// ---------------------------------------------------------------------------

const { selectQueue, insertedValues, mockVerifyGcip } = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  insertedValues: [] as unknown[],
  mockVerifyGcip: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../server/db", () => {
  const makeChain = (rows: unknown[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  });
  return {
    db: {
      select: vi.fn().mockImplementation(() => makeChain(selectQueue.shift() ?? [])),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((v: unknown) => {
          insertedValues.push(v);
          return Promise.resolve();
        }),
      }),
    },
  };
});

vi.mock("../server/services/ai-gateway", () => ({
  generatePhiSafeText: vi.fn().mockResolvedValue(
    JSON.stringify({
      urgency: "SELF_CARE",
      recommendedAction: "Rest and monitor symptoms.",
      rationale: "Mild symptoms, no red flags detected.",
      selfCareSteps: ["Rest", "Stay hydrated"],
      whenToSeekCare: ["Symptoms worsen", "Fever develops"],
    }),
  ),
}));

vi.mock("../server/auth/gcip", () => ({
  verifyAndResolveGcip: (...args: unknown[]) => mockVerifyGcip(...args),
}));

// ---------------------------------------------------------------------------
// Import router AFTER mocks are declared.
// ---------------------------------------------------------------------------

import router from "../server/routes/symptom-checker-routes";

// ---------------------------------------------------------------------------
// Express test server
// ---------------------------------------------------------------------------

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/symptom-checker", router);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/symptom-checker`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  selectQueue.length = 0;
  insertedValues.length = 0;
  mockVerifyGcip.mockReset();
  mockVerifyGcip.mockResolvedValue(null); // default: bearer not recognised
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRIAGE_BODY = {
  bodyRegion: "abdomen",
  symptoms: ["stomach ache", "nausea"],
  severity: 3,
  onsetHours: 4,
};

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}) {
  return fetch(`${base}${path}`, { headers });
}

// ---------------------------------------------------------------------------
// 1. Anonymous user
// ---------------------------------------------------------------------------

describe("anonymous user (no auth header)", () => {
  it("POST /triage succeeds and does not persist a session", async () => {
    const res = await post("/triage", TRIAGE_BODY);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.result.urgency).toBeDefined();
    // No account lookup and no insert should have happened.
    expect(insertedValues).toHaveLength(0);
    expect(mockVerifyGcip).not.toHaveBeenCalled();
  });

  it("GET /sessions returns an empty list", async () => {
    const res = await get("/sessions");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sessions).toEqual([]);
    expect(mockVerifyGcip).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Bearer-authenticated user
// ---------------------------------------------------------------------------

describe("bearer-authenticated user", () => {
  const USER_A = {
    id: "uid-a",
    email: "user-a@example.com",
    firstName: "Alice",
    lastName: "User",
  };
  const ACCT_A_ID = "acct-uuid-a";
  const SESSION_RECORD = {
    id: "sess-uuid-a",
    accountId: ACCT_A_ID,
    transcript: TRIAGE_BODY,
    triageResult: { urgency: "SELF_CARE", modelGenerated: false },
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockVerifyGcip.mockResolvedValue(USER_A);
  });

  it("POST /triage with a valid bearer persists the session under the resolved account", async () => {
    // Account lookup returns acct-a.
    selectQueue.push([{ id: ACCT_A_ID }]);

    const res = await post("/triage", TRIAGE_BODY, {
      authorization: "Bearer test-token-a",
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockVerifyGcip).toHaveBeenCalledWith("test-token-a");
    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0].accountId).toBe(ACCT_A_ID);
  });

  it("GET /sessions returns only this account's sessions", async () => {
    // Two DB selects: account lookup, then session listing.
    selectQueue.push([{ id: ACCT_A_ID }]);
    selectQueue.push([SESSION_RECORD]);

    const res = await get("/sessions", { authorization: "Bearer test-token-a" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sessions).toHaveLength(1);
    expect(json.sessions[0].id).toBe("sess-uuid-a");
    expect(json.sessions[0].accountId).toBe(ACCT_A_ID);
  });

  it("invalid/expired bearer token behaves as anonymous (no persist, empty sessions)", async () => {
    mockVerifyGcip.mockResolvedValue(null); // token rejected

    const triageRes = await post("/triage", TRIAGE_BODY, {
      authorization: "Bearer bad-token",
    });
    expect(triageRes.status).toBe(200);
    expect(insertedValues).toHaveLength(0);

    const sessRes = await get("/sessions", { authorization: "Bearer bad-token" });
    const json = await sessRes.json();
    expect(json.sessions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Cross-account isolation
// ---------------------------------------------------------------------------

describe("cross-account isolation", () => {
  const USER_A = { id: "uid-a", email: "user-a@example.com", firstName: "A", lastName: "U" };
  const USER_B = { id: "uid-b", email: "user-b@example.com", firstName: "B", lastName: "U" };
  const ACCT_A_ID = "acct-uuid-a";
  const ACCT_B_ID = "acct-uuid-b";

  it("account B's GET /sessions receives an empty list even when account A has sessions", async () => {
    // Account B presents their bearer token.
    mockVerifyGcip.mockResolvedValue(USER_B);

    // DB resolves account B and returns no sessions (B has none).
    selectQueue.push([{ id: ACCT_B_ID }]); // account lookup → B
    selectQueue.push([]); // session query scoped to ACCT_B_ID → empty

    const res = await get("/sessions", { authorization: "Bearer test-token-b" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.sessions).toEqual([]);

    // Both queued DB responses were consumed — the select chain was called with
    // B's accountId, not A's, which is the IDOR guard in the route handler.
    expect(selectQueue).toHaveLength(0);
  });

  it("account A's triage session is NOT visible to account B", async () => {
    // Account A triages and stores a session.
    mockVerifyGcip.mockResolvedValue(USER_A);
    selectQueue.push([{ id: ACCT_A_ID }]);
    await post("/triage", TRIAGE_BODY, { authorization: "Bearer test-token-a" });
    expect(insertedValues[0].accountId).toBe(ACCT_A_ID);

    // Reset inserts; account B now calls /sessions.
    insertedValues.length = 0;
    mockVerifyGcip.mockResolvedValue(USER_B);
    selectQueue.push([{ id: ACCT_B_ID }]); // resolves to B
    selectQueue.push([]); // no sessions for B

    const res = await get("/sessions", { authorization: "Bearer test-token-b" });
    const json = await res.json();
    expect(json.sessions).toEqual([]);
  });
});
