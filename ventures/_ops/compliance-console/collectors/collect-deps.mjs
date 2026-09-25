#!/usr/bin/env node
/**
 * collect-deps.mjs — dependency vulnerability scanner.
 * Runs npm/pnpm audit for each venture repo and emits noCriticalVulns signal.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/Aggarwal';

const ventures = JSON.parse(readFileSync(join(ROOT, 'data', 'ventures.json'), 'utf8'));
const existing = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'evidence', 'signals.json'), 'utf8')); }
  catch { return { collectedAt: null, bundles: { repo: {}, github: {}, deps: {}, gcp: {} } }; }
})();

function resolveRepo(repoPath) {
  if (repoPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(repoPath)) return repoPath;
  return join(HOME, repoPath);
}

function detectPkgManager(repoDir) {
  if (existsSync(join(repoDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(repoDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(repoDir, 'package.json'))) return 'npm';
  return null;
}

function scoreAudit(raw, isPnpm) {
  // pnpm 10 emits [WARN] / [NOTICE] lines to stdout before the JSON — strip them
  const clean = raw.split('\n')
    .filter(l => !l.trimStart().startsWith('[WARN]') && !l.trimStart().startsWith('[NOTICE]'))
    .join('\n');
  let parsed;
  try { parsed = JSON.parse(clean); } catch { return { verdict: 'unknown', detail: 'could not parse audit JSON' }; }

  // npm / pnpm JSON structure
  const vulns = parsed.vulnerabilities ?? parsed.advisories ?? {};
  let critical = 0, high = 0, moderate = 0, low = 0;

  if (Array.isArray(Object.values(vulns)[0])) {
    // pnpm format: { advisories: [ { severity: 'critical', ... } ] } or similar
    for (const v of Object.values(vulns).flat()) {
      const sev = (v.severity || '').toLowerCase();
      if (sev === 'critical') critical++;
      else if (sev === 'high') high++;
      else if (sev === 'moderate') moderate++;
      else if (sev === 'low') low++;
    }
  } else {
    for (const v of Object.values(vulns)) {
      const sev = (v.severity || '').toLowerCase();
      if (sev === 'critical') critical++;
      else if (sev === 'high') high++;
      else if (sev === 'moderate') moderate++;
      else if (sev === 'low') low++;
    }
  }

  const actionable = critical + high;
  if (actionable === 0) {
    return { verdict: 'pass', detail: `0 prod high/critical (moderate ${moderate}, low ${low})` };
  }
  return { verdict: 'fail', detail: `${critical} critical + ${high} high (${actionable} actionable)` };
}

const depsBundle = {};

for (const venture of ventures) {
  const repoDir = resolveRepo(venture.repo);

  if (!existsSync(repoDir)) {
    depsBundle[venture.id] = { signals: { noCriticalVulns: { verdict: 'unknown', detail: 'repo not found' } } };
    continue;
  }

  if (venture.archived) {
    depsBundle[venture.id] = { signals: { noCriticalVulns: { verdict: 'na', detail: 'archived/cancelled repo — no active prod service to patch' } } };
    continue;
  }

  const pm = detectPkgManager(repoDir);
  if (!pm) {
    // No package manager = static site or infra-only repo → control doesn't apply
    depsBundle[venture.id] = { signals: { noCriticalVulns: { verdict: 'na', detail: 'no dependency manifest (static/infra-only repo)' } } };
    continue;
  }

  const cmd = pm === 'pnpm' ? 'pnpm audit --json --prod'
             : pm === 'yarn' ? 'yarn audit --json 2>/dev/null'
             : 'npm audit --json --omit=dev';

  let result;
  try {
    const raw = execSync(cmd, { cwd: repoDir, timeout: 60000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
    result = scoreAudit(raw, pm === 'pnpm');
  } catch (e) {
    // npm/pnpm audit exits non-zero when vulns exist — output is still valid JSON on stdout
    const out = (e.stdout || '').toString();
    if (out.trim().length > 0) {
      result = scoreAudit(out, pm === 'pnpm');
    } else {
      result = { verdict: 'unknown', detail: `audit failed: ${e.message.slice(0, 80)}` };
    }
  }

  depsBundle[venture.id] = { signals: { noCriticalVulns: result } };
}

existing.bundles.deps = depsBundle;
existing.collectedAt = new Date().toISOString();
writeFileSync(join(ROOT, 'evidence', 'signals.json'), JSON.stringify(existing, null, 2));
console.log(`  deps signals written for ${ventures.length} ventures`);
