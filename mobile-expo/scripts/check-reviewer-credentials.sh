#!/usr/bin/env bash
# Pre-flight gate: verify the Apple reviewer demo account credentials are
# configured in CI secrets before the reviewer-login smoke test (and therefore
# before an EAS build credit is burned).
#
# This script intentionally does NOT make a network request — it only checks
# the local env vars. The actual HTTP login check is performed by
# scripts/smoke-test-reviewer-login.sh, which runs immediately after this gate
# in the reviewer-login-gate CI job.
#
# Checks performed:
#   1. REVIEWER_EMAIL is non-empty.
#   2. REVIEWER_EMAIL is not a known sentinel / placeholder string.
#   3. REVIEWER_EMAIL looks like a valid email address (contains "@" and a dot
#      after "@"), which catches values like "your-email@example" that are
#      obviously wrong without querying the server.
#   4. REVIEWER_EMAIL domain matches EXPECTED_REVIEWER_EMAIL_DOMAIN
#      (default: tabulamedica.health). A mismatch indicates the secret may
#      have been set to a test or personal email instead of the production
#      reviewer account, or that the account was migrated to a new domain
#      without updating CI secrets.
#   5. REVIEWER_PASSWORD is non-empty.
#   6. REVIEWER_PASSWORD is not a known sentinel / placeholder string.
#
# Caller (ci-cd.yml reviewer-login-gate job) maps the repo secrets:
#   REVIEWER_EMAIL                ← secrets.APPLE_REVIEWER_DEMO_EMAIL
#   REVIEWER_PASSWORD             ← secrets.APPLE_REVIEWER_DEMO_PASSWORD
#   EXPECTED_REVIEWER_EMAIL_DOMAIN ← plain env var (default: tabulamedica.health)
#
# If the check fails, the script prints a clear error message identifying
# which CI secret needs to be updated, then exits 1 so the job fails before
# reaching the smoke test or EAS build.

set -euo pipefail

EMAIL="${REVIEWER_EMAIL:-}"
PASSWORD="${REVIEWER_PASSWORD:-}"
EXPECTED_DOMAIN="${EXPECTED_REVIEWER_EMAIL_DOMAIN:-tabulamedica.health}"

pass=0
fail=0
ok()  { echo "  PASS  $1"; pass=$((pass+1)); }
bad() { echo "  FAIL  $1"; fail=$((fail+1)); }

echo "==> Reviewer credentials pre-flight check"
echo "    (validates APPLE_REVIEWER_DEMO_EMAIL / APPLE_REVIEWER_DEMO_PASSWORD"
echo "     CI secrets before the smoke test and EAS build run)"
echo "    Expected domain: ${EXPECTED_DOMAIN}"
echo

# ── Placeholder patterns ──────────────────────────────────────────────────────
# Strings that look "set" but are not real values — committed defaults,
# unsubstituted variable references, and common developer stand-ins.
# Match literal variable references, not their expanded values.
# shellcheck disable=SC2016
PLACEHOLDER_PATTERNS=(
  "SET_VIA_ENVIRONMENT_SECRET"
  "PLACEHOLDER"
  "CHANGE_ME"
  "your-email"
  "example.com"
  "example.org"
  "example@"
  "test@example"
  '$APPLE_REVIEWER'
  '${APPLE_REVIEWER'
  '$REVIEWER_'
  '${REVIEWER_'
)

is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    # Case-insensitive substring match
    if [[ "${val,,}" == *"${pattern,,}"* ]]; then
      return 0
    fi
  done
  return 1
}

looks_like_email() {
  local val="$1"
  # Must contain "@" with non-empty local and domain parts,
  # and the domain must contain at least one "." after the "@".
  local local_part="${val%%@*}"
  local domain_part="${val#*@}"
  [[ -z "$local_part" ]] && return 1
  [[ "$domain_part" == "$val" ]] && return 1          # no "@" found
  [[ "${domain_part}" != *"."* ]] && return 1         # domain has no dot
  [[ "${domain_part##*.}" == "" ]] && return 1        # trailing dot
  return 0
}

email_domain() {
  # Extract the domain portion of an email address (part after "@").
  echo "${1#*@}"
}

# ── Email: presence + placeholder check ───────────────────────────────────────
echo "[1/4] REVIEWER_EMAIL presence and format (→ APPLE_REVIEWER_DEMO_EMAIL)"

EMAIL_FORMAT_OK=0

if [[ -z "$EMAIL" ]]; then
  bad "REVIEWER_EMAIL is empty"
  echo
  echo "  The CI secret APPLE_REVIEWER_DEMO_EMAIL is not set or was not passed"
  echo "  to this job. Update it in your GitHub repository secrets:"
  echo "    GitHub → Settings → Secrets and variables → Actions"
  echo "    Secret name: APPLE_REVIEWER_DEMO_EMAIL"
  echo "    Value: the email address used to log in to the Tabula Medica"
  echo "           reviewer/demo account (must end in @${EXPECTED_DOMAIN})"
  echo
elif is_placeholder "$EMAIL"; then
  bad "REVIEWER_EMAIL looks like a placeholder (got: '${EMAIL}')"
  echo
  echo "  APPLE_REVIEWER_DEMO_EMAIL still contains a sentinel or placeholder"
  echo "  value. This means the secret was either never set or was reset to a"
  echo "  default. Update it with the real reviewer account email:"
  echo "    GitHub → Settings → Secrets and variables → Actions"
  echo "    Secret name: APPLE_REVIEWER_DEMO_EMAIL"
  echo "    Value: the actual email used for the App Store reviewer demo login"
  echo "           (must end in @${EXPECTED_DOMAIN})"
  echo
elif ! looks_like_email "$EMAIL"; then
  bad "REVIEWER_EMAIL does not look like a valid email address (got: '${EMAIL}')"
  echo
  echo "  APPLE_REVIEWER_DEMO_EMAIL must be a valid email address with an '@'"
  echo "  and a domain containing a dot (e.g. reviewer@${EXPECTED_DOMAIN})."
  echo "  Update the secret with the correct reviewer account email."
  echo
else
  ok "REVIEWER_EMAIL is set and syntactically valid (${EMAIL})"
  EMAIL_FORMAT_OK=1
fi

echo

# ── Email: domain enforcement ─────────────────────────────────────────────────
echo "[2/4] REVIEWER_EMAIL domain (expected: @${EXPECTED_DOMAIN})"

if [[ "$EMAIL_FORMAT_OK" -eq 1 ]]; then
  ACTUAL_DOMAIN="$(email_domain "$EMAIL")"
  # Case-insensitive comparison of the domain
  if [[ "${ACTUAL_DOMAIN,,}" == "${EXPECTED_DOMAIN,,}" ]]; then
    ok "REVIEWER_EMAIL domain matches expected (${ACTUAL_DOMAIN})"
  else
    bad "REVIEWER_EMAIL domain mismatch: got '@${ACTUAL_DOMAIN}', expected '@${EXPECTED_DOMAIN}'"
    echo
    echo "  The reviewer demo account email must use the @${EXPECTED_DOMAIN} domain."
    echo "  A different domain usually means:"
    echo "    - The secret was set to a personal or test email by mistake"
    echo "    - The reviewer account was migrated to a new domain without"
    echo "      updating the CI secret"
    echo "    - The password was rotated and the wrong account credentials"
    echo "      were entered during the update"
    echo
    echo "  Fix: update APPLE_REVIEWER_DEMO_EMAIL in GitHub repository secrets"
    echo "  to the correct @${EXPECTED_DOMAIN} reviewer account address, then"
    echo "  re-trigger the build workflow."
    echo
    echo "  If the expected domain itself has changed, update"
    echo "  EXPECTED_REVIEWER_EMAIL_DOMAIN in the reviewer-login-gate job"
    echo "  env block in .github/workflows/ci-cd.yml."
    echo
  fi
else
  echo "  SKIP  (email format check failed above — domain check skipped)"
fi

echo

# ── Password checks ───────────────────────────────────────────────────────────
echo "[3/4] REVIEWER_PASSWORD (→ APPLE_REVIEWER_DEMO_PASSWORD)"

if [[ -z "$PASSWORD" ]]; then
  bad "REVIEWER_PASSWORD is empty"
  echo
  echo "  The CI secret APPLE_REVIEWER_DEMO_PASSWORD is not set or was not"
  echo "  passed to this job. Update it in your GitHub repository secrets:"
  echo "    GitHub → Settings → Secrets and variables → Actions"
  echo "    Secret name: APPLE_REVIEWER_DEMO_PASSWORD"
  echo "    Value: the current password for the reviewer demo account."
  echo
  echo "  If the password was recently rotated in Apple App Store Connect, the"
  echo "  old CI secret is now stale — set the new password as the secret value."
  echo
elif is_placeholder "$PASSWORD"; then
  bad "REVIEWER_PASSWORD looks like a placeholder (got: '${PASSWORD}')"
  echo
  echo "  APPLE_REVIEWER_DEMO_PASSWORD still contains a sentinel or placeholder"
  echo "  value. If the reviewer account password was rotated without updating"
  echo "  this secret, set the new password:"
  echo "    GitHub → Settings → Secrets and variables → Actions"
  echo "    Secret name: APPLE_REVIEWER_DEMO_PASSWORD"
  echo "    Value: the new password after the most recent rotation"
  echo
else
  ok "REVIEWER_PASSWORD is set and non-placeholder (${#PASSWORD} chars)"
fi

echo

# ── Summary ───────────────────────────────────────────────────────────────────
echo "[4/4] Summary"
echo "================================"
echo "Passed: $pass    Failed: $fail"
echo "================================"
echo

if [[ "$fail" -gt 0 ]]; then
  echo "Pre-flight check failed. Fix the secrets listed above, then re-run the"
  echo "workflow. The smoke test (smoke-test-reviewer-login.sh) was not executed"
  echo "to avoid burning a network call against a known-broken credential set."
  echo
  echo "Common cause: the Apple reviewer account password was rotated in App"
  echo "Store Connect but APPLE_REVIEWER_DEMO_PASSWORD was not updated in the"
  echo "GitHub repository secrets. Update the secret and re-trigger the build."
  exit 1
fi

echo "Credentials look plausible. Proceeding to live smoke test..."
echo "(smoke-test-reviewer-login.sh will verify the credentials against prod)"
echo
exit 0
