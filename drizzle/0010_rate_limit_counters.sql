-- Phase 0 Safety net: database-backed rate limit counters for auth and API endpoints.
-- Idempotent: safe to run multiple times. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0010_rate_limit_counters.sql

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" varchar(255) NOT NULL,
  "endpoint" varchar(100) NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "window_start" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rate_limit_counters_identifier_endpoint_unique'
  ) THEN
    ALTER TABLE "rate_limit_counters"
      ADD CONSTRAINT "rate_limit_counters_identifier_endpoint_unique"
      UNIQUE ("identifier", "endpoint");
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_counters_identifier_endpoint_idx"
  ON "rate_limit_counters" USING btree ("identifier", "endpoint");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_counters_window_start_idx"
  ON "rate_limit_counters" USING btree ("window_start");

-- Rollback note: DROP INDEX rate_limit_counters_identifier_endpoint_idx,
-- DROP INDEX rate_limit_counters_window_start_idx, DROP TABLE rate_limit_counters.
