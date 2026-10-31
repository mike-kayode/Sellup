-- Phase 1: rename the store-owner role to "merchant" in code and UI.
-- Users who own a business are merchants; keep platform roles (superadmin,
-- admin, support, ...) untouched. Idempotent. PostgreSQL 13 compatible.
-- Apply with: psql -v ON_ERROR_STOP=1 --single-transaction -f drizzle/0012_rename_store_owner_role_to_merchant.sql

-- Migrate existing store-owner user rows (role 'user' who own a business) to 'merchant'.
UPDATE "users"
SET "role" = 'merchant', "updated_at" = now()
WHERE "role" = 'user'
  AND "id" IN (SELECT "user_id" FROM "public"."businesses");

-- Rollback note: to roll back, UPDATE users SET role='user' WHERE role='merchant'.
-- This is a one-time data migration; re-running is a no-op for already-migrated rows.
