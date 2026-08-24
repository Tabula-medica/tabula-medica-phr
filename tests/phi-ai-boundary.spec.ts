import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The PHI-AI boundary is enforced by a build alias, which is invisible at
 * runtime and was missing for the entire life of this repository — the shim
 * documented it, `deploy-world.sh` set `AI_PROVIDER=vertex` as though it worked,
 * and no check ever confirmed it. Every audit read those three artefacts and
 * concluded PHI was on Vertex while ~280 files talked to api.openai.com.
 *
 * These tests assert the mechanism itself exists, so a silent removal fails CI
 * instead of shipping.
 */

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("PHI-AI boundary: build alias", () => {
  const buildScript = read("script/build.ts");

  it("redirects the bare `openai` specifier to the Vertex shim", () => {
    expect(
      /alias:\s*\{[^}]*\bopenai\s*:/s.test(buildScript),
      "script/build.ts must alias `openai` to server/lib/vertex-openai.ts. " +
        "Without it the shim is dead code and every `import OpenAI from \"openai\"` " +
        "sends PHI to OpenAI, which has no BAA.",
    ).toBe(true);
    expect(buildScript).toContain("server/lib/vertex-openai.ts");
  });

  it("still bundles the openai package so the alias target resolves", () => {
    // The shim imports the real SDK by relative node_modules path; `openai`
    // must stay on the bundle allowlist rather than being externalised.
    expect(buildScript).toMatch(/"openai",/);
  });
});

describe("PHI-AI boundary: the shim", () => {
  const shim = read("server/lib/vertex-openai.ts");

  it("defaults to Vertex when AI_PROVIDER is unset", () => {
    // Fail-safe direction matters: an absent env must not mean OpenAI.
    expect(shim).toMatch(/process\.env\.AI_PROVIDER\s*\|\|\s*"vertex"/);
  });

  it("points at the Vertex OpenAI-compatible endpoint", () => {
    expect(shim).toContain("-aiplatform.googleapis.com");
  });

  it("imports the real SDK by relative path, not the aliased specifier", () => {
    // A bare `import ... from "openai"` here would alias back onto the shim
    // and recurse forever once the alias is active.
    expect(shim).toContain("node_modules/openai/index.js");
    expect(shim).not.toMatch(/^import\s+RealOpenAI\s+from\s+"openai"/m);
  });
});

describe("PHI-AI boundary: runtime assertion", () => {
  const boundary = read("server/security/phi-ai-boundary.ts");
  const serverIndex = read("server/index.ts");

  it("is wired into server startup", () => {
    expect(serverIndex).toContain("assertPhiAiBoundary");
    expect(serverIndex).toContain('from "./security/phi-ai-boundary"');
  });

  it("fails closed rather than warning", () => {
    expect(boundary).toContain("throw new PhiAiBoundaryError");
  });

  it("only accepts a Vertex host as BAA-covered", () => {
    expect(boundary).toContain("-aiplatform.googleapis.com");
  });
});

describe("PHI-AI boundary: deployment", () => {
  const deployWorld = read("deploy-world.sh");

  it("does not set AI_PROVIDER=openai on the PHI deployment", () => {
    expect(deployWorld).not.toMatch(/AI_PROVIDER=openai/);
  });

  it("sets the Vertex project the shim needs", () => {
    expect(deployWorld).toContain("AI_PROVIDER=vertex");
    expect(deployWorld).toMatch(/VERTEX_PROJECT_ID=/);
  });
});
