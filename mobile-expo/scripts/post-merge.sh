#!/usr/bin/env bash
# Runs after every task merge. Must be idempotent, non-interactive, fail-fast.
# Stdin is closed by the platform — never use commands that prompt.
set -euo pipefail

echo "[post-merge] npm install (ci-style, respects lockfile)"
# Use `npm install` not `npm ci` — task merges sometimes change package.json
# without regenerating package-lock.json in the same commit, and `ci` aborts
# on lockfile drift. `install` reconciles and is still idempotent.
npm install --no-audit --no-fund --prefer-offline

# Push Drizzle schema to the dev database. `--force` skips the interactive
# "data loss" prompt (stdin is closed so the prompt would EOF and fail).
# Tolerate a missing DATABASE_URL — some merges land before the env var is
# wired, and we don't want the post-merge to wedge the whole pipeline on it.
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[post-merge] drizzle-kit push --force"
  npm run db:push -- --force || {
    echo "[post-merge] db:push failed — continuing anyway (manual fix may be needed)"
  }
else
  echo "[post-merge] DATABASE_URL not set — skipping db:push"
fi

# ---------------------------------------------------------------------------
# Push to GitHub so origin/main never falls behind the Replit-managed local
# branch. The Replit platform merges task agents into the local git repo but
# does NOT push to GitHub automatically. Without this step, origin/main can
# fall hundreds of commits behind, forcing a risky force-push to recover.
#
# Requirements:
#   GITHUB_PERSONAL_ACCESS_TOKEN  — Replit secret, repo scope (push access).
# Optional:
#   SLACK_WEBHOOK_URL             — fires an alert if the push fails.
#
# Design: push failures are non-fatal. The rest of the post-merge pipeline
# must not be blocked by a transient network issue or a diverged remote.
# Instead, we alert immediately so the team knows to intervene rather than
# discovering the divergence 300 commits later.
# ---------------------------------------------------------------------------
_gh_slack_alert() {
  local msg="$1"
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -s -o /dev/null -w "" -X POST \
      -H "Content-Type: application/json" \
      --data "{\"text\":\"${msg}\"}" \
      "${SLACK_WEBHOOK_URL}" || true
  fi
}

if [ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  echo "[post-merge] WARNING: GITHUB_PERSONAL_ACCESS_TOKEN not set — skipping GitHub push."
  echo "[post-merge] Add this secret to keep origin/main in sync after every task merge."
else
  CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  PUSH_URL="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/Tabula-medica/tabula-medica-mobile.git"

  echo "[post-merge] Pushing ${CURRENT_BRANCH} (${CURRENT_COMMIT}) to GitHub …"

  # Capture stdout+stderr so we can redact the token before printing.
  # Run in a subshell to isolate exit-code capture from pipefail.
  PUSH_OUTPUT=""
  PUSH_EXIT=0
  PUSH_OUTPUT=$(git push --quiet "${PUSH_URL}" "HEAD:refs/heads/${CURRENT_BRANCH}" 2>&1) \
    || PUSH_EXIT=$?

  # Redact any accidental token echo in git output.
  PUSH_OUTPUT_SAFE="${PUSH_OUTPUT//$GITHUB_PERSONAL_ACCESS_TOKEN/***}"
  [ -n "${PUSH_OUTPUT_SAFE}" ] && echo "${PUSH_OUTPUT_SAFE}"

  if [ "${PUSH_EXIT}" -eq 0 ]; then
    echo "[post-merge] GitHub push succeeded (commit ${CURRENT_COMMIT})."
  else
    echo "[post-merge] ERROR: GitHub push FAILED (exit ${PUSH_EXIT}, commit ${CURRENT_COMMIT})."
    echo "[post-merge] Manual push required. Branches may have diverged — review remote history before force-pushing."
    _gh_slack_alert \
      ":rotating_light: *Tabula Medica \u2014 GitHub push FAILED* after post-merge run.\\nBranch: \`${CURRENT_BRANCH}\`  Commit: \`${CURRENT_COMMIT}\`\\nThe Replit repo is ahead of GitHub origin. Manual reconciliation required.\\nCheck: https://github.com/Tabula-medica/tabula-medica-mobile/compare"
  fi
fi

echo "[post-merge] done"
