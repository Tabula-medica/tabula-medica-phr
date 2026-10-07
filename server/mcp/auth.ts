/**
 * MCP bearer authentication — Tabula Medica is the OAuth 2.1 *resource
 * server*, Auth0 is the *authorization server* (docs/agent-protocols-strategy.md §4).
 *
 * Gate 1: every /mcp request carries an Auth0 access token, verified against
 *         the tenant JWKS exactly like `requireAuth0Token`.
 * Gate 2: the token's `scope` claim is read as SMART on FHIR scopes; tools
 *         call `smartScopeAllows` before touching a resource type.
 *
 * A failed check answers 401 with a `WWW-Authenticate` header that points at
 * `/.well-known/oauth-protected-resource`, which is how an MCP host discovers
 * where to send the patient to authorize (MCP authorization spec, RFC 9728).
 */
import type { RequestHandler } from "express";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { verifyAuth0AccessToken } from "../middleware/auth0-jwt-verify";

// ---------------------------------------------------------------------------
// SMART on FHIR scope parsing (v1 `.read/.write/.*` and v2 `.cruds`)
// ---------------------------------------------------------------------------

export type SmartContext = "patient" | "user" | "system";
export type SmartPermission = "c" | "r" | "u" | "d" | "s";
export type SmartAccess = "read" | "search" | "write";

export interface ParsedSmartScope {
  context: SmartContext;
  /** FHIR resource type, or "*" for all. */
  resourceType: string;
  permissions: ReadonlySet<SmartPermission>;
  raw: string;
}

const V1_PERMISSIONS: Record<string, SmartPermission[]> = {
  read: ["r", "s"],
  write: ["c", "u", "d"],
  "*": ["c", "r", "u", "d", "s"],
};

const SCOPE_PATTERN = /^(patient|user|system)\/([A-Za-z]+|\*)\.(read|write|\*|[cruds]{1,5})(?:\?.*)?$/;

export function parseSmartScope(raw: string): ParsedSmartScope | null {
  const match = SCOPE_PATTERN.exec(raw.trim());
  if (!match) return null;
  const [, context, resourceType, access] = match;
  const permissions = new Set<SmartPermission>(
    V1_PERMISSIONS[access] ?? (access.split("") as SmartPermission[]),
  );
  return { context: context as SmartContext, resourceType, permissions, raw };
}

/** Space-delimited `scope` claim (or an array) → individual scope strings. */
export function parseScopeClaim(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.filter((s): s is string => typeof s === "string");
  if (typeof claim === "string") return claim.split(/\s+/).filter(Boolean);
  return [];
}

const ACCESS_TO_PERMISSION: Record<SmartAccess, SmartPermission[]> = {
  read: ["r"],
  search: ["s"],
  write: ["c", "u", "d"],
};

/**
 * Does any granted scope allow `access` on `resourceType`?
 * Context is not distinguished here: a `user/` or `system/` scope is at least
 * as broad as the matching `patient/` scope, and the tool layer separately
 * pins patient-context calls to the token's SAID patient id.
 */
export function smartScopeAllows(scopes: readonly string[], resourceType: string, access: SmartAccess): boolean {
  const needed = ACCESS_TO_PERMISSION[access];
  for (const raw of scopes) {
    const scope = parseSmartScope(raw);
    if (!scope) continue;
    if (scope.resourceType !== "*" && scope.resourceType !== resourceType) continue;
    if (needed.every((p) => scope.permissions.has(p))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Token verification → AuthInfo
// ---------------------------------------------------------------------------

export interface McpTokenExtra {
  sub: string;
  saidPatientId: string | null;
  phiAccess: boolean;
  segment: string | null;
  orgId: string | null;
}

export class Auth0McpTokenVerifier implements OAuthTokenVerifier {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const payload = await verifyAuth0AccessToken(token);
    if (!payload || !payload.sub) {
      throw new InvalidTokenError("Token verification failed");
    }
    const claims = payload.rawClaims;
    const azp = typeof claims.azp === "string" ? claims.azp : undefined;
    const clientIdClaim = typeof claims.client_id === "string" ? claims.client_id : undefined;
    const extra: McpTokenExtra = {
      sub: payload.sub,
      saidPatientId: payload.saidPatientId,
      phiAccess: payload.phiAccess,
      segment: payload.segment,
      orgId: payload.orgId,
    };
    return {
      token,
      clientId: azp ?? clientIdClaim ?? payload.sub,
      scopes: parseScopeClaim(claims.scope),
      expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
      extra: { ...extra },
    };
  }
}

/** The identity a tool acts as. Never defaulted — a missing principal is a bug, not "system". */
export interface McpPrincipal {
  userId: string;
  clientId: string;
  scopes: readonly string[];
  /** SAID patient id from the token, when the caller is a patient. */
  patientId: string | null;
  phiAccess: boolean;
}

export function principalFromAuthInfo(authInfo: AuthInfo | undefined): McpPrincipal {
  const extra = authInfo?.extra as Partial<McpTokenExtra> | undefined;
  const userId = typeof extra?.sub === "string" ? extra.sub : "";
  if (!authInfo || !userId) {
    throw new Error("MCP tool invoked without an authenticated principal");
  }
  return {
    userId,
    clientId: authInfo.clientId,
    scopes: authInfo.scopes,
    patientId: typeof extra?.saidPatientId === "string" ? extra.saidPatientId : null,
    phiAccess: extra?.phiAccess === true,
  };
}

export function createMcpBearerAuth(resourceMetadataUrl: string): RequestHandler {
  return requireBearerAuth({
    verifier: new Auth0McpTokenVerifier(),
    resourceMetadataUrl,
  });
}
