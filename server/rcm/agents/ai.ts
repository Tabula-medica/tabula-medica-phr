// Optional AI seam for the agents. Off by default (RCM_AI_ENABLED != "true") so every agent
// is deterministic in dev/test. When on, prompts route through server/services/ai-provider
// (Vertex by default under the GCP BAA).
import { generateText, getProviderForFeature } from "../../services/ai-provider";

export function aiEnabled(): boolean {
  return (process.env.RCM_AI_ENABLED ?? "false").toLowerCase() === "true";
}

// generateText resolves its provider from the global default / per-feature admin overrides
// (server/ai-provider-routes.ts), neither of which is pinned to Vertex for RCM's own feature
// ids. These prompts carry real PHI (patient name, DOS, CPT/ICD, dollar amounts) — actually
// enforce fail-closed here rather than trusting that global config never drifts to a non-BAA
// provider, instead of just labeling every success "vertex" regardless of what really ran.
function assertVertexProvider(feature: string): void {
  const provider = getProviderForFeature(feature);
  if (provider !== "vertex") throw new Error(`RCM AI feature "${feature}" is configured for "${provider}", not the BAA-covered Vertex provider — refusing to send PHI-bearing content to a non-BAA provider`);
}

export async function aiJson<T>(system: string, user: string, parse: (text: string) => T, fallback: () => T, feature = "rcm"): Promise<{ value: T; source: string }> {
  if (!aiEnabled()) return { value: fallback(), source: "stub" };
  try {
    assertVertexProvider(feature);
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
    assertVertexProvider(feature);
    const text = await generateText({ systemPrompt: system, userPrompt: user, temperature: 0.2, maxTokens: 1200 }, feature);
    return { text, source: "vertex" };
  } catch (e) {
    console.error("[rcm/ai] generation failed; using deterministic fallback:", e instanceof Error ? e.message : e);
    return { text: fallback, source: "stub-fallback" };
  }
}
