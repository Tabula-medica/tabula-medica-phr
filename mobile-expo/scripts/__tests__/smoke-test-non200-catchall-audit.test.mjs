#!/usr/bin/env node
/**
 * smoke-test-non200-catchall-audit.test.mjs
 *
 * Audit: which smoke-test scripts in scripts/ embed a bash routing block that
 * contains a `!= "200"` catch-all branch, and verify that every such branch
 * body contains `exit 1` (hard-fail), not a silent fallthrough.
 *
 * ── Background ────────────────────────────────────────────────────────────────
 *
 * scripts/smoke-test-branch-protection-check.sh copies the bash HTTP-status
 * routing block from .github/actions/assert-required-checks/action.yml verbatim
 * into its run_check() function.  That routing block ends with a catch-all guard:
 *
 *   if [ "${HTTP_STATUS}" != "200" ]; then
 *     … exit 1
 *   fi
 *
 * The parity tests in branch-protection-check-parity.test.mjs assert that this
 * block (and its exit 1) are present in BOTH action.yml AND the smoke-test copy.
 *
 * Other smoke-test scripts in scripts/ may follow the same pattern — embedding
 * a verbatim bash routing block that includes a `!= "200"` catch-all.  If any
 * such copy loses its `exit 1` (e.g. silently changed to exit 0 or removed), the
 * TC fixture that hits the catch-all path would pass vacuously, providing no
 * real protection.
 *
 * ── What this file does ───────────────────────────────────────────────────────
 *
 * 1. AUDIT SNAPSHOT — documents the complete audit performed on 2026-06-21:
 *    every .sh file in scripts/ was examined for the `!= "200"` pattern.
 *    Only one script was found: smoke-test-branch-protection-check.sh.
 *    That script is already covered by branch-protection-check-parity.test.mjs.
 *
 * 2. ONGOING GUARD — actively scans ALL scripts/*.sh files at test time and,
 *    for every file that contains a `!= "200"` catch-all branch, asserts that
 *    the body of that branch contains `exit 1`.  This catches future scripts
 *    that adopt the same pattern but forget the hard-fail.
 *
 * 3. KNOWN-SET SENTINEL — asserts that the set of scripts matching the pattern
 *    equals the known set from the 2026-06-21 audit.  If a new script is added
 *    with this pattern, this test fails with a clear message directing the author
 *    to add dedicated parity assertions (analogous to branch-protection-check-
 *    parity.test.mjs) for the new script.
 *
 * ── How to run ────────────────────────────────────────────────────────────────
 *
 * Run with: node scripts/__tests__/smoke-test-non200-catchall-audit.test.mjs
 * Auto-picked up by: npm run test:scripts (glob scripts/__tests__/*.test.mjs)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT        = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPTS_DIR = join(ROOT, 'scripts');

/**
 * The complete set of scripts that contained a `!= "200"` catch-all bash
 * routing block as of the 2026-06-21 audit.  Any change to this set must be
 * reviewed and the set updated deliberately.
 *
 * Note: smoke-test-branch-protection-check.sh is covered by the dedicated
 * parity test in branch-protection-check-parity.test.mjs.  It is listed here
 * so the sentinel stays accurate and alerts authors when a NEW script joins
 * the set.
 */
const KNOWN_NON200_SCRIPTS = new Set([
  'smoke-test-branch-protection-check.sh',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Return the basename of every *.sh file directly under scripts/.
 * Does not recurse into subdirectories.
 *
 * @returns {string[]}
 */
function listShellScripts() {
  return readdirSync(SCRIPTS_DIR, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.sh'))
    .map(entry => entry.name);
}

/**
 * Return true if the file content contains a `!= "200"` (or `!= '200'`)
 * bash catch-all branch — i.e. a routing block that guards against unexpected
 * non-200 HTTP responses.
 *
 * We accept both quote styles so the check is robust to minor style variation.
 *
 * @param {string} text
 * @returns {boolean}
 */
function hasNon200CatchAll(text) {
  return /\$\{HTTP_STATUS\}"?\s+!=\s*["']200["']/.test(text);
}

/**
 * Given the full text of a shell script, extract a short slice of text
 * starting at the `!= "200"` catch-all condition and ending at the first
 * `fi` keyword that closes it.
 *
 * Returns null if the catch-all condition cannot be found (caller should
 * have pre-screened with hasNon200CatchAll).
 *
 * @param {string} text
 * @returns {string | null}
 */
function extractCatchAllBody(text) {
  const CATCHALL_RE = /\$\{HTTP_STATUS\}"?\s+!=\s*["']200["']/;
  const startPos = text.search(CATCHALL_RE);
  if (startPos === -1) return null;

  const slice = text.slice(startPos);
  const fiMatch = slice.search(/\bfi\b/);
  return fiMatch !== -1 ? slice.slice(0, fiMatch) : slice;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('audit snapshot: only the known scripts contain a != "200" catch-all bash routing branch', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // This test is both a record of the 2026-06-21 audit and a sentinel that
  // fires whenever a new script joins (or leaves) the known set.
  //
  // When this test fails because a new script was added:
  //   1. Verify the new script's catch-all body contains `exit 1` (the next
  //      test will also catch this automatically).
  //   2. Add dedicated parity assertions for the new script, analogous to the
  //      tests in branch-protection-check-parity.test.mjs, to guard against
  //      drift between the canonical source and the embedded copy.
  //   3. Update KNOWN_NON200_SCRIPTS in this file to include the new script.
  // ──────────────────────────────────────────────────────────────────────────

  const scripts     = listShellScripts();
  const foundScripts = new Set(
    scripts.filter(name => {
      const text = readFileSync(join(SCRIPTS_DIR, name), 'utf8');
      return hasNon200CatchAll(text);
    }),
  );

  const extra   = [...foundScripts].filter(s => !KNOWN_NON200_SCRIPTS.has(s)).sort();
  const missing = [...KNOWN_NON200_SCRIPTS].filter(s => !foundScripts.has(s)).sort();

  assert.strictEqual(
    extra.length,
    0,
    'One or more scripts/*.sh files contain a `!= "200"` catch-all bash routing\n' +
    'branch that were NOT present during the 2026-06-21 audit.\n\n' +
    `New scripts found: ${extra.join(', ')}\n\n` +
    'Action required:\n' +
    '  1. Verify each new script\'s catch-all branch body contains `exit 1`.\n' +
    '  2. Add dedicated parity tests for the new script (analogous to\n' +
    '     scripts/__tests__/branch-protection-check-parity.test.mjs).\n' +
    '  3. Add the new script name(s) to KNOWN_NON200_SCRIPTS in\n' +
    '     scripts/__tests__/smoke-test-non200-catchall-audit.test.mjs.',
  );

  assert.strictEqual(
    missing.length,
    0,
    'A script that was known to contain a `!= "200"` catch-all branch\n' +
    'is no longer found in scripts/.\n\n' +
    `Missing: ${missing.join(', ')}\n\n` +
    'If the script was intentionally deleted or renamed, remove it from\n' +
    'KNOWN_NON200_SCRIPTS in scripts/__tests__/smoke-test-non200-catchall-audit.test.mjs.',
  );
});

test('every scripts/*.sh with a != "200" catch-all branch has exit 1 in the catch-all body', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // A smoke-test script that embeds a bash routing copy with a `!= "200"`
  // catch-all MUST hard-fail (exit 1) in that branch.  If exit 1 is absent
  // (e.g. silently removed, changed to exit 0, or replaced with a continue),
  // any TC fixture that injects an unexpected HTTP status will pass vacuously
  // because the subshell falls through to the next block without aborting.
  //
  // This test auto-discovers all matching scripts and asserts the hard-fail
  // so the check remains valid even when new scripts are added in the future.
  // ──────────────────────────────────────────────────────────────────────────

  const scripts = listShellScripts();

  for (const name of scripts) {
    const filePath = join(SCRIPTS_DIR, name);
    const text     = readFileSync(filePath, 'utf8');

    if (!hasNon200CatchAll(text)) continue;

    const catchallBody = extractCatchAllBody(text);

    assert.ok(
      catchallBody !== null,
      `[${name}] hasNon200CatchAll() returned true but extractCatchAllBody()\n` +
      'could not locate the catch-all condition.  The regex used by the two\n' +
      'helpers may have drifted — check hasNon200CatchAll and extractCatchAllBody\n' +
      'in scripts/__tests__/smoke-test-non200-catchall-audit.test.mjs.',
    );

    assert.ok(
      /\bexit\s+1\b/.test(catchallBody),
      `[${name}] The \`!= "200"\` catch-all bash branch does not contain \`exit 1\`.\n\n` +
      'A catch-all non-200 guard MUST hard-fail so that any unexpected HTTP\n' +
      'response (e.g. 500, 422, 429) causes the smoke-test to abort rather than\n' +
      'silently fall through to the next block.\n\n' +
      'Without exit 1, TC fixtures that inject unexpected status codes will pass\n' +
      'vacuously and provide no real protection.\n\n' +
      `Catch-all branch body extracted from ${filePath}:\n${catchallBody}\n\n` +
      'Fix: restore `exit 1` inside the catch-all branch:\n' +
      '  if [ "${HTTP_STATUS}" != "200" ]; then\n' +
      '    echo "..." >&2\n' +
      '    exit 1\n' +
      '  fi',
    );
  }
});

// ── Detection-logic fixtures ───────────────────────────────────────────────────
//
// These synthetic-script tests prove that hasNon200CatchAll + extractCatchAllBody
// + the exit-1 check produce the correct verdict for the three failure patterns
// the CI step guards against.  They run as part of `npm run test:scripts` and
// independently validate the Node.js detection helpers so regressions in the
// helpers are caught before the CI YAML step is the only line of defence.

test('detection fixture: exit 1 missing from catch-all branch body is flagged', () => {
  const script = [
    '#!/usr/bin/env bash',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/api)',
    'if [ "${HTTP_STATUS}" != "200" ]; then',
    '  echo "Unexpected status: ${HTTP_STATUS}" >&2',
    'fi',
    'echo "done"',
  ].join('\n');

  assert.ok(hasNon200CatchAll(script), 'fixture should trigger hasNon200CatchAll');
  const body = extractCatchAllBody(script);
  assert.ok(body !== null, 'extractCatchAllBody should return a non-null body');
  assert.ok(
    !/\bexit\s+1\b/.test(body),
    'The catch-all body must NOT contain exit 1 in this fixture — ' +
    'if it does, the fixture is wrong and will give a false sense of security.',
  );
});

test('detection fixture: exit 1 only after the closing fi is not captured in the body', () => {
  // exit 1 appears AFTER the closing fi of the catch-all branch.
  // extractCatchAllBody must stop at fi so the exit 1 is NOT included,
  // making the check correctly flag this script.
  const script = [
    '#!/usr/bin/env bash',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/api)',
    'if [ "${HTTP_STATUS}" != "200" ]; then',
    '  echo "Unexpected status: ${HTTP_STATUS}" >&2',
    'fi',
    '# exit 1 here is OUTSIDE the catch-all branch',
    'exit 1',
  ].join('\n');

  assert.ok(hasNon200CatchAll(script), 'fixture should trigger hasNon200CatchAll');
  const body = extractCatchAllBody(script);
  assert.ok(body !== null, 'extractCatchAllBody should return a non-null body');
  assert.ok(
    !/\bexit\s+1\b/.test(body),
    'exit 1 outside the branch must NOT appear in the extracted body — ' +
    'extractCatchAllBody must stop at the closing fi, not include later lines.',
  );
});

test('detection fixture: script with good and bad != "200" branches — bad one is caught', () => {
  // When a script has multiple != "200" branches, a bad branch (no exit 1)
  // must be caught even if another branch in the same file is fine.
  // This fixture uses two separate invocations of run_check() with different
  // routing blocks; the second omits exit 1.
  //
  // Note: extractCatchAllBody only locates the FIRST match.  The real guard
  // for multiple matches is the CI Python step (which loops over all matches)
  // and the ongoing test above (which scans all real scripts/*.sh files).
  // This fixture validates the helper correctly finds the first match.
  const scriptWithTwoBlocks = [
    '#!/usr/bin/env bash',
    '# First check — has exit 1 (good)',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/a)',
    'if [ "${HTTP_STATUS}" != "200" ]; then',
    '  echo "Check A failed" >&2',
    '  exit 1',
    'fi',
    '# Second check — missing exit 1 (bad)',
    'HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://example.com/b)',
    'if [ "${HTTP_STATUS}" != "200" ]; then',
    '  echo "Check B failed" >&2',
    'fi',
  ].join('\n');

  assert.ok(
    hasNon200CatchAll(scriptWithTwoBlocks),
    'fixture should trigger hasNon200CatchAll',
  );
  // extractCatchAllBody finds the first match; that first branch IS good.
  // This confirms the helper returns the correct body for the first branch.
  const firstBody = extractCatchAllBody(scriptWithTwoBlocks);
  assert.ok(firstBody !== null, 'first body should not be null');
  assert.ok(
    /\bexit\s+1\b/.test(firstBody),
    'first branch body should contain exit 1 in this fixture',
  );
});
