#!/usr/bin/env bash
# SOC 2 CC6.1 / CC6.7 / C1.2 — move backend credentials into Secret Manager (OWNER runs).
#
# Fixes the "plaintext secrets on disk" P0. Reads values from a LOCAL, gitignored `secrets.env`
# (so nothing lands in shell history or the repo), creates each Secret Manager secret, adds a
# version, and grants the Cloud Run runtime service account read access. The backend's
# cloudbuild.yaml already references these names via --set-secrets.
#
# Prereqs: `gcloud auth login` as an owner of sawd-ai. Run from anywhere.
# Usage:
#   1. Create secrets.env next to this script (gitignored), one KEY=value per secret:
#        ENCRYPTION_KEY=...
#        PLAID_CLIENT_ID=...
#        PLAID_SECRET=...
#        STRIPE_SECRET_KEY=...
#        STRIPE_WEBHOOK_SECRET=...
#        SENDGRID_API_KEY=...
#   2. bash setup-secrets.sh
#   3. Redeploy the backend, then ROTATE the old key values at each provider and
#      secure-delete every plaintext copy on the Desktop/OneDrive.
set -euo pipefail

PROJECT="sawd-ai"
SERVICE="sawd-backend"
REGION="us-central1"
SECRETS=(ENCRYPTION_KEY PLAID_CLIENT_ID PLAID_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET SENDGRID_API_KEY)

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/secrets.env"
[ -f "$ENV_FILE" ] || { echo "!! Create $ENV_FILE (gitignored) with the secret values first — see header."; exit 1; }

# Resolve the Cloud Run runtime SA (falls back to the default compute SA).
RUNTIME_SA="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [ -z "$RUNTIME_SA" ]; then
  PNUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
  RUNTIME_SA="${PNUM}-compute@developer.gserviceaccount.com"
fi
echo "→ runtime service account: $RUNTIME_SA"

set -a; . "$ENV_FILE"; set +a

for name in "${SECRETS[@]}"; do
  val="${!name:-}"
  if [ -z "$val" ]; then echo "· skip $name (absent in secrets.env)"; continue; fi
  if ! gcloud secrets describe "$name" --project "$PROJECT" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic --project "$PROJECT" >/dev/null
  fi
  printf '%s' "$val" | gcloud secrets versions add "$name" --data-file=- --project "$PROJECT" >/dev/null
  gcloud secrets add-iam-policy-binding "$name" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role=roles/secretmanager.secretAccessor --project "$PROJECT" >/dev/null
  echo "✓ $name stored + accessor granted"
done

echo
echo "Done. Next:"
echo "  1) Redeploy sawd-backend (cloudbuild wires --set-secrets to these)."
echo "  2) ROTATE each value at its provider (Plaid/Stripe/SendGrid) — assume the old ones leaked."
echo "  3) Secure-delete the plaintext copies on the Desktop/OneDrive, then empty the recycle bin."
echo "  4) Delete $ENV_FILE when finished."
