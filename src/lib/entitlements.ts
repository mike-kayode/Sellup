/**
 * Sell Up central entitlement / feature system.
 *
 * All plan-based feature restrictions should be evaluated through this module
 * instead of hardcoding plan checks throughout the application.
 *
 * Example:
 *   canUseFeature("CUSTOM_DOMAIN", "business")
 *   canUseFeature("AI_DESCRIPTION", "pro")
 */

export type PlanId = "freemium" | "starter" | "business" | "pro";

export type FeatureKey =
  | "UNLIMITED_PRODUCTS"
  | "PRODUCT_LISTING_TEMPLATE"
  | "MULTIPLE_STAFF"
  | "INVENTORY_TRACKING"
  | "COUPONS"
  | "PRODUCT_VARIANTS"
  | "CUSTOMER_MANAGEMENT"
  | "CUSTOM_DOMAIN"
  | "FACEBOOK_PIXEL"
  | "GOOGLE_ANALYTICS"
  | "REMOVE_BRANDING"
  | "CUSTOM_THEME_COLORS"
  | "CATEGORIES"
  | "SEO_SETTINGS"
  | "ADVANCED_ANALYTICS"
  | "PRIORITY_SUPPORT"
  | "AI_DESCRIPTION"
  | "PREMIUM_THEMES"
  | "ADVANCED_SALES_REPORTS"
  | "API_ACCESS"
  | "WHATSAPP_AUTOMATION"
  | "EXPORT_REPORTS"
  | "WHITE_LABEL"
  | "INTEGRATIONS"
  | "WEBHOOKS"
  | "ACTIVITY_LOG"
  | "CUSTOM_LOGO"
  | "PAYSTACK_CHECKOUT";

/** Feature definitions and which plans include them. */
export const FEATURE_MATRIX: Record<FeatureKey, PlanId[]> = {
  // Starter is capped at 20 products; unlimited starts at the ₦12,000 plan.
  UNLIMITED_PRODUCTS: ["business", "pro"],
  // Product listing template (Showcase) is a paid-plan perk from ₦5,000/month.
  PRODUCT_LISTING_TEMPLATE: ["starter", "business", "pro"],
  MULTIPLE_STAFF: ["business", "pro"],
  INVENTORY_TRACKING: ["business", "pro"],
  COUPONS: ["business", "pro"],
  PRODUCT_VARIANTS: ["business", "pro"],
  CUSTOMER_MANAGEMENT: ["business", "pro"],
  CUSTOM_DOMAIN: ["business", "pro"],
  FACEBOOK_PIXEL: ["business", "pro"],
  GOOGLE_ANALYTICS: ["pro"],
  REMOVE_BRANDING: ["starter", "business", "pro"],
  CUSTOM_THEME_COLORS: ["starter", "business", "pro"],
  CATEGORIES: ["starter", "business", "pro"],
  SEO_SETTINGS: ["starter", "business", "pro"],
  ADVANCED_ANALYTICS: ["starter", "business", "pro"],
  PRIORITY_SUPPORT: ["starter", "business", "pro"],
  AI_DESCRIPTION: ["pro"],
  PREMIUM_THEMES: ["pro"],
  ADVANCED_SALES_REPORTS: ["pro"],
  API_ACCESS: ["pro"],
  WHATSAPP_AUTOMATION: ["pro"],
  EXPORT_REPORTS: ["pro"],
  WHITE_LABEL: ["pro"],
  // Paid-plan toolkit modules (shown in the dashboard only for paid merchants).
  INTEGRATIONS: ["starter", "business", "pro"],
  WEBHOOKS: ["starter", "business", "pro"],
  ACTIVITY_LOG: ["starter", "business", "pro"],
  // Custom merchant logos + Paystack checkout are paid-plan perks.
  CUSTOM_LOGO: ["starter", "business", "pro"],
  PAYSTACK_CHECKOUT: ["starter", "business", "pro"],
};

/** Plan limits keyed by plan id. */
export const PLAN_LIMITS: Record<
  PlanId,
  { products: number; staffMembers: number }
> = {
  freemium: { products: 5, staffMembers: 1 },
  starter: { products: 20, staffMembers: 1 },
  business: { products: -1, staffMembers: 5 },
  pro: { products: -1, staffMembers: -1 },
};

const PLAN_RANK: Record<PlanId, number> = {
  freemium: 0,
  starter: 1,
  business: 2,
  pro: 3,
};

/**
 * Check whether a given plan can use a feature.
 */
export function canUseFeature(
  feature: FeatureKey,
  plan: PlanId | null | undefined
): boolean {
  const p = (plan || "freemium") as PlanId;
  const allowedPlans = FEATURE_MATRIX[feature];
  if (!allowedPlans) return false;
  return allowedPlans.includes(p);
}

/**
 * Check whether a plan supports a resource count limit.
 * Returns -1 for unlimited.
 */
export function getProductLimit(plan: PlanId | null | undefined): number {
  return PLAN_LIMITS[(plan || "freemium") as PlanId].products;
}

export function getStaffLimit(plan: PlanId | null | undefined): number {
  return PLAN_LIMITS[(plan || "freemium") as PlanId].staffMembers;
}

/**
 * Compare two plans (returns true if planA is at least planB rank).
 */
export function isPlanAtLeast(
  plan: PlanId | null | undefined,
  minPlan: PlanId
): boolean {
  return PLAN_RANK[(plan || "freemium") as PlanId] >= PLAN_RANK[minPlan];
}

/**
 * A "paid" subscriber is any plan above freemium (starter, business, pro).
 * Used to gate dashboard modules, custom logos and Paystack checkout.
 */
export function isPaidPlan(plan: PlanId | null | undefined): boolean {
  return isPlanAtLeast(plan, "starter");
}

/**
 * Normalize a raw plan string to a valid PlanId.
 */
export function normalizePlan(plan: string | null | undefined): PlanId {
  const p = (plan || "freemium").toLowerCase();
  if (p in PLAN_RANK) return p as PlanId;
  return "freemium";
}
