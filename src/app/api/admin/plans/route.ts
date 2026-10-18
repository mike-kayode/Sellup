import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const list = await db.select().from(plans).orderBy(desc(plans.createdAt));
    const totalAgg = await db.select({ total: count() }).from(plans);

    return NextResponse.json({
      plans: list,
      total: totalAgg[0]?.total ?? 0,
    });
  } catch (error) {
    console.error("Admin plans error:", error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [plan] = await db.insert(plans).values(body).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "plan.created",
        resourceType: "plan",
        resourceId: plan.id,
        newValue: plan,
        ...clientInfo,
      });
    }

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("Admin plans create error:", error);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
