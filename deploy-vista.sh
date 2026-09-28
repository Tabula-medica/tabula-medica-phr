#!/bin/bash
set -euo pipefail

# ============================================================================
# Vista PD (vista-pd.com) deploy — a Tabula Medica LLC service
# ----------------------------------------------------------------------------
# Deploys the SAME codebase to a SEPARATE Cloud Run service `vista-pd`, with the
# client built as VITE_BRAND=vista (Vista PD landing page, narrowed to the
# Parkinson's speech screening + UPDRS tools). Env + secrets are cloned from the
# US service (same Cloud SQL DB, same PHI keys), like deploy-world.sh.
#
# `gcloud run deploy --source` cannot pass Docker build args, so this script
# builds the image with Cloud Build first, then deploys that image.
#
# Deploys whatever is in the CURRENT working tree; deploy from `main`.
# One-time domain + auth setup is printed at the end (see END NOTE).
# ============================================================================

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-vista-pd}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-1060107259776-compute@developer.gserviceaccount.com}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-united-planet-485003-n7:us-central1:tabula-medica-db}"
PRIVATE_OBJECT_DIR_VALUE="${PRIVATE_OBJECT_DIR_VALUE:-/tabula-medica-gcs/.private}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:$(git rev-parse --short HEAD 2>/dev/null || date +%s)"

# Plain (non-secret) env — cloned from the US service. TEFCA/Fasten are not part
# of Vista PD, so they are off.
ENV_VARS="GCS_USE_ADC=true,PUBLIC_OBJECT_SEARCH_PATHS=/tabula-medica-gcs/public,AI_PROVIDER=vertex,VERTEX_PROJECT_ID=united-planet-485003-n7,VERTEX_LOCATION=us-central1,TEFCA_ENABLED=false"

# Secret bindings — cloned from the US service (identical secret names/keys).
SECRETS="DATABASE_URL=patient-db-secret-us-central1:latest,FHIR_BASE_URL=FHIR_BASE_URL:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,PHI_ENCRYPTION_KEY=PHI_ENCRYPTION_KEY:latest,PHI_ENCRYPTION_SALT=PHI_ENCRYPTION_SALT:latest,MFA_ENCRYPTION_KEY=MFA_ENCRYPTION_KEY:latest"

echo "🧠 Deploying Vista PD to Cloud Run: ${SERVICE_NAME} (${REGION}) in ${PROJECT_ID}"
echo "   Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
echo "   Image:  ${IMAGE}"

# ---- Build the image with VITE_BRAND=vista ----
BUILD_CONFIG="$(mktemp)"
trap 'rm -f "${BUILD_CONFIG}"' EXIT
cat > "${BUILD_CONFIG}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "--build-arg", "VITE_BRAND=vista", "-t", "${IMAGE}", "."]
images: ["${IMAGE}"]
options:
  machineType: E2_HIGHCPU_8
timeout: 1800s
EOF
gcloud builds submit . --project "${PROJECT_ID}" --region "${REGION}" --config "${BUILD_CONFIG}"

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
  --image "${IMAGE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --set-env-vars "${ENV_VARS}" \
  --update-env-vars "PRIVATE_OBJECT_DIR=${PRIVATE_OBJECT_DIR_VALUE}" \
  --set-secrets "${SECRETS}" \
  --cpu 1 \
  --memory 2Gi \
  --concurrency 160 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 5 \
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

# Refuse to promote a build that isn't actually Vista-branded.
echo "🔎 Verifying the Vista PD build is being served…"
if ! curl -s "${HC_URL}/" | grep -q "Vista PD"; then
  echo "❌ ${HC_URL}/ does not contain 'Vista PD' — image was not built with VITE_BRAND=vista. NOT promoting."
  exit 1
fi
echo "   ✅ Vista PD branding confirmed"

if [ -n "${TRAFFIC_FLAGS[*]:-}" ]; then
  echo "📈 Promoting candidate to 100% traffic…"
  gcloud run services update-traffic "${SERVICE_NAME}" \
    --project "${PROJECT_ID}" --region "${REGION}" --to-latest --quiet
fi

echo "✅ Live service URL:"
gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'

cat <<'NOTE'

────────────────────────────────────────────────────────────────────────────
ONE-TIME SETUP for vista-pd.com (run once, AFTER the first successful deploy)

1. Map the domains to the service:

  gcloud beta run domain-mappings create --service vista-pd \
    --domain vista-pd.com --project united-planet-485003-n7 --region us-central1

  gcloud beta run domain-mappings create --service vista-pd \
    --domain www.vista-pd.com --project united-planet-485003-n7 --region us-central1

2. Add the DNS records Google asks for at your domain registrar. List them with:

  gcloud beta run domain-mappings describe --domain vista-pd.com \
    --project united-planet-485003-n7 --region us-central1

   (apex: A + AAAA records; www: a CNAME to ghs.googlehosted.com).
   The managed TLS certificate provisions automatically once DNS resolves.

3. Allow sign-in on the new domain: Google Cloud console → Identity Platform →
   Settings → Authorized domains → add vista-pd.com and www.vista-pd.com.
   Without this, GCIP sign-in fails on vista-pd.com with auth/unauthorized-domain.

4. If the GCIP browser API key has an HTTP-referrer allowlist, add
   https://vista-pd.com/* and https://www.vista-pd.com/* to it.
────────────────────────────────────────────────────────────────────────────
NOTE
