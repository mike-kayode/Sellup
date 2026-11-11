import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, featureFlags } from "@/db/schema";
import { getClientInfo } from "@/lib/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { clearFeatureFlagCache } from "@/lib/feature-flags";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  enabledForPlans: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  enabledForStores: z.array(z.string().uuid()).max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid feature flag ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feature flag update", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { ipAddress, userAgent } = getClientInfo(request);
    const result = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(featureFlags).where(eq(featureFlags.id, id)).limit(1);
      if (!before) return null;
      const [after] = await tx.update(featureFlags)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(featureFlags.id, id))
        .returning();
      await tx.insert(auditLogs).values({
        actorId: user.id,
        actorRole: user.role,
        action: "feature.updated",
        resourceType: "feature_flag",
        resourceId: id,
        previousValue: before,
        newValue: after,
        ipAddress,
        userAgent,
      });
      return after;
    });
    if (!result) return NextResponse.json({ error: "Feature flag not found" }, { status: 404 });
    clearFeatureFlagCache(result.key);
    return NextResponse.json({ feature: result });
  } catch (cause) {
    console.error("Admin feature flag update failed:", cause);
    return NextResponse.json({ error: "Failed to update feature flag" }, { status: 500 });
  }
}
