/**
 * ShellCheck lint guard for scripts/*.sh
 *
 * Runs `shellcheck` on every shell script under scripts/ so that developers
 * get the same early feedback loop locally (via `npm run test:server`) that
 * the `shellcheck-scripts` CI job provides after a push.
 *
 * Behaviour when shellcheck is not installed:
 *   Prints a clear SKIP notice and exits 0 — the test must never fail merely
 *   because the tool is absent from the local environment.  CI always installs
 *   shellcheck before running this suite, so lint errors are caught there.
 *
 * Wire-up: framework-agnostic; runs via
 *   node --import tsx server/__tests__/shell-shellcheck.test.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPTS_DIR = path.resolve(__dirname, "../../scripts");

// ---------------------------------------------------------------------------
// 1. Resolve shellcheck binary
// ---------------------------------------------------------------------------

function findShellcheck(): string | null {
  // Try to locate shellcheck on PATH using the shell itself so we respect
  // whatever PATH the test runner has (nix store paths, homebrew, apt, etc.).
  const result = spawnSync("sh", ["-c", "command -v shellcheck"], {
    encoding: "utf8",
  });
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }
  return null;
}

const shellcheckBin = findShellcheck();

if (!shellcheckBin) {
  console.log(
    "SKIP: shellcheck is not installed — install it to enable local ShellCheck lint.\n" +
      "      (CI installs shellcheck automatically in the server-tests job.)"
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Enumerate scripts/*.sh
// ---------------------------------------------------------------------------

let shFiles: string[];
try {
  shFiles = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith(".sh"))
    .map((f) => path.join(SCRIPTS_DIR, f))
    .filter((p) => fs.statSync(p).isFile())
    .sort();
} catch (e: any) {
  console.error(`Could not enumerate ${SCRIPTS_DIR}: ${e.message}`);
  process.exit(1);
}

if (shFiles.length === 0) {
  console.error(
    `FAIL: No *.sh files found in ${SCRIPTS_DIR} — glob may be broken`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Run shellcheck on each file and collect results
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

for (const filePath of shFiles) {
  const rel = path.relative(process.cwd(), filePath);

  const result = spawnSync(shellcheckBin, [filePath], {
    encoding: "utf8",
  });

  if (result.status === 0) {
    console.log(`PASS: ${rel} — shellcheck ok`);
    passCount++;
  } else {
    console.error(`FAIL: ${rel} — shellcheck reported issues:`);
    if (result.stdout) {
      // Indent shellcheck output for readability
      console.error(result.stdout.replace(/^/gm, "  "));
    }
    if (result.stderr) {
      console.error(result.stderr.replace(/^/gm, "  "));
    }
    failCount++;
  }
}

// ---------------------------------------------------------------------------
// 4. Summary
// ---------------------------------------------------------------------------

console.log(`\nShellCheck summary: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
  process.exitCode = 1;
}
