/**
 * Remote (Streamable HTTP) mount for the public MCP connector, so it can be
 * added to claude.ai as a custom connector at https://<host>/mcp/public.
 *
 * Off unless PUBLIC_MCP_ENABLED=true. Mounted in server/index.ts ahead of the
 * global body parsers and CSRF, like the ABDM callback: an MCP client is a
 * machine caller that sends no Origin or CSRF header. That is safe here only
 * because this route never reads cookies, sessions, or the database, and every
 * tool returns public reference data. Stateless: a fresh server per request.
 */
import express, { type Express, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPublicConnector } from "./public-connector";
import { logger } from "../lib/logger";

export const PUBLIC_MCP_PATH = "/mcp/public";

export function isPublicMcpEnabled(): boolean {
  return process.env.PUBLIC_MCP_ENABLED === "true";
}

const publicMcpRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many connector requests" },
});

async function handle(req: Request, res: Response) {
  const server = createPublicConnector();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    // Never log the request body; tool inputs are public slugs, but the rule holds.
    logger.error({ op: "public-mcp", errName: err instanceof Error ? err.name : "unknown" }, "public MCP request failed");
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  }
}

function methodNotAllowed(_req: Request, res: Response) {
  res.status(405).set("Allow", "POST").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. This connector is stateless; use POST." },
    id: null,
  });
}

export function registerPublicMcpRoute(app: Express): void {
  if (!isPublicMcpEnabled()) return;
  app.post(PUBLIC_MCP_PATH, publicMcpRateLimiter, express.json({ limit: "64kb" }), handle);
  app.get(PUBLIC_MCP_PATH, methodNotAllowed);
  app.delete(PUBLIC_MCP_PATH, methodNotAllowed);
}
