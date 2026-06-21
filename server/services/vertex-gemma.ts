import { VertexAI, type GenerateContentRequest } from "@google-cloud/vertexai";

const PROJECT_ID =
  process.env.GCP_PROJECT_ID ||
  process.env.VERTEX_PROJECT_ID ||
  "united-planet-485003-n7";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const MODEL = process.env.VERTEX_GEMMA_MODEL || "gemma-4-e4b-it-maas";

let cached: VertexAI | null = null;

function parseServiceAccountKey(): Record<string, unknown> | null {
  const raw =
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.GCP_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[vertex-gemma] invalid service account JSON in env:", err);
    return null;
  }
}

export function getVertexClient(): VertexAI {
  if (cached) return cached;
  const creds = parseServiceAccountKey();
  cached = new VertexAI({
    project: (creds?.project_id as string | undefined) || PROJECT_ID,
    location: LOCATION,
    googleAuthOptions: creds ? { credentials: creds as never } : undefined,
  });
  return cached;
}

export interface AskGemmaResult {
  text: string;
  modelId: string;
  finishReason?: string;
}

/**
 * Single-shot prompt to Gemma via Vertex AI. No streaming, no retries —
 * mirrors the founder's "Submit-only" pattern. Throws on quota / auth /
 * model-not-available errors so the caller can surface a clear message.
 */
export async function askGemma(text: string): Promise<AskGemmaResult> {
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new Error("askGemma: input text is required");
  }
  const vertex = getVertexClient();
  const model = vertex.getGenerativeModel({ model: MODEL });
  const request: GenerateContentRequest = {
    contents: [{ role: "user", parts: [{ text }] }],
  };
  const result = await model.generateContent(request);
  const candidate = result.response?.candidates?.[0];
  const partText = candidate?.content?.parts
    ?.map((p) => (typeof (p as { text?: string }).text === "string" ? (p as { text: string }).text : ""))
    .join("")
    .trim();
  return {
    text: partText || "",
    modelId: MODEL,
    finishReason: candidate?.finishReason,
  };
}
