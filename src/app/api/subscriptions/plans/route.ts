import { NextResponse } from "next/server";
import { PLANS_LIST, getRecommendedPlan } from "@/lib/subscriptions";

/**
 * GET /api/subscriptions/plans
 * Public endpoint listing available subscription plans.
 */
export async function GET() {
  return NextResponse.json(
    {
      plans: PLANS_LIST,
      recommended: getRecommendedPlan(),
    },
    { status: 200 }
  );
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
