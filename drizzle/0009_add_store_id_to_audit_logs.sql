-- Phase 0 Safety net: add store_id to audit_logs for per-merchant audit entries.
-- Idempotent: safe to run multiple times. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0009_add_store_id_to_audit_logs.sql

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "store_id" uuid;

--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'audit_logs_store_id_businesses_id_fk'
  ) THEN
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_store_id_businesses_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."businesses"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_store_id_idx" ON "audit_logs" USING btree ("store_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_store_created_idx" ON "audit_logs" USING btree ("store_id", "created_at");

-- Rollback note: to roll back, remove the index, drop the FK constraint, then
-- DROP COLUMN "audit_logs"."store_id". Any store_id values written before rollback
-- will be lost (this is an additive-by-design change).
