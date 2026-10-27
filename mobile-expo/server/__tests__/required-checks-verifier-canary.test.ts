/**
 * Canary: asserts the "Assert all critical CI jobs are in branch-protection
 * required-checks" step is present in .github/workflows/ci-cd.yml and that
 * the step body specifically contains all four required job IDs.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The required-checks verifier step lives inside the `server-tests` job.  If
 * someone removes that step from the workflow YAML (rather than the whole job),
 * `server-tests` still passes and no gate warns — the verifier disappears
 * silently.  Likewise, removing a job ID from the CRITICAL_JOBS list inside
 * the step body silently drops one of the four guard chains.
 *
 * This test lives in `server/__tests__/` so it is picked up by
 * `npm run test:server` (the `server-tests` CI job).  Deleting the step,
 * removing any of the four critical job IDs from the step body, or relocating
 * the job IDs outside the step stanza all cause this test to fail, blocking
 * the PR.  Deleting *this* file also fails CI because `server-tests` is a
 * required merge gate.
 *
 * DESIGN NOTE — step-body scoping
 * ---------------------------------
 * Checks against `content.includes(jobId)` on the whole file are intentionally
 * INSUFFICIENT: a job ID could appear in a comment, debug echo, or another
 * script block and the test would still pass even after the CRITICAL_JOBS list
 * was gutted.  This test extracts only the bytes that belong to the target step
 * stanza (from its `- name:` line to the next sibling step or new job), then
 * asserts the IDs within that isolated block.
 *
 * Run with: node --import tsx server/__tests__/required-checks-verifier-canary.test.ts
 * Also covered by: npm run test:server
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW_FILE = join(ROOT, ".github", "workflows", "ci-cd.yml");

const STEP_NAME = "Assert all critical CI jobs are in branch-protection required-checks";

const CRITICAL_JOB_IDS = [
  "server-tests",
  "jest-tests",
  "reviewer-login-gate",
  "script-tests",
] as const;

/**
 * Extract the body of the named step from the workflow YAML.
 *
 * A step in GitHub Actions YAML is a list item under `steps:`.  In this
 * repo, steps are indented with 6 spaces (`      - name: ...`).  We locate
 * the target step's `- name:` line, then collect every subsequent line until
 * we reach:
 *   - another step item at the same indentation level (`      - `), or
 *   - a new top-level job key (`  <word>:` at 2-space indentation), or
 *   - end of file.
 *
 * Returns null if the step name is not found as a `- name:` entry.
 */
function extractStepBody(fileContent: string, stepName: string): string | null {
  const lines = fileContent.split("\n");

  // Match `      - name: <stepName>` — the step must appear as a YAML list
  // item, not just as text anywhere in the file.
  const stepStartPattern = new RegExp(
    `^(\\s+)-\\s+name:\\s+${escapeRegExp(stepName)}\\s*$`,
  );

  let startLine = -1;
  let stepIndent = "";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(stepStartPattern);
    if (m) {
      startLine = i;
      stepIndent = m[1]; // e.g. "      " (6 spaces)
      break;
    }
  }

  if (startLine === -1) {
    return null;
  }

  // Collect lines from `startLine` until we hit the next sibling step or job.
  // A sibling step starts with `<stepIndent>- ` (same indent + list marker).
  // A new job starts with exactly two spaces + word + colon (job-level key).
  const siblingStepPrefix = `${stepIndent}- `;
  const jobKeyPattern = /^  \w[\w-]*:/; // e.g. "  jest-tests:"

  const bodyLines: string[] = [lines[startLine]];
  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith(siblingStepPrefix) || jobKeyPattern.test(line)) {
      break;
    }
    bodyLines.push(line);
  }

  return bodyLines.join("\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── workflow file presence ────────────────────────────────────────────────────

test(".github/workflows/ci-cd.yml exists", () => {
  assert.ok(
    existsSync(WORKFLOW_FILE),
    "WORKFLOW FILE MISSING: .github/workflows/ci-cd.yml\n" +
      "The CI workflow file has been deleted. Restore it from git history.",
  );
});

// ── required-checks verifier step presence ────────────────────────────────────

test(
  `ci-cd.yml contains a step named "${STEP_NAME}" as a YAML list item`,
  () => {
    const content = readFileSync(WORKFLOW_FILE, "utf8");
    const body = extractStepBody(content, STEP_NAME);

    assert.ok(
      body !== null,
      `REQUIRED-CHECKS VERIFIER STEP MISSING from ${WORKFLOW_FILE}\n` +
        `\n` +
        `Expected a YAML step item of the form:\n` +
        `      - name: ${STEP_NAME}\n` +
        `\n` +
        `This step verifies that all four critical CI gates remain in GitHub's\n` +
        `branch-protection required-status-checks for main.  Removing it\n` +
        `silently breaks the entire guard chain.  Restore the step from git\n` +
        `history.`,
    );
  },
);

// ── critical job IDs present in the step body (not just anywhere in the file) ──

for (const jobId of CRITICAL_JOB_IDS) {
  test(
    `"${STEP_NAME}" step body references job ID "${jobId}"`,
    () => {
      const content = readFileSync(WORKFLOW_FILE, "utf8");
      const stepBody = extractStepBody(content, STEP_NAME);

      // If the step itself is missing, a separate test above already fails.
      // Skip the ID check with a clear message rather than a confusing error.
      assert.ok(
        stepBody !== null,
        `Cannot locate step "${STEP_NAME}" — see the step-presence test for details.`,
      );

      // Check for the job ID as a quoted string *inside the step body*.
      // We require it as a quoted string ('"server-tests"') because that is
      // how it must appear in the CRITICAL_JOBS Python list; bare occurrences
      // in comments or echo strings do not satisfy the intent of the check.
      assert.ok(
        stepBody.includes(`"${jobId}"`),
        `CRITICAL JOB ID MISSING FROM REQUIRED-CHECKS VERIFIER STEP BODY\n` +
          `Job ID: "${jobId}"\n` +
          `\n` +
          `The job ID must appear as a quoted string inside the CRITICAL_JOBS\n` +
          `list within the step body of:\n` +
          `  "${STEP_NAME}"\n` +
          `\n` +
          `Required job IDs: server-tests, jest-tests, reviewer-login-gate,\n` +
          `script-tests\n` +
          `\n` +
          `"${jobId}" was not found as a quoted string in the step body.\n` +
          `Restore or re-add this job ID in the CRITICAL_JOBS list inside\n` +
          `that step, then re-run: npm run test:server`,
      );
    },
  );
}
