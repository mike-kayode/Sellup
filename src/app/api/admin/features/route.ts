import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const isEnabled = url.searchParams.get("isEnabled") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    let query = db.select().from(featureFlags);

    const totalAgg = await db.select({ total: count() }).from(featureFlags);
    const list = await query.orderBy(desc(featureFlags.createdAt)).limit(limit).offset(offset);

    return NextResponse.json({
      features: list,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin features error:", error);
    return NextResponse.json({ error: "Failed to load features" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { key, name, description, isEnabled, enabledForPlans, enabledForStores, metadata } = body;

    const [feature] = await db.insert(featureFlags).values({
      key,
      name,
      description,
      isEnabled: isEnabled ?? false,
      enabledForPlans: enabledForPlans || [],
      enabledForStores: enabledForStores || [],
      metadata: metadata || {},
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "feature.created",
        resourceType: "feature_flag",
        resourceId: feature.id,
        newValue: { key, name, isEnabled },
        ...clientInfo,
      });
    }

    return NextResponse.json({ feature }, { status: 201 });
  } catch (error) {
    console.error("Admin features create error:", error);
    return NextResponse.json({ error: "Failed to create feature" }, { status: 500 });
  }
}
