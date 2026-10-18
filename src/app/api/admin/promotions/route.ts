import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platformPromotions } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive") || "all";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
    const offset = (page - 1) * limit;

    const query = db.select().from(platformPromotions);
    const where = isActive === "all" ? undefined : eq(platformPromotions.isActive, isActive === "true");

    const totalAgg = await db.select({ total: count() }).from(platformPromotions).where(where);
    const list = await query.where(where).orderBy(desc(platformPromotions.createdAt)).limit(limit).offset(offset);

    return NextResponse.json({
      promotions: list,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin promotions error:", error);
    return NextResponse.json({ error: "Failed to load promotions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const [promotion] = await db.insert(platformPromotions).values(body).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "promotion.created",
        resourceType: "promotion",
        resourceId: promotion.id,
        newValue: { code: promotion.code, discountType: promotion.discountType },
        ...clientInfo,
      });
    }

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (error) {
    console.error("Admin promotions create error:", error);
    return NextResponse.json({ error: "Failed to create promotion" }, { status: 500 });
  }
}
