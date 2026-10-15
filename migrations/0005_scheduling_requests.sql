-- Migration: scheduling_requests table
-- Stores AI-triaged patient scheduling requests.
-- symptom_text is PHI-encrypted at the application layer (encryptPhiRow).
-- triage_result is non-PHI JSONB (urgency / visitType / reasoning).

CREATE TABLE IF NOT EXISTS "scheduling_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "urgency" text NOT NULL,
  "visit_type" text NOT NULL,
  "symptom_text" text NOT NULL,
  "triage_result" jsonb,
  "language" text NOT NULL DEFAULT 'en',
  "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'pending',
  "confirmed_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "scheduling_requests_patient_id_idx"
  ON "scheduling_requests" ("patient_id");
