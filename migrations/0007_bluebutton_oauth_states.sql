-- Migration: DB-backed OAuth state + PKCE verifier for CMS Blue Button connect flow.
CREATE TABLE IF NOT EXISTS "bluebutton_oauth_states" (
  "state" text PRIMARY KEY NOT NULL,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "code_verifier" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bluebutton_oauth_states_expires_at_idx"
  ON "bluebutton_oauth_states" ("expires_at");
