#!/usr/bin/env bash
# Pre-build gate: verify the iOS Google client ID is configured before an EAS
# iOS production build starts. Mirrors the resolve() logic in app.config.js and
# the cleanExtraValue() filter in client/lib/gcip.ts.
#
# A missing or unsubstituted EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID caused a
# Guideline 2.1(a) launch crash in App Review (the useIdTokenAuthRequest hook
# throws a render-time invariant when its iosClientId is undefined). The
# runtime guard in gcip.ts hides the Google button in that case, but it cannot
# prevent a crash that occurs before the guard runs if the hook is wired
# unconditionally. This script blocks the build before that situation can ship.
#
# Resolution precedence (matches app.config.js):
#   1. EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID env var (EAS secret / CI secret)
#   2. Committed app.json extra.googleIosClientId  →  always "$EXPO_PUBLIC_…"
#      (treated as unset, same as the env var being a bare placeholder)
#
# Decision: FAIL the build when the value is absent or an unsubstituted
# "$EXPO_PUBLIC_*" placeholder. Shipping silently with Google Sign-In disabled
# caused an App Review rejection; we do not allow a silent pass.
#
# Usage (called automatically by the eas-build-ios CI job):
#   ./scripts/check-ios-google-client-id.sh
#
# The check can be bypassed for intentional Google-Sign-In-less builds by
# setting SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1 — this emits a loud warning and
# exits 0 so the build continues.

set -euo pipefail

BYPASS="${SKIP_IOS_GOOGLE_CLIENT_ID_CHECK:-}"

echo "==> iOS Google client ID pre-build check"
echo "    (guards against Guideline 2.1(a) launch-crash regression)"
echo

CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-}"

# Mirror cleanExtraValue() from client/lib/gcip.ts:
#   - empty string → unset
#   - starts with "$EXPO_PUBLIC_" or "${EXPO_PUBLIC_" → unsubstituted placeholder
is_placeholder() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" == \$EXPO_PUBLIC_* ]] && return 0
  [[ "$val" == "\${EXPO_PUBLIC_"* ]] && return 0
  return 1
}

if is_placeholder "$CLIENT_ID"; then
  echo "  ERROR  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is missing or still an"
  echo "         unsubstituted placeholder (got: '${CLIENT_ID:-<empty>}')."
  echo
  echo "  The iOS Google Sign-In hook (useIdTokenAuthRequest) throws a render-time"
  echo "  invariant when iosClientId is undefined, which crashes the app at launch"
  echo "  on the reviewer's device (App Review Guideline 2.1(a))."
  echo
  echo "  Fix: set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in EAS Secrets for the"
  echo "  'production' profile (Expo dashboard → Project → Secrets) and re-run"
  echo "  the build."
  echo
  if [[ -n "$BYPASS" ]]; then
    echo "  BYPASS  SKIP_IOS_GOOGLE_CLIENT_ID_CHECK=1 is set."
    echo "          Continuing with Google Sign-In DISABLED in this build."
    echo "          This is intentional and must be documented before shipping."
    echo
    exit 0
  fi
  exit 1
fi

echo "  PASS   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set"
echo "         (${#CLIENT_ID} chars, ends: …${CLIENT_ID: -6})"
echo
exit 0
