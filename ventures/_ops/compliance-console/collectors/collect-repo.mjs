#!/usr/bin/env node
/**
 * collect-repo.mjs — filesystem-based signal collector.
 * Scans each venture's local repo directory for:
 *   policyPresent:*    — policy/compliance doc filenames
 *   evidencePresent:*  — evidence artifact files
 *   httpsEnforced      — HTTPS/TLS config in source files
 *   noHardcodedSecrets — no real secrets in source
 *   privacyPolicyPresent — privacy page exists
 *   phiAiVertexOnly    — no non-Vertex AI calls in PHI-handling code
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/Aggarwal';
const EVIDENCE_DIR = join(ROOT, 'evidence');

const ventures = JSON.parse(readFileSync(join(ROOT, 'data', 'ventures.json'), 'utf8'));
const existing = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'evidence', 'signals.json'), 'utf8')); }
  catch { return { collectedAt: null, bundles: { repo: {}, github: {}, deps: {}, gcp: {} } }; }
})();

// Placeholder / dev-sentinel strings — skip these for secret detection
const PLACEHOLDER_WORDS = [
  'placeholder', 'probe', 'dummy', 'fake', 'example', 'sample',
  'no-openai', 'sentinel', 'test', 'redacted', 'changeme', 'your-key-here',
];
function isPlaceholder(s) {
  const low = s.toLowerCase();
  return PLACEHOLDER_WORDS.some(w => low.includes(w));
}

function isTestFile(fp) {
  const parts = fp.replace(/\\/g, '/').split('/');
  return parts.some(p =>
    p === '__tests__' || p === 'test' || p === 'tests' ||
    p === 'fixtures' || p === 'mocks' || p === '__mocks__' || p === 'scripts' ||
    p === 'script'   // build scripts (esbuild/vite configs, deploy helpers)
  ) || /\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(fp);
}

// Documentation/non-code files — skip for PHI AI egress (OpenAI mentions in docs ≠ live call)
function isDocFile(fp) {
  const parts = fp.replace(/\\/g, '/').split('/');
  if (parts.some(p => p === 'docs' || p === 'doc')) return true;
  const base = parts[parts.length - 1].toLowerCase();
  return /^(replit|readme|changelog|contributing|architecture|design)\.(md|txt|rst)$/.test(base);
}

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9]{20,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /AIza[0-9A-Za-z\-_]{35}/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\n[A-Za-z0-9+/\r\n]{30}/,
];

// Line-context patterns that indicate a match is a public/non-secret value
const PUBLIC_CONTEXT_PATTERNS = [
  /VITE_/,           // Vite frontend env vars are always public (baked into bundle)
  /NEXT_PUBLIC_/,    // Next.js public env vars
  /REACT_APP_/,      // Create React App public env vars
  /EXPO_PUBLIC_/,    // Expo public env vars
];

const NON_TEXT_EXTS = new Set([
  '.png','.jpg','.jpeg','.gif','.svg','.ico','.webp',
  '.mp4','.mp3','.woff','.woff2','.ttf','.eot',
  '.zip','.gz','.tar','.pdf','.docx','.xlsx',
  '.lock','.bin','.exe','.dll','.so','.dylib','.map',
]);

function walkDir(dir, maxFiles = 5000) {
  const files = [];
  const SKIP_DIRS = new Set(['node_modules','dist','build','.git','coverage','__pycache__','vendor','.next','.expo']);
  function walk(d) {
    if (files.length >= maxFiles) return;
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.github') continue;
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(dir);
  return files;
}

function resolveRepo(repoPath) {
  if (repoPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(repoPath)) return repoPath;
  return join(HOME, repoPath);
}

const POLICY_DIRS = ['compliance/policies', 'docs/policies', 'policies', 'compliance'];
const POLICY_KEYWORDS = {
  'information-security': ['information-security', 'infosec'],
  'risk-assessment': ['risk-assessment', 'risk_assessment'],
  'incident-response': ['incident-response', 'incident_response'],
  'access-control': ['access-control', 'access_control'],
  'change-management': ['change-management', 'change_management'],
  'data-classification': ['data-classification', 'data_classification'],
  'business-continuity': ['business-continuity', 'business_continuity', 'bcp', 'dr-plan'],
  'acceptable-use': ['acceptable-use', 'acceptable_use'],
  'vendor-management': ['vendor-management', 'vendor_management'],
  'cryptography': ['cryptography', 'crypto-policy'],
  'vulnerability': ['vulnerability-management', 'vuln-management'],
};

function detectPolicies(repoDir) {
  const found = {};
  for (const [key, keywords] of Object.entries(POLICY_KEYWORDS)) {
    for (const dir of POLICY_DIRS) {
      const d = join(repoDir, dir);
      if (!existsSync(d)) continue;
      try {
        const files = readdirSync(d);
        const match = files.find(f => keywords.some(kw => f.toLowerCase().includes(kw)));
        if (match) { found[key] = join(d, match).replace(HOME, '~'); break; }
      } catch { continue; }
    }
  }
  return found;
}

const EVIDENCE_FILES = {
  'vendor-baa-register': [f => f === 'vendor-baa-register.md'],
  'retention-schedule':  [f => f === 'retention-schedule.md'],
  'ai-model-inventory':  [f => f === 'ai-model-inventory.md'],
  'ai-hitl':             [f => f === 'ai-hitl-evidence.md'],
  'control-ownership':   [f => f === 'control-ownership-matrix.md'],
  'access-review':       [f => /access-review/i.test(f) || /Q\d-\d{4}-access-review/.test(f)],
  'uptime-monitoring':   [f => f === 'uptime-monitoring-slo.md'],
  'shared-responsibility':[f => f === 'gcp-shared-responsibility-attestation.md'],
  'security-awareness':  [f => f === 'security-awareness-training-record.md'],
};

function findEvidenceFile(name, venture) {
  const searchDirs = [
    join(EVIDENCE_DIR, venture.id),
    join(EVIDENCE_DIR, 'shared'),
    join(EVIDENCE_DIR, 'aco'),
  ];
  const predicates = EVIDENCE_FILES[name];
  if (!predicates) return null;
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    try {
      const files = readdirSync(dir);
      const match = files.find(f => predicates.some(p => p(f)));
      if (match) return join(dir, match).replace(HOME, '~');
    } catch { continue; }
  }
  return null;
}

const HTTPS_PATTERNS = [
  /https:\/\//,
  /hsts/i,
  /forceHttps/i,
  /httpsRedirect/i,
  /redirect_to_https/i,
  /canonical.*https/i,
  /href=["']https:/i,
  /requireSsl/i,
];

function detectHttpsEnforced(files) {
  let count = 0;
  for (const fp of files) {
    const ext = extname(fp).toLowerCase();
    if (NON_TEXT_EXTS.has(ext)) continue;
    try {
      const content = readFileSync(fp, 'utf8');
      if (HTTPS_PATTERNS.some(p => p.test(content))) count++;
    } catch { continue; }
  }
  return count;
}

function detectSecrets(files) {
  const hits = [];
  for (const fp of files) {
    if (isTestFile(fp)) continue;
    const ext = extname(fp).toLowerCase();
    if (NON_TEXT_EXTS.has(ext)) continue;
    let content;
    try { content = readFileSync(fp, 'utf8'); } catch { continue; }
    for (const line of content.split('\n')) {
      // Skip lines that are clearly public frontend env vars
      if (PUBLIC_CONTEXT_PATTERNS.some(p => p.test(line))) continue;
      for (const pat of SECRET_PATTERNS) {
        const m = line.match(pat);
        if (m && !isPlaceholder(m[0])) {
          hits.push({ file: fp.replace(HOME, '~'), match: m[0].slice(0, 20) + '…' });
          break;
        }
      }
      if (hits.some(h => h.file === fp.replace(HOME, '~'))) break;
    }
  }
  return hits;
}

// Patterns that indicate a file is importing/using the REAL OpenAI SDK (not a compat shim).
// A compat shim is imported from a relative path like "./openai-compat" — those are fine.
// We only flag bare-specifier 'openai' imports (no leading ./ or ../) that are on actual
// import/require lines (not inside comments).
const REAL_OPENAI_IMPORT = /^(?!.*\/\/.*$)\s*(?:import\s|const\s|let\s|var\s).*\bfrom\s+["']openai["']/m;
const OPENAI_PATTERNS = [
  REAL_OPENAI_IMPORT,                          // bare 'openai' specifier = real SDK
  /openai\.com\/v1/,                           // direct API URL hardcoded
  /InvokeLLM\(/,                               // Base44 pattern (routes to Anthropic)
  /anthropic\.messages\.create/,               // direct Anthropic SDK call
];
// Files whose whole purpose is guarding the PHI-AI boundary — skip them
const PHI_GUARD_PATTERNS = [/phi-ai-boundary/, /vertex-openai/, /openai-compat/];
const VERTEX_PATTERNS = [
  /vertexAI|VertexAI|@google-cloud\/aiplatform|gemini-|generativelanguage/i,
  // Configurable baseURL → OpenAI SDK used as a Vertex-compat proxy (not direct OpenAI)
  /AI_INTEGRATIONS_OPENAI_BASE_URL/,
  // Import from a known Vertex-routed audio client (common PHR shim pattern)
  /replit_integrations\/audio\/client/,
];

function detectPhiAiEgress(files) {
  const hits = [];
  for (const fp of files) {
    if (isTestFile(fp)) continue;
    if (isDocFile(fp)) continue;
    const fpNorm = fp.replace(/\\/g, '/');
    if (PHI_GUARD_PATTERNS.some(p => p.test(fpNorm))) continue;
    const ext = extname(fp).toLowerCase();
    if (NON_TEXT_EXTS.has(ext)) continue;
    let content;
    try { content = readFileSync(fp, 'utf8'); } catch { continue; }
    if (OPENAI_PATTERNS.some(p => p.test(content))) {
      if (!VERTEX_PATTERNS.some(p => p.test(content))) hits.push(fp.replace(HOME, '~'));
    }
  }
  return hits;
}

const PRIVACY_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.html', '.htm', '.md']);
function detectPrivacyPage(files) {
  return files.find(fp => {
    const name = basename(fp).toLowerCase();
    return /privacy/.test(name) && PRIVACY_EXTS.has(extname(fp).toLowerCase());
  }) ?? null;
}

// --- Main collection loop ---
const repoBundle = {};
for (const venture of ventures) {
  const repoDir = resolveRepo(venture.repo);
  const signals = {};
  const missingDetail = `repo not found: ${repoDir}`;

  if (!existsSync(repoDir)) {
    for (const key of Object.keys(POLICY_KEYWORDS)) signals[`policyPresent:${key}`] = { verdict: 'unknown', detail: missingDetail };
    for (const key of Object.keys(EVIDENCE_FILES)) signals[`evidencePresent:${key}`] = { verdict: 'unknown', detail: 'repo not found' };
    signals.httpsEnforced      = { verdict: 'unknown', detail: missingDetail };
    signals.noHardcodedSecrets = { verdict: 'unknown', detail: missingDetail };
    signals.privacyPolicyPresent = { verdict: 'unknown', detail: missingDetail };
    signals.phiAiVertexOnly = venture.phi === 'high' ? { verdict: 'unknown', detail: missingDetail } : { verdict: 'na', detail: 'not a high-PHI app' };
    repoBundle[venture.id] = { signals };
    continue;
  }

  const allFiles = walkDir(repoDir);

  const policies = detectPolicies(repoDir);
  for (const [key] of Object.entries(POLICY_KEYWORDS)) {
    signals[`policyPresent:${key}`] = policies[key]
      ? { verdict: 'pass', detail: policies[key] }
      : { verdict: 'unknown', detail: `no ${key} policy found in compliance/policies/` };
  }

  for (const key of Object.keys(EVIDENCE_FILES)) {
    const fp = findEvidenceFile(key, venture);
    signals[`evidencePresent:${key}`] = fp
      ? { verdict: 'pass', detail: fp }
      : { verdict: 'unknown', detail: `${key} evidence not found` };
  }

  const httpsCount = detectHttpsEnforced(allFiles);
  signals.httpsEnforced = httpsCount > 0
    ? { verdict: 'pass', detail: `TLS/HSTS enforcement found (${httpsCount} site(s))` }
    : { verdict: 'fail', detail: 'no HTTPS enforcement patterns found' };

  const secretHits = detectSecrets(allFiles);
  signals.noHardcodedSecrets = secretHits.length === 0
    ? { verdict: 'pass', detail: 'no hardcoded-secret patterns matched' }
    : { verdict: 'fail', detail: `secret pattern(s) found: ${secretHits.map(h => h.file).join(', ')}` };

  const privacyFile = detectPrivacyPage(allFiles);
  signals.privacyPolicyPresent = privacyFile
    ? { verdict: 'pass', detail: privacyFile.replace(HOME, '~') }
    : { verdict: 'fail', detail: 'no privacy page found' };

  if (venture.phi !== 'high') {
    signals.phiAiVertexOnly = { verdict: 'na', detail: 'not a high-PHI app' };
  } else {
    const hits = detectPhiAiEgress(allFiles);
    signals.phiAiVertexOnly = hits.length === 0
      ? { verdict: 'pass', detail: 'no non-Vertex AI calls in PHI handling paths' }
      : { verdict: 'fail', detail: `non-Vertex AI call(s) in PHI handling: ${hits.slice(0, 3).join(', ')}` };
  }

  repoBundle[venture.id] = { signals };
}

existing.bundles.repo = repoBundle;
existing.collectedAt = new Date().toISOString();
writeFileSync(join(ROOT, 'evidence', 'signals.json'), JSON.stringify(existing, null, 2));
console.log(`  repo signals written for ${ventures.length} ventures`);
