-- P1-3/§4: add homeRegion to profiles for vaccine schedule region-gate routing.
-- Existing rows default to 'us-acip' (US CDC/ACIP schedule).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS home_region TEXT NOT NULL DEFAULT 'us-acip';
