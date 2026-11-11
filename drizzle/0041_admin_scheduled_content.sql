-- Add scheduled publication for platform pages.
-- Safe to apply more than once on PostgreSQL 13.

ALTER TABLE "content_pages"
  ADD COLUMN IF NOT EXISTS "scheduled_at" timestamptz;

CREATE INDEX IF NOT EXISTS "content_pages_status_scheduled_idx"
  ON "content_pages" USING btree ("status", "scheduled_at");
