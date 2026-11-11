-- Persist the reason a merchant domain was disabled.
-- Idempotent and compatible with PostgreSQL 13.

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "disabled_reason" text;

CREATE INDEX IF NOT EXISTS "domains_status_created_idx"
  ON "domains" USING btree ("status", "created_at");
