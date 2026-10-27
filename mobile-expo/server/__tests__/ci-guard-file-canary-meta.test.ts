/**
 * Fourth-level canary: asserts that `ci-guard-file-canary.test.ts` itself is
 * non-empty and contains at least three `test(` calls, and that
 * `ci-guard-manifest.json` (the data-driven guard-file registry) exists and
 * has meaningful content.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `server/__tests__/ci-guard-file-canary.test.ts` is the third-level watchdog
 * for CI guard integrity.  However, if that file were replaced with an empty
 * stub, `npm run test:server` would still exit 0 — the entire chain of canary
 * assertions would silently vanish.
 *
 * This file closes that gap by independently asserting:
 *   - `ci-guard-file-canary.test.ts` exists on disk
 *   - the file is not empty (not 0-byte truncated)
 *   - the file contains at least EIGHT `test(` calls (not replaced with a stub)
 *   - the file contains a guard for `assert-required-checks/action.yml`
 *   - `ci-guard-manifest.json` exists on disk
 *   - the manifest is not empty (not 0-byte truncated)
 *
 * Replacing `ci-guard-file-canary.test.ts` or `ci-guard-manifest.json` with
 * an empty file or a minimal stub fails this test, blocking the PR via the
 * `server-tests` required gate.
 *
 * `ci-guard-file-canary.test.ts` reciprocates by watching *this* file, so
 * both files protect each other and neither can be silently removed.
 *
 * Run with: node --import tsx server/__tests__/ci-guard-file-canary-meta.test.ts
 * Also covered by: npm run test:server
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_TESTS = join(ROOT, "server", "__tests__");
const CANARY_FILE = "ci-guard-file-canary.test.ts";
const CANARY_PATH = join(SERVER_TESTS, CANARY_FILE);
const MANIFEST_FILE = "ci-guard-manifest.json";
const MANIFEST_PATH = join(SERVER_TESTS, MANIFEST_FILE);

/**
 * Minimum number of test() calls required to consider the canary non-stubbed.
 *
 * KEEP THIS IN SYNC with the actual number of top-level test() calls in
 * `ci-guard-file-canary.test.ts`.  When a new guard block is added to that
 * file, bump this constant to match so a future stub that keeps only the old
 * count still fires the guard.
 *
 * Current count in ci-guard-file-canary.test.ts (as of last update): 10
 *   1. manifest exists
 *   2. manifest declares ≥ MANIFEST_MIN_ENTRIES entries
 *   3. manifest declares exactly MANIFEST_MIN_ENTRIES entries (drift guard)
 *   4. per-file loop (one test() literal generates N dynamic tests at runtime)
 *   5. forward-scan: every scripts/__tests__/*.test.mjs covered by manifest
 *   6. forward-scan: every server guard/canary test covered by manifest
 *   7. meta canary exists with non-empty content
 *   8. meta canary contains ≥ META_MIN_TEST_CALLS test() calls
 *   9. meta canary contains exactly META_MIN_TEST_CALLS test() calls (drift guard)
 *  10. composite action exists with non-empty content
 */
const MIN_TEST_CALLS = 10;

/** Marker that must appear in the canary to prove the composite-action guard block is present. */
const COMPOSITE_ACTION_MARKER = "assert-required-checks/action.yml";

// ── canary existence ───────────────────────────────────────────────────────────

test(`server/__tests__/${CANARY_FILE} exists on disk`, () => {
  assert.ok(
    existsSync(CANARY_PATH),
    `CANARY FILE MISSING: server/__tests__/${CANARY_FILE}\n` +
      `The third-level CI guard canary has been deleted.\n` +
      `This file verifies that critical CI guard files in scripts/__tests__/\n` +
      `and server/__tests__/ have not been silently removed or stubbed out.\n` +
      `Restore server/__tests__/${CANARY_FILE} from git history.`,
  );
});

// ── canary non-empty ───────────────────────────────────────────────────────────

test(`server/__tests__/${CANARY_FILE} is not empty (> 0 bytes)`, () => {
  assert.ok(
    existsSync(CANARY_PATH),
    `Cannot check size — file is missing. See the existence test above.`,
  );

  const size = statSync(CANARY_PATH).size;
  assert.ok(
    size > 0,
    `CANARY FILE TRUNCATED: server/__tests__/${CANARY_FILE} is 0 bytes.\n` +
      `The file exists but has been emptied.\n` +
      `Restore server/__tests__/${CANARY_FILE} from git history.`,
  );

  const content = readFileSync(CANARY_PATH, "utf8").trim();
  assert.ok(
    content.length > 0,
    `CANARY FILE BLANK: server/__tests__/${CANARY_FILE} contains only whitespace.\n` +
      `Restore server/__tests__/${CANARY_FILE} from git history.`,
  );
});

// ── canary minimum test() call count ──────────────────────────────────────────

test(
  `server/__tests__/${CANARY_FILE} contains at least ${MIN_TEST_CALLS} test() calls`,
  () => {
    assert.ok(
      existsSync(CANARY_PATH),
      `Cannot count test() calls — file is missing. See the existence test above.`,
    );

    const content = readFileSync(CANARY_PATH, "utf8");

    // Count top-level test() calls: match `test(` only at the start of a line
    // (after optional whitespace) so string literals like "at least N test()
    // calls" are not counted.  Each guard assertion is one top-level call.
    const matches = content.match(/^\s*test\(/gm);
    const count = matches ? matches.length : 0;

    assert.ok(
      count >= MIN_TEST_CALLS,
      `CANARY FILE STUBBED: server/__tests__/${CANARY_FILE}\n` +
        `\n` +
        `Expected at least ${MIN_TEST_CALLS} test() calls in the canary file,\n` +
        `but found ${count}.\n` +
        `\n` +
        `A real canary must contain at least ${MIN_TEST_CALLS} independent assertions\n` +
        `so that replacing it with an empty stub is detectable.\n` +
        `\n` +
        `Restore the original content from git history:\n` +
        `  git show HEAD:server/__tests__/${CANARY_FILE}`,
    );
  },
);

// ── exact test() count drift guard ────────────────────────────────────────────

test(
  `server/__tests__/${CANARY_FILE} contains exactly ${MIN_TEST_CALLS} test() calls (drift guard)`,
  () => {
    assert.ok(
      existsSync(CANARY_PATH),
      `Cannot count test() calls — file is missing. See the existence test above.`,
    );

    const content = readFileSync(CANARY_PATH, "utf8");
    const matches = content.match(/^\s*test\(/gm);
    const count = matches ? matches.length : 0;

    assert.strictEqual(
      count,
      MIN_TEST_CALLS,
      `CANARY FILE TEST-COUNT DRIFT: server/__tests__/${CANARY_FILE}\n` +
        `\n` +
        `Expected exactly ${MIN_TEST_CALLS} test() calls, but found ${count}.\n` +
        `\n` +
        `If you added a new guard block to ${CANARY_FILE}, you must also\n` +
        `bump MIN_TEST_CALLS in this file (ci-guard-file-canary-meta.test.ts)\n` +
        `to match the new count.\n` +
        `\n` +
        `If you removed a guard block, lower MIN_TEST_CALLS to match.\n` +
        `\n` +
        `This exact-count check prevents the minimum threshold from silently\n` +
        `lagging behind the real file and losing its ability to detect stubs.`,
    );
  },
);

// ── composite-action guard block ───────────────────────────────────────────────

test(
  `server/__tests__/${CANARY_FILE} contains the composite-action guard for ${COMPOSITE_ACTION_MARKER}`,
  () => {
    assert.ok(
      existsSync(CANARY_PATH),
      `Cannot check composite-action guard — file is missing. See the existence test above.`,
    );

    const content = readFileSync(CANARY_PATH, "utf8");

    assert.ok(
      content.includes(COMPOSITE_ACTION_MARKER),
      `CANARY FILE MISSING COMPOSITE-ACTION GUARD: server/__tests__/${CANARY_FILE}\n` +
        `\n` +
        `The canary no longer contains a reference to "${COMPOSITE_ACTION_MARKER}".\n` +
        `\n` +
        `This means the guard block that verifies\n` +
        `  .github/actions/assert-required-checks/action.yml\n` +
        `has been removed or stubbed out.  Without it, the composite action\n` +
        `(which gates every required-checks CI job) can be silently deleted\n` +
        `without any test failure.\n` +
        `\n` +
        `Restore the composite-action guard block in server/__tests__/${CANARY_FILE}\n` +
        `from git history:\n` +
        `  git show HEAD:server/__tests__/${CANARY_FILE}`,
    );
  },
);

// ── manifest existence & non-empty ────────────────────────────────────────────

test(`server/__tests__/${MANIFEST_FILE} exists on disk`, () => {
  assert.ok(
    existsSync(MANIFEST_PATH),
    `MANIFEST MISSING: server/__tests__/${MANIFEST_FILE}\n` +
      `The guard-file manifest has been deleted.\n` +
      `This JSON file is the single source of truth that drives the data-driven\n` +
      `canary assertions in server/__tests__/${CANARY_FILE}.\n` +
      `Without it the canary silently skips all per-file guard checks.\n` +
      `Restore server/__tests__/${MANIFEST_FILE} from git history.`,
  );
});

test(`server/__tests__/${MANIFEST_FILE} is not empty (> 0 bytes)`, () => {
  assert.ok(
    existsSync(MANIFEST_PATH),
    `Cannot check size — file is missing. See the existence test above.`,
  );

  const size = statSync(MANIFEST_PATH).size;
  assert.ok(
    size > 0,
    `MANIFEST TRUNCATED: server/__tests__/${MANIFEST_FILE} is 0 bytes.\n` +
      `The file exists but has been emptied.\n` +
      `Restore server/__tests__/${MANIFEST_FILE} from git history.`,
  );

  const content = readFileSync(MANIFEST_PATH, "utf8").trim();
  assert.ok(
    content.length > 0,
    `MANIFEST BLANK: server/__tests__/${MANIFEST_FILE} contains only whitespace.\n` +
      `Restore server/__tests__/${MANIFEST_FILE} from git history.`,
  );
});
