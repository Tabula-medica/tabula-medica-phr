/**
 * Compliance guardrail tests for the AI surface.
 *
 * These tests are LOAD-BEARING for HIPAA posture. Failure of any test
 * here MUST block deploy. The tests fall into two groups:
 *
 *   1. Static repo invariants (no direct OpenAI/VertexAI SDK usage
 *      outside the adapter). Implemented as a filesystem grep with no
 *      dependency on a test runner being present, so the same logic can
 *      be lifted into a CI step or a pre-commit hook.
 *
 *   2. Behavioural assertions on aiClient.chatComplete: PHI requests
 *      with no eligible provider must throw PolicyBlockedError, NOT
 *      silently fall through to a non-BAA path.
 *
 * Wire-up: these are written framework-agnostic. To run under vitest or
 * jest, wrap the asserts in `describe`/`it` blocks. The repo currently
 * has no test runner registered, so this file doubles as an executable
 * spec the architect can run via `node --import tsx server/__tests__/ai-policy.test.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  chatComplete,
  PolicyBlockedError,
  __setTransportsForTest,
  type AICompleteResult,
} from "../ai-client";

const SERVER_DIR = path.resolve(__dirname, "..");

const ALLOWED_DIRECT_SDK_FILES = new Set<string>([
  // Adapter is the ONLY file allowed to import the Vertex / GenAI / OpenAI
  // SDKs directly. Task #108 folded the last two Phase-2 leftovers
  // (`gcp-vertex-ai-service.ts`, `vertex-deduplication-service.ts`) into
  // `chatComplete()`, so the allow-list is now exactly one file.
  path.join(SERVER_DIR, "ai-client.ts"),
]);

const FORBIDDEN_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "direct-openai-import", re: /from\s+["']openai["']/ },
  { name: "direct-openai-construct", re: /new\s+OpenAI\s*\(/ },
  // Both the deprecated `@google-cloud/vertexai` SDK and the modern
  // `@google/genai` SDK are forbidden outside the adapter. The adapter
  // uses `@google/genai` against Vertex AI under the GCP BAA; everything
  // else must go through `chatComplete()`.
  { name: "direct-vertex-import", re: /from\s+["']@google-cloud\/vertexai["']/ },
  { name: "direct-genai-import", re: /from\s+["']@google\/genai["']/ },
  { name: "replit-ai-proxy-base-url", re: /AI_INTEGRATIONS_OPENAI_BASE_URL/ },
];

// H-4 guardrail: the `server/replit_integrations/` template directory and the
// legacy `server/utils/disabled-openai-stub.ts` shim were deleted in Phase 4
// cleanup (Task #88). This guard remains in place so that nothing in the repo
// can reintroduce an import from those paths without explicitly tripping CI.
// Comments/doc strings referencing the path are ignored — only real
// import/require statements count.
const REPLIT_INTEGRATIONS_IMPORT_PATTERNS: RegExp[] = [
  /from\s+["'][^"']*replit_integrations[^"']*["']/,
  /require\s*\(\s*["'][^"']*replit_integrations[^"']*["']\s*\)/,
  /import\s*\(\s*["'][^"']*replit_integrations[^"']*["']\s*\)/,
  /from\s+["'][^"']*disabled-openai-stub[^"']*["']/,
  /require\s*\(\s*["'][^"']*disabled-openai-stub[^"']*["']\s*\)/,
  /import\s*\(\s*["'][^"']*disabled-openai-stub[^"']*["']\s*\)/,
];

function isUnderTests(file: string): boolean {
  return file.startsWith(path.join(SERVER_DIR, "__tests__") + path.sep);
}

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["__tests__", "node_modules"].includes(ent.name)) continue;
      walkTs(p, out);
    } else if (ent.isFile() && p.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

export function checkNoDirectSdkUsage(): { violations: Array<{ file: string; pattern: string; line: number }> } {
  const violations: Array<{ file: string; pattern: string; line: number }> = [];
  for (const file of walkTs(SERVER_DIR)) {
    if (ALLOWED_DIRECT_SDK_FILES.has(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((ln, i) => {
      for (const { name, re } of FORBIDDEN_PATTERNS) {
        if (re.test(ln)) violations.push({ file: path.relative(SERVER_DIR, file), pattern: name, line: i + 1 });
      }
    });
  }
  return { violations };
}

export function checkNoProductionTransportOverrides(serverDir = SERVER_DIR): {
  violations: Array<{ file: string; line: number; text: string }>;
} {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  function scan(dir: string): void {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, ent.name);
      if (file === path.join(serverDir, "__tests__") || ent.name === "node_modules") continue;
      if (ent.isDirectory()) {
        scan(file);
      } else if (ent.isFile()) {
        fs.readFileSync(file, "utf8").split("\n").forEach((text, i) => {
          if (!text.includes("__setTransportsForTest")) return;
          // Only the seam's declaration is exempt, not other uses in the adapter.
          if (file === path.join(serverDir, "ai-client.ts") &&
              text.trim() === "export function __setTransportsForTest(overrides: {") return;
          violations.push({ file: path.relative(serverDir, file), line: i + 1, text: text.trim() });
        });
      }
    }
  }
  scan(serverDir);
  return { violations };
}

export function checkNoReplitIntegrationsImports(): {
  violations: Array<{ file: string; line: number; text: string }>;
} {
  const violations: Array<{ file: string; line: number; text: string }> = [];
  for (const file of walkTs(SERVER_DIR)) {
    if (isUnderTests(file)) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((ln, i) => {
      for (const re of REPLIT_INTEGRATIONS_IMPORT_PATTERNS) {
        if (re.test(ln)) {
          violations.push({ file: path.relative(SERVER_DIR, file), line: i + 1, text: ln.trim() });
          break;
        }
      }
    });
  }
  return { violations };
}

// Credential env vars that gate Vertex eligibility in
// `integration-registry.ts`, plus the OpenAI-direct ones. We snapshot and
// fully control these per assertion so the suite behaves identically whether
// or not real GCP credentials are present in the ambient environment.
const CRED_ENV_VARS = [
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GCP_KEY",
  "OPENAI_API_KEY",
  "OPENAI_BAA_EXECUTED",
] as const;

function snapshotCredEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const k of CRED_ENV_VARS) saved[k] = process.env[k];
  return saved;
}

function restoreCredEnv(saved: Record<string, string | undefined>): void {
  for (const k of CRED_ENV_VARS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

function clearCredEnv(): void {
  for (const k of CRED_ENV_VARS) delete process.env[k];
}

/**
 * Fail-closed: a PHI request with NO eligible provider must throw
 * PolicyBlockedError BEFORE reaching any network transport.
 *
 * This no longer depends on real Application Default Credentials being
 * absent. We stub both transports so that even if the dispatch path were
 * (incorrectly) reached, we would observe a stub invocation rather than a
 * generic "Could not load the default credentials" error from the live
 * SDK. The assertion therefore distinguishes "policy correctly blocked the
 * call" from "GCP auth was never configured", and runs green offline.
 */
export async function checkFailClosedOnPHI(): Promise<{ ok: boolean; reason?: string }> {
  const saved = snapshotCredEnv();
  let transportCalls = 0;
  const restoreTransports = __setTransportsForTest({
    vertex: async () => {
      transportCalls += 1;
      return { content: "STUB", provider: "vertex_ai", model: "stub", usage: {}, latencyMs: 0, governanceCompliant: true } as AICompleteResult;
    },
    openai: async () => {
      transportCalls += 1;
      return { content: "STUB", provider: "openai_direct", model: "stub", usage: {}, latencyMs: 0, governanceCompliant: true } as AICompleteResult;
    },
  });
  // No eligible provider: clear every credential source the registry reads.
  clearCredEnv();
  try {
    await chatComplete({
      messages: [{ role: "user", content: "Summarize this lab result." }],
      dataCategories: ["lab_results"], // PHI
      purpose: "documentation",
      callerService: "test",
      callerMethod: "checkFailClosedOnPHI",
    });
    return { ok: false, reason: "Expected PolicyBlockedError, got success" };
  } catch (e) {
    if (!(e instanceof PolicyBlockedError)) {
      return { ok: false, reason: `Wrong error type: ${(e as Error).message}` };
    }
    if (transportCalls !== 0) {
      return { ok: false, reason: `Transport was reached ${transportCalls}x before fail-closed` };
    }
    return { ok: true };
  } finally {
    restoreTransports();
    restoreCredEnv(saved);
  }
}

/**
 * Allowed path: a PHI request WITH an eligible (BAA-covered) provider must
 * pass the governance gate and dispatch to the transport. Verified against
 * a stub so the assertion runs with no real ADC — it proves the guardrail
 * does not over-block compliant traffic and that routing reaches Vertex.
 */
export async function checkAllowedPHIPathReachesTransport(): Promise<{ ok: boolean; reason?: string }> {
  const saved = snapshotCredEnv();
  let vertexCalls = 0;
  const restoreTransports = __setTransportsForTest({
    vertex: async () => {
      vertexCalls += 1;
      return { content: "OK", provider: "vertex_ai", model: "stub", usage: {}, latencyMs: 0, governanceCompliant: true } as AICompleteResult;
    },
    openai: async () => {
      return { content: "WRONG", provider: "openai_direct", model: "stub", usage: {}, latencyMs: 0, governanceCompliant: true } as AICompleteResult;
    },
  });
  // Make Vertex eligible without any real credentials: a non-empty value is
  // all `isVertexEnabled()` checks. The stub means nothing actually parses or
  // dials the SDK, so this is safe offline.
  clearCredEnv();
  process.env.GCP_KEY = "test-stub-credential";
  try {
    const res = await chatComplete({
      messages: [{ role: "user", content: "Summarize this lab result." }],
      dataCategories: ["lab_results"], // PHI
      purpose: "documentation",
      callerService: "test",
      callerMethod: "checkAllowedPHIPathReachesTransport",
    });
    if (vertexCalls !== 1) {
      return { ok: false, reason: `Expected 1 vertex transport call, got ${vertexCalls}` };
    }
    if (res.provider !== "vertex_ai") {
      return { ok: false, reason: `Expected routing to vertex_ai, got ${res.provider}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Unexpected error on allowed path: ${(e as Error).message}` };
  } finally {
    restoreTransports();
    restoreCredEnv(saved);
  }
}

// Direct execution path: `node --import tsx server/__tests__/ai-policy.test.ts`
if (require.main === module) {
  (async () => {
    const r1 = checkNoDirectSdkUsage();
    if (r1.violations.length) {
      console.error("FAIL — direct SDK usage outside allow-list:");
      for (const v of r1.violations) console.error(`  ${v.file}:${v.line}  [${v.pattern}]`);
      process.exit(1);
    }
    const r3 = checkNoReplitIntegrationsImports();
    if (r3.violations.length) {
      console.error("FAIL — import from deleted replit_integrations/ or disabled-openai-stub detected:");
      for (const v of r3.violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
      process.exit(1);
    }
    const r5 = checkNoProductionTransportOverrides();
    if (r5.violations.length) {
      console.error("FAIL — test-only AI transport override referenced in production code:");
      for (const v of r5.violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
      process.exit(1);
    }
    const r2 = await checkFailClosedOnPHI();
    if (!r2.ok) { console.error("FAIL — fail-closed:", r2.reason); process.exit(1); }
    const r4 = await checkAllowedPHIPathReachesTransport();
    if (!r4.ok) { console.error("FAIL — allowed-path:", r4.reason); process.exit(1); }
    console.log("OK — ai-policy invariants hold");
  })().catch((e) => { console.error(e); process.exit(1); });
}
