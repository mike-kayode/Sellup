-- Platform account session revocation and buyer blocking.
-- Idempotent and compatible with PostgreSQL 13.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sessions_revoked_at" timestamp with time zone;

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "is_blocked" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "customers_store_created_at_idx"
  ON "customers" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "customers_store_blocked_created_idx"
  ON "customers" USING btree ("store_id", "is_blocked", "created_at");
CREATE INDEX IF NOT EXISTS "customers_name_lower_idx"
  ON "customers" USING btree (lower("name"));
CREATE INDEX IF NOT EXISTS "customers_email_lower_idx"
  ON "customers" USING btree (lower("email"));
CREATE INDEX IF NOT EXISTS "customers_phone_idx"
  ON "customers" USING btree ("phone");
