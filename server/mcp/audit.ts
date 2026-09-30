/**
 * Gate 3 (docs/agent-protocols-strategy.md §3.2): one `logPhiAccess` row per
 * MCP tool call, carrying tool name, resource type, patient id, and the
 * calling client id. Zero-PHI tools still write a row (with no patient id) so
 * the audit trail shows every agent interaction, not only the PHI ones.
 *
 * Nothing from the tool's *arguments* or *result* is written to the row or to
 * server logs (gate 6). What is recorded is who, which tool, which resource
 * type, and the outcome.
 */
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logPhiAccess } from "../security/hipaa-audit";
import { logger } from "../utils/logger";
import { principalFromAuthInfo, type McpPrincipal } from "./auth";

export type McpAuditOutcome = "success" | "error" | "denied";
export type McpAuditAction = "read" | "export";

export interface McpAuditEntry {
  principal: McpPrincipal;
  tool: string;
  resourceType: string;
  action?: McpAuditAction;
  /** Only for tools that touch a patient's record. */
  patientId?: string | null;
  resourceId?: string;
  outcome: McpAuditOutcome;
  durationMs?: number;
}

export async function auditMcpToolCall(entry: McpAuditEntry): Promise<void> {
  const { principal } = entry;
  await logPhiAccess({
    userId: principal.userId,
    userRole: "mcp-client",
    patientId: entry.patientId ?? undefined,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    action: entry.action ?? "read",
    requestPath: "/mcp",
    requestMethod: "POST",
    userAgent: `mcp-client:${principal.clientId}`,
    responseStatus: entry.outcome === "success" ? 200 : entry.outcome === "denied" ? 403 : 500,
    responseTimeMs: entry.durationMs,
    details: `MCP tool ${entry.tool} (${entry.outcome}) by client ${principal.clientId}`,
  });
}

export interface AuditedToolOptions {
  tool: string;
  resourceType: string;
  action?: McpAuditAction;
  /** Resolve the patient id for the row (PHI tools). Omit for zero-PHI tools. */
  patientIdFor?: (principal: McpPrincipal) => string | null;
}

export class McpToolDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolDenied";
  }
}

/**
 * Wrap a tool body so that (a) it always runs as an authenticated principal,
 * (b) exactly one audit row is written whatever happens, and (c) failures
 * surface to the host as a tool-level error with a generic message — never a
 * stack trace or an internal detail.
 */
export async function runAuditedTool(
  authInfo: AuthInfo | undefined,
  options: AuditedToolOptions,
  body: (principal: McpPrincipal) => Promise<CallToolResult>,
): Promise<CallToolResult> {
  const principal = principalFromAuthInfo(authInfo);
  const started = Date.now();
  const patientId = options.patientIdFor ? options.patientIdFor(principal) : null;
  const base = {
    principal,
    tool: options.tool,
    resourceType: options.resourceType,
    action: options.action,
    patientId,
  };

  try {
    const result = await body(principal);
    await auditMcpToolCall({ ...base, outcome: result.isError ? "error" : "success", durationMs: Date.now() - started });
    return result;
  } catch (error) {
    const denied = error instanceof McpToolDenied;
    await auditMcpToolCall({ ...base, outcome: denied ? "denied" : "error", durationMs: Date.now() - started });
    if (!denied) {
      logger.error("[MCP] tool failed", { tool: options.tool, clientId: principal.clientId });
    }
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: denied ? (error as Error).message : `Tool ${options.tool} failed. The call has been logged.`,
        },
      ],
    };
  }
}
