# Agent Protocols Strategy — MCP, A2A, ACP, ANP for Tabula Medica
**Date:** 2026-09-05  **Owner:** Platform Engineering  **Status:** Proposal (Phase 1 ready to schedule)
**Why this matters:** Every AI vendor is converging on two open wires for agents — MCP for "agent ↔ tools/data" and A2A for "agent ↔ agent." Tabula Medica already owns the two assets those wires need: a patient-consented FHIR R4 API and a BAA-covered model host (Vertex). Exposing them over the standard wires turns the PHR from *an app with AI inside* into *the health-data layer other agents plug into* — without adding a new PHI surface, because the same consent, scopes, and audit gates apply.

---

## 0. Executive summary

| Protocol | What it is (one line) | TM verdict | Phase |
|---|---|---|---|
| **MCP** (Model Context Protocol) | Standard way for an LLM host to call tools and read resources. | **Build.** Ship a read-only, consent-scoped **Tabula Medica MCP server** over the existing FHIR R4 + SMART layer. The SDK is already in `package.json` and unused. | 1 |
| **A2A** (Agent-to-Agent) | Standard way for one agent to discover another (Agent Card) and hand it a task. | **Build second.** Use for the Tabula Medica ↔ Uninsurance hand-off already planned as SMART-on-FHIR in `unified-architecture-plan.md`. | 2 |
| **ACP** (Agent Communication Protocol, IBM/BeeAI) | REST-first agent messaging; merged into the A2A effort under the Linux Foundation in 2025. | **Do not build.** Treat as A2A. | — |
| **ANP** (Agent Network Protocol) | Decentralized identity (DID) based open agent network. | **Watch only.** No healthcare trust framework, no BAA story, no regulator recognition. Revisit if TEFCA/UDAP adopts DIDs. | — |

**The one rule that governs all of it:** an MCP or A2A endpoint is just another API client of PHI. It gets exactly the gates the FHIR API already has — Auth0 identity, SMART scopes, patient consent, `logPhiAccess` audit, PHI envelope encryption — and PHI only ever reaches a model that runs under the GCP BAA (Vertex). No exceptions, no new gates to invent.

---

## 1. Decoding the infographic for this codebase

The four rows in the diagram are four *layers*, not four competitors.

```
User ──► Host app (chat, voice, provider portal)
            │
            │  MCP  ── "give the model tools and data"
            ▼
        Tools / data servers  ◄── this is where Tabula Medica sits
            │
            │  A2A / ACP ── "let this agent ask that agent to do a job"
            ▼
        Other agents (Uninsurance care-access agent, pharmacy agent, scheduling agent)
            │
            │  ANP ── "let agents find each other on an open network"
            ▼
        Open agent internet (not ready for PHI)
```

- **MCP** answers: *how does Claude / Gemini / a provider's copilot read a patient's records and call our functions?* Today the answer is "it can't, except through our own UI." An MCP server makes the PHR consumable by any compliant host.
- **A2A** answers: *how does the Tabula Medica health-summary agent ask the Uninsurance care-access agent for a cash-pay price without either app scraping the other's UI?* Today the plan is a bespoke SMART-on-FHIR bridge; A2A gives it a standard envelope.
- **ACP** was IBM's parallel to A2A. It folded into A2A. Ignore the name; the architecture in the infographic (client → agent → discovery → message structure) is what A2A now specifies.
- **ANP** is a research-stage decentralized network. Useful vocabulary, not a build target for a HIPAA covered entity in 2026.

---

## 2. Where Tabula Medica already has the pieces

| Asset | File(s) | Reused by |
|---|---|---|
| FHIR R4 read/search/export endpoints | `server/fhir-r4-api-routes.ts`, `server/services/fhir-r4-api-service.ts` | MCP tools (`fhir_search`, `fhir_read`, `patient_export`) |
| SMART on FHIR OAuth + scope generation | `server/smart-fhir-routes.ts` (`/api/smart/scopes`, `/api/smart/generate-scope`), `server/smart-oauth2-management-routes.ts` | MCP auth (OAuth 2.1 resource server) and A2A agent auth |
| PHI access audit | `server/security/hipaa-audit.ts` → `logPhiAccess`, `server/middleware/fhir-audit-middleware.ts` | Every MCP tool call and every A2A task |
| BAA-safe model routing | `server/services/ai-provider.ts` (Vertex default, fail-closed) | Any server-side agent that *reasons* over PHI |
| Medical-advice guardrail | `server/ai-guardrail-service.ts` | Wrap MCP prompt outputs and A2A task responses |
| CDS Hooks (provider decision support) | `server/services/cds-hooks-service.ts`, `server/cds-hooks-routes.ts` | Becomes an A2A skill. **Note:** it still writes `new OpenAI(...)` directly. Since PR #81 (merged 2026-09-07) the production build aliases the `openai` package to `server/lib/vertex-openai.ts`, so that call is Vertex-routed in the deployed bundle. The dev server (`tsx`) does not apply the alias. Moving it behind `ai-provider.ts` is now hygiene, tracked in `docs/vertex-migration-plan.md`, not a launch blocker. |
| Explain / summarize services | `server/explain-anything-service.ts`, `server/eli12-service.ts`, `server/summarizer.ts`, `server/glossary-service.ts` | MCP tools that return *explanations of the patient's own data* (not advice) |
| Care Access (zero-PHI) | `/care/*` routes, `CARE_BRIDGE_SECRET` | First A2A skill: no PHI, lowest risk, highest cross-app value |
| MCP SDK | `package.json` → `@modelcontextprotocol/sdk ^1.30.0` (no imports anywhere) | Phase 1 needs zero new dependencies |

---

## 3. Compliance model (read before writing code)

### 3.1 Who sees the PHI when an agent calls MCP?

The **MCP host** (the app running the model) sees every tool result. So the host, not the MCP server, decides whether a call is HIPAA-clean. Two legitimate patterns, and only two:

| Pattern | Host | Legal basis | Allowed data |
|---|---|---|---|
| **A. Patient-directed access** | Any host the *patient* chooses (Claude, ChatGPT, a caregiver's app) | HIPAA Right of Access: the individual directs their own PHI to a third party of their choice. Same basis as a SMART patient app. Third party is not our Business Associate. | Full record, per SMART `patient/*.read` scopes the patient grants. Consent screen must say plainly that the receiving app is not covered by our HIPAA obligations. |
| **B. Covered-entity workload** | Our own agents on Vertex / Gemini (GCP BAA), or a provider's system under a BAA with us | Treatment / operations under the BAA chain | Whatever the provider's role and RBAC allow (`server/rbac.ts`) |

**Forbidden:** our server-side agents sending PHI to a non-BAA model (OpenAI standard tier, Anthropic API without BAA) via MCP or A2A. `ai-provider.ts` already fails closed for this; the MCP/A2A layer must call through it, never around it.

Two enforcement layers now exist and both stay on. PR #81 (merged 2026-09-07) aliases the `openai` package to `server/lib/vertex-openai.ts` in the production bundle, so every `new OpenAI(...)` call site routes to Vertex and audio/image calls fail closed. That alias applies only to the esbuild output, not to the `tsx` dev server, and the build now fails if the alias is dropped. New MCP and A2A code must still call `ai-provider.ts` explicitly so the same guarantee holds in dev and in tests.

### 3.2 Non-negotiable gates for every MCP tool and A2A task

1. Bearer token validated against Auth0 (same as `isAuthenticated` / `requirePhiAccess`).
2. Scope check with SMART scope syntax (`patient/Observation.read`), reusing the scope generator.
3. `logPhiAccess` entry per call with tool name, resource type, patient id, caller client id.
4. Read-only in Phase 1. No `create`/`update`/`delete` tools until F1 encryption program closes (see `.local/deliverables/f1-status.md`).
5. Rate limits per client id; hard cap on `_count` for search tools.
6. No PHI in server logs (existing `phi-ai-guard.yml` workflow applies to new files).
7. Responses pass through `ai-guardrail-service.ts` when they contain model-generated text.

### 3.3 Regulatory alignment (why this is not a detour)

- **ONC HTI / Cures Act information blocking:** a patient-facing MCP server is an *additional* standards-based access path for the individual's own data. It strengthens, not weakens, the access-API posture.
- **TEFCA / UDAP:** A2A Agent Cards are JSON documents that can carry the same certificate-backed identity UDAP expects; keep Agent Card signing on the roadmap so provider-side agents can be trusted through the same chain.
- **SOC 2 evidence:** every gate above already produces audit rows. The MCP/A2A layer adds control coverage without a new evidence type.

---

## 4. Phase 1 — Tabula Medica MCP server (read-only)

**Goal:** a patient can connect Tabula Medica to an AI assistant of their choice and ask "explain my last lipid panel" with the assistant reading real, consented data; and our own Vertex agents use the same tool set internally.

**Transport:** Streamable HTTP mounted at `POST /mcp` on the existing Express server (the SDK's `StreamableHTTPServerTransport`). No stdio server; every session is authenticated.

**Auth:** OAuth 2.1 per the MCP authorization spec, with Tabula Medica as the *resource server* and Auth0 as the *authorization server*. Publish `/.well-known/oauth-protected-resource` pointing at Auth0. Token scopes are SMART scopes.

### 4.1 Tool manifest

| Tool | Maps to | Scope required | Returns |
|---|---|---|---|
| `patient_summary` | `server/ai-health-summary-routes.ts` service, via `ai-provider.ts` (Vertex) | `patient/Patient.read` + `patient/*.read` | Structured summary: conditions, meds, allergies, recent results, care gaps. Guardrail-wrapped. |
| `fhir_search` | `fhirR4ApiService` search | `patient/{ResourceType}.read` | FHIR Bundle, `_count` ≤ 50, USCDI resource types only |
| `fhir_read` | `fhirR4ApiService` read by id | `patient/{ResourceType}.read` | Single FHIR resource |
| `explain_result` | `explain-anything-service.ts` / `eli12-service.ts` | `patient/Observation.read` + `patient/DiagnosticReport.read` | Plain-language explanation in the patient's UI language (`shared/i18n.ts`), no advice |
| `medication_list` | `med-reconciliation-service.ts` (read side) | `patient/MedicationRequest.read` | Reconciled active med list with interactions flagged as *informational* |
| `glossary_lookup` | `glossary-service.ts` | none (no PHI) | Term definition, multilingual |
| `care_access_lookup` | Care Access `/care/*` (zero-PHI) | none | Cash-pay sliding-scale lookup by ZIP + service. First cross-portfolio hook for Uninsurance. |
| `export_patient_bundle` | `/api/fhir/r4-export/patient` | `patient/*.read` | Full USCDI bundle (`$everything` style). Rate-limited to 1/hour/client. |

### 4.2 Resources and prompts

- **Resource** `tm://patient/{id}/summary` — cached summary the host can pin in context; refreshed on FHIR sync (`server/sync-scheduler.ts`).
- **Prompt** `visit_prep` — wraps `server/visit-prep-service.ts`: "prepare questions for my appointment on {date}." Output is questions to ask, never recommendations.
- **Prompt** `explain_in_language` — takes a resource id and a language code; uses the 19-language UI table.

### 4.3 Code layout (new files only)

```
server/mcp/
  index.ts            # registerMcpRoutes(app): mounts /mcp + well-known metadata
  auth.ts             # bearer → Auth0 verify → SMART scopes; 401 with WWW-Authenticate
  audit.ts            # thin wrapper: tool name + resource → logPhiAccess
  tools/
    patient-summary.ts
    fhir-search.ts
    fhir-read.ts
    explain-result.ts
    medication-list.ts
    glossary.ts
    care-access.ts
    export-bundle.ts
  prompts/
    visit-prep.ts
    explain-in-language.ts
tests/mcp/
  auth.test.ts        # missing/expired token, wrong scope, scope-to-resource matrix
  tools.test.ts       # each tool: happy path + audit row asserted + count cap
```

Registration: one `registerMcpRoutes(app)` call inside `registerRoutes` in `server/routes.ts`, feature-flagged by `MCP_SERVER_ENABLED=true` (default off in production until the consent screen ships).

### 4.4 Consent UX (client)

- New settings card **"Connected AI assistants"** listing MCP clients with granted scopes, last access, revoke button. Reuse the SMART app registration UI in `server/smart-app-registration-routes.ts` and its client page.
- Consent copy must include the pattern-A disclosure: *"[App] will receive the records you select. [App] is not covered by Tabula Medica's HIPAA obligations."* Add to `client/src/lib/permission-strings.ts` so it is translated with the rest.

### 4.5 Acceptance

- `npm run check`, `npm run lint`, `npm test` green with `tests/mcp/*`.
- MCP Inspector connects, lists 8 tools, and a `fhir_search` for `Observation` returns a Bundle with an audit row visible in `/admin` PHI audit.
- Vertex-hosted internal agent (Google ADK, which speaks MCP natively) can call the same server with a service token — proves pattern B.

---

## 5. Phase 2 — A2A between Tabula Medica and Uninsurance

**Goal:** replace the bespoke Care Access bridge with an A2A Agent Card + task exchange so the two sibling LLCs' agents cooperate through a standard, auditable envelope while PHI stays inside Tabula Medica.

- **Agent Card** at `/.well-known/agent.json` for Tabula Medica, skills: `care_access_lookup` (no PHI), `patient_summary_for_membership` (requires patient's SMART grant per §2.4 of `unified-architecture-plan.md`).
- Uninsurance publishes its own card with `membership_quote` and `provider_cash_price`.
- **Auth:** the same `uninsurance-fhir-client` Auth0 application already planned as the SMART client becomes the A2A client identity. Card `securitySchemes` = OAuth 2.0 client-credentials for zero-PHI skills, authorization-code with SMART scopes for PHI skills.
- **Runtime:** implement the Tabula Medica agent on Vertex via Google ADK (native A2A + MCP support, under the GCP BAA). It calls Phase 1's MCP tools; nothing new touches the database.
- **Task lifecycle** mapped to our audit: `submitted` → `working` → `completed|failed`, each transition logged with the requesting agent id.
- CDS Hooks may be exposed as an A2A skill once the Phase 1 MCP server is live. Its direct OpenAI client is Vertex-routed in production by the PR #81 build alias, so it is no longer a blocker. Confirm `AI_PROVIDER` is unset or `vertex` on the deployed service before enabling the skill.

---

## 6. Portfolio leverage (outside this repo, listed for planning only)

| Project | Protocol | Use |
|---|---|---|
| Uninsurance | A2A client + its own MCP server for pricing data | Phase 2 above |
| sawd.ai | MCP client (consume TM tools under pattern A) | Demonstrates "bring your own PHR" to an assistant |
| Universal Health Radio / katha.kids | MCP `glossary_lookup` and multilingual `explain_in_language` (no PHI) | Script generation and listener Q&A in Hindi/Tamil/Telugu with clinical terms sourced from one glossary |
| Any provider partner | Pattern B MCP under BAA | Provider copilot reads consented patient records without a custom integration |

One MCP server, four consumers. That is the benefit.

---

## 7. Session-sized directives (Replit agent, Session Start Protocol applies)

**Session P1-a (60–90 min):** `server/mcp/index.ts`, `auth.ts`, `audit.ts`, tools `glossary` + `care_access` (both zero-PHI), `tests/mcp/auth.test.ts`. Feature flag off. Green CI.

**Session P1-b (60–90 min):** tools `fhir_search`, `fhir_read`, `export_bundle` with scope matrix tests and `_count` cap. Audit rows asserted.

**Session P1-c (60–90 min):** tools `patient_summary`, `explain_result`, `medication_list` routed through `ai-provider.ts`; guardrail wrap; prompts `visit_prep`, `explain_in_language`.

**Session P1-d (45–60 min):** "Connected AI assistants" settings card, consent copy in `permission-strings.ts` + 19 translations, well-known metadata, MCP Inspector walkthrough recorded for `/admin/smoke-test`.

**Session P2-a (90 min):** Agent Card, ADK agent skeleton on Vertex, `care_access_lookup` skill end-to-end with Uninsurance stub.

---

## 8. Decisions requested

1. Approve Phase 1 scope as read-only, feature-flagged, pattern A + B.
2. Confirm consent copy owner (legal review of the pattern-A disclosure).
3. Confirm Phase 2 waits for Auth0 BAA upgrade to close (`AUDIT_CONTEXT.md` gate list).
