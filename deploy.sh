#!/bin/bash
set -euo pipefail

# Windows Git-Bash guard: STOP MSYS from rewriting a leading-slash arg like
# /tabula-medica-gcs/.private into C:/Program Files/Git/... (that mangling is
# exactly what broke PRIVATE_OBJECT_DIR on the live service). Harmless on Linux.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

# ============================================================================
# Tabula Medica PHR — production deploy (us-central1)
# ----------------------------------------------------------------------------
# Server-side build from source via Cloud Build (NO local Docker) to the live
# Cloud Run service `tabula-medica-phr`, wired to the PHI database
# (Cloud SQL `tabula-medica-db`, us-central1).
#
# IMPORTANT — this service uses a PINNED-TRAFFIC workflow (many tagged
# revisions; traffic pinned to one revision by NAME). A plain `gcloud run
# deploy` creates a new revision but does NOT move traffic to it, so the new
# code silently serves 0%. This script therefore: deploys a --no-traffic
# candidate, health-checks it, then PROMOTES it with `update-traffic --to-latest`.
#
# It also re-asserts the correct PRIVATE_OBJECT_DIR (the live value was a
# mangled Windows path, which breaks private uploads incl. advance-directive
# form uploads). Other env vars + secrets are preserved.
#
# Deploys whatever is in the CURRENT working tree; deploy from `main`.
# ============================================================================

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-tabula-medica-phr}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-1060107259776-compute@developer.gserviceaccount.com}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-united-planet-485003-n7:us-central1:tabula-medica-db}"
# GCS object-storage paths (bucket = tabula-medica-gcs). Leading-slash form
# REQUIRED (parseObjectPath expects /<bucket>/<prefix>); MSYS guard above keeps
# it intact.
PRIVATE_OBJECT_DIR_VALUE="${PRIVATE_OBJECT_DIR_VALUE:-/tabula-medica-gcs/.private}"

echo "🚀 Deploying PHR to Cloud Run: ${SERVICE_NAME} (${REGION}) in ${PROJECT_ID}"
echo "   Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

# Deploy a no-traffic candidate on an existing service (this one always exists);
# fall back to a first-deploy 100% only if the service is somehow missing.
if gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" >/dev/null 2>&1; then
  TRAFFIC_FLAGS=(--no-traffic --tag "candidate")
  echo "   (service exists → no-traffic candidate, health-gate, then promote)"
else
  TRAFFIC_FLAGS=()
  echo "   (new service → initial revision takes 100%)"
fi

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --update-env-vars "PRIVATE_OBJECT_DIR=${PRIVATE_OBJECT_DIR_VALUE}" \
  --cpu 2 \
  --memory 2Gi \
  --concurrency 160 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 10 \
  --ingress all \
  --allow-unauthenticated \
  --port 8080 \
  "${TRAFFIC_FLAGS[@]}" \
  --quiet

# ---- Health-check the candidate before promoting ----
SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)' 2>/dev/null)"
TAG_URL="$(gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='json' 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const t=(j.status.traffic||[]).find(x=>x.tag==='candidate');console.log(t&&t.url?t.url:'')}catch(e){console.log('')}})" 2>/dev/null || true)"
HC_URL="${TAG_URL:-$SERVICE_URL}"

echo "🩺 Health-checking ${HC_URL}/health"
OK=0
for i in 1 2 3 4 5 6; do
  STATUS="$(curl -s -o /dev/null -w '%{http_code}' "${HC_URL}/health" || echo 000)"
  if [ "$STATUS" = "200" ]; then echo "✅ Healthy (attempt $i)"; OK=1; break; fi
  echo "   attempt $i: HTTP $STATUS — retrying in 15s…"; sleep 15
done

if [ "$OK" != "1" ]; then
  echo "❌ Candidate failed health check — NOT promoting traffic (old revision stays live)."
  echo "   Logs:  gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --limit 100"
  exit 1
fi

echo "📈 Promoting candidate to 100% traffic (fixes the pinned-traffic issue)…"
gcloud run services update-traffic "${SERVICE_NAME}" \
  --project "${PROJECT_ID}" --region "${REGION}" --to-latest --quiet

echo "✅ Live:"
gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'
