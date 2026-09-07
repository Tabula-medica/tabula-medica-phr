// ABDM lib (mirrored from WorldEHR) — crypto round-trip, gateway stub, fetch passthrough.
import { describe, it, expect } from "vitest";
import { generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { rsaEncrypt } from "../server/abdm/crypto";
import { getAbdmSession, abdmHeaders } from "../server/abdm/gateway";
import { abdmFetch } from "../server/abdm/fetch";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();

describe("abdm crypto", () => {
  it("OAEP-SHA1 round-trips", () => {
    const ct = rsaEncrypt(pubPem, "1234-5678-9012", "oaep-sha1");
    const pt = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" }, Buffer.from(ct, "base64")).toString();
    expect(pt).toBe("1234-5678-9012");
  });
});

describe("abdm gateway (stub)", () => {
  it("returns a synthetic bearer session when disabled", async () => {
    const s = await getAbdmSession(0);
    expect(s).toMatchObject({ accessToken: "stub-abdm-token", tokenType: "bearer", source: "stub" });
  });
  it("builds v3 headers", () => {
    const h = abdmHeaders(0, "tok");
    expect(h.Authorization).toBe("Bearer tok");
    expect(h["X-CM-ID"]).toBe("sbx");
    expect(h["REQUEST-ID"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("abdmFetch", () => {
  it("delegates to plain fetch (no dispatcher) with no proxy configured", async () => {
    const orig = globalThis.fetch;
    let seen: { i: { dispatcher?: unknown } | undefined } | undefined;
    globalThis.fetch = (async (_u: unknown, i: unknown) => { seen = { i: i as { dispatcher?: unknown } }; return new Response("ok"); }) as typeof fetch;
    try { await abdmFetch("https://example.test", { method: "GET" }); }
    finally { globalThis.fetch = orig; }
    expect(seen?.i?.dispatcher).toBeUndefined();
  });
});
