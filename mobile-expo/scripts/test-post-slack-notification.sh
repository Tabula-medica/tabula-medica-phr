#!/usr/bin/env bash
#
# Regression test for .github/actions/post-slack-notification/action.yml.
#
# WHAT THIS GUARDS
# ----------------
# `post-slack-notification` is the upstream half of the Slack failure /
# recovery pipeline used by deploy-cloudrun.yml and post-deploy-smoke.yml. Its
# `posted` output is the single signal that the downstream
# `slack-recovery-state` machine keys off of when deciding whether to arm a
# "recovered" ping on the next green run.
#
# That contract is fragile in both directions:
#
#   - If `posted=true` is ever emitted when Slack did NOT actually receive the
#     payload (e.g. webhook missing, curl transport error, Slack 4xx/5xx), the
#     downstream state machine will route to `failure-notified` and fire a
#     spurious "recovered" ping on the next green run for a failure no
#     engineer ever saw in Slack.
#
#   - If `posted=false` is ever emitted when Slack actually accepted the
#     payload (HTTP 2xx), the downstream state machine will route to
#     `failure-silent` and silently swallow the legitimate recovery ping —
#     people stop trusting the all-clear.
#
# Both modes are invisible until they ship to production, so we exercise the
# action end-to-end against a stubbed `curl` and assert on `posted` for every
# branch of the action's bash logic.
#
# Scenarios covered:
#
#   1.  webhook_url empty (forks / un-configured clones)  -> posted=false, no curl
#   2.  curl transport error (DNS/network)                -> posted=false
#   3.  Slack returns 5xx (e.g. 500)                      -> posted=false
#   4.  Slack returns 4xx (e.g. 404 / invalid_payload)    -> posted=false
#   5.  Slack returns 2xx (200)                           -> posted=true
#   6.  Slack returns 2xx upper boundary (299)            -> posted=true
#   7.  Multiline markdown + every {token} substitutes    -> payload structure correct
#   8.  fallback_text token substitution                  -> top-level `text` rendered
#   9.  code_block populated                              -> 2 blocks, second wraps in ```
#  10.  code_block empty                                  -> 1 block only
#  11.  Markdown with backticks/quotes survives jq escape -> payload is valid JSON
#
# HOW TO RUN LOCALLY
# ------------------
#   bash scripts/test-post-slack-notification.sh
#
# Exit code is 0 on success, 1 on any failed assertion or drift.
#
# This sits alongside scripts/test-slack-recovery-state.sh — together they
# cover both halves of the Slack failure / recovery pipeline.
#
# DRIFT PROTECTION
# ----------------
# The `run: |` shell block from action.yml is inlined below as the
# `post_slack_step` shell function. To make sure the inlined copy stays in
# sync with the real action, the harness extracts the live `run:` block from
# action.yml at startup, sha256s it, and compares it against the
# EXPECTED_POST_SHA256 constant below. If you change the action's bash you
# MUST:
#
#   1. update `post_slack_step()` in this file so it mirrors the new logic
#      exactly (modulo `exit 0` -> `return 0` so the function doesn't kill
#      the harness — same convention as test-slack-recovery-state.sh), AND
#   2. add / adjust scenarios so the new behaviour is actually exercised, AND
#   3. update EXPECTED_POST_SHA256 (the failure message prints both the
#      actual and expected hashes so you can copy/paste).
#

set -euo pipefail

ACTION_FILE=".github/actions/post-slack-notification/action.yml"

# Pinned SHA256 of the action's `run: |` shell block (with leading
# indentation stripped). Update whenever the action's bash logic legitimately
# changes — see DRIFT PROTECTION above.
EXPECTED_POST_SHA256="03e8a3bc8305883621c42276374c1f3114b347adb01d0305be4a19f647c58856"

# ---------------------------------------------------------------------------
# Inlined replica of action.yml's `Post Slack notification` run block.
#
# This MUST mirror the corresponding `run: |` block in action.yml exactly,
# with the single exception that the early-return uses `return 0` instead of
# `exit 0` so calling this from the harness doesn't kill the whole script.
# Drift is caught by the sha256 check at the bottom of this file.
# ---------------------------------------------------------------------------

post_slack_step() {
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "SLACK_WEBHOOK_URL not set — skipping Slack notification."
    echo "posted=false" >> "$GITHUB_OUTPUT"
    return 0
  fi

  SHORT_SHA="${COMMIT_SHA:0:7}"
  COMMIT_LINK="<${COMMIT_URL}|${SHORT_SHA}>"

  render() {
    jq -n -r \
      --arg t "$1" \
      --arg short_sha "$SHORT_SHA" \
      --arg commit_link "$COMMIT_LINK" \
      --arg commit_url "$COMMIT_URL" \
      --arg run_url "$RUN_URL" \
      '$t
        | gsub("\\{short_sha\\}"; $short_sha)
        | gsub("\\{commit_link\\}"; $commit_link)
        | gsub("\\{commit_url\\}"; $commit_url)
        | gsub("\\{run_url\\}"; $run_url)'
  }

  RENDERED_FALLBACK=$(render "$FALLBACK_TEXT")
  RENDERED_MARKDOWN=$(render "$MARKDOWN")

  if [ -n "$CODE_BLOCK" ]; then
    PAYLOAD=$(jq -n \
      --arg text "$RENDERED_FALLBACK" \
      --arg markdown "$RENDERED_MARKDOWN" \
      --arg code_block "$CODE_BLOCK" \
      '{
        text: $text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: $markdown } },
          { type: "section", text: { type: "mrkdwn", text: ("```" + $code_block + "```") } }
        ]
      }')
  else
    PAYLOAD=$(jq -n \
      --arg text "$RENDERED_FALLBACK" \
      --arg markdown "$RENDERED_MARKDOWN" \
      '{
        text: $text,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: $markdown } }
        ]
      }')
  fi

  HTTP_STATUS=$(curl -sS -o /tmp/slack-response.txt -w '%{http_code}' \
    -X POST \
    -H 'Content-Type: application/json' \
    --data "$PAYLOAD" \
    "$SLACK_WEBHOOK_URL" || true)
  echo "Slack webhook responded with HTTP $HTTP_STATUS"

  if [ "$HTTP_STATUS" -ge 200 ] 2>/dev/null && [ "$HTTP_STATUS" -lt 300 ] 2>/dev/null; then
    echo "posted=true" >> "$GITHUB_OUTPUT"
  else
    echo "Slack webhook delivery failed — response body:"
    cat /tmp/slack-response.txt || true
    echo "posted=false" >> "$GITHUB_OUTPUT"
  fi
}

# ---------------------------------------------------------------------------
# Test harness plumbing
# ---------------------------------------------------------------------------

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# Drop a stub `curl` script in front of PATH so the inlined replica's curl
# call is intercepted. The stub records the payload + URL it was invoked
# with into files (so the harness can assert on payload structure) and
# returns whatever HTTP status / body / exit code the per-scenario STUB_*
# env vars dictate.
STUB_BIN="$TMPDIR_TEST/bin"
mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/curl" <<'STUB'
#!/usr/bin/env bash
# Stub curl for test-post-slack-notification.sh. Recognises the flags the
# action actually uses (-o, --data, -w, -X, -H, -sS) and ignores everything
# else. Real curl is NOT invoked.
out_file=""
payload=""
url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o)         out_file="$2"; shift 2 ;;
    --data)     payload="$2"; shift 2 ;;
    -w|-X|-H)   shift 2 ;;
    -sS|-s|-S)  shift ;;
    -*)         shift ;;
    *)          url="$1"; shift ;;
  esac
done

if [ -n "${STUB_PAYLOAD_FILE:-}" ]; then
  printf '%s' "$payload" > "$STUB_PAYLOAD_FILE"
fi
if [ -n "${STUB_URL_FILE:-}" ]; then
  printf '%s' "$url" > "$STUB_URL_FILE"
fi

# Simulate a transport error (DNS, connection refused, ...): real curl emits
# nothing on stdout and exits non-zero. The action's `|| true` swallows the
# exit code, so HTTP_STATUS ends up empty and posted should resolve to false.
if [ "${STUB_CURL_EXIT_CODE:-0}" != "0" ]; then
  exit "$STUB_CURL_EXIT_CODE"
fi

if [ -n "$out_file" ]; then
  printf '%s' "${STUB_RESPONSE_BODY:-}" > "$out_file"
fi
# `-w '%{http_code}'` makes real curl print the status to stdout once the
# body has been written to -o. Mirror that here.
printf '%s' "${STUB_HTTP_STATUS:-200}"
STUB
chmod +x "$STUB_BIN/curl"
export PATH="$STUB_BIN:$PATH"

failures=0
total=0

# Defaults reused across scenarios — overridden per-call as needed.
DEFAULT_COMMIT_SHA="abcdef1234567890abcdef1234567890abcdef12"
DEFAULT_COMMIT_URL="https://github.com/acme/medapp/commit/$DEFAULT_COMMIT_SHA"
DEFAULT_RUN_URL="https://github.com/acme/medapp/actions/runs/9999"
DEFAULT_FALLBACK="Deploy {short_sha} failed"
DEFAULT_MARKDOWN="*Deploy failed* on {commit_link} — see {run_url}"

# Run a single simulated invocation of the action.
#
# Per-call env (export before calling, defaults applied if unset):
#   WEBHOOK             SLACK_WEBHOOK_URL value (default: dummy URL)
#   FALLBACK_TEXT_IN    fallback_text input (default: DEFAULT_FALLBACK)
#   MARKDOWN_IN         markdown input     (default: DEFAULT_MARKDOWN)
#   CODE_BLOCK_IN       code_block input   (default: empty)
#   STUB_HTTP_STATUS    HTTP status the stub curl emits (default: 200)
#   STUB_RESPONSE_BODY  body the stub curl writes via -o (default: ok)
#   STUB_CURL_EXIT_CODE curl exit code     (default: 0)
#
# Echoes the captured `posted` value. Side effects: STUB_PAYLOAD_FILE and
# STUB_URL_FILE are populated with the bytes the action passed to curl, for
# subsequent payload-shape assertions.
invoke() {
  export SLACK_WEBHOOK_URL="${WEBHOOK-https://hooks.slack.test/services/T/B/X}"
  export COMMIT_SHA="${COMMIT_SHA:-$DEFAULT_COMMIT_SHA}"
  export COMMIT_URL="${COMMIT_URL:-$DEFAULT_COMMIT_URL}"
  export RUN_URL="${RUN_URL:-$DEFAULT_RUN_URL}"
  export FALLBACK_TEXT="${FALLBACK_TEXT_IN-$DEFAULT_FALLBACK}"
  export MARKDOWN="${MARKDOWN_IN-$DEFAULT_MARKDOWN}"
  export CODE_BLOCK="${CODE_BLOCK_IN-}"

  export STUB_HTTP_STATUS="${STUB_HTTP_STATUS:-200}"
  export STUB_RESPONSE_BODY="${STUB_RESPONSE_BODY:-ok}"
  export STUB_CURL_EXIT_CODE="${STUB_CURL_EXIT_CODE:-0}"

  STUB_PAYLOAD_FILE="$TMPDIR_TEST/payload.json"
  STUB_URL_FILE="$TMPDIR_TEST/url.txt"
  rm -f "$STUB_PAYLOAD_FILE" "$STUB_URL_FILE"
  export STUB_PAYLOAD_FILE STUB_URL_FILE

  # The action `cat`s /tmp/slack-response.txt on the failure path. Wipe any
  # stale copy from a previous scenario so a transport-error scenario
  # (where curl never writes the file) doesn't accidentally read leftover
  # bytes from an earlier 5xx scenario.
  rm -f /tmp/slack-response.txt

  GITHUB_OUTPUT=$(mktemp -p "$TMPDIR_TEST")
  export GITHUB_OUTPUT

  # Discard stdout from the inlined step; the harness only cares about the
  # `posted=...` line in GITHUB_OUTPUT and the recorded payload / url. Keep
  # stderr visible so a bash syntax error in the replica still surfaces in
  # the CI log — but filter the one expected noise line from the action's
  # `cat /tmp/slack-response.txt || true` on the transport-error / no-body
  # paths (the SHA drift check already pins that the cat line itself is
  # unchanged, so suppressing it here can't mask a real regression).
  post_slack_step >/dev/null 2> >(grep -v 'slack-response.txt: No such file or directory' >&2)

  local posted=""
  if [ -s "$GITHUB_OUTPUT" ]; then
    posted=$(grep -E '^posted=' "$GITHUB_OUTPUT" | tail -n1 | cut -d= -f2-)
  fi
  rm -f "$GITHUB_OUTPUT"
  echo "$posted"
}

# Reset per-invocation env so the next scenario starts from a clean slate.
reset_invoke_env() {
  unset WEBHOOK FALLBACK_TEXT_IN MARKDOWN_IN CODE_BLOCK_IN
  unset STUB_HTTP_STATUS STUB_RESPONSE_BODY STUB_CURL_EXIT_CODE
  unset COMMIT_SHA COMMIT_URL RUN_URL
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

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  total=$((total + 1))
  if [[ "$haystack" == *"$needle"* ]]; then
    printf '  PASS  %-60s contains %q\n' "$label" "$needle"
  else
    printf '  FAIL  %-60s expected to contain=%q actual=%q\n' "$label" "$needle" "$haystack"
    failures=$((failures + 1))
  fi
}

assert_file_missing() {
  local label="$1" path="$2"
  total=$((total + 1))
  if [ ! -e "$path" ]; then
    printf '  PASS  %-60s (no curl invocation)\n' "$label"
  else
    printf '  FAIL  %-60s expected no file at %s\n' "$label" "$path"
    failures=$((failures + 1))
  fi
}

# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

echo
echo "## Scenario 1: webhook_url empty (forks / un-configured clones)"
reset_invoke_env
WEBHOOK="" \
  posted=$(invoke)
assert_eq          "empty-webhook posted"            "false" "$posted"
assert_file_missing "empty-webhook never called curl" "$TMPDIR_TEST/payload.json"

echo
echo "## Scenario 2: curl transport error (DNS / connection refused)"
reset_invoke_env
STUB_CURL_EXIT_CODE=6 \
  posted=$(invoke)
assert_eq "curl-transport-error posted" "false" "$posted"

echo
echo "## Scenario 3: Slack returns 5xx (e.g. 500)"
reset_invoke_env
STUB_HTTP_STATUS=500 STUB_RESPONSE_BODY="server_error" \
  posted=$(invoke)
assert_eq "slack-5xx posted" "false" "$posted"

echo
echo "## Scenario 4: Slack returns 4xx (e.g. 404 / invalid_payload)"
reset_invoke_env
STUB_HTTP_STATUS=404 STUB_RESPONSE_BODY="invalid_payload" \
  posted=$(invoke)
assert_eq "slack-4xx posted" "false" "$posted"

echo
echo "## Scenario 5: Slack returns 2xx (200)"
reset_invoke_env
STUB_HTTP_STATUS=200 STUB_RESPONSE_BODY="ok" \
  posted=$(invoke)
assert_eq "slack-200 posted" "true" "$posted"

echo
echo "## Scenario 6: Slack returns upper-boundary 2xx (299)"
reset_invoke_env
STUB_HTTP_STATUS=299 STUB_RESPONSE_BODY="ok" \
  posted=$(invoke)
assert_eq "slack-299 posted" "true" "$posted"

echo
echo "## Scenario 7: multiline markdown + every {token} substitutes"
reset_invoke_env
MARKDOWN_IN=$'*Deploy failed* on {commit_link}\nshort: {short_sha}\nrun: {run_url}\nurl: {commit_url}' \
  posted=$(invoke)
assert_eq "multiline-tokens posted" "true" "$posted"
payload=$(cat "$TMPDIR_TEST/payload.json")
# jq parses successfully -> payload is valid JSON
markdown_rendered=$(echo "$payload" | jq -r '.blocks[0].text.text')
assert_contains "multiline-tokens short_sha rendered" "abcdef1" "$markdown_rendered"
assert_contains "multiline-tokens commit_link rendered" \
  "<https://github.com/acme/medapp/commit/${DEFAULT_COMMIT_SHA}|abcdef1>" \
  "$markdown_rendered"
assert_contains "multiline-tokens commit_url rendered" \
  "https://github.com/acme/medapp/commit/${DEFAULT_COMMIT_SHA}" \
  "$markdown_rendered"
assert_contains "multiline-tokens run_url rendered" \
  "$DEFAULT_RUN_URL" "$markdown_rendered"
# Newlines preserved through jq render
total=$((total + 1))
if [ "$(echo "$markdown_rendered" | wc -l | tr -d ' ')" = "4" ]; then
  printf '  PASS  %-60s -> 4 lines preserved\n' "multiline-tokens preserves newlines"
else
  printf '  FAIL  %-60s -> got %s\n' "multiline-tokens preserves newlines" \
    "$(echo "$markdown_rendered" | wc -l)"
  failures=$((failures + 1))
fi
# No leftover unsubstituted {tokens} in the rendered markdown — guards
# against a typo in the action's gsub list silently shipping placeholders
# to Slack.
total=$((total + 1))
if echo "$markdown_rendered" | grep -qE '\{(short_sha|commit_link|commit_url|run_url)\}'; then
  leftover=$(echo "$markdown_rendered" | grep -oE '\{(short_sha|commit_link|commit_url|run_url)\}' | head -n1)
  printf '  FAIL  %-60s leftover token: %s\n' "multiline-tokens no leftover placeholders" "$leftover"
  failures=$((failures + 1))
else
  printf '  PASS  %-60s\n' "multiline-tokens no leftover placeholders"
fi

echo
echo "## Scenario 8: fallback_text (top-level Slack 'text' field) substitutes"
reset_invoke_env
FALLBACK_TEXT_IN="Deploy {short_sha} failed — run {run_url}" \
  posted=$(invoke)
assert_eq "fallback posted" "true" "$posted"
fallback_rendered=$(jq -r '.text' "$TMPDIR_TEST/payload.json")
assert_eq "fallback short_sha rendered" \
  "Deploy abcdef1 failed — run $DEFAULT_RUN_URL" \
  "$fallback_rendered"

echo
echo "## Scenario 9: code_block populated (payload has 2 blocks, second wraps in \`\`\`)"
reset_invoke_env
CODE_BLOCK_IN=$'line one\nline two\nline three' \
  posted=$(invoke)
assert_eq "code-block posted" "true" "$posted"
block_count=$(jq '.blocks | length' "$TMPDIR_TEST/payload.json")
assert_eq "code-block count"       "2" "$block_count"
second_block=$(jq -r '.blocks[1].text.text' "$TMPDIR_TEST/payload.json")
assert_contains "code-block opens with backticks"  '```' "$second_block"
assert_contains "code-block contains line one"     "line one"   "$second_block"
assert_contains "code-block contains line three"   "line three" "$second_block"

echo
echo "## Scenario 10: code_block empty (payload has only 1 block)"
reset_invoke_env
posted=$(invoke)
assert_eq "no-code-block posted" "true" "$posted"
block_count=$(jq '.blocks | length' "$TMPDIR_TEST/payload.json")
assert_eq "no-code-block count" "1" "$block_count"

echo
echo "## Scenario 11: markdown with backticks/quotes is JSON-safe"
reset_invoke_env
# Backticks are literal test data, not command substitution.
# shellcheck disable=SC2016
MARKDOWN_IN='Got `error` with "quotes" and \backslash on {commit_link}' \
  posted=$(invoke)
assert_eq "json-safe posted" "true" "$posted"
# jq -e fails (non-zero) if the file isn't valid JSON, which would be the
# canonical regression: a future "simplify the render with shell substitution"
# refactor that breaks jq escaping.
total=$((total + 1))
if jq -e . "$TMPDIR_TEST/payload.json" >/dev/null 2>&1; then
  printf '  PASS  %-60s\n' "json-safe payload parses as JSON"
else
  printf '  FAIL  %-60s payload was: %s\n' "json-safe payload parses as JSON" \
    "$(cat "$TMPDIR_TEST/payload.json")"
  failures=$((failures + 1))
fi
markdown_rendered=$(jq -r '.blocks[0].text.text' "$TMPDIR_TEST/payload.json")
# Assert the literal backticks survived rendering.
# shellcheck disable=SC2016
assert_contains "json-safe preserves backticks"  '`error`'    "$markdown_rendered"
assert_contains "json-safe preserves quotes"     '"quotes"'   "$markdown_rendered"
assert_contains "json-safe preserves backslash"  '\backslash' "$markdown_rendered"

# ---------------------------------------------------------------------------
# Drift check: extract the action's actual `run: |` block and verify its
# sha256 still matches the inlined replica above.
# ---------------------------------------------------------------------------

# Extract a single `run: |` block from action.yml by the step's `name:` line.
# Same extractor as scripts/test-slack-recovery-state.sh — mirrored here so
# this script stands alone with no shared-helper dependency.
extract_run_block() {
  local action_file="$1" name_substring="$2"
  awk -v needle="$name_substring" '
    /^[[:space:]]+- name:/ {
      in_step = (index($0, needle) > 0) ? 1 : 0
      collecting = 0
      next
    }
    in_step && /^[[:space:]]+run: \|[[:space:]]*$/ {
      match($0, /[^ ]/)
      run_indent = RSTART - 1
      content_indent = run_indent + 2
      collecting = 1
      next
    }
    collecting {
      if ($0 ~ /^[[:space:]]*$/) { print ""; next }
      match($0, /[^ ]/)
      this_indent = RSTART - 1
      if (this_indent < content_indent) {
        collecting = 0; in_step = 0
        next
      }
      print substr($0, content_indent + 1)
    }
  ' "$action_file"
}

echo
echo "## Drift check: action.yml run-block sha256"

post_actual=$(extract_run_block "$ACTION_FILE" "Post Slack notification" | sha256sum | awk '{print $1}')

drift=0
if [ "$post_actual" != "$EXPECTED_POST_SHA256" ]; then
  echo "  FAIL  post-slack run block drifted from inlined replica"
  echo "          expected: $EXPECTED_POST_SHA256"
  echo "          actual:   $post_actual"
  echo "        Update post_slack_step() above AND EXPECTED_POST_SHA256, then re-run."
  drift=1
else
  echo "  PASS  post-slack run block matches inlined replica ($post_actual)"
fi

echo
if [ "$failures" -gt 0 ] || [ "$drift" -gt 0 ]; then
  echo "FAILED: $failures/$total scenario assertions failed; drift=$drift"
  exit 1
fi
echo "OK: all $total scenario assertions passed; action.yml in sync with inlined replica."
