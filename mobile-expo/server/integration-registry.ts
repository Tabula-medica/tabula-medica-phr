/**
 * AI Integration Registry — allow-listed providers and model aliases.
 *
 * Single source of truth consumed by `server/ai-client.ts`. Anything not
 * declared here cannot be invoked at runtime.
 *
 * Provider entries here are the AI-routing layer; the legal/governance
 * registry (BAA/DPA scope, allowed data categories) lives in
 * `server/third-party-data-governance.ts`. Both must agree before a
 * provider is usable for a given DataCategory set.
 *
 * NEVER add a provider here without:
 *   1. A corresponding entry in `third-party-data-governance.ts` with
 *      `baaStatus: "executed"` for any PHI-touching DataCategory, AND
 *   2. PM written confirmation that the BAA scope covers the listed
 *      models.
 */
import type { DataCategory } from "./third-party-data-governance";

export type ProviderId = "vertex_ai" | "openai_direct";
export type ModelAlias = "fast" | "balanced" | "deep" | "vision";

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  /** Whether this provider is permitted to receive PHI under its current BAA. */
  phiEligible: boolean;
  /** Concrete model name per alias. */
  modelByAlias: Record<ModelAlias, string>;
}

/**
 * PHI-bearing data categories. If a request's `dataCategories` intersects
 * this set, the caller MUST be routed to a `phiEligible: true` provider
 * or the adapter throws PolicyBlockedError (fail-closed).
 */
export const PHI_CATEGORIES: ReadonlySet<DataCategory> = new Set<DataCategory>([
  "demographics",
  "conditions",
  "medications",
  "lab_results",
  "vitals",
  "allergies",
  "immunizations",
  "appointments",
  "insurance",
  "clinical_notes",
  "imaging",
  "genomics",
  "contact_info",
  "identifiers",
  // Architect-flagged additions: device telemetry (CGM, pacemaker, wearable
  // streams) and behavioural data (mood, sleep, activity logs) are PHI in a
  // clinical-record context and must route to BAA-eligible processors only.
  "device_data",
  "behavioral",
]);

export function isPHIRequest(categories: readonly DataCategory[]): boolean {
  return categories.some((c) => PHI_CATEGORIES.has(c));
}

/**
 * Provider eligibility is evaluated from the environment ON EVERY ACCESS,
 * not cached at module load. This is load-bearing for the HIPAA
 * fail-closed guarantee: if the GCP credentials disappear (or were never
 * configured), `selectProvider()` must immediately observe the provider
 * as disabled and refuse PHI rather than reaching the Vertex SDK with no
 * credentials. Caching `enabled` at import time defeated that guarantee
 * and made the fail-closed compliance test unable to exercise the
 * no-eligible-provider path (the cached `true` survived an env reset).
 *
 * Re-reading env per call is cheap and also means rotated/late-injected
 * credentials are picked up without a process restart. To force a
 * re-evaluation explicitly (e.g. in tests) just mutate `process.env` and
 * call `selectProvider()` / read `PROVIDERS[id].enabled` again.
 */
function isVertexEnabled(): boolean {
  return !!(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
     process.env.GOOGLE_APPLICATION_CREDENTIALS ||
     process.env.GCP_KEY);
}

/**
 * OpenAI direct (i.e. NOT via Replit AI proxy). Enabled only when the
 * canonical `OPENAI_API_KEY` is set AND `OPENAI_BAA_EXECUTED=true`.
 *
 * NOTE: `AI_INTEGRATIONS_OPENAI_*` is the Replit AI proxy path and is
 * intentionally NOT consulted here. Routing through the Replit proxy is
 * a non-BAA path for this project per the locked AI provider decision
 * (2026-05-03) and must remain structurally unreachable from this module.
 */
function isOpenAIDirectEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY && process.env.OPENAI_BAA_EXECUTED === "true";
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  vertex_ai: {
    id: "vertex_ai",
    // Getter: re-reads env on every access so credential changes (or an
    // env reset in the fail-closed test) take effect immediately.
    get enabled() { return isVertexEnabled(); },
    phiEligible: true, // Covered by signed GCP BAA on united-planet-485003-n7
    modelByAlias: {
      fast: "gemini-2.0-flash-001",
      balanced: "gemini-2.5-flash",
      deep: "gemini-2.5-pro",
      vision: "gemini-2.5-pro",
    },
  },
  openai_direct: {
    id: "openai_direct",
    get enabled() { return isOpenAIDirectEnabled(); },
    phiEligible: false, // Flip to true ONLY after OpenAI Enterprise BAA signed.
    modelByAlias: {
      fast: "gpt-4o-mini",
      balanced: "gpt-4o",
      deep: "gpt-4o",
      vision: "gpt-4o",
    },
  },
};

/**
 * Pick the highest-priority enabled provider that is allowed to handle
 * the given data categories. Returns null if none qualifies (caller must
 * fail-closed with PolicyBlockedError).
 *
 * Priority: vertex_ai → openai_direct. There is intentionally no third
 * tier — silently falling back to a non-BAA proxy is the bug class this
 * module exists to prevent.
 */
export function selectProvider(categories: readonly DataCategory[]): ProviderConfig | null {
  const phi = isPHIRequest(categories);
  for (const id of ["vertex_ai", "openai_direct"] as const) {
    const p = PROVIDERS[id];
    if (!p.enabled) continue;
    if (phi && !p.phiEligible) continue;
    return p;
  }
  return null;
}
