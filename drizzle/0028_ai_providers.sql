-- Phase 8: AI features — provider configs, usage tracking and quotas.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0028_ai_providers.sql

CREATE TABLE IF NOT EXISTS "ai_providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL, -- openai | anthropic | google | ...
  "endpoint" varchar(500),
  "encrypted_api_key" text, -- AES-256-GCM encrypted
  "is_active" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_quotas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "monthly_token_limit" integer NOT NULL DEFAULT 1000000,
  "monthly_cost_cap" decimal(12, 4) NOT NULL DEFAULT '0.0000',
  "tokens_used_this_month" integer NOT NULL DEFAULT 0,
  "cost_used_this_month" decimal(12, 4) NOT NULL DEFAULT '0.0000',
  "month_start" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ai_quotas_store_id_unique" UNIQUE ("store_id")
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "provider" varchar(100) NOT NULL,
  "feature" varchar(50) NOT NULL, -- product_copy | seo | background_cleanup | catalog_bulk | assistant | insight
  "prompt" text NOT NULL,
  "response" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "cost_usd" decimal(12, 6),
  "status" varchar(30) NOT NULL DEFAULT 'pending', -- pending | completed | failed | blocked_quota | blocked_pii
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_quotas_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "ai_quotas"
      ADD CONSTRAINT "ai_quotas_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_generations_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "ai_generations"
      ADD CONSTRAINT "ai_generations_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_quotas_store_id_idx" ON "ai_quotas" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "ai_generations_store_id_idx" ON "ai_generations" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "ai_generations_feature_idx" ON "ai_generations" USING btree ("feature");
CREATE INDEX IF NOT EXISTS "ai_generations_created_at_idx" ON "ai_generations" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "ai_providers_is_active_idx" ON "ai_providers" USING btree ("is_active");
CREATE INDEX IF NOT EXISTS "ai_providers_default_idx" ON "ai_providers" USING btree ("is_default");

-- Rollback note: DROP INDEX ...; DROP TABLE ai_generations; DROP TABLE ai_quotas; DROP TABLE ai_providers.
