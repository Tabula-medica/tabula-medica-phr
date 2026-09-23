#!/usr/bin/env node
/**
 * sync-protocol — propagate the canonical Longevity Protocol to the sibling
 * repos and keep them byte-for-byte in lock-step.
 *
 * The PHR repo is the SOURCE OF TRUTH. These two files are copied verbatim:
 *   - shared/longevity-protocol.ts   (screening table + biomarker targets)
 *   - server/care-gaps-service.ts    (the USPSTF care-gap engine)
 *
 * Usage:
 *   node scripts/sync-protocol.mjs            copy canonical → siblings, refresh checksums
 *   node scripts/sync-protocol.mjs --check    verify every copy matches (CI/pre-push); exit 1 on drift
 *   node scripts/sync-protocol.mjs --checksum (re)write shared/longevity-protocol.sha256 only
 *
 * Line endings are normalised to LF before hashing so the checksum is stable
 * across Windows/Linux checkouts.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const CANONICAL_FILES = [
  "shared/longevity-protocol.ts",
  "server/care-gaps-service.ts",
];
const CHECKSUM_FILE = "shared/longevity-protocol.sha256";
const SIBLINGS = ["tabula-medica-ehr", "tabula-medica-phr-world", "tabula-phr-acp"];

const norm = (s) => s.replace(/\r\n/g, "\n");
const sha = (buf) => createHash("sha256").update(norm(buf.toString("utf8"))).digest("hex");

const mode = process.argv[2] ?? "";

function computeChecksum() {
  // One digest over both canonical files, order-stable.
  const h = createHash("sha256");
  for (const rel of CANONICAL_FILES) {
    h.update(rel + "\n");
    h.update(norm(readFileSync(join(ROOT, rel), "utf8")));
  }
  return h.digest("hex");
}

if (mode === "--checksum") {
  const sum = computeChecksum();
  writeFileSync(join(ROOT, CHECKSUM_FILE), sum + "\n");
  console.log(`wrote ${CHECKSUM_FILE}: ${sum}`);
  process.exit(0);
}

if (mode === "--check") {
  const canonical = Object.fromEntries(
    CANONICAL_FILES.map((rel) => [rel, sha(readFileSync(join(ROOT, rel)))]),
  );
  let drift = false;
  for (const sib of SIBLINGS) {
    const base = resolve(ROOT, "..", sib);
    if (!existsSync(base)) { console.warn(`skip ${sib}: not found`); continue; }
    for (const rel of CANONICAL_FILES) {
      const p = join(base, rel);
      if (!existsSync(p)) { console.error(`DRIFT ${sib}/${rel}: missing`); drift = true; continue; }
      if (sha(readFileSync(p)) !== canonical[rel]) { console.error(`DRIFT ${sib}/${rel}: differs from canonical`); drift = true; }
    }
  }
  if (drift) { console.error("\nProtocol drift detected. Run `node scripts/sync-protocol.mjs` to resync."); process.exit(1); }
  console.log("All sibling copies match the canonical protocol.");
  process.exit(0);
}

// default: write mode
const sum = computeChecksum();
writeFileSync(join(ROOT, CHECKSUM_FILE), sum + "\n");
for (const sib of SIBLINGS) {
  const base = resolve(ROOT, "..", sib);
  if (!existsSync(base)) { console.warn(`skip ${sib}: not found`); continue; }
  for (const rel of CANONICAL_FILES) {
    writeFileSync(join(base, rel), readFileSync(join(ROOT, rel)));
    console.log(`synced ${sib}/${rel}`);
  }
  writeFileSync(join(base, CHECKSUM_FILE), sum + "\n");
}
console.log(`\nDone. Protocol ${sum.slice(0, 12)}… propagated to ${SIBLINGS.length} siblings.`);
