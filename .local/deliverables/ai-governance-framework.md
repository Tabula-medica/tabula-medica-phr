# GenAI governance — Tabula Medica PHR

Framework: Concentric AI "Your Nine-Step Guide to GenAI Governance" (9-point framework, 3 quick wins).
Scope: this repo only. Region: US / HIPAA. No SOC 2 or HITRUST claim; "aligned with" at most.
Status key: **Have** = verified in code this session. **Partial** = exists, depth not verified. **Gap** = not found.

| # | Step | Control in this repo | Status | Next action |
|---|------|----------------------|--------|-------------|
| 1 | Discover and classify | `scripts/phi-ai-guard.sh` blocks non-BAA endpoints in source. ~280 files import `openai`, aliased to the Vertex shim in `script/build.ts`. | Partial | Generate an AI call-site inventory (file, route, PHI yes/no, `purpose`) and commit it. |
| 2 | Enforce policy | All PHI AI goes through `server/services/ai-gateway.ts` (Vertex, Google BAA). NO-CDS guardrail is prepended inside the gateway. Services `ai-policy-*.ts` exist. | Have / Partial | Confirm `ai-policy-enforcement.ts` is wired to live routes rather than only dashboards. |
| 3 | Monitor and audit | **New:** the gateway logs one PHI-free record per call (`ai_gateway_call`: kind, purpose, model, promptChars, latencyMs, outcome). Test: `tests/ai-gateway-audit.spec.ts`. | Have (new) | Set `purpose` at each `generatePhiSafe*` call site. Today most log `unspecified`. |
| 4 | Integrate with ecosystems | Server-side Vertex only. No Copilot/Slack/Workspace AI in scope. | N/A | Re-check if any third-party AI plugin is added. |
| 5 | GenAI-aware DLP | `server/security/ai-runtime-guard.ts`: prompt-injection scan, model-output scan, obfuscation normalization. Pino redaction for PHI keys. `no-string-form-logger` lint rule. | Have | Move the lint rule from warn to error once Action Item K is done. |
| 6 | Regulatory compliance | HIPAA via Vertex BAA. `tm-comprehensive-roadmap.md` and `three-site-compliance-matrix.md` hold the program. | Partial | Add this table to the compliance matrix as the AI row. |
| 7 | Accountability and roles | None found for AI specifically. | Gap | Name an owner for: policy, model changes, incident response. Put names in this file. |
| 8 | Train and educate | None found. | Gap | One-page contributor rule: PHI AI only via gateway; set `purpose`; never log prompts. |
| 9 | Continuously improve | CI runs the PHI-AI guard. | Partial | Quarterly review of this file; add a CI check that every `generatePhiSafe*` call sets `purpose`. |

## 3 quick wins (30 days)

1. Inventory every AI call site (step 1). Output: `ai-call-inventory.md`.
2. Review which routes may call the gateway and who can reach them (step 2).
3. Backfill `purpose` at all gateway call sites, then alert on `unspecified` (step 3).

## Not covered here

Other apps in the portfolio (Uninsurance, sawd.ai, Universal Health Radio, katha.kids) are outside this session's repo scope. Each needs its own pass, and its own regime (e.g. PIPL, not HIPAA, where that applies).
