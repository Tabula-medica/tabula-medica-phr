#!/usr/bin/env node
/**
 * compliance-console: build-posture.mjs
 *
 * Reads ventures.json + controls.json + evidence/signals.json and
 * writes evidence/posture.json (raw) + web/posture.json (dashboard-ready).
 *
 * Usage:
 *   node engine/build-posture.mjs [--collect]   # --collect re-runs all collectors first
 */
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadVentures, loadControls, loadSignals, resolveSignal, computeScore, SEVERITY_WEIGHT } from './lib.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const EVIDENCE = join(ROOT, 'evidence');
const WEB = join(ROOT, 'web');

const reCollect = process.argv.includes('--collect');

if (reCollect) {
  const collectors = ['collect-repo', 'collect-github', 'collect-deps', 'collect-gcp'];
  for (const c of collectors) {
    process.stdout.write(`· collecting ${c.replace('collect-', '')} signals…\n`);
    try {
      execSync(`node "${join(ROOT, 'collectors', c + '.mjs')}"`, { stdio: ['inherit', 'inherit', 'inherit'] });
    } catch (e) {
      process.stderr.write(`  ⚠ ${c} failed: ${e.message}\n`);
    }
  }
  process.stdout.write('\n');
}

const ventures = loadVentures();
const controls = loadControls();
const { bundles } = loadSignals(EVIDENCE);

const now = new Date().toISOString();
const ventureMap = {};
let portfolioPassW = 0, portfolioTotalW = 0, p0Open = 0;

for (const venture of ventures) {
  const rows = [];
  for (const ctrl of controls) {
    const { verdict, detail } = resolveSignal(ctrl, venture, bundles);
    rows.push({
      id: ctrl.id,
      title: ctrl.title,
      category: ctrl.category,
      severity: ctrl.severity,
      mappings: ctrl.mappings ?? {},
      evidence: ctrl.evidence ?? [],
      autofix: ctrl.autofix ?? false,
      verdict,
      source: ctrl.source,
      detail,
    });
    if (verdict === 'fail' && ctrl.severity === 'P0') p0Open++;
  }

  const readiness = computeScore(rows);
  const counts = {
    pass: rows.filter(r => r.verdict === 'pass').length,
    fail: rows.filter(r => r.verdict === 'fail').length,
    unknown: rows.filter(r => r.verdict === 'unknown').length,
    na: rows.filter(r => r.verdict === 'na').length,
  };

  // Framework coverage gaps
  const gaps = controls
    .filter(ctrl => rows.find(r => r.id === ctrl.id)?.verdict === 'fail')
    .flatMap(ctrl => Object.entries(ctrl.mappings ?? {}).map(([fw, refs]) => ({ fw, refs })));

  // Portfolio weight: na excluded; unknown counted in total but not pass (same as computeScore)
  for (const r of rows) {
    if (r.verdict === 'na') continue;
    const w = SEVERITY_WEIGHT[r.severity] ?? 1;
    portfolioTotalW += w;
    if (r.verdict === 'pass') portfolioPassW += w;
  }

  ventureMap[venture.id] = {
    ...venture,
    readiness,
    counts,
    rows,
    gaps,
  };
}

const portfolioScore = portfolioTotalW === 0 ? 100 : Math.round((portfolioPassW / portfolioTotalW) * 100);

const posture = {
  generatedAt: now,
  ventures: ventureMap,
  portfolio: {
    readiness: portfolioScore,
    ventureCount: ventures.length,
    p0Open,
  },
};

mkdirSync(EVIDENCE, { recursive: true });
mkdirSync(WEB, { recursive: true });
writeFileSync(join(EVIDENCE, 'posture.json'), JSON.stringify(posture, null, 2));
writeFileSync(join(WEB, 'posture.json'), JSON.stringify(posture, null, 2));

// Print summary
console.log('=== Portfolio compliance posture ===');
console.log(`Portfolio readiness: ${portfolioScore}%   |   Open P0s: ${p0Open}`);
for (const [, v] of Object.entries(ventureMap)) {
  const c = v.counts;
  const line = `  ${String(v.readiness).padStart(3)}%  ${v.name.padEnd(42)} pass ${c.pass} / fail ${c.fail} / unknown ${c.unknown}`;
  console.log(line);
}
console.log('');
console.log(`wrote ${join(EVIDENCE, 'posture.json')}`);
