#!/usr/bin/env bash
# Verify that all four critical CI gate jobs are correctly wired as required
# status checks on the `main` branch-protection rule.
#
# The four gates this script checks:
#   server-tests        — server regression tests + ci-guard-file-canary
#   jest-tests          — GCIP launch-crash guard (App Review 2.1(a))
#   reviewer-login-gate — reviewer demo-account smoke test
#   script-tests        — bash guard expansion + ci-guard-files tests
#
# This script checks two things:
#
#   1. WORKFLOW FILE — .github/workflows/ci-cd.yml contains each of the four
#      job IDs (server-tests, jest-tests, reviewer-login-gate, script-tests)
#      and the "Assert all critical CI jobs are in branch-protection" step.
#
#   2. BRANCH PROTECTION — all four check contexts are in the required-status-
#      checks list for `main`, detected in BOTH new-style .checks[] AND legacy
#      .contexts[] format.
#      - Requires GH_ADMIN_PAT (default GITHUB_TOKEN cannot read branch-
#        protection rules; see .agents/memory/github-token-admin-scopes.md).
#      - If GH_ADMIN_PAT is absent and REQUIRE_BP_CHECK=1, the job FAILS so
#        operators can't accidentally skip the API assertion in hardening
#        workflows. If GH_ADMIN_PAT is absent and REQUIRE_BP_CHECK is unset
#        (or "0"), the check is skipped with a warning — acceptable for normal
#        developer CI where no admin PAT is available.
#
# Usage in CI without admin token (check 1 only):
#   bash scripts/verify-ci-gates-branch-protection.sh
#
# Usage with admin PAT (both checks, recommended for hardening pipelines):
#   GH_ADMIN_PAT=<admin-PAT> \
#   GITHUB_REPOSITORY=<owner/repo> \
#   bash scripts/verify-ci-gates-branch-protection.sh
#
# Usage in a CI job that MUST assert branch protection (fails if no PAT):
#   REQUIRE_BP_CHECK=1 \
#   GH_ADMIN_PAT=<admin-PAT> \
#   GITHUB_REPOSITORY=<owner/repo> \
#   bash scripts/verify-ci-gates-branch-protection.sh
#
# Exit codes:
#   0 — all executed checks passed (skipped branch-protection check = pass
#       unless REQUIRE_BP_CHECK=1)
#   1 — one or more checks failed, or REQUIRE_BP_CHECK=1 and no admin PAT

set -euo pipefail

pass=0
fail=0
skip=0

ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }
warn() { echo "  SKIP  $1"; skip=$((skip+1)); }

WORKFLOW_FILE=".github/workflows/ci-cd.yml"
BRANCH="${BRANCH:-main}"
REQUIRE_BP_CHECK="${REQUIRE_BP_CHECK:-0}"

# The four critical CI gate job IDs (must match `id:` fields in ci-cd.yml).
REQUIRED_GATE_IDS=(
  "server-tests"
  "jest-tests"
  "reviewer-login-gate"
  "script-tests"
)

echo "==> CI gates branch-protection verification"
echo "    Workflow file    : ${WORKFLOW_FILE}"
echo "    Branch           : ${BRANCH}"
echo "    Require BP check : ${REQUIRE_BP_CHECK}"
echo "    Gates to verify  :"
for g in "${REQUIRED_GATE_IDS[@]}"; do
  echo "      - ${g}"
done
echo

# ── Check 1: Workflow file ─────────────────────────────────────────────────────
echo "[1/2] Workflow file (${WORKFLOW_FILE})"

if [[ ! -f "$WORKFLOW_FILE" ]]; then
  bad "File not found: ${WORKFLOW_FILE}"
  echo
  echo "  ci-cd.yml must exist and define all four CI gate jobs."
else
  ok "File exists: ${WORKFLOW_FILE}"

  # 1a: Each required gate job ID must be present as a job definition.
  for job_id in "${REQUIRED_GATE_IDS[@]}"; do
    # Match "  job-id:" or "  job-id:\n" at a job-level indentation (2 spaces).
    if grep -qE "^  ${job_id}:" "$WORKFLOW_FILE"; then
      ok "  Job '${job_id}:' found in ${WORKFLOW_FILE}"
    else
      bad "  Job '${job_id}:' NOT found in ${WORKFLOW_FILE}"
      echo
      echo "    The job must be defined at the top-level jobs: block in ci-cd.yml"
      echo "    with id '${job_id}' so GitHub Actions surfaces it as a status check"
      echo "    context that can be added to branch-protection required-checks."
    fi
  done

  # 1b: The consolidated assertion step must be present.
  if grep -qF 'Assert all critical CI jobs are in branch-protection required-checks' "$WORKFLOW_FILE"; then
    ok "  'Assert all critical CI jobs' step found in ${WORKFLOW_FILE}"
  else
    bad "  'Assert all critical CI jobs' step NOT found in ${WORKFLOW_FILE}"
    echo
    echo "    The server-tests job in ci-cd.yml must contain the step:"
    echo "      name: Assert all critical CI jobs are in branch-protection required-checks"
    echo "    This step verifies at runtime that all four gates remain wired."
  fi

  # 1c: All four gate IDs must appear in the CRITICAL_JOBS list inside the
  #     assertion step (the Python block at lines ~447-452 of ci-cd.yml).
  for job_id in "${REQUIRED_GATE_IDS[@]}"; do
    if grep -qF "\"${job_id}\"" "$WORKFLOW_FILE"; then
      ok "  Gate '${job_id}' referenced in CRITICAL_JOBS assertion list"
    else
      bad "  Gate '${job_id}' NOT referenced in CRITICAL_JOBS assertion list"
      echo
      echo "    The CRITICAL_JOBS list in the 'Assert...' step must include '${job_id}'"
      echo "    so the runtime check catches if it is later removed from branch protection."
    fi
  done
fi

echo

# ── Check 2: Branch protection ────────────────────────────────────────────────
echo "[2/2] Branch protection rule (GH_ADMIN_PAT required)"

if [[ -z "${GH_ADMIN_PAT:-}" ]]; then
  if [[ "$REQUIRE_BP_CHECK" == "1" ]]; then
    bad "REQUIRE_BP_CHECK=1 but GH_ADMIN_PAT is not set"
    echo
    echo "    REQUIRE_BP_CHECK=1 means this check must not be skipped."
    echo "    Set GH_ADMIN_PAT to a Personal Access Token with 'repo' (admin)"
    echo "    scope and re-run:"
    echo "      GH_ADMIN_PAT=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        REQUIRE_BP_CHECK=1 bash scripts/verify-ci-gates-branch-protection.sh"
  else
    warn "GH_ADMIN_PAT not set — skipping branch-protection API check"
    echo
    echo "    The default GITHUB_TOKEN cannot read branch-protection rules."
    echo "    To verify all four gates are wired, re-run with an admin PAT:"
    echo "      GH_ADMIN_PAT=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        bash scripts/verify-ci-gates-branch-protection.sh"
    echo
    echo "    To configure branch protection (one-time, requires admin PAT):"
    echo "      GITHUB_TOKEN=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        bash scripts/set-ci-gates-branch-protection.sh"
    echo
    echo "    Or set it in the GitHub web UI:"
    echo "      Settings → Branches → Edit rule for '${BRANCH}'"
    echo "      → Require status checks → search for each gate job ID"
  fi
else
  if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
    bad "GH_ADMIN_PAT is set but GITHUB_REPOSITORY is not"
    echo "    Export GITHUB_REPOSITORY=<owner/repo> and re-run."
  elif ! command -v jq &>/dev/null; then
    bad "jq is required for branch-protection check but not found in PATH"
    echo "    Install jq: brew install jq  or  sudo apt-get install -y jq"
  else
    API_BASE="${GITHUB_API_BASE:-https://api.github.com}"
    bp_url="${API_BASE}/repos/${GITHUB_REPOSITORY}/branches/${BRANCH}/protection/required_status_checks"
    bp_tmp=$(mktemp)

    http_code=$(curl -sS -o "$bp_tmp" -w "%{http_code}" \
      -H "Authorization: token ${GH_ADMIN_PAT}" \
      -H "Accept: application/vnd.github.v3+json" \
      "$bp_url" 2>/dev/null || echo "000")

    if [[ "$http_code" == "404" ]]; then
      bad "No branch-protection rule found for '${BRANCH}' (HTTP 404)"
      echo
      echo "    Create a branch-protection rule for '${BRANCH}' first:"
      echo "      GitHub → Settings → Branches → Add branch protection rule"
      echo "    Then run set-ci-gates-branch-protection.sh to add the CI gate checks."
    elif [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
      bad "GitHub API returned HTTP ${http_code} (check token scope / permissions)"
      cat "$bp_tmp" 2>/dev/null || true
    else
      # Detect each check in BOTH new-style .checks[] AND legacy .contexts[].
      # GitHub may surface the same required check under either field depending
      # on how it was added. Checking only one source produces a false "not
      # configured" result if the operator added it via the legacy interface.
      required_checks=$(jq -r '
        (
          [.checks  // [] | .[] | .context],
          [.contexts // [] | .[]]
        ) | .[]
      ' "$bp_tmp" 2>/dev/null | sort -u || true)

      echo "  All required status checks for '${BRANCH}':"
      if [[ -z "$required_checks" ]]; then
        echo "    (none configured)"
      else
        # Prefix every line, not just the start of the variable.
        # shellcheck disable=SC2001
        echo "$required_checks" | sed 's/^/    - /'
      fi
      echo

      for job_id in "${REQUIRED_GATE_IDS[@]}"; do
        if echo "$required_checks" | grep -qF "$job_id"; then
          ok "'${job_id}' is in the required status checks for '${BRANCH}'"
        else
          bad "'${job_id}' is NOT in the required status checks for '${BRANCH}'"
          echo
          echo "    Run set-ci-gates-branch-protection.sh to add all missing gates:"
          echo "      GITHUB_TOKEN=<admin-pat> GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-<owner/repo>} \\"
          echo "        bash scripts/set-ci-gates-branch-protection.sh"
          echo
          echo "    Or add it manually in the GitHub web UI:"
          echo "      Settings → Branches → Edit rule for '${BRANCH}'"
          echo "      → Require status checks → search for '${job_id}'"
        fi
      done
    fi
    rm -f "$bp_tmp"
  fi
fi

echo

# ── Summary ────────────────────────────────────────────────────────────────────
echo "======================================="
echo "Passed: ${pass}    Failed: ${fail}    Skipped: ${skip}"
echo "======================================="
echo

if [[ "$fail" -gt 0 ]]; then
  echo "One or more checks failed. Fix the issues above, then re-run."
  echo
  echo "To configure branch protection (one-time, admin PAT required):"
  echo "  GITHUB_TOKEN=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
  echo "    bash scripts/set-ci-gates-branch-protection.sh"
  exit 1
fi

if [[ "$skip" -gt 0 ]]; then
  echo "All executed checks passed (${skip} skipped — see above for details)."
else
  echo "All checks passed. All four CI gates are correctly wired to block PRs."
fi
exit 0
