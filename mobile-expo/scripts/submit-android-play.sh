#!/usr/bin/env bash
#
# One-click submit of an existing EAS Android build to Google Play.
#
# Submits the already-built AAB on EAS servers to the Play "internal" track as a
# DRAFT (per eas.json submit.production.android). No rebuild is performed.
#
# Run this ONLY after Google Play has applied the upload-key reset for the new
# signing key (SHA1 38:35..., cert in exports/upload-key-reset/upload_certificate.pem).
# Submitting before the reset is applied will be REJECTED by Google with a
# signing-key mismatch.
#
# Required env (already present as Replit secrets):
#   EXPO_TOKEN                         - EAS auth
#   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  - Play Developer API service account (JSON)
#
# Optional:
#   BUILD_ID  - EAS build id to submit. Defaults to the known versionCode-27 build.
#               Override to submit a different/newer build, e.g.
#                 BUILD_ID=<uuid> bash scripts/submit-android-play.sh
#
set -euo pipefail

# Default to the versionCode-27 production build (1.0.0). Override via BUILD_ID env.
BUILD_ID="${BUILD_ID:-71dd0969-6e95-4c45-8ed0-9f2a8eac3e07}"
SA_FILE="./google-service-account.json"   # gitignored; path referenced by eas.json

fail() { echo "ERROR: $*" >&2; exit 1; }

[ -n "${EXPO_TOKEN:-}" ] || fail "EXPO_TOKEN is not set."
[ -n "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}" ] || fail "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set."

# Validate the secret is parseable JSON and looks like a service account.
node -e '
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  let j;
  try { j = JSON.parse(raw); } catch (e) { console.error("not valid JSON:", e.message); process.exit(1); }
  if (j.type !== "service_account" || !j.client_email || !j.private_key) {
    console.error("JSON is not a service-account key (missing type/client_email/private_key)");
    process.exit(1);
  }
  console.error("Service account: " + j.client_email);
' || fail "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not a valid service-account key."

# Materialize the service account file and guarantee cleanup on any exit.
cleanup() { rm -f "$SA_FILE"; }
trap cleanup EXIT INT TERM

umask 077
printf '%s' "$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" > "$SA_FILE"

echo "Submitting EAS build $BUILD_ID to Google Play (internal track, draft)..."

EAS_NO_VCS=1 npx eas-cli@latest submit \
  --platform android \
  --profile production \
  --id "$BUILD_ID" \
  --non-interactive

echo "Submit command finished. Verify status in Play Console > Internal testing (draft)."
