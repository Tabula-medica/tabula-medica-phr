/**
 * MCP server — session P1-a acceptance.
 *
 * Covers the auth gates from docs/agent-protocols-strategy.md §3.2 for the
 * two zero-PHI tools: missing / invalid / expired bearer → 401 with the
 * resource-metadata pointer; SMART scope parsing and the scope-to-resource
 * matrix; feature flag off → nothing mounted; a real MCP client round-trip
 * (initialize → tools/list → tools/call) over Streamable HTTP; one
 * `logPhiAccess` row per tool call; per-client rate limiting.
 *
 * Auth0 verification and the audit sink are mocked. Everything between them —
 * the SDK bearer middleware, transport, tool registration, and catalog /
 * glossary lookups — is real.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const NOW = Math.floor(Date.now() / 1000);

interface FakeToken {
  sub: string;
  said: string | null;
  scope: string;
  azp: string;
  exp: number;
}

const TOKENS: Record<string, FakeToken> = {
  "patient-token": { sub: "auth0|patient-1", said: "SAID-0001", scope: "openid patient/*.read", azp: "claude-desktop", exp: NOW + 3600 },
  "expired-token": { sub: "auth0|patient-1", said: "SAID-0001", scope: "patient/*.read", azp: "claude-desktop", exp: NOW - 60 },
  "noscope-token": { sub: "auth0|patient-2", said: null, scope: "", azp: "some-host", exp: NOW + 3600 },
};

vi.mock("../../server/middleware/auth0-jwt-verify", () => ({
  isAuth0Configured: () => true,
  AUTH0_JWT_CONFIG: {
    issuerBaseUrl: "https://tabulamedica-test.us.auth0.com",
    audience: "https://api.tabulamedica.test",
    issuer: "https://tabulamedica-test.us.auth0.com/",
    jwksUri: "https://tabulamedica-test.us.auth0.com/.well-known/jwks.json",
    claims: {},
  },
  verifyAuth0AccessToken: vi.fn(async (token: string) => {
    const t = TOKENS[token];
    if (!t) return null;
    return {
      sub: t.sub,
      saidPatientId: t.said,
      fhirSources: [],
      hasNoMiddleName: false,
      segment: "patient",
      phiAccess: true,
      orgId: null,
      rawClaims: { sub: t.sub, scope: t.scope, azp: t.azp, exp: t.exp },
    };
  }),
}));

vi.mock("../../server/security/hipaa-audit", () => ({
  logPhiAccess: vi.fn(async () => undefined),
}));

const { logPhiAccess } = await import("../../server/security/hipaa-audit");
const { parseSmartScope, parseScopeClaim, smartScopeAllows, principalFromAuthInfo } = await import("../../server/mcp/auth");
const mcp = await import("../../server/mcp");

function makeApp(env: Record<string, string | undefined>) {
  const previous: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    previous[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const app = express();
  app.use(express.json());
  const mounted = mcp.registerMcpRoutes(app);
  for (const [k, v] of Object.entries(previous)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return { app, mounted };
}

async function listen(app: express.Express): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

async function connectClient(baseUrl: string, token: string): Promise<Client> {
  const client = new Client({ name: "p1a-test-host", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

describe("SMART scope parsing", () => {
  it("parses v1 and v2 scope syntax", () => {
    expect(parseSmartScope("patient/Observation.read")?.permissions).toEqual(new Set(["r", "s"]));
    expect(parseSmartScope("patient/*.read")?.resourceType).toBe("*");
    expect(parseSmartScope("patient/Observation.rs")?.permissions).toEqual(new Set(["r", "s"]));
    expect(parseSmartScope("user/Condition.cruds")?.permissions.size).toBe(5);
    expect(parseSmartScope("patient/Observation.rs?category=laboratory")?.resourceType).toBe("Observation");
    expect(parseSmartScope("openid")).toBeNull();
    expect(parseSmartScope("patient/Observation.execute")).toBeNull();
    expect(parseSmartScope("launch/patient")).toBeNull();
  });

  it("reads space-delimited and array scope claims", () => {
    expect(parseScopeClaim("openid  patient/*.read offline_access")).toEqual(["openid", "patient/*.read", "offline_access"]);
    expect(parseScopeClaim(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(parseScopeClaim(undefined)).toEqual([]);
  });

  it.each([
    [["patient/*.read"], "Observation", "read", true],
    [["patient/*.read"], "Observation", "search", true],
    [["patient/*.read"], "Observation", "write", false],
    [["patient/Observation.read"], "Observation", "read", true],
    [["patient/Observation.read"], "Condition", "read", false],
    [["patient/Observation.r"], "Observation", "search", false],
    [["patient/Observation.rs"], "Observation", "search", true],
    [["patient/Observation.c"], "Observation", "read", false],
    [["patient/*.cruds"], "MedicationRequest", "write", true],
    [["openid", "offline_access"], "Patient", "read", false],
    [[], "Patient", "read", false],
  ] as const)("scope matrix %j on %s.%s → %s", (scopes, resource, access, expected) => {
    expect(smartScopeAllows(scopes, resource, access)).toBe(expected);
  });

  it("never fabricates a principal", () => {
    expect(() => principalFromAuthInfo(undefined)).toThrow(/authenticated principal/);
    expect(() => principalFromAuthInfo({ token: "t", clientId: "c", scopes: [], extra: {} })).toThrow(/authenticated principal/);
    const p = principalFromAuthInfo({
      token: "t",
      clientId: "c",
      scopes: ["patient/*.read"],
      extra: { sub: "auth0|x", saidPatientId: "SAID-9", phiAccess: true },
    });
    expect(p).toMatchObject({ userId: "auth0|x", clientId: "c", patientId: "SAID-9", phiAccess: true });
  });
});

describe("feature flag", () => {
  it("mounts nothing unless MCP_SERVER_ENABLED=true", async () => {
    const { app, mounted } = makeApp({ MCP_SERVER_ENABLED: undefined });
    expect(mounted).toBe(false);
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      expect(res.status).toBe(404);
      const meta = await fetch(`${url}/.well-known/oauth-protected-resource`);
      expect(meta.status).toBe(404);
    } finally {
      server.close();
    }
  });
});

describe("MCP server (flag on)", () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    const { app, mounted } = makeApp({
      MCP_SERVER_ENABLED: "true",
      MCP_RESOURCE_URL: "https://phr.example.test/mcp",
    });
    expect(mounted).toBe(true);
    ({ server, url } = await listen(app));
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    vi.mocked(logPhiAccess).mockClear();
  });

  it("publishes protected-resource metadata pointing at Auth0", async () => {
    const res = await fetch(`${url}/.well-known/oauth-protected-resource/mcp`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resource).toBe("https://phr.example.test/mcp");
    expect(body.authorization_servers).toEqual(["https://tabulamedica-test.us.auth0.com/"]);
    expect(body.scopes_supported).toContain("patient/*.read");
    expect(body.bearer_methods_supported).toEqual(["header"]);

    const root = await fetch(`${url}/.well-known/oauth-protected-resource`);
    expect(root.status).toBe(200);
  });

  it("rejects a missing bearer token with 401 + resource_metadata pointer", async () => {
    const res = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    const www = res.headers.get("www-authenticate") ?? "";
    expect(www).toMatch(/^Bearer /);
    expect(www).toContain('error="invalid_token"');
    expect(www).toContain('resource_metadata="https://phr.example.test/.well-known/oauth-protected-resource/mcp"');
    expect(logPhiAccess).not.toHaveBeenCalled();
  });

  it.each([
    ["garbage", "not-a-real-token"],
    ["expired", "expired-token"],
  ])("rejects an %s token with 401", async (_label, token) => {
    const res = await fetch(`${url}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("answers GET and DELETE with 405 (stateless transport)", async () => {
    const get = await fetch(`${url}/mcp`);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    const del = await fetch(`${url}/mcp`, { method: "DELETE" });
    expect(del.status).toBe(405);
  });

  it("lists exactly the P1-a tools for an authenticated host", async () => {
    const client = await connectClient(url, "patient-token");
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...mcp.MCP_TOOL_NAMES].sort());
      for (const tool of tools) {
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.inputSchema).toBeDefined();
      }
    } finally {
      await client.close();
    }
  });

  it("glossary_lookup defines a term and writes one audit row with the client id", async () => {
    const client = await connectClient(url, "patient-token");
    try {
      const result = await client.callTool({ name: "glossary_lookup", arguments: { term: "a1c" } });
      expect(result.isError).toBeFalsy();
      const structured = result.structuredContent as { found: boolean; term?: string; category?: string };
      expect(structured.found).toBe(true);
      expect(structured.term).toBe("Hemoglobin A1C");
      expect(structured.category).toBe("lab");

      expect(logPhiAccess).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logPhiAccess).mock.calls[0][0]).toMatchObject({
        userId: "auth0|patient-1",
        userRole: "mcp-client",
        resourceType: "GlossaryTerm",
        action: "read",
        requestPath: "/mcp",
        userAgent: "mcp-client:claude-desktop",
        details: "MCP tool glossary_lookup (success) by client claude-desktop",
      });
      // Zero-PHI tool: no patient id on the row, and the looked-up term is not recorded.
      expect(vi.mocked(logPhiAccess).mock.calls[0][0].patientId).toBeUndefined();
      expect(JSON.stringify(vi.mocked(logPhiAccess).mock.calls[0][0])).not.toContain("a1c");
    } finally {
      await client.close();
    }
  });

  it("glossary_lookup reports an unknown term without erroring", async () => {
    const client = await connectClient(url, "patient-token");
    try {
      const result = await client.callTool({ name: "glossary_lookup", arguments: { term: "zzqx" } });
      expect(result.isError).toBeFalsy();
      expect((result.structuredContent as { found: boolean }).found).toBe(false);
      expect(logPhiAccess).toHaveBeenCalledTimes(1);
    } finally {
      await client.close();
    }
  });

  it("care_access_lookup filters by state and service, takes no patient identifiers", async () => {
    const client = await connectClient(url, "patient-token");
    try {
      const result = await client.callTool({
        name: "care_access_lookup",
        arguments: { state: "tx", service: "MRI knee", cptCodes: ["80061"] },
      });
      expect(result.isError).toBeFalsy();
      const structured = result.structuredContent as {
        query: { state: string | null; cptCodes: string[] };
        medicareRates: Array<{ cptCode: string; savingsAmount: number }>;
        imagingServices: Array<{ id: string }>;
        discountProviders: Array<{ state: string; type: string }>;
        communityResources: unknown[];
        disclaimer: string;
      };
      expect(structured.query.state).toBe("TX");
      expect(structured.query.cptCodes).toEqual(["80061"]);
      expect(structured.medicareRates.some((r) => r.cptCode === "80061")).toBe(true);
      expect(structured.medicareRates.some((r) => r.cptCode === "73721")).toBe(true); // MRI knee by text
      expect(structured.medicareRates.every((r) => r.savingsAmount > 0)).toBe(true);
      expect(structured.imagingServices.map((s) => s.id)).toContain("mri-knee");
      expect(structured.discountProviders.length).toBeGreaterThan(0);
      expect(structured.discountProviders.every((p) => p.state === "TX")).toBe(true);
      expect(structured.discountProviders.every((p) => p.type === "Imaging")).toBe(true);
      expect(structured.communityResources.length).toBeGreaterThan(5);
      expect(structured.disclaimer).toMatch(/not medical advice/i);

      expect(logPhiAccess).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logPhiAccess).mock.calls[0][0]).toMatchObject({
        resourceType: "CareAccessCatalog",
        details: "MCP tool care_access_lookup (success) by client claude-desktop",
      });
    } finally {
      await client.close();
    }
  });

  it("care_access_lookup rejects a malformed state code at the schema", async () => {
    const client = await connectClient(url, "patient-token");
    try {
      const result = await client.callTool({ name: "care_access_lookup", arguments: { state: "Texas" } });
      expect(result.isError).toBe(true);
      expect(logPhiAccess).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it("zero-PHI tools work for a token with no SMART scopes", async () => {
    const client = await connectClient(url, "noscope-token");
    try {
      const result = await client.callTool({ name: "glossary_lookup", arguments: { term: "eGFR" } });
      expect(result.isError).toBeFalsy();
      expect(vi.mocked(logPhiAccess).mock.calls[0][0]).toMatchObject({
        userId: "auth0|patient-2",
        userAgent: "mcp-client:some-host",
      });
    } finally {
      await client.close();
    }
  });
});

describe("per-client rate limit", () => {
  it("returns a JSON-RPC 429 once the client's minute budget is spent", async () => {
    const { app } = makeApp({ MCP_SERVER_ENABLED: "true", MCP_RATE_LIMIT_PER_MINUTE: "2" });
    const { server, url } = await listen(app);
    try {
      const post = () =>
        fetch(`${url}/mcp`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            authorization: "Bearer patient-token",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
        });
      expect((await post()).status).toBe(200);
      expect((await post()).status).toBe(200);
      const third = await post();
      expect(third.status).toBe(429);
      const body = await third.json();
      expect(body.error.code).toBe(-32000);
    } finally {
      server.close();
    }
  });
});
