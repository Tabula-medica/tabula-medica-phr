// Regression tests for the CODEOWNERS gate-check decision logic in
// `.github/scripts/codeowners-gate.mjs`.
//
// WHAT THIS GUARDS
// ----------------
// `.github/workflows/codeowners-gate-check.yml` weekly-asserts that the
// Security review gate behind `.trivyignore.yaml` is actually enforced on the
// GitHub side. Its decision logic — a CODEOWNERS last-match-wins glob parser,
// the canonical-org skip, and the 401/403-vs-404 branch handling — is exactly
// the kind of non-trivial code that can silently regress: if it ever returns
// `ok` when the gate is actually broken, the weekly check goes green and no one
// is paged until a pen-test or an actual self-approved CVE suppression.
//
// Because all GitHub API I/O is injected into `evaluateGate()`, every branch is
// exercised here against fixtures with no network and no token.
//
// HOW TO RUN LOCALLY
// ------------------
//   node --test .github/scripts/codeowners-gate.test.mjs
//
// Exit code is 0 on success, non-zero on any failed assertion.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  globToRegExp,
  parseOwners,
  evaluateGate,
  formatSummary,
} from './codeowners-gate.mjs';

const TARGET = '.trivyignore.yaml';
const BRANCH = 'main';
const ORG = 'tabula-medica';
const TEAM_OWNER = '@tabula-medica/security';

// Realistic CODEOWNERS fixtures.
const CO_TEAM = `# comment line\n/.trivyignore.yaml  ${TEAM_OWNER}\n`;
const CO_USER = `/.trivyignore.yaml  @alice @bob\n`;
const CO_NO_MATCH = `/some/other/path.txt  ${TEAM_OWNER}\n`;
const CO_LAST_WINS = `/.trivyignore.yaml  @tabula-medica/first\n/.trivyignore.yaml  ${TEAM_OWNER}\n`;

// --- error helpers: mirror Octokit request errors (numeric .status) --------
const httpError = (status) => {
  const e = new Error('HTTP ' + status);
  e.status = status;
  return e;
};

// --- API stub builders -----------------------------------------------------
// A fully-healthy branch-protection payload: code-owner reviews required, >= 1
// approving review required, and admin enforcement on. Individual tests flip a
// single knob via `overrides` to exercise one failure at a time.
const protection = (overrides = {}) => async () => ({
  required_pull_request_reviews: {
    require_code_owner_reviews: true,
    required_approving_review_count: 1,
    ...(overrides.prReviews === null ? {} : overrides.prReviews),
  },
  enforce_admins: { enabled: true },
  ...(overrides.top || {}),
  ...(overrides.prReviews === null ? { required_pull_request_reviews: undefined } : {}),
});
const protectionWith = (requireCodeOwner) =>
  protection({ prReviews: { require_code_owner_reviews: requireCodeOwner } });
const protectionNoReviews = protection({ prReviews: null });
const protectionThrows = (status) => async () => {
  throw httpError(status);
};
const membersReturning = (count) => async () =>
  Array.from({ length: count }, (_, i) => ({ login: 'member' + i }));
const membersThrows = (status) => async () => {
  throw httpError(status);
};

// Healthy defaults; individual tests override one knob at a time.
const healthy = {
  codeownersText: CO_TEAM,
  target: TARGET,
  branch: BRANCH,
  repoOwner: ORG,
  getBranchProtection: protectionWith(true),
  listTeamMembers: membersReturning(3),
};

// ---------------------------------------------------------------------------
// glob parsing
// ---------------------------------------------------------------------------
test('globToRegExp: anchored pattern matches the target exactly', () => {
  assert.equal(globToRegExp('/.trivyignore.yaml').test(TARGET), true);
});

test('globToRegExp: the dot is literal, not a wildcard', () => {
  assert.equal(globToRegExp('/.trivyignore.yaml').test('Xtrivyignoreyaml'), false);
});

test('globToRegExp: unanchored pattern matches at any depth', () => {
  assert.equal(globToRegExp('*.yaml').test('nested/dir/config.yaml'), true);
});

// ---------------------------------------------------------------------------
// owner parsing (last-match-wins)
// ---------------------------------------------------------------------------
test('parseOwners: returns the team owner for a matching rule', () => {
  const { owners, matchedPattern } = parseOwners(CO_TEAM, TARGET);
  assert.deepEqual(owners, [TEAM_OWNER]);
  assert.equal(matchedPattern, '/.trivyignore.yaml');
});

test('parseOwners: last matching rule wins', () => {
  const { owners } = parseOwners(CO_LAST_WINS, TARGET);
  assert.deepEqual(owners, [TEAM_OWNER]);
});

test('parseOwners: no owners when nothing matches', () => {
  const { owners } = parseOwners(CO_NO_MATCH, TARGET);
  assert.equal(owners, null);
});

// ---------------------------------------------------------------------------
// evaluateGate: the healthy baseline
// ---------------------------------------------------------------------------
test('evaluateGate: healthy gate passes with no failures', async () => {
  const r = await evaluateGate(healthy);
  assert.equal(r.ok, true);
  assert.equal(r.skipped, false);
  assert.deepEqual(r.failures, []);
});

// ---------------------------------------------------------------------------
// missing CODEOWNERS
// ---------------------------------------------------------------------------
test('evaluateGate: missing CODEOWNERS file is a failure', async () => {
  const r = await evaluateGate({ ...healthy, codeownersText: null });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('`.github/CODEOWNERS` is missing')));
});

test('evaluateGate: CODEOWNERS present but no rule matches is a failure', async () => {
  const r = await evaluateGate({ ...healthy, codeownersText: CO_NO_MATCH });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('No CODEOWNERS rule matches')));
});

// ---------------------------------------------------------------------------
// team owner vs user owner
// ---------------------------------------------------------------------------
test('evaluateGate: team owner triggers membership verification', async () => {
  let called = false;
  const r = await evaluateGate({
    ...healthy,
    codeownersText: CO_TEAM,
    listTeamMembers: async (org, slug) => {
      called = true;
      assert.equal(org, ORG);
      assert.equal(slug, 'security');
      return [{ login: 'x' }];
    },
  });
  assert.equal(called, true);
  assert.equal(r.ok, true);
});

test('evaluateGate: user owner is a note, not verified, and never calls team API', async () => {
  let called = false;
  const r = await evaluateGate({
    ...healthy,
    codeownersText: CO_USER,
    listTeamMembers: async () => {
      called = true;
      return [];
    },
  });
  assert.equal(called, false, 'team membership API must not be called for user owners');
  assert.equal(r.ok, true);
  assert.ok(r.notes.some((n) => n.includes('individual user(s)')));
  assert.ok(r.notes.some((n) => n.includes('@alice') && n.includes('@bob')));
});

// ---------------------------------------------------------------------------
// branch-protection branches
// ---------------------------------------------------------------------------
test('evaluateGate: require_code_owner_reviews=true passes', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionWith(true) });
  assert.equal(r.ok, true);
});

test('evaluateGate: require_code_owner_reviews=false fails', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionWith(false) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('Require review from Code Owners')));
});

test('evaluateGate: no required_pull_request_reviews block fails', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionNoReviews });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('no `required_pull_request_reviews` block')));
});

test('evaluateGate: branch-protection 404 (no rule) fails', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionThrows(404) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('NO branch-protection rule')));
});

test('evaluateGate: branch-protection 403 reports a missing-scope finding', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionThrows(403) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('SECURITY_GATE_GITHUB_TOKEN')));
});

test('evaluateGate: branch-protection 401 reports a missing-scope finding', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionThrows(401) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('HTTP 401')));
});

test('evaluateGate: unexpected branch-protection error is surfaced', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionThrows(500) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('Error reading branch protection')));
});

test('evaluateGate: required_approving_review_count = 0 fails', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ prReviews: { required_approving_review_count: 0 } }),
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('required_approving_review_count')));
});

test('evaluateGate: missing required_approving_review_count fails', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ prReviews: { required_approving_review_count: undefined } }),
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('required_approving_review_count')));
});

test('evaluateGate: required_approving_review_count >= 1 passes', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ prReviews: { required_approving_review_count: 2 } }),
  });
  assert.equal(r.ok, true);
});

test('evaluateGate: enforce_admins disabled fails (silent admin-bypass)', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ top: { enforce_admins: { enabled: false } } }),
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('enforce rules for administrators')));
});

test('evaluateGate: missing enforce_admins block fails', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ top: { enforce_admins: undefined } }),
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('enforce rules for administrators')));
});

test('evaluateGate: no required_pull_request_reviews block still checks enforce_admins', async () => {
  // Missing PR-reviews block AND admin enforcement off => two distinct failures.
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protection({ prReviews: null, top: { enforce_admins: { enabled: false } } }),
  });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('no `required_pull_request_reviews` block')));
  assert.ok(r.failures.some((f) => f.includes('enforce rules for administrators')));
});

// ---------------------------------------------------------------------------
// team membership branches
// ---------------------------------------------------------------------------
test('evaluateGate: team with >=1 member passes', async () => {
  const r = await evaluateGate({ ...healthy, listTeamMembers: membersReturning(1) });
  assert.equal(r.ok, true);
});

test('evaluateGate: team with 0 members fails', async () => {
  const r = await evaluateGate({ ...healthy, listTeamMembers: membersReturning(0) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('has 0 members')));
});

test('evaluateGate: team 404 (renamed/deleted slug) fails', async () => {
  const r = await evaluateGate({ ...healthy, listTeamMembers: membersThrows(404) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('does not exist (HTTP 404)')));
});

test('evaluateGate: team 403 reports a read:org scope finding', async () => {
  const r = await evaluateGate({ ...healthy, listTeamMembers: membersThrows(403) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('lacks `read:org`')));
});

test('evaluateGate: unexpected team error is surfaced', async () => {
  const r = await evaluateGate({ ...healthy, listTeamMembers: membersThrows(500) });
  assert.equal(r.ok, false);
  assert.ok(r.failures.some((f) => f.includes('Error reading membership')));
});

// ---------------------------------------------------------------------------
// non-canonical-org skip
// ---------------------------------------------------------------------------
test('evaluateGate: non-canonical org skips cleanly without calling any API', async () => {
  let touched = false;
  const r = await evaluateGate({
    ...healthy,
    repoOwner: 'some-fork-owner',
    getBranchProtection: async () => {
      touched = true;
      return {};
    },
    listTeamMembers: async () => {
      touched = true;
      return [];
    },
  });
  assert.equal(touched, false, 'no GitHub API should be hit on a non-canonical org');
  assert.equal(r.skipped, true);
  assert.equal(r.ok, true);
  assert.deepEqual(r.failures, []);
});

test('evaluateGate: org match is case-insensitive (still runs the checks)', async () => {
  const r = await evaluateGate({ ...healthy, repoOwner: 'Tabula-Medica' });
  assert.equal(r.skipped, false);
  assert.equal(r.ok, true);
});

test('evaluateGate: user-only owners have no canonical org, so checks still run', async () => {
  // No team owner => no expected org => never skipped, even on a fork.
  const r = await evaluateGate({
    ...healthy,
    codeownersText: CO_USER,
    repoOwner: 'some-fork-owner',
  });
  assert.equal(r.skipped, false);
});

// ---------------------------------------------------------------------------
// multiple failures accumulate
// ---------------------------------------------------------------------------
test('evaluateGate: branch-protection AND team failures both reported', async () => {
  const r = await evaluateGate({
    ...healthy,
    getBranchProtection: protectionWith(false),
    listTeamMembers: membersReturning(0),
  });
  assert.equal(r.ok, false);
  assert.equal(r.failures.length, 2);
});

// ---------------------------------------------------------------------------
// formatSummary
// ---------------------------------------------------------------------------
test('formatSummary: healthy verdict renders the success line', async () => {
  const r = await evaluateGate(healthy);
  const s = formatSummary(r);
  assert.ok(s.includes(':white_check_mark:'));
  assert.ok(s.includes(TEAM_OWNER));
});

test('formatSummary: failing verdict lists each failure', async () => {
  const r = await evaluateGate({ ...healthy, getBranchProtection: protectionWith(false) });
  const s = formatSummary(r);
  assert.ok(s.includes(':x:'));
  assert.ok(s.includes('Require review from Code Owners'));
});

test('formatSummary: skipped verdict explains the non-canonical-org skip', async () => {
  const r = await evaluateGate({ ...healthy, repoOwner: 'some-fork-owner' });
  const s = formatSummary(r);
  assert.ok(s.includes('Skipped'));
  assert.ok(s.includes('some-fork-owner'));
});
