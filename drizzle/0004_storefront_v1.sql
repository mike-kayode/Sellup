-- Storefront template system (storefront-v1).
-- Idempotent: safe to run multiple times. Applied via `npm run db:storefront`.

CREATE TABLE IF NOT EXISTS "store_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id" varchar(50) NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_templates_template_id_unique" UNIQUE("template_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "scope" varchar(10) DEFAULT 'draft' NOT NULL,
  "template_id" varchar(50) DEFAULT 'storefront-v1' NOT NULL,
  "config" jsonb NOT NULL,
  "published_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_configs_store_scope_unique" UNIQUE("store_id","scope")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_config_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "template_id" varchar(50) DEFAULT 'storefront-v1' NOT NULL,
  "config" jsonb NOT NULL,
  "version" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_configs_revisions_store_version_unique" UNIQUE("store_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_preview_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "token" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_preview_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_configs_store_id_businesses_id_fk') THEN
    ALTER TABLE "store_configs" ADD CONSTRAINT "store_configs_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_config_revisions_store_id_businesses_id_fk') THEN
    ALTER TABLE "store_config_revisions" ADD CONSTRAINT "store_config_revisions_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_preview_tokens_store_id_businesses_id_fk') THEN
    ALTER TABLE "store_preview_tokens" ADD CONSTRAINT "store_preview_tokens_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_configs_store_id_idx" ON "store_configs" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_configs_scope_idx" ON "store_configs" USING btree ("scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_config_revisions_store_id_idx" ON "store_config_revisions" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_preview_tokens_store_id_idx" ON "store_preview_tokens" USING btree ("store_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_preview_tokens_expires_at_idx" ON "store_preview_tokens" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_templates_status_idx" ON "store_templates" USING btree ("status");
--> statement-breakpoint
-- Seed the registry with version 1.
INSERT INTO "store_templates" ("template_id", "version", "status")
VALUES ('storefront-v1', 1, 'active')
ON CONFLICT ("template_id") DO NOTHING;