#!/usr/bin/env bash
# Pre-build gate: verify the Android Google client ID is configured before an EAS
# Android production build starts. Companion to scripts/check-ios-google-client-id.sh
# and mirrors the resolve() logic in app.config.js and the cleanExtraValue()
# filter in client/lib/gcip.ts (the Android branch of isGoogleClientConfigured).
#
# A missing or unsubstituted EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID does not crash
# the app at launch (the gcip.ts runtime guard hides the Google button on Android
# when the client ID is absent), but it ships a release with Google Sign-In
# silently broken on Android and no pipeline signal. This script blocks the build
# before that situation can reach the Play Store.
#
# Resolution precedence (matches app.config.js):
#   1. EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID env var (EAS secret / CI secret)
#   2. Committed app.json extra.googleAndroidClientId  →  always
#      "$EXPO_PUBLIC_…" (treated as unset, same as a bare placeholder)
#
# Decision: FAIL the build when the value is absent or an unsubstituted
# "$EXPO_PUBLIC_*" placeholder. Shipping silently with Google Sign-In disabled on
# Android is the same class of defect the iOS gate guards against; we do not allow
# a silent pass.
#
# Usage (called automatically by the eas-build-android CI job):
#   ./scripts/check-android-google-client-id.sh
#
# The check can be bypassed for intentional Google-Sign-In-less builds by
# setting SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1 — this emits a loud warning and
# exits 0 so the build continues.

set -euo pipefail

BYPASS="${SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK:-}"

echo "==> Android Google client ID pre-build check"
echo "    (guards against shipping with Google Sign-In silently broken)"
echo

CLIENT_ID="${EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID:-}"

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
  echo "  ERROR  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is missing or still an"
  echo "         unsubstituted placeholder (got: '${CLIENT_ID:-<empty>}')."
  echo
  echo "  Without it, isGoogleClientConfigured() returns false on Android, so the"
  echo "  Google Sign-In button is hidden and Google login is silently broken in"
  echo "  the shipped Play Store build."
  echo
  echo "  Fix: set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in EAS Secrets for the"
  echo "  'production' profile (Expo dashboard → Project → Secrets) and re-run"
  echo "  the build."
  echo
  if [[ -n "$BYPASS" ]]; then
    echo "  BYPASS  SKIP_ANDROID_GOOGLE_CLIENT_ID_CHECK=1 is set."
    echo "          Continuing with Google Sign-In DISABLED in this build."
    echo "          This is intentional and must be documented before shipping."
    echo
    exit 0
  fi
  exit 1
fi

echo "  PASS   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is set"
echo "         (${#CLIENT_ID} chars, ends: …${CLIENT_ID: -6})"
echo
exit 0
