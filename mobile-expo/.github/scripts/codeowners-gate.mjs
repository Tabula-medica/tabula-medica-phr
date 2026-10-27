// CODEOWNERS gate-check decision logic.
//
// WHAT THIS IS
// ------------
// The pure, side-effect-free brain of `.github/workflows/codeowners-gate-check.yml`.
// That workflow weekly-asserts that the Security review gate behind
// `.trivyignore.yaml` is actually enforced on the GitHub side: that `main`
// branch protection requires code-owner reviews, and that the team named in
// `.github/CODEOWNERS` exists and has >= 1 member.
//
// The non-trivial parts of that decision — a CODEOWNERS last-match-wins glob
// parser, the canonical-org skip logic, and the 401/403-vs-404 branch handling
// when reading branch protection / team membership — used to live inline in an
// `actions/github-script` step. Inline workflow JS cannot be unit-tested, so a
// regression there would let the weekly check pass green while the gate is
// actually broken — silently defeating its entire purpose.
//
// This module extracts that logic so it can be exercised against fixtures (see
// `.github/scripts/codeowners-gate.test.mjs`). All GitHub API I/O is injected
// via the `getBranchProtection` / `listTeamMembers` callbacks so the decision
// logic can be tested with no network and no GitHub token.
//
// The workflow is a thin adapter: it reads `.github/CODEOWNERS` from disk,
// wires the two callbacks to `github.rest.*`, calls `evaluateGate()`, then
// renders `formatSummary()` and sets step outputs.

// Translate a CODEOWNERS path pattern into an anchored RegExp. Mirrors GitHub's
// gitignore-style matching closely enough for the single target path this gate
// cares about: `*` matches within a path segment, `**` spans segments, a
// leading `/` anchors to the repo root, and an unanchored pattern may match at
// any depth.
export function globToRegExp(pattern) {
  let p = String(pattern).trim();
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  const re = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex specials (keep * ?)
    .replace(/\*\*/g, '\u0000')           // placeholder for **
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp('^' + (anchored ? '' : '(.*/)?') + re + '(/.*)?$');
}

// Parse the owning entries for `target` from CODEOWNERS text using GitHub's
// last-matching-rule-wins semantics. Returns the matched owners (entries that
// start with `@`) and the pattern that won, or `{ owners: null }` when nothing
// matched. `codeownersText` may be null/empty (file missing) — handled by the
// caller, which records that as its own failure.
export function parseOwners(codeownersText, target) {
  let owners = null;
  let matchedPattern = null;
  for (const rawLine of String(codeownersText || '').split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const pattern = parts[0];
    const lineOwners = parts.slice(1).filter((o) => o.startsWith('@'));
    try {
      if (globToRegExp(pattern).test(target)) {
        owners = lineOwners;
        matchedPattern = pattern;
      }
    } catch (_) {
      /* ignore an unparseable pattern */
    }
  }
  return { owners, matchedPattern };
}

// Evaluate whether the CODEOWNERS gate is enforced.
//
// Inputs:
//   codeownersText      string|null — contents of `.github/CODEOWNERS`, or null
//                       if the file is missing.
//   target              the path the gate protects (e.g. `.trivyignore.yaml`).
//   branch              the protected branch to check (e.g. `main`).
//   repoOwner           context.repo.owner — the org the workflow runs in.
//   getBranchProtection async () => protection-data. MUST throw an error with a
//                       numeric `.status` (404 / 403 / 401 / other) to signal an
//                       API failure, mirroring Octokit's request errors.
//   listTeamMembers     async (org, slug) => array of members. Same `.status`
//                       error contract as above.
//
// Returns a structured verdict: `{ ok, skipped, failures, notes, owners,
// matchedPattern, expectedOrgs, repoOwner, target, branch }`. Never throws for
// expected API failures — those become entries in `failures`.
export async function evaluateGate({
  codeownersText,
  target,
  branch,
  repoOwner,
  getBranchProtection,
  listTeamMembers,
}) {
  const failures = [];
  const notes = [];

  // --- 1. Parse the owning team(s) from CODEOWNERS ------------------------
  const codeownersMissing = codeownersText === null || codeownersText === undefined;
  if (codeownersMissing) {
    failures.push(
      '`.github/CODEOWNERS` is missing — there is no rule routing `' +
        target +
        '` to Security at all.'
    );
  }

  const { owners, matchedPattern } = parseOwners(codeownersText, target);

  if (!codeownersMissing && (!owners || owners.length === 0)) {
    failures.push(
      'No CODEOWNERS rule matches `' +
        target +
        '` (last-match-wins) — a change to the suppression file would NOT auto-request any reviewer.'
    );
  }

  const teamOwners = (owners || []).filter((o) => o.includes('/')); // @org/team
  const userOwners = (owners || []).filter((o) => o.startsWith('@') && !o.includes('/'));
  if (owners && owners.length > 0 && teamOwners.length === 0) {
    notes.push(
      'CODEOWNERS rule `' +
        matchedPattern +
        '` owns `' +
        target +
        '` via individual user(s) (' +
        userOwners.join(', ') +
        ') rather than a team — membership cannot be verified here; ensure those accounts are active.'
    );
  }

  // --- Skip on forks / non-canonical orgs --------------------------------
  // The branch-protection and org-team APIs are meaningless on a fork under a
  // different owner and would page the fork maintainer for a control that only
  // matters in the canonical org. Determine the canonical org from the
  // CODEOWNERS team owner and bail out cleanly if we're not running there.
  const expectedOrgs = new Set(
    teamOwners.map((o) => o.replace(/^@/, '').split('/')[0].toLowerCase())
  );
  if (expectedOrgs.size > 0 && !expectedOrgs.has(String(repoOwner).toLowerCase())) {
    return {
      ok: true,
      skipped: true,
      failures: [],
      notes: [],
      owners,
      matchedPattern,
      expectedOrgs: [...expectedOrgs],
      repoOwner,
      target,
      branch,
    };
  }

  // --- 2. Branch protection on the branch requires code-owner reviews ----
  try {
    const protection = await getBranchProtection();
    const prReviews = protection && protection.required_pull_request_reviews;
    if (!prReviews) {
      failures.push(
        'Branch protection on `' +
          branch +
          '` has no `required_pull_request_reviews` block — pull-request review is not required at all, so CODEOWNERS cannot gate anything.'
      );
    } else {
      if (prReviews.require_code_owner_reviews !== true) {
        failures.push(
          'Branch protection on `' +
            branch +
            '` does NOT have "Require review from Code Owners" enabled (`require_code_owner_reviews = ' +
            prReviews.require_code_owner_reviews +
            '`). A PR author could self-approve a `' +
            target +
            '` change.'
        );
      }
      // Required approving review count must be >= 1. With a count of 0 the
      // code-owner routing still auto-requests Security, but no approval is
      // actually REQUIRED to merge — a PR author could merge a
      // `.trivyignore.yaml` change with zero reviews, silently defeating the
      // gate.
      const reviewCount = prReviews.required_approving_review_count;
      if (typeof reviewCount !== 'number' || reviewCount < 1) {
        failures.push(
          'Branch protection on `' +
            branch +
            '` requires `' +
            reviewCount +
            '` approving review(s) (`required_approving_review_count`). With fewer than 1 required approval, a `' +
            target +
            '` change can be merged with no code-owner review at all.'
        );
      }
    }
    // `enforce_admins` must be on, otherwise a repo admin can merge a
    // `.trivyignore.yaml` change bypassing the code-owner review gate
    // entirely. This is the silent admin-bypass the gate must catch.
    const enforceAdmins = protection && protection.enforce_admins && protection.enforce_admins.enabled;
    if (enforceAdmins !== true) {
      failures.push(
        'Branch protection on `' +
          branch +
          '` does NOT enforce rules for administrators (`enforce_admins.enabled = ' +
          (protection && protection.enforce_admins ? protection.enforce_admins.enabled : undefined) +
          '`). A repo admin could merge a `' +
          target +
          '` change bypassing the code-owner review gate.'
      );
    }
  } catch (e) {
    if (e.status === 404) {
      failures.push(
        'Branch `' +
          branch +
          '` has NO branch-protection rule (GitHub API 404). CODEOWNERS is unenforced — anyone can merge a `' +
          target +
          '` change without review.'
      );
    } else if (e.status === 403 || e.status === 401) {
      failures.push(
        'Could not read branch protection for `' +
          branch +
          '` (HTTP ' +
          e.status +
          '). The token lacks repo-administration access — set the `SECURITY_GATE_GITHUB_TOKEN` secret to a PAT/App token with repo administration + `read:org` so this check can verify the gate.'
      );
    } else {
      failures.push(
        'Error reading branch protection for `' +
          branch +
          '`: ' +
          (e.status || '') +
          ' ' +
          e.message
      );
    }
  }

  // --- 3. Each owning team exists and has >= 1 member --------------------
  for (const owner of teamOwners) {
    const [org, slug] = owner.replace(/^@/, '').split('/');
    try {
      const members = await listTeamMembers(org, slug);
      if (!members || members.length === 0) {
        failures.push(
          'Team `' +
            owner +
            '` exists but has 0 members — code-owner review can never be satisfied, effectively disabling the gate.'
        );
      }
    } catch (e) {
      if (e.status === 404) {
        failures.push(
          'Team `' +
            owner +
            '` does not exist (HTTP 404) — the CODEOWNERS slug may have been renamed or deleted. GitHub silently ignores an unknown owner, so the gate is unenforced.'
        );
      } else if (e.status === 403 || e.status === 401) {
        failures.push(
          'Could not read membership for team `' +
            owner +
            '` (HTTP ' +
            e.status +
            '). The token lacks `read:org` — set the `SECURITY_GATE_GITHUB_TOKEN` secret to a token with `read:org`.'
        );
      } else {
        failures.push(
          'Error reading membership for team `' +
            owner +
            '`: ' +
            (e.status || '') +
            ' ' +
            e.message
        );
      }
    }
  }

  return {
    ok: failures.length === 0,
    skipped: false,
    failures,
    notes,
    owners,
    matchedPattern,
    expectedOrgs: [...expectedOrgs],
    repoOwner,
    target,
    branch,
  };
}

// Render the GitHub step-summary markdown for a verdict from `evaluateGate()`.
// Handles both the skipped (non-canonical-org) case and the normal pass/fail
// case. Pure: returns a string, performs no I/O.
export function formatSummary(result) {
  if (result.skipped) {
    return (
      '## CODEOWNERS gate verification\n\nSkipped: this repository (`' +
      result.repoOwner +
      '`) is not the canonical org (`' +
      (result.expectedOrgs || []).join(', ') +
      '`) that owns the suppression gate. Nothing to verify here.'
    );
  }

  const owners = result.owners;
  const lines = ['## CODEOWNERS gate verification', ''];
  lines.push('Target file: `' + result.target + '`');
  lines.push(
    'Owners (from CODEOWNERS): ' + (owners && owners.length ? owners.join(', ') : '_none_')
  );
  lines.push('');
  if (result.ok) {
    lines.push(
      ':white_check_mark: The CODEOWNERS gate is enforced: `' +
        result.branch +
        '` branch protection requires code-owner reviews (>= 1 approving review), is enforced for administrators, and every owning team has members.'
    );
  } else {
    lines.push(':x: The CODEOWNERS gate is NOT fully enforced:');
    lines.push('');
    for (const f of result.failures) lines.push('- ' + f);
  }
  if (result.notes && result.notes.length) {
    lines.push('', '### Notes', '');
    for (const n of result.notes) lines.push('- ' + n);
  }
  return lines.join('\n');
}
