#!/usr/bin/env node
/**
 * Bash-level guard expansion tests for smoke-test-reviewer-login.sh.
 *
 * The JavaScript simulation in staging-auth-smoke-skip.test.mjs can only test
 * the JS model of the guard — it cannot detect if the bash expansion operator
 * is changed inside the script.  This file closes that gap by running the
 * ACTUAL guard fragment (extracted from the script at test time) in a real bash
 * subprocess with a clean environment.
 *
 * Regressions caught here that the JS test CANNOT catch:
 *   - `${SKIP_REVIEWER_LOGIN_CHECK:-0}` changed to `${SKIP_REVIEWER_LOGIN_CHECK:?0}`
 *     → bash exits non-zero when SKIP is unset, instead of defaulting to "0"
 *   - `${SKIP_REVIEWER_LOGIN_CHECK:-0}` changed to `${SKIP_REVIEWER_LOGIN_CHECK}`
 *     → `set -u` fires when SKIP is unset, crashing the script
 *   - Either `:?` assignment on the REVIEWER_EMAIL / REVIEWER_PASSWORD lines is
 *     moved above the guard, making the guard unreachable when creds are absent
 *
 * Each test runs `bash -c "<fragment>"` with a controlled environment via
 * execFileAsync so no network calls, no real credentials, and no side effects.
 *
 * Run with: node scripts/__tests__/bash-guard-expansion.test.mjs
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT_PATH = join(ROOT, 'scripts', 'smoke-test-reviewer-login.sh');

// ── Script content helpers ────────────────────────────────────────────────────

const SCRIPT_LINES = readFileSync(SCRIPT_PATH, 'utf8').split('\n');

/**
 * Return the 0-based index of the first line that matches `predicate`,
 * or throw if not found.
 */
function findLine(predicate, description) {
  const idx = SCRIPT_LINES.findIndex(predicate);
  if (idx === -1) {
    throw new Error(
      `bash-guard-expansion test setup: cannot locate ${description} in ${SCRIPT_PATH}. ` +
      'Either the script was reorganised or this test file is out of sync — ' +
      'update the search predicate in scripts/__tests__/bash-guard-expansion.test.mjs.',
    );
  }
  return idx;
}

/**
 * Extract a contiguous slice of script lines (inclusive) and join them as a
 * single string suitable for `bash -c`.
 */
function extractLines(startIdx, endIdx) {
  return SCRIPT_LINES.slice(startIdx, endIdx + 1).join('\n');
}

// Locate key line indices once at module load so every test uses the same
// source-of-truth.  These throw immediately at import time if the script is
// reorganised, giving a clear message rather than a confusing test failure.

const SKIP_GUARD_START_IDX = findLine(
  l => /if \[ "\$\{SKIP_REVIEWER_LOGIN_CHECK/.test(l),
  'SKIP_REVIEWER_LOGIN_CHECK guard (if [...] line)',
);

// The guard block ends at the `fi` that closes it.  Walk forward from the
// `if` line to find the first `fi` at the same (or lower) indent level.
const SKIP_GUARD_FI_IDX = (() => {
  for (let i = SKIP_GUARD_START_IDX + 1; i < SCRIPT_LINES.length; i++) {
    if (SCRIPT_LINES[i].trim() === 'fi') return i;
  }
  throw new Error(
    `bash-guard-expansion test setup: cannot find closing "fi" for the ` +
    `SKIP_REVIEWER_LOGIN_CHECK guard block starting at line ${SKIP_GUARD_START_IDX + 1}`,
  );
})();

// The two `:?` credential assignment lines that follow the guard.
const REVIEWER_EMAIL_ASSIGN_IDX = findLine(
  l => /EMAIL="\$\{REVIEWER_EMAIL:/.test(l),
  'EMAIL="${REVIEWER_EMAIL:...}" assignment line',
);
const REVIEWER_PASSWORD_ASSIGN_IDX = findLine(
  l => /PASSWORD="\$\{REVIEWER_PASSWORD:/.test(l),
  'PASSWORD="${REVIEWER_PASSWORD:...}" assignment line',
);

// ── Subprocess helper ─────────────────────────────────────────────────────────

/**
 * Run a bash one-liner in a minimal environment.
 *
 * @param {string}              script  - bash script passed to `bash -c`
 * @param {Record<string,string>} env   - environment vars (PATH added automatically)
 * @returns {Promise<{ status: number|null, stdout: string, stderr: string }>}
 */
async function runBash(script, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', script], {
      env: { PATH: '/usr/bin:/bin:/usr/local/bin', ...env },
      encoding: 'utf8',
      timeout: 5000,
    });
    return { status: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    return { status: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

// ── Static text assertion: verify the guard uses `:-` (not `:?` or bare `$`) ──

test('SKIP_REVIEWER_LOGIN_CHECK guard line uses ${VAR:-0} (graceful default), not ${VAR:?} or bare ${VAR}', () => {
  const guardLine = SCRIPT_LINES[SKIP_GUARD_START_IDX];

  // Must contain the graceful-default operator `:-0`
  assert.ok(
    guardLine.includes('SKIP_REVIEWER_LOGIN_CHECK:-'),
    `Expected guard line to contain SKIP_REVIEWER_LOGIN_CHECK:- (graceful default) but got:\n  ${guardLine}\n` +
    'Changing :-0 to :?0 or removing :- causes bash to fail loudly when the var is unset.',
  );

  // Must NOT use `:?` inside the SKIP guard expression
  const guardExpression = guardLine.match(/\$\{SKIP_REVIEWER_LOGIN_CHECK[^}]*\}/)?.[0] ?? '';
  assert.ok(
    !guardExpression.includes(':?'),
    `Guard expression "${guardExpression}" uses :? (fail-on-unset) instead of :- (default). ` +
    'When SKIP_REVIEWER_LOGIN_CHECK is absent from the environment, bash will exit non-zero ' +
    'instead of treating the variable as "0" and proceeding normally.',
  );
});

// ── Subprocess tests: run the actual extracted fragment in bash ───────────────

test('guard fragment exits non-crash (exit 42 sentinel) when SKIP_REVIEWER_LOGIN_CHECK is unset', async () => {
  // Run JUST the skip-guard block from the script, then exit 42 as a sentinel
  // to prove execution reached here without crashing.
  //
  // If :-0 is changed to :?0 or to bare ${VAR} with set -u, bash exits
  // non-zero (typically 1) before reaching the sentinel — the test fails.
  const guardBlock = extractLines(SKIP_GUARD_START_IDX, SKIP_GUARD_FI_IDX);
  const fragment = `set -u\n${guardBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, {});  // SKIP_REVIEWER_LOGIN_CHECK unset

  assert.equal(
    status,
    42,
    `Expected exit 42 (guard did not fire and bash did not crash) but got exit ${status}.\n` +
    `If exit code is 1, the guard expansion likely uses :? or bare \${VAR} with set -u, ` +
    `causing bash to fail when SKIP_REVIEWER_LOGIN_CHECK is unset.\n` +
    `stderr: ${stderr}`,
  );
});

test('guard fragment exits non-crash (exit 42 sentinel) when SKIP_REVIEWER_LOGIN_CHECK is empty string', async () => {
  // An empty-string value must behave the same as unset (graceful default to "0").
  // If :- is removed or changed to :?, bash may treat "" differently.
  const guardBlock = extractLines(SKIP_GUARD_START_IDX, SKIP_GUARD_FI_IDX);
  const fragment = `set -u\n${guardBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, { SKIP_REVIEWER_LOGIN_CHECK: '' });

  assert.equal(
    status,
    42,
    `Expected exit 42 when SKIP_REVIEWER_LOGIN_CHECK="" but got exit ${status}.\n` +
    `\${VAR:-0} should expand to "0" for an empty string, keeping the guard inactive.\n` +
    `stderr: ${stderr}`,
  );
});

test('guard fragment exits 0 when SKIP_REVIEWER_LOGIN_CHECK=1 (bypass active)', async () => {
  const guardBlock = extractLines(SKIP_GUARD_START_IDX, SKIP_GUARD_FI_IDX);
  const fragment = `set -u\n${guardBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, { SKIP_REVIEWER_LOGIN_CHECK: '1' });

  assert.equal(
    status,
    0,
    `Expected exit 0 when SKIP_REVIEWER_LOGIN_CHECK=1 (bypass should fire) but got exit ${status}.\n` +
    `stderr: ${stderr}`,
  );
});

test('guard fragment exits non-crash (exit 42 sentinel) when SKIP_REVIEWER_LOGIN_CHECK=0 (bypass inactive)', async () => {
  const guardBlock = extractLines(SKIP_GUARD_START_IDX, SKIP_GUARD_FI_IDX);
  const fragment = `set -u\n${guardBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, { SKIP_REVIEWER_LOGIN_CHECK: '0' });

  assert.equal(
    status,
    42,
    `Expected exit 42 when SKIP_REVIEWER_LOGIN_CHECK=0 (bypass inactive) but got exit ${status}.\n` +
    `stderr: ${stderr}`,
  );
});

// ── Guard ordering: :? assignments must come AFTER the skip guard ─────────────
//
// The guard only protects against the loud `:?` assignments if it appears
// BEFORE those assignments in the file.  If someone accidentally moves the
// `EMAIL="${REVIEWER_EMAIL:?...}"` line above the guard, the guard becomes
// useless: the script fails loudly before even reaching the if-block.

test('EMAIL=:? and PASSWORD=:? assignments appear AFTER the skip-guard fi line in the script', () => {
  assert.ok(
    REVIEWER_EMAIL_ASSIGN_IDX > SKIP_GUARD_FI_IDX,
    `EMAIL="\${REVIEWER_EMAIL:?...}" (line ${REVIEWER_EMAIL_ASSIGN_IDX + 1}) must appear ` +
    `after the SKIP_REVIEWER_LOGIN_CHECK guard fi (line ${SKIP_GUARD_FI_IDX + 1}). ` +
    'If moved above the guard, SKIP_REVIEWER_LOGIN_CHECK=1 no longer bypasses the credential check.',
  );

  assert.ok(
    REVIEWER_PASSWORD_ASSIGN_IDX > SKIP_GUARD_FI_IDX,
    `PASSWORD="\${REVIEWER_PASSWORD:?...}" (line ${REVIEWER_PASSWORD_ASSIGN_IDX + 1}) must appear ` +
    `after the SKIP_REVIEWER_LOGIN_CHECK guard fi (line ${SKIP_GUARD_FI_IDX + 1}). ` +
    'If moved above the guard, SKIP_REVIEWER_LOGIN_CHECK=1 no longer bypasses the credential check.',
  );
});

// ── Integration: guard + :? block — SKIP=1 exits 0 even with unset creds ─────

test('guard block + :? assignments exit 0 when SKIP_REVIEWER_LOGIN_CHECK=1 and credentials are unset', async () => {
  // Run lines from the skip guard through both :? assignment lines.
  // With SKIP=1, the guard fires (exit 0) before the :? lines are reached.
  // If the ordering changes or the guard expansion breaks, the :? lines fire
  // and exit non-zero.
  const endIdx = Math.max(REVIEWER_EMAIL_ASSIGN_IDX, REVIEWER_PASSWORD_ASSIGN_IDX);
  const fullBlock = extractLines(SKIP_GUARD_START_IDX, endIdx);
  const fragment = `set -u\n${fullBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, { SKIP_REVIEWER_LOGIN_CHECK: '1' });
  // REVIEWER_EMAIL and REVIEWER_PASSWORD are intentionally absent from env.

  assert.equal(
    status,
    0,
    `Expected exit 0 (SKIP guard fires before :? lines) but got exit ${status}.\n` +
    `This likely means the guard does not exit before the :? credential assignments, ` +
    `or the expansion was changed from :-0 to something that doesn't fire on SKIP=1.\n` +
    `stderr: ${stderr}`,
  );
});

test('guard block + :? assignments proceed past :? lines when SKIP is unset and creds are set', async () => {
  // With SKIP unset and both credentials set, the guard does not fire and the
  // :? assignments should succeed (both vars are present).  Execution reaches
  // the sentinel exit 42.
  const endIdx = Math.max(REVIEWER_EMAIL_ASSIGN_IDX, REVIEWER_PASSWORD_ASSIGN_IDX);
  const fullBlock = extractLines(SKIP_GUARD_START_IDX, endIdx);
  const fragment = `set -u\n${fullBlock}\nexit 42`;

  const { status, stderr } = await runBash(fragment, {
    REVIEWER_EMAIL: 'reviewer@example.com',
    REVIEWER_PASSWORD: 'test-password',
  });

  assert.equal(
    status,
    42,
    `Expected exit 42 (guard inactive + :? assignments succeed) but got exit ${status}.\n` +
    `stderr: ${stderr}`,
  );
});

test('guard block + :? assignments fail loudly (non-zero) when SKIP is unset and creds are absent', async () => {
  // This is the INTENTIONAL behavior: without SKIP=1 and without real
  // credentials, the script SHOULD fail loudly.  This test documents and locks
  // in that contract so a future change that accidentally makes the script
  // "silently succeed" (exit 0) with no credentials is caught.
  const endIdx = Math.max(REVIEWER_EMAIL_ASSIGN_IDX, REVIEWER_PASSWORD_ASSIGN_IDX);
  const fullBlock = extractLines(SKIP_GUARD_START_IDX, endIdx);
  const fragment = `set -u\n${fullBlock}\nexit 42`;

  const { status } = await runBash(fragment, {});  // no SKIP, no creds

  assert.notEqual(
    status,
    0,
    'Expected non-zero exit when SKIP is unset and credentials are absent — ' +
    'the :? assignments are supposed to fail loudly in this case. ' +
    'If exit code is 0 the script is silently swallowing a missing-credential error.',
  );

  assert.notEqual(
    status,
    42,
    'Expected non-zero exit (not sentinel 42) when SKIP is unset and credentials are absent — ' +
    'the :? assignments should fail before the sentinel is reached.',
  );
});
