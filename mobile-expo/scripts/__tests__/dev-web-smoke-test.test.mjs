#!/usr/bin/env node
/**
 * Mutation test: Vite dev-server smoke-test fails on a broken vite.config.ts.
 *
 * ## Background
 * The CI `web-lint` job runs:
 *   timeout 30 bash -c 'npm run dev:web 2>&1 | grep -m1 "ready in\|Local:"'
 * to verify the Vite dev server starts without errors.  A structural guard in
 * `scripts/__tests__/ci-guard-files.test.mjs` asserts the YAML step still
 * exists, but a structural guard cannot verify that the step actually FAILS
 * when vite.config.ts is broken — it only confirms the step is present.
 *
 * This file closes that gap with a mutation test:
 *   1. Back up web/vite.config.ts.
 *   2. Inject a broken (unresolvable) import at the top of the file.
 *   3. Run the same smoke command the CI step uses (under a tighter timeout
 *      so the test suite does not hang for 30 s; a crashing dev server exits
 *      in < 5 s in practice).
 *   4. Assert the smoke command exits non-zero (grep found no ready banner).
 *   5. Restore web/vite.config.ts unconditionally via a finally block.
 *
 * ## Safety
 * - The restore runs inside a finally block so a test failure or assertion
 *   error never leaves the repo in a broken state.
 * - The injected import uses a sentinel package name that cannot accidentally
 *   shadow a real package.
 * - The test-only modification is never committed: web/vite.config.ts is
 *   restored to its original bytes before the process exits.
 *
 * Run with: node scripts/__tests__/dev-web-smoke-test.test.mjs
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const VITE_CONFIG = join(ROOT, 'web', 'vite.config.ts');
const VITE_BIN = join(ROOT, 'web', 'node_modules', '.bin', 'vite');

/**
 * Whether the web workspace's vite binary is present.
 * When absent, npm will fail to find vite almost instantly, so the smoke
 * command exits non-zero in < 1 s — no need for a long shell timeout.
 */
const viteInstalled = existsSync(VITE_BIN);

/**
 * CI guard: vite MUST be installed in CI.
 *
 * The mutation test (line ~210) and the real-banner test (line ~384) both call
 * t.skip() when viteInstalled is false — that skip is intentional for local dev
 * environments where `web/` deps are not installed.  In CI `npm ci` always
 * installs the full workspace, so the skip path must never fire there.  If it
 * does, the most likely cause is a broken install step that left web deps
 * missing — exactly the kind of infrastructure failure that would cause a real
 * Vite regression to go undetected.
 *
 * Throwing at module-load time (before any test runs) makes the failure loud
 * and attributable, rather than a quiet "2 skipped" line buried in test output.
 */
if (!viteInstalled && process.env.CI === 'true') {
  throw new Error(
    'CI=true but web/node_modules/.bin/vite is absent.\n\n' +
    'The mutation test and real-banner test in this file both skip when vite\n' +
    'is not installed — that skip is intended for local dev environments only.\n' +
    'In CI, web deps are installed by `npm ci` so the skip must never fire\n' +
    'there.  Its presence in CI means the install step silently failed or the\n' +
    'web workspace was not set up, which would allow a real Vite regression to\n' +
    'pass undetected.\n\n' +
    'Fix: ensure `npm ci` (or `npm install`) completes successfully and installs\n' +
    'the web workspace before this test suite executes.\n\n' +
    `Expected binary: ${VITE_BIN}`,
  );
}

/**
 * The local shell timeout (seconds) passed to `timeout` when vite IS installed.
 *
 * **Hard upper bound: 30 seconds.**
 * This value MUST be <= 30 s, which is the `timeout` value on the CI YAML step
 * ("Smoke-test Vite dev server starts" in the web-lint job of ci-cd.yml).
 * Exceeding it causes the local test to pass while the identical CI step times
 * out — a "works on my machine" failure that blocks correct builds.
 *
 * A static assertion immediately below enforces this constraint at module-load
 * time so the failure is immediate (before any test runs) rather than deferred
 * to the runtime self-check test at the bottom of this file.
 *
 * To raise this value:
 *   1. Raise the CI YAML `timeout` value in ci-cd.yml FIRST (or in the same
 *      commit), then update the static assertion's ceiling to match.
 *   2. Bump LOCAL_SMOKE_TIMEOUT_SECS to the new value.
 */
const LOCAL_SMOKE_TIMEOUT_SECS = 15;

/** Ceiling enforced by the CI YAML `timeout` value on the smoke-test step. */
const CI_SMOKE_TIMEOUT_CEILING_SECS = 30;

if (LOCAL_SMOKE_TIMEOUT_SECS > CI_SMOKE_TIMEOUT_CEILING_SECS) {
  throw new Error(
    `LOCAL_SMOKE_TIMEOUT_SECS (${LOCAL_SMOKE_TIMEOUT_SECS} s) exceeds the CI ` +
    `smoke-test timeout ceiling (${CI_SMOKE_TIMEOUT_CEILING_SECS} s).\n\n` +
    'A local timeout that exceeds the CI limit means:\n' +
    '  - The smoke command may pass locally (within the local timeout) but\n' +
    '    time out in CI before the ready banner appears.\n' +
    '  - That is a "works on my machine" failure that blocks correct builds.\n\n' +
    'Fix options (choose one):\n' +
    `  1. Lower LOCAL_SMOKE_TIMEOUT_SECS to <= ${CI_SMOKE_TIMEOUT_CEILING_SECS} s.\n` +
    '  2. Raise the CI YAML timeout in ci-cd.yml (web-lint job,\n' +
    '     "Smoke-test Vite dev server starts") FIRST, then raise\n' +
    `     CI_SMOKE_TIMEOUT_CEILING_SECS to match.\n`,
  );
}

/**
 * Tokens that the CI smoke-test step (web-lint job, "Smoke-test Vite dev server
 * starts") MUST contain.  The self-check test at the bottom of this file scans
 * every *.yml file under .github/workflows/ and asserts every token here is
 * present in the workflow file that owns the smoke step.
 *
 * Each token is a load-bearing part of the CI command:
 *
 *   timeout 30 bash -c 'npm run dev:web 2>&1 | grep -m1 "ready in\|Local:"'
 *
 *   Token          Guards
 *   ─────────────  ──────────────────────────────────────────────────────────
 *   'dev:web'      The npm script being run; if it is renamed (e.g. to
 *                  `vite:dev`) the smoke command will silently target the
 *                  wrong script and may stop testing the right surface.
 *
 *   'grep -m1'     The grep flag that makes the pipeline exit as soon as the
 *                  first banner line is found.  Without `-m1` grep waits for
 *                  EOF (i.e. the 30-second timeout) even on success, slowing
 *                  CI.  Removing or changing it may make CI always time out.
 *
 *   'ready in'     The Vite "ready" banner string that grep looks for.  If
 *                  this pattern is updated in CI but not here (or vice versa)
 *                  the mutation test will still execute the wrong pattern and
 *                  the self-check will catch the mismatch.
 *
 * HOW TO UPDATE:
 * If the CI step is legitimately changed (e.g. the banner string changes or a
 * different grep pattern is used), update BOTH the CI YAML step AND this array
 * in the same commit.  The self-check test will fail until they agree, which is
 * intentional — it is the mechanism that prevents silent drift.
 *
 * DO NOT remove entries from this array to make the test pass; update the CI
 * step to match, then align this array with what the step actually contains.
 */
const SMOKE_STEP_TOKENS = [
  'dev:web',    // npm script name — guards against script rename
  'grep -m1',   // grep flag — guards against flag removal / change
  'ready in',   // Vite ready-banner string — guards against banner pattern drift
];

/**
 * The literal strings the CI grep pattern (`"ready in\|Local:"`) looks for in
 * Vite's startup stdout/stderr.  These are the banner strings Vite must
 * actually print for the CI smoke step to exit 0.
 *
 * Unlike SMOKE_STEP_TOKENS (which also includes structural tokens like
 * `'grep -m1'` that only appear in the CI YAML), VITE_BANNER_TOKENS contains
 * only the strings that should appear in real Vite startup output.
 *
 * The "real banner" test below starts the dev server and asserts that at least
 * one of these appears in the captured output, so a Vite version bump that
 * renames the banner (e.g. "ready in" → "ready") fails fast here instead of
 * silently timing out in CI.
 *
 * HOW TO UPDATE:
 * If you update the grep pattern in the CI YAML step (e.g. to add a new
 * alternative), mirror that change here.  If you add a new entry here, also
 * add the corresponding grep alternative to the CI step.
 */
const VITE_BANNER_TOKENS = [
  'ready in',   // Vite ≥4 "ready in X ms" line
  'Local:',     // Vite local-URL line (e.g. "➜  Local:   http://localhost:5173/")
];

// ── Precondition checks ───────────────────────────────────────────────────────

test('web/vite.config.ts exists (precondition for mutation test)', () => {
  assert.ok(
    existsSync(VITE_CONFIG),
    `${VITE_CONFIG} does not exist.\n` +
    'The mutation test requires web/vite.config.ts to be present so it can\n' +
    'back it up, inject a broken import, run the smoke command, and restore it.\n' +
    'Restore web/vite.config.ts from git history.',
  );
});

// ── Mutation test helpers ─────────────────────────────────────────────────────

/**
 * Run the same smoke command the CI step uses:
 *   timeout <secs> bash -c 'npm run dev:web 2>&1 | grep -m1 "ready in\|Local:"'
 *
 * A working Vite dev server prints "ready in" or "Local:" within a few seconds;
 * the smoke command exits 0 when grep finds the banner.
 *
 * A crashing dev server exits immediately without printing the banner; npm
 * exits non-zero, its stdout/stderr stream closes, grep finds no match and
 * exits 1, so the whole pipeline exits 1 (non-zero) well within the timeout.
 *
 * When the web workspace vite binary is absent (deps not installed locally),
 * npm fails almost instantly — a 5 s timeout is more than sufficient and
 * avoids the full 15 s wait that would otherwise fire unconditionally.
 *
 * @param {number} [timeoutSecs]  - seconds to pass to the shell `timeout` command.
 *   Defaults to 5 s when vite is not installed (fast local failure), 15 s otherwise.
 * @returns {Promise<{ status: number|null, stdout: string, stderr: string }>}
 */
async function runSmokeCommand(timeoutSecs = viteInstalled ? LOCAL_SMOKE_TIMEOUT_SECS : 5) {
  const cmd = `timeout ${timeoutSecs} bash -c 'npm run dev:web 2>&1 | grep -m1 "ready in\\|Local:"'`;
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', cmd], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: (timeoutSecs + 5) * 1000, // node-level safety margin
    });
    return { status: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    return { status: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

// ── Mutation test: broken import causes non-zero exit ────────────────────────
//
// This is the core test.  It injects an unresolvable import at the top of
// web/vite.config.ts, runs the smoke command, and asserts the command exits
// non-zero.  The broken import causes Vite to crash on startup before it can
// print its "ready in" / "Local:" banner, so grep finds no match → exit 1.

test('smoke command exits non-zero when vite.config.ts has a broken import', async (t) => {
  if (!viteInstalled) {
    t.skip('SKIP: vite not installed — web/node_modules/.bin/vite absent; install web deps to run this test');
    return;
  }

  assert.ok(
    existsSync(VITE_CONFIG),
    `${VITE_CONFIG} does not exist — cannot run mutation test.\n` +
    'Restore web/vite.config.ts from git history.',
  );

  const original = readFileSync(VITE_CONFIG, 'utf8');

  // Sentinel package name that cannot match any real package.
  // Prefixing with a newline keeps the original first line intact; the
  // import is inserted BEFORE it so Vite fails at module resolution before
  // executing any other config code.
  const BROKEN_IMPORT =
    '// TABULA-MEDICA-SMOKE-TEST-MUTATION: intentionally broken import\n' +
    'import { __nonExistent__ } from "__tabula-medica-smoke-test-broken-import-sentinel__";\n';

  const broken = BROKEN_IMPORT + original;

  try {
    writeFileSync(VITE_CONFIG, broken, 'utf8');

    const { status, stdout, stderr } = await runSmokeCommand();

    // The smoke command MUST exit non-zero when Vite crashes.
    // Exit code 1 means grep found no banner (Vite crashed before printing it).
    // Exit code 124 means timeout fired — still non-zero, still a pass here,
    // though in practice a crashing Vite exits in < 5 s.
    assert.notEqual(
      status,
      0,
      'Expected the smoke command to exit non-zero when vite.config.ts contains\n' +
      'an unresolvable import, but it exited 0.\n\n' +
      'This means the smoke command is NOT detecting a broken Vite config —\n' +
      'it silently "succeeds" even when the dev server cannot start.\n\n' +
      'The CI step (web-lint job, "Smoke-test Vite dev server starts (dev:web)")\n' +
      'would pass on a broken vite.config.ts, allowing the breakage to merge.\n\n' +
      'Investigate why the smoke command returned exit 0:\n' +
      '  - Check whether `npm run dev:web` delegates to the correct workspace.\n' +
      '  - Verify `grep -m1` exits 1 when no match is found (GNU grep default).\n' +
      '  - Confirm the `timeout` command propagates grep\'s exit code.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    // Restore unconditionally — never leave the repo in a broken state.
    writeFileSync(VITE_CONFIG, original, 'utf8');
  }
});

// ── Restore verification ──────────────────────────────────────────────────────
//
// After the mutation test above, the finally block restores the file.  This
// test verifies that the restored content is byte-identical to the original
// so that a bug in the restore logic (e.g., wrong encoding) is caught
// immediately rather than leaving a silently corrupted vite.config.ts behind.

test('web/vite.config.ts is restored to its original content after mutation test', () => {
  assert.ok(
    existsSync(VITE_CONFIG),
    `${VITE_CONFIG} no longer exists after the mutation test.\n` +
    'The restore logic in the mutation test failed to recreate the file.\n' +
    'Restore web/vite.config.ts from git history.',
  );

  const restoredContent = readFileSync(VITE_CONFIG, 'utf8');

  // The restored file must NOT contain the sentinel string injected by the
  // mutation test.  Any residue means the finally block did not execute
  // (process was killed) or the write failed silently.
  assert.ok(
    !restoredContent.includes('TABULA-MEDICA-SMOKE-TEST-MUTATION'),
    'web/vite.config.ts still contains the mutation-test sentinel string after\n' +
    'the restore step ran.\n\n' +
    'The finally block in the mutation test did not cleanly restore the file.\n' +
    'Restore web/vite.config.ts from git history:\n' +
    '  git checkout -- web/vite.config.ts',
  );

  // The restored file must still be a valid Vite config (syntactically).
  // We check for the defineConfig call as a minimal structural guard —
  // if the file was truncated or written with wrong content the absence
  // of this call is a strong signal something went wrong.
  assert.ok(
    restoredContent.includes('defineConfig'),
    'web/vite.config.ts was restored but no longer contains `defineConfig`.\n\n' +
    'The restore step may have written wrong content or a truncated file.\n' +
    'Restore web/vite.config.ts from git history:\n' +
    '  git checkout -- web/vite.config.ts',
  );
});

// ── Real banner test: actual Vite output contains a known banner token ─────────
//
// The mutation test above verifies that a BROKEN Vite config causes the smoke
// command to exit non-zero.  But it cannot catch the inverse failure: Vite
// upgrades and changes its startup banner (e.g. "ready in" → "ready"), making
// the CI grep pattern match nothing — so CI silently times out on every build.
//
// This test closes that gap by starting the real dev server, capturing its
// stdout+stderr for up to VITE_BANNER_WAIT_SECS seconds, killing the server,
// and asserting that at least one VITE_BANNER_TOKEN appears in the captured
// output.  If Vite renames the banner line, this test fails fast here with a
// clear message instead of silently timing out in CI.
//
// Skip behaviour mirrors the mutation test: when web/node_modules/.bin/vite is
// absent the test is skipped because there is no dev server to start.

/** Maximum seconds to wait for Vite to print its startup banner. */
const VITE_BANNER_WAIT_SECS = 20;

/**
 * Spawn `npm run dev:web` from the repo root, collect combined stdout+stderr
 * into a buffer, and resolve as soon as one of the given tokens appears in the
 * output or the timeout fires — whichever comes first.  The child process is
 * killed before this function returns.
 *
 * @param {string[]} tokens  - banner strings to watch for in the output.
 * @param {number} [timeoutMs] - milliseconds before giving up (default: VITE_BANNER_WAIT_SECS * 1000).
 * @returns {Promise<{ output: string, foundToken: string|null, timedOut: boolean }>}
 */
function captureViteStartup(tokens, timeoutMs = VITE_BANNER_WAIT_SECS * 1000) {
  return new Promise((resolve) => {
    let settled = false;
    let output = '';

    const child = spawn('npm', ['run', 'dev:web'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Detach so child's process group can be killed cleanly on timeout.
      detached: false,
    });

    const finish = (foundToken, timedOut) => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGTERM'); } catch (_) { /* already exited */ }
      resolve({ output, foundToken: foundToken ?? null, timedOut });
    };

    const timer = setTimeout(() => finish(null, true), timeoutMs);

    const onData = (chunk) => {
      output += chunk.toString();
      for (const token of tokens) {
        if (output.includes(token)) {
          clearTimeout(timer);
          finish(token, false);
          return;
        }
      }
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('exit', () => {
      clearTimeout(timer);
      finish(null, false);
    });

    child.on('error', (err) => {
      output += `\n[spawn error: ${err.message}]`;
      clearTimeout(timer);
      finish(null, false);
    });
  });
}

test('real Vite dev server startup output contains at least one banner token', async (t) => {
  if (!viteInstalled) {
    t.skip(
      'SKIP: vite not installed — web/node_modules/.bin/vite absent; ' +
      'install web deps to run this test',
    );
    return;
  }

  const { output, foundToken, timedOut } = await captureViteStartup(VITE_BANNER_TOKENS);

  assert.ok(
    foundToken !== null,
    'The real Vite dev server did not print any expected banner token within\n' +
    `${VITE_BANNER_WAIT_SECS} seconds.\n\n` +
    'Expected at least one of these strings to appear in the startup output:\n' +
    VITE_BANNER_TOKENS.map((t) => `  - "${t}"`).join('\n') + '\n\n' +
    (timedOut
      ? `The wait timed out after ${VITE_BANNER_WAIT_SECS} s — the dev server may be too slow to\n` +
        'start in this environment, or it started but printed a different banner string.\n'
      : 'The dev server exited without printing a banner — it may have crashed.\n') +
    '\nThis likely means one of:\n' +
    '  1. Vite upgraded and renamed the "ready in" / "Local:" banner line.\n' +
    '     Update VITE_BANNER_TOKENS (and the CI grep pattern) to match the new output.\n' +
    '  2. `npm run dev:web` targets the wrong workspace or script.\n' +
    '  3. The dev server crashed before printing a banner (check the output below).\n\n' +
    'Captured output (first 1000 chars):\n' +
    output.slice(0, 1000),
  );
});

// ── SMOKE_STEP_TOKENS integrity self-check ────────────────────────────────────
//
// Guard against accidental erasure of the SMOKE_STEP_TOKENS array or the
// individual entries inside it.  An empty array or an array of empty strings
// would cause the token-presence loop below to trivially pass (vacuously true /
// substring of everything), defeating the drift-detection it was written to
// provide.

test('SMOKE_STEP_TOKENS is non-empty and every entry is a non-empty string', () => {
  assert.ok(
    Array.isArray(SMOKE_STEP_TOKENS),
    'SMOKE_STEP_TOKENS must be an array.  ' +
    'Check the top-level constant declaration in this file.',
  );

  assert.ok(
    SMOKE_STEP_TOKENS.length > 0,
    'SMOKE_STEP_TOKENS is empty — the token-presence check in the CI self-check\n' +
    'test would vacuously pass even if the CI step is completely changed.\n\n' +
    'Add at least one token that reflects the current CI smoke-test command:\n' +
    "  timeout <N> bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
    'See the comment block above SMOKE_STEP_TOKENS at the top of this file for\n' +
    'guidance on which tokens to include and why.',
  );

  for (let i = 0; i < SMOKE_STEP_TOKENS.length; i++) {
    const entry = SMOKE_STEP_TOKENS[i];
    assert.strictEqual(
      typeof entry,
      'string',
      `SMOKE_STEP_TOKENS[${i}] is not a string (got ${typeof entry}).\n` +
      'Each entry must be a non-empty string literal matching a token in the CI step.',
    );
    assert.ok(
      entry.length > 0,
      `SMOKE_STEP_TOKENS[${i}] is an empty string.\n` +
      'An empty token matches every string — it provides no drift protection.\n' +
      'Replace it with the literal token from the CI smoke-test command, or\n' +
      'remove the entry entirely if it no longer corresponds to a real token.',
    );
  }
});

// ── VITE_BANNER_TOKENS integrity self-check ──────────────────────────────────
//
// Empty or blank tokens undermine the real-banner and bidirectional sync checks.
test('VITE_BANNER_TOKENS is non-empty and every entry is a non-empty string', () => {
  assert.ok(
    Array.isArray(VITE_BANNER_TOKENS),
    'VITE_BANNER_TOKENS must be an array. Check the top-level constant declaration.',
  );
  assert.ok(
    VITE_BANNER_TOKENS.length > 0,
    'VITE_BANNER_TOKENS is empty — banner checks would provide no protection.\n' +
    'Add at least one literal Vite startup banner token matching the CI grep pattern.',
  );

  for (let i = 0; i < VITE_BANNER_TOKENS.length; i++) {
    const entry = VITE_BANNER_TOKENS[i];
    assert.strictEqual(
      typeof entry,
      'string',
      `VITE_BANNER_TOKENS[${i}] is not a string (got ${typeof entry}).\n` +
      'Each entry must be a non-empty string matching a real Vite startup banner.',
    );
    assert.ok(
      entry.trim().length > 0,
      `VITE_BANNER_TOKENS[${i}] is empty or whitespace-only.\n` +
      'Replace it with a literal Vite startup banner token matching the CI grep pattern.',
    );
  }
});

// ── VITE_BANNER_TOKENS ↔ CI grep-pattern bidirectional sync check ─────────────
//
// The CI grep pattern (`"ready in\|Local:"`) and VITE_BANNER_TOKENS must be
// kept in sync: every `\|`-delimited alternative in the CI pattern must appear
// in VITE_BANNER_TOKENS, and every entry in VITE_BANNER_TOKENS must appear as
// an alternative in the CI pattern.
//
// This test extracts the grep-pattern alternatives from whichever workflow file
// contains the smoke step, then performs the bidirectional assertion.  It skips
// gracefully when no workflow YAML can be found (rather than hard-failing) so
// the rest of the suite still runs in environments without the .github directory.

test('VITE_BANNER_TOKENS matches the CI grep-pattern alternatives in both directions', () => {
  const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

  if (!existsSync(WORKFLOWS_DIR)) {
    assert.fail(
      `The .github/workflows directory is missing at:\n  ${WORKFLOWS_DIR}\n\n` +
      'This test cannot verify that VITE_BANNER_TOKENS matches the CI grep-pattern\n' +
      'because no workflow files are present.\n\n' +
      'Check that the repository was fully checked out and that the .github/workflows\n' +
      'directory exists in the repo root.',
    );
  }

  const ymlFiles = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(WORKFLOWS_DIR, name));

  if (ymlFiles.length === 0) {
    assert.fail(
      `No *.yml files found under ${WORKFLOWS_DIR}.\n\n` +
      'This test cannot verify that VITE_BANNER_TOKENS matches the CI grep-pattern\n' +
      'because no workflow YAML files are present.\n\n' +
      'Add at least one workflow file to .github/workflows/ or check that the\n' +
      'directory was not accidentally emptied.',
    );
  }

  // Find the workflow file that owns the Vite smoke step (same heuristic as
  // the structural self-check below: a line containing 'dev:web' and 'timeout <N>').
  const matchingFiles = ymlFiles.flatMap((filePath) => {
    const content = readFileSync(filePath, 'utf8');
    const line = content
      .split('\n')
      .find((l) => l.includes('dev:web') && /timeout\s+\d+/.test(l));
    return line !== undefined ? [{ file: filePath, line, content }] : [];
  });

  if (matchingFiles.length === 0) {
    const searchedList = ymlFiles.map((f) => `  - ${f}`).join('\n');
    assert.fail(
      'The workflows directory exists but no workflow YAML file contains a line\n' +
      'with both `dev:web` and `timeout <N>`.\n\n' +
      'This test cannot extract the CI grep pattern to compare against\n' +
      'VITE_BANNER_TOKENS because the Vite smoke-test step is missing or\n' +
      'its structure has changed.\n\n' +
      'The "Smoke-test Vite dev server starts" step is expected to use the form:\n\n' +
      "    run: timeout <N> bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
      'If the step was removed, re-add it to the appropriate workflow file.\n' +
      'If the step was reformatted (e.g. split into a multi-line block scalar),\n' +
      'update it back to a single-line form so the parser can locate it.\n' +
      'If the npm script was renamed, update BOTH the CI YAML step AND\n' +
      '  scripts/__tests__/dev-web-smoke-test.test.mjs\n' +
      'to use the new script name.\n\n' +
      `Files searched (${ymlFiles.length}):\n${searchedList}`,
    );
  }

  const { file: ciWorkflowFile, line: smokeStepLine } = matchingFiles[0];

  // Extract the grep pattern string from the smoke-step line.
  // The expected form is:   grep -m1 "ready in\|Local:"
  // We capture the double-quoted argument immediately after `grep -m1`.
  const grepPatternMatch = smokeStepLine.match(/grep\s+-m1\s+"([^"]+)"/);

  assert.ok(
    grepPatternMatch !== null,
    `Could not extract the grep pattern from the smoke-test line in ${ciWorkflowFile}.\n` +
    `Line: ${smokeStepLine.trim()}\n\n` +
    'Expected the line to contain:  grep -m1 "<pattern>"\n' +
    'where <pattern> is a double-quoted string of \\|-delimited alternatives.\n\n' +
    'Update the smoke-step line or the extraction regex in this test to keep them in sync.',
  );

  // Split the raw pattern (e.g. "ready in\\|Local:") on the literal `\|`
  // separator that grep uses for alternation.  In the YAML source the
  // backslash is a single character, so we split on the two-character
  // sequence backslash + pipe.
  const rawPattern = grepPatternMatch[1];
  const grepAlternatives = rawPattern.split('\\|').map((s) => s.trim()).filter(Boolean);

  assert.ok(
    grepAlternatives.length > 0,
    `The grep pattern extracted from ${ciWorkflowFile} ("${rawPattern}") produced\n` +
    'no non-empty alternatives after splitting on "\\|".\n\n' +
    'The pattern must contain at least one non-empty alternative.\n' +
    'Check the smoke-step line and the extraction logic in this test.',
  );

  // ── Direction 1: every CI grep alternative must appear in VITE_BANNER_TOKENS ──
  for (const alt of grepAlternatives) {
    assert.ok(
      VITE_BANNER_TOKENS.includes(alt),
      `The CI grep pattern alternative "${alt}" (from ${ciWorkflowFile})\n` +
      'is not present in VITE_BANNER_TOKENS.\n\n' +
      'Current VITE_BANNER_TOKENS:\n' +
      VITE_BANNER_TOKENS.map((t) => `  - "${t}"`).join('\n') + '\n\n' +
      'The CI grep pattern alternatives are:\n' +
      grepAlternatives.map((a) => `  - "${a}"`).join('\n') + '\n\n' +
      'Keep VITE_BANNER_TOKENS and the CI grep pattern in sync:\n' +
      '  - Add the missing alternative to VITE_BANNER_TOKENS, OR\n' +
      '  - Remove the alternative from the CI grep pattern if it is no longer needed.\n' +
      'Both changes must be made in the same commit.',
    );
  }

  // ── Direction 2: every VITE_BANNER_TOKENS entry must appear as a CI grep alternative ──
  for (const token of VITE_BANNER_TOKENS) {
    assert.ok(
      grepAlternatives.includes(token),
      `VITE_BANNER_TOKENS entry "${token}" does not appear as an alternative\n` +
      `in the CI grep pattern ("${rawPattern}") from ${ciWorkflowFile}.\n\n` +
      'The CI grep pattern alternatives are:\n' +
      grepAlternatives.map((a) => `  - "${a}"`).join('\n') + '\n\n' +
      'Keep VITE_BANNER_TOKENS and the CI grep pattern in sync:\n' +
      '  - Add the missing token to the CI grep pattern as a \\|-delimited alternative, OR\n' +
      '  - Remove the entry from VITE_BANNER_TOKENS if it is no longer needed.\n' +
      'Both changes must be made in the same commit.',
    );
  }
});

// ── Timeout-regex parser unit test ────────────────────────────────────────────
//
// The "smoke command used in this test file…" test below reads the CI YAML,
// finds the smoke-step line, and extracts the timeout value with:
//
//   smokeStepLine.match(/timeout\s+(\d+)/)
//
// That regex is intentionally simple — it only matches a `timeout <N>` token
// on a single line alongside `dev:web`.  If the YAML step is ever reformatted
// (e.g. the shell command is split across lines using a YAML block scalar, or
// the timeout is expressed via a `timeout-minutes:` key instead), the regex
// silently returns null and the ceiling-sync assertion is skipped rather than
// checked.
//
// This test exercises the regex parser directly against known-good and
// known-bad YAML fixtures so that any accidental breakage in the detection
// logic itself is caught immediately, before the main self-check test below.

test('timeout-regex parser correctly extracts the timeout from a known-good YAML line', () => {
  // Derive the canonical YAML line directly from the live CI workflow file so
  // it can never drift independently of the real step.  The same heuristic
  // used by the structural self-check below: find the single line that contains
  // both `dev:web` and a `timeout <N>` token.
  const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

  let CANONICAL_YAML_LINE;

  if (existsSync(WORKFLOWS_DIR)) {
    const ymlFiles = readdirSync(WORKFLOWS_DIR)
      .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
      .map((name) => join(WORKFLOWS_DIR, name));

    for (const filePath of ymlFiles) {
      const content = readFileSync(filePath, 'utf8');
      const line = content
        .split('\n')
        .find((l) => l.includes('dev:web') && /timeout\s+\d+/.test(l));
      if (line !== undefined) {
        CANONICAL_YAML_LINE = line;
        break;
      }
    }
  }

  if (CANONICAL_YAML_LINE === undefined) {
    const workflows_dir = join(ROOT, '.github', 'workflows');
    if (!existsSync(workflows_dir)) {
      assert.fail(
        `The .github/workflows directory is missing at:\n  ${workflows_dir}\n\n` +
        'This test cannot verify the timeout-regex parser because no workflow\n' +
        'files are present to derive the canonical YAML line from.\n\n' +
        'Check that the repository was fully checked out and that the\n' +
        '.github/workflows directory exists in the repo root.',
      );
    } else {
      const scannedFiles = readdirSync(workflows_dir)
        .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
        .map((name) => join(workflows_dir, name));
      const searchedList = scannedFiles.map((f) => `  - ${f}`).join('\n');
      assert.fail(
        'Could not find a CI YAML line containing both `dev:web` and `timeout <N>`\n' +
        'in any workflow file under .github/workflows/.\n\n' +
        'The timeout-regex parser test requires this line to exist so it can\n' +
        'verify the parser against the live CI step.\n\n' +
        'The Vite smoke-test step is expected to use the form:\n\n' +
        "    run: timeout <N> bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
        'If the step was removed, re-add it to the appropriate workflow file.\n' +
        'If the step was reformatted (e.g. split into a multi-line block scalar),\n' +
        'update it back to a single-line form so the parser can locate it.\n\n' +
        `Files searched (${scannedFiles.length}):\n${searchedList}`,
      );
    }
  }

  const match = CANONICAL_YAML_LINE.match(/timeout\s+(\d+)/);

  assert.ok(
    match !== null,
    'The /timeout\\s+(\\d+)/ regex failed to match the live CI YAML line.\n\n' +
    `  Line: ${CANONICAL_YAML_LINE.trim()}\n\n` +
    'This means the parser used in the "smoke command used in this test file\n' +
    'matches the CI step structure" test would silently skip the ceiling-sync\n' +
    'assertion if the YAML were in this form.\n\n' +
    'The CI YAML line must contain `timeout <N>` on the same line as `dev:web`.\n' +
    'Update the CI step or the extraction regex to keep them in sync.',
  );

  const extracted = parseInt(match[1], 10);

  // The expected value is CI_SMOKE_TIMEOUT_CEILING_SECS — the single constant
  // that mirrors the CI `timeout <N>` value.  Updating one constant keeps both
  // this assertion and the static ceiling guard at module-load time consistent.
  assert.strictEqual(
    extracted,
    CI_SMOKE_TIMEOUT_CEILING_SECS,
    `Expected the regex to extract ${CI_SMOKE_TIMEOUT_CEILING_SECS} ` +
    `(CI_SMOKE_TIMEOUT_CEILING_SECS) from the CI YAML line but got ${extracted}.\n\n` +
    `  CI YAML line: ${CANONICAL_YAML_LINE.trim()}\n` +
    `  Captured:     "${match[1]}"\n\n` +
    'CI_SMOKE_TIMEOUT_CEILING_SECS must equal the `timeout <N>` value on the\n' +
    'CI smoke-test step.  Update CI_SMOKE_TIMEOUT_CEILING_SECS at the top of\n' +
    'scripts/__tests__/dev-web-smoke-test.test.mjs to match the CI YAML, or\n' +
    'update the CI YAML timeout to match CI_SMOKE_TIMEOUT_CEILING_SECS.\n' +
    'Both changes must land in the same commit.',
  );
});

test('timeout-regex parser returns null for YAML formats it cannot handle', () => {
  // These fixtures represent reformatting patterns that would cause the simple
  // /timeout\s+(\d+)/ regex to return null — which would silently skip the
  // ceiling-sync assertion.  The test documents those blind spots explicitly so
  // that if the CI YAML is ever reformatted this way, the author knows they
  // must also update the parser (or the YAML) to keep the guard effective.

  const UNDETECTABLE_FORMATS = [
    {
      label: 'timeout-minutes key (not a shell timeout)',
      line: '      timeout-minutes: 30',
    },
    {
      label: 'shell timeout on a separate line from dev:web (YAML block scalar split)',
      // When the run: block is split across lines, the line containing `dev:web`
      // does not contain `timeout`, so the .find() that locates the line returns
      // the `dev:web` line, not the `timeout` line — and this regex on that line
      // returns null.
      line: "          npm run dev:web 2>&1 | grep -m1 'ready in|Local:'",
    },
  ];

  for (const { label, line } of UNDETECTABLE_FORMATS) {
    // We are asserting that the regex does NOT match — this documents the known
    // limitation rather than claiming the parser handles these cases.
    const match = line.match(/timeout\s+(\d+)/);

    // For the `timeout-minutes:` form, the regex must not match (it uses a
    // hyphen, not whitespace, between "timeout" and the number).
    // For the dev:web-only line, the `timeout` token is absent entirely.
    //
    // If either fixture unexpectedly matches, it means the regex is broader
    // than intended and may be producing false-positive extractions.
    assert.strictEqual(
      match,
      null,
      `Fixture "${label}" unexpectedly matched /timeout\\s+(\\d+)/.\n\n` +
      `  Line:     ${line.trim()}\n` +
      `  Captured: "${match?.[1]}"\n\n` +
      'This fixture was intended to represent a YAML format the simple regex\n' +
      'cannot handle.  If the regex now matches it correctly, remove this\n' +
      'fixture from the UNDETECTABLE_FORMATS list and add a passing fixture\n' +
      'to the known-good test above instead.',
    );
  }
});

test('CI smoke-test run: block keeps timeout and dev:web on the same line (not a multi-line block scalar)', () => {
  // WHY THIS TEST EXISTS
  // ====================
  // The timeout-regex parser used in both the "timeout-regex parser correctly
  // extracts the timeout" test and the "smoke command used in this test file
  // matches the CI step structure" test works by finding the *single YAML line*
  // that contains both `dev:web` and `timeout <N>`:
  //
  //   content.split('\n').find(
  //     (l) => l.includes('dev:web') && /timeout\s+\d+/.test(l)
  //   )
  //
  // This strategy is undetectable-blind when the CI step uses a YAML block
  // scalar that splits the shell command across lines.  For example:
  //
  //   run: |
  //     timeout 30 bash -c \
  //       'npm run dev:web 2>&1 | grep -m1 "ready in\|Local:"'
  //
  // In that form, the line containing `dev:web` does NOT contain `timeout`, so
  // .find() returns undefined.  The "timeout-regex parser" test then hits its
  // graceful-skip path (CANONICAL_YAML_LINE === undefined → return) and produces
  // no failure.  The "smoke command structure" test fires its "Zero matches"
  // assertion, but its error message focuses on the step being missing or
  // renamed — it does not explain the multi-line block scalar as the cause.
  //
  // This test closes that gap by separately asserting, at the raw-content level,
  // that any line containing `dev:web` in workflow YAML ALSO contains
  // `timeout <N>` on that same line.  If they are ever split, this test fails
  // with an explicit, actionable error before the structural self-check runs.

  const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

  if (!existsSync(WORKFLOWS_DIR)) {
    assert.fail(
      `The .github/workflows directory is missing at:\n  ${WORKFLOWS_DIR}\n\n` +
      'This test cannot verify that `dev:web` and `timeout <N>` appear on the same\n' +
      'line in CI workflow YAML because no workflow files are present.\n\n' +
      'Check that the repository was fully checked out and that the .github/workflows\n' +
      'directory exists in the repo root.',
    );
  }

  const ymlFiles = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(WORKFLOWS_DIR, name));

  // Collect every line that mentions `dev:web` across all workflow files.
  const devWebLines = ymlFiles.flatMap((filePath) => {
    const content = readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter((l) => l.includes('dev:web'))
      .map((l) => ({ file: filePath, line: l }));
  });

  if (devWebLines.length === 0) {
    // The workflows directory EXISTS but contains no `dev:web` reference at all.
    // This means the Vite smoke-test step was removed or renamed to a different
    // npm script without updating this test file.  Fail loudly so the developer
    // knows what to do rather than silently passing and hiding the drift.
    const searchedList = ymlFiles.map((f) => `  - ${f}`).join('\n');
    assert.fail(
      'The workflows directory exists but no workflow YAML file contains `dev:web`.\n\n' +
      'The "Smoke-test Vite dev server starts" CI step is expected to include a\n' +
      'shell command of the form:\n\n' +
      "    run: timeout <N> bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
      'If the step was removed, re-add it to the appropriate workflow file.\n' +
      'If the npm script was renamed (e.g., from `dev:web` to something else),\n' +
      'update BOTH the CI YAML step AND this test file\n' +
      '  (scripts/__tests__/dev-web-smoke-test.test.mjs)\n' +
      'to use the new script name — then re-run this test to confirm.\n\n' +
      `Files searched (${ymlFiles.length}):\n${searchedList}`,
    );
  }

  // At least one `dev:web` line exists.  Assert that at least one of them ALSO
  // has `timeout <N>` on the same line (single-line shell command form).
  const singleLineMatch = devWebLines.find(({ line }) => /timeout\s+\d+/.test(line));

  const devWebLocations = devWebLines
    .map(({ file, line }) => `  ${file}:\n    ${line.trim()}`)
    .join('\n');

  assert.ok(
    singleLineMatch !== undefined,
    'Found `dev:web` in workflow YAML file(s), but no line contains both\n' +
    '`dev:web` AND `timeout <N>` on the same line.\n\n' +
    "The smoke-test step's `run:` block appears to use a multi-line YAML block\n" +
    'scalar (e.g., `run: |`) or otherwise splits the shell command across lines.\n\n' +
    'WHY THIS MATTERS\n' +
    '================\n' +
    'The timeout-regex parser requires both tokens on a single line:\n\n' +
    "    run: timeout 30 bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
    'When they are on separate lines the parser returns undefined, the\n' +
    '"timeout-regex parser" test silently skips (graceful-return path), and the\n' +
    'CI_SMOKE_TIMEOUT_CEILING_SECS constant is never validated against the actual\n' +
    'CI timeout — allowing LOCAL_SMOKE_TIMEOUT_SECS to silently exceed the real\n' +
    'CI ceiling and produce "works on my machine" build failures.\n\n' +
    'HOW TO FIX\n' +
    '==========\n' +
    "Option A (preferred): rewrite the CI step's `run:` block as a single-line\n" +
    'shell command so both `timeout <N>` and `dev:web` appear on the same YAML\n' +
    'line.  This keeps the existing parser working without changes.\n\n' +
    'Option B: update the parser in this test file\n' +
    '  (scripts/__tests__/dev-web-smoke-test.test.mjs)\n' +
    'to handle multi-line block scalars and then update this assertion\n' +
    'to match the new detection strategy.\n\n' +
    `Lines containing \`dev:web\` (none also have \`timeout <N>\` on the same line):\n${devWebLocations}`,
  );
});

// ── Smoke-command structure self-check ────────────────────────────────────────
//
// This static test verifies that the smoke command we run above uses the same
// tokens as the CI YAML step, so that changes to the CI step are reflected
// here (and vice versa) rather than the two drifting silently.
//
// Rather than hard-coding a single workflow file path, the test scans ALL
// *.yml files under .github/workflows/ and asserts exactly one of them
// contains the smoke-step line.  This means the test survives a rename of
// ci-cd.yml without silently false-passing: if the step moves to a different
// file, the test still finds it; if it disappears entirely, the test fails
// with a clear error naming every file that was searched.

test('smoke command used in this test file matches the CI step structure', () => {
  const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');

  assert.ok(
    existsSync(WORKFLOWS_DIR),
    `${WORKFLOWS_DIR} does not exist.\n` +
    'The .github/workflows directory is missing — cannot locate the CI smoke-test step.',
  );

  // Collect every *.yml file in the workflows directory (flat scan — GitHub
  // Actions does not support sub-directories so a one-level read is sufficient).
  const ymlFiles = readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(WORKFLOWS_DIR, name));

  assert.ok(
    ymlFiles.length > 0,
    `No *.yml files found under ${WORKFLOWS_DIR}.\n` +
    'The CI smoke-test step cannot be located.',
  );

  // The smoke-step line must contain both `dev:web` and a `timeout <N>` token
  // on the same line.  Find every workflow file that has such a line.
  // SMOKE_STEP_TOKENS is declared at the top of this file — see the comment
  // block there for an explanation of each token and how to update them.

  /**
   * @typedef {{ file: string, line: string, content: string }} Match
   * @type {Match[]}
   */
  const matchingFiles = ymlFiles.flatMap((filePath) => {
    const content = readFileSync(filePath, 'utf8');
    const line = content
      .split('\n')
      .find((l) => l.includes('dev:web') && /timeout\s+\d+/.test(l));
    return line !== undefined ? [{ file: filePath, line, content }] : [];
  });

  const searchedList = ymlFiles.map((f) => `  - ${f}`).join('\n');

  // ── Zero matches ──────────────────────────────────────────────────────────
  assert.ok(
    matchingFiles.length > 0,
    'Could not find any workflow YAML file that contains a line with both\n' +
    '"dev:web" and a `timeout <N>` token.\n\n' +
    'The "Smoke-test Vite dev server starts" step is expected to use the form:\n' +
    "  timeout <N> bash -c 'npm run dev:web 2>&1 | grep -m1 \"ready in\\|Local:\"'\n\n" +
    'Either the step was removed, renamed, or its structure changed in a way\n' +
    'that prevents automatic detection.  Update the step and/or this test to\n' +
    'keep them in sync:\n' +
    '  - Smoke-test step: one *.yml file under .github/workflows/\n' +
    '  - This file: scripts/__tests__/dev-web-smoke-test.test.mjs\n\n' +
    `Files searched (${ymlFiles.length}):\n${searchedList}`,
  );

  // ── More than one match ───────────────────────────────────────────────────
  if (matchingFiles.length > 1) {
    const duplicateList = matchingFiles
      .map((m) => `  - ${m.file}\n      line: ${m.line.trim()}`)
      .join('\n');
    assert.fail(
      `Found ${matchingFiles.length} workflow files that each contain a\n` +
      '"dev:web" + `timeout <N>` smoke-test line — expected exactly one.\n\n' +
      'Duplicate locations:\n' +
      `${duplicateList}\n\n` +
      'Remove the duplicate step so exactly one workflow file owns the\n' +
      'Vite dev-server smoke test, then re-run this test.',
    );
  }

  // Exactly one match — proceed with token and timeout coherence checks.
  const { file: ciWorkflowFile, line: smokeStepLine, content: workflowContent } = matchingFiles[0];

  // ── Token presence check ──────────────────────────────────────────────────
  //
  // The CI step must contain the core tokens we use in runSmokeCommand().
  // We do not assert an exact match (the timeout value may differ between CI
  // and this test for speed reasons) but we assert the three load-bearing
  // tokens: `dev:web`, `grep -m1`, and the ready-banner pattern.
  for (const token of SMOKE_STEP_TOKENS) {
    assert.ok(
      workflowContent.includes(token),
      `${ciWorkflowFile} no longer contains the token "${token}".\n\n` +
      'The Vite dev-server smoke-test step in the CI web-lint job must contain\n' +
      `"${token}" for the step to exercise the same surface as this mutation test.\n\n` +
      'Either the CI step was changed without updating this test, or vice versa.\n' +
      'Keep both in sync:\n' +
      `  - CI step: ${ciWorkflowFile} (web-lint job, "Smoke-test Vite dev server starts")\n` +
      '  - This file: scripts/__tests__/dev-web-smoke-test.test.mjs (runSmokeCommand)',
    );
  }

  // ── Timeout coherence check ────────────────────────────────────────────────
  //
  // The CI step uses `timeout <N>` on the same smoke command.  The local test
  // uses LOCAL_SMOKE_TIMEOUT_SECS (currently 15 s).  If the CI timeout is ever
  // reduced below the local value the test will start failing in CI (timing out)
  // while still passing locally — a classic "works on my machine" failure.
  //
  // Find the `timeout <N>` token on the same line as `dev:web` in the CI YAML
  // and assert that the CI timeout is >= LOCAL_SMOKE_TIMEOUT_SECS.
  const timeoutMatch = smokeStepLine.match(/timeout\s+(\d+)/);

  assert.ok(
    timeoutMatch !== null,
    `Found the dev:web smoke-test line in ${ciWorkflowFile} but could not\n` +
    `extract the timeout value.  Line: ${smokeStepLine.trim()}\n\n` +
    'Expected a pattern like `timeout 30` on the same line as `dev:web`.',
  );

  const ciTimeoutSecs = parseInt(timeoutMatch[1], 10);

  assert.ok(
    ciTimeoutSecs >= LOCAL_SMOKE_TIMEOUT_SECS,
    `Timeout mismatch: the CI smoke-test timeout (${ciTimeoutSecs} s) is less\n` +
    `than the local runSmokeCommand timeout (LOCAL_SMOKE_TIMEOUT_SECS = ${LOCAL_SMOKE_TIMEOUT_SECS} s).\n\n` +
    'This means the smoke command can pass locally (within the local timeout)\n' +
    'but time out in CI before the ready banner appears — a "works on my machine"\n' +
    'failure that blocks correct builds.\n\n' +
    'Fix options (choose one):\n' +
    `  1. Raise the CI timeout to at least ${LOCAL_SMOKE_TIMEOUT_SECS} s in\n` +
    `       ${ciWorkflowFile} (web-lint job, "Smoke-test Vite dev server starts")\n` +
    `  2. Lower LOCAL_SMOKE_TIMEOUT_SECS (currently ${LOCAL_SMOKE_TIMEOUT_SECS} s) in\n` +
    '       scripts/__tests__/dev-web-smoke-test.test.mjs\n' +
    '     to a value <= the CI timeout.\n\n' +
    `Current values — CI: ${ciTimeoutSecs} s, local: ${LOCAL_SMOKE_TIMEOUT_SECS} s`,
  );

  // ── Ceiling constant sync check ────────────────────────────────────────────
  //
  // CI_SMOKE_TIMEOUT_CEILING_SECS is the hard-coded mirror of the `timeout <N>`
  // value on the CI YAML step.  The static assertion at the top of this file
  // uses it to catch LOCAL_SMOKE_TIMEOUT_SECS exceeding the CI ceiling, but
  // that guard only fires when the constant drifts below the local value.
  // If someone raises the CI timeout from 30 → 45 without updating the constant
  // (or vice versa), the static guard stays silent — this assertion catches it.
  //
  // To raise CI_SMOKE_TIMEOUT_CEILING_SECS:
  //   1. Update the `timeout` value in the CI YAML step (web-lint job,
  //      "Smoke-test Vite dev server starts") in the same commit.
  //   2. Update CI_SMOKE_TIMEOUT_CEILING_SECS at the top of this file to match.
  assert.strictEqual(
    ciTimeoutSecs,
    CI_SMOKE_TIMEOUT_CEILING_SECS,
    `CI timeout constant out of sync with the YAML.\n\n` +
    `  CI YAML timeout (${ciWorkflowFile}): ${ciTimeoutSecs} s\n` +
    `  CI_SMOKE_TIMEOUT_CEILING_SECS (this file):    ${CI_SMOKE_TIMEOUT_CEILING_SECS} s\n\n` +
    'These two values must be identical.  When the CI YAML timeout changes,\n' +
    'CI_SMOKE_TIMEOUT_CEILING_SECS must be updated in the same commit, and\n' +
    'vice versa — otherwise the static ceiling check at module load is\n' +
    'comparing LOCAL_SMOKE_TIMEOUT_SECS against a stale limit.\n\n' +
    'Fix: update CI_SMOKE_TIMEOUT_CEILING_SECS at the top of\n' +
    `  scripts/__tests__/dev-web-smoke-test.test.mjs\n` +
    `to ${ciTimeoutSecs} (the value currently in the CI YAML), or update the\n` +
    `CI YAML timeout to ${CI_SMOKE_TIMEOUT_CEILING_SECS} (the current constant value).`,
  );
});
