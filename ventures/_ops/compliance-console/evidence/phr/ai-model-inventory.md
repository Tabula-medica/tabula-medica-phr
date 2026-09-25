# AI Model Inventory — Tabula Medica PHR
_Entity: Tabula Medica PHR · Generated 2026-09-07 · Framework: NIST AI RMF / ISO 42001 / EU AI Act · Review: quarterly_

| Model | Provider | Purpose | Data exposure | Guardrail | Human-in-loop |
|---|---|---|---|---|---|
| gemini-2.5-flash | Google Vertex AI (under GCP BAA) | Clinical text summarization / drafting | PHI (de-identified where feasible) | PHI-AI **Vertex-only, fail-closed**; Anthropic/OpenAI blocked on PHI paths | Yes — clinician review before any clinical action |

## Governance controls
- **PHI boundary (AIG-02, P0):** PHI is routed exclusively to Vertex under the Google Cloud BAA. Non-BAA providers (Anthropic, OpenAI) must not receive PHI; enforced in code + CI guard.
- **No autonomous clinical decisions:** AI output is advisory/draft; a licensed human confirms. CDS/SaMD line reviewed with counsel.
- **Validation:** model outputs are spot-checked; accuracy/bias monitored. 
- **Logging:** AI actions logged to the audit trail (HIPAA §164.312(b)).
