-- Indexes supporting bounded admin queues and security-event reporting.
-- Idempotent and compatible with PostgreSQL 13.

CREATE INDEX IF NOT EXISTS "products_moderation_created_idx"
  ON "products" USING btree ("is_flagged", "created_at");

CREATE INDEX IF NOT EXISTS "announcements_created_idx"
  ON "announcements" USING btree ("created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx"
  ON "audit_logs" USING btree ("action", "created_at");
