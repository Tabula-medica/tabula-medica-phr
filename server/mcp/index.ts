/**
 * Tabula Medica MCP server — Phase 1, read-only (docs/agent-protocols-strategy.md §4).
 *
 * Transport: MCP Streamable HTTP at `POST /mcp`, stateless (one McpServer +
 * transport per request, no server-side session). Every request is bearer
 * authenticated against Auth0 before the JSON-RPC body is even parsed by the
 * SDK; the well-known resource metadata tells hosts where to authorize.
 *
 * Feature flag: `MCP_SERVER_ENABLED=true`. Default off in every environment
 * until the "Connected AI assistants" consent card ships (session P1-d).
 *
 * Session P1-a registers the two zero-PHI tools. PHI tools (P1-b, P1-c) add
 * their `registerXTool(server)` call in `createMcpServer` below and must
 * (1) check `smartScopeAllows` before reading, (2) run inside `runAuditedTool`,
 * and (3) reach any model only through `server/services/ai-provider.ts`.
 */
import type { Express, Request, Response } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AUTH0_JWT_CONFIG, isAuth0Configured } from "../middleware/auth0-jwt-verify";
import { logger } from "../utils/logger";
import { createMcpBearerAuth } from "./auth";
import { registerGlossaryTool, GLOSSARY_TOOL_NAME } from "./tools/glossary";
import { registerCareAccessTool, CARE_ACCESS_TOOL_NAME } from "./tools/care-access";

export const MCP_SERVER_INFO = { name: "tabula-medica-phr", version: "0.1.0" } as const;

export const MCP_PATH = "/mcp";

/** Tools registered on every server instance, in manifest order. */
export const MCP_TOOL_NAMES = [GLOSSARY_TOOL_NAME, CARE_ACCESS_TOOL_NAME] as const;

/**
 * SMART scopes this resource server understands. Phase 1 tools that read PHI
 * (P1-b/P1-c) check these; the zero-PHI tools shipped in P1-a need none.
 */
export const MCP_SCOPES_SUPPORTED = [
  "openid",
  "offline_access",
  "patient/*.read",
  "patient/Patient.read",
  "patient/Observation.read",
  "patient/DiagnosticReport.read",
  "patient/Condition.read",
  "patient/MedicationRequest.read",
  "patient/AllergyIntolerance.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/Encounter.read",
  "patient/DocumentReference.read",
] as const;

const DEFAULT_RESOURCE_URL = "https://tabulamedica.us/mcp";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

export function isMcpServerEnabled(): boolean {
  return process.env.MCP_SERVER_ENABLED === "true";
}

/** Canonical URL of this MCP endpoint, used as the OAuth resource identifier (RFC 8707). */
export function getMcpResourceUrl(): string {
  if (process.env.MCP_RESOURCE_URL) return process.env.MCP_RESOURCE_URL;
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  return base ? `${base}${MCP_PATH}` : DEFAULT_RESOURCE_URL;
}

export function getMcpResourceMetadataUrl(): string {
  const resource = new URL(getMcpResourceUrl());
  return new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource).href;
}

/** RFC 9728 protected-resource metadata. Public, cacheable, no PHI. */
export function buildProtectedResourceMetadata() {
  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [AUTH0_JWT_CONFIG.issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [...MCP_SCOPES_SUPPORTED],
    resource_name: "Tabula Medica PHR",
    resource_documentation:
      "https://github.com/Tabula-medica/tabula-medica-phr/blob/main/docs/agent-protocols-strategy.md",
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: { tools: {} },
    instructions:
      "Tabula Medica personal health record. Tools are read-only. Definitions and pricing are general " +
      "information, not medical or financial advice. Patient-record tools require SMART scopes the patient granted.",
  });
  registerGlossaryTool(server);
  registerCareAccessTool(server);
  return server;
}

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });
}

/**
 * Mounts `/mcp` and the well-known metadata. Returns false (and mounts
 * nothing) when the feature flag is off or Auth0 is not configured, so the
 * endpoint can never come up unauthenticated.
 */
export function registerMcpRoutes(app: Express): boolean {
  if (!isMcpServerEnabled()) {
    console.log("[MCP] MCP_SERVER_ENABLED is not \"true\" — /mcp not mounted.");
    return false;
  }
  if (!isAuth0Configured()) {
    console.warn("[MCP] MCP_SERVER_ENABLED=true but AUTH0_ISSUER_BASE_URL / AUTH0_AUDIENCE are unset — /mcp not mounted (fail closed).");
    return false;
  }

  // Resolved once at mount: the resource identifier is deployment config, not per-request state.
  const resourceMetadataUrl = getMcpResourceMetadataUrl();
  const protectedResourceMetadata = buildProtectedResourceMetadata();
  const bearerAuth = createMcpBearerAuth(resourceMetadataUrl);

  const perMinute = Number.parseInt(process.env.MCP_RATE_LIMIT_PER_MINUTE ?? "", 10);
  const clientRateLimiter = rateLimit({
    windowMs: 60_000,
    max: Number.isFinite(perMinute) && perMinute > 0 ? perMinute : DEFAULT_RATE_LIMIT_PER_MINUTE,
    standardHeaders: true,
    legacyHeaders: false,
    // Gate 5: limit per OAuth client id (falls back to IP only if auth somehow did not run).
    keyGenerator: (req: Request) => (req.auth?.clientId ? `client:${req.auth.clientId}` : ipKeyGenerator(req.ip ?? "")),
    validate: { xForwardedForHeader: false },
    handler: (_req, res) => jsonRpcError(res, 429, -32000, "Rate limit exceeded for this client. Retry after 60 seconds."),
  });

  const metadataHandler = (_req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(protectedResourceMetadata);
  };
  app.get("/.well-known/oauth-protected-resource", metadataHandler);
  app.get(`/.well-known/oauth-protected-resource${MCP_PATH}`, metadataHandler);

  app.post(MCP_PATH, bearerAuth, clientRateLimiter, async (req: Request, res: Response) => {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("[MCP] request handling failed", {
        clientId: req.auth?.clientId,
        reason: error instanceof Error ? error.name : "unknown",
      });
      if (!res.headersSent) jsonRpcError(res, 500, -32603, "Internal server error");
    }
  });

  // Stateless transport: no server-initiated SSE stream and no session to delete.
  const methodNotAllowed = (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST");
    jsonRpcError(res, 405, -32000, "Method not allowed. Tabula Medica MCP is stateless: use POST.");
  };
  app.get(MCP_PATH, methodNotAllowed);
  app.delete(MCP_PATH, methodNotAllowed);

  console.log(`[MCP] Streamable HTTP server mounted at ${MCP_PATH} (tools: ${MCP_TOOL_NAMES.join(", ")}); resource=${protectedResourceMetadata.resource}`);
  return true;
}
