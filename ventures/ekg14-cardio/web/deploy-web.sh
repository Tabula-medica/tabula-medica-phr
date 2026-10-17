#!/usr/bin/env bash
# Deploy DextroHeart bench to GCS (secondary/backup path).
# Primary: Cloudflare Pages (wrangler pages deploy from repo root).
# GCS project: dextroheart-com (GCP project tabula-mds-2026 or dedicated project).
# Bucket: gs://dextroheart-bench-site  — change to the discovered bucket name.
# Usage: bash web/deploy-web.sh
set -euo pipefail

BUCKET="${DEXTROHEART_BUCKET:-gs://dextroheart-bench}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
PUBLIC="$ROOT/public"

echo "Deploying DextroHeart bench to $BUCKET ..."
gcloud storage rsync "$PUBLIC" "$BUCKET" --recursive --delete-unmatched-destination-objects
gcloud storage objects update "$BUCKET/index.html" --content-type="text/html; charset=utf-8" --cache-control="no-store"
echo "Done. Live (GCS): https://storage.googleapis.com/${BUCKET#gs://}/index.html"
