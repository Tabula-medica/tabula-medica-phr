import { describe, it, expect, vi } from "vitest";
import { webcrypto } from "crypto";
import type { Request, Response } from "express";

vi.mock("../server/db", () => ({
  db: { execute: vi.fn().mockResolvedValue({ rows: [] }) },
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

import { registerDoDRoutes } from "../server/dod-routes";

/**
 * The /api/auth/cac/verify handler used to mint a fully "authenticated"
 * session (including IAL3 assurance) for anyone who called it with any
 * body at all — signature, certDerBase64, and publicKeyHex were destructured
 * but never checked; `signatureValid: true` was hardcoded. This spec proves
 * the fix: a session only mints when the caller can produce a real ECDSA
 * P-384 signature (matching client/lib/fips-crypto.ts's exact algorithm)
 * over the challenge from the public key they're asserting.
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

async function getChallenge(handlers: ReturnType<typeof captureHandlers>, edipi = "1234567890") {
  const res = fakeRes();
  await handlers.get("/api/auth/cac/challenge")!(fakeReq({ authMethod: "software_cert", edipi }), res);
  return res.body as { challenge: string; challengeId: string };
}

describe("POST /api/auth/cac/verify", () => {
  it("mints a session only when the ECDSA signature over the challenge verifies against the claimed public key", async () => {
    const handlers = captureHandlers();
    const { challenge, challengeId } = await getChallenge(handlers);
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
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

  it("rejects a signature that doesn't match the claimed public key", async () => {
    const handlers = captureHandlers();
    const { challenge, challengeId } = await getChallenge(handlers);
    const signerKeyPair = await generateKeyPair();
    const impostorKeyPair = await generateKeyPair();
    const signature = await signChallenge(challenge, signerKeyPair.privateKey);
    const mismatchedPublicKeyHex = await exportPublicKeyHex(impostorKeyPair.publicKey);

    const req = fakeReq({
      challengeId,
      edipi: "1234567890",
      authMethod: "software_cert",
      publicKeyHex: mismatchedPublicKeyHex,
      signature,
    });
    const res = fakeRes();
    await handlers.get("/api/auth/cac/verify")!(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects a signature over the wrong data — tampering with the challenge after signing", async () => {
    const handlers = captureHandlers();
    const { challengeId } = await getChallenge(handlers);
    const keyPair = await generateKeyPair();
    const publicKeyHex = await exportPublicKeyHex(keyPair.publicKey);
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
});
