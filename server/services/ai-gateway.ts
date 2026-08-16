/**
 * PHI-safe AI gateway (P1-1).
 *
 * The ONE module allowed to run PHI-bearing LLM calls. It uses Vertex AI
 * (Google BAA) directly via @google-cloud/vertexai — never OpenAI/Anthropic — and
 * prepends the NO-CDS guardrail inside the gateway so no caller can forget it.
 *
 * Any feature that puts patient-identifying content into a prompt MUST call
 * `generatePhiSafeText` here. Non-PHI features may use another provider ONLY via a
 * separate, clearly-named module (see ai-nonphi.ts) — never this one, never a bare
 * `new OpenAI(...)` on a PHI path (enforced by scripts/phi-ai-guard.sh).
 *
 * RUNTIME-VERIFY the model id: the OpenAI-compat path in server/lib/vertex-openai.ts
 * uses `google/gemini-2.5-flash`; the native SDK here uses `gemini-2.5-flash`. If a
 * given project/location 404s, adjust VERTEX_MODEL.
 */
import { VertexAI, type GenerativeModel } from "@google-cloud/vertexai";

const PROJECT =
  process.env.GCP_PROJECT_ID ||
  process.env.VERTEX_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "united-planet-485003-n7";
const LOCATION = process.env.GCP_LOCATION || process.env.VERTEX_LOCATION || "us-central1";
const MODEL = process.env.VERTEX_MODEL || "gemini-2.5-flash";

// Prepended to every call — the app is a patient PHR, not a clinical decision
// support device. Mirrors the NO_CDS_COMPLIANCE contract enforced elsewhere.
const NO_CDS_GUARDRAIL =
  "You are an informational assistant for a patient personal-health-records app. " +
  "Provide plain-language summaries and explanations of the patient's own records ONLY. " +
  "Do NOT provide medical advice, diagnosis, treatment recommendations, dosing, or any " +
  "clinical decision support. Defer all clinical decisions to a licensed clinician.";

let cached: GenerativeModel | null = null;
function getModel(): GenerativeModel {
  if (!cached) {
    const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
    cached = vertex.getGenerativeModel({ model: MODEL });
  }
  return cached;
}

export interface PhiSafeTextRequest {
  /** Optional caller system prompt; the NO-CDS guardrail is always prepended. */
  system?: string;
  /** The user/content prompt (may contain the patient's own PHI). */
  user: string;
  /** Output token budget. */
  maxTokens?: number;
  /** e.g. "application/json" to force JSON output. */
  responseMimeType?: string;
  /** 0..1; defaults low for factual summarization. */
  temperature?: number;
}

/**
 * Run a PHI-bearing generation on Vertex (BAA). Returns the model's text. Throws
 * on transport/model errors — callers should surface a 500, never fall back to a
 * non-BAA provider.
 */
export async function generatePhiSafeText(req: PhiSafeTextRequest): Promise<string> {
  const system = req.system ? `${NO_CDS_GUARDRAIL}\n\n${req.system}` : NO_CDS_GUARDRAIL;
  const result = await getModel().generateContent({
    systemInstruction: system,
    contents: [{ role: "user", parts: [{ text: req.user }] }],
    generationConfig: {
      maxOutputTokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.2,
      ...(req.responseMimeType ? { responseMimeType: req.responseMimeType } : {}),
    },
  });
  const parts = result?.response?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text ?? "").join("");
}
