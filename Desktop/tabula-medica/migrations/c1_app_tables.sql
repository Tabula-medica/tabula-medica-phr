-- C1 durable-storage tables (7 entities migrated off in-memory Maps).
-- SAFE TO APPLY: additive only. Every statement is IF NOT EXISTS — it creates
-- the new tables/indexes and touches NOTHING else. Prefer this over
-- `drizzle-kit push`, which diffs the whole schema and can apply destructive
-- drift to existing tables.
--
-- Apply (STAGING FIRST):
--   psql "$STAGING_DATABASE_URL" -f migrations/c1_app_tables.sql
-- Then set STORAGE_BACKEND=database on the service. Roll forward to prod after
-- the C5 global-gate staging test passes.

BEGIN;

-- 1) HIPAA security audit trail (§164.312(b))
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  profile_id text,
  event_type text NOT NULL,
  description text NOT NULL,
  ip_address text NOT NULL DEFAULT 'Unknown',
  user_agent text NOT NULL DEFAULT 'Unknown',
  platform text NOT NULL DEFAULT 'web',
  app_version text NOT NULL DEFAULT '1.0.0',
  source text,
  connection_id text,
  sync_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_audit_logs_user_idx ON security_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS security_audit_logs_created_idx ON security_audit_logs (created_at);

-- 2) Root identity
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  first_name text,
  last_name text,
  profile_image_url text,
  role text NOT NULL DEFAULT 'patient',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at text,
  password_hash text,
  auth_provider text,
  mfa_required text,
  password_updated_at timestamptz,
  email_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  date_of_birth text,
  preferred_language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_users_email_idx ON app_users (email);
CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users (role);

-- 3) Medical records (core PHI; soft-delete via status='deleted')
CREATE TABLE IF NOT EXISTS app_medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  date text NOT NULL,
  provider text NOT NULL,
  facility text NOT NULL,
  status text NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS app_medical_records_patient_idx ON app_medical_records (patient_id);
CREATE INDEX IF NOT EXISTS app_medical_records_connection_idx ON app_medical_records (ehr_connection_id);

-- 4) Consent records (gate PHI access §164.524)
CREATE TABLE IF NOT EXISTS app_user_consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  document_id text NOT NULL,
  document_type text NOT NULL,
  document_version text NOT NULL,
  status text NOT NULL,
  accepted_at text,
  declined_at text,
  withdrawn_at text,
  expires_at text,
  ip_address text,
  user_agent text,
  method text NOT NULL DEFAULT 'click',
  metadata jsonb,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_user_consent_records_user_idx ON app_user_consent_records (user_id);
CREATE INDEX IF NOT EXISTS app_user_consent_records_doc_idx ON app_user_consent_records (document_id);

-- 5) Active device/session tracking
CREATE TABLE IF NOT EXISTS app_user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  device_info text NOT NULL DEFAULT 'Unknown Device',
  ip_address text NOT NULL DEFAULT 'Unknown',
  user_agent text NOT NULL DEFAULT 'Unknown',
  last_active_at text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  is_current_session boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS app_user_sessions_user_idx ON app_user_sessions (user_id);

-- Two-factor auth (MFA). secret + backup_codes entries are AES-256-GCM encrypted
-- at rest by the app; one row per user.
CREATE TABLE IF NOT EXISTS app_two_factor_auths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  secret text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verified_at text,
  backup_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS app_two_factor_auths_user_idx ON app_two_factor_auths (user_id);

-- Security notifications (per-user security alerts; no PHI).
CREATE TABLE IF NOT EXISTS app_security_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_security_notifications_user_idx ON app_security_notifications (user_id);

-- Security settings (per-user alert preferences; no PHI). One row per user.
CREATE TABLE IF NOT EXISTS app_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  login_notifications boolean NOT NULL DEFAULT true,
  new_device_alerts boolean NOT NULL DEFAULT true,
  session_activity_alerts boolean NOT NULL DEFAULT false,
  email_notifications boolean NOT NULL DEFAULT true,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS app_security_settings_user_idx ON app_security_settings (user_id);

-- Caregiver access log (HIPAA accounting of disclosures; append-only).
CREATE TABLE IF NOT EXISTS app_caregiver_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id text NOT NULL,
  caregiver_name text NOT NULL,
  patient_user_id text NOT NULL,
  access_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  action text NOT NULL,
  ip_address text,
  user_agent text,
  approved boolean NOT NULL DEFAULT true,
  emergency_override boolean NOT NULL DEFAULT false,
  patient_notified boolean NOT NULL DEFAULT false,
  accessed_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_caregiver_access_logs_patient_idx ON app_caregiver_access_logs (patient_user_id);
CREATE INDEX IF NOT EXISTS app_caregiver_access_logs_caregiver_idx ON app_caregiver_access_logs (caregiver_id);

-- Caregiver access request (pending sensitive-permission asks, patient-reviewed).
CREATE TABLE IF NOT EXISTS app_caregiver_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id text NOT NULL,
  caregiver_name text NOT NULL,
  patient_user_id text NOT NULL,
  requested_permission text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at text NOT NULL,
  reviewed_at text,
  reviewed_by text,
  review_notes text,
  expires_at text
);
CREATE INDEX IF NOT EXISTS app_caregiver_access_requests_patient_idx ON app_caregiver_access_requests (patient_user_id);

-- 6) Vital signs (clinical PHI)
CREATE TABLE IF NOT EXISTS app_vital_signs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  type text NOT NULL,
  value text NOT NULL,
  unit text NOT NULL,
  recorded_at text NOT NULL,
  recorded_by text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_vital_signs_patient_idx ON app_vital_signs (patient_id);
CREATE INDEX IF NOT EXISTS app_vital_signs_connection_idx ON app_vital_signs (ehr_connection_id);

-- 7) Medications (clinical PHI)
CREATE TABLE IF NOT EXISTS app_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  prescribed_by text NOT NULL,
  start_date text NOT NULL,
  end_date text,
  status text NOT NULL DEFAULT 'active',
  refills_remaining integer NOT NULL DEFAULT 0,
  patient_reported text
);
CREATE INDEX IF NOT EXISTS app_medications_patient_idx ON app_medications (patient_id);
CREATE INDEX IF NOT EXISTS app_medications_connection_idx ON app_medications (ehr_connection_id);

-- 8) Caregivers (delegated PHI-access authorization)
CREATE TABLE IF NOT EXISTS app_caregivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id text NOT NULL,
  caregiver_user_id text,
  caregiver_email text NOT NULL,
  caregiver_name text,
  relationship text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_restriction text NOT NULL DEFAULT 'none',
  access_expires_at text,
  requires_approval_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitive_data_access boolean NOT NULL DEFAULT false,
  notify_patient_on_access boolean NOT NULL DEFAULT true,
  emergency_access_enabled boolean NOT NULL DEFAULT false,
  last_access_at text,
  invite_token text,
  invited_at text NOT NULL,
  accepted_at text,
  suspended_at text,
  suspension_reason text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_caregivers_patient_idx ON app_caregivers (patient_user_id);
CREATE INDEX IF NOT EXISTS app_caregivers_caregiver_idx ON app_caregivers (caregiver_user_id);
CREATE INDEX IF NOT EXISTS app_caregivers_token_idx ON app_caregivers (invite_token);

-- 9) Allergies (safety-critical clinical PHI)
CREATE TABLE IF NOT EXISTS app_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  severity text NOT NULL,
  reaction text NOT NULL,
  onset_date text,
  status text NOT NULL DEFAULT 'active',
  verified_by text,
  verified_date text,
  notes text
);
CREATE INDEX IF NOT EXISTS app_allergies_patient_idx ON app_allergies (patient_id);
CREATE INDEX IF NOT EXISTS app_allergies_connection_idx ON app_allergies (ehr_connection_id);

-- 10) Immunizations (clinical PHI)
CREATE TABLE IF NOT EXISTS app_immunizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text,
  vaccine_name text NOT NULL,
  vaccine_code text,
  manufacturer text,
  lot_number text,
  expiration_date text,
  dose_number integer,
  dose_quantity double precision,
  dose_unit text,
  site text,
  route text,
  administered_date text NOT NULL,
  administered_by text,
  facility text,
  status text NOT NULL DEFAULT 'completed',
  reaction text,
  reaction_date text,
  reaction_severity text,
  notes text,
  next_dose_date text,
  series_complete boolean,
  created_at text NOT NULL,
  updated_at text
);
CREATE INDEX IF NOT EXISTS app_immunizations_patient_idx ON app_immunizations (patient_id);

-- 11) Lab results (clinical PHI incl. critical values)
CREATE TABLE IF NOT EXISTS app_lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  test_name text NOT NULL,
  value text NOT NULL,
  unit text NOT NULL,
  reference_range text,
  status text NOT NULL DEFAULT 'normal',
  date text NOT NULL,
  ordered_by text,
  facility text,
  notes text
);
CREATE INDEX IF NOT EXISTS app_lab_results_patient_idx ON app_lab_results (patient_id);

-- 12) Allergy emergency info (one row per allergy, keyed by allergy_id)
CREATE TABLE IF NOT EXISTS app_allergy_emergency_info (
  allergy_id text PRIMARY KEY,
  emergency_contact_name text,
  emergency_contact_phone text,
  epinephrine_available boolean NOT NULL DEFAULT false,
  epinephrine_location text,
  cross_reactivity_notes text,
  last_reaction_date text,
  action_plan text
);

-- 13) Care gaps (preventive-care/USPSTF; recommendation + summary as jsonb)
CREATE TABLE IF NOT EXISTS app_care_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  recommendation_id text NOT NULL,
  recommendation jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  due_date text,
  last_completed_date text,
  last_assessment_date text,
  identified_at text NOT NULL,
  addressed_at text,
  declined_reason text,
  notes text,
  ai_reasoning text,
  data_sources_summary jsonb
);
CREATE INDEX IF NOT EXISTS app_care_gaps_patient_idx ON app_care_gaps (patient_id);

-- 14) EHR connections (OAuth tokens stored ENCRYPTED in the tokens jsonb)
CREATE TABLE IF NOT EXISTS app_ehr_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  platform text NOT NULL,
  facility_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_auth',
  last_sync text NOT NULL,
  patient_count integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  fhir_config jsonb,
  tokens jsonb,
  smart_context jsonb,
  sync_error text,
  sync_settings jsonb,
  last_sync_result jsonb
);
CREATE INDEX IF NOT EXISTS app_ehr_connections_user_idx ON app_ehr_connections (user_id);

-- 15) Patients (per-EHR patient record; completes the getUserPatientIds IDOR chain)
CREATE TABLE IF NOT EXISTS app_patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unified_patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  mrn text NOT NULL,
  first_name text NOT NULL,
  middle_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth text NOT NULL,
  gender text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL,
  insurance_provider text NOT NULL,
  insurance_id text NOT NULL,
  primary_physician text NOT NULL,
  avatar_url text
);
CREATE INDEX IF NOT EXISTS app_patients_connection_idx ON app_patients (ehr_connection_id);
CREATE INDEX IF NOT EXISTS app_patients_unified_idx ON app_patients (unified_patient_id);

-- 16) Appointments (clinical scheduling)
CREATE TABLE IF NOT EXISTS app_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  provider text NOT NULL,
  facility text NOT NULL,
  scheduled_at text NOT NULL,
  duration integer NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  notes text
);
CREATE INDEX IF NOT EXISTS app_appointments_patient_idx ON app_appointments (patient_id);

-- 17) Health goals (patient goals/progress; ownership-scoped update/delete)
CREATE TABLE IF NOT EXISTS app_health_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  target_value text,
  current_value text,
  unit text,
  start_date text NOT NULL,
  target_date text,
  status text NOT NULL DEFAULT 'active',
  progress integer NOT NULL DEFAULT 0,
  notes text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_health_goals_patient_idx ON app_health_goals (patient_id);

-- 18) Problems (clinical problem/condition list, ICD-coded)
CREATE TABLE IF NOT EXISTS app_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  ehr_connection_id text NOT NULL,
  name text NOT NULL,
  icd_code text,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  onset_date text,
  resolved_date text,
  severity text,
  diagnosed_by text,
  facility text NOT NULL,
  notes text
);
CREATE INDEX IF NOT EXISTS app_problems_patient_idx ON app_problems (patient_id);
CREATE INDEX IF NOT EXISTS app_problems_connection_idx ON app_problems (ehr_connection_id);

-- 19) Wearable connections (OAuth tokens encrypted inside the data jsonb blob)
CREATE TABLE IF NOT EXISTS app_wearable_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS app_wearable_connections_user_idx ON app_wearable_connections (user_id);

-- 20) Wearable data records (metrics: steps, HR, etc.)
CREATE TABLE IF NOT EXISTS app_wearable_data_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  wearable_connection_id text NOT NULL,
  data_type text NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  metadata jsonb,
  recorded_at text NOT NULL,
  synced_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_wearable_data_records_user_idx ON app_wearable_data_records (user_id);
CREATE INDEX IF NOT EXISTS app_wearable_data_records_conn_idx ON app_wearable_data_records (wearable_connection_id);

-- ── Emergency break-glass (demographic emergency folder + single-use tokens) ──
CREATE TABLE IF NOT EXISTS emergency_profiles (
  user_id text PRIMARY KEY,
  blood_type text,
  organ_donor boolean,
  next_of_kin_name text,
  next_of_kin_phone text,
  next_of_kin_relationship text,
  pharmacy_name text,
  pharmacy_phone text,
  pharmacy_address text,
  pcp_name text,
  pcp_phone text,
  advance_directive_status text NOT NULL DEFAULT 'none',
  advance_directive_doc_url text,
  insurance_provider text,
  insurance_member_id text,
  insurance_card_front_url text,
  insurance_card_back_url text,
  latest_health_summary text,
  allow_pinless_basic boolean NOT NULL DEFAULT true,
  updated_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS emergency_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  device_type text NOT NULL,
  name text NOT NULL,
  manufacturer text,
  model_number text,
  serial_number text,
  implant_date text,
  location text,
  mri_conditional boolean,
  card_image_url text,
  status text NOT NULL DEFAULT 'active',
  notes text
);
CREATE INDEX IF NOT EXISTS emergency_devices_user_idx ON emergency_devices (user_id);
CREATE TABLE IF NOT EXISTS emergency_share_tokens (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  max_accesses integer NOT NULL DEFAULT 1,
  access_count integer NOT NULL DEFAULT 0,
  revoked boolean NOT NULL DEFAULT false,
  full_pin_hash text,
  full_dob_hash text,
  label text
);
CREATE INDEX IF NOT EXISTS emergency_share_tokens_user_idx ON emergency_share_tokens (user_id);
CREATE TABLE IF NOT EXISTS emergency_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  user_id text NOT NULL,
  accessed_at text NOT NULL,
  tier text NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  accessor_agency text,
  detail text
);
CREATE INDEX IF NOT EXISTS emergency_access_logs_token_idx ON emergency_access_logs (token);

-- Medication reminders (adherence)
CREATE TABLE IF NOT EXISTS app_medication_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  medication_id text NOT NULL,
  medication_name text NOT NULL,
  dosage text NOT NULL,
  frequency text NOT NULL,
  scheduled_times jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_generated_message text,
  is_active boolean NOT NULL DEFAULT true,
  notify_via_app boolean NOT NULL DEFAULT true,
  notify_via_push boolean NOT NULL DEFAULT false,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_medication_reminders_patient_idx ON app_medication_reminders (patient_id);

-- Medication adherence records (dose-level events)
CREATE TABLE IF NOT EXISTS app_medication_adherence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  medication_id text NOT NULL,
  medication_name text NOT NULL,
  reminder_id text,
  scheduled_time text NOT NULL,
  action text NOT NULL,
  taken_at text,
  missed_reason text,
  missed_reason_details text,
  notes text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_medication_adherence_records_patient_idx ON app_medication_adherence_records (patient_id);
CREATE INDEX IF NOT EXISTS app_medication_adherence_records_med_idx ON app_medication_adherence_records (medication_id);

-- Data sharing consents (PHI-sharing access grants)
CREATE TABLE IF NOT EXISTS app_data_sharing_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id text NOT NULL,
  recipient_id text NOT NULL,
  data_category text NOT NULL,
  access_level text NOT NULL DEFAULT 'read',
  purpose text,
  expires_at text,
  is_active boolean NOT NULL DEFAULT true,
  granted_at text NOT NULL,
  revoked_at text,
  last_accessed_at text,
  access_count integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_data_sharing_consents_patient_idx ON app_data_sharing_consents (patient_user_id);
CREATE INDEX IF NOT EXISTS app_data_sharing_consents_recipient_idx ON app_data_sharing_consents (recipient_id);

-- Sharing recipients (who a patient may share PHI with)
CREATE TABLE IF NOT EXISTS app_sharing_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id text NOT NULL,
  recipient_type text NOT NULL,
  name text NOT NULL,
  organization text,
  email text,
  phone text,
  npi text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sharing_recipients_patient_idx ON app_sharing_recipients (patient_user_id);

COMMIT;
