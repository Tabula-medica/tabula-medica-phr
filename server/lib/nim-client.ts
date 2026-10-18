/**
 * NVIDIA NIM client — NON-PHI inference only.
 *
 * The hosted NIM API (integrate.api.nvidia.com) has NO BAA. This module is the only
 * file allowed to name the NIM host or read NVIDIA_API_KEY (enforced by
 * scripts/phi-ai-guard.sh), and callers must be listed in
 * scripts/phi-nim-allowlist.txt. Use it for public content, synthetic data, dev
 * tooling and embeddings/reranking of public text. Never pass patient data, record
 * content, or anything derived from a patient record. PHI-bearing AI goes through
 * server/services/ai-gateway.ts (Vertex, Google BAA).
 *
 * NVIDIA_NIM_BASE_URL may point at a self-hosted NIM, but that does not make it a
 * PHI path: the input screen below still applies and PHI use needs compliance review.
 */

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
const MAX_INPUT_CHARS = 20_000;
const TIMEOUT_MS = 60_000;

// Patterns that suggest a patient identifier slipped into a prompt.
const IDENTIFIER_PATTERNS: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email
  /\b\d{3}-?\d{2}-?\d{4}\b/, // SSN
  /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/, // US phone
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/, // date (DOB)
  /\d{6,}/, // MRN / member ID / long numeric id
];

export class NonPhiInputError extends Error {}

export interface NimChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function assertNonPhiText(text: string): string {
  const t = text.trim();
  if (!t) throw new NonPhiInputError("Input is required");
  if (t.length > MAX_INPUT_CHARS) throw new NonPhiInputError("Input is too long");
  if (IDENTIFIER_PATTERNS.some((p) => p.test(t))) {
    throw new NonPhiInputError("Input looks like it contains an identifier; remove it and retry");
  }
  return t;
}

export function isNimConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

async function nimPost<T>(path: string, body: unknown): Promise<T> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured");
  const baseUrl = (process.env.NVIDIA_NIM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NIM request failed with status ${res.status}`);
  return (await res.json()) as T;
}

export async function nimChat(
  model: string,
  messages: NimChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const screened = messages.map((m) => ({ ...m, content: assertNonPhiText(m.content) }));
  const data = await nimPost<{ choices?: { message?: { content?: string } }[] }>("/chat/completions", {
    model,
    messages: screened,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
  });
  return data.choices?.[0]?.message?.content ?? "";
}

export async function nimEmbed(
  model: string,
  inputs: string[],
  inputType: "query" | "passage" = "passage",
): Promise<number[][]> {
  const screened = inputs.map(assertNonPhiText);
  const data = await nimPost<{ data?: { embedding: number[] }[] }>("/embeddings", {
    model,
    input: screened,
    input_type: inputType,
    encoding_format: "float",
  });
  return (data.data ?? []).map((d) => d.embedding);
}
