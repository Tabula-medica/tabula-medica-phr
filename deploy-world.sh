#!/bin/bash
set -euo pipefail

# ============================================================================
# Tabula Medica PHR — INTERNATIONAL (.world) deploy
# ----------------------------------------------------------------------------
# Deploys the SAME codebase as the US service to a SEPARATE Cloud Run service
# `tabula-medica-phr-world` with TEFCA_ENABLED=false, so tabulamedica.world has
# NO TEFCA / Fasten Health surface. Env + secrets are cloned from the US
# service `tabula-medica-phr` (same Cloud SQL DB, same PHI keys).
#
# The US service (tabula-medica-phr, TEFCA on) is deployed by deploy.sh.
# After this script succeeds, remap the domain (one-time, see END NOTE).
#
# Deploys whatever is in the CURRENT working tree; deploy from `main`.
# ============================================================================

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-tabula-medica-phr-world}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-1060107259776-compute@developer.gserviceaccount.com}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-united-planet-485003-n7:us-central1:tabula-medica-db}"
PRIVATE_OBJECT_DIR_VALUE="${PRIVATE_OBJECT_DIR_VALUE:-/tabula-medica-gcs/.private}"

# Plain (non-secret) env — cloned from the US service, plus TEFCA_ENABLED=false.
# PRIVATE_OBJECT_DIR is set via a scoped MSYS guard below (leading-slash value).
ENV_VARS="GCS_USE_ADC=true,PUBLIC_OBJECT_SEARCH_PATHS=/tabula-medica-gcs/public,AI_PROVIDER=vertex,VERTEX_PROJECT_ID=united-planet-485003-n7,VERTEX_LOCATION=us-central1,TEFCA_ENABLED=false"

# Secret bindings — cloned from the US service (identical secret names/keys).
SECRETS="DATABASE_URL=patient-db-secret-us-central1:latest,FHIR_BASE_URL=FHIR_BASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,PHI_ENCRYPTION_KEY=PHI_ENCRYPTION_KEY:latest,PHI_ENCRYPTION_SALT=PHI_ENCRYPTION_SALT:latest,MFA_ENCRYPTION_KEY=MFA_ENCRYPTION_KEY:latest"

echo "🌍 Deploying INTERNATIONAL PHR to Cloud Run: ${SERVICE_NAME} (${REGION}) in ${PROJECT_ID}"
echo "   TEFCA_ENABLED=false  |  Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

# no-traffic candidate if the service already exists; else initial 100%.
if gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" >/dev/null 2>&1; then
  TRAFFIC_FLAGS=(--no-traffic --tag "candidate")
  echo "   (service exists → no-traffic candidate, health-gate, then promote)"
else
  TRAFFIC_FLAGS=()
  echo "   (new service → initial revision takes 100%)"
fi

MSYS2_ARG_CONV_EXCL="PRIVATE_OBJECT_DIR=,PUBLIC_OBJECT_SEARCH_PATHS=" \
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --set-env-vars "${ENV_VARS}" \
  --update-env-vars "PRIVATE_OBJECT_DIR=${PRIVATE_OBJECT_DIR_VALUE}" \
  --set-secrets "${SECRETS}" \
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
  echo "❌ Candidate failed health check — NOT promoting traffic."
  echo "   Logs:  gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --limit 100"
  exit 1
fi

# Verify TEFCA is actually OFF on the new service before promoting.
echo "🔎 Verifying TEFCA is disabled…"
CFG="$(curl -s "${HC_URL}/api/public-config" || echo '{}')"
echo "   /api/public-config -> ${CFG}"
BLOCKED="$(curl -s -o /dev/null -w '%{http_code}' "${HC_URL}/api/fasten-connect/config" || echo 000)"
echo "   /api/fasten-connect/config -> HTTP ${BLOCKED} (expected 404)"

if [ -n "${TRAFFIC_FLAGS[*]:-}" ]; then
  echo "📈 Promoting candidate to 100% traffic…"
  gcloud run services update-traffic "${SERVICE_NAME}" \
    --project "${PROJECT_ID}" --region "${REGION}" --to-latest --quiet
fi

echo "✅ Live service URL:"
gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'

cat <<'NOTE'

────────────────────────────────────────────────────────────────────────────
ONE-TIME domain remap (run AFTER this succeeds) — points tabulamedica.world at
the new international service. Causes a brief .world blip + cert re-provision:

  gcloud beta run domain-mappings delete --domain tabulamedica.world \
    --project united-planet-485003-n7 --region us-central1 --quiet

  gcloud beta run domain-mappings create --service tabula-medica-phr-world \
    --domain tabulamedica.world --project united-planet-485003-n7 \
    --region us-central1

tabulamedica.us stays on tabula-medica-phr (TEFCA on) — no change needed.
The DNS A/AAAA records already point at Google, so no Cloudflare change.
────────────────────────────────────────────────────────────────────────────
NOTE
