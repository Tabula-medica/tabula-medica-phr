#!/usr/bin/env node
// Runs `npm audit --json` and exits non-zero only for HIGH/CRITICAL findings
// that are NOT in the explicitly-accepted no-patch list below.
//
// Why this exists: npm 10 dropped the --ignore flag; continue-on-error on the
// raw audit step would silently pass future high/critical CVEs through to
// auto-deploy. This script keeps the gate strict while carving out only the
// advisories that have no upstream patch available.
import { execSync } from 'node:child_process';

// Advisories accepted with no patch available — must be reviewed before adding.
// Format: GHSA-xxxx-xxxx-xxxx  (from https://github.com/advisories/<id>)
const ACCEPTED_GHSA = new Set([
  'GHSA-vfj7-8cjw-p6xm', // braces <=3.0.3 — Patched: <0.0.0; needs tailwindcss v4 upgrade
  'GHSA-rj75-hqrm-r3gf', // postcss-selector-parser — Patched: <0.0.0; same tailwindcss dep chain
]);

let raw;
try {
  raw = execSync('npm audit --json --audit-level=high 2>/dev/null', { encoding: 'utf8' });
} catch (err) {
  // npm audit exits non-zero when vulnerabilities are found; stdout is still valid JSON.
  // If stdout is absent the command itself failed (network error, missing lockfile, etc.) —
  // fail closed rather than substituting an empty object that would pass the gate.
  if (!err.stdout) {
    console.error('audit-filter: npm audit produced no output — command may have failed to run.');
    process.exit(1);
  }
  raw = err.stdout;
}

let report;
try {
  report = JSON.parse(raw);
} catch {
  console.error('audit-filter: failed to parse npm audit JSON output');
  process.exit(1);
}

// Reject npm operational error responses ({"error": {...}}) — these carry no
// vulnerability data and must not be treated as a clean audit result.
if (report.error) {
  console.error('audit-filter: npm audit returned an operational error:', JSON.stringify(report.error));
  process.exit(1);
}

// Guard: vulnerabilities must be a non-null plain object; any other shape is invalid.
if (
  typeof report.vulnerabilities !== 'object' ||
  report.vulnerabilities === null ||
  Array.isArray(report.vulnerabilities)
) {
  console.error('audit-filter: npm audit returned no vulnerabilities map — treating as invalid.');
  console.error('Raw output (first 500 chars):', raw.slice(0, 500));
  process.exit(1);
}

const blocking = [];
for (const [name, vuln] of Object.entries(report.vulnerabilities)) {
  if (!['high', 'critical'].includes(vuln.severity)) continue;
  const viaAdvisories = (vuln.via ?? []).filter(v => typeof v === 'object' && v.url && ['high', 'critical'].includes(v.severity));
  if (viaAdvisories.length === 0) continue; // transitive with no direct advisory link
  const allAccepted = viaAdvisories.every(v => {
    const ghsa = v.url?.match(/GHSA-[a-z0-9-]+/)?.[0];
    return ghsa && ACCEPTED_GHSA.has(ghsa);
  });
  if (!allAccepted) {
    blocking.push({ name, severity: vuln.severity.toUpperCase(), via: viaAdvisories.map(v => v.url) });
  }
}

if (blocking.length > 0) {
  console.error('\nBlocking dependency vulnerabilities:\n');
  for (const v of blocking) {
    console.error(`  ${v.severity}  ${v.name}`);
    for (const url of v.via) console.error(`    ${url}`);
  }
  console.error('\nFix these before merging, or add to ACCEPTED_GHSA with a justification comment.');
  process.exit(1);
}

const accepted = [...ACCEPTED_GHSA].join(', ');
console.log(`Dependency audit passed. Accepted no-patch advisories: ${accepted}`);
