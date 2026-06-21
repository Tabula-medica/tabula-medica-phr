terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "tabula-medica-tf-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

locals {
  labels = {
    environment  = var.environment
    managed-by   = "terraform"
    application  = "tabula-medica"
    compliance   = "hipaa"
    data-class   = "phi"
  }
}

# ─────────────────────────────────────────────
# 1. Enable Required APIs
# ─────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "healthcare.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudkms.googleapis.com",
    "run.googleapis.com",
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "artifactregistry.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ─────────────────────────────────────────────
# 2. Networking: Private VPC (No Public Database Access)
# ─────────────────────────────────────────────

resource "google_compute_network" "healthcare_vpc" {
  name                    = "healthcare-vpc"
  auto_create_subnetworks = false
  description             = "HIPAA-compliant VPC for healthcare workloads"

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

resource "google_compute_subnetwork" "healthcare_subnet" {
  name                     = "healthcare-subnet"
  ip_cidr_range            = var.vpc_cidr
  region                   = var.region
  network                  = google_compute_network.healthcare_vpc.id
  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_vpc_access_connector" "fhir_connector" {
  name          = "fhir-connector"
  region        = var.region
  ip_cidr_range = var.vpc_connector_cidr
  network       = google_compute_network.healthcare_vpc.name

  depends_on = [google_project_service.apis["vpcaccess.googleapis.com"]]
}

resource "google_compute_firewall" "allow_https_from_lb" {
  name    = "allow-https-from-lb"
  network = google_compute_network.healthcare_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["https-server"]
  direction     = "INGRESS"
  description   = "Allow HTTPS only from Google Cloud Load Balancer health check ranges"
}

resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.healthcare_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  source_ranges = [var.vpc_cidr]
  direction     = "INGRESS"
  description   = "Allow internal traffic within the healthcare VPC"
}

resource "google_compute_firewall" "deny_all_ingress" {
  name    = "deny-all-ingress"
  network = google_compute_network.healthcare_vpc.name

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  direction     = "INGRESS"
  priority      = 65534
  description   = "Default deny all ingress traffic"
}

# ─────────────────────────────────────────────
# 3. Cloud KMS (Customer-Managed Encryption Keys)
# ─────────────────────────────────────────────

resource "google_kms_key_ring" "phi_keyring" {
  name     = "phi-keyring"
  location = var.region

  depends_on = [google_project_service.apis["cloudkms.googleapis.com"]]
}

resource "google_kms_crypto_key" "phi_encryption_key" {
  name     = "phi-encryption-key"
  key_ring = google_kms_key_ring.phi_keyring.id
  purpose  = "ENCRYPT_DECRYPT"

  rotation_period = var.kms_rotation_period

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = local.labels
}

resource "google_kms_crypto_key" "audit_encryption_key" {
  name     = "audit-encryption-key"
  key_ring = google_kms_key_ring.phi_keyring.id
  purpose  = "ENCRYPT_DECRYPT"

  rotation_period = var.kms_rotation_period

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }

  labels = local.labels
}

# ─────────────────────────────────────────────
# 4. Healthcare Dataset & FHIR Store (Source of Truth)
# ─────────────────────────────────────────────

resource "google_healthcare_dataset" "patient_data" {
  name      = "tabula-medica-dataset"
  location  = var.region
  time_zone = "UTC"

  depends_on = [google_project_service.apis["healthcare.googleapis.com"]]
}

resource "google_healthcare_fhir_store" "default" {
  name    = "patient-fhir-store"
  dataset = google_healthcare_dataset.patient_data.id
  version = "R4"

  enable_update_create          = true
  disable_resource_versioning   = false
  disable_referential_integrity = false
  enable_history_modifications  = false

  complex_data_type_reference_parsing = "ENABLED"

  stream_configs {
    bigquery_destination {
      dataset_uri = "bq://${var.project_id}.${var.bigquery_dataset_id}"
      schema_config {
        recursive_structure_depth = 3
      }
    }
  }

  labels = local.labels
}

# ─────────────────────────────────────────────
# 5. Secret Manager (Aggregator API Keys)
# ─────────────────────────────────────────────

resource "google_secret_manager_secret" "aggregator_keys" {
  for_each = toset([
    "aggregator-redox-api-key",
    "aggregator-fasten-health-api-key",
    "aggregator-epic-ias-client-secret",
    "aggregator-particle-health-api-key",
    "aggregator-cerner-client-secret",
    "aggregator-cms-bluebutton-api-key",
  ])

  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
      replicas {
        location = "us-east1"
      }
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "auth0_secrets" {
  for_each = toset([
    "auth0-client-id",
    "auth0-client-secret",
    "auth0-domain",
  ])

  secret_id = each.value

  replication {
    user_managed {
      replicas {
        location = var.region
      }
      replicas {
        location = "us-east1"
      }
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# ─────────────────────────────────────────────
# 6. Cloud Run Service (Application)
# ─────────────────────────────────────────────

resource "google_cloud_run_v2_service" "app" {
  name     = "tabula-medica-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = google_service_account.phi_handler.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.fhir_connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.cloud_run_image

      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "FHIR_STORE_URI"
        value = google_healthcare_fhir_store.default.id
      }

      env {
        name  = "HEALTHCARE_DATASET"
        value = google_healthcare_dataset.patient_data.id
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.auth0_secrets
        content {
          name = upper(replace(env.value.secret_id, "-", "_"))
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 10
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/api/health"
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# ─────────────────────────────────────────────
# 7. Artifact Registry (Container Images)
# ─────────────────────────────────────────────

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = "tabula-medica-images"
  format        = "DOCKER"
  description   = "HIPAA-compliant container image registry with vulnerability scanning"

  docker_config {
    immutable_tags = true
  }

  labels = local.labels

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# ─────────────────────────────────────────────
# 8. Cloud Logging (Audit Retention)
# ─────────────────────────────────────────────

resource "google_logging_project_bucket_config" "hipaa_audit_bucket" {
  project        = var.project_id
  location       = "global"
  retention_days = var.log_retention_days
  bucket_id      = "hipaa-audit-logs"
  description    = "HIPAA-compliant audit log bucket with 6-year retention"
}

resource "google_logging_project_sink" "audit_sink" {
  name                   = "hipaa-audit-sink"
  destination            = "logging.googleapis.com/projects/${var.project_id}/locations/global/buckets/hipaa-audit-logs"
  filter                 = "resource.type=\"cloud_run_revision\" OR resource.type=\"healthcare_dataset\" OR resource.type=\"gce_instance\" OR protoPayload.@type=\"type.googleapis.com/google.cloud.audit.AuditLog\""
  unique_writer_identity = true
}

# ─────────────────────────────────────────────
# 9. VPC Service Controls Perimeter
# ─────────────────────────────────────────────

resource "google_access_context_manager_service_perimeter" "phi_perimeter" {
  provider = google-beta
  parent   = "accessPolicies/${var.project_id}"
  name     = "accessPolicies/${var.project_id}/servicePerimeters/tabula_medica_perimeter"
  title    = "Tabula Medica PHI Perimeter"

  status {
    restricted_services = [
      "bigquery.googleapis.com",
      "sqladmin.googleapis.com",
      "healthcare.googleapis.com",
      "storage.googleapis.com",
      "secretmanager.googleapis.com",
      "cloudkms.googleapis.com",
    ]

    resources = [
      "projects/${var.project_id}",
    ]
  }

  lifecycle {
    ignore_changes = [status[0].ingress_policies, status[0].egress_policies]
  }
}
