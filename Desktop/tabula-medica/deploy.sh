#!/bin/bash

# Configuration
PROJECT_ID="united-planet-485003-n7"
REGION="us-central1"
REPO_NAME="tabula-medica-docker"
IMAGE_NAME="tabula-medica-api"
TAG="latest"
SERVICE_NAME="tabula-medica-service"
SERVICE_ACCOUNT="tabula-medica-app-runner@united-planet-485003-n7.iam.gserviceaccount.com"

# SECURITY (C1/C5): the service MUST run with durable, encrypted PHI storage —
# not the in-memory default. Set CLOUD_SQL_INSTANCE to the Cloud SQL connection
# name, and create these Secret Manager secrets first (see
# _tabula-medica-AUDIT/03-PROD-DEPLOY-RUNBOOK.md). The deploy intentionally fails
# if they're missing rather than silently shipping MemStorage to production.
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-}"   # e.g. PROJECT:us-central1:tabula-pg

IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

if [ -z "$CLOUD_SQL_INSTANCE" ]; then
  echo "❌ CLOUD_SQL_INSTANCE not set — refusing to deploy without durable PHI storage."
  echo "   export CLOUD_SQL_INSTANCE=PROJECT:us-central1:tabula-pg  (see 03-PROD-DEPLOY-RUNBOOK.md)"
  exit 1
fi

echo "🚀 Starting full automation for Tabula Medica..."

# 1. Authenticate
echo "🔐 Authenticating Docker..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# 2. Build
echo "📦 Building Docker image..."
docker build -t ${IMAGE_NAME} .

# 3. Tag
echo "🏷️ Tagging image..."
docker tag ${IMAGE_NAME} ${IMAGE_URL}

# 4. Push
echo "📤 Pushing to Artifact Registry..."
docker push ${IMAGE_URL}

# 5. Deploy to Cloud Run
echo "🌩️ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_URL} \
  --platform managed \
  --region ${REGION} \
  --service-account ${SERVICE_ACCOUNT} \
  --allow-unauthenticated \
  --port 8080 \
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}" \
  --set-env-vars "NODE_ENV=production,STORAGE_BACKEND=database" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest,PHI_ENCRYPTION_KEY=PHI_ENCRYPTION_KEY:latest,PHI_ENCRYPTION_SALT=PHI_ENCRYPTION_SALT:latest" \
  --min-instances 0 \
  --quiet
# NOTE: --allow-unauthenticated is correct — the app's C5 auth gate does authz;
# Cloud Run IAM can't (patients aren't IAM principals). STORAGE_BACKEND=database
# activates the durable C1 DatabaseStorage; without it the app runs in-memory.

echo "✅ All done! Your service is live."
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)'
