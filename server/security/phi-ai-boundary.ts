import OpenAI from "openai";

/**
 * Startup assertion for the PHI-AI boundary.
 *
 * This app carries PHI. PHI-bearing AI must go to Vertex AI (Google BAA) and
 * never to OpenAI, which has no BAA with us.
 *
 * The mechanism that enforces this is a build alias in `script/build.ts` that
 * redirects the bare `openai` specifier to `server/lib/vertex-openai.ts`. A
 * build alias is invisible at runtime: if it is dropped, every one of the ~280
 * files that does `import OpenAI from "openai"` silently gets the real SDK and
 * starts sending PHI to api.openai.com with whatever `OPENAI_API_KEY` is
 * mounted. That is exactly what was happening — the alias was described in the
 * shim's docstring but never actually existed.
 *
 * So the boundary is checked at boot instead of assumed. We construct a client
 * exactly the way the app does and read back the `baseURL` the SDK resolved. If
 * it is not the Vertex compat endpoint, the wiring is broken and the process
 * refuses to start rather than serving traffic that leaks PHI.
 *
 * Escape hatch: `AI_PROVIDER=openai` is an explicit human opt-in for non-PHI
 * environments (local dev, marketing-copy tooling). It is honoured, but it is
 * announced loudly, and it must never be set on a deployment that touches PHI.
 */

/** The Vertex OpenAI-compatible Chat Completions host. */
const VERTEX_HOST_SUFFIX = "-aiplatform.googleapis.com";

export class PhiAiBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhiAiBoundaryError";
  }
}

export interface BoundaryResult {
  /** Where AI traffic will actually go. */
  provider: "vertex" | "openai";
  /** The base URL the OpenAI SDK resolved for a default client. */
  baseURL: string;
}

/**
 * Resolve the base URL a default `new OpenAI()` actually points at.
 *
 * Exported for the test, which asserts the boundary without booting the server.
 */
export function resolveAiBaseUrl(): string {
  // An apiKey is required by the SDK constructor even when the shim ignores it.
  const client = new OpenAI({ apiKey: "phi-ai-boundary-probe" }) as unknown as {
    baseURL?: string;
  };
  return String(client.baseURL ?? "");
}

/**
 * Verify PHI-bearing AI is routed to a BAA-covered endpoint.
 *
 * @throws {PhiAiBoundaryError} when the app would send PHI to a non-BAA endpoint.
 */
export function assertPhiAiBoundary(): BoundaryResult {
  const explicitOpenAi = (process.env.AI_PROVIDER || "").toLowerCase() === "openai";
  const baseURL = resolveAiBaseUrl();

  if (explicitOpenAi) {
    // Honoured, but never quietly: a PHI deployment that reaches this branch is
    // misconfigured, and the operator needs to see it in the boot log.
    console.warn(
      "[phi-ai-boundary] AI_PROVIDER=openai — AI traffic is going to OpenAI, " +
        "which has NO BAA. This is only valid for environments with no PHI. " +
        `Resolved baseURL: ${baseURL}`,
    );
    return { provider: "openai", baseURL };
  }

  if (!baseURL.includes(VERTEX_HOST_SUFFIX)) {
    throw new PhiAiBoundaryError(
      "PHI-AI BOUNDARY BROKEN — refusing to start.\n" +
        `A default OpenAI client resolved to "${baseURL}", not Vertex AI.\n` +
        "PHI-bearing AI would be sent to an endpoint with no BAA.\n\n" +
        "Almost certainly the build alias mapping `openai` -> " +
        "`server/lib/vertex-openai.ts` is missing from script/build.ts, which " +
        "leaves the Vertex shim as unreachable dead code.\n\n" +
        "Fix the alias. Do not set AI_PROVIDER=openai to get past this on a " +
        "deployment that handles PHI — that routes patient data to OpenAI.",
    );
  }

  return { provider: "vertex", baseURL };
}
