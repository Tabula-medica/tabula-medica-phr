# Vertex AI Migration Plan
**Date:** 2026-05-06  **Owner:** Platform Engineering  **Decision input:** [Locked 2026-05-03]
**Why this is critical-path:** No OpenAI BAA exists. Every PHI-touching GPT-5 call is a HIPAA exposure and a SOC 2 Type 1 evidence-blocker. This sprint must complete **before** Strike Graph kickoff in Q3 2026.

## Current state — already in place

The hard part is done. We have:

- `server/services/ai-provider.ts` — abstraction layer with `generateText()` and `streamText()` that already routes between OpenAI and Vertex by feature flag.
- `server/services/vertex-gemma.ts` — direct Vertex client for the founder's Gemma "Submit-only" pattern.
- `@google-cloud/vertexai` SDK installed and wired with credentials via `GCP_SERVICE_ACCOUNT_KEY` / `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
- Default provider env switch: `AI_DEFAULT_PROVIDER` (currently `openai`).
- Per-feature override registry: `setFeatureProvider("symptom-checker", "vertex")`.

**Translation:** the platform already speaks Vertex. The migration is mostly (a) flipping the default, (b) refactoring direct `getOpenAIClient()` callers to go through `generateText()`, and (c) handling Whisper (audio) which has no abstraction yet.

## Call site inventory

Total OpenAI-touching files in `server/`: **~50** TypeScript files.

### Tier 1 — Routes through abstraction already (low effort)
Files that import from `services/ai-provider.ts` only need the env flag flipped to migrate. Smoke-test only.

### Tier 2 — Direct `getOpenAIClient()` callers via `utils/openai-client.ts`
**Single chokepoint:** `server/utils/openai-client.ts` is the only OpenAI client factory used by ~40 files. Two paths:

- **Option A (fast, recommended):** Repoint `getOpenAIClient()` to a Vertex-backed shim that translates the OpenAI Chat Completions API surface to Vertex. Zero call-site changes. Risk: subtle prompt/response format drift; need golden-output regression tests.
- **Option B (clean, slow):** Refactor every caller to use `generateText()` from `ai-provider.ts`. ~40 file edits, ~2 weeks of engineering.

Recommendation: **Option A** for the SOC 2 deadline, **Option B** as Q4 2026 cleanup.

### Tier 3 — Highest-volume call-site files (priority for review)
| File | OpenAI mentions | PHI? | Notes |
|---|---|---|---|
| `server/routes.ts` | 44 | Yes | Symptom checker, AI chat endpoints |
| `server/services/ai-provider-dashboard-service.ts` | 31 | Yes | Provider AI dashboard — task list, vitals monitor, doc summaries |
| `server/services/ai-personalized-care-journey-service.ts` | 30 | Yes | Care journey personalization |
| `server/services/ai-workflow-automation.ts` | 27 | Yes | Workflow automation |
| `server/services/ai-proactive-patient-engagement-chatbot-service.ts` | 26 | Yes | Patient chatbot |
| `server/services/patient-engagement-hub-service.ts` | 25 | Yes | Engagement hub |
| `server/services/ai-fhir-data-monetization-service.ts` | 25 | Yes | FHIR analytics |
| `server/services/aiCarePlanAutomation.ts` | 24 | Yes | Care plan generation |
| `server/services/translation-guardrail-service.ts` | 23 | Mixed | Translation — usually no PHI but possible in messages |
| `server/services/ai-data-governance-service.ts` | 22 | Yes | Data governance AI |
| `server/services/ai-medical-scribe-service.ts` | 20 | **Yes — high sensitivity** | Ambient encounter transcription |
| `server/services/ai-health-assistant.ts` | 19 | Yes | AI medical assistant |

### Tier 4 — Whisper / audio (separate track)
`server/voice.ts` and ambient encounter recording use OpenAI Whisper. Vertex equivalent is **Google Speech-to-Text Medical** (separate product, separate IAM, already covered under existing GCP BAA). Migration LOE: ~1 week, includes audio format handling differences (Whisper auto-detects, Speech-to-Text needs sample rate hints).

## Sequencing — 1 week of engineering

### Day 1 — Validate Vertex baseline
- Set `AI_DEFAULT_PROVIDER=vertex` in staging.
- Smoke-test all Tier-1 files (symptom checker, AI chat, summaries).
- Capture golden outputs for 20 representative prompts; diff against OpenAI baseline.

### Day 2–3 — Repoint chokepoint (Option A)
- Add `server/utils/openai-vertex-shim.ts` exposing the OpenAI Chat Completions interface, backed by Vertex Gemini.
- Modify `server/utils/openai-client.ts` to return the shim when `AI_DEFAULT_PROVIDER=vertex`.
- Run regression suite. Hand-test the 12 Tier-3 services above.

### Day 4 — Whisper → Speech-to-Text Medical
- Add `server/services/speech-to-text-service.ts` using `@google-cloud/speech`.
- Switch `server/voice.ts` and ambient encounter routes.
- Verify multilingual coverage (≥50 languages requirement still met).

### Day 5 — Production cutover
- Flip `AI_DEFAULT_PROVIDER=vertex` in production env.
- Keep `AI_INTEGRATIONS_OPENAI_API_KEY` set for 2-week rollback window.
- Monitor Vertex quotas; request quota increases proactively (default per-project quotas are aggressive for healthcare workloads).

### Week 2 — Cleanup (background)
- Remove Replit AI proxy fallback paths.
- Delete OpenAI SDK once telemetry confirms zero calls for 14 days.
- File Tier-3 refactor tickets (Option B) for Q4 cleanup.

## Risks
1. **Prompt drift** — Gemini handles JSON mode and system prompts differently from GPT-5. The shim translates but some prompts may need rewording. Mitigation: golden-output regression suite.
2. **Response format** — `response_format: { type: "json_object" }` translates to `responseMimeType: "application/json"` in Vertex. Symptom checker depends on this; verify first.
3. **Whisper parity** — Speech-to-Text Medical's word-error rate on accented English is competitive but not identical. Run side-by-side on 50-utterance test set before cutover.
4. **Vertex quota** — Default per-region quota is ~60 QPM for Gemini Pro. Request increase to 600 QPM before production cutover.

## Acceptance criteria
- All clinical AI features pass regression suite running against Vertex.
- Zero OpenAI API calls in production logs for 14 consecutive days.
- Updated subprocessor list: OpenAI removed, Google Cloud (Vertex AI) confirmed under existing BAA.
- Trust Center page reflects new posture.

## Open questions for product
- Do we keep the `AI_DEFAULT_PROVIDER` knob as a safety valve, or hardcode Vertex post-cutover?
- Any features where Gemini quality is materially worse than GPT-5 that justify a per-feature OpenAI exception with explicit synthetic-data-only constraints?
