import { describe, it, expect, vi, beforeEach } from "vitest";
import { webcrypto } from "crypto";
import type { Request, Response } from "express";

/**
 * Fake `cac_software_certs` backing the mocked `db.execute` — just enough of
 * its shape (edipi, public_key_hex, expires_at) to support the enroll INSERT
 * and the verify handler's SELECT lookup, mirroring the real table without a
 * live database.
 */
const enrolledCerts: { edipi: string; publicKeyHex: string; expiresAt: number }[] = [];

vi.mock("../server/db", () => ({
  db: {
    execute: vi.fn(async (sql: string, params: unknown[] = []) => {
      const text = String(sql);
      if (text.includes("INSERT INTO cac_software_certs")) {
        const [edipi, , publicKeyHex] = params as string[]; // (edipi, deviceId, publicKeyHex, ...)
        enrolledCerts.push({ edipi, publicKeyHex, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 });
        return { rows: [] };
      }
      if (text.includes("SELECT public_key_hex FROM cac_software_certs")) {
        const [edipi, publicKeyHex] = params as string[];
        const match = enrolledCerts.find((c) => c.edipi === edipi && c.publicKeyHex === publicKeyHex && c.expiresAt > Date.now());
        return { rows: match ? [{ public_key_hex: match.publicKeyHex }] : [] };
      }
      if (text.includes("INSERT INTO audit_logs")) {
        return { rows: [] };
      }
      throw new Error(`db.execute mock: unhandled query: ${text}`);
    }),
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
 * generated on the spot — and (3) the EDIPI/authMethod match what the
 * challenge was originally issued for.
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

function fakeReq(body: unknown): Request {
  return { body, headers: {} } as Request;
}

async function getChallenge(handlers: ReturnType<typeof captureHandlers>, edipi = "1234567890", authMethod = "software_cert") {
  const res = fakeRes();
  await handlers.get("/api/auth/cac/challenge")!(fakeReq({ authMethod, edipi }), res);
  return res.body as { challenge: string; challengeId: string };
}

async function enroll(handlers: ReturnType<typeof captureHandlers>, edipi: string, publicKeyHex: string) {
  const res = fakeRes();
  await handlers.get("/api/auth/cac/enroll-software-cert")!(
    fakeReq({ publicKeyHex, edipi, deviceId: "test-device", platform: "test", platformVersion: "1" }),
    res,
  );
  expect(res.statusCode).toBe(200);
}

describe("POST /api/auth/cac/verify", () => {
  beforeEach(() => {
    enrolledCerts.length = 0;
  });

  it("mints a session only when the key is enrolled for this EDIPI and the signature over the challenge verifies", async () => {
    const handlers = captureHandlers();
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
    await enroll(handlers, "1234567890", publicKeyHex);

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
    // The second bug: proof of possession of *a* key proves nothing about
    // identity on its own — an attacker can generate their own key pair,
    // sign the challenge correctly, and assert any EDIPI. Nothing here was
    // ever enrolled, so this must be rejected even though the signature
    // itself is completely valid.
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
});
