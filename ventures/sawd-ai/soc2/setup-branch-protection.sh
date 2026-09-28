#!/usr/bin/env bash
# SOC 2 CC8.1 — branch protection setup (OWNER runs this; needs `gh auth login` first).
#
# Enforces on the default branch of each SAWD repo:
#   - PRs required before merge (no direct pushes)
#   - >=1 approving review, stale approvals dismissed on new commits
#   - required status checks must pass (CodeQL + security gate) and be up to date
#   - no force-pushes, no branch deletion
#   - rules also apply to admins (enforce_admins) — so the control has no bypass
#
# Idempotent: re-running just re-applies the same ruleset. Adjust REQUIRED_CHECKS to match the
# exact check-run names GitHub shows on a PR (Actions tab → job name) if these differ.
set -euo pipefail

ORG="Tabula-medica"
REPOS=("sawd-web" "sawd-backend" "sawd-bank" "sawd-mobile")

# Status-check contexts that must be green before merge. These are the GitHub Actions job names;
# confirm against a recent PR's checks list. CodeQL + the security PR gate are the SOC 2-relevant ones.
REQUIRED_CHECKS='["CodeQL","security"]'

for REPO in "${REPOS[@]}"; do
  # Resolve the repo's actual default branch (main vs master vs a feature default).
  BRANCH="$(gh api "repos/${ORG}/${REPO}" --jq '.default_branch' 2>/dev/null || echo '')"
  if [[ -z "$BRANCH" ]]; then
    echo "!! skip ${ORG}/${REPO} (not found or no access)"; continue
  fi
  echo "== ${ORG}/${REPO} :: protecting '${BRANCH}'"

  # Build the required_status_checks contexts array from REQUIRED_CHECKS.
  CONTEXTS=$(echo "$REQUIRED_CHECKS" | tr -d '[]"' | tr ',' '\n' | sed 's/^/    "/;s/$/",/' )

  gh api -X PUT "repos/${ORG}/${REPO}/branches/${BRANCH}/protection" \
    -H "Accept: application/vnd.github+json" \
    --input - <<JSON || echo "!! failed on ${REPO} — check permissions/check-names"
{
  "required_status_checks": {
    "strict": true,
    "contexts": [$(echo "$CONTEXTS" | sed '$ s/,$//')]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": false,
  "required_conversation_resolution": true
}
JSON
  echo "   done."
done

echo
echo "Next: GitHub org → Settings → Authentication security → require 2FA for all members (CC6.1)."
echo "Verify in Sprinto: GitHub integration should flip branch-protection + org-2FA checks to green."
