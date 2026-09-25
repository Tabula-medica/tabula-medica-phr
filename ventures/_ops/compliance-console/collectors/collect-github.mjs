#!/usr/bin/env node
/**
 * collect-github.mjs — GitHub API signal collector.
 * Uses `gh api` to check: branchProtection, secretScanning, codeScanning, ciTests.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');

const ventures = JSON.parse(readFileSync(join(ROOT, 'data', 'ventures.json'), 'utf8'));
const existing = (() => {
  try { return JSON.parse(readFileSync(join(ROOT, 'evidence', 'signals.json'), 'utf8')); }
  catch { return { collectedAt: null, bundles: { repo: {}, github: {}, deps: {}, gcp: {} } }; }
})();

function ghApi(path) {
  try {
    const raw = execSync(`gh api "${path}"`, { timeout: 15000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(raw);
  } catch { return null; }
}

function checkBranchProtection(slug, defaultBranch) {
  // First try classic branch protection
  const rule = ghApi(`repos/${slug}/branches/${defaultBranch}/protection`);
  if (rule) {
    const reviews = rule.required_pull_request_reviews;
    if (reviews?.required_approving_review_count >= 1) {
      return { verdict: 'pass', detail: `${defaultBranch}: required PR reviews on (${reviews.required_approving_review_count} approval)` };
    }
    // Classic protection exists but no required reviews — fall through to check rulesets
  }

  // Check aggregated branch rules (covers org/repo rulesets including SOC2 peer-review ruleset)
  const branchRules = ghApi(`repos/${slug}/rules/branches/${defaultBranch}`);
  if (Array.isArray(branchRules)) {
    const prRule = branchRules.find(r => r.type === 'pull_request' && (r.parameters?.required_approving_review_count ?? 0) >= 1);
    if (prRule) {
      return { verdict: 'pass', detail: `${defaultBranch}: PR review enforced via ruleset (${prRule.parameters.required_approving_review_count} approval)` };
    }
    // Rulesets exist but no PR review requirement
    if (branchRules.length > 0 || rule) {
      return { verdict: 'fail', detail: `${defaultBranch}: protection exists but required PR reviews NOT configured` };
    }
  }

  if (!rule) {
    return { verdict: 'fail', detail: `no branch protection on ${defaultBranch}` };
  }
  return { verdict: 'fail', detail: `${defaultBranch}: protection exists but required PR reviews NOT set` };
}


function checkCodeScanning(slug) {
  const analyses = ghApi(`repos/${slug}/code-scanning/analyses?per_page=1`);
  if (analyses?.length > 0) return { verdict: 'pass', detail: 'code-scanning analyses present' };
  return { verdict: 'fail', detail: 'no code-scanning analyses found' };
}

function checkCiWorkflows(slug) {
  const workflows = ghApi(`repos/${slug}/actions/workflows`);
  const count = workflows?.total_count ?? workflows?.workflows?.length ?? 0;
  if (count > 0) return { verdict: 'pass', detail: `${count} workflow(s) configured` };
  return { verdict: 'fail', detail: 'no GitHub Actions workflows found' };
}

const githubBundle = {};

for (const venture of ventures) {
  const slug = venture.github;
  if (!slug) {
    githubBundle[venture.id] = {
      signals: {
        branchProtection: { verdict: 'unknown', detail: 'no GitHub repo configured' },
        secretScanning:   { verdict: 'unknown', detail: 'no GitHub repo configured' },
        codeScanning:     { verdict: 'unknown', detail: 'no GitHub repo configured' },
        ciTests:          { verdict: 'unknown', detail: 'no GitHub repo configured' },
      },
      meta: { slug: null, available: false },
    };
    continue;
  }

  // Get repo info (used for default branch + secret scanning)
  const repoInfo = ghApi(`repos/${slug}`);
  if (!repoInfo) {
    githubBundle[venture.id] = {
      signals: {
        branchProtection: { verdict: 'unknown', detail: `GitHub API unavailable for ${slug}` },
        secretScanning:   { verdict: 'unknown', detail: `GitHub API unavailable for ${slug}` },
        codeScanning:     { verdict: 'unknown', detail: `GitHub API unavailable for ${slug}` },
        ciTests:          { verdict: 'unknown', detail: `GitHub API unavailable for ${slug}` },
      },
      meta: { slug, available: false },
    };
    continue;
  }

  const defaultBranch = repoInfo.default_branch ?? 'main';

  // secretScanning from security_and_analysis (avoid extra API call)
  const sa = repoInfo.security_and_analysis ?? {};
  const ssEnabled = sa.secret_scanning?.status === 'enabled';
  const ssPushProt = sa.secret_scanning_push_protection?.status === 'enabled';
  const secretScanningSignal = ssEnabled
    ? { verdict: 'pass', detail: `secret scanning enabled${ssPushProt ? ', push-protection enabled' : ''}` }
    : { verdict: 'fail', detail: 'secret scanning NOT enabled' };

  githubBundle[venture.id] = {
    signals: {
      branchProtection: checkBranchProtection(slug, defaultBranch),
      secretScanning:   secretScanningSignal,
      codeScanning:     checkCodeScanning(slug),
      ciTests:          checkCiWorkflows(slug),
    },
    meta: { slug, branch: defaultBranch, available: true },
  };
}

existing.bundles.github = githubBundle;
existing.collectedAt = new Date().toISOString();
writeFileSync(join(ROOT, 'evidence', 'signals.json'), JSON.stringify(existing, null, 2));
console.log(`  github signals written for ${ventures.length} ventures`);
