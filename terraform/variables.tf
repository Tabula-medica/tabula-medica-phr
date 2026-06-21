variable "project_id" {
  description = "GCP Project ID for Tabula Medica"
  type        = string
  default     = "tabula-medica-prod"
}

variable "region" {
  description = "Primary GCP region (must support Healthcare API)"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset for FHIR streaming export"
  type        = string
  default     = "clinical_analytics"
}

variable "cloud_run_image" {
  description = "Container image URI for the Cloud Run service"
  type        = string
  default     = "us-central1-docker.pkg.dev/tabula-medica-prod/tabula-medica-images/app:latest"
}

variable "cloud_run_min_instances" {
  description = "Minimum Cloud Run instances (set >0 for production availability)"
  type        = number
  default     = 2
}

variable "cloud_run_max_instances" {
  description = "Maximum Cloud Run instances"
  type        = number
  default     = 50
}

variable "kms_rotation_period" {
  description = "KMS key rotation period in seconds (default 90 days)"
  type        = string
  default     = "7776000s"
}

variable "log_retention_days" {
  description = "Audit log retention in days (HIPAA requires minimum 6 years)"
  type        = number
  default     = 2190
}

variable "backup_retention_days" {
  description = "Database backup retention in days"
  type        = number
  default     = 365
}

variable "vpc_cidr" {
  description = "CIDR range for the healthcare VPC subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "vpc_connector_cidr" {
  description = "CIDR range for the VPC Access Connector"
  type        = string
  default     = "10.8.0.0/28"
}
