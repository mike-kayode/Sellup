-- Admin overview query indexes and domain expiry alert support.
-- Idempotent and compatible with PostgreSQL 13.

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "users_role_created_at_idx"
  ON "users" USING btree ("role", "created_at");

CREATE INDEX IF NOT EXISTS "orders_payment_status_created_at_idx"
  ON "orders" USING btree ("payment_status", "created_at");

CREATE INDEX IF NOT EXISTS "payments_status_created_at_idx"
  ON "payments" USING btree ("status", "created_at");

CREATE INDEX IF NOT EXISTS "domains_expires_at_idx"
  ON "domains" USING btree ("expires_at");

CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_created_at_idx"
  ON "webhook_deliveries" USING btree ("status", "created_at");

CREATE INDEX IF NOT EXISTS "background_jobs_status_created_at_idx"
  ON "background_jobs" USING btree ("status", "created_at");
