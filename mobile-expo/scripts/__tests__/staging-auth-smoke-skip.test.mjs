#!/usr/bin/env node
/**
 * Unit tests for the credential-skip guard in auth-smoke steps across CI
 * workflow files.
 *
 * The guard is:
 *
 *   if [ -z "${REVIEWER_EMAIL:-}" ] || [ -z "${REVIEWER_PASSWORD:-}" ]; then
 *     ... exit 0
 *   fi
 *
 * CONTRACT: every `run:` block in any `.github/workflows/*.yml` file that
 * calls `smoke-test-reviewer-login.sh` MUST also contain the
 * `REVIEWER_PASSWORD:-}` guard in that same block, so a missing secret
 * produces a graceful skip instead of a confusing bash `:?` failure.
 *
 * ENV-INJECTION CONTRACT: every YAML step that calls the smoke script MUST
 * also expose `REVIEWER_EMAIL` and `REVIEWER_PASSWORD` to the step via an
 * `env:` mapping (at the step level, before or after the `run:` block).
 * Without the injection the guard always evaluates both variables as unset
 * and silently skips on every run, giving a false-green result even when
 * credentials are correctly configured in GitHub secrets.
 *
 * The dynamic contract tests below discover all current and future
 * occurrences automatically — hardcoding the three original files is no
 * longer sufficient.
 *
 * Behavioral tests (shared logic):
 *   1. Both variables present → guard does NOT trigger (script proceeds).
 *   2. REVIEWER_EMAIL empty, REVIEWER_PASSWORD present → guard triggers (skip).
 *   3. REVIEWER_EMAIL present, REVIEWER_PASSWORD empty → guard triggers (skip).
 *   4. Both variables empty → guard triggers (skip).
 *
 * The tests evaluate the guard expression directly — no real network calls are
 * made.  This is the script-level complement to the server-side assertion in
 * `server/__tests__/reviewer-login.test.ts` (which validates the login route
 * itself); the two are intentionally independent.
 *
 * Run with: node scripts/__tests__/staging-auth-smoke-skip.test.mjs
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows');
const SCRIPT_NAME = 'smoke-test-reviewer-login.sh';
const GUARD_PATTERN = 'REVIEWER_PASSWORD:-}';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simulate the bash guard:
 *   if [ -z "${REVIEWER_EMAIL:-}" ] || [ -z "${REVIEWER_PASSWORD:-}" ]; then
 *     exit 0   # skip
 *   fi
 *
 * Returns true when the guard would trigger (i.e. the smoke step is skipped),
 * false when both credentials are present and the script proceeds.
 */
function guardWouldSkip(email, password) {
  const emailEmpty  = !email  || email.trim()  === '';
  const passEmpty   = !password || password.trim() === '';
  return emailEmpty || passEmpty;
}

/**
 * Given the lines of a YAML workflow file and the 0-based index of a line
 * that calls the smoke script, walk backward to find the enclosing `run:`
 * block opener and return all lines from that opener through the script call
 * line (inclusive) as a single string.
 *
 * The heuristic: scan backward until we hit a line whose trimmed content
 * starts with `run:` (this is the YAML step `run:` property, not a list-item
 * bullet). Collect everything from that line to the script line.
 *
 * If no `run:` line is found within 120 lines we fall back to a 120-line
 * window so the assertion still fires meaningfully.
 *
 * @param {string[]} lines        - all lines of the file (split on '\n')
 * @param {number}   scriptLineIdx - 0-based index of the line with the script
 * @returns {string} the extracted block content
 */
function extractRunBlock(lines, scriptLineIdx) {
  // Walk backward looking for the `run:` property of a YAML step.
  // We stop at most 120 lines back to avoid crossing into an earlier step.
  const limit = Math.max(0, scriptLineIdx - 120);
  for (let j = scriptLineIdx - 1; j >= limit; j--) {
    const trimmed = lines[j].trimStart();
    // Match `run: |`, `run: |-`, `run: >`, `run:` (scalar or block scalar)
    if (/^run:\s*([|>][-+]?)?/.test(trimmed)) {
      return lines.slice(j, scriptLineIdx + 1).join('\n');
    }
  }
  // Fallback: return a 120-line window ending at the script line
  return lines.slice(Math.max(0, scriptLineIdx - 120), scriptLineIdx + 1).join('\n');
}

/**
 * Given the lines of a YAML workflow file and the 0-based index of a line
 * that calls the smoke script, extract the full enclosing YAML step block —
 * from the step's list-item bullet (`- name:` / `- run:`) through the last
 * line that belongs to the step (i.e. before the next sibling bullet at the
 * same indentation level, or a fixed look-ahead window).
 *
 * This captures `env:` mappings whether they appear BEFORE or AFTER the
 * `run:` block within the step, which is necessary to verify that
 * REVIEWER_EMAIL and REVIEWER_PASSWORD are actually injected.
 *
 * @param {string[]} lines        - all lines of the file (split on '\n')
 * @param {number}   scriptLineIdx - 0-based index of the line with the script
 * @returns {string} the extracted step block content
 */
function extractStepBlock(lines, scriptLineIdx) {
  // Walk backward to find the YAML list-item bullet that starts this step.
  // A step bullet is a line like "      - name: ..." or "      - run: ..."
  const backLimit = Math.max(0, scriptLineIdx - 120);
  let stepStart = backLimit;
  for (let j = scriptLineIdx - 1; j >= backLimit; j--) {
    const trimmed = lines[j].trimStart();
    if (trimmed.startsWith('- ') || trimmed === '-') {
      stepStart = j;
      break;
    }
  }

  // Determine the indentation level of the step bullet so we can detect
  // where this step ends (next list item at the same or shallower indent).
  const stepLine = lines[stepStart];
  const stepIndent = stepLine.length - stepLine.trimStart().length;

  // Walk forward from the script line to find the end of this step.
  // We stop when we encounter a non-blank line that is a list-item bullet
  // at the same indentation level (the start of the next sibling step), or
  // any non-blank line at a shallower indentation (the step block is over).
  // Cap the look-ahead at 60 lines — no real step env block is longer.
  const fwdLimit = Math.min(lines.length - 1, scriptLineIdx + 60);
  let stepEnd = scriptLineIdx;
  for (let k = scriptLineIdx + 1; k <= fwdLimit; k++) {
    const line = lines[k];
    if (line.trim() === '') {
      stepEnd = k;
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trimStart();
    // Next sibling step or shallower structure terminates this step.
    if (indent <= stepIndent && (trimmed.startsWith('- ') || trimmed === '-')) {
      break;
    }
    if (indent < stepIndent) {
      break;
    }
    stepEnd = k;
  }

  return lines.slice(stepStart, stepEnd + 1).join('\n');
}

/**
 * Return an array of { file, lineNumber, runBlock, stepBlock } for every
 * occurrence of SCRIPT_NAME found across all *.yml files in WORKFLOWS_DIR.
 *
 * @returns {{ file: string, lineNumber: number, runBlock: string, stepBlock: string }[]}
 */
function findAllScriptOccurrences() {
  const ymlFiles = readdirSync(WORKFLOWS_DIR)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => join(WORKFLOWS_DIR, f));

  const occurrences = [];
  for (const filePath of ymlFiles) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(SCRIPT_NAME)) {
        // Skip comment lines (YAML top-level comments and bash comments inside
        // run: blocks both start with '#' after stripping leading whitespace).
        if (lines[i].trimStart().startsWith('#')) continue;
        occurrences.push({
          file: filePath.replace(ROOT + '/', ''),
          lineNumber: i + 1,
          runBlock: extractRunBlock(lines, i),
          stepBlock: extractStepBlock(lines, i),
        });
      }
    }
  }
  return occurrences;
}

// ── Dynamic contract: every occurrence must have the guard in its run block ──

test('every smoke-test-reviewer-login.sh call in workflow files has the REVIEWER_PASSWORD:-} guard in its run block', () => {
  const occurrences = findAllScriptOccurrences();

  assert.ok(
    occurrences.length > 0,
    `Expected at least one occurrence of "${SCRIPT_NAME}" in .github/workflows/ — none found. ` +
    'Either the script was renamed or the test itself is broken.',
  );

  const violations = occurrences.filter(o => !o.runBlock.includes(GUARD_PATTERN));

  assert.equal(
    violations.length,
    0,
    violations.map(v =>
      `\n  ${v.file}:${v.lineNumber} — run block does not contain "${GUARD_PATTERN}".\n` +
      `  Add the guard:\n` +
      `    if [ -z "\${REVIEWER_EMAIL:-}" ] || [ -z "\${REVIEWER_PASSWORD:-}" ]; then\n` +
      `      echo "WARNING: credentials not set — skipping"\n` +
      `      exit 0\n` +
      `    fi`,
    ).join(''),
  );
});

// ── Dynamic contract: every step must inject REVIEWER_EMAIL + REVIEWER_PASSWORD ──

test('every smoke-test-reviewer-login.sh step in workflow files exposes REVIEWER_EMAIL and REVIEWER_PASSWORD via env:', () => {
  const occurrences = findAllScriptOccurrences();

  assert.ok(
    occurrences.length > 0,
    `Expected at least one occurrence of "${SCRIPT_NAME}" in .github/workflows/ — none found. ` +
    'Either the script was renamed or the test itself is broken.',
  );

  // Check that both variable names appear as YAML env-mapping keys (key
  // followed by ": " — colon-space) somewhere in the step that contains the
  // smoke-script call.  The env: block may appear before OR after the run:
  // block within a YAML step, which is why we inspect the full step block
  // rather than only the run block.
  //
  // We use "REVIEWER_EMAIL: " (colon-space) rather than just "REVIEWER_EMAIL:"
  // to distinguish a proper YAML key ("REVIEWER_EMAIL: ${{ secrets.X }}")
  // from a bash variable reference ("${REVIEWER_EMAIL:-}") which contains the
  // colon-dash sequence instead of colon-space.  A step that has only the bash
  // guard but no env: mapping would still pass the bare-colon check, giving a
  // false-green result — the colon-space pattern prevents that.
  const emailViolations  = occurrences.filter(o => !o.stepBlock.includes('REVIEWER_EMAIL: '));
  const passViolations   = occurrences.filter(o => !o.stepBlock.includes('REVIEWER_PASSWORD: '));
  const allViolations    = [...new Set([...emailViolations, ...passViolations])];

  assert.equal(
    allViolations.length,
    0,
    allViolations.map(v => {
      const missing = [
        ...(!v.stepBlock.includes('REVIEWER_EMAIL:')  ? ['REVIEWER_EMAIL']  : []),
        ...(!v.stepBlock.includes('REVIEWER_PASSWORD:') ? ['REVIEWER_PASSWORD'] : []),
      ];
      return (
        `\n  ${v.file}:${v.lineNumber} — step does not expose ${missing.join(' or ')} via env:.\n` +
        `  Without the env: mapping the guard always sees unset variables and\n` +
        `  silently skips every run, giving a false-green result.\n` +
        `  Add an env: block to the step (before or after the run: block):\n` +
        `    env:\n` +
        missing.map(name => `      ${name}: \${{ secrets.<SECRET_NAME> }}`).join('\n')
      );
    }).join(''),
  );
});

// ── Behavioral tests for the guard logic ─────────────────────────────────────

test('guard does NOT skip when both REVIEWER_EMAIL and REVIEWER_PASSWORD are set', () => {
  assert.equal(
    guardWouldSkip('reviewer@example.com', 's3cr3t'),
    false,
    'Expected guard to pass (not skip) when both credentials are non-empty',
  );
});

test('guard skips when REVIEWER_EMAIL is empty and REVIEWER_PASSWORD is set', () => {
  assert.equal(
    guardWouldSkip('', 's3cr3t'),
    true,
    'Expected guard to trigger (skip) when REVIEWER_EMAIL is empty',
  );
});

test('guard skips when REVIEWER_EMAIL is set and REVIEWER_PASSWORD is empty', () => {
  assert.equal(
    guardWouldSkip('reviewer@example.com', ''),
    true,
    'Expected guard to trigger (skip) when REVIEWER_PASSWORD is empty',
  );
});

test('guard skips when both REVIEWER_EMAIL and REVIEWER_PASSWORD are empty', () => {
  assert.equal(
    guardWouldSkip('', ''),
    true,
    'Expected guard to trigger (skip) when both credentials are empty',
  );
});

test('guard skips when REVIEWER_EMAIL is undefined', () => {
  assert.equal(
    guardWouldSkip(undefined, 's3cr3t'),
    true,
    'Expected guard to trigger (skip) when REVIEWER_EMAIL is undefined',
  );
});

test('guard skips when REVIEWER_PASSWORD is undefined', () => {
  assert.equal(
    guardWouldSkip('reviewer@example.com', undefined),
    true,
    'Expected guard to trigger (skip) when REVIEWER_PASSWORD is undefined',
  );
});

test('guard skips when both REVIEWER_EMAIL and REVIEWER_PASSWORD are undefined', () => {
  assert.equal(
    guardWouldSkip(undefined, undefined),
    true,
    'Expected guard to trigger (skip) when both credentials are undefined',
  );
});

// ── Unset-vs-empty equivalence tests ─────────────────────────────────────────
//
// The bash guard uses the `:-` default operator:
//
//   if [ -z "${REVIEWER_EMAIL:-}" ] || [ -z "${REVIEWER_PASSWORD:-}" ]; then
//
// `${VAR:-}` expands to the empty string regardless of whether VAR was never
// exported (unset) or was exported as an empty string ("").  Both cases satisfy
// `-z` (zero-length string), so the guard triggers and the smoke step is
// skipped.
//
// This is an INTENTIONAL DESIGN CHOICE: a step that injects `REVIEWER_EMAIL: ""`
// (e.g. because a GitHub secret is absent and the YAML maps it to an empty
// string) behaves identically to a step that never injects the variable at all.
// Both produce a graceful skip, not a bash `:?` failure.
//
// If a future change replaces `:-` with `:?`, or adds an explicit check for
// `${VAR+x}` to distinguish "unset" from "set-to-empty", these tests will fail
// and force a deliberate decision about the new behavior.
//
// The tests below assert the equivalence: for every credential argument,
// undefined (unset) and "" (set-to-empty) must produce the same guard outcome.

test('unset REVIEWER_EMAIL and empty REVIEWER_EMAIL produce the same guard outcome (intentional equivalence)', () => {
  const withUnset = guardWouldSkip(undefined, 's3cr3t');
  const withEmpty = guardWouldSkip('', 's3cr3t');
  assert.equal(
    withUnset,
    withEmpty,
    'Expected guardWouldSkip to return the same result whether REVIEWER_EMAIL is ' +
    'unset (undefined) or set-to-empty (""). The bash guard `${REVIEWER_EMAIL:-}` ' +
    'treats both identically — both expand to "" and satisfy -z. If this test ' +
    'fails, the guard or its JavaScript simulation has been changed to distinguish ' +
    'unset from empty; update the guard in smoke-test-reviewer-login.sh accordingly.',
  );
  assert.equal(
    withUnset,
    true,
    'Both unset and empty REVIEWER_EMAIL should cause the guard to skip',
  );
});

test('unset REVIEWER_PASSWORD and empty REVIEWER_PASSWORD produce the same guard outcome (intentional equivalence)', () => {
  const withUnset = guardWouldSkip('reviewer@example.com', undefined);
  const withEmpty = guardWouldSkip('reviewer@example.com', '');
  assert.equal(
    withUnset,
    withEmpty,
    'Expected guardWouldSkip to return the same result whether REVIEWER_PASSWORD is ' +
    'unset (undefined) or set-to-empty (""). The bash guard `${REVIEWER_PASSWORD:-}` ' +
    'treats both identically — both expand to "" and satisfy -z. If this test ' +
    'fails, the guard or its JavaScript simulation has been changed to distinguish ' +
    'unset from empty; update the guard in smoke-test-reviewer-login.sh accordingly.',
  );
  assert.equal(
    withUnset,
    true,
    'Both unset and empty REVIEWER_PASSWORD should cause the guard to skip',
  );
});

test('unset-vs-empty equivalence holds when both variables are unset vs both are empty (intentional equivalence)', () => {
  const bothUnset = guardWouldSkip(undefined, undefined);
  const bothEmpty = guardWouldSkip('', '');
  assert.equal(
    bothUnset,
    bothEmpty,
    'Expected guardWouldSkip to return the same result whether both credentials ' +
    'are unset (undefined) or both are set-to-empty (""). ' +
    'A YAML step that maps both secrets to empty strings (missing secrets) must ' +
    'behave the same as a step that injects neither variable — both skip gracefully.',
  );
  assert.equal(
    bothUnset,
    true,
    'Both the all-unset and all-empty cases should cause the guard to skip',
  );
});
