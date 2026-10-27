#!/usr/bin/env bash
#
# Regression tests for the split two-state-machine pattern in the
# reviewer-login-gate CI job (.github/workflows/ci-cd.yml).
#
# WHAT THIS GUARDS
# ----------------
# The reviewer-login-gate job uses TWO independent slack-recovery-state
# machines instead of one:
#
#   reviewer-credentials-state  — wraps check_credentials
#                                 (APPLE_REVIEWER_DEMO_EMAIL / _PASSWORD
#                                  present, non-empty, non-placeholder)
#
#   reviewer-login-smoke-state  — wraps verify_login
#                                 (live POST /api/auth/login smoke test)
#
# The machines are intentionally decoupled so ops receives a targeted
# all-clear message: "credentials fixed" vs "login fixed". A regression that
# re-merges the two signals would produce the wrong recovery message (or no
# recovery message at all), which would be invisible to reviewers of the job
# YAML.
#
# The critical invariant this harness checks:
#
#   When check_credentials fails, verify_login is SKIPPED by GitHub
#   Actions (it depends on the previous step). The smoke-state machine
#   MUST receive `skipped` as its deploy_status, which causes the persist
#   step to be a no-op — the machine's previous state is preserved
#   unchanged. A credentials failure MUST NOT advance or reset the
#   smoke-state machine.
#
#   Symmetrically, when credentials pass but verify_login fails, the
#   credentials-state machine receives `success` (not the smoke failure),
#   so its state advances to `passing`. Only the smoke-state machine
#   records a failure.
#
# Scenarios covered:
#
#   A. Credentials-only failure
#      - check_credentials=failure (posted=true), verify_login=skipped
#      - Credentials machine: failure-notified
#      - Smoke machine: preserved (no state file → <missing>)
#      - Recovery run: credentials=success → credentials recovery fires
#                      smoke=success (first-ever) → NO spurious ping
#
#   B. Smoke-only failure
#      - check_credentials=success, verify_login=failure (posted=true)
#      - Credentials machine: passing
#      - Smoke machine: failure-notified
#      - Recovery run: credentials=success → NO spurious credentials ping
#                      smoke=success → smoke recovery fires
#
#   C. Pre-existing smoke failure; credentials fail on the NEXT run
#      - Smoke already failure-notified from a previous run
#      - Next run: check_credentials=failure (posted=true), verify_login=skipped
#      - Credentials machine: failure-notified
#      - Smoke machine: PRESERVED (skipped does not reset failure-notified)
#      - Full-recovery run: both machines recover independently
#
#   D. Confirm recovery all-clear messages are wired in ci-cd.yml
#      - Grep-based sanity check that the workflow YAML still contains the
#        expected recovery message text for each machine, so a rename or
#        removal of those steps breaks this test rather than silently
#        shipping no recovery ping.
#
# HOW TO RUN LOCALLY
# ------------------
#   bash scripts/test-reviewer-gate-state-machines.sh
#
# Exit code is 0 on success, 1 on any failed assertion.
#
# RELATIONSHIP TO test-slack-recovery-state.sh
# --------------------------------------------
# That script exercises the full transition matrix of the shared
# slack-recovery-state action (including drift protection via SHA256
# pinning). This script tests the COMPOSITION of two machines — the
# per-machine state isolation property that the shared action alone
# cannot test. The two scripts are complementary.
#

set -euo pipefail

CICD_FILE=".github/workflows/ci-cd.yml"

# ---------------------------------------------------------------------------
# Source decide_step, persist_step, extract_run_block, ACTION_FILE, and the
# EXPECTED_*_SHA256 drift constants from the canonical peer harness.
#
# When sourced (not executed directly), test-slack-recovery-state.sh defines
# the functions and SHA constants and then returns immediately — its own test
# scenarios do NOT run. This means decide_step / persist_step are defined in
# exactly one place, and the SHA constants never need to be duplicated here.
# ---------------------------------------------------------------------------
# shellcheck source=scripts/test-slack-recovery-state.sh
# The harness is linted separately; do not follow its runtime-only sourcing here.
# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/test-slack-recovery-state.sh"

# ---------------------------------------------------------------------------
# Test harness plumbing
# ---------------------------------------------------------------------------

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

failures=0
total=0

# Run one simulated invocation of the action for the given STATE_DIR.
# Args: state_dir deploy_status notify_posted [failure_ttl_seconds]
# Echoes the `should_notify` value ("true" or "false").
invoke_machine() {
  local state_dir="$1" deploy_status="$2" notify_posted="${3:-}" failure_ttl="${4:-999999999}"
  export STATE_DIR="$state_dir"
  export DEPLOY_STATUS="$deploy_status"
  export NOTIFY_POSTED="$notify_posted"
  export FAILURE_TTL_SECONDS="$failure_ttl"

  local gout
  gout=$(mktemp -p "$TMPDIR_TEST")
  export GITHUB_OUTPUT="$gout"

  decide_step >/dev/null 2>&1
  persist_step >/dev/null 2>&1

  local should_notify=""
  if [ -s "$gout" ]; then
    should_notify=$(grep -E '^should_notify=' "$gout" | tail -n1 | cut -d= -f2-)
  fi
  rm -f "$gout"
  echo "$should_notify"
}

# Returns the status word (first token) from the machine's state file,
# or "<missing>" if no state file exists yet.
machine_state() {
  local state_dir="$1"
  if [ -f "$state_dir/last-status.txt" ]; then
    awk '{print $1}' "$state_dir/last-status.txt"
  else
    echo "<missing>"
  fi
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  total=$((total + 1))
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %-60s -> %s\n' "$label" "$actual"
  else
    printf '  FAIL  %-60s expected=%q actual=%q\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

# Create fresh state directories for a new scenario.
# Returns two paths via the CRED_DIR and SMOKE_DIR globals.
reset_machines() {
  CRED_DIR="$TMPDIR_TEST/cred-state-$$"
  SMOKE_DIR="$TMPDIR_TEST/smoke-state-$$"
  rm -rf "$CRED_DIR" "$SMOKE_DIR"
  CRED_DIR="$TMPDIR_TEST/cred-state-$(date +%s%N)"
  SMOKE_DIR="$TMPDIR_TEST/smoke-state-$(date +%s%N)"
}

# ---------------------------------------------------------------------------
# Scenario A: Credentials-only failure
#
# check_credentials fails → verify_login is skipped by GitHub Actions.
# Only the credentials machine should advance to failure-notified.
# The smoke machine has no prior state, so it remains <missing>.
# On recovery, only the credentials machine fires should_notify=true.
# ---------------------------------------------------------------------------

echo
echo "## Scenario A: credentials-only failure"
echo "   check_credentials=failure/posted  verify_login=skipped"

reset_machines

# Simulate the first run: credentials fail (Slack delivered), smoke skipped.
cred_notify=$(invoke_machine "$CRED_DIR" failure true)
smoke_notify=$(invoke_machine "$SMOKE_DIR" skipped "")

assert_eq "A.run1 cred  should_notify"   "false"            "$cred_notify"
assert_eq "A.run1 smoke should_notify"   "false"            "$smoke_notify"
assert_eq "A.run1 cred  state"           "failure-notified" "$(machine_state "$CRED_DIR")"
assert_eq "A.run1 smoke state (preserved)" "<missing>"      "$(machine_state "$SMOKE_DIR")"

echo "   Recovery run: both steps pass"

# Simulate the recovery run: credentials now pass, smoke runs and passes too.
cred_notify=$(invoke_machine "$CRED_DIR" success "")
smoke_notify=$(invoke_machine "$SMOKE_DIR" success "")

assert_eq "A.recovery cred  should_notify (must fire)"  "true"  "$cred_notify"
assert_eq "A.recovery smoke should_notify (no ping)"    "false" "$smoke_notify"
assert_eq "A.recovery cred  state"                      "passing" "$(machine_state "$CRED_DIR")"
assert_eq "A.recovery smoke state"                      "passing" "$(machine_state "$SMOKE_DIR")"

# ---------------------------------------------------------------------------
# Scenario B: Smoke-only failure
#
# check_credentials passes → verify_login runs and fails.
# Only the smoke machine advances to failure-notified.
# The credentials machine records passing.
# On recovery, only the smoke machine fires should_notify=true.
# ---------------------------------------------------------------------------

echo
echo "## Scenario B: smoke-only failure"
echo "   check_credentials=success  verify_login=failure/posted"

reset_machines

cred_notify=$(invoke_machine "$CRED_DIR" success "")
smoke_notify=$(invoke_machine "$SMOKE_DIR" failure true)

assert_eq "B.run1 cred  should_notify"  "false"            "$cred_notify"
assert_eq "B.run1 smoke should_notify"  "false"            "$smoke_notify"
assert_eq "B.run1 cred  state"          "passing"          "$(machine_state "$CRED_DIR")"
assert_eq "B.run1 smoke state"          "failure-notified" "$(machine_state "$SMOKE_DIR")"

echo "   Recovery run: both steps pass"

cred_notify=$(invoke_machine "$CRED_DIR" success "")
smoke_notify=$(invoke_machine "$SMOKE_DIR" success "")

assert_eq "B.recovery cred  should_notify (no ping)"   "false" "$cred_notify"
assert_eq "B.recovery smoke should_notify (must fire)" "true"  "$smoke_notify"
assert_eq "B.recovery cred  state"                     "passing" "$(machine_state "$CRED_DIR")"
assert_eq "B.recovery smoke state"                     "passing" "$(machine_state "$SMOKE_DIR")"

# ---------------------------------------------------------------------------
# Scenario C: Pre-existing smoke failure; credentials fail on the next run
#
# Smoke is already in failure-notified (from a previous run).
# Now credentials fail → verify_login is skipped.
# The smoke machine receives `skipped` → its state MUST be preserved
# (still failure-notified, not reset to passing or failure-silent).
# On full recovery both machines should fire independently.
# ---------------------------------------------------------------------------

echo
echo "## Scenario C: smoke failure persists through a credentials-only-fail run"
echo "   Prior: smoke=failure-notified"
echo "   Run:   check_credentials=failure/posted  verify_login=skipped"

reset_machines

# Arm smoke to failure-notified (simulates a prior smoke failure).
invoke_machine "$SMOKE_DIR" failure true >/dev/null

assert_eq "C.setup smoke state"          "failure-notified" "$(machine_state "$SMOKE_DIR")"
assert_eq "C.setup cred  state"          "<missing>"        "$(machine_state "$CRED_DIR")"

# Now credentials fail on this run; smoke is skipped.
cred_notify=$(invoke_machine "$CRED_DIR" failure true)
smoke_notify=$(invoke_machine "$SMOKE_DIR" skipped "")

assert_eq "C.run1 cred  should_notify"           "false"            "$cred_notify"
assert_eq "C.run1 smoke should_notify"           "false"            "$smoke_notify"
assert_eq "C.run1 cred  state"                   "failure-notified" "$(machine_state "$CRED_DIR")"
assert_eq "C.run1 smoke state (must be preserved)" "failure-notified" "$(machine_state "$SMOKE_DIR")"

echo "   Full-recovery run: both steps pass"

cred_notify=$(invoke_machine "$CRED_DIR" success "")
smoke_notify=$(invoke_machine "$SMOKE_DIR" success "")

assert_eq "C.recovery cred  should_notify (must fire)" "true"    "$cred_notify"
assert_eq "C.recovery smoke should_notify (must fire)" "true"    "$smoke_notify"
assert_eq "C.recovery cred  state"                     "passing" "$(machine_state "$CRED_DIR")"
assert_eq "C.recovery smoke state"                     "passing" "$(machine_state "$SMOKE_DIR")"

# ---------------------------------------------------------------------------
# Scenario D: Confirm recovery all-clear messages are wired in ci-cd.yml
#
# Grep-based sanity check: the workflow YAML must still contain the expected
# recovery message strings for each state machine. If someone renames or
# removes a recovery-notify step the grep fails here rather than silently
# shipping no all-clear to Slack.
# ---------------------------------------------------------------------------

echo
echo "## Scenario D: recovery message strings present in $CICD_FILE"

CRED_RECOVERY_MSG="Reviewer credentials check recovered"
SMOKE_RECOVERY_MSG="Reviewer login smoke-test recovered"

check_message() {
  local label="$1" needle="$2"
  total=$((total + 1))
  if grep -qF "$needle" "$CICD_FILE"; then
    printf '  PASS  %-60s -> found\n' "$label"
  else
    printf '  FAIL  %-60s not found in %s\n' "$label" "$CICD_FILE"
    failures=$((failures + 1))
  fi
}

check_message "credentials recovery message text" "$CRED_RECOVERY_MSG"
check_message "smoke-test recovery message text"   "$SMOKE_RECOVERY_MSG"

# Confirm both machines use distinct state_key values (shared key = stomping).
check_message "reviewer-credentials-state key" "reviewer-credentials-state"
check_message "reviewer-login-smoke-state key"  "reviewer-login-smoke-state"

# ---------------------------------------------------------------------------
# Drift check: verify that action.yml hasn't changed without this harness
# (and its sister harness) being updated.
#
# We reuse extract_run_block, ACTION_FILE, EXPECTED_DECIDE_SHA256, and
# EXPECTED_PERSIST_SHA256 from test-slack-recovery-state.sh (sourced above).
# If the action changes, this check fires here in addition to the one in
# that script, so a CI run that only exercises the reviewer-gate scenarios
# still catches the drift.
# ---------------------------------------------------------------------------

echo
echo "## Drift check: action.yml run-block sha256s (sourced from peer harness)"

decide_actual=$(extract_run_block "$ACTION_FILE" "Decide whether" | sha256sum | awk '{print $1}')
persist_actual=$(extract_run_block "$ACTION_FILE" "Persist " | sha256sum | awk '{print $1}')

drift=0
if [ "$decide_actual" != "$EXPECTED_DECIDE_SHA256" ]; then
  echo "  FAIL  decide block drifted — update decide_step in test-slack-recovery-state.sh"
  echo "          expected: $EXPECTED_DECIDE_SHA256"
  echo "          actual:   $decide_actual"
  drift=1
else
  echo "  PASS  decide block matches ($decide_actual)"
fi

if [ "$persist_actual" != "$EXPECTED_PERSIST_SHA256" ]; then
  echo "  FAIL  persist block drifted — update persist_step in test-slack-recovery-state.sh"
  echo "          expected: $EXPECTED_PERSIST_SHA256"
  echo "          actual:   $persist_actual"
  drift=1
else
  echo "  PASS  persist block matches ($persist_actual)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo
if [ "$failures" -gt 0 ] || [ "$drift" -gt 0 ]; then
  echo "FAILED: $failures/$total assertions failed; drift=$drift"
  exit 1
fi
echo "OK: all $total assertions passed; action.yml in sync with inlined replicas."
