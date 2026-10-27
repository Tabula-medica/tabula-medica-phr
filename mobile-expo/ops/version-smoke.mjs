#!/usr/bin/env node
// Post-publish version smoke test for tabulamedica.health.
//
// Hits the unauthenticated GET /api/version endpoint added in task #31 and
// asserts:
//   1. Response is HTTP 200.
//   2. Response body is JSON with a `sha` field that is NOT the literal
//      string "unknown" (proves the deploy actually baked a git SHA into
//      the running revision instead of falling back to the env default).
//
// Lives outside `scripts/` because that directory is reserved for build /
// deployment tooling — this is a runtime check against the live host.
//
// Usage:
//   API_BASE=https://api.tabulamedica.health   # default
//   node ops/version-smoke.mjs
//
// Exits 0 on success, 1 on any failure. Designed to be wired into the
// post-publish workflow (.github/workflows/deploy-cloudrun.yml) and the
// manual post-deploy smoke (.github/workflows/post-deploy-smoke.yml) so a
// stale or broken deploy is caught automatically.

const API_BASE = (process.env.API_BASE || "https://api.tabulamedica.health").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 15_000;

// Retry budget mirrors scripts/post-deploy-smoke.mjs so a Cloud Run cold
// start or a brief custom-domain rollover does not page the team. Real
// regressions still fail because we exit non-zero once the budget runs out.
const RETRY_BUDGET_MS = 30_000;
const RETRY_INITIAL_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 5_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchVersion() {
  const url = `${API_BASE}/api/version`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "tabula-medica-version-smoke/1.0",
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Leave body null; caller will surface the raw text.
    }
    return { status: res.status, body, raw: text };
  } finally {
    clearTimeout(timer);
  }
}

function assertVersion({ status, body, raw }) {
  if (status !== 200) {
    throw new Error(`expected HTTP 200, got ${status} — body: ${raw.slice(0, 200)}`);
  }
  if (!body || typeof body !== "object") {
    throw new Error(`expected JSON object body, got: ${raw.slice(0, 200)}`);
  }
  if (typeof body.sha !== "string" || body.sha.length === 0) {
    throw new Error(`expected string \`sha\` field, got: ${JSON.stringify(body)}`);
  }
  if (body.sha === "unknown") {
    throw new Error(
      `\`sha\` is "unknown" — the deploy did not bake a git SHA into the running revision. Body: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function run() {
  console.log(`==> Target: ${API_BASE}/api/version`);

  const deadline = Date.now() + RETRY_BUDGET_MS;
  let attempt = 0;
  let delay = RETRY_INITIAL_DELAY_MS;
  let lastError = null;

  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const response = await fetchVersion();
      const body = assertVersion(response);
      console.log(`  [PASS] /api/version returned 200 with sha=${body.sha}`);
      if (body.buildTimestamp) console.log(`         buildTimestamp=${body.buildTimestamp}`);
      if (body.nodeEnv) console.log(`         nodeEnv=${body.nodeEnv}`);
      console.log("Passed: 1/1");
      return 0;
    } catch (err) {
      lastError = err;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const wait = Math.min(delay, remaining, RETRY_MAX_DELAY_MS);
      console.log(`  [retry ${attempt}] ${err.message} — waiting ${wait}ms`);
      await sleep(wait);
      delay = Math.min(delay * 2, RETRY_MAX_DELAY_MS);
    }
  }

  console.log(`  [FAIL] /api/version — ${lastError ? lastError.message : "unknown error"}`);
  console.log("Passed: 0/1");
  return 1;
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`FATAL: ${err && err.stack ? err.stack : err}`);
    process.exit(1);
  },
);
