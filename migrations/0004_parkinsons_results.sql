-- Persist Vista PD Parkinson's tool results (were in-memory Maps, lost on restart
-- and not shared across Cloud Run instances). The result payload columns hold
-- PHI and are written encrypted via PHI_COLUMN_MAP ({ "__enc": <ciphertext> }).
CREATE TABLE IF NOT EXISTS "updrs_assessments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "updrs_result" jsonb NOT NULL,
  "assessed_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "updrs_user_assessed_idx" ON "updrs_assessments" ("user_id", "assessed_at");

CREATE TABLE IF NOT EXISTS "speech_screening_results" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "task_type" text NOT NULL,
  "speech_result" jsonb NOT NULL,
  "assessed_at" timestamp with time zone NOT NULL
);
CREATE INDEX IF NOT EXISTS "speech_user_task_assessed_idx" ON "speech_screening_results" ("user_id", "task_type", "assessed_at");
