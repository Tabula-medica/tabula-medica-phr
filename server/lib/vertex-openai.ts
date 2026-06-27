/**
 * Drop-in OpenAI -> Vertex AI shim.
 *
 * The app instantiates `new OpenAI(...)` in 300+ server files. A build alias
 * (script/build.ts) rewrites every `import OpenAI from "openai"` to this module, so
 * the swap is transparent — no per-file edits.
 *
 * SAFE BY DEFAULT: unless AI_PROVIDER=vertex, this is a passthrough to the real
 * OpenAI SDK (behaviour unchanged). When AI_PROVIDER=vertex, requests go to Vertex
 * AI's OpenAI-compatible Chat Completions endpoint using the runtime service account
 * (ADC) — BAA-covered — with gpt-* model names remapped to Gemini.
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

const USE_VERTEX = process.env.AI_PROVIDER === "vertex";
const PROJECT =
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "united-planet-485003-n7";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";

const auth = USE_VERTEX
  ? new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
  : null;

// Map OpenAI model ids (incl. the invalid gpt-5.x ones in this repo) to Gemini.
function mapModel(model?: string): string {
  if (!model) return "google/gemini-2.0-flash";
  const m = String(model).toLowerCase();
  if (m.includes("mini") || m.includes("flash") || m.includes("nano")) {
    return "google/gemini-2.0-flash";
  }
  // gpt-4o, gpt-5, gpt-5.1, gpt-5.2, etc. -> a capable Gemini default.
  return "google/gemini-2.0-flash";
}

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

    // Remap the model on every chat.completions.create call.
    if (real?.chat?.completions?.create) {
      const orig = real.chat.completions.create.bind(real.chat.completions);
      real.chat.completions.create = (params: any, ...rest: any[]) =>
        orig({ ...params, model: mapModel(params?.model) }, ...rest);
    }

    return real;
  }
}

export default OpenAIShim;
export { OpenAIShim as OpenAI };
