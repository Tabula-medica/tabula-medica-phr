# AI / Model Inventory — Underinsured
_TEMPLATE — complete and keep current (control AIG-01)._

| Use case | Model | Provider | Under BAA? | Data class | Data flow | Human-in-loop? |
|---|---|---|---|---|---|---|
| (e.g. summarize record) | gemini-2.5-flash | Google Vertex | YES | PII | app → Vertex (BAA) → app | draft-only |

> Rule: PHI may only go to an AI provider under a signed BAA (Google Vertex). No OpenAI/Anthropic on PHI paths (AIG-02).
