-- Migration: CMS Blue Button 2.0 tables
-- bluebutton_connections: one row per patient, stores encrypted OAuth tokens.
-- bluebutton_claims: encrypted FHIR EOB + Coverage resources from CMS.

CREATE TABLE IF NOT EXISTS "bluebutton_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL UNIQUE REFERENCES "profiles"("id") ON DELETE CASCADE,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone,
  "scope" text,
  "bb2_patient_id" text NOT NULL,
  "connected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_synced_at" timestamp with time zone,
  "disconnected_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "bluebutton_claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "fhir_json" text NOT NULL,
  "service_date_start" timestamp with time zone,
  "service_date_end" timestamp with time zone,
  "claim_type" text,
  "synced_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bluebutton_claims_profile_id_idx"
  ON "bluebutton_claims" ("profile_id");

CREATE INDEX IF NOT EXISTS "bluebutton_claims_service_date_idx"
  ON "bluebutton_claims" ("profile_id", "service_date_start" DESC);
