#!/usr/bin/env bash
# One-shot: deploy the Vertex-only LLM gateway to Cloud Run in the PHR project.
#
# PREREQUISITES (console, one-time):
#   1. In Vertex AI **Model Garden**, enable the Anthropic Claude models for the
#      region (accept terms) — otherwise vertex_ai/claude-* calls 403.
#      https://console.cloud.google.com/vertex-ai/model-garden  (project below)
#   2. You are authenticated with deploy rights on the project.
#
# After it finishes it prints the two env values to set on the PHR Cloud Run service.
set -euo pipefail
cd "$(dirname "$0")"   # build context = this dir (config.yaml + Dockerfile)

PROJECT="${PROJECT:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-llm-gateway}"
SA="llm-gateway-sa"
SA_EMAIL="${SA}@${PROJECT}.iam.gserviceaccount.com"
REPO="llm-gateway"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/litellm:latest"

echo "Project=$PROJECT Region=$REGION Service=$SERVICE"

echo "== enable APIs =="
gcloud services enable run.googleapis.com aiplatform.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com \
  --project="$PROJECT"

echo "== service account (Vertex caller, least privilege) =="
gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA" --project="$PROJECT" \
    --display-name="LLM gateway (Vertex caller)"
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/aiplatform.user" --condition=None -q >/dev/null

echo "== master key secret (the gateway's 'OpenAI API key') =="
if ! gcloud secrets describe LITELLM_MASTER_KEY --project="$PROJECT" >/dev/null 2>&1; then
  KEY="sk-gw-$(openssl rand -hex 24)"
  printf '%s' "$KEY" | gcloud secrets create LITELLM_MASTER_KEY --project="$PROJECT" --data-file=-
else
  echo "  (LITELLM_MASTER_KEY already exists — leaving as-is)"
fi
gcloud secrets add-iam-policy-binding LITELLM_MASTER_KEY --project="$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/secretmanager.secretAccessor" -q >/dev/null

echo "== build image =="
gcloud artifacts repositories describe "$REPO" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --project="$PROJECT"
gcloud builds submit --project="$PROJECT" --tag "$IMAGE" .

echo "== deploy to Cloud Run (scale-to-zero, internal ingress, Vertex SA) =="
gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$SA_EMAIL" \
  --allow-unauthenticated \
  --ingress=internal \
  --port=4000 \
  --memory=2Gi --cpu=2 \
  --min-instances=0 --max-instances=4 \
  --set-env-vars="VERTEX_PROJECT_ID=${PROJECT},VERTEX_LOCATION=${REGION}" \
  --set-secrets="LITELLM_MASTER_KEY=LITELLM_MASTER_KEY:latest"

URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')
echo
echo "================ DONE ================"
echo "Gateway URL: $URL"
echo "Set these on the PHR (tabula-medica-web) Cloud Run service, then redeploy:"
echo "  AI_INTEGRATIONS_OPENAI_BASE_URL = ${URL}/v1"
echo "  OPENAI_BASE_URL                 = ${URL}/v1   (covers no-arg clients)"
echo "  AI_INTEGRATIONS_OPENAI_API_KEY  = <value of secret LITELLM_MASTER_KEY>"
echo "  OPENAI_API_KEY                  = <same master key>"
echo "Grant the PHR runtime SA roles/run.invoker on ${SERVICE} (internal ingress + IAM)."
