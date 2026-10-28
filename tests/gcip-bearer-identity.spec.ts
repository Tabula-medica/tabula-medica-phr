import { describe, it, expect, vi } from "vitest";
vi.mock("../server/auth/gcip", () => ({ verifyAndResolveGcip: vi.fn() }));
import { createGcipBearerIdentity } from "../server/middleware/gcip-bearer-identity";

const run = async (mw: any, req: any) => {
  const next = vi.fn();
  const res: any = { status: vi.fn(() => res), json: vi.fn() };
  await mw(req, res, next);
  return { next, res };
};

describe("gcipBearerIdentity", () => {
  const user = { id: "u-1", email: "a@b.c", firstName: "A", lastName: "B" };

  it("fills req.user from a valid bearer token", async () => {
    const resolve = vi.fn().mockResolvedValue(user);
    const req: any = { headers: { authorization: "Bearer good" } };
    const { next, res } = await run(createGcipBearerIdentity(resolve), req);
    expect(resolve).toHaveBeenCalledWith("good");
    expect(req.user.claims.sub).toBe("u-1");
    expect(req.user.claims.provider).toBe("gcip");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("keeps an existing cookie-session user and skips verification", async () => {
    const resolve = vi.fn().mockResolvedValue(user);
    const req: any = { headers: { authorization: "Bearer other" }, user: { claims: { sub: "cookie-user" } } };
    await run(createGcipBearerIdentity(resolve), req);
    expect(resolve).not.toHaveBeenCalled();
    expect(req.user.claims.sub).toBe("cookie-user");
  });

  it("stays anonymous (no 401) for an invalid token", async () => {
    const resolve = vi.fn().mockResolvedValue(null);
    const req: any = { headers: { authorization: "Bearer bad" } };
    const { next, res } = await run(createGcipBearerIdentity(resolve), req);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("stays anonymous when verification throws", async () => {
    const resolve = vi.fn().mockRejectedValue(new Error("boom"));
    const req: any = { headers: { authorization: "Bearer x" } };
    const { next } = await run(createGcipBearerIdentity(resolve), req);
    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores non-bearer and empty headers", async () => {
    const resolve = vi.fn();
    for (const authorization of [undefined, "Basic abc", "Bearer ", "Bearer    "]) {
      const req: any = { headers: { authorization } };
      await run(createGcipBearerIdentity(resolve), req);
      expect(req.user).toBeUndefined();
    }
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe("my-audit-trail routes", () => {
  it("no longer exposes /_debug/raw-count", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("server/routes/my-audit-trail-routes.ts", "utf8");
    expect(src).not.toMatch(/_debug/);
  });
});