/**
 * Contract checker: verify reviewer-login smoke test and unit test stay in sync.
 *
 * Background
 * ----------
 * `scripts/smoke-test-reviewer-login.sh` and `server/__tests__/reviewer-login.test.ts`
 * are supposed to cover the same behavioral surface (login route response fields,
 * authenticated endpoint checks, demo-data seeding).  Comments alone cannot
 * enforce this — this test makes the sync requirement mechanical.
 * It also parses POST /api/auth/login in server/routes/clinical-1.ts and
 * requires every top-level JSON response field to map to a shell SYNC-CHECK.
 * New response fields must update LOGIN_FIELD_CHECKS in
 * helpers/login-response-contract.ts and add assertions in both test layers.
 *
 * How it works
 * ------------
 * Both files use a machine-readable annotation format:
 *
 *   Shell script:  # SYNC-CHECK: <id>
 *                  # SYNC-CHECK: <id> (live-only)
 *
 *   Unit test:     // SYNC-CHECK: <id>
 *
 * A `(live-only)` tag marks a check that can only be verified against the live
 * production endpoint (e.g. a route that does not exist in the in-process test
 * server).  All OTHER shell-script SYNC-CHECK tags must have a matching tag in
 * the unit test — if they don't, this test fails and blocks CI.
 *
 * Adding a new check to the shell script
 * ----------------------------------------
 * 1. Add `# SYNC-CHECK: <new-id>` near the new assertion in the shell script.
 * 2. Add `// SYNC-CHECK: <new-id>` near a real assertion in the unit test.
 * 3. Push — this test will pass, confirming both layers are in sync.
 *
 * Skipping in-process coverage for a check
 * ------------------------------------------
 * If a check is genuinely only testable against production (e.g. it relies on
 * a route or infrastructure not available in-process), mark it live-only:
 *   # SYNC-CHECK: <new-id> (live-only)
 * The contract checker will report it as informational rather than failing.
 *
 * Runs via:
 *   node --import tsx server/__tests__/reviewer-login-contract.test.ts
 * Auto-picked up by `npm run test:server`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loginResponseFields, uncoveredLoginFields } from "./helpers/login-response-contract";

// ─── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok    ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function info(label: string): void {
  console.log(`  info  ${label}`);
}

// ─── SYNC-CHECK tag extraction ────────────────────────────────────────────────

interface SyncCheckTag {
  id: string;
  liveOnly: boolean;
}

/**
 * Extract every `SYNC-CHECK:` tag from a file's content.
 *
 * Supported formats (the leading comment character varies by language):
 *   # SYNC-CHECK: login-200
 *   # SYNC-CHECK: data-sources (live-only)
 *   // SYNC-CHECK: login-200
 */
function extractSyncCheckTags(content: string): SyncCheckTag[] {
  const tags: SyncCheckTag[] = [];
  // Match:  (# or //)  SYNC-CHECK:  <id>  optional-(live-only)
  const pattern = /(?:#|\/\/)\s+SYNC-CHECK:\s+([a-z0-9-]+)(\s+\(live-only\))?/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    tags.push({ id: m[1], liveOnly: Boolean(m[2]) });
  }
  return tags;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ROOT = resolve(process.cwd());
const SHELL_SCRIPT = resolve(ROOT, "scripts/smoke-test-reviewer-login.sh");
const UNIT_TEST = resolve(ROOT, "server/__tests__/reviewer-login.test.ts");

console.log("\n=== Reviewer-login SYNC-CHECK contract verification ===");
console.log(`  shell script : ${SHELL_SCRIPT}`);
console.log(`  unit test    : ${UNIT_TEST}`);

let shellContent: string;
let unitContent: string;

try {
  shellContent = readFileSync(SHELL_SCRIPT, "utf-8");
} catch (e) {
  console.error(`FAIL  Cannot read shell script: ${e}`);
  process.exit(1);
}

try {
  unitContent = readFileSync(UNIT_TEST, "utf-8");
} catch (e) {
  console.error(`FAIL  Cannot read unit test: ${e}`);
  process.exit(1);
}

const shellTags = extractSyncCheckTags(shellContent);
const unitTagIds = new Set(extractSyncCheckTags(unitContent).map((t) => t.id));

// Reverse contract: new fields in either login branch must be represented in
// the shell contract, which is then checked against the unit-test tags below.
// Only top-level JSON envelope fields are inspected; user-id covers the
// storage-owned user object. Response spreads/opaque payloads fail closed.
const routeContent = readFileSync(resolve(ROOT, "server/routes/clinical-1.ts"), "utf-8");
const shellTagIds = new Set(shellTags.map((tag) => tag.id));
try {
  const uncovered = uncoveredLoginFields(routeContent, shellTagIds);
  ok(
    `login response fields have smoke checks (uncovered: ${uncovered.join(", ") || "none"}). ` +
      "Add a field mapping in helpers/login-response-contract.ts and matching SYNC-CHECK assertions in both layers",
    uncovered.length === 0,
  );
} catch (error) {
  ok(`login response source can be inspected: ${error}`, false);
}

// Mutation fixtures verify that the checker itself rejects future drift,
// independently of the current route's happy-path result.
const fixture = (payload: string) =>
  `app.post("/api/auth/login", async (req, res) => { res.json(${payload}); });`;
ok("new response field is rejected even when neither test layer mentions it",
  uncoveredLoginFields(fixture("{ accessToken, newFeature: true }"), shellTagIds).includes("newFeature"));
for (const [branch, replacement] of [
  ["return res.json({ user: safeUser,", "return res.json({ newFeature: true, user: safeUser,"],
  ['res.status(500).json({ error: "Failed to sign in"', 'res.status(500).json({ newFeature: true, error: "Failed to sign in"'],
]) {
  const mutated = routeContent.replace(branch, replacement);
  ok(`real route mutation is rejected: ${branch}`,
    mutated !== routeContent &&
      uncoveredLoginFields(mutated, shellTagIds).includes("newFeature"));
}
ok("missing shell tag is rejected for a known field",
  uncoveredLoginFields(fixture("{ refreshToken }"), new Set(["access-token"])).includes("refreshToken"));
ok("quoted and shorthand keys are read, unrelated routes and comments ignored",
  [...loginResponseFields(
    fixture('{ "accessToken": token, refreshToken }') +
    '\napp.post("/api/auth/other", (req, res) => res.json({ ignored: true }));' +
    '\n// res.json({ commentedOut: true });',
  )].sort().join(",") === "accessToken,refreshToken");
ok("fields from both reviewer and regular/error branches are read",
  [...loginResponseFields(
    'app.post("/api/auth/login", (req, res) => { if (reviewer) return res.json({ accessToken }); res.status(400).json({ error }); });',
  )].sort().join(",") === "accessToken,error");
for (const payload of ["{ ...result }", "{ [field]: true }", "result"]) {
  let rejected = false;
  try { loginResponseFields(fixture(payload)); } catch { rejected = true; }
  ok(`unsupported payload fails closed: ${payload}`, rejected);
}
for (const source of ["", fixture("{ user }") + fixture("{ user }")]) {
  let rejected = false;
  try { loginResponseFields(source); } catch { rejected = true; }
  ok("missing or duplicate login handler fails closed", rejected);
}

ok(
  "shell script contains at least one SYNC-CHECK tag",
  shellTags.length > 0,
);
ok(
  "unit test contains at least one SYNC-CHECK tag",
  unitTagIds.size > 0,
);

console.log(
  `\n  Shell script declares ${shellTags.length} SYNC-CHECK tag(s):`,
);

let liveOnlyCount = 0;
const missingIds: string[] = [];

for (const tag of shellTags) {
  if (tag.liveOnly) {
    liveOnlyCount++;
    info(`${tag.id}  →  live-only (no in-process assertion required)`);
    continue;
  }

  const covered = unitTagIds.has(tag.id);
  ok(
    `SYNC-CHECK: ${tag.id}  →  unit test has matching tag`,
    covered,
  );
  if (!covered) {
    missingIds.push(tag.id);
  }
}

if (liveOnlyCount > 0) {
  console.log(
    `\n  ${liveOnlyCount} live-only tag(s) skipped (production-only checks).`,
  );
}

if (missingIds.length > 0) {
  console.error(
    `\n  DRIFT DETECTED — the following check(s) exist in the shell script but have`,
  );
  console.error(
    `  no corresponding assertion in the unit test:\n`,
  );
  for (const id of missingIds) {
    console.error(`    - ${id}`);
  }
  console.error(
    `\n  To fix: add "// SYNC-CHECK: <id>" near a real assertion in`,
  );
  console.error(`  server/__tests__/reviewer-login.test.ts for each missing id.`);
  console.error(
    `  If in-process coverage is not feasible, change the shell script tag to`,
  );
  console.error(`  "# SYNC-CHECK: <id> (live-only)" instead.`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
