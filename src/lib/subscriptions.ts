/**
 * Subscriptions & Billing helpers for Sell Up.
 *
 * Provides plan metadata, pricing, and helpers to determine a store's
 * current entitlement level. All plan-based feature restrictions should be
 * evaluated through `entitlements`/`subscriptions` instead of hardcoding.
 */
import {
  canUseFeature,
  FeatureKey,
  getProductLimit,
  getStaffLimit,
  isPlanAtLeast,
  normalizePlan,
  PlanId,
} from "./entitlements";

export interface PlanInfo {
  id: PlanId;
  name: string;
  price: number; // NGN per month, 0 = freemium
  priceOnRequest?: boolean; // true = custom pricing (no public price)
  billingCycle: "monthly" | "yearly";
  tagline: string;
  features: string[];
  limits: {
    products: number; // -1 = unlimited
    staffMembers: number; // -1 = unlimited
  };
}

export const PLANS: Record<PlanId, PlanInfo> = {
  freemium: {
    id: "freemium",
    name: "Freemium",
    price: 0,
    billingCycle: "monthly",
    tagline: "Best to start",
    features: [
      "5 Products",
      "1 Store Admin",
      "Basic Theme",
      "WhatsApp Orders",
      "Store URL",
      "Platform Branding",
      "Basic Analytics",
    ],
    limits: { products: 5, staffMembers: 1 },
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 5000,
    billingCycle: "monthly",
    tagline: "For growing businesses",
    features: [
      "20 Products",
      "Product Listing Template",
      "Remove Sell Up Branding",
      "Custom Theme Colors",
      "Categories",
      "SEO Settings",
      "Priority Support",
    ],
    limits: { products: 20, staffMembers: 1 },
  },
  business: {
    id: "business",
    name: "Business",
    price: 12000,
    billingCycle: "monthly",
    tagline: "For busy stores",
    features: [
      "Unlimited Products",
      "Everything in Starter",
      "Multiple Staff (up to 5)",
      "Inventory Tracking",
      "Coupon Codes",
      "Custom Domain",
      "Advanced Analytics",
    ],
    limits: { products: -1, staffMembers: 5 },
  },
  pro: {
    id: "pro",
    name: "Custom",
    price: 0,
    priceOnRequest: true,
    billingCycle: "monthly",
    tagline: "Tailored to your business",
    features: [
      "Unlimited Products",
      "Everything in Business",
      "Unlimited Staff",
      "API Access",
      "White Label",
      "Dedicated Support",
    ],
    limits: { products: -1, staffMembers: -1 },
  },
};

export const PLANS_LIST: PlanInfo[] = [
  PLANS.freemium,
  PLANS.starter,
  PLANS.business,
  PLANS.pro,
];

export function getPlan(plan: PlanId | null | undefined): PlanInfo {
  return PLANS[normalizePlan(plan)];
}

export function canUseFeatureOnPlan(
  plan: PlanId | null | undefined,
  feature: FeatureKey
): boolean {
  return canUseFeature(feature, normalizePlan(plan));
}

export function canStoreUseFeature(
  plan: PlanId | null | undefined,
  feature: FeatureKey
): boolean {
  return canUseFeature(feature, normalizePlan(plan));
}

export function productLimitForPlan(plan: PlanId | null | undefined): number {
  return getProductLimit(normalizePlan(plan));
}

export function staffLimitForPlan(plan: PlanId | null | undefined): number {
  return getStaffLimit(normalizePlan(plan));
}

export function planAtLeast(
  plan: PlanId | null | undefined,
  minPlan: PlanId
): boolean {
  return isPlanAtLeast(normalizePlan(plan), minPlan);
}

export function formatPrice(plan: PlanInfo): string {
  if (plan.priceOnRequest) return "Custom";
  if (plan.price === 0) return "Free";
  return `₦${plan.price.toLocaleString()}/${plan.billingCycle === "yearly" ? "year" : "month"}`;
}

/**
 * Return the recommended plan id for highlighting in the pricing UI.
 */
export function getRecommendedPlan(): PlanId {
  return "starter";
}
