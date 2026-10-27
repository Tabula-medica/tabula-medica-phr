#!/usr/bin/env bash
#
# Regression test for .github/actions/slack-recovery-state/action.yml.
#
# WHAT THIS GUARDS
# ----------------
# The slack-recovery-state composite action is the single source of truth for
# the three-state machine (`passing` / `failure-notified` / `failure-silent`)
# that gates Slack failure and recovery pings for both the deploy job and the
# post-deploy smoke job in deploy-cloudrun.yml. Any silent regression there
# manifests in production as either:
#
#   - missed recovery pings (people stop trusting the all-clear), or
#   - spurious "recovered" pings after silent failures or first-ever runs
#     (people stop trusting failure pings).
#
# Both modes are visible only by shipping a real failure / recovery sequence
# to Slack, which is why we want this scripted check to run in CI before any
# change to the action lands.
#
# This harness drives the action's two pieces of bash logic — the `decide`
# step (which sets `should_notify_recovery`) and the `Persist` step (which
# writes `last-status.txt`) — through the full transition matrix and asserts
# on both the output and the persisted state.
#
# Scenarios covered:
#
#   1.  First-ever run is green (no cache)            -> no recovery ping
#   2.  passing -> failure with delivered Slack ping  -> failure-notified
#   3.  failure-notified -> green                     -> recovery ping fires
#   4.  passing -> green (consecutive greens)         -> NO spurious all-clear
#   5.  passing -> failure with NO Slack delivery     -> failure-silent
#   6.  failure-silent -> green                       -> NO spurious all-clear
#       (the central anti-spam invariant of the state machine)
#   7.  failure-notified -> failure-notified          -> sustained outage
#   8.  failure-notified -> skipped/cancelled         -> state preserved
#   9.  failure with notify_posted="false" explicit   -> failure-silent
#  10.  Missing cache file is treated as `passing`    -> safe default
#  11.  failure-notified with expired TTL -> green    -> NO recovery ping
#       (stale all-clear suppression)
#
# HOW TO RUN LOCALLY
# ------------------
#   bash scripts/test-slack-recovery-state.sh
#
# Exit code is 0 on success, 1 on any failed assertion or drift.
#
# DRIFT PROTECTION
# ----------------
# The two `run: |` shell blocks from action.yml are inlined below as the
# `decide_step` and `persist_step` shell functions. To make sure the inlined
# copies stay in sync with the real action, the harness extracts the live
# `run:` blocks from action.yml at startup, sha256s them, and compares them
# against the EXPECTED_DECIDE_SHA256 / EXPECTED_PERSIST_SHA256 constants
# below. If you change the action's bash you MUST:
#
#   1. update the corresponding `*_step` function in this file so it mirrors
#      the new logic exactly, AND
#   2. add / adjust scenarios so the new behaviour is actually exercised, AND
#   3. update the EXPECTED_*_SHA256 constants (the failure message prints
#      both the actual and expected hashes so you can copy/paste).
#

set -euo pipefail

ACTION_FILE=".github/actions/slack-recovery-state/action.yml"

# Pinned SHA256s of the action's two `run: |` shell blocks (with leading
# indentation stripped). Update these whenever the action's bash logic
# legitimately changes — see DRIFT PROTECTION above.
EXPECTED_DECIDE_SHA256="a6bd38963ffb6eb98d144f814b9466ea860f2fae406c7270b9af3e96b10ca30e"
EXPECTED_PERSIST_SHA256="ee908dc013eb408bbe57496032470d42ddeaa5cd9699f88e1b8406b01bcd4516"

# ---------------------------------------------------------------------------
# Inlined replicas of action.yml's two bash blocks.
#
# These MUST mirror the corresponding `run: |` blocks in action.yml exactly
# (modulo GitHub Actions `${{ inputs.* }}` templating, which becomes plain
# env vars by the time bash sees it). Drift is caught by the sha256 check at
# the bottom of this file.
#
# NOTE: action.yml uses `exit 0` to short-circuit its bash blocks; we use
# `return 0` here because these are shell functions — `exit 0` inside a
# function would terminate the whole test harness. The logic is otherwise
# identical. The SHA check covers the action's actual code, not this wrapper.
# ---------------------------------------------------------------------------

# Mirrors the `id: decide` step. Reads STATE_DIR + DEPLOY_STATUS +
# FAILURE_TTL_SECONDS, appends a single `should_notify=...` line to
# GITHUB_OUTPUT.
decide_step() {
  if [ "$DEPLOY_STATUS" != "success" ]; then
    echo "Underlying step status is '$DEPLOY_STATUS' (not success) — no recovery message needed."
    echo "should_notify=false" >> "$GITHUB_OUTPUT"
    return 0
  fi

  PREVIOUS_STATUS="passing"
  PREVIOUS_TS=""
  if [ -f "$STATE_DIR/last-status.txt" ]; then
    read -r PREVIOUS_STATUS PREVIOUS_TS < "$STATE_DIR/last-status.txt" || true
  fi
  echo "Previous $STATE_DIR status: '$PREVIOUS_STATUS' (recorded at: '${PREVIOUS_TS:-<none>}')"

  if [ "$PREVIOUS_STATUS" != "failure-notified" ]; then
    echo "should_notify=false" >> "$GITHUB_OUTPUT"
    echo "Previous run was not a notified failure — no recovery message needed."
    return 0
  fi

  NOW=$(date +%s)
  AGE=$(( NOW - ${PREVIOUS_TS:-0} ))
  if [ "$AGE" -gt "$FAILURE_TTL_SECONDS" ]; then
    echo "should_notify=false" >> "$GITHUB_OUTPUT"
    echo "Previous failure-notified state is ${AGE}s old (TTL ${FAILURE_TTL_SECONDS}s) — treating as expired, no recovery message."
    return 0
  fi

  echo "should_notify=true" >> "$GITHUB_OUTPUT"
  echo "Previous failure-notified state is ${AGE}s old (within TTL ${FAILURE_TTL_SECONDS}s) — arming recovery message."
}

# Mirrors the `Persist <state_key> for next run` step, INCLUDING its
# `if: inputs.deploy_status == 'success' || inputs.deploy_status == 'failure'`
# gate (modelled here as an early return).
persist_step() {
  if [ "$DEPLOY_STATUS" != "success" ] && [ "$DEPLOY_STATUS" != "failure" ]; then
    return 0
  fi
  mkdir -p "$STATE_DIR"
  if [ "$DEPLOY_STATUS" = "success" ]; then
    echo "passing" > "$STATE_DIR/last-status.txt"
  elif [ "$NOTIFY_POSTED" = "true" ]; then
    echo "failure-notified $(date +%s)" > "$STATE_DIR/last-status.txt"
  else
    echo "failure-silent" > "$STATE_DIR/last-status.txt"
  fi
  echo "Wrote $STATE_DIR state: $(cat "$STATE_DIR/last-status.txt")"
}

# Extract a single `run: |` block from action.yml by the step's `name:` line.
# Matches by substring to tolerate the `${{ inputs.state_key }}` template
# fragment in the real names. Strips the YAML block's content indentation so
# the output is what bash actually sees at runtime.
extract_run_block() {
  local action_file="$1" name_substring="$2"
  awk -v needle="$name_substring" '
    # Detect the start of a new step. Reset our tracking when we see one.
    /^[[:space:]]+- name:/ {
      in_step = (index($0, needle) > 0) ? 1 : 0
      collecting = 0
      next
    }
    # Inside the right step, find the `run: |` line and remember its indent.
    in_step && /^[[:space:]]+run: \|[[:space:]]*$/ {
      match($0, /[^ ]/)
      run_indent = RSTART - 1
      content_indent = run_indent + 2
      collecting = 1
      next
    }
    collecting {
      # Blank lines belong to the block.
      if ($0 ~ /^[[:space:]]*$/) { print ""; next }
      match($0, /[^ ]/)
      this_indent = RSTART - 1
      if (this_indent < content_indent) {
        # Dedented past the run block — were done with this step.
        collecting = 0; in_step = 0
        next
      }
      print substr($0, content_indent + 1)
    }
  ' "$action_file"
}

# ---------------------------------------------------------------------------
# When this file is sourced (not executed directly), export only the three
# functions above plus the SHA constants so peer test harnesses can reuse
# them without re-running all the scenarios below.
#
# REQUIRES BASH — this guard uses two bash-only constructs:
#   [[ ... ]]       — bash conditional expression (not POSIX sh)
#   BASH_SOURCE[0]  — bash array variable (undefined in sh/dash)
#
# If this file were ever invoked or sourced under sh/dash instead of bash,
# the guard would be silently skipped (sh treats [[ as a syntax error or
# falls through) and all 11 test scenarios below would re-execute as
# side-effects inside the peer harness, polluting its output and potentially
# changing its exit code.  The shebang (#!/usr/bin/env bash) and the
# explicit `bash` invocations in CI (test-slack-recovery-state.yml) are the
# enforcing controls; shellcheck in that same workflow catches shebang drift.
# ---------------------------------------------------------------------------
[[ "${BASH_SOURCE[0]}" != "${0}" ]] && return 0

# ---------------------------------------------------------------------------
# Test harness plumbing
# ---------------------------------------------------------------------------

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

STATE_DIR="$TMPDIR_TEST/.deploy-state"
export STATE_DIR

failures=0
total=0

# Run a single simulated invocation of the action and echo `should_notify`.
# Args: deploy_status notify_posted [failure_ttl_seconds]
# failure_ttl_seconds defaults to 999999999 so tests are not affected by the
# stale-failure TTL unless they explicitly want to exercise it.
invoke() {
  local deploy_status="$1" notify_posted="${2:-}" failure_ttl="${3:-999999999}"
  export DEPLOY_STATUS="$deploy_status"
  export NOTIFY_POSTED="$notify_posted"
  export FAILURE_TTL_SECONDS="$failure_ttl"

  GITHUB_OUTPUT=$(mktemp -p "$TMPDIR_TEST")
  export GITHUB_OUTPUT

  # Discard stdout from the inlined steps; the test only cares about the
  # GITHUB_OUTPUT line and the state file. Keep stderr visible so a bash
  # syntax error in either step still surfaces in the CI log.
  decide_step >/dev/null
  persist_step >/dev/null

  local should_notify=""
  if [ -s "$GITHUB_OUTPUT" ]; then
    should_notify=$(grep -E '^should_notify=' "$GITHUB_OUTPUT" | tail -n1 | cut -d= -f2-)
  fi
  rm -f "$GITHUB_OUTPUT"
  echo "$should_notify"
}

# Returns just the status word (first whitespace-delimited token) from the
# state file. The action now writes `failure-notified <unix_epoch>` so we
# extract only the first field to keep assertions stable across timestamps.
current_state() {
  if [ -f "$STATE_DIR/last-status.txt" ]; then
    awk '{print $1}' "$STATE_DIR/last-status.txt"
  else
    echo "<missing>"
  fi
}

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  total=$((total + 1))
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %-55s -> %s\n' "$label" "$actual"
  else
    printf '  FAIL  %-55s expected=%q actual=%q\n' "$label" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

reset_state() {
  rm -rf "$STATE_DIR"
}

# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

echo
echo "## Scenario 1: first-ever run is green (no cache → default to passing)"
reset_state
notify=$(invoke success "")
assert_eq "first-green should_notify"      "false"   "$notify"
assert_eq "first-green persisted state"    "passing" "$(current_state)"

echo
echo "## Scenario 2: passing → failure with Slack delivery (posted=true)"
notify=$(invoke failure "true")
assert_eq "fail-delivered should_notify"   "false"            "$notify"
assert_eq "fail-delivered persisted state" "failure-notified" "$(current_state)"

echo
echo "## Scenario 3: failure-notified → green (the recovery ping must fire)"
notify=$(invoke success "")
assert_eq "recovery should_notify"         "true"    "$notify"
assert_eq "recovery persisted state"       "passing" "$(current_state)"

echo
echo "## Scenario 4: passing → green (consecutive greens, no spurious ping)"
notify=$(invoke success "")
assert_eq "consec-green should_notify"     "false"   "$notify"
assert_eq "consec-green persisted state"   "passing" "$(current_state)"

echo
echo "## Scenario 5: passing → failure with NO Slack delivery (posted='')"
notify=$(invoke failure "")
assert_eq "fail-silent should_notify"      "false"          "$notify"
assert_eq "fail-silent persisted state"    "failure-silent" "$(current_state)"

echo
echo "## Scenario 6: failure-silent → green (must NOT fire spurious recovery)"
notify=$(invoke success "")
assert_eq "silent->green should_notify"    "false"   "$notify"
assert_eq "silent->green persisted state"  "passing" "$(current_state)"

echo
echo "## Scenario 7: sustained outage (failure-notified → failure-notified)"
reset_state
invoke failure "true" >/dev/null   # arm failure-notified
notify=$(invoke failure "true")
assert_eq "sustained-fail should_notify"   "false"            "$notify"
assert_eq "sustained-fail persisted state" "failure-notified" "$(current_state)"

echo
echo "## Scenario 8: skipped / cancelled runs preserve previous state"
# State is still failure-notified from scenario 7.
notify=$(invoke skipped "")
assert_eq "skipped should_notify"          "false"            "$notify"
assert_eq "skipped state preserved"        "failure-notified" "$(current_state)"

notify=$(invoke cancelled "")
assert_eq "cancelled should_notify"        "false"            "$notify"
assert_eq "cancelled state preserved"      "failure-notified" "$(current_state)"

# A green run after the skip/cancel still arms the recovery ping — i.e.
# skipped runs don't accidentally swallow the pending failure-notified.
notify=$(invoke success "")
assert_eq "post-skip recovery should_notify"  "true"    "$notify"
assert_eq "post-skip persisted state"         "passing" "$(current_state)"

echo
echo "## Scenario 9: failure with notify_posted='false' explicitly"
reset_state
notify=$(invoke failure "false")
assert_eq "fail-posted-false should_notify"   "false"          "$notify"
assert_eq "fail-posted-false persisted state" "failure-silent" "$(current_state)"

echo
echo "## Scenario 10: missing cache treated as passing"
reset_state
notify=$(invoke success "")
assert_eq "no-cache should_notify"            "false"   "$notify"
assert_eq "no-cache persisted state"          "passing" "$(current_state)"

echo
echo "## Scenario 11: failure-notified with expired TTL → no recovery ping"
# Arm failure-notified, then rewrite the timestamp to epoch 1 (ancient) so
# the TTL check fires even with the default 7-day window.
reset_state
invoke failure "true" >/dev/null          # writes failure-notified <now>
echo "failure-notified 1" > "$STATE_DIR/last-status.txt"  # overwrite with ancient ts
notify=$(invoke success "" 604800)        # standard 7-day TTL — epoch 1 is ancient
assert_eq "expired-ttl should_notify"     "false"   "$notify"
assert_eq "expired-ttl persisted state"   "passing" "$(current_state)"

# ---------------------------------------------------------------------------
# Drift check: extract the action's actual `run: |` blocks and verify their
# sha256 still matches the inlined replicas above.
# (extract_run_block is defined earlier in this file so it can be shared
# with peer harnesses that source this script.)
# ---------------------------------------------------------------------------

echo
echo "## Drift check: action.yml run-block sha256s"

decide_actual=$(extract_run_block "$ACTION_FILE" "Decide whether" | sha256sum | awk '{print $1}')
persist_actual=$(extract_run_block "$ACTION_FILE" "Persist " | sha256sum | awk '{print $1}')

drift=0
if [ "$decide_actual" != "$EXPECTED_DECIDE_SHA256" ]; then
  echo "  FAIL  decide block drifted from inlined replica"
  echo "          expected: $EXPECTED_DECIDE_SHA256"
  echo "          actual:   $decide_actual"
  echo "        Update decide_step() above AND EXPECTED_DECIDE_SHA256, then re-run."
  drift=1
else
  echo "  PASS  decide block matches inlined replica ($decide_actual)"
fi

if [ "$persist_actual" != "$EXPECTED_PERSIST_SHA256" ]; then
  echo "  FAIL  persist block drifted from inlined replica"
  echo "          expected: $EXPECTED_PERSIST_SHA256"
  echo "          actual:   $persist_actual"
  echo "        Update persist_step() above AND EXPECTED_PERSIST_SHA256, then re-run."
  drift=1
else
  echo "  PASS  persist block matches inlined replica ($persist_actual)"
fi

echo
if [ "$failures" -gt 0 ] || [ "$drift" -gt 0 ]; then
  echo "FAILED: $failures/$total scenario assertions failed; drift=$drift"
  exit 1
fi
echo "OK: all $total scenario assertions passed; action.yml in sync with inlined replicas."
