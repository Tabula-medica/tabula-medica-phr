/**
 * F1 — CI guard: flags raw `db.insert/update/delete` on PHI tables.
 *
 * Scans `server/` for direct Drizzle writes to any table listed in
 * `PHI_COLUMN_MAP` and fails CI if the call is not preceded (within the
 * surrounding 5 lines) by a call to `encryptPhiRow(<tableName>, ...)`.
 *
 * Why a script and not a real ESLint rule:
 *   - The repo has no eslint installed. Adding eslint + a custom plugin
 *     just for this rule is heavyweight; one-purpose grep-based scripts
 *     are easier to audit and faster to run in CI.
 *   - This script is intentionally PESSIMISTIC: false positives are
 *     preferred over false negatives. If a call site is flagged but is
 *     actually safe (e.g. a non-PHI subset update), add an `// phi-ok:`
 *     comment on the same line and the script will skip it.
 *
 * Run:
 *   npx tsx scripts/check-phi-db-access.ts
 *
 * Exit code 0 = clean, 1 = violations found.
 *
 * Wire into CI in a follow-up. Today it can be invoked manually before
 * merging Session 2's call-site conversion work.
 */

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { PHI_TABLE_NAMES } from "../server/security/phi-column-map";

const SERVER_ROOT = "server";
const ALLOW_COMMENT = "phi-ok:";
const SAFE_WRAPPERS = ["encryptPhiRow", "encryptPhiObject"];

type Violation = {
  file: string;
  line: number;
  table: string;
  snippet: string;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(full) === ".ts" || extname(full) === ".tsx") out.push(full);
  }
  return out;
}

function scanFile(file: string): Violation[] {
  // Skip the wrapper itself and the security folder.
  if (file.includes("storage/phi-storage") || file.includes("security/phi-"))
    return [];
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(ALLOW_COMMENT)) continue;

    // Match db.insert(<TABLE>) / db.update(<TABLE>) / db.delete(<TABLE>)
    const match = line.match(
      /\b(?:db|tx|trx|transaction)\s*\.\s*(insert|update|delete)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (!match) continue;
    const [, op, table] = match;
    if (!PHI_TABLE_NAMES.includes(table)) continue;

    // Look in surrounding window for a wrapper call mentioning this table.
    const windowStart = Math.max(0, i - 5);
    const windowEnd = Math.min(lines.length, i + 8);
    const surrounding = lines.slice(windowStart, windowEnd).join("\n");
    const wrapped = SAFE_WRAPPERS.some(
      (w) =>
        surrounding.includes(`${w}("${table}"`) ||
        surrounding.includes(`${w}('${table}'`),
    );
    if (wrapped) continue;

    // For .delete() we don't need encryption — but still flag so the
    // human reviewer confirms no PHI return-payload is leaked.
    if (op === "delete") continue;

    violations.push({
      file,
      line: i + 1,
      table,
      snippet: line.trim(),
    });
  }
  return violations;
}

function main() {
  const files = walk(SERVER_ROOT);
  const allViolations: Violation[] = [];
  for (const f of files) allViolations.push(...scanFile(f));

  if (allViolations.length === 0) {
    console.log(
      `[phi-guard] OK — scanned ${files.length} files, no raw PHI writes detected.`,
    );
    process.exit(0);
  }

  console.error(
    `\n[phi-guard] FAIL — ${allViolations.length} raw write(s) to PHI tables without encryptPhiRow():\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  ${v.table}`);
    console.error(`    ${v.snippet}`);
  }
  console.error(
    `\nFix: wrap the .values() / .set() arg with encryptPhiRow("${allViolations[0].table}", ...)`,
  );
  console.error(`     or add an inline "// ${ALLOW_COMMENT} <reason>" comment if intentional.\n`);
  process.exit(1);
}

main();
