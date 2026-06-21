output "fhir_store_uri" {
  description = "URI of the FHIR R4 store (source of truth for clinical data)"
  value       = google_healthcare_fhir_store.default.id
}

output "healthcare_dataset_id" {
  description = "Healthcare dataset ID"
  value       = google_healthcare_dataset.patient_data.id
}

output "vpc_network_name" {
  description = "VPC network name for healthcare workloads"
  value       = google_compute_network.healthcare_vpc.name
}

output "vpc_connector_id" {
  description = "VPC Access Connector for Cloud Run"
  value       = google_vpc_access_connector.fhir_connector.id
}

output "cloud_run_service_url" {
  description = "Cloud Run service URL"
  value       = google_cloud_run_v2_service.app.uri
}

output "phi_encryption_key_id" {
  description = "KMS key ID for PHI encryption"
  value       = google_kms_crypto_key.phi_encryption_key.id
}

output "audit_encryption_key_id" {
  description = "KMS key ID for audit log encryption"
  value       = google_kms_crypto_key.audit_encryption_key.id
}

output "phi_handler_service_account" {
  description = "PHI handler service account email"
  value       = google_service_account.phi_handler.email
}

output "audit_writer_service_account" {
  description = "Audit writer service account email"
  value       = google_service_account.audit_writer.email
}

output "data_pipeline_service_account" {
  description = "Data pipeline service account email"
  value       = google_service_account.data_pipeline.email
}

output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "security_guardrails_summary" {
  description = "Summary of applied security guardrails"
  value = {
    data_residency         = var.region
    audit_trail_versioning = true
    network_isolation      = google_vpc_access_connector.fhir_connector.name
    phi_encryption         = google_kms_crypto_key.phi_encryption_key.name
    log_retention_days     = var.log_retention_days
    vpc_service_controls   = "tabula_medica_perimeter"
  }
}
