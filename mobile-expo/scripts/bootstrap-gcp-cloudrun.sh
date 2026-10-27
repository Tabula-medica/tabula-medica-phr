#!/usr/bin/env bash
# Bootstrap GCP project for Tabula Medica Cloud Run production deployment.
#
# Run this ONCE locally with `gcloud` already authenticated as a project owner:
#   gcloud auth login
#   gcloud config set project united-planet-485003-n7
#   bash scripts/bootstrap-gcp-cloudrun.sh
#
# Idempotent: safe to re-run. Will skip steps that are already done.
#
# Prereqs the script does NOT do for you (you must do these yourself):
#   1. Confirm in writing with your Google Cloud account team that the
#      executed BAA on this project covers Cloud Run AND Vertex AI generative
#      models. See docs/CLOUD_RUN_DEPLOYMENT.md section "BAA verification".
#   2. Have your secret values ready in a local file (see SECRETS_FILE below)
#      — the script reads them from disk and pushes them to Secret Manager.
#      It NEVER prints secret values.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-tabula-medica-web}"
GITHUB_REPO="${GITHUB_REPO:-}"   # e.g. "your-org/tabula-medica" — required for WIF
SECRETS_FILE="${SECRETS_FILE:-./.local/prod-secrets.env}"

DEPLOY_SA="cloud-run-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="cloud-run-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
WIF_POOL="github-actions-pool"
WIF_PROVIDER="github-actions-provider"

echo "==> Project: ${PROJECT_ID}"
echo "==> Region:  ${REGION}"
echo "==> Service: ${SERVICE_NAME}"

gcloud config set project "${PROJECT_ID}" --quiet

# -------------------------------------------------------------------------
# Step 1 — enable required APIs.
# -------------------------------------------------------------------------
echo
echo "==> [1/7] Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  aiplatform.googleapis.com \
  --quiet

# -------------------------------------------------------------------------
# Step 2 — runtime service account (what Cloud Run runs as).
# -------------------------------------------------------------------------
echo
echo "==> [2/7] Creating/verifying runtime service account..."
if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --quiet 2>/dev/null; then
  gcloud iam service-accounts create cloud-run-runtime \
    --display-name="Cloud Run runtime SA — Tabula Medica" \
    --description="Identity Cloud Run uses to call Vertex AI, Secret Manager, GCS"
fi

# Grant runtime SA access to Vertex AI, Secret Manager, GCS.
for ROLE in \
  "roles/aiplatform.user" \
  "roles/secretmanager.secretAccessor" \
  "roles/storage.objectAdmin" \
  "roles/logging.logWriter" \
  "roles/monitoring.metricWriter"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet > /dev/null
done

# -------------------------------------------------------------------------
# Step 3 — deploy service account (what GitHub Actions assumes).
# -------------------------------------------------------------------------
echo
echo "==> [3/7] Creating/verifying deploy service account..."
if ! gcloud iam service-accounts describe "${DEPLOY_SA}" --quiet 2>/dev/null; then
  gcloud iam service-accounts create cloud-run-deploy \
    --display-name="Cloud Run deploy SA — GitHub Actions" \
    --description="GitHub Actions assumes this via WIF to deploy Cloud Run"
fi

# Project-scope roles needed to push images and deploy revisions. Note: we
# deliberately do NOT grant project-scope roles/iam.serviceAccountUser here —
# that would let the deploy SA actAs *any* service account in the project
# (privilege escalation if CI is compromised). The narrower SA-level binding
# below grants actAs ONLY on the runtime SA.
for ROLE in \
  "roles/run.admin" \
  "roles/cloudbuild.builds.editor" \
  "roles/artifactregistry.writer" \
  "roles/storage.admin"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${DEPLOY_SA}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet > /dev/null
done

# Narrowly scoped: deploy SA can actAs ONLY the runtime SA, not arbitrary SAs.
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet > /dev/null

# Idempotency cleanup: if a previous run of this script granted the broader
# project-scope iam.serviceAccountUser, revoke it now. Safe to ignore "not
# found" errors on fresh projects.
gcloud projects remove-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet 2>/dev/null > /dev/null || true

# -------------------------------------------------------------------------
# Step 4 — Workload Identity Federation (lets GitHub Actions auth without keys).
# -------------------------------------------------------------------------
if [ -z "${GITHUB_REPO}" ]; then
  echo
  echo "==> [4/7] SKIPPING WIF setup (set GITHUB_REPO=your-org/your-repo to configure)"
else
  echo
  echo "==> [4/7] Setting up Workload Identity Federation for ${GITHUB_REPO}..."
  PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')

  if ! gcloud iam workload-identity-pools describe "${WIF_POOL}" --location=global --quiet 2>/dev/null; then
    gcloud iam workload-identity-pools create "${WIF_POOL}" \
      --location=global \
      --display-name="GitHub Actions WIF pool"
  fi

  if ! gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
        --workload-identity-pool="${WIF_POOL}" --location=global --quiet 2>/dev/null; then
    gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
      --workload-identity-pool="${WIF_POOL}" \
      --location=global \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor" \
      --attribute-condition="assertion.repository=='${GITHUB_REPO}'"
  fi

  gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_REPO}" \
    --quiet > /dev/null

  echo
  echo "    ----------------------------------------------------------------"
  echo "    Add these THREE values to your GitHub repo secrets"
  echo "    (Settings -> Secrets and variables -> Actions -> New repo secret):"
  echo
  echo "      GCP_WORKLOAD_IDENTITY_PROVIDER ="
  echo "        projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
  echo
  echo "      GCP_SERVICE_ACCOUNT ="
  echo "        ${DEPLOY_SA}"
  echo
  echo "      (REVIEWER_EMAIL, REVIEWER_PASSWORD, SLACK_WEBHOOK_URL — see"
  echo "       docs/CLOUD_RUN_DEPLOYMENT.md for the rest)"
  echo "    ----------------------------------------------------------------"
fi

# -------------------------------------------------------------------------
# Step 5 — push secrets to Secret Manager.
# -------------------------------------------------------------------------
echo
echo "==> [5/7] Pushing secrets to Secret Manager..."
if [ ! -f "${SECRETS_FILE}" ]; then
  echo "    SKIPPING — secrets file not found at ${SECRETS_FILE}"
  echo "    Create it with KEY=value lines (one per secret) and re-run."
  echo "    See docs/CLOUD_RUN_DEPLOYMENT.md for the required keys."
else
  # Read each KEY=value line. Never echo values.
  while IFS='=' read -r KEY VALUE; do
    # Skip blanks/comments.
    [[ -z "${KEY}" || "${KEY}" =~ ^# ]] && continue
    # Strip surrounding quotes if present.
    VALUE="${VALUE%\"}"; VALUE="${VALUE#\"}"
    VALUE="${VALUE%\'}"; VALUE="${VALUE#\'}"

    if gcloud secrets describe "${KEY}" --quiet 2>/dev/null > /dev/null; then
      printf '%s' "${VALUE}" | gcloud secrets versions add "${KEY}" --data-file=- --quiet > /dev/null
      echo "    rotated  ${KEY}"
    else
      printf '%s' "${VALUE}" | gcloud secrets create "${KEY}" \
        --data-file=- \
        --replication-policy=automatic \
        --quiet > /dev/null
      echo "    created  ${KEY}"
    fi

    # Grant runtime SA access to this specific secret.
    gcloud secrets add-iam-policy-binding "${KEY}" \
      --member="serviceAccount:${RUNTIME_SA}" \
      --role="roles/secretmanager.secretAccessor" \
      --quiet > /dev/null
  done < "${SECRETS_FILE}"
fi

# -------------------------------------------------------------------------
# Step 6 — custom domain mapping (api.tabulamedica.health -> Cloud Run).
# -------------------------------------------------------------------------
echo
echo "==> [6/7] Custom domain mapping check..."
if gcloud run domain-mappings describe \
     --domain=api.tabulamedica.health \
     --region="${REGION}" --quiet 2>/dev/null > /dev/null; then
  echo "    api.tabulamedica.health is already mapped."
else
  echo "    Domain not yet mapped. After your first successful deploy, run:"
  echo
  echo "      gcloud run domain-mappings create \\"
  echo "        --service=${SERVICE_NAME} \\"
  echo "        --domain=api.tabulamedica.health \\"
  echo "        --region=${REGION}"
  echo
  echo "    Then add the DNS records gcloud prints to your domain registrar."
fi

# -------------------------------------------------------------------------
# Step 7 — summary.
# -------------------------------------------------------------------------
echo
echo "==> [7/7] Bootstrap complete."
echo
echo "    Next: push to main (or run the GitHub workflow manually) — the"
echo "    deploy-cloudrun.yml job will build the Docker image and roll out"
echo "    the new Cloud Run revision under ${RUNTIME_SA}."
echo
echo "    Verify after first deploy:"
echo "      curl https://api.tabulamedica.health/api/health"
echo "      gcloud run services describe ${SERVICE_NAME} --region=${REGION}"
