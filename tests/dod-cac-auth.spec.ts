import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "crypto";
import type { Request, Response } from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

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

const enrolledCerts: { edipi: string; deviceId: string; publicKeyHex: string; expiresAt: number; enrolledByUserId: string }[] = [];
// edipi -> claimed_by_user_id, mirroring the real cac_edipi_claims table:
// a claim, once made, is never removed by this mock either.
const edipiClaims = new Map<string, string>();

vi.mock("../server/db", () => ({
  db: {
    execute: vi.fn(async (query: SQL) => {
      const { sql: text, params } = toQuery(query);
      if (text.includes("INSERT INTO cac_edipi_claims")) {
        const [claimEdipi, claimedByUserId] = params as string[];
        if (!edipiClaims.has(claimEdipi)) {
          edipiClaims.set(claimEdipi, claimedByUserId);
          return { rows: [{ claimed_by_user_id: claimedByUserId }] };
        }
        return { rows: [] }; // ON CONFLICT DO NOTHING — already claimed
      }
      if (text.includes("SELECT claimed_by_user_id FROM cac_edipi_claims")) {
        const [claimEdipi] = params as string[];
        const owner = edipiClaims.get(claimEdipi);
        return { rows: owner ? [{ claimed_by_user_id: owner }] : [] };
      }
      if (text.includes("INSERT INTO cac_software_certs")) {
        // NOW() in the template isn't a bound param, so the 8 columns map to
        // only 7 params here: edipi, deviceId, publicKeyHex, certJson,
        // platformInfo, expiresAt, enrolledByUserId (enrolled_at is NOW()).
        // A trailing 8th param is the WHERE clause's repeated enrolledByUserId.
        const [edipi, deviceId, publicKeyHex, , , , enrolledByUserId] = params as string[];
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
        const row = { edipi, deviceId, publicKeyHex, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, enrolledByUserId };
        if (existingIndex >= 0) {
          enrolledCerts[existingIndex] = row;
        } else {
          enrolledCerts.push(row);
        }
        return { rows: [{ device_id: deviceId }] };
      }
      if (text.includes("SELECT public_key_hex FROM cac_software_certs")) {
        const [edipi, publicKeyHex] = params as string[];
        const match = enrolledCerts.find((c) => c.edipi === edipi && c.publicKeyHex === publicKeyHex && c.expiresAt > Date.now());
        return { rows: match ? [{ public_key_hex: match.publicKeyHex }] : [] };
      }
      throw new Error(`db.execute mock: unhandled query: ${text}`);
    }),
    // hipaaComplianceService.logAuditEvent() writes via db.insert(...).values(...)
    // (Drizzle's fluent builder), not db.execute(sql\`...\`) — stubbed just
    // enough to resolve so the verify handler's audit call doesn't reject.
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue({ rows: [] }) })),
  },
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

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

  it("does not reject when both /challenge and /verify omit authMethod and rely on their (matching) defaults", async () => {
    // The default-mismatch bug: /challenge defaulted to cac_hardware while
    // /verify defaulted to software_cert, so any caller relying on both
    // defaults was always rejected even with an otherwise-perfect request.
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);

    const challengeRes = fakeRes();
    await handlers.get("/api/auth/cac/challenge")!(fakeReq({ edipi: "1234567890" }), challengeRes); // no authMethod
    const { challenge, challengeId } = challengeRes.body as { challenge: string; challengeId: string };
    const signature = await signChallenge(challenge, keyPair.privateKey);

    const req = fakeReq({ challengeId, edipi: "1234567890", publicKeyHex, signature }); // no authMethod here either
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(200);
  });
});

describe("POST /api/auth/cac/enroll-software-cert", () => {
  beforeEach(() => {
    enrolledCerts.length = 0;
    edipiClaims.clear();
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
    enrolledCerts.forEach((c) => {
      if (c.edipi === "1234567890") c.expiresAt = Date.now() - 1000; // simulate a lapsed cert
    });

    const attackerAttempt = await enroll(handlers, "1234567890", await exportPublicKeyHex(attackerKeyPair.publicKey), "attacker");
    expect(attackerAttempt.statusCode).toBe(409);
  });

  it("resolves a same-EDIPI enrollment race between two different accounts to exactly one winner", async () => {
    // The exclusivity check used to be a separate SELECT-then-INSERT
    // against cac_software_certs, so two concurrent enrollments could both
    // observe "unclaimed" and both succeed. It's now an atomic
    // INSERT ... ON CONFLICT (edipi) DO NOTHING against cac_edipi_claims,
    // whose PRIMARY KEY makes Postgres itself serialize the conflict.
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
