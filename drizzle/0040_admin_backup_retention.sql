-- Support bounded backup retention scans.
-- Safe to apply more than once on PostgreSQL 13.

CREATE INDEX IF NOT EXISTS "backup_records_completed_retention_idx"
  ON "backup_records" USING btree ("status", "completed_at");
