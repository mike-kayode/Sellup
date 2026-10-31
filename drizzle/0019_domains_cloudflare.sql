-- Phase 4: Custom domains — Cloudflare for SaaS fields.
-- Adds the Cloudflare hostname id, SSL status, ownership TXT token and the
-- last DNS check timestamp to the existing `domains` table.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0019_domains_cloudflare.sql

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "cloudflare_hostname_id" varchar(255);
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "verification_token" varchar(255);
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "dns_checked_at" timestamp with time zone;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "domains_verification_token_idx"
  ON "domains" USING btree ("verification_token")
  WHERE "verification_token" IS NOT NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domains_cloudflare_hostname_id_idx"
  ON "domains" USING btree ("cloudflare_hostname_id")
  WHERE "cloudflare_hostname_id" IS NOT NULL;

-- Rollback note: DROP INDEX domains_verification_token_idx,
-- DROP INDEX domains_cloudflare_hostname_id_idx,
-- ALTER TABLE domains DROP COLUMN cloudflare_hostname_id,
-- ALTER TABLE domains DROP COLUMN verification_token,
-- ALTER TABLE domains DROP COLUMN dns_checked_at.
