#!/bin/bash
# Tabula Medica - GCP Cloud Run Deployment Script
# HIPAA-compliant deployment with VPC connector and minimal IAM
set -euo pipefail

# Configuration - Set these before deployment
PROJECT_ID="${GCP_PROJECT_ID:?'GCP_PROJECT_ID must be set'}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="tabula-medica"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
SERVICE_ACCOUNT="phi-handler@${PROJECT_ID}.iam.gserviceaccount.com"
VPC_CONNECTOR="${VPC_CONNECTOR_NAME:-med-vpc-connector}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:med-db}"

echo "=== Tabula Medica GCP Deployment ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"

# Step 1: Build and push to Artifact Registry
echo ""
echo "[1/4] Building and pushing container image..."
gcloud builds submit --tag "${IMAGE_NAME}" --project="${PROJECT_ID}"

# Step 2: Deploy to Cloud Run
echo ""
echo "[2/4] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_NAME}" \
  --platform managed \
  --region "${REGION}" \
  --no-allow-unauthenticated \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars="NODE_ENV=production" \
  --add-cloudsql-instances="${CLOUD_SQL_INSTANCE}" \
  --vpc-connector="${VPC_CONNECTOR}" \
  --memory=1Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=10 \
  --timeout=300 \
  --concurrency=80 \
  --port=8080 \
  --project="${PROJECT_ID}"

# Step 3: Verify deployment
echo ""
echo "[3/4] Verifying deployment..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo "Service URL: ${SERVICE_URL}"

# Step 4: Run health check
echo ""
echo "[4/4] Running health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/health" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" || echo "000")

if [ "${HEALTH_STATUS}" = "200" ]; then
  echo "Health check PASSED"
else
  echo "WARNING: Health check returned status ${HEALTH_STATUS}"
  echo "The service may still be starting up. Check logs with:"
  echo "  gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
fi

echo ""
echo "=== Deployment Complete ==="
echo "Service: ${SERVICE_URL}"
echo "Logs: gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
