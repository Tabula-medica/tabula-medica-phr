#!/usr/bin/env bash
# One-time setup: add the four critical CI gate jobs to the required status
# checks on the `main` branch-protection rule via the GitHub REST API.
#
# The four gates this script ensures are present:
#   server-tests        — server regression tests + ci-guard-file-canary
#   jest-tests          — GCIP launch-crash guard (App Review 2.1(a))
#   reviewer-login-gate — reviewer demo-account smoke test
#   script-tests        — bash guard expansion + ci-guard-files tests
#
# This script must be run by a repository administrator who can supply a PAT
# with `repo` (or `admin:repo`) scope. The default GITHUB_TOKEN in GitHub
# Actions workflows does NOT have sufficient permissions to read or modify
# branch-protection rules (see .agents/memory/github-token-admin-scopes.md).
#
# Usage (interactive, run once):
#   GITHUB_TOKEN=<admin-PAT> \
#   GITHUB_REPOSITORY=<owner/repo> \
#   bash scripts/set-ci-gates-branch-protection.sh
#
# Optional env vars:
#   BRANCH              Branch to update (default: main)
#   DRY_RUN             Set to "1" to print the updated payload without PATCHing
#   GITHUB_API_BASE     Override for GitHub Enterprise (default: https://api.github.com)
#
# What the script does:
#   1. GETs the current required-status-checks for the branch, preserving
#      all existing check metadata (app_id) and legacy contexts entries.
#   2. Checks which of the four CI gate job IDs are already present (in either
#      .checks[] or legacy .contexts[]).
#   3. Adds any missing gates to .checks (keeping all existing entries losslessly,
#      including app_id per check and all legacy .contexts entries).
#   4. PATCHes the updated payload (or prints it in dry-run mode).
#   5. Prints the final list of required checks after the update.
#
# The check context names are the job `id:` fields in .github/workflows/ci-cd.yml.
# GitHub Actions surfaces each job as a status check using its job ID unless an
# explicit `name:` is set, in which case the display name is used instead.
# The verify script (verify-ci-gates-branch-protection.sh) accepts both forms.

set -euo pipefail

BRANCH="${BRANCH:-main}"
DRY_RUN="${DRY_RUN:-0}"
API_BASE="${GITHUB_API_BASE:-https://api.github.com}"

# ── The four critical CI gate jobs ────────────────────────────────────────────
# Each entry: "job-id:Display Name"
# The job ID is what GitHub Actions uses as the status-check context by default.
# The display name (job `name:` field) is the human-readable alias used in the
# branch-protection UI and in the verify step in ci-cd.yml.
REQUIRED_GATES=(
  "server-tests:Server Regression Tests"
  "jest-tests:Jest Tests (client)"
  "reviewer-login-gate:Reviewer Login Gate (production)"
  "script-tests:Script Unit Tests (node:test)"
)

# ── Validate required env vars ────────────────────────────────────────────────
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN is not set." >&2
  echo "       Export a GitHub Personal Access Token with 'repo' (admin) scope:" >&2
  echo "         export GITHUB_TOKEN=ghp_..." >&2
  exit 1
fi

if [[ -z "${GITHUB_REPOSITORY:-}" ]]; then
  echo "ERROR: GITHUB_REPOSITORY is not set (expected format: owner/repo)." >&2
  echo "       Export it before running:" >&2
  echo "         export GITHUB_REPOSITORY=\$(gh repo view --json nameWithOwner -q .nameWithOwner)" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not found in PATH. Install it first:" >&2
  echo "  macOS:  brew install jq" >&2
  echo "  Debian: sudo apt-get install -y jq" >&2
  exit 1
fi

PROTECTION_URL="${API_BASE}/repos/${GITHUB_REPOSITORY}/branches/${BRANCH}/protection/required_status_checks"

echo "==> CI gates branch-protection setup"
echo "    Repository : ${GITHUB_REPOSITORY}"
echo "    Branch     : ${BRANCH}"
echo "    API base   : ${API_BASE}"
echo "    Dry run    : ${DRY_RUN}"
echo "    Gates to ensure:"
for entry in "${REQUIRED_GATES[@]}"; do
  job_id="${entry%%:*}"
  display_name="${entry#*:}"
  echo "      - ${job_id} (\"${display_name}\")"
done
echo

# ── Helper: GitHub API call ───────────────────────────────────────────────────
# Prints the response body to stdout; returns non-zero on non-2xx HTTP status.
github_api() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local http_code
  local response_file
  response_file=$(mktemp)

  if [[ -n "$body" ]]; then
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" \
      -X "$method" \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      -H "Content-Type: application/json" \
      --data "$body" \
      "$url")
  else
    http_code=$(curl -sS -o "$response_file" -w "%{http_code}" \
      -X "$method" \
      -H "Authorization: token ${GITHUB_TOKEN}" \
      -H "Accept: application/vnd.github.v3+json" \
      "$url")
  fi

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "ERROR: GitHub API returned HTTP $http_code" >&2
    cat "$response_file" >&2
    rm -f "$response_file"
    return 1
  fi

  cat "$response_file"
  rm -f "$response_file"
}

# ── Step 1: GET current required status checks ────────────────────────────────
echo "[1/3] Reading current required status checks for '${BRANCH}'..."

current_json=""
if ! current_json=$(github_api GET "$PROTECTION_URL"); then
  status_code=$(curl -sS -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "$PROTECTION_URL" 2>/dev/null || echo "000")

  if [[ "$status_code" == "404" ]]; then
    echo
    echo "  NOTE: The branch '$BRANCH' has no protection rule yet (HTTP 404)."
    echo "  You must create the branch-protection rule first in GitHub:"
    echo "    Settings → Branches → Add branch protection rule → Branch name: main"
    echo "  Then re-run this script to add the CI gate status checks."
    echo
    echo "  Alternatively, use the GitHub web UI directly:"
    echo "    Settings → Branches → Edit rule for 'main'"
    echo "    → Require status checks to pass before merging"
    echo "    → Search for and add each of:"
    for entry in "${REQUIRED_GATES[@]}"; do
      job_id="${entry%%:*}"
      echo "        '${job_id}'"
    done
    exit 1
  fi

  echo "ERROR: Failed to read branch protection. Ensure your PAT has 'repo'" >&2
  echo "       (admin) scope and that branch-protection exists for '${BRANCH}'." >&2
  exit 1
fi

echo "  Current protection retrieved."

# ── Parse existing checks — preserve full objects (including app_id) ──────────
#
# GitHub's branch-protection API supports two styles of required status checks:
#   .checks   — array of { context: string, app_id?: integer }  (new style)
#   .contexts — array of strings                                 (legacy style)
#
# We must preserve BOTH losslessly to avoid accidentally widening branch
# protection (e.g. by dropping app_id constraints or removing legacy entries).

existing_strict=$(echo "$current_json" | jq -r '.strict // false')

# .checks: preserve the entire object per entry, including app_id.
existing_checks=$(echo "$current_json" | jq '.checks // []')

# .contexts: legacy string list (separate from .checks).
existing_contexts=$(echo "$current_json" | jq '.contexts // []')

echo "  Strict: ${existing_strict}"
echo "  Current checks (new style):"
check_count=$(echo "$existing_checks" | jq 'length')
if [[ "$check_count" -gt 0 ]]; then
  echo "$existing_checks" | jq -r '.[] | "    - " + .context + (if .app_id then " (app_id=" + (.app_id | tostring) + ")" else "" end)'
else
  echo "    (none)"
fi
echo "  Current contexts (legacy style):"
legacy_count=$(echo "$existing_contexts" | jq 'length')
if [[ "$legacy_count" -gt 0 ]]; then
  echo "$existing_contexts" | jq -r '.[] | "    - " + .'
else
  echo "    (none)"
fi

# ── Identify which gates are missing ─────────────────────────────────────────
missing_gates=()
already_present_gates=()

for entry in "${REQUIRED_GATES[@]}"; do
  job_id="${entry%%:*}"
  display_name="${entry#*:}"

  in_checks=$(echo "$existing_checks" | jq --arg ctx "$job_id" \
    'map(select(.context == $ctx)) | length')
  in_contexts=$(echo "$existing_contexts" | jq --arg ctx "$job_id" \
    'map(select(. == $ctx)) | length')
  # Also check by display name (in case the operator added it by display name).
  in_checks_dn=$(echo "$existing_checks" | jq --arg ctx "$display_name" \
    'map(select(.context == $ctx)) | length')
  in_contexts_dn=$(echo "$existing_contexts" | jq --arg ctx "$display_name" \
    'map(select(. == $ctx)) | length')
  total=$(( in_checks + in_contexts + in_checks_dn + in_contexts_dn ))

  if [[ "$total" -gt 0 ]]; then
    already_present_gates+=("$job_id")
  else
    missing_gates+=("$job_id")
  fi
done

echo
if [[ "${#already_present_gates[@]}" -gt 0 ]]; then
  echo "  Already present:"
  for g in "${already_present_gates[@]}"; do
    echo "    - ${g}"
  done
fi

if [[ "${#missing_gates[@]}" -eq 0 ]]; then
  echo
  echo "  All four CI gate jobs are already in the required status checks list."
  echo "  No changes needed."
  exit 0
fi

echo "  Missing (will be added):"
for g in "${missing_gates[@]}"; do
  echo "    - ${g}"
done

# ── Step 2: Build updated payload ─────────────────────────────────────────────
echo
echo "[2/3] Building updated payload..."

# Start from existing checks and add each missing gate.
# We do NOT touch .contexts — they are carried through unchanged.
updated_checks="$existing_checks"
for job_id in "${missing_gates[@]}"; do
  updated_checks=$(echo "$updated_checks" | jq --arg ctx "$job_id" \
    '. + [{context: $ctx}]')
done

payload=$(jq -n \
  --argjson strict "$existing_strict" \
  --argjson checks "$updated_checks" \
  --argjson contexts "$existing_contexts" \
  '{strict: $strict, checks: $checks, contexts: $contexts}')

echo "  Updated checks (new style — includes app_id where present):"
echo "$updated_checks" | jq -r \
  '.[] | "    - " + .context + (if .app_id then " (app_id=" + (.app_id | tostring) + ")" else "" end)'
echo "  Legacy contexts (unchanged):"
if [[ "$legacy_count" -gt 0 ]]; then
  echo "$existing_contexts" | jq -r '.[] | "    - " + .'
else
  echo "    (none)"
fi
echo
echo "  Full payload:"
echo "$payload" | jq .

# ── Step 3: PATCH the required status checks ──────────────────────────────────
echo
echo "[3/3] Applying update..."

if [[ "$DRY_RUN" == "1" ]]; then
  echo "  DRY_RUN=1 — skipping PATCH. Run without DRY_RUN=1 to apply."
  echo
  echo "DONE (dry run). The payload above would add the missing CI gate(s) to"
  echo "required status checks on '${BRANCH}' without disturbing existing checks."
  exit 0
fi

result=$(github_api PATCH "$PROTECTION_URL" "$payload")

# Verify the result contains all our gates (in either .checks or .contexts).
final_check_contexts=$(echo "$result" | jq -r \
  '([.checks // [] | .[] | .context], [.contexts // [] | .[]]) | .[]')

echo "  Required status checks after update:"
# Prefix every line, not just the start of the variable.
# shellcheck disable=SC2001
echo "$final_check_contexts" | sed 's/^/    - /'

echo
all_confirmed=1
for job_id in "${missing_gates[@]}"; do
  if echo "$final_check_contexts" | grep -qF "$job_id"; then
    echo "  CONFIRMED: '${job_id}' is now required on '${BRANCH}'."
  else
    echo "  WARNING: PATCH succeeded but '${job_id}' does not appear in the" >&2
    echo "           final checks list. Verify manually in GitHub Settings." >&2
    all_confirmed=0
  fi
done

echo
if [[ "$all_confirmed" -eq 1 ]]; then
  echo "SUCCESS: All CI gate jobs are now required status checks on '${BRANCH}'."
  echo
  echo "GitHub UI: Settings → Branches → Edit rule for '${BRANCH}'"
  echo "  You should see all four gates under 'Required status checks':"
  for entry in "${REQUIRED_GATES[@]}"; do
    job_id="${entry%%:*}"
    echo "    - ${job_id}"
  done
  echo
  echo "Next step: open a test PR to confirm all four checks run and block merge"
  echo "           when they fail."
else
  echo "WARNING: Some CI gates could not be confirmed. Check the GitHub UI:"
  echo "  Settings → Branches → Edit rule for '${BRANCH}'"
  echo "  → Require status checks to pass before merging"
  exit 1
fi
