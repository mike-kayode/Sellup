-- Phase 1: buyer (user) accounts per merchant.
-- Adds password auth, sessions and password-reset tokens to the `customers`
-- table (buyers). Every buyer belongs to exactly one store (store_id).
-- Idempotent: safe to run multiple times. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0011_buyer_accounts_core.sql

-- Buyer password hash + verification flags (nullable: guest buyers have none).
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_email_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_whatsapp_verified" boolean NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "whatsapp" varchar(20);

--> statement-breakpoint
-- Unique phone + optional whatsapp per store (whatsapp may be null for many rows).
CREATE UNIQUE INDEX IF NOT EXISTS "customers_store_id_phone_unique"
  ON "customers" USING btree ("store_id", "phone");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_store_id_whatsapp_unique"
  ON "customers" USING btree ("store_id", "whatsapp")
  WHERE "whatsapp" IS NOT NULL;

--> statement-breakpoint
-- Buyer sessions: one HttpOnly cookie per store; only the SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS "customer_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE cascade,
  "token_hash" varchar(64) NOT NULL,       -- SHA-256 of the random session token
  "cookie_name" varchar(100) NOT NULL,      -- per-store cookie name
  "expires_at" timestamp with time zone NOT NULL,  -- absolute expiry
  "last_used_at" timestamp with time zone NOT NULL DEFAULT now(),  -- idle tracking
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_sessions_store_id_idx" ON "customer_sessions" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "customer_sessions_customer_id_idx" ON "customer_sessions" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_sessions_token_hash_idx" ON "customer_sessions" USING btree ("token_hash");
CREATE INDEX IF NOT EXISTS "customer_sessions_expires_at_idx" ON "customer_sessions" USING btree ("expires_at");

--> statement-breakpoint
-- Buyer tokens: password reset / email verification / whatsapp verification.
CREATE TABLE IF NOT EXISTS "customer_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "public"."customers"("id") ON DELETE cascade,
  "type" varchar(30) NOT NULL,              -- password_reset | email_verify | whatsapp_verify
  "token_hash" varchar(64) NOT NULL,        -- SHA-256 of the random token
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_tokens_store_id_idx" ON "customer_tokens" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "customer_tokens_customer_id_idx" ON "customer_tokens" USING btree ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_tokens_type_hash_idx" ON "customer_tokens" USING btree ("type", "token_hash");
CREATE INDEX IF NOT EXISTS "customer_tokens_expires_at_idx" ON "customer_tokens" USING btree ("expires_at");

-- Rollback note: DROP INDEX ...; DROP TABLE customer_tokens; DROP TABLE customer_sessions;
-- then DROP COLUMN customers.password_hash, is_email_verified, is_whatsapp_verified, whatsapp.
