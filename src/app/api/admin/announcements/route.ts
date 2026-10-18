import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createAuditLog, getClientInfo } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const url = new URL(request.url);
    const isActive = url.searchParams.get("isActive") || "all";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    const query = isActive === "all"
      ? db.select().from(announcements)
      : db.select().from(announcements).where(eq(announcements.isActive, isActive === "true"));

    const totalAgg = isActive === "all"
      ? await db.select({ total: count() }).from(announcements)
      : await db.select({ total: count() }).from(announcements).where(eq(announcements.isActive, isActive === "true"));
    const list = await query.orderBy(desc(announcements.createdAt)).limit(limit).offset(offset);

    return NextResponse.json({
      announcements: list,
      total: totalAgg[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Admin announcements error:", error);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { title, message, type, target, targetPlan, targetStoreId, isActive, scheduledAt, expiresAt } = body;

    const [announcement] = await db.insert(announcements).values({
      title,
      message,
      type: type || "info",
      target: target || "all",
      targetPlan,
      targetStoreId,
      isActive: isActive ?? true,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    const clientInfo = getClientInfo(request);
    if (user) {
      await createAuditLog({
        actorId: user.id,
        actorRole: user.role,
        action: "announcement.created",
        resourceType: "announcement",
        resourceId: announcement.id,
        newValue: { title, target, type },
        ...clientInfo,
      });
    }

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error("Admin announcements create error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}
