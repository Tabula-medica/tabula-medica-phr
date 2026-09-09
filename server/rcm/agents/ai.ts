// Optional AI seam for the agents. Off by default (RCM_AI_ENABLED != "true") so every agent
// is deterministic in dev/test. When on, prompts route through server/services/ai-provider
// (Vertex by default under the GCP BAA; the provider is fail-closed).
import { generateText } from "../../services/ai-provider";

export function aiEnabled(): boolean {
  return (process.env.RCM_AI_ENABLED ?? "false").toLowerCase() === "true";
}

export async function aiJson<T>(system: string, user: string, parse: (text: string) => T, fallback: () => T, feature = "rcm"): Promise<{ value: T; source: string }> {
  if (!aiEnabled()) return { value: fallback(), source: "stub" };
  try {
    const text = await generateText({ systemPrompt: system, userPrompt: user, temperature: 0.1, maxTokens: 1500, responseFormat: "json" }, feature);
    return { value: parse(text), source: "vertex" };
  } catch (e) {
    console.error("[rcm/ai] generation failed; using deterministic fallback:", e instanceof Error ? e.message : e);
    return { value: fallback(), source: "stub-fallback" };
  }
}

export async function aiText(system: string, user: string, fallback: string, feature = "rcm"): Promise<{ text: string; source: string }> {
  if (!aiEnabled()) return { text: fallback, source: "stub" };
  try {
    const text = await generateText({ systemPrompt: system, userPrompt: user, temperature: 0.2, maxTokens: 1200 }, feature);
    return { text, source: "vertex" };
  } catch (e) {
    console.error("[rcm/ai] generation failed; using deterministic fallback:", e instanceof Error ? e.message : e);
    return { text: fallback, source: "stub-fallback" };
  }
}
