import { NextResponse } from "next/server";
import { db } from "@/db";
import { plans as plansTable } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { PLANS_LIST, getRecommendedPlan } from "@/lib/subscriptions";

/**
 * GET /api/subscriptions/plans
 * Public endpoint listing available subscription plans.
 */
export async function GET() {
  try {
    const storedPlans = await db.select().from(plansTable)
      .where(inArray(plansTable.slug, PLANS_LIST.map((plan) => plan.id)));
    const bySlug = new Map(storedPlans.map((plan) => [plan.slug, plan]));
    const publicPlans = PLANS_LIST.flatMap((fallback) => {
      const saved = bySlug.get(fallback.id);
      if (saved && !saved.isActive) return [];
      if (!saved) return [fallback];
      return [{
        ...fallback,
        name: saved.name,
        price: Number(saved.interval === "year" ? saved.yearlyPrice ?? saved.price : saved.price),
        billingCycle: saved.interval === "year" ? "yearly" as const : "monthly" as const,
        tagline: saved.description || fallback.tagline,
        features: Array.isArray(saved.features)
          ? saved.features.filter((feature): feature is string => typeof feature === "string")
          : fallback.features,
        limits: {
          products: saved.productLimit ?? fallback.limits.products,
          staffMembers: saved.staffLimit ?? fallback.limits.staffMembers,
        },
        priceOnRequest: fallback.id === "pro" && Number(saved.price) === 0,
      }];
    });
    const recommended = storedPlans.find((plan) => plan.isActive && plan.isRecommended)?.slug || getRecommendedPlan();
    return NextResponse.json({ plans: publicPlans, recommended });
  } catch (error) {
    console.error("Public plans query failed:", error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
