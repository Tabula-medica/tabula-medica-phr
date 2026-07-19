/**
 * Drop-in OpenAI -> Vertex AI shim.
 *
 * The app instantiates `new OpenAI(...)` in 300+ server files. A build alias
 * (script/build.ts) rewrites every `import OpenAI from "openai"` to this module, so
 * the swap is transparent — no per-file edits.
 *
 * FAIL-SAFE DEFAULT (PHI app): requests go to Vertex AI's OpenAI-compatible Chat
 * Completions endpoint via the runtime service account (ADC) — BAA-covered — with
 * gpt-* model names remapped to Gemini. OpenAI is used ONLY when a human explicitly
 * sets AI_PROVIDER=openai (non-PHI / local dev). A missing env can no longer leak
 * PHI to OpenAI; the worst case is a fail-closed error.
 *
 * Activate Vertex: set AI_PROVIDER=vertex + VERTEX_PROJECT_ID/VERTEX_LOCATION, and
 * grant the runtime SA roles/aiplatform.user. RUNTIME-VERIFY before trusting it:
 * Gemini differs from OpenAI on tool-calling/JSON-mode/streaming/response shape.
 * audio.* and images.* are NOT supported via the Vertex compat endpoint (will error
 * when AI_PROVIDER=vertex) — those ~16 call sites need a separate path.
 */
// Import the REAL openai by relative path so the `openai`->this-module build alias
// does NOT loop back onto the shim.
// @ts-ignore — no bundled types for the deep path; runtime shape is the OpenAI client.
import RealOpenAI from "../../node_modules/openai/index.js";
import { GoogleAuth } from "google-auth-library";

// Re-export the package's named helpers (toFile, APIError, etc.) so files that do
// `import { toFile } from "openai"` keep working. The explicit `OpenAI` export below
// overrides the star-exported one.
// @ts-ignore
export * from "../../node_modules/openai/index.js";

// FAIL-SAFE DEFAULT: PHI must never reach OpenAI (no BAA). This app carries PHI,
// so the shim now defaults to the Vertex (Google BAA) path and only uses OpenAI
// when a human EXPLICITLY opts in with AI_PROVIDER=openai (non-PHI / local dev
// only). A missing/misset AI_PROVIDER can no longer silently leak PHI to OpenAI —
// worst case is a fail-closed error, never a non-BAA send. Anthropic/OpenAI remain
// fine for non-PHI use elsewhere; this gate is specifically for the PHI app path.
const USE_VERTEX = (process.env.AI_PROVIDER || "vertex").toLowerCase() !== "openai";
const PROJECT =
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "united-planet-485003-n7";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";

const auth = USE_VERTEX
  ? new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
  : null;

// Map OpenAI model ids (incl. the invalid gpt-5.x ones in this repo) to Gemini.
// CONFIRMED available in united-planet-485003-n7 / us-central1 (2026-06-27):
// `google/gemini-2.5-flash` answers; the 2.0-* ids 404 for this project. All chat
// traffic maps to 2.5-flash — capable, cheap, and (with thinking disabled below)
// behaves like the gpt-4o-class models this app was written against.
function mapModel(_model?: string): string {
  return "google/gemini-2.5-flash";
}

// Gemini 2.5 is a "thinking" model: by default it spends reasoning tokens BEFORE
// emitting output, which silently eats a caller's small max_tokens and returns an
// empty/truncated string. The app's 300+ call sites assume OpenAI semantics (max_tokens
// == output budget). Setting thinking_budget=0 disables reasoning so behaviour matches.
// Passed via the Vertex OpenAI-compat `extra_body` passthrough.
const THINKING_OFF = { google: { thinking_config: { thinking_budget: 0 } } };

class OpenAIShim {
  constructor(opts: Record<string, any> = {}) {
    // Default path: real OpenAI, unchanged.
    if (!USE_VERTEX) {
      return new (RealOpenAI as any)(opts);
    }

    // Vertex path: OpenAI-compatible endpoint + ADC bearer token + model remap.
    const baseURL = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/${LOCATION}/endpoints/openapi`;

    const vertexFetch: typeof fetch = async (url: any, init: any = {}) => {
      const token = await auth!.getAccessToken();
      const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
      return (globalThis.fetch as any)(url, { ...init, headers });
    };

    const real: any = new (RealOpenAI as any)({
      ...opts,
      apiKey: "vertex-adc",
      baseURL,
      fetch: vertexFetch,
    });

    // Remap the model + disable thinking on every chat.completions.create call.
    if (real?.chat?.completions?.create) {
      const orig = real.chat.completions.create.bind(real.chat.completions);
      real.chat.completions.create = (params: any, ...rest: any[]) =>
        orig(
          { ...THINKING_OFF, ...params, model: mapModel(params?.model) },
          ...rest,
        );
    }

    return real;
  }
}

export default OpenAIShim;
export { OpenAIShim as OpenAI };
