#!/usr/bin/env node
/**
 * branch-protection-check-parity.test.mjs
 *
 * Asserts that three blocks are kept in sync between
 * .github/actions/assert-required-checks/action.yml (canonical definition) and
 * scripts/smoke-test-branch-protection-check.sh (the executable copy):
 *
 *   1. The CRITICAL_JOBS list — already covered since this file was first written.
 *   2. The bash 401/403 routing block — the if/elif/fi logic that decides whether
 *      a 401/403 is a hard failure (App token) or a soft warning (fork fallback).
 *   3. The Python JSON-parsing block — the heredoc that reads /tmp/bp_response.json,
 *      unions contexts + checks, and raises an error for every missing critical job.
 *
 * Guards 2 and 3 catch drift in the surrounding logic even when the CRITICAL_JOBS
 * list stays unchanged.  Without them, someone could refine the action's bash/python
 * blocks and forget to mirror the change in the smoke test, making the smoke test
 * silently exercise stale behaviour.
 *
 * Normalization rules (legitimate file-level differences that must NOT trigger drift):
 *   Bash block:
 *     - action.yml has inline # comments; smoke-test omits them.
 *     - smoke-test redirects echo/cat to >&2; action.yml does not.
 *   Python block:
 *     - action.yml is indented 8 spaces (YAML run: block); smoke-test is not.
 *     - action.yml has a comment block above CRITICAL_JOBS; smoke-test omits it.
 *   Both normalizations: strip leading/trailing whitespace, blank lines, comment lines.
 *
 * Enforcement is two-layered:
 *   1. INDEPENDENT — ci-cd.yml `web-lint` job calls this file directly with
 *      `node scripts/__tests__/branch-protection-check-parity.test.mjs`.
 *      Runs on every push/PR before merge, regardless of script-tests status.
 *   2. REDUNDANT — `npm run test:scripts` (glob `scripts/__tests__/*.test.mjs`)
 *      auto-picks up this file so it also runs inside the script-tests CI job.
 *
 * Run with: node scripts/__tests__/branch-protection-check-parity.test.mjs
 * Also invoked directly from: .github/workflows/ci-cd.yml (web-lint job)
 * Auto-picked up by: npm run test:scripts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const ACTION_PATH    = join(ROOT, '.github', 'actions', 'assert-required-checks', 'action.yml');
const SMOKE_PATH     = join(ROOT, 'scripts', 'smoke-test-branch-protection-check.sh');
const WORKFLOWS_DIR  = join(ROOT, '.github', 'workflows');

// The local action ref as it appears in step `uses:` fields.
const ASSERT_ACTION_REF = '.github/actions/assert-required-checks';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse all CRITICAL_JOBS entries from a file's text.
 *
 * Looks for a CRITICAL_JOBS = [ ... ] block and extracts every
 * ("job-id", "Display Name") tuple inside it.
 *
 * Returns an array of [jobId, displayName] pairs in source order.
 *
 * @param {string} text     - full file content
 * @param {string} filePath - used in error messages only
 * @returns {Array<[string, string]>}
 */
function parseCriticalJobs(text, filePath) {
  // Find the start of the CRITICAL_JOBS list.
  const blockStart = text.indexOf('CRITICAL_JOBS = [');
  if (blockStart === -1) {
    throw new Error(
      `[${filePath}] Could not find "CRITICAL_JOBS = [" in file.\n` +
      'Either the variable was renamed or the file is missing the expected block.',
    );
  }

  // Find the closing bracket that ends the list.
  const closingBracket = text.indexOf(']', blockStart);
  if (closingBracket === -1) {
    throw new Error(
      `[${filePath}] Found "CRITICAL_JOBS = [" but could not find the closing "]".`,
    );
  }

  const block = text.slice(blockStart, closingBracket + 1);

  // Extract each ("job-id", "Display Name") tuple.
  // The format is consistent: ("...", "...") on each line, possibly with
  // extra whitespace for alignment.
  const tupleRe = /\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  const entries = [];
  let match;
  while ((match = tupleRe.exec(block)) !== null) {
    entries.push([match[1], match[2]]);
  }

  if (entries.length === 0) {
    throw new Error(
      `[${filePath}] Parsed CRITICAL_JOBS block contains no ("...", "...") entries.\n` +
      'Verify the list format has not changed from the expected tuple style.',
    );
  }

  return entries;
}

/**
 * Extract the bash HTTP-status routing block from a file.
 *
 * The block starts at the first line containing the 401/403 condition and ends
 * just before the "python3 -" heredoc invocation.  This is the block that
 * decides whether a 401/403 response is a hard failure (GitHub App token
 * present) or a soft warning (fork / GITHUB_TOKEN fallback), plus the guard
 * for any other non-200 status.
 *
 * @param {string} text     - full file content
 * @param {string} filePath - used in error messages only
 * @returns {string} raw (un-normalised) block text
 */
function extractBashRoutingBlock(text, filePath) {
  const START_ANCHOR = 'if [ "${HTTP_STATUS}" = "401" ]';
  const END_ANCHOR   = 'python3 -';

  const startPos = text.indexOf(START_ANCHOR);
  if (startPos === -1) {
    throw new Error(
      `[${filePath}] Cannot find bash routing block start.\n` +
      `Expected anchor: ${START_ANCHOR}\n` +
      'Either the block was removed or its opening condition was reworded.',
    );
  }

  // Walk back to the beginning of the line so we capture full indentation.
  const lineStart = text.lastIndexOf('\n', startPos) + 1;

  const endPos = text.indexOf(END_ANCHOR, startPos);
  if (endPos === -1) {
    throw new Error(
      `[${filePath}] Cannot find the end of the bash routing block.\n` +
      `Expected anchor after the routing block: ${END_ANCHOR}\n` +
      'The Python heredoc invocation appears to have been moved or renamed.',
    );
  }

  // Walk back to the end of the previous line so we don't include the
  // python3 line itself.
  const lineEnd = text.lastIndexOf('\n', endPos);

  return text.slice(lineStart, lineEnd);
}

/**
 * Normalise a bash block for structural comparison.
 *
 * Strips differences that are legitimate adaptations between action.yml and
 * the smoke-test script:
 *   - Leading/trailing whitespace per line (indentation differences)
 *   - Blank lines
 *   - Comment-only lines (lines whose first non-space character is #)
 *   - Trailing " >&2" stderr redirections (smoke-test adds these; action.yml
 *     does not, because the step's output goes to the Actions log directly)
 *
 * @param {string} block
 * @returns {string} normalised block
 */
function normalizeBashBlock(block) {
  return block
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.startsWith('#'))
    .map(line => line.replace(/\s+>&2$/, ''))
    .join('\n');
}

/**
 * Extract the Python heredoc content from a file.
 *
 * Finds the first <<'PYEOF' marker and returns everything between that line
 * and the closing PYEOF line (exclusive).
 *
 * @param {string} text     - full file content
 * @param {string} filePath - used in error messages only
 * @returns {string} raw (un-normalised) heredoc content
 */
function extractPythonBlock(text, filePath) {
  const HEREDOC_START = "<<'PYEOF'";
  const HEREDOC_END_RE = /^[ \t]*PYEOF[ \t]*$/m;

  const startPos = text.indexOf(HEREDOC_START);
  if (startPos === -1) {
    throw new Error(
      `[${filePath}] Cannot find Python heredoc start marker (<<'PYEOF').\n` +
      'Either the heredoc was removed or its delimiter was renamed.',
    );
  }

  // Content begins on the line after the <<'PYEOF' marker.
  const contentStart = text.indexOf('\n', startPos) + 1;

  const remaining    = text.slice(contentStart);
  const endMatch     = HEREDOC_END_RE.exec(remaining);
  if (!endMatch) {
    throw new Error(
      `[${filePath}] Found <<'PYEOF' but cannot find the closing PYEOF line.\n` +
      'The heredoc appears to be unterminated.',
    );
  }

  return remaining.slice(0, endMatch.index);
}

/**
 * Normalise a Python heredoc block for structural comparison.
 *
 * Strips differences that are legitimate adaptations between action.yml and
 * the smoke-test script, while PRESERVING relative indentation (which is
 * semantically meaningful in Python):
 *
 *   1. Strip trailing whitespace from every line.
 *   2. Remove blank lines and comment-only lines (they don't carry logic).
 *   3. Compute the common leading-whitespace prefix across the remaining
 *      non-trivial lines (the minimum indent level — this is the file-level
 *      wrapper indent that differs between the YAML run: block and the
 *      plain bash script).
 *   4. Slice exactly that many characters from the start of every line.
 *
 * This is equivalent to Python's textwrap.dedent(): it removes the uniform
 * file-level indent (8 spaces in action.yml's YAML block vs. 0 in the
 * smoke-test) without collapsing the relative indentation that distinguishes
 * loop bodies, if-branches, and similar Python constructs.
 *
 * Important: do NOT use per-line trimStart() here — that would erase all
 * indentation and allow semantically different Python (e.g. a dedented
 * sys.exit(1)) to compare equal.
 *
 * @param {string} block
 * @returns {string} normalised block
 */
function normalizePythonBlock(block) {
  const lines = block
    .split('\n')
    .map(line => line.trimEnd());

  // Determine the common leading-whitespace level using only non-trivial lines
  // (non-blank, non-comment), so blank/comment lines don't influence the dedent.
  const nonTrivialLines = lines.filter(line => {
    const trimmed = line.trimStart();
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });

  if (nonTrivialLines.length === 0) return '';

  const commonIndent = nonTrivialLines.reduce((min, line) => {
    const indent = line.match(/^(\s*)/)[1].length;
    return Math.min(min, indent);
  }, Infinity);

  // Dedent by the common indent, then drop blank and comment-only lines.
  return lines
    .map(line => line.slice(commonIndent))
    .filter(line => {
      const trimmed = line.trimStart();
      return trimmed.length > 0 && !trimmed.startsWith('#');
    })
    .join('\n');
}

/**
 * Parse the bash routing block and return an array of "hard-exit-1 status groups".
 *
 * Each group is a Set of HTTP status code strings that share the same if/elif
 * branch in the routing block AND whose branch body contains at least one
 * `exit 1` statement (at any nesting depth — including inside a nested
 * APP_TOKEN_AVAILABLE guard).
 *
 * Only branches that test HTTP_STATUS by strict equality (= "NNN") are
 * included.  The generic `!= "200"` catch-all is intentionally excluded: it
 * doesn't name a distinct status code and cannot be mapped to a single TC
 * fixture.
 *
 * If action.yml adds a NEW dedicated branch — e.g.
 *   elif [ "${HTTP_STATUS}" = "404" ]; then … exit 1 … fi
 * — this function returns an additional group {404}, causing the coverage
 * assertion to fail unless a matching TC is added to the smoke-test.
 *
 * @param {string} routingBlock - raw text of the bash routing block
 * @returns {Array<Set<string>>} array of status-code Sets, one per branch
 */
function parseExit1StatusGroups(routingBlock) {
  const lines = routingBlock.split('\n');
  const groups = [];

  let inBranch = false;
  let branchStatuses = [];
  let branchHasExit1 = false;
  let depth = 0;

  // Matches the literal status codes in the CONDITION of an if/elif line.
  // Only "= "NNN"" (strict equality) — NOT "!= "NNN"".
  const HAS_EQUALITY_CHECK_RE = /\$\{HTTP_STATUS\}"?\s+(?!=!)=\s*"(\d{3})"|"\$\{HTTP_STATUS\}"\s+(?!=!)=\s*"(\d{3})"/;
  const STATUS_LITERAL_RE = /"(\d{3})"/g;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;

    const isIfOrElif = /^(if|elif)\s/.test(trimmed);

    if (isIfOrElif && HAS_EQUALITY_CHECK_RE.test(trimmed) && depth === 0) {
      // Entering a new if/elif branch that checks HTTP_STATUS by equality.
      // Save any previously collected branch first.
      if (branchStatuses.length > 0 && branchHasExit1) {
        groups.push(new Set(branchStatuses));
      }
      branchStatuses = [];
      branchHasExit1 = false;
      inBranch = true;
      depth = 0;

      // Extract all 3-digit quoted literals from the condition line.
      // These are the explicit HTTP status codes this branch handles.
      let m;
      STATUS_LITERAL_RE.lastIndex = 0;
      while ((m = STATUS_LITERAL_RE.exec(trimmed)) !== null) {
        branchStatuses.push(m[1]);
      }
    } else if (inBranch) {
      // Track nesting so inner `if … fi` blocks don't prematurely close the branch.
      if (/^if\s/.test(trimmed)) {
        depth++;
      } else if (/^fi\b/.test(trimmed)) {
        if (depth > 0) {
          depth--;
        } else {
          // Closing fi for our outer branch — commit what we've collected.
          if (branchStatuses.length > 0 && branchHasExit1) {
            groups.push(new Set(branchStatuses));
          }
          branchStatuses = [];
          branchHasExit1 = false;
          inBranch = false;
        }
      }

      if (/\bexit\s+1\b/.test(trimmed)) {
        branchHasExit1 = true;
      }
    }
  }

  // Handle a branch not terminated by fi (shouldn't happen in valid bash,
  // but avoids silently dropping it if the block is truncated).
  if (branchStatuses.length > 0 && branchHasExit1) {
    groups.push(new Set(branchStatuses));
  }

  return groups;
}

/**
 * Parse TC invocation triplets from the smoke-test script.
 *
 * Each triplet is three consecutive lines of the form:
 *   run_check "STATUS" "APP_TOKEN_AVAILABLE" ...
 *   LABEL_EXIT=$?
 *   assert_exit "LABEL" EXPECTED_EXIT "$LABEL_EXIT"
 *
 * Returns an array of objects with the HTTP status code string, a boolean
 * for APP_TOKEN_AVAILABLE, and the expected exit code integer.
 *
 * @param {string} text - full text of the smoke-test script
 * @returns {Array<{httpStatus: string, appTokenAvailable: boolean, expectedExit: number}>}
 */
function parseTCCoverage(text) {
  // Match the three-line TC invocation block.
  // The lines must be consecutive: run_check then $? capture then assert_exit.
  const TC_RE =
    /run_check\s+"(\d+)"\s+"(true|false)"[^\n]*\n[^\n]*=\$\?[^\n]*\nassert_exit\s+"\w+"\s+(\d+)/gm;

  const cases = [];
  let m;
  while ((m = TC_RE.exec(text)) !== null) {
    cases.push({
      httpStatus:        m[1],
      appTokenAvailable: m[2] === 'true',
      expectedExit:      parseInt(m[3], 10),
    });
  }
  return cases;
}

/**
 * Scan all `.github/workflows/*.yml` files and return every job that includes
 * a step with `uses: ./.github/actions/assert-required-checks`.
 *
 * A job self-identifies as a required gate by calling this composite action.
 * Jobs that do so MUST be listed in CRITICAL_JOBS in action.yml so the
 * runtime branch-protection verifier knows to assert their presence in the
 * required-status-checks list.
 *
 * Parsing strategy (string-based, no YAML library):
 *   1. Find the `jobs:` top-level key.
 *   2. Walk subsequent lines, collecting job IDs from keys at exactly 2-space
 *      indentation (`/^  ([\w-]+):\s*(?:#.*)?$/`).
 *   3. Collect every line that belongs to the current job (until the next
 *      2-space-indented key or end of file).
 *   4. If any collected line contains ASSERT_ACTION_REF, emit the job ID.
 *
 * @param {string} workflowsDir - absolute path to `.github/workflows/`
 * @returns {Array<{file: string, jobId: string}>}
 */
function parseWorkflowGateJobs(workflowsDir) {
  let filenames;
  try {
    filenames = readdirSync(workflowsDir).filter(
      f => f.endsWith('.yml') || f.endsWith('.yaml'),
    );
  } catch {
    return [];
  }

  const JOB_KEY_RE = /^  ([\w-]+):\s*(?:#.*)?$/;
  const gateJobs   = [];

  for (const filename of filenames) {
    const filePath = join(workflowsDir, filename);
    const text     = readFileSync(filePath, 'utf8');
    const lines    = text.split('\n');

    // Locate the `jobs:` section.
    const jobsSectionIdx = lines.findIndex(l => /^jobs:\s*$/.test(l));
    if (jobsSectionIdx === -1) continue; // not a workflow file

    let currentJobId    = null;
    let currentJobLines = [];

    /**
     * Flush the accumulated job body: if the job body contains a step that
     * calls ASSERT_ACTION_REF, record the job ID.
     */
    function flushJob() {
      if (
        currentJobId !== null &&
        currentJobLines.some(l => {
          // Skip YAML comment lines — the action path may appear in inline
          // comments (e.g. documentation blocks) inside a job body without
          // actually being called.  Only count non-comment lines that contain
          // the ASSERT_ACTION_REF so we don't false-positive on comment text.
          const trimmed = l.trimStart();
          return !trimmed.startsWith('#') && l.includes(ASSERT_ACTION_REF);
        })
      ) {
        gateJobs.push({ file: filename, jobId: currentJobId });
      }
    }

    for (let i = jobsSectionIdx + 1; i < lines.length; i++) {
      const line     = lines[i];
      const jobMatch = JOB_KEY_RE.exec(line);

      if (jobMatch) {
        flushJob();
        currentJobId    = jobMatch[1];
        currentJobLines = [];
      } else if (currentJobId !== null) {
        currentJobLines.push(line);
      }
    }

    // Handle the last job in the file.
    flushJob();
  }

  return gateJobs;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('action.yml and smoke-test script both exist on disk', () => {
  assert.ok(
    existsSync(ACTION_PATH),
    `${ACTION_PATH} does not exist.\n` +
    'The canonical CRITICAL_JOBS source file for the branch-protection check is missing.',
  );
  assert.ok(
    existsSync(SMOKE_PATH),
    `${SMOKE_PATH} does not exist.\n` +
    'The smoke-test script that verifies branch-protection check behaviour is missing.',
  );
});

test('CRITICAL_JOBS entries match between action.yml and smoke-test script', () => {
  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const smokeText  = readFileSync(SMOKE_PATH, 'utf8');

  const actionJobs = parseCriticalJobs(actionText, ACTION_PATH);
  const smokeJobs  = parseCriticalJobs(smokeText,  SMOKE_PATH);

  // Compare serialised forms so the assertion message shows the full diff.
  const actionSerialized = JSON.stringify(actionJobs, null, 2);
  const smokeSerialized  = JSON.stringify(smokeJobs,  null, 2);

  assert.strictEqual(
    smokeSerialized,
    actionSerialized,
    'CRITICAL_JOBS diverged between the two files.\n\n' +
    `Canonical source (${ACTION_PATH}):\n${actionSerialized}\n\n` +
    `Smoke-test copy  (${SMOKE_PATH}):\n${smokeSerialized}\n\n` +
    'Fix: update the smoke-test script so its CRITICAL_JOBS list is an exact\n' +
    'verbatim copy of the list in action.yml (same entries, same order).',
  );
});

test('CRITICAL_JOBS entries are individually valid (non-empty job-id and display name)', () => {
  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const actionJobs = parseCriticalJobs(actionText, ACTION_PATH);

  for (const [jobId, displayName] of actionJobs) {
    assert.ok(
      jobId.trim().length > 0,
      `action.yml CRITICAL_JOBS contains an entry with an empty job-id: ("${jobId}", "${displayName}")`,
    );
    assert.ok(
      displayName.trim().length > 0,
      `action.yml CRITICAL_JOBS contains an entry with an empty display name: ("${jobId}", "${displayName}")`,
    );
  }
});

test('bash 401/403 routing block matches between action.yml and smoke-test script', () => {
  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const smokeText  = readFileSync(SMOKE_PATH, 'utf8');

  const actionBlock = extractBashRoutingBlock(actionText, ACTION_PATH);
  const smokeBlock  = extractBashRoutingBlock(smokeText,  SMOKE_PATH);

  const actionNorm = normalizeBashBlock(actionBlock);
  const smokeNorm  = normalizeBashBlock(smokeBlock);

  assert.strictEqual(
    smokeNorm,
    actionNorm,
    'The bash HTTP-status routing block (401/403 hard-fail vs. soft-warn logic) ' +
    'has diverged between the two files.\n\n' +
    'This block controls whether a 401/403 response causes a hard exit 1 (when a\n' +
    'GitHub App token is present) or a soft exit 0 warning (fork / GITHUB_TOKEN\n' +
    'fallback).  The smoke-test script must exercise exactly the same decision\n' +
    'tree as the action, or its test cases will validate stale behaviour.\n\n' +
    `Canonical source (${ACTION_PATH}) normalised:\n${actionNorm}\n\n` +
    `Smoke-test copy  (${SMOKE_PATH}) normalised:\n${smokeNorm}\n\n` +
    'Fix: update the smoke-test script\'s bash routing block to match action.yml.\n' +
    'Legitimate differences that are intentionally stripped before comparison:\n' +
    '  - Inline # comments (action.yml has them; smoke-test may omit them)\n' +
    '  - Trailing >&2 redirections (smoke-test uses these; action.yml does not)',
  );
});

test('Python JSON-parsing block matches between action.yml and smoke-test script', () => {
  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const smokeText  = readFileSync(SMOKE_PATH, 'utf8');

  const actionBlock = extractPythonBlock(actionText, ACTION_PATH);
  const smokeBlock  = extractPythonBlock(smokeText,  SMOKE_PATH);

  const actionNorm = normalizePythonBlock(actionBlock);
  const smokeNorm  = normalizePythonBlock(smokeBlock);

  assert.strictEqual(
    smokeNorm,
    actionNorm,
    'The Python JSON-parsing heredoc has diverged between the two files.\n\n' +
    'This block reads /tmp/bp_response.json, unions the "contexts" and "checks"\n' +
    'arrays into a single set, then asserts that every CRITICAL_JOBS entry\n' +
    'appears in that set.  The smoke-test script must contain an identical copy\n' +
    'so that its TC3/TC4 test cases reproduce the real CI behaviour faithfully.\n\n' +
    `Canonical source (${ACTION_PATH}) normalised:\n${actionNorm}\n\n` +
    `Smoke-test copy  (${SMOKE_PATH}) normalised:\n${smokeNorm}\n\n` +
    'Fix: update the smoke-test script\'s Python heredoc to match action.yml.\n' +
    'Legitimate differences that are intentionally stripped before comparison:\n' +
    '  - Leading indentation (action.yml indents 8 spaces inside the YAML run: block)\n' +
    '  - Inline # comments (action.yml has an explanatory comment above CRITICAL_JOBS)',
  );
});

// Exercise the same extraction and normalization used by the live comparisons.
// Mutate each source independently: otherwise a checker that erases a changed
// statement could pass the live comparison while providing false confidence.
for (const sourcePath of [ACTION_PATH, SMOKE_PATH]) {
  const source = readFileSync(sourcePath, 'utf8');
  const sourceName = sourcePath === ACTION_PATH ? 'action' : 'smoke test';

  for (const [label, extract, normalize, before, after] of [
    ['hard-failure exit', extractBashRoutingBlock, normalizeBashBlock, 'exit 1', 'exit 0'],
    ['fallback exit', extractBashRoutingBlock, normalizeBashBlock, 'exit 0', 'exit 1'],
    ['Python failure exit', extractPythonBlock, normalizePythonBlock, 'sys.exit(1)', 'sys.exit(0)'],
    ['Python context union', extractPythonBlock, normalizePythonBlock, 'flat | structured', 'flat'],
  ]) {
    test(`parity detects changed ${label} in ${sourceName}`, () => {
      const original = extract(source, sourcePath);
      assert.ok(original.includes(before), `Mutation target missing: ${before}`);
      const changed = original.replace(before, after);
      assert.notStrictEqual(
        normalize(changed),
        normalize(original),
        `Parity normalization erased a change to ${label} in ${sourceName}`,
      );
    });
  }

  for (const [label, extract, anchor] of [
    ['Bash routing', extractBashRoutingBlock, 'if [ "${HTTP_STATUS}" = "401" ]'],
    ['Python opening delimiter', extractPythonBlock, "<<'PYEOF'"],
    ['Python closing delimiter', extractPythonBlock, '\n' + (sourceName === 'action' ? '        ' : '') + 'PYEOF'],
  ]) {
    test(`parity fails closed on missing ${label} in ${sourceName}`, () => {
      assert.ok(source.includes(anchor), `Mutation target missing: ${anchor}`);
      const changed = source.replace(anchor, 'REMOVED_BLOCK_ANCHOR');
      assert.throws(
        () => extract(changed, sourcePath),
        /Cannot find|cannot find/,
        `Missing ${label} must fail extraction rather than compare empty blocks`,
      );
    });
  }
}

test('parseExit1StatusGroups correctly identifies hard-exit-1 branches (unit test)', () => {
  // A synthetic routing block that mirrors the real action.yml structure.
  // This test documents expected parser behaviour and guards against regressions
  // in parseExit1StatusGroups independent of the live files.
  const sampleBlock = [
    'if [ "${HTTP_STATUS}" = "401" ] || [ "${HTTP_STATUS}" = "403" ]; then',
    '  if [ "${APP_TOKEN_AVAILABLE}" = "true" ]; then',
    '    echo "hard fail"',
    '    exit 1',
    '  fi',
    '  echo "soft warn"',
    '  exit 0',
    'fi',
    '',
    'if [ "${HTTP_STATUS}" != "200" ]; then',
    '  echo "unexpected"',
    '  exit 1',
    'fi',
  ].join('\n');

  const groups = parseExit1StatusGroups(sampleBlock);

  // Only the 401||403 equality branch should be detected.
  // The != "200" catch-all intentionally produces no group (no distinct status).
  assert.strictEqual(
    groups.length,
    1,
    'parseExit1StatusGroups should return exactly one group for the sample block\n' +
    '(the 401||403 equality branch).  The != "200" catch-all must NOT produce a\n' +
    'group because it names no distinct HTTP status code.\n\n' +
    `Got ${groups.length} group(s): ${groups.map(g => '[' + [...g].join(', ') + ']').join(' | ')}`,
  );

  const group = groups[0];
  assert.ok(
    group.has('401'),
    `Group should contain "401"; got: [${[...group].join(', ')}]`,
  );
  assert.ok(
    group.has('403'),
    `Group should contain "403"; got: [${[...group].join(', ')}]`,
  );
  assert.strictEqual(
    group.size,
    2,
    `Group should have exactly 2 members (401, 403); got ${group.size}: [${[...group].join(', ')}]`,
  );

  // A block with an additional dedicated 404 branch must produce a second group.
  const blockWith404 = [
    'if [ "${HTTP_STATUS}" = "401" ] || [ "${HTTP_STATUS}" = "403" ]; then',
    '  exit 1',
    'fi',
    'if [ "${HTTP_STATUS}" = "404" ]; then',
    '  exit 1',
    'fi',
  ].join('\n');

  const groupsWith404 = parseExit1StatusGroups(blockWith404);
  assert.strictEqual(
    groupsWith404.length,
    2,
    'A routing block with a separate 404 branch should produce two groups.\n' +
    `Got ${groupsWith404.length} group(s): ${groupsWith404.map(g => '[' + [...g].join(', ') + ']').join(' | ')}`,
  );
  assert.ok(
    groupsWith404.some(g => g.has('404')),
    'The second group should contain "404".\n' +
    `Groups found: ${groupsWith404.map(g => '[' + [...g].join(', ') + ']').join(' | ')}`,
  );

  // A branch that only exits 0 must NOT produce a group.
  const blockExitZeroOnly = [
    'if [ "${HTTP_STATUS}" = "202" ]; then',
    '  echo "accepted"',
    '  exit 0',
    'fi',
  ].join('\n');

  const groupsExitZero = parseExit1StatusGroups(blockExitZeroOnly);
  assert.strictEqual(
    groupsExitZero.length,
    0,
    'A branch that only runs exit 0 must NOT appear in the exit-1 groups.\n' +
    `Got ${groupsExitZero.length} group(s): ${groupsExitZero.map(g => '[' + [...g].join(', ') + ']').join(' | ')}`,
  );
});

test('parseWorkflowGateJobs unit test — detects gate jobs correctly', () => {
  // Keep this fixture independent of live workflow formatting so a change to
  // the parser's job-indentation rule cannot silently return zero gate jobs.
  const sampleWorkflow = [
    'name: Synthetic gate workflow',
    'on: push',
    'jobs:',
    '  gate-job:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: ./.github/actions/assert-required-checks',
    '  comment-only-job:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      # - uses: ./.github/actions/assert-required-checks',
    '      - run: echo "No gate action called"',
    '  unrelated-job:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - run: echo "Unrelated job"',
  ].join('\n');

  const workflowsDir = mkdtempSync(join(tmpdir(), 'workflow-gate-parser-'));
  try {
    writeFileSync(join(workflowsDir, 'synthetic.yml'), sampleWorkflow);
    const gateJobs = parseWorkflowGateJobs(workflowsDir);

    assert.ok(
      gateJobs.some(job => job.jobId === 'gate-job'),
      'The job that calls assert-required-checks must be detected.',
    );
    assert.ok(
      !gateJobs.some(job => job.jobId === 'comment-only-job'),
      'A comment-only action reference must not identify a gate job.',
    );
    assert.ok(
      !gateJobs.some(job => job.jobId === 'unrelated-job'),
      'A job with no action reference must not identify a gate job.',
    );
    assert.deepStrictEqual(gateJobs, [
      { file: 'synthetic.yml', jobId: 'gate-job' },
    ]);
  } finally {
    rmSync(workflowsDir, { recursive: true, force: true });
  }
});

test('smoke-test TC cases cover every hard-exit-1 HTTP status group in the action routing block', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // The bash routing block in action.yml can acquire new dedicated HTTP status
  // branches (e.g. elif "404" → exit 1).  When that happens the structural
  // parity test (above) ensures the smoke-test's bash block is updated in
  // lockstep.  But no existing test checks whether the smoke-test *also* grows
  // a TC fixture that actually exercises that new path.
  //
  // This test closes that gap: it derives the set of explicit "hard exit 1"
  // HTTP status groups from action.yml and asserts that the smoke-test has at
  // least one run_check invocation per group whose associated assert_exit
  // expects exit 1.
  //
  // A group is a set of status codes that share one if/elif branch in the
  // routing block (e.g. {401, 403}).  The group is considered "covered" if ANY
  // one of its codes appears in a TC case that expects exit 1 — the entire
  // group need not be tested individually.
  //
  // The catch-all `!= "200"` branch is not checked here because it names no
  // distinct status code and is already covered by the structural parity test.
  // ──────────────────────────────────────────────────────────────────────────

  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const smokeText  = readFileSync(SMOKE_PATH,  'utf8');

  const actionBlock  = extractBashRoutingBlock(actionText, ACTION_PATH);
  const exit1Groups  = parseExit1StatusGroups(actionBlock);
  const tcCases      = parseTCCoverage(smokeText);

  // Guard against parser failures silently producing zero groups.
  assert.ok(
    exit1Groups.length > 0,
    'parseExit1StatusGroups returned no groups from the action.yml routing block.\n\n' +
    'Either the routing block no longer contains any if/elif branch with an\n' +
    'explicit HTTP status equality check followed by exit 1, or the parser\n' +
    'needs to be updated to match the new block structure.\n\n' +
    `Routing block extracted:\n${actionBlock}`,
  );

  // Guard against parseTCCoverage failing to find any TC invocations.
  assert.ok(
    tcCases.length > 0,
    'parseTCCoverage found no TC invocations in the smoke-test script.\n\n' +
    'Expected consecutive triplets of the form:\n' +
    '  run_check "STATUS" "APP_TOKEN" ...\n' +
    '  LABEL_EXIT=$?\n' +
    '  assert_exit "LABEL" EXPECTED_EXIT "$LABEL_EXIT"\n\n' +
    `If the smoke-test format changed, update parseTCCoverage() in this test file.`,
  );

  const tcSummary = tcCases
    .map((tc, i) =>
      `  TC${i + 1}: HTTP ${tc.httpStatus}, ` +
      `APP_TOKEN_AVAILABLE=${tc.appTokenAvailable}, ` +
      `expected exit ${tc.expectedExit}`,
    )
    .join('\n');

  for (const group of exit1Groups) {
    const statuses = [...group].sort();
    const covered  = tcCases.some(tc => group.has(tc.httpStatus) && tc.expectedExit === 1);

    assert.ok(
      covered,
      'Missing TC coverage for a hard-exit-1 HTTP status group.\n\n' +
      `The action.yml routing block has a dedicated if/elif branch for HTTP ` +
      `status code(s) [${statuses.join(', ')}] that produces exit 1, but the ` +
      `smoke-test script has no TC invocation that:\n` +
      `  (a) calls run_check with one of [${statuses.join(', ')}], AND\n` +
      `  (b) asserts exit 1 via assert_exit.\n\n` +
      `Fix: add a TC case to scripts/smoke-test-branch-protection-check.sh:\n` +
      `  echo "TCN: HTTP ${statuses[0]} + APP_TOKEN_AVAILABLE=true (new hard-fail path)"\n` +
      `  run_check "${statuses[0]}" "true" "$JSON_ERROR"\n` +
      `  TCN_EXIT=$?\n` +
      `  assert_exit "TCN" 1 "$TCN_EXIT"\n\n` +
      `Current TC cases in the smoke-test:\n${tcSummary}`,
    );
  }
});

test('smoke-test has at least one TC exercising the catch-all non-200 error path', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // The bash routing block in action.yml has two exit-1 paths:
  //   1. Explicit equality branches:  if [ "${HTTP_STATUS}" = "401" ] || …
  //   2. Catch-all inequality branch: if [ "${HTTP_STATUS}" != "200" ]; then … exit 1
  //
  // The TC-coverage test above guards path (1) — it demands a run_check fixture
  // for every explicit equality group.  But it intentionally excludes path (2)
  // because the catch-all names no distinct status code.
  //
  // This test guards path (2): it verifies that:
  //   (a) The `!= "200"` catch-all branch (with exit 1) is present in action.yml —
  //       so we notice if it is accidentally deleted.
  //   (b) The smoke-test has at least one TC whose HTTP status is neither "200" nor
  //       any of the explicitly-tested equality codes, AND that TC expects exit 1.
  //       This proves the catch-all path is actually exercised, not just declared.
  // ──────────────────────────────────────────────────────────────────────────

  const actionText = readFileSync(ACTION_PATH, 'utf8');
  const smokeText  = readFileSync(SMOKE_PATH,  'utf8');

  // ── (a) The catch-all branch must exist in the action routing block ────────
  const actionBlock = extractBashRoutingBlock(actionText, ACTION_PATH);

  // We accept both `!= "200"` and `!= '200'` (quote style flexibility).
  const CATCHALL_RE = /\$\{HTTP_STATUS\}"?\s+!=\s*["']200["']/;
  assert.ok(
    CATCHALL_RE.test(actionBlock),
    'The `!= "200"` catch-all branch is missing from the action.yml bash routing block.\n\n' +
    'The routing block should contain a guard of the form:\n' +
    '  if [ "${HTTP_STATUS}" != "200" ]; then\n' +
    '    … exit 1\n' +
    '  fi\n\n' +
    'This catch-all ensures any unexpected non-200 response (e.g. HTTP 500, 422, 429)\n' +
    'causes a hard failure instead of silently proceeding to the Python check.\n\n' +
    `Routing block extracted from ${ACTION_PATH}:\n${actionBlock}`,
  );

  // Also verify the catch-all branch body contains exit 1.
  // Extract the block from the catch-all condition to the next `fi`.
  const catchallStart = actionBlock.search(CATCHALL_RE);
  const blockAfterCatchall = actionBlock.slice(catchallStart);
  const fiIndex = blockAfterCatchall.search(/\bfi\b/);
  const catchallBody = fiIndex !== -1 ? blockAfterCatchall.slice(0, fiIndex) : blockAfterCatchall;
  assert.ok(
    /\bexit\s+1\b/.test(catchallBody),
    'The catch-all `!= "200"` branch in action.yml does not contain `exit 1`.\n\n' +
    'The branch must hard-fail on any unexpected non-200 status.\n\n' +
    `Catch-all branch body extracted:\n${catchallBody}`,
  );

  // ── (b) The smoke-test must have a TC that hits the catch-all path ─────────

  // Collect all status codes covered by explicit equality groups so we can
  // distinguish them from a genuine catch-all TC.
  const exit1Groups   = parseExit1StatusGroups(actionBlock);
  const explicitCodes = new Set(exit1Groups.flatMap(g => [...g]));
  // "200" is the happy path — also exclude it from the catch-all TC check.
  explicitCodes.add('200');

  const tcCases = parseTCCoverage(smokeText);

  const catchallTCs = tcCases.filter(
    tc => !explicitCodes.has(tc.httpStatus) && tc.expectedExit === 1,
  );

  const tcSummary = tcCases
    .map((tc, i) =>
      `  TC${i + 1}: HTTP ${tc.httpStatus}, ` +
      `APP_TOKEN_AVAILABLE=${tc.appTokenAvailable}, ` +
      `expected exit ${tc.expectedExit}`,
    )
    .join('\n');

  assert.ok(
    catchallTCs.length > 0,
    'The smoke-test has no TC that exercises the catch-all `!= "200"` error path.\n\n' +
    'The catch-all branch in action.yml hard-fails (exit 1) on any unexpected\n' +
    'HTTP status that is not 200, 401, or 403 (e.g. 500, 422, 429).  Without a\n' +
    'TC that covers this path, the branch could be accidentally deleted or broken\n' +
    'and no CI gate would notice.\n\n' +
    `Explicit equality groups already covered: [${[...explicitCodes].join(', ')}]\n\n` +
    'Fix: add a TC to scripts/smoke-test-branch-protection-check.sh using a\n' +
    'status code not in the explicit groups (e.g. 500) that expects exit 1:\n' +
    '  echo "TC5: HTTP 500 + APP_TOKEN_AVAILABLE=true  (catch-all non-200)"\n' +
    '  echo "       Expected: exit 1 (hard fail — any non-200 other than 401/403)"\n' +
    '  run_check "500" "true" "$JSON_ERROR"\n' +
    '  TC5_EXIT=$?\n' +
    '  assert_exit "TC5" 1 "$TC5_EXIT"\n\n' +
    `Current TC cases in the smoke-test:\n${tcSummary}`,
  );
});

test('smoke-test bash routing block contains the catch-all != "200" branch with exit 1', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // action.yml is the canonical source; its catch-all branch is verified by the
  // "smoke-test has at least one TC exercising the catch-all" test above.
  //
  // But the smoke-test also contains a *verbatim copy* of the bash routing block
  // inside run_check().  If someone deletes `exit 1` from the catch-all body in
  // that copy without touching the surrounding condition line, the structural
  // parity test might not catch the gap — the condition stays textually
  // identical, and the parity normalizer strips blank lines and comments but
  // does not independently assert what each branch's body must contain.
  //
  // This test adds an explicit, direct assertion: it extracts the bash routing
  // block from the *smoke-test script* (not action.yml) and verifies that:
  //   (a) the `!= "200"` catch-all condition is present in the copy, AND
  //   (b) the body of that branch contains `exit 1`.
  //
  // Without this guard, removing exit 1 from only the smoke-test copy would
  // cause TC5 (HTTP 500) to pass vacuously: the subshell falls through to the
  // Python block, which succeeds because the JSON_ERROR fixture is valid JSON
  // that contains no missing critical jobs.
  // ──────────────────────────────────────────────────────────────────────────

  const smokeText = readFileSync(SMOKE_PATH, 'utf8');

  const smokeBlock = extractBashRoutingBlock(smokeText, SMOKE_PATH);

  // (a) The `!= "200"` catch-all condition must be present in the smoke-test's
  // routing block (the verbatim copy inside run_check()).
  const CATCHALL_RE = /\$\{HTTP_STATUS\}"?\s+!=\s*["']200["']/;
  assert.ok(
    CATCHALL_RE.test(smokeBlock),
    'The `!= "200"` catch-all branch is missing from the smoke-test\'s bash\n' +
    'routing block (the verbatim copy inside run_check()).\n\n' +
    'The copy must include the guard:\n' +
    '  if [ "${HTTP_STATUS}" != "200" ]; then\n' +
    '    … exit 1\n' +
    '  fi\n\n' +
    'Without this guard, TC5 (HTTP 500) will pass vacuously — the subshell\n' +
    'falls through to the Python block, which succeeds because the JSON_ERROR\n' +
    'fixture is valid JSON containing no missing critical jobs.\n\n' +
    `Routing block extracted from ${SMOKE_PATH}:\n${smokeBlock}`,
  );

  // (b) The catch-all body must contain `exit 1`.
  // Extract the slice from the catch-all condition to the closing `fi`.
  const catchallStart = smokeBlock.search(CATCHALL_RE);
  const blockAfterCatchall = smokeBlock.slice(catchallStart);
  const fiIndex = blockAfterCatchall.search(/\bfi\b/);
  const catchallBody = fiIndex !== -1 ? blockAfterCatchall.slice(0, fiIndex) : blockAfterCatchall;

  assert.ok(
    /\bexit\s+1\b/.test(catchallBody),
    'The catch-all `!= "200"` branch in the smoke-test\'s bash routing block\n' +
    'does not contain `exit 1`.\n\n' +
    'The verbatim copy inside run_check() must hard-fail (exit 1) on any\n' +
    'unexpected non-200 status, matching the action.yml behaviour.\n\n' +
    'If exit 1 is absent or replaced by exit 0, TC5 (HTTP 500) will pass\n' +
    'vacuously: the subshell falls through to the Python block, which succeeds\n' +
    'because the JSON_ERROR fixture is valid JSON with no missing critical jobs.\n\n' +
    `Catch-all branch body extracted from the smoke-test:\n${catchallBody}`,
  );
});

test('normalizePythonBlock preserves relative indentation (detects dedent-induced logic drift)', () => {
  // Simulate the action.yml version (8-space file-level indent, correct structure).
  // sys.exit(1) is correctly inside the "if missing:" body at relative indent +4.
  const correctBlock = [
    '        if missing:',
    '            for job_id, display_name in missing:',
    '                print(job_id)',
    '            sys.exit(1)',
    '        print("OK: all gates present.")',
  ].join('\n');

  // Simulate a drifted smoke-test version where sys.exit(1) was accidentally
  // dedented one level — now outside the if-block so it ALWAYS runs, regardless
  // of whether any jobs are missing.  This is a semantic change that must be caught.
  const driftedBlock = [
    'if missing:',
    '    for job_id, display_name in missing:',
    '        print(job_id)',
    'sys.exit(1)',          // ← accidentally moved outside the if body
    'print("OK: all gates present.")',
  ].join('\n');

  const correctNorm = normalizePythonBlock(correctBlock);
  const driftedNorm = normalizePythonBlock(driftedBlock);

  // The two normalised forms MUST differ.  If they were equal it would mean the
  // normalizer is erasing Python-significant indentation and cannot guard against
  // logic drift such as a misplaced sys.exit(1).
  assert.notStrictEqual(
    driftedNorm,
    correctNorm,
    'normalizePythonBlock failed to detect a dedent-induced semantic change.\n\n' +
    'A sys.exit(1) that was moved outside its enclosing if-block compared equal\n' +
    'to the correctly-indented version.  This means the normalizer is stripping\n' +
    'too much leading whitespace (e.g. per-line trimStart()) and cannot guard\n' +
    'against Python logic drift where relative indentation changes behaviour.\n\n' +
    `Correct normalised:\n${correctNorm}\n\n` +
    `Drifted normalised:\n${driftedNorm}`,
  );
});

// ── Workflow gate jobs ↔ CRITICAL_JOBS parity ─────────────────────────────────
//
// These two tests form a bidirectional gate between the YAML workflow files and
// the CRITICAL_JOBS list in action.yml:
//
//   Test A (workflow → CRITICAL_JOBS): every job in .github/workflows/*.yml that
//   calls assert-required-checks MUST be listed in CRITICAL_JOBS.  A developer
//   who adds the composite action to a new gate job but forgets to register it
//   in CRITICAL_JOBS creates a gap: the job runs but is never checked at runtime.
//
//   Test B (CRITICAL_JOBS → workflow): every CRITICAL_JOBS entry MUST correspond
//   to at least one workflow job that calls assert-required-checks.  A stale
//   entry (job renamed or removed from the workflow without updating CRITICAL_JOBS)
//   means the runtime verifier checks for a job name that no longer exists,
//   giving a permanently false "OK".
//
// Together the two tests prevent either direction of drift from going undetected.

test('parseWorkflowGateJobs finds at least one gate job in .github/workflows/', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // A pre-condition for both parity tests below: the parser must locate at
  // least one job that calls assert-required-checks.  If it finds zero, either
  // every gate job was removed (a catastrophic regression) or the parser itself
  // is broken (anchors changed, indentation convention shifted).
  //
  // Verifying this separately gives a clear diagnostic when something
  // fundamental is wrong, rather than a confusing "0 orphaned entries" message.
  // ──────────────────────────────────────────────────────────────────────────
  const gateJobs = parseWorkflowGateJobs(WORKFLOWS_DIR);

  assert.ok(
    gateJobs.length > 0,
    `parseWorkflowGateJobs found no workflow jobs that call '${ASSERT_ACTION_REF}'.\n\n` +
    `Searched: ${WORKFLOWS_DIR}\n\n` +
    `Either:\n` +
    `  (a) All gate jobs were removed from .github/workflows/ — this is a\n` +
    `      catastrophic regression that breaks the entire required-checks chain.\n` +
    `  (b) The parseWorkflowGateJobs parser is broken.  The parser looks for\n` +
    `      job keys at exactly 2-space indentation under 'jobs:' and checks\n` +
    `      whether the job body contains:\n` +
    `        uses: ${ASSERT_ACTION_REF}\n` +
    `      If the workflow file structure changed (different indentation, renamed\n` +
    `      action path), update JOB_KEY_RE or ASSERT_ACTION_REF in this test.`,
  );
});

test('every workflow job calling assert-required-checks is listed in CRITICAL_JOBS (workflow → CRITICAL_JOBS)', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // When a developer adds a new CI job and includes the assert-required-checks
  // composite action in its steps, the job is self-identifying as a required
  // gate.  If it is NOT in CRITICAL_JOBS, the runtime verifier has no way to
  // know the job should be enforced — it can be silently absent from
  // branch-protection without any alarm.
  //
  // Fix: add ("new-job-id", "Display Name") to CRITICAL_JOBS in
  // .github/actions/assert-required-checks/action.yml, then mirror the change
  // in scripts/smoke-test-branch-protection-check.sh (the CRITICAL_JOBS parity
  // test above will fail if you forget the mirror step).
  // ──────────────────────────────────────────────────────────────────────────

  const actionText   = readFileSync(ACTION_PATH, 'utf8');
  const criticalJobs = parseCriticalJobs(actionText, ACTION_PATH);
  const criticalIds  = new Set(criticalJobs.map(([id]) => id));

  const gateJobs = parseWorkflowGateJobs(WORKFLOWS_DIR);

  const unregistered = gateJobs.filter(({ jobId }) => !criticalIds.has(jobId));

  assert.strictEqual(
    unregistered.length,
    0,
    `${unregistered.length} workflow job(s) call assert-required-checks but are\n` +
    `NOT listed in CRITICAL_JOBS in:\n` +
    `  ${ACTION_PATH}\n\n` +
    `Unregistered gate jobs:\n` +
    unregistered
      .map(({ file, jobId }) => `  - "${jobId}"  (source: .github/workflows/${file})`)
      .join('\n') +
    '\n\n' +
    `A job that calls assert-required-checks is declaring itself a required gate.\n` +
    `Every such job MUST appear in CRITICAL_JOBS so the runtime verifier checks\n` +
    `for its presence in GitHub branch-protection required-status-checks.\n\n` +
    `Fix:\n` +
    `  1. Add each missing job to CRITICAL_JOBS in action.yml:\n` +
    unregistered
      .map(({ jobId }) => `       ("${jobId}", "<Display Name for ${jobId}>")`)
      .join('\n') +
    `\n` +
    `  2. Mirror the same entries in scripts/smoke-test-branch-protection-check.sh\n` +
    `     (the CRITICAL_JOBS parity test in this file will fail if you skip step 2).`,
  );
});

test('every CRITICAL_JOBS entry has a workflow job that calls assert-required-checks (CRITICAL_JOBS → workflow)', () => {
  // ── WHAT THIS TEST GUARDS ──────────────────────────────────────────────────
  //
  // If a gate job is renamed or removed from .github/workflows/ without updating
  // CRITICAL_JOBS, the stale entry causes the runtime verifier to check for a
  // job name that no longer exists.  In the best case this produces a spurious
  // "missing" error; in the worst case it silently gives a false "OK" if the
  // old name happens to match something in branch-protection from a previous
  // setup.
  //
  // Fix (choose the appropriate case):
  //   (a) Job was removed — delete the entry from CRITICAL_JOBS and from the
  //       mirror in smoke-test-branch-protection-check.sh.
  //   (b) Job was renamed — update the job-id in both CRITICAL_JOBS and the
  //       mirror, and re-add assert-required-checks to the renamed job's steps.
  //   (c) assert-required-checks step was accidentally dropped from the job —
  //       restore the step in .github/workflows/*.yml.
  // ──────────────────────────────────────────────────────────────────────────

  const actionText   = readFileSync(ACTION_PATH, 'utf8');
  const criticalJobs = parseCriticalJobs(actionText, ACTION_PATH);

  const gateJobs  = parseWorkflowGateJobs(WORKFLOWS_DIR);
  const gateIds   = new Set(gateJobs.map(({ jobId }) => jobId));

  const orphaned = criticalJobs.filter(([jobId]) => !gateIds.has(jobId));

  assert.strictEqual(
    orphaned.length,
    0,
    `${orphaned.length} CRITICAL_JOBS entry(ies) in action.yml have no\n` +
    `corresponding workflow job that calls assert-required-checks:\n\n` +
    `Orphaned entries:\n` +
    orphaned
      .map(([jobId, displayName]) => `  - ("${jobId}", "${displayName}")`)
      .join('\n') +
    '\n\n' +
    `Fix (choose the case that applies):\n` +
    `  (a) Job was removed: delete the entry from CRITICAL_JOBS in action.yml\n` +
    `      and from scripts/smoke-test-branch-protection-check.sh.\n` +
    `  (b) Job was renamed: update the job-id in both CRITICAL_JOBS and the\n` +
    `      smoke-test mirror, then re-add assert-required-checks to the\n` +
    `      renamed job's steps in the workflow YAML.\n` +
    `  (c) The assert-required-checks step was accidentally dropped from the\n` +
    `      job's steps: restore the step in .github/workflows/*.yml.`,
  );
});
