#!/bin/bash
set -euo pipefail

# ============================================================================
# Tabula Medica PHR — canonical production deploy (us-central1)
# ----------------------------------------------------------------------------
# Server-side build from source via Cloud Build (NO local Docker required) and
# deploy to the LIVE Cloud Run service `tabula-medica-phr`, wired to the PHI
# database (Cloud SQL `tabula-medica-db`, us-central1).
#
# Replaces the old script, which was broken for this repo:
#   - it ran a LOCAL `docker build` (Docker isn't installed on the dev box), and
#   - it deployed to `tabula-medica-service`, NOT the live `tabula-medica-phr`.
#
# This deploys whatever is in the CURRENT working tree / checked-out branch.
# Deploy from the intended branch (e.g. `main` after the PR is merged).
#
# ENV VARS + SECRETS are intentionally NOT set here — they are already
# configured on the live service and are PRESERVED across `gcloud run deploy`
# (this command only updates the image + the infra flags below). The live
# config is documented at the bottom for disaster-recovery reference; do not
# uncomment unless recreating the service from scratch.
# ============================================================================

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-tabula-medica-phr}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-1060107259776-compute@developer.gserviceaccount.com}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-united-planet-485003-n7:us-central1:tabula-medica-db}"

echo "🚀 Deploying PHR to Cloud Run: ${SERVICE_NAME} (${REGION}) in ${PROJECT_ID}"
echo "   Source build via Cloud Build (uses the repo Dockerfile). Env/secrets preserved."
echo "   Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')  Commit: $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SERVICE_ACCOUNT}" \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --cpu 2 \
  --memory 2Gi \
  --concurrency 160 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 10 \
  --ingress all \
  --allow-unauthenticated \
  --port 8080 \
  --quiet

echo "✅ Deployed. Service URL:"
gcloud run services describe "${SERVICE_NAME}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'

# ----------------------------------------------------------------------------
# DISASTER-RECOVERY REFERENCE ONLY — live env/secrets as of 2026-07-19.
# These persist across normal deploys; only needed when recreating the service.
# Plain env vars:
#   GCS_USE_ADC=true
#   AI_PROVIDER=vertex   (PHI AI must stay on Vertex — never Anthropic/OpenAI)
#   VERTEX_PROJECT_ID=united-planet-485003-n7
#   VERTEX_LOCATION=us-central1
#   PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS  (⚠ live value of
#     PRIVATE_OBJECT_DIR is a Windows path — looks wrong for a Linux container;
#     preserved as-is here, NOT re-asserted. Investigate separately.)
# Secrets (name=secret): DATABASE_URL=patient-db-secret-us-central1,
#   FHIR_BASE_URL=FHIR_BASE_URL, OPENAI_API_KEY=OPENAI_API_KEY,
#   SESSION_SECRET=SESSION_SECRET, PHI_ENCRYPTION_KEY=PHI_ENCRYPTION_KEY,
#   PHI_ENCRYPTION_SALT=PHI_ENCRYPTION_SALT, MFA_ENCRYPTION_KEY=MFA_ENCRYPTION_KEY
# To recreate, add:  --set-env-vars "K=V,..."  --set-secrets "K=secret:latest,..."
# ----------------------------------------------------------------------------
