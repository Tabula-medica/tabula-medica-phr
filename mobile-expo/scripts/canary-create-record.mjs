#!/usr/bin/env node
// Canary: deliberately exercise POST /api/records in production so the
// Task #13 `[Records]` instrumentation in `server/routes/create-record-handler.ts`
// actually fires. Created for Task #127.
//
// Flow (all against API_BASE, default https://api.tabulamedica.health):
//   1. GET  /api/version       -> log SHA + build timestamp + node env
//   2. POST /api/auth/login    -> obtain accessToken with reviewer creds
//   3. POST /api/records       -> create a clearly-labelled canary record
//   4. GET  /api/records/:id   -> confirm round-trip
//   5. DELETE /api/records/:id -> clean up so we don't leave PHI-shaped
//                                 strings in the prod table
//
// After running, tail prod logs for `[Records]` and `[Reviewer] createDemoData`
// to confirm the diagnostic instrumentation fired. If step (3) returns 500,
// the prod logs will now contain a `[Records] storage.createHealthRecord failed:`
// stack — paste that into the task / gotcha. If (3) returns 201 but you see
// `[Records] awardPoints failed (non-blocking):` warnings, that pins the
// gamification-schema-drift hypothesis. If (3) returns 201 with no warnings,
// the path is healthy end-to-end and the gotcha can be closed.
//
// Usage:
//   REVIEWER_EMAIL=...
//   REVIEWER_PASSWORD=...
//   API_BASE=https://api.tabulamedica.health   # default
//   node scripts/canary-create-record.mjs
//
// Exits 0 if every step succeeds (login 200, create 201, get 200, delete 200).
// Exits 1 otherwise. The canary record is best-effort deleted even on
// intermediate failure.

const API_BASE = (process.env.API_BASE || "https://api.tabulamedica.health").replace(/\/+$/, "");
const REVIEWER_EMAIL = process.env.REVIEWER_EMAIL;
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD;

if (!REVIEWER_EMAIL || !REVIEWER_PASSWORD) {
  console.error(
    "ERROR: REVIEWER_EMAIL and REVIEWER_PASSWORD env vars are required.\n" +
      "       Use the same credentials as scripts/post-deploy-smoke.mjs.",
  );
  process.exit(2);
}

const TIMEOUT_MS = 15_000;

async function req(method, path, { token, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "tabula-medica-canary-create-record/1.0",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      /* leave null */
    }
    return { status: res.status, json, text };
  } catch (err) {
    return { status: 0, json: null, text: "", error: err };
  } finally {
    clearTimeout(timer);
  }
}

function fail(msg, ctx) {
  console.error(`  FAIL  ${msg}`);
  if (ctx) console.error(`        ${typeof ctx === "string" ? ctx : JSON.stringify(ctx).slice(0, 400)}`);
}

function ok(msg, ctx) {
  console.log(`  PASS  ${msg}${ctx ? ` — ${ctx}` : ""}`);
}

async function main() {
  console.log(`==> Target: ${API_BASE}`);
  console.log(`==> Reviewer email: ${REVIEWER_EMAIL}`);
  console.log();

  // 1. /api/version (prove which build is actually live)
  console.log("[1/5] GET /api/version");
  const ver = await req("GET", "/api/version");
  if (ver.status !== 200 || !ver.json) {
    fail(`version endpoint not reachable (status=${ver.status})`, ver.text);
    process.exit(1);
  }
  ok("version", `sha=${ver.json.sha} built=${ver.json.buildTimestamp} env=${ver.json.nodeEnv}`);

  // 2. login
  console.log("\n[2/5] POST /api/auth/login");
  const login = await req("POST", "/api/auth/login", {
    body: { email: REVIEWER_EMAIL, password: REVIEWER_PASSWORD },
  });
  if (login.status !== 200 || !login.json?.accessToken) {
    fail(`login failed (status=${login.status})`, login.text);
    process.exit(1);
  }
  const token = login.json.accessToken;
  ok("login", `accessToken ${token.length} chars, user.id=${login.json.id || "?"}`);

  // 3. POST /api/records  — clearly labelled canary
  console.log("\n[3/5] POST /api/records (canary)");
  const canary = {
    type: "note",
    title: `CANARY task-127 ${new Date().toISOString()}`,
    summary:
      "Synthetic canary record created by scripts/canary-create-record.mjs " +
      "to fire the Task #13 [Records] instrumentation. Safe to delete.",
    provider: "Tabula Medica Internal Canary",
    facility: "n/a",
    date: new Date().toISOString(),
  };
  const create = await req("POST", "/api/records", { token, body: canary });
  if (create.status !== 201 || !create.json?.id) {
    fail(`create failed (status=${create.status}) — check prod logs for [Records] storage.createHealthRecord failed:`, create.text);
    process.exit(1);
  }
  const recordId = create.json.id;
  ok("create", `201, record.id=${recordId}`);

  // Track failures across the remaining steps so we always attempt cleanup
  // (step 5) even if step 4 fails, but still exit non-zero if anything failed.
  let postCreateFailures = 0;

  // 4. GET round-trip
  console.log("\n[4/5] GET /api/records/:id (round-trip)");
  const get = await req("GET", `/api/records/${recordId}`, { token });
  if (get.status !== 200 || !get.json?.id) {
    fail(`round-trip GET failed (status=${get.status})`, get.text);
    postCreateFailures += 1;
    // still try to clean up below
  } else {
    ok("round-trip", `title="${(get.json.title || "").slice(0, 60)}"`);
  }

  // 5. DELETE cleanup — always attempted, even if step 4 failed
  console.log("\n[5/5] DELETE /api/records/:id (cleanup)");
  const del = await req("DELETE", `/api/records/${recordId}`, { token });
  if (del.status !== 200) {
    fail(`cleanup DELETE failed (status=${del.status}) — please delete record ${recordId} manually`, del.text);
    postCreateFailures += 1;
  } else {
    ok("cleanup", `deleted ${recordId}`);
  }

  if (postCreateFailures > 0) {
    console.error(`\nCanary FAILED: ${postCreateFailures} post-create step(s) did not pass.`);
    process.exit(1);
  }

  console.log("\n================================");
  console.log("Canary complete. Now tail production logs for:");
  console.log("  [Records] storage.createHealthRecord failed:    (a 500 in step 3)");
  console.log("  [Records] awardPoints failed (non-blocking):    (gamification drift)");
  console.log("  [Records] incrementRecordsLogged failed (...):  (gamification drift)");
  console.log("  [Records] auditLog failed (non-blocking):       (audit-log drift)");
  console.log("If none of those appear, the path is healthy end-to-end.");
  console.log("================================");
}

main().catch((err) => {
  console.error("Unexpected canary error:", err);
  process.exit(1);
});
