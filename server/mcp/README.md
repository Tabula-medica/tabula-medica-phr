# Tabula Medica MCP server (Phase 1, read-only)

Spec: [`docs/agent-protocols-strategy.md`](../../docs/agent-protocols-strategy.md) §3–§4.

## Enable

| Env var | Purpose | Default |
|---|---|---|
| `MCP_SERVER_ENABLED` | Mount `POST /mcp` and the well-known metadata | unset (off) |
| `AUTH0_ISSUER_BASE_URL`, `AUTH0_AUDIENCE` | Token verification (same as the rest of the API). Without both, `/mcp` does not mount. | required |
| `MCP_RESOURCE_URL` | Canonical resource identifier (RFC 8707) advertised to hosts | `APP_URL` + `/mcp`, else `https://tabulamedica.us/mcp` |
| `MCP_RATE_LIMIT_PER_MINUTE` | Requests per OAuth client id per minute | `60` |

## Shape

- Transport: MCP Streamable HTTP, **stateless** (new `McpServer` per request, JSON responses). `GET`/`DELETE /mcp` answer 405.
- Auth: bearer token → Auth0 JWKS → `AuthInfo`. 401 carries `WWW-Authenticate: Bearer … resource_metadata="…/.well-known/oauth-protected-resource/mcp"`.
- Scopes: the token's `scope` claim is read as SMART on FHIR (v1 `.read` and v2 `.rs` both accepted). `smartScopeAllows(scopes, "Observation", "read")`.
- Audit: `runAuditedTool` writes one `logPhiAccess` row per call (tool, resource type, client id, outcome). Tool arguments and results are never logged.
- Hosts: desktop and server-side MCP hosts work as-is. A browser-based host sends an `Origin` header and is refused by the global CSRF origin check until `/mcp` gets its own CORS allow-list (session P1-d, with the consent card).

## Tools shipped (session P1-a, both zero-PHI, no scope required)

| Tool | Backed by |
|---|---|
| `glossary_lookup` | `server/glossary-service.ts` |
| `care_access_lookup` | `server/services/care-access-catalog.ts` (shared with `/api/uninsured-resources`) |

## Adding a PHI tool (sessions P1-b, P1-c)

1. Create `server/mcp/tools/<name>.ts` exporting `register<Name>Tool(server)`; call it from `createMcpServer()` in `index.ts`.
2. Inside the handler: `runAuditedTool(extra.authInfo, { tool, resourceType, patientIdFor: (p) => p.patientId }, async (principal) => { … })`.
3. Before reading: `if (!smartScopeAllows(principal.scopes, resourceType, "read")) throw new McpToolDenied("Scope patient/<Type>.read required")`.
4. Pin patient-context reads to `principal.patientId`. A token without a SAID patient id cannot read patient resources.
5. Any model call goes through `server/services/ai-provider.ts`; wrap generated text with `ai-guardrail-service.ts`.
6. Cap `_count` at 50; add the scope-matrix case to `tests/mcp/tools.test.ts`.

## Try it locally

```bash
MCP_SERVER_ENABLED=true AUTH0_ISSUER_BASE_URL=… AUTH0_AUDIENCE=… npm run dev
npx @modelcontextprotocol/inspector   # transport: Streamable HTTP, URL http://localhost:5000/mcp, add Authorization: Bearer <Auth0 access token>
```

`npx vitest run tests/mcp` exercises the auth gates and both tools without Auth0 or a database.
