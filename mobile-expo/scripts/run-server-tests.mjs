#!/usr/bin/env node
/**
 * Runs every test file under server/__tests__/ via `node --import tsx`.
 * Exits non-zero if any file fails. Used by `npm run test:server` and by
 * the CI/CD pipeline (see .github/workflows/ci-cd.yml) so the auth and
 * AI-policy regression suites must pass before code can ship.
 */
import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const testDir = resolve(process.cwd(), "server/__tests__");

let files;
try {
  files = readdirSync(testDir)
    .filter((f) => f.endsWith(".test.ts"))
    .map((f) => join(testDir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
} catch (e) {
  console.error(`Could not read ${testDir}: ${e.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`No *.test.ts files found in ${testDir}`);
  process.exit(1);
}

console.log(`Running ${files.length} server test file(s):`);
for (const f of files) console.log(`  - ${f}`);

let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, ["--import", "tsx", f], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`FAIL ${f} (exit ${r.status})`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test file(s) failed.`);
  process.exit(1);
}
console.log("\nAll server tests passed.");
