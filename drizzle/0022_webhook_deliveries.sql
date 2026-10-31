-- Phase 6: Webhook deliveries log with retry scheduling.
-- Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0022_webhook_deliveries.sql

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "public"."businesses"("id") ON DELETE cascade,
  "webhook_id" uuid NOT NULL REFERENCES "public"."webhooks"("id") ON DELETE cascade,
  "event" varchar(100) NOT NULL,
  "url" varchar(500) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending', -- pending | delivered | failed | disabled
  "attempt" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_http_code" integer,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "delivered_at" timestamp with time zone
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'webhook_deliveries_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "webhook_deliveries"
      ADD CONSTRAINT "webhook_deliveries_store_id_businesses_id_fk"
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
    WHERE conname = 'webhook_deliveries_webhook_id_webhooks_id_fk'
  ) THEN
    ALTER TABLE "webhook_deliveries"
      ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk"
      FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_deliveries_store_id_idx"
  ON "webhook_deliveries" USING btree ("store_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhook_id_idx"
  ON "webhook_deliveries" USING btree ("webhook_id");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_status_idx"
  ON "webhook_deliveries" USING btree ("status");
CREATE INDEX IF NOT EXISTS "webhook_deliveries_next_attempt_idx"
  ON "webhook_deliveries" USING btree ("next_attempt_at")
  WHERE "status" = 'pending';

-- Rollback note: DROP INDEX ...; DROP TABLE webhook_deliveries.
