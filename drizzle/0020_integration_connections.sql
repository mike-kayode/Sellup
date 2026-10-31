-- Phase 5: Integrations hub — per-store provider connections.
-- Encrypted OAuth tokens (AES-256-GCM), scopes, expiry, last sync/error.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0020_integration_connections.sql

CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "provider" varchar(50) NOT NULL, -- meta | tiktok | whatsapp | google | mailchimp | ...
  "status" varchar(30) NOT NULL DEFAULT 'disconnected', -- connected | disconnected | error | expired
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "external_ids" jsonb NOT NULL DEFAULT '{}'::jsonb, -- provider-specific ids (page id, ig id, ...)
  "encrypted_token" text, -- AES-256-GCM encrypted access token
  "token_expires_at" timestamp with time zone,
  "last_sync_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "integration_connections_store_id_provider_unique" UNIQUE ("store_id", "provider")
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integration_connections_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "integration_connections"
      ADD CONSTRAINT "integration_connections_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_connections_store_id_idx"
  ON "integration_connections" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "integration_connections_provider_idx"
  ON "integration_connections" USING btree ("provider");
CREATE INDEX IF NOT EXISTS "integration_connections_status_idx"
  ON "integration_connections" USING btree ("status");

-- Rollback note: DROP INDEX ...; DROP TABLE integration_connections.
