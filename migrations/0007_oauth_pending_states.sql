-- Short-lived OAuth CSRF state tokens for CMS Blue Button 2.0.
-- Replaces the in-process Map in bluebutton-routes.ts so the CSRF check works
-- across multiple Cloud Run instances. Rows expire in 10 min; consumed on use.

CREATE TABLE IF NOT EXISTS "oauth_pending_states" (
  "state"      text        PRIMARY KEY,
  "profile_id" uuid        NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "oauth_pending_states_expires_idx"
  ON "oauth_pending_states" ("expires_at");
