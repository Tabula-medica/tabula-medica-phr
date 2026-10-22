#!/usr/bin/env bash
# Stop hook: run the PHI-AI boundary guard before a session ends.
# Exit 2 sends the guard output back to Claude so a non-BAA AI endpoint is fixed
# before the session stops. If the hook already fired once this turn
# (stop_hook_active), exit 0 to avoid a loop.
set -uo pipefail

input="$(cat || true)"
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
[ -f scripts/phi-ai-guard.sh ] || exit 0

if ! out="$(bash scripts/phi-ai-guard.sh 2>&1)"; then
  printf '%s\n' "$out" >&2
  exit 2
fi
