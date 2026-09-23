import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("../server/security/hipaa-audit", () => ({
  logPhiAccess: vi.fn(),
}));

const { atsSecurityHeaders } = await import("../server/security/mobile-security");

const dockerfileUrl = new URL("../Dockerfile", import.meta.url);
const gcipSourceUrl = new URL("../client/src/lib/gcip.ts", import.meta.url);

function collectSecurityHeaders(nodeEnv: string) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  const headers = new Map<string, string>();
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
  const next = vi.fn();

  try {
    atsSecurityHeaders({} as any, res as any, next);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }

  expect(next).toHaveBeenCalledOnce();
  return headers;
}

function parseCsp(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const directive of csp.split(";").map((part) => part.trim()).filter(Boolean)) {
    const [name, ...values] = directive.split(/\s+/);
    directives.set(name, values);
  }
  return directives;
}

describe("GCIP auth deployment configuration", () => {
  it("allows Firebase and federated auth endpoints in the production CSP", () => {
    const headers = collectSecurityHeaders("production");
    const csp = headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();

    const directives = parseCsp(csp!);
    expect(directives.get("connect-src")).toEqual(
      expect.arrayContaining([
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://united-planet-485003-n7-9f345.firebaseapp.com",
      ]),
    );
    expect(directives.get("frame-src")).toEqual(
      expect.arrayContaining([
        "https://united-planet-485003-n7-9f345.firebaseapp.com",
        "https://accounts.google.com",
        "https://appleid.apple.com",
      ]),
    );
    expect(directives.get("form-action")).toEqual(
      expect.arrayContaining([
        "https://united-planet-485003-n7-9f345.firebaseapp.com",
        "https://accounts.google.com",
        "https://appleid.apple.com",
      ]),
    );

    expect(directives.get("connect-src")).not.toEqual(
      expect.arrayContaining(["ws://localhost:*", "wss://localhost:*", "ws://127.0.0.1:*"]),
    );
  });

  it("bakes the Vite GCIP client config before the Docker build step", async () => {
    const [dockerfile, gcipSource] = await Promise.all([
      readFile(dockerfileUrl, "utf8"),
      readFile(gcipSourceUrl, "utf8"),
    ]);

    const buildIndex = dockerfile.indexOf("npm run build");
    expect(buildIndex).toBeGreaterThan(-1);

    const expectedEnv = {
      VITE_GCIP_API_KEY: "AIzaSyBCCtuVajEza6yHonlkz8XkVQJjIgAMS9o",
      VITE_GCIP_AUTH_DOMAIN: "united-planet-485003-n7-9f345.firebaseapp.com",
      VITE_GCIP_PROJECT_ID: "united-planet-485003-n7-9f345",
    };

    for (const [name, value] of Object.entries(expectedEnv)) {
      const envLine = `ENV ${name}=${value}`;
      const envIndex = dockerfile.indexOf(envLine);
      expect(envIndex, `${envLine} should be present`).toBeGreaterThan(-1);
      expect(envIndex, `${envLine} should be before npm run build`).toBeLessThan(buildIndex);
      expect(gcipSource).toContain(`import.meta.env.${name}`);
    }
  });
});
