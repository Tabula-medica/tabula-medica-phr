import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_USER_ID, isDemoWriteBlocked } from "../shared/demo-account";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

describe("isDemoWriteBlocked", () => {
  it("never blocks a non-demo user, regardless of method", () => {
    expect(isDemoWriteBlocked("POST", "/api/patients", "real-user-1")).toBe(false);
    expect(isDemoWriteBlocked("DELETE", "/api/patients/1", undefined)).toBe(false);
  });

  it("never blocks GET/HEAD/OPTIONS for the demo user", () => {
    expect(isDemoWriteBlocked("GET", "/api/patients", DEMO_USER_ID)).toBe(false);
    expect(isDemoWriteBlocked("HEAD", "/api/patients", DEMO_USER_ID)).toBe(false);
    expect(isDemoWriteBlocked("OPTIONS", "/api/patients", DEMO_USER_ID)).toBe(false);
    // Method matching is case-insensitive.
    expect(isDemoWriteBlocked("get", "/api/patients", DEMO_USER_ID)).toBe(false);
  });

  it("blocks a mutating request from the demo user to an arbitrary path", () => {
    expect(isDemoWriteBlocked("POST", "/api/medications", DEMO_USER_ID)).toBe(true);
    expect(isDemoWriteBlocked("PATCH", "/api/patients/1", DEMO_USER_ID)).toBe(true);
    expect(isDemoWriteBlocked("DELETE", "/api/documents/1", DEMO_USER_ID)).toBe(true);
  });

  it("allows the explicit read-only POST allowlist (search) for the demo user", () => {
    expect(isDemoWriteBlocked("POST", "/api/search", DEMO_USER_ID)).toBe(false);
    expect(isDemoWriteBlocked("POST", "/api/search/voice", DEMO_USER_ID)).toBe(false);
    expect(isDemoWriteBlocked("POST", "/api/smart-search", DEMO_USER_ID)).toBe(false);
  });

  it("does not allowlist unrelated paths that merely start with an allowed prefix", () => {
    // Exact-path match only — "/api/search/save" must not slip through
    // because "/api/search" is allowed.
    expect(isDemoWriteBlocked("POST", "/api/search/save", DEMO_USER_ID)).toBe(true);
  });
});

describe("demo account wiring", () => {
  it("gates the demo session mint, the boot-time seed, and admin seeding behind an explicit opt-in flag", () => {
    const authSource = read("server/replit_integrations/auth/replitAuth.ts");
    expect(authSource).toContain('app.post("/api/auth/demo-session"');
    expect(authSource).toContain('process.env.DEMO_ACCOUNT_ENABLED !== "1"');
    expect(authSource).toContain("isDemoWriteBlocked(req.method, req.path");

    const seedSource = read("server/seed-demo-account.ts");
    expect(seedSource).toContain('process.env.DEMO_ACCOUNT_ENABLED !== "1"');
    expect(seedSource).toContain("SYNTHETIC");
  });

  it("rate-limits the demo session endpoint the same as every other session-minting endpoint", () => {
    const source = read("server/security/api-protection.ts");
    expect(source).toContain('app.use("/api/auth/demo-session", sessionExchangeRateLimiter);');
  });

  it("seeds the demo account at boot alongside the admin seed, not as a one-off manual script", () => {
    const source = read("server/index.ts");
    expect(source).toContain('await import("./seed-demo-account")');
  });
});
