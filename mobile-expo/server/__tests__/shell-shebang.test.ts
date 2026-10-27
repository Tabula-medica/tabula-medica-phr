/**
 * Shebang-presence guard for scripts/*.sh
 *
 * Every shell script added under scripts/ must begin with a recognised bash
 * shebang so that ShellCheck, the OS, and CI all agree on the interpreter.
 * This test gives developers immediate feedback without waiting for the
 * shellcheck-scripts CI job — it runs locally via `npm run test:server`.
 *
 * Accepted shebangs:
 *   #!/usr/bin/env bash
 *   #!/bin/bash
 *
 * Wire-up: framework-agnostic; runs via
 *   node --import tsx server/__tests__/shell-shebang.test.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const SCRIPTS_DIR = path.resolve(__dirname, "../../scripts");

const VALID_SHEBANGS = [
  "#!/usr/bin/env bash",
  "#!/bin/bash",
];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// Collect all *.sh files in scripts/
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

assert(
  shFiles.length > 0,
  `No *.sh files found in ${SCRIPTS_DIR} — glob may be broken`
);

for (const filePath of shFiles) {
  const rel = path.relative(process.cwd(), filePath);
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (e: any) {
    assert(false, `${rel}: could not read file — ${e.message}`);
    continue;
  }

  const firstLine = content.split("\n")[0].trimEnd();
  const hasValidShebang = VALID_SHEBANGS.some((s) => firstLine === s);

  assert(
    hasValidShebang,
    `${rel}: missing or invalid shebang — got "${firstLine}" (expected one of: ${VALID_SHEBANGS.join(", ")})`
  );

  if (hasValidShebang) {
    console.log(`PASS: ${rel} — shebang ok ("${firstLine}")`);
  }
}

if (process.exitCode !== 1) {
  console.log(`\nAll ${shFiles.length} scripts/*.sh file(s) have a valid bash shebang.`);
}
