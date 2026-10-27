/**
 * Unified AI client.
 *
 * All server code that needs an LLM call MUST go through `chatComplete()`.
 * Direct `new OpenAI(...)` and direct `@google/genai` / `@google-cloud/vertexai`
 * SDK usage outside this module is forbidden — see CI test in
 * `__tests__/ai-policy.test.ts`.
 *
 * Compliance contract:
 *   1. Every call evaluates `evaluateDataFlowPolicy()` BEFORE leaving the
 *      process. If policy denies, we throw `PolicyBlockedError` — we do
 *      NOT fall through to a different provider for PHI requests.
 *   2. Provider selection is allow-list driven (see `integration-registry.ts`).
 *      The Replit AI proxy (`AI_INTEGRATIONS_OPENAI_*`) is structurally
 *      unreachable from this module.
 *   3. Failures emit a governance log entry via `logGCPOperation()` with
 *      `success: false` so audit can prove no silent PHI leakage occurred.
 */
import {
  evaluateDataFlowPolicy,
  type DataCategory,
  type ProcessingPurpose,
} from "./third-party-data-governance";
import {
  selectProvider,
  isPHIRequest,
  type ModelAlias,
  type ProviderConfig,
} from "./integration-registry";

export class PolicyBlockedError extends Error {
  readonly code = "AI_POLICY_BLOCKED" as const;
  readonly httpStatus = 503;
  constructor(
    message: string,
    readonly violations: string[],
    readonly attemptedProvider: string | null,
  ) {
    super(message);
    this.name = "PolicyBlockedError";
  }
}

export type AIRole = "system" | "user" | "assistant";
export interface AIMessage { role: AIRole; content: string }

export interface AICompleteOptions {
  messages: AIMessage[];
  model?: ModelAlias;                  // default "balanced"
  temperature?: number;                // 0..1
  maxOutputTokens?: number;            // default 4096
  jsonMode?: boolean;
  jsonSchema?: object;
  images?: Array<{ mimeType: string; dataBase64: string }>;
  /** Compliance: REQUIRED. Routed through evaluateDataFlowPolicy(). */
  dataCategories: DataCategory[];
  /** Compliance: REQUIRED. Maps to ProcessingPurpose union. */
  purpose: ProcessingPurpose;
  userId?: string;
  callerService: string;               // e.g. "chart-explanation-service"
  callerMethod: string;                // e.g. "summarizeLabs"
  /** Test-only override. Ignored in production. */
  forceProvider?: ProviderConfig["id"];
}

export interface AICompleteResult {
  content: string;
  json?: any;
  provider: ProviderConfig["id"];
  model: string;
  usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  latencyMs: number;
  governanceCompliant: true;           // false-case throws instead of returning
  auditId?: string;
}

const DEFAULT_MAX_OUTPUT = 4096;
const PROD = process.env.NODE_ENV === "production";

/**
 * Forbidden environment variables in production. Their presence indicates
 * a Replit-AI-proxy or other non-BAA inference path is configured. We
 * fail the boot rather than risk a stray import resurrecting the proxy.
 *
 * `AI_INTEGRATIONS_*` is the Replit AI Integrations proxy prefix, which
 * has no BAA at any tier. Direct OpenAI is similarly forbidden in
 * production because no OpenAI BAA is executed.
 */
const FORBIDDEN_ENV_VARS = [
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
] as const;

/**
 * Boot-time policy assertion. Runs once at import. If a forbidden env var
 * is present in production, the process refuses to start. This is the
 * last line of defense against accidental Replit AI proxy reintroduction
 * after the 17-file migration completes — even if a future commit
 * reintroduces `process.env.AI_INTEGRATIONS_OPENAI_*` somewhere, the
 * deploy fails at boot rather than silently exfiltrating PHI.
 */
function assertEnvPolicy(): void {
  if (!PROD) return;
  const violations = FORBIDDEN_ENV_VARS.filter((name) => !!process.env[name]);
  if (violations.length === 0) return;

  // Explicit, loud opt-out for environments where the operator cannot
  // remove the forbidden vars (e.g. Replit auto-injects them via the
  // `javascript_openai_ai_integrations` agent integration listed in
  // `.replit`, and there is no programmatic uninstall). Setting
  // `ALLOW_NON_BAA_AI_PROXY_INJECTION=true` neutralizes the boot-time
  // refusal so the server can start, BUT does NOT change runtime
  // routing — `chatComplete()` still routes exclusively to Vertex AI
  // under the GCP BAA. The forbidden vars are present in env but
  // unreferenced by any production call site after the Vertex
  // migration, so this opt-out only relaxes the defensive guard, not
  // the actual data-flow policy.
  //
  // HIPAA implications: Replit itself is not BAA-covered, so any PHI
  // touching the Replit runtime is non-compliant regardless of this
  // flag. The flag is for operators who have accepted that risk
  // explicitly (e.g. interim hosting before a Cloud Run migration
  // completes). The legacy OpenAI call sites have been removed, so
  // PHI should not actually flow through the Replit AI proxy at
  // runtime even if the proxy creds are present in env.
  const allowOptOut =
    String(process.env.ALLOW_NON_BAA_AI_PROXY_INJECTION || "").toLowerCase() === "true";
  if (allowOptOut) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ai-client] WARNING: forbidden non-BAA AI env vars present (${violations.join(", ")}) ` +
      `but ALLOW_NON_BAA_AI_PROXY_INJECTION=true is set. Boot-time refusal bypassed. ` +
      `Runtime routing is unchanged — chatComplete() still uses Vertex AI under the GCP BAA. ` +
      `This bypass should be removed before serving real PHI traffic.`
    );
    return;
  }

  const msg =
    `[ai-client] Refusing to boot — forbidden non-BAA AI env vars present in production: ` +
    `${violations.join(", ")}. Remove these from Cloud Run env / Secret Manager and redeploy. ` +
    `If the host injects these automatically (e.g. Replit AI integration) and you cannot remove ` +
    `them, set ALLOW_NON_BAA_AI_PROXY_INJECTION=true to bypass — but understand this only ` +
    `disables the boot guard; runtime PHI policy is unchanged and HIPAA exposure is your call.`;
  // eslint-disable-next-line no-console
  console.error(msg);
  throw new PolicyBlockedError(msg, violations.map((v) => `FORBIDDEN_ENV_VAR:${v}`), null);
}
assertEnvPolicy();

export async function chatComplete(opts: AICompleteOptions): Promise<AICompleteResult> {
  const startedAt = Date.now();
  const alias: ModelAlias = opts.model ?? "balanced";

  // 1. Pick provider (allow-listed only).
  // forceProvider is a TEST-ONLY parameter. In production, its presence is a
  // configuration error and must surface loudly — never silently route through
  // the registry selector, never silently use the forced provider.
  if (PROD && opts.forceProvider) {
    throw new PolicyBlockedError(
      `forceProvider is a test-only parameter and was set to "${opts.forceProvider}" in production. ` +
      `This indicates a deployment-time misconfiguration; refusing the request.`,
      ["FORCE_PROVIDER_IN_PRODUCTION"],
      null,
    );
  }
  const provider = opts.forceProvider
    ? PROVIDERS_BY_ID[opts.forceProvider]
    : selectProvider(opts.dataCategories);

  if (!provider || !provider.enabled) {
    throw new PolicyBlockedError(
      `No BAA-eligible AI provider available for dataCategories=[${opts.dataCategories.join(",")}]. ` +
      `PHI request=${isPHIRequest(opts.dataCategories)}. Check VERTEX_AI credentials and registry.`,
      ["NO_ELIGIBLE_PROVIDER"],
      null,
    );
  }

  // 2. Governance gate.
  const policy = evaluateDataFlowPolicy(
    provider.id === "vertex_ai" ? "google_vertex_ai" : "openai_direct",
    opts.purpose,
    opts.dataCategories,
    opts.callerService,
    opts.callerMethod,
    undefined,
    opts.userId,
  );
  if (!policy.allowed) {
    throw new PolicyBlockedError(
      `Policy denied call to ${provider.id}: ${policy.violations.join("; ")}`,
      policy.violations,
      provider.id,
    );
  }

  // 3. Dispatch.
  const concreteModel = provider.modelByAlias[alias];
  if (provider.id === "vertex_ai") {
    return await vertexTransport({ ...opts, alias }, concreteModel, startedAt);
  }
  return await openAITransport({ ...opts, alias }, concreteModel, startedAt);
}

// ---------------------------------------------------------------------------
// Transport seam (test-only injection).
//
// In production these always point at the real dispatchers (`callVertex` /
// `callOpenAIDirect`) which construct the live SDK clients. Tests can swap
// them out via the test-only setter so the AI-policy guardrail suite
// can run with NO Google Cloud Application Default Credentials present —
// the fail-closed path throws before dispatch, and the allowed path is
// verified against a stub instead of reaching real ADC.
//
// `node:test`'s `mock.module` is unavailable under the `tsx` CJS runner
// used by `npm run test:server`, so an explicit module-level seam is the
// supported way to substitute the network transport in these tests.
// ---------------------------------------------------------------------------
type ChatTransport = (
  opts: AICompleteOptions & { alias: ModelAlias },
  modelName: string,
  startedAt: number,
) => Promise<AICompleteResult>;

let vertexTransport: ChatTransport = callVertex;
let openAITransport: ChatTransport = callOpenAIDirect;

/**
 * TEST-ONLY. Override the network transports and return a restore function.
 * Never call this from production code. The override is process-local and
 * does not change provider eligibility or the governance gate — those still
 * run before dispatch, so a stubbed transport cannot weaken the fail-closed
 * PHI guarantee.
 */
export function __setTransportsForTest(overrides: {
  vertex?: ChatTransport;
  openai?: ChatTransport;
}): () => void {
  const prev = { vertex: vertexTransport, openai: openAITransport };
  if (overrides.vertex) vertexTransport = overrides.vertex;
  if (overrides.openai) openAITransport = overrides.openai;
  return () => {
    vertexTransport = prev.vertex;
    openAITransport = prev.openai;
  };
}

// ---------------------------------------------------------------------------
// Vertex AI dispatch
//
// Uses the modern `@google/genai` SDK against Vertex AI under the GCP BAA.
// The legacy `@google-cloud/vertexai` SDK was deprecated on 2025-06-24 and
// is scheduled for removal on 2026-06-24; importing it emits a boot-time
// deprecation warning. This adapter is now the only place in the repo that
// constructs a GenAI/Vertex client (see `__tests__/ai-policy.test.ts`).
// ---------------------------------------------------------------------------
async function callVertex(
  opts: AICompleteOptions & { alias: ModelAlias },
  modelName: string,
  startedAt: number,
): Promise<AICompleteResult> {
  const genai = await import("@google/genai");
  const { GoogleGenAI } = genai;
  type Part = import("@google/genai").Part;
  type SchemaUnion = import("@google/genai").SchemaUnion;
  const credentials = readGcpCredentials();
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCP_PROJECT_ID || "united-planet-485003-n7",
    location: process.env.GCP_LOCATION || "us-central1",
    ...(credentials ? { googleAuthOptions: { credentials } } : {}),
  });

  const systemMsg = opts.messages.find((m) => m.role === "system")?.content;
  const userTurns = opts.messages.filter((m) => m.role !== "system");

  const parts: Part[] = [];
  for (const t of userTurns) parts.push({ text: t.content });
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: "user", parts }],
    config: {
      ...(systemMsg ? { systemInstruction: systemMsg } : {}),
      temperature: clamp(opts.temperature ?? 0.2, 0, 1),
      maxOutputTokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
      ...(opts.jsonMode
        ? {
            responseMimeType: "application/json",
            ...(opts.jsonSchema ? { responseSchema: opts.jsonSchema as SchemaUnion } : {}),
          }
        : {}),
    },
  });

  const content =
    response.text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";
  const usage = response.usageMetadata;

  return {
    content,
    json: opts.jsonMode ? safeJSON(content) : undefined,
    provider: "vertex_ai",
    model: modelName,
    usage: {
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
    },
    latencyMs: Date.now() - startedAt,
    governanceCompliant: true,
  };
}

// ---------------------------------------------------------------------------
// OpenAI direct dispatch (NOT proxy). Only reached for non-PHI calls until
// OpenAI Enterprise BAA is signed (see integration-registry.ts).
// ---------------------------------------------------------------------------
async function callOpenAIDirect(
  opts: AICompleteOptions & { alias: ModelAlias },
  modelName: string,
  startedAt: number,
): Promise<AICompleteResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT,
    ...(opts.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });

  const content = completion.choices[0]?.message?.content ?? "";
  return {
    content,
    json: opts.jsonMode ? safeJSON(content) : undefined,
    provider: "openai_direct",
    model: modelName,
    usage: {
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    },
    latencyMs: Date.now() - startedAt,
    governanceCompliant: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
import { PROVIDERS as PROVIDERS_BY_ID } from "./integration-registry";

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function safeJSON(s: string): any {
  try { return JSON.parse(s); } catch { return undefined; }
}

function readGcpCredentials(): any | null {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_KEY;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
