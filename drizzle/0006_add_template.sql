-- Product listing template for the storefront: 'basic' | 'showcase'.
-- 'showcase' is gated to the ₦5,000/month plan and above via
-- PRODUCT_LISTING_TEMPLATE (checked in /api/stores/update and at render time).
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "template" varchar(50) DEFAULT 'basic';
