#!/usr/bin/env node
// Post-deploy smoke test for tabulamedica.health.
//
// Run this against the LIVE production host after every backend publish to
// catch the auth-flow regressions the App Store reviewer would otherwise hit.
//
// Checks:
//   1. GET  /api/health           -> 200 with { database: "connected" }
//   2. POST /api/auth/login       -> 200 + accessToken (reviewer credentials)
//   3. POST /api/auth/login       -> 200 + accessToken when email is sent
//                                   with leading/trailing whitespace AND
//                                   mixed case (regression guard for the
//                                   email-normalization fix from build 63).
//   4. POST /api/auth/apple       -> 401 with { code: "APPLE_IDENTITY_TOKEN_INVALID" }
//                                   when called with a bogus identity token
//                                   (proves the new SIWA error shape is live,
//                                   not the old generic "Sign in failed").
//
// Each check is retried with exponential backoff (up to ~30s total) so that
// transient blips during a Cloud Run cold-start or custom-domain rollover do
// not page the team for an otherwise-healthy deploy. Real regressions still
// fail because the script keeps exiting non-zero once the retry budget is
// exhausted.
//
// Usage:
//   REVIEWER_EMAIL=...
//   REVIEWER_PASSWORD=...
//   API_BASE=https://api.tabulamedica.health   # default
//   node scripts/post-deploy-smoke.mjs
//
// Exits 0 if every check passes, 1 otherwise.

const API_BASE = (process.env.API_BASE || "https://api.tabulamedica.health").replace(/\/+$/, "");
const REVIEWER_EMAIL = process.env.REVIEWER_EMAIL;
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD;

if (!REVIEWER_EMAIL || !REVIEWER_PASSWORD) {
  console.error(
    "ERROR: REVIEWER_EMAIL and REVIEWER_PASSWORD env vars are required.\n" +
      "       These are the App Store reviewer credentials documented in\n" +
      "       .local/reviewer-reply-build23.md."
  );
  process.exit(2);
}

const REQUEST_TIMEOUT_MS = 15_000;

// Retry budget: ~30 seconds per check, with exponential backoff capped at 5s.
// This absorbs Cloud Run cold-starts and the brief window when the custom
// domain mapping at api.tabulamedica.health re-points at the new revision.
const RETRY_BUDGET_MS = 30_000;
const RETRY_INITIAL_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 5_000;

const results = [];
let failures = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const tag = ok ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(method, path, { body, headers } = {}) {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "tabula-medica-post-deploy-smoke/1.0",
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      // leave json null, callers can inspect text
    }
    return { status: res.status, json, text };
  } catch (err) {
    return { status: 0, json: null, text: "", error: err };
  } finally {
    clearTimeout(timer);
  }
}

// Run a check function with retries and exponential backoff. The check
// function must return an object of the form { records: [{ name, ok, detail }, ...] }
// without calling `record` directly — we only commit the FINAL attempt's
// records to the global results so a successful retry overwrites earlier
// transient failures.
async function runWithRetry(label, checkFn) {
  const start = Date.now();
  let delay = RETRY_INITIAL_DELAY_MS;
  let attempt = 0;
  let lastResult = { records: [] };

  while (true) {
    attempt += 1;
    if (attempt > 1) {
      console.log(`  [retry] ${label}: attempt ${attempt}…`);
    }
    lastResult = await checkFn();
    const allOk = lastResult.records.length > 0 && lastResult.records.every((r) => r.ok);

    if (allOk) {
      if (attempt > 1) {
        const elapsed = Date.now() - start;
        console.log(`  [retry] ${label}: passed on attempt ${attempt} after ${elapsed}ms`);
      }
      return lastResult;
    }

    const elapsed = Date.now() - start;
    if (elapsed + delay >= RETRY_BUDGET_MS) {
      if (attempt > 1) {
        console.log(
          `  [retry] ${label}: giving up after ${attempt} attempts ` +
            `(${elapsed}ms elapsed, retry budget ${RETRY_BUDGET_MS}ms)`
        );
      }
      return lastResult;
    }

    const failedNames = lastResult.records
      .filter((r) => !r.ok)
      .map((r) => r.name)
      .join(", ");
    console.log(
      `  [retry] ${label}: transient failure on attempt ${attempt} ` +
        `(${failedNames || "no records"}); retrying in ${delay}ms`
    );

    await sleep(delay);
    delay = Math.min(delay * 2, RETRY_MAX_DELAY_MS);
  }
}

async function checkHealth() {
  const records = [];
  const res = await request("GET", "/api/health");
  if (res.error) {
    records.push({
      name: "health endpoint reachable",
      ok: false,
      detail: `network error: ${res.error.message || res.error}`,
    });
    return { records };
  }
  records.push({
    name: "health endpoint returns 200",
    ok: res.status === 200,
    detail: `status=${res.status}`,
  });
  const dbConnected = res.json && res.json.database === "connected";
  records.push({
    name: 'health body has database: "connected"',
    ok: !!dbConnected,
    detail: dbConnected ? undefined : `body=${(res.text || "").slice(0, 200)}`,
  });
  return { records };
}

async function checkLogin(label, email, password) {
  const records = [];
  const res = await request("POST", "/api/auth/login", { body: { email, password } });
  if (res.error) {
    records.push({
      name: `${label}: request completes`,
      ok: false,
      detail: `network error: ${res.error.message || res.error}`,
    });
    return { records };
  }
  records.push({
    name: `${label}: returns 200`,
    ok: res.status === 200,
    detail: `status=${res.status}`,
  });
  const token = res.json && typeof res.json.accessToken === "string" ? res.json.accessToken : "";
  records.push({
    name: `${label}: response includes accessToken`,
    ok: token.length > 0,
    detail: token.length > 0 ? `${token.length} chars` : `body=${(res.text || "").slice(0, 200)}`,
  });
  return { records };
}

async function checkAppleBogusToken() {
  const records = [];
  const res = await request("POST", "/api/auth/apple", {
    body: {
      identityToken: "not.a.real.apple.identity.token",
      appleId: "smoke-test-bogus",
    },
  });
  if (res.error) {
    records.push({
      name: "apple bogus token: request completes",
      ok: false,
      detail: `network error: ${res.error.message || res.error}`,
    });
    return { records };
  }
  records.push({
    name: "apple bogus token: returns 401",
    ok: res.status === 401,
    detail: `status=${res.status}`,
  });
  const code = res.json && res.json.code;
  records.push({
    name: 'apple bogus token: code === "APPLE_IDENTITY_TOKEN_INVALID"',
    ok: code === "APPLE_IDENTITY_TOKEN_INVALID",
    detail: code ? `code=${code}` : `body=${(res.text || "").slice(0, 200)}`,
  });
  return { records };
}

function commitRecords(result) {
  for (const r of result.records) {
    record(r.name, r.ok, r.detail);
  }
}

async function main() {
  console.log(`==> Target: ${API_BASE}`);
  console.log(`==> Reviewer email: ${REVIEWER_EMAIL}`);
  console.log(
    `==> Retry budget per check: ${RETRY_BUDGET_MS}ms ` +
      `(initial backoff ${RETRY_INITIAL_DELAY_MS}ms, max ${RETRY_MAX_DELAY_MS}ms)`
  );

  console.log("\n[1/4] GET /api/health");
  commitRecords(await runWithRetry("health", checkHealth));

  console.log("\n[2/4] POST /api/auth/login (reviewer credentials, exact)");
  commitRecords(
    await runWithRetry("login (exact)", () => checkLogin("login (exact)", REVIEWER_EMAIL, REVIEWER_PASSWORD))
  );

  console.log("\n[3/4] POST /api/auth/login (whitespace + mixed-case email)");
  const messyEmail = `  ${REVIEWER_EMAIL.toUpperCase()}  `;
  commitRecords(
    await runWithRetry("login (normalized)", () =>
      checkLogin("login (normalized)", messyEmail, REVIEWER_PASSWORD)
    )
  );

  console.log("\n[4/4] POST /api/auth/apple (bogus identity token)");
  commitRecords(await runWithRetry("apple bogus token", checkAppleBogusToken));

  const passed = results.length - failures;
  console.log("\n================================");
  console.log(`Passed: ${passed}    Failed: ${failures}    Total: ${results.length}`);
  console.log("================================");

  if (failures > 0) {
    console.error(
      "\nOne or more production smoke checks FAILED after the full retry\n" +
        "budget was exhausted. This is NOT a transient cold-start blip —\n" +
        "investigate before telling the App Store reviewer the build is\n" +
        "ready for re-test. Tail production logs with: gcloud run services\n" +
        "logs tail (or the deployment skill) and re-run this script after\n" +
        "fixing."
    );
    process.exit(1);
  }
  console.log("\nAll production auth smoke checks passed.");
}

main().catch((err) => {
  console.error("Unexpected smoke-test error:", err);
  process.exit(1);
});
