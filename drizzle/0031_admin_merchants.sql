-- Merchant management, internal notes and revocable app-level impersonation.
-- Idempotent and compatible with PostgreSQL 13.

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status_reason" text;

CREATE TABLE IF NOT EXISTS "business_internal_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "actor_id" uuid REFERENCES "public"."users"("id") ON DELETE SET NULL,
  "note" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "business_internal_notes_store_created_idx"
  ON "business_internal_notes" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "business_internal_notes_actor_idx"
  ON "business_internal_notes" USING btree ("actor_id");

CREATE TABLE IF NOT EXISTS "admin_impersonation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "admin_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "merchant_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_impersonation_sessions_token_hash_unique" UNIQUE ("token_hash")
);

CREATE INDEX IF NOT EXISTS "admin_impersonation_sessions_store_idx"
  ON "admin_impersonation_sessions" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "admin_impersonation_sessions_admin_idx"
  ON "admin_impersonation_sessions" USING btree ("admin_user_id");
CREATE INDEX IF NOT EXISTS "admin_impersonation_sessions_expires_idx"
  ON "admin_impersonation_sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "admin_impersonation_sessions_store_active_idx"
  ON "admin_impersonation_sessions" USING btree ("store_id", "revoked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "admin_impersonation_sessions_admin_active_idx"
  ON "admin_impersonation_sessions" USING btree ("admin_user_id", "revoked_at");

CREATE INDEX IF NOT EXISTS "users_full_name_lower_idx"
  ON "users" USING btree (lower("full_name"));
CREATE INDEX IF NOT EXISTS "users_email_lower_idx"
  ON "users" USING btree (lower("email"));
CREATE INDEX IF NOT EXISTS "businesses_plan_idx"
  ON "businesses" USING btree ("plan");
CREATE INDEX IF NOT EXISTS "businesses_country_idx"
  ON "businesses" USING btree ("country");
CREATE INDEX IF NOT EXISTS "businesses_country_lower_idx"
  ON "businesses" USING btree (lower("country"));
CREATE INDEX IF NOT EXISTS "businesses_status_idx"
  ON "businesses" USING btree ("is_published", "is_suspended", "is_restricted", "is_verified");
CREATE INDEX IF NOT EXISTS "businesses_name_lower_idx"
  ON "businesses" USING btree (lower("store_name"));
CREATE INDEX IF NOT EXISTS "businesses_slug_lower_idx"
  ON "businesses" USING btree (lower("store_slug"));

CREATE INDEX IF NOT EXISTS "orders_store_created_at_idx"
  ON "orders" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "products_store_created_at_idx"
  ON "products" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "subscriptions_store_created_at_idx"
  ON "subscriptions" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "domains_store_created_at_idx"
  ON "domains" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_keys_store_created_at_idx"
  ON "api_keys" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "webhooks_store_created_at_idx"
  ON "webhooks" USING btree ("store_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_generations_store_created_at_idx"
  ON "ai_generations" USING btree ("store_id", "created_at");
