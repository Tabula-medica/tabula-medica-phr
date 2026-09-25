// Shared scoring utilities for compliance-console engine.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

export const SEVERITY_WEIGHT = { P0: 5, P1: 3, P2: 1 };

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(__dir, '..', rel), 'utf8'));
}

export function loadVentures() {
  return loadJson('data/ventures.json');
}

export function loadControls() {
  return loadJson('data/controls.json');
}

/**
 * Load the latest signals from evidence/signals.json.
 */
export function loadSignals(evidenceDir) {
  return JSON.parse(readFileSync(join(evidenceDir, 'signals.json'), 'utf8'));
}

/**
 * Resolve a signal verdict for a control + venture from the signals bundle.
 * Returns { verdict, detail } where verdict is 'pass'|'fail'|'unknown'|'na'.
 */
export function resolveSignal(ctrl, venture, bundles) {
  // AIG-02 (phiAiVertexOnly) only scored for PHI-high ventures
  if (ctrl.phiOnly && venture.phi !== 'high') {
    return { verdict: 'na', detail: 'not a high-PHI app' };
  }

  if (!ctrl.signal || ctrl.source === 'manual') {
    return { verdict: 'unknown', detail: 'manual attestation required — narrative/evidence to be provided by owner' };
  }

  const bundle = bundles[ctrl.source];
  if (!bundle) return { verdict: 'unknown', detail: `${ctrl.source} bundle not collected` };

  const ventureBundle = bundle[venture.id];
  if (!ventureBundle) return { verdict: 'unknown', detail: `${ctrl.source} signals not available for ${venture.id}` };

  const sig = ventureBundle.signals?.[ctrl.signal];
  if (!sig) return { verdict: 'unknown', detail: `signal ${ctrl.signal} not found` };

  return { verdict: sig.verdict, detail: sig.detail };
}

/**
 * Compute readiness score (0-100) for a set of control rows.
 * na: excluded entirely.  unknown: counts in denominator but NOT numerator.
 * pass: counts in both. fail: counts in denominator only.
 */
export function computeScore(rows) {
  let passW = 0, totalW = 0;
  for (const r of rows) {
    if (r.verdict === 'na') continue;           // n/a: excluded
    const w = SEVERITY_WEIGHT[r.severity] ?? 1;
    totalW += w;                                // pass, fail, unknown all count toward total
    if (r.verdict === 'pass') passW += w;       // only pass counts toward numerator
  }
  return totalW === 0 ? 100 : Math.round((passW / totalW) * 100);
}
