#!/usr/bin/env bash
# SessionStart hook: make the Playwright CLI available in every Claude Code web session.
# Installs project deps (pins @playwright/test) and points Playwright at the pre-staged Chromium.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers'
    echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
    echo 'export PATH="$PWD/node_modules/.bin:$PATH"'
  } >> "$CLAUDE_ENV_FILE"
fi

if [ ! -x node_modules/.bin/playwright ]; then
  npm install --no-audit --no-fund --prefer-offline
fi

# Supabase CLI (standalone binary; npm global installs of `supabase` are unsupported).
if ! command -v supabase >/dev/null 2>&1; then
  bin_dir="$HOME/.local/bin"
  mkdir -p "$bin_dir"
  curl -sSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    | tar xz -C "$bin_dir" supabase || echo "supabase CLI install failed (non-fatal)" >&2
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$bin_dir:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
