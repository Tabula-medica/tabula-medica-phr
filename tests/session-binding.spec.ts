/* eslint-disable @typescript-eslint/no-explicit-any -- request/response test doubles */
import { describe, it, expect } from "vitest";
import {
  networkPrefix,
  fingerprintRequest,
  evaluateBinding,
  sessionBindingMiddleware,
  type SessionFingerprint,
} from "../server/security/session-binding";

function req(overrides: Partial<{ ua: string; ip: string; xff: string; country: string; sub: string; path: string; session: any }> = {}): any {
  const headers: Record<string, string> = { "user-agent": overrides.ua ?? "Mozilla/5.0 (iPhone) Safari" };
  if (overrides.xff) headers["x-forwarded-for"] = overrides.xff;
  return {
    path: overrides.path ?? "/api/patients/me",
    method: "GET",
    headers,
    ip: overrides.ip ?? "198.51.100.23",
    socket: {},
    country: overrides.country,
    user: overrides.sub === "" ? undefined : { claims: { sub: overrides.sub ?? "user-1" } },
    session: overrides.session ?? {},
  };
}

function res() {
  let code = 200;
  let body: any;
  const r: any = {
    status: (c: number) => { code = c; return r; },
    json: (b: unknown) => { body = b; return r; },
  };
  return { r, code: () => code, body: () => body };
}

describe("session-binding — network prefix", () => {
  it("collapses IPv4 to /24 and IPv6 to /64, tolerating v4-mapped v6", () => {
    expect(networkPrefix("198.51.100.23")).toBe("198.51.100.0/24");
    expect(networkPrefix("::ffff:198.51.100.99")).toBe("198.51.100.0/24");
    expect(networkPrefix("2001:db8:85a3:8d3:1319:8a2e:370:7348")).toBe("2001:db8:85a3:8d3::/64");
    expect(networkPrefix(undefined)).toBe("unknown");
  });
});

describe("session-binding — verdicts", () => {
  const base: SessionFingerprint = fingerprintRequest(req({ country: "US" }), 1000);

  it("same device, same network → no anomaly", () => {
    expect(evaluateBinding(base, fingerprintRequest(req({ country: "US", ip: "198.51.100.77" })))).toEqual({ anomaly: false, severity: "none", reasons: [] });
  });

  it("network change alone → medium (roaming is legitimate)", () => {
    const v = evaluateBinding(base, fingerprintRequest(req({ country: "US", ip: "203.0.113.9" })));
    expect(v.severity).toBe("medium");
    expect(v.reasons).toEqual(["network_changed"]);
  });

  it("user-agent change → high", () => {
    const v = evaluateBinding(base, fingerprintRequest(req({ country: "US", ua: "curl/8.0" })));
    expect(v.severity).toBe("high");
    expect(v.reasons).toContain("user_agent_changed");
  });

  it("country change → high; unknown country never counts", () => {
    expect(evaluateBinding(base, fingerprintRequest(req({ country: "RU" }))).reasons).toContain("country_changed");
    expect(evaluateBinding(base, fingerprintRequest(req({ country: undefined }))).reasons).not.toContain("country_changed");
  });

  it("uses the first X-Forwarded-For hop", () => {
    const fp = fingerprintRequest(req({ xff: "203.0.113.1, 10.0.0.2", ip: "10.0.0.2" }));
    expect(fp.netHash).toBe(fingerprintRequest(req({ ip: "203.0.113.5" })).netHash);
  });
});

describe("session-binding — middleware", () => {
  it("binds on first authenticated request and passes through", () => {
    const session: any = {};
    const r = req({ session, country: "US" });
    let next = false;
    sessionBindingMiddleware({ mode: "enforce" })(r, res().r, () => { next = true; });
    expect(next).toBe(true);
    expect(session.tmBinding?.uaHash).toHaveLength(16);
  });

  it("ignores anonymous requests", () => {
    const session: any = {};
    let next = false;
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, sub: "" }), res().r, () => { next = true; });
    expect(next).toBe(true);
    expect(session.tmBinding).toBeUndefined();
  });

  it("monitor mode logs but allows a hijack-shaped request", () => {
    const session: any = {};
    sessionBindingMiddleware({ mode: "monitor" })(req({ session, country: "US" }), res().r, () => {});
    let next = false;
    sessionBindingMiddleware({ mode: "monitor" })(req({ session, country: "RU", ua: "curl/8.0" }), res().r, () => { next = true; });
    expect(next).toBe(true);
  });

  it("enforce mode destroys the session and returns 401 on a high anomaly", () => {
    let destroyed = false;
    const session: any = { destroy: (cb: () => void) => { destroyed = true; cb(); } };
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US" }), res().r, () => {});
    const out = res();
    let next = false;
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US", ua: "curl/8.0" }), out.r, () => { next = true; });
    expect(next).toBe(false);
    expect(destroyed).toBe(true);
    expect(out.code()).toBe(401);
    expect(out.body().error).toBe("SESSION_REBIND_REQUIRED");
    expect(out.body().reasons).toEqual(["user_agent_changed"]);
  });

  it("enforce mode never terminates on network change alone and adopts the new network", () => {
    const session: any = { destroy: () => { throw new Error("should not destroy"); } };
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US", ip: "198.51.100.1" }), res().r, () => {});
    let next = false;
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US", ip: "203.0.113.1" }), res().r, () => { next = true; });
    expect(next).toBe(true);
    const after = session.tmBinding.netHash;
    let next2 = false;
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US", ip: "203.0.113.200" }), res().r, () => { next2 = true; });
    expect(next2).toBe(true);
    expect(session.tmBinding.netHash).toBe(after);
  });

  it("skips excluded paths such as logout", () => {
    const session: any = { destroy: () => { throw new Error("should not destroy"); } };
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US" }), res().r, () => {});
    let next = false;
    sessionBindingMiddleware({ mode: "enforce" })(req({ session, country: "US", ua: "curl", path: "/api/logout" }), res().r, () => { next = true; });
    expect(next).toBe(true);
  });
});
