#!/usr/bin/env bash
# Verify that the Semgrep SAST gate is correctly wired to block PRs.
#
# This script checks three things:
#
#   1. WORKFLOW FILE — security-scan.yml has a job named "SAST (Semgrep)" that:
#      a) uses semgrep/semgrep-action with `error: true`
#      b) uploads results via github/codeql-action/upload-sarif
#      c) has a re-raise step that fails the job when Semgrep exits non-zero
#      d) triggers on pull_request to main
#
#   2. SEMGREPIGNORE — .semgrepignore exists and excludes key generated paths
#      (dist/, node_modules/, attached_assets/).
#
#   3. BRANCH PROTECTION — the "SAST (Semgrep)" check is in the required-
#      status-checks list for `main`, detected in BOTH new-style .checks[] AND
#      legacy .contexts[] format.
#      - Requires GH_ADMIN_PAT (default GITHUB_TOKEN cannot read branch-
#        protection rules; see .agents/memory/github-token-admin-scopes.md).
#      - If GH_ADMIN_PAT is absent and REQUIRE_BP_CHECK=1, the job FAILS so
#        operators can't accidentally skip the API assertion in hardening
#        workflows. If GH_ADMIN_PAT is absent and REQUIRE_BP_CHECK is unset
#        (or "0"), the check is skipped with a warning — acceptable for normal
#        developer CI where no admin PAT is available.
#
# Usage in CI without admin token (checks 1 and 2 only):
#   bash scripts/verify-semgrep-branch-protection.sh
#
# Usage with admin PAT (all three checks, recommended for hardening pipelines):
#   GH_ADMIN_PAT=<admin-PAT> \
#   GITHUB_REPOSITORY=<owner/repo> \
#   bash scripts/verify-semgrep-branch-protection.sh
#
# Usage in a CI job that MUST assert branch protection (fails if no PAT):
#   REQUIRE_BP_CHECK=1 \
#   GH_ADMIN_PAT=<admin-PAT> \
#   GITHUB_REPOSITORY=<owner/repo> \
#   bash scripts/verify-semgrep-branch-protection.sh
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

WORKFLOW_FILE=".github/workflows/security-scan.yml"
SEMGREPIGNORE=".semgrepignore"
REQUIRED_CHECK="SAST (Semgrep)"
BRANCH="${BRANCH:-main}"
REQUIRE_BP_CHECK="${REQUIRE_BP_CHECK:-0}"

echo "==> Semgrep branch-protection verification"
echo "    Workflow file    : ${WORKFLOW_FILE}"
echo "    Semgrepignore    : ${SEMGREPIGNORE}"
echo "    Required check   : ${REQUIRED_CHECK}"
echo "    Branch           : ${BRANCH}"
echo "    Require BP check : ${REQUIRE_BP_CHECK}"
echo

# ── Check 1: Workflow file ─────────────────────────────────────────────────────
echo "[1/3] Workflow file (${WORKFLOW_FILE})"

if [[ ! -f "$WORKFLOW_FILE" ]]; then
  bad "File not found: ${WORKFLOW_FILE}"
  echo
  echo "  The security-scan.yml workflow must exist for the Semgrep gate to run."
  echo "  This file should have been added in the initial Semgrep integration."
else
  ok "File exists: ${WORKFLOW_FILE}"

  # 1a: job name "SAST (Semgrep)" — must match the branch-protection check name exactly
  if grep -qF 'name: SAST (Semgrep)' "$WORKFLOW_FILE"; then
    ok "  Job name 'SAST (Semgrep)' found (matches branch-protection check name)"
  else
    bad "  Job name 'SAST (Semgrep)' NOT found in ${WORKFLOW_FILE}"
    echo
    echo "    The semgrep job must have 'name: SAST (Semgrep)' so the GitHub"
    echo "    Actions status check name matches the branch-protection rule."
    echo "    Correct the job's name: field and re-run set-semgrep-branch-protection.sh."
  fi

  # 1b: semgrep-action with error: true
  if grep -qF 'semgrep/semgrep-action' "$WORKFLOW_FILE" && \
     grep -qF 'error: true' "$WORKFLOW_FILE"; then
    ok "  semgrep/semgrep-action present with 'error: true'"
  else
    bad "  semgrep/semgrep-action with 'error: true' not found in ${WORKFLOW_FILE}"
    echo
    echo "    The semgrep job must use 'uses: semgrep/semgrep-action' with"
    echo "    'error: true' to fail the job on ERROR-severity findings."
  fi

  # 1c: SARIF upload step
  if grep -qF 'upload-sarif' "$WORKFLOW_FILE" && \
     grep -qF 'semgrep-results.sarif' "$WORKFLOW_FILE"; then
    ok "  SARIF upload step found (results visible in Code Scanning tab)"
  else
    bad "  SARIF upload step not found in ${WORKFLOW_FILE}"
    echo
    echo "    Add a 'github/codeql-action/upload-sarif' step so findings"
    echo "    appear in the repository's Security → Code Scanning tab."
  fi

  # 1d: re-raise step — continue-on-error must NOT swallow the failure
  if grep -qF 'steps.semgrep.outcome' "$WORKFLOW_FILE" && \
     grep -qF "exit 1" "$WORKFLOW_FILE"; then
    ok "  Re-raise step found (continue-on-error + re-raise pattern)"
  else
    bad "  Re-raise step not found in ${WORKFLOW_FILE}"
    echo
    echo "    The semgrep job uses 'continue-on-error: true' on the semgrep"
    echo "    step so the SARIF upload always runs. A subsequent step must"
    echo "    check 'steps.semgrep.outcome == failure' and exit 1 to actually"
    echo "    fail the job. Without this step the SARIF uploads but the job"
    echo "    succeeds and PRs are never blocked."
  fi

  # 1e: triggers on pull_request to main
  if grep -qF "pull_request:" "$WORKFLOW_FILE" && \
     grep -A3 "pull_request:" "$WORKFLOW_FILE" | grep -qF "main"; then
    ok "  Workflow triggers on pull_request to main"
  else
    bad "  Workflow does not appear to trigger on pull_request to main"
    echo
    echo "    Required status checks only block PRs if the check is triggered"
    echo "    by pull_request events. Add 'on: pull_request: branches: [main]'."
  fi
fi

echo

# ── Check 2: .semgrepignore ───────────────────────────────────────────────────
echo "[2/3] Semgrep ignore file (${SEMGREPIGNORE})"

if [[ ! -f "$SEMGREPIGNORE" ]]; then
  bad "File not found: ${SEMGREPIGNORE}"
  echo
  echo "  Without .semgrepignore, Semgrep scans generated artifacts, vendored"
  echo "  code, and uploaded assets, producing noisy false-positives."
  echo "  Create .semgrepignore at the repository root."
else
  ok "File exists: ${SEMGREPIGNORE}"

  for expected_path in "dist/" "node_modules/" "attached_assets/"; do
    if grep -qF "$expected_path" "$SEMGREPIGNORE"; then
      ok "  Excludes '${expected_path}'"
    else
      bad "  Does not exclude '${expected_path}' — add it to ${SEMGREPIGNORE}"
    fi
  done
fi

echo

# ── Check 3: Branch protection ────────────────────────────────────────────────
echo "[3/3] Branch protection rule (GH_ADMIN_PAT required)"

if [[ -z "${GH_ADMIN_PAT:-}" ]]; then
  if [[ "$REQUIRE_BP_CHECK" == "1" ]]; then
    # Operator explicitly required this check — fail rather than silently skip.
    bad "REQUIRE_BP_CHECK=1 but GH_ADMIN_PAT is not set"
    echo
    echo "    REQUIRE_BP_CHECK=1 means this check must not be skipped."
    echo "    Set GH_ADMIN_PAT to a Personal Access Token with 'repo' (admin)"
    echo "    scope and re-run:"
    echo "      GH_ADMIN_PAT=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        REQUIRE_BP_CHECK=1 bash scripts/verify-semgrep-branch-protection.sh"
  else
    warn "GH_ADMIN_PAT not set — skipping branch-protection API check"
    echo
    echo "    The default GITHUB_TOKEN cannot read branch-protection rules."
    echo "    To verify the rule is set, re-run with an admin PAT:"
    echo "      GH_ADMIN_PAT=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        bash scripts/verify-semgrep-branch-protection.sh"
    echo
    echo "    To configure the rule (one-time, requires admin PAT):"
    echo "      GITHUB_TOKEN=<admin-pat> GITHUB_REPOSITORY=<owner/repo> \\"
    echo "        bash scripts/set-semgrep-branch-protection.sh"
    echo
    echo "    Or set it in the GitHub web UI:"
    echo "      Settings → Branches → Edit rule for '${BRANCH}'"
    echo "      → Require status checks → search for '${REQUIRED_CHECK}'"
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
      echo "    Then run set-semgrep-branch-protection.sh to add the Semgrep check."
    elif [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
      bad "GitHub API returned HTTP ${http_code} (check token scope / permissions)"
      cat "$bp_tmp" 2>/dev/null || true
    else
      # Detect the check in BOTH new-style .checks[] AND legacy .contexts[].
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

      if echo "$required_checks" | grep -qF "$REQUIRED_CHECK"; then
        ok "'${REQUIRED_CHECK}' is in the required status checks for '${BRANCH}'"
      else
        bad "'${REQUIRED_CHECK}' is NOT in the required status checks for '${BRANCH}'"
        echo
        echo "    Run set-semgrep-branch-protection.sh to add it:"
        echo "      GITHUB_TOKEN=<admin-pat> GITHUB_REPOSITORY=${GITHUB_REPOSITORY} \\"
        echo "        bash scripts/set-semgrep-branch-protection.sh"
        echo
        echo "    Or add it manually in the GitHub web UI:"
        echo "      Settings → Branches → Edit rule for '${BRANCH}'"
        echo "      → Require status checks → search for '${REQUIRED_CHECK}'"
      fi
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
  echo "    bash scripts/set-semgrep-branch-protection.sh"
  exit 1
fi

if [[ "$skip" -gt 0 ]]; then
  echo "All executed checks passed (${skip} skipped — see above for details)."
else
  echo "All checks passed. Semgrep is correctly wired to block PRs."
fi
exit 0
