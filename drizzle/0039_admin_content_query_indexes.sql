-- Index public and tenant-targeted announcement/content lookups.
-- Idempotent and compatible with PostgreSQL 13.

CREATE INDEX IF NOT EXISTS "announcements_target_plan_schedule_idx"
  ON "announcements" USING btree ("target", "target_plan", "scheduled_at", "expires_at");

CREATE INDEX IF NOT EXISTS "announcements_target_store_schedule_idx"
  ON "announcements" USING btree ("target", "target_store_id", "scheduled_at", "expires_at");

CREATE INDEX IF NOT EXISTS "knowledge_base_articles_public_updated_idx"
  ON "knowledge_base_articles" USING btree ("is_published", "updated_at");

CREATE INDEX IF NOT EXISTS "content_pages_status_updated_idx"
  ON "content_pages" USING btree ("status", "updated_at");

CREATE INDEX IF NOT EXISTS "blog_posts_public_published_at_idx"
  ON "blog_posts" USING btree ("is_published", "published_at");

CREATE INDEX IF NOT EXISTS "faqs_public_sort_idx"
  ON "faqs" USING btree ("is_published", "sort_order");
