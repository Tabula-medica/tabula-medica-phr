# ─────────────────────────────────────────────
# Zero-Trust IAM: Least-Privilege Service Accounts
# ─────────────────────────────────────────────

resource "google_service_account" "phi_handler" {
  account_id   = "phi-handler"
  display_name = "PHI Handler Service Account"
  description  = "Least-privilege service account for Cloud Run app accessing PHI"
}

resource "google_service_account" "audit_writer" {
  account_id   = "audit-writer"
  display_name = "Audit Log Writer"
  description  = "Service account for writing HIPAA-compliant audit logs"
}

resource "google_service_account" "data_pipeline" {
  account_id   = "data-pipeline"
  display_name = "Data Pipeline Service Account"
  description  = "Service account for aggregator sync and webhook processing"
}

# PHI Handler: FHIR Resource Editor (NOT Owner)
resource "google_healthcare_fhir_store_iam_member" "phi_handler_fhir" {
  fhir_store_id = google_healthcare_fhir_store.default.id
  role          = "roles/healthcare.fhirResourceEditor"
  member        = "serviceAccount:${google_service_account.phi_handler.email}"
}

# PHI Handler: Secret Accessor scoped to Auth0 secrets only
resource "google_secret_manager_secret_iam_member" "phi_handler_auth0_secrets" {
  for_each  = google_secret_manager_secret.auth0_secrets
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.phi_handler.email}"
}

# PHI Handler: Cloud SQL Client (connect only, not admin)
resource "google_project_iam_member" "phi_handler_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.phi_handler.email}"
}

# PHI Handler: KMS Encrypter/Decrypter
resource "google_kms_crypto_key_iam_member" "phi_handler_kms" {
  crypto_key_id = google_kms_crypto_key.phi_encryption_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.phi_handler.email}"
}

# Audit Writer: Log Writer only
resource "google_project_iam_member" "audit_writer_logs" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.audit_writer.email}"
}

# Audit Writer: KMS Encrypter for audit encryption
resource "google_kms_crypto_key_iam_member" "audit_writer_kms" {
  crypto_key_id = google_kms_crypto_key.audit_encryption_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${google_service_account.audit_writer.email}"
}

# Data Pipeline: FHIR Resource Reader (read-only for sync)
resource "google_healthcare_fhir_store_iam_member" "data_pipeline_fhir" {
  fhir_store_id = google_healthcare_fhir_store.default.id
  role          = "roles/healthcare.fhirResourceReader"
  member        = "serviceAccount:${google_service_account.data_pipeline.email}"
}

# Data Pipeline: BigQuery Data Editor (for streaming)
resource "google_project_iam_member" "data_pipeline_bq" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.data_pipeline.email}"
}

# Data Pipeline: Secret Accessor scoped to aggregator keys only
resource "google_secret_manager_secret_iam_member" "data_pipeline_aggregator_secrets" {
  for_each  = google_secret_manager_secret.aggregator_keys
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.data_pipeline.email}"
}

# ─────────────────────────────────────────────
# Organization Policy Constraints
# ─────────────────────────────────────────────

resource "google_project_organization_policy" "disable_sa_key_creation" {
  project    = var.project_id
  constraint = "constraints/iam.disableServiceAccountKeyCreation"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "require_shielded_vm" {
  project    = var.project_id
  constraint = "constraints/compute.requireShieldedVm"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "restrict_public_ip" {
  project    = var.project_id
  constraint = "constraints/sql.restrictPublicIp"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "uniform_bucket_access" {
  project    = var.project_id
  constraint = "constraints/storage.uniformBucketLevelAccess"

  boolean_policy {
    enforced = true
  }
}
