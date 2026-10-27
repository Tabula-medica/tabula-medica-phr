import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash, createHmac } from "node:crypto";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
process.env.PHI_ENCRYPTION_KEY ||= "test-only-payer-reauthorization-encryption-key";

import { db } from "../db";
import { getPayerToken, storePayerToken, getConnectionHealth } from "../auth0-fhir-broker";
import { createPayerReauthorization, PayerReauthError } from "../payer-reauthorization";

// Exercise the real encrypted broker upsert and health projection, not a mocked
// status transition. Only the database transport and external issuer are faked.
const rows: any[] = [];
let selectedUser = "";
let selectedSource = "";
(db as any).insert = () => ({
  values: (values: any) => ({
    onConflictDoUpdate: async ({ set }: any) => {
      const existing = rows.find(row => row.userId === values.userId && row.sourceType === values.sourceType);
      if (existing) Object.assign(existing, set);
      else rows.push({ ...values });
    },
  }),
});
(db as any).select = () => ({
  from: () => ({
    where: () => {
      const found = rows.filter(row => row.userId === selectedUser);
      return Object.assign(Promise.resolve(found), {
        limit: async () => found.filter(row => row.sourceType === selectedSource).slice(0, 1),
      });
    },
  }),
});

const signingKey = "test-only-reauth-state-signing-key";
let rejectedExchange = false;
let malformedExchange = false;
let lastBody: URLSearchParams;
let lastEndpoint = "";
const redeemedCodes = new Set<string>();
const service = createPayerReauthorization({
  signingKey: () => signingKey,
  config: source => ({
    authorizationUrl: `https://${source}.example.com/authorize`,
    tokenUrl: `https://${source}.example.com/token`,
    clientId: `${source}-native-client`,
    redirectUri: "tabulamedica://payer-reconnect",
    scopes: "openid offline_access patient/*.read",
  }),
  validateUrl: async () => {},
  getConnection: async (user, source) => {
    selectedUser = user;
    selectedSource = source;
    return getPayerToken(user, source);
  },
  fetch: (async (url: string, init: any, maxRedirects: number) => {
    lastEndpoint = url;
    lastBody = new URLSearchParams(init.body);
    assert.equal(maxRedirects, 0, "credentials must never follow issuer redirects");
    const code = lastBody.get("code")!;
    const rejected = rejectedExchange || redeemedCodes.has(code);
    redeemedCodes.add(code);
    return {
      ok: !rejected,
      json: async () => malformedExchange ? {} : ({
        access_token: "new-test-access", refresh_token: "new-test-refresh", expires_in: 3600,
      }),
    };
  }) as any,
});

async function health(user = "patient-a") {
  selectedUser = user;
  return getConnectionHealth(user);
}
async function seed() {
  rows.length = 0;
  rejectedExchange = false;
  malformedExchange = false;
  redeemedCodes.clear();
  for (const [user, source] of [["patient-a", "cigna"], ["patient-a", "epic"], ["patient-b", "cigna"]]) {
    await storePayerToken(user, source, {
      accessToken: "old-test-access", refreshToken: "revoked-test-refresh",
      expiresAt: Date.now() - 1000, fhirBaseUrl: `https://${source}.example.com/fhir`,
    });
    const row = rows.find(row => row.userId === user && row.sourceType === source)!;
    row.syncStatus = "needs_reauth";
    row.lastRefreshError = "refresh_rejected";
  }
}

test("source-specific OAuth + PKCE renews the same stored connection and health, not a Fasten org", async () => {
  await seed();
  assert.equal((await health())[0].needsReauth, true);
  const session = await service.start("patient-a", "cigna");
  const authorize = new URL(session.authorizationUrl);
  assert.equal(authorize.host, "cigna.example.com");
  assert.equal(authorize.searchParams.get("client_id"), "cigna-native-client");
  assert.equal(authorize.searchParams.get("aud"), "https://cigna.example.com/fhir");
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("code_verifier"), null);
  assert.equal(session.redirectUri, "tabulamedica://payer-reconnect");
  const result = await service.complete("patient-a", "cigna", "valid-one-use-code", session.state);
  assert.equal(result.syncStatus, "active");
  assert.equal(lastEndpoint, "https://cigna.example.com/token");
  assert.equal(lastBody.get("grant_type"), "authorization_code");
  assert.equal(lastBody.get("redirect_uri"), session.redirectUri);
  assert.equal(
    createHash("sha256").update(lastBody.get("code_verifier")!).digest("base64url"),
    authorize.searchParams.get("code_challenge"),
  );
  const current = await health();
  assert.equal(current.find(row => row.sourceType === "cigna")!.needsReauth, false);
  assert.equal(current.find(row => row.sourceType === "cigna")!.lastRefreshError, null);
  assert.ok(current.find(row => row.sourceType === "cigna")!.lastSyncedAt);
  assert.equal(current.find(row => row.sourceType === "epic")!.syncStatus, "needs_reauth");
  assert.equal((await health("patient-b"))[0].syncStatus, "needs_reauth");
  assert.equal(rows.length, 3, "reauthorization must update, not duplicate, the source");
  const stored = rows.find(row => row.userId === "patient-a" && row.sourceType === "cigna");
  assert.notEqual(stored.accessTokenEncrypted, "new-test-access");
  selectedUser = "patient-a";
  selectedSource = "cigna";
  assert.equal((await getPayerToken("patient-a", "cigna"))!.accessToken, "new-test-access");
  await assert.rejects(service.complete("patient-a", "cigna", "valid-one-use-code", session.state), /Could not renew/);
});

test("denied or malformed token exchanges leave the original needs-reauth connection intact", async () => {
  for (const malformed of [false, true]) {
    await seed();
    const session = await service.start("patient-a", "cigna");
    rejectedExchange = !malformed;
    malformedExchange = malformed;
    await assert.rejects(service.complete("patient-a", "cigna", "bad-code", session.state), /Could not renew/);
    assert.equal((await health())[0].needsReauth, true);
    assert.equal(rows[0].lastRefreshError, "refresh_rejected");
  }
});

test("signed reconnect state rejects another patient, a different source, tampering, and expiry", async () => {
  await seed();
  const { state } = await service.start("patient-a", "cigna");
  await assert.rejects(service.complete("patient-b", "cigna", "code", state), /does not match/);
  await assert.rejects(service.complete("patient-a", "epic", "code", state), /does not match/);
  await assert.rejects(service.complete("patient-a", "cigna", "code", `${state}tampered`), /Invalid reconnect/);
  const payload = JSON.parse(Buffer.from(state.split(".")[0], "base64url").toString());
  payload.expires = Date.now() - 1;
  const expiredPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const expiredSignature = createHmac("sha256", signingKey).update(`payer-reauth-state:${expiredPayload}`).digest("base64url");
  await assert.rejects(service.complete("patient-a", "cigna", "code", `${expiredPayload}.${expiredSignature}`), /expired/);
  assert.ok((await health()).every(row => row.needsReauth));
});

test("unlinked sources cannot initiate reauthorization", async () => {
  await seed();
  await assert.rejects(service.start("patient-b", "epic"), (error: any) => error.status === 404);
  await assert.rejects(service.start("patient-a", "../../cigna"), (error: any) => error.status === 400);
});

test("missing source OAuth configuration fails explicitly, without depending on Fasten widget config", async () => {
  const unavailable = createPayerReauthorization({
    getConnection: async () => ({ connectedAt: "", sourceType: "cigna", accessToken: "", refreshToken: "", expiresAt: 0, fhirBaseUrl: "" }),
    config: () => { throw new PayerReauthError(503, "Reconnecting this source is temporarily unavailable."); },
  });
  await assert.rejects(unavailable.start("patient-a", "cigna"), (error: any) => error.status === 503);
});

test("browser reauthorization requires a separately registered HTTPS callback", async () => {
  await seed();
  await assert.rejects(service.start("patient-a", "cigna", "web"), /use the mobile app/);
  const webService = createPayerReauthorization({
    signingKey: () => signingKey,
    validateUrl: async () => {},
    getConnection: async (user, source) => {
      selectedUser = user;
      selectedSource = source;
      return getPayerToken(user, source);
    },
    config: () => ({
      authorizationUrl: "https://cigna.example.com/authorize",
      tokenUrl: "https://cigna.example.com/token",
      clientId: "web-client",
      redirectUri: "tabulamedica://payer-reconnect",
      webRedirectUri: "https://app.example.com/",
      scopes: "openid offline_access patient/*.read",
    }),
  });
  const session = await webService.start("patient-a", "cigna", "web");
  assert.equal(session.redirectUri, "https://app.example.com/");
  assert.equal(new URL(session.authorizationUrl).searchParams.get("redirect_uri"), session.redirectUri);
});
