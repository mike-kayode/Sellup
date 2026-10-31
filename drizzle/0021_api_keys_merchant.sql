-- Phase 6: Merchant API keys — per-store keys with scopes and expiry.
-- Adds store_id, scopes, expiry and last-used metadata to api_keys.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0021_api_keys_merchant.sql

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "store_id" uuid REFERENCES "public"."businesses"("id") ON DELETE cascade;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "last_used_ip" varchar(45);
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "last_used_at" timestamp with time zone;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'api_keys_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "api_keys"
      ADD CONSTRAINT "api_keys_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_store_id_idx" ON "api_keys" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "api_keys_expires_at_idx" ON "api_keys" USING btree ("expires_at");

-- Rollback note: DROP INDEX ...; ALTER TABLE api_keys DROP COLUMN store_id, scopes, expires_at, last_used_ip, last_used_at.
