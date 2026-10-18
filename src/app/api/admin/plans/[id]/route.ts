import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const { id } = await context.params;
    const body = await request.json();

    const [existing] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const previousValue = { price: existing.price, name: existing.name, features: existing.features };

    const [updated] = await db
      .update(plans)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))
      .returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "plan.updated",
        resourceType: "plan",
        resourceId: id,
        previousValue,
        newValue: { price: updated?.price, name: updated?.name },
        ...clientInfo,
      });
    }

    return NextResponse.json({ plan: updated });
  } catch (error) {
    console.error("Admin plan update error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
