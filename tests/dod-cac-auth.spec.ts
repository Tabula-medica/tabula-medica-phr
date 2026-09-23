import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "crypto";
import type { Request, Response } from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { hashEdipi } from "../server/storage/phi-storage";

/**
 * Fake `cac_software_certs` backing the mocked `db.execute` — just enough of
 * its shape (edipi, public_key_hex, expires_at, enrolled_by_user_id) to
 * support the enroll INSERT and the verify/status handlers' lookups,
 * mirroring the real table without a live database.
 *
 * The real handlers call db.execute(sql`...`) with a Drizzle `sql` tagged
 * template, not a plain string — db.execute() takes exactly one argument
 * and would silently ignore a second one, so a raw string with `?`
 * placeholders never actually binds anything against this Drizzle client
 * (that was itself one of the bugs this spec exists to catch). This mock
 * uses the real PgDialect to turn each SQL object into the same
 * {sql, params} shape (with genuine $1/$2 placeholders) a real Postgres
 * call would receive, so a query that's broken this way fails here too,
 * not just in a real database.
 */
const dialect = new PgDialect();

function toQuery(query: SQL) {
  return dialect.sqlToQuery(query);
}

// edipi/certJson are now stored as whatever encryptPhi() (real, unmocked)
// actually produced — this mock never sees plaintext EDIPI, matching the
// real table, and edipiHash (also real, unmocked hashEdipi()) is what
// every lookup below actually matches on.
const enrolledCerts: { edipiHash: string; encryptedEdipi: string; deviceId: string; publicKeyHex: string; expiresAt: number; enrolledByUserId: string }[] = [];
// edipiHash -> claimed_by_user_id, mirroring the real cac_edipi_claims
// table: a claim, once made, is never removed by this mock either.
const edipiClaims = new Map<string, string>();

vi.mock("../server/db", () => {
  const execute = vi.fn(async (query: SQL) => {
      const { sql: text, params } = toQuery(query);
      if (text.includes("INSERT INTO cac_edipi_claims")) {
        const [edipiHash, , claimedByUserId] = params as string[];
        if (!edipiClaims.has(edipiHash)) {
          edipiClaims.set(edipiHash, claimedByUserId);
          return { rows: [{ claimed_by_user_id: claimedByUserId }] };
        }
        return { rows: [] }; // ON CONFLICT DO NOTHING — already claimed
      }
      if (text.includes("SELECT claimed_by_user_id FROM cac_edipi_claims")) {
        const [edipiHash] = params as string[];
        const owner = edipiClaims.get(edipiHash);
        return { rows: owner ? [{ claimed_by_user_id: owner }] : [] };
      }
      if (text.includes("SELECT DISTINCT enrolled_by_user_id FROM cac_software_certs")) {
        // The legacy-owner fallback: when this EDIPI has no row in
        // cac_edipi_claims yet, a cert enrolled before that table existed
        // is still the real claimant. No expires_at filter here either,
        // for the same reason cac_edipi_claims itself never expires.
        const [edipiHash] = params as string[];
        const owners = [...new Set(enrolledCerts.filter((c) => c.edipiHash === edipiHash).map((c) => c.enrolledByUserId))];
        return { rows: owners.map((enrolled_by_user_id) => ({ enrolled_by_user_id })) };
      }
      if (text.includes("INSERT INTO cac_software_certs")) {
        // NOW() in the template isn't a bound param, so the 9 columns map
        // to only 8 params here: edipiHash, encryptedEdipi, deviceId,
        // publicKeyHex, encryptedCertJson, platformInfo, expiresAt,
        // enrolledByUserId (enrolled_at is NOW()). A trailing 9th param is
        // the WHERE clause's repeated enrolledByUserId.
        const [edipiHash, encryptedEdipi, deviceId, publicKeyHex, , , , enrolledByUserId] = params as string[];
        const existingIndex = enrolledCerts.findIndex((c) => c.deviceId === deviceId);
        // Mirrors the real "... WHERE cac_software_certs.enrolled_by_user_id
        // = $n": a device already owned by a DIFFERENT account never
        // updates — the conflict branch is a no-op, same as Postgres
        // returning zero rows for an ON CONFLICT DO UPDATE ... WHERE that
        // doesn't match.
        if (existingIndex >= 0 && enrolledCerts[existingIndex].enrolledByUserId !== enrolledByUserId) {
          return { rows: [] };
        }
        // Same-owner re-enrollment replaces the row (new key/expiry/edipi)
        // rather than adding a second one, so a superseded key stops
        // matching lookups below.
        const row = { edipiHash, encryptedEdipi, deviceId, publicKeyHex, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, enrolledByUserId };
        if (existingIndex >= 0) {
          enrolledCerts[existingIndex] = row;
        } else {
          enrolledCerts.push(row);
        }
        return { rows: [{ device_id: deviceId }] };
      }
      if (text.includes("SELECT public_key_hex FROM cac_software_certs")) {
        const [edipiHash, publicKeyHex] = params as string[];
        const match = enrolledCerts.find((c) => c.edipiHash === edipiHash && c.publicKeyHex === publicKeyHex && c.expiresAt > Date.now());
        return { rows: match ? [{ public_key_hex: match.publicKeyHex }] : [] };
      }
      if (text.includes("SELECT edipi, device_id, platform, enrolled_at, expires_at FROM cac_software_certs")) {
        const [enrolledByUserId] = params as string[];
        const matches = enrolledCerts.filter((c) => c.enrolledByUserId === enrolledByUserId && c.expiresAt > Date.now());
        return { rows: matches.map((c) => ({ edipi: c.encryptedEdipi, device_id: c.deviceId })) };
      }
      throw new Error(`db.execute mock: unhandled query: ${text}`);
  });
  // enroll-software-cert wraps its claim + upsert in db.transaction(async
  // (tx) => ...) so a device conflict rolls back an already-committed
  // EDIPI claim instead of orphaning it. tx just needs to behave like db
  // here, so the callback gets the same mock object back.
  const dbMock: { execute: typeof execute; insert: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> } = {
    execute,
    // hipaaComplianceService.logAuditEvent() writes via db.insert(...).values(...)
    // (Drizzle's fluent builder), not db.execute(sql\`...\`) — stubbed just
    // enough to resolve so the verify handler's audit call doesn't reject.
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue({ rows: [] }) })),
    // A real Postgres transaction rolls back every write the callback made
    // if it throws — including an already-succeeded cac_edipi_claims
    // insert, so a later device conflict can't orphan the claim. This
    // in-memory mock has no such rollback for free, so it snapshots both
    // tables first and restores them on throw to match.
    transaction: vi.fn(async (callback: (tx: typeof dbMock) => Promise<unknown>) => {
      const claimsSnapshot = new Map(edipiClaims);
      const certsSnapshot = enrolledCerts.map((c) => ({ ...c }));
      try {
        return await callback(dbMock);
      } catch (err) {
        edipiClaims.clear();
        for (const [k, v] of claimsSnapshot) edipiClaims.set(k, v);
        enrolledCerts.length = 0;
        enrolledCerts.push(...certsSnapshot);
        throw err;
      }
    }),
  };
  return {
    db: dbMock,
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
  };
});

import { registerDoDRoutes } from "../server/dod-routes";

/**
 * The /api/auth/cac/verify handler used to mint a fully "authenticated"
 * session (including IAL3 assurance) for anyone who called it with any
 * body at all — signature, certDerBase64, and publicKeyHex were destructured
 * but never checked; `signatureValid: true` was hardcoded. This spec proves
 * the fix: a session only mints when (1) the caller can produce a real
 * ECDSA P-384 signature over the challenge, (2) from a public key that EDIPI
 * actually enrolled while authenticated — not merely a key the caller
 * generated on the spot — (3) the EDIPI/authMethod match what the challenge
 * was originally issued for, and (4) that enrollment itself wasn't a
 * different account claiming someone else's already-enrolled EDIPI.
 */

type FakeRes = Response & { statusCode: number; body: unknown };

function fakeRes(): FakeRes {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  } as FakeRes;
  return res;
}

function captureHandlers() {
  const handlers = new Map<string, (req: Request, res: Response) => unknown>();
  const capture = (path: string, ...mw: ((req: Request, res: Response) => unknown)[]) => {
    handlers.set(path, mw[mw.length - 1]); // last arg is the actual route handler
  };
  const app = { post: capture, get: capture };
  registerDoDRoutes(app as unknown as Parameters<typeof registerDoDRoutes>[0], ((_req, _res, next) => next()) as never);
  return handlers;
}

async function generateKeyPair() {
  return webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-384" }, true, ["sign", "verify"]);
}

async function exportPublicKeyHex(publicKey: CryptoKey): Promise<string> {
  const raw = await webcrypto.subtle.exportKey("raw", publicKey);
  return Buffer.from(raw).toString("hex");
}

async function signChallenge(challenge: string, privateKey: CryptoKey): Promise<string> {
  const sig = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-384" }, privateKey, new TextEncoder().encode(challenge));
  return Buffer.from(sig).toString("base64");
}

function fakeReq(body: unknown, userId = "test-user"): Request {
  // getUserId() (server/middleware/require-user.ts) — the real,
  // unmocked implementation the enroll and status handlers now use —
  // reads req.user.claims.sub, not a `_authenticatedUserId` field
  // nothing in this app actually ever sets.
  return { body, headers: {}, ip: "127.0.0.1", user: { claims: { sub: userId } } } as unknown as Request;
}

async function getChallenge(handlers: ReturnType<typeof captureHandlers>, edipi = "1234567890", authMethod = "software_cert") {
  const res = fakeRes();
  await handlers.get("/api/auth/cac/challenge")!(fakeReq({ authMethod, edipi }), res);
  return res.body as { challenge: string; challengeId: string };
}

async function enroll(
  handlers: ReturnType<typeof captureHandlers>,
  edipi: string,
  publicKeyHex: string,
  userId = "test-user",
  deviceId = `test-device-${userId}`,
) {
  const res = fakeRes();
  await handlers.get("/api/auth/cac/enroll-software-cert")!(
    fakeReq({ publicKeyHex, edipi, deviceId, platform: "test", platformVersion: "1" }, userId),
    res,
  );
  return res;
}

describe("POST /api/auth/cac/verify", () => {
  beforeEach(() => {
    enrolledCerts.length = 0;
    edipiClaims.clear();
  });

  it("mints a session only when the key is enrolled for this EDIPI and the signature over the challenge verifies", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    expect((await enroll(handlers, "1234567890", publicKeyHex)).statusCode).toBe(200);

    const { challenge, challengeId } = await getChallenge(handlers);
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(200);
    expect((res.body as { signatureValid: boolean }).signatureValid).toBe(true);
  });

  it("rejects when no signature is provided at all — the original bug", async () => {
    const handlers = captureHandlers();
    const { challengeId } = await getChallenge(handlers);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert" });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a key that was never enrolled for this EDIPI, even with a genuine self-signed signature", async () => {
    // Proof of possession of *a* key proves nothing about identity on its
    // own — an attacker can generate their own key pair, sign the challenge
    // correctly, and assert any EDIPI. Nothing here was ever enrolled, so
    // this must be rejected even though the signature itself is completely
    // valid.
    const handlers = captureHandlers();
    const { challenge, challengeId } = await getChallenge(handlers);
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a signature that doesn't match the enrolled public key", async () => {
    const handlers = captureHandlers();
    const enrolledKeyPair = await generateKeyPair();
    const enrolledPublicKeyHex = await exportPublicKeyHex(enrolledKeyPair.publicKey);
    await enroll(handlers, "1234567890", enrolledPublicKeyHex);

    const { challenge, challengeId } = await getChallenge(handlers);
    const impostorKeyPair = await generateKeyPair();
    const signature = await signChallenge(challenge, impostorKeyPair.privateKey); // signed with the WRONG key

    const req = fakeReq({
      challengeId,
      edipi: "1234567890",
      authMethod: "software_cert",
      publicKeyHex: enrolledPublicKeyHex, // claims the enrolled key, but didn't sign with it
      signature,
    });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a signature over the wrong data — tampering with the challenge after signing", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);
    const { challengeId } = await getChallenge(handlers);
    const signature = await signChallenge("not-the-real-challenge", keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed publicKeyHex/signature without crashing", async () => {
    const handlers = captureHandlers();
    const { challengeId } = await getChallenge(handlers);

    const req = fakeReq({
      challengeId,
      edipi: "1234567890",
      authMethod: "software_cert",
      publicKeyHex: "not-hex",
      signature: "not-base64!!",
    });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("still rejects an unknown or expired challengeId before ever reaching signature verification", async () => {
    const handlers = captureHandlers();
    const req = fakeReq({ challengeId: "does-not-exist", edipi: "1234567890", authMethod: "software_cert" });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects when the verify request's EDIPI doesn't match the one the challenge was issued for", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "9999999999", publicKeyHex);

    const { challenge, challengeId } = await getChallenge(handlers, "1234567890"); // challenge issued for a different EDIPI
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "9999999999", authMethod: "software_cert", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects when the verify request's authMethod doesn't match the one the challenge was issued for", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);

    const { challenge, challengeId } = await getChallenge(handlers, "1234567890", "software_cert");
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "cac_hardware", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a self-consistent cac_hardware/piv_hardware claim even from a key legitimately enrolled as a software cert", async () => {
    // The enrolled-cert lookup matches on (edipi, publicKeyHex) alone, with
    // no authMethod filter. Without an explicit reject, a caller who
    // legitimately enrolled a software cert could request a challenge *and*
    // verify with authMethod: "cac_hardware" (self-consistent, so the
    // context-binding check alone doesn't catch it), still match the same
    // enrolled row, and be minted an IAL3 session for a key that was never
    // validated as hardware-backed.
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);

    for (const authMethod of ["cac_hardware", "piv_hardware"]) {
      const { challenge, challengeId } = await getChallenge(handlers, "1234567890", authMethod);
      const signature = await signChallenge(challenge, keyPair.privateKey);

      const req = fakeReq({ challengeId, edipi: "1234567890", authMethod, publicKeyHex, signature });
      const res = fakeRes();
      await handlers.get("/api/auth/cac/verify")!(req, res);

      expect(res.statusCode).toBe(401);
    }
  });

  it("mints a session when /challenge and /verify send matching, explicit edipi/authMethod", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);

    const { challenge, challengeId } = await getChallenge(handlers, "1234567890", "software_cert");
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert", publicKeyHex, signature });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(200);
  });

  it("rejects /challenge when edipi is omitted — an unbound challenge would let /verify assert any identity", async () => {
    // edipi/authMethod used to be optional at /challenge, with /verify's
    // context-binding check only enforced "when the challenge happened to
    // record one" — so any caller could skip the binding entirely just by
    // omitting them here, then assert whatever edipi/authMethod they liked
    // at /verify. Both are now required, making the binding unconditional.
    const handlers = captureHandlers();
    const res = fakeRes();
    await handlers.get("/api/auth/cac/challenge")!(fakeReq({ authMethod: "software_cert" }), res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects /challenge when authMethod is omitted", async () => {
    const handlers = captureHandlers();
    const res = fakeRes();
    await handlers.get("/api/auth/cac/challenge")!(fakeReq({ edipi: "1234567890" }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/cac/enroll-software-cert", () => {
  beforeEach(() => {
    enrolledCerts.length = 0;
    edipiClaims.clear();
  });

  it("rejects a P-256 public key — verifyChallengeSignature always imports P-384, so a P-256 enrollment could never pass verification", async () => {
    const p256KeyPair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = await webcrypto.subtle.exportKey("raw", p256KeyPair.publicKey);
    const p256PublicKeyHex = Buffer.from(raw).toString("hex");
    expect(p256PublicKeyHex).toHaveLength(130); // uncompressed P-256 point

    const handlers = captureHandlers();
    const res = await enroll(handlers, "1234567890", p256PublicKeyHex);
    expect(res.statusCode).toBe(400);
  });

  it("allows the same account to enroll a second device under an EDIPI it already claimed", async () => {
    const handlers = captureHandlers();
    const firstKeyPair = await generateKeyPair();
    const secondKeyPair = await generateKeyPair();

    expect((await enroll(handlers, "1234567890", await exportPublicKeyHex(firstKeyPair.publicKey), "same-user", "device-one")).statusCode).toBe(200);
    expect((await enroll(handlers, "1234567890", await exportPublicKeyHex(secondKeyPair.publicKey), "same-user", "device-two")).statusCode).toBe(200);
  });

  it("rejects a different account trying to enroll under an EDIPI someone else already claimed", async () => {
    // This is the actual bug: there's no independently verified source of a
    // user's EDIPI anywhere in this app, so enrollment alone can never fully
    // prove identity — but once one account has claimed an EDIPI, a
    // different account must not be able to silently take it over.
    const handlers = captureHandlers();
    const victimKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();

    expect((await enroll(handlers, "1234567890", await exportPublicKeyHex(victimKeyPair.publicKey), "victim")).statusCode).toBe(200);

    const attackerAttempt = await enroll(handlers, "1234567890", await exportPublicKeyHex(attackerKeyPair.publicKey), "attacker");
    expect(attackerAttempt.statusCode).toBe(409);
  });

  it("rejects a different account claiming an EDIPI whose sole enrolled cert has since expired", async () => {
    // Ownership is tracked in cac_edipi_claims, which is never pruned by
    // expiry — unlike checking cac_software_certs' own expires_at, which
    // would let a claim silently lapse the moment the original owner's
    // cert ages out, reopening exactly the takeover this exists to block.
    const handlers = captureHandlers();
    const victimKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();

    expect((await enroll(handlers, "1234567890", await exportPublicKeyHex(victimKeyPair.publicKey), "victim")).statusCode).toBe(200);
    const targetHash = hashEdipi("1234567890");
    enrolledCerts.forEach((c) => {
      if (c.edipiHash === targetHash) c.expiresAt = Date.now() - 1000; // simulate a lapsed cert
    });

    const attackerAttempt = await enroll(handlers, "1234567890", await exportPublicKeyHex(attackerKeyPair.publicKey), "attacker");
    expect(attackerAttempt.statusCode).toBe(409);
  });

  it("gives exactly one of two same-EDIPI enrollments from different accounts a claim, whichever request reaches it first", async () => {
    // This does NOT exercise real database concurrency — the mocked
    // db.execute() mutates edipiClaims synchronously within a single
    // microtask, so Promise.all here can't make two calls actually
    // interleave inside the mock the way two real Postgres connections
    // could inside a live INSERT. What it does prove: whichever of two
    // same-EDIPI enrollments reaches the (now atomic, single-statement)
    // claim first wins, and the second is rejected rather than also
    // succeeding — i.e. no code path here still does a separate
    // check-then-insert that this test would incidentally paper over.
    // The actual concurrent-Postgres guarantee — that INSERT ... ON
    // CONFLICT (edipi) DO NOTHING on a PRIMARY KEY serializes two real,
    // simultaneous connections — is a documented Postgres contract, not
    // application logic, and would need a real-Postgres integration test
    // (in the style of pg-rate-limit-store.integration.spec.ts) to prove
    // directly rather than exercised through this in-memory mock.
    const handlers = captureHandlers();
    const keyA = await generateKeyPair();
    const keyB = await generateKeyPair();

    const [resA, resB] = await Promise.all([
      enroll(handlers, "1234567890", await exportPublicKeyHex(keyA.publicKey), "racer-a"),
      enroll(handlers, "1234567890", await exportPublicKeyHex(keyB.publicKey), "racer-b"),
    ]);

    const statusCodes = [resA.statusCode, resB.statusCode].sort();
    expect(statusCodes).toEqual([200, 409]);
  });

  it("rejects a different account re-enrolling a device_id someone else already owns, leaving the original enrollment untouched", async () => {
    // ON CONFLICT (device_id) DO UPDATE with no ownership check would
    // silently overwrite the victim's key while leaving their edipi in
    // place — letting the attacker's new key authenticate as the victim's
    // identity, since verify matches on (edipi, public_key_hex) alone.
    const handlers = captureHandlers();
    const victimKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();
    const victimPublicKeyHex = await exportPublicKeyHex(victimKeyPair.publicKey);

    expect((await enroll(handlers, "1111111111", victimPublicKeyHex, "victim", "shared-device")).statusCode).toBe(200);

    const attackerAttempt = await enroll(handlers, "2222222222", await exportPublicKeyHex(attackerKeyPair.publicKey), "attacker", "shared-device");
    expect(attackerAttempt.statusCode).toBe(409);

    // The victim's own enrollment must still be exactly what they set up.
    const { challenge, challengeId } = await getChallenge(handlers, "1111111111");
    const signature = await signChallenge(challenge, victimKeyPair.privateKey);
    const verifyReq = fakeReq({ challengeId, edipi: "1111111111", authMethod: "software_cert", publicKeyHex: victimPublicKeyHex, signature });
    const verifyRes = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(verifyReq, verifyRes);
    expect(verifyRes.statusCode).toBe(200);
  });

  it("does not orphan an EDIPI claim when the same request's device upsert then conflicts", async () => {
    // The EDIPI claim and the certificate upsert run in one transaction
    // specifically so this can't happen: claiming edipi succeeds, but the
    // device_id in the same request belongs to someone else, so the whole
    // attempt must roll back — including the claim — rather than leaving a
    // permanent claim on this EDIPI with no certificate behind it, which
    // would lock out every future caller, including the legitimate owner.
    const handlers = captureHandlers();
    const victimKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();
    const legitimateKeyPair = await generateKeyPair();

    // A device_id already owned by a different account.
    await enroll(handlers, "1111111111", await exportPublicKeyHex(victimKeyPair.publicKey), "victim", "victims-device");

    // Attacker claims a brand-new, previously-unclaimed EDIPI, but reuses
    // the victim's device_id — the device check fails after the EDIPI
    // claim would otherwise have succeeded.
    const attackerAttempt = await enroll(
      handlers,
      "5555555555",
      await exportPublicKeyHex(attackerKeyPair.publicKey),
      "attacker",
      "victims-device",
    );
    expect(attackerAttempt.statusCode).toBe(409);

    // If the claim on 5555555555 had survived, this would 409 too even
    // though "legit" never touched that EDIPI before.
    const legitimateAttempt = await enroll(
      handlers,
      "5555555555",
      await exportPublicKeyHex(legitimateKeyPair.publicKey),
      "legit",
      "legits-own-device",
    );
    expect(legitimateAttempt.statusCode).toBe(200);
  });

  it("honors a pre-existing cac_software_certs owner for an EDIPI that has no cac_edipi_claims row yet", async () => {
    // cac_edipi_claims starts empty on any deploy, but cac_software_certs
    // is the older table — real enrollments could already exist under an
    // EDIPI before this exclusivity check (and its claims table) existed.
    // Without consulting the older table too, the first caller to hit
    // this code post-deploy would win the claim outright, even if they
    // are not who actually enrolled that EDIPI's existing certificate.
    const handlers = captureHandlers();
    const legacyOwnerKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();

    // Simulate a cert enrolled before cac_edipi_claims existed: a row in
    // cac_software_certs with no corresponding claims-table entry.
    enrolledCerts.push({
      edipiHash: hashEdipi("7777777777"),
      encryptedEdipi: "unused-in-this-test",
      deviceId: "legacy-owner-device",
      publicKeyHex: await exportPublicKeyHex(legacyOwnerKeyPair.publicKey),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      enrolledByUserId: "legacy-owner",
    });
    expect(edipiClaims.has(hashEdipi("7777777777"))).toBe(false);

    const attackerAttempt = await enroll(handlers, "7777777777", await exportPublicKeyHex(attackerKeyPair.publicKey), "attacker", "attacker-device");
    expect(attackerAttempt.statusCode).toBe(409);

    // The actual legacy owner can still enroll a new device under their
    // own already-(legacy-)claimed EDIPI.
    const legacyOwnerNewDevice = await enroll(handlers, "7777777777", await exportPublicKeyHex((await generateKeyPair()).publicKey), "legacy-owner", "legacy-owners-second-device");
    expect(legacyOwnerNewDevice.statusCode).toBe(200);
  });

  it("re-enrolling the same device replaces its key rather than adding a second enrollment (ON CONFLICT (device_id) DO UPDATE)", async () => {
    const handlers = captureHandlers();
    const oldKeyPair = await generateKeyPair();
    const newKeyPair = await generateKeyPair();
    const oldPublicKeyHex = await exportPublicKeyHex(oldKeyPair.publicKey);
    const newPublicKeyHex = await exportPublicKeyHex(newKeyPair.publicKey);

    expect((await enroll(handlers, "1234567890", oldPublicKeyHex, "same-user", "same-device")).statusCode).toBe(200);
    expect((await enroll(handlers, "1234567890", newPublicKeyHex, "same-user", "same-device")).statusCode).toBe(200);

    // The superseded key must no longer verify — it should behave as if it
    // was never enrolled, not as a second still-valid credential.
    const { challenge, challengeId } = await getChallenge(handlers, "1234567890");
    const oldSignature = await signChallenge(challenge, oldKeyPair.privateKey);
    const oldReq = fakeReq({ challengeId, edipi: "1234567890", authMethod: "software_cert", publicKeyHex: oldPublicKeyHex, signature: oldSignature });
    const oldRes = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(oldReq, oldRes);
    expect(oldRes.statusCode).toBe(401);

    // The new key, which replaced it on the same device, verifies normally.
    const { challenge: challenge2, challengeId: challengeId2 } = await getChallenge(handlers, "1234567890");
    const newSignature = await signChallenge(challenge2, newKeyPair.privateKey);
    const newReq = fakeReq({ challengeId: challengeId2, edipi: "1234567890", authMethod: "software_cert", publicKeyHex: newPublicKeyHex, signature: newSignature });
    const newRes = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(newReq, newRes);
    expect(newRes.statusCode).toBe(200);
  });
});

describe("GET /api/auth/cac/status", () => {
  beforeEach(() => {
    enrolledCerts.length = 0;
    edipiClaims.clear();
  });

  it("stores the EDIPI encrypted at rest but returns it decrypted to its own enrolled owner", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    expect((await enroll(handlers, "1234567890", await exportPublicKeyHex(keyPair.publicKey), "status-user")).statusCode).toBe(200);

    // The row this mock is standing in for a real database row now holds:
    // never the plaintext EDIPI, and never even a substring of it.
    expect(enrolledCerts).toHaveLength(1);
    expect(enrolledCerts[0].encryptedEdipi).not.toBe("1234567890");
    expect(enrolledCerts[0].encryptedEdipi).not.toContain("1234567890");

    const res = fakeRes();
    await handlers.get("/api/auth/cac/status")!(fakeReq(undefined, "status-user"), res);
    expect(res.statusCode).toBe(200);
    const body = res.body as { enrolledDevices: { edipi: string; device_id: string }[] };
    expect(body.enrolledDevices).toEqual([{ edipi: "1234567890", device_id: expect.any(String) }]);
  });

  it("only returns the calling account's own enrolled devices", async () => {
    const handlers = captureHandlers();
    await enroll(handlers, "1111111111", await exportPublicKeyHex((await generateKeyPair()).publicKey), "owner-a", "device-a");
    await enroll(handlers, "2222222222", await exportPublicKeyHex((await generateKeyPair()).publicKey), "owner-b", "device-b");

    const res = fakeRes();
    await handlers.get("/api/auth/cac/status")!(fakeReq(undefined, "owner-a"), res);
    const body = res.body as { enrolledDevices: { device_id: string }[] };
    expect(body.enrolledDevices).toEqual([{ edipi: "1111111111", device_id: "device-a" }]);
  });
});
