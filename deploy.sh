#!/bin/bash

# Configuration
PROJECT_ID="united-planet-485003-n7"
REGION="us-central1"
REPO_NAME="tabula-medica-docker"
IMAGE_NAME="tabula-medica-api"
TAG="latest"
SERVICE_NAME="tabula-medica-service"
SERVICE_ACCOUNT="tabula-medica-app-runner@united-planet-485003-n7.iam.gserviceaccount.com"

IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

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
  --quiet

echo "✅ All done! Your service is live."
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)'
