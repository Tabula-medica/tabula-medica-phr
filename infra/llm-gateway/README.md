# LLM Gateway — route the PHR's OpenAI calls to Vertex (BAA-covered)

The PHR has ~306 files speaking the OpenAI API shape (`gpt-4o`/`gpt-5.x`/`gpt-image-1`,
646 chat calls). Rather than rewrite them, this gateway sits in front and translates
every request to **Claude / Gemini / Imagen on Vertex AI**, which is covered by the
signed **Google Cloud BAA**. PHI therefore never reaches OpenAI.

```
PHR services ──(OpenAI shape)──▶ llm-gateway (Cloud Run, this dir) ──▶ Vertex AI
                                  master-key auth + internal ingress     Claude/Imagen
```

## How the switch happens (zero code change)
Almost every caller — including the 7 raw-`fetch` services — reads
`AI_INTEGRATIONS_OPENAI_BASE_URL` (falling back to `https://api.openai.com/v1`).
Point that env var at this gateway and they all redirect. We also set `OPENAI_BASE_URL`
to catch any no-arg `new OpenAI()` clients.

## Deploy
```bash
cd infra/llm-gateway
bash deploy.sh            # PROJECT/REGION overridable via env
```
Then set the 4 env vars it prints on the `tabula-medica-web` Cloud Run service and redeploy.
Roll back instantly by restoring `AI_INTEGRATIONS_OPENAI_BASE_URL`/`OPENAI_BASE_URL` to the
old value (or unsetting them).

## Prerequisite (one-time, console)
Enable the **Anthropic Claude** models in **Vertex AI Model Garden** for `us-central1`
(accept terms). Until then `vertex_ai/claude-*` returns 403. Also verify the exact Vertex
model ids in `config.yaml` (`claude-opus-4-8`, `claude-sonnet-4-6`, `imagen-3.0-*`) — adjust
the `model:` strings to whatever Model Garden lists for your region.

## Security / trust model
- **Internal ingress + master-key auth** — only same-project/VPC traffic reaches the URL
  (not public), AND it requires `LITELLM_MASTER_KEY` (Secret Manager), which the PHR presents
  as its "OpenAI API key". For the PHR (Cloud Run) to count as "internal" it needs **Direct VPC
  egress** (`--network/--subnet --vpc-egress=all-traffic`) or a Serverless VPC connector.
- The gateway calls Vertex via its **own service account** (`llm-gateway-sa`, `roles/aiplatform.user`)
  using Workload Identity — **no downloadable key** (consistent with the org's
  disable-SA-key-creation policy).
- Scale-to-zero (`min-instances=0`) — ~$0 when idle.

## NOT covered yet — follow-ups
1. **Audio transcription** (Whisper / `gpt-4o-mini-transcribe`, 7 sites incl. the ambient
   scribe — a PHI-heavy path). LiteLLM's Google STT support is thin, so these are *not*
   routed here. Next slice: a small `/audio/transcriptions` handler backed by **Google
   Speech-to-Text**, or repoint those 7 sites directly. Until then they still hit the old
   transcription endpoint — keep real patient audio OFF until this is done.
   Sites: `ambient-encounter-service.ts`, `clinical-documentation-routes.ts`,
   `replit_integrations/audio/client.ts` (×2), `routes.ts:19927`,
   `services/ai-automated-documentation-service.ts`, `services/ai-clinical-documentation.ts`.
2. **`client/public/uninsurance.html`** — a browser `fetch` straight to `api.anthropic.com`;
   move to a server endpoint (it bypasses the gateway entirely).
3. **Tool-calling / JSON-schema parity** — spot-check the 412 `response_format` and
   tool-using call sites against Claude's behavior after cutover.
