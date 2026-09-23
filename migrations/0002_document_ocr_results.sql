-- P1-5: Persist OCR results to Postgres (was in-memory Map, lost on restart).
-- Keyed by (user_id, document_id) unique — upsert on re-extract.
CREATE TABLE IF NOT EXISTS "document_ocr_results" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "profile_id" text,
  "document_id" text NOT NULL,
  "extracted_text" text NOT NULL,
  "structured_data" jsonb NOT NULL DEFAULT '{}',
  "category" text NOT NULL,
  "confidence" real NOT NULL DEFAULT 0,
  "raw_ocr_text" text,
  "processing_time" integer NOT NULL DEFAULT 0,
  "extracted_at" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "docr_user_id_idx" ON "document_ocr_results" ("user_id");
CREATE INDEX IF NOT EXISTS "docr_user_profile_idx" ON "document_ocr_results" ("user_id", "profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "docr_user_document_ux" ON "document_ocr_results" ("user_id", "document_id");
