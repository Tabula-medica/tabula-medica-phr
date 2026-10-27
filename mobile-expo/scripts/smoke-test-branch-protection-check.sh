#!/usr/bin/env bash
# smoke-test-branch-protection-check.sh
#
# Verifies the hard-failure paths of the "Assert all critical CI jobs are in
# branch-protection required-checks" composite action invoked by ci-cd.yml
# WITHOUT requiring real GitHub App credentials or a live GitHub API call.
#
# The step has two enforcement modes:
#
#   HARD (GitHub App token present, APP_TOKEN_AVAILABLE=true):
#     - API 401/403  → exit 1  (app misconfigured or missing permission)
#     - 200 + any critical job missing → exit 1
#
#   SOFT (no app token, APP_TOKEN_AVAILABLE=false):
#     - API 403      → exit 0  (warning only — fork/GITHUB_TOKEN fallback)
#     - 200 + any critical job missing → exit 1  (same check, same exit code)
#
# Test cases:
#   TC1  403 + APP_TOKEN_AVAILABLE=true   → MUST exit 1  (hard-fail on bad app creds)
#   TC2  403 + APP_TOKEN_AVAILABLE=false  → MUST exit 0  (soft-warn, fork fallback)
#   TC3  200 + server-tests missing       → MUST exit 1  (required check removed)
#   TC4  200 + all four gates present     → MUST exit 0  (healthy state)
#   TC5  500 + APP_TOKEN_AVAILABLE=true   → MUST exit 1  (catch-all non-200 error)
#
# Usage:
#   bash scripts/smoke-test-branch-protection-check.sh
#
# Output: PASS/FAIL per test case; exits 0 only when all five pass.

set -uo pipefail

PASS_COUNT=0
FAIL_COUNT=0

# ---------------------------------------------------------------------------
# run_check HTTP_STATUS APP_TOKEN_AVAILABLE BP_JSON
#   Runs the exact bash+python logic from the composite action with injected
#   inputs.  Returns the step's exit code (0 = would-pass, 1 = would-fail).
# ---------------------------------------------------------------------------
run_check() {
  local http_status="$1"
  local app_token_available="$2"
  local bp_json="$3"

  echo "$bp_json" > /tmp/bp_response.json

  # Subshell so set -e applies cleanly and we can capture the exit code.
  (
    set -euo pipefail
    HTTP_STATUS="$http_status"
    APP_TOKEN_AVAILABLE="$app_token_available"

    # -----------------------------------------------------------------------
    # Verbatim copy of the bash routing block from the composite action.
    # Keep in sync with .github/actions/assert-required-checks/action.yml.
    # Enforced by scripts/__tests__/branch-protection-check-parity.test.mjs.
    # -----------------------------------------------------------------------
    if [ "${HTTP_STATUS}" = "401" ] || [ "${HTTP_STATUS}" = "403" ]; then
      if [ "${APP_TOKEN_AVAILABLE}" = "true" ]; then
        echo "::error title=Required-Checks API Error::GitHub App token received HTTP ${HTTP_STATUS} from the branch-protection API." >&2
        echo "::error title=Required-Checks API Error::Ensure the GitHub App has 'Administration: Read' repository permission and is installed on this repository." >&2
        cat /tmp/bp_response.json >&2
        exit 1
      fi
      echo "::warning title=Required-Checks Verification Skipped::Cannot read branch-protection settings (HTTP ${HTTP_STATUS} — token lacks repo-administration scope)." >&2
      echo "::warning title=Required-Checks Verification Skipped::IMPORTANT: server-tests, jest-tests, reviewer-login-gate, and script-tests MUST all remain in the branch-protection required-status-checks for 'main' or their guard chains are broken." >&2
      echo "::warning title=Required-Checks Verification Skipped::Register a GitHub App with 'Administration: Read' permission, then set GH_APP_ID and GH_APP_PRIVATE_KEY secrets to enable hard enforcement." >&2
      exit 0
    fi

    if [ "${HTTP_STATUS}" != "200" ]; then
      echo "::error title=Required-Checks API Error::Unexpected HTTP ${HTTP_STATUS} from branch-protection API. See /tmp/bp_response.json for details." >&2
      cat /tmp/bp_response.json >&2
      exit 1
    fi

    # -----------------------------------------------------------------------
    # Verbatim copy of the Python inline script from the composite action.
    # Keep in sync with .github/actions/assert-required-checks/action.yml.
    # Enforced by scripts/__tests__/branch-protection-check-parity.test.mjs.
    # -----------------------------------------------------------------------
    python3 - <<'PYEOF'
import json, sys
with open("/tmp/bp_response.json") as f:
    data = json.load(f)
flat = set(data.get("contexts", []))
structured = {c.get("context", "") for c in data.get("checks", []) if isinstance(c, dict)}
all_contexts = flat | structured
print(f"[branch-protection contexts found: {sorted(all_contexts)}]", file=sys.stderr)

CRITICAL_JOBS = [
    ("server-tests",        "Server Regression Tests"),
    ("jest-tests",          "Jest Tests (client)"),
    ("reviewer-login-gate", "Reviewer Login Gate (production)"),
    ("script-tests",        "Script Unit Tests (node:test)"),
]

missing = []
for job_id, display_name in CRITICAL_JOBS:
    if job_id not in all_contexts and display_name not in all_contexts:
        missing.append((job_id, display_name))

if missing:
    for job_id, display_name in missing:
        print(
            f"::error title=Canary Gate Broken::"
            f"'{job_id}' ('{display_name}') is NOT in the branch-protection "
            f"required-status-checks for 'main'. "
            f"Fix: Settings → Branches → main → "
            f"'Require status checks to pass before merging' → add '{job_id}'.",
            file=sys.stderr,
        )
    print(
        f"FAIL: {len(missing)} critical CI gate(s) missing from required-status-checks: "
        + ", ".join(job_id for job_id, _ in missing)
    )
    sys.exit(1)

print("OK: all critical CI gates confirmed in branch-protection required-status-checks for 'main'.")
PYEOF
  ) 2>/dev/null
}

# ---------------------------------------------------------------------------
# assert_exit  LABEL  EXPECTED_EXIT  ACTUAL_EXIT
# ---------------------------------------------------------------------------
assert_exit() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "  PASS  $label (exit ${actual})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL  $label (expected exit ${expected}, got ${actual})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ---------------------------------------------------------------------------
# Fixture JSON payloads
# ---------------------------------------------------------------------------

# Simulated 401/403 error body (irrelevant to Python path; only bash routing runs).
JSON_ERROR='{"message":"Must have admin rights to Repository."}'

# 200 response with server-tests deliberately absent.
JSON_MISSING_SERVER_TESTS=$(cat <<'EOF'
{
  "url": "https://api.github.com/repos/org/repo/branches/main/protection/required_status_checks",
  "strict": true,
  "contexts": [
    "jest-tests",
    "reviewer-login-gate",
    "script-tests"
  ],
  "checks": []
}
EOF
)

# 200 response with all four critical gates present (classic contexts shape).
JSON_ALL_PRESENT=$(cat <<'EOF'
{
  "url": "https://api.github.com/repos/org/repo/branches/main/protection/required_status_checks",
  "strict": true,
  "contexts": [
    "server-tests",
    "jest-tests",
    "reviewer-login-gate",
    "script-tests"
  ],
  "checks": []
}
EOF
)

# ---------------------------------------------------------------------------
# Run test cases
# ---------------------------------------------------------------------------
echo ""
echo "Branch-protection check smoke test"
echo "==================================="
echo ""

echo "TC1: HTTP 403 + APP_TOKEN_AVAILABLE=true  (bad/missing app permission)"
echo "       Expected: exit 1 (hard fail — app misconfigured)"
run_check "403" "true" "$JSON_ERROR"
TC1_EXIT=$?
assert_exit "TC1" 1 "$TC1_EXIT"
echo ""

echo "TC2: HTTP 403 + APP_TOKEN_AVAILABLE=false (fork / GITHUB_TOKEN fallback)"
echo "       Expected: exit 0 (soft warning only)"
run_check "403" "false" "$JSON_ERROR"
TC2_EXIT=$?
assert_exit "TC2" 0 "$TC2_EXIT"
echo ""

echo "TC3: HTTP 200 + server-tests absent from required-checks list"
echo "       Expected: exit 1 (required check removed)"
run_check "200" "true" "$JSON_MISSING_SERVER_TESTS"
TC3_EXIT=$?
assert_exit "TC3" 1 "$TC3_EXIT"
echo ""

echo "TC4: HTTP 200 + all four critical gates present"
echo "       Expected: exit 0 (healthy state)"
run_check "200" "true" "$JSON_ALL_PRESENT"
TC4_EXIT=$?
assert_exit "TC4" 0 "$TC4_EXIT"
echo ""

echo "TC5: HTTP 500 + APP_TOKEN_AVAILABLE=true  (unexpected server error — catch-all)"
echo "       Expected: exit 1 (hard fail — any non-200 other than 401/403)"
run_check "500" "true" "$JSON_ERROR"
TC5_EXIT=$?
assert_exit "TC5" 1 "$TC5_EXIT"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "==================================="
echo "Results: ${PASS_COUNT}/${TOTAL} passed"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "SMOKE TEST FAILED — one or more hard-failure paths did not behave as expected."
  echo "The branch-protection enforcement logic in ci-cd.yml may need repair."
  exit 1
fi

echo "SMOKE TEST PASSED — all hard-failure paths verified correct."
echo ""
echo "Enforcement summary:"
echo "  - App-token 401/403   → hard exit 1  ✓"
echo "  - Fork fallback 403   → soft exit 0  ✓"
echo "  - Missing gate        → hard exit 1  ✓"
echo "  - All gates present   → exit 0       ✓"
echo "  - Catch-all non-200   → hard exit 1  ✓"
exit 0
