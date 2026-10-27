#!/usr/bin/env node
/**
 * Mutation test: CI guard on env-var-dependent t.skip() exits non-zero in CI.
 *
 * ## Background
 * The static scan in `ci-guard-files.test.mjs` catches test files that
 * reference both `t.skip(` and `process.env.` without the CI guard pattern
 *   process.env.CI === 'true'
 * at the module-load level.  That guard causes the file to throw immediately
 * (rather than silently skip tests) when CI is true and the required env-var is
 * absent — surfacing an infrastructure failure as a loud test-suite error
 * instead of a quiet "N skipped" result.
 *
 * However, the static scan is text-based and cannot detect subtler patterns:
 *   - env-var check inside a helper function
 *   - skip condition derived from multiple env-vars (e.g. `!a || !b`)
 *   - indirect boolean derived from the env-var before the skip
 *
 * This file closes that gap with runtime mutation tests:
 *
 *   1. GUARDED pattern (correct):
 *      Write a temp test file that has BOTH a module-load-time CI guard AND
 *      an env-var-dependent t.skip().  Run it with CI=true and the env-var
 *      absent.  Assert the process exits NON-ZERO (the CI guard threw).
 *
 *   2. UNGUARDED pattern (incorrect — shows the silent failure):
 *      Write a temp test file that has ONLY an env-var-dependent t.skip()
 *      but NO CI guard.  Run it with CI=true and the env-var absent.  Assert
 *      the process exits ZERO ("1 skipped" — silent, invisible failure).
 *
 *   3. GUARDED with env-var PRESENT (correct normal operation):
 *      Run the guarded temp file with CI=true and the env-var SET.  Assert
 *      the process exits ZERO (the guard does NOT throw; the test runs and
 *      passes because the env-var is present).
 *
 * Together these three cases prove that:
 *   (a) The guard actually fires when it should.
 *   (b) Without the guard the skip silently succeeds — the regression it
 *       prevents is real.
 *   (c) The guard does not fire when the env-var is correctly supplied.
 *
 * ## Safety
 * - All temp files are written to `os.tmpdir()` and deleted in finally blocks.
 * - The sentinel env-var name is namespaced to avoid collision with any real
 *   env-var used by the project.
 * - The test never leaves a temp file on disk, even if an assertion fails or
 *   the process receives a signal before the finally block runs (the OS reclaims
 *   tmpdir on reboot; the file is not in the repo).
 *
 * ## CI guard for this file
 * This file itself does NOT depend on any external binary or env-var — it only
 * uses the Node.js built-ins `node:test`, `node:assert`, `node:fs`, `node:os`,
 * and `node:child_process`.  Therefore it does NOT need the
 * `process.env.CI === 'true'` guard (it never skips in CI or locally).
 *
 * Run with: node scripts/__tests__/ci-env-skip-mutation.test.mjs
 * Auto-picked up by: npm run test:scripts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Unique sentinel env-var name used across all mutation tests in this file.
 * The name is deliberately namespaced so it cannot accidentally collide with
 * any real project env-var and produce a false-positive or false-negative.
 */
const SENTINEL_VAR = 'TABULA_MEDICA_CI_GUARD_MUTATION_SENTINEL';

/**
 * Second sentinel env-var used exclusively by the multi-var template to
 * simulate a skip condition derived from more than one env-var.
 */
const SENTINEL_VAR_B = 'TABULA_MEDICA_CI_GUARD_MUTATION_SENTINEL_B';

// ── Inline test-file templates ─────────────────────────────────────────────
//
// These strings are the source variants we write to temp files and run
// under node --test.  They are defined at module level so:
//   1. The restore-verification tests can check the sentinel strings are present.
//   2. The self-check tests at the bottom can verify the templates are non-trivial.

/**
 * The CORRECT pattern — a test file that has BOTH:
 *   (a) a module-load-time CI guard that throws when CI=true and the env-var is
 *       absent, AND
 *   (b) an env-var-dependent t.skip() in the test body.
 *
 * When run with CI=true and ${SENTINEL_VAR} absent, the module-load guard
 * fires before any test runs, and the process exits non-zero.
 * When run with CI=true and ${SENTINEL_VAR} present, the guard does not fire
 * and the test body runs normally (finding the env-var and not skipping).
 */
const GUARDED_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: guarded template
import { test } from 'node:test';

const sentinelValue = process.env.${SENTINEL_VAR};

if (!sentinelValue && process.env.CI === 'true') {
  throw new Error(
    'CI=true but ${SENTINEL_VAR} is absent.\\n\\n' +
    'The t.skip() in this file is intended for local dev environments only.\\n' +
    'In CI the env-var must be set; its absence indicates a broken configuration.\\n' +
    'Fix: restore ${SENTINEL_VAR} to the CI job env: block or secrets.',
  );
}

test('env-var-dependent test with CI guard', (t) => {
  if (!sentinelValue) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — verify it has the expected value (synchronous check).
  if (sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The INCORRECT pattern — a test file that has ONLY an env-var-dependent
 * t.skip() with NO module-load-time CI guard.
 *
 * When run with CI=true and ${SENTINEL_VAR} absent, the test silently skips
 * ("1 skipped") and the process exits ZERO — an invisible failure that
 * the static scan was designed to prevent.
 *
 * This template is used in mutation test B to prove the silent failure is real:
 * without the guard, the test runner exits 0 even in CI with the env-var absent.
 */
const UNGUARDED_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: unguarded template (demonstrates silent failure)
import { test } from 'node:test';

const sentinelValue = process.env.${SENTINEL_VAR};

// No CI guard here — the silent failure this project guards against.

test('env-var-dependent test without CI guard', (t) => {
  if (!sentinelValue) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — synchronous check.
  if (sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The HELPER-FUNCTION pattern — the env-var check is delegated to a helper
 * function rather than inlined at the t.skip() call-site.  The module-load-time
 * CI guard calls the same helper so the guard fires correctly regardless of where
 * the check logic lives.
 *
 * This pattern is NOT caught by the static text scan in ci-guard-files.test.mjs
 * (which looks for `process.env.` and `t.skip(` co-located in the same file but
 * cannot reason about whether the check is direct or indirect).  The runtime
 * mutation test below closes that gap.
 *
 * When run with CI=true and ${SENTINEL_VAR} absent, the module-load guard fires
 * (via the helper function) and the process exits non-zero.
 * When run with CI=true and ${SENTINEL_VAR} present, the guard is a no-op and
 * the test body runs normally.
 */
const HELPER_FN_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: helper-fn template
import { test } from 'node:test';

const sentinelValue = process.env.${SENTINEL_VAR};

function shouldSkip() {
  return !sentinelValue;
}

if (shouldSkip() && process.env.CI === 'true') {
  throw new Error(
    'CI=true but ${SENTINEL_VAR} is absent.\\n\\n' +
    'The t.skip() in this file is intended for local dev environments only.\\n' +
    'In CI the env-var must be set; its absence indicates a broken configuration.\\n' +
    'Fix: restore ${SENTINEL_VAR} to the CI job env: block or secrets.',
  );
}

test('env-var-dependent test with helper-fn guard', (t) => {
  if (shouldSkip()) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — synchronous check via the helper result.
  if (sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The INCORRECT helper-function pattern — the same helper-based skip as
 * HELPER_FN_TEMPLATE, but without its module-load-time CI guard.
 * Mutation test Q proves that tests E-G prevent a real silent failure:
 * with CI=true and the env-var absent, this variant skips and exits zero.
 */
const UNGUARDED_HELPER_FN_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: unguarded helper-fn template (demonstrates silent failure)
import { test } from 'node:test';

const sentinelValue = process.env.${SENTINEL_VAR};

function shouldSkip() {
  return !sentinelValue;
}

// No CI guard here — the silent failure this project guards against.

test('env-var-dependent test with helper-fn skip but no CI guard', (t) => {
  if (shouldSkip()) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — synchronous check via the helper result.
  if (sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The BOOL-DERIVED pattern — an intermediate boolean is derived from the
 * env-var BEFORE the skip call, e.g.:
 *
 *   const skip = !process.env.X;
 *   if (skip && process.env.CI === 'true') { throw new Error(...) }
 *   test('...', (t) => { if (skip) { t.skip('...'); return; } ... });
 *
 * The static scan in ci-guard-files.test.mjs detects `process.env.` and
 * `t.skip(` co-located in the same file, so the textual heuristic already
 * passes for this pattern.  However, a developer could accidentally introduce
 * a variant where the boolean is derived but the CI guard is omitted, and the
 * static scan would still flag it — the RUNTIME mutation test here closes the
 * gap by proving the guard actually fires (and does not false-positive) when
 * the skip condition is expressed as a pre-computed boolean rather than an
 * inline env-var check.
 *
 * When run with CI=true and ${SENTINEL_VAR} absent, the module-load guard
 * fires (via the pre-computed boolean) and the process exits non-zero.
 * When run with CI=true and ${SENTINEL_VAR} present, the guard is a no-op
 * and the test body runs normally.
 */
const BOOL_DERIVED_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: bool-derived template
import { test } from 'node:test';

const skip = !process.env.${SENTINEL_VAR};

if (skip && process.env.CI === 'true') {
  throw new Error(
    'CI=true but ${SENTINEL_VAR} is absent.\\n\\n' +
    'The t.skip() in this file is intended for local dev environments only.\\n' +
    'In CI the env-var must be set; its absence indicates a broken configuration.\\n' +
    'Fix: restore ${SENTINEL_VAR} to the CI job env: block or secrets.',
  );
}

test('env-var-dependent test with bool-derived guard', (t) => {
  if (skip) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — verify it has the expected value (synchronous check).
  const sentinelValue = process.env.${SENTINEL_VAR};
  if (!sentinelValue || sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The INCORRECT bool-derived pattern — a test file that uses `const skip =
 * !process.env.X` at module level and then calls `t.skip()` inside the test
 * body, but has NO module-load-time CI guard.
 *
 * When run with CI=true and ${SENTINEL_VAR} absent, the test silently skips
 * ("1 skipped") and the process exits ZERO — an invisible failure, just like
 * UNGUARDED_TEMPLATE but expressed through an intermediate boolean.
 *
 * This template is used in mutation test O to prove the silent failure is real
 * for the bool-derived variant: without the guard, the test runner exits 0 even
 * in CI with the env-var absent, regardless of whether the skip condition is
 * inline or pre-computed.
 */
const UNGUARDED_BOOL_DERIVED_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: unguarded bool-derived template (demonstrates silent failure)
import { test } from 'node:test';

const skip = !process.env.${SENTINEL_VAR};

// No CI guard here — the silent failure this project guards against,
// expressed via a pre-computed boolean rather than an inline env-var check.

test('env-var-dependent test with bool-derived skip but no CI guard', (t) => {
  if (skip) {
    t.skip('SKIP: ${SENTINEL_VAR} not set — configure the env-var to run this test');
    return;
  }
  // Env-var is present — verify it has the expected value (synchronous check).
  const sentinelValue = process.env.${SENTINEL_VAR};
  if (!sentinelValue || sentinelValue.length === 0) {
    throw new Error('sentinel value must be non-empty');
  }
});
`.trimStart();

/**
 * The MULTI-VAR pattern — the skip condition is derived from MORE THAN ONE
 * env-var (e.g. `!process.env.A || !process.env.B`).  The module-load-time CI
 * guard checks both variables so that either absence causes a loud failure in CI
 * rather than a silent skip.
 *
 * This pattern is also not reliably caught by the static scan (which only knows
 * whether `process.env.` appears somewhere in the file, not how many vars are
 * checked or whether ALL of them are covered by the guard).  The runtime
 * mutation tests below prove the guard fires even when only ONE of the two
 * variables is missing.
 *
 * When run with CI=true and either ${SENTINEL_VAR} or ${SENTINEL_VAR_B} absent,
 * the module-load guard fires and the process exits non-zero.
 * When run with CI=true and both vars present, the guard is a no-op and the
 * test body runs normally.
 */
const MULTI_VAR_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: multi-var template
import { test } from 'node:test';

const sentinelA = process.env.${SENTINEL_VAR};
const sentinelB = process.env.${SENTINEL_VAR_B};

if ((!sentinelA || !sentinelB) && process.env.CI === 'true') {
  throw new Error(
    'CI=true but one or more required env-vars are absent.\\n\\n' +
    'Missing: ' + [!sentinelA && '${SENTINEL_VAR}', !sentinelB && '${SENTINEL_VAR_B}'].filter(Boolean).join(', ') + '\\n\\n' +
    'The t.skip() in this file is intended for local dev environments only.\\n' +
    'In CI both env-vars must be set; any absence indicates a broken configuration.\\n' +
    'Fix: restore the missing vars to the CI job env: block or secrets.',
  );
}

test('env-var-dependent test with multi-var guard', (t) => {
  if (!sentinelA || !sentinelB) {
    t.skip('SKIP: ${SENTINEL_VAR} and/or ${SENTINEL_VAR_B} not set — configure both to run this test');
    return;
  }
  // Both env-vars are present — synchronous checks.
  if (sentinelA.length === 0 || sentinelB.length === 0) {
    throw new Error('sentinel values must be non-empty');
  }
});
`.trimStart();

/**
 * The INCORRECT multi-var pattern — a test file that checks multiple env-vars
 * for the skip condition (`!sentinelA || !sentinelB`) but has NO module-load-
 * time CI guard.
 *
 * When run with CI=true and both ${SENTINEL_VAR} and ${SENTINEL_VAR_B} absent,
 * the test silently skips ("1 skipped") and the process exits ZERO — an
 * invisible failure, just like UNGUARDED_TEMPLATE but expressed through an OR-
 * combined multi-var check.
 *
 * This template is used in mutation test P to prove the silent failure is real
 * for the multi-var variant: without the guard, the test runner exits 0 even
 * in CI with both env-vars absent, regardless of how many vars the skip
 * condition checks.
 */
const UNGUARDED_MULTI_VAR_TEMPLATE = `
// TABULA-MEDICA-CI-GUARD-MUTATION: unguarded multi-var template (demonstrates silent failure)
import { test } from 'node:test';

const sentinelA = process.env.${SENTINEL_VAR};
const sentinelB = process.env.${SENTINEL_VAR_B};

// No CI guard here — the silent failure this project guards against,
// expressed via a multi-var OR-combined skip condition rather than a
// single env-var check.

test('env-var-dependent test with multi-var skip but no CI guard', (t) => {
  if (!sentinelA || !sentinelB) {
    t.skip('SKIP: ${SENTINEL_VAR} and/or ${SENTINEL_VAR_B} not set — configure both to run this test');
    return;
  }
  // Both env-vars are present — synchronous checks.
  if (sentinelA.length === 0 || sentinelB.length === 0) {
    throw new Error('sentinel values must be non-empty');
  }
});
`.trimStart();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Write `content` to a unique temp file and return the file path.
 * The caller is responsible for deleting the file (use a finally block).
 *
 * @param {string} suffix - filename suffix (e.g. 'guarded.mjs') for debugging.
 * @param {string} content - file content to write.
 * @returns {string} absolute path to the temp file.
 */
function writeTempFile(suffix, content) {
  const path = join(tmpdir(), `tabula-medica-ci-guard-mutation-${suffix}`);
  writeFileSync(path, content, 'utf8');
  return path;
}

/**
 * Run `node --test <filePath>` as a subprocess with the given env overrides
 * merged on top of a minimal, clean environment (no inherited secrets).
 *
 * Returns { status, stdout, stderr }.
 *
 * We use a clean env (only PATH + overrides) rather than inheriting
 * `process.env` so that a locally-set TABULA_MEDICA_CI_GUARD_MUTATION_SENTINEL
 * in the developer's shell does not accidentally satisfy the guard in tests
 * that expect the guard to fire.
 *
 * @param {string} filePath - absolute path to the temp test file.
 * @param {Object} envOverrides - env-vars to set (e.g. { CI: 'true' }).
 * @returns {Promise<{ status: number|null, stdout: string, stderr: string }>}
 */
async function runTestFile(filePath, envOverrides = {}) {
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: process.env.HOME ?? '/tmp',
    ...envOverrides,
  };

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--test', filePath],
      {
        env,
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    return { status: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    return {
      status: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    };
  }
}

// ── Subprocess mutation tests (run concurrently) ───────────────────────────────
//
// Each case below spawns an independent subprocess and has no shared
// mutable state, so they can all run in parallel.  `describe` with
// `{ concurrency: true }` is the idiomatic Node.js test-runner way to express
// that — it starts every contained test() immediately without waiting for the
// previous one to finish.

describe('subprocess mutation tests', { concurrency: true }, () => {

// ── Mutation test A: guarded file + CI=true + env-var ABSENT → non-zero exit ─
//
// This is the primary assertion: when the CI guard fires (CI=true, env-var
// missing), the process MUST exit non-zero.  If it exits zero, the guard is
// ineffective — it would silently swallow the missing-env-var condition in CI.

test('guarded test file exits non-zero when CI=true and the env-var is absent', async () => {
  const filePath = writeTempFile('guarded.mjs', GUARDED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.notEqual(
      status,
      0,
      'Expected the guarded test file to exit non-zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} absent, but it exited 0.\n\n` +
      'This means the CI guard is NOT effective — it silently swallowed the\n' +
      'missing env-var condition instead of throwing at module-load time.\n\n' +
      'The guard pattern:\n' +
      `  if (!sentinelValue && process.env.CI === 'true') { throw new Error(...) }\n\n` +
      'must fire BEFORE any test runs so that the overall process exits non-zero\n' +
      'and CI catches the infrastructure failure.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test B: unguarded file + CI=true + env-var ABSENT → zero exit ──
//
// This test proves the silent failure is real: WITHOUT the CI guard, the test
// runner exits 0 even in CI with the env-var absent.  It demonstrates WHY the
// guard is necessary and validates that the guard in test A is doing real work
// (not just happening to exit non-zero for an unrelated reason).

test('unguarded test file exits zero when CI=true and the env-var is absent (demonstrates silent failure)', async () => {
  const filePath = writeTempFile('unguarded.mjs', UNGUARDED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.equal(
      status,
      0,
      'Expected the UNGUARDED test file to exit zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} absent (demonstrating the silent-skip failure),\n` +
      `but it exited ${status}.\n\n` +
      'The unguarded file has no module-load-time throw, so t.skip() fires\n' +
      'silently and node --test exits 0 ("1 skipped") — an invisible failure\n' +
      'that would let a broken CI configuration pass undetected.\n\n' +
      'If this assertion fails it may mean node --test now exits non-zero on\n' +
      'skipped tests (a behavioral change in the Node.js test runner).  In that\n' +
      'case re-evaluate whether the CI guard is still necessary.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test C: guarded file + CI=true + env-var PRESENT → zero exit ──
//
// Verifies that the guard does NOT fire when the env-var is correctly supplied.
// This prevents a false-positive where the guard fires unconditionally and
// always exits non-zero regardless of whether the env-var is set.

test('guarded test file exits zero when CI=true and the env-var is present', async () => {
  const filePath = writeTempFile('guarded-with-var.mjs', GUARDED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      CI: 'true',
      [SENTINEL_VAR]: 'tabula-medica-mutation-test-value',
    });

    assert.equal(
      status,
      0,
      'Expected the guarded test file to exit zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} present (guard should NOT fire), but it exited ${status}.\n\n` +
      'The CI guard must only throw when BOTH conditions are true:\n' +
      `  (1) process.env.CI === 'true'\n` +
      `  (2) the required env-var is absent\n\n` +
      'When the env-var is present the guard must be a no-op and the test\n' +
      'body must run to completion.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test D: guarded file + CI NOT set + env-var ABSENT → zero exit ─
//
// Verifies that the guard does NOT fire in local dev (CI is unset).
// A developer running the test suite locally without the env-var configured
// must get a graceful skip, not a thrown error.

test('guarded test file exits zero when CI is not set and the env-var is absent (local dev skip)', async () => {
  const filePath = writeTempFile('guarded-no-ci.mjs', GUARDED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      // CI intentionally NOT included — simulates local dev environment.
    });

    assert.equal(
      status,
      0,
      'Expected the guarded test file to exit zero when CI is not set and\n' +
      `${SENTINEL_VAR} is absent (local dev should get a graceful t.skip()),\n` +
      `but it exited ${status}.\n\n` +
      'The CI guard must be conditional on process.env.CI === \'true\'.\n' +
      'Without that condition the guard fires even in local dev environments,\n' +
      'making it impossible to run the test suite without all env-vars set.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test E: helper-fn guarded file + CI=true + env-var ABSENT → non-zero
//
// The env-var check is delegated to a helper function (shouldSkip()), which is
// also called at module-load time for the CI guard.  This verifies that the
// guard pattern works even when the check logic is not inlined at the throw site.

test('helper-fn guarded test file exits non-zero when CI=true and the env-var is absent', async () => {
  const filePath = writeTempFile('helper-fn-guarded.mjs', HELPER_FN_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.notEqual(
      status,
      0,
      'Expected the helper-fn guarded test file to exit non-zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} absent, but it exited 0.\n\n` +
      'This means the CI guard is NOT effective when the env-var check is delegated\n' +
      'to a helper function — the guard at module-load time must call shouldSkip()\n' +
      '(or equivalent) and throw before any test runs.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test F: helper-fn guarded file + CI=true + env-var PRESENT → zero
//
// Verifies that the helper-fn guard does NOT fire when the env-var is set.

test('helper-fn guarded test file exits zero when CI=true and the env-var is present', async () => {
  const filePath = writeTempFile('helper-fn-guarded-with-var.mjs', HELPER_FN_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      CI: 'true',
      [SENTINEL_VAR]: 'tabula-medica-mutation-test-value',
    });

    assert.equal(
      status,
      0,
      'Expected the helper-fn guarded test file to exit zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} present (guard should NOT fire), but it exited ${status}.\n\n` +
      'The helper-fn CI guard must only throw when BOTH conditions are true:\n' +
      `  (1) process.env.CI === 'true'\n` +
      `  (2) the required env-var is absent (shouldSkip() returns true)\n\n` +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test G: helper-fn guarded file + CI NOT set + env-var ABSENT → zero
//
// Verifies that the helper-fn guard does NOT fire in local dev (CI is unset).

test('helper-fn guarded test file exits zero when CI is not set and the env-var is absent (local dev skip)', async () => {
  const filePath = writeTempFile('helper-fn-guarded-no-ci.mjs', HELPER_FN_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      // CI intentionally NOT included — simulates local dev environment.
    });

    assert.equal(
      status,
      0,
      'Expected the helper-fn guarded test file to exit zero when CI is not set and\n' +
      `${SENTINEL_VAR} is absent (local dev should get a graceful t.skip()),\n` +
      `but it exited ${status}.\n\n` +
      "The helper-fn CI guard must be conditional on process.env.CI === 'true'.\n" +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test H: multi-var guarded file + CI=true + BOTH vars ABSENT → non-zero
//
// The skip condition depends on two env-vars (sentinelA and sentinelB).  When
// both are absent and CI=true, the module-load guard must throw.

test('multi-var guarded test file exits non-zero when CI=true and both env-vars are absent', async () => {
  const filePath = writeTempFile('multi-var-guarded-both-absent.mjs', MULTI_VAR_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.notEqual(
      status,
      0,
      'Expected the multi-var guarded test file to exit non-zero when run with CI=true\n' +
      `and both ${SENTINEL_VAR} and ${SENTINEL_VAR_B} absent, but it exited 0.\n\n` +
      'The CI guard must fire when ANY required env-var is missing, not only when\n' +
      'all of them are missing.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test I: multi-var guarded file + CI=true + ONE var ABSENT → non-zero
//
// A partial configuration where only one of the two required env-vars is set
// must ALSO cause the guard to fire.  This is the most important edge case for
// multi-var guards: the guard must use OR logic (`!A || !B`), not AND (`!A && !B`).

test('multi-var guarded test file exits non-zero when CI=true and only one env-var is absent', async () => {
  const filePath = writeTempFile('multi-var-guarded-one-absent.mjs', MULTI_VAR_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      CI: 'true',
      // SENTINEL_VAR_B intentionally absent — only sentinelA is set.
      [SENTINEL_VAR]: 'tabula-medica-mutation-test-value',
    });

    assert.notEqual(
      status,
      0,
      'Expected the multi-var guarded test file to exit non-zero when run with CI=true\n' +
      `and only ${SENTINEL_VAR} set (${SENTINEL_VAR_B} absent), but it exited 0.\n\n` +
      'The multi-var CI guard must fire when ANY of the required env-vars is missing.\n' +
      'A guard written as `!A && !B` (AND, not OR) would silently pass here because\n' +
      'sentinelA is present — this is the subtle failure the multi-var template\n' +
      'exists to catch at runtime.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test J: multi-var guarded file + CI=true + BOTH vars PRESENT → zero
//
// Verifies that the multi-var guard does NOT fire when both env-vars are set.

test('multi-var guarded test file exits zero when CI=true and both env-vars are present', async () => {
  const filePath = writeTempFile('multi-var-guarded-both-present.mjs', MULTI_VAR_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      CI: 'true',
      [SENTINEL_VAR]: 'tabula-medica-mutation-test-value',
      [SENTINEL_VAR_B]: 'tabula-medica-mutation-test-value-b',
    });

    assert.equal(
      status,
      0,
      'Expected the multi-var guarded test file to exit zero when run with CI=true\n' +
      `and both ${SENTINEL_VAR} and ${SENTINEL_VAR_B} present (guard should NOT fire),\n` +
      `but it exited ${status}.\n\n` +
      'The multi-var CI guard must only throw when at least one env-var is absent.\n' +
      'When all required vars are set the guard must be a no-op.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test K: multi-var guarded file + CI NOT set + BOTH vars ABSENT → zero
//
// Verifies that the multi-var guard does NOT fire in local dev (CI is unset).

test('multi-var guarded test file exits zero when CI is not set and both env-vars are absent (local dev skip)', async () => {
  const filePath = writeTempFile('multi-var-guarded-no-ci.mjs', MULTI_VAR_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      // CI intentionally NOT included — simulates local dev environment.
    });

    assert.equal(
      status,
      0,
      'Expected the multi-var guarded test file to exit zero when CI is not set and\n' +
      `${SENTINEL_VAR} and ${SENTINEL_VAR_B} are absent (local dev should gracefully skip),\n` +
      `but it exited ${status}.\n\n` +
      "The multi-var CI guard must be conditional on process.env.CI === 'true'.\n" +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test P: unguarded multi-var file + CI=true + BOTH vars ABSENT → zero exit
//
// Proves the silent failure is real for the multi-var variant: even when the
// skip condition checks two env-vars with OR logic (`!sentinelA || !sentinelB`),
// the absence of a CI guard still lets the test runner exit 0 ("1 skipped")
// invisibly in CI.  This validates that tests H-K are exercising real guard
// behavior — the guard in MULTI_VAR_TEMPLATE is doing actual work, not just
// happening to exit non-zero for an unrelated reason.

test('unguarded multi-var test file exits zero when CI=true and both env-vars are absent (demonstrates silent failure)', async () => {
  const filePath = writeTempFile('unguarded-multi-var.mjs', UNGUARDED_MULTI_VAR_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.equal(
      status,
      0,
      'Expected the UNGUARDED multi-var test file to exit zero when run with CI=true\n' +
      `and both ${SENTINEL_VAR} and ${SENTINEL_VAR_B} absent (demonstrating the\n` +
      `silent-skip failure), but it exited ${status}.\n\n` +
      'The unguarded multi-var file has no module-load-time throw — even with the\n' +
      'skip condition checking two env-vars with OR logic (!sentinelA || !sentinelB),\n' +
      'node --test exits 0 ("1 skipped") when both vars are absent and no CI guard\n' +
      'is present.  This is an invisible failure that would let a broken CI\n' +
      'configuration pass undetected.\n\n' +
      'If this assertion fails it may mean node --test now exits non-zero on skipped\n' +
      'tests (a behavioral change in the Node.js test runner).  In that case\n' +
      're-evaluate whether the CI guard is still necessary for the multi-var pattern.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test L: bool-derived guarded file + CI=true + env-var ABSENT → non-zero
//
// The skip condition is computed into a boolean BEFORE the t.skip() call:
//   const skip = !process.env.X;
//   if (skip && process.env.CI === 'true') { throw ... }
// When CI=true and the env-var is absent, the pre-computed boolean is true so
// the module-load guard must throw and the process must exit non-zero.

test('bool-derived guarded test file exits non-zero when CI=true and the env-var is absent', async () => {
  const filePath = writeTempFile('bool-derived-guarded.mjs', BOOL_DERIVED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.notEqual(
      status,
      0,
      'Expected the bool-derived guarded test file to exit non-zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} absent, but it exited 0.\n\n` +
      'This means the CI guard is NOT effective when the skip condition is stored in\n' +
      'an intermediate boolean (const skip = !process.env.X) rather than checked\n' +
      'inline — the guard at module-load time must use the same boolean and throw\n' +
      'before any test runs.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test M: bool-derived guarded file + CI=true + env-var PRESENT → zero
//
// Verifies that the bool-derived guard does NOT fire when the env-var is set.

test('bool-derived guarded test file exits zero when CI=true and the env-var is present', async () => {
  const filePath = writeTempFile('bool-derived-guarded-with-var.mjs', BOOL_DERIVED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      CI: 'true',
      [SENTINEL_VAR]: 'tabula-medica-mutation-test-value',
    });

    assert.equal(
      status,
      0,
      'Expected the bool-derived guarded test file to exit zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} present (guard should NOT fire), but it exited ${status}.\n\n` +
      'The bool-derived CI guard must only throw when BOTH conditions are true:\n' +
      `  (1) process.env.CI === 'true'\n` +
      `  (2) the required env-var is absent (skip === true)\n\n` +
      'When the env-var is present skip is false so the guard must be a no-op.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test N: bool-derived guarded file + CI NOT set + env-var ABSENT → zero
//
// Verifies that the bool-derived guard does NOT fire in local dev (CI is unset).

test('bool-derived guarded test file exits zero when CI is not set and the env-var is absent (local dev skip)', async () => {
  const filePath = writeTempFile('bool-derived-guarded-no-ci.mjs', BOOL_DERIVED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, {
      // CI intentionally NOT included — simulates local dev environment.
    });

    assert.equal(
      status,
      0,
      'Expected the bool-derived guarded test file to exit zero when CI is not set and\n' +
      `${SENTINEL_VAR} is absent (local dev should get a graceful t.skip()),\n` +
      `but it exited ${status}.\n\n` +
      "The bool-derived CI guard must be conditional on process.env.CI === 'true'.\n" +
      'Without that condition the guard fires even in local dev environments,\n' +
      'making it impossible to run the test suite without all env-vars set.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test O: unguarded bool-derived file + CI=true + env-var ABSENT → zero exit
//
// Proves the silent failure is real for the bool-derived variant: even when the
// skip condition is stored in a pre-computed boolean (const skip = !process.env.X)
// rather than checked inline, the absence of a CI guard still lets the test
// runner exit 0 ("1 skipped") invisibly in CI.  This validates that tests L-N
// are exercising real guard behavior — the guard in BOOL_DERIVED_TEMPLATE is
// doing actual work, not just happening to exit non-zero for an unrelated reason.

test('unguarded bool-derived test file exits zero when CI=true and the env-var is absent (demonstrates silent failure)', async () => {
  const filePath = writeTempFile('unguarded-bool-derived.mjs', UNGUARDED_BOOL_DERIVED_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });

    assert.equal(
      status,
      0,
      'Expected the UNGUARDED bool-derived test file to exit zero when run with CI=true\n' +
      `and ${SENTINEL_VAR} absent (demonstrating the silent-skip failure),\n` +
      `but it exited ${status}.\n\n` +
      'The unguarded bool-derived file has no module-load-time throw — even with the\n' +
      'skip condition stored in an intermediate boolean (const skip = !process.env.X),\n' +
      'node --test exits 0 ("1 skipped") when the env-var is absent and no CI guard\n' +
      'is present.  This is an invisible failure that would let a broken CI\n' +
      'configuration pass undetected.\n\n' +
      'If this assertion fails it may mean node --test now exits non-zero on skipped\n' +
      'tests (a behavioral change in the Node.js test runner).  In that case\n' +
      're-evaluate whether the CI guard is still necessary for the bool-derived pattern.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

// ── Mutation test Q: unguarded helper-fn + CI=true + env-var ABSENT → zero exit
//
// This counterpart to tests E-G proves the helper-based skip silently succeeds
// without the CI guard, rather than failing for an unrelated runtime reason.
test('unguarded helper-fn test file exits zero when CI=true and the env-var is absent (demonstrates silent failure)', async () => {
  const filePath = writeTempFile('unguarded-helper-fn.mjs', UNGUARDED_HELPER_FN_TEMPLATE);

  try {
    const { status, stdout, stderr } = await runTestFile(filePath, { CI: 'true' });
    const output = stdout + stderr;

    assert.equal(
      status,
      0,
      'Expected the UNGUARDED helper-fn test file to exit zero with CI=true\n' +
      `and ${SENTINEL_VAR} absent, but it exited ${status}.\n` +
      'Without the guard, shouldSkip() must cause a silent skip, proving\n' +
      'that the guards exercised by tests E-G are doing meaningful work.\n\n' +
      `stdout: ${stdout.slice(0, 500)}\n` +
      `stderr: ${stderr.slice(0, 500)}`,
    );
    assert.match(output, /# tests 1\b/, 'The template must execute one test, not pass as an empty file.');
    assert.match(output, /# skipped 1\b/, 'The helper-based test must actually skip when the env-var is absent.');
  } finally {
    try { unlinkSync(filePath); } catch (_) { /* best effort */ }
  }
});

}); // end describe('subprocess mutation tests')

// ── Template integrity self-check ──────────────────────────────────────────────
//
// Guard against accidental erasure or stubbing of the template constants.
// An empty or trivially short template would cause the mutation tests above to
// silently pass on a no-op test file (node --test on a file with no tests exits
// zero), defeating the protection they provide.

test('GUARDED_TEMPLATE is non-empty and contains the sentinel strings', async () => {
  assert.ok(
    typeof GUARDED_TEMPLATE === 'string' && GUARDED_TEMPLATE.trim().length > 0,
    'GUARDED_TEMPLATE is empty or not a string.\n' +
    'The template must contain the guarded test-file source for the mutation tests.',
  );

  assert.ok(
    GUARDED_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: guarded template'),
    'GUARDED_TEMPLATE is missing the sentinel comment "TABULA-MEDICA-CI-GUARD-MUTATION: guarded template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify this file\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    GUARDED_TEMPLATE.includes("process.env.CI === 'true'"),
    "GUARDED_TEMPLATE no longer contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The guard must be present in the template so the mutation test actually exercises\n' +
    'the guarded pattern — not a no-op file.',
  );

  assert.ok(
    GUARDED_TEMPLATE.includes('t.skip('),
    'GUARDED_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so the mutation test\n' +
    'verifies that the guard prevents a silent skip.',
  );
});

test('UNGUARDED_TEMPLATE is non-empty and contains the sentinel strings but NOT the CI guard', async () => {
  assert.ok(
    typeof UNGUARDED_TEMPLATE === 'string' && UNGUARDED_TEMPLATE.trim().length > 0,
    'UNGUARDED_TEMPLATE is empty or not a string.\n' +
    'The template must contain the unguarded test-file source for mutation test B.',
  );

  assert.ok(
    UNGUARDED_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded template'),
    'UNGUARDED_TEMPLATE is missing the sentinel comment "TABULA-MEDICA-CI-GUARD-MUTATION: unguarded template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify the template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    !UNGUARDED_TEMPLATE.includes("process.env.CI === 'true'"),
    "UNGUARDED_TEMPLATE contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The unguarded template must NOT contain the guard — it is specifically designed\n' +
    'to demonstrate the silent-skip failure that occurs without the guard.',
  );

  assert.ok(
    UNGUARDED_TEMPLATE.includes('t.skip('),
    'UNGUARDED_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so mutation test B\n' +
    'can verify the silent-skip failure is real.',
  );
});

test('HELPER_FN_TEMPLATE is non-empty and contains the sentinel strings', async () => {
  assert.ok(
    typeof HELPER_FN_TEMPLATE === 'string' && HELPER_FN_TEMPLATE.trim().length > 0,
    'HELPER_FN_TEMPLATE is empty or not a string.\n' +
    'The template must contain the helper-fn guarded test-file source for mutation tests E-G.',
  );

  assert.ok(
    HELPER_FN_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: helper-fn template'),
    'HELPER_FN_TEMPLATE is missing the sentinel comment "TABULA-MEDICA-CI-GUARD-MUTATION: helper-fn template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify this template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    HELPER_FN_TEMPLATE.includes("process.env.CI === 'true'"),
    "HELPER_FN_TEMPLATE no longer contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The guard must be present so that mutation test E exercises the guarded helper-fn pattern.',
  );

  assert.ok(
    HELPER_FN_TEMPLATE.includes('shouldSkip()'),
    "HELPER_FN_TEMPLATE no longer contains the shouldSkip() helper-function call.\n" +
    'The template must delegate the env-var check to a helper function so the mutation\n' +
    'tests prove the guard works even with an indirect check.',
  );

  assert.ok(
    HELPER_FN_TEMPLATE.includes('t.skip('),
    'HELPER_FN_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so the mutation test\n' +
    'verifies that the helper-fn guard prevents a silent skip.',
  );
});

test('UNGUARDED_HELPER_FN_TEMPLATE is non-empty and contains the sentinel strings but NOT the CI guard', () => {
  assert.ok(
    typeof UNGUARDED_HELPER_FN_TEMPLATE === 'string' && UNGUARDED_HELPER_FN_TEMPLATE.trim().length > 0,
    'UNGUARDED_HELPER_FN_TEMPLATE must contain the unguarded helper-fn source for mutation test Q.',
  );
  assert.ok(
    UNGUARDED_HELPER_FN_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded helper-fn template'),
    'UNGUARDED_HELPER_FN_TEMPLATE is missing its sentinel comment used by the guard-file canary.',
  );
  assert.ok(
    !UNGUARDED_HELPER_FN_TEMPLATE.includes("process.env.CI === 'true'"),
    'UNGUARDED_HELPER_FN_TEMPLATE must NOT contain the CI guard: it demonstrates the silent failure.',
  );
  assert.ok(
    UNGUARDED_HELPER_FN_TEMPLATE.includes(`const sentinelValue = process.env.${SENTINEL_VAR};`),
    'UNGUARDED_HELPER_FN_TEMPLATE must read the sentinel env-var.',
  );
  assert.ok(
    UNGUARDED_HELPER_FN_TEMPLATE.includes('function shouldSkip()') &&
      UNGUARDED_HELPER_FN_TEMPLATE.includes('return !sentinelValue;') &&
      UNGUARDED_HELPER_FN_TEMPLATE.includes('if (shouldSkip())'),
    'UNGUARDED_HELPER_FN_TEMPLATE must define and use the env-var-dependent shouldSkip() helper.',
  );
  assert.ok(
    UNGUARDED_HELPER_FN_TEMPLATE.includes('t.skip('),
    'UNGUARDED_HELPER_FN_TEMPLATE must contain a t.skip() call to demonstrate silent failure.',
  );
});

test('MULTI_VAR_TEMPLATE is non-empty and contains the sentinel strings', async () => {
  assert.ok(
    typeof MULTI_VAR_TEMPLATE === 'string' && MULTI_VAR_TEMPLATE.trim().length > 0,
    'MULTI_VAR_TEMPLATE is empty or not a string.\n' +
    'The template must contain the multi-var guarded test-file source for mutation tests H-K.',
  );

  assert.ok(
    MULTI_VAR_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: multi-var template'),
    'MULTI_VAR_TEMPLATE is missing the sentinel comment "TABULA-MEDICA-CI-GUARD-MUTATION: multi-var template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify this template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    MULTI_VAR_TEMPLATE.includes("process.env.CI === 'true'"),
    "MULTI_VAR_TEMPLATE no longer contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The guard must be present so that mutation tests H and I exercise the multi-var guard.',
  );

  assert.ok(
    MULTI_VAR_TEMPLATE.includes('sentinelA') && MULTI_VAR_TEMPLATE.includes('sentinelB'),
    'MULTI_VAR_TEMPLATE no longer references both sentinelA and sentinelB.\n' +
    'The template must use TWO env-vars so the mutation tests can verify the guard\n' +
    'fires even when only ONE of the variables is missing (OR logic, not AND logic).',
  );

  assert.ok(
    MULTI_VAR_TEMPLATE.includes('t.skip('),
    'MULTI_VAR_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so the mutation tests\n' +
    'verify that the multi-var guard prevents silent skips.',
  );
});

test('UNGUARDED_MULTI_VAR_TEMPLATE is non-empty and contains the sentinel strings but NOT the CI guard', () => {
  assert.ok(
    typeof UNGUARDED_MULTI_VAR_TEMPLATE === 'string' && UNGUARDED_MULTI_VAR_TEMPLATE.trim().length > 0,
    'UNGUARDED_MULTI_VAR_TEMPLATE is empty or not a string.\n' +
    'The template must contain the unguarded multi-var test-file source for mutation test P.',
  );

  assert.ok(
    UNGUARDED_MULTI_VAR_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded multi-var template'),
    'UNGUARDED_MULTI_VAR_TEMPLATE is missing the sentinel comment\n' +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: unguarded multi-var template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify the template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    !UNGUARDED_MULTI_VAR_TEMPLATE.includes("process.env.CI === 'true'"),
    "UNGUARDED_MULTI_VAR_TEMPLATE contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The unguarded multi-var template must NOT contain the guard — it is specifically designed\n' +
    'to demonstrate the silent-skip failure that occurs without the guard, even when the\n' +
    'skip condition is derived from multiple env-vars with OR logic.',
  );

  assert.ok(
    UNGUARDED_MULTI_VAR_TEMPLATE.includes('sentinelA') && UNGUARDED_MULTI_VAR_TEMPLATE.includes('sentinelB'),
    'UNGUARDED_MULTI_VAR_TEMPLATE no longer references both sentinelA and sentinelB.\n' +
    'The template must use TWO env-vars (with OR logic) so mutation test P demonstrates\n' +
    'the silent failure is real even for multi-var skip conditions.',
  );

  assert.ok(
    UNGUARDED_MULTI_VAR_TEMPLATE.includes('t.skip('),
    'UNGUARDED_MULTI_VAR_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so mutation test P\n' +
    'can verify the silent-skip failure is real for the multi-var pattern.',
  );
});

test('BOOL_DERIVED_TEMPLATE is non-empty and contains the sentinel strings', () => {
  assert.ok(
    typeof BOOL_DERIVED_TEMPLATE === 'string' && BOOL_DERIVED_TEMPLATE.trim().length > 0,
    'BOOL_DERIVED_TEMPLATE is empty or not a string.\n' +
    'The template must contain the bool-derived guarded test-file source for mutation tests L-N.',
  );

  assert.ok(
    BOOL_DERIVED_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: bool-derived template'),
    'BOOL_DERIVED_TEMPLATE is missing the sentinel comment "TABULA-MEDICA-CI-GUARD-MUTATION: bool-derived template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify this template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    BOOL_DERIVED_TEMPLATE.includes("process.env.CI === 'true'"),
    "BOOL_DERIVED_TEMPLATE no longer contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The guard must be present so that mutation test L exercises the bool-derived guard pattern.',
  );

  assert.ok(
    BOOL_DERIVED_TEMPLATE.includes('const skip ='),
    "BOOL_DERIVED_TEMPLATE no longer contains the intermediate boolean assignment (const skip =).\n" +
    'The template must derive the skip condition into a boolean BEFORE the guard and the t.skip()\n' +
    'call so that mutation tests L-N prove the guard works even with a pre-computed boolean.',
  );

  assert.ok(
    BOOL_DERIVED_TEMPLATE.includes('t.skip('),
    'BOOL_DERIVED_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so the mutation test\n' +
    'verifies that the bool-derived guard prevents a silent skip.',
  );
});

test('UNGUARDED_BOOL_DERIVED_TEMPLATE is non-empty and contains the sentinel strings but NOT the CI guard', () => {
  assert.ok(
    typeof UNGUARDED_BOOL_DERIVED_TEMPLATE === 'string' && UNGUARDED_BOOL_DERIVED_TEMPLATE.trim().length > 0,
    'UNGUARDED_BOOL_DERIVED_TEMPLATE is empty or not a string.\n' +
    'The template must contain the unguarded bool-derived test-file source for mutation test O.',
  );

  assert.ok(
    UNGUARDED_BOOL_DERIVED_TEMPLATE.includes('TABULA-MEDICA-CI-GUARD-MUTATION: unguarded bool-derived template'),
    'UNGUARDED_BOOL_DERIVED_TEMPLATE is missing the sentinel comment\n' +
    '"TABULA-MEDICA-CI-GUARD-MUTATION: unguarded bool-derived template".\n' +
    'The sentinel is used by the ci-guard-files.test.mjs canary to verify the template\n' +
    'has not been replaced with a no-op stub.',
  );

  assert.ok(
    !UNGUARDED_BOOL_DERIVED_TEMPLATE.includes("process.env.CI === 'true'"),
    "UNGUARDED_BOOL_DERIVED_TEMPLATE contains the CI guard pattern (process.env.CI === 'true').\n" +
    'The unguarded bool-derived template must NOT contain the guard — it is specifically designed\n' +
    'to demonstrate the silent-skip failure that occurs without the guard, even when the\n' +
    'skip condition is stored in an intermediate boolean.',
  );

  assert.ok(
    UNGUARDED_BOOL_DERIVED_TEMPLATE.includes('const skip ='),
    "UNGUARDED_BOOL_DERIVED_TEMPLATE no longer contains the intermediate boolean assignment (const skip =).\n" +
    'The template must derive the skip condition into a boolean BEFORE the t.skip() call\n' +
    'to demonstrate that the silent failure occurs with pre-computed booleans too.',
  );

  assert.ok(
    UNGUARDED_BOOL_DERIVED_TEMPLATE.includes('t.skip('),
    'UNGUARDED_BOOL_DERIVED_TEMPLATE no longer contains a t.skip() call.\n' +
    'The template must include an env-var-dependent t.skip() so mutation test O\n' +
    'can verify the silent-skip failure is real for the bool-derived pattern.',
  );
});
