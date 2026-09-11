# OpenAI → Vertex AI Migration — Status & Closure

**Original plan:** 2026-05-06 · **Refreshed:** 2026-09-10 · **Owner:** Platform Engineering
**Why critical-path:** No OpenAI BAA exists. Any PHI-touching OpenAI call is a HIPAA
exposure and a SOC 2 evidence blocker. This document is the source of truth for the
migration's actual state — keep it accurate; auditors read it.

> **Refresh note (2026-09-10):** The original plan (below, "Historical plan")
> proposed a per-caller refactor plus a small chokepoint shim, with `openai` as the
> default provider. The implementation went further and is now materially different
> and stronger. This top section reflects **reality in the codebase today**; the
> historical plan is retained verbatim at the bottom for provenance only.

## TL;DR — the HIPAA P0 is contained

PHI can no longer reach OpenAI. The migration is functionally complete for every
PHI path. The only open item is a **non-PHI image-generation feature that is
currently fail-closed (disabled)** and awaiting a product decision — not a leak.

| Modality | Path today | BAA-covered? | Status |
|---|---|---|---|
| Text / chat / JSON | Vertex Gemini 2.5-flash via OpenAI-compat endpoint | ✅ Google BAA | **Done** |
| Vision / OCR (image_url in chat) | Same Gemini path (multimodal) | ✅ Google BAA | **Done — runtime-verify** |
| Audio STT + TTS | GCP Speech-to-Text + Google Cloud TTS | ✅ Google BAA | **Done** (PR #85) |
| Image **generation** (`gpt-image-1`) | Fail-closed on Vertex (no compat support) | n/a — disabled | **Decision needed** |

## How it actually works now

### 1. Build-time alias shim (covers all ~300 call sites transparently)
`script/build.ts:65` aliases every `import OpenAI from "openai"` to
`server/lib/vertex-openai.ts`. No per-file edits — the swap is transparent.

- **Fail-safe default:** `AI_PROVIDER` defaults to `vertex`. OpenAI is used ONLY
  when a human explicitly sets `AI_PROVIDER=openai` (non-PHI / local dev). A
  missing/misset env can no longer silently leak PHI — worst case is a fail-closed
  error, never a non-BAA send.
- **Model remap:** all `gpt-*` / `gpt-5.x` ids map to `google/gemini-2.5-flash`
  (confirmed available in `united-planet-485003-n7` / `us-central1`).
- **Thinking disabled** (`thinking_budget=0`) so Gemini honors `max_tokens` the way
  the OpenAI-era call sites assume.
- **Multimodal hard-block:** `blockPhiMultimodal()` disables the `.audio` and
  `.images` *namespaces* on every client (fail-closed with a pointer to the
  BAA-covered path). Note this blocks `openai.images.*` / `openai.audio.*` only —
  **not** `image_url` content parts inside `chat.completions.create`, which are
  multimodal-native to Gemini and route fine.

### 2. Build-time PHI-egress guard (self-enforcing)
`script/build.ts:74-84` fails the build if the shim is missing from the bundle
(e.g. a Base44/Replit regen drops the alias). This prevents a silent regression
back to real OpenAI. Keep this guard.

### 3. Audio (done — PR #85 `feat/phr-audio-gcp-stt`, merged)
`server/replit_integrations/audio/routes.ts` uses `speechToText()` / `textToSpeech()`
from `./client`, backed by GCP Speech-to-Text + Google Cloud TTS. The reasoning turn
(`chat.completions.create`) routes through the shim to Vertex. Helper:
`server/services/gcp/medical-speech-to-text.ts`.

## Remaining work

### A. Vision / OCR — RUNTIME-VERIFY only (no code change expected)
These four sites send `image_url` parts (incl. `data:...;base64,`) through
`chat.completions.create`, so they already route to Gemini via the compat endpoint:

- `server/services/document-ocr-service.ts` (medical document OCR)
- `server/services/multimodal-document-parser.ts`
- `server/routes/card-ocr-routes.ts` (insurance card OCR)
- `server/ai-document-categorization.ts`

**Verify (needs deployed env + ADC):** confirm Vertex's OpenAI-compat
`chat.completions` accepts `image_url` with base64 `data:` URLs and returns the
expected JSON. If base64 data URLs are rejected, switch those sites to the native
`@google-cloud/vertexai` `generateContent` with `inlineData` — code is small and
localized. Until verified, treat as **works-pending-confirmation**, not done.

### B. Image generation — product decision required (non-PHI, currently disabled)
`server/replit_integrations/image/{client,routes}.ts` call `openai.images.generate`
/ `.edit` (`gpt-image-1`). These **fail-closed** under the Vertex default, so the
feature is non-functional in prod (not leaking). Options:

1. **Deprecate** — if no live feature depends on generated images, delete the routes
   + client and remove the dead surface. *Recommended if usage is zero.*
2. **Vertex Imagen** — reimplement `generateImageBuffer` / edit against Vertex
   Imagen (`@google-cloud/aiplatform` / Imagen API) under the existing BAA. ~1 day.

**Owner decision:** is any shipped feature calling image generation? If no →
deprecate. If yes → Imagen. (Grep found no `routes.ts` caller; likely unused.)

## Acceptance criteria (updated)
- [x] Zero code path can send PHI to OpenAI by default (fail-safe shim + build guard).
- [x] Text, vision, and audio PHI paths BAA-covered (Vertex + GCP STT/TTS).
- [ ] Vision `image_url` base64 acceptance confirmed in deployed env (item A).
- [ ] Image-generation decision made and executed (item B).
- [ ] Subprocessor list / Trust Center reflect: OpenAI removed for PHI; Google Cloud
      (Vertex AI, Speech-to-Text, TTS) under existing BAA.
- [ ] Telemetry: zero OpenAI calls in prod for 14 consecutive days, then remove the
      `openai` dependency (`package.json:105`).

## Open questions for product
- Keep the `AI_PROVIDER` knob as a safety valve, or hardcode Vertex post-cutover?
- Any feature where Gemini quality materially trails GPT and justifies a per-feature,
  synthetic-data-only OpenAI exception?
- Image generation: deprecate or Imagen? (see item B)

---

# Historical plan (2026-05-06) — retained for provenance

> Superseded by the status above. The implementation used a build-time alias shim
> (`server/lib/vertex-openai.ts`) rather than the `openai-vertex-shim.ts` /
> per-caller approach described here, defaults to Vertex (not OpenAI), and has
> already completed the Whisper/audio track via GCP Speech-to-Text + Google TTS.

## Current state — already in place
- `server/services/ai-provider.ts` — abstraction with `generateText()` / `streamText()`.
- `server/services/vertex-gemma.ts` — direct Vertex client (Gemma "Submit-only").
- `@google-cloud/vertexai` SDK wired via `GCP_SERVICE_ACCOUNT_KEY` /
  `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
- Per-feature override registry: `setFeatureProvider("symptom-checker", "vertex")`.

## Original sequencing (1 week)
- Day 1 — validate Vertex baseline; golden-output diffs.
- Day 2–3 — repoint chokepoint via shim (Option A).
- Day 4 — Whisper → Speech-to-Text Medical.
- Day 5 — production cutover; 2-week OpenAI rollback window.
- Week 2 — remove Replit proxy fallbacks; delete OpenAI SDK after 14 clean days.

## Original risks
1. Prompt drift (Gemini JSON mode / system prompts differ) — golden-output suite.
2. `response_format: json_object` → `responseMimeType: application/json`.
3. Whisper parity vs Speech-to-Text Medical — side-by-side on 50 utterances.
4. Vertex quota — default ~60 QPM; request increase before cutover.
