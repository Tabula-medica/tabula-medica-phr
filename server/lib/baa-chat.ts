/**
 * BAA-safe chat-completions helper for the PHR's raw-fetch AI services.
 *
 * Seven services (health-coach, symptom-tracker, entity-extraction,
 * document-summary, appointment-assistant, health-visualization,
 * usability-features) used to POST clinical content straight to the consumer
 * OpenAI endpoint (no BAA), bypassing the OpenAI to Vertex shim.
 *
 * `baaChatFetch` is a drop-in for that raw fetch call: it takes the same options
 * object, but routes to Vertex AI (Google BAA) by default and only to OpenAI when
 * a human explicitly sets AI_PROVIDER=openai (non-PHI / dev), which additionally
 * requires an explicit base URL env (no hardcoded default). It returns a normal
 * Response, so callers' response.ok / response.json() keep working. When AI is not
 * configured it THROWS, so the callers' existing try/catch returns their non-AI
 * fallback and PHI never leaves under no BAA.
 */
import { GoogleAuth } from "google-auth-library";

const PROVIDER = (process.env.AI_PROVIDER || "vertex").toLowerCase();
const USE_VERTEX = PROVIDER !== "openai";
const PROJECT =
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "united-planet-485003-n7";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";

const auth = USE_VERTEX
  ? new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
  : null;

/** True when an AI backend is actually usable — gates the callers' "no AI
 *  configured -> fallback" branches (replacing the old !openaiKey check). */
export function isAiConfigured(): boolean {
  return USE_VERTEX ? Boolean(PROJECT) : Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

// Gemini is a "thinking" model; disable reasoning so max_tokens == output budget,
// matching the OpenAI semantics these call sites were written against.
const THINKING_OFF = { google: { thinking_config: { thinking_budget: 0 } } };

function mapModel(_model?: string): string {
  return "google/gemini-2.5-flash";
}

type FetchLikeOpts = { body?: string | Record<string, unknown>; [k: string]: unknown };

/** Drop-in for a raw `fetch(base + "/chat/completions", opts)`. Uses only
 *  opts.body (the JSON chat payload); the caller's URL/headers/method are dropped. */
export async function baaChatFetch(opts: FetchLikeOpts = {}): Promise<Response> {
  const payload: Record<string, unknown> =
    typeof opts.body === "string" ? JSON.parse(opts.body) : (opts.body ?? {});

  if (USE_VERTEX) {
    if (!PROJECT) {
      throw new Error(
        "Vertex AI not configured (set VERTEX_PROJECT_ID or GOOGLE_CLOUD_PROJECT). " +
          "PHI-bearing AI must use Vertex (Google BAA); refusing the consumer endpoint.",
      );
    }
    const token = await auth!.getAccessToken();
    const url =
      `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}` +
      `/locations/${LOCATION}/endpoints/openapi/chat/completions`;
    const body = { ...payload, model: mapModel(payload.model as string), extra_body: THINKING_OFF };
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  // Explicit non-PHI / dev opt-in. Requires an explicit base URL env — no
  // hardcoded default — so this file carries no non-BAA endpoint literal.
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!key || !base) {
    throw new Error(
      "AI_PROVIDER=openai requires AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL " +
        "(explicit, non-PHI use only).",
    );
  }
  return fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
}
