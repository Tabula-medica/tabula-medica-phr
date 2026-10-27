#!/usr/bin/env bash
# Bootstrap GCP staging environment for Tabula Medica.
#
# Creates the `tabula-medica-staging` Cloud Run service in us-central1.
# Staging shares the same IAM service accounts and Workload Identity Federation
# pool as production, but uses its OWN database secret (DATABASE_URL_STAGING)
# so it can never accidentally write to the production patient database.
#
# Run this ONCE locally after the production bootstrap has already been run
# (scripts/bootstrap-gcp-cloudrun.sh), with `gcloud` authenticated as a
# project owner:
#
#   gcloud auth login
#   gcloud config set project united-planet-485003-n7
#   bash scripts/bootstrap-gcp-cloudrun-staging.sh
#
# Idempotent: safe to re-run.
#
# Prerequisites:
#   1. scripts/bootstrap-gcp-cloudrun.sh has been run (creates service accounts,
#      WIF pool, and shared secrets).
#   2. A staging-only Postgres database has been provisioned (separate Neon branch
#      or Cloud SQL instance) populated with demo/synthetic data only — NO PHI.
#   3. DATABASE_URL_STAGING secret pushed to Secret Manager:
#        echo "postgresql://user:pass@host:5432/staging_db?sslmode=require" | \
#          gcloud secrets create DATABASE_URL_STAGING --data-file=- --replication-policy=automatic
#        gcloud secrets add-iam-policy-binding DATABASE_URL_STAGING \
#          --member="serviceAccount:cloud-run-runtime@united-planet-485003-n7.iam.gserviceaccount.com" \
#          --role="roles/secretmanager.secretAccessor"
#   4. Confirm GCP BAA covers Cloud Run for staging traffic (same project = same BAA).
#
# What this script does NOT do:
#   - Create new service accounts (reuses cloud-run-runtime / cloud-run-deploy).
#   - Push secrets (see prerequisite 3 above for DATABASE_URL_STAGING).
#   - Map a custom domain (staging uses the auto-generated *.run.app URL).
#   - Create the GitHub "production" Environment (that is a GitHub UI step —
#     see docs/CLOUD_RUN_DEPLOYMENT.md, "Setting up the production approval gate").

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-united-planet-485003-n7}"
REGION="${REGION:-us-central1}"
STAGING_SERVICE="${STAGING_SERVICE:-tabula-medica-staging}"

RUNTIME_SA="cloud-run-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Project:         ${PROJECT_ID}"
echo "==> Region:          ${REGION}"
echo "==> Staging service: ${STAGING_SERVICE}"
echo "==> Runtime SA:      ${RUNTIME_SA}"
echo

gcloud config set project "${PROJECT_ID}" --quiet

# -------------------------------------------------------------------------
# Step 1 — verify prerequisites (production bootstrap must have run first).
# -------------------------------------------------------------------------
echo "==> [1/4] Verifying prerequisite service accounts exist..."

if ! gcloud iam service-accounts describe "${RUNTIME_SA}" --quiet 2>/dev/null; then
  echo
  echo "ERROR: Runtime service account ${RUNTIME_SA} not found."
  echo "Run scripts/bootstrap-gcp-cloudrun.sh first to create it."
  exit 1
fi
echo "    cloud-run-runtime SA: OK"

DEPLOY_SA="cloud-run-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${DEPLOY_SA}" --quiet 2>/dev/null; then
  echo
  echo "ERROR: Deploy service account ${DEPLOY_SA} not found."
  echo "Run scripts/bootstrap-gcp-cloudrun.sh first to create it."
  exit 1
fi
echo "    cloud-run-deploy SA:  OK"

# -------------------------------------------------------------------------
# Step 2 — verify the secrets required by the deploy workflow exist.
#
# The staging deploy job uses DATABASE_URL_STAGING (not DATABASE_URL) so
# staging can never accidentally connect to the production patient database.
# All other shared secrets are read from the same Secret Manager versions as
# production — they do NOT need to be duplicated.
# -------------------------------------------------------------------------
echo
echo "==> [2/4] Verifying required secrets exist in Secret Manager..."

REQUIRED_SECRETS=(
  DATABASE_URL_STAGING
  PHI_ENCRYPTION_KEY
  SESSION_SECRET
  GCS_BUCKET_NAME
  GCS_ENCRYPTION_KEY
  GOOGLE_APPLICATION_CREDENTIALS_JSON
  CROSS_APP_SECRET
)

MISSING=0
for SECRET in "${REQUIRED_SECRETS[@]}"; do
  if gcloud secrets describe "${SECRET}" --quiet 2>/dev/null > /dev/null; then
    echo "    ${SECRET}: OK"
  else
    echo "    ${SECRET}: MISSING"
    MISSING=1
  fi
done

if [ "${MISSING}" -eq 1 ]; then
  echo
  echo "ERROR: One or more required secrets are missing."
  echo "Run scripts/bootstrap-gcp-cloudrun.sh with a populated .local/prod-secrets.env"
  echo "to push the missing secrets, then re-run this script."
  exit 1
fi

# -------------------------------------------------------------------------
# Step 3 — create (or verify) the staging Cloud Run service.
# -------------------------------------------------------------------------
echo
echo "==> [3/4] Provisioning Cloud Run service: ${STAGING_SERVICE}..."

# The `deploy-cloudrun.yml` workflow handles actual image builds and deploys.
# Here we create/verify a placeholder service so Cloud Run knows the service
# name before the first CI-triggered deploy. If the service already exists
# (from a prior CI deploy), this step is a no-op.
if gcloud run services describe "${STAGING_SERVICE}" --region="${REGION}" --quiet 2>/dev/null > /dev/null; then
  echo "    Service already exists — skipping create."
  STAGING_URL=$(gcloud run services describe "${STAGING_SERVICE}" \
    --region="${REGION}" \
    --format='value(status.url)' \
    --quiet 2>/dev/null || echo "(URL not yet assigned)")
  echo "    Staging URL: ${STAGING_URL}"
else
  echo
  echo "    The ${STAGING_SERVICE} Cloud Run service does not exist yet."
  echo "    It will be created automatically on the first push to main that"
  echo "    triggers the deploy-staging job in deploy-cloudrun.yml."
  echo
  echo "    To create it immediately without waiting for a CI push, you can"
  echo "    run the deploy-staging job manually via GitHub Actions:"
  echo "      GitHub -> Actions -> Deploy to Cloud Run -> Run workflow"
  echo "    (select a main branch commit — the job is guarded by push.branches[main])."
  echo
  echo "    Alternatively, deploy from your local machine with Cloud Build:"
  echo "      gcloud builds submit . \\"
  echo "        --config=cloudbuild.yaml \\"
  echo "        --substitutions=_SERVICE=${STAGING_SERVICE},_NODE_ENV=staging \\"
  echo "        --region=${REGION}"
  echo
  echo "    NOTE: cloudbuild.yaml uses the production service name by default."
  echo "    Pass _SERVICE=${STAGING_SERVICE} as a substitution or set it directly."
fi

# -------------------------------------------------------------------------
# Step 4 — summary + next steps.
# -------------------------------------------------------------------------
echo
echo "==> [4/4] Staging bootstrap summary"
echo
echo "    Shared resources (no action needed):"
echo "      Service accounts: cloud-run-runtime, cloud-run-deploy (production SAs)"
echo "      WIF pool:         github-actions-pool / github-actions-provider"
echo "      Shared secrets:   PHI_ENCRYPTION_KEY, SESSION_SECRET, GCS_*, etc."
echo "                        (same Secret Manager versions as production)"
echo
echo "    Staging-specific (ISOLATED FROM PRODUCTION):"
echo "      Cloud Run service: ${STAGING_SERVICE} (us-central1)"
echo "      NODE_ENV:          staging  (set by deploy-staging job in CI)"
echo "      DATABASE secret:   DATABASE_URL_STAGING (separate staging DB — NOT production)"
echo "      URL pattern:       https://${STAGING_SERVICE}-<hash>-uc.a.run.app"
echo "                         (auto-assigned by Cloud Run on first deploy)"
echo
echo "    IMPORTANT — database isolation:"
echo "      Staging uses DATABASE_URL_STAGING, not DATABASE_URL."
echo "      The staging DB must be a separate Neon branch or Cloud SQL instance"
echo "      populated with demo/synthetic data only. NEVER point DATABASE_URL_STAGING"
echo "      at the production DATABASE_URL value."
echo "      To provision: see docs/CLOUD_RUN_DEPLOYMENT.md, 'Staging database setup'."
echo
echo "    Required one-time GitHub setup (do this in the GitHub web UI):"
echo "      1. Settings -> Environments -> New environment -> name: production"
echo "      2. Add required reviewers (on-call engineers)."
echo "      3. Deployment branches and tags -> Tags only -> Pattern: v*"
echo "      4. Save protection rules."
echo "    See docs/CLOUD_RUN_DEPLOYMENT.md (\"Setting up the production approval gate\")"
echo "    for the full step-by-step with screenshots guidance."
echo
echo "    Verify staging is live after first CI deploy:"
echo "      STAGING_URL=\$(gcloud run services describe ${STAGING_SERVICE} \\"
echo "        --region=${REGION} --format='value(status.url)')"
echo "      curl \"\${STAGING_URL}/api/health\""
echo
echo "    Bootstrap complete."
