import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
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
    const { isEnabled, enabledForPlans, enabledForStores, metadata } = body;

    const [existing] = await db.select().from(featureFlags).where(eq(featureFlags.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(featureFlags)
      .set({
        isEnabled: isEnabled ?? false,
        enabledForPlans: enabledForPlans || undefined,
        enabledForStores: enabledForStores || undefined,
        metadata: metadata || undefined,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, id))
      .returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "feature.updated",
        resourceType: "feature_flag",
        resourceId: id,
        previousValue: { isEnabled: existing.isEnabled },
        newValue: { isEnabled: updated?.isEnabled },
        ...clientInfo,
      });
    }

    return NextResponse.json({ feature: updated });
  } catch (error) {
    console.error("Admin feature update error:", error);
    return NextResponse.json({ error: "Failed to update feature" }, { status: 500 });
  }
}
