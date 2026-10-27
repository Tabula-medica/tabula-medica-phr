/**
 * Second-level canary: asserts that every CI guard file listed in
 * `ci-guard-manifest.json` exists on disk with non-empty, non-stubbed content.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `scripts/__tests__/ci-guard-files.test.mjs` watches
 * `bash-guard-expansion.test.mjs` and the `test:scripts` CI step.  However
 * that file lives in the same glob that `npm run test:scripts` expands
 * (`scripts/__tests__/*.test.mjs`), so if *it* is deleted the glob just has
 * one fewer file and the `script-tests` CI job still exits 0 — the watch
 * disappears silently.
 *
 * This test lives in `server/__tests__/` and is picked up by
 * `npm run test:server` (the `jest-tests` / `server-tests` CI job), an
 * *independent* required gate.  Deleting any guard file listed in the manifest
 * causes this test to fail, blocking the PR even if the `script-tests` job no
 * longer catches it.  Deleting *this* file also fails CI because `server-tests`
 * is a required merge gate.
 *
 * HOW TO ADD A NEW GUARD FILE
 * ---------------------------
 * Edit `server/__tests__/ci-guard-manifest.json` — add the filename under the
 * appropriate directory key and raise MANIFEST_MIN_ENTRIES below to the new
 * total entry count. Commit both changes together.
 * All scripts/__tests__/*.test.mjs files are covered. Server CI guards must
 * include a standalone "guard" token (e.g. ci-release-guard.test.ts) or
 * "canary" in their filename; regular application tests are not CI guards.
 *
 * HOW TO INTENTIONALLY RETIRE A GUARD FILE
 * ---------------------------------------
 * 1. Confirm the protected CI behavior is obsolete or covered by a replacement;
 *    do not lower the count just to silence a missing-file failure.
 * 2. Delete the retired file and remove its entry from
 *    `server/__tests__/ci-guard-manifest.json`. Removing only the entry leaves
 *    the file on disk, so the forward-scan coverage checks still fail.
 * 3. Lower MANIFEST_MIN_ENTRIES below to the new total across all manifest
 *    directory arrays, and update the documented total beside it.
 * 4. Commit the file deletion, manifest edit, and count change together,
 *    explaining why the guard is no longer needed (or naming its replacement).
 * 5. Run this canary and `ci-guard-file-canary-meta.test.ts` with the command
 *    below for each file, plus `npm run test:scripts`.
 *
 * Some guards have dedicated watchers in addition to the manifest. Update
 * those deliberately if they reference the retired file; do not disable the
 * remaining protections. Keep the count independent of the manifest so an
 * accidental entry deletion cannot silently lower its own safety threshold.
 *
 * Run with: node --import tsx server/__tests__/ci-guard-file-canary.test.ts
 * Also covered by: npm run test:server
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SERVER_TESTS = join(ROOT, "server", "__tests__");
const COMPOSITE_ACTION = join(ROOT, ".github", "actions", "assert-required-checks", "action.yml");
const MANIFEST_FILE = "ci-guard-manifest.json";
const MANIFEST_PATH = join(SERVER_TESTS, MANIFEST_FILE);

/**
 * Exact total number of guard file entries the manifest must declare.
 *
 * Used for both a lower-bound (>= check) and an exact-count drift guard
 * (=== check) so that adding a new entry without bumping this constant
 * becomes a CI failure — not just removing one.
 *
 * When you add or remove a guard file from ci-guard-manifest.json, update this
 * constant to the new total entry count in the same commit. For removals,
 * follow HOW TO INTENTIONALLY RETIRE A GUARD FILE above.
 *
 * Current total in ci-guard-manifest.json (as of last update): 13
 */
const MANIFEST_MIN_ENTRIES = 13;

/**
 * Minimum number of test() calls required in the meta file.
 *
 * KEEP THIS IN SYNC with the actual number of top-level test() calls in
 * `ci-guard-file-canary-meta.test.ts`.  When a new guard block is added to
 * that file, bump this constant to match so a future stub that keeps only the
 * old count still fires the guard.
 *
 * Current count in ci-guard-file-canary-meta.test.ts (as of last update): 7
 *   1. canary exists on disk
 *   2. canary is not empty (> 0 bytes)
 *   3. canary contains ≥ MIN_TEST_CALLS test() calls
 *   4. canary contains exactly MIN_TEST_CALLS test() calls (drift guard)
 *   5. canary contains the composite-action guard marker
 *   6. manifest exists on disk
 *   7. manifest is not empty (> 0 bytes)
 *
 * NOTE: The count above refers to ci-guard-file-canary-meta.test.ts (this
 * file's watcher).  The canary itself (ci-guard-file-canary.test.ts) now
 * has 10 top-level test() calls — that count is tracked by MIN_TEST_CALLS in
 * ci-guard-file-canary-meta.test.ts.
 */
const META_MIN_TEST_CALLS = 7;

// ── manifest existence & sanity ────────────────────────────────────────────────

test(`server/__tests__/${MANIFEST_FILE} exists on disk`, () => {
  assert.ok(
    existsSync(MANIFEST_PATH),
    `MANIFEST MISSING: server/__tests__/${MANIFEST_FILE}\n` +
      `The guard-file manifest has been deleted.\n` +
      `This file is the single source of truth that drives the canary family.\n` +
      `Restore server/__tests__/${MANIFEST_FILE} from git history.`,
  );
});

test(
  `server/__tests__/${MANIFEST_FILE} declares at least ${MANIFEST_MIN_ENTRIES} guard files`,
  () => {
    assert.ok(
      existsSync(MANIFEST_PATH),
      `Cannot check manifest — file is missing. See the existence test above.`,
    );

    const raw = readFileSync(MANIFEST_PATH, "utf8");
    let manifest: Record<string, string[]>;
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      assert.fail(
        `MANIFEST INVALID JSON: server/__tests__/${MANIFEST_FILE}\n` +
          `The manifest file cannot be parsed as JSON.\n` +
          `Restore or repair server/__tests__/${MANIFEST_FILE} from git history.\n` +
          `Parse error: ${(e as Error).message}`,
      );
    }

    const total = Object.values(manifest).reduce(
      (sum, files) => sum + files.length,
      0,
    );

    assert.ok(
      total >= MANIFEST_MIN_ENTRIES,
      `MANIFEST TOO SMALL: server/__tests__/${MANIFEST_FILE}\n` +
        `\n` +
        `Expected at least ${MANIFEST_MIN_ENTRIES} guard-file entries across all\n` +
        `directory keys, but found ${total}.\n` +
        `\n` +
        `If the count dropped legitimately (a guard file was intentionally retired),\n` +
        `lower MANIFEST_MIN_ENTRIES in this test file.  Otherwise restore the\n` +
        `missing entries in the manifest from git history.`,
    );
  },
);

test(
  `server/__tests__/${MANIFEST_FILE} declares exactly ${MANIFEST_MIN_ENTRIES} guard files (drift guard)`,
  () => {
    assert.ok(
      existsSync(MANIFEST_PATH),
      `Cannot check manifest — file is missing. See the existence test above.`,
    );

    const raw = readFileSync(MANIFEST_PATH, "utf8");
    let manifest: Record<string, string[]>;
    try {
      manifest = JSON.parse(raw);
    } catch (e) {
      assert.fail(
        `MANIFEST INVALID JSON: server/__tests__/${MANIFEST_FILE}\n` +
          `The manifest file cannot be parsed as JSON.\n` +
          `Restore or repair server/__tests__/${MANIFEST_FILE} from git history.\n` +
          `Parse error: ${(e as Error).message}`,
      );
    }

    const total = Object.values(manifest).reduce(
      (sum, files) => sum + files.length,
      0,
    );

    assert.strictEqual(
      total,
      MANIFEST_MIN_ENTRIES,
      `MANIFEST ENTRY-COUNT DRIFT: server/__tests__/${MANIFEST_FILE}\n` +
        `\n` +
        `Expected exactly ${MANIFEST_MIN_ENTRIES} guard-file entries across all\n` +
        `directory keys, but found ${total}.\n` +
        `\n` +
        `If you added a new entry to the manifest, bump MANIFEST_MIN_ENTRIES in\n` +
        `this file (ci-guard-file-canary.test.ts) to match the new total.\n` +
        `\n` +
        `If you removed an entry legitimately, lower MANIFEST_MIN_ENTRIES to match.\n` +
        `\n` +
        `This exact-count check prevents the threshold from silently lagging behind\n` +
        `the manifest and losing its ability to detect unannounced additions.`,
    );
  },
);

// ── data-driven guard-file assertions ─────────────────────────────────────────

/**
 * Assert a guard file exists and has meaningful content.
 *
 * "Meaningful content" means:
 *   - the file is present on disk (not deleted)
 *   - the file has at least one byte (not a 0-byte truncation)
 *   - after trimming whitespace the file is still non-empty (not all blanks)
 *   - the file contains at least one `test(` call (not replaced with a stub)
 */
function assertGuardFile(dir: string, filename: string): void {
  const filePath = join(ROOT, dir, filename);
  const displayPath = `${dir}/${filename}`;

  assert.ok(
    existsSync(filePath),
    `GUARD FILE MISSING: ${displayPath}\n` +
      `The CI guard file ${filename} has been deleted.\n` +
      `This file protects critical CI gates from being silently removed.\n` +
      `Restore ${displayPath} from git history.`,
  );

  const size = statSync(filePath).size;
  assert.ok(
    size > 0,
    `GUARD FILE EMPTY: ${displayPath} exists but is 0 bytes.\n` +
      `The file has been truncated. Restore it from git history.`,
  );

  const content = readFileSync(filePath, "utf8").trim();
  assert.ok(
    content.length > 0,
    `GUARD FILE BLANK: ${displayPath} contains only whitespace.\n` +
      `Restore it from git history.`,
  );

  assert.ok(
    content.includes("test("),
    `GUARD FILE STUBBED: ${displayPath} exists but contains no test() calls.\n` +
      `The file appears to have been replaced with a stub or empty shell.\n` +
      `Restore the original content from git history.`,
  );
}

// Load manifest once; if it is absent skip the per-file loop (the existence
// tests above already fail loudly in that case).
const manifestRaw = existsSync(MANIFEST_PATH)
  ? readFileSync(MANIFEST_PATH, "utf8")
  : null;

const manifest: Record<string, string[]> = (() => {
  if (!manifestRaw) return {};
  try {
    return JSON.parse(manifestRaw);
  } catch {
    return {};
  }
})();

// Generate one test() per guard file entry so failures name the exact file.
for (const [dir, files] of Object.entries(manifest)) {
  for (const filename of files) {
    test(`${dir}/${filename} exists with non-empty, non-stubbed content`, () => {
      assertGuardFile(dir, filename);
    });
  }
}

// ── forward-scan: disk → manifest coverage ────────────────────────────────────

test(
  "manifest covers every scripts/__tests__/*.test.mjs file on disk (no new file left out)",
  () => {
    assert.ok(
      existsSync(MANIFEST_PATH),
      `Cannot check coverage — manifest is missing. See the existence test above.`,
    );

    const scriptsTestsDir = join(ROOT, "scripts", "__tests__");
    const onDisk = readdirSync(scriptsTestsDir)
      .filter((f) => f.endsWith(".test.mjs"))
      .sort();

    const manifestFiles: string[] = manifest["scripts/__tests__"] ?? [];
    const missing = onDisk.filter((f) => !manifestFiles.includes(f));

    assert.strictEqual(
      missing.length,
      0,
      `MANIFEST COVERAGE GAP: The following scripts/__tests__/*.test.mjs files\n` +
        `exist on disk but are NOT listed in server/__tests__/ci-guard-manifest.json:\n` +
        `\n` +
        `  ${missing.join("\n  ")}\n` +
        `\n` +
        `For each missing file:\n` +
        `  1. Add it to the "scripts/__tests__" array in\n` +
        `     server/__tests__/ci-guard-manifest.json.\n` +
        `  2. Bump MANIFEST_MIN_ENTRIES in this file (ci-guard-file-canary.test.ts)\n` +
        `     to the new total entry count.\n` +
        `\n` +
        `If a file is intentionally not a guard script, it should not live in\n` +
        `scripts/__tests__/ — that directory is reserved for CI guard scripts.`,
    );
  },
);

test(
  "manifest covers every guard-like server/__tests__/*.test.ts file on disk",
  () => {
    assert.ok(
      existsSync(MANIFEST_PATH),
      `Cannot check coverage — manifest is missing. See the existence test above.`,
    );

    // The watcher and its meta test have dedicated checks below. Match a
    // standalone guard token, not application tests such as ai-guardrail.
    // Preserve the existing canary naming convention as well.
    const excluded = new Set([
      "ci-guard-file-canary.test.ts",
      "ci-guard-file-canary-meta.test.ts",
    ]);
    const onDisk = readdirSync(SERVER_TESTS)
      .filter(
        (f) => f.endsWith(".test.ts") && !excluded.has(f) &&
          (f.includes("canary") || /(?:^|[-_.])guard(?:[-_.]|$)/.test(f)),
      )
      .sort();

    const manifestFiles: string[] = manifest["server/__tests__"] ?? [];
    const missing = onDisk.filter((f) => !manifestFiles.includes(f));

    assert.strictEqual(
      missing.length,
      0,
      `MANIFEST COVERAGE GAP: The following server/__tests__/ guard/canary test\n` +
        `files exist on disk but are NOT listed in server/__tests__/ci-guard-manifest.json:\n` +
        `\n` +
        `  ${missing.join("\n  ")}\n` +
        `\n` +
        `For each missing file:\n` +
        `  1. Add it to the "server/__tests__" array in\n` +
        `     server/__tests__/ci-guard-manifest.json.\n` +
        `  2. Bump MANIFEST_MIN_ENTRIES in this file (ci-guard-file-canary.test.ts)\n` +
        `     to the new total entry count.\n` +
        `\n` +
        `Server CI guard tests use a standalone "guard" token or "canary" in\n` +
        `their filename. Regular application tests are not part of this scan.`,
    );
  },
);

// ── meta canary self-check ─────────────────────────────────────────────────────

test(
  "server/__tests__/ci-guard-file-canary-meta.test.ts exists with non-empty content",
  () => {
    const filePath = join(SERVER_TESTS, "ci-guard-file-canary-meta.test.ts");
    assert.ok(
      existsSync(filePath),
      `GUARD FILE MISSING: server/__tests__/ci-guard-file-canary-meta.test.ts\n` +
        `The CI guard file ci-guard-file-canary-meta.test.ts has been deleted.\n` +
        `This file protects critical CI gates from being silently removed.\n` +
        `Restore server/__tests__/ci-guard-file-canary-meta.test.ts from git history.`,
    );

    const size = statSync(filePath).size;
    assert.ok(
      size > 0,
      `GUARD FILE EMPTY: server/__tests__/ci-guard-file-canary-meta.test.ts exists but is 0 bytes.\n` +
        `The file has been truncated. Restore it from git history.`,
    );

    const content = readFileSync(filePath, "utf8").trim();
    assert.ok(
      content.length > 0,
      `GUARD FILE BLANK: server/__tests__/ci-guard-file-canary-meta.test.ts contains only whitespace.\n` +
        `Restore it from git history.`,
    );

    assert.ok(
      content.includes("test("),
      `GUARD FILE STUBBED: server/__tests__/ci-guard-file-canary-meta.test.ts exists but contains no test() calls.\n` +
        `The file appears to have been replaced with a stub or empty shell.\n` +
        `Restore the original content from git history.`,
    );
  },
);

test(
  `server/__tests__/ci-guard-file-canary-meta.test.ts contains at least ${META_MIN_TEST_CALLS} test() calls`,
  () => {
    const metaPath = join(SERVER_TESTS, "ci-guard-file-canary-meta.test.ts");

    assert.ok(
      existsSync(metaPath),
      `Cannot count test() calls — file is missing. See the existence test above.`,
    );

    const content = readFileSync(metaPath, "utf8");

    // Count top-level test() calls: match `test(` only at the start of a line
    // (after optional whitespace) so string literals like "at least N test()
    // calls" are not counted.  Each guard assertion is one top-level call.
    const matches = content.match(/^\s*test\(/gm);
    const count = matches ? matches.length : 0;

    assert.ok(
      count >= META_MIN_TEST_CALLS,
      `META CANARY FILE STUBBED: server/__tests__/ci-guard-file-canary-meta.test.ts\n` +
        `\n` +
        `Expected at least ${META_MIN_TEST_CALLS} test() calls in the meta canary file,\n` +
        `but found ${count}.\n` +
        `\n` +
        `A real meta canary must contain at least ${META_MIN_TEST_CALLS} independent assertions\n` +
        `so that replacing it with a minimal stub is detectable.\n` +
        `\n` +
        `Restore the original content from git history:\n` +
        `  git show HEAD:server/__tests__/ci-guard-file-canary-meta.test.ts`,
    );
  },
);

test(
  `server/__tests__/ci-guard-file-canary-meta.test.ts contains exactly ${META_MIN_TEST_CALLS} test() calls (drift guard)`,
  () => {
    const metaPath = join(SERVER_TESTS, "ci-guard-file-canary-meta.test.ts");

    assert.ok(
      existsSync(metaPath),
      `Cannot count test() calls — file is missing. See the existence test above.`,
    );

    const content = readFileSync(metaPath, "utf8");
    const matches = content.match(/^\s*test\(/gm);
    const count = matches ? matches.length : 0;

    assert.strictEqual(
      count,
      META_MIN_TEST_CALLS,
      `META CANARY FILE TEST-COUNT DRIFT: server/__tests__/ci-guard-file-canary-meta.test.ts\n` +
        `\n` +
        `Expected exactly ${META_MIN_TEST_CALLS} test() calls, but found ${count}.\n` +
        `\n` +
        `If you added a new guard block to ci-guard-file-canary-meta.test.ts, you must\n` +
        `also bump META_MIN_TEST_CALLS in this file (ci-guard-file-canary.test.ts)\n` +
        `to match the new count.\n` +
        `\n` +
        `If you removed a guard block, lower META_MIN_TEST_CALLS to match.\n` +
        `\n` +
        `This exact-count check prevents the minimum threshold from silently\n` +
        `lagging behind the real file and losing its ability to detect stubs.`,
    );
  },
);

// ── .github/actions/assert-required-checks/action.yml ─────────────────────────

test(
  ".github/actions/assert-required-checks/action.yml exists with non-empty content",
  () => {
    assert.ok(
      existsSync(COMPOSITE_ACTION),
      `COMPOSITE ACTION MISSING: .github/actions/assert-required-checks/action.yml\n` +
      `The composite GitHub Action that gates every required-checks job has been\n` +
      `deleted or renamed. Four CI jobs delegate to this file; without it all four\n` +
      `gate checks error out at runtime with "uses: path does not exist".\n` +
      `Restore .github/actions/assert-required-checks/action.yml from git history.`,
    );

    const size = statSync(COMPOSITE_ACTION).size;
    assert.ok(
      size > 0,
      `COMPOSITE ACTION EMPTY: .github/actions/assert-required-checks/action.yml exists but is 0 bytes.\n` +
      `The file has been truncated. Restore it from git history.`,
    );

    const content = readFileSync(COMPOSITE_ACTION, "utf8").trim();
    assert.ok(
      content.length > 0,
      `COMPOSITE ACTION BLANK: .github/actions/assert-required-checks/action.yml contains only whitespace.\n` +
      `Restore it from git history.`,
    );

    assert.ok(
      content.includes("runs:"),
      `COMPOSITE ACTION STUBBED: .github/actions/assert-required-checks/action.yml exists but does not contain a "runs:" key.\n` +
      `The file does not appear to be a valid GitHub composite action.\n` +
      `Restore the original content from git history.`,
    );
  },
);
