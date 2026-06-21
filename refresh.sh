#!/bin/bash
set -e

PROJECT_ID="united-planet-485003-n7"
REGION="us-central1"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/tabula-medica-api:latest"
SERVICE="tabula-medica-service"
SERVICE_ACCOUNT="tabula-medica-app-runner@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Step 1: Building application locally ==="
echo "Cleaning dist directory..."
rm -rf dist

echo "Building client and server..."
NODE_OPTIONS="--max-old-space-size=4096" npx tsx script/build-production.ts

if [ ! -f dist/index.cjs ]; then
  echo "ERROR: Build failed - dist/index.cjs not found"
  exit 1
fi
echo "Local build completed successfully!"
echo "  dist/index.cjs: $(du -h dist/index.cjs | cut -f1)"
echo "  dist/public: $(du -sh dist/public 2>/dev/null | cut -f1 || echo 'N/A')"

echo ""
echo "=== Step 2: Submitting Docker build to Cloud Build ==="
BUILD_OUTPUT=$(gcloud builds submit --config=cloudbuild.yaml --project "${PROJECT_ID}" --async . 2>&1)
echo "${BUILD_OUTPUT}"
BUILD_ID=$(echo "${BUILD_OUTPUT}" | grep -oP 'builds/\K[a-f0-9-]+' | head -1)
echo "Build ID: ${BUILD_ID}"
echo "Waiting for Docker image build..."

while true; do
  STATUS=$(gcloud builds describe "${BUILD_ID}" --project "${PROJECT_ID}" --format="value(status)" 2>/dev/null)
  echo "  Build status: ${STATUS}"
  if [ "${STATUS}" = "SUCCESS" ]; then
    echo "Docker image built and pushed successfully!"
    break
  elif [ "${STATUS}" = "FAILURE" ] || [ "${STATUS}" = "CANCELLED" ] || [ "${STATUS}" = "TIMEOUT" ]; then
    echo "Docker build failed with status: ${STATUS}"
    echo "Check logs: https://console.cloud.google.com/cloud-build/builds/${BUILD_ID}?project=${PROJECT_ID}"
    exit 1
  fi
  sleep 10
done

echo ""
echo "=== Step 3: Deploying to Cloud Run ==="
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${SERVICE_ACCOUNT}" \
  --update-secrets="OPENAI_API_KEY=OPENAI_API_KEY:latest,SESSION_SECRET=SESSION_SECRET:latest,PHI_ENCRYPTION_KEY=PHI_ENCRYPTION_KEY:latest,PHI_ENCRYPTION_SALT=PHI_ENCRYPTION_SALT:latest,DATABASE_URL=patient-db-secret-us-central1:latest,INTERNAL_SYNC_TOKEN=INTERNAL_SYNC_TOKEN:latest" \
  --add-cloudsql-instances="${PROJECT_ID}:${REGION}:tabula-medica-db" \
  --allow-unauthenticated

echo ""
echo "=== Step 4: Verifying deployment ==="
SERVICE_URL=$(gcloud run services describe "${SERVICE}" --region "${REGION}" --project "${PROJECT_ID}" --format="value(status.url)")
echo "Service URL: ${SERVICE_URL}"

HEALTH=$(curl -s "${SERVICE_URL}/api/health")
echo "Health check: ${HEALTH}"

echo ""
echo "=== Deployment complete ==="
